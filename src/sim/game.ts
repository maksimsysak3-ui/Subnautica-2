// Play-by-play game engine. Each snap resolves real matchups:
//   pass: rushers vs blockers -> time to pressure; every route vs its defender
//         (man or zone) -> separation; the QB reads by awareness; accuracy for the
//         throw depth and the catcher's hands decide the ball; YAC vs tacklers.
//   run:  blocking vs the front and box count -> yards before contact; vision,
//         break-tackle and speed -> yards after; fumbles by ball security.
// Clock rules (stoppages, two-minute warning, timeouts, hurry-up), penalties at
// real rates, the 2025 kickoff rules, fourth-down and two-point decisions,
// weather, injuries, wear, Superstar abilities and X-Factor zones.
import type { League, Player, Pos, StatLine, Team, Game, BoxScore, TeamBox } from '../core/types';
import { Rng, clamp, hash } from '../core/rng';
import { emptyLine } from '../core/league';
import { sideEdge, fans } from '../core/media';
import { coachHas } from '../core/coaching';
import { unitEdge, kickEdge, injuryShield } from '../core/staff';
import { heat } from '../core/rivalry';
import { facilityGameDay, facilityHomeEdge, facilityInjuryShield } from '../core/facilities';

export type PassDepth = 'screen' | 'quick' | 'short' | 'medium' | 'deep';
export interface OffCall { kind: 'run' | 'pass' | 'punt' | 'fg' | 'kneel' | 'spike'; run?: 'inside' | 'outside' | 'qb'; depth?: PassDepth; pa?: boolean; name?: string; /** First read for a designed play. */ primary?: 'X' | 'Z' | 'SLOT' | 'TE' | 'RB' }
export interface DefCall { shell: 'Cover 0' | 'Cover 1' | 'Cover 2' | 'Cover 3' | 'Cover 4' | 'Prevent'; blitz: boolean; box: number; name?: string }

export interface PlayEvent {
  n: number; q: number; clock: number; poss: 0 | 1; down: number; togo: number; yl: number;
  type: 'run' | 'pass' | 'sack' | 'scramble' | 'punt' | 'fg' | 'xp' | 'two' | 'kickoff' | 'kneel' | 'spike' | 'penalty' | 'timeout' | 'end';
  text: string; yards: number; endYl: number;
  ids?: { qb?: string; ball?: string; target?: string; def?: string; kicker?: string };
  air?: number; complete?: boolean; td?: boolean; turnover?: boolean; score?: [number, number]; big?: boolean;
  dir?: -1 | 0 | 1; call?: string; dcall?: string; wp?: number;
}

const SIG = (x: number) => 1 / (1 + Math.exp(-x));

interface Side {
  team: Team; abbr: string; timeouts: number;
  /** In-game fatigue 0..1 and out-of-game flags. */
  fatigue: Map<string, number>; out: Set<string>;
  zone: Map<string, number>; zoneOn: Set<string>;
}

/** A halftime adjustment: second-half rating changes, a player to take away, ball security. */
export interface HalfAdj { name: string; off: number; def: number; target?: string; secure?: boolean }
export interface Weather { temp: number; wind: number; precip: 'none' | 'rain' | 'snow'; dome: boolean }

export class GameSim {
  rng: Rng;
  sides: [Side, Side]; // 0 = away, 1 = home
  q = 1; clock = 900; poss: 0 | 1 = 0; down = 1; togo = 10; yl = 25;
  score: [number, number] = [0, 0];
  /** Four quarters plus overtime. */
  qScores: [number[], number[]] = [[0, 0, 0, 0, 0], [0, 0, 0, 0, 0]];
  over = false; ot = false;
  events: PlayEvent[] = [];
  lines = new Map<string, StatLine>();
  box: [TeamBox, TeamBox];
  scoring: BoxScore['scoring'] = [];
  injuries: { pid: string; weeks: number; type: string; season?: boolean }[] = [];
  weather: Weather;
  /** Pending: 'kickoff' after scores / halves, 'pat' after a touchdown. */
  pending: 'kickoff' | 'pat' | null = 'kickoff';
  receivesSecondHalf: 0 | 1;
  private n = 0;
  private hurry: [boolean, boolean] = [false, false];
  private warned = [false, false];
  private otPossessions = 0;
  private snaps = new Map<string, number>();
  private hits = new Map<string, number>();
  private pregameEdge: number;
  /** Game-day form: whole-team swing plus per-player swing scaled by consistency. */
  private teamForm: [number, number];
  heat = 0;
  /** Halftime adjustments, per side (0 away, 1 home); they apply from the third quarter. */
  adj: [HalfAdj | null, HalfAdj | null] = [null, null];
  /** When false, the user's halftime call waits for the UI (halfPending). */
  autoHalf = true;
  halfPending = false;
  /** What an AI staff does at the half: chase points when behind, protect the ball when ahead. */
  aiHalf(i: 0 | 1): HalfAdj | null {
    const lead = this.score[i] - this.score[1 - i];
    if (lead <= -8) return { name: 'Open It Up', off: 2.5, def: -1 };
    if (lead >= 8) return { name: 'Ball Control', off: -0.5, def: 0.5, secure: true };
    return null;
  }
  /** The user's halftime call. */
  setHalf(i: 0 | 1, a: HalfAdj | null) { this.adj[i] = a; this.halfPending = false; }
  private form = new Map<string, number>();
  firstOtPoss: 0 | 1 | null = null;

  constructor(public league: League, public game: Game, seed?: number, public playoff = game.week > 18) {
    this.rng = new Rng(seed ?? hash(game.id + league.seed));
    const mk = (abbr: string): Side => ({ team: league.teams[abbr], abbr, timeouts: 3, fatigue: new Map(), out: new Set(), zone: new Map(), zoneOn: new Set() });
    this.sides = [mk(game.away), mk(game.home)];
    const box = (): TeamBox => ({ yds: 0, pyds: 0, ryds: 0, fd: 0, to: 0, pen: 0, peny: 0, top: 0, plays: 0, third: [0, 0], sacks: 0 });
    this.box = [box(), box()];
    this.weather = makeWeather(this.sides[1].team, game, this.rng);
    // Coin toss: winner defers, so the other side receives first.
    const winner = this.rng.chance(0.5) ? 0 : 1;
    this.poss = (1 - winner) as 0 | 1;
    this.receivesSecondHalf = winner as 0 | 1;
    this.pregameEdge = 0;
    // Rivalry heat: more volatile games, a louder building, short tempers.
    this.heat = heat(league, game.home, game.away);
    const sd = 2.3 * (1 + this.heat / 250);
    this.teamForm = [this.rng.normal(0, sd) + sideEdge(league, game.away, game.home), this.rng.normal(0, sd) + sideEdge(league, game.home, game.away)];
  }

  // ---- personnel -----------------------------------------------------------------
  private avail(side: Side, pos: Pos, n: number, skip: Set<string> = new Set()): Player[] {
    const ids = side.team.depth[pos] ?? [];
    const out: Player[] = [];
    for (const id of ids) {
      if (out.length >= n) break;
      const p = this.league.players[id];
      if (!p || p.injury || (p as Player & { holdout?: unknown }).holdout || side.out.has(id) || skip.has(id) || p.team !== side.abbr) continue;
      out.push(p);
    }
    return out;
  }
  /** Rotates tired starters out, the way real DL and RB rooms work. */
  private rotate(side: Side, pos: Pos, n: number, depthUse: number): Player[] {
    const pool = this.avail(side, pos, n + 2);
    const chosen: Player[] = [];
    for (const p of pool) {
      if (chosen.length >= n) break;
      const tired = side.fatigue.get(p.id) ?? 0;
      if (chosen.length < n && pool.length > n && this.rng.chance(tired * depthUse) && !p.abil.includes('Workhorse')) continue;
      chosen.push(p);
    }
    for (const p of pool) if (chosen.length < n && !chosen.includes(p)) chosen.push(p);
    return chosen;
  }
  /** Effective rating: attribute adjusted for fatigue, condition, zones and home field. */
  private r(side: Side, p: Player | undefined, a: keyof Player['attrs']): number {
    if (!p) return 40;
    let v = p.attrs[a];
    v -= (side.fatigue.get(p.id) ?? 0) * 8 + (100 - p.cond) * 0.08;
    if (side.zoneOn.has(p.id)) v += 10;
    let f = this.form.get(p.id);
    if (f === undefined) { f = this.rng.normal(0, (100 - p.traits.cons) / 14); this.form.set(p.id, f); }
    v += f + this.teamForm[side === this.sides[0] ? 0 : 1];
    if (side === this.sides[1] && !this.game.neutral) v += (side.abbr === this.league.user ? 0.4 + fans(this.league) * 0.008 : 0.8) + this.heat * 0.008;
    if (p.morale < 40) v -= 2; else if (p.morale >= 85) v += 0.6;
    v += p.sform ?? 0; // breakout or dud season
    if (side.abbr === this.league.user) v += this.coachEdge(side, p, a);
    v += this.staffEdge(side, p, a);
    if (this.q >= 3) {
      const mine = this.adj[side === this.sides[0] ? 0 : 1], theirs = this.adj[side === this.sides[0] ? 1 : 0];
      if (mine) v += side === this.sides[this.poss] ? mine.off : mine.def;
      if (theirs?.target === p.id) v -= 4;   // the other side's game plan for their best player
    }
    return v;
  }
  private se = new Map<string, { off: number; def: number; kick: number; inj: number; film: number; home: number; med: number }>();
  private staffOf(side: Side) {
    let e = this.se.get(side.abbr);
    if (!e) { e = { off: unitEdge(this.league, side.abbr, 'OC'), def: unitEdge(this.league, side.abbr, 'DC'), kick: kickEdge(this.league, side.abbr), inj: injuryShield(this.league, side.abbr), film: facilityGameDay(this.league, side.abbr), home: facilityHomeEdge(this.league, side.abbr), med: facilityInjuryShield(this.league, side.abbr) }; this.se.set(side.abbr, e); }
    return e;
  }
  /** Coordinators on game day; the special teams coach for kickers and punters. */
  private staffEdge(side: Side, p: Player, a: keyof Player['attrs']): number {
    const e = this.staffOf(side);
    const fac = e.film + (side === this.sides[1] && !this.game.neutral ? e.home : 0);
    if (p.pos === 'K' || p.pos === 'P') return fac + (a === 'KPW' || a === 'KAC' ? e.kick : 0);
    return fac + (side === this.sides[this.poss] ? e.off : e.def);
  }
  private cu?: Set<string>;
  /** The user's coach tree on game day: situational bonuses from unlocked abilities. */
  private coachEdge(side: Side, p: Player, a: keyof Player['attrs']): number {
    const u = (this.cu ??= new Set(this.league.coachTree.unlocked));
    if (!u.size) return 0;
    const onO = side === this.sides[this.poss], home = side === this.sides[1] && !this.game.neutral;
    let b = 0;
    if (u.has('Motivator')) b += 0.6;
    if (u.has('Home Fortress') && home) b += 0.6;
    if (u.has('Road Warriors') && !home && !this.game.neutral) b += 0.7;
    if (u.has('Big Game Coach') && this.playoff) b += 1;
    if (u.has('Clock Manager') && this.q >= 4 && this.clock <= 300 && Math.abs(this.score[0] - this.score[1]) <= 8) b += 1.5;
    if (onO) {
      if (u.has('Scheme Expert')) b += 0.5;
      if (u.has('Air Raid') && (p.pos === 'QB' || p.pos === 'WR' || p.pos === 'TE')) b += 0.6;
      if (u.has('Ground Game') && (p.pos === 'RB' || p.pos === 'FB' || p.pos === 'OT' || p.pos === 'G' || p.pos === 'C')) b += 0.6;
      if (u.has('Two-Minute Drill') && this.twoMinute()) b += 1;
      if (u.has('Red Zone Specialist') && this.yl >= 80) b += 1.2;
    } else {
      if (u.has('Defensive Mind')) b += 0.5;
      if (u.has('Pressure Package') && (a === 'FMV' || a === 'PMV')) b += 1.2;
      if (u.has('Lockdown Coverage') && (a === 'MCV' || a === 'ZCV')) b += 1;
      if (u.has('Takeaway Drills') && a === 'CTH') b += 4;
      if (u.has('Goal Line Stand') && this.yl >= 80) b += 1.2;
    }
    return b;
  }
  /** Ball security after a halftime 'ball control' adjustment by the side with the ball. */
  private secureNow() { return this.q >= 3 && !!this.adj[this.poss]?.secure; }
  private has(p: Player | undefined, ab: string) { return !!p && p.abil.includes(ab); }

  private offense() {
    const s = this.sides[this.poss];
    const qb = this.avail(s, 'QB', 1)[0];
    // Backfield committee: the RB2 takes a real share, more if he is close in quality.
    const rbPool = this.avail(s, 'RB', 2);
    const rbs = rbPool.length > 1 && !this.has(rbPool[0], 'Workhorse') && this.rng.chance(clamp(0.46 + (rbPool[1].ovr - rbPool[0].ovr) * 0.006 + (s.fatigue.get(rbPool[0].id) ?? 0) * 0.15, 0.3, 0.55)) ? [rbPool[1]] : rbPool;
    const wrs = this.avail(s, 'WR', 4);
    const tes = this.avail(s, 'TE', 2);
    const ots = this.avail(s, 'OT', 2), gs = this.avail(s, 'G', 2), cs = this.avail(s, 'C', 1);
    const ol = [...ots, ...gs, ...cs];
    while (ol.length < 5) { const extra = this.avail(s, 'G', 4, new Set(ol.map(p => p.id))).concat(this.avail(s, 'OT', 4, new Set(ol.map(p => p.id))))[0]; if (!extra) break; ol.push(extra); }
    return { s, qb, rb: rbs[0], wrs, tes, ol, fb: this.avail(s, 'FB', 1)[0] };
  }
  private defense(nickel: boolean) {
    const s = this.sides[1 - this.poss];
    const edges = this.rotate(s, 'EDGE', 2, 0.45), dts = this.rotate(s, 'DT', 2, 0.5);
    const lbs = this.avail(s, 'LB', nickel ? 2 : 3);
    const cbs = this.avail(s, 'CB', nickel ? 3 : 2);
    const ss = this.avail(s, 'S', 2);
    return { s, dl: [...edges, ...dts], edges, dts, lbs, cbs, ss };
  }

  // ---- situational AI -----------------------------------------------------------
  private diff() { return this.score[this.poss] - this.score[1 - this.poss]; }
  private timeLeft() { return (this.q >= 4 ? 0 : (4 - this.q) * 900) + this.clock; }
  private twoMinute() { return (this.q === 2 || this.q >= 4) && this.clock <= 120; }

  /** Offensive play call for the AI (or a user override). */
  aiOffense(): OffCall {
    const s = this.sides[this.poss];
    const plan = s.team.plan;
    const coach = s.team.coach;
    const diff = this.diff();
    const tl = this.timeLeft();
    // Victory formation.
    if (this.q >= 4 && diff > 0 && this.canKneelOut()) return { kind: 'kneel', name: 'Victory Formation' };
    if (this.q === 2 && this.clock <= 30 && this.yl < 60 && diff >= 0 && this.down < 4 && s.timeouts < 3) {
      // Not worth risking; kneel out the half if deep in own territory.
      if (this.yl < 40) return { kind: 'kneel', name: 'Kneel' };
    }
    if (this.down === 4) {
      const decision = this.fourthDown();
      if (decision !== 'go') return { kind: decision, name: decision === 'fg' ? 'Field Goal' : 'Punt' };
    }
    // Spike to stop the clock in a two-minute drill when out of timeouts.
    if (this.twoMinute() && this.clock < 40 && this.clock > 3 && s.timeouts === 0 && diff <= 0 && this.lastClockRunning && this.down < 3 && this.rng.chance(0.6)) return { kind: 'spike', name: 'Spike' };
    let pass = this.down === 1 ? (this.togo >= 10 ? 0.47 : 0.42)
      : this.down === 2 ? (this.togo >= 8 ? 0.6 : this.togo <= 3 ? 0.34 : 0.5)
      : this.togo <= 2 ? 0.42 : this.togo <= 6 ? 0.78 : 0.92;
    if (this.down === 4) pass = this.togo <= 2 ? 0.45 : 0.9;
    if (this.yl >= 98) pass -= 0.15; else if (this.yl >= 90) pass -= 0.07;
    if (this.q >= 3) {
      if (diff <= -9) pass += 0.18; else if (diff < 0 && tl < 600) pass += 0.15;
      // Protecting a lead: lean on the run, but real offences still throw ~40% of the time.
      if (diff >= 8 && this.q === 4) pass -= 0.16; else if (diff > 0 && tl < 300) pass -= 0.2;
    }
    if (this.twoMinute() && diff <= 0) pass = 0.88;
    pass = Math.max(pass, this.q >= 4 && diff > 0 && tl < 240 ? 0.22 : 0.36);
    pass += { 'Balanced': 0, 'Run Heavy': -0.09, 'Pass Heavy': 0.08, 'Vertical': 0.05, 'Ball Control': -0.06 }[plan.off];
    pass += { 'West Coast': 0.02, 'Vertical': 0.04, 'Wide Zone': -0.03, 'Power Run': -0.05, 'Spread': 0.04 }[coach.off];
    const o = this.offense();
    // Lean on whichever unit is better.
    const qbV = o.qb ? o.qb.ovr : 50, rbV = o.rb ? o.rb.ovr : 50;
    pass += (qbV - rbV) * 0.003;
    if (this.rng.chance(clamp(pass, 0.08, 0.96))) {
      const deepBias = plan.off === 'Vertical' ? 0.06 : plan.off === 'Ball Control' ? -0.05 : 0;
      const long = this.togo >= 8 && this.down >= 2;
      const depth = this.rng.weighted<PassDepth>([
        ['screen', long ? 0.06 : 0.1], ['quick', this.togo <= 4 ? 0.34 : 0.22], ['short', 0.3],
        ['medium', long ? 0.32 : 0.22], ['deep', Math.max(0.02, (long ? 0.14 : 0.1) + deepBias + (this.twoMinute() ? 0.04 : 0))],
      ]);
      const pa = this.down <= 2 && !this.twoMinute() && depth !== 'screen' && this.rng.chance(coach.off === 'Wide Zone' || coach.off === 'Power Run' ? 0.32 : 0.2);
      return { kind: 'pass', depth, pa, name: passName(depth, pa) };
    }
    const qbRun = o.qb && o.qb.attrs.SPD >= 84 && this.rng.chance(0.14);
    const outside = this.rng.chance(coach.off === 'Wide Zone' ? 0.55 : coach.off === 'Power Run' ? 0.3 : 0.42);
    return { kind: 'run', run: qbRun ? 'qb' : outside ? 'outside' : 'inside', name: qbRun ? 'QB Option' : outside ? (coach.off === 'Wide Zone' ? 'Outside Zone' : 'Toss') : (coach.off === 'Power Run' ? 'Power' : 'Inside Zone') };
  }

  aiDefense(): DefCall {
    const s = this.sides[1 - this.poss];
    const plan = s.team.plan;
    const scheme = s.team.coach.def;
    const longYds = this.togo >= 8 && this.down >= 2;
    let blitz = { '4-3 Over': 0.2, '3-4 Two-Gap': 0.24, 'Cover 3': 0.2, 'Two-High': 0.14, 'Blitz': 0.36 }[scheme];
    if (this.down === 3) blitz += 0.08;
    if (plan.def === 'Blitz Heavy') blitz += 0.18;
    if (plan.def === 'Prevent') blitz = 0.03;
    const isBlitz = this.rng.chance(blitz);
    // Defences protecting a big second-half lead play soft: give up underneath, not deep.
    const prevent = (this.twoMinute() && this.diff() < 0 && this.diff() >= -8 && this.yl < 70) || plan.def === 'Prevent' || (this.q >= 3 && this.diff() <= -17 && this.rng.chance(0.6));
    let shell: DefCall['shell'];
    if (prevent) shell = 'Prevent';
    else if (isBlitz) shell = this.rng.chance(0.3) ? 'Cover 0' : 'Cover 1';
    else {
      const w: [DefCall['shell'], number][] = scheme === 'Two-High' ? [['Cover 2', 0.3], ['Cover 4', 0.35], ['Cover 3', 0.2], ['Cover 1', 0.15]]
        : scheme === 'Cover 3' ? [['Cover 3', 0.5], ['Cover 1', 0.2], ['Cover 2', 0.15], ['Cover 4', 0.15]]
        : [['Cover 3', 0.33], ['Cover 1', 0.27], ['Cover 2', 0.22], ['Cover 4', 0.18]];
      shell = this.rng.weighted(longYds ? w.map(([k, v]) => [k, k === 'Cover 4' || k === 'Cover 2' ? v * 1.4 : v] as [DefCall['shell'], number]) : w);
    }
    let box = this.togo <= 2 || (this.down === 1 && !this.twoMinute()) ? 7 : 6;
    if (this.yl >= 95 || (this.togo <= 1 && this.down >= 3)) box = 8;
    if (plan.def === 'Stop the Run' && this.rng.chance(0.5)) box += 1;
    if (plan.def === 'Stop the Pass') box = Math.min(box, 6);
    return { shell, blitz: isBlitz, box, name: `${shell}${isBlitz ? ' Blitz' : ''}` };
  }

  private canKneelOut(): boolean {
    const opp = this.sides[1 - this.poss];
    const kneels = 4 - this.down;
    const burn = kneels * 40 - opp.timeouts * 38 * (kneels > 0 ? 1 : 0);
    return this.timeLeft() <= Math.max(2, burn) && this.q >= 4;
  }

  private fgDistance() { return 100 - this.yl + 17; }
  private kicker(side = this.sides[this.poss]) { return this.avail(side, 'K', 1)[0] ?? this.avail(side, 'P', 1)[0]; }
  private fgRange() {
    const k = this.kicker();
    const max = 50 + ((k?.attrs.KPW ?? 70) - 70) * 0.3 - (this.weather.wind > 15 ? 4 : 0);
    return this.fgDistance() <= Math.min(64, max);
  }

  fourthDown(): 'go' | 'fg' | 'punt' {
    const s = this.sides[this.poss];
    const diff = this.diff(), tl = this.timeLeft();
    const inRange = this.fgRange();
    // Down late: anything but going for it loses.
    if (this.q >= 4 && diff < 0 && (tl < 150 || (diff < -3 && tl < 240))) {
      if (diff >= -3 && inRange && tl < 25) return 'fg';
      return 'go';
    }
    if (this.q >= 4 && diff >= -3 && diff < 0 && inRange && tl < 120) return 'fg';
    let g = this.togo <= 1 ? 1.6 : this.togo === 2 ? 0.8 : this.togo <= 4 ? 0.1 : -1.2 - (this.togo - 4) * 0.25;
    g += this.yl >= 60 ? 0.55 : this.yl >= 45 ? 0.05 : this.yl >= 35 ? -0.7 : -2.2;
    if (inRange && this.fgDistance() <= 45) g -= 0.9;
    g += (s.team.coach.aggr - 0.5) * 1.6;
    if (this.q >= 4 && diff < 0) g += tl < 400 ? 1.2 : 0.4;
    if (this.q >= 4 && diff > 0) g -= 0.7;
    if (this.yl >= 97 && this.togo <= 2) g += 0.6;
    if (g > 0.55) return 'go';
    if (inRange) return 'fg';
    return 'punt';
  }

  // ---- driving the game ---------------------------------------------------------
  private lastClockRunning = false;

  /** Advance one play. `call` overrides the AI for the offense; `dcall` for the defense. */
  step(call?: OffCall, dcall?: DefCall): PlayEvent | null {
    if (this.over) return null;
    if (this.pending === 'kickoff') return this.kickoff();
    if (this.pending === 'pat') return this.pat();
    // AI defensive timeouts: trailing late, opponent running the clock.
    const def = this.sides[1 - this.poss];
    if (this.lastClockRunning && this.q >= 4 && this.clock < 150 && this.diff() > 0 && def.timeouts > 0 && this.score[1 - this.poss] >= this.score[this.poss] - 16) {
      def.timeouts--; this.lastClockRunning = false;
      return this.push({ type: 'timeout', text: `Timeout, ${def.team.nick}. ${def.timeouts} left.`, yards: 0, endYl: this.yl });
    }
    const off = this.sides[this.poss];
    if (this.lastClockRunning && this.twoMinute() && this.diff() <= 0 && off.timeouts > 0 && this.clock < 100 && this.clock > 2 && this.yl > 20) {
      off.timeouts--; this.lastClockRunning = false;
      return this.push({ type: 'timeout', text: `Timeout, ${off.team.nick}. ${off.timeouts} left.`, yards: 0, endYl: this.yl });
    }
    // Clock runs off between snaps when it was left running.
    if (this.lastClockRunning) this.runoff(this.betweenPlays());
    if (this.clock <= 0) return this.endPeriod();
    const oc = call ?? this.aiOffense();
    const dc = dcall ?? this.aiDefense();
    this.at = { q: this.q, clock: this.clock, poss: this.poss, down: this.down, togo: this.togo, yl: this.yl };
    switch (oc.kind) {
      case 'kneel': return this.kneel();
      case 'spike': return this.spike();
      case 'punt': return this.punt();
      case 'fg': return this.fieldGoal();
      default: return this.scrimmage(oc, dc);
    }
  }

  simToEnd() { let guard = 0; while (!this.over && guard++ < 600) this.step(); return this.result(); }

  private betweenPlays(): number {
    const diff = this.diff();
    if (this.twoMinute() && diff <= 0) return 13;
    if (this.q >= 4 && diff > 0) return 40;
    if (this.hurry[this.poss]) return 17;
    return 36 + this.rng.int(-4, 8);
  }
  private runoff(sec: number) {
    // Two-minute warning stops the clock.
    const half = this.q <= 2 ? 0 : 1;
    if ((this.q === 2 || this.q === 4) && !this.warned[half] && this.clock > 120 && this.clock - sec <= 120) {
      this.box[this.poss].top += this.clock - 120;
      this.clock = 120; this.warned[half] = true; this.lastClockRunning = false;
      this.push({ type: 'timeout', text: 'Two-minute warning.', yards: 0, endYl: this.yl });
      return;
    }
    const used = Math.min(this.clock, sec);
    this.clock -= used;
    this.box[this.poss].top += used;
  }

  private endPeriod(): PlayEvent | null {
    if (this.q === 2) {
      this.q = 3; this.clock = 900; this.poss = this.receivesSecondHalf; this.pending = 'kickoff';
      for (const s of this.sides) s.timeouts = 3;
      this.lastClockRunning = false;
      // Halftime: AI staffs adjust; the user's side waits for a decision when someone is watching.
      for (const i of [0, 1] as const) {
        if (this.adj[i]) continue;
        if (this.sides[i].abbr === this.league.user && !this.autoHalf) this.halfPending = true;
        else this.adj[i] = this.aiHalf(i);
      }
      return this.push({ type: 'end', text: 'End of the first half.', yards: 0, endYl: this.yl });
    }
    if (this.q < 4 && !this.ot) {
      this.q++; this.clock = 900; this.lastClockRunning = false;
      return this.push({ type: 'end', text: `End of the ${['', '1st', '2nd', '3rd'][this.q - 1]} quarter.`, yards: 0, endYl: this.yl });
    }
    // End of regulation or an overtime period.
    if (this.score[0] !== this.score[1] || (!this.playoff && this.ot)) { this.finish(); return null; }
    this.ot = true; this.q = 5 + (this.q >= 5 ? this.q - 4 : 0); this.clock = this.playoff ? 900 : 600;
    for (const s of this.sides) s.timeouts = 2;
    this.poss = this.rng.chance(0.5) ? 0 : 1; this.pending = 'kickoff'; this.otPossessions = 0; this.firstOtPoss = null;
    this.lastClockRunning = false;
    return this.push({ type: 'end', text: 'End of regulation. Overtime!', yards: 0, endYl: this.yl });
  }
  private finish() {
    this.over = true;
    this.push({ type: 'end', text: `Final: ${this.sides[0].team.nick} ${this.score[0]}, ${this.sides[1].team.nick} ${this.score[1]}${this.ot ? ' (OT)' : ''}.`, yards: 0, endYl: this.yl });
    this.finalizeWear();
  }

  /** Situation at the snap, so events describe the play as it started. */
  private at: { q: number; clock: number; poss: 0 | 1; down: number; togo: number; yl: number } | null = null;
  private note = '';
  private push(e: Omit<PlayEvent, 'n' | 'q' | 'clock' | 'poss' | 'down' | 'togo' | 'yl'> & Partial<PlayEvent>): PlayEvent {
    const at = this.at ?? { q: this.q, clock: this.clock, poss: this.poss, down: this.down, togo: this.togo, yl: this.yl };
    this.at = null;
    const ev: PlayEvent = { n: this.n++, ...at, ...e, score: [this.score[0], this.score[1]] };
    if (this.note) { ev.text += ` ${this.note}`; this.note = ''; }
    ev.wp = this.winProb();
    this.events.push(ev);
    return ev;
  }

  // ---- stats helpers ---------------------------------------------------------------
  private L(p: Player | undefined): StatLine {
    if (!p) return emptyLine();
    let l = this.lines.get(p.id);
    if (!l) { l = emptyLine(); l.gp = 1; this.lines.set(p.id, l); }
    return l;
  }
  private snap(players: (Player | undefined)[], side: Side) {
    for (const p of players) {
      if (!p) continue;
      this.snaps.set(p.id, (this.snaps.get(p.id) ?? 0) + 1);
      side.fatigue.set(p.id, Math.min(1, (side.fatigue.get(p.id) ?? 0) + (side.abbr === this.league.user && coachHas(this.league, 'Fresh Legs') ? 0.0245 : 0.035)));
    }
    // Players on the sideline recover.
    for (const [id, f] of side.fatigue) if (!players.some(p => p?.id === id)) side.fatigue.set(id, Math.max(0, f - 0.05));
  }
  private hit(p: Player | undefined, k = 1) { if (p) this.hits.set(p.id, (this.hits.get(p.id) ?? 0) + k); }

  private zonePoint(side: Side, p: Player | undefined, pts = 1) {
    if (!p || !p.xf) return;
    const v = (side.zone.get(p.id) ?? 0) + pts;
    side.zone.set(p.id, v);
    if (v >= 3 && !side.zoneOn.has(p.id)) {
      side.zoneOn.add(p.id);
      this.push({ type: 'timeout', text: `${p.fn} ${p.ln} is IN THE ZONE: ${p.xf}!`, yards: 0, endYl: this.yl, big: true });
    }
  }
  private knockout(side: Side, p: Player | undefined) {
    if (!p) return;
    side.zone.set(p.id, 0);
    if (side.zoneOn.delete(p.id)) this.push({ type: 'timeout', text: `${p.ln} has been knocked out of the zone.`, yards: 0, endYl: this.yl });
  }

  /** Injury frequency setting: Low / Normal / Realistic (NFL rates). */
  private get injuryMult() { return { Low: 0.45, Normal: 0.85, Realistic: 1.7 }[this.league.injuryLevel ?? 'Normal']; }
  /** A small extra risk for whoever takes the contact on this play. */
  private maybeInjure(side: Side, p: Player | undefined, risk = 1) {
    if (!p || side.out.has(p.id)) return;
    const base = 0.0045 * risk * this.injuryMult * (1 + (70 - p.attrs.INJ) / 55) * (1 + (100 - p.cond) / 110) * (1 + p.traits.prone / 200);
    if (this.rng.chance(base)) this.injure(side, p);
  }
  /**
   * The main source: any of the 22 starters can go down on a contact snap, not just
   * the ball carrier, so stars are not singled out. Injury-prone and worn-down players
   * are likelier victims.
   */
  private snapInjury() {
    if (!this.rng.chance(0.03 * this.injuryMult)) return;
    const side = this.rng.pick(this.sides);
    const slots: [Pos, number][] = [['QB', 1], ['RB', 1], ['WR', 3], ['TE', 1], ['OT', 2], ['G', 2], ['C', 1], ['EDGE', 2], ['DT', 2], ['LB', 2], ['CB', 3], ['S', 2]];
    const pool = slots.flatMap(([pos, n]) => this.avail(side, pos, n));
    if (!pool.length) return;
    const p = this.rng.weighted(pool.map(q => [q, (1 + (70 - q.attrs.INJ) / 55) * (1 + (100 - q.cond) / 110) * (1 + q.traits.prone / 200)] as const));
    this.injure(side, p);
  }
  private injure(side: Side, p: Player) {
    if (side.out.has(p.id)) return;
    if (side.abbr === this.league.user && coachHas(this.league, 'Iron Program') && this.rng.chance(0.25)) return;
    const shield = this.staffOf(side).inj + this.staffOf(side).med;
    if (shield > 0 && this.rng.chance(shield)) return;
    // Most knocks are minor: shaken up, or out for the game. Multi-week and
    // season-ending injuries are the exception.
    const weeks = this.rng.weighted([[-1, 0.4], [0, 0.18], [1, 0.17], [2, 0.1], [3, 0.05], [4, 0.04], [6, 0.03], [9, 0.015], [99, 0.015]] as const);
    if (weeks < 0) {
      // Shaken up: misses a few snaps, back after the trainers take a look.
      this.push({ type: 'timeout', text: `${p.pos} ${p.fn} ${p.ln} is shaken up and heads to the sideline to be evaluated.`, yards: 0, endYl: this.yl, ids: { ball: p.id } });
      return;
    }
    const type = weeks >= 99 ? this.rng.pick(['Torn ACL', 'Torn Achilles', 'Broken Leg', 'Torn Pectoral']) : weeks >= 6 ? this.rng.pick(['High Ankle Sprain', 'Broken Hand', 'MCL Sprain', 'Fractured Rib']) : weeks >= 2 ? this.rng.pick(['Hamstring', 'Ankle Sprain', 'Knee Sprain', 'Shoulder', 'Concussion']) : this.rng.pick(['Cramps', 'Ankle', 'Shoulder Stinger', 'Hip Pointer', 'Knee']);
    side.out.add(p.id);
    if (weeks > 0) this.injuries.push({ pid: p.id, weeks: weeks >= 99 ? 30 : weeks, type, season: weeks >= 99 });
    this.push({ type: 'timeout', text: `Injury: ${p.pos} ${p.fn} ${p.ln} (${type}) ${weeks === 0 ? 'is out for the game' : weeks >= 99 ? 'is feared to be lost for the season' : 'will not return'}.`, yards: 0, endYl: this.yl, ids: { ball: p.id } });
  }

  // ---- plays ---------------------------------------------------------------------
  private scrimmage(oc: OffCall, dc: DefCall): PlayEvent {
    const startYl = this.yl, startDown = this.down, startTogo = this.togo;
    const off = this.sides[this.poss], defS = this.sides[1 - this.poss];
    const o = this.offense();
    const nickel = dc.box <= 6 || oc.kind === 'pass';
    const d = this.defense(nickel);
    const onField = [o.qb, o.rb, ...o.wrs.slice(0, 3), o.tes[0], ...o.ol];
    this.snap(onField, off);
    this.snap([...d.dl, ...d.lbs, ...d.cbs, ...d.ss], defS);
    this.box[this.poss].plays++;
    // Pre-snap penalties (crowd noise makes the road offence jump more).
    const preSnap = 0.051 + (this.poss === 0 && !this.game.neutral ? 0.006 : 0) - ((o.ol.reduce((a, p) => a + p.attrs.AWR, 0) / Math.max(1, o.ol.length)) - 80) * 0.0004;
    if (this.rng.chance(preSnap)) {
      const offFoul = this.rng.chance(0.55);
      const culprit = offFoul ? this.rng.pick(o.ol) : this.rng.pick(d.dl);
      if (!((offFoul ? off : defS).abbr === this.league.user && coachHas(this.league, 'Disciplinarian') && this.rng.chance(0.4))) return this.penalty(offFoul, 5, offFoul ? 'False start' : (this.rng.chance(0.5) ? 'Offside' : 'Neutral zone infraction'), culprit, false, true);
    }
    let ev: PlayEvent;
    if (oc.kind === 'pass') ev = this.passPlay(oc, dc, o, d);
    else ev = this.runPlay(oc, dc, o, d);
    ev.call = oc.name; ev.dcall = dc.name;
    if (startDown === 3 && !ev.turnover) { this.box[ev.poss].third[1]++; if (ev.yards >= startTogo || ev.td) this.box[ev.poss].third[0]++; }
    void startYl;
    return ev;
  }

  /** Advance the chains after a play gains `yards`. Returns true on a touchdown. */
  private advance(yards: number): { td: boolean; first: boolean; safety: boolean } {
    this.yl += yards;
    if (this.yl >= 100) return { td: true, first: false, safety: false };
    if (this.yl <= 0) return { td: false, first: false, safety: true };
    if (yards >= this.togo) {
      this.down = 1; this.togo = Math.min(10, 100 - this.yl);
      this.box[this.poss].fd++;
      return { td: false, first: true, safety: false };
    }
    this.togo -= yards;
    this.down++;
    if (this.down > 4) this.turnoverOnDowns();
    return { td: false, first: false, safety: false };
  }
  private turnoverOnDowns() {
    this.changePossession(100 - this.yl);
    this.note = 'Turnover on downs.';
    this.lastClockRunning = false;
  }
  private changePossession(newYl: number) {
    this.poss = (1 - this.poss) as 0 | 1;
    this.yl = clamp(newYl, 1, 99);
    this.down = 1; this.togo = Math.min(10, 100 - this.yl);
    this.hurry = [false, false];
    if (this.ot) this.otPossessions++;
  }
  private touchdown(side: 0 | 1, text: string) {
    this.score[side] += 6; this.addQ(side, 6);
    this.scoring.push({ q: this.q, clock: this.clock, team: this.sides[side].abbr, text });
    this.poss = side;
    this.pending = 'pat';
    this.lastClockRunning = false;
  }
  private addQ(side: 0 | 1, pts: number) { const i = Math.min(4, this.q - 1); this.qScores[side][i] = (this.qScores[side][i] ?? 0) + pts; }
  private safety() {
    const defSide = (1 - this.poss) as 0 | 1;
    this.score[defSide] += 2; this.addQ(defSide, 2);
    this.scoring.push({ q: this.q, clock: this.clock, team: this.sides[defSide].abbr, text: 'Safety' });
    // Free kick from the 20 by the team that conceded.
    this.pending = 'kickoff';
    this.lastClockRunning = false;
    this.freeKick = true;
  }
  private freeKick = false;

  /** Overtime: sudden death once both have possessed (regular season and playoffs, 2025 rules). */
  private checkOtEnd() {
    if (!this.ot) return;
    const lead = this.score[0] !== this.score[1];
    if (lead && this.otPossessions >= 2) this.finish();
  }

  private passPlay(oc: OffCall, dc: DefCall, o: ReturnType<GameSim['offense']>, d: ReturnType<GameSim['defense']>): PlayEvent {
    const off = o.s, def = d.s;
    const qb = o.qb;
    const depth = oc.depth ?? 'short';
    this.L(qb);
    // --- protection vs rush ---
    const rushers = [...d.dl];
    let blitzer: Player | undefined;
    if (dc.blitz) { blitzer = this.rng.pick([...d.lbs, ...d.ss.slice(0, 1)].filter(Boolean)); if (blitzer) rushers.push(blitzer); if (dc.shell === 'Cover 0' && d.lbs[1]) rushers.push(d.lbs[1]); }
    const rushV = rushers.reduce((a, p) => a + Math.max(this.r(def, p, 'FMV'), this.r(def, p, 'PMV')) * 0.62 + this.r(def, p, 'ACC') * 0.2 + this.r(def, p, 'STR') * 0.18, 0) / Math.max(1, rushers.length);
    const blockers = [...o.ol];
    const chip = dc.blitz && o.rb ? o.rb : undefined;
    const blockV = blockers.reduce((a, p) => a + this.r(off, p, 'PBK') * 0.7 + this.r(off, p, 'STR') * 0.15 + this.r(off, p, 'AWR') * 0.15, 0) / Math.max(1, blockers.length) + (chip ? 1.5 : 0);
    const extra = rushers.length - 4 - (chip ? 1 : 0);
    let tPressure = 2.88 + (blockV - rushV) * 0.021 - extra * 0.38 + this.rng.normal(0, 0.7);
    if (rushers.some(p => this.has(p, 'Edge Threat') || this.has(p, 'Inside Pressure'))) tPressure -= 0.15;
    if (rushers.some(p => def.zoneOn.has(p.id))) tPressure -= 0.6;
    if (blockers.some(p => this.has(p, 'Anchor'))) tPressure += 0.1;
    if (oc.pa) tPressure -= 0.2;
    tPressure = clamp(tPressure, 0.9, 7);
    const throwT = { screen: 1.3, quick: 1.85, short: 2.35, medium: 2.8, deep: 3.25 }[depth] + (oc.pa ? 0.35 : 0) + (100 - this.r(off, qb, 'AWR')) * 0.006;
    // --- routes vs coverage ---
    const man = dc.shell === 'Cover 0' || dc.shell === 'Cover 1';
    const targets: { p: Player; def?: Player; bias: number; slot: string }[] = [];
    const wr = o.wrs;
    if (wr[0]) targets.push({ p: wr[0], def: d.cbs[0], bias: 0.24, slot: 'X' });
    if (wr[1]) targets.push({ p: wr[1], def: d.cbs[1], bias: 0.2, slot: 'Z' });
    if (wr[2]) targets.push({ p: wr[2], def: d.cbs[2] ?? d.ss[1] ?? d.lbs[1], bias: 0.16, slot: 'SLOT' });
    if (o.tes[0]) targets.push({ p: o.tes[0], def: man ? (d.ss[1] ?? d.lbs[0]) : (d.lbs[0] ?? d.ss[0]), bias: 0.14, slot: 'TE' });
    if (o.rb && !chip) targets.push({ p: o.rb, def: d.lbs[1] ?? d.lbs[0], bias: depth === 'screen' ? 0.9 : -0.35, slot: 'RB' });
    const planDef = def.team.plan.def;
    // Less room to work with near the goal line.
    const sepBase = { screen: 1.4, quick: 0.8, short: 0.35, medium: 0, deep: -0.35 }[depth] - (this.yl >= 80 ? 0.55 + (this.yl - 80) * 0.03 : 0);
    const sep = targets.map(t => {
      const recv = (this.r(off, t.p, 'RTE') * 0.45 + this.r(off, t.p, depth === 'deep' ? 'SPD' : 'ACC') * 0.3 + this.r(off, t.p, 'RLS') * 0.25);
      const cov = !t.def ? 55 : man
        ? this.r(def, t.def, 'MCV') * 0.55 + this.r(def, t.def, 'SPD') * 0.3 + this.r(def, t.def, 'PRS') * 0.15
        : this.r(def, t.def, 'ZCV') * 0.6 + this.r(def, t.def, 'PRC') * 0.25 + this.r(def, t.def, 'SPD') * 0.15;
      let s = sepBase + (recv - cov) / 19 + this.rng.normal(0, 1.0);
      // Stars draw a safety over the top.
      if (t.p.ovr >= 88 && (dc.shell === 'Cover 2' || dc.shell === 'Cover 4' || dc.shell === 'Prevent' || this.rng.chance(0.25))) s -= 0.55;
      if (!man && (depth === 'quick' || depth === 'short')) s += 0.45;
      if (!man && depth === 'deep' && (dc.shell === 'Cover 2' || dc.shell === 'Cover 4' || dc.shell === 'Prevent')) s -= 0.7;
      if (dc.shell === 'Prevent' && depth !== 'deep') s += 0.7;
      if (man && dc.shell === 'Cover 0' && depth === 'deep') s += 0.4;
      if (dc.blitz) s += 0.35;
      if (oc.pa) s += 0.45;
      if (planDef === 'Stop the Run') s += 0.25; else if (planDef === 'Stop the Pass') s -= 0.25;
      if (this.has(t.p, 'Route Technician')) s += 0.35;
      if (depth === 'deep' && this.has(t.p, 'Deep Threat')) s += 0.45;
      if (t.def && this.has(t.def, 'Shutdown') && man) s -= 0.4;
      if (t.def && this.has(t.def, 'Zone Hawk') && !man) s -= 0.3;
      if (off.zoneOn.has(t.p.id)) s += 0.9;
      if (t.def && def.zoneOn.has(t.def.id)) s -= 1.2;
      return s;
    });
    // --- pressure? ---
    let pressured = tPressure < throwT;
    let hurried = false;
    if (pressured) {
      const escape = 0.34 + (this.r(off, qb, 'AGI') + this.r(off, qb, 'SPD') - 150) / 230 + (this.has(qb, 'Escape Artist') ? 0.14 : 0) + (this.has(qb, 'Pocket Presence') ? 0.08 : 0);
      if (!this.rng.chance(clamp(escape, 0.05, 0.75))) {
        const sackChance = clamp(0.31 - (this.r(off, qb, 'AWR') - 72) * 0.005 + (this.has(qb, 'Pocket Presence') ? -0.06 : 0), 0.12, 0.55);
        if (this.rng.chance(sackChance)) return this.sack(o, d, rushers, blockers);
        hurried = true;
      } else if (qb && this.r(off, qb, 'SPD') >= 74 && this.rng.chance(0.28 + (this.r(off, qb, 'SPD') - 74) * 0.02)) {
        return this.scramble(o, d);
      } else hurried = true;
      if (hurried && this.rng.chance(0.18 - (this.r(off, qb, 'AWR') - 70) * 0.003)) return this.throwaway(o);
      for (const p of rushers) if (this.rng.chance(0.35)) { this.L(p).qbh++; this.zonePoint(def, p, 0.5); break; }
    }
    // --- read the field: a progression, not a lock-on ---
    // Each receiver's chance grows with how open he looks (blurred by the QB's
    // awareness) and his place in the read; the ball still spreads around.
    const noise = (100 - this.r(off, qb, 'AWR')) / 45;
    const util = targets.map((t, i) => Math.exp(0.95 * ((sep[i] + this.rng.normal(0, noise)) * 0.47 + t.bias + (hurried && t.slot === 'RB' ? 0.6 : 0) + (oc.primary === t.slot ? 0.9 : 0) - Math.max(0, (this.lines.get(t.p.id)?.tgt ?? 0) - 7) * 0.08)));
    let pick = 0;
    { let r = this.rng.next() * util.reduce((a, b) => a + b, 0); for (let i = 0; i < util.length; i++) { r -= util[i]; if (r <= 0) { pick = i; break; } } }
    const tgt = targets[pick];
    if (!tgt) return this.throwaway(o);
    const s = sep[pick];
    const recv = tgt.p, cov = tgt.def;
    this.L(recv).tgt++;
    // --- accuracy and catch ---
    const accAttr = depth === 'screen' || depth === 'quick' ? this.r(off, qb, 'SAC')
      : depth === 'short' ? this.r(off, qb, 'SAC') * 0.55 + this.r(off, qb, 'MAC') * 0.45
      : depth === 'medium' ? this.r(off, qb, 'MAC')
      : this.r(off, qb, 'DAC') * 0.7 + this.r(off, qb, 'THP') * 0.3 + (this.has(qb, 'Bazooka') ? 3 : 0);
    let acc = accAttr;
    if (hurried) acc = acc * 0.55 + this.r(off, qb, 'TUP') * 0.45 - (this.has(qb, 'Fearless') || off.zoneOn.has(qb?.id ?? '') ? 1 : 7);
    if (off.zoneOn.has(qb?.id ?? '')) acc += 6;
    const wx = (this.weather.wind > 15 ? (depth === 'deep' ? 0.5 : 0.2) : 0) + (this.weather.precip === 'rain' ? 0.15 : this.weather.precip === 'snow' ? 0.25 : 0);
    const base = { screen: 1.75, quick: 1.15, short: 0.74, medium: 0.08, deep: -0.88 }[depth];
    const catchV = this.r(off, recv, 'CTH') * 0.6 + this.r(off, recv, s < 0 ? 'CIT' : 'CTH') * 0.4;
    let logit = base + 0.12 + 0.5 * s + (acc - 72) * 0.028 + (catchV - 72) * 0.012 - wx;
    if (s < 0 && this.has(recv, 'Contested Catch')) logit += 0.35;
    if (this.has(qb, 'Gunslinger') && s < 0.3) logit += 0.2;
    let air = this.airYards(depth);
    if (this.yl + air > 100) air = 100 - this.yl + (this.rng.chance(0.7) ? -this.rng.int(0, 3) : 0);
    air = Math.max(depth === 'screen' ? -3 : 1, air);
    const complete = this.rng.chance(SIG(logit));
    const l = this.L(qb);
    l.pa++;
    this.box[this.poss].plays += 0;
    const dir = this.rng.pick([-1, 0, 1] as const);
    if (!complete) {
      // Interception? Tight windows, poor decisions and pressure invite them.
      let pInt = (this.secureNow() ? 0.75 : 1) * 0.068 + Math.max(0, -s) * 0.045 + (depth === 'deep' ? 0.03 : depth === 'medium' ? 0.015 : 0) + (hurried ? 0.03 : 0) - (this.r(off, qb, 'AWR') - 72) * 0.0018;
      if (cov && (this.has(cov, 'Ball Hawk') || this.has(cov, 'Lurker'))) pInt += 0.03;
      if (cov && def.zoneOn.has(cov.id)) pInt += 0.05;
      if (dc.shell === 'Prevent' && depth === 'deep') pInt += 0.03;
      const intercepted = this.rng.chance(clamp(pInt * (cov ? 0.7 + this.r(def, cov, 'CTH') / 250 : 0.8), 0.01, 0.35));
      // Defensive pass interference on downfield throws.
      if (!intercepted && (depth === 'deep' || depth === 'medium') && this.rng.chance(depth === 'deep' ? 0.08 : 0.03) && cov) {
        const spot = Math.max(1, Math.min(air, 99 - this.yl));
        this.L(recv).tgt += 0;
        return this.penalty(false, spot, 'Defensive pass interference', cov, true, false, true);
      }
      if (intercepted) {
        const picker = cov ?? this.rng.pick(d.ss);
        l.pint++; this.L(picker).dint++; this.L(picker).pd++;
        this.box[this.poss].to++;
        this.knockout(off, qb);
        this.zonePoint(def, picker, 2);
        const ret = Math.round(Math.max(0, this.rng.normal(9, 10) + (this.r(def, picker, 'SPD') - 85) * 0.3));
        const spotYl = this.yl + air;
        const newYl = 100 - clamp(spotYl, 1, 99) + ret;
        const name = `${picker?.fn[0]}.${picker?.ln}`;
        this.lastClockRunning = false;
        if (newYl >= 100 || (this.rng.chance(0.06) && ret > 15)) {
          this.changePossession(99);
          this.L(picker).dtd++;
          this.touchdown(this.poss, `${name} ${100 - clamp(spotYl, 1, 99)}-yd interception return`);
          return this.push({ type: 'pass', text: `${qbN(qb)} pass ${depthWord(depth, dir)} intended for ${pn(recv)} is INTERCEPTED by ${pn(picker)} and returned for a TOUCHDOWN!`, yards: 0, endYl: 100, ids: { qb: qb?.id, target: recv.id, def: picker?.id }, air, turnover: true, td: true, big: true, dir });
        }
        this.changePossession(newYl);
        return this.push({ type: 'pass', text: `${qbN(qb)} pass ${depthWord(depth, dir)} intended for ${pn(recv)} is INTERCEPTED by ${pn(picker)}${ret > 0 ? `, returned ${ret} yards` : ''}.`, yards: 0, endYl: this.yl, ids: { qb: qb?.id, target: recv.id, def: picker?.id }, air, turnover: true, big: true, dir });
      }
      const dropped = s > 0.4 && this.rng.chance(0.075 - (this.r(off, recv, 'CTH') - 70) * 0.0018 - (this.has(recv, 'Sure Hands') ? 0.04 : 0));
      if (dropped) this.L(recv).drop++;
      const defended = !dropped && cov && s < 0.2 && this.rng.chance(0.42);
      if (defended && cov) { this.L(cov).pd++; this.zonePoint(def, cov, 1); }
      this.lastClockRunning = false;
      this.runoff(5);
      this.advance(0);
      return this.push({ type: 'pass', text: `${qbN(qb)} pass ${depthWord(depth, dir)} to ${pn(recv)} ${dropped ? 'is DROPPED' : defended ? `is broken up by ${pn(cov)}` : hurried ? 'is off target under pressure' : 'falls incomplete'}.`, yards: 0, endYl: this.yl, ids: { qb: qb?.id, target: recv.id, def: defended ? cov?.id : undefined }, air, complete: false, dir });
    }
    // Completion: yards after catch.
    const yacMean = { screen: 5.2, quick: 3.6, short: 3.1, medium: 2.6, deep: 3.0 }[depth];
    const elus = (this.r(off, recv, 'ELU') + this.r(off, recv, 'BTK') + this.r(off, recv, 'SPD')) / 3;
    const tack = cov ? (this.r(def, cov, 'TAK') + this.r(def, cov, 'PUR')) / 2 : 70;
    let yac = this.rng.next() < 0.18 ? 0 : -Math.log(1 - this.rng.next()) * yacMean * clamp(1 + (elus - tack) / 55, 0.5, 1.8);
    if (this.has(recv, 'YAC Monster')) yac *= 1.2;
    if (this.rng.chance(0.03 + Math.max(0, this.r(off, recv, 'SPD') - 88) * 0.004 + (s > 1.5 ? 0.04 : 0))) yac += -Math.log(1 - this.rng.next()) * 18;
    let gain = Math.round(air + yac);
    if (this.yl + gain > 100) gain = 100 - this.yl;
    // Offensive holding wipes out a gain sometimes.
    if (gain > 4 && this.rng.chance(0.03)) return this.penalty(true, 10, 'Offensive holding', this.rng.pick(o.ol), false);
    if (this.rng.chance(0.009 * (1 + this.heat / 80))) return this.penalty(false, 15, this.rng.pick(['Roughing the passer', 'Unnecessary roughness', 'Face mask']), this.rng.pick(d.dl), true);
    if (this.rng.chance(0.034) && !hurried) return this.penalty(false, 5, this.rng.pick(['Defensive holding', 'Illegal contact']), cov ?? d.cbs[0], true);
    l.pc++; l.py += gain; l.plng = Math.max(l.plng, gain);
    const rl = this.L(recv); rl.rec++; rl.recy += gain; rl.reclng = Math.max(rl.reclng, gain);
    this.box[this.poss].pyds += gain; this.box[this.poss].yds += gain;
    if (gain >= 15) { this.zonePoint(off, qb, 1); this.zonePoint(off, recv, 1); }
    const tackler = gain >= 100 - this.yl ? undefined : (cov && this.rng.chance(0.62) ? cov : this.rng.pick([...d.ss, ...d.lbs, ...d.cbs].filter(Boolean)));
    if (tackler) { this.L(tackler).tkl++; this.hit(recv); }
    this.maybeInjure(off, recv, 1); this.maybeInjure(def, tackler, 0.6); this.snapInjury();
    // Fumble after the catch.
    const fum = this.rng.chance(0.009 - (this.r(off, recv, 'CAR') - 76) * 0.00008 + (tackler && this.has(tackler, 'Strip Specialist') ? 0.006 : 0));
    const res = fum ? { td: false, first: false, safety: false } : this.advance(gain);
    const oob = !res.td && this.rng.chance(this.twoMinute() ? 0.42 : 0.2);
    this.lastClockRunning = !oob || !(this.twoMinute() || (this.q >= 4 && this.clock <= 300));
    this.runoff(oob ? 4 : 6);
    if (fum) return this.fumble(recv, tackler, gain, o, d, 'pass', { qb: qb?.id, target: recv.id }, air);
    if (res.td) {
      l.ptd++; rl.rectd++;
      this.zonePoint(off, qb, 1); this.zonePoint(off, recv, 1);
      if (cov) this.knockout(def, cov);
      this.touchdown(this.poss, `${pn(recv)} ${gain}-yd pass from ${pn(qb)}`);
      return this.push({ type: 'pass', text: `${qbN(qb)} pass ${depthWord(depth, dir)} to ${pn(recv)} for ${gain} yard${gain === 1 ? '' : 's'}, TOUCHDOWN!`, yards: gain, endYl: 100, ids: { qb: qb?.id, target: recv.id }, air, complete: true, td: true, big: true, dir });
    }
    return this.push({ type: 'pass', text: `${qbN(qb)} pass ${depthWord(depth, dir)} to ${pn(recv)} for ${gain} yard${gain === 1 ? '' : 's'}${tackler ? ` (${pn(tackler)})` : ''}${oob ? ', out of bounds' : ''}.${res.first ? ' First down.' : ''}`, yards: gain, endYl: this.yl, ids: { qb: qb?.id, target: recv.id, def: tackler?.id }, air, complete: true, big: gain >= 20, dir });
  }

  private airYards(depth: PassDepth): number {
    switch (depth) {
      case 'screen': return this.rng.int(-3, 1);
      case 'quick': return this.rng.int(1, 6);
      case 'short': return this.rng.int(5, 11);
      case 'medium': return this.rng.int(11, 19);
      default: return Math.round(18 + -Math.log(1 - this.rng.next()) * 8);
    }
  }

  private sack(o: ReturnType<GameSim['offense']>, d: ReturnType<GameSim['defense']>, rushers: Player[], blockers: Player[]): PlayEvent {
    const off = o.s, def = d.s;
    const w = rushers.map(p => [p, 60 + Math.max(p.attrs.FMV, p.attrs.PMV) * 0.6 + (def.zoneOn.has(p.id) ? 15 : 0)] as const);
    const sacker = this.rng.weighted(w.map(([p, v]) => [p, Math.pow(v / 70, 2)] as const));
    const loss = clamp(Math.round(this.rng.normal(7, 2.5)), 1, 15);
    const l = this.L(o.qb); l.sk++; l.sky += loss;
    const sl = this.L(sacker); sl.dsk++; sl.tkl++; sl.qbh++;
    const beat = blockers.length ? blockers.reduce((a, b) => (a.attrs.PBK < b.attrs.PBK ? a : b)) : undefined;
    if (beat) this.L(beat).sacka++;
    this.box[1 - this.poss].sacks++;
    this.box[this.poss].yds -= loss; this.box[this.poss].pyds -= loss;
    this.zonePoint(def, sacker, 1.5); this.knockout(off, o.qb);
    this.hit(o.qb, 2); this.maybeInjure(off, o.qb, 1.4); this.snapInjury();
    const strip = this.rng.chance(0.1 + (this.has(sacker, 'Strip Specialist') ? 0.08 : 0));
    this.lastClockRunning = true;
    this.runoff(6);
    if (strip) return this.fumble(o.qb!, sacker, -loss, o, d, 'sack', { qb: o.qb?.id, def: sacker.id });
    const res = this.advance(-loss);
    if (res.safety) { this.safety(); return this.push({ type: 'sack', text: `${pn(o.qb)} is SACKED in the end zone by ${pn(sacker)}. SAFETY!`, yards: -loss, endYl: 0, ids: { qb: o.qb?.id, def: sacker.id }, big: true }); }
    return this.push({ type: 'sack', text: `${pn(o.qb)} is SACKED by ${pn(sacker)} for a loss of ${loss}.`, yards: -loss, endYl: this.yl, ids: { qb: o.qb?.id, def: sacker.id }, big: true });
  }
  private throwaway(o: ReturnType<GameSim['offense']>): PlayEvent {
    this.L(o.qb).pa++;
    this.lastClockRunning = false;
    this.runoff(5);
    this.advance(0);
    return this.push({ type: 'pass', text: `${pn(o.qb)} throws it away under pressure.`, yards: 0, endYl: this.yl, ids: { qb: o.qb?.id }, complete: false });
  }
  private scramble(o: ReturnType<GameSim['offense']>, d: ReturnType<GameSim['defense']>): PlayEvent {
    const off = o.s, qb = o.qb!;
    let y = Math.round(Math.max(-2, this.rng.normal(5.5, 4.5) + (this.r(off, qb, 'SPD') - 82) * 0.18));
    if (this.rng.chance(0.06)) y += Math.round(-Math.log(1 - this.rng.next()) * 14);
    if (this.yl + y > 100) y = 100 - this.yl;
    const l = this.L(qb); l.ra++; l.ry += y; l.rlng = Math.max(l.rlng, y);
    this.box[this.poss].ryds += y; this.box[this.poss].yds += y;
    const tackler = this.rng.pick([...d.lbs, ...d.ss, ...d.dl].filter(Boolean));
    if (tackler) this.L(tackler).tkl++;
    this.hit(qb); this.maybeInjure(off, qb, 0.8);
    const slide = this.rng.chance(0.4);
    const res = this.advance(y);
    const oob = !res.td && this.rng.chance(0.3);
    this.lastClockRunning = !oob;
    this.runoff(6);
    if (res.td) { l.rtd++; this.touchdown(this.poss, `${pn(qb)} ${y}-yd run`); return this.push({ type: 'scramble', text: `${pn(qb)} escapes the pocket and scrambles ${y} yard${y === 1 ? '' : 's'} for a TOUCHDOWN!`, yards: y, endYl: 100, ids: { qb: qb.id, ball: qb.id }, td: true, big: true }); }
    return this.push({ type: 'scramble', text: `${pn(qb)} scrambles for ${y} yards${slide && y > 0 ? ' and slides' : ''}.${res.first ? ' First down.' : ''}`, yards: y, endYl: this.yl, ids: { qb: qb.id, ball: qb.id }, big: y >= 15 });
  }

  private runPlay(oc: OffCall, dc: DefCall, o: ReturnType<GameSim['offense']>, d: ReturnType<GameSim['defense']>): PlayEvent {
    const off = o.s, def = d.s;
    const carrier = oc.run === 'qb' ? o.qb : o.rb ?? o.qb;
    if (!carrier) return this.throwaway(o);
    const lead = [...o.ol, ...(o.tes[0] ? [o.tes[0]] : [])];
    const blockV = lead.reduce((a, p) => a + this.r(off, p, 'RBK') * 0.68 + this.r(off, p, 'STR') * 0.2 + this.r(off, p, 'IBL') * 0.12, 0) / Math.max(1, lead.length)
      + (lead.some(p => this.has(p, 'Road Grader')) ? 1.2 : 0);
    const front = [...d.dl, ...d.lbs.slice(0, Math.max(1, dc.box - 4))];
    const runD = front.reduce((a, p) => a + this.r(def, p, 'BSH') * 0.5 + this.r(def, p, 'STR') * 0.22 + this.r(def, p, 'TAK') * 0.14 + this.r(def, p, 'PRC') * 0.14, 0) / Math.max(1, front.length)
      + (front.some(p => this.has(p, 'Run Stuffer')) ? 1.2 : 0);
    const adv = (blockV - runD) / 13 - (dc.box - 7) * 0.55 - (this.yl >= 85 ? 0.9 : 0) + (def.team.plan.def === 'Stop the Pass' ? 0.3 : def.team.plan.def === 'Stop the Run' ? -0.3 : 0);
    const outside = oc.run === 'outside';
    const vision = (this.r(off, carrier, 'BCV') - 82) / 40;
    let line = outside ? this.rng.normal(2.3 + adv * 0.5 + (this.r(off, carrier, 'SPD') - 88) / 32, 3.1) : this.rng.normal(2.7 + adv * 0.7, 2.3);
    if (oc.run === 'qb') line += (this.r(off, carrier, 'SPD') - 80) / 12;
    line += vision * 0.4;
    let y: number;
    if (line < 0) {
      // Hit in the backfield; elusive backs sometimes turn nothing into something.
      y = Math.round(Math.max(-5, line));
      if (this.rng.chance((this.r(off, carrier, 'ELU') - 60) / 220)) y = this.rng.int(0, 3);
    } else {
      const power = (this.r(off, carrier, 'BTK') + this.r(off, carrier, 'TRK')) / 2;
      const tackle = front.reduce((a, p) => a + this.r(def, p, 'TAK'), 0) / Math.max(1, front.length);
      let after = -Math.log(1 - this.rng.next()) * 1.75 * clamp(1 + (power - tackle) / 140, 0.75, 1.25);
      if (this.has(carrier, 'Bruiser') || off.zoneOn.has(carrier.id)) after *= 1.3;
      y = Math.round(line + after);
      const breakaway = 0.037 + (this.r(off, carrier, 'SPD') - 88) * 0.0005 + vision * 0.005 + (this.has(carrier, 'Breakaway') ? 0.01 : 0) + (outside ? 0.01 : 0);
      if (this.rng.chance(clamp(breakaway, 0.005, 0.1))) y += Math.round(10 + -Math.log(1 - this.rng.next()) * 16);
    }
    if (this.yl + y > 100) y = 100 - this.yl;
    // Holding on a run that gained something.
    if (y > 3 && this.rng.chance(0.034)) return this.penalty(true, 10, 'Offensive holding', this.rng.pick(o.ol), false);
    if (this.rng.chance(0.006 * (1 + this.heat / 80))) return this.penalty(false, 15, this.rng.pick(['Unnecessary roughness', 'Face mask']), this.rng.pick(front), true);
    const l = this.L(carrier); l.ra++; l.ry += y; l.rlng = Math.max(l.rlng, y);
    this.box[this.poss].ryds += y; this.box[this.poss].yds += y;
    const tacklers = front.concat(d.ss, d.cbs).filter(Boolean);
    const tackler = this.rng.weighted(tacklers.map(p => [p, (p.pos === 'LB' ? 3 : p.pos === 'S' ? 1.6 : p.pos === 'CB' ? (y > 8 ? 2 : 0.8) : 1.4) * (p.attrs.PUR / 70)] as const));
    if (this.yl + y < 100) { const tl = this.L(tackler); tl.tkl++; if (y < 0) { tl.tfl++; this.zonePoint(def, tackler, 1); } }
    if (y >= 12) { this.zonePoint(off, carrier, 1); for (const p of o.ol) if (this.rng.chance(0.3)) this.L(p).pancake++; }
    this.hit(carrier); this.maybeInjure(off, carrier, 1.1); this.maybeInjure(def, tackler, 0.5); this.snapInjury();
    const fumbleP = clamp((this.secureNow() ? 0.7 : 1) * 0.0135 - (this.r(off, carrier, 'CAR') - 76) * 0.00012 + (this.weather.precip !== 'none' ? 0.003 : 0) - (this.has(carrier, 'Ball Security') ? 0.003 : 0) + (this.has(tackler, 'Strip Specialist') ? 0.004 : 0), 0.0015, 0.02);
    const fum = y > -3 && this.rng.chance(fumbleP);
    const res = fum ? { td: false, first: false, safety: false } : this.advance(y);
    const oob = !res.td && outside && this.rng.chance(0.22);
    this.lastClockRunning = !oob || !(this.twoMinute() || (this.q >= 4 && this.clock <= 300));
    this.runoff(oob ? 4 : 5);
    const dir = outside ? this.rng.pick([-1, 1] as const) : 0;
    if (fum) return this.fumble(carrier, tackler, y, o, d, 'run', { ball: carrier.id });
    if (res.safety) { this.safety(); return this.push({ type: 'run', text: `${pn(carrier)} is tackled in the end zone. SAFETY!`, yards: y, endYl: 0, ids: { ball: carrier.id, def: tackler.id }, big: true, dir }); }
    if (res.td) {
      l.rtd++; this.zonePoint(off, carrier, 1);
      this.touchdown(this.poss, `${pn(carrier)} ${y}-yd run`);
      return this.push({ type: 'run', text: `${pn(carrier)} ${runWord(oc, dir)} for ${y} yard${y === 1 ? '' : 's'}, TOUCHDOWN!`, yards: y, endYl: 100, ids: { ball: carrier.id }, td: true, big: true, dir });
    }
    return this.push({ type: 'run', text: `${pn(carrier)} ${runWord(oc, dir)} for ${y === 0 ? 'no gain' : y < 0 ? `a loss of ${-y}` : `${y} yard${y === 1 ? '' : 's'}`} (${pn(tackler)})${oob ? ', out of bounds' : ''}.${res.first ? ' First down.' : ''}`, yards: y, endYl: this.yl, ids: { ball: carrier.id, def: tackler.id }, big: y >= 15, dir });
  }

  private fumble(carrier: Player, forcer: Player | undefined, gain: number, o: ReturnType<GameSim['offense']>, d: ReturnType<GameSim['defense']>, type: PlayEvent['type'], ids: PlayEvent['ids'], air?: number): PlayEvent {
    const off = o.s, def = d.s;
    const l = this.L(carrier); l.fum++;
    if (forcer) { this.L(forcer).ff++; this.zonePoint(def, forcer, 1.5); }
    this.knockout(off, carrier);
    const lost = this.rng.chance(0.52);
    this.yl = clamp(this.yl + gain, 1, 99);
    this.lastClockRunning = false;
    if (lost) {
      l.fuml++;
      this.box[this.poss].to++;
      const rec = this.rng.pick([...d.dl, ...d.lbs, ...d.ss].filter(Boolean));
      this.L(rec).fr++;
      const ret = this.rng.chance(0.08) ? 100 : Math.max(0, Math.round(this.rng.normal(2, 4)));
      if (ret >= 100 - (100 - this.yl)) {
        this.changePossession(99); this.L(rec).dtd++;
        this.touchdown(this.poss, `${pn(rec)} fumble return`);
        return this.push({ type, text: `${pn(carrier)} FUMBLES! ${pn(rec)} scoops it up and takes it all the way for a TOUCHDOWN!`, yards: gain, endYl: 100, ids, air, turnover: true, td: true, big: true });
      }
      this.changePossession(100 - this.yl + ret);
      return this.push({ type, text: `${pn(carrier)} FUMBLES${forcer ? ` (forced by ${pn(forcer)})` : ''}! Recovered by ${pn(rec)}.`, yards: gain, endYl: this.yl, ids, air, turnover: true, big: true });
    }
    const res = this.advance(0);
    void res;
    return this.push({ type, text: `${pn(carrier)} fumbles but the offence falls on it.`, yards: gain, endYl: this.yl, ids, air });
  }

  private penalty(onOffense: boolean, yards: number, name: string, who: Player | undefined, autoFirst: boolean, preSnap = false, spotFoul = false): PlayEvent {
    const side = onOffense ? this.poss : (1 - this.poss) as 0 | 1;
    this.box[side].pen++; this.box[side].peny += yards;
    this.lastClockRunning = preSnap ? this.lastClockRunning : false;
    if (onOffense) {
      const y = Math.min(yards, Math.floor(this.yl / 2) || 1);
      this.yl -= y; this.togo += y;
      if (!preSnap) this.runoff(5);
      return this.push({ type: 'penalty', text: `PENALTY: ${name}${who ? `, ${pn(who)}` : ''}. ${y} yards, replay ${ordinal(this.down)} down.`, yards: -y, endYl: this.yl });
    }
    const half = Math.floor((100 - this.yl) / 2) || 1;
    const y = spotFoul ? Math.min(yards, 99 - this.yl) : Math.min(yards, half);
    this.yl += y;
    if (autoFirst || y >= this.togo) { this.down = 1; this.togo = Math.min(10, 100 - this.yl); this.box[this.poss].fd++; }
    else this.togo -= y;
    if (!preSnap) this.runoff(5);
    return this.push({ type: 'penalty', text: `PENALTY: ${name}${who ? `, ${pn(who)}` : ''}. ${y} yards${autoFirst ? ', automatic first down' : ''}.`, yards: y, endYl: this.yl });
  }

  private kneel(): PlayEvent {
    const o = this.offense();
    this.L(o.qb).ra++; this.L(o.qb).ry -= 1;
    this.lastClockRunning = true;
    this.runoff(2);
    this.advance(-1);
    return this.push({ type: 'kneel', text: `${pn(o.qb)} takes a knee.`, yards: -1, endYl: this.yl, ids: { qb: o.qb?.id } });
  }
  private spike(): PlayEvent {
    const o = this.offense();
    this.L(o.qb).pa++;
    this.lastClockRunning = false;
    this.runoff(1);
    this.advance(0);
    return this.push({ type: 'spike', text: `${pn(o.qb)} spikes the ball to stop the clock.`, yards: 0, endYl: this.yl, ids: { qb: o.qb?.id } });
  }

  private kickoff(): PlayEvent {
    const kSide = this.sides[1 - this.poss];
    const recvSide = this.sides[this.poss];
    const k = this.kicker(kSide);
    this.pending = null;
    const free = this.freeKick; this.freeKick = false;
    this.lastClockRunning = false;
    // Onside when trailing late (2025 rules: declared, ~15% recovery).
    const kickDiff = this.score[1 - this.poss] - this.score[this.poss];
    if (!free && this.q >= 4 && this.clock < 300 && kickDiff < 0 && kickDiff >= -16 && this.rng.chance(0.85)) {
      const ok = this.rng.chance(0.14);
      this.runoff(3);
      if (ok) {
        this.poss = (1 - this.poss) as 0 | 1;
        this.yl = 50; this.down = 1; this.togo = 10;
        return this.push({ type: 'kickoff', text: `ONSIDE KICK... RECOVERED by the ${kSide.team.nick}!`, yards: 0, endYl: 50, big: true, ids: { kicker: k?.id } });
      }
      this.yl = 50; this.down = 1; this.togo = 10;
      return this.push({ type: 'kickoff', text: `Onside kick is recovered by the ${recvSide.team.nick}.`, yards: 0, endYl: 50, ids: { kicker: k?.id } });
    }
    const tbRate = free ? 0.05 : clamp(0.3 + ((k?.attrs.KPW ?? 75) - 80) * 0.01, 0.1, 0.5);
    if (this.rng.chance(tbRate)) {
      this.yl = 35; this.down = 1; this.togo = 10;
      return this.push({ type: 'kickoff', text: `${pn(k)} kicks off. Touchback, ball at the 35.`, yards: 0, endYl: 35, ids: { kicker: k?.id } });
    }
    const ret = this.returner(recvSide, 'kr');
    let start = Math.round(this.rng.normal(free ? 33 : 29, 6) + ((ret?.attrs.RET ?? 60) - 70) / 6);
    if (this.rng.chance(0.022)) start += this.rng.int(20, 45);
    const td = this.rng.chance(0.0035 + Math.max(0, (ret?.attrs.RET ?? 60) - 85) * 0.0006);
    const rl = this.L(ret); rl.kr++;
    this.runoff(6);
    if (td) {
      rl.kry += 100; rl.rettd++;
      this.touchdown(this.poss, `${pn(ret)} kickoff return`);
      return this.push({ type: 'kickoff', text: `${pn(ret)} takes the kickoff ALL THE WAY! TOUCHDOWN!`, yards: 100, endYl: 100, td: true, big: true, ids: { ball: ret?.id, kicker: k?.id } });
    }
    start = clamp(start, 5, 75);
    rl.kry += start;
    this.yl = start; this.down = 1; this.togo = 10;
    return this.push({ type: 'kickoff', text: `${pn(k)} kicks off. ${pn(ret)} returns it to the ${ylText(start)}.`, yards: start, endYl: start, ids: { ball: ret?.id, kicker: k?.id }, big: start >= 50 });
  }
  private returner(side: Side, kind: 'kr' | 'pr') {
    const pool = [...this.avail(side, 'WR', 5), ...this.avail(side, 'RB', 4), ...this.avail(side, 'CB', 5)];
    return pool.sort((a, b) => (b.attrs.RET + b.attrs.SPD * 0.3) - (a.attrs.RET + a.attrs.SPD * 0.3))[kind === 'kr' ? 0 : Math.min(1, pool.length - 1)];
  }

  private punt(): PlayEvent {
    const off = this.sides[this.poss], def = this.sides[1 - this.poss];
    const p = this.avail(off, 'P', 1)[0] ?? this.kicker(off);
    const pl = this.L(p); pl.pun++;
    this.lastClockRunning = false;
    this.runoff(7);
    if (this.rng.chance(0.006)) {
      this.changePossession(100 - this.yl);
      return this.push({ type: 'punt', text: `The punt is BLOCKED!`, yards: 0, endYl: this.yl, turnover: true, big: true, ids: { kicker: p?.id } });
    }
    let gross = Math.round(this.rng.normal(47 + ((p?.attrs.KPW ?? 70) - 78) * 0.28, 5.5) - (this.weather.wind > 15 ? 3 : 0));
    const land = this.yl + gross;
    pl.puny += gross;
    if (land >= 100) {
      // Touchback, or a coffin-corner kick downed short of the goal line.
      if (this.rng.chance(0.25 + ((p?.attrs.KAC ?? 70) - 75) * 0.01)) {
        const spot = 100 - this.rng.int(2, 9);
        pl.puny -= land - spot;
        this.changePossession(100 - spot);
        return this.push({ type: 'punt', text: `${pn(p)} punts, downed at the ${this.yl}.`, yards: spot - (land - gross), endYl: this.yl, ids: { kicker: p?.id } });
      }
      pl.puny -= land - 100;
      this.changePossession(20);
      return this.push({ type: 'punt', text: `${pn(p)} punts into the end zone. Touchback.`, yards: gross, endYl: 20, ids: { kicker: p?.id } });
    }
    const ret = this.returner(def, 'pr');
    let r = 0;
    if (!this.rng.chance(0.42)) {
      r = Math.max(0, Math.round(-Math.log(1 - this.rng.next()) * 8.5 * (1 + ((ret?.attrs.RET ?? 60) - 70) / 80)));
      if (this.rng.chance(0.004)) {
        const rl = this.L(ret); rl.pr++; rl.pry += 100 - land; rl.rettd++;
        this.changePossession(99);
        this.touchdown(this.poss, `${pn(ret)} punt return`);
        return this.push({ type: 'punt', text: `${pn(p)} punts... ${pn(ret)} RETURNS IT FOR A TOUCHDOWN!`, yards: gross, endYl: 100, td: true, big: true, ids: { kicker: p?.id, ball: ret?.id } });
      }
      const rl = this.L(ret); rl.pr++; rl.pry += r;
    }
    const newYl = clamp(100 - land + r, 1, 99);
    this.changePossession(newYl);
    return this.push({ type: 'punt', text: `${pn(p)} punts ${gross} yards${r ? `, ${pn(ret)} returns it ${r}` : ', fair catch'}.`, yards: gross, endYl: this.yl, ids: { kicker: p?.id, ball: ret?.id } });
  }

  private fgProb(dist: number, k: Player | undefined, side: Side) {
    const kpw = this.r(side, k, 'KPW'), kac = this.r(side, k, 'KAC');
    const reach = 1 + (kpw - 77) / 120;
    let x = 4.3 - Math.max(0, dist - 22) * 0.134 / reach + (kac - 77) * 0.035;
    if (this.weather.wind > 15) x -= 0.5;
    if (this.weather.precip === 'snow') x -= 0.4;
    const clutch = this.q >= 4 && this.clock < 120 && Math.abs(this.diff()) <= 3;
    if (clutch && !this.has(k, 'Ice Veins')) x -= 0.15;
    if (k && side.zoneOn.has(k.id)) x += 1.2;
    return SIG(x);
  }
  private fieldGoal(): PlayEvent {
    const side = this.sides[this.poss];
    const k = this.kicker(side);
    const dist = this.fgDistance();
    const l = this.L(k); l.fga++;
    this.lastClockRunning = false;
    this.runoff(5);
    const good = this.rng.chance(this.fgProb(dist, k, side) * 0.99);
    if (good) {
      l.fgm++; l.fglng = Math.max(l.fglng, dist);
      this.score[this.poss] += 3; this.addQ(this.poss, 3);
      this.scoring.push({ q: this.q, clock: this.clock, team: side.abbr, text: `${pn(k)} ${dist}-yd field goal` });
      if (dist >= 50) this.zonePoint(side, k, 1);
      const ev = this.push({ type: 'fg', text: `${pn(k)} ${dist}-yard field goal is GOOD.`, yards: 0, endYl: this.yl, ids: { kicker: k?.id }, big: dist >= 50 });
      this.poss = (1 - this.poss) as 0 | 1; this.pending = 'kickoff';
      if (this.ot) { this.otPossessions++; this.checkOtEnd(); }
      return ev;
    }
    this.knockout(side, k);
    const ev = this.push({ type: 'fg', text: `${pn(k)} ${dist}-yard field goal is NO GOOD${this.rng.chance(0.5) ? ', wide right' : ', wide left'}.`, yards: 0, endYl: this.yl, ids: { kicker: k?.id }, turnover: true });
    this.changePossession(Math.max(20, 100 - this.yl - 7));
    this.checkOtEnd();
    return ev;
  }

  private pat(): PlayEvent {
    const side = this.sides[this.poss];
    const k = this.kicker(side);
    this.pending = 'kickoff';
    const diff = this.diff();
    const late = this.q >= 4 && this.timeLeft() < 900;
    const chart = late && [-2, -5, -10, -13, -9, 1, 5, -16].includes(diff);
    const goForTwo = chart || (side.team.coach.aggr > 0.78 && this.rng.chance(0.08)) || (this.ot && this.playoff ? false : false);
    let ev: PlayEvent;
    if (goForTwo) {
      const o = this.offense();
      const pr = clamp(0.47 + ((o.qb?.ovr ?? 70) - 80) * 0.004, 0.35, 0.6);
      if (this.rng.chance(pr)) { this.score[this.poss] += 2; this.addQ(this.poss, 2); ev = this.push({ type: 'two', text: `Two-point conversion is GOOD.`, yards: 0, endYl: 100 }); }
      else ev = this.push({ type: 'two', text: `Two-point attempt fails.`, yards: 0, endYl: 100 });
    } else {
      const l = this.L(k); l.xpa++;
      if (this.rng.chance(clamp(this.fgProb(33, k, side) + 0.03, 0, 0.995))) { l.xpm++; this.score[this.poss] += 1; this.addQ(this.poss, 1); ev = this.push({ type: 'xp', text: `${pn(k)} extra point is good.`, yards: 0, endYl: 100, ids: { kicker: k?.id } }); }
      else ev = this.push({ type: 'xp', text: `${pn(k)} extra point is NO GOOD!`, yards: 0, endYl: 100, ids: { kicker: k?.id } });
    }
    this.poss = (1 - this.poss) as 0 | 1;
    if (this.ot) { this.otPossessions++; this.checkOtEnd(); }
    return ev;
  }

  // ---- win probability ---------------------------------------------------------------
  /** Home-team win probability from score, time, field position and possession. */
  winProb(): number {
    if (this.over) return this.score[1] > this.score[0] ? 1 : this.score[1] < this.score[0] ? 0 : 0.5;
    const tl = Math.max(1, this.ot ? this.clock : this.timeLeft());
    const ep = (0.062 * this.yl - 0.55) * (this.poss === 1 ? 1 : -1);
    const margin = this.score[1] - this.score[0] + ep + this.pregameEdge * (tl / 3600) + 0.8 * (tl / 3600);
    const sd = 13.4 * Math.sqrt(tl / 3600) + 0.6;
    return clamp(phi(margin / sd), 0.001, 0.999);
  }

  // ---- results ---------------------------------------------------------------------
  private finalizeWear() {
    for (const [id, n] of this.snaps) {
      const p = this.league.players[id];
      if (!p) continue;
      const hits = this.hits.get(id) ?? 0;
      p.cond = clamp(p.cond - n * 0.05 - hits * 0.5, 30, 100);
    }
  }
  result() {
    const players: BoxScore['players'] = {};
    for (const [id, l] of this.lines) players[id] = l;
    for (const [id, n] of this.snaps) { const l = (players[id] ??= emptyLine()); (l as StatLine).gp = 1; if (n >= 20) (l as StatLine).gs = 1; }
    // Player of the game: biggest stat impact on the winning side.
    let pog: string | undefined, best = -1;
    const winner = this.score[1] >= this.score[0] ? this.sides[1].abbr : this.sides[0].abbr;
    for (const [id, l] of this.lines) {
      if (this.league.players[id]?.team !== winner) continue;
      const v = l.py * 0.04 + l.ptd * 4 - l.pint * 3 + (l.ry + l.recy) * 0.1 + (l.rtd + l.rectd) * 6 + l.dsk * 4 + l.dint * 5 + l.tkl * 0.6 + l.ff * 3 + l.fgm * 1.5 + l.dtd * 6;
      if (v > best) { best = v; pog = id; }
    }
    return {
      hs: this.score[1], as: this.score[0], ot: this.ot,
      box: { teams: this.box, quarters: this.qScores, scoring: this.scoring, players, pog } as BoxScore,
      injuries: this.injuries,
    };
  }
}

// ---- helpers --------------------------------------------------------------------------
function phi(x: number) { return 0.5 * (1 + erf(x / Math.SQRT2)); }
function erf(x: number) {
  const s = Math.sign(x); x = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * x);
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return s * y;
}
const pn = (p?: Player) => (p ? `${p.fn[0]}.${p.ln}` : 'Unknown');
const qbN = pn;
const ordinal = (n: number) => ['', '1st', '2nd', '3rd', '4th'][n] ?? `${n}th`;
export const ylText = (yl: number) => (yl === 50 ? 'midfield' : yl < 50 ? `own ${yl}` : `opp ${100 - yl}`);
function depthWord(depth: PassDepth, dir: number) {
  const side = dir < 0 ? 'left' : dir > 0 ? 'right' : 'middle';
  return depth === 'screen' ? `screen ${side}` : depth === 'deep' ? `deep ${side}` : `${depth} ${side}`;
}
function runWord(oc: OffCall, dir: number) {
  if (oc.run === 'qb') return 'keeps it';
  if (oc.run === 'outside') return `runs ${dir < 0 ? 'around left end' : 'around right end'}`;
  return 'up the middle';
}
function passName(depth: PassDepth, pa: boolean) {
  const n = { screen: 'Screen', quick: 'Quick Slants', short: 'Curl Flat', medium: 'Dig', deep: 'Four Verticals' }[depth];
  return pa ? `PA ${n}` : n;
}

export function makeWeather(home: Team, game: Game, rng: Rng): Weather {
  const dome = home.roof === 'dome' || home.roof === 'closed' || (home.roof === 'retractable' && rng.chance(0.7));
  if (dome && !game.neutral) return { temp: 70, wind: 0, precip: 'none', dome: true };
  const cold = !home.warm;
  const week = game.week;
  const temp = Math.round((cold ? 72 - week * 2.6 : 82 - week * 1.1) + rng.normal(0, 7));
  const wind = Math.max(0, Math.round(rng.normal(cold ? 9 : 7, 5)));
  const wet = rng.chance(0.13);
  return { temp, wind, precip: wet ? (temp < 33 ? 'snow' : 'rain') : 'none', dome: false };
}

/** Run a whole game at once and return its result. */
export function simGame(league: League, game: Game, seed?: number) {
  const g = new GameSim(league, game, seed);
  return g.simToEnd();
}
