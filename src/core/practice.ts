// Weekly practice: Wednesday, Thursday and Friday, one period each, with an intensity.
// Every drill does something real: a game-plan install sharpens the unit for Sunday,
// ball security cuts turnovers, red-zone periods help inside the twenty, two-minute
// work helps late in halves, position drills and development reps add XP, a walkthrough
// saves legs. Full pads teach more but tire players and can hurt someone.
// AI teams are assumed to have an ordinary week; an ordinary week for the user plays
// the same, so a smart plan is an edge and a careless one is not a penalty.
import type { League, Player, Pos } from './types';
import { Rng, clamp, hash } from './rng';
import { mail, news } from './season';
import { DEV_MULT } from './ratings';

export type Drill = 'install-off' | 'install-def' | 'red-zone' | 'two-minute' | 'ball' | 'pass-rush' | 'seven' | 'tackling' | 'walkthrough' | 'position' | 'youth';
export type Pads = 'Shells' | 'Full Pads';
export const DRILLS: Record<Drill, { name: string; icon: string; desc: string; unit: 'off' | 'def' | 'team' }> = {
  'install-off': { name: 'Offensive Install', icon: '📋', desc: 'Game-plan the opponent\'s defense: offense sharper on Sunday.', unit: 'off' },
  'install-def': { name: 'Defensive Install', icon: '🛡', desc: 'Game-plan their offense: defense sharper on Sunday.', unit: 'def' },
  'red-zone': { name: 'Red Zone Period', icon: '🎯', desc: 'Tight-window throws and goal-line runs inside the twenty.', unit: 'off' },
  'two-minute': { name: 'Two-Minute Drill', icon: '⏱', desc: 'Hurry-up operation for the end of halves.', unit: 'off' },
  ball: { name: 'Ball Security', icon: '🏈', desc: 'Gauntlet and strip drills: fewer fumbles and interceptions.', unit: 'off' },
  'pass-rush': { name: 'Pass Rush 1-on-1s', icon: '⚡', desc: 'Rushers against blockers: more pressure on Sunday.', unit: 'def' },
  seven: { name: '7-on-7', icon: '↗', desc: 'Routes against coverage, no linemen: passing game and coverage both improve.', unit: 'team' },
  tackling: { name: 'Tackling Circuit', icon: '✊', desc: 'Angles and wrap-ups: fewer broken tackles.', unit: 'def' },
  walkthrough: { name: 'Walkthrough', icon: '🚶', desc: 'Helmets only. Mental reps, legs saved: extra recovery.', unit: 'team' },
  position: { name: 'Position Drills', icon: '🎓', desc: 'Coaches work one position group: extra development for it.', unit: 'team' },
  youth: { name: 'Development Reps', icon: '🌱', desc: 'Young players and backups get the reps: extra XP for players 25 and under.', unit: 'team' },
};
export const DAYS = ['Wednesday', 'Thursday', 'Friday'] as const;
export interface Session { drill: Drill; pads: Pads; group?: Pos }
export interface PracticeEdge { off: number; def: number; ball: number; rz: number; late: number; rush: number; tackle: number }
export interface PracticeReport { day: string; drill: Drill; grade: string; note: string; star?: string; hurt?: string }
export interface PracticeWeek { season: number; week: number; sessions: Session[]; done: boolean; edge: PracticeEdge; report: PracticeReport[] }

const ZERO: PracticeEdge = { off: 0, def: 0, ball: 0, rz: 0, late: 0, rush: 0, tackle: 0 };
export const defaultSessions = (): Session[] => [{ drill: 'install-off', pads: 'Shells' }, { drill: 'install-def', pads: 'Shells' }, { drill: 'walkthrough', pads: 'Shells' }];
type LP = League & { practice?: PracticeWeek };
export function practiceWeek(L: League): PracticeWeek {
  const S = L as LP;
  if (!S.practice || S.practice.season !== L.season || S.practice.week !== L.week) S.practice = { season: L.season, week: L.week, sessions: defaultSessions(), done: false, edge: { ...ZERO }, report: [] };
  return S.practice;
}
/** The game-day edge for a team this week. AI teams and an unpracticed user week: ordinary. */
export function practiceEdge(L: League, team: string): PracticeEdge {
  const p = (L as LP).practice;
  if (team !== L.user || !p || !p.done || p.season !== L.season || p.week !== L.week) return ZERO;
  return p.edge;
}
const GRADE = (q: number) => (q >= 0.85 ? 'A' : q >= 0.7 ? 'B+' : q >= 0.55 ? 'B' : q >= 0.4 ? 'C+' : q >= 0.25 ? 'C' : 'D');

/** Run the week's practice: grades, standouts, the edge for Sunday, XP, fatigue, injuries. */
export function runPractice(L: League): PracticeWeek {
  const w = practiceWeek(L);
  if (w.done) return w;
  const rng = new Rng(hash(`prac-${L.seed}-${L.season}-${L.week}`));
  const roster = Object.values(L.players).filter(p => p.team === L.user && p.status === 'ACT' && !p.injury);
  const awr = roster.reduce((a, p) => a + p.attrs.AWR, 0) / Math.max(1, roster.length);
  const work = roster.reduce((a, p) => a + p.traits.work, 0) / Math.max(1, roster.length);
  const e: PracticeEdge = { ...ZERO };
  const seen = new Map<Drill, number>();
  w.report = [];
  w.sessions.forEach((s, i) => {
    const full = s.pads === 'Full Pads';
    // Repeating a drill in one week has diminishing returns.
    const rep = (seen.get(s.drill) ?? 0); seen.set(s.drill, rep + 1);
    const fresh = rep ? 0.5 : 1;
    const q = clamp(0.35 + (awr - 70) / 60 + (work - 50) / 200 + (full ? 0.1 : 0) + rng.normal(0, 0.18), 0, 1);
    const k = (0.6 + q * 0.8) * (full ? 1.35 : 1) * fresh;
    const pool = roster.filter(p => s.drill === 'position' ? p.pos === s.group : DRILLS[s.drill].unit === 'off' ? ['QB', 'RB', 'WR', 'TE', 'OT', 'G', 'C', 'FB'].includes(p.pos) : DRILLS[s.drill].unit === 'def' ? ['EDGE', 'DT', 'LB', 'CB', 'S'].includes(p.pos) : true);
    let note = '';
    switch (s.drill) {
      case 'install-off': e.off += 0.35 * k; note = 'The offense has the plan down.'; break;
      case 'install-def': e.def += 0.35 * k; note = 'The defense knows every look they will see.'; break;
      case 'red-zone': e.rz += 0.5 * k; note = 'Crisp inside the twenty.'; break;
      case 'two-minute': e.late += 0.5 * k; note = 'The hurry-up is humming.'; break;
      case 'ball': e.ball += 0.12 * k; note = 'Nobody put it on the ground.'; break;
      case 'pass-rush': e.rush += 0.12 * k; note = 'The rushers won most of their reps.'; break;
      case 'seven': e.off += 0.15 * k; e.def += 0.15 * k; note = 'Good timing on both sides of the ball.'; break;
      case 'tackling': e.tackle += 0.1 * k; e.def += 0.1 * k; note = 'Sure tackling all period.'; break;
      case 'walkthrough': for (const p of roster) p.cond = clamp(p.cond + 7, 0, 100); note = 'Fresh legs for Sunday.'; break;
      case 'position': for (const p of pool) p.xp += 70 * k * DEV_MULT[p.dev]; note = `The ${s.group} room got extra coaching.`; break;
      case 'youth': for (const p of roster.filter(x => x.age <= 25)) p.xp += 45 * k * DEV_MULT[p.dev]; note = 'The young players took a lot of reps.'; break;
    }
    // Full pads: more fatigue, a little injury risk.
    if (full) for (const p of pool) p.cond = clamp(p.cond - 4, 0, 100);
    let hurt: string | undefined;
    if (full && rng.chance(0.06)) {
      const p = rng.pick(pool.filter(x => x.ovr < 90).length ? pool.filter(x => x.ovr < 90) : pool);
      if (p) { p.injury = { type: rng.pick(['Hamstring', 'Ankle Sprain', 'Shoulder', 'Knee Bruise']), weeks: rng.int(1, 2) }; hurt = `${p.pos} ${p.fn} ${p.ln} (${p.injury.type}, ${p.injury.weeks}w)`; mail(L, 'Head Trainer', `${p.ln} hurt in practice`, `${p.fn} ${p.ln} went down in a full-pads ${DRILLS[s.drill].name.toLowerCase()} and will miss ${p.injury.weeks} week(s).`); }
    }
    // The practice player of the day: XP and a morale bump.
    const star = pool.length ? pool.map(p => ({ p, v: p.ovr * 0.4 + p.traits.work * 0.3 + rng.next() * 40 })).sort((a, b) => b.v - a.v)[0].p as Player : undefined;
    if (star) { star.xp += 40; star.morale = clamp(star.morale + 2, 0, 100); }
    w.report.push({ day: DAYS[i], drill: s.drill, grade: GRADE(q), note, star: star ? `${star.pos} ${star.fn} ${star.ln}` : undefined, hurt });
  });
  // Edges are capped: practice helps, it doesn't turn a team over.
  w.edge = { off: Math.min(0.9, e.off), def: Math.min(0.9, e.def), ball: Math.min(0.3, e.ball), rz: Math.min(1, e.rz), late: Math.min(1, e.late), rush: Math.min(0.3, e.rush), tackle: Math.min(0.25, e.tackle) };
  w.done = true;
  const best = w.report.find(r => r.grade === 'A');
  if (best?.star) news(L, 'milestone', `Practice report: ${best.star} stood out in ${DRILLS[best.drill].name.toLowerCase()} on ${best.day}.`, [L.user]);
  return w;
}
