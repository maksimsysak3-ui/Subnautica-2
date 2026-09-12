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

/**
 * Cells the ramp from a pad out to open ground is spread over.
 *
 * Four was too few. The relaxation decays fast, so the first unpinned corner
 * beside a pad takes about a fifth of its offset -- which for a road cut five
 * metres into a hillside is a four-metre step across one eight-metre facet,
 * steep enough that the terrain shader sheds its turf and draws bare earth.
 * That is what the band of scarred ground across every junction approach was.
 * Nine cells and a slower decay spread the same cut over seventy metres, which
 * is what a real cutting looks like and what a bulldozer would actually do.
 */
const RAMP = 9;

/** Height offset per cell corner, or null before any grading has been done. */
let offset: Float32Array<ArrayBuffer> | null = null;
/** Corners pinned by a pad, and therefore exactly level. */
let pinned: Uint8Array | null = null;
let stride = 0;

/** Metres per zoning cell. The grid the pads and the terrain mesh share. */
export const CELL = 8;

/** Ungraded height at every cell corner, computed once. */
let corners: Float32Array | null = null;

/** World-space box, or null meaning "assume everything". */
export interface Bounds { x0: number; z0: number; x1: number; z1: number; }

/** The grading as it stood before the last pass, for diffing against. */
let previous: Float32Array | null = null;
let scratchOffset: Float32Array<ArrayBuffer> | null = null;
let scratchPinned: Uint8Array | null = null;
let scratchDst: Float32Array<ArrayBuffer> | null = null;
let changed: Bounds | null = null;

/**
 * Where the ground actually moved in the last grading pass.
 *
 * Null means "everywhere, or it cannot be known" -- the first pass, or a change
 * of map size.
 *
 * This exists because rebuilding the terrain mesh is most of what an edit
 * costs, and almost none of it is necessary: drawing one street changes the
 * ground under that street and nowhere else, while the mesh was regenerated
 * from end to end. The offsets are compared rather than reasoned about, so the
 * answer is exact -- a chunk outside this box is provably identical to the one
 * already on the GPU, not merely likely to be.
 */
export function gradedSince(): Bounds | null {
  return changed;
}

/** Forgets the comparison, so the next pass reports everything. */
export function forgetGrading(): void {
  previous = null;
  changed = null;
}

/**
 * The ungraded ground at a cell corner.
 *
 * Cached because the spawner asks for every corner of every lot it considers,
 * and a thirty-five by twenty-six lot is nine hundred and thirty-six of them.
 * Sampling the noise each time cost a second of startup; the whole corner grid
 * is a hundred and ninety thousand samples and is wanted by the grading pass
 * regardless.
 */
/** Lowest cell index the cache covers; negative, because it reaches outside. */
let cornerFrom = 0;
/** Corners across one side of the cache. */
let cornerSpan = 0;

/**
 * Makes sure the cache exists and covers the whole map.
 *
 * The whole *terrain*, not just the city. The map is wider than the zoned area
 * -- nine kilometres against five -- so two thirds of the terrain mesh sits
 * outside the cell grid, and a cache that stopped at the grid's edge left every
 * one of those vertices resampling three octaves of noise and a river lookup on
 * every rebuild. That was the single largest term in an edit.
 *
 * Filled lazily, one corner at a time, because filling it eagerly is one and a
 * third million samples and that lands on the loading screen. NaN marks a
 * corner nobody has asked for yet: a height is never NaN, so the flag costs no
 * second array.
 */
function ensureCorners(): void {
  const grid = simConfig.cityGrid;
  const reach = Math.ceil(simConfig.terrainSize / 2 / CELL) + 2;
  const from = Math.min(0, grid / 2 - reach);
  const span = Math.max(grid + 1, reach * 2 + 1);
  if (corners !== null && cornerFrom === from && cornerSpan === span) return;
  corners = new Float32Array(span * span).fill(NaN);
  cornerFrom = from;
  cornerSpan = span;
}

export function baseAtCorner(gx: number, gz: number, base: (x: number, z: number) => number): number {
  ensureCorners();
  const half = simConfig.cityGrid / 2;
  const ix = gx - cornerFrom, iz = gz - cornerFrom;
  if (ix < 0 || iz < 0 || ix >= cornerSpan || iz >= cornerSpan) {
    return base((gx - half) * CELL, (gz - half) * CELL);
  }
  const k = iz * cornerSpan + ix;
  const was = (corners as Float32Array)[k];
  if (!Number.isNaN(was)) return was;
  const y = base((gx - half) * CELL, (gz - half) * CELL);
  (corners as Float32Array)[k] = y;
  return y;
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

/**
 * Throws the grading away. The ground is whatever the noise says again.
 *
 * The corner cache deliberately survives. It holds the *ungraded* ground --
 * the terrain function and the river, neither of which a player can change --
 * so dropping it here meant every rebuild resampled four hundred thousand
 * corners of three-octave noise. That was half of what an edit cost, and an
 * edit happens on every road drawn and every block zoned.
 */
export function clearGrading(): void {
  offset = null;
  pinned = null;
}

/** Drops the ungraded ground too, for a tool that changes the terrain itself. */
export function clearTerrainCache(): void {
  corners = null;
  forgetGrading();
  onTerrainChange?.();
}

/**
 * Told when the ground itself changes, so caches built against it can go.
 *
 * A callback rather than an import: the countryside cache lives in the spawner,
 * which imports this file, and calling it from here directly would be a cycle.
 */
let onTerrainChange: (() => void) | null = null;

export function whenTerrainChanges(fn: () => void): void {
  onTerrainChange = fn;
}

/**
 * Builds the corner cache now rather than on the first thing that asks.
 *
 * Four hundred thousand corners of three-octave noise is most of a second, and
 * it lands inside whatever happens to touch the ground first -- which at boot
 * is the city build, making one long block out of two shorter ones. Doing it
 * deliberately lets the loading screen draw in between.
 */
export function warmTerrain(base: (x: number, z: number) => number): void {
  ensureCorners();
  // The zoned area only. The rest of the map fills itself the first time the
  // terrain mesh is built, which happens on the next step of the same loading
  // screen -- filling it here as well would double this step for nothing.
  const grid = simConfig.cityGrid;
  for (let gz = 0; gz <= grid; gz++) {
    for (let gx = 0; gx <= grid; gx++) baseAtCorner(gx, gz, base);
  }
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
/**
 * A single cell corner held at an exact height.
 *
 * Pads are rectangles and a road is not one. Cutting a road as a chain of
 * small rectangles has them meet at shared corners, and the higher-wins rule
 * then takes the uphill value at every join -- which turns a ramp into a
 * staircase and leaves the carriageway below the ground over most of each
 * step. A road pins the corners it actually covers, at the height it actually
 * has there.
 */
export interface Pin {
  gx: number;
  gz: number;
  y: number;
}

export function gradeGround(pads: readonly Pad[], base: (x: number, z: number) => number,
  pins: readonly Pin[] = [], only?: Bounds | null): void {
  const grid = simConfig.cityGrid;
  stride = grid + 1;
  const n = stride * stride;
  // Reused between passes. Three arrays of four hundred thousand floats
  // allocated on every edit is a megabyte and a half of garbage for an answer
  // that mostly does not change, and the collector charges for it later.
  if (scratchOffset === null || scratchOffset.length !== n) {
    scratchOffset = new Float32Array(n);
    scratchPinned = new Uint8Array(n);
    scratchDst = new Float32Array(n);
  } else {
    scratchOffset.fill(0);
    scratchPinned!.fill(0);
  }
  offset = scratchOffset;
  pinned = scratchPinned as Uint8Array;
  const mark = pinned;

  // With a hint, only the pads inside it are worth pinning: outside the box the
  // offsets are copied from the previous pass, which already pinned them.
  const h0 = only === undefined || only === null ? null : {
    x0: Math.floor(only.x0 / CELL + simConfig.cityGrid / 2) - RAMP - 4,
    z0: Math.floor(only.z0 / CELL + simConfig.cityGrid / 2) - RAMP - 4,
    x1: Math.ceil(only.x1 / CELL + simConfig.cityGrid / 2) + RAMP + 4,
    z1: Math.ceil(only.z1 / CELL + simConfig.cityGrid / 2) + RAMP + 4,
  };
  for (const pad of pads) {
    if (h0 !== null && (pad.gx + pad.w < h0.x0 || pad.gx > h0.x1
      || pad.gz + pad.d < h0.z0 || pad.gz > h0.z1)) continue;
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
        if (mark[k] === 0 || want > offset[k]) offset[k] = want;
        mark[k] = 1;
      }
    }
  }

  // Pins last, so they win over any pad that overlapped them. A building
  // beside a road must not lift the road it fronts onto.
  for (const p of pins) {
    if (p.gx < 0 || p.gz < 0 || p.gx >= stride || p.gz >= stride) continue;
    if (h0 !== null && (p.gx < h0.x0 || p.gx > h0.x1 || p.gz < h0.z0 || p.gz > h0.z1)) continue;
    const k = p.gz * stride + p.gx;
    offset[k] = p.y - baseAtCorner(p.gx, p.gz, base);
    mark[k] = 1;
  }

  // Relaxation. Two buffers, because averaging in place propagates a value
  // across the whole grid in one pass in the direction of the sweep and
  // produces a visible bias towards one corner of the map.
  // How far the relaxation can possibly reach.
  //
  // Each pass moves a value one corner, so after `RAMP + 2` passes nothing
  // more than that many corners from a pad can be anything but zero -- it is
  // provably zero, not approximately. Relaxing the rest of the map anyway cost
  // four and a half million iterations on every edit whatever the size of the
  // city, which on a map that is mostly empty is the whole of the work for
  // none of the result.
  const reach = RAMP + 3;
  let bx0 = stride, bz0 = stride, bx1 = -1, bz1 = -1;
  // A hint from the caller: only this part of the map can have moved.
  //
  // The pad list is every building in the city, so the box it spans is the
  // city -- and relaxing that box eleven times over is most of what grading
  // costs on a big map, to produce, outside the edit, exactly the offsets that
  // were there before. When the caller knows which pads are new, everything
  // else keeps the height it already had.
  if (only !== undefined && only !== null) {
    const h = simConfig.cityGrid / 2;
    bx0 = Math.max(0, Math.floor(only.x0 / CELL + h) - reach);
    bz0 = Math.max(0, Math.floor(only.z0 / CELL + h) - reach);
    bx1 = Math.min(stride - 1, Math.ceil(only.x1 / CELL + h) + reach);
    bz1 = Math.min(stride - 1, Math.ceil(only.z1 / CELL + h) + reach);
  } else {
  const cover = (gx: number, gz: number, w: number, d: number): void => {
    bx0 = Math.min(bx0, gx - reach); bz0 = Math.min(bz0, gz - reach);
    bx1 = Math.max(bx1, gx + w + reach); bz1 = Math.max(bz1, gz + d + reach);
  };
  for (const pad of pads) cover(pad.gx, pad.gz, pad.w, pad.d);
  for (const p of pins) cover(p.gx, p.gz, 0, 0);
  bx0 = Math.max(0, bx0); bz0 = Math.max(0, bz0);
  bx1 = Math.min(stride - 1, bx1); bz1 = Math.min(stride - 1, bz1);
  }
  if (bx1 < bx0 || bz1 < bz0) {        // nothing graded anywhere
    settle(offset, null);
    return;
  }

  // Outside the box, the previous pass's answer stands: it was computed from
  // pads that have not moved and terrain that cannot.
  if (only !== undefined && only !== null && previous !== null && previous.length === n) {
    // The whole array in one copy, then the box cleared back out of it. A
    // nested loop that skipped the box touched four hundred thousand cells one
    // at a time to do the same thing; `set` is a memory copy and `fill` on each
    // row of the box is another, and together they are a fraction of it.
    const keep = offset;
    keep.set(previous);
    for (let z = bz0; z <= bz1; z++) {
      keep.fill(0, z * stride + bx0, z * stride + bx1 + 1);
    }
    // The pads and pins inside the box have already been written; put them back
    // over the zeroes.
    for (const pad of pads) {
      if (h0 !== null && (pad.gx + pad.w < h0.x0 || pad.gx > h0.x1
        || pad.gz + pad.d < h0.z0 || pad.gz > h0.z1)) continue;
      for (let j = 0; j <= pad.d; j++) {
        const gz = pad.gz + j;
        if (gz < 0 || gz >= stride) continue;
        for (let i = 0; i <= pad.w; i++) {
          const gx = pad.gx + i;
          if (gx < 0 || gx >= stride || gx < bx0 || gx > bx1 || gz < bz0 || gz > bz1) continue;
          const k = gz * stride + gx;
          const want = pad.y - baseAtCorner(gx, gz, base);
          if (mark[k] === 0 || want > keep[k]) keep[k] = want;
        }
      }
    }
    for (const p of pins) {
      if (p.gx < bx0 || p.gx > bx1 || p.gz < bz0 || p.gz > bz1) continue;
      keep[p.gz * stride + p.gx] = p.y - baseAtCorner(p.gx, p.gz, base);
    }
  }

  let src: Float32Array<ArrayBuffer> = offset;
  let dst: Float32Array<ArrayBuffer> = scratchDst!;
  for (let pass = 0; pass < RAMP + 2; pass++) {
    for (let z = bz0; z <= bz1; z++) {
      for (let x = bx0; x <= bx1; x++) {
        const k = z * stride + x;
        if (mark[k]) { dst[k] = src[k]; continue; }
        let sum = 0;
        let count = 0;
        if (x > 0) { sum += src[k - 1]; count++; }
        if (x + 1 < stride) { sum += src[k + 1]; count++; }
        if (z > 0) { sum += src[k - stride]; count++; }
        if (z + 1 < stride) { sum += src[k + stride]; count++; }
        // Decayed, not just averaged: without the decay the offset spreads
        // over the whole map and the hills flatten out along with the city.
        dst[k] = count > 0 ? (sum / count) * 0.93 : 0;
      }
    }
    const swap = src; src = dst; dst = swap;
  }
  offset = src;
  settle(offset, { x0: bx0, z0: bz0, x1: bx1, z1: bz1 });
}

/**
 * Records what moved, against the previous pass.
 *
 * One linear scan of the corner grid. It costs a fraction of a millisecond and
 * it saves regenerating thirty-six terrain chunks, so the trade is not close.
 *
 * The epsilon is a tenth of a millimetre: an offset that differs by less than
 * that cannot move a vertex anywhere the eye could find it, and treating exact
 * equality as the test would report the whole map as changed every time a
 * float landed one unit in the last place away from where it did before.
 */
function settle(next: Float32Array,
  look: { x0: number; z0: number; x1: number; z1: number } | null): void {
  const half = simConfig.cityGrid / 2;
  if (previous === null || previous.length !== next.length) {
    previous = next.slice();
    changed = null;
    return;
  }
  // `next` is one of the two ping-pong buffers and the other is about to be
  // written over, so the record of what stood before has to be its own array --
  // but it can be the same one every time.
  // Only where the relaxation ran. Outside that box the offsets were copied
  // straight from the previous pass, so they are equal by construction and
  // comparing four hundred thousand of them to find that out is a sweep of the
  // whole map on every edit.
  const sx0 = look === null ? 0 : Math.max(0, look.x0);
  const sz0 = look === null ? 0 : Math.max(0, look.z0);
  const sx1 = look === null ? stride - 1 : Math.min(stride - 1, look.x1);
  const sz1 = look === null ? stride - 1 : Math.min(stride - 1, look.z1);
  let cx0 = stride, cz0 = stride, cx1 = -1, cz1 = -1;
  for (let z = sz0; z <= sz1; z++) {
    const row = z * stride;
    for (let x = sx0; x <= sx1; x++) {
      if (Math.abs(next[row + x] - previous[row + x]) <= 1e-4) continue;
      if (x < cx0) cx0 = x;
      if (x > cx1) cx1 = x;
      if (z < cz0) cz0 = z;
      if (z > cz1) cz1 = z;
    }
  }
  previous.set(next);
  if (cx1 < cx0) {
    // Nothing moved at all. A zoning edit that grew no buildings, or a road
    // redrawn where one already was.
    changed = { x0: 0, z0: 0, x1: 0, z1: 0 };
    return;
  }
  // One cell of margin either way, because a corner's move tilts the facets on
  // both sides of it.
  changed = {
    x0: (cx0 - half - 1) * CELL, z0: (cz0 - half - 1) * CELL,
    x1: (cx1 - half + 1) * CELL, z1: (cz1 - half + 1) * CELL,
  };
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
