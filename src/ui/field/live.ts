// The live play engine. A scrimmage play runs as 22 players moving in real time, 60 steps a
// second, and the result comes out of what happens on the field:
//  - movement with momentum: acceleration, top speed and how sharply a man can turn all come
//    from his ratings, so nobody skates or turns on a dime;
//  - blocks are engagements: rusher against blocker, strength and technique decide who drives
//    whom and when a rusher sheds; double teams hold up;
//  - receivers run their routes and plant at the breaks; defenders cover with a reaction delay
//    (their ratings), so separation is earned at the break, not handed out;
//  - the quarterback drops, reads a progression, feels the rush, and throws (or scrambles,
//    throws it away, or takes the sack). His accuracy and the ball's speed come from his ratings;
//  - the catch is decided where the ball arrives: who is there, how well each catches;
//  - ball carriers pick the lane with the most room, tacklers wrap up or miss.
// The game engine books the stats from the result; the field draws the recording.
import type { LiveCtx, LiveResult, LiveRec, LiveSlot } from '../../sim/livetypes';
import { OFF_SLOTS, DEF_SLOTS, ACT } from '../../sim/livetypes';
import { PLAY_ART, OL_SPOTS, alignFor, type Art } from '../playart';

const HZ = 60, DT = 1 / HZ, REC_HZ = 30, T_MAX = 12, AFTER = 0.7;
const MID = 26.65, FW = 53.3;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const sig = (x: number) => 1 / (1 + Math.exp(-x));
const hyp = Math.hypot;

type Role = 'OL' | 'QB' | 'RB' | 'WR' | 'TE' | 'DL' | 'LB' | 'DB' | 'S';
type Job = 'protect' | 'runblock' | 'route' | 'qb' | 'carry' | 'rush' | 'man' | 'zone' | 'pursue' | 'block' | 'fake' | 'idle';
interface Ag {
  i: number; slot: LiveSlot; off: boolean; role: Role;
  x: number; y: number; vx: number; vy: number;
  top: number; acc: number; agi: number;
  r: (a: string) => number;
  job: Job;
  /** Blocking or being blocked by (one blocker per defender here, plus a helper). */
  eng: Ag | null; helper: Ag | null;
  beatenUntil: number; downUntil: number; tackleCD: number;
  route: [number, number][] | null; ri: number; plantUntil: number; routeDone: boolean;
  /** Assignment: the man he blocks or covers, his zone landmark and type. */
  man: Ag | null; zone: [number, number] | null; deep: boolean; carry: Ag | null;
  react: number;
  hx: Float32Array; hy: Float32Array;
  /** Recorded action and facing per step. */
  act: Uint8Array; face: Int8Array; fc: 1 | -1;
}

export function runLivePlay(ctx: LiveCtx): LiveResult {
  let seed = (ctx.seed * 16807 + 12345) % 2147483647 || 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const gauss = () => { let u = 0, v = 0; while (!u) u = rnd(); while (!v) v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  const s = ctx.s;
  const toX = (yl: number) => (s > 0 ? 10 + yl : 110 - yl);
  const los = toX(ctx.yl), goalX = toX(100), ownGoalX = toX(0);
  const at = (dx: number, dy: number): [number, number] => [los + s * dx, MID + s * dy];
  const down = (x: number) => s * (x - los);              // yards downfield of the line
  const pass = ctx.kind === 'pass';
  const depth = ctx.depth ?? 'short';
  const MAXF = Math.ceil((T_MAX + AFTER) * HZ) + 2;

  // ---- the call ------------------------------------------------------------------------
  const fallback = pass ? ({ screen: 'Screen', quick: 'Quick Slants', short: 'Curl Flat', medium: 'Dig', deep: 'Four Verticals' } as const)[depth]
    : ({ inside: 'Inside Zone', outside: 'Outside Zone', qb: 'QB Keep' } as const)[ctx.run ?? 'inside'];
  const art: Art[] = (ctx.call && PLAY_ART[ctx.call]) || PLAY_ART[fallback] || [];
  const callName = ctx.call && PLAY_ART[ctx.call] ? ctx.call : fallback;
  const FORM = alignFor(callName);
  const man = /Cover [01]/.test(ctx.shell) || /Man|Cover 0|Cover 1/i.test(ctx.dcall ?? '');
  const cov2 = !man && (ctx.shell === 'Cover 2' || /Cover 2|Tampa/i.test(ctx.dcall ?? ''));
  const cov4 = !man && (ctx.shell === 'Cover 4' || /Cover 4|Quarters/i.test(ctx.dcall ?? ''));
  const prevent = ctx.shell === 'Prevent';

  // ---- personnel -----------------------------------------------------------------------
  const agents: Ag[] = [];
  const mk = (slot: LiveSlot, role: Role, [x, y]: [number, number]): Ag => {
    const r = (a: string) => ctx.rate(slot, a);
    const a: Ag = {
      i: agents.length, slot, off: (OFF_SLOTS as readonly string[]).includes(slot), role, x, y, vx: 0, vy: 0,
      top: 5.6 + clamp(r('SPD'), 30, 105) * 0.044, acc: 3 + clamp(r('ACC'), 30, 105) * 0.048, agi: 4.5 + clamp(r('AGI'), 30, 105) * 0.065,
      r, job: 'idle', eng: null, helper: null, beatenUntil: 0, downUntil: 0, tackleCD: 0,
      route: null, ri: 1, plantUntil: 0, routeDone: false, man: null, zone: null, deep: false, carry: null,
      react: 0.3, hx: new Float32Array(MAXF), hy: new Float32Array(MAXF), act: new Uint8Array(MAXF), face: new Int8Array(MAXF), fc: 1,
    };
    agents.push(a); return a;
  };
  const OL = OL_SPOTS.map(([dx, dy], i) => mk(OFF_SLOTS[i], 'OL', at(dx, dy)));
  const QB = mk('QB', 'QB', at(...FORM.QB));
  const RB = mk('RB', 'RB', at(...FORM.RB));
  const WHO = ['X', 'Z', 'S', 'TE'] as const;
  const REC = WHO.map(w => mk(w, w === 'TE' ? 'TE' : 'WR', at(...FORM[w])));
  const press = man && rnd() < 0.55;
  const DL = [-5, -1.7, 1.7, 5].map((dy, i) => mk(DEF_SLOTS[i], 'DL', at(1, dy)));
  const LB = [-3.5, 3.5].map((dy, i) => mk(DEF_SLOTS[4 + i], 'LB', at(5, dy)));
  const DB = WHO.map((w, i) => mk(DEF_SLOTS[6 + i], 'DB', at(FORM[w][0] + (w === 'TE' ? 5.5 : press && w !== 'S' ? 1.2 : 6.5), FORM[w][1] * 0.95)));
  const FS = mk('FS', 'S', at(13, 0));
  const OFF = agents.filter(a => a.off), DEF = agents.filter(a => !a.off);
  const gun = FORM.QB[0] < -3;
  for (const a of DEF) a.react = clamp(0.42 - (a.r('PRC') + a.r(man ? 'MCV' : 'ZCV')) * 0.0016, 0.08, 0.36);

  // Routes and blocks from the call's art.
  const artFor = (w: string) => art.find(a => a.who === w);
  const routeOf = (from: [number, number], pts: [number, number][]): [number, number][] => {
    const abs = [from, ...pts.map(p => at(p[0], p[1]))];
    // Past the last point he keeps going the way the route ends (verticals, crossers, flats).
    const a = abs[abs.length - 2], b = abs[abs.length - 1], d = hyp(b[0] - a[0], b[1] - a[1]) || 1;
    abs.push([b[0] + ((b[0] - a[0]) / d) * 30, clamp(b[1] + ((b[1] - a[1]) / d) * 30, 0.5, FW - 0.5)]);
    return abs;
  };
  const rbArt = artFor('RB'), qbArt = artFor('QB');
  const qbRun = !pass && (ctx.run === 'qb' || qbArt?.kind === 'run');
  let runPath: [number, number][] = [];
  if (pass) {
    for (const [k, r] of REC.entries()) {
      const a = artFor(WHO[k]);
      if (a?.kind === 'route') { r.job = 'route'; r.route = routeOf([r.x, r.y], a.pts); }
      else if (a?.kind === 'block' && r.role === 'TE') r.job = 'protect';
      else { r.job = 'route'; r.route = routeOf([r.x, r.y], [[10, FORM[WHO[k]][1]]]); }
    }
    if (rbArt?.kind === 'route') { RB.job = 'route'; RB.route = routeOf([RB.x, RB.y], rbArt.pts); }
    else if (ctx.rush >= 5 || rbArt?.kind === 'block') RB.job = 'protect';
    else { RB.job = 'route'; const sd = rnd() < 0.5 ? 1 : -1; RB.route = routeOf([RB.x, RB.y], [[-2, sd * 4], [1, sd * 8]]); }
    for (const o of OL) o.job = 'protect';
    QB.job = 'qb';
  } else {
    for (const o of OL) o.job = 'runblock';
    for (const r of REC) r.job = 'block';
    const p = (qbRun ? qbArt : rbArt)?.pts ?? (ctx.run === 'outside' ? [[-4, 4], [0, 8], [6, 10]] : [[-3, 0.5], [2, 1.5], [8, 1]]);
    const dir = (ctx.run === 'outside' && !qbRun) ? (rnd() < 0.5 ? 1 : -1) : 1;
    runPath = p.map(q => at(q[0], q[1] * dir));
    QB.job = qbRun ? 'carry' : 'qb'; RB.job = qbRun ? 'fake' : 'carry';
  }

  // ---- the defense's call: who rushes, who covers what -------------------------------------
  const rushers: Ag[] = [...DL];
  // Extra rushers: linebackers, then the nickel; a zone keeps its deep men home.
  const blitzPool = man ? [LB[0], LB[1], DB[2], DB[3]] : [LB[0], LB[1], DB[2]];
  while (rushers.length < Math.max(3, Math.min(8, ctx.rush)) && blitzPool.length) rushers.push(blitzPool.shift()!);
  if (ctx.rush <= 3) { DL[1].job = 'zone'; DL[1].zone = at(7, -2); rushers.splice(rushers.indexOf(DL[1]), 1); }
  for (const d of rushers) d.job = 'rush';
  const sideOf = (k: number) => (FORM[WHO[k]][1] >= 0 ? 1 : -1);
  const setZone = (d: Ag, dx: number, dy: number, deep: boolean) => { if (d.job !== 'rush') { d.job = 'zone'; d.zone = at(dx, dy); d.deep = deep; } };
  if (man) {
    DB.forEach((d, k) => { if (d.job !== 'rush') { d.job = 'man'; d.man = REC[k]; } });
    // Anyone whose cover man blitzed is picked up by a linebacker who stayed home.
    const stay = LB.filter(l => l.job !== 'rush');
    DB.forEach((d, k) => { if (d.job === 'rush') { const l = stay.shift(); if (l) { l.job = 'man'; l.man = REC[k]; } } });
    const rbCover = stay.shift();
    if (rbCover) { rbCover.job = 'man'; rbCover.man = RB; }
    for (const l of stay) setZone(l, 6, 0, false);
    if (/Cover 0/.test(ctx.shell)) { if (FS.job !== 'rush') { FS.job = 'man'; FS.man = RB.job === 'route' && !rbCover ? RB : null; if (!FS.man) setZone(FS, 9, 0, false); } }
    else setZone(FS, 16, 0, true);
  } else if (prevent) {
    DB.forEach((d, k) => setZone(d, 22, sideOf(k) * (k < 2 ? 17 : 7), true));
    setZone(FS, 28, 0, true); LB.forEach((l, k) => setZone(l, 10, k ? 8 : -8, false));
  } else if (cov2) {
    setZone(DB[0], 6, sideOf(0) * 18, false); setZone(DB[1], 6, sideOf(1) * 18, false);
    setZone(DB[2], 9, sideOf(2) * 9, false); setZone(DB[3], 17, -12, true); setZone(FS, 17, 12, true);
    LB.forEach((l, k) => setZone(l, 8, k ? 4 : -4, false));
  } else if (cov4) {
    setZone(DB[0], 15, sideOf(0) * 18, true); setZone(DB[1], 15, sideOf(1) * 18, true);
    setZone(DB[2], 8, sideOf(2) * 11, false); setZone(DB[3], 15, -6, true); setZone(FS, 15, 6, true);
    LB.forEach((l, k) => setZone(l, 7, k ? 4 : -4, false));
  } else {
    setZone(DB[0], 15, sideOf(0) * 17, true); setZone(DB[1], 15, sideOf(1) * 17, true);
    setZone(DB[2], 8, sideOf(2) * 13, false); setZone(DB[3], 8, -sideOf(2) * 13, false); setZone(FS, 17, 0, true);
    LB.forEach((l, k) => setZone(l, 7, k ? 4 : -4, false));
  }
  for (const d of DEF) if (d.job === 'idle') setZone(d, 7, 0, false);

  // Protection: each rusher gets a blocker by where he lines up; the spare helps inside.
  const assignBlocks = (blockers: Ag[], threats: Ag[]) => {
    const free = [...blockers];
    for (const t of [...threats].sort((a, b) => Math.abs(a.y - MID) - Math.abs(b.y - MID))) {
      if (!free.length) break;
      const b = free.reduce((p, c) => (Math.abs(c.y - t.y) < Math.abs(p.y - t.y) ? c : p));
      b.man = t; free.splice(free.indexOf(b), 1);
    }
    for (const b of free) b.man = null;   // spare: helps whoever is closest
  };
  if (pass) {
    // Linemen take the defensive line; the spare lineman, tight end and back pick up blitzers.
    const dlR = rushers.filter(d => d.role === 'DL'), extra = rushers.filter(d => d.role !== 'DL');
    assignBlocks(OL, dlR);
    const spare = [...OL.filter(o => !o.man), ...REC.filter(r => r.job === 'protect'), ...(RB.job === 'protect' ? [RB] : [])];
    assignBlocks(spare, extra);
  }
  else {
    // Run blocking: linemen take the man over them; uncovered linemen climb to a linebacker.
    const fronts = [...DL, ...LB];
    assignBlocks(OL, DL);
    const lbs = [...LB];
    for (const o of OL) if (!o.man) { const l = lbs.sort((a, b) => hyp(a.x - o.x, a.y - o.y) - hyp(b.x - o.x, b.y - o.y)).shift(); o.man = l ?? null; }
    REC.forEach((r, k) => { r.man = r.role === 'TE' ? (fronts.find(f => f.job !== 'rush' && Math.abs(f.y - r.y) < 4) ?? DB[k]) : DB[k]; });
  }

  // ---- state ----------------------------------------------------------------------------
  let carrier = null as Ag | null, f = 0, t = 0;
  let ball: { mode: 'snap' | 'held' | 'air' | 'dead'; x: number; y: number; z: number; holder: Ag | null; from: [number, number]; to: [number, number]; t0: number; T: number; peak: number } =
    { mode: 'snap', x: at(0, 0)[0], y: MID, z: 0.3, holder: null, from: at(0, 0), to: at(...FORM.QB), t0: 0, T: gun ? 0.3 : 0.12, peak: gun ? 0.5 : 0 };
  let thrownAt = -1, caughtAt = -1, endAt = -1, tackleAt = -1, wrapAt = -1;
  const ballTrack: [number, number, number, number][] = [];
  let victim = null as Ag | null, offBalance = -1;
  let target = null as Ag | null, tackler = null as Ag | null, wrapper = null as Ag | null, swatter = null as Ag | null, picker = null as Ag | null;
  let complete = false, intercepted = false, dropped = false, defended = false, throwaway = false, hurried = false, scramble = false, sacked = false, oob = false, td = false;
  let catchX = 0, deadX = los, deadY = MID, handed = qbRun ? false : !pass ? false : true;
  const dropDepth = { screen: 1.2, quick: 1.4, short: 2.6, medium: 3.4, deep: 4.2 }[depth] + (ctx.pa ? 0.8 : 0);
  const setPt = at(gun ? FORM.QB[0] - dropDepth * 0.6 : -dropDepth - 3, 0);
  const minSet = { screen: 0.7, quick: 1.05, short: 1.5, medium: 1.85, deep: 2.15 }[depth] + (ctx.pa ? 0.45 : 0) + (gun ? 0 : 0.15);
  let setT = -1, reads: Ag[] = [], readI = 0, readFrom = 0, cycle = 0;
  const readTime = clamp(0.62 - (QB.r('AWR') - 70) * 0.006, 0.34, 0.7);
  const breaks: LiveRec['breaks'] = [], missed: LiveRec['missed'] = [], sheds: LiveRec['sheds'] = [], jukes: LiveRec['jukes'] = [];
  const lagPos = (a: Ag, lag: number): [number, number] => { const k = Math.max(0, f - Math.round(lag * HZ)); return [a.hx[k], a.hy[k]]; };
  const lagVel = (a: Ag, lag: number): [number, number] => { const k1 = Math.max(0, f - Math.round(lag * HZ)), k0 = Math.max(0, k1 - 6); const dt = (k1 - k0) / HZ || 1; return [(a.hx[k1] - a.hx[k0]) / dt, (a.hy[k1] - a.hy[k0]) / dt]; };
  const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => hyp(a.x - b.x, a.y - b.y);
  /** What a defender reads: where the receiver was a beat ago, carried on the way he was going.
   *  On a straight line that is where he is; at a break the defender is still running the old line. */
  const read = (a: Ag, lag: number): [number, number, number, number] => { const [px, py] = lagPos(a, lag), [vx, vy] = lagVel(a, lag); return [px + vx * lag, py + vy * lag, vx, vy]; };
  const free = (a: Ag) => !a.eng && t >= a.downUntil;

  // ---- movement --------------------------------------------------------------------------
  /** Steer toward (tx, ty) at `k` of top speed, within his acceleration and how sharply he can turn. */
  const want = new Map<Ag, { tx: number; ty: number; k: number; face?: [number, number]; arrive?: boolean }>();
  const go = (a: Ag, tx: number, ty: number, k = 1, face?: [number, number], arrive = true) => want.set(a, { tx, ty, k, face, arrive });
  const move = (a: Ag) => {
    if (t < a.downUntil || a.eng) { a.vx *= 0.8; a.vy *= 0.8; return; }
    const w = want.get(a);
    let dvx: number, dvy: number;
    if (!w) { dvx = -a.vx; dvy = -a.vy; }
    else {
      const dx = w.tx - a.x, dy = w.ty - a.y, d = hyp(dx, dy) || 1e-6;
      let spd = a.top * w.k * (a === carrier ? 0.97 : 1);
      if (w.arrive && d < 1.6) spd *= d / 1.6;
      // Backpedal or shuffle: facing one way, moving the other, he can't go full speed.
      if (w.face && (dx * w.face[0] + dy * w.face[1]) / d < -0.2) spd *= 0.72;
      dvx = (dx / d) * spd - a.vx; dvy = (dy / d) * spd - a.vy;
    }
    const sp = hyp(a.vx, a.vy);
    if (sp > 0.6) {
      const ux = a.vx / sp, uy = a.vy / sp;
      let al = dvx * ux + dvy * uy, pe = -dvx * uy + dvy * ux;
      al = clamp(al, -a.acc * 1.7 * DT, a.acc * DT);
      // The faster he goes the less he can turn: lateral grip falls off with speed.
      const lat = a.agi * (1.25 - 0.5 * Math.min(1, sp / a.top)) * DT;
      pe = clamp(pe, -lat, lat);
      a.vx += al * ux - pe * uy; a.vy += al * uy + pe * ux;
    } else {
      const m = hyp(dvx, dvy), lim = a.acc * DT;
      if (m > lim) { dvx *= lim / m; dvy *= lim / m; }
      a.vx += dvx; a.vy += dvy;
    }
  };

  // ---- blocking ----------------------------------------------------------------------------
  const passPow = (d: Ag) => Math.max(d.r('PMV'), d.r('FMV')) * 0.6 + d.r('STR') * 0.25 + d.r('ACC') * 0.15;
  const runPow = (d: Ag) => d.r('BSH') * 0.55 + d.r('STR') * 0.3 + d.r('PRC') * 0.15;
  const pbPow = (b: Ag) => b.r('PBK') * 0.65 + b.r('STR') * 0.2 + b.r('AWR') * 0.15;
  const rbPow = (b: Ag) => b.r('RBK') * 0.6 + b.r('STR') * 0.25 + b.r('IBL') * 0.15;
  const engage = (b: Ag, d: Ag) => {
    if (d.eng && d.eng !== b) { if (!d.helper) { d.helper = b; b.eng = d; } return; }
    b.eng = d; d.eng = b;
  };
  const release = (d: Ag) => { if (d.eng) d.eng.eng = null; if (d.helper) d.helper.eng = null; d.eng = null; d.helper = null; };
  /** A defender's goal while he's blocked: the quarterback on a pass rush, else the ball. */
  const goalOf = (d: Ag): [number, number] => {
    const b = carrier ?? (ball.holder ?? QB);
    if (pass && !carrier && d.job === 'rush') return [QB.x, QB.y];
    return [b.x, b.y];
  };
  const fight = (d: Ag) => {
    const b = d.eng!; const [gx, gy] = goalOf(d);
    let ux = gx - d.x, uy = gy - d.y; const gd = hyp(ux, uy) || 1; ux /= gd; uy /= gd;
    const rushing = pass && !carrier && d.job === 'rush';
    const D = rushing ? passPow(d) : runPow(d);
    let B = (rushing ? pbPow(b) : rbPow(b)) + (d.helper ? 14 : 0);
    if (!rushing && !pass && b.role !== 'OL') B -= 6;          // a receiver stalking a linebacker
    const edge = (D - B) / 10 + gauss() * 0.35;
    const v = rushing ? clamp(0.55 + edge * 0.8, -1.0, 2.8) : clamp(edge * 0.9, -2.4, 1.8);
    d.vx = ux * v; d.vy = uy * v;
    d.x += d.vx * DT; d.y += d.vy * DT;
    // Blockers stay locked on, between their man and where he wants to go.
    for (const bb of [b, d.helper]) if (bb) { const side = bb === d.helper ? 0.55 : 0; const px = d.x + ux * 0.95 - uy * side, py = d.y + uy * 0.95 + ux * side; bb.vx = (px - bb.x) * 8; bb.vy = (py - bb.y) * 8; bb.x += bb.vx * DT; bb.y += bb.vy * DT; }
    // The shed: technique beats the block on its own clock, much less often against a double.
    const open = !rushing && b.role !== 'OL' && b.role !== 'TE';   // blocks in space don't hold for long
    const h = (rushing ? 0.11 : open ? (pass ? 3.2 : 0.35) : 0.06) * Math.exp((D - B) / 7) * (d.helper ? 0.35 : 1);
    if (rnd() < h * DT || (!rushing && carrier && dist(d, carrier) < 1.1 && rnd() < 0.006)) {
      const bb = d.eng!; release(d);
      if (rushing) sheds.push({ f, rusher: d.i, blocker: bb.i, kind: (['swim', 'rip', 'spinmove'] as const)[Math.floor(rnd() * 3)] });
      bb.beatenUntil = t + 0.7; bb.vx *= 0.3; bb.vy *= 0.3;
      const side = (d.y - bb.y) >= 0 ? 1 : -1;
      d.vx = ux * 2.5 - uy * side * 1.2; d.vy = uy * 2.5 + ux * side * 1.2;
    }
  };

  // ---- quarterback reads ---------------------------------------------------------------------
  const projected = (r: Ag, T: number): [number, number] => {
    // Where he'll be: along the rest of his route at his speed (he's still running it).
    if (r.route && r.routeDone) {
      // Curls and comebacks: he settles at the spot and works back to it.
      const q = r.route[r.ri], d = hyp(q[0] - r.x, q[1] - r.y), m = Math.min(d, r.top * 0.5 * T);
      return d < 1e-3 ? [r.x, r.y] : [r.x + ((q[0] - r.x) / d) * m, r.y + ((q[1] - r.y) / d) * m];
    }
    if (r.route && r.ri < r.route.length) {
      // At route speed, accelerating toward it, less a beat for each break still to come.
      const v0 = hyp(r.vx, r.vy), vr = r.top * 0.82, tAcc = Math.max(0, (vr - v0) / r.acc);
      let left = tAcc >= T ? (v0 + r.acc * T / 2) * T : (v0 + vr) / 2 * tAcc + vr * (T - tAcc), x = r.x, y = r.y;
      if (t < r.plantUntil) left -= (r.plantUntil - t) * vr * 0.6;
      // Still turning into the new direction: the turn costs ground.
      { const q = r.route[r.ri], qx = q[0] - r.x, qy = q[1] - r.y, qd = hyp(qx, qy) || 1;
        if (v0 > 1) { const cosA = (r.vx * qx + r.vy * qy) / (v0 * qd); left -= vr * 0.32 * (1 - cosA); } }
      for (let k = r.ri; k < r.route.length && left > 0; k++) {
        const [px, py] = r.route[k], d = hyp(px - x, py - y);
        if (k > r.ri && k < r.route.length - 1) left -= vr * 0.12;
        if (d >= left) { x += ((px - x) / d) * left; y += ((py - y) / d) * left; left = 0; } else { x = px; y = py; left -= d; }
      }
      return [x, clamp(y, 0.8, FW - 0.8)];
    }
    return [r.x + r.vx * T, clamp(r.y + r.vy * T, 0.8, FW - 0.8)];
  };
  const ballSpeed = (d: number) => (d < 12 ? 19 : d < 25 ? 18 : 16.5) + QB.r('THP') * (d < 12 ? 0.11 : d < 25 ? 0.095 : 0.085);
  const aimFor = (r: Ag): { p: [number, number]; T: number } => {
    let T = 0.8, p = projected(r, T);
    for (let k = 0; k < 3; k++) { const d = hyp(p[0] - QB.x, p[1] - QB.y); T = 0.08 + d / ballSpeed(d); p = projected(r, T); }
    return { p, T };
  };
  /** Has his route declared? Past the first break, or well into a single-cut route. */
  const developed0 = (r: Ag) => {
    if (!r.route) return false;
    if (r.routeDone || r.ri >= 3) return true;
    const p0 = r.route[0], p1 = r.route[1], seg = hyp(p1[0] - p0[0], p1[1] - p0[1]), gone = hyp(r.x - p0[0], r.y - p0[1]);
    return r.route.length <= 3 ? gone > Math.min(12, seg * 0.6) : r.ri >= 2 && gone > seg * 0.9;
  };
  /** How open he'll be when the ball gets there: room to the nearest defender who can close. */
  const openness = (r: Ag): number => {
    const { p, T } = aimFor(r);
    let room = 9;
    for (const d of DEF) {
      if (d.job === 'rush' && !d.zone) continue;
      if (d.eng || t < d.downUntil) continue;
      const fx = d.x + d.vx * Math.min(T, 0.4), fy = d.y + d.vy * Math.min(T, 0.4);
      const closes = Math.max(0, T - d.react) * d.top * 0.55;
      room = Math.min(room, hyp(fx - p[0], fy - p[1]) - closes);
      // Lurking in the throwing lane.
      const lx = p[0] - QB.x, ly = p[1] - QB.y, L = hyp(lx, ly) || 1;
      const u = ((d.x - QB.x) * lx + (d.y - QB.y) * ly) / (L * L);
      if (u > 0.25 && u < 0.85) { const off = Math.abs((d.x - QB.x) * ly - (d.y - QB.y) * lx) / L; if (off < 1.1 && L > 8) room = Math.min(room, off - 0.6); }
    }
    return room;
  };
  const pressure = () => { let m = 9; for (const d of DEF) if ((d.job === 'rush' || d.job === 'pursue') && free(d)) m = Math.min(m, dist(d, QB)); return m; };
  const throwTo = (r: Ag, rushed: boolean) => {
    const { p } = aimFor(r);
    const d = hyp(p[0] - QB.x, p[1] - QB.y);
    const moving = hyp(QB.vx, QB.vy) > 2.5;
    let acc = d < 11 ? QB.r('SAC') : d < 22 ? QB.r('MAC') : QB.r('DAC');
    if (moving) acc = acc * 0.6 + QB.r('TOR') * 0.4 - 3;
    if (rushed) acc = acc * 0.55 + QB.r('TUP') * 0.45 - (ctx.has('QB', 'Fearless') ? 1 : 5);
    // Error grows with distance, and faster on deep balls: touch and timing over 30 yards is hard.
    let sigma = (0.2 + d * 0.017 + Math.pow(Math.max(0, d - 15), 1.5) * 0.013) * clamp(1.65 - acc * 0.0105, 0.5, 1.3) * (rushed ? 1.4 : 1);
    sigma *= 1 + (ctx.wind > 15 ? (d > 22 ? 0.35 : 0.12) : 0) + (ctx.wet ? 0.12 : 0);
    const ux = (p[0] - QB.x) / (d || 1), uy = (p[1] - QB.y) / (d || 1);
    const ea = gauss() * sigma * 1.25, ep = gauss() * sigma;
    const to: [number, number] = [p[0] + ux * ea - uy * ep, clamp(p[1] + uy * ea + ux * ep, -1, FW + 1)];
    const dd = hyp(to[0] - QB.x, to[1] - QB.y), T = 0.08 + dd / ballSpeed(dd);
    ball = { mode: 'air', x: QB.x, y: QB.y, z: 2, holder: null, from: [QB.x + s * 0.3, QB.y], to, t0: t, T, peak: dd < 12 ? 0.3 + dd * 0.03 : dd < 25 ? 1 + dd * 0.08 : 2 + dd * 0.13 };
    thrownAt = t; target = r; hurried = rushed;
  };
  const throwAway = () => {
    const side = QB.y > MID ? FW + 3 : -3;
    const to: [number, number] = [QB.x + s * 8, side];
    const dd = hyp(to[0] - QB.x, to[1] - QB.y);
    ball = { mode: 'air', x: QB.x, y: QB.y, z: 2, holder: null, from: [QB.x, QB.y], to, t0: t, T: dd / 22, peak: 2 };
    thrownAt = t; throwaway = true; target = null;
  };

  // ---- the ball carrier: the lane with the most room ---------------------------------------
  const carryDir = (c: Ag): [number, number] => {
    const vis = c.r('BCV');
    let best = -1e9, bx: number = s, by = 0;
    const base = Math.atan2(0, c.off ? s : -s);
    const nearSide = Math.min(c.y, FW - c.y);
    for (let k = -6; k <= 6; k++) {
      const th = base + k * (Math.PI / 14), ux = Math.cos(th), uy = Math.sin(th);
      let score = ux * (c.off ? s : -s) * 6;
      for (const L of [2.5, 5, 8]) {
        const px = c.x + ux * L, py = c.y + uy * L;
        if (py < 0.6 || py > FW - 0.6) score -= ctx.hurry ? 0 : 6;
        for (const d of (c.off ? DEF : OFF)) {
          if (t < d.downUntil) continue;
          const ahead = (c.off ? s : -s) * (d.x - c.x);
          if (ahead < -1.5 && hyp(d.x - c.x, d.y - c.y) > 2) continue;     // behind him: he can't see them
          const lead = L / c.top;
          const dx = d.x + d.vx * lead * 0.6 - px, dy = d.y + d.vy * lead * 0.6 - py;
          const dd = hyp(dx, dy);
          score -= (d.eng ? 0.9 : 3.2) * Math.exp(-dd / 1.6) * (L === 2.5 ? 1.4 : L === 5 ? 1 : 0.6);
        }
      }
      if (ctx.hurry && nearSide < 8 && (Math.sin(th) * (c.y < MID ? -1 : 1)) > 0.3) score += 1.5;   // get out, stop the clock
      score += gauss() * (100 - vis) / 60;
      if (score > best) { best = score; bx = ux; by = uy; }
    }
    return [c.x + bx * 6, c.y + by * 6];
  };

  /** Where a pursuer meets the carrier: the earliest point on his path the pursuer can reach. */
  const cutoff = (d: Ag, c: Ag): [number, number] => {
    if (dist(d, c) < 2) return [c.x, c.y];
    // The carrier's path: his current line, bending toward the goal he runs for.
    const gx = c.off ? s : -s;
    const sp = Math.max(4, hyp(c.vx, c.vy)), vx = (c.vx / sp) * 0.7 + gx * 0.3, vy = (c.vy / sp) * 0.7, n = hyp(vx, vy) || 1;
    const ux = (vx / n) * sp, uy = (vy / n) * sp;
    for (let T = 0.1; T <= 3; T += 0.1) {
      const px = c.x + ux * T, py = c.y + uy * T;
      if (hyp(px - d.x, py - d.y) <= d.top * T * 0.95 + 0.6) return [px, py];
    }
    return [c.x + ux * 1.2, c.y + uy * 1.2];
  };
  // ---- tackling ---------------------------------------------------------------------------
  /** The carrier's answer to a man squaring him up: a juke or spin (elusiveness) or a stiff-arm (power). */
  const makeMiss = (d: Ag, c: Ag): boolean => {
    if (c.role === 'OL' || c.role === 'DL' || (c === QB && pass && !scramble)) return false;
    const front = (c.off ? s : -s) * (d.x - c.x) > -0.3, sp = hyp(c.vx, c.vy);
    if (!front || sp < 3 || t < offBalance) return false;
    const def = d.r('TAK') * 0.5 + d.r('PUR') * 0.3 + d.r('PRC') * 0.2;
    const shake = c.r('ELU') * 0.6 + c.r('AGI') * 0.4, power = c.r('TRK') * 0.6 + c.r('STR') * 0.4;
    const power0 = power - 8 > shake;
    const p = sig(((power0 ? power : shake) - def) / 12 - (pass ? 2.3 : 1.5));
    if (rnd() >= p) return false;
    const kind = power0 ? 'stiff' : rnd() < 0.75 ? 'juke' : 'spin';
    d.downUntil = t + (kind === 'stiff' ? 0.8 : 0.55); d.tackleCD = t + 0.9; d.vx *= 0.3; d.vy *= 0.3;
    if (kind !== 'stiff') { c.vx *= 0.85; c.vy *= 0.85; }
    jukes.push({ f, who: d.i, kind });
    return true;
  };
  const tryTackle = (d: Ag, c: Ag, dive = false) => {
    if (!dive && makeMiss(d, c)) return;
    d.tackleCD = t + 0.9;
    const gang = DEF.filter(o => o !== d && free(o) && dist(o, c) < 2.2).length;
    const arm = d.eng ? (d.eng.role === 'OL' ? 2.3 : 1.1) : 0;
    const closing = ((d.vx - c.vx) * (c.x - d.x) + (d.vy - c.vy) * (c.y - d.y)) / (dist(d, c) || 1);
    const tk = d.r('TAK') * 0.55 + d.r('HIT') * 0.15 + d.r('PUR') * 0.1 + d.r('STR') * 0.2;
    const ev = c.r('BTK') * 0.45 + c.r('ELU') * 0.3 + c.r('TRK') * 0.25 + (c.role === 'OL' || c.role === 'DL' ? -20 : 0);
    // A carrier who just broke one is off balance for the next man; a dive from the side is a lower percentage.
    const p = sig((tk - ev) / 18 + 1.9 + gang * 0.5 - arm + clamp(closing / 6, -0.3, 0.4) - (c === QB && pass && !carrier ? -0.6 : 0) + (t < offBalance ? 1.1 : 0) - (dive ? 0.4 : 0));
    if (rnd() < p) { wrapper = d; wrapAt = t; tackler = d; victim = c; d.vx = c.vx; d.vy = c.vy; }
    else { d.downUntil = t + (dive ? 0.9 : 0.55); d.vx *= 0.3; d.vy *= 0.3; c.vx *= 0.75; c.vy *= 0.75; offBalance = t + 0.6; missed.push({ f, who: d.i }); }
  };
  const whistle = (x: number, y: number) => { if (endAt < 0) { endAt = t; deadX = x; deadY = y; } };

  // ---- what each man is doing, and where he's looking (for the animation) --------------------
  const actOf = (a: Ag): number => {
    if (t < a.downUntil || (victim === a && endAt >= 0)) return ACT.down;
    if (t < 0.02) return ACT.stance;
    if (a.eng) return a.off ? ACT.block : ACT.fight;
    if (a === carrier || ball.holder === a) return ACT.carry;
    const w = want.get(a), sp = hyp(a.vx, a.vy);
    if (w?.face && sp > 0.8 && (a.vx * w.face[0] + a.vy * w.face[1]) / sp < -0.2) return ACT.backpedal;
    return sp > 0.6 ? ACT.run : ACT.stand;
  };
  const faceOf = (a: Ag) => {
    // Blocks: square to your man. Backpedal / pass sets: toward where you're looking.
    if (a.eng) { a.fc = a.eng.x >= a.x ? 1 : -1; return; }
    const w = want.get(a);
    if (w?.face) { a.fc = w.face[0] >= 0 ? 1 : -1; return; }
    if (Math.abs(a.vx) > 0.9) a.fc = a.vx > 0 ? 1 : -1;
    else if (hyp(a.vx, a.vy) < 0.5 && !a.off && endAt < 0) a.fc = (-s) as 1 | -1;   // set: facing the offense
  };
  for (const a of agents) a.fc = (a.off ? s : -s) as 1 | -1;

  // ---- the play ------------------------------------------------------------------------------
  for (f = 0; f < MAXF - 1; f++, t += DT) {
    for (const a of agents) { a.hx[f] = a.x; a.hy[f] = a.y; a.act[f] = actOf(a); a.face[f] = a.fc; }
    const live = endAt < 0;
    if (!live && t > endAt + AFTER) break;
    want.clear();

    // The ball.
    if (ball.mode === 'snap') {
      const q = Math.min(1, t / ball.T);
      ball.x = ball.from[0] + (QB.x - ball.from[0]) * q; ball.y = ball.from[1] + (QB.y - ball.from[1]) * q; ball.z = 0.3 + q * 0.8 + Math.sin(Math.PI * q) * ball.peak;
      if (q >= 1) { ball.mode = 'held'; ball.holder = QB; }
    } else if (ball.mode === 'held' && ball.holder) { ball.x = ball.holder.x; ball.y = ball.holder.y; ball.z = 1.1; }
    else if (ball.mode === 'air') {
      const q = Math.min(1, (t - ball.t0) / ball.T);
      ball.x = ball.from[0] + (ball.to[0] - ball.from[0]) * q; ball.y = ball.from[1] + (ball.to[1] - ball.from[1]) * q;
      ball.z = 2 - q * 0.7 + Math.sin(Math.PI * q) * ball.peak;
      if (q >= 1 && live) {
        // The catch point: who is there, and how well does each of them catch?
        const P = { x: ball.to[0], y: ball.to[1] };
        if (throwaway || P.y < 0 || P.y > FW) { ball.mode = 'dead'; whistle(los, MID); }
        else {
          const reach = 1.25;
          const r = target!, dr = dist(r, P);
          const ds = DEF.filter(d => t >= d.downUntil).map(d => ({ d, dd: dist(d, P) })).sort((a, b) => a.dd - b.dd);
          const near = ds[0];
          const contested = near && dist(near.d, r) < 1.5 && dr < reach;
          let res: 'catch' | 'int' | 'pbu' | 'drop' | 'inc' = 'inc';
          if (near && near.dd < reach && (near.dd < dr - 0.2 || contested)) {
            const ahead = near.dd < dr - 0.2;
            const pInt = sig((near.d.r('CTH') - 65) / 12 - 1.7 + (ahead ? 1.0 : 0) + (ctx.has(near.d.slot, 'Ball Hawk') ? 0.4 : 0));
            const pBu = sig((near.d.r(man ? 'MCV' : 'ZCV') - 70) / 12 - 0.35 + (ahead ? 0.9 : 0) - near.dd * 0.9);
            const u = rnd();
            if (u < pInt) res = 'int'; else if (u < pInt + pBu * (1 - pInt)) res = 'pbu';
          }
          if (res === 'inc' && dr < reach) {
            const cv = r.r('CTH') * 0.6 + r.r(contested ? 'CIT' : 'CTH') * 0.4;
            const pC = sig((cv - 70) / 11 + 2.2 - dr * 1.1 - (contested ? 1.35 - (r.r('CIT') - 70) / 30 : 0) - (ctx.wet ? 0.25 : 0) - (hurried ? 0.15 : 0));
            if (rnd() < pC) res = 'catch'; else res = pC > 0.72 ? 'drop' : 'inc';
          }
          if (res === 'catch') { complete = true; carrier = r; ball.mode = 'held'; ball.holder = r; caughtAt = t; catchX = P.x; }
          else if (res === 'int') { intercepted = true; picker = near.d; carrier = near.d; ball.mode = 'held'; ball.holder = near.d; caughtAt = t; catchX = P.x; }
          else { defended = res === 'pbu'; dropped = res === 'drop'; if (defended) swatter = near.d; ball.mode = 'dead'; caughtAt = t; catchX = P.x; whistle(los, MID); }
        }
      }
    }

    // The handoff on runs.
    if (!pass && !handed && live) {
      const mesh = runPath[0];
      if (!qbRun) {
        go(QB, mesh[0] + s * 0.6, mesh[1], 0.75);
        if (t > 0.35 && (dist(QB, RB) < 1.1 || t > 1.0)) { handed = true; carrier = RB; ball.mode = 'held'; ball.holder = RB; }
      } else if (t > 0.3) { handed = true; carrier = QB; }
    }

    // ---- everyone's intent --------------------------------------------------------------
    if (live) {
      const c: Ag | null = carrier;
      // Offense.
      for (const a of OFF) {
        if (a === c) {
          if (a.job === 'carry' && !pass && down(a.x) < 0.5 && runPath.length) {
            // Press the designed hole first, then read it.
            const k = runPath.findIndex(p => down(p[0]) > down(a.x) + 0.8); const p = runPath[Math.max(1, k)] ?? runPath[runPath.length - 1];
            const [lx, ly] = carryDir(a), w = clamp((a.r('BCV') - 60) / 60, 0.2, 0.65); go(a, p[0] * (1 - w) + lx * w, p[1] * (1 - w) + ly * w, 1, undefined, false);
          } else { const [lx, ly] = carryDir(a); go(a, lx, ly, 1, undefined, false); }
          continue;
        }
        if (a.eng) continue;
        if (c && !c.off) {
          // A turnover: everyone on offense turns into a tackler.
          const lead = clamp(dist(a, c) / a.top, 0, 1.2);
          go(a, c.x + c.vx * lead, c.y + c.vy * lead, 1, undefined, false);
          if (dist(a, c) < 1.05 && t >= a.tackleCD && !wrapper) tryTackle(a, c);
          continue;
        }
        if (a.job === 'carry' && !handed && runPath.length) {
          // The back takes his path to the mesh point and on toward the hole.
          const k = runPath.findIndex(p => hyp(p[0] - a.x, p[1] - a.y) > 1.2);
          const p = runPath[Math.max(0, k)]; go(a, p[0], p[1], t < 0.2 ? 0.6 : 0.85, undefined, false); continue;
        }
        if (a === QB) {
          if (scramble || sacked) continue;
          if (!pass) { if (handed && !qbRun) go(QB, QB.x - s * 2, QB.y + (RB.y > QB.y ? -3 : 3), 0.5); continue; }
          if (thrownAt >= 0) { go(QB, QB.x, QB.y, 0); continue; }
          // The drop, then sit in the pocket; step up away from edge pressure.
          const p = pressure();
          if (setT < 0) { go(QB, setPt[0], setPt[1], 0.62, [s, 0]); if ((dist(QB, { x: setPt[0], y: setPt[1] }) < 0.4 && t > minSet) || t > minSet + 0.6) setT = t; }
          else { const step = p < 3.5 ? 0.8 : 0; go(QB, setPt[0] + s * step, setPt[1], 0.35, [s, 0]); }
          continue;
        }
        if (a.job === 'protect') {
          const m = a.man && a.man.job === 'rush' && free(a.man) ? a.man : DEF.filter(d => d.job === 'rush' && (!d.eng || !d.helper) && dist(d, QB) < 9).sort((x, y) => dist(x, a) - dist(y, a))[0];
          if (!m || t < a.beatenUntil) { go(a, QB.x + s * 2.2, a.y, 0.5, [s, 0]); continue; }
          const dx = QB.x - m.x, dy = QB.y - m.y, d = hyp(dx, dy) || 1;
          let tx = m.x + (dx / d) * 0.95, ty = m.y + (dy / d) * 0.95;
          if (s * (tx - los) > -0.3) tx = los - s * 0.3;
          go(a, tx, ty, 1, [s, 0]);
          if (dist(a, m) < 1.15 && t > 0.15 && s * (m.x - a.x) > -0.3) engage(a, m);
          continue;
        }
        if (a.job === 'runblock' || (a.job === 'block' && !pass) || (c && c.off && c !== a && a.job !== 'qb')) {
          // Drive your man; once the ball is out, pick off whoever is closing on the carrier.
          let m = a.man && t >= a.man.downUntil ? a.man : null;
          if (c && c.off && (pass || down(c.x) > 1)) m = DEF.filter(d => free(d) && !d.eng && dist(d, c) < 9 && dist(d, a) < 5 && s * (d.x - c.x) > -1).sort((x, y) => dist(x, a) - dist(y, a))[0] ?? (a.role === 'OL' ? m : null);
          if (!m || t < a.beatenUntil) { go(a, a.x + s * 0.5, a.y, 0.4); continue; }
          const gx = c ? c.x : QB.x, gy = c ? c.y : QB.y, dx = gx - m.x, dy = gy - m.y, d = hyp(dx, dy) || 1;
          go(a, m.x + (dx / d) * 0.9, m.y + (dy / d) * 0.9, 1, [s, 0]);
          if (dist(a, m) < 1.15 && t > 0.1 && (a.role === 'OL' ? t > 0.05 : true)) engage(a, m);
          continue;
        }
        if (a.job === 'route' && a.route) {
          if (thrownAt >= 0 && a === target && ball.mode === 'air') {
            // Track the ball: adjust to where it is coming down.
            const left = Math.max(0.05, ball.t0 + ball.T - t);
            const d = hyp(ball.to[0] - a.x, ball.to[1] - a.y);
            if (t - thrownAt > 0.12) go(a, ball.to[0], ball.to[1], clamp(d / left / a.top + 0.15, 0.4, 1), undefined, true);
            else { const q = projected(a, 0.4); go(a, q[0], q[1], 1, undefined, false); }
            continue;
          }
          // The jam at the line.
          const jam = press && t < 0.9 ? DB[REC.indexOf(a)] : null;
          if (jam && dist(jam, a) < 1.4 && t < 0.25 + clamp((jam.r('PRS') - a.r('RLS')) * 0.012, 0, 0.6)) { go(a, a.x + s * 1, a.y, 0.3); continue; }
          if (t < a.plantUntil) { go(a, a.x + a.vx * 0.2, a.y + a.vy * 0.2, 0.35); continue; }
          const p = a.route[Math.min(a.ri, a.route.length - 1)];
          const d = hyp(p[0] - a.x, p[1] - a.y);
          if (d < 1.0 && a.ri < a.route.length - 1) {
            const n = a.route[a.ri + 1], p0 = a.route[a.ri - 1];
            const a1 = Math.atan2(p[1] - p0[1], p[0] - p0[0]), a2 = Math.atan2(n[1] - p[1], n[0] - p[0]);
            let da = Math.abs(a2 - a1); if (da > Math.PI) da = 2 * Math.PI - da;
            if (da > 0.85) { a.plantUntil = t + clamp(0.24 - a.r('RTE') * 0.0016, 0.07, 0.2); breaks.push({ f, who: a.i, back: s * (n[0] - p[0]) < -0.3 }); }
            a.ri++;
            // Comebacks and curls: he settles and works back to the ball.
            if (s * (n[0] - p[0]) < -0.3 && a.ri === a.route.length - 2) a.routeDone = true;
          }
          if (a.routeDone) { const q = a.route[a.ri]; go(a, q[0], q[1], 0.5); continue; }
          // Throttle down into a sharp break so he cuts at the spot instead of rounding it off.
          let k = 0.82;
          if (a.ri < a.route.length - 1) {
            const n = a.route[a.ri + 1], p0 = a.route[a.ri - 1];
            let da = Math.abs(Math.atan2(n[1] - p[1], n[0] - p[0]) - Math.atan2(p[1] - p0[1], p[0] - p0[0])); if (da > Math.PI) da = 2 * Math.PI - da;
            if (da > 0.85) {
              const v = hyp(a.vx, a.vy), vb = a.top * clamp(0.3 + a.r('RTE') * 0.0035 - (da - 0.85) * 0.12, 0.25, 0.65);
              const brake = Math.max(0, (v * v - vb * vb) / (2 * a.acc * 1.5)) + 0.5;
              if (d < brake) k = vb / a.top;
            }
          }
          go(a, p[0], p[1], k, undefined, false);
          continue;
        }
        if (a.job === 'fake') { go(a, a.x + s * 2, a.y + (QB.y > a.y ? -1 : 1) * 2, 0.7); continue; }
        go(a, a.x, a.y, 0);
      }
      // Defense.
      for (const d of DEF) {
        if (d.eng || t < d.downUntil) continue;
        if (d === c) { const [lx, ly] = carryDir(d); go(d, lx, ly, 1, undefined, false); continue; }   // returning a pick
        // Read the run (or the catch): after his reaction time everyone goes to the ball.
        // Linemen feel it at once, linebackers read their key, the secondary reads pass first.
        const readRun = !pass && handed && t > (d.role === 'DL' ? 0.25 : 0.35 + d.react + (d.role === 'DB' || d.role === 'S' ? 0.3 : 0) + (ctx.pa ? 0.3 : 0));
        const ballOut = c && c.off && (c !== QB || scramble) && (pass ? t > (caughtAt >= 0 ? caughtAt : t) + d.react : true);
        if (c && !c.off) { const o = OFF.filter(x => x !== c).sort((x, y) => dist(x, d) - dist(y, d))[0]; if (o) go(d, o.x, o.y, 0.9); continue; }   // turnover: block for the returner
        if ((readRun || ballOut || (scramble && t > d.react + 0.3)) && c) {
          // Pursuit: the angle that meets him, not a chase from behind.
          const [tx, ty] = cutoff(d, c);
          go(d, tx, ty, 1, undefined, false);
          if (dist(d, c) < 1.2 && t >= d.tackleCD && !wrapper) tryTackle(d, c);
          continue;
        }
        if (d.job === 'rush') {
          // Rush through the gap at the quarterback (on a run, into the backfield).
          const tgt = pass ? QB : (c ?? QB);
          const edge = d === DL[0] || d === DL[3] ? (d.y > MID ? 1 : -1) * Math.max(0, 2.8 - t * 1.4) : 0;
          go(d, tgt.x + s * 0.4, tgt.y + edge, 1, undefined, false);
          if ((tgt === QB) && dist(d, QB) < 1.0 && t >= d.tackleCD && !wrapper && ball.holder === QB) tryTackle(d, QB);
          continue;
        }
        // The ball is in the air: break on it after his reaction time if he can get there.
        if (ball.mode === 'air' && !throwaway && t - thrownAt > d.react) {
          const left = ball.t0 + ball.T - t, dl = hyp(ball.to[0] - d.x, ball.to[1] - d.y);
          if (dl < 2 + d.top * left * 1.1) { go(d, ball.to[0], ball.to[1], 1, undefined, dl > 1); continue; }
          // Can't get there in time: rally to it, filling the alley in front of the catch.
          if (d.man !== target || !target) { const lead = Math.min(7, dl * 0.35); go(d, ball.to[0] + s * lead, ball.to[1] + (MID - ball.to[1]) * 0.1, 1, undefined, false); continue; }
        }
        if (d.job === 'man' && d.man) {
          const r = d.man;
          // He plays what he saw a beat ago: the receiver's break buys the separation.
          const [sx, sy, svx, svy] = read(r, d.react);
          const cushion = press && t < 0.6 ? 0.8 : clamp(4.5 - down(r.x) * 0.45, 0.9, 4.5);
          const tx = sx + svx * 0.35 + s * cushion, ty = sy + svy * 0.35 + (sy > MID ? -0.4 : 0.4);
          const threatened = s * (d.x - r.x) < 3 || hyp(svx, svy) > 7;
          go(d, tx, ty, 1, threatened ? undefined : [-s, 0], false);
          continue;
        }
        if (d.job === 'zone' && d.zone) {
          const [zx, zy] = d.zone;
          if (!pass || (!handed && !pass)) { go(d, zx - s * 3, zy, 0.4, [-s, 0]); continue; }
          // Read the quarterback's eyes a little, then match whoever enters the zone.
          const eyes = reads[readI];
          const inZone = [...REC, RB].filter(r => r.job === 'route' && hyp(r.x - zx, r.y - zy) < (d.deep ? 11 : 8.5));
          let m = d.carry && inZone.includes(d.carry) ? d.carry : null;
          if (!m && inZone.length) m = d.deep ? inZone.sort((a, b) => down(b.x) - down(a.x))[0] : inZone.sort((a, b) => dist(a, d) - dist(b, d))[0];
          d.carry = m;
          if (m && t > 0.5) {
            const [sx, sy, svx, svy] = read(m, d.react);
            // Deep zones stay on top; underneath zones stay between him and the quarterback.
            // Deep: never let him get even; the faster he comes, the more cushion.
            const tx = d.deep ? los + s * Math.max(down(sx) + 3 + hyp(svx, svy) * 0.45, down(zx)) : sx - s * 1.0 + svx * 0.25;
            go(d, tx, sy + svy * 0.25, 1, s * (d.x - m.x) < (d.deep ? 6 : 3) ? undefined : [-s, 0], false);
          } else {
            const shade = eyes && setT >= 0 ? clamp((eyes.y - zy) * 0.25 * (d.r('PRC') / 90), -3, 3) : 0;
            go(d, zx, zy + shade, 0.85, [-s, 0]);
          }
          continue;
        }
        go(d, d.x, d.y, 0);
      }

      // Contact: anyone who gets to the ball carrier tries to bring him down, whatever his job.
      if (c && !wrapper && (c !== QB || scramble || !pass)) {
        const tacklers = c.off ? DEF : OFF;
        for (const d of tacklers) if (d !== c && t >= d.downUntil && t >= d.tackleCD && dist(d, c) < 1.15 && (!d.eng || dist(d, c) < (d.eng.role === 'OL' ? 0.75 : 1.05))) { tryTackle(d, c); if (wrapper) break; }
        // Running alongside him: lay out for it (or knock him out of bounds).
        if (!wrapper) for (const d of tacklers) if (d !== c && !d.eng && t >= d.downUntil && t >= d.tackleCD && dist(d, c) < 2.3 && dist(d, c) >= 1.15 && hyp(d.vx - c.vx, d.vy - c.vy) < 3.5 && hyp(d.vx, d.vy) > 4) { tryTackle(d, c, true); if (wrapper) break; }
      }
      // ---- the quarterback's decision --------------------------------------------------
      if (pass && ball.holder === QB && thrownAt < 0 && !scramble && !sacked && !wrapper && setT >= 0) {
        if (!reads.length) {
          const pri = ({ X: 'X', Z: 'Z', SLOT: 'S', TE: 'TE', RB: 'RB' } as const)[ctx.primary ?? 'X'];
          const want0 = art.find(a => a.primary)?.who ?? pri;
          const pool = [...REC, RB].filter(r => r.job === 'route');
          const tgtDepth = { screen: 0, quick: 5, short: 8, medium: 13, deep: 22 }[depth];
          const depthOf = (r: Ag) => r.route ? Math.max(...r.route.slice(0, -1).map(p => down(p[0]))) : 0;
          // The designed first read, then the rest of the route tree, then the back as the outlet.
          void tgtDepth;
          reads = pool.sort((a, b) => (b.slot === want0 ? 1 : 0) - (a.slot === want0 ? 1 : 0) || (a === RB ? 1 : 0) - (b === RB ? 1 : 0) || depthOf(a) - depthOf(b));
          readFrom = t;
        }
        const p = pressure(), since = t - setT;
        const awr = QB.r('AWR'), noise = (100 - awr) / 45;
        const r: Ag | undefined = reads[readI];
        const need = clamp(2.8 - since * 0.45 - cycle * 0.5 - (p < 3 ? 0.8 : 0) - (ctx.has('QB', 'Gunslinger') ? 0.5 : 0), 0.3, 2.1);
        const developed = r && developed0(r);
        // A rusher coming clean: get it out now to whoever is open (the hot read).
        const unblocked = DEF.some(d => d.job === 'rush' && free(d) && dist(d, QB) < 5.5 && t - (d.beatenUntil || 0) > 0 && !OFF.some(o => o.eng === d));
        const hot = unblocked && awr > 60 + rnd() * 25 ? reads.map(x => ({ x, o: openness(x) })).filter(o => o.x.ri >= 1 && t > 0.45).sort((a, b) => b.o - a.o)[0] : undefined;
        if (hot && hot.o > 0.2) throwTo(hot.x, p < 2.2);
        // Deeper throws need a bigger window: the ball is in the air longer and the safety is coming.
        else if (r && developed && openness(r) + gauss() * noise * 0.4 > need + Math.max(0, down(aimFor(r).p[0]) - 7) * 0.12 - (r === RB ? 0.9 : 0)) throwTo(r, p < 2.2);
        else if (RB.job === 'route' && reads.includes(RB) && (p < 3.2 || since > 1.6) && developed0(RB) && openness(RB) > 1.2 && rnd() < 0.12) throwTo(RB, p < 2.2);
        else if (p < 1.4) {
          // He has to do something now.
          const best = reads.map(x => ({ x, o: openness(x) })).sort((a, b) => b.o - a.o)[0];
          const lane = (() => { for (const k of [0, 1, -1, 2, -2]) { const th = Math.atan2(0, s) + k * 0.6; const px = QB.x + Math.cos(th) * 3, py = QB.y + Math.sin(th) * 3; if (DEF.every(d => !free(d) || hyp(d.x - px, d.y - py) > 2.6)) return true; } return false; })();
          if (best && best.o > 0.4) throwTo(best.x, true);
          else if (lane && (QB.r('SPD') >= 70 || rnd() < 0.25)) { scramble = true; carrier = QB; }
          else if (rnd() < clamp((awr - 50) / 60, 0.1, 0.8) * DT * 7) throwAway();
        } else if (t - readFrom > readTime) {
          readI++; readFrom = t;
          if (readI >= reads.length) { readI = 0; cycle++; }
          if (since > 4.2) { const lane = DEF.every(d => !free(d) || dist(d, QB) > 4); if (lane && QB.r('SPD') >= 65) { scramble = true; carrier = QB; } else throwAway(); }
        }
      }
    } else {
      // After the whistle: everyone eases up.
      for (const a of agents) if (a !== wrapper) go(a, a.x + a.vx * 0.3, a.y + a.vy * 0.3, 0.25);
    }

    ballTrack.push([ball.x, ball.y, ball.z, ball.mode === 'held' && ball.holder ? ball.holder.i : -1]);
    // ---- engagements, movement, bodies ------------------------------------------------------
    for (const d of DEF) if (d.eng) { if (!live || t < d.downUntil) release(d); else fight(d); }
    for (const a of agents) if (!a.eng) move(a);
    if (wrapper && victim) {
      // Wrapped up: he drives for a step or two with the tackler hanging on, then goes down.
      const v0 = victim, k = 0.55 + (v0.r('TRK') - wrapper.r('TAK')) * 0.004;
      v0.vx *= 0.93; v0.vy *= 0.93; const v = hyp(v0.vx, v0.vy), cap = clamp(k, 0.3, 0.8) * 5;
      if (v > cap) { v0.vx *= cap / v; v0.vy *= cap / v; }
      // The tackler closes onto him (from the side he came in) instead of snapping into place.
      const side = wrapper.y >= v0.y ? 0.3 : -0.3, ax = v0.x - (v0.off ? s : -s) * 0.5, ay = v0.y + side;
      const gx = ax - wrapper.x, gy = ay - wrapper.y, gd = hyp(gx, gy), stepMax = 9 * DT;
      const kk = gd > stepMax ? stepMax / gd : 1;
      wrapper.vx = v0.vx + gx * kk / DT * 0.5; wrapper.vy = v0.vy + gy * kk / DT * 0.5;
      wrapper.x += v0.vx * DT + gx * kk; wrapper.y += v0.vy * DT + gy * kk;
      if (t - wrapAt > (v0 === QB && !scramble && pass ? 0.32 : 0.45) && live) { tackleAt = t; whistle(v0.x, v0.y); if (v0 === QB && pass && thrownAt < 0 && !scramble) sacked = true; }
    }
    for (const a of agents) if (!a.eng && a !== wrapper) { a.x += a.vx * DT; a.y += a.vy * DT; }
    for (const a of agents) faceOf(a);
    // Bodies don't overlap: teammates give each other room; opponents only meet in contact.
    for (let i = 0; i < agents.length; i++) for (let j = i + 1; j < agents.length; j++) {
      const a = agents[i], b = agents[j];
      if (a.eng === b || b.eng === a || a.eng && a.eng === b.eng) continue;
      if ((a === victim || b === victim) && (a === wrapper || b === wrapper)) continue;
      const min = a.off === b.off ? 1.0 : 0.75, dx = b.x - a.x, dy = b.y - a.y, d = hyp(dx, dy);
      if (d >= min || d < 1e-4) continue;
      const push = (min - d) * 0.5, nx = dx / d, ny = dy / d;
      const wa = a === carrier ? 0.3 : a.role === 'OL' || a.role === 'DL' ? 0.6 : 1, wb = b === carrier ? 0.3 : b.role === 'OL' || b.role === 'DL' ? 0.6 : 1;
      a.x -= nx * push * wa; a.y -= ny * push * wa; b.x += nx * push * wb; b.y += ny * push * wb;
    }

    // ---- is it over? ------------------------------------------------------------------
    if (live && carrier) {
      const cx = carrier.x, cy = carrier.y;
      const toward = carrier.off ? goalX : ownGoalX, sg = carrier.off ? s : -s;
      if (sg * (cx - toward) >= 0) { td = true; whistle(cx, cy); }
      else if (cy < 0 || cy > FW) { oob = true; whistle(cx, clamp(cy, 0, FW)); }
      else if (carrier.off && s * (cx - ownGoalX) < 0 && wrapper) { whistle(cx, cy); }
    }
    if (live && pass && ball.holder === QB && thrownAt < 0 && !scramble && t > 7.5) { throwAway(); }
  }
  for (const a of agents) { a.hx[f] = a.x; a.hy[f] = a.y; a.act[f] = actOf(a); a.face[f] = a.fc; }
  ballTrack.push([ball.holder && ball.mode === 'held' ? ball.holder.x : ball.x, ball.holder && ball.mode === 'held' ? ball.holder.y : ball.y, ball.z, ball.mode === 'held' && ball.holder ? ball.holder.i : -1]);
  if (endAt < 0) { endAt = t; deadX = carrier?.x ?? los; deadY = carrier?.y ?? MID; }
  const F = f + 1;

  // ---- the result ------------------------------------------------------------------------
  const dir = (Math.abs(deadY - MID) > 9 ? (s * (deadY - MID) > 0 ? 1 : -1) : 0) as -1 | 0 | 1;
  let yards = Math.round(s * (deadX - los));
  const air = target ? Math.round(s * (catchX - los)) : undefined;
  if (td && !intercepted) yards = 100 - ctx.yl;
  yards = Math.min(yards, 100 - ctx.yl);
  const offHeld = !intercepted && (carrier?.off === true || (sacked && !!victim));
  const safety = offHeld && !td && s * (deadX - ownGoalX) <= 0;
  let type: LiveResult['type'] = pass ? 'pass' : 'run';
  if (sacked) type = 'sack'; else if (scramble) type = 'scramble';
  const ret = intercepted ? Math.max(0, Math.round(-s * (deadX - catchX))) : undefined;

  // ---- the recording (30 a second) ---------------------------------------------------------
  const step = HZ / REC_HZ, frames = Math.floor((F - 1) / step) + 1;
  const xs = agents.map(a => { const o = new Float32Array(frames); for (let k = 0; k < frames; k++) o[k] = a.hx[k * step]; return o; });
  const ys = agents.map(a => { const o = new Float32Array(frames); for (let k = 0; k < frames; k++) o[k] = a.hy[k * step]; return o; });
  // Re-run the ball from the recorded story so the track lines up with the bodies.
  const bx = new Float32Array(frames), by = new Float32Array(frames), bz = new Float32Array(frames), hold = new Int8Array(frames).fill(-1);
  const recF = (sec: number) => Math.round(sec * REC_HZ);
  ballTrack.forEach((b, k) => { if (k % step === 0 && k / step < frames) { const j = k / step; bx[j] = b[0]; by[j] = b[1]; bz[j] = b[2]; hold[j] = b[3]; } });
  const rec: LiveRec = {
    hz: REC_HZ, frames, slots: agents.map(a => a.slot), xs, ys, bx, by, bz, hold,
    acts: agents.map(a => { const o = new Uint8Array(frames); for (let k = 0; k < frames; k++) o[k] = a.act[k * step]; return o; }),
    faces: agents.map(a => { const o = new Int8Array(frames); for (let k = 0; k < frames; k++) o[k] = a.face[k * step]; return o; }),
    throwF: thrownAt >= 0 ? recF(thrownAt) : undefined, catchF: caughtAt >= 0 ? recF(caughtAt) : undefined, endF: recF(endAt),
    tackleF: tackleAt >= 0 ? recF(tackleAt) : undefined, wrapF: wrapAt >= 0 ? recF(wrapAt) : undefined,
    target: target?.i, tackler: tackler?.i, swatter: swatter?.i,
    breaks: breaks.map(b => ({ f: Math.round(b.f / step), who: b.who, back: b.back })), missed: missed.map(m => ({ f: Math.round(m.f / step), who: m.who })), sheds: sheds.map(x => ({ ...x, f: Math.round(x.f / step) })), jukes: jukes.map(x => ({ ...x, f: Math.round(x.f / step) })),
  };
  return {
    type, yards: safety ? Math.min(yards, -1) : yards, air: pass && !throwaway ? air : undefined, complete, int: intercepted, td, safety, oob,
    throwaway, dropped, defended, hurried,
    carrier: (carrier ?? (sacked ? QB : null))?.slot, target: target?.slot, tackler: tackler?.slot, sacker: sacked ? tackler?.slot : undefined, picker: picker?.slot, swatter: swatter?.slot, ret, dir, rec,
  };
}
