// The league's big nights, staged in the same pixel style as the press room and the
// signing ceremony: a theatre with an LED wall, sweeping spotlights, a podium, a crowd
// and photographers. Two shows run on it:
//  · Draft Day: the commissioner walks to the podium, announces your pick, the wall flips
//    to your colours and the player walks out to hold up his new jersey.
//  · NFL Honors: the regular-season awards, presented one by one, MVP last. Each winner
//    walks out and lifts the trophy.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { app, useApp } from './store';
import { vivid } from './components';
import { pxText, pxWidth, paint } from './field/pixel';
import { coachSprites, lookOf, randomLook, type CoachLook, type CoachSprites } from './coachlook';
import { playerLook, jersey, SHOOTER } from './ceremony';
import { keyLine } from './screens/awards';
import { hash } from '../core/rng';
import { AWARD_NAME } from '../core/season';
import type { League, Player } from '../core/types';

const RW = 160, RH = 90;
const HOST: CoachLook = { skin: 1, hairColor: 4, hair: 'Short', beard: 'None', build: 'Average', head: 'None', glasses: 'Clear', top: 'Suit' };
const TROPHY = ['..GGGGG..', '.GgGGGgG.', '.GgGGGgG.', '..GGGGG..', '...GGG...', '....G....', '....G....', '...GGG...', '..SSSSS..', '..SSSSS..'];

/** The venue behind everything: drawn once per colour scheme. */
function venue(c0: string, c1: string): HTMLCanvasElement {
  const c = document.createElement('canvas'); c.width = RW; c.height = RH;
  const g = c.getContext('2d')!;
  const sky = g.createLinearGradient(0, 0, 0, 60); sky.addColorStop(0, '#04050a'); sky.addColorStop(1, '#10132a');
  g.fillStyle = sky; g.fillRect(0, 0, RW, RH);
  // Lighting truss.
  g.fillStyle = '#20242e'; g.fillRect(0, 1, RW, 2);
  for (let x = 4; x < RW; x += 10) { g.fillStyle = '#3a3f4c'; g.fillRect(x, 3, 3, 2); g.fillStyle = '#fff6d8'; g.fillRect(x + 1, 5, 1, 1); }
  // LED wall frame.
  g.fillStyle = '#2a2f3a'; g.fillRect(29, 7, 102, 40);
  g.fillStyle = '#05060a'; g.fillRect(30, 8, 100, 38);
  // Side pillars.
  for (const x of [8, 138]) { g.fillStyle = '#14171f'; g.fillRect(x, 10, 14, 42); }
  // Stage floor and front.
  const fl = g.createLinearGradient(0, 52, 0, 62); fl.addColorStop(0, '#1e222c'); fl.addColorStop(1, '#101219');
  g.fillStyle = fl; g.fillRect(0, 52, RW, 10);
  g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(0, 52, RW, 1);
  g.fillStyle = '#0a0b10'; g.fillRect(0, 62, RW, 6);
  g.fillStyle = c0; g.fillRect(0, 62, RW, 1); g.fillStyle = c1; g.globalAlpha = 0.5; g.fillRect(0, 64, RW, 1); g.globalAlpha = 1;
  // Crowd: rows of heads, a few in team colours.
  for (let row = 0; row < 4; row++) {
    const y = 69 + row * 5;
    g.fillStyle = ['#0c0e14', '#0e1017', '#11131b', '#13161f'][row]; g.fillRect(0, y - 1, RW, 6);
    for (let x = (row % 2) * 2; x < RW; x += 4) {
      const r = (hash(`th-${x}-${row}`) >>> 0) % 12;
      g.fillStyle = r < 2 ? c0 : r < 3 ? c1 : ['#2a2420', '#3b2b20', '#1c1a1a', '#4a3a2c'][r % 4];
      g.fillRect(x, y + 2, 3, 3);
      g.fillStyle = ['#c9a27e', '#8a5a3a', '#5a3a22', '#e0b896'][(r + row) % 4]; g.fillRect(x + 1, y, 2, 2);
    }
  }
  return c;
}

/** Podium with a shield, drawn over whoever stands behind it. */
function podium(g: CanvasRenderingContext2D, x: number, c0: string) {
  g.fillStyle = '#0d0f15'; g.fillRect(x - 7, 47, 14, 15);
  g.fillStyle = '#262b36'; g.fillRect(x - 8, 46, 16, 2);
  // Shield: white rim, team colour field, a star up top.
  g.fillStyle = '#fff'; g.fillRect(x - 4, 49, 8, 6); g.fillRect(x - 3, 55, 6, 1); g.fillRect(x - 2, 56, 4, 1); g.fillRect(x - 1, 57, 2, 1);
  g.fillStyle = c0; g.fillRect(x - 3, 50, 6, 5); g.fillRect(x - 2, 55, 4, 1); g.fillRect(x - 1, 56, 2, 1);
  g.fillStyle = '#fff'; g.fillRect(x - 1, 51, 2, 1); g.fillRect(x - 2, 52, 4, 1);
  g.fillStyle = '#9aa1ad'; g.fillRect(x - 1, 43, 1, 3); g.fillRect(x - 2, 42, 3, 1);   // mic
}

/** Centred text on the LED wall; drops to a smaller size if it would not fit. */
export function ledText(g: CanvasRenderingContext2D, text: string, y: number, color: string, scale = 1) {
  let s = scale; while (s > 1 && pxWidth(text, s) > 96) s--;
  pxText(g, text, Math.round(80 - pxWidth(text, s) / 2), y, color, s);
}
const clean = (s: string) => s.toUpperCase().replace(/[^A-Z0-9 .·!-]/g, '');

export interface Script {
  black?: { tag: string; text: string };
  /** The LED wall before and after the reveal. */
  ledA: (g: CanvasRenderingContext2D, s: number) => void;
  ledB: (g: CanvasRenderingContext2D, s: number) => void;
  /** Read by the host at the podium, typed out on screen. */
  caption: string;
  star: CoachSprites;
  prop: 'jersey' | 'trophy';
  jersey?: HTMLCanvasElement;
  colors: [string, string];
  third: ReactNode;
  next: string;
  onNext: () => void;
  onSkipAll?: () => void;
}

/** One show on the stage. Remount it (new key) for the next award or pick. */
export function Show({ sc }: { sc: Script }) {
  const cv = useRef<HTMLCanvasElement>(null);
  const [t, setT] = useState(0);
  const t0 = useRef(performance.now());
  const B = sc.black ? 1.3 : 0, WALK = B + 1.3, CAP = WALK + 0.2, CAPLEN = Math.min(2.6, 0.6 + sc.caption.length * 0.025), REVEAL = CAP + CAPLEN + 0.6, IN = REVEAL + 1.2, MEET = IN + 0.6;
  useEffect(() => {
    const g = cv.current!.getContext('2d')!; g.imageSmoothingEnabled = false;
    const [c0, c1] = sc.colors;
    const bg = venue(c0, c1), host = coachSprites(HOST, ['#1d2a4a', '#c9d1e0']);
    const shooters = ['#3a3f4a', '#5a4636', '#2e3542', '#4b3f5a', '#30463c'].map((j, i) => paint(SHOOTER, { H: ['#1b1612', '#3a2a1c', '#6b4a2b', '#2a2a2a', '#8a7a62'][i], J: j, K: '#121418' }));
    const trophy = paint(TROPHY, { G: '#f2c94c', S: '#5a5f6a' });
    const flip = new Map<HTMLCanvasElement, HTMLCanvasElement>();
    const mirror = (s: HTMLCanvasElement) => { let f = flip.get(s); if (!f) { f = document.createElement('canvas'); f.width = s.width; f.height = s.height; const h = f.getContext('2d')!; h.translate(s.width, 0); h.scale(-1, 1); h.drawImage(s, 0, 0); flip.set(s, f); } return f; };
    const legs = (x: number) => { g.fillStyle = '#20242c'; g.fillRect(x - 3, 55, 3, 5); g.fillRect(x + 1, 55, 3, 5); g.fillStyle = '#16181c'; g.fillRect(x - 4, 60, 4, 1); g.fillRect(x + 1, 60, 4, 1); };
    const flashes: { x: number; y: number; at: number }[] = [];
    const ease = (k: number) => 1 - (1 - k) * (1 - k);
    let raf = 0, last = -1;
    const loop = (now: number) => {
      const s = Math.max(0, (now - t0.current) / 1000);
      if (Math.floor(s * 10) !== last) { last = Math.floor(s * 10); setT(s); }
      if (s < B) { g.fillStyle = '#000'; g.fillRect(0, 0, RW, RH); raf = requestAnimationFrame(loop); return; }
      g.drawImage(bg, 0, 0);
      const revealed = s >= REVEAL;
      // LED wall and pillars.
      g.save(); g.beginPath(); g.rect(30, 8, 100, 38); g.clip();
      if (revealed) {
        const k = Math.min(1, (s - REVEAL) / 0.35);
        g.fillStyle = c0; g.fillRect(30, 8, 100, 38);
        g.fillStyle = 'rgba(0,0,0,.25)'; for (let y = 8; y < 46; y += 2) g.fillRect(30, y, 100, 1);
        sc.ledB(g, s - REVEAL);
        if (k < 1) { g.fillStyle = `rgba(255,255,255,${1 - k})`; g.fillRect(30, 8, 100, 38); }
      } else {
        g.fillStyle = '#070912'; g.fillRect(30, 8, 100, 38);
        for (let y = 8; y < 46; y += 2) { g.fillStyle = 'rgba(255,255,255,.025)'; g.fillRect(30, y, 100, 1); }
        sc.ledA(g, s - B);
      }
      g.restore();
      for (const [x, ph] of [[8, 0], [138, 1.7]] as const) for (let y = 10; y < 52; y += 3) {
        const a = 0.35 + 0.35 * Math.sin(s * 3 + y * 0.25 + ph);
        g.globalAlpha = a; g.fillStyle = (y / 3) % 2 < 1 ? c0 : c1; g.fillRect(x + 2, y, 10, 2);
      }
      g.globalAlpha = 1;
      // Spotlights sweep the stage; after the reveal they lock on centre.
      for (const [ox, ph] of [[34, 0], [126, 2.1]] as const) {
        const tx = revealed ? (sc.prop === 'trophy' ? 104 : 80) + (ox < 80 ? -6 : 6) : 80 + Math.sin(s * 0.9 + ph) * 46;
        const grd = g.createLinearGradient(0, 4, 0, 62); grd.addColorStop(0, 'rgba(255,248,220,.16)'); grd.addColorStop(1, 'rgba(255,248,220,.03)');
        g.fillStyle = grd; g.beginPath(); g.moveTo(ox - 1, 4); g.lineTo(ox + 1, 4); g.lineTo(tx + 12, 62); g.lineTo(tx - 12, 62); g.fill();
      }
      // The host: walks to the podium, then (for a draft pick) out to meet the player.
      const hk = Math.min(1, (s - B) / (WALK - B));
      const meet = sc.prop === 'jersey' && s >= IN;
      const hx = meet ? Math.round(40 + 26 * ease(Math.min(1, (s - IN) / (MEET - IN)))) : Math.round(-14 + 54 * ease(hk));
      const hostWalking = hk < 1 || (meet && s < MEET);
      if (hostWalking) g.drawImage(host.walk[Math.floor(s * 7) % 4], hx - 7, 41);
      else { if (meet) legs(hx); g.drawImage(meet ? host.point : host.front, hx - 7, 38); }
      podium(g, 40, c0);
      // The star walks in from the right after the reveal.
      const target = sc.prop === 'jersey' ? 92 : 104;
      if (revealed) {
        const k = Math.min(1, (s - REVEAL) / (IN - REVEAL));
        const sx = Math.round(174 + (target - 174) * ease(k));
        if (k < 1) g.drawImage(mirror(sc.star.walk[Math.floor(s * 7) % 4]), sx - 7, 41);
        else {
          legs(sx); g.drawImage(mirror(sc.star.point), sx - 7, 38);
          if (sc.prop === 'trophy') {
            const lift = Math.min(1, (s - IN) / 0.5);
            g.drawImage(trophy, sx - Math.floor(trophy.width / 2), Math.round(44 - lift * 16));
          } else if (sc.jersey && s >= MEET) {
            const lift = Math.min(1, (s - MEET) / 0.45);
            g.drawImage(sc.jersey, Math.round((hx + sx) / 2 - sc.jersey.width / 2), Math.round(50 - lift * 12));
          }
        }
      }
      // Photographers and flashes; a burst on the reveal.
      const rate = revealed ? (s < REVEAL + 2.5 ? 14 : 5) : 1;
      if (Math.random() < rate / 60) flashes.push({ x: 10 + Math.floor(Math.random() * 5) * 33 + 5, y: 79, at: now });
      if (revealed && Math.random() < rate / 90) flashes.push({ x: 4 + Math.random() * 152, y: 69 + Math.random() * 16, at: now });
      shooters.forEach((sh, i) => g.drawImage(sh, 8 + i * 33, 81 + (i % 2)));
      for (let i = flashes.length - 1; i >= 0; i--) {
        const f = flashes[i], a = 1 - (now - f.at) / 160;
        if (a <= 0) { flashes.splice(i, 1); continue; }
        g.fillStyle = `rgba(255,255,255,${a})`; g.fillRect(f.x - 1, f.y - 1, 3, 3);
        g.fillStyle = `rgba(255,255,255,${a * 0.3})`; g.fillRect(f.x - 5, f.y, 11, 1); g.fillRect(f.x, f.y - 5, 1, 11);
        if (f.y > 76) { g.fillStyle = `rgba(255,250,235,${a * 0.06})`; g.fillRect(0, 0, RW, RH); }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  const skip = () => { if ((performance.now() - t0.current) / 1000 < IN) t0.current = performance.now() - IN * 1000; else sc.onNext(); };
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopImmediatePropagation(); skip(); }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); (sc.onSkipAll ?? sc.onNext)(); }
      else e.stopImmediatePropagation();
    };
    window.addEventListener('keydown', k, true); return () => window.removeEventListener('keydown', k, true);
  });
  const typed = (txt: string, from: number, len: number) => txt.slice(0, Math.max(0, Math.floor(((t - from) / len) * txt.length)));
  return (
    <div className="cer th" onClick={() => { if (t < IN) t0.current = performance.now() - IN * 1000; }}>
      <canvas ref={cv} width={RW} height={RH} />
      {sc.black && t < B && <div className="cer-black"><span>{sc.black.tag}</span><p>{sc.black.text.slice(0, Math.floor((t / B) * sc.black.text.length * 1.4))}<i>▌</i></p></div>}
      {t >= CAP && t < REVEAL + 1.2 && <div className="th-cap"><p>{typed(sc.caption, CAP, CAPLEN)}<i>▌</i></p></div>}
      {t >= IN + 0.2 && <div className="cer-third th-third" style={{ '--tc': sc.colors[0] } as React.CSSProperties}>{sc.third}</div>}
      {t >= IN + 0.6 ? <div className="th-btns">{sc.onSkipAll && <button className="btn ghost" onClick={e => { e.stopPropagation(); sc.onSkipAll!(); }}>Skip all</button>}<button className="btn primary" onClick={e => { e.stopPropagation(); sc.onNext(); }}>{sc.next}</button></div>
        : t >= B && <span className="cer-skip">Click or Enter to skip</span>}
    </div>
  );
}

// ---- Draft Day ----------------------------------------------------------------------------
const ORD = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
export function DraftDay({ L, p, no, round, onDone }: { L: League; p: Player; no: number; round: number; onDone: () => void }) {
  const t = L.teams[p.team] ?? L.teams[L.user];
  const c0 = vivid(t.colors[0]), c1 = t.colors[1] ?? '#ffffff';
  const year = p.draft.year;
  const [sc] = useState<Script>(() => ({
    black: { tag: 'The pick is in', text: `${t.name.toUpperCase()} ARE ON THE CLOCK NO MORE` },
    ledA: (g, s) => { ledText(g, `${year} NFL DRAFT`, 12, '#9fb3ff'); ledText(g, `ROUND ${round}`, 21, '#ffffff'); ledText(g, `PICK ${no}`, 29, s % 1 < 0.6 ? '#ffd34d' : '#ffe9a6', 3); },
    ledB: g => { ledText(g, `THE ${clean(t.nick)} SELECT`, 12, c1.toLowerCase() === c0.toLowerCase() ? '#fff' : c1); ledText(g, clean(p.ln), 21, '#ffffff', 2); ledText(g, `${p.pos} · ${clean(p.col ?? '')}`, 35, '#ffffff'); },
    caption: `With the ${ORD(no)} pick in the ${year} NFL Draft, the ${t.name} select...`,
    star: coachSprites(playerLook(p), t.colors), prop: 'jersey', jersey: jersey(L, p), colors: [c0, c1],
    third: <><span className="cer-tag">Pick {no}</span><div><b>{p.fn} {p.ln}</b><em>{p.pos} · {p.col} · {p.ovr} OVR · {p.dev}</em></div><div className="cer-deal"><b>Rd {round}</b><em>{t.abbr} · #{p.num}</em></div></>,
    next: 'Back to the draft', onNext: onDone,
  }));
  return <Show sc={sc} />;
}

// ---- NFL Honors ----------------------------------------------------------------------------
type HonorKey = 'droy' | 'oroy' | 'dpoy' | 'opoy' | 'coy' | 'mvp';
const HONOR_ORDER: HonorKey[] = ['droy', 'oroy', 'dpoy', 'opoy', 'coy', 'mvp'];
const LED_SHORT: Record<HonorKey, [string, string]> = { droy: ['DEFENSIVE ROOKIE', 'DROY'], oroy: ['OFFENSIVE ROOKIE', 'OROY'], dpoy: ['DEFENSIVE PLAYER', 'DPOY'], opoy: ['OFFENSIVE PLAYER', 'OPOY'], coy: ['COACH OF THE YEAR', 'COY'], mvp: ['MOST VALUABLE PLAYER', 'MVP'] };
const seen = (L: League) => L as League & { honorsSeen?: number };

/** Mounted once in the app: the awards show plays when the playoffs begin. */
export function HonorsNight() {
  const s = useApp();
  const L = s.league;
  const [i, setI] = useState(0);
  const a = L?.awards.find(x => x.season === L.season);
  const busy = ['game', 'presser', 'coachcreate', 'menu', 'load', 'new'].includes(s.screen.id);
  if (!L || !a?.mvp || L.phase !== 'playoffs' || seen(L).honorsSeen === L.season || busy) return null;
  const list = HONOR_ORDER.filter(k => (k === 'coy' ? a.coy : (a as unknown as Record<string, unknown>)[k]));
  const k = list[i];
  const finish = () => { seen(L).honorsSeen = L.season; setI(0); app.touch(); };
  if (!k) { finish(); return null; }
  const next = () => (i + 1 < list.length ? setI(i + 1) : finish());
  return <Honor key={`${L.season}-${k}`} L={L} k={k} onNext={next} onSkipAll={finish} first={i === 0} left={list.length - 1 - i} />;
}

function Honor({ L, k, onNext, onSkipAll, first, left }: { L: League; k: HonorKey; onNext: () => void; onSkipAll: () => void; first: boolean; left: number }) {
  const a = L.awards.find(x => x.season === L.season)!;
  const [sc] = useState<Script>(() => {
    const coach = k === 'coy' ? a.coy! : undefined;
    const p = coach ? undefined : L.players[(a as unknown as Record<string, unknown>)[k] as string];
    const team = L.teams[coach ?? p?.team ?? L.user];
    const c0 = vivid(team.colors[0]), c1 = team.colors[1] ?? '#ffffff';
    const name = coach ? team.coach.name : `${p!.fn} ${p!.ln}`;
    const last = coach ? team.coach.name.split(' ').slice(-1)[0] : p!.ln;
    const look = coach ? (coach === L.user ? lookOf(L) : randomLook(hash(coach) >>> 0)) : playerLook(p!);
    const award = k === 'coy' ? 'Coach of the Year' : AWARD_NAME[k];
    return {
      black: first ? { tag: 'NFL Honors', text: `THE ${L.season} SEASON'S BEST. LIVE.` } : undefined,
      ledA: (g, s) => { ledText(g, `${L.season} NFL HONORS`, 12, '#9fb3ff'); ledText(g, LED_SHORT[k][0], 20, '#ffffff'); ledText(g, LED_SHORT[k][1], 28, s % 1 < 0.6 ? '#ffd34d' : '#ffe9a6', 3); },
      ledB: g => { ledText(g, LED_SHORT[k][1], 12, '#ffd34d'); ledText(g, clean(last), 21, '#ffffff', 2); ledText(g, clean(team.nick), 35, c1.toLowerCase() === c0.toLowerCase() ? '#fff' : c1); },
      caption: `And the ${award} is...`,
      star: coachSprites(look, team.colors), prop: 'trophy', colors: [c0, c1],
      third: <><span className="cer-tag">{LED_SHORT[k][1]}</span><div><b>{name}</b><em>{coach ? `${team.name} · ${L.teams[coach] === L.teams[L.user] ? 'Your staff' : 'Head coach'}` : `${p!.pos} · ${team.name} · ${keyLine(p!, L.season)}`}</em></div><div className="cer-deal"><b>{award}</b><em>{L.season} season</em></div></>,
      next: left > 0 ? `Next award (${left})` : 'Finish', onNext, onSkipAll,
    };
  });
  return <Show sc={sc} />;
}
