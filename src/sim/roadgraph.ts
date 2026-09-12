/**
 * Roads as a graph of curves.
 *
 * The network this replaces was axis-aligned bands on a cell grid, and the
 * grid was the graph: two roads that shared a cell were, by definition, a
 * junction, and nothing had to detect an intersection. That is a genuinely
 * good design and it buys exactly one thing at the cost of everything else --
 * roads that run north-south or east-west and turn in right angles.
 *
 * A city builder is judged on the road tool. Being unable to draw a curve is
 * not a limitation a player forgives, so the grid is gone and this is a real
 * planar graph: nodes at junctions, links carrying a quadratic Bezier between
 * them. What that costs is that every one of the four behaviours the cell grid
 * got for free has to be written down:
 *
 *   - crossing an existing road builds a junction, because the new link is
 *     intersected against every link near it and both are split at the crossing
 *   - ending on an existing road joins it, because an endpoint that lands near
 *     a link splits that link rather than dangling beside it
 *   - two roads meet flush, because the junction is built from the arms that
 *     actually arrive at the node and their real widths
 *   - a road drawn from an existing junction leaves along the tangent of what
 *     is already there, which is what makes a curve look drawn rather than
 *     computed
 *
 * Geometry is world metres throughout. The cell grid still exists -- zoning is
 * painted on it and the spawner reserves ground on it -- so the corridor is
 * rasterised into it after every edit, which is what keeps buildings out of
 * the road without anything downstream having to know what a Bezier is.
 */

import { simConfig } from './config';

/** Metres per zoning cell. The grid zoning and reservation still work on. */
const CELL = 8;

export type RoadClass =
  | 'lane' | 'street' | 'oneway' | 'avenue' | 'bus' | 'dual' | 'tram' | 'motorway';

export interface RoadSpec {
  label: string;
  /** Half the carriageway, in metres: kerb face to kerb face is twice this. */
  half: number;
  /** Half the whole corridor, including verge or footway. */
  edge: number;
  /** Running lanes in each direction. */
  lanes: number;
  /** Half-width of the central reservation, or 0 for a painted centre line. */
  median: number;
  /** One-way: no centre line, and the lane markings do not mirror. */
  oneWay: boolean;
  /** Tram tracks down the middle of the carriageway. */
  tram: boolean;
  /** Lit, and how far apart the columns stand. Zero for unlit. */
  lamp: number;
  /** Kerbed, with a footway outside it. A country lane has neither. */
  kerbed: boolean;
}

/**
 * What a player can draw.
 *
 * Widths are real: a residential street is a seven-metre carriageway between
 * two-metre footways, a dual carriageway is two seven-metre halves about a
 * two-metre reservation. Getting these right is most of what makes a city read
 * at street level, and all of what makes the buildings sit at the correct
 * distance from each other.
 */
export const ROAD_SPECS: Record<RoadClass, RoadSpec> = {
  lane: {
    label: 'Country lane', half: 2.6, edge: 5.4, lanes: 1, median: 0,
    oneWay: false, tram: false, lamp: 0, kerbed: false,
  },
  street: {
    label: 'Street', half: 3.6, edge: 7.4, lanes: 1, median: 0,
    oneWay: false, tram: false, lamp: 34, kerbed: true,
  },
  oneway: {
    label: 'One-way', half: 3.4, edge: 7.2, lanes: 2, median: 0,
    oneWay: true, tram: false, lamp: 34, kerbed: true,
  },
  bus: {
    label: 'Bus route', half: 5.2, edge: 9.6, lanes: 2, median: 0,
    oneWay: false, tram: false, lamp: 32, kerbed: true,
  },
  avenue: {
    label: 'Avenue', half: 7.0, edge: 11.6, lanes: 2, median: 0,
    oneWay: false, tram: false, lamp: 30, kerbed: true,
  },
  tram: {
    label: 'Tram boulevard', half: 8.4, edge: 13.6, lanes: 2, median: 0,
    oneWay: false, tram: true, lamp: 30, kerbed: true,
  },
  dual: {
    label: 'Dual carriageway', half: 9.2, edge: 14.4, lanes: 2, median: 1.6,
    oneWay: false, tram: false, lamp: 30, kerbed: true,
  },
  motorway: {
    label: 'Motorway', half: 12.6, edge: 18.0, lanes: 3, median: 2.2,
    oneWay: false, tram: false, lamp: 42, kerbed: false,
  },
};

export const ROAD_ORDER: RoadClass[] =
  ['lane', 'street', 'oneway', 'bus', 'avenue', 'tram', 'dual', 'motorway'];

export interface RoadNode {
  x: number;
  z: number;
  /** Link indices that end here. Rebuilt whenever the graph changes. */
  arms: number[];
}

export interface RoadLink {
  /**
   * A name that outlives the array.
   *
   * Links are held in an array and bulldozing compacts it, so an index is not
   * an identity: remove one road and every road after it in the list answers to
   * a different number. Anything that remembers a link between rebuilds -- the
   * spawner, which attributes each building to the frontage that placed it --
   * has to hold this instead, or a bulldoze somewhere makes it think a
   * completely different street has changed.
   */
  id: number;
  a: number;
  b: number;
  /** The quadratic's control point. On the chord's midpoint, a link is straight. */
  cx: number;
  cz: number;
  cls: RoadClass;
}

/** Never reused, so a link's name is unique for the life of the page. */
let nextLinkId = 1;

/** A point on a link, with the direction the road runs there. */
export interface Along {
  x: number;
  z: number;
  /** Unit tangent. */
  tx: number;
  tz: number;
  /** Distance from the start of the link. */
  s: number;
}

/** Somewhere a building can stand: on the corridor edge, facing the road. */
export interface Site {
  x: number;
  z: number;
  /** Yaw in radians that points a prototype's +Z front at the carriageway. */
  yaw: number;
  /** Which link and side, so a spawner can keep a frontage consistent. */
  link: number;
  side: -1 | 1;
  /** Distance along the link, for anything that wants to walk a frontage. */
  s: number;
  cls: RoadClass;
}

/** Two endpoints closer than this are the same junction. */
const SNAP = 11;
/** A node this close to a link is on it, and splits it. */
const TOUCH = 9;
/** Curve sampling: never coarser than this along the arc. */
const STEP = 2.4;

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export class RoadGraph {
  readonly nodes: RoadNode[] = [];
  readonly links: RoadLink[] = [];

  /**
   * Which class of road covers each cell, or 0. The corridor rasterised.
   *
   * Zoning, the spawner's ground reservation and the grass mask all work on
   * cells and none of them wants to know about curves, so the graph paints
   * itself into this after every edit and they read it exactly as they read
   * the old network's.
   */
  readonly cls: Uint8Array;

  /** Bumped on every edit, so caches downstream know to rebuild. */
  version = 0;
  /** Links already drawn into the raster, and whether it must go from scratch. */
  private rastered = 0;
  private wiped = true;

  private dirty = true;

  /**
   * Sampled polylines and bounds, per link.
   *
   * Not an optimisation so much as the difference between working and not.
   * Drawing a road intersects it against everything near it, and a cut
   * restarts the search -- so a grid of fourteen hundred links resampled every
   * curve on every pass took thirty-three seconds to lay. Keyed on the link
   * object and dropped whenever that link is cut or moved.
   */
  private cache = new WeakMap<RoadLink, {
    dense?: Along[]; shape?: Along[]; box?: [number, number, number, number];
  }>();

  constructor(readonly grid: number = simConfig.cityGrid) {
    this.cls = new Uint8Array(grid * grid);
  }

  private slot(link: RoadLink): {
    dense?: Along[]; shape?: Along[]; box?: [number, number, number, number];
  } {
    let c = this.cache.get(link);
    if (c === undefined) { c = {}; this.cache.set(link, c); }
    return c;
  }

  private forget(link: RoadLink): void {
    this.cache.delete(link);
  }

  /** The link's bounding box, grown by its corridor. */
  private box(link: RoadLink): [number, number, number, number] {
    const c = this.slot(link);
    if (c.box === undefined) {
      const a = this.nodes[link.a], b = this.nodes[link.b];
      const r = ROAD_SPECS[link.cls].edge + 2;
      // A quadratic never leaves the hull of its three points.
      c.box = [
        Math.min(a.x, b.x, link.cx) - r, Math.min(a.z, b.z, link.cz) - r,
        Math.max(a.x, b.x, link.cx) + r, Math.max(a.z, b.z, link.cz) + r,
      ];
    }
    return c.box;
  }

  // ---- reading -----------------------------------------------------------

  has(gx: number, gz: number): boolean {
    if (gx < 0 || gz < 0 || gx >= this.grid || gz >= this.grid) return false;
    return this.cls[gz * this.grid + gx] !== 0;
  }

  /** World coordinates of a cell's centre. */
  private world(gx: number, gz: number): [number, number] {
    const half = this.grid / 2;
    return [(gx - half + 0.5) * CELL, (gz - half + 0.5) * CELL];
  }

  point(link: RoadLink, t: number): [number, number] {
    const a = this.nodes[link.a], b = this.nodes[link.b];
    const u = 1 - t;
    return [
      u * u * a.x + 2 * u * t * link.cx + t * t * b.x,
      u * u * a.z + 2 * u * t * link.cz + t * t * b.z,
    ];
  }

  tangent(link: RoadLink, t: number): [number, number] {
    const a = this.nodes[link.a], b = this.nodes[link.b];
    let dx = 2 * ((1 - t) * (link.cx - a.x) + t * (b.x - link.cx));
    let dz = 2 * ((1 - t) * (link.cz - a.z) + t * (b.z - link.cz));
    const n = Math.hypot(dx, dz) || 1;
    dx /= n; dz /= n;
    return [dx, dz];
  }

  /**
   * The link sampled into a polyline.
   *
   * Spacing is by arc length rather than by parameter: a quadratic's parameter
   * runs fast where the curve is straight and slow where it bends, and
   * sampling on it evenly puts the vertices in the wrong places -- sparse
   * through the corner, which is the only part that needed them.
   */
  samples(link: RoadLink): Along[] {
    const cached = this.slot(link);
    if (cached.dense !== undefined) return cached.dense;
    // A cheap arc length from a fine parameter walk, then resampled evenly.
    const fine = 64;
    const px: number[] = [], pz: number[] = [], len: number[] = [0];
    for (let i = 0; i <= fine; i++) {
      const [x, z] = this.point(link, i / fine);
      px.push(x); pz.push(z);
      if (i > 0) len.push(len[i - 1] + Math.hypot(x - px[i - 1], z - pz[i - 1]));
    }
    const total = len[fine];
    const n = Math.max(2, Math.min(220, Math.round(total / STEP)));
    const out: Along[] = [];
    let cursor = 0;
    for (let i = 0; i <= n; i++) {
      const want = (i / n) * total;
      while (cursor < fine && len[cursor + 1] < want) cursor++;
      const span = len[cursor + 1] - len[cursor] || 1;
      const f = (want - len[cursor]) / span;
      const t = (cursor + f) / fine;
      const [tx, tz] = this.tangent(link, t);
      out.push({ x: lerp(px[cursor], px[cursor + 1], f), z: lerp(pz[cursor], pz[cursor + 1], f), tx, tz, s: want });
    }
    cached.dense = out;
    return out;
  }

  length(link: RoadLink): number {
    const s = this.samples(link);
    return s[s.length - 1].s;
  }

  /** How far the control point sits off the chord: zero on a straight. */
  bend(link: RoadLink): number {
    const a = this.nodes[link.a], b = this.nodes[link.b];
    return Math.hypot(link.cx - (a.x + b.x) / 2, link.cz - (a.z + b.z) / 2);
  }

  /**
   * The link sampled for its shape rather than for its length.
   *
   * The ribbon only needs a cross-section where the road turns. A straight one
   * needs two, whatever it is long, because the terrain under it is graded
   * flat to it -- the road does not follow the land, the land is cut to the
   * road, which is what a road is.
   *
   * This matters more than it sounds. The default city is two hundred
   * kilometres of road; at an even six-metre spacing that is thirty-five
   * thousand cross-sections and fourteen megabytes of vertices for a grid in
   * which every single link is straight.
   */
  shape(link: RoadLink): Along[] {
    const cached = this.slot(link);
    if (cached.shape !== undefined) return cached.shape;
    const out = this.buildShape(link);
    cached.shape = out;
    return out;
  }

  private buildShape(link: RoadLink): Along[] {
    const off = this.bend(link);
    if (off < 0.4) {
      const a = this.nodes[link.a], b = this.nodes[link.b];
      const dx = b.x - a.x, dz = b.z - a.z;
      const len = Math.hypot(dx, dz) || 1;
      const tx = dx / len, tz = dz / len;
      return [
        { x: a.x, z: a.z, tx, tz, s: 0 },
        { x: b.x, z: b.z, tx, tz, s: len },
      ];
    }
    const pts = this.samples(link);
    const total = pts[pts.length - 1].s;
    const n = Math.max(2, Math.min(64, Math.round(off / 1.1) + Math.round(total / 26)));
    const out: Along[] = [];
    for (let i = 0; i <= n; i++) out.push(walk(pts, (i / n) * total));
    return out;
  }

  // ---- editing -----------------------------------------------------------

  private addNode(x: number, z: number): number {
    this.nodes.push({ x, z, arms: [] });
    return this.nodes.length - 1;
  }

  /** The node at this point, making or splitting one where there is none. */
  private nodeAt(x: number, z: number): number {
    let best = -1, bestD = SNAP;
    for (let i = 0; i < this.nodes.length; i++) {
      const d = Math.hypot(this.nodes[i].x - x, this.nodes[i].z - z);
      if (d < bestD) { bestD = d; best = i; }
    }
    if (best >= 0) return best;

    // Not near a node, but perhaps on a link: ending a road on another road
    // joins it, and joining it means splitting it so there is a node to join.
    let hit = -1, hitT = 0, hitD = TOUCH;
    for (let i = 0; i < this.links.length; i++) {
      const b = this.box(this.links[i]);
      if (x < b[0] - TOUCH || x > b[2] + TOUCH || z < b[1] - TOUCH || z > b[3] + TOUCH) continue;
      const pts = this.shape(this.links[i]);
      for (let k = 0; k + 1 < pts.length; k++) {
        const dx = pts[k + 1].x - pts[k].x, dz = pts[k + 1].z - pts[k].z;
        const len2 = dx * dx + dz * dz || 1;
        const f = Math.min(1, Math.max(0, ((x - pts[k].x) * dx + (z - pts[k].z) * dz) / len2));
        const d = Math.hypot(pts[k].x + dx * f - x, pts[k].z + dz * f - z);
        if (d < hitD) { hitD = d; hit = i; hitT = (k + f) / (pts.length - 1); }
      }
    }
    if (hit >= 0 && hitT > 0.04 && hitT < 0.96) return this.splitLink(hit, hitT);
    return this.addNode(x, z);
  }

  /**
   * Cuts a link in two at `t`, keeping the shape.
   *
   * De Casteljau: the control points of the two halves are the intermediate
   * points of the evaluation, so the pair of curves is exactly the original
   * one. Splitting by re-fitting instead would move the road every time
   * something crossed it.
   */
  private splitLink(index: number, t: number): number {
    const link = this.links[index];
    const a = this.nodes[link.a], b = this.nodes[link.b];
    const m0x = lerp(a.x, link.cx, t), m0z = lerp(a.z, link.cz, t);
    const m1x = lerp(link.cx, b.x, t), m1z = lerp(link.cz, b.z, t);
    const mx = lerp(m0x, m1x, t), mz = lerp(m0z, m1z, t);

    const mid = this.addNode(mx, mz);
    const tail: RoadLink = { id: nextLinkId++, a: mid, b: link.b, cx: m1x, cz: m1z, cls: link.cls };
    link.b = mid;
    link.cx = m0x; link.cz = m0z;
    this.forget(link);
    this.links.push(tail);
    this.dirty = true;
    return mid;
  }

  /**
   * Draws a road from one point to another, in world metres.
   *
   * `bend` pulls the curve sideways off the chord, in metres, positive to the
   * left of the direction of travel. Zero is a straight. When the start is an
   * existing junction with one arm, the curve instead leaves along that arm's
   * tangent, which is what makes a road drawn onto the end of another read as
   * the same road continuing.
   */
  add(ax: number, az: number, bx: number, bz: number, cls: RoadClass, bend = 0,
    through: [number, number] | null = null): void {
    if (Math.hypot(bx - ax, bz - az) < SNAP) return;
    const a = this.nodeAt(ax, az);
    const b = this.nodeAt(bx, bz);
    if (a === b) return;

    const na = this.nodes[a], nb = this.nodes[b];
    const [cx, cz] = this.control(na.x, na.z, nb.x, nb.z, bend, through, a, b);

    const link: RoadLink = { id: nextLinkId++, a, b, cx, cz, cls };
    this.links.push(link);
    this.crossAll(this.links.length - 1);
    this.dirty = true;
  }

  /**
   * The control point of a link between two resolved endpoints.
   *
   * Three ways a road gets its shape, in the order they win: the player named
   * a point it must pass through, the player bowed a drag, or -- neither --
   * the road leaves an existing dead end along the way that end already
   * points, so a chain of segments flows instead of kinking at every join.
   *
   * `a` and `b` are node indices, or -1 for an end that is not on the graph
   * yet. Split out of `add` so a preview can ask the same question without
   * changing anything.
   */
  private control(ax: number, az: number, bx: number, bz: number,
    bend: number, through: [number, number] | null,
    a: number, b: number): [number, number] {
    if (through !== null) {
      // The player named a point the road should pass through, not a Bezier
      // control point -- nobody thinks in control points. A quadratic is at
      // (A + 2C + B) / 4 halfway along, so the control that puts the curve on
      // their point is twice it minus the average of the ends.
      return [2 * through[0] - (ax + bx) / 2, 2 * through[1] - (az + bz) / 2];
    }
    let cx = (ax + bx) / 2, cz = (az + bz) / 2;
    const dx = bx - ax, dz = bz - az;
    if (bend !== 0) {
      const n = Math.hypot(dx, dz) || 1;
      return [cx + (-dz / n) * bend, cz + (dx / n) * bend];
    }
    if (a >= 0) {
      const tan = this.armTangent(a, b);
      if (tan !== null) {
        // The control point on the tangent line, at the distance that makes
        // the curve leave along it and still reach the far end.
        const along = dx * tan[0] + dz * tan[1];
        if (along > 0) { cx = ax + tan[0] * along * 0.5; cz = az + tan[1] * along * 0.5; }
      }
    }
    return [cx, cz];
  }

  /**
   * The point a proposed road would actually pass through halfway along.
   *
   * The preview builds its own one-link graph, which has no arms to take a
   * tangent from, so handing it this as a pass-through point is what makes a
   * previewed road the road the player gets. Without it every chained segment
   * previewed straight and then committed as a curve.
   */
  midpointOf(ax: number, az: number, bx: number, bz: number,
    bend = 0, through: [number, number] | null = null): [number, number] {
    const [sax, saz] = this.snapPoint(ax, az);
    const [sbx, sbz] = this.snapPoint(bx, bz);
    const [cx, cz] = this.control(sax, saz, sbx, sbz, bend, through,
      this.nodeNear(sax, saz), this.nodeNear(sbx, sbz));
    return [(sax + 2 * cx + sbx) / 4, (saz + 2 * cz + sbz) / 4];
  }

  /** The node an exact point is, or -1 if it is not one. */
  private nodeNear(x: number, z: number): number {
    for (let i = 0; i < this.nodes.length; i++) {
      if (Math.abs(this.nodes[i].x - x) < 1e-6 && Math.abs(this.nodes[i].z - z) < 1e-6) return i;
    }
    return -1;
  }

  /**
   * Where an endpoint would land, without changing anything.
   *
   * The preview has to snap the same way the real thing does, or the road the
   * player sees while dragging is not the road they get. This answers the
   * question `nodeAt` answers, minus the part where it splits a link to do it.
   */
  snapPoint(x: number, z: number): [number, number] {
    let best = -1, bestD = SNAP;
    for (let i = 0; i < this.nodes.length; i++) {
      const d = Math.hypot(this.nodes[i].x - x, this.nodes[i].z - z);
      if (d < bestD) { bestD = d; best = i; }
    }
    if (best >= 0) return [this.nodes[best].x, this.nodes[best].z];

    let hit: [number, number] | null = null, hitD = TOUCH;
    for (const link of this.links) {
      const b = this.box(link);
      if (x < b[0] - TOUCH || x > b[2] + TOUCH || z < b[1] - TOUCH || z > b[3] + TOUCH) continue;
      const pts = this.shape(link);
      for (let k = 0; k + 1 < pts.length; k++) {
        const dx = pts[k + 1].x - pts[k].x, dz = pts[k + 1].z - pts[k].z;
        const len2 = dx * dx + dz * dz || 1;
        const f = Math.min(1, Math.max(0, ((x - pts[k].x) * dx + (z - pts[k].z) * dz) / len2));
        const px = pts[k].x + dx * f, pz = pts[k].z + dz * f;
        const d = Math.hypot(px - x, pz - z);
        if (d < hitD) { hitD = d; hit = [px, pz]; }
      }
    }
    return hit ?? [x, z];
  }

  /**
   * Puts a node back exactly where it was, for loading a save.
   *
   * Not `nodeAt`: that snaps to whatever is nearby and splits links to make a
   * junction, which is right when a player draws a road and wrong when
   * restoring a graph where all of that already happened. Loading is not
   * drawing -- it is putting back what drawing produced.
   */
  restoreNode(x: number, z: number): number {
    return this.addNode(x, z);
  }

  /** The same for a link: its ends and its control point, taken as given. */
  restoreLink(a: number, b: number, cx: number, cz: number, cls: RoadClass): void {
    if (a === b) return;
    this.links.push({ id: nextLinkId++, a, b, cx, cz, cls });
    this.dirty = true;
  }

  /** The same, from cell coordinates, for callers that think in the grid. */
  addCells(ax: number, az: number, bx: number, bz: number, cls: RoadClass, bend = 0): void {
    const h = this.grid / 2;
    this.add((ax - h + 0.5) * CELL, (az - h + 0.5) * CELL,
      (bx - h + 0.5) * CELL, (bz - h + 0.5) * CELL, cls, bend);
  }

  /** The way an existing single-armed junction points, for a smooth join. */
  private armTangent(node: number, away: number): [number, number] | null {
    const arms = this.armsOf(node);
    if (arms.length !== 1) return null;
    const link = this.links[arms[0]];
    if (link.a === away || link.b === away) return null;
    const t = link.a === node ? 0 : 1;
    const [tx, tz] = this.tangent(link, t);
    // Outgoing, so the new road continues rather than doubling back.
    return link.a === node ? [-tx, -tz] : [tx, tz];
  }

  private armsOf(node: number): number[] {
    const out: number[] = [];
    for (let i = 0; i < this.links.length; i++) {
      if (this.links[i].a === node || this.links[i].b === node) out.push(i);
    }
    return out;
  }

  /**
   * Splits `index` and everything it crosses, so a crossing becomes a junction.
   *
   * Both curves are walked as polylines and tested segment against segment.
   * Splitting changes indices and inserts links, so this restarts after every
   * cut rather than trying to keep a stale list of crossings correct -- a road
   * crosses a handful of others, and a rewrite that is obviously right beats
   * one that is fast and subtly not.
   */
  private crossAll(index: number): void {
    for (let guard = 0; guard < 64; guard++) {
      const cut = this.firstCrossing(index);
      if (cut === null) return;
      const other = this.splitLink(cut.other, cut.otherT);
      // The split may have renumbered nothing, but `index` itself is the link
      // being drawn and is never the one split above.
      const mine = this.splitLink(index, cut.selfT);
      this.mergeNodes(mine, other);
    }
  }

  private firstCrossing(index: number):
  { other: number; selfT: number; otherT: number } | null {
    const self = this.links[index];
    // The shape polyline, not the dense one: it is exact for a straight, which
    // every link in a drawn grid is, and close enough on a curve that the
    // junction lands within a few centimetres of the true crossing.
    const mine = this.shape(self);
    const mineBox = this.box(self);
    for (let j = 0; j < this.links.length; j++) {
      if (j === index) continue;
      const link = this.links[j];
      // Links that already share a node meet there; that is not a crossing.
      if (link.a === self.a || link.a === self.b || link.b === self.a || link.b === self.b) continue;
      const b = this.box(link);
      if (b[0] > mineBox[2] || b[2] < mineBox[0] || b[1] > mineBox[3] || b[3] < mineBox[1]) continue;
      const theirs = this.shape(link);
      for (let i = 0; i + 1 < mine.length; i++) {
        for (let k = 0; k + 1 < theirs.length; k++) {
          const hit = segHit(mine[i], mine[i + 1], theirs[k], theirs[k + 1]);
          if (hit === null) continue;
          const selfT = (i + hit[0]) / (mine.length - 1);
          const otherT = (k + hit[1]) / (theirs.length - 1);
          if (selfT < 0.02 || selfT > 0.98 || otherT < 0.02 || otherT > 0.98) continue;
          return { other: j, selfT, otherT };
        }
      }
    }
    return null;
  }

  /** Folds `b` into `a`, so a crossing is one junction rather than two. */
  private mergeNodes(a: number, b: number): void {
    if (a === b) return;
    const na = this.nodes[a], nb = this.nodes[b];
    na.x = (na.x + nb.x) / 2;
    na.z = (na.z + nb.z) / 2;
    for (const link of this.links) {
      if (link.a === b) { link.a = a; this.forget(link); }
      if (link.b === b) { link.b = a; this.forget(link); }
    }
    // Both endpoints moved, so every link that ends at either has a new shape.
    for (const link of this.links) {
      if (link.a === a || link.b === a) this.forget(link);
    }
    // The node is left in place rather than spliced out: every link holds an
    // index, and compacting the array would invalidate all of them.
    nb.arms = [];
  }

  /** Removes every link that enters a rectangle of cells. */
  clear(gx: number, gz: number, w: number, d: number): void {
    const half = this.grid / 2;
    const x0 = (gx - half) * CELL, z0 = (gz - half) * CELL;
    const x1 = x0 + w * CELL, z1 = z0 + d * CELL;
    const keep: RoadLink[] = [];
    for (const link of this.links) {
      let inside = false;
      for (const p of this.samples(link)) {
        if (p.x >= x0 && p.x <= x1 && p.z >= z0 && p.z <= z1) { inside = true; break; }
      }
      if (!inside) keep.push(link);
    }
    if (keep.length === this.links.length) return;
    this.links.length = 0;
    this.links.push(...keep);
    this.dirty = true;
    // Roads went away, so cells that were corridor are not any more and the
    // raster cannot be added to -- it has to be drawn again from nothing.
    this.wiped = true;
  }

  /** Cell coordinates, from world metres. */
  cellAt(x: number, z: number): [number, number] {
    const half = this.grid / 2;
    return [Math.floor(x / CELL + half), Math.floor(z / CELL + half)];
  }

  // ---- what the rest of the simulation reads -----------------------------

  /**
   * Paints the corridor into the cell grid.
   *
   * Conservative: a cell whose centre is within the corridor half-width of the
   * curve is road. Buildings are kept off those cells, which is the whole
   * point, and being a little generous at the edge is right -- a building
   * whose corner overhangs a kerb looks worse than one set back by a cell.
   */
  rasterise(): void {
    if (!this.dirty) return;
    this.dirty = false;
    this.version++;
    // Only the roads that are new.
    //
    // The raster is additive -- every cell a corridor covers is set to one, and
    // nothing ever unsets it -- so drawing a road again produces the cells it
    // produced before. Links are only ever appended, and splitting one mutates
    // it in place into two halves covering the same ground, so unless something
    // was bulldozed the cells already there are still right and only the new
    // links need drawing. Bulldozing sets `wiped`, and then it all goes again.
    const from = this.wiped ? 0 : this.rastered;
    if (this.wiped) this.cls.fill(0);
    this.wiped = false;
    this.rastered = this.links.length;
    const g = this.grid, half = g / 2;
    for (let li = from; li < this.links.length; li++) {
      const link = this.links[li];
      const spec = ROAD_SPECS[link.cls];
      // Exactly the corridor, not a cell more. The spawner puts a building's
      // front face on this same line and tests the cells its plot covers by
      // their centres, so the two have to agree to the metre: a raster half a
      // cell wider than the corridor rejected every frontage plot in the city
      // and the map came out with no buildings on any street at all.
      const reach = spec.edge;
      for (const p of this.samples(link)) {
        const gx0 = Math.max(0, Math.floor((p.x - reach) / CELL + half));
        const gx1 = Math.min(g - 1, Math.floor((p.x + reach) / CELL + half));
        const gz0 = Math.max(0, Math.floor((p.z - reach) / CELL + half));
        const gz1 = Math.min(g - 1, Math.floor((p.z + reach) / CELL + half));
        for (let gz = gz0; gz <= gz1; gz++) {
          for (let gx = gx0; gx <= gx1; gx++) {
            const [wx, wz] = this.world(gx, gz);
            if (Math.hypot(wx - p.x, wz - p.z) <= reach) this.cls[gz * g + gx] = 1;
          }
        }
      }
    }
    // Junctions are wider than either arm, so they get their own disc. Always
    // redrawn: a junction grows when an arm arrives, there are a thousand of
    // them at most, and each is a few dozen cells.
    for (let i = 0; i < this.nodes.length; i++) {
      const arms = this.armsOf(i);
      if (arms.length === 0) continue;
      const r = this.junctionRadius(i);
      const n = this.nodes[i];
      const gx0 = Math.max(0, Math.floor((n.x - r) / CELL + half));
      const gx1 = Math.min(g - 1, Math.floor((n.x + r) / CELL + half));
      const gz0 = Math.max(0, Math.floor((n.z - r) / CELL + half));
      const gz1 = Math.min(g - 1, Math.floor((n.z + r) / CELL + half));
      for (let gz = gz0; gz <= gz1; gz++) {
        for (let gx = gx0; gx <= gx1; gx++) {
          const [wx, wz] = this.world(gx, gz);
          if (Math.hypot(wx - n.x, wz - n.z) <= r) this.cls[gz * g + gx] = 1;
        }
      }
    }
  }

  /** How far back from a node its arms stop, so the junction can cover it. */
  junctionRadius(node: number): number {
    const arms = this.armsOf(node);
    if (arms.length === 0) return 0;
    let widest = 0;
    for (const i of arms) widest = Math.max(widest, ROAD_SPECS[this.links[i].cls].edge);
    // A junction of two arms is a bend, not a crossing, and needs no more room
    // than the road itself.
    return arms.length <= 2 ? widest * 0.35 : widest * 1.15;
  }

  /**
   * Where a building may stand, walking every frontage.
   *
   * `step` is how far apart the sites are along the road. The spawner asks for
   * one at the width of the plot it wants to build, so this is a generator
   * over positions rather than a fixed list of plots: which plot goes where is
   * the spawner's decision, and it needs to be free to take two steps for a
   * wide building.
   */
  /**
   * Every side of every link, as a stretch a spawner can walk along.
   *
   * A frontage is the unit a street is built from: the buildings along one
   * side of one road between two junctions. Handing back the range rather than
   * a list of plots is deliberate -- how wide each plot is depends on what the
   * spawner decides to build there, and it needs to be free to take six metres
   * for a terrace and thirty for a supermarket.
   */
  frontages(): Array<{ link: number; id: number; side: -1 | 1; from: number; to: number;
    cls: RoadClass }> {
    const out: Array<{ link: number; id: number; side: -1 | 1; from: number; to: number;
      cls: RoadClass }> = [];
    for (let i = 0; i < this.links.length; i++) {
      const link = this.links[i];
      const pts = this.samples(link);
      const total = pts[pts.length - 1].s;
      const from = this.junctionRadius(link.a) + 2;
      const to = total - this.junctionRadius(link.b) - 2;
      if (to - from < 6) continue;
      out.push({ link: i, id: link.id, side: -1, from, to, cls: link.cls });
      out.push({ link: i, id: link.id, side: 1, from, to, cls: link.cls });
    }
    return out;
  }

  /**
   * The box one link's curve lies inside, in world metres.
   *
   * For deciding whether a link could possibly be affected by an edit
   * somewhere. Taken from the samples rather than from the control polygon:
   * the polygon's box contains the curve but is loose enough on a hard bend to
   * pull in half the map.
   */
  linkBounds(index: number): { x0: number; z0: number; x1: number; z1: number } {
    const pts = this.samples(this.links[index]);
    let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
    for (const p of pts) {
      if (p.x < x0) x0 = p.x;
      if (p.x > x1) x1 = p.x;
      if (p.z < z0) z0 = p.z;
      if (p.z > z1) z1 = p.z;
    }
    return { x0, z0, x1, z1 };
  }

  /** One point on a frontage: on the corridor edge, facing the carriageway. */
  siteAt(link: number, side: -1 | 1, s: number): Site {
    const l = this.links[link];
    const spec = ROAD_SPECS[l.cls];
    const p = walk(this.samples(l), s);
    // The outward normal: away from the road, on this side of it.
    const nx = -p.tz * side, nz = p.tx * side;
    return {
      x: p.x + nx * spec.edge,
      z: p.z + nz * spec.edge,
      // A prototype's front is its +Z. Turned by `a`, local +Z lands on
      // (-sin a, cos a), and that has to point back at the road.
      yaw: Math.atan2(nx, -nz),
      link,
      side,
      s,
      cls: l.cls,
    };
  }

  * sites(step: number): Generator<Site> {
    for (let i = 0; i < this.links.length; i++) {
      const link = this.links[i];
      const spec = ROAD_SPECS[link.cls];
      const pts = this.samples(link);
      const total = pts[pts.length - 1].s;
      // Clear of the junctions at either end.
      const from = this.junctionRadius(link.a) + 2;
      const to = total - this.junctionRadius(link.b) - 2;
      if (to - from < step) continue;
      for (let s = from; s <= to; s += step) {
        const p = walk(pts, s);
        for (const side of [-1, 1] as const) {
          // The outward normal: to the left of travel for side -1.
          const nx = -p.tz * side, nz = p.tx * side;
          yield {
            x: p.x + nx * spec.edge,
            z: p.z + nz * spec.edge,
            // A prototype's front is its +Z. Turned by `a`, local +Z lands on
            // (-sin a, cos a), and that has to point back at the road.
            yaw: Math.atan2(nx, -nz),
            link: i,
            side,
            s,
            cls: link.cls,
          };
        }
      }
    }
  }
}

/**
 * Interpolation along a sampled polyline, by arc length.
 *
 * Binary search, not a scan. The spawner asks for a point on a frontage twice
 * for every plot it considers and there are a couple of hundred samples on a
 * link, and walking them from the start each time was most of the cost of
 * laying out a city.
 */
export function walk(pts: readonly Along[], s: number): Along {
  if (s <= 0) return pts[0];
  const last = pts[pts.length - 1];
  if (s >= last.s) return last;
  let lo = 0, hi = pts.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (pts[mid].s <= s) lo = mid; else hi = mid;
  }
  const i = lo;
  const span = pts[i + 1].s - pts[i].s || 1;
  const f = (s - pts[i].s) / span;
  return {
    x: lerp(pts[i].x, pts[i + 1].x, f),
    z: lerp(pts[i].z, pts[i + 1].z, f),
    tx: lerp(pts[i].tx, pts[i + 1].tx, f),
    tz: lerp(pts[i].tz, pts[i + 1].tz, f),
    s,
  };
}

/** Where two segments cross, as a fraction along each, or null. */
function segHit(a0: Along, a1: Along, b0: Along, b1: Along): [number, number] | null {
  const rx = a1.x - a0.x, rz = a1.z - a0.z;
  const sx = b1.x - b0.x, sz = b1.z - b0.z;
  const denom = rx * sz - rz * sx;
  if (Math.abs(denom) < 1e-9) return null;
  const qpx = b0.x - a0.x, qpz = b0.z - a0.z;
  const t = (qpx * sz - qpz * sx) / denom;
  const u = (qpx * rz - qpz * rx) / denom;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return [t, u];
}
