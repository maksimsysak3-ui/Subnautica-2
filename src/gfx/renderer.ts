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
import { Weather } from '../sim/weather';
import type { Sky } from '../sim/weather';
import { ASSETS } from '../assets/registry';
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
  makeCity, startingWorld, INSTANCE_FLOATS, buildTerrain, heightAt,
  FLOATS_PER_VERTEX, INDICES_PER_CHUNK, TERRAIN, ROAD_FLOATS,
  buildWaterMesh, WATER_FLOATS, gradedSince, plotSpan, clearStanding,
} from '../sim';
// A live binding: the terrain module updates it on every build, and importing
// the value rather than the binding would read whatever it was at load.
import { terrainChunksRebuilt } from '../sim/terrain';
import type { Chunk, World, RoadMesh, City, Dirty } from '../sim';
import { SHADERS } from './shaders';

const DEPTH_FORMAT: GPUTextureFormat = 'depth24plus';

/** A rectangle no point is inside, for a tool that is up but not yet aimed. */
const NOWHERE4 = [1, 1, -1, -1];

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
/**
 * Where the blades start thinning with the zoom, and where they are gone.
 *
 * A blade is two centimetres wide. From a hundred metres up it is a fraction
 * of a pixel, and the lattice is a hundred and sixty thousand instances of
 * something nobody can resolve -- which was most of what a frame cost at any
 * zoom short of the old three-hundred-metre cutoff, for no picture at all.
 * Both the reach and the lattice sized to it shrink across this band, so the
 * near view keeps every blade and the far one stops paying.
 *
 * A band rather than a threshold because the threshold popped: sixty thousand
 * blades appeared in one frame as the camera crossed it.
 */
const GRASS_NEAR = 42;
const GRASS_FAR = 135;

/** A smoothstep on 0..1, clamped. */
function smooth01(t: number): number {
  const x = t < 0 ? 0 : t > 1 ? 1 : t;
  return x * x * (3 - 2 * x);
}

/**
 * How many frames may be in the GPU's queue at once.
 *
 * Two: one being drawn and one waiting, so the card never idles between
 * frames, and the picture is never more than one frame behind the input.
 */
const MAX_IN_FLIGHT = 2;

/**
 * viewProj (64) + its inverse (64) + the sun's view (64) + eye (16)
 * + sun (16) + focus (16) + params (16) + the build mark (32)
 * + six frustum planes (96).
 */
const CAMERA_UNIFORM_SIZE = 432;

/** Edge of the shadow map, in texels. */
const SHADOW_SIZE = 2048;

/**
 * Seconds in a game day.
 *
 * Eight minutes: long enough that the sun is not visibly sweeping while the
 * player builds, short enough that anyone who sits with the game sees dusk.
 */
const DAY_SECONDS = 480;

/**
 * Scratch for bitcasting the land mask into the uniform.
 *
 * The mask is sixty-four bits of ownership and a float cannot carry them: the
 * moment one passes through a f32 the low bits are rounded away and a player
 * owns a different set of plots than the one they bought.
 */
/** Frames a bucket stays in the draw list after it last drew anything. */
const WARM_FRAMES = 12;

const LAND_BITS = new Uint32Array(2);
const LAND_FLOATS = new Float32Array(LAND_BITS.buffer);

/** viewProj + sunViewProj + eye + sunDir + params + brand + accent + sign. */
const SCENE_UNIFORM_SIZE = 256;

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
  roadVertices: GPUBuffer;
  roadIndices: GPUBuffer;
  roadCount: number;
  waterVertices: GPUBuffer;
  waterIndices: GPUBuffer;
  waterCount: number;
  chunks: Chunk[];
  assetVertices: GPUBuffer;
  protoBuffer: GPUBuffer;
  instanceBuffer: GPUBuffer;
  visibleBuffer: GPUBuffer;
  baseBuffer: GPUBuffer;
  argsBuffer: GPUBuffer;
  argsRead: GPUBuffer;
  /** Bytes of `argsRead` holding the shadow casters, after the colour ones. */
  castArgsBytes: number;
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
  rain: GPURenderPipeline;
  shadow: GPURenderPipeline;
  shadowView: GPUTextureView;
  shadowTexture: GPUTexture;
  shadowSceneGroup: GPUBindGroup;
  terrain: GPURenderPipeline;
  road: GPURenderPipeline;
  water: GPURenderPipeline;
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
  /** How fast, as a multiple of the base day. The bar's speed buttons set it. */
  clockRate = 1;
  /**
   * The weather, on the same clock as the sun.
   *
   * Public so the bar can read what it is called and a tool can pin it. It runs
   * whenever the clock does, which means it also runs twelve times as fast
   * behind the main menu -- where watching a front come over the valley is most
   * of what makes that shot worth sitting through.
   */
  readonly weather = new Weather();

  private get sky(): Sky { return this.weather.sky; }
  private sceneData = new Float32Array(SCENE_UNIFORM_SIZE / 4);
  private raf = 0;
  private startedAt = 0;
  private lastFrame = 0;
  /**
   * Frames submitted but not yet finished on the GPU.
   *
   * requestAnimationFrame fires at the display's rate whatever the GPU is
   * managing, and WebGPU's queue is unbounded: a scene the card draws in
   * twenty milliseconds, submitted every seven, backs the queue up without
   * limit. The frame the player is looking at is then several behind the one
   * the camera is in, which is what "smooth numbers, laggy picture" is -- the
   * CPU readout said six thousand frames a second because encoding a frame is
   * all it was measuring.
   *
   * So: at most a couple of frames in flight. Beyond that the camera still
   * integrates and input is still read, but no new frame is encoded, which
   * bounds the latency to what the GPU can actually deliver and makes the
   * interval between presented frames even instead of sawtoothed.
   */
  private inFlight = 0;
  /** Frames dropped to the bound above since the last readout. */
  private stalled = 0;
  /** Whether the bound applies. Off while a tool is driving frames by hand. */
  private paced = true;
  /** Counts frames, to run the once-a-few-frames work off the hot path. */
  private beat = 0;
  /** Blades in the lattice this frame, for the readout. */
  private grassBlades = 0;
  /** Reused destination for the counter readback, so it allocates once. */
  private countsScratch: Uint32Array | null = null;
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
   * The road being dragged, drawn as the road it will be.
   *
   * Its own buffers, sized once and rewritten in place: a preview is rebuilt
   * on every pointer move, and allocating a vertex buffer sixty times a second
   * is how a build tool comes to stutter.
   */
  private previewVerts: GPUBuffer | null = null;
  private previewIndices: GPUBuffer | null = null;
  private previewCount = 0;

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
  readonly world: World = startingWorld();

  /**
   * Replaces what is on the map, keeping the same World object.
   *
   * The game opens on empty land, which is right for a player and useless for
   * a screenshot, a benchmark or a smoke test -- all of which need a city that
   * exists without one having been built by hand. Those ask for one through
   * here. Mutated in place rather than reassigned because the tools, the
   * camera and the build tools all hold this reference.
   */
  /**
   * What the city is worth, for the readout on the bar.
   *
   * Counted from the same instances that were just placed rather than
   * estimated from the zoning, so the number on the bar is the number of
   * buildings actually standing. Households carry 2.4 people, which is close
   * enough to a real average that the figure moves believably as a district
   * fills in.
   */
  readonly summary = { people: 0, jobs: 0, buildings: 0 };

  private summarise(city: { population: Uint32Array }): void {
    let people = 0, jobs = 0, buildings = 0;
    for (let i = 0; i < city.population.length; i++) {
      const n = city.population[i];
      if (n === 0) continue;
      const def = ASSETS[i];
      if (def === undefined || def.zone === 'nature') continue;
      buildings += n;
      people += n * (def.sim.households ?? 0) * 2.4;
      jobs += n * (def.sim.jobs ?? 0);
    }
    this.summary.people = Math.round(people);
    this.summary.jobs = Math.round(jobs);
    this.summary.buildings = buildings;
  }

  /**
   * The building the player is about to place, drawn where it would stand.
   *
   * Written into the slot reserved past the end of the city and picked up by
   * the cull, so it is the real mesh at a real level of detail with the real
   * lighting on it -- the shader tints it cold and bands it, and that is the
   * only thing that distinguishes it from the building it is about to become.
   *
   * Null takes it away. Called on every pointer move, so it is one twelve-float
   * write and nothing else: no rebuild, no reallocation, no new pipeline.
   */
  setGhost(g: { proto: number; x: number; z: number; y: number; yaw: number;
    halfX: number; halfZ: number; height: number } | null): void {
    const res = this.res;
    if (res === null) return;
    if (g === null) { this.ghosting = false; return; }
    this.ghost[0] = g.x; this.ghost[1] = g.z; this.ghost[2] = g.y; this.ghost[3] = g.yaw;
    this.ghost[4] = g.halfX; this.ghost[5] = g.halfZ;
    this.ghost[6] = g.height; this.ghost[7] = g.proto;
    this.ghost[8] = 1; this.ghost[9] = 1; this.ghost[10] = 0; this.ghost[11] = 0;
    this.gpu.device.queue.writeBuffer(res.instanceBuffer,
      res.instanceCount * INSTANCE_FLOATS * 4, this.ghost);
    this.ghosting = true;
  }

  private readonly ghost = new Float32Array(INSTANCE_FLOATS);
  private ghosting = false;

  /** How many instances the cull walks: the city, plus the ghost if there is one. */
  private cullCount(res: { instanceCount: number }): number {
    return res.instanceCount + (this.ghosting ? 1 : 0);
  }

  useWorld(next: World): void {
    this.world.net = next.net;
    this.world.zones = next.zones;
    this.world.lots = next.lots;
    // A world that arrives whole was not built by the player watching it, so
    // nothing in it rises: every instance in the next rebuild is dated to that
    // moment, and the growth curve treats them all as new. Clearing the ages
    // instead of stamping them makes the whole city count as already standing.
    this.settleCity();
    this.settled = true;
    // A world handed in whole shares nothing with the one standing, so the
    // next build starts from nothing rather than trying to patch it.
    clearStanding();
  }

  /** Set for one rebuild after a world is handed in whole. */
  private settled = false;
  /**
   * What the build tool is about to affect, drawn into the ground.
   *
   * `rect` is x0, z0, x1, z1 in metres. Null when no tool is dragging, which
   * is most of the time and costs the terrain shader one comparison.
   */
  mark: { rect: [number, number, number, number]; tint: [number, number, number] } | null = null;

  /**
   * True while a build tool has the pointer.
   *
   * The ground draws its zoning grid only when this is set. A lattice mown
   * into the turf every eight metres is exactly what a player wants while they
   * are laying something out against it and exactly what they do not want the
   * rest of the time, when it turns a kilometre of countryside into graph
   * paper. Nothing else in the frame needs to know, so it rides along in the
   * mark's alpha rather than growing the camera uniform a field.
   */
  building = false;
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

    // Rain, over the finished frame. No depth at all -- it is in front of
    // everything by construction -- and blended rather than written, because
    // what it is drawing is a thin veil that the scene shows through.
    const rainModule = device.createShaderModule({ label: 'rain', code: SHADERS.rain });
    const rain = device.createRenderPipeline({
      label: 'rain-pipeline',
      layout: device.createPipelineLayout({ bindGroupLayouts: [cameraLayout] }),
      vertex: { module: rainModule, entryPoint: 'vs' },
      fragment: {
        module: rainModule,
        entryPoint: 'fs',
        targets: [{
          format,
          blend: {
            color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha' },
            alpha: { srcFactor: 'zero', dstFactor: 'one' },
          },
        }],
      },
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

    // The road surface. Its own pipeline because its vertices carry where they
    // are on the road -- across and along -- which is what the markings are
    // drawn from, and nothing else in the frame has anything like it.
    const roadModule = device.createShaderModule({ label: 'road', code: SHADERS.road });
    const road = device.createRenderPipeline({
      label: 'road-pipeline',
      layout: device.createPipelineLayout({ bindGroupLayouts: [cameraLayout] }),
      vertex: {
        module: roadModule,
        entryPoint: 'vs',
        buffers: [{
          arrayStride: ROAD_FLOATS * 4,
          attributes: [
            { shaderLocation: 0, offset: 0, format: 'float32x3' },   // position
            { shaderLocation: 1, offset: 12, format: 'float32x3' },  // normal
            { shaderLocation: 2, offset: 24, format: 'float32x3' },  // across, along, to the end
            { shaderLocation: 3, offset: 36, format: 'float32x4' },  // surface, width, lanes, flags
          ],
        }],
      },
      fragment: { module: roadModule, entryPoint: 'fs', targets: [{ format }] },
      // Two-sided: the skirt at the outer edge faces down into the ground.
      primitive: { topology: 'triangle-list', cullMode: 'none' },
      depthStencil,
    });

    // The river surface. Opaque: it computes its own transmission from depth
    // rather than blending, which keeps it out of the sorting problem entirely
    // and costs nothing a blend would have bought.
    const waterModule = device.createShaderModule({ label: 'water', code: SHADERS.water });
    const water = device.createRenderPipeline({
      label: 'water-pipeline',
      layout: device.createPipelineLayout({ bindGroupLayouts: [cameraLayout] }),
      vertex: {
        module: waterModule,
        entryPoint: 'vs',
        buffers: [{
          arrayStride: WATER_FLOATS * 4,
          attributes: [
            { shaderLocation: 0, offset: 0, format: 'float32x3' },   // position
            { shaderLocation: 1, offset: 12, format: 'float32x3' },  // normal
            { shaderLocation: 2, offset: 24, format: 'float32x2' },  // across, along
          ],
        }],
      },
      fragment: { module: waterModule, entryPoint: 'fs', targets: [{ format }] },
      primitive: { topology: 'triangle-list', cullMode: 'none' },
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
      sky, rain, shadow, shadowView, shadowTexture, shadowSceneGroup,
      terrain, road, water, city: cityPipeline, cull,
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
  /** Where the last rebuild's time went, in milliseconds. For the profiler. */
  readonly cost: Record<string, number> = {};

  /**
   * When each building standing in the city first appeared.
   *
   * A rebuild regenerates every instance from scratch, so nothing survives it
   * that could carry an age -- which means a building that has been there for
   * ten minutes is indistinguishable from one the player has just zoned, and
   * every edit would make the whole city jump. This is the identity a rebuild
   * does not preserve, kept outside it: where a building stands and what it is.
   *
   * Keyed on position rounded to two metres and the prototype index, packed
   * into one number. Two buildings can only collide if they are the same
   * building in the same place, which is the case where sharing an age is
   * right anyway.
   */
  private births = new Map<number, number>();

  /**
   * Stamps each instance with when it first appeared, and forgets the ones
   * that are gone.
   */
  private dateCity(city: City, standing = false): void {
    // Zero means "has always been here", which is what the shader reads as
    // fully grown -- so a loaded city is standing the moment it appears.
    const now = standing ? 0 : performance.now() / 1000;
    const next = new Map<number, number>();
    const d = city.data;
    const half = TERRAIN.size / 2;
    for (let i = 0; i < city.count; i++) {
      const o = i * INSTANCE_FLOATS;
      const qx = Math.round((d[o] + half) * 0.5);
      const qz = Math.round((d[o + 1] + half) * 0.5);
      // 2^35 at the largest, which a double holds exactly.
      const key = (qx * 8192 + qz) * 512 + d[o + 7];
      const born = this.births.get(key) ?? now;
      next.set(key, born);
      d[o + 10] = born;
    }
    this.births = next;
  }

  /**
   * Makes everything standing now count as already built.
   *
   * For a world that arrives whole -- a save being loaded, the map the game
   * opens on -- where a city rising out of the ground would be a two-second
   * animation of something the player did not do.
   */
  private settleCity(): void {
    this.births.clear();
  }

  /**
   * Bytes of the asset arena already on the GPU.
   *
   * The arena only ever grows -- baking appends, and a mesh once baked is never
   * changed -- so everything below this mark is already correct in the buffer
   * and re-sending it is pure cost. Reset whenever the buffer is replaced.
   */
  private arenaUploaded = 0;

  /**
   * Keeps a buffer if it is still big enough, or replaces it.
   *
   * A rebuild used to destroy every buffer and make them all again, which for
   * the asset arena meant allocating and filling sixteen megabytes on every
   * road a player drew -- for contents that had not changed.
   */
  private hold(old: GPUBuffer | undefined, bytes: number, label: string,
    usage: number): { buffer: GPUBuffer; fresh: boolean } {
    if (old !== undefined && old.size >= bytes) return { buffer: old, fresh: false };
    old?.destroy();
    return {
      buffer: this.gpu.device.createBuffer({ label, size: Math.max(16, bytes), usage }),
      fresh: true,
    };
  }

  private loadWorld(layouts: Layouts, old?: WorldRes): WorldRes {
    const { device } = this.gpu;
    const protoLayout = layouts.proto, cityLayout = layouts.city, cullLayout = layouts.cull;
    const clock = performance.now();
    let last = clock;
    const lap = (name: string): void => {
      const now = performance.now();
      this.cost[name] = now - last;
      last = now;
    };

    // A prototype the spawner never placed is never generated.
    // The part of the map the edit touched, or nothing at all, which makes the
    // whole city again -- what a new game and a loaded save both want.
    const city = makeCity(this.world, this.dirty);
    lap('makeCity');
    this.dateCity(city, this.settled);
    this.settled = false;
    lap('births');
    this.summarise(city);
    const wasBaked = this.atlas.baked;
    const plan = planCity(city, this.atlas);
    lap('planCity');
    this.cost.newMeshes = this.atlas.baked - wasBaked;

    // The roads, as one mesh. It is small -- a full grid city is under two
    // megabytes -- and it is drawn in a single call whatever shape the network
    // is, which is the payoff for generating it rather than tiling it.
    const roadVertices = device.createBuffer({
      label: 'road-vertices',
      size: Math.max(16, city.roads.vertices.byteLength),
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(roadVertices, 0, city.roads.vertices);
    const roadIndices = device.createBuffer({
      label: 'road-indices',
      size: Math.max(16, city.roads.indices.byteLength),
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(roadIndices, 0, city.roads.indices);
    lap('roads');

    // The river, as a ribbon down its own channel. Tiny -- a few hundred
    // triangles for nine kilometres of water.
    const river = buildWaterMesh();
    const waterVertices = device.createBuffer({
      label: 'water-vertices', size: Math.max(16, river.vertices.byteLength),
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(waterVertices, 0, river.vertices);
    const waterIndices = device.createBuffer({
      label: 'water-indices', size: Math.max(16, river.indices.byteLength),
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(waterIndices, 0, river.indices);

    // Terrain: one vertex buffer and one index buffer for every chunk. Chunk
    // topology is identical, so each is drawn with its own baseVertex.
    // Only the chunks the grading actually moved. The rest are byte-identical
    // to what is already on the GPU, and proving that costs a scan of the
    // corner grid rather than five height evaluations per vertex.
    const mesh = buildTerrain(gradedSince());
    const terrain = this.hold(old?.terrainVertices, mesh.vertices.byteLength,
      'terrain-vertices', GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST);
    const terrainVertices = terrain.buffer;
    device.queue.writeBuffer(terrainVertices, 0, mesh.vertices);
    const terrainIndices = device.createBuffer({
      label: 'terrain-indices',
      size: mesh.indices.byteLength,
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(terrainIndices, 0, mesh.indices);
    lap('terrain');
    this.cost.terrainChunks = terrainChunksRebuilt;

    // The arena, grown rather than rebuilt, and only the new tail uploaded.
    //
    // Sixteen megabytes of baked geometry that does not change when a road is
    // drawn was being reallocated and re-sent on every edit. Held instead, with
    // a generous margin so a handful of newly discovered prototypes do not
    // force a copy, and written from the high-water mark.
    const arena = this.hold(old?.assetVertices,
      Math.ceil(plan.vertices.byteLength * 1.35),
      'asset-arena', GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST);
    const assetVertices = arena.buffer;
    if (arena.fresh) this.arenaUploaded = 0;
    if (plan.vertices.byteLength > this.arenaUploaded) {
      // writeBuffer wants whole 4-byte words; the arena's stride is a multiple
      // of four, so the mark always is.
      const from = this.arenaUploaded;
      device.queue.writeBuffer(assetVertices, from, plan.vertices, from,
        plan.vertices.byteLength - from);
      this.arenaUploaded = plan.vertices.byteLength;
    }
    this.cost.arenaSentKiB = Math.round(plan.vertices.byteLength / 1024);
    lap('arena');

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
    lap('groundMap');
    const grassUniform = this.grassUniform;
    if (grassUniform === null) throw new Error('loadWorld before build');
    const grassGroup = device.createBindGroup({
      label: 'grass-bg', layout: layouts.grass,
      entries: [
        { binding: 0, resource: ground.view },
        { binding: 1, resource: { buffer: grassUniform } },
      ],
    });

    // One slot past the end of the city, for the building being placed. The
    // cull is dispatched over a count rather than over the buffer, so the
    // spare slot costs nothing while it is empty and needs no second pipeline
    // when it is not -- the ghost is culled, given a level of detail and drawn
    // by exactly the machinery every other building goes through.
    const instanceBuffer = device.createBuffer({
      label: 'city-instances',
      size: Math.max((city.count + 1) * INSTANCE_FLOATS * 4, INSTANCE_FLOATS * 4),
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
    // Both args buffers, read back into one staging buffer: the colour buckets
    // first, then the shadow casters after them.
    //
    // The overlay reads these, and so does the next frame's encoder -- a bucket
    // that survived nothing is a bucket the next frame does not have to encode,
    // and at full scale that is the difference between fifteen hundred draw
    // calls and two hundred. One mapAsync rather than two, because the round
    // trip is the expensive part and the two buffers are wanted together.
    const castArgsBytes = Math.max(16, plan.castArgs.byteLength);
    const argsRead = device.createBuffer({
      label: 'draw-args-read',
      size: plan.args.byteLength + castArgsBytes,
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
      size: Math.max(16, plan.castArgs.byteLength),
      usage: GPUBufferUsage.INDIRECT | GPUBufferUsage.STORAGE
           | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
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

    lap('buffers');
    this.cost.total = performance.now() - clock;
    return {
      groundTexture: ground.texture, grassGroup,
      protoGroup, cityGroup, castGroup, cullGroup,
      terrainVertices, terrainIndices, chunks: mesh.chunks,
      roadVertices, roadIndices, roadCount: city.roads.indices.length,
      waterVertices, waterIndices, waterCount: river.indices.length,
      assetVertices, protoBuffer, instanceBuffer, visibleBuffer, baseBuffer,
      argsBuffer, argsRead, castArgsBytes, argsReset: plan.args, buckets: plan.buckets,
      castArgsBuffer, castBaseBuffer, castVisibleBuffer,
      castArgsReset: plan.castArgs, casts: plan.casts,
      instanceCount: city.count,
    };
  }

  /**
   * How strongly the land grid is drawn, 0 to 1, and which plot is under the
   * pointer, or -1. Both public: the land tool owns them, and the renderer only
   * carries them to the shader.
   */
  landView = 0;
  hotPlot = -1;

  /** What the current rebuild is allowed to remake. Set by `rebuild`. */
  private dirty: Dirty | undefined = undefined;

  /**
   * How many frames a bucket keeps its place in the draw list after it empties.
   *
   * One would be enough for correctness and wrong in practice: a building on a
   * level-of-detail boundary crosses it back and forth as the camera breathes,
   * and a bucket dropped the instant it empties would cost that building a
   * missing frame every time it came back.
   */
  private warm = new Uint8Array(0);
  private castWarm = new Uint8Array(0);
  private encodedBuckets = 0;
  private encodedCasts = 0;

  /**
   * Counts world rebuilds, so anything outside can tell the city has changed
   * without inspecting it. The autosave reads this rather than diffing a
   * hundred thousand cells on a timer.
   */
  revision = 0;

  /**
   * Throws the world away and builds it again from the current state.
   *
   * What a placement costs: the simulation rerunning and its output being
   * re-uploaded. Nothing about the pipelines changes.
   */
  rebuild(dirty?: Dirty): void {
    const res = this.res;
    if (!res) return;
    this.revision++;
    this.dirty = dirty;
    // The arena and the terrain vertices are handed to loadWorld to keep or
    // replace as it sees fit -- they are the two big ones, and both are usually
    // still exactly the right size. Everything else goes.
    for (const b of [
      res.protoBuffer, res.instanceBuffer, res.visibleBuffer,
      res.baseBuffer, res.argsBuffer, res.argsRead, res.castVisibleBuffer,
      res.castBaseBuffer, res.castArgsBuffer, res.terrainIndices,
    ]) b.destroy();
    res.groundTexture.destroy();
    Object.assign(res, this.loadWorld(res.layouts, res));
    this.dirty = undefined;
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
    // Unpaced. A tool asks for a fixed number of frames and expects that many
    // to be drawn; skipping one because the queue is busy would leave it
    // reading a picture it did not render.
    this.paced = false;
    this.frame(now);
    this.paced = true;
  }

  /**
   * Shows a road that has not been built yet, or clears it.
   *
   * The mesh comes from the same builder the real network uses, so what the
   * player sees while dragging is what release will produce -- including the
   * curve, which a rectangle drawn on the ground could never show, and the
   * position, which that rectangle got wrong by half a cell because it was
   * centred on a cell edge while the road runs down the cell's middle.
   */
  setRoadPreview(mesh: RoadMesh | null): void {
    const { device } = this.gpu;
    if (mesh === null || mesh.indices.length === 0) { this.previewCount = 0; return; }
    const maxVerts = 24576, maxIndices = 49152;
    if (mesh.vertices.length / ROAD_FLOATS > maxVerts || mesh.indices.length > maxIndices) {
      this.previewCount = 0;
      return;
    }
    this.previewVerts ??= device.createBuffer({
      label: 'road-preview-vertices', size: maxVerts * ROAD_FLOATS * 4,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    this.previewIndices ??= device.createBuffer({
      label: 'road-preview-indices', size: maxIndices * 4,
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
    });
    for (let i = 0; i < mesh.vertices.length; i += ROAD_FLOATS) {
      // Flagged, so the shader draws it as a proposal rather than as a road,
      // and lifted clear of whatever it is being drawn over.
      mesh.vertices[i + ROAD_FLOATS - 1] += 8;
      mesh.vertices[i + 1] += 0.22;
    }
    device.queue.writeBuffer(this.previewVerts, 0, mesh.vertices);
    device.queue.writeBuffer(this.previewIndices, 0, mesh.indices);
    this.previewCount = mesh.indices.length;
  }

  private frame(now: number): void {
    const res = this.res;
    if (!res) return;

    // Clamped so a backgrounded tab returning does not teleport the camera.
    const dt = Math.min((now - this.lastFrame) / 1000, 0.1);
    this.lastFrame = now;
    this.onUpdate?.(dt);
    this.stats.interval(dt * 1000);

    // Backpressure. The camera has already moved and the input has already
    // been read; what is skipped is only the drawing of a frame the GPU has
    // no room for yet.
    if (this.paced && this.inFlight >= MAX_IN_FLIGHT) {
      this.stalled++;
      this.stats.paint(now);
      return;
    }

    const cpuStart = performance.now();
    const { device, context, viewport } = this.gpu;
    const cam = this.camera;

    if (this.clockRunning) {
      this.timeOfDay = (this.timeOfDay + (dt * this.clockRate) / DAY_SECONDS) % 1;
      this.weather.advance(dt * this.clockRate, DAY_SECONDS);
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
    // A degenerate rectangle when a tool is up but has nothing to show yet:
    // the terrain tests x >= x0 && x <= x1, which no point satisfies, so the
    // tint draws nothing and the alpha still says a tool is in hand.
    this.cameraData.set(mark ? mark.rect : NOWHERE4, 64);
    this.cameraData.set(
      mark ? [mark.tint[0], mark.tint[1], mark.tint[2], 1]
        : [0, 0, 0, this.building ? 1 : 0], 68);

    // The same six planes the CPU uses for terrain chunks, handed to the
    // culling pass so both agree by construction rather than by coincidence.
    this.frustum.update(cam.viewProjMatrix);
    const w = this.sky;
    this.cameraData.set([w.cover, w.fog, w.rain, w.wet], 72);
    // The land overlay. The bitmask is bitcast rather than converted: sixty-four
    // bits do not survive a trip through a float, and the shader reads them back
    // as the words they are.
    LAND_BITS[0] = this.world.land.lo;
    LAND_BITS[1] = this.world.land.hi;
    this.cameraData[76] = LAND_FLOATS[0];
    this.cameraData[77] = LAND_FLOATS[1];
    this.cameraData[78] = this.landView;
    this.cameraData[79] = this.hotPlot;
    const origin = -(this.world.grid / 2) * 8;
    this.cameraData.set([plotSpan(this.world.grid), origin, origin, 0], 80);
    this.cameraData.set(this.frustum.planes, 84);
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
    // w is the clock the growth animation is measured against.
    this.sceneData.set([1, 1 / SHADOW_SIZE, TERRAIN.size * 0.5,
      performance.now() / 1000], 40);
    // The weather, so the buildings are standing in the same one as the ground.
    this.sceneData.set([w.cover, w.fog, w.rain, w.wet], 60);
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
    cullPass.dispatchWorkgroups(Math.ceil(this.cullCount(res) / 64));
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
    // The same skip the colour pass makes, from the same readback: one draw per
    // prototype whether or not a single copy of it is inside the sun's volume.
    const castWarm = this.castWarm;
    const castKnown = castWarm.length === res.casts.length;
    let casts = 0;
    for (let i = 0; i < res.casts.length; i++) {
      if (castKnown && castWarm[i] === 0) continue;
      const c = res.casts[i];
      shadowPass.setBindGroup(2, res.castGroup, [c.sliceOffset]);
      shadowPass.drawIndirect(res.castArgsBuffer, c.argsOffset);
      casts++;
    }
    this.encodedCasts = casts;
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

    // The river, before the roads: a bridge deck has to draw over it.
    if (res.waterCount > 0) {
      pass.setPipeline(res.water);
      pass.setVertexBuffer(0, res.waterVertices);
      pass.setIndexBuffer(res.waterIndices, 'uint32');
      pass.drawIndexed(res.waterCount);
    }

    // The roads, on top of the ground they were graded into. One call.
    if (res.roadCount > 0) {
      pass.setPipeline(res.road);
      pass.setVertexBuffer(0, res.roadVertices);
      pass.setIndexBuffer(res.roadIndices, 'uint32');
      pass.drawIndexed(res.roadCount);
    }

    // And the road being dragged, over the top of everything it crosses.
    if (this.previewCount > 0 && this.previewVerts !== null && this.previewIndices !== null) {
      pass.setPipeline(res.road);
      pass.setVertexBuffer(0, this.previewVerts);
      pass.setIndexBuffer(this.previewIndices, 'uint32');
      pass.drawIndexed(this.previewCount);
    }

    // Grass, after the ground so most blades are rejected on depth before
    // they shade. The lattice is snapped to its own cell size around the eye:
    // the blades stand still in the world and the window into them slides.
    // How far the blades reach, and so how big a lattice is needed to hold
    // them. Both fall away with the zoom together: the shader thins the field
    // towards its own edge, so a shrinking reach reads as the grass fading out
    // rather than as a ring closing in.
    const zoom = 1 - smooth01((cam.distance - GRASS_NEAR) / (GRASS_FAR - GRASS_NEAR));
    const reach = GRASS_REACH * zoom;
    if (reach > 1.5) {
      // Rounded up to a multiple of eight so the workgroup-shaped instance
      // count does not wobble by one blade as the camera creeps.
      const side = Math.min(GRASS_SIDE,
        Math.ceil((2 * reach) / GRASS_CELL / 8) * 8);
      const snap = GRASS_CELL * 8;
      const ox = Math.floor(cam.eye[0] / snap) * snap - (side * GRASS_CELL) / 2;
      const oz = Math.floor(cam.eye[2] / snap) * snap - (side * GRASS_CELL) / 2;
      this.grassData.set([ox, oz, GRASS_CELL, res.groundTexture.width], 0);
      this.grassData.set([GRASS_TALL, GRASS_WIDE, reach, side], 4);
      device.queue.writeBuffer(res.grassBuffer, 0, this.grassData);
      pass.setPipeline(res.grass);
      pass.setBindGroup(1, res.grassGroup);
      pass.draw(GRASS_VERTS, side * side);
      pass.setBindGroup(0, res.cameraGroup);
      this.grassBlades = side * side;
    } else {
      this.grassBlades = 0;
    }

    // The city. One indirect draw per bucket, each pointed at its own slice of
    // the visibility list by a dynamic offset. The CPU never learns how many
    // buildings survived culling, and never stalls to find out -- a bucket
    // nothing landed in draws zero instances and costs the encode alone.
    pass.setPipeline(res.city);
    pass.setBindGroup(0, res.sceneGroup);
    pass.setBindGroup(1, res.protoGroup);
    pass.setVertexBuffer(0, res.assetVertices);
    // Only the buckets that had something in them recently.
    //
    // Every prototype in the city gets three buckets, one per level of detail,
    // and every one of them was encoded every frame whether or not a single
    // instance survived culling. At full scale that is eight hundred indirect
    // draws to put fifteen hundred buildings on screen, and the encoding is not
    // free -- it is most of what a frame costs before the GPU has drawn
    // anything.
    //
    // The culler's counts come back a frame late, which is exactly the right
    // trade: a bucket that has just become visible is drawn one frame after it
    // should be, at sixty frames a second, and nobody has ever seen that.
    const warm = this.warm;
    const known = warm.length === res.buckets.length;
    let encoded = 0;
    for (let i = 0; i < res.buckets.length; i++) {
      if (known && warm[i] === 0) continue;
      const b = res.buckets[i];
      pass.setBindGroup(2, res.cityGroup, [b.sliceOffset]);
      pass.drawIndirect(res.argsBuffer, b.argsOffset);
      encoded++;
    }
    this.encodedBuckets = encoded;

    // Rain last, over everything, and only when there is any. The pass is a
    // single triangle but it is a full-screen one: skipping the draw outright
    // is the difference between free and a fill of the whole frame every frame
    // on a clear day.
    if (this.sky.rain > 0.004) {
      pass.setPipeline(res.rain);
      pass.setBindGroup(0, res.cameraGroup);
      pass.draw(3);
    }

    pass.end();

    // The survivor counts, every third frame. They drive the overlay and the
    // warm list, and the warm list has a twelve-frame memory -- so reading
    // them every frame bought nothing and cost a round trip, a map and a
    // copy of the whole args buffer per frame.
    this.beat++;
    // The first few frames read every time, so a tool that renders three of them
    // and prints the numbers gets real ones.
    const wantCounts = !this.countsPending && (this.beat < 4 || this.beat % 3 === 0);
    if (wantCounts) {
      encoder.copyBufferToBuffer(res.argsBuffer, 0, res.argsRead, 0, res.argsReset.byteLength);
      encoder.copyBufferToBuffer(res.castArgsBuffer, 0, res.argsRead,
        res.argsReset.byteLength, res.castArgsBytes);
    }
    this.profiler?.resolve(encoder);
    device.queue.submit([encoder.finish()]);
    this.inFlight++;
    device.queue.onSubmittedWorkDone().then(() => { this.inFlight--; },
      () => { this.inFlight--; });
    this.profiler?.poll();
    if (wantCounts) this.readDrawnCounts(res);

    this.stats.sample(performance.now() - cpuStart);
    // Every row below is a string built from a number, and at several hundred
    // frames a second that is tens of thousands of throwaway strings a second
    // feeding the collector -- which is felt as a hitch every so often, not as
    // a frame time. The panel repaints at 4Hz; the rows are now built at 4Hz
    // to match.
    if (!this.stats.due(now)) return;
    this.stats.set('draws', String(1 + chunks + this.encodedBuckets + this.encodedCasts));
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
    this.stats.set('grass', this.grassBlades ? `${(this.grassBlades / 1000).toFixed(0)}k` : '—');
    if (this.stalled > 0) { this.stats.set('paced', String(this.stalled)); this.stalled = 0; }
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
        const mapped = new Uint32Array(res.argsRead.getMappedRange());
        this.countsScratch ??= new Uint32Array(mapped.length);
        const v = this.countsScratch;
        v.set(mapped);
        const byLod: [number, number, number] = [0, 0, 0];
        let tris = 0;
        // Which buckets had anything in them, so the next frame can stop
        // encoding the ones that did not. See `warm` below.
        const warm = this.warm.length === res.buckets.length
          ? this.warm : new Uint8Array(res.buckets.length);
        for (let i = 0; i < res.buckets.length; i++) {
          const b = res.buckets[i];
          const n = v[(b.argsOffset / 4) + 1];
          byLod[b.lod] += n;
          tris += (n * b.vertices) / 3;
          // A short memory rather than a single frame: a bucket that flickers
          // in and out at a level-of-detail boundary would otherwise be
          // re-encoded and dropped on alternate frames, and every reappearance
          // costs it a frame of absence.
          warm[i] = n > 0 ? WARM_FRAMES : (warm[i] > 0 ? warm[i] - 1 : 0);
        }
        this.warm = warm;

        // And the casters, out of the tail of the same read.
        const castAt = res.argsReset.byteLength / 4;
        const cw = this.castWarm.length === res.casts.length
          ? this.castWarm : new Uint8Array(res.casts.length);
        for (let i = 0; i < res.casts.length; i++) {
          const n = v[castAt + (res.casts[i].argsOffset / 4) + 1];
          cw[i] = n > 0 ? WARM_FRAMES : (cw[i] > 0 ? cw[i] - 1 : 0);
        }
        this.castWarm = cw;

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
