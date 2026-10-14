// Install-page play art for the playbook binder. The same play art the game uses, drawn the way a
// staff draws it on paper (circles and letters, routes with arrowheads, T-ended blocks, zigzag
// motion, the primary read in red ink) and run like coaching film: motion, snap, then everyone
// moves along his assignment while the lines draw in. Also the notes a coordinator writes under a
// diagram (progression, the hot throw, what it beats), all derived from the play's own data.
import { useEffect, useMemo, useRef } from 'react';
import { PLAY_ART, DEF_ART, OL_SPOTS, FORMATION, alignFor, snapSpot, type Art, type Align, type Skill } from './playart';
import type { DefCall, DefSet, OffCall, Personnel } from '../sim/game';

type P = [number, number]; // yards: [downfield from the LOS, across (+ = offense's right)]
const HALF = 24; // the view is 48 yards across; its depth is framed to the play

// ---- labels ---------------------------------------------------------------------------------
export const PERS_NOTE: Record<Personnel, string> = { '10': '1 RB · 0 TE · 4 WR', '11': '1 RB · 1 TE · 3 WR', '12': '1 RB · 2 TE · 2 WR', '13': '1 RB · 3 TE · 1 WR', '21': '2 RB · 1 TE · 2 WR', '22': '2 RB · 2 TE · 1 WR' };
/** The letter a staff writes for each spot, by personnel (the slot is a fullback in 21, a second tight end in 12). */
export function skillLabel(w: Skill, pers: Personnel = '11'): string {
  if (w === 'S') return pers === '21' || pers === '22' ? 'F' : pers === '12' || pers === '13' ? 'U' : 'H';
  return w === 'TE' ? 'Y' : w === 'RB' ? 'R' : w === 'QB' ? 'Q' : w;
}
const WHO_NAME: Record<Skill, string> = { X: 'X', Z: 'Z', S: 'Slot', TE: 'Y', RB: 'Back', QB: 'QB' };
const whoName = (w: Skill, pers: Personnel) => (w === 'S' ? (pers === '21' || pers === '22' ? 'F' : pers === '12' || pers === '13' ? 'U' : 'H') : WHO_NAME[w]);

// ---- defensive alignments --------------------------------------------------------------------
interface Dman { id: string; l: string; p: P; dl?: boolean; db?: boolean }
const DL4 = (): Dman[] => [{ id: 'E1', l: 'E', p: [1, -6], dl: true }, { id: 'T1', l: 'T', p: [1, -2], dl: true }, { id: 'T2', l: 'N', p: [1, 1.8], dl: true }, { id: 'E2', l: 'E', p: [1, 6], dl: true }];
export const DEF_ALIGN: Record<DefSet, () => Dman[]> = {
  Nickel: () => [...DL4(), { id: 'W', l: 'W', p: [5, -3.5] }, { id: 'M', l: 'M', p: [5, 2.5] }, { id: 'C1', l: 'C', p: [6, -19], db: true }, { id: 'C2', l: 'C', p: [6, 19], db: true }, { id: 'N', l: 'N', p: [5.5, 11], db: true }, { id: 'SS', l: '$', p: [12, 7], db: true }, { id: 'FS', l: 'F', p: [13, -6], db: true }],
  Base: () => [...DL4(), { id: 'W', l: 'W', p: [5, -4] }, { id: 'M', l: 'M', p: [5.5, 0] }, { id: 'S', l: 'S', p: [4, 6.5] }, { id: 'C1', l: 'C', p: [6, -19], db: true }, { id: 'C2', l: 'C', p: [6, 19], db: true }, { id: 'SS', l: '$', p: [11, 8], db: true }, { id: 'FS', l: 'F', p: [14, -4], db: true }],
  Dime: () => [...DL4(), { id: 'M', l: 'M', p: [6, 0] }, { id: 'C1', l: 'C', p: [6, -19], db: true }, { id: 'C2', l: 'C', p: [6, 19], db: true }, { id: 'N', l: 'N', p: [5.5, 11], db: true }, { id: 'D', l: 'D', p: [6, -10], db: true }, { id: 'SS', l: '$', p: [14, 8], db: true }, { id: 'FS', l: 'F', p: [14, -8], db: true }],
  'Goal Line': () => [{ id: 'E1', l: 'E', p: [1, -7.5], dl: true }, { id: 'T1', l: 'T', p: [1, -4.5], dl: true }, { id: 'T2', l: 'T', p: [1, -1.5], dl: true }, { id: 'T3', l: 'T', p: [1, 1.5], dl: true }, { id: 'T4', l: 'T', p: [1, 4.5], dl: true }, { id: 'E2', l: 'E', p: [1, 7.5], dl: true },
    { id: 'W', l: 'W', p: [3.5, -4] }, { id: 'M', l: 'M', p: [3.5, 0] }, { id: 'S', l: 'S', p: [3.5, 4] }, { id: 'C1', l: 'C', p: [4, -14], db: true }, { id: 'C2', l: 'C', p: [4, 12], db: true }],
};

// ---- the film: actors, legs and lines -----------------------------------------------------------
interface Leg { pts: P[]; t0: number; v: number; follow?: number; off?: P }
interface Actor { id: string; label: string; side: 'o' | 'd'; shape: 'circle' | 'square' | 'letter'; at: P; legs: Leg[]; ghost?: boolean; hi?: boolean }
interface Line { who?: string; pts: P[]; t0: number; v: number; kind: 'route' | 'run' | 'block' | 'motion' | 'man' | 'blitz' | 'drop' | 'rush' | 'fake'; primary?: boolean; read?: number }
interface Zone { c: P; r: number; deep: boolean; t0: number }
export interface Film { actors: Actor[]; lines: Line[]; zones: Zone[]; ball?: { holder: number; throwT?: number; flight?: number; from?: P; to?: P; catcher?: number; handT?: number; carrier?: number }; snap: number; end: number }

const dist = (a: P, b: P) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const plen = (pts: P[]) => pts.reduce((s, p, i) => (i ? s + dist(pts[i - 1], p) : 0), 0);
function along(pts: P[], d: number): P {
  if (pts.length === 1 || d <= 0) return pts[0];
  for (let i = 1; i < pts.length; i++) {
    const l = dist(pts[i - 1], pts[i]);
    if (d <= l) { const k = l ? d / l : 0; return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * k, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * k]; }
    d -= l;
  }
  return pts[pts.length - 1];
}
const legEnd = (g: Leg) => g.t0 + plen(g.pts) / g.v;
function posAt(f: Film, i: number, t: number, depth = 0): P {
  const a = f.actors[i];
  let p = a.at;
  for (const g of a.legs) {
    if (t < g.t0) break;
    if (g.follow !== undefined && depth < 2) {
      // Man coverage: trail the receiver, closing from the alignment over the first second.
      const r = posAt(f, g.follow, t, depth + 1), k = Math.min(1, (t - g.t0) / 1.1);
      const tgt: P = [r[0] + (g.off?.[0] ?? 1.2), r[1] + (g.off?.[1] ?? 0)];
      p = [g.pts[0][0] + (tgt[0] - g.pts[0][0]) * k, g.pts[0][1] + (tgt[1] - g.pts[0][1]) * k];
    } else p = along(g.pts, (t - g.t0) * g.v);
  }
  return p;
}
const BALLV = 24;

/** A skill player's one-point block is relative to him when the point would send him across the formation. */
function blockPts(start: P, a: Art): P[] {
  if (a.pts.length === 1 && a.kind === 'block' && Math.abs(a.pts[0][1] - start[1]) > 8) {
    const [dx, dy] = a.pts[0];
    return [start, [start[0] + dx, start[1] + Math.max(-4, Math.min(4, dy))]];
  }
  return [start, ...a.pts];
}

export function offenseFilm(name: string, call?: OffCall, align?: Align): Film {
  const art = PLAY_ART[name] ?? [];
  const al = align ?? alignFor(name);
  const pers = call?.pers ?? '11';
  const skills: Skill[] = ['X', 'Z', 'S', 'TE', 'RB', 'QB'];
  const actors: Actor[] = [
    ...OL_SPOTS.map((p, i): Actor => ({ id: `OL${i}`, label: '', side: 'o', shape: i === 2 ? 'square' : 'circle', at: p, legs: [] })),
    ...skills.map((w): Actor => ({ id: w, label: skillLabel(w, pers), side: 'o', shape: 'circle', at: al[w], legs: [] })),
  ];
  const idx = (w: string) => actors.findIndex(a => a.id === w);
  const lines: Line[] = [];
  // Pre-snap motion first; the snap comes when the man in motion gets to his spot.
  let snap = 0.45;
  const mover = art.find(a => a.motion?.length && a.who !== 'OL' && a.who !== 'DEF');
  if (mover) {
    const pts: P[] = [al[mover.who as Skill], ...mover.motion!];
    const g: Leg = { pts, t0: 0.3, v: 6.5 };
    actors[idx(mover.who)].legs.push(g);
    lines.push({ who: mover.who, pts, t0: g.t0, v: g.v, kind: 'motion' });
    snap = legEnd(g) + 0.15;
  }
  const pass = call ? call.kind === 'pass' : !art.some(a => a.kind === 'run' && a.primary);
  const olUsed = new Map<number, number>();
  let ol = 0;
  for (const a of art) {
    if (a.who === 'DEF' || a.kind === 'zone') continue;
    let i: number, start: P;
    if (a.who === 'OL') {
      const n = ol++;
      if (n < 5) i = n;
      else { // a puller: the lineman nearest where his path begins leaves his base block
        i = OL_SPOTS.map((p, k) => [dist(p, a.pts[0]), k]).sort((p, q) => p[0] - q[0])[0][1];
        const prev = olUsed.get(i);
        if (prev !== undefined) lines.splice(prev, 1, { ...lines[prev], pts: [] });
      }
      start = OL_SPOTS[i];
    } else { i = idx(a.who); start = snapSpot(a, al); }
    const pts = a.who === 'OL' ? [start, ...a.pts] : blockPts(start, a);
    if (pts.length < 2) continue;
    const kind: Line['kind'] = a.kind === 'run' ? (a.primary === false || (!a.primary && pass) ? 'fake' : 'run') : a.kind === 'block' ? 'block' : 'route';
    const v = kind === 'block' ? (a.who === 'OL' ? (pts.length > 2 ? 5.5 : 2.6) : 4) : kind === 'run' ? 7 : kind === 'fake' ? 4.5 : 8.2;
    const t0 = snap + (kind === 'run' ? (a.who === 'QB' ? 0.1 : 0.3) : kind === 'fake' ? 0.15 : 0.05);
    actors[i].legs = actors[i].legs.filter(g => g.t0 < snap); // motion stays, any base block is replaced
    actors[i].legs.push({ pts, t0, v });
    if (a.who === 'OL') olUsed.set(i, lines.length);
    lines.push({ who: a.who, pts, t0, v, kind, primary: a.primary && kind !== 'fake' });
    if (a.primary) actors[i].hi = true;
  }
  // The quarterback's drop (he is not drawn: coaches leave it implied).
  const qi = idx('QB');
  const qb = actors[qi];
  const under = al.QB[0] > -2;
  const depth = call?.kind === 'pass' ? call.depth : undefined;
  if (!qb.legs.length) {
    const drop = pass ? (depth === 'screen' ? 2.5 : depth === 'quick' ? (under ? 3.5 : 1.5) : depth === 'deep' ? (under ? 7 : 4) : under ? 5 : 2.5) : 0.8;
    const side = (art.find(a => a.who === 'RB' && a.kind === 'run')?.pts[0]?.[1] ?? 0) >= al.QB[1] ? 1 : -1;
    qb.legs.push({ pts: call?.pa || !pass ? [al.QB, [al.QB[0] - 0.6, al.QB[1] + side * 1.2], [al.QB[0] - drop, al.QB[1] + (pass ? side * 0.5 : side * 0.8)]] : [al.QB, [al.QB[0] - drop, al.QB[1]]], t0: snap + 0.05, v: pass ? 4.2 : 3 });
  }
  // Read order: the primary, then his side deep to short, then the backside, the back last.
  const routes = lines.filter(l => l.kind === 'route').map(l => ({ l, who: l.who }));
  if (pass && routes.length) {
    const prim = routes.find(x => x.l.primary) ?? routes[0];
    prim.l.primary = true;
    const side = Math.sign(prim.l.pts[prim.l.pts.length - 1][1]) || 1;
    const deep = (l: Line) => Math.max(...l.pts.map(p => p[0]));
    const rest = routes.filter(x => x !== prim).sort((p, q) => {
      const bp = p.who === 'RB' ? 2 : Math.sign(p.l.pts[p.l.pts.length - 1][1]) === side ? 0 : 1, bq = q.who === 'RB' ? 2 : Math.sign(q.l.pts[q.l.pts.length - 1][1]) === side ? 0 : 1;
      return bp - bq || deep(q.l) - deep(p.l);
    });
    [prim, ...rest].slice(0, 4).forEach((x, n) => (x.l.read = n + 1));
  }
  // The ball: thrown to the primary at the top of his break, or handed to the carrier.
  let ball: Film['ball'] = { holder: qi };
  const end0 = Math.max(snap + 1.5, ...actors.flatMap(a => a.legs.map(legEnd)));
  if (pass) {
    const pl = lines.find(l => l.primary && l.kind === 'route');
    const ci = pl ? actors.findIndex(a => a.legs.some(g => g.pts === pl.pts)) : -1;
    if (pl && ci >= 0) {
      const g = actors[ci].legs.find(x => x.pts === pl.pts)!;
      const brk = pl.pts.length > 2 ? g.t0 + plen(pl.pts.slice(0, 2)) / g.v + 0.1 : g.t0 + (plen(pl.pts) / g.v) * 0.6;
      const minT = snap + (depth === 'screen' ? 0.55 : depth === 'quick' ? 0.75 : depth === 'deep' ? 1.7 : 1.1) + (call?.pa ? 0.45 : 0);
      const throwT = Math.max(brk, minT);
      const tmp: Film = { actors, lines, zones: [], snap, end: end0 };
      const from = posAt(tmp, qi, throwT);
      let to = posAt(tmp, ci, throwT + 0.4), flight = 0.4;
      for (let k = 0; k < 3; k++) { flight = Math.max(0.3, dist(from, to) / BALLV); to = posAt(tmp, ci, throwT + flight); }
      ball = { holder: qi, throwT, flight, from, to, catcher: ci };
    }
  } else {
    const rl = lines.find(l => l.kind === 'run' && l.primary) ?? lines.find(l => l.kind === 'run');
    const ci = rl ? actors.findIndex(a => a.legs.some(g => g.pts === rl.pts)) : -1;
    if (ci >= 0 && ci !== qi) ball = { holder: qi, handT: snap + 0.45, carrier: ci };
    else if (ci === qi) ball = { holder: qi };
  }
  const end = Math.max(end0, (ball.throwT ?? 0) + (ball.flight ?? 0) + 0.6);
  return { actors, lines: lines.filter(l => l.pts.length > 1), zones: [], ball, snap, end: end + 0.5 };
}

export function defenseFilm(name: string, set: DefSet): Film {
  const art = DEF_ART[name] ?? [];
  const actors: Actor[] = [];
  // The offense they line up against: 11 personnel, everybody releasing.
  const stock: Record<Skill, P[]> = { X: [[13, -19]], Z: [[13, 19]], S: [[9, 11], [10, 6]], TE: [[6, 4.5], [7, 9]], RB: [[-4, -3], [1, -8]], QB: [[-7.5, 0]] };
  for (const w of Object.keys(stock) as Skill[]) actors.push({ id: w, label: skillLabel(w), side: 'o', shape: 'circle', at: FORMATION[w], legs: [{ pts: [FORMATION[w], ...stock[w]], t0: 0.55, v: w === 'QB' ? 3.5 : 7 }], ghost: true });
  OL_SPOTS.forEach((p, i) => actors.push({ id: `OL${i}`, label: '', side: 'o', shape: i === 2 ? 'square' : 'circle', at: p, legs: [{ pts: [p, [p[0] - 1.4, p[1]]], t0: 0.55, v: 2 }], ghost: true }));
  const nOff = actors.length;
  const pool = DEF_ALIGN[set]();
  pool.forEach(d => actors.push({ id: `d${d.id}`, label: d.l, side: 'd', shape: 'letter', at: d.p, legs: [] }));
  const free = new Set(pool.map((_, i) => i));
  const di = (k: number) => nOff + k;
  const take = (p: P, ok: (d: Dman) => boolean, w = (d: Dman) => 0 * d.p[0]) => {
    let best = -1, bd = 1e9;
    for (const k of free) { const d = pool[k]; if (!ok(d)) continue; const s = dist(d.p, p) + w(d); if (s < bd) { bd = s; best = k; } }
    if (best >= 0) free.delete(best);
    return best;
  };
  const snap = 0.55;
  const lines: Line[] = [], zones: Zone[] = [];
  for (const a of art.filter(x => x.kind === 'man')) {
    const rec = (Object.keys(FORMATION) as Skill[]).filter(w => w !== 'QB').sort((p, q) => Math.abs(FORMATION[p][1] - a.pts[a.pts.length - 1][1]) - Math.abs(FORMATION[q][1] - a.pts[a.pts.length - 1][1]))[0];
    const k = take(a.pts[0], d => !d.dl);
    if (k < 0) continue;
    const ri = actors.findIndex(x => x.id === rec);
    const p0 = pool[k].p;
    actors[di(k)].legs.push({ pts: [p0], t0: snap, v: 1, follow: ri, off: [1.3, -Math.sign(FORMATION[rec][1] || 1) * 0.6] });
    lines.push({ pts: [p0, [FORMATION[rec][0] + 0.9, FORMATION[rec][1]]], t0: 0.1, v: 30, kind: 'man' });
  }
  for (const a of art.filter(x => x.kind === 'blitz')) {
    const k = take(a.pts[0], d => !d.dl || a.pts[0][0] < 2.5, d => (d.dl ? 3 : 0));
    if (k < 0) continue;
    const p0 = pool[k].p;
    const pts: P[] = dist(p0, a.pts[0]) > 1.5 ? [p0, ...a.pts] : [p0, ...a.pts.slice(1)];
    if (pts.length < 2) continue;
    actors[di(k)].legs.push({ pts, t0: snap, v: 7 });
    actors[di(k)].hi = true;
    lines.push({ pts, t0: snap, v: 7, kind: 'blitz' });
  }
  const zs = art.filter(x => x.kind === 'zone').sort((p, q) => q.pts[0][0] - p.pts[0][0]);
  for (const a of zs) {
    const c = a.pts[0], deep = c[0] >= 12;
    const k = take(c, d => !d.dl, d => (deep && !d.db ? 8 : 0) + (!deep && d.id.startsWith('FS') ? 6 : 0));
    const z: Zone = { c, r: a.r ?? 5, deep, t0: snap + 0.2 };
    if (k >= 0) {
      const p0 = pool[k].p, pts: P[] = [p0, c];
      actors[di(k)].legs.push({ pts, t0: snap, v: deep ? 6.5 : 5.5 });
      if (dist(p0, c) > 1.2) lines.push({ pts, t0: snap, v: deep ? 6.5 : 5.5, kind: 'drop' });
      z.t0 = snap + dist(p0, c) / (deep ? 6.5 : 5.5) * 0.7;
    }
    zones.push(z);
  }
  // Whoever is left: linemen rush, everyone else reads and fills.
  for (const k of free) {
    const d = pool[k];
    if (d.dl) {
      const pts: P[] = [d.p, [-2.6, d.p[1] * 0.55]];
      actors[di(k)].legs.push({ pts, t0: snap, v: 3.2 });
      lines.push({ pts, t0: snap, v: 3.2, kind: 'rush' });
    } else actors[di(k)].legs.push({ pts: [d.p, [d.p[0] - 1, d.p[1] * 0.85]], t0: snap + 0.3, v: 2.5 });
  }
  const end = Math.max(snap + 2.2, ...actors.flatMap(a => a.legs.filter(g => g.follow === undefined).map(legEnd)));
  return { actors, lines, zones, snap, end: end + 0.6, ball: { holder: actors.findIndex(a => a.id === 'QB') } };
}

// ---- drawing -----------------------------------------------------------------------------------
const INK = '#1b1a17', RED = '#c3122f', BLUE = '#2a5fa8', AMBER = '#c98712';
function zig(pts: [number, number][], amp = 3.2, wave = 7): string {
  // A motion line: a sawtooth along the path, ending flat into the snap spot.
  let total = 0; for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  if (total < 1) return '';
  const out: string[] = [`M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`];
  let d = 0, n = 0;
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1], [bx, by] = pts[i], l = Math.hypot(bx - ax, by - ay);
    if (!l) continue;
    const ux = (bx - ax) / l, uy = (by - ay) / l;
    for (let s = wave / 2 - (d % (wave / 2)); s < l; s += wave / 2) {
      if (d + s > total - wave * 0.6) break;
      const sgn = n++ % 2 ? -1 : 1;
      out.push(`L${(ax + ux * s - uy * amp * sgn).toFixed(1)},${(ay + uy * s + ux * amp * sgn).toFixed(1)}`);
    }
    d += l;
  }
  const e = pts[pts.length - 1];
  out.push(`L${e[0].toFixed(1)},${e[1].toFixed(1)}`);
  return out.join(' ');
}
function partial(pts: [number, number][], len: number): [number, number][] {
  if (len <= 0) return [pts[0]];
  const out: [number, number][] = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (len >= l) { out.push(pts[i]); len -= l; continue; }
    const k = l ? len / l : 0;
    out.push([pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * k, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * k]);
    break;
  }
  return out;
}
const dstr = (pts: [number, number][]) => (pts.length < 2 ? '' : pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' '));
function tee(pts: [number, number][], w = 6): string {
  if (pts.length < 2) return '';
  const [ax, ay] = pts[pts.length - 2], [bx, by] = pts[pts.length - 1], l = Math.hypot(bx - ax, by - ay) || 1;
  const nx = -(by - ay) / l * w, ny = (bx - ax) / l * w;
  return `M${(bx + nx).toFixed(1)},${(by + ny).toFixed(1)} L${(bx - nx).toFixed(1)},${(by - ny).toFixed(1)}`;
}

let uid = 0;
/**
 * The play on paper. `active` runs the film when it turns on (and again whenever `run` changes);
 * otherwise the page shows the finished drawing. Only pages on screen should be active.
 */
export function PlaySheetArt({ name, def, set, call, align, w = 480, active = false, run = 0, ghost = true, onFilm }: { name: string; def?: boolean; set?: DefSet; call?: OffCall; align?: Align; w?: number; active?: boolean; run?: number; ghost?: boolean; onFilm?: (playing: boolean) => void }) {
  const film = useMemo(() => (def ? defenseFilm(name, set ?? 'Nickel') : offenseFilm(name, call, align)), [name, def, set, call, align]);
  // Frame the depth to the play: from behind the deepest back to just past the deepest route.
  const [X0, X1] = useMemo(() => {
    let lo = -7.4, hi = def ? 16 : ghost ? 14.5 : 6;
    for (const a of film.actors) for (const p of [a.at, ...a.legs.flatMap(g => g.pts)]) { lo = Math.min(lo, p[0] - 1.1); hi = Math.max(hi, p[0] + 2); }
    for (const z of film.zones) hi = Math.max(hi, z.c[0] + z.r * 0.55 + 1);
    return [lo, Math.min(29, Math.max(hi, lo + 17))];
  }, [film, def, ghost]);
  const S = w / (HALF * 2), H = Math.round((X1 - X0) * S);
  const sp = (p: P): [number, number] => [(p[1] + HALF) * S, (X1 - p[0]) * S];
  const id = useMemo(() => `ps${++uid}`, []);
  const lineGeo = useMemo(() => film.lines.map(l => { const pts = l.pts.map(sp); let len = 0; for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return { pts, len }; }), [film, w, X1]);
  const lineRefs = useRef<(SVGPathElement | null)[]>([]);
  const teeRefs = useRef<(SVGPathElement | null)[]>([]);
  const readRefs = useRef<(SVGGElement | null)[]>([]);
  const zoneRefs = useRef<(SVGGElement | null)[]>([]);
  const tokRefs = useRef<(SVGGElement | null)[]>([]);
  const ballRef = useRef<SVGGElement | null>(null);
  const arcRef = useRef<SVGPathElement | null>(null);
  const clockRef = useRef<SVGTextElement | null>(null);
  const rootRef = useRef<SVGSVGElement | null>(null);

  // Line i drawn to length `len` (px), with its arrowhead or block T at the tip.
  const drawLine = (i: number, len: number) => {
    const el = lineRefs.current[i], g = lineGeo[i], l = film.lines[i];
    if (!el) return;
    const pts = len >= g.len ? g.pts : partial(g.pts, len);
    el.setAttribute('d', l.kind === 'motion' ? zig(pts) : dstr(pts));
    const t = teeRefs.current[i];
    if (t) t.setAttribute('d', len > 2 ? tee(pts) : '');
  };
  const place = (i: number, p: P) => { const el = tokRefs.current[i]; if (el) { const [x, y] = sp(p); el.setAttribute('transform', `translate(${x.toFixed(1)},${y.toFixed(1)})`); } };
  const finished = () => {
    film.lines.forEach((_, i) => drawLine(i, 1e9));
    film.actors.forEach((a, i) => place(i, a.at));
    readRefs.current.forEach(r => r && (r.style.opacity = '1'));
    zoneRefs.current.forEach(z => z && (z.style.opacity = '1', z.style.transform = 'scale(1)'));
    if (ballRef.current) ballRef.current.style.opacity = '0';
    if (arcRef.current) arcRef.current.setAttribute('d', '');
    if (clockRef.current) clockRef.current.textContent = '';
    rootRef.current?.classList.remove('filming');
  };

  useEffect(() => {
    if (!active) { finished(); return; }
    let raf = 0, t0 = 0;
    const holder = film.ball?.holder ?? -1;
    rootRef.current?.classList.add('filming');
    onFilm?.(true);
    const frame = (now: number) => {
      if (!t0) t0 = now;
      const t = (now - t0) / 1000;
      film.lines.forEach((l, i) => {
        const g = lineGeo[i];
        const len = l.kind === 'man' ? (t > 0.1 ? g.len : 0) : Math.max(0, (t - l.t0) * l.v * S);
        drawLine(i, len);
        const r = readRefs.current[i];
        if (r) r.style.opacity = len >= g.len && t > film.snap + 0.5 ? '1' : '0';
      });
      film.zones.forEach((z, i) => { const el = zoneRefs.current[i]; if (!el) return; const k = Math.max(0, Math.min(1, (t - z.t0) / 0.6)); el.style.opacity = String(k); el.style.transform = `scale(${0.4 + 0.6 * k})`; });
      film.actors.forEach((_, i) => place(i, posAt(film, i, t)));
      const b = film.ball, be = ballRef.current;
      if (b && be && holder >= 0) {
        let p: P;
        let h = 0;
        if (b.throwT !== undefined && t >= b.throwT) {
          const k = Math.min(1, (t - b.throwT) / (b.flight ?? 0.4));
          if (k < 1) { p = [b.from![0] + (b.to![0] - b.from![0]) * k, b.from![1] + (b.to![1] - b.from![1]) * k]; h = Math.sin(Math.PI * k) * Math.min(14, dist(b.from!, b.to!) * 0.45); }
          else p = posAt(film, b.catcher!, t);
          if (arcRef.current) {
            const n = 16, pts: [number, number][] = [];
            for (let j = 0; j <= n * k; j++) { const kk = j / n; const q: P = [b.from![0] + (b.to![0] - b.from![0]) * kk, b.from![1] + (b.to![1] - b.from![1]) * kk]; const [x, y] = sp(q); pts.push([x, y - Math.sin(Math.PI * kk) * Math.min(14, dist(b.from!, b.to!) * 0.45) * S * 0.35]); }
            arcRef.current.setAttribute('d', dstr(pts));
          }
        } else if (b.handT !== undefined && t >= b.handT) p = posAt(film, b.carrier!, t);
        else p = posAt(film, holder, t);
        const [x, y] = sp(p);
        be.setAttribute('transform', `translate(${(x + 5).toFixed(1)},${(y - 4 - h * S * 0.35).toFixed(1)})`);
        be.style.opacity = t > film.snap - 0.1 ? '1' : '0';
      }
      if (clockRef.current) clockRef.current.textContent = t < film.snap ? (film.snap > 0.8 ? 'MOTION' : 'SET') : `${(t - film.snap).toFixed(1)}s`;
      if (t < film.end) raf = requestAnimationFrame(frame);
      else { finished(); onFilm?.(false); }
    };
    // Start with a clean sheet: no lines, everybody on his spot.
    film.lines.forEach((_, i) => drawLine(i, 0));
    readRefs.current.forEach(r => r && (r.style.opacity = '0'));
    zoneRefs.current.forEach(z => z && (z.style.opacity = '0'));
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); onFilm?.(false); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, run, film, w]);

  const yl = [-5, 0, 5, 10, 15, 20, 25].filter(d => d > X0 && d < X1);
  const color = (l: Line) => (l.kind === 'blitz' ? RED : l.primary ? RED : l.kind === 'drop' ? BLUE : l.kind === 'man' ? '#6f6a5f' : l.kind === 'fake' ? '#6f6a5f' : INK);
  const mark = (l: Line) => (l.kind === 'block' || l.kind === 'man' ? undefined : `url(#${id}-${l.kind === 'blitz' || l.primary ? 'r' : l.kind === 'drop' ? 'b' : l.kind === 'motion' ? '' : 'k'})`);
  const ghostDef = !def && ghost ? DEF_ALIGN.Nickel() : [];
  return (
    <svg ref={rootRef} className="ps-art" viewBox={`0 0 ${w} ${H}`} width="100%" role="img" aria-label={`${name} diagram`}>
      <defs>
        {(['k', 'r', 'b'] as const).map(k => (
          <marker key={k} id={`${id}-${k}`} markerWidth="9" markerHeight="9" refX="7.4" refY="4.5" orient="auto" markerUnits="userSpaceOnUse">
            <path d="M0.5,0.8 L8.2,4.5 L0.5,8.2 Z" fill={k === 'r' ? RED : k === 'b' ? BLUE : INK} />
          </marker>
        ))}
        <pattern id={`${id}-hb`} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(40)"><line x1="0" y1="0" x2="0" y2="5" stroke={BLUE} strokeWidth="1" opacity=".38" /></pattern>
        <pattern id={`${id}-ha`} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(-40)"><line x1="0" y1="0" x2="0" y2="5" stroke={AMBER} strokeWidth="1" opacity=".42" /></pattern>
      </defs>
      {/* the field, faint: yard lines, hash ticks, the line of scrimmage */}
      {yl.map(d => { const y = (X1 - d) * S; return <g key={d}><line x1={0} x2={w} y1={y} y2={y} className={d === 0 ? 'ps-los' : 'ps-yd'} />{d > 0 && <text x={4} y={y - 3} className="ps-ydn">+{d}</text>}</g>; })}
      {Array.from({ length: 40 }, (_, i) => Math.ceil(X0) + i).filter(d => d % 5 && d < X1).map(d => { const y = (X1 - d) * S; return <g key={d} className="ps-hash"><line x1={(HALF - 3.1) * S - 3} x2={(HALF - 3.1) * S + 3} y1={y} y2={y} /><line x1={(HALF + 3.1) * S - 3} x2={(HALF + 3.1) * S + 3} y1={y} y2={y} /></g>; })}
      {/* zones */}
      {film.zones.map((z, i) => { const [cx, cy] = sp(z.c); return (
        <g key={`z${i}`} ref={el => { zoneRefs.current[i] = el; }} className="ps-zone" style={{ transformOrigin: `${cx}px ${cy}px` }}>
          <ellipse cx={cx} cy={cy} rx={z.r * S * 0.92} ry={z.r * S * 0.52} fill={`url(#${id}-${z.deep ? 'hb' : 'ha'})`} stroke={z.deep ? BLUE : AMBER} strokeWidth="1.3" strokeDasharray={z.deep ? undefined : '4 3'} />
        </g>
      ); })}
      {/* the ghost defense on offensive pages */}
      {ghostDef.map(d => { const [x, y] = sp(d.p); return <text key={d.id} x={x} y={y + 4} className="ps-ghostd">{d.l}</text>; })}
      {/* assignments */}
      {film.lines.map((l, i) => (
        <g key={`l${i}`}>
          <path ref={el => { lineRefs.current[i] = el; }} d={l.kind === 'motion' ? zig(lineGeo[i].pts) : dstr(lineGeo[i].pts)} fill="none" stroke={color(l)}
            strokeWidth={l.primary ? 2.6 : l.kind === 'block' && l.pts.length < 3 ? 1.6 : l.kind === 'run' ? 2.4 : 1.8} strokeLinejoin="round" strokeLinecap="round"
            strokeDasharray={l.kind === 'man' ? '2 4' : l.kind === 'fake' ? '5 4' : l.kind === 'drop' ? '6 4' : undefined} markerEnd={mark(l)} />
          {l.kind === 'block' && <path ref={el => { teeRefs.current[i] = el; }} d={tee(lineGeo[i].pts)} stroke={INK} strokeWidth="2" strokeLinecap="round" />}
        </g>
      ))}
      {/* players */}
      {film.actors.map((a, i) => { const [x, y] = sp(a.at); const r = S * 0.82; return (
        <g key={a.id} ref={el => { tokRefs.current[i] = el; }} transform={`translate(${x.toFixed(1)},${y.toFixed(1)})`} className={`ps-tok ${a.side}${a.ghost ? ' ghost' : ''}${a.hi ? ' hi' : ''}`}>
          {a.shape === 'letter' ? <text y={4.5} className="ps-dl">{a.label}</text>
            : a.shape === 'square' ? <rect x={-r} y={-r} width={r * 2} height={r * 2} />
            : <><circle r={r} />{a.label && <text y={3.2} className="ps-ol">{a.label}</text>}</>}
        </g>
      ); })}
      {/* read numbers at the route ends */}
      {film.lines.map((l, i) => { if (!l.read) return null; const e = lineGeo[i].pts[lineGeo[i].pts.length - 1]; const s = lineGeo[i].pts[lineGeo[i].pts.length - 2]; const ux = e[0] - s[0], uy = e[1] - s[1], ul = Math.hypot(ux, uy) || 1; const x = e[0] + (ux / ul) * 11, y = e[1] + (uy / ul) * 11;
        return <g key={`r${i}`} ref={el => { readRefs.current[i] = el; }} className={`ps-read${l.read === 1 ? ' one' : ''}`} transform={`translate(${Math.max(9, Math.min(w - 9, x)).toFixed(1)},${Math.max(9, Math.min(H - 9, y)).toFixed(1)})`}><circle r="7" /><text y="3.4">{l.read}</text></g>; })}
      <path ref={arcRef} className="ps-arc" d="" />
      <g ref={ballRef} className="ps-ball" style={{ opacity: 0 }}><ellipse rx="4.4" ry="2.7" transform="rotate(-30)" /><line x1="-1.6" x2="1.6" y1="0" y2="0" transform="rotate(-30)" /></g>
      <text ref={clockRef} x={w - 6} y={14} className="ps-clock" />
    </svg>
  );
}

// ---- route names and notes ----------------------------------------------------------------------
export function routeName(who: Skill, start: P, pts: P[]): string {
  if (!pts.length) return 'Stay';
  const inward = start[1] === 0 ? (pts[pts.length - 1][1] >= 0 ? 1 : -1) : -Math.sign(start[1]);
  const rel = (p: P): P => [p[0] - start[0], (p[1] - start[1]) * inward]; // [depth, inside]
  const e = rel(pts[pts.length - 1]);
  const back = who === 'RB' || who === 'QB' || start[0] < -1.5;
  if (pts.length === 1) {
    const [d, i] = e;
    if (back) return d < 0 ? 'Swing' : Math.abs(i) > d ? (i > 0 ? 'Angle' : 'Flare') : d > 10 ? 'Seam' : 'Check-release';
    if (d >= 15) return Math.abs(i) < 6 ? (Math.abs(start[1]) < 12 ? 'Seam' : 'Go') : i > 0 ? 'Post' : 'Fade';
    if (d < 0) return 'Bubble';
    if (d <= 3) return Math.abs(i) < 2 ? 'Hitch' : i > 0 ? 'Drag' : 'Flat';
    return i > 3 ? 'Slant' : i < -3 ? 'Arrow' : 'Stick';
  }
  const b = rel(pts[0]), d0 = b[0] - 0, v: P = [e[0] - b[0], e[1] - b[1]];
  if (back) {
    if (pts.length >= 2 && b[0] < 0 && e[0] > 8) return 'Wheel';
    if (b[0] < 0) return 'Swing';
    return v[1] > 0 ? 'Angle' : 'Flat';
  }
  if (pts.length >= 3) {
    const m = rel(pts[1]);
    if (m[1] < b[1] && e[1] > m[1] && e[0] > m[0]) return 'Corner-post';
    if (m[1] > b[1] && e[1] < m[1]) return 'Sluggo';
    if (b[1] > 1 && v[1] < 0) return 'Option';
  }
  if (b[0] < 0) return d0 < 0 && v[0] > 4 ? 'Wheel' : 'Bubble';
  if (v[0] < -0.5) return b[0] >= 9 ? (v[1] < -1 ? 'Comeback' : 'Curl') : 'Hitch';
  if (Math.abs(v[1]) > Math.abs(v[0]) * 1.6) {
    if (v[1] > 0) return b[0] <= 4 ? (Math.abs(v[1]) > 8 ? 'Shallow cross' : 'Drag') : b[0] <= 9 ? 'In' : 'Dig';
    return b[0] <= 3 ? 'Flat' : b[0] <= 8 ? 'Quick out' : b[0] >= 11 ? 'Deep out' : 'Out';
  }
  if (v[0] > 3 && Math.abs(v[1]) > 2) return v[1] > 0 ? (b[0] <= 4 ? 'Slant' : 'Post') : 'Corner';
  if (v[0] > 3) return b[0] >= 12 ? 'Go' : 'Seam';
  if (b[1] > 3 && v[1] < 0) return 'Whip';
  return v[1] > 0 ? 'Sit' : 'Out';
}

export interface Note { h: string; t: string }
export interface Sheet { kind: string; reads: { n: number; who: string; route: string; primary?: boolean }[]; assign: { who: string; job: string }[]; notes: Note[]; protection?: string }

const GAP = (y: number) => { const a = Math.abs(y); return a < 1.2 ? 'A gap' : a < 3.2 ? 'B gap' : a < 5.5 ? 'C gap' : 'the edge'; };
export function offenseSheet(name: string, call: OffCall | undefined, desc: string): Sheet {
  const art = PLAY_ART[name] ?? [];
  const al: Align = alignFor(name);
  const pers = call?.pers ?? '11';
  const film = offenseFilm(name, call);
  const pass = call ? call.kind === 'pass' : !art.some(a => a.kind === 'run' && a.primary);
  const notes: Note[] = [];
  const skillArt = art.filter(a => a.who !== 'OL' && a.who !== 'DEF') as (Art & { who: Skill })[];
  const routes = skillArt.filter(a => a.kind === 'route' && a.pts.length).map(a => {
    const st = snapSpot(a, al), line = film.lines.find(l => l.who === a.who && l.kind === 'route');
    return { a, who: a.who, st, name: routeName(a.who, st, a.pts), read: line?.read, end: a.pts[a.pts.length - 1], deep: Math.max(...a.pts.map(p => p[0])) };
  });
  const blockers = skillArt.filter(a => a.kind === 'block').map(a => a.who);
  const mover = skillArt.find(a => a.motion?.length);
  const reads = routes.filter(r => r.read).sort((p, q) => p.read! - q.read!).map(r => ({ n: r.read!, who: whoName(r.who, pers), route: r.name, primary: r.read === 1 }));
  const assign: Sheet['assign'] = [];
  for (const r of routes.filter(r => !r.read)) assign.push({ who: whoName(r.who, pers), job: r.name });
  for (const b of blockers) assign.push({ who: whoName(b, pers), job: pass ? (b === 'RB' || b === 'S' && al.S[0] < -1 ? 'Pass pro, check-release' : 'Block') : 'Block' });
  const kindLabel = !call ? (pass ? 'Pass' : 'Run') : call.kind === 'run' ? `Run · ${call.run === 'qb' ? 'QB run' : call.run === 'outside' ? 'Outside' : 'Inside'}` : `${call.pa ? 'Play-action' : call.depth === 'screen' ? 'Screen' : 'Dropback'} · ${call.depth === 'quick' ? 'Quick game' : call.depth === 'short' ? 'Short' : call.depth === 'medium' ? 'Intermediate' : call.depth === 'deep' ? 'Shot play' : 'Screen'}`;
  if (mover) notes.push({ h: 'Motion', t: `${whoName(mover.who, pers)} ${mover.motion!.some(p => Math.abs(p[1] - al[mover.who][1]) > 10) ? 'in jet motion across the formation' : 'in short motion'}; snap it when he hits his landmark.` });
  let protection: string | undefined;
  if (pass) {
    const n = 5 + blockers.filter(b => b === 'RB' || b === 'TE' || b === 'S').length;
    protection = n >= 7 ? `Max protect (${n}-man)` : `${n}-man protection`;
    const quick = [...routes].filter(r => r.deep <= 6 && r.who !== 'RB').sort((p, q) => p.deep - q.deep)[0];
    const seam = routes.filter(r => r.deep >= 15 && Math.abs(r.end[1]) < 12);
    const outside = routes.filter(r => r.deep >= 14 && Math.abs(r.end[1]) >= 12);
    const corner = routes.find(r => r.name === 'Corner' || r.name === 'Corner-post');
    const cross = routes.filter(r => Math.sign(r.st[1]) !== Math.sign(r.end[1]) && r.deep <= 14 && r.who !== 'RB');
    const flat = routes.find(r => r.deep <= 4 && Math.abs(r.end[1]) >= 10);
    const curl = routes.find(r => ['Curl', 'Hitch', 'Comeback', 'Stick', 'Sit'].includes(r.name));
    const prim = routes.find(r => r.read === 1);
    const side = (r?: { end: P }) => (r ? (r.end[1] >= 0 ? 'right' : 'left') : '');
    if (call?.depth === 'screen') {
      notes.push({ h: 'Timing', t: `Let the rush get upfield. Linemen sell pass for a two count, then release to the ${prim ? side(prim) : 'call'} side and lead.` });
      notes.push({ h: 'Best vs', t: 'Pressure and soft zone with linebackers dropping; a 2-high shell leaves the second level empty.' });
      notes.push({ h: 'Kill it', t: 'If a linebacker or corner is already sitting in the screen lane, throw it away or check to a run.' });
    } else {
      notes.push({ h: 'vs Cover 2', t: corner ? `Hole shot: the ${whoName(corner.who, pers)} ${corner.name.toLowerCase()} between the squat corner and the half-field safety.` : seam.length ? `Split the safeties with the ${whoName(seam[0].who, pers)} ${seam[0].name.toLowerCase()}: the deep middle is open.` : cross.length ? `The ${whoName(cross[0].who, pers)} ${cross[0].name.toLowerCase()} settles in the void behind the linebackers.` : `Corners squat: take the ${prim ? prim.name.toLowerCase() : 'first read'} only if the hook defender widens.` });
      notes.push({ h: 'vs Cover 3', t: seam.length >= 2 ? 'Two seams against one middle safety: hold him with your eyes, throw away from him.' : curl && flat ? `Curl-flat read: throw opposite the flat defender. He jumps the ${flat.name.toLowerCase()}, hit the ${curl.name.toLowerCase()}.` : outside.length && routes.some(r => r.deep >= 9 && r.deep <= 13 && Math.abs(r.end[1]) >= 10) ? 'Flood the deep third: the corner can only take one of the top two.' : 'Four under means windows at 12-15 yards in the seams; stay on rhythm.' });
      notes.push({ h: 'vs Man', t: cross.length >= 2 ? 'The crossers rub man coverage: the defenders trail through traffic. Lead the receiver away from his man.' : cross.length ? `Ride the ${whoName(cross[0].who, pers)} across the field; he runs away from his man.` : outside.length ? `Back-shoulder the ${whoName(outside[0].who, pers)} if the corner presses and turns his hips.` : 'Win with leverage: throw to the receiver opposite the defender\'s alignment.' });
      notes.push({ h: 'Hot', t: quick ? `Six-man pressure: ${whoName(quick.who, pers)} on the ${quick.name.toLowerCase()} is the hot throw. Ball out on the third step.` : protection.startsWith('Max') ? 'Max protect: no hot. Climb the pocket and give the shot time to develop.' : 'No built-in hot: slide the protection to the pressure and use the back as the outlet.' });
    }
    if (call?.pa) notes.push({ h: 'Play-action', t: 'Sell the run with your shoulders. Linemen show a run-block helmet level; the linebackers must step up before the ball goes over them.' });
  } else {
    const carrier = skillArt.find(a => a.kind === 'run' && a.primary) ?? skillArt.find(a => a.kind === 'run');
    const end = carrier?.pts[carrier.pts.length - 1] ?? [5, 0];
    const turn = carrier?.pts.length && carrier.pts.length > 1 ? carrier.pts[carrier.pts.length - 2] : end;
    const aim = Math.abs(turn[1]) > Math.abs(end[1]) + 2 ? turn : end;
    const side = aim[1] >= 0 ? 'right' : 'left';
    const olArt = art.filter(a => a.who === 'OL');
    const pull = olArt.length > 5;
    const zone = !pull && olArt.length && Math.abs((olArt[0].pts[0][1] - OL_SPOTS[0][1])) >= 1;
    const scheme = pull ? 'Gap scheme with a puller' : zone ? `Zone: everyone steps ${side}` : 'Man scheme: block the man on you';
    const counter = carrier && carrier.pts.length > 2 && Math.sign(carrier.pts[0][1]) !== Math.sign(end[1]) && Math.abs(carrier.pts[0][1]) > 1.5;
    notes.push({ h: 'Point of attack', t: `${GAP(aim[1])} ${aim[1] === 0 ? '' : side}`.trim() + `${carrier ? ` · ${whoName(carrier.who as Skill, pers)} carries` : ''}${counter ? ' (counter step first)' : ''}.` });
    notes.push({ h: 'Blocking', t: `${scheme}.${blockers.length ? ` ${blockers.map(b => whoName(b, pers)).join(', ')} ${blockers.length > 1 ? 'block' : 'blocks'} at the second level.` : ''}` });
    notes.push({ h: 'Read', t: call?.run === 'qb' && carrier?.who === 'QB' && skillArt.some(a => a.kind === 'run' && a.who === 'RB') ? `Read the ${side === 'right' ? 'left' : 'right'} end: he crashes, keep it; he sits, give.` : call?.run === 'outside' ? 'Press the edge. If the end gets reached, bounce it; if he widens, plant and cut up inside the tackle.' : 'Press the hole, one cut and get downhill. Read the first down lineman past the center.' });
    notes.push({ h: 'Best vs', t: call?.run === 'outside' ? 'Light boxes and slanting fronts; the nickel or dime on the edge.' : 'Six-man boxes (nickel and dime); avoid running into eight in the box.' });
  }
  return { kind: kindLabel, reads, assign, notes: notes.slice(0, 5), protection };
}

const SHELL: Record<DefCall['shell'], { strong: string; weak: string; deep: string }> = {
  'Cover 0': { strong: 'Everybody comes: beats five-man protection and slow-developing routes.', weak: 'No deep help: any win outside goes the distance. Quick throws and screens hurt it.', deep: 'No deep safety' },
  'Cover 1': { strong: 'Tight man with a free safety over the top and a robber for crossers and the run.', weak: 'Rubs, mesh and crossers; a running quarterback against turned backs.', deep: 'Single-high free safety' },
  'Cover 2': { strong: 'Flats, quick outs and deep outside routes; corners funnel everything inside.', weak: 'Seams and the hole at 18-22 yards between the corner and the safety; the deep middle.', deep: 'Two-high, each safety a deep half' },
  'Cover 3': { strong: 'Deep outside thirds and the run with a safety in the box.', weak: 'Curl-flat throws, floods to one side, and four verticals against the middle safety.', deep: 'Three deep thirds' },
  'Cover 4': { strong: 'Verticals and deep in-breakers; safeties fit the run fast off the #2 read.', weak: 'Flats and quick outs underneath; the corner has no help on outside double moves.', deep: 'Four deep quarters' },
  Prevent: { strong: 'Nothing gets over the top.', weak: 'Anything underneath and runs; keep the clock in mind.', deep: 'Four-plus deep' },
};
export function defenseSheet(name: string, call: DefCall, set: DefSet, desc: string): Sheet {
  const film = defenseFilm(name, set);
  const nOff = film.actors.findIndex(a => a.side === 'd');
  const defs = film.actors.slice(nOff);
  const rushers = film.lines.filter(l => l.kind === 'rush' || l.kind === 'blitz').length;
  const assign: Sheet['assign'] = [];
  const DBN: Record<string, string> = { C: 'Corner', N: 'Nickel', D: 'Dime', $: 'Strong safety', F: 'Free safety', M: 'Mike', W: 'Will', S: 'Sam', E: 'End', T: 'Tackle' };
  const zoneName = (p: P) => (p[0] >= 12 ? (Math.abs(p[1]) < 5 ? 'deep middle' : `deep ${p[1] < 0 ? 'left' : 'right'}`) : Math.abs(p[1]) >= 12 ? `flat ${p[1] < 0 ? 'left' : 'right'}` : Math.abs(p[1]) >= 5 ? `curl ${p[1] < 0 ? 'left' : 'right'}` : 'hook');
  defs.forEach(d => {
    const g = d.legs[0];
    if (!g) return;
    const lab = DBN[d.label] ?? d.label;
    if (g.follow !== undefined) assign.push({ who: `${d.label} · ${lab}`, job: `Man on ${film.actors[g.follow].label}` });
    else if (d.hi) assign.push({ who: `${d.label} · ${lab}`, job: `Blitz ${GAP(g.pts[g.pts.length - 1][1])}` });
    else if (film.lines.some(l => l.kind === 'drop' && l.pts === g.pts) || film.zones.some(z => z.c === g.pts[g.pts.length - 1])) assign.push({ who: `${d.label} · ${lab}`, job: `Zone: ${zoneName(g.pts[g.pts.length - 1])}` });
  });
  const sh = SHELL[call.shell];
  const deep = film.zones.filter(z => z.deep).length;
  const notes: Note[] = [
    { h: 'Shell', t: `${sh.deep}. ${rushers} rush, ${11 - rushers} cover${deep ? `, ${deep} deep` : ''}${call.box ? ` · ${call.box} in the box` : ''}.` },
    { h: 'Strong vs', t: sh.strong },
    { h: 'Weak vs', t: sh.weak },
  ];
  if (call.blitz) notes.push({ h: 'Pressure', t: `${rushers} rushers. The hot throw is there against it: disguise until the snap count, then go.` });
  else notes.push({ h: 'Disguise', t: deep >= 2 ? 'Show two-high, keep the depth until the quarterback looks down.' : 'Start in a two-high look and rotate late to the shell.' });
  return { kind: `${call.shell}${call.blitz ? ' · Pressure' : ''}`, reads: [], assign: assign.slice(0, 8), notes };
}
