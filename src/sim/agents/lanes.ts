/**
 * The lane graph: the network everything drives, walks and routes on.
 *
 * The road graph the player edits is a graph of *links* -- a road from one
 * junction to another, with a shape and a class. That is the right structure
 * for editing and the wrong one for driving, because a link is two-way, it has
 * several lanes in each direction, and a vehicle at a junction cannot reach
 * every lane of every arm from where it is. Routing over links produces the
 * fault every city builder is known for: cars that take the correct road and
 * the wrong lane, then stop dead trying to cross four lanes of traffic in the
 * twenty metres before the turn.
 *
 * So this derives a directed graph whose nodes are *lanes* and whose edges are
 * the movements a junction actually permits. A route is then a list of lanes,
 * which is a list of instructions a driver can follow: the lane choice is part
 * of the path rather than a decision taken too late.
 *
 * The cost of that is more nodes -- a two-lane street is four lane-nodes
 * instead of one link -- and the benefit is that lane choice, turn
 * restrictions, bus lanes, and the difference between a left turn and a right
 * one all fall out of the graph rather than needing special cases on top of
 * it. It is the structure the problem actually has.
 *
 * Layout: structure of arrays, indices not objects, edges in one flat array
 * with a per-lane [start, end) range -- a compressed sparse row, which is the
 * layout every serious graph algorithm wants because walking a node's edges is
 * then one contiguous run.
 */

import { ROAD_SPECS } from '../roadgraph';
import { nodeLevels } from '../roadmesh';
import { baseHeightAt } from '../terrain';
import type { RoadGraph, RoadClass } from '../roadgraph';

/** Which way a lane runs along its link. */
export const FORWARD = 0;
export const BACKWARD = 1;

/**
 * What may use a lane. A bitmask, because a bus lane admits buses and bicycles
 * and nothing else, and asking that question is a single and.
 */
export const Use = {
  CAR: 1 << 0,
  BUS: 1 << 1,
  TRAM: 1 << 2,
  BIKE: 1 << 3,
  FOOT: 1 << 4,
  EMERGENCY: 1 << 5,
  CARGO: 1 << 6,
} as const;

/** Everything with an engine that is not on rails. */
const ROAD_USE = Use.CAR | Use.BUS | Use.EMERGENCY | Use.CARGO;

/** Which way a movement turns, for cost and for priority. */
export const Turn = {
  STRAIGHT: 0,
  RIGHT: 1,
  LEFT: 2,
  U: 3,
} as const;

/**
 * How much slower a turn is than going straight, in seconds.
 *
 * Not a distance penalty -- a turn's cost is the time it takes to make it, and
 * that is dominated by giving way rather than by the metres travelled. A left
 * turn across oncoming traffic is the expensive one and it is expensive
 * everywhere; making it cheap is how you get a city where every route crosses
 * the main road at an unsignalled junction.
 */
const TURN_SECONDS = [0, 2.5, 6.0, 12.0];

/**
 * How far outside the paved junction the stop line sits, in metres.
 *
 * A car's nose stops about a metre short of the give-way markings and the
 * markings sit a little outside the paving, which together is about this. Small
 * enough that a vehicle holding here still reads as being at the junction
 * rather than parked up the road from it.
 */
const STOP_LINE_MARGIN = 1.6;

/**
 * Which side traffic drives on. 1 for the right, -1 for the left.
 *
 * It decides which of a carriageway's lanes is the kerbside one, and so which
 * turn each lane naturally serves -- and, since the movers are drawn, which
 * side of the centre line a lane's own track is on. Exported so the drawing
 * cannot disagree with the routing about which way round a road works.
 */
export const DRIVE_SIDE = 1;
const DRIVE = DRIVE_SIDE;

/**
 * What it costs to make a turn from a lane that does not serve it.
 *
 * This is the whole point of routing over lanes rather than links, and it is
 * deliberately a cost rather than a prohibition. A prohibition would be more
 * realistic and much worse: a junction where the only continuation is a left
 * turn and the approach has two lanes would have an unreachable arm, and a
 * city has hundreds of those. As a cost, the router puts cars in the correct
 * lane at the *start* of the link -- which is the behaviour wanted -- and
 * still finds a route when the only way through is to be in the wrong one.
 *
 * Five seconds is roughly what crossing a lane of moving traffic costs, and it
 * is larger than a right turn's penalty and smaller than a left's, so a driver
 * will change lanes to avoid a left turn but not to avoid a right one.
 */
const WRONG_LANE_SECONDS = 5;

/**
 * Lanes a router may choose between, per direction.
 *
 * Capped at two however wide the road, and that cap is load-bearing. Junction
 * movements are the product of the arms' lanes, so a motorway interchange of
 * three-lane arms is nine movements per pair where two-lane arms are four --
 * and the extra five buy nothing, because the third lane goes exactly where
 * the second one does. What a router needs to distinguish is *kerbside*, from
 * which one leaves the road, and *inner*, from which one crosses it. Which of
 * three physical lanes a particular car sits in is the driving model's
 * business and it decides that locally, per car, without searching anything.
 */
function routeLanes(cls: RoadClass): number {
  return Math.min(2, Math.max(1, ROAD_SPECS[cls].lanes));
}

/**
 * Whether a lane naturally serves a turn.
 *
 * On a single-lane approach every turn is natural -- there is nowhere else to
 * be. On a two-lane one the kerbside lane serves the turn towards the kerb and
 * straight on, and the inner lane serves straight on, the turn across traffic,
 * and the U-turn.
 */
function serves(index: number, lanes: number, turn: number): boolean {
  if (lanes <= 1) return true;
  const kerbside = index === 0;
  const towardsKerb = DRIVE > 0 ? Turn.RIGHT : Turn.LEFT;
  if (turn === Turn.STRAIGHT) return true;
  if (turn === towardsKerb) return kerbside;
  return !kerbside;              // across traffic, and U-turns, from the inner lane
}

export interface LaneGraph {
  /** Lanes. */
  count: number;
  /** The link each lane belongs to, and which way it runs along it. */
  link: Int32Array;
  dir: Uint8Array;
  /** Which lane of its side, 0 nearest the kerb. */
  index: Uint8Array;
  /** What may use it. */
  use: Uint8Array;
  /**
   * How important the road is: 0 a back lane, 1 a street, 2 an arterial, 3 a
   * motorway.
   *
   * The router uses it to stop searching every cul-de-sac on the far side of the
   * city. A cross-town trip is allowed to leave its origin on a back street and
   * arrive on one, and in between it has to stay on roads that go somewhere --
   * which is both how people actually drive and how the search stays small.
   */
  rank: Uint8Array;
  /** Metres. */
  length: Float32Array;
  /** Metres a second. */
  speed: Float32Array;
  /** Seconds to traverse when empty: length / speed, precomputed. */
  free: Float32Array;
  /**
   * How far back from the end node the stop line is, in metres.
   *
   * A lane runs from node centre to node centre, and a node is the *middle* of
   * its junction -- so "the end of the lane" is the middle of the crossroads.
   * Everything that holds a vehicle for a light, a give way or a conflicting
   * movement held it there, which put every waiting car in the box it was
   * waiting to enter. From the air that is the single most broken thing traffic
   * can do, and it is what made a junction read as cars stopping in it, sitting
   * there, and then sliding out.
   *
   * So the model has a stop line: this far short of the node, which is the edge
   * of the paved junction plus a little. A vehicle waits here, and the metres
   * between here and the node are the junction it then drives across.
   */
  stopBack: Float32Array;
  /** The same, at the lane's start node: where it leaves that junction. */
  startBack: Float32Array;
  /**
   * The deck's height at the lane's two ends, in metres above sea level, for a
   * lane on a raised road; NaN on the ground, where the graded terrain is the
   * road and what stands on it takes its height from there.
   */
  ya: Float32Array;
  yb: Float32Array;
  /** The node this lane starts at and ends at, in the road graph. */
  from: Int32Array;
  to: Int32Array;
  /** Where the lane's two ends are in the world, for heuristics and drawing. */
  ax: Float32Array; az: Float32Array;
  bx: Float32Array; bz: Float32Array;
  /**
   * Unit direction of travel where the lane leaves its start node, and where it
   * arrives at its end node.
   *
   * Not the chord between the two: a link is a curve, and classifying a turn
   * from the chord is wrong by exactly the link's bend. On a road that sweeps
   * ninety degrees the chord says the arm leaves at forty-five, so a junction
   * at its end has every movement mislabelled -- which is how a long curve ends
   * up costing a left turn's twelve seconds to drive straight along, and how
   * two arms that continue smoothly into each other stop looking connected.
   */
  itx: Float32Array; itz: Float32Array;
  etx: Float32Array; etz: Float32Array;

  /** Compressed sparse row over the movements out of each lane. */
  edgeStart: Int32Array;
  /** One past the last edge of lane i. */
  edgeEnd: Int32Array;
  /** The lane each movement leads to. */
  edgeTo: Int32Array;
  /** Which way it turns. */
  edgeTurn: Uint8Array;
  /** Seconds the movement itself costs, before the lane it leads to. */
  edgeCost: Float32Array;
  edgeCount: number;

  /**
   * Lanes of a link, by [link * 2 + dir] -> the [start, end) range of lane
   * indices. Lanes of one side of one link are laid down contiguously, so this
   * indexes the lane arrays directly and there is no indirection table.
   */
  linkStart: Int32Array;
  linkEnd: Int32Array;

  /**
   * Each link's centreline as it is actually drawn, by [link] -> the
   * [curveAt[link], curveAt[link + 1]) range of `curveX`/`curveZ`, evenly
   * spaced by arc length from the link's start node.
   *
   * A lane's `ax..bx` is the chord between its nodes, and on a road drawn as a
   * curve that chord runs straight across the bend -- through the verge, the
   * footway and whatever is built on the inside of it. Anything drawn on a lane
   * goes through `placeAlong`, which follows this instead. A straight link
   * keeps just its two ends.
   */
  curveAt: Int32Array;
  curveX: Float32Array;
  curveZ: Float32Array;
  /**
   * Metres from a link's centreline to the middle of its footway, or of the
   * verge on a road with no pavement. Where a pedestrian walks.
   */
  footway: Float32Array;
}

/**
 * A point `along` metres into `lane`, `off` metres to the right of its direction
 * of travel, on the road as drawn. Writes x, z and the unit heading to `out`.
 */
export function placeAlong(g: LaneGraph, lane: number, along: number, off: number,
  out: Float32Array | number[]): void {
  const link = g.link[lane];
  const c0 = g.curveAt[link], c1 = g.curveAt[link + 1];
  const segs = c1 - c0 - 1;
  const len = Math.max(0.001, g.length[lane]);
  const back = g.dir[lane] !== FORWARD;
  let s = Math.max(0, Math.min(len, along));
  if (back) s = len - s;
  const f = Math.min(segs - 1e-6, (s / len) * segs);
  const i = Math.max(0, Math.floor(f)), t = f - i;
  const x0 = g.curveX[c0 + i], z0 = g.curveZ[c0 + i];
  const x1 = g.curveX[c0 + i + 1], z1 = g.curveZ[c0 + i + 1];
  let tx = x1 - x0, tz = z1 - z0;
  const n = Math.hypot(tx, tz) || 1;
  tx /= n; tz /= n;
  if (back) { tx = -tx; tz = -tz; }
  out[0] = x0 + (x1 - x0) * t + tz * off;
  out[1] = z0 + (z1 - z0) * t - tx * off;
  out[2] = tx;
  out[3] = tz;
}

/** What a class admits. */
function admits(cls: RoadClass): number {
  const spec = ROAD_SPECS[cls];
  if (cls === 'path') return Use.BIKE | Use.FOOT;
  if (cls === 'pedestrian' || cls === 'promenade') return Use.FOOT | Use.BIKE | Use.EMERGENCY;
  if (cls === 'motorway' || cls === 'slip') return ROAD_USE;   // no pedestrians
  let use = ROAD_USE | Use.BIKE | Use.FOOT;
  if (spec.tram) use |= Use.TRAM;
  return use;
}

/**
 * How far up the road hierarchy a class sits.
 *
 * Not the same question as how fast it is: an industrial road is slower than a
 * country lane is wide, and it is still a road a lorry crosses the city on.
 * What this ranks is whether traffic is *meant* to pass along it.
 */
function rankOf(cls: RoadClass): number {
  switch (cls) {
    case 'motorway': case 'dual': case 'highway': case 'slip': return 3;
    case 'avenue': case 'boulevard': case 'industrial': case 'tram': case 'bus': return 2;
    case 'street': case 'oneway': case 'cycleStreet': case 'tramStreet': case 'promenade':
      return 1;
    default: return 0;
  }
}

/** Free-flow speed in metres a second. */
function speedOf(cls: RoadClass): number {
  const kph: Record<string, number> = {
    path: 16, track: 25, alley: 20, pedestrian: 8, promenade: 8,
    lane: 60, street: 50, cycleStreet: 30, oneway: 50, bus: 50,
    avenue: 60, boulevard: 60, tram: 50, tramStreet: 40,
    industrial: 50, highway: 90, dual: 90, slip: 70, motorway: 110,
  };
  return (kph[cls] ?? 50) / 3.6;
}

/**
 * Which way `b` turns relative to `a`, from their directions of travel.
 *
 * The cross product's sign gives left from right and the dot product tells a
 * straight from a U-turn. Thresholds rather than exact angles because a road
 * that bends thirty degrees into a junction is still going straight through
 * it, and treating that as a turn puts a six-second penalty on every gentle
 * curve in the city.
 */
function turnOf(ax: number, az: number, bx: number, bz: number): number {
  const dot = ax * bx + az * bz;
  const cross = ax * bz - az * bx;
  if (dot < -0.75) return Turn.U;
  if (dot > 0.45) return Turn.STRAIGHT;
  return cross > 0 ? Turn.RIGHT : Turn.LEFT;
}

/**
 * Builds the lane graph from the road graph.
 *
 * Rebuilt whole whenever the road network changes. That is deliberate: road
 * edits are rare -- a player draws a few roads a minute at most -- and an
 * incremental lane graph would have to work out which movements a new link
 * invalidates at both its ends and at every junction it split, which is the
 * kind of code that is wrong in one case out of fifty and produces a city
 * where one junction silently cannot be turned left at. Whole rebuild,
 * measured, and kept honest by the fact that it is measured.
 */
export function buildLaneGraph(net: RoadGraph): LaneGraph {
  const links = net.links;
  const linkStart = new Int32Array(links.length * 2).fill(0);
  const linkEnd = new Int32Array(links.length * 2).fill(0);

  // Pass one: count lanes, so every array is allocated once at its real size.
  let count = 0;
  for (const link of links) {
    const n = routeLanes(link.cls);
    count += ROAD_SPECS[link.cls].oneWay ? n : n * 2;
  }

  const g: LaneGraph = {
    count: 0,
    link: new Int32Array(count), dir: new Uint8Array(count),
    index: new Uint8Array(count), use: new Uint8Array(count),
    rank: new Uint8Array(count),
    length: new Float32Array(count), speed: new Float32Array(count),
    free: new Float32Array(count),
    from: new Int32Array(count), to: new Int32Array(count),
    ax: new Float32Array(count), az: new Float32Array(count),
    bx: new Float32Array(count), bz: new Float32Array(count),
    stopBack: new Float32Array(count),
    startBack: new Float32Array(count),
    itx: new Float32Array(count), itz: new Float32Array(count),
    etx: new Float32Array(count), etz: new Float32Array(count),
    edgeStart: new Int32Array(count), edgeEnd: new Int32Array(count),
    edgeTo: new Int32Array(0), edgeTurn: new Uint8Array(0),
    edgeCost: new Float32Array(0), edgeCount: 0,
    linkStart, linkEnd,
    curveAt: new Int32Array(links.length + 1),
    curveX: new Float32Array(0), curveZ: new Float32Array(0),
    footway: new Float32Array(links.length),
    ya: new Float32Array(count).fill(NaN), yb: new Float32Array(count).fill(NaN),
  };
  const curveX: number[] = [], curveZ: number[] = [];

  // Pass two: make the lanes.
  let at = 0;
  for (let i = 0; i < links.length; i++) {
    const link = links[i];
    const spec = ROAD_SPECS[link.cls];
    const pts = net.samples(link);
    const total = pts[pts.length - 1].s;
    const a = net.nodes[link.a], b = net.nodes[link.b];
    // The drawn centreline, or just its ends if it never strays half a metre
    // from the chord: most links are straight and need nothing more.
    g.curveAt[i] = curveX.length;
    let bent = false;
    {
      const cx = b.x - a.x, cz = b.z - a.z, cl = Math.hypot(cx, cz) || 1;
      for (const p of pts) {
        if (Math.abs(((p.x - a.x) * cz - (p.z - a.z) * cx) / cl) > 0.5) { bent = true; break; }
      }
    }
    if (bent) for (const p of pts) { curveX.push(p.x); curveZ.push(p.z); }
    else { curveX.push(a.x, b.x); curveZ.push(a.z, b.z); }
    g.footway[i] = spec.kerbed ? (spec.half + 0.32 + spec.edge) / 2 : (spec.half + 0.5 + spec.edge) / 2;
    // The road's own tangent at each end, so a curve's arms meet at the angle
    // they actually meet at. Backward lanes travel the other way, so both
    // components flip.
    const head = pts[0], tail = pts[pts.length - 1];
    const n = routeLanes(link.cls);
    const use = admits(link.cls);
    const v = speedOf(link.cls);
    const rk = rankOf(link.cls);
    const dirs = spec.oneWay ? [FORWARD] : [FORWARD, BACKWARD];
    for (const d of dirs) {
      const slot = i * 2 + d;
      linkStart[slot] = at;
      for (let k = 0; k < n; k++) {
        g.link[at] = i; g.dir[at] = d; g.index[at] = k; g.use[at] = use;
        g.rank[at] = rk;
        g.length[at] = Math.max(total, 1);
        g.speed[at] = v;
        g.free[at] = Math.max(total, 1) / v;
        g.from[at] = d === FORWARD ? link.a : link.b;
        g.to[at] = d === FORWARD ? link.b : link.a;
        g.ax[at] = d === FORWARD ? a.x : b.x;
        g.az[at] = d === FORWARD ? a.z : b.z;
        g.bx[at] = d === FORWARD ? b.x : a.x;
        g.bz[at] = d === FORWARD ? b.z : a.z;
        const f = d === FORWARD ? 1 : -1;
        g.itx[at] = f * (d === FORWARD ? head.tx : tail.tx);
        g.itz[at] = f * (d === FORWARD ? head.tz : tail.tz);
        g.etx[at] = f * (d === FORWARD ? tail.tx : head.tx);
        g.etz[at] = f * (d === FORWARD ? tail.tz : head.tz);
        at++;
      }
      linkEnd[slot] = at;
    }
    // A one-way link has no backward side; point its slot at an empty range so
    // callers can index it without testing the class first.
    if (spec.oneWay) { linkStart[i * 2 + BACKWARD] = at; linkEnd[i * 2 + BACKWARD] = at; }
  }
  g.count = at;
  g.curveAt[links.length] = curveX.length;
  g.curveX = Float32Array.from(curveX);
  g.curveZ = Float32Array.from(curveZ);

  // The stop lines. Taken from the junction's own size rather than a constant,
  // because a crossroads of two avenues is twice the box a pair of streets is,
  // and a fixed set-back would put a car short of one and inside the other.
  // Capped against the lane's own length so a short link between two big
  // junctions still has somewhere to stop rather than a stop line behind its
  // own start.
  for (let l = 0; l < g.count; l++) {
    const node = g.to[l];
    const r = node >= 0 && node < net.nodes.length ? net.junctionRadius(node) : 0;
    g.stopBack[l] = Math.min(r + STOP_LINE_MARGIN, g.length[l] * 0.35);
    const start = g.from[l];
    const sr = start >= 0 && start < net.nodes.length ? net.junctionRadius(start) : 0;
    g.startBack[l] = Math.min(sr + STOP_LINE_MARGIN, g.length[l] * 0.35);
  }

  // Pass three: the movements.
  //
  // Every lane arriving at a node may continue into the lanes leaving it,
  // subject to three things: the two lanes must share a kind of user, a U-turn
  // is only on offer where there is nothing else, and a movement made from a
  // lane that does not serve it pays for crossing the carriageway.
  //
  // Counted first, then filled, so the edge arrays are exactly the right size.
  // An edge list that grows by push is an array of boxed numbers, and at
  // metropolitan scale that alone is tens of megabytes and a garbage collector
  // running during road edits.
  const outOf: number[][] = Array.from({ length: net.nodes.length }, () => []);
  for (let l = 0; l < g.count; l++) outOf[g.from[l]].push(l);

  // Whether each node has any arm other than one given link. A dead end is a
  // node where every lane leaving it belongs to the link that arrived, and it
  // is the only place a U-turn is legal.
  const deadEnd = new Uint8Array(net.nodes.length);
  for (let n = 0; n < net.nodes.length; n++) {
    let links = 0, first = -1;
    for (const o of outOf[n]) {
      if (first < 0) { first = g.link[o]; links = 1; } else if (g.link[o] !== first) { links = 2; break; }
    }
    deadEnd[n] = links < 2 ? 1 : 0;
  }

  let edges = 0;
  for (let l = 0; l < g.count; l++) {
    for (const o of outOf[g.to[l]]) if (permits(g, l, o, deadEnd)) edges++;
  }
  g.edgeTo = new Int32Array(edges);
  g.edgeTurn = new Uint8Array(edges);
  g.edgeCost = new Float32Array(edges);

  let e = 0;
  for (let l = 0; l < g.count; l++) {
    g.edgeStart[l] = e;
    const inLanes = g.linkEnd[g.link[l] * 2 + g.dir[l]] - g.linkStart[g.link[l] * 2 + g.dir[l]];
    for (const o of outOf[g.to[l]]) {
      if (!permits(g, l, o, deadEnd)) continue;
      const t = turnOf(g.etx[l], g.etz[l], g.itx[o], g.itz[o]);
      let cost = TURN_SECONDS[t];
      // Lane discipline, both ends of the movement: leaving from a lane that
      // does not serve this turn, and arriving in one that does not receive it.
      const outLanes = g.linkEnd[g.link[o] * 2 + g.dir[o]] - g.linkStart[g.link[o] * 2 + g.dir[o]];
      if (!serves(g.index[l], inLanes, t)) cost += WRONG_LANE_SECONDS;
      if (!serves(g.index[o], outLanes, t)) cost += WRONG_LANE_SECONDS;
      g.edgeTo[e] = o;
      g.edgeTurn[e] = t;
      g.edgeCost[e] = cost;
      e++;
    }
    g.edgeEnd[l] = e;
  }
  g.edgeCount = e;

  // Deck heights, from the same junction levels the road mesh is built to, so
  // a car on a flyover drives on the deck that is drawn.
  if (net.nodes.some((n) => n.elev > 0.5)) {
    const level = nodeLevels(net, baseHeightAt);
    for (let l = 0; l < g.count; l++) {
      const a = net.nodes[g.from[l]], b = net.nodes[g.to[l]];
      if (Math.max(a.elev, b.elev) <= 0.5) continue;
      g.ya[l] = level[g.from[l]];
      g.yb[l] = level[g.to[l]];
    }
  }
  return g;
}

/**
 * The deck's height at a point along a lane, or NaN for a lane on the ground.
 * Linear between the two junctions, as the deck is.
 */
export function deckAt(g: LaneGraph, lane: number, along: number): number {
  const a = g.ya[lane];
  if (Number.isNaN(a)) return NaN;
  const f = Math.max(0, Math.min(1, along / Math.max(1e-3, g.length[lane])));
  return a + (g.yb[lane] - a) * f;
}

/**
 * Whether a vehicle in lane `a` may continue into lane `b`.
 *
 * Three rules. The lanes must share a kind of user, or a bus route would
 * cheerfully continue down a cycle path. A movement onto the same side of the
 * same link is not a movement at all -- lanes span a whole link, so there is
 * nothing between a lane and its neighbour to traverse; changing lanes is
 * priced into the turn that needed it, not modelled as an edge, which also
 * keeps the graph free of the zero-length cycles such an edge would create.
 * And turning back down the link just arrived on is a U-turn, legal only at a
 * dead end and only between kerbside lanes -- otherwise every junction in the
 * city offers a free turnaround and routes start using them.
 */
function permits(g: LaneGraph, a: number, b: number, deadEnd: Uint8Array): boolean {
  if ((g.use[a] & g.use[b]) === 0) return false;
  if (g.link[a] === g.link[b]) {
    if (g.dir[a] === g.dir[b]) return false;
    if (deadEnd[g.to[a]] === 0) return false;
    // A dead end turns round, whichever lane arrived -- requiring the kerbside
    // lane at both ends leaves the inner lane of a wide road with no
    // continuation at all, and a route that enters it is stuck there. Any lane
    // in, kerbside lane out: one movement each, and no trap.
    return g.index[b] === 0;
  }
  return true;
}

/** Bytes the graph occupies. */
export function laneBytes(g: LaneGraph): number {
  return g.link.byteLength + g.dir.byteLength + g.index.byteLength + g.use.byteLength
    + g.rank.byteLength
    + g.length.byteLength + g.speed.byteLength + g.free.byteLength
    + g.from.byteLength + g.to.byteLength
    + g.ax.byteLength + g.az.byteLength + g.bx.byteLength + g.bz.byteLength
    + g.itx.byteLength + g.itz.byteLength + g.etx.byteLength + g.etz.byteLength
    + g.stopBack.byteLength + g.startBack.byteLength
    + g.edgeStart.byteLength + g.edgeEnd.byteLength
    + g.edgeTo.byteLength + g.edgeTurn.byteLength + g.edgeCost.byteLength
    + g.linkStart.byteLength + g.linkEnd.byteLength;
}

/**
 * Where the lanes are, so a building can find the road it fronts onto.
 *
 * A uniform grid. Not a quadtree: lanes are spread fairly evenly over a city by
 * construction -- that is what a road network is -- and a grid answers "what is
 * near this point" in a handful of array reads with no pointer chasing and no
 * rebalancing. The one thing it must get right is that a long lane belongs in
 * every cell it passes through, or the motorway is invisible to everything that
 * is not standing near its midpoint.
 */
export interface LaneIndex {
  /** Metres a cell. */
  cell: number;
  /** Cells across, and the world coordinate of the grid's corner. */
  side: number;
  x0: number;
  z0: number;
  /** Compressed sparse row: cell c holds lanes [start[c], start[c + 1]). */
  start: Int32Array;
  lane: Int32Array;
}

export function buildLaneIndex(g: LaneGraph, cell = 48): LaneIndex {
  // Bounds from the lanes themselves, padded so a point just off the edge of
  // the network still lands in a cell.
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (let l = 0; l < g.count; l++) {
    x0 = Math.min(x0, g.ax[l], g.bx[l]); x1 = Math.max(x1, g.ax[l], g.bx[l]);
    z0 = Math.min(z0, g.az[l], g.bz[l]); z1 = Math.max(z1, g.az[l], g.bz[l]);
  }
  if (!Number.isFinite(x0)) { x0 = 0; z0 = 0; x1 = 0; z1 = 0; }
  x0 -= cell; z0 -= cell; x1 += cell; z1 += cell;
  const side = Math.max(1, Math.ceil(Math.max(x1 - x0, z1 - z0) / cell));

  // Walked twice: once to count what lands in each cell, once to fill. The walk
  // steps along the lane at half a cell so nothing is skipped, and skips a
  // repeat of the cell it is already in, which is most steps on a long lane.
  const counts = new Int32Array(side * side + 1);
  const visit = (l: number, fn: (c: number) => void): void => {
    const ax = g.ax[l], az = g.az[l], bx = g.bx[l], bz = g.bz[l];
    const d = Math.hypot(bx - ax, bz - az);
    const steps = Math.max(1, Math.ceil(d / (cell * 0.5)));
    let last = -1;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const gx = Math.min(side - 1, Math.max(0, ((ax + (bx - ax) * t) - x0) / cell | 0));
      const gz = Math.min(side - 1, Math.max(0, ((az + (bz - az) * t) - z0) / cell | 0));
      const c = gz * side + gx;
      if (c !== last) { fn(c); last = c; }
    }
  };
  for (let l = 0; l < g.count; l++) visit(l, (c) => { counts[c + 1]++; });
  for (let c = 0; c < side * side; c++) counts[c + 1] += counts[c];
  const start = counts;
  const lane = new Int32Array(start[side * side]);
  const at = start.slice(0, side * side);
  for (let l = 0; l < g.count; l++) visit(l, (c) => { lane[at[c]++] = l; });
  return { cell, side, x0, z0, start, lane };
}

/**
 * The nearest lane to a point that a given user may travel on, or -1.
 *
 * Rings outward from the point's own cell and stops as soon as the next ring
 * cannot possibly beat what has been found -- without that test it either
 * searches one ring and misses a lane just over the boundary, or searches a
 * fixed radius and does far more work than it needs to.
 */
export function nearestLane(g: LaneGraph, ix: LaneIndex, x: number, z: number,
  use: number, maxMetres = 400): number {
  const cx = Math.min(ix.side - 1, Math.max(0, (x - ix.x0) / ix.cell | 0));
  const cz = Math.min(ix.side - 1, Math.max(0, (z - ix.z0) / ix.cell | 0));
  const rings = Math.ceil(maxMetres / ix.cell);
  let best = -1, bestD = maxMetres * maxMetres;
  for (let r = 0; r <= rings; r++) {
    // Nothing in this ring can be closer than (r - 1) cells away.
    if (best >= 0 && ((r - 1) * ix.cell) ** 2 > bestD) break;
    const gz0 = Math.max(0, cz - r), gz1 = Math.min(ix.side - 1, cz + r);
    const gx0 = Math.max(0, cx - r), gx1 = Math.min(ix.side - 1, cx + r);
    for (let gz = gz0; gz <= gz1; gz++) {
      const edgeRow = gz === cz - r || gz === cz + r;
      for (let gx = gx0; gx <= gx1; gx++) {
        if (r > 0 && !edgeRow && gx !== cx - r && gx !== cx + r) continue;
        const c = gz * ix.side + gx;
        for (let i = ix.start[c]; i < ix.start[c + 1]; i++) {
          const l = ix.lane[i];
          if ((g.use[l] & use) === 0) continue;
          const d = pointToSegment(x, z, g.ax[l], g.az[l], g.bx[l], g.bz[l]);
          if (d < bestD) { bestD = d; best = l; }
        }
      }
    }
  }
  return best;
}

/** Squared distance from a point to a segment. */
function pointToSegment(px: number, pz: number,
  ax: number, az: number, bx: number, bz: number): number {
  const dx = bx - ax, dz = bz - az;
  const len = dx * dx + dz * dz;
  let t = len > 0 ? ((px - ax) * dx + (pz - az) * dz) / len : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const qx = ax + dx * t - px, qz = az + dz * t - pz;
  return qx * qx + qz * qz;
}

/** Bytes the index occupies. */
export function indexBytes(ix: LaneIndex): number {
  return ix.start.byteLength + ix.lane.byteLength;
}
