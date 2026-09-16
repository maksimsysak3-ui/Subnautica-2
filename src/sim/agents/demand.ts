/**
 * Demand: whether the city wants more houses, more shops or more work.
 *
 * The number behind the four bars at the bottom of the screen, and the number
 * that decides what grows. Everything else in the simulation produces a reading
 * about how the city *is*; this is the one that says what it is short of, which is
 * the only question a player is really answering when they zone.
 *
 * MEASURED AS VACANCY, which is the whole design and is worth the paragraph.
 *
 * The obvious model is a budget: so many shop jobs per resident, so many homes per
 * job, and a bar that fills when the city is under its quota. That model was
 * written first and it does not work, because the quota has to come from
 * somewhere. Taken from real cities it disagrees with the building library, whose
 * warehouses employ six hundred people on fifteen cells; taken from the library it
 * disagrees with itself, because the library's own showcase city has two and a
 * half jobs for every resident. Either way the bars end up pinned at a limit and
 * the player is told nothing.
 *
 * So nothing here counts capacity against a target. It counts how much of the
 * capacity is *being used*:
 *
 *   Homes standing empty mean the city does not need more houses, whatever any
 *   ratio says. Homes all full mean it does.
 *
 *   Shop jobs standing empty mean the city does not need more shops -- the ones it
 *   has cannot even be staffed. Shop jobs all taken mean it does.
 *
 *   The same for industry and for offices, separately, which is what makes the two
 *   bars say different things: hiring is education-aware, so a city of school
 *   leavers leaves its office jobs empty and its warehouse jobs full, and the bars
 *   report exactly that without being told anything about education.
 *
 * That is self-calibrating -- it has no idea how many jobs a warehouse holds and
 * does not need one -- and it is also the honest signal. A developer builds when
 * the last thing built filled up.
 *
 * THE ONE THING VACANCY CANNOT SAY is why anybody would come to an empty field, so
 * residential carries the one term that is not an occupancy: see `OUTSIDE_PULL`.
 *
 * SIGNED, NOT POSITIVE. Demand runs from minus one to one, and the negative half
 * is doing real work: it is what stops a player zoning a thousand cells of
 * industry and getting a thousand cells of industry, and it is the answer to "why
 * is my industrial estate empty". Nothing grows on a zone whose demand is at or
 * below zero, and the bar shows it as a stub below the line rather than as absent,
 * so the reason is legible.
 *
 * CHEAP. Every input is a running total somebody else already keeps, so this is a
 * dozen divisions on a timer and never a walk over anything.
 */

import { Places, Purpose } from './places';
import { People, Stage } from './people';
import { Migration } from './migration';

/** The four bars, in the order they are drawn. */
export const Want = {
  RESIDENTIAL: 0,
  COMMERCIAL: 1,
  INDUSTRIAL: 2,
  OFFICE: 3,
} as const;
export const WANT_NAMES = ['residential', 'commercial', 'industrial', 'office'] as const;
export const WANTS = WANT_NAMES.length;

/**
 * The vacancy a healthy market runs at.
 *
 * Not zero. A city with every house full and every job taken has nowhere for
 * anyone to move to and no way for anyone to change jobs, and the thing that keeps
 * it liveable is a few per cent of slack. Above the target the city is overbuilt;
 * below it, short.
 */
const TARGET_VACANCY_HOME = 0.06;
const TARGET_VACANCY_JOB = 0.09;

/**
 * Share of the population that is of working age and looking.
 *
 * Read from the stage counts rather than assumed, because an ageing city really
 * does need fewer jobs and a young one more, and that is a difference the player
 * can do something about.
 */
function workforce(people: People): number {
  const b = people.byStage;
  return (b[Stage.TEEN] ?? 0) * 0.15 + (b[Stage.YOUNG] ?? 0) + (b[Stage.ADULT] ?? 0);
}

/**
 * How hard a shortage has to bite before the bar fills.
 *
 * A shortage of a tenth reads as a full bar, which sounds steep and is right: a
 * city ten per cent short of housing is visibly short of it, and a bar that only
 * fills at a catastrophe is a bar nobody can act on.
 */
const BITE = 0.10;

/** Turns a shortage, as a fraction, into a bar between minus one and one. */
function bar(shortage: number): number {
  return Math.max(-1, Math.min(1, shortage / BITE));
}

/**
 * How much of the new reading each refresh takes.
 *
 * The readings themselves are steps, not curves: one warehouse is six hundred jobs
 * and one refresh turns a bar from full to empty. Left raw, the bars flicker and
 * growth twitches -- it releases a patch, overshoots, stops, and releases another
 * three seconds later. A quarter at a fifth of a second is a time constant of
 * about three seconds, which is slow enough to read and far faster than anything a
 * city actually does.
 */
const SMOOTHING = 0.25;

/**
 * How much a city with nothing in it still pulls people in.
 *
 * Without this the whole model deadlocks on the first frame, and the deadlock is
 * real rather than theoretical: an empty site has no homes, so nothing is full, so
 * no shortage, so nothing is built, so nobody arrives. Every bar sits at its
 * target and nothing the player zones ever comes up.
 *
 * The honest reading is that a city is not a closed system. People move to a new
 * town for the place before they move for the job -- which is exactly what a
 * player is building when they lay the first street -- and the thing that stops
 * that being a free lunch is on the next line: the pull dies as the city's own
 * unemployment rises, so a town that keeps taking people it cannot employ stops
 * being somewhere people go.
 */
const OUTSIDE_PULL = 0.13;
/**
 * Unemployment at which the outside pull is gone entirely.
 *
 * Deliberately not the four or five per cent an economist would call full
 * employment. This number is doing one job -- stopping a town that cannot employ
 * anybody from filling up anyway -- and setting it tight makes the first minutes
 * of every game stall: six people move into the first three houses, none of them
 * has a job because nothing else is zoned yet, and the housing bar goes flat with
 * a hamlet on the map. A third of the workforce out of work is a real reason to
 * stop moving somewhere; an eighth is a Tuesday.
 */
const PULL_DIES_AT = 0.32;

/** Vacancy as a share. Nothing built counts as nothing empty, which is the point. */
function vacancy(free: number, total: number): number {
  return total > 0 ? Math.max(0, free) / total : 0;
}

export class Demand {
  /** Minus one to one, per `Want`. Smoothed -- see `SMOOTHING`. */
  readonly want = new Float64Array(WANTS);
  /** This instant's reading, before smoothing. */
  private readonly raw = new Float64Array(WANTS);
  private settled = false;
  /** What the bars are made of, for the readout to explain itself. */
  readonly detail = {
    homeVacancy: 0,
    shopVacancy: 0,
    worksVacancy: 0,
    officeVacancy: 0,
    unemployed: 0,
  };

  constructor(
    private places: Places,
    private people: People,
    private migration: Migration,
  ) {}

  /** Recomputed on a timer. Nothing here walks a table. */
  refresh(): void {
    const p = this.places;
    const force = workforce(this.people);
    const appeal = Math.max(0, Math.min(1, this.migration.appeal));

    // ---- housing ----------------------------------------------------------
    const homeVacancy = vacancy(p.homeCapacity - p.households, p.homeCapacity);
    // Positive when the city is fuller than a healthy market, which is when a
    // developer would build.
    const room = TARGET_VACANCY_HOME - homeVacancy;

    const jobless = Math.max(0, force - this.people.employed);
    const unemployed = force > 0 ? jobless / force : 0;
    // And the reason anybody would come. Work going begging pulls people towards
    // the city; so, at a lower weight, does the place itself. Both die as the city
    // runs out of work for the people already in it.
    const alive = Math.max(0, 1 - unemployed / PULL_DIES_AT);
    const jobsFree = Math.max(0, p.jobCapacity - p.workers);
    const pull = (OUTSIDE_PULL + Math.min(0.25, jobsFree / Math.max(60, force) * 0.2))
      * alive * (0.35 + 0.65 * appeal);
    this.raw[Want.RESIDENTIAL] = bar(room + pull);

    // ---- work, of three kinds ---------------------------------------------
    //
    // One rule, three times. Nothing here knows what a shop is or what a degree
    // is: it asks whether the jobs of that kind are being taken, and hiring --
    // which does know about degrees -- decides the answer. A city whose graduates
    // will not stack pallets leaves its warehouse jobs empty and this reads it off
    // the vacancy without being told.
    const shopVacancy = vacancy(p.vacancies[Purpose.SHOP], p.posts[Purpose.SHOP]);
    const worksVacancy = vacancy(p.vacancies[Purpose.WORKS], p.posts[Purpose.WORKS]);
    const officeVacancy = vacancy(p.vacancies[Purpose.OFFICE], p.posts[Purpose.OFFICE]);
    // Unemployment lifts all three: people out of work is the city asking for jobs
    // of some kind, and which kind is then the vacancies' business. Weighted well
    // under one so it cannot on its own override a purpose that plainly cannot
    // staff what it already has.
    const hunger = Math.min(0.06, unemployed * 0.25);
    this.raw[Want.COMMERCIAL] = bar(TARGET_VACANCY_JOB - shopVacancy + hunger);
    this.raw[Want.INDUSTRIAL] = bar(TARGET_VACANCY_JOB - worksVacancy + hunger);
    this.raw[Want.OFFICE] = bar(TARGET_VACANCY_JOB - officeVacancy + hunger);

    // Smoothed, except on the very first reading -- which has nothing to smooth
    // towards, and starting every game with four bars easing up from zero would
    // make the first three seconds look like a city that wants nothing.
    for (let i = 0; i < WANTS; i++) {
      this.want[i] = this.settled
        ? this.want[i] + (this.raw[i] - this.want[i]) * SMOOTHING
        : this.raw[i];
    }
    this.settled = true;

    const d = this.detail;
    d.homeVacancy = homeVacancy;
    d.shopVacancy = shopVacancy;
    d.worksVacancy = worksVacancy;
    d.officeVacancy = officeVacancy;
    d.unemployed = unemployed;
  }

  /** The bar for a zone name, or one for a zone that does not answer to a market. */
  forZone(zone: string): number {
    switch (zone) {
      case 'residential': return this.want[Want.RESIDENTIAL];
      case 'commercial': return this.want[Want.COMMERCIAL];
      case 'industrial': return this.want[Want.INDUSTRIAL];
      case 'office': return this.want[Want.OFFICE];
      // Parks and nature are not a market. A player who paints one has already
      // decided they want it, and waiting for demand would be waiting forever.
      default: return 1;
    }
  }
}
