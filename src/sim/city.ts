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
import { buildRoadMesh } from './roadmesh';
import type { RoadMesh } from './roadmesh';
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
 * A quarter turn, in radians.
 *
 * The instance format carries yaw as an angle rather than as one of four
 * cases. Everything the spawner places is still square to the grid and goes
 * in as a multiple of this; what changed is that it no longer has to be.
 */
const QUARTER = Math.PI / 2;
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
  /** The road surface, generated from the network. Drawn in one call. */
  roads: RoadMesh;
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
  // network's own raster of its corridor -- junctions and all. Working out
  // where a corridor is a second time is how buildings ended up standing in
  // the road, and with curves there is no formula to work it out from anyway.
  net.rasterise();
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

  /**
   * Half extents of the axis-aligned box that contains a lot turned by `yaw`.
   *
   * The instance's own yaw is a real angle in radians, not one of four cases.
   * Everything the spawner places today happens to be at a quarter turn, and
   * for those this returns exactly what swapping width for depth returned --
   * but a road that curves puts buildings at every angle in between.
   */
  const turnedHalf = (hx: number, hz: number, yaw: number): [number, number] => {
    const c = Math.abs(Math.cos(yaw)), s = Math.abs(Math.sin(yaw));
    return [hx * c + hz * s, hx * s + hz * c];
  };

  /**
   * Walks the cells an oriented rectangle covers.
   *
   * The zoning grid is axis-aligned and buildings no longer are, so a lot is
   * a box at an angle over a grid of squares. Every cell of the box's bounding
   * rectangle is tested by bringing its centre into the box's own frame, which
   * is exact and costs a sine and a cosine for the whole lot.
   */
  const overBox = (cx: number, cz: number, hw: number, hd: number, yaw: number,
    fn: (gx: number, gz: number) => boolean): boolean => {
    const c = Math.cos(yaw), sn = Math.sin(yaw);
    const rx = Math.abs(hw * c) + Math.abs(hd * sn);
    const rz = Math.abs(hw * sn) + Math.abs(hd * c);
    const gx0 = Math.floor((cx - rx) / CELL + half), gx1 = Math.floor((cx + rx) / CELL + half);
    const gz0 = Math.floor((cz - rz) / CELL + half), gz1 = Math.floor((cz + rz) / CELL + half);
    for (let gz = gz0; gz <= gz1; gz++) {
      for (let gx = gx0; gx <= gx1; gx++) {
        const wx0 = (gx - half + 0.5) * CELL - cx, wz0 = (gz - half + 0.5) * CELL - cz;
        // Into the box's frame: the inverse of a rotation by yaw.
        const lx = wx0 * c + wz0 * sn, lz = -wx0 * sn + wz0 * c;
        if (Math.abs(lx) > hw || Math.abs(lz) > hd) continue;
        if (!fn(gx, gz)) return false;
      }
    }
    return true;
  };

  const freeBox = (cx: number, cz: number, hw: number, hd: number, yaw: number,
    over: number): boolean =>
    overBox(cx, cz, hw, hd, yaw, (gx, gz) => {
      if (gx < 0 || gz < 0 || gx >= GRID || gz >= GRID) return false;
      const c = cells[at(gx, gz)];
      if (c === TAKEN) return false;
      if (c === STREET_CELL && over !== STREET_CELL) return false;
      return true;
    });

  const claimBox = (cx: number, cz: number, hw: number, hd: number, yaw: number): void => {
    overBox(cx, cz, hw, hd, yaw, (gx, gz) => {
      if (gx >= 0 && gz >= 0 && gx < GRID && gz < GRID) {
        cells[at(gx, gz)] = TAKEN;
        hard[at(gx, gz)] = 1;
      }
      return true;
    });
  };

  /**
   * Emits one building standing anywhere, at any angle.
   *
   * The grid-aligned `emit` above is what the lots and the planting still use,
   * because those sit on cells. A building on a frontage does not: it stands
   * on the kerb line of a road that may be curving, so its position is metres
   * and its yaw is whatever the road is doing there.
   */
  const emitAt = (p: Proto, cx: number, cz: number, yaw: number): boolean => {
    const hw = (p.w * CELL) / 2, hd = (p.d * CELL) / 2;
    // The ground it stands on, sampled over its own footprint.
    let lo = Infinity, hi = -Infinity, sum = 0, n = 0;
    for (let j = -1; j <= 1; j++) {
      for (let i = -1; i <= 1; i++) {
        const c = Math.cos(yaw), sn = Math.sin(yaw);
        const ox = i * hw, oz = j * hd;
        const y = baseHeightAt(cx + ox * c - oz * sn, cz + ox * sn + oz * c);
        if (y < lo) lo = y;
        if (y > hi) hi = y;
        sum += y; n++;
      }
    }
    if (hi - lo > MAX_SLOPE) return false;
    const level = sum / n;
    // The pad is the lot's own turned footprint, not a square big enough to
    // hold it whichever way it faces. Grading a sixty-metre square under every
    // twenty-metre house terraces the entire map to building levels, and the
    // roads -- which are graded to their own -- end up metres underground.
    const [bx, bz] = turnedHalf(hw, hd, yaw);
    const pgx = Math.floor((cx - bx) / CELL + half), pgz = Math.floor((cz - bz) / CELL + half);
    pads.push({
      gx: pgx, gz: pgz,
      w: Math.max(1, Math.ceil((cx + bx) / CELL + half) - pgx),
      d: Math.max(1, Math.ceil((cz + bz) / CELL + half) - pgz),
      y: level,
    });
    out.push(
      cx, cz, level - 0.25, yaw,
      bx + 0.8, bz + 0.8, p.height * 1.2 + 3, p.index,
      1, 0, 0, 0,
    );
    population[p.index]++;
    claimBox(cx, cz, hw, hd, yaw);
    return true;
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

    // The culling box is the axis-aligned one that contains the lot after it
    // has been turned, computed from the prototype's own extents and the
    // angle rather than by swapping width for depth. At a quarter turn the two
    // agree exactly; at any other angle only this one is right, and the
    // spawner is about to start using angles that are not quarter turns.
    const [hx, hz] = turnedHalf((p.w * CELL) / 2, (p.d * CELL) / 2, yaw);
    out.push(
      (x0 + x1) / 2, (z0 + z1) / 2, level - 0.25, yaw,
      // A tenth of a cell of slack: the declared lot is what asset-test holds
      // the meshes inside, and a box exactly on that boundary would cull a
      // prototype's own parapet at the screen edge.
      hx + 0.8, hz + 0.8, p.height * 1.2 + 3, p.index,
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
      (x0 + x1) / 2, (z0 + z1) / 2, ground.mean - 0.25, lot.yaw * QUARTER,
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
  /**
   * Lines one side of one road with buildings facing it.
   *
   * This walks metres along the road rather than cells along an axis, because
   * the road is a curve now: a plot's position is a point on the kerb line and
   * its yaw is whatever the road is doing there. `deep` is how far back from
   * the kerb this side may take, so two roads either side of a narrow block do
   * not both build through the middle of it.
   */
  const buildFrontage = (f: { link: number; side: -1 | 1; from: number; to: number },
    deep: number): void => {
    let s = f.from, guard = 0;
    while (s < f.to && guard++ < 400) {
      let step = 4;
      // Hoisted out of the attempt loop: neither depends on which prototype is
      // being tried, and looking the district and its stock up eight times per
      // position was most of what a frontage cost.
      const probe = net.siteAt(f.link, f.side, s);
      // The zone is read along the whole depth this plot may take, not at one
      // cell behind the kerb.
      //
      // That single probe was the bug behind "I zoned it and nothing built".
      // A plot is up to half a block deep, so a player painting anywhere in
      // that depth is painting ground a building would stand on -- but only
      // the one ring of cells exactly eight metres back from the kerb was ever
      // looked at, and four cells in five did nothing at all. The first zoned
      // cell going back now wins, which is the rule a player already assumes.
      const nx = Math.sin(probe.yaw), nz = -Math.cos(probe.yaw);
      let district: ReturnType<typeof districtOf> = null;
      for (let back = 1; back <= (BLOCK >> 1) && district === null; back++) {
        const [pgx, pgz] = net.cellAt(probe.x + nx * CELL * back, probe.z + nz * CELL * back);
        district = districtOf(pgx, pgz);
      }
      if (district === null) { s += step; continue; }
      const list = stock(district.zone, district.density, district.theme);
      if (list.length === 0) { s += step; continue; }

      for (let attempt = 0; attempt < 8; attempt++) {
        const p = pick(list, Math.round(s), f.link * 13 + f.side, 601 + attempt);
        if (!p) break;
        const wide = p.w * CELL, back = p.d * CELL;
        if (s + wide > f.to || back > deep * CELL) continue;
        // The plot's middle: half its depth *out* from the kerb line, along
        // the outward normal. `yaw` turns a prototype's +Z front back at the
        // road, so the outward normal is (sin yaw, -cos yaw).
        const mid = net.siteAt(f.link, f.side, s + wide / 2);
        const nx = Math.sin(mid.yaw), nz = -Math.cos(mid.yaw);
        const cx = mid.x + nx * (back / 2), cz = mid.z + nz * (back / 2);
        // The middle of the plot, tested first. Most attempts fail because the
        // block behind is already full, and walking every cell of a forty-metre
        // footprint to find that out is thirty tests where one will do.
        const [mgx, mgz] = net.cellAt(cx, cz);
        if (mgx < 0 || mgz < 0 || mgx >= GRID || mgz >= GRID) continue;
        if (cells[at(mgx, mgz)] !== FREE) continue;
        if (!freeBox(cx, cz, wide / 2, back / 2, mid.yaw, FREE)) continue;
        if (!emitAt(p, cx, cz, mid.yaw)) continue;
        step = wide;
        break;
      }
      s += step;
    }
  };

  // Half the block per side leaves nothing for the frontage opposite, and a
  // quarter rejects every prototype deeper than three cells. So they compete:
  // each may take up to half, in an order that is shuffled rather than
  // north-to-south, which is what makes one street deep-plotted and the next
  // one not.
  const fronts = net.frontages();
  const order = fronts.map((f, i) => ({ f, key: hash2(f.link, i, 631) }));
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
      emit(p, gx, gz, w, d, yaw * QUARTER);
    }
  }

  // ---- planting -------------------------------------------------------
  //
  // The woodland mask is the same every time -- it is a function of the cell
  // and nothing else -- and computing three octaves of noise for four hundred
  // thousand cells was most of what a rebuild on open country cost. It is
  // built once and kept; see `woodland` below.
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
  const canopy = woodland(GRID);
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
        if (emit(p, cx, cz, w, d, yaw * QUARTER, false)) return true;
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
        const shade = canopy[at(cx, cz)] - d * 0.6;
        if (shade <= 0 || hash2(cx, cz, 813) > shade) continue;
        plant(cx, cz, [mid, big, small]);
      }
    }
  }

  // Roads are not placed here any more. They are a graph of curves and their
  // geometry is generated straight from it -- see src/sim/roadmesh.ts -- so
  // what used to be a third pass of five and a half thousand prefabricated
  // tiles is now a mesh the renderer draws in one call. What the spawner still
  // needs from the network is the corridor, and that came in at the top as
  // reserved cells.

  // The roads. Generated from the graph rather than placed, and their pads go
  // in with everyone else's so the corridor is cut level in the same pass that
  // levels the building plots -- which is what stops a road and the lot beside
  // it disagreeing about where the ground is.
  const roads = buildRoadMesh(net, baseHeightAt);
  // Paved ground takes no grass. The corridor raster already knows where the
  // road is, so this is the same set the spawner reserved from.
  for (let i = 0; i < hard.length; i++) if (net.cls[i] !== 0) hard[i] = 1;

  // Grade last, once every pad is known. The placement above ran against the
  // ungraded ground on purpose: a spawner deciding whether a slope is
  // buildable while the slope is being flattened underneath it would build
  // anywhere, and the map would end up as one terrace.
  gradeGround(pads, baseHeightAt, roads.pins);

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
  return { data, count: out.length / INSTANCE_FLOATS, population, cover, roads };
}

/**
 * Where woodland is, as a value per cell.
 *
 * A pure function of the grid, so it is computed once for the life of the
 * process rather than on every rebuild. That matters because a rebuild runs on
 * every road the player draws and every block they zone: at 640 cells this is
 * four hundred thousand three-octave noise lookups, and on a map that is
 * mostly open country it was the single largest thing an edit paid for.
 */
let woodMask: Float32Array | null = null;
let woodFor = -1;

function woodland(grid: number): Float32Array {
  if (woodMask !== null && woodFor === grid) return woodMask;
  const out = new Float32Array(grid * grid);
  for (let cz = 0; cz < grid; cz++) {
    for (let cx = 0; cx < grid; cx++) {
      // Thresholded high and scaled low: woodland covers less of the map and
      // is thinner inside itself. At the old figures a copse took every free
      // cell it touched -- a tree every eight metres, which is a plantation,
      // not woodland -- and the whole map came to 131,575 trees. Crowns are
      // wider than their cells, so thinning the stand closes the canopy just
      // the same and costs a third of the instances.
      out[cz * grid + cx] = Math.max(0, fbm(cx * 0.021, cz * 0.021, 3, 917) - 0.47) * 1.30;
    }
  }
  woodMask = out;
  woodFor = grid;
  return out;
}
