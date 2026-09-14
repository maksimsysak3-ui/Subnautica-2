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
 * Which side traffic drives on. 1 for the right, -1 for the left.
 *
 * It decides only which of a carriageway's lanes is the kerbside one, and so
 * which turn each lane naturally serves. Nothing else in here cares.
 */
const DRIVE = 1;

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
  /** Metres. */
  length: Float32Array;
  /** Metres a second. */
  speed: Float32Array;
  /** Seconds to traverse when empty: length / speed, precomputed. */
  free: Float32Array;
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
    length: new Float32Array(count), speed: new Float32Array(count),
    free: new Float32Array(count),
    from: new Int32Array(count), to: new Int32Array(count),
    ax: new Float32Array(count), az: new Float32Array(count),
    bx: new Float32Array(count), bz: new Float32Array(count),
    itx: new Float32Array(count), itz: new Float32Array(count),
    etx: new Float32Array(count), etz: new Float32Array(count),
    edgeStart: new Int32Array(count), edgeEnd: new Int32Array(count),
    edgeTo: new Int32Array(0), edgeTurn: new Uint8Array(0),
    edgeCost: new Float32Array(0), edgeCount: 0,
    linkStart, linkEnd,
  };

  // Pass two: make the lanes.
  let at = 0;
  for (let i = 0; i < links.length; i++) {
    const link = links[i];
    const spec = ROAD_SPECS[link.cls];
    const pts = net.samples(link);
    const total = pts[pts.length - 1].s;
    const a = net.nodes[link.a], b = net.nodes[link.b];
    // The road's own tangent at each end, so a curve's arms meet at the angle
    // they actually meet at. Backward lanes travel the other way, so both
    // components flip.
    const head = pts[0], tail = pts[pts.length - 1];
    const n = routeLanes(link.cls);
    const use = admits(link.cls);
    const v = speedOf(link.cls);
    const dirs = spec.oneWay ? [FORWARD] : [FORWARD, BACKWARD];
    for (const d of dirs) {
      const slot = i * 2 + d;
      linkStart[slot] = at;
      for (let k = 0; k < n; k++) {
        g.link[at] = i; g.dir[at] = d; g.index[at] = k; g.use[at] = use;
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
  return g;
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
    + g.length.byteLength + g.speed.byteLength + g.free.byteLength
    + g.from.byteLength + g.to.byteLength
    + g.ax.byteLength + g.az.byteLength + g.bx.byteLength + g.bz.byteLength
    + g.itx.byteLength + g.itz.byteLength + g.etx.byteLength + g.etz.byteLength
    + g.edgeStart.byteLength + g.edgeEnd.byteLength
    + g.edgeTo.byteLength + g.edgeTurn.byteLength + g.edgeCost.byteLength
    + g.linkStart.byteLength + g.linkEnd.byteLength;
}
