/**
 * Natural resources: what the land is good for, and what is under it.
 *
 * Six of them, each a field over the city's ground made from the map itself
 * rather than scattered on it -- which is what makes a map's resources
 * something to read rather than to memorise:
 *
 *   fertile  flat, low ground, best near water, poor on a dry map
 *   forest   rolling country below the tree line, thick on a wet map
 *   ore      deposits in the hills
 *   oil      pools under low ground, found nowhere near where the ore is
 *   stone    steep ground and outcrops
 *   fish     the sea, the lakes, and a little in the river
 *
 * Each is multiplied by the map's richness for it (maps.ts), so the same rules
 * make a breadbasket of Broadwater and an oilfield of Ashfield. Built once per
 * map, lazily, on the view grid's shape so an info view can paint it directly.
 */

import { fbm } from './hash';
import { MAP } from './maps';
import { simConfig } from './config';
import { baseHeightAt } from './terrain';
import { waterAt } from './river';
import { standingWaterAt } from './land';

export type ResourceId = 'fertile' | 'forest' | 'ore' | 'oil' | 'stone' | 'fish';

export interface ResourceInfo {
  id: ResourceId;
  /** What the ground is, on the map. */
  name: string;
  /** What harvesting it makes, in the industry panel. */
  product: string;
  /** Glyph key in ui/glyphs.ts. */
  icon: string;
  /** The ramp the info view paints it in, faint to full. */
  ramp: [string, string, string];
  /** Whether it comes back: a field is replanted, a seam is not. */
  renewable: boolean;
  blurb: string;
}

export const RESOURCES: readonly ResourceInfo[] = [
  { id: 'fertile', name: 'Fertile land', product: 'Crops', icon: 'crop',
    ramp: ['#5a4a22', '#b89a3c', '#f2d45a'], renewable: true,
    blurb: 'Flat, low ground with water near it. Farms grow crops here, year after year.' },
  { id: 'forest', name: 'Forest', product: 'Timber', icon: 'timber',
    ramp: ['#1f3d24', '#3f8a4a', '#6fd07a'], renewable: true,
    blurb: 'Woodland below the tree line. Felled for timber, and it grows back.' },
  { id: 'ore', name: 'Ore', product: 'Ore', icon: 'ore',
    ramp: ['#3a2f45', '#8a6fb0', '#c9a8ff'], renewable: false,
    blurb: 'Metal ore in the hills. Mined out in time.' },
  { id: 'oil', name: 'Oil', product: 'Oil', icon: 'oil',
    ramp: ['#2c2320', '#8a5a2e', '#ff9a3c'], renewable: false,
    blurb: 'Pools under low ground. Pumped until the field runs dry.' },
  { id: 'stone', name: 'Stone', product: 'Stone', icon: 'stone',
    ramp: ['#33363a', '#8c9096', '#e2e6ea'], renewable: false,
    blurb: 'Rock on steep ground and outcrops. Quarried for building.' },
  { id: 'fish', name: 'Fish', product: 'Fish', icon: 'fish',
    ramp: ['#16334a', '#2f7fb0', '#6fd6ff'], renewable: true,
    blurb: 'The sea, the lakes and the river. Fished, and restocked if not overfished.' },
];

export const resourceById = (id: string): ResourceInfo =>
  RESOURCES.find((r) => r.id === id) ?? RESOURCES[0];

/** Cells across a resource field: the same grid as the information views. */
export const RES_GRID = 192;

export interface ResourceFields {
  map: string;
  /** Metres across the grid, centred on the origin. */
  extent: number;
  /** One byte a cell per resource, 0 to 255. */
  amount: Record<ResourceId, Uint8Array>;
  /** Share of all cells carrying each resource at all, 0 to 1. */
  cover: Record<ResourceId, number>;
  /** Mean amount where present, 0 to 1. */
  depth: Record<ResourceId, number>;
}

let cached: ResourceFields | null = null;

/**
 * Share of the land (of the water, for fish) each resource covers on a map
 * of ordinary richness for it; a map's richness scales it. Deposits, not
 * backgrounds: a tenth of the land is farmland worth farming, a twentieth
 * holds ore.
 */
const COVER: Record<ResourceId, number> = {
  fertile: 0.12, forest: 0.13, ore: 0.05, oil: 0.045, stone: 0.055, fish: 0.3,
};

const smooth = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Cells a deposit needs to count as one: smaller fragments are dropped. */
const MIN_DEPOSIT = 10;

/** Clears every 4-connected patch of fewer than `min` cells. */
function despeckle(a: Uint8Array, n: number, min: number): void {
  const seen = new Uint8Array(n * n);
  const stack: number[] = [];
  const patch: number[] = [];
  for (let k = 0; k < n * n; k++) {
    if (a[k] === 0 || seen[k] === 1) continue;
    stack.push(k); seen[k] = 1; patch.length = 0;
    while (stack.length > 0) {
      const c = stack.pop()!;
      patch.push(c);
      const i = c % n, j = (c - i) / n;
      if (i > 0 && a[c - 1] !== 0 && seen[c - 1] === 0) { seen[c - 1] = 1; stack.push(c - 1); }
      if (i < n - 1 && a[c + 1] !== 0 && seen[c + 1] === 0) { seen[c + 1] = 1; stack.push(c + 1); }
      if (j > 0 && a[c - n] !== 0 && seen[c - n] === 0) { seen[c - n] = 1; stack.push(c - n); }
      if (j < n - 1 && a[c + n] !== 0 && seen[c + n] === 0) { seen[c + n] = 1; stack.push(c + n); }
    }
    if (patch.length < min) for (const c of patch) a[c] = 0;
  }
}

/** The fields for the map in force, building them the first time they are asked for. */
export function resourceFields(): ResourceFields {
  if (cached !== null && cached.map === MAP.id && cached.extent === simConfig.cityGrid * 8) return cached;
  const N = RES_GRID;
  const extent = simConfig.cityGrid * 8;
  const cell = extent / N;
  const half = extent / 2;
  const M = MAP;
  const seed = M.seed;
  const at = (i: number): number => -half + (i + 0.5) * cell;

  // Heights and water once per cell; slope and distance to water from those.
  const h = new Float32Array(N * N);
  const wet = new Uint8Array(N * N);
  const river = new Uint8Array(N * N);
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const x = at(i), z = at(j);
      const k = j * N + i;
      h[k] = baseHeightAt(x, z);
      const w = waterAt(x, z);
      if (w !== null) {
        wet[k] = 1;
        // Water that is not a sea or a lake is the river.
        river[k] = standingWaterAt(x, z) === null ? 1 : 0;
      }
    }
  }
  // Distance to water in cells, by two chamfer passes.
  const far = new Float32Array(N * N).fill(1e6);
  for (let k = 0; k < N * N; k++) if (wet[k] === 1) far[k] = 0;
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const k = j * N + i;
      if (i > 0) far[k] = Math.min(far[k], far[k - 1] + 1);
      if (j > 0) far[k] = Math.min(far[k], far[k - N] + 1);
    }
  }
  for (let j = N - 1; j >= 0; j--) {
    for (let i = N - 1; i >= 0; i--) {
      const k = j * N + i;
      if (i < N - 1) far[k] = Math.min(far[k], far[k + 1] + 1);
      if (j < N - 1) far[k] = Math.min(far[k], far[k + N] + 1);
    }
  }

  const amount = {} as Record<ResourceId, Uint8Array>;
  const raw = {} as Record<ResourceId, Float32Array>;
  for (const r of RESOURCES) {
    amount[r.id] = new Uint8Array(N * N);
    raw[r.id] = new Float32Array(N * N);
  }
  const dry = Math.max(0, M.climate), lush = Math.max(0, -M.climate);
  const patch = (x: number, z: number, scale: number, salt: number): number =>
    fbm(x / scale, z / scale, 2, salt + seed);

  // First the suitability of every cell for every resource, 0 to 1 -- where
  // the ground is right for it. Scales are a few hundred metres, so a map
  // holds a few dozen separate deposits of each rather than a handful of
  // regions the size of a district.
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const k = j * N + i;
      const x = at(i), z = at(j);
      const e = h[k];
      const il = Math.max(0, i - 1), ir = Math.min(N - 1, i + 1);
      const jd = Math.max(0, j - 1), ju = Math.min(N - 1, j + 1);
      const slope = Math.hypot(h[j * N + ir] - h[j * N + il], h[ju * N + i] - h[jd * N + i])
        / (2 * cell);

      if (wet[k] === 1) {
        // Fish: shoals in the sea and the lakes, a little in the river.
        const stock = patch(x, z, 300, 751);
        raw.fish[k] = stock * (river[k] === 1 ? 0.6 : 1);
        continue;
      }
      const moist = 0.55 + 0.45 * Math.exp(-far[k] / 14);
      const flat = 1 - smooth(0.04, 0.12, slope);
      const low = 1 - smooth(40, 140, e);
      raw.fertile[k] = patch(x, z, 340, 601) * flat * low * moist * (1 - dry * 0.3);

      const treeLine = 1 - smooth(160, 270, e);
      raw.forest[k] = patch(x, z, 300, 631) * treeLine * (1 - dry * 0.4) * (1 + lush * 0.2);

      const hills = 0.6 + 0.4 * smooth(8, 70, e);
      const seam = patch(x, z, 210, 661);
      raw.ore[k] = seam * hills;

      // Oil where the ore is not, under low ground.
      raw.oil[k] = patch(x, z, 280, 691) * (1 - smooth(0.6, 0.75, seam) * 0.8) * (1 - smooth(60, 160, e));

      // Stone on the outcrops, and a little more where the ground is steep.
      raw.stone[k] = patch(x, z, 190, 721) * (0.8 + 0.2 * smooth(0.08, 0.24, slope));
    }
  }

  // Then the deposits: the best cells for each, up to a share of the land set
  // by the map's richness for it, and nothing anywhere else. A deposit is at
  // least half rich at its edge and full at its heart, so the view shows a
  // field with a hard edge and a farm drawn outside it harvests nothing.
  const land = wet.reduce((a, b) => a + (b === 0 ? 1 : 0), 0);
  const water = N * N - land;
  for (const r of RESOURCES) {
    const base = COVER[r.id];
    const pool = r.id === 'fish' ? water : land;
    const want = Math.round(pool * Math.min(0.32, base * M.richness[r.id]));
    const v = raw[r.id];
    if (want <= 0) continue;
    const sorted = Float32Array.from(v).sort();
    const cut = sorted[Math.max(0, sorted.length - want)];
    const top = sorted[sorted.length - 1];
    if (!(top > cut) || cut <= 0) continue;
    const out = amount[r.id];
    for (let k = 0; k < N * N; k++) {
      if (v[k] < cut || v[k] <= 0) continue;
      const t = (v[k] - cut) / (top - cut);
      out[k] = Math.round((0.5 + 0.5 * smooth(0, 0.6, t)) * 255);
    }
    despeckle(out, N, MIN_DEPOSIT);
  }

  const cover = {} as Record<ResourceId, number>;
  const depth = {} as Record<ResourceId, number>;
  for (const r of RESOURCES) {
    let n = 0, sum = 0;
    for (const v of amount[r.id]) if (v > 0) { n++; sum += v; }
    cover[r.id] = n / (N * N);
    depth[r.id] = n > 0 ? sum / n / 255 : 0;
  }
  cached = { map: M.id, extent, amount, cover, depth };
  return cached;
}

/** How much of a resource is at a world position, 0 to 1. */
export function resourceAt(id: ResourceId, x: number, z: number): number {
  const f = resourceFields();
  const i = Math.floor((x / f.extent + 0.5) * RES_GRID);
  const j = Math.floor((z / f.extent + 0.5) * RES_GRID);
  if (i < 0 || j < 0 || i >= RES_GRID || j >= RES_GRID) return 0;
  return f.amount[id][j * RES_GRID + i] / 255;
}
