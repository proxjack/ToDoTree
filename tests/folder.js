// Folder backup test. The File System Access API is replaced by an in-memory fake folder, so the real code of the
// app runs end to end without any dialog or disk access.
const { chromium } = require('playwright');
const fs = require('fs'), nodePath = require('path');
const indexPath = nodePath.resolve(__dirname, '..', 'index.html');

let failed = 0;
const log = (ok, msg) => { if (!ok) failed++; console.log((ok ? 'PASS ' : 'FAIL ') + msg); };

(async () => {
  const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { channel: 'chrome' });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 800 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  await page.addInitScript(() => {
    window.__FOLDER_DELAY_MS = 150;
    window.__files = {}; window.__writes = 0; window.__perm = 'granted';
    window.showDirectoryPicker = async () => ({
      name: 'MyBackups',
      queryPermission: async () => window.__perm,
      requestPermission: async () => { window.__perm = 'granted'; return 'granted'; },
      getFileHandle: async name => ({
        createWritable: async () => { let buf = ''; return { write: async t => { buf += t; }, close: async () => { window.__files[name] = buf; window.__writes++; }, abort: async () => {} }; }
      })
    });
  });
  await page.goto(require('url').pathToFileURL(indexPath).href);
  await page.waitForSelector('#folder');
  const cls = () => page.getAttribute('#folder', 'class');
  const files = () => page.evaluate(() => window.__files);

  await page.click('#folder');
  log(await page.isDisabled('#f-now') && await page.isDisabled('#f-stop'), 'before choosing a folder: nothing to save or stop');
  await page.click('#f-choose');
  await page.waitForFunction(() => Object.keys(window.__files).length >= 2);
  let f = await files();
  const names = Object.keys(f);
  log(names.includes('todotree-backup.json') && names.some(n => /^todotree-\d{4}-\d{2}-\d{2}\.json$/.test(n)), 'choosing a folder writes the latest file and a dated one');
  const j = JSON.parse(f['todotree-backup.json']);
  log(j.app === 'trees' && Array.isArray(j.trees) && j.trees.length >= 1, 'the file contains the trees');
  log(/ok/.test(await cls() || ''), 'the Folder button shows the green state');
  await page.click('#f-close');

  const w0 = await page.evaluate(() => window.__writes);
  const node = await page.evaluate(() => { const r = document.querySelector('.node').getBoundingClientRect(); return { x: r.x + r.width * 0.62, y: r.y + r.height * 0.4 }; });
  await page.mouse.click(node.x, node.y); await page.keyboard.press('Tab');
  await page.keyboard.type('Added by the test'); await page.keyboard.press('Enter');
  await page.waitForFunction(w => window.__writes > w, w0);
  f = await files();
  log(f['todotree-backup.json'].includes('Added by the test'), 'automatic backup: an edit reaches the folder by itself');

  // permission lost (as after a browser restart): auto mode does not ask, the next click does
  await page.evaluate(() => { window.__perm = 'prompt'; });
  await page.keyboard.type('Second edit'); await page.keyboard.press('Enter'); await page.keyboard.press('Escape');
  await page.waitForFunction(() => /auth/.test(document.querySelector('#folder').className));
  log(true, 'without permission the button asks to allow access again and nothing crashes');
  await page.mouse.click(700, 700);
  await page.waitForFunction(() => window.__perm === 'granted' && /ok/.test(document.querySelector('#folder').className));
  log(true, 'the next click renews the permission and the pending copy is saved');

  // stop
  await page.click('#folder'); await page.click('#f-stop'); await page.waitForFunction(() => document.querySelector('#f-now').disabled);
  const cfg = await page.evaluate(() => JSON.parse(localStorage.getItem('trees:folder')));
  log(!cfg.name && !cfg.last && await page.isDisabled('#f-now'), 'stop forgets the folder');
  const w1 = await page.evaluate(() => window.__writes);
  await page.click('#f-close');
  await page.waitForTimeout(500);
  log(await page.evaluate(() => window.__writes) === w1, 'no more writes after stopping');

  log(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.join(' ; ') : ''));
  await browser.close();
  if (failed) { console.log(failed + ' checks failed'); process.exit(1); }
})().catch(e => { console.error('TEST ERROR', e); process.exit(1); });
