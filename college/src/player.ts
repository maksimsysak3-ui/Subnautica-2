// Everything a player card shows beyond the roster line: attributes, archetype, development
// trait and potential. Derived from the rating, position, size and class, seeded by the player
// so they never change between sessions. The position's key attributes average out to his OVR.
import type { Player } from './data';

export const ATTR: Record<string, string> = {
  SPD: 'Speed', ACC: 'Acceleration', AGI: 'Agility', STR: 'Strength', AWR: 'Awareness', STA: 'Stamina', INJ: 'Injury',
  THP: 'Throw power', SAC: 'Short accuracy', MAC: 'Medium accuracy', DAC: 'Deep accuracy', TUP: 'Throw under pressure',
  CAR: 'Carrying', BTK: 'Break tackle', JKM: 'Juke move', BCV: 'Ball-carrier vision', CTH: 'Catching', CIT: 'Catch in traffic', SRR: 'Short routes', DRR: 'Deep routes', RLS: 'Release',
  RBK: 'Run block', PBK: 'Pass block', IBL: 'Impact block', TAK: 'Tackle', POW: 'Hit power', PMV: 'Power moves', FMV: 'Finesse moves', BSH: 'Block shedding', PUR: 'Pursuit', PRC: 'Play recognition',
  MCV: 'Man coverage', ZCV: 'Zone coverage', PRS: 'Press', KPW: 'Kick power', KAC: 'Kick accuracy',
};
const KEYS: Record<string, string[]> = {
  QB: ['THP', 'SAC', 'MAC', 'DAC', 'TUP', 'AWR'], RB: ['CAR', 'BTK', 'JKM', 'BCV'], FB: ['RBK', 'IBL', 'STR', 'CAR'],
  WR: ['CTH', 'SRR', 'DRR', 'RLS', 'CIT'], TE: ['CTH', 'RBK', 'SRR', 'CIT', 'STR'], OT: ['PBK', 'RBK', 'STR', 'AWR', 'IBL'],
  G: ['RBK', 'PBK', 'STR', 'IBL', 'AWR'], C: ['RBK', 'PBK', 'AWR', 'STR'], EDGE: ['PMV', 'FMV', 'BSH', 'PUR'], DT: ['PMV', 'BSH', 'STR', 'TAK'],
  LB: ['TAK', 'PUR', 'PRC', 'ZCV', 'BSH'], CB: ['MCV', 'ZCV', 'PRS', 'PRC'], S: ['ZCV', 'TAK', 'PRC', 'POW'], K: ['KPW', 'KAC'], P: ['KPW', 'KAC'], LS: ['AWR', 'STR'],
};
const GROUPS: [string, string[]][] = [
  ['Physical', ['SPD', 'ACC', 'AGI', 'STR', 'STA', 'INJ']], ['Mental', ['AWR', 'PRC']],
  ['Passing', ['THP', 'SAC', 'MAC', 'DAC', 'TUP']], ['Ball carrier', ['CAR', 'BTK', 'JKM', 'BCV']], ['Receiving', ['CTH', 'CIT', 'SRR', 'DRR', 'RLS']],
  ['Blocking', ['RBK', 'PBK', 'IBL']], ['Defense', ['TAK', 'POW', 'PMV', 'FMV', 'BSH', 'PUR']], ['Coverage', ['MCV', 'ZCV', 'PRS']], ['Kicking', ['KPW', 'KAC']],
];
const NEAR: Record<string, string[]> = {
  QB: ['PRC', 'CAR', 'BCV', 'JKM'], RB: ['CTH', 'SRR', 'PBK', 'CIT'], FB: ['BTK', 'CTH', 'PBK'], WR: ['CAR', 'BTK', 'JKM', 'BCV'], TE: ['PBK', 'IBL', 'DRR', 'RLS', 'BTK'],
  OT: ['IBL'], G: ['IBL'], C: ['IBL'], EDGE: ['TAK', 'POW', 'PRC', 'STR'], DT: ['TAK', 'POW', 'PUR', 'FMV', 'PRC'], LB: ['POW', 'MCV', 'PMV', 'FMV'],
  CB: ['TAK', 'PUR', 'CTH', 'AGI'], S: ['MCV', 'PUR', 'PRS', 'CTH'], K: [], P: [], LS: [],
};
const ARCH: Record<string, string[]> = {
  QB: ['Field General', 'Pocket Passer', 'Dual Threat', 'Improviser'], RB: ['Power Back', 'Elusive Back', 'Receiving Back'], FB: ['Blocking FB'], WR: ['Deep Threat', 'Route Runner', 'Physical', 'Slot'],
  TE: ['Vertical Threat', 'Possession', 'Blocking'], OT: ['Pass Protector', 'Power', 'Agile'], G: ['Power', 'Agile', 'Pass Protector'], C: ['Power', 'Pass Protector'],
  EDGE: ['Speed Rusher', 'Power Rusher', 'Run Stopper'], DT: ['Power Rusher', 'Run Stopper', 'Speed Rusher'], LB: ['Field General', 'Run Stopper', 'Pass Coverage'],
  CB: ['Man to Man', 'Zone', 'Slot'], S: ['Zone', 'Run Support', 'Hybrid'], K: ['Power', 'Accurate'], P: ['Power', 'Accurate'], LS: ['Long Snapper'],
};
// Typical top speed by position. Speed is athletic, not a skill: a backup corner is still fast,
// so it tracks the position and size, with only a modest lift for the better players.
const SPEED: Record<string, number> = { QB: 77, RB: 88, FB: 74, WR: 89, TE: 79, OT: 60, G: 58, C: 59, EDGE: 80, DT: 67, LB: 81, CB: 90, S: 87, K: 60, P: 60, LS: 55 };
const h = (s: string) => { let x = 2166136261; for (let i = 0; i < s.length; i++) x = Math.imul(x ^ s.charCodeAt(i), 16777619); return x >>> 0; };

export interface Profile { attrs: Record<string, number>; keys: string[]; groups: [string, string[]][]; arch: string; dev: 'Normal' | 'Impact' | 'Star' | 'Elite'; pot: number; potLabel: string; age: number }
const cache = new Map<string, Profile>();
/** The card for a player at his current rating. Potential and development trait come from where
 *  he started the season (p.b), so in-season growth fills his potential rather than raising it. */
export function profile(p: Player): Profile {
  const ck = `${p.id}:${p.ovr}`;
  const c = cache.get(ck); if (c) return c;
  const ovr0 = p.b ?? p.ovr;
  let seed = h(p.id); const rnd = () => ((seed = Math.imul(seed ^ (seed >>> 15), 2246822507) >>> 0) / 4294967296);
  const keys = KEYS[p.pos] ?? ['AWR'];
  const attrs: Record<string, number> = {};
  // Physical base from size and position; a lineman is strong and slow, a corner the reverse.
  const big = Math.max(0, Math.min(1, (p.wt - 180) / 150));
  const base = p.ovr - 10;
  // Skills outside his position sit well below his level (a quarterback is not a run blocker);
  // the ones next to it (a running back's catching, a safety's tackling) sit in between.
  const near = NEAR[p.pos] ?? [];
  for (const a of Object.keys(ATTR)) attrs[a] = Math.round(near.includes(a) ? base - 4 + rnd() * 14 : 28 + rnd() * 26 + (p.ovr - 70) * 0.2);
  attrs.SPD = Math.round((SPEED[p.pos] ?? 75) - (big - 0.3) * 6 + (rnd() - 0.5) * 9 + (p.ovr - 75) * 0.22);
  attrs.ACC = Math.round(attrs.SPD + (rnd() - 0.4) * 6); attrs.AGI = Math.round(attrs.SPD - 4 + (rnd() - 0.5) * 10);
  attrs.STR = Math.round(52 + big * 40 + (rnd() - 0.5) * 10); attrs.STA = Math.round(70 + rnd() * 22); attrs.INJ = Math.round(68 + rnd() * 28);
  attrs.AWR = Math.round(p.ovr - 12 + p.yr * 3 + (rnd() - 0.5) * 8);
  // Key attributes spread around the OVR, then nudged so they average to it exactly.
  for (const k of keys) attrs[k] = Math.round(p.ovr + (rnd() - 0.5) * 14);
  const off = p.ovr - keys.reduce((s, k) => s + attrs[k], 0) / keys.length;
  for (const k of keys) attrs[k] = Math.round(attrs[k] + off);
  for (const a of Object.keys(attrs)) attrs[a] = Math.max(25, Math.min(99, attrs[a]));
  // Archetype from his best key attribute; development and potential from age and rating.
  const archs = ARCH[p.pos] ?? ['Balanced'];
  const arch = archs[h(p.id + 'a') % archs.length];
  const room = (5 - p.yr) * 4 + (rnd() * 8 - 2);
  const pot = Math.max(p.ovr, Math.min(99, Math.round(ovr0 + room + (ovr0 >= 80 ? 2 : 0))));
  const dev = pot >= 93 || (ovr0 >= 90 && rnd() < 0.6) ? 'Elite' : pot >= 86 ? 'Star' : pot >= 78 ? 'Impact' : 'Normal';
  const out: Profile = { attrs, keys, groups: GROUPS.map(([g, as]) => [g, as.filter(a => a in attrs)] as [string, string[]]).filter(([, as]) => as.length), arch, dev, pot, potLabel: pot >= 90 ? 'A' : pot >= 84 ? 'B+' : pot >= 78 ? 'B' : pot >= 70 ? 'C+' : 'C', age: 17 + p.yr + (rnd() < 0.4 ? 1 : 0) };
  cache.set(ck, out);
  return out;
}

/** Last season's stat line in readable form for a position. */
export function statLine(p: Player): [string, string][] {
  const s = p.s; if (!s) return [];
  const [g, pc, pa, py, ptd, pint, ra, ry, rtd, rec, recy, rectd, sk, int, pbu, ff, fgm, fga] = s;
  const out: [string, string][] = [['GP', `${g}`]];
  if (pa) out.push(['CMP/ATT', `${pc}/${pa}`], ['PASS YDS', `${py}`], ['TD', `${ptd}`], ['INT', `${pint}`], ['PCT', `${((pc / pa) * 100).toFixed(1)}`]);
  if (ra) out.push(['RUSH', `${ra}`], ['RUSH YDS', `${ry}`], ['YPC', (ry / ra).toFixed(1)], ['RUSH TD', `${rtd}`]);
  if (rec) out.push(['REC', `${rec}`], ['REC YDS', `${recy}`], ['YPR', (recy / rec).toFixed(1)], ['REC TD', `${rectd}`]);
  if (sk || int || pbu || ff) out.push(['SACKS', `${sk}`], ['INT', `${int}`], ['PBU', `${pbu}`], ['FF', `${ff}`]);
  if (fga) out.push(['FG', `${fgm}/${fga}`], ['FG%', `${((fgm / fga) * 100).toFixed(0)}`]);
  return out;
}
