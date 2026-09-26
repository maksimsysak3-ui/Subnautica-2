/**
 * The city's books, month by month.
 *
 * The ledger says what a week costs *now*; it cannot say whether the city is
 * doing better than it was, or which line moved when the treasury started
 * falling. That is a record, not a rate: every settle banks what actually
 * changed hands, line by line, and when the calendar turns a month the totals
 * are closed off with a snapshot of the city beside them.
 *
 * Kept on the world, so it is saved with the city and a loaded game still has
 * its past.
 */

import { monthOf, yearOf } from './weather';
import type { Ledger } from './agents/economy';

export const INCOME_LINES = [
  'residential', 'commercial', 'industrial', 'office',
  'exports', 'resources', 'fares', 'grant',
] as const;
export const SPENDING_LINES = [
  'services', 'roads', 'transit', 'industryUpkeep', 'policies', 'imports', 'interest', 'loans',
] as const;
export type IncomeLine = typeof INCOME_LINES[number];
export type SpendingLine = typeof SPENDING_LINES[number];

export const LINE_LABEL: Record<IncomeLine | SpendingLine | 'congestion', string> = {
  residential: 'Residential tax', commercial: 'Commercial tax', industrial: 'Industrial tax',
  office: 'Office tax', exports: 'Export duty', resources: 'Natural resources',
  fares: 'Transit fares', grant: 'Regional grant',
  services: 'City services', roads: 'Road upkeep', transit: 'Transit running',
  industryUpkeep: 'Industry upkeep', policies: 'Policies', imports: 'Imported goods',
  interest: 'Overdraft interest', loans: 'Loan repayments', congestion: 'Lost to congestion',
};

/** A closed month. Money is what actually moved in it; the rest is at its close. */
export interface Month {
  month: number;
  year: number;
  income: number[];
  spending: number[];
  congestion: number;
  population: number;
  happiness: number;
  unemployment: number;
  balance: number;
  landValue: number;
  /** Mean traffic speed, km/h. */
  speed: number;
  goodsMade: number;
  goodsWanted: number;
}

/** What the city looks like at a month's close, beyond the ledger. */
export interface Vitals {
  population: number;
  happiness: number;
  unemployment: number;
  balance: number;
  speed: number;
}

/** How many months are kept: three years. */
const KEEP = 36;

export class CityHistory {
  readonly months: Month[] = [];
  /** The month being accumulated, and what it has banked so far. */
  private open = -1;
  private year = 0;
  private income = new Array<number>(INCOME_LINES.length).fill(0);
  private spending = new Array<number>(SPENDING_LINES.length).fill(0);
  private congestion = 0;
  /** Bumped whenever a month closes, so a panel knows to redraw. */
  version = 0;

  /**
   * Banks `days` of the ledger, and closes the month if the calendar has
   * turned since the last call.
   */
  accrue(r: Ledger, days: number, day: number, v: Vitals): void {
    const month = monthOf(day), year = yearOf(day);
    if (this.open < 0) { this.open = month; this.year = year; }
    if (month !== this.open) this.close(r, v, month, year);
    const share = days / 7;
    for (let i = 0; i < INCOME_LINES.length; i++) this.income[i] += r[INCOME_LINES[i]] * share;
    for (let i = 0; i < SPENDING_LINES.length; i++) this.spending[i] += r[SPENDING_LINES[i]] * share;
    this.congestion += r.congestion * share;
  }

  /** What the month in progress has banked so far, as a Month with its label. */
  current(r: Ledger, v: Vitals): Month {
    return this.snapshot(r, v, this.open < 0 ? 2 : this.open, this.year || 2027);
  }

  private close(r: Ledger, v: Vitals, next: number, nextYear: number): void {
    this.months.push(this.snapshot(r, v, this.open, this.year));
    while (this.months.length > KEEP) this.months.shift();
    this.open = next; this.year = nextYear;
    this.income.fill(0); this.spending.fill(0); this.congestion = 0;
    this.version++;
  }

  private snapshot(r: Ledger, v: Vitals, month: number, year: number): Month {
    return {
      month, year,
      income: this.income.map(round), spending: this.spending.map(round),
      congestion: round(this.congestion),
      population: v.population, happiness: v.happiness, unemployment: v.unemployment,
      balance: round(v.balance), landValue: r.landValue, speed: v.speed,
      goodsMade: round(r.goodsMade), goodsWanted: round(r.goodsWanted),
    };
  }

  saved(): object {
    return { months: this.months, open: this.open, year: this.year,
      income: this.income, spending: this.spending, congestion: this.congestion };
  }

  restore(raw: unknown): void {
    this.months.length = 0;
    const r = raw as Partial<ReturnType<CityHistory['saved']> & {
      months: Month[]; open: number; year: number; income: number[]; spending: number[]; congestion: number;
    }> | null;
    if (r === null || typeof r !== 'object') return;
    const nums = (a: unknown, n: number): number[] => {
      const out = new Array<number>(n).fill(0);
      if (Array.isArray(a)) for (let i = 0; i < n; i++) out[i] = Number(a[i]) || 0;
      return out;
    };
    if (Array.isArray(r.months)) {
      for (const m of r.months.slice(-KEEP)) {
        if (m === null || typeof m !== 'object') continue;
        this.months.push({
          month: Number(m.month) || 0, year: Number(m.year) || 2027,
          income: nums(m.income, INCOME_LINES.length), spending: nums(m.spending, SPENDING_LINES.length),
          congestion: Number(m.congestion) || 0, population: Number(m.population) || 0,
          happiness: Number(m.happiness) || 0, unemployment: Number(m.unemployment) || 0,
          balance: Number(m.balance) || 0, landValue: Number(m.landValue) || 1,
          speed: Number(m.speed) || 0, goodsMade: Number(m.goodsMade) || 0,
          goodsWanted: Number(m.goodsWanted) || 0,
        });
      }
    }
    this.open = Number.isFinite(r.open) ? Number(r.open) : -1;
    this.year = Number(r.year) || 0;
    this.income = nums(r.income, INCOME_LINES.length);
    this.spending = nums(r.spending, SPENDING_LINES.length);
    this.congestion = Number(r.congestion) || 0;
    this.version++;
  }
}

const round = (x: number): number => Math.round(x);
