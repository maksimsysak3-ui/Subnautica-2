/**
 * The treasury: what the city has, and what it charges.
 *
 * World state, like the roads and the zoning, because it is what the player
 * decided rather than what follows from it. The balance and four tax rates are
 * the whole of it; every figure on the budget panel -- income, upkeep, trade,
 * fares -- is worked out from the city each time by `agents/economy.ts` and is
 * never stored, for the same reason the buildings are not stored: a saved
 * derived number is a number that goes stale the moment anything under it moves.
 *
 * FOUR RATES, NOT ONE. Residential, commercial, industrial and office are taxed
 * separately because that is the lever the game is actually about. A city can
 * court industry with a low rate and tax the offices that follow; it can squeeze
 * housing and watch people leave. One rate would be one decision made once.
 *
 * AN OVERDRAFT, NOT A WALL. A city that simply cannot spend when it is broke has
 * no way out of a hole, because the way out of a hole is usually to build the
 * thing that fixes it. So there is a floor, it costs interest, and it is small
 * enough that living in it is not a strategy.
 */

/** The four rates, in the order the panel draws them. */
export const Tax = {
  RESIDENTIAL: 0,
  COMMERCIAL: 1,
  INDUSTRIAL: 2,
  OFFICE: 3,
} as const;
export const TAX_NAMES = ['residential', 'commercial', 'industrial', 'office'] as const;
export const TAXES = TAX_NAMES.length;

/**
 * The rate a city is judged against.
 *
 * At this, tax costs nothing in appeal and nobody is annoyed by it -- see
 * `agents/migration.ts`, which has been waiting for a real number here since it
 * was written. Below it a city is liked and poor; above it, funded and resented.
 */
export const TAX_NEUTRAL = 0.09;
export const TAX_MIN = 0.01;
export const TAX_MAX = 0.29;

/**
 * What a new city starts with.
 *
 * Enough for a few kilometres of street, the first zoning, and two of the three
 * services a town needs -- and not enough for all three. The first decision a
 * player makes has to be a decision.
 */
export const STARTING_FUNDS = 300000;

/** How far into the red the city may go before nothing more can be bought. */
export const OVERDRAFT = 60000;

export class Budget {
  balance = STARTING_FUNDS;
  /** One rate per `Tax`, as a fraction. */
  readonly rates = new Float64Array(TAXES).fill(TAX_NEUTRAL);
  /** Bumped when a rate changes, so the readouts know to recompute. */
  version = 0;

  /** Total spent and taken since founding, for the readout. */
  spent = 0;
  earned = 0;

  /**
   * The highest each rate may be set to. TAX_MAX unless an elected mandate
   * says otherwise -- see `politics.ts`.
   */
  readonly ceiling = new Float64Array(TAXES).fill(TAX_MAX);

  /** Caps one rate, pulling it down if it is over; Infinity lifts the cap. */
  cap(which: number, max: number): void {
    if (which < 0 || which >= TAXES) return;
    this.ceiling[which] = Math.max(TAX_MIN, Math.min(TAX_MAX, max));
    if (this.rates[which] > this.ceiling[which]) this.rates[which] = this.ceiling[which];
    this.version++;
  }

  setRate(which: number, rate: number): void {
    if (which < 0 || which >= TAXES) return;
    const want = Math.max(TAX_MIN, Math.min(this.ceiling[which], rate));
    if (Math.abs(want - this.rates[which]) < 1e-6) return;
    this.rates[which] = want;
    this.version++;
  }

  /** Whether the city could pay for something. */
  affords(cost: number): boolean {
    return this.balance - cost >= -OVERDRAFT;
  }

  /**
   * Pays for something, or refuses.
   *
   * Refusing is the point: a price nothing checks is a label. Everything the
   * player builds goes through here, and what comes back decides whether the
   * road gets laid.
   */
  spend(cost: number): boolean {
    if (cost <= 0) return true;
    if (!this.affords(cost)) return false;
    this.balance -= cost;
    this.spent += cost;
    return true;
  }

  /** Money in, from taxes, trade, fares or an event. */
  credit(amount: number): void {
    if (amount <= 0) return;
    this.balance += amount;
    this.earned += amount;
  }

  /** Money out that is not a purchase: upkeep, interest, a repair bill. */
  charge(amount: number): void {
    if (amount <= 0) return;
    this.balance -= amount;
    this.spent += amount;
  }

  /** The mean rate a resident feels, for the appeal and mood models. */
  get felt(): number {
    return (this.rates[Tax.RESIDENTIAL] * 2 + this.rates[Tax.COMMERCIAL]) / 3;
  }

  restore(balance: number, rates: readonly number[]): void {
    this.balance = Number.isFinite(balance) ? balance : STARTING_FUNDS;
    for (let i = 0; i < TAXES; i++) {
      const v = rates[i];
      this.rates[i] = typeof v === 'number' && Number.isFinite(v)
        ? Math.max(TAX_MIN, Math.min(TAX_MAX, v)) : TAX_NEUTRAL;
    }
    this.version++;
  }
}
