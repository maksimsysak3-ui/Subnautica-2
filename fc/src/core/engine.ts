import { A, type Club, type Fixture, type MatchEvent, type MatchResult, type MatchStats, type Player, type Pos, type Tactic, type World } from './types';
import { clamp, pick, rand, chance, weighted } from './rng';
import { slotsOf, slotRating, autoPick, ROLES } from './tactics';
import { posOvr } from './player';

export const PITCH_L = 105, PITCH_W = 68;

export interface LP {
  id: number; side: 0 | 1; slot: number; pos: Pos; role: string; p: Player;
  energy: number; rating: number; yellow: boolean; off: boolean; on: boolean;
  goals: number; assists: number; shots: number; passes: number; passOk: number; tackles: number; saves: number; keyPasses: number; xg: number;
  eff: number[]; // fatigue-adjusted attribute snapshot
  fam: number;   // positional fit 0..1
  minsIn: number; minsOut: number;
}

export type ActType = 'kickoff' | 'pass' | 'long' | 'through' | 'cross' | 'dribble' | 'carry' | 'shot' | 'goal' | 'save' | 'block' | 'miss' | 'tackle' | 'intercept' | 'clear' | 'foul' | 'corner' | 'fk' | 'pen' | 'offside' | 'out' | 'whistle' | 'card' | 'sub' | 'header' | 'post';
export interface Action { t: number; type: ActType; side: 0 | 1; pid: number; pid2?: number; from: [number, number]; to: [number, number]; dur: number; text?: string; big?: boolean; xg?: number; shotOn?: boolean }

const ATT_POS = new Set<Pos>(['ST', 'LW', 'RW', 'CAM']);
const WIDE = new Set<Pos>(['LW', 'RW', 'LM', 'RM', 'LB', 'RB']);

export interface MatchOpts { neutral?: boolean; knockout?: boolean; aggregate?: [number, number]; leg2?: boolean; userSide?: 0 | 1 | null; live?: boolean; compName?: string }

export class Match {
  w: World; fx: Fixture; clubs: [Club, Club]; tac: [Tactic, Tactic];
  lps: LP[] = []; byId = new Map<number, LP>();
  t = 0;                  // match seconds
  half = 1; endT = 45 * 60; added = 0;
  score: [number, number] = [0, 0];
  ball: [number, number] = [52.5, 34];
  side: 0 | 1 = 0;        // possession
  carrier: LP | null = null;
  counter = 0;            // counter-attack actions remaining
  setPiece: null | 'corner' | 'fk' | 'pen' | 'kickoff' | 'throw' | 'goalkick' = 'kickoff';
  events: MatchEvent[] = [];
  log: Action[] = [];
  st: MatchStats;
  possTime: [number, number] = [0, 0];
  subsUsed: [number, number] = [0, 0];
  done = false; et = false; pens?: [number, number];
  opts: MatchOpts;
  lastPasser: LP | null = null; lastPasserT = 0;
  zoneCache: [number[], number[]] = [[60, 60, 60], [60, 60, 60]];
  zoneAt = -999;
  homeAdv: number;
  commentary: { t: number; text: string; kind?: string }[] = [];

  constructor(w: World, fx: Fixture, opts: MatchOpts = {}) {
    this.w = w; this.fx = fx; this.opts = opts;
    this.clubs = [w.clubs[fx.home], w.clubs[fx.away]];
    for (const c of this.clubs) if (c.tactic.lineup.length !== slotsOf(c.tactic).length || c.tactic.lineup.some(id => !w.players[id] || w.players[id].inj || w.players[id].ban > 0 || w.players[id].club !== c.id)) autoPick(w, c);
    this.tac = [structuredCloneTactic(this.clubs[0].tactic), structuredCloneTactic(this.clubs[1].tactic)];
    this.homeAdv = fx.neutral || opts.neutral ? 0 : 2.1;
    this.st = { poss: [50, 50], shots: [0, 0], sot: [0, 0], xg: [0, 0], passes: [0, 0], passAcc: [0, 0], corners: [0, 0], fouls: [0, 0], offsides: [0, 0], yellows: [0, 0], reds: [0, 0], tackles: [0, 0], saves: [0, 0] };
    ([0, 1] as const).forEach(s => {
      const slots = slotsOf(this.tac[s]);
      this.tac[s].lineup.forEach((id, i) => { const p = w.players[id]; if (p) this.addLP(p, s, i, slots[i][0], this.tac[s].roles[i] ?? ROLES[slots[i][0]]![0], true); });
      this.tac[s].bench.forEach(id => { const p = w.players[id]; if (p) this.addLP(p, s, -1, p.pos, ROLES[p.pos]?.[0] ?? '', false); });
    });
    this.kickoff(0);
  }

  private addLP(p: Player, side: 0 | 1, slot: number, pos: Pos, role: string, on: boolean) {
    const lp: LP = { id: p.id, side, slot, pos, role, p, energy: clamp(p.fitness, 30, 100), rating: 6.0, yellow: false, off: false, on, goals: 0, assists: 0, shots: 0, passes: 0, passOk: 0, tackles: 0, saves: 0, keyPasses: 0, xg: 0, eff: [], fam: 1, minsIn: on ? 0 : -1, minsOut: -1 };
    this.refreshEff(lp);
    this.lps.push(lp); this.byId.set(p.id, lp);
  }
  private refreshEff(lp: LP) {
    const fit = lp.pos === lp.p.pos ? 1 : clamp(posOvr(lp.p.attrs, lp.pos) / Math.max(1, lp.p.ovr), 0.5, 1) * (lp.p.alt.includes(lp.pos) ? 1 : 0.95);
    lp.fam = fit;
    const f = (0.72 + 0.28 * lp.energy / 100) * (0.94 + 0.06 * fit) * (0.97 + lp.p.morale * 0.0004) * (0.985 + lp.p.sharp * 0.00015);
    const home = lp.side === 0 ? this.homeAdv : 0;
    lp.eff = lp.p.attrs.map((v, i) => i === A.stm ? v : (70 + (v - 70) * 0.7) * f + home);
  }

  onPitch(side: 0 | 1) { return this.lps.filter(l => l.side === side && l.on && !l.off); }
  bench(side: 0 | 1) { return this.lps.filter(l => l.side === side && !l.on && !l.off && l.minsOut < 0); }
  gk(side: 0 | 1) { return this.onPitch(side).find(l => l.pos === 'GK') ?? this.onPitch(side)[0]; }
  minute() { return Math.floor(this.t / 60) + 1; }
  clock() {
    const base = this.half === 1 ? 0 : this.half === 2 ? 45 : this.half === 3 ? 90 : 105;
    const len = this.half <= 2 ? 45 : 15;
    const m = Math.floor(this.t / 60);
    const rel = m - (this.half === 1 ? 0 : this.half === 2 ? 45 : this.half === 3 ? 90 : 105);
    void base;
    if (rel >= len) return `${(this.half === 1 ? 45 : this.half === 2 ? 90 : this.half === 3 ? 105 : 120)}+${rel - len + 1}`;
    return `${m + 1}'`;
  }

  // ---- geometry --------------------------------------------------------------
  prog(side: 0 | 1, x: number) { return side === 0 ? x : PITCH_L - x; }
  absX(side: 0 | 1, prog: number) { return side === 0 ? prog : PITCH_L - prog; }

  /** Where a player wants to be given ball position and possession. */
  shapePos(lp: LP, ball: [number, number] = this.ball, poss: 0 | 1 = this.side): [number, number] {
    const slots = slotsOf(this.tac[lp.side]);
    const slot = lp.slot >= 0 ? slots[lp.slot] : ['CM', 0.4, 0.5] as unknown as [Pos, number, number];
    const t = this.tac[lp.side];
    const bp = this.prog(lp.side, ball[0]);
    const att = poss === lp.side;
    let px: number, py: number;
    if (lp.pos === 'GK') {
      px = att ? 6 + Math.max(0, bp - 50) * 0.18 : 3.5 + Math.max(0, bp - 60) * 0.05;
      if (t.roles[lp.slot] === 'Sweeper Keeper' && att) px += 6;
      py = 34 + (ball[1] - 34) * 0.15;
    } else {
      const bx = slot[1];
      if (att) px = 6 + bx * 78 + (bp - 50) * 0.42 + t.mentality * 2.5;
      else px = 4 + bx * 62 + (bp - 50) * 0.45 + (t.line - 50) * 0.14 + t.mentality * 1.5;
      const role = lp.role;
      if (att && (role === 'Wing-Back')) px += 8;
      if (att && role === 'Inverted Full-Back') px += 4;
      if (att && role === 'False 9') px -= 9;
      if (att && role === 'Poacher') px += 4;
      if (att && role === 'Shadow Striker') px += 6;
      const wscale = att ? 0.62 + t.width * 0.0045 : 0.62 + t.width * 0.0012;
      py = 34 + (slot[2] - 0.5) * 68 * wscale;
      if (att && role === 'Inverted Full-Back') py = 34 + (py - 34) * 0.45;
      if (att && (role === 'Inside Forward' || role === 'Wide Playmaker')) py = 34 + (py - 34) * 0.72;
      py += (ball[1] - 34) * (att ? 0.18 : 0.32);
      const maxP = att ? 99 : 93;
      px = clamp(px, 2, maxP);
    }
    return [this.absX(lp.side, clamp(px, 1, 104)), clamp(py, 2, 66)];
  }

  // ---- zone strengths ---------------------------------------------------------
  private zones(side: 0 | 1) {
    if (this.t - this.zoneAt > 240) {
      this.zoneAt = this.t;
      ([0, 1] as const).forEach(s => {
        const on = this.onPitch(s);
        const avg = (ls: LP[], f: (l: LP) => number) => ls.length ? ls.reduce((a, l) => a + f(l), 0) / ls.length : 50;
        const defs = on.filter(l => l.pos === 'CB' || l.pos === 'RB' || l.pos === 'LB' || l.pos === 'CDM');
        const mids = on.filter(l => l.pos === 'CM' || l.pos === 'CDM' || l.pos === 'CAM' || l.pos === 'RM' || l.pos === 'LM');
        const fwds = on.filter(l => ATT_POS.has(l.pos));
        const dRat = avg(defs, l => (l.eff[A.def] + l.eff[A.sta] + l.eff[A.int]) / 3 * l.fam) * Math.min(1, defs.length / 4.5) + (defs.length < 4 ? -3 * (4 - defs.length) : 0);
        const mRat = avg(mids, l => (l.eff[A.int] + l.eff[A.sta] + l.eff[A.stm] * 0.5 + l.eff[A.agg] * 0.5) / 3 * l.fam) + (mids.length - 3) * 2.2;
        const fRat = avg(fwds, l => (l.eff[A.agg] + l.eff[A.stm] + l.eff[A.acc]) / 3) + (on.length < 11 ? -4 : 0);
        this.zoneCache[s] = [fRat, mRat, dRat];
      });
    }
    return this.zoneCache[side];
  }
  /** Defensive resistance the opponents of `side` offer at progress bp. */
  private resist(side: 0 | 1, bp: number) {
    const opp = (1 - side) as 0 | 1;
    const z = this.zones(opp);
    const t = this.tac[opp];
    const r = bp < 38 ? z[0] * 0.8 + (t.pressing - 50) * 0.12 : bp < 68 ? z[1] + (t.pressing - 50) * 0.05 : z[2] + (50 - t.line) * 0.04;
    return r - (this.counter > 0 ? 7 : 0) + (t.mentality < 0 ? -t.mentality * 1.2 : -t.mentality * 0.6) + (this.onPitch(opp).length - 11) * 2.5;
  }

  /** Nearest opponent to a point (for duel credit). */
  private nearestOpp(side: 0 | 1, at: [number, number]) {
    let best: LP | null = null, bd = 1e9;
    for (const l of this.onPitch((1 - side) as 0 | 1)) {
      if (l.pos === 'GK') continue;
      const [x, y] = this.shapePos(l, at, side);
      const d = (x - at[0]) ** 2 + (y - at[1]) ** 2;
      if (d < bd) { bd = d; best = l; }
    }
    return best ?? this.gk((1 - side) as 0 | 1);
  }

  private buf: Action[] = [];
  private push(a: Omit<Action, 't'>) { const act = { ...a, t: this.t } as Action; this.log.push(act); this.buf.push(act); if (this.log.length > 400) this.log.splice(0, 100); return act; }
  private say(text: string, kind?: string) { this.commentary.push({ t: this.t, text, kind }); }

  kickoff(side: 0 | 1) {
    this.side = side; this.ball = [52.5, 34]; this.setPiece = 'kickoff';
    const on = this.onPitch(side);
    this.carrier = on.find(l => l.pos === 'ST') ?? on.find(l => l.pos === 'CAM') ?? on[on.length - 1];
    this.counter = 0;
  }

  // ---- main loop ---------------------------------------------------------------
  /** One discrete action. Returns the actions it produced (for animation). */
  step(): Action[] {
    if (this.done) return [];
    this.buf = [];
    const t0 = this.t;
    this.act();
    const dt = this.t - t0;
    this.possTime[this.side] += dt;
    this.tickFatigue(dt);
    this.checkPeriod();
    return this.buf;
  }

  simToEnd() { let guard = 0; while (!this.done && guard++ < 6000) this.step(); return this.result(); }

  private checkPeriod() {
    if (this.t < this.endT + this.added) return;
    if (this.half === 1) {
      this.half = 2; this.t = 45 * 60; this.endT = 90 * 60; this.added = (1 + Math.floor(rand() * 5) + this.events.filter(e => e.type === 'goal' || e.type === 'sub').length * 0.4) * 60;
      this.push({ type: 'whistle', side: 0, pid: 0, from: [52.5, 34], to: [52.5, 34], dur: 2, text: 'Half-time' });
      this.say(`Half-time: ${this.clubs[0].short} ${this.score[0]}-${this.score[1]} ${this.clubs[1].short}.`, 'whistle');
      this.kickoff(1); this.aiManage(true);
      return;
    }
    if (this.half === 2) {
      if (this.opts.knockout && this.needsWinner()) {
        this.half = 3; this.et = true; this.t = 90 * 60; this.endT = 105 * 60; this.added = 60;
        this.push({ type: 'whistle', side: 0, pid: 0, from: [52.5, 34], to: [52.5, 34], dur: 2, text: 'Extra time' });
        this.say('We are heading to extra time!', 'whistle');
        for (const l of this.lps) l.energy = Math.max(10, l.energy - 4);
        this.kickoff(0); return;
      }
      return this.finish();
    }
    if (this.half === 3) { this.half = 4; this.t = 105 * 60; this.endT = 120 * 60; this.added = 60; this.kickoff(1); return; }
    if (this.half === 4) {
      if (this.needsWinner()) this.shootout();
      return this.finish();
    }
  }
  private needsWinner() {
    const agg = this.opts.aggregate;
    const h = this.score[0] + (agg ? agg[0] : 0), a = this.score[1] + (agg ? agg[1] : 0);
    return h === a;
  }
  private finish() {
    this.done = true;
    this.push({ type: 'whistle', side: 0, pid: 0, from: this.ball, to: this.ball, dur: 2, text: 'Full-time' });
    this.say(`Full-time: ${this.clubs[0].name} ${this.score[0]}-${this.score[1]} ${this.clubs[1].name}${this.pens ? ` (${this.pens[0]}-${this.pens[1]} on penalties)` : ''}.`, 'whistle');
  }

  private shootout() {
    const pens: [number, number] = [0, 0];
    const takers = ([0, 1] as const).map(s => this.onPitch(s).filter(l => l.pos !== 'GK').sort((a, b) => (b.eff[A.pen] + b.eff[A.com]) - (a.eff[A.pen] + a.eff[A.com])));
    let round = 0;
    const kick = (s: 0 | 1) => {
      const tk = takers[s][round % Math.max(1, takers[s].length)] ?? this.gk(s);
      const gk = this.gk((1 - s) as 0 | 1);
      const p = clamp(0.76 + (tk.eff[A.pen] - 75) * 0.006 + (tk.eff[A.com] - 75) * 0.002 - (gk.eff[A.gkr] - 75) * 0.004, 0.55, 0.92);
      const ok = rand() < p;
      if (ok) pens[s]++;
      this.say(`${tk.p.name} ${ok ? 'scores' : pick(['misses!', 'is denied by ' + gk.p.name + '!', 'blazes it over!'])} (${pens[0]}-${pens[1]})`, ok ? 'pen' : 'miss');
      return ok;
    };
    for (round = 0; round < 5; round++) {
      kick(0); if (pens[0] > pens[1] + (5 - round)) break; if (pens[1] + (4 - round) < pens[0]) break;
      kick(1); if (pens[1] > pens[0] + (4 - round)) break; if (pens[0] + (4 - round) < pens[1]) break;
    }
    while (pens[0] === pens[1]) { kick(0); kick(1); round++; if (round > 30) { pens[0]++; } }
    this.pens = pens;
  }

  private tickFatigue(dt: number) {
    const mins = dt / 60;
    for (let s = 0 as 0 | 1; s < 2; s = (s + 1) as 0 | 1) {
      const t = this.tac[s];
      const drain = 0.38 * (1 + (t.pressing - 50) * 0.006 + (t.tempo - 50) * 0.003);
      for (const l of this.lps) {
        if (l.side !== s || !l.on || l.off) continue;
        const k = l.pos === 'GK' ? 0.25 : 1;
        l.energy = clamp(l.energy - mins * drain * k * (1.45 - l.p.attrs[A.stm] / 160), 5, 100);
      }
    }
    if (Math.floor((this.t - dt) / 300) !== Math.floor(this.t / 300)) {
      for (const l of this.lps) if (l.on && !l.off) this.refreshEff(l);
      this.zoneAt = -999;
      this.injuryRoll(5);
      if (this.opts.userSide !== 0) this.aiManage(false, 0);
      if (this.opts.userSide !== 1) this.aiManage(false, 1);
    }
  }

  private injuryRoll(mins: number) {
    for (const l of this.lps) {
      if (!l.on || l.off) continue;
      const p = 0.00028 * mins * (1.6 - l.energy / 100) * (l.pos === 'GK' ? 0.3 : 1);
      if (rand() < p) {
        this.events.push({ min: this.minute(), type: 'inj', side: l.side, pid: l.id });
        this.say(`${l.p.name} is down and needs treatment... he can't continue.`, 'inj');
        (l as LP & { injured?: boolean }).injured = true;
        const sub = this.bestSub(l.side, l.pos);
        if (sub && this.subsUsed[l.side] < 5 && (this.opts.userSide !== l.side || !this.opts.live)) this.substitute(l.side, l.id, sub.id);
        else if (this.opts.userSide === l.side && this.opts.live) { (l as LP & { needsSub?: boolean }).needsSub = true; }
      }
    }
  }

  bestSub(side: 0 | 1, pos: Pos) {
    let best: LP | null = null, bv = -1;
    for (const b of this.bench(side)) { const v = slotRating(b.p, pos) * (b.p.fitness / 100); if (v > bv) { bv = v; best = b; } }
    return best;
  }

  substitute(side: 0 | 1, outId: number, inId: number) {
    const out = this.byId.get(outId), inn = this.byId.get(inId);
    if (!out || !inn || !out.on || out.off || inn.on || inn.off || inn.minsOut >= 0 || this.subsUsed[side] >= 5) return false;
    inn.on = true; inn.slot = out.slot; inn.pos = out.pos; inn.role = out.role; inn.minsIn = this.minute();
    out.on = false; out.minsOut = this.minute();
    this.refreshEff(inn);
    this.subsUsed[side]++;
    if (this.carrier === out) this.carrier = inn;
    const tl = this.tac[side];
    const i = tl.lineup.indexOf(outId); if (i >= 0) tl.lineup[i] = inId;
    this.events.push({ min: this.minute(), type: 'sub', side, pid: inId, pid2: outId });
    this.push({ type: 'sub', side, pid: inId, pid2: outId, from: this.ball, to: this.ball, dur: 1, text: `${inn.p.name} on for ${out.p.name}` });
    this.say(`Substitution for ${this.clubs[side].short}: ${inn.p.name} replaces ${out.p.name}.`, 'sub');
    this.zoneAt = -999;
    return true;
  }

  /** Change shape mid-game: slots are reassigned by best fit. */
  setFormation(side: 0 | 1, formation: string) {
    const t = this.tac[side];
    t.formation = formation;
    const slots = slotsOf(t);
    const on = this.onPitch(side);
    const used = new Set<number>();
    const order = slots.map((_, i) => i).sort((a, b) => (slots[a][0] === 'GK' ? -1 : 1) - (slots[b][0] === 'GK' ? -1 : 1));
    t.roles = slots.map(s => ROLES[s[0]]![0]);
    for (const i of order) {
      let best: LP | null = null, bv = -1;
      for (const l of on) { if (used.has(l.id)) continue; const v = slotRating(l.p, slots[i][0]) + (l.slot === i ? 2 : 0); if (v > bv) { bv = v; best = l; } }
      if (best) { used.add(best.id); best.slot = i; best.pos = slots[i][0]; best.role = t.roles[i]; this.refreshEff(best); }
    }
    t.lineup = slots.map((_, i) => on.find(l => l.slot === i)?.id ?? -1);
    this.zoneAt = -999;
  }

  private aiManage(halftime: boolean, only?: 0 | 1) {
    const min = this.t / 60;
    for (const s of [0, 1] as const) {
      if (only !== undefined && s !== only) continue;
      if (this.opts.userSide === s) continue;
      const diff = this.score[s] - this.score[1 - s] + (this.opts.aggregate ? (s === 0 ? this.opts.aggregate[0] - this.opts.aggregate[1] : this.opts.aggregate[1] - this.opts.aggregate[0]) : 0);
      const t = this.tac[s];
      if (min > 65 && diff < 0) { t.mentality = (diff <= -2 ? 2 : 1) as 1 | 2; t.tempo = 70; }
      else if (min > 75 && diff > 0) { t.mentality = -1; t.timeWaste = true; }
      if (this.subsUsed[s] >= 5) continue;
      if (halftime || min > 55) {
        const cand = this.onPitch(s).filter(l => l.pos !== 'GK').sort((a, b) => (a.energy + a.rating * 6) - (b.energy + b.rating * 6));
        const limit = halftime ? 1 : min > 80 ? 5 : min > 70 ? 4 : 2;
        for (const l of cand) {
          if (this.subsUsed[s] >= limit) break;
          if (!halftime && l.energy > 62 && l.rating >= 6.2) continue;
          if (halftime && !(l.yellow || l.rating < 5.6)) continue;
          let pos = l.pos;
          if (diff < 0 && min > 65 && (pos === 'CDM' || pos === 'CB') && this.onPitch(s).filter(x => x.pos === 'CB').length > 2) pos = 'ST';
          const b = this.bestSub(s, pos);
          if (b && slotRating(b.p, l.pos) > slotRating(l.p, l.pos) * (l.energy / 100) * 0.9) this.substitute(s, l.id, b.id);
        }
      }
    }
  }

  // ---- the action ----------------------------------------------------------------
  private act() {
    const s = this.side;
    const opp = (1 - s) as 0 | 1;
    const c = this.carrier && this.carrier.on && !this.carrier.off ? this.carrier : this.pickReceiver(s, 'short');
    this.carrier = c;
    if (this.setPiece) return this.doSetPiece(c);
    const bp = this.prog(s, this.ball[0]);
    const t = this.tac[s];
    const res = this.resist(s, bp);
    const cy = this.ball[1];
    const wide = Math.abs(cy - 34) > 18;
    const role = c.role;
    const inBox = bp > 88 && Math.abs(cy - 34) < 20;
    const e = c.eff;
    // decision weights
    const w: [string, number][] = [];
    const ment = t.mentality;
    if (c.pos === 'GK') {
      w.push(['pass', 70 - t.directness * 0.4], ['long', 20 + t.directness * 0.6]);
    } else if (inBox) {
      w.push(['shot', 46 + (e[A.fin] - 70) * 0.8 + ment * 6 + (role === 'Poacher' ? 12 : 0)], ['pass', 24], ['dribble', 12 + (e[A.dri] - 70) * 0.3]);
      if (wide) w.push(['cross', 30]);
    } else if (bp > 70) {
      const ls = e[A.lon] > 72 && !wide ? 5 + (e[A.lon] - 72) * 0.5 + ment * 1.5 + (role === 'Inside Forward' || role === 'Mezzala' ? 4 : 0) : 1;
      w.push(['shot', ls], ['pass', 32], ['through', 7 + (e[A.vis] - 70) * 0.35 + (role === 'Playmaker' ? 6 : 0) + ment * 2], ['dribble', 11 + (e[A.dri] - 70) * 0.45 + (role === 'Winger' || role === 'Inside Forward' ? 6 : 0)]);
      if (wide) w.push(['cross', 15 + t.width * 0.15 + (e[A.cro] - 70) * 0.4 + (role === 'Winger' || role === 'Wing-Back' ? 10 : 0) - (role === 'Inside Forward' ? 10 : 0)]);
      if (this.counter > 0) w.push(['through', 10], ['dribble', 6]);
    } else if (bp > 38) {
      w.push(['pass', 52 + (t.tempo < 40 ? 10 : 0)], ['long', 5 + t.directness * 0.12 + (role === 'Deep-Lying Playmaker' ? 6 : 0)], ['through', 4 + (e[A.vis] - 70) * 0.18 + ment * 1.5 + (this.counter > 0 ? 12 : 0)], ['carry', 10 + (e[A.dri] - 70) * 0.25 + (this.counter > 0 ? 8 : 0)], ['dribble', 5 + (e[A.dri] - 70) * 0.25]);
      if (wide && bp > 55) w.push(['cross', 3 + t.width * 0.05]);
    } else {
      w.push(['pass', 58], ['long', 6 + t.directness * 0.18 + (res > 72 ? 6 : 0)], ['carry', 9 + (role === 'Ball-Playing CB' ? 6 : 0)]);
      if (bp < 18 && res > 70 && rand() < 0.15) w.push(['clear', 12]);
    }
    // off-the-ball fouls and tactical fouls while the opponent presses
    const dside = (1 - s) as 0 | 1;
    if (c.pos !== 'GK' && rand() < 0.021 * (1 + (this.tac[dside].pressing - 50) * 0.006) * (bp > 60 ? 1.15 : 0.9)) {
      const d = this.nearestOpp(s, this.ball);
      return this.foul(d, c, [...this.ball] as [number, number]);
    }
    const choice = weighted(w, x => x[1])[0];
    switch (choice) {
      case 'shot': return this.shoot(c, 'open');
      case 'cross': return this.cross(c, res);
      case 'through': return this.pass(c, 'through', res);
      case 'long': return this.pass(c, 'long', res);
      case 'clear': return this.pass(c, 'clear', res);
      case 'dribble': return this.dribble(c, res, true);
      case 'carry': return this.dribble(c, res, false);
      default: return this.pass(c, 'short', res);
    }
    void opp;
  }

  private pickReceiver(s: 0 | 1, kind: 'short' | 'long' | 'through' | 'box' | 'clear', from?: LP): LP {
    const on = this.onPitch(s).filter(l => l !== from);
    const bp = this.prog(s, this.ball[0]);
    const cands: [LP, number][] = [];
    for (const l of on) {
      const [x, y] = this.shapePos(l);
      const lp = this.prog(s, x);
      const dx = lp - bp, dy = Math.abs(y - this.ball[1]);
      let wgt = 0;
      if (kind === 'short') wgt = l.pos === 'GK' ? (bp < 30 ? 3 : 0.2) : Math.max(0.3, 10 - Math.abs(dx - 6) * 0.35 - dy * 0.18) + (l.role === 'Playmaker' || l.role === 'Deep-Lying Playmaker' ? 3 : 0);
      else if (kind === 'long' || kind === 'clear') wgt = l.pos === 'GK' ? 0 : Math.max(0.2, dx * 0.2 + (ATT_POS.has(l.pos) ? 4 : 0) + (dy > 20 ? 2 : 0) + (l.role === 'Target Forward' ? 4 : 0));
      else if (kind === 'through') wgt = ATT_POS.has(l.pos) || l.role === 'Wing-Back' || l.role === 'Box-to-Box' ? 3.5 + (l.eff[A.spd] - 70) * 0.08 + (l.role === 'Poacher' || l.role === 'Advanced Forward' || l.role === 'Shadow Striker' ? 3 : 0) : 0.1;
      else if (kind === 'box') wgt = l.pos === 'ST' ? 4.2 + (l.role === 'Target Forward' ? 3 : 0) + (l.role === 'Poacher' ? 1.5 : 0) : (l.pos === 'CAM' || l.pos === 'LW' || l.pos === 'RW' || l.role === 'Box-to-Box' || l.role === 'Mezzala' || l.role === 'Shadow Striker') ? 3.2 : l.pos === 'CM' || l.pos === 'CB' ? 1.4 : 0.4;
      if (wgt > 0) cands.push([l, wgt]);
    }
    if (!cands.length) return on[0] ?? this.gk(s);
    return weighted(cands, c => c[1])[0];
  }

  private turnover(winner: LP, at: [number, number], how: 'tackle' | 'intercept' | 'loose') {
    this.side = winner.side;
    this.carrier = winner;
    this.ball = at;
    const bp = this.prog(winner.side, at[0]);
    const t = this.tac[winner.side];
    const oppMent = this.tac[(1 - winner.side) as 0 | 1].mentality;
    this.counter = bp < 60 && (t.counter || chance(0.25 + oppMent * 0.08)) ? 3 + (t.counter ? 1 : 0) : 0;
    if (how === 'tackle') { winner.tackles++; this.st.tackles[winner.side]++; winner.rating += 0.08; }
    if (how === 'intercept') { winner.rating += 0.07; }
  }

  private pass(c: LP, kind: 'short' | 'long' | 'through' | 'clear', res: number) {
    const s = this.side;
    const r = this.pickReceiver(s, kind === 'clear' ? 'long' : kind, c);
    const target = this.shapePos(r);
    const bp = this.prog(s, this.ball[0]);
    let to: [number, number] = [target[0] + (rand() - 0.5) * 4, clamp(target[1] + (rand() - 0.5) * 6, 1, 67)];
    if (kind === 'through') { const tp = clamp(this.prog(s, to[0]) + 10 + rand() * 8, 0, 100); to = [this.absX(s, tp), to[1]]; }
    const e = c.eff, re = r.eff;
    const skill = kind === 'short' ? e[A.spa] * 0.7 + e[A.vis] * 0.1 + e[A.com] * 0.2 : kind === 'through' ? e[A.vis] * 0.5 + e[A.spa] * 0.25 + e[A.lpa] * 0.25 : e[A.lpa] * 0.7 + e[A.vis] * 0.2 + e[A.cur] * 0.1;
    const base = kind === 'short' ? 0.89 : kind === 'long' ? 0.6 : kind === 'through' ? 0.4 : 0.42;
    const tp = this.prog(s, to[0]);
    const deep = tp > 75 ? (tp - 75) * 0.006 : 0;
    let p = base + (skill - res) * (kind === 'short' ? 0.0045 : 0.006) + (re[A.bc] - 70) * 0.0015 - deep + (this.counter > 0 ? 0.05 : 0);
    if (kind === 'through') p += (re[A.spd] + re[A.acc] - 140) * 0.0025 + (re[A.pos] - 70) * 0.002;
    if (kind === 'short' && bp < 30 && this.tac[(1 - s) as 0 | 1].pressing > 65) p -= 0.04;
    p = clamp(p, 0.15, 0.97);
    const dist = Math.hypot(to[0] - this.ball[0], to[1] - this.ball[1]);
    const dur = kind === 'short' ? 2.4 + dist * 0.06 : 3 + dist * 0.05;
    c.passes++; this.st.passes[s]++;
    if (kind === 'through') {
      const line = this.tac[(1 - s) as 0 | 1];
      const offP = (line.offside ? 0.2 : 0.09) + (line.line - 50) * 0.002 - (re[A.pos] - 70) * 0.003;
      if (rand() < clamp(offP, 0.03, 0.3)) {
        this.push({ type: 'offside', side: s, pid: c.id, pid2: r.id, from: [...this.ball], to, dur });
        this.st.offsides[s]++;
        this.t += dur + 8;
        this.say(`Flag goes up: ${r.p.name} was caught offside.`);
        const gkS = (1 - s) as 0 | 1;
        this.side = gkS; this.carrier = this.pickReceiver(gkS, 'short'); this.ball = [...to] as [number, number]; this.counter = 0;
        return;
      }
    }
    if (rand() < p) {
      c.passOk++; this.st.passAcc[s]++;
      this.push({ type: kind === 'short' ? 'pass' : kind === 'clear' ? 'long' : kind, side: s, pid: c.id, pid2: r.id, from: [...this.ball], to, dur });
      this.ball = to; this.carrier = r;
      this.t += dur + (this.tac[s].tempo < 40 ? 1.2 : this.tac[s].tempo > 65 ? -0.4 : 0.4);
      this.lastPasser = c; this.lastPasserT = this.t;
      if (kind === 'through') { c.rating += 0.06; if (this.prog(s, to[0]) > 80) { c.keyPasses++; this.counter = Math.max(this.counter, 1); return this.shoot(r, 'through'); } }
      if (kind !== 'short') c.rating += 0.02;
      if (this.counter > 0) this.counter--;
      if (this.tac[s].timeWaste && this.t > 80 * 60) this.t += 3;
    } else {
      const mid: [number, number] = [this.ball[0] + (to[0] - this.ball[0]) * (0.5 + rand() * 0.4), clamp(this.ball[1] + (to[1] - this.ball[1]) * (0.5 + rand() * 0.4), 1, 67)];
      if (kind === 'long' || kind === 'clear' || rand() < 0.18) {
        if (rand() < 0.35) return this.outOfPlay(c, mid, dur);
      }
      const d = this.nearestOpp(s, mid);
      this.push({ type: 'intercept', side: (1 - s) as 0 | 1, pid: d.id, pid2: c.id, from: [...this.ball], to: mid, dur });
      this.t += dur + 0.5;
      c.rating -= bp < 35 ? 0.12 : 0.03;
      this.turnover(d, mid, 'intercept');
    }
  }

  private outOfPlay(c: LP, at: [number, number], dur: number) {
    const s = this.side;
    const opp = (1 - s) as 0 | 1;
    const y = at[1] < 34 ? 0.5 : 67.5;
    const p: [number, number] = [clamp(at[0], 1, 104), y];
    this.push({ type: 'out', side: s, pid: c.id, from: [...this.ball], to: p, dur });
    this.t += dur + 6 + rand() * 8;
    this.side = opp; this.ball = [p[0], p[1] < 34 ? 2 : 66]; this.carrier = this.pickReceiver(opp, 'short'); this.counter = 0;
    this.setPiece = 'throw';
  }

  private dribble(c: LP, res: number, take: boolean) {
    const s = this.side;
    const e = c.eff;
    const d = this.nearestOpp(s, this.ball);
    const de = d.eff;
    const bp = this.prog(s, this.ball[0]);
    const gain = take ? 6 + rand() * 9 : 5 + rand() * 9;
    const inv = c.role === 'Inside Forward' && Math.abs(this.ball[1] - 34) > 12 ? (this.ball[1] < 34 ? 5 : -5) : 0;
    const to: [number, number] = [this.absX(s, clamp(bp + gain, 0, 102)), clamp(this.ball[1] + inv + (rand() - 0.5) * 8, 2, 66)];
    const atk = take ? e[A.dri] * 0.45 + e[A.agi] * 0.2 + e[A.bal] * 0.1 + e[A.acc] * 0.15 + e[A.bc] * 0.1 : e[A.bc] * 0.5 + e[A.spd] * 0.3 + e[A.str] * 0.2;
    const def = de[A.sta] * 0.4 + de[A.def] * 0.3 + de[A.acc] * 0.15 + de[A.str] * 0.15;
    let p = (take ? 0.6 : 0.82) + (atk - def) * 0.0085 + (atk - res) * 0.002 + (this.counter > 0 ? 0.08 : 0);
    p = clamp(p, 0.2, 0.95);
    const dur = 2.5 + gain * 0.18;
    if (rand() < p) {
      this.push({ type: take ? 'dribble' : 'carry', side: s, pid: c.id, pid2: d.id, from: [...this.ball], to, dur });
      this.ball = to; this.t += dur;
      if (take) c.rating += 0.05;
      if (this.counter > 0) this.counter--;
      return;
    }
    // challenge: foul or clean tackle
    const foulP = 0.15 + (de[A.agg] - 65) * 0.003 + (take ? 0.06 : 0) + (this.prog(s, this.ball[0]) > 70 ? 0.04 : 0);
    if (rand() < foulP) return this.foul(d, c, to);
    this.push({ type: 'tackle', side: d.side, pid: d.id, pid2: c.id, from: [...this.ball], to: [...this.ball], dur });
    this.t += dur;
    c.rating -= 0.04;
    this.turnover(d, [...this.ball] as [number, number], 'tackle');
  }

  private foul(by: LP, on: LP, at: [number, number]) {
    const s = on.side;
    this.st.fouls[by.side]++;
    this.t += 15 + rand() * 25;
    const bp = this.prog(s, at[0]);
    const inBox = bp > 88.5 && Math.abs(at[1] - 34) < 20;
    this.push({ type: 'foul', side: by.side, pid: by.id, pid2: on.id, from: [...this.ball], to: at, dur: 2 });
    by.rating -= 0.08;
    // cards
    const cardP = 0.13 + (by.p.attrs[A.agg] - 65) * 0.003 + (bp > 75 ? 0.08 : 0) + (this.counter > 0 ? 0.12 : 0);
    if (rand() < cardP * (by.yellow ? 0.12 : 1)) this.card(by, rand() < 0.012 || (bp > 75 && this.counter > 0 && rand() < 0.05));
    this.ball = at; this.side = s; this.carrier = on; this.counter = 0;
    if (inBox) {
      this.setPiece = 'pen';
      this.say(`PENALTY! ${by.p.name} brings down ${on.p.name} in the box!`, 'pen');
    } else if (bp > 72 && Math.abs(at[1] - 34) < 22) {
      this.setPiece = 'fk';
      this.say(`Free kick in a dangerous position after ${by.p.name} fouls ${on.p.name}.`);
    } else {
      this.setPiece = null;
      if (rand() < 0.3) this.say(`${by.p.name} catches ${on.p.name} late. Free kick.`);
    }
  }

  private card(l: LP, straightRed: boolean) {
    const s = l.side;
    if (straightRed || l.yellow) {
      if (!straightRed) { this.st.yellows[s]++; this.events.push({ min: this.minute(), type: 'yellow', side: s, pid: l.id }); }
      l.off = true; l.rating -= 1.2; this.st.reds[s]++;
      this.events.push({ min: this.minute(), type: 'red', side: s, pid: l.id });
      this.push({ type: 'card', side: s, pid: l.id, from: this.ball, to: this.ball, dur: 3, text: 'red' });
      this.say(`RED CARD! ${l.p.name} is sent off${straightRed ? '' : ' for a second booking'}. ${this.clubs[s].short} down to ${this.onPitch(s).length}.`, 'red');
      if (l.pos === 'GK') {
        const sub = this.bench(s).find(b => b.p.pos === 'GK');
        const victim = this.onPitch(s).filter(x => x.pos !== 'GK').sort((a, b) => a.rating - b.rating)[0];
        if (sub && victim && this.subsUsed[s] < 5) { this.substitute(s, victim.id, sub.id); sub.slot = l.slot; sub.pos = 'GK'; }
        else if (victim) { victim.pos = 'GK'; }
      }
      this.zoneAt = -999;
    } else {
      l.yellow = true; this.st.yellows[s]++; l.rating -= 0.25;
      this.events.push({ min: this.minute(), type: 'yellow', side: s, pid: l.id });
      this.push({ type: 'card', side: s, pid: l.id, from: this.ball, to: this.ball, dur: 2, text: 'yellow' });
      this.say(`Yellow card for ${l.p.name}.`, 'yellow');
    }
  }

  private cross(c: LP, res: number) {
    const s = this.side;
    const r = this.pickReceiver(s, 'box', c);
    const to: [number, number] = [this.absX(s, 92 + rand() * 9), 34 + (rand() - 0.5) * 16];
    const e = c.eff;
    const p = clamp(0.36 + (e[A.cro] - res) * 0.006 + (e[A.cur] - 70) * 0.002, 0.15, 0.68);
    c.passes++; this.st.passes[s]++;
    if (rand() < p) {
      c.passOk++; this.st.passAcc[s]++;
      this.push({ type: 'cross', side: s, pid: c.id, pid2: r.id, from: [...this.ball], to, dur: 3 });
      this.ball = to; this.t += 3; this.carrier = r; this.lastPasser = c; this.lastPasserT = this.t;
      // aerial duel
      const d = this.nearestOpp(s, to);
      const atk = r.eff[A.hea] * 0.45 + r.eff[A.jum] * 0.3 + r.eff[A.str] * 0.15 + r.eff[A.pos] * 0.1;
      const def = d.eff[A.hea] * 0.35 + d.eff[A.jum] * 0.3 + d.eff[A.str] * 0.2 + d.eff[A.def] * 0.15;
      if (rand() < clamp(0.5 + (atk - def) * 0.012, 0.15, 0.85)) { c.keyPasses++; return this.shoot(r, 'header'); }
      this.push({ type: 'clear', side: d.side, pid: d.id, from: to, to: [this.absX(s, 70 + rand() * 12), 10 + rand() * 48], dur: 2.5 });
      this.t += 2.5;
      if (rand() < 0.3) return this.corner(s);
      this.turnover(d, this.log[this.log.length - 1].to, 'intercept');
    } else {
      this.t += 3;
      if (rand() < 0.4) { this.push({ type: 'cross', side: s, pid: c.id, from: [...this.ball], to, dur: 3 }); return this.corner(s); }
      const d = this.nearestOpp(s, to);
      this.push({ type: 'intercept', side: d.side, pid: d.id, pid2: c.id, from: [...this.ball], to, dur: 3 });
      this.turnover(d, to, 'intercept');
    }
  }

  private corner(s: 0 | 1) {
    this.st.corners[s]++;
    this.setPiece = 'corner';
    this.side = s;
    const top = rand() < 0.5;
    this.ball = [this.absX(s, 104.5), top ? 0.5 : 67.5];
    const tk = this.byId.get(this.tac[s].corners ?? -1);
    this.carrier = tk && tk.on && !tk.off ? tk : this.pickReceiver(s, 'short');
    this.t += 12 + rand() * 10;
  }

  private doSetPiece(c: LP) {
    const s = this.side;
    const sp = this.setPiece; this.setPiece = null;
    if (sp === 'kickoff') { this.push({ type: 'kickoff', side: s, pid: c.id, from: [52.5, 34], to: [52.5, 34], dur: 1 }); this.t += 1; return this.pass(c, 'short', 55); }
    if (sp === 'throw') { this.t += 2; return this.pass(c, 'short', this.resist(s, this.prog(s, this.ball[0])) - 6); }
    if (sp === 'pen') {
      const tk = this.byId.get(this.tac[s].pens ?? -1);
      const taker = tk && tk.on && !tk.off ? tk : this.onPitch(s).filter(l => l.pos !== 'GK').sort((a, b) => b.eff[A.pen] - a.eff[A.pen])[0];
      this.ball = [this.absX(s, 94), 34];
      this.t += 40;
      return this.shoot(taker, 'pen');
    }
    if (sp === 'fk') {
      const tk = this.byId.get(this.tac[s].fks ?? -1);
      const taker = tk && tk.on && !tk.off ? tk : c;
      const dist = 105 - this.prog(s, this.ball[0]);
      this.t += 20;
      if (dist < 32 && rand() < 0.55) return this.shoot(taker, 'fk');
      return this.cross(taker, this.resist(s, 90) - 4);
    }
    if (sp === 'corner') {
      const e = c.eff;
      const r = this.pickReceiver(s, 'box', c);
      const to: [number, number] = [this.absX(s, 94 + rand() * 6), 34 + (rand() - 0.5) * 14];
      this.push({ type: 'cross', side: s, pid: c.id, pid2: r.id, from: [...this.ball], to, dur: 3, text: 'corner' });
      this.ball = to; this.t += 3;
      const d = this.nearestOpp(s, to);
      const atk = r.eff[A.hea] * 0.5 + r.eff[A.jum] * 0.3 + r.eff[A.str] * 0.2 + (e[A.cro] - 70) * 0.3;
      const def = d.eff[A.hea] * 0.4 + d.eff[A.jum] * 0.3 + d.eff[A.str] * 0.3;
      if (rand() < clamp(0.36 + (atk - def) * 0.01, 0.1, 0.7)) { this.lastPasser = c; this.lastPasserT = this.t; return this.shoot(r, 'header'); }
      this.push({ type: 'clear', side: d.side, pid: d.id, from: to, to: [this.absX(s, 65 + rand() * 15), 10 + rand() * 48], dur: 2.5 });
      this.t += 2.5;
      this.turnover(d, this.log[this.log.length - 1].to, 'intercept');
      if (rand() < 0.45) { this.side = s; this.carrier = this.pickReceiver(s, 'short'); }
      return;
    }
    if (sp === 'goalkick') { this.t += 6; return this.pass(c, this.tac[s].directness > 60 ? 'long' : 'short', 50); }
  }

  private shoot(c: LP, kind: 'open' | 'through' | 'header' | 'pen' | 'fk') {
    const s = this.side;
    const opp = (1 - s) as 0 | 1;
    const gk = this.gk(opp);
    const bp = this.prog(s, this.ball[0]);
    const dist = Math.hypot(105 - bp, this.ball[1] - 34);
    const angle = Math.abs(this.ball[1] - 34) / Math.max(4, 105 - bp);
    let xg: number;
    if (kind === 'pen') xg = 0.78;
    else if (kind === 'fk') xg = 0.065;
    else if (kind === 'through') xg = clamp(0.36 - Math.max(0, dist - 10) * 0.012, 0.12, 0.42);
    else if (kind === 'header') xg = clamp(0.16 - (dist - 7) * 0.012, 0.03, 0.2);
    else xg = clamp(0.5 * Math.exp(-dist / 8.5) - angle * 0.04, 0.012, 0.55);
    const e = c.eff;
    const fin = kind === 'header' ? e[A.hea] * 0.7 + e[A.str] * 0.3 : kind === 'pen' ? e[A.pen] * 0.75 + e[A.com] * 0.25 : kind === 'fk' ? e[A.fka] * 0.7 + e[A.cur] * 0.3 : dist > 18 ? e[A.lon] * 0.55 + e[A.shp] * 0.3 + e[A.cur] * 0.15 : e[A.fin] * 0.65 + e[A.com] * 0.2 + e[A.pos] * 0.15;
    const g = gk.eff;
    const keep = g[A.gkd] * 0.3 + g[A.gkr] * 0.3 + g[A.gkp] * 0.25 + g[A.gkh] * 0.15;
    const mult = clamp(1.36 + (fin - 74) * 0.016 - (keep - 74) * 0.014, 0.6, 1.9);
    const pGoal = clamp(xg * mult, 0.005, kind === 'pen' ? 0.92 : 0.8);
    const onTargetP = clamp(0.3 + (fin - 70) * 0.006 + xg * 0.5, 0.15, 0.85);
    c.shots++; c.xg += xg; this.st.shots[s]++; this.st.xg[s] += xg;
    const goalY = 34 + (rand() - 0.5) * 6.4;
    const goalPt: [number, number] = [this.absX(s, 105), goalY];
    const from: [number, number] = [...this.ball];
    const big = xg > 0.25;
    this.t += kind === 'pen' ? 3 : 2;
    const blockP = kind === 'pen' || kind === 'fk' || kind === 'header' ? 0 : clamp(0.08 + Math.min(0.2, (this.resist(s, bp) - 60) * 0.006) + (dist > 18 ? 0.12 : 0), 0.05, 0.35);
    if (rand() < blockP) {
      const d = this.nearestOpp(s, this.ball);
      this.push({ type: 'block', side: s, pid: c.id, pid2: d.id, from, to: [this.absX(s, bp + 2), this.ball[1]], dur: 1.2, xg });
      d.rating += 0.1;
      if (rand() < 0.55) return this.corner(s);
      return this.turnover(d, [this.absX(s, bp + 2), this.ball[1]], 'intercept');
    }
    if (rand() < pGoal) return this.goal(c, kind, from, goalPt, xg);
    if (rand() < Math.max(0, onTargetP - pGoal) / Math.max(0.2, 1 - pGoal)) {
      // saved
      this.st.sot[s]++; this.st.saves[opp]++; gk.saves++; gk.rating += 0.22 + xg * 0.6;
      this.push({ type: 'save', side: s, pid: c.id, pid2: gk.id, from, to: [this.absX(s, 103.5), goalY], dur: 1.2, xg, big, shotOn: true });
      c.rating += 0.05;
      if (big) this.say(`${pick(['What a save!', 'Denied!', 'Superb stop!'])} ${gk.p.name} keeps out ${c.p.name}${kind === 'pen' ? "'s penalty" : ''}.`, 'save');
      else if (rand() < 0.4) this.say(`${c.p.name} tries his luck${dist > 20 ? ' from distance' : ''} — comfortable for ${gk.p.name}.`);
      this.t += 4;
      if (rand() < 0.4) return this.corner(s);
      this.side = opp; this.carrier = gk; this.ball = [this.absX(opp, 6), 34]; this.counter = rand() < 0.2 ? 2 : 0;
      return;
    }
    // off target
    const post = rand() < 0.06;
    const missTo: [number, number] = [this.absX(s, 106), goalY + (rand() < 0.5 ? -1 : 1) * (4 + rand() * 6)];
    this.push({ type: post ? 'post' : 'miss', side: s, pid: c.id, from, to: post ? [this.absX(s, 105), rand() < 0.5 ? 30.4 : 37.6] : missTo, dur: 1.2, xg, big });
    if (big || post) this.say(post ? `OFF THE POST! ${c.p.name} so close!` : `${pick(['Huge chance!', 'He has to score!', 'Wasteful!'])} ${c.p.name} ${kind === 'header' ? 'heads wide' : kind === 'pen' ? 'misses the penalty!' : 'drags it wide'}.`, 'miss');
    if (kind === 'pen') this.events.push({ min: this.minute(), type: 'miss', side: s, pid: c.id, text: 'pen' });
    c.rating -= big ? 0.2 : 0.02;
    this.t += 10 + rand() * 8;
    this.side = opp; this.carrier = gk; this.ball = [this.absX(opp, 6), 34]; this.setPiece = 'goalkick'; this.counter = 0;
  }

  private goal(c: LP, kind: string, from: [number, number], to: [number, number], xg: number) {
    const s = this.side;
    const opp = (1 - s) as 0 | 1;
    this.score[s]++;
    this.st.sot[s]++;
    c.goals++; c.rating += kind === 'pen' ? 0.6 : 0.95;
    const assister = this.lastPasser && this.lastPasser.side === s && this.lastPasser !== c && this.t - this.lastPasserT < 14 && kind !== 'pen' && kind !== 'fk' ? this.lastPasser : null;
    if (assister) { assister.assists++; assister.rating += 0.6; }
    for (const l of this.onPitch(opp)) l.rating -= l.pos === 'GK' ? 0.35 : (l.pos === 'CB' || l.pos === 'LB' || l.pos === 'RB' || l.pos === 'CDM') ? 0.15 : 0.03;
    this.events.push({ min: this.minute(), type: kind === 'pen' ? 'pen' : 'goal', side: s, pid: c.id, pid2: assister?.id });
    const desc = kind === 'pen' ? 'from the spot' : kind === 'header' ? 'with a header' : kind === 'fk' ? 'with a stunning free kick' : kind === 'through' ? 'one-on-one' : xg < 0.06 ? 'with a screamer from distance' : 'with a cool finish';
    this.push({ type: 'goal', side: s, pid: c.id, pid2: assister?.id, from, to, dur: 1.2, xg, big: true, text: desc });
    this.say(`GOAL! ${c.p.name} scores ${desc}${assister ? `, assisted by ${assister.p.name}` : ''}! ${this.clubs[0].short} ${this.score[0]}-${this.score[1]} ${this.clubs[1].short}`, 'goal');
    this.t += 55 + rand() * 25;
    this.kickoff(opp);
    this.lastPasser = null;
  }

  // ---- outcome -----------------------------------------------------------------------
  result(): MatchResult {
    const tot = this.possTime[0] + this.possTime[1] || 1;
    this.st.poss = [Math.round(this.possTime[0] / tot * 100), 100 - Math.round(this.possTime[0] / tot * 100)];
    this.st.xg = [Math.round(this.st.xg[0] * 100) / 100, Math.round(this.st.xg[1] * 100) / 100];
    const ratings: Record<number, number> = {};
    let motm = -1, best = -1;
    for (const l of this.lps) {
      if (l.minsIn < 0) continue;
      let r = l.rating;
      const conc = this.score[(1 - l.side) as 0 | 1];
      if (conc === 0 && (l.pos === 'GK' || l.pos === 'CB' || l.pos === 'LB' || l.pos === 'RB')) r += 0.5;
      const won = this.score[l.side] > this.score[1 - l.side];
      r += won ? 0.25 : this.score[l.side] < this.score[1 - l.side] ? -0.2 : 0;
      r += (l.passOk - (l.passes - l.passOk) * 1.5) * 0.004;
      r = clamp(Math.round(r * 10) / 10, 3, 10);
      ratings[l.id] = r;
      if (r > best) { best = r; motm = l.id; }
    }
    return {
      hg: this.score[0], ag: this.score[1], pens: this.pens, et: this.et, events: this.events, stats: this.st, ratings, motm,
      lineups: [this.lps.filter(l => l.side === 0 && l.minsIn >= 0).map(l => l.id), this.lps.filter(l => l.side === 1 && l.minsIn >= 0).map(l => l.id)],
      att: Math.round(this.clubs[0].cap * clamp(0.82 + this.clubs[0].fans * 0.002 + rand() * 0.06, 0.6, 1)),
    };
  }

  /** Write match outcome into the persistent players (fitness, stats, cards, injuries). */
  commit(res: MatchResult) {
    const mins = this.et ? 120 : 90;
    for (const l of this.lps) {
      const p = l.p;
      if (l.minsIn < 0) { p.sharp = clamp(p.sharp - 2, 20, 100); continue; }
      const played = Math.max(1, (l.minsOut >= 0 ? l.minsOut : mins) - l.minsIn);
      p.fitness = clamp(Math.round(l.energy - 6), 20, 100);
      p.sharp = clamp(p.sharp + played / 12, 0, 100);
      const s = p.s;
      s.apps++; if (l.minsIn === 0) s.starts++;
      const cs = p.cs[this.fx.comp] ?? (p.cs[this.fx.comp] = [0, 0, 0]); cs[0]++; cs[1] += l.goals; cs[2] += l.assists;
      s.mins += played; s.goals += l.goals; s.assists += l.assists; s.shots += l.shots; s.passes += l.passOk; s.tackles += l.tackles; s.saves += l.saves; s.xg += l.xg;
      const r = res.ratings[l.id] ?? 6;
      s.ratingSum += r;
      if (res.motm === l.id) s.motm++;
      p.form = p.form * 0.7 + r * 0.3;
      p.morale = clamp(p.morale + (r - 6.5) * 2 + (res.motm === l.id ? 3 : 0), 5, 100);
      const conceded = l.side === 0 ? res.ag : res.hg;
      if (conceded === 0 && played >= 60 && (l.pos === 'GK' || l.pos === 'CB' || l.pos === 'LB' || l.pos === 'RB')) s.cleanSheets++;
      if (l.yellow && !l.off) { s.yellows++; p.yel++; if (p.yel % 5 === 0) p.ban += 1; }
      if (l.off) { s.reds++; p.ban += 1 + (rand() < 0.3 ? 1 : 0); }
      if ((l as LP & { injured?: boolean }).injured) {
        const inj = pick([['Hamstring strain', 14, 35], ['Ankle sprain', 7, 28], ['Knee ligament damage', 40, 120], ['Calf strain', 7, 21], ['Groin strain', 10, 28], ['Thigh bruise', 3, 10], ['Concussion', 7, 12], ['Broken foot', 45, 90], ['Muscle fatigue', 3, 8]] as [string, number, number][]);
        p.inj = { name: inj[0], days: Math.round(inj[1] + rand() * (inj[2] - inj[1]) * (rand() < 0.8 ? 0.5 : 1)) };
      }
    }
  }
}

function structuredCloneTactic(t: Tactic): Tactic {
  return { ...t, lineup: [...t.lineup], bench: [...t.bench], roles: [...t.roles] };
}

/** Quick result for clubs without full squads (abstract second-tier sims). */
export function poissonScore(sa: number, sb: number): [number, number] {
  const la = clamp(1.35 * Math.exp((sa - sb) * 0.06) + 0.15, 0.2, 4), lb = clamp(1.15 * Math.exp((sb - sa) * 0.06), 0.2, 4);
  const pois = (l: number) => { let k = 0, p = Math.exp(-l), s = p; const u = rand(); while (u > s && k < 10) { k++; p *= l / k; s += p; } return k; };
  return [pois(la), pois(lb)];
}
