import type { Club, Competition, Fixture, MatchStats, NewsItem, Player, Tie, World } from './types';
import { emptyStats } from './types';
import { Match, poissonScore } from './engine';
import { autoPick, teamRatings } from './tactics';
import { clamp, rand, shuffle, chance, pick, gauss } from './rng';
import { LEAGUES, fillSquad, genPlayer, leagueLogo, natFor, setupFinances, squadLevel } from './world';
import { ageOf, develop, marketValue, rollPotential, fairWage } from './player';
import { aiTransferDay, aiRenewals, expireContracts, transferWindow } from './transfers';

// ---- calendar ------------------------------------------------------------------------
export const dateOf = (w: { season: number }, day: number) => new Date(Date.UTC(w.season, 6, 1 + day));
export const dayOf = (season: number, m: number, d: number) => Math.round((Date.UTC(m < 7 ? season + 1 : season, m - 1, d) - Date.UTC(season, 6, 1)) / 864e5);
export const fmtDate = (w: { season: number }, day: number, long = false) => dateOf(w, day).toLocaleDateString('en-GB', long ? { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' } : { day: 'numeric', month: 'short', timeZone: 'UTC' });
export const SEASON_END = (season: number) => dayOf(season, 6, 5);
const nextDow = (season: number, day: number, dow: number) => { let d = day; while (dateOf({ season }, d).getUTCDay() !== dow) d++; return d; };

export const COMP_NAMES = {
  ucl: { name: 'Champions League', short: 'UCL', color: '#0a1f5c' },
  uel: { name: 'Europa League', short: 'UEL', color: '#f26a1b' },
};
export const CUP_NAMES: Record<string, string> = { england: 'FA Cup', spain: 'Copa del Rey', germany: 'DFB-Pokal', italy: 'Coppa Italia', france: 'Coupe de France' };

function leagueSlots(season: number, n: number): number[] {
  const start = nextDow(season, dayOf(season, 8, 14), 6);
  const end = dayOf(season, 5, 23);
  const breaks = [dayOf(season, 9, 5), dayOf(season, 10, 10), dayOf(season, 11, 14), dayOf(season + 0, 3, 27)];
  const sats: number[] = [];
  for (let d = start; d <= end; d += 7) if (!breaks.some(b => Math.abs(b - d) <= 3)) sats.push(d);
  const extra = [nextDow(season, dayOf(season, 12, 29), 2), nextDow(season, dayOf(season, 4, 20), 2), nextDow(season, dayOf(season, 2, 9), 2), nextDow(season, dayOf(season, 10, 27), 2)];
  let slots = [...sats];
  for (const e of extra) if (slots.length < n) slots.push(e);
  slots.sort((a, b) => a - b);
  while (slots.length > n) { const i = Math.floor(slots.length * (0.15 + rand() * 0.7)); slots.splice(i, 1); }
  return slots;
}

/** Double round robin by the circle method, alternating home and away. */
function roundRobin(teams: string[]): [string, string][][] {
  const t = [...teams];
  if (t.length % 2) t.push('BYE');
  const n = t.length, rounds: [string, string][][] = [];
  for (let r = 0; r < n - 1; r++) {
    const rd: [string, string][] = [];
    for (let i = 0; i < n / 2; i++) {
      const a = t[i], b = t[n - 1 - i];
      if (a === 'BYE' || b === 'BYE') continue;
      rd.push((r + i) % 2 === 0 ? [a, b] : [b, a]);
    }
    rounds.push(rd);
    t.splice(1, 0, t.pop()!);
  }
  const second = rounds.map(rd => rd.map(([a, b]) => [b, a] as [string, string]));
  return [...rounds, ...second];
}

export function addFixture(w: World, f: Omit<Fixture, 'id'>) { const fx = { ...f, id: w.nextFx++ }; w.fixtures.push(fx); return fx; }

export function news(w: World, kind: NewsItem['kind'], title: string, body: string, extra: Partial<NewsItem> = {}) {
  w.news.unshift({ id: w.nextNews++, day: w.day, season: w.season, kind, title, body, ...extra });
  if (w.news.length > 220) w.news.length = 220;
}

// ---- season setup ---------------------------------------------------------------------
export function startSeason(w: World, ranks?: Record<string, string[]>) {
  w.fixtures = []; w.comps = {}; w.day = 0;
  for (const p of Object.values(w.players)) { p.s = emptyStats(); p.cs = {}; p.yel = 0; p.ban = 0; }
  for (const c of Object.values(w.clubs)) { c.form = []; c.fin = { tv: 0, gate: 0, prize: 0, merch: 0, transfersIn: 0, transfersOut: 0, wages: 0 }; }
  for (const lg of LEAGUES.filter(l => l.tier === 1)) {
    const teams = Object.values(w.clubs).filter(c => c.league === lg.id).map(c => c.id);
    const comp: Competition = { id: lg.id, name: lg.name, short: lg.short, kind: 'league', country: lg.country, teams, logo: leagueLogo(lg.id), color: lg.color, ties: [] };
    w.comps[lg.id] = comp;
    const rounds = roundRobin(shuffle([...teams]));
    const slots = leagueSlots(w.season, rounds.length);
    rounds.forEach((rd, i) => rd.forEach(([h, a]) => addFixture(w, { comp: lg.id, stage: `Matchday ${i + 1}`, day: slots[i], home: h, away: a })));
    // domestic cup: 16-team bracket after a preliminary round for the lower half
    const cupId = `cup-${lg.country}`;
    const order = ranks?.[lg.id] ?? [...teams].sort((a, b) => w.clubs[b].rep - w.clubs[a].rep);
    const cup: Competition = { id: cupId, name: CUP_NAMES[lg.country], short: CUP_NAMES[lg.country], kind: 'cup', country: lg.country, teams: [...teams], color: '#7a1f2b', ties: [] };
    w.comps[cupId] = cup;
    const prelimN = teams.length - 16;
    const seeded = order.slice(0, teams.length - prelimN * 2);
    const lower = shuffle(order.slice(teams.length - prelimN * 2));
    for (let i = 0; i < prelimN; i++) makeTie(w, cup, 'Preliminary Round', lower[i * 2], lower[i * 2 + 1], 1, dayOf(w.season, 9, 23));
    (cup as Competition & { seeded?: string[] }).seeded = seeded;
    if (prelimN === 0) drawCupRound(w, cup);
  }
  // Europe
  const leagueRanks = ranks ?? Object.fromEntries(LEAGUES.filter(l => l.tier === 1).map(l => [l.id, Object.values(w.clubs).filter(c => c.league === l.id).sort((a, b) => b.rep - a.rep).map(c => c.id)]));
  const worldEu = Object.values(w.clubs).filter(c => c.tier === 0 && !['saudi-arabia', 'usa', 'brazil', 'argentina'].includes(c.country)).sort((a, b) => clubPower(w, b) - clubPower(w, a)).map(c => c.id);
  const ucl: string[] = [], uel: string[] = [];
  for (const lg of LEAGUES.filter(l => l.tier === 1)) { const r = leagueRanks[lg.id] ?? []; ucl.push(...r.slice(0, lg.ucl)); uel.push(...r.slice(lg.ucl, lg.ucl + lg.uel)); }
  ucl.push(...worldEu.slice(0, 36 - ucl.length));
  const restWorld = worldEu.filter(id => !ucl.includes(id));
  let k = 2;
  uel.push(...restWorld.slice(0, Math.max(0, 36 - uel.length)));
  while (uel.length < 36 && k < 12) {
    for (const lg of LEAGUES.filter(l => l.tier === 1)) { const r = leagueRanks[lg.id] ?? []; const id = r[lg.ucl + k]; if (id && !uel.includes(id) && uel.length < 36) uel.push(id); }
    k++;
  }
  for (const [id, teams] of [['ucl', ucl], ['uel', uel]] as const) {
    const meta = COMP_NAMES[id];
    const comp: Competition = { id, name: meta.name, short: meta.short, kind: 'europe', teams: [...teams], color: meta.color, ties: [], phase: 'league' };
    w.comps[id] = comp;
    const sorted = [...teams].sort((a, b) => clubPower(w, w.clubs[b]) - clubPower(w, w.clubs[a]));
    // interleave pots so each team meets a spread of strengths
    const pots = [0, 1, 2, 3].map(i => shuffle(sorted.slice(i * 9, i * 9 + 9)));
    const order: string[] = [];
    for (let i = 0; i < 9; i++) for (const p of pots) if (p[i]) order.push(p[i]);
    const rounds = roundRobin(order).slice(0, 8);
    const dates = id === 'ucl' ? [[9, 15], [9, 29], [10, 20], [11, 3], [11, 24], [12, 8], [1, 19], [1, 26]] : [[9, 17], [10, 1], [10, 22], [11, 5], [11, 26], [12, 10], [1, 21], [1, 28]];
    rounds.forEach((rd, i) => rd.forEach(([h, a]) => addFixture(w, { comp: id, stage: `League Phase MD ${i + 1}`, day: dayOf(w.season, dates[i][0], dates[i][1]), home: h, away: a })));
  }
  w.fixtures.sort((a, b) => a.day - b.day);
  // board objectives
  setObjectives(w);
  for (const c of Object.values(w.clubs)) if (c.tier !== 2) autoPick(w, c);
}

export function clubPower(w: World, c: Club) { return c.tier === 2 ? (c.strength ?? 60) : teamRatings(w, c).ovr + c.rep * 0.05; }

function makeTie(w: World, comp: Competition, round: string, a: string, b: string, legs: 1 | 2, day: number, day2?: number, neutral = false): Tie {
  const tie: Tie = { id: comp.ties.length + 1, comp: comp.id, round, a, b, legs, fx: [] };
  comp.ties.push(tie);
  const f1 = addFixture(w, { comp: comp.id, stage: legs === 2 ? `${round} · Leg 1` : round, day, home: a, away: b, tie: tie.id, leg: 1, neutral });
  tie.fx.push(f1.id);
  if (legs === 2) { const f2 = addFixture(w, { comp: comp.id, stage: `${round} · Leg 2`, day: day2!, home: b, away: a, tie: tie.id, leg: 2 }); tie.fx.push(f2.id); }
  w.fixtures.sort((x, y) => x.day - y.day);
  return tie;
}

const CUP_ROUNDS: [string, number, number][] = [['Round of 16', 10, 28], ['Quarter-final', 1, 13], ['Semi-final', 3, 3], ['Final', 5, 26]];
function drawCupRound(w: World, cup: Competition) {
  const alive = cupAlive(w, cup);
  if (alive.length <= 1) return;
  const idx = alive.length >= 16 ? 0 : alive.length >= 8 ? 1 : alive.length >= 4 ? 2 : 3;
  const [round, m, d] = CUP_ROUNDS[idx];
  const pool = shuffle([...alive]);
  for (let i = 0; i + 1 < pool.length; i += 2) makeTie(w, cup, round, pool[i], pool[i + 1], 1, dayOf(w.season, m, d), undefined, round === 'Final');
  news(w, 'info', `${cup.name}: ${round} draw`, pool.reduce((s, id, i) => s + (i % 2 ? ` v ${w.clubs[id].name}\n` : w.clubs[id].name), ''));
}
function cupAlive(w: World, cup: Competition): string[] {
  const seeded = (cup as Competition & { seeded?: string[] }).seeded ?? [];
  const lastRound = cup.ties.length ? cup.ties[cup.ties.length - 1].round : '';
  if (!lastRound) return seeded;
  const winners = cup.ties.filter(t => t.round === lastRound).map(t => t.winner!).filter(Boolean);
  return lastRound === 'Preliminary Round' ? [...seeded, ...winners] : winners;
}

// ---- tables ------------------------------------------------------------------------------
export interface Row { id: string; p: number; w: number; d: number; l: number; gf: number; ga: number; pts: number; form: string[] }
export function table(w: World, compId: string, stage?: string): Row[] {
  const comp = w.comps[compId];
  const rows = new Map<string, Row>();
  for (const id of comp.teams) rows.set(id, { id, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0, form: [] });
  for (const f of w.fixtures) {
    if (f.comp !== compId || !f.res || f.tie) continue;
    if (stage && !f.stage.startsWith(stage)) continue;
    const h = rows.get(f.home), a = rows.get(f.away);
    if (!h || !a) continue;
    const { hg, ag } = f.res;
    h.p++; a.p++; h.gf += hg; h.ga += ag; a.gf += ag; a.ga += hg;
    if (hg > ag) { h.w++; a.l++; h.pts += 3; h.form.push('W'); a.form.push('L'); }
    else if (hg < ag) { a.w++; h.l++; a.pts += 3; h.form.push('L'); a.form.push('W'); }
    else { h.d++; a.d++; h.pts++; a.pts++; h.form.push('D'); a.form.push('D'); }
  }
  return [...rows.values()].sort((x, y) => y.pts - x.pts || (y.gf - y.ga) - (x.gf - x.ga) || y.gf - x.gf || w.clubs[y.id].rep - w.clubs[x.id].rep);
}

// ---- playing fixtures -------------------------------------------------------------------
export function tieAggregate(w: World, fx: Fixture): [number, number] | undefined {
  if (!fx.tie || fx.leg !== 2) return undefined;
  const tie = w.comps[fx.comp].ties.find(t => t.id === fx.tie)!;
  const f1 = w.fixtures.find(f => f.id === tie.fx[0]);
  if (!f1?.res) return undefined;
  // leg-1 home side is this match's away side
  return [f1.res.ag, f1.res.hg];
}
export function matchOpts(w: World, fx: Fixture) {
  const ko = !!fx.tie && (fx.leg === 2 || w.comps[fx.comp].ties.find(t => t.id === fx.tie)?.legs === 1);
  return { knockout: ko, aggregate: tieAggregate(w, fx), neutral: fx.neutral, compName: w.comps[fx.comp]?.name };
}

export function playFixture(w: World, fx: Fixture) {
  const h = w.clubs[fx.home], a = w.clubs[fx.away];
  for (const c of [h, a]) if (c.tier === 2 && c.squad.length < 18) { fillSquad(w, c, 22); autoPick(w, c); }
  for (const c of [h, a]) if (c.id !== w.user) aiSelect(w, c, fx);
  const m = new Match(w, fx, { ...matchOpts(w, fx), userSide: null });
  const res = m.simToEnd();
  m.commit(res);
  recordResult(w, fx, res);
  return res;
}

/** AI team selection: rotate tired players, keep the best XI for big games. */
export function aiSelect(w: World, c: Club, _fx: Fixture) {
  autoPick(w, c);
}

export function recordResult(w: World, fx: Fixture, res: Fixture['res']) {
  fx.res = res!;
  const h = w.clubs[fx.home], a = w.clubs[fx.away];
  const r = res!;
  const hw = r.hg > r.ag || (r.pens && r.pens[0] > r.pens[1]), aw = r.ag > r.hg || (r.pens && r.pens[1] > r.pens[0]);
  h.form.push(hw ? 'W' : aw ? 'L' : 'D'); a.form.push(aw ? 'W' : hw ? 'L' : 'D');
  if (h.form.length > 10) h.form.shift(); if (a.form.length > 10) a.form.shift();
  // serve suspensions for players of both clubs who sat this one out
  for (const c of [h, a]) for (const id of c.squad) { const p = w.players[id]; if (p && p.ban > 0 && !r.lineups[0].includes(id) && !r.lineups[1].includes(id)) p.ban--; }
  // gate receipts
  const gate = (r.att ?? h.cap * 0.85) * (35 + h.rep * 0.9) * (fx.comp === 'ucl' ? 1.6 : 1);
  h.fin.gate += gate; h.balance += gate;
  const comp = w.comps[fx.comp];
  if (comp?.kind === 'europe') {
    const prize = fx.comp === 'ucl' ? 2.1e6 : 0.45e6;
    if (r.hg > r.ag) { h.fin.prize += prize; h.balance += prize; } else if (r.ag > r.hg) { a.fin.prize += prize; a.balance += prize; } else { for (const c of [h, a]) { c.fin.prize += prize / 3; c.balance += prize / 3; } }
  }
  if (fx.tie) resolveTie(w, fx);
  if (fx.home === w.user || fx.away === w.user) userResultEffects(w, fx);
}

function resolveTie(w: World, fx: Fixture) {
  const comp = w.comps[fx.comp];
  const tie = comp.ties.find(t => t.id === fx.tie)!;
  const r = fx.res!;
  if (tie.legs === 1) tie.winner = r.pens ? (r.pens[0] > r.pens[1] ? fx.home : fx.away) : r.hg > r.ag ? fx.home : fx.away;
  else if (fx.leg === 2) {
    const agg = tieAggregate(w, fx)!;
    const hTot = r.hg + agg[0], aTot = r.ag + agg[1];
    tie.winner = r.pens ? (r.pens[0] > r.pens[1] ? fx.home : fx.away) : hTot > aTot ? fx.home : fx.away;
  }
  if (!tie.winner) return;
  if (tie.round === 'Final') {
    comp.winner = tie.winner;
    comp.phase = 'done';
    const club = w.clubs[tie.winner];
    club.trophies.push({ name: comp.name, season: w.season });
    const prize = comp.kind === 'europe' ? (comp.id === 'ucl' ? 25e6 : 8e6) : 4e6;
    club.balance += prize; club.fin.prize += prize;
    news(w, 'award', `${club.name} win the ${comp.name}!`, `${club.name} lift the ${comp.name} trophy after beating ${w.clubs[tie.a === tie.winner ? tie.b : tie.a].name} in the final.`, { club: club.id });
  }
}

/** Called once a day: draws for the next knockout rounds when a stage is complete. */
function progressCups(w: World) {
  for (const comp of Object.values(w.comps)) {
    if (comp.kind === 'cup') {
      if (comp.winner) continue;
      const last = comp.ties[comp.ties.length - 1];
      if (!last) { drawCupRound(w, comp); continue; }
      if (comp.ties.filter(t => t.round === last.round).every(t => t.winner) && last.round !== 'Final') drawCupRound(w, comp);
    } else if (comp.kind === 'europe') progressEurope(w, comp);
  }
}

const EU_DATES: Record<string, Record<string, [[number, number], [number, number]?]>> = {
  ucl: { playoff: [[2, 16], [2, 23]], r16: [[3, 9], [3, 16]], qf: [[4, 6], [4, 13]], sf: [[4, 27], [5, 4]], final: [[5, 29]] },
  uel: { playoff: [[2, 18], [2, 25]], r16: [[3, 11], [3, 18]], qf: [[4, 8], [4, 15]], sf: [[4, 29], [5, 6]], final: [[5, 19]] },
};
const ROUND_NAME: Record<string, string> = { playoff: 'Knockout Play-off', r16: 'Round of 16', qf: 'Quarter-final', sf: 'Semi-final', final: 'Final' };
function progressEurope(w: World, comp: Competition) {
  const d = EU_DATES[comp.id];
  if (comp.phase === 'league') {
    if (w.fixtures.some(f => f.comp === comp.id && !f.res)) return;
    const t = table(w, comp.id);
    (comp as Competition & { top8?: string[] }).top8 = t.slice(0, 8).map(r => r.id);
    const po = t.slice(8, 24).map(r => r.id);
    for (let i = 0; i < 8; i++) makeTie(w, comp, ROUND_NAME.playoff, po[15 - i], po[i], 2, dayOf(w.season, ...d.playoff[0]), dayOf(w.season, ...d.playoff[1]!));
    comp.phase = 'playoff';
    news(w, 'info', `${comp.name}: league phase complete`, `Top eight straight into the Round of 16: ${t.slice(0, 8).map(r => w.clubs[r.id].name).join(', ')}.`);
    return;
  }
  const order = ['playoff', 'r16', 'qf', 'sf', 'final'] as const;
  const cur = comp.phase as typeof order[number];
  if (cur === 'final' || comp.phase === 'done') return;
  const ties = comp.ties.filter(t => t.round === ROUND_NAME[cur]);
  if (!ties.length || !ties.every(t => t.winner)) return;
  const next = order[order.indexOf(cur) + 1];
  let alive = ties.map(t => t.winner!);
  if (cur === 'playoff') alive = [...((comp as Competition & { top8?: string[] }).top8 ?? []), ...shuffle(alive)];
  else alive = shuffle(alive);
  const dd = d[next];
  if (next === 'final') makeTie(w, comp, 'Final', alive[0], alive[1], 1, dayOf(w.season, ...dd[0]), undefined, true);
  else {
    const half = alive.length / 2;
    for (let i = 0; i < half; i++) cur === 'playoff' ? makeTie(w, comp, ROUND_NAME[next], alive[half + i], alive[i], 2, dayOf(w.season, ...dd[0]), dayOf(w.season, ...dd[1]!)) : makeTie(w, comp, ROUND_NAME[next], alive[i * 2], alive[i * 2 + 1], 2, dayOf(w.season, ...dd[0]), dayOf(w.season, ...dd[1]!));
  }
  comp.phase = next;
  news(w, 'info', `${comp.name}: ${ROUND_NAME[next]} draw`, comp.ties.filter(t => t.round === ROUND_NAME[next]).map(t => `${w.clubs[t.a].name} v ${w.clubs[t.b].name}`).join('\n'));
}

// ---- board & user -------------------------------------------------------------------------
export function setObjectives(w: World) {
  const u = w.clubs[w.user];
  if (!w.comps[u.league]) return;
  const rank = Object.values(w.clubs).filter(c => c.league === u.league).sort((a, b) => clubPower(w, b) - clubPower(w, a)).findIndex(c => c.id === u.id) + 1;
  const n = w.comps[u.league].teams.length;
  const lg = LEAGUES.find(l => l.id === u.league)!;
  let obj: string, target: number;
  if (rank === 1) { obj = 'Win the league'; target = 1; }
  else if (rank <= 3) { obj = `Finish in the top ${lg.ucl}  (Champions League)`; target = lg.ucl; }
  else if (rank <= 7) { obj = 'Qualify for Europe'; target = lg.ucl + lg.uel; }
  else if (rank <= n - 6) { obj = 'Finish in the top half'; target = Math.floor(n / 2); }
  else { obj = 'Avoid relegation'; target = n - lg.relegate; }
  w.board.objective = obj; w.board.objectiveRank = target;
  w.board.cupTarget = rank <= 4 ? 'Reach the semi-finals' : 'Reach the quarter-finals';
}

function userResultEffects(w: World, fx: Fixture) {
  const r = fx.res!;
  const home = fx.home === w.user;
  const gf = home ? r.hg : r.ag, ga = home ? r.ag : r.hg;
  const u = w.clubs[w.user], o = w.clubs[home ? fx.away : fx.home];
  const exp = (clubPower(w, u) - clubPower(w, o)) * 0.1 + (home ? 0.3 : -0.3);
  const won = gf > ga || (r.pens && (home ? r.pens[0] > r.pens[1] : r.pens[1] > r.pens[0]));
  const lost = gf < ga || (r.pens && !won);
  const delta = (won ? 3 : lost ? -3.5 : 0) - exp * 1.3 + (gf - ga) * 0.4;
  w.board.confidence = clamp(w.board.confidence + delta * 0.8, 0, 100);
  u.fans = clamp(u.fans + delta, 5, 100);
  for (const id of u.squad) {
    const p = w.players[id];
    if (!p) continue;
    const played = r.lineups[home ? 0 : 1].includes(id);
    p.morale = clamp(p.morale + (won ? 2 : lost ? -2 : 0) + (!played && p.role === 'Key' ? -3 : 0) + (!played && p.ovr >= teamRatings(w, u).ovr + 2 ? -1.5 : 0), 5, 100);
  }
  w.lastResultFx = fx.id;
}

// ---- daily loop -------------------------------------------------------------------------
export type Stop = { kind: 'match'; fx: Fixture } | { kind: 'event'; text: string } | { kind: 'seasonEnd' } | { kind: 'sacked' } | null;

/** Advance one day. Returns a reason to stop and hand control back to the player. */
export function advanceDay(w: World): Stop {
  const todays = w.fixtures.filter(f => f.day === w.day && !f.res);
  const mine = todays.find(f => f.home === w.user || f.away === w.user);
  if (mine) return { kind: 'match', fx: mine };
  for (const f of todays) {
    const h = w.clubs[f.home], a = w.clubs[f.away];
    if (!h || !a) { f.res = { hg: 0, ag: 0, events: [], stats: emptyMatchStats(), ratings: {}, motm: -1, lineups: [[], []] }; continue; }
    playFixture(w, f);
  }
  progressCups(w);
  dailyUpkeep(w);
  const wasWindow = transferWindow(w);
  if (wasWindow) aiTransferDay(w);
  w.day++;
  const stop = checkStops(w);
  if (w.day >= SEASON_END(w.season)) return { kind: 'seasonEnd' };
  return stop;
}

function checkStops(w: World): Stop {
  if (w.sacked) return { kind: 'sacked' };
  const pend = w.offers.find(o => !o.userBuying && o.to === w.user && o.status === 'pending' && o.day === w.day - 1);
  if (pend) return { kind: 'event', text: `Offer received for ${w.players[pend.pid]?.name}` };
  const sum = dayOf(w.season, 9, 1), jan = dayOf(w.season, 2, 1);
  if (w.day === sum - 1 || w.day === jan - 1) return { kind: 'event', text: 'Transfer Deadline Day' };
  return null;
}

export function emptyMatchStats(): MatchStats { return { poss: [50, 50], shots: [0, 0], sot: [0, 0], xg: [0, 0], passes: [0, 0], passAcc: [0, 0], corners: [0, 0], fouls: [0, 0], offsides: [0, 0], yellows: [0, 0], reds: [0, 0], tackles: [0, 0], saves: [0, 0] }; }

function dailyUpkeep(w: World) {
  const weekly = w.day % 7 === 0;
  const userClub = w.clubs[w.user];
  for (const p of Object.values(w.players)) {
    if (p.inj) { p.inj.days--; if (p.inj.days <= 0) { p.inj = undefined; if (p.club === w.user) news(w, 'injury', `${p.name} is back in training`, `${p.name} has recovered and is available for selection.`, { pid: p.id }); } }
    if (!p.club) continue;
    const club = w.clubs[p.club];
    if (!club || club.tier === 2) continue;
    const inten = club.id === w.user ? w.training.intensity : 50;
    p.fitness = clamp(p.fitness + 6.5 + club.facilities * 0.25 - inten * 0.03, 0, 100);
    if (weekly) {
      develop(p, w.season, 1, club.facilities + (club.id === w.user ? trainingBoost(w) : 0));
      if (p.morale > 70) p.morale -= 0.5; else if (p.morale < 60) p.morale += 0.8;
    }
  }
  if (weekly) {
    for (const c of Object.values(w.clubs)) {
      if (c.tier === 2) continue;
      const wages = c.squad.reduce((s, id) => s + (w.players[id]?.wage ?? 0), 0);
      c.balance -= wages; c.fin.wages += wages;
      const wealth = LEAGUES.find(l => l.id === c.league)?.wealth ?? 0.4;
      const tv = (1.2e6 + c.rep * 25000) * wealth;
      const merch = c.rep * c.rep * 25 * (0.6 + c.fans / 100);
      c.balance += tv + merch; c.fin.tv += tv; c.fin.merch += merch;
    }
    if (w.day % 28 === 0) boardReview(w);
  }
  // user-specific: injury news for own players
  for (const id of userClub.squad) {
    const p = w.players[id];
    if (p?.inj && p.inj.days > 0 && !(p as Player & { injNews?: boolean }).injNews) {
      (p as Player & { injNews?: boolean }).injNews = true;
      news(w, 'injury', `${p.name} injured`, `${p.name} has suffered a ${p.inj.name.toLowerCase()} and will be out for around ${Math.max(1, Math.round(p.inj.days / 7))} week(s).`, { pid: p.id });
    } else if (p && !p.inj) delete (p as Player & { injNews?: boolean }).injNews;
  }
}
function trainingBoost(w: World) { return w.training.intensity > 60 ? 1.5 : w.training.intensity < 35 ? -1 : 0.5; }

function boardReview(w: World) {
  const u = w.clubs[w.user];
  const comp = w.comps[u.league];
  if (!comp) return;
  const t = table(w, u.league);
  const pos = t.findIndex(r => r.id === u.id) + 1;
  const played = t[0]?.p ?? 0;
  if (played < 6) return;
  const gap = pos - w.board.objectiveRank;
  w.board.confidence = clamp(w.board.confidence - gap * 0.9 + (gap <= 0 ? 2 : 0), 0, 100);
  if (w.board.confidence < 20 && played > 12) {
    w.board.warnings++;
    if (w.board.warnings >= 3 || w.board.confidence < 6) {
      w.sacked = true;
      news(w, 'board', 'You have been relieved of your duties', `The ${u.name} board has lost patience after a run of poor results. Thank you for your service.`);
    } else news(w, 'board', 'Board warning', `The board is unhappy with ${pos}${ord(pos)} place. Objective: ${w.board.objective}. Results must improve.`);
  }
}
export const ord = (n: number) => (n % 100 >= 11 && n % 100 <= 13) ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th';

// ---- end of season -----------------------------------------------------------------------
export function endSeason(w: World) {
  const champions: Record<string, string> = {}, cups: Record<string, string> = {};
  const ranks: Record<string, string[]> = {};
  const userLeague = w.clubs[w.user].league;
  let userFinish = 0;
  for (const lg of LEAGUES.filter(l => l.tier === 1)) {
    const t = table(w, lg.id);
    ranks[lg.id] = t.map(r => r.id);
    champions[lg.id] = t[0].id;
    w.clubs[t[0].id].trophies.push({ name: lg.name, season: w.season });
    t.forEach((r, i) => { const prize = (t.length - i) * 1.4e6 * lg.wealth; w.clubs[r.id].balance += prize; w.clubs[r.id].fin.prize += prize; });
    if (lg.id === userLeague) userFinish = t.findIndex(r => r.id === w.user) + 1;
    const cup = w.comps[`cup-${lg.country}`];
    if (cup?.winner) cups[cup.id] = cup.winner;
  }
  for (const id of ['ucl', 'uel']) if (w.comps[id]?.winner) cups[id] = w.comps[id].winner!;
  awards(w);
  // board verdict
  if (userFinish) {
    const gap = userFinish - w.board.objectiveRank;
    w.board.confidence = clamp(w.board.confidence - gap * 6 + (gap <= 0 ? 12 : 0), 0, 100);
    if (w.board.confidence < 15) { w.sacked = true; news(w, 'board', 'Sacked', `Finishing ${userFinish}${ord(userFinish)} fell well short of the objective (${w.board.objective}). The board has decided to make a change.`); }
  }
  w.history.push({ season: w.season, champions, cups, userFinish, userComp: userLeague, ballon: w.awards.find(a => a.season === w.season && a.title === "Ballon d'Or")?.pid });
  // career rows
  for (const p of Object.values(w.players)) {
    if (p.s.apps > 0 && p.club) p.career.push({ season: w.season, club: p.club, apps: p.s.apps, goals: p.s.goals, assists: p.s.assists, rating: Math.round(p.s.ratingSum / p.s.apps * 100) / 100, ovr: p.ovr });
  }
  promotions(w, ranks);
  offseason(w);
  w.season++;
  startSeason(w, ranks);
  news(w, 'info', `Welcome to the ${w.season}/${String(w.season + 1).slice(2)} season`, `The summer transfer window is open until 1 September. ${w.board.objective} is the board's target.`);
}

function promotions(w: World, ranks: Record<string, string[]>) {
  for (const lg of LEAGUES.filter(l => l.tier === 1)) {
    const down = ranks[lg.id].slice(-lg.relegate);
    const pool = Object.values(w.clubs).filter(c => c.league === lg.up);
    // simulate the second tier with a quick strength model
    const pts = new Map<string, number>(pool.map(c => [c.id, 0]));
    for (const a of pool) for (const b of pool) if (a !== b) {
      const [x, y] = poissonScore((a.strength ?? 60) + 1.5, b.strength ?? 60);
      pts.set(a.id, pts.get(a.id)! + (x > y ? 3 : x === y ? 1 : 0)); pts.set(b.id, pts.get(b.id)! + (y > x ? 3 : x === y ? 1 : 0));
    }
    const up = [...pool].sort((a, b) => pts.get(b.id)! - pts.get(a.id)!).slice(0, lg.relegate);
    for (const id of down) {
      const c = w.clubs[id];
      c.league = lg.up!; c.tier = 2;
      c.strength = clamp(teamRatings(w, c).ovr - 2, 58, 76);
      c.rep = Math.max(50, c.rep - 4);
      if (id === w.user) news(w, 'board', 'Relegated', `${c.name} have been relegated. The board expects an immediate return.`);
      // relegated clubs lose their best players to top-flight sides over the summer
    }
    for (const c of up) {
      c.league = lg.id; c.tier = 1; c.rep = Math.max(c.rep, 58);
      if (c.squad.length < 18) fillSquad(w, c, 25);
      setupFinances(w, c, false);
      c.balance = Math.max(c.balance, c.budget * 1.5);
      news(w, 'info', `${c.name} promoted to the ${lg.name}`, `${c.name} win promotion from the ${LEAGUES.find(l => l.id === lg.up)!.name}.`);
    }
  }
  // a relegated manager is shown the door; the UI then offers a new job
  if (w.clubs[w.user].tier === 2) w.sacked = true;
}

function offseason(w: World) {
  const nextSeason = w.season + 1;
  // aging, retirements, potential drift
  for (const p of Object.values(w.players)) {
    const age = nextSeason - p.born;
    if (age >= 33 && (age >= 39 || chance((age - 32) * 0.16 + (p.ovr < 72 ? 0.15 : 0)))) {
      p.retiring = true;
      continue;
    }
    if (age <= 23 && p.s.mins < 400) p.pot = Math.max(p.ovr, p.pot - Math.round(rand() * 2));
    if (age <= 21 && p.s.ratingSum / Math.max(1, p.s.apps) > 7.2) p.pot = Math.min(95, p.pot + 1 + Math.round(rand() * 2));
    p.fitness = 100; p.sharp = 55; p.inj = p.inj && p.inj.days > 40 ? { ...p.inj, days: p.inj.days - 40 } : undefined;
    p.valueHist.push(marketValue(p, nextSeason));
    if (p.valueHist.length > 12) p.valueHist.shift();
  }
  const retirees = Object.values(w.players).filter(p => p.retiring);
  for (const p of retirees) {
    if (p.club && w.clubs[p.club]) { const c = w.clubs[p.club]; c.squad = c.squad.filter(x => x !== p.id); if (c.id === w.user) news(w, 'squad', `${p.name} retires`, `${p.name} has announced his retirement from professional football at ${nextSeason - p.born}.`, { pid: p.id }); }
    if (p.real && p.ovr >= 84) news(w, 'media', `Legend ${p.name} hangs up his boots`, `${p.name} retires after a career spanning ${p.career.length} seasons in the game.`);
    w.freeAgents = w.freeAgents.filter(x => x !== p.id);
    p.club = null;
    delete w.players[p.id];
  }
  w.shortlist = w.shortlist.filter(id => w.players[id]);
  aiRenewals(w);
  expireContracts(w, nextSeason);
  // youth intake
  for (const c of Object.values(w.clubs)) {
    if (c.tier === 2) continue;
    const n = 2 + Math.round(rand() * 2);
    const intake: Player[] = [];
    for (let i = 0; i < n; i++) {
      const pos = pick(['GK', 'CB', 'CB', 'RB', 'LB', 'CDM', 'CM', 'CM', 'CAM', 'RW', 'LW', 'ST', 'ST'] as const);
      const age = 16 + Math.round(rand());
      const p = genPlayer(w, natFor(c.country), pos, nextSeason - age, 46 + c.youth * 1.6 + gauss() * 4, 0);
      p.pot = clamp(Math.round(rollPotential(p.ovr, age, 0) + c.youth * 1.2 + gauss() * 5 + (chance(0.04) ? 10 : 0)), p.ovr + 4, 94);
      p.youth = true; p.club = c.id; c.squad.push(p.id);
      p.contract = nextSeason + 3; p.wage = 1500 + c.rep * 20; p.num = 40 + i;
      intake.push(p);
    }
    if (c.id === w.user) news(w, 'squad', 'Youth intake', `${intake.length} academy graduates join the first-team squad: ${intake.map(p => `${p.name} (${p.pos}, pot. ${p.pot - 4}-${p.pot + 3})`).join(', ')}.`);
    // AI trims oversized squads
    if (c.id !== w.user) trimSquad(w, c);
  }
  for (const c of Object.values(w.clubs)) {
    if (c.tier === 2) continue;
    if (c.id !== w.user && c.squad.length < 22) fillSquad(w, c, 24);
    setupFinances(w, c, false);
    c.balance = Math.max(c.balance, 0) * 0.5 + c.budget;
    for (const id of c.squad) { const p = w.players[id]; if (p && p.wage < fairWage(p, c.rep, nextSeason) * 0.5) p.morale -= 5; }
  }
}

function trimSquad(w: World, c: Club) {
  const ps = c.squad.map(id => w.players[id]).filter(Boolean).sort((a, b) => (a.ovr + (a.pot - a.ovr) * 0.4) - (b.ovr + (b.pot - b.ovr) * 0.4));
  while (ps.length > 28) {
    const p = ps.shift()!;
    c.squad = c.squad.filter(x => x !== p.id);
    p.club = null; w.freeAgents.push(p.id);
  }
}

function awards(w: World) {
  const all = Object.values(w.players).filter(p => p.s.apps >= 10);
  const score = (p: Player) => p.s.ratingSum / p.s.apps * 10 + p.s.goals * 0.9 + p.s.assists * 0.5 + p.ovr * 0.4 + (p.club ? trophyBonus(w, p.club) : 0);
  const ranked = [...all].sort((a, b) => score(b) - score(a));
  const add = (title: string, p?: Player, value?: string) => { if (p) { w.awards.push({ season: w.season, title, pid: p.id, club: p.club ?? undefined, value }); } };
  add("Ballon d'Or", ranked[0], `${ranked[0]?.s.goals}G ${ranked[0]?.s.assists}A`);
  add("Ballon d'Or — 2nd", ranked[1]); add("Ballon d'Or — 3rd", ranked[2]);
  const young = ranked.find(p => ageOf(p, w.season) <= 21);
  add('Kopa Trophy (best U21)', young);
  const gk = [...all].filter(p => p.pos === 'GK').sort((a, b) => (b.s.cleanSheets * 2 + b.s.ratingSum / b.s.apps * 5) - (a.s.cleanSheets * 2 + a.s.ratingSum / a.s.apps * 5))[0];
  add('Yashin Trophy (best GK)', gk, `${gk?.s.cleanSheets} clean sheets`);
  for (const lg of LEAGUES.filter(l => l.tier === 1)) {
    const inL = Object.values(w.players).filter(p => p.cs[lg.id]);
    const boot = [...inL].sort((a, b) => b.cs[lg.id][1] - a.cs[lg.id][1] || a.cs[lg.id][0] - b.cs[lg.id][0])[0];
    add(`${lg.name} Golden Boot`, boot, `${boot?.cs[lg.id][1]} goals`);
    const poty = [...inL].filter(p => p.cs[lg.id][0] >= 15).sort((a, b) => score(b) - score(a))[0];
    add(`${lg.name} Player of the Season`, poty);
  }
  const top = ranked[0];
  if (top) news(w, 'award', `${top.name} wins the Ballon d'Or`, `${top.name} (${top.club ? w.clubs[top.club]?.name : ''}) is crowned the world's best player after ${top.s.goals} goals and ${top.s.assists} assists.`, { pid: top.id });
}
function trophyBonus(w: World, club: string) { return w.clubs[club].trophies.filter(t => t.season === w.season).length * 6; }

/** Quick abstract strength sim used to refresh second-tier clubs each summer. */
export function refreshSecondTier(w: World) {
  for (const c of Object.values(w.clubs)) if (c.tier === 2 && !c.squad.length) c.strength = clamp((c.strength ?? squadLevel(c.rep)) + gauss() * 1.2, 56, 74);
}
