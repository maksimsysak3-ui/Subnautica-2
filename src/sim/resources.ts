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

const smooth = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

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
  for (const r of RESOURCES) amount[r.id] = new Uint8Array(N * N);
  const dry = Math.max(0, M.climate), lush = Math.max(0, -M.climate);
  const patch = (x: number, z: number, scale: number, salt: number): number =>
    fbm(x / scale, z / scale, 3, salt + seed);

  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const k = j * N + i;
      const x = at(i), z = at(j);
      const e = h[k];
      const il = Math.max(0, i - 1), ir = Math.min(N - 1, i + 1);
      const jd = Math.max(0, j - 1), ju = Math.min(N - 1, j + 1);
      const slope = Math.hypot(h[j * N + ir] - h[j * N + il], h[ju * N + i] - h[jd * N + i])
        / (2 * cell);
      const put = (id: ResourceId, v: number): void => {
        const rich = M.richness[id];
        const out = Math.min(1, v * rich);
        amount[id][k] = out < 0.1 ? 0 : Math.round(out * 255);
      };

      if (wet[k] === 1) {
        // Fish: the sea and the lakes carry them, the river a little.
        const stock = 0.45 + 0.55 * smooth(0.35, 0.7, patch(x, z, 420, 751));
        put('fish', stock * (river[k] === 1 ? 0.45 : 1));
        continue;
      }
      const moist = 0.5 + 0.5 * Math.exp(-far[k] / 14);
      const flat = 1 - smooth(0.03, 0.11, slope);
      const low = 1 - smooth(35, 130, e);
      const soil = smooth(0.44, 0.62, patch(x, z, 640, 601));
      put('fertile', flat * low * moist * soil * (1 - dry * 0.45) * 1.25);

      const wood = smooth(0.46, 0.63, patch(x, z, 520, 631));
      const treeLine = 1 - smooth(150, 260, e);
      const rolling = 0.55 + 0.45 * smooth(0.02, 0.1, slope);
      put('forest', wood * treeLine * rolling * (1 - dry * 0.7) * (1 + lush * 0.35));

      const seam = smooth(0.64, 0.78, patch(x, z, 380, 661));
      const hills = 0.55 + 0.45 * smooth(8, 70, e);
      put('ore', seam * hills * 1.35);

      // Oil where the ore is not: the same kind of noise, a different salt, and
      // pushed away from the seams so the two industries compete for nothing.
      const pool = smooth(0.66, 0.8, patch(x, z, 620, 691)) * (1 - seam * 0.8);
      put('oil', pool * (1 - smooth(50, 150, e)));

      const crag = smooth(0.1, 0.24, slope);
      const outcrop = smooth(0.7, 0.84, patch(x, z, 300, 721));
      put('stone', Math.max(crag * 0.9, outcrop * 0.75));
    }
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
