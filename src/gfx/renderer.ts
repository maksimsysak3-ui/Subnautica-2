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
import { invert, mat4, ortho, lookAt, multiply } from '../math/m4';
import { GpuProfiler } from './profiler';
import { Atlas, VERTEX_BYTES } from './atlas';
import { planCity } from './city-draw';
import { buildGroundMap } from './ground-map';
import type { Bucket, CastBucket as CityDrawCast } from './city-draw';
import {
  makeCity, defaultWorld, INSTANCE_FLOATS, buildTerrain, heightAt,
  FLOATS_PER_VERTEX, INDICES_PER_CHUNK, TERRAIN,
} from '../sim';
import type { Chunk, World } from '../sim';
import { SHADERS } from './shaders';

const DEPTH_FORMAT: GPUTextureFormat = 'depth24plus';

/** Written where there is nothing to mark. */
const ZERO4 = [0, 0, 0, 0];

/**
 * The grass lattice: cells across, and how far apart.
 *
 * Four hundred square at fifteen and a half centimetres is a patch sixty-two
 * metres across holding a hundred and sixty thousand blades -- about forty a
 * square metre. Real turf is thousands, and forty is what actually reads:
 * enough that the ground has things standing on it, few enough that each one
 * is more than a pixel. Beyond the patch the ground shader's own grass takes
 * over, and the two meet in a thinning band rather than at a line.
 */
const GRASS_SIDE = 400;
const GRASS_CELL = 0.155;
/** Vertices per blade, which must match grass.wgsl. */
const GRASS_VERTS = 15;
/** Blade height and half-width, in metres. */
const GRASS_TALL = 0.34;
const GRASS_WIDE = 0.019;
/** Past this many metres from the eye, no blades. */
const GRASS_REACH = 31;
/** Past this camera distance the patch is not drawn at all. */
const GRASS_ZOOM = 320;

/**
 * viewProj (64) + its inverse (64) + the sun's view (64) + eye (16)
 * + sun (16) + focus (16) + params (16) + the build mark (32)
 * + six frustum planes (96).
 */
const CAMERA_UNIFORM_SIZE = 384;

/** Edge of the shadow map, in texels. */
const SHADOW_SIZE = 2048;

/**
 * Seconds in a game day.
 *
 * Eight minutes: long enough that the sun is not visibly sweeping while the
 * player builds, short enough that anyone who sits with the game sees dusk.
 */
const DAY_SECONDS = 480;

/** viewProj + sunViewProj + eye + sunDir + params + brand + accent + sign. */
const SCENE_UNIFORM_SIZE = 240;

/** Vertical field of view, shared with the camera. */
const FOV_Y = (50 * Math.PI) / 180;

/**
 * Where the sun is at a given point in the day, as a unit vector pointing at
 * it. `t` runs 0 to 1 over one day, with noon at 0.5.
 *
 * A tilted circle rather than a great circle through the zenith: the sun
 * passing directly overhead flattens every facade at midday and makes the
 * shadow volume degenerate, and no inhabited latitude sees it happen anyway.
 * The tilt is about what a temperate summer gives.
 */
function sunAt(t: number): [number, number, number] {
  const a = (t - 0.25) * Math.PI * 2;
  const tilt = 0.62;
  const x = Math.cos(a);
  const y = Math.sin(a) * Math.cos(tilt);
  const z = -Math.sin(a) * Math.sin(tilt) - 0.18;
  const l = Math.hypot(x, y, z) || 1;
  return [x / l, y / l, z / l];
}

/** The bind group layouts, kept so world buffers can be rebound after a change. */
interface Layouts {
  camera: GPUBindGroupLayout;
  grass: GPUBindGroupLayout;
  proto: GPUBindGroupLayout;
  city: GPUBindGroupLayout;
  cull: GPUBindGroupLayout;
}

/**
 * Everything that depends on what the city currently is.
 *
 * Thrown away and made again whenever the player changes a road or a zone.
 * The pipelines, the layouts and the camera are not in here, because none of
 * them care what is standing on the ground.
 */
interface WorldRes {
  groundTexture: GPUTexture;
  grassGroup: GPUBindGroup;
  protoGroup: GPUBindGroup;
  cityGroup: GPUBindGroup;
  castGroup: GPUBindGroup;
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
  castArgsBuffer: GPUBuffer;
  castBaseBuffer: GPUBuffer;
  castVisibleBuffer: GPUBuffer;
  castArgsReset: Uint32Array<ArrayBuffer>;
  casts: CityDrawCast[];
  instanceCount: number;
}

interface Resources extends WorldRes {
  layouts: Layouts;
  grass: GPURenderPipeline;
  grassBuffer: GPUBuffer;
  sky: GPURenderPipeline;
  shadow: GPURenderPipeline;
  shadowView: GPUTextureView;
  shadowTexture: GPUTexture;
  shadowSceneGroup: GPUBindGroup;
  terrain: GPURenderPipeline;
  city: GPURenderPipeline;
  cull: GPUComputePipeline;
  cameraBuffer: GPUBuffer;
  cameraGroup: GPUBindGroup;
  sceneBuffer: GPUBuffer;
  sceneGroup: GPUBindGroup;
  depth: GPUTexture;
  depthView: GPUTextureView;
  instanceCount: number;
}

export class Renderer {
  private res: Resources | null = null;
  private cameraData = new Float32Array(CAMERA_UNIFORM_SIZE / 4);
  private invViewProj = mat4();
  private sunView = mat4();
  private sunProj = mat4();
  private sunViewProj = mat4();
  /**
   * Where in the day the world is: 0 and 1 are midnight, 0.5 is noon.
   *
   * Public and writable, because a tool taking a picture wants a fixed hour
   * and the benchmark wants the same light on every run.
   */
  timeOfDay = 0.33;
  /** Whether the clock advances. Off for tools; on in the game. */
  clockRunning = true;
  private sceneData = new Float32Array(SCENE_UNIFORM_SIZE / 4);
  private raf = 0;
  private startedAt = 0;
  private lastFrame = 0;
  private unsubscribeResize: (() => void) | null = null;
  private running = false;
  private onUpdate: ((dt: number) => void) | null = null;
  private frustum = new Frustum();
  /**
   * The asset arena, kept across rebuilds.
   *
   * Baking is the expensive half of a rebuild and it is entirely reusable: a
   * prototype the last city placed is already in the arena, and the arena only
   * ever grows.
   */
  private atlas = new Atlas();
  /**
   * The grass patch's uniform, made before the first world load.
   *
   * It has to outlive a rebuild -- the bind group that names it is remade with
   * the ground map, and a buffer replaced under a live bind group is a use
   * after free.
   */
  private grassUniform: GPUBuffer | null = null;
  private grassData = new Float32Array(8);
  /** What the city is derived from. The tools edit this, then rebuild. */
  readonly world: World = defaultWorld();
  /**
   * What the build tool is about to affect, drawn into the ground.
   *
   * `rect` is x0, z0, x1, z1 in metres. Null when no tool is dragging, which
   * is most of the time and costs the terrain shader one comparison.
   */
  mark: { rect: [number, number, number, number]; tint: [number, number, number] } | null = null;
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

    // ---- bind group layouts -------------------------------------------

    // The camera group carries the shadow map as well as the uniform, so the
    // ground receives shadows through the same code the buildings do. The
    // culling pass shares the layout and simply never touches the texture.
    const cameraLayout = device.createBindGroupLayout({
      label: 'camera-bgl',
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT | GPUShaderStage.COMPUTE,
          buffer: { type: 'uniform' },
        },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'depth' } },
        { binding: 2, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'comparison' } },
      ],
    });
    // The shadow pass must not bind the map it is writing into: sampling a
    // texture while rendering to it is a usage conflict, and in practice it
    // takes the device down rather than raising a tidy error. So the depth
    // pass gets a layout carrying only the uniform, which is all it reads.
    const shadowSceneLayout = device.createBindGroupLayout({
      label: 'shadow-scene-bgl',
      entries: [{ binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: 'uniform' } }],
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
    // The grass reads the ground map and its own patch uniform.
    const grassLayout = device.createBindGroupLayout({
      label: 'grass-bgl',
      entries: [
        { binding: 0, visibility: GPUShaderStage.VERTEX, texture: { sampleType: 'unfilterable-float' } },
        { binding: 1, visibility: GPUShaderStage.VERTEX, buffer: { type: 'uniform' } },
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
              // No minimum binding size: the layout outlives any one city, and a
          // rebuild that placed more of some prototype than the last one would
          // otherwise need a new pipeline. What a draw may read is settled by
          // the size the bind group is made with.
          buffer: { type: 'read-only-storage', hasDynamicOffset: true },
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
        { binding: 4, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
        { binding: 5, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
        { binding: 6, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
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

    // Blades, drawn after the ground so the ground's depth rejects most of
    // them before they shade. Two-sided: a blade is a surface with no inside.
    const grassModule = device.createShaderModule({ label: 'grass', code: SHADERS.grass });
    const grass = device.createRenderPipeline({
      label: 'grass-pipeline',
      layout: device.createPipelineLayout({ bindGroupLayouts: [cameraLayout, grassLayout] }),
      vertex: { module: grassModule, entryPoint: 'vs' },
      fragment: { module: grassModule, entryPoint: 'fs', targets: [{ format }] },
      primitive: { topology: 'triangle-strip', cullMode: 'none' },
      depthStencil,
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

    // Depth only, from the sun. Front faces culled rather than back: shadow
    // acne appears on lit surfaces, and casting from the far side of each
    // object moves the error into geometry the camera cannot see.
    const shadow = device.createRenderPipeline({
      label: 'shadow-pipeline',
      layout: device.createPipelineLayout({
        bindGroupLayouts: [shadowSceneLayout, protoLayout, cityLayout],
      }),
      vertex: {
        module: assetModule,
        entryPoint: 'vs_city_shadow',
        buffers: [{
          arrayStride: VERTEX_BYTES,
          attributes: [
            { shaderLocation: 0, offset: 0, format: 'uint32x4' },
            { shaderLocation: 1, offset: 16, format: 'uint32' },
          ],
        }],
      },
      primitive: { topology: 'triangle-list', cullMode: 'front', frontFace: 'ccw' },
      depthStencil: { format: DEPTH_FORMAT, depthWriteEnabled: true, depthCompare: 'less' },
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

    this.grassUniform ??= device.createBuffer({
      label: 'grass-uniform', size: 32,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const cameraBuffer = device.createBuffer({
      label: 'camera-uniform',
      size: CAMERA_UNIFORM_SIZE,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    const shadowTexture = device.createTexture({
      label: 'shadow-map',
      size: { width: SHADOW_SIZE, height: SHADOW_SIZE },
      format: DEPTH_FORMAT,
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    });
    const shadowView = shadowTexture.createView();
    const shadowSampler = device.createSampler({ compare: 'less' });
    const cameraGroup = device.createBindGroup({
      label: 'camera-bg', layout: cameraLayout,
      entries: [
        { binding: 0, resource: { buffer: cameraBuffer } },
        { binding: 1, resource: shadowView },
        { binding: 2, resource: shadowSampler },
      ],
    });

    const sceneBuffer = device.createBuffer({
      label: 'scene-uniform',
      size: SCENE_UNIFORM_SIZE,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    const sceneGroup = device.createBindGroup({
      label: 'scene-bg', layout: sceneLayout,
      entries: [
        { binding: 0, resource: { buffer: sceneBuffer } },
        { binding: 1, resource: shadowView },
        { binding: 2, resource: shadowSampler },
      ],
    });
    const shadowSceneGroup = device.createBindGroup({
      label: 'shadow-scene-bg', layout: shadowSceneLayout,
      entries: [{ binding: 0, resource: { buffer: sceneBuffer } }],
    });

    const { depth, depthView } = this.createDepth(this.gpu.viewport);

    this.profiler ??= new GpuProfiler(device, ['cull', 'draw']);

    const layouts: Layouts = {
      camera: cameraLayout, proto: protoLayout, city: cityLayout,
      cull: cullLayout, grass: grassLayout,
    };
    this.res = {
      layouts,
      grass, grassBuffer: this.grassUniform,
      sky, shadow, shadowView, shadowTexture, shadowSceneGroup,
      terrain, city: cityPipeline, cull,
      cameraBuffer, cameraGroup, sceneBuffer, sceneGroup,
      depth, depthView,
      ...this.loadWorld(layouts),
    };

    this.unsubscribeResize?.();
    this.unsubscribeResize = this.gpu.onResize((v) => this.onResize(v));
    this.camera.groundHeight = heightAt;
    // Keep the focus inside the terrain, whatever size it was built at.
    this.camera.extent = TERRAIN.size * 0.5 - TERRAIN.chunk;
    this.camera.setViewport(this.gpu.viewport.width, this.gpu.viewport.height);
    this.camera.update();

    log.info('render', this.profiler.enabled
      ? 'GPU timing available (timestamp-query)'
      : 'no timestamp-query: GPU times will read 0');
  }


  /**
   * Builds everything that depends on what the city currently is.
   *
   * Called once at load and again whenever the player changes a road or a
   * zone. The atlas is deliberately kept across rebuilds: a prototype baked
   * for the last city is still baked for this one, so a rebuild pays only for
   * prototypes it has not seen before.
   */
  private loadWorld(layouts: Layouts): WorldRes {
    const { device } = this.gpu;
    const protoLayout = layouts.proto, cityLayout = layouts.city, cullLayout = layouts.cull;

    // A prototype the spawner never placed is never generated.
    const city = makeCity(this.world);
    const plan = planCity(city, this.atlas);

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

    // The ground the grass stands on: the graded height and what the spawner
    // left open, one texel a cell. Rebuilt with the city, because both change.
    const ground = buildGroundMap(device, city, this.world.grid);
    const grassUniform = this.grassUniform;
    if (grassUniform === null) throw new Error('loadWorld before build');
    const grassGroup = device.createBindGroup({
      label: 'grass-bg', layout: layouts.grass,
      entries: [
        { binding: 0, resource: ground.view },
        { binding: 1, resource: { buffer: grassUniform } },
      ],
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

    const castVisibleBuffer = device.createBuffer({
      label: 'caster-lists',
      size: Math.max(plan.castEntries * 4, 256),
      usage: GPUBufferUsage.STORAGE,
    });
    const castBaseBuffer = device.createBuffer({
      label: 'caster-bases',
      size: Math.max(plan.castBases.byteLength, 4),
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(castBaseBuffer, 0, plan.castBases);
    const castArgsBuffer = device.createBuffer({
      label: 'caster-args',
      size: plan.castArgs.byteLength,
      usage: GPUBufferUsage.INDIRECT | GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    const cullGroup = device.createBindGroup({
      label: 'cull-bg', layout: cullLayout,
      entries: [
        { binding: 0, resource: { buffer: instanceBuffer } },
        { binding: 1, resource: { buffer: visibleBuffer } },
        { binding: 2, resource: { buffer: argsBuffer } },
        { binding: 3, resource: { buffer: baseBuffer } },
        { binding: 4, resource: { buffer: castVisibleBuffer } },
        { binding: 5, resource: { buffer: castArgsBuffer } },
        { binding: 6, resource: { buffer: castBaseBuffer } },
      ],
    });
    const cityGroup = device.createBindGroup({
      label: 'city-bg', layout: cityLayout,
      entries: [
        { binding: 0, resource: { buffer: instanceBuffer } },
        { binding: 1, resource: { buffer: visibleBuffer, offset: 0, size: plan.sliceBytes } },
      ],
    });
    const castGroup = device.createBindGroup({
      label: 'cast-bg', layout: cityLayout,
      entries: [
        { binding: 0, resource: { buffer: instanceBuffer } },
        { binding: 1, resource: { buffer: castVisibleBuffer, offset: 0, size: plan.sliceBytes } },
      ],
    });


    const mib = (b: number): string => (b / 1048576).toFixed(1);
    log.info('render', `terrain ${mesh.chunks.length} chunks (${mib(mesh.vertices.byteLength)} MiB), `
      + `${city.count.toLocaleString()} instances of ${plan.buckets.length / 3} prototypes, `
      + `arena ${mib(plan.vertices.byteLength)} MiB in ${plan.buckets.length} buckets`);

    return {
      groundTexture: ground.texture, grassGroup,
      protoGroup, cityGroup, castGroup, cullGroup,
      terrainVertices, terrainIndices, chunks: mesh.chunks,
      assetVertices, protoBuffer, instanceBuffer, visibleBuffer, baseBuffer,
      argsBuffer, argsRead, argsReset: plan.args, buckets: plan.buckets,
      castArgsBuffer, castBaseBuffer, castVisibleBuffer,
      castArgsReset: plan.castArgs, casts: plan.casts,
      instanceCount: city.count,
    };
  }

  /**
   * Throws the world away and builds it again from the current state.
   *
   * What a placement costs: the simulation rerunning and its output being
   * re-uploaded. Nothing about the pipelines changes.
   */
  rebuild(): void {
    const res = this.res;
    if (!res) return;
    for (const b of [
      res.assetVertices, res.protoBuffer, res.instanceBuffer, res.visibleBuffer,
      res.baseBuffer, res.argsBuffer, res.argsRead, res.castVisibleBuffer,
      res.castBaseBuffer, res.castArgsBuffer, res.terrainVertices, res.terrainIndices,
    ]) b.destroy();
    res.groundTexture.destroy();
    Object.assign(res, this.loadWorld(res.layouts));
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

    if (this.clockRunning) {
      this.timeOfDay = (this.timeOfDay + dt / DAY_SECONDS) % 1;
    }
    const sun = sunAt(this.timeOfDay);

    // The sun's view, refitted to what the camera is looking at. One cascade,
    // sized to the zoom: at street level the volume is a couple of hundred
    // metres and the shadows are sharp, and from the sky it grows to cover
    // what is on screen and softens, which is the right trade in both places.
    const extent = Math.min(Math.max(cam.distance * 1.15, 140), 1100);
    const focus = cam.focus;
    const back = extent * 2.4;
    lookAt(this.sunView,
      [focus[0] + sun[0] * back, focus[1] + sun[1] * back, focus[2] + sun[2] * back],
      [focus[0], focus[1], focus[2]], [0, 1, 0]);
    ortho(this.sunProj, -extent, extent, -extent, extent, 1, back * 2 + 900);
    multiply(this.sunViewProj, this.sunProj, this.sunView);

    this.cameraData.set(cam.viewProjMatrix, 0);
    // The inverse, for unprojecting a screen corner into a view ray. The sky
    // pass is the only thing that wants it, and it wants it once per frame.
    invert(this.invViewProj, cam.viewProjMatrix);
    this.cameraData.set(this.invViewProj, 16);
    this.cameraData.set(this.sunViewProj, 32);
    this.cameraData[48] = cam.eye[0];
    this.cameraData[49] = cam.eye[1];
    this.cameraData[50] = cam.eye[2];
    this.cameraData[51] = cam.far;
    this.cameraData.set([sun[0], sun[1], sun[2], 0], 52);
    this.cameraData.set([focus[0], focus[1], focus[2], extent], 56);
    this.cameraData[60] = (now - this.startedAt) / 1000;
    this.cameraData[61] = TERRAIN.size * 0.5;
    this.cameraData[62] = 1 / SHADOW_SIZE;
    // Converts metres-at-a-distance into pixels, so the culling pass can drop
    // anything too small to resolve and pick a level of detail for the rest.
    this.cameraData[63] = viewport.height / (2 * Math.tan(FOV_Y / 2));

    const mark = this.mark;
    this.cameraData.set(mark ? mark.rect : ZERO4, 64);
    this.cameraData.set(mark ? [mark.tint[0], mark.tint[1], mark.tint[2], 1] : ZERO4, 68);

    // The same six planes the CPU uses for terrain chunks, handed to the
    // culling pass so both agree by construction rather than by coincidence.
    this.frustum.update(cam.viewProjMatrix);
    this.cameraData.set(this.frustum.planes, 72);
    device.queue.writeBuffer(res.cameraBuffer, 0, this.cameraData);

    // The asset shader's own uniform. Its brand, accent and sign fields are
    // dead here -- those moved into the prototype table when one pass started
    // drawing four hundred prototypes -- but the layout is shared with the
    // viewer and the padding costs nothing.
    this.sceneData.set(cam.viewProjMatrix, 0);
    this.sceneData.set(this.sunViewProj, 16);
    this.sceneData.set([cam.eye[0], cam.eye[1], cam.eye[2], 0], 32);
    this.sceneData.set([sun[0], sun[1], sun[2], 0], 36);
    // x turns aerial perspective on: the city wants it, the viewer does not.
    this.sceneData.set([1, 1 / SHADOW_SIZE, TERRAIN.size * 0.5, 0], 40);
    device.queue.writeBuffer(res.sceneBuffer, 0, this.sceneData);

    // Counts back to zero before the culling pass appends to them. The rest of
    // each DrawArgs -- the mesh's vertex count and where it starts -- is fixed
    // for the life of the run and rides along in the same upload.
    device.queue.writeBuffer(res.argsBuffer, 0, res.argsReset);
    device.queue.writeBuffer(res.castArgsBuffer, 0, res.castArgsReset);

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

    // Depth from the sun's point of view, before anything is shaded, because
    // everything shaded reads it. One draw per prototype rather than three:
    // the shadow lists carry only the coarsest mesh.
    const shadowPass = encoder.beginRenderPass({
      label: 'shadow',
      colorAttachments: [],
      depthStencilAttachment: {
        view: res.shadowView,
        depthClearValue: 1.0,
        depthLoadOp: 'clear',
        depthStoreOp: 'store',
      },
    });
    shadowPass.setPipeline(res.shadow);
    shadowPass.setBindGroup(0, res.shadowSceneGroup);
    shadowPass.setBindGroup(1, res.protoGroup);
    shadowPass.setVertexBuffer(0, res.assetVertices);
    for (const c of res.casts) {
      shadowPass.setBindGroup(2, res.castGroup, [c.sliceOffset]);
      shadowPass.drawIndirect(res.castArgsBuffer, c.argsOffset);
    }
    shadowPass.end();

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

    // Grass, after the ground so most blades are rejected on depth before
    // they shade. The lattice is snapped to its own cell size around the eye:
    // the blades stand still in the world and the window into them slides.
    if (cam.distance < GRASS_ZOOM) {
      const snap = GRASS_CELL * 8;
      const ox = Math.floor(cam.eye[0] / snap) * snap - (GRASS_SIDE * GRASS_CELL) / 2;
      const oz = Math.floor(cam.eye[2] / snap) * snap - (GRASS_SIDE * GRASS_CELL) / 2;
      this.grassData.set([ox, oz, GRASS_CELL, res.groundTexture.width], 0);
      this.grassData.set([GRASS_TALL, GRASS_WIDE, GRASS_REACH, GRASS_SIDE], 4);
      device.queue.writeBuffer(res.grassBuffer, 0, this.grassData);
      pass.setPipeline(res.grass);
      pass.setBindGroup(1, res.grassGroup);
      pass.draw(GRASS_VERTS, GRASS_SIDE * GRASS_SIDE);
      pass.setBindGroup(0, res.cameraGroup);
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
    this.stats.set('draws', String(1 + chunks + res.buckets.length + res.casts.length));
    this.stats.set('hour', `${Math.floor(this.timeOfDay * 24)}:${String(Math.floor((this.timeOfDay * 24 % 1) * 60)).padStart(2, '0')}`);
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
    r.shadowTexture.destroy();
    for (const b of [
      r.cameraBuffer, r.sceneBuffer, r.terrainVertices, r.terrainIndices,
      r.assetVertices, r.protoBuffer, r.instanceBuffer, r.visibleBuffer,
      r.baseBuffer, r.argsBuffer, r.argsRead,
      r.castVisibleBuffer, r.castBaseBuffer, r.castArgsBuffer,
    ]) b.destroy();
    this.res = null;
  }
}
