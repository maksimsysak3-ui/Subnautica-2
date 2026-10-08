// A player's real skin tone, read from his headshot: the photo is drawn small
// into a canvas, the cheeks/forehead region is sampled, and the middle of the
// brightness distribution (no hair, beard, highlights or background) is kept.
// Cached in memory and localStorage; falls back to the portrait generator's tone
// when there is no photo or the CDN won't allow reading it.
import type { Player } from '../core/types';
import { faceSpec } from './face';

const KEY = 'gg-skin-v1';
let cache: Record<string, string> = {};
try { cache = JSON.parse(localStorage.getItem(KEY) ?? '{}'); } catch { cache = {}; }
const pending = new Set<string>();
let saveT = 0;
const save = () => { clearTimeout(saveT); saveT = window.setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch { /* storage full or blocked */ } }, 800); };

export function skinOf(p: Player): string {
  return cache[p.id] ?? (sample(p), faceSpec(p).skin);
}

function sample(p: Player) {
  if (!p.hs || pending.has(p.id) || cache[p.id] === undefined && cache[`${p.id}!`]) return;
  pending.add(p.id);
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    try {
      const S = 64, c = document.createElement('canvas'); c.width = S; c.height = S;
      const g = c.getContext('2d', { willReadFrequently: true })!;
      // Headshots are framed head-and-shoulders: the face sits in the upper middle.
      const w = img.naturalWidth, h = img.naturalHeight;
      g.drawImage(img, w * 0.3, h * 0.18, w * 0.4, h * 0.36, 0, 0, S, S);
      const d = g.getImageData(0, 0, S, S).data;
      const px: [number, number, number, number][] = [];
      for (let i = 0; i < d.length; i += 4) {
        const [r, gg, b, a] = [d[i], d[i + 1], d[i + 2], d[i + 3]];
        if (a < 200) continue;
        const max = Math.max(r, gg, b), min = Math.min(r, gg, b);
        // Skin: red-leaning, not grey background, not near-white or near-black.
        if (r < gg || r < b || max - min < 12 || max > 250 || max < 28) continue;
        px.push([r, gg, b, 0.299 * r + 0.587 * gg + 0.114 * b]);
      }
      if (px.length < 60) { cache[`${p.id}!`] = '1'; return; }
      px.sort((a, b) => a[3] - b[3]);
      const mid = px.slice(Math.floor(px.length * 0.3), Math.ceil(px.length * 0.75));
      const avg = [0, 1, 2].map(k => Math.round(mid.reduce((s, q) => s + q[k], 0) / mid.length));
      cache[p.id] = `#${avg.map(v => v.toString(16).padStart(2, '0')).join('')}`;
      save();
    } catch { cache[`${p.id}!`] = '1'; /* tainted canvas: CDN without CORS */ }
    finally { pending.delete(p.id); }
  };
  img.onerror = () => { pending.delete(p.id); cache[`${p.id}!`] = '1'; };
  img.src = p.hs.replace('f_auto,q_auto', 'f_png,q_auto,w_160');
}

/** Start sampling a group of players (e.g. both rosters at kickoff). */
export function warmSkins(ps: Player[]) { for (const p of ps) if (!cache[p.id]) sample(p); }
