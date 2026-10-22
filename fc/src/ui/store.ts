import { useSyncExternalStore } from 'react';
import type { World } from '../core/types';

// One mutable world with a version counter; React re-renders on bumps.
let world: World | null = null;
let version = 0;
const subs = new Set<() => void>();
const emit = () => { version++; subs.forEach(f => f()); };
const subscribe = (f: () => void) => { subs.add(f); return () => subs.delete(f); };

export const getWorld = () => world!;
export function setWorld(w: World | null) { world = w; emit(); }
export function useWorld(): World { useSyncExternalStore(subscribe, () => version); return world!; }
export function useVersion() { return useSyncExternalStore(subscribe, () => version); }
export function mutate(fn: (w: World) => void, save = true) { if (!world) return; fn(world); emit(); if (save) scheduleSave(); }
export const bump = () => emit();

// ---- persistence (IndexedDB, three slots) ------------------------------------------------
const DB = 'fc-gm', STORE = 'saves';
function db(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
export let slot = 1;
export const setSlot = (s: number) => { slot = s; };
export interface SaveMeta { slot: number; club: string; manager: string; season: number; day: number; saved: number }

export async function saveNow(): Promise<boolean> {
  if (!world) return false;
  try {
    const d = await db();
    const meta: SaveMeta = { slot, club: world.user, manager: world.manager, season: world.season, day: world.day, saved: Date.now() };
    await new Promise<void>((res, rej) => {
      const tx = d.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(world, `w${slot}`);
      tx.objectStore(STORE).put(meta, `m${slot}`);
      tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error);
    });
    return true;
  } catch { return false; }
}
let saveTimer: ReturnType<typeof setTimeout> | null = null;
export function scheduleSave() { if (saveTimer) clearTimeout(saveTimer); saveTimer = setTimeout(() => { void saveNow(); }, 1500); }

export async function listSaves(): Promise<SaveMeta[]> {
  try {
    const d = await db();
    const out: SaveMeta[] = [];
    for (const s of [1, 2, 3]) {
      const m = await new Promise<SaveMeta | undefined>(res => { const r = d.transaction(STORE).objectStore(STORE).get(`m${s}`); r.onsuccess = () => res(r.result); r.onerror = () => res(undefined); });
      if (m) out.push(m);
    }
    return out;
  } catch { return []; }
}
export async function loadSlot(s: number): Promise<World | null> {
  try {
    const d = await db();
    return await new Promise<World | null>(res => { const r = d.transaction(STORE).objectStore(STORE).get(`w${s}`); r.onsuccess = () => res(r.result ?? null); r.onerror = () => res(null); });
  } catch { return null; }
}
export async function deleteSlot(s: number) {
  try { const d = await db(); const tx = d.transaction(STORE, 'readwrite'); tx.objectStore(STORE).delete(`w${s}`); tx.objectStore(STORE).delete(`m${s}`); } catch { /* ignore */ }
}
