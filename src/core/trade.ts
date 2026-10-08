// Trade values on a draft-chart scale (Jimmy Johnson points): players by position,
// overall, age and contract surplus; picks by slot (future picks discounted and
// projected from the owner's strength). AI teams want to win the deal by a margin
// that depends on difficulty, account for their mode (rebuilding teams prefer
// youth and picks), refuse illegal cap results, and do not pay quantity for quality.
import type { League, Pick, Player, Pos, TradeOffer } from './types';
import { Rng, clamp } from './rng';
import { capHit, capSpace, marketValue, yearsLeft } from './contracts';
import { teamRatings, autoDepth } from './league';
import { news, mail, standings } from './season';
import { positionNeeds } from './draft';

const CHART: [number, number][] = [[1, 3000], [2, 2600], [3, 2200], [4, 1800], [5, 1700], [6, 1600], [8, 1400], [10, 1300], [12, 1200], [16, 1000], [20, 850], [25, 720], [32, 590], [40, 500], [50, 400], [64, 270], [80, 190], [96, 116], [100, 100], [128, 50], [160, 30], [192, 17], [224, 4], [260, 1]];
export function pickValue(no: number) {
  for (let i = 1; i < CHART.length; i++) {
    const [a, va] = CHART[i - 1], [b, vb] = CHART[i];
    if (no <= b) return va + (vb - va) * (no - a) / (b - a);
  }
  return 1;
}
const POS_MULT: Record<Pos, number> = { QB: 1.7, EDGE: 1.15, OT: 1.05, WR: 1.0, CB: 0.95, DT: 0.9, TE: 0.72, S: 0.7, LB: 0.68, G: 0.68, C: 0.62, RB: 0.55, FB: 0.15, K: 0.12, P: 0.08, LS: 0.03 };

/** The draft year that comes next (the league year rolls over before the draft). */
const nextDraft = (league: League) => (['resign', 'freeagency', 'draft'].includes(league.phase) ? league.season : league.season + 1);

/**
 * Estimated slot for a pick that has not been ordered yet. For the coming draft it
 * reads the standings (weighted by how much of the season is played) against roster
 * strength; picks further out regress toward the middle of the round, because nobody
 * knows how good a team will be two years from now.
 */
export function projectedSlot(league: League, pick: Pick) {
  if (pick.no) return pick.no;
  const inSeason = league.phase === 'regular' || league.phase === 'playoffs';
  const st = inSeason ? standings(league) : undefined;
  const ratings = Object.keys(league.teams).map(t => [t, teamRatings(league, t).ovr] as const);
  const lo = Math.min(...ratings.map(r => r[1])), hi = Math.max(...ratings.map(r => r[1]));
  const score = (t: string, ovr: number) => {
    const strength = (ovr - lo) / Math.max(1, hi - lo);
    const s = st?.[t]; const gp = s ? s.w + s.l + s.t : 0;
    const w = Math.min(1, gp / 17);
    return s && gp ? s.pct * w + strength * (1 - w) : strength;
  };
  const order = ratings.map(([t, o]) => [t, score(t, o)] as const).sort((a, b) => a[1] - b[1]);
  const idx = order.findIndex(s => s[0] === pick.orig);
  const projected = idx < 0 ? 16.5 : idx + 1;
  const yearsOut = Math.max(0, pick.season - nextDraft(league));
  const within = projected + (16.5 - projected) * Math.min(1, yearsOut * 0.35);
  return Math.round((pick.round - 1) * 32 + within);
}
export function pickTradeValue(league: League, pick: Pick, forTeam?: string) {
  // About 8% a year for waiting on a future pick (teams treat a future first as a first).
  const yearsOut = Math.max(0, pick.season - nextDraft(league));
  let v = pickValue(projectedSlot(league, pick)) * Math.pow(0.92, yearsOut);
  if (forTeam && league.teams[forTeam]?.mode === 'rebuild') v *= 1.2;
  if (forTeam && league.teams[forTeam]?.mode === 'contend') v *= 1.0;
  return v;
}

/**
 * What a player taken at this slot should be by now: the average of his own draft
 * classmates picked around him (same class, same years of growth). Falls back to
 * the class model's curve when there are too few neighbours to compare.
 */
const slotCurve = (pick: number) => 79 - 9.5 * Math.log10(1 + (pick - 1) * 0.35);
const classCache = new WeakMap<League, { key: string; byYear: Map<number, Player[]> }>();
function expectedOvr(league: League, p: Player) {
  const key = `${league.season}-${league.phase}-${league.week}`;
  let c = classCache.get(league);
  if (!c || c.key !== key) {
    const byYear = new Map<number, Player[]>();
    for (const q of Object.values(league.players)) if (q.draft?.pick > 0 && q.status !== 'RET') (byYear.get(q.draft.year) ?? byYear.set(q.draft.year, []).get(q.draft.year)!).push(q);
    classCache.set(league, (c = { key, byYear }));
  }
  const span = Math.max(4, p.draft.pick * 0.25);
  const peers = (c.byYear.get(p.draft.year) ?? []).filter(q => Math.abs(q.draft.pick - p.draft.pick) <= span);
  if (peers.length < 4) return slotCurve(p.draft.pick) + Math.min(3, p.exp) * 2;
  return peers.reduce((a, q) => a + q.ovr, 0) / peers.length;
}

export function playerTradeValue(league: League, p: Player, forTeam?: string) {
  if (p.status === 'RET') return 0;
  // Value starts at 60 OVR: below that a player is roster filler, not a trade chip.
  const x = clamp((p.ovr - 60) / 39, 0, 1.05);
  let v = 2900 * Math.pow(x, 3.3) * POS_MULT[p.pos];
  const age = p.age;
  const ageF = p.pos === 'QB' ? (age <= 30 ? 1 : age <= 34 ? 0.85 - (age - 31) * 0.08 : 0.4) : (age <= 25 ? 1.06 : age <= 27 ? 1 : age <= 29 ? 0.82 : age <= 31 ? 0.6 : 0.38);
  v *= ageF;
  if (p.age <= 25 && p.pot > p.ovr) v *= 1 + Math.min(0.15, (p.pot - p.ovr) * 0.015);
  // Contract: cheap control is an asset; an overpay is a liability.
  const yrs = Math.max(1, yearsLeft(p.contract, league.season));
  const market = marketValue(p, league.season);
  const hit = capHit(p.contract, league.season) || market;
  const surplus = clamp((market - hit) / Math.max(market, 1_000_000), -1, 1);
  v *= clamp(1 + surplus * 0.3 + (yrs - 1) * 0.04, 0.4, 1.3);
  // Young players still carry their draft capital, as teams value them: the slot's
  // chart value, fading over their first three seasons and moved up or down by how
  // they have played against what that slot usually produces.
  // Draft capital only lasts through the rookie year, and only if he is living up to it:
  // after that teams trade for the player he is, not the pick he was.
  if (p.draft?.pick && p.exp <= 1) {
    const keep = [0.9, 0.6][p.exp];
    const weight = [0.55, 0.25][p.exp];
    const proof = [0.5, 1][p.exp];
    const perf = clamp(1 + proof * (p.ovr - expectedOvr(league, p)) / 8, 0.25, 1.3);
    const posAdj = clamp(0.55 + 0.45 * POS_MULT[p.pos], 0.7, 1.15);
    const capital = pickValue(p.draft.pick) * keep * perf * posAdj;
    v = Math.max(v, capital * weight + v * (1 - weight));
  }
  // Even the best non-quarterbacks top out around two first-round picks.
  if (p.pos !== 'QB' && v > 2400) v = 2400 + (v - 2400) * 0.5;
  if (p.injury?.season) v *= 0.55;
  if (forTeam) {
    const mode = league.teams[forTeam]?.mode;
    if (mode === 'rebuild') v *= p.age <= 26 ? 1.12 : 0.75;
    if (mode === 'contend') v *= p.ovr >= 80 ? 1.08 : 0.95;
  }
  return Math.max(1, v);
}

/** Value to the receiving team, with diminishing returns for piles of lesser assets. */
function packageValue(league: League, players: Player[], picks: Pick[], forTeam: string) {
  const vals = [...players.map(p => playerTradeValue(league, p, forTeam)), ...picks.map(k => pickTradeValue(league, k, forTeam))].sort((a, b) => b - a);
  // Real assets (anything worth at least 40% of the best piece) keep most of their value;
  // filler is discounted hard so a pile of late picks never buys a star.
  const top = vals[0] ?? 0;
  return vals.reduce((sum, v, i) => sum + v * Math.pow(v >= top * 0.4 ? 0.95 : 0.8, i), 0);
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
  const need = playerTradeValue(league, target, to) * { Rookie: 1.0, Pro: 1.1, 'All-Madden': 1.22 }[league.difficulty];
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

/** One AI-to-AI deal: `buyer` goes after a player at a need from `seller`. Returns true if it happened. */
function tryDeal(league: League, buyer: string, seller: string, rng: Rng, minOvr = 74) {
  const need = positionNeeds(league, buyer);
  const wants = Object.values(league.players).filter(p => p.team === seller && p.status === 'ACT' && !p.injury && p.ovr >= minOvr && (need[p.pos] ?? 0) >= 0.8 && !(p.pos === 'QB' && p.ovr >= 85 && p.age <= 32))
    .sort((a, b) => (need[b.pos] ?? 0) * b.ovr - (need[a.pos] ?? 0) * a.ovr);
  const target = wants[rng.int(0, Math.min(2, wants.length - 1))];
  if (!target) return false;
  const offer = whatWouldItTake(league, buyer, seller, target.id);
  if (!offer) return false;
  // Over the cap? Send salary back the way real deadline deals do: the buyer's
  // priciest contracts that are not worth what they cost.
  let v = evaluateTrade(league, offer);
  if (!v.accept && v.reason === 'You would be over the cap.') {
    const filler = Object.values(league.players).filter(p => p.team === buyer && p.status === 'ACT' && !offer.give.players.includes(p.id) && capHit(p.contract, league.season) > 3_000_000)
      .sort((a, b) => capHit(b.contract, league.season) / playerTradeValue(league, b) - capHit(a.contract, league.season) / playerTradeValue(league, a));
    for (const f of filler.slice(0, 2)) { offer.give.players.push(f.id); v = evaluateTrade(league, offer); if (v.accept || v.reason !== 'You would be over the cap.') break; }
  }
  if (!v.accept) return false;
  // The buyer will not hand over more than about 30% over what it is getting.
  const P = (ids: string[]) => ids.map(id => league.players[id]);
  const K = (ids: string[]) => ids.map(id => league.picks.find(k => k.id === id)!);
  const giving = packageValue(league, P(offer.give.players), K(offer.give.picks), buyer);
  if (giving > playerTradeValue(league, target, buyer) * 1.3) return false;
  executeTrade(league, offer);
  return true;
}

/**
 * AI front offices deal all season: a steady trickle early, a rush in the last two
 * weeks before the deadline (contenders buying veterans from sellers, everyone
 * chasing a starter at their thinnest spot), and the occasional call to the user.
 */
export function aiTrades(league: League, rng: Rng) {
  if (league.phase !== 'regular' || league.week > league.tradeDeadlineWeek || league.week < 2) return;
  const teams = Object.keys(league.teams).filter(t => t !== league.user);
  const st = standings(league);
  const buyers = teams.filter(t => league.teams[t].mode === 'contend' || st[t].pct >= 0.6);
  const sellers = teams.filter(t => league.teams[t].mode === 'rebuild' || (st[t].w + st[t].l >= 4 && st[t].pct <= 0.3));
  const rush = league.week >= league.tradeDeadlineWeek - 1;
  const attempts = rush ? rng.int(6, 8) : rng.int(2, 3);
  for (let i = 0; i < attempts; i++) {
    if (rng.chance(0.55) && buyers.length && sellers.length) {
      const b = rng.pick(buyers), s = rng.pick(sellers.filter(x => x !== b));
      if (s) tryDeal(league, b, s, rng, 76);
    } else {
      const b = rng.pick(teams), s = rng.pick(teams.filter(x => x !== b));
      tryDeal(league, b, s, rng, 72);
    }
  }
  if (rng.chance(rush ? 0.5 : 0.25)) callUser(league, rng, teams);
}

/** Another GM calls about one of the user's players. */
function callUser(league: League, rng: Rng, teams: string[]) {
  const caller = rng.pick(teams);
  const need = positionNeeds(league, caller);
  const mine = Object.values(league.players).filter(p => p.team === league.user && p.status === 'ACT' && p.ovr >= 74 && !(p.pos === 'QB' && p.ovr >= 85) && (need[p.pos] ?? 0) >= 0.5);
  const target = mine.length ? rng.pick(mine) : undefined;
  if (!target) return;
  const offer = whatWouldItTake(league, caller, league.user, target.id);
  if (!offer) return;
  const flipped: TradeOffer = { from: caller, to: league.user, give: offer.give, get: offer.get };
  mail(league, `${league.teams[caller].name} GM`, `Trade offer for ${target.ln}`, `We'd like to acquire ${target.pos} ${target.fn} ${target.ln}. Have a look at what we are offering.`, { kind: 'trade', offer: flipped });
}

/** Offseason: rebuilding teams cash in veterans, contenders reload, everyone fills holes. */
export function aiOffseasonTrades(league: League, rng: Rng) {
  const teams = Object.keys(league.teams).filter(t => t !== league.user);
  const contenders = teams.filter(t => league.teams[t].mode !== 'rebuild');
  const rebuilders = teams.filter(t => league.teams[t].mode === 'rebuild');
  const n = rng.int(3, 5);
  for (let i = 0; i < n; i++) {
    if (rebuilders.length && rng.chance(0.6)) tryDeal(league, rng.pick(contenders), rng.pick(rebuilders), rng, 77);
    else { const b = rng.pick(teams); tryDeal(league, b, rng.pick(teams.filter(x => x !== b)), rng, 73); }
  }
  if (rng.chance(0.35)) callUser(league, rng, teams);
}

/**
 * Draft day: before an AI pick in the first two rounds, a team a few spots back may
 * move up for a player it covets, paying the chart value (its pick plus extras).
 * Returns true if the pick changed hands.
 */
export function aiDraftDayTrade(league: League, rng: Rng, order: Pick[], cursor: number) {
  const pick = order[cursor];
  if (!pick || pick.owner === league.user || pick.round > 2 || !rng.chance(pick.round === 1 ? 0.12 : 0.06)) return false;
  const later = order.slice(cursor + 2, cursor + 14).filter(k => k.owner !== league.user && k.owner !== pick.owner);
  if (!later.length) return false;
  const mover = rng.pick(later);
  const value = pickValue(pick.no!);
  const theirs = league.picks.filter(k => k.owner === mover.owner && k.id !== mover.id && (k.season > pick.season || (k.season === pick.season && (k.no ?? 999) > (mover.no ?? 0))))
    .sort((a, b) => pickTradeValue(league, b) - pickTradeValue(league, a));
  const give = [mover];
  let total = pickValue(mover.no!);
  // Add the smallest extra picks that close the gap (a little over chart value).
  for (const k of [...theirs].reverse()) { if (total >= value * 1.04) break; if (pickTradeValue(league, k) + total >= value * 1.04) { give.push(k); total += pickTradeValue(league, k); break; } }
  for (const k of theirs) { if (total >= value * 1.04 || give.length >= 4) break; if (!give.includes(k)) { give.push(k); total += pickTradeValue(league, k); } }
  if (total < value * 1.04 || total > value * 1.6) return false;
  const seller = pick.owner;
  pick.owner = mover.owner;
  for (const k of give) k.owner = seller;
  const lbl = (k: Pick) => (k.no && k.season === pick.season ? `No. ${k.no}` : pickLabel(league, k));
  news(league, 'trade', `DRAFT-DAY TRADE: ${league.teams[mover.owner].nick} move up to No. ${pick.no}, sending ${give.map(lbl).join(', ')} to the ${league.teams[seller].nick}.`, [mover.owner, seller], { big: pick.no! <= 10 });
  return true;
}

/** Team mode follows roster strength and age. */
export function updateModes(league: League) {
  const ranked = Object.keys(league.teams).map(t => [t, teamRatings(league, t).ovr] as const).sort((a, b) => b[1] - a[1]);
  ranked.forEach(([t], i) => { league.teams[t].mode = i < 10 ? 'contend' : i >= 22 ? 'rebuild' : 'balanced'; });
}
export { yearsLeft };
