// The dynasty save: one per program, kept in the browser. Holds the season clock, the depth
// chart order, recruiting progress and the week's decisions. Components subscribe with useDynasty.
import { useSyncExternalStore } from 'react';
import { school } from './data';
import { applyProgress, freshSeason, type Season } from './season';

export interface RecruitState {
  int: Record<number, number>; scouted: number; offered: boolean; nil: number; committed?: number; hard?: boolean; lostReason?: string; lastTouch?: number; log: string[];
  /** Recruiting v2 (all optional so older saves load; recruiting.ts migrates them). Week the
   *  action list belongs to, actions taken that week, hours spent that week and in total, the
   *  week's pitch, scouting points (0-100), stage (0 open, 1 top 8, 2 top 5, 3 top 3), the
   *  scheduled official-visit week, whether it happened, and last week's interest change. */
  wk?: number; acts?: string[]; hrs?: number; tot?: number; pitch?: string; sc?: number; stg?: number; vis?: number; visited?: boolean; dl?: number; ofw?: number;
}
export interface Dynasty {
  team: number; week: number; phase: 'preseason' | 'season' | 'postseason';
  depth: Record<string, string[]>;
  recruits: Record<string, RecruitState>; board: string[]; hours: number; nilBudget: number;
  decisions: Record<string, string>; meters: Record<string, number>;
  /** Recruiting rules version (2 = hours budget, stages, every prospect tracked) and the last week's results. */
  rv?: number; recap?: { wk: number; items: string[] };
  season?: Season;
}
const KEY = (team: number) => `ggm-college-dynasty-${team}`;
const subs = new Set<() => void>();
let cur: Dynasty | null = null;
export function fresh(team: number): Dynasty {
  return { team, week: 0, phase: 'preseason', depth: {}, recruits: {}, board: [], hours: 50, nilBudget: Math.round((school(team)?.prestige ?? 2) * 350_000), decisions: {}, meters: { chem: 60, hype: 55, buzz: 50, boost: 50, acad: 65 } };
}
export function open(team: number): Dynasty {
  if (cur?.team === team) return cur;
  try { const raw = localStorage.getItem(KEY(team)); cur = raw ? { ...fresh(team), ...JSON.parse(raw) } : fresh(team); } catch { cur = fresh(team); }
  if (!cur!.season) cur!.season = freshSeason();
  applyProgress(cur!.season);
  return cur!;
}
export function update(fn: (d: Dynasty) => void) {
  if (!cur) return;
  const next: Dynasty = JSON.parse(JSON.stringify(cur)); fn(next); cur = next;
  applyProgress(cur.season);
  try { localStorage.setItem(KEY(cur.team), JSON.stringify(cur)); } catch { /* private mode: in-memory only */ }
  subs.forEach(f => f());
}
export function useDynasty(team: number): Dynasty {
  open(team);
  return useSyncExternalStore(f => { subs.add(f); return () => subs.delete(f); }, () => open(team));
}
