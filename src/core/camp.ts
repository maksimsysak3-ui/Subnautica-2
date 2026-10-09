// Training camp for the user's team: position battles with daily camp reports, a camp
// focus with real effects, standouts and disappointments, and cut-down day decisions
// (keep, practice squad, release) that the automatic cuts respect.
import type { League, Player, Pos } from './types';
import { Rng, clamp, hash } from './rng';
import { markDepth } from './league';
import { applyEffects } from './media';
import { applyDelta } from './offseason';
import { overall } from './ratings';

export interface Battle { pos: Pos; a: string; b: string; reports: string[]; leader: string; decided?: string }
export type Focus = 'Offense Install' | 'Defense Install' | 'Rookie Academy' | 'Conditioning' | 'Team Building';
export interface CampState { season: number; battles: Battle[]; focus?: Focus; standouts: { pid: string; delta: number }[]; keep: string[] }
export const FOCUS: Record<Focus, string> = {
  'Offense Install': 'Extra reps for the offense: +500 XP for every offensive player.',
  'Defense Install': 'Extra reps for the defense: +500 XP for every defensive player.',
  'Rookie Academy': 'Rookies get the coaches\' time: +1,200 XP for every first-year player.',
  Conditioning: 'Hard camp: everyone starts at full condition with +4 morale, and momentum for week 1.',
  'Team Building': 'Retreats and team dinners: locker room +4 and +3 morale for the roster.',
};
const OFF = new Set(['QB', 'RB', 'FB', 'WR', 'TE', 'OT', 'G', 'C']), DEF = new Set(['EDGE', 'DT', 'LB', 'CB', 'S']);
const SLOTS: [Pos, number][] = [['QB', 1], ['RB', 1], ['WR', 3], ['TE', 1], ['OT', 2], ['G', 2], ['C', 1], ['EDGE', 2], ['DT', 2], ['LB', 2], ['CB', 3], ['S', 2], ['K', 1]];

export const campState = (L: League) => { const c = (L as League & { camp?: CampState }).camp; return c && c.season === L.season ? c : undefined; };

const PLUS = ['was the best player on the field in team drills', 'made a highlight play in 11-on-11s', 'won almost every one-on-one rep', 'took first-team reps and looked the part', 'drew praise from the coordinator after practice'];
const MINUS = ['had a sloppy day with two mental errors', 'was beaten repeatedly in one-on-ones', 'looked a step slow in team period', 'missed a practice with a minor tweak', 'got pulled after a blown assignment'];

/** Camp opens: find the close competitions on the user's depth chart and write the reports. */
export function openCamp(L: League) {
  const rng = new Rng(hash(`camp-${L.seed}-${L.season}`));
  const t = L.teams[L.user];
  const battles: Battle[] = [];
  // The tightest competitions on the depth chart (a promising young challenger counts as closer).
  const cands: { pos: Pos; a: Player; b: Player; gap: number }[] = [];
  for (const [pos, n] of SLOTS) {
    const ids = (t.depth[pos] ?? []).filter(id => L.players[id] && L.players[id].status === 'ACT');
    if (ids.length <= n) continue;
    const a = L.players[ids[n - 1]], b = L.players[ids[n]];   // the last starter and the first man up
    const gap = a.ovr - b.ovr - (b.exp <= 1 && b.pot >= 78 ? 3 : 0);
    if (gap <= 8) cands.push({ pos, a, b, gap });
  }
  for (const { pos, a, b } of cands.sort((x, y) => x.gap - y.gap).slice(0, 4)) {
    const score = (p: Player) => p.ovr + p.traits.work / 25 + rng.normal(0, 2.5) + (p.exp <= 1 ? 1 : 0);
    const sa = score(a), sb = score(b);
    const reports = [0, 1, 2].map(d => {
      const who = (d === 2 ? (sa >= sb ? a : b) : rng.chance(0.5) ? a : b);
      const good = d === 2 || rng.chance(0.65);
      return `Day ${d * 4 + 3}: ${who.fn} ${who.ln} ${good ? rng.pick(PLUS) : rng.pick(MINUS)}.`;
    });
    battles.push({ pos, a: a.id, b: b.id, reports, leader: sa >= sb ? a.id : b.id });
  }
  // Standouts and disappointments: camp moves a few ratings a little.
  const roster = Object.values(L.players).filter(p => p.team === L.user && p.status === 'ACT');
  const standouts: { pid: string; delta: number }[] = [];
  for (const p of rng.shuffle(roster.slice()).slice(0, 6)) {
    const delta = p.age <= 25 && rng.chance(0.6 + p.traits.work / 400) ? rng.int(1, 3) : -(p.ovr >= 88 ? 1 : rng.int(1, 2));
    applyDelta(p, delta, rng); p.ovr = overall(p.pos, p.attrs);
    standouts.push({ pid: p.id, delta });
  }
  (L as League & { camp?: CampState }).camp = { season: L.season, battles, standouts, keep: [] };
}

/** Name a winner: he starts ahead of the other man; the loser takes it hard. */
export function decideBattle(L: League, pos: Pos, winner: string) {
  const c = campState(L); const b = c?.battles.find(x => x.pos === pos); if (!b || b.decided) return;
  const loser = winner === b.a ? b.b : b.a;
  const t = L.teams[L.user], d = t.depth[pos] ?? [];
  const wi = d.indexOf(winner), li = d.indexOf(loser);
  if (wi > li && li >= 0) { d[li] = winner; d[wi] = loser; }
  markDepth(t, pos);
  b.decided = winner;
  applyEffects(L, { players: [{ pid: winner, delta: 6 }, { pid: loser, delta: -6 }] });
}
/** Let them compete: whoever had the better camp wins it. */
export const settleBattle = (L: League, pos: Pos) => { const b = campState(L)?.battles.find(x => x.pos === pos); if (b && !b.decided) decideBattle(L, pos, b.leader); };

export function setFocus(L: League, f: Focus) {
  const c = campState(L); if (!c || c.focus) return;
  c.focus = f;
  const roster = Object.values(L.players).filter(p => p.team === L.user && p.status !== 'RET');
  if (f === 'Offense Install') for (const p of roster) if (OFF.has(p.pos)) p.xp += 500;
  if (f === 'Defense Install') for (const p of roster) if (DEF.has(p.pos)) p.xp += 500;
  if (f === 'Rookie Academy') for (const p of roster) if (p.exp === 0) p.xp += 1200;
  if (f === 'Conditioning') { for (const p of roster) { p.cond = 100; p.morale = clamp(p.morale + 4, 0, 100); } applyEffects(L, { momentum: 0.5 }); }
  if (f === 'Team Building') { for (const p of roster) p.morale = clamp(p.morale + 3, 0, 100); applyEffects(L, { locker: 4 }); }
}

/** Cut-down day: the players fighting for the last spots on the 53. */
export function bubble(L: League): Player[] {
  const roster = Object.values(L.players).filter(p => p.team === L.user && (p.status === 'ACT' || p.status === 'PS'));
  const val = (p: Player) => p.ovr + (p.pot - p.ovr) * (p.age <= 24 ? 0.5 : 0.1) + (p.contract.years.find(y => y.s === L.season)?.gtd ? 6 : 0);
  return roster.sort((a, b) => val(b) - val(a)).slice(44, 70);
}
export const protectedByUser = (L: League, p: Player) => !!campState(L)?.keep.includes(p.id);
export function keepPlayer(L: League, p: Player) { const c = campState(L); if (c && !c.keep.includes(p.id)) c.keep.push(p.id); p.status = 'ACT'; }
