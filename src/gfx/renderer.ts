/**
 * The frame loop and the one render pass everything goes into.
 *
 * Rules this file exists to hold, from planning/CITY-SIM-DESIGN.md:
 *   - pipelines are created once at load, never per frame
 *   - one beginRenderPass per frame, many draws inside it
 *   - buildings are drawn instanced, one call per (prototype, LOD)
 *
 * Everything GPU-owned lives in `res`, so recovering from device loss is
 * "throw that away and call build() again".
 */

import { log } from '../util/log';
import type { Gpu, Viewport } from './device';
import type { Camera } from './camera';
import type { Stats } from '../ui/stats';
import { makeCity, INSTANCE_FLOATS } from '../sim/city';
import commonSrc from './shaders/common.wgsl?raw';
import groundSrc from './shaders/ground.wgsl?raw';
import boxSrc from './shaders/box.wgsl?raw';

const DEPTH_FORMAT: GPUTextureFormat = 'depth24plus';

/** mat4 viewProj (64) + eye vec4 (16) + params vec4 (16). */
const CAMERA_UNIFORM_SIZE = 96;

/** The whole preprocessor: one directive, resolved at load. */
function resolve(src: string): string {
  return src.replace(/^[ \t]*#include\s+"common\.wgsl"[ \t]*$/m, commonSrc);
}

interface Resources {
  ground: GPURenderPipeline;
  boxes: GPURenderPipeline;
  cameraBuffer: GPUBuffer;
  cameraGroup: GPUBindGroup;
  instanceBuffer: GPUBuffer;
  instanceGroup: GPUBindGroup;
  depth: GPUTexture;
  depthView: GPUTextureView;
  instanceCount: number;
}

export class Renderer {
  private res: Resources | null = null;
  private cameraData = new Float32Array(CAMERA_UNIFORM_SIZE / 4);
  private raf = 0;
  private startedAt = 0;
  private lastFrame = 0;
  private unsubscribeResize: (() => void) | null = null;
  private running = false;
  private onUpdate: ((dt: number) => void) | null = null;

  constructor(
    private gpu: Gpu,
    private camera: Camera,
    private stats: Stats,
  ) {}

  // ---- construction ---------------------------------------------------

  build(): void {
    const { device, format } = this.gpu;

    const cameraLayout = device.createBindGroupLayout({
      label: 'camera-bgl',
      entries: [{
        binding: 0,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        buffer: { type: 'uniform' },
      }],
    });
    const instanceLayout = device.createBindGroupLayout({
      label: 'instance-bgl',
      entries: [{
        binding: 0,
        visibility: GPUShaderStage.VERTEX,
        buffer: { type: 'read-only-storage' },
      }],
    });

    const depthStencil: GPUDepthStencilState = {
      format: DEPTH_FORMAT,
      depthWriteEnabled: true,
      depthCompare: 'less',
    };

    const groundModule = device.createShaderModule({ label: 'ground', code: resolve(groundSrc) });
    const ground = device.createRenderPipeline({
      label: 'ground-pipeline',
      layout: device.createPipelineLayout({ bindGroupLayouts: [cameraLayout] }),
      vertex: { module: groundModule, entryPoint: 'vs' },
      fragment: { module: groundModule, entryPoint: 'fs', targets: [{ format }] },
      primitive: { topology: 'triangle-list', cullMode: 'none' },
      depthStencil,
    });

    const boxModule = device.createShaderModule({ label: 'box', code: resolve(boxSrc) });
    const boxes = device.createRenderPipeline({
      label: 'box-pipeline',
      layout: device.createPipelineLayout({ bindGroupLayouts: [cameraLayout, instanceLayout] }),
      vertex: { module: boxModule, entryPoint: 'vs' },
      fragment: { module: boxModule, entryPoint: 'fs', targets: [{ format }] },
      // Culling stays off until the meshes are real ones with checked winding;
      // at these counts it buys nothing and a wrong guess costs invisible faces.
      primitive: { topology: 'triangle-list', cullMode: 'none' },
      depthStencil,
    });

    const cameraBuffer = device.createBuffer({
      label: 'camera-uniform',
      size: CAMERA_UNIFORM_SIZE,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    const cameraGroup = device.createBindGroup({
      label: 'camera-bg',
      layout: cameraLayout,
      entries: [{ binding: 0, resource: { buffer: cameraBuffer } }],
    });

    const city = makeCity();
    const instanceBuffer = device.createBuffer({
      label: 'box-instances',
      size: city.data.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(instanceBuffer, 0, city.data);
    const instanceGroup = device.createBindGroup({
      label: 'instance-bg',
      layout: instanceLayout,
      entries: [{ binding: 0, resource: { buffer: instanceBuffer } }],
    });

    const { depth, depthView } = this.createDepth(this.gpu.viewport);

    this.res = {
      ground, boxes, cameraBuffer, cameraGroup,
      instanceBuffer, instanceGroup, depth, depthView,
      instanceCount: city.count,
    };

    this.unsubscribeResize?.();
    this.unsubscribeResize = this.gpu.onResize((v) => this.onResize(v));
    this.camera.setViewport(this.gpu.viewport.width, this.gpu.viewport.height);
    this.camera.update();

    const kib = (city.count * INSTANCE_FLOATS * 4) / 1024;
    log.info('render', `${city.count} instances (${kib.toFixed(0)} KiB), 2 pipelines, depth ${DEPTH_FORMAT}`);
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
    this.camera.setViewport(v.width, v.height);
    this.camera.update();
    if (!this.res) return;
    this.res.depth.destroy();
    const { depth, depthView } = this.createDepth(v);
    this.res.depth = depth;
    this.res.depthView = depthView;
  }

  // ---- frame loop -----------------------------------------------------

  start(onUpdate?: (dt: number) => void): void {
    if (onUpdate) this.onUpdate = onUpdate;
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

    // Clamped so a backgrounded tab returning does not teleport the camera.
    const dt = Math.min((now - this.lastFrame) / 1000, 0.1);
    this.lastFrame = now;
    this.onUpdate?.(dt);

    const cpuStart = performance.now();
    const { device, context, viewport } = this.gpu;
    const cam = this.camera;

    this.cameraData.set(cam.viewProjMatrix, 0);
    this.cameraData[16] = cam.eye[0];
    this.cameraData[17] = cam.eye[1];
    this.cameraData[18] = cam.eye[2];
    this.cameraData[19] = cam.far;
    this.cameraData[20] = (now - this.startedAt) / 1000;
    this.cameraData[21] = GROUND_EXTENT;
    device.queue.writeBuffer(res.cameraBuffer, 0, this.cameraData);

    const encoder = device.createCommandEncoder({ label: 'frame' });
    const pass = encoder.beginRenderPass({
      label: 'main',
      colorAttachments: [{
        view: context.getCurrentTexture().createView(),
        clearValue: { r: 0.043, g: 0.055, b: 0.075, a: 1 },
        loadOp: 'clear',
        storeOp: 'store',
      }],
      depthStencilAttachment: {
        view: res.depthView,
        depthClearValue: 1.0,
        depthLoadOp: 'clear',
        depthStoreOp: 'store',
      },
    });

    pass.setBindGroup(0, res.cameraGroup);

    pass.setPipeline(res.ground);
    pass.draw(6);

    pass.setPipeline(res.boxes);
    pass.setBindGroup(1, res.instanceGroup);
    pass.draw(30, res.instanceCount);

    pass.end();
    device.queue.submit([encoder.finish()]);

    this.stats.sample(performance.now() - cpuStart);
    this.stats.set('draws', '2');
    this.stats.set('instances', String(res.instanceCount));
    this.stats.set('tris', String(10 * res.instanceCount + 2));
    this.stats.set('zoom', `${cam.distance.toFixed(0)}m`);
    this.stats.set('px', `${viewport.width}×${viewport.height}`);
    this.stats.paint(now);
  }

  /** Drops every GPU object, before rebuilding on a recovered device. */
  teardown(): void {
    this.stop();
    if (!this.res) return;
    this.res.depth.destroy();
    this.res.cameraBuffer.destroy();
    this.res.instanceBuffer.destroy();
    this.res = null;
  }
}

/** How far the ground plane reaches around the camera, and where fog ends. */
const GROUND_EXTENT = 2600;
