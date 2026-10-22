import { A, GROUPS, type Player, type Pos, emptyStats } from './types';
import { clamp, makeRng, rand, pick, chance } from './rng';
import { NAMES, regionOf } from '../data/nations';

// Overall weights per position over the detailed attributes (FC-style formulas).
const W: Record<Pos, Partial<Record<keyof typeof A, number>>> = {
  ST: { fin: 18, pos: 13, hea: 10, shp: 10, rea: 8, dri: 7, bc: 10, vol: 2, lon: 3, acc: 4, spd: 5, str: 5, spa: 5 },
  LW: { cro: 9, dri: 16, bc: 14, spa: 9, lon: 4, acc: 7, spd: 6, rea: 7, pos: 9, vis: 6, fin: 10, agi: 3 },
  RW: { cro: 9, dri: 16, bc: 14, spa: 9, lon: 4, acc: 7, spd: 6, rea: 7, pos: 9, vis: 6, fin: 10, agi: 3 },
  LM: { cro: 10, dri: 15, bc: 13, spa: 11, lon: 5, acc: 7, spd: 6, rea: 7, pos: 8, vis: 7, stm: 5, fin: 6 },
  RM: { cro: 10, dri: 15, bc: 13, spa: 11, lon: 5, acc: 7, spd: 6, rea: 7, pos: 8, vis: 7, stm: 5, fin: 6 },
  CAM: { spa: 16, vis: 14, bc: 15, pos: 9, dri: 13, rea: 7, lon: 5, fin: 7, shp: 5, agi: 3, acc: 4, com: 2 },
  CM: { spa: 17, lpa: 13, vis: 13, bc: 14, dri: 7, int: 5, pos: 6, rea: 8, sta: 5, stm: 6, lon: 4, com: 2 },
  CDM: { spa: 14, lpa: 10, int: 14, sta: 12, def: 10, bc: 10, rea: 7, agg: 5, str: 6, vis: 4, stm: 6, com: 2 },
  LB: { acc: 5, spd: 7, cro: 9, int: 12, bc: 7, def: 8, sta: 11, sli: 14, spa: 7, rea: 8, stm: 8, hea: 4 },
  RB: { acc: 5, spd: 7, cro: 9, int: 12, bc: 7, def: 8, sta: 11, sli: 14, spa: 7, rea: 8, stm: 8, hea: 4 },
  CB: { hea: 10, def: 14, sta: 17, sli: 13, int: 13, str: 10, agg: 7, rea: 5, spa: 5, bc: 4, spd: 2, jum: 3 },
  GK: { gkd: 21, gkh: 21, gkk: 5, gkp: 21, gkr: 21, rea: 11 },
};
const WI: Record<Pos, [number, number][]> = {} as never;
for (const p of Object.keys(W) as Pos[]) {
  const tot = Object.values(W[p]).reduce((a, b) => a + (b ?? 0), 0);
  WI[p] = Object.entries(W[p]).map(([k, v]) => [A[k as keyof typeof A], (v ?? 0) / tot]);
}

export function posOvr(attrs: number[], pos: Pos): number {
  let s = 0;
  for (const [i, w] of WI[pos]) s += attrs[i] * w;
  return Math.round(clamp(s, 1, 99));
}

export const ALL_POS: Pos[] = ['GK', 'CB', 'RB', 'LB', 'CDM', 'CM', 'CAM', 'RM', 'LM', 'RW', 'LW', 'ST'];

/** Natural familiarity between positions (1 = native, 0 = unfamiliar). */
export function familiarity(p: Player, slot: Pos): number {
  if (p.pos === slot) return 1;
  if (p.alt.includes(slot)) return 0.97;
  const near: Record<Pos, Pos[]> = {
    GK: [], CB: ['CDM', 'RB', 'LB'], RB: ['RM', 'CB', 'LB', 'RW'], LB: ['LM', 'CB', 'RB', 'LW'], CDM: ['CM', 'CB'], CM: ['CDM', 'CAM', 'RM', 'LM'],
    CAM: ['CM', 'ST', 'LW', 'RW'], RM: ['RW', 'RB', 'CM', 'LM'], LM: ['LW', 'LB', 'CM', 'RM'], RW: ['RM', 'LW', 'ST', 'CAM'], LW: ['LM', 'RW', 'ST', 'CAM'], ST: ['CAM', 'LW', 'RW'],
  };
  if (slot === 'GK' || p.pos === 'GK') return 0.35;
  return near[p.pos].includes(slot) ? 0.9 : 0.78;
}

/** Card face stats. */
export function faceStats(p: Player): [string, number][] {
  if (p.pos === 'GK') {
    const a = p.attrs;
    return [['DIV', a[A.gkd]], ['HAN', a[A.gkh]], ['KIC', a[A.gkk]], ['REF', a[A.gkr]], ['SPD', Math.round((a[A.acc] + a[A.spd]) / 2)], ['POS', a[A.gkp]]];
  }
  return (Object.keys(GROUPS) as (keyof typeof GROUPS)[]).map(g => [g, groupVal(p.attrs, g)]);
}
export function groupVal(attrs: number[], g: keyof typeof GROUPS) {
  const ix = GROUPS[g];
  if (g === 'PAC') return Math.round(attrs[0] * 0.45 + attrs[1] * 0.55);
  return Math.round(ix.reduce((s, i) => s + attrs[i], 0) / ix.length);
}

// Card-stat offsets from overall per archetype [PAC, SHO, PAS, DRI, DEF, PHY]
const ARCH: Record<string, [number, number, number, number, number, number][]> = {
  ST: [[3, 4, -12, -2, -50, -6], [-12, 2, -14, -8, -45, 6], [0, 3, -6, 1, -48, 0]],
  W: [[8, -6, -6, 3, -50, -14], [0, -4, -2, 4, -52, -16]],
  CAM: [[-4, -4, 2, 4, -45, -14], [2, -2, 0, 5, -48, -16]],
  CM: [[-6, -10, -1, -2, -12, 2], [-12, -12, 3, 1, -20, -10], [-4, -6, 0, 0, -18, -4]],
  CDM: [[-14, -22, -6, -8, 0, 3], [-16, -20, -2, -6, -2, -2]],
  CB: [[-14, -45, -28, -24, 3, 5], [-10, -45, -18, -16, 2, 0], [-4, -48, -24, -20, 2, 2]],
  FB: [[4, -30, -8, -6, -4, -5], [-2, -32, -4, -4, -2, -6]],
};
const archKey = (p: Pos) => p === 'ST' ? 'ST' : (p === 'RW' || p === 'LW' || p === 'RM' || p === 'LM') ? 'W' : p === 'CAM' ? 'CAM' : p === 'CM' ? 'CM' : p === 'CDM' ? 'CDM' : p === 'CB' ? 'CB' : 'FB';

/** Optional card-stat hints for well-known profiles so stars play like themselves. */
export const HINTS: Record<string, Partial<Record<'PAC' | 'SHO' | 'PAS' | 'DRI' | 'DEF' | 'PHY', number>>> = {
  'Kylian Mbappé': { PAC: 97, SHO: 90, DRI: 92 }, 'Vinícius Júnior': { PAC: 95, DRI: 91, SHO: 84 }, 'Erling Haaland': { PAC: 89, SHO: 94, PHY: 88, PAS: 66, DRI: 80 },
  'Mohamed Salah': { PAC: 88, SHO: 88, PAS: 84, DRI: 88 }, 'Lamine Yamal': { PAC: 84, DRI: 93, PAS: 86, SHO: 80 }, 'Jérémy Doku': { PAC: 93, DRI: 89, SHO: 68 },
  'Rafael Leão': { PAC: 93, DRI: 88 }, 'Achraf Hakimi': { PAC: 93, PAS: 82, DEF: 79 }, 'Alphonso Davies': { PAC: 95 }, 'Jeremie Frimpong': { PAC: 94 },
  'Virgil van Dijk': { DEF: 91, PHY: 86, PAC: 78 }, 'Rodri': { PAS: 86, DEF: 86, PHY: 84 }, 'Kevin De Bruyne': { PAS: 92, SHO: 85 }, 'Harry Kane': { SHO: 93, PAS: 84, PAC: 66, DRI: 83 },
  'Jude Bellingham': { DRI: 87, PHY: 84, SHO: 84 }, 'Pedri': { PAS: 89, DRI: 90 }, 'Luka Modrić': { PAS: 88, DRI: 86, PAC: 64 }, 'Ousmane Dembélé': { PAC: 92, DRI: 90, SHO: 87 },
  'Bukayo Saka': { PAC: 85, DRI: 88, PAS: 84 }, 'Florian Wirtz': { DRI: 90, PAS: 88 }, 'Jamal Musiala': { DRI: 92, PAS: 83 }, 'Michael Olise': { DRI: 89, PAS: 87 },
  'Cristiano Ronaldo': { SHO: 90, PAC: 76, PHY: 78 }, 'Lionel Messi': { DRI: 91, PAS: 90, SHO: 86, PAC: 70 }, 'Robert Lewandowski': { SHO: 89, PAC: 70 },
  'Federico Valverde': { PHY: 86, PAC: 86 }, 'Declan Rice': { DEF: 84, PHY: 84 }, 'William Saliba': { DEF: 88, PAC: 83 }, 'Nuno Mendes': { PAC: 92 },
  'Khvicha Kvaratskhelia': { DRI: 90, PAC: 85 }, 'Raphinha': { PAC: 89, SHO: 85, PAS: 84 }, 'Désiré Doué': { DRI: 88, PAC: 86 }, 'Victor Osimhen': { PAC: 88, SHO: 87, PHY: 82 },
  'Marcus Thuram': { PAC: 86, PHY: 84 }, 'Nico Williams': { PAC: 92, DRI: 88 }, 'Lautaro Martínez': { SHO: 88, PHY: 80 }, 'Bruno Fernandes': { PAS: 89, SHO: 85 },
  'Martin Ødegaard': { PAS: 89, DRI: 88 }, 'Cole Palmer': { SHO: 86, PAS: 86, DRI: 88 }, 'Rodrygo': { PAC: 89, DRI: 88 }, 'Luis Díaz': { PAC: 90, DRI: 88 },
};

export const ageOf = (p: Player, season: number) => season - p.born;

/** Build attributes so the native-position overall lands exactly on target. */
export function buildAttrs(pos: Pos, ovr: number, seed: number, hints?: Partial<Record<string, number>>): number[] {
  const r = makeRng(seed);
  const g = () => (r() + r() + r() - 1.5) * 2;
  const attrs = new Array(34).fill(0);
  if (pos === 'GK') {
    for (let i = 29; i < 34; i++) attrs[i] = ovr + g() * 3;
    attrs[A.gkk] = ovr - 8 + g() * 6;
    attrs[A.rea] = ovr + g() * 3;
    for (let i = 0; i < 29; i++) if (i !== A.rea) attrs[i] = 30 + r() * 25;
    attrs[A.com] = ovr - 15 + g() * 6; attrs[A.spa] = ovr - 30 + g() * 8; attrs[A.lpa] = ovr - 25 + g() * 8;
    attrs[A.jum] = ovr - 15 + g() * 8; attrs[A.str] = ovr - 15 + g() * 8; attrs[A.acc] = 40 + r() * 20; attrs[A.spd] = 40 + r() * 20;
  } else {
    const set = ARCH[archKey(pos)];
    const arch = set[Math.floor(r() * set.length)];
    const keys = ['PAC', 'SHO', 'PAS', 'DRI', 'DEF', 'PHY'] as const;
    keys.forEach((k, gi) => {
      const target = hints?.[k] ?? ovr + arch[gi] + g() * 3;
      for (const i of GROUPS[k]) attrs[i] = target + g() * 5;
    });
    attrs[A.rea] = ovr - 2 + g() * 3;
    attrs[A.com] = ovr - 4 + g() * 5;
    attrs[A.stm] = 60 + r() * 30;
    for (let i = 29; i < 34; i++) attrs[i] = 6 + r() * 10;
    if (pos === 'CB') { attrs[A.hea] = attrs[A.def] + g() * 3; attrs[A.jum] += 5; }
    if (pos === 'ST' && arch[5] > 0) { attrs[A.hea] = ovr + 2 + g() * 3; attrs[A.jum] = ovr + g() * 4; }
    if (pos === 'RB' || pos === 'LB') attrs[A.cro] = ovr - 6 + g() * 5;
  }
  // nudge everything so the positional overall hits the target
  // hinted groups stay put; the remaining weighted attributes absorb the difference
  const locked = new Set<number>();
  if (hints && pos !== 'GK') for (const k of Object.keys(hints)) for (const i of GROUPS[k as keyof typeof GROUPS] ?? []) locked.add(i);
  const free = WI[pos].filter(([i]) => !locked.has(i));
  const adj = free.length >= 3 ? free : WI[pos];
  const share = adj.reduce((t, [, wt]) => t + wt, 0);
  const cap = ovr + 6;
  for (let it = 0; it < 8; it++) {
    const d = ovr - posOvrRaw(attrs, pos);
    if (Math.abs(d) < 0.3) break;
    for (const [i] of adj) attrs[i] = Math.min(d > 0 ? Math.max(cap, attrs[i]) : 99, attrs[i] + d / share * 0.9);
  }
  for (let it = 0; it < 8; it++) {
    const d = ovr - posOvrRaw(attrs, pos);
    if (Math.abs(d) < 0.3) break;
    for (const [i] of WI[pos]) attrs[i] = Math.min(99, attrs[i] + d * 1.05);
  }
  return attrs.map(v => Math.round(clamp(v, 10, 99)));
}
function posOvrRaw(attrs: number[], pos: Pos) { let s = 0; for (const [i, w] of WI[pos]) s += attrs[i] * w; return s; }

export function altPositions(pos: Pos): Pos[] {
  const m: Record<Pos, Pos[][]> = {
    GK: [[]], CB: [[], ['CDM'], ['RB']], RB: [[], ['RM'], ['CB']], LB: [[], ['LM'], ['CB']], CDM: [['CM'], ['CB'], ['CM']], CM: [['CDM'], ['CAM'], ['CDM', 'CAM']],
    CAM: [['CM'], ['ST'], ['LW', 'RW']], RM: [['RW'], ['RW', 'RB']], LM: [['LW'], ['LW', 'LB']], RW: [['RM'], ['LW'], ['ST']], LW: [['LM'], ['RW'], ['ST']], ST: [[], ['CAM'], ['LW']],
  };
  return pick(m[pos]);
}

/** Potential: young players get headroom, the rest settle near their current level. */
export function rollPotential(ovr: number, age: number, quality = 0): number {
  if (age >= 30) return ovr;
  const room = age <= 18 ? 16 : age <= 20 ? 12 : age <= 22 ? 8 : age <= 24 ? 5 : age <= 26 ? 2.5 : 1;
  return Math.round(clamp(ovr + room * (0.55 + rand() * 0.9) + quality, ovr, 95));
}

// ---- Money ---------------------------------------------------------------------------
export function marketValue(p: Player, season: number): number {
  const age = ageOf(p, season);
  const eff = age <= 23 ? p.ovr + (p.pot - p.ovr) * (age <= 19 ? 0.4 : age <= 21 ? 0.32 : 0.2) : p.ovr;
  let v = 150e6 * Math.pow(1.163, eff - 90);
  const af = age <= 26 ? 1 : age === 27 ? 0.95 : age === 28 ? 0.85 : age === 29 ? 0.72 : age === 30 ? 0.58 : age === 31 ? 0.45 : age === 32 ? 0.34 : age === 33 ? 0.24 : 0.14;
  v *= af;
  if (p.pos === 'GK') v *= 0.68; else if (p.pos === 'CB' || p.pos === 'CDM') v *= 0.9; else if (p.pos === 'ST' || p.pos === 'LW' || p.pos === 'RW' || p.pos === 'CAM') v *= 1.08;
  const yrs = p.contract - season;
  if (yrs <= 0) v *= 0.55; else if (yrs === 1) v *= 0.8;
  return roundMoney(Math.max(v, 25000));
}
export function roundMoney(v: number) {
  if (v >= 10e6) return Math.round(v / 5e5) * 5e5;
  if (v >= 1e6) return Math.round(v / 1e5) * 1e5;
  return Math.round(v / 5e3) * 5e3;
}
export function fairWage(p: Player, clubRep: number, season: number): number {
  const age = ageOf(p, season);
  let w = 380e3 * Math.pow(1.15, p.ovr - 90);
  w *= 0.55 + clubRep / 110;
  if (age <= 20) w *= 0.6; else if (age >= 32) w *= 0.85;
  return Math.max(1500, Math.round(w / 500) * 500);
}

// ---- Names ---------------------------------------------------------------------------
export function genName(nat: string): string {
  const reg = regionOf(nat);
  const pool = NAMES[reg] ?? NAMES.brit!;
  if (reg === 'braz' && chance(0.25)) return pick(pool[0]) + (chance(0.5) ? '' : ' ' + pick(['Júnior', 'Henrique', 'Augusto', 'Paulo']));
  return `${pick(pool[0])} ${pick(pool[1])}`;
}

export function newPlayerShell(id: number, name: string, nat: string, pos: Pos, born: number, ovr: number, pot: number, real: boolean, seed: number): Player {
  const attrs = buildAttrs(pos, ovr, seed, real ? HINTS[name] : undefined);
  const r = makeRng(seed ^ 0x9e3779b9);
  const height = pos === 'GK' ? 186 + Math.round(r() * 12) : pos === 'CB' ? 182 + Math.round(r() * 12) : pos === 'ST' ? 174 + Math.round(r() * 18) : 168 + Math.round(r() * 18);
  const left = pos === 'LB' || pos === 'LM' ? r() < 0.75 : pos === 'RW' ? r() < 0.4 : r() < 0.22;
  const p: Player = {
    id, name, nat, pos, alt: pos === 'GK' ? [] : altPositions(pos), born, club: null, attrs, ovr: 0, pot, foot: left ? 'L' : 'R',
    wf: 2 + Math.floor(r() * 3.2), sm: pos === 'GK' ? 1 : Math.max(1, Math.min(5, Math.round(attrs[A.dri] / 22 + r() - 0.4))),
    height, num: 0, wage: 0, contract: 0, morale: 70, fitness: 100, sharp: 70, form: 6.6, ban: 0, yel: 0, real, traits: [],
    s: emptyStats(), cs: {}, career: [], valueHist: [],
  };
  p.ovr = posOvr(attrs, pos);
  p.pot = Math.max(p.pot, p.ovr);
  p.traits = rollTraits(p);
  return p;
}

export function rollTraits(p: Player): string[] {
  const a = p.attrs, t: string[] = [];
  if (p.pos === 'GK') { if (a[A.gkr] >= 86) t.push('Cat Reflexes'); if (a[A.gkk] >= 80) t.push('Sweeper Keeper'); return t; }
  if (a[A.spd] >= 90) t.push('Rapid');
  if (a[A.fin] >= 86) t.push('Finesse Shot');
  if (a[A.shp] >= 87 && a[A.lon] >= 82) t.push('Power Shot');
  if (a[A.vis] >= 86 && a[A.spa] >= 85) t.push('Incisive Pass');
  if (a[A.dri] >= 88 && a[A.agi] >= 85) t.push('Technical');
  if (a[A.hea] >= 85 && a[A.jum] >= 80) t.push('Aerial Threat');
  if (a[A.sta] >= 86) t.push('Anticipate');
  if (a[A.str] >= 87) t.push('Bruiser');
  if (a[A.stm] >= 90) t.push('Relentless');
  if (a[A.fka] >= 84) t.push('Dead Ball');
  if (a[A.cro] >= 85) t.push('Whipped Cross');
  return t.slice(0, 4);
}

/** Weekly development: growth for the young, decline for veterans, nudged by minutes and form. */
export function develop(p: Player, season: number, weeks: number, facilities: number) {
  const age = ageOf(p, season);
  const played = p.s.mins / Math.max(1, (p.s.apps + 3) * 90);
  let rate = 0;
  if (p.ovr < p.pot) rate = (age <= 20 ? 0.11 : age <= 23 ? 0.085 : age <= 26 ? 0.05 : 0.025) * (0.6 + played * 0.8 + (p.form - 6.5) * 0.25) * (0.85 + facilities * 0.03);
  if (age >= 30) rate -= (age - 29) * 0.012 + (age >= 33 ? 0.04 : 0);
  const delta = rate * weeks;
  if (Math.abs(delta) < 0.001) return;
  applyGrowth(p, delta);
}
export function applyGrowth(p: Player, delta: number) {
  const before = p.ovr;
  const focus = p.devFocus ? GROUPS[p.devFocus] : null;
  for (let i = 0; i < 34; i++) {
    if (p.pos !== 'GK' && i >= 29) continue;
    if (p.pos === 'GK' && i < 29 && i !== A.rea) continue;
    let d = delta * (0.7 + rand() * 0.6);
    if (delta < 0 && (i === A.acc || i === A.spd || i === A.stm)) d *= 1.8;
    if (delta < 0 && (i === A.vis || i === A.spa || i === A.com || i === A.lpa)) d *= 0.4;
    if (delta > 0 && focus) d *= focus.includes(i) ? 1.6 : 0.8;
    p.attrs[i] = clamp(p.attrs[i] + d, 10, 99);
  }
  p.ovr = posOvr(p.attrs, p.pos);
  if (delta > 0 && p.ovr > p.pot) { p.pot = p.ovr; }
  if (p.ovr !== before) p.traits = rollTraits(p);
}
export const roundAttrs = (p: Player) => { p.attrs = p.attrs.map(v => Math.round(v * 10) / 10); };

