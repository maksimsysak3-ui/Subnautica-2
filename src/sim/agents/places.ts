/**
 * Places: the buildings people live in, work in and go to.
 *
 * The city already knows what stands where -- the spawner produced an instance
 * buffer of prototype index and position -- and every prototype already declares
 * how many households it houses and how many people it employs. What is missing
 * is the middle layer: a table of *occupiable* buildings with vacancy, the lane
 * each one fronts onto, and a way to find one with room in it without scanning
 * thirty thousand rows.
 *
 * That last part is most of what this file is. A citizen looking for a home, a
 * school looking for pupils, a lorry looking for a warehouse -- all of them need
 * "give me one of these with space, quickly", hundreds of times a second, and a
 * linear scan over the whole city for each is the thing that makes a simulation
 * quietly stop scaling. So vacancy is a set with constant-time add, remove and
 * random pick, kept in step as occupancy changes.
 *
 * Trees, roads and parked cars are not places. Only what someone can be inside.
 */

import { Table } from './store';
import { nearestLane, Use } from './lanes';
import type { LaneGraph, LaneIndex } from './lanes';
import { ASSETS } from '../../assets/registry';
import { INSTANCE_FLOATS } from '../city';
import type { City } from '../city';
import { BRANCHES } from '../../assets/types';

/** What a building is for. */
export const Purpose = {
  HOME: 0,
  /** Shops and everything else people go to in order to spend money. */
  SHOP: 1,
  OFFICE: 2,
  /** Industry and warehousing: jobs, freight, and pollution. */
  WORKS: 3,
  /** A service the city provides. `branch` says which. */
  SERVICE: 4,
} as const;
export type PurposeValue = typeof Purpose[keyof typeof Purpose];
export const PURPOSES = 5;

/** No branch. */
export const NO_BRANCH = 255;

/**
 * A set of ids with constant-time add, remove and random pick.
 *
 * A dense array of members plus a position-of-each-member index, which is the
 * standard trick and worth spelling out because the whole simulation leans on
 * it: removal swaps the last member into the hole, so nothing is ever shifted
 * and nothing is ever scanned. Picking at random is one index into the dense
 * array, which is what makes "find a vacant home" a constant-time question
 * rather than a walk over the city.
 */
export class Pool {
  private dense: Int32Array;
  /** Where each id sits in `dense`, or -1. */
  private at: Int32Array;
  private n = 0;

  constructor(capacity: number) {
    this.dense = new Int32Array(Math.max(1, capacity));
    this.at = new Int32Array(Math.max(1, capacity)).fill(-1);
  }

  get size(): number { return this.n; }
  get capacity(): number { return this.at.length; }
  has(id: number): boolean { return id >= 0 && id < this.at.length && this.at[id] >= 0; }

  /**
   * Adds an id, growing if it is beyond what the pool was built for.
   *
   * The growth is not an optimisation, it is a correctness fix, and an
   * instructive one. This used to return silently for an id past the end, and the
   * pools were sized from the citizen table's *initial* capacity -- so the
   * moment a city passed four thousand people, every traveller with a higher id
   * was added to nothing, never appeared in the pass that moves travellers, and
   * stayed in transit for the rest of their life. Three quarters of the
   * population ended up permanently walking to work. A silent failure on a
   * bound is worth growing out of rather than guarding against.
   */
  add(id: number): void {
    if (id < 0 || this.at[id] >= 0) return;
    if (id >= this.at.length) this.grow(id + 1);
    this.at[id] = this.n;
    this.dense[this.n++] = id;
  }

  private grow(least: number): void {
    let size = this.at.length;
    while (size < least) size *= 2;
    const at = new Int32Array(size).fill(-1);
    at.set(this.at);
    const dense = new Int32Array(size);
    dense.set(this.dense);
    this.at = at;
    this.dense = dense;
  }

  remove(id: number): void {
    if (id < 0 || id >= this.at.length) return;
    const i = this.at[id];
    if (i < 0) return;
    const last = this.dense[--this.n];
    this.dense[i] = last;
    this.at[last] = i;
    this.at[id] = -1;
  }

  /** The `i`th member, for a walk. */
  member(i: number): number { return this.dense[i]; }

  /** A member at random, or -1 when empty. `r` is in [0, 1). */
  pick(r: number): number {
    if (this.n === 0) return -1;
    let i = (r * this.n) | 0;
    if (i >= this.n) i = this.n - 1;
    return this.dense[i];
  }

  clear(): void {
    for (let i = 0; i < this.n; i++) this.at[this.dense[i]] = -1;
    this.n = 0;
  }

  bytes(): number { return this.dense.byteLength + this.at.byteLength; }
}

const SCHEMA = {
  /** Prototype index, which is also the row in the asset registry. */
  proto: Int32Array,
  x: Float32Array,
  z: Float32Array,
  /** The nearest lane a vehicle can reach it by, and one a person can walk. */
  lane: Int32Array,
  foot: Int32Array,
  purpose: Uint8Array,
  /** Service branch, or NO_BRANCH. */
  branch: Uint8Array,
  /** Capacity, and how much of it is taken. */
  homes: Uint16Array,
  jobs: Uint16Array,
  living: Uint16Array,
  working: Uint16Array,
  /**
   * How many people a service building can look after.
   *
   * A school's staff is in the registry; the number of pupils it takes is not,
   * so it comes from the staff -- a secondary school with thirty teachers takes
   * about four hundred and fifty pupils, and that ratio is stable enough across
   * real schools, clinics and libraries to be worth using rather than inventing
   * a second number for every one of eighty-six service prototypes.
   */
  serves: Uint16Array,
  /** Pupils or students enrolled, against `serves`. */
  studying: Uint16Array,
  /**
   * What a place teaches: 1 school, 2 college, 3 university, 0 not a school.
   *
   * A library and an observatory are education buildings that nobody enrols at,
   * and a university is not a bigger primary school -- so the level is what
   * decides how far somebody can get, and the scarcity of the higher ones is what
   * makes a degree worth something in the job market.
   */
  teaches: Uint8Array,
  /** Demand met, 0..255: what fraction of the people who wanted it got it. */
  met: Uint8Array,
  /** How well the building is doing, 0..255. Drives growth and abandonment. */
  health: Uint8Array,
} as const;

/** Pupils, patients or borrowers per member of staff. */
const SERVED_PER_STAFF = 15;

/** Levels of education a building can offer. */
export const Teaches = { NONE: 0, SCHOOL: 1, COLLEGE: 2, UNIVERSITY: 3 } as const;

/** What an education building teaches, from what it is. */
function teachesOf(id: string): number {
  const kind = id.split('.')[2] ?? '';
  switch (kind) {
    case 'nursery': case 'primary': case 'high': case 'school': return Teaches.SCHOOL;
    case 'college': return Teaches.COLLEGE;
    case 'university': return Teaches.UNIVERSITY;
    default: return Teaches.NONE;          // a library teaches nobody a degree
  }
}

export class Places {
  readonly table = new Table(SCHEMA, 4096);
  /** Buildings with room in them, one pool per purpose. */
  readonly vacantHomes: Pool;
  readonly vacantJobs: Pool[] = [];
  /**
   * Every building of each purpose, whether it has vacancies or not.
   *
   * Separate from `vacantJobs` because they answer different questions and using
   * one for the other is a bug that looks like a quiet content problem. A shopper
   * wants a shop; whether that shop is hiring has nothing to do with it -- and
   * picking destinations out of the vacancy pool meant that the moment a shop was
   * fully staffed, it stopped having customers.
   */
  readonly byPurpose: Pool[] = [];
  /** Every service building of a branch, whether it has room or not. */
  readonly byBranch: Pool[] = [];
  /** Every home, for walks that want all of them. */
  readonly homes: Pool;
  /** Schools with room, by what they teach. Index 0 is unused. */
  readonly schools: Pool[] = [];

  /** Totals, kept in step rather than recomputed. */
  homeCapacity = 0;
  jobCapacity = 0;
  households = 0;
  workers = 0;
  /**
   * Vacancies by purpose, maintained rather than counted.
   *
   * Because a job search weighted by how many *buildings* have a vacancy is not the
   * same as one weighted by how many vacancies there are, and the difference is not
   * academic: a power station with ninety posts counted the same as a corner shop
   * with six, so a city's power stations were never staffed and a city with three of
   * them had no electricity at all. Weighting by the number of posts is both cheaper
   * to maintain and the thing that actually happens.
   */
  readonly vacancies = new Int32Array(PURPOSES);
  /**
   * Every post of each purpose, filled or not.
   *
   * Separate from `vacancies`, which is only the empty ones. The demand model
   * wants both: how many jobs a city has says whether it needs more industry, and
   * how many are going begging says whether it needs more people.
   */
  readonly posts = new Int32Array(PURPOSES);
  /** Homes of each purpose -- which is only ever HOME, kept for symmetry. */
  readonly dwellings = new Int32Array(PURPOSES);

  /**
   * Jobs of each purpose that are actually filled.
   *
   * Posts less vacancies, kept as its own array so the economy can ask for it
   * every settle without subtracting two arrays on the caller's side -- and
   * because "how many people are at work in shops" is the question, not "how
   * many shop jobs exist minus how many are empty".
   */
  private readonly staffedNow = new Int32Array(PURPOSES);
  get staffed(): Int32Array {
    for (let i = 0; i < PURPOSES; i++) {
      this.staffedNow[i] = Math.max(0, this.posts[i] - Math.max(0, this.vacancies[i]));
    }
    return this.staffedNow;
  }

  constructor(capacity = 1 << 16) {
    this.vacantHomes = new Pool(capacity);
    this.homes = new Pool(capacity);
    for (let i = 0; i < PURPOSES; i++) {
      this.vacantJobs.push(new Pool(capacity));
      this.byPurpose.push(new Pool(capacity));
    }
    for (let i = 0; i < BRANCHES.length; i++) this.byBranch.push(new Pool(capacity));
    for (let i = 0; i <= Teaches.UNIVERSITY; i++) this.schools.push(new Pool(capacity));
  }

  get col(): typeof this.table.col { return this.table.col; }
  get count(): number { return this.table.bound; }
  get live(): Uint8Array { return this.table.live; }

  /**
   * Adds a building.
   *
   * Capacity comes from the prototype, so it is the number the asset library
   * already declares rather than a second copy of it that can drift.
   */
  add(proto: number, x: number, z: number, lane: number, foot: number): number {
    const def = ASSETS[proto];
    const id = this.table.add();
    const c = this.table.col;
    c.proto[id] = proto;
    c.x[id] = x; c.z[id] = z;
    c.lane[id] = lane; c.foot[id] = foot;
    c.living[id] = 0; c.working[id] = 0;
    c.met[id] = 0; c.health[id] = 200;

    const homes = def.sim?.households ?? 0;
    const jobs = def.sim?.jobs ?? 0;
    c.homes[id] = homes;
    c.jobs[id] = jobs;

    let purpose: number = Purpose.WORKS;
    let branch = NO_BRANCH;
    if (homes > 0) purpose = Purpose.HOME;
    else if (def.zone === 'commercial') purpose = Purpose.SHOP;
    else if (def.zone === 'office') purpose = Purpose.OFFICE;
    else if (def.zone === 'service') {
      purpose = Purpose.SERVICE;
      // From the descriptor, not from the id. The id's second segment looks like
      // the branch and mostly is -- and the four times it is not are the four
      // that matter: `svc.edu.*` is education, `svc.gov.*` is government,
      // `svc.death.*` is deathcare, `svc.waste.*` is filed under power. Parsing
      // the id filed all of those under no branch at all, so as far as the
      // simulation was concerned the city had no schools -- and the visible
      // result, hours later, was a population where eighty-six per cent had no
      // education and nobody could say why.
      const found = def.branch === undefined ? -1 : BRANCHES.indexOf(def.branch);
      branch = found >= 0 ? found : NO_BRANCH;
    }
    c.purpose[id] = purpose;
    c.branch[id] = branch;
    c.serves[id] = purpose === Purpose.SERVICE
      ? Math.min(0xffff, jobs * SERVED_PER_STAFF) : 0;
    c.studying[id] = 0;
    c.teaches[id] = purpose === Purpose.SERVICE && def.branch === 'education'
      ? teachesOf(def.id) : Teaches.NONE;

    this.byPurpose[purpose].add(id);
    if (homes > 0) {
      this.homes.add(id); this.vacantHomes.add(id);
      this.homeCapacity += homes;
      this.dwellings[purpose] += homes;
    }
    if (jobs > 0) {
      this.vacantJobs[purpose].add(id);
      this.jobCapacity += jobs;
      this.vacancies[purpose] += jobs;
      this.posts[purpose] += jobs;
    }
    if (branch !== NO_BRANCH) this.byBranch[branch].add(id);
    if (c.teaches[id] !== Teaches.NONE && c.serves[id] > 0) {
      this.schools[c.teaches[id]].add(id);
    }
    return id;
  }

  /** Removes a building. Callers must already have moved anybody out of it. */
  remove(id: number): void {
    if (this.table.live[id] === 0) return;
    const c = this.table.col;
    this.homeCapacity -= c.homes[id];
    this.dwellings[c.purpose[id]] -= c.homes[id];
    this.jobCapacity -= c.jobs[id];
    this.posts[c.purpose[id]] -= c.jobs[id];
    this.vacancies[c.purpose[id]] -= Math.max(0, c.jobs[id] - c.working[id]);
    this.households -= c.living[id];
    this.workers -= c.working[id];
    this.homes.remove(id);
    this.vacantHomes.remove(id);
    if (c.teaches[id] !== Teaches.NONE) this.schools[c.teaches[id]].remove(id);
    this.vacantJobs[c.purpose[id]].remove(id);
    this.byPurpose[c.purpose[id]].remove(id);
    if (c.branch[id] !== NO_BRANCH) this.byBranch[c.branch[id]].remove(id);
    this.table.remove(id);
  }

  /** Takes a home. Returns false if there was no room after all. */
  moveIn(id: number): boolean {
    const c = this.table.col;
    if (this.table.live[id] === 0 || c.living[id] >= c.homes[id]) return false;
    if (++c.living[id] >= c.homes[id]) this.vacantHomes.remove(id);
    this.households++;
    return true;
  }

  moveOut(id: number): void {
    const c = this.table.col;
    if (this.table.live[id] === 0 || c.living[id] === 0) return;
    c.living[id]--;
    this.households--;
    if (c.living[id] < c.homes[id]) this.vacantHomes.add(id);
  }

  /** Takes a job. */
  hire(id: number): boolean {
    const c = this.table.col;
    if (this.table.live[id] === 0 || c.working[id] >= c.jobs[id]) return false;
    if (++c.working[id] >= c.jobs[id]) this.vacantJobs[c.purpose[id]].remove(id);
    this.vacancies[c.purpose[id]]--;
    this.workers++;
    return true;
  }

  fire(id: number): void {
    const c = this.table.col;
    if (this.table.live[id] === 0 || c.working[id] === 0) return;
    c.working[id]--;
    this.workers--;
    this.vacancies[c.purpose[id]]++;
    if (c.working[id] < c.jobs[id]) this.vacantJobs[c.purpose[id]].add(id);
  }

  /** Takes a place at a school. False if it filled up first. */
  enrol(id: number): boolean {
    const c = this.table.col;
    if (this.table.live[id] === 0 || c.studying[id] >= c.serves[id]) return false;
    if (++c.studying[id] >= c.serves[id]) this.schools[c.teaches[id]].remove(id);
    return true;
  }

  /** Gives a school place back. */
  unenrol(id: number): void {
    const c = this.table.col;
    if (this.table.live[id] === 0 || c.studying[id] === 0) return;
    c.studying[id]--;
    if (c.studying[id] < c.serves[id] && c.teaches[id] !== Teaches.NONE) {
      this.schools[c.teaches[id]].add(id);
    }
  }

  /** School places built and taken, by level, for the readout. */
  schoolPlaces(level: number): [taken: number, total: number] {
    const c = this.table.col;
    let taken = 0, total = 0;
    for (let id = 0; id < this.count; id++) {
      if (this.live[id] === 0 || c.teaches[id] !== level) continue;
      taken += c.studying[id]; total += c.serves[id];
    }
    return [taken, total];
  }

  /** Vacant homes, and vacant jobs across every kind of employer. */
  get spareHomes(): number { return this.homeCapacity - this.households; }
  get spareJobs(): number { return this.jobCapacity - this.workers; }

  /** A vacant job anywhere, weighted by how many vacancies each kind holds. */
  pickJob(r: number): number {
    let total = 0;
    for (let p = 0; p < PURPOSES; p++) {
      if (p !== Purpose.HOME) total += Math.max(0, this.vacancies[p]);
    }
    if (total === 0) return -1;
    let pick = r * total;
    for (let p = 0; p < PURPOSES; p++) {
      if (p === Purpose.HOME) continue;
      const n = Math.max(0, this.vacancies[p]);
      if (pick < n) return this.vacantJobs[p].pick(n > 0 ? pick / n : 0);
      pick -= n;
    }
    return -1;
  }

  /** Posts still open at a building. */
  openPosts(id: number): number {
    const c = this.table.col;
    return this.table.live[id] === 0 ? 0 : Math.max(0, c.jobs[id] - c.working[id]);
  }

  bytes(): number {
    let n = this.table.bytes() + this.vacantHomes.bytes() + this.homes.bytes();
    for (const p of this.vacantJobs) n += p.bytes();
    for (const p of this.byBranch) n += p.bytes();
    for (const p of this.schools) n += p.bytes();
    for (const p of this.byPurpose) n += p.bytes();
    return n;
  }
}

/**
 * Whether an instance is somewhere a person can be.
 *
 * Exported because the renderer's connection markers have to draw exactly the set
 * the simulation counts as buildings -- otherwise there is a dot on every tree.
 */
export function occupiable(proto: number): boolean {
  const def = ASSETS[proto];
  if (def === undefined || def.sim === undefined) return false;
  return (def.sim.households ?? 0) > 0 || (def.sim.jobs ?? 0) > 0;
}

/** A key that identifies a building across a rebuild: its prototype and where
 *  it stands, to the nearest metre. The spawner is deterministic, so a building
 *  the player did not touch comes back at exactly the same place. */
const keyOf = (proto: number, x: number, z: number): string =>
  `${proto}:${Math.round(x)}:${Math.round(z)}`;

/**
 * Brings the place table into line with what the spawner has put on the ground.
 *
 * Not a rebuild, and that distinction is the whole reason this function exists.
 * Citizens hold the id of the home they live in and the office they work at, so
 * renumbering the table renumbers everybody's life -- a player who draws one road
 * would find the whole city had swapped houses and jobs. So buildings that are
 * still there keep their ids, only the difference is applied, and the ids of the
 * ones that went are handed back so that whoever lived or worked in them can be
 * dealt with properly.
 *
 * Anything with neither a household nor a job in its descriptor is skipped, which
 * removes the trees, the road tiles and the parked cars -- about half the
 * instances in a built city -- without needing a list of what to ignore.
 *
 * The lane lookup is the expensive part, so it happens once per building here
 * rather than every time somebody leaves the house, and not at all for a building
 * that was already known.
 */
export function reconcilePlaces(city: City, lanes: LaneGraph, index: LaneIndex,
  places: Places, removed: number[] = []): { added: number; removed: number[] } {
  const c = places.col;
  const live = places.live;
  // What is there now, by key.
  const known = new Map<string, number>();
  for (let id = 0; id < places.count; id++) {
    if (live[id] === 0) continue;
    known.set(keyOf(c.proto[id], c.x[id], c.z[id]), id);
  }

  const d = city.data;
  const seen = new Set<number>();
  let added = 0;
  for (let i = 0; i < city.count; i++) {
    const o = i * INSTANCE_FLOATS;
    const proto = d[o + 7] | 0;
    if (!occupiable(proto)) continue;
    const x = d[o], z = d[o + 1];
    const key = keyOf(proto, x, z);
    const was = known.get(key);
    if (was !== undefined) { seen.add(was); continue; }
    const lane = nearestLane(lanes, index, x, z, Use.CAR, 220);
    const foot = nearestLane(lanes, index, x, z, Use.FOOT, 220);
    seen.add(places.add(proto, x, z, lane, foot));
    added++;
  }

  removed.length = 0;
  for (const id of known.values()) if (!seen.has(id)) removed.push(id);
  return { added, removed };
}

/**
 * Re-points every place at the lane graph after the roads changed.
 *
 * Separate from reconciling, because the two happen for different reasons: a
 * building appears when the spawner builds one, and its lane changes when the
 * player draws a road past it. Doing both in one pass would mean re-running the
 * lane lookup for the whole city every time a single building went up.
 */
export function relinkPlaces(lanes: LaneGraph, index: LaneIndex, places: Places): void {
  const c = places.col;
  const live = places.live;
  for (let id = 0; id < places.count; id++) {
    if (live[id] === 0) continue;
    c.lane[id] = nearestLane(lanes, index, c.x[id], c.z[id], Use.CAR, 220);
    c.foot[id] = nearestLane(lanes, index, c.x[id], c.z[id], Use.FOOT, 220);
  }
}

/** Builds the table from scratch, for a city that has no simulation yet. */
export function buildPlaces(city: City, lanes: LaneGraph, index: LaneIndex,
  into?: Places): Places {
  const places = into ?? new Places(Math.max(4096, city.count));
  reconcilePlaces(city, lanes, index, places);
  return places;
}
