// Weekly practice: Wednesday, Thursday and Friday, one period each, with an intensity.
// Every drill does something real: a game-plan install sharpens the unit for Sunday,
// ball security cuts turnovers, red-zone periods help inside the twenty, two-minute
// work helps late in halves, position drills and development reps add XP, a walkthrough
// saves legs. Full pads teach more but tire players and can hurt someone.
// AI teams are assumed to have an ordinary week; an ordinary week for the user plays
// the same, so a smart plan is an edge and a careless one is not a penalty.
import type { League, Pos } from './types';
import { Rng, clamp, hash } from './rng';
import { mail, news, spendXp } from './season';
import { DEV_MULT, OVR_W, overall } from './ratings';
import type { Attr } from './types';

export type Drill = 'install-off' | 'install-def' | 'red-zone' | 'two-minute' | 'ball' | 'pass-rush' | 'seven' | 'tackling' | 'walkthrough' | 'position' | 'youth';
export type Pads = 'Shells' | 'Full Pads';
export const DRILLS: Record<Drill, { name: string; icon: string; desc: string; unit: 'off' | 'def' | 'team' }> = {
  'install-off': { name: 'Offensive Install', icon: 'OI', desc: 'Game-plan the opponent\'s defense: offense sharper on Sunday.', unit: 'off' },
  'install-def': { name: 'Defensive Install', icon: 'DI', desc: 'Game-plan their offense: defense sharper on Sunday.', unit: 'def' },
  'red-zone': { name: 'Red Zone Period', icon: 'RZ', desc: 'Tight-window throws and goal-line runs inside the twenty.', unit: 'off' },
  'two-minute': { name: 'Two-Minute Drill', icon: '2M', desc: 'Hurry-up operation for the end of halves.', unit: 'off' },
  ball: { name: 'Ball Security', icon: 'BS', desc: 'Gauntlet and strip drills: fewer fumbles and interceptions.', unit: 'off' },
  'pass-rush': { name: 'Pass Rush 1-on-1s', icon: 'PR', desc: 'Rushers against blockers: more pressure on Sunday.', unit: 'def' },
  seven: { name: '7-on-7', icon: '7v7', desc: 'Routes against coverage, no linemen: passing game and coverage both improve.', unit: 'team' },
  tackling: { name: 'Tackling Circuit', icon: 'TK', desc: 'Angles and wrap-ups: fewer broken tackles.', unit: 'def' },
  walkthrough: { name: 'Walkthrough', icon: 'WT', desc: 'Helmets only. Mental reps, legs saved: extra recovery.', unit: 'team' },
  position: { name: 'Position Drills', icon: 'PD', desc: 'Coaches work one position group: extra development for it.', unit: 'team' },
  youth: { name: 'Development Reps', icon: 'DV', desc: 'Young players and backups get the reps: extra XP for players 25 and under.', unit: 'team' },
};
export const DAYS = ['Wednesday', 'Thursday', 'Friday'] as const;
export interface Session { drill: Drill; pads: Pads; group?: Pos }
export interface PracticeEdge { off: number; def: number; ball: number; rz: number; late: number; rush: number; tackle: number }
export type Part = 'DNP' | 'Limited' | 'Full';
export type Status = 'Out' | 'Doubtful' | 'Questionable';
export interface Top { pid: string; from: number; to: number; xp: number; attr?: string }
export interface PracticeReport { day: string; drill: Drill; grade: string; note: string; top: Top[]; hurt?: string; dinged?: string; moment?: string }
/** One line of the official injury report. `plays` is decided Friday and revealed at kickoff. */
export interface InjuryLine { pid: string; team: string; injury: string; part: Part[]; status?: Status; plays: boolean; isNew?: boolean }
export interface PracticeWeek { season: number; week: number; sessions: Session[]; day: number; done: boolean; edge: PracticeEdge; report: PracticeReport[]; injuries: InjuryLine[]; acc?: PracticeEdge; restVets?: boolean }

const ZERO: PracticeEdge = { off: 0, def: 0, ball: 0, rz: 0, late: 0, rush: 0, tackle: 0 };
export const defaultSessions = (): Session[] => [{ drill: 'install-off', pads: 'Shells' }, { drill: 'install-def', pads: 'Shells' }, { drill: 'walkthrough', pads: 'Shells' }];
type LP = League & { practice?: PracticeWeek };
export function practiceWeek(L: League): PracticeWeek {
  const S = L as LP;
  if (!S.practice || S.practice.season !== L.season || S.practice.week !== L.week) S.practice = { season: L.season, week: L.week, sessions: defaultSessions(), day: 0, done: false, edge: { ...ZERO }, report: [], injuries: [] };
  S.practice.injuries ??= []; S.practice.day ??= S.practice.done ? 3 : 0;
  return S.practice;
}
/** The game-day edge for a team this week. AI teams and an unpracticed user week: ordinary. */
export function practiceEdge(L: League, team: string): PracticeEdge {
  const p = (L as LP).practice;
  if (team !== L.user || !p || !p.done || p.season !== L.season || p.week !== L.week) return ZERO;
  return p.edge;
}
const GRADE = (q: number) => (q >= 0.85 ? 'A' : q >= 0.7 ? 'B+' : q >= 0.55 ? 'B' : q >= 0.4 ? 'C+' : q >= 0.25 ? 'C' : 'D');

const userGame = (L: League) => L.games.find(g => g.season === L.season && g.week === L.week && (g.home === L.user || g.away === L.user));
const DINGS = ['Knee', 'Ankle', 'Hamstring', 'Shoulder', 'Back', 'Groin', 'Illness', 'Calf', 'Hip', 'Wrist', 'Foot', 'Quad', 'Toe', 'Hand', 'Neck', 'Elbow'];
export const REST = 'Rest (not injury related)';

/** Run one practice day (the next one). Returns the day's report, or null when the week is done. */
export function runDay(L: League): PracticeReport | null {
  const w = practiceWeek(L);
  if (w.done || w.day >= 3) return null;
  const i = w.day;
  const rng = new Rng(hash(`prac-${L.seed}-${L.season}-${L.week}-${i}`));
  const roster = Object.values(L.players).filter(p => p.team === L.user && p.status === 'ACT' && !p.injury);
  const awr = roster.reduce((a, p) => a + p.attrs.AWR, 0) / Math.max(1, roster.length);
  const work = roster.reduce((a, p) => a + p.traits.work, 0) / Math.max(1, roster.length);
  const e = (w.acc ??= { ...ZERO });
  if (i === 0) openReport(L, w, rng);
  const s = w.sessions[i];
  const full = s.pads === 'Full Pads';
  // Repeating a drill in one week has diminishing returns.
  const fresh = w.sessions.slice(0, i).some(x => x.drill === s.drill) ? 0.5 : 1;
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
  if (full) for (const p of pool) p.cond = clamp(p.cond - 4, 0, 100);
  if (w.restVets && i === 0) for (const p of roster) if (p.age >= 30) p.cond = clamp(p.cond + 8, 0, 100);
  const moment = practiceMoment(L, roster, s.drill, rng);
  // A real practice injury (full pads), or a ding that puts someone on the report.
  let hurt: string | undefined, dinged: string | undefined;
  if (full && rng.chance(w.restVets ? 0.05 : 0.08) || !full && rng.chance(0.015)) {
    const p = rng.pick(pool.filter(x => x.ovr < 90).length ? pool.filter(x => x.ovr < 90) : pool);
    if (p) { p.injury = { type: rng.pick(['Hamstring', 'Ankle Sprain', 'Shoulder', 'Knee Sprain']), weeks: rng.int(2, 3) }; hurt = `${p.pos} ${p.fn} ${p.ln} (${p.injury.type})`; w.injuries.push({ pid: p.id, team: L.user, injury: p.injury.type, part: [...Array(i).fill('Full'), 'DNP'], status: 'Out', plays: false, isNew: true }); mail(L, 'Head Trainer', `${p.ln} hurt in practice`, `${p.fn} ${p.ln} went down in a full-pads ${DRILLS[s.drill].name.toLowerCase()} and will miss ${p.injury.weeks} week(s).`); }
  } else if (rng.chance((full ? 0.24 : 0.13) * (w.restVets ? 0.7 : 1))) {
    const cand = roster.filter(x => !w.injuries.some(l => l.pid === x.id));
    const p = cand.length ? rng.pick(cand) : undefined;
    if (p) { const inj = rng.pick(DINGS); w.injuries.push({ pid: p.id, team: L.user, injury: inj, part: [...Array(i).fill('Full'), rng.chance(0.5) ? 'Limited' : 'DNP'], plays: rng.chance(0.72), isNew: true }); dinged = `${p.pos} ${p.fn} ${p.ln}: new ${inj.toLowerCase()} injury`; }
  }
  // Report lines for anyone already on it: today's participation.
  for (const l of w.injuries) if (l.part.length <= i) l.part.push(l.status === 'Out' ? 'DNP' : partFor(l, i, rng));
  // Top performers: the day's best reps, with XP that can tick a rating.
  const top: Top[] = [];
  const ranked = pool.filter(p => !w.injuries.some(l => l.pid === p.id && l.part[i] === 'DNP')).map(p => ({ p, v: p.ovr * 0.35 + p.traits.work * 0.3 + rng.next() * 45 })).sort((a, b) => b.v - a.v).slice(0, 3);
  for (const { p } of ranked) {
    const from = p.ovr, xp = Math.round(30 + q * 20);
    p.xp += xp; p.morale = clamp(p.morale + 1, 0, 100);
    spendXp(p);
    // A good day can sharpen one of the skills that matter at his spot (+1, up to his ceiling).
    let attr: string | undefined;
    if (rng.chance(0.3 + q * 0.2)) {
      const keys = Object.entries(OVR_W[p.pos] ?? {}).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0)).slice(0, 4).map(([k]) => k as Attr).filter(k => p.attrs[k] < 99);
      const k2 = keys.length ? rng.pick(keys) : undefined;
      if (k2 && p.ovr < p.pot + 2) { p.attrs[k2]++; p.ovr = overall(p.pos, p.attrs); attr = k2; }
    }
    top.push({ pid: p.id, from, to: p.ovr, xp, attr });
  }
  const r: PracticeReport = { day: DAYS[i], drill: s.drill, grade: GRADE(q), note, top, hurt, dinged, moment };
  w.report.push(r);
  w.day++;
  if (w.day >= 3) finishWeek(L, w);
  return r;
}
/** Participation for a report line on day `i`, trending toward the game status. */
function partFor(l: InjuryLine, i: number, rng: Rng): Part {
  if (l.injury === REST) return i === 0 ? 'DNP' : 'Full';
  if (l.plays && !l.isNew && i === 2 && rng.chance(0.5)) return 'Full';
  const good = l.plays ? 0.35 + i * 0.3 : 0.1 + i * 0.1;
  return rng.chance(good) ? (i === 2 && l.plays && rng.chance(0.25) ? 'Full' : 'Limited') : rng.chance(0.5) ? 'Limited' : 'DNP';
}
/** Wednesday's report: anyone hurt on either team is listed; returning players may be game-time decisions. */
function openReport(L: League, w: PracticeWeek, rng: Rng) {
  const g = userGame(L);
  const teams = g ? [g.home, g.away] : [L.user];
  w.injuries = [];
  for (const t of teams) for (const p of Object.values(L.players)) {
    if (p.team !== t || !p.injury || p.status === 'RET') continue;
    if (p.injury.weeks >= 2 || /Suspended|Personal/.test(p.injury.type)) { w.injuries.push({ pid: p.id, team: t, injury: p.injury.type, part: [], status: 'Out', plays: false }); continue; }
    // Due back next week: a chance he is ready early.
    const roll = rng.next();
    w.injuries.push({ pid: p.id, team: t, injury: p.injury.type, part: [], plays: roll < 0.4, status: undefined });
  }
  // Nobody is fully healthy in November. Every week a handful of players on each side are
  // banged up and limited (most still play), two or three can't go (usually backups), and
  // the coaches rest a veteran or two on Wednesday.
  const late = Math.min(1, Math.max(0, (L.week - 1) / 14));
  for (const t of teams) {
    const healthy = Object.values(L.players).filter(p => p.team === t && p.status === 'ACT' && !p.injury && !w.injuries.some(l => l.pid === p.id));
    const byPos = new Map<string, number>();
    const starter = new Set(healthy.slice().sort((a, b) => b.ovr - a.ovr).filter(p => { const n = byPos.get(p.pos) ?? 0; byPos.set(p.pos, n + 1); return n < (STARTERS[p.pos] ?? 1); }).map(p => p.id));
    const take = (n: number, wStarter: number) => {
      const out: typeof healthy = [];
      for (let k = 0; k < n; k++) {
        const pool = healthy.filter(p => !out.includes(p) && !w.injuries.some(l => l.pid === p.id));
        if (!pool.length) break;
        out.push(rng.weighted(pool.map(p => [p, (starter.has(p.id) ? wStarter : 1) * (p.age >= 29 ? 1.4 : 1)] as [typeof p, number])));
      }
      return out;
    };
    const outNow = w.injuries.filter(l => l.team === t && !l.plays).length;
    for (const p of take(Math.max(0, rng.int(2, 3) - outNow), 0.35)) w.injuries.push({ pid: p.id, team: t, injury: rng.pick(DINGS), part: [], plays: false });
    for (const p of take(rng.int(4, 6) + Math.round(late * 2), 0.9)) w.injuries.push({ pid: p.id, team: t, injury: rng.pick(DINGS), part: [], plays: rng.chance(0.9) });
    const vets = healthy.filter(p => p.age >= 31 && starter.has(p.id) && !w.injuries.some(l => l.pid === p.id));
    const rest = t === L.user && w.restVets ? vets : vets.filter(() => rng.chance(0.25)).slice(0, 2);
    for (const p of rest) w.injuries.push({ pid: p.id, team: t, injury: REST, part: [], plays: true });
  }
}
/** Friday: designations, game-time decisions settled (and hidden), the Sunday edge. */
function finishWeek(L: League, w: PracticeWeek) {
  const e = w.acc ?? { ...ZERO };
  w.edge = { off: Math.min(0.9, e.off), def: Math.min(0.9, e.def), ball: Math.min(0.3, e.ball), rz: Math.min(1, e.rz), late: Math.min(1, e.late), rush: Math.min(0.3, e.rush), tackle: Math.min(0.25, e.tackle) };
  for (const l of w.injuries) {
    if (l.status === 'Out') continue;
    if (l.injury === REST) { l.status = undefined; continue; }
    const fri = l.part[2] ?? 'DNP';
    // Questionable players usually play; doubtful ones usually don't.
    l.status = l.plays ? (fri === 'Full' ? undefined : 'Questionable') : fri === 'DNP' && !l.isNew ? 'Out' : rng2(l) < 0.3 ? 'Questionable' : 'Doubtful';
    const p = L.players[l.pid]; if (!p) continue;
    // Settle it now: ready players are cleared, dinged players who can't go sit this week.
    if (l.plays && p.injury && p.injury.weeks <= 1) p.injury = undefined;
    else if (!l.plays && !p.injury) p.injury = { type: l.injury, weeks: 1 };
  }
  w.done = true;
  const best = w.report.flatMap(r => r.top.map(t => ({ ...t, r }))).sort((a, b) => (b.to - b.from) - (a.to - a.from))[0];
  if (best && best.to > best.from) { const p = L.players[best.pid]; news(L, 'milestone', `Practice report: ${p.fn} ${p.ln} stood out all week and is up to ${best.to} OVR.`, [L.user]); }
}
const rng2 = (l: InjuryLine) => (Math.abs(hash(`des-${l.pid}`)) % 1000) / 1000;
/** Run whatever is left of the week at once (when the user skips straight to the game). */
export function runPractice(L: League): PracticeWeek {
  const w = practiceWeek(L);
  while (!w.done && runDay(L)) { /* next day */ }
  return w;
}

const STARTERS: Record<string, number> = { QB: 1, RB: 1, WR: 3, TE: 1, OT: 2, G: 2, C: 1, EDGE: 2, DT: 2, LB: 2, CB: 3, S: 2, K: 1, P: 1 };

/** Something that happened around practice: the stuff that makes a week feel lived in. */
function practiceMoment(L: League, roster: League['players'][string][], drill: Drill, rng: Rng): string | undefined {
  if (!roster.length || !rng.chance(0.6)) return undefined;
  const pick = (f: (p: (typeof roster)[number]) => boolean) => { const c = roster.filter(f); return c.length ? rng.pick(c) : undefined; };
  const nm = (p: (typeof roster)[number]) => `${p.fn[0]}. ${p.ln}`;
  const opts: (() => string | undefined)[] = [
    () => { const a = pick(p => p.pos === 'WR'), b = pick(p => p.pos === 'CB'); if (!a || !b) return; a.xp += 40; b.xp += 40; return `${nm(a)} and ${nm(b)} went at it in one-on-ones all period. Both got better for it.`; },
    () => { const a = pick(p => ['OT', 'G', 'C'].includes(p.pos)), b = pick(p => ['EDGE', 'DT'].includes(p.pos)); if (!a || !b) return; a.morale = clamp(a.morale - 2, 0, 100); b.morale = clamp(b.morale - 2, 0, 100); return `A scuffle broke out between ${nm(a)} and ${nm(b)} after the whistle. The coaches separated them; nobody's apologizing yet.`; },
    () => { const p = pick(x => x.exp === 0); if (!p) return; p.xp += 35; return `Rookie ${nm(p)} lined up wrong twice and heard about it from his position coach. He stayed late on the board.`; },
    () => { const p = pick(x => x.exp >= 8); if (!p) return; for (const q of roster) q.morale = clamp(q.morale + 1, 0, 100); return `${nm(p)} broke the team down at the end of practice. The room was locked in.`; },
    () => { const p = pick(x => x.pos === 'QB'); if (!p || drill !== 'seven' && drill !== 'two-minute' && drill !== 'red-zone') return; return rng.chance(0.5) ? `${nm(p)} threw two picks in the period and slammed his helmet. The defense let him hear it.` : `${nm(p)} went 14-for-15 in the period. The defense couldn't get a hand on anything.`; },
    () => { const p = pick(x => x.exp <= 1 && x.ovr < 68); if (!p) return; p.xp += 60; p.morale = clamp(p.morale + 3, 0, 100); return `Scout-team player of the day: ${nm(p)}, who gave the starters a perfect look at what they'll see Sunday.`; },
    () => { for (const q of roster) q.cond = clamp(q.cond - 2, 0, 100); return L.week >= 12 ? 'Cold, wet and miserable out there. A few guys are moving slow.' : 'Ninety-plus degrees on the field. The trainers were busy with fluids.'; },
    () => { const p = pick(x => x.pos === 'K'); if (!p) return; return rng.chance(0.6) ? `${nm(p)} drilled a 58-yarder at the end of practice and the whole team mobbed him.` : `${nm(p)} pushed three kicks wide right. The special teams coordinator watched every one.`; },
    () => { const p = pick(x => x.ovr >= 80); if (!p) return; return `${nm(p)} spent a half-hour after practice signing for kids from the youth camp.`; },
  ];
  for (let k = 0; k < 4; k++) { const m = rng.pick(opts)(); if (m) return m; }
  return undefined;
}
