/**
 * The economy: where the money comes from, and where it goes.
 *
 * Everything else in this simulation is a constraint. This is the one that makes
 * the constraints into a game: a city that cannot be paid for is a city that has
 * to be *chosen*, and every other system -- the services, the transit, the
 * zoning -- becomes a decision the moment it has a bill attached.
 *
 * WHAT IT TAXES, and why they are different.
 *
 *   RESIDENTIAL is income tax on wages earned by people who live here. It scales
 *   with employment rather than with population, which is why a city of the
 *   unemployed is a city with no revenue however many people are in it.
 *
 *   COMMERCIAL is a turnover tax on the high street. It needs both the staff and
 *   the stock: a shop with nobody in it sells nothing, and a shop the industry
 *   cannot supply sells imports.
 *
 *   INDUSTRIAL is a tax on what the works produce, and it is the biggest earner
 *   in the game -- deliberately, and for a reason a player can act on. Industry
 *   makes goods; commerce consumes them; whatever is left over is EXPORTED, and
 *   the export duty is money from outside the city rather than money moved
 *   around inside it. A city that builds more industry than it needs sells the
 *   surplus. A city that builds only shops IMPORTS what they sell and pays for
 *   the privilege, every week, forever.
 *
 *   OFFICE is a tax on high-value work. Per job it is worth the most and it
 *   needs the least in the way of roads and power -- but it needs graduates,
 *   which take a generation and a university to produce.
 *
 * WHAT IT COSTS. Services, which is the whole point of a service: a fire station
 * is not a decoration, it is a standing order. Transit fleets. Roads, by the
 * metre and by the class. And interest, if the city is in the red.
 *
 * WHAT THE RATES DO TO PEOPLE. Above neutral, tax costs appeal -- fewer people
 * want to come -- and it costs mood, which is what makes the ones already here
 * leave. Below neutral it buys both, and costs the money that pays for the
 * services those same people are judging the city on. That tension is the game.
 *
 * NOTHING HERE IS STORED. The balance and the four rates are world state; every
 * figure below is recomputed from the city each time, so a save cannot carry a
 * stale income figure and a rebuilt city cannot disagree with its own budget.
 *
 * COST. One pass over the buildings on a slow timer, plus a handful of running
 * totals somebody else already keeps.
 */

import { Budget, Tax, TAX_NEUTRAL, OVERDRAFT } from '../budget';
import { Places, Purpose } from './places';
import { People } from './people';
import { Migration } from './migration';
import { ASSETS } from '../../assets/registry';
import { ROAD_SPECS } from '../roadgraph';
import type { RoadGraph } from '../roadgraph';
import type { TransitNet } from './transit';
import { Rng } from './rand';

/**
 * A week's wages for one filled job, by purpose.
 *
 * In the same money as everything else costs, which is the only scale that
 * matters: a job is worth a few hundred a week and a clinic is fifty thousand,
 * so a town of a few hundred people buys one every game week or two. Reading
 * them as real salaries is the wrong comparison; reading them against the price
 * list is the right one.
 *
 * Not a salary -- the taxable value one job generates. Office work is worth the
 * most per head and industry the most per building, which is the shape of a real
 * city's tax base and the reason a player who wants money builds industry first
 * and offices later.
 */
const WAGE = {
  [Purpose.SHOP]: 210,
  [Purpose.OFFICE]: 430,
  [Purpose.WORKS]: 280,
  [Purpose.SERVICE]: 300,
} as const;

/** A week's turnover per filled shop job, and the goods that turnover needs. */
const SALES_PER_SHOP_JOB = 620;
const GOODS_PER_SHOP_JOB = 480;

/** A week's output per filled industrial job, in the same units as goods. */
const OUTPUT_PER_WORKS_JOB = 660;

/** A week's billable value per filled office job. */
const VALUE_PER_OFFICE_JOB = 1000;

/**
 * What the city takes on goods sold out of it, and pays on goods brought in.
 *
 * Exporting earns more than importing costs, which is not a subsidy -- it is the
 * difference between selling at a port and buying at one, and it is what makes
 * an industrial city rich and a commercial one expensive to run.
 */
const EXPORT_DUTY = 0.13;
const IMPORT_COST = 0.09;

/** What a rider pays, and what the city keeps of it. */
const FARE = 2.4;

/**
 * THE SCALE. Every figure below is set against one another and against the
 * prices in `costs.ts`, and the anchor is the early game rather than the late
 * one -- a town of a few hundred people with four services and three kilometres
 * of street should clear a building's price every game week or two at the
 * neutral rate. That is the pace at which a player is deciding what to build
 * next rather than waiting to be allowed to.
 *
 * What the library's `upkeep` figure is worth in money a week.
 *
 * The asset library states an upkeep for everything, in its own units. Only the
 * city's own buildings are the city's bill -- a warehouse's running costs are
 * its owner's, and they are already priced into what it produces.
 */
const UPKEEP_PER_UNIT = 45;

/** And the share of that a building costs even with nobody working in it. */
const UPKEEP_IDLE = 0.45;

/** Weekly maintenance per metre of carriageway, by how wide the road is. */
const ROAD_UPKEEP_PER_EDGE_METRE = 0.35;

/** Weekly interest on an overdraft. */
const INTEREST = 0.008;

/**
 * How hard tax bites at mood, at the top of the scale.
 *
 * Twenty-nine per cent is three times neutral and takes about a fifth off how
 * people feel about living here, which is enough to empty a city that is
 * otherwise only just holding on and not enough to empty one that is good.
 */
const TAX_MOOD_BITE = 52;

export interface Ledger {
  /** Weekly money in, by source. */
  residential: number;
  commercial: number;
  industrial: number;
  office: number;
  exports: number;
  fares: number;
  /** Weekly money out, by kind. */
  services: number;
  transit: number;
  roads: number;
  imports: number;
  interest: number;
  /** The totals, and the bottom line. */
  income: number;
  spending: number;
  net: number;
  /** What the city produces and what it needs, in goods a week. */
  goodsMade: number;
  goodsWanted: number;
  /** The last thing that happened, and what it was worth. */
  event: string;
  eventValue: number;
  /**
   * How many events have happened.
   *
   * The text alone cannot say whether an event is new: the same trade fair comes
   * to town twice and the string does not change, so anything watching for
   * something to tell the player about would miss the second one. A count does.
   */
  eventSerial: number;
  /** How many weeks of the current deficit the treasury could stand. */
  weeksLeft: number;
}

/** One thing that can happen to a city, out of the blue. */
interface Happening {
  name: string;
  /** What it says on the toast. */
  text: string;
  /**
   * What it is worth, as a share of a week's income -- positive or negative.
   *
   * A share rather than a sum, so an event is worth something to a village and
   * something to a metropolis, and a windfall never trivialises either.
   */
  share: number;
  /** Whether the city is in a state where this could happen at all. */
  when: (c: Conditions) => boolean;
  weight: number;
}

interface Conditions {
  population: number;
  happiness: number;
  industry: number;
  offices: number;
  shops: number;
  transitRiders: number;
  parks: number;
}

/**
 * The things that can happen.
 *
 * Every one of them is caused by something the player built, which is what makes
 * them part of the game rather than a slot machine: a city with industry gets
 * industrial events, a city with a transit network gets transport ones, and a
 * city with nothing gets almost nothing.
 */
const HAPPENINGS: Happening[] = [
  {
    name: 'trade-fair', weight: 3, share: 0.22,
    text: 'A trade fair came to town — the exhibitors paid for the pitch.',
    when: (c) => c.industry > 200 && c.population > 800,
  },
  {
    name: 'film', weight: 3, share: 0.16,
    text: 'A film crew shot here for a week and paid a location fee.',
    when: (c) => c.population > 400 && c.happiness > 0.55,
  },
  {
    name: 'festival', weight: 3, share: 0.14,
    text: 'The summer festival drew a crowd and the takings were good.',
    when: (c) => c.parks >= 2 && c.population > 600,
  },
  {
    name: 'export-order', weight: 4, share: 0.3,
    text: 'A large export order was filled out of the industrial estate.',
    when: (c) => c.industry > 600,
  },
  {
    name: 'conference', weight: 2, share: 0.2,
    text: 'A conference booked out the offices and the hotels with them.',
    when: (c) => c.offices > 400,
  },
  {
    name: 'ridership', weight: 2, share: 0.1,
    text: 'Record ridership on the network — a month of fares in a week.',
    when: (c) => c.transitRiders > 500,
  },
  {
    name: 'storm', weight: 3, share: -0.24,
    text: 'A storm took out a stretch of road. The repairs are paid for.',
    when: (c) => c.population > 300,
  },
  {
    name: 'strike', weight: 2, share: -0.18,
    text: 'A pay dispute in the works — a week of lost output, settled.',
    when: (c) => c.industry > 400 && c.happiness < 0.6,
  },
  {
    name: 'burst-main', weight: 2, share: -0.15,
    text: 'A water main burst under the high street. Emergency works.',
    when: (c) => c.population > 500,
  },
  {
    name: 'grant', weight: 2, share: 0.26,
    text: 'A regional development grant came through.',
    when: (c) => c.population > 1500 && c.happiness > 0.6,
  },
];

/** Game days between one thing happening and the next, on average. */
const DAYS_BETWEEN_EVENTS = 6;

export class Economy {
  readonly report: Ledger = {
    residential: 0, commercial: 0, industrial: 0, office: 0, exports: 0, fares: 0,
    services: 0, transit: 0, roads: 0, imports: 0, interest: 0,
    income: 0, spending: 0, net: 0,
    goodsMade: 0, goodsWanted: 0,
    event: '', eventValue: 0, eventSerial: 0, weeksLeft: Infinity,
  };

  /** Road metres by class, kept between road edits rather than resummed. */
  private roadMetres = 0;
  private roadVersion = -1;

  private readonly rng: Rng;
  private owedEvents = 0;

  constructor(
    private budget: Budget,
    private places: Places,
    private people: People,
    private migration: Migration,
    private transit: TransitNet | null,
    private net: RoadGraph | null,
    seed = 0x5a1e,
  ) {
    this.rng = new Rng(seed);
  }

  /** The world was replaced, or the roads were. */
  rebind(budget: Budget, net: RoadGraph | null, transit: TransitNet | null): void {
    this.budget = budget;
    this.net = net;
    this.transit = transit;
    this.roadVersion = -1;
  }

  /**
   * A week's figures, and the money moved for however much of one has passed.
   *
   * Everything is quoted per week and applied pro rata, which is the only way a
   * budget panel can say a number a player can reason about while the treasury
   * moves continuously. A week is the unit people think about a city's finances
   * in; a tick is not.
   */
  settle(days: number): void {
    const r = this.report;
    const b = this.budget;
    const p = this.places;

    // ---- what the city makes ---------------------------------------------
    //
    // From the running totals, which is the whole reason they exist: `working`
    // per purpose is maintained by every hire and every sacking, so this is four
    // multiplications rather than a walk over thirty thousand buildings.
    const shopJobs = p.staffed[Purpose.SHOP];
    const officeJobs = p.staffed[Purpose.OFFICE];
    const worksJobs = p.staffed[Purpose.WORKS];
    const serviceJobs = p.staffed[Purpose.SERVICE];

    const wages = shopJobs * WAGE[Purpose.SHOP] + officeJobs * WAGE[Purpose.OFFICE]
      + worksJobs * WAGE[Purpose.WORKS] + serviceJobs * WAGE[Purpose.SERVICE];
    const sales = shopJobs * SALES_PER_SHOP_JOB;
    const output = worksJobs * OUTPUT_PER_WORKS_JOB;
    const billings = officeJobs * VALUE_PER_OFFICE_JOB;

    r.residential = wages * b.rates[Tax.RESIDENTIAL];
    r.commercial = sales * b.rates[Tax.COMMERCIAL];
    r.industrial = output * b.rates[Tax.INDUSTRIAL];
    r.office = billings * b.rates[Tax.OFFICE];

    // ---- trade -------------------------------------------------------------
    //
    // Goods, in one number, because that is the only level at which a player can
    // act on it: build more industry or build fewer shops.
    const wanted = shopJobs * GOODS_PER_SHOP_JOB;
    r.goodsMade = output;
    r.goodsWanted = wanted;
    const surplus = output - wanted;
    r.exports = surplus > 0 ? surplus * EXPORT_DUTY : 0;
    r.imports = surplus < 0 ? -surplus * IMPORT_COST : 0;

    // ---- fares -------------------------------------------------------------
    const riders = this.transit?.report.ridersPerDay ?? 0;
    r.fares = riders * 7 * FARE;

    // ---- what the city owes ------------------------------------------------
    r.services = this.serviceUpkeep();
    r.transit = this.transit?.report.weekly ?? 0;
    r.roads = this.roadUpkeep();
    r.interest = b.balance < 0 ? -b.balance * INTEREST : 0;

    r.income = r.residential + r.commercial + r.industrial + r.office
      + r.exports + r.fares;
    r.spending = r.services + r.transit + r.roads + r.imports + r.interest;
    r.net = r.income - r.spending;
    r.weeksLeft = r.net >= 0 ? Infinity
      : Math.max(0, (b.balance + OVERDRAFT) / -r.net);

    // ---- and the money actually moves --------------------------------------
    const share = days / 7;
    if (r.net >= 0) b.credit(r.net * share);
    else b.charge(-r.net * share);

    // ---- what the rates do to people ---------------------------------------
    //
    // Both directions of one number, set here rather than duplicated: appeal
    // decides who comes, mood decides who stays, and a rate that did only one of
    // the two would be a lever with half a consequence.
    const felt = b.felt;
    this.migration.taxRate = felt;
    this.people.taxMood = -((felt - TAX_NEUTRAL) / TAX_NEUTRAL) * TAX_MOOD_BITE;

    this.maybeHappen(days);
  }

  /**
   * The standing orders.
   *
   * A walk, because upkeep is per building and there is no running total of it --
   * but only over the service buildings, which are the ones the city pays for and
   * are a small fraction of the table. A city with a thousand of them is a city
   * with a very large budget problem and this is the least of it.
   */
  private serviceUpkeep(): number {
    const p = this.places;
    const c = p.col;
    let total = 0;
    for (let b = 0; b < p.byBranch.length; b++) {
      const pool = p.byBranch[b];
      for (let i = 0; i < pool.size; i++) {
        const id = pool.member(i);
        const def = ASSETS[c.proto[id]];
        const upkeep = def?.sim?.upkeep ?? 0;
        if (upkeep <= 0) continue;
        // A station with half its watch on costs more than half: the building is
        // there either way and only the wages move.
        const staffed = c.jobs[id] > 0 ? c.working[id] / c.jobs[id] : 1;
        total += upkeep * UPKEEP_PER_UNIT * (UPKEEP_IDLE + (1 - UPKEEP_IDLE) * staffed);
      }
    }
    return total;
  }

  /** Metres of carriageway, resummed only when the network changes. */
  private roadUpkeep(): number {
    const net = this.net;
    if (net === null) return 0;
    if (net.version !== this.roadVersion) {
      this.roadVersion = net.version;
      let metres = 0;
      for (const link of net.links) {
        const spec = ROAD_SPECS[link.cls];
        metres += net.length(link) * spec.edge;
      }
      this.roadMetres = metres;
    }
    return this.roadMetres * ROAD_UPKEEP_PER_EDGE_METRE;
  }

  /**
   * Something happens, now and then.
   *
   * Drawn from what the city actually is: a place with no industry never gets an
   * export order and a place with no parks never has a festival. An event nobody
   * could have caused is a random number with a sentence attached, and a player
   * learns within two of them to stop reading it.
   */
  private maybeHappen(days: number): void {
    this.owedEvents += days / DAYS_BETWEEN_EVENTS;
    if (this.owedEvents < 1) return;
    this.owedEvents -= 1;

    const p = this.places;
    const parksBranch = 9;                       // BRANCHES index of 'parks'
    const conditions: Conditions = {
      population: this.people.population,
      happiness: this.people.happiness,
      industry: p.staffed[Purpose.WORKS],
      offices: p.staffed[Purpose.OFFICE],
      shops: p.staffed[Purpose.SHOP],
      transitRiders: this.transit?.report.ridersPerDay ?? 0,
      parks: p.byBranch[parksBranch]?.size ?? 0,
    };

    let total = 0;
    for (const h of HAPPENINGS) if (h.when(conditions)) total += h.weight;
    if (total === 0) return;
    let roll = this.rng.next() * total;
    for (const h of HAPPENINGS) {
      if (!h.when(conditions)) continue;
      roll -= h.weight;
      if (roll > 0) continue;
      const value = Math.round(this.report.income * h.share);
      if (value === 0) return;
      if (value > 0) this.budget.credit(value); else this.budget.charge(-value);
      this.report.event = h.text;
      this.report.eventValue = value;
      this.report.eventSerial++;
      return;
    }
  }
}
