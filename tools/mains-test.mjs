/**
 * The mains tool, driven the way a player drives it.
 *
 * `Mains` has a unit test and it passes; what it does not test is everything
 * between a pointer and `lay` -- the button existing, the pick landing on the
 * right cell, the trail surviving the drag, `commit` being reached at all. That
 * gap is exactly where a tool goes wrong, and "I cannot draw or connect any" is
 * what it looks like from outside.
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

for (const l of logs) if (l.includes('LAYMAIN')) console.log(l);
if (r.error) {
  console.error('FAIL  the probe threw\n' + r.error);
  console.error('\n' + logs.slice(-20).join('\n'));
  await browser.close();
  server.close();
  process.exit(1);
}

const fails = [];
const push = (m) => fails.push(m);

console.log(`on the bar            ${r.onBar.length} mains controls`);
console.log(`in the water drawer   ${r.buttons.length ? 'yes' : 'no'}`);
if (r.onBar.length !== 0) {
  push(`${r.onBar.length} mains controls sit on the bar; they belong in the branch `
    + 'drawers, beside the buildings they carry for');
}
if (!r.picked) push('the water main could not be found in the water drawer');
console.log(`drag ran from         ${r.from.map(Math.round).join(', ')} to `
  + `${r.to.map(Math.round).join(', ')} in metres`);
console.log(`drag along the road   ${r.laidAlongRoad} cells laid`);
console.log(`drag across open land ${r.laidOffRoad} cells laid`);
console.log(`a house 40 m off it   ${r.connectedBefore ? 'connected' : 'not'} before, `
  + `${r.connectedAfter ? 'connected' : 'not'} after`);
console.log(`drawn                 ${r.lines} segments`);

if (r.laidAlongRoad < 20) {
  push(`dragging along a road laid ${r.laidAlongRoad} cells; the tool does not draw`);
}
if (r.connectedBefore) push('something was connected before anything was laid');
if (!r.connectedAfter) push('laying a main down the street connected nothing beside it');
if (r.laidOffRoad !== 0) {
  push(`a drag across open land laid ${r.laidOffRoad} cells; a main goes in the street`);
}
if (r.lines < 10) push(`the main is drawn as ${r.lines} segments; it is not being drawn`);

if (fails.length) {
  console.error('\nFAIL\n' + fails.map((f) => '  - ' + f).join('\n'));
  console.error('\n' + logs.slice(-12).join('\n'));
  process.exitCode = 1;
} else {
  console.log('\nPASS  a drag along a street lays a main, connects the houses, and draws');
}

await browser.close();
server.close();
