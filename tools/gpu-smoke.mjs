/**
 * Headless GPU smoke test.
 *
 * Renders tri.wgsl to an offscreen texture, reads the pixels back, and asserts
 * the result. It checks the thing that is easy to get silently wrong: the
 * three instances are submitted near-first, so the overlap pixel is only cyan
 * if the depth attachment is actually working. Without it, the far orange
 * triangle would paint over the near one and nobody would notice for months.
 *
 * Renders offscreen rather than to a canvas so it runs on machines with no
 * display and no real GPU.
 *
 *   node tools/gpu-smoke.mjs
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import http from 'node:http';

const server = http.createServer((_req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end('<!doctype html><title>t</title>');
});
await new Promise(r => server.listen(4180, r));

const wgsl = fs.readFileSync('/home/user/Subnautica-2/src/gfx/shaders/tri.wgsl', 'utf8');
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--enable-unsafe-webgpu','--enable-features=Vulkan','--use-angle=vulkan','--use-vulkan=swiftshader','--enable-unsafe-swiftshader','--no-sandbox','--disable-gpu-sandbox'],
});
const page = await browser.newPage();
page.on('pageerror', e => console.log('[pageerror]', e.message));
await page.goto('http://localhost:4180/');

const result = await page.evaluate(async (code) => {
  const W = 256, H = 256;
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) return { error: 'no adapter' };
  const device = await adapter.requestDevice();
  const errors = [];
  device.addEventListener('uncapturederror', e => errors.push(e.error.message));

  const module = device.createShaderModule({ code });
  const info = await module.getCompilationInfo();
  const diags = info.messages.map(m => `${m.type}:${m.lineNum}: ${m.message}`);
  if (info.messages.some(m => m.type === 'error')) return { diags };

  const layout = device.createBindGroupLayout({ entries: [
    { binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: 'uniform' } },
    { binding: 1, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } },
  ]});
  const pipeline = device.createRenderPipeline({
    layout: device.createPipelineLayout({ bindGroupLayouts: [layout] }),
    vertex: { module, entryPoint: 'vs' },
    fragment: { module, entryPoint: 'fs', targets: [{ format: 'rgba8unorm' }] },
    primitive: { topology: 'triangle-list', cullMode: 'none' },
    depthStencil: { format: 'depth24plus', depthWriteEnabled: true, depthCompare: 'less' },
  });

  const frame = device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  device.queue.writeBuffer(frame, 0, new Float32Array([1.0, 0.0, 0, 0])); // aspect 1, time 0 (no rotation)

  const inst = new Float32Array([
    0.00,  0.00, 0.30, 1.00, 0.384, 0.831, 1.0, 1.0,
   -0.34, -0.12, 0.55, 0.85, 1.0,   0.706, 0.329, 1.0,
    0.34, -0.12, 0.80, 0.85, 0.494, 0.878, 0.627, 1.0,
  ]);
  const ib = device.createBuffer({ size: inst.byteLength, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
  device.queue.writeBuffer(ib, 0, inst);
  const bg = device.createBindGroup({ layout, entries: [
    { binding: 0, resource: { buffer: frame } }, { binding: 1, resource: { buffer: ib } },
  ]});

  const color = device.createTexture({ size: [W,H], format: 'rgba8unorm',
    usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC });
  const depth = device.createTexture({ size: [W,H], format: 'depth24plus',
    usage: GPUTextureUsage.RENDER_ATTACHMENT });

  const enc = device.createCommandEncoder();
  const pass = enc.beginRenderPass({
    colorAttachments: [{ view: color.createView(), clearValue: {r:0.043,g:0.055,b:0.075,a:1}, loadOp:'clear', storeOp:'store' }],
    depthStencilAttachment: { view: depth.createView(), depthClearValue: 1.0, depthLoadOp:'clear', depthStoreOp:'store' },
  });
  pass.setPipeline(pipeline); pass.setBindGroup(0, bg); pass.draw(3, 3); pass.end();

  const bytesPerRow = W * 4;
  const out = device.createBuffer({ size: bytesPerRow * H, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
  enc.copyTextureToBuffer({ texture: color }, { buffer: out, bytesPerRow }, [W,H]);
  device.queue.submit([enc.finish()]);
  await out.mapAsync(GPUMapMode.READ);
  const px = new Uint8Array(out.getMappedRange().slice(0));
  out.unmap();

  const at = (x,y) => { const o = (y*W + x)*4; return [px[o],px[o+1],px[o+2]]; };
  const nonBg = (() => { let n=0; for (let i=0;i<W*H;i++) if (px[i*4]>20||px[i*4+1]>25||px[i*4+2]>30) n++; return n; })();
  return {
    diags, errors, nonBgPixels: nonBg, coverage: +(nonBg/(W*H)*100).toFixed(1),
    nearOnly:   at(128, 120),  // near triangle only            -> cyan
    orangeOnly: at(45, 166),   // far-left triangle, no overlap  -> orange
    greenOnly:  at(211, 166),  // far-right triangle, no overlap -> green
    overlap:    at(77, 160),   // near over far-left             -> MUST be cyan
    background: at(4, 4),      // clear colour
  };
}, wgsl);

console.log(JSON.stringify(result, null, 2));

// ---- assertions -------------------------------------------------------
const fails = [];
const near = (got, want, tol, what) => {
  if (!got) return fails.push(`${what}: no sample`);
  const d = got.map((c, i) => Math.abs(c - want[i]));
  if (d.some((x) => x > tol)) fails.push(`${what}: got [${got}] expected ~[${want}]`);
};

if (result.error) fails.push(result.error);
if (result.diags?.length) fails.push(`shader diagnostics: ${result.diags.join('; ')}`);
if (result.errors?.length) fails.push(`uncaptured errors: ${result.errors.join('; ')}`);
if (!(result.coverage > 15 && result.coverage < 40)) fails.push(`coverage ${result.coverage}% outside 15-40%`);

near(result.background, [11, 14, 19], 3, 'background is the clear colour');
near(result.nearOnly,   [81, 175, 211], 12, 'near instance is cyan');
near(result.orangeOnly, [236, 167, 78], 12, 'far-left instance is orange');
near(result.greenOnly,  [117, 208, 148], 12, 'far-right instance is green');
// The one that matters: near-over-far must stay cyan.
near(result.overlap,    [72, 156, 188], 14, 'DEPTH TEST: overlap stays cyan');

if (fails.length) {
  console.error('\nFAIL\n' + fails.map((f) => '  - ' + f).join('\n'));
  process.exitCode = 1;
} else {
  console.log('\nPASS  shader compiles, instancing works, depth ordering correct');
}
await browser.close();
server.close();
