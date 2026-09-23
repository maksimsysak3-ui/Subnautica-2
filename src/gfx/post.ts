/**
 * The post chain: the camera the linear scene is photographed with.
 *
 * The main pass draws linear light into a float target. This turns that into
 * the picture: ambient occlusion from the depth buffer, a mip-chain bloom,
 * exposure, the ACES curve and the grade, then antialiasing on the encoded
 * result. See post.wgsl for what each pass does and why it is where it is.
 */

import type { Gpu, Viewport } from './device';
import { SHADERS } from './shaders';

/** What the scene is drawn into. Float, because the whole point is >1. */
export const SCENE_FORMAT: GPUTextureFormat = 'rgba16float';

/** Floats in the post uniform: texel, tune, mood, proj, look. */
const POST_FLOATS = 20;

/** Levels in the bloom chain, from half resolution down. */
const BLOOM_LEVELS = 6;

export interface PostTune {
  /** How much of the bloom chain is added back. */
  strength: number;
  /** Where bloom starts, in linear scene units after nothing but the lights. */
  threshold: number;
  exposure: number;
  vignette: number;
  /** 0 at noon, 1 after dark. Cools the shadows. */
  night: number;
  /** 1 while the sun is on the horizon. Warms the highlights. */
  golden: number;
  /** Cloud cover, 0 to 1. Flattens the split-tone. */
  overcast: number;
  /** Whether to antialias the final picture. */
  antialias: boolean;
  /** Screen-space occlusion strength; 0 skips the passes. */
  ao: number;
  saturation: number;
  contrast: number;
  /** The projection the depth buffer was written with. */
  near: number;
  far: number;
  tanX: number;
  tanY: number;
}

interface Level {
  texture: GPUTexture;
  view: GPUTextureView;
  /** The group that reads this level as `src`. */
  group: GPUBindGroup;
}

export class Post {
  private readonly device: GPUDevice;
  private readonly outFormat: GPUTextureFormat;
  private readonly base: GPUBindGroupLayout;
  private readonly depthLayout: GPUBindGroupLayout;
  private readonly compositeLayout: GPUBindGroupLayout;
  private readonly sampler: GPUSampler;
  private readonly uniform: GPUBuffer;
  private readonly data = new Float32Array(POST_FLOATS);

  private readonly aoPipe: GPURenderPipeline;
  private readonly aoH: GPURenderPipeline;
  private readonly aoV: GPURenderPipeline;
  private readonly downFirst: GPURenderPipeline;
  private readonly downPipe: GPURenderPipeline;
  private readonly upPipe: GPURenderPipeline;
  private readonly compositePipe: GPURenderPipeline;
  private readonly fxaaPipe: GPURenderPipeline;

  private scene!: GPUTexture;
  private sceneView!: GPUTextureView;
  private sceneGroup!: GPUBindGroup;
  private levels: Level[] = [];
  private aoA!: Level;
  private aoB!: Level;
  private ldr!: Level;
  private compositeGroup!: GPUBindGroup;
  private depthGroup: GPUBindGroup | null = null;
  private depthFor: GPUTextureView | null = null;
  private size = { width: 0, height: 0 };

  constructor(gpu: Gpu, v: Viewport) {
    const device = gpu.device;
    this.device = device;
    this.outFormat = gpu.format;

    this.base = device.createBindGroupLayout({
      label: 'post-bgl',
      entries: [
        { binding: 0, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
        { binding: 2, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
      ],
    });
    this.depthLayout = device.createBindGroupLayout({
      label: 'post-depth-bgl',
      entries: [
        { binding: 0, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'depth' } },
      ],
    });
    this.compositeLayout = device.createBindGroupLayout({
      label: 'post-composite-bgl',
      entries: [
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
        { binding: 2, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
      ],
    });

    this.sampler = device.createSampler({
      label: 'post-sampler',
      magFilter: 'linear', minFilter: 'linear',
      addressModeU: 'clamp-to-edge', addressModeV: 'clamp-to-edge',
    });
    this.uniform = device.createBuffer({
      label: 'post-uniform',
      size: POST_FLOATS * 4,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const module = device.createShaderModule({ label: 'post', code: SHADERS.post });
    const stage = (entryPoint: string, format: GPUTextureFormat,
      groups: GPUBindGroupLayout[], blend?: GPUBlendState) =>
      device.createRenderPipeline({
        label: `post-${entryPoint}`,
        layout: device.createPipelineLayout({ bindGroupLayouts: groups }),
        vertex: { module, entryPoint: 'vs' },
        fragment: { module, entryPoint, targets: [blend ? { format, blend } : { format }] },
        primitive: { topology: 'triangle-list' },
      });
    const add: GPUBlendState = {
      color: { srcFactor: 'one', dstFactor: 'one', operation: 'add' },
      alpha: { srcFactor: 'one', dstFactor: 'one', operation: 'add' },
    };

    this.aoPipe = stage('ao', 'r8unorm', [this.base, this.depthLayout]);
    this.aoH = stage('aoBlurH', 'r8unorm', [this.base, this.depthLayout]);
    this.aoV = stage('aoBlurV', 'r8unorm', [this.base, this.depthLayout]);
    this.downFirst = stage('downFirst', SCENE_FORMAT, [this.base]);
    this.downPipe = stage('down', SCENE_FORMAT, [this.base]);
    this.upPipe = stage('up', SCENE_FORMAT, [this.base], add);
    this.compositePipe = stage('composite', this.outFormat, [this.base, this.compositeLayout]);
    this.fxaaPipe = stage('fxaa', this.outFormat, [this.base]);

    this.resize(v);
  }

  /** The view the renderer's main pass draws into. */
  get target(): GPUTextureView { return this.sceneView; }

  private level(label: string, width: number, height: number,
    format: GPUTextureFormat): Level {
    const texture = this.device.createTexture({
      label, size: { width, height }, format,
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    });
    const view = texture.createView();
    return { texture, view, group: this.bindSrc(label, view) };
  }

  private bindSrc(label: string, view: GPUTextureView): GPUBindGroup {
    return this.device.createBindGroup({
      label, layout: this.base,
      entries: [
        { binding: 0, resource: this.sampler },
        { binding: 1, resource: view },
        { binding: 2, resource: { buffer: this.uniform } },
      ],
    });
  }

  resize(v: Viewport): void {
    const width = Math.max(1, v.width), height = Math.max(1, v.height);
    if (this.size.width === width && this.size.height === height) return;
    this.size = { width, height };
    this.release();

    const device = this.device;
    this.scene = device.createTexture({
      label: 'scene-hdr',
      size: { width, height },
      format: SCENE_FORMAT,
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    });
    this.sceneView = this.scene.createView();
    this.sceneGroup = this.bindSrc('post-scene', this.sceneView);

    this.levels = [];
    let w = width, h = height;
    for (let i = 0; i < BLOOM_LEVELS; i++) {
      w = Math.max(1, w >> 1);
      h = Math.max(1, h >> 1);
      this.levels.push(this.level(`bloom-${i}`, w, h, SCENE_FORMAT));
      if (w === 1 && h === 1) break;
    }
    const hw = Math.max(1, width >> 1), hh = Math.max(1, height >> 1);
    this.aoA = this.level('ao-a', hw, hh, 'r8unorm');
    this.aoB = this.level('ao-b', hw, hh, 'r8unorm');
    this.ldr = this.level('ldr', width, height, this.outFormat);

    this.compositeGroup = device.createBindGroup({
      label: 'post-composite', layout: this.compositeLayout,
      entries: [
        { binding: 1, resource: this.levels[0].view },
        { binding: 2, resource: this.aoA.view },
      ],
    });
    this.depthGroup = null;
    this.depthFor = null;

    this.data[0] = 1 / width;
    this.data[1] = 1 / height;
  }

  /**
   * Encodes the chain. `target` is the swapchain view for this frame and
   * `depth` the main pass's depth buffer, which must carry TEXTURE_BINDING.
   *
   * Called after the main pass has ended, on the same encoder, so the whole
   * frame is still one submit.
   */
  encode(encoder: GPUCommandEncoder, target: GPUTextureView, depth: GPUTextureView,
    tune: PostTune): void {
    const d = this.data;
    d[4] = tune.strength / this.levels.length;
    d[5] = tune.threshold;
    d[6] = tune.exposure;
    d[7] = tune.vignette;
    d[8] = tune.night;
    d[9] = tune.golden;
    d[10] = (performance.now() / 1000) % 1000;
    d[11] = tune.overcast;
    d[12] = tune.near;
    d[13] = tune.far;
    d[14] = tune.tanX;
    d[15] = tune.tanY;
    d[16] = tune.ao;
    d[17] = 1;
    d[18] = tune.saturation;
    d[19] = tune.contrast;
    this.device.queue.writeBuffer(this.uniform, 0, d);

    if (this.depthFor !== depth || this.depthGroup === null) {
      this.depthGroup = this.device.createBindGroup({
        label: 'post-depth', layout: this.depthLayout,
        entries: [{ binding: 0, resource: depth }],
      });
      this.depthFor = depth;
    }

    const draw = (label: string, view: GPUTextureView, pipeline: GPURenderPipeline,
      group: GPUBindGroup, second?: GPUBindGroup, load = false) => {
      const pass = encoder.beginRenderPass({
        label,
        colorAttachments: [{
          view, clearValue: { r: 0, g: 0, b: 0, a: 1 },
          loadOp: load ? 'load' : 'clear', storeOp: 'store',
        }],
      });
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, group);
      if (second) pass.setBindGroup(1, second);
      pass.draw(3);
      pass.end();
    };

    // Occlusion. Skipped outright when switched off: the composite reads the
    // texture only when the strength is above zero.
    if (tune.ao > 0.001) {
      draw('post-ao', this.aoA.view, this.aoPipe, this.sceneGroup, this.depthGroup);
      draw('post-ao-h', this.aoB.view, this.aoH, this.aoA.group, this.depthGroup);
      draw('post-ao-v', this.aoA.view, this.aoV, this.aoB.group, this.depthGroup);
    }

    // Bloom: down the chain, then back up it adding as it goes. Always run,
    // because the composite always reads level 0; a zero strength costs the
    // passes but keeps the picture from carrying last frame's glow.
    const L = this.levels;
    draw('post-down-0', L[0].view, this.downFirst, this.sceneGroup);
    for (let i = 1; i < L.length; i++) {
      draw(`post-down-${i}`, L[i].view, this.downPipe, L[i - 1].group);
    }
    for (let i = L.length - 1; i > 0; i--) {
      draw(`post-up-${i}`, L[i - 1].view, this.upPipe, L[i].group, undefined, true);
    }

    if (tune.antialias) {
      draw('post-composite', this.ldr.view, this.compositePipe, this.sceneGroup,
        this.compositeGroup);
      draw('post-fxaa', target, this.fxaaPipe, this.ldr.group);
    } else {
      draw('post-composite', target, this.compositePipe, this.sceneGroup, this.compositeGroup);
    }
  }

  private release(): void {
    this.scene?.destroy();
    for (const l of this.levels) l.texture.destroy();
    this.aoA?.texture.destroy();
    this.aoB?.texture.destroy();
    this.ldr?.texture.destroy();
  }

  destroy(): void {
    this.release();
    this.uniform.destroy();
  }
}
