import type { Club, Offer, Player, Pos, World } from './types';
import { ageOf, fairWage, marketValue, roundMoney } from './player';
import { clamp, rand, chance, pick, shuffle } from './rng';
import { removeFromTactic, sign, LEAGUES } from './world';
import { autoPick, slotRating, slotsOf } from './tactics';
import { dayOf, news } from './season';

export const windowOpen = (w: World) => w.day < dayOf(w.season, 9, 1) || (w.day >= dayOf(w.season, 1, 1) && w.day < dayOf(w.season, 2, 2));
export const transferWindow = windowOpen;
export const fmtMoney = (v: number) => {
  const a = Math.abs(v), sg = v < 0 ? '-' : '';
  if (a >= 1e9) return `${sg}€${(a / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${sg}€${(a / 1e6).toFixed(a >= 1e8 ? 0 : 1)}M`;
  if (a >= 1e3) return `${sg}€${Math.round(a / 1e3)}K`;
  return `${sg}€${Math.round(a)}`;
};

/** How important a player is to his club (0 fringe .. 1 franchise player). */
export function importance(w: World, p: Player): number {
  if (!p.club) return 0;
  const c = w.clubs[p.club];
  const sorted = c.squad.map(id => w.players[id]).filter(Boolean).sort((a, b) => b.ovr - a.ovr);
  const rank = sorted.findIndex(x => x.id === p.id);
  return rank < 0 ? 0 : rank < 3 ? 1 : rank < 11 ? 0.6 : rank < 16 ? 0.3 : 0.1;
}

export function askingPrice(w: World, p: Player): number {
  const v = marketValue(p, w.season);
  if (!p.club) return 0;
  const imp = importance(w, p);
  const yrs = p.contract - w.season;
  let f = 1.08 + imp * 0.45 + (yrs >= 3 ? 0.12 : 0) - (p.listed ? 0.25 : 0) + (ageOf(p, w.season) <= 22 ? 0.15 : 0);
  if (w.clubs[p.club].tier === 0 && ['saudi-arabia'].includes(w.clubs[p.club].country)) f += 0.1;
  const rc = p.release && p.release > 0 ? p.release : Infinity;
  return Math.min(roundMoney(v * f), rc);
}

/** Would this player even consider moving to `club`? */
export function interest(w: World, p: Player, club: Club): { ok: boolean; reason: string; score: number } {
  const cur = p.club ? w.clubs[p.club] : null;
  const age = ageOf(p, w.season);
  const lgW = (c: Club | null) => (c ? (LEAGUES.find(l => l.id === c.league)?.wealth ?? 0.5) : 0.3);
  let score = (club.rep - (cur?.rep ?? 50)) * 1.2 + (lgW(club) - lgW(cur)) * 10 + (p.morale < 45 ? 12 : 0) + (age >= 31 ? 10 : 0) + (club.tier === 1 ? 0 : -5);
  // will he play?
  const better = club.squad.map(id => w.players[id]).filter(x => x && x.pos === p.pos && x.ovr >= p.ovr + 2).length;
  score -= better * 6;
  if (!cur) score += 25;
  const ok = score > -18;
  const reason = ok ? (score > 10 ? 'Excited about the move' : 'Open to discussions') : better >= 2 ? 'Worried about playing time' : club.rep < (cur?.rep ?? 0) - 8 ? 'Not interested in a step down' : 'Happy at his current club';
  return { ok, reason, score };
}

export interface BidReply { status: 'accepted' | 'countered' | 'rejected'; counter?: number; reason: string }
export function evaluateBid(w: World, p: Player, fee: number, buyer: Club, loan = false): BidReply {
  if (!p.club) return { status: 'accepted', reason: 'Free agent' };
  const seller = w.clubs[p.club];
  if (loan) {
    const imp = importance(w, p);
    if (imp >= 0.6) return { status: 'rejected', reason: `${seller.name} see him as a key player and won't loan him out.` };
    return { status: 'accepted', reason: 'Loan agreed' };
  }
  if (p.release && fee >= p.release) return { status: 'accepted', reason: 'Release clause triggered' };
  const ask = askingPrice(w, p);
  const imp = importance(w, p);
  const age = ageOf(p, w.season);
  if (imp >= 1 && seller.rep >= buyer.rep + 6 && age < 30 && fee < ask * 1.4) return { status: 'rejected', reason: `${seller.name} consider ${p.name} untouchable.` };
  if (fee >= ask) return { status: 'accepted', reason: 'Bid accepted' };
  if (fee >= ask * 0.82) return { status: 'countered', counter: roundMoney(ask * (0.98 + rand() * 0.06)), reason: `${seller.name} want a little more.` };
  if (fee >= ask * 0.6) return { status: 'countered', counter: roundMoney(ask * 1.05), reason: `Some way short of their valuation.` };
  return { status: 'rejected', reason: `Nowhere near ${seller.name}'s valuation.` };
}

export interface Demand { wage: number; years: number; bonus: number; role: Player['role'] }
export function contractDemand(w: World, p: Player, club: Club, role: Player['role'] = 'Rotation'): Demand {
  const base = fairWage(p, club.rep, w.season);
  const rf = role === 'Key' ? 1.15 : role === 'First' ? 1.05 : role === 'Rotation' ? 1 : role === 'Prospect' ? 0.85 : 0.8;
  const cur = p.club === club.id ? Math.max(p.wage, base * 0.9) : base;
  const age = ageOf(p, w.season);
  const wage = Math.round(Math.max(cur * (p.club === club.id ? 1.05 : 1.12), base) * rf / 500) * 500;
  return { wage, years: age >= 31 ? 1 + Math.round(rand()) : age >= 28 ? 3 : 4 + Math.round(rand()), bonus: roundMoney(wage * 20), role };
}
/** Player's response to a contract offer. Returns a mood swing and whether he accepts. */
export function negotiate(w: World, p: Player, club: Club, offer: { wage: number; years: number; role: Player['role']; bonus: number }, demand: Demand): { accept: boolean; text: string; patience: number } {
  const ratio = offer.wage / demand.wage;
  const roleBonus = (offer.role === 'Key' ? 0.08 : offer.role === 'First' ? 0.04 : offer.role === 'Prospect' ? 0.02 : offer.role === 'Backup' ? -0.08 : 0);
  const bonusR = offer.bonus / Math.max(1, demand.bonus) * 0.05;
  const age = ageOf(p, w.season);
  const yearsOk = age >= 31 ? offer.years <= 3 || true : true;
  const score = ratio + roleBonus + bonusR + (offer.years > demand.years && age >= 30 ? 0.04 : 0);
  if (score >= 0.99 && yearsOk) return { accept: true, text: pick(['We have a deal!', 'He is happy with the terms.', "His agent says: 'Where do we sign?'"]), patience: 0 };
  if (score >= 0.9) return { accept: false, text: `Close. His agent is looking for around ${fmtMoney(demand.wage)} a week.`, patience: -1 };
  return { accept: false, text: `That offer is well below expectations (${fmtMoney(demand.wage)}/wk). The agent is losing patience.`, patience: -2 };
}

/** Move a player between clubs, settle money and write the record. */
export function completeTransfer(w: World, p: Player, to: Club, fee: number, wage?: number, years?: number, loan = false, role?: Player['role']) {
  const from = p.club ? w.clubs[p.club] : null;
  if (from) { from.balance += fee; from.budget += fee * (from.id === w.user ? 1 : 0.6); from.fin.transfersOut += fee; removeFromTactic(from, p.id); }
  to.balance -= fee; to.budget -= fee; to.fin.transfersIn += fee;
  const recordName = p.name;
  p.moved = w.season * 1000 + w.day;
  if (loan && from) {
    p.loan = { from: from.id, until: w.season + 1 };
    from.squad = from.squad.filter(x => x !== p.id);
    p.club = to.id; to.squad.push(p.id);
  } else {
    p.loan = undefined;
    sign(w, p, to, false, years, wage);
  }
  if (role) p.role = role;
  p.morale = clamp(p.morale + 12, 0, 100);
  w.transfers.unshift({ season: w.season, day: w.day, pid: p.id, name: recordName, from: from?.id ?? 'free', to: to.id, fee, loan, free: !from });
  if (w.transfers.length > 600) w.transfers.length = 600;
  w.offers.forEach(o => { if (o.pid === p.id && o.status === 'pending') o.status = 'withdrawn'; });
  w.shortlist = to.id === w.user ? w.shortlist.filter(x => x !== p.id) : w.shortlist;
  if (from && from.id !== w.user) autoPick(w, from);
  if (to.id !== w.user) autoPick(w, to);
}

// ---- AI market ---------------------------------------------------------------------------
function weakestSlot(w: World, c: Club): { pos: Pos; rating: number } | null {
  const slots = slotsOf(c.tactic);
  let worst: { pos: Pos; rating: number } | null = null;
  const avg = c.tactic.lineup.reduce((s, id, i) => s + (w.players[id] ? slotRating(w.players[id], slots[i][0]) : 50), 0) / slots.length;
  c.tactic.lineup.forEach((id, i) => {
    const p = w.players[id];
    const r = p ? slotRating(p, slots[i][0]) : 40;
    if (r < avg - 2 && (!worst || r < worst.rating)) worst = { pos: slots[i][0], rating: r };
  });
  return worst;
}

let marketCache: { day: number; list: Player[] } = { day: -1, list: [] };
function market(w: World) {
  if (marketCache.day !== w.day) marketCache = { day: w.day, list: Object.values(w.players).filter(p => p.club && !p.loan && w.clubs[p.club]?.tier !== 2) };
  return marketCache.list;
}

export function aiTransferDay(w: World) {
  const sumEnd = dayOf(w.season, 9, 1), janEnd = dayOf(w.season, 2, 2);
  const deadline = w.day === sumEnd - 1 || w.day === janEnd - 1;
  const clubs = shuffle(Object.values(w.clubs).filter(c => c.tier !== 2 && c.id !== w.user));
  const n = deadline ? 22 : w.day < 20 ? 4 : 7;
  for (const c of clubs.slice(0, n)) aiShop(w, c, deadline);
  // free agents get picked up
  if (w.freeAgents.length && chance(0.5)) {
    const fa = w.players[pick(w.freeAgents)];
    if (fa) {
      const takers = Object.values(w.clubs).filter(c => c.tier === 1 && c.id !== w.user && c.squad.length < 26 && Math.abs((24 + c.rep * 0.55) - fa.ovr) < 10);
      if (takers.length) { const c = pick(takers); completeTransfer(w, fa, c, 0, Math.round(fairWage(fa, c.rep, w.season) * 0.9 / 500) * 500, 1 + Math.round(rand() * 2)); }
    }
  }
}

function aiShop(w: World, c: Club, deadline: boolean) {
  if (c.budget < 1e6 && c.squad.length >= 22) return;
  const need = weakestSlot(w, c);
  const pos = need?.pos ?? (c.squad.length < 22 ? pick(['CB', 'CM', 'ST', 'GK'] as Pos[]) : null);
  if (!pos) return;
  const minOvr = Math.round((need?.rating ?? 60) + 2);
  const budget = c.budget * (deadline ? 0.95 : 0.7);
  const cands = market(w).filter(p => p.club && w.clubs[p.club] && p.club !== c.id && (p.pos === pos || p.alt.includes(pos)) && p.ovr >= minOvr && ageOf(p, w.season) <= 32 && !p.inj && !(p.moved && p.moved > w.season * 1000 - 200));
  const scored: [Player, number, number][] = [];
  for (const p of cands) {
    const seller = w.clubs[p.club!];
    if (seller.rep > c.rep + 6) continue;
    const price = askingPrice(w, p);
    if (price > budget) continue;
    if (p.wage > c.wageBudget * 0.14 && p.ovr < 85) continue;
    const it = interest(w, p, c);
    if (!it.ok) continue;
    scored.push([p, price, (p.ovr - minOvr) * 3 + (p.pot - p.ovr) * 0.8 - price / 1e7 + it.score * 0.2 + rand() * 6]);
  }
  if (!scored.length) return;
  scored.sort((a, b) => b[2] - a[2]);
  const [p, price] = scored[Math.floor(rand() * Math.min(3, scored.length))];
  const fee = roundMoney(price * (0.92 + rand() * 0.16));
  if (p.club === w.user) {
    if (w.offers.some(o => o.pid === p.id && o.status === 'pending')) return;
    const o: Offer = { id: w.nextOffer++, pid: p.id, from: c.id, to: w.user, fee, status: 'pending', day: w.day, userBuying: false };
    w.offers.push(o);
    news(w, 'offer', `${c.name} bid ${fmtMoney(fee)} for ${p.name}`, `${c.name} have submitted an offer of ${fmtMoney(fee)} for ${p.name} (valued at ${fmtMoney(marketValue(p, w.season))}). Accept, reject or negotiate in Transfers.`, { pid: p.id, offerId: o.id, club: c.id });
    return;
  }
  const reply = evaluateBid(w, p, fee, c);
  const finalFee = reply.status === 'accepted' ? fee : reply.status === 'countered' && reply.counter! <= budget * 1.05 && chance(0.7) ? reply.counter! : 0;
  if (!finalFee) return;
  const from = w.clubs[p.club!];
  completeTransfer(w, p, c, finalFee, Math.round(Math.max(p.wage * 1.15, fairWage(p, c.rep, w.season)) / 500) * 500, ageOf(p, w.season) > 29 ? 2 : 4);
  if (p.ovr >= 80 || finalFee >= 30e6) news(w, 'transfer', `${p.name} joins ${c.name}`, `${c.name} complete the signing of ${p.name} from ${from.name} for ${fmtMoney(finalFee)}.`, { pid: p.id, club: c.id });
  // seller reinvests: maybe sign a replacement later; trim if too big
  if (c.squad.length > 28) {
    const surplus = c.squad.map(id => w.players[id]).sort((a, b) => a.ovr - b.ovr)[0];
    if (surplus) { c.squad = c.squad.filter(x => x !== surplus.id); removeFromTactic(c, surplus.id); surplus.club = null; w.freeAgents.push(surplus.id); }
  }
}

/** Respond to a bid the user received. */
export function respondOffer(w: World, o: Offer, action: 'accept' | 'reject' | 'counter', counter?: number) {
  const p = w.players[o.pid];
  const buyer = w.clubs[o.from];
  if (!p || p.club !== w.user) { o.status = 'withdrawn'; return 'The player is no longer at the club.'; }
  if (action === 'reject') { o.status = 'rejected'; p.morale = clamp(p.morale - (interest(w, p, buyer).score > 15 ? 10 : 0), 0, 100); return `You rejected ${buyer.name}'s bid.`; }
  if (action === 'counter') {
    const max = o.fee * (1.12 + rand() * 0.25);
    if (counter! <= max && buyer.budget >= counter!) { o.fee = counter!; action = 'accept'; }
    else { o.status = 'rejected'; return `${buyer.name} refuse to go that high and walk away.`; }
  }
  if (action === 'accept') {
    o.status = 'done';
    completeTransfer(w, p, buyer, o.fee, Math.round(Math.max(p.wage * 1.15, fairWage(p, buyer.rep, w.season)) / 500) * 500, 4);
    news(w, 'transfer', `${p.name} sold to ${buyer.name}`, `${p.name} leaves for ${fmtMoney(o.fee)}.`, { pid: p.id });
    return `${p.name} has joined ${buyer.name} for ${fmtMoney(o.fee)}.`;
  }
  return '';
}

export function aiRenewals(w: World) {
  for (const c of Object.values(w.clubs)) {
    if (c.id === w.user || c.tier === 2) continue;
    const sorted = c.squad.map(id => w.players[id]).filter(Boolean).sort((a, b) => b.ovr - a.ovr);
    const keepLine = sorted[Math.min(17, sorted.length - 1)]?.ovr ?? 0;
    for (const p of sorted) {
      if (p.contract > w.season) continue;
      const age = ageOf(p, w.season + 1);
      if ((p.ovr >= keepLine || p.pot >= keepLine + 6) && age <= 34 && chance(0.85)) {
        p.contract = w.season + 1 + (age >= 31 ? 1 : 2 + Math.round(rand() * 2));
        p.wage = Math.round(Math.max(p.wage, fairWage(p, c.rep, w.season + 1)) / 500) * 500;
      }
    }
  }
}

/** Contracts that ran out leave for free. */
export function expireContracts(w: World, nextSeason: number) {
  for (const p of Object.values(w.players)) {
    if (!p.club) continue;
    if (p.loan && p.loan.until <= nextSeason) {
      const home = w.clubs[p.loan.from];
      const cur = w.clubs[p.club];
      cur.squad = cur.squad.filter(x => x !== p.id); removeFromTactic(cur, p.id);
      p.club = home.id; home.squad.push(p.id); p.loan = undefined;
      continue;
    }
    if (p.contract >= nextSeason) continue;
    const c = w.clubs[p.club];
    if (!c || c.tier === 2) continue;
    c.squad = c.squad.filter(x => x !== p.id); removeFromTactic(c, p.id);
    if (c.id === w.user) news(w, 'contract', `${p.name} leaves on a free`, `${p.name}'s contract has expired and he has left the club.`, { pid: p.id });
    p.club = null; p.wage = 0;
    w.freeAgents.push(p.id);
  }
}

export function releasePlayer(w: World, p: Player) {
  const c = w.clubs[p.club!];
  const owed = p.wage * 52 * Math.max(0, p.contract - w.season) * 0.5;
  c.balance -= owed;
  c.squad = c.squad.filter(x => x !== p.id); removeFromTactic(c, p.id);
  p.club = null; p.wage = 0; w.freeAgents.push(p.id);
  news(w, 'contract', `${p.name} released`, `${p.name}'s contract was terminated. Compensation paid: ${fmtMoney(owed)}.`, { pid: p.id });
  return owed;
}
