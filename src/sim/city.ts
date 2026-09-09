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
import { baseHeightAt } from './terrain';
import { stock, signatures, services, planting, PROTO_COUNT, ASSET_INDEX } from './inventory';
import { gradeGround, baseAtCorner } from './grading';
import type { Placement } from './roadnet';
import { defaultWorld, zoneOf, BLOCK, STREET, PERIOD } from './world';
import type { World } from './world';
import { assetById } from '../assets/registry';
import type { Pad } from './grading';
import type { Proto } from './inventory';
import type { Density, Zone } from '../assets/types';
import { THEME_ORDER } from '../assets/themes';
import type { Theme } from '../assets/themes';

/**
 * Floats per instance:
 *
 *   x, z, baseY, yaw            world placement; yaw is quarter turns, 0..3
 *   halfX, halfZ, height, proto axis-aligned culling box and the prototype
 *   stretch, spare, spare, spare
 *
 * `stretch` scales the prototype along its own Z before it is turned and
 * placed. Exactly one thing uses it and it is the thing that makes a road
 * network possible on a grid: a straight run between two junctions is whatever
 * length the player drew, and a rigid four-cell tile can only cover a multiple
 * of four. Stretching the tiles of a run by a few per cent covers any length
 * exactly, and a road tile is an extrusion along its own Z, so stretching it
 * that way is the one deformation that is not a distortion.
 *
 * The per-instance colour seed is not stored: the shader hashes the instance's
 * own world position for it, which is deterministic, free, and one float
 * lighter across twenty thousand instances.
 */
export const INSTANCE_FLOATS = 12;

/** Zoning cell, metres. */
const CELL = 8;
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

/**
 * Builds the city the world describes.
 *
 * Everything here is derived: the world says where the roads are and what each
 * cell is zoned for, and this decides what actually stands on the ground. Run
 * it again after the player changes anything and the city is rebuilt to match,
 * deterministically -- the same world always produces the same city.
 */
export function makeCity(world: World = defaultWorld()): City {
  const GRID = world.grid;
  const half = GRID / 2;
  const out: number[] = [];
  const cells = new Uint8Array(GRID * GRID);
  const population = new Uint32Array(PROTO_COUNT);
  /** What each placement wants the ground under it to be. */
  const pads: Pad[] = [];

  const at = (gx: number, gz: number): number => gz * GRID + gx;

  const blocks = Math.floor(GRID / PERIOD);
  const net = world.net;

  // The roads are reserved before anything else is placed, straight from the
  // network. Computing where a corridor is a second time is how buildings
  // ended up standing in the road: an avenue is four cells across and a street
  // is three, so where the corridor is depends on what was drawn there.
  for (let i = 0; i < cells.length; i++) if (net.cls[i] !== 0) cells[i] = STREET_CELL;

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
  /** The mean ungraded height over a rectangle of cells, and its extremes. */
  const survey = (gx: number, gz: number, w: number, d: number):
    { lo: number; hi: number; mean: number } => {
    let lo = Infinity, hi = -Infinity, sum = 0, n = 0;
    for (let j = 0; j <= d; j++) {
      for (let i = 0; i <= w; i++) {
        const y = baseAtCorner(gx + i, gz + j, baseHeightAt);
        if (y < lo) lo = y;
        if (y > hi) hi = y;
        sum += y; n++;
      }
    }
    return { lo, hi, mean: sum / n };
  };

  const emit = (p: Proto, gx: number, gz: number, w: number, d: number, yaw: number,
    grade: boolean | number = true, stretch = 1): boolean => {
    const x0 = wx(gx), z0 = wx(gz), x1 = x0 + w * CELL, z1 = z0 + d * CELL;
    // Every corner of the lot, not the four outer ones: a lot up to
    // thirty-five cells across can have a hump in the middle that its corners
    // know nothing about, and the whole point of grading is that the ground
    // ends up level with the building rather than near it.
    const ground = survey(gx, gz, w, d);
    if (ground.hi - ground.lo > MAX_SLOPE) return false;

    // The mean, not the minimum. Cutting to the lowest corner digs every site
    // into a pit its neighbours look down into; the mean cuts as much as it
    // fills, which is what grading actually is.
    //
    // A number instead of true means the caller has already decided the
    // height -- a street is graded as one run rather than one tile at a time,
    // because two tiles butted together at their own mean heights leave a step
    // between them with the terrain showing through it.
    const level = typeof grade === 'number' ? grade : ground.mean;
    // Trees do not level the ground: they grow on it. Grading for every one of
    // several thousand would flatten the map into a table, and a tree on a
    // slope is a tree on a slope.
    if (grade === true) pads.push({ gx, gz, w, d, y: level });

    out.push(
      (x0 + x1) / 2, (z0 + z1) / 2, level - 0.25, yaw,
      // A tenth of a cell of slack: the declared lot is what asset-test holds
      // the meshes inside, and a box exactly on that boundary would cull a
      // prototype's own parapet at the screen edge.
      (w * CELL) / 2 + 0.8, (d * CELL) / 2 + 0.8, p.height * 1.2 + 3, p.index,
      stretch, 0, 0, 0,
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
  /**
   * What a block builds, and in what regional style.
   *
   * The zone and the density come from the world -- they are the player's, and
   * painting over them is the whole of zoning. The theme does not: a quarter
   * of the city looking European is a fact about the place rather than a
   * decision anyone made, so it stays derived from where the block is.
   */
  const districtOf = (gx: number, gz: number): { zone: Zone; density: Density; theme: Theme } | null => {
    const code = world.zones[at(Math.min(gx + 1, GRID - 1), Math.min(gz + 1, GRID - 1))];
    const painted = zoneOf(code);
    if (painted === null) return null;
    const dx = Math.floor(gx / (PERIOD * DISTRICT)), dz = Math.floor(gz / (PERIOD * DISTRICT));
    const theme = THEME_ORDER[Math.floor(hash2(dx, dz, 211) * THEME_ORDER.length) % THEME_ORDER.length];
    // Terraces are a low-density form and the registry only builds them as
    // one, so the row theme belongs there and nowhere else.
    if (painted.density === 'low' && painted.zone === 'residential'
      && hash2(dx, dz, 101) < 0.18) {
      return { zone: painted.zone, density: painted.density, theme: 'row' };
    }
    return { zone: painted.zone, density: painted.density, theme };
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
    // remainder is this building's grounds, not a lot for something else. And
    // the streets it swallowed are demolished rather than drawn underneath it.
    claim(gx, gz, spanW, spanD);
    net.clear(gx, gz, spanW, spanD);
    return true;
  };

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
      const district = districtOf(gx, gz);
      if (district === null) continue;          // unzoned: nothing grows here
      const { zone, density, theme } = district;
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

  // ---- planting -------------------------------------------------------
  //
  // Whatever the blocks did not build on. Weighted towards the street edge,
  // because that is where a city plants: a verge tree every few metres along a
  // frontage, and the rest scattered through the gardens and yards behind.
  const nursery = planting();
  if (nursery.length > 0) {
    for (let bz = 0; bz < blocks; bz++) {
      for (let bx = 0; bx < blocks; bx++) {
        const gx = bx * PERIOD, gz = bz * PERIOD;
        const d = downtown(gx, gz);
        // Denser in the suburbs than downtown, which is what a city is.
        const density = 0.42 - d * 0.22;
        for (let j = 0; j < BLOCK; j++) {
          for (let i = 0; i < BLOCK; i++) {
            const cx = gx + i, cz = gz + j;
            if (cells[at(cx, cz)] !== FREE) continue;
            const edge = i === 0 || j === 0 || i === BLOCK - 1 || j === BLOCK - 1;
            if (hash2(cx, cz, 811) > density * (edge ? 2.1 : 0.7)) continue;
            const p = pick(nursery, cx, cz, 821);
            if (!p) continue;
            const yaw = Math.floor(hash2(cx, cz, 823) * 4) % 4;
            const [w, dd] = yaw % 2 === 0 ? [p.w, p.d] : [p.d, p.w];
            if (cx + w > gx + BLOCK || cz + dd > gz + BLOCK) continue;
            if (!free(cx, cz, w, dd, FREE)) continue;
            emit(p, cx, cz, w, dd, yaw, false);
          }
        }
      }
    }
  }

  // ---- pass 3: roads --------------------------------------------------
  //
  // Laid through the road network rather than by hand. The default city draws
  // a grid, which the network then treats exactly as it would treat a grid the
  // player drew: it finds the crossings itself, sizes the junction from the
  // widest road in it, and tiles the runs between them to fit.

  // Built last, so anything demolished for a superblock is already gone.
  layRoads(net.build());

  function layRoads(places: readonly Placement[]): void {
    // Junctions first, and each on its own pad: a junction is where a street
    // is allowed to change grade, and the runs either side take their level
    // from the ground they cover rather than from each tile of themselves.
    for (const q of places) {
      if (q.run !== -1) continue;
      const gx = Math.round(q.gx), gz = Math.round(q.gz);
      const w = Math.round(q.w), d = Math.round(q.d);
      if (!free(gx, gz, w, d, STREET_CELL)) continue;
      const y = survey(gx, gz, w, d).mean;
      if (lay(q, y)) { pads.push({ gx, gz, w, d, y }); claim(gx, gz, w, d); }
    }

    // Then the runs, grouped: one survey, one level and one pad for the whole
    // run. A run tiled at each tile's own mean has a step at every tile.
    const byRun = new Map<number, Placement[]>();
    for (const q of places) {
      if (q.run === -1) continue;
      const list = byRun.get(q.run);
      if (list) list.push(q); else byRun.set(q.run, [q]);
    }
    for (const group of byRun.values()) {
      let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
      for (const q of group) {
        x0 = Math.min(x0, q.gx); z0 = Math.min(z0, q.gz);
        x1 = Math.max(x1, q.gx + q.w); z1 = Math.max(z1, q.gz + q.d);
      }
      const gx = Math.round(x0), gz = Math.round(z0);
      const w = Math.max(1, Math.round(x1 - x0)), d = Math.max(1, Math.round(z1 - z0));
      const y = survey(gx, gz, w, d).mean;
      let laid = false;
      for (const q of group) laid = lay(q, y) || laid;
      if (laid) { pads.push({ gx, gz, w, d, y }); claim(gx, gz, w, d); }
    }
  }

  /**
   * Emits one road piece, unless the ground under it is spoken for.
   *
   * Tested at the centre cell rather than over the whole footprint: a
   * stretched tile covers a fraction of a cell at each end and rounds into its
   * neighbour's, so a footprint test rejects every other tile of a run. What
   * the test is actually for is keeping a road out of a superblock, and the
   * centre cell answers that.
   */
  function lay(q: Placement, y: number): boolean {
    const cx = Math.floor(q.gx + q.w / 2), cz = Math.floor(q.gz + q.d / 2);
    if (cx < 0 || cz < 0 || cx >= GRID || cz >= GRID) return false;
    if (cells[at(cx, cz)] === TAKEN) return false;
    const index = ASSET_INDEX.get(q.id);
    const p = assetById(q.id);
    if (index === undefined || p === undefined) return false;
    const x0 = wx(q.gx), z0 = wx(q.gz);
    const x1 = x0 + q.w * CELL, z1 = z0 + q.d * CELL;
    out.push(
      (x0 + x1) / 2, (z0 + z1) / 2, y - 0.25, q.yaw,
      (q.w * CELL) / 2 + 0.8, (q.d * CELL) / 2 + 0.8, p.height * 1.2 + 3, index,
      q.stretch, 0, 0, 0,
    );
    population[index]++;
    return true;
  }

  // Grade last, once every pad is known. The placement above ran against the
  // ungraded ground on purpose: a spawner deciding whether a slope is
  // buildable while the slope is being flattened underneath it would build
  // anywhere, and the map would end up as one terrace.
  gradeGround(pads, baseHeightAt);

  const data = new Float32Array(out.length);
  data.set(out);
  return { data, count: out.length / INSTANCE_FLOATS, population };
}
