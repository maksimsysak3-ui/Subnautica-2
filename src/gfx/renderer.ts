/**
 * The frame loop and the one render pass everything will eventually go into.
 *
 * Two rules from planning/CITY-SIM-DESIGN.md that this file exists to enforce
 * from the very first commit:
 *   - pipelines are created once at load, never per frame
 *   - one beginRenderPass per frame, many draws inside it
 *
 * Everything GPU-owned lives in `resources`, so device loss recovery is
 * "throw that away and call build() again" rather than an archaeology dig.
 */

import { log } from '../util/log';
import type { Gpu, Viewport } from './device';
import type { Stats } from '../ui/stats';
import triShader from './shaders/tri.wgsl?raw';

const DEPTH_FORMAT: GPUTextureFormat = 'depth24plus';

/** Frame uniform: aspect, time, pad -> 16 bytes. */
const FRAME_UNIFORM_SIZE = 16;

/** Instance struct in tri.wgsl: vec2 + f32 + f32 + vec4 -> 32 bytes. */
const INSTANCE_SIZE = 32;

interface Resources {
  pipeline: GPURenderPipeline;
  bindGroup: GPUBindGroup;
  frameBuffer: GPUBuffer;
  instanceBuffer: GPUBuffer;
  depth: GPUTexture;
  depthView: GPUTextureView;
  instanceCount: number;
}

export class Renderer {
  private res: Resources | null = null;
  private frameData = new Float32Array(FRAME_UNIFORM_SIZE / 4);
  private raf = 0;
  private startedAt = 0;
  private lastFrame = 0;
  private frames = 0;
  private unsubscribeResize: (() => void) | null = null;
  private running = false;

  constructor(
    private gpu: Gpu,
    private stats: Stats,
  ) {}

  // ---- construction ---------------------------------------------------

  build(): void {
    const { device, format } = this.gpu;

    const module = device.createShaderModule({ label: 'tri', code: triShader });

    const layout = device.createBindGroupLayout({
      label: 'frame-bgl',
      entries: [
        { binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: 'uniform' } },
        {
          binding: 1,
          visibility: GPUShaderStage.VERTEX,
          buffer: { type: 'read-only-storage' },
        },
      ],
    });

    const pipeline = device.createRenderPipeline({
      label: 'tri-pipeline',
      layout: device.createPipelineLayout({ bindGroupLayouts: [layout] }),
      vertex: { module, entryPoint: 'vs' },
      fragment: { module, entryPoint: 'fs', targets: [{ format }] },
      primitive: { topology: 'triangle-list', cullMode: 'none' },
      depthStencil: {
        format: DEPTH_FORMAT,
        depthWriteEnabled: true,
        depthCompare: 'less',
      },
    });

    const frameBuffer = device.createBuffer({
      label: 'frame-uniform',
      size: FRAME_UNIFORM_SIZE,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    // Three overlapping instances. Submitted nearest-first, so if the depth
    // attachment were missing or misconfigured the far ones would paint over
    // the near one and the overlap would look obviously wrong.
    const instances = new Float32Array([
      //  offsetX  offsetY  depth  scale     r     g     b     a
      0.00, 0.00, 0.30, 1.00, 0.384, 0.831, 1.0, 1.0,
      -0.34, -0.12, 0.55, 0.85, 1.0, 0.706, 0.329, 1.0,
      0.34, -0.12, 0.80, 0.85, 0.494, 0.878, 0.627, 1.0,
    ]);
    const instanceCount = instances.byteLength / INSTANCE_SIZE;

    const instanceBuffer = device.createBuffer({
      label: 'instances',
      size: instances.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(instanceBuffer, 0, instances);

    const bindGroup = device.createBindGroup({
      label: 'frame-bg',
      layout,
      entries: [
        { binding: 0, resource: { buffer: frameBuffer } },
        { binding: 1, resource: { buffer: instanceBuffer } },
      ],
    });

    const { depth, depthView } = this.createDepth(this.gpu.viewport);

    this.res = { pipeline, bindGroup, frameBuffer, instanceBuffer, depth, depthView, instanceCount };

    this.unsubscribeResize?.();
    this.unsubscribeResize = this.gpu.onResize((v) => this.onResize(v));

    log.info('render', `pipeline built, ${instanceCount} instances, depth ${DEPTH_FORMAT}`);
  }

  private createDepth(v: Viewport): { depth: GPUTexture; depthView: GPUTextureView } {
    const depth = this.gpu.device.createTexture({
      label: 'depth',
      size: { width: v.width, height: v.height },
      format: DEPTH_FORMAT,
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });
    return { depth, depthView: depth.createView() };
  }

  private onResize(v: Viewport): void {
    if (!this.res) return;
    this.res.depth.destroy();
    const { depth, depthView } = this.createDepth(v);
    this.res.depth = depth;
    this.res.depthView = depthView;
  }

  // ---- frame loop -----------------------------------------------------

  start(): void {
    if (this.running) return;
    this.running = true;
    this.startedAt = performance.now();
    this.lastFrame = this.startedAt;
    const tick = (now: number) => {
      if (!this.running) return;
      this.raf = requestAnimationFrame(tick);
      this.frame(now);
    };
    this.raf = requestAnimationFrame(tick);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  private frame(now: number): void {
    const res = this.res;
    if (!res) return;

    const cpuStart = performance.now();
    const { device, context, viewport } = this.gpu;

    this.frameData[0] = viewport.width / Math.max(viewport.height, 1);
    this.frameData[1] = (now - this.startedAt) / 1000;
    device.queue.writeBuffer(res.frameBuffer, 0, this.frameData);

    const encoder = device.createCommandEncoder({ label: 'frame' });
    const pass = encoder.beginRenderPass({
      label: 'main',
      colorAttachments: [
        {
          view: context.getCurrentTexture().createView(),
          clearValue: { r: 0.043, g: 0.055, b: 0.075, a: 1 },
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
      depthStencilAttachment: {
        view: res.depthView,
        depthClearValue: 1.0,
        depthLoadOp: 'clear',
        depthStoreOp: 'store',
      },
    });

    pass.setPipeline(res.pipeline);
    pass.setBindGroup(0, res.bindGroup);
    pass.draw(3, res.instanceCount);
    pass.end();

    device.queue.submit([encoder.finish()]);

    this.frames++;
    this.stats.sample(performance.now() - cpuStart);
    this.stats.set('cpu frame', ((now - this.lastFrame)).toFixed(1));
    this.stats.set('draws', '1');
    this.stats.set('tris', String(res.instanceCount));
    this.stats.set('px', `${viewport.width}×${viewport.height}`);
    this.stats.paint(now);
    this.lastFrame = now;
  }

  /** Drops every GPU object. Used before rebuilding on a recovered device. */
  teardown(): void {
    this.stop();
    if (!this.res) return;
    this.res.depth.destroy();
    this.res.frameBuffer.destroy();
    this.res.instanceBuffer.destroy();
    this.res = null;
  }
}
