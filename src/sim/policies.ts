/**
 * City policies: the levers a mayor pulls that are not a building.
 *
 * Everything else the player can do is placed somewhere. Zoning goes on a plot,
 * a clinic goes on a corner, a bus route runs down a street -- and all of it is
 * a decision about *where*. A city is also governed, and governing is a set of
 * decisions about *whether*: whether rubbish is sorted, whether the works may
 * smoke, whether the buses are free, whether there is a height limit. Those are
 * the decisions that make a place a particular kind of place rather than a
 * bigger one, and without them a city builder is a construction set.
 *
 * WORLD STATE, like the budget and the zoning, because it is what the player
 * decided rather than what follows from it. Nothing derived is stored here: the
 * multipliers below are recomputed from the switches whenever one moves, and
 * every agent reads them rather than being told about them.
 *
 * WHAT A POLICY COSTS. Two things, and both matter. Money, weekly, scaled to
 * the city so that a policy a village can afford is still a real decision for a
 * metropolis -- and a trade-off in the simulation itself: smoke control cleans
 * the air and takes ten per cent off what the works are worth, a height limit
 * raises land value and caps what a lot can become. A policy with only an upside
 * is a button nobody thinks about before pressing.
 *
 * HOW THE EFFECTS REACH THE SIMULATION. Through the model each one belongs to,
 * not through a special case. Free transport sets the transit fare to zero in
 * the *mode choice*, so people switch to the bus for the reason real people do;
 * recycling multiplies what a building puts out in `utilities`; smoke control
 * multiplies industrial pollution where pollution is summed. There is no code
 * anywhere that says "if the free transport policy is on, add riders".
 */

/** Everything a policy can change, gathered so agents read one object. */
export interface Effects {
  /** Multipliers on what a building demands. 1 is no change. */
  garbage: number;
  water: number;
  power: number;
  /** Multiplier on what industry puts in the air. */
  industrialPollution: number;
  /** Multipliers on the taxable value each zone generates. */
  residentialYield: number;
  commercialYield: number;
  industrialYield: number;
  officeYield: number;
  /** Multiplier on what the services cost to run. */
  serviceUpkeep: number;
  /** Added to every cell's land value, before it is clamped. */
  landValue: number;
  /** Multipliers on how far a service building's coverage reaches. */
  safetyReach: number;
  learningReach: number;
  /** What a transit trip costs the traveller, as a multiplier on the fare. */
  transitFare: number;
  /** Added to the cost of driving, in the same money as the fare. */
  parkingCharge: number;
  /** The highest tier a lot may be built up to, 0 to 2. */
  tierCap: number;
}

function clear(): Effects {
  return {
    garbage: 1, water: 1, power: 1,
    industrialPollution: 1,
    residentialYield: 1, commercialYield: 1, industrialYield: 1, officeYield: 1,
    serviceUpkeep: 1,
    landValue: 0,
    safetyReach: 1, learningReach: 1,
    transitFare: 1, parkingCharge: 0,
    tierCap: 2,
  };
}

/** What a policy costs the city each week. */
export interface Price {
  /** Regardless of size. Rare: most things scale. */
  flat?: number;
  perResident?: number;
  perJob?: number;
  /** Per building of any zone the city has standing. */
  perBuilding?: number;
}

export interface PolicyDef {
  id: string;
  name: string;
  /** One sentence, in the player's language, about what it is. */
  blurb: string;
  price: Price;
  /** What it does, applied over the cleared effects. */
  apply: (e: Effects) => void;
  /** The short lines the panel lists under the name. */
  says: readonly string[];
}

/**
 * The ten.
 *
 * Chosen so that no two of them are the same decision wearing different words:
 * each one trades something the player can see for something else they can see,
 * and each one hooks a different model. Between them they touch waste, air,
 * money, movement, safety, learning, land and height -- which is most of what a
 * council actually decides.
 */
export const POLICIES: readonly PolicyDef[] = [
  {
    id: 'recycling',
    name: 'Kerbside recycling',
    blurb: 'Sorted collections from every door, and a depot to take them to.',
    price: { perResident: 1.15 },
    apply: (e) => { e.garbage *= 0.64; },
    says: ['Rubbish down 36%', 'Costs 1.15 a resident a week'],
  },
  {
    id: 'metering',
    name: 'Water metering',
    blurb: 'Everybody pays for what they use, so everybody uses less of it.',
    price: { perResident: 0.55 },
    apply: (e) => { e.water *= 0.80; },
    says: ['Water demand down 20%', 'Costs 0.55 a resident a week'],
  },
  {
    id: 'smokeControl',
    name: 'Smoke control area',
    blurb: 'Filters and fuel rules on every works in the city.',
    price: {},
    apply: (e) => { e.industrialPollution *= 0.52; e.industrialYield *= 0.90; },
    says: ['Industrial air pollution down 48%', 'Industry earns 10% less'],
  },
  {
    id: 'freeTransit',
    name: 'Free public transport',
    blurb: 'No fares on any line. More people ride; nobody pays to.',
    price: { perResident: 2.1 },
    apply: (e) => { e.transitFare = 0; },
    says: ['No fare on any journey', 'No fare income either',
      'Costs 2.10 a resident a week'],
  },
  {
    id: 'parking',
    name: 'City-centre parking charges',
    blurb: 'A charge on every car trip that ends in the city, and the income from it.',
    price: { perJob: -0.85 },
    // And the other half of it: a shopper who cannot park is a shopper who
    // went somewhere else. Without this the charge is money and less traffic
    // for nothing, which is not a decision.
    apply: (e) => { e.parkingCharge += 0.34; e.commercialYield *= 0.95; },
    says: ['Driving costs more, so fewer drive', 'Shops take 5% less',
      'Earns 0.85 a job a week'],
  },
  {
    id: 'businessRelief',
    name: 'Small business relief',
    blurb: 'Rates relief for the high street, paid for out of the city purse.',
    price: { perBuilding: 5.5 },
    apply: (e) => { e.commercialYield *= 1.12; },
    says: ['Shops earn 12% more', 'Costs 5.50 a building a week'],
  },
  {
    id: 'adultEducation',
    name: 'Adult education',
    blurb: 'Evening classes in every school, so a school reaches further than its catchment.',
    price: { perResident: 1.9 },
    apply: (e) => { e.learningReach *= 1.30; e.officeYield *= 1.06; },
    says: ['Schools reach 30% further', 'Office work earns 6% more'],
  },
  {
    id: 'watch',
    name: 'Neighbourhood watch',
    blurb: 'Volunteers, street by street, so a police post covers more ground.',
    price: { perResident: 0.45 },
    apply: (e) => { e.safetyReach *= 1.22; },
    says: ['Police posts reach 22% further', 'Costs 0.45 a resident a week'],
  },
  {
    id: 'greenCorridors',
    name: 'Green corridors',
    blurb: 'Street trees, verges and a planted route through every quarter.',
    price: { perResident: 1.35 },
    apply: (e) => { e.landValue += 0.055; },
    says: ['Land worth more everywhere', 'Costs 1.35 a resident a week'],
  },
  {
    id: 'heightLimit',
    name: 'Height limit',
    blurb: 'Nothing above the mid-rise line. A quieter skyline, and a smaller one.',
    price: {},
    apply: (e) => { e.tierCap = 1; e.landValue += 0.035; e.officeYield *= 0.93; },
    says: ['Lots never build past the second tier', 'Land worth a little more',
      'Office work earns 7% less'],
  },
];

export const POLICY_COUNT = POLICIES.length;

/**
 * Which are on, and what that adds up to.
 *
 * The effects are recomputed on every change rather than on every read, because
 * they are read by the utilities pass, the ground pass and every mode choice in
 * the city -- millions of times between one click and the next.
 */
export class Policies {
  readonly on = new Uint8Array(POLICY_COUNT);
  /** Bumped whenever a switch moves, so readouts know to repaint. */
  version = 0;
  readonly effects: Effects = clear();

  has(i: number): boolean {
    return i >= 0 && i < POLICY_COUNT && this.on[i] === 1;
  }

  set(i: number, on: boolean): void {
    if (i < 0 || i >= POLICY_COUNT) return;
    const want = on ? 1 : 0;
    if (this.on[i] === want) return;
    this.on[i] = want;
    this.recompute();
  }

  toggle(i: number): void {
    this.set(i, !this.has(i));
  }

  /** How many are in force, for the readout. */
  get active(): number {
    let n = 0;
    for (let i = 0; i < POLICY_COUNT; i++) n += this.on[i];
    return n;
  }

  /**
   * What the lot of them cost a week, given the city they are being run in.
   *
   * Negative is possible and is the point: parking charges earn. The caller is
   * `economy`, which puts the figure on the budget panel as its own line -- a
   * policy whose bill is buried inside the service upkeep is a policy the
   * player cannot weigh.
   */
  weekly(residents: number, jobs: number, buildings: number): number {
    let total = 0;
    for (let i = 0; i < POLICY_COUNT; i++) {
      if (this.on[i] === 0) continue;
      const p = POLICIES[i].price;
      total += (p.flat ?? 0)
        + (p.perResident ?? 0) * residents
        + (p.perJob ?? 0) * jobs
        + (p.perBuilding ?? 0) * buildings;
    }
    return total;
  }

  /** Restores from a save. Unknown ids are dropped rather than guessed at. */
  restore(ids: readonly string[]): void {
    this.on.fill(0);
    for (const id of ids) {
      const i = POLICIES.findIndex((p) => p.id === id);
      if (i >= 0) this.on[i] = 1;
    }
    this.recompute();
  }

  /** The ids in force, for a save. By id, so the order here can change. */
  saved(): string[] {
    const out: string[] = [];
    for (let i = 0; i < POLICY_COUNT; i++) if (this.on[i] === 1) out.push(POLICIES[i].id);
    return out;
  }

  private recompute(): void {
    Object.assign(this.effects, clear());
    for (let i = 0; i < POLICY_COUNT; i++) {
      if (this.on[i] === 1) POLICIES[i].apply(this.effects);
    }
    this.version++;
  }
}

/** The effects a system sees when there is no city -- a test, or the menu. */
export const NO_POLICIES = new Policies();
