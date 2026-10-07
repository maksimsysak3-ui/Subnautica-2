// Broadcast-angle field. A top-down canvas (2x resolution) tilted in CSS 3D; the
// goalposts are real DOM elements standing up out of the tilted plane. Each play
// is animated from the simulator's own result, with the called play's art drawn
// over the formation before the snap.
import { useEffect, useRef } from 'react';
import type { PlayEvent } from '../sim/game';
import type { Team } from '../core/types';
import { PLAY_ART, DEF_ART, FORMATION, OL_SPOTS, type Art } from './playart';

const PX = 10, OX = 5, OY = 7;            // px per yard; margins (yards) for sidelines
const FW = 120 + OX * 2, FH = 53.3 + OY * 2; // full canvas in yards
const W = FW * PX, H = FH * PX, DPR = 2;
const X = (yd: number) => (yd + OX) * PX, Y = (yd: number) => (yd + OY) * PX;

interface Actor { team: 0 | 1; num: number; role: string; path: Path; facing: number }
type Path = (t: number) => [number, number];

let turf: HTMLCanvasElement | null = null;
function turfTexture() {
  if (turf) return turf;
  turf = document.createElement('canvas');
  turf.width = 256; turf.height = 256;
  const c = turf.getContext('2d')!;
  const img = c.createImageData(256, 256);
  for (let i = 0; i < img.data.length; i += 4) { const n = Math.random() * 38; img.data[i] = 20 + n * 0.3; img.data[i + 1] = 60 + n; img.data[i + 2] = 24 + n * 0.3; img.data[i + 3] = 40; }
  c.putImageData(img, 0, 0);
  return turf;
}

export function FieldView({ ev, home, away, logo, playing, onDone }: { ev: PlayEvent | null; home: Team; away: Team; logo?: string; playing: boolean; onDone?: () => void }) {
  const cv = useRef<HTMLCanvasElement>(null);
  const img = useRef<HTMLImageElement | null>(null);
  useEffect(() => { if (!logo) return; const i = new Image(); i.crossOrigin = 'anonymous'; i.src = logo; i.onload = () => (img.current = i); }, [logo]);
  useEffect(() => {
    const ctx = cv.current!.getContext('2d')!;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    let raf = 0;
    const start = performance.now();
    const scene = ev ? buildScene(ev) : null;
    const dur = scene?.dur ?? 1;
    const draw = (now: number) => {
      const t = playing && scene ? Math.min(1, (now - start) / (dur * 1000)) : 1;
      drawField(ctx, home, away, img.current);
      if (scene) drawScene(ctx, scene, t, home, away);
      if (playing && t < 1) raf = requestAnimationFrame(draw); else if (playing && onDone) onDone();
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [ev?.n, playing]);
  const post = (side: 0 | 1, t: Team) => (
    <div style={{ position: 'absolute', left: `${((side ? 120 + OX + 0.2 : OX - 0.2) / FW) * 100}%`, top: '50%', width: 0, height: 0, transformStyle: 'preserve-3d' }}>
      {/* Stands out of the tilted field toward the camera: base, post, crossbar, uprights. */}
      <div style={{ position: 'absolute', left: -3, top: 0, width: 6, height: 92, background: 'linear-gradient(90deg,#b89200,#ffe14d,#b89200)', transformOrigin: 'top center', transform: 'rotateX(90deg)' }}>
        <div style={{ position: 'absolute', top: 0, left: -3, width: 12, height: 22, background: t.colors[0], border: '1px solid rgba(255,255,255,.4)' }} />
        <div style={{ position: 'absolute', top: 86, left: -72, width: 150, height: 6, background: '#ffd700' }} />
        <div style={{ position: 'absolute', top: 86, left: -72, width: 6, height: 140, background: '#ffd700' }} />
        <div style={{ position: 'absolute', top: 86, left: 72, width: 6, height: 140, background: '#ffd700' }} />
      </div>
    </div>
  );
  return (
    <div style={{ perspective: 1200, perspectiveOrigin: '50% -25%', overflow: 'hidden', padding: '30px 0 6px', background: 'radial-gradient(ellipse at 50% 0%, #2a3346 0%, #0d1118 60%)', position: 'relative' }}>
      <Crowd />
      <div style={{ position: 'relative', transform: 'rotateX(40deg)', transformOrigin: '50% 100%', transformStyle: 'preserve-3d' }}>
        <canvas ref={cv} width={W * DPR} height={H * DPR} style={{ width: '100%', display: 'block', boxShadow: '0 50px 90px rgba(0,0,0,.7)' }} />
        {post(0, away)}{post(1, home)}
      </div>
    </div>
  );
}

/** Stands behind the far sideline: rows of fans as a soft dot field. */
function Crowd() {
  return <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: '38%', background: 'radial-gradient(circle at 20% 30%, rgba(255,255,255,.08) 1px, transparent 1.5px) 0 0/9px 7px, radial-gradient(circle at 70% 60%, rgba(255,200,120,.07) 1px, transparent 1.5px) 0 0/11px 8px, linear-gradient(180deg, #121722, #1c2433)', maskImage: 'linear-gradient(180deg, #000 40%, transparent)' }} />;
}

function drawField(ctx: CanvasRenderingContext2D, home: Team, away: Team, logo: HTMLImageElement | null) {
  // Surround and sidelines.
  ctx.fillStyle = '#1b4424'; ctx.fillRect(0, 0, W, H);
  // Field turf with mowing stripes and grain.
  for (let i = 0; i < 24; i++) { ctx.fillStyle = i % 2 ? '#2e7d3b' : '#297135'; ctx.fillRect(X(i * 5), Y(0), 5 * PX, 53.3 * PX); }
  const pat = ctx.createPattern(turfTexture(), 'repeat')!;
  ctx.fillStyle = pat; ctx.fillRect(0, 0, W, H);
  const vg = ctx.createRadialGradient(W / 2, H / 2, 80, W / 2, H / 2, W * 0.65);
  vg.addColorStop(0, 'rgba(255,255,240,.07)'); vg.addColorStop(1, 'rgba(0,0,0,.4)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  // Six-foot white border and the benches on the far sideline.
  ctx.fillStyle = '#f4f4f0';
  ctx.fillRect(X(-2), Y(-2), (124) * PX, 2 * PX); ctx.fillRect(X(-2), Y(53.3), 124 * PX, 2 * PX);
  ctx.fillRect(X(-2), Y(-2), 2 * PX, 57.3 * PX); ctx.fillRect(X(120), Y(-2), 2 * PX, 57.3 * PX);
  for (const [x0, t] of [[32, away], [66, home]] as const) {
    ctx.fillStyle = 'rgba(10,14,20,.85)'; ctx.fillRect(X(x0), Y(-6.3), 22 * PX, 3.2 * PX);
    ctx.fillStyle = t.colors[0]; ctx.fillRect(X(x0), Y(-3.4), 22 * PX, 0.5 * PX);
    for (let i = 0; i < 22; i++) { ctx.fillStyle = i % 3 ? t.colors[0] : '#e8e8e8'; ctx.beginPath(); ctx.arc(X(x0 + 0.5 + i), Y(-5.2 + (i % 2) * 1.2), 3.5, 0, Math.PI * 2); ctx.fill(); }
  }
  ctx.setLineDash([6, 6]); ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 2;
  ctx.strokeRect(X(30), Y(-6.6), 60 * PX, 4.2 * PX); ctx.setLineDash([]);
  // End zones: team colour, diagonal stripes, outlined name.
  for (const [x0, t, rot] of [[0, away, -1], [110, home, 1]] as const) {
    ctx.fillStyle = t.colors[0]; ctx.fillRect(X(x0), Y(0), 10 * PX, 53.3 * PX);
    ctx.save(); ctx.beginPath(); ctx.rect(X(x0), Y(0), 10 * PX, 53.3 * PX); ctx.clip();
    ctx.strokeStyle = 'rgba(255,255,255,.08)'; ctx.lineWidth = 10;
    for (let k = -60; k < 60; k += 3) { ctx.beginPath(); ctx.moveTo(X(x0 + k), Y(0)); ctx.lineTo(X(x0 + k + 53), Y(53.3)); ctx.stroke(); }
    ctx.restore();
    ctx.save(); ctx.translate(X(x0 + 5), Y(26.65)); ctx.rotate((rot * Math.PI) / 2);
    ctx.font = '900 italic 78px "Barlow Condensed", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 8; ctx.strokeStyle = t.colors[1] === '#000000' ? '#000' : 'rgba(0,0,0,.55)'; ctx.strokeText(t.nick.toUpperCase(), 0, 0);
    ctx.fillStyle = '#fff'; ctx.fillText(t.nick.toUpperCase(), 0, 0); ctx.restore();
  }
  // Lines: goal lines heavier, every 5 yards, hashes and the 2-yard try line.
  ctx.strokeStyle = 'rgba(255,255,255,.95)';
  for (let y = 10; y <= 110; y += 5) { ctx.lineWidth = y === 10 || y === 110 ? 5 : y % 10 === 0 ? 3 : 2; ctx.beginPath(); ctx.moveTo(X(y), Y(0)); ctx.lineTo(X(y), Y(53.3)); ctx.stroke(); }
  ctx.lineWidth = 1.6;
  for (let y = 11; y < 110; y++) for (const hy of [0.8, 23.6, 29.7, 52.5]) { ctx.beginPath(); ctx.moveTo(X(y), Y(hy) - 4); ctx.lineTo(X(y), Y(hy) + 4); ctx.stroke(); }
  for (const g of [12, 108]) { ctx.beginPath(); ctx.moveTo(X(g), Y(26.15)); ctx.lineTo(X(g), Y(27.15)); ctx.lineWidth = 3; ctx.stroke(); }
  // Numbers with direction arrows, upright on the near side and flipped on the far.
  ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.font = '700 46px "Barlow Condensed", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (let y = 20; y <= 100; y += 10) {
    const n = y <= 60 ? y - 10 : 110 - y;
    for (const [yy, flip] of [[44.3, false], [9, true]] as const) {
      ctx.save(); ctx.translate(X(y), Y(yy)); if (flip) ctx.rotate(Math.PI);
      ctx.fillText(String(n), 0, 0);
      if (n !== 50) { const dir = (y < 60) !== flip ? -1 : 1; ctx.beginPath(); ctx.moveTo(dir * 38, -6); ctx.lineTo(dir * 46, 0); ctx.lineTo(dir * 38, 6); ctx.fill(); }
      ctx.restore();
    }
  }
  if (logo) { ctx.globalAlpha = 0.9; ctx.drawImage(logo, X(60) - 90, Y(26.65) - 90, 180, 180); ctx.globalAlpha = 1; }
}

interface Scene { dur: number; pre: number; los: number; first: number; actors: Actor[]; ball: Path; ballH: (t: number) => number; dirSign: number; art?: Art[]; dart?: Art[] }

function buildScene(ev: PlayEvent): Scene {
  const s = ev.poss === 1 ? 1 : -1;               // offence attacks right when home has the ball
  const toX = (yl: number) => (s > 0 ? 10 + yl : 110 - yl);
  const los = toX(ev.yl);
  const first = toX(Math.min(100, ev.yl + ev.togo));
  const mid = 26.65;
  const off = (ev.poss === 1 ? 1 : 0) as 0 | 1, def = (1 - off) as 0 | 1;
  const end = toX(Math.max(0, Math.min(100, ev.yl + ev.yards)));
  const kick = ['punt', 'fg', 'xp', 'kickoff'].includes(ev.type);
  const pre = kick ? 0 : 0.22;                     // pre-snap beat where the play art shows
  const T = (t: number) => (t - pre) / (1 - pre);  // play clock after the snap
  const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
  const ease = (k: number) => (k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k));
  const seg = (t: number, a: number, b: number) => ease((T(t) - a) / (b - a));
  const at = (dx: number, dy: number): [number, number] => [los + s * dx, mid + s * dy];
  const actors: Actor[] = [];
  const add = (team: 0 | 1, num: number, role: string, path: Path) => actors.push({ team, num, role, path, facing: team === off ? s : -s });
  if (kick) {
    const target = ev.type === 'kickoff' ? toX(ev.endYl) : ev.type === 'punt' ? toX(Math.min(100, ev.yl + ev.yards)) : (s > 0 ? 120 : 0);
    const from = ev.type === 'kickoff' ? (s > 0 ? 45 : 75) : los - s * (ev.type === 'punt' ? 14 : 7);
    add(off, 4, 'K', t => [from + s * seg(t, 0, 0.12) * 1.5, mid]);
    for (let i = 0; i < 10; i++) add(off, 40 + i, 'ST', t => [lerp(from + s * 1, from + s * 30, seg(t, 0.1, 0.9)), 4 + i * 5]);
    for (let i = 0; i < 6; i++) add(def, 20 + i, 'ST', t => [lerp(target - s * 12, target - s * 2, seg(t, 0.4, 1)), 10 + i * 6]);
    return { dur: 2.6, pre, los, first, actors, ball: t => [lerp(from, target, seg(t, 0.12, 0.85)), lerp(mid, mid, 0)], ballH: t => Math.sin(Math.PI * seg(t, 0.12, 0.85)) * (ev.type === 'fg' || ev.type === 'xp' ? 14 : 24), dirSign: s };
  }
  const art = PLAY_ART[ev.call ?? ''];
  const dart = DEF_ART[ev.dcall ?? ''];
  const pass = ev.type === 'pass' || ev.type === 'sack' || ev.type === 'scramble';
  const catchDx = Math.max(-3, ev.air ?? ev.yards);
  const targetWho = (ev.dir ?? 0) < 0 ? 'X' : (ev.dir ?? 0) > 0 ? 'Z' : 'S';
  // Offensive line and defensive front engage.
  OL_SPOTS.forEach(([dx, dy], i) => add(off, [72, 66, 55, 64, 78][i], 'OL', t => { const [x, y] = at(dx, dy); return [x + s * (ev.type === 'run' ? 1.4 : -1) * seg(t, 0.02, 0.3), y]; }));
  [-5, -1.7, 1.7, 5].forEach((dy, i) => add(def, [91, 97, 99, 94][i], 'DL', t => { const [x, y] = at(1, dy); return [x - s * (ev.type === 'sack' && i === 1 ? 6 : 1) * seg(t, 0.02, 0.4), y]; }));
  // QB.
  const qb0 = at(...FORMATION.QB);
  const qbPath: Path = t => ev.type === 'scramble' ? [lerp(qb0[0], end, seg(t, 0.35, 0.95)), lerp(qb0[1], mid + s * 7, seg(t, 0.3, 0.9))] : [qb0[0] - s * 2.5 * seg(t, 0.05, 0.3), qb0[1]];
  add(off, 9, 'QB', qbPath);
  // Receivers follow their drawn routes; the target breaks to the catch point.
  const routeOf = (who: 'X' | 'Z' | 'S' | 'TE'): [number, number][] => art?.find(a => a.who === who && a.kind === 'route')?.pts ?? [[10, FORMATION[who][1]]];
  const catchPt = at(catchDx, (FORMATION[targetWho][1]) * 0.7);
  (['X', 'Z', 'S', 'TE'] as const).forEach((who, i) => {
    const start = FORMATION[who];
    const pts = [start, ...routeOf(who)];
    const isTarget = pass && ev.type === 'pass' && who === targetWho;
    add(off, [11, 13, 17, 87][i], who, t => {
      if (isTarget) {
        if (T(t) < 0.6) { const k = seg(t, 0.03, 0.6); const [a, b] = at(...start); return [lerp(a, catchPt[0], k), lerp(b, catchPt[1], k)]; }
        return ev.complete ? [lerp(catchPt[0], end, seg(t, 0.6, 1)), lerp(catchPt[1], mid, seg(t, 0.6, 1) * 0.35)] : catchPt;
      }
      const k = seg(t, 0.03, 0.75) * (pts.length - 1);
      const j = Math.min(pts.length - 2, Math.floor(k)), f = k - j;
      return at(lerp(pts[j][0], pts[j + 1][0], f), lerp(pts[j][1], pts[j + 1][1], f));
    });
    // A defender shadows each receiver.
    add(def, [21, 24, 31, 42][i], 'DB', t => { const [x, y] = at(start[0] + 6, start[1]); const tgt = isTarget ? (ev.complete ? [end, mid] : catchPt) : at(10 + i * 2, start[1] * 0.9); return [lerp(x, tgt[0], seg(t, 0.1, 0.9)), lerp(y, tgt[1], seg(t, 0.15, 0.9))]; });
  });
  // Running back: run path from the art, or a check-down/block.
  const rbArt = art?.find(a => a.who === 'RB');
  const rb0 = at(...FORMATION.RB);
  const runPath: Path = t => {
    if (T(t) < 0.3) { const k = seg(t, 0.03, 0.3); const p1 = rbArt?.pts[0] ?? [-3, 0]; const [a, b] = at(p1[0], p1[1]); return [lerp(rb0[0], a, k), lerp(rb0[1], b, k)]; }
    const k = seg(t, 0.3, 1); const lateral = (rbArt?.pts[rbArt.pts.length - 1]?.[1] ?? 0) * 0.6 + (ev.dir ?? 0) * 3;
    return [lerp(los - s * 1, end, k), mid + s * lateral * Math.min(1, k * 1.5)];
  };
  add(off, 26, 'RB', ev.type === 'run' ? runPath : t => { const p = rbArt?.pts[rbArt.pts.length - 1] ?? [-3, -2]; const [a, b] = at(p[0], p[1]); return [lerp(rb0[0], a, seg(t, 0.05, 0.6)), lerp(rb0[1], b, seg(t, 0.05, 0.6))]; });
  // Linebackers flow to the ball.
  const ballEnd = ev.type === 'run' ? end : catchPt[0];
  [-4, 4].forEach((dy, i) => add(def, [54, 52][i], 'LB', t => { const [x, y] = at(5, dy); return [lerp(x, ballEnd, seg(t, 0.25, 1)), lerp(y, ev.type === 'run' ? mid : catchPt[1], seg(t, 0.35, 1) * 0.8)]; }));
  const ball: Path = t => {
    if (T(t) < 0) return at(0, 0);
    if (T(t) < 0.06) { const k = T(t) / 0.06; const [a, b] = at(0, 0); return [lerp(a, qb0[0], k), lerp(b, qb0[1], k)]; }
    if (ev.type === 'run') return runPath(t);
    if (ev.type === 'sack' || ev.type === 'scramble' || T(t) < 0.32) return qbPath(t);
    if (T(t) < 0.6) { const k = seg(t, 0.32, 0.6); const q = qbPath(t); return [lerp(q[0], catchPt[0], k), lerp(q[1], catchPt[1], k)]; }
    return ev.complete ? [lerp(catchPt[0], end, seg(t, 0.6, 1)), lerp(catchPt[1], mid, seg(t, 0.6, 1) * 0.35)] : [catchPt[0] + s * 2 * seg(t, 0.6, 1), catchPt[1]];
  };
  const ballH = (t: number) => (ev.type === 'pass' && T(t) >= 0.32 && T(t) < 0.6 ? Math.sin(Math.PI * seg(t, 0.32, 0.6)) * (3 + Math.abs(catchDx) * 0.2) : 1);
  return { dur: ev.type === 'pass' ? 3.6 : 3.0, pre, los, first, actors, ball, ballH, dirSign: s, art, dart };
}

function drawScene(ctx: CanvasRenderingContext2D, sc: Scene, t: number, home: Team, away: Team) {
  // Line of scrimmage (blue) and line to gain (yellow), broadcast style.
  ctx.fillStyle = 'rgba(60,140,255,.9)'; ctx.fillRect(X(sc.los) - 2.5, Y(0), 5, 53.3 * PX);
  ctx.fillStyle = 'rgba(255,214,10,.95)'; ctx.fillRect(X(sc.first) - 2.5, Y(0), 5, 53.3 * PX);
  // Play art before the snap, fading as the play starts.
  if (t < sc.pre + 0.05 && (sc.art || sc.dart)) {
    ctx.globalAlpha = t < sc.pre ? 1 : Math.max(0, 1 - (t - sc.pre) / 0.05);
    drawArt(ctx, sc, sc.dart ?? [], true);
    drawArt(ctx, sc, sc.art ?? [], false);
    ctx.globalAlpha = 1;
  }
  const team = (i: 0 | 1) => (i === 1 ? home : away);
  const pos = sc.actors.map(a => a.path(Math.max(0, t)));
  for (const [x, y] of pos) { ctx.fillStyle = 'rgba(0,0,0,.38)'; ctx.beginPath(); ctx.ellipse(X(x) + 6, Y(y) + 7, 15, 7, 0, 0, Math.PI * 2); ctx.fill(); }
  sc.actors.forEach((a, i) => drawPlayer(ctx, X(pos[i][0]), Y(pos[i][1]), team(a.team), a.num, a.facing));
  const [bx, by] = sc.ball(t);
  const h = sc.ballH(t);
  ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.beginPath(); ctx.ellipse(X(bx), Y(by), 7, 3.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.save(); ctx.translate(X(bx), Y(by) - h * 6 - 22); ctx.rotate(sc.dirSign > 0 ? -0.3 : 0.3);
  const g = ctx.createLinearGradient(0, -6, 0, 6); g.addColorStop(0, '#a5592a'); g.addColorStop(1, '#5c2a0c');
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, 10 + h * 0.15, 6, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(-3.5, -0.5); ctx.lineTo(3.5, -0.5); ctx.stroke();
  ctx.restore();
}

function drawArt(ctx: CanvasRenderingContext2D, sc: Scene, art: Art[], def: boolean) {
  const s = sc.dirSign;
  const at = (dx: number, dy: number) => [X(sc.los + s * dx), Y(26.65 + s * dy)];
  let ol = 0;
  for (const a of art) {
    if (a.kind === 'zone') {
      const [x, y] = at(a.pts[0][0], a.pts[0][1]);
      ctx.fillStyle = a.pts[0][0] > 12 ? 'rgba(70,150,255,.25)' : 'rgba(255,210,63,.22)';
      ctx.strokeStyle = a.pts[0][0] > 12 ? 'rgba(120,190,255,.8)' : 'rgba(255,210,63,.8)';
      ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(x, y, (a.r ?? 5) * PX, (a.r ?? 5) * PX * 0.7, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      continue;
    }
    const start = def ? a.pts[0] : a.who === 'OL' ? OL_SPOTS[ol++ % 5] : FORMATION[a.who as keyof typeof FORMATION];
    const pts = def ? a.pts : [start, ...a.pts];
    ctx.strokeStyle = a.primary ? '#ffd23f' : a.kind === 'blitz' ? '#ff4d5e' : a.kind === 'man' ? 'rgba(255,255,255,.65)' : a.kind === 'block' ? 'rgba(255,255,255,.6)' : '#fff';
    ctx.lineWidth = a.primary ? 5 : 3.5;
    ctx.setLineDash(a.kind === 'man' ? [8, 8] : []);
    ctx.beginPath();
    pts.forEach(([dx, dy], j) => { const [x, y] = at(dx, dy); j ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    ctx.stroke(); ctx.setLineDash([]);
    // Arrowhead, or a blocking T.
    const [ax, ay] = at(...pts[pts.length - 1]), [bx, by] = at(...pts[Math.max(0, pts.length - 2)]);
    const ang = Math.atan2(ay - by, ax - bx);
    ctx.fillStyle = ctx.strokeStyle as string;
    if (a.kind === 'block') { ctx.beginPath(); ctx.moveTo(ax + Math.cos(ang + Math.PI / 2) * 8, ay + Math.sin(ang + Math.PI / 2) * 8); ctx.lineTo(ax - Math.cos(ang + Math.PI / 2) * 8, ay - Math.sin(ang + Math.PI / 2) * 8); ctx.stroke(); }
    else { ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax - Math.cos(ang - 0.45) * 16, ay - Math.sin(ang - 0.45) * 16); ctx.lineTo(ax - Math.cos(ang + 0.45) * 16, ay - Math.sin(ang + 0.45) * 16); ctx.closePath(); ctx.fill(); }
  }
}

/** A player from the broadcast camera: legs, jersey over pads, helmet with facemask and stripe. */
function drawPlayer(ctx: CanvasRenderingContext2D, px: number, py: number, t: Team, num: number, facing: number) {
  const body = t.colors[0], trim = t.colors[1] === t.colors[0] || t.colors[1] === '#000000' && luminance(body) < 50 ? '#e9e9e9' : t.colors[1];
  // Legs / pants.
  ctx.fillStyle = luminance(body) < 60 ? '#d8d8d8' : shade(body, -0.25);
  ctx.fillRect(px - 8, py - 6, 6, 12); ctx.fillRect(px + 2, py - 6, 6, 12);
  ctx.fillStyle = '#111'; ctx.fillRect(px - 8, py + 5, 6, 3); ctx.fillRect(px + 2, py + 5, 6, 3);
  // Jersey over shoulder pads.
  ctx.fillStyle = body; ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(px - 15, py - 22); ctx.lineTo(px + 15, py - 22); ctx.lineTo(px + 11, py - 2); ctx.lineTo(px - 11, py - 2); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = trim; ctx.fillRect(px - 15, py - 18, 4, 3); ctx.fillRect(px + 11, py - 18, 4, 3);
  ctx.fillStyle = trim; ctx.font = '800 13px "Barlow Condensed", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(String(num), px, py - 11);
  // Helmet.
  const hx = px + facing * 2, hy = py - 29;
  ctx.fillStyle = shade(body, 0.08); ctx.beginPath(); ctx.arc(hx, hy, 9, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = trim; ctx.fillRect(hx - 1.5, hy - 9, 3, 18);
  ctx.strokeStyle = '#ddd'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(hx + facing * 5, hy - 4); ctx.lineTo(hx + facing * 10, hy - 4); ctx.moveTo(hx + facing * 5, hy + 2); ctx.lineTo(hx + facing * 10, hy + 2); ctx.stroke();
}
function luminance(hex: string) { const n = parseInt(hex.slice(1), 16); return 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255); }
function shade(hex: string, k: number) {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.round(Math.max(0, Math.min(255, k < 0 ? c * (1 + k) : c + (255 - c) * k)));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}
