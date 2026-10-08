// Broadcast camera. The field is rendered through a real perspective projection
// from a high sideline camera that follows the ball, frames the play the way TV
// does (tight on runs, wider on deep balls and kicks), and lets things stand up
// out of the turf: players, goalposts, a ball arcing at its true height.
// Players are small upright athletes in their real uniforms (home dark, road
// white) with their real numbers; the carrier and target get name tags.
import { useEffect, useMemo, useRef, useState } from 'react';
import type { PlayEvent } from '../sim/game';
import type { Team } from '../core/types';
import { UNIFORM } from './components';
import { buildScene, lineupFor, type Scene } from './field/scene';
import { drawBody, type Act, type Build, type Kit } from './field/athlete';
import { warmSkins } from './skin';
import { app } from './store';
import { FORMATION, OL_SPOTS, type Art } from './playart';

const MID = 26.65, FIELD_W = 53.3;

// ---- camera ----------------------------------------------------------------------------------
interface Cam { x: number; y: number; span: number }
interface View { W: number; H: number; P: (x: number, y: number, z?: number) => [number, number, number]; x0: number; x1: number }
const PITCH = 0.36; // ~21 degrees down: the high 50-yard-line camera on a long lens
function view(W: number, H: number, c: Cam): View {
  const dist = c.span * 2.1;
  const cp = Math.cos(PITCH), sp = Math.sin(PITCH);
  const Cx = c.x, Cy = c.y + dist * cp, Cz = dist * sp;
  const F = (W * dist) / c.span;
  const cy0 = H * 0.6;
  // Basis: right = +x, forward = (0, -cos, -sin), up = (0, -sin, cos).
  const P = (x: number, y: number, z = 0): [number, number, number] => {
    const vx = x - Cx, vy = y - Cy, vz = z - Cz;
    const zc = -vy * cp - vz * sp;
    const yc = -vy * sp + vz * cp;
    const k = F / Math.max(0.5, zc);
    return [W / 2 + vx * k, cy0 - yc * k, k];
  };
  return { W, H, P, x0: c.x - c.span * 1.1, x1: c.x + c.span * 1.1 };
}

// ---- uniforms ----------------------------------------------------------------------------------
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

// ---- component -------------------------------------------------------------------------------
export function FieldView({ ev: evIn, home, away, logo, playing: playIn, onDone }: { ev: PlayEvent | null; home: Team; away: Team; logo?: string; playing: boolean; onDone?: () => void }) {
  // Between snaps (timeouts, penalties) hold the last picture instead of an empty field.
  const lastEv = useRef<PlayEvent | null>(null);
  if (evIn) lastEv.current = evIn;
  const ev = evIn ?? lastEv.current;
  const playing = playIn && !!evIn;
  useEffect(() => { if (playIn && !evIn) onDone?.(); }, [playIn, evIn]);
  const wrap = useRef<HTMLDivElement>(null);
  const cv = useRef<HTMLCanvasElement>(null);
  const img = useRef<HTMLImageElement | null>(null);
  const cam = useRef<Cam>({ x: 60, y: 30, span: 46 });
  const size = useRef({ w: 1200, h: 620 });
  const [banner, setBanner] = useState<{ n: number; text: string; color: string; sub?: string } | null>(null);
  const kits = useMemo(() => [kitFor(away, false), kitFor(home, true)] as const, [home.abbr, away.abbr]);
  const lineups = useMemo(() => [lineupFor(away), lineupFor(home)] as [ReturnType<typeof lineupFor>, ReturnType<typeof lineupFor>], [home.abbr, away.abbr, ev?.n]);
  useEffect(() => { const L = app.league; if (L) warmSkins(Object.values(L.players).filter(p => p.team === home.abbr || p.team === away.abbr)); }, [home.abbr, away.abbr]);
  useEffect(() => { if (!logo) return; const i = new Image(); i.crossOrigin = 'anonymous'; i.src = logo; i.onload = () => (img.current = i); }, [logo]);
  useEffect(() => {
    const el = wrap.current!, c = cv.current!;
    const fit = () => { const w = el.clientWidth, h = Math.round(Math.min(w * 0.54, window.innerHeight * 0.72)); const d = Math.min(2, window.devicePixelRatio || 1); c.width = w * d; c.height = h * d; c.style.height = `${h}px`; size.current = { w, h }; };
    fit(); const ro = new ResizeObserver(fit); ro.observe(el); return () => ro.disconnect();
  }, []);
  useEffect(() => {
    const c = cv.current!, ctx = c.getContext('2d')!;
    let raf = 0, last = performance.now();
    const scene = ev ? buildScene(ev, lineups) : null;
    const dur = scene?.dur ?? 1;
    if (playing) setBanner(null);
    let ended = false, t = playing && scene ? 0 : 1, shake = 0, hit = false;
    // Slow motion around the moment that matters on a big play: the catch, the hit, the score.
    const big = !!ev && (ev.big || ev.td || ev.turnover || ev.type === 'sack' || (ev.type === 'fg' && ev.yl < 50));
    const key = scene && ev ? (ev.type === 'sack' || ev.turnover && ev.type !== 'pass' ? scene.tackle ?? scene.endAt : ev.type === 'pass' ? scene.catchAt : ev.td ? scene.endAt : ev.type === 'fg' ? 0.8 : scene.tackle) : undefined;
    const rate = (u: number) => (big && key !== undefined ? 1 - 0.68 * Math.exp(-((((u - key) * dur) / 0.32) ** 2)) : 1);
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (playing && scene && t < 1) t = Math.min(1, t + (dt * rate(t)) / dur);
      if (scene?.tackle !== undefined && !hit && t >= scene.tackle) { hit = true; shake = big ? 1 : 0.45; }
      shake *= Math.exp(-dt * 7);
      const d = c.width / size.current.w;
      ctx.setTransform(d, 0, 0, d, 0, 0);
      const { w: W, h: H } = size.current;
      // Where the camera wants to be.
      const goal = aim(scene, t, playing);
      if (big && key !== undefined && playing) goal.span *= 1 - 0.22 * Math.exp(-((((t - key) * dur) / 0.5) ** 2));
      const cm = cam.current, k = 1 - Math.exp(-dt * (t < 1 && playing ? 3.2 : 2.2));
      cm.x += (goal.x - cm.x) * k; cm.y += (goal.y - cm.y) * k; cm.span += (goal.span - cm.span) * k;
      const v = view(W, H, { x: cm.x + Math.sin(now / 23) * shake * 0.35, y: cm.y + Math.cos(now / 19) * shake * 0.25, span: cm.span });
      drawStadium(ctx, v, home, away, img.current, now);
      if (scene) drawPlay(ctx, v, scene, t, kits, now, rate(t) < 0.6);
      const settled = Math.abs(goal.x - cm.x) < 0.05 && Math.abs(goal.span - cm.span) < 0.05 && Math.abs(goal.y - cm.y) < 0.05;
      if (playing && t >= 1 && !ended) {
        ended = true;
        if (ev) { const b = bannerFor(ev, home, away); if (b) setBanner({ n: ev.n, ...b }); }
        onDone?.();
      }
      if ((playing && t < 1) || !settled || shake > 0.02 || (scene?.td && t >= 1 && now - last < 1e9 && celebrating(now))) raf = requestAnimationFrame(frame);
    };
    let partyUntil = 0;
    const celebrating = (now: number) => { if (!partyUntil) partyUntil = now + 2600; return now < partyUntil; };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [ev?.n, playing]);
  return (
    <div ref={wrap} className="bcast">
      <canvas ref={cv} style={{ width: '100%', display: 'block' }} />
      {ev && <div className="bc-dd"><b>{ev.type === 'kickoff' ? 'Kickoff' : ev.type === 'punt' ? 'Punt' : ev.type === 'fg' ? 'Field Goal' : ev.type === 'xp' ? 'Extra Point' : `${['1st', '2nd', '3rd', '4th'][ev.down - 1] ?? ''} & ${ev.yl + ev.togo >= 100 ? 'Goal' : ev.togo}`}</b>{ev.call && <span>{ev.call}</span>}{ev.dcall && <em>vs {ev.dcall}</em>}</div>}
      {banner && <div key={banner.n} className="fbanner" style={{ '--bc': banner.color } as React.CSSProperties}><span>{banner.text}</span>{banner.sub && <small>{banner.sub}</small>}</div>}
    </div>
  );
}

/** TV framing: behind the offense pre-snap, on the ball during the play, wider for kicks and deep shots. */
function aim(sc: Scene | null, t: number, playing: boolean): Cam {
  if (!sc) return { x: 60, y: 30, span: 52 };
  const s = sc.dirSign;
  if (playing && t < sc.pre + 0.02 && !sc.kick) return { x: sc.los - s * 2, y: 29, span: 34 };
  const [bx, by] = sc.ball(Math.min(1, t));
  const [ax] = sc.ball(Math.min(1, t + 0.04));
  const h = sc.ballH(Math.min(1, t));
  const lead = (ax - bx) * 6;
  const span = sc.kick ? (h > 6 ? 54 : 38) : h > 3 ? Math.min(50, 34 + h * 1.3) : t >= 1 ? 27 : 31;
  return { x: Math.max(8, Math.min(112, bx + lead)), y: Math.max(16, Math.min(38, by * 0.65 + MID * 0.35)), span };
}

// ---- the stadium -----------------------------------------------------------------------------
let grain: CanvasPattern | null = null;
function grainPattern(ctx: CanvasRenderingContext2D) {
  if (grain) return grain;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d')!, d = g.createImageData(128, 128);
  for (let i = 0; i < d.data.length; i += 4) { const n = Math.random(); d.data[i] = 255; d.data[i + 1] = 255; d.data[i + 2] = 255; d.data[i + 3] = n > 0.5 ? n * 18 : 0; }
  g.putImageData(d, 0, 0);
  return (grain = ctx.createPattern(c, 'repeat'));
}
let crowd: CanvasPattern | null = null;
function crowdPattern(ctx: CanvasRenderingContext2D, home: Team) {
  if (crowd) return crowd;
  const c = document.createElement('canvas'); c.width = 96; c.height = 48;
  const g = c.getContext('2d')!;
  g.fillStyle = '#10141c'; g.fillRect(0, 0, 96, 48);
  const cols = [home.colors[0], home.colors[1] ?? '#fff', '#2a2f3a', '#d9d2c5', '#6b6f7a', home.colors[0]];
  for (let i = 0; i < 300; i++) { g.fillStyle = cols[i % cols.length]; g.globalAlpha = 0.35 + Math.random() * 0.4; g.beginPath(); g.arc(Math.random() * 96, Math.random() * 48, 1.1 + Math.random() * 0.8, 0, 7); g.fill(); }
  return (crowd = ctx.createPattern(c, 'repeat'));
}
function poly(ctx: CanvasRenderingContext2D, v: View, pts: [number, number, number?][]) {
  ctx.beginPath();
  pts.forEach(([x, y, z], i) => { const [sx, sy] = v.P(x, y, z ?? 0); i ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy); });
  ctx.closePath();
}
/** Canvas transform that lays a flat drawing on the turf at (x, y), 1 unit = `u` yards. */
function onGround(ctx: CanvasRenderingContext2D, v: View, d: number, x: number, y: number, u: number, rot = 0) {
  const [ox, oy] = v.P(x, y), [ax, ay] = v.P(x + Math.cos(rot) * u, y + Math.sin(rot) * u), [bx, by] = v.P(x - Math.sin(rot) * u, y + Math.cos(rot) * u);
  ctx.setTransform(d * (ax - ox), d * (ay - oy), d * (bx - ox), d * (by - oy), d * ox, d * oy);
}

function drawStadium(ctx: CanvasRenderingContext2D, v: View, home: Team, away: Team, logo: HTMLImageElement | null, now: number) {
  const { W, H } = v;
  const d = ctx.getTransform().a;
  // Sky / upper deck glow.
  const sky = ctx.createLinearGradient(0, 0, 0, H * 0.5);
  sky.addColorStop(0, '#05070c'); sky.addColorStop(1, '#141b28');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
  // Stands rising behind the far sideline.
  const x0 = v.x0 - 30, x1 = v.x1 + 30;
  ctx.fillStyle = crowdPattern(ctx, home)!;
  poly(ctx, v, [[x0, -9, 1.3], [x1, -9, 1.3], [x1, -60, 45], [x0, -60, 45]]); ctx.fill();
  const shade = ctx.createLinearGradient(0, v.P(0, -60, 45)[1], 0, v.P(0, -9, 1.3)[1]);
  shade.addColorStop(0, 'rgba(5,7,12,.85)'); shade.addColorStop(1, 'rgba(5,7,12,.15)');
  ctx.fillStyle = shade; ctx.fill();
  // Camera flashes in the crowd.
  for (let i = 0; i < 6; i++) { const ph = (now / 1000 + i * 1.7) % 4.3; if (ph < 0.08) { const fx = x0 + ((i * 37.7 + Math.floor(now / 4300) * 13) % (x1 - x0)); const [sx, sy] = v.P(fx, -14 - (i % 4) * 5, 3 + (i % 4) * 4); ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.beginPath(); ctx.arc(sx, sy, 2.2, 0, 7); ctx.fill(); } }
  // LED ribbon board along the front of the stands.
  poly(ctx, v, [[x0, -9, 0], [x1, -9, 0], [x1, -9, 1.3], [x0, -9, 1.3]]);
  const led = ctx.createLinearGradient(v.P(x0, -9)[0], 0, v.P(x1, -9)[0], 0);
  const sh = ((now / 4000) % 1);
  led.addColorStop(0, home.colors[0]); led.addColorStop(Math.max(0, sh - 0.05), home.colors[0]); led.addColorStop(sh, '#ffffff'); led.addColorStop(Math.min(1, sh + 0.05), home.colors[0]); led.addColorStop(1, home.colors[0]);
  ctx.fillStyle = led; ctx.fill();
  // Apron and sideline area.
  ctx.fillStyle = '#1c4a29'; poly(ctx, v, [[x0, -9], [x1, -9], [x1, 64], [x0, 64]]); ctx.fill();
  // Turf: mowing stripes every 5 yards, end zones in team colour.
  for (let i = -2; i < 26; i++) {
    const a = i * 5, b = a + 5;
    if (b < v.x0 - 10 || a > v.x1 + 10) continue;
    ctx.fillStyle = i % 2 ? '#2f7f3c' : '#2a7336';
    poly(ctx, v, [[a, -3], [b, -3], [b, FIELD_W + 3], [a, FIELD_W + 3]]); ctx.fill();
  }
  for (const [ex, t] of [[0, away], [110, home]] as const) {
    ctx.fillStyle = t.colors[0]; poly(ctx, v, [[ex, 0], [ex + 10, 0], [ex + 10, FIELD_W], [ex, FIELD_W]]); ctx.fill();
  }
  // Grain and a pool of light in the middle of the frame.
  ctx.save(); poly(ctx, v, [[x0, -3], [x1, -3], [x1, FIELD_W + 3], [x0, FIELD_W + 3]]); ctx.clip();
  ctx.fillStyle = grainPattern(ctx)!; ctx.fillRect(0, 0, W, H);
  const pool = ctx.createRadialGradient(W / 2, H * 0.55, 40, W / 2, H * 0.55, W * 0.75);
  pool.addColorStop(0, 'rgba(255,255,235,.07)'); pool.addColorStop(1, 'rgba(0,0,0,.35)');
  ctx.fillStyle = pool; ctx.fillRect(0, 0, W, H); ctx.restore();
  // Bench areas and the coaches' box on the far side.
  for (const [bx0, t] of [[32, away], [66, home]] as const) {
    ctx.fillStyle = 'rgba(8,10,14,.75)'; poly(ctx, v, [[bx0, -8.5], [bx0 + 22, -8.5], [bx0 + 22, -5.5], [bx0, -5.5]]); ctx.fill();
    ctx.fillStyle = t.colors[0]; poly(ctx, v, [[bx0, -5.6], [bx0 + 22, -5.6], [bx0 + 22, -5.1], [bx0, -5.1]]); ctx.fill();
  }
  // Lines.
  const line = (xa: number, ya: number, xb: number, yb: number, wd: number) => { poly(ctx, v, [[xa - wd, ya], [xb + wd, ya], [xb + wd, yb], [xa - wd, yb]]); ctx.fill(); };
  ctx.fillStyle = 'rgba(255,255,255,.93)';
  line(-2, -2, 122, -1.9, 0); line(-2, FIELD_W + 1.9, 122, FIELD_W + 2, 0);
  poly(ctx, v, [[-2, -2], [0, -2], [0, FIELD_W + 2], [-2, FIELD_W + 2]]); ctx.fill();
  poly(ctx, v, [[120, -2], [122, -2], [122, FIELD_W + 2], [120, FIELD_W + 2]]); ctx.fill();
  for (let x = 10; x <= 110; x += 5) { if (x < v.x0 - 5 || x > v.x1 + 5) continue; line(x, 0, x, FIELD_W, x === 10 || x === 110 ? 0.17 : 0.1); }
  line(0, 0, 0, FIELD_W, 0.1); line(120, 0, 120, FIELD_W, 0.1);
  for (let x = 11; x < 110; x++) {
    if (x % 5 === 0 || x < v.x0 - 3 || x > v.x1 + 3) continue;
    for (const [ya, yb] of [[0.3, 1], [23.2, 23.9], [29.4, 30.1], [52.3, 53]] as const) line(x, ya, x, yb, 0.06);
  }
  for (const g of [12, 108]) line(g, MID - 0.5, g, MID + 0.5, 0.08);
  // Numbers (6 ft tall, tops 9 yards in from each sideline) and arrows.
  ctx.save();
  for (let x = 20; x <= 100; x += 10) {
    if (x < v.x0 - 6 || x > v.x1 + 6) continue;
    const n = x <= 60 ? x - 10 : 110 - x;
    for (const far of [false, true]) {
      const y = far ? 10 : FIELD_W - 10;
      onGround(ctx, v, d, x, y, 0.1, far ? Math.PI : 0);
      ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.font = '700 22px "Barlow Condensed", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(n).split('').join(' '), 0, 0);
      if (n !== 50) { const dir = (x < 60) !== far ? -1 : 1; ctx.beginPath(); ctx.moveTo(dir * 19, -4); ctx.lineTo(dir * 24, 0); ctx.lineTo(dir * 19, 4); ctx.fill(); }
    }
  }
  // End-zone wordmarks and the midfield logo.
  for (const [ex, t, rot] of [[5, away, -Math.PI / 2], [115, home, Math.PI / 2]] as const) {
    if (ex < v.x0 - 12 || ex > v.x1 + 12) continue;
    onGround(ctx, v, d, ex, MID, 0.1, rot);
    ctx.font = '900 italic 66px "Barlow Condensed", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.strokeText(t.nick.toUpperCase(), 0, 0);
    ctx.fillStyle = '#fff'; ctx.fillText(t.nick.toUpperCase(), 0, 0);
  }
  if (logo && v.x0 < 66 && v.x1 > 54) { onGround(ctx, v, d, 60, MID, 0.1); ctx.globalAlpha = 0.92; ctx.drawImage(logo, -50, -50, 100, 100); ctx.globalAlpha = 1; }
  ctx.restore();
  ctx.setTransform(d, 0, 0, d, 0, 0);
}

/** Goalposts standing at the end lines: gooseneck, crossbar 10 ft up, 18'6" wide, 30 ft uprights. */
function drawPosts(ctx: CanvasRenderingContext2D, v: View, ex: number) {
  const off = ex === 0 ? -1.2 : 1.2;
  const base = v.P(ex + off, MID, 0), top = v.P(ex + off, MID, 3.33), arm = v.P(ex, MID, 3.33);
  const pl = v.P(ex, MID - 3.08, 3.33), pr = v.P(ex, MID + 3.08, 3.33), ul = v.P(ex, MID - 3.08, 13.3), ur = v.P(ex, MID + 3.08, 13.3);
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = Math.max(1.5, base[2] * 0.22);
  const sb = v.P(ex + off + 4, MID + 3, 0); ctx.beginPath(); ctx.moveTo(base[0], base[1]); ctx.lineTo(sb[0], sb[1]); ctx.stroke();
  ctx.strokeStyle = '#ffd400';
  ctx.lineWidth = Math.max(2, base[2] * 0.2); ctx.beginPath(); ctx.moveTo(base[0], base[1]); ctx.lineTo(top[0], top[1]); ctx.lineTo(arm[0], arm[1]); ctx.stroke();
  ctx.lineWidth = Math.max(1.6, arm[2] * 0.13); ctx.beginPath(); ctx.moveTo(pl[0], pl[1]); ctx.lineTo(pr[0], pr[1]); ctx.moveTo(pl[0], pl[1]); ctx.lineTo(ul[0], ul[1]); ctx.moveTo(pr[0], pr[1]); ctx.lineTo(ur[0], ur[1]); ctx.stroke();
  ctx.fillStyle = '#ff6a00'; for (const u of [ul, ur]) ctx.fillRect(u[0] - 2, u[1] - 6, 4, 6);
}

// ---- the play ---------------------------------------------------------------------------------
function drawPlay(ctx: CanvasRenderingContext2D, v: View, sc: Scene, t: number, kits: readonly [Kit, Kit], now: number, slow: boolean) {
  const d = ctx.getTransform().a;
  if (!sc.kick) {
    // Line of scrimmage and the line to gain, painted on the turf.
    ctx.fillStyle = 'rgba(70,150,255,.85)'; poly(ctx, v, [[sc.los - 0.12, 0], [sc.los + 0.12, 0], [sc.los + 0.12, FIELD_W], [sc.los - 0.12, FIELD_W]]); ctx.fill();
    ctx.fillStyle = 'rgba(255,214,10,.95)'; poly(ctx, v, [[sc.first - 0.14, 0], [sc.first + 0.14, 0], [sc.first + 0.14, FIELD_W], [sc.first - 0.14, FIELD_W]]); ctx.fill();
  }
  drawPosts(ctx, v, 0); drawPosts(ctx, v, 120);
  if (t < sc.pre + 0.05 && (sc.art || sc.dart)) {
    ctx.globalAlpha = t < sc.pre ? 0.95 : Math.max(0, 1 - (t - sc.pre) / 0.05);
    drawArt(ctx, v, sc, sc.dart ?? [], true); drawArt(ctx, v, sc, sc.art ?? [], false);
    ctx.globalAlpha = 1;
  }
  const dt = 0.008;
  const pos = sc.actors.map(a => a.path(Math.max(0, t)));
  const prev = sc.actors.map(a => a.path(Math.max(0, t - dt)));
  const [bx, by] = sc.ball(t);
  const h = sc.ballH(t);
  // Who has the ball: fixed by the story for kicks, otherwise whoever holds it, decided
  // before the tackle so a tackler arriving on top of him never steals the tag.
  const holder = (u: number) => {
    const [x0, y0] = sc.ball(u); if (sc.ballH(u) >= 1.6 || (!sc.kick && u < sc.pre + 0.03)) return -1;
    let best = -1, bd = 1.8; sc.actors.forEach((a, i) => { const [x, y] = a.path(u); const dd = Math.hypot(x - x0, y - y0); if (dd < bd) { bd = dd; best = i; } }); return best;
  };
  const carrier = sc.tackle !== undefined && t >= sc.tackle ? holder(sc.tackle - 0.005) : holder(t);
  let tackler = -1;
  const down = sc.tackle !== undefined && carrier >= 0 ? Math.max(0, Math.min(1, (t - sc.tackle) / (1 - sc.tackle))) : 0;
  if (sc.tackle !== undefined && carrier >= 0 && t >= sc.tackle - 0.08) {
    let best = 1e9; const cp = sc.actors[carrier].path(sc.tackle);
    sc.actors.forEach((a, i) => { if (a.team !== sc.actors[carrier].team) { const [x, y] = a.path(sc.tackle!); const dd = Math.hypot(x - cp[0], y - cp[1]); if (dd < best) { best = dd; tackler = i; } } });
    if (tackler >= 0 && down > 0) pos[tackler] = [lerp(pos[tackler][0], pos[carrier][0] - Math.sign(pos[carrier][0] - pos[tackler][0] || 1) * 0.6, down), lerp(pos[tackler][1], pos[carrier][1] + 0.25, down)];
  }
  // Carrier spotlight on the turf.
  if (carrier >= 0 && t > 0.02) {
    ctx.save(); onGround(ctx, v, d, pos[carrier][0], pos[carrier][1], 0.1);
    const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 14); g.addColorStop(0, 'rgba(255,214,10,.0)'); g.addColorStop(0.7, 'rgba(255,214,10,.3)'); g.addColorStop(1, 'rgba(255,214,10,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 14, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(255,214,10,.95)'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(0, 0, 9, 0, 7); ctx.stroke();
    ctx.restore(); ctx.setTransform(d, 0, 0, d, 0, 0);
  }
  { const [sx, sy, k] = v.P(bx, by, 0); if (h >= 1.6 || carrier < 0) { ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(sx, sy, k * 0.35, k * 0.14, 0, 0, 7); ctx.fill(); } }
  const order = sc.actors.map((_, i) => i).sort((i, j) => pos[i][1] - pos[j][1]);
  const secs = t * sc.dur;
  const s = sc.dirSign;
  const after = sc.endAt !== undefined && t > sc.endAt;
  const party = sc.td && after;
  const scorer = party ? holder(sc.endAt! - 0.005) : -1;
  for (const i of order) {
    const a = sc.actors[i];
    const vx = (pos[i][0] - prev[i][0]) / (dt * sc.dur), vy = (pos[i][1] - prev[i][1]) / (dt * sc.dur);
    const speed = Math.hypot(vx, vy);
    const isOff = a.team === sc.off;
    const big = /^(OL|DL|FG|FB|RU)/.test(a.slot);
    const build: Build = big ? 'big' : /^(LB|TE|RB|QB|ST|BL)/.test(a.slot) ? 'mid' : 'lean';
    let facing = Math.abs(vx) > 0.35 ? Math.sign(vx) : a.facing;
    let act: Act = speed > 0.6 ? { k: 'run', speed, secs: secs + i * 0.37 } : { k: 'stand', secs: secs + i };
    const opp = (): number => { let b = 9; sc.actors.forEach((o, j) => { if (o.team !== a.team) b = Math.min(b, Math.hypot(pos[j][0] - pos[i][0], pos[j][1] - pos[i][1])); }); return b; };
    if (!sc.kick && t < sc.pre + 0.01) {
      act = a.slot.startsWith('OL') || a.slot.startsWith('DL') ? { k: 'three' } : a.slot === 'QB' ? { k: 'gun' } : isOff ? { k: 'two', hands: a.slot === 'RB' } : { k: 'two' };
      facing = isOff ? s : -s;
    } else if (i === carrier && down > 0) act = { k: 'down', p: down };
    else if (i === tackler && down > 0) act = { k: 'dive', p: down };
    else if (sc.kicker === i && sc.kickAt !== undefined && Math.abs(t - sc.kickAt) * sc.dur < 0.35) act = { k: 'kick', p: Math.max(0, Math.min(1, 0.5 + ((t - sc.kickAt) * sc.dur) / 0.5)) };
    else if (sc.qb === i && sc.throwAt !== undefined && (t - sc.throwAt) * sc.dur > -0.42 && (t - sc.throwAt) * sc.dur < 0.25) { act = { k: 'throw', p: Math.max(0, Math.min(1, ((t - sc.throwAt) * sc.dur + 0.42) / 0.62)) }; facing = s; }
    else if (sc.target === i && sc.catchAt !== undefined && (t - sc.catchAt) * sc.dur > -0.35 && (t - sc.catchAt) * sc.dur < 0.12) act = { k: 'catch', p: Math.max(0, Math.min(1, ((t - sc.catchAt) * sc.dur + 0.35) / 0.47)), high: h > 2.4 };
    else if (party && (i === scorer || (isOff && Math.hypot(pos[i][0] - pos[Math.max(0, scorer)][0], pos[i][1] - pos[Math.max(0, scorer)][1]) < 7))) act = { k: 'party', secs: now / 1000 + i * 0.13 };
    else if (i === carrier && speed > 0.6) act = { k: 'carry', speed, secs: secs + i * 0.37 };
    else if (!sc.kick && !after && big && opp() < 1.5) { act = { k: 'block', secs: secs + i * 0.2 }; facing = isOff ? s : -s; }
    else if (!sc.kick && !after && !isOff && !big && speed > 0.5 && Math.sign(vx) === s && (sc.throwAt === undefined || t < sc.throwAt)) { act = { k: 'back', speed, secs }; facing = -s; }
    drawPlayer(ctx, v, pos[i][0], pos[i][1], kits[a.team], a.num, facing, act, build, a.skin ?? SKIN[(a.id ? hashStr(a.id) : a.num) % SKIN.length], i === carrier);
  }
  // Ball in the air, spinning, at its real height.
  if (!(carrier >= 0 && h < 1.6)) {
    const [sx, sy, k] = v.P(bx, by, h);
    ctx.save(); ctx.translate(sx, sy); ctx.rotate((s > 0 ? -0.35 : 0.35) + (h > 2 ? Math.sin(now / 40) * 0.05 : 0));
    const r = Math.max(3, k * 0.17);
    const g = ctx.createLinearGradient(0, -r, 0, r); g.addColorStop(0, '#b0612d'); g.addColorStop(1, '#5a280b');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, r * 1.6, r, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = Math.max(0.8, r * 0.18); ctx.beginPath(); ctx.moveTo(-r * 0.6, -r * 0.1); ctx.lineTo(r * 0.6, -r * 0.1); ctx.stroke();
    ctx.restore();
    if (h > 3) {
      ctx.strokeStyle = slow ? 'rgba(255,230,150,.45)' : 'rgba(255,255,255,.2)'; ctx.lineWidth = slow ? 3 : 2; ctx.beginPath();
      for (let q = 0; q < (slow ? 18 : 8); q++) { const tt = Math.max(0, t - q * 0.006); const [tx, ty] = sc.ball(tt); const [px, py] = v.P(tx, ty, sc.ballH(tt)); q ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
      ctx.stroke();
    }
  }
  // Name tag on the ball carrier (or the receiver the ball is heading for).
  const tagged = carrier >= 0 ? carrier : sc.target !== undefined && sc.throwAt !== undefined && t > sc.throwAt ? sc.target : -1;
  if (tagged >= 0 && (sc.kick || t > sc.pre)) {
    const a = sc.actors[tagged];
    const [sx, sy, k] = v.P(pos[tagged][0], pos[tagged][1], 2.6 - down * 1.4);
    nameTag(ctx, sx, sy, `${a.num}`, a.ln || a.role, kits[a.team], k);
  }
  // Slow-motion letterbox.
  if (slow) { ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(0, 0, v.W, v.H * 0.06); ctx.fillRect(0, v.H * 0.94, v.W, v.H * 0.06); }
}
function drawPlayer(ctx: CanvasRenderingContext2D, v: View, x: number, y: number, kit: Kit, num: number, facing: number, act: Act, build: Build, skin: string, carrying: boolean) {
  const [fx, fy, k] = v.P(x, y, 0);
  if (fx < -80 || fx > v.W + 80) return;
  const [, hy] = v.P(x, y, 2);
  const sv = ((fy - hy) / 2) * 1.14, sh = k * 1.14;
  const fall = act.k === 'down' ? act.p : act.k === 'dive' ? act.p * 0.85 : 0;
  ctx.fillStyle = 'rgba(0,0,0,.36)'; ctx.beginPath(); ctx.ellipse(fx + sh * 0.12, fy, sh * (0.45 + fall * 0.5), sh * 0.14, 0, 0, 7); ctx.fill();
  ctx.save();
  ctx.translate(fx, fy);
  ctx.rotate(facing * fall * 1.4);
  ctx.scale(sh * facing, sv);
  drawBody(ctx, kit, num, carrying && act.k === 'down' ? { ...act } : act, build, skin, facing);
  ctx.restore();
}
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const hashStr = (s: string) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); };

function nameTag(ctx: CanvasRenderingContext2D, x: number, y: number, num: string, name: string, kit: Kit, k: number) {
  const s = Math.max(0.75, Math.min(1.25, k / 28));
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.font = '800 13px "Barlow Condensed", sans-serif';
  const label = name.toUpperCase(); const w = ctx.measureText(label).width + 34;
  ctx.fillStyle = 'rgba(8,10,14,.88)'; ctx.beginPath(); ctx.roundRect(-w / 2, -22, w, 19, 4); ctx.fill();
  ctx.fillStyle = kit.jersey === '#f3f3f1' ? kit.num : kit.jersey; ctx.beginPath(); ctx.roundRect(-w / 2, -22, 24, 19, [4, 0, 0, 4]); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.textBaseline = 'middle'; ctx.textAlign = 'center'; ctx.fillText(num, -w / 2 + 12, -12.5);
  ctx.textAlign = 'left'; ctx.fillText(label, -w / 2 + 29, -12.5);
  ctx.fillStyle = 'rgba(8,10,14,.88)'; ctx.beginPath(); ctx.moveTo(-5, -3); ctx.lineTo(5, -3); ctx.lineTo(0, 3); ctx.fill();
  ctx.restore();
}

function drawArt(ctx: CanvasRenderingContext2D, v: View, sc: Scene, art: Art[], def: boolean) {
  const s = sc.dirSign;
  const at = (dx: number, dy: number) => v.P(sc.los + s * dx, MID + s * dy, 0.05);
  let ol = 0;
  for (const a of art) {
    if (a.kind === 'zone') {
      const [cx, cy] = [sc.los + s * a.pts[0][0], MID + s * a.pts[0][1]], r = a.r ?? 5;
      ctx.fillStyle = a.pts[0][0] > 12 ? 'rgba(70,150,255,.22)' : 'rgba(255,210,63,.2)';
      ctx.strokeStyle = a.pts[0][0] > 12 ? 'rgba(120,190,255,.8)' : 'rgba(255,210,63,.8)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); for (let i = 0; i <= 24; i++) { const q = (i / 24) * Math.PI * 2; const [px, py] = v.P(cx + Math.cos(q) * r, cy + Math.sin(q) * r * 0.75); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } ctx.fill(); ctx.stroke();
      continue;
    }
    const start = def ? a.pts[0] : a.who === 'OL' ? OL_SPOTS[ol++ % 5] : FORMATION[a.who as keyof typeof FORMATION];
    const pts = def ? a.pts : [start, ...a.pts];
    ctx.strokeStyle = a.primary ? '#ffd23f' : a.kind === 'blitz' ? '#ff4d5e' : a.kind === 'man' ? 'rgba(255,255,255,.6)' : a.kind === 'block' ? 'rgba(255,255,255,.55)' : '#fff';
    ctx.lineWidth = a.primary ? 4 : 2.6; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.setLineDash(a.kind === 'man' ? [6, 6] : []);
    ctx.beginPath(); pts.forEach(([dx, dy], j) => { const [x, y] = at(dx, dy); j ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke(); ctx.setLineDash([]);
    const [ax, ay] = at(...pts[pts.length - 1]), [bx, by] = at(...pts[Math.max(0, pts.length - 2)]);
    const ang = Math.atan2(ay - by, ax - bx);
    ctx.fillStyle = ctx.strokeStyle as string;
    if (a.kind === 'block') { ctx.beginPath(); ctx.moveTo(ax + Math.cos(ang + Math.PI / 2) * 6, ay + Math.sin(ang + Math.PI / 2) * 6); ctx.lineTo(ax - Math.cos(ang + Math.PI / 2) * 6, ay - Math.sin(ang + Math.PI / 2) * 6); ctx.stroke(); }
    else { ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax - Math.cos(ang - 0.45) * 12, ay - Math.sin(ang - 0.45) * 12); ctx.lineTo(ax - Math.cos(ang + 0.45) * 12, ay - Math.sin(ang + 0.45) * 12); ctx.closePath(); ctx.fill(); }
  }
}

/** Broadcast graphic for the moments that deserve one. */
function bannerFor(ev: PlayEvent, home: Team, away: Team): { text: string; color: string; sub?: string } | null {
  const t = ev.poss === 1 ? home : away, o = ev.poss === 1 ? away : home;
  if (ev.td) return { text: 'Touchdown', color: (ev.type === 'punt' ? o : t).colors[0], sub: (ev.type === 'punt' ? o : t).name };
  if (ev.type === 'fg') return /NO GOOD/.test(ev.text) ? { text: 'No Good', color: '#7a1f2b' } : { text: "It's Good", color: t.colors[0], sub: `${ev.yl ? 100 - ev.yl + 17 : ''} yard field goal` };
  if (ev.turnover && ev.type === 'pass') return { text: 'Intercepted', color: o.colors[0], sub: o.name };
  if (ev.turnover && (ev.type === 'run' || ev.type === 'scramble' || ev.type === 'sack')) return { text: 'Fumble', color: o.colors[0], sub: `${o.nick} ball` };
  if (/BLOCKED/.test(ev.text)) return { text: 'Blocked', color: o.colors[0] };
  if (ev.type === 'sack') return { text: 'Sack', color: o.colors[0], sub: `Loss of ${Math.abs(ev.yards)}` };
  if (ev.big) return { text: 'Big Play', color: t.colors[0], sub: `+${ev.yards} yards` };
  return null;
}
