/**
 * Renders every asset to one contact sheet.
 *
 * Offscreen, with its own device and no canvas. That is not the first choice
 * -- driving the viewer page would share more code -- but a canvas-backed
 * WebGPU context cannot be screenshotted from outside the page, and under a
 * software rasteriser the device is lost every few frames. Offscreen is the
 * path that actually produces an image on a machine with no GPU.
 *
 * What is shared is what matters: the same generators, the same asset.wgsl,
 * the same vertex layout, the same shadow map and baked occlusion. Only the
 * pipeline wiring is duplicated.
 *
 * A viewer shows one asset at a time, which is the wrong tool for noticing
 * that six of them share a silhouette. This is that tool.
 *
 *   node tools/asset-sheet.mjs [out.png] [lod]
 */

import { chromium } from 'playwright';
import fs from 'node:fs';
import http from 'node:http';
import * as esbuild from 'esbuild';

const OUT = process.argv[2] ?? 'assets.png';
const LOD = Number(process.argv[3] ?? 0);
/** Optional id substring filter, so one category can be reviewed at a time. */
const ONLY = process.argv[4] ?? '';
/**
 * Street-level framing. Doors, shopfronts and window frames are the details
 * players complain about, and the whole-building shot is too far away to
 * judge any of them -- so this drops the camera to eye height at the kerb.
 *
 *   node tools/asset-sheet.mjs doors.png 0 com. street
 */
const STREET = (process.argv[5] ?? '') === 'street';
/** Optional close-up multiplier, for looking at one detail rather than a lot. */
const ZOOM = Number(process.argv[6] ?? 1) || 1;
const TILE = 512;          // 512 * 4 bytes is a multiple of the 256-byte row alignment
const TILE_H = 576;
const COLS = 6;
const SHADOW = 1024;

const shader = fs.readFileSync(new URL('../src/gfx/shaders/asset.wgsl', import.meta.url), 'utf8');
const registry = (
  await esbuild.build({
    entryPoints: [new URL('../src/assets/registry.ts', import.meta.url).pathname],
    bundle: true, format: 'iife', globalName: 'REG', write: false, target: 'es2022',
  })
).outputFiles[0].text;

const server = http.createServer((_q, r) => { r.writeHead(200, { 'Content-Type': 'text/html' }); r.end('<!doctype html><title>t</title>'); });
await new Promise((r) => server.listen(4181, r));

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-angle=vulkan',
         '--use-vulkan=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--disable-gpu-sandbox'],
});
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto('http://localhost:4181/');

const result = await page.evaluate(async ({ shader, registry, TILE, TILE_H, COLS, LOD, SHADOW, ONLY, STREET, ZOOM }) => {
  const all = new Function(registry + '; return REG;')().ASSETS;
  // Same seed the game uses, so the sheet shows the colours the player sees.
  const idSeed = (id) => {
    let h = 2166136261;
    for (let i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 16777619); }
    return ((h >>> 8) % 100000) / 97.0;
  };
  // Comma-separated: any of the substrings matches, so an arbitrary handful of
  // assets can be put side by side rather than only a whole category.
  const wanted = ONLY.split(',').map((t) => t.trim()).filter(Boolean);
  const ASSETS = wanted.length ? all.filter((a) => wanted.some((t) => a.id.includes(t))) : all;
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) return { error: 'no adapter' };
  const device = await adapter.requestDevice();
  const errors = [];
  device.addEventListener('uncapturederror', (e) => errors.push(e.error.message));

  const module = device.createShaderModule({ code: shader });
  const info = await module.getCompilationInfo();
  const diags = info.messages.filter((m) => m.type === 'error').map((m) => `${m.lineNum}: ${m.message}`);
  if (diags.length) return { diags };

  const layout = device.createBindGroupLayout({ entries: [
    { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
    { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'depth' } },
    { binding: 2, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'comparison' } },
  ] });
  const pipelineLayout = device.createPipelineLayout({ bindGroupLayouts: [layout] });
  const buffers = [{ arrayStride: 48, attributes: [
    { shaderLocation: 0, offset: 0, format: 'float32x3' },
    { shaderLocation: 1, offset: 12, format: 'float32x3' },
    { shaderLocation: 2, offset: 24, format: 'float32' },
    { shaderLocation: 3, offset: 28, format: 'float32' },
    { shaderLocation: 4, offset: 32, format: 'float32' },
    { shaderLocation: 5, offset: 36, format: 'float32x2' },
    { shaderLocation: 6, offset: 44, format: 'float32' },
  ] }];

  const pipeline = device.createRenderPipeline({
    layout: pipelineLayout,
    vertex: { module, entryPoint: 'vs', buffers },
    fragment: { module, entryPoint: 'fs', targets: [{ format: 'rgba8unorm' }] },
    primitive: { topology: 'triangle-list', cullMode: 'back', frontFace: 'ccw' },
    depthStencil: { format: 'depth24plus', depthWriteEnabled: true, depthCompare: 'less' },
  });
  // The shadow pass gets its own layout with only the uniform: binding the
  // shadow map while rendering into it is a usage conflict that takes the
  // device down rather than raising a tidy error.
  const shadowLayout = device.createBindGroupLayout({
    entries: [{ binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: 'uniform' } }],
  });
  const shadowPipeline = device.createRenderPipeline({
    layout: device.createPipelineLayout({ bindGroupLayouts: [shadowLayout] }),
    vertex: { module, entryPoint: 'vs_shadow', buffers },
    primitive: { topology: 'triangle-list', cullMode: 'front', frontFace: 'ccw' },
    depthStencil: { format: 'depth32float', depthWriteEnabled: true, depthCompare: 'less' },
  });

  const shadowTex = device.createTexture({ size: [SHADOW, SHADOW], format: 'depth32float',
    usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING });
  const sceneBuf = device.createBuffer({ size: 240, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  const shadowBg = device.createBindGroup({ layout: shadowLayout,
    entries: [{ binding: 0, resource: { buffer: sceneBuf } }] });
  const bg = device.createBindGroup({ layout, entries: [
    { binding: 0, resource: { buffer: sceneBuf } },
    { binding: 1, resource: shadowTex.createView() },
    { binding: 2, resource: device.createSampler({ compare: 'less' }) },
  ] });

  const colour = device.createTexture({ size: [TILE, TILE_H], format: 'rgba8unorm',
    usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC });
  const depth = device.createTexture({ size: [TILE, TILE_H], format: 'depth24plus',
    usage: GPUTextureUsage.RENDER_ATTACHMENT });
  const read = device.createBuffer({ size: TILE * 4 * TILE_H,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });

  // Ground plane, material 8, fully unoccluded.
  const G = 400;
  // Twelve floats a vertex: position, normal, material, occlusion, tint,
  // surface coordinates, part key.
  const gv = new Float32Array([
    -G, 0, -G, 0, 1, 0, 8, 1, 0, 0, 0, 0,   G, 0, -G, 0, 1, 0, 8, 1, 0, 0, 0, 0,
     G, 0,  G, 0, 1, 0, 8, 1, 0, 0, 0, 0,  -G, 0,  G, 0, 1, 0, 8, 1, 0, 0, 0, 0,
  ]);
  const gvb = device.createBuffer({ size: gv.byteLength, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
  device.queue.writeBuffer(gvb, 0, gv);
  const gi = new Uint32Array([0, 2, 1, 0, 3, 2]);
  const gib = device.createBuffer({ size: gi.byteLength, usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST });
  device.queue.writeBuffer(gib, 0, gi);

  // --- matrices -----------------------------------------------------------
  const persp = (fy, a, n, f) => { const t = 1 / Math.tan(fy / 2), nf = 1 / (n - f);
    return [t / a, 0, 0, 0, 0, t, 0, 0, 0, 0, f * nf, -1, 0, 0, f * n * nf, 0]; };
  const ortho = (l, r, b, t, n, f) => { const lr = 1 / (l - r), bt = 1 / (b - t), nf = 1 / (n - f);
    return [-2 * lr, 0, 0, 0, 0, -2 * bt, 0, 0, 0, 0, nf, 0, (l + r) * lr, (t + b) * bt, n * nf, 1]; };
  const look = (e, t, u) => {
    let z = [e[0] - t[0], e[1] - t[1], e[2] - t[2]]; let l = Math.hypot(...z); z = z.map((v) => v / l);
    let x = [u[1] * z[2] - u[2] * z[1], u[2] * z[0] - u[0] * z[2], u[0] * z[1] - u[1] * z[0]];
    l = Math.hypot(...x); x = x.map((v) => v / l);
    const y = [z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]];
    return [x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0,
      -(x[0] * e[0] + x[1] * e[1] + x[2] * e[2]), -(y[0] * e[0] + y[1] * e[1] + y[2] * e[2]),
      -(z[0] * e[0] + z[1] * e[1] + z[2] * e[2]), 1]; };
  const mul = (a, b) => { const o = new Array(16);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++)
      o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    return o; };

  const sun = (() => { const v = [0.48, 0.68, 0.38]; const l = Math.hypot(...v); return v.map((x) => x / l); })();

  const sheet = document.createElement('canvas');
  const rows = Math.ceil(ASSETS.length / COLS);
  sheet.width = COLS * TILE; sheet.height = rows * TILE_H;
  const ctx = sheet.getContext('2d');
  ctx.fillStyle = '#0b0e13';
  ctx.fillRect(0, 0, sheet.width, sheet.height);
  const stats = [];

  for (let i = 0; i < ASSETS.length; i++) {
    const a = ASSETS[i];
    const mesh = a.build(LOD).build();
    let height = 0, radius = 1;
    for (let v = 0; v < mesh.vertices.length; v += 12) {
      height = Math.max(height, mesh.vertices[v + 1]);
      radius = Math.max(radius, Math.hypot(mesh.vertices[v], mesh.vertices[v + 2]));
    }

    const dist = (STREET ? Math.max(height * 2.2, radius * 1.15, 16)
                         : Math.max(height * 1.5, radius * 3.4, 12)) / ZOOM;
    const target = STREET ? [0, Math.min(4.5, height * 0.42), 0] : [0, height * 0.45, 0];
    const yaw = STREET ? 0.30 : 0.95;
    const pitch = STREET ? 0.12 : 0.30;
    const eye = [target[0] + dist * Math.cos(pitch) * Math.sin(yaw),
                 target[1] + dist * Math.sin(pitch) + (STREET ? 0 : height * 0.1),
                 target[2] + dist * Math.cos(pitch) * Math.cos(yaw)];
    const viewProj = mul(persp((42 * Math.PI) / 180, TILE / TILE_H, 0.2, 2000), look(eye, target, [0, 1, 0]));

    const extent = Math.max(radius * 1.7, height * 0.9, 8);
    const centre = [0, height * 0.5, 0];
    const sunEye = [centre[0] + sun[0] * extent * 2.6, centre[1] + sun[1] * extent * 2.6, centre[2] + sun[2] * extent * 2.6];
    const sunViewProj = mul(ortho(-extent, extent, -extent, extent, 0.5, extent * 6), look(sunEye, centre, [0, 1, 0]));

    const scene = new Float32Array(60);
    scene.set(viewProj, 0);
    scene.set(sunViewProj, 16);
    scene.set([eye[0], eye[1], eye[2], 0], 32);
    scene.set([sun[0], sun[1], sun[2], 0], 36);
    scene.set([idSeed(a.id), 1 / SHADOW, Math.max(height, radius) * 4.5 + 20, 0], 40);
    const brand = a.brand ?? { colour: [0.42, 0.44, 0.47], accent: [0.30, 0.32, 0.35] };
    scene.set([brand.colour[0], brand.colour[1], brand.colour[2], 1], 44);
    scene.set([brand.accent[0], brand.accent[1], brand.accent[2], 1], 48);
    const name = ((a.brand && a.brand.name) || '').toUpperCase().slice(0, 16);
    const words = new Uint32Array(4);
    for (let i = 0; i < name.length; i++) words[i >> 2] |= (name.charCodeAt(i) & 255) << ((i % 4) * 8);
    new Uint32Array(scene.buffer, 52 * 4, 4).set(words);
    scene.set([name.length, 0, 0, 0], 56);
    device.queue.writeBuffer(sceneBuf, 0, scene);

    const vb = device.createBuffer({ size: mesh.vertices.byteLength, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
    device.queue.writeBuffer(vb, 0, mesh.vertices);
    const ib = device.createBuffer({ size: mesh.indices.byteLength, usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST });
    device.queue.writeBuffer(ib, 0, mesh.indices);

    const enc = device.createCommandEncoder();
    const sp = enc.beginRenderPass({ colorAttachments: [], depthStencilAttachment: {
      view: shadowTex.createView(), depthClearValue: 1, depthLoadOp: 'clear', depthStoreOp: 'store' } });
    sp.setPipeline(shadowPipeline);
    sp.setBindGroup(0, shadowBg);
    sp.setVertexBuffer(0, vb);
    sp.setIndexBuffer(ib, 'uint32');
    sp.drawIndexed(mesh.indices.length);
    sp.end();

    const pass = enc.beginRenderPass({
      colorAttachments: [{ view: colour.createView(), clearValue: { r: 0.043, g: 0.055, b: 0.075, a: 1 }, loadOp: 'clear', storeOp: 'store' }],
      depthStencilAttachment: { view: depth.createView(), depthClearValue: 1, depthLoadOp: 'clear', depthStoreOp: 'store' },
    });
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bg);
    pass.setVertexBuffer(0, gvb);
    pass.setIndexBuffer(gib, 'uint32');
    pass.drawIndexed(gi.length);
    pass.setVertexBuffer(0, vb);
    pass.setIndexBuffer(ib, 'uint32');
    pass.drawIndexed(mesh.indices.length);
    pass.end();

    enc.copyTextureToBuffer({ texture: colour }, { buffer: read, bytesPerRow: TILE * 4 }, [TILE, TILE_H]);
    device.queue.submit([enc.finish()]);
    await read.mapAsync(GPUMapMode.READ);
    const px = new Uint8ClampedArray(read.getMappedRange().slice(0));
    read.unmap();
    vb.destroy(); ib.destroy();

    const cx = (i % COLS) * TILE, cy = Math.floor(i / COLS) * TILE_H;
    ctx.putImageData(new ImageData(px, TILE, TILE_H), cx, cy);
    ctx.fillStyle = '#62d4ff';
    ctx.font = '600 17px ui-monospace, monospace';
    ctx.fillText(a.name, cx + 14, cy + 28);
    ctx.fillStyle = '#8fa3bd';
    ctx.font = '14px ui-monospace, monospace';
    ctx.fillText(`${a.variant} · ${(mesh.indices.length / 3).toLocaleString()} tris · ${a.footprint[0]}x${a.footprint[1]} cells`, cx + 14, cy + 50);
    stats.push({ id: a.id, tris: mesh.indices.length / 3 });
  }

  return { png: sheet.toDataURL('image/png'), stats, errors, diags };
}, { shader, registry, TILE, TILE_H, COLS, LOD, SHADOW, ONLY, STREET, ZOOM });

if (result.error || result.diags?.length) {
  console.error('FAIL', result.error ?? result.diags.join('; '));
  process.exitCode = 1;
} else {
  fs.writeFileSync(OUT, Buffer.from(result.png.split(',')[1], 'base64'));
  for (const s of result.stats) console.log(s.id.padEnd(20), String(s.tris).padStart(6), 'tris');
  if (result.errors.length) console.error('uncaptured:', result.errors.join('; '));
  console.log(`\nwrote ${OUT} (LOD ${LOD})`);
}

await browser.close();
server.close();
