/**
 * Worked land: which zoning cells lie inside an industry's drawn area, and
 * what they are worked for.
 *
 * A harvest area used to be dressed with props -- field tiles, felling plots,
 * pumpjacks on pads -- and from the camera a player plays at it read as open
 * grass with things dropped on it. The area is the thing the player drew, so it
 * is the area that is drawn: every cell inside the polygon is painted by the
 * ground shader as what it is worked for (gold for a farm, canopy for a forest,
 * rust for a mine), and the work on it is the vehicles and people that move
 * over it rather than furniture that stands on it.
 *
 * One byte per cell, the kind code below, rebuilt from the polygons whenever
 * the city is -- a few thousand point-in-polygon tests.
 */

import type { World } from './world';

/** Kind codes, as the ground shader reads them. Nought is not worked. */
export const WORKED_KIND: Record<string, number> = {
  fertile: 1, forest: 2, ore: 3, stone: 4, oil: 5,
};

const CELL = 8;

/** Whether a point is inside a polygon given as x, z, x, z ... */
export function insidePoly(poly: readonly number[], x: number, z: number): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 2; i < poly.length; j = i, i += 2) {
    const xi = poly[i], zi = poly[i + 1], xj = poly[j], zj = poly[j + 1];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi || 1e-9) + xi) inside = !inside;
  }
  return inside;
}

/** Paints one polygon's cells with `code` into a grid-sized map. */
export function paintPoly(out: Uint8Array, grid: number, poly: readonly number[], code: number): void {
  if (poly.length < 6) return;
  const half = grid / 2;
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (let k = 0; k + 1 < poly.length; k += 2) {
    x0 = Math.min(x0, poly[k]); x1 = Math.max(x1, poly[k]);
    z0 = Math.min(z0, poly[k + 1]); z1 = Math.max(z1, poly[k + 1]);
  }
  const g0 = Math.max(0, Math.floor(x0 / CELL + half)), g1 = Math.min(grid - 1, Math.ceil(x1 / CELL + half));
  const k0 = Math.max(0, Math.floor(z0 / CELL + half)), k1 = Math.min(grid - 1, Math.ceil(z1 / CELL + half));
  for (let gz = k0; gz <= k1; gz++) {
    for (let gx = g0; gx <= g1; gx++) {
      if (insidePoly(poly, (gx - half + 0.5) * CELL, (gz - half + 0.5) * CELL)) out[gz * grid + gx] = code;
    }
  }
}

/** Every land harvest area in the world, painted. Fishing grounds are water and stay water. */
export function workedMap(world: World): Uint8Array {
  const out = new Uint8Array(world.grid * world.grid);
  for (const hq of world.industry.hqs) {
    const code = WORKED_KIND[hq.kind];
    if (code !== undefined) paintPoly(out, world.grid, hq.area, code);
  }
  return out;
}
