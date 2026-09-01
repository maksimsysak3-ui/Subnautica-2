/**
 * Deployment layout test.
 *
 * GitHub Pages can serve this project from either the repository root or the
 * /docs folder, decided by a dropdown in the repo settings. Both must work,
 * because getting it wrong shows a page that looks like it is loading forever.
 *
 * Serves each layout from a static server that mimics Pages -- including
 * serving .ts as video/mp2t, which is what breaks the root layout -- and
 * asserts the bundle actually executed in each.
 *
 * The third case is the cache one: Pages serves HTML with a ten-minute
 * max-age, so a visitor can hold a copy from before the last deploy. It serves
 * an index.html carrying an old build id and requires the page to notice and
 * replace itself.
 *
 *   node tools/deploy-layout-test.mjs
 */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const MIME = { '.html':'text/html', '.js':'text/javascript', '.map':'application/json', '.ts':'video/mp2t', '.json':'application/json' };

function serve(rootDir, port, staleHtml = false) {
  const s = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p.startsWith('/Subnautica-2')) p = p.slice('/Subnautica-2'.length);
    if (p === '' || p === '/') p = '/index.html';
    if (p.endsWith('/')) p += 'index.html';
    const f = path.join(rootDir, p);
    if (!f.startsWith(rootDir) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
      res.writeHead(404); return res.end('not found');
    }
    // Simulates a browser holding a cached copy of index.html from before the
    // current deploy: the HTML carries an old build id, version.json carries
    // the new one.
    if (staleHtml && f.endsWith('index.html')) {
      const html = fs.readFileSync(f, 'utf8').replace(/__BUILD__ = '[^']*'/, "__BUILD__ = 'stale000'");
      res.writeHead(200, { 'Content-Type': 'text/html' });
      return res.end(html);
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  });
  return new Promise(r => s.listen(port, () => r(s)));
}

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--enable-unsafe-webgpu','--enable-features=Vulkan','--use-angle=vulkan','--use-vulkan=swiftshader','--enable-unsafe-swiftshader','--no-sandbox','--disable-gpu-sandbox'],
});

const REPO = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const cases = [
  { name: 'Pages folder = / (repo root)', dir: REPO, port: 4201 },
  { name: 'Pages folder = /docs', dir: REPO + '/docs', port: 4202 },
  { name: 'stale cached index.html replaces itself', dir: REPO + '/docs', port: 4203, stale: true, expectQuery: true },
];

let bad = 0;

/**
 * Waits for the bundle to signal that it ran, polling rather than sleeping a
 * fixed time. The page may navigate underneath us (the stale-cache case
 * reloads itself), and under a software rasteriser it can lose the GPU device
 * shortly after boot -- neither of which says anything about the deployment
 * layout this test is checking, so both are tolerated as long as boot happened.
 */
async function waitForBoot(page, done, timeoutMs = 20000) {
  const started = Date.now();
  let last = null;
  while (Date.now() - started < timeoutMs) {
    try {
      const r = await page.evaluate(() => ({
        booted: !!window.__citysimBooted,
        url: location.pathname + location.search,
        status: document.getElementById('boot-status')?.textContent?.trim().slice(0, 90),
        heading: document.querySelector('#boot h1')?.textContent?.trim().slice(0, 60),
      }));
      last = r;
      if (r.booted && done(r)) return r;
    } catch {
      // Navigating, or the page is gone. Try again.
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  return last;
}

for (const c of cases) {
  const s = await serve(c.dir, c.port, c.stale === true);
  const page = await browser.newPage();
  // ?lite keeps the world small enough for a software rasteriser; this test is
  // about deployment layout, not about how much geometry the runner can hold.
  await page.goto(`http://localhost:${c.port}/Subnautica-2/?lite`, { waitUntil: 'domcontentloaded' });

  // The stale case boots twice: once on the cached copy, then again on the
  // replacement. Waiting only for "booted" would catch the first and miss the
  // point of the test.
  const done = c.expectQuery ? (r) => /[?&]b=/.test(r.url ?? '') : () => true;
  const r = (await waitForBoot(page, done)) ?? {};
  const ok = !!r.booted && done(r);
  if (!ok) bad++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${c.name}`);
  console.log(`      bundle ran: ${!!r.booted}   landed on: ${r.url ?? '(unknown)'}`);
  if (!ok) console.log(`      screen: ${r.heading ?? ''} ${r.status ?? ''}`);
  await page.close().catch(() => {});
  s.close();
}

await browser.close();
console.log(bad ? `\nFAIL  ${bad} case(s) did not boot` : '\nPASS  every deployment case boots');
process.exitCode = bad ? 1 : 0;
