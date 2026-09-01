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
const shaders = {
  terrain: resolve(read('terrain.wgsl')),
  box: resolve(read('box.wgsl')),
  cull: resolve(read('cull.wgsl')),
};

// The whole simulation module, bundled and evaluated in the page, so the test
// exercises the terrain and city the app actually ships rather than a copy.
const simSrc = (
  await esbuild.build({
    entryPoints: [new URL('../src/sim/index.ts', import.meta.url).pathname],
    bundle: true, format: 'iife', globalName: 'SIM', write: false, target: 'es2022',
  })
).outputFiles[0].text;

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
const FOV = (50 * Math.PI) / 180;
const viewProj = mul(perspective(FOV, W / H, 4, 7000), lookAt(eye, [0, 0, 0], [0, 1, 0]));

// The same six planes the engine extracts, so the compute cull has a real
// frustum to work against.
function planesOf(m) {
  const r = (i, j) => m[j * 4 + i];
  const out = [];
  const push = (a, b, c, d) => {
    const l = Math.hypot(a, b, c) || 1;
    out.push(a / l, b / l, c / l, d / l);
  };
  push(r(3,0)+r(0,0), r(3,1)+r(0,1), r(3,2)+r(0,2), r(3,3)+r(0,3));
  push(r(3,0)-r(0,0), r(3,1)-r(0,1), r(3,2)-r(0,2), r(3,3)-r(0,3));
  push(r(3,0)+r(1,0), r(3,1)+r(1,1), r(3,2)+r(1,2), r(3,3)+r(1,3));
  push(r(3,0)-r(1,0), r(3,1)-r(1,1), r(3,2)-r(1,2), r(3,3)-r(1,3));
  push(r(2,0), r(2,1), r(2,2), r(2,3));
  push(r(3,0)-r(2,0), r(3,1)-r(2,1), r(3,2)-r(2,2), r(3,3)-r(2,3));
  return out;
}
const planes = planesOf(viewProj);
const lodSplit = 420;
const pixelFactor = H / (2 * Math.tan(FOV / 2));

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
  const { shaders, viewProj, eye, W, H, simSrc } = args;
  void args.planes; void args.lodSplit; void args.pixelFactor;
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) return { error: 'no adapter' };
  const device = await adapter.requestDevice();
  const errors = [];
  device.addEventListener('uncapturederror', (e) => errors.push(e.error.message));

  const sim = new Function(simSrc + '; return SIM;')();
  const EXTENT = sim.TERRAIN.size * 0.5;
  const city = sim.makeCity();
  const mesh = sim.buildTerrain();

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
    visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT | GPUShaderStage.COMPUTE,
    buffer: { type: 'uniform' } }] });
  const instLayout = device.createBindGroupLayout({ entries: [
    { binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } },
    { binding: 1, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } },
  ] });
  const cullLayout = device.createBindGroupLayout({ entries: [
    { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
    { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
    { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
    { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
  ] });

  const camBuf = device.createBuffer({ size: 192, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  const cam = new Float32Array(48);
  cam.set(viewProj, 0);
  cam.set([eye[0], eye[1], eye[2], 7000], 16);
  // time, extent, LOD split, pixels-per-metre-at-unit-distance
  cam.set([0, EXTENT, args.lodSplit, args.pixelFactor], 20);
  cam.set(args.planes, 24);
  device.queue.writeBuffer(camBuf, 0, cam);
  const camBg = device.createBindGroup({ layout: camLayout, entries: [{ binding: 0, resource: { buffer: camBuf } }] });

  const vtxBuf = device.createBuffer({ size: mesh.vertices.byteLength, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
  device.queue.writeBuffer(vtxBuf, 0, mesh.vertices);
  const idxBuf = device.createBuffer({ size: mesh.indices.byteLength, usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST });
  device.queue.writeBuffer(idxBuf, 0, mesh.indices);

  const instBuf = device.createBuffer({ size: city.data.byteLength, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
  device.queue.writeBuffer(instBuf, 0, city.data);
  const listSize = city.count * 4;
  const nearBuf = device.createBuffer({ size: listSize, usage: GPUBufferUsage.STORAGE });
  const farBuf = device.createBuffer({ size: listSize, usage: GPUBufferUsage.STORAGE });
  const argsBuf = device.createBuffer({ size: 32,
    usage: GPUBufferUsage.INDIRECT | GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC });
  const argsRead = device.createBuffer({ size: 32,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });

  const cullBg = device.createBindGroup({ layout: cullLayout, entries: [
    { binding: 0, resource: { buffer: instBuf } },
    { binding: 1, resource: { buffer: nearBuf } },
    { binding: 2, resource: { buffer: farBuf } },
    { binding: 3, resource: { buffer: argsBuf } },
  ] });
  const nearBg = device.createBindGroup({ layout: instLayout, entries: [
    { binding: 0, resource: { buffer: instBuf } }, { binding: 1, resource: { buffer: nearBuf } } ] });
  const farBg = device.createBindGroup({ layout: instLayout, entries: [
    { binding: 0, resource: { buffer: instBuf } }, { binding: 1, resource: { buffer: farBuf } } ] });

  const cullPipe = device.createComputePipeline({
    layout: device.createPipelineLayout({ bindGroupLayouts: [camLayout, cullLayout] }),
    compute: { module: modules.cull, entryPoint: 'main' },
  });

  let lastCounts = [0, 0];
  async function renderWith(depthCompare) {
    const ds = { format: 'depth24plus', depthWriteEnabled: true, depthCompare };
    const mk = (mod, layouts, entryPoint) => device.createRenderPipeline({
      layout: device.createPipelineLayout({ bindGroupLayouts: layouts }),
      vertex: { module: mod, entryPoint },
      fragment: { module: mod, entryPoint: 'fs', targets: [{ format: 'rgba8unorm' }] },
      primitive: { topology: 'triangle-list', cullMode: 'none' },
      depthStencil: ds,
    });
    const terrainPipe = device.createRenderPipeline({
      layout: device.createPipelineLayout({ bindGroupLayouts: [camLayout] }),
      vertex: {
        module: modules.terrain, entryPoint: 'vs',
        buffers: [{ arrayStride: sim.FLOATS_PER_VERTEX * 4, attributes: [
          { shaderLocation: 0, offset: 0, format: 'float32x3' },
          { shaderLocation: 1, offset: 12, format: 'float32x3' },
        ] }],
      },
      fragment: { module: modules.terrain, entryPoint: 'fs', targets: [{ format: 'rgba8unorm' }] },
      primitive: { topology: 'triangle-list', cullMode: 'back', frontFace: 'ccw' },
      depthStencil: ds,
    });
    const solidPipe = mk(modules.box, [camLayout, instLayout], 'vs_solid');
    const impostorPipe = mk(modules.box, [camLayout, instLayout], 'vs_impostor');

    const color = device.createTexture({ size: [W, H], format: 'rgba8unorm',
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC });
    const depth = device.createTexture({ size: [W, H], format: 'depth24plus',
      usage: GPUTextureUsage.RENDER_ATTACHMENT });

    const enc = device.createCommandEncoder();
    device.queue.writeBuffer(argsBuf, 0, new Uint32Array([30, 0, 0, 0, 6, 0, 0, 0]));
    const cp = enc.beginComputePass();
    cp.setPipeline(cullPipe);
    cp.setBindGroup(0, camBg);
    cp.setBindGroup(1, cullBg);
    cp.dispatchWorkgroups(Math.ceil(city.count / 64));
    cp.end();

    const pass = enc.beginRenderPass({
      colorAttachments: [{ view: color.createView(), clearValue: { r: 0.043, g: 0.055, b: 0.075, a: 1 }, loadOp: 'clear', storeOp: 'store' }],
      depthStencilAttachment: { view: depth.createView(), depthClearValue: 1, depthLoadOp: 'clear', depthStoreOp: 'store' },
    });
    pass.setBindGroup(0, camBg);
    pass.setPipeline(terrainPipe);
    pass.setVertexBuffer(0, vtxBuf);
    pass.setIndexBuffer(idxBuf, 'uint32');
    for (const c of mesh.chunks) pass.drawIndexed(sim.INDICES_PER_CHUNK, 1, 0, c.baseVertex);
    pass.setPipeline(solidPipe); pass.setBindGroup(1, nearBg); pass.drawIndirect(argsBuf, 0);
    pass.setPipeline(impostorPipe); pass.setBindGroup(1, farBg); pass.drawIndirect(argsBuf, 16);
    pass.end();
    enc.copyBufferToBuffer(argsBuf, 0, argsRead, 0, 32);

    const bpr = W * 4;
    const out = device.createBuffer({ size: bpr * H, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
    enc.copyTextureToBuffer({ texture: color }, { buffer: out, bytesPerRow: bpr }, [W, H]);
    device.queue.submit([enc.finish()]);
    await argsRead.mapAsync(GPUMapMode.READ);
    const counts = new Uint32Array(argsRead.getMappedRange().slice(0));
    argsRead.unmap();
    lastCounts = [counts[1], counts[5]];
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
    instances: city.count, chunks: mesh.chunks.length, errors, diags,
    nearDrawn: lastCounts[0], farDrawn: lastCounts[1],
    skyPct: +((sky / (W * H)) * 100).toFixed(1),
    buildingPct: +((lit / (W * H)) * 100).toFixed(1),
    depthChangedPct: +((differing / (W * H)) * 100).toFixed(1),
    topLeft: at(withDepth, 3, 3),
    lowerMiddle: at(withDepth, W >> 1, H - 30),
  };
}, { shaders, viewProj, eye, W, H, simSrc, planes, lodSplit, pixelFactor });

console.log(JSON.stringify(result, null, 2));

const fails = [];
if (result.error) fails.push(result.error);
if (result.diags?.length) fails.push(`shader errors: ${result.diags.join('; ')}`);
if (result.errors?.length) fails.push(`uncaptured: ${result.errors.join('; ')}`);
if (!(result.instances > 2000)) fails.push(`only ${result.instances} instances generated`);
if (result.chunks !== 576) fails.push(`expected 256 terrain chunks, got ${result.chunks}`);
const drawn = (result.nearDrawn ?? 0) + (result.farDrawn ?? 0);
if (!(drawn > 0)) fails.push('GPU culling passed nothing through — nothing would be drawn');
if (!(drawn < result.instances)) fails.push(`GPU culling kept all ${result.instances} instances — is it running?`);
if (!(result.nearDrawn > 0 && result.farDrawn > 0)) {
  fails.push(`LOD split degenerate: near=${result.nearDrawn} far=${result.farDrawn}`);
}
if (!result.topLeft?.every((c, i) => Math.abs(c - [11, 14, 19][i]) < 4)) fails.push('top of frame is not sky');
if (!(result.skyPct > 4 && result.skyPct < 70)) fails.push(`sky covers ${result.skyPct}%, expected 4-70%`);
if (!(result.buildingPct > 2)) fails.push(`only ${result.buildingPct}% of pixels are lit geometry`);
if (!(result.depthChangedPct > 3)) fails.push(`depth buffer changed only ${result.depthChangedPct}% of pixels — is depth testing on?`);

if (fails.length) {
  console.error('\nFAIL\n' + fails.map((f) => '  - ' + f).join('\n'));
  process.exitCode = 1;
} else {
  console.log('\nPASS  shaders compile, terrain and city render, depth testing is doing work');
}

await browser.close();
server.close();
