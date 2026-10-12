// Free agency over several "days". Every day AI teams bid by need and cap room,
// players weigh every offer (money, guarantees, length and their motivations),
// and sign once an offer clears what they want. Asks soften as the market dries up.
import type { League, Player } from './types';
import { Rng, clamp } from './rng';
import { capSpace, marketTerms, money } from './contracts';
import { positionNeeds, freeNumber } from './draft';
import { askingPrice, evaluateOffer, offerScore, signPlayer } from './offseason';
import { news, mail } from './season';

export const freeAgents = (league: League) => Object.values(league.players).filter(p => p.team === 'FA' && p.status === 'FA');

export function openFreeAgency(league: League) {
  league.fa = { day: 1, offers: {} };
  // The league has been talking to agents for days already: the first bids are in before you call.
  aiBids(league, new Rng(league.seed + league.season * 7), 1);
  const top = freeAgents(league).sort((a, b) => b.ovr - a.ovr).slice(0, 5);
  news(league, 'league', `Free agency opens. Top of the class: ${top.map(p => `${p.pos} ${p.fn} ${p.ln} (${p.ovr})`).join(', ')}.`, [], { big: true });
}

/** User offer: immediate read on interest; the decision comes when the day ends. */
export function makeOffer(league: League, p: Player, offer: { apy: number; years: number; gtd: number }) {
  const interest = evaluateOffer(league, p, offer, league.user);
  if (offer.apy * 1 > capSpace(league, league.user)) return { ok: false, interest, msg: 'Not enough cap space for that offer.' };
  const list = (league.fa!.offers[p.id] ??= []).filter(o => o.team !== league.user);
  list.push({ team: league.user, ...offer, day: league.fa!.day });
  league.fa!.offers[p.id] = list;
  return { ok: true, interest, msg: interest > 0.85 ? 'He loves it. Expect him to sign.' : interest > 0.55 ? 'He is interested, but others may top it.' : interest > 0.25 ? 'He is lukewarm on this offer.' : 'He is not interested at this price.' };
}

/** Signings the user made, waiting for their ceremony on screen. */
export interface Ceremony { pid: string; years: number; total: number }
export const ceremonies = (league: League) => ((league as League & { ceremonies?: Ceremony[] }).ceremonies ??= []);
export function queueCeremony(league: League, p: Player, offer: { apy: number; years: number }) {
  const q = ceremonies(league); if (!q.some(c => c.pid === p.id)) q.push({ pid: p.id, years: offer.years, total: offer.apy * offer.years });
  if (q.length > 6) q.splice(0, q.length - 6);
}

/** During the season and camp, unsigned players take a fair offer on the spot. */
export function signNow(league: League, p: Player, offer: { apy: number; years: number; gtd: number }) {
  if (offer.apy > capSpace(league, league.user)) return { ok: false, msg: 'Not enough cap space.' };
  const interest = evaluateOffer(league, p, offer, league.user) + (league.phase === 'regular' ? 0.25 : 0);
  if (interest < 0.5) return { ok: false, msg: `${p.ln} turned it down. He wants about ${money(askingPrice(league, p).apy)} a year.` };
  signPlayer(league, p, league.user, offer);
  p.num = freeNumber(league, league.user, p.pos);
  news(league, 'sign', `${league.teams[league.user].nick} signed ${p.pos} ${p.fn} ${p.ln}.`, [league.user], { pid: p.id });
  queueCeremony(league, p, offer);
  return { ok: true, msg: `${p.fn} ${p.ln} has signed.` };
}

/** AI teams bid by need and room, and fight for the players you're chasing. */
function aiBids(league: League, rng: Rng, day: number) {
  const fa = league.fa!;
  const pool = freeAgents(league).sort((a, b) => b.ovr - a.ovr);
  for (const t of Object.keys(league.teams)) {
    if (t === league.user) continue;
    let space = capSpace(league, t) - 8_000_000 - (fa.offers ? Object.values(fa.offers).flat().filter(o => o.team === t).reduce((a, o) => a + o.apy, 0) : 0);
    const needs = positionNeeds(league, t);
    const targets = pool.filter(p => (needs[p.pos] ?? 0) > 0.6 || p.ovr >= 80).slice(0, 40);
    let bids = 0;
    for (const p of targets) {
      if (bids >= 4 || space <= 1_000_000) break;
      if (fa.offers[p.id]?.some(o => o.team === t)) continue;
      const ask = askingPrice(league, p);
      const discount = clamp(1 - (day - 1) * 0.045, 0.62, 1);
      const want = (needs[p.pos] ?? 0) + (p.ovr - 70) / 10;
      if (want < 0.7 || rng.chance(0.3)) continue;
      const apy = Math.round(ask.apy * discount * rng.range(0.95, 1.12) / 10_000) * 10_000;
      if (apy > space * 0.6) continue;
      (fa.offers[p.id] ??= []).push({ team: t, apy, years: ask.years, gtd: ask.gtd * rng.range(0.9, 1.15), bonus: rng.range(0.5, 0.8), day });
      space -= apy; bids++;
    }
  }
  // Bidding wars: when your offer leads for a player a team needs, they try to top it.
  for (const p of pool) {
    const offers = fa.offers[p.id]; const mine = offers?.find(o => o.team === league.user);
    if (!offers || !mine || p.ovr < 70) continue;
    const myV = offerScore(league, p, mine, league.user);
    const rivals = Object.keys(league.teams).filter(t => t !== league.user && ((positionNeeds(league, t)[p.pos] ?? 0) > 0.5 || p.ovr >= 82));
    for (const t of rivals.sort(() => rng.next() - 0.5).slice(0, p.ovr >= 82 ? 3 : 2)) {
      if (!rng.chance(p.ovr >= 85 ? 0.75 : p.ovr >= 78 ? 0.55 : 0.35)) continue;
      const base = offers.filter(o => o.team === t)[0] ?? { team: t, ...askingPrice(league, p), bonus: 0.6, day };
      // Price that beats you on his own scale, within what the rival can afford.
      let apy = base.apy;
      for (let k = 0; k < 12 && offerScore(league, p, { ...base, apy }, t) < myV + 0.015; k++) apy *= 1.04;
      apy = Math.round(apy / 10_000) * 10_000;
      if (apy > (capSpace(league, t) - 6_000_000) * 0.6 || apy > askingPrice(league, p).apy * 1.3) continue;
      fa.offers[p.id] = [...offers.filter(o => o.team !== t), { ...base, team: t, apy, gtd: Math.max(base.gtd, mine.gtd), day }];
      break;
    }
  }
}

export function runFreeAgencyDay(league: League, rng: Rng) {
  const fa = league.fa!;
  const day = fa.day;
  const pool = freeAgents(league).sort((a, b) => b.ovr - a.ovr);
  aiBids(league, rng, day);
  // Players decide: the best offer by their own reckoning, if it clears the bar.
  for (const p of pool) {
    const offers = fa.offers[p.id];
    if (!offers?.length) continue;
    const bar = clamp(0.62 - (day - 1) * 0.07, 0.2, 0.62);
    let best = offers[0], bv = -1;
    // Weighed on his own scale: money first, then fit, family, the team he knows, how talks went.
    for (const o of offers) { if (capSpace(league, o.team) < o.apy) continue; const v = offerScore(league, p, o, o.team); if (v > bv) { bv = v; best = o; } }
    if (bv < 0 || evaluateOffer(league, p, best, best.team) < bar) continue;
    // Top free agents let the market develop before deciding, unless someone blows them away.
    if (p.ovr >= 80 && day < 2 && offers.length < 3) continue;
    signPlayer(league, p, best.team, best);
    p.num = freeNumber(league, best.team, p.pos);
    delete fa.offers[p.id];
    const total = best.apy * best.years;
    if (best.team === league.user) queueCeremony(league, p, best);
    if (best.team === league.user) mail(league, 'Front Office', `${p.ln} signed!`, `${p.fn} ${p.ln} accepted your offer: ${best.years} years, ${money(total)}.`);
    else if (offers.some(o => o.team === league.user)) { const mine = offers.find(o => o.team === league.user)!; mail(league, 'Front Office', `${p.ln} signed elsewhere`, `${p.fn} ${p.ln} chose the ${league.teams[best.team].nick} (${best.years} yrs, ${money(total)}) over your ${mine.years}-year, ${money(mine.apy * mine.years)} offer.${best.apy <= mine.apy ? ' It wasn\'t about the money: he liked the fit there better.' : ''}`); }
    if (p.ovr >= 78) news(league, 'sign', `${league.teams[best.team].nick} signed ${p.pos} ${p.fn} ${p.ln}: ${best.years} years, ${money(total)}.`, [best.team], { pid: p.id, big: p.ovr >= 86 });
  }
  // Offers expire after two days.
  for (const id of Object.keys(fa.offers)) fa.offers[id] = fa.offers[id].filter(o => day - o.day < 2);
  fa.day++;
}

/** In-season depth: AI teams plug holes with the best free agent at a need. */
export function aiFillHoles(league: League, team: string, rng: Rng) {
  const act = Object.values(league.players).filter(p => p.team === team && p.status === 'ACT');
  const healthy = act.filter(p => !p.injury);
  const min: Record<string, number> = { QB: 2, RB: 2, WR: 4, TE: 2, OT: 3, G: 3, C: 1, EDGE: 3, DT: 3, LB: 3, CB: 4, S: 3, K: 1, P: 1, LS: 1 };
  for (const [pos, n] of Object.entries(min)) {
    const have = healthy.filter(p => p.pos === pos).length;
    if (have >= n) continue;
    // Promote from the practice squad first.
    const ps = Object.values(league.players).filter(p => p.team === team && p.status === 'PS' && p.pos === pos).sort((a, b) => b.ovr - a.ovr)[0];
    if (ps) { ps.status = 'ACT'; continue; }
    const fa = freeAgents(league).filter(p => p.pos === pos && !p.injury).sort((a, b) => b.ovr - a.ovr)[0];
    if (!fa) continue;
    // Make room: long-term injured to IR, then the weakest healthy body goes.
    const ir = act.filter(p => p.injury && p.injury.weeks >= 4).sort((a, b) => b.injury!.weeks - a.injury!.weeks)[0];
    if (ir) ir.status = 'IR';
    else if (act.length >= 53) continue;
    const t = marketTerms(fa, league.season);
    signPlayer(league, fa, team, { apy: Math.max(t.apy * 0.7, 0), years: 1, gtd: 0 });
    fa.num = freeNumber(league, team, fa.pos);
    if (team !== league.user && fa.ovr >= 72) news(league, 'sign', `${league.teams[team].nick} signed ${fa.pos} ${fa.fn} ${fa.ln} to fill an injury hole.`, [team], { pid: fa.id });
    void rng;
  }
}
