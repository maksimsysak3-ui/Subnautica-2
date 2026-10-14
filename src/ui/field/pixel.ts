// Pixel-art players. Each frame is a 16x20 grid drawn by hand (facing right),
// recoloured per team kit and skin tone, given a 1px dark outline automatically,
// and cached as a tiny canvas. Lower-case letters are the far-side limbs, shaded
// darker so a stride reads at a glance.
//
// H helmet  h helmet stripe  M facemask  S skin  J jersey  T jersey trim  N number
// P pants   p pants stripe   K socks     B shoe  G glove   F football     W laces
// R referee stripe (black)   lower case = far limb (shaded)

import FRAMES from './frames.json';

export interface Kit { jersey: string; num: string; trim: string; pants: string; helmet: string; mask: string; socks: string }
/** Every pose the players have (tools/sprites.py draws them; 16x20, facing right, feet on the last row). */
export type Frame = keyof typeof FRAMES;
export const hasFrame = (f: string): f is Frame => f in FRAMES;

const shade = (hex: string, k: number) => {
  const n = parseInt(hex.replace('#', '').slice(0, 6), 16);
  const f = (c: number) => Math.round(Math.max(0, Math.min(255, k < 0 ? c * (1 + k) : c + (255 - c) * k)));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
};
const cache = new Map<string, HTMLCanvasElement>();
export const SPRITE_W = 16, SPRITE_H = 20;
/** Where a sprite canvas is pinned to the player's spot: the middle of his feet. */
export const ANCHOR_X = 9, ANCHOR_Y = 20;

/** A cached sprite canvas for this kit, skin, frame and facing (18x22 with the outline). */
export function sprite(kit: Kit, skin: string, f: Frame, flip: boolean, ref = false): HTMLCanvasElement {
  const key = `${kit.jersey}|${kit.num}|${kit.helmet}|${kit.pants}|${skin}|${f}|${flip ? 1 : 0}|${ref ? 1 : 0}`;
  const hit = cache.get(key); if (hit) return hit;
  const glove = kit.trim.toLowerCase() === '#ffffff' ? kit.jersey : kit.trim;
  const col: Record<string, string> = ref
    ? { H: '#1a1a1a', h: '#1a1a1a', M: '#1a1a1a', S: skin, J: '#f2f2f2', T: '#111', N: '#111', P: '#f2f2f2', p: '#111', K: '#111', B: '#111', G: '#111', F: '#7a3a12', W: '#fff' }
    : { H: kit.helmet, h: kit.trim, M: kit.mask, S: skin, J: kit.jersey, T: kit.trim, N: kit.num, P: kit.pants, p: kit.trim, K: kit.socks, B: '#141414', G: glove, F: '#7a3a12', W: '#ffffff' };
  const c = paint(FRAMES[f] as string[], col, flip, ref ? (ch, x0) => (ch === 'J' && x0 % 2 === 0 ? '#111' : undefined) : undefined);
  cache.set(key, c);
  if (cache.size > 2500) cache.delete(cache.keys().next().value!);
  return c;
}

/** Draw a grid of palette letters into an outlined, top-lit canvas (lower case = shaded far limb). */
export function paint(rows: string[], col: Record<string, string>, flip = false, override?: (ch: string, x: number) => string | undefined): HTMLCanvasElement {
  const w = Math.max(...rows.map(r => r.length));
  const W = w + 2, H = rows.length + 2;   // 1px border for the outline
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d')!;
  const filled: boolean[][] = Array.from({ length: H }, () => Array(W).fill(false));
  rows.forEach((r, y) => [...r].forEach((ch, x0) => {
    if (ch === '.') return;
    const x = flip ? w - 1 - x0 : x0;
    const lower = ch >= 'a' && ch <= 'z' && !(ch in col);
    const base = col[lower ? ch.toUpperCase() : ch] ?? '#f0f';
    g.fillStyle = override?.(ch, x0) ?? (lower ? shade(base, -0.35) : base);
    g.fillRect(x + 1, y + 1, 1, 1); filled[y + 1][x + 1] = true;
  }));
  // Top-left light on the head.
  g.fillStyle = 'rgba(255,255,255,.35)';
  for (let y = 0; y < Math.min(H, 9); y++) { const x = filled[y].indexOf(true); if (x >= 0) g.fillRect(x, y, 1, 1); }
  g.fillStyle = 'rgba(10,12,16,.92)';
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (filled[y][x]) continue;
    if ((filled[y - 1]?.[x]) || (filled[y + 1]?.[x]) || filled[y][x - 1] || filled[y][x + 1]) g.fillRect(x, y, 1, 1);
  }
  return c;
}

// A 3x5 pixel font for crisp in-canvas lettering (canvas text anti-aliases at this size).
const GLYPH: Record<string, string> = {
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111', F: '111100110100100',
  G: '011100101101011', H: '101101111101101', I: '111010010010111', J: '001001001101010', K: '101101110101101', L: '100100100100111',
  M: '101111111101101', N: '110101101101101', O: '010101101101010', P: '110101110100100', Q: '010101101110011', R: '110101110101101',
  S: '011100010001110', T: '111010010010010', U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101',
  Y: '101101010010010', Z: '111001010100111', '0': '111101101101111', '1': '010110010010111', '2': '110001010100111', '3': '110001010001110',
  '4': '101101111001001', '5': '111100110001110', '6': '011100111101111', '7': '111001010010010', '8': '111101111101111', '9': '111101111001110',
  ' ': '000000000000000', '-': '000000111000000', '.': '000000000000010', '·': '000000010000000', '!': '010010010000010',
};
/** Width in pixels of `text` at `scale` (3px glyphs, 1px gaps). */
export const pxWidth = (text: string, scale = 1) => (text.length * 4 - 1) * scale;
/** Draw upper-case text with the 3x5 pixel font. */
export function pxText(g: CanvasRenderingContext2D, text: string, x: number, y: number, color: string, scale = 1) {
  g.fillStyle = color;
  [...text.toUpperCase()].forEach((ch, i) => {
    const m = GLYPH[ch] ?? GLYPH[' '];
    for (let k = 0; k < 15; k++) if (m[k] === '1') g.fillRect(Math.round(x + (i * 4 + (k % 3)) * scale), Math.round(y + Math.floor(k / 3) * scale), scale, scale);
  });
}
