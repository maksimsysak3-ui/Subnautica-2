// Trade values on a draft-chart scale (Jimmy Johnson points): players by position,
// overall, age and contract surplus; picks by slot (future picks discounted and
// projected from the owner's strength). AI teams want to win the deal by a margin
// that depends on difficulty, account for their mode (rebuilding teams prefer
// youth and picks), refuse illegal cap results, and do not pay quantity for quality.
import type { League, Pick, Player, Pos, TradeOffer } from './types';
import { Rng, clamp } from './rng';
import { capHit, capSpace, marketValue, yearsLeft } from './contracts';
import { teamRatings, autoDepth } from './league';
import { news, mail } from './season';

const CHART: [number, number][] = [[1, 3000], [2, 2600], [3, 2200], [4, 1800], [5, 1700], [6, 1600], [8, 1400], [10, 1300], [12, 1200], [16, 1000], [20, 850], [25, 720], [32, 590], [40, 500], [50, 400], [64, 270], [80, 190], [96, 116], [100, 100], [128, 50], [160, 30], [192, 17], [224, 4], [260, 1]];
export function pickValue(no: number) {
  for (let i = 1; i < CHART.length; i++) {
    const [a, va] = CHART[i - 1], [b, vb] = CHART[i];
    if (no <= b) return va + (vb - va) * (no - a) / (b - a);
  }
  return 1;
}
const POS_MULT: Record<Pos, number> = { QB: 1.7, EDGE: 1.15, OT: 1.05, WR: 1.0, CB: 0.95, DT: 0.9, TE: 0.72, S: 0.7, LB: 0.68, G: 0.68, C: 0.62, RB: 0.55, FB: 0.15, K: 0.12, P: 0.08, LS: 0.03 };

/** Estimated slot for a pick that has not been ordered yet. */
export function projectedSlot(league: League, pick: Pick) {
  if (pick.no) return pick.no;
  const strength = Object.keys(league.teams).map(t => [t, teamRatings(league, t).ovr] as const).sort((a, b) => a[1] - b[1]);
  const idx = strength.findIndex(s => s[0] === pick.orig);
  return (pick.round - 1) * 32 + (idx < 0 ? 16 : idx + 1);
}
export function pickTradeValue(league: League, pick: Pick, forTeam?: string) {
  const years = pick.season - league.season - (league.phase === 'draft' || league.phase === 'camp' || league.phase === 'preseason' || league.phase === 'regular' || league.phase === 'playoffs' ? 0 : 0);
  let v = pickValue(projectedSlot(league, pick)) * Math.pow(0.85, Math.max(0, years - (league.phase === 'regular' || league.phase === 'playoffs' ? 1 : 0)));
  if (forTeam && league.teams[forTeam]?.mode === 'rebuild') v *= 1.2;
  if (forTeam && league.teams[forTeam]?.mode === 'contend') v *= 0.85;
  return v;
}

export function playerTradeValue(league: League, p: Player, forTeam?: string) {
  if (p.status === 'RET') return 0;
  const x = clamp((p.ovr - 55) / 44, 0, 1.05);
  let v = 2900 * Math.pow(x, 3.3) * POS_MULT[p.pos];
  const age = p.age;
  const ageF = p.pos === 'QB' ? (age <= 30 ? 1 : age <= 34 ? 0.85 - (age - 31) * 0.08 : 0.4) : (age <= 25 ? 1.12 : age <= 27 ? 1 : age <= 29 ? 0.82 : age <= 31 ? 0.6 : 0.38);
  v *= ageF;
  if (p.age <= 25 && p.pot > p.ovr) v *= 1 + (p.pot - p.ovr) * 0.02;
  // Contract: cheap control is an asset; an overpay is a liability.
  const yrs = Math.max(1, yearsLeft(p.contract, league.season));
  const market = marketValue(p, league.season);
  const hit = capHit(p.contract, league.season) || market;
  const surplus = clamp((market - hit) / Math.max(market, 1_000_000), -1, 1);
  v *= clamp(1 + surplus * 0.45 + (yrs - 1) * 0.06, 0.35, 1.6);
  if (p.injury?.season) v *= 0.55;
  if (forTeam) {
    const mode = league.teams[forTeam]?.mode;
    if (mode === 'rebuild') v *= p.age <= 26 ? 1.12 : 0.75;
    if (mode === 'contend') v *= p.ovr >= 80 ? 1.15 : 0.95;
  }
  return Math.max(1, v);
}

/** Value to the receiving team, with diminishing returns for piles of lesser assets. */
function packageValue(league: League, players: Player[], picks: Pick[], forTeam: string) {
  const vals = [...players.map(p => playerTradeValue(league, p, forTeam)), ...picks.map(k => pickTradeValue(league, k, forTeam))].sort((a, b) => b - a);
  return vals.reduce((sum, v, i) => sum + v * Math.pow(0.82, i), 0);
}

export interface TradeVerdict { accept: boolean; give: number; get: number; ratio: number; reason: string }
/** Would `offer.to` accept? `give` is what offer.from gives (and offer.to receives). */
export function evaluateTrade(league: League, offer: TradeOffer): TradeVerdict {
  const P = (ids: string[]) => ids.map(id => league.players[id]).filter(Boolean);
  const K = (ids: string[]) => ids.map(id => league.picks.find(p => p.id === id)!).filter(Boolean);
  const receive = packageValue(league, P(offer.give.players), K(offer.give.picks), offer.to);
  const send = packageValue(league, P(offer.get.players), K(offer.get.picks), offer.to);
  const margin = { Rookie: 1.0, Pro: 1.1, 'All-Madden': 1.22 }[league.difficulty];
  const ratio = receive / Math.max(1, send);
  // Cap legality for the AI side after the deal (in season the cap binds now).
  const capIn = P(offer.give.players).reduce((a, p) => a + capHit(p.contract, league.season), 0);
  const capOut = P(offer.get.players).reduce((a, p) => a + capHit(p.contract, league.season), 0);
  if (capSpace(league, offer.to) - capIn + capOut < 0) return { accept: false, give: receive, get: send, ratio, reason: 'That would put us over the cap.' };
  const fromCap = capSpace(league, offer.from) + capIn - capOut;
  if (fromCap < 0) return { accept: false, give: receive, get: send, ratio, reason: 'You would be over the cap.' };
  if (league.phase === 'regular' && league.week > league.tradeDeadlineWeek) return { accept: false, give: receive, get: send, ratio, reason: 'The trade deadline has passed.' };
  // Franchise QBs are almost untouchable.
  const theirQB = P(offer.get.players).find(p => p.pos === 'QB' && p.ovr >= 85 && p.age <= 32);
  if (theirQB && ratio < margin * 1.4) return { accept: false, give: receive, get: send, ratio, reason: `${theirQB.ln} is the face of our franchise.` };
  if (ratio >= margin) return { accept: true, give: receive, get: send, ratio, reason: 'We have a deal.' };
  return { accept: false, give: receive, get: send, ratio, reason: ratio > margin * 0.85 ? 'Close. Add a little more and we can talk.' : ratio > 0.6 ? 'That is not enough for us.' : 'Not interested.' };
}

export function executeTrade(league: League, offer: TradeOffer) {
  for (const id of offer.give.players) { const p = league.players[id]; p.team = offer.to; p.status = 'ACT'; p.morale = clamp(p.morale - 5, 0, 100); }
  for (const id of offer.get.players) { const p = league.players[id]; p.team = offer.from; p.status = 'ACT'; p.morale = clamp(p.morale - 5, 0, 100); }
  for (const id of offer.give.picks) { const k = league.picks.find(p => p.id === id); if (k) k.owner = offer.to; }
  for (const id of offer.get.picks) { const k = league.picks.find(p => p.id === id); if (k) k.owner = offer.from; }
  autoDepth(league, offer.from); autoDepth(league, offer.to);
  const desc = (ids: string[], picks: string[]) => [...ids.map(id => { const p = league.players[id]; return `${p.pos} ${p.fn} ${p.ln}`; }), ...picks.map(id => pickLabel(league, league.picks.find(p => p.id === id)!))].join(', ') || 'nothing';
  news(league, 'trade', `TRADE: ${league.teams[offer.from].nick} send ${desc(offer.give.players, offer.give.picks)} to the ${league.teams[offer.to].nick} for ${desc(offer.get.players, offer.get.picks)}.`, [offer.from, offer.to], { big: true });
}
export function pickLabel(league: League, k: Pick) {
  const ord = ['', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th'][k.round];
  return `${k.season} ${ord}${k.no ? ` (#${k.no})` : ''}${k.orig !== k.owner ? ` (${k.orig})` : ''}`;
}

/** Ask the AI what it would want for one of its players: picks first, then players. */
export function whatWouldItTake(league: League, from: string, to: string, targetId: string): TradeOffer | null {
  const target = league.players[targetId];
  const need = playerTradeValue(league, target, from) * { Rookie: 1.0, Pro: 1.1, 'All-Madden': 1.22 }[league.difficulty];
  const offer: TradeOffer = { from, to, give: { players: [], picks: [] }, get: { players: [targetId], picks: [] } };
  const assets = [
    ...league.picks.filter(k => k.owner === from && k.season >= league.season).map(k => ({ kind: 'pick' as const, id: k.id, v: pickTradeValue(league, k, to) })),
    ...Object.values(league.players).filter(p => p.team === from && p.status === 'ACT' && !(p.pos === 'QB' && p.ovr >= 80)).map(p => ({ kind: 'player' as const, id: p.id, v: playerTradeValue(league, p, to) })),
  ].sort((a, b) => b.v - a.v);
  // Their front office wants fair value, not a windfall: the cheapest single asset that
  // covers it, or a package built down from the best piece that fits under it.
  const decayed = (vs: number[]) => [...vs].sort((x, y) => y - x).reduce((t, v, i) => t + v * Math.pow(0.82, i), 0);
  const single = [...assets].reverse().find(a => a.v >= need);
  let pack: typeof assets = [];
  for (const a of assets) {
    if (a.v >= need) continue;
    const vals = [...pack.map(x => x.v), a.v];
    if (pack.length && decayed(vals) - decayed(pack.map(x => x.v)) < a.v * 0.3) continue;
    pack.push(a);
    if (decayed(pack.map(x => x.v)) >= need) {
      // Swap the last piece for the smallest asset that still closes the gap.
      const rest = pack.slice(0, -1);
      const closer = [...assets].reverse().find(x => !rest.includes(x) && x.v < need && decayed([...rest.map(r => r.v), x.v]) >= need);
      if (closer) pack = [...rest, closer];
      break;
    }
    if (pack.length >= 4) break;
  }
  const packOk = decayed(pack.map(x => x.v)) >= need * 0.95;
  const sum = (xs: typeof assets) => xs.reduce((t, x) => t + x.v, 0);
  const chosen = single && (!packOk || single.v <= sum(pack)) ? [single] : packOk ? pack : null;
  if (!chosen) return null;
  for (const a of chosen) (a.kind === 'pick' ? offer.give.picks : offer.give.players).push(a.id);
  return offer;
}

/** Around the deadline, AI teams make the odd deal; sometimes they call the user. */
export function aiTrades(league: League, rng: Rng) {
  if (league.phase !== 'regular' || league.week > league.tradeDeadlineWeek || league.week < 3) return;
  const teams = Object.keys(league.teams).filter(t => t !== league.user);
  if (rng.chance(0.35)) {
    const buyer = rng.pick(teams.filter(t => league.teams[t].mode === 'contend'));
    const seller = rng.pick(teams.filter(t => league.teams[t].mode === 'rebuild' && t !== buyer));
    if (buyer && seller) {
      const vet = Object.values(league.players).filter(p => p.team === seller && p.status === 'ACT' && p.ovr >= 78 && p.age >= 27).sort((a, b) => b.ovr - a.ovr)[0];
      if (vet) {
        const offer = whatWouldItTake(league, buyer, seller, vet.id);
        if (offer && evaluateTrade(league, offer).accept) executeTrade(league, offer);
      }
    }
  }
  // A call to the user's front office.
  if (rng.chance(0.18)) {
    const caller = rng.pick(teams);
    const mine = Object.values(league.players).filter(p => p.team === league.user && p.status === 'ACT' && p.ovr >= 75 && !(p.pos === 'QB' && p.ovr >= 85));
    const target = mine.length ? rng.pick(mine) : undefined;
    if (target) {
      const offer = whatWouldItTake(league, caller, league.user, target.id);
      if (offer) {
        const flipped: TradeOffer = { from: caller, to: league.user, give: offer.give, get: offer.get };
        mail(league, `${league.teams[caller].name} GM`, `Trade offer for ${target.ln}`, `We'd like to acquire ${target.pos} ${target.fn} ${target.ln}. Have a look at what we are offering.`, { kind: 'trade', offer: flipped });
      }
    }
  }
}

/** Team mode follows roster strength and age. */
export function updateModes(league: League) {
  const ranked = Object.keys(league.teams).map(t => [t, teamRatings(league, t).ovr] as const).sort((a, b) => b[1] - a[1]);
  ranked.forEach(([t], i) => { league.teams[t].mode = i < 10 ? 'contend' : i >= 22 ? 'rebuild' : 'balanced'; });
}
export { yearsLeft };
