// Smoothness benchmark (not part of `npm test`): drags a node across big trees with a throttled CPU and reports frame times.
//   node tests/bench.js            BENCH_SIZES=300,600  BENCH_THROTTLE=6
const { chromium } = require('playwright');
const nodePath = require('path');
const url = require('url').pathToFileURL(nodePath.resolve(__dirname, '..', 'index.html')).href;
const SIZES = (process.env.BENCH_SIZES || '100,300,600').split(',').map(Number);
const THROTTLE = Number(process.env.BENCH_THROTTLE || 6);

(async () => {
  const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { channel: 'chrome' });
  for (const N of SIZES) {
    const page = await browser.newPage({ viewport: { width: 1400, height: 800 } });
    await page.goto(url); await page.waitForTimeout(400);
    // build a tree with N nodes (5 children per node, breadth first)
    await page.evaluate(N => {
      const A = window.__trees, t = A.data.trees[0];
      let c = 0; const mk = () => ({ id: 'b' + (c++) + Math.random().toString(36).slice(2, 6), text: 'Node ' + c, done: false, collapsed: false, children: [] });
      const root = mk(); root.text = 'Root';
      const q = [root]; while (c < N) { const n = q.shift(); for (let i = 0; i < 5 && c < N; i++) { const ch = mk(); n.children.push(ch); q.push(ch); } }
      t.root = root; A.render({ instant: true });
      window.__frames = []; let last = performance.now();
      const f = () => { const n = performance.now(); window.__frames.push(n - last); last = n; requestAnimationFrame(f); }; requestAnimationFrame(f);
    }, N);
    await page.click('#fit'); await page.waitForTimeout(500);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });
    const pos = await page.evaluate(() => { const a = [...document.querySelectorAll('.node')].find(n => n.querySelector('.txt').textContent === 'Node 3'); const r = a.getBoundingClientRect(); return { x: r.x + r.width / 2 + 4, y: r.y + r.height / 2 }; });
    // 1) drag
    await page.evaluate(() => { window.__frames.length = 0; });
    await page.mouse.move(pos.x, pos.y); await page.mouse.down();
    for (let i = 0; i < 60; i++) { await page.mouse.move(pos.x + i * 8, pos.y + 60 + Math.sin(i / 6) * 50); await page.waitForTimeout(8); }
    const drag = await page.evaluate(() => window.__frames.slice());
    await page.mouse.up(); await page.waitForTimeout(400);
    // 2) wheel zoom
    await page.evaluate(() => { window.__frames.length = 0; });
    for (let i = 0; i < 30; i++) { await page.mouse.move(700, 400); await page.mouse.wheel(0, i % 2 ? 120 : -120); await page.waitForTimeout(8); }
    await page.waitForTimeout(300);
    const zoom = await page.evaluate(() => window.__frames.slice());
    // 3) pan
    await page.evaluate(() => { window.__frames.length = 0; });
    await page.mouse.move(40, 700); await page.mouse.down();
    for (let i = 0; i < 60; i++) { await page.mouse.move(40 + i * 10, 700 - i * 3); await page.waitForTimeout(8); }
    await page.mouse.up();
    const pan = await page.evaluate(() => window.__frames.slice());
    const stat = fr => { fr = fr.slice(2).sort((a, b) => a - b); return 'median ' + fr[fr.length >> 1].toFixed(1) + ' p95 ' + fr[Math.floor(fr.length * 0.95)].toFixed(1) + ' max ' + fr[fr.length - 1].toFixed(1) + ' ms'; };
    console.log(String(N).padStart(4) + ' nodes, CPU x' + THROTTLE + ' | drag: ' + stat(drag) + ' | zoom: ' + stat(zoom) + ' | pan: ' + stat(pan));
    await page.close();
  }
  await browser.close();
})();
