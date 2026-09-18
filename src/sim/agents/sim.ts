/**
 * The simulation, assembled.
 *
 * Every part of it is in its own file and none of them know about each other's
 * schedules. This is where they are given one, and the schedule is most of the
 * performance story -- so the rates below are the numbers to read if the question
 * is "what does a tick cost".
 *
 * Two different things are called a rate here and confusing them is the classic
 * way this kind of loop ends up stuttering.
 *
 *   A system's *rate* is how often the whole system runs. Migration runs every
 *   thirty-two ticks because it is cheap and nothing it decides needs to happen
 *   sooner than three seconds.
 *
 *   A system's *period* is how long it takes to get round the whole population.
 *   The life system runs every single tick and looks at one two-hundred-and-
 *   fifty-sixth of the citizens each time. That is the important one: a system
 *   that runs rarely and then walks a hundred thousand rows is a hundred thousand
 *   rows of work on one tick, which is a visible hitch however rare it is. A
 *   system that runs always and walks four hundred rows is the same work spread
 *   flat, and that is what makes the frame time a line instead of a comb.
 *
 * So anything that walks the population runs every tick with a stride, and
 * anything that does not runs on its own rate. The cost per citizen per game day
 * is fixed either way; what changes is whether it arrives all at once.
 */

import { Scheduler, Rate, slice, TICK_SECONDS, TICK_HZ } from './tick';
import { Clock, TICKS_PER_DAY } from './calendar';
import { buildLaneGraph, buildLaneIndex, laneBytes, indexBytes } from './lanes';
import type { LaneGraph, LaneIndex } from './lanes';
import { Router } from './router';
import { Places, buildPlaces, reconcilePlaces, relinkPlaces } from './places';
import { People, NONE } from './people';
import { Migration } from './migration';
import { Routine } from './routine';
import { Junctions } from './junctions';
import { Traffic } from './driving';
import { Utilities, Util } from './utilities';
import { Services } from './services';
import { Dispatch } from './dispatch';
import { Demand } from './demand';
import { Growth } from './growth';
import { Complaints, GRIPE_INFO } from './complaints';
import { Movers } from './movers';
import { TransitNet } from './transit';
import { Transit } from '../transit';
import { Economy } from './economy';
import { ASSETS } from '../../assets/registry';
import { Budget } from '../budget';
import { BRANCHES } from '../../assets/types';
import { Views, View } from './views';

/** Which service branch a coverage view is about, for bringing it up to date. */
const VIEW_BRANCH: Record<number, string> = {
  [View.FIRE]: 'fire', [View.POLICE]: 'police', [View.HEALTH]: 'health',
  [View.EDUCATION]: 'education', [View.PARKS]: 'parks',
  [View.TRANSPORT]: 'transport',
};
import type { Stat } from './views';
import { Stage } from './people';
import type { RoadGraph } from '../roadgraph';
import type { City, Dirty } from '../city';
import type { World } from '../world';

/**
 * Ticks to get round the whole population, per system.
 *
 * Life is the slowest because ageing, illness and death do not need to be checked
 * often -- a quarter of a game day is far finer than anything a player could
 * perceive. Trip planning is the fastest because being late for work by more than
 * a few game minutes is visible in the traffic.
 */
const PERIOD = {
  /** Ageing, health, death, finding work and school. */
  life: 256,
  /** Household mood, leaving, and children. */
  house: 128,
} as const;

/**
 * Citizens whose timetable is read each tick.
 *
 * A count, not a fraction, which is the whole point: the cost of this is then the
 * same on a village and on a metropolis, and what changes instead is how often
 * anybody is asked. Two thousand a tick gets round a city of twenty thousand in
 * ten ticks -- sixteen game minutes -- and one of a hundred and forty thousand in
 * seventy, which is an hour and a quarter. Somebody can therefore be an hour late
 * leaving for work in a very large city, which is invisible next to the hour and a
 * half that personal variation already spreads departures over, and it is the
 * difference between a tick that costs the same all game and one that grows until
 * it takes half a frame.
 */
const PLAN_PER_TICK = 2000;

/**
 * Trips that may begin in one tick.
 *
 * Separate from the scan budget because beginning a trip is twenty times the work
 * of deciding not to: a destination to choose, a mode to cost, lanes to find and a
 * route to ask for. Two hundred and fifty a tick is two hundred and twenty-five
 * thousand a day, comfortably above what a city of a hundred and forty thousand
 * actually generates, so nothing is ever lost -- but it flattens the morning peak,
 * which without it is four times an average tick.
 */
const TRIPS_PER_TICK = 250;

/** Milliseconds of each tick the router may spend, and how many routes at most. */
/**
 * Milliseconds of each tick the router may spend, and how many routes at most.
 *
 * A little over a millisecond, because the tick is a tenth of a second but the
 * *frame* is a sixtieth, and a router that spends three milliseconds lands in some
 * frame and takes a fifth of it. Anything the budget cannot route is estimated instead, so the only thing
 * lowering it costs is the accuracy of individual journeys -- congestion stays
 * right, because the routed trips are scaled up as the sample they are.
 */
const ROUTE_BUDGET_MS = 1.2;
const ROUTE_BUDGET_COUNT = 600;

/**
 * Vehicles driven one at a time.
 *
 * Fewer than the six thousand pedestrians and cyclists the flow model can move,
 * because a vehicle is far more work: a leader to read, a junction to ask about, a
 * following model to integrate. Two and a half thousand fills the streets of a
 * district at the distance a player looks at one from, and nothing outside that
 * district would be drawn anyway.
 */
const VEHICLE_BUDGET = 2500;

/**
 * Vehicles put on or taken off the road per tick.
 *
 * Because the alternative is a hundred cars appearing on one tick when the camera
 * moves, which is both a visible pop and a spike in the frame it lands on.
 */
const VEHICLES_PER_TICK = 24;

export interface SimReport {
  when: string;
  population: number;
  households: number;
  jobs: string;
  unemployment: number;
  happiness: number;
  appeal: number;
  queue: number;
  perDay: string;
  travelling: number;
  memory: string;
}

/**
 * What one building is, for the panel that shows it when it is clicked.
 *
 * Flat and already resolved -- names rather than indices, shares rather than
 * raw bytes -- because the interface should not have to know how the tables are
 * laid out to draw a card about a house.
 */
export interface Inspection {
  place: number;
  name: string;
  zone: string;
  density: string;
  branch: string | undefined;
  x: number;
  z: number;
  /** Lot size in 8 m cells, for drawing the selection over it. */
  footprint: [number, number];
  residents: number;
  homes: number;
  workers: number;
  jobs: number;
  /** How much of each utility this building is getting, 0 to 1. */
  power: number;
  water: number;
  sewage: number;
  /** And whether a main of each reaches it at all. */
  onMain: [boolean, boolean, boolean];
  /** Days of uncollected rubbish standing outside. */
  rubbish: number;
  /** The building's worst complaint, if it has one. */
  gripe: string;
  gripeWhat: string;
  gripeFix: string;
  cover: Array<{ name: string; share: number }>;
}

export class Simulation {
  readonly clock = new Clock();
  readonly scheduler = new Scheduler();
  lanes: LaneGraph;
  index: LaneIndex;
  readonly router: Router;
  readonly places: Places;
  readonly people: People;
  readonly migration: Migration;
  readonly routine: Routine;
  junctions: Junctions;
  traffic: Traffic;
  readonly utilities: Utilities;
  readonly services: Services;
  readonly dispatch: Dispatch;
  readonly demand: Demand;
  /**
   * What turns zoned land into buildings, or undefined when there is no world.
   *
   * The tools and the tests build a simulation over a `City` alone, which is a
   * city that already exists and has nothing left to grow into. Only a game has a
   * world underneath it, and only a game grows.
   */
  readonly growth: Growth | undefined;
  /** The projection of the traffic and the travellers into drawable rows. */
  private readonly movers = new Movers();
  /** What each building is complaining about, for the bubbles over them. */
  readonly complaints: Complaints;
  /** The bus and tram network the player has drawn, running. */
  readonly transit: TransitNet;
  /** Where the money comes from and where it goes. */
  readonly economy: Economy;
  /** The treasury it moves. The world's, when there is one. */
  readonly budget: Budget;
  readonly views: Views;
  /** The information view the player has open, or View.NONE. */
  openView: number = View.NONE;

  /** The player's time control. 0 is paused. */
  speed = 1;

  private readonly displaced: number[] = [];

  /** Nodes in the road graph, kept so a rewire does not need the graph passed in. */
  private nodes = 0;

  /** The last day the fares were counted on. */
  private lastDay = -1;

  /** The state the city is derived from, or undefined for a test with no world. */
  private world: World | undefined;

  constructor(city: City, net: RoadGraph, seed = 0x1b0b0, world?: World) {
    this.world = world;
    const mains = world?.mains;
    this.nodes = net.nodes.length;
    this.lanes = buildLaneGraph(net);
    this.index = buildLaneIndex(this.lanes);
    this.places = buildPlaces(city, this.lanes, this.index);
    // The cache is sized to the city, not to a constant. Routes are keyed by where
    // they start and end, and a city with thirty thousand buildings has hundreds
    // of thousands of distinct journeys -- a fixed thirty-two thousand entries
    // thrashed down to a thirty per cent hit rate, which then made every trip a
    // cold search and the whole routing budget useless.
    // Sized from the housing built rather than the buildings, because what fills
    // the cache is distinct journeys and there are a few of those per household.
    let entries = 1 << 15;
    // Four per household, capped. Eight gave an eighty per cent hit rate and held
    // forty-five megabytes of routes alive to do it; four gives most of the hit
    // rate for half the memory, and the arena is the larger cost of the two.
    while (entries < this.places.homeCapacity * 4 && entries < (1 << 19)) entries *= 2;
    this.router = new Router(this.lanes, entries);
    this.people = new People(seed, this.places, this.clock);
    this.migration = new Migration(this.people, this.places, this.clock, seed ^ 0x5eed);
    this.routine = new Routine(this.people, this.places, this.router, this.lanes,
      this.clock, seed ^ 0x707e);
    this.junctions = new Junctions(this.lanes, net.nodes.length);
    this.traffic = new Traffic(this.lanes, this.junctions, VEHICLE_BUDGET, seed ^ 0xca25);
    this.traffic.informedBy(this.routine.load, this.router.paths);
    this.utilities = new Utilities(this.places);
    this.services = new Services(this.places, net.grid * 8);
    this.utilities.rewire(this.lanes, net.nodes.length, mains);
    // The population and the migration model now read the real thing rather than
    // their proximity fallbacks. Attached after construction because the dependency
    // is genuinely mutual: what people feel depends on the services, and where the
    // services are needed depends on the people.
    this.dispatch = new Dispatch(this.places, this.people, this.services,
      this.utilities, this.traffic, this.router, this.lanes, this.clock, seed ^ 0xd15);
    this.people.informedBy(this.services, this.utilities);
    this.migration.informedBy(this.services, this.utilities);
    this.demand = new Demand(this.places, this.people, this.migration);
    this.complaints = new Complaints(this.places, this.people, this.utilities,
      this.services);
    // A world with no lines in it still gets a network: the tool adds them while
    // the game is running, and a null to check at every call site is worse than
    // an object with nothing in it.
    this.transit = new TransitNet(world?.transit ?? new Transit(), this.places,
      this.router, this.lanes, this.index, this.traffic);
    this.routine.servedBy(this.transit);
    this.complaints.servedBy(this.transit);
    // One budget object, whether it came from a world or was made for a test.
    // Two would be the same bug the mains had: the panel reading one balance
    // while the treasury spends another.
    this.budget = world?.budget ?? new Budget();
    this.economy = new Economy(this.budget, this.places, this.people,
      this.migration, this.transit, net, seed ^ 0xec04);
    this.growth = world === undefined ? undefined
      : new Growth(world, this.demand, () => this.people.population);
    this.views = new Views({
      places: this.places, utilities: this.utilities, services: this.services,
      people: this.people, routine: this.routine, traffic: this.traffic,
      junctions: this.junctions, migration: this.migration, lanes: this.lanes,
      dispatch: this.dispatch, economy: this.economy, transit: this.transit,
      budget: this.budget,
      extent: net.grid * 8,
    });
    this.install();
  }

  private install(): void {
    const s = this.scheduler;

    // The clock, first, so everything else this tick agrees about the time.
    s.add({
      name: 'clock', rate: Rate.REALTIME,
      run: () => { this.clock.advance(1); },
    });

    // Routing. Runs every tick with a budget, because a route that is two ticks
    // late is invisible and a tick that solves four hundred routes is not.
    s.add({
      name: 'route', rate: Rate.REALTIME,
      run: () => { this.router.serve(ROUTE_BUDGET_MS, ROUTE_BUDGET_COUNT); },
    });

    // The visible traffic. Driven in *real* seconds, not game seconds, because a
    // tick is ninety-six game seconds and a following model needs a step of well
    // under one -- see the note at the top of driving.ts. So this is the one system
    // in the simulation that does not scale with the game speed: the streets look
    // the same whether the player is watching the clock or racing it.
    s.add({
      name: 'drive', rate: Rate.REALTIME,
      run: (tick) => {
        this.traffic.drive(TICK_SECONDS, tick, tick / TICK_HZ);
      },
    });

    // The signals. Vehicle-actuated, so they need the demand the driving model just
    // measured -- which is why this runs after it rather than before.
    s.add({
      name: 'signals', rate: Rate.FAST,
      run: (tick) => {
        this.junctions.step(tick / TICK_HZ, this.traffic.waiting);
      },
    });

    // How many vehicles there should be, from the congestion the flow model found.
    s.add({
      name: 'cars', rate: Rate.FAST,
      run: () => { this.traffic.populate(VEHICLES_PER_TICK); },
    });

    // Moving. Every tick, all of it: this is the one system whose whole job is to
    // be smooth, and a traveller updated every other tick moves in steps.
    s.add({
      name: 'travel', rate: Rate.REALTIME,
      run: () => { this.routine.travel(1); },
    });

    // The timetable.
    s.add({
      name: 'plan', rate: Rate.REALTIME,
      run: () => { this.routine.plan(PLAN_PER_TICK, TRIPS_PER_TICK); },
    });

    // Lives.
    s.add({
      name: 'life', rate: Rate.REALTIME,
      run: (tick) => {
        const { start, stride } = slice(tick, PERIOD.life);
        this.people.live(start, stride, PERIOD.life / TICKS_PER_DAY);
      },
    });

    // Households.
    s.add({
      name: 'house', rate: Rate.REALTIME,
      run: (tick) => {
        const { start, stride } = slice(tick, PERIOD.house);
        this.people.keepHouse(start, stride, PERIOD.house / TICKS_PER_DAY);
      },
    });

    // Who comes and who goes. Whole, not sliced: it works a queue, not a
    // population, and the queue is short.
    s.add({
      name: 'migrate', rate: Rate.STEADY,
      run: () => { this.migration.run(Rate.STEADY / TICKS_PER_DAY); },
    });

    // How much each routed trip stands for, and how jammed the city is on
    // average. Slow, because both are city-wide numbers that should not twitch.
    s.add({
      name: 'sample', rate: Rate.SLOW,
      run: () => { this.routine.reweigh(); },
    });

    // The utilities: what every network makes and draws, and who that leaves short.
    // Slow, because nothing about a power grid needs to be fresher than a few
    // seconds and the pass is over every building in the city.
    s.add({
      name: 'utility', rate: Rate.SLOW,
      run: () => { this.utilities.settle(Rate.SLOW / TICKS_PER_DAY); },
    });

    // Service coverage: one branch's search advanced a bounded amount each time, so
    // it goes round all eleven every few seconds and never costs a spike.
    s.add({
      name: 'cover', rate: Rate.FAST,
      run: () => {
        const p = this.people;
        const children = p.byStage[Stage.INFANT] + p.byStage[Stage.CHILD]
          + p.byStage[Stage.TEEN];
        this.services.refresh(p.population, children, this.places.workers);
      },
    });

    // Things going wrong. Slow, because a fire every few game seconds is already
    // far more than a city has and the pass walks a slice of the buildings.
    s.add({
      name: 'raise', rate: Rate.SLOW,
      run: () => { this.dispatch.raise(Rate.SLOW / TICKS_PER_DAY); },
    });

    // Sending somebody. Between the two, so a call raised this second is on its way
    // within a couple of ticks rather than waiting out a slow system's period.
    s.add({
      name: 'assign', rate: Rate.FAST,
      run: () => { this.dispatch.assign(); },
    });

    // Arrivals, work finished and calls that ran out of time. Every tick, and
    // deliberately after `drive`: the traffic model rebuilds its arrived and stuck
    // lists on every call, so reading them a tick late would read the wrong tick's.
    s.add({
      name: 'respond', rate: Rate.REALTIME,
      run: () => { this.dispatch.resolve(); },
    });

    // The view the player has open, rebuilt as the numbers behind it move.
    s.add({
      name: 'views', rate: Rate.BRISK,
      run: (tick) => {
        if (this.openView !== View.NONE) this.views.build(this.openView, tick);
      },
    });

    // Which travellers are worth moving individually.
    s.add({
      name: 'focus', rate: Rate.BRISK,
      run: () => { this.routine.refocus(); },
    });

    // The money. Slow, because a budget is a weekly thing and the pass over the
    // service buildings is the one walk in it -- and because a treasury that
    // twitched several times a second would be unreadable while it did.
    s.add({
      name: 'money', rate: Rate.SLOW,
      run: () => { this.economy.settle(Rate.SLOW / TICKS_PER_DAY); },
    });

    // The buses. Keeping the fleets on the road, which is bounded by what the
    // player has paid for, and re-planning only when a line or a road moved.
    s.add({
      name: 'transit', rate: Rate.FAST,
      run: () => { this.transit.run(); },
    });

    // The day's ridership, rolled over on the day rather than smoothed: the
    // number on the panel says "riders a day" and a running average would
    // disagree with it.
    s.add({
      name: 'fares', rate: Rate.STEADY,
      run: () => {
        const day = this.clock.day;
        if (day === this.lastDay) return;
        this.lastDay = day;
        this.transit.endOfDay();
      },
    });

    // What each building is unhappy about. A slice a visit, like everything else
    // that walks a table, so a city of thirty thousand buildings costs what a
    // village does and gets round them all in a few seconds.
    s.add({
      name: 'gripe', rate: Rate.FAST,
      run: () => { this.complaints.survey(); },
    });

    // What the city is short of. Every input is a running total somebody else
    // already keeps, so this is a dozen divisions -- but the bars are read by a
    // human, and a number that twitches four times a second is unreadable.
    s.add({
      name: 'demand', rate: Rate.BRISK,
      run: () => { this.demand.refresh(); },
    });

    // Zoned land coming up. On STEADY rather than anything faster because each
    // visit that releases something costs a rebuild of the ground it released --
    // the same cost as the player drawing a road -- and three seconds apart is
    // both smooth to watch and cheap to pay for.
    const growth = this.growth;
    if (growth !== undefined) {
      s.add({
        name: 'grow', rate: Rate.STEADY,
        run: () => { growth.grow(Rate.STEADY / TICKS_PER_DAY); },
      });
      // What is still waiting, and where. A whole-map pass, so it would rather
      // be rare -- but the growth budget is shared out by it, and a budget
      // following a map that is twelve seconds out of date spends a quarter of
      // the city's building on land the player zoned and then bulldozed. Every
      // three seconds is a third of a millisecond a second, which is what
      // being right costs.
      s.add({
        name: 'survey', rate: Rate.STEADY,
        run: () => { growth.survey(); },
      });
    }
  }

  /** Spends real time. */
  advance(seconds: number, now = performance.now()): void {
    this.scheduler.advance(seconds, this.speed, now);
  }

  /**
   * Runs exactly `ticks` ticks, for tests and for a deterministic replay.
   *
   * The wall clock is real even though the stepping is not, because the scheduler
   * uses it to roll its per-system cost accounting over -- and passing a constant
   * zero means the accounting never rolls, so the one readout that says which
   * system is eating the tick stays empty. Which is how a five-millisecond tick
   * went uninvestigated for an hour.
   */
  step(ticks: number): void {
    for (let i = 0; i < ticks; i++) {
      this.scheduler.advance(TICK_SECONDS, 1, performance.now());
    }
  }

  /** Opens an information view, or closes them with View.NONE. */
  show(view: number): void {
    this.openView = view;
    if (view === View.NONE) return;
    // A coverage view is brought up to date before it is drawn. Branches take
    // turns, so the one being opened could be most of a second away -- and that
    // second is spent showing a city with no coverage at all, which reads as the
    // click having missed rather than as a queue.
    const branch = VIEW_BRANCH[view];
    if (branch !== undefined) this.services.focus(BRANCHES.indexOf(branch as never));
    this.views.build(view, this.clock.tick);
  }

  /** The grid the renderer tints the ground with. */
  get viewGrid(): Uint8Array { return this.views.grid; }
  /** The statistics panel for whatever is open. */
  get viewStats(): Stat[] { return this.views.stats(this.openView); }

  /**
   * The rectangle growth has released since this was last asked, or null.
   *
   * Asked from outside the tick: acting on it rebuilds the city, and rebuilding
   * the city calls back into the simulation, which must not happen while the
   * scheduler is partway through a tick's systems.
   */
  grew(): Dirty | null { return this.growth?.take() ?? null; }

  /**
   * What is standing at a point on the map, and how it is doing.
   *
   * The one question a city builder has to be able to answer about a building
   * the player is looking at, and until now the game could not: it could paint
   * a map of where power was short and float a bubble over an unhappy roof, but
   * it could not say what *this* is, who is in it, or why it has stopped.
   * Everything below is already in the tables -- this is the join.
   *
   * A linear scan over the places, because a click is not a hot path and a
   * spatial index maintained for one click a minute is an index that is wrong
   * the first time a district is rebuilt.
   */
  inspect(x: number, z: number, within = 40): Inspection | null {
    const c = this.places.col;
    let best = -1, bestD = within * within;
    for (let id = 0; id < this.places.count; id++) {
      if (this.places.live[id] === 0) continue;
      const dx = c.x[id] - x, dz = c.z[id] - z;
      // Against the building's own footprint rather than a fixed radius: a
      // click on the corner of a power station is a click on the power station,
      // and a click forty metres from a terraced house is a click on the street.
      const def = ASSETS[c.proto[id]];
      const half = def === undefined ? 8
        : Math.max(def.footprint[0], def.footprint[1]) * 4;
      const d = dx * dx + dz * dz;
      if (d > (half + 10) * (half + 10)) continue;
      if (d >= bestD) continue;
      bestD = d;
      best = id;
    }
    if (best < 0) return null;
    return this.describe(best);
  }

  /** The report on one building, by place id. */
  private describe(id: number): Inspection {
    const c = this.places.col;
    const def = ASSETS[c.proto[id]];
    const gripe = this.complaints.at(id);
    const info = GRIPE_INFO[gripe];

    // Coverage, for the branches a building is actually judged on. The piped
    // three answer through the utilities instead, and a park's catchment is not
    // a service a house fails without.
    const cover: Array<{ name: string; share: number }> = [];
    for (const branch of ['fire', 'police', 'health', 'education', 'parks']) {
      const b = BRANCHES.indexOf(branch as never);
      if (b < 0) continue;
      cover.push({ name: branch, share: this.services.at(id, b) });
    }

    return {
      place: id,
      name: def?.name ?? 'Building',
      zone: def?.zone ?? 'nature',
      density: def?.density ?? 'low',
      branch: def?.branch,
      x: c.x[id], z: c.z[id],
      footprint: def?.footprint ?? [1, 1],
      residents: c.living[id], homes: c.homes[id],
      workers: c.working[id], jobs: c.jobs[id],
      power: this.utilities.at(id, Util.POWER),
      water: this.utilities.at(id, Util.WATER),
      sewage: this.utilities.at(id, Util.SEWAGE),
      onMain: [
        this.utilities.connected(id, Util.POWER),
        this.utilities.connected(id, Util.WATER),
        this.utilities.connected(id, Util.SEWAGE),
      ],
      rubbish: this.utilities.daysOfRubbish(id),
      gripe: info?.title ?? '',
      gripeWhat: info?.what ?? '',
      gripeFix: info?.fix ?? '',
      cover,
    };
  }

  /**
   * Writes everything that is moving into `out`, and returns how many rows.
   *
   * The renderer hands the same array back every frame and draws whatever is in
   * it through the machinery every other instance goes through. Nothing here is
   * invented for the picture: a car in the list is a car the traffic model is
   * driving, and a figure is a citizen on their way somewhere.
   */
  drawMovers(out: Float32Array, cap: number, eyeX: number, eyeZ: number,
    ground: (x: number, z: number) => number): number {
    return this.movers.fill(out, cap, this.traffic, this.routine, this.people,
      this.lanes, this.router.paths, this.junctions, ground, eyeX, eyeZ);
  }

  /** What the last `drawMovers` drew. */
  get moverCounts(): { vehicles: number; people: number; signals: number; dropped: number } {
    return this.movers.counts;
  }

  /** Founds the city with its first households. */
  found(households = 8): void { this.migration.found(households); }

  /** Where the player is looking, so the movement budget is spent on it. */
  look(x: number, z: number): void {
    this.routine.focusX = x;
    this.routine.focusZ = z;
    this.traffic.focusX = x;
    this.traffic.focusZ = z;
    this.dispatch.focusX = x;
    this.dispatch.focusZ = z;
  }

  /**
   * The roads changed.
   *
   * The lane graph is rebuilt whole and everything that named a lane is void, so
   * the router is rebound, travellers are put down at their destinations, and
   * every building is re-pointed at whatever road now serves it. Places keep their
   * ids throughout -- a road edit must not make the whole city change jobs.
   */
  roadsChanged(net: RoadGraph, world?: World): void {
    if (world !== undefined) this.world = world;
    this.lanes = buildLaneGraph(net);
    this.index = buildLaneIndex(this.lanes);
    this.router.rebind(this.lanes);
    this.routine.rebind(this.lanes);
    this.services.resize(net.grid * 8);
    this.views.rebind(this.lanes);
    this.utilities.rewire(this.lanes, net.nodes.length, this.world?.mains);
    this.nodes = net.nodes.length;
    this.junctions = new Junctions(this.lanes, net.nodes.length);
    // Before the traffic model is rebound: rebinding it drops every vehicle, and
    // the dispatch machine's routes can only be given back while its vehicles
    // still exist to be read.
    this.dispatch.rebind(this.lanes, this.traffic);
    this.traffic.rebind(this.lanes);
    (this.traffic as { junctions: Junctions }).junctions = this.junctions;
    this.traffic.informedBy(this.routine.load, this.router.paths);
    relinkPlaces(this.lanes, this.index, this.places);
    // Last, because it drops every route and every vehicle it held and both of
    // those had to survive long enough for the models above to hand theirs back.
    this.transit.rebind(this.world?.transit ?? new Transit(), this.lanes,
      this.index, this.traffic);
    this.economy.rebind(this.world?.budget ?? this.budget, net, this.transit);
  }

  /**
   * The buildings changed.
   *
   * Reconciled rather than rebuilt, and then everybody who lived or worked in
   * something that is no longer there has to be dealt with. A household whose home
   * was bulldozed is offered another one and leaves the city if there is none,
   * which is the honest outcome: the player demolished their house.
   */
  buildingsChanged(city: City): void {
    const { removed, added } = reconcilePlaces(city, this.lanes, this.index,
      this.places, this.displaced);
    // A new building has to be put on a network before anybody asks whether it has
    // power, and a demolished one has to come off before its supply is counted.
    if (added > 0 || removed.length > 0) {
      this.utilities.rewire(this.lanes, this.nodes, this.world?.mains);
    }
    if (removed.length === 0) return;
    // Anything the machine had open at a building that is no longer there.
    for (const p of removed) this.dispatch.forget(p);
    const people = this.people;
    const cz = people.citizens;
    const hh = people.households;

    // Anybody who worked or studied in one of them is out of a job first, so the
    // capacity is given back before the place is deleted.
    const gone = new Set(removed);
    for (let id = 0; id < cz.bound; id++) {
      if (cz.live[id] === 0) continue;
      if (cz.col.work[id] !== NONE && gone.has(cz.col.work[id])) {
        this.places.fire(cz.col.work[id]);
        cz.col.work[id] = NONE;
        people.employed--;
      }
      if (cz.col.study[id] !== NONE && gone.has(cz.col.study[id])) {
        this.places.unenrol(cz.col.study[id]);
        cz.col.study[id] = NONE;
        people.students--;
      }
    }

    // Then rehouse, or see off.
    for (let h = 0; h < hh.bound; h++) {
      if (hh.live[h] === 0) continue;
      const home = hh.col.home[h];
      if (home === NONE || !gone.has(home)) continue;
      // The place is about to go, so give up the occupancy without touching it.
      hh.col.home[h] = NONE;
      const next = this.places.vacantHomes.pick(people.rng.next());
      if (next >= 0 && people.house(h, next)) continue;
      people.dissolve(h);
      this.migration.departed++;
    }

    for (const id of removed) this.places.remove(id);
  }

  get report(): SimReport {
    const f = this.migration.flow;
    const p = this.places;
    return {
      when: this.clock.label,
      population: this.people.population,
      households: this.people.households.size,
      jobs: `${p.workers}/${p.jobCapacity}`,
      unemployment: this.people.unemployment,
      happiness: this.people.happiness,
      appeal: f.appeal,
      queue: f.queue,
      perDay: `+${f.arrivalsPerDay.toFixed(1)} -${f.departuresPerDay.toFixed(1)}`,
      travelling: this.routine.travelling,
      memory: `${((this.bytes()) / 1048576).toFixed(1)} MiB`,
    };
  }

  bytes(): number {
    return laneBytes(this.lanes) + indexBytes(this.index)
      + this.router.bytes() + this.places.bytes()
      + this.people.bytes() + this.migration.bytes() + this.routine.bytes()
      + this.junctions.bytes() + this.traffic.bytes()
      + this.utilities.bytes() + this.services.bytes() + this.views.bytes()
      + this.dispatch.bytes() + this.complaints.bytes() + this.transit.bytes();
  }
}
