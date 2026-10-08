// Signing ceremony. When a free agent signs with you the screen cuts to black
// ("BREAKING"), then to your stadium at night: lights, crowd, a stage in team colours.
// Your coach and the new player walk out from either side, meet at centre stage,
// turn to the cameras and hold up his jersey while the photographers' flashes go off.
// Pixel art in the same style as the press room. Plays once per signing; queued
// signings play back to back.
import { useEffect, useRef, useState } from 'react';
import { app, useApp } from './store';
import { vivid } from './components';
import { pxText, pxWidth, paint } from './field/pixel';
import { coachSprites, lookOf, SKIN_TONES, type CoachLook } from './coachlook';
import { skinOf } from './skin';
import { ceremonies, type Ceremony } from '../core/freeagency';
import { money } from '../core/contracts';
import { hash } from '../core/rng';
import type { League, Player } from '../core/types';

const RW = 160, RH = 90;
const BLACK = 1.3, WALK = 2.6, HOLD = 6.5;   // phase ends (seconds)

/** The player in his signing-day suit: the coach-sprite builder with his own look. */
function playerLook(p: Player): CoachLook {
  const sk = skinOf(p), m = /rgba?\((\d+)\D+(\d+)\D+(\d+)/.exec(sk);
  const rgb = m ? [+m[1], +m[2], +m[3]] : [0, 2, 4].map(i => parseInt(sk.replace('#', '').slice(i, i + 2), 16) || 0);
  const near = SKIN_TONES.map((t, i) => { const c = [1, 3, 5].map(k => parseInt(t.slice(k, k + 2), 16)); return [i, Math.hypot(c[0] - rgb[0], c[1] - rgb[1], c[2] - rgb[2])] as const; }).sort((a, b) => a[1] - b[1])[0][0];
  const h = hash(p.id) >>> 0;
  const big = ['OT', 'G', 'C', 'DT', 'EDGE'].includes(p.pos);
  return { skin: near, hairColor: near >= 3 ? 0 : h % 3, hair: (['Short', 'Buzz', 'Long', 'Buzz'] as const)[h % 4], beard: (['None', 'Stubble', 'Beard', 'Goatee', 'None'] as const)[(h >>> 4) % 5], build: big ? 'Big' : p.pos === 'WR' || p.pos === 'CB' ? 'Slim' : 'Average', head: 'None', glasses: 'None', top: 'Suit' };
}

/** A jersey to hold up: team colour, trim on the sleeves, his number. */
function jersey(L: League, p: Player): HTMLCanvasElement {
  const t = L.teams[p.team] ?? L.teams[L.user], c0 = vivid(t.colors[0]), c1 = t.colors[1] ?? '#ffffff';
  const rows = ['..JJJ....JJJ..', '.JJJJJJJJJJJJ.', 'TJJJJJJJJJJJJT', 'TJJJJJJJJJJJJT', '..JJJJJJJJJJ..', '..JJJJJJJJJJ..', '..JJJJJJJJJJ..', '..JJJJJJJJJJ..', '..JJJJJJJJJJ..', '..JJJJJJJJJJ..', '..JJJJJJJJJJ..', '..TTTTTTTTTT..'];
  const c = paint(rows, { J: c0, T: c1 });
  const g = c.getContext('2d')!;
  const n = String(p.num || 0), w = pxWidth(n);
  pxText(g, n, Math.round((c.width - w) / 2), 5, c1.toLowerCase() === c0.toLowerCase() ? '#fff' : c1);
  return c;
}

/** The stadium at night, drawn once per team. */
function stadium(L: League): HTMLCanvasElement {
  const t = L.teams[L.user], c0 = vivid(t.colors[0]), c1 = t.colors[1] ?? '#ffffff';
  const c = document.createElement('canvas'); c.width = RW; c.height = RH;
  const g = c.getContext('2d')!;
  const sky = g.createLinearGradient(0, 0, 0, 40); sky.addColorStop(0, '#050814'); sky.addColorStop(1, '#141b33');
  g.fillStyle = sky; g.fillRect(0, 0, RW, 40);
  // Light towers.
  for (const x of [14, 146]) { g.fillStyle = '#2a2f3a'; g.fillRect(x, 4, 1, 26); g.fillStyle = '#fffbe6'; g.fillRect(x - 5, 3, 11, 3); g.fillStyle = 'rgba(255,250,220,.08)'; g.beginPath(); g.moveTo(x - 6, 6); g.lineTo(x + 6, 6); g.lineTo(x + (x < 80 ? 70 : -10), 70); g.lineTo(x + (x < 80 ? 10 : -70), 70); g.fill(); }
  // Stands: three tiers of crowd in team colours with the odd camera flash.
  for (let tier = 0; tier < 3; tier++) {
    const y0 = 14 + tier * 9; g.fillStyle = ['#1a1f2b', '#202634', '#262d3d'][tier]; g.fillRect(0, y0, RW, 9);
    for (let x = 0; x < RW; x += 2) for (let y = y0 + 1; y < y0 + 8; y += 2) { const r = (hash(`${x}-${y}`) >>> 0) % 10; g.fillStyle = r < 4 ? c0 : r < 6 ? c1 : r < 8 ? '#c9b49a' : '#6b4a33'; g.fillRect(x + (y % 4 ? 1 : 0), y, 1, 1); }
  }
  g.fillStyle = c0; g.fillRect(0, 40, RW, 3); g.fillStyle = c1; g.fillRect(0, 42, RW, 1);
  // Field.
  const f = g.createLinearGradient(0, 43, 0, RH); f.addColorStop(0, '#1d6b33'); f.addColorStop(1, '#14501f');
  g.fillStyle = f; g.fillRect(0, 43, RW, RH - 43);
  for (let x = 0; x < RW; x += 16) { g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(x, 43, 8, RH - 43); }
  g.fillStyle = 'rgba(255,255,255,.35)'; for (let x = 8; x < RW; x += 16) g.fillRect(x, 43, 1, RH - 43);
  // Stage with a backdrop in team colours.
  g.fillStyle = '#0b0d11'; g.fillRect(44, 30, 72, 26);
  g.fillStyle = c0; g.fillRect(45, 31, 70, 24);
  for (let r = 0; r < 3; r++) for (let x = 47 + (r % 2) * 9; x + pxWidth(t.abbr) < 114; x += 18) { g.globalAlpha = 0.3; pxText(g, t.abbr, x, 33 + r * 7, (r + x) % 2 ? c1 : '#fff'); }
  g.globalAlpha = 1;
  g.fillStyle = '#20242c'; g.fillRect(38, 56, 84, 5); g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(38, 56, 84, 1);
  g.fillStyle = '#14171d'; g.fillRect(40, 61, 80, 3);
  return c;
}

const SHOOTER = ['....HHH.....', '...HHHHH....', '..KKHHHHKK..', '..KKJJJJKK..', '.JJJJJJJJJJ.', '.JJJJJJJJJJ.', 'JJJJJJJJJJJJ'];

export function SigningCeremony() {
  const s = useApp();
  const L = s.league;
  const q = L ? ceremonies(L) : [];
  const busyScreen = ['game', 'presser', 'coachcreate', 'menu', 'load', 'new'].includes(s.screen.id);
  const cur: Ceremony | undefined = !busyScreen ? q[0] : undefined;
  const p = cur && L ? L.players[cur.pid] : undefined;
  if (L && cur && !p) { q.shift(); }
  return L && cur && p ? <Stage key={cur.pid} L={L} c={cur} p={p} onDone={() => { q.shift(); app.touch(); }} left={q.length - 1} /> : null;
}

function Stage({ L, c, p, onDone, left }: { L: League; c: Ceremony; p: Player; onDone: () => void; left: number }) {
  const cv = useRef<HTMLCanvasElement>(null);
  const [t, setT] = useState(0);
  const t0 = useRef(performance.now());
  const team = L.teams[L.user];
  useEffect(() => {
    const g = cv.current!.getContext('2d')!; g.imageSmoothingEnabled = false;
    const bg = stadium(L), coach = coachSprites(lookOf(L), team.colors), me = coachSprites(playerLook(p), team.colors), shirt = jersey(L, p);
    const crowd = ['#3a3f4a', '#5a4636', '#2e3542', '#4b3f5a', '#30463c'];
    const shooters = crowd.map((j, i) => paint(SHOOTER, { H: ['#1b1612', '#3a2a1c', '#6b4a2b', '#2a2a2a', '#8a7a62'][i], J: j, K: '#121418' }));
    const flip = new Map<HTMLCanvasElement, HTMLCanvasElement>();
    const mirror = (s: HTMLCanvasElement) => { let f = flip.get(s); if (!f) { f = document.createElement('canvas'); f.width = s.width; f.height = s.height; const h = f.getContext('2d')!; h.translate(s.width, 0); h.scale(-1, 1); h.drawImage(s, 0, 0); flip.set(s, f); } return f; };
    const flashes: { x: number; y: number; at: number }[] = [];
    let raf = 0, last = 0;
    const loop = (now: number) => {
      const s = Math.max(0, (now - t0.current) / 1000);
      if (Math.floor(s * 10) !== last) { last = Math.floor(s * 10); setT(s); }
      if (s < BLACK) { g.fillStyle = '#000'; g.fillRect(0, 0, RW, RH); raf = requestAnimationFrame(loop); return; }
      g.drawImage(bg, 0, 0);
      // Walk-out: coach from the left, player from the right, to either side of centre.
      const k = Math.min(1, (s - BLACK) / (WALK - BLACK)), e = 1 - (1 - k) * (1 - k);
      const cx = Math.round(-14 + (56 - -14) * e), px = Math.round(174 + (97 - 174) * e);
      if (k < 1) {
        const f = Math.floor(s * 7) % 4;
        g.drawImage(coach.walk[f], cx - 7, 41);
        g.drawImage(mirror(me.walk[f]), px - 7, 41);
      } else {
        const lift = Math.min(1, (s - WALK) / 0.45);
        // Front view: torso sprites plus legs, standing on the stage.
        const legs = (x: number, pants: string) => { g.fillStyle = pants; g.fillRect(x - 3, 55, 3, 5); g.fillRect(x + 1, 55, 3, 5); g.fillStyle = '#16181c'; g.fillRect(x - 4, 60, 4, 1); g.fillRect(x + 1, 60, 4, 1); };
        legs(cx, lookOf(L).top === 'Suit' ? '#20242c' : '#b9a47a'); legs(px, '#20242c');
        g.drawImage(coach.point, cx - 7, 38);
        g.drawImage(mirror(me.point), px - 7, 38);
        // The jersey goes up between them.
        g.drawImage(shirt, Math.round((cx + px) / 2 - shirt.width / 2), Math.round(50 - lift * 12));
        if (lift >= 1 && Math.random() < 0.05) flashes.push({ x: 50 + Math.random() * 60, y: 20 + Math.random() * 20, at: now });   // crowd phones
      }
      // Photographers along the front.
      const rate = k >= 1 ? 6 : 1.2;
      if (Math.random() < rate / 60) { const i = Math.floor(Math.random() * 5); flashes.push({ x: 10 + i * 33 + 5, y: 79, at: now }); }
      shooters.forEach((sh, i) => g.drawImage(sh, 8 + i * 33, 81 + (i % 2)));
      for (let i = flashes.length - 1; i >= 0; i--) {
        const f = flashes[i], a = 1 - (now - f.at) / 160;
        if (a <= 0) { flashes.splice(i, 1); continue; }
        g.fillStyle = `rgba(255,255,255,${a})`; g.fillRect(f.x - 1, f.y - 1, 3, 3);
        g.fillStyle = `rgba(255,255,255,${a * 0.3})`; g.fillRect(f.x - 5, f.y, 11, 1); g.fillRect(f.x, f.y - 5, 1, 11);
        if (f.y > 70) { g.fillStyle = `rgba(255,250,235,${a * 0.08})`; g.fillRect(0, 0, RW, RH); }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === 'Escape' || e.key === ' ') { e.preventDefault(); e.stopImmediatePropagation(); if ((performance.now() - t0.current) / 1000 < WALK) t0.current = performance.now() - WALK * 1000; else onDone(); } };
    window.addEventListener('keydown', k, true); return () => window.removeEventListener('keydown', k, true);
  }, [onDone]);
  const black = t < BLACK, text = `THE ${team.nick.toUpperCase()} HAVE SIGNED ${p.pos} ${p.fn.toUpperCase()} ${p.ln.toUpperCase()}`;
  return (
    <div className="cer" onClick={() => { if (t < WALK) t0.current = performance.now() - WALK * 1000; }}>
      <canvas ref={cv} width={RW} height={RH} />
      {black && <div className="cer-black"><span>Breaking</span><p>{text.slice(0, Math.floor((t / BLACK) * text.length * 1.4))}<i>▌</i></p></div>}
      {t >= WALK + 0.5 && (
        <div className="cer-third" style={{ '--tc': vivid(team.colors[0]) } as React.CSSProperties}>
          <span className="cer-tag">Signed</span>
          <div><b>{p.fn} {p.ln}</b><em>{p.pos} · {p.ovr} OVR · {Math.floor(p.age)} yrs · #{p.num}</em></div>
          <div className="cer-deal"><b>{c.years} yrs</b><em>{money(c.total)}</em></div>
        </div>
      )}
      {t >= WALK + 1.2 && <button className="btn primary cer-go" onClick={onDone}>{left > 0 ? `Next Signing (${left})` : 'Continue'}</button>}
      {t < WALK && !black && <span className="cer-skip">Click or Enter to skip</span>}
      {t >= HOLD + 6 && <AutoClose onDone={onDone} />}
    </div>
  );
}
function AutoClose({ onDone }: { onDone: () => void }) { useEffect(() => { onDone(); }, []); return null; }
