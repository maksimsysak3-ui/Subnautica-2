/** Small, fast seeded PRNG (mulberry32) so worlds and matches can be reproduced. */
export function makeRng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return next;
}

let global = makeRng(Date.now() % 1e9);
export const reseed = (s: number) => { global = makeRng(s); };
export const rand = () => global();
export const rint = (lo: number, hi: number) => lo + Math.floor(global() * (hi - lo + 1));
export const chance = (p: number) => global() < p;
export const pick = <T,>(a: readonly T[]): T => a[Math.floor(global() * a.length)];
export const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
/** Approximately normal (sum of uniforms), mean 0, sd 1. */
export const gauss = () => (global() + global() + global() + global() + global() + global() - 3) * 1.41;
export function weighted<T>(items: readonly T[], w: (t: T) => number): T {
  let tot = 0;
  for (const it of items) tot += Math.max(0, w(it));
  let r = global() * tot;
  for (const it of items) { r -= Math.max(0, w(it)); if (r <= 0) return it; }
  return items[items.length - 1];
}
export function shuffle<T>(a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(global() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
/** Stable string hash for seeding per-entity visuals (faces, attributes). */
export function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
