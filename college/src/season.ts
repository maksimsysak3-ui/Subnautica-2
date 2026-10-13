// The season: a league-wide schedule, every game played by the engine, standings, a weekly poll,
// season stats, player development through the year, conference title games, a 12-team playoff
// and the awards. One save per dynasty; this module holds the rules, the store holds the state.
import { GameSim } from '../../src/sim/game';
import type { StatLine } from '../../src/core/types';
import { SCHOOLS, PLAYERS, SEASON, school, rosterOf, type School, type Player } from './data';
import { gameLeague } from './engine';
import { profile } from './player';
import type { Dynasty } from './store';

/** College tempo: more snaps per game than the pros (about 70 a side). */
export const COLLEGE_PACE = 0.74;
export const REG_WEEKS = 12, CCG_WEEK = 13, PO_WEEKS = [14, 15, 16, 17], LAST_WEEK = 17;
export const weekLabel = (w: number) => (w === 0 ? 'Preseason' : w <= REG_WEEKS ? `Week ${w}` : w === CCG_WEEK ? 'Championship week' : w === 14 ? 'Playoff: first round' : w === 15 ? 'Playoff: quarterfinals' : w === 16 ? 'Playoff: semifinals' : w === 17 ? 'National championship' : 'Offseason');

/** A played game: home, away, scores, and for the user's own game a short summary. */
export interface Result { w: number; h: number; a: number; hs: number; as: number; ot?: boolean; conf?: boolean; tag?: string }
/** Season stat columns: games, passing, rushing, receiving, defense, kicking, tackles, TFL. */
export const ST = { gp: 0, pc: 1, pa: 2, py: 3, ptd: 4, pint: 5, ra: 6, ry: 7, rtd: 8, rec: 9, recy: 10, rectd: 11, sk: 12, int: 13, pbu: 14, ff: 15, fgm: 16, fga: 17, tkl: 18, tfl: 19 } as const;
export interface Award { id: string; name: string; desc: string; winner: string; team: number; line: string; finalists: { id: string; team: number; line: string }[] }
export interface Season {
  results: Result[]; stats: Record<string, number[]>; prog: Record<string, number>;
  /** Ranked school ids after each week (index 0 is the preseason poll). */ polls: number[][];
  /** Power rating per school, updated after every game. */ power: Record<number, number>;
  playoff?: number[]; champs?: Record<string, number>; title?: number; awards?: Award[]; allAmerica?: { pos: string; id: string; team: number }[];
}

// ---- schedule --------------------------------------------------------------------------------
const rand = (seed: number) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
let SCHED: [number, number, boolean][][] | null = null;
/** Twelve weeks for every team: non-conference early, conference play from week four. Built
 *  once per season from a fixed seed so every save sees the same schedule. */
export function schedule(): [number, number, boolean][][] {
  if (SCHED) return SCHED;
  const r = rand(SEASON * 97 + 13);
  const played = new Set<string>();
  const key = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);
  const weeks: [number, number, boolean][][] = [];
  const homeCount: Record<number, number> = {};
  for (let w = 1; w <= REG_WEEKS; w++) {
    const conf = w >= 4 && w !== 8;
    const open = [...SCHOOLS].sort(() => r() - 0.5);
    const taken = new Set<number>(), games: [number, number, boolean][] = [];
    for (const t of open) {
      if (taken.has(t.id)) continue;
      const free = open.filter(o => o.id !== t.id && !taken.has(o.id) && !played.has(key(t.id, o.id)));
      const pref = free.filter(o => (o.conf === t.conf) === (conf && t.conf !== 'Independent'));
      const o = pref[0] ?? free[0];
      if (!o) continue;
      taken.add(t.id); taken.add(o.id); played.add(key(t.id, o.id));
      // Home field alternates, so everyone gets about six home games.
      const tHome = (homeCount[t.id] ?? 0) <= (homeCount[o.id] ?? 0);
      const [h, a] = tHome ? [t.id, o.id] : [o.id, t.id];
      homeCount[h] = (homeCount[h] ?? 0) + 1;
      games.push([h, a, t.conf === o.conf && t.conf !== 'Independent']);
    }
    weeks.push(games);
  }
  return (SCHED = weeks);
}
/** A school's twelve games with results where played. */
export function teamSchedule(id: number, se?: Season) {
  return schedule().map((g, i) => {
    const m = g.find(x => x[0] === id || x[1] === id);
    if (!m) return { wk: i + 1, bye: true as const };
    const home = m[0] === id, o = school(home ? m[1] : m[0]);
    const res = se?.results.find(x => x.w === i + 1 && (x.h === id || x.a === id));
    const us = res ? (home ? res.hs : res.as) : undefined, them = res ? (home ? res.as : res.hs) : undefined;
    return { wk: i + 1, bye: false as const, o, home, conf: m[2], res, us, them, won: res ? us! > them! : undefined };
  });
}
/** Postseason games involving a school (title game and playoff). */
export const postGames = (id: number, se: Season) => se.results.filter(x => x.w > REG_WEEKS && (x.h === id || x.a === id));

// ---- standings and the poll ------------------------------------------------------------------
export function record(id: number, se: Season, confOnly = false) {
  let w = 0, l = 0;
  for (const g of se.results) {
    if (g.h !== id && g.a !== id) continue;
    if (confOnly && (!g.conf || g.w > REG_WEEKS)) continue;
    const us = g.h === id ? g.hs : g.as, them = g.h === id ? g.as : g.hs;
    if (us > them) w++; else l++;
  }
  return { w, l, s: `${w}-${l}` };
}
/** Poll order: power rating (results and margin against the schedule) plus the record. */
function poll(se: Season): number[] {
  return [...SCHOOLS].map(t => {
    const r = record(t.id, se);
    return { id: t.id, v: (se.power[t.id] ?? t.ovr) + r.w * 1.6 - r.l * 5.5 };
  }).sort((a, b) => b.v - a.v).map(x => x.id);
}
export const rankOf = (id: number, se: Season) => { const p = se.polls[se.polls.length - 1] ?? []; const i = p.indexOf(id); return i >= 0 && i < 25 ? i + 1 : 0; };

export function freshSeason(): Season {
  const se: Season = { results: [], stats: {}, prog: {}, polls: [], power: {} };
  for (const t of SCHOOLS) se.power[t.id] = t.ovr + t.win * 6;
  se.polls.push(poll(se));
  return se;
}

// ---- development -----------------------------------------------------------------------------
const YR_GROWTH = [1, 1.35, 1.15, 1, 0.75, 0.55];
const DEV_GROWTH = { Normal: 0.8, Impact: 1, Star: 1.2, Elite: 1.4 } as const;
/** Apply each player's in-season growth to his rating (everywhere the game reads p.ovr). */
export function applyProgress(se?: Season) {
  for (const p of PLAYERS) {
    if (p.b === undefined) p.b = p.ovr;
    p.ovr = Math.max(40, Math.min(99, Math.round(p.b + (se?.prog[p.id] ?? 0))));
  }
}
/** One week of development for everyone. Young players with room grow fastest; playing time,
 *  a good game, the program's coaching and (for you) the week's practice choices speed it up.
 *  Growth closes the gap to potential, never passes it. */
function develop(se: Season, played: Map<string, StatLine>, userTeam: number, boost: number) {
  const rnd = rand(se.results.length * 31 + 7);
  const w = se.polls.length;
  const active = w > REG_WEEKS ? new Set(se.results.filter(r => r.w === w).flatMap(r => [r.h, r.a])) : null;
  for (const p of PLAYERS) {
    if (active && !active.has(p.t)) continue;
    const pr = profile(p), cur = (p.b ?? p.ovr) + (se.prog[p.id] ?? 0);
    const gap = Math.max(0, pr.pot - cur);
    const line = played.get(p.id);
    const reps = line ? (p.st ? 1.3 : 1.1) : 0.85;
    const coach = 0.9 + (school(p.t).prestige ?? 2) * 0.04 + (p.t === userTeam ? boost : 0);
    let d = gap * 0.011 * YR_GROWTH[p.yr] * DEV_GROWTH[pr.dev] * reps * coach;
    if (line) d += Math.min(0.25, perfScore(p.pos, line) * 0.02);
    d += (rnd() - 0.5) * 0.16;
    const next = Math.min(pr.pot - (p.b ?? p.ovr), Math.max(-1.5, (se.prog[p.id] ?? 0) + d));
    if (Math.abs(next) > 0.004) se.prog[p.id] = Math.round(next * 1000) / 1000; else delete se.prog[p.id];
  }
}
/** How much a game line stands out, roughly in "big plays" (0 quiet, 5+ a monster game). */
function perfScore(pos: string, l: Partial<StatLine>): number {
  const v = (k: keyof StatLine) => (l[k] as number | undefined) ?? 0;
  if (pos === 'QB') return v('py') / 90 + v('ptd') * 1.2 - v('pint') * 1.5 + v('ry') / 30;
  return v('ry') / 30 + v('rtd') * 1.2 + v('recy') / 30 + v('rectd') * 1.2 + v('dsk') * 1.5 + v('dint') * 2 + v('tkl') / 4 + v('pd') * 0.6 + v('ff') * 1.5;
}

// ---- playing games ---------------------------------------------------------------------------
const toCols = (l: Partial<StatLine>) => {
  const v = (k: keyof StatLine) => (l[k] as number | undefined) ?? 0;
  return [1, v('pc'), v('pa'), v('py'), v('ptd'), v('pint'), v('ra'), v('ry'), v('rtd'), v('rec'), v('recy'), v('rectd'), v('dsk'), v('dint'), v('pd'), v('ff'), v('fgm'), v('fga'), v('tkl'), v('tfl')];
};
function addStats(se: Season, lines: Record<string, Partial<StatLine>>) {
  for (const [id, l] of Object.entries(lines)) {
    const row = se.stats[id] ?? (se.stats[id] = new Array(20).fill(0));
    toCols(l).forEach((x, i) => (row[i] = Math.round((row[i] + x) * 10) / 10));
  }
}
function updatePower(se: Season, g: Result) {
  const ph = se.power[g.h], pa = se.power[g.a];
  const exp = 1 / (1 + Math.pow(10, (pa - ph - 2.5) / 10));
  const res = g.hs > g.as ? 1 : 0, mov = Math.min(28, Math.abs(g.hs - g.as));
  const k = 2.2 + mov * 0.09;
  se.power[g.h] = ph + k * (res - exp); se.power[g.a] = pa - k * (res - exp);
}
/** Record a finished game (yours from the live game, or a simulated one). */
export function recordGame(se: Season, w: number, h: number, a: number, res: { hs: number; as: number; ot?: boolean; box?: { players: Record<string, Partial<StatLine>> } }, conf: boolean, played: Map<string, StatLine>, tag?: string) {
  if (se.results.some(x => x.w === w && x.h === h && x.a === a)) return;
  const g: Result = { w, h, a, hs: res.hs, as: res.as, ot: res.ot || undefined, conf: conf || undefined, tag };
  se.results.push(g);
  if (res.box) { addStats(se, res.box.players); for (const [id, l] of Object.entries(res.box.players)) played.set(id, l as StatLine); }
  updatePower(se, g);
}
/** Play one game with the engine, no animation. */
export function simGame(h: School, a: School, d: Dynasty, seed: number) {
  const { L, game } = gameLeague(h, a, d.team, d.depth, false);
  const sim = new GameSim(L, game, seed); sim.pace = COLLEGE_PACE;
  return sim.simToEnd();
}

/** The games of a week (regular season, title games or a playoff round). */
export function weekGames(se: Season, w: number): [number, number, boolean, string?][] {
  if (w <= REG_WEEKS) return schedule()[w - 1];
  if (w === CCG_WEEK) return conferenceTitleGames(se).map(([h, a, c]) => [h, a, true, `${c} Championship`]);
  const seeds = se.playoff ?? [];
  const winner = (wk: number, x: number, y: number) => { const g = se.results.find(r => r.w === wk && ((r.h === x && r.a === y) || (r.h === y && r.a === x))); return g ? (g.hs > g.as ? g.h : g.a) : x; };
  if (w === 14) return [[seeds[4], seeds[11]], [seeds[5], seeds[10]], [seeds[6], seeds[9]], [seeds[7], seeds[8]]].map(([x, y]) => [x, y, false, 'Playoff first round']);
  const r1 = [winner(14, seeds[7], seeds[8]), winner(14, seeds[4], seeds[11]), winner(14, seeds[5], seeds[10]), winner(14, seeds[6], seeds[9])];
  const qf: [number, number][] = [[seeds[0], r1[0]], [seeds[3], r1[1]], [seeds[1], r1[3]], [seeds[2], r1[2]]];
  if (w === 15) return qf.map(([x, y]) => [x, y, false, 'Playoff quarterfinal']);
  const sf: [number, number][] = [[winner(15, ...qf[0]), winner(15, ...qf[1])], [winner(15, ...qf[2]), winner(15, ...qf[3])]];
  if (w === 16) return sf.map(([x, y]) => [x, y, false, 'Playoff semifinal']);
  if (w === 17) return [[winner(16, ...sf[0]), winner(16, ...sf[1]), false, 'National Championship']];
  return [];
}
function conferenceTitleGames(se: Season): [number, number, string][] {
  const out: [number, number, string][] = [];
  const confs = [...new Set(SCHOOLS.map(s => s.conf))].filter(c => c !== 'Independent');
  const p = se.polls[se.polls.length - 1] ?? [];
  for (const c of confs) {
    const m = SCHOOLS.filter(s => s.conf === c).sort((x, y) => {
      const a = record(x.id, se, true), b = record(y.id, se, true);
      return (b.w - b.l) - (a.w - a.l) || p.indexOf(x.id) - p.indexOf(y.id);
    });
    if (m.length >= 4) out.push([m[0].id, m[1].id, c]);
  }
  return out;
}
/** Twelve teams: the five best-ranked conference champions (top four seeded and given byes), then
 *  the next seven by ranking. */
function seedPlayoff(se: Season): number[] {
  const p = se.polls[se.polls.length - 1];
  const champs = Object.values(se.champs ?? {}).sort((a, b) => p.indexOf(a) - p.indexOf(b)).slice(0, 5);
  const at = p.filter(id => !champs.includes(id)).slice(0, 12 - champs.length);
  const byes = champs.slice(0, 4);
  const rest = [...champs.slice(4), ...at].sort((a, b) => p.indexOf(a) - p.indexOf(b));
  return [...byes, ...rest];
}

/** Advance the season one week: play every game still unplayed, develop players, re-rank. */
export function playWeek(d: Dynasty) {
  const se = d.season!;
  const w = d.week + 1;
  if (w > LAST_WEEK) return;
  const played = new Map<string, StatLine>();
  // Your game, if you coached it live this week, is already recorded; mark its players as played.
  for (const r of se.results.filter(x => x.w === w)) for (const id of [r.h, r.a]) for (const p of rosterOf(id).filter(p => p.st)) played.set(p.id, {} as StatLine);
  weekGames(se, w).forEach(([h, a, conf, tag], i) => {
    if (!h || !a || se.results.some(x => x.w === w && x.h === h && x.a === a)) return;
    const res = simGame(school(h), school(a), d, SEASON * 1000 + w * 97 + i);
    recordGame(se, w, h, a, res, conf, played, tag);
  });
  if (w === CCG_WEEK) {
    se.champs = {};
    for (const g of se.results.filter(x => x.w === CCG_WEEK)) se.champs[school(g.h).conf] = g.hs > g.as ? g.h : g.a;
  }
  develop(se, played, d.team, ((d.meters.boost ?? 50) - 50) / 250);
  applyProgress(se);
  se.polls.push(poll(se));
  if (w === CCG_WEEK) { se.playoff = seedPlayoff(se); se.awards = awards(se); se.allAmerica = allAmerica(se); }
  if (w === LAST_WEEK) { const g = se.results.find(x => x.w === LAST_WEEK); if (g) se.title = g.hs > g.as ? g.h : g.a; }
}

// ---- awards ----------------------------------------------------------------------------------
const P_BY_ID = new Map(PLAYERS.map(p => [p.id, p]));
export const playerById = (id: string) => P_BY_ID.get(id);
const col = (se: Season, id: string, k: keyof typeof ST) => se.stats[id]?.[ST[k]] ?? 0;
const teamWins = (se: Season, t: number) => record(t, se).w;
/** Award score for a player's season. */
function score(se: Season, p: Player, kind: string): number {
  const c = (k: keyof typeof ST) => col(se, p.id, k);
  const qb = c('py') / 22 + c('ptd') * 4 - c('pint') * 3 + c('ry') / 9 + c('rtd') * 5;
  const rb = c('ry') / 8 + c('rtd') * 5.5 + c('recy') / 11 + c('rectd') * 4;
  const wr = c('recy') / 8 + c('rectd') * 5.5 + c('rec') * 0.6;
  const def = c('sk') * 5 + c('int') * 6 + c('tkl') * 0.55 + c('tfl') * 2 + c('ff') * 4 + c('pbu') * 1.6;
  const win = teamWins(se, p.t) * 6;
  switch (kind) {
    case 'heisman': return (p.pos === 'QB' ? qb : p.pos === 'RB' ? rb : p.pos === 'WR' || p.pos === 'TE' ? wr * 0.95 : def * 0.7) + win + p.ovr * 0.5;
    case 'qb': return qb + win * 0.6;
    case 'rb': return rb + win * 0.3;
    case 'wr': return wr;
    case 'te': return wr + p.ovr * 0.8;
    case 'def': return def + win * 0.4 + p.ovr * 0.3;
    case 'lb': return def + p.ovr * 0.3;
    case 'db': return c('int') * 8 + c('pbu') * 2.5 + c('tkl') * 0.3 + p.ovr * 0.5;
    case 'ol': return p.ovr * 2 + win * 0.8;
    case 'k': return c('fgm') * 3 - (c('fga') - c('fgm')) * 4 + p.ovr * 0.4;
    case 'fr': return (p.pos === 'QB' ? qb : p.pos === 'RB' ? rb : p.pos === 'WR' || p.pos === 'TE' ? wr : def) + p.ovr * 0.4;
    default: return 0;
  }
}
function lineFor(se: Season, p: Player): string {
  const c = (k: keyof typeof ST) => col(se, p.id, k);
  if (p.pos === 'QB') return `${c('py').toLocaleString()} yds, ${c('ptd')} TD, ${c('pint')} INT${c('ry') > 200 ? `, ${c('ry')} rush` : ''}`;
  if (p.pos === 'RB') return `${c('ry').toLocaleString()} rush yds, ${c('rtd')} TD${c('recy') > 150 ? `, ${c('recy')} rec yds` : ''}`;
  if (p.pos === 'WR' || p.pos === 'TE') return `${c('rec')} rec, ${c('recy').toLocaleString()} yds, ${c('rectd')} TD`;
  if (p.pos === 'K' || p.pos === 'P') return `${c('fgm')}/${c('fga')} FG`;
  if (['OT', 'G', 'C'].includes(p.pos)) return `${p.ovr} OVR · ${record(p.t, se).s} team record`;
  return `${c('tkl')} tkl, ${c('tfl')} TFL, ${c('sk')} sacks, ${c('int')} INT`;
}
export const AWARDS: { id: string; name: string; desc: string; pos: string[]; kind: string; fresh?: boolean }[] = [
  { id: 'heisman', name: 'Heisman Trophy', desc: 'The most outstanding player in college football', pos: ['QB', 'RB', 'WR', 'TE', 'EDGE', 'LB', 'CB', 'S', 'DT'], kind: 'heisman' },
  { id: 'obrien', name: "Davey O'Brien Award", desc: 'The nation\'s best quarterback', pos: ['QB'], kind: 'qb' },
  { id: 'walker', name: 'Doak Walker Award', desc: 'The nation\'s best running back', pos: ['RB'], kind: 'rb' },
  { id: 'bilet', name: 'Biletnikoff Award', desc: 'The nation\'s best receiver', pos: ['WR'], kind: 'wr' },
  { id: 'mackey', name: 'John Mackey Award', desc: 'The nation\'s best tight end', pos: ['TE'], kind: 'te' },
  { id: 'outland', name: 'Outland Trophy', desc: 'The nation\'s best interior lineman', pos: ['OT', 'G', 'C', 'DT'], kind: 'ol' },
  { id: 'nagurski', name: 'Bronko Nagurski Trophy', desc: 'The nation\'s best defensive player', pos: ['EDGE', 'DT', 'LB', 'CB', 'S'], kind: 'def' },
  { id: 'butkus', name: 'Butkus Award', desc: 'The nation\'s best linebacker', pos: ['LB'], kind: 'lb' },
  { id: 'thorpe', name: 'Jim Thorpe Award', desc: 'The nation\'s best defensive back', pos: ['CB', 'S'], kind: 'db' },
  { id: 'groza', name: 'Lou Groza Award', desc: 'The nation\'s best place-kicker', pos: ['K'], kind: 'k' },
  { id: 'fresh', name: 'Freshman of the Year', desc: 'The best first-year player', pos: ['QB', 'RB', 'WR', 'TE', 'EDGE', 'LB', 'CB', 'S', 'DT'], kind: 'fr', fresh: true },
];
/** The race for an award as it stands. */
export function race(se: Season, a: (typeof AWARDS)[number], n = 5) {
  return PLAYERS.filter(p => a.pos.includes(p.pos) && (!a.fresh || p.yr === 1) && (a.kind === 'ol' || se.stats[p.id]))
    .map(p => ({ p, v: score(se, p, a.kind) })).sort((x, y) => y.v - x.v).slice(0, n)
    .map(({ p, v }) => ({ id: p.id, team: p.t, line: lineFor(se, p), v }));
}
function awards(se: Season): Award[] {
  return AWARDS.map(a => { const r = race(se, a, a.id === 'heisman' ? 4 : 3); return { id: a.id, name: a.name, desc: a.desc, winner: r[0]?.id ?? '', team: r[0]?.team ?? 0, line: r[0]?.line ?? '', finalists: r }; });
}
const AA_SLOTS: [string, number, string][] = [['QB', 1, 'qb'], ['RB', 2, 'rb'], ['WR', 3, 'wr'], ['TE', 1, 'te'], ['OT', 2, 'ol'], ['G', 2, 'ol'], ['C', 1, 'ol'], ['EDGE', 2, 'def'], ['DT', 2, 'def'], ['LB', 3, 'lb'], ['CB', 2, 'db'], ['S', 2, 'db'], ['K', 1, 'k']];
function allAmerica(se: Season) {
  return AA_SLOTS.flatMap(([pos, n, kind]) => PLAYERS.filter(p => p.pos === pos && (kind === 'ol' || se.stats[p.id])).map(p => ({ p, v: score(se, p, kind) })).sort((a, b) => b.v - a.v).slice(0, n).map(({ p }) => ({ pos, id: p.id, team: p.t })));
}
