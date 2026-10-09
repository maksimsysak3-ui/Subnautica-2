// The offseason: retirements and the Hall of Fame, aging and progression (with
// breakouts and busts, and growth that follows how a player actually produced),
// expiring contracts and re-signing, franchise tags, free agency, the draft,
// training camp, cutdowns, the coaching carousel and next year's schedule.
import type { Game, League, Player, Pos } from './types';
import { Rng, clamp, hash } from './rng';
import { OVR_W, overall, archetype, assignAbilities } from './ratings';
import { autoDepth, activateHealthy, emptyLine, makeCoach, rosterOf, floorStarters } from './league';
import { capFor, capHit, capSpace, deadMoney, franchiseTag, makeContract, marketTerms, minSalary, releaseSavings, restructure, voidedProration, yearsLeft } from './contracts';
import { playerTradeValue, aiOffseasonTrades } from './trade';
import { freeAgents } from './freeagency';
import { freeNumber } from './draft';
import { generateClass, startDraft, ensureFuture } from './draft';
import { news, mail, standings, REG_WEEKS, divisionOrder } from './season';
import { runFreeAgencyDay, openFreeAgency } from './freeagency';
import { COACH_FIRST, COACH_LAST, poachHeadCoach, staffOffseason } from './staff';

/** Peak window per position: growth before, plateau inside, decline after. */
export const PEAK: Record<Pos, [number, number]> = {
  // Growth until the first age, plateau through the second, decline from 32 on.
  QB: [27, 31], RB: [24, 31], FB: [25, 31], WR: [24, 31], TE: [25, 31], OT: [25, 31], G: [25, 31], C: [25, 31],
  EDGE: [24, 31], DT: [25, 31], LB: [24, 31], CB: [23, 31], S: [24, 31], K: [26, 35], P: [26, 36], LS: [25, 36],
};
const PHYSICAL = ['SPD', 'ACC', 'AGI', 'JMP', 'STA'] as const;

export function startOffseason(league: League) {
  const rng = new Rng(hash(`off-${league.seed}-${league.season}`));
  const prev = league.season;
  retirements(league, rng, prev);
  progression(league, rng, prev);
  coachingCarousel(league, rng, prev);
  // New league year.
  league.season = prev + 1;
  league.cap[league.season] = capFor(league, league.season);
  for (const t of Object.values(league.teams)) {
    t.rollover = Math.max(0, Math.min(30_000_000, capFor(league, prev) - payrollAt(league, t.abbr, prev)));
    delete t.dead[prev - 1];
  }
  staffOffseason(league, rng);
  league.week = 0;
  league.phase = 'resign';
  // Picks and draft classes through 2032 (and always a few years ahead).
  league.picks = league.picks.filter(k => k.season >= league.season);
  ensureFuture(league);
  league.scoutPoints += 300;
  if (!Object.values(league.players).some(p => p.status === 'PROSPECT' && p.draft.year === league.season)) for (const p of generateClass(league, league.season)) league.players[p.id] = p;
  for (const p of Object.values(league.players)) { p.cond = 100; if (p.injury && !p.injury.season) p.injury = undefined; else if (p.injury) p.injury.weeks = Math.max(0, p.injury.weeks - 20); if (p.injury && p.injury.weeks <= 0) p.injury = undefined; }
  activateHealthy(league); // healed over the offseason: off injured reserve
  for (const t of Object.keys(league.teams)) if (t !== league.user) aiCapManagement(league, t, 12_000_000);
  aiResign(league, rng);
  const expiring = expiringFor(league, league.user);
  mail(league, 'Front Office', 'The offseason has begun', `${expiring.length} of your players have expiring contracts. Re-sign the ones you want before free agency opens, or use the franchise tag on one.`);
}
function payrollAt(league: League, team: string, season: number) {
  let s = league.teams[team].dead[season] ?? 0;
  for (const p of Object.values(league.players)) if (p.team === team) s += p.contract.years.find(y => y.s === season)?.base ?? 0, s += p.contract.years.find(y => y.s === season)?.bonus ?? 0;
  return s;
}

// ---- retirement and the Hall of Fame -----------------------------------------------------
function retirements(league: League, rng: Rng, season: number) {
  for (const p of Object.values(league.players)) {
    if (p.status === 'RET' || p.status === 'PROSPECT') continue;
    const [, end] = PEAK[p.pos];
    const over = p.age - end;
    let chance = over <= 0 ? 0.004 : 0.08 + over * 0.11;
    if (p.ovr < 60 && p.age >= 29) chance += 0.25;
    if (p.ovr >= 85) chance *= 0.45;
    if (p.team === 'FA' && p.age >= 30) chance += 0.3;
    if (!rng.chance(clamp(chance, 0, 0.95))) continue;
    p.status = 'RET'; p.retiredSeason = season;
    const wasTeam = p.team;
    p.team = 'RET'; p.contract = { years: [] };
    if (p.ovr >= 82 || p.awards.length >= 2) news(league, 'league', `${p.pos} ${p.fn} ${p.ln} has announced his retirement after ${p.exp} seasons.`, [wasTeam], { pid: p.id });
    if (hofScore(p) >= 100) { p.hof = true; p.awards.push(`Hall of Fame (class of ${season + 5})`); news(league, 'award', `${p.fn} ${p.ln} is a future Hall of Famer.`, [wasTeam], { pid: p.id, big: true }); }
  }
}
export function hofScore(p: Player) {
  const career = Object.values(p.stats);
  const sum = (k: keyof ReturnType<typeof emptyLine>) => career.reduce((a, l) => a + (l[k] ?? 0), 0);
  const awards = p.awards.filter(a => /MVP|Player of the Year/.test(a)).length * 18 + p.awards.filter(a => /All-Pro/.test(a)).length * 9 + p.awards.filter(a => /Super Bowl MVP/.test(a)).length * 10;
  const prod = sum('py') / 1000 + sum('ptd') * 0.4 + (sum('ry') + sum('recy')) / 300 + (sum('rtd') + sum('rectd')) * 0.7 + sum('dsk') * 0.9 + sum('dint') * 1.6;
  return awards + prod + Math.max(0, p.ovr - 85) * 2;
}

// ---- progression -------------------------------------------------------------------------
/**
 * Yearly change = age curve toward (or away from) potential, plus what the season
 * showed: players who out-produce their rating grow, those who under-produce slip.
 * A few young players break out, a few regress hard (busts), veterans fall off.
 */
export const STARTERS_PER_TEAM: Record<Pos, number> = { QB: 1, RB: 1, FB: 1, WR: 3, TE: 1, OT: 2, G: 2, C: 1, EDGE: 2, DT: 2, LB: 2, CB: 3, S: 2, K: 1, P: 1, LS: 1 };
/** Sorted OVRs of the best (starters x 64) players at each position: the scale's shape. */
export function starterMeans(league: League) {
  const out: Partial<Record<Pos, number[]>> = {};
  for (const pos of Object.keys(STARTERS_PER_TEAM) as Pos[]) {
    const n = STARTERS_PER_TEAM[pos] * 64;
    out[pos] = Object.values(league.players).filter(p => p.pos === pos && p.status !== 'RET' && p.status !== 'PROSPECT').map(p => p.ovr).sort((a, b) => b - a).slice(0, n);
  }
  return out;
}
/**
 * Hold each position's distribution to its baseline by quantile: the Nth-best
 * player is pulled most of the way toward the Nth-best baseline rating. Who holds
 * each rank still moves with progression; the scale itself does not drift.
 */
function normalizeScale(league: League, rng: Rng, start: Map<string, number>) {
  const base = league.baseline;
  if (!base) return;
  for (const pos of Object.keys(base) as Pos[]) {
    const target = base[pos]!;
    const ps = Object.values(league.players).filter(p => p.pos === pos && p.status !== 'RET' && p.status !== 'PROSPECT').sort((a, b) => b.ovr - a.ovr);
    ps.forEach((p, i) => {
      const t = target[Math.min(i, target.length - 1)];
      let shift = i < target.length ? Math.round((t - p.ovr) * 0.75) : Math.min(0, Math.round((t - p.ovr) * 0.5));
      // Respect the five-point yearly cap including this adjustment.
      const s0 = start.get(p.id) ?? p.ovr;
      shift = clamp(shift, s0 - 5 - p.ovr, s0 + 5 - p.ovr);
      if (!shift) return;
      const before = p.ovr;
      applyDelta(p, shift, rng);
      p.ovr = overall(p.pos, p.attrs);
      p.pot = clamp(p.pot + (p.ovr - before), p.ovr, 99);
    });
  }
}

function progression(league: League, rng: Rng, season: number) {
  const prodByPos = expectedProduction(league, season);
  const start = new Map(Object.values(league.players).map(p => [p.id, p.ovr]));
  for (const p of Object.values(league.players)) {
    if (p.status === 'RET' || p.status === 'PROSPECT') continue;
    p.age += 1; p.exp += 1;
    const before = p.ovr;
    const [start, end] = PEAK[p.pos];
    const devM = { Normal: 0.7, Star: 1, Superstar: 1.3, 'X-Factor': 1.45 }[p.dev];
    const work = 0.75 + p.traits.work / 200;
    let delta = 0;
    let label = '';
    if (p.age < start) delta = Math.max(0, (p.pot - p.ovr)) * 0.3 * devM * work + rng.normal(0, 1.6);
    else if (p.age <= end) delta = Math.max(0, p.pot - p.ovr) * 0.16 * devM + rng.normal(-0.2, 1.4);
    else delta = -(0.9 + (p.age - end) * 0.85) * (p.pos === 'QB' || p.pos === 'K' || p.pos === 'P' ? 0.6 : 1) + rng.normal(0, 1.5) - (p.traits.work < 40 ? 0.6 : 0);
    // Output vs expectation for his rating (Madden's in-season rating updates, yearly).
    const perf = performanceIndex(p, season, prodByPos);
    if (perf !== null) delta += clamp(perf * 3.2, -3, 3.5);
    // Breakouts and busts.
    if (p.age <= 27 && p.pot - p.ovr >= 4 && rng.chance(0.07 + (perf !== null && perf > 0.4 ? 0.08 : 0))) { delta += rng.int(3, 5); label = 'breakout'; }
    else if (rng.chance(p.age <= 25 ? 0.035 : 0.025)) { delta -= rng.int(2, 4); label = 'regression'; }
    // No one moves more than five points in an offseason.
    applyDelta(p, clamp(Math.round(delta), -5, 5), rng);
    // Athleticism fades with age regardless of skill.
    if (p.age > end - 1) for (const k of PHYSICAL) p.attrs[k] = clamp(p.attrs[k] - rng.int(0, 2) - (p.age > end + 2 ? 1 : 0), 20, 99);
    if (p.age <= start) for (const k of PHYSICAL) if (rng.chance(0.3)) p.attrs[k] = clamp(p.attrs[k] + 1, 20, 99);
    p.ovr = overall(p.pos, p.attrs);
    // Potential shifts with what has happened; it never sits below current.
    if (label === 'breakout') p.pot = Math.max(p.pot, p.ovr + (p.age <= 24 ? 4 : 2));
    if (label === 'regression') p.pot = Math.max(p.ovr, p.pot - rng.int(2, 6));
    if (p.age > end) p.pot = Math.max(p.ovr, Math.min(p.pot, p.ovr + 1));
    p.pot = Math.max(p.pot, p.ovr);
    p.arch = archetype(p.pos, p.attrs);
    if (p.ovr >= 86 && (p.dev === 'Normal' || p.dev === 'Star') && rng.chance(0.3)) { p.dev = p.dev === 'Normal' ? 'Star' : 'Superstar'; Object.assign(p, assignAbilities(p.pos, p.attrs, p.dev, rng)); }
    else if (p.age > end + 1 && p.dev !== 'Normal' && rng.chance(0.25)) { p.dev = p.dev === 'X-Factor' ? 'Superstar' : p.dev === 'Superstar' ? 'Star' : 'Normal'; Object.assign(p, assignAbilities(p.pos, p.attrs, p.dev, rng)); }
    const change = p.ovr - before;
    if (label && p.ovr >= 70 && p.team !== 'FA') news(league, 'milestone', label === 'breakout' ? `BREAKOUT: ${p.team} ${p.pos} ${p.fn} ${p.ln} jumped from ${before} to ${p.ovr} OVR this offseason.` : `${p.team} ${p.pos} ${p.fn} ${p.ln} regressed from ${before} to ${p.ovr} OVR.`, [p.team], { pid: p.id });
    if (p.team === league.user && Math.abs(change) >= 3 && !label) mail(league, 'Player Development', `${p.ln}: ${change > 0 ? '+' : ''}${change} OVR`, `${p.fn} ${p.ln} is now ${p.ovr} OVR (${p.age} years old).`);
    p.xp = 0; p.morale = clamp(p.morale + rng.int(-5, 5), 20, 100);
  }
  normalizeScale(league, rng, start);
}
/** Distribute an overall change across the position's weighted skill attributes. */
export function applyDelta(p: Player, delta: number, rng: Rng) {
  if (!delta) return;
  const w = OVR_W[p.pos];
  const keys = (Object.keys(w) as (keyof typeof w)[]).filter(k => !(PHYSICAL as readonly string[]).includes(k));
  let guard = 0;
  const target = clamp(p.ovr + delta, 30, 99);
  while (overall(p.pos, p.attrs) !== target && guard++ < 200) {
    const k = rng.weighted(keys.map(k => [k, w[k] ?? 1] as const));
    p.attrs[k] = clamp(p.attrs[k] + Math.sign(target - overall(p.pos, p.attrs)) * rng.int(1, 2), 15, 99);
  }
}
/** Mean production per OVR point at each position, from the season just played. */
function expectedProduction(league: League, season: number) {
  const by: Record<string, { x: number; y: number }[]> = {};
  for (const p of Object.values(league.players)) {
    const l = p.stats[season];
    if (!l || l.gp < 6) continue;
    (by[p.pos] ??= []).push({ x: p.ovr, y: production(p.pos, l) / l.gp });
  }
  const fit: Record<string, [number, number, number]> = {};
  for (const [pos, pts] of Object.entries(by)) {
    const n = pts.length, mx = pts.reduce((a, b) => a + b.x, 0) / n, my = pts.reduce((a, b) => a + b.y, 0) / n;
    const sxy = pts.reduce((a, b) => a + (b.x - mx) * (b.y - my), 0), sxx = pts.reduce((a, b) => a + (b.x - mx) ** 2, 0) || 1;
    const slope = sxy / sxx;
    const resid = Math.sqrt(pts.reduce((a, b) => a + (b.y - (my + slope * (b.x - mx))) ** 2, 0) / n) || 1;
    fit[pos] = [mx, my, slope / resid] as [number, number, number];
    (fit[pos] as unknown as { r: number }).r = resid;
  }
  return fit;
}
function production(pos: Pos, l: ReturnType<typeof emptyLine>) {
  switch (pos) {
    case 'QB': return l.py * 0.04 + l.ptd * 4 - l.pint * 3 + l.ry * 0.1 + l.rtd * 6 - l.sk * 0.5;
    case 'RB': case 'FB': return (l.ry + l.recy) * 0.1 + (l.rtd + l.rectd) * 6 - l.fuml * 2;
    case 'WR': case 'TE': return l.recy * 0.1 + l.rec * 0.5 + l.rectd * 6 - l.drop;
    case 'EDGE': case 'DT': return l.dsk * 4 + l.qbh + l.tfl * 1.5 + l.tkl * 0.4 + l.ff * 3;
    case 'LB': return l.tkl * 0.6 + l.tfl * 1.5 + l.dsk * 3 + l.dint * 5 + l.pd * 1.5;
    case 'CB': case 'S': return l.pd * 2 + l.dint * 5 + l.tkl * 0.3 + l.dtd * 6;
    case 'OT': case 'G': case 'C': return l.pancake * 1 - l.sacka * 3 + l.gs * 2;
    case 'K': return l.fgm * 3 - (l.fga - l.fgm) * 4 + l.xpm;
    default: return 0;
  }
}
/** Standardised residual of a player's per-game output against players of his rating. */
function performanceIndex(p: Player, season: number, fit: Record<string, [number, number, number]>): number | null {
  const l = p.stats[season];
  const f = fit[p.pos];
  if (!l || !f || l.gp < 6) return null;
  const [mx, my] = f;
  const resid = (f as unknown as { r: number }).r;
  const slope = f[2] * resid;
  const expect = my + slope * (p.ovr - mx);
  return clamp(((production(p.pos, l) / l.gp) - expect) / resid, -2, 2) * Math.min(1, l.gp / 14) * 0.5;
}

// ---- coaching carousel ---------------------------------------------------------------------
function coachingCarousel(league: League, rng: Rng, season: number) {
  const st = standings(league, season);
  for (const t of Object.values(league.teams)) {
    if (t.abbr === league.user) continue;
    const s = st[t.abbr];
    const hot = s.w <= 4 || (s.w <= 6 && rng.chance(0.4)) || (s.w <= 7 && t.coach.age >= 64 && rng.chance(0.3));
    if (!hot) { t.coach.age++; continue; }
    const old = t.coach.name;
    const promoted = poachHeadCoach(league, rng, t.abbr);
    t.coach = makeCoach(promoted?.name ?? `${rng.pick(COACH_FIRST)} ${rng.pick(COACH_LAST)}`, rng, promoted?.rating ?? Math.round(clamp(rng.normal(70, 7), 55, 88)));
    if (promoted?.off) t.coach.off = promoted.off;
    if (promoted?.def) t.coach.def = promoted.def;
    news(league, 'coach', `The ${t.nick} fired ${old} after a ${s.w}-${s.l} season and hired ${t.coach.name} (${t.coach.off} offense, ${t.coach.def} defense).`, [t.abbr]);
  }
}

// ---- contracts at the turn of the league year ------------------------------------------------
export const expiringFor = (league: League, team: string) =>
  Object.values(league.players).filter(p => p.team === team && p.status !== 'RET' && yearsLeft(p.contract, league.season) === 0);

/** What a player wants to re-sign (loyalty and his mood shade it). */
export function askingPrice(league: League, p: Player) {
  const t = marketTerms(p, league.season);
  const loyal = p.motiv.includes('Loyalty') ? 0.92 : 1;
  const mood = p.morale < 45 ? 1.12 : p.morale > 80 ? 0.96 : 1;
  const cap = league.coachTree.unlocked.includes('Cap Guru') && p.team === league.user ? 0.94 : 1;
  return { ...t, apy: Math.round(t.apy * loyal * mood * cap / 10_000) * 10_000 };
}
export interface Offer { apy: number; years: number; gtd: number; bonus?: number; voids?: number }
/** Will he sign? Offer vs ask on money, guarantees and years. Returns 0..1 interest. */
export function evaluateOffer(league: League, p: Player, offer: Offer, team: string) {
  return clamp((offerScore(league, p, offer, team) - 0.86) / 0.2, 0, 1);
}
/**
 * How good an offer looks to the player, about 1.0 at his asking price. Money per
 * year leads; guarantees, length and cash up front (signing bonus) shade it, then
 * whatever motivates him about the team.
 */
export function offerScore(league: League, p: Player, offer: Offer, team: string) {
  const ask = askingPrice(league, p);
  let score = offer.apy / ask.apy;
  score += (offer.gtd - ask.gtd) * 0.6;
  // Players want security when they are older, the long deal when they are young stars.
  const short = offer.years - ask.years;
  score -= Math.abs(short) * (short < 0 && p.age >= 29 ? 0.05 : 0.03);
  score += ((offer.bonus ?? 0.55) - 0.55) * offer.gtd * 0.08;
  if (p.motiv.includes('Loyalty') && p.team === team) score += 0.06;
  if (p.motiv.includes('Contender')) score += (contenderScore(league, team) - 0.5) * 0.12;
  if (p.motiv.includes('Big Market')) score += (league.teams[team].market - 2) * 0.03;
  if (p.motiv.includes('Warm Weather')) score += league.teams[team].warm ? 0.04 : -0.03;
  if (p.motiv.includes('Winning Culture')) score += (league.teams[team].tradition - 0.5) * 0.08;
  if (p.motiv.includes('Starting Role')) score += startingChance(league, p, team) * 0.08 - 0.04;
  if (p.motiv.includes('Scheme Fit')) score += schemeFit(league, p, team) * 0.06;
  return score;
}
export function contenderScore(league: League, team: string) {
  const last = league.history[league.history.length - 1]?.standings[team];
  return last ? clamp(last[0] / 13, 0, 1) : 0.5;
}
export function startingChance(league: League, p: Player, team: string) {
  const ahead = rosterOf(league, team).filter(q => q.pos === p.pos && q.ovr > p.ovr && q.id !== p.id).length;
  const starters = { QB: 1, RB: 1, FB: 1, WR: 3, TE: 1, OT: 2, G: 2, C: 1, EDGE: 2, DT: 2, LB: 2, CB: 3, S: 2, K: 1, P: 1, LS: 1 }[p.pos];
  return clamp(1 - ahead / starters, 0, 1);
}
export function schemeFit(league: League, p: Player, team: string) {
  const t = league.teams[team];
  const fits: Record<string, string[]> = {
    'Wide Zone': ['Elusive Back', 'Agile', 'Speed Rusher'], 'Power Run': ['Power Back', 'Power', 'Blocking'], 'Vertical': ['Deep Threat', 'Strong Arm', 'Vertical Threat'],
    'West Coast': ['Route Runner', 'Field General', 'Possession', 'Receiving Back'], 'Spread': ['Slot', 'Scrambler', 'Improviser', 'Receiving Back'],
    '4-3 Over': ['Speed Rusher', 'Run Stopper'], '3-4 Two-Gap': ['Power Rusher', 'Run Stopper'], 'Cover 3': ['Zone'], 'Two-High': ['Zone', 'Hybrid', 'Pass Coverage'], 'Blitz': ['Man to Man', 'Speed Rusher', 'Field General'],
  };
  return (fits[t.coach.off] ?? []).includes(p.arch) || (fits[t.coach.def] ?? []).includes(p.arch) ? 1 : 0;
}
export function signPlayer(league: League, p: Player, team: string, offer: Offer, opts: { extend?: boolean } = {}) {
  const c = makeContract(league.season, offer.years, offer.apy, offer.gtd, { exp: p.exp, bonusShare: offer.bonus ?? 0.55, voids: offer.voids });
  if (opts.extend) {
    // An extension keeps this season's deal and adds the new years after it. Proration
    // already on the books for later years stays there (it does not disappear).
    const keep = p.contract.years.filter(y => y.s === league.season && !y.v);
    for (const y of c.years) y.s += keep.length;
    for (const old of p.contract.years.filter(y => y.s > league.season && y.bonus > 0)) {
      const into = c.years.find(y => y.s === old.s);
      if (into) into.bonus += old.bonus; else c.years.push({ s: old.s, base: 0, bonus: old.bonus, gtd: 0, v: true });
    }
    p.contract = { years: [...keep, ...c.years].sort((a, b) => a.s - b.s) };
  } else p.contract = c;
  const moved = p.team !== team;
  p.team = team; p.status = 'ACT';
  if (moved) p.num = p.num || 0;
  p.morale = clamp(p.morale + 8, 0, 100);
}
export function applyTag(league: League, p: Player) {
  const amt = franchiseTag(league, p, league.season);
  p.contract = { years: [{ s: league.season, base: amt, bonus: 0, gtd: amt }], tag: true };
  p.morale = clamp(p.morale - 12, 0, 100);
  return amt;
}

/** AI teams keep the players worth keeping at a fair price, if they can afford them. */
function aiResign(league: League, rng: Rng) {
  for (const t of Object.keys(league.teams)) {
    if (t === league.user) continue;
    const exp = expiringFor(league, t).sort((a, b) => b.ovr - a.ovr);
    let tagged = false;
    for (const p of exp) {
      const ask = askingPrice(league, p);
      const space = capSpace(league, t);
      const keep = p.ovr >= 76 && p.age <= 30 || p.ovr >= 84 && p.age <= 33 || (p.ovr >= 70 && p.age <= 26 && rng.chance(0.6));
      if (!keep || ask.apy > space * 0.6) continue;
      if (!tagged && p.ovr >= 88 && rng.chance(0.25)) { applyTag(league, p); tagged = true; news(league, 'sign', `${league.teams[t].nick} placed the franchise tag on ${p.pos} ${p.fn} ${p.ln}.`, [t], { pid: p.id }); continue; }
      if (rng.chance(0.82)) {
        signPlayer(league, p, t, ask);
        if (p.ovr >= 82) news(league, 'sign', `${league.teams[t].nick} re-signed ${p.pos} ${p.fn} ${p.ln}: ${ask.years} years, $${(ask.apy * ask.years / 1e6).toFixed(1)}M.`, [t], { pid: p.id });
      }
    }
  }
}

// ---- phase transitions -------------------------------------------------------------------------
export function advanceOffseason(league: League) {
  const rng = new Rng(hash(`adv-${league.seed}-${league.season}-${league.phase}-${league.fa?.day ?? 0}`));
  if (league.phase === 'resign') {
    // Anyone not re-signed becomes a free agent.
    for (const p of Object.values(league.players)) if (p.team !== 'FA' && p.status !== 'RET' && p.status !== 'PROSPECT' && yearsLeft(p.contract, league.season) === 0) {
      const dead = voidedProration(p.contract, league.season);
      if (dead && league.teams[p.team]) league.teams[p.team].dead[league.season] = (league.teams[p.team].dead[league.season] ?? 0) + dead;
      p.team = 'FA'; p.status = 'FA'; p.contract = { years: [] };
    }
    openFreeAgency(league);
    league.phase = 'freeagency';
    return;
  }
  if (league.phase === 'freeagency') {
    if ([1, 4, 7].includes(league.fa?.day ?? 0)) aiOffseasonTrades(league, rng);
    runFreeAgencyDay(league, rng);
    if ((league.fa?.day ?? 0) > 8) startDraft(league);
    return;
  }
  if (league.phase === 'draft') {
    if (!league.draft?.done) return;
    league.phase = 'camp';
    trainingCamp(league, rng);
    return;
  }
  if (league.phase === 'camp') {
    cutdowns(league, rng);
    league.games = league.games.filter(g => g.season >= league.season - 1);
    league.games.push(...makeSchedule(league, rng));
    for (const t of Object.keys(league.teams)) autoDepth(league, t);
    floorStarters(league, rng);
    league.phase = 'preseason'; league.week = 1;
    seasonForm(league, rng);
    return;
  }
}

/** Camp: small gains for young, hard-working players; position battles settle. */
function trainingCamp(league: League, rng: Rng) {
  for (const p of Object.values(league.players)) {
    if (p.team === 'FA' || p.status === 'RET' || p.status === 'PROSPECT') continue;
    if (p.age <= 24 && rng.chance(0.1 + p.traits.work / 600)) { applyDelta(p, 1, rng); p.ovr = overall(p.pos, p.attrs); }
  }
  mail(league, 'Head Coach', 'Training camp is underway', 'Set your 53-man roster and depth chart. Cut down to 53 before the season opener.');
}

/**
 * Season form: some players are about to have the year of their lives, others a
 * dud. Hidden until it shows in the box score. Young players with room to grow
 * break out more; veterans past their peak are likelier to fall flat.
 */
export function seasonForm(league: League, rng: Rng) {
  for (const p of Object.values(league.players)) {
    if (p.status === 'RET' || p.status === 'PROSPECT') continue;
    const [, end] = PEAK[p.pos];
    let f = rng.normal(0, 1.2);
    if (p.age <= 26 && p.pot - p.ovr >= 3 && rng.chance(0.08)) f += rng.range(3.5, 6.5);
    else if (rng.chance(p.age > end ? 0.09 : 0.05)) f -= rng.range(3, 6);
    p.sform = Math.round(f * 10) / 10;
  }
}

/** AI teams cut to 53 (+16 practice squad); the user is reminded. */
/**
 * What real front offices do each March: restructure stars to free room, then
 * release the contracts that cost most for what they give (post-June 1 if it helps).
 */
export function aiCapManagement(league: League, team: string, buffer: number) {
  let guard = 0;
  while (capSpace(league, team) < buffer && guard++ < 40) {
    const roster = Object.values(league.players).filter(p => p.team === team && p.status !== 'RET');
    const star = roster.filter(p => p.ovr >= 82 && p.contract.years.filter(y => y.s >= league.season).length >= 2 && (p.contract.years.find(y => y.s === league.season)?.base ?? 0) > minSalary(p.exp, league.season) * 3)
      .sort((a, b) => capHit(b.contract, league.season) - capHit(a.contract, league.season))[0];
    if (star && restructure(star, league.season) > 1_000_000) continue;
    const cut = roster.filter(p => releaseSavings(p.contract, league.season, true) > 500_000 && !(p.pos === 'QB' && p.ovr >= 80))
      .sort((a, b) => playerTradeValue(league, a) / releaseSavings(a.contract, league.season, true) - playerTradeValue(league, b) / releaseSavings(b.contract, league.season, true))[0];
    if (!cut) break;
    const june = releaseSavings(cut.contract, league.season, true) > releaseSavings(cut.contract, league.season, false) * 1.2;
    if (cut.ovr >= 80) news(league, 'release', `The ${league.teams[team].nick} released ${cut.pos} ${cut.fn} ${cut.ln}${june ? ' (post-June 1)' : ''} to clear cap space.`, [team], { pid: cut.id });
    release(league, cut, june);
  }
}

/** Fill to 53 active and 16 practice squad with the best cheap free agents at need. */
export function fillRoster(league: League, team: string) {
  const want: Record<string, number> = { QB: 3, RB: 4, FB: 1, WR: 6, TE: 3, OT: 4, G: 4, C: 2, EDGE: 5, DT: 5, LB: 5, CB: 6, S: 4, K: 1, P: 1, LS: 1 };
  const count = (status: 'ACT' | 'PS') => Object.values(league.players).filter(p => p.team === team && p.status === status).length;
  let guard = 0;
  while (count('ACT') < 53 && guard++ < 60) {
    const roster = Object.values(league.players).filter(p => p.team === team && p.status === 'ACT');
    const short = Object.entries(want).map(([pos, n]) => [pos, n - roster.filter(p => p.pos === pos).length] as const).sort((a, b) => b[1] - a[1]);
    const pool = freeAgents(league).filter(p => !p.injury && p.age <= 34);
    const pos = short[0][1] > 0 ? short[0][0] : undefined;
    const pick = (pos ? pool.filter(p => p.pos === pos) : pool).sort((a, b) => b.ovr - a.ovr)[0] ?? pool.sort((a, b) => b.ovr - a.ovr)[0];
    if (!pick) break;
    const apy = Math.max(minSalary(pick.exp, league.season), Math.min(marketTerms(pick, league.season).apy * 0.6, capSpace(league, team) * 0.3));
    if (capSpace(league, team) < apy) {
      // A team cannot field fewer than 53: clear room the way real teams do, then fill at the minimum.
      aiCapManagement(league, team, minSalary(pick.exp, league.season) * (53 - count('ACT')) + 1_000_000);
      if (capSpace(league, team) < minSalary(pick.exp, league.season)) break;
      signPlayer(league, pick, team, { apy: minSalary(pick.exp, league.season), years: 1, gtd: 0 });
      pick.num = freeNumber(league, team, pick.pos);
      continue;
    }
    signPlayer(league, pick, team, { apy, years: 1, gtd: 0 });
    pick.num = freeNumber(league, team, pick.pos);
  }
  guard = 0;
  while (count('PS') < 16 && guard++ < 20) {
    const pick = freeAgents(league).filter(p => p.exp <= 3 && !p.injury).sort((a, b) => (b.ovr + b.pot) - (a.ovr + a.pot))[0];
    if (!pick || capSpace(league, team) < minSalary(0, league.season)) break;
    signPlayer(league, pick, team, { apy: minSalary(0, league.season) * 0.75, years: 1, gtd: 0 });
    pick.status = 'PS'; pick.num = freeNumber(league, team, pick.pos);
  }
}

function cutdowns(league: League, rng: Rng) {
  for (const t of Object.keys(league.teams)) {
    const roster = Object.values(league.players).filter(p => p.team === t && (p.status === 'ACT' || p.status === 'PS'));
    if (t === league.user) {
      const act = roster.filter(p => p.status === 'ACT').length;
      if (act > 53) mail(league, 'Head Coach', 'Roster cuts needed', `You have ${act} players on the active roster. The limit is 53; the lowest-rated will be moved off if you do not set it.`);
    }
    const keepValue = (p: Player) => p.ovr + (p.pot - p.ovr) * (p.age <= 24 ? 0.5 : 0.1) + (p.contract.years.find(y => y.s === league.season)?.gtd ? 6 : 0) + rng.normal(0, 1);
    const sorted = roster.sort((a, b) => keepValue(b) - keepValue(a));
    // Keep a sane spread of positions on the 53.
    const minPos: Partial<Record<Pos, number>> = { QB: 2, RB: 3, WR: 5, TE: 3, OT: 4, G: 3, C: 2, EDGE: 4, DT: 4, LB: 4, CB: 5, S: 4, K: 1, P: 1, LS: 1 };
    const active: Player[] = [];
    for (const [pos, n] of Object.entries(minPos)) active.push(...sorted.filter(p => p.pos === pos).slice(0, n));
    for (const p of sorted) if (active.length < 53 && !active.includes(p)) active.push(p);
    const ps: Player[] = [];
    for (const p of sorted) if (!active.includes(p) && ps.length < 16 && p.exp <= 3) ps.push(p);
    for (const p of roster) {
      if (active.includes(p)) p.status = 'ACT';
      else if (ps.includes(p)) { p.status = 'PS'; }
      else release(league, p, false);
    }
    if (t !== league.user) { aiCapManagement(league, t, 3_000_000); fillRoster(league, t); }
  }
}
export function release(league: League, p: Player, postJune1: boolean) {
  const dm = deadMoney(p.contract, league.season, postJune1);
  const t = league.teams[p.team];
  if (t) {
    t.dead[league.season] = (t.dead[league.season] ?? 0) + dm.now;
    if (dm.next) t.dead[league.season + 1] = (t.dead[league.season + 1] ?? 0) + dm.next;
  }
  p.team = 'FA'; p.status = 'FA'; p.contract = { years: [] };
}

// ---- schedule --------------------------------------------------------------------------------
/**
 * The NFL formula: 6 division games; 4 vs a rotating same-conference division;
 * 4 vs a rotating other-conference division; 2 same-place games vs the other two
 * conference divisions; a 17th vs the same-place team of a further inter-conference
 * division. Then packed into 18 weeks, one bye per team in weeks 5-14.
 */
export function makeSchedule(league: League, rng: Rng): Game[] {
  const season = league.season;
  const divs = ['East', 'North', 'South', 'West'];
  const prev = standings(league, season - 1);
  const place: Record<string, number> = {};
  for (const c of ['AFC', 'NFC']) for (const d of divs) divisionOrder(league, c, d, prev).forEach((a, i) => (place[a] = i));
  const teamsIn = (c: string, d: number) => Object.values(league.teams).filter(t => t.conf === c && t.div === divs[d]).map(t => t.abbr);
  const pairs: [string, string][] = [];
  const flip = (a: string, b: string) => (hash(a + b + season) % 2 ? [a, b] : [b, a]) as [string, string];
  const all4 = (A: string[], B: string[]) => { for (const a of A) for (const b of B) pairs.push(flip(a, b)); };
  const intra = [[[0, 1], [2, 3]], [[0, 2], [1, 3]], [[0, 3], [1, 2]]][season % 3];
  const inter = season % 4;
  for (const c of ['AFC', 'NFC']) {
    for (let d = 0; d < 4; d++) {
      const mine = teamsIn(c, d);
      for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) { pairs.push([mine[i], mine[j]]); pairs.push([mine[j], mine[i]]); }
    }
    for (const [x, y] of intra) all4(teamsIn(c, x), teamsIn(c, y));
    // Same place vs the two conference divisions not played in full.
    for (let d = 0; d < 4; d++) {
      const partner = intra.find(pr => pr.includes(d))!.find(x => x !== d)!;
      for (let e = d + 1; e < 4; e++) {
        if (e === partner) continue;
        for (const a of teamsIn(c, d)) { const b = teamsIn(c, e).find(t => place[t] === place[a]); if (b) pairs.push(flip(a, b)); }
      }
    }
  }
  for (let d = 0; d < 4; d++) {
    all4(teamsIn('AFC', d), teamsIn('NFC', (d + inter) % 4));
    // 17th game: same place, the inter-conference division two steps on.
    for (const a of teamsIn('AFC', d)) { const b = teamsIn('NFC', (d + inter + 2) % 4).find(t => place[t] === place[a]); if (b) pairs.push(flip(a, b)); }
  }
  return packWeeks(pairs, league, rng);
}

function packWeeks(pairs: [string, string][], league: League, rng: Rng): Game[] {
  const season = league.season;
  const teams = Object.keys(league.teams);
  for (let attempt = 0; attempt < 400; attempt++) {
    // Byes: six weeks with four teams off, four weeks with two.
    const order = rng.shuffle([...teams]);
    const bye: Record<string, number> = {};
    const sizes = rng.shuffle([4, 4, 4, 4, 4, 4, 2, 2, 2, 2]);
    let idx = 0;
    sizes.forEach((n, i) => { for (let k = 0; k < n; k++) bye[order[idx++]] = 5 + i; });
    let left = [...pairs];
    const out: Game[] = [];
    let ok = true;
    for (let w = 1; w <= REG_WEEKS && ok; w++) {
      const playing = teams.filter(t => bye[t] !== w);
      let found: [string, string][] | null = null;
      for (let tries = 0; tries < 120 && !found; tries++) {
        const pool = rng.shuffle([...left]);
        const busy = new Set<string>();
        const pick: [string, string][] = [];
        // Most-constrained teams first.
        for (const t of rng.shuffle([...playing])) {
          if (busy.has(t)) continue;
          const g = pool.find(([h, a]) => (h === t || a === t) && !busy.has(h) && !busy.has(a) && bye[h] !== w && bye[a] !== w);
          if (!g) break;
          busy.add(g[0]); busy.add(g[1]); pick.push(g);
        }
        if (busy.size === playing.length) found = pick;
      }
      if (!found) { ok = false; break; }
      for (const g of found) { left.splice(left.indexOf(g), 1); out.push({ id: `${season}-${w}-${out.length}`, season, week: w, home: g[0], away: g[1], day: 'Sun', time: rng.pick(['13:00', '13:00', '13:00', '16:05', '16:25']) }); }
    }
    if (!ok || left.length) continue;
    for (let w = 1; w <= REG_WEEKS; w++) {
      const gs = out.filter(g => g.week === w);
      if (gs[0]) { gs[0].day = 'Thu'; gs[0].time = '20:15'; }
      if (gs[1]) { gs[1].time = '20:20'; }
      if (gs[2]) { gs[2].day = 'Mon'; gs[2].time = '20:15'; }
    }
    return out;
  }
  throw new Error('Could not build a schedule');
}

export { minSalary, emptyLine };
