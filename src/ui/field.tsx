// The live game, in pixel art, presented like a broadcast. The players are the hand-drawn
// pixel models (pixel.ts / tools/sprites.py); everything around them is directed:
//  - the walk-up: the offence breaks the huddle and jogs to the line, everyone sets;
//  - a camera that frames the formation tight, widens at the snap, rides the ball, and
//    pushes in on the hero after the whistle (letterboxed for touchdowns);
//  - the play itself from the simulation (scene.ts) with choreographed bodies
//    (choreo.ts): drops and throws, catches of every kind, jukes, spins, stiff-arms,
//    wrap-ups and big hits, falls, get-ups, pocket pushes and sacks;
//  - the after-play: first-down points, touchdown celebrations with the team mobbing the
//    scorer, officials' signals, the chain crew, an LED ribbon reacting, the crowd on its
//    feet, confetti and pyro;
//  - instant replays of the big moments in slow motion (skippable, or switch them off).
// The stadium (stadium.ts) is painted once per matchup; the camera can zoom smoothly.
import { useEffect, useMemo, useRef, useState } from 'react';
import type { PlayEvent, Weather } from '../sim/game';
import type { Team } from '../core/types';
import { UNIFORM } from './components';
import { buildScene, lineupFor, type Scene } from './field/scene';
import type { Kit } from './field/pixel';
import { renderRig, buildOf, gearFor, POSE, AX, AY } from './field/rig';
import { choreograph, MID, FW, type Choreo, type Pose } from './field/choreo';
import { makeWorld, paintStadium, drawCrowd, drawRibbon, drawPosts, wx, wy, type World } from './field/stadium';
import { FORMATION, OL_SPOTS, snapSpot, type Art } from './playart';
import { warmSkins } from './skin';
import { app } from './store';
import { sfx } from './sfx';
import './field.css';

const lum = (hex: string) => { const n = parseInt(hex.replace('#', '').slice(0, 6), 16); return 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255); };
export function kitFor(t: Team, home: boolean): Kit {
  const u = UNIFORM[t.abbr] ?? { body: t.colors[0], num: '#ffffff', trim: t.colors[1] ?? '#ffffff' };
  const helmet = t.abbr === 'DAL' ? '#a5acaf' : t.abbr === 'NO' ? '#d3bc8d' : t.abbr === 'PIT' || t.abbr === 'NE' || t.abbr === 'TEN' ? '#c0c4c8' : u.body === '#FFFFFF' ? t.colors[0] : u.body;
  const dark = lum(u.body) < 200 ? u.body : t.colors[0];
  const pants = lum(t.colors[1] ?? '#ccc') > 150 ? (t.colors[1] ?? '#dcdcdc') : '#dcdcdc';
  return home
    ? { jersey: u.body, num: u.num, trim: u.trim, pants, helmet, mask: '#9aa0a8', socks: dark }
    : { jersey: '#f3f3f1', num: dark, trim: u.trim === '#FFFFFF' ? dark : u.trim, pants: lum(pants) > 200 ? pants : '#ececec', helmet, mask: '#9aa0a8', socks: dark };
}
const SKIN = ['#e8c4a8', '#c99a76', '#a46e4c', '#7b4b31', '#5a3522'];
const hashStr = (s: string) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); };
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const REPLAY_KEY = 'gg-replays';
const VIEW_YARDS = 46;
let DPR = 1;
const replaysOn = () => { try { return localStorage.getItem(REPLAY_KEY) === '1'; } catch { return true; } };

/** A play the field can show: the real scene, or a stand-in for kneels, spikes and flags. */
type Special = 'penalty' | 'kneel' | 'spike' | null;
function stage(ev: PlayEvent, lineups: Parameters<typeof buildScene>[1]): { sc: Scene; ch: Choreo; special: Special } {
  const special: Special = ev.type === 'penalty' || ev.type === 'kneel' || ev.type === 'spike' ? ev.type : null;
  if (!special) { const sc = buildScene(ev, lineups); return { sc, ch: choreograph(sc, ev), special }; }
  // Everyone lines up; at the snap the quarterback kneels or spikes it, or a flag flies.
  const fake: PlayEvent = { ...ev, type: 'run', yards: 0, td: false, turnover: false, big: false, ids: { qb: ev.ids?.qb }, call: undefined, dcall: undefined };
  const sc = buildScene(fake, lineups);
  const base = choreograph(sc, fake), snap = sc.pre * sc.dur, D = snap + (special === 'penalty' ? 1.9 : 1.5);
  const qb = sc.qb ?? -1;
  const ch: Choreo = {
    ...base, DUR: D, POST: 0.6, replay: null, hero: -1, celebrate: 'none', first: false, label: undefined, fx: special === 'penalty' ? [{ at: snap + 0.2, kind: 'flag', x: sc.los + sc.dirSign * 2, y: MID - 4 }] : [],
    pose: (i, c) => {
      if (c <= snap) return base.pose(i, c);
      const p = base.pose(i, snap - 0.01), d = c - snap;
      if (i === qb && special === 'kneel') return { ...p, rig: d < 0.25 ? POSE.hold() : { ...POSE.kneel(), ball: 1 } };
      if (i === qb && special === 'spike') return { ...p, rig: d < 0.7 ? POSE.spike(d / 0.7) : POSE.stand() };
      return special === 'penalty' && d > 0.5 ? { ...p, rig: POSE.stand(Math.sin(c * 2 + i)) } : p;
    },
    refs: c => base.refs(Math.min(c, snap)),
    ball: c => {
      if (c <= snap) return base.ball(c);
      const q = qb >= 0 ? base.pose(qb, snap - 0.01) : null, d = c - snap;
      if (special === 'spike' && q && d > 0.45) { const k = d - 0.45; return { x: q.x + sc.dirSign * (0.6 + k), y: q.y, h: 0.15 + Math.abs(Math.sin(k * 6)) * 1.4 * Math.exp(-k * 2.5), free: true, kick: false }; }
      return q ? { x: q.x, y: q.y, h: 1, free: false, kick: false } : null;
    },
    focus: () => [sc.los, MID],
  };
  return { sc, ch, special };
}

interface Particle { x: number; y: number; z: number; vx: number; vy: number; vz: number; c: string; life: number; t0: number; size: number }
type Banner = { n: number; text: string; color: string; sub?: string; small?: boolean; kind?: string };

export function FieldView({ ev: evIn, home, away, logo, playing: playIn, onDone, weather, night, college, pulse }: { pulse?: number; ev: PlayEvent | null; home: Team; away: Team; logo?: string; playing: boolean; onDone?: () => void; weather?: Weather; night?: boolean; college?: boolean }) {
  const lastEv = useRef<PlayEvent | null>(null);
  if (evIn) lastEv.current = evIn;
  const ev = evIn ?? lastEv.current;
  const playing = playIn && !!evIn;
  useEffect(() => { if (playIn && !evIn) onDone?.(); }, [playIn, evIn]);
  const wrap = useRef<HTMLDivElement>(null);
  const cv = useRef<HTMLCanvasElement>(null);
  const low = useRef<HTMLCanvasElement | null>(null);
  const stadium = useRef<{ c: HTMLCanvasElement; key: string; W: World; S: number } | null>(null);
  const img = useRef<HTMLImageElement | null>(null);
  const cam = useRef({ x: 60, y: -1, z: 1 });
  const wxp = useRef<{ x: number; y: number; v: number }[]>([]);
  const size = useRef({ w: 1000, h: 520 });
  const skip = useRef<null | (() => void)>(null);
  const [banner, setBanner] = useState<Banner | null>(null);
  const [ui, setUi] = useState<{ replay: boolean; box: boolean; label?: string; phase: string }>({ replay: false, box: false, phase: 'idle' });
  const [replays, setReplays] = useState(replaysOn);
  const replayRef = useRef(replays); replayRef.current = replays;
  const kits = useMemo(() => [kitFor(away, false), kitFor(home, true)] as const, [home.abbr, away.abbr]);
  const lineups = useMemo(() => [lineupFor(away), lineupFor(home)] as [ReturnType<typeof lineupFor>, ReturnType<typeof lineupFor>], [home.abbr, away.abbr, ev?.n]);
  useEffect(() => { const L = app.league; if (L) warmSkins(Object.values(L.players).filter(p => p.team === home.abbr || p.team === away.abbr)); }, [home.abbr, away.abbr]);
  useEffect(() => { if (!logo) return; const i = new Image(); i.crossOrigin = 'anonymous'; i.src = logo; i.onload = () => { img.current = i; stadium.current = null; }; }, [logo]);
  useEffect(() => {
    const el = wrap.current!, c = cv.current!;
    const fit = () => { const w = el.clientWidth, h = Math.round(Math.min(w * 0.52, window.innerHeight * 0.7)); DPR = Math.min(3, window.devicePixelRatio || 1); c.width = Math.round(w * DPR); c.height = Math.round(h * DPR); c.style.height = `${h}px`; size.current = { w: c.width, h: c.height }; stadium.current = null; };
    fit(); const ro = new ResizeObserver(fit); ro.observe(el); return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const c = cv.current!, ctx = c.getContext('2d')!;
    const staged = ev ? stage(ev, lineups) : null;
    const sc = staged?.sc ?? null, ch = staged?.ch ?? null, special = staged?.special ?? null;
    if (playing) { setBanner(null); setUi({ replay: false, box: false, phase: 'walkup' }); }
    // The clock runs from the walk-up (negative) through the play to the end of the after-play.
    const T0 = ch ? -ch.WU : 0, T1 = ch ? ch.DUR + ch.POST : 0;
    let clock = playing && ch ? T0 : T1, mode: 'live' | 'replay' | 'done' = playing && ch ? 'live' : 'done';
    let rc = 0;
    const r0 = ch?.replay?.[0] ?? 0, r1 = ch?.replay?.[1] ?? 0;
    let raf = 0, last = performance.now(), ended = false, endAt = 0;
    const parts: Particle[] = [];
    const fired = new Set<number>();
    let hype = 0.18 + Math.max(0, ((pulse ?? 45) - 45) / 100), ribbonMsg = `${home.nick.toUpperCase()}`, ribbonFlash = 0, bannerShown = false;
    const offTeam = sc ? (sc.off === 1 ? home : away) : home, defTeam = sc ? (sc.off === 1 ? away : home) : away;
    const homeOff = sc?.off === 1;
    if (ev && sc && !sc.kick && ev.down === 3 && !homeOff) { ribbonMsg = 'DEFENSE! DEFENSE!'; hype = 0.55; }
    else if (ev && sc && !sc.kick && ev.down === 3) { ribbonMsg = `3RD DOWN · ${home.nick.toUpperCase()}`; hype = 0.3; }
    const finish = () => {
      if (ended) return; ended = true; endAt = performance.now(); mode = 'done'; clock = T1;
      setUi(u => ({ ...u, replay: false, box: false, phase: 'done' }));
      if (ev && !bannerShown) { const b = bannerFor(ev, home, away, sc, ch); if (b) setBanner({ n: ev.n, ...b }); }
      onDone?.();
    };
    skip.current = playing && ch ? () => {
      if (mode === 'live' && clock < 0) { clock = 0; return; }
      if (mode === 'live') { if (ch.replay && replayRef.current) { mode = 'replay'; rc = r0; setUi(u => ({ ...u, replay: true, box: false, phase: 'replay' })); } else finish(); return; }
      finish();
    } : null;
    const burst = (x: number, y: number, n: number, cols: string[], up: number, spread: number, now: number, life = 0.9, size = 1) => {
      for (let k = 0; k < n; k++) { const a = Math.random() * Math.PI * 2, v = spread * (0.4 + Math.random() * 0.6); parts.push({ x, y, z: 0.2, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.6, vz: up * (0.5 + Math.random() * 0.7), c: cols[k % cols.length], life, t0: now, size }); }
    };
    const frame = (now: number) => {
      const realDt = Math.min(0.05, (now - last) / 1000); last = now;
      const { w, h } = size.current;
      // --- time: live play (with a beat of hit-stop on big hits), or the replay in slow motion
      if (mode === 'live' && ch) {
        let rate = 1;
        for (const f of ch.fx) if ((f.kind === 'impact' && f.big) && clock > f.at - 0.02 && clock < f.at + 0.14) rate = 1;
        clock += realDt * rate;
        if (clock >= T1) {
          if (ch.replay && replayRef.current && !special) { mode = 'replay'; rc = r0; setUi(u => ({ ...u, replay: true, box: false, phase: 'replay' })); }
          else finish();
        }
      } else if (mode === 'replay') { rc += realDt * 0.5; if (rc >= r1) finish(); }
      const c2 = mode === 'replay' ? rc : clock;
      // --- story beats: fx, sounds, ribbon, banners, letterbox
      if (ch && mode === 'live') ch.fx.forEach((f, i) => {
        if (fired.has(i) || clock < f.at) return; fired.add(i);
        if (f.kind === 'dust' || f.kind === 'sack') burst(f.x, f.y, f.kind === 'sack' ? 18 : 10, ['#d8cdb0', '#bfb393', '#e9e0c8'], 1.2, 2.2, now, 0.7);
        if (f.kind === 'turf') burst(f.x, f.y, 9, ['#2b7f39', '#4a3a22', '#3d9a4b'], 3.4, 2.4, now, 0.8);
        if (f.kind === 'impact') { burst(f.x, f.y, f.big ? 16 : 8, ['#ffffff', '#f3e6b5'], 1.6, f.big ? 5 : 3, now, 0.35); parts.push({ x: f.x, y: f.y, z: 1.2, vx: 0, vy: 0, vz: 0, c: 'ring', life: 0.32, t0: now, size: f.big ? 2 : 1 }); }
        if (f.kind === 'whiff') burst(f.x, f.y, 8, ['#d8cdb0', '#3d9a4b'], 1.4, 2, now, 0.6);
        if (f.kind === 'flag') parts.push({ x: f.x - 6 * (sc?.dirSign ?? 1), y: f.y - 8, z: 2, vx: 6 * (sc?.dirSign ?? 1) / 0.7, vy: 8 / 0.7, vz: 4, c: 'flag', life: 9, t0: now, size: 1 });
        if (f.kind === 'td') {
          const tm = offTeam; hype = 1; ribbonMsg = `TOUCHDOWN ${tm.nick.toUpperCase()}`; ribbonFlash = now + 4200;
          for (let k = 0; k < 120; k++) parts.push({ x: f.x + (Math.random() - 0.5) * 24, y: f.y + (Math.random() - 0.5) * 18, z: 7 + Math.random() * 6, vx: (Math.random() - 0.5) * 2, vy: (Math.random() - 0.5) * 2, vz: -1 - Math.random() * 1.5, c: [tm.colors[0], tm.colors[1] ?? '#fff', '#ffffff', '#ffd23f'][k % 4], life: 3.4, t0: now, size: 1 });
          if (tm === home) { const ex = (sc?.dirSign ?? 1) > 0 ? 121 : -1; for (const yy of [2, FW - 2]) for (let k = 0; k < 26; k++) parts.push({ x: ex, y: yy, z: 0, vx: (Math.random() - 0.5) * 0.6, vy: 0, vz: 5 + Math.random() * 5, c: ['#ffd23f', '#ff7a1a', '#ff3b1a', '#fff3b0'][k % 4], life: 1.1 + Math.random() * 0.6, t0: now + k * 25, size: 2 }); }
          sfx.crowd(); }
        if (f.kind === 'first') { ribbonMsg = 'FIRST DOWN'; ribbonFlash = now + 1800; hype = Math.max(hype, 0.55); }
        if (f.kind === 'turnover') { hype = defTeam === home ? 1 : 0.2; ribbonMsg = defTeam === home ? 'TURNOVER!' : home.nick.toUpperCase(); ribbonFlash = defTeam === home ? now + 2600 : 0;  }
        if (f.kind === 'sack') { hype = defTeam === home ? 0.9 : 0.25; if (defTeam === home) { ribbonMsg = 'SACK!'; ribbonFlash = now + 2000; } }
      });
      if (ch && mode === 'live' && !bannerShown && ev && clock > ch.DUR + Math.min(0.6, ch.POST * 0.3)) {
        bannerShown = true; const b = bannerFor(ev, home, away, sc, ch); if (b) setBanner({ n: ev.n, ...b });
        
      }
      
      hype += (0.18 + Math.max(0, ((pulse ?? 45) - 45) / 100) - hype) * realDt * 0.25;
      // --- geometry
      const S = Math.max(1, w / (VIEW_YARDS * 16));   // the camera shows about 46 yards across
      const RW0 = Math.ceil(w / S), RH0 = Math.ceil(h / S);
      const key = `${RW0}x${RH0}|${home.abbr}|${away.abbr}|${img.current ? 1 : 0}|${night ? 1 : 0}|${college ? 1 : 0}`;
      if (!stadium.current || stadium.current.key !== key) { const W0 = makeWorld(RW0, RH0); stadium.current = { c: paintStadium(W0, { home, away, logo: img.current, night: !!night, college: !!college, snow: weather?.precip === 'snow' && !weather.dome }), key, W: W0, S }; cam.current.y = -1; }
      const W = stadium.current.W;
      // --- camera: where to look and how tight
      let fx0 = 60, fy0 = MID, zoom = 1;
      if (sc && ch) {
        const s = sc.dirSign;
        if (mode === 'replay') { [fx0, fy0] = ch.focus(c2); zoom = 1.7; }
        else if (c2 < 0) { fx0 = sc.kick ? sc.los : sc.los + s * 5; fy0 = MID; zoom = sc.kick ? 1 : 1.25; }
        else if (c2 <= ch.DUR) {
          const b = ch.ball(Math.min(c2, ch.DUR)), b2 = ch.ball(Math.min(c2 + 0.25, ch.DUR));
          fx0 = b ? b.x + (b2 ? (b2.x - b.x) * 1.6 : 0) : sc.los; fy0 = b ? b.y : MID;
          zoom = !sc.kick && c2 < sc.pre * sc.dur ? 1.25 : 1;
        } else {
          [fx0, fy0] = ch.focus(c2);
          const p = c2 - ch.DUR;
          zoom = ch.hero >= 0 && ch.celebrate !== 'none' ? (sc.td ? 2.1 : ch.celebrate === 'point' ? 1.45 : 1.6) : 1.15;
          if (p < 0.25) zoom = 1 + (zoom - 1) * (p / 0.25);
        }
      }
      fx0 = clamp(fx0, -6, 126);
      const C = cam.current;
      const k1 = 1 - Math.exp(-realDt * (mode === 'replay' ? 6 : 3.2));
      const live = mode === 'live' && ch && clock >= 0 && clock <= (ch?.DUR ?? 0);
      // Steady during the live play: pan only when the ball leaves a centre box.
      if (live) { const box = 38 / C.z * 0.12, off = fx0 - C.x; if (Math.abs(off) > box) C.x += (off - Math.sign(off) * box) * (1 - Math.exp(-realDt * 4)); }
      else C.x += (fx0 - C.x) * k1;
      zoom = 1; C.z = 1;
      const E = S * C.z, VW = Math.ceil(w / E), VH = Math.ceil(h / E);
      const bottom = W.height - VH / 2;
      const wantY = clamp(wy(W, fy0) - VH * 0.12, VH / 2, bottom);
      if (C.y < 0) C.y = wantY; else C.y += (wantY - C.y) * k1;
      const ox = Math.round(wx(W, C.x) - VW / 2), oy = Math.round(Math.min(bottom, C.y) - VH / 2);
      const sx = (x: number) => Math.round(wx(W, x) - ox), sy = (y: number, z = 0) => Math.round(wy(W, y, z) - oy);
      // --- draw into the low-res buffer
      if (!low.current) low.current = document.createElement('canvas');
      const lc = low.current; if (lc.width < VW || lc.height < VH) { lc.width = Math.max(VW, RW0 * 2); lc.height = Math.max(VH, RH0 * 2); }
      const g = lc.getContext('2d')!;
      g.imageSmoothingEnabled = false;
      g.fillStyle = '#0d1018'; g.fillRect(0, 0, VW, VH);
      g.drawImage(stadium.current.c, ox, oy, VW, VH, 0, 0, VW, VH);
      drawRibbon(g, W, oy, VW, now, ribbonMsg, home.colors[0] === '#000000' ? home.colors[1] ?? '#fff' : home.colors[0], now < ribbonFlash);
      drawCrowd(g, W, ox, oy, VW, now, hype, !!night, [home.colors[0], home.colors[1] ?? '#ffffff']);
      if (sc && ch) drawPlay(g, W, sc, ch, c2, kits, now, sx, sy, VW, weather, mode === 'replay', special);
      drawPosts(g, W, sx, sy, VW, now, weather?.wind ?? 0);
      drawParticles(g, parts, now, sx, sy, realDt);
      drawLight(g, VW, VH, night);
      drawWeather(g, VW, VH, weather, wxp.current, realDt, now);
      // --- up to the screen
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = '#0d1018'; ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(lc, 0, 0, VW, VH, 0, 0, VW * E, VH * E);
      if (sc && ch && mode !== 'done' || (sc && ch && !playing)) drawTags(ctx, sc, ch, c2, kits, sx, sy, E, mode === 'replay');
      const busy = mode !== 'done' || parts.length > 0 || (!!weather && weather.precip !== 'none' && !weather.dome) || Math.abs(fx0 - C.x) > 0.05 || Math.abs(zoom - C.z) > 0.01 || (ended && now - endAt < 3000) || hype > 0.25;
      raf = busy ? requestAnimationFrame(frame) : 0;
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); skip.current = null; };
  }, [ev?.n, playing]);
  const ddText = ev ? ev.type === 'kickoff' ? 'Kickoff' : ev.type === 'punt' ? 'Punt' : ev.type === 'fg' ? 'Field Goal' : ev.type === 'xp' ? 'Extra Point' : `${['1st', '2nd', '3rd', '4th'][ev.down - 1] ?? ''} & ${ev.yl + ev.togo >= 100 ? 'Goal' : ev.togo}` : '';
  const off = ev ? (ev.poss === 1 ? home : away) : home;
  return (
    <div ref={wrap} className={`bcast px bc2${ui.box ? ' boxed' : ''}`} onClick={() => skip.current?.()}>
      {weather && <div className="px-wx">{weather.dome ? 'DOME' : `${weather.precip === 'none' ? (night ? 'NIGHT' : 'CLEAR') : weather.precip.toUpperCase()} ${weather.temp}°${weather.wind >= 8 ? ` · WIND ${weather.wind} MPH` : ''}`}</div>}
      <canvas ref={cv} style={{ width: '100%', display: 'block', imageRendering: 'pixelated' }} />
      <i className="bc-lb top" /><i className="bc-lb bot" />
      {ev && ui.phase !== 'replay' && <div className="bc-dd" style={{ '--tc': off.colors[0] } as React.CSSProperties}><b>{ddText}</b>{ev.call && <span>{ev.call}</span>}{ev.dcall && <em>vs {ev.dcall}</em>}</div>}
      {ui.replay && <div className="bc-replay"><b>REPLAY</b>{ui.label && <span>{ui.label}</span>}</div>}
      {ui.phase !== 'done' && ui.phase !== 'idle' && <button className="bc-skip" onClick={e => { e.stopPropagation(); skip.current?.(); }}>{ui.phase === 'replay' ? 'Skip replay ▸' : 'Skip ▸'}</button>}
      <button className={`bc-rp${replays ? ' on' : ''}`} title="Instant replays of big plays" onClick={e => { e.stopPropagation(); const v = !replays; setReplays(v); try { localStorage.setItem(REPLAY_KEY, v ? '1' : '0'); } catch { /* storage blocked */ } }}>Replays {replays ? 'on' : 'off'}</button>
      {banner && !ui.replay && <div key={banner.n} className={`pxbanner bn2${banner.small ? ' small' : ''}${banner.kind ? ` k-${banner.kind}` : ''}`} style={{ '--bc': banner.color } as React.CSSProperties}><span>{banner.text}</span>{banner.sub && <small>{banner.sub}</small>}</div>}
    </div>
  );
}

// ---- drawing the play ----------------------------------------------------------------------
function drawPlay(g: CanvasRenderingContext2D, W: World, sc: Scene, ch: Choreo, c: number, kits: readonly [Kit, Kit], now: number, sx: (x: number) => number, sy: (y: number, z?: number) => number, vw: number, weather: Weather | undefined, replay: boolean, special: Special) {
  const s = sc.dirSign;
  const yTop = sy(0), yBot = sy(FW);
  if (!sc.kick) {
    g.fillStyle = 'rgba(70,150,255,.85)'; g.fillRect(sx(sc.los), yTop, 1, yBot - yTop);
    if (sc.first !== sc.los && Math.abs(sc.first - (s > 0 ? 110 : 10)) > 0.5) { g.fillStyle = 'rgba(255,214,10,.92)'; g.fillRect(sx(sc.first), yTop, 1, yBot - yTop); }
    // Chain crew on the far sideline: the box and the two sticks, moved after a first down.
    const moved = ch.first && c > ch.DUR + 1.1 ? Math.min(1, (c - ch.DUR - 1.1) / 1.4) : 0;
    const spot = moved ? ch.ball(ch.DUR) : null;
    const nf = spot ? spot.x + s * 10 : sc.first;
    const fst = sc.first + (nf - sc.first) * moved, box = sc.los + ((spot?.x ?? sc.los) - sc.los) * moved;
    const yy = sy(-1.6);
    g.fillStyle = '#ff7a00'; g.fillRect(sx(box), yy - 8, 1, 8); g.fillRect(sx(box) - 1, yy - 11, 3, 4);
    const a = sx(fst), b = sx(fst - s * 10);
    for (const x of [a, b]) { g.fillStyle = '#ff7a00'; g.fillRect(x, yy - 9, 1, 9); g.fillRect(x - 1, yy - 10, 3, 2); g.fillStyle = '#e8d6b0'; g.fillRect(x - 1, yy - 2, 2, 2); }
    g.fillStyle = 'rgba(220,220,220,.8)'; g.fillRect(Math.min(a, b), yy - 5, Math.abs(a - b), 1);
  }
  const snap = sc.pre * sc.dur;
  if (!replay && c > -0.9 && c < snap + 0.25 && (sc.art || sc.dart) && !special) {
    g.globalAlpha = c < snap ? 0.85 * Math.min(1, (c + 0.9) / 0.4) : Math.max(0, 0.85 - (c - snap) / 0.25);
    drawArt(g, sc, sc.dart ?? [], true, sx, sy); drawArt(g, sc, sc.art ?? [], false, sx, sy); g.globalAlpha = 1;
  }
  const poses: Pose[] = sc.actors.map((_, i) => ch.pose(i, c));
  const refs = ch.refs(c);
  const ball = ch.ball(c);
  const holder = (() => { if (!ball || ball.free) return -1; let b = -1, bd = 1.2; poses.forEach((p, i) => { const d = Math.hypot(p.x - ball.x, p.y - ball.y); if (d < bd) { bd = d; b = i; } }); return b; })();
  const cold = !!weather && weather.temp < 38 && !weather.dome;
  const list: { y: number; draw: () => void }[] = [];
  const drawOne = (p: Pose, kit: Kit, skin: string, isRef: boolean, i: number) => {
    const px = sx(p.x), py = sy(p.y);
    if (px < -24 || px > vw + 24) return;
    const lift = p.rig.lift;
    // Shadow: under the feet, longer when he's on the turf, smaller when he's in the air.
    const flat = p.lying || p.rig.hipY < 6;
    const sw = flat ? 24 : lift > 3 ? 7 : 11;
    const sx0 = flat ? px + p.face * Math.sign(p.rig.lean || 1) * 7 : px;
    g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(Math.round(sx0 - sw / 2), py - 1, sw, 2); g.fillRect(Math.round(sx0 - sw / 2) + 2, py + 1, sw - 4, 1);
    const b = isRef ? 'ref' : buildOf(sc.actors[i]?.slot ?? '', sc.actors[i]?.role ?? '');
    const a0 = sc.actors[i];
    g.drawImage(renderRig(p.rig, b, kit, skin, isRef || !a0 ? null : gearFor(a0.id ?? `${a0.team}${a0.slot}${a0.num}`, b), p.face < 0), px - AX, py - AY);
    // Breath in the cold.
    if (cold && ((now / 1000 + i * 0.37) % 1.6) < 0.45) { const k = ((now / 1000 + i * 0.37) % 1.6) / 0.45; g.fillStyle = `rgba(240,244,250,${0.55 * (1 - k)})`; g.fillRect(px + p.face * (5 + Math.round(k * 3)), py - 17 - lift - Math.round(k * 2), 2, 1); }
  };
  sc.actors.forEach((a, i) => {
    const p = poses[i];
    const skin = a.skin ?? SKIN[(a.id ? hashStr(a.id) : a.num) % SKIN.length];
    const kit = kits[a.team];
    list.push({ y: p.y + (p.lying ? -0.3 : 0), draw: () => {
      // Breakaway speed: two fading after-images behind the ball carrier.
      if (false) {
        const q1 = ch.pose(i, c - 0.06), q2 = ch.pose(i, c - 0.12);
        if (Math.hypot(p.x - q2.x, p.y - q2.y) > 0.95) { g.globalAlpha = 0.18; drawOne(q2, kit, skin, false, -1); g.globalAlpha = 0.3; drawOne(q1, kit, skin, false, -1); g.globalAlpha = 1; }
      }
      drawOne(p, kit, skin, false, i);
    } });
  });
  refs.forEach((r, j) => list.push({ y: r.y, draw: () => drawOne(r, kits[0], '#c99a76', true, 100 + j) }));
  list.sort((a, b) => a.y - b.y).forEach(d => d.draw());
  // The ball in flight: a shadow on the turf, a short trail, a spiral (or end over end off a foot).
  if (ball && (ball.free || ball.h > 1.6) && holder < 0 || (ball && ball.h > 1.6)) {
    const px = sx(ball.x), py = sy(ball.y, ball.h);
    if (ball.h > 0.4) { g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(sx(ball.x) - 2, sy(ball.y), 5, 2); }
    if (ball.h > 1) for (let k = 1; k <= 4; k++) { const b2 = ch.ball(c - k * 0.022); if (!b2) break; g.fillStyle = `rgba(255,255,255,${0.24 - k * 0.05})`; g.fillRect(sx(b2.x), sy(b2.y, b2.h), 2, 1); }
    // A proper football: dark outline, brown leather, laces, pointed along its flight
    // (a tight spiral on throws, end over end off the foot).
    const b2 = ch.ball(c + 0.03), dir = b2 ? Math.atan2(sy(b2.y, b2.h) - py, sx(b2.x) - px) : 0;
    const ang = ball.kick && ball.h > 0.5 ? (now / 90) % (Math.PI * 2) : dir;
    drawFootball(g, px, py, ang, Math.floor(now / 45) % 3);
  } else if (ball && ball.free) {
    const px = sx(ball.x), py = sy(ball.y, ball.h);
    g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(px - 2, sy(ball.y), 5, 1);
    drawFootball(g, px, py, 0, 0);
  }
}

/** The ball, 7x4 pixels: outlined so it reads against grass, crowd and jerseys. */
function drawFootball(g: CanvasRenderingContext2D, px: number, py: number, ang: number, spin: number) {
  const ca = Math.cos(ang), sa = Math.sin(ang);
  const P = (u: number, v: number, col: string) => { g.fillStyle = col; g.fillRect(Math.round(px + u * ca - v * sa), Math.round(py + u * sa + v * ca), 1, 1); };
  for (let u = -4; u <= 4; u++) for (let v = -2; v <= 2; v++) { const e = (u * u) / 16 + (v * v) / 4; if (e <= 1.15 && e > 0.55) P(u, v, '#120803'); }
  for (let u = -3; u <= 3; u++) for (let v = -1; v <= 1; v++) { const e = (u * u) / 10 + (v * v) / 2.2; if (e <= 1) P(u, v, v < 0 ? '#a0521f' : '#7a3a12'); }
  P(-1 + spin, 0, '#ffffff'); P(spin, -0, '#ffffff'); P(-3, 0, '#f2f2f2'); P(3, 0, '#f2f2f2');
}

function drawArt(g: CanvasRenderingContext2D, sc: Scene, art: Art[], def: boolean, sx: (x: number) => number, sy: (y: number, z?: number) => number) {
  const s = sc.dirSign;
  const at = (dx: number, dy: number): [number, number] => [sx(sc.los + s * dx), sy(MID + s * dy)];
  let ol = 0;
  g.lineWidth = 1;
  for (const a of art) {
    if (a.kind === 'zone') { const [x, y] = at(a.pts[0][0], a.pts[0][1]); g.strokeStyle = a.pts[0][0] > 12 ? 'rgba(120,190,255,.8)' : 'rgba(255,210,63,.8)'; g.beginPath(); g.ellipse(x, y, (a.r ?? 5) * 5, (a.r ?? 5) * 2.5, 0, 0, 7); g.stroke(); continue; }
    const al = sc.align ?? FORMATION;
    const start = def ? a.pts[0] : a.who === 'OL' ? OL_SPOTS[ol++ % 5] : snapSpot(a, al);
    const pts = def ? a.pts : [start, ...a.pts];
    if (!def && a.motion?.length && a.who !== 'OL') {
      g.strokeStyle = '#7fd4ff'; g.setLineDash([2, 2]); g.beginPath();
      [al[a.who as keyof typeof FORMATION], ...a.motion].forEach(([dx, dy], j) => { const [x, y] = at(dx, dy); j ? g.lineTo(x + 0.5, y + 0.5) : g.moveTo(x + 0.5, y + 0.5); });
      g.stroke(); g.setLineDash([]);
    }
    if (pts.length < 2) continue;
    g.strokeStyle = a.primary ? '#ffd23f' : a.kind === 'blitz' ? '#ff4d5e' : a.kind === 'block' ? 'rgba(255,255,255,.5)' : '#fff';
    g.beginPath(); pts.forEach(([dx, dy], j) => { const [x, y] = at(dx, dy); j ? g.lineTo(x + 0.5, y + 0.5) : g.moveTo(x + 0.5, y + 0.5); }); g.stroke();
    const [ex, ey] = at(...pts[pts.length - 1]); g.fillStyle = g.strokeStyle as string; g.fillRect(ex - 1, ey - 1, 3, 3);
  }
}

function drawParticles(g: CanvasRenderingContext2D, ps: Particle[], now: number, sx: (x: number) => number, sy: (y: number, z?: number) => number, dt: number) {
  for (let i = ps.length - 1; i >= 0; i--) {
    const p = ps[i], age = (now - p.t0) / 1000;
    if (age < 0) continue;
    if (age > p.life) { ps.splice(i, 1); continue; }
    if (p.c === 'ring') { const r = Math.round(2 + age * 30 * p.size); g.strokeStyle = `rgba(255,255,255,${0.9 - age / p.life})`; g.lineWidth = 1; g.beginPath(); g.ellipse(sx(p.x), sy(p.y, p.z), r, r * 0.6, 0, 0, 7); g.stroke(); continue; }
    if (p.c === 'flag') {
      // The yellow flag, thrown in an arc, then lying on the turf.
      const k = Math.min(1, age / 0.7), x = p.x + p.vx * 0.7 * k, y = p.y + p.vy * 0.7 * k, z = Math.max(0, 2 + 4 * k - 6 * k * k);
      g.fillStyle = '#ffd400'; g.fillRect(sx(x) - 1, sy(y, z) - 1, 3, 2); g.fillStyle = '#fff'; g.fillRect(sx(x), sy(y, z), 1, 1);
      continue;
    }
    p.vz -= 9.8 * dt * (p.c.length && p.life > 2.5 ? 0.06 : 1);
    p.x += p.vx * dt; p.y += p.vy * dt; p.z = Math.max(0, p.z + p.vz * dt);
    if (p.z === 0 && p.life < 2.5) { p.vx *= 0.8; p.vy *= 0.8; }
    g.globalAlpha = Math.min(1, (p.life - age) / 0.4);
    g.fillStyle = p.c; g.fillRect(sx(p.x), sy(p.y, p.z), p.size, p.size);
  }
  g.globalAlpha = 1;
}

/** Broadcast lighting: a soft vignette, and the night look (darker sky, the field lit by banks). */
function drawLight(g: CanvasRenderingContext2D, VW: number, VH: number, night?: boolean) {
  const v = g.createRadialGradient(VW / 2, VH * 0.6, VH * 0.35, VW / 2, VH * 0.6, VW * 0.75);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, night ? 'rgba(4,6,18,.5)' : 'rgba(0,0,0,.22)');
  g.fillStyle = v; g.fillRect(0, 0, VW, VH);
  if (night) { g.fillStyle = 'rgba(255,248,225,.035)'; g.fillRect(0, VH * 0.3, VW, VH * 0.7); }
}

/** Rain streaks or drifting snow over the picture. */
function drawWeather(g: CanvasRenderingContext2D, RW: number, RH: number, w: Weather | undefined, ps: { x: number; y: number; v: number }[], dt: number, now: number) {
  if (!w || w.dome || w.precip === 'none') return;
  const snow = w.precip === 'snow', wind = (w.wind / 20) * (snow ? 14 : 26);
  g.fillStyle = snow ? 'rgba(235,240,250,.10)' : 'rgba(40,50,70,.16)'; g.fillRect(0, 0, RW, RH);
  const want = Math.round((snow ? 140 : 170) * (RW / 340));
  while (ps.length < want) ps.push({ x: Math.random() * RW, y: Math.random() * RH, v: 0.6 + Math.random() * 0.8 });
  for (const p of ps) {
    p.y += (snow ? 14 : 150) * p.v * dt; p.x += (wind + (snow ? Math.sin(now / 600 + p.v * 9) * 6 : 0)) * dt;
    if (p.y > RH) { p.y = -2; p.x = Math.random() * RW; } if (p.x > RW) p.x -= RW; if (p.x < 0) p.x += RW;
    if (snow) { g.fillStyle = `rgba(255,255,255,${0.55 + p.v * 0.3})`; g.fillRect(Math.round(p.x), Math.round(p.y), p.v > 1.1 ? 2 : 1, p.v > 1.1 ? 2 : 1); }
    else { g.fillStyle = 'rgba(190,210,235,.55)'; const len = 3 + Math.round(p.v * 2); for (let k = 0; k < len; k++) g.fillRect(Math.round(p.x - (wind / 150) * k), Math.round(p.y - k), 1, 1); }
  }
}

/** Crisp label after the up-scale: the ball carrier (or the target in the air), or the hero. */
function drawTags(ctx: CanvasRenderingContext2D, sc: Scene, ch: Choreo, c: number, kits: readonly [Kit, Kit], sx: (x: number) => number, sy: (y: number, z?: number) => number, E: number, replay: boolean) {
  let who = -1;
  if (c > ch.DUR && ch.hero >= 0 && ch.celebrate !== 'none') who = ch.hero;
  else if (c >= 0 && c <= ch.DUR) {
    const u = c / ch.DUR, h = sc.hold ? sc.hold(u) : -1;
    who = h >= 0 && !(sc.qb === h && !sc.kick && (sc.pass || ch.ball(c)?.free)) ? h : sc.target !== undefined && sc.throwAt !== undefined && u > sc.throwAt && (sc.catchAt === undefined || u < sc.catchAt) ? sc.target : -1;
    if (!sc.kick && c < sc.pre * sc.dur + 0.1) who = -1;
  }
  if (who < 0) return;
  const a = sc.actors[who], p = ch.pose(who, c);
  if (p.lying || p.rig.hipY < 8) return;
  const px = sx(p.x) * E, py = (sy(p.y) - 37 - p.rig.lift) * E;
  ctx.font = `700 ${Math.round((replay ? 12 : 11) * DPR)}px Silkscreen, monospace`;
  const label = `${a.num} ${(a.ln || a.role).toUpperCase()}`;
  const w = ctx.measureText(label).width + 14 * DPR, th = 16 * DPR;
  const kit = kits[a.team];
  ctx.fillStyle = 'rgba(8,10,14,.9)'; ctx.fillRect(Math.round(px - w / 2), Math.round(py - th), Math.round(w), Math.round(th));
  ctx.fillStyle = kit.jersey === '#f3f3f1' ? kit.num : kit.jersey; ctx.fillRect(Math.round(px - w / 2), Math.round(py - th), Math.round(3 * DPR), Math.round(th));
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, Math.round(px + 2), Math.round(py - th / 2));
}

/** The graphic after the whistle. Incompletions say so; only a real interception says pick. */
function bannerFor(ev: PlayEvent, home: Team, away: Team, sc: Scene | null, ch: Choreo | null): Omit<Banner, 'n'> | null {
  const t = ev.poss === 1 ? home : away, o = ev.poss === 1 ? away : home;
  if (ev.type === 'penalty') return { text: 'Flag', color: '#c9a400', sub: ev.text.replace(/^PENALTY[:\s-]*/i, '').slice(0, 60), small: true, kind: 'flag' };
  if (ev.type === 'kneel') return { text: 'Victory Formation', color: t.colors[0], small: true };
  if (ev.type === 'spike') return { text: 'Spiked', color: '#2a2f3a', sub: 'Clock stopped', small: true };
  if (ev.td) return { text: 'Touchdown!', color: (ev.type === 'punt' ? o : t).colors[0], sub: (ev.type === 'punt' ? o : t).name, kind: 'td' };
  if (ev.type === 'fg' || ev.type === 'xp') return /NO GOOD|BLOCKED/.test(ev.text) ? { text: /BLOCKED/.test(ev.text) ? 'Blocked!' : 'No Good', color: '#7a1f2b' } : ev.type === 'xp' ? { text: 'Extra Point Good', color: t.colors[0], small: true } : { text: "It's Good!", color: t.colors[0], kind: 'good' };
  if (ev.turnover && ev.type === 'pass') return { text: 'Intercepted!', color: o.colors[0], sub: o.name, kind: 'to' };
  if (ev.turnover && (ev.type === 'run' || ev.type === 'scramble' || ev.type === 'sack')) return { text: ev.type === 'sack' ? 'Strip Sack!' : 'Fumble!', color: o.colors[0], sub: `${o.nick} ball`, kind: 'to' };
  if (/BLOCKED/.test(ev.text)) return { text: 'Blocked!', color: o.colors[0] };
  if (ev.type === 'sack') return { text: 'Sack!', color: o.colors[0], sub: `Loss of ${Math.abs(ev.yards)}`, kind: 'sack' };

  if (false) return { text: ch?.label ? `${ch?.label}!` : 'Big Play!', color: t.colors[0], sub: `+${ev.yards} yards${ev.yards >= ev.togo ? ' · first down' : ''}` };

  return null;
}
