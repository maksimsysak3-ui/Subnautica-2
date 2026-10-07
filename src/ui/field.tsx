// Broadcast-angle field. The canvas is drawn top-down and tilted with a CSS 3D
// perspective, so the field recedes like a TV shot. Each play is animated from
// the simulator's own result: formation, snap, dropback, routes, the ball's arc
// (height shown by its shadow), run lanes, pursuit and the tackle.
import { useEffect, useRef } from 'react';
import type { PlayEvent } from '../sim/game';
import type { Team } from '../core/types';

const W = 1200, H = 534; // 120 x 53.3 yards at 10 px/yd
const yd = (x: number) => x * 10;

interface Actor { x: number; y: number; team: 0 | 1; num: number; role: string }
type Path = (t: number) => [number, number];

export function FieldView({ ev, home, away, logo, playing, onDone, ballOwnerHome }: { ev: PlayEvent | null; home: Team; away: Team; logo?: string; playing: boolean; onDone?: () => void; ballOwnerHome?: boolean }) {
  const cv = useRef<HTMLCanvasElement>(null);
  const img = useRef<HTMLImageElement | null>(null);
  useEffect(() => { if (!logo) return; const i = new Image(); i.crossOrigin = 'anonymous'; i.src = logo; i.onload = () => (img.current = i); }, [logo]);
  useEffect(() => {
    const c = cv.current!;
    const ctx = c.getContext('2d')!;
    let raf = 0;
    const start = performance.now();
    const scene = ev ? buildScene(ev, ballOwnerHome ?? ev.poss === 1) : null;
    const dur = scene?.dur ?? 1;
    const draw = (now: number) => {
      const t = playing && scene ? Math.min(1, (now - start) / (dur * 1000)) : 1;
      drawField(ctx, home, away, img.current);
      if (scene) drawScene(ctx, scene, t, home, away);
      if (playing && t < 1) raf = requestAnimationFrame(draw);
      else if (playing && onDone) onDone();
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [ev?.n, playing]);
  return (
    <div style={{ perspective: 1100, perspectiveOrigin: '50% -20%', padding: '0 0 10px', overflow: 'hidden', borderRadius: 16 }}>
      <canvas ref={cv} width={W} height={H} style={{ width: '100%', display: 'block', transform: 'rotateX(38deg) scale(1.02)', transformOrigin: '50% 100%', borderRadius: 10, boxShadow: '0 40px 80px rgba(0,0,0,.6)' }} />
    </div>
  );
}

function drawField(ctx: CanvasRenderingContext2D, home: Team, away: Team, logo: HTMLImageElement | null) {
  // Grass with mowing stripes.
  for (let i = 0; i < 24; i++) { ctx.fillStyle = i % 2 ? '#2f7a3a' : '#2a6f35'; ctx.fillRect(yd(i * 5), 0, yd(5), H); }
  const grad = ctx.createRadialGradient(W / 2, H / 2, 50, W / 2, H / 2, W * 0.7);
  grad.addColorStop(0, 'rgba(255,255,255,0.06)'); grad.addColorStop(1, 'rgba(0,0,0,0.35)');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
  // End zones in team colours.
  for (const [x, t] of [[0, away], [110, home]] as const) {
    ctx.fillStyle = t.colors[0]; ctx.globalAlpha = 0.9; ctx.fillRect(yd(x), 0, yd(10), H); ctx.globalAlpha = 1;
    ctx.save(); ctx.translate(yd(x + 5), H / 2); ctx.rotate(x === 0 ? -Math.PI / 2 : Math.PI / 2);
    ctx.fillStyle = t.colors[1] === '#000000' ? '#fff' : t.colors[1]; ctx.font = '800 64px "Barlow Condensed", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(t.nick.toUpperCase(), 0, 0); ctx.restore();
  }
  ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 3;
  ctx.strokeRect(1.5, 1.5, W - 3, H - 3);
  for (let y = 10; y <= 110; y += 5) { ctx.lineWidth = y % 10 === 0 ? 3 : 1.6; ctx.beginPath(); ctx.moveTo(yd(y), 0); ctx.lineTo(yd(y), H); ctx.stroke(); }
  // Hash marks.
  ctx.lineWidth = 1.5;
  for (let y = 11; y < 110; y++) for (const hy of [3, 22.6, 30.7, 50.3]) { ctx.beginPath(); ctx.moveTo(yd(y), yd(hy)); ctx.lineTo(yd(y), yd(hy) + 7); ctx.stroke(); }
  // Yard numbers.
  ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.font = '700 40px "Barlow Condensed", sans-serif'; ctx.textAlign = 'center';
  for (let y = 20; y <= 100; y += 10) { const n = y <= 60 ? y - 10 : 110 - y; ctx.fillText(String(n), yd(y), yd(12)); ctx.save(); ctx.translate(yd(y), yd(42)); ctx.rotate(Math.PI); ctx.fillText(String(n), 0, 0); ctx.restore(); }
  if (logo) { ctx.globalAlpha = 0.85; ctx.drawImage(logo, W / 2 - 70, H / 2 - 70, 140, 140); ctx.globalAlpha = 1; }
}

interface Scene { dur: number; los: number; first: number; actors: (Actor & { path: Path })[]; ball: Path; ballH: (t: number) => number; carrierFrom: number; text: string; dirSign: number; kick: boolean }

/** Turn a play result into a little choreography. `dir` +1 means the offence attacks right. */
function buildScene(ev: PlayEvent, offHome: boolean): Scene {
  const s = offHome ? 1 : -1;
  const toX = (yl: number) => (s > 0 ? 10 + yl : 110 - yl);
  const los = toX(ev.yl);
  const first = toX(Math.min(100, ev.yl + ev.togo));
  const mid = 26.65 + (ev.dir ?? 0) * 6;
  const off = (offHome ? 1 : 0) as 0 | 1, def = (1 - off) as 0 | 1;
  const end = toX(Math.max(0, Math.min(100, ev.yl + ev.yards)));
  const actors: Scene['actors'] = [];
  const add = (team: 0 | 1, num: number, role: string, x0: number, y0: number, path?: Path) => actors.push({ x: x0, y: y0, team, num, role, path: path ?? (() => [x0, y0]) });
  const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
  const ease = (k: number) => (k < 0 ? 0 : k > 1 ? 1 : k * k * (3 - 2 * k));
  const seg = (t: number, a: number, b: number) => ease((t - a) / (b - a));
  const kick = ['punt', 'fg', 'xp', 'kickoff'].includes(ev.type);
  // Offensive line and defensive front engage at the line.
  [-6, -3, 0, 3, 6].forEach((dy, i) => add(off, [72, 66, 55, 64, 78][i], 'OL', los - s * 1, mid + dy * 0.8, t => [los - s * (1 + seg(t, 0.05, 0.3) * (ev.type === 'run' ? -1 : 1.2)), mid + dy * 0.8]));
  [-5, -1.7, 1.7, 5].forEach((dy, i) => add(def, [91, 97, 99, 94][i], 'DL', los + s * 1, mid + dy, t => [los + s * (1 - seg(t, 0.05, 0.35) * (ev.type === 'sack' && i === 1 ? 6 : 0.8)), mid + dy * (1 - seg(t, 0.2, 0.6) * 0.3)]));
  const ballX = (k: number) => k;
  void ballX;
  if (kick) {
    const target = ev.type === 'kickoff' ? toX(ev.endYl) : ev.type === 'punt' ? toX(Math.min(100, ev.yl + ev.yards)) : (s > 0 ? 110 : 10);
    const from = ev.type === 'kickoff' ? (s > 0 ? 45 : 75) : los - s * (ev.type === 'punt' ? 13 : 7);
    add(off, 4, 'K', from, mid, t => [from + s * seg(t, 0, 0.12) * 1.5, mid]);
    return { dur: 2.4, los, first, actors, ball: t => [lerp(from, target, seg(t, 0.12, 0.85)), lerp(mid, 26.65, seg(t, 0.12, 0.85))], ballH: t => Math.sin(Math.PI * seg(t, 0.12, 0.85)) * (ev.type === 'fg' || ev.type === 'xp' ? 14 : 22), carrierFrom: 2, text: ev.text, dirSign: s, kick };
  }
  // Skill players.
  const qbX = los - s * 5;
  const pass = ev.type === 'pass' || ev.type === 'sack' || ev.type === 'scramble';
  const catchX = toX(Math.max(0, Math.min(100, ev.yl + (ev.air ?? ev.yards))));
  const catchY = 26.65 + (ev.dir ?? 0) * 15;
  const qbPath: Path = t => ev.type === 'sack' ? [lerp(qbX, qbX - s * 2, seg(t, 0.1, 0.4)) + s * 0 - s * Math.max(0, ev.yards) * 0, mid] : ev.type === 'scramble' ? [lerp(qbX, end, seg(t, 0.35, 0.95)), lerp(mid, mid + 8, seg(t, 0.3, 0.9))] : [lerp(qbX, qbX - s * 2.5, seg(t, 0.08, 0.3)), mid];
  add(off, 9, 'QB', qbX, mid, qbPath);
  const routes = [[4, 1], [49.3, 1], [14, 0.7]] as const;
  routes.forEach(([y0, k], i) => {
    const isTarget = pass && ev.type === 'pass' && i === ((ev.dir ?? 0) < 0 ? 0 : (ev.dir ?? 0) > 0 ? 1 : 2);
    add(off, [11, 13, 17][i], 'WR', los - s * 1, y0, t => isTarget
      ? (t < 0.62 ? [lerp(los, catchX, seg(t, 0.08, 0.62)), lerp(y0, catchY, seg(t, 0.3, 0.62))] : ev.complete ? [lerp(catchX, end, seg(t, 0.62, 1)), lerp(catchY, mid, seg(t, 0.62, 1) * 0.4)] : [catchX + s * 1, catchY])
      : [lerp(los, los + s * (8 + i * 4) * k, seg(t, 0.08, 0.7)), y0 + (i === 2 ? seg(t, 0.3, 0.7) * 6 : 0)]);
    add(def, [21, 24, 31][i], 'CB', los + s * 6, y0, t => isTarget ? [lerp(los + s * 6, ev.complete ? end : catchX, seg(t, 0.1, ev.complete ? 1 : 0.65)), lerp(y0, catchY + 1, seg(t, 0.2, 0.65))] : [lerp(los + s * 6, los + s * (10 + i * 3), seg(t, 0.1, 0.7)), y0]);
  });
  add(off, 87, 'TE', los - s * 1, mid + 8, t => [lerp(los, los + s * 6, seg(t, 0.1, 0.6)), mid + 8 + seg(t, 0.3, 0.6) * 5]);
  const rbStart = los - s * 7;
  const runPath: Path = t => [lerp(rbStart, los, seg(t, 0.1, 0.35)) + (t > 0.35 ? s * 0 : 0) + (t > 0.35 ? (end - los) * seg(t, 0.35, 1) : 0), lerp(mid, mid + (ev.dir ?? 0) * 9, seg(t, 0.2, 0.7))];
  add(off, 26, 'RB', rbStart, mid, ev.type === 'run' ? runPath : t => [lerp(rbStart, los - s * 2, seg(t, 0.1, 0.4)), mid - 3]);
  // Linebackers and safeties flow to the ball.
  const ballEnd = ev.type === 'run' ? end : catchX;
  [[mid - 4, 5], [mid + 4, 5], [18, 13], [35, 13]].forEach(([y0, dx], i) => add(def, [54, 52, 32, 29][i], i < 2 ? 'LB' : 'S', los + s * dx, y0, t => [lerp(los + s * dx, ballEnd + s * (i < 2 ? 0.5 : 1.5), seg(t, 0.25, 1) * (ev.yards > 12 || i < 2 ? 1 : 0.6)), lerp(y0, ev.type === 'run' ? mid + (ev.dir ?? 0) * 9 : catchY, seg(t, 0.35, 1) * 0.8)]));
  // The ball: snap to QB, then either a handoff or a throw.
  const ball: Path = t => {
    if (t < 0.08) return [lerp(los, qbX, t / 0.08), mid];
    if (ev.type === 'run') return runPath(t);
    if (ev.type === 'sack') return qbPath(t);
    if (ev.type === 'scramble') return qbPath(t);
    if (t < 0.32) return qbPath(t);
    if (t < 0.62) { const k = seg(t, 0.32, 0.62); return [lerp(qbX - s * 2.5, catchX, k), lerp(mid, catchY, k)]; }
    return ev.complete ? [lerp(catchX, end, seg(t, 0.62, 1)), lerp(catchY, mid, seg(t, 0.62, 1) * 0.4)] : [catchX + s * 2 * seg(t, 0.62, 1), catchY];
  };
  const ballH = (t: number) => (ev.type === 'pass' && t >= 0.32 && t < 0.62 ? Math.sin(Math.PI * seg(t, 0.32, 0.62)) * (3 + Math.abs(catchX - qbX) * 0.18) : 1);
  return { dur: ev.type === 'pass' ? 3.0 : 2.4, los, first, actors, ball, ballH, carrierFrom: 0.62, text: ev.text, dirSign: s, kick };
}

function drawScene(ctx: CanvasRenderingContext2D, sc: Scene, t: number, home: Team, away: Team) {
  // Line of scrimmage and line to gain.
  ctx.fillStyle = 'rgba(59,130,246,.85)'; ctx.fillRect(yd(sc.los) - 2, 0, 4, H);
  ctx.fillStyle = 'rgba(250,204,21,.9)'; ctx.fillRect(yd(sc.first) - 2, 0, 4, H);
  const team = (i: 0 | 1) => (i === 1 ? home : away);
  // Shadows first, then bodies, so overlapping players read cleanly.
  const pos = sc.actors.map(a => a.path(t));
  for (const [x, y] of pos) { ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(yd(x) + 5, yd(y) + 6, 13, 7, 0, 0, Math.PI * 2); ctx.fill(); }
  sc.actors.forEach((a, i) => {
    const [x, y] = pos[i];
    const tm = team(a.team);
    const px = yd(x), py = yd(y);
    // Body (jersey) with helmet on top: a figure seen from the broadcast angle.
    ctx.fillStyle = tm.colors[0];
    ctx.strokeStyle = tm.colors[1] === tm.colors[0] ? '#fff' : tm.colors[1];
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.roundRect(px - 11, py - 18, 22, 24, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = shade(tm.colors[0]); ctx.beginPath(); ctx.arc(px, py - 22, 8.5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(px - 6, py - 22); ctx.lineTo(px + 6, py - 22); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = '800 13px "Barlow Condensed", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(String(a.num), px, py - 6);
  });
  // Ball, with its shadow on the turf showing height.
  const [bx, by] = sc.ball(t);
  const h = sc.ballH(t);
  ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.beginPath(); ctx.ellipse(yd(bx), yd(by), 6, 3, 0, 0, Math.PI * 2); ctx.fill();
  ctx.save(); ctx.translate(yd(bx), yd(by) - h * 6 - 20); ctx.rotate(sc.dirSign > 0 ? -0.3 : 0.3);
  ctx.fillStyle = '#7a3e14'; ctx.beginPath(); ctx.ellipse(0, 0, 9 + h * 0.15, 5.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(-3, 0); ctx.lineTo(3, 0); ctx.stroke();
  ctx.restore();
}
function shade(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  const l = (r + g + b) / 3;
  return l < 60 ? `rgb(${Math.min(255, r + 70)},${Math.min(255, g + 70)},${Math.min(255, b + 70)})` : `rgb(${r * 0.75 | 0},${g * 0.75 | 0},${b * 0.75 | 0})`;
}
