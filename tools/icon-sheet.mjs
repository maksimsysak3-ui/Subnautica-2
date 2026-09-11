/**
 * Photographs every placeable building and packs the shots into one icon sheet.
 *
 * The toolbar used to carry hand-drawn glyphs, which is fine for four zones and
 * useless for eighty-five services: a player looking for the fire station is
 * looking for the building they have seen on the map, and no 18-pixel pictogram
 * of a flame is that building. So the icons are the buildings, rendered through
 * the game's own asset shader with the game's own brand colours.
 *
 * Rendered large and packed small. A 128-pixel render downsampled to 48 is
 * sharper than a 48-pixel render, because the aliasing on a roofline is most of
 * what makes a small icon muddy, and there is no multisampling here.
 *
 * The output is a TypeScript module holding one base64 PNG and an index, which
 * is the form that survives every way this project is served -- the dev server,
 * GitHub Pages, and the single-file build alike -- without a fetch.
 *
 *   node tools/icon-sheet.mjs
 */

import { chromium } from 'playwright';
import fs from 'node:fs';
import http from 'node:http';
import * as esbuild from 'esbuild';

/**
 * Rendered at TILE, packed at ICON. TILE * 4 must be a multiple of the
 * 256-byte row alignment, so TILE is a multiple of 64.
 *
 * Packed at 96 rather than 48: the drawer draws these at 52 and upward of
 * that on a high-density screen, and a 48-pixel sprite shown at 52 is being
 * *enlarged* -- which is exactly why they looked soft. At 96 there is a real
 * pixel behind every one drawn on any display worth having.
 */
const TILE = 192;
const ICON = 96;
const COLS = 12;
const SHADOW = 1024;
const OUT = new URL('../src/ui/icon-sheet.ts', import.meta.url).pathname;

const shaderDir = new URL('../src/gfx/shaders/', import.meta.url).pathname;
const shader = fs.readFileSync(shaderDir + 'asset.wgsl', 'utf8')
  .replace(/^[ \t]*#include\s+"([\w.-]+)"[ \t]*$/gm,
    (whole, name) => (fs.existsSync(shaderDir + name)
      ? fs.readFileSync(shaderDir + name, 'utf8') : whole));
const registry = (
  await esbuild.build({
    entryPoints: [new URL('../src/assets/registry.ts', import.meta.url).pathname],
    bundle: true, format: 'iife', globalName: 'REG', write: false, target: 'es2022',
  })
).outputFiles[0].text;

const server = http.createServer((_q, r) => {
  r.writeHead(200, { 'Content-Type': 'text/html' });
  r.end('<!doctype html><title>t</title>');
});
await new Promise((r) => server.listen(4182, r));

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-angle=vulkan',
    '--use-vulkan=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox',
    '--disable-gpu-sandbox'],
});
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto('http://localhost:4182/');

const result = await page.evaluate(async ({ shader, registry, TILE, ICON, COLS, SHADOW }) => {
  const all = new Function(registry + '; return REG;')().ASSETS;
  // Everything a player can place one at a time, plus one specimen of each
  // tree so the nature tool has a face. Zoned stock is not placeable -- it
  // grows -- so photographing four hundred houses would be four hundred icons
  // nobody can click.
  // Services, signature buildings, and one specimen of each tree. Signature
  // buildings are placed one at a time exactly like services are, so they
  // need a face for the same reason.
  const placeable = all.filter((a) => a.zone === 'service' || a.signature === true
    || (a.zone === 'nature' && /oak|pine|birch|maple|plane|willow/.test(a.id)));

  // One specimen per zone and density, for the zoning buttons. A zone button
  // saying "medium residential" is a category; a picture of the kind of
  // building that actually grows there is the answer to the question the
  // player is asking, which is what am I about to get.
  //
  // Per theme as well as per density. The drawer used to show one tile called
  // "low residential", which names a category and hides the fact that low
  // residential is six different streets depending on the theme. Six tiles
  // showing what each one actually builds is the choice a player is making.
  const THEMES = ['modern', 'european', 'american', 'asian', 'farming', 'row'];
  const zoneRep = {};
  for (const zone of ['residential', 'commercial', 'industrial', 'office']) {
    for (const density of ['low', 'medium', 'high']) {
      // Industry carries no density ladder -- every works is 'none' -- and the
      // spawner already treats its three buttons as one pool, so the icon does
      // the same rather than leaving that zone with no picture at all.
      const band = all.filter((a) => a.zone === zone && !a.signature
        && (a.density === density || a.density === 'none'));
      for (const theme of [null, ...THEMES]) {
        const pool = theme === null ? band : band.filter((a) => a.theme === theme);
        if (pool.length === 0) continue;
        // The median footprint: the typical one, not the runt or the outlier.
        const sorted = [...pool].sort((a, b) =>
          a.footprint[0] * a.footprint[1] - b.footprint[0] * b.footprint[1]);
        const pick = sorted[Math.floor(sorted.length / 2)];
        zoneRep[theme === null ? `${zone}|${density}` : `${zone}|${density}|${theme}`] = pick.id;
        if (!placeable.includes(pick)) placeable.push(pick);
      }
    }
  }
  const ASSETS = placeable;

  const idSeed = (id) => {
    let h = 2166136261;
    for (let i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 16777619); }
    return ((h >>> 8) % 100000) / 97.0;
  };

  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) return { error: 'no adapter' };
  const device = await adapter.requestDevice();
  const errors = [];
  device.addEventListener('uncapturederror', (e) => errors.push(e.error.message));

  const module = device.createShaderModule({ code: shader });
  const info = await module.getCompilationInfo();
  const diags = info.messages.filter((m) => m.type === 'error')
    .map((m) => `${m.lineNum}: ${m.message}`);
  if (diags.length) return { diags };

  const layout = device.createBindGroupLayout({ entries: [
    { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
    { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'depth' } },
    { binding: 2, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'comparison' } },
  ] });
  const protoLayout = device.createBindGroupLayout({ entries: [
    { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
      buffer: { type: 'read-only-storage' } },
  ] });
  const protoBuf = device.createBuffer({ size: 96, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
  const protoData = new Float32Array(24);
  const protoBg = device.createBindGroup({ layout: protoLayout,
    entries: [{ binding: 0, resource: { buffer: protoBuf } }] });
  const pipelineLayout = device.createPipelineLayout({ bindGroupLayouts: [layout, protoLayout] });
  const buffers = [{ arrayStride: 52, attributes: [
    { shaderLocation: 0, offset: 0, format: 'float32x3' },
    { shaderLocation: 1, offset: 12, format: 'float32x3' },
    { shaderLocation: 2, offset: 24, format: 'float32' },
    { shaderLocation: 3, offset: 28, format: 'float32' },
    { shaderLocation: 4, offset: 32, format: 'float32' },
    { shaderLocation: 5, offset: 36, format: 'float32x2' },
    { shaderLocation: 6, offset: 44, format: 'float32' },
    { shaderLocation: 7, offset: 48, format: 'float32' },
  ] }];

  const pipeline = device.createRenderPipeline({
    layout: pipelineLayout,
    vertex: { module, entryPoint: 'vs', buffers },
    fragment: { module, entryPoint: 'fs', targets: [{ format: 'rgba8unorm' }] },
    primitive: { topology: 'triangle-list', cullMode: 'back', frontFace: 'ccw' },
    depthStencil: { format: 'depth24plus', depthWriteEnabled: true, depthCompare: 'less' },
  });
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
  const sceneBuf = device.createBuffer({ size: 256, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  const shadowBg = device.createBindGroup({ layout: shadowLayout,
    entries: [{ binding: 0, resource: { buffer: sceneBuf } }] });
  const bg = device.createBindGroup({ layout, entries: [
    { binding: 0, resource: { buffer: sceneBuf } },
    { binding: 1, resource: shadowTex.createView() },
    { binding: 2, resource: device.createSampler({ compare: 'less' }) },
  ] });

  const colour = device.createTexture({ size: [TILE, TILE], format: 'rgba8unorm',
    usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC });
  const depth = device.createTexture({ size: [TILE, TILE], format: 'depth24plus',
    usage: GPUTextureUsage.RENDER_ATTACHMENT });
  const read = device.createBuffer({ size: TILE * 4 * TILE,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });

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
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
      o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1]
                   + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    }
    return o; };

  const sun = (() => { const v = [0.48, 0.68, 0.38]; const l = Math.hypot(...v); return v.map((x) => x / l); })();

  const sheet = document.createElement('canvas');
  const rows = Math.ceil(ASSETS.length / COLS);
  sheet.width = COLS * ICON; sheet.height = rows * ICON;
  const ctx = sheet.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  const index = {};

  for (let i = 0; i < ASSETS.length; i++) {
    const a = ASSETS[i];
    const mesh = a.build(0).build();
    let height = 0, radius = 1;
    for (let v = 0; v < mesh.vertices.length; v += 13) {
      height = Math.max(height, mesh.vertices[v + 1]);
      radius = Math.max(radius, Math.hypot(mesh.vertices[v], mesh.vertices[v + 2]));
    }

    // Framed from a three-quarter view high enough to read the roof, at a
    // distance taken from the subject's own extent so a water tower and an
    // airport both arrive at a workable size.
    const reach = Math.max(radius, height * 0.6);
    const dist = reach * 2.75 + 4;
    const target = [0, height * 0.42, 0];
    const yaw = 0.88, pitch = 0.42;
    const eye = [target[0] + dist * Math.cos(pitch) * Math.sin(yaw),
      target[1] + dist * Math.sin(pitch),
      target[2] + dist * Math.cos(pitch) * Math.cos(yaw)];
    const raw = mul(persp((38 * Math.PI) / 180, 1, 0.2, 4000), look(eye, target, [0, 1, 0]));

    // Then fitted exactly, by projecting the mesh and scaling what comes back
    // to the edges of the tile.
    //
    // A distance worked out from a bounding sphere is a guess, and it was
    // wrong in both directions: a long low warehouse sat in the middle of the
    // tile at half size because its diagonal is its radius, and a slender
    // tower left two-thirds of the tile empty on either side. This measures
    // what the camera is actually going to see and fills the frame with it.
    //
    // The fit ignores the apron -- the paving, verges and trees the asset
    // builds around itself below knee height. Including it framed the lot
    // rather than the building, which is why every icon had a grey slab across
    // it and the building sitting small and high above the slab. Letting the
    // apron run off the bottom edge is what makes the building the subject.
    const SKIRT = 1.2;
    const fit = (skirted) => {
      let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity, seen = 0;
      for (let v = 0; v < mesh.vertices.length; v += 13) {
        const y = mesh.vertices[v + 1];
        if (skirted && y < SKIRT) continue;
        const x = mesh.vertices[v], z = mesh.vertices[v + 2];
        const cw = raw[3] * x + raw[7] * y + raw[11] * z + raw[15];
        if (cw <= 0.0001) continue;
        const cx = (raw[0] * x + raw[4] * y + raw[8] * z + raw[12]) / cw;
        const cy = (raw[1] * x + raw[5] * y + raw[9] * z + raw[13]) / cw;
        u0 = Math.min(u0, cx); u1 = Math.max(u1, cx);
        v0 = Math.min(v0, cy); v1 = Math.max(v1, cy);
        seen++;
      }
      return seen > 8 ? { u0, u1, v0, v1 } : null;
    };
    // Falls back to the whole mesh for anything that is all apron -- a plaza,
    // a car park, a tree -- where there is no building to prefer.
    const box = fit(true) ?? fit(false);
    const viewProj = raw.slice();
    if (box !== null) {
      const MARGIN = 0.94;
      const su = (2 * MARGIN) / Math.max(box.u1 - box.u0, 1e-4);
      const sv = (2 * MARGIN) / Math.max(box.v1 - box.v0, 1e-4);
      // One scale for both axes: the aspect is the subject's and squashing it
      // to the tile would make every building the same shape.
      const k = Math.min(su, sv, 6);
      const cu = (box.u0 + box.u1) / 2, cv = (box.v0 + box.v1) / 2;
      // Post-multiply a 2D scale-about-centre onto the clip-space result,
      // which is the same as moving and zooming the camera but exact.
      for (let c = 0; c < 4; c++) {
        const x = raw[c * 4], y = raw[c * 4 + 1], w = raw[c * 4 + 3];
        viewProj[c * 4] = (x - cu * w) * k;
        viewProj[c * 4 + 1] = (y - cv * w) * k;
      }
    }

    const extent = Math.max(radius * 1.7, height * 0.9, 8);
    const centre = [0, height * 0.5, 0];
    const sunEye = [centre[0] + sun[0] * extent * 2.6, centre[1] + sun[1] * extent * 2.6,
      centre[2] + sun[2] * extent * 2.6];
    const sunViewProj = mul(ortho(-extent, extent, -extent, extent, 0.5, extent * 6),
      look(sunEye, centre, [0, 1, 0]));

    const scene = new Float32Array(64);   // 256 bytes: the last vec4 is the weather, left at zero for a clear day
    scene.set(viewProj, 0);
    scene.set(sunViewProj, 16);
    scene.set([eye[0], eye[1], eye[2], 0], 32);
    scene.set([sun[0], sun[1], sun[2], 0], 36);
    scene.set([0, 1 / SHADOW, Math.max(height, radius) * 4.5 + 20, 0], 40);
    device.queue.writeBuffer(sceneBuf, 0, scene);

    protoData.fill(0);
    protoData[3] = idSeed(a.id);
    protoData.set([1, 1, 1], 4);
    const brand = a.brand ?? { colour: [0.42, 0.44, 0.47], accent: [0.30, 0.32, 0.35] };
    protoData.set([brand.colour[0], brand.colour[1], brand.colour[2], 1], 8);
    protoData.set([brand.accent[0], brand.accent[1], brand.accent[2], 1], 12);
    const name = ((a.brand && a.brand.name) || '').toUpperCase().slice(0, 16);
    const words = new Uint32Array(protoData.buffer, 16 * 4, 4);
    words.fill(0);
    for (let k = 0; k < name.length; k++) words[k >> 2] |= (name.charCodeAt(k) & 255) << ((k % 4) * 8);
    protoData[20] = name.length;
    device.queue.writeBuffer(protoBuf, 0, protoData);

    const vb = device.createBuffer({ size: mesh.vertices.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
    device.queue.writeBuffer(vb, 0, mesh.vertices);
    const ib = device.createBuffer({ size: mesh.indices.byteLength,
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST });
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

    // No ground plane and a transparent clear, so the icon is a cutout of the
    // building rather than a photograph of a grey square. Everything the
    // shader draws writes alpha 1; everything it does not stays at 0.
    const pass = enc.beginRenderPass({
      colorAttachments: [{ view: colour.createView(),
        clearValue: { r: 0, g: 0, b: 0, a: 0 }, loadOp: 'clear', storeOp: 'store' }],
      depthStencilAttachment: { view: depth.createView(),
        depthClearValue: 1, depthLoadOp: 'clear', depthStoreOp: 'store' },
    });
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bg);
    pass.setBindGroup(1, protoBg);
    pass.setVertexBuffer(0, vb);
    pass.setIndexBuffer(ib, 'uint32');
    pass.drawIndexed(mesh.indices.length);
    pass.end();

    enc.copyTextureToBuffer({ texture: colour }, { buffer: read, bytesPerRow: TILE * 4 }, [TILE, TILE]);
    device.queue.submit([enc.finish()]);
    await read.mapAsync(GPUMapMode.READ);
    const px = new Uint8ClampedArray(read.getMappedRange().slice(0));
    read.unmap();
    vb.destroy(); ib.destroy();

    // Downsampled through a bitmap rather than by putImageData at the small
    // size, which would point-sample and serrate every roofline.
    const bmp = await createImageBitmap(new ImageData(px, TILE, TILE),
      { resizeWidth: ICON, resizeHeight: ICON, resizeQuality: 'high' });
    ctx.drawImage(bmp, (i % COLS) * ICON, Math.floor(i / COLS) * ICON);
    bmp.close();
    index[a.id] = i;
  }

  return { png: sheet.toDataURL('image/png'), index, zoneRep,
    count: ASSETS.length, rows, errors, diags };
}, { shader, registry, TILE, ICON, COLS, SHADOW });

if (result.error || result.diags?.length) {
  console.error('FAIL', result.error ?? result.diags.join('; '));
  process.exitCode = 1;
} else {
  const base64 = result.png.split(',')[1];
  const entries = Object.entries(result.index)
    .map(([id, i]) => `  '${id}': ${i},`).join('\n');
  const zoneEntries = Object.entries(result.zoneRep)
    .map(([k, id]) => `  '${k}': '${id}',`).join('\n');
  fs.writeFileSync(OUT, `/**
 * The toolbar's icons: every placeable building, photographed.
 *
 * Generated -- do not edit. Run \`node tools/icon-sheet.mjs\` after changing
 * an asset's geometry or its brand.
 *
 * One sheet rather than ${result.count} images, and a data URI rather than a
 * file, because the toolbar has to come up with the page and a sprite that
 * arrives over ${result.count} requests flickers in one by one.
 */

/** Pixels per icon in the sheet. */
export const ICON_SIZE = ${ICON};
export const ICON_COLS = ${COLS};
export const ICON_ROWS = ${result.rows};

/** Which cell of the sheet each asset is in, left to right, top to bottom. */
export const ICON_INDEX: Record<string, number> = {
${entries}
};

/** The building that stands for each \`zone|density\`, for the zoning buttons. */
export const ICON_ZONE: Record<string, string> = {
${zoneEntries}
};

export const ICON_SHEET = 'data:image/png;base64,${base64}';
`);
  const kb = (base64.length * 0.75 / 1024).toFixed(0);
  console.log(`wrote ${OUT}: ${result.count} icons, ${COLS}x${result.rows} sheet, ${kb} KiB`);
  if (result.errors.length) console.error('uncaptured:', result.errors.join('; '));
}

await browser.close();
server.close();
