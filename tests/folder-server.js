// Folder backup through the local server (the path used by browsers without folder access, such as Firefox).
// The real tools/serve.js runs on a spare port and the page runs with showDirectoryPicker removed.
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs'), os = require('os'), nodePath = require('path');
const root = nodePath.resolve(__dirname, '..');
const cfgFile = nodePath.join(root, '.backup-dir.json');
const hadCfg = fs.existsSync(cfgFile), oldCfg = hadCfg ? fs.readFileSync(cfgFile) : null;
const PORT = 5199, URL_ = 'http://localhost:' + PORT + '/';
const dir = fs.mkdtempSync(nodePath.join(os.tmpdir(), 'tdt-backup-')) + nodePath.sep + 'nested';   // does not exist yet

let failed = 0;
const log = (ok, msg) => { if (!ok) failed++; console.log((ok ? 'PASS ' : 'FAIL ') + msg); };
const wait = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  if (hadCfg) fs.unlinkSync(cfgFile);
  const srv = spawn(process.execPath, [nodePath.join(root, 'tools', 'serve.js')], { env: { ...process.env, PORT: String(PORT), BACKUP_DIR: '' }, stdio: 'ignore' });
  let browser;
  try {
    for (let i = 0; i < 50; i++) { try { if ((await fetch(URL_)).ok) break; } catch (e) { await wait(100); } }
    browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { channel: 'chrome' });
    const page = await (await browser.newContext({ viewport: { width: 1400, height: 800 } })).newPage();
    const errors = [];
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()); });
    await page.addInitScript(() => { window.__FOLDER_DELAY_MS = 150; delete window.showDirectoryPicker; });
    await page.goto(URL_);
    await page.waitForFunction(() => document.querySelector('#folder'));

    await page.click('#folder');
    await page.waitForFunction(() => !document.querySelector('#f-pathrow').hidden);
    log(true, 'served by npm start: the dialog asks for a folder path');
    await page.fill('#f-path', 'relative/path'); await page.click('#f-choose');
    await page.waitForFunction(() => /full path/.test(document.querySelector('#f-status').textContent));
    log(true, 'a relative path is refused with a readable message');

    await page.fill('#f-path', dir); await page.click('#f-choose');
    await page.waitForFunction(() => /ok/.test(document.querySelector('#folder').className));
    let names = fs.existsSync(dir) ? fs.readdirSync(dir) : [];
    log(names.includes('todotree-backup.json') && names.some(n => /^todotree-\d{4}-\d{2}-\d{2}\.json$/.test(n)), 'the server created the folder and wrote the latest and the dated file');
    log(JSON.parse(fs.readFileSync(nodePath.join(dir, 'todotree-backup.json'), 'utf8')).app === 'trees', 'the file contains the trees');
    await page.click('#f-close');

    const node = await page.evaluate(() => { const r = document.querySelector('.node').getBoundingClientRect(); return { x: r.x + r.width * 0.62, y: r.y + r.height * 0.4 }; });
    await page.mouse.click(node.x, node.y); await page.keyboard.press('Tab');
    await page.keyboard.type('Saved through the server'); await page.keyboard.press('Enter');
    for (let i = 0; i < 40 && !fs.readFileSync(nodePath.join(dir, 'todotree-backup.json'), 'utf8').includes('Saved through the server'); i++) await wait(100);
    log(fs.readFileSync(nodePath.join(dir, 'todotree-backup.json'), 'utf8').includes('Saved through the server'), 'automatic backup: an edit reaches the folder by itself');

    // the server only accepts requests from its own page
    const bad = await fetch(URL_ + 'backup', { method: 'POST', headers: { Origin: 'https://evil.example', 'Content-Type': 'application/json' }, body: '{}' }).catch(() => null);
    log(bad && bad.status === 403, 'a request from another site is refused');

    // after a reload the folder is remembered
    await page.reload(); await page.waitForFunction(() => document.querySelector('#folder'));
    await page.click('#folder');
    await page.waitForFunction(d => document.querySelector('#f-path').value === d, dir);
    log(true, 'after a reload the folder is remembered');

    await page.click('#f-stop');
    await page.waitForFunction(() => document.querySelector('#f-now').disabled);
    const before = fs.statSync(nodePath.join(dir, 'todotree-backup.json')).mtimeMs;
    await page.click('#f-close'); await wait(500);
    log(fs.statSync(nodePath.join(dir, 'todotree-backup.json')).mtimeMs === before, 'stop: no more writes');
    log(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.join(' ; ') : ''));
  } finally {
    if (browser) await browser.close();
    srv.kill();
    if (fs.existsSync(cfgFile)) fs.unlinkSync(cfgFile);
    if (hadCfg) fs.writeFileSync(cfgFile, oldCfg);
    fs.rmSync(nodePath.dirname(dir), { recursive: true, force: true });
  }
  if (failed) { console.log(failed + ' checks failed'); process.exit(1); }
})().catch(e => { console.error('TEST ERROR', e); process.exit(1); });
