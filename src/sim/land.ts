/**
 * The land, before there is a river in it or a city on it.
 *
 * Its own module because the river has to read it -- a river runs in the low
 * ground, and where the low ground is is a question about this function --
 * while the terrain has to read the river. Left in one file that is a cycle;
 * split in two it is a line.
 */

import { fbm } from './hash';
import { simConfig } from './config';
import { MAP, SEA_LEVEL } from './maps';
import type { Lake, Sea } from './maps';

/** The hills alone, before any sea or lake is cut into them. */
function rawHeightAt(x: number, z: number): number {
  const M = MAP;
  const s = 1 / (1100 * M.scale);
  const hills = (fbm(x * s, z * s, 5, 101 + M.seed) - 0.5) * 2;      // [-1, 1]
  const ridges = (fbm(x * s * 3.7, z * s * 3.7, 3, 233 + M.seed) - 0.5) * 2;

  // Distance from the city centre, 0 at origin and 1 at the map edge.
  const d = Math.min(Math.hypot(x, z) / (simConfig.terrainSize * 0.5), 1);
  const relief = Math.pow(Math.max(0, (d - M.flat) / (1 - M.flat)), 1.05);

  // Fine undulation everywhere, including under the city. Undamped by the
  // relief ramp on purpose: without it the buildable centre is a dead-flat
  // plate that reads as a bug from overhead, and at +/-2 m over a ~90 m
  // wavelength it is shallow enough to build on and steep enough to shade.
  const detail = (fbm(x / 90, z / 90, 3, 909 + M.seed) - 0.5) * 2 * 2.1;

  return (hills * 150 * M.relief + ridges * 34 * M.ridges) * relief + detail;
}

/** How far below the sea the seabed settles, in metres. Read at use: `maps.ts`
 * imports this module, so its constants are not there yet when this one loads. */
const SEABED_DEPTH = 26;

/**
 * Metres past the shoreline (negative inland), and how much of the land near it
 * holds up as a headland rather than settling to a beach.
 */
function shore(x: number, z: number, sea: Sea, seed: number): { s: number; cliff: number } {
  let s: number, v: number;
  if (sea.kind === 'coast') {
    const c = Math.cos(sea.angle), sn = Math.sin(sea.angle);
    const u = x * c + z * sn;
    v = -x * sn + z * c;
    // Bays a kilometre or two across, and coves inside them.
    const wig = (fbm(v / 1100, 7.3, 3, 401 + seed) - 0.5) * 2 * 900
      + (fbm(v / 330, 2.1, 2, 433 + seed) - 0.5) * 2 * 200;
    s = u + wig - sea.at;
  } else {
    const r = Math.hypot(x, z);
    const a = Math.atan2(z, x);
    v = a * 2600;
    const wig = (fbm(Math.cos(a) * 2.2 + 9, Math.sin(a) * 2.2 + 9, 3, 461 + seed) - 0.5) * 2 * 560
      + (fbm(Math.cos(a) * 7 + 3, Math.sin(a) * 7 + 3, 2, 487 + seed) - 0.5) * 2 * 170;
    s = r + wig - sea.at;
  }
  const cliff = smoothstep(0.56, 0.74, fbm(v / 900, 3.7, 2, 523 + seed));
  return { s, cliff };
}

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** Each lake's water level, for the map in force: the land at its middle, less a little. */
let lakeLevels: number[] = [];
let lakeLevelsFor = '';
export function lakeLevel(i: number): number {
  if (lakeLevelsFor !== MAP.id) {
    lakeLevels = MAP.lakes.map((l) => rawHeightAt(l.x, l.z) - 2.5);
    lakeLevelsFor = MAP.id;
  }
  return lakeLevels[i];
}

/** Distance from a lake's middle in radii, with the shore broken up. */
function lakeD(x: number, z: number, l: Lake, i: number): number {
  const wob = (fbm(x / 260, z / 260, 2, 511 + i * 17 + MAP.seed) - 0.5) * 0.42;
  return Math.hypot(x - l.x, z - l.z) / l.r + wob;
}

export function naturalHeightAt(x: number, z: number): number {
  let h = rawHeightAt(x, z);
  const M = MAP;
  if (M.sea !== null) {
    const { s: past, cliff } = shore(x, z, M.sea, M.seed);
    // Inland ground never sits below the sea: a hollow that dips under it is
    // held a metre above the water by a smooth floor, or every low field on
    // a coastal map floods as a salt pond the sea never reached.
    const floor = SEA_LEVEL + 1.2, k = 2.5;
    const dh = h - floor;
    h = floor + (dh + Math.sqrt(dh * dh + k * k)) / 2;
    if (past > -1100) {
      // The land settles to a low coastal strip a metre or two above the water
      // over its last kilometre, except where a headland holds it up -- beaches
      // mostly, and a few cliffs, which is what a coast is. Without this every
      // shore was a bank of dark rock, because the hills run straight into it.
      const settle = smoothstep(-1100, -80, past) * (1 - cliff * 0.75);
      h += (SEA_LEVEL + 1.4 + Math.max(0, h - SEA_LEVEL) * 0.08 - h) * settle;
      const out = smoothstep(-40, 600, past);
      h += (SEA_LEVEL - SEABED_DEPTH - h) * out;
    }
  }
  for (let i = 0; i < M.lakes.length; i++) {
    const l = M.lakes[i];
    if (Math.abs(x - l.x) > l.r * 2.3 || Math.abs(z - l.z) > l.r * 2.3) continue;
    const level = lakeLevel(i);
    const d = lakeD(x, z, l, i);
    // A rim, so the water is held in: ground that would sit below the lake's
    // level just outside it is lifted to a bank above it.
    const rim = 1 - smoothstep(1.5, 2.1, d);
    if (h < level + 1.2) h += (level + 1.2 - h) * rim;
    // And the bowl, deepest in the middle.
    const bowl = 1 - smoothstep(0.82, 1.08, d);
    const floor = level - 0.6 - 7 * (1 - Math.min(1, d) ** 2);
    if (floor < h) h += (floor - h) * bowl;
  }
  return h;
}

/** The level of any sea or lake standing here, or null. Not the river: see river.ts. */
export function standingWaterAt(x: number, z: number): number | null {
  const M = MAP;
  if (M.sea === null && M.lakes.length === 0) return null;
  const h = naturalHeightAt(x, z);
  if (M.sea !== null && h < SEA_LEVEL) return SEA_LEVEL;
  for (let i = 0; i < M.lakes.length; i++) {
    const l = M.lakes[i];
    if (Math.hypot(x - l.x, z - l.z) > l.r * 1.35) continue;
    const level = lakeLevel(i);
    if (h < level) return level;
  }
  return null;
}

/**
 * Whether ground at `lo` metres near (x, z) is too close to a sea or lake to build on.
 *
 * Half a metre of freeboard. The seabed is flat, and a slope test alone would
 * happily put a street of houses on it.
 */
export function drowned(x: number, z: number, lo: number): boolean {
  const M = MAP;
  if (M.sea !== null && lo < SEA_LEVEL + 0.5) return true;
  for (let i = 0; i < M.lakes.length; i++) {
    const l = M.lakes[i];
    if (Math.hypot(x - l.x, z - l.z) > l.r * 1.7) continue;
    if (lo < lakeLevel(i) + 0.5) return true;
  }
  return false;
}
