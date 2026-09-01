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
import { GpuProfiler } from './profiler';
import {
  makeCity, INSTANCE_FLOATS, buildTerrain, heightAt,
  FLOATS_PER_VERTEX, INDICES_PER_CHUNK, TERRAIN,
} from '../sim';
import type { Chunk } from '../sim';
import commonSrc from './shaders/common.wgsl?raw';
import cullSrc from './shaders/cull.wgsl?raw';
import terrainSrc from './shaders/terrain.wgsl?raw';
import boxSrc from './shaders/box.wgsl?raw';

const DEPTH_FORMAT: GPUTextureFormat = 'depth24plus';

/** mat4 viewProj (64) + eye (16) + params (16) + six frustum planes (96). */
const CAMERA_UNIFORM_SIZE = 192;

/** Vertices per instance at each level of detail. Must match box.wgsl. */
const SOLID_VERTS = 30;
const IMPOSTOR_VERTS = 6;

/** Beyond this many metres a building is drawn as a billboard, not a box. */
const LOD_SPLIT = 700;

/** Vertical field of view, shared with the camera. */
const FOV_Y = (50 * Math.PI) / 180;

/** Two DrawArgs structs of four u32 each. */
const DRAW_ARGS_SIZE = 32;

/** The whole preprocessor: one directive, resolved at load. */
function resolve(src: string): string {
  return src.replace(/^[ \t]*#include\s+"common\.wgsl"[ \t]*$/m, commonSrc);
}

interface Resources {
  terrain: GPURenderPipeline;
  solid: GPURenderPipeline;
  impostor: GPURenderPipeline;
  cull: GPUComputePipeline;
  cameraBuffer: GPUBuffer;
  cameraGroup: GPUBindGroup;
  vertexBuffer: GPUBuffer;
  indexBuffer: GPUBuffer;
  chunks: Chunk[];
  instanceBuffer: GPUBuffer;
  nearListBuffer: GPUBuffer;
  farListBuffer: GPUBuffer;
  drawArgsBuffer: GPUBuffer;
  drawArgsReadBuffer: GPUBuffer;
  cullGroup: GPUBindGroup;
  nearGroup: GPUBindGroup;
  farGroup: GPUBindGroup;
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
  private profiler: GpuProfiler | null = null;
  /** Reset pattern for the indirect draw args: counts back to zero. */
  private argsReset = new Uint32Array([SOLID_VERTS, 0, 0, 0, IMPOSTOR_VERTS, 0, 0, 0]);
  /** Last known [near, far] instance counts, read back asynchronously. */
  private drawnCounts: [number, number] = [0, 0];
  private countsPending = false;

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
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT | GPUShaderStage.COMPUTE,
        buffer: { type: 'uniform' },
      }],
    });
    // Drawing reads the instance table and the visible-index list the culling
    // pass produced; both read-only.
    const instanceLayout = device.createBindGroupLayout({
      label: 'instance-bgl',
      entries: [
        { binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } },
        { binding: 1, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } },
      ],
    });
    // Culling writes both lists and both sets of draw args.
    const cullLayout = device.createBindGroupLayout({
      label: 'cull-bgl',
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
        { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
        { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
      ],
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
    const boxPipelineLayout = device.createPipelineLayout({
      bindGroupLayouts: [cameraLayout, instanceLayout],
    });
    const boxPipeline = (entryPoint: string, label: string): GPURenderPipeline =>
      device.createRenderPipeline({
        label,
        layout: boxPipelineLayout,
        vertex: { module: boxModule, entryPoint },
        fragment: { module: boxModule, entryPoint: 'fs', targets: [{ format }] },
        // Back-face culling stays off until the meshes are real ones with
        // checked winding; a wrong guess costs invisible faces, and the
        // impostor quad must be visible from both sides regardless.
        primitive: { topology: 'triangle-list', cullMode: 'none' },
        depthStencil,
      });
    const solid = boxPipeline('vs_solid', 'box-solid-pipeline');
    const impostor = boxPipeline('vs_impostor', 'box-impostor-pipeline');

    const cull = device.createComputePipeline({
      label: 'cull-pipeline',
      layout: device.createPipelineLayout({ bindGroupLayouts: [cameraLayout, cullLayout] }),
      compute: {
        module: device.createShaderModule({ label: 'cull', code: resolve(cullSrc) }),
        entryPoint: 'main',
      },
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

    // Worst case every building lands in one list, so each is sized for all of
    // them. 4 bytes per index is cheap next to 48 bytes per instance.
    const listSize = Math.max(city.count, 1) * 4;
    const nearListBuffer = device.createBuffer({
      label: 'visible-near', size: listSize, usage: GPUBufferUsage.STORAGE,
    });
    const farListBuffer = device.createBuffer({
      label: 'visible-far', size: listSize, usage: GPUBufferUsage.STORAGE,
    });
    const drawArgsBuffer = device.createBuffer({
      label: 'draw-args',
      size: DRAW_ARGS_SIZE,
      usage: GPUBufferUsage.INDIRECT | GPUBufferUsage.STORAGE
           | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
    });
    // Read back purely so the overlay can show how many buildings survived
    // culling. Nothing in the frame depends on it, so the read stays async and
    // a frame or two stale.
    const drawArgsReadBuffer = device.createBuffer({
      label: 'draw-args-read',
      size: DRAW_ARGS_SIZE,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });

    const cullGroup = device.createBindGroup({
      label: 'cull-bg',
      layout: cullLayout,
      entries: [
        { binding: 0, resource: { buffer: instanceBuffer } },
        { binding: 1, resource: { buffer: nearListBuffer } },
        { binding: 2, resource: { buffer: farListBuffer } },
        { binding: 3, resource: { buffer: drawArgsBuffer } },
      ],
    });
    const listGroup = (list: GPUBuffer, label: string): GPUBindGroup =>
      device.createBindGroup({
        label, layout: instanceLayout,
        entries: [
          { binding: 0, resource: { buffer: instanceBuffer } },
          { binding: 1, resource: { buffer: list } },
        ],
      });
    const nearGroup = listGroup(nearListBuffer, 'near-bg');
    const farGroup = listGroup(farListBuffer, 'far-bg');

    const { depth, depthView } = this.createDepth(this.gpu.viewport);

    this.profiler ??= new GpuProfiler(device, ['cull', 'draw']);

    this.res = {
      terrain, solid, impostor, cull, cameraBuffer, cameraGroup,
      vertexBuffer, indexBuffer, chunks: mesh.chunks,
      instanceBuffer, nearListBuffer, farListBuffer, drawArgsBuffer, drawArgsReadBuffer,
      cullGroup, nearGroup, farGroup, depth, depthView,
      instanceCount: city.count,
    };

    this.unsubscribeResize?.();
    this.unsubscribeResize = this.gpu.onResize((v) => this.onResize(v));
    this.camera.groundHeight = heightAt;
    // Keep the focus inside the terrain, whatever size it was built at.
    this.camera.extent = TERRAIN.size * 0.5 - TERRAIN.chunk;
    this.camera.setViewport(this.gpu.viewport.width, this.gpu.viewport.height);
    this.camera.update();

    const kib = (city.count * INSTANCE_FLOATS * 4) / 1024;
    const mib = mesh.vertices.byteLength / 1024 / 1024;
    log.info('render', `terrain ${mesh.chunks.length} chunks (${mib.toFixed(1)} MiB), ` +
      `${city.count.toLocaleString()} instances (${(kib / 1024).toFixed(1)} MiB), depth ${DEPTH_FORMAT}`);
    log.info('render', this.profiler.enabled
      ? 'GPU timing available (timestamp-query)'
      : 'no timestamp-query: GPU times will read 0');
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
    this.cameraData[22] = LOD_SPLIT;
    // Converts metres-at-a-distance into pixels, so the culling pass can drop
    // anything too small to resolve.
    this.cameraData[23] = viewport.height / (2 * Math.tan(FOV_Y / 2));

    // The same six planes the CPU uses for terrain chunks, handed to the
    // culling pass so both agree by construction rather than by coincidence.
    this.frustum.update(cam.viewProjMatrix);
    this.cameraData.set(this.frustum.planes, 24);
    device.queue.writeBuffer(res.cameraBuffer, 0, this.cameraData);

    // Counts back to zero before the culling pass appends to them.
    device.queue.writeBuffer(res.drawArgsBuffer, 0, this.argsReset);

    const drawWrites = this.profiler?.writes('draw');
    const encoder = device.createCommandEncoder({ label: 'frame' });

    // Visibility and LOD for every building, on the GPU. At this instance
    // count, culling on the CPU would mean walking 100k structs in JavaScript
    // every frame and uploading the survivors -- megabytes of traffic to save
    // a draw call.
    const cullWrites = this.profiler?.writes('cull');
    const cullPass = encoder.beginComputePass(
      cullWrites ? { label: 'cull', timestampWrites: cullWrites } : { label: 'cull' },
    );
    cullPass.setPipeline(res.cull);
    cullPass.setBindGroup(0, res.cameraGroup);
    cullPass.setBindGroup(1, res.cullGroup);
    cullPass.dispatchWorkgroups(Math.ceil(res.instanceCount / 64));
    cullPass.end();

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
      ...(drawWrites ? { timestampWrites: drawWrites } : {}),
    });

    pass.setBindGroup(0, res.cameraGroup);

    // Terrain, one draw per visible chunk. Culling here is what keeps the draw
    // count flat as the map grows past the view.
    pass.setPipeline(res.terrain);
    pass.setVertexBuffer(0, res.vertexBuffer);
    pass.setIndexBuffer(res.indexBuffer, 'uint32');
    let drawn = 0;
    for (const chunk of res.chunks) {
      if (!this.frustum.containsBox(chunk.min, chunk.max)) continue;
      pass.drawIndexed(INDICES_PER_CHUNK, 1, 0, chunk.baseVertex);
      drawn++;
    }

    // Two indirect draws. The CPU never learns how many buildings survived
    // culling, and never stalls to find out.
    pass.setPipeline(res.solid);
    pass.setBindGroup(1, res.nearGroup);
    pass.drawIndirect(res.drawArgsBuffer, 0);

    pass.setPipeline(res.impostor);
    pass.setBindGroup(1, res.farGroup);
    pass.drawIndirect(res.drawArgsBuffer, 16);

    pass.end();

    if (!this.countsPending) {
      encoder.copyBufferToBuffer(res.drawArgsBuffer, 0, res.drawArgsReadBuffer, 0, DRAW_ARGS_SIZE);
    }
    this.profiler?.resolve(encoder);
    device.queue.submit([encoder.finish()]);
    this.profiler?.poll();
    this.readDrawnCounts(res.drawArgsReadBuffer);

    this.stats.sample(performance.now() - cpuStart);
    this.stats.set('draws', String(drawn + 2));
    this.stats.set('chunks', `${drawn}/${res.chunks.length}`);
    if (this.profiler?.enabled) {
      this.stats.set('gpu cull', this.profiler.ms('cull').toFixed(2));
      this.stats.set('gpu draw', this.profiler.ms('draw').toFixed(2));
    }
    const drawnBuildings = this.drawnCounts[0] + this.drawnCounts[1];
    this.stats.set('buildings', `${drawnBuildings.toLocaleString()}/${res.instanceCount.toLocaleString()}`);
    this.stats.set('solid·imp', `${this.drawnCounts[0]}·${this.drawnCounts[1]}`);
    this.stats.set('zoom', `${cam.distance.toFixed(0)}m`);
    this.stats.set('px', `${viewport.width}×${viewport.height}`);
    this.stats.paint(now);
  }

  private readDrawnCounts(buffer: GPUBuffer): void {
    if (this.countsPending) return;
    this.countsPending = true;
    buffer.mapAsync(GPUMapMode.READ).then(
      () => {
        const v = new Uint32Array(buffer.getMappedRange().slice(0));
        this.drawnCounts = [v[1], v[5]];
        buffer.unmap();
        this.countsPending = false;
      },
      () => { this.countsPending = false; },
    );
  }

  /** Total buildings in the world, drawn or not. */
  get buildingCount(): number {
    return this.res?.instanceCount ?? 0;
  }

  /** Most recent [near, far] survivor counts, for the benchmark. */
  get drawn(): readonly [number, number] {
    return this.drawnCounts;
  }

  /** Milliseconds the GPU spent in a named pass, or 0 without timestamp support. */
  gpuMs(scope: string): number {
    return this.profiler?.ms(scope) ?? 0;
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
    this.res.nearListBuffer.destroy();
    this.res.farListBuffer.destroy();
    this.res.drawArgsBuffer.destroy();
    this.res.drawArgsReadBuffer.destroy();
    this.res = null;
  }
}
