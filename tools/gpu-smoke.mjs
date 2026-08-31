/**
 * Headless GPU smoke test.
 *
 * Renders the real scene shaders offscreen with a fixed camera, reads the
 * pixels back, and asserts what a screenshot would tell a person: sky above,
 * ground below, buildings standing on it.
 *
 * The depth check is the valuable one. Rather than eyeballing an overlap, it
 * renders the same frame twice -- once with depthCompare 'less', once with
 * 'always' -- and requires the images to differ. If the depth attachment ever
 * stops doing work, that difference goes to zero and this fails, whatever the
 * scene happens to be at the time.
 *
 * Renders offscreen rather than to a canvas so it runs with no display and no
 * real GPU.
 *
 *   node tools/gpu-smoke.mjs
 */

import { chromium } from 'playwright';
import fs from 'node:fs';
import http from 'node:http';
import * as esbuild from 'esbuild';

const read = (p) => fs.readFileSync(new URL('../src/gfx/shaders/' + p, import.meta.url), 'utf8');
const common = read('common.wgsl');
const resolve = (s) => s.replace(/^[ \t]*#include\s+"common\.wgsl"[ \t]*$/m, common);
const shaders = { ground: resolve(read('ground.wgsl')), box: resolve(read('box.wgsl')) };

// The instance generator, transpiled and evaluated in the page, so the test
// exercises the same layout the app ships rather than a copy of it.
const citySrc = (
  await esbuild.transform(fs.readFileSync(new URL('../src/sim/city.ts', import.meta.url), 'utf8'), {
    loader: 'ts',
    format: 'esm',
  })
).code.replace(/^export /gm, '');

// --- camera, computed here so the page gets a fixed, known view -----------
function perspective(fovy, aspect, near, far) {
  const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
  return [f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, far * nf, -1, 0, 0, far * near * nf, 0];
}
function lookAt(eye, tgt, up) {
  let z = [eye[0] - tgt[0], eye[1] - tgt[1], eye[2] - tgt[2]];
  let l = Math.hypot(...z); z = z.map((v) => v / l);
  let x = [up[1] * z[2] - up[2] * z[1], up[2] * z[0] - up[0] * z[2], up[0] * z[1] - up[1] * z[0]];
  l = Math.hypot(...x); x = x.map((v) => v / l);
  const y = [z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]];
  return [
    x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0,
    -(x[0] * eye[0] + x[1] * eye[1] + x[2] * eye[2]),
    -(y[0] * eye[0] + y[1] * eye[1] + y[2] * eye[2]),
    -(z[0] * eye[0] + z[1] * eye[1] + z[2] * eye[2]), 1,
  ];
}
function mul(a, b) {
  const o = new Array(16);
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++)
      o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
  return o;
}

const W = 320, H = 240;
// Pitched shallow on purpose so the horizon is in frame and the sky check means
// something; at a steeper angle the ground plane fills the view entirely.
const dist = 420, pitch = (20 * Math.PI) / 180, yaw = Math.PI * 0.25;
const eye = [dist * Math.cos(pitch) * Math.sin(yaw), dist * Math.sin(pitch), dist * Math.cos(pitch) * Math.cos(yaw)];
const viewProj = mul(perspective((50 * Math.PI) / 180, W / H, 4, 7000), lookAt(eye, [0, 0, 0], [0, 1, 0]));

// --- run -------------------------------------------------------------------
const server = http.createServer((_q, r) => { r.writeHead(200, { 'Content-Type': 'text/html' }); r.end('<!doctype html><title>t</title>'); });
await new Promise((r) => server.listen(4180, r));

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-angle=vulkan',
         '--use-vulkan=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--disable-gpu-sandbox'],
});
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto('http://localhost:4180/');

const result = await page.evaluate(async (args) => {
  const { shaders, viewProj, eye, W, H, citySrc } = args;
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) return { error: 'no adapter' };
  const device = await adapter.requestDevice();
  const errors = [];
  device.addEventListener('uncapturederror', (e) => errors.push(e.error.message));

  const EXTENT = 2600;
  const city = new Function(citySrc + '; return makeCity();')();

  const modules = {};
  const diags = [];
  for (const [name, code] of Object.entries(shaders)) {
    const m = device.createShaderModule({ code });
    const info = await m.getCompilationInfo();
    for (const msg of info.messages) if (msg.type === 'error') diags.push(`${name}:${msg.lineNum}: ${msg.message}`);
    modules[name] = m;
  }
  if (diags.length) return { diags };

  const camLayout = device.createBindGroupLayout({ entries: [{ binding: 0,
    visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } }] });
  const instLayout = device.createBindGroupLayout({ entries: [{ binding: 0,
    visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } }] });

  const camBuf = device.createBuffer({ size: 96, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  const cam = new Float32Array(24);
  cam.set(viewProj, 0);
  cam.set([eye[0], eye[1], eye[2], 7000], 16);
  cam.set([0, EXTENT, 0, 0], 20);
  device.queue.writeBuffer(camBuf, 0, cam);
  const camBg = device.createBindGroup({ layout: camLayout, entries: [{ binding: 0, resource: { buffer: camBuf } }] });

  const instBuf = device.createBuffer({ size: city.data.byteLength, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
  device.queue.writeBuffer(instBuf, 0, city.data);
  const instBg = device.createBindGroup({ layout: instLayout, entries: [{ binding: 0, resource: { buffer: instBuf } }] });

  async function renderWith(depthCompare) {
    const ds = { format: 'depth24plus', depthWriteEnabled: true, depthCompare };
    const mk = (mod, layouts) => device.createRenderPipeline({
      layout: device.createPipelineLayout({ bindGroupLayouts: layouts }),
      vertex: { module: mod, entryPoint: 'vs' },
      fragment: { module: mod, entryPoint: 'fs', targets: [{ format: 'rgba8unorm' }] },
      primitive: { topology: 'triangle-list', cullMode: 'none' },
      depthStencil: ds,
    });
    const groundPipe = mk(modules.ground, [camLayout]);
    const boxPipe = mk(modules.box, [camLayout, instLayout]);

    const color = device.createTexture({ size: [W, H], format: 'rgba8unorm',
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC });
    const depth = device.createTexture({ size: [W, H], format: 'depth24plus',
      usage: GPUTextureUsage.RENDER_ATTACHMENT });

    const enc = device.createCommandEncoder();
    const pass = enc.beginRenderPass({
      colorAttachments: [{ view: color.createView(), clearValue: { r: 0.043, g: 0.055, b: 0.075, a: 1 }, loadOp: 'clear', storeOp: 'store' }],
      depthStencilAttachment: { view: depth.createView(), depthClearValue: 1, depthLoadOp: 'clear', depthStoreOp: 'store' },
    });
    pass.setBindGroup(0, camBg);
    pass.setPipeline(groundPipe); pass.draw(6);
    pass.setPipeline(boxPipe); pass.setBindGroup(1, instBg); pass.draw(30, city.count);
    pass.end();

    const bpr = W * 4;
    const out = device.createBuffer({ size: bpr * H, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
    enc.copyTextureToBuffer({ texture: color }, { buffer: out, bytesPerRow: bpr }, [W, H]);
    device.queue.submit([enc.finish()]);
    await out.mapAsync(GPUMapMode.READ);
    const px = new Uint8Array(out.getMappedRange().slice(0));
    out.unmap();
    return px;
  }

  const withDepth = await renderWith('less');
  const noDepth = await renderWith('always');

  const at = (px, x, y) => { const o = (y * W + x) * 4; return [px[o], px[o + 1], px[o + 2]]; };
  const isSky = (c) => Math.abs(c[0] - 11) < 4 && Math.abs(c[1] - 14) < 4 && Math.abs(c[2] - 19) < 4;

  let sky = 0, lit = 0, differing = 0;
  for (let i = 0; i < W * H; i++) {
    const c = [withDepth[i * 4], withDepth[i * 4 + 1], withDepth[i * 4 + 2]];
    if (isSky(c)) sky++;
    if (c[0] + c[1] + c[2] > 150) lit++;   // brighter than ground or grid lines
    if (Math.abs(withDepth[i * 4] - noDepth[i * 4]) > 6) differing++;
  }

  return {
    instances: city.count, errors, diags,
    skyPct: +((sky / (W * H)) * 100).toFixed(1),
    buildingPct: +((lit / (W * H)) * 100).toFixed(1),
    depthChangedPct: +((differing / (W * H)) * 100).toFixed(1),
    topLeft: at(withDepth, 3, 3),
    lowerMiddle: at(withDepth, W >> 1, H - 30),
  };
}, { shaders, viewProj, eye, W, H, citySrc });

console.log(JSON.stringify(result, null, 2));

const fails = [];
if (result.error) fails.push(result.error);
if (result.diags?.length) fails.push(`shader errors: ${result.diags.join('; ')}`);
if (result.errors?.length) fails.push(`uncaptured: ${result.errors.join('; ')}`);
if (!(result.instances > 3000)) fails.push(`only ${result.instances} instances generated`);
if (!result.topLeft?.every((c, i) => Math.abs(c - [11, 14, 19][i]) < 4)) fails.push('top of frame is not sky');
if (!(result.skyPct > 4 && result.skyPct < 70)) fails.push(`sky covers ${result.skyPct}%, expected 4-70%`);
if (!(result.buildingPct > 2)) fails.push(`only ${result.buildingPct}% of pixels are lit geometry`);
if (!(result.depthChangedPct > 3)) fails.push(`depth buffer changed only ${result.depthChangedPct}% of pixels — is depth testing on?`);

if (fails.length) {
  console.error('\nFAIL\n' + fails.map((f) => '  - ' + f).join('\n'));
  process.exitCode = 1;
} else {
  console.log('\nPASS  shaders compile, city renders, depth testing is doing work');
}

await browser.close();
server.close();
