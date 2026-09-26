/**
 * The dispatch machine: things go wrong, and somebody is sent.
 *
 * Fires, crimes, medical calls, bins that need emptying, bodies that need
 * collecting. Five different services, one machine -- because they are the same
 * problem with different numbers in it. Something raises a request at a building;
 * the nearest station of the right branch with a crew free sends a vehicle; the
 * vehicle drives the real road network to get there, does its work, and drives
 * home. If nobody comes in time, the thing that was going wrong goes wrong.
 *
 * WHY IT IS ONE FILE AND NOT FIVE. Everything that distinguishes a fire from a
 * burglary is in `NEEDS`: which branch answers it, what it drives, how long it
 * takes on scene, how long the city has before it turns bad, and what "bad" means.
 * Adding a sixth service is a row in that table. The alternative -- a fire system,
 * a police system, an ambulance system -- is five copies of the same dispatch
 * logic that drift apart, which is how a city builder ends up with an ambulance
 * that obeys red lights and a fire engine that does not.
 *
 * DRIVEN OR ON PAPER, AND WHY BOTH. A city of a hundred thousand raises hundreds
 * of calls an hour. Driving every one of them is tens of thousands of vehicles and
 * a routing bill nobody can pay, and it would buy nothing: the player cannot watch
 * a fire engine in a district they are not looking at. So there is a hard cap.
 * Calls near the camera get a real vehicle on a real route through real junctions,
 * with priority at every one of them. Everything else is resolved on paper -- it
 * still takes time, it still depends on whether the district is covered, it still
 * counts in the statistics, and it still burns the building down if the answer is
 * no. What the player loses is the animation, and only for the part of the city
 * they are not looking at.
 *
 * That split is also the honest one for the *model*: the paper resolution asks the
 * coverage grid, and the coverage grid is what the player is placing stations
 * against. A driven call and a paper call in the same district get the same answer
 * on average, so the thing on screen is a sample of the thing being counted rather
 * than a separate story.
 *
 * WHAT IT COSTS. One table of live incidents, capped. One pass over a slice of the
 * buildings per visit to raise fires. Counters for the rest. The driven vehicles go
 * through the traffic model that was already running, so they cost what a car
 * costs, and there are at most a hundred and twenty of them.
 */

import { Table } from './store';
import { Places, Purpose } from './places';
import { People } from './people';
import { Services } from './services';
import { Utilities, supplyOf } from './utilities';
import { Traffic, Kind, Driver } from './driving';
import { Router } from './router';
import { Layer, NO_PATH } from './path';
import { Clock, TICKS_PER_DAY } from './calendar';
import { Rng } from './rand';
import { BRANCHES, fleetOf } from '../../assets/types';
import { ASSETS } from '../../assets/registry';
import type { LaneGraph } from './lanes';

/** What has gone wrong. */
export const Need = {
  FIRE: 0,
  CRIME: 1,
  MEDICAL: 2,
  RUBBISH: 3,
  BODY: 4,
} as const;
export const NEED_NAMES = ['fire', 'crime', 'medical', 'rubbish', 'body'] as const;
export const NEEDS_COUNT = NEED_NAMES.length;

/**
 * Where a request has got to.
 *
 * THE TWO CLOCKS, and getting this wrong is the bug that made every call in the
 * city time out. A tick is ninety-six game seconds, and the driving model runs in
 * *real* seconds so that following behaviour looks like following behaviour -- so a
 * fire engine that takes ninety real seconds to cross the city takes two and a half
 * game hours to do it, and no emergency standard can survive that.
 *
 * So the outcome runs on the model clock and the vehicle is the picture of it. The
 * arrival time is the route's own travel time, in game seconds, which the router
 * hands back with the route: it already accounts for the speed of every road and
 * the cost of every turn, so a call across a fast dual carriageway beats one down a
 * lane, and congestion still tells because the routing profile prices it. What the
 * driven vehicle adds is somebody to watch. Tying the outcome to it instead would
 * make emergency response depend on the player's frame rate, which is not a
 * simulation of anything.
 */
/**
 * Fires drawn at once, whatever the city has.
 *
 * A city that has lost its fire service entirely can have hundreds of open
 * calls, and a frame full of smoke columns says less than a dozen of them do.
 */
const MAX_BLAZES = 48;

/** Where the city is burning, as flat arrays the frame reads once. */
export interface FireView {
  count: number;
  x: Float32Array;
  z: Float32Array;
  age: Float32Array;
  /**
   * How far up the plume starts, in metres above the ground.
   *
   * The roof, not the pavement. A fire drawn at the foot of a forty-metre tower
   * is a fire nobody can see: eighteen metres of smoke inside the building it
   * is coming out of.
   */
  lift: Float32Array;
  seed: Int32Array;
}

/** Incidents listed for the interface at once: fires, crimes and medical calls. */
const MAX_INCIDENTS = 96;

/**
 * The emergencies open right now, for the markers over the map.
 *
 * Fires, crimes and medical calls only -- bins and bodies are jobs, not
 * incidents, and a marker over every full bin would bury the ones that matter.
 */
export interface IncidentView {
  count: number;
  kind: Uint8Array;
  /** 0 waiting for anybody, 1 somebody on the way, 2 on scene. */
  state: Uint8Array;
  place: Int32Array;
  x: Float32Array;
  z: Float32Array;
  /** Metres above the ground to hang the marker: the roof. */
  lift: Float32Array;
  /** The lane the building fronts on to, and ticks since it was raised. */
  lane: Int32Array;
  age: Float32Array;
}

/** Something the player should hear about: an emergency opened or ended. */
export interface Happening {
  kind: number;
  place: number;
  /** 'raised', 'answered' (help arrived in time) or 'missed'. */
  what: 'raised' | 'answered' | 'missed';
}

const State = {
  /** Raised, nobody assigned. */
  WAITING: 0,
  /** Somebody is on the way: the clock decides when they arrive. */
  COMING: 1,
  /** They are there, doing the work. */
  WORKING: 2,
} as const;

interface NeedSpec {
  /** Which service answers it. */
  branch: string;
  /** What it drives, and on which network. */
  vehicle: number;
  layer: number;
  /** Game seconds spent at the scene. */
  onScene: number;
  /**
   * Game seconds before it turns bad.
   *
   * Not a response standard -- that lives in `services.ts` and is about placement.
   * This is the point at which the fire has taken the building, the patient has
   * died, the burglar is gone. Missing it is what makes a service worth paying for.
   */
  patience: number;
  /** Requests of this kind waiting before the branch counts as overwhelmed. */
  urgent: boolean;
  /**
   * A narrower test than the branch, where the branch is too broad.
   *
   * Waste plants sit under the power branch -- an energy-from-waste plant really is
   * a power station -- so dispatching bin lorries by branch alone had them setting
   * off from the gas turbines. Anything that can actually take rubbish says so in
   * the supply table, and that is the honest test.
   */
  depot?: (id: string) => boolean;
}

/**
 * The five, and everything that makes them different.
 *
 * The patience figures are the ones worth arguing about, and they are set from what
 * the thing actually is rather than from balance. A house fire is beyond saving in
 * about ten minutes; a cardiac arrest is a matter of minutes too; a burglary is
 * over the moment it is over and the police are there to catch somebody rather than
 * to prevent it, so its patience is long and its failure is mild. Bins and bodies
 * are not emergencies at all -- they are jobs, and what failing them costs is how
 * the street feels to live on.
 */
const NEEDS: NeedSpec[] = [];
NEEDS[Need.FIRE] = {
  branch: 'fire', vehicle: Kind.EMERGENCY, layer: Layer.EMERGENCY,
  onScene: 22 * 60, patience: 11 * 60, urgent: true,
};
NEEDS[Need.CRIME] = {
  branch: 'police', vehicle: Kind.EMERGENCY, layer: Layer.EMERGENCY,
  onScene: 16 * 60, patience: 26 * 60, urgent: true,
};
NEEDS[Need.MEDICAL] = {
  branch: 'health', vehicle: Kind.EMERGENCY, layer: Layer.EMERGENCY,
  onScene: 14 * 60, patience: 9 * 60, urgent: true,
};
NEEDS[Need.RUBBISH] = {
  branch: 'power', vehicle: Kind.LORRY, layer: Layer.CARGO,
  onScene: 4 * 60, patience: 6 * 3600, urgent: false,
  depot: (id) => (supplyOf(id)?.rubbish ?? 0) > 0,
};
NEEDS[Need.BODY] = {
  branch: 'deathcare', vehicle: Kind.LORRY, layer: Layer.CAR,
  onScene: 9 * 60, patience: 8 * 3600, urgent: false,
};

/**
 * Live requests the machine will hold.
 *
 * A cap rather than a queue that grows: a city whose fire service has collapsed
 * raises calls faster than anything can answer them, and the right behaviour is for
 * the overflow to burn rather than for the table to reach a million rows. Overflow
 * is counted, and the count is what the readout shows -- "forty-one calls nobody
 * answered" is the information the player needs, not forty-one table rows.
 */
const MAX_LIVE = 512;

/**
 * Vehicles the machine may have on the road at once.
 *
 * The strict rule the whole design rests on. A hundred and twenty emergency
 * vehicles is more than are ever visible at one time on a screen, and it is a
 * bounded cost: a hundred and twenty routes and a hundred and twenty followers,
 * whatever the city does.
 */
const MAX_VEHICLES = 120;

/**
 * Metres from the camera within which a call is worth driving.
 *
 * Beyond it the vehicle would be invisible and its route a pure cost. Generous
 * rather than tight, because the player can pan and a fire engine that vanishes
 * when the view moves is worse than one that was never drawn.
 */
const DRIVE_RADIUS = 1800;

/** Buildings examined for a fire per visit. A slice, so the cost never grows. */
const WATCH_PER_VISIT = 512;

/**
 * Vehicles sent in one visit.
 *
 * A dispatch route is solved on the spot rather than queued, because an engine that
 * leaves the station a tick after it was called is not worth the machinery -- but a
 * fire service that collapses can have fifty calls assigned in one visit, and fifty
 * cold searches is a two-millisecond spike in the middle of a frame. Six is a
 * third of a millisecond, and the seventh engine leaves a tenth of a second later,
 * which nobody can see.
 */
const SENDS_PER_VISIT = 6;

/**
 * Base rates, per day.
 *
 * Fires per building; crimes and medical calls per thousand residents. Real-world
 * order of magnitude, tuned so that a city of fifty thousand with no services at
 * all is visibly in trouble within a game week rather than within a game year.
 */
const FIRE_PER_BUILDING_DAY = 1 / 1800;
const CRIMES_PER_THOUSAND_DAY = 2.4;
const CALLS_PER_THOUSAND_DAY = 3.1;

/** How much more likely a fire is, by what the building is for. */
const FIRE_HAZARD: number[] = [];
FIRE_HAZARD[Purpose.HOME] = 1;
FIRE_HAZARD[Purpose.SHOP] = 1.5;
FIRE_HAZARD[Purpose.OFFICE] = 0.8;
FIRE_HAZARD[Purpose.WORKS] = 3.2;
FIRE_HAZARD[Purpose.SERVICE] = 0.6;

/** Units of rubbish at a building that gets a lorry sent. */
const BIN_FULL = 6;

/** How much further than the crow flies a vehicle actually drives. */
const DETOUR = 1.35;

/**
 * Filled posts it takes to put one crew on the road.
 *
 * Six, which is about an engine's watch once the shifts are counted -- a station of
 * thirty posts fields five appliances when it is fully staffed and none when it is
 * empty, and that second half is the point.
 */
const POSTS_PER_CREW = 6;

/**
 * How hard a missed call hits the building it happened at.
 *
 * Applied to the building's health, which is what the growth and abandonment model
 * reads -- so an unanswered fire is not a number in a readout, it is a building on
 * its way to being derelict.
 */
const DAMAGE: number[] = [];
DAMAGE[Need.FIRE] = 190;
DAMAGE[Need.CRIME] = 34;
DAMAGE[Need.MEDICAL] = 0;      // it costs a life, not a building
// Small, because unlike a fire these recur: a building nobody ever collects from
// asks again every few hours for as long as the city stands, so each refusal has to
// be a nudge rather than a blow or a fortnight of bad service would flatten a
// district that is merely unpleasant to live in.
DAMAGE[Need.RUBBISH] = 3;
DAMAGE[Need.BODY] = 8;

const SCHEMA = {
  kind: Uint8Array,
  place: Int32Array,
  state: Uint8Array,
  /** Tick it was raised, and the tick the current phase ends. */
  raised: Int32Array,
  ready: Int32Array,
  /** The tick by which somebody has to have arrived, or it has gone wrong. */
  due: Int32Array,
  /** The station that took it, and the vehicle it sent, or -1. */
  station: Int32Array,
  vehicle: Int32Array,
  /** Set when nobody got there in time: the building was lost, or the patient. */
  lost: Uint8Array,
} as const;

/**
 * Ticks a scene stays on screen after its call closes and the crew is there.
 *
 * The outcome runs on the simulation clock, where a tick is ninety-six game
 * seconds, so a house fire is decided in about a second and a half of real
 * time -- long before the engine the player is watching has driven there. The
 * scene lingers for the picture: on the way while the vehicle is still
 * driving, then on scene for this long (thirty seconds at speed one).
 */
const LINGER = 300;

interface Scene {
  kind: number; place: number; vehicle: number; until: number; lost: boolean; told: boolean;
  /** The station the crew came from, and whether their vehicle got there: it drives back when the scene ends. */
  station: number; arrived: boolean;
}

/**
 * How long a crew stays parked at the scene once their vehicle arrives, in
 * ticks, before driving away. A fire keeps the appliance for the whole linger;
 * a patrol car or an ambulance is gone sooner.
 */
const PARKED = 140;

/** `vehicle` on a call whose vehicle has reached the scene and is parked there. */
const ARRIVED = -2;

/** What the machine has been doing, for the readout. */
export interface DispatchStats {
  /** Raised, answered in time, and missed, per kind, since founding. */
  raised: Float64Array;
  answered: Float64Array;
  missed: Float64Array;
  /** Calls dropped because the table was full. Counts as missed as well. */
  overflowed: number;
  /** Live right now: waiting for anybody, and being driven to. */
  waiting: number;
  driving: number;
  /** Vehicles out, and the longest anything has been waiting, in game minutes. */
  vehicles: number;
  worstWaitMinutes: number;
  /** Mean minutes from call to arrival, over the last hundred answered. */
  meanResponseMinutes: number;
}

export class Dispatch {
  readonly table = new Table(SCHEMA, 256);

  /**
   * Which emergencies the city is exposed to yet, by need. A service opens
   * with the city's level (see `tech.ts`), and a fire that breaks out before
   * there is any possibility of a fire station is not a challenge, it is a
   * building lost for nothing -- so fires start when the fire service can be
   * built, crime when the police can, and so on. Bins and bodies are always on.
   * All on by default, for a simulation with no career (the tests); the game
   * sets them from the level.
   */
  readonly exposed = [true, true, true, true, true];

  /** The open emergencies, refreshed with the fires. */
  readonly incidents: IncidentView = {
    count: 0,
    kind: new Uint8Array(MAX_INCIDENTS),
    state: new Uint8Array(MAX_INCIDENTS),
    place: new Int32Array(MAX_INCIDENTS),
    x: new Float32Array(MAX_INCIDENTS),
    z: new Float32Array(MAX_INCIDENTS),
    lift: new Float32Array(MAX_INCIDENTS),
    lane: new Int32Array(MAX_INCIDENTS),
    age: new Float32Array(MAX_INCIDENTS),
  };

  /** Closed calls still being shown, until their crew has been and gone. */
  private scenes: Scene[] = [];

  /** Emergencies opened and closed since the interface last took them. */
  private happened: Happening[] = [];

  /** Takes what has happened since the last call. */
  takeHappenings(): Happening[] {
    const out = this.happened;
    this.happened = [];
    return out;
  }

  private tell(kind: number, place: number, what: Happening['what']): void {
    if (kind > Need.MEDICAL) return;
    if (this.happened.length >= 64) this.happened.shift();
    this.happened.push({ kind, place, what });
  }

  /**
   * Where the city is on fire, for the frame to draw.
   *
   * The same shape and for the same reason as the building sites' view: read
   * once per frame by the renderer, so it is flat arrays reused every time
   * rather than a list of little records allocated sixty times a second for
   * something the eye reads in a tenth of a second.
   */
  readonly blazes: FireView = {
    count: 0,
    x: new Float32Array(MAX_BLAZES),
    z: new Float32Array(MAX_BLAZES),
    /** How long it has been alight, in ticks, for the flame to build. */
    age: new Float32Array(MAX_BLAZES),
    lift: new Float32Array(MAX_BLAZES),
    seed: new Int32Array(MAX_BLAZES),
  };

  /**
   * Refreshes that list from the calls table.
   *
   * A walk over the open calls, which is a couple of hundred rows at the
   * outside -- the table is capped, deliberately, for exactly this kind of
   * reason.
   */
  private lookAtFires(tick: number): void {
    const c = this.table.col;
    const b = this.blazes;
    let n = 0;
    for (let r = 0; r < this.table.bound && n < MAX_BLAZES; r++) {
      if (this.table.live[r] === 0) continue;
      if (c.kind[r] !== Need.FIRE) continue;
      const p = c.place[r];
      if (p < 0) continue;
      b.x[n] = this.places.col.x[p];
      b.z[n] = this.places.col.z[p];
      b.age[n] = Math.max(0, tick - c.raised[r]);
      // At the roof. Two thirds of the way up was the first guess and it is
      // wrong for anything that is not a plain box: on a domed station or a
      // stepped tower, two thirds up is inside the building, and the flame --
      // which is the whole point of the thing -- was hidden by the roof it was
      // supposed to be coming out of.
      const def = ASSETS[this.places.col.proto[p]];
      b.lift[n] = Math.max(1.5, (def?.height ?? 6) * 0.92);
      b.seed[n] = r * 2654435761;
      n++;
    }
    // Scenes whose call has closed: still smoking while the engine is on its
    // way and for a while after, a fire that took the building for longer.
    const live = this.traffic.table.live;
    const role = this.traffic.col.role;
    this.scenes = this.scenes.filter((sc) => {
      if (this.places.live[sc.place] === 0) return false;
      // Its own vehicle, not a later one that was given the same row.
      const driving = sc.vehicle >= 0 && live[sc.vehicle] === 1 && role[sc.vehicle] === sc.kind + 1;
      if (driving) sc.until = Math.max(sc.until, tick + LINGER);
      else {
        if (sc.vehicle >= 0) {
          // Just pulled up: parked at the kerb for the work, then away.
          sc.arrived = true;
          if (sc.kind !== Need.FIRE) sc.until = tick + PARKED;
        }
        sc.vehicle = -1;
        if (!sc.told) { sc.told = true; this.tell(sc.kind, sc.place, 'answered'); }
      }
      if (tick < sc.until) return true;
      if (sc.arrived) this.driveBack(sc.kind, sc.place, sc.station);
      return false;
    });
    for (const sc of this.scenes) {
      if (sc.kind !== Need.FIRE || n >= MAX_BLAZES) continue;
      const p = sc.place;
      b.x[n] = this.places.col.x[p];
      b.z[n] = this.places.col.z[p];
      b.age[n] = LINGER;
      b.lift[n] = Math.max(1.5, (ASSETS[this.places.col.proto[p]]?.height ?? 6) * 0.92);
      b.seed[n] = p * 2654435761;
      n++;
    }
    b.count = n;

    const iv = this.incidents;
    let m = 0;
    for (let r = 0; r < this.table.bound && m < MAX_INCIDENTS; r++) {
      if (this.table.live[r] === 0 || c.kind[r] > Need.MEDICAL) continue;
      const p = c.place[r];
      if (p < 0) continue;
      iv.kind[m] = c.kind[r];
      // On scene only once the drawn vehicle is: the outcome runs on the model
      // clock and can be ahead of the picture, and a crew parked at the kerb while
      // their own vehicle is still three streets away is two of them.
      iv.state[m] = c.state[r] === State.WORKING && c.vehicle[r] >= 0 ? State.COMING : c.state[r];
      iv.place[m] = p;
      iv.x[m] = this.places.col.x[p];
      iv.z[m] = this.places.col.z[p];
      iv.lift[m] = Math.max(4, (ASSETS[this.places.col.proto[p]]?.height ?? 6) + 3);
      iv.lane[m] = this.places.col.lane[p];
      iv.age[m] = Math.max(0, tick - c.raised[r]);
      m++;
    }
    for (const sc of this.scenes) {
      if (m >= MAX_INCIDENTS) break;
      const p = sc.place;
      iv.kind[m] = sc.kind;
      // Still on the way, or there.
      iv.state[m] = sc.vehicle >= 0 ? State.COMING : State.WORKING;
      iv.place[m] = p;
      iv.x[m] = this.places.col.x[p];
      iv.z[m] = this.places.col.z[p];
      iv.lift[m] = Math.max(4, (ASSETS[this.places.col.proto[p]]?.height ?? 6) + 3);
      iv.lane[m] = this.places.col.lane[p];
      iv.age[m] = LINGER * 4;
      m++;
    }
    iv.count = m;
  }
  private readonly rng: Rng;

  /** Crews out, per station. Indexed by place id. */
  private out: Int32Array = new Int32Array(0);
  /** The tick each building last asked for a collection. Indexed by place id. */
  private binAsked: Int32Array = new Int32Array(0);
  /** Where the fire watch got to in the building table. */
  private watchCursor = 0;
  /** The death count the body collector has already dealt with. */
  private seenDeaths = 0;
  /** Vehicles this machine has on the road. */
  private vehicles = 0;
  /**
   * Vehicles driving back to their station with no open call behind them.
   *
   * A set rather than a flag on the vehicle, because the vehicle's `job` column
   * holds a handle and there is no spare value in it that does not turn into an
   * encoding somebody has to decode two years from now.
   */
  private readonly homeward = new Set<number>();
  /** Open requests, as place and kind, so a duplicate is one lookup. */
  private readonly openKeys = new Set<number>();

  /** Camera, so the driven calls are the ones somebody can see. */
  focusX = 0;
  focusZ = 0;

  /** The last hundred response times, in game seconds, as a ring. */
  private readonly responses = new Float64Array(100);
  private responseAt = 0;
  private responseN = 0;

  readonly stats: DispatchStats = {
    raised: new Float64Array(NEEDS_COUNT),
    answered: new Float64Array(NEEDS_COUNT),
    missed: new Float64Array(NEEDS_COUNT),
    overflowed: 0, waiting: 0, driving: 0, vehicles: 0,
    worstWaitMinutes: 0, meanResponseMinutes: 0,
  };

  constructor(
    private places: Places,
    private people: People,
    private services: Services,
    private utilities: Utilities,
    private traffic: Traffic,
    private router: Router,
    private g: LaneGraph,
    private clock: Clock,
    seed = 0x0d15,
  ) {
    this.rng = new Rng(seed ^ 0x9e37);
  }

  /** Live requests. */
  get count(): number { return this.table.size; }

  // ---- raising ------------------------------------------------------------

  /**
   * Looks for things going wrong.
   *
   * Three sources and they work differently on purpose. Fires are a property of
   * *buildings*, so a slice of the building table is examined each visit. Crimes
   * and medical calls are a property of *people*, so they come from a rate against
   * the population and are placed at a building drawn at random -- walking a
   * hundred thousand citizens to find the one who is about to be burgled would be a
   * hundred thousand rows of work for one row of answer. Bins and bodies are
   * consequences of other systems and are read straight off them.
   *
   * @param days game days since the last visit.
   */
  raise(days: number): void {
    if (days <= 0) return;
    if (this.exposed[Need.FIRE]) this.fires(days);
    if (this.exposed[Need.CRIME]) this.crimes(days);
    if (this.exposed[Need.MEDICAL]) this.calls(days);
    this.bins();
    this.bodies();
  }

  /** A slice of the buildings, checked for catching alight. */
  private fires(days: number): void {
    const c = this.places.col;
    const n = this.places.count;
    if (n === 0) return;
    const look = Math.min(WATCH_PER_VISIT, n);
    // The slice is a fraction of the table, so the rate has to be scaled by how
    // much of the city was actually looked at -- otherwise a big city gets the same
    // number of fires as a small one, which is the classic sampled-rate bug.
    const share = look / n;
    for (let i = 0; i < look; i++) {
      const p = this.watchCursor;
      this.watchCursor = (this.watchCursor + 1) % n;
      if (this.places.live[p] === 0) continue;
      const hazard = FIRE_HAZARD[c.purpose[p]] ?? 1;
      // A building in poor repair burns more readily, which closes the loop: a
      // district the fire service never reaches degrades, and a degraded district
      // catches fire more often.
      const state = 0.7 + 0.9 * (1 - c.health[p] / 255);
      const chance = FIRE_PER_BUILDING_DAY * hazard * state * days / share;
      if (this.rng.next() < chance) this.open(Need.FIRE, p);
    }
  }

  /** Crimes, from the population and what it is doing. */
  private crimes(days: number): void {
    const pop = this.people.population;
    if (pop <= 0) return;
    const idle = this.people.employed >= pop ? 0
      : Math.min(1, 1 - this.people.employed / Math.max(1, pop * 0.62));
    // Idleness raises it and the presence of police lowers it, which is the
    // difference between police as a cleanup service and police as a deterrent.
    // Both, here: coverage suppresses the rate *and* answers what is left.
    const seen = this.branchCoverage('police');
    const rate = CRIMES_PER_THOUSAND_DAY * (pop / 1000) * days
      * (1 + 0.9 * idle) * (1 - 0.5 * seen);
    this.sprinkle(Need.CRIME, rate);
  }

  /** Medical calls, from the population and its age. */
  private calls(days: number): void {
    const pop = this.people.population;
    if (pop <= 0) return;
    // The elderly account for most of the ambulance work, so an ageing city calls
    // more often even if it is not growing -- which is a real thing about cities
    // and something the player can do nothing about except build another clinic.
    const old = this.people.byStage.length > 0
      ? this.people.byStage[this.people.byStage.length - 1] / Math.max(1, pop) : 0;
    const rate = CALLS_PER_THOUSAND_DAY * (pop / 1000) * days * (1 + 1.6 * old);
    this.sprinkle(Need.MEDICAL, rate);
  }

  /**
   * Buildings whose bins are full enough to be worth a lorry.
   *
   * Nothing is raised at all if there is no depot that could answer it. That is not
   * hiding the problem -- a city with no waste capacity is already being punished
   * for it by the utility model, and by the piles themselves, which the rubbish view
   * draws. What it avoids is twenty thousand calls a fortnight that exist only to
   * be dropped, which is noise in every statistic the panel shows.
   */
  private bins(): void {
    const c = this.places.col;
    const n = this.places.count;
    if (n === 0 || !this.anyDepot()) return;
    this.growOut();
    const tick = this.clock.tick;
    const cooldown = Math.max(1, Math.ceil(NEEDS[Need.RUBBISH].patience / 96));
    // The same slice cursor as the fire watch, one step behind it, so both walk the
    // city at the same rate and neither needs a cursor of its own.
    const look = Math.min(WATCH_PER_VISIT, n);
    let at = this.watchCursor;
    for (let i = 0; i < look; i++) {
      const p = at;
      at = (at + 1) % n;
      if (this.places.live[p] === 0 || c.purpose[p] === Purpose.SERVICE) continue;
      if (this.utilities.pileAt(p) < BIN_FULL) continue;
      if (this.hasOpen(Need.RUBBISH, p)) continue;
      // And not again for a while. A collection that was dropped because the table
      // was full leaves no open row behind it, so without this the same overflowing
      // building asks again on every visit -- twenty thousand requests a fortnight
      // in a city with one broken incinerator, every one of them noise in every
      // figure the panel shows.
      if (tick - this.binAsked[p] < cooldown) continue;
      this.binAsked[p] = tick;
      this.open(Need.RUBBISH, p);
    }
  }

  /**
   * Is there a depot anywhere that could take rubbish away.
   *
   * Built, not staffed. A city that has never built a waste plant is not failing to
   * make collections, it has no collection service -- and the utility model already
   * says so, loudly. A city that built one and left it empty *is* failing, and every
   * uncollected bin should say so.
   */
  private anyDepot(): boolean {
    const spec = NEEDS[Need.RUBBISH];
    const b = BRANCHES.indexOf(spec.branch as never);
    if (b < 0) return false;
    const pool = this.places.byBranch[b];
    const c = this.places.col;
    for (let i = 0; i < pool.size; i++) {
      const p = pool.member(i);
      if (spec.depot !== undefined && !spec.depot(ASSETS[c.proto[p]]?.id ?? '')) continue;
      return true;
    }
    return false;
  }

  /** Somebody died since the last visit. */
  private bodies(): void {
    const died = this.people.deaths - this.seenDeaths;
    this.seenDeaths = this.people.deaths;
    if (died <= 0) return;
    this.sprinkle(Need.BODY, died);
  }

  /**
   * Raises `rate` requests of a kind at buildings drawn at random.
   *
   * The fractional part is a coin toss rather than a rounding, so a city small
   * enough to expect a tenth of a crime a day gets one every ten days instead of
   * none ever -- which is the difference between a village being quiet and a
   * village being outside the model.
   */
  private sprinkle(kind: number, rate: number): void {
    let n = Math.floor(rate);
    if (this.rng.next() < rate - n) n++;
    for (let i = 0; i < n; i++) {
      const p = this.places.homes.pick(this.rng.next());
      if (p >= 0) this.open(kind, p);
    }
  }

  /**
   * Is there already one of these at this building.
   *
   * A set, not a walk. The bin watch asks this five hundred times a visit and the
   * table holds five hundred rows, so the obvious version is a quarter of a million
   * comparisons every visit in exactly the city -- one whose waste plants have
   * stopped -- where it is asked most often.
   */
  private hasOpen(kind: number, place: number): boolean {
    return this.openKeys.has(place * NEEDS_COUNT + kind);
  }

  /** Opens a request, or counts it as overflowed. */
  private open(kind: number, place: number): void {
    this.stats.raised[kind]++;
    if (this.table.size >= MAX_LIVE) {
      // Nobody is coming and the table will not hold it. It still happened, and it
      // still damages the building -- the cap bounds the bookkeeping, not the city.
      this.stats.overflowed++;
      this.stats.missed[kind]++;
      this.hurt(place, kind);
      return;
    }
    const r = this.table.add();
    this.openKeys.add(place * NEEDS_COUNT + kind);
    const c = this.table.col;
    c.kind[r] = kind;
    c.place[r] = place;
    c.state[r] = State.WAITING;
    c.raised[r] = this.clock.tick;
    c.ready[r] = 0;
    c.due[r] = this.clock.tick + Math.max(1, Math.ceil(NEEDS[kind].patience / 96));
    c.station[r] = -1;
    c.vehicle[r] = -1;
    c.lost[r] = 0;
    this.tell(kind, place, 'raised');
  }

  // ---- dispatching --------------------------------------------------------

  /**
   * Assigns what is waiting.
   *
   * Nearest free station wins, by straight line: the catchment model is a straight
   * line and dispatch has to agree with it, or the map would promise a cover the
   * dispatcher would not honour. The *journey* is the road network, at emergency
   * speed and with priority at every junction -- which is the part that ought to
   * depend on the roads, and does.
   */
  assign(): void {
    const c = this.table.col;
    const pc = this.places.col;
    this.growOut();
    let sent = 0;
    for (let r = 0; r < this.table.bound; r++) {
      if (this.table.live[r] === 0 || c.state[r] !== State.WAITING) continue;
      const kind = c.kind[r];
      const spec = NEEDS[kind];
      const place = c.place[r];
      if (this.places.live[place] === 0) { this.close(r, false); continue; }

      const station = this.nearestFree(spec, pc.x[place], pc.z[place]);
      if (station < 0) {
        // No station of that branch with a crew free. The call is not lost -- it
        // waits, and `resolve` decides in time whether waiting was fatal.
        continue;
      }

      // Somebody is going, one way or the other. Whether a vehicle is drawn for it
      // changes nothing about the answer -- see the note on `State`.
      c.station[r] = station;
      c.state[r] = State.COMING;
      this.out[station]++;

      const drive = this.nearCamera(pc.x[place], pc.z[place])
        && this.vehicles < MAX_VEHICLES && sent < SENDS_PER_VISIT;
      let seconds = -1;
      if (drive) {
        seconds = this.send(r, station, spec);
        if (seconds >= 0) sent++;
      }
      if (seconds < 0) {
        // No vehicle, or no route to put one on. The travel time is the straight
        // line with a detour factor, at the speed the vehicle would have driven --
        // the same figure the routed version produces, to within the bend of the
        // roads, so the driven calls are a sample of the whole rather than a
        // separate and luckier population.
        const metres = Math.hypot(pc.x[place] - pc.x[station], pc.z[place] - pc.z[station]);
        const speed = spec.layer === Layer.EMERGENCY ? 15 : 9;
        seconds = (metres * DETOUR) / speed;
      }
      c.ready[r] = this.clock.tick + Math.max(1, Math.ceil(seconds / 96));
    }
  }

  /**
   * Puts a real vehicle on the road. Returns the journey in game seconds, or -1.
   *
   * The seconds are the router's own estimate for the route it just solved, which
   * prices every road's speed limit and every turn -- so a station on the far side
   * of a one-way system reads as far away, and the map and the outcome agree.
   */
  private send(r: number, station: number, spec: NeedSpec): number {
    const c = this.table.col;
    const pc = this.places.col;
    const from = pc.lane[station];
    const to = pc.lane[c.place[r]];
    if (from < 0 || to < 0 || from >= this.g.count || to >= this.g.count) return -1;
    const h = this.router.solveNow(spec.layer, from, to);
    if (h === NO_PATH) return -1;
    const seconds = this.router.seconds;
    // A pushy driver, because that is what they are: the emergency profile already
    // ignores the limit and the junction model already gives them priority, and a
    // cautious following model on top of both reads as an ambulance with no hurry.
    const v = this.traffic.spawn(station, spec.vehicle, Driver.PUSHY, from, h, 0);
    if (v < 0) { this.router.release(h); return -1; }
    this.traffic.col.job[v] = this.table.handle(r);
    this.traffic.col.role[v] = c.kind[r] + 1;
    c.vehicle[r] = v;
    this.vehicles++;
    return seconds > 0 ? seconds : -1;
  }

  /** The nearest station that can answer this, with a crew to spare, or -1. */
  private nearestFree(spec: NeedSpec, x: number, z: number): number {
    const b = BRANCHES.indexOf(spec.branch as never);
    if (b < 0) return -1;
    const pool = this.places.byBranch[b];
    const c = this.places.col;
    let best = -1, bestD = Infinity;
    for (let i = 0; i < pool.size; i++) {
      const p = pool.member(i);
      if (this.out[p] >= this.crews(p)) continue;
      if (spec.depot !== undefined && !spec.depot(ASSETS[c.proto[p]]?.id ?? '')) continue;
      const dx = c.x[p] - x, dz = c.z[p] - z;
      const d = dx * dx + dz * dz;
      if (d < bestD) { bestD = d; best = p; }
    }
    return best;
  }

  /**
   * Crews a station can field.
   *
   * From the posts actually *filled*, not from the posts the building has. That
   * distinction is the whole difference between a fire service and a fire-station-
   * shaped building: the first version of this counted the posts, so a station
   * nobody worked at answered every call in the city and switching the fire service
   * off changed nothing at all. Six staff to a crew, and a station below that
   * fields none.
   */
  private crews(place: number): number {
    const pc = this.places.col;
    const def = ASSETS[pc.proto[place]];
    const staff = pc.working[place];
    if (def === undefined) return Math.floor(staff / POSTS_PER_CREW);
    // The station's own fleet, crewed in proportion to the posts filled: a full
    // station fields every vehicle it has, a half-staffed one half of them, and
    // one below a crew's worth of staff fields none.
    if (staff < POSTS_PER_CREW) return 0;
    const jobs = Math.max(staff, def.sim?.jobs ?? staff);
    return Math.max(1, Math.floor(fleetOf(def) * staff / jobs + 0.34));
  }

  private nearCamera(x: number, z: number): boolean {
    const dx = x - this.focusX, dz = z - this.focusZ;
    return dx * dx + dz * dz < DRIVE_RADIUS * DRIVE_RADIUS;
  }

  private growOut(): void {
    if (this.out.length >= this.places.count) return;
    const size = Math.max(64, this.places.count * 2);
    const next = new Int32Array(size);
    next.set(this.out);
    this.out = next;
    const asked = new Int32Array(size).fill(-1 << 20);
    asked.set(this.binAsked);
    this.binAsked = asked;
  }

  // ---- resolving ----------------------------------------------------------

  /**
   * Moves everything on: arrivals, work finished, and calls that ran out of time.
   *
   * Called every tick. Cheap: a walk over at most five hundred rows, and most of
   * them are doing nothing but waiting.
   */
  resolve(): void {
    this.drain();
    const c = this.table.col;
    const tick = this.clock.tick;
    // Before the pass that closes them, so a fire that is put out this tick is
    // still drawn burning for the frame that shows the engine arriving.
    this.lookAtFires(tick);
    let waiting = 0, driving = 0, worst = 0;

    for (let r = 0; r < this.table.bound; r++) {
      if (this.table.live[r] === 0) continue;
      const spec = NEEDS[c.kind[r]];
      const state = c.state[r];

      if (state === State.WORKING) {
        if (tick >= c.ready[r]) this.finishWork(r);
        continue;
      }

      const waited = (tick - c.raised[r]) * 96 / 60;
      if (waited > worst) worst = waited;
      if (state === State.WAITING) waiting++; else driving++;

      // Nobody is going to arrive in time. Judged the moment it becomes true rather
      // than on arrival, because a fire that is past saving is past saving whether
      // or not the engine eventually turns up -- and the crew still attends, which
      // is why this does not close the row.
      if (tick > c.due[r]) { this.miss(r); continue; }

      // Arrived. On the clock, not on the vehicle: see the note on `State`.
      if (state === State.COMING && tick >= c.ready[r]) this.onScene(r, spec);
    }

    const s = this.stats;
    s.waiting = waiting;
    s.driving = driving;
    s.vehicles = this.vehicles;
    s.worstWaitMinutes = worst;
    let sum = 0;
    for (let i = 0; i < this.responseN; i++) sum += this.responses[i];
    s.meanResponseMinutes = this.responseN > 0 ? sum / this.responseN / 60 : 0;
  }

  /**
   * Reads what the traffic model did with the machine's vehicles.
   *
   * `arrived` and `stuck` are rebuilt by every `drive`, so this has to run after it
   * and before the next one. A vehicle that arrived has either reached the scene or
   * reached home; a vehicle that is stuck has nowhere left to go, which on a road
   * that was just demolished under it is the correct answer.
   */
  private drain(): void {
    for (const v of this.traffic.arrived) this.reap(v, true);
    for (const v of this.traffic.stuck) this.reap(v, false);
  }

  /**
   * One of the machine's vehicles finished, one way or another.
   *
   * `made` says whether it got where it was going. Either way it comes off the road
   * and its route goes back -- the one rule that has to hold on every path out of
   * here, because a vehicle removed without its handle released leaks a path into an
   * arena that only ever grows.
   */
  private reap(v: number, made: boolean): void {
    const tc = this.traffic.col;
    const job = tc.job[v];
    const homeward = this.homeward.delete(v);
    if (job < 0 && !homeward) return;         // not one of ours
    const h = tc.route[v];
    this.traffic.despawn(v);
    this.vehicles--;
    if (h !== NO_PATH) this.router.release(h);
    if (homeward) return;

    const r = this.rowOf(job);
    if (r < 0) return;                        // the call closed under it
    const c = this.table.col;
    // Arriving changes nothing about the outcome -- the clock decided that. What
    // it changes is that the crew is at the scene: parked there, drawn by the
    // frame, until the call closes and its scene has lingered, and then driven
    // back (see `scenes`).
    c.vehicle[r] = made ? ARRIVED : -1;
  }

  /** The row a vehicle's job handle points at, or -1 if it has gone. */
  private rowOf(handle: number): number { return this.table.deref(handle); }

  /** Somebody got there in time. */
  private onScene(r: number, spec: NeedSpec): void {
    const c = this.table.col;
    this.record((this.clock.tick - c.raised[r]) * 96);
    this.stats.answered[c.kind[r]]++;
    c.state[r] = State.WORKING;
    c.ready[r] = this.clock.tick + Math.max(1, Math.ceil(spec.onScene / 96));
    // The work itself, done on arrival rather than on departure: a bin emptied is
    // emptied when the lorry is there, and a player watching it should see the pile
    // go at that moment and not twenty minutes later.
    this.doWork(r);
  }

  /** What being attended actually changes. */
  private doWork(r: number): void {
    const c = this.table.col;
    const place = c.place[r];
    if (this.places.live[place] === 0) return;
    if (c.kind[r] === Need.RUBBISH) this.utilities.collect(place);
    // A fire put out still did damage, just far less than one that was not.
    if (c.kind[r] === Need.FIRE) this.hurt(place, Need.FIRE, 0.18);
  }

  /**
   * The work is done. The call closes; the vehicle, if there is one, drives home.
   *
   * The two are deliberately separate. The station's crew is free the moment the
   * job is finished, which is what the dispatcher cares about, and the drive back
   * is scenery -- a vehicle still on the road when the row closes keeps going and
   * despawns when it arrives, which is what `drain` does with a dangling handle.
   */
  private finishWork(r: number): void {
    // A crew with a vehicle at the scene leaves from the scene, after it has
    // been seen there; `close` hands that to the scenes list.
    if (this.table.col.vehicle[r] !== ARRIVED) this.driveHome(r);
    this.close(r, false);
  }

  /** Sends the vehicle back to its station, for the look of it. */
  private driveHome(r: number): void {
    const c = this.table.col;
    if (c.vehicle[r] >= 0) return;
    this.driveBack(c.kind[r], c.place[r], c.station[r]);
  }

  /** A crew leaving a scene for their station, at ordinary speed. */
  private driveBack(kind: number, place: number, station: number): void {
    const pc = this.places.col;
    if (station < 0 || this.places.live[station] === 0 || this.places.live[place] === 0) return;
    if (this.vehicles >= MAX_VEHICLES) return;
    const spec = NEEDS[kind];
    const from = pc.lane[place];
    const to = pc.lane[station];
    if (from < 0 || to < 0) return;
    const h = this.router.solveNow(spec.layer, from, to);
    if (h === NO_PATH) return;
    // Home at ordinary speed and with no priority: the emergency is over, and a
    // fire engine that runs red lights on the way back is the detail that makes a
    // city builder's traffic look fake.
    const drive = spec.vehicle === Kind.EMERGENCY ? Kind.CAR : spec.vehicle;
    const v = this.traffic.spawn(station, drive, Driver.AVERAGE, from, h, 0);
    if (v < 0) { this.router.release(h); return; }
    // No job handle: the row is about to close and nothing is waiting on this
    // journey. Remembered here instead, so that when it arrives the machine knows
    // the vehicle is its own and gives the route back -- an arrival nobody claims
    // would sit on the road holding a path in the arena forever.
    this.homeward.add(v);
    // Still a fire engine on the way home, just not in a hurry.
    this.traffic.col.role[v] = kind + 1;
    this.vehicles++;
  }

  /** Nobody came in time. */
  private miss(r: number): void {
    const c = this.table.col;
    const kind = c.kind[r];
    this.stats.missed[kind]++;
    c.lost[r] = 1;
    this.tell(kind, c.place[r], 'missed');
    this.hurt(c.place[r], kind);
    // A medical call nobody answered is a death, and it has to be a death in the
    // population rather than a number in a panel -- otherwise a city with no
    // hospital reads as perfectly healthy with a red statistic.
    if (kind === Need.MEDICAL) this.people.killAt(c.place[r]);
    // Somebody is still coming: the crew attends whether or not there is anything
    // left to save, so the row goes to WORKING rather than closing. Which also
    // keeps the station's crew booked out for as long as the job really takes,
    // instead of making a service that misses everything infinitely available.
    if (c.station[r] >= 0) {
      c.state[r] = State.WORKING;
      c.ready[r] = this.clock.tick + Math.max(1, Math.ceil(NEEDS[kind].onScene / 96));
      return;
    }
    this.close(r, false);
  }

  /** Damage, as a fraction of the kind's full weight. */
  private hurt(place: number, kind: number, scale = 1): void {
    if (place < 0 || this.places.live[place] === 0) return;
    const c = this.places.col;
    const hit = (DAMAGE[kind] ?? 0) * scale;
    c.health[place] = Math.max(0, Math.round(c.health[place] - hit));
  }

  /** Takes a request off the books. */
  /**
   * Takes a request off the books and gives the station its crew back.
   *
   * A vehicle still on the road is deliberately left alone: its handle no longer
   * resolves, so `reap` will take it off and release its route when it gets where
   * it was going. Killing it here would make an engine vanish mid-street the moment
   * a fire was declared a loss, which is both ugly and untrue -- the crew still
   * attends, they are simply too late to save anything.
   */
  private close(r: number, answered: boolean): void {
    void answered;
    const c = this.table.col;
    // The scene outlives the call; see LINGER.
    if (c.kind[r] <= Need.MEDICAL && this.scenes.length < MAX_INCIDENTS) {
      this.scenes.push({
        kind: c.kind[r], place: c.place[r], vehicle: c.vehicle[r] >= 0 ? c.vehicle[r] : -1,
        station: c.station[r], arrived: c.vehicle[r] === ARRIVED,
        until: this.clock.tick + LINGER, lost: c.lost[r] === 1,
        // The good news waits for the crew to be seen arriving.
        told: c.lost[r] === 1 || c.vehicle[r] < 0,
      });
      if (c.vehicle[r] === ARRIVED && c.kind[r] !== Need.FIRE) this.scenes[this.scenes.length - 1].until = this.clock.tick + PARKED;
      if (c.lost[r] === 0 && c.vehicle[r] < 0 && c.station[r] >= 0) this.tell(c.kind[r], c.place[r], 'answered');
    }
    this.openKeys.delete(c.place[r] * NEEDS_COUNT + c.kind[r]);
    this.freeStation(r);
    this.table.remove(r);
  }

  private freeStation(r: number): void {
    const c = this.table.col;
    const s = c.station[r];
    if (s >= 0 && s < this.out.length && this.out[s] > 0) this.out[s]--;
  }

  private record(seconds: number): void {
    this.responses[this.responseAt] = Math.max(0, seconds);
    this.responseAt = (this.responseAt + 1) % this.responses.length;
    if (this.responseN < this.responses.length) this.responseN++;
  }

  /** Mean coverage of a branch over the city, for the rates that depend on it. */
  private branchCoverage(branch: string): number {
    const b = BRANCHES.indexOf(branch as never);
    if (b < 0) return 0;
    return Math.min(1, this.services.cover[b].served);
  }

  /**
   * Share of calls answered in time, per kind, since founding.
   *
   * The one number that says whether a service is working. Distinct from coverage,
   * which says whether a station is near enough -- a city can be fully covered and
   * still miss half its calls, because every engine was already out.
   */
  rate(kind: number): number {
    const raised = this.stats.raised[kind];
    return raised > 0 ? this.stats.answered[kind] / raised : 1;
  }

  /**
   * The roads changed, so every route in flight names lanes that are gone.
   *
   * Vehicles are dropped rather than re-routed. A vehicle whose lane no longer
   * exists has no position to re-route *from*, and the call it was answering is
   * still open -- so it goes back in the queue and something is sent again, which
   * is both correct and what a player who just demolished a street would expect.
   */
  rebind(g: LaneGraph, traffic: Traffic): void {
    // Called *before* the traffic model is rebound, and that order is load bearing:
    // rebinding it removes every vehicle without giving its route back, so the last
    // moment at which these handles can be released is now.
    const tc = this.traffic.col;
    for (let v = 0; v < this.traffic.bound; v++) {
      if (this.traffic.live[v] === 0) continue;
      if (tc.job[v] < 0 && !this.homeward.has(v)) continue;
      if (tc.route[v] !== NO_PATH) this.router.release(tc.route[v]);
    }
    this.homeward.clear();
    this.vehicles = 0;

    this.g = g;
    this.traffic = traffic;
    const c = this.table.col;
    for (let r = 0; r < this.table.bound; r++) {
      if (this.table.live[r] === 0) continue;
      c.vehicle[r] = -1;
    }
  }

  /** A building went. Anything happening at it is over. */
  forget(place: number): void {
    const c = this.table.col;
    for (let r = 0; r < this.table.bound; r++) {
      if (this.table.live[r] === 0 || c.place[r] !== place) continue;
      this.close(r, false);
    }
  }

  bytes(): number {
    return this.table.bytes() + this.out.byteLength + this.binAsked.byteLength
      + this.responses.byteLength;
  }
}

export { TICKS_PER_DAY };
