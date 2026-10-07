// Contract talks with the player's agent. Each agent has a style that sets how
// much he opens above his client's walk-away number, how fast he concedes and how
// many bad offers he will sit through. Offers are judged on the player's own
// terms (offerScore: money, guarantees, length, bonus cash and motivations), the
// walk-away point moves with leverage (rival offers, mood, the market), and lowballs
// cost patience twice over. Talks that break down stay closed for a while.
import type { League, Player, Pos } from './types';
import { clamp, hash } from './rng';
import { apy as contractApy, capHit, capSpace, makeContract, marketValue, money, yearsLeft } from './contracts';
import { askingPrice, offerScore, signPlayer, contenderScore, startingChance, schemeFit, type Offer } from './offseason';

export type AgentStyle = 'Hardball' | 'Balanced' | 'Player-First';
export interface Agent { name: string; agency: string; style: AgentStyle; patience: number }
export interface TalkLine { by: 'you' | 'agent' | 'note'; text: string; offer?: Offer }
export interface Talk { key: string; patience: number; target: number; demand: Offer; log: TalkLine[]; closed?: boolean; agreed?: boolean; /** Score of your last offer. */ last?: number }

const FIRST = ['Drew', 'David', 'Chris', 'Tom', 'Mike', 'Jimmy', 'Nicole', 'Erik', 'Kevin', 'Brian', 'Mark', 'Jason', 'Ryan', 'Andre', 'Malik', 'Sean', 'Joel', 'Todd', 'Ari', 'Leigh'];
const LAST = ['Condon', 'Mulugheta', 'Segal', 'Dogra', 'Burkhardt', 'Steinberg', 'Lynn', 'Kapadia', 'Fletcher', 'Wexler', 'Okafor', 'Barrett', 'Holt', 'Vance', 'Reyes', 'Kimura', 'Castellano', 'Pryor', 'Abrams', 'Sutter'];
const AGENCY = ['Apex Sports Group', 'Paramount Athletes', 'Summit Sports Management', 'Gridiron Partners', 'Blue Line Representation', 'Meridian Sports', 'Ironclad Agency', 'Northstar Athletes', 'Vantage Sports', 'Keystone Talent'];

export function agentFor(p: Player): Agent {
  const h = hash(p.id + 'agent');
  const r = (n: number, k: number) => Math.floor(((h >>> k) % 1000) / 1000 * n);
  // Stars tend to have the hard-nosed agents.
  const style: AgentStyle = p.ovr >= 86 ? (r(10, 3) < 6 ? 'Hardball' : 'Balanced') : (['Hardball', 'Balanced', 'Balanced', 'Player-First'] as const)[r(4, 5)];
  const fn = FIRST[r(FIRST.length, 2)];
  return { name: `${fn} ${LAST[r(LAST.length, 7)]}`, agency: AGENCY[r(AGENCY.length, 11)], style, patience: style === 'Hardball' ? 3 : style === 'Balanced' ? 4 : 5 };
}

const OPEN_PREMIUM: Record<AgentStyle, number> = { Hardball: 0.12, Balanced: 0.09, 'Player-First': 0.06 };
const CONCEDE: Record<AgentStyle, number> = { Hardball: 0.28, Balanced: 0.4, 'Player-First': 0.52 };

/** Rival offers on the table in free agency (the agent will use them). */
function bestRival(league: League, p: Player) {
  const list = (league.fa?.offers[p.id] ?? []).filter(o => o.team !== league.user);
  let best: (typeof list)[number] | undefined, bv = 0;
  for (const o of list) { const v = offerScore(league, p, o, o.team); if (v > bv) { bv = v; best = o; } }
  return best ? { offer: best, score: bv } : undefined;
}

/** The lowest offer score he would accept today. */
export function walkAway(league: League, p: Player) {
  const a = agentFor(p);
  let floor = a.style === 'Hardball' ? 0.97 : a.style === 'Balanced' ? 0.94 : 0.91;
  if (p.morale < 45) floor += 0.04;
  if (p.morale > 80) floor -= 0.02;
  if (league.phase === 'freeagency') {
    floor -= Math.min(0.12, ((league.fa?.day ?? 1) - 1) * 0.02); // the market dries up
    const r = bestRival(league, p);
    if (r) floor = Math.max(floor, r.score + 0.02);
  }
  if (league.phase === 'regular' && p.team === 'FA') floor -= 0.1; // unsigned in-season: wants a job
  return floor;
}

const ctx = (league: League) => `${league.season}-${league.phase}-${league.phase === 'freeagency' ? league.fa?.day : league.phase === 'regular' ? league.week : ''}`;
const ctxPhase = (league: League) => `${league.season}-${league.phase}`;

/** Open (or resume) talks. Breakdowns last the rest of the phase. */
export function talkFor(league: League, p: Player): Talk {
  const all = (league.talks ??= {});
  const t = all[p.id];
  if (t && (t.key === ctx(league) || (t.closed && t.key.startsWith(ctxPhase(league))))) return t;
  const a = agentFor(p);
  const target = walkAway(league, p) + OPEN_PREMIUM[a.style];
  const ask = askingPrice(league, p);
  const demand = solveFor(league, p, { ...ask, bonus: 0.6, voids: 0 }, target);
  const fresh: Talk = { key: ctx(league), patience: t && !t.agreed && t.key.startsWith(ctxPhase(league)) ? t.patience : a.patience, target, demand, log: [] };
  fresh.log.push({ by: 'agent', text: opener(league, p, a, demand), offer: demand });
  all[p.id] = fresh;
  return fresh;
}

/** Adjust APY until the offer scores `target` for him, keeping the other terms. */
export function solveFor(league: League, p: Player, base: Offer, target: number): Offer {
  let lo = base.apy * 0.3, hi = base.apy * 2.2;
  for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; (offerScore(league, p, { ...base, apy: m }, league.user) < target ? (lo = m) : (hi = m)); }
  return { ...base, apy: Math.round(hi / 50_000) * 50_000 };
}

export type Verdict = { kind: 'accept' | 'counter' | 'stand' | 'walk' | 'closed' | 'cap'; text: string; counter?: Offer };

/**
 * Put an offer in front of the agent. In free agency an offer he does not accept
 * outright can still stand on the table and be weighed at the end of the day.
 */
export function submit(league: League, p: Player, offer: Offer, opts: { extend?: boolean } = {}): Verdict {
  const t = talkFor(league, p);
  const a = agentFor(p);
  if (t.closed) return { kind: 'closed', text: `${a.name} isn't taking calls. Talks are off for now.` };
  // An extension leaves this year's hit alone; a new deal has to fit under this year's cap.
  const hitNow = opts.extend ? 0 : capPreview(league, p, offer)[0]?.hit ?? offer.apy;
  if (hitNow > capSpace(league, league.user)) return { kind: 'cap', text: `That deal would put you ${money(hitNow - capSpace(league, league.user))} over the cap this year.` };
  t.log.push({ by: 'you', text: describe(offer), offer });
  const score = offerScore(league, p, offer, league.user);
  const floor = walkAway(league, p);
  if (score >= t.target - 0.004) {
    t.agreed = true;
    const text = pick(p, t.log.length, [`We have a deal. ${p.fn} is fired up.`, `Done. Send the paperwork over.`, `That works for us. Pleasure doing business.`, `${p.fn} said yes. Congratulations.`]);
    t.log.push({ by: 'agent', text });
    signPlayer(league, p, league.user, offer, opts);
    return { kind: 'accept', text };
  }
  const insult = score < floor - 0.14;
  // Lowballs burn patience twice; a serious offer that keeps moving costs nothing.
  const serious = score >= floor - 0.06 && score > (t.last ?? 0) + 0.008;
  t.last = score;
  t.patience -= insult ? 2 : serious ? 0 : 1;
  if (insult) p.morale = clamp(p.morale - 6, 0, 100);
  if (t.patience <= 0) {
    t.closed = true;
    const text = pick(p, t.log.length, [`We're done here. ${p.fn} will look elsewhere.`, `I've told ${p.fn} you aren't serious. We'll talk another time.`, `This isn't going anywhere. Talks are over.`]);
    t.log.push({ by: 'agent', text });
    p.morale = clamp(p.morale - 5, 0, 100);
    return { kind: 'walk', text };
  }
  // Concede part of the gap, never below the walk-away number.
  t.target = Math.max(floor, t.target - (t.target - score) * CONCEDE[a.style] * (insult ? 0.3 : 1));
  const counter = solveFor(league, p, { ...offer }, t.target);
  t.demand = counter;
  const text = insult ? pick(p, t.log.length, [`That's insulting. My client is ${/^(8|11$|18$)/.test(String(p.ovr)) ? 'an' : 'a'} ${p.ovr} and you know it.`, `Come on. That's not a real offer.`, `I'm not taking that to ${p.fn}.`])
    : counterLine(league, p, offer, counter, t.log.length);
  t.log.push({ by: 'agent', text, offer: counter });
  if (league.phase === 'freeagency' && score >= floor && !insult) {
    // Good enough to be in the running: it stands until he decides.
    const list = (league.fa!.offers[p.id] ??= []).filter(o => o.team !== league.user);
    list.push({ team: league.user, ...offer, day: league.fa!.day });
    league.fa!.offers[p.id] = list;
    t.log.push({ by: 'note', text: 'Your offer is on the table. He decides at the end of the day.' });
    return { kind: 'stand', text, counter };
  }
  return { kind: 'counter', text, counter };
}

function opener(league: League, p: Player, a: Agent, d: Offer) {
  const comps = topContracts(league, p.pos, 5);
  const rank = comps.filter(c => c.apy > d.apy).length + 1;
  const tail = rank <= 5 ? ` That would make him the No. ${rank} paid ${p.pos} in the league, which is where he belongs.` : '';
  const style = a.style === 'Hardball' ? `We're not here for a discount.` : a.style === 'Balanced' ? `We want to get something done.` : `${p.fn} wants to make this work.`;
  return `${style} We're looking at ${describe(d)}.${tail}`;
}
function counterLine(league: League, p: Player, mine: Offer, c: Offer, n: number) {
  const gap = c.apy - mine.apy;
  const bits: string[] = [];
  if (gap > 0) bits.push(`we need about ${money(gap)} more a year`);
  if (mine.gtd < c.gtd - 0.05) bits.push('the guarantees have to come up');
  if (p.age >= 29 && mine.years < askingPrice(league, p).years) bits.push(`${p.fn} wants security, not a prove-it deal`);
  const head = pick(p, n, ['Closer.', 'We are moving.', `I'll take it to ${p.fn}, but`, 'Not there yet.']);
  const body = bits.length ? bits.join(', ') : 'the structure needs work';
  const joined = head.endsWith(',') || head.endsWith('but') ? `${head} ${body}` : `${head} ${body[0].toUpperCase()}${body.slice(1)}`;
  return `${joined}. We could do ${describe(c)}.`;
}
const pick = (p: Player, n: number, xs: string[]) => xs[(hash(p.id + n) >>> 0) % xs.length];
export const describe = (o: Offer) => `${o.years} yr${o.years > 1 ? 's' : ''}, ${money(o.apy * o.years)} (${money(o.apy)}/yr), ${Math.round(o.gtd * 100)}% guaranteed`;

/** Cap hit by season for an offer, plus space left this season. */
export function capPreview(league: League, p: Player, o: Offer, extend?: boolean) {
  const c = makeContract(league.season, o.years, o.apy, o.gtd, { exp: p.exp, bonusShare: o.bonus ?? 0.55, voids: o.voids });
  const shift = extend ? p.contract.years.filter(y => y.s === league.season && !y.v).length : 0;
  return c.years.map(y => ({ s: y.s + shift, hit: y.base + y.bonus, base: y.base, bonus: y.bonus, gtd: y.gtd + y.bonus, v: !!y.v }));
}

/** Highest-paid players at a position by APY (the comps an agent brings up). */
export function topContracts(league: League, pos: Pos, n = 6) {
  return Object.values(league.players).filter(q => q.pos === pos && q.team !== 'FA' && q.status !== 'RET' && yearsLeft(q.contract, league.season) > 0)
    .map(q => ({ p: q, apy: contractApy(q.contract) })).sort((a, b) => b.apy - a.apy).slice(0, n);
}

/** What he weighs about your team, for the negotiation screen. */
export function pitch(league: League, p: Player, team: string) {
  const t = league.teams[team];
  const rows: { k: string; good: number }[] = [];
  for (const m of p.motiv) {
    const good = m === 'Contender' ? contenderScore(league, team) : m === 'Starting Role' ? startingChance(league, p, team) : m === 'Scheme Fit' ? schemeFit(league, p, team)
      : m === 'Big Market' ? (t.market - 1) / 2 : m === 'Warm Weather' ? (t.warm ? 1 : 0) : m === 'Winning Culture' ? t.tradition : m === 'Loyalty' ? (p.team === team ? 1 : 0) : 0.5;
    rows.push({ k: m, good: clamp(good, 0, 1) });
  }
  return rows;
}

/** For the FA market board: suitors and who he is leaning toward. */
export function market(league: League, p: Player) {
  const offers = league.fa?.offers[p.id] ?? [];
  const scored = offers.map(o => ({ o, s: offerScore(league, p, o, o.team) })).sort((a, b) => b.s - a.s);
  return { offers: scored, leader: scored[0]?.o.team, heat: clamp(offers.length / 4 + (p.ovr - 70) / 40, 0, 1) };
}

export const currentApy = (p: Player) => contractApy(p.contract);
export const marketApy = (league: League, p: Player) => marketValue(p, league.season);
export const hitThisYear = (league: League, p: Player) => capHit(p.contract, league.season);
