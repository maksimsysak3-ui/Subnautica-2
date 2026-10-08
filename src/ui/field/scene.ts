// The play, as positions over time. Kicks are choreographed from the engine's
// result; scrimmage plays are simulated (speed, acceleration, routes, blocks,
// pursuit angles) with the ball's story pinned to what the engine decided. Every
// actor is a real player from the depth chart, so numbers and names are right.
import type { PlayEvent } from '../../sim/game';
import type { Pos, Team } from '../../core/types';
import { PLAY_ART, DEF_ART, FORMATION, OL_SPOTS, type Art } from '../playart';
import { app } from '../store';
import { skinOf } from '../skin';

export type Path = (t: number) => [number, number];
export interface Actor { team: 0 | 1; slot: string; role: string; path: Path; facing: number; num: number; ln: string; id?: string; skin?: string }
export interface Slot { num: number; ln: string; id?: string; skin?: string }
export type Lineup = Record<string, Slot>;

/** Starters and special-teamers by slot, from the team's depth chart. */
export function lineupFor(team: Team): Lineup {
  const L = app.league;
  const used = new Set<string>();
  const get = (pos: Pos, i: number): Slot | undefined => {
    const id = team.depth[pos]?.[i]; const p = id && L ? L.players[id] : undefined;
    if (!p) return undefined; used.add(p.id); return { num: p.num, ln: p.ln, id: p.id, skin: skinOf(p) };
  };
  const out: Lineup = {};
  const put = (slot: string, ...c: (Slot | undefined)[]) => { out[slot] = c.find(Boolean) ?? { num: 0, ln: '' }; };
  put('QB', get('QB', 0)); put('RB', get('RB', 0)); put('X', get('WR', 0)); put('Z', get('WR', 1)); put('S', get('WR', 2), get('TE', 1)); put('TE', get('TE', 0));
  put('OL0', get('OT', 0)); put('OL1', get('G', 0)); put('OL2', get('C', 0)); put('OL3', get('G', 1)); put('OL4', get('OT', 1));
  put('DL0', get('EDGE', 0)); put('DL1', get('DT', 0)); put('DL2', get('DT', 1)); put('DL3', get('EDGE', 1));
  put('LB0', get('LB', 0)); put('LB1', get('LB', 1));
  put('DB0', get('CB', 0)); put('DB1', get('CB', 1)); put('DB2', get('CB', 2)); put('DB3', get('S', 1)); put('FS', get('S', 0));
  put('K', get('K', 0)); put('P', get('P', 0)); put('H', get('P', 0)); put('LS', get('LS', 0), get('C', 1));
  // Special teams: backups first, starters only when the bench runs dry.
  const bench: Slot[] = [];
  for (const [pos, from] of [['LB', 2], ['S', 2], ['CB', 3], ['WR', 3], ['RB', 1], ['TE', 1], ['LB', 3], ['CB', 4], ['S', 3], ['WR', 4], ['TE', 2], ['FB', 0], ['DT', 2], ['EDGE', 2], ['G', 2], ['OT', 2]] as const)
    for (let i = from; i < from + 2; i++) { const id = team.depth[pos as Pos]?.[i]; const p = id && L ? L.players[id] : undefined; if (p && !bench.some(b => b.id === p.id)) bench.push({ num: p.num, ln: p.ln, id: p.id, skin: skinOf(p) }); }
  const b = (i: number) => bench[i % Math.max(1, bench.length)];
  for (let i = 0; i < 10; i++) out[`ST${i}`] = b(i);
  for (let i = 0; i < 9; i++) out[`BL${i}`] = b(i + 1);
  for (let i = 0; i < 6; i++) out[`RU${i}`] = b(i + 2);
  for (let i = 0; i < 9; i++) out[`FB${i}`] = b(i + 3);
  for (let i = 0; i < 5; i++) out[`OL${i}`] ??= b(i);
  ['OL0', 'OL1', 'OL2', 'OL3', 'OL4', 'TE', 'S', 'TE', 'OL1', 'OL3'].forEach((s, i) => (out[`FG${i}`] = out[s]));
  out.FG4 = out.LS;
  for (let i = 0; i < 3; i++) out[`PP${i}`] = b(i + 4);
  out.G0 = get('CB', 3) ?? b(0); out.G1 = get('WR', 4) ?? b(1);
  out.J0 = b(5); out.J1 = b(6);
  out.R = get('WR', 3) ?? get('RB', 1) ?? b(7); out.R2 = get('RB', 2) ?? b(8);
  return out;
}
export function slotFor(id: string): Slot | undefined { const p = app.league?.players[id]; return p ? { num: p.num, ln: p.ln, id, skin: skinOf(p) } : undefined; }

export interface Scene { dur: number; pre: number; los: number; first: number; actors: Actor[]; ball: Path; ballH: (t: number) => number; dirSign: number; art?: Art[]; dart?: Art[]; carrier?: (t: number) => number; tackle?: number; kick?: boolean;
  /** Story beats in scene time (0..1) and who is involved, for poses and the camera. */
  off?: 0 | 1; td?: boolean; hold?: (t: number) => number; broken?: boolean; pass?: boolean; complete?: boolean; int?: boolean; qb?: number; target?: number; throwAt?: number; catchAt?: number; endAt?: number; kicker?: number; kickAt?: number; tackler?: number; swatter?: number }

interface KickCtx { s: number; toX: (yl: number) => number; mid: number; off: 0 | 1; def: 0 | 1; los: number; first: number; lerp: (a: number, b: number, k: number) => number; seg: (t: number, a: number, b: number) => number; add: (team: 0 | 1, slot: string, role: string, path: Path) => void; actors: Actor[] }
/**
 * Special teams. Kickoffs use the 2024+ dynamic alignment: kicker at his 35, coverage
 * set at the receiving 40 and frozen until the ball is caught or lands, blockers in
 * the setup zone, returners deep. Punts have gunners, a shield and a returner who
 * fair-catches or brings it back; field goals get a snap, hold and kick.
 */
function buildKick(ev: PlayEvent, k: KickCtx): Scene {
  const { s, toX, mid, off, def, lerp, seg, add, actors } = k;
  const r = (i: number) => ((ev.n * 7919 + i * 104729) % 1000) / 1000;
  const weave = (t0: number, t1: number, amp: number) => (t: number) => Math.sin(seg(t, t0, t1) * Math.PI * 1.6) * amp * (1 - seg(t, t0, t1) * 0.6);
  const run = (from: [number, number], to: [number, number], t0: number, t1: number, w = 0): Path => t => {
    const q = seg(t, t0, t1);
    return [lerp(from[0], to[0], q), lerp(from[1], to[1], q) + (w ? weave(t0, t1, w)(t) : 0)];
  };
  if (ev.type === 'kickoff') {
    // ev.poss = receiving team, attacking direction s. Kicking team covers in -s.
    const tb = /Touchback/.test(ev.text), onside = /[Oo]nside/.test(ev.text);
    const td = !!ev.td;
    const tee = toX(65);
    const land: [number, number] = onside ? [toX(54), mid + 8] : tb ? [toX(-6), mid - 4 + r(1) * 8] : [toX(1 + r(2) * 6), mid - 6 + r(3) * 12];
    const endX = td ? toX(104) : toX(ev.endYl);
    const endY = mid + (r(4) - 0.5) * 20;
    const tCatch = onside ? 0.3 : 0.42, tEnd = td ? 0.97 : 0.88;
    const carrierPath: Path = tb || onside ? t => land : run(land, [endX, endY], tCatch, tEnd, 5);
    // Kicking team (team index = def here, since off is the receiver).
    add(def, 'K', 'K', run([toX(71), mid], [toX(60), mid], 0, 0.5));
    for (let i = 0; i < 10; i++) {
      const y0 = 3 + i * 5.3 + (i >= 5 ? 1 : 0);
      const tackler = i === 4 || i === 5;
      const chase: Path = t => {
        if (tb) return run([toX(40), y0], [toX(30), y0 + (mid - y0) * 0.2], tCatch, 0.9)(t);
        if (onside) return run([toX(40), y0], [land[0] + (r(i) - 0.5) * 6, land[1] + (r(i + 9) - 0.5) * 8], 0.08, 0.36)(t);
        const tgt = carrierPath(Math.min(1, t + (tackler ? 0 : 0.06)));
        const q = seg(t, tCatch, tEnd);
        const fin: [number, number] = tackler ? tgt : [tgt[0] + s * (2 + (i % 3) * 2) * (td ? -3 : 1), tgt[1] + (i - 4.5) * 1.8];
        return [lerp(toX(40), fin[0], q), lerp(y0, fin[1], Math.min(1, q * 1.15))];
      };
      add(def, `ST${i}`, 'ST', chase);
    }
    // Receiving team: nine blockers in the setup zone, two returners deep.
    for (let i = 0; i < 9; i++) {
      const y0 = 5 + i * 5.4;
      add(off, `BL${i}`, 'BL', t => {
        const meet = lerp(toX(30), carrierPath(Math.min(1, t))[0], 0.25);
        return run([toX(33 + (i % 2) * 2), y0], [meet + s * (i % 3), y0 + (mid - y0) * 0.35], tCatch - 0.08, 0.8)(t);
      });
    }
    add(off, 'R', 'R', carrierPath);
    add(off, 'R2', 'R', run([toX(3), land[1] > mid ? mid - 9 : mid + 9], [toX(14), mid + (land[1] > mid ? -2 : 2)], tCatch, 0.7));
    const carrierIdx = actors.length - 2;
    const ball: Path = t => (t < 0.06 ? [tee, mid] : t < tCatch ? [lerp(tee, land[0], seg(t, 0.06, tCatch)), lerp(mid, land[1], seg(t, 0.06, tCatch))] : carrierPath(t));
    const ballH = (t: number) => (t > 0.06 && t < tCatch ? Math.sin(Math.PI * seg(t, 0.06, tCatch)) * (onside ? 2.5 : 19) + 0.3 : 1.1);
    return { dur: tb ? 2.8 : onside ? 2.6 : 4.4, pre: 0, los: tee, first: tee, actors, ball, ballH, dirSign: -s, carrier: () => carrierIdx, hold: (u: number) => (tb ? -1 : u >= tCatch ? carrierIdx : -1), tackle: tb || td || onside ? undefined : tEnd, kick: true, kicker: actors.findIndex(a => a.slot === 'K'), kickAt: 0.06, catchAt: tCatch, endAt: tEnd };
  }
  if (ev.type === 'punt') {
    // ev.poss = punting team, kicking in direction s.
    const los = toX(ev.yl);
    const blocked = /BLOCKED/.test(ev.text), tb = /Touchback/.test(ev.text), downed = /downed/.test(ev.text), fair = /fair catch/.test(ev.text);
    const td = !!ev.td;
    const pX = los - s * 14;
    const finalAbs = td ? (s > 0 ? 6 : 114) : blocked ? pX - s * 6 : s > 0 ? 110 - ev.endYl : 10 + ev.endYl;
    const landX = tb ? (s > 0 ? 113 : 7) : downed ? finalAbs - s * 3 : blocked ? pX - s * 3 : toX(ev.yl + ev.yards);
    const landY = mid + (r(1) - 0.5) * 14;
    const tKick = 0.13, tLand = 0.5, tEnd = td ? 0.97 : 0.9;
    const returning = !blocked && !tb && !downed && !fair;
    const carrierPath: Path = returning ? run([landX, landY], [finalAbs, landY + (r(2) - 0.5) * 16], tLand, tEnd, 4) : t => [landX, landY];
    // Punt team: line, shield, gunners, punter.
    add(off, 'P', 'P', t => [pX + s * seg(t, 0.08, 0.14) * 1.5, mid]);
    [-4, -2, 0, 2, 4].forEach((dy, i) => add(off, `OL${i}`, 'OL', run([los - s * 0.5, mid + dy], [returning ? finalAbs + s * (3 + i) : landX - s * (4 + i), landY + dy * 2], 0.22, 0.95)));
    [-1.5, 0, 1.5].forEach((dy, i) => add(off, `PP${i}`, 'PP', run([los - s * 6, mid + dy], [returning ? finalAbs + s * (5 + i * 2) : landX - s * (6 + i), landY + dy * 3], 0.25, 0.97)));
    [3, 50.3].forEach((y, i) => add(off, `G${i}`, 'G', run([los, y], returning ? [finalAbs + s * 1.2, landY + (i ? 1.5 : -1.5)] : [landX - s * 1.5, landY + (i ? 2 : -2)], 0.03, returning ? tEnd : tLand + 0.05)));
    // Return team: rushers at the line, jammers on the gunners, the returner.
    // Rushers hit the line, then peel back to form the return wall.
    [-5, -3, -1, 1, 3, 5].forEach((dy, i) => {
      const rush = run([los + s * 1, mid + dy], [blocked && i === 2 ? pX : los - s * (2 + (i % 2) * 2), mid + dy], 0.02, 0.2);
      const wallX = (returning ? lerp(landX, finalAbs, 0.5) : landX) + s * (6 + (i % 3) * 2);
      add(def, `RU${i}`, 'DL', t => (t < 0.2 || blocked ? rush(t) : run(rush(0.2), [wallX, landY + dy * 1.6], 0.2, returning ? 0.85 : tLand + 0.15)(t)));
    });
    [4.5, 48.8].forEach((y, i) => add(def, `J${i}`, 'J', run([los + s * 1.5, y], [landX - s * 4, landY + (i ? 3 : -3)], 0.05, 0.75)));
    add(def, 'R', 'R', blocked ? (t => [pX - s * 3 + s * 8 * seg(t, 0.25, 0.8), mid]) : carrierPath);
    const carrierIdx = actors.length - 1;
    const ball: Path = t => {
      if (t < 0.08) return [lerp(los, pX, t / 0.08), mid];
      if (t < tKick) return [pX, mid];
      if (blocked) return [lerp(pX, pX - s * 3, seg(t, tKick, 0.35)), mid + 2 * seg(t, tKick, 0.35)];
      if (t < tLand) return [lerp(pX, landX, seg(t, tKick, tLand)), lerp(mid, landY, seg(t, tKick, tLand))];
      if (downed) return [lerp(landX, finalAbs, seg(t, tLand, 0.75)), landY];
      return carrierPath(t);
    };
    const ballH = (t: number) => (t > tKick && t < tLand && !blocked ? 1.2 + Math.sin(Math.PI * seg(t, tKick, tLand)) * 21 : downed && t < 0.75 ? 0.15 + Math.abs(Math.sin(seg(t, tLand, 0.75) * Math.PI * 3)) * 1.8 * (1 - seg(t, tLand, 0.75)) : 1.1);
    return { dur: returning ? 4.4 : 3.4, pre: 0, los, first: los, actors, ball, ballH, dirSign: s, carrier: () => carrierIdx, hold: (u: number) => (returning || fair ? (u >= tLand ? carrierIdx : -1) : blocked && u > 0.3 ? carrierIdx : -1), tackle: returning && !td ? tEnd : undefined, kick: true, kicker: actors.findIndex(a => a.slot === 'P'), kickAt: tKick, catchAt: tLand, endAt: tEnd };
  }
  // Field goal / extra point: snap, hold, kick through (or past) the uprights.
  const los = ev.type === 'xp' ? toX(85) : toX(ev.yl);
  const hold: [number, number] = [los - s * 7, mid];
  const good = !/NO GOOD/.test(ev.text);
  const wide = /wide left/.test(ev.text) ? -1 : 1;
  const postX = s > 0 ? 120 : 0;
  const tgtY = good ? mid + (r(1) - 0.5) * 3 : mid + wide * s * (4.4 + r(2) * 2);
  for (let i = 0; i < 9; i++) { const dy = (i - 4) * 1.3; add(off, `FG${i}`, 'OL', run([los - s * 0.5, mid + dy], [los - s * 1.2, mid + dy * 1.1], 0.04, 0.3)); }
  add(off, 'H', 'H', () => [hold[0] - s * 0.4, hold[1] + 0.8]);
  add(off, 'K', 'K', run([hold[0] - s * 2.5, mid - s * 2], [hold[0] + s * 0.3, mid], 0.06, 0.16));
  for (let i = 0; i < 9; i++) { const dy = (i - 4) * 1.4; add(def, `FB${i}`, 'DL', run([los + s * 1, mid + dy], [los - s * (i === 4 ? 3.5 : 1.5), mid + dy * 0.8], 0.05, 0.35)); }
  const ball: Path = t => (t < 0.08 ? [lerp(los, hold[0], t / 0.08), mid] : t < 0.16 ? hold : [lerp(hold[0], postX, seg(t, 0.16, 0.85)), lerp(mid, tgtY, seg(t, 0.16, 0.85))]);
  const ballH = (t: number) => (t < 0.08 ? 0.6 : t < 0.16 ? 0.25 : 0.25 + Math.sin(Math.PI * 0.62 * seg(t, 0.16, 0.85)) * 13);
  return { dur: 2.6, pre: 0, los, first: los, actors, ball, ballH, dirSign: s, kick: true, hold: () => -1, kicker: actors.findIndex(a => a.slot === 'K'), kickAt: 0.16 };
}

/** Builds the play: who stands where, how everyone moves, where the ball goes. */
export function buildScene(ev: PlayEvent, lineups: [Lineup, Lineup]): Scene {
  const s = ev.poss === 1 ? 1 : -1;               // offence attacks right when home has the ball
  const toX = (yl: number) => (s > 0 ? 10 + yl : 110 - yl);
  const los = toX(ev.yl);
  const first = toX(Math.min(100, ev.yl + ev.togo));
  const mid = 26.65;
  const off = (ev.poss === 1 ? 1 : 0) as 0 | 1, def = (1 - off) as 0 | 1;
  const end = toX(Math.max(0, Math.min(100, ev.yl + ev.yards)));
  const kick = ['punt', 'fg', 'xp', 'kickoff'].includes(ev.type);
  const pre = kick ? 0 : 0.22;
  const T = (t: number) => (t - pre) / (1 - pre);
  const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
  const ease = (k: number) => (k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k));
  const seg = (t: number, a: number, b: number) => ease((T(t) - a) / (b - a));
  const at = (dx: number, dy: number): [number, number] => [los + s * dx, mid + s * dy];
  const actors: Actor[] = [];
  // The returner on a kick is whoever the engine says fielded it.
  const ret = ev.ids?.ball && (ev.type === 'kickoff' || ev.type === 'punt') ? slotFor(ev.ids.ball) : undefined;
  const add = (team: 0 | 1, slot: string, role: string, path: Path) => {
    const who = slot === 'R' && ret ? ret : lineups[team][slot] ?? { num: 0, ln: '' };
    actors.push({ team, slot, role, path, facing: team === off ? s : -s, num: who.num, ln: who.ln, id: who.id, skin: who.skin });
  };
  const sc = kick ? buildKick(ev, { s, toX, mid, off, def, los, first, lerp, seg, add, actors }) : simScrimmage(ev, { s, at, los, first, mid, end, off, def, add, actors, L: lineups });
  sc.off = off; sc.td = !!ev.td; sc.pass = ev.type === 'pass'; sc.complete = !!ev.complete; sc.int = ev.type === 'pass' && !!ev.turnover;
  if (!kick) castNamed(sc, ev, off);
  return sc;
}

/** The defender nearest the ball carrier at the tackle, and nearest the ball when an incompletion arrives. */
export function contactOf(sc: Scene): { tackler: number; swatter: number } {
  let tackler = -1, swatter = -1;
  if (sc.tackle !== undefined && sc.hold) {
    let c0 = sc.hold(sc.tackle - 0.005); if (c0 < 0) c0 = sc.hold(Math.min(0.999, sc.tackle + 0.005));
    if (c0 >= 0) { const cp = sc.actors[c0].path(sc.tackle); let best = 1e9; sc.actors.forEach((a, i) => { if (a.team !== sc.actors[c0].team) { const [x, y] = a.path(sc.tackle!); const d = Math.hypot(x - cp[0], y - cp[1]); if (d < best) { best = d; tackler = i; } } }); }
  }
  if (sc.pass && !sc.complete && !sc.int && sc.catchAt !== undefined && sc.broken) {
    const cp = sc.ball(sc.catchAt); let best = 1e9;
    sc.actors.forEach((a, i) => { if (a.team !== sc.off) { const [x, y] = a.path(sc.catchAt!); const d = Math.hypot(x - cp[0], y - cp[1]); if (d < best) { best = d; swatter = i; } } });
  }
  return { tackler, swatter };
}

/**
 * The engine rotates players (a back spelling the starter, the fourth receiver, the
 * nickel corner), but the scene is cast from the depth chart. Put the players the
 * play text names on the bodies that actually carry, catch, throw, tackle, sack,
 * break up or intercept, so every name tag matches the call.
 */
function castNamed(sc: Scene, ev: PlayEvent, off: 0 | 1) {
  const A = sc.actors;
  const assign = (idx: number, pid?: string) => {
    if (idx < 0 || !pid || !A[idx] || A[idx].id === pid) return;
    const who = slotFor(pid); if (!who) return;
    const a = A[idx], other = A.findIndex(x => x.team === a.team && x.id === pid);
    if (other >= 0) { const b = A[other]; [a.num, b.num] = [b.num, a.num]; [a.ln, b.ln] = [b.ln, a.ln]; [a.id, b.id] = [b.id, a.id]; [a.skin, b.skin] = [b.skin, a.skin]; }
    else { a.num = who.num; a.ln = who.ln; a.id = who.id; a.skin = who.skin; }
  };
  const ids = ev.ids ?? {};
  assign(A.findIndex(a => a.team === off && a.slot === 'QB'), ids.qb);
  if (ev.type === 'pass' && sc.target !== undefined) assign(sc.target, ids.target);
  if ((ev.type === 'run' || ev.type === 'scramble') && sc.hold) {
    const tEnd = (sc.tackle ?? sc.endAt ?? 0.99) - 0.005, h = sc.hold(tEnd);
    if (h >= 0 && A[h].team === off) assign(h, ids.ball);
  }
  if (!ids.def) return;
  // Text says it was broken up: make sure the scene shows a defender on it.
  if (ev.type === 'pass' && !ev.complete && !ev.turnover) sc.broken = true;
  const { tackler, swatter } = contactOf(sc);
  if (sc.int && sc.hold && sc.catchAt !== undefined) assign(sc.hold(Math.min(0.999, sc.catchAt + 0.02)), ids.def);
  else if (swatter >= 0) assign(swatter, ids.def);
  else if (tackler >= 0) assign(tackler, ids.def);
  else if (ev.type === 'sack') {
    const qb = A.findIndex(a => a.team === off && a.slot === 'QB'); if (qb < 0) return;
    const t = sc.endAt ?? 0.9, [qx, qy] = A[qb].path(t); let best = 1e9, bi = -1;
    A.forEach((a, i) => { if (a.team !== off) { const [x, y] = a.path(t); const d = Math.hypot(x - qx, y - qy); if (d < best) { best = d; bi = i; } } });
    assign(bi, ids.def);
  }
  sc.tackler = tackler; sc.swatter = swatter;
}

/**
 * A scrimmage play, simulated rather than tweened: every player has a top speed and
 * acceleration, receivers run their drawn routes, linemen engage and the rushers
 * shed on their own clock, defenders cover and then pursue on angles. The ball's
 * story (where it is caught, where the carrier goes down) comes from the game
 * engine's result, so the picture always matches the play-by-play. Plays last as
 * long as they really would (a stuffed run two seconds, a deep ball five).
 */
interface Agent { team: 0 | 1; slot: string; role: string; x: number; y: number; vx: number; vy: number; top: number; acc: number; track: [number, number][] }
function simScrimmage(ev: PlayEvent, k: { s: number; at: (dx: number, dy: number) => [number, number]; los: number; first: number; mid: number; end: number; off: 0 | 1; def: 0 | 1; add: (team: 0 | 1, slot: string, role: string, path: Path) => void; actors: Actor[]; L: [Lineup, Lineup] }): Scene {
  const { s, at, los, first, mid, end, off, def } = k;
  const idOf = (team: 0 | 1, slot: string) => k.L[team][slot]?.id;
  let seed = (ev.n * 9301 + 49297) % 233280;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  const art = PLAY_ART[ev.call ?? ''], dart = DEF_ART[ev.dcall ?? ''];
  const run = ev.type === 'run', sack = ev.type === 'sack', scramble = ev.type === 'scramble', pass = ev.type === 'pass';
  const DT = 1 / 60, PRE = art || dart ? 0.6 : 0.25;
  const ballTrack: [number, number, number][] = [];
  const agents: Agent[] = [];
  const mk = (team: 0 | 1, slot: string, role: string, [x, y]: [number, number], top: number, acc = 9) => { const a: Agent = { team, slot, role, x, y, vx: 0, vy: 0, top, acc, track: [] }; agents.push(a); return a; };
  const steer = (a: Agent, tx: number, ty: number, mul = 1) => {
    const dx = tx - a.x, dy = ty - a.y, d = Math.hypot(dx, dy) || 1e-6;
    const sp = Math.min(a.top * mul, d * 3.2);
    let ax = (dx / d) * sp - a.vx, ay = (dy / d) * sp - a.vy;
    const m = Math.hypot(ax, ay), lim = a.acc * DT;
    if (m > lim) { ax *= lim / m; ay *= lim / m; }
    a.vx += ax; a.vy += ay;
  };
  const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
  /** A ball carrier's lateral target: cut away from the nearest defender in front of him. */
  const evade = (c: Agent, baseY: number) => {
    let near: Agent | null = null, nd = 3.2;
    for (const a of agents) if (a.team !== c.team) { const ahead = s * (a.x - c.x); if (ahead > -0.5 && ahead < 4) { const d = dist(a, c); if (d < nd) { nd = d; near = a; } } }
    if (!near) return baseY;
    const away = Math.sign(c.y - near.y) || (rnd() < 0.5 ? 1 : -1);
    return Math.max(1.5, Math.min(51.8, c.y + away * (3.2 - nd) * 2.2 + (baseY - c.y) * 0.3));
  };
  // --- personnel ---
  const OL = OL_SPOTS.map(([dx, dy], i) => mk(off, `OL${i}`, 'OL', at(dx, dy), 5.2, 7));
  const QB = mk(off, 'QB', 'QB', at(...FORMATION.QB), 7.2);
  const RB = mk(off, 'RB', 'RB', at(...FORMATION.RB), 8.4, 10);
  const WHO = ['X', 'Z', 'S', 'TE'] as const;
  const REC = WHO.map((w, i) => mk(off, w, w, at(...FORMATION[w]), w === 'TE' ? 7.6 : 8.8, 10));
  const DL = [-5, -1.7, 1.7, 5].map((dy, i) => mk(def, `DL${i}`, 'DL', at(1, dy), i === 0 || i === 3 ? 7.6 : 6.6, 8));
  const LB = [-3.5, 3.5].map((dy, i) => mk(def, `LB${i}`, 'LB', at(5, dy), 7.8, 9));
  const DB = WHO.map((w, i) => mk(def, `DB${i}`, 'DB', at(FORMATION[w][0] + (w === 'TE' ? 5 : 7), FORMATION[w][1] * 0.95), 8.6, 10));
  const FS = mk(def, 'FS', 'S', at(13, 0), 8.4, 9);
  // --- the story from the engine ---
  const named = WHO.findIndex(w => !!ev.ids?.target && idOf(off, w) === ev.ids.target);
  const targetIdx = named >= 0 ? named : (ev.dir ?? 0) < 0 ? 0 : (ev.dir ?? 0) > 0 ? 1 : 2;
  const qbRun = run && !!ev.ids?.ball && ev.ids.ball === idOf(off, 'QB');
  const sackBy = DL.findIndex(a => !!ev.ids?.def && idOf(def, a.slot) === ev.ids.def), si = sackBy >= 0 ? sackBy : 1;
  const target = REC[targetIdx];
  const air = Math.max(-2, ev.air ?? ev.yards);
  const catchPt = at(air, FORMATION[WHO[targetIdx]][1] * 0.75 + (rnd() - 0.5) * 3);
  const lateral = (art?.find(a => a.who === 'RB')?.pts.slice(-1)[0]?.[1] ?? 0) * 0.6 + (ev.dir ?? 0) * 3;
  const endY = mid + s * (lateral * 0.7 + (rnd() - 0.5) * 6);
  const dropT = 1.0 + rnd() * 0.25, throwT = dropT + (Math.abs(air) > 15 ? 0.7 : 0.25) + rnd() * 0.3;
  const airT = 0.18 + Math.hypot(catchPt[0] - at(-7, 0)[0], catchPt[1] - at(-7, 0)[1]) / 19;
  const catchT = throwT + airT;
  const routes = WHO.map(w => [at(...FORMATION[w]), ...((art?.find(a => a.who === w && a.kind === 'route')?.pts ?? [[10, FORMATION[w][1]]]).map(p => at(p[0], p[1])))] as [number, number][]);
  const ri = WHO.map(() => 1);
  let carrier: Agent | null = null, thrown = false, caught = false, endT = 0, ballXY: [number, number] = at(0, 0), ballZ = 0;
  const holdTrack: number[] = [];
  let loose: [number, number, number] | null = null;   // velocity of a dead/deflected ball
  let broken = false;                                  // a defender got a hand on it
  let shed = DL.map(() => 1.4 + rnd() * 1.3);
  if (sack) shed[si] = 1.3;
  const past = (x: number) => s * (x - end) >= 0;   // reached the spot downfield
  const before = (x: number) => s * (x - end) <= 0; // reached the spot behind
  const goal = (a: Agent) => { const ahead = Math.min(1, dist(a, carrier ?? QB) / 8); const c = carrier ?? QB; return [c.x + c.vx * ahead, c.y + c.vy * ahead] as const; };
  const T_MAX = 11;
  let t = 0;
  for (; t < T_MAX; t += DT) {
    // Ball and carrier.
    if (run) { if (!carrier && t > (qbRun ? 0.3 : 0.45)) carrier = qbRun ? QB : RB; }
    else if (scramble) { if (!carrier && t > 1.5) carrier = QB; }
    else if (sack) carrier = QB;
    else if (!thrown && t >= throwT) thrown = true;
    if (pass && thrown && !caught && t >= catchT) { caught = true; if (ev.complete) carrier = target; else if (ev.turnover) carrier = [...DB, FS, ...LB].find(a => !!ev.ids?.def && idOf(def, a.slot) === ev.ids.def) ?? [...DB, FS].sort((a, b) => dist(a, { x: catchPt[0], y: catchPt[1] }) - dist(b, { x: catchPt[0], y: catchPt[1] }))[0]; }
    // Offense.
    OL.forEach((o, i) => {
      const m = DL[Math.min(3, Math.round(i * 0.8))];
      if (run) steer(o, m.x - s * 0.4, m.y, 0.8);
      else { const q = carrier ?? QB; const dx = q.x - m.x, dy = q.y - m.y, d = Math.hypot(dx, dy) || 1; steer(o, m.x + (dx / d) * 0.95, m.y + (dy / d) * 0.95, 0.9); }
    });
    if (run) {
      const runner = qbRun ? QB : RB, fake = qbRun ? RB : QB;
      if (carrier !== runner) steer(runner, at(-3.2, lateral * 0.3)[0], at(-3.2, lateral * 0.3)[1]);
      else if (!endT) { const hole = at(0.8, lateral); const thru = s * (runner.x - hole[0]) < -0.5; steer(runner, thru ? hole[0] : end + s * 2, thru ? hole[1] : evade(runner, endY)); }
      if (qbRun) steer(fake, at(1, -lateral * 0.5)[0], at(1, -lateral * 0.5)[1], 0.7); else steer(fake, at(-5.5, -2)[0], at(-5.5, -2)[1], 0.5);
    } else {
      if (sack) steer(QB, end, mid, 0.55);
      else if (carrier === QB) { if (!endT) steer(QB, end + s * 2, endY); }
      else if (!thrown) steer(QB, at(-7, 0)[0], at(-7, 0)[1], 0.7);
      const rbPts = art?.find(a => a.who === 'RB')?.pts;
      if (rbPts) { const p = at(...rbPts[rbPts.length - 1]); steer(RB, p[0], p[1], 0.8); } else steer(RB, QB.x + s * 1, QB.y + 1.5, 0.5);
    }
    REC.forEach((r, i) => {
      if (r === carrier) { if (!endT) steer(r, end + s * 2, evade(r, endY)); return; }
      if (pass && r === target && thrown && !caught) { const left = Math.max(0.05, catchT - t); const d = Math.hypot(catchPt[0] - r.x, catchPt[1] - r.y); r.top = Math.max(8.8, Math.min(10.5, d / left)); steer(r, catchPt[0], catchPt[1]); return; }
      if (run || (carrier && carrier !== QB)) { const m = [...DB, FS, ...LB].sort((a, b) => dist(a, r) - dist(b, r))[0]; steer(r, m.x, m.y, 0.75); return; }
      const rt = routes[i]; const p = rt[Math.min(ri[i], rt.length - 1)];
      steer(r, ri[i] < rt.length ? p[0] : r.x + s * 4, ri[i] < rt.length ? p[1] : r.y, 0.92);
      if (ri[i] < rt.length && Math.hypot(p[0] - r.x, p[1] - r.y) < 0.8) ri[i]++;
    });
    // Defense.
    DL.forEach((d, i) => {
      const held = t < shed[i];
      const [gx, gy] = goal(d);
      steer(d, gx, gy, held ? (run && carrier ? 0.35 : 0.12) : 1);
    });
    LB.forEach((d, i) => {
      if (d === carrier) { if (!endT) steer(d, d.x - s * 8, d.y); return; }
      if (carrier && carrier !== QB || run && t > 0.35 || sack) { const [gx, gy] = goal(d); steer(d, gx, gy); }
      else if (thrown) steer(d, catchPt[0], catchPt[1]);
      else { const z = at(6, i ? 4 : -4); steer(d, z[0], (z[1] + QB.y) / 2, 0.7); }
    });
    DB.forEach((d, i) => {
      if (d === carrier) { if (!endT) steer(d, d.x - s * 10, d.y); return; }
      const r = REC[i];
      if (carrier && carrier !== QB) { const [gx, gy] = goal(d); steer(d, gx, gy); }
      else if (run && t > 0.6) { const [gx, gy] = goal(d); steer(d, gx, gy); }
      else if (thrown) steer(d, catchPt[0] + s * 0.6, catchPt[1], r === target ? 1.02 : 0.95);
      else steer(d, r.x + s * Math.max(0.8, 3 - t * 1.4), r.y, 0.97); // trail with a cushion that closes
    });
    if (FS === carrier) { if (!endT) steer(FS, FS.x - s * 10, FS.y); }
    else if (carrier && carrier !== QB) { const [gx, gy] = goal(FS); steer(FS, gx, gy); }
    else if (thrown) steer(FS, catchPt[0], catchPt[1]);
    else steer(FS, at(13 + t, 0)[0], (QB.y + mid) / 2, 0.5);
    // Integrate, then keep bodies apart: teammates give each other room, opponents meet
    // at contact distance (that is what a block or a wrap-up looks like), nobody overlaps.
    for (const a of agents) { a.x += a.vx * DT; a.y += a.vy * DT; }
    for (let i = 0; i < agents.length; i++) for (let j = i + 1; j < agents.length; j++) {
      const a = agents[i], b = agents[j];
      if (endT && (a === carrier || b === carrier)) continue;
      const min = a.team === b.team ? 1.15 : 0.8;
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
      if (d >= min || d < 1e-4) continue;
      const push = (min - d) * 0.5, nx = dx / d, ny = dy / d;
      // The ball carrier is harder to move than the man pushing him; linemen are heaviest.
      const wa = a === carrier ? 0.25 : a.role === 'OL' || a.role === 'DL' ? 0.6 : 1, wb = b === carrier ? 0.25 : b.role === 'OL' || b.role === 'DL' ? 0.6 : 1;
      const k = 1 / (wa + wb);
      a.x -= nx * push * 2 * wa * k; a.y -= ny * push * 2 * wa * k; b.x += nx * push * 2 * wb * k; b.y += ny * push * 2 * wb * k;
    }
    for (const a of agents) a.track.push([a.x, a.y]);
    // Ball.
    if (pass && thrown && !caught) {
      const q = Math.min(1, (t - throwT) / airT);
      const from = at(-7, 0);
      ballXY = [from[0] + (catchPt[0] - from[0]) * q, from[1] + (catchPt[1] - from[1]) * q];
      ballZ = 2 - q * 0.5 + Math.sin(Math.PI * q) * (0.5 + Math.abs(air) * 0.3);
    } else if (pass && caught && !ev.complete && !ev.turnover) {
      // Incomplete: the ball is knocked away or falls incomplete, then bounces dead. Nobody holds it.
      if (!loose) {
        const from = at(-7, 0), dx = catchPt[0] - from[0], dy = catchPt[1] - from[1], d = Math.hypot(dx, dy) || 1;
        const near = [...DB, FS, ...LB].reduce((m, a) => Math.min(m, dist(a, { x: catchPt[0], y: catchPt[1] })), 99);
        broken = near < 1.8;
        loose = broken ? [(dx / d) * 2 + (rnd() - 0.5) * 5, (dy / d) * 2 + (rnd() - 0.5) * 5, 3.2] : [(dx / d) * 5, (dy / d) * 5, -1];
      }
      ballXY = [ballXY[0] + loose[0] * DT, ballXY[1] + loose[1] * DT];
      ballZ += loose[2] * DT; loose[2] -= 10.7 * DT;
      if (ballZ < 0.12) { ballZ = 0.12; loose[2] = Math.abs(loose[2]) * 0.38; loose[0] *= 0.55; loose[1] *= 0.55; if (loose[2] < 0.6) loose[2] = 0; }
    } else { const h = carrier ?? (t < 0.12 ? null : QB); if (h) { ballXY = [h.x, h.y]; ballZ = 1.1; } else ballZ = 0.15; }
    holdTrack.push(pass && thrown && !caught ? -1 : pass && caught && !ev.complete && !ev.turnover ? -1 : carrier ? agents.indexOf(carrier) : t >= 0.12 ? agents.indexOf(QB) : -1);
    (ballTrack as [number, number, number][]).push([ballXY[0], ballXY[1], ballZ]);
    // When does it end?
    if (!endT) {
      if (pass && caught && !ev.complete && !ev.turnover && t > catchT + 0.45) endT = t;
      else if (pass && caught && ev.turnover && t > catchT + 0.9) endT = t;
      else if (carrier && carrier.team === off && (ev.td ? s * (carrier.x - end) > 2 : (ev.yards >= 0 || run || scramble) ? past(carrier.x) && t > 0.5 : before(carrier.x)) && (carrier !== QB || !pass || sack || scramble) && (!pass || !caught || t > catchT + 0.3)) endT = t;
      else if (sack && t > 1.2 && dist(DL[si], QB) < 1.1) endT = t;
    }
    if (endT && t > endT + 0.75) break;
  }
  if (!endT) endT = t - 0.75;
  const dur = PRE + t;
  const sample = (tr: [number, number][]) => (u: number): [number, number] => { const i = Math.max(0, Math.min(tr.length - 1, Math.round((u * dur - PRE) / DT))); return tr[i] ?? tr[0]; };
  for (const a of agents) { const first = a.track[0] ?? [a.x, a.y]; const tr = a.track; k.add(a.team, a.slot, a.role, u => (u * dur < PRE ? first : sample(tr)(u))); }
  const bt = ballTrack as [number, number, number][];
  const ball: Path = u => { if (u * dur < PRE) return at(0, 0); const i = Math.max(0, Math.min(bt.length - 1, Math.round((u * dur - PRE) / DT))); return [bt[i][0], bt[i][1]]; };
  const ballH = (u: number) => { const i = Math.max(0, Math.min(bt.length - 1, Math.round((u * dur - PRE) / DT))); return u * dur < PRE ? 0.15 : bt[i][2]; };
  const tackled = !ev.td && !(pass && !ev.complete);
  return { dur, pre: PRE / dur, los, first, actors: k.actors, ball, ballH: (u: number) => ballH(u), dirSign: s, art, dart, tackle: tackled ? Math.min(0.97, (PRE + endT) / dur) : undefined,
    hold: (u: number) => (u * dur < PRE ? -1 : holdTrack[Math.max(0, Math.min(holdTrack.length - 1, Math.round((u * dur - PRE) / DT)))] ?? -1),
    broken, qb: agents.indexOf(QB), target: pass ? agents.indexOf(target) : undefined, throwAt: pass ? (PRE + throwT) / dur : undefined, catchAt: pass ? (PRE + catchT) / dur : undefined, endAt: (PRE + endT) / dur };
}

