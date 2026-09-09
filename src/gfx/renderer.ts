/**
 * The frame loop and the one render pass everything goes into.
 *
 * Rules this file exists to hold, from planning/CITY-SIM-DESIGN.md:
 *   - pipelines are created once at load, never per frame
 *   - one beginRenderPass per frame, many draws inside it
 *   - buildings are drawn instanced, one call per (prototype, LOD)
 *
 * The third of those is now literally true. The city is no longer a hundred
 * thousand extruded rectangles: it is the asset library, placed by the
 * spawner, drawn out of one packed vertex arena with one indirect draw per
 * bucket. Which bucket a building lands in -- and whether it is drawn at all --
 * is decided on the GPU, so the count of draws is fixed at load and the count
 * of buildings in them is never read back to make a decision.
 *
 * Everything GPU-owned lives in `res`, so recovering from device loss is
 * "throw that away and call build() again".
 */

import { log } from '../util/log';
import type { Gpu, Viewport } from './device';
import type { Camera } from './camera';
import type { Stats } from '../ui/stats';
import { Frustum } from './frustum';
import { invert, mat4 } from '../math/m4';
import { GpuProfiler } from './profiler';
import { Atlas, VERTEX_BYTES } from './atlas';
import { planCity } from './city-draw';
import type { Bucket } from './city-draw';
import {
  makeCity, INSTANCE_FLOATS, buildTerrain, heightAt,
  FLOATS_PER_VERTEX, INDICES_PER_CHUNK, TERRAIN,
} from '../sim';
import type { Chunk } from '../sim';
import { SHADERS } from './shaders';

const DEPTH_FORMAT: GPUTextureFormat = 'depth24plus';

/**
 * viewProj (64) + its inverse (64) + eye (16) + sun (16) + params (16)
 * + six frustum planes (96).
 */
const CAMERA_UNIFORM_SIZE = 272;

/** viewProj + sunViewProj + eye + sunDir + params + brand + accent + sign. */
const SCENE_UNIFORM_SIZE = 240;

/** Vertical field of view, shared with the camera. */
const FOV_Y = (50 * Math.PI) / 180;

/**
 * Sun direction, the same one the asset viewer lights its subjects with, so a
 * building looks in the city like it looked in the viewer.
 */
const SUN = ((): [number, number, number] => {
  const v: [number, number, number] = [0.48, 0.68, 0.38];
  const l = Math.hypot(...v);
  return [v[0] / l, v[1] / l, v[2] / l];
})();

interface Resources {
  sky: GPURenderPipeline;
  terrain: GPURenderPipeline;
  city: GPURenderPipeline;
  cull: GPUComputePipeline;
  cameraBuffer: GPUBuffer;
  cameraGroup: GPUBindGroup;
  sceneBuffer: GPUBuffer;
  sceneGroup: GPUBindGroup;
  protoGroup: GPUBindGroup;
  cityGroup: GPUBindGroup;
  cullGroup: GPUBindGroup;
  terrainVertices: GPUBuffer;
  terrainIndices: GPUBuffer;
  chunks: Chunk[];
  assetVertices: GPUBuffer;
  protoBuffer: GPUBuffer;
  instanceBuffer: GPUBuffer;
  visibleBuffer: GPUBuffer;
  baseBuffer: GPUBuffer;
  argsBuffer: GPUBuffer;
  argsRead: GPUBuffer;
  argsReset: Uint32Array<ArrayBuffer>;
  buckets: Bucket[];
  depth: GPUTexture;
  depthView: GPUTextureView;
  instanceCount: number;
}

export class Renderer {
  private res: Resources | null = null;
  private cameraData = new Float32Array(CAMERA_UNIFORM_SIZE / 4);
  private invViewProj = mat4();
  private sceneData = new Float32Array(SCENE_UNIFORM_SIZE / 4);
  private raf = 0;
  private startedAt = 0;
  private lastFrame = 0;
  private unsubscribeResize: (() => void) | null = null;
  private running = false;
  private onUpdate: ((dt: number) => void) | null = null;
  private frustum = new Frustum();
  private profiler: GpuProfiler | null = null;
  /** Survivors per level of detail, read back asynchronously for the overlay. */
  private drawnByLod: [number, number, number] = [0, 0, 0];
  private drawnTris = 0;
  private countsPending = false;

  constructor(
    private gpu: Gpu,
    private camera: Camera,
    private stats: Stats,
  ) {}

  // ---- construction ---------------------------------------------------

  build(): void {
    const { device, format } = this.gpu;

    // The city and the atlas first: everything sized below comes from them,
    // and a prototype the spawner never placed is never generated.
    const city = makeCity();
    const atlas = new Atlas();
    const plan = planCity(city, atlas);

    // ---- bind group layouts -------------------------------------------

    const cameraLayout = device.createBindGroupLayout({
      label: 'camera-bgl',
      entries: [{
        binding: 0,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT | GPUShaderStage.COMPUTE,
        buffer: { type: 'uniform' },
      }],
    });
    // What the asset shader calls group 0: the scene uniform and the shadow
    // map. Same layout the asset viewer uses, so one shader serves both.
    const sceneLayout = device.createBindGroupLayout({
      label: 'scene-bgl',
      entries: [
        { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'depth' } },
        { binding: 2, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'comparison' } },
      ],
    });
    const protoLayout = device.createBindGroupLayout({
      label: 'proto-bgl',
      entries: [{
        binding: 0,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        buffer: { type: 'read-only-storage' },
      }],
    });
    // The instance table, and one bucket's slice of the visibility list. The
    // slice arrives as a dynamic offset, which is what lets each draw address
    // its own survivors without the indirect-first-instance feature.
    const cityLayout = device.createBindGroupLayout({
      label: 'city-bgl',
      entries: [
        { binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } },
        {
          binding: 1, visibility: GPUShaderStage.VERTEX,
          buffer: { type: 'read-only-storage', hasDynamicOffset: true, minBindingSize: plan.sliceBytes },
        },
      ],
    });
    const cullLayout = device.createBindGroupLayout({
      label: 'cull-bgl',
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
        { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
        { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
      ],
    });

    const depthStencil: GPUDepthStencilState = {
      format: DEPTH_FORMAT,
      depthWriteEnabled: true,
      depthCompare: 'less',
    };

    // ---- pipelines ----------------------------------------------------

    // The sky goes down first with depth writes off, so every later pass
    // paints over it. Clearing to a flat colour was cheaper and was why a
    // scene lit for midday read as midnight.
    const skyModule = device.createShaderModule({ label: 'sky', code: SHADERS.sky });
    const sky = device.createRenderPipeline({
      label: 'sky-pipeline',
      layout: device.createPipelineLayout({ bindGroupLayouts: [cameraLayout] }),
      vertex: { module: skyModule, entryPoint: 'vs' },
      fragment: { module: skyModule, entryPoint: 'fs', targets: [{ format }] },
      primitive: { topology: 'triangle-list' },
      depthStencil: { format: DEPTH_FORMAT, depthWriteEnabled: false, depthCompare: 'always' },
    });

    const terrainModule = device.createShaderModule({ label: 'terrain', code: SHADERS.terrain });
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

    const assetModule = device.createShaderModule({ label: 'asset', code: SHADERS.asset });
    const cityPipeline = device.createRenderPipeline({
      label: 'city-pipeline',
      layout: device.createPipelineLayout({
        bindGroupLayouts: [sceneLayout, protoLayout, cityLayout],
      }),
      vertex: {
        module: assetModule,
        entryPoint: 'vs_city',
        buffers: [{
          arrayStride: VERTEX_BYTES,
          attributes: [
            // Two fetches rather than five fields: the shader unpacks.
            { shaderLocation: 0, offset: 0, format: 'uint32x4' },
            { shaderLocation: 1, offset: 16, format: 'uint32' },
          ],
        }],
      },
      fragment: { module: assetModule, entryPoint: 'fs', targets: [{ format }] },
      // The library's winding is checked by tools/asset-test.mjs and the
      // inverted-box ceiling, so back faces can go.
      primitive: { topology: 'triangle-list', cullMode: 'back', frontFace: 'ccw' },
      depthStencil,
    });

    const cull = device.createComputePipeline({
      label: 'cull-pipeline',
      layout: device.createPipelineLayout({ bindGroupLayouts: [cameraLayout, cullLayout] }),
      compute: {
        module: device.createShaderModule({ label: 'cull', code: SHADERS.cull }),
        entryPoint: 'main',
      },
    });

    // ---- buffers ------------------------------------------------------

    const cameraBuffer = device.createBuffer({
      label: 'camera-uniform',
      size: CAMERA_UNIFORM_SIZE,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    const cameraGroup = device.createBindGroup({
      label: 'camera-bg', layout: cameraLayout,
      entries: [{ binding: 0, resource: { buffer: cameraBuffer } }],
    });

    const sceneBuffer = device.createBuffer({
      label: 'scene-uniform',
      size: SCENE_UNIFORM_SIZE,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    // Shadows are not cast yet, so the map is a single texel cleared to "far":
    // the shader samples unconditionally and gets "nothing occludes here".
    const shadowStub = device.createTexture({
      label: 'shadow-stub',
      size: { width: 1, height: 1 },
      format: DEPTH_FORMAT,
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    });
    const stubView = shadowStub.createView();
    {
      const clear = device.createCommandEncoder({ label: 'clear-shadow-stub' });
      clear.beginRenderPass({
        colorAttachments: [],
        depthStencilAttachment: {
          view: stubView, depthClearValue: 1, depthLoadOp: 'clear', depthStoreOp: 'store',
        },
      }).end();
      device.queue.submit([clear.finish()]);
    }
    const sceneGroup = device.createBindGroup({
      label: 'scene-bg', layout: sceneLayout,
      entries: [
        { binding: 0, resource: { buffer: sceneBuffer } },
        { binding: 1, resource: stubView },
        { binding: 2, resource: device.createSampler({ compare: 'less' }) },
      ],
    });

    // Terrain: one vertex buffer and one index buffer for every chunk. Chunk
    // topology is identical, so each is drawn with its own baseVertex.
    const mesh = buildTerrain();
    const terrainVertices = device.createBuffer({
      label: 'terrain-vertices',
      size: mesh.vertices.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(terrainVertices, 0, mesh.vertices);
    const terrainIndices = device.createBuffer({
      label: 'terrain-indices',
      size: mesh.indices.byteLength,
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(terrainIndices, 0, mesh.indices);

    const assetVertices = device.createBuffer({
      label: 'asset-arena',
      size: plan.vertices.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(assetVertices, 0, plan.vertices);

    const protoBuffer = device.createBuffer({
      label: 'prototypes',
      size: plan.protos.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(protoBuffer, 0, plan.protos);
    const protoGroup = device.createBindGroup({
      label: 'proto-bg', layout: protoLayout,
      entries: [{ binding: 0, resource: { buffer: protoBuffer } }],
    });

    const instanceBuffer = device.createBuffer({
      label: 'city-instances',
      size: Math.max(city.data.byteLength, INSTANCE_FLOATS * 4),
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(instanceBuffer, 0, city.data);

    const visibleBuffer = device.createBuffer({
      label: 'visible-lists',
      size: Math.max(plan.visibleEntries * 4, 256),
      usage: GPUBufferUsage.STORAGE,
    });
    const baseBuffer = device.createBuffer({
      label: 'bucket-bases',
      size: Math.max(plan.bases.byteLength, 4),
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(baseBuffer, 0, plan.bases);
    const argsBuffer = device.createBuffer({
      label: 'draw-args',
      size: plan.args.byteLength,
      usage: GPUBufferUsage.INDIRECT | GPUBufferUsage.STORAGE
           | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
    });
    // Read back purely so the overlay can show how many buildings survived
    // culling and at which level. Nothing in the frame depends on it, so the
    // read stays async and a frame or two stale.
    const argsRead = device.createBuffer({
      label: 'draw-args-read',
      size: plan.args.byteLength,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });

    const cullGroup = device.createBindGroup({
      label: 'cull-bg', layout: cullLayout,
      entries: [
        { binding: 0, resource: { buffer: instanceBuffer } },
        { binding: 1, resource: { buffer: visibleBuffer } },
        { binding: 2, resource: { buffer: argsBuffer } },
        { binding: 3, resource: { buffer: baseBuffer } },
      ],
    });
    const cityGroup = device.createBindGroup({
      label: 'city-bg', layout: cityLayout,
      entries: [
        { binding: 0, resource: { buffer: instanceBuffer } },
        { binding: 1, resource: { buffer: visibleBuffer, offset: 0, size: plan.sliceBytes } },
      ],
    });

    const { depth, depthView } = this.createDepth(this.gpu.viewport);

    this.profiler ??= new GpuProfiler(device, ['cull', 'draw']);

    this.res = {
      sky, terrain, city: cityPipeline, cull,
      cameraBuffer, cameraGroup, sceneBuffer, sceneGroup, protoGroup, cityGroup, cullGroup,
      terrainVertices, terrainIndices, chunks: mesh.chunks,
      assetVertices, protoBuffer, instanceBuffer, visibleBuffer, baseBuffer,
      argsBuffer, argsRead, argsReset: plan.args, buckets: plan.buckets,
      depth, depthView, instanceCount: city.count,
    };

    this.unsubscribeResize?.();
    this.unsubscribeResize = this.gpu.onResize((v) => this.onResize(v));
    this.camera.groundHeight = heightAt;
    // Keep the focus inside the terrain, whatever size it was built at.
    this.camera.extent = TERRAIN.size * 0.5 - TERRAIN.chunk;
    this.camera.setViewport(this.gpu.viewport.width, this.gpu.viewport.height);
    this.camera.update();

    const mib = (b: number): string => (b / 1048576).toFixed(1);
    const placed = plan.buckets.length / 3;
    log.info('render', `terrain ${mesh.chunks.length} chunks (${mib(mesh.vertices.byteLength)} MiB), `
      + `${city.count.toLocaleString()} instances of ${placed} prototypes`);
    log.info('render', `asset arena ${mib(plan.vertices.byteLength)} MiB, `
      + `${(plan.triangles.reduce((a, b) => a + b, 0) / 1000).toFixed(0)}k triangles, `
      + `${plan.buckets.length} buckets`);
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

  /**
   * One frame, on demand.
   *
   * The loop above is driven by requestAnimationFrame, which a headless tool
   * has no use for: it wants a fixed number of frames and wants to know when
   * they are finished. Same frame, called by hand.
   */
  frameForTools(now: number): void {
    this.frame(now);
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
    // The inverse, for unprojecting a screen corner into a view ray. The sky
    // pass is the only thing that wants it, and it wants it once per frame.
    invert(this.invViewProj, cam.viewProjMatrix);
    this.cameraData.set(this.invViewProj, 16);
    this.cameraData[32] = cam.eye[0];
    this.cameraData[33] = cam.eye[1];
    this.cameraData[34] = cam.eye[2];
    this.cameraData[35] = cam.far;
    this.cameraData.set([SUN[0], SUN[1], SUN[2], 0], 36);
    this.cameraData[40] = (now - this.startedAt) / 1000;
    this.cameraData[41] = TERRAIN.size * 0.5;
    this.cameraData[42] = 0;
    // Converts metres-at-a-distance into pixels, so the culling pass can drop
    // anything too small to resolve and pick a level of detail for the rest.
    this.cameraData[43] = viewport.height / (2 * Math.tan(FOV_Y / 2));

    // The same six planes the CPU uses for terrain chunks, handed to the
    // culling pass so both agree by construction rather than by coincidence.
    this.frustum.update(cam.viewProjMatrix);
    this.cameraData.set(this.frustum.planes, 44);
    device.queue.writeBuffer(res.cameraBuffer, 0, this.cameraData);

    // The asset shader's own uniform. Its brand, accent and sign fields are
    // dead here -- those moved into the prototype table when one pass started
    // drawing four hundred prototypes -- but the layout is shared with the
    // viewer and the padding costs nothing.
    this.sceneData.set(cam.viewProjMatrix, 0);
    this.sceneData.set(cam.viewProjMatrix, 16);
    this.sceneData.set([cam.eye[0], cam.eye[1], cam.eye[2], 0], 32);
    this.sceneData.set([SUN[0], SUN[1], SUN[2], 0], 36);
    // x turns aerial perspective on: the city wants it, the viewer does not.
    this.sceneData.set([1, 1, TERRAIN.size * 0.5, 0], 40);
    device.queue.writeBuffer(res.sceneBuffer, 0, this.sceneData);

    // Counts back to zero before the culling pass appends to them. The rest of
    // each DrawArgs -- the mesh's vertex count and where it starts -- is fixed
    // for the life of the run and rides along in the same upload.
    device.queue.writeBuffer(res.argsBuffer, 0, res.argsReset);

    const drawWrites = this.profiler?.writes('draw');
    const encoder = device.createCommandEncoder({ label: 'frame' });

    // Visibility and level of detail for every building, on the GPU. At this
    // instance count, culling on the CPU would mean walking the whole table in
    // JavaScript every frame and uploading the survivors.
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
        // Cleared only because a load op is required; the sky pass covers
        // every pixel of it before anything else is drawn.
        clearValue: { r: 0, g: 0, b: 0, a: 1 },
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
    pass.setPipeline(res.sky);
    pass.draw(3);

    // Terrain, one draw per visible chunk. Culling here is what keeps the draw
    // count flat as the map grows past the view.
    pass.setPipeline(res.terrain);
    pass.setVertexBuffer(0, res.terrainVertices);
    pass.setIndexBuffer(res.terrainIndices, 'uint32');
    let chunks = 0;
    for (const chunk of res.chunks) {
      if (!this.frustum.containsBox(chunk.min, chunk.max)) continue;
      pass.drawIndexed(INDICES_PER_CHUNK, 1, 0, chunk.baseVertex);
      chunks++;
    }

    // The city. One indirect draw per bucket, each pointed at its own slice of
    // the visibility list by a dynamic offset. The CPU never learns how many
    // buildings survived culling, and never stalls to find out -- a bucket
    // nothing landed in draws zero instances and costs the encode alone.
    pass.setPipeline(res.city);
    pass.setBindGroup(0, res.sceneGroup);
    pass.setBindGroup(1, res.protoGroup);
    pass.setVertexBuffer(0, res.assetVertices);
    for (const b of res.buckets) {
      pass.setBindGroup(2, res.cityGroup, [b.sliceOffset]);
      pass.drawIndirect(res.argsBuffer, b.argsOffset);
    }

    pass.end();

    if (!this.countsPending) {
      encoder.copyBufferToBuffer(res.argsBuffer, 0, res.argsRead, 0, res.argsReset.byteLength);
    }
    this.profiler?.resolve(encoder);
    device.queue.submit([encoder.finish()]);
    this.profiler?.poll();
    this.readDrawnCounts(res);

    this.stats.sample(performance.now() - cpuStart);
    this.stats.set('draws', String(1 + chunks + res.buckets.length));
    this.stats.set('chunks', `${chunks}/${res.chunks.length}`);
    if (this.profiler?.enabled) {
      this.stats.set('gpu cull', this.profiler.ms('cull').toFixed(2));
      this.stats.set('gpu draw', this.profiler.ms('draw').toFixed(2));
    }
    const shown = this.drawnByLod[0] + this.drawnByLod[1] + this.drawnByLod[2];
    this.stats.set('buildings', `${shown.toLocaleString()}/${res.instanceCount.toLocaleString()}`);
    this.stats.set('lod', this.drawnByLod.join('·'));
    this.stats.set('tris', `${(this.drawnTris / 1000).toFixed(0)}k`);
    this.stats.set('zoom', `${cam.distance.toFixed(0)}m`);
    this.stats.set('px', `${viewport.width}×${viewport.height}`);
    this.stats.paint(now);
  }

  /**
   * Sums the survivor counts out of the args buffer, for the overlay.
   *
   * A whole-buffer map rather than four numbers, because the per-level split
   * and the triangle count are what say whether the LOD thresholds are set
   * anywhere near right, and they are the first thing to look at when the
   * frame time moves.
   */
  private readDrawnCounts(res: Resources): void {
    if (this.countsPending) return;
    this.countsPending = true;
    res.argsRead.mapAsync(GPUMapMode.READ).then(
      () => {
        const v = new Uint32Array(res.argsRead.getMappedRange().slice(0));
        const byLod: [number, number, number] = [0, 0, 0];
        let tris = 0;
        for (const b of res.buckets) {
          const n = v[(b.argsOffset / 4) + 1];
          byLod[b.lod] += n;
          tris += (n * b.vertices) / 3;
        }
        this.drawnByLod = byLod;
        this.drawnTris = tris;
        res.argsRead.unmap();
        this.countsPending = false;
      },
      () => { this.countsPending = false; },
    );
  }

  /** Total buildings in the world, drawn or not. */
  get buildingCount(): number {
    return this.res?.instanceCount ?? 0;
  }

  /** Most recent survivor counts per level of detail, for the benchmark. */
  get drawn(): readonly [number, number, number] {
    return this.drawnByLod;
  }

  /** Milliseconds the GPU spent in a named pass, or 0 without timestamp support. */
  gpuMs(scope: string): number {
    return this.profiler?.ms(scope) ?? 0;
  }

  /** Drops every GPU object, before rebuilding on a recovered device. */
  teardown(): void {
    this.stop();
    if (!this.res) return;
    const r = this.res;
    r.depth.destroy();
    for (const b of [
      r.cameraBuffer, r.sceneBuffer, r.terrainVertices, r.terrainIndices,
      r.assetVertices, r.protoBuffer, r.instanceBuffer, r.visibleBuffer,
      r.baseBuffer, r.argsBuffer, r.argsRead,
    ]) b.destroy();
    this.res = null;
  }
}
