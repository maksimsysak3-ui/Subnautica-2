/**
 * The asset viewer: one building at a time, lit the way the game lights it.
 *
 * Separate page, same device layer, same facade shader. A viewer with its own
 * renderer is worse than no viewer, because it tells you an asset looks fine
 * in conditions the game will never reproduce.
 *
 * What it is for: comparing the two approaches at the same footprint. The
 * shaded variants are near-bare massing with everything drawn by the facade
 * shader; the sculpted ones model the same features as geometry. Flipping
 * between them at the same zoom is the only honest way to decide which is
 * worth building a library out of.
 */

import { Gpu, GpuInitError } from './gfx/device';
import { THEMES, THEME_ORDER, ALL_THEMES } from './assets/themes';
import type { Theme } from './assets/themes';
import { ASSETS } from './assets/registry';
import type { AssetDef } from './assets/types';
import { DEFAULT_BRAND, idSeed } from './assets/types';
import { FLOATS_PER_VERTEX } from './assets/mesh';
import { mat4, lookAt, perspective, ortho, multiply, clamp } from './math/m4';
import type { Vec3 } from './math/m4';
import { log, mountConsole } from './util/log';
import { BRANCH_STYLE, paletteFor, zoneIcon } from './ui/zones';
import type { Category } from './ui/zones';
import { BRANCHES } from './assets/types';
import shaderSrc from './gfx/shaders/asset.wgsl?raw';

const DEPTH: GPUTextureFormat = 'depth24plus';
// depth24plus rather than depth32float: comparison sampling of a 32-bit depth
// texture is the less-travelled path and Safari is the browser most likely to
// balk at it. The extra precision buys nothing at these distances.
const SHADOW_FORMAT: GPUTextureFormat = 'depth24plus';
const SHADOW_SIZE = 1024;
/** viewProj + sunViewProj + eye + sunDir + params + brand + accent + sign */
const SCENE_SIZE = 240;

/** Sun direction, shared by the shadow pass and the shading. */
const SUN: Vec3 = (() => {
  const v: Vec3 = [0.48, 0.68, 0.38];
  const l = Math.hypot(...v);
  return [v[0] / l, v[1] / l, v[2] / l];
})();

interface Drawable {
  vertices: GPUBuffer;
  indices: GPUBuffer;
  indexCount: number;
  edges: GPUBuffer;
  edgeCount: number;
  bounds: { height: number; radius: number };
  triangles: number;
}

class Viewer {
  private pipeline!: GPURenderPipeline;
  private wirePipeline!: GPURenderPipeline;
  private shadowPipeline!: GPURenderPipeline;
  private shadowBindGroup!: GPUBindGroup;
  private sceneBuffer!: GPUBuffer;
  private bindGroup!: GPUBindGroup;
  private depth: GPUTexture | null = null;
  private depthView!: GPUTextureView;
  private shadowView!: GPUTextureView;
  private ground!: { vertices: GPUBuffer; indices: GPUBuffer; count: number };
  private current: Drawable | null = null;
  /** False while the device is being rebuilt after a loss. */
  private alive = true;
  /**
   * Shadows off with ?noshadow. A bisect switch: if the buildings appear with
   * shadows off, the shadow pipeline is the problem; if they do not, it is
   * something else. One reload instead of a conversation.
   */
  private shadows = true;
  private dummyShadow: GPUTextureView | null = null;
  /** Live counters for the readout. Cheap, and the reason this got diagnosed. */
  readonly debug = { frames: 0, indices: 0, height: 0, radius: 0, distance: 0, error: '' };

  private yaw = Math.PI * 0.75;
  private pitch = 0.36;
  private distance = 30;
  private spin = true;
  private wireframe = false;
  private lod = 0;
  private asset: AssetDef = ASSETS[0];

  private view = mat4();
  private proj = mat4();
  private viewProj = mat4();
  private sunView = mat4();
  private sunProj = mat4();
  private sunViewProj = mat4();
  private sceneData = new Float32Array(SCENE_SIZE / 4);
  private groundRadius = 60;

  constructor(private gpu: Gpu, shadows = true) {
    this.shadows = shadows;
    this.buildPipelines();
    this.buildGround();
    this.resizeDepth();
    gpu.onResize(() => this.resizeDepth());
    this.hookInput();
  }

  private buildPipelines(): void {
    const { device, format } = this.gpu;
    const module = device.createShaderModule({ label: 'asset', code: shaderSrc });

    const shadow = device.createTexture({
      label: 'shadow-map',
      size: { width: SHADOW_SIZE, height: SHADOW_SIZE },
      format: SHADOW_FORMAT,
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    });
    this.shadowView = shadow.createView();

    // A 1x1 stand-in, cleared to "nothing occludes", used when shadows are off
    // so the shader can keep sampling unconditionally.
    const dummy = device.createTexture({
      label: 'shadow-off',
      size: { width: 1, height: 1 },
      format: SHADOW_FORMAT,
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    });
    this.dummyShadow = dummy.createView();
    const clear = device.createCommandEncoder();
    clear.beginRenderPass({
      colorAttachments: [],
      depthStencilAttachment: {
        view: this.dummyShadow, depthClearValue: 1,
        depthLoadOp: 'clear', depthStoreOp: 'store',
      },
    }).end();
    device.queue.submit([clear.finish()]);

    const layout = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'depth' } },
        { binding: 2, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'comparison' } },
      ],
    });
    const pipelineLayout = device.createPipelineLayout({ bindGroupLayouts: [layout] });
    const buffers: GPUVertexBufferLayout[] = [{
      arrayStride: FLOATS_PER_VERTEX * 4,
      attributes: [
        { shaderLocation: 0, offset: 0, format: 'float32x3' },   // position
        { shaderLocation: 1, offset: 12, format: 'float32x3' },  // normal
        { shaderLocation: 2, offset: 24, format: 'float32' },    // material
        { shaderLocation: 3, offset: 28, format: 'float32' },    // baked occlusion
        { shaderLocation: 4, offset: 32, format: 'float32' },    // tint palette index
        { shaderLocation: 5, offset: 36, format: 'float32x2' },  // surface coordinates
        { shaderLocation: 6, offset: 44, format: 'float32' },    // part key
      ],
    }];

    this.pipeline = device.createRenderPipeline({
      label: 'asset-solid', layout: pipelineLayout,
      vertex: { module, entryPoint: 'vs', buffers },
      fragment: { module, entryPoint: 'fs', targets: [{ format }] },
      primitive: { topology: 'triangle-list', cullMode: 'back', frontFace: 'ccw' },
      depthStencil: { format: DEPTH, depthWriteEnabled: true, depthCompare: 'less' },
    });

    this.wirePipeline = device.createRenderPipeline({
      label: 'asset-wire', layout: pipelineLayout,
      vertex: { module, entryPoint: 'vs', buffers },
      fragment: { module, entryPoint: 'fs_wire', targets: [{ format }] },
      primitive: { topology: 'line-list' },
      // Depth test but no write, and drawn after the solid pass, so the
      // wireframe sits on the surface instead of z-fighting with it.
      depthStencil: { format: DEPTH, depthWriteEnabled: false, depthCompare: 'less-equal' },
    });

    // The shadow pass must not bind the shadow map it is writing into --
    // sampling a texture while rendering to it is a usage conflict, and in
    // practice it takes the device down rather than raising a tidy error. So
    // the depth pass gets its own layout carrying only the uniform, which is
    // all vs_shadow touches.
    const shadowLayout = device.createBindGroupLayout({
      entries: [{ binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: 'uniform' } }],
    });
    const shadowPipelineLayout = device.createPipelineLayout({ bindGroupLayouts: [shadowLayout] });

    // Depth-only pass from the sun. Front-face culling rather than back:
    // shadow acne appears on lit surfaces, and casting from the far side of
    // each object moves the error into geometry the camera cannot see.
    this.shadowPipeline = device.createRenderPipeline({
      label: 'asset-shadow', layout: shadowPipelineLayout,
      vertex: { module, entryPoint: 'vs_shadow', buffers },
      primitive: { topology: 'triangle-list', cullMode: 'front', frontFace: 'ccw' },
      depthStencil: { format: SHADOW_FORMAT, depthWriteEnabled: true, depthCompare: 'less' },
    });

    this.sceneBuffer = device.createBuffer({
      size: SCENE_SIZE,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    this.shadowBindGroup = device.createBindGroup({
      layout: shadowLayout,
      entries: [{ binding: 0, resource: { buffer: this.sceneBuffer } }],
    });
    this.bindGroup = device.createBindGroup({
      layout,
      entries: [
        { binding: 0, resource: { buffer: this.sceneBuffer } },
        { binding: 1, resource: this.shadows ? this.shadowView : (this.dummyShadow ?? this.shadowView) },
        { binding: 2, resource: device.createSampler({ compare: 'less' }) },
      ],
    });
  }

  /** A single large quad for the asset to stand on and cast onto. */
  private buildGround(): void {
    const { device } = this.gpu;
    const r = 400;
    const v = new Float32Array([
      -r, 0, -r, 0, 1, 0, 8, 1, 0, 0, 0,
       r, 0, -r, 0, 1, 0, 8, 1, 0, 0, 0,
       r, 0,  r, 0, 1, 0, 8, 1, 0, 0, 0,
      -r, 0,  r, 0, 1, 0, 8, 1, 0, 0, 0,
    ]);
    const i = new Uint32Array([0, 2, 1, 0, 3, 2]);
    const vertices = device.createBuffer({ size: v.byteLength, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
    device.queue.writeBuffer(vertices, 0, v);
    const indices = device.createBuffer({ size: i.byteLength, usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST });
    device.queue.writeBuffer(indices, 0, i);
    this.ground = { vertices, indices, count: i.length };
  }

  private resizeDepth(): void {
    const v = this.gpu.viewport;
    this.depth?.destroy();
    this.depth = this.gpu.device.createTexture({
      size: { width: v.width, height: v.height },
      format: DEPTH,
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });
    this.depthView = this.depth.createView();
  }

  private hookInput(): void {
    const canvas = this.gpu.canvas;
    let dragging = false;
    let lx = 0, ly = 0;
    canvas.addEventListener('pointerdown', (e) => {
      dragging = true; lx = e.clientX; ly = e.clientY;
      canvas.setPointerCapture(e.pointerId);
      this.spin = false;
      document.getElementById('spin')?.classList.remove('on');
    });
    canvas.addEventListener('pointerup', (e) => {
      dragging = false;
      if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      this.yaw -= (e.clientX - lx) * 0.007;
      this.pitch = clamp(this.pitch + (e.clientY - ly) * 0.005, -0.15, 1.35);
      lx = e.clientX; ly = e.clientY;
    });
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.distance = clamp(this.distance * Math.exp(e.deltaY * 0.0012), 4, 400);
    }, { passive: false });
  }

  select(asset: AssetDef, lod = this.lod): void {
    this.asset = asset;
    this.lod = lod;
    const mesh = asset.build(lod).build();
    const { device } = this.gpu;

    this.current?.vertices.destroy();
    this.current?.indices.destroy();
    this.current?.edges.destroy();

    const vertices = device.createBuffer({
      size: Math.max(mesh.vertices.byteLength, 4),
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(vertices, 0, mesh.vertices);

    const indices = device.createBuffer({
      size: Math.max(mesh.indices.byteLength, 4),
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(indices, 0, mesh.indices);

    // WebGPU has no polygon-fill mode, so the wireframe is a real line-list:
    // three segments per triangle, built once per selection.
    const edges = new Uint32Array(mesh.indices.length * 2);
    for (let t = 0; t < mesh.indices.length; t += 3) {
      const a = mesh.indices[t], b = mesh.indices[t + 1], c = mesh.indices[t + 2];
      const o = t * 2;
      edges[o] = a; edges[o + 1] = b;
      edges[o + 2] = b; edges[o + 3] = c;
      edges[o + 4] = c; edges[o + 5] = a;
    }
    const edgeBuffer = device.createBuffer({
      size: Math.max(edges.byteLength, 4),
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(edgeBuffer, 0, edges);

    let height = 0;
    let radius = 1;
    for (let i = 0; i < mesh.vertices.length; i += FLOATS_PER_VERTEX) {
      height = Math.max(height, mesh.vertices[i + 1]);
      radius = Math.max(radius, Math.hypot(mesh.vertices[i], mesh.vertices[i + 2]));
    }

    this.current = {
      vertices, indices, indexCount: mesh.indices.length,
      edges: edgeBuffer, edgeCount: edges.length,
      bounds: { height, radius }, triangles: mesh.indices.length / 3,
    };

    // Frame the asset: far enough back that it fits, whatever its size.
    this.distance = Math.max(height * 1.5, radius * 3.4, 12);
    this.groundRadius = Math.max(height, radius) * 4.5 + 20;
    renderInfo(asset, this.current.triangles, lod);
    highlight(asset.id);
  }

  setLod(lod: number): void { this.select(this.asset, lod); }
  toggleWire(): boolean { this.wireframe = !this.wireframe; return this.wireframe; }
  toggleSpin(): boolean { this.spin = !this.spin; return this.spin; }

  /**
   * Rebuilds everything on a recovered device. Every GPU object made from the
   * old device is dead, so this is a full reconstruction, not a patch-up.
   */
  rebuild(): void {
    this.current = null;
    this.buildPipelines();
    this.buildGround();
    this.resizeDepth();
    this.select(this.asset, this.lod);
    this.alive = true;
  }

  suspend(): void { this.alive = false; }

  frame(dt: number): void {
    if (!this.alive) return;
    if (this.spin) this.yaw += dt * 0.4;
    const v = this.gpu.viewport;
    this.render(this.gpu.context.getCurrentTexture().createView(), this.depthView, v.width, v.height);
  }

  /**
   * Renders one frame to an offscreen texture and returns it as a PNG data
   * URL.
   *
   * Exists because a WebGPU canvas does not screenshot reliably from outside
   * the page -- the drawing buffer is gone by the time a screenshot is taken.
   * Rendering to a texture we own and copying it back is the same pipeline,
   * the same shaders and the same shadow map, so the contact sheet shows what
   * the viewer shows rather than a second renderer's opinion of it.
   */
  async capture(width: number, height: number): Promise<string> {
    if (!this.alive) return '';
    const { device } = this.gpu;
    // 256-byte row alignment is a hard requirement of copyTextureToBuffer.
    const w = Math.ceil(width / 64) * 64;
    const colour = device.createTexture({
      size: { width: w, height },
      format: this.gpu.format,
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
    });
    const depth = device.createTexture({
      size: { width: w, height },
      format: DEPTH,
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });

    this.render(colour.createView(), depth.createView(), w, height);

    const bytesPerRow = w * 4;
    const read = device.createBuffer({
      size: bytesPerRow * height,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });
    const enc = device.createCommandEncoder();
    enc.copyTextureToBuffer({ texture: colour }, { buffer: read, bytesPerRow }, [w, height]);
    device.queue.submit([enc.finish()]);
    await read.mapAsync(GPUMapMode.READ);
    const px = new Uint8ClampedArray(read.getMappedRange().slice(0));
    read.unmap();
    read.destroy();
    colour.destroy();
    depth.destroy();

    // The canvas format is bgra8unorm on most machines; ImageData wants RGBA.
    if (this.gpu.format.startsWith('bgra')) {
      for (let i = 0; i < px.length; i += 4) {
        const b = px[i];
        px[i] = px[i + 2];
        px[i + 2] = b;
      }
    }
    const cv = document.createElement('canvas');
    cv.width = width;
    cv.height = height;
    const ctx = cv.getContext('2d');
    if (!ctx) return '';
    ctx.putImageData(new ImageData(px, w, height), 0, 0);
    return cv.toDataURL('image/png');
  }

  private render(colourView: GPUTextureView, depthView: GPUTextureView, width: number, height: number): void {
    const cur = this.current;
    if (!cur || !this.alive) return;

    const { device } = this.gpu;
    const viewport = { width, height };
    const target: Vec3 = [0, cur.bounds.height * 0.45, 0];
    const cp = Math.cos(this.pitch);
    const eye: Vec3 = [
      target[0] + this.distance * cp * Math.sin(this.yaw),
      target[1] + this.distance * Math.sin(this.pitch) + cur.bounds.height * 0.12,
      target[2] + this.distance * cp * Math.cos(this.yaw),
    ];

    lookAt(this.view, eye, target, [0, 1, 0]);
    perspective(this.proj, (42 * Math.PI) / 180,
      viewport.width / Math.max(viewport.height, 1), 0.2, 2000);
    multiply(this.viewProj, this.proj, this.view);

    // Sun camera, fitted to the asset. Refitting per asset rather than using
    // one fixed volume keeps every texel of the shadow map on the building
    // instead of on empty ground.
    const extent = Math.max(cur.bounds.radius * 1.7, cur.bounds.height * 0.9, 8);
    const centre: Vec3 = [0, cur.bounds.height * 0.5, 0];
    const sunEye: Vec3 = [
      centre[0] + SUN[0] * extent * 2.6,
      centre[1] + SUN[1] * extent * 2.6,
      centre[2] + SUN[2] * extent * 2.6,
    ];
    lookAt(this.sunView, sunEye, centre, [0, 1, 0]);
    ortho(this.sunProj, -extent, extent, -extent, extent, 0.5, extent * 6);
    multiply(this.sunViewProj, this.sunProj, this.sunView);

    this.sceneData.set(this.viewProj, 0);
    this.sceneData.set(this.sunViewProj, 16);
    this.sceneData.set([eye[0], eye[1], eye[2], 0], 32);
    this.sceneData.set([SUN[0], SUN[1], SUN[2], 0], 36);
    // Seed from the asset id, so each asset's colours and window pattern are
    // its own but never change between frames.
    this.sceneData.set([idSeed(this.asset.id),
      1 / SHADOW_SIZE, this.groundRadius, 0], 40);
    const brand = this.asset.brand ?? DEFAULT_BRAND;
    this.sceneData.set([brand.colour[0], brand.colour[1], brand.colour[2], 1], 44);
    this.sceneData.set([brand.accent[0], brand.accent[1], brand.accent[2], 1], 48);
    // The name, four characters per 32-bit word, as the shader reads it.
    const name = (brand.name || '').toUpperCase().slice(0, 16);
    const words = new Uint32Array(4);
    for (let i = 0; i < name.length; i++) {
      words[i >> 2] |= (name.charCodeAt(i) & 255) << ((i % 4) * 8);
    }
    new Uint32Array(this.sceneData.buffer, 52 * 4, 4).set(words);
    this.sceneData.set([name.length, 0, 0, 0], 56);
    device.queue.writeBuffer(this.sceneBuffer, 0, this.sceneData);

    const encoder = device.createCommandEncoder();

    // Shadow pass: the asset only. The ground receives but does not cast.
    if (this.shadows) {
    const shadowPass = encoder.beginRenderPass({
      colorAttachments: [],
      depthStencilAttachment: {
        view: this.shadowView, depthClearValue: 1,
        depthLoadOp: 'clear', depthStoreOp: 'store',
      },
    });
    shadowPass.setPipeline(this.shadowPipeline);
    shadowPass.setBindGroup(0, this.shadowBindGroup);
    shadowPass.setVertexBuffer(0, cur.vertices);
    shadowPass.setIndexBuffer(cur.indices, 'uint32');
    shadowPass.drawIndexed(cur.indexCount);
    shadowPass.end();
    }

    const pass = encoder.beginRenderPass({
      colorAttachments: [{
        view: colourView,
        clearValue: { r: 0.043, g: 0.055, b: 0.075, a: 1 },
        loadOp: 'clear', storeOp: 'store',
      }],
      depthStencilAttachment: {
        view: depthView, depthClearValue: 1,
        depthLoadOp: 'clear', depthStoreOp: 'store',
      },
    });
    pass.setBindGroup(0, this.bindGroup);
    pass.setPipeline(this.pipeline);

    pass.setVertexBuffer(0, this.ground.vertices);
    pass.setIndexBuffer(this.ground.indices, 'uint32');
    pass.drawIndexed(this.ground.count);

    pass.setVertexBuffer(0, cur.vertices);
    pass.setIndexBuffer(cur.indices, 'uint32');
    pass.drawIndexed(cur.indexCount);

    if (this.wireframe) {
      pass.setPipeline(this.wirePipeline);
      pass.setVertexBuffer(0, cur.vertices);
      pass.setIndexBuffer(cur.edges, 'uint32');
      pass.drawIndexed(cur.edgeCount);
    }
    pass.end();
    device.queue.submit([encoder.finish()]);

    this.debug.frames++;
    this.debug.indices = cur.indexCount;
    this.debug.height = cur.bounds.height;
    this.debug.radius = cur.bounds.radius;
    this.debug.distance = this.distance;
  }
}

// ---- UI ----------------------------------------------------------------

/**
 * The zoned categories, split by theme.
 *
 * Every zoned building belongs to a regional theme, and the list is the place
 * that has to make that obvious -- otherwise a hundred and ninety prototypes
 * are one undifferentiated scroll. Residential also keeps its density split,
 * since that is the other axis the spawner picks on.
 */
const GROUPS: Array<[string, Category, string, (a: AssetDef) => boolean]> =
  (['residential', 'commercial', 'office', 'industrial'] as Category[]).flatMap((zone) =>
    (zone === 'residential' ? ALL_THEMES : THEME_ORDER).flatMap((theme) => {
      const T = THEMES[theme];
      const rows: Array<[string, Category, string, (a: AssetDef) => boolean]> = [];
      if (zone === 'residential') {
        for (const d of ['low', 'medium', 'high'] as const) {
          rows.push([`${T.label} · ${d} density`, zone, T.badge,
            (a) => a.zone === zone && a.theme === theme && a.density === d]);
        }
      } else {
        rows.push([`${T.label} ${zone}`, zone, T.badge,
          (a) => a.zone === zone && a.theme === theme]);
      }
      return rows;
    }));

/** Every category the bar offers, in the order it shows them. */
const CATEGORIES: Category[] = [
  'residential', 'commercial', 'office', 'industrial', ...BRANCHES,
];

/**
 * The fleet tab: vehicles and figures.
 *
 * Kept out of `Category` on purpose. These are not something the player paints
 * on the map, so they get no zone icon and no place in the game's toolbar --
 * they are a review tab, and the bar shows them as a word rather than a mark.
 */
const FLEET_TAB = 'fleet' as const;
/** Roads and bridges: the other review tab, and likewise not a zone. */
const ROAD_TAB = 'road' as const;
type Tab = Category | typeof FLEET_TAB | typeof ROAD_TAB;

/** Which assets belong to a tab. Zones go by zone, branches by branch. */
function inCategory(a: AssetDef, c: Tab): boolean {
  return a.zone === 'service' ? a.branch === c : a.zone === c;
}

/** The tab currently on show. Null means everything. */
let current: Tab | null = null;
/** Selected theme, or null for every theme. Independent of the category. */
let theme: Theme | null = null;

/**
 * The category bar: one button per zone and per service branch.
 *
 * This is the toolbar the game itself will have, so the viewer uses the same
 * one -- picking a category here filters the list to that category's
 * buildings, which is the only tractable way to browse a hundred-odd assets.
 * The button carries the category colour, so the bar doubles as the colour
 * code that the old legend used to spell out.
 */
function buildBar(onPick: (a: AssetDef) => void): void {
  const el = document.getElementById('legend');
  if (!el) return;
  const cell = (c: Tab | null, label: string, svg: string, n: number): string => {
    const plain = c === null || c === FLEET_TAB;
    const tone = plain ? { base: '#7c8798', deep: '#3d4655' } : paletteFor(c);
    return `<button class="cat" data-cat="${c ?? ''}" title="${label} (${n})"
      style="--c:${tone.base};--d:${tone.deep}">${svg}<span>${n}</span></button>`;
  };
  const fleetCount = ASSETS.filter((a) => a.zone === FLEET_TAB).length;
  const roadCount = ASSETS.filter((a) => a.zone === ROAD_TAB).length;
  el.innerHTML =
    cell(null, 'all', '', ASSETS.length) +
    CATEGORIES.map((c) => cell(c, paletteFor(c).label, zoneIcon(c, 26),
      ASSETS.filter((a) => inCategory(a, c)).length)).join('') +
    cell(FLEET_TAB, 'Vehicles and people', '', fleetCount) +
    cell(ROAD_TAB, 'Roads and bridges', zoneIcon('road', 26), roadCount);
  // The iconless tabs are words: "all" is not a zone, and neither vehicles nor
  // roads are something you paint on the map, so neither gets a zone badge.
  const tiles = el.querySelectorAll('.cat');
  tiles[0].innerHTML = `<span class="allx">all</span><span>${ASSETS.length}</span>`;
  tiles[tiles.length - 2].innerHTML =
    `<span class="allx">cars</span><span>${fleetCount}</span>`;

  for (const b of el.querySelectorAll('.cat')) {
    b.addEventListener('click', () => {
      const v = (b as HTMLElement).dataset.cat ?? '';
      current = v === '' ? null : (v as Tab);
      for (const o of el.querySelectorAll('.cat')) o.classList.remove('on');
      b.classList.add('on');
      buildList(onPick);
    });
  }
  (el.querySelector('.cat') as HTMLElement | null)?.classList.add('on');
}

/**
 * The theme row: the library's second axis.
 *
 * Zone and theme are independent -- there are European shops and modern shops
 * -- so one bar cannot express both, and picking a zone on its own left six
 * themes stacked in a single scroll with no way to get at one of them. These
 * filter across whatever category is selected.
 */
function buildThemes(onPick: (a: AssetDef) => void): void {
  const el = document.getElementById('themes');
  if (!el) return;
  const chip = (t: Theme | null, label: string, n: number): string =>
    `<button class="th${t === null ? ' on' : ''}" data-theme="${t ?? ''}" title="${label} (${n})">${label}</button>`;
  el.innerHTML = chip(null, 'ALL', ASSETS.length)
    + ALL_THEMES.map((t) => chip(t, THEMES[t].badge,
      ASSETS.filter((a) => a.theme === t).length)).join('');
  for (const b of el.querySelectorAll('.th')) {
    b.addEventListener('click', () => {
      const v = (b as HTMLElement).dataset.theme ?? '';
      theme = v === '' ? null : (v as Theme);
      for (const o of el.querySelectorAll('.th')) o.classList.remove('on');
      b.classList.add('on');
      buildList(onPick);
    });
  }
}

function highlight(id: string): void {
  for (const el of document.querySelectorAll('.item')) {
    el.classList.toggle('on', (el as HTMLElement).dataset.id === id);
  }
}

function renderInfo(a: AssetDef, tris: number, lod: number): void {
  const el = document.getElementById('info');
  if (!el) return;
  const counts = [0, 1, 2].map((l) => a.build(l).triangleCount);
  const row = (k: string, v: string): string =>
    `<div class="row"><span>${k}</span><b>${v}</b></div>`;
  const sim = a.sim;
  el.innerHTML =
    row('variant', a.variant) +
    row('footprint', `${a.footprint[0]}×${a.footprint[1]} cells · ${a.footprint[0] * 8}×${a.footprint[1] * 8} m`) +
    row('height', `${a.height.toFixed(1)} m`) +
    row(`triangles (LOD ${lod})`, tris.toLocaleString()) +
    row('LOD ladder', counts.map((c) => c.toLocaleString()).join(' → ')) +
    (sim.households ? row('households', String(sim.households)) : '') +
    (sim.jobs ? row('jobs', String(sim.jobs)) : '') +
    row('power', `${sim.powerKW} kW`) +
    row('upkeep', `${sim.upkeep}/wk`) +
    `<div class="note">${a.note}</div>`;
}

function buildList(onPick: (a: AssetDef) => void): void {
  const list = document.getElementById('list');
  if (!list) return;
  list.innerHTML = '';

  // Zone groups keep their density split; service branches are one group each,
  // since nine branches of two or three is already the right granularity.
  const groups: Array<[string, Tab, string, (a: AssetDef) => boolean]> = [
    ...GROUPS,
    ...BRANCHES.map((b) => [
      BRANCH_STYLE[b].label.toLowerCase(), b as Tab, '',
      (a: AssetDef) => a.zone === 'service' && a.branch === b,
    ] as [string, Tab, string, (a: AssetDef) => boolean]),
    ['vehicles and people', FLEET_TAB, '', (a: AssetDef) => a.zone === FLEET_TAB],
    ['roads and bridges', ROAD_TAB, '', (a: AssetDef) => a.zone === ROAD_TAB],
  ];

  for (const [label, cat, badge, match] of groups) {
    if (current !== null && cat !== current) continue;
    const assets = ASSETS.filter((a) => match(a) && (theme === null || a.theme === theme));
    if (!assets.length) continue;
    const h = document.createElement('div');
    h.className = 'group';
    const mark = cat === FLEET_TAB ? '' : zoneIcon(cat, 16);
    const chip = badge === '' ? '' : `<span class="badge">${badge}</span>`;
    h.innerHTML = `${mark}${chip}<span>${label} (${assets.length})</span>`;
    list.appendChild(h);
    for (const a of assets) {
      const el = document.createElement('div');
      el.className = 'item';
      el.dataset.id = a.id;
      const tag = a.theme === undefined ? '' : `<span class="badge">${THEMES[a.theme].badge}</span>`;
      el.innerHTML = `<div class="n">${a.name}</div><div class="m">${tag}${a.variant} · ${
        a.build(0).triangleCount.toLocaleString()} tris</div>`;
      el.addEventListener('click', () => onPick(a));
      list.appendChild(el);
    }
  }
}

// ---- boot --------------------------------------------------------------

/**
 * Puts an error on screen.
 *
 * The viewer shipped without this and the first thing it did on someone else's
 * machine was render black, with nothing to go on. A page that can fail
 * silently will.
 */
function fail(title: string, detail: string): void {
  const stage = document.getElementById('stage') ?? document.body;
  let el = document.getElementById('fatal');
  if (!el) {
    el = document.createElement('div');
    el.id = 'fatal';
    stage.appendChild(el);
  }
  el.innerHTML =
    `<div style="font-size:15px;margin-bottom:12px">${title}</div>` +
    `<div style="color:#5d6b80;font-size:11px;white-space:pre-wrap;max-width:60ch;` +
    `text-align:left;line-height:1.7">${detail.replace(/[<>&]/g, '')}</div>` +
    `<div style="color:#5d6b80;font-size:11px;margin-top:14px">press \` for the log</div>`;
  log.error('viewer', `${title} — ${detail}`);
}

// Tells the watchdog in asset.html that the bundle actually executed.
declare global {
  interface Window { __viewerBooted?: boolean }
}
window.__viewerBooted = true;

async function boot(): Promise<void> {
  const canvas = document.getElementById('gpu-canvas');
  if (!(canvas instanceof HTMLCanvasElement)) return;

  const stage = document.getElementById('stage');
  if (stage) mountConsole(stage);

  addEventListener('error', (e) => fail('Something broke', `${e.message} @ ${e.filename}:${e.lineno}`));
  addEventListener('unhandledrejection', (e) => fail('Something broke', String(e.reason)));

  // The browsing UI is built before the device is asked for. A machine with
  // no WebGPU still gets the library -- names, counts, categories -- instead
  // of an error page and nothing else.
  let onPick: (a: AssetDef) => void = () => {};
  buildBar((a) => onPick(a));
  buildThemes((a) => onPick(a));
  buildList((a) => onPick(a));

  let gpu: Gpu;
  try {
    gpu = await Gpu.create(canvas);
  } catch (err) {
    if (err instanceof GpuInitError) {
      fail('This browser has no usable WebGPU',
        `${err.kind}: ${err.message}\n\nChrome or Edge 113+, Safari 18+, or Firefox 141+ on Windows.`);
    } else {
      fail('Could not start the GPU', String(err));
    }
    return;
  }

  // Anything the device rejects lands here rather than vanishing into the
  // console, which is what "the viewer is black" looked like from outside.
  gpu.device.addEventListener('uncapturederror', (e) => {
    fail('The GPU rejected something', (e as GPUUncapturedErrorEvent).error.message);
  });

  // WebGPU reports validation failures asynchronously, so a try/catch around
  // pipeline creation catches nothing. An error scope is the only way to find
  // out that a pipeline was rejected -- and a rejected pipeline draws exactly
  // as much as a working one does on a black canvas.
  const query = new URLSearchParams(location.search);

  gpu.device.pushErrorScope('validation');
  let viewer: Viewer;
  try {
    viewer = new Viewer(gpu, !query.has('noshadow'));
  } catch (err) {
    void gpu.device.popErrorScope();
    fail('Could not build the render pipelines', String(err));
    return;
  }
  const buildError = await gpu.device.popErrorScope();
  if (buildError) {
    fail('The GPU rejected a pipeline', buildError.message);
    return;
  }

  // The viewer is left open for long stretches while assets are compared, so
  // it needs the same device-loss recovery the game has -- and under a
  // software rasteriser it needs it constantly.
  let recovering = false;
  gpu.onLost(async () => {
    if (recovering) return;
    recovering = true;
    viewer.suspend();
    try {
      await gpu.recover();
      viewer.rebuild();
      log.info('viewer', 'device recovered');
    } catch (err) {
      log.error('viewer', `recovery failed: ${String(err)}`);
    }
    recovering = false;
  });

  onPick = (a) => viewer.select(a);

  // URL parameters, so the contact-sheet tool can drive this page rather than
  // reimplementing the renderer. A second renderer is worse than no tool: it
  // tells you an asset looks fine under conditions the game never reproduces.
  const q = query;
  const wanted = ASSETS.find((a) => a.id === q.get('asset')) ?? ASSETS[0];
  const wantedLod = Number(q.get('lod') ?? 0);
  if (q.get('spin') === '0') viewer.toggleSpin();
  if (q.get('hud') === '0') {
    for (const id of ['side', 'bar', 'info', 'hint']) document.getElementById(id)?.remove();
    document.getElementById('app')?.style.setProperty('grid-template-columns', '1fr');
  }
  try {
    viewer.select(wanted, wantedLod);
  } catch (err) {
    fail('Could not build that asset', String(err));
    return;
  }

  Object.defineProperty(window, 'viewer', {
    value: {
      show(id: string, lod: number): boolean {
        const a = ASSETS.find((x) => x.id === id);
        if (!a) return false;
        viewer.select(a, lod);
        return true;
      },
      ids: ASSETS.map((a) => a.id),
      capture: (w: number, h: number) => viewer.capture(w, h),
      alive: (): boolean => !recovering,
    },
  });

  for (const btn of document.querySelectorAll('[data-lod]')) {
    btn.addEventListener('click', () => {
      for (const b of document.querySelectorAll('[data-lod]')) b.classList.remove('on');
      btn.classList.add('on');
      viewer.setLod(Number((btn as HTMLElement).dataset.lod));
    });
  }
  document.getElementById('wire')?.addEventListener('click', (e) => {
    (e.currentTarget as HTMLElement).classList.toggle('on', viewer.toggleWire());
  });
  document.getElementById('spin')?.addEventListener('click', (e) => {
    (e.currentTarget as HTMLElement).classList.toggle('on', viewer.toggleSpin());
  });

  let last = performance.now();
  let frames = 0;
  const tick = (now: number): void => {
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    try {
      viewer.frame(dt);
      frames++;
    } catch (err) {
      fail('The render loop threw', String(err));
      return;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  // If nothing has drawn after a couple of seconds, say so rather than sitting
  // on a black canvas.
  setTimeout(() => {
    if (frames === 0) fail('Nothing rendered', 'The render loop never completed a frame.');
  }, 2500);

  // Always-on readout. Small, and the difference between "it is blank" and a
  // diagnosis: if frames climb and indices are non-zero, the geometry is being
  // submitted and the problem is the camera or the pipeline, not the asset.
  if (q.get('hud') !== '0') {
    const el = document.createElement('div');
    el.style.cssText = [
      'position:absolute', 'left:14px', 'bottom:34px', 'color:#5d6b80',
      'font:11px/1.6 var(--mono)', 'pointer-events:none', 'white-space:pre',
    ].join(';');
    document.getElementById('stage')?.appendChild(el);
    setInterval(() => {
      const d = viewer.debug;
      const c = gpu.canvas;
      el.textContent =
        `frames ${d.frames}   tris ${(d.indices / 3) | 0}   ` +
        `size ${d.height.toFixed(1)}m r${d.radius.toFixed(1)}   ` +
        `cam ${d.distance.toFixed(0)}m\n` +
        `canvas ${c.width}x${c.height}   ${gpu.format}   ` +
        `shadows ${query.has('noshadow') ? 'off' : 'on'}`;
    }, 400);
  }
  log.info('viewer', `${ASSETS.length} assets`);
}

void boot();
