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
import { Main } from '../mains';
import type { Mains } from '../mains';

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

/**
 * How one network is doing.
 *
 * One per connected component *of that utility's mains*, not of the road graph.
 * Since the player lays the pipes, two districts can share a grid and have separate
 * water, and a single set of components could not say so.
 */
export interface Network {
  /** Which utility this is a network of. */
  kind: number;
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
  /**
   * Share of buildings a main of each utility actually reaches.
   *
   * Distinct from `served`, and the distinction is the whole point of the mains:
   * a building can be on the grid and the grid short of power, or off it
   * entirely. Those want different things from the player -- another power
   * station, or a line down that street -- and one number cannot say which.
   */
  onMain: Float64Array;
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
  /**
   * Which network each place is on, per utility, or -1 for one nothing reaches.
   *
   * Four arrays rather than one, which is the whole of the mains change as far as
   * everything downstream is concerned: a building can be on the grid and off the
   * water, and before this it could not.
   */
  private netOf: Int32Array[] = [];
  /** How many networks there are of each utility. */
  private readonly netCount = new Int32Array(UTILS);
  /** Satisfaction per place per utility, 0..255. */
  readonly have: Uint8Array[] = [];
  /** Units of rubbish sitting at each place. */
  private pile: Float32Array = new Float32Array(0);

  /** The networks, rebuilt by every `settle`. One entry per utility network. */
  networks: Network[] = [];
  /** Component of each road node. */
  private node: Int32Array = new Int32Array(0);

  readonly report: UtilityReport = {
    networks: 0, biggest: 0,
    margin: new Float64Array(UTILS), served: new Float64Array(UTILS),
    onMain: new Float64Array(UTILS),
    cutOff: 0, spilled: 0, piled: 0, smelly: 0,
  };

  constructor(readonly places: Places) {
    for (let u = 0; u < UTILS; u++) {
      this.have.push(new Uint8Array(0));
      this.netOf.push(new Int32Array(0));
    }
  }

  /** Satisfaction of a utility at a place, 0 to 1. */
  at(place: number, util: number): number {
    const a = this.have[util];
    return place >= 0 && place < a.length ? a[place] / 255 : 0;
  }

  /** The network a place is on for a utility, or -1. */
  networkOf(place: number, util: number = Util.POWER): number {
    const a = this.netOf[util];
    return a !== undefined && place >= 0 && place < a.length ? a[place] : -1;
  }

  /** Whether a main of this utility reaches a place at all. */
  connected(place: number, util: number): boolean {
    return this.networkOf(place, util) >= 0;
  }

  /** Rubbish sitting at a place, in days' worth. */
  daysOfRubbish(place: number): number {
    if (place < 0 || place >= this.pile.length) return 0;
    const def = ASSETS[this.places.col.proto[place]];
    const perDay = (def?.sim?.garbagePerWeek ?? 0) / 7;
    return perDay <= 0 ? 0 : this.pile[place] / perDay;
  }

  /** Units of rubbish sitting at a place. */
  pileAt(place: number): number {
    return place >= 0 && place < this.pile.length ? this.pile[place] : 0;
  }

  /**
   * A lorry emptied the bins here.
   *
   * The collection *capacity* is still the incinerators and the recycling centres --
   * a city with nowhere to put its rubbish does not get to keep taking it away. This
   * is the last few metres of that: the lorry arriving is what moves the pile off
   * the kerb, and without it the bin views showed a building that had been visited
   * still overflowing.
   */
  collect(place: number): void {
    if (place >= 0 && place < this.pile.length) this.pile[place] = 0;
  }

  private grow(): void {
    const want = Math.max(16, this.places.count);
    if (this.netOf[0].length >= want) return;
    let size = Math.max(16, this.netOf[0].length || 16);
    while (size < want) size *= 2;
    const pile = new Float32Array(size); pile.set(this.pile); this.pile = pile;
    for (let u = 0; u < UTILS; u++) {
      const a = new Uint8Array(size); a.set(this.have[u]); this.have[u] = a;
      const n = new Int32Array(size).fill(-1); n.set(this.netOf[u]); this.netOf[u] = n;
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
  /**
   * Rebuilds every network from the mains the player has laid.
   *
   * Power, water and sewage each come straight off the mains grid: a building's
   * network is whatever network of that kind reaches its cell, and -1 if none does.
   * That is the whole model, and it is one array read per building per utility
   * because `Mains` has already done the flood fill.
   *
   * RUBBISH IS DIFFERENT and stays on the roads, because it is not piped -- a lorry
   * drives to it. So its components are the connected components of the road graph,
   * computed here as everything used to be: a district reachable by road from an
   * incinerator has its bins emptied, and one that is not, does not.
   *
   * Called with no mains -- a test, or a city built before they existed -- every
   * utility falls back to the roads, which is exactly the old behaviour.
   */
  rewire(g: LaneGraph, nodeCount: number, mains?: Mains): void {
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
    let roads = 0;
    for (let i = 0; i < nodeCount; i++) {
      const r = find(i);
      if (label[r] < 0) label[r] = roads++;
      label[i] = label[r];
    }
    this.node = label;
    this.grow();

    const c = this.places.col;
    const piped = [
      { util: Util.POWER, kind: Main.POWER },
      { util: Util.WATER, kind: Main.WATER },
      { util: Util.SEWAGE, kind: Main.SEWAGE },
    ];
    for (const { util, kind } of piped) {
      const to = this.netOf[util];
      for (let p = 0; p < this.places.count; p++) {
        if (this.places.live[p] === 0) { to[p] = -1; continue; }
        to[p] = mains === undefined
          ? this.roadNetOf(p, g)
          : mains.netAt(c.x[p], c.z[p], kind);
      }
      this.netCount[util] = mains === undefined ? roads : mains.networksOf(kind);
    }
    const bins = this.netOf[Util.GARBAGE];
    for (let p = 0; p < this.places.count; p++) {
      bins[p] = this.places.live[p] === 0 ? -1 : this.roadNetOf(p, g);
    }
    this.netCount[Util.GARBAGE] = roads;
    this.resetNetworks();
  }

  /**
   * Empty ledgers, one per network, so the count is right before anything settles.
   *
   * `networks` used to be built by `rewire` and is now filled by `settle`, and for
   * one commit in between "how many networks are there" answered zero until the
   * first tick -- which is a question every readout and every test asks the moment
   * the roads change.
   */
  private resetNetworks(): void {
    this.networks.length = 0;
    for (let u = 0; u < UTILS; u++) {
      for (let i = 0; i < this.netCount[u]; i++) {
        this.networks.push({
          kind: u, buildings: 0,
          powerMade: 0, powerUsed: 0, waterMade: 0, waterUsed: 0,
          sewageMade: 0, sewageTreated: 0, rubbishMade: 0, rubbishBurnt: 0,
          storeDays: 0,
        });
      }
    }
    this.report.networks = this.networks.length;
  }

  /** How many networks of one utility there are. */
  networkCount(util: number): number {
    return util >= 0 && util < UTILS ? this.netCount[util] : 0;
  }

  /** The road component a building fronts onto, or -1. */
  private roadNetOf(p: number, g: LaneGraph): number {
    const lane = this.places.col.lane[p];
    return lane >= 0 && lane < g.count ? this.node[g.from[lane]] : -1;
  }

  settle(days: number): void {
    this.grow();
    const c = this.places.col;
    const count = this.places.count;
    const live = this.places.live;
    const sizes = this.netCount;

    const made: Float64Array[] = [];
    const used: Float64Array[] = [];
    const store: Float64Array[] = [];
    const held: Int32Array[] = [];
    for (let u = 0; u < UTILS; u++) {
      const n = Math.max(1, sizes[u]);
      made.push(new Float64Array(n));
      used.push(new Float64Array(n));
      store.push(new Float64Array(n));
      held.push(new Int32Array(n));
    }

    // ---- what the city draws, and what the grid makes ---------------------
    for (let p = 0; p < count; p++) {
      if (live[p] === 0) continue;
      const def = ASSETS[c.proto[p]];
      const sim = def?.sim;
      if (sim === undefined) continue;
      // A building with nobody in it uses almost nothing, which is what makes a
      // half-empty district cheap to serve and a full one expensive.
      const busy = this.occupancy(p);

      const onPower = this.netOf[Util.POWER][p];
      const onWater = this.netOf[Util.WATER][p];
      const onSewer = this.netOf[Util.SEWAGE][p];
      const onBins = this.netOf[Util.GARBAGE][p];
      if (onPower >= 0) { used[Util.POWER][onPower] += (sim.powerKW ?? 0) * busy; held[Util.POWER][onPower]++; }
      const water = (sim.waterM3 ?? 0) * busy;
      if (onWater >= 0) { used[Util.WATER][onWater] += water; held[Util.WATER][onWater]++; }
      if (onSewer >= 0) { used[Util.SEWAGE][onSewer] += water * SEWAGE_PER_WATER; held[Util.SEWAGE][onSewer]++; }
      if (onBins >= 0) { used[Util.GARBAGE][onBins] += (sim.garbagePerWeek ?? 0) * busy; held[Util.GARBAGE][onBins]++; }

      const supply = SUPPLY[def.id];
      if (supply === undefined) continue;
      // A generator needs staff and, for a waste incinerator, its own supply of
      // rubbish -- but not electricity, which is what it makes. It also has to be
      // connected to the grid it is feeding: a power station with no line to it
      // lights nothing, which is the whole point of the mains.
      if (onPower >= 0) made[Util.POWER][onPower] += (supply.power ?? 0) * this.staffed(p);
      if (onWater >= 0) store[Util.WATER][onWater] += supply.storeDays ?? 0;
    }

    // ---- the grid comes up ------------------------------------------------
    const margin: Float64Array[] = [];
    for (let u = 0; u < UTILS; u++) margin.push(new Float64Array(Math.max(1, sizes[u])));
    for (let i = 0; i < sizes[Util.POWER]; i++) {
      margin[Util.POWER][i] = ratio(made[Util.POWER][i], used[Util.POWER][i]);
    }
    for (let p = 0; p < count; p++) {
      if (live[p] === 0) continue;
      const on = this.netOf[Util.POWER][p];
      this.have[Util.POWER][p] = on < 0 ? 0
        : Math.round(Math.max(0, Math.min(1, margin[Util.POWER][on])) * 255);
    }

    // ---- and then the plants that needed it -------------------------------
    for (let p = 0; p < count; p++) {
      if (live[p] === 0) continue;
      const supply = SUPPLY[ASSETS[c.proto[p]]?.id ?? ''];
      if (supply === undefined) continue;
      const running = this.running(p, supply);
      if (running <= 0) continue;
      const onWater = this.netOf[Util.WATER][p];
      const onSewer = this.netOf[Util.SEWAGE][p];
      const onBins = this.netOf[Util.GARBAGE][p];
      if (onWater >= 0) made[Util.WATER][onWater] += (supply.water ?? 0) * running;
      if (onSewer >= 0) made[Util.SEWAGE][onSewer] += (supply.sewage ?? 0) * running;
      if (onBins >= 0) made[Util.GARBAGE][onBins] += (supply.rubbish ?? 0) * running;
    }

    for (let i = 0; i < sizes[Util.WATER]; i++) {
      // Storage smooths a shortfall: a reservoir carries a city through a day of
      // the pumps being short, which is what a reservoir is for.
      const stored = Math.min(1, store[Util.WATER][i] * 0.35);
      margin[Util.WATER][i] = Math.min(1,
        ratio(made[Util.WATER][i], used[Util.WATER][i]) + stored * 0.5);
    }
    for (let i = 0; i < sizes[Util.SEWAGE]; i++) {
      margin[Util.SEWAGE][i] = ratio(made[Util.SEWAGE][i], used[Util.SEWAGE][i]);
    }
    for (let i = 0; i < sizes[Util.GARBAGE]; i++) {
      margin[Util.GARBAGE][i] = ratio(made[Util.GARBAGE][i], used[Util.GARBAGE][i]);
    }

    // ---- what each building actually gets ---------------------------------
    let piled = 0, smelly = 0, cutOff = 0, considered = 0;
    const served = [0, 0, 0, 0];
    const reached = [0, 0, 0, 0];
    for (let p = 0; p < count; p++) {
      if (live[p] === 0) continue;
      considered++;
      let anything = false;
      for (let u = 0; u < UTILS; u++) {
        if (u === Util.GARBAGE) continue;
        const on = this.netOf[u][p];
        if (on >= 0) reached[u]++;
        const v = on < 0 ? 0
          : Math.round(Math.max(0, Math.min(1, margin[u][on])) * 255);
        this.have[u][p] = v;
        if (v >= 200) served[u]++;
        if (on >= 0) anything = true;
      }
      if (!anything) cutOff++;

      // Rubbish is a stock. What the network cannot burn piles up here.
      const onBins = this.netOf[Util.GARBAGE][p];
      if (onBins >= 0) reached[Util.GARBAGE]++;
      const perDay = ((ASSETS[c.proto[p]]?.sim?.garbagePerWeek ?? 0) / 7) * this.occupancy(p);
      const taken = onBins < 0 ? 0 : Math.max(0, Math.min(1, margin[Util.GARBAGE][onBins]));
      this.pile[p] = Math.max(0, this.pile[p] + perDay * (1 - taken) * days);
      const daysHeld = perDay > 0 ? this.pile[p] / perDay : 0;
      if (daysHeld > BIN_DAYS) smelly++;
      piled += this.pile[p];
      // And the rubbish satisfaction a building feels is about its own pile, not
      // about the network's average -- a bin that has been emptied is fine even in
      // a city that is behind.
      const bin = 1 - Math.max(0, Math.min(1, (daysHeld - BIN_DAYS) / (BIN_WORST - BIN_DAYS)));
      const v = Math.round(bin * 255);
      this.have[Util.GARBAGE][p] = v;
      if (v >= 200) served[Util.GARBAGE]++;
    }

    // ---- the readout ------------------------------------------------------
    this.networks.length = 0;
    let spilled = 0;
    for (let u = 0; u < UTILS; u++) {
      for (let i = 0; i < sizes[u]; i++) {
        const n: Network = {
          kind: u, buildings: held[u][i],
          powerMade: 0, powerUsed: 0, waterMade: 0, waterUsed: 0,
          sewageMade: 0, sewageTreated: 0, rubbishMade: 0, rubbishBurnt: 0,
          storeDays: store[u][i],
        };
        if (u === Util.POWER) { n.powerMade = made[u][i]; n.powerUsed = used[u][i]; }
        if (u === Util.WATER) { n.waterMade = made[u][i]; n.waterUsed = used[u][i]; }
        if (u === Util.SEWAGE) {
          n.sewageTreated = made[u][i]; n.sewageMade = used[u][i];
          spilled += Math.max(0, used[u][i] - made[u][i]);
        }
        if (u === Util.GARBAGE) { n.rubbishBurnt = made[u][i]; n.rubbishMade = used[u][i]; }
        this.networks.push(n);
      }
    }

    const r = this.report;
    r.networks = this.networks.length;
    // The largest *power* grid's share, because that is the one a player means by
    // "is my city joined up" -- and because with four sets of networks there is no
    // longer a single largest anything.
    let biggest = 0;
    for (let i = 0; i < sizes[Util.POWER]; i++) {
      if (held[Util.POWER][i] > biggest) biggest = held[Util.POWER][i];
    }
    r.biggest = considered > 0 ? biggest / considered : 0;
    for (let u = 0; u < UTILS; u++) {
      let m = 0, d = 0;
      for (let i = 0; i < sizes[u]; i++) { m += made[u][i]; d += used[u][i]; }
      r.margin[u] = d > 0 ? m / d : m > 0 ? 2 : 1;
      r.served[u] = considered > 0 ? served[u] / considered : 0;
      r.onMain[u] = considered > 0 ? reached[u] / considered : 0;
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
    let n = this.pile.byteLength + this.node.byteLength;
    for (const a of this.have) n += a.byteLength;
    for (const a of this.netOf) n += a.byteLength;
    return n;
  }
}

/** Supply over demand, with nothing demanded counting as satisfied. */
function ratio(made: number, used: number): number {
  if (used <= 0) return 1;
  return made / used;
}

export { Purpose, NO_BRANCH };
