// App state: the live league (mutable), a version counter React subscribes to,
// navigation, and IndexedDB saves (leagues are megabytes, too big for localStorage).
import { useSyncExternalStore } from 'react';
import type { League } from '../core/types';

export type Screen =
  | { id: 'menu' } | { id: 'new' } | { id: 'load' }
  | { id: 'hub' } | { id: 'roster'; team?: string } | { id: 'player'; pid: string } | { id: 'depth' } | { id: 'plan' }
  | { id: 'schedule' } | { id: 'standings' } | { id: 'stats' } | { id: 'trade'; team?: string; want?: string } | { id: 'fa' }
  | { id: 'resign' } | { id: 'draft' } | { id: 'coach' } | { id: 'cap' } | { id: 'news' } | { id: 'inbox' }
  | { id: 'game'; gid: string } | { id: 'preview'; gid: string } | { id: 'gameday' } | { id: 'options' } | { id: 'box'; gid: string } | { id: 'history' } | { id: 'team'; team: string }
  | { id: 'teamstats' } | { id: 'lgteamstats' } | { id: 'progress' } | { id: 'block' } | { id: 'finder' } | { id: 'offers' } | { id: 'tradehist' } | { id: 'chart' } | { id: 'scouting' } | { id: 'power' } | { id: 'awards' } | { id: 'injuries' };

interface State { league: League | null; screen: Screen; back: Screen[]; toast: string | null; busy: string | null; v: number }
const state: State = { league: null, screen: { id: 'menu' }, back: [], toast: null, busy: null, v: 0 };
const subs = new Set<() => void>();
const emit = () => { state.v++; for (const s of subs) s(); };
let snap = { ...state };
const getSnap = () => snap;
const subscribe = (f: () => void) => { subs.add(f); return () => subs.delete(f); };
function commit() { snap = { ...state }; emit(); }

export function useApp() { return useSyncExternalStore(subscribe, getSnap); }
export const app = {
  get league() { return state.league!; },
  setLeague(l: League | null) { state.league = l; commit(); },
  /** Call after mutating the league so the UI re-renders. */
  touch() { commit(); },
  go(s: Screen) { state.back.push(state.screen); if (state.back.length > 30) state.back.shift(); state.screen = s; commit(); window.scrollTo({ top: 0 }); },
  replace(s: Screen) { state.screen = s; commit(); },
  backTo() { const s = state.back.pop(); if (s) { state.screen = s; commit(); } },
  toast(msg: string) { state.toast = msg; commit(); setTimeout(() => { if (state.toast === msg) { state.toast = null; commit(); } }, 2600); },
  async busy<T>(label: string, f: () => Promise<T> | T): Promise<T> {
    state.busy = label; commit();
    await new Promise(r => setTimeout(r, 30));
    try { return await f(); } finally { state.busy = null; commit(); }
  },
};

// ---- saves --------------------------------------------------------------------------------
const DB = 'gridiron-gm', STORE = 'saves';
function db(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
export interface SaveMeta { slot: string; name: string; team: string; season: number; phase: string; week: number; saved: number }
export async function saveLeague(league: League, slot = league.id) {
  try {
    const d = await db();
    const meta: SaveMeta = { slot, name: league.name, team: league.user, season: league.season, phase: league.phase, week: league.week, saved: Date.now() };
    await new Promise<void>((res, rej) => {
      const tx = d.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put({ meta, league }, slot);
      tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error);
    });
    return true;
  } catch (e) { console.warn('save failed', e); return false; }
}
export async function listSaves(): Promise<SaveMeta[]> {
  try {
    const d = await db();
    return await new Promise((res, rej) => {
      const out: SaveMeta[] = [];
      const tx = d.transaction(STORE, 'readonly');
      const cur = tx.objectStore(STORE).openCursor();
      cur.onsuccess = () => { const c = cur.result; if (c) { out.push((c.value as { meta: SaveMeta }).meta); c.continue(); } else res(out.sort((a, b) => b.saved - a.saved)); };
      cur.onerror = () => rej(cur.error);
    });
  } catch { return []; }
}
export async function loadLeague(slot: string): Promise<League | null> {
  try {
    const d = await db();
    return await new Promise((res, rej) => {
      const r = d.transaction(STORE, 'readonly').objectStore(STORE).get(slot);
      r.onsuccess = () => res((r.result as { league: League } | undefined)?.league ?? null);
      r.onerror = () => rej(r.error);
    });
  } catch { return null; }
}
export async function deleteSave(slot: string) {
  const d = await db();
  await new Promise<void>(res => { const tx = d.transaction(STORE, 'readwrite'); tx.objectStore(STORE).delete(slot); tx.oncomplete = () => res(); });
}
