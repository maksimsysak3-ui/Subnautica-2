/**
 * Routing over the lane graph.
 *
 * One A* that every kind of traveller shares, differing only in a profile: what
 * it may use, how fast it goes, how much it minds a turn, and how much it minds
 * traffic. An ambulance and a pedestrian are the same search with different
 * numbers, which is the only way a dozen modes stay correct -- a separate
 * routing implementation per mode is a dozen places for one bug to hide, and in
 * practice one of them always ends up walking down the motorway.
 *
 * Three things make it fast enough to run a city on.
 *
 * Nothing is allocated per query. The scratch arrays are sized to the graph once
 * and reused, and "has this lane been seen" is a query stamp rather than a clear
 * -- clearing a hundred thousand floats before each of two hundred searches a
 * second is more work than the searches.
 *
 * The heuristic is time, not distance: straight-line metres over the fastest
 * speed the traveller could possibly manage. That is admissible, so the first
 * path found is the best one, and it is far better informed than distance alone
 * because it knows a motorway detour can beat a direct crawl.
 *
 * And a long trip is not allowed to wander. Past a few hundred metres from both
 * ends, the search only expands roads that go somewhere -- which is what a
 * driver does, and it is the difference between expanding a thousand lanes and
 * expanding forty thousand. If that finds nothing, the search is run again
 * without the restriction, so the shortcut can never make a reachable
 * destination unreachable.
 */

import { Use } from './lanes';
import type { LaneGraph } from './lanes';

/** Who is travelling. */
export const Layer = {
  FOOT: 0,
  BIKE: 1,
  CAR: 2,
  BUS: 3,
  TRAM: 4,
  EMERGENCY: 5,
  CARGO: 6,
} as const;
export type LayerValue = typeof Layer[keyof typeof Layer];
export const LAYERS = 7;

/** No path, and no path handle. */
export const NO_PATH = -1;

export interface Profile {
  /** The lane must admit this. */
  use: number;
  /** Metres a second this traveller cannot exceed, whatever the road allows. */
  top: number;
  /**
   * How much of a junction's turn cost this traveller actually pays.
   *
   * A pedestrian crossing at a junction waits for a light, not for a gap in the
   * traffic, so the difference between their left turn and their right one is
   * nothing like a driver's. An ambulance with its lights on pays a fraction:
   * the traffic gives way, which is the whole point of it.
   */
  turn: number;
  /**
   * How much of a lane's congestion this traveller feels.
   *
   * Zero on foot -- a pavement does not jam because the road beside it does.
   * Low for an emergency vehicle, which uses the oncoming lane and the hard
   * shoulder, but not zero, because a genuinely gridlocked street stops
   * everything.
   */
  jam: number;
  /**
   * Seconds a kilometre added for a road below arterial rank, and for one at or
   * above it.
   *
   * The pair is what keeps lorries off residential streets and cyclists off dual
   * carriageways without forbidding either -- a delivery still reaches a shop on
   * a back street, it just does not use the back street as a through route.
   *
   * Both are costs and neither is ever a discount, which matters more than it
   * looks: the heuristic is straight-line metres over the traveller's top speed,
   * and that is only a lower bound on the true remaining cost while nothing can
   * make a lane cheaper than its length at that speed. One negative number here
   * and A* stops returning best paths, silently, on some trips and not others.
   */
  minorPenalty: number;
  majorPenalty: number;
}

const PROFILES: Profile[] = [];
/* eslint-disable @typescript-eslint/no-magic-numbers */
PROFILES[Layer.FOOT] = { use: Use.FOOT, top: 1.4, turn: 0.25, jam: 0, minorPenalty: 0, majorPenalty: 20 };
PROFILES[Layer.BIKE] = { use: Use.BIKE, top: 5.5, turn: 0.4, jam: 0.15, minorPenalty: 0, majorPenalty: 14 };
PROFILES[Layer.CAR] = { use: Use.CAR, top: 40, turn: 1, jam: 1, minorPenalty: 8, majorPenalty: 0 };
PROFILES[Layer.BUS] = { use: Use.BUS, top: 25, turn: 1.1, jam: 0.9, minorPenalty: 30, majorPenalty: 0 };
PROFILES[Layer.TRAM] = { use: Use.TRAM, top: 20, turn: 1, jam: 0.3, minorPenalty: 0, majorPenalty: 0 };
PROFILES[Layer.EMERGENCY] = { use: Use.EMERGENCY, top: 40, turn: 0.35, jam: 0.3, minorPenalty: 2, majorPenalty: 0 };
PROFILES[Layer.CARGO] = { use: Use.CARGO, top: 25, turn: 1.4, jam: 1, minorPenalty: 45, majorPenalty: 0 };

export const profileOf = (layer: number): Profile => PROFILES[layer];

/** Below this rank a road is not a through route. */
const THROUGH_RANK = 2;
/**
 * Metres from either end within which any road may be used, tried in order.
 *
 * Three attempts rather than one, because the tight window fails on about one
 * long trip in seven -- a destination in a corner of the map with no arterial
 * near it, an industrial estate reached only through an estate road -- and the
 * cost of being wrong matters. Widening to two kilometres finds almost all of
 * them while still searching a fraction of the city; only what survives that
 * gets an unrestricted search, and by then the trip really is unusual.
 *
 * The last entry is 0, which means no restriction at all.
 */
const WINDOWS = [550, 2200, 0];
/** Below this trip length the restriction is pointless -- it is all local. */
const LOCAL_TRIP = WINDOWS[0] * 2;

/** Lanes expanded before a search gives up. Generous: a real failure is rare. */
const MAX_EXPAND = 60_000;

/** How a search ended. */
export const Outcome = {
  FOUND: 0,
  UNREACHABLE: 1,
  /** Hit the expansion cap. The destination may still be reachable. */
  EXHAUSTED: 2,
  /** The path was longer than the buffer it was asked to write into. */
  TOO_LONG: 3,
} as const;

/**
 * A binary min-heap on flat arrays.
 *
 * Lazy deletion rather than decrease-key: a lane whose cost improves is pushed
 * again and the stale copy is skipped when it surfaces. That trades a larger
 * heap for never having to know where in it a lane sits, which in a search that
 * touches thousands of lanes is much the better deal.
 */
class Heap {
  private key: Float32Array;
  private val: Int32Array;
  private n = 0;

  constructor(capacity: number) {
    this.key = new Float32Array(capacity);
    this.val = new Int32Array(capacity);
  }

  get size(): number { return this.n; }
  clear(): void { this.n = 0; }

  push(k: number, v: number): void {
    if (this.n === this.key.length) {
      const key = new Float32Array(this.n * 2); key.set(this.key); this.key = key;
      const val = new Int32Array(this.n * 2); val.set(this.val); this.val = val;
    }
    let i = this.n++;
    const key = this.key, val = this.val;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (key[p] <= k) break;
      key[i] = key[p]; val[i] = val[p];
      i = p;
    }
    key[i] = k; val[i] = v;
  }

  /** The smallest value, with its key left in `topKey`. */
  topKey = 0;
  pop(): number {
    const key = this.key, val = this.val;
    this.topKey = key[0];
    const out = val[0];
    const n = --this.n;
    if (n === 0) return out;
    const lk = key[n], lv = val[n];
    let i = 0;
    for (;;) {
      const l = i * 2 + 1;
      if (l >= n) break;
      const r = l + 1;
      const c = r < n && key[r] < key[l] ? r : l;
      if (key[c] >= lk) break;
      key[i] = key[c]; val[i] = val[c];
      i = c;
    }
    key[i] = lk; val[i] = lv;
    return out;
  }
}

/**
 * The searcher. One per graph; reused for every query.
 *
 * Held rather than called as a function because the scratch is the expensive
 * part, and it is sized to the graph. A road edit replaces the graph, so it
 * replaces this too -- cheaper than trying to resize six arrays in step.
 */
export class Pathfinder {
  private readonly g: LaneGraph;
  private readonly gs: Float32Array;
  private readonly came: Int32Array;
  /** The query that last touched a lane: a stamp, so there is nothing to clear. */
  private readonly seen: Int32Array;
  private readonly shut: Int32Array;
  private readonly heap: Heap;
  private query = 0;

  /** The fastest anything travels here, for the heuristic. */
  private readonly topSpeed: number;

  /** Filled in by the last `find`. */
  outcome: number = Outcome.FOUND;
  /** Seconds the last path takes at free flow plus the load it was given. */
  seconds = 0;
  /** Lanes expanded by the last search, for the budget readout. */
  expanded = 0;
  /** Narrowed searches run, how many needed a wider window, and how many
   * ended up unrestricted. */
  restricted = 0;
  widened = 0;
  fallbacks = 0;

  constructor(g: LaneGraph, readonly epsilon = 1.45) {
    this.g = g;
    const n = Math.max(1, g.count);
    this.gs = new Float32Array(n);
    this.came = new Int32Array(n);
    this.seen = new Int32Array(n);
    this.shut = new Int32Array(n);
    this.heap = new Heap(Math.min(n, 4096));
    let top = 1;
    for (let l = 0; l < g.count; l++) if (g.speed[l] > top) top = g.speed[l];
    this.topSpeed = top;
  }

  /**
   * Routes from one lane to another.
   *
   * Writes the lanes travelled, origin first, into `out` and returns how many.
   * On failure returns 0 and leaves the reason in `outcome`. `load` is per-lane
   * saturation -- 0 for a clear road, 1 for one at capacity -- and may be null
   * while nothing is measuring it.
   */
  find(layer: number, from: number, to: number, out: Int32Array,
    load: Float32Array | null = null): number {
    const g = this.g;
    if (from < 0 || to < 0 || from >= g.count || to >= g.count) {
      this.outcome = Outcome.UNREACHABLE; this.seconds = 0; this.expanded = 0;
      return 0;
    }
    const p = PROFILES[layer];
    if ((g.use[from] & p.use) === 0 || (g.use[to] & p.use) === 0) {
      this.outcome = Outcome.UNREACHABLE; this.seconds = 0; this.expanded = 0;
      return 0;
    }
    // Far apart, so narrow the search first; near, so do not bother.
    const sx = g.bx[to] - g.ax[from], sz = g.bz[to] - g.az[from];
    const span = Math.sqrt(sx * sx + sz * sz);
    if (span > LOCAL_TRIP) {
      this.restricted++;
      let total = 0;
      for (let w = 0; w < WINDOWS.length - 1; w++) {
        const n = this.search(layer, from, to, out, load, WINDOWS[w]);
        total += this.expanded;
        if (n > 0) { this.expanded = total; return n; }
        if (this.outcome === Outcome.TOO_LONG) return 0;
        this.widened++;
      }
      this.widened -= WINDOWS.length - 1;
      this.fallbacks++;
      const n = this.search(layer, from, to, out, load, 0);
      this.expanded += total;
      return n;
    }
    return this.search(layer, from, to, out, load, 0);
  }

  private search(layer: number, from: number, to: number, out: Int32Array,
    load: Float32Array | null, window: number): number {
    const g = this.g;
    const p = PROFILES[layer];
    const gs = this.gs, came = this.came, seen = this.seen, shut = this.shut;
    const heap = this.heap;
    const q = ++this.query;
    heap.clear();

    // Everything the inner loop touches, in a local.
    //
    // This is not tidiness. Each `g.length[o]` inside the loop is a load of the
    // object's property table before the array index, and the loop runs a few
    // million times a second; hoisting the columns and inlining the two helpers
    // into it is worth about half the search time, which is the difference
    // between routing a city and routing a town.
    const use = g.use, rank = g.rank, len = g.length, spd = g.speed;
    const ax = g.ax, az = g.az, bx = g.bx, bz = g.bz;
    const eFrom = g.edgeStart, eTo = g.edgeEnd, eLane = g.edgeTo, eCost = g.edgeCost;
    const want = p.use, turnScale = p.turn, top = p.top, jam = p.jam;
    const minor = p.minorPenalty, major = p.majorPenalty;
    const jams = jam > 0 ? load : null;

    const vmax = this.topSpeed < top ? this.topSpeed : top;
    const invV = this.epsilon / vmax;
    const tx = bx[to], tz = bz[to];
    // The two places local travel actually happens: where the traveller leaves
    // its origin lane, and where it joins its destination lane. Anchoring the
    // window on the *far* ends instead -- where the origin lane starts and the
    // destination lane finishes -- is wrong by the length of those lanes, and a
    // lane can be a kilometre long. It made the restriction block the approach
    // to the destination entirely on two trips in five, so those trips searched
    // the whole arterial network, failed, and then searched again unrestricted.
    const exitX = bx[from], exitZ = bz[from];
    const joinX = ax[to], joinZ = az[to];
    const localSq = window * window;
    const restrict = window > 0;

    // Seconds to drive a lane, inlined.
    const travel = (l: number): number => {
      const v = spd[l] < top ? spd[l] : top;
      let t = len[l] / v;
      if (jams !== null) t += t * jams[l] * jam;
      return t + (len[l] * 0.001) * (rank[l] < THROUGH_RANK ? minor : major);
    };

    const g0 = travel(from);
    gs[from] = g0; came[from] = -1; seen[from] = q;
    {
      const dx = bx[from] - tx, dz = bz[from] - tz;
      heap.push(g0 + Math.sqrt(dx * dx + dz * dz) * invV, from);
    }

    let expanded = 0;
    while (heap.size > 0) {
      const l = heap.pop();
      if (shut[l] === q) continue;        // a stale copy of an improved lane
      shut[l] = q;
      if (l === to) {
        this.expanded = expanded;
        this.seconds = gs[l];
        return this.unwind(from, to, out);
      }
      if (++expanded >= MAX_EXPAND) {
        this.outcome = Outcome.EXHAUSTED; this.expanded = expanded; this.seconds = 0;
        return 0;
      }
      const base = gs[l];
      for (let e = eFrom[l], stop = eTo[l]; e < stop; e++) {
        const o = eLane[e];
        if (shut[o] === q) continue;
        if ((use[o] & want) === 0) continue;
        if (restrict && rank[o] < THROUGH_RANK && o !== to) {
          // Where the traveller would *enter* this lane, which is the point the
          // question is about: a back road is fine to turn onto near either end
          // of the trip, and wherever it then runs is a road, not a detour.
          const mx = ax[o], mz = az[o];
          const dx0 = mx - exitX, dz0 = mz - exitZ;
          if (dx0 * dx0 + dz0 * dz0 > localSq) {
            const dx1 = mx - joinX, dz1 = mz - joinZ;
            if (dx1 * dx1 + dz1 * dz1 > localSq) continue;
          }
        }
        const cost = base + eCost[e] * turnScale + travel(o);
        if (seen[o] === q && gs[o] <= cost) continue;
        gs[o] = cost; came[o] = l; seen[o] = q;
        const hx = bx[o] - tx, hz = bz[o] - tz;
        heap.push(cost + Math.sqrt(hx * hx + hz * hz) * invV, o);
      }
    }
    this.outcome = Outcome.UNREACHABLE; this.expanded = expanded; this.seconds = 0;
    return 0;
  }

  /**
   * Walks the came-from chain into `out`, origin first.
   *
   * Written backwards from the destination and then reversed in place, because
   * the chain only runs one way and the caller wants the other.
   */
  private unwind(from: number, to: number, out: Int32Array): number {
    const came = this.came;
    let n = 0;
    for (let l = to; l !== -1; l = came[l]) {
      if (n >= out.length) { this.outcome = Outcome.TOO_LONG; return 0; }
      out[n++] = l;
      if (l === from) break;
    }
    for (let i = 0, j = n - 1; i < j; i++, j--) {
      const t = out[i]; out[i] = out[j]; out[j] = t;
    }
    this.outcome = Outcome.FOUND;
    return n;
  }

  /** Bytes of scratch, for the budget readout. */
  bytes(): number {
    return this.gs.byteLength + this.came.byteLength
      + this.seen.byteLength + this.shut.byteLength;
  }
}
