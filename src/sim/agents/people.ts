/**
 * The people: households, citizens, and the lives they run through.
 *
 * A household is the unit that moves into a home, holds a car and decides it has
 * had enough and leaves. A citizen is the unit that grows up, goes to school,
 * takes a job, makes trips and dies. Keeping them apart matters: a city where the
 * individual is the unit of housing gets an eighty-thousand-person town of
 * one-bedroom flats, and a city where the household is the unit of work has no
 * children in it.
 *
 * Members of a household are a linked list -- the household holds its first
 * member, each member holds the next. Walking one costs its size and joining or
 * leaving costs nothing, which is what is wanted: a household's members are
 * walked when it moves or breaks up, which is rare, and joined and left
 * constantly, which is not.
 *
 * Everything on a schedule runs in slices. A citizen is visited once per period
 * of its system's rate, spread by id, so there is no tick on which the whole
 * population is examined; and because a visit happens every so many days rather
 * than every day, every per-day probability in here is scaled by the days since
 * the last visit. Getting that scaling wrong is the classic fault in this kind of
 * simulation -- it does not crash, it just makes everybody die eight times too
 * often, or never.
 */

import { Table, NO_HANDLE } from './store';
import { Rng } from './rand';
import { Clock, YEARS_PER_DAY, TICKS_PER_DAY } from './calendar';
import { Places, Purpose, Teaches, NO_BRANCH } from './places';
import { BRANCHES } from '../../assets/types';
import type { Services } from './services';
import type { Utilities } from './utilities';

/** Life stages, in order. */
export const Stage = {
  INFANT: 0,
  CHILD: 1,
  TEEN: 2,
  YOUNG: 3,
  ADULT: 4,
  SENIOR: 5,
} as const;
export const STAGE_NAMES = ['infant', 'child', 'teen', 'young', 'adult', 'senior'] as const;

/** The age each stage begins at, in years. */
const STAGE_FROM = [0, 6, 12, 18, 26, 65];

export function stageOf(years: number): number {
  for (let s = STAGE_FROM.length - 1; s > 0; s--) if (years >= STAGE_FROM[s]) return s;
  return Stage.INFANT;
}

/** How far somebody got with their education. */
export const Edu = { NONE: 0, SCHOOL: 1, COLLEGE: 2, UNIVERSITY: 3 } as const;
export const EDU_NAMES = ['none', 'school', 'college', 'university'] as const;

/** What somebody is doing. */
export const Doing = {
  HOME: 0,
  /** On the way somewhere. `target` says where. */
  TRAVELLING: 1,
  WORK: 2,
  SCHOOL: 3,
  SHOPPING: 4,
  LEISURE: 5,
  /** In the city but with nowhere to be: unhoused, or waiting to leave. */
  ADRIFT: 6,
} as const;
export const DOING_NAMES = ['home', 'travelling', 'work', 'school', 'shopping', 'leisure', 'adrift'] as const;

/** Money bands. Decides what rent a household can pay and what it buys. */
export const Wealth = { POOR: 0, MIDDLING: 1, WELL_OFF: 2 } as const;

/** Nobody, nowhere. */
export const NONE = -1;

/**
 * Annual chance of dying, by decade of age.
 *
 * Roughly a developed country's life table, which is the right shape: very low
 * through childhood and middle age, then doubling every seven or eight years
 * after sixty. It matters that the curve is a curve. A flat death rate gives a
 * city with no old people in it and a steady trickle of twenty-year-olds dying,
 * and players notice that long before they can say why.
 */
const MORTALITY = [
  0.0040, 0.0002, 0.0005, 0.0010, 0.0015, 0.0025,   //  0s 10s 20s 30s 40s 50s
  0.0070, 0.0180, 0.0500, 0.1300, 0.2600, 0.4000,   // 60s 70s 80s 90s 100s 110s
];

function annualMortality(years: number, health: number): number {
  const band = Math.min(MORTALITY.length - 1, Math.max(0, Math.floor(years / 10)));
  const base = MORTALITY[band];
  // Health scales it: a city with no hospitals kills people faster, and a
  // healthy one stretches the tail. Between a third and three times.
  const h = health / 255;
  return base * (2.6 - 2.3 * h);
}

/**
 * Chance per day that a household has a child.
 *
 * Expressed per household rather than per person, deliberately. Modelling
 * individual fertility means modelling who is partnered with whom, which is a
 * large system that produces exactly one visible output -- the birth rate -- and
 * this produces the same output directly. It is scaled by how well the household
 * is doing and blocked when there is no room, which is most of what actually
 * drives birth rates in a city builder: build houses and the city grows.
 */
const BIRTHS_PER_HOUSEHOLD_YEAR = 0.11;
/** Nobody has children in a household this full. */
export const MAX_HOUSEHOLD = 6;

/**
 * The share of school-leavers who aim at a degree rather than a diploma.
 *
 * A third, which is roughly what a developed country sends to university, and it
 * is what makes a city need both kinds of place.
 */
const DEGREE_SHARE = 0.34;

/** A stable per-person draw, for things about them that never change. */
function aptitude(id: number): number {
  let h = Math.imul(id ^ 0x27d4eb2f, 0x165667b1);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2545f491);
  return ((h ^ (h >>> 16)) >>> 0) * 2.3283064365386963e-10;
}

const HOUSEHOLD_SCHEMA = {
  /** The place lived in, or NONE while waiting for one. */
  home: Int32Array,
  /** First member; walk with `nextMember`. */
  head: Int32Array,
  size: Uint8Array,
  wealth: Uint8Array,
  /** Cars owned. Decides whether driving is even an option. */
  cars: Uint8Array,
  /** 0..255. Below `FED_UP` for long enough and the household leaves. */
  mood: Uint8Array,
  /** Consecutive days of being fed up. */
  fedUp: Uint8Array,
  /** The day it arrived, for the readout and for not judging newcomers too fast. */
  arrived: Int32Array,
} as const;

const CITIZEN_SCHEMA = {
  house: Int32Array,
  /** Next member of the same household, or NONE. */
  nextMember: Int32Array,
  /** Where they work, study, and are right now. Place ids, or NONE. */
  work: Int32Array,
  study: Int32Array,
  where: Int32Array,
  target: Int32Array,
  bornDay: Int32Array,
  stage: Uint8Array,
  edu: Uint8Array,
  /** 0..255. */
  health: Uint8Array,
  mood: Uint8Array,
  doing: Uint8Array,
  /** Which travel mode they are using, from `path.ts`'s Layer. */
  mode: Uint8Array,
  /** Fully simulated, or resolved statistically. */
  detail: Uint8Array,
  /** The route being followed, and how far along it. */
  route: Int32Array,
  /** The route their road space is claimed against, or NO_PATH. */
  held: Int32Array,
  step: Uint16Array,
  along: Float32Array,
  /** Where they are, when they are being simulated in full. */
  x: Float32Array,
  z: Float32Array,
  /** The tick they set off, and the tick they are due to arrive. */
  setOff: Int32Array,
  arriveAt: Int32Array,
  /** Travelling on an estimate rather than a route. */
  guess: Uint8Array,
  /** Days without work. Long enough, and the household gives up on the city. */
  idleDays: Uint8Array,
} as const;

/** The service branches whose work needs more than a school leaving certificate. */
const LEARNED = new Set(['health', 'education', 'government', 'deathcare']);

/** Mood at which a household starts counting the days. */
export const FED_UP = 90;
/** Days of being fed up before it goes. */
export const PATIENCE_DAYS = 12;
/** Days an adult will look for work before the household gives up. */
export const JOB_PATIENCE_DAYS = 20;

/**
 * The population.
 *
 * Owns the two tables and every operation that has to keep them consistent --
 * which is all of them, because a citizen without a household and a household
 * whose size does not match its members are both silently wrong and both produce
 * a population count that drifts away from the truth.
 */
export class People {
  readonly households = new Table(HOUSEHOLD_SCHEMA, 1024);
  readonly citizens = new Table(CITIZEN_SCHEMA, 4096);
  readonly rng: Rng;

  /** Running totals, kept in step rather than counted. */
  population = 0;
  employed = 0;
  students = 0;
  /** Since founding. */
  births = 0;
  deaths = 0;

  /** Reused for the four utility readings, so the hot loop allocates nothing. */
  private readonly utilScratch = new Float32Array(4);

  /** By stage, for the age pyramid. */
  readonly byStage = new Int32Array(STAGE_NAMES.length);
  readonly byEdu = new Int32Array(EDU_NAMES.length);

  /**
   * The sum of everybody's mood, maintained rather than counted.
   *
   * Because happiness is read by the migration system three times every time it
   * runs, and counting it walked the entire population each time -- ten full
   * passes over a hundred thousand citizens every second, to produce a number
   * that changes by a fraction of a per cent. Every write to a mood goes through
   * `setMood`, so this stays exact.
   */
  private moodSum = 0;

  constructor(seed = 0x51ce55, readonly places: Places, readonly clock: Clock) {
    this.rng = new Rng(seed);
  }

  // ---- households --------------------------------------------------------

  /** Starts a household with no home and no members. */
  foundHousehold(wealth: number): number {
    const id = this.households.add();
    const c = this.households.col;
    c.home[id] = NONE;
    c.head[id] = NONE;
    c.size[id] = 0;
    c.wealth[id] = wealth;
    // Car ownership by means, which is what decides it: a poor household in a
    // city with no buses still mostly does not have a car.
    c.cars[id] = wealth === Wealth.POOR ? (this.rng.chance(0.35) ? 1 : 0)
      : wealth === Wealth.MIDDLING ? (this.rng.chance(0.8) ? 1 : 0)
        : 1 + (this.rng.chance(0.5) ? 1 : 0);
    c.mood[id] = 170;
    c.fedUp[id] = 0;
    c.arrived[id] = this.clock.day;
    return id;
  }

  /** Puts a household into a home. False if the home filled up first. */
  house(hh: number, place: number): boolean {
    if (this.households.live[hh] === 0) return false;
    if (!this.places.moveIn(place)) return false;
    const c = this.households.col;
    if (c.home[hh] !== NONE) this.places.moveOut(c.home[hh]);
    c.home[hh] = place;
    // Everybody is now at home, wherever they were.
    for (let m = c.head[hh]; m !== NONE; m = this.citizens.col.nextMember[m]) {
      this.citizens.col.where[m] = place;
      this.citizens.col.doing[m] = Doing.HOME;
    }
    return true;
  }

  /** Adds a citizen to a household. */
  private join(hh: number, cz: number): void {
    const h = this.households.col, c = this.citizens.col;
    c.house[cz] = hh;
    c.nextMember[cz] = h.head[hh];
    h.head[hh] = cz;
    h.size[hh]++;
  }

  private leave(hh: number, cz: number): void {
    const h = this.households.col, c = this.citizens.col;
    let prev = NONE;
    for (let m = h.head[hh]; m !== NONE; m = c.nextMember[m]) {
      if (m === cz) {
        if (prev === NONE) h.head[hh] = c.nextMember[m];
        else c.nextMember[prev] = c.nextMember[m];
        h.size[hh]--;
        break;
      }
      prev = m;
    }
    c.house[cz] = NONE;
  }

  // ---- citizens ----------------------------------------------------------

  /** Adds a person of a given age to a household. */
  addCitizen(hh: number, years: number, edu: number = Edu.NONE): number {
    const id = this.citizens.add();
    const c = this.citizens.col;
    c.work[id] = NONE; c.study[id] = NONE; c.target[id] = NONE;
    c.where[id] = this.households.col.home[hh];
    c.bornDay[id] = this.clock.bornDayFor(years);
    c.stage[id] = stageOf(years);
    c.edu[id] = edu;
    c.health[id] = 200 + this.rng.int(40);
    c.mood[id] = 0;
    this.setMood(id, 170);
    c.doing[id] = Doing.HOME;
    c.mode[id] = 0;
    c.detail[id] = 0;
    c.route[id] = NO_HANDLE;
    c.held[id] = NO_HANDLE;
    c.step[id] = 0; c.along[id] = 0;
    c.setOff[id] = 0;
    c.arriveAt[id] = 0;
    c.guess[id] = 0;
    c.idleDays[id] = 0;
    const home = this.households.col.home[hh];
    c.x[id] = home === NONE ? 0 : this.places.col.x[home];
    c.z[id] = home === NONE ? 0 : this.places.col.z[home];
    this.join(hh, id);
    this.population++;
    this.byStage[c.stage[id]]++;
    this.byEdu[edu]++;
    return id;
  }

  /**
   * Removes a person, tidying up everything that pointed at them.
   *
   * The order is not arbitrary: the job and the school place have to be given
   * back before the row is freed, because afterwards the row may belong to
   * somebody else and the capacity would be lost for good. A slow leak of jobs is
   * one of the hardest things to notice in a city -- unemployment creeps up over
   * hours of play with no cause visible anywhere.
   */
  /**
   * Somebody living at this address dies.
   *
   * For a medical call nobody answered. It has to be a real death in the real
   * population, not a number in a panel: a city with no hospital that reads as
   * perfectly healthy while a red statistic ticks up somewhere is a city where the
   * player has no reason to build one. Returns whether anybody was there to die.
   */
  killAt(place: number): boolean {
    const hh = this.households;
    const cz = this.citizens;
    for (let id = 0; id < cz.bound; id++) {
      if (cz.live[id] === 0) continue;
      const house = cz.col.house[id];
      if (house === NONE || hh.live[house] === 0) continue;
      if (hh.col.home[house] !== place) continue;
      this.removeCitizen(id, true);
      return true;
    }
    return false;
  }

  removeCitizen(id: number, andDied: boolean): void {
    if (this.citizens.live[id] === 0) return;
    const c = this.citizens.col;
    if (c.work[id] !== NONE) { this.places.fire(c.work[id]); this.employed--; }
    if (c.study[id] !== NONE) {
      this.places.unenrol(c.study[id]);
      this.students--;
      if (c.stage[id] >= Stage.YOUNG) this.studentAdults--;
    }
    const hh = c.house[id];
    if (hh !== NONE) this.leave(hh, id);
    this.byStage[c.stage[id]]--;
    this.byEdu[c.edu[id]]--;
    this.moodSum -= c.mood[id];
    this.population--;
    if (andDied) this.deaths++;
    this.citizens.remove(id);
    // An empty household is not a household.
    if (hh !== NONE && this.households.live[hh] === 1 && this.households.col.size[hh] === 0) {
      this.dissolve(hh);
    }
  }

  /** Empties a household out of the city: its home, its members, its row. */
  dissolve(hh: number): void {
    if (this.households.live[hh] === 0) return;
    const h = this.households.col, c = this.citizens.col;
    // Walk to a list first: removeCitizen unlinks as it goes.
    let m = h.head[hh];
    while (m !== NONE) {
      const next = c.nextMember[m];
      // Unlink by hand so removeCitizen does not try to dissolve this again.
      c.house[m] = NONE;
      h.size[hh]--;
      if (c.work[m] !== NONE) { this.places.fire(c.work[m]); this.employed--; c.work[m] = NONE; }
      if (c.study[m] !== NONE) {
        this.places.unenrol(c.study[m]);
        this.students--;
        if (c.stage[m] >= Stage.YOUNG) this.studentAdults--;
        c.study[m] = NONE;
      }
      this.byStage[c.stage[m]]--;
      this.byEdu[c.edu[m]]--;
      this.moodSum -= c.mood[m];
      this.population--;
      this.citizens.remove(m);
      m = next;
    }
    h.head[hh] = NONE;
    if (h.home[hh] !== NONE) { this.places.moveOut(h.home[hh]); h.home[hh] = NONE; }
    this.households.remove(hh);
  }

  /** Members of a household, into a caller's buffer. Returns how many. */
  membersOf(hh: number, out: Int32Array): number {
    const c = this.citizens.col;
    let n = 0;
    for (let m = this.households.col.head[hh]; m !== NONE && n < out.length;
      m = c.nextMember[m]) out[n++] = m;
    return n;
  }

  /** Whether somebody is of working age and not a student. */
  canWork(id: number): boolean {
    const c = this.citizens.col;
    const s = c.stage[id];
    return (s === Stage.YOUNG || s === Stage.ADULT) && c.study[id] === NONE;
  }

  // ---- the life system ---------------------------------------------------

  /**
   * One visit to a slice of the population.
   *
   * `days` is how long it has been since this slice was last seen, which every
   * probability below is scaled by. Called by the scheduler with a stride, so the
   * cost per tick is the population over the rate period and the cost per citizen
   * per day is fixed however large the city gets.
   */
  live(start: number, stride: number, days: number): void {
    const c = this.citizens.col;
    const live = this.citizens.live;
    const bound = this.citizens.bound;
    const day = this.clock.day;
    const rng = this.rng;

    for (let id = start; id < bound; id += stride) {
      if (live[id] === 0) continue;

      // Growing up. A stage change is where education is banked and where a
      // young adult stops being somebody else's child and starts looking for
      // work, so it is worth being a distinct event rather than a threshold
      // tested everywhere.
      const years = (day - c.bornDay[id]) * YEARS_PER_DAY;
      const stage = stageOf(years);
      if (stage !== c.stage[id]) {
        this.byStage[c.stage[id]]--;
        this.byStage[stage]++;
        const wasAdult = c.stage[id] >= Stage.YOUNG;
        c.stage[id] = stage;
        if (c.study[id] !== NONE && !wasAdult && stage >= Stage.YOUNG) this.studentAdults++;
        this.onGrewUp(id, stage);
      }

      // Health drifts towards what the city provides: how quickly an ambulance can
      // reach them, whether there is clean water, and whether the sewage is being
      // treated. Untreated sewage in the river is a health problem and this is where
      // it lands -- a city that dumps it has a sicker, shorter-lived population, and
      // the effect arrives slowly enough that the player has to work out why.
      this.utilitiesAt(id, this.utilScratch);
      const care = this.coverageAt(id, 'health');
      const clean = this.utilScratch[1];                    // water
      const sewer = this.utilScratch[2];
      const bins = this.utilScratch[3];
      const want = 70 + care * 110 + clean * 45 + sewer * 25 + bins * 10;
      const h = c.health[id];
      c.health[id] = h + Math.sign(want - h) * Math.min(Math.abs(want - h), 6 * days);

      // Dying.
      const perYear = annualMortality(years, c.health[id]);
      if (rng.chance(1 - Math.pow(1 - perYear, days * YEARS_PER_DAY))) {
        this.removeCitizen(id, true);
        continue;
      }

      // Work and school.
      if (c.study[id] === NONE) this.enrol(id);
      if (this.canWork(id)) {
        if (c.work[id] === NONE) {
          if (!this.findWork(id)) {
            c.idleDays[id] = Math.min(255, c.idleDays[id] + days);
          }
        } else {
          c.idleDays[id] = 0;
        }
      }

      // Mood follows having somewhere to be, being looked after, and not having
      // been on a bus for an hour. Trips write their own dissatisfaction in;
      // this is the slow part.
      // Mood. The utilities come first and they come hard: a household with no
      // power or no water is not mildly inconvenienced, it is leaving, and that is
      // what makes them a necessity rather than a bonus. Everything else is worth a
      // few points either way.
      let target = 150;
      target -= (1 - this.utilScratch[0]) * 90;              // power
      target -= (1 - this.utilScratch[1]) * 85;              // water
      target -= (1 - this.utilScratch[2]) * 30;              // sewage
      target -= (1 - this.utilScratch[3]) * 35;              // rubbish
      if (c.work[id] !== NONE || c.study[id] !== NONE) target += 40;
      else if (this.canWork(id)) target -= 60;
      if (c.stage[id] === Stage.SENIOR) target += 20;        // retired, not idle
      target += (c.health[id] - 160) * 0.2;
      target += this.coverageAt(id, 'parks') * 26;
      target += this.coverageAt(id, 'police') * 22;
      target += this.coverageAt(id, 'fire') * 14;
      target += this.coverageAt(id, 'transport') * 12;
      const m = c.mood[id];
      this.setMood(id, m + Math.sign(target - m) * Math.min(Math.abs(target - m), 8 * days));
    }
  }

  /** One visit to a slice of the households. */
  keepHouse(start: number, stride: number, days: number): void {
    const h = this.households.col;
    const live = this.households.live;
    const bound = this.households.bound;
    const c = this.citizens.col;
    const rng = this.rng;
    const day = this.clock.day;

    for (let hh = start; hh < bound; hh += stride) {
      if (live[hh] === 0) continue;
      if (h.size[hh] === 0) { this.dissolve(hh); continue; }

      // The household's mood is its members', which is what makes one bad
      // school able to move a family out of the city.
      let sum = 0, n = 0, idle = 0, adults = 0;
      for (let m = h.head[hh]; m !== NONE; m = c.nextMember[m]) {
        sum += c.mood[m]; n++;
        if (this.canWork(m)) { adults++; if (c.idleDays[m] > JOB_PATIENCE_DAYS) idle++; }
      }
      const mood = n > 0 ? (sum / n) | 0 : 0;
      h.mood[hh] = mood;

      // Leaving. Two ways out, and both need to be slow enough that a player
      // has time to react: a household that has been miserable for a fortnight,
      // or one whose earners have found nothing for three weeks. An instant
      // exodus the moment a service fails is the thing that makes a city builder
      // feel unfair rather than difficult.
      const settling = day - h.arrived[hh] < 4;
      if (!settling && (mood < FED_UP || (adults > 0 && idle === adults))) {
        h.fedUp[hh] = Math.min(255, h.fedUp[hh] + days);
      } else {
        h.fedUp[hh] = Math.max(0, h.fedUp[hh] - days);
      }
      if (h.fedUp[hh] >= PATIENCE_DAYS) { this.leaving.push(hh); continue; }

      // Children. Wanted a home, room in it, adults in it, and a household that
      // is not miserable -- in that order, because the first two are the ones a
      // player controls and so the ones that should visibly drive growth.
      if (h.home[hh] !== NONE && h.size[hh] < MAX_HOUSEHOLD && adults > 0) {
        const eager = (mood / 255) * (adults >= 2 ? 1 : 0.45);
        const perYear = BIRTHS_PER_HOUSEHOLD_YEAR * eager;
        if (rng.chance(1 - Math.pow(1 - perYear, days * YEARS_PER_DAY))) {
          this.addCitizen(hh, 0);
          this.births++;
        }
      }
    }
  }

  /** Households that decided to go, for the migration system to see off. */
  readonly leaving: number[] = [];

  // ---- the pieces the above leans on ------------------------------------

  private onGrewUp(id: number, stage: number): void {
    const c = this.citizens.col;
    // Finishing a stage while enrolled is what raises education, to whatever the
    // place they were at teaches. Leaving early -- because the city never built
    // one, or it was full -- is permanent, and shows up years later as a workforce
    // that cannot fill office jobs. That delay is the point of the whole system.
    const at = c.study[id];
    if (at !== NONE) {
      const level = this.places.col.teaches[at];
      if (level > c.edu[id]) this.educate(id, level);
    }
    // School ends when the stage it belonged to does: a school place is finished
    // at the end of childhood, higher education at the end of being young.
    const done = at !== NONE
      && (stage >= Stage.ADULT
        || (stage >= Stage.YOUNG && this.places.col.teaches[at] === Teaches.SCHOOL));
    if (done) {
      this.places.unenrol(at);
      c.study[id] = NONE;
      this.students--;
      if (stage >= Stage.YOUNG) this.studentAdults--;
    }
    // Retirement.
    if (stage === Stage.SENIOR && c.work[id] !== NONE) {
      this.places.fire(c.work[id]);
      c.work[id] = NONE;
      this.employed--;
    }
  }

  private educate(id: number, level: number): void {
    const c = this.citizens.col;
    this.byEdu[c.edu[id]]--;
    c.edu[id] = level;
    this.byEdu[level]++;
  }

  /**
   * What level of education somebody would go for next, or NONE.
   *
   * Childhood is school. Being young is the window for higher education, and
   * whether somebody gets a degree or a diploma is decided by which of the two
   * they can get into -- which is decided by what the player built. That is the
   * whole mechanism: universities are expensive and take few students, so a city
   * that wants a workforce able to fill offices has to pay for one.
   */
  private wants(id: number): number {
    const c = this.citizens.col;
    const stage = c.stage[id];
    if (stage === Stage.CHILD || stage === Stage.TEEN) {
      return c.edu[id] < Edu.SCHOOL ? Teaches.SCHOOL : Teaches.NONE;
    }
    if (stage === Stage.YOUNG) {
      // Catching up first: somebody who never got to school takes that.
      if (c.edu[id] < Edu.SCHOOL) return Teaches.SCHOOL;
      if (c.edu[id] >= Edu.COLLEGE) return Teaches.NONE;
      // Not everybody aims at a degree, and pretending otherwise empties the
      // colleges: with every student in the city applying to the one university,
      // twelve thousand college places stood unused while the university was a
      // quarter full. Aptitude is from a hash of the person, so it does not change
      // and does not need storing.
      return aptitude(id) < DEGREE_SHARE ? Teaches.UNIVERSITY : Teaches.COLLEGE;
    }
    return Teaches.NONE;
  }

  /**
   * Puts somebody in a school with room, if there is one within reach.
   *
   * Probes rather than searches, and takes the nearest of the probes. The nearest
   * school with a place in it is a question whose exact answer nobody can
   * perceive, and whose exact answer costs a scan of every school in the city for
   * every child in it.
   */
  private enrol(id: number): boolean {
    const want = this.wants(id);
    if (want === Teaches.NONE) return false;
    const c = this.citizens.col;
    const col = this.places.col;
    const home = c.where[id];
    const hx = home === NONE ? c.x[id] : col.x[home];
    const hz = home === NONE ? c.z[id] : col.z[home];
    // Higher education is a choice between two kinds of place, so both are probed
    // and distance decides, with a thumb on the scale for the degree. Taking the
    // highest level that had *any* room instead meant every student in the city
    // went to the one university and twelve thousand college places stood empty.
    const top = want;
    const floor = want >= Teaches.COLLEGE ? Teaches.COLLEGE : Teaches.SCHOOL;
    let best = NONE, bestScore = Infinity;
    for (let level = top; level >= floor; level--) {
      const pool = this.places.schools[level];
      if (pool.size === 0) continue;
      // A degree is worth travelling about half again as far for.
      const appeal = level === top ? 0.45 : 1;
      for (let k = 0; k < 3; k++) {
        const p = pool.pick(this.rng.next());
        if (p < 0) break;
        const dx = col.x[p] - hx, dz = col.z[p] - hz;
        const score = (dx * dx + dz * dz) * appeal;
        if (score < bestScore) { bestScore = score; best = p; }
      }
    }
    if (best === NONE) return false;
    if (!this.places.enrol(best)) return false;
    c.study[id] = best;
    this.students++;
    if (c.stage[id] >= Stage.YOUNG) this.studentAdults++;
    return true;
  }

  /**
   * Finds somebody a job.
   *
   * Education gates what they can take, which is the whole reason education
   * exists in a city: an office tower in a city with no schools stands empty, and
   * the player has to work out why. Four probes, nearest wins, so commutes come
   * out short without anybody searching for the shortest.
   */
  private findWork(id: number): boolean {
    const c = this.citizens.col;
    const col = this.places.col;
    const home = c.where[id] === NONE ? this.households.col.home[c.house[id]] : c.where[id];
    const hx = home === NONE ? c.x[id] : col.x[home];
    const hz = home === NONE ? c.z[id] : col.z[home];
    const edu = c.edu[id];
    let best = NONE, bestScore = Infinity;
    for (let k = 0; k < 5; k++) {
      const p = this.places.pickJob(this.rng.next());
      if (p < 0) break;
      if (!this.qualified(edu, p)) continue;
      const dx = col.x[p] - hx, dz = col.z[p] - hz;
      // Distance against how many posts are open, so a large employer wins over a
      // slightly nearer tiny one -- which is what makes a power station fill up
      // rather than losing every applicant to the shop next door to it.
      const score = (dx * dx + dz * dz) / Math.max(1, this.places.openPosts(p));
      if (score < bestScore) { bestScore = score; best = p; }
    }
    if (best === NONE) return false;
    if (!this.places.hire(best)) return false;
    c.work[id] = best;
    c.idleDays[id] = 0;
    this.employed++;
    return true;
  }

  /**
   * Whether somebody's education admits them to a kind of work.
   *
   * Service jobs are split by branch rather than lumped together, and that mattered
   * more than it looks. Requiring a degree for every civic job meant nobody in a new
   * city could staff the power station -- so it ran at its unstaffed floor, which
   * made the city short of power, which made it short of water, which made people
   * leave before anybody could get the education to fix it. A power station operator
   * and a bin lorry driver need a school leaving certificate; a doctor, a teacher and
   * a civil servant need more.
   */
  private qualified(edu: number, place: number): boolean {
    const col = this.places.col;
    switch (col.purpose[place]) {
      case Purpose.WORKS: return true;                        // anybody
      case Purpose.SHOP: return edu >= Edu.SCHOOL;
      case Purpose.OFFICE: return edu >= Edu.COLLEGE;
      case Purpose.SERVICE: {
        const branch = col.branch[place];
        const name = branch === NO_BRANCH ? '' : BRANCHES[branch];
        return LEARNED.has(name) ? edu >= Edu.COLLEGE : edu >= Edu.SCHOOL;
      }
      default: return true;
    }
  }

  /**
   * The service and utility models, once they exist.
   *
   * Given rather than constructed, because the population has to be able to run
   * without them -- a test that only wants to check births and deaths should not
   * have to build a power grid -- and because the dependency genuinely runs this
   * way round: what people feel depends on the services, and the services depend on
   * where the people are.
   */
  services: Services | null = null;
  utilities: Utilities | null = null;

  informedBy(services: Services, utilities: Utilities): void {
    this.services = services;
    this.utilities = utilities;
  }

  /**
   * How well a branch of service reaches somebody, 0 to 1.
   *
   * From the real coverage model: how long it takes a fire engine to get there over
   * the real roads, against how overloaded the stations are. Before the service
   * model is attached it falls back to proximity, which is what the population
   * tests use and is a fair first approximation -- but the fallback is not the
   * answer the game gives, and the difference is the whole point of the service
   * simulation: a station across the river covers nothing.
   */
  coverageAt(id: number, branch: 'health' | 'education' | 'parks' | 'fire'
  | 'police' | 'transport'): number {
    const services = this.services;
    if (services !== null) {
      const home = this.homeOf(id);
      if (home === NONE) return 0;
      return services.byName(home, branch);
    }
    const b = BRANCHES.indexOf(branch);
    if (b < 0) return 0;
    const pool = this.places.byBranch[b];
    if (pool.size === 0) return 0;
    const c = this.citizens.col;
    const col = this.places.col;
    const home = c.where[id] === NONE ? c.x[id] : col.x[c.where[id]];
    const homeZ = c.where[id] === NONE ? c.z[id] : col.z[c.where[id]];
    let bestD = Infinity;
    for (let k = 0; k < 3; k++) {
      const p = pool.pick(this.rng.next());
      if (p < 0) break;
      const dx = col.x[p] - home, dz = col.z[p] - homeZ;
      const d = dx * dx + dz * dz;
      if (d < bestD) bestD = d;
    }
    if (!Number.isFinite(bestD)) return 0;
    const metres = Math.sqrt(bestD);
    return Math.max(0, Math.min(1, 1 - metres / 1200));
  }

  /** The building somebody lives in, or NONE. */
  private homeOf(id: number): number {
    const hh = this.citizens.col.house[id];
    return hh === NONE ? NONE : this.households.col.home[hh];
  }

  /**
   * How well the utilities reach somebody's home, 0 to 1 each.
   *
   * Written into a caller's buffer rather than returned, because it is asked for
   * every citizen on every visit and a four-element array each time is four
   * allocations a citizen a visit.
   */
  utilitiesAt(id: number, out: Float32Array): void {
    const u = this.utilities;
    const home = this.homeOf(id);
    if (u === null || home === NONE) { out[0] = 1; out[1] = 1; out[2] = 1; out[3] = 1; return; }
    for (let k = 0; k < 4; k++) out[k] = u.at(home, k);
  }

  /**
   * The one place a mood is written, so the running total stays exact.
   *
   * Clamped and rounded *before* the difference is taken. A mood lives in a byte,
   * so storing 170.4 stores 170 -- and adding 170.4 to the running total while
   * storing 170 drifts the total upwards by a fraction on every write, which over
   * a few million writes made the city's average happiness read as 180 per cent.
   */
  private setMood(id: number, value: number): void {
    const c = this.citizens.col;
    const v = value < 0 ? 0 : value > 255 ? 255 : Math.round(value);
    this.moodSum += v - c.mood[id];
    c.mood[id] = v;
  }

  /**
   * Unemployment among those who could work, 0 to 1.
   *
   * From the running totals: everybody of working age, less the students among
   * them, against those in a job. Not a walk over the population, because this is
   * read several times a second by the migration model -- and it is the answer a
   * full count gives, to within the students whose stage says they could work.
   */
  get unemployment(): number {
    const able = this.byStage[Stage.YOUNG] + this.byStage[Stage.ADULT] - this.studentAdults;
    if (able <= 0) return 0;
    return Math.max(0, Math.min(1, (able - this.employed) / able));
  }

  /** Students old enough to be counted as workforce if they were not studying. */
  studentAdults = 0;

  /** Average mood across the city, 0 to 1. */
  get happiness(): number {
    return this.population === 0 ? 0 : this.moodSum / this.population / 255;
  }

  /** The same two numbers counted from scratch, for the tests to check against. */
  measure(): { population: number; employed: number; students: number; moodSum: number } {
    const c = this.citizens.col;
    let population = 0, employed = 0, students = 0, moodSum = 0;
    for (let id = 0; id < this.citizens.bound; id++) {
      if (this.citizens.live[id] === 0) continue;
      population++;
      moodSum += c.mood[id];
      if (c.work[id] !== NONE) employed++;
      if (c.study[id] !== NONE) students++;
    }
    return { population, employed, students, moodSum };
  }

  /** The exact mood total, for the tests. */
  get moodTotal(): number { return this.moodSum; }

  bytes(): number { return this.households.bytes() + this.citizens.bytes(); }
}

/** Ticks a day, for scaling per-day rates in a system that runs on ticks. */
export const daysPer = (ticks: number): number => ticks / TICKS_PER_DAY;

/** Re-exported so callers do not have to know which module owns which idea. */
export { NO_BRANCH };
