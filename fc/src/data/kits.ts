// Real home / away / third kits, generated from Wikipedia by fc/tools/import-kits.ts.
// Looked up by club id at draw time (not stored on the Club), so existing saves pick them up and
// a re-import changes every kit without touching save data. Clubs the import missed fall back to
// the hand-entered colours in clubs.ts.
import data from './kits.json';
import type { Club } from '../core/types';
import type { KitPattern } from './clubs';

export type KitSlot = 'h' | 'a' | 't';
export interface KitDef { body: string; trim: string; pattern: KitPattern; sleeve: string; shorts: string; socks: string }
type Row = [string, string, string, string, string, string];

const KITS = (data as unknown as { clubs: Record<string, { h: Row; a?: Row; t?: Row }> }).clubs;
const lum = (hex: string) => { const n = parseInt(hex.slice(1, 7), 16); return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255; };
const fromRow = (r: Row): KitDef => ({ body: r[0], trim: r[1], pattern: r[2] as KitPattern, sleeve: r[3], shorts: r[4], socks: r[5] });

function fallback(c: Club, slot: KitSlot): KitDef {
  if (slot === 'h') {
    const shorts = c.shorts ?? (lum(c.c1) > 0.65 ? '#1b2232' : lum(c.c2) > 0.7 ? '#f3f5f9' : c.c2);
    return { body: c.c1, trim: c.c2, pattern: c.kit, sleeve: c.kit === 'sleeves' ? c.c2 : c.c1, shorts, socks: c.socks ?? c.c1 };
  }
  const shorts = lum(c.a1) > 0.65 ? '#1b2232' : lum(c.a2) > 0.7 ? '#f3f5f9' : c.a2;
  return { body: c.a1, trim: c.a2, pattern: 'plain', sleeve: c.a1, shorts, socks: c.a1 };
}

/** The club's kit for a slot; a missing third kit falls back to the away kit. */
export function kitOf(c: Club, slot: KitSlot = 'h'): KitDef {
  const k = KITS[c.id];
  const row = k && (slot === 'h' ? k.h : slot === 'a' ? k.a : k.t ?? k.a);
  return row ? fromRow(row) : fallback(c, slot === 't' ? 'a' : slot);
}

/** Raw home-kit colours for building new worlds (clubs without hand-entered colours). */
export const importedHome = (id: string): KitDef | undefined => KITS[id] && fromRow(KITS[id].h);

/** Perceptual-ish colour distance ("redmean"), 0..~765. */
export function colorDist(a: string, b: string) {
  const p = (h: string) => { const n = parseInt(h.slice(1, 7), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const [r1, g1, b1] = p(a), [r2, g2, b2] = p(b);
  const r = (r1 + r2) / 2;
  return Math.sqrt((2 + r / 256) * (r1 - r2) ** 2 + 4 * (g1 - g2) ** 2 + (2 + (255 - r) / 256) * (b1 - b2) ** 2);
}

/**
 * Which kit the away side wears: home if it reads clearly against the home shirt, else away, else
 * third, else whichever contrasts most with the home shirt.
 */
export function awaySlot(home: Club, away: Club): KitSlot {
  const h = kitOf(home, 'h');
  const score = (k: KitDef) => colorDist(k.body, h.body);
  const slots: KitSlot[] = ['h', 'a', 't'];
  const ok = slots.find(s => score(kitOf(away, s)) >= 150);
  return ok ?? slots.reduce((best, s) => score(kitOf(away, s)) > score(kitOf(away, best)) ? s : best, 'a' as KitSlot);
}
