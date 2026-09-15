/**
 * Service coverage: how long it takes somebody to reach you.
 *
 * Every city builder measures this as a circle round the fire station, and every
 * city builder is wrong about it in the same way: a station across the river from a
 * district covers it on the map and cannot reach it in eight minutes. A circle is a
 * statement about distance and what a service has is a *response time*, which is a
 * statement about the road network -- so that is what this measures.
 *
 * The algorithm is a multi-source Dijkstra over the lane graph, run outward from
 * every station of a branch at once, giving every lane in the city its travel time
 * to the nearest one. It is the right shape for the question: one search answers it
 * for the whole map rather than one per building, the answer is exact rather than a
 * radius, and a district reachable only by a long way round reads as badly covered,
 * which it is.
 *
 * TWO WAYS TO BE BADLY SERVED, and keeping them apart is most of what makes the
 * readout useful. A building can be too far from a station, or the stations can be
 * too full. They want completely different things from the player -- another
 * station over there, or a bigger one here -- and a single coverage number cannot
 * tell them apart. So distance and capacity are computed separately and the worse
 * of the two is what the building feels.
 *
 * THE SEARCH IS BUDGETED. A city has tens of thousands of lanes and eleven
 * branches, and doing all of them at once is tens of milliseconds on one tick. So
 * it runs one branch at a time, a bounded number of lanes per visit, and moves on
 * when it finishes -- the same pattern as the router. Coverage is therefore a few
 * seconds stale, which is invisible: nobody places a fire station and watches the
 * map that closely.
 */

import { Heap, Layer, profileOf } from './path';
import { Places, Purpose } from './places';
import { BRANCHES } from '../../assets/types';
import type { LaneGraph } from './lanes';
import { Use } from './lanes';

/** Minutes past which a lane counts as not covered at all. */
export const UNREACHED = 255;

interface Standard {
  /** Minutes within which a service is as good as it gets. */
  good: number;
  /** And beyond which it is no use. */
  worst: number;
  /** People one unit of the building's capacity looks after. */
  per: number;
  /** Who needs it: everybody, or only the children. */
  who: 'all' | 'children' | 'jobs';
}

/**
 * What each service is expected to manage.
 *
 * Response times first, because they are the numbers with a right answer. A fire
 * engine is expected at a fire in about five minutes and is no use at fifteen; an
 * ambulance about the same; police rather longer; a school is somewhere children go
 * rather than something that comes to them, so its standard is a journey rather
 * than a response, and a library longer still. These are real service standards and
 * they are the reason the branches feel different to play with rather than being
 * eleven copies of one mechanic.
 */
const STANDARD: Record<string, Standard> = {
  fire: { good: 3, worst: 9, per: 2600, who: 'all' },
  health: { good: 4, worst: 12, per: 1, who: 'all' },
  police: { good: 5, worst: 15, per: 1800, who: 'all' },
  education: { good: 9, worst: 22, per: 1, who: 'children' },
  parks: { good: 6, worst: 16, per: 1400, who: 'all' },
  transport: { good: 5, worst: 13, per: 900, who: 'all' },
  deathcare: { good: 10, worst: 28, per: 4200, who: 'all' },
  post: { good: 10, worst: 30, per: 3000, who: 'all' },
  government: { good: 12, worst: 34, per: 9000, who: 'all' },
  water: { good: 99, worst: 99, per: 1, who: 'all' },
  power: { good: 99, worst: 99, per: 1, who: 'all' },
};

/** Branches whose coverage is a network rather than a response time. */
const PIPED = new Set(['water', 'power']);

/** Lanes expanded per visit. Bounded, so the tick cost never depends on the city. */
const SEARCH_BUDGET = 4000;

/** How a branch is doing. */
export interface Cover {
  branch: string;
  /** Stations built, and what they can between them look after. */
  stations: number;
  capacity: number;
  /** How many people want it. */
  demand: number;
  /** Capacity over demand. Below one means build a bigger one. */
  capacityRatio: number;
  /** Share of homes within the good time, and within the worst. */
  wellServed: number;
  served: number;
  /** Mean minutes from a home to the nearest one. */
  meanMinutes: number;
  /** Homes that cannot reach one at all. */
  unreachable: number;
}

export class Services {
  /** Minutes to the nearest station of each branch, per lane. */
  readonly minutes: Float32Array[] = [];
  /** The search in progress, per branch. */
  private readonly dist: Float32Array[] = [];
  private readonly heap: Heap;
  /** Which branch is being searched, and whether it has finished. */
  private turn = 0;
  private running = false;
  readonly cover: Cover[] = [];

  constructor(readonly places: Places, private g: LaneGraph) {
    for (let b = 0; b < BRANCHES.length; b++) {
      this.minutes.push(new Float32Array(g.count).fill(UNREACHED));
      this.dist.push(new Float32Array(g.count).fill(Infinity));
      this.cover.push({
        branch: BRANCHES[b], stations: 0, capacity: 0, demand: 0, capacityRatio: 1,
        wellServed: 0, served: 0, meanMinutes: UNREACHED, unreachable: 1,
      });
    }
    this.heap = new Heap(4096);
  }

  /** Minutes from a place to the nearest station of a branch. */
  minutesAt(place: number, branch: number): number {
    const lane = this.places.col.lane[place];
    if (lane < 0 || branch < 0 || branch >= this.minutes.length) return UNREACHED;
    const m = this.minutes[branch];
    return lane < m.length ? m[lane] : UNREACHED;
  }

  /**
   * How well a place is served by a branch, 0 to 1.
   *
   * The worse of how far away the nearest station is and how overloaded the
   * stations are, because a service that is near and full is no better than one
   * that is empty and unreachable -- and the player needs to be told which.
   */
  at(place: number, branch: number): number {
    if (branch < 0 || branch >= this.cover.length) return 0;
    const name = BRANCHES[branch];
    if (PIPED.has(name)) return 0;              // utilities answer this themselves
    const std = STANDARD[name];
    if (std === undefined) return 0;
    const m = this.minutesAt(place, branch);
    if (m >= UNREACHED) return 0;
    const near = m <= std.good ? 1
      : m >= std.worst ? 0
        : 1 - (m - std.good) / (std.worst - std.good);
    const full = Math.min(1, this.cover[branch].capacityRatio);
    return Math.min(near, full);
  }

  /** The same, by branch name. */
  byName(place: number, branch: string): number {
    return this.at(place, BRANCHES.indexOf(branch as never));
  }

  /**
   * Spends a little time on the coverage searches.
   *
   * One branch at a time, a bounded number of lanes per visit. Between branches it
   * totals capacity against demand, which is cheap and has to happen somewhere.
   */
  refresh(population: number, children: number, jobs: number,
    budget = SEARCH_BUDGET): void {
    if (!this.running) this.begin(population, children, jobs);
    if (!this.running) return;
    if (this.step(budget)) {
      this.finish();
      this.turn = (this.turn + 1) % BRANCHES.length;
      this.running = false;
    }
  }

  /** Starts the next branch's search from all of its stations at once. */
  private begin(population: number, children: number, jobs: number): void {
    const b = this.turn;
    const name = BRANCHES[b];
    const std = STANDARD[name];
    const cov = this.cover[b];
    const pool = this.places.byBranch[b];
    const c = this.places.col;

    // Capacity and demand, which are wanted whether or not the search runs.
    let stations = 0, capacity = 0;
    for (let i = 0; i < pool.size; i++) {
      const p = pool.member(i);
      stations++;
      capacity += c.serves[p] > 0 ? c.serves[p] : 1;
    }
    cov.stations = stations;
    cov.capacity = capacity;
    if (std !== undefined) {
      cov.demand = std.who === 'children' ? children : std.who === 'jobs' ? jobs : population;
      const need = cov.demand / Math.max(1, std.per);
      cov.capacityRatio = need <= 0 ? 1 : Math.min(4, capacity / need);
    }
    if (PIPED.has(name) || stations === 0) {
      this.minutes[b].fill(UNREACHED);
      cov.wellServed = 0; cov.served = 0;
      cov.meanMinutes = UNREACHED; cov.unreachable = 1;
      this.turn = (this.turn + 1) % BRANCHES.length;
      return;
    }

    const dist = this.dist[b];
    dist.fill(Infinity);
    this.heap.clear();
    // Every station seeds the search at the lane it fronts onto, at zero. A
    // multi-source Dijkstra is the same algorithm as a single-source one with
    // several starting points, which is why this costs one search rather than one
    // per station -- the thing that makes exact coverage affordable at all.
    for (let i = 0; i < pool.size; i++) {
      const p = pool.member(i);
      const lane = c.lane[p];
      if (lane < 0 || lane >= dist.length) continue;
      if (dist[lane] > 0) { dist[lane] = 0; this.heap.push(0, lane); }
    }
    this.running = this.heap.size > 0;
    if (!this.running) {
      this.minutes[b].fill(UNREACHED);
      cov.wellServed = 0; cov.served = 0;
      cov.meanMinutes = UNREACHED; cov.unreachable = 1;
      this.turn = (this.turn + 1) % BRANCHES.length;
    }
  }

  /**
   * Continues the current search. True when it is done.
   *
   * Outward along the lanes the service travels on, at the speed it travels. An
   * emergency vehicle does not obey the limit and is not held up the way a car is,
   * which is why the emergency profile rather than the car one -- a fire station's
   * reach is bigger than a resident's commute over the same roads.
   */
  private step(budget: number): boolean {
    const b = this.turn;
    const name = BRANCHES[b];
    const g = this.g;
    const dist = this.dist[b];
    const heap = this.heap;
    // Fire, health and police travel as emergencies; a school run and a bin lorry
    // do not, and parks are reached on foot.
    const layer = name === 'fire' || name === 'health' || name === 'police'
      ? Layer.EMERGENCY : name === 'parks' ? Layer.FOOT : Layer.CAR;
    const p = profileOf(layer);
    const want = p.use;
    let spent = 0;

    while (heap.size > 0) {
      const l = heap.pop();
      const d = heap.topKey;
      if (d > dist[l] + 1e-6) continue;
      if (++spent >= budget) return false;
      for (let e = g.edgeStart[l]; e < g.edgeEnd[l]; e++) {
        const o = g.edgeTo[e];
        if ((g.use[o] & want) === 0) continue;
        const v = Math.min(g.speed[o], p.top);
        const next = d + g.length[o] / v + g.edgeCost[e] * p.turn;
        if (next < dist[o]) { dist[o] = next; heap.push(next, o); }
      }
    }
    return true;
  }

  /** Turns the finished search into minutes and totals how the branch did. */
  private finish(): void {
    const b = this.turn;
    const dist = this.dist[b];
    const mins = this.minutes[b];
    for (let l = 0; l < mins.length; l++) {
      const d = dist[l];
      mins[l] = d === Infinity ? UNREACHED : Math.min(UNREACHED - 1, d / 60);
    }
    const std = STANDARD[BRANCHES[b]];
    const cov = this.cover[b];
    if (std === undefined) return;
    const c = this.places.col;
    let homes = 0, well = 0, some = 0, sum = 0, lost = 0;
    for (let p = 0; p < this.places.count; p++) {
      if (this.places.live[p] === 0 || c.purpose[p] !== Purpose.HOME) continue;
      homes++;
      const m = this.minutesAt(p, b);
      if (m >= UNREACHED) { lost++; continue; }
      sum += m;
      if (m <= std.good) well++;
      if (m < std.worst) some++;
    }
    cov.wellServed = homes > 0 ? well / homes : 0;
    cov.served = homes > 0 ? some / homes : 0;
    cov.meanMinutes = homes - lost > 0 ? sum / (homes - lost) : UNREACHED;
    cov.unreachable = homes > 0 ? lost / homes : 0;
  }

  /** The roads changed: every lane index is void, so every search is. */
  rebind(g: LaneGraph): void {
    this.g = g;
    for (let b = 0; b < BRANCHES.length; b++) {
      this.minutes[b] = new Float32Array(g.count).fill(UNREACHED);
      this.dist[b] = new Float32Array(g.count).fill(Infinity);
    }
    this.running = false;
  }

  /** The standard a branch is held to, for the readout. */
  standardOf(branch: string): Standard | undefined { return STANDARD[branch]; }

  bytes(): number {
    let n = 0;
    for (const a of this.minutes) n += a.byteLength;
    for (const a of this.dist) n += a.byteLength;
    return n;
  }
}

export { Use, BRANCHES };
