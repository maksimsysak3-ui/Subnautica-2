/**
 * Power, water, sewage and rubbish: the four things a city stops working without.
 *
 * These are networks, not radii, and that distinction is the whole design. A
 * coverage circle round a power station is a lie that produces a game about
 * placing circles; a *grid* produces a game about connecting things, which is what
 * running a city actually is. So:
 *
 *   THE NETWORK IS THE ROAD NETWORK. Mains run under the streets, as they do, so a
 *   building on a road connected to a power station has power and one on an
 *   isolated road does not, however close together the two are. The player never
 *   draws a pipe -- they draw roads, which they were doing anyway -- and the
 *   failure mode is legible the moment they look at it: that district is not joined
 *   to this one.
 *
 *   SUPPLY AND DEMAND ARE PER NETWORK. Each connected component of the road graph
 *   totals what its generators make and what its buildings draw. Short, and every
 *   building on it browns out in proportion -- not the nearest few, all of them,
 *   because that is how a grid fails. Two districts joined by one street share
 *   their power; cut the street and one of them goes dark.
 *
 *   WATER HAS TO COME FROM SOMEWHERE. A pump inland pumps nothing. It has to sit
 *   on the river, which is a constraint the player can see and solve, and it is
 *   the one thing about water that is not the same as power.
 *
 *   SEWAGE GOES SOMEWHERE TOO. What a treatment works cannot handle is discharged
 *   into the river, and the river carries it downstream -- so the city that dumps
 *   its sewage upstream of its own water supply poisons itself, which is a mistake
 *   worth being able to make.
 *
 *   RUBBISH ACCUMULATES. Not a rate but a stock: a building fills up, and a city
 *   whose incinerators are undersized gets visibly worse over days rather than
 *   instantly. Stocks are what make a shortage something a player has time to
 *   react to.
 *
 * Every number below is per day, except power which is instantaneous kilowatts and
 * rubbish which the asset library gives per week. The library already states what
 * every building *consumes*; what it does not state is what a plant *produces*, so
 * that is the one table here, and the test asserts that every producing asset in
 * the library appears in it.
 */

import { Places, Purpose, NO_BRANCH } from './places';
import { ASSETS } from '../../assets/registry';
import { BRANCHES } from '../../assets/types';
import { waterAt } from '../river';
import type { LaneGraph } from './lanes';

/** The four utilities. */
export const Util = { POWER: 0, WATER: 1, SEWAGE: 2, GARBAGE: 3 } as const;
export const UTIL_NAMES = ['power', 'water', 'sewage', 'rubbish'] as const;
export const UTILS = 4;

/** What a building makes, rather than uses. */
interface Supply {
  /** Kilowatts generated. */
  power?: number;
  /** Cubic metres of clean water a day. */
  water?: number;
  /** Cubic metres of sewage treated a day. */
  sewage?: number;
  /** Units of rubbish dealt with a week. */
  rubbish?: number;
  /** Must stand on water to work at all. */
  needsRiver?: boolean;
  /** Days of supply it can hold, for a reservoir or a water tower. */
  storeDays?: number;
}

/**
 * What each plant produces.
 *
 * Calibrated against what a city of a hundred thousand actually draws, which is the
 * only way to get these right: a gas turbine station is tens of megawatts and a
 * reactor hundreds, so such a city wants a reactor or several coal stations -- and
 * it wants about three waterworks, two sewage works and two incinerators. Anything
 * else is either a city that needs forty of something, which is not a decision, or
 * one that needs half of something, which is not a constraint.
 *
 * Water and rubbish were out by an order of magnitude on the first pass, and the
 * way to tell was to total the city's actual demand rather than to reason about the
 * buildings: a hundred thousand people would have needed seventeen pumps and
 * twenty-two incinerators, which is a screen full of infrastructure and no choices
 * in it.
 */
const SUPPLY: Record<string, Supply> = {
  'svc.power.wind': { power: 1200 },
  'svc.power.solar': { power: 2400 },
  'svc.power.gas': { power: 26000 },
  'svc.power.station': { power: 52000 },
  'svc.power.nuclear': { power: 240000 },
  'svc.power.waste': { power: 16000, rubbish: 900000 },
  'svc.power.substation': {},
  'svc.waste.recycling': { rubbish: 600000 },
  'svc.water.pump': { water: 90000, needsRiver: true },
  'svc.water.tower': { storeDays: 0.4 },
  'svc.water.reservoir': { storeDays: 2.2 },
  'svc.water.valvehouse': {},
  'svc.water.sewage': { sewage: 180000 },
  'svc.water.treatment': { sewage: 60000, water: 20000 },
};

/** Whether an asset is one of the producers, for the test to check the table. */
export function producerIds(): string[] {
  return ASSETS.filter((a) => a.zone === 'service'
    && (a.branch === 'power' || a.branch === 'water')).map((a) => a.id);
}

export const supplyOf = (id: string): Supply | undefined => SUPPLY[id];

/** Sewage made per cubic metre of water used. The rest evaporates or is drunk. */
const SEWAGE_PER_WATER = 0.85;

/**
 * Days of rubbish a building will hold before it starts to matter.
 *
 * Three, so a player who lets the incinerators fall behind has a couple of days to
 * notice before anybody is unhappy about it. Past it, the pile grows and the
 * building's standing falls with it.
 */
const BIN_DAYS = 3;
/** Days of rubbish at which a building is as bad as it gets. */
const BIN_WORST = 12;

/** Metres a pump may be from water and still draw from it. */
const RIVER_REACH = 70;

/** How a network is doing. One per connected component of the road graph. */
export interface Network {
  /** Places on it. */
  buildings: number;
  /** Kilowatts made and drawn. */
  powerMade: number;
  powerUsed: number;
  /** Cubic metres a day. */
  waterMade: number;
  waterUsed: number;
  /** Cubic metres a day of sewage made and treated. */
  sewageMade: number;
  sewageTreated: number;
  /** Units a week. */
  rubbishMade: number;
  rubbishBurnt: number;
  /** Days of water the reservoirs hold. */
  storeDays: number;
}

/** City-wide, for the readout. */
export interface UtilityReport {
  networks: number;
  /** The largest network's share of the city's buildings. */
  biggest: number;
  /** Supply over demand, city-wide, per utility. 1 is exactly enough. */
  margin: Float64Array;
  /** Share of buildings with each utility satisfied. */
  served: Float64Array;
  /** Share of buildings not on any network with a producer at all. */
  cutOff: number;
  /** Cubic metres a day going into the river untreated. */
  spilled: number;
  /** Units of rubbish sitting in the city. */
  piled: number;
  /** Buildings with a pile worth complaining about. */
  smelly: number;
}

export class Utilities {
  /** Which network each place is on, or -1 for one with no road. */
  private net: Int32Array = new Int32Array(0);
  /** Satisfaction per place per utility, 0..255. */
  readonly have: Uint8Array[] = [];
  /** Units of rubbish sitting at each place. */
  private pile: Float32Array = new Float32Array(0);

  /** The networks, rebuilt whenever the roads change. */
  networks: Network[] = [];
  /** Component of each road node. */
  private node: Int32Array = new Int32Array(0);

  readonly report: UtilityReport = {
    networks: 0, biggest: 0,
    margin: new Float64Array(UTILS), served: new Float64Array(UTILS),
    cutOff: 0, spilled: 0, piled: 0, smelly: 0,
  };

  constructor(readonly places: Places) {
    for (let u = 0; u < UTILS; u++) this.have.push(new Uint8Array(0));
  }

  /** Satisfaction of a utility at a place, 0 to 1. */
  at(place: number, util: number): number {
    const a = this.have[util];
    return place >= 0 && place < a.length ? a[place] / 255 : 0;
  }

  /** The network a place is on, or -1. */
  networkOf(place: number): number {
    return place >= 0 && place < this.net.length ? this.net[place] : -1;
  }

  /** Rubbish sitting at a place, in days' worth. */
  daysOfRubbish(place: number): number {
    if (place < 0 || place >= this.pile.length) return 0;
    const def = ASSETS[this.places.col.proto[place]];
    const perDay = (def?.sim?.garbagePerWeek ?? 0) / 7;
    return perDay <= 0 ? 0 : this.pile[place] / perDay;
  }

  private grow(): void {
    const want = Math.max(16, this.places.count);
    if (this.net.length >= want) return;
    let size = Math.max(16, this.net.length || 16);
    while (size < want) size *= 2;
    const net = new Int32Array(size).fill(-1); net.set(this.net); this.net = net;
    const pile = new Float32Array(size); pile.set(this.pile); this.pile = pile;
    for (let u = 0; u < UTILS; u++) {
      const a = new Uint8Array(size); a.set(this.have[u]); this.have[u] = a;
    }
  }

  /**
   * Works out which network everything is on.
   *
   * Union-find over the road graph's nodes: every lane joins its two ends, so two
   * roads are on the same network exactly when you can drive from one to the other
   * -- which is also when a pipe could run between them. Rebuilt when the roads
   * change, which is the only time it can change.
   */
  rewire(g: LaneGraph, nodeCount: number): void {
    const parent = new Int32Array(nodeCount);
    for (let i = 0; i < nodeCount; i++) parent[i] = i;
    const find = (x: number): number => {
      let r = x;
      while (parent[r] !== r) r = parent[r];
      // Path compression, in its short form: worth it because `find` is called
      // twice per lane on a graph of tens of thousands.
      while (parent[x] !== r) { const next = parent[x]; parent[x] = r; x = next; }
      return r;
    };
    for (let l = 0; l < g.count; l++) {
      const a = g.from[l], b = g.to[l];
      if (a < 0 || b < 0 || a >= nodeCount || b >= nodeCount) continue;
      const ra = find(a), rb = find(b);
      if (ra !== rb) parent[ra] = rb;
    }
    // Number the components densely, so a network is an index into an array.
    const label = new Int32Array(nodeCount).fill(-1);
    let count = 0;
    for (let i = 0; i < nodeCount; i++) {
      const r = find(i);
      if (label[r] < 0) label[r] = count++;
      label[i] = label[r];
    }
    this.node = label;
    this.networks = Array.from({ length: count }, () => ({
      buildings: 0, powerMade: 0, powerUsed: 0, waterMade: 0, waterUsed: 0,
      sewageMade: 0, sewageTreated: 0, rubbishMade: 0, rubbishBurnt: 0, storeDays: 0,
    }));
    this.grow();
    // And which network each building is on, from the road it fronts.
    const c = this.places.col;
    for (let p = 0; p < this.places.count; p++) {
      if (this.places.live[p] === 0) { this.net[p] = -1; continue; }
      const lane = c.lane[p];
      this.net[p] = lane >= 0 && lane < g.count ? this.node[g.from[lane]] : -1;
    }
  }

  /**
   * Totals every network's supply and demand, then tells every building how it did.
   *
   * Two passes over the buildings, which is the whole cost of the utility model and
   * is why it runs on a slow tick: a city of thirty thousand buildings is sixty
   * thousand rows, a few times a second at most, and nothing about power needs to
   * be fresher than that.
   */
  settle(days: number): void {
    this.grow();
    const nets = this.networks;
    for (const n of nets) {
      n.buildings = 0;
      n.powerMade = 0; n.powerUsed = 0;
      n.waterMade = 0; n.waterUsed = 0;
      n.sewageMade = 0; n.sewageTreated = 0;
      n.rubbishMade = 0; n.rubbishBurnt = 0; n.storeDays = 0;
    }
    const c = this.places.col;
    const count = this.places.count;
    const live = this.places.live;

    // POWER FIRST, and the order is the whole reason this is three passes rather
    // than two. A pump needs electricity to pump; a sewage works needs it to treat.
    // Resolving everything at once meant asking whether a pump was powered before
    // anything had worked out whether the grid was up -- the answer was always no,
    // so nothing ever started, and a city with three waterworks on the river had no
    // water in it. The grid comes up, and then the plants that depend on it run.
    for (let p = 0; p < count; p++) {
      if (live[p] === 0) continue;
      const which = this.net[p];
      if (which < 0 || which >= nets.length) continue;
      const n = nets[which];
      n.buildings++;
      const def = ASSETS[c.proto[p]];
      const sim = def?.sim;
      if (sim === undefined) continue;

      // What it uses. A building with nobody in it uses almost nothing, which is
      // what makes a half-empty district cheap to serve and a full one expensive.
      const busy = this.occupancy(p);
      n.powerUsed += (sim.powerKW ?? 0) * busy;
      const water = (sim.waterM3 ?? 0) * busy;
      n.waterUsed += water;
      n.sewageMade += water * SEWAGE_PER_WATER;
      n.rubbishMade += (sim.garbagePerWeek ?? 0) * busy;

      const supply = SUPPLY[def.id];
      if (supply === undefined) continue;
      // A generator needs staff and, for a waste incinerator, its own supply of
      // rubbish -- but not electricity, which is what it makes.
      n.powerMade += (supply.power ?? 0) * this.staffed(p);
      n.storeDays += supply.storeDays ?? 0;
    }

    const margin = new Float64Array(nets.length * UTILS);
    for (let i = 0; i < nets.length; i++) {
      margin[i * UTILS + Util.POWER] = ratio(nets[i].powerMade, nets[i].powerUsed);
    }
    // Tell every building about its power, so the plants can read it.
    for (let p = 0; p < count; p++) {
      if (live[p] === 0) continue;
      const which = this.net[p];
      this.have[Util.POWER][p] = which < 0 || which >= nets.length ? 0
        : Math.round(Math.max(0, Math.min(1, margin[which * UTILS + Util.POWER])) * 255);
    }

    // Now the plants that need power to work.
    for (let p = 0; p < count; p++) {
      if (live[p] === 0) continue;
      const which = this.net[p];
      if (which < 0 || which >= nets.length) continue;
      const def = ASSETS[c.proto[p]];
      const supply = SUPPLY[def?.id ?? ''];
      if (supply === undefined) continue;
      const running = this.running(p, supply);
      if (running <= 0) continue;
      const n = nets[which];
      n.waterMade += (supply.water ?? 0) * running;
      n.sewageTreated += (supply.sewage ?? 0) * running;
      n.rubbishBurnt += (supply.rubbish ?? 0) * running;
    }

    for (let i = 0; i < nets.length; i++) {
      const n = nets[i];
      // Storage smooths a shortfall: a reservoir carries a city through a day of
      // the pumps being short, which is what a reservoir is for.
      const stored = Math.min(1, n.storeDays * 0.35);
      margin[i * UTILS + Util.WATER] = Math.min(1,
        ratio(n.waterMade, n.waterUsed) + stored * 0.5);
      margin[i * UTILS + Util.SEWAGE] = ratio(n.sewageTreated, n.sewageMade);
      margin[i * UTILS + Util.GARBAGE] = ratio(n.rubbishBurnt, n.rubbishMade);
    }

    let spilled = 0, piled = 0, smelly = 0, cutOff = 0, served = [0, 0, 0, 0];
    let considered = 0;
    for (let p = 0; p < count; p++) {
      if (live[p] === 0) continue;
      const which = this.net[p];
      considered++;
      if (which < 0 || which >= nets.length) {
        for (let u = 0; u < UTILS; u++) this.have[u][p] = 0;
        cutOff++;
        continue;
      }
      const base = which * UTILS;
      for (let u = 0; u < UTILS; u++) {
        const v = Math.round(Math.max(0, Math.min(1, margin[base + u])) * 255);
        this.have[u][p] = v;
        if (v >= 200) served[u]++;
      }
      // Rubbish is a stock. What the network cannot burn piles up here.
      const def = ASSETS[c.proto[p]];
      const perDay = ((def?.sim?.garbagePerWeek ?? 0) / 7) * this.occupancy(p);
      const collected = perDay * Math.max(0, Math.min(1, margin[base + Util.GARBAGE]));
      this.pile[p] = Math.max(0, this.pile[p] + (perDay - collected) * days);
      const daysHeld = perDay > 0 ? this.pile[p] / perDay : 0;
      if (daysHeld > BIN_DAYS) smelly++;
      piled += this.pile[p];
      // And the rubbish satisfaction a building feels is about its own pile, not
      // about the network's average -- a bin that has been emptied is fine even in
      // a city that is behind.
      const bin = 1 - Math.max(0, Math.min(1, (daysHeld - BIN_DAYS) / (BIN_WORST - BIN_DAYS)));
      this.have[Util.GARBAGE][p] = Math.round(bin * 255);
    }
    for (const n of nets) spilled += Math.max(0, n.sewageMade - n.sewageTreated);

    const r = this.report;
    r.networks = nets.length;
    let biggest = 0;
    for (const n of nets) if (n.buildings > biggest) biggest = n.buildings;
    r.biggest = considered > 0 ? biggest / considered : 0;
    let made = [0, 0, 0, 0], used = [0, 0, 0, 0];
    for (const n of nets) {
      made[Util.POWER] += n.powerMade; used[Util.POWER] += n.powerUsed;
      made[Util.WATER] += n.waterMade; used[Util.WATER] += n.waterUsed;
      made[Util.SEWAGE] += n.sewageTreated; used[Util.SEWAGE] += n.sewageMade;
      made[Util.GARBAGE] += n.rubbishBurnt; used[Util.GARBAGE] += n.rubbishMade;
    }
    for (let u = 0; u < UTILS; u++) {
      r.margin[u] = used[u] > 0 ? made[u] / used[u] : made[u] > 0 ? 2 : 1;
      r.served[u] = considered > 0 ? served[u] / considered : 0;
    }
    r.cutOff = considered > 0 ? cutOff / considered : 0;
    r.spilled = spilled;
    r.piled = piled;
    r.smelly = smelly;
  }

  /**
   * How busy a building is, 0 to 1.
   *
   * An empty office draws its lights and its lifts and nothing else. Without this
   * a city pays for every building it has ever zoned whether anybody is in it, so
   * zoning ahead of demand bankrupts the player for no reason they can see.
   */
  private occupancy(p: number): number {
    const c = this.places.col;
    const homes = c.homes[p], jobs = c.jobs[p];
    // The floor is standby: the lights in the lobby and the lift on its stop. It was
    // a quarter to a third, and that turned out to be the whole of the city's demand
    // -- a map with eight hundred buildings and a thousand people in them was
    // drawing forty kilowatts a head, so no plausible number of power stations could
    // light it and the utility model looked broken when it was the demand that was.
    if (homes > 0) return 0.08 + 0.92 * (c.living[p] / Math.max(1, homes));
    if (jobs > 0) return 0.08 + 0.92 * (c.working[p] / Math.max(1, jobs));
    return 1;
  }

  /**
   * How well a plant is running, 0 to 1.
   *
   * Staffing and its own power, and a pump also needs to be standing on water.
   * That a plant needs power to make water is what lets a failure cascade: lose the
   * generators and the pumps stop, which is a far more interesting kind of trouble
   * than each utility failing on its own.
   */
  /** How well staffed a building is, 0 to 1. */
  private staffed(p: number): number {
    const c = this.places.col;
    const staff = c.jobs[p] > 0 ? c.working[p] / c.jobs[p] : 1;
    // Barely staffed is barely running. Not zero, because a city with no power
    // cannot hire anybody to run the power station that would give it power, and a
    // deadlock the player cannot see is worse than a plant that ticks over.
    return Math.min(1, 0.06 + staff * 1.1);
  }

  private running(p: number, supply: Supply): number {
    const c = this.places.col;
    let ok = this.staffed(p);
    // A plant that is not itself powered cannot run. Its own draw is zero in the
    // library, so the test is the network's, not its own.
    const def = ASSETS[c.proto[p]];
    if ((def?.sim?.powerKW ?? 0) > 0) ok *= this.at(p, Util.POWER);
    if (supply.needsRiver === true) {
      const level = waterAt(c.x[p], c.z[p]);
      if (level === null && !this.nearRiver(c.x[p], c.z[p])) return 0;
    }
    return ok;
  }

  /** Whether a point is close enough to water for a pump to draw from it. */
  private nearRiver(x: number, z: number): boolean {
    // Probed on a ring rather than searched, because `waterAt` answers a point and
    // a pump is a building, not a point.
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      if (waterAt(x + Math.cos(a) * RIVER_REACH, z + Math.sin(a) * RIVER_REACH) !== null) {
        return true;
      }
    }
    return false;
  }

  /** Every producing place of a branch, for the readout. */
  plantsOf(branch: string): number {
    const b = BRANCHES.indexOf(branch as never);
    if (b < 0) return 0;
    let n = 0;
    const pool = this.places.byBranch[b];
    for (let i = 0; i < pool.size; i++) {
      const p = pool.member(i);
      if (SUPPLY[ASSETS[this.places.col.proto[p]].id] !== undefined) n++;
    }
    return n;
  }

  bytes(): number {
    let n = this.net.byteLength + this.pile.byteLength + this.node.byteLength;
    for (const a of this.have) n += a.byteLength;
    return n;
  }
}

/** Supply over demand, with nothing demanded counting as satisfied. */
function ratio(made: number, used: number): number {
  if (used <= 0) return 1;
  return made / used;
}

export { Purpose, NO_BRANCH };
