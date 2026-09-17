/**
 * A frame with an information view open, written to a PNG.
 *
 * The views are judged by eye. This is the eye.
 *
 *   node tools/view-shot.mjs out.png 1       # the view id
 */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import zlib from 'node:zlib';
import * as esbuild from 'esbuild';

const OUT = process.argv[2] ?? 'view.png';
const VIEW = Number(process.argv[3] ?? 1);
const W = Number(process.env.W || 1100), H = Number(process.env.H || 620);

const bundle = (await esbuild.build({
  entryPoints: [new URL('../src/headless.ts', import.meta.url).pathname],
  bundle: true, format: 'iife', globalName: 'HEADLESS', write: false,
  target: 'es2022', loader: { '.wgsl': 'text' },
})).outputFiles[0].text;

const server = http.createServer((req, res) => {
  if (req.url.startsWith('/headless.js')) {
    res.writeHead(200, { 'content-type': 'text/javascript' }).end(bundle);
  } else {
    res.writeHead(200, { 'content-type': 'text/html' })
      .end('<!doctype html><meta charset=utf-8><body style="margin:0;background:#16202b">'
        + '<script src="/headless.js"></script>');
  }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-angle=vulkan',
         '--use-vulkan=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox',
         '--disable-gpu-sandbox'],
});
const page = await browser.newPage({ viewport: { width: W, height: H } });
page.on('pageerror', (e) => console.log('pageerror:', e.message));
await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load' });
const r = await page.evaluate(async ([w, h, v]) => {
  try { return await HEADLESS.probeViewShot(w, h, v); }
  catch (err) { return { error: String(err && err.stack ? err.stack : err) }; }
}, [W, H, VIEW]);
if (r.error) { console.log(r.error); await browser.close(); server.close(); process.exit(1); }

// The card, the rail and the bubbles are DOM; the city is a texture. Composite
// by drawing the frame into the page behind the interface and screenshotting.
await page.evaluate(([w, h, px]) => {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  c.style.cssText = 'position:fixed;inset:0;z-index:0';
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(w, h);
  img.data.set(px);
  ctx.putImageData(img, 0, 0);
  document.body.insertBefore(c, document.body.firstChild);
  const ui = document.querySelector('div');
  if (ui instanceof HTMLElement) ui.style.zIndex = '1';
}, [W, H, r.pixels]);
await page.screenshot({ path: OUT, clip: { x: 0, y: 0, width: W, height: H } });
await browser.close();
server.close();
console.log(`wrote ${OUT} — ${r.name}`);
void zlib; void fs;
