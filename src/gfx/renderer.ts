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
import { Frustum } from './frustum';
import {
  makeCity, INSTANCE_FLOATS, buildTerrain, heightAt,
  FLOATS_PER_VERTEX, INDICES_PER_CHUNK, TERRAIN,
} from '../sim';
import type { Chunk } from '../sim';
import commonSrc from './shaders/common.wgsl?raw';
import terrainSrc from './shaders/terrain.wgsl?raw';
import boxSrc from './shaders/box.wgsl?raw';

const DEPTH_FORMAT: GPUTextureFormat = 'depth24plus';

/** mat4 viewProj (64) + eye vec4 (16) + params vec4 (16). */
const CAMERA_UNIFORM_SIZE = 96;

/** The whole preprocessor: one directive, resolved at load. */
function resolve(src: string): string {
  return src.replace(/^[ \t]*#include\s+"common\.wgsl"[ \t]*$/m, commonSrc);
}

interface Resources {
  terrain: GPURenderPipeline;
  boxes: GPURenderPipeline;
  cameraBuffer: GPUBuffer;
  cameraGroup: GPUBindGroup;
  vertexBuffer: GPUBuffer;
  indexBuffer: GPUBuffer;
  chunks: Chunk[];
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
  private frustum = new Frustum();

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

    const terrainModule = device.createShaderModule({ label: 'terrain', code: resolve(terrainSrc) });
    const terrain = device.createRenderPipeline({
      label: 'terrain-pipeline',
      layout: device.createPipelineLayout({ bindGroupLayouts: [cameraLayout] }),
      vertex: {
        module: terrainModule,
        entryPoint: 'vs',
        buffers: [{
          arrayStride: FLOATS_PER_VERTEX * 4,
          attributes: [
            { shaderLocation: 0, offset: 0, format: 'float32x3' },   // position
            { shaderLocation: 1, offset: 12, format: 'float32x3' },  // normal
          ],
        }],
      },
      fragment: { module: terrainModule, entryPoint: 'fs', targets: [{ format }] },
      primitive: { topology: 'triangle-list', cullMode: 'back', frontFace: 'ccw' },
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

    // Terrain: one vertex buffer and one index buffer for every chunk. Chunk
    // topology is identical, so each is drawn with its own baseVertex.
    const mesh = buildTerrain();
    const vertexBuffer = device.createBuffer({
      label: 'terrain-vertices',
      size: mesh.vertices.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(vertexBuffer, 0, mesh.vertices);
    const indexBuffer = device.createBuffer({
      label: 'terrain-indices',
      size: mesh.indices.byteLength,
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(indexBuffer, 0, mesh.indices);

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
      terrain, boxes, cameraBuffer, cameraGroup,
      vertexBuffer, indexBuffer, chunks: mesh.chunks,
      instanceBuffer, instanceGroup, depth, depthView,
      instanceCount: city.count,
    };

    this.unsubscribeResize?.();
    this.unsubscribeResize = this.gpu.onResize((v) => this.onResize(v));
    this.camera.groundHeight = heightAt;
    this.camera.setViewport(this.gpu.viewport.width, this.gpu.viewport.height);
    this.camera.update();

    const kib = (city.count * INSTANCE_FLOATS * 4) / 1024;
    const mib = mesh.vertices.byteLength / 1024 / 1024;
    log.info('render', `terrain ${mesh.chunks.length} chunks (${mib.toFixed(1)} MiB), ` +
      `${city.count} instances (${kib.toFixed(0)} KiB), depth ${DEPTH_FORMAT}`);
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
    this.cameraData[21] = TERRAIN.size * 0.5;
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

    // Terrain, one draw per visible chunk. Culling here is what keeps the draw
    // count flat as the map grows past the view.
    this.frustum.update(cam.viewProjMatrix);
    pass.setPipeline(res.terrain);
    pass.setVertexBuffer(0, res.vertexBuffer);
    pass.setIndexBuffer(res.indexBuffer, 'uint32');
    let drawn = 0;
    for (const chunk of res.chunks) {
      if (!this.frustum.containsBox(chunk.min, chunk.max)) continue;
      pass.drawIndexed(INDICES_PER_CHUNK, 1, 0, chunk.baseVertex);
      drawn++;
    }

    pass.setPipeline(res.boxes);
    pass.setBindGroup(1, res.instanceGroup);
    pass.draw(30, res.instanceCount);

    pass.end();
    device.queue.submit([encoder.finish()]);

    this.stats.sample(performance.now() - cpuStart);
    this.stats.set('draws', String(drawn + 1));
    this.stats.set('chunks', `${drawn}/${res.chunks.length}`);
    this.stats.set('instances', String(res.instanceCount));
    this.stats.set('tris', String(10 * res.instanceCount + drawn * (INDICES_PER_CHUNK / 3)));
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
    this.res.vertexBuffer.destroy();
    this.res.indexBuffer.destroy();
    this.res.instanceBuffer.destroy();
    this.res = null;
  }
}
