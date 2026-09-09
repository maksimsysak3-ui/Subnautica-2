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
import { signatures, services } from './inventory';
import type { Proto } from './inventory';
import { baseHeightAt } from './terrain';

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

/**
 * Something standing on the map that was placed rather than grown.
 *
 * Services, landmarks and signature buildings. They are world state for the
 * same reason roads are: they were sited once, and rebuilding the city must
 * put them back where they were rather than deciding again. A rebuild that
 * re-decides moves the hospital every time a road is drawn.
 */
export interface Lot {
  id: string;
  gx: number;
  gz: number;
  w: number;
  d: number;
  yaw: number;
  /** The whole superblock a big one sits in: gx, gz, w, d. Its grounds. */
  grounds?: [number, number, number, number];
}

export interface World {
  /** Cells across, the same grid as everything else. */
  grid: number;
  net: RoadNet;
  /** One zoning code per cell. */
  zones: Uint8Array;
  /** What was placed on the map, as opposed to grown on it. */
  lots: Lot[];
}

/** Cells of buildable block between corridors. */
export const BLOCK = 12;
/** Cells of street. */
export const STREET = 3;
/** One block plus its street. */
export const PERIOD = BLOCK + STREET;

export function emptyWorld(grid = simConfig.cityGrid): World {
  return { grid, net: new RoadNet(grid), zones: new Uint8Array(grid * grid), lots: [] };
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
 * Sites the services, landmarks and signature buildings, once.
 *
 * Everything here used to run on every rebuild, which is what made a rebuild
 * move things. It runs when the world is made and its results are stored.
 *
 * The occupancy grid is local: this needs to know what it has already placed
 * and where the roads are, and nothing else -- the buildings that grow on
 * zoned frontage come later and fit around these rather than the other way
 * round.
 */
function siteLots(world: World, ground: (x: number, z: number) => number): void {
  const grid = world.grid;
  const blocks = Math.floor(grid / PERIOD);
  const taken = new Uint8Array(grid * grid);
  const half = grid / 2;
  const core = half * 8 * 0.8;
  const downtown = (gx: number, gz: number): number =>
    Math.max(0, 1 - Math.hypot((gx - half) * 8, (gz - half) * 8) / core);

  const clear = (gx: number, gz: number, w: number, d: number, overStreet: boolean): boolean => {
    if (gx < 0 || gz < 0 || gx + w > grid || gz + d > grid) return false;
    for (let j = 0; j < d; j++) {
      for (let i = 0; i < w; i++) {
        if (taken[(gz + j) * grid + gx + i]) return false;
        if (!overStreet && world.net.has(gx + i, gz + j)) return false;
      }
    }
    return true;
  };
  const hold = (gx: number, gz: number, w: number, d: number): void => {
    for (let j = 0; j < d; j++) {
      for (let i = 0; i < w; i++) taken[(gz + j) * grid + gx + i] = 1;
    }
  };
  /** Flat enough to stand on, measured at the lot's corners. */
  const level = (gx: number, gz: number, w: number, d: number): boolean => {
    let lo = Infinity, hi = -Infinity;
    for (const [i, j] of [[0, 0], [w, 0], [0, d], [w, d], [w >> 1, d >> 1]]) {
      const y = ground((gx + i - half) * 8, (gz + j - half) * 8);
      if (y < lo) lo = y;
      if (y > hi) hi = y;
    }
    return hi - lo <= 4.5;
  };

  /** A superblock of k blocks is k * PERIOD - STREET cells across. */
  const blocksFor = (n: number): number => Math.max(1, Math.ceil((n + STREET) / PERIOD));

  const place = (p: Proto, bx: number, bz: number, salt: number): boolean => {
    const gx = bx * PERIOD, gz = bz * PERIOD;
    if (p.w <= BLOCK && p.d <= BLOCK) {
      // Most services are small -- a clinic is four cells, a water tower three
      // -- and giving each a whole ninety-six-metre block emptied a quarter of
      // the city. These take a corner lot and the frontage fills in around.
      const yaw = Math.floor(hash2(bx, bz, salt) * 4) % 4;
      const [w, d] = yaw % 2 === 0 ? [p.w, p.d] : [p.d, p.w];
      const ox = yaw === 3 ? gx + BLOCK - w : gx;
      const oz = yaw === 0 ? gz + BLOCK - d : gz;
      if (!clear(ox, oz, w, d, false) || !level(ox, oz, w, d)) return false;
      world.lots.push({ id: p.id, gx: ox, gz: oz, w, d, yaw });
      hold(ox, oz, w, d);
      return true;
    }
    const spanW = blocksFor(p.w) * PERIOD - STREET, spanD = blocksFor(p.d) * PERIOD - STREET;
    if (!clear(gx, gz, spanW, spanD, true)) return false;
    // Centred in its superblock, so the slack falls as forecourt on every side
    // rather than all of it behind the building.
    const ox = gx + ((spanW - p.w) >> 1), oz = gz + ((spanD - p.d) >> 1);
    if (!level(ox, oz, p.w, p.d)) return false;
    world.lots.push({
      id: p.id, gx: ox, gz: oz, w: p.w, d: p.d,
      yaw: hash2(bx, bz, salt) < 0.5 ? 0 : 2,
      grounds: [gx, gz, spanW, spanD],
    });
    hold(gx, gz, spanW, spanD);
    // The streets it swallowed are demolished rather than drawn under it.
    world.net.clear(gx, gz, spanW, spanD);
    return true;
  };

  const pick = <T,>(list: readonly T[], gx: number, gz: number, salt: number): T | null =>
    list.length === 0 ? null : list[Math.floor(hash2(gx, gz, salt) * list.length) % list.length];

  // Signature buildings first and downtown, because they are what a skyline
  // is, and because they need the biggest superblocks still free.
  for (const zone of ['office', 'commercial', 'residential', 'industrial'] as const) {
    const list = signatures(zone);
    if (list.length === 0) continue;
    for (let bz = 0; bz < blocks; bz++) {
      for (let bx = 0; bx < blocks; bx++) {
        const d = downtown(bx * PERIOD, bz * PERIOD);
        // Offices and commerce cluster in the centre; residential signatures
        // are the mansion blocks and crescents, which belong further out.
        const want = zone === 'residential' ? 1 - Math.abs(d - 0.42) * 2.2
          : zone === 'industrial' ? 0.5 - d : Math.pow(d, 1.4);
        if (hash2(bx, bz, 401 + zone.length) > want * 0.16) continue;
        const p = pick(signatures(zone), bx, bz, 409);
        if (p) place(p, bx, bz, 419);
      }
    }
  }

  // Landmark services next, sited rather than scattered: an airport is
  // thirty-five cells across -- twelve blocks of contiguous free land -- and
  // drawing it from the same bag as a clinic meant it was never once placed.
  // Every candidate block is scored and the best few win, which is also the
  // only way to keep the airport out of the middle of downtown.
  for (const p of services.filter((q) => q.w > BLOCK || q.d > BLOCK)) {
    const area = p.w * p.d;
    const want = Math.max(1, Math.round((blocks * blocks) / (area * 2.4)));
    const sites: Array<{ bx: number; bz: number; score: number }> = [];
    for (let bz = 0; bz < blocks; bz++) {
      for (let bx = 0; bx < blocks; bx++) {
        const d = downtown(bx * PERIOD + BLOCK / 2, bz * PERIOD + BLOCK / 2);
        const fit = area > 600 ? 1 - d : 1 - Math.abs(d - 0.4) * 1.8;
        sites.push({ bx, bz, score: fit + hash2(bx, bz, 541 + p.index) * 0.55 });
      }
    }
    sites.sort((a, b) => b.score - a.score);
    let placed = 0;
    for (const site of sites) {
      if (placed >= want) break;
      if (place(p, site.bx, site.bz, 547)) placed++;
    }
  }

  // The rest, spread by coverage rather than land value: a city needs a fire
  // station near every district, not fourteen of them downtown. Weighted by
  // footprint and drawn per block, so a clinic has sixteen tickets in the bag
  // and a sorting office one.
  const bag: Proto[] = [];
  for (const p of services) {
    if (p.w > BLOCK || p.d > BLOCK) continue;
    const tickets = Math.max(1, Math.round(240 / (p.w * p.d)));
    for (let i = 0; i < tickets; i++) bag.push(p);
  }
  for (let bz = 0; bz < blocks; bz++) {
    for (let bx = 0; bx < blocks; bx++) {
      if (hash2(bx, bz, 503) > 0.22) continue;
      // Three draws, so a block whose first pick will not fit still gets a
      // service rather than being left to the housing pass.
      for (let k = 0; k < 3; k++) {
        const p = pick(bag, bx, bz, 509 + k);
        if (p && place(p, bx, bz, 521)) break;
      }
    }
  }
}

/**
 * Clears a rectangle: zoning, roads, and anything standing on it.
 *
 * All three, because a player who bulldozes expects the ground to be empty.
 * Leaving the lots would also break the thing that replaced them: a lot that
 * survives is a lot the next rebuild still tries to place, and a road drawn
 * through it is quietly dropped where the two overlap.
 */
export function demolish(world: World, gx: number, gz: number, w: number, d: number): void {
  paint(world, gx, gz, w, d, 0);
  world.net.clear(gx, gz, w, d);
  world.lots = world.lots.filter((l) =>
    l.gx + l.w <= gx || l.gx >= gx + w || l.gz + l.d <= gz || l.gz >= gz + d);
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

  // Sited last, so they can see the roads and the zoning they will sit among.
  siteLots(world, baseHeightAt);
  return world;
}
