/**
 * What a frame costs, at the distances the game is actually played from.
 *
 * The software rasteriser here makes wall-clock timings meaningless -- a frame
 * takes half a second whatever it contains -- so this reports the two numbers
 * that are real and that the timings would follow from: how many triangles are
 * submitted, and how many draws they arrive in. Those are what the level-of-
 * detail thresholds are tuned against, and they are the same on any GPU.
 *
 *   node tools/city-bench.mjs
 *   LITE=1 node tools/city-bench.mjs
 */

import { chromium } from 'playwright';
import http from 'node:http';
import * as esbuild from 'esbuild';

const W = Number(process.env.W || 1280);
const H = Number(process.env.H || 720);

/** The camera route: street level, the working zoom, and the overview. */
const STOPS = [
  { name: 'street', distance: 60, pitch: 0.22 },
  { name: 'block', distance: 160, pitch: 0.30 },
  { name: 'district', distance: 420, pitch: 0.42 },
  { name: 'city', distance: 900, pitch: 0.55 },
  { name: 'region', distance: 1800, pitch: 0.70 },
];

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
      .end('<!doctype html><meta charset=utf-8><body><script src="/headless.js"></script>');
  }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-angle=vulkan',
         '--use-vulkan=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox',
         '--disable-gpu-sandbox'],
});
const page = await browser.newPage();
const logs = [];
page.on('console', (m) => logs.push(m.text()));
page.on('pageerror', (e) => logs.push('pageerror: ' + e.message));
await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: 'load' });

const rows = await page.evaluate(async (cfg) => {
  const out = [];
  for (const stop of cfg.stops) {
    const shot = await HEADLESS.shoot({
      width: cfg.width, height: cfg.height, yaw: 0.62, focus: [0, 0],
      frames: 5, lite: cfg.lite, hour: 0.36,
      distance: stop.distance, pitch: stop.pitch,
    });
    out.push({ name: stop.name, distance: stop.distance, stats: shot.stats });
  }
  return out;
}, { stops: STOPS, width: W, height: H, lite: !!process.env.LITE });

const pad = (s, n) => String(s).padStart(n);
console.log(`citysim frame cost — ${W}x${H}${process.env.LITE ? ' (lite world)' : ''}`);
console.log('');
console.log('stop        dist   drawn/total      lod 0·1·2        tris   draws');
for (const r of rows) {
  const s = r.stats;
  console.log(
    r.name.padEnd(10)
    + pad(r.distance + 'm', 6)
    + pad(s.buildings ?? '?', 14)
    + pad(s.lod ?? '?', 15)
    + pad(s.tris ?? '?', 12)
    + pad(s.draws ?? '?', 8),
  );
}
const errors = logs.filter((l) => /error/i.test(l));
if (errors.length) console.error('\n' + errors.slice(0, 8).join('\n'));

await browser.close();
server.close();
