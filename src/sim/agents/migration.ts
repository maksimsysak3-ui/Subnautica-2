/**
 * Who comes to the city, when, how fast, and why they leave.
 *
 * This is the loop the whole game sits inside, so it is written to be read. Every
 * rate below is a named constant with a reason next to it, because these numbers
 * are the game's difficulty curve and they will be turned dozens of times.
 *
 * The model has four stages and each exists to fix something that goes wrong
 * without it.
 *
 *   1. APPEAL. How much people outside want to come, 0 to 1, from things the
 *      player controls: whether there is work, whether the services reach, how
 *      the people already there feel, and what the taxes are. Without this,
 *      growth is a timer and the player is a spectator.
 *
 *   2. ENQUIRIES. Households hear about the city and apply, at a rate that is
 *      partly fixed and mostly proportional to how big the city already is --
 *      because word of mouth is how a city actually grows, and because a curve
 *      that starts slow and accelerates is the one that feels like building
 *      something. A village gets a household every few days. A city gets
 *      hundreds.
 *
 *   3. THE WAITING LIST. Applicants queue. They are only housed when there is a
 *      vacant home they can afford, and they give up if they wait too long. This
 *      is what makes zoning the throttle on growth rather than a suggestion, and
 *      it is where the residential demand indicator comes from: a long queue and
 *      no vacancies is exactly the state that should be shouting at the player.
 *
 *   4. DEPARTURES. Households leave when they have been unhappy for a fortnight,
 *      when their earners have found no work for three weeks, or when their home
 *      is demolished from under them. Slowly, and with the count visible --
 *      because a city that empties without explanation is the single most
 *      unpleasant thing a builder can do to a player.
 *
 * The one asymmetry worth naming: arriving is gated on housing and leaving is not.
 * That is deliberate. A player who bulldozes half their city should watch the
 * population fall, and a player who zones nothing should watch the queue grow.
 * Both are legible. The reverse -- people who cannot leave -- is not.
 */

import { RULES } from '../difficulty';
import { Rng } from './rand';
import { Clock, YEARS_PER_DAY } from './calendar';
import { Places, Purpose } from './places';
import { People, Wealth, Stage, Edu, NONE, MAX_HOUSEHOLD } from './people';
import { ASSETS } from '../../assets/registry';
import { BRANCHES } from '../../assets/types';
import type { Ground } from './ground';
import type { Services } from './services';
import type { Utilities } from './utilities';

// ---- the rates ------------------------------------------------------------

/**
 * Households a day that hear about a city of no size at all.
 *
 * This used to be six, on the reasoning that a village should stay a village
 * until the player does something about it. That reasoning was right about the
 * game it was written for and wrong about this one: back then the buildings went
 * up the instant they were zoned and this rate only decided how fast they filled.
 * Now it decides how fast the city is *built*, because a house is only worth
 * building when somebody wants it -- so six a day meant a player who zoned a
 * district watched twenty houses appear and then nothing at all for five minutes.
 *
 * Eighteen is one every five seconds at full appeal, which is the pace of a new
 * town actually being founded, and the compounding term below still does all the
 * work of turning that town into a city.
 */
const ENQUIRIES_PER_DAY = 18;

/**
 * Extra households a day per thousand people already living there.
 *
 * Forty-five, and this is the number that sets the whole pace of the game. With
 * it, a city at good appeal roughly doubles every nine days, so a player reaches
 * ten thousand in under an hour and a hundred thousand in a long session. Halve
 * it and the game is a grind; double it and the player never catches up with
 * their own road network.
 */
const ENQUIRIES_PER_THOUSAND = 45;

/**
 * Households the housing office places in a day, per thousand people.
 *
 * A cap on how fast the queue can be worked through, separate from how fast it
 * fills. It exists so that a player who suddenly zones a great deal does not get
 * forty thousand people in one day and a road network that instantly fails -- the
 * city fills up over a week instead, which is both more believable and gives them
 * time to react.
 *
 * Thirty rather than twelve, because the flat term is the one that governs the
 * opening: a founding queue of thirty households took two and a half game days
 * to move in at twelve a day, and a player watching a street of finished, empty
 * houses for four real minutes concludes the game is broken rather than slow.
 */
const PLACEMENTS_PER_DAY = 30;
const PLACEMENTS_PER_THOUSAND = 55;

/** Days an applicant will wait before looking somewhere else. */
const PATIENCE_DAYS = 9;

/** The queue never grows past this many times the city's population. */
const QUEUE_CAP_RATIO = 0.4;
/** Nor below this, or a new city has no queue to speak of. */
const QUEUE_CAP_MIN = 60;

/**
 * Households a day per thousand that leave a thoroughly unappealing city anyway.
 *
 * On top of the individual reasons in `people.ts`. It is what turns a city the
 * player has stopped looking after into one that visibly drains, rather than one
 * that merely stops growing -- and it is small, because the individual reasons
 * should be doing most of the work and should be the ones the player can trace.
 */
const DRIFT_AWAY_PER_THOUSAND = 3;

/** How much each thing counts towards appeal. Sums to one. */
const WEIGHT = {
  /** Is there work? The strongest single factor, as it is in reality. */
  work: 0.34,
  /** Do the services reach? */
  services: 0.24,
  /** Are the people already there content? Word of mouth. */
  word: 0.22,
  /** What are the taxes? */
  tax: 0.12,
  /** Is it pleasant -- parks, low pollution, low noise? */
  amenity: 0.08,
} as const;

/**
 * What a city is judged on having built, and how much each one counts.
 *
 * Weighted by how much people notice the absence: nobody moves to a city with no
 * water, and nobody declines to move to one with no post office. Resolved to branch
 * indices once at load rather than looked up by name on every call, because appeal
 * is read several times a second and this was rebuilding a table of eleven arrays
 * each time.
 */
const NEEDED: Array<[string, number]> = [
  ['water', 1.4], ['power', 1.4], ['health', 1.1], ['education', 1.0],
  ['fire', 0.8], ['police', 0.8], ['parks', 0.5], ['transport', 0.5],
  ['deathcare', 0.3], ['government', 0.2], ['post', 0.2],
];
const NEEDED_BRANCH = NEEDED.map(([name]) => BRANCHES.indexOf(name as never));
const NEEDED_TOTAL = NEEDED.reduce((a, [, w]) => a + w, 0);

/** The tax rate a city is judged against: at this, tax costs nothing in appeal. */
const NEUTRAL_TAX = 0.09;

/** Ages a new household's adults are drawn from. */
const ADULT_AGE_FROM = 21;
const ADULT_AGE_TO = 46;

/** What a household of a given means can afford, as a tier 0..2. */
function tierOfHome(place: number, places: Places): number {
  const def = ASSETS[places.col.proto[place]];
  const perHousehold = (def.sim?.upkeep ?? 5) / Math.max(1, def.sim?.households ?? 1);
  // Upkeep per household is the only cost signal the asset library carries, and
  // it tracks what the building is: a terrace is a few units, a penthouse tower
  // is many. Banded rather than continuous so that "can they afford it" is a
  // comparison and not a market simulation.
  return perHousehold >= 14 ? Wealth.WELL_OFF : perHousehold >= 7 ? Wealth.MIDDLING : Wealth.POOR;
}

/** Readout. Everything a player or a test would want to see. */
export interface Flow {
  /** 0 to 1. */
  appeal: number;
  work: number;
  services: number;
  word: number;
  /** Households waiting. */
  queue: number;
  /** Per day, smoothed over the last week. */
  arrivalsPerDay: number;
  departuresPerDay: number;
  /** Since founding. */
  arrived: number;
  departed: number;
  gaveUp: number;
  /** Households wanting a home over homes available. Above 1 means build. */
  demand: number;
}

/**
 * The applicants.
 *
 * A ring of pending households held as plain columns, because the queue turns
 * over entirely every few days and must never allocate. An applicant is not yet a
 * household in the city -- it has no row in the population, pays no tax and
 * appears in no count -- which matters: a queue of eighty thousand people who
 * have nowhere to live must not look like a city of eighty thousand.
 */
class Queue {
  private wealth: Uint8Array;
  private size: Uint8Array;
  private edu: Uint8Array;
  private since: Int32Array;
  private head = 0;
  private tail = 0;
  private mask: number;

  constructor(capacity = 1024) {
    let n = 64;
    while (n < capacity) n *= 2;
    this.mask = n - 1;
    this.wealth = new Uint8Array(n); this.size = new Uint8Array(n);
    this.edu = new Uint8Array(n); this.since = new Int32Array(n);
  }

  get length(): number { return this.tail - this.head; }
  get capacity(): number { return this.mask + 1; }

  push(wealth: number, size: number, edu: number, day: number): void {
    if (this.length > this.mask) this.grow();
    const i = this.tail++ & this.mask;
    this.wealth[i] = wealth; this.size[i] = size;
    this.edu[i] = edu; this.since[i] = day;
  }

  /** The applicant at the front, without removing it. */
  peek(out: Int32Array): boolean {
    if (this.head === this.tail) return false;
    const i = this.head & this.mask;
    out[0] = this.wealth[i]; out[1] = this.size[i];
    out[2] = this.edu[i]; out[3] = this.since[i];
    return true;
  }

  drop(): void { if (this.head !== this.tail) this.head++; }

  /** Scratch for `requeue`, so working the queue never allocates. */
  private readonly moving = new Int32Array(4);

  /** Moves the front applicant to the back, for one that could not be housed. */
  requeue(): void {
    const out = this.moving;
    if (!this.peek(out)) return;
    this.drop();
    this.push(out[0], out[1], out[2], out[3]);
  }

  private grow(): void {
    const n = (this.mask + 1) * 2;
    const wealth = new Uint8Array(n), size = new Uint8Array(n);
    const edu = new Uint8Array(n), since = new Int32Array(n);
    const len = this.length;
    for (let k = 0; k < len; k++) {
      const i = (this.head + k) & this.mask;
      wealth[k] = this.wealth[i]; size[k] = this.size[i];
      edu[k] = this.edu[i]; since[k] = this.since[i];
    }
    this.head = 0; this.tail = len; this.mask = n - 1;
    this.wealth = wealth; this.size = size; this.edu = edu; this.since = since;
  }

  bytes(): number {
    return this.wealth.byteLength + this.size.byteLength
      + this.edu.byteLength + this.since.byteLength;
  }
}

export class Migration {
  private readonly queue = new Queue(2048);
  private readonly slot = new Int32Array(4);
  private readonly rng: Rng;

  /** Fractional households carried between visits, so slow rates still happen. */
  private owedEnquiries = 0;
  private owedPlacements = 0;
  private owedDrift = 0;

  /** Rolling week, for the per-day readout. */
  private readonly arrivalsByDay = new Int32Array(7);
  private readonly departuresByDay = new Int32Array(7);
  private lastDay = -1;

  arrived = 0;
  departed = 0;
  gaveUp = 0;

  /** Set by the economy. 0.09 is neutral. */
  taxRate = NEUTRAL_TAX;

  constructor(readonly people: People, readonly places: Places, readonly clock: Clock,
    seed = 0x9d2c07) {
    this.rng = new Rng(seed);
  }

  // ---- appeal ------------------------------------------------------------

  /**
   * Whether there is work to come for.
   *
   * Vacant jobs against the working-age population, so a city that has zoned
   * plenty of offices and has nobody to fill them is attractive, and one whose
   * every job is taken is not -- which is the feedback that makes a player zone
   * commercial and industrial rather than only houses.
   */
  get workAppeal(): number {
    const spare = this.places.spareJobs;
    const workers = Math.max(1, this.workingAge);
    // A tenth of the workforce in vacancies is a healthy jobs market; more than
    // that adds nothing, because nobody moves to a city twice over for it.
    return Math.max(0, Math.min(1, (spare / workers) / 0.1));
  }

  /** People of working age, counted from the stage histogram. */
  get workingAge(): number {
    return this.people.byStage[Stage.YOUNG] + this.people.byStage[Stage.ADULT];
  }

  /**
   * Whether the services reach.
   *
   * The share of branches that have anything built at all, weighted so that the
   * ones people notice the absence of count for more. Coverage by capacity and
   * distance is the service simulation's job; this is the part that can be
   * answered before it exists, and it already produces the right behaviour --
   * a city with no water and no power is not somewhere anybody moves to.
   */
  /** The service and utility models, once they exist. */
  services: Services | null = null;
  utilities: Utilities | null = null;

  informedBy(services: Services, utilities: Utilities): void {
    this.services = services;
    this.utilities = utilities;
  }

  /**
   * Whether the services reach, weighted by how much people notice the absence.
   *
   * From the real coverage: what share of homes are within the standard for each
   * branch, and whether the power and the water are actually on. Before the service
   * model is attached it falls back to whether anything is built at all -- and the
   * difference between those two is the difference between a game where placing one
   * fire station makes the whole city safe and one where the player has to cover it.
   */
  get serviceAppeal(): number {
    const services = this.services;
    const utilities = this.utilities;
    let have = 0;
    for (let i = 0; i < NEEDED.length; i++) {
      const b = NEEDED_BRANCH[i];
      if (b < 0) continue;
      const name = NEEDED[i][0];
      let quality: number;
      if (name === 'power' || name === 'water') {
        quality = utilities === null
          ? (this.places.byBranch[b].size > 0 ? 1 : 0)
          : utilities.report.served[name === 'power' ? 0 : 1];
      } else if (services !== null) {
        quality = services.cover[b].served;
      } else {
        quality = this.places.byBranch[b].size > 0 ? 1 : 0;
      }
      have += NEEDED[i][1] * Math.max(0, Math.min(1, quality));
    }
    return NEEDED_TOTAL === 0 ? 0 : have / NEEDED_TOTAL;
  }

  /** How the people already here feel about it. */
  get wordOfMouth(): number {
    // A brand-new city has no word of mouth either way, so it is given the
    // benefit of the doubt -- otherwise nothing can ever start.
    return this.people.population < 30 ? 0.6 : this.people.happiness;
  }

  get taxAppeal(): number {
    // Linear to zero at twice neutral, and above one below neutral: cutting taxes
    // is a real lever and should feel like one.
    return Math.max(0, Math.min(1, 1 - (this.taxRate - NEUTRAL_TAX) / NEUTRAL_TAX));
  }

  /** The land value and pollution fields, once there are any. */
  private ground: Ground | null = null;
  breathes(ground: Ground): void { this.ground = ground; }

  get amenityAppeal(): number {
    const b = BRANCHES.indexOf('parks');
    const parks = b < 0 ? 0 : this.places.byBranch[b].size;
    // One park per two thousand people is generous; the curve saturates there.
    const want = Math.max(1, this.people.population / 2000);
    let v = Math.max(0, Math.min(1, parks / want));
    // What the built-up part of the city is actually like to live in. The park
    // count says what the player has provided; this says what it is like when
    // you get there, and a city of parks with a foundry in every street is not
    // a pleasant city.
    const g = this.ground;
    if (g !== null) v = Math.max(0, v * 0.5 + 0.5 * (g.meanValue * 1.4 - g.meanPollution));
    return Math.max(0, Math.min(1, v));
  }

  /** The last appeal worked out, so one run does not compute it three times. */
  private cachedAppeal = 0;

  get appeal(): number { return this.cachedAppeal; }

  /** Works appeal out afresh. Called once at the top of each run. */
  private measureAppeal(): number {
    return WEIGHT.work * this.workAppeal
      + WEIGHT.services * this.serviceAppeal
      + WEIGHT.word * this.wordOfMouth
      + WEIGHT.tax * this.taxAppeal
      + WEIGHT.amenity * this.amenityAppeal;
  }

  // ---- the flow ----------------------------------------------------------

  /**
   * Runs the migration for `days` of game time.
   *
   * Called on a slow tick, and everything in it is a rate per day multiplied by
   * that -- so it behaves identically whether it is called once a day or twenty
   * times, which is what makes the game speed control safe.
   */
  run(days: number): void {
    const day = this.clock.day;
    if (day !== this.lastDay) {
      // Roll the week.
      for (let d = this.lastDay + 1; d <= day && d - this.lastDay <= 7; d++) {
        this.arrivalsByDay[d % 7] = 0;
        this.departuresByDay[d % 7] = 0;
      }
      this.lastDay = day;
    }

    this.cachedAppeal = this.measureAppeal();
    this.enquire(days, day);
    this.place(days, day);
    this.depart(days);
  }

  /** New applicants join the queue. */
  private enquire(days: number, day: number): void {
    const pop = this.people.population;
    const appeal = this.appeal;
    const rate = (ENQUIRIES_PER_DAY + (pop / 1000) * ENQUIRIES_PER_THOUSAND) * appeal * RULES.growth;
    this.owedEnquiries += rate * days;
    const cap = Math.max(QUEUE_CAP_MIN, pop * QUEUE_CAP_RATIO);
    let n = Math.floor(this.owedEnquiries);
    this.owedEnquiries -= n;
    while (n-- > 0) {
      if (this.queue.length >= cap) { this.owedEnquiries = 0; break; }
      this.queue.push(this.drawWealth(), this.drawSize(), this.drawEdu(), day);
    }
  }

  /**
   * Means, size and schooling of a household that wants to move in.
   *
   * Drawn from the city it is moving to, not from nowhere: a city of offices and
   * good schools attracts educated households, and a city of warehouses attracts
   * ones who will work in them. Without that, a player who builds an office
   * district watches it stand empty while unqualified people pour in, and there is
   * nothing they can do about it -- which is a fair mechanic only if the player
   * can see it, and they cannot.
   */
  private drawWealth(): number {
    const edu = this.eduPull;
    const r = this.rng.bell();
    if (r < 0.45 - edu * 0.25) return Wealth.POOR;
    if (r < 0.88 - edu * 0.1) return Wealth.MIDDLING;
    return Wealth.WELL_OFF;
  }

  private drawSize(): number {
    // Mostly one and two, some families. Households grow by having children
    // rather than by arriving large, which is what makes schools matter.
    const r = this.rng.next();
    return r < 0.34 ? 1 : r < 0.74 ? 2 : r < 0.93 ? 3 : 4;
  }

  private drawEdu(): number {
    const pull = this.eduPull;
    const r = this.rng.next();
    if (r < 0.34 - pull * 0.28) return Edu.NONE;
    if (r < 0.78 - pull * 0.2) return Edu.SCHOOL;
    if (r < 0.95 - pull * 0.1) return Edu.COLLEGE;
    return Edu.UNIVERSITY;
  }

  /** How strongly the city's own jobs pull educated people in, 0 to 1. */
  private get eduPull(): number {
    const p = this.places;
    const skilled = p.vacantJobs[Purpose.OFFICE].size + p.vacantJobs[Purpose.SERVICE].size;
    const rough = p.vacantJobs[Purpose.WORKS].size + p.vacantJobs[Purpose.SHOP].size;
    const total = skilled + rough;
    return total === 0 ? 0.4 : skilled / total;
  }

  /**
   * Works through the queue, housing whoever can be housed.
   *
   * An applicant who cannot be matched goes to the back rather than blocking the
   * front -- otherwise one well-off household waiting for a penthouse stops the
   * entire city from filling up, which is a deadlock a player can neither see nor
   * fix. And an applicant who has been waiting past their patience gives up: that
   * number, not the queue length, is the honest measure of how much growth a
   * player is losing by not zoning.
   */
  private place(days: number, day: number): void {
    const pop = this.people.population;
    const rate = (PLACEMENTS_PER_DAY + (pop / 1000) * PLACEMENTS_PER_THOUSAND) * RULES.growth;
    this.owedPlacements += rate * days;
    let budget = Math.floor(this.owedPlacements);
    this.owedPlacements -= budget;

    // Each applicant gets at most one look per call, so a queue full of people
    // who cannot be housed costs its own length and not a spin.
    let looks = Math.min(budget * 3 + 8, this.queue.length);
    while (budget > 0 && looks-- > 0) {
      if (!this.queue.peek(this.slot)) break;
      const wealth = this.slot[0], size = this.slot[1], edu = this.slot[2], since = this.slot[3];
      if (day - since > PATIENCE_DAYS) { this.queue.drop(); this.gaveUp++; continue; }
      if (this.places.vacantHomes.size === 0) break;

      const home = this.findHome(wealth);
      if (home === NONE) { this.queue.requeue(); continue; }
      this.queue.drop();
      this.moveIn(home, wealth, size, edu);
      budget--;
    }
  }

  /**
   * A vacant home a household of this means would take.
   *
   * Probes rather than searches, and accepts one tier above its means at a push,
   * because a housing market where nobody ever stretches leaves a city permanently
   * full of empty flats that are slightly too nice.
   */
  private findHome(wealth: number): number {
    const pool = this.places.vacantHomes;
    if (pool.size === 0) return NONE;
    let fallback = NONE;
    for (let k = 0; k < 6; k++) {
      const p = pool.pick(this.rng.next());
      if (p < 0) break;
      const tier = tierOfHome(p, this.places);
      if (tier === wealth) return p;
      if (tier <= wealth + 1 && fallback === NONE) fallback = p;
      if (tier < wealth && fallback === NONE) fallback = p;
    }
    return fallback;
  }

  /** Creates the household and its people, and moves them in. */
  private moveIn(home: number, wealth: number, size: number, edu: number): void {
    const people = this.people;
    const hh = people.foundHousehold(wealth);
    if (!people.house(hh, home)) { people.dissolve(hh); return; }
    // One or two adults, then children to make up the size. Children rather than
    // more adults, because a household of four adults is a shared house and the
    // city has no concept of one -- and because arriving families are what fill
    // the schools a player has just built.
    const adults = size >= 2 && this.rng.chance(0.78) ? 2 : 1;
    for (let i = 0; i < adults; i++) {
      people.addCitizen(hh, this.rng.range(ADULT_AGE_FROM, ADULT_AGE_TO), edu);
    }
    for (let i = adults; i < Math.min(size, MAX_HOUSEHOLD); i++) {
      people.addCitizen(hh, this.rng.range(0, 17), Edu.NONE);
    }
    this.arrived++;
    this.arrivalsByDay[this.clock.day % 7]++;
  }

  /**
   * Sees off everybody who is going.
   *
   * Two sources. The households that `people.ts` decided have had enough, which
   * is where nearly all of it should come from and the part a player can trace to
   * a cause; and a slow drift out of a city nobody wants to be in, which keeps a
   * neglected city visibly emptying rather than merely stagnant.
   */
  private depart(days: number): void {
    const leaving = this.people.leaving;
    for (const hh of leaving) {
      if (this.people.households.live[hh] === 0) continue;
      this.people.dissolve(hh);
      this.departed++;
      this.departuresByDay[this.clock.day % 7]++;
    }
    leaving.length = 0;

    const pop = this.people.population;
    if (pop === 0) return;
    const rate = (pop / 1000) * DRIFT_AWAY_PER_THOUSAND * (1 - this.appeal);
    this.owedDrift += rate * days;
    let n = Math.floor(this.owedDrift);
    this.owedDrift -= n;
    const hhBound = this.people.households.bound;
    while (n-- > 0 && hhBound > 0) {
      // A random household, biased towards the unhappy by rejecting a content one
      // most of the time -- cheaper than sorting, and the bias is what matters.
      let picked = NONE;
      for (let k = 0; k < 6; k++) {
        const hh = this.rng.int(hhBound);
        if (this.people.households.live[hh] === 0) continue;
        const mood = this.people.households.col.mood[hh];
        if (mood < 120 || this.rng.chance(0.25)) { picked = hh; break; }
        if (picked === NONE) picked = hh;
      }
      if (picked === NONE) break;
      this.people.dissolve(picked);
      this.departed++;
      this.departuresByDay[this.clock.day % 7]++;
    }
  }

  // ---- readout -----------------------------------------------------------

  private weekly(a: Int32Array): number {
    let sum = 0;
    for (let i = 0; i < 7; i++) sum += a[i];
    return sum / 7;
  }

  get flow(): Flow {
    const spare = this.places.spareHomes;
    return {
      appeal: this.appeal,
      work: this.workAppeal,
      services: this.serviceAppeal,
      word: this.wordOfMouth,
      queue: this.queue.length,
      arrivalsPerDay: this.weekly(this.arrivalsByDay),
      departuresPerDay: this.weekly(this.departuresByDay),
      arrived: this.arrived,
      departed: this.departed,
      gaveUp: this.gaveUp,
      demand: this.queue.length / Math.max(1, spare),
    };
  }

  /**
   * Founds the city: the first households, placed at once.
   *
   * Without this a new city spends its first minutes empty while the queue fills,
   * and the player has nothing to look at. Seeded rather than waited for.
   */
  found(households: number): void {
    const day = this.clock.day;
    for (let i = 0; i < households; i++) {
      // One draw, used for both the search and the household: drawing twice
      // found a home for a household that was then created with different means,
      // so founding families were routinely put in houses they could not afford.
      const wealth = this.drawWealth();
      const size = this.drawSize();
      const edu = this.drawEdu();
      const home = this.findHome(wealth);
      // Nowhere to put them *yet*. They queue rather than evaporate, which is
      // the whole point of founding a city: the first families are the reason
      // the first houses go up, and they are standing there waiting for them.
      //
      // This used to `break`, which meant founding a city on bare ground seeded
      // nobody at all -- there are no homes on bare ground -- so the opening
      // minutes of every game were spent waiting for ordinary migration to
      // notice a town that had no inhabitants to be attractive to.
      if (home === NONE) { this.queue.push(wealth, size, edu, day); continue; }
      this.moveIn(home, wealth, size, edu);
    }
  }

  bytes(): number { return this.queue.bytes(); }
}

/** Years of life per day, re-exported for callers scaling their own rates. */
export { YEARS_PER_DAY };
