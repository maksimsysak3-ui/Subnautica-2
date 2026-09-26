/**
 * What each building is complaining about.
 *
 * Every other reading in this simulation is about the city: how much power it
 * makes, how far a fire engine has to drive, what the average commute is. Useful,
 * and none of it answers the question a player actually has, which is "what is
 * wrong with *that* one". A coverage map says a district is short of schools. It
 * does not say that the office block on the corner cannot fill its desks because
 * nobody in the city has a degree -- and that is the sentence the player needs,
 * over the building it is about.
 *
 * So: one gripe per building, the worst one, in priority order. A building with
 * no power and no water says "no power", because a player who fixes the power
 * first is right.
 *
 * WHAT IT IS NOT. Not a happiness model -- `people.ts` already has one, and it is
 * about lives rather than buildings. This is a diagnostic: every gripe names a
 * thing the player can go and do, and anything that does not is left out. "Too
 * far from the centre" is true of half the map and is not a gripe.
 *
 * COST. A slice of the buildings each tick, the same way everything else that
 * walks a table works, so a city of thirty thousand buildings costs the same per
 * tick as a village. Each visit is a handful of array reads -- every input is a
 * number somebody else already keeps.
 *
 * The list the interface draws is double-buffered: one is filled over a whole
 * pass, and they swap when the pass ends. Reading a half-rebuilt list is how a
 * bubble ends up over a building that stopped complaining ten seconds ago.
 */

import { RULES } from '../difficulty';
import { Places, Purpose, Teaches } from './places';
import { People, Edu, Stage } from './people';
import { Utilities, Util, supplyOf } from './utilities';
import { ASSETS } from '../../assets/registry';
import { Services, expectedOf } from './services';
import type { TransitNet } from './transit';
import { BRANCHES } from '../../assets/types';

/**
 * The gripes, in the order they are checked.
 *
 * Priority is the order itself, and the order is the order a player should fix
 * them in: nothing works without power and water, a building that is falling down
 * is past being helped by anything else, and the market complaints come last
 * because they are the ones that resolve themselves if the player zones.
 */
export const Gripe = {
  NONE: 0,
  POWER: 1,
  WATER: 2,
  SEWAGE: 3,
  RUBBISH: 4,
  DERELICT: 5,
  FIRE: 6,
  CRIME: 7,
  SICK: 8,
  SCHOOL: 9,
  NO_WORKERS: 10,
  UNEDUCATED: 11,
  NO_CUSTOMERS: 12,
  NO_TRANSPORT: 13,
  /** A plant, and the two ways one silently does nothing. */
  OFFLINE: 14,
  NO_CREW: 15,
} as const;
export const GRIPES = 16;

/** The gripes whose clearing is worth a cheer: the ones a player fixes by building. */
const CHEERED = new Set<number>([Gripe.POWER, Gripe.WATER, Gripe.SEWAGE, Gripe.RUBBISH,
  Gripe.FIRE, Gripe.CRIME, Gripe.SICK, Gripe.SCHOOL, Gripe.NO_TRANSPORT, Gripe.OFFLINE]);
/** Cheers held between takes: the interface only shows a handful anyway. */
const MAX_CHEERS = 96;

export interface GripeInfo {
  /** The word on the card. */
  title: string;
  /** What is actually wrong, in one sentence, about this building. */
  what: string;
  /** What the player should do about it. */
  fix: string;
  /**
   * The icon, by the key the interface's glyph table uses.
   *
   * Service branches and zones both already have one drawn, so a gripe about
   * the fire service gets the fire service's own icon -- which is the icon on
   * the button the player has to press, and that is the whole point of it.
   */
  icon: string;
  /** How bad it is, which decides which bubbles are drawn when there are many. */
  weight: number;
}

export const GRIPE_INFO: Record<number, GripeInfo> = {
  [Gripe.OFFLINE]: {
    title: 'Not connected', icon: 'power', weight: 10,
    what: 'This plant is not on the network it is supposed to feed.',
    fix: 'Run a road to it. The mains follow the streets, and nothing else '
      + 'carries them.',
  },
  [Gripe.NO_CREW]: {
    title: 'No crew', icon: 'workers', weight: 9,
    what: 'Nobody has turned up to run this, so it is barely producing.',
    fix: 'The city has nobody spare, or nobody who can get here. Zone housing '
      + 'nearby, or put a road or a bus between the two.',
  },
  [Gripe.POWER]: {
    title: 'No power', icon: 'power', weight: 9,
    what: 'Nothing here is switched on.',
    fix: 'Run a road to it, or build more generation — the mains follow the streets.',
  },
  [Gripe.WATER]: {
    title: 'No water', icon: 'water', weight: 9,
    what: 'The taps are dry.',
    fix: 'Connect it by road to a water tower or a pumping station, or build another.',
  },
  [Gripe.SEWAGE]: {
    title: 'No drains', icon: 'sewage', weight: 8,
    what: 'There is nowhere for the waste water to go.',
    fix: 'Build a treatment works or an outfall, and a road between here and it.',
  },
  [Gripe.RUBBISH]: {
    title: 'Rubbish piling up', icon: 'rubbish', weight: 7,
    what: 'The bins have not been emptied in days.',
    fix: 'Build an incinerator or a recycling centre, and staff it.',
  },
  [Gripe.DERELICT]: {
    title: 'Falling down', icon: 'desire', weight: 10,
    what: 'This building is failing and will be abandoned.',
    fix: 'Whatever else it is complaining about is why. Fix that.',
  },
  [Gripe.FIRE]: {
    title: 'No fire cover', icon: 'fire', weight: 6,
    what: 'The nearest fire station is too far to get here in time.',
    fix: 'Build a fire station within a few hundred metres.',
  },
  [Gripe.CRIME]: {
    title: 'Crime', icon: 'police', weight: 5,
    what: 'No police station covers this street.',
    fix: 'Build a police station nearby.',
  },
  [Gripe.SICK]: {
    title: 'No doctor', icon: 'health', weight: 6,
    what: 'There is no clinic or hospital within reach.',
    fix: 'Build a clinic. A hospital covers more ground and costs more to run.',
  },
  [Gripe.SCHOOL]: {
    title: 'No school', icon: 'education', weight: 5,
    what: 'The children here have nowhere to go.',
    fix: 'Build a school. Colleges and universities come later and matter for jobs.',
  },
  [Gripe.NO_WORKERS]: {
    title: 'Cannot find staff', icon: 'residential', weight: 4,
    what: 'Most of the jobs here are standing empty.',
    fix: 'Zone more housing, or make the city somewhere people want to move to.',
  },
  [Gripe.UNEDUCATED]: {
    title: 'Nobody qualified', icon: 'education', weight: 4,
    what: 'The work here needs qualifications the city has not got.',
    fix: 'Build colleges and universities. It takes a generation, which is the point.',
  },
  [Gripe.NO_CUSTOMERS]: {
    title: 'No customers', icon: 'commercial', weight: 3,
    what: 'Not enough people live or work within reach to keep this open.',
    fix: 'Zone housing or offices nearby, or put the shops where the people are.',
  },
  [Gripe.NO_TRANSPORT]: {
    title: 'Hard to get to', icon: 'transport', weight: 3,
    what: 'There is no stop or station near enough to be worth walking to.',
    fix: 'Put a stop within a few hundred metres.',
  },
};

/** Which service branch each coverage gripe reads, resolved once. */
const BRANCH = {
  fire: BRANCHES.indexOf('fire'),
  police: BRANCHES.indexOf('police'),
  health: BRANCHES.indexOf('health'),
  education: BRANCHES.indexOf('education'),
  transport: BRANCHES.indexOf('transport'),
};

/**
 * Coverage below this counts as none.
 *
 * Not zero. The coverage grids fall off with distance and load, so a building on
 * the edge of a station's range reads as a fraction rather than as nothing -- and
 * a gripe that only fires at exactly zero would never fire in a city that has
 * built anything at all, which is the city the player is asking about.
 */
const UNCOVERED = 0.22;

/** Utility satisfaction below this is "off", for the same reason. */
const UNSUPPLIED = 0.30;

/**
 * Staffing below which a plant is said to have no crew.
 *
 * Not zero and not full: a plant at a third of its shift is limping, which is
 * worth saying, and one at four fifths has a couple of vacancies, which is not.
 */
const UNSTAFFED = 0.4;

/** Days of rubbish on the kerb before it is worth saying so. */
const RUBBISH_DAYS = 3;

/** Health below this and the building is on its way out. */
const DERELICT_AT = 40;

/** Share of a building's jobs that must be empty before it is a complaint. */
const SHORT_STAFFED = 0.45;

/** And how full a shop has to be failing to be short of customers. */
const NO_TRADE = 0.35;

/**
 * Buildings looked at each visit.
 *
 * A count rather than a fraction, like every other budget here. Twelve hundred a
 * tick gets round a city of thirty thousand buildings in twenty-five ticks, which
 * is four game minutes -- far finer than the rate at which a building's problems
 * change, and flat whatever the size of the city.
 */
const PER_VISIT = 1200;

/** The most bubbles the list will hold. Beyond this the worst ones win. */
const MAX_LISTED = 2048;

export interface Complaint {
  place: number;
  gripe: number;
  x: number;
  z: number;
}

export class Complaints {
  /** The current gripe at each place, indexed by place id. Zero for none. */
  private gripe = new Uint8Array(0);
  /** The finished list the interface reads. */
  private shown: Complaint[] = [];
  /** The one being filled by the pass in progress. */
  private filling: Complaint[] = [];
  private cursor = 0;

  /**
   * Buildings whose need was just met: a gripe that has gone, since the
   * interface last took them. What the smiley faces are drawn from. Only the
   * needs a player fixes by building something -- the market gripes come and
   * go on their own and would cheer at nothing.
   */
  private cheers: Complaint[] = [];

  /** Takes the needs met since the last call. */
  takeCheers(): Complaint[] {
    const out = this.cheers;
    this.cheers = [];
    return out;
  }

  /** How many buildings are complaining, by gripe, as of the last full pass. */
  readonly tally = new Int32Array(GRIPES);
  private counting = new Int32Array(GRIPES);

  constructor(
    private places: Places,
    private people: People,
    private utilities: Utilities,
    private services: Services,
  ) {}

  /**
   * The bus and tram network, once there is one.
   *
   * A stop is not a building, so the coverage model cannot see one -- and
   * without this a city with a bus down every street is still told that none of
   * it is reachable, which is the sort of wrong answer that teaches a player to
   * ignore the bubbles.
   */
  /** Residents below which only the supply is complained about. */
  /** Standard's window is QUIET_UNTIL; the difficulty sets this city's. */
  quietUntil = RULES.quiet;

  private transit: TransitNet | null = null;
  servedBy(transit: TransitNet): void { this.transit = transit; }

  /** The complaints the interface may draw. Do not hold on to the array. */
  get list(): readonly Complaint[] { return this.shown; }

  /** The gripe at one building, for a click on it. */
  at(place: number): number {
    return place >= 0 && place < this.gripe.length ? this.gripe[place] : Gripe.NONE;
  }

  /**
   * Looks at the next slice of buildings.
   *
   * The pass wraps round the whole table and then swaps its list in, so what the
   * interface reads is always one complete sweep rather than a mixture of a new
   * one and whatever is left of the last.
   */
  survey(): void {
    const p = this.places;
    const bound = p.count;
    if (this.gripe.length < bound) {
      const next = new Uint8Array(Math.max(1024, 1 << (32 - Math.clz32(bound))));
      next.set(this.gripe);
      this.gripe = next;
    }
    if (bound === 0) return;

    // The two city-wide facts a per-building gripe needs, read once per visit.
    const b = this.people.byStage;
    const force = (b[Stage.TEEN] ?? 0) * 0.15 + (b[Stage.YOUNG] ?? 0) + (b[Stage.ADULT] ?? 0);
    const idle = Math.max(0, force - this.people.employed);
    // Whether the city has anybody spare at all. A shop that cannot find staff in
    // a city with full employment is short of *people*; one that cannot find them
    // while a tenth of the workforce is out of work is short of the right people,
    // which is a different sentence and usually a different building to put up.
    const spare = force > 0 ? idle / force : 0;
    const grads = (this.people.byEdu[Edu.UNIVERSITY] ?? 0)
      + (this.people.byEdu[Edu.COLLEGE] ?? 0);
    const educated = force > 0 ? grads / force : 0;

    for (let n = 0; n < PER_VISIT; n++) {
      const id = this.cursor;
      this.cursor++;
      if (this.cursor >= bound) {
        // A pass ended. Swap, and start filling the other one.
        this.cursor = 0;
        const done = this.filling;
        this.filling = this.shown;
        this.shown = done;
        this.filling.length = 0;
        this.tally.set(this.counting);
        this.counting.fill(0);
      }
      if (p.live[id] === 0) { this.gripe[id] = Gripe.NONE; continue; }
      const g = this.worst(id, spare, educated);
      const was = this.gripe[id];
      this.gripe[id] = g;
      if (was !== Gripe.NONE && was !== g && CHEERED.has(was) && this.cheers.length < MAX_CHEERS) {
        this.cheers.push({ place: id, gripe: was, x: p.col.x[id], z: p.col.z[id] });
      }
      if (g === Gripe.NONE) continue;
      this.counting[g]++;
      if (this.filling.length < MAX_LISTED) {
        this.filling.push({ place: id, gripe: g, x: p.col.x[id], z: p.col.z[id] });
      }
    }
  }

  /**
   * The one thing most wrong with a building.
   *
   * Ordered, and the order is the order to fix them in. It returns on the first
   * match rather than scoring them, because a bubble can only say one thing and
   * the thing it should say is the one the player should do next.
   */
  private worst(id: number, spare: number, educated: number): number {
    const c = this.places.col;
    const u = this.utilities;
    const purpose = c.purpose[id];
    const jobs = c.jobs[id];
    const homes = c.homes[id];

    // A building with nobody in it and nothing in it is a shed. Services are
    // exempt from the market gripes but not from the utility ones -- a hospital
    // with no water is the most urgent thing on the map.
    const occupied = homes > 0 || jobs > 0;

    // ---- the mains --------------------------------------------------------
    // Asked as "is it connected" first and "is there enough" second, because the
    // two have different answers: a building off the network is a road problem
    // and a building on a network that cannot keep up is a generation problem.
    if (u.at(id, Util.POWER) < UNSUPPLIED) return Gripe.POWER;
    if (u.at(id, Util.WATER) < UNSUPPLIED) return Gripe.WATER;
    if (u.at(id, Util.SEWAGE) < UNSUPPLIED) return Gripe.SEWAGE;

    // ---- a plant that is not doing its job ---------------------------------
    //
    // Checked before everything else a service could complain about, because a
    // power station off the grid is the reason a whole district has no power --
    // and a bubble over the district saying "no power" is the symptom while the
    // one over the plant is the cause. A player who can see only the first
    // spends the evening building more of what they already have.
    const supply = this.producer(id);
    // Power, water and sewage plants always; the rubbish plants only once the
    // town is being told about its bins.
    const quiet = this.people.population < this.quietUntil;
    if (supply !== 0 && !(quiet && supply - 1 === Util.GARBAGE)) {
      // On the network it feeds? A pump on a road with no main under it is a
      // pump with nothing to pump into.
      if (!u.connected(id, supply - 1)) return Gripe.OFFLINE;
      // And staffed enough to matter.
      if (jobs > 0 && c.working[id] / jobs < UNSTAFFED) return Gripe.NO_CREW;
    }

    // ---- everything else waits until the town is a town --------------------
    //
    // A new town hears about its power, its water and its drains, and nothing
    // else: the bins, the staffing, the customers and the buses all come due
    // as it grows. See `QUIET_UNTIL`.
    if (quiet) return Gripe.NONE;
    if (u.daysOfRubbish(id) > RUBBISH_DAYS) return Gripe.RUBBISH;

    // ---- the building itself ---------------------------------------------
    if (occupied && c.health[id] < DERELICT_AT) return Gripe.DERELICT;

    // ---- what the city is supposed to provide -----------------------------
    //
    // Only once it is a city that size. A village does not run its own fire
    // brigade or its own school, and complaining that it has none is telling
    // the player to fix something nobody anywhere would build yet -- which was
    // the whole of the opening hour: one street, six houses, and every one of
    // them asking for a hospital. See `EXPECTED_AT`. The mains above are not
    // gated and never will be: those are what a building needs to work at all.
    const s = this.services;
    const pop = this.people.population;
    if (expectedOf('fire', pop) && s.at(id, BRANCH.fire) < UNCOVERED) return Gripe.FIRE;
    if (occupied && expectedOf('health', pop)
      && s.at(id, BRANCH.health) < UNCOVERED) return Gripe.SICK;
    if (occupied && expectedOf('police', pop)
      && s.at(id, BRANCH.police) < UNCOVERED) return Gripe.CRIME;
    // Schools are a complaint where people live, not where they work.
    if (homes > 0 && c.living[id] > 0 && expectedOf('education', pop)
      && s.at(id, BRANCH.education) < UNCOVERED) {
      return Gripe.SCHOOL;
    }

    // ---- the market -------------------------------------------------------
    //
    // Services are left out of all of this: a fire station with vacancies is a
    // budget decision, not a building with a problem.
    if (purpose === Purpose.SERVICE || c.teaches[id] !== Teaches.NONE) return Gripe.NONE;

    if (jobs > 0) {
      const empty = (jobs - c.working[id]) / jobs;
      if (empty > SHORT_STAFFED) {
        // Which kind of shortage. Office work here wants a degree and industry
        // does not -- see `people.ts`, which is what actually turns an applicant
        // away -- so a city with people spare and no qualifications is short of
        // colleges, and one with nobody spare at all is short of housing.
        const needsDegree = purpose === Purpose.OFFICE;
        if (needsDegree && spare > 0.04 && educated < 0.30) return Gripe.UNEDUCATED;
        return Gripe.NO_WORKERS;
      }
      // A shop nobody comes to. `met` is the share of the people who wanted what
      // this place offers and got it, so a low figure on a shop with staff in it
      // means the trade is not there rather than that the shop is failing to
      // serve it.
      if (purpose === Purpose.SHOP && c.working[id] > 0
        && c.met[id] / 255 < NO_TRADE) return Gripe.NO_CUSTOMERS;
    }

    // Last, because it is the mildest and the one a player will often leave.
    if (occupied && s.at(id, BRANCH.transport) < UNCOVERED * 0.5
      && !(this.transit?.reaches(c.x[id], c.z[id]) ?? false)) {
      return Gripe.NO_TRANSPORT;
    }
    return Gripe.NONE;
  }

  /**
   * Which utility a building produces, as `Util` plus one, or zero.
   *
   * Plus one so that zero can mean "not a plant" -- power is utility zero, and a
   * producer of it is the single most important building in the city to be able
   * to tell apart from a shed.
   */
  private producer(id: number): number {
    const def = ASSETS[this.places.col.proto[id]];
    const supply = def === undefined ? undefined : supplyOf(def.id);
    if (supply === undefined) return 0;
    if ((supply.power ?? 0) > 0) return Util.POWER + 1;
    if ((supply.water ?? 0) > 0) return Util.WATER + 1;
    if ((supply.sewage ?? 0) > 0) return Util.SEWAGE + 1;
    if ((supply.rubbish ?? 0) > 0) return Util.GARBAGE + 1;
    return 0;
  }

  bytes(): number {
    return this.gripe.byteLength + (this.shown.length + this.filling.length) * 32;
  }
}
