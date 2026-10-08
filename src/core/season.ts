// The season loop: results, standings and tiebreakers, playoffs, weekly XP and
// growth, wear and injuries, awards, records, news, job security, coach XP.
import { awardSkillPoints } from './archetypes';
import type { Game, League, Player, Pos, StatLine } from './types';
import { Rng, clamp, hash } from './rng';
import { autoDepth, emptyLine, rosterOf, teamRatings } from './league';
import { ATTRS, DEV_MULT, OVR_W, overall } from './ratings';
import { GameSim } from '../sim/game';
import { aiWeekly } from './ai';
import { startOffseason } from './offseason';
import { settleMedia } from './media';

export const REG_WEEKS = 18;
export const ROUND_NAME: Record<number, string> = { 19: 'Wild Card', 20: 'Divisional', 21: 'Conference Championship', 22: 'Super Bowl' };

export function news(league: League, kind: League['news'][number]['kind'], text: string, teams: string[] = [], opts: { pid?: string; big?: boolean } = {}) {
  league.news.unshift({ id: league.counter++, season: league.season, week: league.week, kind, text, teams, ...opts });
  if (league.news.length > 700) league.news.length = 700;
}
export function mail(league: League, from: string, subject: string, body: string, action?: League['inbox'][number]['action']) {
  league.inbox.unshift({ id: league.counter++, season: league.season, week: league.week, from, subject, body, read: false, action });
  if (league.inbox.length > 150) league.inbox.length = 150;
}

export const weekGames = (league: League, week = league.week) => league.games.filter(g => g.season === league.season && g.week === week);
export const userGame = (league: League) => weekGames(league).find(g => g.home === league.user || g.away === league.user);

// ---- applying results -----------------------------------------------------------------
function addLine(into: StatLine, l: Partial<StatLine>) {
  for (const k in l) {
    const key = k as keyof StatLine;
    const v = l[key] ?? 0;
    if (key === 'plng' || key === 'rlng' || key === 'reclng' || key === 'fglng') into[key] = Math.max(into[key], v);
    else into[key] += v;
  }
}

export function applyResult(league: League, g: Game, sim: GameSim) {
  const res = sim.result();
  g.result = { hs: res.hs, as: res.as, ot: res.ot, box: res.box };
  const playoff = g.week > REG_WEEKS;
  for (const [id, l] of Object.entries(res.box!.players)) {
    const p = league.players[id];
    if (!p) continue;
    const book = playoff ? p.post : p.stats;
    addLine((book[league.season] ??= emptyLine()), l);
    weeklyGameXp(league, p, l as StatLine);
  }
  for (const inj of res.injuries) {
    const p = league.players[inj.pid];
    if (!p) continue;
    // The countdown ticks once before the next game, so store one extra week: a player
    // listed to miss two games really misses two.
    p.injury = { type: inj.type, weeks: inj.weeks + 1, season: inj.season };
    const notable = p.team === league.user || (inj.season && p.ovr >= 75) || (p.ovr >= 82 && inj.weeks >= 2);
    if (notable) news(league, 'injury', `${p.team} ${p.pos} ${p.fn} ${p.ln} suffered a ${inj.type.toLowerCase()} and is ${inj.season ? 'out for the season' : `expected to miss ${inj.weeks} week${inj.weeks > 1 ? 's' : ''}`}.`, [p.team], { pid: p.id, big: inj.season && p.ovr >= 85 });
  }
  const winner = res.hs > res.as ? g.home : res.as > res.hs ? g.away : '';
  const ht = league.teams[g.home], at = league.teams[g.away];
  const pog = res.box?.pog ? league.players[res.box.pog] : undefined;
  if (g.home === league.user || g.away === league.user || playoff || Math.abs(res.hs - res.as) <= 3 && Math.random() < 0.3) {
    const w = winner ? league.teams[winner] : undefined;
    const text = playoff && g.week === 22
      ? `${w?.name} win Super Bowl ${superBowlNumeral(league.season)}, beating the ${(winner === g.home ? at : ht).nick} ${Math.max(res.hs, res.as)}-${Math.min(res.hs, res.as)}${pog ? `. ${pog.fn} ${pog.ln} named MVP.` : '.'}`
      : `${w ? w.nick : ht.nick} ${w ? 'beat' : 'tie'} the ${w ? (winner === g.home ? at : ht).nick : at.nick} ${Math.max(res.hs, res.as)}-${Math.min(res.hs, res.as)}${res.ot ? ' in overtime' : ''}${pog ? `. ${pog.fn} ${pog.ln} led the way` : ''}.`;
    news(league, 'game', `${playoff ? ROUND_NAME[g.week] + ': ' : ''}${text}`, [g.home, g.away], { pid: pog?.id, big: playoff });
  }
  if (playoff && g.week === 22 && pog) { pog.awards.push(`${league.season} Super Bowl MVP`); const a = seasonAwards(league); a.sbMvp = pog.id; a.champion = winner; a.runnerUp = winner === g.home ? g.away : g.home; }
}
const superBowlNumeral = (season: number) => roman(season - 1965);
function roman(n: number) {
  const m: [number, string][] = [[50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let s = '';
  for (const [v, r] of m) while (n >= v) { s += r; n -= v; }
  return s;
}

// ---- Madden-style XP and in-season growth ------------------------------------------------
function gameXp(p: Player, l: StatLine): number {
  const start = l.gs ? 25 : l.gp ? 8 : 0;
  switch (p.pos) {
    case 'QB': return start + l.py / 10 + l.ptd * 25 - l.pint * 15 + l.ry / 5 + l.rtd * 20;
    case 'RB': case 'FB': return start + (l.ry + l.recy) / 4.5 + (l.rtd + l.rectd) * 25 - l.fuml * 20;
    case 'WR': case 'TE': return start + l.recy / 4 + l.rec * 3 + l.rectd * 25 - l.drop * 10;
    case 'OT': case 'G': case 'C': return start * 1.6 + l.pancake * 6 - l.sacka * 12;
    case 'EDGE': case 'DT': return start + l.tkl * 5 + l.dsk * 30 + l.qbh * 8 + l.tfl * 10 + l.ff * 20;
    case 'LB': return start + l.tkl * 5 + l.dsk * 25 + l.dint * 35 + l.pd * 10 + l.tfl * 8;
    case 'CB': case 'S': return start + l.pd * 15 + l.dint * 40 + l.tkl * 4;
    case 'K': return start + l.fgm * 12 + (l.fglng >= 50 ? 15 : 0) - (l.fga - l.fgm) * 10;
    case 'P': return start + l.pun * 3;
    default: return start;
  }
}
function coachXpMult(league: League, p: Player) {
  if (p.team !== league.user) return 1;
  const u = league.coachTree.unlocked;
  return 1 + (u.includes('Mentor') ? 0.12 : 0) + (u.includes('Player Development II') ? 0.12 : 0) + (p.pos === 'QB' && u.includes('QB Whisperer') ? 0.2 : 0) + (p.exp <= 1 && u.includes('Rookie Camp') ? 0.15 : 0);
}
function weeklyGameXp(league: League, p: Player, l: StatLine) {
  p.xp += Math.max(0, gameXp(p, l)) * DEV_MULT[p.dev] * coachXpMult(league, p);
}
export const xpToLevel = (ovr: number) => 420 + Math.max(0, ovr - 50) * 30;

/** Spend banked XP: each level raises the position's key attributes, never past potential. */
export function spendXp(p: Player): number {
  let gained = 0;
  while (p.xp >= xpToLevel(p.ovr) && p.ovr < p.pot && gained < 3) {
    p.xp -= xpToLevel(p.ovr);
    const w = OVR_W[p.pos];
    const keys = (Object.keys(w) as (keyof typeof w)[]).filter(k => !['SPD', 'ACC', 'AGI', 'STR', 'JMP'].includes(k)).sort((a, b) => (w[b] ?? 0) - (w[a] ?? 0));
    const before = p.ovr;
    for (let i = 0; i < 6 && p.ovr === before; i++) {
      const k = keys[i % Math.min(4, keys.length)];
      p.attrs[k] = Math.min(99, p.attrs[k] + 1);
      if (i % 2 === 1) { const k2 = keys[(i + 2) % keys.length]; p.attrs[k2] = Math.min(99, p.attrs[k2] + 1); }
      p.ovr = overall(p.pos, p.attrs);
    }
    if (p.ovr > before) gained += p.ovr - before;
  }
  if (p.ovr >= p.pot) p.xp = Math.min(p.xp, xpToLevel(p.ovr) * 0.9);
  return gained;
}

// ---- weekly flow -----------------------------------------------------------------------
/** Simulate the rest of the current week (skipping the user's game if `exceptUser`). */
export function simWeek(league: League, exceptUser = false) {
  for (const g of weekGames(league)) {
    if (g.result) continue;
    if (exceptUser && (g.home === league.user || g.away === league.user)) continue;
    prepTeam(league, g.home); prepTeam(league, g.away);
    const sim = new GameSim(league, g, hash(g.id) ^ league.seed);
    sim.simToEnd();
    applyResult(league, g, sim);
  }
}
export function prepTeam(league: League, abbr: string) {
  if (abbr !== league.user || league.coachTree.unlocked.includes('Auto Depth') || !league.teams[abbr].depth.QB?.length) autoDepth(league, abbr);
  else {
    // Keep the user's order but drop anyone injured or gone.
    const t = league.teams[abbr];
    for (const pos of Object.keys(t.depth) as Pos[]) t.depth[pos] = (t.depth[pos] ?? []).filter(id => league.players[id]?.team === abbr && league.players[id]?.status === 'ACT');
    const fresh = rosterOf(league, abbr);
    for (const p of fresh) if (!(t.depth[p.pos] ?? []).includes(p.id)) (t.depth[p.pos] ??= []).push(p.id);
  }
}

/** Everything that happens between weeks. Returns true if the week advanced. */
export function advanceWeek(league: League): boolean {
  if (weekGames(league).some(g => !g.result)) return false;
  // Archetype skill points for the user's players who hit their goals this week.
  const boxes = weekGames(league).filter(g => g.home === league.user || g.away === league.user).map(g => g.result?.box?.players ?? {});
  const earned = awardSkillPoints(league, boxes);
  if (earned.length) mail(league, 'Player Development', `${earned.reduce((s, e) => s + e.sp, 0)} skill points earned`, earned.map(e => `${e.p.fn} ${e.p.ln} +${e.sp} SP: ${e.why}`).join('\n'));
  const rng = new Rng(hash(`${league.seed}-${league.season}-${league.week}`));
  const byeTeams = new Set(Object.keys(league.teams));
  for (const g of weekGames(league)) { byeTeams.delete(g.home); byeTeams.delete(g.away); }
  for (const p of Object.values(league.players)) {
    if (p.team === 'FA' || p.status === 'RET' || p.status === 'PROSPECT') continue;
    const plan = league.teams[p.team]?.plan.practice ?? 'Normal';
    // Practice XP and wear recovery.
    const practice = { Light: 18, Normal: 32, Intense: 52 }[plan];
    p.xp += practice * DEV_MULT[p.dev] * (p.age > 30 ? 0.6 : 1) * coachXpMult(league, p) * (0.6 + p.traits.work / 250);
    const recover = { Light: 30, Normal: 22, Intense: 14 }[plan] + (byeTeams.has(p.team) ? 18 : 0) + (p.team === league.user && league.coachTree.unlocked.includes('Sports Science') ? 6 : 0);
    p.cond = clamp(p.cond + recover, 0, 100);
    if (plan === 'Intense' && rng.chance(0.004) && !p.injury) { p.injury = { type: 'Practice Strain', weeks: rng.int(2, 3) }; if (p.team === league.user) mail(league, 'Head Trainer', `${p.ln} hurt in practice`, `${p.fn} ${p.ln} strained a muscle in an intense practice and will miss ${p.injury.weeks} week(s).`); }
    if (p.injury) {
      p.injury.weeks--;
      if (p.injury.weeks <= 0) { if (p.team === league.user && p.ovr >= 70) mail(league, 'Head Trainer', `${p.ln} cleared to play`, `${p.fn} ${p.ln} has recovered from his ${p.injury.type.toLowerCase()}.`); p.injury = undefined; if (p.status === 'IR') p.status = 'ACT'; }
    }
    const before = p.ovr;
    if (spendXp(p) > 0 && p.team === league.user && p.ovr - before >= 1) news(league, 'milestone', `${p.fn} ${p.ln} progressed to ${p.ovr} OVR.`, [p.team], { pid: p.id });
  }
  aiWeekly(league, rng);
  coachXp(league);
  settleMedia(league);
  if (league.phase === 'regular') league.scoutPoints += 45;
  if (league.phase === 'regular') {
    if (league.week === REG_WEEKS) { regularSeasonAwards(league); startPlayoffs(league); return true; }
    league.week++;
    if (league.week === league.tradeDeadlineWeek + 1) news(league, 'league', 'The trade deadline has passed.', []);
  } else if (league.phase === 'playoffs') {
    if (league.week === 22) { endSeason(league); return true; }
    nextPlayoffRound(league);
  }
  return true;
}

function coachXp(league: League) {
  const g = league.games.find(x => x.season === league.season && x.week === league.week && (x.home === league.user || x.away === league.user) && x.result);
  if (!g?.result) return;
  const won = (g.home === league.user ? g.result.hs > g.result.as : g.result.as > g.result.hs);
  league.coachTree.xp += won ? (g.week > REG_WEEKS ? 260 : 120) : 40;
  while (league.coachTree.xp >= league.coachTree.level * 450) {
    league.coachTree.xp -= league.coachTree.level * 450;
    league.coachTree.level++; league.coachTree.points++;
    mail(league, 'Front Office', 'Coach level up', `You reached coach level ${league.coachTree.level} and earned a coach ability point. Spend it in Coach Abilities.`);
  }
}

// ---- standings --------------------------------------------------------------------------
export interface Standing { abbr: string; w: number; l: number; t: number; pf: number; pa: number; div: [number, number, number]; conf: [number, number, number]; streak: string; pct: number; h2h: Record<string, number>; last5: string }
export function standings(league: League, season = league.season): Record<string, Standing> {
  const s: Record<string, Standing> = {};
  for (const a of Object.keys(league.teams)) s[a] = { abbr: a, w: 0, l: 0, t: 0, pf: 0, pa: 0, div: [0, 0, 0], conf: [0, 0, 0], streak: '', pct: 0, h2h: {}, last5: '' };
  const seq: Record<string, string[]> = {};
  for (const g of league.games) {
    if (g.season !== season || g.week > REG_WEEKS || !g.result) continue;
    const { hs, as } = g.result;
    const H = s[g.home], A = s[g.away];
    H.pf += hs; H.pa += as; A.pf += as; A.pa += hs;
    const sameDiv = league.teams[g.home].div === league.teams[g.away].div && league.teams[g.home].conf === league.teams[g.away].conf;
    const sameConf = league.teams[g.home].conf === league.teams[g.away].conf;
    const r = hs > as ? [0, 2] : hs < as ? [2, 0] : [1, 1]; // index into w/l/t-ish: 0 win,2 loss,1 tie
    const rec = (st: Standing, i: number, opp: string, scoreDiff: number) => {
      if (i === 0) st.w++; else if (i === 2) st.l++; else st.t++;
      const idx = i === 0 ? 0 : i === 2 ? 1 : 2;
      if (sameDiv) st.div[idx]++;
      if (sameConf) st.conf[idx]++;
      st.h2h[opp] = (st.h2h[opp] ?? 0) + (i === 0 ? 1 : i === 2 ? -1 : 0);
      (seq[st.abbr] ??= []).push(i === 0 ? 'W' : i === 2 ? 'L' : 'T');
      void scoreDiff;
    };
    rec(H, r[0], g.away, hs - as); rec(A, r[1], g.home, as - hs);
  }
  for (const st of Object.values(s)) {
    const gp = st.w + st.l + st.t;
    st.pct = gp ? (st.w + st.t / 2) / gp : 0;
    const q = seq[st.abbr] ?? [];
    if (q.length) { const last = q[q.length - 1]; let n = 0; for (let i = q.length - 1; i >= 0 && q[i] === last; i--) n++; st.streak = `${last}${n}`; }
    st.last5 = q.slice(-5).join('');
  }
  return s;
}
const pctOf = (r: [number, number, number]) => (r[0] + r[1] + r[2] ? (r[0] + r[2] / 2) / (r[0] + r[1] + r[2]) : 0);

/** Sort teams with the NFL's main tiebreakers: record, head-to-head, division, conference, point differential. */
export function rank(teams: string[], st: Record<string, Standing>, sameDiv: boolean): string[] {
  return [...teams].sort((a, b) => {
    const A = st[a], B = st[b];
    if (A.pct !== B.pct) return B.pct - A.pct;
    const h = (A.h2h[b] ?? 0) - (B.h2h[a] ?? 0);
    if (h) return -h;
    if (sameDiv) { const d = pctOf(B.div) - pctOf(A.div); if (d) return d; }
    const c = pctOf(B.conf) - pctOf(A.conf);
    if (c) return c;
    return (B.pf - B.pa) - (A.pf - A.pa);
  });
}
export function divisionOrder(league: League, conf: string, div: string, st = standings(league)) {
  return rank(Object.values(league.teams).filter(t => t.conf === conf && t.div === div).map(t => t.abbr), st, true);
}
/** Seven seeds: four division winners, then three wild cards. */
export function seeds(league: League, conf: string, st = standings(league)): string[] {
  const divs = ['East', 'North', 'South', 'West'];
  const winners = divs.map(d => divisionOrder(league, conf, d, st)[0]);
  const rest = Object.values(league.teams).filter(t => t.conf === conf && !winners.includes(t.abbr)).map(t => t.abbr);
  return [...rank(winners, st, false), ...rank(rest, st, false).slice(0, 3)];
}

// ---- playoffs ---------------------------------------------------------------------------
function startPlayoffs(league: League) {
  league.phase = 'playoffs';
  league.week = 19;
  const st = standings(league);
  for (const conf of ['AFC', 'NFC']) {
    const s = seeds(league, conf, st);
    news(league, 'league', `${conf} playoff field: ${s.map((a, i) => `${i + 1}. ${league.teams[a].nick}`).join(', ')}.`, s, { big: true });
    for (const [h, a] of [[1, 6], [2, 5], [3, 4]]) addPlayoffGame(league, s[h], s[a], 19);
  }
  const user = league.user;
  const userSeed = [...seeds(league, 'AFC', st), ...seeds(league, 'NFC', st)].indexOf(user);
  if (userSeed === -1) mail(league, 'Owner', 'Season over', `We missed the playoffs. I expect better next year.`);
}
function addPlayoffGame(league: League, home: string, away: string, week: number, neutral?: string) {
  league.games.push({ id: `${league.season}-${week}-${home}-${away}`, season: league.season, week, home, away, neutral, day: 'Sun' });
}
function nextPlayoffRound(league: League) {
  const week = league.week;
  const st = standings(league);
  const winners = (w: number) => league.games.filter(g => g.season === league.season && g.week === w && g.result).map(g => (g.result!.hs >= g.result!.as ? g.home : g.away));
  if (week === 19 || week === 20) {
    for (const conf of ['AFC', 'NFC']) {
      const s = seeds(league, conf, st);
      const alive = (week === 19 ? [s[0], ...winners(19)] : winners(20)).filter(a => league.teams[a].conf === conf).sort((a, b) => s.indexOf(a) - s.indexOf(b));
      if (week === 19) { addPlayoffGame(league, alive[0], alive[3], 20); addPlayoffGame(league, alive[1], alive[2], 20); }
      else addPlayoffGame(league, alive[0], alive[1], 21);
    }
  } else if (week === 21) {
    const [a, b] = winners(21);
    const afc = league.teams[a].conf === 'AFC' ? a : b, nfc = afc === a ? b : a;
    // Super Bowl at a neutral site; the designated home team alternates by year.
    const homeAfc = league.season % 2 === 0;
    addPlayoffGame(league, homeAfc ? afc : nfc, homeAfc ? nfc : afc, 22, 'Super Bowl');
  }
  league.week++;
}

// ---- awards ----------------------------------------------------------------------------
export function seasonAwards(league: League) {
  let a = league.awards.find(x => x.season === league.season);
  if (!a) { a = { season: league.season, allPro: [] }; league.awards.push(a); }
  return a;
}
export type AwardKey = 'mvp' | 'opoy' | 'dpoy' | 'oroy' | 'droy';
export const AWARD_NAME: Record<AwardKey, string> = { mvp: 'MVP', opoy: 'Offensive Player of the Year', dpoy: 'Defensive Player of the Year', oroy: 'Offensive Rookie of the Year', droy: 'Defensive Rookie of the Year' };
const offScoreOf = (l: StatLine) => l.py * 0.025 + l.ptd * 4 - l.pint * 3 + (l.ry + l.recy) * 0.06 + (l.rtd + l.rectd) * 5;
const defScoreOf = (l: StatLine) => l.dsk * 4 + l.dint * 5 + l.ff * 3 + l.tfl * 1.2 + l.pd * 1 + l.tkl * 0.25 + l.dtd * 4 + l.qbh * 0.5;
/**
 * The award races as they stand: candidates ranked by the same formula that decides
 * the awards at the end of the regular season (production, plus wins for MVP).
 */
export function awardRace(league: League, season = league.season, n = 5): Record<AwardKey, { p: Player; score: number }[]> {
  const st = standings(league, season);
  const line = (p: Player) => p.stats[season] ?? emptyLine();
  const active = Object.values(league.players).filter(p => p.stats[season]?.gp);
  const OFF = ['QB', 'RB', 'WR', 'TE'], DEF = ['EDGE', 'DT', 'LB', 'CB', 'S'];
  const rank = (ps: Player[], f: (p: Player) => number) => ps.map(p => ({ p, score: f(p) })).sort((a, b) => b.score - a.score);
  const mvp = rank(active.filter(p => OFF.includes(p.pos)), p => offScoreOf(line(p)) * (p.pos === 'QB' ? 1.15 : 0.8) + (st[p.team]?.w ?? 0) * 3);
  const mvpId = mvp[0]?.p.id;
  return {
    mvp: mvp.slice(0, n),
    opoy: rank(active.filter(p => OFF.includes(p.pos) && p.id !== mvpId), p => offScoreOf(line(p))).slice(0, n),
    dpoy: rank(active.filter(p => DEF.includes(p.pos)), p => defScoreOf(line(p))).slice(0, n),
    oroy: rank(active.filter(p => p.exp === 0 && [...OFF, 'OT', 'G', 'C'].includes(p.pos)), p => offScoreOf(line(p)) + p.ovr * 0.3).slice(0, n),
    droy: rank(active.filter(p => p.exp === 0 && DEF.includes(p.pos)), p => defScoreOf(line(p)) + p.ovr * 0.3).slice(0, n),
  };
}
/** Coach of the Year race: wins against what the roster was expected to win. */
export function coachRace(league: League, season = league.season) {
  const st = standings(league, season);
  const expected = Object.keys(league.teams).map(t => [t, teamRatings(league, t).ovr] as const).sort((x, y) => y[1] - x[1]);
  const over = (t: string) => st[t].w - (17 - expected.findIndex(e => e[0] === t) * 0.4);
  return Object.keys(league.teams).sort((x, y) => over(y) - over(x));
}
function regularSeasonAwards(league: League) {
  const line = (p: Player) => p.stats[league.season] ?? emptyLine();
  const active = Object.values(league.players).filter(p => p.stats[league.season]?.gp);
  const offScore = (p: Player) => offScoreOf(line(p));
  const defScore = (p: Player) => defScoreOf(line(p));
  const a = seasonAwards(league);
  const race = awardRace(league, league.season, 1);
  const [mvp, opoy, dpoy, oroy, droy] = (['mvp', 'opoy', 'dpoy', 'oroy', 'droy'] as const).map(k => race[k][0]?.p);
  const coy = coachRace(league)[0];
  const give = (p: Player | undefined, name: string, key: 'mvp' | 'opoy' | 'dpoy' | 'oroy' | 'droy') => {
    if (!p) return;
    a[key] = p.id;
    p.awards.push(`${league.season} ${name}`);
    news(league, 'award', `${p.fn} ${p.ln} (${p.team}) is the ${league.season} ${name}.`, [p.team], { pid: p.id, big: key === 'mvp' });
  };
  give(mvp, 'MVP', 'mvp'); give(opoy, 'Offensive Player of the Year', 'opoy'); give(dpoy, 'Defensive Player of the Year', 'dpoy');
  give(oroy, 'Offensive Rookie of the Year', 'oroy'); give(droy, 'Defensive Rookie of the Year', 'droy');
  a.coy = coy;
  news(league, 'award', `${league.teams[coy].coach.name} (${coy}) is Coach of the Year.`, [coy]);
  // First-team All-Pro: production-weighted grade per position.
  const slots: [Pos, number][] = [['QB', 1], ['RB', 1], ['WR', 3], ['TE', 1], ['OT', 2], ['G', 2], ['C', 1], ['EDGE', 2], ['DT', 2], ['LB', 2], ['CB', 2], ['S', 2], ['K', 1], ['P', 1]];
  for (const [pos, n] of slots) {
    const ps = active.filter(p => p.pos === pos && (line(p).gs >= 10 || ['K', 'P'].includes(pos)));
    const grade = (p: Player) => p.ovr * 0.6 + (['EDGE', 'DT', 'LB', 'CB', 'S'].includes(pos) ? defScore(p) * 0.8 : ['K'].includes(pos) ? line(p).fgm : offScore(p) * 0.25);
    for (const p of ps.sort((x, y) => grade(y) - grade(x)).slice(0, n)) { a.allPro.push(p.id); p.awards.push(`${league.season} All-Pro`); }
  }
  checkRecords(league);
}
const NFL_RECORDS: Record<string, [string, number]> = {
  py: ['passing yards', 5477], ptd: ['passing touchdowns', 55], ry: ['rushing yards', 2105], rtd: ['rushing touchdowns', 28],
  recy: ['receiving yards', 1964], rec: ['receptions', 149], rectd: ['receiving touchdowns', 23], dsk: ['sacks', 22.5], dint: ['interceptions', 14],
};
function checkRecords(league: League) {
  for (const [k, [name, nfl]] of Object.entries(NFL_RECORDS)) {
    const cur = league.records[k] ?? { v: nfl, pid: '', season: 0 };
    for (const p of Object.values(league.players)) {
      const v = (p.stats[league.season]?.[k as keyof StatLine] ?? 0) as number;
      if (v > cur.v) {
        league.records[k] = { v, pid: p.id, season: league.season };
        news(league, 'milestone', `RECORD: ${p.fn} ${p.ln} set the single-season record for ${name} with ${v}.`, [p.team], { pid: p.id, big: true });
        cur.v = v;
      }
    }
  }
}

function endSeason(league: League) {
  const st = standings(league);
  league.history.push({ season: league.season, standings: Object.fromEntries(Object.values(st).map(s => [s.abbr, [s.w, s.l, s.t] as [number, number, number]])) });
  // Owner's verdict: wins against what the roster should produce.
  const user = league.user;
  const exp = 4 + (teamRatings(league, user).ovr - 70) * 0.6;
  const a = seasonAwards(league);
  const champ = a.champion === user;
  const madePlayoffs = league.games.some(g => g.season === league.season && g.week > REG_WEEKS && (g.home === user || g.away === user));
  league.security = clamp(league.security + (st[user].w - exp) * 4 + (madePlayoffs ? 10 : -6) + (champ ? 30 : 0), 0, 100);
  if (league.security < 12) {
    league.fired = true;
    mail(league, 'Owner', 'You are relieved of your duties', `After ${st[user].w} wins, the organisation is moving in a new direction. Thank you for your service.`);
  } else mail(league, 'Owner', 'End-of-season review', champ ? 'World champions. The city is yours.' : `Final record ${st[user].w}-${st[user].l}. Job security: ${Math.round(league.security)}/100.`);
  startOffseason(league);
}

export { ATTRS };

/**
 * One "advance" press: whatever comes next in the calendar. `auto` lets the
 * user's team be run by the AI (used by tests and the sim-to-date button).
 */
export async function advance(league: League, opts: { auto?: boolean } = {}) {
  const { advanceOffseason, expiringFor, askingPrice, signPlayer } = await import('./offseason');
  const { simToUserPick, aiPickNow } = await import('./draft');
  switch (league.phase) {
    case 'preseason': {
      if (opts.auto) { const { aiCapManagement, fillRoster } = await import('./offseason'); aiCapManagement(league, league.user, 1_000_000); fillRoster(league, league.user); }
      for (const t of Object.keys(league.teams)) { trimRoster(league, t); prepTeam(league, t); }
      league.phase = 'regular'; league.week = 1;
      return;
    }
    case 'regular': case 'playoffs':
      simWeek(league);
      advanceWeek(league);
      return;
    case 'resign':
      if (opts.auto) { const { aiCapManagement } = await import('./offseason'); aiCapManagement(league, league.user, 12_000_000); }
      if (opts.auto) for (const p of expiringFor(league, league.user)) if (p.ovr >= 74 && p.age <= 30) signPlayer(league, p, league.user, askingPrice(league, p));
      advanceOffseason(league);
      return;
    case 'draft':
      simToUserPick(league);
      if (!league.draft!.done && opts.auto) aiPickNow(league, new Rng(league.draft!.cursor + league.seed));
      if (league.draft!.done) advanceOffseason(league);
      return;
    default:
      advanceOffseason(league);
  }
}
/** Enforce 53 active: the lowest-value extras go to the practice squad or are released. */
export function trimRoster(league: League, team: string) {
  const act = Object.values(league.players).filter(p => p.team === team && p.status === 'ACT').sort((a, b) => a.ovr - b.ovr);
  while (act.length > 53) {
    const p = act.shift()!;
    if (p.exp <= 3 && Object.values(league.players).filter(q => q.team === team && q.status === 'PS').length < 16) p.status = 'PS';
    else { p.team = 'FA'; p.status = 'FA'; p.contract = { years: [] }; }
  }
}
