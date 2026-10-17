// The stadium, painted once per matchup at low resolution: sky, an upper deck, a lit
// suite level, the LED ribbon board between the decks, the lower bowl packed in team
// colours with aisles, the wall, both benches on the far sideline, and the field itself
// (mowing stripes, painted numbers with arrows, hashes, a midfield logo, end zones with
// the nickname and a pinstripe). The live layers (crowd bounce, flashes, the ribbon's
// messages, goalposts) are drawn every frame on top.
import type { Team } from '../../core/types';
import { pxText, pxWidth } from './pixel';

export const FW = 53.3, MID = 26.65;
/** Low-res world geometry: pixels per yard, the depth squash, and where the field starts. */
export interface World { ppy: number; dep: number; top: number; height: number; X0: number; X1: number; ribbon: [number, number]; bowl: [number, number] }

export function makeWorld(RW: number, RH: number): World {
  // A fixed scale (the players are drawn at 16 px a yard) and a broadcast-like depth: the
  // field is taller than the picture, and the camera follows the ball up and down it.
  const ppy = 16;
  const fieldTop = Math.round(RH * 0.16);
  const dep = 0.62;
  const stand = Math.round(RH * 0.62);        // extra stands above the base framing, for tilt-ups and close-ups
  const top = stand + fieldTop;
  const ribbon: [number, number] = [Math.round(stand * 0.52), Math.round(stand * 0.52) + 7];
  // The wall sits back behind a real team area: about four yards of sideline before the stands.
  const side = Math.round(4.2 * ppy * dep);
  const bowl: [number, number] = [ribbon[1] + 10, top - 12 - side];
  return { ppy, dep, top, height: top + Math.ceil(FW * ppy * dep) + 10, X0: -44, X1: 164, ribbon, bowl };
}
export const wx = (W: World, x: number) => (x - W.X0) * W.ppy;
export const wy = (W: World, y: number, z = 0) => W.top + y * W.ppy * W.dep - z * W.ppy * 0.85;

const hex = (h: string) => { const n = parseInt(h.replace('#', '').slice(0, 6), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
const mix = (a: string, b: string, k: number) => { const A = hex(a), B = hex(b); return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * k)).join(',')})`; };
const lum = (h: string) => { const [r, g, b] = hex(h); return 0.299 * r + 0.587 * g + 0.114 * b; };

export interface StadiumOpts { home: Team; away: Team; logo: HTMLImageElement | null; night: boolean; college: boolean; snow: boolean }

export function paintStadium(W: World, o: StadiumOpts): HTMLCanvasElement {
  const { home, away } = o;
  const c = document.createElement('canvas');
  c.width = Math.ceil((W.X1 - W.X0) * W.ppy); c.height = W.height;
  const g = c.getContext('2d')!;
  const X = (x: number) => Math.round(wx(W, x)), Y = (y: number) => Math.round(wy(W, y));
  let seed = 11; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const H0 = home.colors[0], H1 = home.colors[1] ?? '#ffffff', A0 = away.colors[0];
  // Sky.
  const sky = g.createLinearGradient(0, 0, 0, W.ribbon[0]);
  if (o.night) { sky.addColorStop(0, '#04060d'); sky.addColorStop(1, '#141a2c'); } else { sky.addColorStop(0, '#5d8fd0'); sky.addColorStop(1, '#a9c8ea'); }
  g.fillStyle = sky; g.fillRect(0, 0, c.width, W.ribbon[0]);
  if (o.night) for (let i = 0; i < c.width / 9; i++) { g.fillStyle = `rgba(255,255,255,${0.2 + rnd() * 0.5})`; g.fillRect(Math.floor(rnd() * c.width), Math.floor(rnd() * W.ribbon[0] * 0.35), 1, 1); }
  else for (let i = 0; i < c.width / 120; i++) { const cx = rnd() * c.width, cy = 3 + rnd() * W.ribbon[0] * 0.25; g.fillStyle = 'rgba(255,255,255,.75)'; for (let k = 0; k < 6; k++) g.fillRect(Math.round(cx + k * 3 - 6), Math.round(cy + (k % 2)), 7, 2); }
  // Upper deck: steep rows, smaller fans, the rim lights along the top.
  const ud0 = Math.round(W.ribbon[0] * 0.3);
  g.fillStyle = '#1b2030'; g.fillRect(0, ud0, c.width, W.ribbon[0] - ud0);
  g.fillStyle = '#2b3246'; g.fillRect(0, ud0, c.width, 2);
  for (let x = 0; x < c.width; x += 26) { g.fillStyle = o.night ? '#fff6d8' : '#c9ccd4'; g.fillRect(x + 4, ud0 - 3, 10, 2); if (o.night) { g.fillStyle = 'rgba(255,240,200,.18)'; g.fillRect(x + 2, ud0 - 5, 14, 6); } }
  const fans = [H0, H0, H0, H1, '#e9e2d0', '#30364a', A0, H0, '#c8c0b0'];
  const SK = ['#e6c2a2', '#c99a76', '#a46e4c', '#7b4b31', '#5a3522'];
  for (let y = ud0 + 3; y < W.ribbon[0] - 2; y += 2) for (let x = (y & 2) ? 1 : 0; x < c.width; x += 2) {
    if ((x % 60) < 3) continue;   // aisles
    if (rnd() < 0.86) { g.fillStyle = mix(fans[Math.floor(rnd() * fans.length)], '#0b0d14', 0.35); g.fillRect(x, y, 1, 1); }
  }
  // The LED ribbon (drawn live) sits in its own band; below it, the suite level.
  g.fillStyle = '#05070b'; g.fillRect(0, W.ribbon[0] - 1, c.width, W.ribbon[1] - W.ribbon[0] + 2);
  const su0 = W.ribbon[1] + 1, su1 = W.bowl[0] - 1;
  g.fillStyle = '#262c3b'; g.fillRect(0, su0, c.width, su1 - su0);
  for (let x = 2; x < c.width; x += 12) { g.fillStyle = o.night ? (rnd() < 0.8 ? '#ffe7a8' : '#9fb4d8') : '#7e95b4'; g.fillRect(x, su0 + 2, 9, su1 - su0 - 4); g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x, su0 + 2, 9, 1); if (rnd() < 0.5) { g.fillStyle = '#2a2a2a'; g.fillRect(x + 2 + Math.floor(rnd() * 5), su1 - 4, 1, 2); } }
  g.fillStyle = H0; g.fillRect(0, su1 - 1, c.width, 2);
  // Lower bowl: shirt + head per fan, home colours dominate, the visitors in a corner.
  for (let y = W.bowl[0]; y < W.bowl[1] - 2; y += 3) {
    const row = (y - W.bowl[0]) / 3;
    for (let x = (row % 2) * 2; x < c.width; x += 3) {
      if ((x % 72) < 4) { g.fillStyle = '#4a5064'; g.fillRect(x, y, 3, 3); continue; }   // stairs
      if (rnd() < 0.08) continue;    // empty seat
      const away = x > c.width * 0.08 && x < c.width * 0.2;
      const shirt = away ? (rnd() < 0.7 ? A0 : '#d8d0c0') : fans[Math.floor(rnd() * fans.length)];
      g.fillStyle = shirt; g.fillRect(x, y + 1, 2, 2);
      g.fillStyle = SK[Math.floor(rnd() * SK.length)]; g.fillRect(x + (rnd() < 0.5 ? 0 : 1), y, 1, 1);
    }
  }
  // Depth shading: the bowl darkens toward the top.
  const sh = g.createLinearGradient(0, W.bowl[0], 0, W.bowl[1]);
  sh.addColorStop(0, 'rgba(5,7,12,.35)'); sh.addColorStop(1, 'rgba(5,7,12,0)');
  g.fillStyle = sh; g.fillRect(0, W.bowl[0], c.width, W.bowl[1] - W.bowl[0]);
  // The wall: team-colour padding with the nickname repeated, then the sideline.
  const w0 = W.bowl[1] - 2;
  g.fillStyle = mix(H0, '#000000', 0.25); g.fillRect(0, w0, c.width, 6);
  g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(0, w0, c.width, 1);
  const word = home.nick.toUpperCase();
  for (let x = 6; x < c.width; x += pxWidth(word) + 40) pxText(g, word, x, w0 + 1, lum(H0) > 160 ? '#111' : '#ffffff');
  const side0 = w0 + 6;
  g.fillStyle = o.snow ? '#d9dee6' : '#3f6b3a'; g.fillRect(0, side0, c.width, Y(0) - side0);
  // Benches: players (helmets in hand) between the 30s, coaches in front, a cooler, the chain crew's spot.
  for (const [x0, x1, t] of [[38, 60, away], [60, 82, home]] as const) {
    if (t === home && x0 === 60) { /* fallthrough */ }
    g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(X(x0 + 1), side0 + 1, X(x1 - 1) - X(x0 + 1), 2);
    // (The people in the team areas are drawn live: field/sideline.ts.) The bench itself:
    g.fillStyle = mix(t.colors[0], '#000000', 0.45); g.fillRect(X(x0 + 2), side0 + 1, X(x1 - 2) - X(x0 + 2), 2);
    g.fillStyle = '#f07c1c'; g.fillRect(X(x0 + 3), side0 + 3, 3, 3); g.fillStyle = '#fff'; g.fillRect(X(x0 + 3), side0 + 3, 3, 1);
  }
  // Turf.
  const fy0 = Y(0), fy1 = Y(FW);
  for (let i = -8; i < 33; i++) {
    const x0 = X(i * 5 - 0), x1 = X(i * 5 + 5);
    g.fillStyle = o.snow ? (i % 2 ? '#e9edf2' : '#dfe4ea') : i % 2 ? '#2f8a3e' : '#2a7f38';
    g.fillRect(x0, fy0 - 3, x1 - x0, fy1 - fy0 + 13);
  }
  for (let n = 0; n < c.width * 9; n++) { g.fillStyle = rnd() < 0.55 ? 'rgba(0,0,0,.07)' : 'rgba(255,255,255,.045)'; g.fillRect(Math.floor(rnd() * c.width), fy0 - 3 + Math.floor(rnd() * (fy1 - fy0 + 13)), 1, 1); }
  // End zones: team colour, pinstripes, the nickname, white border.
  for (const [ex, t, rot] of [[0, away, -1], [110, home, 1]] as const) {
    const ez = X(ex), ez1 = X(ex + 10);
    g.fillStyle = mix(t.colors[0], '#000000', 0.08); g.fillRect(ez, fy0, ez1 - ez, fy1 - fy0);
    g.fillStyle = mix(t.colors[0], '#ffffff', 0.08); for (let k = -40; k < ez1 - ez + 40; k += 5) for (let yy = fy0; yy < fy1; yy++) { const xx = ez + k + (yy - fy0); if (xx >= ez && xx < ez1 && (xx + yy) % 5 === 0) g.fillRect(xx, yy, 1, 1); }
    g.save(); g.translate((ez + ez1) / 2, (fy0 + fy1) / 2); g.rotate((rot * Math.PI) / 2);
    const name = t.nick.toUpperCase();
    let fs = Math.round(W.ppy * 4.6); g.font = `700 ${fs}px Silkscreen, monospace`;
    const room = (fy1 - fy0) * 0.86, wT = g.measureText(name).width;
    if (wT > room) { fs = Math.max(6, Math.floor((fs * room) / wT)); g.font = `700 ${fs}px Silkscreen, monospace`; }
    g.textAlign = 'center'; g.textBaseline = 'middle';
    const accent = lum(t.colors[0]) > 160 ? '#111111' : '#ffffff';
    g.fillStyle = 'rgba(0,0,0,.35)'; g.fillText(name, 1, 2); g.fillStyle = t.colors[1] && t.colors[1].toLowerCase() !== t.colors[0].toLowerCase() ? t.colors[1] : accent; g.fillText(name, 0, 1); g.fillStyle = accent; g.fillText(name, 0, 0);
    g.restore();
  }
  // Lines: sidelines and end lines (wide white border), every 5 yards, hashes, the try line.
  g.fillStyle = '#f4f4ee';
  g.fillRect(X(0) - 1, fy0 - 2, X(120) - X(0) + 3, 2); g.fillRect(X(0) - 1, fy1, X(120) - X(0) + 3, 2);
  g.fillRect(X(0) - 1, fy0, 2, fy1 - fy0); g.fillRect(X(120) - 1, fy0, 2, fy1 - fy0);
  for (let x = 10; x <= 110; x += 5) g.fillRect(X(x), fy0, x === 10 || x === 110 ? 2 : 1, fy1 - fy0);
  const hashes = o.college ? [20, 33.3] : [23.58, 29.72];
  for (let x = 11; x < 110; x++) if (x % 5) for (const y of [0.7, ...hashes, FW - 0.7]) g.fillRect(X(x), Y(y), 1, y > 1 && y < FW - 1 ? 2 : 1);
  for (const x of [10 + (o.college ? 3 : 2), 110 - (o.college ? 3 : 2)]) g.fillRect(X(x), Y(MID - 0.6), 1, 2);
  // Numbers with direction arrows, both rows.
  g.font = `700 ${Math.max(7, Math.round(W.ppy * 1.7))}px Silkscreen, monospace`; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (let x = 20; x <= 100; x += 10) {
    const n = String(x <= 60 ? x - 10 : 110 - x), dir = x < 60 ? -1 : x > 60 ? 1 : 0;
    for (const [yy, flip] of [[FW - 9, false], [9, true]] as const) {
      g.save(); g.translate(X(x), Y(yy)); if (flip) g.rotate(Math.PI);
      g.fillStyle = 'rgba(0,0,0,.18)'; g.fillText(n, 1, 1); g.fillStyle = 'rgba(244,244,238,.92)'; g.fillText(n, 0, 0);
      if (dir) { const ax = (flip ? -dir : dir) * -Math.round(W.ppy * 2.1); g.beginPath(); g.moveTo(ax + Math.sign(ax) * 3, 0); g.lineTo(ax, -2); g.lineTo(ax, 2); g.closePath(); g.fill(); }
      g.restore();
    }
  }
  // Midfield logo and the 25-yard-line marks.
  if (o.logo) { const sz = W.ppy * 7.5; g.imageSmoothingEnabled = false; g.globalAlpha = 0.92; g.drawImage(o.logo, X(60) - sz / 2, Y(MID) - (sz * W.dep * 1.15) / 2, sz, sz * W.dep * 1.15); g.globalAlpha = 1; }
  else { /* no logo: plain grass */ }
  // Pylons at the four corners of both end zones.
  g.fillStyle = '#ff6a00'; for (const x of [0, 10, 110, 120]) for (const y of [0, FW]) g.fillRect(X(x) - 1, Y(y) - 3, 2, 4);
  // Below the near sideline: the photographers' strip.
  g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(0, fy1 + 3, c.width, 1);
  return c;
}

/** Live crowd: fans bouncing (more on big moments), towels waving, and camera flashes at night. */
export function drawCrowd(g: CanvasRenderingContext2D, W: World, ox: number, oy: number, vw: number, now: number, hype: number, night: boolean, cols: string[]) {
  const y0 = W.bowl[0] - oy, y1 = W.bowl[1] - oy;
  if (y1 < 0) return;
  let seed = Math.floor(now / 110) + 3;
  const rnd = () => ((seed = (seed * 16807 + 11) % 2147483647) / 2147483647);
  const n = Math.round(vw * (0.08 + hype * 0.6));
  for (let i = 0; i < n; i++) {
    const x = Math.floor(rnd() * vw), y = Math.floor(y0 + rnd() * (y1 - y0));
    const col = cols[rnd() < 0.75 ? 0 : 1];
    g.fillStyle = col; g.fillRect(x, y - 1, 2, 2);
    if (hype > 0.5 && rnd() < 0.3) { g.fillStyle = '#fff'; g.fillRect(x + 1, y - 3, 1, 2); }   // towels / hands up
  }
  if (night || hype > 0.6) {
    const f = Math.round(vw * (night ? 0.01 + hype * 0.04 : hype * 0.01));
    for (let i = 0; i < f; i++) { g.fillStyle = 'rgba(255,255,255,.95)'; g.fillRect(Math.floor(rnd() * vw), Math.floor(rnd() * (W.ribbon[0] - oy) + Math.max(0, -oy)), 1, 1); g.fillRect(Math.floor(rnd() * vw), Math.floor(y0 + rnd() * (y1 - y0)), 1, 1); }
  }
}

/** The LED ribbon board: scrolling messages in the home colours. */
export function drawRibbon(g: CanvasRenderingContext2D, W: World, oy: number, vw: number, now: number, msg: string, col: string, flash: boolean) {
  const y = W.ribbon[0] - oy, h = W.ribbon[1] - W.ribbon[0];
  if (y + h < 0 || y > 2000) return;
  g.fillStyle = flash && Math.floor(now / 140) % 2 ? col : '#07090f'; g.fillRect(0, y, vw, h);
  const txt = `${msg}   ·   `;
  const wTxt = pxWidth(txt);
  const off = flash ? 0 : Math.floor(now / 28) % wTxt;
  for (let x = -off; x < vw; x += wTxt) pxText(g, txt, x, y + 1, flash && Math.floor(now / 140) % 2 ? '#ffffff' : col);
  g.fillStyle = 'rgba(255,255,255,.08)'; for (let x = 0; x < vw; x += 2) g.fillRect(x, y, 1, h);
}

/** Goalposts: the offset base, padding, the crossbar, uprights and the wind flags on top. */
export function drawPosts(g: CanvasRenderingContext2D, W: World, sx: (x: number) => number, sy: (y: number, z?: number) => number, vw: number, now: number, wind: number) {
  for (const ex of [0, 120]) {
    const back = ex === 0 ? -2 : 122;
    const x = sx(ex), bx = sx(back); if (x < -12 || x > vw + 12) continue;
    const base = sy(MID), bar = sy(MID, 3.33), l = sy(MID - 3.08), r = sy(MID + 3.08);
    const up = Math.round(W.ppy * 10 * 0.85 * 0.9);
    g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(bx + 1, base + 1, x - bx, 1);
    g.fillStyle = '#ffd400';
    g.fillRect(bx, bar, 2, base - bar);                     // the post from behind the end line
    g.fillRect(Math.min(bx, x), bar, Math.abs(x - bx) + 1, 1);   // gooseneck
    g.fillRect(x, l - (base - bar), 1, r - l);              // crossbar across the uprights' depth
    g.fillRect(x - 1, l - (base - bar) - up, 1, up);
    g.fillRect(x + 1, r - (base - bar) - up, 1, up);
    g.fillStyle = '#1d4fb8'; g.fillRect(bx - 1, base - 6, 4, 6);   // padding
    const wv = Math.floor(now / 160) % 2;
    for (const [px, py] of [[x - 1, l - (base - bar) - up], [x + 1, r - (base - bar) - up]] as const) { g.fillStyle = '#e8261c'; g.fillRect(px + 1, py, 2 + Math.min(2, Math.round(wind / 8)), 1 + wv); }
  }
}
