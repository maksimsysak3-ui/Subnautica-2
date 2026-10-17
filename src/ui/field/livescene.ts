// A play from the live engine, as a Scene for the field: the recorded positions become each
// actor's path, the recorded ball its flight, and the story beats (throw, catch, the tackle,
// missed tackles, route breaks) drive the bodies' animation in choreo.ts.
import type { PlayEvent } from '../../sim/game';
import type { LiveSlot } from '../../sim/livetypes';
import { PLAY_ART, DEF_ART, alignFor } from '../playart';
import { slotFor, type Actor, type Lineup, type Path, type Scene } from './scene';

/** Whether the user's games run on the live play engine (on unless switched off). */
export const LIVE_KEY = 'gg-live-engine';
export const liveEngineOn = () => { try { return localStorage.getItem(LIVE_KEY) !== '0'; } catch { return true; } };
export const setLiveEngine = (on: boolean) => { try { localStorage.setItem(LIVE_KEY, on ? '1' : '0'); } catch { /* storage blocked */ } };

const PRE = 0.6;   // the set before the snap (the walk-up and huddle break come before this)
const MID = 26.65;

const roleOf = (slot: LiveSlot): string =>
  slot.startsWith('OL') ? 'OL' : slot.startsWith('DL') ? 'DL' : slot.startsWith('LB') ? 'LB' : slot.startsWith('DB') ? 'DB' : slot === 'FS' ? 'S' : slot;

export function liveScene(ev: PlayEvent, lineups: [Lineup, Lineup]): Scene {
  const { rec, ids } = ev.live!;
  const s = ev.poss === 1 ? 1 : -1;
  const off = (ev.poss === 1 ? 1 : 0) as 0 | 1, def = (1 - off) as 0 | 1;
  const toX = (yl: number) => (s > 0 ? 10 + yl : 110 - yl);
  const los = toX(ev.yl), first = toX(Math.min(100, ev.yl + ev.togo));
  const playT = (rec.frames - 1) / rec.hz, dur = PRE + playT;
  const fAt = (u: number) => Math.max(0, Math.min(rec.frames - 1, (u * dur - PRE) * rec.hz));
  const lerpArr = (a: Float32Array, f: number) => { const i = Math.floor(f), j = Math.min(a.length - 1, i + 1), w = f - i; return a[i] + (a[j] - a[i]) * w; };
  const U = (frame: number) => (PRE + frame / rec.hz) / dur;

  const actors: Actor[] = rec.slots.map((slot, k) => {
    const team = (k < 11 ? off : def) as 0 | 1;
    const who = (ids[slot] ? slotFor(ids[slot]!) : undefined) ?? lineups[team][slot] ?? { num: 0, ln: '' };
    const xs = rec.xs[k], ys = rec.ys[k];
    const path: Path = u => { const f = fAt(u); return [lerpArr(xs, f), lerpArr(ys, f)]; };
    return { team, slot, role: roleOf(slot), path, facing: team === off ? s : -s, num: who.num, ln: who.ln, id: who.id, skin: who.skin };
  });
  const ball: Path = u => (u * dur < PRE ? [los, MID] : [lerpArr(rec.bx, fAt(u)), lerpArr(rec.by, fAt(u))]);
  const ballH = (u: number) => (u * dur < PRE ? 0.15 : lerpArr(rec.bz, fAt(u)));
  const hold = (u: number) => (u * dur < PRE ? -1 : rec.hold[Math.round(fAt(u))] ?? -1);
  const pass = ev.type === 'pass';
  const qb = rec.slots.indexOf('QB');
  const act = (i: number, u: number) => { const k = Math.round(fAt(u)); return { a: rec.acts[i][k] ?? 0, f: (rec.faces[i][k] || (i < 11 ? s : -s)) as 1 | -1 }; };
  return {
    dur, pre: PRE / dur, los, first, actors, ball, ballH, dirSign: s, off,
    art: PLAY_ART[ev.call ?? ''], dart: DEF_ART[ev.dcall ?? ''], align: alignFor(ev.call),
    hold, act, kick: false, pass, complete: !!ev.complete, int: pass && !!ev.turnover, td: !!ev.td,
    oob: /out of bounds/.test(ev.text), broken: /broken up/.test(ev.text), pressured: /pressure/.test(ev.text),
    qb, target: rec.target, swatter: rec.swatter,
    throwAt: rec.throwF !== undefined ? U(rec.throwF) : undefined,
    catchAt: rec.catchF !== undefined ? U(rec.catchF) : undefined,
    tackle: rec.tackleF !== undefined ? Math.min(0.97, U(rec.tackleF)) : undefined,
    wrapAt: rec.wrapF !== undefined ? U(rec.wrapF) : undefined, wrapper: rec.tackler, tackler: rec.tackler,
    endAt: U(rec.endF),
    breaks: rec.breaks.map(b => ({ at: U(b.f), who: b.who, back: b.back })),
    moves: [
      ...rec.missed.map(m => ({ at: U(m.f), kind: 'broken' as const, def: m.who, until: U(m.f + rec.hz * 0.5) })),
      ...rec.jukes.map(m => ({ at: U(m.f), kind: m.kind, def: m.who, until: U(m.f + rec.hz * 0.6) })),
      ...rec.sheds.map(m => ({ at: U(m.f), kind: m.kind, def: m.blocker, by: m.rusher, until: U(m.f + rec.hz * 0.5) })),
    ],
  };
}
