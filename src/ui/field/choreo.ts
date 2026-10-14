// Choreography: turns a simulated play (who is where, when the ball moves) into what each
// player is doing frame by frame. The scene says where bodies go; this decides how they
// look getting there: stances, the walk up from the huddle, the drop and the throw, the
// kind of catch (a layout, a high-point, one hand, a toe-tap on the sideline), jukes and
// spins with the defender whiffing, stiff-arms, wrap-ups and big hits, the fall to the
// turf and the get-up, the pocket caving in on a sack, and the celebrations after: the
// first-down point, touchdown spikes, dances, flexes and the team mobbing the scorer.
// Everything is deterministic for a play (seeded by its number), so replays match.
import type { PlayEvent } from '../../sim/game';
import type { Scene } from './scene';
import type { Frame } from './pixel';

export const MID = 26.65, FW = 53.3;
export interface Pose { x: number; y: number; f: Frame; face: 1 | -1; rot: number; lift: number; ref?: boolean }
export interface BallState { x: number; y: number; h: number; free: boolean; kick: boolean }
export interface Fx { at: number; kind: 'dust' | 'turf' | 'impact' | 'td' | 'first' | 'sack' | 'turnover' | 'catch' | 'whiff' | 'flag'; x: number; y: number; big?: boolean }
export type Celebration = 'spike' | 'jump' | 'flex' | 'dance' | 'pray' | 'point' | 'none';
export interface Choreo {
  /** Seconds of walk-up before the snap, the play itself, and the after-play. */
  WU: number; DUR: number; POST: number;
  pose(i: number, c: number): Pose;
  refs(c: number): Pose[];
  ball(c: number): BallState | null;
  fx: Fx[];
  /** Where the story is: the ball, or the scorer in a celebration. */
  focus(c: number): [number, number];
  /** Who scored / made the play, the celebration, and the stretch worth a replay (seconds). */
  hero: number; celebrate: Celebration; replay: [number, number] | null; first: boolean;
  /** Spectacular catch / move names for the broadcast. */
  label?: string;
}

const HZ = 60;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const smooth = (k: number) => { k = clamp(k, 0, 1); return k * k * (3 - 2 * k); };

/** Frames that already show the ball in the hands. */
export const BALL_FRAMES = new Set<string>(['carry0', 'carry1', 'carry2', 'carry3', 'carry4', 'carry5', 'hold', 'secure', 'stiff0', 'stiff1', 'plant', 'spike0', 'highball', 'divecatch', 'frontball', 'throw0', 'throw1', 'snap', 'holder']);

export function choreograph(sc: Scene, ev: PlayEvent): Choreo {
  const A = sc.actors, n = A.length, s = sc.dirSign, D = sc.dur;
  let seed = (ev.n * 7919 + 17) % 2147483647 || 1;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const scrim = !sc.kick;
  const off = sc.off ?? 0;
  // ---- tracks: positions, velocity, smoothed facing and gait phase at 60 Hz ----------------
  const N = Math.max(2, Math.ceil(D * HZ) + 1);
  const X = A.map(() => new Float32Array(N)), Y = A.map(() => new Float32Array(N));
  const VX = A.map(() => new Float32Array(N)), VY = A.map(() => new Float32Array(N)), SP = A.map(() => new Float32Array(N));
  const FACE = A.map(() => new Int8Array(N)), PH = A.map(() => new Float32Array(N));
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < N; k++) { const [x, y] = A[i].path(k / (N - 1)); X[i][k] = x; Y[i][k] = y; }
    let face = A[i].facing as 1 | -1, ph = (i * 0.37) % 1;
    for (let k = 0; k < N; k++) {
      const a = Math.max(0, k - 3), b = Math.min(N - 1, k + 3), dt = (b - a) / HZ || 1;
      const vx = (X[i][b] - X[i][a]) / dt, vy = (Y[i][b] - Y[i][a]) / dt, sp = Math.hypot(vx, vy);
      VX[i][k] = vx; VY[i][k] = vy; SP[i][k] = sp;
      if (Math.abs(vx) > 0.9) face = vx > 0 ? 1 : -1;
      FACE[i][k] = face;
      ph += (sp > 0.5 ? 0.85 + sp * 0.17 : 0) / HZ; PH[i][k] = ph;
    }
  }
  const K = (c: number) => clamp(Math.round(c * HZ), 0, N - 1);
  const U = (c: number) => c / D;            // seconds -> scene time
  const C = (u: number) => u * D;            // scene time -> seconds
  const hold = (c: number) => (sc.hold ? sc.hold(U(c)) : -1);
  const dist = (i: number, j: number, c: number) => { const k = K(c); return Math.hypot(X[i][k] - X[j][k], Y[i][k] - Y[j][k]); };
  const nearestOpp = (i: number, c: number, skip = new Set<number>()) => { let b = -1, bd = 1e9; for (let j = 0; j < n; j++) if (A[j].team !== A[i].team && !skip.has(j)) { const d = dist(i, j, c); if (d < bd) { bd = d; b = j; } } return [b, bd] as const; };
  const fx: Fx[] = [];

  // ---- the story ---------------------------------------------------------------------
  const preC = C(sc.pre);                      // the snap
  const endC = sc.endAt !== undefined ? C(sc.endAt) : D * 0.9;
  const tackC = sc.tackle !== undefined ? C(sc.tackle) : undefined;
  const throwC = sc.throwAt !== undefined ? C(sc.throwAt) : undefined;
  const catchC = sc.catchAt !== undefined ? C(sc.catchAt) : undefined;
  const qb = sc.qb ?? A.findIndex(a => a.team === off && a.slot === 'QB');
  const finalCarrier = (() => { const c = (tackC ?? endC) - 0.02; let h = hold(c); if (h < 0) h = hold(Math.min(D, c + 0.05)); return h; })();
  // Out of bounds: no tackle, he runs out.
  const oob = finalCarrier >= 0 && tackC !== undefined && (Y[finalCarrier][K(tackC)] < 1.2 || Y[finalCarrier][K(tackC)] > FW - 1.2);
  // Tackle.
  let tackler = sc.tackler ?? -1;
  if (tackC !== undefined && finalCarrier >= 0 && tackler < 0) tackler = nearestOpp(finalCarrier, tackC)[0];
  const bigHit = tackC !== undefined && finalCarrier >= 0 && !oob && (SP[finalCarrier][K(tackC - 0.1)] > 7 && rnd() < 0.15);
  const tackleFrom = tackler >= 0 && tackC !== undefined && finalCarrier >= 0 ? Math.sign(X[tackler][K(tackC)] - X[finalCarrier][K(tackC)]) || 1 : 1;
  // Second man in on the pile.
  let pile = -1;
  if (tackC !== undefined && finalCarrier >= 0 && !oob) { const [j, d] = nearestOpp(finalCarrier, tackC, new Set([tackler])); if (d < 3 && rnd() < 0.75) pile = j; }
  if (tackC !== undefined && finalCarrier >= 0 && !oob) {
    const k = K(tackC);
    fx.push({ at: tackC, kind: bigHit ? 'impact' : 'dust', x: X[finalCarrier][k], y: Y[finalCarrier][k], big: bigHit });
    fx.push({ at: tackC + 0.32, kind: 'turf', x: X[finalCarrier][k] + (bigHit ? -tackleFrom : tackleFrom) * 1.2, y: Y[finalCarrier][k] });
  }
  // How the catch looks.
  type Catch = 'normal' | 'dive' | 'high' | 'onehand' | 'toetap';
  let catchStyle: Catch = 'normal';
  const tgt = sc.target ?? -1;
  let label: string | undefined;
  if (sc.pass && sc.complete && tgt >= 0 && catchC !== undefined) {
    const k = K(catchC), cy = Y[tgt][k], air = ev.air ?? ev.yards, yac = ev.yards - air;
    const r = rnd();
    const hard = air >= 14 || (air >= 8 && r < 0.3);
    if ((cy < 3.2 || cy > FW - 3.2) && yac <= 1.5 && r < 0.85) catchStyle = 'toetap';
    else if (hard && yac <= 2 && r < 0.4) catchStyle = 'dive';
    else if (hard && r < 0.7) catchStyle = 'high';
    else if (hard && r < 0.85) catchStyle = 'onehand';
    if (catchStyle !== 'normal') { fx.push({ at: catchC, kind: 'catch', x: X[tgt][k], y: Y[tgt][k] }); label = { dive: 'Layout grab', high: 'High-point catch', onehand: 'One-handed catch', toetap: 'Toe-tap on the sideline' }[catchStyle]; }
  }
  // Ball-carrier moves: jukes, spins and stiff-arms against the closest defender in front.
  interface Move { i: number; at: number; kind: 'juke' | 'spin' | 'stiff'; vic: number }
  const moves: Move[] = [];
  const downed = new Map<number, { at: number; x: number; y: number; dir: number; up: number }>();   // whiffed / stiff-armed defenders on the turf
  if (sc.moves) for (const m of sc.moves) {
    const at = C(m.at), k = K(at), c = finalCarrier >= 0 ? finalCarrier : hold(at);
    if (c < 0) continue;
    if (m.kind !== 'broken') moves.push({ i: c, at, kind: m.kind, vic: m.def });
    downed.set(m.def, { at: at + 0.05, x: X[m.def][k], y: Y[m.def][k], dir: Math.sign(VX[m.def][k]) || -FACE[c][k], up: Math.max(0.6, C(m.until) - at - 0.35) });
    fx.push({ at, kind: m.kind === 'stiff' || m.kind === 'broken' ? 'impact' : 'whiff', x: X[c][k], y: Y[c][k] });
    fx.push({ at: at + 0.05, kind: 'turf', x: X[c][k], y: Y[c][k] });
    if (!label) label = { juke: 'Juke move', spin: 'Spin move', stiff: 'Stiff-arm', broken: 'Broken tackle' }[m.kind];
  }
  else if (scrim && finalCarrier >= 0 && A[finalCarrier].team === off) {
    const c = finalCarrier;
    let from = -1;
    for (let k = K(preC); k < N; k++) if (hold(k / HZ) === c) { from = k; break; }
    const until = K((tackC ?? endC) - 0.45);
    let last = -1e9;
    if (from >= 0) for (let k = from + 12; k < until && moves.length < 2; k++) {
      if (SP[c][k] < 4 || (k - last) / HZ < 0.9) continue;
      const [j, d] = nearestOpp(c, k / HZ, new Set([tackler]));
      if (j < 0 || d > 1.7) continue;
      const ahead = (X[j][k] - X[c][k]) * FACE[c][k];
      if (ahead < -0.4) continue;
      const roll = rnd();
      const kind: Move['kind'] = Math.abs(Y[j][k] - Y[c][k]) > 0.9 && roll < 0.4 ? 'stiff' : roll < 0.78 ? 'juke' : 'spin';
      moves.push({ i: c, at: k / HZ, kind, vic: j });
      downed.set(j, { at: k / HZ + (kind === 'stiff' ? 0.2 : 0.12), x: X[j][k], y: Y[j][k], dir: Math.sign(VX[j][k]) || -FACE[c][k], up: 1.25 });
      fx.push({ at: k / HZ, kind: kind === 'stiff' ? 'impact' : 'whiff', x: X[c][k], y: Y[c][k] });
      fx.push({ at: k / HZ + 0.05, kind: 'turf', x: X[c][k], y: Y[c][k] });
      if (!label) label = kind === 'juke' ? 'Juke move' : kind === 'spin' ? 'Spin move' : 'Stiff-arm';
      last = k;
    }
  }
  // Sack: the rusher wraps the quarterback and takes him down.
  const sack = ev.type === 'sack';
  let sacker = -1;
  if (sack && qb >= 0) { sacker = nearestOpp(qb, endC)[0]; fx.push({ at: endC, kind: 'sack', x: X[qb][K(endC)], y: Y[qb][K(endC)] }); }
  const strip = sack && !!ev.turnover;
  // The handoff: when the ball leaves the quarterback on a run.
  let handC = -1;
  if (ev.type === 'run' && qb >= 0) for (let k = K(preC); k < N; k++) { const h = hold(k / HZ); if (h >= 0 && h !== qb) { handC = k / HZ; break; } }
  // ---- after the play ----------------------------------------------------------------------
  const td = !!sc.td;
  const scorer = td ? (finalCarrier >= 0 ? finalCarrier : hold(endC - 0.02)) : -1;
  const firstDown = scrim && !td && !ev.turnover && (ev.type === 'run' || ev.type === 'pass' || ev.type === 'scramble') && ev.yards >= ev.togo && (ev.type !== 'pass' || !!ev.complete);
  const turnover = !!ev.turnover && !td;
  let hero = scorer >= 0 ? scorer : sack ? sacker : turnover ? finalCarrier : firstDown ? finalCarrier : -1;
  let celebrate: Celebration = 'none';
  if (td) celebrate = (['spike', 'jump', 'flex', 'dance', 'pray', 'spike', 'dance'] as const)[Math.floor(rnd() * 7)];
  
  else if (firstDown) celebrate = 'point';
  
  const POST = !scrim && !td ? (ev.type === 'kickoff' || ev.type === 'punt' ? 1.1 : 1.3) : td ? 2.6 : sack || turnover ? 1.6 : firstDown ? 1.3 : 1.0;
  const WU = scrim ? 1.7 : ev.type === 'fg' || ev.type === 'xp' ? 0.6 : 0.4;
  const whistle = Math.min(D, tackC ?? endC);
  // Mobbers: offensive (scoring) teammates who run to the scorer.
  const mob: number[] = [];
  if (hero >= 0 && celebrate !== 'none' && celebrate !== 'point') {
    const hx = X[hero][N - 1], hy = Y[hero][N - 1];
    A.forEach((a, i) => { if (i !== hero && a.team === A[hero].team && Math.hypot(X[i][N - 1] - hx, Y[i][N - 1] - hy) < (td ? 30 : 14) && mob.length < (td ? 6 : 3)) mob.push(i); });
  }
  if (td) fx.push({ at: endC, kind: 'td', x: X[scorer >= 0 ? scorer : 0][K(endC)], y: Y[scorer >= 0 ? scorer : 0][K(endC)] });
  else if (firstDown && finalCarrier >= 0) fx.push({ at: whistle + 0.3, kind: 'first', x: X[finalCarrier][N - 1], y: Y[finalCarrier][N - 1] });
  if (turnover && finalCarrier >= 0) fx.push({ at: endC, kind: 'turnover', x: X[finalCarrier][K(endC)], y: Y[finalCarrier][K(endC)] });

  // ---- poses -------------------------------------------------------------------------------
  const isLine = (i: number) => /^(OL|DL|FG|FB)/.test(A[i].slot) || (A[i].slot.startsWith('RU') && A[i].role === 'DL');
  const shotgun = (sc.align?.QB?.[0] ?? -5) <= -3;
  const stanceOf = (i: number): Frame => {
    const a = A[i];
    if (a.team === off) {
      if (a.slot === 'OL2') return 'snap';
      if (a.slot.startsWith('OL')) return 'three';
      if (a.slot === 'QB') return shotgun ? 'ready' : 'under';
      if (a.slot === 'RB') return 'hands';
      if (a.slot === 'TE') return 'three';
      return 'crouch';
    }
    if (a.slot.startsWith('DL')) return 'three';
    if (a.slot === 'FS') return 'stand';
    return a.slot.startsWith('LB') ? 'hands' : 'crouch';
  };
  // Walk-up: offense from the huddle, defense from a loose shell, all set before the snap.
  const huddle = (i: number): [number, number] => {
    const a = A[i];
    const k0 = 0, sx = X[i][k0], sy = Y[i][k0];
    if (a.team === off) { const ang = (i * 2.4) % (Math.PI * 2); return [sc.los - s * 7.5 + Math.cos(ang) * 1.6, MID + Math.sin(ang) * 1.9]; }
    return [sx + s * (1.5 + (i % 3)), sy + ((i % 2) * 2 - 1) * 1.2];
  };
  const run6 = (i: number, k: number, carry: boolean, slow = false): Frame => {
    const f = Math.floor(((PH[i][k] % 1) + 1) % 1 * 6) as 0 | 1 | 2 | 3 | 4 | 5;
    return (carry ? `carry${f}` : slow ? `jog${f}` : `run${f}`) as Frame;
  };
  const fallPose = (base: Pose, t0: number, c: number, dir: number, back: boolean, dur = 0.42): Pose => {
    const k = (c - t0) / dur;
    if (k < 0.3) return { ...base, f: back ? 'hit' : base.f };
    if (k < 1) return { ...base, f: back ? 'fallback' : 'fall', lift: back ? 0 : 0 };
    return { ...base, f: back ? 'downback' : 'down', face: (dir > 0) === !back ? 1 : -1, rot: 0 };
  };
  const scenePose = (i: number, c: number): Pose => {
    const a = A[i], k = K(c), x = X[i][k], y = Y[i][k], sp = SP[i][k];
    let face = FACE[i][k] as 1 | -1;
    const isOff = a.team === off, holder = hold(c) === i;
    const P = (f: Frame, o: Partial<Pose> = {}): Pose => ({ x, y, f, face, rot: 0, lift: 0, ...o });
    // Before the snap: in the stance (or the man in motion jogging across).
    if (scrim && c < preC) {
      if (sp > 0.8) return P(run6(i, k, false, true), { face: (VX[i][k] >= 0 ? 1 : -1) });
      return P(stanceOf(i), { face: isOff ? (s as 1 | -1) : (-s as 1 | -1) });
    }
    // Defenders who whiffed or got stiff-armed: on the turf, then back up and chasing.
    const dn = downed.get(i);
    if (dn && c >= dn.at - 0.15) {
      const t = c - dn.at;
      if (t < 0) return P('dive', { face: (dn.dir > 0 ? 1 : -1) });
      const base: Pose = { x, y, f: 'dive', face: dn.dir > 0 ? 1 : -1, rot: 0, lift: Math.max(0, 0.35 - t * 1.2) };
      if (t < 0.25) return base;
      if (t < dn.up) return { ...base, f: 'down' };
      if (t < dn.up + 0.3) return { ...base, f: 'kneel' };
    }
    // The tackle: wrap or big hit, then both go down; the pile-on arrives a beat later.
    if (tackC !== undefined && !oob) {
      if (i === finalCarrier && c >= tackC - 0.06) {
        const base = P(holder ? 'carry0' : 'stand', { x: X[i][K(tackC)], y: Y[i][K(tackC)], face: FACE[i][K(tackC)] as 1 | -1 });
        if (bigHit) { if (c < tackC + 0.12) return { ...base, f: 'hit' }; return fallPose(base, tackC + 0.12, c, -tackleFrom * base.face, true, 0.35); }
        return fallPose({ ...base, f: 'carry2' }, tackC + 0.1, c, base.face, false, 0.5);
      }
      if (i === tackler && c >= (sc.wrapAt !== undefined && sc.wrapper === i ? C(sc.wrapAt) : tackC - 0.3)) {
        const tk = K(tackC), cx = X[finalCarrier][tk], cy = Y[finalCarrier][tk];
        const f2 = (cx > x ? 1 : -1) as 1 | -1;
        if (c < tackC) return P('wrap', { face: f2 });
        const k2 = clamp((c - tackC) / 0.5, 0, 1);
        const px = lerp(X[i][tk], cx - f2 * 0.6, k2), py = lerp(Y[i][tk], cy + 0.25, k2);
        return { x: px, y: py, f: k2 < 0.3 ? 'wrap' : k2 < 0.7 ? 'fall' : 'down', face: f2, rot: 0, lift: 0 };
      }
      if (i === pile && c >= tackC + 0.05) {
        const tk = K(tackC), cx = X[finalCarrier][tk], cy = Y[finalCarrier][tk];
        const f2 = (cx > X[i][tk] ? 1 : -1) as 1 | -1, k2 = clamp((c - tackC - 0.05) / 0.45, 0, 1);
        return { x: lerp(X[i][K(tackC + 0.05)], cx + f2 * 0.3, k2), y: lerp(Y[i][K(tackC + 0.05)], cy - 0.3, k2), f: k2 < 0.7 ? 'dive' : 'down', face: f2, rot: 0, lift: Math.sin(k2 * Math.PI) * 0.4 };
      }
    }
    // The sack.
    if (sack && i === qb && c >= endC - 0.25) {
      const base = P('hold', { x: X[i][K(endC)], y: Y[i][K(endC)] });
      if (c < endC) return { ...base, f: 'hit' };
      return fallPose(base, endC, c, -s, bigHit, 0.45);
    }
    if (sack && i === sacker && c >= endC - 0.3) {
      const qx = X[qb][K(endC)], f2 = (qx > x ? 1 : -1) as 1 | -1;
      if (c < endC + 0.25) return P('wrap', { face: f2 });
      return { ...P('down', { face: f2 }), x: lerp(x, qx + f2 * 0.2, 0.6), y: Y[qb][K(endC)] + 0.3 };
    }
    // The quarterback: under centre, drop, set, wind up, release, follow through.
    if (i === qb && scrim) {
      if (throwC !== undefined) {
        const d = c - throwC;
        if (d > -0.26 && d < -0.07) return P('throw1', { face: s as 1 | -1 });
        if (d >= -0.07 && d < 0.05) return P('throw2', { face: s as 1 | -1 });
        if (d >= 0.05 && d < 0.28) return P('throw3', { face: s as 1 | -1 });
        if (d < -0.26 && holder) {
          if (sp > 1.4 && VX[i][k] * s < -0.4) return P((Math.floor(PH[i][k] * 4) % 2 ? 'back0' : 'back1'), { face: s as 1 | -1 });   // the drop
          if (sp > 1.4) return P(run6(i, k, true));
          return P('hold', { face: s as 1 | -1 });
        }
      }
      if (handC > 0 && c < handC + 0.15 && c > preC) return P(c < handC ? 'hold' : 'follow', { face: s as 1 | -1 });
      if (holder && sp < 1.4 && !(ev.type === 'scramble' && c > preC + 1.2)) return P('hold', { face: s as 1 | -1 });
    }
    // The catch.
    if (catchC !== undefined && (i === tgt || (sc.int && holder && c < catchC + 0.4))) {
      const d = c - catchC;
      if (sc.complete && i === tgt) {
        if (catchStyle === 'dive' && d > -0.3) {
          const k0 = K(catchC), bx = X[i][k0], by = Y[i][k0];
          const fly = clamp((d + 0.3) / 0.55, 0, 1);
          const pos = { x: bx + FACE[i][k0] * fly * 1.6, y: by };
          if (d < 0.25) return { ...pos, f: 'divecatch', face: FACE[i][k0] as 1 | -1, rot: 0, lift: Math.sin(fly * Math.PI) * 0.55 };
          if (d < 1.0) return { ...pos, f: 'down', face: FACE[i][k0] as 1 | -1, rot: 0, lift: 0 };
          if (d < 1.35) return { ...pos, f: 'kneel', face: FACE[i][k0] as 1 | -1, rot: 0, lift: 0 };
          return { ...pos, f: 'secure', face: FACE[i][k0] as 1 | -1, rot: 0, lift: 0 };
        }
        if (catchStyle === 'high' && d > -0.32 && d < 0.22) { const jk = clamp((d + 0.32) / 0.54, 0, 1); return P(d < -0.02 ? 'high' : 'highball', { lift: Math.sin(jk * Math.PI) * 0.75 }); }
        if (catchStyle === 'onehand' && d > -0.28 && d < 0.1) return P('onehand');
        if (catchStyle === 'toetap' && d > -0.2) {
          const k0 = K(catchC);
          if (d < 0.55) return { x: X[i][k0], y: Y[i][k0], f: d < 0.15 ? 'reach' : 'toetap', face: FACE[i][k0] as 1 | -1, rot: 0, lift: d < 0.1 ? 0.15 : 0 };
          return { x: X[i][k0], y: Y[i][k0], f: 'secure', face: FACE[i][k0] as 1 | -1, rot: 0, lift: 0 };
        }
        if (d > -0.3 && d < 0) return P('reach');
        if (d >= 0 && d < 0.18) return P('secure');
      } else if (i === tgt && d > -0.3 && d < 0.5) return P(d < 0 ? 'reach' : 'hit');
      else if (sc.int && holder && d > -0.3 && d < 0.15) return P('high', { lift: 0.3 });
    }
    if (sc.swatter !== undefined && i === sc.swatter && catchC !== undefined && sc.broken) {
      const d = c - catchC;
      if (d > -0.3 && d < 0.2) return P(ev.n % 3 === 0 ? 'dive' : 'catch', { lift: 0.25 });
    }
    // Kickers, holders, snappers, punters.
    if (sc.kicker === i && sc.kickAt !== undefined) {
      const d = c - C(sc.kickAt);
      if (d > -0.18 && d < 0.25) return P(ev.type === 'punt' ? 'punt' : 'kick', { face: (ev.type === 'kickoff' ? -s : s) as 1 | -1 });
    }
    if (a.slot === 'H' && (ev.type === 'fg' || ev.type === 'xp')) return P('holder', { face: s as 1 | -1 });
    if (a.slot === 'R' && sc.kick && catchC !== undefined && Math.abs(c - catchC) < 0.3 && hold(catchC + 0.02) === i) return P('catch');
    // Ball-carrier moves.
    for (const m of moves) if (m.i === i && c >= m.at - 0.08 && c < m.at + (m.kind === 'spin' ? 0.32 : m.kind === 'stiff' ? 0.4 : 0.2)) {
      const d = c - m.at + 0.08;
      if (m.kind === 'juke') return P('plant', { face: FACE[i][K(m.at - 0.1)] as 1 | -1 });
      if (m.kind === 'stiff') return P(d < 0.2 ? 'stiff0' : 'stiff1', { face: (X[m.vic][k] > x ? 1 : -1) as 1 | -1 });
      const q = Math.floor(d / 0.08) % 4; return P((['front', 'back', 'front', 'carry2'] as Frame[])[q], { face: q === 3 ? face : (q % 2 ? -face : face) as 1 | -1 });
    }
    // Blocking: linemen engaged, pass pro sitting down, the rush ripping through.
    if (scrim && c > preC && isLine(i) && sp < 4) {
      let eng = false;
      for (let j = 0; j < n; j++) if (A[j].team !== a.team && Math.hypot(X[j][k] - x, Y[j][k] - y) < 1.5) { eng = true; break; }
      if (eng) {
        face = (isOff ? s : -s) as 1 | -1;
        const back = VX[i][k] * face < -0.5;
        if (isOff && (sc.pass || sack)) return P(back ? 'anchor' : Math.floor(PH[i][k] * 3) % 2 ? 'anchor' : 'push0', { face });
        if (!isOff && sc.pressured && (i * 7 + Math.floor(c * 3)) % 5 === 0) return P('rip', { face });
        return P(Math.floor(c * 5 + i) % 2 ? 'push0' : 'push1', { face });
      }
    }
    // Ball carriers run with it tucked.
    if (holder && sp > 1.2) return P(run6(i, k, true));
    if (holder) return P('secure');
    // Defensive backs backpedal and shuffle while they read.
    if (scrim && !isOff && sp > 1 && (sc.throwAt === undefined || c < (throwC ?? 0)) && hold(c) >= 0 && A[hold(c)].slot === 'QB') {
      const fwd = VX[i][k] * -s;
      if (fwd < -0.6 && !isLine(i)) return P(Math.floor(PH[i][k] * 4) % 2 ? 'back0' : 'back1', { face: -s as 1 | -1 });
      if (Math.abs(VY[i][k]) > Math.abs(VX[i][k]) * 1.4 && sp < 5) return P(Math.floor(PH[i][k] * 4) % 2 ? 'shuf0' : 'shuf1', { face: -s as 1 | -1 });
    }
    if (sp > 0.45) return P(run6(i, k, false, sp < 3.5));
    return P('stand');
  };
  // After the whistle: get up, celebrate, mob the scorer.
  const postPose = (i: number, p: number): Pose => {
    const e0 = scenePose(i, D), kk = N - 1, coast = 0.35 * (1 - Math.exp(-p / 0.35));
    const moving = SP[i][kk] * Math.exp(-p / 0.35) > 0.5 && !['down', 'downback', 'wrap', 'dive', 'fall', 'fallback', 'kneel'].includes(e0.f) && !e0.rot;
    const end = moving ? { ...e0, x: e0.x + VX[i][kk] * coast, y: e0.y + VY[i][kk] * coast, f: run6(i, Math.floor((p * 6) % 6), hold(D) === i, true) } : { ...e0, x: e0.x + (e0.rot || e0.f === 'down' ? 0 : VX[i][kk] * coast), y: e0.y + (e0.rot || e0.f === 'down' ? 0 : VY[i][kk] * coast) };
    const lying = ['down', 'downback', 'dive', 'wrap', 'fall', 'fallback'].includes(end.f);
    const upAt = i === hero ? (td ? 0.35 : 0.5) : 0.7 + (i % 5) * 0.12;
    let base = end;
    if (lying || end.rot) {
      if (p < upAt) return { ...end, rot: end.rot ? end.rot : 0, f: end.rot ? 'down' : end.f === 'wrap' ? 'down' : end.f };
      if (p < upAt + 0.35) return { ...end, f: 'kneel', rot: 0, lift: 0 };
      base = { ...end, f: 'stand', rot: 0, lift: 0 };
    } else if (!['stand', 'secure', 'hold'].includes(end.f) && !end.f.startsWith('run') && !end.f.startsWith('jog') && !end.f.startsWith('carry')) base = { ...end, f: 'stand', lift: 0 };
    else if (end.f.startsWith('run') || end.f.startsWith('jog') || end.f.startsWith('carry')) base = { ...end, f: p < 0.4 ? end.f : hold(D) === i ? 'secure' : 'stand' };
    const go = Math.max(0, p - (lying ? upAt + 0.35 : 0.15));
    if (i === hero) {
      const t = go, f = (base.face) as 1 | -1;
      switch (celebrate) {
        case 'point': return t < 0.2 ? base : t < 1.35 ? { ...base, f: 'point', face: (s * (A[i].team === off ? 1 : -1)) as 1 | -1 } : { ...base, f: 'secure' };
        case 'spike': return t < 0.35 ? { ...base, f: 'spike0' } : t < 0.7 ? { ...base, f: 'spike1' } : t < 2.4 ? { ...base, f: Math.floor(t * 4) % 2 ? 'party0' : 'party1' } : { ...base, f: 'stand' };
        case 'jump': { const ph = (t % 0.7) / 0.7; return t < 2.8 ? { ...base, f: ph < 0.6 ? 'jump0' : 'stand', lift: Math.max(0, Math.sin(ph / 0.6 * Math.PI)) * 0.8 * (ph < 0.6 ? 1 : 0) } : { ...base, f: 'stand' }; }
        case 'flex': return t < 0.25 ? base : t < 2.4 ? { ...base, f: 'flex', face: f } : { ...base, f: 'stand' };
        case 'dance': return t < 0.25 ? base : t < 3 ? { ...base, f: Math.floor(t * 4.5) % 2 ? 'dance0' : 'dance1' } : { ...base, f: 'front' };
        case 'pray': return t < 0.3 ? base : t < 2.8 ? { ...base, f: 'pray' } : { ...base, f: 'stand' };
      }
      return base;
    }
    const mi = mob.indexOf(i);
    if (mi >= 0 && hero >= 0) {
      const h = scenePose(hero, D), t = Math.max(0, p - 0.25 - mi * 0.12);
      const ang = mi * 1.05 + 0.4, tx = h.x + Math.cos(ang) * 1.3, ty = h.y + Math.sin(ang) * 1.1;
      const d = Math.hypot(tx - base.x, ty - base.y), arrive = d / 7;
      if (t < arrive) { const k2 = t / arrive; return { x: lerp(base.x, tx, k2), y: lerp(base.y, ty, k2), f: run6(i, Math.floor((t * 9) % 6), false), face: (tx > base.x ? 1 : -1), rot: 0, lift: 0 }; }
      const q = t - arrive, faceH = (h.x > tx ? 1 : -1) as 1 | -1;
      if (mi === 0 && celebrate !== 'pray') { const ph = (q % 0.8) / 0.8; return { x: tx, y: ty, f: ph < 0.5 ? 'jump0' : 'stand', face: faceH, rot: 0, lift: ph < 0.5 ? Math.sin(ph * 2 * Math.PI) * 0.5 : 0 }; }
      return { x: tx, y: ty, f: Math.floor(q * 3.5 + mi) % 2 ? 'party0' : 'party1', face: faceH, rot: 0, lift: 0 };
    }
    return base;
  };
  // Walk-up from the huddle.
  const wuPose = (i: number, w: number): Pose => {
    const set = scenePose(i, 0), [hx, hy] = huddle(i), a = A[i];
    const brk = 0.35, jog = WU - 0.55;      // break, jog to the spot, settle into the stance
    if (!scrim) return set;
    if (w < brk) return { x: hx, y: hy, f: a.team === off ? 'stand' : 'hands', face: a.team === off ? (MID > hy ? 1 : -1) as 1 | -1 : (-s as 1 | -1), rot: 0, lift: 0 };
    const k2 = smooth((w - brk) / (jog - brk));
    if (k2 < 1) { const dx = set.x - hx, f = Math.floor(((w * (2.2 + Math.hypot(dx, set.y - hy) * 0.25)) % 1) * 6); return { x: lerp(hx, set.x, k2), y: lerp(hy, set.y, k2), f: `jog${f}` as Frame, face: (Math.abs(dx) > 0.4 ? (dx > 0 ? 1 : -1) : set.face) as 1 | -1, rot: 0, lift: 0 }; }
    return { ...set, f: w > WU - 0.3 ? set.f : 'stand' };
  };
  const pose = (i: number, c: number): Pose => (c < 0 ? wuPose(i, c + WU) : c <= D ? scenePose(i, c) : postPose(i, c - D));

  // ---- officials ---------------------------------------------------------------------------
  const spot = (): [number, number] => { const c = Math.min(D, whistle); if (finalCarrier >= 0) { const k = K(c); return [X[finalCarrier][k], Y[finalCarrier][k]]; } const b = sc.ball(Math.min(1, U(c))); return [b[0], b[1]]; };
  const [spX, spY] = spot();
  const OFF0: [number, number, 'R' | 'U' | 'H' | 'L' | 'B'][] = scrim
    ? [[sc.los - s * 12, MID + 2.5, 'R'], [sc.los - s * 7.5, MID - 3, 'U'], [sc.los, FW + 0.6, 'H'], [sc.los, -0.6, 'L'], [sc.los + s * 22, MID - 4, 'B']]
    : [[sc.los - s * 6, MID + 3, 'R'], [sc.los + s * 8, FW + 0.6, 'H'], [sc.los + s * 8, -0.6, 'L'], [sc.los + s * 40, MID, 'B']];
  const refs = (c: number): Pose[] => OFF0.map(([x0, y0, who], j) => {
    const t = c - whistle, mark = j === 0 || (who === 'H' && Math.abs(spY - FW) < 20) || (who === 'L' && spY < 26);
    const come = t > 0 ? smooth(t / 1.1) : 0;
    const tx = mark ? spX - s * (j === 0 ? 2 : 0) : x0 + (spX - x0) * 0.35, ty = mark ? (who === 'H' ? FW - 1 : who === 'L' ? 1 : spY + 2.5) : y0;
    const x = lerp(x0, tx, come), y = lerp(y0, ty, come);
    const moving = t > 0 && come < 0.98;
    let f: Frame = moving ? (`jog${Math.floor((t * 8 + j) % 6)}` as Frame) : 'stand';
    let face: 1 | -1 = (spX > x ? 1 : -1);
    const p = c - D;
    if (p > 0.2 && (j === 0 || j === 4 || who === 'H')) {
      if (td) f = 'tdsig';
      else if (sc.pass && !sc.complete && !sc.int && j === 0) f = Math.floor(p * 4) % 2 ? 'incomp0' : 'incomp1';
      else if (firstDown && (who === 'H' || j === 0) && p < 1.6) { f = 'point'; face = s as 1 | -1; }
      else if ((ev.type === 'fg' || ev.type === 'xp') && !/NO GOOD/.test(ev.text)) f = 'tdsig';
    }
    if (c < 0 && scrim) f = 'stand';
    return { x, y, f, face, rot: 0, lift: 0, ref: true };
  });

  // ---- the ball ----------------------------------------------------------------------------
  const ball = (c: number): BallState | null => {
    if (c < 0) return scrim ? { x: sc.los, y: MID, h: 0.15, free: true, kick: false } : null;
    if (c <= D) {
      const u = U(c), [x, y] = sc.ball(u), h = sc.ballH(u);
      if (sack && strip && c > endC) {   // strip-sack: it squirts out
        const k = clamp((c - endC) / 0.7, 0, 1);
        return { x: x - s * 2.5 * k, y: y + 1.2 * k, h: 0.15 + Math.sin(k * Math.PI) * 0.8, free: true, kick: false };
      }
      const holder = hold(c);
      return { x, y, h, free: holder < 0 || h > 1.6, kick: !!sc.kick && holder < 0 };
    }
    const p = c - D, h = hero >= 0 && hold(D) === hero ? hero : -1;
    if (celebrate === 'spike' && h >= 0) {
      const ps = postPose(hero, p), t = p - (td ? 0.35 : 0.5) - 0.35;
      if (t > 0.35) { const q = t - 0.35, bounce = Math.abs(Math.sin(Math.min(q, 1.6) * 5)) * 1.6 * Math.exp(-q * 2.2); return { x: ps.x + ps.face * (0.6 + q * 1.2), y: ps.y + 0.2, h: 0.15 + bounce, free: true, kick: false }; }
    }
    const [x, y] = sc.ball(1);
    return { x, y, h: sc.ballH(1), free: hold(D) < 0, kick: false };
  };
  const focus = (c: number): [number, number] => {
    if (c > D && hero >= 0 && celebrate !== 'none') { const p = pose(hero, c); return [p.x, p.y]; }
    const b = ball(Math.min(c, D)); return b ? [b.x, b.y] : [sc.los, MID];
  };
  // Replays: touchdowns, turnovers, sacks, big plays and the highlight-reel catches/moves.
  const big = td || turnover || sack || !!ev.big || catchStyle !== 'normal' || moves.length > 0 || bigHit;
  const keyAt = catchStyle !== 'normal' && catchC !== undefined ? catchC : moves.length ? moves[0].at : sack ? endC : tackC ?? endC;
  const replay: [number, number] | null = big && scrim ? [Math.max(preC - 0.3, keyAt - 2.4), Math.min(D, Math.max(keyAt + 1.2, (td ? endC : whistle) + 0.5))] : null;
  return { WU, DUR: D, POST, pose, refs, ball, fx, focus, hero, celebrate, replay, first: firstDown, label };
}
