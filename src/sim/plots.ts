/**
 * Land, and buying it.
 *
 * A city builder where the whole map is yours from the first minute has one
 * fewer decision in it than it should. Land is the constraint that makes the
 * early game a game: you cannot put the airport wherever you like, you have to
 * either build around what you own or spend on reaching further out -- and
 * because every plot you buy is a plot you did not spend on a hospital, where
 * the city grows becomes something you chose rather than something that
 * happened.
 *
 * The map is cut into a coarse grid of square plots. Which ones you own is one
 * bit each, which is why the whole thing fits in a handful of bytes, travels in
 * a save as two numbers, and can be handed to the terrain shader as a bitmask
 * in a uniform rather than as a texture.
 */

import { simConfig } from './config';

/** Plots across the map, each way. Sixty-four in all. */
export const PLOTS = 8;

/**
 * The plot grid covers the buildable cell grid, not the whole terrain.
 *
 * The map is wider than the city -- there is river and hill beyond the last
 * cell anyone can zone -- and selling a player a square kilometre of scenery
 * they can do nothing with would be a trap rather than a choice.
 */
export function plotCells(grid: number): number {
  return Math.ceil(grid / PLOTS);
}

/** The plot a cell is in. */
export function plotAt(grid: number, gx: number, gz: number): number {
  const size = plotCells(grid);
  const px = Math.floor(gx / size), pz = Math.floor(gz / size);
  if (px < 0 || pz < 0 || px >= PLOTS || pz >= PLOTS) return -1;
  return pz * PLOTS + px;
}

/** The plot at a world position, or -1 outside the buildable grid. */
export function plotAtWorld(grid: number, x: number, z: number): number {
  const half = grid / 2;
  return plotAt(grid, Math.floor(x / 8 + half), Math.floor(z / 8 + half));
}

/** World-space bounds of one plot: x0, z0, x1, z1. */
export function plotBounds(grid: number, plot: number): [number, number, number, number] {
  const size = plotCells(grid);
  const half = grid / 2;
  const px = plot % PLOTS, pz = Math.floor(plot / PLOTS);
  return [
    (px * size - half) * 8, (pz * size - half) * 8,
    (Math.min((px + 1) * size, grid) - half) * 8,
    (Math.min((pz + 1) * size, grid) - half) * 8,
  ];
}

/**
 * Which plots a player owns, as a bitmask.
 *
 * Sixty-four bits, held as two thirty-two bit halves because JavaScript's
 * bitwise operators are thirty-two bit and BigInt in a hot path is not worth
 * the elegance.
 */
export class Land {
  lo = 0;
  hi = 0;

  constructor(lo = 0, hi = 0) {
    this.lo = lo >>> 0;
    this.hi = hi >>> 0;
  }

  owns(plot: number): boolean {
    if (plot < 0 || plot >= PLOTS * PLOTS) return false;
    return plot < 32
      ? (this.lo & (1 << plot)) !== 0
      : (this.hi & (1 << (plot - 32))) !== 0;
  }

  take(plot: number): void {
    if (plot < 0 || plot >= PLOTS * PLOTS) return;
    if (plot < 32) this.lo = (this.lo | (1 << plot)) >>> 0;
    else this.hi = (this.hi | (1 << (plot - 32))) >>> 0;
  }

  get count(): number {
    let n = 0;
    for (let i = 0; i < PLOTS * PLOTS; i++) if (this.owns(i)) n++;
    return n;
  }

  /**
   * Whether a plot can be bought: not owned, and touching something that is.
   *
   * A city has to be connected to itself. Letting a player buy a square in the
   * far corner and start a second town there is not a strategy, it is a way of
   * ending up with two half-cities that never meet -- and the whole reason land
   * is a constraint is that it makes the city grow outwards from somewhere.
   */
  canBuy(plot: number): boolean {
    if (plot < 0 || plot >= PLOTS * PLOTS || this.owns(plot)) return false;
    const px = plot % PLOTS, pz = Math.floor(plot / PLOTS);
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = px + dx, nz = pz + dz;
      if (nx < 0 || nz < 0 || nx >= PLOTS || nz >= PLOTS) continue;
      if (this.owns(nz * PLOTS + nx)) return true;
    }
    return false;
  }

  /**
   * What the next plot costs.
   *
   * It goes up with how much you already hold, not with where the plot is.
   * Distance pricing sounds right and plays badly: it makes one direction cheap
   * for the whole game and the city grows as a strip. Rising with the count
   * instead means the tenth plot is a real decision however the city is shaped,
   * which is the decision the mechanic exists to create.
   */
  price(): number {
    const n = Math.max(0, this.count - STARTING.length);
    const raw = 24000 * 1.42 ** n;
    const step = raw < 100000 ? 5000 : 25000;
    return Math.round(raw / step) * step;
  }
}

/**
 * The plots a new city starts with: the middle four, as one square.
 *
 * Four rather than one because a single plot of this grid is a little over six
 * hundred metres, which is a village. Four is a town centre with room to make a
 * mistake in, and it is contiguous, so it reads as one piece of land rather
 * than as a starting inventory.
 */
export const STARTING: number[] = (() => {
  const mid = PLOTS / 2;
  const out: number[] = [];
  for (const pz of [mid - 1, mid]) for (const px of [mid - 1, mid]) out.push(pz * PLOTS + px);
  return out;
})();

export function startingLand(): Land {
  const land = new Land();
  for (const p of STARTING) land.take(p);
  return land;
}

/** Whether a rectangle of cells lies entirely on land the player owns. */
export function ownsCells(land: Land, grid: number, gx: number, gz: number,
  w: number, d: number): boolean {
  const size = plotCells(grid);
  // Only the plots the rectangle's corners fall in need testing: a rectangle
  // cannot skip a plot it spans.
  for (let z = gz; z < gz + d; z += size) {
    for (let x = gx; x < gx + w; x += size) {
      if (!land.owns(plotAt(grid, x, z))) return false;
    }
  }
  return land.owns(plotAt(grid, gx + w - 1, gz + d - 1))
    && land.owns(plotAt(grid, gx, gz + d - 1))
    && land.owns(plotAt(grid, gx + w - 1, gz));
}

/** Whether a world-space point is on owned land. */
export function ownsAt(land: Land, grid: number, x: number, z: number): boolean {
  return land.owns(plotAtWorld(grid, x, z));
}

/** The plot grid in world metres, for the camera and the overlay. */
export function plotSpan(grid = simConfig.cityGrid): number {
  return plotCells(grid) * 8;
}
