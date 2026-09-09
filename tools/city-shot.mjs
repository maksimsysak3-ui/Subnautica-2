/**
 * Screenshots of the actual city, from the actual renderer.
 *
 * The asset sheet photographs prototypes on an empty grid, which is the right
 * picture for checking a generator and the wrong one for showing anybody what
 * the game is -- a row of towers on graph paper is a parts catalogue. The
 * built page cannot be driven for this either: the whole game at 1280x720
 * takes the software rasteriser in this environment out. So this borrows the
 * smoke test's rig, which renders the real terrain, the real city and the real
 * shaders offscreen and is known to survive here, and points a camera at it.
 *
 *   YAW=0.6 PITCH=0.18 DIST=520 node tools/city-shot.mjs out.png
 *
 * Was: the headless GPU smoke test.
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

// A multiple of 64 wide, so the readback's bytes-per-row stays 256-aligned.
const W = Number(process.env.W ?? 1280), H = Number(process.env.H ?? 720);
const dist = Number(process.env.DIST ?? 420);
const pitch = Number(process.env.PITCH ?? 0.35);
const yaw = Number(process.env.YAW ?? Math.PI * 0.25);
const focus = (process.env.FOCUS ?? '0,0,0').split(',').map(Number);
const eye = [focus[0] + dist * Math.cos(pitch) * Math.sin(yaw),
             focus[1] + dist * Math.sin(pitch),
             focus[2] + dist * Math.cos(pitch) * Math.cos(yaw)];
const FOV = (Number(process.env.FOV ?? 50) * Math.PI) / 180;
const viewProj = mul(perspective(FOV, W / H, 4, 7000), lookAt(eye, focus, [0, 1, 0]));

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

  const px = await renderWith('less');
  // Encoded in the page: handing a three-megabyte byte array back through the
  // bridge is far slower than handing back a PNG.
  const cv = new OffscreenCanvas(W, H);
  cv.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(px), W, H), 0, 0);
  const blob = await cv.convertToBlob({ type: 'image/png' });
  const url = await new Promise((res) => {
    const fr = new FileReader();
    fr.onload = () => res(fr.result);
    fr.readAsDataURL(blob);
  });
  return { instances: city.count, nearDrawn: lastCounts[0], farDrawn: lastCounts[1], errors, diags, url };
}, { shaders, viewProj, eye, W, H, simSrc, planes, lodSplit, pixelFactor });

const out = process.argv[2] ?? 'city.png';
if (result.error || result.diags?.length) {
  console.error('FAIL', result.error ?? result.diags.join('; '));
  process.exitCode = 1;
} else {
  fs.writeFileSync(out, Buffer.from(result.url.split(',')[1], 'base64'));
  console.log(`wrote ${out}  ${W}x${H}  ${result.instances} instances, ` +
    `${result.nearDrawn} near + ${result.farDrawn} far drawn`);
}

await browser.close();
server.close();
