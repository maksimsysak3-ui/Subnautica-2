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
import { POSE, type RigPose } from './rig';

export const MID = 26.65, FW = 53.3;
export interface Pose { x: number; y: number; face: 1 | -1; rig: RigPose; ref?: boolean; lying?: boolean }
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
  let bigHit = tackC !== undefined && finalCarrier >= 0 && !oob && (SP[finalCarrier][K(tackC - 0.1)] > 7 && rnd() < 0.15);
  // Caught and immediately hit: the receiver takes the shot as the ball arrives.
  if (sc.pass && sc.complete && catchC !== undefined && tackC !== undefined && tackC - catchC < 0.45 && rnd() < 0.7) bigHit = true;
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
  type Catch = 'normal' | 'dive' | 'high' | 'onehand' | 'toetap' | 'back' | 'falling' | 'moss';
  let catchStyle: Catch = 'normal';
  const tgt = sc.target ?? -1;
  let label: string | undefined;
  if (sc.pass && sc.complete && tgt >= 0 && catchC !== undefined) {
    const k = K(catchC), cy = Y[tgt][k], air = ev.air ?? ev.yards, yac = ev.yards - air;
    const r = rnd();
    const hard = air >= 14 || (air >= 8 && r < 0.3);
    const near = (() => { let b = 1e9; for (let jj = 0; jj < n; jj++) if (A[jj].team !== off) b = Math.min(b, Math.hypot(X[jj][k] - X[tgt][k], Y[jj][k] - cy)); return b; })();
    const side = cy < 4.5 || cy > FW - 4.5;
    if (side && yac <= 2.5) catchStyle = air >= 8 && air <= 25 && r < 0.3 ? 'back' : 'toetap';
    else if (air >= 16 && near < 2.2 && r < 0.55) catchStyle = 'moss';          // a 50/50 ball: up over the defender
    else if (air >= 18) catchStyle = r < 0.3 ? 'high' : r < 0.55 ? 'dive' : r < 0.75 ? 'onehand' : 'normal';
    else if (air >= 8) catchStyle = r < 0.14 ? 'back' : r < 0.28 ? 'onehand' : r < 0.42 ? 'high' : yac <= 1 && r < 0.55 ? 'falling' : yac <= 2 && r < 0.65 ? 'dive' : 'normal';
    else if (r < 0.1) catchStyle = 'onehand'; else if (yac <= 1 && r < 0.2) catchStyle = 'falling';
    void hard;
    if (catchStyle !== 'normal') { fx.push({ at: catchC, kind: 'catch', x: X[tgt][k], y: Y[tgt][k] }); label = ({ dive: 'Layout grab', high: 'High-point catch', onehand: 'One-handed catch', toetap: 'Toe-tap on the sideline', back: 'Back-shoulder catch', falling: 'Falling catch', moss: 'Mossed him' } as Record<string, string>)[catchStyle]; if (catchStyle === 'onehand' || catchStyle === 'moss' || catchStyle === 'dive') fx.push({ at: catchC, kind: 'catch', x: X[tgt][k], y: Y[tgt][k], big: true }); }
  }
  const contester = catchStyle === 'moss' && catchC !== undefined ? nearestOpp(tgt, catchC)[0] : -1;
  // Ball-carrier moves: jukes, spins and stiff-arms against the closest defender in front.
  const MOVE_LEN = { juke: 0.42, jumpcut: 0.38, hesi: 0.55, cut: 0.2, spin: 0.4, stiff: 0.4 } as const;
  interface Move { i: number; at: number; kind: 'juke' | 'spin' | 'stiff' | 'jumpcut' | 'hesi' | 'cut'; vic: number }
  const moves: Move[] = [];
  const downed = new Map<number, { at: number; x: number; y: number; dir: number; up: number; back?: boolean }>();   // whiffed / stiff-armed defenders on the turf
  // The trenches: pancakes (the defender put on his back) and pass rushers beating their man.
  const trench = new Map<number, { at: number; kind: string; back?: boolean }>();
  for (const m of sc.moves ?? []) {
    if (m.kind === 'pancake') { const at = C(m.at); downed.set(m.def, { at, x: 0, y: 0, dir: -s, up: 99, back: true }); if (m.by !== undefined) trench.set(m.by, { at, kind: 'drive' }); fx.push({ at, kind: 'dust', x: X[m.def][K(at)], y: Y[m.def][K(at)] }); }
    else if (m.kind === 'swim' || m.kind === 'rip' || m.kind === 'spinmove') { const at = C(m.at); trench.set(m.def, { at, kind: 'beaten' }); if (m.by !== undefined) trench.set(m.by, { at, kind: m.kind }); }
  }
  if (sc.moves) for (const m of sc.moves) {
    if (m.kind === 'pancake' || m.kind === 'swim' || m.kind === 'rip' || m.kind === 'spinmove') continue;
    const at = C(m.at), k = K(at), c = finalCarrier >= 0 ? finalCarrier : hold(at);
    if (c < 0) continue;
    if (m.kind !== 'broken') moves.push({ i: c, at, kind: m.kind, vic: m.def });
    // A cut or a hesitation leaves the defender standing (wrong-footed, overrunning it); the rest put him on the turf.
    if (m.kind !== 'cut' && m.kind !== 'hesi') downed.set(m.def, { at: at + (m.kind === 'jumpcut' ? 0.2 : 0.05), x: X[m.def][k], y: Y[m.def][k], dir: Math.sign(VX[m.def][k]) || -FACE[c][k], up: Math.max(0.6, C(m.until) - at - 0.35) });
    if (m.kind !== 'cut' && m.kind !== 'hesi') fx.push({ at, kind: m.kind === 'stiff' || m.kind === 'broken' ? 'impact' : 'whiff', x: X[c][k], y: Y[c][k] });
    fx.push({ at: at + 0.05, kind: 'turf', x: X[c][k], y: Y[c][k] });
    if (!label) label = ({ juke: 'Juke move', spin: 'Spin move', stiff: 'Stiff-arm', broken: 'Broken tackle', jumpcut: 'Jump cut', hesi: 'Hesitation', cut: 'Cutback' } as Record<string, string>)[m.kind];
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
      const kind: 'juke' | 'spin' | 'stiff' = Math.abs(Y[j][k] - Y[c][k]) > 0.9 && roll < 0.4 ? 'stiff' : roll < 0.78 ? 'juke' : 'spin';
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
  // Fumbles: the ball squirts loose, bounces, and players from both sides dive on it.
  const fumble = !!ev.turnover && (ev.type === 'run' || ev.type === 'scramble' || sack);
  const fumC = fumble ? (sack ? endC : tackC ?? endC) : Infinity;
  let fumSpot: [number, number] = [0, 0];
  const pilers: number[] = []; let recoverer = -1;
  if (fumble) {
    const fc = sack ? qb : finalCarrier >= 0 ? finalCarrier : qb, kf = K(fumC);
    fumSpot = [X[fc][kf] + (rnd() < 0.5 ? -s : s) * (1.8 + rnd() * 2), clamp(Y[fc][kf] + (rnd() - 0.5) * 4, 2, FW - 2)];
    const byDist = A.map((_, j) => j).filter(j => j !== fc).sort((a, b) => Math.hypot(X[a][kf] - fumSpot[0], Y[a][kf] - fumSpot[1]) - Math.hypot(X[b][kf] - fumSpot[0], Y[b][kf] - fumSpot[1]));
    pilers.push(...byDist.slice(0, 5));
    recoverer = pilers.find(j => A[j].team !== off) ?? -1;
  }
  // The handoff: when the ball leaves the quarterback on a run.
  let handC = -1;
  if (ev.type === 'run' && qb >= 0) for (let k = K(preC); k < N; k++) { const h = hold(k / HZ); if (h >= 0 && h !== qb) { handC = k / HZ; break; } }
  // ---- after the play ----------------------------------------------------------------------
  const td = !!sc.td;
  const scorer = td ? (finalCarrier >= 0 ? finalCarrier : hold(endC - 0.02)) : -1;
  const firstDown = scrim && !td && !ev.turnover && (ev.type === 'run' || ev.type === 'pass' || ev.type === 'scramble') && ev.yards >= ev.togo && (ev.type !== 'pass' || !!ev.complete);
  const turnover = !!ev.turnover && !td;
  let hero = scorer >= 0 ? scorer : fumble && recoverer >= 0 ? recoverer : sack ? sacker : turnover ? finalCarrier : firstDown ? finalCarrier : -1;
  let celebrate: Celebration = 'none';
  if (td) celebrate = (['spike', 'jump', 'flex', 'dance', 'pray', 'spike', 'dance'] as const)[Math.floor(rnd() * 7)];
  
  else if (fumble && recoverer >= 0) celebrate = 'jump';
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
  // Every pose is built from the skeleton library (rig.ts); the decisions below say which
  // action, how far into it, and where the hands are reaching.
  const isLine = (i: number) => /^(OL|DL|FG|FB)/.test(A[i].slot) || (A[i].slot.startsWith('RU') && A[i].role === 'DL');
  const shotgun = (sc.align?.QB?.[0] ?? -5) <= -3;
  const RPY = 16;   // rig px per yard
  const inten = (sp: number) => clamp((sp - 1.2) / 7.4, 0, 1);
  const accel = (i: number, k: number) => clamp((SP[i][k] - SP[i][Math.max(0, k - 6)]) / 2, -1, 1);
  const runRig = (i: number, k: number, carry: boolean) => POSE.run(((PH[i][k] % 1) + 1) % 1, inten(SP[i][k]), carry, accel(i, k));
  const mk = (x: number, y: number, face: number, rig: RigPose, extra: Partial<Pose> = {}): Pose => ({ x, y, face: (face >= 0 ? 1 : -1), rig, ...extra });
  /** Hands reaching for the ball as it arrives (target relative to the shoulders, rig px). */
  const reachFor = (i: number, c: number, face: number, jump = 0, carry = false) => {
    const k = K(c), t = Math.min(c + 0.06, catchC ?? c), u = U(t);
    const [bx] = sc.ball(u), bh = sc.ballH(u);
    const fx = clamp((bx - X[i][k]) * face * RPY, -4, 12), fy = clamp(bh * 0.85 * RPY - 22 - jump, -10, 14);
    const arms = POSE.reach(fx, fy, jump, carry);
    if (jump || SP[i][k] < 1.5) return arms;
    return POSE.compose(runRig(i, k, false), { na: arms.na, ne: arms.ne, fa: arms.fa, fe: arms.fe, lean: 0.12, ball: arms.ball });
  };
  // Each player has his own stance (picked from his id so he always sets up the same way).
  const pick = (i: number, n: number) => { const id = A[i].id ?? `${A[i].slot}${A[i].num}`; let h = 7; for (let k = 0; k < id.length; k++) h = (h * 31 + id.charCodeAt(k)) >>> 0; return h % n; };
  const stanceOf = (i: number): RigPose => {
    const a = A[i], v = pick(i, 10), los = Math.abs(X[i][0] - sc.los);
    if (a.team === off) {
      if (a.slot === 'OL2') return POSE.snap();
      if (a.slot.startsWith('OL')) return shotgun && sc.pass && v < 5 ? POSE.passSet() : v < 2 ? POSE.passSet() : POSE.three();
      if (a.slot === 'QB') return shotgun ? POSE.gun() : POSE.under();
      if (a.slot === 'RB') return v < 6 ? POSE.rb() : POSE.two();
      if (a.slot === 'TE') return v < 5 ? POSE.three() : POSE.two();
      return v < 4 ? POSE.two() : v < 8 ? POSE.twoLow() : POSE.press();
    }
    if (a.slot.startsWith('DL')) return a.slot === 'DL0' || a.slot === 'DL3' ? (v < 4 ? POSE.edge() : POSE.three()) : v < 4 ? POSE.four() : POSE.three();
    if (a.slot.startsWith('LB')) return v < 6 ? POSE.lb() : POSE.two();
    if (a.slot === 'FS') return v < 5 ? POSE.lb() : POSE.stand();
    return los < 2.5 ? POSE.press() : v < 5 ? POSE.dbOff() : POSE.two();
  };
  // Walk-up: offense from the huddle, defense from a loose shell; everyone stands at the line,
  // then gets down into the stance just before the snap.
  const huddle = (i: number): [number, number] => {
    const a = A[i];
    if (a.team === off) { const ang = (i * 2.4) % (Math.PI * 2); return [sc.los - s * 7.5 + Math.cos(ang) * 1.6, MID + Math.sin(ang) * 1.9]; }
    // The defense huddles too, a few yards off the ball on its side, around the signal-caller.
    const ang = (i * 2.4) % (Math.PI * 2); return [sc.los + s * 6.5 + Math.cos(ang) * 1.7, MID + Math.sin(ang) * 2.0];
  };
  const fallAt = (x: number, y: number, face: number, t: number, dir: number, carry: boolean, dur = 0.45): Pose =>
    t < dur ? mk(x, y, face, POSE.fall(t / dur, dir, carry)) : mk(x, y, face, POSE.lying(dir, carry), { lying: true });
  const scenePose = (i: number, c: number): Pose => {
    const a = A[i], k = K(c), x = X[i][k], y = Y[i][k], sp = SP[i][k];
    const face = FACE[i][k];
    const isOff = a.team === off, holder = hold(c) === i;
    const P = (rig: RigPose, o: Partial<Pose> = {}) => mk(x, y, o.face ?? face, holder && !rig.ball ? { ...rig, ball: 1 } : rig, o);
    // The fumble scramble: everybody near it races to the ball and dives on the pile.
    if (fumble && c >= fumC + 0.12 && pilers.includes(i)) {
      const ord = pilers.indexOf(i), t0 = fumC + 0.12 + ord * 0.07, k0 = K(t0);
      const sx0 = X[i][k0], sy0 = Y[i][k0], tx = fumSpot[0] + ((ord % 3) - 1) * 0.5, ty = fumSpot[1] + (ord % 2 ? 0.35 : -0.35);
      const dd = Math.hypot(tx - sx0, ty - sy0), arrive = Math.max(0.2, dd / 7.5), t = c - t0, f = tx > sx0 ? 1 : -1;
      if (t < 0) return mk(sx0, sy0, f, POSE.run(PH[i][k0] % 1, 0.8));
      if (t < arrive) { const q = t / arrive; return mk(lerp(sx0, tx, q), lerp(sy0, ty, q), f, q > 0.65 ? POSE.dive((q - 0.65) / 0.35, false) : POSE.run((t * 2.4) % 1, 1)); }
      return mk(tx, ty, f, { ...POSE.lying(1, i === recoverer), ball: i === recoverer ? 2 : 0 }, { lying: true });
    }
    // Before the snap: the man in motion jogs; everyone else is set.
    if (scrim && c < preC) {
      if (sp > 0.8) return P(runRig(i, k, false), { face: VX[i][k] >= 0 ? 1 : -1 });
      const set = c > preC - 0.45;
      // The quarterback runs the line: points out the Mike, then (in the gun) claps for the snap.
      if (a.slot === 'QB' && isOff) {
        const q = preC - c;
        if (q > 0.95 && q < 1.5) return mk(x, y, s, { ...POSE.stand(), lean: 0.12, na: 1.55, ne: 0.08, fa: 0.25, fe: 0.5, look: -0.1 });
        if (shotgun && q > 0.2 && q < 0.36) return mk(x, y, s, { ...POSE.gun(), na: 1.25, ne: 0.55, fa: 1.25, fe: 0.55, nt: 0.55, nk: 0.75 });
      }
      return mk(x, y, isOff ? s : -s, set ? stanceOf(i) : (a.slot === 'QB' && !shotgun ? POSE.hold() : POSE.stand()));
    }
    // Beaten defenders: on the turf for a beat, then up and chasing.
    const dn = downed.get(i);
    if (dn && c >= dn.at - 0.12) {
      const t = c - dn.at + 0.12, f = dn.dir > 0 ? 1 : -1;
      if (dn.back) return fallAt(x, y, isOff ? s : -s, Math.max(0, t - 0.12), -1, false, 0.45);
      if (t < dn.up) return fallAt(x, y, f, t, 1, false, 0.3);
      if (t < dn.up + 0.3) return mk(x, y, f, POSE.kneel());
    }
    // The tackle, as one action between two bodies: the tackler closes, drops his hips and
    // wraps the carrier at the waist; the carrier keeps churning for a beat, then they go down
    // together in the direction the tackler drives him (forward, or backward on a big hit).
    if (tackC !== undefined && !oob && finalCarrier >= 0 && tackler >= 0) {
      const wrapFrom = sc.wrapAt !== undefined && sc.wrapper === tackler ? C(sc.wrapAt) : tackC - 0.22;
      const tk = K(tackC), cf = FACE[finalCarrier][tk];
      const drive = (X[finalCarrier][tk] - X[tackler][K(wrapFrom)]) >= 0 ? 1 : -1;   // which way the tackler is driving
      const carrierAt = (t: number): [number, number] => { const kk = K(Math.min(t, tackC)); return [X[finalCarrier][kk], Y[finalCarrier][kk]]; };
      const slide = (t: number) => Math.min(0.9, Math.max(0, t) * 1.6) * drive;    // momentum carries them a yard
      if (i === finalCarrier && c >= wrapFrom) {
        const [cx, cy] = carrierAt(c), t = c - tackC;
        if (t < 0) return mk(cx, cy, cf, POSE.compose(POSE.run((PH[i][k] % 1), 0.3), { lean: 0.55, na: 0.1, ne: 2.4, fa: 0.4, fe: 2.2, ball: 2 }));
        const fwd = drive === cf ? 1 : -1;   // driven the way he faces = falls forward
        return fallAt(cx + slide(t), cy, cf, t, bigHit ? -fwd : fwd, true, bigHit ? 0.38 : 0.5);
      }
      if (i === tackler && c >= wrapFrom - 0.12) {
        const [cx, cy] = carrierAt(c), t = c - tackC;
        if (c < wrapFrom) return mk(x, y, drive, POSE.wrap(0));
        const tx = cx - drive * 0.45, ty = cy + 0.12;            // locked on at the waist, nearer the camera
        if (t < 0) return mk(lerp(x, tx, clamp((c - wrapFrom) / 0.08, 0, 1)), lerp(y, ty, clamp((c - wrapFrom) / 0.08, 0, 1)), drive, bigHit ? POSE.dive(0.35, false) : POSE.wrap(clamp((c - wrapFrom) / 0.2, 0, 1)));
        return fallAt(tx + slide(t) + drive * 0.25 * Math.min(1, t * 2), ty, drive, t, 1, false, bigHit ? 0.38 : 0.5);
      }
      if (i === pile && c >= tackC + 0.08) {
        const [cx, cy] = carrierAt(tackC), t0 = tackC + 0.08, f = cx > X[i][K(t0)] ? 1 : -1, k2 = clamp((c - t0) / 0.4, 0, 1);
        return mk(lerp(X[i][K(t0)], cx + slide(c - tackC) + f * 0.1, k2), lerp(Y[i][K(t0)], cy - 0.25, k2), f, k2 < 0.75 ? POSE.dive(k2, false) : POSE.lying(1, false), { lying: k2 >= 0.75 });
      }
    }
    // The sack: the rusher wraps him up and takes him down; the pocket is closing in.
    if (sack && i === qb && c >= endC - 0.2) {
      const ek = K(endC), t = c - endC;
      if (t < 0) return mk(X[i][ek], Y[i][ek], s, { ...POSE.hold(), lean: -0.15 });
      return fallAt(X[i][ek], Y[i][ek], s, t, bigHit ? -1 : 1, true, 0.5);
    }
    if (sack && i === sacker && c >= endC - 0.3) {
      const qx = X[qb][K(endC)], f = qx > X[i][K(endC - 0.3)] ? 1 : -1;
      if (c < endC) return mk(x, y, f, POSE.wrap(clamp((c - endC + 0.3) / 0.3, 0, 1)));
      return fallAt(lerp(x, qx - f * 0.6, 0.6), Y[qb][K(endC)] + 0.3, f, c - endC, 1, false, 0.5);
    }
    // The quarterback: the drop, the set, the wind-up, release and follow-through.
    if (i === qb && scrim) {
      if (throwC !== undefined) {
        const d = c - throwC;
        if (d > -0.34 && d < 0.4) return mk(x, y, s, POSE.throw(d < 0 ? d / 0.34 : d / 0.4));
        if (d < -0.34 && holder) {
          if (sp > 1.4 && VX[i][k] * s < -0.4) return mk(x, y, s, { ...POSE.backpedal(PH[i][k] % 1), na: 0.35, ne: 1.9, fa: 0.25, fe: 2.0, ball: 2 });   // the drop
          if (sp > 1.4) return P(runRig(i, k, true));
          return mk(x, y, s, POSE.compose(POSE.run((c * 1.3) % 1, 0), { ...POSE.hold(), lean: 0.12 }));
        }
      }
      if (handC > 0 && c > preC && c < handC + 0.25) return mk(x, y, s, c < handC - 0.15 ? POSE.hold() : { ...POSE.reach(9, -6), ball: c < handC ? 1 : 0 });
      if (holder && sp < 1.4 && !(ev.type === 'scramble' && c > preC + 1.2)) return mk(x, y, s, POSE.compose(POSE.run((c * 1.3) % 1, 0), { ...POSE.hold(), lean: 0.12 }));
    }
    // The catch: hands go up only as the ball arrives, the way it's caught depends on the throw.
    if (catchC !== undefined && (i === tgt || (sc.int && holder && c < catchC + 0.4))) {
      const d = c - catchC;
      if (sc.complete && i === tgt) {
        const k0 = K(catchC), f0 = FACE[i][k0];
        if (catchStyle === 'dive' && d > -0.22) {
          const fly = clamp((d + 0.22) / 0.42, 0, 1), px = X[i][k0] + f0 * fly * 1.6, py = Y[i][k0];
          if (d < 0.2) return mk(px, py, f0, POSE.dive(fly, d > -0.02));
          if (d < 1.0) return mk(px, py, f0, POSE.lying(1, true), { lying: true });
          if (d < 1.3) return mk(px, py, f0, { ...POSE.kneel(), ball: 1 });
          return mk(px, py, f0, { ...POSE.stand(), na: 0.2, ne: 2.2, ball: 1 });
        }
        if (catchStyle === 'back' && d > -0.4 && d < 0.3) {   // turns back to the quarterback and goes up for it over his shoulder
          const fb = -FACE[i][K(catchC)] as 1 | -1;
          return mk(x, y, fb, d < 0 ? { ...reachFor(i, c, fb, Math.max(0, Math.sin(clamp((d + 0.4) / 0.5, 0, 1) * Math.PI)) * 4), lean: -0.1 } : { ...POSE.reach(2, 6), ball: 2 });
        }
        if (catchStyle === 'moss' && d > -0.34 && d < 0.24) { const jk = clamp((d + 0.34) / 0.5, 0, 1), jump = Math.sin(jk * Math.PI) * 13; return mk(x, y, face, d < 0 ? reachFor(i, c, face, jump) : { ...POSE.reach(1, 12, jump), ball: 2 }); }
        if (catchStyle === 'falling' && d > -0.16) {
          const k0 = K(catchC), f0 = FACE[i][k0];
          if (d < 0) return mk(x, y, f0, { ...reachFor(i, c, f0), lean: 0.6 });
          return fallAt(X[i][k0] + f0 * Math.min(0.8, d * 2), Y[i][k0], f0, d, 1, true, 0.4);
        }
        if (catchStyle === 'high' && d > -0.24 && d < 0.18) { const jk = clamp((d + 0.24) / 0.42, 0, 1), jump = Math.sin(jk * Math.PI) * 9; return mk(x, y, face, d < 0 ? reachFor(i, c, face, jump) : { ...POSE.reach(2, 10, jump), ball: 2 }); }
        if (catchStyle === 'onehand' && d > -0.16 && d < 0.08) { const r = reachFor(i, c, face); return mk(x, y, face, d < 0 ? { ...r, fa: -0.6, fe: 0.8 } : { ...r, fa: -0.6, fe: 0.8, ball: 1 }); }
        if (catchStyle === 'toetap' && d > -0.14) {
          if (d < 0.6) return mk(X[i][k0], Y[i][k0], f0, d < 0.02 ? reachFor(i, c, f0) : POSE.toetap(clamp(d / 0.6, 0, 1)));
          return mk(X[i][k0], Y[i][k0], f0, { ...POSE.stand(), na: 0.2, ne: 2.2, ball: 1 });
        }
        if (d > -0.16 && d < 0) return mk(x, y, face, reachFor(i, c, face, 0));
        if (d >= 0 && d < 0.2) return mk(x, y, face, { ...POSE.run(PH[i][k] % 1, inten(sp)), na: 0.3, ne: 2.2, fa: 0.4, fe: 2.0, ball: 2 });
      } else if (i === tgt && d > -0.16 && d < (sc.broken ? 1.2 : 0.4)) return d < 0 ? mk(x, y, face, reachFor(i, c, face)) : sc.broken ? fallAt(x, y, face, d, -1, false, 0.45) : mk(x, y, face, POSE.fall(Math.min(1, d * 1.2) * 0.25, -1, false));
      else if (sc.int && holder && d > -0.24 && d < 0.12) return mk(x, y, face, d < 0 ? reachFor(i, c, face, 5) : { ...POSE.reach(2, 9, 3), ball: 2 });
    }
    if (i === contester && catchC !== undefined) { const d = c - catchC; if (d > -0.34 && d < 0.3) { const jk = clamp((d + 0.34) / 0.5, 0, 1); return d < 0.05 ? mk(x, y, face, reachFor(i, Math.min(c, catchC), face, Math.sin(jk * Math.PI) * 10)) : fallAt(x, y, face, d - 0.05, -1, false, 0.4); } }
    if (sc.swatter !== undefined && i === sc.swatter && catchC !== undefined && sc.broken) {
      const d = c - catchC;
      if (d > -0.22 && d < 0.2) return mk(x, y, face, reachFor(i, Math.min(c, catchC), face, Math.sin(clamp((d + 0.22) / 0.42, 0, 1) * Math.PI) * 6));
    }
    // Kickers, holders, snappers, returners.
    if (sc.kicker === i && sc.kickAt !== undefined) {
      const d = c - C(sc.kickAt);
      if (d > -0.25 && d < 0.3) return mk(x, y, ev.type === 'kickoff' ? -s : s, POSE.kick(clamp(d / 0.25, -1, 1)));
    }
    if (a.slot === 'H' && (ev.type === 'fg' || ev.type === 'xp')) return mk(x, y, s, POSE.holder());
    if (a.slot === 'R' && sc.kick && catchC !== undefined && Math.abs(c - catchC) < 0.3 && hold(catchC + 0.02) === i) return mk(x, y, face, c < catchC ? reachFor(i, c, face) : { ...POSE.hold(), ball: 2 });
    // Ball-carrier moves.
    for (const m of moves) {
      const len = MOVE_LEN[m.kind], pre = m.kind === 'cut' ? 0.04 : 0.1;
      if (m.i !== i || c < m.at - pre || c >= m.at + len) continue;
      const d = c - m.at + pre, u = clamp(d / (len + pre), 0, 1), f0 = FACE[i][K(m.at - 0.12)];
      if (m.kind === 'juke') return mk(x, y, f0, POSE.juke(u, PH[i][k] % 1));
      if (m.kind === 'jumpcut') return mk(x, y, f0, POSE.jumpcut(u, PH[i][k] % 1));
      if (m.kind === 'hesi') return mk(x, y, f0, POSE.hesi(u, PH[i][k] % 1));
      if (m.kind === 'cut') return mk(x, y, f0, POSE.cut());
      if (m.kind === 'stiff') return mk(x, y, X[m.vic][k] > x ? 1 : -1, POSE.stiff(PH[i][k] % 1));
      // Spin: plant, whip around with his back to the tackler, come out the other side running.
      return mk(x, y, u < 0.2 ? f0 : u < 0.65 ? -f0 : f0, u < 0.2 ? POSE.cut() : u < 0.65 ? POSE.spin() : { ...POSE.run(PH[i][k] % 1, 1, true, 1), lean: 0.5 });
    }
    // Route running: a hard plant at each break; on comebacks and curls he snaps around to the QB.
    if (sc.breaks && !holder) for (const b of sc.breaks) if (b.who === i) {
      const d = c - C(b.at);
      if (d > -0.03 && d < 0.17) return mk(x, y, face, { ...POSE.plant(), ball: 0, na: 0.6, ne: 1.4, fa: -0.6, fe: 1.2, lean: 0.25 });
      if (b.back && d >= 0.17 && d < 0.6 && SP[i][k] < 3) return mk(x, y, -s, { ...POSE.two(), na: 1.3, ne: 0.8, fa: 1.2, fe: 0.9 });
    }
    // The trenches: the pancake block, a blocker lunging at air, a rusher's move.
    const tr = trench.get(i);
    if (tr && c >= tr.at - 0.1) {
      const d = c - tr.at, f = isOff ? s : -s;
      if (tr.kind === 'drive' && d < 0.9) return mk(x, y, f, d < 0.45 ? { ...POSE.drive(c * 1.5), lean: 0.95, na: 1.6, fa: 1.5 } : { ...POSE.stand(), lean: 0.3, na: 0.6, ne: 0.6 });
      if (tr.kind === 'beaten' && d > 0 && d < 0.5) return mk(x, y, f, { ...POSE.wrap(0.5), lean: 1.05 + d * 0.4 });
      if ((tr.kind === 'swim' || tr.kind === 'rip') && d < 0.4) return mk(x, y, f, POSE.swim(clamp((d + 0.1) / 0.5, 0, 1)));
      if (tr.kind === 'spinmove' && d < 0.36) return mk(x, y, Math.floor((d + 0.1) / 0.12) % 2 ? -f : f, { ...POSE.swim(0.5), na: 0.4, fa: 0.4 });
    }
    // A pass batted down at the line.
    if (sc.tipped && sc.tipped.by === i) { const d = c - C(sc.tipped.at); if (d > -0.3 && d < 0.3) return mk(x, y, isOff ? s : -s, POSE.reach(2, 12, Math.sin(clamp((d + 0.3) / 0.6, 0, 1) * Math.PI) * 6)); }
    // Blocking: run blocks drive, pass pro sits down, the rush works its hands.
    if (scrim && c > preC && isLine(i) && sp < 4.5) {
      let eng = -1;
      for (let j = 0; j < n; j++) if (A[j].team !== a.team && Math.hypot(X[j][k] - x, Y[j][k] - y) < 1.5) { eng = j; break; }
      if (eng >= 0) {
        const f = isOff ? s : -s;
        if (isOff && (sc.pass || sack)) return mk(x, y, f, POSE.passpro(PH[i][k] % 1 + c * 0.8));
        if (!isOff && sc.pressured && (i * 7 + Math.floor(c * 2.5)) % 6 === 0) return mk(x, y, f, POSE.swim(((c * 2.5) % 1)));
        return mk(x, y, f, POSE.drive(PH[i][k] % 1 + c * 1.2));
      }
      // The kick-slide: a blocker setting back before contact still faces his rusher, never the quarterback.
      if (isOff && !holder && (sc.pass || sack || VX[i][k] * s < 0)) return mk(x, y, s, POSE.passpro(PH[i][k] % 1 + c * 0.8));
    }
    if (holder && sp > 1.2) return P(runRig(i, k, true));
    if (holder) return P({ ...POSE.stand(), na: 0.2, ne: 2.2, ball: 1 });
    // Defensive backs backpedal and shuffle while they read the quarterback.
    if (scrim && !isOff && sp > 1 && (throwC === undefined || c < throwC) && hold(c) >= 0 && A[hold(c)].slot === 'QB' && !isLine(i)) {
      if (VX[i][k] * -s < -0.6) return mk(x, y, -s, POSE.backpedal(PH[i][k] % 1));
      if (Math.abs(VY[i][k]) > Math.abs(VX[i][k]) * 1.4 && sp < 5) return mk(x, y, -s, POSE.shuffle(PH[i][k] % 1));
    }
    if (sp > 0.45) return P(runRig(i, k, false));
    return P(POSE.stand(Math.sin(c * 2 + i)));
  };
  // After the whistle: coast to a stop, get up, celebrate, mob the scorer.
  // After the whistle: a teammate helps the tackled carrier up; the carrier flips the ball to
  // the official; on an incompletion the receiver grabs his helmet and the defender waves it off.
  const fc0 = finalCarrier >= 0 ? scenePose(finalCarrier, D) : null;
  const fcDown = !!fc0 && (!!fc0.lying || fc0.rig.hipY < 6);
  const fcUp = finalCarrier < 0 ? 0 : (fcDown ? (finalCarrier === hero ? (td ? 0.35 : 0.5) : 0.75 + (finalCarrier % 5) * 0.13) + 0.4 : 0.35);
  const ownsCelebration = finalCarrier === hero && celebrate !== 'none';
  const tossAt = scrim && !td && !fumble && !turnover && finalCarrier >= 0 && hold(D) === finalCarrier && !ownsCelebration && !sc.oob ? fcUp + 0.35 : Infinity;
  const helper = scrim && !td && fcDown && fc0 ? A.map((a, j) => ({ j, d: a.team === A[finalCarrier].team && j !== finalCarrier && !scenePose(j, D).lying ? Math.hypot(X[j][N - 1] - fc0.x, Y[j][N - 1] - fc0.y) : 1e9 })).sort((a, b) => a.d - b.d)[0] : undefined;
  const helperJ = helper && helper.d < 9 ? helper.j : -1;
  const incomp = scrim && !!sc.pass && sc.complete === false && !sc.int && tgt >= 0;
  const waver = incomp && catchC !== undefined ? nearestOpp(tgt, catchC)[0] : -1;
  const postPose = (i: number, p: number): Pose => {
    const kk = N - 1, e0 = scenePose(i, D);
    if (i === helperJ && fc0) {
      const tx = fc0.x - fc0.face * 0.75, ty = fc0.y + 0.45, f = tx < fc0.x ? 1 : -1;
      const arrive = Math.max(0.35, Math.hypot(tx - e0.x, ty - e0.y) / 5);
      if (p < arrive) { const k2 = smooth(p / arrive); return mk(lerp(e0.x, tx, k2), lerp(e0.y, ty, k2), tx > e0.x ? 1 : -1, POSE.run((p * 2) % 1, 0.3)); }
      if (p < fcUp + 0.15) return mk(tx, ty, f, { ...POSE.stand(), hipY: 13.4, lean: 0.55, na: 0.85, ne: 0.1, fa: 0.2, fe: 0.6 });
      return mk(tx, ty, f, POSE.stand(Math.sin(p * 2 + i)));
    }
    if (i === finalCarrier && p >= tossAt - 0.2 && p < tossAt + 0.25) {
      const st = scenePose(i, D);
      return mk(st.x, st.y, st.face, { ...POSE.stand(), na: p < tossAt ? -0.2 : 1.1, ne: p < tossAt ? 0.6 : 0.15, ball: p < tossAt ? 1 : 0 });
    }
    if (incomp && i === tgt && p > 0.15 && p < 1.6 && !e0.lying) return mk(e0.x, e0.y, e0.face, { ...POSE.stand(), na: 2.75, ne: 2.35, fa: 2.75, fe: 2.35, look: 0.35, lean: -0.05 });
    if (incomp && i === waver && p > 0.2 && p < 1.4 && !e0.lying) return mk(e0.x, e0.y, e0.face, POSE.incomplete(p));
    // Out of bounds: he carries it across the sideline and pulls up by the benches.
    if (i === finalCarrier && scrim && !td && tackC === undefined && (sc.oob || (sc.complete !== false && (Y[i][kk] < 3.2 || Y[i][kk] > FW - 3.2)))) {
      const side = Y[i][kk] < MID ? -1 : 1, k2 = smooth(p / 0.8), tx = e0.x + VX[i][kk] * 0.3, ty = side < 0 ? -1.6 : FW + 1.6;
      return mk(e0.x + (tx - e0.x) * k2, e0.y + (ty - e0.y) * k2, e0.face, k2 < 0.95 ? POSE.run((p * 2.2) % 1, 0.35 * (1 - k2), true) : { ...POSE.stand(), na: 0.2, ne: 2.2, ball: 1 });
    }
    const coast = 0.35 * (1 - Math.exp(-p / 0.35));
    const down = !!e0.lying || e0.rig.hipY < 6;
    const moving = !down && SP[i][kk] * Math.exp(-p / 0.35) > 0.5;
    const bx = down ? e0.x : e0.x + VX[i][kk] * coast, by = down ? e0.y : e0.y + VY[i][kk] * coast;
    const hasBall = hold(D) === i && p < tossAt;
    const upAt = i === hero ? (td ? 0.35 : 0.5) : 0.75 + (i % 5) * 0.13;
    let base: Pose;
    if (down) {
      const dir = e0.rig.lean < 0 ? -1 : 1;
      if (p < upAt) return mk(bx, by, e0.face, POSE.lying(dir, hasBall, Math.sin(p * 3)), { lying: true });
      if (p < upAt + 0.4) return mk(bx, by, e0.face, { ...POSE.kneel(), ball: hasBall ? 1 : 0 });
      base = mk(bx, by, e0.face, hasBall ? { ...POSE.stand(), na: 0.2, ne: 2.2, ball: 1 } : POSE.stand());
    } else if (moving) base = mk(bx, by, e0.face, POSE.run((PH[i][kk] + p * 1.6) % 1, inten(SP[i][kk] * Math.exp(-p / 0.35)), hasBall));
    else base = mk(bx, by, e0.face, hasBall ? { ...POSE.stand(), na: 0.2, ne: 2.2, ball: 1 } : POSE.stand(Math.sin(p * 2 + i)));
    const go = Math.max(0, p - (down ? upAt + 0.4 : 0.35));
    if (i === hero && fumble) { base = { ...base, rig: { ...base.rig, ball: 2 } }; }
    if (i === hero) {
      const t = go;
      switch (celebrate) {
        case 'point': return t > 0.1 && t < 1.3 ? { ...base, face: (s * (A[i].team === off ? 1 : -1)) as 1 | -1, rig: POSE.point(hasBall) } : base;
        case 'spike': return t < 0.9 ? { ...base, rig: POSE.spike(t / 0.9) } : t < 2.4 ? { ...base, rig: POSE.jump(((t - 0.9) % 0.75) / 0.75) } : base;
        case 'jump': return t < 2.4 ? { ...base, rig: { ...POSE.jump((t % 0.75) / 0.75), ball: base.rig.ball ? 1 : 0 } } : base;
        case 'flex': return t > 0.15 && t < 2.2 ? { ...base, rig: POSE.flex(t) } : base;
        case 'dance': return t > 0.15 && t < 2.6 ? { ...base, rig: POSE.dance(t) } : base;
        case 'pray': return t > 0.2 && t < 2.4 ? { ...base, rig: POSE.pray() } : base;
      }
      return base;
    }
    const mi = mob.indexOf(i);
    if (mi >= 0 && hero >= 0) {
      const h = scenePose(hero, D), t = Math.max(0, p - 0.35 - mi * 0.12);
      const ang = mi * 1.05 + 0.4, tx = h.x + Math.cos(ang) * 1.4, ty = h.y + Math.sin(ang) * 1.2;
      const d = Math.hypot(tx - base.x, ty - base.y), arrive = d / 6.5;
      if (t < arrive) { const k2 = t / arrive; return mk(lerp(base.x, tx, k2), lerp(base.y, ty, k2), tx > base.x ? 1 : -1, POSE.run((t * 2.2 + mi * 0.3) % 1, 0.7)); }
      const q = t - arrive, f = h.x > tx ? 1 : -1;
      return mk(tx, ty, f, (mi + Math.floor(q / 0.8)) % 2 ? POSE.jump((q % 0.8) / 0.8) : { ...POSE.stand(), na: 2.9, ne: 0.3 });
    }
    return base;
  };
  const wuPose = (i: number, w: number): Pose => {
    if (!scrim) return scenePose(i, 0);
    const set = scenePose(i, 0), [hx, hy] = huddle(i), a = A[i];
    const brk = 0.35, jog = WU - 0.5;
    if (w < brk) return mk(hx, hy, a.team === off ? (MID > hy ? 1 : -1) : -s, POSE.stand(Math.sin(w * 3 + i)));
    const k2 = smooth((w - brk) / (jog - brk));
    const dx = set.x - hx, dist2 = Math.hypot(dx, set.y - hy);
    if (k2 < 1) return mk(lerp(hx, set.x, k2), lerp(hy, set.y, k2), Math.abs(dx) > 0.4 ? dx : set.face, POSE.run(((w - brk) * (1.2 + dist2 * 0.06)) % 1, clamp(dist2 / 12, 0.15, 0.45)));
    return mk(set.x, set.y, a.team === off ? s : -s, a.slot === 'QB' && !shotgun ? POSE.hold() : POSE.stand());
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
    const come = t > 0 ? smooth(t / 1.2) : 0;
    const tx = mark ? spX - s * (j === 0 ? 2 : 0) : x0 + (spX - x0) * 0.35, ty = mark ? (who === 'H' ? FW - 1 : who === 'L' ? 1 : spY + 2.5) : y0;
    const x = lerp(x0, tx, come), y = lerp(y0, ty, come);
    let face = spX > x ? 1 : -1;
    let rig: RigPose = t > 0 && come < 0.97 ? POSE.run((t * 1.8 + j * 0.3) % 1, 0.25) : POSE.stand(Math.sin(c * 2 + j));
    const p = c - D;
    if (p > 0.2 && (j === 0 || j === 4 || who === 'H')) {
      if (td) rig = POSE.td();
      else if (sc.pass && !sc.complete && !sc.int && j === 0) rig = POSE.incomplete(p);
      else if (firstDown && (who === 'H' || j === 0) && p < 1.6) { rig = POSE.point(false); face = s; }
      else if ((ev.type === 'fg' || ev.type === 'xp') && !/NO GOOD/.test(ev.text)) rig = POSE.td();
    }
    if (c < 0 && scrim) rig = POSE.stand(Math.sin(c * 2 + j));
    return mk(x, y, face, rig, { ref: true });
  });

  // ---- the ball ----------------------------------------------------------------------------
  const ball = (c: number): BallState | null => {
    if (c < 0) return scrim ? { x: sc.los, y: MID, h: 0.15, free: true, kick: false } : null;
    if (c <= D) {
      const u = U(c), [x, y] = sc.ball(u), h = sc.ballH(u);
      if (fumble && c > fumC) {   // it squirts out and bounces around until someone covers it
        const k = clamp((c - fumC) / 0.85, 0, 1), fc = sack ? qb : finalCarrier >= 0 ? finalCarrier : qb, kf = K(fumC);
        const bx = lerp(X[fc][kf], fumSpot[0], 1 - (1 - k) * (1 - k)), by = lerp(Y[fc][kf], fumSpot[1], 1 - (1 - k) * (1 - k));
        return { x: bx, y: by, h: 0.15 + Math.abs(Math.sin(k * Math.PI * 3)) * 0.9 * (1 - k), free: k < 0.97, kick: false };
      }
      const holder = hold(c);
      return { x, y, h, free: holder < 0 || h > 1.6, kick: !!sc.kick && holder < 0 };
    }
    if (fumble) return { x: fumSpot[0], y: fumSpot[1], h: 0.3, free: false, kick: false };   // under the pile / in the recoverer's arms
    const p = c - D, h = hero >= 0 && hold(D) === hero ? hero : -1;
    if (celebrate === 'spike' && h >= 0) {
      const ps = postPose(hero, p), t = p - (td ? 0.35 : 0.5) - 0.35;
      if (t > 0.45) { const q = t - 0.35, bounce = Math.abs(Math.sin(Math.min(q, 1.6) * 5)) * 1.6 * Math.exp(-q * 2.2); return { x: ps.x + ps.face * (0.6 + q * 1.2), y: ps.y + 0.2, h: 0.15 + bounce, free: true, kick: false }; }
    }
    if (p >= tossAt) {
      const st = scenePose(finalCarrier, D), r = refs(c)[0], k = clamp((p - tossAt) / 0.45, 0, 1);
      return { x: lerp(st.x + st.face * 0.3, r.x, k), y: lerp(st.y, r.y, k), h: 1.0 + Math.sin(k * Math.PI) * 1.4, free: k < 1, kick: false };
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
