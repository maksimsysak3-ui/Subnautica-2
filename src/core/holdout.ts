// Holdouts. A star who is badly underpaid (and has the ego to act on it) stays away:
// from training camp, or mid-season when his mood sours. While he is out he misses
// every game, his morale sinks and he forfeits game checks. A new deal ends it; so can
// fines (pressure to report), a trade, or simply time. AI teams have holdouts too.
import type { League, Player } from './types';
import { Rng, clamp, hash } from './rng';
import { apy, marketValue, marketTerms, yearsLeft, money } from './contracts';
import { news, mail } from './season';
import { signPlayer } from './offseason';

export interface Holdout { since: number; weeks: number; lost: number; fines: boolean; camp: boolean }
export const holdoutOf = (p: Player) => (p as Player & { holdout?: Holdout }).holdout;
const set = (p: Player, h?: Holdout) => { (p as Player & { holdout?: Holdout }).holdout = h; };

/** Underpaid enough, good enough and close enough to a new deal to hold out. */
export function holdoutRisk(L: League, p: Player): number {
  if (p.team === 'FA' || p.status !== 'ACT' || holdoutOf(p) || p.contract.tag) return 0;
  const left = yearsLeft(p.contract, L.season);
  if (p.ovr < 84 || left < 1 || left > 2) return 0;
  if (p.contract.rookie && p.exp < 3) return 0;      // rookie deals can't be redone before year three
  const pay = apy(p.contract), worth = marketValue(p, L.season);
  if (pay >= worth * 0.7) return 0;
  const gap = 1 - pay / worth;                       // 0.3 .. 1
  return clamp(((gap - 0.25) * 0.35 + (p.traits.ego - 50) / 400 + (60 - p.morale) / 400) * 0.6, 0, 0.3);
}

function begin(L: League, p: Player, camp: boolean) {
  set(p, { since: L.season * 100 + L.week, weeks: 0, lost: 0, fines: false, camp });
  p.morale = clamp(p.morale - 6, 0, 100);
  const t = L.teams[p.team];
  news(L, 'league', `${t.nick} ${p.pos} ${p.fn} ${p.ln} is holding out${camp ? ' of training camp' : ''}, seeking a new contract. He makes ${money(apy(p.contract))} a year; the market says ${money(marketValue(p, L.season))}.`, [p.team], { pid: p.id, big: p.ovr >= 88 });
  if (p.team === L.user) mail(L, 'Front Office', `${p.ln} is holding out`, `${p.fn} ${p.ln} (${p.pos} ${p.ovr}) did not report${camp ? ' to camp' : ' this week'}. His agent wants a new deal. Until he is back he misses every game.\n\nOptions: negotiate an extension, fine him each week he stays away, trade him, or wait him out.`);
}

/** Training camp opens: the unhappy stars stay home. */
export function campHoldouts(L: League) {
  const rng = new Rng(hash(`hold-camp-${L.seed}-${L.season}`));
  for (const p of Object.values(L.players)) { const r = holdoutRisk(L, p); if (r > 0 && rng.chance(r)) begin(L, p, true); }
}

/** Each week of the season: holdouts run on (or end), and the odd new one starts. */
export function holdoutWeekly(L: League) {
  const rng = new Rng(hash(`hold-${L.seed}-${L.season}-${L.week}`));
  for (const p of Object.values(L.players)) {
    const h = holdoutOf(p);
    if (!h) { const r = holdoutRisk(L, p); if (r > 0 && p.morale < 50 && rng.chance(r * 0.08)) begin(L, p, false); continue; }
    if (p.team === 'FA' || p.status === 'RET') { set(p, undefined); continue; }
    h.weeks++;
    const check = Math.round(apy(p.contract) / 17);
    h.lost += check + (h.fines ? 50_000 : 0);
    p.morale = clamp(p.morale - (h.fines ? 5 : 3), 0, 100);
    const t = L.teams[p.team];
    // He may give in: lost money adds up, fines add pressure, ego pushes back.
    const report = 0.06 + h.weeks * 0.05 + (h.fines ? 0.1 : 0) - (p.traits.ego - 50) / 600;
    if (rng.chance(clamp(report, 0.02, 0.6))) {
      set(p, undefined);
      news(L, 'league', `${p.fn} ${p.ln} ends his holdout and reports to the ${t.nick} after ${h.weeks} week${h.weeks > 1 ? 's' : ''}, without a new deal.`, [p.team], { pid: p.id });
      if (p.team === L.user) mail(L, 'Front Office', `${p.ln} has reported`, `${p.fn} ${p.ln} ended his holdout after ${h.weeks} week${h.weeks > 1 ? 's' : ''} and ${money(h.lost)} in lost pay. He is back, but he is not happy (morale ${Math.round(p.morale)}).`);
      continue;
    }
    // AI front offices usually pay up within a few weeks.
    if (p.team !== L.user && rng.chance(0.28)) {
      const m = marketTerms(p, L.season);
      signPlayer(L, p, p.team, { apy: Math.round(m.apy * 0.97), years: m.years, gtd: m.gtd }, { extend: true });
      news(L, 'sign', `Holdout over: the ${t.nick} and ${p.fn} ${p.ln} agree to a ${m.years}-year, ${money(Math.round(m.apy * 0.97) * m.years)} extension.`, [p.team], { pid: p.id, big: p.ovr >= 88 });
    }
  }
}

/** Fine him for every week he stays away. More pressure to report; it costs morale. */
export function fineHoldout(L: League, p: Player) {
  const h = holdoutOf(p); if (!h) return;
  h.fines = true;
  p.morale = clamp(p.morale - 6, 0, 100);
  news(L, 'league', `The ${L.teams[p.team].nick} are fining ${p.fn} ${p.ln} for every week of his holdout.`, [p.team], { pid: p.id });
}
/** Any new contract (or leaving the team) ends a holdout. */
export function endHoldout(p: Player) { set(p, undefined); }
