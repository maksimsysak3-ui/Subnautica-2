/**
 * Compiles every shader and prints what the driver says about it.
 *
 * A WGSL error surfaces at draw time as "invalid CommandBuffer", which names
 * neither the shader nor the line. This asks the device directly.
 *
 *   node tools/wgsl-check.mjs
 */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';

const dir = new URL('../src/gfx/shaders/', import.meta.url).pathname;
const files = Object.fromEntries(fs.readdirSync(dir)
  .map((f) => [f, fs.readFileSync(dir + f, 'utf8')]));
/** The same textual include the renderer resolves at load. */
const resolve = (src) => src.replace(/^[ \t]*#include\s+"([\w.-]+)"[ \t]*$/gm,
  (whole, name) => files[name] ?? whole);
// Includes are not entry points: a file with no entry point of its own is
// checked through whatever includes it, not on its own.
const sources = Object.fromEntries(Object.entries(files)
  .filter(([, src]) => /@vertex|@fragment|@compute/.test(src))
  .map(([f, src]) => [f, resolve(src)]));

const server = http.createServer((_, res) =>
  res.writeHead(200, { 'content-type': 'text/html' }).end('<!doctype html><body>'));
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--enable-unsafe-webgpu', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
const page = await browser.newPage();
await page.goto(`http://127.0.0.1:${server.address().port}/`);

const report = await page.evaluate(async (srcs) => {
  const adapter = await navigator.gpu.requestAdapter();
  const device = await adapter.requestDevice();
  const out = {};
  for (const [name, code] of Object.entries(srcs)) {
    const info = await device.createShaderModule({ code }).getCompilationInfo();
    out[name] = info.messages.map((m) => `${m.type} ${m.lineNum}:${m.linePos} ${m.message}`);
  }
  return out;
}, sources);

let bad = 0;
for (const [name, msgs] of Object.entries(report)) {
  const errs = msgs.filter((m) => m.startsWith('error'));
  bad += errs.length;
  console.log(`${errs.length ? 'FAIL' : 'ok  '}  ${name}`);
  for (const m of msgs) console.log('        ' + m.replace(/\n/g, '\n        '));
}
console.log(bad ? `\nFAIL  ${bad} error(s)` : '\nPASS  every shader compiles');
process.exitCode = bad ? 1 : 0;
await browser.close();
server.close();
