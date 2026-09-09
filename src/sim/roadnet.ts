/**
 * The road network: what the player draws, and what it turns into.
 *
 * A city builder lives or dies on this. Roads have to snap, cross each other
 * without being asked to, grow a junction where they meet, and join a road
 * that is already there rather than running alongside it -- and all of that
 * has to happen while the player is still dragging.
 *
 * The representation is deliberately not a planar graph. Everything here is
 * axis-aligned -- it has to be, because the facade shading picks its
 * coordinate frame from the dominant face normal and a wall at forty degrees
 * shears every brick course on it -- and once roads are axis-aligned bands on
 * a cell grid, the grid *is* the graph. A road is a rectangle of cells; two
 * roads that cross share cells; a cell claimed by both an east-west road and a
 * north-south one is, by definition, a junction. Nothing has to detect an
 * intersection because an intersection is not an event, it is a property of
 * the cells.
 *
 * That falls out into the four behaviours the player actually notices:
 *
 *   - crossing an existing road builds the junction, because the shared cells
 *     are a junction the moment both roads are marked
 *   - ending on an existing road joins it, for the same reason
 *   - two roads of the same class meet flush, because they are the same width
 *   - a narrow road meeting a wide one takes the wide one's junction, because
 *     the junction is sized from the widest class in it
 *
 * What it costs is that a road runs north-south or east-west and turns in
 * right angles. For this game that is not a compromise, it is the grid the
 * whole simulation is built on.
 */

import { simConfig } from './config';

export type RoadClass = 'street' | 'avenue';

export interface ClassSpec {
  /** Cells across the corridor, including verges. */
  width: number;
  /** Cells one straight tile covers along the road. */
  tile: number;
  /** Straight tiles, any of which may be used for a run. */
  straights: readonly string[];
  /** Four arms. */
  cross: string;
  /** Three arms; drawn with its side arm on local +X, so yaw picks the gap. */
  tee: string;
  /** Two arms meeting at a right angle. */
  corner: string;
}

/**
 * The classes a player can draw.
 *
 * Both tile in fours, which is what lets a run of any length be covered
 * exactly: a run is tiled by however many pieces come closest and each is
 * stretched to make up the difference.
 */
export const ROAD_CLASSES: Record<RoadClass, ClassSpec> = {
  street: {
    width: 3, tile: 4,
    straights: ['road.street', 'road.avenue', 'road.oneway', 'road.buslane',
      'road.calming', 'road.layby', 'road.lane'],
    cross: 'road.mini', tee: 'road.mini', corner: 'road.mini',
  },
  avenue: {
    width: 4, tile: 4,
    // Dual carriageway most of the time; the others are what a boulevard has
    // in one stretch and not the next.
    straights: ['road.dual4', 'road.dual4', 'road.dual4', 'road.tram',
      'road.crossing', 'road.bays'],
    cross: 'road.crossroads', tee: 'road.tjunction', corner: 'road.crossroads',
  },
};

const ORDER: RoadClass[] = ['street', 'avenue'];

/** One asset the tiler wants placed. */
export interface Placement {
  id: string;
  /** Low corner, in cells. May be fractional where a piece is centred. */
  gx: number;
  gz: number;
  /** Size in cells, as placed. */
  w: number;
  d: number;
  /** Quarter turns, the same convention as MeshBuilder.placed. */
  yaw: number;
  /** Scale along the prototype's own Z. 1 for anything but a straight run. */
  stretch: number;
  /**
   * Which straight run this belongs to, or -1 for a junction.
   *
   * A run is the unit of grading, not a tile: a tile is a rigid slab and two
   * of them levelled separately step against each other. It is also the unit
   * of reservation, because stretched tiles round into each other's cells and
   * checking them one at a time rejects every other one.
   */
  run: number;
}

/** One side of one road, and the land behind it. */
export interface Frontage {
  /** Which way the road runs. */
  axis: 'x' | 'z';
  /** The cell just outside the carriageway, in the other axis. */
  kerb: number;
  /** Which way is away from the road: -1 or +1 on the kerb's axis. */
  step: -1 | 1;
  /** Inclusive range along the road. */
  from: number;
  to: number;
  /** The quarter turn that points a prototype's front at the road. */
  yaw: number;
}

/** A straight stretch of one class, as drawn. */
interface Segment {
  axis: 'x' | 'z';
  /** Low cell of the band, in the axis the road does not run along. */
  side: number;
  /** Inclusive range along the axis the road runs along. */
  from: number;
  to: number;
  cls: RoadClass;
}

/** A spreading hash of three small integers. */
function hash3(a: number, b: number, c: number): number {
  let h = (a | 0) * 374761393 + (b | 0) * 668265263 + (c | 0) * 2147483647;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}

/** Runs east-west. */
const ALONG_X = 1;
/** Runs north-south. */
const ALONG_Z = 2;

export class RoadNet {
  private readonly grid: number;
  private readonly segments: Segment[] = [];
  /** Class index plus one per cell; 0 is open ground. */
  readonly cls: Uint8Array;
  /** Which way roads run through each cell. Both bits set is a junction. */
  private readonly axis: Uint8Array;
  private nextRun = 0;

  constructor(grid = simConfig.cityGrid) {
    this.grid = grid;
    this.cls = new Uint8Array(grid * grid);
    this.axis = new Uint8Array(grid * grid);
  }

  /**
   * Demolishes the road over a rectangle of cells.
   *
   * What happens when something large enough to need its own superblock is
   * built across a street: an airport does not have a road running through the
   * middle of it. The runs on either side stop at the edge of the cleared
   * ground rather than being tiled through it and drawn under the building.
   */
  clear(gx: number, gz: number, w: number, d: number): void {
    for (let j = 0; j < d; j++) {
      const z = gz + j;
      if (z < 0 || z >= this.grid) continue;
      for (let i = 0; i < w; i++) {
        const x = gx + i;
        if (x < 0 || x >= this.grid) continue;
        this.cls[z * this.grid + x] = 0;
        this.axis[z * this.grid + x] = 0;
      }
    }
  }

  /** True where a road covers this cell. */
  has(gx: number, gz: number): boolean {
    if (gx < 0 || gz < 0 || gx >= this.grid || gz >= this.grid) return false;
    return this.cls[gz * this.grid + gx] !== 0;
  }

  /**
   * Draws a road along its centreline, from one cell to another.
   *
   * A request that is neither horizontal nor vertical becomes two segments
   * meeting at a right angle, longer leg first, which is what every road tool
   * in the genre does and what a player expects from a drag.
   */
  add(ax: number, az: number, bx: number, bz: number, cls: RoadClass): void {
    if (ax === bx || az === bz) {
      this.segment(ax, az, bx, bz, cls);
      return;
    }
    if (Math.abs(bx - ax) >= Math.abs(bz - az)) {
      this.segment(ax, az, bx, az, cls);
      this.segment(bx, az, bx, bz, cls);
    } else {
      this.segment(ax, az, ax, bz, cls);
      this.segment(ax, bz, bx, bz, cls);
    }
  }

  private segment(ax: number, az: number, bx: number, bz: number, cls: RoadClass): void {
    const spec = ROAD_CLASSES[cls];
    const axis: 'x' | 'z' = ax === bx ? 'z' : 'x';
    // The band is centred on the line the player drew. An even width has no
    // exact centre, so it leans one cell towards the origin -- consistently,
    // so two roads drawn along the same line always land on the same cells.
    const centre = axis === 'x' ? az : ax;
    const side = centre - (spec.width >> 1);
    const from = Math.min(axis === 'x' ? ax : az, axis === 'x' ? bx : bz);
    const to = Math.max(axis === 'x' ? ax : bx, axis === 'x' ? bx : bz);
    if (to < from) return;
    this.segments.push({ axis, side, from, to, cls });
    this.mark(this.segments[this.segments.length - 1]);
  }

  private mark(s: Segment): void {
    const spec = ROAD_CLASSES[s.cls];
    const rank = ORDER.indexOf(s.cls) + 1;
    const bit = s.axis === 'x' ? ALONG_X : ALONG_Z;
    for (let i = s.from; i <= s.to; i++) {
      for (let j = 0; j < spec.width; j++) {
        const gx = s.axis === 'x' ? i : s.side + j;
        const gz = s.axis === 'x' ? s.side + j : i;
        if (gx < 0 || gz < 0 || gx >= this.grid || gz >= this.grid) continue;
        const k = gz * this.grid + gx;
        // The widest class present wins the cell, which is what makes a narrow
        // road meeting a wide one take the wide one's junction.
        if (rank > this.cls[k]) this.cls[k] = rank;
        this.axis[k] |= bit;
      }
    }
  }

  /**
   * Every stretch of road frontage, as a line of cells to build against.
   *
   * This is what a zoned lot actually attaches to. A building does not belong
   * to a block -- blocks are what is left over between roads, and once a
   * player can draw a road anywhere there is no grid of them to iterate. It
   * belongs to a frontage: a run of road, one side of it, and the cells
   * immediately behind the kerb.
   *
   * `yaw` is the quarter turn that points a prototype's front (its +Z) at the
   * road, so the caller does not have to work out which way is out.
   */
  frontages(): Frontage[] {
    const out: Frontage[] = [];
    for (const s of this.segments) {
      const spec = ROAD_CLASSES[s.cls];
      for (const near of [true, false]) {
        // The cell just outside the band, and the direction that walks away
        // from the road into the land behind it.
        const kerb = near ? s.side - 1 : s.side + spec.width;
        const step: -1 | 1 = near ? -1 : 1;
        out.push({
          axis: s.axis,
          kerb,
          step,
          from: s.from,
          to: s.to,
          // A prototype fronts +Z. On a road running east-west the land to the
          // north is behind a building that faces south, and so on round.
          yaw: s.axis === 'x' ? (near ? 0 : 2) : (near ? 3 : 1),
        });
      }
    }
    return out;
  }

  /**
   * Turns the marked cells into a list of assets to place.
   *
   * Junctions first, because a straight run is whatever is left of a segment
   * once the junctions along it have been taken out, and the tiling of that
   * run depends on where it starts and ends.
   */
  build(): Placement[] {
    const out: Placement[] = [];
    this.nextRun = 0;
    const junction = this.junctions(out);
    for (const s of this.segments) this.runs(s, junction, out);
    return out;
  }

  /**
   * Finds every crossing and places the piece for it.
   *
   * A crossing is a rectangle of cells claimed by a road running each way. It
   * is found by flood fill rather than by comparing segments pairwise, which
   * is both simpler and right for three roads meeting at the same place.
   *
   * Returns a mask of the cells junctions took, so the run tiler can skip them.
   */
  private junctions(out: Placement[]): Uint8Array {
    const g = this.grid;
    const taken = new Uint8Array(g * g);
    const seen = new Uint8Array(g * g);
    const stack: number[] = [];

    for (let start = 0; start < this.axis.length; start++) {
      if (this.axis[start] !== (ALONG_X | ALONG_Z) || seen[start]) continue;
      let x0 = start % g, x1 = x0, z0 = (start / g) | 0, z1 = z0;
      let rank = this.cls[start];
      stack.length = 0;
      stack.push(start);
      seen[start] = 1;
      while (stack.length > 0) {
        const k = stack.pop() as number;
        const x = k % g, z = (k / g) | 0;
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (z < z0) z0 = z; if (z > z1) z1 = z;
        if (this.cls[k] > rank) rank = this.cls[k];
        for (const n of [k - 1, k + 1, k - g, k + g]) {
          if (n < 0 || n >= this.axis.length) continue;
          // Row wrap: cell 0 of one row is not next to the last of the row
          // before it, however adjacent the indices are.
          if ((n === k - 1 && x === 0) || (n === k + 1 && x === g - 1)) continue;
          if (seen[n] || this.axis[n] !== (ALONG_X | ALONG_Z)) continue;
          seen[n] = 1;
          stack.push(n);
        }
      }

      const cls = ORDER[Math.max(0, rank - 1)];
      const spec = ROAD_CLASSES[cls];
      // Which way the arms leave, tested one cell beyond each face.
      const mid = { x: (x0 + x1) >> 1, z: (z0 + z1) >> 1 };
      const arms = [
        this.has(x1 + 1, mid.z),   // +x
        this.has(mid.x, z1 + 1),   // +z
        this.has(x0 - 1, mid.z),   // -x
        this.has(mid.x, z0 - 1),   // -z
      ];
      const count = arms.filter(Boolean).length;
      // Centred on the crossing, at the class's own size: a three-cell road
      // crossing a four-cell one gets the four-cell junction, overhanging the
      // narrow road by half a cell on each side, which is what a real junction
      // does -- it is wider than the side road that feeds it.
      const w = spec.width, d = spec.width;
      // Rounded to whole cells. A junction on a half cell reads fine and
      // bookkeeps terribly: everything downstream -- the grading pad, the
      // reservation, the run tiler's idea of which cells are spoken for --
      // works in cells, and a piece that half covers one is a piece that
      // half covers all of them.
      const gx = Math.round((x0 + x1 + 1) / 2 - w / 2);
      const gz = Math.round((z0 + z1 + 1) / 2 - d / 2);

      let id = spec.cross;
      let yaw = 0;
      if (count === 3) {
        id = spec.tee;
        // The tee is drawn with its side arm on local +X, so the yaw is the
        // one that puts the missing arm where there is no road.
        const gap = arms.indexOf(false);
        yaw = [0, 1, 2, 3][gap];
      } else if (count <= 2) {
        id = spec.corner;
      }
      out.push({ id, gx, gz, w, d, yaw, stretch: 1, run: -1 });

      // Marked over what the piece actually covers, not over the crossing that
      // produced it: a four-cell junction on a three-cell crossing takes a
      // cell of the run beside it, and the run has to know.
      for (let z = gz; z < gz + d; z++) {
        for (let x = gx; x < gx + w; x++) {
          if (x < 0 || z < 0 || x >= g || z >= g) continue;
          taken[z * g + x] = 1;
        }
      }
    }
    return taken;
  }

  /**
   * Tiles the parts of a segment no junction took.
   *
   * A run of any length is covered exactly: however many tiles come closest,
   * each stretched by the difference. A four-cell tile covering a five-cell
   * run is stretched by a quarter, which on an extrusion is a longer extrusion
   * and on the markings is a slightly longer dash. The alternative -- laying
   * whole tiles and leaving the remainder bare -- is the row of slabs with
   * grass between them that this replaced.
   */
  private runs(s: Segment, taken: Uint8Array, out: Placement[]): void {
    const spec = ROAD_CLASSES[s.cls];
    const g = this.grid;
    const probe = (i: number): boolean => {
      const gx = s.axis === 'x' ? i : s.side + (spec.width >> 1);
      const gz = s.axis === 'x' ? s.side + (spec.width >> 1) : i;
      if (gx < 0 || gz < 0 || gx >= g || gz >= g) return true;
      // Demolished ground counts as taken, so a run stops at the edge of it
      // rather than being tiled straight through a building.
      return taken[gz * g + gx] === 1 || this.cls[gz * g + gx] === 0;
    };

    let i = s.from;
    while (i <= s.to) {
      if (probe(i)) { i++; continue; }
      let j = i;
      while (j + 1 <= s.to && !probe(j + 1)) j++;
      this.lay(s, i, j, out, this.nextRun++);
      i = j + 1;
    }
  }

  private lay(s: Segment, from: number, to: number, out: Placement[], run: number): void {
    const spec = ROAD_CLASSES[s.cls];
    const len = to - from + 1;
    const n = Math.max(1, Math.round(len / spec.tile));
    const each = len / n;
    for (let k = 0; k < n; k++) {
      const a = from + k * each;
      // One kind of street for the whole run, chosen from the run rather than
      // from the tile: a street that changes character every thirty metres is
      // not a street. Mixed by a real hash, because `side * 7 + from * 13` on
      // a regular grid lands on the same bucket almost every time -- which is
      // how a city of seven street types came out as one street type.
      const id = spec.straights[hash3(s.side, s.from, run) % spec.straights.length];
      // A straight is drawn running along its own Z, so an east-west run is
      // the same tile given a quarter turn.
      out.push({
        id,
        gx: s.axis === 'x' ? a : s.side,
        gz: s.axis === 'x' ? s.side : a,
        w: s.axis === 'x' ? each : spec.width,
        d: s.axis === 'x' ? spec.width : each,
        yaw: s.axis === 'x' ? 1 : 0,
        stretch: each / spec.tile,
        run,
      });
    }
  }
}
