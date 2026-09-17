/**
 * What people do all day, and how they get there.
 *
 * Three things, and they are together because they are one loop: a schedule says
 * where somebody ought to be, a mode choice decides how they would get there, and
 * a trip carries them. Split across three files they would pass the same five
 * numbers back and forth between them.
 *
 * The schedule is a *function*, not a state machine. Given a citizen and the time
 * of day it answers where they belong, and a trip is generated whenever that
 * disagrees with where they are. A state machine with transitions for leaving
 * work, arriving home, going shopping and coming back has four times the states
 * and one failure mode this cannot have: a citizen stuck in a state nobody
 * transitions out of, standing in the street for the rest of their life. Here the
 * worst case is a trip that fails, and the next time the schedule is consulted
 * they simply try again.
 *
 * Personal variation comes from a hash of the citizen's id rather than from a
 * stored field. It costs nothing, it never needs saving, and it is stable -- the
 * same person leaves at the same time every day, which is what makes a rush hour
 * a rush hour rather than a smear.
 *
 * On the budget. Everybody gets a real route: routing is cheap once it is cached,
 * and a city where only the visible cars contribute to congestion has traffic
 * that changes when the camera moves, which is unforgivable. What is budgeted is
 * *individual movement* -- being integrated forward every tick and having a
 * position worth drawing. Past the budget, a traveller is still on a real route
 * and still loading the real lanes; they simply arrive when their journey time
 * says they do instead of being watched doing it.
 */

import { Clock, TICKS_PER_DAY, TICKS_PER_MINUTE, MINUTES_PER_DAY } from './calendar';
import { Places, Purpose, Pool } from './places';
import { People, Doing, Stage, NONE } from './people';
import { Layer, profileOf, NO_PATH } from './path';
import type { TransitNet } from './transit';
import { Router } from './router';
import type { Sink } from './router';
import { Use } from './lanes';
import type { LaneGraph } from './lanes';
import { Rng } from './rand';
import { BRANCHES } from '../../assets/types';

/**
 * How many travellers are moved individually.
 *
 * Six thousand, integrated at ten hertz, is sixty thousand position updates a
 * second and about as many as can usefully be drawn at once anyway. Everybody
 * past it is on a real route and arrives at the right time; they are just not
 * watched on the way. The number is here to be turned down on a weak machine and
 * up on a strong one, and nothing else in the simulation changes when it is.
 */
export const MOVING_BUDGET = 6000;

/** Metres from the camera within which a traveller is worth moving individually. */
export const FOCUS_METRES = 1400;

/** Modes, in the order they are considered. */
export const Mode = {
  WALK: 0,
  BIKE: 1,
  CAR: 2,
  TRANSIT: 3,
} as const;
export const MODE_NAMES = ['walk', 'bike', 'car', 'transit'] as const;
export const MODES = 4;

/** The routing layer each mode travels on. */
const MODE_LAYER = [Layer.FOOT, Layer.BIKE, Layer.CAR, Layer.BUS];

/**
 * What an hour of somebody's time is worth, relative to money.
 *
 * Eight units an hour, which is the number that decides the modal split -- turn it
 * up and everybody takes the fastest option whatever it costs, turn it down and
 * everybody walks. It was four, and four is not enough: the time a car saves over
 * a bicycle was worth less than the cost of the petrol, so nobody in the city ever
 * drove anywhere. That is the failure to watch for here, and it is easy to miss,
 * because a city where everyone cycles still works.
 */
const VALUE_OF_TIME = 8 / 3600;

/**
 * What a trip costs in money, per kilometre and once.
 *
 * The fixed part is the honest reason short trips are walked. It is not a fare --
 * it is the walk to where the car is parked, finding somewhere to park at the
 * other end, getting the bicycle out of the shed, and waiting at the stop. Without
 * it, the fastest mode wins at every distance and a city has people driving two
 * hundred metres to the shop.
 */
const FARE_PER_KM = [0, 0, 0.22, 0.05];
const FARE_FIXED = [0, 0.7, 1.6, 1.4];

/**
 * How unpleasant each mode is per kilometre.
 *
 * Walking is pleasant for a few hundred metres and miserable for five kilometres,
 * which a per-kilometre penalty captures exactly, and it is why nobody walks
 * across the city without anybody having to forbid it.
 */
const DISCOMFORT_PER_KM = [0.9, 0.35, 0.05, 0.3];

/** Reach of each mode in metres. Beyond it, not considered at all. */
const MODE_REACH = [2500, 7000, Infinity, Infinity];

/**
 * The share of people who would get on a bicycle at all.
 *
 * Because whether somebody cycles is mostly about them, not about the trip, and
 * without this the cost model makes cycling the answer for everybody at the
 * distances where it is cheapest -- so the city has no pedestrians in the two
 * kilometres where it should be full of them. Taken from a hash of the person, so
 * the same people always cycle.
 */
const CYCLISTS = 0.45;

/**
 * How much room each mode takes up, in cars.
 *
 * Traffic engineering calls this a passenger car equivalent and a city simulation
 * needs it for one reason: lanes here are shared between everybody, so without it
 * fifteen pedestrians on a twenty-metre footway read as a hundred-and-fifty-per-
 * cent jam and every car in the district reroutes around a pavement with some
 * people on it. A pedestrian is about an eighth of a car's worth of road, a
 * cyclist a fifth, a bus two and a half.
 */
const ROAD_SPACE = [0.12, 0.2, 1, 2.5];



/**
 * The chance somebody goes out on a given day beyond what their schedule forces.
 *
 * Per person *per day*, and the "per day" is the whole point. It used to be a
 * single hash of the citizen, which meant a third of the city shopped every single
 * day and the other two thirds never went anywhere but work for their entire
 * lives -- and the trip rate came out at a fifth of what a city actually
 * generates. Hashing the day in as well costs nothing and gives each person a
 * different mix of days.
 */
const GOES_OUT_PER_DAY = 0.55;

/**
 * How much longer a real journey is than the straight line between its ends.
 *
 * Roads bend, junctions are where they are, and one-way systems exist. A third
 * again is what a grid city actually measures, and it is what an estimated trip
 * uses instead of a route.
 */
const DETOUR = 1.35;

/**
 * The longest an estimated journey may be, in game minutes.
 *
 * A cap, because an estimate multiplied by a congestion factor on a gridlocked
 * network can otherwise produce somebody who is still commuting a week later.
 */
const LONGEST_JOURNEY_MINUTES = 240;

/**
 * Ticks a traveller will wait for a route before giving up and simply arriving.
 *
 * A backstop, and one worth having even though the router always answers. A
 * traveller waiting for a route is indistinguishable from one whose route failed
 * -- both have no route -- so without a deadline any way of losing an answer,
 * now or in some later system, turns into somebody who walks to work for the rest
 * of their life. Sixty ticks is six seconds of real time, far longer than the
 * router's queue ever is, so this only ever fires on something going wrong.
 */
const ROUTE_DEADLINE_TICKS = 60;

/** A cheap stable hash, for the per-citizen variation. */
function hash(i: number): number {
  let h = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}
/** That hash as a fraction in [0, 1). */
const frac = (i: number): number => hash(i) * 2.3283064365386963e-10;

/**
 * Where somebody belongs at this minute of this day.
 *
 * Read this as the city's timetable. The jitter spreads departures over an hour
 * or so, which is the difference between a rush hour and every car in the city
 * setting off on the same tick -- and setting off on the same tick is not merely
 * unrealistic, it is a routing spike big enough to see in the frame time.
 */
export function belongs(stage: number, minute: number, weekend: boolean,
  hasWork: boolean, hasSchool: boolean, night: boolean, jitterMinutes: number,
  discretionary: boolean): number {
  const m = minute;
  switch (stage) {
    case Stage.INFANT:
      return Doing.HOME;

    case Stage.CHILD:
    case Stage.TEEN: {
      if (!weekend && hasSchool) {
        const in0 = 8 * 60 + jitterMinutes * 0.3;
        const out = 15 * 60 + 30 + jitterMinutes * 0.3;
        if (m >= in0 && m < out) return Doing.SCHOOL;
      }
      if (discretionary && m >= 16 * 60 && m < 19 * 60) return Doing.LEISURE;
      return Doing.HOME;
    }

    case Stage.YOUNG:
    case Stage.ADULT: {
      if (hasSchool) {
        // A student in higher education keeps a looser timetable than a school
        // child, which is most of why campuses have traffic all afternoon.
        const in0 = 9 * 60 + jitterMinutes;
        const out = 16 * 60 + jitterMinutes;
        if (!weekend && m >= in0 && m < out) return Doing.SCHOOL;
      } else if (hasWork) {
        if (night) {
          // A night shift: out at nine in the evening, back at six. Expressed as
          // two ranges rather than a wrap, because a wrap-around comparison in
          // here is the kind of thing that is wrong for one hour a day.
          const on = 21 * 60 + jitterMinutes * 0.5;
          if (m >= on || m < 6 * 60 + jitterMinutes * 0.5) return Doing.WORK;
        } else if (!weekend || frac(jitterMinutes + 7) < 0.18) {
          const on = 8 * 60 + 30 + jitterMinutes;
          const off = 17 * 60 + 30 + jitterMinutes;
          if (m >= on && m < off) return Doing.WORK;
        }
      }
      if (discretionary) {
        if (m >= 18 * 60 && m < 21 * 60) return Doing.SHOPPING;
        if (weekend && m >= 11 * 60 && m < 17 * 60) return Doing.LEISURE;
      }
      return Doing.HOME;
    }

    default: {                                     // senior
      if (discretionary && m >= 10 * 60 && m < 16 * 60) {
        return frac(jitterMinutes + 13) < 0.5 ? Doing.SHOPPING : Doing.LEISURE;
      }
      return Doing.HOME;
    }
  }
}

/** Readout. */
export interface TripStats {
  /** Trips begun and finished since founding. */
  started: number;
  arrived: number;
  /** Trips resolved from a distance estimate rather than a route. */
  estimated: number;
  /** Trips that could not be routed at all, by reason. */
  stranded: number;
  noLane: number;
  timedOut: number;
  lostRoute: number;
  /** Trips whose destination could not be chosen. */
  aimless: number;
  /** Travellers moving right now, and how many of those are integrated. */
  travelling: number;
  moving: number;
  /** By mode, since founding. */
  byMode: Int32Array;
  /** Mean journey time in game minutes, smoothed. */
  meanMinutes: number;
}

/**
 * The day.
 *
 * Owns the trips in flight, the lane load they cause, and the budget that decides
 * which of them are moved individually.
 */
export class Routine {
  private readonly rng: Rng;
  /** Travellers being integrated forward. */
  private readonly moving: Pool;
  /** Every traveller in flight, budgeted or not. */
  private readonly inFlight: Pool;
  /** Per-lane saturation, written here and read by the router. */
  readonly load: Float32Array;
  /** Travellers currently on each lane, from which `load` is derived. */
  private readonly onLane: Float32Array;
  /** Nominal travellers a lane carries before it is saturated. */
  private readonly capacity: Float32Array;

  private readonly sink: Sink;
  private readonly sinkId: number;

  /** Camera, or wherever the player is looking. Set by the renderer. */
  focusX = 0;
  focusZ = 0;

  /**
   * The public transport network, once there is one.
   *
   * Attached afterwards rather than taken in the constructor because the
   * dependency is genuinely mutual: what the network is worth depends on who
   * rides it, and who rides it depends on what the network is worth.
   */
  private transit: TransitNet | null = null;
  servedBy(transit: TransitNet): void { this.transit = transit; }

  readonly stats: TripStats = {
    started: 0, arrived: 0, estimated: 0,
    stranded: 0, noLane: 0, timedOut: 0, lostRoute: 0, aimless: 0,
    travelling: 0, moving: 0, byMode: new Int32Array(MODES), meanMinutes: 0,
  };
  private minutesSum = 0;
  private minutesCount = 0;

  /**
   * Trips wanted and trips routed since the weight was last worked out.
   *
   * Their ratio is how much each routed trip has to stand for. Recomputed on a
   * slow tick and smoothed, because a weight that jumps about makes the load on
   * every lane jump with it -- and the router reads that load, so the routes
   * themselves would start flickering between alternatives.
   */
  private demanded = 0;
  private routed = 0;
  /** How many real trips each routed one represents. */
  sampleWeight = 1;
  /** The city's mean lane load, smoothed, for estimating journeys. */
  meanLoadSmoothed = 0;
  /**
   * The worst and the mean load seen at any point since founding.
   *
   * Because the instantaneous figures are worthless as a measure of a city: read
   * them at four in the morning and every road is empty. What a player -- and a
   * test -- wants to know is how bad it gets at eight o'clock.
   */
  peakLoad = 0;
  peakMeanLoad = 0;

  constructor(readonly people: People, readonly places: Places,
    readonly router: Router, readonly lanes: LaneGraph, readonly clock: Clock,
    seed = 0x3b1f77) {
    this.rng = new Rng(seed);
    const cap = Math.max(1024, people.citizens.capacity);
    this.moving = new Pool(cap);
    this.inFlight = new Pool(cap);
    this.load = new Float32Array(lanes.count);
    this.onLane = new Float32Array(lanes.count);
    this.capacity = new Float32Array(lanes.count);
    for (let l = 0; l < lanes.count; l++) {
      // What a lane can carry before it slows: roughly one vehicle every nine
      // metres, which is a jam, scaled down for a lane nobody would queue on.
      this.capacity[l] = Math.max(2, lanes.length[l] / 9);
    }
    this.sink = {
      name: 'citizens',
      // A getter, not the array. The citizen table grows, and growing replaces
      // every column -- so a captured `col.route` is the array the table used to
      // have, and every answer written into it goes nowhere. That is exactly what
      // happened: past four thousand citizens the router kept solving routes
      // correctly and delivering them into a discarded buffer, so four fifths of
      // the city waited for a route that had already arrived. Read it through
      // `col` on every access; `col` itself never changes identity.
      get out(): Int32Array { return people.citizens.col.route; },
      // The token is the citizen's handle, so a request for somebody who died
      // while it was queued is dropped rather than answered into whoever took
      // their row.
      alive: (_slot: number, token: number) => people.citizens.valid(token),
    };
    this.sinkId = router.addSink(this.sink);
  }

  /** Travellers in flight, and the budgeted subset that has a position. */
  get travelling(): number { return this.inFlight.size; }
  get moved(): number { return this.moving.size; }
  /** The `i`th traveller being moved, for the renderer to draw. */
  mover(i: number): number { return this.moving.member(i); }

  // ---- generating trips --------------------------------------------------

  /**
   * Consults the schedule for a slice of the population.
   *
   * `days` is unused deliberately: a schedule is a position in the day, not a
   * rate, so this is the one system in the simulation that does not scale
   * anything by how long it has been since it last ran. What it does need is to
   * run often enough that a departure is not late -- at the BRISK rate a citizen
   * is consulted every eight ticks, which is under a minute of game time.
   */
  plan(budget: number, tripBudget: number): void {
    const c = this.people.citizens.col;
    const live = this.people.citizens.live;
    const bound = this.people.citizens.bound;
    if (bound === 0) return;
    const minute = this.clock.minute;
    const weekend = this.clock.isWeekend;
    const day = this.clock.day;

    // A rolling cursor over a fixed number of rows, rather than a fixed fraction
    // of the population. The difference is what it costs at the top end: a
    // fraction means the work per tick grows with the city, so at a hundred and
    // forty thousand people one tick in nine ran to eight milliseconds -- half a
    // frame -- while the average stayed at one. A fixed budget spends the same
    // time per tick whatever the population; what stretches instead is how often
    // each person's timetable is read, which is the right thing to give up.
    // Never more than one lap: a budget larger than the population would read a
    // small city's timetable several times on the same tick, which is pure waste
    // and was half the cost of a town.
    const rows = budget < bound ? budget : bound;
    let started = 0;
    let id = this.planCursor;
    for (let n = 0; n < rows; n++, id++) {
      // Two budgets, because scanning a timetable is cheap and acting on one is
      // not. Rush hour is when a tenth of the city sets off inside a few ticks,
      // and without a cap on departures those ticks cost four times an ordinary
      // one -- a tick in twelve taking half a frame. Stopping early leaves the
      // cursor where it is, so nobody is skipped; the rush simply spreads over a
      // few more ticks, which is what a rush hour does anyway.
      if (started >= tripBudget) break;
      if (id >= bound) id = 0;
      if (live[id] === 0) continue;
      if (c.doing[id] === Doing.TRAVELLING) continue;

      const jitter = (frac(id) - 0.5) * 110;
      const night = this.worksNights(id);
      const discretionary = frac(id * 2654435761 + day) < GOES_OUT_PER_DAY;
      const want = belongs(c.stage[id], minute, weekend,
        c.work[id] !== NONE, c.study[id] !== NONE, night, jitter, discretionary);
      if (want === c.doing[id]) continue;

      const target = this.placeFor(id, want);
      if (target === NONE) {
        // Nowhere to go for this activity -- no shops built, no park. Stay put
        // rather than counting it as a failure every time the schedule is read.
        if (want === Doing.SHOPPING || want === Doing.LEISURE) continue;
        this.stats.aimless++;
        continue;
      }
      if (target === c.where[id]) { c.doing[id] = want; continue; }
      this.begin(id, target, want);
      started++;
    }
    this.planCursor = id >= bound ? 0 : id;
  }

  /** Where the timetable sweep got to. */
  private planCursor = 0;

  /** Ticks for the sweep to get round everybody, at the current budget. */
  sweepTicks(budget: number): number {
    return Math.max(1, Math.ceil(this.people.citizens.bound / Math.max(1, budget)));
  }

  /** Whether somebody's job is a night shift. */
  private worksNights(id: number): boolean {
    const c = this.people.citizens.col;
    const w = c.work[id];
    if (w === NONE) return false;
    const purpose = this.places.col.purpose[w];
    // Industry and the emergency services run through the night; offices and
    // shops do not. A fifth of the workforce where it applies, which is enough to
    // keep the roads alive at three in the morning without making it rush hour.
    if (purpose !== Purpose.WORKS && purpose !== Purpose.SERVICE) return false;
    return frac(id + 4242) < 0.2;
  }

  /** Where an activity happens, for this person. */
  private placeFor(id: number, doing: number): number {
    const c = this.people.citizens.col;
    switch (doing) {
      case Doing.WORK: return c.work[id];
      case Doing.SCHOOL: return c.study[id];
      case Doing.HOME: {
        const hh = c.house[id];
        return hh === NONE ? NONE : this.people.households.col.home[hh];
      }
      case Doing.SHOPPING: return this.nearbyOfPurpose(id, Purpose.SHOP);
      case Doing.LEISURE: {
        const park = this.nearbyBranch(id, 'parks');
        return park !== NONE ? park : this.nearbyOfPurpose(id, Purpose.SHOP);
      }
      default: return NONE;
    }
  }

  /**
   * Somewhere of a kind, near where they are.
   *
   * Probes rather than searches, and takes the nearest of the probes. A shopper
   * does not go to the mathematically nearest shop and a simulation that makes
   * them do so produces a city where one corner shop serves ten thousand people
   * and the one next to it serves nobody.
   */
  private nearbyOfPurpose(id: number, purpose: number): number {
    const pool = this.places.byPurpose[purpose];
    if (pool.size === 0) return NONE;
    return this.nearestProbe(id, pool, 6);
  }

  private nearbyBranch(id: number, branch: string): number {
    const b = BRANCHES.indexOf(branch as never);
    if (b < 0) return NONE;
    const pool = this.places.byBranch[b];
    if (pool.size === 0) return NONE;
    return this.nearestProbe(id, pool, 4);
  }

  private nearestProbe(id: number, pool: Pool, probes: number): number {
    const c = this.people.citizens.col;
    const col = this.places.col;
    const from = c.where[id];
    const ax = from === NONE ? c.x[id] : col.x[from];
    const az = from === NONE ? c.z[id] : col.z[from];
    let best = NONE, bestD = Infinity;
    for (let k = 0; k < probes; k++) {
      const p = pool.pick(this.rng.next());
      if (p < 0) break;
      if (p === from) continue;
      const dx = col.x[p] - ax, dz = col.z[p] - az;
      const d = dx * dx + dz * dz;
      if (d < bestD) { bestD = d; best = p; }
    }
    return best;
  }

  // ---- mode choice -------------------------------------------------------

  /**
   * How somebody would choose to travel.
   *
   * A generalised cost per mode -- time valued in money, plus the fare, plus how
   * unpleasant it is -- and the cheapest wins, with each cost multiplied by a
   * draw so that two people with the same options do not always make the same
   * choice. That last part is not decoration: without it the split between modes
   * is a step function of distance, so every trip under one number walks and
   * every trip over it drives, and a city has no cyclists in it at all.
   *
   * It is a rough logit. A proper one exponentiates and normalises; this
   * perturbs and takes the minimum, which produces a very similar split for a
   * fraction of the arithmetic and is being asked millions of times.
   */
  chooseMode(id: number, metres: number,
    ax = 0, az = 0, bx = 0, bz = 0): number {
    const c = this.people.citizens.col;
    const hh = c.house[id];
    const cars = hh === NONE ? 0 : this.people.households.col.cars[hh];
    const stage = c.stage[id];
    const km = metres / 1000;

    let bestMode: number = Mode.WALK;
    let bestCost = Infinity;
    for (let m = 0; m < MODES; m++) {
      if (metres > MODE_REACH[m]) continue;
      if (m === Mode.CAR) {
        // A child cannot drive and a household without a car has none to use.
        if (cars === 0) continue;
        if (stage < Stage.YOUNG) continue;
      }
      if (m === Mode.BIKE) {
        if (stage === Stage.INFANT || stage === Stage.SENIOR) continue;
        if (frac(id + 0x51de) > CYCLISTS) continue;
      }
      const speed = profileOf(MODE_LAYER[m]).top;
      let seconds = metres / speed;
      // A car is faster than its top speed suggests it is not: junctions, parking
      // and the walk at either end.
      if (m === Mode.CAR) seconds = seconds * 1.35 + 180;
      if (m === Mode.TRANSIT) {
        // The real journey on the real network: the walk to the nearest stop of
        // a line that also passes the other end, half a headway of waiting, the
        // ride, and the walk off. Minus one means no line goes there, which is
        // not an expensive option -- it is not an option.
        //
        // This used to be the distance over a guessed speed plus a guessed wait,
        // which meant a city with one bus stop in it had a bus service and a city
        // with a hundred had the same one.
        const real = this.transit === null ? -1 : this.transit.journey(ax, az, bx, bz);
        if (real < 0) continue;
        seconds = real;
      }

      const cost = seconds * VALUE_OF_TIME
        + FARE_FIXED[m] + FARE_PER_KM[m] * km
        + DISCOMFORT_PER_KM[m] * km;
      const perturbed = cost * (0.8 + this.rng.next() * 0.45);
      if (perturbed < bestCost) { bestCost = perturbed; bestMode = m; }
    }
    return bestMode;
  }

  // ---- running trips -----------------------------------------------------

  /** Starts somebody on a journey. */
  private begin(id: number, target: number, doing: number): void {
    const c = this.people.citizens.col;
    const col = this.places.col;
    const from = c.where[id];
    const ax = from === NONE ? c.x[id] : col.x[from];
    const az = from === NONE ? c.z[id] : col.z[from];
    const metres = Math.hypot(col.x[target] - ax, col.z[target] - az);

    c.target[id] = target;
    const bx = col.x[target], bz = col.z[target];
    const mode = this.chooseMode(id, metres, ax, az, bx, bz);
    c.mode[id] = mode;
    // A fare taken. Counted here rather than on arrival because what crowds a
    // line is the people getting on it, and somebody who has decided to catch a
    // bus is on the platform whether or not they have got there yet.
    if (mode === Mode.TRANSIT) this.transit?.board(ax, az, bx, bz);
    const layer = MODE_LAYER[mode];

    // Which lane each end hangs off depends on how they are travelling: a car
    // leaves from the carriageway and a pedestrian from the footway, and a
    // building on a motorway slip road has one and not the other.
    const wantFoot = layer === Layer.FOOT || layer === Layer.BIKE;
    const startLane = from === NONE ? NONE : (wantFoot ? col.foot[from] : col.lane[from]);
    const endLane = wantFoot ? col.foot[target] : col.lane[target];
    if (startLane === NONE || endLane === NONE || startLane < 0 || endLane < 0) {
      // No way onto the network for this mode. Arrive anyway rather than leaving
      // somebody permanently unable to go to work because their house fronts a
      // road no pedestrian may use -- but count it, because a city full of these
      // is a bug in the place table and should be visible.
      this.stats.stranded++;
      this.stats.noLane++;
      this.settle(id, target, doing);
      return;
    }

    c.doing[id] = Doing.TRAVELLING;
    c.step[id] = 0;
    c.along[id] = 0;
    c.x[id] = ax; c.z[id] = az;
    c.setOff[id] = this.clock.tick;
    c.guess[id] = 0;
    this.inFlight.add(id);
    this.stats.started++;
    this.stats.byMode[mode]++;
    this.demanded++;

    // Individually moved only if the budget has room and the player could see
    // them. Everybody else is still routed and still loads the roads.
    if (this.moving.size < MOVING_BUDGET) {
      const dx = ax - this.focusX, dz = az - this.focusZ;
      if (dx * dx + dz * dz < FOCUS_METRES * FOCUS_METRES) {
        c.detail[id] = 1;
        this.moving.add(id);
      } else {
        c.detail[id] = 0;
      }
    } else {
      c.detail[id] = 0;
    }

    // A real route, if the router has room for the request. If not, the trip is
    // worked out the cheap way -- and that is the whole answer to scale. A city of
    // a hundred thousand people wants a hundred and forty routes a tick and no
    // budget can answer that, so the ones that cannot be routed are estimated
    // from the distance and the mode, arrive when they should, and are not drawn.
    // The load they would have put on the roads is not lost: the routed trips are
    // a sample, and their contribution is scaled up by how small a sample they
    // are, so congestion is right even when nine trips in ten are estimated.
    const urgent = false;
    if (this.router.request(layer, startLane, endLane, this.sinkId, id,
      this.people.citizens.handle(id), urgent)) {
      this.routed++;
      return;
    }
    this.estimate(id, metres, mode);
  }

  /**
   * Resolves a trip without a route: distance, detour, mode speed, congestion.
   *
   * The congestion term is the city's average lane load rather than the load on
   * the roads this trip would actually use, because it does not know which those
   * are. That is the cost of the estimate and it is the right thing to give up: a
   * traveller nobody is watching needs to take about the right time, not exactly
   * the right time.
   */
  private estimate(id: number, metres: number, mode: number): void {
    const c = this.people.citizens.col;
    c.guess[id] = 1;
    const p = profileOf(MODE_LAYER[mode]);
    const jam = 1 + this.meanLoadSmoothed * p.jam;
    const seconds = (metres * DETOUR / p.top) * jam;
    const minutes = Math.min(LONGEST_JOURNEY_MINUTES, seconds / 60);
    c.arriveAt[id] = this.clock.tick + Math.max(1, Math.round(minutes * TICKS_PER_MINUTE));
    this.stats.estimated++;
  }

  /**
   * Moves everybody who is in flight along.
   *
   * Two populations in one pass. A traveller with a position is integrated along
   * their route; one without has a journey time and arrives when it is up. The
   * split is invisible from outside: both take the same route, both spend the same
   * time on it, and both put the same load on the same lanes.
   */
  travel(ticks: number): void {
    const c = this.people.citizens.col;
    const g = this.lanes;
    const store = this.router.paths;
    // Game seconds this tick: a day of ticks is a day of game time.
    const gameSeconds = (ticks / TICKS_PER_DAY) * 24 * 60 * 60;

    for (let i = this.inFlight.size - 1; i >= 0; i--) {
      const id = this.inFlight.member(i);
      if (this.people.citizens.live[id] === 0) { this.drop(id); continue; }
      if (c.guess[id] === 1) {
        // Estimated: they arrive when the estimate says they do.
        if (this.clock.tick >= c.arriveAt[id]) {
          this.settle(id, c.target[id], this.doingFor(id));
        }
        continue;
      }
      const route = c.route[id];
      if (route === NO_PATH) {
        // Still waiting on the router -- or the answer was that there is no
        // route, which looks the same. Either way, not forever.
        if (this.clock.tick - c.setOff[id] > ROUTE_DEADLINE_TICKS) {
          this.stats.stranded++;
          this.stats.timedOut++;
          this.settle(id, c.target[id], this.doingFor(id));
        }
        continue;
      }
      const n = store.length(route);
      if (n === 0) {
        // The route was freed or never existed. Arrive, rather than stall.
        this.stats.stranded++;
        this.stats.lostRoute++;
        this.settle(id, c.target[id], this.doingFor(id));
        continue;
      }

      // First tick on a route: claim the lanes it uses so the load is felt for
      // the whole journey rather than only where the traveller happens to be.
      if (c.step[id] === 0 && c.along[id] === 0 && c.held[id] === NO_PATH) {
        this.claim(route, ROAD_SPACE[c.mode[id]]);
        c.held[id] = route;
      }

      let step = c.step[id];
      let along = c.along[id];
      let budget = gameSeconds;
      while (budget > 0 && step < n) {
        const lane = store.at(route, step);
        if (lane < 0) break;
        const speed = this.speedOn(lane, c.mode[id]);
        const left = g.length[lane] - along;
        const need = left / speed;
        if (need > budget) { along += speed * budget; budget = 0; break; }
        budget -= need;
        step++; along = 0;
      }
      c.step[id] = Math.min(0xffff, step);
      c.along[id] = along;

      if (step >= n) {
        this.claim(route, -ROAD_SPACE[c.mode[id]] * this.sampleWeight);
        this.settle(id, c.target[id], this.doingFor(id));
        continue;
      }
      if (c.detail[id] === 1) {
        const lane = store.at(route, step);
        if (lane >= 0) {
          const t = along / Math.max(1, g.length[lane]);
          c.x[id] = g.ax[lane] + (g.bx[lane] - g.ax[lane]) * t;
          c.z[id] = g.az[lane] + (g.bz[lane] - g.az[lane]) * t;
        }
      }
    }

    this.stats.travelling = this.inFlight.size;
    this.stats.moving = this.moving.size;
    this.stats.meanMinutes = this.minutesCount > 0
      ? this.minutesSum / this.minutesCount : 0;
  }

  /** Metres a second on a lane, for a mode, allowing for how busy it is. */
  private speedOn(lane: number, mode: number): number {
    const p = profileOf(MODE_LAYER[mode]);
    const free = Math.min(this.lanes.speed[lane], p.top);
    const jam = this.load[lane] * p.jam;
    // Halves at capacity, and never stops entirely -- a speed of zero is a
    // traveller who never arrives, and one of those is a permanent leak.
    return Math.max(free * 0.12, free / (1 + jam));
  }

  /** What somebody will be doing when they get there. */
  private doingFor(id: number): number {
    const c = this.people.citizens.col;
    const t = c.target[id];
    if (t === NONE) return Doing.HOME;
    const hh = c.house[id];
    if (hh !== NONE && this.people.households.col.home[hh] === t) return Doing.HOME;
    if (c.work[id] === t) return Doing.WORK;
    if (c.study[id] === t) return Doing.SCHOOL;
    return this.places.col.purpose[t] === Purpose.SHOP ? Doing.SHOPPING : Doing.LEISURE;
  }

  /** Ends a journey. */
  private settle(id: number, target: number, doing: number): void {
    const c = this.people.citizens.col;
    this.noteJourney((this.clock.tick - c.setOff[id]) / TICKS_PER_MINUTE);
    c.guess[id] = 0;
    if (target !== NONE) {
      c.where[id] = target;
      c.x[id] = this.places.col.x[target];
      c.z[id] = this.places.col.z[target];
    }
    c.doing[id] = doing;
    c.target[id] = NONE;
    this.drop(id);
    this.stats.arrived++;
  }

  /**
   * Takes somebody out of flight, lets go of their route, and gives back the road
   * space they were occupying.
   *
   * The road space has to be released *here* rather than where a journey finishes
   * normally, because a journey can end several other ways -- a route that timed
   * out, a route that was freed, a road edit that voided every route in the city --
   * and each of those left the traveller's load on the lanes for the rest of the
   * session. A city at a hundred thousand read as eight hundred per cent congested
   * on roads with nobody on them, which then made the router send everybody the
   * long way round.
   *
   * `held` is the route the load was claimed against, not the current one, because
   * those can differ: a traveller whose request was answered twice has claimed
   * against the first.
   */
  private drop(id: number): void {
    const c = this.people.citizens.col;
    if (c.held[id] !== NO_PATH) {
      this.claim(c.held[id], -ROAD_SPACE[c.mode[id]]);
      c.held[id] = NO_PATH;
    }
    if (c.route[id] !== NO_PATH) {
      this.router.release(c.route[id]);
      c.route[id] = NO_PATH;
    }
    c.detail[id] = 0;
    this.moving.remove(id);
    this.inFlight.remove(id);
  }

  /**
   * Adds or removes one traveller's worth of road space along a route.
   *
   * Unweighted, deliberately. The sample weight changes as the city grows, and
   * claiming with one weight and releasing with another leaves a residue on every
   * lane that never goes away. So `onLane` counts routed travellers and the weight
   * is applied once, in `publish`, where it can change without corrupting anything.
   */
  private claim(route: number, delta: number): void {
    const store = this.router.paths;
    const n = store.length(route);
    for (let i = 0; i < n; i++) {
      const lane = store.at(route, i);
      if (lane < 0) continue;
      const now = this.onLane[lane] + delta;
      this.onLane[lane] = now < 0.0001 ? 0 : now;
      this.load[lane] = this.onLane[lane] * this.sampleWeight / this.capacity[lane];
    }
  }

  /** Rewrites every lane's load after the sample weight changed. */
  private publish(): void {
    const n = this.load.length;
    for (let l = 0; l < n; l++) {
      this.load[l] = this.onLane[l] === 0 ? 0
        : this.onLane[l] * this.sampleWeight / this.capacity[l];
    }
  }

  /**
   * Rebalances which travellers are moved individually.
   *
   * Run on a slow tick as the camera moves: travellers who have gone out of view
   * give up their place in the budget to ones who have come into it. Without this
   * the budget fills once with whoever happened to be near the camera at the start
   * and the streets the player is actually looking at stay empty.
   */
  refocus(): void {
    const c = this.people.citizens.col;
    const reach = FOCUS_METRES * FOCUS_METRES;
    // Out first, so the places freed can be filled in the same pass.
    for (let i = this.moving.size - 1; i >= 0; i--) {
      const id = this.moving.member(i);
      const dx = c.x[id] - this.focusX, dz = c.z[id] - this.focusZ;
      if (dx * dx + dz * dz > reach * 2.25) { c.detail[id] = 0; this.moving.remove(id); }
    }
    for (let i = 0; i < this.inFlight.size && this.moving.size < MOVING_BUDGET; i++) {
      const id = this.inFlight.member(i);
      if (c.detail[id] === 1) continue;
      const dx = c.x[id] - this.focusX, dz = c.z[id] - this.focusZ;
      if (dx * dx + dz * dz < reach) { c.detail[id] = 1; this.moving.add(id); }
    }
  }

  /**
   * The network changed under everybody.
   *
   * Every route in flight names lanes that have been renumbered, so they are all
   * void. Travellers are put down where they were going: teleporting a few
   * thousand people is jarring for one frame, and the alternative -- letting them
   * follow a route that now means something else -- is cars driving through
   * buildings, which is jarring for the rest of the session.
   */
  rebind(lanes: LaneGraph): void {
    const c = this.people.citizens.col;
    for (let i = this.inFlight.size - 1; i >= 0; i--) {
      const id = this.inFlight.member(i);
      this.settle(id, c.target[id], this.doingFor(id));
    }
    (this as { lanes: LaneGraph }).lanes = lanes;
    const n = lanes.count;
    (this as { load: Float32Array }).load = new Float32Array(n);
    (this as unknown as { onLane: Float32Array }).onLane = new Float32Array(n);
    const cap = new Float32Array(n);
    for (let l = 0; l < n; l++) cap[l] = Math.max(2, lanes.length[l] / 9);
    (this as unknown as { capacity: Float32Array }).capacity = cap;
  }

  /**
   * Works out how much each routed trip has to stand for.
   *
   * Called on a slow tick. Smoothed towards the new ratio rather than set to it,
   * and capped: past about sixty-four the sample is too thin for the number to
   * mean anything, and a city in that state has bigger problems than the accuracy
   * of its congestion model.
   */
  reweigh(): void {
    if (this.demanded > 0 && this.routed > 0) {
      const want = Math.max(1, Math.min(64, this.demanded / this.routed));
      const before = this.sampleWeight;
      this.sampleWeight += (want - this.sampleWeight) * 0.25;
      if (Math.abs(this.sampleWeight - before) > 0.01) this.publish();
    }
    this.demanded = 0;
    this.routed = 0;
    const mean = this.meanLoad();
    this.meanLoadSmoothed += (mean - this.meanLoadSmoothed) * 0.3;
    if (mean > this.peakMeanLoad) this.peakMeanLoad = mean;
    const worst = this.worstLoad();
    if (worst > this.peakLoad) this.peakLoad = worst;
  }

  /** Records a finished journey's length, for the readout. */
  private noteJourney(minutes: number): void {
    this.minutesSum += minutes;
    this.minutesCount++;
    if (this.minutesCount > 4096) { this.minutesSum /= 2; this.minutesCount /= 2; }
  }

  /** The busiest lanes, for a congestion readout. */
  worstLoad(): number {
    let worst = 0;
    for (let l = 0; l < this.load.length; l++) if (this.load[l] > worst) worst = this.load[l];
    return worst;
  }

  /** Mean load over lanes that carry anybody. */
  meanLoad(): number {
    let sum = 0, n = 0;
    for (let l = 0; l < this.load.length; l++) {
      if (this.onLane[l] > 0.01) { sum += this.load[l]; n++; }
    }
    return n === 0 ? 0 : sum / n;
  }

  bytes(): number {
    return this.load.byteLength + this.onLane.byteLength + this.capacity.byteLength
      + this.moving.bytes() + this.inFlight.bytes();
  }
}

/** Re-exported so a caller can size a lane load array without importing lanes. */
export { Use, MINUTES_PER_DAY };
