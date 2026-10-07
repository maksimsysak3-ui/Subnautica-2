// Salary cap and contracts under the CBA's main rules: signing bonuses prorated
// over at most five years, guarantees, dead money on release (pre- or post-June 1),
// restructures, the rookie wage scale with fifth-year options, franchise tags and
// minimum salaries by experience.
import type { Contract, ContractYear, League, Player, Pos } from './types';
import { clamp } from './rng';

export const CAP_2026 = 301_200_000;
export const MAX_PRORATION = 5;

export function capFor(league: League, season: number): number {
  return league.cap[season] ?? Math.round(CAP_2026 * Math.pow(1.065, season - 2026) / 100_000) * 100_000;
}

/** League minimum by accrued seasons, scaled with the cap. */
export function minSalary(exp: number, season: number): number {
  const base = [885_000, 1_005_000, 1_075_000, 1_145_000, 1_255_000, 1_255_000, 1_255_000][Math.min(6, exp)] ?? 1_330_000;
  const v = exp >= 7 ? 1_330_000 : base;
  return Math.round(v * Math.pow(1.04, season - 2026) / 5_000) * 5_000;
}

export const capHit = (c: Contract, season: number) => {
  const y = c.years.find(y => y.s === season);
  return y ? y.base + y.bonus : 0;
};
export const yearsLeft = (c: Contract, season: number) => c.years.filter(y => y.s >= season && !y.v).length;
export const apy = (c: Contract) => { const real = c.years.filter(y => !y.v); return real.length ? c.years.reduce((a, y) => a + y.base + y.bonus, 0) / real.length : 0; };
export const totalValue = (c: Contract) => c.years.reduce((a, y) => a + y.base + y.bonus, 0);
export const guaranteedLeft = (c: Contract, season: number) => c.years.filter(y => y.s >= season).reduce((a, y) => a + y.gtd + y.bonus, 0);

/**
 * Build a contract. `gtdPct` of total value is guaranteed; part of that is paid
 * as a signing bonus and prorated, the rest guarantees the early base salaries.
 * Base salaries rise each year, the way most real deals are structured.
 */
export function makeContract(start: number, years: number, totalAPY: number, gtdPct: number, opts: { bonusShare?: number; rookie?: boolean; option?: boolean; exp?: number; voids?: number } = {}): Contract {
  years = clamp(Math.round(years), 1, 6);
  const total = totalAPY * years;
  const gtd = total * clamp(gtdPct, 0, 1);
  const bonus = Math.round(gtd * clamp(opts.bonusShare ?? 0.5, 0, 1));
  // Void years stretch the bonus proration (max five years) past the real end of the deal.
  const voids = clamp(Math.round(opts.voids ?? 0), 0, Math.max(0, MAX_PRORATION - years));
  const proYears = Math.min(years + voids, MAX_PRORATION);
  const perYearBonus = bonus / proYears;
  const baseTotal = total - bonus;
  const rise = 1.07;
  let norm = 0;
  for (let i = 0; i < years; i++) norm += Math.pow(rise, i);
  const min = minSalary(opts.exp ?? 4, start);
  let gtdBaseLeft = gtd - bonus;
  const ys: ContractYear[] = [];
  for (let i = 0; i < years; i++) {
    const base = Math.max(min, Math.round((baseTotal * Math.pow(rise, i)) / norm / 5_000) * 5_000);
    const g = Math.max(0, Math.min(base, gtdBaseLeft));
    gtdBaseLeft -= g;
    ys.push({ s: start + i, base, bonus: i < proYears ? Math.round(perYearBonus) : 0, gtd: Math.round(g) });
  }
  for (let i = years; i < years + voids; i++) ys.push({ s: start + i, base: 0, bonus: Math.round(perYearBonus), gtd: 0, v: true });
  return { years: ys, rookie: opts.rookie, option: opts.option };
}

/** Dead money if released now. Post-June 1 splits proration over this season and the next. */
export function deadMoney(c: Contract, season: number, postJune1 = false): { now: number; next: number } {
  const rest = c.years.filter(y => y.s >= season);
  const proration = rest.reduce((a, y) => a + y.bonus, 0);
  const gtd = rest.reduce((a, y) => a + y.gtd, 0);
  if (!postJune1) return { now: proration + gtd, next: 0 };
  const thisYear = rest.find(y => y.s === season);
  return { now: (thisYear?.bonus ?? 0) + gtd, next: proration - (thisYear?.bonus ?? 0) };
}

/** Cap space freed (or lost, if negative) by releasing a player now. */
export function releaseSavings(c: Contract, season: number, postJune1 = false) {
  return capHit(c, season) - deadMoney(c, season, postJune1).now;
}

/**
 * Restructure: convert this year's base salary above the minimum into a signing
 * bonus prorated over five years, adding void years past the real end of the deal
 * where needed (as teams do). Saves cap now; what is left on void years becomes
 * dead money when the contract voids.
 */
export function restructure(p: Player, season: number, maxVoid = 3): number {
  const c = p.contract;
  const y = c.years.find(y => y.s === season);
  if (!y || y.v) return 0;
  const min = minSalary(p.exp, season);
  const convert = y.base - min;
  if (convert <= 0) return 0;
  let rest = c.years.filter(v => v.s >= season);
  const last = Math.max(...c.years.map(v => v.s));
  for (let s = last + 1; rest.length < MAX_PRORATION && s <= last + maxVoid; s++) { const vy = { s, base: 0, bonus: 0, gtd: 0, v: true }; c.years.push(vy); rest = [...rest, vy]; }
  rest = rest.slice(0, MAX_PRORATION);
  if (rest.length < 2) return 0;
  const per = Math.round(convert / rest.length);
  y.base = min;
  y.gtd = Math.min(y.gtd, min);
  for (const r of rest) r.bonus += per;
  return convert - per;
}
/** Proration left on void years once the real contract is over (accelerates as dead money). */
export function voidedProration(c: Contract, season: number) {
  return c.years.filter(y => y.v && y.s >= season).reduce((a, y) => a + y.bonus, 0);
}

// ---- market values -------------------------------------------------------------------
// Top-of-market APY at each position for the 2026 cap, from the real market.
const TOP_APY: Record<Pos, number> = {
  QB: 60_000_000, WR: 40_000_000, EDGE: 41_000_000, DT: 34_000_000, OT: 30_000_000, CB: 30_500_000,
  S: 21_500_000, LB: 21_000_000, TE: 20_500_000, RB: 20_500_000, G: 23_000_000, C: 18_500_000,
  K: 6_800_000, P: 4_300_000, FB: 4_800_000, LS: 1_700_000,
};
/** What a player would command on the open market. */
export function marketValue(p: Player, season: number): number {
  const top = TOP_APY[p.pos] * (CAP_FACTOR(season));
  const min = minSalary(p.exp, season);
  // S-curve in overall, as the real market pays: the elite near the top of market
  // (92 ≈ 83%), good starters mid-market (85 ≈ 55%, 80 ≈ 31%), depth near the minimum.
  const x = 1 / (1 + Math.exp(-(p.ovr - 84) / 5));
  let v = min + (top - min) * Math.min(1.05, x * 1.06);
  const age = p.age;
  const peakEnd = p.pos === 'QB' ? 35 : p.pos === 'RB' ? 27 : ['K', 'P', 'LS'].includes(p.pos) ? 36 : 29;
  if (age > peakEnd) v *= Math.max(0.35, 1 - (age - peakEnd) * (p.pos === 'QB' ? 0.1 : 0.12));
  if (age < 25 && p.pot > p.ovr + 4) v *= 1.08;
  return Math.max(min, Math.round(v / 10_000) * 10_000);
}
const CAP_FACTOR = (season: number) => Math.pow(1.065, season - 2026);

/** Typical length and guarantee share for a deal of a given size. */
export function marketTerms(p: Player, season: number) {
  const v = marketValue(p, season);
  const share = v / (TOP_APY[p.pos] * CAP_FACTOR(season));
  const years = p.age >= 32 ? 1 : p.age >= 30 ? 2 : share > 0.6 ? 4 + (p.age <= 27 ? 1 : 0) : share > 0.25 ? 3 : 2;
  const gtd = clamp(0.12 + share * 0.55, 0.05, 0.7);
  return { apy: v, years, gtd };
}

/** Rookie wage scale (2026 dollars): #1 ≈ $12.4M APY down to ≈ $1.05M late. */
export function rookieContract(pick: number, season: number): Contract {
  const f = CAP_FACTOR(season);
  const a = (0.95e6 + 8.2e6 * Math.exp(-(pick - 1) / 8) + 3.3e6 * Math.exp(-(pick - 1) / 40)) * f;
  const bonusShare = pick <= 32 ? 0.62 : pick <= 64 ? 0.35 : pick <= 100 ? 0.2 : 0.08;
  const gtd = pick <= 16 ? 1 : pick <= 32 ? 0.85 : pick <= 64 ? 0.4 : pick <= 100 ? 0.22 : 0.08;
  return makeContract(season, 4, a, gtd, { bonusShare: bonusShare / gtd, rookie: true, option: pick <= 32, exp: 0 });
}

/** Franchise tag: mean of the five largest cap hits at the position (or 120% of last salary). */
export function franchiseTag(league: League, p: Player, season: number): number {
  const hits = Object.values(league.players).filter(q => q.pos === p.pos && q.team !== 'FA' && q.status !== 'RET')
    .map(q => capHit(q.contract, season - 1)).sort((a, b) => b - a).slice(0, 5);
  const avg = hits.reduce((a, b) => a + b, 0) / Math.max(1, hits.length);
  return Math.round(Math.max(avg, capHit(p.contract, season - 1) * 1.2));
}

export function fifthYearOption(league: League, p: Player, season: number): number {
  const hits = Object.values(league.players).filter(q => q.pos === p.pos && q.team !== 'FA').map(q => capHit(q.contract, season)).sort((a, b) => b - a);
  const idx = p.ovr >= 88 ? 4 : p.ovr >= 80 ? 10 : 20;
  return hits[Math.min(hits.length - 1, idx)] ?? minSalary(p.exp, season) * 4;
}

// ---- team cap sheet ------------------------------------------------------------------
export function teamPayroll(league: League, team: string, season: number): number {
  let sum = league.teams[team]?.dead[season] ?? 0;
  for (const p of Object.values(league.players)) if (p.team === team && p.status !== 'RET') sum += capHit(p.contract, season);
  return sum;
}
export function capSpace(league: League, team: string, season = league.season): number {
  const t = league.teams[team];
  return capFor(league, season) + (season === league.season ? t.rollover : 0) - teamPayroll(league, team, season);
}

export const money = (v: number) => {
  const a = Math.abs(v);
  const s = a >= 1e6 ? `$${(a / 1e6).toFixed(a >= 1e7 ? 1 : 2)}M` : `$${Math.round(a / 1e3)}K`;
  return v < 0 ? `-${s}` : s;
};
