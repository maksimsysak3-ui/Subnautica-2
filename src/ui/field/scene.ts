// The play, as positions over time. Kicks are choreographed from the engine's
// result; scrimmage plays are simulated (speed, acceleration, routes, blocks,
// pursuit angles) with the ball's story pinned to what the engine decided. Every
// actor is a real player from the depth chart, so numbers and names are right.
import type { PlayEvent } from '../../sim/game';
import type { Pos, Team } from '../../core/types';
import { PLAY_ART, DEF_ART, OL_SPOTS, snapSpot, alignFor, type Art, type Align } from '../playart';
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

export interface Scene { dur: number; pre: number; los: number; first: number; actors: Actor[]; ball: Path; ballH: (t: number) => number; dirSign: number; art?: Art[]; dart?: Art[]; align?: Align; carrier?: (t: number) => number; tackle?: number; kick?: boolean; pressured?: boolean; oob?: boolean;
  /** Contact on the ball carrier: beaten defenders (and how), and the wrap-up that ends it. */
  moves?: { at: number; kind: 'juke' | 'spin' | 'stiff' | 'broken' | 'pancake' | 'swim' | 'rip' | 'spinmove' | 'jumpcut' | 'hesi' | 'cut'; def: number; until: number; by?: number }[]; wrapAt?: number; wrapper?: number;
  /** Receivers planting at their breaks (and turning back to the QB on comebacks). */
  breaks?: { at: number; who: number; back: boolean }[];
  /** A pass batted down at the line, and by whom. */
  tipped?: { at: number; by: number };
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
  let tackler = sc.wrapper ?? -1, swatter = -1;
  if (sc.tackle !== undefined && sc.hold && tackler < 0) {
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
interface Agent { team: 0 | 1; slot: string; role: string; x: number; y: number; vx: number; vy: number; top: number; acc: number; track: [number, number][]; /** Pre-snap motion path (field coords), ending where he is at the snap. */ pre?: [number, number][] }
function simScrimmage(ev: PlayEvent, k: { s: number; at: (dx: number, dy: number) => [number, number]; los: number; first: number; mid: number; end: number; off: 0 | 1; def: 0 | 1; add: (team: 0 | 1, slot: string, role: string, path: Path) => void; actors: Actor[]; L: [Lineup, Lineup] }): Scene {
  const { s, at, los, first, mid, end, off, def } = k;
  const idOf = (team: 0 | 1, slot: string) => k.L[team][slot]?.id;
  let seed = (ev.n * 9301 + 49297) % 233280;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  const art = PLAY_ART[ev.call ?? ''], dart = DEF_ART[ev.dcall ?? ''];
  const run = ev.type === 'run', sack = ev.type === 'sack', scramble = ev.type === 'scramble', pass = ev.type === 'pass';
  // Pre-snap motion: one man jogs across before the snap, and it ends as the ball is snapped.
  const FORMATION = alignFor(ev.call);
  const mot = art?.find(a => a.motion?.length && a.who !== 'OL' && a.who !== 'DEF');
  const motPath = mot ? [FORMATION[mot.who as keyof typeof FORMATION], ...mot.motion!] : [];
  const motLen = motPath.reduce((a, p, i) => (i ? a + Math.hypot(p[0] - motPath[i - 1][0], p[1] - motPath[i - 1][1]) : 0), 0);
  const MT = mot ? Math.min(2.2, 0.3 + motLen / 7) : 0;
  const DT = 1 / 60, PRE = (art || dart ? 0.6 : 0.25) + MT;
  const spotOf = (w: keyof typeof FORMATION): [number, number] => (mot?.who === w ? snapSpot(mot, FORMATION) : FORMATION[w]);
  // Coverage from the engine's shell when it has one (team books rename every call), else the name.
  const manCov = /Cover [01]/.test(ev.shell ?? '') || /Cover [01]|Man|Press|Zero/i.test(ev.dcall ?? '');
  const cov2 = !manCov && (ev.shell === 'Cover 2' || /Cover 2|Tampa/i.test(ev.dcall ?? '')), cov4 = ev.shell === 'Cover 4' || /Cover 4|Quarters/i.test(ev.dcall ?? '');
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
    // (Near the spot he doesn't dance away from the man coming to make the tackle: he runs at him.)
    const nearSpot = s * (end - c.x) < 5;
    for (const a of agents) if (a.team !== c.team && !(nearSpot && a === closer)) { const ahead = s * (a.x - c.x); if (ahead > -0.5 && ahead < 4) { const d = dist(a, c); if (d < nd) { nd = d; near = a; } } }
    if (!near) return baseY;
    const away = Math.sign(c.y - near.y) || (rnd() < 0.5 ? 1 : -1);
    return Math.max(-0.8, Math.min(54.1, c.y + away * (3.2 - nd) * 2.2 + (baseY - c.y) * 0.3));
  };
  // --- personnel ---
  const OL = OL_SPOTS.map(([dx, dy], i) => mk(off, `OL${i}`, 'OL', at(dx, dy), 5.2, 7));
  const QB = mk(off, 'QB', 'QB', at(...FORMATION.QB), 7.2);
  const gun = FORMATION.QB[0] < -3, snapT = gun ? 0.32 : 0.12;   // shotgun snaps travel
  const RB = mk(off, 'RB', 'RB', at(...spotOf('RB')), 8.4, 10);
  const WHO = ['X', 'Z', 'S', 'TE'] as const;
  const REC = WHO.map((w, i) => mk(off, w, w, at(...spotOf(w)), w === 'TE' ? 7.6 : 8.8, 10));
  const DL = [-5, -1.7, 1.7, 5].map((dy, i) => mk(def, `DL${i}`, 'DL', at(1, dy), i === 0 || i === 3 ? 7.6 : 6.6, 8));
  const LB = [-3.5, 3.5].map((dy, i) => mk(def, `LB${i}`, 'LB', at(5, dy), 7.8, 9));
  // (The front, the rush and the shell are set up once the secondary exists, below.)
  // A back with no route stays in to pick the blitzer up (and stalls him unless he's the sacker).
  const rbArt = art?.find(a => a.who === 'RB');
  const rbBlock = !run && (!rbArt || rbArt.kind === 'block');
  const pickedUp = (d: Agent) => rbBlock && d !== sackBlitzer && Math.hypot(RB.x - d.x, RB.y - d.y) < 1.2;
  // In man coverage the defender travels with the man in motion (the tell); in zone he stays home.
  const press = manCov && rnd() < 0.6;
  const DB = WHO.map((w, i) => mk(def, `DB${i}`, 'DB', at(FORMATION[w][0] + (w === 'TE' ? 5 : press && w !== 'S' ? 1.3 : 6), (manCov ? spotOf(w) : FORMATION[w])[1] * 0.95), 8.6, 10));
  if (mot) {
    const mover = [RB, ...REC].find(a => a.slot === mot.who);
    if (mover) mover.pre = motPath.map(p => at(p[0], p[1]));
    const wi = WHO.indexOf(mot.who as typeof WHO[number]);
    if (manCov && wi >= 0) DB[wi].pre = motPath.map(p => at(FORMATION[WHO[wi]][0] + (WHO[wi] === 'TE' ? 5 : 7), p[1] * 0.95));
  }
  const FS = mk(def, 'FS', 'S', at(13, 0), 8.4, 9);
  // --- the defense's call: front, how many rush, and the shell ---
  // Fronts: 4-3 (the slot defender is a third linebacker in the middle), 3-4 (a nose and two
  // ends, an outside backer standing up on the edge), 3-3-5 (three down, three stacked behind),
  // nickel 4-2-5 and dime 4-1-6.
  const front = ev.front ?? (ev.dcall && /Dime/.test(ev.dcall) ? '4-1-6' : '4-2-5');
  const asLB = new Set<Agent>();                       // defensive backs playing as linebackers
  const dlDrop = new Set<Agent>();                     // linemen standing up / dropping instead of rushing
  if (front === '3-4') { [DL[0].y, DL[1].y, DL[2].y] = [at(1, -3.4)[1], at(1, 0)[1], at(1, 3.4)[1]]; [DL[3].x, DL[3].y] = at(1.4, 7.4); [LB[0].x, LB[0].y] = at(4.6, -2.4); [LB[1].x, LB[1].y] = at(4.6, 2.4); }
  if (front === '3-3-5') { [DL[0].y, DL[1].y, DL[2].y] = [at(1, -3.4)[1], at(1, 0)[1], at(1, 3.4)[1]]; [DL[3].x, DL[3].y] = at(5, 0); dlDrop.add(DL[3]); [LB[0].x, LB[0].y] = at(5, -4.6); [LB[1].x, LB[1].y] = at(5, 4.6); }
  if (front === '4-3' || front === 'Goal Line') { asLB.add(DB[2]); [DB[2].x, DB[2].y] = at(4.8, 0); [LB[0].x, LB[0].y] = at(4.8, -4.2); [LB[1].x, LB[1].y] = at(4.8, 4.2); }
  if (front === '4-1-6') { [LB[0].x, LB[0].y] = at(5.2, 0); [LB[1].x, LB[1].y] = at(8, FORMATION.S[1] * 0.6); }
  // 46 Bear: the interior is covered (both guards and the center), a fifth man stands up on the edge.
  const bearEdge = LB[Math.abs(ev.n) % 2];
  if (front === 'Bear') { [DL[0].y, DL[1].y, DL[2].y, DL[3].y] = [at(1, -4.4)[1], at(1, -1.4)[1], at(1, 1.4)[1], at(1, 4.4)[1]]; [bearEdge.x, bearEdge.y] = at(1.1, (bearEdge === LB[0] ? -1 : 1) * 7.4); asLB.add(DB[2]); [DB[2].x, DB[2].y] = at(4.6, 0); }
  // The rush: from three (a lineman drops into a zone) to everybody. Extras come from the
  // linebackers, then the slot defender off the edge, then the strong safety.
  const rushN = ev.rush ?? 4 + (ev.blitz ?? 0);
  const sackAgent = ev.type === 'sack' ? [...LB, ...DB, FS, ...DL].find(a => !!ev.ids?.def && idOf(def, a.slot) === ev.ids.def) : undefined;
  const blitzers = new Set<Agent>();
  if (sackAgent && dlDrop.has(sackAgent)) dlDrop.delete(sackAgent);
  if (sackAgent && sackAgent.role !== 'DL') blitzers.add(sackAgent);
  const rushingNow = () => DL.filter(d => !dlDrop.has(d)).length + blitzers.size;
  if (rushingNow() > rushN) for (const d of [DL[3], DL[0]]) if (rushingNow() > rushN && d !== sackAgent && !dlDrop.has(d)) dlDrop.add(d);
  // Simulated pressure: an end drops into the flat and the slot defender comes off the edge.
  if (ev.creep && !sackAgent) { dlDrop.add(DL[ev.n % 2 ? 3 : 0]); blitzers.add(DB[2]); }
  const lb0 = Math.abs(ev.n) % 2;
  for (const d of [...dlDrop, LB[lb0], LB[1 - lb0], DB[2], DB[3]]) {
    if (rushingNow() >= rushN) break;
    if (dlDrop.has(d)) dlDrop.delete(d); else blitzers.add(d);
  }
  const sackBlitzer = sackAgent && blitzers.has(sackAgent) ? sackAgent : undefined;
  // Blitzers walk up before the snap: linebackers into the A/B gaps, defensive backs to the edge.
  const gapOf = (b: Agent): [number, number] => b.role === 'DB' ? at(0.2, (b.y >= mid ? 1 : -1) * 7.5) : at(0.2, (b.y >= mid ? 1 : -1) * 2.4);
  for (const b of blitzers) {
    if (front === 'Bear' && b === bearEdge) { b.top = Math.max(b.top, 8.4); continue; }   // already on the line
    const g = gapOf(b); [b.x, b.y] = [g[0] + s * 1.7, g[1] + (b.role === 'DB' ? (b.y >= mid ? 1 : -1) * 0.8 : 0)]; b.top = Math.max(b.top, 8.4);
  }
  // Shells: two high safeties split the deep halves; one high in the middle with the strong
  // safety rolled down; zero, with the free safety walked down as a robber.
  const twoHigh = ev.shell === 'Cover 2' || ev.shell === 'Cover 4' || ev.shell === 'Prevent' || ((cov2 || cov4) && !ev.shell);
  const zeroHigh = ev.shell === 'Cover 0';
  const sideX = FORMATION.X[1] >= 0 ? 1 : -1;
  if (twoHigh) { [FS.x, FS.y] = at(12.5, sideX * 7); if (!blitzers.has(DB[3])) [DB[3].x, DB[3].y] = at(12.5, -sideX * 7); }
  else if (zeroHigh) [FS.x, FS.y] = at(8.5, 0);
  // --- the story from the engine ---
  const named = WHO.findIndex(w => !!ev.ids?.target && idOf(off, w) === ev.ids.target);
  const targetIdx = named >= 0 ? named : (ev.dir ?? 0) < 0 ? 0 : (ev.dir ?? 0) > 0 ? 1 : 2;
  const qbRun = run && !!ev.ids?.ball && ev.ids.ball === idOf(off, 'QB');
  const sackBy = DL.findIndex(a => !!ev.ids?.def && idOf(def, a.slot) === ev.ids.def), si = sackBy >= 0 ? sackBy : 1;
  const sacker: Agent = sackAgent ?? DL[si];
  const target = REC[targetIdx];
  const cov = [...DB, FS, ...LB].find(a => !!ev.ids?.def && idOf(def, a.slot) === ev.ids.def) ?? DB[targetIdx];
  const air = Math.max(-2, ev.air ?? ev.yards);
  // Where the ball goes is decided at the throw: the QB leads the receiver along his
  // route to the engine's air yards. Until then this is only an estimate.
  let catchPt: [number, number] = at(air, FORMATION[WHO[targetIdx]][1] * 0.75);
  let recvPt: [number, number] = catchPt;          // where the receiver is going
  let throwFrom: [number, number] = at(-7, 0);     // where the QB let it go
  const defended = pass && !ev.complete && !ev.turnover && !!ev.ids?.def;
  const dropped = pass && /DROPPED/.test(ev.text);
  const throwAway = pass && /throws it away/.test(ev.text);
  const picked = pass && !!ev.turnover;
  const tipped = pass && !ev.complete && !picked && !defended && !dropped && !throwAway && Math.abs(ev.air ?? 0) <= 15 && rnd() < 0.3;
  let tipBy: Agent | null = null;
  const offTarget = pass && !ev.complete && !picked && !defended && !dropped && !throwAway && !tipped;
  const lateral = (art?.find(a => a.who === 'RB')?.pts.slice(-1)[0]?.[1] ?? 0) * 0.6 + (ev.dir ?? 0) * 3;
  let endY = mid + s * (lateral * 0.7 + (rnd() - 0.5) * 6);
  // Getting out of bounds: catches on outside routes and outside runs often finish at the
  // sideline (stopping the clock) rather than with a tackle in the middle of the field.
  const sidelineFinish = !ev.td && !ev.turnover && rnd() < (pass ? 0.55 : (ev.dir ?? 0) !== 0 ? 0.45 : 0.12);
  if (sidelineFinish && run && (ev.dir ?? 0) !== 0) endY = (s * (ev.dir ?? 0)) > 0 ? 52.6 : 0.7;
  // Quick game for short throws (3-step), a full drop for intermediate and deep ones.
  const dropT = (air <= 2 ? 0.35 : air <= 9 ? 0.5 : 0.8) + rnd() * 0.12;
  let deadline = dropT + (Math.abs(air) > 15 ? 1.1 : Math.abs(air) > 6 ? 0.6 : 0.25) + rnd() * 0.25;
  let throwT = Infinity, airT = 0, catchT = Infinity, settle = false;
  // Some dropbacks are extended: he hangs in, slides and steps up, or escapes the pocket and
  // throws on the run when the first read isn't there.
  const extend = pass && !throwAway && Math.abs(air) >= 5 && rnd() < 0.32 ? 0.6 + rnd() * 1.1 : 0;
  const escape = extend > 0 && rnd() < 0.4, slideSide = rnd() < 0.5 ? -1 : 1;
  const throwKind: 'bullet' | 'touch' | 'deep' = Math.abs(air) >= 25 ? 'deep' : Math.abs(air) <= 3 ? (rnd() < 0.6 ? 'touch' : 'bullet') : rnd() < 0.3 ? 'touch' : 'bullet';
  const vel = throwKind === 'bullet' ? 31 : throwKind === 'touch' ? 21 : 25;   // yards a second: ~60 mph bullets, ~50 mph deep balls
  const flight = (a: [number, number], b: [number, number]) => 0.05 + Math.hypot(b[0] - a[0], b[1] - a[1]) / vel;
  const clampY = (y: number) => Math.max(1.5, Math.min(51.8, y));
  // Zone landmarks for each defensive back by coverage (depth, width), mirrored to his side.
  const sideOf = (w: typeof WHO[number]) => (FORMATION[w][1] >= 0 ? 1 : -1);
  const landmark = (i: number): [number, number] => {
    const w = WHO[i], sd = sideOf(w);
    if (cov2) return i < 2 ? [5, sd * 19] : i === 2 ? [9, sd * 8] : [17, sd * 12];        // corners squat the flats, two deep halves
    if (cov4) return i < 2 ? [14, sd * 19] : i === 2 ? [8, sd * 10] : [15, sd * 7];        // quarters
    return i < 2 ? [15, sd * 18] : [8, sd * 13];                                            // cover 3: deep outside thirds, curl-flat underneath
  };
  const routes = WHO.map(w => { const j = (rnd() - 0.5) * 1.6; return [at(...spotOf(w)), ...((art?.find(a => a.who === w && a.kind === 'route')?.pts ?? [[10, FORMATION[w][1]]]).map((p, k, all) => at(p[0] + (k < all.length - 1 ? j : 0), p[1])))] as [number, number][]; });
  const breaks: { t: number; who: number; back: boolean }[] = [];
  const plantUntil = WHO.map(() => 0);
  const ri = WHO.map(() => 1);
  let carrier: Agent | null = null, thrown = false, caught = false, endT = 0, ballXY: [number, number] = at(0, 0), ballZ = 0;
  const holdTrack: number[] = [];
  let loose: [number, number, number] | null = null;   // velocity of a dead/deflected ball
  let broken = false;                                  // a defender got a hand on it
  // Linemen are locked up with their blockers; on a run they mostly stay locked up at the line,
  // and on a stuffed run one of them beats his man into the backfield.
  let shed = DL.map(() => (run ? 2.2 : 1.4) + rnd() * 1.3);
  if (sack) shed[si] = 1.3;
  if (run && ev.yards <= 1) shed[Math.floor(rnd() * 4)] = 0.55;
  // Pressure: on sacks, scrambles and throw-aways the rush walks the pocket back into the
  // quarterback (a bull rush on the sacker's side), and on a scramble he escapes it.
  const pressured = sack || scramble || throwAway || (pass && !ev.complete && !picked && rnd() < 0.35);
  const bull = DL.map((_, i) => pressured && (i === si || rnd() < 0.45));
  // The trenches aren't a stalemate: on good runs a blocker can pancake his man; on passes a
  // rusher who wins early swims, rips or spins past his blocker, and a pass rush can get
  // stoned and put on the ground.
  const pancakeAt = (run && ev.yards >= 4 && rnd() < 0.45) || (pass && !pressured && rnd() < 0.12) ? 0.55 + rnd() * 0.4 : Infinity;
  const pancakeDL = Math.floor(rnd() * 4);
  const lineDone = DL.map(() => false);
  const escapeSide = rnd() < 0.5 ? -1 : 1;
  const past = (x: number) => s * (x - end) >= 0;   // reached the spot downfield
  const before = (x: number) => s * (x - end) <= 0; // reached the spot behind
  // Contact always resolves: a defender who reaches the ball carrier either wraps him up
  // (when he is at or near the spot the engine decided) or gets beaten by a move.
  const beaten = new Map<Agent, number>();             // defender -> on the turf / out of the play until
  const moves: { t: number; kind: 'juke' | 'spin' | 'stiff' | 'broken' | 'pancake' | 'swim' | 'rip' | 'spinmove' | 'jumpcut' | 'hesi' | 'cut'; d: Agent; until: number; by?: Agent }[] = [];
  let wrapper: Agent | null = null, wrapT = 0;
  const effort = new Map<Agent, number>();
  const out = (d: Agent) => (beaten.get(d) ?? 0) > t;
  let closer: Agent | null = null;
  const zoneCarry = new Map<Agent, Agent>();          // zone defender -> the receiver he's carrying                     // the defender sent to make the tackle at the spot
  // The runner's own moves: reading the hole (cutback or bounce when it's filled), and making
  // the man in front miss before contact (side-to-side juke, jump cut, hesitation, spin).
  // Each is a short velocity program on the carrier; the engine's yardage still decides the end.
  const impulses: { a: Agent; t0: number; t1: number; vy: number; fwd: number; top?: number }[] = [];
  const tried = new Set<Agent>();
  let lastMoveT = -9, holeShift = 0, holeRead = false, ownMoves = 0;
  const crowd = (x: number, y: number, r: number) => agents.reduce((n, a) => n + (a.team === def && !out(a) && Math.hypot(a.x - x, a.y - y) < r ? 1 : 0), 0);
  const goal = (a: Agent) => { const ahead = Math.min(1, dist(a, carrier ?? QB) / 8); const c = carrier ?? QB; return [c.x + c.vx * ahead, c.y + c.vy * ahead] as const; };
  const T_MAX = 11;
  let t = 0;
  for (; t < T_MAX; t += DT) {
    // Ball and carrier.
    if (run) { if (!carrier && t > (qbRun ? 0.3 : 0.45)) carrier = qbRun ? QB : RB; }
    else if (scramble) { if (!carrier && t > 1.5) carrier = QB; }
    else if (sack) carrier = QB;
    else if (!thrown && t >= dropT + (throwAway ? 0.9 : 0) + extend) {
      // Throw when the receiver will be at the right depth by the time the ball gets there.
      const from: [number, number] = [QB.x, QB.y];
      let lead = 0.6, proj: [number, number] = [target.x, target.y];
      for (let it = 0; it < 3; it++) { proj = [target.x + target.vx * lead, clampY(target.y + target.vy * lead)]; lead = flight(from, proj); }
      const depth = s * (proj[0] - los);
      if (depth >= air - 0.6 || t >= deadline) {
        // The catch is made at the engine's air yards: never deeper (that would show a 9-yard
        // gain as a 20-yard one), and if he is short of it he has to get there.
        if (depth > air + 1.5) proj = [los + s * air, proj[1]];
        thrown = true; throwT = t; throwFrom = [from[0] + s * 0.35, from[1]]; recvPt = proj;
        // Comebacks, curls, hitches and finished routes settle and catch it standing; slants,
        // posts, gos and crossers catch it in stride.
        { const rt = routes[targetIdx], a2 = rt[rt.length - 1], a1 = rt[rt.length - 2] ?? rt[0];
          settle = ri[targetIdx] >= rt.length || s * (a2[0] - a1[0]) < -0.3 || air <= 1; }
        if (tipped) tipBy = DL.reduce((b, x) => (dist(x, QB) < dist(b, QB) ? x : b), DL[0]);
        catchPt = tipped ? [QB.x + s * 3.5, clampY(QB.y + (rnd() - 0.5) * 4)] : throwAway ? [QB.x + s * 9, QB.y > mid ? 53.8 : -0.6]
          : picked ? [proj[0] - s * 1.1, clampY(proj[1] + (rnd() - 0.5) * 1.2)]
          : offTarget ? [proj[0] + s * (2 + rnd() * 2.5), clampY(proj[1] + (rnd() < 0.5 ? -1 : 1) * (1.2 + rnd() * 1.8))]
          : proj;
        airT = flight(from, catchPt); catchT = t + airT;
      }
    }
    if (pass && thrown && !caught && t >= catchT) { if (sidelineFinish && (catchPt[1] < 14 || catchPt[1] > 53.3 - 14)) endY = catchPt[1] < mid ? 0.5 : 52.8;
      caught = true; if (ev.complete) carrier = target; else if (ev.turnover) carrier = [...DB, FS, ...LB].find(a => !!ev.ids?.def && idOf(def, a.slot) === ev.ids.def) ?? [...DB, FS].sort((a, b) => dist(a, { x: catchPt[0], y: catchPt[1] }) - dist(b, { x: catchPt[0], y: catchPt[1] }))[0]; }
    // After the whistle everyone eases up; only the men around the ball keep coming.
    const whistle = !!endT && t > endT;
    if (whistle) {
      for (const a of agents) { if (a === wrapper && carrier) { a.vx = carrier.vx; a.vy = carrier.vy; } else { a.vx *= 0.9; a.vy *= 0.9; } }
      // The ball carrier is down where he was tackled.
      if (carrier) { carrier.vx *= 0.75; carrier.vy *= 0.75; }
    } else {
    // Offense.
    const rushDL = DL.filter(d => !dlDrop.has(d));
    // The line keeps its shape: every blocker owns a lane (his spot in the formation) and only
    // shades toward his man, so two blockers on one rusher stand side by side (a double team)
    // instead of stacking on the same spot.
    const lane0 = at(0, 0)[1];
    OL.forEach((o, i) => {
      const m = rushDL[Math.min(rushDL.length - 1, Math.round(i * (rushDL.length - 1) / 4))] ?? DL[1];
      const laneOff = at(0, OL_SPOTS[i][1])[1] - lane0;
      if (run) {
        // The doubled-up blocker climbs to a linebacker; everyone else drives his man off the ball.
        const climb = (i === 2 && t > 0.45) || (i === 1 && ev.yards >= 5 && t > 0.75);
        const laneY = lane0 + laneOff + lateral * 0.25;
        if (climb) { const lb = LB.reduce((b, x) => (dist(x, o) < dist(b, o) ? x : b), LB[0]); steer(o, lb.x - s * 0.7, (lb.y + laneY) / 2, 0.9); }
        else steer(o, m.x + s * (ev.yards >= 3 ? 0.9 : 0.1), m.y * 0.55 + laneY * 0.45, 0.9);
      } else {
        // The pocket: kick-slide back to a set depth in his lane, give ground only in front of
        // his rusher, and stay between him and the quarterback.
        const q = carrier ?? QB;
        // Meet the rusher just in front of him (never upfield of the line), giving ground only as he pushes.
        const setX = los - s * 0.3;
        const laneY = q.y + laneOff * 1.12;
        const ty = laneY + Math.max(-1.7, Math.min(1.7, m.y - laneY));
        const tx = s > 0 ? Math.min(setX, m.x - 0.95) : Math.max(setX, m.x + 0.95);
        steer(o, tx, ty, 0.9);
      }
    });
    if (run) {
      const runner = qbRun ? QB : RB, fake = qbRun ? RB : QB;
      if (carrier !== runner) steer(runner, at(-3.2, lateral * 0.3)[0], at(-3.2, lateral * 0.3)[1]);
      else {
        // Reading the hole: a step from the line, if the designed hole is filled he plants and
        // takes the cutback or bounces it outside, whichever has fewer defenders.
        if (!holeRead && s * (runner.x - los) > -2.4) {
          holeRead = true;
          const h0 = at(0.8, lateral);
          if (crowd(h0[0], h0[1], 1.9) >= 2 && rnd() < 0.7) {
            const dir = Math.sign(lateral) || (rnd() < 0.5 ? 1 : -1);
            const opts = [lateral - dir * 4.5, lateral + dir * 5].map(l => { const h = at(0.8, l); return { l, n: crowd(h[0], h[1], 2.6) + (Math.abs(h[1] - mid) > 22 ? 9 : 0) }; }).sort((a, b) => a.n - b.n);
            holeShift = opts[0].l - lateral; endY = clampY(endY + holeShift * 0.8);
            const by = agents.filter(a => a.team === def && !out(a)).sort((a, b) => dist(a, { x: h0[0], y: h0[1] }) - dist(b, { x: h0[0], y: h0[1] }))[0];
            if (by) { moves.push({ t, kind: 'cut', d: by, until: t + 0.2 }); ownMoves++; lastMoveT = t; }
            runner.vx *= 0.45; runner.vy *= 0.45;   // the plant
          } else if (rnd() < 0.3) {
            // Patience: press the hole, throttle down, let the blocks set, then hit it.
            impulses.push({ a: runner, t0: t, t1: t + 0.22, vy: 0, fwd: 0.45 }, { a: runner, t0: t + 0.22, t1: t + 0.6, vy: 0, fwd: 1, top: runner.top * 1.1 });
          }
        }
        const hole = at(0.8, lateral + holeShift); const thru = s * (runner.x - hole[0]) < -0.5; steer(runner, thru ? hole[0] : end + s * 2, thru ? hole[1] : evade(runner, endY));
      }
      if (qbRun) steer(fake, at(1, -lateral * 0.5)[0], at(1, -lateral * 0.5)[1], 0.7); else steer(fake, at(-5.5, -2)[0], at(-5.5, -2)[1], 0.5);
    } else {
      if (sack) steer(QB, end, mid, 0.55);
      else if (carrier === QB) steer(QB, end + s * 2, endY);
      else if (!thrown && (scramble || throwAway) && t > dropT + 0.25) steer(QB, QB.x + s * 0.6, clampY(mid + escapeSide * 9), 0.75);   // out of the pocket
      else if (!thrown && extend && escape && t > dropT + 0.2) steer(QB, QB.x + s * 0.3, clampY(mid + slideSide * 10), 0.7);   // escapes and throws on the run
      else if (!thrown && extend && t > dropT + 0.15) { const ph = (t - dropT) * 2.2; steer(QB, at(-6.2 + Math.min(1.6, (t - dropT) * 1.2), 0)[0], at(0, Math.sin(ph) * 1.4 * slideSide)[1], 0.35); }   // slides and steps up
      else if (!thrown && sack && t > dropT + 0.2) steer(QB, QB.x + s * 0.4, QB.y + escapeSide * 0.6, 0.3);   // steps up, nowhere to go
      else if (!thrown) steer(QB, at(-7, 0)[0], at(-7, 0)[1], 0.7);
      else steer(QB, QB.x, QB.y, 0.3);
      const rbPts = art?.find(a => a.who === 'RB')?.pts;
      const pick = rbBlock && !thrown && blitzers.size ? [...blitzers].sort((a, b) => dist(a, RB) - dist(b, RB))[0] : null;
      if (pick) steer(RB, pick.x - s * 0.7, (pick.y + QB.y) / 2, 0.95);
      else if (rbPts) { const p = at(...rbPts[rbPts.length - 1]); steer(RB, p[0], p[1], 0.8); } else steer(RB, QB.x + s * 1, QB.y + 1.5, 0.5);
      // Don't run into the quarterback: the back slides around his drop instead of through it.
      if (RB !== carrier) { const dq = dist(RB, QB); if (dq < 1.9) { const ay = Math.sign(RB.y - QB.y) || (RB.slot.length % 2 ? 1 : -1); RB.vy += ay * (1.9 - dq) * 0.6; if (s * (QB.x - RB.x) * RB.vx * s > 0) RB.vx *= 0.9; } }
    }
    REC.forEach((r, i) => {
      if (r === carrier) { steer(r, end + s * 2, evade(r, endY)); return; }
      if (pass && r === target && thrown && !caught) {
        // Run through the catch point at full speed (never slow down to wait for the ball).
        const left = Math.max(0.05, catchT - t), dx = recvPt[0] - r.x, dy = recvPt[1] - r.y, d = Math.hypot(dx, dy) || 1;
        if (settle) { r.top = 8.6; steer(r, recvPt[0], recvPt[1], d < 1.2 ? 0.35 : 0.9); return; }
        r.top = Math.max(8.4, Math.min(10.2, d / left));
        steer(r, recvPt[0] + (dx / d) * 4, recvPt[1] + (dy / d) * 4); return;
      }
      // Blocking: stalk the man across (stay between him and the ball), don't chase.
      if (run || (carrier && carrier !== QB && carrier.team === off)) {
        const m = run ? DB[i] : [...DB, FS, ...LB].sort((a, b) => dist(a, r) - dist(b, r))[0];
        if (dist(m, r) < 9) steer(r, m.x - s * 0.9, m.y, 0.6); else steer(r, r.x + s * 0.5, r.y, 0.35);
        return;
      }
      if (carrier && carrier.team === def) { const [gx, gy] = goal(r); steer(r, gx, gy, 0.85); return; }   // turnover: tackle him
      const rt = routes[i]; const p = rt[Math.min(ri[i], rt.length - 1)];
      if (t < plantUntil[i]) { r.vx *= 0.82; r.vy *= 0.82; return; }       // planting the foot at the break
      if (press && t < 0.45) { const dbi = DB[i]; steer(r, r.x + s * 0.4, r.y + (i % 2 ? 1 : -1) * 0.8, 0.5); if (dist(dbi, r) < 1.4) { r.vx *= 0.7; } return; }   // fighting the jam
      if (ri[i] < rt.length) {
        // Stem at full speed toward the break point, no easing off before it.
        const dx = p[0] - r.x, dy = p[1] - r.y, dd = Math.hypot(dx, dy) || 1;
        steer(r, r.x + (dx / dd) * 6, r.y + (dy / dd) * 6, 0.94);
        if (dd < 0.9) {
          const nx = rt[ri[i] + 1];
          if (nx) {
            const a1 = Math.atan2(dy, dx), a2 = Math.atan2(nx[1] - p[1], nx[0] - p[0]); let da = Math.abs(a2 - a1); if (da > Math.PI) da = 2 * Math.PI - da;
            if (da > 0.85) { plantUntil[i] = t + 0.12 + rnd() * 0.06; breaks.push({ t, who: i, back: s * (nx[0] - p[0]) < -0.3 }); }
          }
          ri[i]++;
        }
      } else steer(r, r.x + s * 4, r.y, 0.92);
    });
    // Defense: everyone has a job until he reads the play, then pursues on an angle.
    const trig = run ? (qbRun ? 0.3 : 0.45) : scramble ? 1.5 : caught ? catchT : Infinity;
    const REACT: Record<string, number> = { DL: 0.05, LB: 0.25, DB: 0.5, S: 0.55 };
    const pursuing = (d: Agent) => !!carrier && carrier !== d && (sack ? d.role !== 'DB' && d.role !== 'S' : t >= trig + REACT[d.role] - (d === cov ? 0.3 : 0));
    // A blitzer: through his gap (linebackers inside, defensive backs off the edge), then at
    // the quarterback, or the ball on a run.
    const blitz = (d: Agent) => { const c = carrier ?? QB, gap = gapOf(d); const thru = s * (d.x - gap[0]) > 0.4; steer(d, thru ? gap[0] : c.x, thru ? gap[1] : c.y, pickedUp(d) ? 0.25 : 1); };
    const pursue = (d: Agent) => {
      const c = carrier!, dd = dist(d, c), lead = Math.max(0.15, Math.min(1.3, dd / 8.5));
      if (out(d)) { d.vx *= 0.92; d.vy *= 0.92; return; }
      if (wrapper && d !== wrapper) { steer(d, c.x - s * 2.5, c.y + (d.y > c.y ? 2.5 : -2.5), 0.45); return; }   // arrive, don't dogpile
      let eff = effort.get(d); if (eff === undefined) { eff = 0.8 + rnd() * 0.2; effort.set(d, eff); }
      const trailing = s * (d.x - c.x) < -2;   // behind the play: chasing, not catching
      d.top = Math.min(d.top, (d.role === 'DL' ? 7.4 : 9.2) * eff * (trailing ? 0.9 : 1));
      // Aim at where he is going, and stay on the downfield side of him (leverage).
      const gx = c.x + c.vx * lead + s * Math.min(2, dd * 0.08), gy = c.y + c.vy * lead;
      steer(d, gx, gy, dd > 20 ? 0.8 : 1);
    };
    DL.forEach((d, i) => {
      // A lineman out of the rush plays like a linebacker: a hook/robber zone, or the run fit.
      if (dlDrop.has(d)) {
        if (out(d)) { d.vx *= 0.92; d.vy *= 0.92; return; }
        if (d === carrier) { steer(d, d.x - s * 8, d.y); return; }
        if (pursuing(d)) { pursue(d); return; }
        if (run && t > 0.3) { const hole = at(1.6, lateral); steer(d, hole[0], hole[1], 0.7); return; }
        steer(d, los + s * (4 + Math.min(2.5, t * 1.5)), (QB.y + mid) / 2, 0.75); return;
      }
      if (!lineDone[i] && i === pancakeDL && t >= pancakeAt && !carrier?.team) { /* handled below */ }
      if (!lineDone[i] && i === pancakeDL && t >= pancakeAt) {
        lineDone[i] = true;
        const o = OL[Math.min(4, Math.round(i * 1.33))];
        beaten.set(d, 99); moves.push({ t, kind: 'pancake', d, until: 99, by: o });
        d.vx = s * 3.2; d.vy *= 0.3;                  // driven back off the ball and onto his back
      }
      if (!lineDone[i] && pass && t >= shed[i] && shed[i] < 1.25 && t < 1.6) {
        lineDone[i] = true;
        const o = OL.reduce((b, x) => (dist(x, d) < dist(b, d) ? x : b), OL[0]);
        moves.push({ t, kind: (['swim', 'rip', 'spinmove'] as const)[Math.floor(rnd() * 3)], d: o, until: t + 0.5, by: d });
        o.vx *= 0.3; o.vy *= 0.3;                      // the blocker lunges and misses
      }
      if (out(d)) { d.vx *= 0.92; d.vy *= 0.92; return; }
      if (carrier && carrier.team === def) { if (d === carrier) steer(d, d.x - s * 8, d.y); else steer(d, d.x - s * 1, d.y, 0.4); return; }
      const held = t < shed[i];
      if (pursuing(d) && !held) { pursue(d); return; }
      if (held && run) { const o = OL[Math.min(4, Math.round(i * 1.33))]; steer(d, o.x + s * 0.8, o.y, ev.yards >= 5 ? 0.12 : ev.yards <= 1 ? 0.55 : 0.28); return; }   // fighting the block: driven off the ball on good runs, winning on stuffs
      const [gx, gy] = goal(d);
      steer(d, gx, gy, held ? (bull[i] ? 0.42 : 0.12) : 1);
    });
    LB.forEach((d, i) => {
      if (out(d)) { d.vx *= 0.92; d.vy *= 0.92; return; }
      if (d === carrier) { steer(d, d.x - s * 8, d.y); return; }
      if (pursuing(d)) { pursue(d); return; }
      // Blitzing: through the A/B gap at the quarterback (or the ball on a run).
      if (blitzers.has(d) && !thrown) { blitz(d); return; }
      if (run && t > 0.3) { const hole = at(1.6, lateral + (i ? 1.5 : -1.5)); steer(d, hole[0], hole[1], 0.75); return; }   // fill the gap
      if (thrown && d === cov) { const p: [number, number] = picked ? catchPt : [recvPt[0] - s * 1.2, recvPt[1]]; steer(d, p[0], p[1]); return; }
      const z = at(6 + Math.min(3, t * 1.5), i ? 4 : -4); steer(d, z[0], (z[1] + QB.y) / 2, 0.7);   // hook zone drop
    });
    DB.forEach((d, i) => {
      if (out(d)) { d.vx *= 0.92; d.vy *= 0.92; return; }
      if (d === carrier) { steer(d, d.x - s * 10, d.y); return; }
      if (pursuing(d)) { pursue(d); return; }
      if (blitzers.has(d) && !thrown) { blitz(d); return; }
      // A defensive back playing linebacker (the 4-3 Mike): run fit and the middle hook.
      if (asLB.has(d) && !manCov && !(thrown && d === cov)) {
        if (run && t > 0.3) { const hole = at(1.6, lateral); steer(d, hole[0], hole[1], 0.75); return; }
        const z = at(6 + Math.min(3, t * 1.5), 0); steer(d, z[0], (z[1] + QB.y) / 2, 0.7); return;
      }
      const r = REC[i];
      if (thrown && !caught && d === cov) {
        const left = Math.max(0.05, catchT - t);
        // On a pick he undercuts the route and gets there first; on a break-up he arrives with
        // the ball; otherwise he is trailing a step or two behind.
        const yac = ev.complete ? ev.yards - air : 0;
        const p: [number, number] = picked ? catchPt : defended ? [recvPt[0] + s * 0.3, recvPt[1] + 0.6]
          : ev.complete && yac < 2.5 ? [recvPt[0] + s * 0.7, recvPt[1] + 0.4]                       // right there: the tackle comes as he catches it
          : [recvPt[0] - s * (offTarget ? 1.1 : Math.min(4, 1.4 + yac * 0.25)), recvPt[1] + (dropped ? 1.2 : 0.7)];   // beaten: trailing by what he won
        if (ev.complete && yac < 2.5) d.top = Math.max(8.6, Math.min(10.4, Math.hypot(p[0] - d.x, p[1] - d.y) / Math.max(0.05, left - 0.02)));
        if (picked || defended) d.top = Math.max(8.6, Math.min(10.4, Math.hypot(p[0] - d.x, p[1] - d.y) / Math.max(0.05, left - 0.04)));
        steer(d, p[0], p[1]); return;
      }
      if (run) { steer(d, r.x + s * 2.2, r.y, 0.5); return; }   // read run: keep leverage on the receiver
      if (thrown && !caught && dist(d, { x: catchPt[0], y: catchPt[1] }) < 12) { steer(d, catchPt[0] + s * 0.8, catchPt[1], 1); return; }   // break on the ball
      const rv = Math.hypot(r.vx, r.vy);
      if (manCov) {
        // Man: mirror him hip to hip, matching his speed (the target gets only the step the
        // engine says he wins; everyone else is blanketed).
        d.top = Math.max(8.6, rv * (r === target && pass ? 0.97 : 1.04) + 0.25);
        steer(d, r.x + r.vx * 0.2 + s * (press && t < 0.45 ? 0.5 : 0.75), r.y + r.vy * 0.2, t < 0.45 && press ? 0.6 : 1); return;
      }
      // Zone: backpedal to the landmark; whoever comes into it he picks up and carries until
      // he's handed off to a teammate who is closer.
      const [lx, ly] = landmark(i), z = at(lx, ly);
      let mine = zoneCarry.get(d);
      if (mine && (dist(mine, d) > 7 || DB.some(o => o !== d && !out(o) && dist(o, mine!) < dist(d, mine!) - 2.5))) mine = undefined;
      if (!mine) mine = REC.filter(rr => Math.hypot(rr.x - z[0], rr.y - z[1]) < 8.5 && rr !== carrier).sort((a, b) => dist(a, d) - dist(b, d))[0];
      if (mine) zoneCarry.set(d, mine); else zoneCarry.delete(d);
      if (mine && t > 0.5) { const mv = Math.hypot(mine.vx, mine.vy); d.top = Math.max(8.6, mv * (mine === target ? 0.96 : 1.02)); steer(d, mine.x + mine.vx * 0.15 + s * 1.1, mine.y + mine.vy * 0.15, 1); }
      else steer(d, z[0], z[1], 0.85);
    });
    if (FS === carrier) steer(FS, FS.x - s * 10, FS.y);
    else if (pursuing(FS)) pursue(FS);
    else if (thrown && FS === cov) { const p: [number, number] = picked ? catchPt : [recvPt[0] + s * 0.4, recvPt[1] + 0.5]; steer(FS, p[0], p[1]); }
    else if (thrown) steer(FS, catchPt[0] + s * 4, catchPt[1], 0.85);   // last line: stay deep of the ball
    else if (run) steer(FS, at(9, lateral * 0.5)[0], at(9, lateral * 0.5)[1], 0.5);
    else if (cov2 || cov4 || (twoHigh && ev.shell === 'Prevent')) {
      // His half (or quarter): the side away from the strong safety; a vertical in it, he carries.
      const z = cov4 ? at(15, 7 * sideX) : at(17, 12 * sideX);
      const deep = REC.filter(r => s * (r.x - los) > 9 && (r.y - mid) * sideX > -2).sort((a, b) => s * (b.x - a.x))[0];
      if (deep && t > 0.6) { FS.top = Math.max(8.4, Math.hypot(deep.vx, deep.vy)); steer(FS, deep.x + s * 2.5, deep.y, 0.95); } else steer(FS, z[0], z[1], 0.8);
    }
    else if (zeroHigh) steer(FS, los + s * (7 + Math.min(2, t)), (QB.y + mid) / 2, 0.6);   // robber: the middle, underneath
    else {
      // Single high: stay deeper than the deepest route and shade to it.
      const deep = REC.filter(r => s * (r.x - los) > 9).sort((a, b) => s * (b.x - a.x))[0];
      if (deep && t > 0.6) { FS.top = Math.max(8.4, Math.hypot(deep.vx, deep.vy)); steer(FS, deep.x + s * 3.5, (deep.y * 2 + mid) / 3, 0.9); }
      else steer(FS, at(13 + t, 0)[0], (QB.y + mid) / 2, 0.5);
    }
    }
    // Making the man in front miss, before he gets his hands on him.
    if (carrier && carrier.team === off && !endT && !wrapper && !sack && (carrier !== QB || run || scramble) && (!pass || caught) && t - lastMoveT > 0.85 && ownMoves < 3 && s * (end - carrier.x) > 3.2) {
      for (const d of agents) {
        if (d.team !== def || out(d) || tried.has(d)) continue;
        const ahead = s * (d.x - carrier.x), dy = d.y - carrier.y;
        if (ahead < 0.7 || ahead > 2.5 || Math.abs(dy) > 1.6) continue;
        tried.add(d);
        if (rnd() > 0.3) continue;
        const away = -Math.sign(dy) || (rnd() < 0.5 ? 1 : -1), roll = rnd();
        const kind = roll < 0.32 ? 'juke' : roll < 0.56 ? 'jumpcut' : roll < 0.78 ? 'hesi' : 'spin';
        const c = carrier;
        if (kind === 'juke') { impulses.push({ a: c, t0: t, t1: t + 0.15, vy: -away * 3.2, fwd: 0.55 }, { a: c, t0: t + 0.15, t1: t + 0.42, vy: away * 5.4, fwd: 0.7 }); d.vy -= away * 2.4; beaten.set(d, t + 1.1); }   // shows one way, goes the other; he bites
        else if (kind === 'jumpcut') { impulses.push({ a: c, t0: t, t1: t + 0.32, vy: away * 6.2, fwd: 0.4 }); d.vx *= 0.4; beaten.set(d, t + 1.0); }
        else if (kind === 'hesi') { impulses.push({ a: c, t0: t, t1: t + 0.26, vy: away * 0.8, fwd: 0.25 }, { a: c, t0: t + 0.26, t1: t + 0.75, vy: away * 1.5, fwd: 1, top: c.top * 1.12 }); beaten.set(d, t + 0.8); }   // stop-start: he overruns it
        else { impulses.push({ a: c, t0: t, t1: t + 0.36, vy: away * 2.4, fwd: 0.5 }); beaten.set(d, t + 1.1); }
        moves.push({ t, kind, d, until: beaten.get(d)! }); ownMoves++; lastMoveT = t;
        break;
      }
    }
    for (const m of impulses) {
      if (t < m.t0 || t >= m.t1 || m.a !== carrier || wrapper || endT) continue;
      const top = m.top ?? m.a.top;
      m.a.vx += (s * top * m.fwd - m.a.vx) * 0.3;
      m.a.vy += (m.vy - m.a.vy) * 0.35;
    }
    // Integrate, then keep bodies apart: teammates give each other room, opponents meet
    // at contact distance (that is what a block or a wrap-up looks like), nobody overlaps.
    // The tackle at the engine's spot: the carrier keeps running at full speed and the
    // defender with the best angle is sent to meet him there (he picks it up and closes). Only
    // if nobody could physically get there does the carrier ease off, and never below a stride.
    if (carrier && carrier.team === off && !endT && !ev.td && !wrapper && (carrier !== QB || run || scramble)) {
      const rem = s * (end - carrier.x), v = Math.max(4, Math.hypot(carrier.vx, carrier.vy));
      if (rem > 0 && rem < 14) {
        const tC = rem / Math.max(4, Math.abs(carrier.vx) || v);
        const spotPt = { x: end, y: clampY(carrier.y + carrier.vy * tC * 0.6) };
        if (!closer || out(closer)) {
          let best = 1e9;
          for (const d of agents) if (d.team === def && !out(d)) { const need = (dist(d, spotPt) - 0.9) / tC; if (need < best) { best = need; closer = d; } }
        }
        if (closer) {
          const need = (dist(closer, spotPt) - 0.9) / Math.max(0.15, tC);
          closer.top = Math.max(closer.top, Math.min(12, need));
          if (dist(closer, carrier) > 1.6) steer(closer, spotPt.x + s * 0.4, spotPt.y, 1);
          if (need > 12) { const cap = Math.max(carrier.top * 0.78, rem / Math.max(0.2, (dist(closer, spotPt) - 0.9) / 12)); if (v > cap) { carrier.vx *= cap / v; carrier.vy *= cap / v; } }
        }
      }
    }
    if (wrapper && carrier && !endT) {
      // Wrapped up: he drives forward for the last yards with the tackler hanging on.
      const v = Math.hypot(carrier.vx, carrier.vy), cap = 3.4; if (v > cap) { carrier.vx *= cap / v; carrier.vy *= cap / v; }
      wrapper.vx = carrier.vx; wrapper.vy = carrier.vy; wrapper.x = carrier.x - s * 0.55; wrapper.y = carrier.y + 0.25;
    }
    for (const a of agents) { a.x += a.vx * DT; a.y += a.vy * DT; }
    if (carrier && carrier.team === off && !endT && !wrapper && (carrier !== QB || run || scramble) && !sack) {
      for (const d of agents) {
        if (d.team !== def || out(d) || dist(d, carrier) > 1.05) continue;
        const rem = s * (end - carrier.x);
        if (!ev.td && rem <= 2.6) { wrapper = d; wrapT = t; break; }
        // Beaten: a move, a missed tackle or a stiff-arm. He's on the turf for a beat.
        const side = Math.abs(d.y - carrier.y) > 0.55, roll = rnd();
        const kind = ev.td && rem <= 2.6 ? 'broken' : side && roll < 0.45 ? 'stiff' : roll < 0.62 ? 'juke' : roll < 0.82 ? 'spin' : 'broken';
        const until = t + 1.15 + rnd() * 0.4;
        beaten.set(d, until); moves.push({ t, kind, d, until });
        const away = Math.sign(carrier.y - d.y) || 1;
        if (kind === 'juke') carrier.vy += away * 3.2;
        d.vx = d.vx * 0.35 + (kind === 'stiff' ? -s * 1.5 : 0); d.vy = d.vy * 0.35 - away * 1.2;
      }
    }
    // Two relaxation passes: one is too weak to stop a pile from forming around the ball.
    for (let pass2 = 0; pass2 < 2; pass2++) for (let i = 0; i < agents.length; i++) for (let j = i + 1; j < agents.length; j++) {
      const a = agents[i], b = agents[j];
      if (endT && (a === carrier || b === carrier)) continue;
      if (wrapper && ((a === wrapper && b === carrier) || (b === wrapper && a === carrier))) continue;
      const lineman = (x: Agent) => x.role === 'OL' || x.role === 'DL';
      const min = a.team === b.team ? 1.25 : lineman(a) && lineman(b) ? 1.0 : 0.85;
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
      const from = throwFrom;
      ballXY = [from[0] + (catchPt[0] - from[0]) * q, from[1] + (catchPt[1] - from[1]) * q];
      const peak = throwKind === 'bullet' ? 0.25 + Math.abs(air) * 0.04 : throwKind === 'touch' ? 1.6 + Math.abs(air) * 0.12 : 2.5 + Math.abs(air) * 0.12;
      ballZ = 2 - q * 0.5 + Math.sin(Math.PI * q) * peak;
    } else if (pass && caught && !ev.complete && !ev.turnover) {
      // Incomplete: the ball is knocked away or falls incomplete, then bounces dead. Nobody holds it.
      if (!loose) {
        const from = throwFrom, dx = catchPt[0] - from[0], dy = catchPt[1] - from[1], d = Math.hypot(dx, dy) || 1;
        // The engine says how it fell incomplete: knocked away, off his hands, or just past him.
        broken = defended;
        loose = defended ? [(dx / d) * 2 + (rnd() - 0.5) * 5, (dy / d) * 2 + (rnd() - 0.5) * 5, 3.2]
          : dropped ? [(dx / d) * 1.2 + (rnd() - 0.5) * 2, (dy / d) * 1.2 + (rnd() - 0.5) * 2, 2.4]
          : [(dx / d) * 5, (dy / d) * 5, -1];
      }
      ballXY = [ballXY[0] + loose[0] * DT, ballXY[1] + loose[1] * DT];
      ballZ += loose[2] * DT; loose[2] -= 10.7 * DT;
      if (ballZ < 0.12) { ballZ = 0.12; loose[2] = Math.abs(loose[2]) * 0.38; loose[0] *= 0.55; loose[1] *= 0.55; if (loose[2] < 0.6) loose[2] = 0; }
    } else {
      // The snap: under centre it's a quick exchange; in the gun the ball flies back to him.
      const h = carrier ?? (t < snapT ? null : QB);
      if (h) { ballXY = [h.x, h.y]; ballZ = 1.1; }
      else { const q = Math.min(1, t / snapT), c0 = at(0, 0); ballXY = [c0[0] + (QB.x - c0[0]) * q, c0[1] + (QB.y - c0[1]) * q]; ballZ = 0.3 + q * 0.8 + Math.sin(Math.PI * q) * (gun ? 0.7 : 0.1); }
    }
    holdTrack.push(pass && thrown && !caught ? -1 : pass && caught && !ev.complete && !ev.turnover ? -1 : carrier ? agents.indexOf(carrier) : t >= snapT ? agents.indexOf(QB) : -1);
    (ballTrack as [number, number, number][]).push([ballXY[0], ballXY[1], ballZ]);
    // When does it end?
    if (!endT) {
      if (pass && caught && !ev.complete && !ev.turnover && t > catchT + 0.45) endT = t;
      else if (pass && caught && ev.turnover && t > catchT + 1.6 + (ev.n % 7) * 0.12) endT = t;   // the return
      else if (carrier && carrier.team === off && (ev.td ? s * (carrier.x - end) > 0.05 : (ev.yards >= 0 || run || scramble) ? past(carrier.x) && t > 0.5 : before(carrier.x)) && (carrier !== QB || !pass || sack || scramble) && (!pass || !caught || t > catchT + 0.3)) endT = t;
      else if (sack && t > 1.2 && dist(sacker, QB) < 1.1) endT = t;
      else if (wrapper && carrier && (s * (end - carrier.x) <= 0.05 || t - wrapT > 1.2)) endT = t;
    }
    if (endT && t > endT + 0.75) break;
  }
  if (!endT) endT = t - 0.75;
  const dur = PRE + t;
  // Interpolated between simulation steps, so motion is smooth at any frame rate and in slow motion.
  const sample = (tr: [number, number][]) => (u: number): [number, number] => {
    const f = Math.max(0, Math.min(tr.length - 1, (u * dur - PRE) / DT)), i = Math.floor(f), j = Math.min(tr.length - 1, i + 1), w = f - i;
    const a = tr[i] ?? tr[0], b = tr[j] ?? a; return [a[0] + (b[0] - a[0]) * w, a[1] + (b[1] - a[1]) * w];
  };
  /** Position along a motion path, `f` of the way (by distance). */
  const along = (pp: [number, number][], f: number): [number, number] => {
    const segs = pp.slice(1).map((p, i) => Math.hypot(p[0] - pp[i][0], p[1] - pp[i][1])), tot = segs.reduce((a, b) => a + b, 0) || 1;
    let d = Math.max(0, Math.min(1, f)) * tot;
    for (let i = 0; i < segs.length; i++) { if (d <= segs[i] || i === segs.length - 1) { const k2 = segs[i] ? Math.min(1, d / segs[i]) : 1; return [pp[i][0] + (pp[i + 1][0] - pp[i][0]) * k2, pp[i][1] + (pp[i + 1][1] - pp[i][1]) * k2]; } d -= segs[i]; }
    return pp[pp.length - 1];
  };
  // Smooth out the twitch from the body-spacing pushes: a short centred average (about 0.1 s)
  // that leaves real motion untouched and takes out frame-to-frame jitter.
  const smooth = (tr: [number, number][]) => {
    const R = 3, outT: [number, number][] = tr.map(p => [p[0], p[1]]);
    for (let i = R; i < tr.length - R; i++) { let sx = 0, sy = 0; for (let j = -R; j <= R; j++) { sx += tr[i + j][0]; sy += tr[i + j][1]; } outT[i] = [sx / (2 * R + 1), sy / (2 * R + 1)]; }
    return outT;
  };
  for (const a of agents) a.track = smooth(a.track);
  // The ball in a player's hands goes where his (smoothed) body goes.
  for (let i = 0; i < ballTrack.length; i++) { const h = holdTrack[i]; if (h >= 0 && agents[h]?.track[i]) { ballTrack[i][0] = agents[h].track[i][0]; ballTrack[i][1] = agents[h].track[i][1]; } }
  for (const a of agents) {
    const first = a.track[0] ?? [a.x, a.y]; const tr = a.track, pre = a.pre;
    k.add(a.team, a.slot, a.role, u => (u * dur < PRE ? (pre ? along(pre, (u * dur - (PRE - MT)) / MT) : first) : sample(tr)(u)));
  }
  const bt = ballTrack as [number, number, number][];
  const bAt = (u: number, c: number) => { const f = Math.max(0, Math.min(bt.length - 1, (u * dur - PRE) / DT)), i = Math.floor(f), j = Math.min(bt.length - 1, i + 1), w = f - i; return bt[i][c] + (bt[j][c] - bt[i][c]) * w; };
  const ball: Path = u => (u * dur < PRE ? at(0, 0) : [bAt(u, 0), bAt(u, 1)]);
  const ballH = (u: number) => (u * dur < PRE ? 0.15 : bAt(u, 2));
  const oobRun = !!carrier && !ev.td && !ev.turnover && (carrier.y < 3.5 || carrier.y > 49.8);
  const tackled = !ev.td && (!(pass && !ev.complete) || !!ev.turnover) && !oobRun;
  return { dur, pre: PRE / dur, los, first, actors: k.actors, ball, ballH: (u: number) => ballH(u), dirSign: s, art, dart, align: FORMATION, tackle: tackled ? Math.min(0.97, (PRE + endT) / dur) : undefined,
    hold: (u: number) => (u * dur < PRE ? -1 : holdTrack[Math.max(0, Math.min(holdTrack.length - 1, Math.round((u * dur - PRE) / DT)))] ?? -1),
    broken, pressured, oob: oobRun, qb: agents.indexOf(QB),
    moves: moves.map(m => ({ at: (PRE + m.t) / dur, kind: m.kind, def: agents.indexOf(m.d), until: (PRE + Math.min(m.until, t)) / dur, by: m.by ? agents.indexOf(m.by) : undefined })),
    breaks: breaks.map(b => ({ at: (PRE + b.t) / dur, who: agents.indexOf(REC[b.who]), back: b.back })),
    tipped: tipped && tipBy ? { at: (PRE + throwT + 0.08) / dur, by: agents.indexOf(tipBy) } : undefined,
    wrapAt: wrapper ? (PRE + wrapT) / dur : undefined, wrapper: wrapper ? agents.indexOf(wrapper) : undefined, target: pass ? agents.indexOf(target) : undefined, throwAt: pass ? (PRE + throwT) / dur : undefined, catchAt: pass ? (PRE + catchT) / dur : undefined, endAt: (PRE + endT) / dur };
}

