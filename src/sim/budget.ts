import { CURRENCY } from './difficulty';
import { BRANCHES } from '../assets/types';
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

/** How far a service's funding may be cut or raised. */
export const FUNDING_MIN = 0.5;
export const FUNDING_MAX = 1.5;

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
export const OVERDRAFT = 60000 * CURRENCY;

/**
 * A loan from the regional bank: borrowed once, paid back weekly on a fixed
 * schedule, with the interest in the payment.
 *
 * The overdraft is for a bad month; a loan is for a plan. A city that wants a
 * university before its taxes can pay for one can borrow for it and carry the
 * repayments for two years -- which is a real decision, because a city that
 * borrows against growth that never comes is paying for a building it cannot
 * staff.
 */
export interface Loan {
  /** Which offer it was taken on, for its name. */
  kind: number;
  /** What is still owed, before interest. */
  owed: number;
  /** The fixed weekly payment. */
  payment: number;
  /** Weekly interest rate. */
  rate: number;
  weeksLeft: number;
}

export interface LoanOffer { name: string; amount: number; weeks: number; annual: number }

/** What the bank will lend, designed small and scaled like every other price. */
export const LOAN_OFFERS: readonly LoanOffer[] = [
  { name: 'Short-term note', amount: 125000 * CURRENCY, weeks: 26, annual: 0.05 },
  { name: 'Municipal bond', amount: 500000 * CURRENCY, weeks: 52, annual: 0.065 },
  { name: 'Infrastructure bond', amount: 1250000 * CURRENCY, weeks: 104, annual: 0.08 },
];
/** How many loans a city may carry at once. */
export const MAX_LOANS = 3;

/** The level weekly payment that clears `amount` over `weeks` at a weekly `rate`. */
export function loanPayment(amount: number, rate: number, weeks: number): number {
  return rate === 0 ? amount / weeks : (amount * rate) / (1 - Math.pow(1 + rate, -weeks));
}

export class Budget {
  /** Loans outstanding. */
  loans: Loan[] = [];
  balance = STARTING_FUNDS;
  /** One rate per `Tax`, as a fraction. */
  readonly rates = new Float64Array(TAXES).fill(TAX_NEUTRAL);

  /**
   * How well each service branch is funded, 0.5 to 1.5, indexed as BRANCHES.
   *
   * The lever a player pulls when the money is short or a service is not
   * keeping up: under-fund the parks to pay for the fire service, over-fund
   * the police to cover the city without another station. It scales what the
   * branch costs, and what it does -- reach, capacity, crews, plant output --
   * less than proportionally, so cutting is a real saving with a real cost.
   */
  readonly funding = new Float64Array(BRANCHES.length).fill(1);

  setFunding(branch: number, v: number): void {
    if (branch < 0 || branch >= this.funding.length || !Number.isFinite(v)) return;
    this.funding[branch] = Math.round(Math.max(FUNDING_MIN, Math.min(FUNDING_MAX, v)) * 20) / 20;
    this.version++;
  }

  saveFunding(): number[] | undefined {
    return this.funding.some((v) => v !== 1) ? [...this.funding] : undefined;
  }

  restoreFunding(raw: unknown): void {
    this.funding.fill(1);
    if (!Array.isArray(raw)) return;
    raw.forEach((v, i) => { if (typeof v === 'number') this.setFunding(i, v); });
  }
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

  /** Takes out a loan on an offer. False if the city is at its limit. */
  borrow(kind: number): boolean {
    const o = LOAN_OFFERS[kind];
    if (o === undefined || this.loans.length >= MAX_LOANS) return false;
    const rate = o.annual / 52;
    this.loans.push({ kind, owed: o.amount, payment: loanPayment(o.amount, rate, o.weeks), rate, weeksLeft: o.weeks });
    this.balance += o.amount;
    this.version++;
    return true;
  }

  /** Pays a loan off early, in full. False if the treasury cannot cover it. */
  repay(index: number): boolean {
    const l = this.loans[index];
    if (l === undefined || this.balance < l.owed) return false;
    this.balance -= l.owed;
    this.spent += l.owed;
    this.loans.splice(index, 1);
    this.version++;
    return true;
  }

  /** What the loans take each week, all together. */
  get loanWeekly(): number {
    let w = 0;
    for (const l of this.loans) w += l.payment;
    return w;
  }

  /**
   * Runs the loans forward by part of a week: the payment has already been
   * charged with the rest of the spending, so this only moves the schedule --
   * interest accrues on what is owed, the payment pays it and some principal.
   */
  amortise(weeks: number): void {
    if (this.loans.length === 0 || weeks <= 0) return;
    for (const l of this.loans) {
      const interest = l.owed * l.rate * weeks;
      l.owed = Math.max(0, l.owed + interest - l.payment * weeks);
      l.weeksLeft -= weeks;
    }
    const before = this.loans.length;
    this.loans = this.loans.filter((l) => l.weeksLeft > 1e-3 && l.owed > 1);
    if (this.loans.length !== before) this.version++;
  }

  /** The mean rate a resident feels, for the appeal and mood models. */
  get felt(): number {
    return (this.rates[Tax.RESIDENTIAL] * 2 + this.rates[Tax.COMMERCIAL]) / 3;
  }

  /** The loans as a save carries them. */
  saveLoans(): number[][] {
    return this.loans.map((l) => [l.kind, l.owed, l.payment, l.rate, l.weeksLeft]);
  }

  restoreLoans(raw: unknown): void {
    this.loans = [];
    if (!Array.isArray(raw)) return;
    for (const r of raw.slice(0, MAX_LOANS)) {
      if (!Array.isArray(r) || r.length < 5 || !r.every((v) => typeof v === 'number' && Number.isFinite(v))) continue;
      const [kind, owed, payment, rate, weeksLeft] = r as number[];
      if (LOAN_OFFERS[kind] === undefined || owed <= 0 || weeksLeft <= 0) continue;
      this.loans.push({ kind, owed, payment, rate, weeksLeft });
    }
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
