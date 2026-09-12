/**
 * Road geometry: the graph turned into a ribbon.
 *
 * Roads used to be prefabricated tiles -- four-cell slabs from the asset
 * library, laid end to end along a cell band and stretched a few per cent to
 * make up the length. That is the only thing a tile can do, and it is why the
 * roads could not curve: a rigid slab cannot follow an arc, and forty of them
 * end to end around a bend is a polygon, not a curve.
 *
 * So the carriageway is generated. Each link is swept: a cross-section is
 * carried along the curve and stitched into strips, and every junction is a
 * polygon built from the arms that actually arrive at it. Nothing is tiled,
 * nothing is stretched, and a road of any shape costs the vertices its shape
 * needs and no more.
 *
 * The markings are not geometry. A dashed centre line made of quads is a
 * thousand quads a kilometre and still wrong on a curve, because the dashes
 * are spaced along the chord rather than the arc. Instead every vertex carries
 * where it is on the road -- across in metres from the centreline, along in
 * metres from the start -- and the shader draws the markings from those two
 * numbers. A dash is then exactly as long around a bend as it is on a
 * straight, which is the thing that actually reads.
 */

import { ROAD_SPECS, RoadGraph, walk } from './roadgraph';
import type { RoadLink, RoadClass } from './roadgraph';
import type { Pin } from './grading';

/**
 * Floats per vertex: position, normal, road coordinate, and what the road is.
 *
 * The last five are the whole reason the markings work on a curve. `u` is
 * metres across from the centreline and `v` metres along the arc, so the
 * shader can put a lane line at a fixed offset and a dash at a fixed pitch and
 * have both come out right whatever the road is doing.
 */
export const ROAD_FLOATS = 13;

/** What a vertex is part of, so the shader knows what to draw on it. */
export const SURF = {
  ROAD: 0,
  KERB_FACE: 1,
  KERB_TOP: 2,
  FOOTWAY: 3,
  JUNCTION: 4,
  /** A crossing across one arm of a junction. */
  CROSSING: 7,
  MEDIAN: 5,
  VERGE: 6,
} as const;

/** Kerb upstand. Low enough to drive over, high enough to read as a kerb. */
const KERB = 0.15;

/**
 * How far the surface sits above the level the ground was graded to.
 *
 * The terrain is cut flat to exactly the road's level, so a carriageway laid
 * at that level is coplanar with it and loses the depth test -- which showed
 * up as a city with kerbs and footways floating in the grass and no road
 * between them, because the only parts standing proud were the ones a kerb's
 * height above.
 */
const LIFT = 0.08;

export interface RoadMesh {
  /** Explicitly ArrayBuffer-backed: WebGPU's queue will not take a shared one. */
  vertices: Float32Array<ArrayBuffer>;
  indices: Uint32Array<ArrayBuffer>;
  /** Corner heights the terrain is cut to, so the ground follows the road. */
  pins: Pin[];
  /** Where a street light stands, and which way the road runs there. */
  lamps: Array<{ x: number; y: number; z: number; yaw: number; side: -1 | 1 }>;
}

/**
 * One strip of the cross-section: from one point across the road to the next.
 *
 * Strips rather than points, because a point between two strips belongs to
 * both and they disagree about everything that matters. The surface is
 * flat-interpolated, so a shared vertex hands its material to whichever
 * triangle the rasteriser provokes from -- which put the kerb's material on
 * the carriageway down one whole side of every road in the city, and shaded
 * the footway on that side as a kerb top. The normal is worse: a kerb face is
 * vertical and the footway beside it is horizontal, and averaging the two
 * lights neither of them correctly.
 */
interface Strip {
  u0: number; y0: number;
  u1: number; y1: number;
  surf: number;
}

/**
 * The cross-section of a road of this class.
 *
 * Built from the spec rather than drawn, so a new class is a row in a table
 * rather than a new mesh: the kerb goes where the carriageway ends, the
 * footway fills to the corridor edge, and a reservation is a raised strip down
 * the middle of the same section.
 */
function section(cls: keyof typeof ROAD_SPECS): Strip[] {
  const spec = ROAD_SPECS[cls];
  const half = spec.half, edge = spec.edge;

  /** The right-hand half, built outward from the centreline. */
  const right: Strip[] = [];
  let u = 0, y = 0;
  const to = (nu: number, ny: number, surf: number): void => {
    right.push({ u0: u, y0: y, u1: nu, y1: ny, surf });
    u = nu; y = ny;
  };

  if (spec.median > 0) {
    y = KERB;
    to(spec.median, KERB, SURF.MEDIAN);          // the reservation
    to(spec.median, 0, SURF.KERB_FACE);          // down onto the carriageway
  }
  to(half, 0, SURF.ROAD);                        // the carriageway
  if (spec.kerbed) {
    to(half, KERB, SURF.KERB_FACE);              // the kerb, standing up
    to(half + 0.32, KERB, SURF.KERB_TOP);        // its top
    to(edge, KERB - 0.03, SURF.FOOTWAY);         // the footway behind it
  } else {
    // A lane has no kerb: the carriageway runs straight out into its verge.
    to(half + 0.5, 0.02, SURF.VERGE);
    to(edge, 0.06, SURF.VERGE);
  }
  // A skirt below the outer edge, so the ribbon meets the graded ground
  // without a hairline of terrain showing under it at a grazing angle.
  to(edge, -0.55, spec.kerbed ? SURF.FOOTWAY : SURF.VERGE);

  // Mirrored. Each strip keeps its own material and slope; only which way it
  // runs across the road changes.
  const left: Strip[] = right.map((t) => ({
    u0: -t.u0, y0: t.y0, u1: -t.u1, y1: t.y1, surf: t.surf,
  }));
  return [...left, ...right];
}

/** Growable float and index buffers, so the sweep can just push. */
/**
 * Where a piece's geometry goes.
 *
 * A thin front on whichever piece is being made, so the generating code below
 * never has to know that its output is cached. Indices come back relative to
 * the piece's own first vertex, which is what makes concatenating pieces a copy
 * and an offset rather than a rewrite.
 */
class Buf {
  constructor(private readonly into: () => Piece) {}

  get count(): number { return this.into().v.length / ROAD_FLOATS; }

  push(x: number, y: number, z: number, nx: number, ny: number, nz: number,
    u: number, s: number, toEnd: number,
    surf: number, half: number, lanes: number, flags: number): number {
    const p = this.into();
    const at = p.v.length / ROAD_FLOATS;
    p.v.push(x, y, z, nx, ny, nz, u, s, toEnd, surf, half, lanes, flags);
    return at;
  }

  tri(a: number, b: number, c: number): void {
    this.into().i.push(a, b, c);
  }

  quad(a: number, b: number, c: number, d: number): void {
    this.into().i.push(a, b, c, a, c, d);
  }
}

function blankPiece(sig: string): Piece {
  return { sig, v: [], i: [], lamps: [], pk: [], pd: [], py: [] };
}

/**
 * Levels for every node, smoothed across the graph.
 *
 * A junction takes the ground it sits on; a link ramps between the two it
 * joins, and the terrain under it is cut to that. Without the smoothing pass
 * each junction sits at its own local mean and a road between two of them a
 * hundred metres apart can have a two-metre step at each end -- which is
 * exactly the defect the tiled roads had, and the ramp between two pads that
 * far apart came up through the carriageway.
 */
function nodeLevels(graph: RoadGraph, base: (x: number, z: number) => number): number[] {
  const level = graph.nodes.map((n) => {
    let sum = 0;
    for (const [dx, dz] of [[0, 0], [9, 0], [-9, 0], [0, 9], [0, -9]]) {
      sum += base(n.x + dx, n.z + dz);
    }
    return sum / 5;
  });
  const neighbours: number[][] = graph.nodes.map(() => []);
  for (const link of graph.links) {
    neighbours[link.a].push(link.b);
    neighbours[link.b].push(link.a);
  }
  for (let pass = 0; pass < 6; pass++) {
    const next = level.slice();
    for (let i = 0; i < level.length; i++) {
      const near = neighbours[i];
      if (near.length === 0) continue;
      let sum = 0;
      for (const j of near) sum += level[j];
      next[i] = level[i] * 0.62 + (sum / near.length) * 0.38;
    }
    for (let i = 0; i < level.length; i++) level[i] = next[i];
  }
  return level;
}

/**
 * One road, on its own, as it would look if it were built.
 *
 * The drag preview used to be an axis-aligned rectangle drawn on the ground,
 * which could not show a curve and was half a cell off from where the road
 * actually landed -- the band was centred on a cell edge and the road on the
 * cell's centre. Showing the road itself removes the whole class of problem:
 * what is drawn while dragging is the same geometry the same code will build
 * on release, at the same place.
 */
export function previewRoad(grid: number, ax: number, az: number, bx: number, bz: number,
  cls: RoadClass, bend: number, base: (x: number, z: number) => number,
  through: [number, number] | null = null): RoadMesh | null {
  if (Math.hypot(bx - ax, bz - az) < 12) return null;
  const one = new RoadGraph(grid);
  one.add(ax, az, bx, bz, cls, bend, through);
  if (one.links.length === 0) return null;
  return buildRoadMesh(one, base, false);
}

/** Builds the whole network's geometry. */
/**
 * The road mesh as it was last made, and for which state of the graph.
 *
 * Every kerb, marking and junction in the city is regenerated here, and on a
 * five-kilometre map that is the single most expensive thing a rebuild does --
 * for a mesh that cannot have changed unless a road did. Zoning a block, buying
 * a plot, placing a hospital: none of them touch the network, and all of them
 * were paying for the whole thing.
 *
 * Keyed on the graph's own version, which it bumps when it re-rasterises, so
 * this cannot go stale without the graph saying so.
 */
let cachedMesh: { graph: RoadGraph; version: number; mesh: RoadMesh } | null = null;

/**
 * One road or one junction, kept so it need not be made twice.
 *
 * Caching the whole mesh on the graph's version stops zoning and land buying
 * paying for it, but a road drawn anywhere still remade every kerb, marking and
 * junction in the city -- and that is the one cost that grows with how much has
 * been built. A road two kilometres away has not changed, and this is the unit
 * at which that can be said.
 *
 * `sig` is everything the piece was made from. When it still matches, the piece
 * is reused byte for byte; when anything it depends on moves, it is made again.
 * The indices are relative to the piece's own first vertex, so concatenating is
 * a copy and an offset.
 */
interface Piece {
  sig: string;
  v: number[];
  i: number[];
  lamps: RoadMesh['lamps'];
  /** Corners this piece holds down: cell index, distance squared, height. */
  pk: number[];
  pd: number[];
  py: number[];
}

/** Keyed on a link's own name, and on a node's index. */
/** How much of the last mesh had to be made, for the rebuild profile. */
export let roadPiecesMade = 0;
export let roadPiecesKept = 0;

let linkPieces = new Map<number, Piece>();
let nodePieces = new Map<number, Piece>();

/** Throws the cached road mesh away, for a tool that changes the terrain. */
export function clearRoadMesh(): void {
  cachedMesh = null;
  linkPieces = new Map();
  nodePieces = new Map();
}

export function buildRoadMesh(graph: RoadGraph,
  base: (x: number, z: number) => number, raster = true): RoadMesh {
  if (raster) graph.rasterise();
  // `raster: false` means this is not the city's network but a throwaway --
  // the one-link graph the drag preview builds on every pointer move. Such a
  // graph must not touch the caches: it would replace the city's pieces with
  // its own on the way past, and the next real rebuild would find nothing kept
  // and make the whole map again, once per frame of the drag.
  const own = raster;
  if (own && cachedMesh !== null && cachedMesh.graph === graph
    && cachedMesh.version === graph.version) {
    return cachedMesh.mesh;
  }
  const wasLinks = linkPieces, wasNodes = nodePieces;
  if (!own) { linkPieces = new Map(); nodePieces = new Map(); }
  // The piece being made. Everything below writes through these rather than
  // into one buffer, which is the whole of the change: the generating code is
  // untouched, it just no longer knows whether its output is going straight
  // into the city or into a drawer to be used again.
  let piece: Piece = blankPiece('');
  const buf = new Buf(() => piece);
  const lamps = { push: (l: RoadMesh['lamps'][number]): void => { piece.lamps.push(l); } };
  /**
   * One entry per cell corner the corridor covers, holding the height of the
   * nearest point of road. Nearest, because two samples a few metres apart
   * disagree by centimetres and the corner should take the one that is
   * actually over it.
   *
   * Flat arrays over the whole corner grid rather than a map. This is written
   * about four million times on a full map -- every sample along every road
   * against every corner within its corridor -- and a map lookup per write is
   * most of what generating the roads used to cost.
   */
  const stride = graph.grid + 1;
  const half = graph.grid / 2;
  /** Which entry of the current piece holds a corner, while it is being made. */
  let mark: Array<number | undefined> = [];
  const hold = (x: number, z: number, reach: number, y: number): void => {
    // Squared throughout: this runs a few hundred thousand times on a full
    // map and the square roots were most of what the road mesh cost.
    const r2 = reach * reach;
    const gx0 = Math.max(0, Math.floor((x - reach) / 8 + half));
    const gx1 = Math.min(stride - 1, Math.ceil((x + reach) / 8 + half));
    const gz0 = Math.max(0, Math.floor((z - reach) / 8 + half));
    const gz1 = Math.min(stride - 1, Math.ceil((z + reach) / 8 + half));
    for (let gz = gz0; gz <= gz1; gz++) {
      const cz = (gz - half) * 8 - z;
      const cz2 = cz * cz;
      if (cz2 > r2) continue;
      for (let gx = gx0; gx <= gx1; gx++) {
        const cx = (gx - half) * 8 - x;
        const d = cx * cx + cz2;
        if (d > r2) continue;
        const k = gz * stride + gx;
        // Recorded on the piece and merged at the end, by the same rule: the
        // nearest road to a corner sets its height, and the first to claim it
        // at a given distance keeps it. Deduplicating within the piece and then
        // merging across pieces in the order they were made gives exactly what
        // one pass over one array gave.
        const seen = mark[k];
        if (seen === undefined || d < piece.pd[seen]) {
          if (seen === undefined) {
            mark[k] = piece.pk.length;
            piece.pk.push(k); piece.pd.push(d); piece.py.push(y);
          } else {
            piece.pd[seen] = d; piece.py[seen] = y;
          }
        }
      }
    }
  };
  const level = nodeLevels(graph, base);

  /** The pieces of this mesh, in the order they go into it. */
  const order: Piece[] = [];
  let made = 0;
  const freshLinks = new Map<number, Piece>();
  const freshNodes = new Map<number, Piece>();

  for (let li = 0; li < graph.links.length; li++) {
    const link: RoadLink = graph.links[li];
    // Everything this road's geometry is made from. Its own curve and class,
    // where its ends are, how far back the junctions at either end trim it, and
    // the heights those junctions sit at -- change any of them and the ribbon
    // is different; change none and it is the same road it was.
    const na = graph.nodes[link.a], nb = graph.nodes[link.b];
    const sig = `${link.a},${link.b},${link.cx},${link.cz},${link.cls},`
      + `${na.x},${na.z},${nb.x},${nb.z},`
      + `${graph.junctionRadius(link.a)},${graph.junctionRadius(link.b)},`
      + `${level[link.a]},${level[link.b]}`;
    const had = linkPieces.get(link.id);
    if (had !== undefined && had.sig === sig) {
      order.push(had);
      freshLinks.set(link.id, had);
      continue;
    }
    made++;
    piece = blankPiece(sig);
    mark = [];
    order.push(piece);
    freshLinks.set(link.id, piece);
    const spec = ROAD_SPECS[link.cls];
    const ribs: Strip[] = section(link.cls);
    const flags = (spec.oneWay ? 1 : 0) | (spec.tram ? 2 : 0) | (spec.median > 0 ? 4 : 0);
    const dense = graph.samples(link);
    const total = dense[dense.length - 1].s;

    // Trimmed clear of the junctions at either end, which cover the middle.
    const cut0 = graph.junctionRadius(link.a);
    const cut1 = graph.junctionRadius(link.b);
    if (total - cut0 - cut1 < 1.5) continue;

    const shape = graph.shape(link);
    const at: number[] = [];
    for (const p of shape) {
      const s = Math.min(Math.max(p.s, cut0), total - cut1);
      at.push(s);
    }
    // Anything the shape sampling skipped over near the ends.
    at[0] = cut0;
    at[at.length - 1] = total - cut1;

    /**
     * The ramp, over the range actually drawn.
     *
     * Not over the whole link: the ribbon starts at the junction trim, and
     * interpolating on distance from the link's start meant the first
     * cross-section was already a sixth of the way down the ramp -- a step of
     * a metre and a half against the junction it was supposed to meet, with a
     * band of bare ground visible through it on every approach in the city.
     */
    const drawn = Math.max(1e-6, total - cut1 - cut0);
    const levelAt = (s: number): number =>
      level[link.a] + (level[link.b] - level[link.a]) * ((s - cut0) / drawn);

    let prevRow: number[] | null = null;
    let lampAt = 0;
    for (let k = 0; k < at.length; k++) {
      const p = walk(dense, at[k]);
      const y = levelAt(at[k]);
      // Left of travel, in the ground plane.
      const nx = -p.tz, nz = p.tx;
      // How far this cross-section is from the nearer end of the drawn run, so
      // the shader can put a stop line where the road meets a junction.
      const toEnd = Math.min(at[k] - cut0, total - cut1 - at[k]);
      const row: number[] = [];
      for (const t of ribs) {
        const du = t.u1 - t.u0, dy = t.y1 - t.y0;
        const len = Math.hypot(du, dy) || 1;
        // Perpendicular to the strip within the cross-section, carried into
        // the world by the road's own normal: a flat strip faces up, a kerb
        // face faces back across the carriageway.
        const mx = (-dy * nx) / len, my = Math.abs(du) / len, mz = (-dy * nz) / len;
        row.push(buf.push(
          p.x + nx * t.u0, y + t.y0 + LIFT, p.z + nz * t.u0,
          mx, my, mz, t.u0, at[k], toEnd, t.surf, spec.half, spec.lanes, flags,
        ));
        row.push(buf.push(
          p.x + nx * t.u1, y + t.y1 + LIFT, p.z + nz * t.u1,
          mx, my, mz, t.u1, at[k], toEnd, t.surf, spec.half, spec.lanes, flags,
        ));
      }
      if (prevRow !== null) {
        for (let r = 0; r + 1 < row.length; r += 2) {
          buf.quad(prevRow[r], prevRow[r + 1], row[r + 1], row[r]);
        }
        // One pad per span, plus enough extra along a long straight that the
        // graded strip follows the road rather than boxing its whole diagonal.
        // The ground under the span, held at the road's own height all the
        // way along it rather than cut as a chain of flat rectangles.
        const span = at[k] - at[k - 1];
        const steps = Math.max(1, Math.round(span / 5.5));
        for (let q = 0; q <= steps; q++) {
          const s0 = at[k - 1] + (span * q) / steps;
          const a = walk(dense, s0);
          hold(a.x, a.z, spec.edge + 5, levelAt(s0));
        }
      }
      // Street lighting, spaced along the arc and alternating sides.
      if (spec.lamp > 0) {
        while (lampAt <= at[k]) {
          if (lampAt >= cut0) {
            const q = walk(dense, lampAt);
            const side: -1 | 1 = ((lampAt / spec.lamp) | 0) % 2 === 0 ? 1 : -1;
            lamps.push({
              x: q.x + -q.tz * spec.half * 1.06 * side,
              y,
              z: q.z + q.tx * spec.half * 1.06 * side,
              yaw: Math.atan2(q.tx, q.tz),
              side,
            });
          }
          lampAt += spec.lamp;
        }
      }
      prevRow = row;
    }
  }

  // ---- junctions ---------------------------------------------------------
  //
  // A polygon through the corners of the arms that arrive, fanned from the
  // middle. The arms were trimmed back by the same radius, so the polygon
  // covers exactly the hole they left; between one arm and the next the edge
  // runs straight across, which is the chamfer a real junction has.
  for (let n = 0; n < graph.nodes.length; n++) {
    // A junction is made from where it is, how high it sits, and the arms that
    // arrive -- which road, of which class, coming from where. Its own radius
    // follows from those, so it does not need saying twice.
    const here = graph.nodes[n];
    let nsig = `${here.x},${here.z},${level[n]}`;
    for (const ai of graph.armsOf(n)) {
      const l = graph.links[ai];
      const far = graph.nodes[l.a === n ? l.b : l.a];
      nsig += `|${l.id},${l.cls},${far.x},${far.z},${l.cx},${l.cz}`;
    }
    const kept = nodePieces.get(n);
    if (kept !== undefined && kept.sig === nsig) {
      order.push(kept);
      freshNodes.set(n, kept);
      continue;
    }
    made++;
    piece = blankPiece(nsig);
    mark = [];
    order.push(piece);
    freshNodes.set(n, piece);
    interface Arm {
      angle: number;
      /** Where the arm meets the junction, and the way it points out of it. */
      x: number; z: number; tx: number; tz: number;
      spec: typeof ROAD_SPECS[RoadClass];
      /** Left and right of the carriageway, and of the whole corridor. */
      lx: number; lz: number; rx: number; rz: number;
      elx: number; elz: number; erx: number; erz: number;
    }
    const arms: Arm[] = [];
    const r = graph.junctionRadius(n);
    if (r <= 0) continue;
    for (const link of graph.links) {
      if (link.a !== n && link.b !== n) continue;
      const spec = ROAD_SPECS[link.cls];
      const dense = graph.samples(link);
      const total = dense[dense.length - 1].s;
      const from = link.a === n;
      const p = walk(dense, from ? Math.min(r, total) : Math.max(total - r, 0));
      // Tangent pointing away from this node.
      const tx = from ? p.tx : -p.tx, tz = from ? p.tz : -p.tz;
      const nx = -tz, nz = tx;
      arms.push({
        angle: Math.atan2(tz, tx),
        x: p.x, z: p.z, tx, tz, spec,
        lx: p.x + nx * spec.half, lz: p.z + nz * spec.half,
        rx: p.x - nx * spec.half, rz: p.z - nz * spec.half,
        elx: p.x + nx * spec.edge, elz: p.z + nz * spec.edge,
        erx: p.x - nx * spec.edge, erz: p.z - nz * spec.edge,
      });
    }
    if (arms.length === 0) continue;
    arms.sort((a, b) => a.angle - b.angle);

    const node = graph.nodes[n];
    const y = level[n];
    const at = (x: number, z: number, up: number, surf: number): number =>
      buf.push(x, y + LIFT + up, z, 0, 1, 0,
        Math.hypot(x - node.x, z - node.z), 0, 0, surf, r, 0, 0);

    // The carriageway: a fan through the arms' kerb lines.
    const centre = at(node.x, node.z, 0, SURF.JUNCTION);
    const ring: number[] = [];
    for (const arm of arms) {
      ring.push(at(arm.rx, arm.rz, 0, SURF.JUNCTION));
      ring.push(at(arm.lx, arm.lz, 0, SURF.JUNCTION));
    }
    for (let i = 0; i < ring.length; i++) {
      buf.tri(centre, ring[i], ring[(i + 1) % ring.length]);
    }

    // A crossing across the mouth of every arm.
    //
    // This is what was missing. A junction whose whole slab is one flat
    // material is a hole where the roads stop -- the eye has nothing to tell
    // it how the lanes carry through, which way traffic gives way, or where a
    // person on foot is meant to go. So each arm gets a crossing laid across
    // its own carriageway, in its own frame: the bars run across the lanes
    // that feed it and their spacing comes from that road's lane width, so a
    // dual carriageway gets a wider ladder than a lane does.
    //
    // Geometry rather than paint on the junction slab, because the junction
    // has no idea where its arms point and this does. Only where three or more
    // roads meet: two arms is a road carrying on, and a crossing in the middle
    // of a straight is a crossing nobody asked for.
    if (arms.length >= 3) {
      for (const arm of arms) {
        const half = arm.spec.half;
        const nx = -arm.tz, nz = arm.tx;
        // Just inside the junction, so it sits between the stop line on the
        // approach and the open middle where turning traffic crosses.
        const near = 0.55, deep = Math.min(2.8, r * 0.62);
        const mark = (across: number, along: number): number => {
          const x = arm.x + arm.tx * -along + nx * across;
          const z = arm.z + arm.tz * -along + nz * across;
          return buf.push(x, y + LIFT + 0.004, z, 0, 1, 0,
            across, along, 9, SURF.CROSSING, half, arm.spec.lanes, 0);
        };
        buf.quad(mark(-half, near), mark(half, near),
          mark(half, near + deep), mark(-half, near + deep));
      }
    }

    // The corners between one arm and the next: pavement, with a kerb face
    // down to the carriageway. Without these the footways stop dead at the
    // trim line and every junction has four wedges of bare earth around it.
    for (let i = 0; i < arms.length; i++) {
      const a = arms[i], b = arms[(i + 1) % arms.length];
      // From a's left side round to b's right side.
      const ai = at(a.lx, a.lz, 0, SURF.KERB_FACE);
      const ao = at(a.elx, a.elz, KERB, SURF.FOOTWAY);
      const bi = at(b.rx, b.rz, 0, SURF.KERB_FACE);
      const bo = at(b.erx, b.erz, KERB, SURF.FOOTWAY);
      const aiTop = at(a.lx, a.lz, KERB, SURF.KERB_TOP);
      const biTop = at(b.rx, b.rz, KERB, SURF.KERB_TOP);
      // The kerb face, standing up out of the carriageway.
      buf.quad(ai, bi, biTop, aiTop);
      // The pavement behind it.
      buf.quad(aiTop, biTop, bo, ao);
      // And a skirt down into the ground at the outer edge.
      const aSkirt = at(a.elx, a.elz, -0.55, SURF.FOOTWAY);
      const bSkirt = at(b.erx, b.erz, -0.55, SURF.FOOTWAY);
      buf.quad(ao, bo, bSkirt, aSkirt);
    }

    hold(node.x, node.z, r + 4, y);
  }

  roadPiecesMade = made;
  roadPiecesKept = order.length - made;
  linkPieces = own ? freshLinks : wasLinks;
  nodePieces = own ? freshNodes : wasNodes;

  // The pieces, joined. Vertices in the order the loops ran, indices offset by
  // where each piece landed, and the corners merged by the rule each piece
  // already applied to itself: nearest road wins, first to claim keeps a tie.
  let vCount = 0, iCount = 0;
  for (const q of order) { vCount += q.v.length; iCount += q.i.length; }
  const vertices = new Float32Array(new ArrayBuffer(vCount * 4));
  const indices = new Uint32Array(new ArrayBuffer(iCount * 4));
  const pinY = new Float32Array(stride * stride);
  const pinD = new Float32Array(stride * stride);
  const pinSet = new Uint8Array(stride * stride);
  const out: RoadMesh['lamps'] = [];
  let vAt = 0, iAt = 0;
  for (const q of order) {
    const base = vAt / ROAD_FLOATS;
    vertices.set(q.v, vAt);
    vAt += q.v.length;
    for (let k = 0; k < q.i.length; k++) indices[iAt + k] = q.i[k] + base;
    iAt += q.i.length;
    for (const l of q.lamps) out.push(l);
    for (let k = 0; k < q.pk.length; k++) {
      const c = q.pk[k], d = q.pd[k];
      if (pinSet[c] === 0 || d < pinD[c]) { pinSet[c] = 1; pinD[c] = d; pinY[c] = q.py[k]; }
    }
  }
  const pins: Pin[] = [];
  for (let k = 0; k < pinSet.length; k++) {
    if (pinSet[k] === 1) pins.push({ gx: k % stride, gz: (k / stride) | 0, y: pinY[k] });
  }
  const mesh = { vertices, indices, pins, lamps: out };
  if (own) cachedMesh = { graph, version: graph.version, mesh };
  return mesh;
}
