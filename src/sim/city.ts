/**
 * The city, laid out deterministically from the asset library.
 *
 * This replaces the box city. The rules are the same ones planning/
 * CITY-SIM-DESIGN.md commits to -- an 8 m zoning cell, blocks with streets
 * between them, coarse-to-fine placement -- but what stands on a lot is now a
 * prototype from src/assets rather than an extruded rectangle, and the street
 * is wide enough to be a street.
 *
 * Three things decide the layout, in the order they are applied:
 *
 *   1. The grid. Eight cells of block, three of street, repeating. Three
 *      cells is twenty-four metres, which is exactly what the road tiles in
 *      the library are built for -- so a corridor takes a road tile edge to
 *      edge with nothing left over, and an intersection takes road.mini.
 *   2. The big lots. Signature buildings and services have footprints up to
 *      thirty-five cells and cannot stand on one block, so they take a
 *      superblock: k blocks square, swallowing the streets between them. Real
 *      cities do this for hospitals, stadiums and airports, and it is the only
 *      honest way to fit a thirty-five-cell airport onto an eight-cell grid.
 *   3. The blocks. Stock buildings line the block's four edges facing out at
 *      the street, which is how a city block is actually built and reads far
 *      better than a random scatter -- the frontage is continuous and the
 *      backs are hidden in the middle.
 *
 * Deterministic throughout: hash2 of the cell coordinates, never Math.random.
 * Two runs of the same seed produce the same city, byte for byte.
 */

import { hash2 } from './hash';
import { heightAt } from './terrain';
import { simConfig } from './config';
import { stock, signatures, services, roads, PROTO_COUNT } from './inventory';
import type { Proto } from './inventory';
import type { Density, Zone } from '../assets/types';
import { THEME_ORDER } from '../assets/themes';
import type { Theme } from '../assets/themes';

/**
 * Floats per instance:
 *
 *   x, z, baseY, yaw            world placement; yaw is quarter turns, 0..3
 *   halfX, halfZ, height, proto axis-aligned culling box and the prototype
 *
 * The per-instance colour seed is not stored: the shader hashes the instance's
 * own world position for it, which is deterministic, free, and one float
 * lighter across twenty thousand instances.
 */
export const INSTANCE_FLOATS = 8;

/** Zoning cell, metres. */
const CELL = 8;
/** Cells of buildable block. Twelve cells is 96 m, about a real city block. */
const BLOCK = 12;
/** Cells of street between blocks. Three cells is 24 m, one road tile wide. */
const STREET = 3;
/** One block plus its street. */
const PERIOD = BLOCK + STREET;
/** Cells along a corridor covered by one road tile. */
const TILE = 4;

/** Largest fall across a footprint before the lot is left empty, in metres. */
const MAX_SLOPE = 4.5;
/**
 * Blocks per district, so a neighbourhood shares a theme and a density.
 *
 * Two, not four. Four gave a 3.5 km map sixty-four districts, and sixty-four
 * draws from six themes and four density tiers left whole combinations -- every
 * modern mid-rise in the library, for one -- never picked at all.
 */
const DISTRICT = 2;

/** Cell state. Order matters: a road may be laid on STREET, never on TAKEN. */
const FREE = 0, STREET_CELL = 1, TAKEN = 2;

export interface City {
  /** Explicitly ArrayBuffer-backed: WebGPU's queue will not take a
   *  SharedArrayBuffer view, and the bare Float32Array type permits one. */
  data: Float32Array<ArrayBuffer>;
  count: number;
  /** How many instances of each prototype the world holds, by prototype index.
   *  The renderer sizes its per-bucket visibility lists from this, so a
   *  prototype the city never placed costs nothing at all. */
  population: Uint32Array;
}

export function makeCity(): City {
  const GRID = simConfig.cityGrid;
  const half = GRID / 2;
  const out: number[] = [];
  const cells = new Uint8Array(GRID * GRID);
  const population = new Uint32Array(PROTO_COUNT);

  const at = (gx: number, gz: number): number => gz * GRID + gx;

  for (let gz = 0; gz < GRID; gz++) {
    for (let gx = 0; gx < GRID; gx++) {
      if (gx % PERIOD >= BLOCK || gz % PERIOD >= BLOCK) cells[at(gx, gz)] = STREET_CELL;
    }
  }

  /** World coordinate of a cell's low edge. */
  const wx = (gx: number): number => (gx - half) * CELL;

  /**
   * Land value: 1 at the centre, 0 at the edge of the built-up area.
   *
   * Scaled to the map rather than to a fixed radius, so a lite build has a
   * downtown of the same shape as a full one instead of a single tower.
   */
  const CORE = half * CELL * 0.8;
  const downtown = (gx: number, gz: number): number =>
    Math.max(0, 1 - Math.hypot(wx(gx), wx(gz)) / CORE);

  const free = (gx: number, gz: number, w: number, d: number, over: number): boolean => {
    if (gx < 0 || gz < 0 || gx + w > GRID || gz + d > GRID) return false;
    for (let j = 0; j < d; j++) {
      for (let i = 0; i < w; i++) {
        const c = cells[at(gx + i, gz + j)];
        if (c === TAKEN) return false;
        if (c === STREET_CELL && over !== STREET_CELL) return false;
      }
    }
    return true;
  };

  const claim = (gx: number, gz: number, w: number, d: number): void => {
    for (let j = 0; j < d; j++) {
      for (let i = 0; i < w; i++) cells[at(gx + i, gz + j)] = TAKEN;
    }
  };

  /**
   * Emits one instance, unless the ground under the lot is too steep.
   *
   * `yaw` is quarter turns anticlockwise, matching MeshBuilder.placed, and the
   * prototypes are built with their frontage on +Z -- so yaw 0 faces +Z, 1
   * faces -X, 2 faces -Z, 3 faces +X. The culling half-extents are the lot's,
   * swapped when the turn is odd, because the box the culler tests has to stay
   * axis-aligned in world space.
   */
  const emit = (p: Proto, gx: number, gz: number, w: number, d: number, yaw: number): boolean => {
    const x0 = wx(gx), z0 = wx(gz), x1 = x0 + w * CELL, z1 = z0 + d * CELL;
    const h0 = heightAt(x0, z0), h1 = heightAt(x1, z0);
    const h2 = heightAt(x0, z1), h3 = heightAt(x1, z1);
    const lo = Math.min(h0, h1, h2, h3);
    if (Math.max(h0, h1, h2, h3) - lo > MAX_SLOPE) return false;

    out.push(
      (x0 + x1) / 2, (z0 + z1) / 2, lo - 0.25, yaw,
      // A tenth of a cell of slack: the declared lot is what asset-test holds
      // the meshes inside, and a box exactly on that boundary would cull a
      // prototype's own parapet at the screen edge.
      (w * CELL) / 2 + 0.8, (d * CELL) / 2 + 0.8, p.height * 1.2 + 3, p.index,
    );
    population[p.index]++;
    claim(gx, gz, w, d);
    return true;
  };

  /** Deterministic pick from a list, or null when nothing fits. */
  const pick = <T,>(list: readonly T[], gx: number, gz: number, salt: number): T | null =>
    list.length === 0 ? null : list[Math.floor(hash2(gx, gz, salt) * list.length) % list.length];

  // ---- districts ------------------------------------------------------

  /**
   * A district's character. Neighbourhoods, not cells: a theme that changed
   * every lot would read as noise, and the whole point of five regional themes
   * is that a quarter of the city looks European and another looks American.
   */
  const districtOf = (gx: number, gz: number): { zone: Zone; density: Density; theme: Theme } => {
    const dx = Math.floor(gx / (PERIOD * DISTRICT)), dz = Math.floor(gz / (PERIOD * DISTRICT));
    const d = downtown(gx, gz);
    const roll = hash2(dx, dz, 101);
    const theme = THEME_ORDER[Math.floor(hash2(dx, dz, 211) * THEME_ORDER.length) % THEME_ORDER.length];

    // Industry sits on one side of the city, downwind of nothing in
    // particular but always together -- a scatter of single factories between
    // houses is the one thing that never happens in a real city.
    if (d < 0.30 && hash2(dx, dz, 307) > 0.72) {
      return { zone: 'industrial', density: 'none', theme };
    }
    if (d > 0.62) {
      if (roll < 0.42) return { zone: 'office', density: 'high', theme };
      if (roll < 0.82) return { zone: 'commercial', density: 'high', theme };
      return { zone: 'residential', density: 'high', theme };
    }
    if (d > 0.34) {
      if (roll < 0.24) return { zone: 'office', density: 'medium', theme };
      if (roll < 0.48) return { zone: 'commercial', density: 'high', theme };
      if (roll < 0.62) return { zone: 'commercial', density: 'medium', theme };
      return { zone: 'residential', density: 'high', theme };
    }
    if (d > 0.12) {
      if (roll < 0.20) return { zone: 'commercial', density: 'medium', theme };
      if (roll < 0.30) return { zone: 'office', density: 'low', theme };
      if (roll < 0.38) return { zone: 'commercial', density: 'low', theme };
      return { zone: 'residential', density: 'medium', theme };
    }
    // Terraces are a low-density form and the registry only builds them as
    // one, so the row theme belongs here and nowhere else.
    return { zone: 'residential', density: 'low', theme: roll < 0.18 ? 'row' : theme };
  };

  // ---- pass 1: superblocks --------------------------------------------

  /**
   * Reserves k x k blocks for one big prototype, swallowing the streets
   * between them but leaving the streets around the outside.
   *
   * A superblock of k blocks is k * PERIOD - STREET cells across: 8, 19, 30,
   * 41. That ladder is what decides how many blocks a footprint needs.
   */
  const blocksFor = (n: number): number => Math.max(1, Math.ceil((n + STREET) / PERIOD));

  /**
   * Puts a prototype somewhere in one block without spending the rest of it.
   *
   * Most services are small -- a clinic is four cells, a water tower three --
   * and giving each of them a whole ninety-six-metre block was emptying a
   * quarter of the city. These take a corner lot like anything else, and the
   * frontage pass fills the rest of the block around them.
   */
  const placeSmall = (p: Proto, bx: number, bz: number, salt: number): boolean => {
    const gx = bx * PERIOD, gz = bz * PERIOD;
    const yaw = Math.floor(hash2(bx, bz, salt) * 4) % 4;
    const [w, d] = yaw % 2 === 0 ? [p.w, p.d] : [p.d, p.w];
    if (w > BLOCK || d > BLOCK) return false;
    // Against the street the frontage faces, so a fire station opens onto a
    // road rather than onto the backs of houses.
    const ox = yaw === 3 ? gx + BLOCK - w : gx;
    const oz = yaw === 0 ? gz + BLOCK - d : gz;
    if (!free(ox, oz, w, d, FREE)) return false;
    return emit(p, ox, oz, w, d, yaw);
  };

  const placeBig = (p: Proto, bx: number, bz: number, salt: number): boolean => {
    if (p.w <= BLOCK && p.d <= BLOCK) return placeSmall(p, bx, bz, salt);
    const kw = blocksFor(p.w), kd = blocksFor(p.d);
    const spanW = kw * PERIOD - STREET, spanD = kd * PERIOD - STREET;
    const gx = bx * PERIOD, gz = bz * PERIOD;
    if (!free(gx, gz, spanW, spanD, STREET_CELL)) return false;
    // Centred in its superblock, so the slack falls as forecourt on every side
    // rather than all of it behind the building.
    const ox = gx + ((spanW - p.w) >> 1), oz = gz + ((spanD - p.d) >> 1);
    if (!emit(p, ox, oz, p.w, p.d, hash2(bx, bz, salt) < 0.5 ? 0 : 2)) return false;
    // The whole superblock is spent whether or not the building filled it: the
    // remainder is this building's grounds, not a lot for something else.
    claim(gx, gz, spanW, spanD);
    return true;
  };

  const blocks = Math.floor(GRID / PERIOD);

  // Signature buildings first and downtown, because they are what a skyline
  // is, and because they need the biggest superblocks that are still free.
  for (const zone of ['office', 'commercial', 'residential', 'industrial'] as const) {
    const list = signatures(zone);
    if (list.length === 0) continue;
    for (let bz = 0; bz < blocks; bz++) {
      for (let bx = 0; bx < blocks; bx++) {
        const gx = bx * PERIOD, gz = bz * PERIOD;
        const d = downtown(gx, gz);
        // Offices and commerce cluster in the centre; residential signatures
        // are the mansion blocks and crescents, which belong further out.
        const want = zone === 'residential' ? 1 - Math.abs(d - 0.42) * 2.2
          : zone === 'industrial' ? 0.5 - d : Math.pow(d, 1.4);
        if (hash2(bx, bz, 401 + zone.length) > want * 0.16) continue;
        const p = pick(list, bx, bz, 409);
        if (p) placeBig(p, bx, bz, 419);
      }
    }
  }

  // Landmark services first, before anything can take the ground out from
  // under them. An airport is thirty-five cells across -- twelve blocks of
  // contiguous free land -- and drawing it from the same bag as a clinic meant
  // it was never once placed on a 3.5 km map. These are sited, not scattered:
  // every candidate block is scored and the best few win, which is also the
  // only way to keep the airport out of the middle of downtown.
  const landmarks = services.filter((p) => p.w > BLOCK || p.d > BLOCK);
  for (const p of landmarks) {
    const area = p.w * p.d;
    const want = Math.max(1, Math.round((blocks * blocks) / (area * 2.4)));
    // Score every site, keep the best. Out-of-town for the things that need
    // room and make noise, the middle ring for the ones a city puts on show.
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
      if (placeBig(p, site.bx, site.bz, 547)) placed++;
    }
  }

  // Services next, spread by coverage rather than by land value: a city needs
  // a fire station near every district, not fourteen of them downtown.
  //
  // Weighted by footprint, and drawn per block rather than scanned per
  // service. Scanning per service gave the big ones two or three chances on
  // the whole map and they mostly landed on none of them -- half the service
  // roster never appeared. Here every block that rolls a service picks from a
  // bag in which a clinic has sixteen tickets and an airport has one.
  const bag: Proto[] = [];
  for (const p of services) {
    if (p.w > BLOCK || p.d > BLOCK) continue;   // sited above
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
        if (p && placeBig(p, bx, bz, 521)) break;
      }
    }
  }

  // ---- pass 2: blocks -------------------------------------------------

  /**
   * Lines one edge of a block with buildings facing the street.
   *
   * The four edges share one implementation because they are the same problem
   * turned round: a frontage that runs `run` cells along the street and takes
   * up to `deep` cells back into the block. What differs is only how (along,
   * depth) maps onto (gx, gz), which is what `edge` selects.
   *
   * A prototype is built with its frontage on +Z and is `p.w` wide by `p.d`
   * deep in its own axes, so an odd quarter turn swaps those against the grid.
   */
  const frontage = (
    gx: number, gz: number, edge: number, run: number, deep: number,
    list: readonly Proto[], salt: number,
  ): void => {
    let a = 0, guard = 0;
    while (a < run && guard++ < 96) {
      let step = 1;
      // A handful of tries at different prototypes before conceding the cell.
      // One try would put whichever building the hash favours along the whole
      // street; scanning the bucket in order would be worse still.
      for (let attempt = 0; attempt < 8; attempt++) {
        const p = pick(list, gx * 7 + a, gz * 13 + attempt, salt + attempt);
        if (!p) break;
        if (p.w > run - a || p.d > deep) continue;
        // Lot origin, in the block's own (along, depth) frame, then rotated
        // onto the grid. `back` is how far the lot's low corner sits from the
        // block edge the frontage faces.
        const back = BLOCK - p.d;
        let cx = 0, cz = 0, w = 0, d = 0;
        switch (edge) {
          case 0: cx = gx + a; cz = gz + back; w = p.w; d = p.d; break;        // faces +Z
          case 2: cx = gx + a; cz = gz; w = p.w; d = p.d; break;               // faces -Z
          case 1: cx = gx; cz = gz + a; w = p.d; d = p.w; break;               // faces -X
          default: cx = gx + back; cz = gz + a; w = p.d; d = p.w; break;       // faces +X
        }
        if (!free(cx, cz, w, d, FREE)) continue;
        if (!emit(p, cx, cz, w, d, edge)) continue;
        step = p.w;
        break;
      }
      a += step;
    }
  };

  for (let bz = 0; bz < blocks; bz++) {
    for (let bx = 0; bx < blocks; bx++) {
      const gx = bx * PERIOD, gz = bz * PERIOD;
      const { zone, density, theme } = districtOf(gx, gz);
      const list = stock(zone, density, theme);
      if (list.length === 0) continue;
      // Half the block per side leaves nothing for the other two frontages, and
      // a quarter each rejects every prototype deeper than three cells. So the
      // edges compete: each may take up to half the block, and the order they
      // run in turns with the block. One block ends up deep-plotted north to
      // south, its neighbour east to west, and neither looks stamped.
      const deep = BLOCK >> 1;
      const first = Math.floor(hash2(bx, bz, 631) * 4) % 4;
      for (let e = 0; e < 4; e++) {
        const edge = (first + e) % 4;
        frontage(gx, gz, edge, BLOCK, deep, list, 601 + edge * 6);
      }
      // Whatever the perimeter left in the middle. Backland is real -- mews,
      // yards, workshops behind a frontage -- and without this the core of
      // every block in the city is an identical empty square.
      for (let j = 1; j < BLOCK - 1; j++) {
        for (let i = 1; i < BLOCK - 1; i++) {
          if (cells[at(gx + i, gz + j)] !== FREE) continue;
          if (hash2(gx + i, gz + j, 647) > 0.5) continue;
          const p = pick(list, gx + i, gz + j, 653);
          if (!p) continue;
          const yaw = Math.floor(hash2(gx + i, gz + j, 659) * 4) % 4;
          const [w, d] = yaw % 2 === 0 ? [p.w, p.d] : [p.d, p.w];
          if (gx + i + w > gx + BLOCK || gz + j + d > gz + BLOCK) continue;
          if (!free(gx + i, gz + j, w, d, FREE)) continue;
          emit(p, gx + i, gz + j, w, d, yaw);
        }
      }
    }
  }

  // ---- pass 3: roads --------------------------------------------------

  const corridor = roads(STREET).filter((p) => p.d === TILE);
  const junction = roads(STREET).filter((p) => p.d === STREET);

  if (corridor.length > 0) {
    for (let bz = 0; bz <= blocks; bz++) {
      for (let bx = 0; bx <= blocks; bx++) {
        const sx = bx * PERIOD + BLOCK, sz = bz * PERIOD + BLOCK;
        // The junction where two corridors cross: three cells square, which is
        // exactly what road.mini is built as.
        const j = junction.length > 0 ? junction[0] : null;
        if (j && free(sx, sz, STREET, STREET, STREET_CELL)) {
          emit(j, sx, sz, STREET, STREET, 0);
        }
        // One corridor prototype per street, so a street is one kind of street
        // for its whole length instead of changing every thirty metres.
        const nsRoad = pick(corridor, bx, bz, 701);
        const ewRoad = pick(corridor, bx, bz, 709);
        for (let t = 0; t < BLOCK; t += TILE) {
          // North-south: the tile is 3 wide in x and 4 long in z already.
          if (nsRoad && bz < blocks && free(sx, bz * PERIOD + t, STREET, TILE, STREET_CELL)) {
            emit(nsRoad, sx, bz * PERIOD + t, STREET, TILE, 0);
          }
          // East-west: the same tile turned a quarter, so it is 4 in x and 3
          // in z, and the frontage rule keeps the kerbs on the right sides.
          if (ewRoad && bx < blocks && free(bx * PERIOD + t, sz, TILE, STREET, STREET_CELL)) {
            emit(ewRoad, bx * PERIOD + t, sz, TILE, STREET, 1);
          }
        }
      }
    }
  }

  const data = new Float32Array(out.length);
  data.set(out);
  return { data, count: out.length / INSTANCE_FLOATS, population };
}
