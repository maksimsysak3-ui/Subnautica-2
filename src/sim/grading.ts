/**
 * Ground grading: the flat pads the city stands on.
 *
 * Buildings were sinking. The reason is not a bug in the placement -- it is
 * that a lot is up to thirty-five cells across and the ground under it is
 * not flat. A building is one rigid mesh with a flat underside, so it can
 * only stand at one height, and standing at the lowest corner of its lot
 * buries it under every other corner while standing at the highest leaves it
 * on stilts.
 *
 * Every city builder solves this the same way and so does this: the ground is
 * graded. Placing something levels the land under it and ramps out to the
 * terrain around it. That is not a cheat to hide a defect, it is what actually
 * happens when a site is developed, and it is why a real housing estate on a
 * hillside is a set of terraces rather than a set of tilted houses.
 *
 * The grid here is the corners of the zoning cells, and the terrain mesh has a
 * vertex on every one of them -- eight metres in both cases, both centred on
 * the origin. That alignment is what makes a pad exactly flat rather than
 * nearly flat: every vertex inside a lot is a pinned sample, so there is
 * nothing left for interpolation to get wrong.
 */

import { simConfig } from './config';

/** Cells the ramp from a pad out to open ground is spread over. */
const RAMP = 4;

/** Height offset per cell corner, or null before any grading has been done. */
let offset: Float32Array<ArrayBuffer> | null = null;
/** Corners pinned by a pad, and therefore exactly level. */
let pinned: Uint8Array | null = null;
let stride = 0;

/** Metres per zoning cell. The grid the pads and the terrain mesh share. */
export const CELL = 8;

/** Ungraded height at every cell corner, computed once. */
let corners: Float32Array | null = null;

/**
 * The ungraded ground at a cell corner.
 *
 * Cached because the spawner asks for every corner of every lot it considers,
 * and a thirty-five by twenty-six lot is nine hundred and thirty-six of them.
 * Sampling the noise each time cost a second of startup; the whole corner grid
 * is a hundred and ninety thousand samples and is wanted by the grading pass
 * regardless.
 */
export function baseAtCorner(gx: number, gz: number, base: (x: number, z: number) => number): number {
  const grid = simConfig.cityGrid;
  const n = grid + 1;
  if (corners === null || corners.length !== n * n) {
    corners = new Float32Array(n * n);
    const half = grid / 2;
    for (let z = 0; z < n; z++) {
      for (let x = 0; x < n; x++) {
        corners[z * n + x] = base((x - half) * CELL, (z - half) * CELL);
      }
    }
  }
  if (gx < 0 || gz < 0 || gx >= n || gz >= n) return base((gx - grid / 2) * CELL, (gz - grid / 2) * CELL);
  return corners[gz * n + gx];
}

export interface Pad {
  /** Cell coordinates of the low corner. */
  gx: number;
  gz: number;
  /** Size in cells. */
  w: number;
  d: number;
  /** The height the ground should be at, in metres. */
  y: number;
}

/** Throws the grading away. The ground is whatever the noise says again. */
export function clearGrading(): void {
  offset = null;
  pinned = null;
  corners = null;
}

/**
 * Levels the ground under each pad and ramps out to the terrain around it.
 *
 * `base` is the ungraded height at a world position -- passed in rather than
 * imported so this module has no opinion about where the terrain comes from,
 * which is what will let a player's own earthworks share it later.
 *
 * The ramp is relaxation rather than a distance field: pinned corners hold
 * their value and everything else is repeatedly averaged with its neighbours,
 * which spreads each pad's influence about one cell per pass and settles into
 * a smooth surface between pads at different heights. Six passes is a ramp of
 * roughly thirty metres, which is a street's width and looks like grading
 * rather than like a wall.
 */
export function gradeGround(pads: readonly Pad[], base: (x: number, z: number) => number): void {
  const grid = simConfig.cityGrid;
  stride = grid + 1;
  const n = stride * stride;
  offset = new Float32Array(n);
  pinned = new Uint8Array(n);

  for (const pad of pads) {
    // Corners, not cells: a lot of w cells spans w + 1 corners, and pinning
    // only the cells would leave the lot's own edge free to tilt.
    for (let j = 0; j <= pad.d; j++) {
      const gz = pad.gz + j;
      if (gz < 0 || gz >= stride) continue;
      for (let i = 0; i <= pad.w; i++) {
        const gx = pad.gx + i;
        if (gx < 0 || gx >= stride) continue;
        const k = gz * stride + gx;
        const want = pad.y - baseAtCorner(gx, gz, base);
        // Where two pads meet, the higher one wins. A lot that lost would be
        // left with its own ground cut away under one edge, which is the
        // sunken building again by another route.
        if (pinned[k] === 0 || want > offset[k]) offset[k] = want;
        pinned[k] = 1;
      }
    }
  }

  // Relaxation. Two buffers, because averaging in place propagates a value
  // across the whole grid in one pass in the direction of the sweep and
  // produces a visible bias towards one corner of the map.
  let src: Float32Array<ArrayBuffer> = offset;
  let dst: Float32Array<ArrayBuffer> = new Float32Array(n);
  for (let pass = 0; pass < RAMP + 2; pass++) {
    for (let z = 0; z < stride; z++) {
      for (let x = 0; x < stride; x++) {
        const k = z * stride + x;
        if (pinned[k]) { dst[k] = src[k]; continue; }
        let sum = 0;
        let count = 0;
        if (x > 0) { sum += src[k - 1]; count++; }
        if (x + 1 < stride) { sum += src[k + 1]; count++; }
        if (z > 0) { sum += src[k - stride]; count++; }
        if (z + 1 < stride) { sum += src[k + stride]; count++; }
        // Decayed, not just averaged: without the decay the offset spreads
        // over the whole map and the hills flatten out along with the city.
        dst[k] = count > 0 ? (sum / count) * 0.86 : 0;
      }
    }
    const swap = src; src = dst; dst = swap;
  }
  offset = src;
}

/**
 * The grading offset at a world position, in metres.
 *
 * Bilinear across the corner grid. Inside a pad every corner carries the same
 * target, so the interpolation is exact and the lot is level to the
 * millimetre; outside one it is the relaxed ramp.
 */
export function gradingAt(x: number, z: number): number {
  const off = offset;
  if (off === null) return 0;
  const half = simConfig.cityGrid / 2;
  const fx = x / CELL + half;
  const fz = z / CELL + half;
  if (fx < 0 || fz < 0 || fx > stride - 1 || fz > stride - 1) return 0;
  const x0 = Math.floor(fx), z0 = Math.floor(fz);
  const x1 = Math.min(x0 + 1, stride - 1), z1 = Math.min(z0 + 1, stride - 1);
  const tx = fx - x0, tz = fz - z0;
  const a = off[z0 * stride + x0], b = off[z0 * stride + x1];
  const c = off[z1 * stride + x0], d = off[z1 * stride + x1];
  return (a + (b - a) * tx) * (1 - tz) + (c + (d - c) * tx) * tz;
}
