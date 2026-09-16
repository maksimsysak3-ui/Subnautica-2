/**
 * A road carries its services, and a building beside one is fed.
 *
 * There is no pipe tool. The whole feature is that drawing a road puts the power,
 * the water and the sewer in with it, and the whole failure mode is that it
 * silently does not -- which a screenshot cannot tell you and a unit test over
 * `Mains` would not either, because the thing being tested is the wiring between a
 * road edit, the mains and the simulation.
 *
 *   node tools/mains-test.mjs
 */

import { chromium } from 'playwright';
import http from 'node:http';
import * as esbuild from 'esbuild';

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

const r = await page.evaluate(async () => {
  try {
    return await HEADLESS.probeMains();
  } catch (err) {
    return { error: String(err && err.stack ? err.stack : err) };
  }
});

if (r.error) {
  console.error('FAIL  the probe threw\n' + r.error);
  console.error('\n' + logs.slice(-20).join('\n'));
  await browser.close();
  server.close();
  process.exit(1);
}

const fails = [];
const push = (m) => fails.push(m);
const show = (o) => Object.entries(o).map(([k, v]) => `${k} ${v ? 'yes' : 'no'}`).join(', ');

console.log(`pipe controls         ${r.onBar.length}`);
console.log(`before the road       ${show(r.fedBefore)}`);
console.log(`after drawing it      ${show(r.fed)}`);
console.log(`after bulldozing it   ${show(r.fedAfter)}`);
console.log(`drawn                 ${r.drawn.yellow} pixels of ${r.drawn.pixels}`);

if (r.onBar.length !== 0) {
  push(`${r.onBar.length} pipe controls are still in the interface; a road carries `
    + 'its services and there is nothing to lay');
}
for (const [k, v] of Object.entries(r.fedBefore)) {
  if (v) push(`${k} reached open ground before any road was drawn`);
}
for (const [k, v] of Object.entries(r.fed)) {
  if (!v) push(`${k} does not reach a building beside a road the player drew`);
}
for (const [k, v] of Object.entries(r.fedAfter)) {
  if (v) push(`${k} still reaches after the road was bulldozed`);
}
// The line was once baked at a main's true width -- about a metre, which from
// four hundred metres up is under a pixel: correctly drawn and invisible.
if (r.drawn.yellow < 1200) {
  push(`only ${r.drawn.yellow} pixels of main are in the frame; it is drawn too `
    + 'thin to see');
}

if (fails.length) {
  console.error('\nFAIL\n' + fails.map((f) => '  - ' + f).join('\n'));
  console.error('\n' + logs.slice(-12).join('\n'));
  process.exitCode = 1;
} else {
  console.log('\nPASS  a road carries its services, a building beside one is fed, '
    + 'and bulldozing takes them away');
}

await browser.close();
server.close();
