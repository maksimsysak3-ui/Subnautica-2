/**
 * Service coverage: what a station reaches, and whether it can cope with it.
 *
 * A fire station, a school, a clinic and a park all answer the same two questions
 * and they are answered here: is there one near enough, and is it full. Everything
 * else about a branch -- how far "near enough" is, who needs it, how many people
 * one of them looks after -- is a row in `STANDARD`, which is why eleven services
 * cost one system rather than eleven.
 *
 * COVERAGE IS AN AREA, NOT A ROUTE. A station covers the ground around it, full
 * strength out to its catchment and fading to nothing at its edge. That is what a
 * service catchment is, and it is also what a player can reason about while
 * placing one: you can see where the circle will land. The roads carry traffic and
 * they carry the water, sewage and power mains -- those genuinely are networks and
 * are modelled as networks -- but a school does not serve you less because the road
 * to it bends.
 *
 * TWO WAYS TO BE BADLY SERVED, and keeping them apart is most of what makes the
 * readout useful. You can be outside every catchment, or inside a catchment whose
 * station is swamped. They want completely different things from the player --
 * another one over there, or a bigger one here -- so distance and load are computed
 * separately and the worse of the two is what a building feels.
 *
 * LOAD IS PER STATION, NOT PER CITY. A city-wide ratio of capacity to population
 * says a city with two big schools in one district and none in the other is fine,
 * which is exactly the mistake the player is trying to find. So each station sums
 * the people actually inside its own catchment and is judged on that, and a
 * district's coverage is cut by the load of the station covering *it*.
 *
 * HOW IT IS AFFORDABLE. Everything is done on a coarse grid rather than per
 * building: demand is summed into cells once, each station reads its catchment out
 * of that in one pass over its own disc, and coverage is stamped back into another
 * grid. One branch is done per visit, so the per-tick cost is a few stations'
 * discs -- it does not grow with the population at all, and it is the reason the
 * whole thing costs microseconds on a city of a hundred thousand.
 */

import { Places, Purpose, TIER_REACH } from './places';
import { BRANCHES } from '../../assets/types';
import type { Branch } from '../../assets/types';
import { Use } from './lanes';
import { Policies, NO_POLICIES } from '../policies';

/**
 * Reported where a building is outside every catchment.
 *
 * A distance, in metres, and far larger than any map. It used to be 255, which was
 * right when this measured minutes and silently wrong the moment it measured
 * metres: every catchment was clipped to two hundred and fifty-five metres,
 * because a cell further than that never beat the sentinel it was compared with.
 * The coverage grid was correct throughout and the reported distances were not,
 * which is exactly the kind of bug that survives a screenshot.
 */
export const UNREACHED = 1e6;

/**
 * Cells across the coverage grid.
 *
 * Coarser than the view grid on purpose. A catchment is hundreds of metres across
 * and its edge is a soft judgement, so resolving it to twenty-seven metres would
 * be spending sixteen times the work to answer the question no more truthfully.
 * The views upsample this, and the upsampling is invisible because the falloff is
 * smooth to begin with.
 */
export const SERVICE_GRID = 96;

interface Standard {
  /** Metres within which the service is as good as it gets. */
  good: number;
  /** And beyond which it is no use at all. */
  worst: number;
  /**
   * Residents one point of a building's `serves` can look after.
   *
   * `serves` comes from the staff -- fifteen per member -- so it is a number of
   * pupils, patients or borrowers. This turns that into a population: a fire
   * station rated for three hundred looks after fifteen thousand people, which is
   * about what one real station covers.
   */
  per: number;
  /** Who needs it: everybody, or only the children. */
  who: 'all' | 'children';
}

/**
 * What each service is expected to cover, and how much of it.
 *
 * The distances are real catchments rather than round numbers. A fire station
 * covers the few streets it can be at in minutes; a park is somewhere you walk to,
 * so its catchment is a walk; a crematorium or a town hall serves a whole city and
 * one of them is enough for a long while. Those differences are the reason the
 * branches feel different to place rather than being eleven copies of one circle.
 */
const STANDARD: Record<string, Standard> = {
  fire: { good: 380, worst: 900, per: 50, who: 'all' },
  health: { good: 450, worst: 1100, per: 30, who: 'all' },
  police: { good: 500, worst: 1300, per: 50, who: 'all' },
  education: { good: 420, worst: 950, per: 1, who: 'children' },
  parks: { good: 260, worst: 620, per: 50, who: 'all' },
  transport: { good: 300, worst: 720, per: 40, who: 'all' },
  deathcare: { good: 900, worst: 2400, per: 120, who: 'all' },
  post: { good: 700, worst: 1800, per: 90, who: 'all' },
  government: { good: 1200, worst: 3000, per: 200, who: 'all' },
  water: { good: 0, worst: 0, per: 1, who: 'all' },
  sewage: { good: 0, worst: 0, per: 1, who: 'all' },
  power: { good: 0, worst: 0, per: 1, who: 'all' },
};

/** Branches whose coverage is a network along the roads, answered elsewhere. */
const PIPED = new Set(['water', 'sewage', 'power']);

/**
 * Cells stamped per visit, across all of a branch's stations.
 *
 * A bound rather than a target: a branch with more stations than this takes two
 * visits, which is a fifth of a second later and invisible. What it buys is a tick
 * cost that cannot spike however many fire stations somebody builds.
 */
const STAMP_BUDGET = 24000;

/** How a branch is doing. */
export interface Cover {
  branch: string;
  /** Stations built, and what they can between them look after. */
  stations: number;
  capacity: number;
  /** How many people want it. */
  demand: number;
  /** Capacity over demand. Below one means build another. */
  capacityRatio: number;
  /** Share of homes inside a full-strength catchment, and inside any. */
  wellServed: number;
  served: number;
  /** Mean metres from a home to the nearest one. */
  meanMetres: number;
  /** Homes outside every catchment. */
  unreachable: number;
  /** The most overloaded station's load, where 1 is exactly full. */
  worstLoad: number;
}

export class Services {
  /**
   * Coverage per cell, per branch: 0 none, 1 fully served.
   *
   * Already includes the covering station's load, so a cell inside a swamped
   * station's catchment reads low -- which is the truth about standing there.
   */
  /** The ordinances in force: the two that stretch a catchment. */
  private policies: Policies = NO_POLICIES;

  /** Points at the city's policies. Called whenever the world is replaced. */
  governedBy(policies: Policies): void { this.policies = policies; }

  readonly reach: Float32Array[] = [];
  /** Metres to the nearest station of each branch, per cell. */
  readonly near: Float32Array[] = [];
  /** People, and children, per cell. Shared by every branch. */
  private readonly people = new Float32Array(SERVICE_GRID * SERVICE_GRID);
  private readonly children = new Float32Array(SERVICE_GRID * SERVICE_GRID);
  /** Which branch is done next, and where in its station list it got to. */
  private turn = 0;
  private cursor = 0;
  /** Per-station load for the branch in progress. */
  private load = new Float32Array(64);
  /** The last demand figures, so a forced branch can be costed without them. */
  private lastPopulation = 0;
  private lastChildren = 0;
  readonly cover: Cover[] = [];
  /** Metres across the grid, and metres a cell. */
  private extent: number;
  private cell: number;

  constructor(readonly places: Places, extent = 5120) {
    this.extent = extent;
    this.cell = extent / SERVICE_GRID;
    for (let b = 0; b < BRANCHES.length; b++) {
      this.reach.push(new Float32Array(SERVICE_GRID * SERVICE_GRID));
      this.near.push(new Float32Array(SERVICE_GRID * SERVICE_GRID).fill(UNREACHED));
      this.cover.push({
        branch: BRANCHES[b], stations: 0, capacity: 0, demand: 0, capacityRatio: 1,
        wellServed: 0, served: 0, meanMetres: UNREACHED, unreachable: 1, worstLoad: 0,
      });
    }
  }

  /**
   * Where public transport stops are, as x, z and walking radius, filled by the
   * transit model. A street a bus line calls at is served by public transport
   * whether or not there is a station building nearby -- the lines are the
   * service; the buildings are depots and interchanges.
   */
  stopsFrom: ((out: number[]) => void) | null = null;
  private readonly stopBuf: number[] = [];

  /** The map got bigger or smaller. */
  resize(extent: number): void {
    this.extent = extent;
    this.cell = extent / SERVICE_GRID;
  }

  /** Metres across the grid this covers. */
  get span(): number { return this.extent; }

  /** The cell a world position falls in, or -1 off the map. */
  private cellAt(x: number, z: number): number {
    const half = this.extent / 2;
    const gx = ((x + half) / this.cell) | 0;
    const gz = ((z + half) / this.cell) | 0;
    if (gx < 0 || gz < 0 || gx >= SERVICE_GRID || gz >= SERVICE_GRID) return -1;
    return gz * SERVICE_GRID + gx;
  }

  /** Coverage at a world position, 0 to 1. */
  coverAt(x: number, z: number, branch: number): number {
    if (branch < 0 || branch >= this.reach.length) return 0;
    const at = this.cellAt(x, z);
    return at < 0 ? 0 : this.reach[branch][at];
  }

  /** Metres from a place to the nearest station of a branch. */
  metresAt(place: number, branch: number): number {
    if (branch < 0 || branch >= this.near.length) return UNREACHED;
    const c = this.places.col;
    const at = this.cellAt(c.x[place], c.z[place]);
    return at < 0 ? UNREACHED : this.near[branch][at];
  }

  /**
   * How well a place is served by a branch, 0 to 1.
   *
   * One grid read. Distance and the covering station's load are already folded
   * together in the grid, which is what makes this cheap enough to ask once per
   * citizen per visit rather than something the caller has to cache.
   */
  at(place: number, branch: number): number {
    if (branch < 0 || branch >= this.reach.length) return 0;
    if (PIPED.has(BRANCHES[branch])) return 0;  // utilities answer this themselves
    const c = this.places.col;
    return this.coverAt(c.x[place], c.z[place], branch);
  }

  /** The same, by branch name. */
  byName(place: number, branch: string): number {
    return this.at(place, BRANCHES.indexOf(branch as never));
  }

  /**
   * Spends a little time on coverage.
   *
   * One branch per visit, and a big branch over two. Demand is resummed at the top
   * of each cycle rather than every visit: where people live changes over days and
   * the grid is a few thousand cells, so doing it eleven times as often would be
   * eleven times the cost for the same answer.
   */
  refresh(population: number, children: number, _jobs = 0,
    budget = STAMP_BUDGET): void {
    this.lastPopulation = population;
    this.lastChildren = children;
    if (this.turn === 0 && this.cursor === 0) this.gatherDemand();
    const done = this.branch(this.turn, population, children, budget);
    if (done) {
      this.cursor = 0;
      this.turn = (this.turn + 1) % BRANCHES.length;
    }
  }

  /**
   * Brings one branch up to date now, whatever the cycle was doing.
   *
   * For the moment a player opens a coverage view. The round robin gets to a given
   * branch about once a second, which is invisible while the map is not being
   * looked at and is exactly the wrong second when it is: the view would open on a
   * blank city and fill in afterwards, which reads as the click having missed.
   */
  focus(branch: number): void {
    if (branch < 0 || branch >= this.cover.length) return;
    this.gatherDemand();
    this.cursor = 0;
    this.branch(branch, this.lastPopulation, this.lastChildren, Infinity);
    this.cursor = 0;
  }

  /** Where the people are, one pass over the homes for the whole cycle. */
  private gatherDemand(): void {
    this.people.fill(0);
    this.children.fill(0);
    const c = this.places.col;
    for (let p = 0; p < this.places.count; p++) {
      if (this.places.live[p] === 0 || c.purpose[p] !== Purpose.HOME) continue;
      const at = this.cellAt(c.x[p], c.z[p]);
      if (at < 0) continue;
      // Residents, not households: an empty house asks nothing of a school.
      const n = c.living[p];
      if (n === 0) continue;
      this.people[at] += n;
      // Children are about a fifth of a population and are not tracked per
      // building, so the school-age share is applied here rather than walking the
      // citizen table a second time for a number that is a ratio anyway.
      this.children[at] += n * CHILD_SHARE;
    }
  }

  /**
   * Covers one branch. Returns true when it has finished.
   *
   * Two passes over each station's disc. The first sums the people inside it, to
   * find out how loaded it is; the second stamps the coverage that load allows.
   * They cannot be one pass: a cell's coverage is the best any station offers it,
   * and "best" is not known until every station's load is.
   */
  private branch(b: number, population: number, children: number,
    budget: number): boolean {
    const name = BRANCHES[b];
    const std = STANDARD[name];
    const cov = this.cover[b];
    // Ordinances that stretch a station's catchment rather than add stations.
    // A neighbourhood watch does not build a police post; it makes the one that
    // is there cover more ground, which is exactly a radius.
    const pol = this.policies.effects;
    const grow = name === 'police' ? pol.safetyReach
      : name === 'education' ? pol.learningReach : 1;
    const pool = this.places.byBranch[b];
    const c = this.places.col;
    const reach = this.reach[b];
    const near = this.near[b];

    let stopCount = 0;
    if (name === 'transport' && this.stopsFrom !== null) {
      this.stopsFrom(this.stopBuf);
      stopCount = this.stopBuf.length / 3;
    }
    if (std === undefined || PIPED.has(name) || (pool.size === 0 && stopCount === 0)) {
      reach.fill(0);
      near.fill(UNREACHED);
      cov.stations = pool.size;
      cov.capacity = 0; cov.capacityRatio = 0; cov.worstLoad = 0;
      cov.wellServed = 0; cov.served = 0;
      cov.meanMetres = UNREACHED; cov.unreachable = 1;
      cov.demand = std === undefined ? 0
        : std.who === 'children' ? children : population;
      return true;
    }

    if (this.load.length < pool.size) this.load = new Float32Array(pool.size * 2);
    const demandGrid = std.who === 'children' ? this.children : this.people;

    // ---- pass one: how loaded is each station -----------------------------
    let capacity = 0, worst = 0;
    for (let i = 0; i < pool.size; i++) {
      const p = pool.member(i);
      const holds = Math.max(1, c.serves[p]) * std.per;
      capacity += holds;
      const g = grow * (1 + TIER_REACH * c.tier[p]);
      const inside = this.sumDisc(demandGrid, c.x[p], c.z[p], std.worst * g, std.good * g);
      const l = inside / holds;
      this.load[i] = l;
      if (l > worst) worst = l;
    }
    cov.stations = pool.size;
    cov.capacity = capacity;
    cov.demand = std.who === 'children' ? children : population;
    cov.capacityRatio = cov.demand <= 0 ? 1
      : Math.min(4, capacity / cov.demand);
    cov.worstLoad = worst;

    // ---- pass two: stamp what each station can actually offer -------------
    if (this.cursor === 0) { reach.fill(0); near.fill(UNREACHED); }
    let spent = 0;
    while (this.cursor < pool.size) {
      const i = this.cursor;
      const p = pool.member(i);
      // A station at twice its rated load serves everybody in its catchment half
      // as well. Not a cliff: an overstretched school is worse, not absent, and a
      // cliff would make the map flicker between two colours as the city grows.
      const able = Math.min(1, 1 / Math.max(1, this.load[i]));
      const g = grow * (1 + TIER_REACH * c.tier[p]);
      spent += this.stampDisc(reach, near, c.x[p], c.z[p], std.worst * g, std.good * g, able);
      this.cursor++;
      if (spent >= budget) return false;
    }
    // Every stop a line calls at: most of the service within half the walk,
    // falling off to the edge of it.
    for (let k = 0; k < stopCount; k++) {
      const walk = this.stopBuf[k * 3 + 2];
      this.stampDisc(reach, near, this.stopBuf[k * 3], this.stopBuf[k * 3 + 1], walk, walk * 0.5, 0.85);
    }

    this.tally(b, std);
    return true;
  }

  /** The cells a disc covers, as a loop bound. */
  private discBounds(x: number, z: number, radius: number): number[] {
    const half = this.extent / 2;
    const r = radius / this.cell;
    const cx = (x + half) / this.cell;
    const cz = (z + half) / this.cell;
    return [
      Math.max(0, Math.floor(cx - r)), Math.min(SERVICE_GRID - 1, Math.ceil(cx + r)),
      Math.max(0, Math.floor(cz - r)), Math.min(SERVICE_GRID - 1, Math.ceil(cz + r)),
      cx, cz, r,
    ];
  }

  /** Sums a grid over a station's catchment, weighted by the falloff. */
  private sumDisc(grid: Float32Array, x: number, z: number,
    worst: number, good: number): number {
    const [x0, x1, z0, z1, cx, cz, r] = this.discBounds(x, z, worst);
    const inner = good / this.cell;
    let sum = 0;
    for (let gz = z0; gz <= z1; gz++) {
      const dz = gz + 0.5 - cz;
      for (let gx = x0; gx <= x1; gx++) {
        const v = grid[gz * SERVICE_GRID + gx];
        if (v === 0) continue;
        const dx = gx + 0.5 - cx;
        const d = Math.sqrt(dx * dx + dz * dz);
        if (d > r) continue;
        // Weighted by the same falloff the coverage uses: somebody at the far edge
        // of a catchment is half served and is half of this station's problem.
        sum += v * (d <= inner ? 1 : 1 - (d - inner) / Math.max(1e-6, r - inner));
      }
    }
    return sum;
  }

  /** Stamps a station's coverage, keeping the best any station offers. */
  private stampDisc(reach: Float32Array, near: Float32Array, x: number, z: number,
    worst: number, good: number, able: number): number {
    const [x0, x1, z0, z1, cx, cz, r] = this.discBounds(x, z, worst);
    const inner = good / this.cell;
    let cells = 0;
    for (let gz = z0; gz <= z1; gz++) {
      const dz = gz + 0.5 - cz;
      for (let gx = x0; gx <= x1; gx++) {
        const dx = gx + 0.5 - cx;
        const d = Math.sqrt(dx * dx + dz * dz);
        if (d > r) continue;
        cells++;
        const at = gz * SERVICE_GRID + gx;
        const metres = d * this.cell;
        if (metres < near[at]) near[at] = metres;
        const falloff = d <= inner ? 1 : 1 - (d - inner) / Math.max(1e-6, r - inner);
        const v = falloff * able;
        if (v > reach[at]) reach[at] = v;
      }
    }
    return cells;
  }

  /** How the branch did, over the homes rather than over the map. */
  private tally(b: number, std: Standard): void {
    const cov = this.cover[b];
    const c = this.places.col;
    let homes = 0, well = 0, some = 0, sum = 0, lost = 0;
    for (let p = 0; p < this.places.count; p++) {
      if (this.places.live[p] === 0 || c.purpose[p] !== Purpose.HOME) continue;
      homes++;
      const m = this.metresAt(p, b);
      if (m >= UNREACHED) { lost++; continue; }
      sum += m;
      if (m <= std.good) well++;
      some++;
    }
    cov.wellServed = homes > 0 ? well / homes : 0;
    cov.served = homes > 0 ? some / homes : 0;
    cov.meanMetres = homes - lost > 0 ? sum / (homes - lost) : UNREACHED;
    cov.unreachable = homes > 0 ? lost / homes : 0;
  }

  /** The standard a branch is held to, for the readout. */
  standardOf(branch: string): Standard | undefined { return STANDARD[branch]; }

  bytes(): number {
    let n = this.people.byteLength + this.children.byteLength + this.load.byteLength;
    for (const a of this.reach) n += a.byteLength;
    for (const a of this.near) n += a.byteLength;
    return n;
  }
}

/**
 * The share of a population that is school age.
 *
 * Used to turn residents per cell into pupils per cell without walking the citizen
 * table a second time. It is a ratio either way -- the citizen model produces
 * roughly this and the demand grid only needs the shape, not the exact heads.
 */
const CHILD_SHARE = 0.19;

export { Use, BRANCHES };

/**
 * The population at which the city becomes responsible for each branch.
 *
 * A hamlet of forty people does not run a fire brigade, a police station, a
 * hospital or a school, and it is not failing its residents by not running
 * them: it uses the next town's. Requiring all of it from the first street was
 * the thing that made the opening hour read as a list of complaints about
 * services nowhere that size has -- the player lays one road, six houses
 * appear, and every one of them immediately wants a hospital.
 *
 * What a building genuinely cannot do without is the mains: power, water and
 * somewhere for the sewage to go. Those are ungated and always have been. These
 * are the ones that arrive as the city becomes a city, in the order a real one
 * gets them -- a fire appliance first, because that is the one that burns the
 * place down; then somewhere to be treated; then policing; then schools.
 */
export const EXPECTED_AT: Partial<Record<Branch, number>> = {
  // A town is judged on power, water and drains from the first house, and on
  // nothing else until it is a real town. These used to start at four hundred
  // residents -- a hamlet complaining about its fire cover -- which made the
  // first hour a list of demands the budget could not meet.
  fire: 2500,
  health: 3000,
  police: 3500,
  education: 4000,
  parks: 3000,
  transport: 7000,
  deathcare: 5000,
  post: 6000,
};

/**
 * Below this many residents, people complain about power, water and sewage
 * and nothing else: not the bins, not the staffing, not the buses. The rest
 * of what a city owes its people comes due as it grows.
 */
export const QUIET_UNTIL = 2000;

/**
 * Whether the city is big enough to be judged on a branch yet.
 *
 * Below the threshold the answer is "not yet", and everything that reads
 * coverage -- the complaints, the mood, the health model -- treats the branch
 * as satisfied rather than as missing, because that is the difference between
 * "you have not built this" and "you do not need this".
 */
export function expectedOf(branch: Branch, population: number): boolean {
  const at = EXPECTED_AT[branch];
  return at === undefined || population >= at;
}
