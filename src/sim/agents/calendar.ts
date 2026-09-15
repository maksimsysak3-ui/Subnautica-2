/**
 * Game time: the day, the hour, the week and the seasons.
 *
 * One decision here shapes everything downstream, so it is worth stating plainly
 * rather than burying in a constant.
 *
 * A city builder needs two clocks running at different speeds and pretending
 * otherwise produces a game nobody can watch. The first is the day: people leave
 * for work in the morning, the roads fill twice, the shops shut, and the player
 * wants to see that happen in a minute or two, not in twenty-four hours. The
 * second is the lifetime: children have to grow up, people have to retire and
 * die and be replaced, and a player has to be able to see a generation turn over
 * in one sitting. Ninety real seconds to the day gives the first. It does not
 * give the second -- eighty years of it is four hundred hours of play.
 *
 * So ageing runs on its own compressed scale, and this module owns the ratio
 * instead of leaving it implied. There is deliberately no calendar year: a year
 * that was 365 of these days would contradict the age of everybody living in the
 * city, so the city counts days and people count years, and the two are related
 * by one number that can be turned.
 *
 * Everything that follows -- when somebody leaves for work, how fast a queue of
 * applicants is worked through, how long a shop takes to fail -- is expressed in
 * days or minutes of this clock, never in ticks, so that changing the speed of
 * the game changes the speed of the game and nothing else.
 */

import { TICK_HZ } from './tick';

/** Real seconds in a game day, at speed 1. */
export const SECONDS_PER_DAY = 90;
/** Simulation ticks in a game day. */
export const TICKS_PER_DAY = Math.round(SECONDS_PER_DAY * TICK_HZ);
/** Minutes in a day, so schedules can be written the way people read them. */
export const MINUTES_PER_DAY = 24 * 60;
/** Ticks in a game minute. Under one, so schedules are checked, not counted. */
export const TICKS_PER_MINUTE = TICKS_PER_DAY / MINUTES_PER_DAY;

/**
 * Years of a life per game day.
 *
 * A third, so a life of eighty years takes two hundred and forty days -- six
 * hours at speed 1, an hour and a half at the fastest setting. Long enough that
 * a citizen is not a mayfly, short enough that a player who builds a school sees
 * its pupils grow up and go to work.
 */
export const YEARS_PER_DAY = 1 / 3;
/** Days of a life per year of it: the same number, the way the code asks. */
export const DAYS_PER_YEAR = 1 / YEARS_PER_DAY;

/** Days in a week, and in a season. */
export const DAYS_PER_WEEK = 7;
export const DAYS_PER_SEASON = 28;

export const Season = { SPRING: 0, SUMMER: 1, AUTUMN: 2, WINTER: 3 } as const;
export const SEASON_NAMES = ['spring', 'summer', 'autumn', 'winter'] as const;

/**
 * The clock.
 *
 * Driven by ticks, because the tick is the only thing in the simulation that
 * happens at a fixed rate, and read in days and minutes, because that is what
 * every rule is written in.
 */
export class Clock {
  /** Ticks since the city was founded. */
  tick = 0;

  /** Whole days since the city was founded. Day 0 is founding day. */
  get day(): number { return Math.floor(this.tick / TICKS_PER_DAY); }

  /** How far through the current day, 0 at midnight and 1 at the next. */
  get fraction(): number {
    const t = this.tick % TICKS_PER_DAY;
    return t / TICKS_PER_DAY;
  }

  /** Minute of the day, 0 to 1439. */
  get minute(): number { return Math.floor(this.fraction * MINUTES_PER_DAY); }
  /** Hour of the day, 0 to 23. */
  get hour(): number { return Math.floor(this.fraction * 24); }

  get dayOfWeek(): number { return this.day % DAYS_PER_WEEK; }
  /** Days 5 and 6 of the week. */
  get isWeekend(): boolean { return this.dayOfWeek >= 5; }

  get season(): number {
    return Math.floor(this.day / DAYS_PER_SEASON) % 4;
  }

  /** Age in years of somebody born on a given day. */
  ageOf(bornDay: number): number {
    return (this.day - bornDay) * YEARS_PER_DAY;
  }

  /** The day somebody of this age was born, for founding a city with adults in it. */
  bornDayFor(years: number): number {
    return this.day - Math.round(years * DAYS_PER_YEAR);
  }

  /** Advances by whole ticks. */
  advance(ticks = 1): void { this.tick += ticks; }

  /** Whether a given minute of the day falls in the tick just run. */
  crossed(minute: number, ticks = 1): boolean {
    const before = this.tick - ticks;
    const a = Math.floor(before / TICKS_PER_MINUTE);
    const b = Math.floor(this.tick / TICKS_PER_MINUTE);
    if (b === a) return false;
    const target = minute;
    // Minutes are counted from founding, so compare within the day.
    for (let m = a + 1; m <= b; m++) if (m % MINUTES_PER_DAY === target) return true;
    return false;
  }

  /** "Day 412, Tuesday 07:45, spring" -- for the readout. */
  get label(): string {
    const names = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const h = String(this.hour).padStart(2, '0');
    const m = String(this.minute % 60).padStart(2, '0');
    return `day ${this.day}, ${names[this.dayOfWeek]} ${h}:${m}, ${SEASON_NAMES[this.season]}`;
  }
}
