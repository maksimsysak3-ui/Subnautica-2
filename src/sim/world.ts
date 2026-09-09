/**
 * The city as state, rather than as a thing generated once.
 *
 * Everything the player can change lives here: where the roads are, and what
 * each cell is zoned for. Everything else -- which prototype stands on a lot,
 * which theme a district takes, where the services go -- is derived from this
 * and from the terrain, deterministically, every time the city is rebuilt.
 *
 * That split is what makes the game a game. A world that is generated is a
 * picture; a world that is derived from state a player edits is a city
 * builder, and the difference is entirely in which side of this file a piece
 * of information sits on.
 */

import { RoadNet } from './roadnet';
import type { RoadClass } from './roadnet';
import { simConfig } from './config';
import { hash2 } from './hash';
import type { Density, Zone } from '../assets/types';

/** The four zones a player can paint. Services are placed, not zoned. */
export const ZONES: Zone[] = ['residential', 'commercial', 'industrial', 'office'];
export const DENSITIES: Density[] = ['low', 'medium', 'high'];

/**
 * A zoning code, packed into a byte.
 *
 * Zero is unzoned, which is the common case over most of a map, so it gets to
 * be the value a fresh array already holds.
 */
export function zoneCode(zone: Zone, density: Density): number {
  const z = ZONES.indexOf(zone);
  const d = DENSITIES.indexOf(density);
  if (z < 0 || d < 0) return 0;
  return 1 + z * DENSITIES.length + d;
}

export function zoneOf(code: number): { zone: Zone; density: Density } | null {
  if (code <= 0) return null;
  const i = code - 1;
  return { zone: ZONES[(i / DENSITIES.length) | 0], density: DENSITIES[i % DENSITIES.length] };
}

export interface World {
  /** Cells across, the same grid as everything else. */
  grid: number;
  net: RoadNet;
  /** One zoning code per cell. */
  zones: Uint8Array;
}

/** Cells of buildable block between corridors. */
export const BLOCK = 12;
/** Cells of street. */
export const STREET = 3;
/** One block plus its street. */
export const PERIOD = BLOCK + STREET;

export function emptyWorld(grid = simConfig.cityGrid): World {
  return { grid, net: new RoadNet(grid), zones: new Uint8Array(grid * grid) };
}

/**
 * Paints a rectangle of cells, skipping anything a road is already on.
 *
 * Zoning a road cell is the one thing a player will try immediately and the
 * one thing that must not take: a building grown on a carriageway is worse
 * than no building.
 */
export function paint(world: World, gx: number, gz: number, w: number, d: number,
  code: number): void {
  for (let j = 0; j < d; j++) {
    const z = gz + j;
    if (z < 0 || z >= world.grid) continue;
    for (let i = 0; i < w; i++) {
      const x = gx + i;
      if (x < 0 || x >= world.grid) continue;
      if (code !== 0 && world.net.has(x, z)) continue;
      world.zones[z * world.grid + x] = code;
    }
  }
}

/**
 * The city the game starts with: a grid of streets, and every block zoned.
 *
 * Which zone a block takes is the same land-value rule the generator used
 * before -- offices and commerce in the middle, industry on one side, housing
 * everywhere else -- except that it is now written into the zone map rather
 * than decided again each time the city is built. The player can repaint any
 * of it.
 */
export function defaultWorld(grid = simConfig.cityGrid): World {
  const world = emptyWorld(grid);
  const blocks = Math.floor(grid / PERIOD);
  const half = grid / 2;

  for (let b = 0; b <= blocks; b++) {
    const line = b * PERIOD + BLOCK + 1;      // the centre cell of the corridor
    if (line >= grid) continue;
    // Every fourth street is an avenue, which is what gives a grid a hierarchy
    // instead of making every junction look like every other one.
    const cls: RoadClass = b % 4 === 2 ? 'avenue' : 'street';
    world.net.add(0, line, grid - 1, line, cls);
    world.net.add(line, 0, line, grid - 1, cls);
  }

  /** Land value: 1 at the centre, 0 at the edge of the built-up area. */
  const core = half * 8 * 0.8;
  const downtown = (gx: number, gz: number): number =>
    Math.max(0, 1 - Math.hypot((gx - half) * 8, (gz - half) * 8) / core);

  for (let bz = 0; bz < blocks; bz++) {
    for (let bx = 0; bx < blocks; bx++) {
      const gx = bx * PERIOD, gz = bz * PERIOD;
      const d = downtown(gx + BLOCK / 2, gz + BLOCK / 2);
      const roll = hash2(bx, bz, 101);
      let zone: Zone = 'residential';
      let density: Density = 'low';
      if (d < 0.30 && hash2(bx >> 1, bz >> 1, 307) > 0.72) {
        zone = 'industrial'; density = 'high';
      } else if (d > 0.62) {
        if (roll < 0.42) { zone = 'office'; density = 'high'; }
        else if (roll < 0.82) { zone = 'commercial'; density = 'high'; }
        else { zone = 'residential'; density = 'high'; }
      } else if (d > 0.34) {
        if (roll < 0.24) { zone = 'office'; density = 'medium'; }
        else if (roll < 0.48) { zone = 'commercial'; density = 'high'; }
        else if (roll < 0.62) { zone = 'commercial'; density = 'medium'; }
        else { zone = 'residential'; density = 'high'; }
      } else if (d > 0.12) {
        if (roll < 0.20) { zone = 'commercial'; density = 'medium'; }
        else if (roll < 0.30) { zone = 'office'; density = 'low'; }
        else if (roll < 0.38) { zone = 'commercial'; density = 'low'; }
        else { zone = 'residential'; density = 'medium'; }
      }
      paint(world, gx, gz, BLOCK, BLOCK, zoneCode(zone, density));
    }
  }
  return world;
}
