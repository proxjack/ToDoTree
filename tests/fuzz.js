// Randomized (fuzz) test: performs random actions with the real mouse and keyboard and checks the invariants after each one.
//   FUZZ_SEEDS=1,2,3  FUZZ_STEPS=40  node tests/fuzz.js        (on failure it prints the seed and the actions to reproduce it)
const { chromium } = require('playwright');
const nodePath = require('path');
const url = require('url').pathToFileURL(nodePath.resolve(__dirname, '..', 'index.html')).href;
const SEEDS = (process.env.FUZZ_SEEDS || '1,2,3').split(',').map(Number);
const STEPS = Number(process.env.FUZZ_STEPS || 40);

const rng = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };

// Readable outlines of two states, to see what differs
const outline = json => { const o = []; (function w(n, d) { o.push('›'.repeat(d) + n.text + (n.collapsed ? ' [+]' : '') + (n.dx || n.dy ? ' (manual)' : '')); n.children.forEach(c => w(c, d + 1)); })(JSON.parse(json), 0); return o; };
const diff = (a, b) => {
  const A = outline(a), B = outline(b);
  return '\n      expected:  ' + A.join(' | ').replace(/\s+/g, ' ') + '\n      got:       ' + B.join(' | ').replace(/\s+/g, ' ');
};

// Reads the model and the DOM from the page in one go
const snapshot = page => page.evaluate(() => {
  const A = window.__trees, d = A.data, tr = d.trees.find(t => t.id === d.current) || d.trees[0];
  const ids = new Set(); let dup = 0, bad = 0, total = 0, visible = 0;
  (function w(n, hidden) {
    total++; if (!hidden) visible++;
    if (ids.has(n.id)) dup++; ids.add(n.id);
    if (typeof n.text !== 'string' || !Array.isArray(n.children)) bad++;
    if (('dx' in n && !Number.isFinite(n.dx)) || ('dy' in n && !Number.isFinite(n.dy))) bad++;
    n.children.forEach(c => w(c, hidden || n.collapsed));
  })(tr.root, false);
  const nodes = [...document.querySelectorAll('.node')].map(el => {
    const r = el.getBoundingClientRect(), m = el.style.transform.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/);
    return { id: el.dataset.id, t: el.querySelector('.txt').textContent, x: r.x, y: r.y, w: r.width, h: r.height, wy: m ? +m[2] : 0 };
  });
  return { json: JSON.stringify(tr.root), dup, bad, total, visible, nodes, k: tr.view ? tr.view.k : 1 };
});

function check(s) {
  const f = [];
  if (s.dup) f.push('duplicate ids in the model');
  if (s.bad) f.push('invalid nodes in the model');
  if (s.nodes.length !== s.visible) f.push('nodes in the DOM (' + s.nodes.length + ') ≠ visible in the model (' + s.visible + ')');
  const ns = s.nodes;
  for (let i = 0; i < ns.length; i++) for (let j = i + 1; j < ns.length; j++) {
    const a = ns[i], b = ns[j];
    if (a.x < b.x + b.w - 0.5 && b.x < a.x + a.w - 0.5 && a.y < b.y + b.h - 0.5 && b.y < a.y + a.h - 0.5) f.push('overlap: "' + a.t + '" × "' + b.t + '" ' + [a, b].map(q => '[x=' + Math.round(q.x) + ' y=' + Math.round(q.y) + ' w=' + Math.round(q.w) + ' h=' + Math.round(q.h) + ' wy=' + Math.round(q.wy) + ']').join(' '));
  }
  for (const n of ns) if (n.wy < -0.01) f.push('above the ceiling: "' + n.t + '" y=' + n.wy);
  return f;
}

async function run(seed) {
  const rand = rng(seed), pick = a => a[Math.floor(rand() * a.length)];
  const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { channel: 'chrome' });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 800 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  const errors = [], log = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto(url); await page.waitForTimeout(400);
  await page.click('#fit'); await page.waitForTimeout(200);

  const settle = ms => page.waitForTimeout(ms || 250);
  const visibleNodes = async () => (await snapshot(page)).nodes;
  const grab = n => ({ x: n.x + n.w * 0.62, y: n.y + n.h * 0.4 });      // safe point: neither the checkbox nor the fold button
  // true if the node's grab point can really be clicked (not covered by bars, not off screen)
  const reachable = n => page.evaluate(({ x, y, id }) => { const e = document.elementFromPoint(x, y), nd = e && e.closest('.node'); return !!nd && nd.dataset.id === id; }, { ...grab(n), id: n.id });
  const select = async n => {
    await page.mouse.click(1390, 790); await settle(80);      // click on empty space: hides the floating toolbar that could cover the node
    const cur = (await visibleNodes()).find(x => x.id === n.id) || n;
    if (!(await reachable(cur))) return false;
    const g = grab(cur); await page.mouse.click(g.x, g.y); await settle(120); return true;
  };

  const actions = {
    async dragFree() {
      const ns = (await visibleNodes()).filter(n => n.wy > 0 || n.t); const root = ns.find(n => n.wy === 0 && n.y < 200) || ns[0];
      const cand = ns.filter(n => n !== root); if (!cand.length) return null;
      const n = pick(cand), g = grab(n);
      if (!(await reachable(n))) return null;
      const tx = 60 + rand() * 1280, ty = 130 + rand() * 600;
      await page.mouse.move(g.x, g.y); await page.mouse.down(); await page.mouse.move(tx, ty, { steps: 8 }); await page.mouse.up();
      return 'drag "' + n.t + '" to (' + Math.round(tx) + ',' + Math.round(ty) + ')';
    },
    async dragOnto() {
      const ns = await visibleNodes(); if (ns.length < 3) return null;
      const a = pick(ns.slice(1)), b = pick(ns.filter(n => n !== a)), g = grab(a);
      if (!(await reachable(a))) return null;
      await page.mouse.move(g.x, g.y); await page.mouse.down();
      await page.mouse.move(b.x + b.w / 2, b.y + b.h / 2, { steps: 10 }); await page.mouse.up();
      return 'reattach "' + a.t + '" onto "' + b.t + '"';
    },
    async addChild() {
      const ns = await visibleNodes(), n = pick(ns); if (!(await select(n))) return null;
      await page.keyboard.press('Tab'); await settle(100); await page.keyboard.type('fz' + Math.floor(rand() * 1000)); await page.keyboard.press('Enter');
      return 'child of "' + n.t + '"';
    },
    async addSibling() {
      const ns = await visibleNodes(), n = pick(ns.slice(1)); if (!(await select(n))) return null;
      await page.keyboard.press('Enter'); await settle(100); await page.keyboard.type('fs' + Math.floor(rand() * 1000)); await page.keyboard.press('Enter');
      return 'sibling of "' + n.t + '"';
    },
    async toggleDone() { const n = pick(await visibleNodes()); if (!(await select(n))) return null; await page.keyboard.press('Space'); return 'done "' + n.t + '"'; },
    async remove() {
      const ns = await visibleNodes(); if (ns.length < 8) return null;
      const n = pick(ns.slice(1)); if (!(await select(n))) return null; await page.keyboard.press('Delete'); return 'delete "' + n.t + '"';
    },
    async card() {
      const n = pick(await visibleNodes());
      if (!(await reachable(n))) return null;
      const g = grab(n);
      await page.mouse.click(1390, 790); await settle(60);
      await page.mouse.dblclick(g.x, g.y); await settle(250);
      if (!(await page.isVisible('#card'))) return 'card not opened by double click on "' + n.t + '"';
      const did = [];
      for (let k = 1 + Math.floor(rand() * 3); k > 0; k--) {
        const op = pick(['prio', 'due', 'item', 'tag', 'note', 'rep', 'done', 'title', 'start']);
        const day = () => '2026-' + String(11 + Math.floor(rand() * 2)).padStart(2, '0') + '-' + String(1 + Math.floor(rand() * 28)).padStart(2, '0');
        if (op === 'prio') { const p = Math.floor(rand() * 4); await page.click('#c-prio button[data-p="' + p + '"]'); did.push('prio ' + p); }
        else if (op === 'due') { await page.fill('#c-due', day()); did.push('due'); }
        else if (op === 'start') { await page.fill('#c-start', day()); did.push('start'); }
        else if (op === 'item') { await page.click('#c-add'); await page.keyboard.type('item' + Math.floor(rand() * 100)); await page.keyboard.press('Enter'); did.push('item'); }
        else if (op === 'tag') { await page.click('#c-tagin'); await page.keyboard.type('tg' + Math.floor(rand() * 4)); await page.keyboard.press('Enter'); did.push('tag'); }
        else if (op === 'note') { await page.fill('#c-note', 'note ' + Math.floor(rand() * 100)); did.push('note'); }
        else if (op === 'rep' && await page.isEnabled('#c-rep')) { await page.selectOption('#c-rep', pick(['', 'd', 'w', 'm'])); did.push('repeat'); }
        else if (op === 'done') { await page.click('#c-done'); did.push('done'); }
        else if (op === 'title') { await page.fill('#c-title', 'T' + Math.floor(rand() * 1000)); did.push('title'); }
        await settle(80);
      }
      if (rand() < 0.5) await page.keyboard.press('Escape'); else await page.click('#c-ok');
      return 'card of "' + n.t + '": ' + did.join(', ');
    },
    async fold() {
      const els = await page.$$('.node:not(.root) .fold:not([hidden])'); if (!els.length) return null;
      await pick(els).evaluate(e => e.click());        // the selected node's toolbar can cover the button
      return 'collapse/expand a branch';
    },
    async reorder() { await page.click('#reorder'); return 'tidy up'; },
    async zoom() { await page.mouse.move(700, 450); await page.mouse.wheel(0, rand() < 0.5 ? -200 : 200); return 'zoom'; },
    async fit() { await page.click('#fit'); return 'fit'; },
  };
  const mutating = new Set(['dragFree', 'dragOnto', 'addChild', 'addSibling', 'toggleDone', 'remove', 'fold', 'card']);
  const names = Object.keys(actions), weights = { dragFree: 4, dragOnto: 3, addChild: 3, addSibling: 2, toggleDone: 1, remove: 1, fold: 1, card: 4, reorder: 1, zoom: 1, fit: 1 };
  const bag = names.flatMap(n => Array(weights[n]).fill(n));

  let fail = null;
  for (let i = 1; i <= STEPS && !fail; i++) {
    const before = (await snapshot(page)).json, name = pick(bag);
    let desc;
    try { desc = await actions[name](); } catch (e) { desc = name + ' (action could not be performed: ' + e.message.split('\n')[0] + ')'; }
    if (desc === null) continue;
    log.push(i + '. ' + desc);
    await settle(350);
    const s = await snapshot(page), problems = check(s);
    if (errors.length) problems.push(...errors.splice(0));
    if (!problems.length && mutating.has(name) && s.json !== before) {   // undo/redo must restore the state
      await page.keyboard.press('Control+z'); await settle(300);
      const afterUndo = (await snapshot(page)).json;
      if (afterUndo !== before) problems.push('undo does not restore the previous state' + diff(before, afterUndo) + '\n      after the action: ' + outline(s.json).join(' | '));
      await page.keyboard.press('Control+y'); await settle(300);
      if ((await snapshot(page)).json !== s.json) problems.push('redo does not restore the state');
    }
    if (problems.length) {
      fail = { step: i, problems: [...new Set(problems)] };
      if (process.env.FUZZ_SHOT) await page.screenshot({ path: process.env.FUZZ_SHOT });
    }
  }
  await browser.close();
  if (fail) {
    console.log('FAIL fuzz seed=' + seed + ' at step ' + fail.step + ':\n  - ' + fail.problems.join('\n  - ') + '\n  actions:\n    ' + log.join('\n    '));
    return false;
  }
  console.log('PASS fuzz seed=' + seed + ' (' + log.length + ' actions, invariants hold)');
  return true;
}

(async () => {
  let ok = true;
  for (const s of SEEDS) ok = (await run(s)) && ok;
  process.exit(ok ? 0 : 1);
})();
