// Madden-style ratings: ~40 attributes per player, an overall computed from a
// position formula over them, archetypes, development traits and abilities.
//
// Real players: the data import gives a target overall plus per-skill signals
// (0 = replacement, 1 = elite). Each attribute starts at the target and moves by
// how far the player's own signal sits from an average starter, so a great route
// runner with shaky hands gets high RTE and lower CTH. Physical attributes come
// from combine numbers and size. Skill attributes are then shifted together until
// the overall formula reproduces the target exactly.
import type { Attr, Attrs, Dev, Pos } from './types';
import { Rng, clamp } from './rng';

export const ATTRS: Attr[] = [
  'SPD', 'ACC', 'AGI', 'STR', 'JMP', 'STA', 'INJ', 'TGH', 'AWR',
  'CAR', 'BCV', 'BTK', 'TRK', 'ELU', 'CTH', 'CIT', 'SPC', 'RTE', 'RLS',
  'THP', 'SAC', 'MAC', 'DAC', 'TUP', 'TOR', 'PBK', 'RBK', 'IBL',
  'TAK', 'HIT', 'PUR', 'PRC', 'BSH', 'PMV', 'FMV', 'MCV', 'ZCV', 'PRS', 'KPW', 'KAC', 'RET',
];
export const ATTR_NAME: Record<Attr, string> = {
  SPD: 'Speed', ACC: 'Acceleration', AGI: 'Agility', STR: 'Strength', JMP: 'Jumping', STA: 'Stamina', INJ: 'Injury', TGH: 'Toughness', AWR: 'Awareness',
  CAR: 'Carrying', BCV: 'Ball Carrier Vision', BTK: 'Break Tackle', TRK: 'Trucking', ELU: 'Elusiveness',
  CTH: 'Catching', CIT: 'Catch in Traffic', SPC: 'Spectacular Catch', RTE: 'Route Running', RLS: 'Release',
  THP: 'Throw Power', SAC: 'Short Accuracy', MAC: 'Medium Accuracy', DAC: 'Deep Accuracy', TUP: 'Throw Under Pressure', TOR: 'Throw on the Run',
  PBK: 'Pass Block', RBK: 'Run Block', IBL: 'Impact Block',
  TAK: 'Tackle', HIT: 'Hit Power', PUR: 'Pursuit', PRC: 'Play Recognition', BSH: 'Block Shedding', PMV: 'Power Moves', FMV: 'Finesse Moves',
  MCV: 'Man Coverage', ZCV: 'Zone Coverage', PRS: 'Press', KPW: 'Kick Power', KAC: 'Kick Accuracy', RET: 'Return',
};
export const ATTR_GROUPS: [string, Attr[]][] = [
  ['Physical', ['SPD', 'ACC', 'AGI', 'STR', 'JMP', 'STA', 'INJ', 'TGH']],
  ['Mental', ['AWR', 'PRC']],
  ['Passing', ['THP', 'SAC', 'MAC', 'DAC', 'TUP', 'TOR']],
  ['Ball Carrier', ['CAR', 'BCV', 'BTK', 'TRK', 'ELU']],
  ['Receiving', ['CTH', 'CIT', 'SPC', 'RTE', 'RLS']],
  ['Blocking', ['PBK', 'RBK', 'IBL']],
  ['Defense', ['TAK', 'HIT', 'PUR', 'BSH', 'PMV', 'FMV', 'MCV', 'ZCV', 'PRS']],
  ['Special Teams', ['KPW', 'KAC', 'RET']],
];

/** Overall formula weights per position (Madden-style; normalised at use). */
export const OVR_W: Record<Pos, Partial<Record<Attr, number>>> = {
  QB: { AWR: 22, MAC: 14, SAC: 13, THP: 12, DAC: 10, TUP: 10, TOR: 6, SPD: 4, AGI: 3, ACC: 2 },
  RB: { BCV: 14, SPD: 13, ACC: 10, ELU: 10, BTK: 10, AGI: 8, CAR: 8, TRK: 6, AWR: 6, CTH: 6, RTE: 4, STR: 3 },
  FB: { RBK: 24, STR: 15, AWR: 12, PBK: 10, IBL: 8, TRK: 8, BTK: 7, CTH: 7, ACC: 5, SPD: 4 },
  WR: { RTE: 20, CTH: 14, SPD: 13, RLS: 8, CIT: 8, ACC: 8, AWR: 8, SPC: 7, AGI: 6, ELU: 4, JMP: 3 },
  TE: { CTH: 13, RTE: 13, RBK: 12, AWR: 10, SPD: 8, STR: 8, CIT: 8, ACC: 7, PBK: 6, SPC: 5, RLS: 5, BTK: 5 },
  OT: { PBK: 28, RBK: 20, STR: 14, AWR: 12, IBL: 7, AGI: 6, ACC: 6, TGH: 4 },
  G: { RBK: 26, PBK: 22, STR: 18, AWR: 12, IBL: 8, ACC: 6, AGI: 4 },
  C: { RBK: 24, PBK: 22, AWR: 16, STR: 16, IBL: 8, ACC: 6, AGI: 4 },
  EDGE: { FMV: 18, PMV: 15, BSH: 12, ACC: 12, SPD: 10, STR: 9, TAK: 9, PUR: 6, PRC: 6 },
  DT: { BSH: 18, STR: 16, PMV: 15, FMV: 9, TAK: 10, PRC: 9, AWR: 8, ACC: 7, PUR: 5, SPD: 3 },
  LB: { TAK: 14, PRC: 14, PUR: 12, ZCV: 10, BSH: 10, AWR: 10, SPD: 8, HIT: 7, ACC: 6, MCV: 5, PMV: 4 },
  CB: { MCV: 20, ZCV: 17, SPD: 15, PRC: 10, ACC: 8, AGI: 8, AWR: 8, PRS: 6, TAK: 5, JMP: 4, CTH: 3 },
  S: { ZCV: 18, PRC: 14, SPD: 12, MCV: 10, TAK: 10, AWR: 10, PUR: 8, HIT: 6, ACC: 6, CTH: 3, JMP: 3 },
  K: { KPW: 45, KAC: 45, AWR: 10 },
  P: { KPW: 50, KAC: 40, AWR: 10 },
  LS: { AWR: 40, STR: 30, PBK: 30 },
};

/**
 * Madden-style: the weighted mean of the position's attributes, stretched away
 * from 50 so a 96 overall can carry, say, a 93 throw power and an 88 deep ball
 * instead of needing every skill at the ceiling.
 */
export const OVR_STRETCH = 1.14;
export function overall(pos: Pos, a: Attrs): number {
  return Math.round(clamp(overallRaw(pos, a), 25, 99));
}

// ---- how stat signals feed attributes -----------------------------------------------
// [signal group, attribute, strength]
const SIG_MAP: Partial<Record<Pos, [string, Attr, number][]>> = {
  QB: [['acc', 'SAC', 1], ['acc', 'MAC', 0.9], ['acc', 'DAC', 0.5], ['arm', 'THP', 1], ['arm', 'DAC', 0.7], ['dec', 'AWR', 1], ['pocket', 'TUP', 1], ['run', 'TOR', 0.5], ['run', 'SPD', 0.5], ['run', 'AGI', 0.4], ['vol', 'AWR', 0.3], ['vol', 'MAC', 0.3]],
  RB: [['vision', 'BCV', 1], ['vision', 'AWR', 0.4], ['power', 'TRK', 1], ['power', 'BTK', 0.5], ['power', 'STR', 0.3], ['elusive', 'ELU', 1], ['elusive', 'BTK', 0.6], ['elusive', 'AGI', 0.4], ['hands', 'CTH', 1], ['hands', 'RTE', 0.6], ['security', 'CAR', 1], ['vol', 'BCV', 0.4], ['vol', 'STA', 0.6]],
  WR: [['route', 'RTE', 1], ['route', 'RLS', 0.6], ['route', 'AWR', 0.5], ['yac', 'ELU', 0.8], ['yac', 'BTK', 0.5], ['deep', 'SPC', 0.4], ['deep', 'SPD', 0.3], ['hands', 'CTH', 1], ['contested', 'CIT', 1], ['contested', 'SPC', 0.7], ['vol', 'RTE', 0.3], ['vol', 'AWR', 0.3]],
  EDGE: [['rush', 'FMV', 1], ['rush', 'PMV', 0.8], ['runD', 'BSH', 0.9], ['runD', 'PRC', 0.5], ['tackle', 'TAK', 1], ['tackle', 'PUR', 0.4], ['hit', 'HIT', 1], ['vol', 'FMV', 0.3], ['vol', 'PUR', 0.3]],
  LB: [['tackle', 'TAK', 1], ['tackle', 'PUR', 0.6], ['runD', 'BSH', 0.7], ['runD', 'PRC', 0.5], ['cover', 'ZCV', 1], ['cover', 'MCV', 0.7], ['rush', 'PMV', 0.6], ['ball', 'CTH', 0.6], ['ball', 'ZCV', 0.4], ['vol', 'PUR', 0.5], ['vol', 'PRC', 0.4]],
  CB: [['cover', 'MCV', 1], ['cover', 'ZCV', 0.9], ['cover', 'PRC', 0.4], ['ball', 'CTH', 0.8], ['ball', 'PRC', 0.5], ['ball', 'ZCV', 0.3], ['tackle', 'TAK', 1], ['vol', 'PRC', 0.3]],
  S: [['cover', 'ZCV', 1], ['cover', 'MCV', 0.6], ['ball', 'CTH', 0.7], ['ball', 'PRC', 0.6], ['tackle', 'TAK', 1], ['tackle', 'PUR', 0.5], ['runD', 'PRC', 0.4], ['runD', 'HIT', 0.4], ['rush', 'PMV', 0.4], ['vol', 'PUR', 0.3]],
  OT: [['pblock', 'PBK', 1], ['pblock', 'AWR', 0.3], ['rblock', 'RBK', 1], ['rblock', 'IBL', 0.5], ['disc', 'AWR', 0.6]],
  K: [['kacc', 'KAC', 1], ['kpow', 'KPW', 1]],
};
SIG_MAP.FB = SIG_MAP.RB; SIG_MAP.TE = SIG_MAP.WR; SIG_MAP.DT = SIG_MAP.EDGE; SIG_MAP.G = SIG_MAP.OT; SIG_MAP.C = SIG_MAP.OT; SIG_MAP.P = SIG_MAP.K;

// Typical physical profile per position: [SPD, ACC, AGI, STR, JMP] means.
const PHYS: Record<Pos, [number, number, number, number, number]> = {
  QB: [74, 80, 76, 60, 70], RB: [89, 90, 88, 70, 84], FB: [74, 78, 70, 80, 70], WR: [90, 89, 87, 57, 87], TE: [80, 82, 76, 73, 78],
  OT: [58, 68, 60, 89, 50], G: [55, 66, 56, 91, 48], C: [54, 66, 58, 88, 48], EDGE: [80, 84, 76, 81, 78], DT: [66, 76, 62, 91, 62],
  LB: [82, 85, 79, 76, 78], CB: [91, 90, 89, 55, 89], S: [88, 88, 84, 63, 86], K: [56, 60, 56, 45, 50], P: [55, 58, 55, 45, 50], LS: [52, 60, 54, 70, 48],
};

export interface RawPlayer {
  pos: Pos; ovr: number; age: number; ht?: number; wt?: number;
  forty?: number; bench?: number; vert?: number; cone?: number; broad?: number; shuttle?: number;
  sig?: Record<string, number>;
}

/** Build attributes for a player so that overall(pos, attrs) === target. */
export function buildAttrs(raw: RawPlayer, rng: Rng): Attrs {
  const { pos } = raw;
  const target = clamp(raw.ovr, 30, 99);
  const a = {} as Attrs;
  const w = OVR_W[pos];
  const [spd, acc, agi, str, jmp] = PHYS[pos];
  // Better players are, on average, better athletes too, but only partly.
  const tal = (target - 70) * 0.25;
  const ageSlow = raw.age > 27 ? (raw.age - 27) * 1.1 : 0;
  // Combine numbers anchor athleticism; production-proven players play faster than they timed.
  a.SPD = raw.forty ? 97 - (raw.forty - 4.28) * 58 - ageSlow + Math.max(0, tal) * 0.5 : spd + tal + rng.normal(0, 3) - ageSlow;
  a.ACC = raw.forty ? a.SPD * 0.55 + acc * 0.45 : acc + tal + rng.normal(0, 3) - ageSlow * 0.8;
  a.AGI = raw.cone ? 96 - (raw.cone - 6.6) * 30 - ageSlow * 0.8 : agi + tal + rng.normal(0, 3) - ageSlow * 0.8;
  a.STR = str + Math.max(0, tal) * 0.4 + (raw.bench ? (raw.bench - 20) * 0.6 : 0) + ((raw.wt ?? 0) && pos !== 'K' && pos !== 'P' ? ((raw.wt! - avgWt(pos)) * 0.18) : 0) + rng.normal(0, 3);
  a.JMP = raw.vert ? 50 + (raw.vert - 26) * 3 : jmp + tal * 0.5 + rng.normal(0, 3);
  a.STA = 80 + rng.normal(0, 5) - (raw.age > 30 ? (raw.age - 30) * 1.5 : 0);
  a.INJ = 84 + rng.normal(0, 6) - (raw.age > 29 ? (raw.age - 29) * 2 : 0);
  a.TGH = 82 + rng.normal(0, 6);
  // Everything else starts at the target for the position's skills and low elsewhere.
  for (const k of ATTRS) {
    if (a[k] !== undefined) continue;
    a[k] = w[k] ? 50 + (target - 50) / OVR_STRETCH + rng.normal(0, 3) : offPositionBase(pos, k, rng);
  }
  // Mental skill grows with experience.
  a.AWR = 50 + (target - 50) / OVR_STRETCH + Math.min(6, (raw.age - 24) * 1.2) + rng.normal(0, 2);
  // Stat signals push individual skills away from the target.
  for (const [grp, attr, s] of SIG_MAP[pos] ?? []) {
    const v = raw.sig?.[grp];
    if (v === undefined) continue;
    a[attr] += clamp((v - 0.35) * 26 * s, -15, 15);
  }
  // Shift the skill (non-physical) attributes until the formula hits the target.
  const physical = new Set<Attr>(['SPD', 'ACC', 'AGI', 'STR', 'JMP', 'STA', 'INJ', 'TGH']);
  for (const k of ATTRS) a[k] = clamp(a[k], 15, 99);
  for (let i = 0; i < 8; i++) {
    const diff = target - overallRaw(pos, a);
    if (Math.abs(diff) < 0.25) break;
    let skillW = 0, total = 0;
    for (const k in w) { total += w[k as Attr]!; if (!physical.has(k as Attr)) skillW += w[k as Attr]!; }
    const step = (diff / OVR_STRETCH) * total / Math.max(1, skillW);
    for (const k in w) if (!physical.has(k as Attr)) a[k as Attr] = clamp(a[k as Attr] + step, 15, 99);
  }
  for (const k of ATTRS) a[k] = Math.round(a[k]);
  return a;
}

function overallRaw(pos: Pos, a: Attrs) {
  const w = OVR_W[pos];
  let s = 0, t = 0;
  for (const k in w) { const wk = w[k as Attr]!; s += a[k as Attr] * wk; t += wk; }
  return 50 + (s / t - 50) * OVR_STRETCH;
}
function avgWt(pos: Pos) {
  return { QB: 220, RB: 210, FB: 245, WR: 200, TE: 250, OT: 315, G: 315, C: 305, EDGE: 255, DT: 305, LB: 238, CB: 192, S: 205, K: 195, P: 210, LS: 240 }[pos];
}
function offPositionBase(pos: Pos, k: Attr, rng: Rng): number {
  const r = (m: number) => m + rng.normal(0, 5);
  const off = ['QB', 'RB', 'FB', 'WR', 'TE', 'OT', 'G', 'C'].includes(pos);
  if (k === 'RET') return ['WR', 'RB', 'CB', 'S'].includes(pos) ? r(55) : r(15);
  if (k === 'KPW' || k === 'KAC') return r(20);
  if (['THP', 'SAC', 'MAC', 'DAC', 'TUP', 'TOR'].includes(k)) return r(pos === 'QB' ? 60 : 22);
  if (['TAK', 'HIT', 'PUR', 'PRC', 'BSH', 'PMV', 'FMV', 'MCV', 'ZCV', 'PRS'].includes(k)) return r(off ? 30 : 50);
  if (['PBK', 'RBK', 'IBL'].includes(k)) return r(['TE', 'FB', 'RB'].includes(pos) ? 50 : off ? 35 : 30);
  if (['CTH', 'CIT', 'SPC', 'RTE', 'RLS'].includes(k)) return r(['RB', 'TE', 'FB'].includes(pos) ? 58 : off ? 40 : 45);
  if (['CAR', 'BCV', 'BTK', 'TRK', 'ELU'].includes(k)) return r(['WR', 'TE', 'QB'].includes(pos) ? 60 : off ? 40 : 45);
  return r(45);
}

// ---- archetypes -------------------------------------------------------------------------
const ARCH: Record<Pos, [string, (a: Attrs) => number][]> = {
  QB: [['Field General', a => a.AWR + a.MAC], ['Strong Arm', a => a.THP * 2 - 10], ['Scrambler', a => a.SPD * 2.1 - 25], ['Improviser', a => a.TOR + a.TUP + 4]],
  RB: [['Power Back', a => a.TRK + a.STR + 8], ['Elusive Back', a => a.ELU + a.AGI], ['Receiving Back', a => a.CTH + a.RTE + 6]],
  FB: [['Blocking', a => a.RBK * 2], ['Utility', a => a.CTH + a.BTK + 12]],
  WR: [['Deep Threat', a => a.SPD * 2 - 4], ['Route Runner', a => a.RTE * 2], ['Physical', a => a.CIT + a.STR + 22], ['Slot', a => a.AGI + a.CTH - 6]],
  TE: [['Vertical Threat', a => a.SPD + a.RTE + 6], ['Possession', a => a.CTH + a.CIT], ['Blocking', a => a.RBK * 2 + 4]],
  OT: [['Pass Protector', a => a.PBK * 2], ['Power', a => a.RBK + a.STR - 2], ['Agile', a => a.AGI + a.ACC + 30]],
  G: [['Power', a => a.RBK + a.STR], ['Pass Protector', a => a.PBK * 2], ['Agile', a => a.AGI + a.ACC + 30]],
  C: [['Power', a => a.RBK + a.STR], ['Pass Protector', a => a.PBK * 2], ['Agile', a => a.AGI + a.ACC + 30]],
  EDGE: [['Speed Rusher', a => a.FMV + a.SPD], ['Power Rusher', a => a.PMV + a.STR - 4], ['Run Stopper', a => a.BSH + a.TAK - 6]],
  DT: [['Power Rusher', a => a.PMV + a.STR - 8], ['Speed Rusher', a => a.FMV + a.ACC], ['Run Stopper', a => a.BSH + a.STR - 4]],
  LB: [['Field General', a => a.PRC + a.AWR], ['Pass Coverage', a => a.ZCV + a.SPD - 4], ['Run Stopper', a => a.BSH + a.TAK]],
  CB: [['Man to Man', a => a.MCV * 2], ['Zone', a => a.ZCV * 2], ['Slot', a => a.AGI + a.ZCV - 6]],
  S: [['Zone', a => a.ZCV * 2], ['Run Support', a => a.TAK + a.HIT], ['Hybrid', a => a.MCV + a.PRC + 2]],
  K: [['Power', a => a.KPW * 2], ['Accuracy', a => a.KAC * 2]],
  P: [['Power', a => a.KPW * 2], ['Accuracy', a => a.KAC * 2]],
  LS: [['Long Snapper', () => 1]],
};
export function archetype(pos: Pos, a: Attrs): string {
  let best = '', bv = -Infinity;
  for (const [name, f] of ARCH[pos]) { const v = f(a); if (v > bv) { bv = v; best = name; } }
  return best;
}

// ---- development, potential, abilities ---------------------------------------------------
export const DEV_MULT: Record<Dev, number> = { Normal: 0.5, Star: 0.75, Superstar: 1, 'X-Factor': 1 };

/** Development trait: driven by how good a player already is for his age. */
export function devTrait(ovr: number, age: number, rng: Rng): Dev {
  const s = ovr + (26 - age) * 2.2 + rng.normal(0, 3);
  if (s >= 99 && ovr >= 88) return 'X-Factor';
  if (s >= 90) return 'Superstar';
  if (s >= 81) return 'Star';
  return 'Normal';
}
/** Hidden ceiling. Young players have room; veterans are what they are. */
export function potential(ovr: number, age: number, dev: Dev, rng: Rng): number {
  const room = age <= 22 ? 14 : age <= 24 ? 9 : age <= 26 ? 5 : age <= 28 ? 2 : 0;
  const m = { Normal: 0.6, Star: 0.9, Superstar: 1.15, 'X-Factor': 1.3 }[dev];
  return Math.round(clamp(ovr + room * m + rng.normal(0, 2), ovr, 99));
}

/** Superstar abilities; the sim reads them by name. */
export const ABILITIES: Record<string, { pos: Pos[]; desc: string; needs: (a: Attrs) => boolean }> = {
  Bazooka: { pos: ['QB'], desc: 'Deep passes travel farther and stay accurate', needs: a => a.THP >= 90 },
  Fearless: { pos: ['QB'], desc: 'Accuracy holds up under pressure', needs: a => a.TUP >= 85 },
  'Pocket Presence': { pos: ['QB'], desc: 'Feels the rush; fewer sacks', needs: a => a.AWR >= 88 },
  'Escape Artist': { pos: ['QB'], desc: 'Extends plays and scrambles for big gains', needs: a => a.SPD >= 82 },
  Gunslinger: { pos: ['QB'], desc: 'Fits throws into tight windows', needs: a => a.THP >= 86 && a.DAC >= 82 },
  Bruiser: { pos: ['RB', 'FB'], desc: 'Breaks first contact far more often', needs: a => a.TRK >= 85 },
  'Ankle Breaker': { pos: ['RB', 'WR'], desc: 'Makes defenders miss in space', needs: a => a.ELU >= 88 },
  Breakaway: { pos: ['RB'], desc: 'Long runs finish in the end zone', needs: a => a.SPD >= 91 },
  'Ball Security': { pos: ['RB'], desc: 'Rarely fumbles', needs: a => a.CAR >= 88 },
  'Route Technician': { pos: ['WR', 'TE'], desc: 'Wins with clean breaks; more separation', needs: a => a.RTE >= 88 },
  'Sure Hands': { pos: ['WR', 'TE', 'RB'], desc: 'Almost never drops a catchable ball', needs: a => a.CTH >= 88 },
  'Deep Threat': { pos: ['WR', 'TE'], desc: 'Gets behind the defence on vertical routes', needs: a => a.SPD >= 93 },
  'Contested Catch': { pos: ['WR', 'TE'], desc: 'Wins 50-50 balls', needs: a => a.CIT >= 87 },
  'YAC Monster': { pos: ['WR', 'TE', 'RB'], desc: 'Extra yards after the catch', needs: a => a.ELU >= 84 && a.BTK >= 78 },
  Anchor: { pos: ['OT', 'G', 'C'], desc: 'Stonewalls bull rushes', needs: a => a.PBK >= 88 && a.STR >= 90 },
  'Road Grader': { pos: ['OT', 'G', 'C', 'TE', 'FB'], desc: 'Opens big running lanes', needs: a => a.RBK >= 88 },
  'Edge Threat': { pos: ['EDGE'], desc: 'Beats tackles off the edge quickly', needs: a => a.FMV >= 88 },
  'Inside Pressure': { pos: ['DT'], desc: 'Collapses the pocket from the interior', needs: a => a.PMV >= 88 },
  'Run Stuffer': { pos: ['DT', 'EDGE', 'LB'], desc: 'Sheds blocks and stops runs for no gain', needs: a => a.BSH >= 87 },
  'Strip Specialist': { pos: ['EDGE', 'DT', 'LB', 'S'], desc: 'Forces fumbles', needs: a => a.HIT >= 85 },
  Lurker: { pos: ['LB', 'S'], desc: 'Jumps short and intermediate routes', needs: a => a.ZCV >= 85 },
  Shutdown: { pos: ['CB'], desc: 'Smothers receivers in man coverage', needs: a => a.MCV >= 90 },
  'Zone Hawk': { pos: ['CB', 'S'], desc: 'Reads the quarterback and breaks on the ball', needs: a => a.ZCV >= 88 },
  'Ball Hawk': { pos: ['CB', 'S'], desc: 'Turns deflections into interceptions', needs: a => a.CTH >= 70 && a.PRC >= 85 },
  Enforcer: { pos: ['S', 'LB'], desc: 'Big hits jar the ball loose and cause drops', needs: a => a.HIT >= 88 },
  'Big Leg': { pos: ['K', 'P'], desc: 'Extra distance', needs: a => a.KPW >= 90 },
  'Ice Veins': { pos: ['K'], desc: 'Clutch kicks do not waver', needs: a => a.KAC >= 88 },
};
/** X-Factor zone abilities: activate after a hot streak in a game, lost on a knockout. */
export const XFACTORS: Record<Pos | 'ANY', string> = {
  QB: 'Bottomless Clip', RB: 'Freight Train', FB: 'Freight Train', WR: 'Double Me', TE: 'Mismatch', OT: 'Wall', G: 'Wall', C: 'Wall',
  EDGE: 'Unstoppable Force', DT: 'Avalanche', LB: 'Heat Seeker', CB: 'Shutdown Zone', S: 'Center Field', K: 'Clutch', P: 'Coffin Corner', LS: 'Wall', ANY: 'Takeover',
};
export const XFACTOR_DESC: Record<string, string> = {
  'Bottomless Clip': 'In the zone, every throw is on target and pressure is ignored',
  'Freight Train': 'In the zone, first contact never brings him down',
  'Double Me': 'In the zone, wins every contested catch',
  Mismatch: 'In the zone, linebackers and safeties cannot cover him',
  Wall: 'In the zone, no pressure is allowed on his side',
  'Unstoppable Force': 'In the zone, wins most pass-rush reps',
  Avalanche: 'In the zone, collapses the pocket on every rep',
  'Heat Seeker': 'In the zone, never misses a tackle',
  'Shutdown Zone': 'In the zone, his receiver is never open',
  'Center Field': 'In the zone, deep throws become interceptions',
  Clutch: 'In the zone, makes every kick',
  'Coffin Corner': 'In the zone, every punt is downed inside the 10',
  Takeover: 'In the zone, plays at an elite level',
};

export function assignAbilities(pos: Pos, a: Attrs, dev: Dev, rng: Rng): { abil: string[]; xf?: string } {
  if (dev === 'Normal' || dev === 'Star') return { abil: [] };
  const fit = Object.entries(ABILITIES).filter(([, v]) => v.pos.includes(pos) && v.needs(a)).map(([k]) => k);
  rng.shuffle(fit);
  const n = dev === 'X-Factor' ? 3 : 2;
  return { abil: fit.slice(0, n), xf: dev === 'X-Factor' ? XFACTORS[pos] : undefined };
}

export const POS_ORDER: Pos[] = ['QB', 'RB', 'FB', 'WR', 'TE', 'OT', 'G', 'C', 'EDGE', 'DT', 'LB', 'CB', 'S', 'K', 'P', 'LS'];
export const POS_NAME: Record<Pos, string> = {
  QB: 'Quarterback', RB: 'Running Back', FB: 'Fullback', WR: 'Wide Receiver', TE: 'Tight End', OT: 'Offensive Tackle', G: 'Guard', C: 'Center',
  EDGE: 'Edge Rusher', DT: 'Defensive Tackle', LB: 'Linebacker', CB: 'Cornerback', S: 'Safety', K: 'Kicker', P: 'Punter', LS: 'Long Snapper',
};
