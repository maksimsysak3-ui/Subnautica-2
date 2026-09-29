/**
 * Shortest paths for the ambient traffic and the people on the pavements.
 *
 * The routine's travellers go through the router, which is budgeted for the
 * city's real trips and answers asynchronously. The scenery -- the cars and
 * walkers drawn to show the density the model believes in -- used to wander
 * at random instead, and a player watching one could tell: it circled, it
 * turned back, it never got anywhere. This gives each of them a real route to
 * a real door with an A* search over the same lane graph, bounded so that a
 * search that runs long gives up rather than stalls the tick.
 */

import type { LaneGraph } from './lanes';

/** What a search is for: which lanes it may use and what a lane costs. */
export interface Search {
  /** `Use` bits a lane must have. */
  use: number;
  /** Metres a second the estimate assumes, as fast as anything goes. */
  top: number;
  /** Seconds to travel a lane; the search adds the turn it took to get there. */
  cost(lane: number): number;
  /** Whether turn penalties count (driving) or not (walking). */
  turns: boolean;
}

/** Nodes a search may expand before it gives up. */
const MAX_EXPAND = 1500;

export class LanePlanner {
  private g: LaneGraph;
  private best = new Float32Array(0);
  private seen = new Int32Array(0);
  private came = new Int32Array(0);
  private run = 0;
  /** A binary heap of lanes keyed by their estimate. */
  private heapLane = new Int32Array(0);
  private heapKey = new Float32Array(0);
  private size = 0;
  /** Searches made and how many found a way, for the tests. */
  readonly stats = { searched: 0, found: 0 };

  constructor(g: LaneGraph) {
    this.g = g;
    this.resize();
  }

  rebind(g: LaneGraph): void {
    this.g = g;
    this.resize();
  }

  private resize(): void {
    const n = Math.max(1, this.g.count);
    this.best = new Float32Array(n);
    this.seen = new Int32Array(n);
    this.came = new Int32Array(n);
    this.heapLane = new Int32Array(n * 4);
    this.heapKey = new Float32Array(n * 4);
    this.run = 0;
  }

  /**
   * The lanes from `start` to any lane of `goalLink` that `s` allows, start
   * and end included; or null if there is none within the search's reach.
   */
  plan(start: number, goalLink: number, s: Search): Int32Array | null {
    const g = this.g;
    if (start < 0 || start >= g.count || goalLink < 0 || goalLink * 2 >= g.linkStart.length) return null;
    this.stats.searched++;
    // Where the goal is, for the estimate: the middle of its road.
    let gl = -1;
    for (let d = 0; d < 2 && gl < 0; d++) {
      for (let l = g.linkStart[goalLink * 2 + d]; l < g.linkEnd[goalLink * 2 + d]; l++) {
        if ((g.use[l] & s.use) !== 0) { gl = l; break; }
      }
    }
    if (gl < 0) return null;
    const gx = (g.ax[gl] + g.bx[gl]) * 0.5, gz = (g.az[gl] + g.bz[gl]) * 0.5;

    const run = ++this.run;
    this.size = 0;
    this.best[start] = 0;
    this.seen[start] = run;
    this.came[start] = -1;
    this.push(start, 0);
    let expanded = 0;
    while (this.size > 0 && expanded < MAX_EXPAND) {
      const lane = this.pop();
      expanded++;
      if (g.link[lane] === goalLink) {
        this.stats.found++;
        return this.trace(lane);
      }
      const here = this.best[lane];
      for (let e = g.edgeStart[lane]; e < g.edgeEnd[lane]; e++) {
        const o = g.edgeTo[e];
        if (o < 0 || o >= g.count || (g.use[o] & s.use) === 0) continue;
        const step = s.cost(o) + (s.turns ? g.edgeCost[e] : 0);
        const cost = here + Math.max(0.01, step);
        if (this.seen[o] === run && cost >= this.best[o]) continue;
        this.seen[o] = run;
        this.best[o] = cost;
        this.came[o] = lane;
        const h = Math.hypot(g.bx[o] - gx, g.bz[o] - gz) / s.top;
        this.push(o, cost + h);
      }
    }
    return null;
  }

  private trace(end: number): Int32Array {
    const out: number[] = [];
    for (let l = end; l >= 0 && out.length < 4096; l = this.came[l]) out.push(l);
    out.reverse();
    return Int32Array.from(out);
  }

  private push(lane: number, key: number): void {
    if (this.size >= this.heapLane.length) return;   // full: the search is long enough
    let i = this.size++;
    while (i > 0) {
      const up = (i - 1) >> 1;
      if (this.heapKey[up] <= key) break;
      this.heapLane[i] = this.heapLane[up];
      this.heapKey[i] = this.heapKey[up];
      i = up;
    }
    this.heapLane[i] = lane;
    this.heapKey[i] = key;
  }

  private pop(): number {
    const top = this.heapLane[0];
    const n = --this.size;
    const lane = this.heapLane[n], key = this.heapKey[n];
    let i = 0;
    for (;;) {
      let c = i * 2 + 1;
      if (c >= n) break;
      if (c + 1 < n && this.heapKey[c + 1] < this.heapKey[c]) c++;
      if (this.heapKey[c] >= key) break;
      this.heapLane[i] = this.heapLane[c];
      this.heapKey[i] = this.heapKey[c];
      i = c;
    }
    this.heapLane[i] = lane;
    this.heapKey[i] = key;
    return top;
  }
}

/**
 * How far along a lane a building's door is, in metres, from where the lane
 * starts: the point on the lane's chord nearest (`x`, `z`).
 */
export function doorAlong(g: LaneGraph, lane: number, x: number, z: number): number {
  const dx = g.bx[lane] - g.ax[lane], dz = g.bz[lane] - g.az[lane];
  const len2 = dx * dx + dz * dz || 1;
  const t = Math.max(0.05, Math.min(0.95, ((x - g.ax[lane]) * dx + (z - g.az[lane]) * dz) / len2));
  return t * g.length[lane];
}
