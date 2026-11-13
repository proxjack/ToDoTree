// Guided end-to-end scenario: loads index.html from file:// in a real browser and exercises the main features.
const { chromium } = require('playwright');
const nodePath = require('path'), os = require('os'), fs = require('fs');
const path = nodePath.resolve(__dirname, '..', 'index.html');
let failed = 0;
const log = (ok, msg) => { if (!ok) failed++; console.log((ok ? 'PASS ' : 'FAIL ') + msg); };

// Dates relative to today, so the tests do not break as time passes
const iso = days => new Date(Date.now() - new Date().getTimezoneOffset() * 60000 + days * 864e5).toISOString().slice(0, 10);
const addDaysISO = (s, n) => new Date(Date.parse(s + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);

const countOverlaps = ns => {
  let c = 0;
  for (let i = 0; i < ns.length; i++) for (let j = i + 1; j < ns.length; j++) {
    const a = ns[i], b = ns[j];
    if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) c++;
  }
  return c;
};

(async () => {
  const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { channel: 'chrome' });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 800 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto(require('url').pathToFileURL(path).href);
  await page.waitForTimeout(500);

  const nodes = async () => page.$$eval('.node', ns => ns.map(n => { const r = n.getBoundingClientRect(); return { id: n.dataset.id, t: n.querySelector('.txt').textContent, x: r.x, y: r.y, w: r.width, h: r.height }; }));
  let ns = await nodes();
  log(ns.length === 16, 'initial nodes = 16 (found ' + ns.length + ')');
  const root = ns.find(n => n.t.startsWith('Process'));
  const TOP = ['Requirements', 'Design', 'Prototype', 'Testing and validation', 'Release'];
  const kids = ns.filter(n => TOP.includes(n.t));
  log(kids.every(k => k.y > root.y + root.h), 'children are below the root');
  log(root.y < 200, 'root at the top (y=' + Math.round(root.y) + ')');
  const sorted = [...kids].sort((a, b) => a.x - b.x).map(k => k.t);
  log(sorted.join() === TOP.join(), 'sibling order is the sequence, left to right');
  const overlap = countOverlaps(ns);
  log(overlap === 0, 'no overlapping nodes (' + overlap + ')');
  await page.screenshot({ path: nodePath.join(os.tmpdir(), 'todotree-1-initial.png') });

  // double click opens the card; the title is focused and selected, so typing replaces it
  const des = kids.find(k => k.t === 'Design');
  await page.mouse.dblclick(des.x + des.w / 2, des.y + des.h / 2 - 4);
  await page.waitForTimeout(100);
  await page.keyboard.type('Engineering');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(400);
  ns = await nodes();
  log(ns.some(n => n.t === 'Engineering'), 'rename through the card (double click)');

  // add a child with Tab
  await page.keyboard.press('Tab');
  await page.waitForTimeout(300);
  await page.keyboard.type('Schema review');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(400);
  ns = await nodes();
  log(ns.length === 17 && ns.some(n => n.t === 'Schema review'), 'new child with Tab (nodes=' + ns.length + ')');

  // checkbox
  const asm = ns.find(n => n.t === 'Assembly');
  const kk = await page.evaluate(() => window.__trees.data.trees[0].view.k);
  await page.mouse.click(asm.x + 24 * kk, asm.y + 21 * kk);
  await page.waitForTimeout(300);
  const doneAsm = await page.evaluate(() => { const r = window.__trees.data.trees[0].root; return r.children[2].children[1].done; });
  log(doneAsm === true, 'checkbox marks the node as done');

  await page.click('#fit'); await page.waitForTimeout(300);
  // reparent: drag "Delivery" onto "Prototype"
  ns = await nodes();
  const cons = ns.find(n => n.t === 'Delivery'), proto = ns.find(n => n.t === 'Prototype');
  await page.mouse.move(cons.x + cons.w / 2 + 10, cons.y + cons.h / 2);
  await page.mouse.down();
  await page.mouse.move(proto.x + proto.w / 2, proto.y + proto.h / 2, { steps: 12 });
  const hasDrop = await page.$('.node.drop');
  log(!!hasDrop, 'drop target is highlighted while dragging');
  await page.mouse.up();
  await page.waitForTimeout(500);
  const parentOfCons = await page.evaluate(() => { const r = window.__trees.data.trees[0].root; for (const c of r.children) if (c.children.some(x => x.text === 'Delivery')) return c.text; });
  log(parentOfCons === 'Prototype', 'reattach: Delivery is now under ' + parentOfCons);
  await page.screenshot({ path: nodePath.join(os.tmpdir(), 'todotree-2-reparent.png') });

  // free drop: move "Documentation" into the free space below
  ns = await nodes();
  const doc = ns.find(n => n.t === 'Documentation');
  await page.mouse.move(doc.x + doc.w / 2 + 10, doc.y + doc.h / 2);
  await page.mouse.down();
  await page.mouse.move(doc.x + doc.w / 2 + 10, doc.y + 150, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(500);
  const ns2 = await nodes();
  const doc2 = ns2.find(n => n.t === 'Documentation');
  log(Math.abs(doc2.y - doc.y - (150 - doc.h / 2)) < 15, 'free move (dy=' + Math.round(doc2.y - doc.y) + ')');
  const onGrid = await page.evaluate(() => {
    const el = [...document.querySelectorAll('.node')].find(n => n.querySelector('.txt').textContent === 'Documentation');
    const m = el.style.transform.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/);
    return [+m[1], +m[2]].map(v => Math.abs(v / 28 - Math.round(v / 28)) < 0.01);
  });
  log(onGrid[0] && onGrid[1], 'snaps to the 28px grid after the drop');
  const off = await page.evaluate(() => { const r = window.__trees.data.trees[0].root; return r.children[4].children[0].dy; });
  log(off > 100, 'offset stored in the model (' + off + ')');

  // undo restores
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(500);
  const ns3 = await nodes();
  const doc3 = ns3.find(n => n.t === 'Documentation');
  log(Math.abs(doc3.y - doc.y) < 6, 'undo restores the position');
  await page.keyboard.press('Control+y');
  await page.waitForTimeout(500);

  // ceiling: dragging a node far up does not cross the surface (the root's y)
  ns = await nodes();
  const rootT = ns.find(n => n.t.startsWith('Process')), req = ns.find(n => n.t === 'Requirements');
  await page.mouse.move(req.x + 10, req.y + req.h / 2);
  await page.mouse.down();
  await page.mouse.move(req.x + 10, 5, { steps: 12 });
  const midCeil = (await nodes()).find(n => n.t === 'Requirements');
  log(midCeil.y >= rootT.y - 1, 'ceiling while dragging (y=' + Math.round(midCeil.y) + ' >= ' + Math.round(rootT.y) + ')');
  await page.mouse.up();
  await page.waitForTimeout(600);
  ns = await nodes();
  log(ns.every(n => n.y >= rootT.y - 1), 'ceiling: no node above the surface after the drop');
  let ov = countOverlaps(ns);
  log(ov === 0, 'bubbles: no overlap after the move (' + ov + ')');
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(500);

  // ceiling in front of the root: the dropped node yields, the root does not move
  ns = await nodes();
  const root0 = ns.find(n => n.t.startsWith('Process')), pro = ns.find(n => n.t === 'Prototype');
  await page.mouse.move(pro.x + pro.w / 2 + 8, pro.y + pro.h / 2);
  await page.mouse.down();
  await page.mouse.move(pro.x + pro.w / 2 + 8, 2, { steps: 15 });
  await page.mouse.up();
  await page.waitForTimeout(700);
  ns = await nodes();
  const root1 = ns.find(n => n.t.startsWith('Process'));
  log(Math.abs(root1.y - root0.y) < 1 && Math.abs(root1.x - root0.x) < 1, 'the root is not pushed away');
  ov = countOverlaps(ns);
  log(ov === 0 && ns.every(n => n.y >= root0.y - 1), 'drop at the ceiling: no overlaps and nothing above the ceiling');
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(500);

  // bubbles: a node dropped straddling another one (pointer in empty space) pushes it away
  ns = await nodes();
  const tst = ns.find(n => n.t === 'Testing and validation'), rel = ns.find(n => n.t === 'Release');
  await page.mouse.move(tst.x + tst.w - 4, tst.y + tst.h - 4);
  await page.mouse.down();
  await page.mouse.move(rel.x - 12, rel.y + rel.h + 30, { steps: 12 });
  await page.waitForTimeout(500);
  await page.mouse.up();
  await page.waitForTimeout(600);
  ns = await nodes(); ov = countOverlaps(ns);
  log(ov === 0, 'bubbles: nearby nodes push each other away (overlaps=' + ov + ')');
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(500);

  // collapse
  await page.click('.node:has(.txt:text-is("Release")) .fold');
  await page.waitForTimeout(400);
  ns = await nodes();
  log(!ns.some(n => n.t === 'Documentation'), 'collapsing a branch hides its children');
  await page.click('.node:has(.txt:text-is("Release")) .fold');
  await page.waitForTimeout(400);

  // search
  await page.fill('#search', 'test');
  await page.waitForTimeout(200);
  const hits = await page.$$eval('.node.hit', n => n.length);
  log(hits >= 2, 'search highlights nodes (' + hits + ')');
  await page.fill('#search', '');
  await page.waitForTimeout(200);

  // wheel zoom and pan
  const k0 = await page.evaluate(() => window.__trees.data.trees[0].view.k);
  await page.mouse.move(700, 400); await page.mouse.wheel(0, -300);
  await page.waitForTimeout(150);
  const k1 = await page.evaluate(() => window.__trees.data.trees[0].view.k);
  log(k1 > k0, 'wheel zoom (' + k0.toFixed(2) + '→' + k1.toFixed(2) + ')');
  await page.click('#fit');

  // autosave + reload
  await page.waitForTimeout(700);
  const saved = await page.evaluate(() => localStorage.getItem('trees:v1') && JSON.parse(localStorage.getItem('trees:v1')).trees[0].root.children[2].children.some(c => c.text === 'Delivery'));
  log(saved === true, 'autosave to localStorage');
  await ctx.setOffline(true);
  await page.reload();
  await page.waitForTimeout(500);
  ns = await nodes();
  log(ns.length >= 16 && ns.some(n => n.t === 'Engineering'), 'offline reload: data restored (nodes=' + ns.length + ')');

  // data saved by earlier versions (key "alberi:v1") is still loaded
  await page.evaluate(() => { localStorage.setItem('alberi:v1', localStorage.getItem('trees:v1')); localStorage.removeItem('trees:v1'); });
  await page.reload();
  await page.waitForTimeout(500);
  ns = await nodes();
  log(ns.length >= 16 && ns.some(n => n.t === 'Engineering'), 'data saved under the legacy key is migrated');

  // new tree, dark theme
  await page.click('#newTree');
  await page.waitForTimeout(300);
  await page.keyboard.type('Order process');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  const opts = await page.$$eval('#treeSel option', o => o.map(x => x.textContent));
  log(opts.length === 2 && opts.includes('Order process'), 'new tree created: ' + opts.join(' | '));
  await page.click('#theme');
  await page.selectOption('#treeSel', { index: 0 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: nodePath.join(os.tmpdir(), 'todotree-3-dark.png') });

  // Markdown import
  const impPath = nodePath.join(os.tmpdir(), 'todotree-imp.md');
  fs.writeFileSync(impPath, '- Returns handling\n  - Receive request\n  - [x] Verify\n  - Refund\n    - [ ] Approval\n');
  await page.setInputFiles('#file', impPath);
  await page.waitForTimeout(500);
  ns = await nodes();
  log(ns.length === 5 && ns.some(n => n.t === 'Approval'), 'Markdown import (nodes=' + ns.length + ')');

  // Markdown import with metadata: @due ^start !priority #tag and "> …" note
  const due1 = iso(20), start1 = iso(10), due2 = iso(27);
  fs.writeFileSync(impPath, '- Project X\n  - [ ] Write offer @' + due1 + ' ^' + start1 + ' !high #client #q4\n    > Test note\n  - [x] Call\n');
  await page.setInputFiles('#file', impPath);
  await page.waitForTimeout(500);
  const getNode = text => page.evaluate(t => {
    const A = window.__trees, tr = A.data.trees.find(x => x.id === A.data.current);
    const f = n => n.text === t ? n : n.children.map(f).find(Boolean);
    return JSON.parse(JSON.stringify(f(tr.root) || null));
  }, text);
  let nd = await getNode('Write offer');
  log(nd && nd.due === due1 && nd.start === start1 && nd.prio === 3 && nd.tags && nd.tags.join() === 'client,q4' && nd.note === 'Test note',
    'Markdown import with dates, priority, tags and note');

  // node card (double click)
  const box = async text => (await nodes()).find(n => n.t === text);
  let b = await box('Write offer');
  await page.mouse.dblclick(b.x + b.w * 0.62, b.y + b.h * 0.3);
  await page.waitForTimeout(300);
  log(await page.isVisible('#card') && await page.evaluate(() => document.activeElement.id) === 'c-title', 'double click opens the card with the title focused');
  await page.click('#c-prio button[data-p="2"]');
  await page.fill('#c-due', due2);
  await page.click('#c-add');
  await page.keyboard.type('Material quote'); await page.keyboard.press('Enter');
  await page.keyboard.type('Legal review'); await page.keyboard.press('Enter');
  await page.locator('.irow input[type=checkbox]').first().check();
  await page.click('#c-tagin'); await page.keyboard.type('urgent, Client'); await page.keyboard.press('Enter');
  await page.fill('#c-note', 'Line one\nLine two');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  nd = await getNode('Write offer');
  log(!(await page.isVisible('#card')), 'Esc closes the card');
  log(nd.prio === 2 && nd.due === due2 && nd.items.length === 2 && nd.items[0].d === true && nd.items[1].d === false,
    'card: priority, due date and checklist saved in the model');
  log(nd.tags.join() === 'client,q4,urgent', 'card: tags without duplicates (' + nd.tags.join() + ')');
  log(nd.note === 'Line one\nLine two', 'card: multi-line note');
  const chips = await page.evaluate(() => [...document.querySelectorAll('.node')].find(n => n.querySelector('.txt').textContent === 'Write offer').querySelector('.meta').innerText);
  log(/1\/2/.test(chips) && /#urgent/.test(chips), 'badges on the node: checklist 1/2 and tags (' + chips.replace(/\n/g, ' ') + ')');
  await page.keyboard.press('Control+z'); await page.waitForTimeout(400);
  nd = await getNode('Write offer');
  log(nd.prio === 3 && !nd.items && nd.due === due1, 'undo reverts the whole card in a single step');
  await page.keyboard.press('Control+y'); await page.waitForTimeout(400);
  nd = await getNode('Write offer');
  log(nd.items && nd.items.length === 2 && nd.prio === 2, 'redo restores the card');

  // repeat: marking as done moves the due date forward
  b = await box('Write offer');
  await page.mouse.dblclick(b.x + b.w * 0.62, b.y + b.h * 0.3);
  await page.waitForTimeout(250);
  await page.selectOption('#c-rep', 'w');
  await page.keyboard.press('Escape'); await page.waitForTimeout(250);
  const k2 = await page.evaluate(() => { const A = window.__trees; return A.data.trees.find(x => x.id === A.data.current).view.k; });
  b = await box('Write offer');
  await page.mouse.click(b.x + 24 * k2, b.y + 21 * k2);
  await page.waitForTimeout(400);
  nd = await getNode('Write offer');
  log(nd.done === false && nd.due === addDaysISO(due2, 7) && nd.items.every(i => !i.d), 'weekly repeat: due date advanced (' + nd.due + ') and checklist reset');

  // search by tag and persistence
  await page.fill('#search', 'urgent'); await page.waitForTimeout(300);
  log(await page.$$eval('.node.hit', e => e.length) === 1, 'search finds nodes by tag');
  await page.fill('#search', ''); await page.waitForTimeout(200);
  await page.waitForTimeout(500);
  await page.reload(); await page.waitForTimeout(500);
  nd = await getNode('Write offer');
  log(nd && nd.items && nd.items.length === 2 && nd.rep === 'w' && nd.tags.includes('urgent'), 'card: data still present after reload');

  // exported Markdown contains the new fields
  const md = await page.evaluate(() => { const A = window.__trees; return A.toMd ? A.toMd(A.data.trees.find(x => x.id === A.data.current).root) : null; });
  if (md) log(md.includes('@' + addDaysISO(due2, 7)) && /#urgent/.test(md) && /> Line one/.test(md), 'Markdown export includes dates, tags and note');

  log(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.join(' ; ') : ''));
  await browser.close();
  if (failed) { console.log(failed + ' checks failed'); process.exit(1); }
})().catch(e => { console.error('TEST ERROR', e); process.exit(1); });
