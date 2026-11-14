// Google Drive backup test. Google sign-in and the Drive API are replaced by in-memory fakes (Playwright routes),
// so the real code of the app runs end to end without any credentials or network access.
const { chromium } = require('playwright');
const fs = require('fs'), nodePath = require('path');
const indexPath = nodePath.resolve(__dirname, '..', 'index.html');
const html = fs.readFileSync(indexPath, 'utf8');
const ORIGIN = 'https://todotree.test';          // a made-up https origin: Google sign-in needs http(s), not file://
const CLIENT_ID = '1234567890-abcdef.apps.googleusercontent.com';

let failed = 0;
const log = (ok, msg) => { if (!ok) failed++; console.log((ok ? 'PASS ' : 'FAIL ') + msg); };

// ---- a tiny in-memory Google Drive -------------------------------------------------------------------------
function fakeDrive() {
  const st = { files: [], n: 1, token: 'fake-token', reject401: 0, offline: false, creates: 0, updates: 0, downloads: 0, lists: 0 };
  const cors = { 'access-control-allow-origin': ORIGIN, 'access-control-allow-headers': 'authorization,content-type', 'access-control-allow-methods': 'GET,POST,PATCH,OPTIONS' };
  const json = (route, o, status = 200) => route.fulfill({ status, headers: cors, contentType: 'application/json', body: JSON.stringify(o) });
  st.handler = async route => {
    const req = route.request(), url = new URL(req.url()), p = url.pathname, m = req.method();
    if (m === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    if (st.offline) return route.abort('failed');
    if (st.reject401 > 0) { st.reject401--; return json(route, { error: 'unauthenticated' }, 401); }
    if (req.headers()['authorization'] !== 'Bearer ' + st.token) return json(route, { error: 'unauthenticated' }, 401);
    if (m === 'GET' && p === '/drive/v3/files') {                                   // search
      st.lists++;
      const q = url.searchParams.get('q') || '', name = (q.match(/name='([^']+)'/) || [])[1];
      const folder = q.includes('mimeType='), parent = (q.match(/'([^']+)' in parents/) || [])[1];
      const found = st.files.filter(f => !f.trashed && f.name === name && (folder ? f.folder : !f.folder && (!parent || f.parent === parent)));
      return json(route, { files: found.slice(0, 1).map(f => ({ id: f.id, name: f.name })) });
    }
    if (m === 'POST' && p === '/drive/v3/files') {                                  // create the folder
      const b = JSON.parse(req.postData()), f = { id: 'f' + st.n++, name: b.name, folder: /folder/.test(b.mimeType), parent: null, trashed: false, content: '' };
      st.files.push(f); return json(route, { id: f.id });
    }
    if (m === 'POST' && p === '/upload/drive/v3/files') {                           // multipart create
      const b = req.headers()['content-type'].match(/boundary=(.+)$/)[1];
      const parts = req.postData().split('--' + b).map(s => s.trim()).filter(s => s && s !== '--');
      const body = s => s.slice(s.indexOf('\r\n\r\n') + 4);
      const meta = JSON.parse(body(parts[0])), f = { id: 'f' + st.n++, name: meta.name, folder: false, parent: meta.parents[0], trashed: false, content: body(parts[1]) };
      st.files.push(f); st.creates++; return json(route, { id: f.id });
    }
    let mm = p.match(/^\/upload\/drive\/v3\/files\/([^/]+)$/);
    if (m === 'PATCH' && mm) {                                                      // update content in place
      const f = st.files.find(x => x.id === mm[1]); if (!f) return json(route, { error: 'notFound' }, 404);
      f.content = req.postData(); st.updates++; return json(route, { id: f.id, trashed: f.trashed });
    }
    mm = p.match(/^\/drive\/v3\/files\/([^/]+)$/);
    if (m === 'GET' && mm && url.searchParams.get('alt') === 'media') {              // download
      const f = st.files.find(x => x.id === mm[1]); if (!f) return json(route, { error: 'notFound' }, 404);
      st.downloads++; return route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: f.content });
    }
    return json(route, { error: 'unsupported ' + m + ' ' + p }, 400);
  };
  return st;
}

const GIS_STUB = `
window.google = { accounts: { oauth2: {
  initTokenClient(cfg) {
    window.__gisInit = (window.__gisInit || 0) + 1;
    return { requestAccessToken(o) {
      window.__gisReq = (window.__gisReq || 0) + 1; window.__gisPrompt = o && o.prompt;
      setTimeout(() => {
        if (window.__gisFail) return cfg.error_callback({ type: 'popup_failed_to_open' });
        cfg.callback({ access_token: window.__gisToken || 'fake-token', expires_in: window.__gisExpires || 3600 });
      }, 5);
    } };
  },
  revoke(t, cb) { window.__revoked = t; if (cb) cb({}); }
} } };`;

(async () => {
  const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { channel: 'chrome' });
  const errors = [];

  // ---------- 1) from a file:// page the dialog explains why sign-in is unavailable ----------
  {
    const page = await browser.newPage({ viewport: { width: 1400, height: 800 } });
    page.on('pageerror', e => errors.push('pageerror(file): ' + e.message));
    await page.goto(require('url').pathToFileURL(indexPath).href); await page.waitForTimeout(300);
    await page.click('#drive');
    const info = await page.textContent('#d-info');
    log(await page.isVisible('#drv') && /file:\/\//.test(info) && await page.isDisabled('#d-connect'), 'file:// page: the dialog explains the limitation and Connect is disabled');
    await page.keyboard.press('Escape');
    log(!(await page.isVisible('#drv')), 'Esc closes the Drive dialog');
    await page.close();
  }

  // ---------- 2) https page with fake Google ----------
  const fd = fakeDrive();
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 800 } });
  await ctx.addInitScript(() => { window.__DRIVE_DELAY_MS = 400; });
  await ctx.route(ORIGIN + '/', r => r.fulfill({ contentType: 'text/html', body: html }));
  await ctx.route('https://accounts.google.com/gsi/client', r => r.fulfill({ contentType: 'application/javascript', body: GIS_STUB }));
  await ctx.route('https://www.googleapis.com/**', fd.handler);
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()); });
  page.on('dialog', d => d.accept());
  await page.goto(ORIGIN + '/'); await page.waitForTimeout(400);

  const status = () => page.textContent('#d-status');
  const btnClass = () => page.getAttribute('#drive', 'class');
  const backupFile = () => fd.files.find(f => f.name === 'todotree-backup.json');
  const backupJson = () => { const f = backupFile(); return f ? JSON.parse(f.content) : null; };
  const waitStatus = (re, t = 4000) => page.waitForFunction(r => new RegExp(r).test(document.querySelector('#d-status').textContent), re.source, { timeout: t });

  await page.click('#drive');
  log(!(await page.isDisabled('#d-connect')), 'https page: Connect is available');
  await page.fill('#d-cid', 'not-a-client-id'); await page.click('#d-connect');
  log(/valid OAuth client ID/.test(await status()), 'an invalid client ID is rejected');

  await page.fill('#d-cid', CLIENT_ID); await page.click('#d-connect');
  await waitStatus(/Backed up/);
  const folder = fd.files.find(f => f.folder && f.name === 'ToDoTree'), file = backupFile();
  log(!!folder && !!file && file.parent === folder.id, 'connect: folder "ToDoTree" and file "todotree-backup.json" created on Drive');
  log(await page.evaluate(() => window.__gisPrompt) === 'consent', 'the first sign-in asks for consent');
  let bj = backupJson();
  log(bj && bj.app === 'trees' && bj.trees[0].root.text === 'Process: product development' && bj.trees[0].view === undefined, 'the backup contains the trees (without the view)');
  log((await btnClass()).includes('ok'), 'the Drive button shows the green "backed up" state');

  // ---------- 3) automatic backups ----------
  await page.check('#d-auto');
  await page.click('#d-close');
  const n0 = fd.updates, files0 = fd.files.length;
  const node = await page.evaluate(() => { const el = [...document.querySelectorAll('.node')].find(n => n.querySelector('.txt').textContent === 'Documentation'); const r = el.getBoundingClientRect(); return { x: r.x + r.width * 0.62, y: r.y + r.height * 0.4 }; });
  await page.mouse.click(node.x, node.y); await page.keyboard.press('Tab');
  await page.keyboard.type('Auto saved node'); await page.keyboard.press('Enter');
  await page.waitForTimeout(1800);
  bj = backupJson();
  log(fd.updates > n0 && JSON.stringify(bj).includes('Auto saved node'), 'automatic backup: a change reaches Drive by itself');
  log(fd.files.length === files0 && fd.creates === 1, 'the same file is updated in place (no duplicates)');

  const n1 = fd.updates;
  await page.mouse.move(700, 450); await page.mouse.wheel(0, -200);
  await page.waitForTimeout(1500);
  log(fd.updates === n1, 'zooming/panning does not trigger a backup');

  // rapid edits are merged into one upload
  const n2 = fd.updates;
  for (const w of ['one', 'two', 'three']) { await page.keyboard.press('Enter'); await page.keyboard.type('Burst ' + w); await page.keyboard.press('Enter'); await page.waitForTimeout(80); }
  await page.waitForTimeout(1800);
  log(fd.updates - n2 <= 2 && JSON.stringify(backupJson()).includes('Burst three'), 'rapid edits are grouped (' + (fd.updates - n2) + ' upload(s) for 3 edits)');

  // ---------- 4) expired sign-in: automatic backup waits, the next click renews it ----------
  fd.reject401 = 1;                                                   // Drive rejects the token once
  await page.keyboard.press('Enter'); await page.keyboard.type('After expiry'); await page.keyboard.press('Enter');
  await page.waitForTimeout(1500);
  log((await btnClass()).includes('auth') && !JSON.stringify(backupJson()).includes('After expiry'), 'rejected token: the button asks to sign in again and nothing is lost');
  const req0 = await page.evaluate(() => window.__gisReq);
  await page.mouse.click(1300, 700);                                  // any click is a user gesture
  await page.waitForTimeout(1500);
  log(await page.evaluate(() => window.__gisReq) > req0 && JSON.stringify(backupJson()).includes('After expiry') && (await btnClass()).includes('ok'),
    'the next click renews the sign-in and the pending backup is uploaded');

  // blocked sign-in window -> clear message
  await page.evaluate(() => { window.__gisFail = true; });
  fd.reject401 = 1;                                                   // the token is rejected again...
  await page.keyboard.press('Enter'); await page.keyboard.type('Blocked popup'); await page.keyboard.press('Enter');
  await page.waitForTimeout(1500);
  await page.click('#drive'); await page.click('#d-now');             // ...and the browser blocks the sign-in window
  await waitStatus(/blocked the Google sign-in window/);
  const blockedMsg = await status();
  log(/blocked the Google sign-in window/.test(blockedMsg), 'a blocked sign-in window produces a readable message (' + blockedMsg + ')');
  await page.evaluate(() => { window.__gisFail = false; });
  await page.keyboard.press('Escape');

  // ---------- 5) restore ----------
  await page.click('#drive'); await page.click('#d-now'); await waitStatus(/Backed up/);
  const savedRoot = JSON.stringify(backupJson().trees[0].root);
  await page.click('#d-close');
  // damage the local copy: delete the first leaf of the first branch
  const before = await page.evaluate(() => { const A = window.__trees; const r = A.data.trees[0].root; r.children[0].children.shift(); A.render(); return JSON.stringify(r); });
  await page.click('#drive'); await page.click('#d-restore');
  await page.waitForFunction(() => !document.querySelector('#drv') || document.querySelector('#drv').hidden, null, { timeout: 4000 });
  const restored = await page.evaluate(() => JSON.stringify(window.__trees.data.trees[0].root));
  log(restored === savedRoot && restored !== before, 'restore replaces the local trees with the Drive backup');
  await page.keyboard.press('Control+z'); await page.waitForTimeout(400);
  log(await page.evaluate(() => JSON.stringify(window.__trees.data.trees[0].root)) === before, 'undo brings back the data that was replaced by the restore');

  // ---------- 6) offline ----------
  fd.offline = true;
  await page.click('#drive'); await page.click('#d-now');
  await waitStatus(/no connection/);
  log((await btnClass()).includes('err'), 'no connection: error state shown, nothing crashes');
  fd.offline = false;

  // ---------- 7) a file deleted on Drive is recreated ----------
  fd.files.length = 0; fd.n = 100;
  await page.click('#d-now'); await waitStatus(/Backed up/);
  log(!!fd.files.find(f => f.name === 'todotree-backup.json') && fd.files.filter(f => f.folder).length === 1, 'folder and file deleted on Drive are recreated');
  await page.click('#d-close');

  // ---------- 7b) several trees are backed up and restored together ----------
  await page.click('#newTree'); await page.waitForTimeout(300);
  await page.keyboard.type('Second tree'); await page.keyboard.press('Enter'); await page.waitForTimeout(500);
  await page.click('#drive'); await page.click('#d-now'); await waitStatus(/Backed up/);
  bj = backupJson();
  log(bj.trees.length === 2 && bj.trees.some(t => t.root.text === 'Second tree'), 'the backup contains every tree on the page');
  await page.click('#d-close');
  await page.evaluate(() => { const A = window.__trees; A.data.trees.pop(); A.data.current = A.data.trees[0].id; A.render(); });   // lose the second tree locally
  await page.click('#drive'); await page.click('#d-restore');
  await page.waitForFunction(() => document.querySelector('#drv').hidden, null, { timeout: 4000 });
  await page.waitForTimeout(500);
  const shownTexts = await page.$$eval('.node', ns => ns.map(n => n.querySelector('.txt').textContent));
  log(await page.evaluate(() => window.__trees.data.trees.length) === 2 && shownTexts.includes('Second tree') && shownTexts.includes('Process: product development'),
    'restore brings back every tree and shows them side by side');

  // ---------- 8) persistence and disconnect ----------
  await page.waitForTimeout(500);
  await page.reload(); await page.waitForTimeout(500);
  log(/ok|auth/.test(await btnClass() || ''), 'after a reload the connection settings are remembered');
  await page.click('#drive');
  log(await page.inputValue('#d-cid') === CLIENT_ID && await page.isChecked('#d-auto'), 'client ID and "automatic" setting are restored');
  await page.click('#d-disconnect');
  const cfg = await page.evaluate(() => JSON.parse(localStorage.getItem('trees:drive')));
  log(!cfg.connected && !cfg.auto && !cfg.fileId && cfg.clientId === CLIENT_ID, 'disconnect clears the connection but keeps the client ID');
  log(!(await btnClass() || '').match(/ok|auth|err/) && await page.isDisabled('#d-now'), 'disconnected: no backup actions available');

  log(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.join(' ; ') : ''));
  await browser.close();
  if (failed) { console.log(failed + ' checks failed'); process.exit(1); }
})().catch(e => { console.error('TEST ERROR', e); process.exit(1); });
