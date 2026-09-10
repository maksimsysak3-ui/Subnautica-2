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

import { hash2, fbm } from './hash';
import { baseHeightAt } from './terrain';
import { stock, planting, PROTO_COUNT, ASSET_INDEX } from './inventory';
import { gradeGround, baseAtCorner } from './grading';
import type { Placement, Frontage } from './roadnet';
import { defaultWorld, zoneOf, BLOCK, PERIOD } from './world';
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
  /**
   * Where open ground was left, one byte per cell.
   *
   * 255 is grass, 0 is built on or paved. The renderer uploads it as a texture
   * and the grass pass reads it to decide where a blade may stand -- which is
   * the only way that pass can know, since it runs on the GPU and the cell
   * grid is the simulation's.
   */
  cover: Uint8Array;
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
  /**
   * Where grass cannot grow: paving and the footprint of a building.
   *
   * Not the same as the occupancy grid, which is about what may be *placed*.
   * A tree's lot is two cells of which the tree occupies a trunk's worth, and
   * a building's lot has margin around it -- all of that is lawn. Taking the
   * occupancy grid as the answer left ten per cent of the map growing grass
   * and the rest of it bald.
   */
  const hard = new Uint8Array(GRID * GRID);
  const harden = (gx: number, gz: number, w: number, d: number): void => {
    for (let j = 0; j < d; j++) {
      const z = gz + j;
      if (z < 0 || z >= GRID) continue;
      for (let i = 0; i < w; i++) {
        const x = gx + i;
        if (x >= 0 && x < GRID) hard[z * GRID + x] = 1;
      }
    }
  };

  const at = (gx: number, gz: number): number => gz * GRID + gx;


  const net = world.net;

  // The roads are reserved before anything else is placed, straight from the
  // network. Computing where a corridor is a second time is how buildings
  // ended up standing in the road: an avenue is four cells across and a street
  // is three, so where the corridor is depends on what was drawn there.
  for (let i = 0; i < cells.length; i++) if (net.cls[i] !== 0) cells[i] = STREET_CELL;

  // The pieces themselves, as well as the corridor they run in. A junction is
  // sized from the widest class in it and rounded to whole cells, so a
  // four-cell junction on a three-cell crossing overhangs by a cell that the
  // corridor never claimed -- and a building put on that cell killed the
  // junction when the tiler came to lay it. Half the T-junctions in the
  // default city were being dropped that way.
  const places = net.build();
  for (const q of places) {
    const gx = Math.floor(q.gx), gz = Math.floor(q.gz);
    const w = Math.max(1, Math.ceil(q.gx + q.w) - gx), d = Math.max(1, Math.ceil(q.gz + q.d) - gz);
    for (let j = 0; j < d; j++) {
      for (let i = 0; i < w; i++) {
        const x = gx + i, z = gz + j;
        if (x < 0 || z < 0 || x >= GRID || z >= GRID) continue;
        if (cells[at(x, z)] === FREE) cells[at(x, z)] = STREET_CELL;
      }
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
    // A building has a flat underside and has to be sited on ground that can
    // be graded to it. A tree does not: it grows on whatever is there, and
    // holding it to a building's slope limit is what kept the oaks off every
    // hillside on the map.
    if (p.def.zone !== 'nature' && ground.hi - ground.lo > MAX_SLOPE) return false;

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
    // Planting neither claims the ground nor hardens it. A wood is
    // interlocking crowns, and a tree that reserves its whole lot puts the
    // next one two cells away -- which caps a park at a quarter of its cells
    // and makes it read as an orchard. Trees are still one to a cell, and
    // still only go where nothing was built.
    if (p.def.zone !== 'nature') { claim(gx, gz, w, d); harden(gx, gz, w, d); }
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
    if (gx < 0 || gz < 0 || gx >= GRID || gz >= GRID) return null;
    const code = world.zones[at(gx, gz)];
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

  // ---- pass 1: the lots the world already holds ------------------------
  //
  // Services, landmarks and signature buildings are not re-rolled here. They
  // are part of the world, sited once when it was made, and a rebuild places
  // exactly the ones it is given.
  //
  // That is not tidiness. Re-rolling them meant every rebuild moved them: draw
  // a road and the hospital jumps across town. Worse, the siting pass was
  // allowed to take street cells and demolish what it took -- which is right
  // for an airport being sited on open country and catastrophic when it runs
  // on ground a player has just laid roads through, where it quietly bulldozed
  // them and left the new district empty.
  for (const lot of world.lots) {
    const index = ASSET_INDEX.get(lot.id);
    const p = assetById(lot.id);
    if (index === undefined || p === undefined) continue;
    if (!free(lot.gx, lot.gz, lot.w, lot.d, STREET_CELL)) continue;
    const ground = survey(lot.gx, lot.gz, lot.w, lot.d);
    const x0 = wx(lot.gx), z0 = wx(lot.gz);
    const x1 = x0 + lot.w * CELL, z1 = z0 + lot.d * CELL;
    out.push(
      (x0 + x1) / 2, (z0 + z1) / 2, ground.mean - 0.25, lot.yaw,
      (lot.w * CELL) / 2 + 0.8, (lot.d * CELL) / 2 + 0.8, p.height * 1.2 + 3, index,
      1, 0, 0, 0,
    );
    population[index]++;
    pads.push({ gx: lot.gx, gz: lot.gz, w: lot.w, d: lot.d, y: ground.mean });
    claim(lot.gx, lot.gz, lot.w, lot.d);
    harden(lot.gx, lot.gz, lot.w, lot.d);
    // The grounds around a big one, so nothing else builds in its forecourt.
    if (lot.grounds !== undefined) {
      claim(lot.grounds[0], lot.grounds[1], lot.grounds[2], lot.grounds[3]);
    }
  }

  // ---- pass 2: frontage -----------------------------------------------
  //
  // Buildings attach to roads, not to blocks. A block is what is left over
  // between roads, and the moment a player can draw a road anywhere there is
  // no grid of blocks to iterate -- but there is always a list of road
  // frontages, and a frontage is what a building actually fronts onto.
  //
  // This is also what makes zoning mean something: a lot is built when it is
  // zoned *and* it has a road, which is the rule every city builder uses and
  // the reason a road through empty countryside fills up and a zoned field in
  // the middle of nowhere does not.

  /**
   * Lines one side of one road with buildings facing it.
   *
   * `deep` is how far back from the kerb this side may take, so two roads
   * either side of a narrow block do not both build through the middle of it.
   * A prototype is built with its frontage on +Z and is `p.w` wide by `p.d`
   * deep in its own axes, so an odd quarter turn swaps those against the grid.
   */
  const buildFrontage = (f: Frontage, deep: number): void => {
    let a = f.from, guard = 0;
    while (a <= f.to && guard++ < 512) {
      let step = 1;
      // A handful of tries at different prototypes before conceding the cell.
      // One try would put whichever building the hash favours along the whole
      // street; scanning the bucket in order would be worse still.
      for (let attempt = 0; attempt < 8; attempt++) {
        // The zone is read at the lot's own front cell, so a frontage can run
        // out of one zone and into the next along a single street.
        const front = f.axis === 'x' ? at(a, f.kerb) : at(f.kerb, a);
        if (front < 0 || front >= cells.length) break;
        const district = districtOf(f.axis === 'x' ? a : f.kerb,
          f.axis === 'x' ? f.kerb : a);
        if (district === null) break;
        const list = stock(district.zone, district.density, district.theme);
        const p = pick(list, a * 7 + f.kerb, attempt * 13 + f.yaw, 601 + attempt);
        if (!p) break;
        if (p.w > f.to - a + 1 || p.d > deep) continue;
        // The lot runs `p.d` cells back from the kerb and `p.w` along it.
        const back = f.step > 0 ? f.kerb : f.kerb - p.d + 1;
        let cx = 0, cz = 0, w = 0, d = 0;
        if (f.axis === 'x') { cx = a; cz = back; w = p.w; d = p.d; }
        else { cx = back; cz = a; w = p.d; d = p.w; }
        if (!free(cx, cz, w, d, FREE)) continue;
        if (!emit(p, cx, cz, w, d, f.yaw)) continue;
        step = p.w;
        break;
      }
      a += step;
    }
  };

  // Half the block per side leaves nothing for the frontage opposite, and a
  // quarter rejects every prototype deeper than three cells. So they compete:
  // each may take up to half, in an order that turns with the road, which is
  // what makes one street deep-plotted and the next one not.
  const fronts = net.frontages();
  const order = fronts.map((f, i) => ({ f, key: hash2(f.kerb, f.from + i, 631) }));
  order.sort((p, q) => p.key - q.key);
  for (const { f } of order) buildFrontage(f, BLOCK >> 1);

  // Whatever the frontages left behind them. Backland is real -- mews, yards,
  // workshops behind a street -- and without it the middle of every block in
  // the city is an identical empty square.
  for (let gz = 1; gz < GRID - 1; gz++) {
    for (let gx = 1; gx < GRID - 1; gx++) {
      if (cells[at(gx, gz)] !== FREE) continue;
      if (hash2(gx, gz, 647) > 0.34) continue;
      const district = districtOf(gx, gz);
      if (district === null) continue;
      const p = pick(stock(district.zone, district.density, district.theme), gx, gz, 653);
      if (!p) continue;
      const yaw = Math.floor(hash2(gx, gz, 659) * 4) % 4;
      const [w, d] = yaw % 2 === 0 ? [p.w, p.d] : [p.d, p.w];
      if (!free(gx, gz, w, d, FREE)) continue;
      emit(p, gx, gz, w, d, yaw);
    }
  }

  // ---- planting -------------------------------------------------------
  //
  // Two regimes, because a city and the country around it are planted by
  // different things. Inside the built-up area a tree is a street tree or a
  // garden tree: it goes where a building did not, weighted hard towards the
  // block edge, because that is where a city plants. Outside it, the land is
  // not a lawn -- it is woodland with a city in it, and woodland comes in
  // copses rather than an even sprinkle.
  //
  // Species are tried largest first. Picking one at random and giving up when
  // it does not fit sounds fair and is not: a three-cell oak needs a
  // three-cell hole, almost every hole left by the spawner is one cell, and
  // the result was a map of thirteen hundred saplings and seventy oaks.
  const nursery = [...planting()].sort((a, b) => b.w * b.d - a.w * a.d);
  if (nursery.length > 0) {
    const big = nursery.filter((p) => p.w >= 3);
    const mid = nursery.filter((p) => p.w === 2);
    const small = nursery.filter((p) => p.w <= 1);

    /**
     * Plants the biggest thing that fits, from the tiers offered.
     *
     * Yaw is quantised to the tree's own hash rather than to a rotation the
     * player could notice, so a row of limes along a frontage is a row of
     * different limes rather than one lime stamped six times.
     */
    const plant = (cx: number, cz: number, tiers: readonly (readonly Proto[])[]): boolean => {
      for (const tier of tiers) {
        if (tier.length === 0) continue;
        const p = pick(tier, cx, cz, 821);
        if (p === null) continue;
        const yaw = Math.floor(hash2(cx, cz, 823) * 4) % 4;
        const [w, d] = yaw % 2 === 0 ? [p.w, p.d] : [p.d, p.w];
        if (!free(cx, cz, w, d, FREE)) continue;
        // Only the emit settles it. It can still refuse the site, and a
        // `plant` that reported success on a refusal spent the cell without
        // putting anything on it -- which is most of why the big species
        // never appeared.
        if (emit(p, cx, cz, w, d, yaw, false)) return true;
      }
      return false;
    };

    for (let cz = 0; cz < GRID; cz++) {
      for (let cx = 0; cx < GRID; cx++) {
        if (cells[at(cx, cz)] !== FREE) continue;
        const inBlock = cx % PERIOD < BLOCK && cz % PERIOD < BLOCK;
        const i = cx % PERIOD, j = cz % PERIOD;
        const d = downtown(cx, cz);

        // A park block: planted like woodland rather than like a back garden,
        // because that is what it is for.
        const zoned = zoneOf(world.zones[at(cx, cz)]);
        if (zoned !== null && zoned.zone === 'nature') {
          // Almost every slot, and the two-cell species first. A crown is
          // wider than the lot it stands on, so trees on a two-cell pitch
          // close their canopy while three-cell ones leave gaps between --
          // and a park you can see the grass through is a lawn.
          if (hash2(cx, cz, 815) > 0.58) continue;
          plant(cx, cz, [mid, big, small]);
          continue;
        }

        if (d > 0.02 && inBlock) {
          // In town. Denser in the suburbs than downtown, which is what a
          // city is, and four times denser against the street than behind it.
          const edge = i === 0 || j === 0 || i === BLOCK - 1 || j === BLOCK - 1;
          const density = (0.5 - d * 0.24) * (edge ? 1.7 : 0.42);
          if (hash2(cx, cz, 811) > density) continue;
          plant(cx, cz, [mid, small, big]);
          continue;
        }

        // Out of town. Copses: a low-frequency noise decides where woodland
        // is at all, and inside one the canopy is close to continuous. An
        // even scatter at the same tree count reads as an orchard.
        const wood = fbm(cx * 0.021, cz * 0.021, 3, 917);
        const cover = Math.max(0, wood - 0.40) * 2.6 - d * 0.6;
        if (cover <= 0 || hash2(cx, cz, 813) > cover) continue;
        plant(cx, cz, [mid, big, small]);
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
  layRoads(places);

  function layRoads(places: readonly Placement[]): void {
    // Junctions first. A junction is a node of the network and the only place
    // a road is allowed to pick its own level from the ground it sits on --
    // everything between two of them is then a ramp from one to the other.
    const nodeY = new Map<number, number>();
    for (const q of places) {
      if (q.run !== -1) continue;
      const gx = Math.round(q.gx), gz = Math.round(q.gz);
      const w = Math.round(q.w), d = Math.round(q.d);
      if (!free(gx, gz, w, d, STREET_CELL)) continue;
      const y = survey(gx, gz, w, d).mean;
      if (!lay(q, y)) continue;
      pads.push({ gx, gz, w, d, y });
      claim(gx, gz, w, d);
      for (let j = 0; j < d; j++) {
        for (let i = 0; i < w; i++) {
          if (gx + i < GRID && gz + j < GRID) nodeY.set(at(gx + i, gz + j), y);
        }
      }
    }

    const byRun = new Map<number, Placement[]>();
    for (const q of places) {
      if (q.run === -1) continue;
      const list = byRun.get(q.run);
      if (list) list.push(q); else byRun.set(q.run, [q]);
    }

    // Then the runs, one tile at a time, ramped between the junctions at
    // their ends.
    //
    // This used to be one level for the whole run, on the reasoning that a
    // run tiled at each tile's own mean steps at every tile. It does -- but
    // levelling a hundred metres of hillside to a single height puts a step
    // of *two metres* where the run meets its junction, which is the median
    // measured on the default map, and the graded ground ramping between two
    // pads that far apart rises straight through the lower slab. That is what
    // the bands of grass across the carriageway were: not missing tarmac, but
    // tarmac buried under the ramp to the next pad.
    //
    // Interpolating instead makes the corridor a ribbon that follows the
    // land. Its ends match the junctions exactly, because they are the
    // interpolation's endpoints, and the step between one tile and the next
    // is the fall between the junctions divided by the tiles in the run.
    for (const group of byRun.values()) {
      const along: 'x' | 'z' = group[0].yaw === 1 ? 'x' : 'z';
      group.sort((a, b) => (along === 'x' ? a.gx - b.gx : a.gz - b.gz));

      const first = group[0], last = group[group.length - 1];
      const lo = along === 'x' ? Math.floor(first.gx) : Math.floor(first.gz);
      const hi = along === 'x' ? Math.ceil(last.gx + last.w) : Math.ceil(last.gz + last.d);
      const cross = along === 'x'
        ? Math.floor(first.gz + first.d / 2)
        : Math.floor(first.gx + first.w / 2);
      const endCell = (i: number): number =>
        along === 'x' ? at(clampCell(i), clampCell(cross)) : at(clampCell(cross), clampCell(i));

      const rect = (q: Placement): { gx: number; gz: number; w: number; d: number } => ({
        gx: Math.floor(q.gx), gz: Math.floor(q.gz),
        w: Math.max(1, Math.ceil(q.gx + q.w) - Math.floor(q.gx)),
        d: Math.max(1, Math.ceil(q.gz + q.d) - Math.floor(q.gz)),
      });
      const own = (q: Placement): number => {
        const r = rect(q);
        return survey(r.gx, r.gz, r.w, r.d).mean;
      };
      // A run need not end on a junction: it can stop at the map edge or at
      // ground a superblock took. There it takes its own level.
      const y0 = nodeY.get(endCell(lo - 1)) ?? own(first);
      const y1 = nodeY.get(endCell(hi)) ?? own(last);

      const n = group.length;
      for (let k = 0; k < n; k++) {
        const q = group[k];
        const y = y0 + (y1 - y0) * ((k + 0.5) / n);
        if (!lay(q, y)) continue;
        const r = rect(q);
        pads.push({ gx: r.gx, gz: r.gz, w: r.w, d: r.d, y });
      }
      // Claimed for the whole run and not tile by tile. A tile's rounded
      // rectangle reaches into its neighbour's centre cell, so claiming each
      // one in turn marks the next one's ground as taken and drops it -- a
      // run laid as every other tile with grass between them.
      const r0 = rect(first), r1 = rect(last);
      claim(r0.gx, r0.gz, r1.gx + r1.w - r0.gx, r1.gz + r1.d - r0.gz);
    }
  }

  function clampCell(i: number): number {
    return i < 0 ? 0 : i >= GRID ? GRID - 1 : i;
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
      // Just proud of the pad, not sunk into it. A building is buried a
      // quarter of a metre so an uneven lot cannot leave it on stilts; a road
      // is a flat slab on ground that was graded flat for it, and sinking it
      // only lets the ramp to the next pad come up through the carriageway.
      (x0 + x1) / 2, (z0 + z1) / 2, y + 0.05, q.yaw,
      (q.w * CELL) / 2 + 0.8, (q.d * CELL) / 2 + 0.8, p.height * 1.2 + 3, index,
      q.stretch, 0, 0, 0,
    );
    population[index]++;
    harden(Math.floor(q.gx), Math.floor(q.gz),
      Math.max(1, Math.round(q.w)), Math.max(1, Math.round(q.d)));
    return true;
  }

  // Grade last, once every pad is known. The placement above ran against the
  // ungraded ground on purpose: a spawner deciding whether a slope is
  // buildable while the slope is being flattened underneath it would build
  // anywhere, and the map would end up as one terrace.
  gradeGround(pads, baseHeightAt);

  // Open ground, for the grass. Thinned by one cell against anything hard, so
  // a blade does not stop dead at a kerb -- real grass runs up to an edge and
  // gets worn as it goes.
  const cover = new Uint8Array(GRID * GRID);
  for (let gz = 0; gz < GRID; gz++) {
    for (let gx = 0; gx < GRID; gx++) {
      if (hard[at(gx, gz)] === 1) continue;
      let open = 4;
      if (gx > 0 && hard[at(gx - 1, gz)] === 1) open--;
      if (gx + 1 < GRID && hard[at(gx + 1, gz)] === 1) open--;
      if (gz > 0 && hard[at(gx, gz - 1)] === 1) open--;
      if (gz + 1 < GRID && hard[at(gx, gz + 1)] === 1) open--;
      cover[at(gx, gz)] = 110 + open * 36;
    }
  }

  const data = new Float32Array(out.length);
  data.set(out);
  return { data, count: out.length / INSTANCE_FLOATS, population, cover };
}
