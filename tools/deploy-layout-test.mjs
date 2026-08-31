/**
 * Deployment layout test.
 *
 * GitHub Pages can serve this project from either the repository root or the
 * /docs folder, decided by a dropdown in the repo settings. Both must work,
 * because getting it wrong shows a page that looks like it is loading forever.
 *
 * Serves each layout from a static server that mimics Pages -- including
 * serving .ts as video/mp2t, which is what breaks the root layout -- and
 * asserts the bundle actually executed in both.
 *
 *   node tools/deploy-layout-test.mjs
 */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const MIME = { '.html':'text/html', '.js':'text/javascript', '.map':'application/json', '.ts':'video/mp2t', '.json':'application/json' };

function serve(rootDir, port) {
  const s = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p.startsWith('/Subnautica-2')) p = p.slice('/Subnautica-2'.length);
    if (p === '' || p === '/') p = '/index.html';
    if (p.endsWith('/')) p += 'index.html';
    const f = path.join(rootDir, p);
    if (!f.startsWith(rootDir) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
      res.writeHead(404); return res.end('not found');
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
];

let bad = 0;
for (const c of cases) {
  const s = await serve(c.dir, c.port);
  const page = await browser.newPage();
  await page.goto(`http://localhost:${c.port}/Subnautica-2/`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(6000);
  const r = await page.evaluate(() => ({
    booted: !!window.__citysimBooted,
    url: location.pathname,
    status: document.getElementById('boot-status')?.textContent?.trim().slice(0, 90),
    heading: document.querySelector('#boot h1')?.textContent?.trim().slice(0, 60),
  }));
  const ok = r.booted;
  if (!ok) bad++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${c.name}`);
  console.log(`      bundle ran: ${r.booted}   landed on: ${r.url}`);
  console.log(`      screen: ${r.heading ?? ''} ${r.status ?? ''}`);
  await page.close();
  s.close();
}

await browser.close();
console.log(bad ? `\nFAIL  ${bad} layout(s) did not boot` : '\nPASS  both deployment layouts boot');
process.exitCode = bad ? 1 : 0;
