/**
 * Screenshots of the actual city, from the actual renderer.
 *
 * This used to be a copy of the frame loop kept in the page alongside the
 * shaders it wanted to photograph. That was fine while the renderer was three
 * pipelines, and became a liability the moment the draw path grew a prototype
 * table and per-bucket indirect draws: the copy could go on rendering a scene
 * the game no longer draws.
 *
 * So it builds the real Renderer instead, against an offscreen texture rather
 * than a canvas -- the software rasteriser here takes the canvas presentation
 * path down within a second of boot, which is what forced the copy in the
 * first place. What comes out is the game's own frame.
 *
 *   node tools/city-shot.mjs out.png
 *   W=1280 H=720 YAW=0.6 PITCH=0.35 DIST=520 FOCUS=0,0 node tools/city-shot.mjs out.png
 *
 * LITE=1 builds the small world, for when the rasteriser runs out of patience
 * with the full one.
 */

import { chromium } from 'playwright';
import fs from 'node:fs';
import http from 'node:http';
import zlib from 'node:zlib';
import * as esbuild from 'esbuild';

const out = process.argv[2] || 'city.png';
const W = Number(process.env.W || 1280);
const H = Number(process.env.H || 720);
const cfg = {
  width: W, height: H,
  yaw: Number(process.env.YAW ?? 0.62),
  pitch: Number(process.env.PITCH ?? 0.34),
  distance: Number(process.env.DIST ?? 620),
  focus: (process.env.FOCUS || '0,0').split(',').map(Number),
  frames: Number(process.env.FRAMES || 8),
  hour: Number(process.env.HOUR ?? 0.34),
  front: Number(process.env.FRONT ?? 0.08),
  edit: !!process.env.EDIT,
  empty: !!process.env.EMPTY,
  lite: !!process.env.LITE,
};

const bundle = (await esbuild.build({
  entryPoints: [new URL('../src/headless.ts', import.meta.url).pathname],
  bundle: true, format: 'iife', globalName: 'HEADLESS', write: false,
  target: 'es2022', loader: { '.wgsl': 'text' },
})).outputFiles[0].text;

// Served over loopback rather than set as page content: WebGPU is only exposed
// in a secure context, and about:blank is not one.
const server = http.createServer((req, res) => {
  if (req.url.startsWith('/headless.js')) {
    res.writeHead(200, { 'content-type': 'text/javascript' }).end(bundle);
  } else {
    res.writeHead(200, { 'content-type': 'text/html' })
      .end('<!doctype html><meta charset=utf-8><body><script src="/headless.js"></script>');
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
const page = await browser.newPage();
const logs = [];
page.on('console', (m) => logs.push(`${m.type()}: ${m.text()}`));
page.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));
await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load' });

let shot;
try {
  shot = await page.evaluate(async (c) => {
    const r = await HEADLESS.shoot(c);
    return { pixels: Array.from(r.pixels), stats: r.stats };
  }, cfg);
} catch (err) {
  console.error(String(err).split('\n').slice(0, 3).join('\n'));
  console.error(logs.slice(-25).join('\n'));
  await browser.close();
  server.close();
  process.exit(1);
}

// A minimal PNG writer. Bringing in an image library to save one RGBA buffer
// would be a dependency for four lines of zlib.
function png(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;                       // filter: none
    Buffer.from(rgba).copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const chunk = (type, body) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(body.length);
    const head = Buffer.concat([Buffer.from(type, 'ascii'), body]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(head) >>> 0);
    return Buffer.concat([len, head, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6;                             // 8-bit RGBA
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ]);
}
const CRC = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = -1;
  for (const b of buf) c = CRC[(c ^ b) & 255] ^ (c >>> 8);
  return c ^ -1;
}

fs.writeFileSync(out, png(W, H, Uint8Array.from(shot.pixels)));
console.log(Object.entries(shot.stats).map(([k, v]) => `${k} ${v}`).join('   '));
console.log(`wrote ${out} (${W}x${H})`);
const errors = logs.filter((l) => /error|pageerror/i.test(l));
if (errors.length) console.error('\n' + errors.slice(0, 15).join('\n'));

await browser.close();
server.close();
