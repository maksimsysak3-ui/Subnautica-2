// The cold open, before the logo opening: game night at a stadium, in the same pixel
// art as the broadcast. The bowl sits dark; the light banks slam on one by one with
// flares; the crowd (every seat a pixel, in team colours) flickers with phone lights;
// the video board wakes up; smoke pours from the tunnel, the flame cannons fire and the
// team runs out onto a painted field under fireworks; then the camera pushes in on the
// midfield logo and a white flash hands off to the logo opening. ~4.6s, any key skips.
import { useEffect, useRef, useState } from 'react';
import { RAW_TEAMS } from '../core/league';
import type { Team } from '../core/types';
import { sprite, pxText, pxWidth, type Frame } from './field/pixel';
import { kitFor } from './field';

const RW = 320, RH = 180;
export const PRELUDE_MS = 4600;
const BANKS = [0.35, 0.6, 0.85, 1.1];
const SKINS = ['#e8c4a8', '#c99a76', '#a46e4c', '#7b4b31', '#5a3522'];

const vivid = (hex: string) => hex;
const mix = (a: string, b: string, k: number) => {
  const p = (h: string) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const x = p(a), y = p(b); return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * k)).join(',')})`;
};
let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

/** The static stadium: sky, three tiers of crowd, fascia banners, light towers, field. */
function bowl(t: Team): HTMLCanvasElement {
  const c = document.createElement('canvas'); c.width = RW; c.height = RH;
  const g = c.getContext('2d')!;
  const c0 = vivid(t.colors[0]), c1 = t.colors[1] ?? '#ffffff';
  // Sky with stars.
  const sky = g.createLinearGradient(0, 0, 0, 40); sky.addColorStop(0, '#03040b'); sky.addColorStop(1, '#10162b');
  g.fillStyle = sky; g.fillRect(0, 0, RW, 40);
  for (let i = 0; i < 70; i++) { g.fillStyle = `rgba(255,255,255,${0.3 + rnd() * 0.6})`; g.fillRect(Math.floor(rnd() * RW), Math.floor(rnd() * 26), 1, 1); }
  // Stands: three tiers that curve down at the sides, every seat a pixel.
  const curve = (x: number) => ((x - RW / 2) / (RW / 2)) ** 2 * 10;
  const tiers: [number, number, string, string][] = [[20, 46, '#161a24', '#1f2430'], [50, 74, '#191d28', '#232937'], [78, 100, '#1c2130', '#272e3e']];
  tiers.forEach(([y0, y1, a, b], ti) => {
    for (let x = 0; x < RW; x++) {
      const dy = curve(x);
      for (let y = y0; y < y1; y++) {
        const yy = Math.round(y + dy);
        g.fillStyle = (y - y0) % 3 === 0 ? a : b; g.fillRect(x, yy, 1, 1);
        if ((y - y0) % 3 !== 0 && x % 2 === (y % 2)) {
          const r = rnd();
          g.fillStyle = r < 0.34 ? c0 : r < 0.5 ? c1 : r < 0.62 ? '#e9e4da' : SKINS[Math.floor(rnd() * SKINS.length)];
          g.fillRect(x, yy, 1, 1);
        }
      }
    }
    // Fascia under each tier: team colour band with lettering.
    const fy = y1;
    for (let x = 0; x < RW; x++) { g.fillStyle = ti === 1 ? c0 : '#0b0d12'; g.fillRect(x, Math.round(fy + curve(x)), 1, 3); }
    if (ti === 1) for (let x = 12; x < RW - 40; x += 70) pxText(g, t.nick.toUpperCase().slice(0, 12), x, Math.round(fy + curve(x)) - 1, '#ffffff');
  });
  // Light towers on the rim.
  [[34, 6], [112, 2], [208, 2], [286, 6]].forEach(([x, y]) => { g.fillStyle = '#20242e'; g.fillRect(x + 6, y + 9, 2, 14); g.fillStyle = '#2b3040'; g.fillRect(x, y, 14, 9); });
  // Field in perspective: far edge y=104, near edge below the frame.
  const top = 104, bot = 196, L0 = 26, R0 = RW - 26, L1 = -90, R1 = RW + 90;
  const at = (u: number, v: number) => [L0 + (L1 - L0) * v + ((R0 + (R1 - R0) * v) - (L0 + (L1 - L0) * v)) * u, top + (bot - top) * v] as const;
  for (let y = top; y < RH; y++) {
    const v = (y - top) / (bot - top);
    const [xa] = at(0, v), [xb] = at(1, v);
    for (let x = Math.max(0, Math.floor(xa)); x < Math.min(RW, Math.ceil(xb)); x++) {
      const u = (x - xa) / (xb - xa);
      const yard = u * 120;
      const ez = yard < 10 || yard > 110;
      const stripe = Math.floor(yard / 5) % 2 === 0;
      g.fillStyle = ez ? (yard < 10 ? c0 : mix(c0, '#000000', 0.25)) : stripe ? '#2f7a3b' : '#2a7035';
      g.fillRect(x, y, 1, 1);
    }
  }
  // Yard lines, hash marks, numbers.
  for (let yd = 10; yd <= 110; yd += 5) {
    const u = yd / 120;
    g.strokeStyle = yd === 10 || yd === 110 ? '#ffffff' : 'rgba(255,255,255,.75)'; g.lineWidth = 1;
    g.beginPath(); const [x0, y0] = at(u, 0), [x1, y1] = at(u, 1); g.moveTo(x0 + 0.5, y0); g.lineTo(x1 + 0.5, y1); g.stroke();
    for (const hv of [0.33, 0.62]) { const [hx, hy] = at(u, hv); g.fillStyle = '#ffffff'; g.fillRect(Math.round(hx) - 1, Math.round(hy), 3, 1); }
    if (yd % 10 === 0 && yd > 10 && yd < 110) { const n = String(yd <= 60 ? yd - 10 : 110 - yd); const [nx, ny] = at(u, 0.82); pxText(g, n, Math.round(nx - pxWidth(n) / 2), Math.round(ny), 'rgba(255,255,255,.85)'); }
  }
  // End zone lettering and the midfield mark.
  const [ex, ey] = at(0.042, 0.45); pxText(g, t.abbr, Math.round(ex - pxWidth(t.abbr) / 2), Math.round(ey), '#ffffff');
  const [ex2, ey2] = at(0.958, 0.45); pxText(g, t.abbr, Math.round(ex2 - pxWidth(t.abbr) / 2), Math.round(ey2), c1);
  const [mx, my] = at(0.5, 0.42);
  g.fillStyle = '#0b0d12'; g.fillRect(Math.round(mx - pxWidth(t.abbr, 3) / 2) - 4, Math.round(my) - 3, pxWidth(t.abbr, 3) + 8, 21);
  g.fillStyle = c0; g.fillRect(Math.round(mx - pxWidth(t.abbr, 3) / 2) - 3, Math.round(my) - 2, pxWidth(t.abbr, 3) + 6, 19);
  pxText(g, t.abbr, Math.round(mx - pxWidth(t.abbr, 3) / 2), Math.round(my) + 1, '#ffffff', 3);
  // Tunnel: an inflatable helmet arch in team colours on the near-left sideline.
  g.fillStyle = mix(c0, '#000000', 0.35); g.fillRect(6, 128, 34, 26);
  g.fillStyle = c0; g.beginPath(); g.ellipse(23, 132, 18, 13, 0, Math.PI, 0); g.fill(); g.fillRect(5, 132, 36, 22);
  g.fillStyle = c1; g.fillRect(5, 138, 36, 2);
  g.fillStyle = '#05060a'; g.beginPath(); g.ellipse(23, 154, 11, 12, 0, Math.PI, 0); g.fill();
  return c;
}

interface Runner { born: number; x0: number; y0: number; x1: number; y1: number; skin: string; num: number }
interface Puff { x: number; y: number; r: number; born: number; vx: number }
interface Spark { x: number; y: number; vx: number; vy: number; born: number; c: string }

export function Prelude({ onDone, onSkip }: { onDone: () => void; onSkip: () => void }) {
  const cv = useRef<HTMLCanvasElement>(null);
  const [t, setT] = useState(0);
  const team = useRef(RAW_TEAMS[Math.floor(Math.random() * RAW_TEAMS.length)] as unknown as Team).current;
  useEffect(() => {
    const end = setTimeout(onDone, PRELUDE_MS);
    const skip = (e: KeyboardEvent) => { e.stopImmediatePropagation(); onSkip(); };
    window.addEventListener('keydown', skip, true);
    return () => { clearTimeout(end); window.removeEventListener('keydown', skip, true); };
  }, []);
  useEffect(() => {
    const c = cv.current!, out = c.getContext('2d')!;
    const low = document.createElement('canvas'); low.width = RW; low.height = RH;
    const g = low.getContext('2d')!; g.imageSmoothingEnabled = false;
    seed = 7;
    const base = bowl(team), kit = kitFor(team, true);
    const c0 = team.colors[0], c1 = team.colors[1] ?? '#ffffff';
    const runners: Runner[] = [], puffs: Puff[] = [], sparks: Spark[] = [];
    let nextRunner = 1.75, nextPuff = 1.3;
    const bursts = [1.9, 2.35, 2.8, 3.25].map((tb, i) => ({ t: tb, x: 50 + i * 75 + (i % 2) * 20, y: 18 + (i % 2) * 8, done: false }));
    const start = performance.now();
    let raf = 0, lastT = -1, prev = start;
    const frame = (now: number) => {
      const T = (now - start) / 1000, dt = Math.min(0.05, (now - prev) / 1000); prev = now;
      if (Math.floor(T * 10) !== lastT) { lastT = Math.floor(T * 10); setT(T); }
      const on = BANKS.filter(b => T >= b).length;
      g.drawImage(base, 0, 0);
      // Video board.
      g.fillStyle = '#0a0c11'; g.fillRect(132, 4, 56, 22); g.fillStyle = '#05060a'; g.fillRect(134, 6, 52, 18);
      if (on >= 2) {
        const msg = T < 2.2 ? 'GAME DAY' : team.abbr;
        if (Math.floor(T * 4) % 2 || T >= 2.2) pxText(g, msg, Math.round(160 - pxWidth(msg) / 2), 12, T < 2.2 ? '#ffd34d' : c0);
        g.fillStyle = 'rgba(255,255,255,.05)'; for (let y = 6; y < 24; y += 2) g.fillRect(134, y, 52, 1);
      }
      // Crowd: phone lights twinkle, and a wave of team colour rolls round the bowl.
      for (let i = 0; i < 26 + on * 10; i++) { g.fillStyle = 'rgba(255,255,255,.95)'; g.fillRect(Math.floor(Math.random() * RW), 22 + Math.floor(Math.random() * 82), 1, 1); }
      // Smoke from the tunnel.
      if (T > nextPuff && T < 4.2) { nextPuff = T + 0.05; puffs.push({ x: 23 + (Math.random() - 0.5) * 10, y: 150, r: 3 + Math.random() * 3, born: T, vx: 6 + Math.random() * 14 }); }
      for (const p of puffs) {
        const a = T - p.born; if (a > 2.2) continue;
        const x = p.x + p.vx * a, y = p.y - 10 * a - a * a * 3, r = p.r + a * 9, alpha = Math.max(0, 0.55 - a * 0.25);
        g.fillStyle = `rgba(210,214,224,${alpha})`;
        for (let yy = -r; yy <= r; yy += 1) { const w = Math.sqrt(Math.max(0, r * r - yy * yy)); if ((Math.round(yy) + Math.round(x)) % 2 === 0) g.fillRect(Math.round(x - w), Math.round(y + yy), Math.round(w * 2), 1); }
      }
      // Flame cannons either side of the tunnel.
      if (T > 1.85 && T < 2.5) for (const fx of [2, 44]) for (let k = 0; k < 14; k++) {
        const h = 14 + Math.random() * 10, y = 128 - (k / 14) * h;
        g.fillStyle = k < 4 ? '#ffffff' : k < 8 ? '#ffd34d' : k < 11 ? '#ff8a1f' : '#d7263d';
        g.fillRect(fx + Math.round((Math.random() - 0.5) * (k / 4)), Math.round(y), 3, 2);
      }
      // The team runs out.
      if (T > nextRunner && runners.length < 22) {
        nextRunner = T + 0.09 + Math.random() * 0.06;
        const lane = runners.length;
        runners.push({ born: T, x0: 23, y0: 146, x1: 70 + (lane % 6) * 26 + Math.random() * 10, y1: 118 + Math.floor(lane / 6) * 13 + Math.random() * 4, skin: SKINS[Math.floor(Math.random() * SKINS.length)], num: 1 + Math.floor(Math.random() * 98) });
      }
      for (const r of runners.slice().sort((a, b) => a.y1 - b.y1)) {
        const a = T - r.born, k = Math.min(1, a / 1.3), e = 1 - (1 - k) * (1 - k);
        const x = r.x0 + (r.x1 - r.x0) * e, y = r.y0 + (r.y1 - r.y0) * e;
        g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(Math.round(x) - 4, Math.round(y) + 1, 9, 2);
        const fr = (k < 1 ? `run${Math.floor(a * 12) % 4}` : Math.floor(T * 3 + r.num) % 2 ? 'party0' : 'party1') as Frame;
        const s = sprite(kit, r.skin, fr, false);
        g.drawImage(s, Math.round(x - s.width / 2), Math.round(y - s.height + 2));
      }
      // Fireworks.
      for (const b of bursts) if (!b.done && T >= b.t) {
        b.done = true;
        for (let i = 0; i < 46; i++) { const ang = (i / 46) * Math.PI * 2, v = 22 + Math.random() * 26; sparks.push({ x: b.x, y: b.y, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v * 0.8, born: T, c: [c0, c1, '#ffd34d', '#ffffff'][i % 4] }); }
      }
      for (const s of sparks) {
        const a = T - s.born; if (a > 1.2) continue;
        s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 26 * dt; s.vx *= 0.985;
        g.fillStyle = a > 0.9 && Math.random() < 0.5 ? 'rgba(255,255,255,.5)' : s.c;
        g.fillRect(Math.round(s.x), Math.round(s.y), 1, 1);
      }
      // Light banks: lamp grids, flares, and the darkness lifting bank by bank.
      [[34, 6], [112, 2], [208, 2], [286, 6]].forEach(([x, y], k) => {
        const lit = T >= BANKS[k], fresh = lit && T - BANKS[k] < 0.15;
        for (let i = 0; i < 12; i++) { g.fillStyle = lit ? (fresh ? '#ffffff' : '#fff6d6') : '#3a3f4c'; g.fillRect(x + 1 + (i % 4) * 3, y + 1 + Math.floor(i / 4) * 3, 2, 2); }
        if (lit) { g.fillStyle = `rgba(255,250,225,${fresh ? 0.8 : 0.35})`; g.fillRect(x - 6, y + 4, 26, 1); g.fillRect(x + 6, y - 4, 2, 17); }
      });
      const dark = Math.max(0, 0.88 - on * 0.22);
      if (dark > 0) { g.fillStyle = `rgba(2,3,8,${dark})`; g.fillRect(0, 0, RW, RH); }
      for (const b of BANKS) if (T >= b && T - b < 0.1) { g.fillStyle = `rgba(255,252,235,${0.4 * (1 - (T - b) / 0.1)})`; g.fillRect(0, 0, RW, RH); }
      // Camera: a slow push, then a hard push into the midfield mark; white flash out.
      const W = (c.width = c.clientWidth), H = (c.height = c.clientHeight);
      out.imageSmoothingEnabled = false;
      const push = 1 + T * 0.025 + (T > 3.7 ? ((T - 3.7) / 0.8) ** 2 * 3.2 : 0);
      const scale = Math.max(W / RW, H / RH) * push;
      const fx = 160, fy = T > 3.7 ? 92 + Math.min(1, (T - 3.7) / 0.8) * 22 : 90 + T * 0.5;
      out.fillStyle = '#000'; out.fillRect(0, 0, W, H);
      out.drawImage(low, W / 2 - fx * scale, H / 2 - fy * scale, RW * scale, RH * scale);
      if (T > 4.1) { out.fillStyle = `rgba(255,255,255,${Math.min(1, (T - 4.1) / 0.35)})`; out.fillRect(0, 0, W, H); }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <div className="pre" onClick={onSkip}>
      <canvas ref={cv} style={{ imageRendering: 'pixelated' }} />
      {t > 1.5 && t < 3.6 && <div className="pre-line"><span>Real rosters.</span><span>Real contracts.</span><b>Your decisions.</b></div>}
      <div className="op-skip">Press any key to skip</div>
    </div>
  );
}
