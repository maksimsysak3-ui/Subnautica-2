/**
 * The river, and the valley it cut.
 *
 * A river is not decoration painted onto a map: it is the lowest thing on it,
 * and everything else has to answer to it. So this is folded into the terrain
 * height itself rather than added afterwards. The spawner's slope test then
 * refuses to build in the channel without knowing what a river is; the grading
 * ramps down to the banks because that is where the ground is; planting stops
 * at the water line; and a road has to bridge it, because the ground under it
 * genuinely is not there.
 *
 * The route is the part that has to be right, and the first two attempts were
 * not. A fixed ramp across the map put the water twenty-nine metres above its
 * own bank at one end. A meandering curve with the level pinned under whatever
 * land it happened to cross was perched almost everywhere, because a curve
 * drawn from noise crosses hills and hollows indifferently and a river does
 * not.
 *
 * So the river is routed the way water routes itself: downhill. It starts high
 * and repeatedly steps in the direction the land falls. Where it runs is then
 * a valley by construction, and the level along it falls by construction too.
 */

import { naturalHeightAt, standingWaterAt, lakeLevel } from './land';
import { simConfig } from './config';
import { MAP, SEA_LEVEL } from './maps';

/** Half the water's width at the mouth, in metres. */
const MOUTH = 58;
/** Half the width at the source. */
const SOURCE = 17;
/** How far below the water line the bed sits in midstream. */
const DEPTH = 6.5;
/** Metres of bank over which the valley blends back into open country. */
const BANK = 420;
/** Metres between points of the routed path. */
const STRIDE = 44;

interface Point {
  x: number;
  z: number;
  /** Distance along the river from its source. */
  s: number;
  /** Half the water's width here. */
  half: number;
  /** Water surface height. */
  level: number;
}

interface River {
  path: Point[];
  /** Nearest path index per cell of a coarse grid over the map, for lookups. */
  near: Int32Array;
  cells: number;
  extent: number;
}

let cached: River | null = null;
let cachedFor = -1;

/** Drops the routed river, for a change of map. */
export function forgetRiver(): void {
  cached = null;
  cachedFor = -1;
}

/**
 * Follows the land downhill from a high place on one edge to the far side.
 *
 * Steepest descent with momentum. Without the momentum the path rattles from
 * one side of a shallow hollow to the other and comes out as a zigzag; with
 * too much it drives straight over ridges. Two thirds old direction to one
 * third new is the ratio that reads as a river.
 */
function route(extent: number, angle: number): Point[] {
  // Routed in a frame turned by the map's angle, so "in from the west and
  // across" can be any edge: the land is read through the turn, and the path
  // is turned back into the world at the end.
  const ca = Math.cos(angle), sa = Math.sin(angle);
  const land = (x: number, z: number): number => naturalHeightAt(x * ca - z * sa, x * sa + z * ca);
  const grad = (x: number, z: number): [number, number] => {
    const h = 60;
    const dx = land(x + h, z) - land(x - h, z);
    const dz = land(x, z + h) - land(x, z - h);
    const n = Math.hypot(dx, dz) || 1;
    return [-dx / n, -dz / n];
  };

  // The source: the highest place along the western edge, but only the part of
  // it that leads somewhere. A river that follows the gradient from wherever
  // the land happens to be highest runs along whichever edge of the map that
  // is, and a river the player never sees is not worth having.
  let bestZ = 0, bestY = -Infinity;
  const x0 = -extent * 0.95;
  for (let i = 0; i <= 24; i++) {
    const z = -extent * 0.42 + (i / 24) * extent * 0.84;
    const y = land(x0, z);
    if (y > bestY) { bestY = y; bestZ = z; }
  }

  const path: Point[] = [];
  let x = x0, z = bestZ;
  let s = 0;
  // Starts heading east, so the river crosses the map rather than running off
  // the edge it began on.
  let dx = 1, dz = 0;
  const steps = Math.ceil((extent * 2.6) / STRIDE);
  for (let step = 0; step < steps; step++) {
    path.push({ x, z, s, half: 0, level: 0 });
    const [gx, gz] = grad(x, z);
    // Three terms. Momentum, so the path does not rattle between two sides of
    // a hollow. The gradient, which is the river's actual business. And a
    // standing bias east strong enough that the river crosses the map: at a
    // tenth it wandered forty kilometres over a nine-kilometre map, looped
    // back across itself, and buried a quarter of its own channel under the
    // valley the other branch had cut.
    //
    // Kept off the middle of the map. A river through the centre of the
    // buildable land is a wall across the one part of the site the player
    // actually wants, and no amount of bridge-building makes that a feature
    // when they did not choose it. So there is a repulsion from the origin,
    // strongest in the core and gone by the time the river is clear of it,
    // pushing whichever way the river already leans rather than picking a
    // side -- the shape stays the terrain's, the centre stays buildable.
    const core = extent * 0.42;
    const away = Math.max(0, 1 - Math.hypot(x, z) / core);
    const lean = z === 0 ? 1 : Math.sign(z);
    let nx = dx * 0.62 + gx * 0.26 + 0.30;
    let nz = dz * 0.62 + gz * 0.26 - (z / extent) * 0.40
           + lean * away * 0.85;
    const n = Math.hypot(nx, nz) || 1;
    nx /= n; nz /= n;
    dx = nx; dz = nz;
    x += nx * STRIDE;
    z += nz * STRIDE;
    s += STRIDE;
    if (Math.abs(x) > extent || Math.abs(z) > extent) break;
    // A river does not run into itself. If the path comes back within a couple
    // of strides of somewhere it has already been, stop: the alternative is a
    // loop whose two branches cut valleys at different heights through the
    // same ground, and the lower one swallows the higher one's water.
    let looped = false;
    for (let i = 0; i < path.length - 10; i++) {
      if ((path[i].x - x) ** 2 + (path[i].z - z) ** 2 < (STRIDE * 5) ** 2) { looped = true; break; }
    }
    if (looped) break;
  }
  for (const p of path) {
    const px = p.x, pz = p.z;
    p.x = px * ca - pz * sa;
    p.z = px * sa + pz * ca;
  }
  return path;
}

/**
 * The water surface along the path.
 *
 * It has to fall the whole way, and the land under the path does not: the
 * route goes downhill as far as it can, but it starts at the map's edge in the
 * hills and has to cross the plateau to the other edge, which is hills again.
 * Where the two disagree something gives, and what gives decides whether the
 * map is playable.
 *
 * Taking the land as the level from the mouth upward -- the water has to be
 * higher than wherever it flows to -- is right for a lake and wrong here: a
 * mouth in the far hills held everything upstream at least that high, and the
 * rule that keeps a river's bank above its water raised a causeway up to two
 * hundred metres tall across the map. Taking it from the source downward is
 * the mirror image: one deep valley at the rim and the whole river runs sixty
 * metres down a gorge through the middle of the town site.
 *
 * So the level is the falling line nearest the land, fitted -- and fitted
 * hardest in the middle of the map, where people build, so that is where the
 * water sits in its own country. The disagreement is settled out in the hills
 * at either end, as a cut through a ridge or a flooded valley, which is what
 * rivers do there anyway.
 */
function levels(path: Point[], width: number, extent: number): void {
  const n = path.length;
  const raw = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const p = path[i];
    const q = path[Math.min(n - 1, i + 1)];
    let tx = q.x - p.x, tz = q.z - p.z;
    const t = Math.hypot(tx, tz) || 1;
    tx /= t; tz /= t;
    // The lowest of a few points across the valley floor, so the line follows
    // the bottom of the country rather than whichever hummock it clipped.
    let lo = Infinity;
    for (const o of [-150, -60, 0, 60, 150]) {
      lo = Math.min(lo, naturalHeightAt(p.x - tz * o, p.z + tx * o));
    }
    raw[i] = lo;
  }
  const drop = 1.2;
  const fall = 0.05;
  // The target, tilted by the fall so that a line that only has to not rise
  // comes back as one that falls by at least that much a step.
  const want = new Float64Array(n);
  const weight = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    want[i] = raw[i] - drop + i * fall;
    const r = Math.hypot(path[i].x, path[i].z) / extent;
    const mid = Math.max(0, 1 - r / 0.65);
    weight[i] = 1 + 60 * mid * mid;
  }
  const fitted = fallingFit(want, weight);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = fitted[i] - i * fall;

  // Smoothed, so the surface is a gradient rather than a staircase.
  const R = 6;
  for (let i = 0; i < n; i++) {
    let sum = 0, c = 0;
    for (let k = -R; k <= R; k++) {
      const j = Math.min(n - 1, Math.max(0, i + k));
      sum += out[j]; c++;
    }
    path[i].level = sum / c;
    path[i].half = (SOURCE + (MOUTH - SOURCE) * (i / Math.max(1, n - 1))) * width;
  }
  // The average of a falling line falls, except where the window is clamped at
  // the ends; make sure of it there.
  for (let i = 1; i < n; i++) {
    path[i].level = Math.min(path[i].level, path[i - 1].level - fall * 0.5);
  }
}

/**
 * The non-rising sequence closest to `y`, in the weighted least-squares sense.
 * Pool-adjacent-violators: runs that rise are merged into one level at their
 * weighted mean until nothing rises. Linear in the length of the path.
 */
function fallingFit(y: Float64Array, w: Float64Array): Float64Array {
  const n = y.length;
  const level: number[] = [], mass: number[] = [], size: number[] = [];
  for (let i = 0; i < n; i++) {
    level.push(y[i]); mass.push(w[i]); size.push(1);
    while (level.length > 1 && level[level.length - 1] > level[level.length - 2]) {
      const b = level.length - 1, a = b - 1;
      const m = mass[a] + mass[b];
      level[a] = (level[a] * mass[a] + level[b] * mass[b]) / m;
      mass[a] = m; size[a] += size[b];
      level.pop(); mass.pop(); size.pop();
    }
  }
  const out = new Float64Array(n);
  let at = 0;
  for (let k = 0; k < level.length; k++) {
    for (let j = 0; j < size[k]; j++) out[at++] = level[k];
  }
  return out;
}

function river(): River {
  const extent = simConfig.terrainSize * 0.5;
  if (cached !== null && cachedFor === extent) return cached;
  const spec = MAP.river;
  const path = spec === null ? [] : route(extent, spec.angle);
  if (spec !== null) levels(path, spec.width, extent);

  // A coarse grid holding, per cell, the index of the nearest path point. A
  // lookup then searches a handful of points around that index rather than the
  // whole path -- which matters, because the terrain asks where the river is
  // more than a million times while its mesh is built.
  const cells = 160;
  const near = new Int32Array(cells * cells);
  for (let cz = 0; cz < cells; cz++) {
    for (let cx = 0; cx < cells; cx++) {
      const wx = -extent + ((cx + 0.5) / cells) * extent * 2;
      const wz = -extent + ((cz + 0.5) / cells) * extent * 2;
      let bestI = 0, bestD = Infinity;
      for (let i = 0; i < path.length; i++) {
        const d = (path[i].x - wx) ** 2 + (path[i].z - wz) ** 2;
        if (d < bestD) { bestD = d; bestI = i; }
      }
      near[cz * cells + cx] = bestI;
    }
  }
  cached = { path, near, cells, extent };
  cachedFor = extent;
  return cached;
}

/** The nearest point of river, exactly, using the grid to start the search. */
function nearest(x: number, z: number): { d: number; p: Point } | null {
  const r = river();
  if (r.path.length === 0) return null;
  const cx = Math.floor(((x + r.extent) / (r.extent * 2)) * r.cells);
  const cz = Math.floor(((z + r.extent) / (r.extent * 2)) * r.cells);
  if (cx < 0 || cz < 0 || cx >= r.cells || cz >= r.cells) return null;
  const seed = r.near[cz * r.cells + cx];
  // A grid cell is wider than the path's stride, so the true nearest point can
  // be several indices either side of the seed.
  const from = Math.max(0, seed - 14), to = Math.min(r.path.length - 1, seed + 14);
  let bestD = Infinity, best = r.path[seed];
  for (let i = from; i <= to; i++) {
    const d = (r.path[i].x - x) ** 2 + (r.path[i].z - z) ** 2;
    if (d < bestD) { bestD = d; best = r.path[i]; }
  }
  return { d: Math.sqrt(bestD), p: best };
}

/**
 * The valley, as a height and how strongly it applies.
 *
 * Returns the height the ground should be here and a weight between 0 and 1:
 * 1 in the channel, falling to 0 at the top of the bank. The caller mixes its
 * own natural terrain towards this, which is what makes the valley sit in the
 * landscape instead of being stamped on it.
 */
export function valleyAt(x: number, z: number):
{ y: number; w: number; water: number; bed: boolean } | null {
  const near = nearest(x, z);
  if (near === null) return null;
  const { d, p } = near;
  if (d > p.half + BANK) return null;

  if (d <= p.half) {
    // The bed: a trough rather than a flat floor, deepest in midstream.
    const t = d / p.half;
    return { y: p.level - DEPTH * (1 - t * t * 0.72), w: 1, water: p.level, bed: true };
  }
  // The bank, rising away from the water before it gives way to the country.
  // Smootherstep, so the top of the bank has no crease in it -- a linear blend
  // leaves one, and it catches the light as a hard line along the whole valley.
  const t = (d - p.half) / BANK;
  const s = t * t * t * (t * (t * 6 - 15) + 10);
  return { y: p.level + 0.5 + t * 9.0, w: 1 - s, water: p.level, bed: false };
}

/** The water surface height here, or null where there is no water. */
export function waterAt(x: number, z: number): number | null {
  const near = nearest(x, z);
  if (near !== null && near.d <= near.p.half) return near.p.level;
  return standingWaterAt(x, z);
}

/** Floats per water vertex: position, normal, across and along. */
export const WATER_FLOATS = 8;

/**
 * The water surface, as a mesh.
 *
 * A ribbon down the river rather than a plane over the whole map with the land
 * poking through it. A plane is simpler and wrong: it costs a full screen of
 * transparent shading everywhere the map is dry, and it puts a water surface
 * inside every hill.
 */
export function buildWaterMesh(): {
  vertices: Float32Array<ArrayBuffer>;
  indices: Uint32Array<ArrayBuffer>;
} {
  const r = river();
  const verts: number[] = [];
  const idx: number[] = [];
  let prev: number | null = null;
  for (let i = 0; i < r.path.length; i++) {
    const p = r.path[i];
    const q = r.path[Math.min(r.path.length - 1, i + 1)];
    const o = r.path[Math.max(0, i - 1)];
    let tx = q.x - o.x, tz = q.z - o.z;
    const t = Math.hypot(tx, tz) || 1;
    tx /= t; tz /= t;
    // A little wider than the channel, so the water tucks under the bank
    // rather than ending in a visible line on the bed.
    const w = p.half + 2.0;
    const a = verts.length / WATER_FLOATS;
    // Position, up normal, and how far across and along -- the same two
    // numbers the roads carry, for the same reason.
    verts.push(p.x + tz * w, p.level, p.z - tx * w, 0, 1, 0, -w, p.s);
    verts.push(p.x - tz * w, p.level, p.z + tx * w, 0, 1, 0, w, p.s);
    if (prev !== null) idx.push(prev, prev + 1, a + 1, prev, a + 1, a);
    prev = a;
  }
  // Standing water: the sea as one sheet under the whole map, and each lake as
  // a disc. Flat and far larger than the water itself, because the land is
  // the shoreline -- wherever the ground stands above the level it hides the
  // sheet, and the depth test draws the coast exactly where the terrain says.
  // `across` is pushed far off so the river's bank shading never applies, and
  // the pair carries the world position so the ripples tile continuously.
  const sheet = (cx: number, cz: number, rad: number, level: number, sides: number): void => {
    const c = verts.length / WATER_FLOATS;
    verts.push(cx, level, cz, 0, 1, 0, cx + 10000, cz);
    for (let k = 0; k < sides; k++) {
      const a = (k / sides) * Math.PI * 2;
      const x = cx + Math.cos(a) * rad, z = cz + Math.sin(a) * rad;
      verts.push(x, level, z, 0, 1, 0, x + 10000, z);
    }
    for (let k = 0; k < sides; k++) idx.push(c, c + 1 + ((k + 1) % sides), c + 1 + k);
  };
  if (MAP.sea !== null) sheet(0, 0, r.extent * 2.2, SEA_LEVEL, 8);
  MAP.lakes.forEach((l, i) => sheet(l.x, l.z, l.r * 1.35, lakeLevel(i), 40));

  const vertices = new Float32Array(new ArrayBuffer(verts.length * 4));
  vertices.set(verts);
  const indices = new Uint32Array(new ArrayBuffer(idx.length * 4));
  indices.set(idx);
  return { vertices, indices };
}
