// The live game, in pixel art. The field is drawn at low resolution and scaled up
// with hard pixels; the camera is a steady sideline view that pans with the ball
// and never zooms or shakes. Every frame reads the play from the simulation:
// who holds the ball, when it is thrown, caught, knocked away or dead. So an
// incompletion looks like a ball bouncing on the turf, never like a pick.
// Extras that make it feel alive: the chain crew and down marker, two officials
// who run in and signal, pylons, tackle dust, confetti on a score.
import { useEffect, useMemo, useRef, useState } from 'react';
import type { PlayEvent } from '../sim/game';
import type { Team } from '../core/types';
import { UNIFORM } from './components';
import { buildScene, lineupFor, type Scene } from './field/scene';
import { sprite, type Frame, type Kit } from './field/pixel';
import { FORMATION, OL_SPOTS, type Art } from './playart';
import { warmSkins } from './skin';
import { app } from './store';

const MID = 26.65, FW = 53.3;
const lum = (hex: string) => { const n = parseInt(hex.replace('#', '').slice(0, 6), 16); return 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255); };
function kitFor(t: Team, home: boolean): Kit {
  const u = UNIFORM[t.abbr] ?? { body: t.colors[0], num: '#ffffff', trim: t.colors[1] };
  const helmet = t.abbr === 'DAL' ? '#a5acaf' : t.abbr === 'NO' ? '#d3bc8d' : t.abbr === 'PIT' || t.abbr === 'NE' || t.abbr === 'TEN' ? '#c0c4c8' : u.body === '#FFFFFF' ? t.colors[0] : u.body;
  const dark = lum(u.body) < 200 ? u.body : t.colors[0];
  const pants = lum(t.colors[1] ?? '#ccc') > 150 ? t.colors[1] : '#dcdcdc';
  return home
    ? { jersey: u.body, num: u.num, trim: u.trim, pants, helmet, mask: '#9aa0a8', socks: dark }
    : { jersey: '#f3f3f1', num: dark, trim: u.trim === '#FFFFFF' ? dark : u.trim, pants: lum(pants) > 200 ? pants : '#ececec', helmet, mask: '#9aa0a8', socks: dark };
}
const SKIN = ['#e8c4a8', '#c99a76', '#a46e4c', '#7b4b31', '#5a3522'];
const hashStr = (s: string) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); };

// ---- low-res geometry --------------------------------------------------------------------
interface Geo { RW: number; RH: number; S: number; ppy: number; dep: number; top: number }
const SPAN = 46; // yards across the frame
function geo(w: number, h: number): Geo {
  const S = Math.max(2, Math.round(w / 340));
  const RW = Math.ceil(w / S), RH = Math.ceil(h / S);
  const ppy = RW / SPAN;
  const top = Math.round(RH * 0.16);
  const dep = (RH - top - 8) / (FW * ppy);
  return { RW, RH, S, ppy, dep, top };
}

// ---- the static field, drawn once per matchup -------------------------------------------
function buildField(G: Geo, home: Team, away: Team, logo: HTMLImageElement | null) {
  const X0 = -40, X1 = 160;
  const c = document.createElement('canvas');
  c.width = Math.ceil((X1 - X0) * G.ppy); c.height = G.RH;
  const g = c.getContext('2d')!;
  const X = (x: number) => Math.round((x - X0) * G.ppy), Y = (y: number) => Math.round(G.top + y * G.ppy * G.dep);
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  g.fillStyle = '#0d1018'; g.fillRect(0, 0, c.width, Y(-3));
  const fans = [home.colors[0], home.colors[0], home.colors[1] ?? '#fff', '#2a2f3a', '#d8cfc0', '#3b4150', away.colors[0]];
  for (let y = 2; y < Y(-3) - 4; y += 2) for (let x = (y % 4) / 2; x < c.width; x += 2) { if (rnd() < 0.82) { g.fillStyle = fans[Math.floor(rnd() * fans.length)]; g.globalAlpha = 0.35 + (y / Y(-3)) * 0.55; g.fillRect(x, y, 1, 1); } }
  g.globalAlpha = 1;
  g.fillStyle = home.colors[0]; g.fillRect(0, Y(-3) - 4, c.width, 3);
  g.fillStyle = 'rgba(255,255,255,.55)'; for (let x = 0; x < c.width; x += 9) g.fillRect(x, Y(-3) - 3, 4, 1);
  g.fillStyle = '#1f5a2c'; g.fillRect(0, Y(-3) - 1, c.width, G.RH);
  for (let i = -2; i < 26; i++) { g.fillStyle = i % 2 ? '#2f8a3e' : '#2b7f39'; g.fillRect(X(i * 5), Y(0), Math.ceil(5 * G.ppy), Y(FW) - Y(0)); }
  for (let n = 0; n < c.width * 4; n++) { g.fillStyle = rnd() < 0.5 ? 'rgba(0,0,0,.08)' : 'rgba(255,255,255,.05)'; g.fillRect(Math.floor(rnd() * c.width), Y(0) + Math.floor(rnd() * (Y(FW) - Y(0))), 1, 1); }
  for (const [ex, t] of [[0, away], [110, home]] as const) {
    g.fillStyle = t.colors[0]; g.fillRect(X(ex), Y(0), X(ex + 10) - X(ex), Y(FW) - Y(0));
    g.save(); g.translate((X(ex) + X(ex + 10)) / 2, (Y(0) + Y(FW)) / 2); g.rotate(ex ? Math.PI / 2 : -Math.PI / 2);
    g.font = `700 ${Math.round(G.ppy * 4.2)}px Silkscreen, monospace`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = 'rgba(0,0,0,.35)'; g.fillText(t.nick.toUpperCase(), 1, 1); g.fillStyle = '#fff'; g.fillText(t.nick.toUpperCase(), 0, 0); g.restore();
  }
  g.fillStyle = '#f4f4ee';
  g.fillRect(X(0), Y(0), X(120) - X(0), 1); g.fillRect(X(0), Y(FW), X(120) - X(0) + 1, 1);
  for (let x = 0; x <= 120; x += 5) { if ((x > 0 && x < 10) || (x > 110 && x < 120)) continue; g.fillRect(X(x), Y(0), x === 10 || x === 110 ? 2 : 1, Y(FW) - Y(0)); }
  for (let x = 11; x < 110; x++) if (x % 5) for (const y of [1, 23.6, 29.7, FW - 1]) g.fillRect(X(x), Y(y), 1, 1);
  g.font = `700 ${Math.max(7, Math.round(G.ppy * 1.6))}px Silkscreen, monospace`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = 'rgba(244,244,238,.9)';
  for (let x = 20; x <= 100; x += 10) { const n = String(x <= 60 ? x - 10 : 110 - x); g.fillText(n, X(x), Y(FW - 10)); g.save(); g.translate(X(x), Y(10)); g.rotate(Math.PI); g.fillText(n, 0, 0); g.restore(); }
  if (logo) { const s = G.ppy * 7; g.imageSmoothingEnabled = false; g.globalAlpha = 0.9; g.drawImage(logo, X(60) - s / 2, Y(MID) - (s * G.dep * 1.1) / 2, s, s * G.dep * 1.1); g.globalAlpha = 1; }
  g.fillStyle = '#ff6a00'; for (const x of [10, 110]) for (const y of [0, FW]) g.fillRect(X(x) - 1, Y(y) - 2, 2, 3);
  for (const [bx, t] of [[33, away], [67, home]] as const) { g.fillStyle = 'rgba(8,10,14,.6)'; g.fillRect(X(bx), Y(-2.6), X(bx + 20) - X(bx), 3); g.fillStyle = t.colors[0]; g.fillRect(X(bx), Y(-1.2), X(bx + 20) - X(bx), 1); }
  return { c, X0 };
}

/** Goalposts stand up out of the end lines: yellow pixels, crossbar at 10 ft. */
function drawPosts(g: CanvasRenderingContext2D, G: Geo, sx: (x: number) => number, sy: (y: number, z?: number) => number) {
  for (const ex of [0, 120]) {
    const x = sx(ex); if (x < -10 || x > G.RW + 10) continue;
    const base = sy(MID), bar = sy(MID, 3.3), l = sy(MID - 3.08), r = sy(MID + 3.08);
    g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(x + 1, base, 1, 2);
    g.fillStyle = '#ffd400';
    g.fillRect(x, bar, 1, base - bar);
    g.fillRect(x, l - (base - bar), 1, r - l);                 // crossbar spans the depth of the uprights
    g.fillRect(x - 1, l - (base - bar) - Math.round(G.ppy * 6 * 0.85), 1, Math.round(G.ppy * 6 * 0.85));
    g.fillRect(x + 1, r - (base - bar) - Math.round(G.ppy * 6 * 0.85), 1, Math.round(G.ppy * 6 * 0.85));
  }
}

// ---- the component -----------------------------------------------------------------------
interface Fx { kind: 'dust' | 'confetti'; x: number; y: number; t0: number; c?: string[] }
export function FieldView({ ev: evIn, home, away, logo, playing: playIn, onDone }: { ev: PlayEvent | null; home: Team; away: Team; logo?: string; playing: boolean; onDone?: () => void }) {
  const lastEv = useRef<PlayEvent | null>(null);
  if (evIn) lastEv.current = evIn;
  const ev = evIn ?? lastEv.current;
  const playing = playIn && !!evIn;
  useEffect(() => { if (playIn && !evIn) onDone?.(); }, [playIn, evIn]);
  const wrap = useRef<HTMLDivElement>(null);
  const cv = useRef<HTMLCanvasElement>(null);
  const low = useRef<HTMLCanvasElement | null>(null);
  const field = useRef<{ c: HTMLCanvasElement; X0: number; key: string } | null>(null);
  const img = useRef<HTMLImageElement | null>(null);
  const camX = useRef(60);
  const size = useRef({ w: 1000, h: 520 });
  const [banner, setBanner] = useState<{ n: number; text: string; color: string; sub?: string; small?: boolean } | null>(null);
  const kits = useMemo(() => [kitFor(away, false), kitFor(home, true)] as const, [home.abbr, away.abbr]);
  const lineups = useMemo(() => [lineupFor(away), lineupFor(home)] as [ReturnType<typeof lineupFor>, ReturnType<typeof lineupFor>], [home.abbr, away.abbr, ev?.n]);
  useEffect(() => { const L = app.league; if (L) warmSkins(Object.values(L.players).filter(p => p.team === home.abbr || p.team === away.abbr)); }, [home.abbr, away.abbr]);
  useEffect(() => { if (!logo) return; const i = new Image(); i.crossOrigin = 'anonymous'; i.src = logo; i.onload = () => { img.current = i; field.current = null; }; }, [logo]);
  useEffect(() => {
    const el = wrap.current!, c = cv.current!;
    const fit = () => { const w = el.clientWidth, h = Math.round(Math.min(w * 0.5, window.innerHeight * 0.68)); c.width = w; c.height = h; c.style.height = `${h}px`; size.current = { w, h }; field.current = null; };
    fit(); const ro = new ResizeObserver(fit); ro.observe(el); return () => ro.disconnect();
  }, []);
  useEffect(() => {
    const c = cv.current!, ctx = c.getContext('2d')!;
    const scene = ev ? buildScene(ev, lineups) : null;
    const dur = scene?.dur ?? 1;
    if (playing) setBanner(null);
    let raf = 0, last = performance.now(), t = playing && scene ? 0 : 1, ended = false, endAt = 0;
    const fx: Fx[] = [];
    let dusted = false, partied = false;
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (playing && scene && t < 1) t = Math.min(1, t + dt / dur);
      const { w, h } = size.current;
      const G = geo(w, h);
      if (!low.current) low.current = document.createElement('canvas');
      const lc = low.current; if (lc.width !== G.RW || lc.height !== G.RH) { lc.width = G.RW; lc.height = G.RH; }
      const key = `${G.RW}x${G.RH}|${home.abbr}|${away.abbr}|${img.current ? 1 : 0}`;
      if (!field.current || field.current.key !== key) field.current = { ...buildField(G, home, away, img.current), key };
      const g = lc.getContext('2d')!;
      g.imageSmoothingEnabled = false;
      // Steady camera: pan only when the ball leaves the centre box; never zoom or shake.
      const goal = aim(scene, t, playing);
      const box = SPAN * 0.14, off = goal - camX.current;
      if (playing && t > 0 && t < 1) { if (Math.abs(off) > box) camX.current += (off - Math.sign(off) * box) * (1 - Math.exp(-dt * 3.5)); }
      else camX.current += off * (1 - Math.exp(-dt * 2.6));
      const cx = camX.current;
      const sx = (x: number) => Math.round((x - cx) * G.ppy + G.RW / 2);
      const sy = (y: number, z = 0) => Math.round(G.top + y * G.ppy * G.dep - z * G.ppy * 0.85);
      g.fillStyle = '#0d1018'; g.fillRect(0, 0, G.RW, G.RH);
      g.drawImage(field.current.c, Math.round((cx - field.current.X0) * G.ppy - G.RW / 2), 0, G.RW, G.RH, 0, 0, G.RW, G.RH);
      if (scene) {
        const r = drawPlay(g, G, scene, t, kits, now, sx, sy);
        if (r.tackled && !dusted) { dusted = true; fx.push({ kind: 'dust', x: r.tackled[0], y: r.tackled[1], t0: now }); }
        if (scene.td && scene.endAt !== undefined && t >= scene.endAt && !partied) { partied = true; const tm = scene.off === 1 ? home : away; fx.push({ kind: 'confetti', x: r.ball[0], y: r.ball[1], t0: now, c: [tm.colors[0], tm.colors[1] ?? '#fff', '#fff', '#ffd23f'] }); }
      }
      drawPosts(g, G, sx, sy);
      drawFx(g, fx, now, sx, sy);
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.drawImage(lc, 0, 0, G.RW, G.RH, 0, 0, G.RW * G.S, G.RH * G.S);
      if (scene) drawTags(ctx, G, scene, t, sx, sy, kits);
      if (playing && t >= 1 && !ended) {
        ended = true; endAt = now;
        if (ev) { const b = bannerFor(ev, home, away, scene); if (b) setBanner({ n: ev.n, ...b }); }
        onDone?.();
      }
      const busy = (playing && t < 1) || Math.abs(goal - camX.current) > 0.05 || fx.some(f => now - f.t0 < 2600) || (ended && now - endAt < 2600);
      if (busy) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [ev?.n, playing]);
  return (
    <div ref={wrap} className="bcast px">
      <canvas ref={cv} style={{ width: '100%', display: 'block', imageRendering: 'pixelated' }} />
      {ev && <div className="bc-dd"><b>{ev.type === 'kickoff' ? 'Kickoff' : ev.type === 'punt' ? 'Punt' : ev.type === 'fg' ? 'Field Goal' : ev.type === 'xp' ? 'Extra Point' : `${['1st', '2nd', '3rd', '4th'][ev.down - 1] ?? ''} & ${ev.yl + ev.togo >= 100 ? 'Goal' : ev.togo}`}</b>{ev.call && <span>{ev.call}</span>}{ev.dcall && <em>vs {ev.dcall}</em>}</div>}
      {banner && <div key={banner.n} className={`pxbanner${banner.small ? ' small' : ''}`} style={{ '--bc': banner.color } as React.CSSProperties}><span>{banner.text}</span>{banner.sub && <small>{banner.sub}</small>}</div>}
    </div>
  );
}

/** Where the camera wants to centre: ahead of the line before the snap, then on the ball. */
function aim(sc: Scene | null, t: number, playing: boolean): number {
  if (!sc) return 60;
  if (!sc.kick && playing && t < sc.pre) return sc.los + sc.dirSign * 6;
  const [bx] = sc.ball(Math.min(1, t));
  const [ax] = sc.ball(Math.min(1, t + 0.05));
  return Math.max(12, Math.min(108, bx + (ax - bx) * 2));
}

// ---- drawing the play ----------------------------------------------------------------------
function drawPlay(g: CanvasRenderingContext2D, G: Geo, sc: Scene, t: number, kits: readonly [Kit, Kit], now: number, sx: (x: number) => number, sy: (y: number, z?: number) => number) {
  const s = sc.dirSign;
  if (!sc.kick) {
    g.fillStyle = 'rgba(70,150,255,.9)'; g.fillRect(sx(sc.los), sy(0), 1, sy(FW) - sy(0));
    g.fillStyle = 'rgba(255,214,10,.95)'; g.fillRect(sx(sc.first), sy(0), 1, sy(FW) - sy(0));
    // Chain crew on the far sideline: the down marker and the two sticks with the chain between.
    const yy = sy(-1.4);
    g.fillStyle = '#ff7a00'; g.fillRect(sx(sc.los), yy - 7, 1, 7); g.fillRect(sx(sc.los) - 1, yy - 9, 3, 3);
    const a = sx(sc.first), b = sx(sc.first - s * 10);
    for (const x of [a, b]) { g.fillStyle = '#ff7a00'; g.fillRect(x, yy - 8, 1, 8); g.fillRect(x - 1, yy - 9, 3, 2); }
    g.fillStyle = 'rgba(200,200,200,.8)'; g.fillRect(Math.min(a, b), yy - 4, Math.abs(a - b), 1);
  }
  if (t < sc.pre + 0.04 && (sc.art || sc.dart)) { g.globalAlpha = t < sc.pre ? 0.9 : Math.max(0, 1 - (t - sc.pre) / 0.04); drawArt(g, sc, sc.dart ?? [], true, sx, sy); drawArt(g, sc, sc.art ?? [], false, sx, sy); g.globalAlpha = 1; }
  const secs = t * sc.dur;
  const dt = 0.006;
  const pos = sc.actors.map(a => a.path(Math.max(0, t)));
  const prev = sc.actors.map(a => a.path(Math.max(0, t - dt)));
  const back = sc.actors.map(a => a.path(Math.max(0, t - 0.25 / sc.dur)));   // a quarter-second ago: facing follows real direction, not jitter
  const [bx, by] = sc.ball(t), bh = sc.ballH(t);
  const holder = sc.hold ? sc.hold(t) : -1;
  let carrier = holder, tackler = -1, down = 0;
  if (sc.tackle !== undefined && t >= sc.tackle - 0.05 && sc.hold) {
    let c0 = sc.hold(sc.tackle - 0.005); if (c0 < 0) c0 = sc.hold(Math.min(0.999, sc.tackle + 0.005));
    if (c0 >= 0) {
      carrier = c0; down = Math.max(0, Math.min(1, (t - sc.tackle) / Math.max(0.05, 1 - sc.tackle)));
      const cp = sc.actors[c0].path(sc.tackle); let best = 1e9;
      if (sc.tackler !== undefined && sc.tackler >= 0) tackler = sc.tackler;
      else sc.actors.forEach((a, i) => { if (a.team !== sc.actors[c0].team) { const [x, y] = a.path(sc.tackle!); const d = Math.hypot(x - cp[0], y - cp[1]); if (d < best) { best = d; tackler = i; } } });
      if (tackler >= 0 && down > 0) { const side = Math.sign(pos[c0][0] - pos[tackler][0]) || s; pos[tackler] = [pos[tackler][0] + (pos[c0][0] - side * 0.7 - pos[tackler][0]) * down, pos[tackler][1] + (pos[c0][1] + 0.3 - pos[tackler][1]) * down]; }
    }
  }
  let swatter = -1;
  if (sc.pass && !sc.complete && !sc.int && sc.catchAt !== undefined && sc.broken) {
    const cp = sc.ball(sc.catchAt); let best = 1e9;
    if (sc.swatter !== undefined && sc.swatter >= 0) swatter = sc.swatter;
    else sc.actors.forEach((a, i) => { if (a.team !== sc.off) { const [x, y] = a.path(sc.catchAt!); const d = Math.hypot(x - cp[0], y - cp[1]); if (d < best) { best = d; swatter = i; } } });
  }
  const after = sc.endAt !== undefined && t > sc.endAt + 0.01;
  const scorer = sc.td && sc.hold && sc.endAt !== undefined ? sc.hold(sc.endAt - 0.005) : -1;
  // Officials: referee behind the offense, line judge on the near side; both come to the spot at the whistle.
  const refs: [number, number, Frame][] = [];
  {
    const spot = carrier >= 0 ? pos[carrier] : [bx, by];
    const whistle = sc.endAt ?? sc.tackle ?? 1;
    const k = t > whistle ? Math.min(1, ((t - whistle) * sc.dur) / 0.9) : 0;
    const r1: [number, number] = [sc.los - s * 12, MID + 3], r2: [number, number] = [sc.los + s * 1, FW - 1.5];
    refs.push([r1[0] + (spot[0] - s * 3 - r1[0]) * k, r1[1] + (spot[1] + 3 - r1[1]) * k, sc.td && after ? 'signal' : k > 0 && k < 1 ? (`run${Math.floor(secs * 6) % 4}` as Frame) : 'stand']);
    refs.push([r2[0] + (spot[0] - r2[0]) * k * 0.8, r2[1], k > 0 && k < 1 ? (`run${Math.floor(secs * 6 + 2) % 4}` as Frame) : 'stand']);
  }
  if (holder < 0 || bh > 1.6) { g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(sx(bx) - 1, sy(by), 3, 1); }
  const list: { y: number; draw: () => void }[] = [];
  sc.actors.forEach((a, i) => {
    const vx = (pos[i][0] - prev[i][0]) / (dt * sc.dur), vy = (pos[i][1] - prev[i][1]) / (dt * sc.dur);
    const speed = Math.hypot(vx, vy);
    const isOff = a.team === sc.off;
    const fx0 = pos[i][0] - back[i][0];
    let face = Math.abs(fx0) > 0.35 ? Math.sign(fx0) : a.facing;
    const big = /^(OL|DL|FG|FB|RU)/.test(a.slot);
    const cyc = Math.floor(secs * (2.4 + speed * 0.75) + i * 0.37) % 4;
    let f: Frame = speed > 0.8 ? (`run${cyc}` as Frame) : 'stand';
    if (!sc.kick && t < sc.pre + 0.01) { f = a.slot.startsWith('OL') || a.slot.startsWith('DL') ? 'three' : 'crouch'; face = isOff ? s : -s; }
    else if (i === carrier && down > 0.15) f = 'down';
    else if (i === tackler && down > 0) f = down < 0.45 ? 'dive' : 'down';
    else if (sc.kicker === i && sc.kickAt !== undefined && Math.abs(t - sc.kickAt) * sc.dur < 0.22) f = 'kick';
    else if (sc.qb === i && sc.throwAt !== undefined && (t - sc.throwAt) * sc.dur > -0.38 && (t - sc.throwAt) * sc.dur < 0.2) { f = t < sc.throwAt ? 'throwA' : 'throwB'; face = s; }
    else if ((i === sc.target || i === swatter || (sc.int && i === holder)) && sc.catchAt !== undefined && (t - sc.catchAt) * sc.dur > -0.3 && (t - sc.catchAt) * sc.dur < 0.08) f = 'catch';
    else if (sc.td && after && (i === scorer || (isOff && scorer >= 0 && Math.hypot(pos[i][0] - pos[scorer][0], pos[i][1] - pos[scorer][1]) < 8))) f = Math.floor(now / 160 + i) % 2 ? 'party0' : 'party1';
    else if (i === holder && speed > 0.8) f = (`carry${cyc}` as Frame);
    else if (!sc.kick && !after && big && speed < 3.5 && sc.actors.some((o, j) => o.team !== a.team && Math.hypot(pos[j][0] - pos[i][0], pos[j][1] - pos[i][1]) < 1.4)) { f = Math.floor(secs * 5 + i) % 2 ? 'block0' : 'block1'; face = isOff ? s : -s; }
    else if (!sc.kick && !after && !isOff && !big && speed > 0.6 && Math.sign(vx) === s && (sc.throwAt === undefined || t < sc.throwAt)) { f = (`run${3 - cyc}` as Frame); face = -s; }
    const skin = a.skin ?? SKIN[(a.id ? hashStr(a.id) : a.num) % SKIN.length];
    const kit = kits[a.team];
    const [x, y] = pos[i];
    list.push({ y, draw: () => {
      const px = sx(x), py = sy(y);
      if (px < -20 || px > G.RW + 20) return;
      g.fillStyle = 'rgba(0,0,0,.32)'; g.fillRect(px - 4, py, 9, 1); g.fillRect(px - 3, py + 1, 7, 1);
      g.drawImage(sprite(kit, skin, f, face < 0), px - 7, py - 16);
      if (i === holder && bh < 1.6 && f !== 'down' && !f.startsWith('carry') && f !== 'catch') { g.fillStyle = '#7a3a12'; g.fillRect(px + (face > 0 ? 2 : -4), py - 9, 3, 2); }
    } });
  });
  refs.forEach(([x, y, f]) => list.push({ y, draw: () => { const px = sx(x), py = sy(y); g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(px - 3, py, 7, 1); g.drawImage(sprite(kits[0], '#c99a76', f, x > bx, true), px - 7, py - 16); } }));
  list.sort((a, b) => a.y - b.y).forEach(d => d.draw());
  if (holder < 0 || bh > 1.6) {
    const px = sx(bx), py = sy(by, bh);
    const spin = Math.floor(now / 70) % 2;
    g.fillStyle = '#1a0d05'; g.fillRect(px - 2, py - 1, 5, 3);
    g.fillStyle = '#8a4416'; g.fillRect(px - 1, py, 3, 1); g.fillRect(px - 1 + spin * 2, py - 1, 1, 1);
    g.fillStyle = '#fff'; g.fillRect(px, py, 1, 1);
  }
  return { ball: [bx, by] as [number, number], tackled: down > 0.25 && carrier >= 0 ? pos[carrier] : null };
}

function drawArt(g: CanvasRenderingContext2D, sc: Scene, art: Art[], def: boolean, sx: (x: number) => number, sy: (y: number, z?: number) => number) {
  const s = sc.dirSign;
  const at = (dx: number, dy: number): [number, number] => [sx(sc.los + s * dx), sy(MID + s * dy)];
  let ol = 0;
  g.lineWidth = 1;
  for (const a of art) {
    if (a.kind === 'zone') { const [x, y] = at(a.pts[0][0], a.pts[0][1]); g.strokeStyle = a.pts[0][0] > 12 ? 'rgba(120,190,255,.8)' : 'rgba(255,210,63,.8)'; g.beginPath(); g.ellipse(x, y, (a.r ?? 5) * 5, (a.r ?? 5) * 2.5, 0, 0, 7); g.stroke(); continue; }
    const start = def ? a.pts[0] : a.who === 'OL' ? OL_SPOTS[ol++ % 5] : FORMATION[a.who as keyof typeof FORMATION];
    const pts = def ? a.pts : [start, ...a.pts];
    g.strokeStyle = a.primary ? '#ffd23f' : a.kind === 'blitz' ? '#ff4d5e' : a.kind === 'block' ? 'rgba(255,255,255,.5)' : '#fff';
    g.beginPath(); pts.forEach(([dx, dy], j) => { const [x, y] = at(dx, dy); j ? g.lineTo(x + 0.5, y + 0.5) : g.moveTo(x + 0.5, y + 0.5); }); g.stroke();
    const [ex, ey] = at(...pts[pts.length - 1]); g.fillStyle = g.strokeStyle as string; g.fillRect(ex - 1, ey - 1, 3, 3);
  }
}

function drawFx(g: CanvasRenderingContext2D, fx: { kind: string; x: number; y: number; t0: number; c?: string[] }[], now: number, sx: (x: number) => number, sy: (y: number, z?: number) => number) {
  for (const f of fx) {
    const age = (now - f.t0) / 1000;
    if (f.kind === 'dust' && age < 0.7) {
      g.fillStyle = `rgba(214,204,176,${0.75 - age})`;
      for (let k = 0; k < 8; k++) { const a = k * 0.8, r = 2 + age * 14; g.fillRect(sx(f.x) + Math.round(Math.cos(a) * r), sy(f.y) - 1 - Math.round(Math.abs(Math.sin(a)) * r * 0.4), 2, 1); }
    }
    if (f.kind === 'confetti' && age < 2.6) {
      for (let k = 0; k < 70; k++) {
        const ox = ((k * 37) % 61) - 30, vy = 16 + (k % 7) * 4;
        const x = sx(f.x) + ox + Math.round(Math.sin(age * 6 + k) * 3), y = sy(f.y) - 46 + Math.round(age * vy) - Math.round(Math.max(0, 1 - age * 2) * 22);
        g.fillStyle = f.c![k % f.c!.length]; g.fillRect(x, y, 1 + (k % 2), 1);
      }
    }
  }
}

/** Crisp label drawn after the up-scale: the ball carrier's (or intended receiver's) number and name. */
function drawTags(ctx: CanvasRenderingContext2D, G: Geo, sc: Scene, t: number, sx: (x: number) => number, sy: (y: number, z?: number) => number, kits: readonly [Kit, Kit]) {
  const h = sc.hold ? sc.hold(t) : -1;
  const who = h >= 0 ? h : sc.target !== undefined && sc.throwAt !== undefined && t > sc.throwAt && (sc.catchAt === undefined || t < sc.catchAt) ? sc.target : -1;
  if (who < 0 || (!sc.kick && t < sc.pre + 0.03)) return;
  const a = sc.actors[who], [x, y] = a.path(t);
  const px = sx(x) * G.S, py = (sy(y) - 20) * G.S;
  ctx.font = '700 11px Silkscreen, monospace';
  const label = `${a.num} ${(a.ln || a.role).toUpperCase()}`;
  const w = ctx.measureText(label).width + 14;
  const kit = kits[a.team];
  ctx.fillStyle = 'rgba(8,10,14,.9)'; ctx.fillRect(Math.round(px - w / 2), Math.round(py - 16), Math.round(w), 16);
  ctx.fillStyle = kit.jersey === '#f3f3f1' ? kit.num : kit.jersey; ctx.fillRect(Math.round(px - w / 2), Math.round(py - 16), 3, 16);
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, Math.round(px + 2), Math.round(py - 7));
}

/** The graphic after the whistle. Incompletions say so; only a real interception says pick. */
function bannerFor(ev: PlayEvent, home: Team, away: Team, sc: Scene | null): { text: string; color: string; sub?: string; small?: boolean } | null {
  const t = ev.poss === 1 ? home : away, o = ev.poss === 1 ? away : home;
  if (ev.td) return { text: 'Touchdown!', color: (ev.type === 'punt' ? o : t).colors[0], sub: (ev.type === 'punt' ? o : t).name };
  if (ev.type === 'fg') return /NO GOOD/.test(ev.text) ? { text: 'No Good', color: '#7a1f2b' } : { text: "It's Good!", color: t.colors[0] };
  if (ev.turnover && ev.type === 'pass') return { text: 'Intercepted!', color: o.colors[0], sub: o.name };
  if (ev.turnover && (ev.type === 'run' || ev.type === 'scramble' || ev.type === 'sack')) return { text: 'Fumble!', color: o.colors[0], sub: `${o.nick} ball` };
  if (/BLOCKED/.test(ev.text)) return { text: 'Blocked!', color: o.colors[0] };
  if (ev.type === 'sack') return { text: 'Sack!', color: o.colors[0], sub: `Loss of ${Math.abs(ev.yards)}` };
  if (ev.type === 'pass' && !ev.complete) return { text: sc?.broken ? 'Broken Up' : 'Incomplete', color: '#2a2f3a', small: true };
  if (ev.big) return { text: 'Big Play!', color: t.colors[0], sub: `+${ev.yards} yards` };
  if ((ev.type === 'run' || ev.type === 'pass' || ev.type === 'scramble') && ev.yards >= ev.togo) return { text: 'First Down', color: '#c99a00', small: true };
  return null;
}
