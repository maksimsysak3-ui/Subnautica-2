// The dynasty save: one per program, kept in the browser. Holds the season clock, the depth
// chart order, recruiting progress and the week's decisions. Components subscribe with useDynasty.
import { useSyncExternalStore } from 'react';
import { school } from './data';

export interface RecruitState { int: Record<number, number>; scouted: number; offered: boolean; nil: number; committed?: number; hard?: boolean; lostReason?: string; lastTouch?: number; log: string[] }
export interface Dynasty {
  team: number; week: number; phase: 'preseason' | 'season' | 'postseason';
  depth: Record<string, string[]>;
  recruits: Record<string, RecruitState>; board: string[]; hours: number; nilBudget: number;
  decisions: Record<string, string>; meters: Record<string, number>;
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
  return cur!;
}
export function update(fn: (d: Dynasty) => void) {
  if (!cur) return;
  const next: Dynasty = JSON.parse(JSON.stringify(cur)); fn(next); cur = next;
  try { localStorage.setItem(KEY(cur.team), JSON.stringify(cur)); } catch { /* private mode: in-memory only */ }
  subs.forEach(f => f());
}
export function useDynasty(team: number): Dynasty {
  open(team);
  return useSyncExternalStore(f => { subs.add(f); return () => subs.delete(f); }, () => open(team));
}
