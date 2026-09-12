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
import { gradeGround, baseAtCorner, baseAtPoint, whenTerrainChanges } from './grading';
import { buildRoadMesh } from './roadmesh';
import type { RoadMesh } from './roadmesh';
import { REACH_CELLS } from './roadgraph';
import { defaultWorld, zoneOf, BLOCK, PERIOD } from './world';
import { plotAt, PLOTS, plotCells } from './plots';
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
/**
 * The instance buffer, written straight instead of through a number[].
 *
 * A rebuild emits tens of thousands of instances of twelve floats each. Held
 * as a plain array that is hundreds of thousands of boxed doubles which then
 * have to be copied into a Float32Array anyway, and it showed up as garbage
 * collection on every road a player drew. Writing into the typed array as it
 * grows costs one allocation per doubling and no copy at the end.
 */
class Instances {
  /**
   * Empty until something is written.
   *
   * The countryside buffer is made on every rebuild and, once the wild half is
   * cached, never written to -- a quarter of a megabyte of garbage per edit for
   * an array that stays empty. Growing from nothing costs one allocation the
   * first time anything is added and none after.
   */
  private buf = EMPTY_F32;
  private n = 0;

  /**
   * Who produced each instance, and what it took.
   *
   * Five numbers an instance: the owner tag, then the cell rectangle it
   * claimed. An incremental rebuild needs both -- the tag to know which
   * instances a re-run pass is replacing, and the rectangle to put back the
   * claims of everything that survived, because clearing the occupancy grid
   * around an edit also clears the marks of buildings that merely reach into
   * it from outside.
   *
   * Kept beside the instance data rather than inside it: the GPU never sees
   * this, and widening the instance to carry it would put five floats of
   * bookkeeping into every vertex fetch in the frame.
   */
  private tags = EMPTY_I32;

  /** The owner the next `add` is attributed to. See `OWNER` below. */
  owner = OWNER_NONE;
  /** The cells the next `add` claimed: gx, gz, w, d. Zero for a tree. */
  took: [number, number, number, number] = [0, 0, 0, 0];

  /** One instance: place, form, extra. Twelve floats, in that order. */
  add(x: number, z: number, y: number, yaw: number,
    hx: number, hz: number, h: number, proto: number,
    stretch: number, ghost: number, e2: number, e3: number): void {
    if (this.n + INSTANCE_FLOATS > this.buf.length) {
      const want = Math.max(INSTANCE_FLOATS * 4096, this.buf.length * 2);
      const grown = new Float32Array(want);
      grown.set(this.buf);
      this.buf = grown;
      const tags = new Int32Array((want / INSTANCE_FLOATS) * 5);
      tags.set(this.tags);
      this.tags = tags;
    }
    const t = (this.n / INSTANCE_FLOATS) * 5;
    this.tags[t] = this.owner;
    this.tags[t + 1] = this.took[0];
    this.tags[t + 2] = this.took[1];
    this.tags[t + 3] = this.took[2];
    this.tags[t + 4] = this.took[3];
    const b = this.buf;
    let k = this.n;
    b[k++] = x; b[k++] = z; b[k++] = y; b[k++] = yaw;
    b[k++] = hx; b[k++] = hz; b[k++] = h; b[k++] = proto;
    b[k++] = stretch; b[k++] = ghost; b[k++] = e2; b[k++] = e3;
    this.n = k;
  }

  /** A view of exactly what was written. Not a copy. */
  get data(): Float32Array<ArrayBuffer> {
    return this.buf.subarray(0, this.n) as Float32Array<ArrayBuffer>;
  }

  /** The owner and claim record, five numbers an instance. */
  get record(): Int32Array {
    return this.tags.subarray(0, (this.n / INSTANCE_FLOATS) * 5);
  }

  get count(): number { return this.n / INSTANCE_FLOATS; }

  /**
   * Removes every instance a predicate claims, and takes them off the census.
   *
   * Compacted in place rather than rebuilt: the survivors are the great
   * majority and copying them into a second buffer to throw the first one away
   * is the allocation this whole exercise exists to avoid.
   */
  dropWhere(gone: (owner: number) => boolean, census: Uint32Array,
    release: (gx: number, gz: number, w: number, d: number) => void): void {
    let kept = 0;
    const n = this.count;
    for (let i = 0; i < n; i++) {
      if (gone(this.tags[i * 5])) {
        census[this.buf[i * INSTANCE_FLOATS + 7]]--;
        // The ground it stood on goes back, wherever it stood.
        //
        // Clearing only the region around the edit is not enough: a frontage
        // runs the whole length of its road, so remaking one drops buildings
        // two kilometres from the edit -- and if their footprints stay marked
        // as taken, the frontage re-runs into its own ghosts and eleven hundred
        // buildings quietly fail to come back.
        const t = i * 5;
        if (this.tags[t + 3] > 0) {
          release(this.tags[t + 1], this.tags[t + 2], this.tags[t + 3], this.tags[t + 4]);
        }
        continue;
      }
      if (kept !== i) {
        this.buf.copyWithin(kept * INSTANCE_FLOATS, i * INSTANCE_FLOATS,
          (i + 1) * INSTANCE_FLOATS);
        this.tags.copyWithin(kept * 5, i * 5, (i + 1) * 5);
      }
      kept++;
    }
    this.n = kept * INSTANCE_FLOATS;
  }

  /** Adopts an existing block of instances and their records, as the start. */
  adopt(data: Float32Array, rec: Int32Array, count: number): void {
    const floats = count * INSTANCE_FLOATS;
    if (this.buf.length < floats) {
      this.buf = new Float32Array(Math.ceil(floats * 1.3));
      this.tags = new Int32Array(Math.ceil(count * 5 * 1.3));
    }
    this.buf.set(data.subarray(0, floats), 0);
    this.tags.set(rec.subarray(0, count * 5), 0);
    this.n = floats;
  }
}

/**
 * Who produced an instance.
 *
 * A frontage is `link * 2 + side`, which is stable across edits because the
 * graph appends links and splits them in place rather than renumbering. Passes
 * that walk cells -- the placed lots, the backland, the planting -- are
 * attributed to the cell they started from, encoded negative so the two spaces
 * cannot collide.
 */
const EMPTY_F32 = new Float32Array(0);
const EMPTY_I32 = new Int32Array(0);

const OWNER_NONE = -1;
const ownerOfCell = (cell: number): number => -2 - cell;
const cellOfOwner = (owner: number): number => -2 - owner;
const frontageOwner = (id: number, side: -1 | 1): number => id * 2 + (side === 1 ? 1 : 0);

/** A tree takes no cells: it grows where nothing was built. */
const NO_CLAIM: [number, number, number, number] = [0, 0, 0, 0];

/**
 * A rectangle of cells an edit touched.
 *
 * Handed to `makeCity` so it can rebuild that part of the city and reuse the
 * rest. Omit it and the whole city is made again, which is what loading a save
 * and starting a game both want.
 */
export interface Dirty { gx: number; gz: number; w: number; d: number; }

/**
 * How far a change can reach, in cells.
 *
 * Two of the largest things these passes can grow, plus the depth a frontage
 * builds back from its kerb and the kerb's own offset from the road. The
 * biggest building the frontage, backland and planting passes can place is
 * seven cells across -- `tools/` will say so -- so two of them interact at
 * fourteen, and six more covers the build-back with slack to spare.
 *
 * It was forty-two, taken from the largest lot in the whole library. That is
 * the wrong number: an airport is thirty-five cells across but it is *placed*,
 * not grown, and a placed building that did not change keeps its claim on the
 * ground whatever happens nearby. Sizing the region for it made every edit
 * remake four times the area it needed to, and every frontage within three
 * hundred metres instead of one.
 */
const REACH = 28;



/**
 * The city as it currently stands, kept so the next edit can reuse it.
 *
 * The whole reason this exists: a rebuild regenerates every building in the
 * city, and a measurement of what an edit actually changes says nought point
 * one to two per cent of it. Doing a hundred per cent of the work for two per
 * cent of the change is fine on a village and unplayable on a city, and it gets
 * worse in exactly the direction a game goes.
 */
interface Standing {
  world: World;
  grid: number;
  cells: Uint8Array;
  hard: Uint8Array;
  /** The buffer itself, not a copy of it. See below. */
  out: Instances;
  pads: Pad[];
  padOwner: number[];
  pop: Uint32Array;
  cover: Uint8Array;
  roads: number;
}

let standing: Standing | null = null;

/** Throws the standing city away, so the next build is made from nothing. */
export function clearStanding(): void {
  standing = null;
}

export function makeCity(world: World = defaultWorld(), dirty?: Dirty): City {
  const GRID = world.grid;
  const half = GRID / 2;
  // Whether this build can carry on from the last one.
  //
  // Decided before anything is allocated, because the whole point is not to
  // allocate: the occupancy grid, the instance buffer, the pad list and the
  // grass map are all held from last time and worked on in place. Copying them
  // to be safe is three megabytes an edit, which on a small edit is the entire
  // cost.
  const carry = dirty !== undefined && standing !== null
    && standing.world === world && standing.grid === GRID ? standing : null;
  // Taken down while the city is being changed. Anything that throws below
  // leaves half-edited arrays behind, and the next build must start clean
  // rather than carry them on.
  standing = null;

  const out = carry !== null ? carry.out : new Instances();
  /** Set while the planting pass is putting a tree on ground nobody owns. */
  let wild = false;
  const wildOut = new Instances();
  const wildPop = new Uint32Array(PROTO_COUNT);
  const cells = carry !== null ? carry.cells : new Uint8Array(GRID * GRID);
  const population = carry !== null ? carry.pop : new Uint32Array(PROTO_COUNT);
  /** What each placement wants the ground under it to be. */
  const pads: Pad[] = carry !== null ? carry.pads : [];
  /** Who each pad belongs to, so a re-run pass can drop its own. */
  const padOwner: number[] = carry !== null ? carry.padOwner : [];
  /**
   * Where grass cannot grow: paving and the footprint of a building.
   *
   * Not the same as the occupancy grid, which is about what may be *placed*.
   * A tree's lot is two cells of which the tree occupies a trunk's worth, and
   * a building's lot has margin around it -- all of that is lawn. Taking the
   * occupancy grid as the answer left ten per cent of the map growing grass
   * and the rest of it bald.
   */
  const hard = carry !== null ? carry.hard : new Uint8Array(GRID * GRID);
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

  // ---- what has to be made again --------------------------------------
  //
  // With a dirty rectangle and a city already standing, only the part of the
  // map an edit could have reached is rebuilt. Everything else is adopted
  // whole: its instances, its pads, its claim on the ground.
  const prior = carry;
  /**
   * The ground the grass map has to be worked out again over: the region, plus
   * everywhere a dropped building gave its footprint back.
   */
  let coverBox = { x0: 0, z0: 0, x1: GRID - 1, z1: GRID - 1 };
  /** Whether the network moved, which re-cuts corridors anywhere they run. */
  const roadsChanged = prior === null || prior.roads !== net.version;
  const zone = prior === null ? null : {
    x0: Math.max(0, dirty!.gx - REACH), z0: Math.max(0, dirty!.gz - REACH),
    x1: Math.min(GRID - 1, dirty!.gx + dirty!.w + REACH),
    z1: Math.min(GRID - 1, dirty!.gz + dirty!.d + REACH),
  };
  /** True for a cell rectangle that overlaps the region being remade. */
  const inZone = (gx: number, gz: number, w = 1, d = 1): boolean =>
    zone !== null && gx + w > zone.x0 && gx <= zone.x1
      && gz + d > zone.z0 && gz <= zone.z1;

  // Which frontages are remade: any whose road passes through the region, plus
  // the reach behind it, because a frontage builds back from its kerb.
  const remade = new Set<number>();
  /** Every frontage there still is, so a road that was bulldozed takes its
   * buildings with it. Without this a demolished street leaves its terrace
   * standing in a field: the frontage that owns those buildings is simply gone
   * from the graph, so nothing ever asks for them to be made again and nothing
   * ever drops them. */
  const alive = new Set<number>();
  if (zone !== null) {
    for (const f of net.frontages()) {
      alive.add(frontageOwner(f.id, f.side));
    }
    for (const f of net.frontages()) {
      const b = net.linkBounds(f.link);
      const m = REACH * CELL;
      const zx0 = (zone.x0 - half) * CELL, zx1 = (zone.x1 + 1 - half) * CELL;
      const zz0 = (zone.z0 - half) * CELL, zz1 = (zone.z1 + 1 - half) * CELL;
      if (b.x1 + m < zx0 || b.x0 - m > zx1 || b.z1 + m < zz0 || b.z0 - m > zz1) continue;
      remade.add(frontageOwner(f.id, f.side));
    }
  }

  /**
   * The box the cell-addressed passes have to cover: the region, and every
   * corridor whose frontage is being remade.
   */
  const cellSpan = (): { x0: number; z0: number; x1: number; z1: number } =>
    (zone === null ? { x0: 0, z0: 0, x1: GRID - 1, z1: GRID - 1 } : zone);

  /**
   * True where a cell-addressed pass must run: the same test the drop uses, so
   * exactly what was taken away is put back.
   *
   * The region and nothing more. Widening it to the whole length of every road
   * whose frontage is being remade was tried and is wrong: a street is two and a
   * half kilometres long, its bounding box is most of the map, and remaking
   * "everything near a remade street" remakes the city -- which is both slower
   * and, because the region is then only partly cleared, less accurate.
   */
  const remakes = (gx: number, gz: number): boolean => inZone(gx, gz);

  if (prior !== null) {
    // Adopt the standing city, then take out everything the region owns.
    // How far a cell-addressed thing has to be from a remade road before it can
    // be left standing: the depth a frontage builds back, and a little more.
    /** True for anything the region is about to make again. */
    const replaced = (owner: number): boolean => {
      if (owner >= 0) return remade.has(owner) || !alive.has(owner);
      const cell = cellOfOwner(owner);
      return remakes(cell % GRID, (cell / GRID) | 0);
    };
    // Everything the region and its frontages give back, as one box, so the
    // survivors that reach into it can be found in a single sweep.
    let cx0 = zone!.x0, cz0 = zone!.z0, cx1 = zone!.x1, cz1 = zone!.z1;
    out.dropWhere(replaced, population, (gx, gz, w, d) => {
      for (let j = 0; j < d; j++) {
        const z = gz + j;
        if (z < 0 || z >= GRID) continue;
        for (let i = 0; i < w; i++) {
          const x = gx + i;
          if (x < 0 || x >= GRID) continue;
          cells[z * GRID + x] = FREE;
          hard[z * GRID + x] = 0;
        }
      }
      if (gx < cx0) cx0 = gx;
      if (gz < cz0) cz0 = gz;
      if (gx + w - 1 > cx1) cx1 = gx + w - 1;
      if (gz + d - 1 > cz1) cz1 = gz + d - 1;
    });
    let keptPads = 0;
    for (let i = 0; i < pads.length; i++) {
      if (replaced(padOwner[i])) continue;
      pads[keptPads] = pads[i];
      padOwner[keptPads] = padOwner[i];
      keptPads++;
    }
    pads.length = keptPads;
    padOwner.length = keptPads;
    // The ground the region stood on goes back to nothing, then the claims of
    // everything that survived and reaches into it are put back. Without that
    // second step a building just outside the region loses its footprint and
    // the rebuild puts a terrace through it.
    for (let gz = zone!.z0; gz <= zone!.z1; gz++) {
      for (let gx = zone!.x0; gx <= zone!.x1; gx++) {
        cells[gz * GRID + gx] = FREE;
        hard[gz * GRID + gx] = 0;
      }
    }
    coverBox = { x0: cx0, z0: cz0, x1: cx1, z1: cz1 };
    /** Overlaps the ground that was given back, so it must be marked again. */
    const cleared = (gx: number, gz: number, w: number, d: number): boolean =>
      gx + w > cx0 && gx <= cx1 && gz + d > cz0 && gz <= cz1;
    const keptRec = out.record;
    for (let i = 0; i < out.count; i++) {
      const t = i * 5;
      const w = keptRec[t + 3], d = keptRec[t + 4];
      if (w <= 0 || d <= 0) continue;
      const gx = keptRec[t + 1], gz = keptRec[t + 2];
      if (!cleared(gx, gz, w, d)) continue;
      for (let j = 0; j < d; j++) {
        const z = gz + j;
        if (z < 0 || z >= GRID) continue;
        for (let i = 0; i < w; i++) {
          const x = gx + i;
          if (x < 0 || x >= GRID) continue;
          cells[z * GRID + x] = TAKEN;
          hard[z * GRID + x] = 1;
        }
      }
    }
  }

  // The corridor, marked as unbuildable. Only over the ground that was given
  // back when there is a region: everywhere else the mark is already there and
  // sweeping four hundred thousand cells to write it again is the largest fixed
  // cost an edit had left.
  if (prior === null) {
    for (let i = 0; i < cells.length; i++) if (net.cls[i] !== 0) cells[i] = STREET_CELL;
  } else {
    for (let gz = coverBox.z0; gz <= coverBox.z1; gz++) {
      const row = gz * GRID;
      for (let gx = coverBox.x0; gx <= coverBox.x1; gx++) {
        if (net.cls[row + gx] !== 0) cells[row + gx] = STREET_CELL;
      }
    }
  }

  /** World coordinate of a cell's low edge. */
  const wx = (gx: number): number => (gx - half) * CELL;

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
    // Nine points over the footprint, read through the corner cache.
    //
    // These used to call the height field directly, which is three octaves of
    // noise and a river lookup nine times for every building the spawner tries
    // -- and it tries eight prototypes at each position along every frontage.
    // That was the largest single cost of zoning a block. The ground is graded
    // to the cell corners anyway, so reading the nearest corner is not an
    // approximation of what the building will stand on, it is what it will
    // stand on.
    let lo = Infinity, hi = -Infinity, sum = 0, n = 0;
    const c = Math.cos(yaw), sn = Math.sin(yaw);
    for (let j = -1; j <= 1; j++) {
      for (let i = -1; i <= 1; i++) {
        const ox = i * hw, oz = j * hd;
        const px = cx + ox * c - oz * sn, pz = cz + ox * sn + oz * c;
        const y = baseAtCorner(Math.round(px / CELL + half),
          Math.round(pz / CELL + half), baseHeightAt);
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
    out.took = boxCells(cx, cz, hw, hd, yaw);
    padOwner.push(out.owner);
    pads.push({
      gx: pgx, gz: pgz,
      w: Math.max(1, Math.ceil((cx + bx) / CELL + half) - pgx),
      d: Math.max(1, Math.ceil((cz + bz) / CELL + half) - pgz),
      y: level,
    });
    out.add(
      cx, cz, level - 0.25, yaw,
      bx + 0.8, bz + 0.8, p.height * 1.2 + 3, p.index,
      1, 0, 0, 0,
    );
    population[p.index]++;
    claimBox(cx, cz, hw, hd, yaw);
    return true;
  };

  /** The rectangle `claimBox` would take, in cells, for the claim record. */
  const boxCells = (cx: number, cz: number, hw: number, hd: number, yaw: number):
  [number, number, number, number] => {
    const c = Math.abs(Math.cos(yaw)), sn = Math.abs(Math.sin(yaw));
    const rx = hw * c + hd * sn, rz = hw * sn + hd * c;
    const gx0 = Math.floor((cx - rx) / CELL + half), gx1 = Math.floor((cx + rx) / CELL + half);
    const gz0 = Math.floor((cz - rz) / CELL + half), gz1 = Math.floor((cz + rz) / CELL + half);
    return [gx0, gz0, gx1 - gx0 + 1, gz1 - gz0 + 1];
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
    // Graded things stand on the mean of their lot, because that is the height
    // the ground under them is about to be cut to. Ungraded things -- trees --
    // stand on the ground where they are, sampled the way the terrain is drawn
    // rather than averaged over their lot: the mean of a two-cell lot's
    // corners describes a sixteen-metre square, and on a slope that is most of
    // a metre between a trunk and the soil.
    const level = typeof grade === 'number' ? grade
      : grade === true ? ground.mean
        : baseAtPoint((x0 + x1) / 2, (z0 + z1) / 2, baseHeightAt);
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
    const into = wild ? wildOut : out;
    into.owner = out.owner;
    into.took = p.def.zone === 'nature' ? NO_CLAIM : [gx, gz, w, d];
    if (grade === true) padOwner.push(out.owner);
    into.add(
      (x0 + x1) / 2, (z0 + z1) / 2, level - 0.25, yaw,
      // A tenth of a cell of slack: the declared lot is what asset-test holds
      // the meshes inside, and a box exactly on that boundary would cull a
      // prototype's own parapet at the screen edge.
      hx + 0.8, hz + 0.8, p.height * 1.2 + 3, p.index,
      stretch, 0, 0, 0,
    );
    (wild ? wildPop : population)[p.index]++;
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
   * All three come from the world when the player said so. Painting a theme is
   * how you get a European quarter on purpose; leaving it off is how you get
   * one that grew, which is derived from where the block is -- a fact about the
   * place rather than a decision anyone made. Both on one map is the point.
   */
  // Nothing grows out of reach of a road.
  //
  // A city builder where a painted rectangle fills with houses whether or not
  // anything can get to them is not a city builder, it is a texture painter.
  // Two things went wrong without this. The backland pass -- which is right,
  // because mews and yards behind a street are real -- would fill the middle
  // of an arbitrarily large painted area with buildings that fronted nothing,
  // and the player would see houses standing in open country with a field
  // between them and the nearest tarmac. And painting far from a road silently
  // did nothing at all, which reads as the tool being broken rather than as
  // the rule it actually is.
  const reach = net.reach();

  const districtOf = (gx: number, gz: number): { zone: Zone; density: Density; theme: Theme } | null => {
    if (gx < 0 || gz < 0 || gx >= GRID || gz >= GRID) return null;
    // Nothing grows on land nobody bought. Checked here as well as in the
    // tools, because zoning painted before a plot was sold back, or carried in
    // by an old save, must not quietly come up as a suburb.
    if (!world.land.owns(plotAt(GRID, gx, gz))) return null;
    if (reach[at(gx, gz)] > REACH_CELLS) return null;
    const code = world.zones[at(gx, gz)];
    const painted = zoneOf(code);
    if (painted === null) return null;
    if (painted.theme !== null) {
      return { zone: painted.zone, density: painted.density, theme: painted.theme };
    }
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
    if (zone !== null && !inZone(lot.gx, lot.gz, lot.w, lot.d)) continue;
    const index = ASSET_INDEX.get(lot.id);
    const p = assetById(lot.id);
    if (index === undefined || p === undefined) continue;
    if (!free(lot.gx, lot.gz, lot.w, lot.d, STREET_CELL)) continue;
    const ground = survey(lot.gx, lot.gz, lot.w, lot.d);
    const x0 = wx(lot.gx), z0 = wx(lot.gz);
    const x1 = x0 + lot.w * CELL, z1 = z0 + lot.d * CELL;
    out.owner = ownerOfCell(at(lot.gx, lot.gz));
    // A landmark's grounds are claimed as well as its footprint, so the record
    // has to cover both or a rebuild beside one lets a terrace into its lawn.
    out.took = lot.grounds === undefined
      ? [lot.gx, lot.gz, lot.w, lot.d]
      : [Math.min(lot.gx, lot.grounds[0]), Math.min(lot.gz, lot.grounds[1]),
        Math.max(lot.gx + lot.w, lot.grounds[0] + lot.grounds[2])
          - Math.min(lot.gx, lot.grounds[0]),
        Math.max(lot.gz + lot.d, lot.grounds[1] + lot.grounds[3])
          - Math.min(lot.gz, lot.grounds[1])];
    padOwner.push(out.owner);
    out.add(
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
  const buildFrontage = (f: { link: number; id: number; side: -1 | 1; from: number; to: number },
    deep: number): void => {
    out.owner = frontageOwner(f.id, f.side);
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
  for (const { f } of order) {
    if (zone !== null && !remade.has(frontageOwner(f.id, f.side))) continue;
    buildFrontage(f, BLOCK >> 1);
  }

  // Whatever the frontages left behind them. Backland is real -- mews, yards,
  // workshops behind a street -- and without it the middle of every block in
  // the city is an identical empty square.
  // The cell passes cover the region *and* every corridor whose frontage was
  // remade, because those are exactly the cells that were given back.
  const span = cellSpan();
  for (let gz = span.z0; gz <= span.z1; gz++) {
    for (let gx = span.x0; gx <= span.x1; gx++) {
      if (gx < 1 || gz < 1 || gx >= GRID - 1 || gz >= GRID - 1) continue;
      if (zone !== null && !remakes(gx, gz)) continue;
      if (cells[at(gx, gz)] !== FREE) continue;
      if (hash2(gx, gz, 647) > 0.34) continue;
      const district = districtOf(gx, gz);
      if (district === null) continue;
      const p = pick(stock(district.zone, district.density, district.theme), gx, gz, 653);
      if (!p) continue;
      const yaw = Math.floor(hash2(gx, gz, 659) * 4) % 4;
      const [w, d] = yaw % 2 === 0 ? [p.w, p.d] : [p.d, p.w];
      if (!free(gx, gz, w, d, FREE)) continue;
      out.owner = ownerOfCell(at(gx, gz));
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
  const value = landValue(GRID);

  // The countryside, kept between rebuilds.
  //
  // Ninety-five per cent of what stands on this map is trees, nearly all of
  // them on land nobody owns -- and a player cannot touch any of it. Drawing a
  // street regenerated all fifty thousand of them, every time, to produce
  // exactly the same fifty thousand.
  //
  // A plot is live if it is owned or touches something owned; everything
  // outside that is wild, and wild ground is generated once per land purchase
  // and then spliced in. Dilating by a whole plot rather than by the grading's
  // reach is deliberate slack: the grading can push ground about seventy metres
  // past a building, a plot is six hundred, so the cached trees are provably
  // standing on ground the edit did not move.
  const live = livePlots(world);
  const wildKey = `${GRID}:${world.land.lo}:${world.land.hi}`;
  const cached = wildCache !== null && wildCache.key === wildKey ? wildCache : null;
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

    // Four hundred thousand cells, and most of them take the last branch. So
    // nothing above a branch is computed for cells that will not use it: the
    // distance to downtown was a square root per cell thrown away, and
    // `zoneOf` allocated an object per cell for a map that is mostly unzoned.
    // Wild plots are stepped over whole rather than cell by cell. The scan is
    // four hundred thousand iterations on a map where, early on, a player owns
    // four plots of sixty-four -- and every one of those iterations outside the
    // live set was about to reach the same `continue` anyway.
    const plotWide = plotCells(GRID);
    const grow = cellSpan();
    for (let cz = grow.z0; cz <= grow.z1; cz++) {
      for (let cx = grow.x0; cx <= grow.x1; cx++) {
        if (zone !== null && !remakes(cx, cz)) continue;
        // Wild ground: every tree on it, whichever branch below plants it,
        // belongs to the cache rather than to this rebuild. Set once per cell
        // rather than per branch -- the first version set it only in the
        // out-of-town branch, and the in-town branch plants on unowned land
        // too, so a quarter of the map's trees were generated into the live
        // buffer and then vanished on the next edit when their plot was
        // skipped.
        out.owner = ownerOfCell(at(cx, cz));
        wild = live[plotAt(GRID, cx, cz)] === 0;
        if (cached !== null && wild) {
          cx = (Math.floor(cx / plotWide) + 1) * plotWide - 1;
          continue;
        }
        const cell = at(cx, cz);
        if (cells[cell] !== FREE) continue;

        // A park block: planted like woodland rather than like a back garden,
        // because that is what it is for.
        const code = world.zones[cell];
        const zoned = code === 0 ? null : zoneOf(code);
        if (zoned !== null && zoned.zone === 'nature') {
          // Almost every slot, and the two-cell species first. A crown is
          // wider than the lot it stands on, so trees on a two-cell pitch
          // close their canopy while three-cell ones leave gaps between --
          // and a park you can see the grass through is a lawn.
          if (hash2(cx, cz, 815) > 0.42) continue;
          plant(cx, cz, [mid, big, small]);
          continue;
        }

        const d = value[cell];
        const i = cx % PERIOD, j = cz % PERIOD;
        if (d > 0.02 && i < BLOCK && j < BLOCK) {
          // In town. Denser in the suburbs than downtown, which is what a
          // city is, and four times denser against the street than behind it.
          const edge = i === 0 || j === 0 || i === BLOCK - 1 || j === BLOCK - 1;
          // Street trees stay -- they are what a street looks like -- but the
          // back-garden ones mostly go: they are behind buildings, invisible
          // from any camera a player uses, and there were tens of thousands.
          const density = (0.5 - d * 0.24) * (edge ? 1.15 : 0.10);
          if (hash2(cx, cz, 811) > density) continue;
          plant(cx, cz, [mid, small, big]);
          continue;
        }

        // Out of town. Copses: a low-frequency noise decides where woodland
        // is at all, and inside one the canopy is close to continuous. An
        // even scatter at the same tree count reads as an orchard.
        //
        // Wild ground is skipped entirely when the cache holds it: nothing
        // here claims a cell or hardens one, so leaving it out changes nothing
        // the rest of the pass can see.
        const shade = canopy[cell] - d * 0.6;
        if (shade <= 0 || hash2(cx, cz, 813) > shade) continue;
        plant(cx, cz, [mid, big, small]);
      }
    }
    wild = false;
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
  // Only the ground the region could have moved, when there is a region: the
  // pads outside it are the ones that were already standing, at the heights
  // they were already graded to.
  let moved: { x0: number; z0: number; x1: number; z1: number } | null = null;
  if (zone !== null) {
    moved = {
      x0: (zone.x0 - half) * CELL, z0: (zone.z0 - half) * CELL,
      x1: (zone.x1 + 1 - half) * CELL, z1: (zone.z1 + 1 - half) * CELL,
    };
    // A road that changed re-cuts its own corridor wherever it runs.
    if (roadsChanged) moved = null;
  }
  gradeGround(pads, baseHeightAt, roads.pins, moved);

  // Open ground, for the grass. Thinned by one cell against anything hard, so
  // a blade does not stop dead at a kerb -- real grass runs up to an edge and
  // gets worn as it goes.
  // Where grass grows, from where paving does not.
  //
  // Only over the ground that was given back, when there is any: this reads
  // four neighbours per cell over four hundred thousand cells, and outside the
  // edit the answer is the one already in the array.
  const cover = carry !== null ? carry.cover : new Uint8Array(GRID * GRID);
  const gz0 = carry === null ? 0 : Math.max(0, coverBox.z0 - 1);
  const gz1 = carry === null ? GRID - 1 : Math.min(GRID - 1, coverBox.z1 + 1);
  const gx0 = carry === null ? 0 : Math.max(0, coverBox.x0 - 1);
  const gx1 = carry === null ? GRID - 1 : Math.min(GRID - 1, coverBox.x1 + 1);
  for (let gz = gz0; gz <= gz1; gz++) {
    for (let gx = gx0; gx <= gx1; gx++) {
      if (hard[at(gx, gz)] === 1) { cover[at(gx, gz)] = 0; continue; }
      let open = 4;
      if (gx > 0 && hard[at(gx - 1, gz)] === 1) open--;
      if (gx + 1 < GRID && hard[at(gx + 1, gz)] === 1) open--;
      if (gz > 0 && hard[at(gx, gz - 1)] === 1) open--;
      if (gz + 1 < GRID && hard[at(gx, gz + 1)] === 1) open--;
      cover[at(gx, gz)] = 110 + open * 36;
    }
  }

  // The countryside, then the city.
  //
  // That order rather than the other way round, and into a buffer that is kept
  // between rebuilds: the wild half is the big half and it does not change, so
  // putting it first means it is written once per land purchase and the edit
  // only ever rewrites the tail. Appending it instead would have moved fifty
  // thousand instances every time the city grew by one, which is most of a
  // three-megabyte copy per road drawn.
  //
  // Nothing downstream cares what order instances arrive in: the culler sorts
  // them into buckets by prototype.
  // What stands now, for the next edit to reuse.
  standing = {
    world, grid: GRID, cells, hard, out, pads, padOwner, pop: population, cover,
    roads: net.version,
  };

  const fresh = cached === null;
  const keep = cached ?? { key: wildKey, data: wildOut.data.slice(), pop: wildPop };
  wildCache = keep;
  const liveData = out.data;
  const total = keep.data.length + liveData.length;
  if (joined === null || joined.length < total) {
    joined = new Float32Array(Math.ceil(total * 1.3));
    joinedWild = -1;
  }
  if (fresh || joinedWild !== keep.data.length) {
    joined.set(keep.data, 0);
    joinedWild = keep.data.length;
  }
  joined.set(liveData, keep.data.length);
  for (let i = 0; i < population.length; i++) population[i] += keep.pop[i];

  return {
    data: joined.subarray(0, total) as Float32Array<ArrayBuffer>,
    count: total / INSTANCE_FLOATS, population, cover, roads,
  };
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
  const half = grid / 2;
  // The starting land is the middle four plots, so it reaches this many cells
  // either side of the centre. Taken from the plot grid rather than written
  // down, because a change to one should move the other.
  const homeHalf = plotCells(grid);
  // The belt outside it, in cells: about two hundred metres.
  const BELT = 26;
  for (let cz = 0; cz < grid; cz++) {
    for (let cx = 0; cx < grid; cx++) {
      // How far outside the starting land this cell is, measured as a box
      // rather than a radius: the land the player owns is a square, and a
      // circular clearing inside a square plot leaves trees in the corners of
      // the one place that has to be clear.
      const outside = Math.max(Math.abs(cx - half), Math.abs(cz - half)) - homeHalf;
      // Nothing at all on the starting land. A site the player has to clear
      // before they can draw their first road is a chore, not a challenge.
      if (outside <= 0) continue;

      // Woodland at two scales, which is the whole point.
      //
      // One noise field thresholded once gives one size of wood, repeated
      // across the map at one spacing -- which is an even spread wearing a
      // disguise. Countryside is not like that: it has wooded country and open
      // country, and inside the wooded country it has closed forest, and inside
      // the open country it has the odd copse in a field corner.
      //
      // So: a very low frequency field decides which kind of country this is,
      // and it moves the *threshold* the wood field has to clear. In forest
      // country the bar is low and the woods join up into something you could
      // lose a road in; in open country the bar is high and only the peaks of
      // the wood field get through, as small stands with fields between them.
      const region = fbm(cx * 0.0041, cz * 0.0041, 2, 4103);
      const wood = fbm(cx * 0.0128, cz * 0.0128, 3, 917);
      const grain = fbm(cx * 0.055, cz * 0.055, 2, 331);

      const bar = 0.71 - region * 0.31;
      if (wood <= bar) continue;
      const stand = (wood - bar) / (1 - bar);

      // How thick a wood gets here, also from the region field: a forest is
      // closed and a field-corner copse is a dozen trees. One cap for both
      // made the forests thin and the copses into thickets.
      const thick = 0.13 + region * 0.26;

      // The ragged edge, and glades. The fine field both breaks the outline of
      // a wood and punches holes in the middle of one, because a forest with a
      // uniform interior reads as a texture rather than as trees.
      let d = stand * (0.45 + grain * 1.05);
      if (grain < 0.30) d *= grain / 0.30;
      d = Math.min(thick, d);

      // The belt around the starting land: some trees, not many, and fewer the
      // closer to the fence. A bare plain around the site looks mown, and full
      // countryside right up against it looks like a wall.
      const ramp = Math.min(1, outside / BELT);
      out[cz * grid + cx] = d * (0.20 + 0.80 * ramp * ramp);
    }
  }
  woodMask = out;
  woodFor = grid;
  return out;
}

/**
 * The countryside as it was last generated, and which land that was for.
 *
 * Module scope, like the woodland and land-value masks above and for the same
 * reason: it depends on the map and on what the player owns, and on nothing
 * that an edit changes.
 */
let wildCache: { key: string; data: Float32Array; pop: Uint32Array } | null = null;

/**
 * The buffer the two halves are joined in, kept so an edit is one write of the
 * part that changed rather than an allocation and a copy of the whole city.
 */
let joined: Float32Array | null = null;
/** How many floats of `joined` currently hold the countryside. */
let joinedWild = -1;

/** Throws the cached countryside away, for a tool that changes the terrain. */
whenTerrainChanges(() => clearWild());

export function clearWild(): void {
  wildCache = null;
  joined = null;
  joinedWild = -1;
}

/**
 * Which plots are close enough to owned land that an edit could reach them.
 *
 * A plot is live if it is owned or touches one that is. Everything else is
 * wild: too far for the grading to move and too far for anything to be built
 * on, so what stands there this rebuild is what stood there last.
 */
function livePlots(world: World): Uint8Array {
  const out = new Uint8Array(PLOTS * PLOTS);
  for (let pz = 0; pz < PLOTS; pz++) {
    for (let px = 0; px < PLOTS; px++) {
      if (!world.land.owns(pz * PLOTS + px)) continue;
      for (let dz = -1; dz <= 1; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = px + dx, nz = pz + dz;
          if (nx < 0 || nz < 0 || nx >= PLOTS || nz >= PLOTS) continue;
          out[nz * PLOTS + nx] = 1;
        }
      }
    }
  }
  return out;
}

/**
 * How central a cell is, 1 in the middle and 0 at the edge of the built area.
 *
 * Memoised for the same reason the woodland mask is: it depends on the cell
 * and nothing else, and the planting pass asked for it four hundred thousand
 * times an edit -- a square root each, for an answer that never changes.
 */
let valueMask: Float32Array | null = null;
let valueFor = -1;

function landValue(grid: number): Float32Array {
  if (valueMask !== null && valueFor === grid) return valueMask;
  const out = new Float32Array(grid * grid);
  const half = grid / 2;
  const core = half * 8 * 0.8;
  for (let cz = 0; cz < grid; cz++) {
    for (let cx = 0; cx < grid; cx++) {
      out[cz * grid + cx] =
        Math.max(0, 1 - Math.hypot((cx - half) * 8, (cz - half) * 8) / core);
    }
  }
  valueMask = out;
  valueFor = grid;
  return out;
}
