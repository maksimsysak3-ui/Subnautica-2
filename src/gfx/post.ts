/**
 * The post chain: the frame after the city has been drawn into it.
 *
 * Everything the renderer draws now lands in a floating point target instead of
 * the swapchain. That one change is what makes the rest possible: an eight bit
 * buffer clips at white, so a lit sign at dusk, the sun off a glass tower and a
 * bright overcast sky are all exactly the same colour by the time they reach
 * the screen, and nothing downstream can tell them apart. In float they stay
 * apart, and the bloom below is taken from the part that is genuinely brighter
 * than the display -- so the city lights up at night and the effect is nowhere
 * to be seen at noon, without a single frame of it being faked.
 *
 * Four passes, in order:
 *
 *   1. bright, at half resolution, with a soft knee
 *   2. blur across
 *   3. blur down
 *   4. composite: antialias the scene, add the bloom, grade, and write out
 *
 * The blur runs on a quarter of the pixels, which is the difference between an
 * effect that costs a fifth of a millisecond and one that costs two.
 */

import type { Gpu, Viewport } from './device';
import { SHADERS } from './shaders';

/** What the scene is drawn into. Float, because the whole point is >1. */
export const SCENE_FORMAT: GPUTextureFormat = 'rgba16float';

/** Floats in the post uniform: texel(4) + tune(4) + mood(4). */
const POST_FLOATS = 12;

/** How far down the bloom chain runs from the scene's own size. */
const BLOOM_DIV = 2;

export interface PostTune {
  /** How much of the blurred bright pass is added back. */
  strength: number;
  /** Where the bright pass starts, in tonemapped units. */
  threshold: number;
  exposure: number;
  vignette: number;
  /** 0 at noon, 1 after dark. Warms the grade and opens the bloom up. */
  night: number;
  /** Whether to antialias the composite. */
  antialias: boolean;
}

export class Post {
  private readonly device: GPUDevice;
  private readonly layout: GPUBindGroupLayout;
  private readonly compositeLayout: GPUBindGroupLayout;
  private readonly sampler: GPUSampler;
  private readonly uniform: GPUBuffer;
  private readonly data = new Float32Array(POST_FLOATS);
  private readonly bright: GPURenderPipeline;
  private readonly blurH: GPURenderPipeline;
  private readonly blurV: GPURenderPipeline;
  private readonly show: GPURenderPipeline;

  private scene!: GPUTexture;
  private sceneView!: GPUTextureView;
  private a!: GPUTexture;
  private b!: GPUTexture;
  private aView!: GPUTextureView;
  private bView!: GPUTextureView;
  private brightGroup!: GPUBindGroup;
  private acrossGroup!: GPUBindGroup;
  private downGroup!: GPUBindGroup;
  private showGroup!: GPUBindGroup;
  private size = { width: 0, height: 0 };

  constructor(gpu: Gpu, v: Viewport) {
    const device = gpu.device;
    this.device = device;

    this.layout = device.createBindGroupLayout({
      label: 'post-bgl',
      entries: [
        { binding: 0, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
        { binding: 2, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
      ],
    });
    this.compositeLayout = device.createBindGroupLayout({
      label: 'post-composite-bgl',
      entries: [
        { binding: 0, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
        { binding: 2, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
        { binding: 3, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
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
    const stage = (entryPoint: string, format: GPUTextureFormat, bgl: GPUBindGroupLayout) =>
      device.createRenderPipeline({
        label: `post-${entryPoint}`,
        layout: device.createPipelineLayout({ bindGroupLayouts: [bgl] }),
        vertex: { module, entryPoint: 'vs' },
        fragment: { module, entryPoint, targets: [{ format }] },
        primitive: { topology: 'triangle-list' },
      });

    this.bright = stage('brightPass', SCENE_FORMAT, this.layout);
    this.blurH = stage('blurH', SCENE_FORMAT, this.layout);
    this.blurV = stage('blurV', SCENE_FORMAT, this.layout);
    this.show = stage('composite', gpu.format, this.compositeLayout);

    this.resize(v);
  }

  /** The view the renderer's main pass draws into. */
  get target(): GPUTextureView { return this.sceneView; }

  resize(v: Viewport): void {
    const width = Math.max(1, v.width), height = Math.max(1, v.height);
    if (this.size.width === width && this.size.height === height) return;
    this.size = { width, height };
    this.scene?.destroy();
    this.a?.destroy();
    this.b?.destroy();

    const device = this.device;
    this.scene = device.createTexture({
      label: 'scene-hdr',
      size: { width, height },
      format: SCENE_FORMAT,
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    });
    this.sceneView = this.scene.createView();

    const bw = Math.max(1, Math.floor(width / BLOOM_DIV));
    const bh = Math.max(1, Math.floor(height / BLOOM_DIV));
    const half = (label: string) => device.createTexture({
      label, size: { width: bw, height: bh }, format: SCENE_FORMAT,
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    });
    this.a = half('bloom-a');
    this.b = half('bloom-b');
    this.aView = this.a.createView();
    this.bView = this.b.createView();

    const bind = (label: string, texture: GPUTextureView) => device.createBindGroup({
      label, layout: this.layout,
      entries: [
        { binding: 0, resource: this.sampler },
        { binding: 1, resource: texture },
        { binding: 2, resource: { buffer: this.uniform } },
      ],
    });
    this.brightGroup = bind('post-bright', this.sceneView);
    this.acrossGroup = bind('post-across', this.aView);
    this.downGroup = bind('post-down', this.bView);
    this.showGroup = device.createBindGroup({
      label: 'post-show', layout: this.compositeLayout,
      entries: [
        { binding: 0, resource: this.sampler },
        { binding: 1, resource: this.sceneView },
        { binding: 2, resource: { buffer: this.uniform } },
        { binding: 3, resource: this.aView },
      ],
    });

    // The scene texel is what the bright pass and the antialiasing step by; the
    // bloom texel is what the blur steps by. Both live in the same uniform
    // because every pass in the chain binds the same one.
    this.data[0] = 1 / width;
    this.data[1] = 1 / height;
    this.data[2] = 1 / bw;
    this.data[3] = 1 / bh;
  }

  /**
   * Encodes the chain. `target` is the swapchain view for this frame.
   *
   * Called after the main pass has ended, on the same encoder, so the whole
   * frame is still one submit.
   */
  encode(encoder: GPUCommandEncoder, target: GPUTextureView, tune: PostTune): void {
    this.data[4] = tune.strength;
    this.data[5] = tune.threshold;
    this.data[6] = tune.exposure;
    this.data[7] = tune.vignette;
    this.data[8] = tune.night;
    this.data[11] = tune.antialias ? 1 : 0;
    this.device.queue.writeBuffer(this.uniform, 0, this.data);

    const draw = (
      label: string, view: GPUTextureView,
      pipeline: GPURenderPipeline, group: GPUBindGroup,
    ) => {
      const pass = encoder.beginRenderPass({
        label,
        colorAttachments: [{
          view, clearValue: { r: 0, g: 0, b: 0, a: 1 }, loadOp: 'clear', storeOp: 'store',
        }],
      });
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, group);
      pass.draw(3);
      pass.end();
    };

    // Bloom is skipped outright when it would add nothing: a clear noon frame
    // spends three passes on a texture it then multiplies by zero.
    if (tune.strength > 0.002) {
      draw('post-bright', this.aView, this.bright, this.brightGroup);
      draw('post-blur-h', this.bView, this.blurH, this.acrossGroup);
      draw('post-blur-v', this.aView, this.blurV, this.downGroup);
    }
    draw('post-composite', target, this.show, this.showGroup);
  }

  destroy(): void {
    this.scene?.destroy();
    this.a?.destroy();
    this.b?.destroy();
    this.uniform.destroy();
  }
}
