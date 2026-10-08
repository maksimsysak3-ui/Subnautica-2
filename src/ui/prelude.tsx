// The cold open: first person, in the shotgun. You are the quarterback. The line is in
// front of you, the defense across from it, the stadium lights behind them. Snap, the
// ball comes up into your hands, a drop, the Z receiver runs a go route down the right
// side; the pocket holds, you wind up and let it go. The ball spirals away with the
// camera following it, he catches it in stride in the end zone, the crowd erupts,
// white flash: hand off to the logo opening.
//
// Rendered at low resolution and scaled up with hard pixels, in the same art as the
// broadcast. The field is a true perspective projection (mow stripes, yard lines,
// hash marks, sidelines, painted end zone); players are front/back-view pixel figures
// scaled by distance, animated frame by frame.
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { RAW_TEAMS } from '../core/league';
import type { Team } from '../core/types';
import { paint, pxText, pxWidth } from './field/pixel';
import { UNIFORM } from './components';

const RW = 480, RH = 270, HOR = 96;          // horizon row
export const PRELUDE_MS = 4400;
const T_SNAP = 0.55, T_SET = 1.45, T_REL = 1.75, T_CATCH = 2.95, T_FLASH = 3.95;
const SKINS = ['#e8c4a8', '#c99a76', '#a46e4c', '#7b4b31', '#5a3522'];

// ---- figures: 14-wide grids. H helmet, h stripe, M facemask, S skin, J jersey, N number,
// T trim, G glove, P pants, p stripe, K socks, B shoes. Lower case = shaded far limb.
const HEAD_BACK = ['.....HHHH.....', '....HHHHHH....', '....HHhhHH....', '....HHhhHH....', '.....HHHH.....', '.....SSSS.....'];
const HEAD_FRONT = ['.....HHHH.....', '....HHhhHH....', '....HMMMMH....', '....HMSSMH....', '.....MMMM.....', '.....SSSS.....'];
const BODY = ['..TJJJJJJJJT..', '.JJJJJJJJJJJJ.', '.JJJNNJJNNJJJ.', '.SJJNNJJNNJJS.', '.SJJNNJJNNJJS.', '.GJJJJJJJJJJG.', '...JJJJJJJJ...'];
const BODY_BLOCK = ['..TJJJJJJJJT..', 'SJJJJJJJJJJJJS', 'GJJJNNJJNNJJJG', '..JJNNJJNNJJ..', '..JJNNJJNNJJ..', '...JJJJJJJJ...', '...JJJJJJJJ...'];
const BODY_UP = ['..TJJJJJJJJT..', '..JJJJJJJJJJ..', '..JJNNJJNNJJ..', '..JJNNJJNNJJ..', '..JJNNJJNNJJ..', '..JJJJJJJJJJ..', '...JJJJJJJJ...'];
const ARMS_UP = ['.G..........G.', '.S..........S.', '.S..........S.'];
const LEGS: Record<string, string[]> = {
  stand: ['...PPPPPPPP...', '...PPp..pPP...', '...PPP..PPP...', '...KKK..KKK...', '...KKK..KKK...', '..BBBB..BBBB..', '..............'],
  runA: ['...PPPPPPPP...', '...PPp..pPP...', '...PPP...pp...', '...KKK...kk...', '...KKK........', '..BBBB........', '..............'],
  runB: ['...PPPPPPPP...', '...PPp..pPP...', '....pp..PPP...', '....kk..KKK...', '........KKK...', '........BBBB..', '..............'],
  wide: ['..PPPPPPPPPP..', '..PPp....pPP..', '.PPP......PPP.', '.KKK......KKK.', '.KK........KK.', 'BBB........BBB', '..............'],
};
type Pose = 'stand' | 'runA' | 'runB' | 'block' | 'catch';
interface Kit { J: string; N: string; T: string; H: string; h: string; P: string; p: string; K: string; G: string; M: string }
const figCache = new Map<string, HTMLCanvasElement>();
function figure(kit: Kit, skin: string, front: boolean, pose: Pose): HTMLCanvasElement {
  const key = `${kit.J}${kit.H}${skin}${front}${pose}`;
  const hit = figCache.get(key); if (hit) return hit;
  const head = front ? HEAD_FRONT : HEAD_BACK;
  const rows = pose === 'catch' ? [...ARMS_UP, ...head.slice(1), ...BODY_UP, ...LEGS.stand.slice(0, 4)]
    : pose === 'block' ? ['..............', ...head, ...BODY_BLOCK, ...LEGS.wide]
    : ['..............', ...head, ...BODY, ...LEGS[pose === 'stand' ? 'stand' : pose]];
  const c = paint(rows.slice(0, 20), { ...kit, S: skin, B: '#16181c' } as unknown as Record<string, string>);
  figCache.set(key, c);
  return c;
}
function kitOf(t: Team, home: boolean): Kit {
  const u = UNIFORM[t.abbr] ?? { body: t.colors[0], num: '#ffffff', trim: t.colors[1] ?? '#ffffff' };
  const helmet = t.abbr === 'DAL' ? '#a5acaf' : t.abbr === 'NO' ? '#d3bc8d' : ['PIT', 'NE', 'TEN'].includes(t.abbr) ? '#c0c4c8' : u.body.toUpperCase() === '#FFFFFF' ? t.colors[0] : u.body;
  return home
    ? { J: u.body, N: u.num, T: u.trim, H: helmet, h: u.trim, P: '#e8e6e0', p: u.trim, K: u.body, G: '#f2f2f2', M: '#9aa0a8' }
    : { J: '#f3f3f1', N: t.colors[0], T: t.colors[0], H: helmet, h: t.colors[1] ?? '#fff', P: '#e8e6e0', p: t.colors[0], K: t.colors[0], G: '#1d1f24', M: '#9aa0a8' };
}

// ---- world -> screen ----------------------------------------------------------------
interface Cam { x: number; z: number; y: number; f: number }
const proj = (c: Cam, x: number, y: number, z: number) => { const d = Math.max(0.3, z - c.z); return { sx: RW / 2 + (c.f * (x - c.x)) / d, sy: HOR + (c.f * (c.y - y)) / d, s: c.f / d }; };

/** The stadium above the horizon: stands with a pixel crowd, fascia, light banks. */
function backdrop(t: Team): HTMLCanvasElement {
  const W = RW * 2, c = document.createElement('canvas'); c.width = W; c.height = HOR + 6;
  const g = c.getContext('2d')!;
  const sky = g.createLinearGradient(0, 0, 0, 30); sky.addColorStop(0, '#04050c'); sky.addColorStop(1, '#141a2e');
  g.fillStyle = sky; g.fillRect(0, 0, W, HOR);
  let s = 11; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(255,255,255,${0.25 + r() * 0.6})`; g.fillRect(Math.floor(r() * W), Math.floor(r() * 16), 1, 1); }
  const c0 = t.colors[0], c1 = t.colors[1] ?? '#ffffff';
  for (const [y0, y1, band] of [[24, 52, '#1a1e29'], [56, 92, '#1e2330']] as const) {
    for (let y = y0; y < y1; y++) for (let x = 0; x < W; x++) {
      g.fillStyle = (y - y0) % 3 === 0 ? '#14171f' : band; g.fillRect(x, y, 1, 1);
      if ((y - y0) % 3 && (x + y) % 2 === 0) { const q = r(); g.fillStyle = q < 0.32 ? c0 : q < 0.46 ? c1 : q < 0.58 ? '#e9e4da' : SKINS[Math.floor(r() * 5)]; g.fillRect(x, y, 1, 1); }
    }
    g.fillStyle = y1 === 52 ? c0 : '#0b0d12'; g.fillRect(0, y1, W, 3);
  }
  for (let x = 30; x < W; x += 150) pxText(g, t.nick.toUpperCase(), x, 52, '#ffffff');
  g.fillStyle = '#0a0b10'; g.fillRect(0, HOR - 3, W, 9);
  for (let x = 0; x < W; x += 80) { g.fillStyle = x % 160 ? c0 : '#20242c'; g.fillRect(x, HOR - 3, 60, 3); }
  for (const lx of [90, 330, 630, 870]) { g.fillStyle = '#2a2f3a'; g.fillRect(lx, 2, 24, 12); for (let i = 0; i < 18; i++) { g.fillStyle = '#fff6d6'; g.fillRect(lx + 2 + (i % 6) * 4, 4 + Math.floor(i / 6) * 3, 2, 2); } }
  return c;
}

export function Prelude({ onDone, onSkip }: { onDone: () => void; onSkip: () => void }) {
  const cv = useRef<HTMLCanvasElement>(null);
  const [t, setT] = useState(0);
  const home = useRef(RAW_TEAMS[Math.floor(Math.random() * RAW_TEAMS.length)] as unknown as Team).current;
  const away = useRef((() => { const o = RAW_TEAMS.filter(x => x.abbr !== home.abbr); return o[Math.floor(Math.random() * o.length)] as unknown as Team; })()).current;
  useEffect(() => {
    const end = setTimeout(onDone, PRELUDE_MS);
    const skip = (e: KeyboardEvent) => { e.stopImmediatePropagation(); onSkip(); };
    window.addEventListener('keydown', skip, true);
    return () => { clearTimeout(end); window.removeEventListener('keydown', skip, true); };
  }, []);
  useEffect(() => {
    const out = cv.current!.getContext('2d')!;
    const low = document.createElement('canvas'); low.width = RW; low.height = RH;
    const g = low.getContext('2d')!; g.imageSmoothingEnabled = false;
    const img = g.createImageData(RW, RH - HOR);
    const back = backdrop(home), kh = kitOf(home, true), ka = kitOf(away, false);
    const c0 = home.colors[0], c1 = home.colors[1] ?? '#ffffff';
    const hex = (h: string) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
    const ez = hex(c0.length === 7 ? c0 : '#204080');
    const LOS = 0, GOAL = 40;
    const ol = [-3, -1.5, 0, 1.5, 3].map((x, i) => ({ x, z: 0.6, skin: SKINS[(i * 3) % 5] }));
    const dl = [-3.6, -1.2, 1.2, 3.6].map((x, i) => ({ x, z: 1.6, skin: SKINS[(i * 2 + 1) % 5] }));
    const lbs = [-4, 4].map((x, i) => ({ x, z: 5.5, skin: SKINS[(i + 2) % 5] }));
    const wrL = { x: -16, z: 0.8, skin: SKINS[4] }, te = { x: 5, z: 0.8, skin: SKINS[1] };
    const cbL = { x: -16, z: 7, skin: SKINS[3] }, cbR = { x: 15, z: 7, skin: SKINS[2] }, fs = { x: 3, z: 15, skin: SKINS[0] };
    const zSkin = SKINS[3];
    const start = performance.now();
    let raf = 0, lastT = -1;
    const catchPt = { x: 11.5, y: 2.1, z: GOAL + 3 };
    const zAt = (T: number) => { const k = Math.max(0, T - T_SNAP), run = Math.min(1, k / (T_CATCH - T_SNAP)); const e = run * (0.35 + 0.65 * run); return { x: 15 - 3.5 * run, z: 0.8 + (catchPt.z - 0.8) * e }; };
    const frame = (now: number) => {
      if (!cv.current) return;
      const T = (now - start) / 1000;
      if (Math.floor(T * 10) !== lastT) { lastT = Math.floor(T * 10); setT(T); }
      const drop = T < T_SNAP ? 0 : Math.min(1, (T - T_SNAP) / (T_SET - T_SNAP));
      let cam: Cam = { x: 0, z: -5.5 - drop * 2.4, y: 2.75 + (drop > 0 && drop < 1 ? Math.abs(Math.sin(T * 14)) * 0.06 : 0), f: 230 };
      const flight = T < T_REL ? 0 : Math.min(1, (T - T_REL) / (T_CATCH - T_REL));
      if (flight > 0) { const e = flight * flight * (3 - 2 * flight); cam = { x: cam.x + e * catchPt.x * 0.6, z: cam.z + e * (catchPt.z - 21 - cam.z), y: cam.y + Math.sin(e * Math.PI) * 3 + e * 3, f: 230 + e * 60 }; }
      g.fillStyle = '#04050c'; g.fillRect(0, 0, RW, RH);
      g.drawImage(back, Math.round(-RW / 2 - cam.x * 4), 0);
      const d = img.data;
      for (let row = 0; row < RH - HOR; row++) {
        const dy = row + 0.5, z = cam.z + (cam.f * cam.y) / dy, haze = Math.min(1, (z - cam.z) / 90);
        const lineW = Math.max(0.12, (z - cam.z) * 0.006);
        for (let col = 0; col < RW; col++) {
          const x = cam.x + ((col - RW / 2) * (z - cam.z)) / cam.f;
          let r = 34, gg = 108, b = 48;
          const yd = z - LOS, m5 = ((yd % 5) + 5) % 5;
          if (Math.floor((yd + 100) / 5) % 2) { r = 30; gg = 98; b = 43; }
          if (Math.abs(x) > 26.6) { r = 22; gg = 70; b = 34; }
          if (Math.abs(x) > 28.5) { r = 26; gg = 30; b = 38; }
          if (yd > GOAL && yd < GOAL + 10 && Math.abs(x) <= 26.6) { [r, gg, b] = ez; }
          const onLine = (m5 < lineW || 5 - m5 < lineW) && Math.abs(x) <= 26.65 && yd <= GOAL + 0.2 && yd > -30;
          const side = Math.abs(Math.abs(x) - 26.65) < lineW * 1.6 && yd > -30;
          const hash = Math.abs(Math.abs(x) - 3.08) < 0.35 && (((yd % 1) + 1) % 1) < lineW * 1.2 && yd < GOAL;
          const endBack = Math.abs(yd - (GOAL + 10)) < lineW && Math.abs(x) <= 26.65;
          if (onLine || side || hash || endBack) { r = 238; gg = 240; b = 236; }
          if (Math.abs(yd) < lineW * 1.4 && Math.abs(x) <= 26.65 && T < T_REL) { r = 70; gg = 140; b = 255; }
          if (Math.abs(yd - 10) < lineW * 1.4 && Math.abs(x) <= 26.65 && T < T_REL) { r = 255; gg = 210; b = 40; }
          const k = (row * RW + col) * 4, fog = haze * 0.55;
          d[k] = r + (20 - r) * fog; d[k + 1] = gg + (28 - gg) * fog; d[k + 2] = b + (44 - b) * fog; d[k + 3] = 255;
        }
      }
      g.putImageData(img, 0, HOR);
      { const p = proj(cam, 0, 0, GOAL + 5); const sc = Math.max(1, Math.round(p.s * 0.32)); const txt = home.nick.toUpperCase(); if (p.sy < RH) pxText(g, txt, Math.round(p.sx - pxWidth(txt, sc) / 2), Math.round(p.sy - sc * 2), c1.toLowerCase() === c0.toLowerCase() ? '#fff' : c1, sc); }
      type Bd = { x: number; z: number; skin: string; kit: Kit; front: boolean; pose: Pose };
      const bodies: Bd[] = [];
      const step = (k: number) => (Math.floor(T * 9 + k) % 2 ? 'runA' : 'runB') as Pose;
      const rush = T < T_SNAP ? 0 : Math.min(1, (T - T_SNAP) / 1.1);
      const pre = T < T_SNAP;
      ol.forEach((o, i) => bodies.push({ x: o.x + Math.sin(T * 8 + i) * 0.05 * rush, z: o.z - rush * 1.6, skin: o.skin, kit: kh, front: false, pose: pre ? 'stand' : 'block' }));
      dl.forEach(o => bodies.push({ x: o.x * (1 - rush * 0.1), z: o.z - rush * 1.5, skin: o.skin, kit: ka, front: true, pose: pre ? 'stand' : 'block' }));
      lbs.forEach((o, i) => bodies.push({ x: o.x + (pre ? 0 : (i ? 1 : -1) * rush * 2), z: o.z + rush * 3.5 + flight * 10, skin: o.skin, kit: ka, front: true, pose: pre ? 'stand' : step(i) }));
      const wl = Math.max(0, T - T_SNAP);
      bodies.push({ x: wrL.x + wl * 0.6, z: wrL.z + Math.min(18, wl * 6), skin: wrL.skin, kit: kh, front: false, pose: pre ? 'stand' : step(3) });
      bodies.push({ x: te.x + wl * 1.2, z: te.z + Math.min(9, wl * 4.2), skin: te.skin, kit: kh, front: false, pose: pre ? 'stand' : step(4) });
      bodies.push({ x: cbL.x + wl * 0.5, z: cbL.z + Math.min(16, wl * 5.5), skin: cbL.skin, kit: ka, front: true, pose: pre ? 'stand' : step(5) });
      const zr = zAt(T);
      bodies.push({ x: zr.x + 1.4, z: pre ? cbR.z : Math.max(cbR.z, zr.z - 1.8), skin: cbR.skin, kit: ka, front: T < T_SNAP + 0.6, pose: pre ? 'stand' : step(6) });
      bodies.push({ x: fs.x + (pre ? 0 : Math.min(6, wl * 2.6)), z: fs.z + (pre ? 0 : Math.min(20, wl * 7)), skin: fs.skin, kit: ka, front: true, pose: pre ? 'stand' : step(7) });
      const caught = T >= T_CATCH;
      bodies.push({ x: caught ? catchPt.x - 0.3 : zr.x, z: caught ? catchPt.z + Math.min(3, (T - T_CATCH) * 4) : zr.z, skin: zSkin, kit: kh, front: false,
        pose: T > T_CATCH - 0.25 && T < T_CATCH + 0.35 ? 'catch' : pre ? 'stand' : caught ? (Math.floor(T * 5) % 2 ? 'catch' : 'stand') : step(8) });
      bodies.sort((a, b) => b.z - a.z);
      for (const bd of bodies) {
        if (bd.z <= cam.z + 0.4) continue;
        const p = proj(cam, bd.x, 0, bd.z), hgt = 2.15 * p.s, fig = figure(bd.kit, bd.skin, bd.front, bd.pose);
        const w = (fig.width / fig.height) * hgt;
        if (p.sx + w < 0 || p.sx - w > RW) continue;
        g.fillStyle = 'rgba(0,0,0,.28)'; g.beginPath(); g.ellipse(p.sx, p.sy, w * 0.42, Math.max(1, w * 0.1), 0, 0, Math.PI * 2); g.fill();
        g.drawImage(fig, Math.round(p.sx - w / 2), Math.round(p.sy - hgt), Math.round(w), Math.round(hgt));
      }
      if (flight > 0 && flight < 1) {
        const from = { x: 0.6, y: 2.4, z: -7.0 }, k = flight;
        const bx = from.x + (catchPt.x - from.x) * k, bz = from.z + (catchPt.z - from.z) * k, by = from.y + (catchPt.y - from.y) * k + Math.sin(Math.PI * k) * 9;
        const p = proj(cam, bx, by, bz), L = Math.max(2, 0.55 * p.s), Hh = Math.max(1.5, 0.34 * p.s);
        const sh = proj(cam, bx, 0, bz); g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(Math.round(sh.sx - L / 2), Math.round(sh.sy), Math.round(L), 1);
        g.save(); g.translate(p.sx, p.sy); g.rotate(-0.5);
        g.fillStyle = '#6e3414'; g.beginPath(); g.ellipse(0, 0, L / 2, Hh / 2, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#8f4a1f'; g.beginPath(); g.ellipse(-L * 0.08, -Hh * 0.12, L * 0.32, Hh * 0.25, 0, 0, Math.PI * 2); g.fill();
        if (L > 5) { const sp = (T * 40) % 1; g.fillStyle = '#f2ece0'; g.fillRect(Math.round(-L * 0.18), Math.round((sp - 0.5) * Hh * 0.6), Math.max(1, Math.round(L * 0.36)), 1); }
        g.restore();
      }
      if (T < T_REL + 0.35) {
        const up = T < T_SNAP ? 0 : Math.min(1, (T - T_SNAP) / 0.18);
        const wind = T < T_SET ? 0 : Math.min(1, (T - T_SET) / (T_REL - T_SET));
        const follow = T < T_REL ? 0 : Math.min(1, (T - T_REL) / 0.35);
        const baseY = RH + 30 - up * 62 - wind * 40 + follow * 90, baseX = RW / 2 + 40 + wind * 70 - follow * 60;
        const sleeve = kh.J, glove = kh.G, dark = 'rgba(0,0,0,.28)';
        // Guide hand: drops away as he throws.
        const gx = RW / 2 - 118 - wind * 46, gy = baseY + 28 + wind * 56;
        g.fillStyle = sleeve; g.beginPath(); g.moveTo(gx, gy + 90); g.lineTo(gx + 10, gy + 12); g.lineTo(gx + 62, gy + 4); g.lineTo(gx + 74, gy + 90); g.fill();
        g.fillStyle = dark; g.fillRect(gx + 50, gy + 8, 12, 82);
        g.fillStyle = kh.T; g.fillRect(gx + 8, gy + 26, 60, 4);
        g.fillStyle = glove; g.beginPath(); g.ellipse(gx + 46, gy + 6, 20, 13, -0.3, 0, Math.PI * 2); g.fill();
        g.fillStyle = dark; for (let f = 0; f < 4; f++) g.fillRect(gx + 34 + f * 6, gy - 4, 2, 9);
        // Throwing arm: sleeve with stripe and shading, wrist tape, glove wrapped on the laces.
        g.save(); g.translate(baseX, baseY); g.rotate(-0.35 - wind * 0.6 + follow * 1.2);
        g.fillStyle = sleeve; g.beginPath(); g.moveTo(-30, 140); g.lineTo(-24, 14); g.lineTo(24, 14); g.lineTo(34, 140); g.fill();
        g.fillStyle = dark; g.beginPath(); g.moveTo(10, 14); g.lineTo(24, 14); g.lineTo(34, 140); g.lineTo(16, 140); g.fill();
        g.fillStyle = kh.T; g.fillRect(-27, 46, 58, 5); g.fillRect(-28, 56, 60, 3);
        g.fillStyle = '#e9e6df'; g.fillRect(-21, 4, 42, 12);   // wrist tape
        g.fillStyle = 'rgba(0,0,0,.15)'; g.fillRect(-21, 9, 42, 1);
        if (T < T_REL && up > 0.6) {
          g.save(); g.rotate(-0.25);
          g.fillStyle = '#5a2a0f'; g.beginPath(); g.ellipse(0, -24, 37, 22, 0, 0, Math.PI * 2); g.fill();
          g.fillStyle = '#7a3a16'; g.beginPath(); g.ellipse(-2, -26, 34, 19, 0, 0, Math.PI * 2); g.fill();
          g.fillStyle = '#9a5226'; g.beginPath(); g.ellipse(-10, -33, 18, 7, 0, 0, Math.PI * 2); g.fill();
          g.fillStyle = '#f2ece0'; g.fillRect(-16, -27, 32, 3); for (let k = -2; k <= 2; k++) g.fillRect(k * 6 - 1, -31, 2, 10);
          g.fillStyle = '#f2ece0'; g.fillRect(-33, -26, 4, 4); g.fillRect(29, -26, 4, 4);   // stripes at the tips
          g.restore();
        }
        g.fillStyle = glove; g.beginPath(); g.ellipse(-4, -6, 24, 16, -0.2, 0, Math.PI * 2); g.fill();
        g.fillStyle = dark; for (let f = 0; f < 4; f++) g.fillRect(-18 + f * 8, -18, 3, 12);
        g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(-20, -14, 10, 3);
        g.restore();
      }
      const flashes = caught ? 40 : 12;
      for (let i = 0; i < flashes; i++) { g.fillStyle = 'rgba(255,255,255,.9)'; g.fillRect(Math.floor(Math.random() * RW), 24 + Math.floor(Math.random() * 68), 1, 1); }
      if (caught && T - T_CATCH < 0.12) { g.fillStyle = `rgba(255,255,255,${0.35 * (1 - (T - T_CATCH) / 0.12)})`; g.fillRect(0, 0, RW, RH); }
      g.fillStyle = '#000'; g.fillRect(0, 0, RW, 10); g.fillRect(0, RH - 10, RW, 10);
      const cvs = cv.current!, W = (cvs.width = cvs.clientWidth), H = (cvs.height = cvs.clientHeight);
      out.imageSmoothingEnabled = false;
      const sc = Math.max(W / RW, H / RH);
      out.fillStyle = '#000'; out.fillRect(0, 0, W, H);
      out.drawImage(low, (W - RW * sc) / 2, (H - RH * sc) / 2, RW * sc, RH * sc);
      if (T > T_FLASH) { out.fillStyle = `rgba(255,255,255,${Math.min(1, (T - T_FLASH) / 0.35)})`; out.fillRect(0, 0, W, H); }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <div className="pre" onClick={onSkip}>
      <canvas ref={cv} style={{ imageRendering: 'pixelated' }} />
      {t < T_SNAP + 0.2 && <div className="pre-call"><span>{home.nick}</span><b>1ST &amp; 10</b><em>Opp 40</em></div>}
      {t >= T_CATCH && <div className="pre-td" style={{ '--tc': home.colors[0] } as CSSProperties}>Touchdown</div>}
      <div className="op-skip">Press any key to skip</div>
    </div>
  );
}
