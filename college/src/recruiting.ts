// Recruiting: the class of 2027. 510 fictional high-school prospects (names, faces and ratings
// are generated; no real minors).
//
// The rules, in short:
//  - Your program gets a weekly pool of recruiting hours (prestige, the recruiting coordinator and
//    recruiting buzz set its size). Every action costs hours, a prospect takes at most 50 hours
//    from you a week, and each kind of contact can be made once a week. Hours reset every week.
//  - Interest is earned at the end of the week. What you spend is multiplied by the week's pitch:
//    selling one of his top three motivations where your school grades well moves him a lot,
//    selling something he does not care about barely moves him. Gains shrink as interest climbs,
//    and five-stars (and prospects above your program's level) are harder to move.
//  - A dealbreaker caps interest from any school that fails it.
//  - Every prospect is tracked all season: CPU programs recruit him every week (the best programs
//    chase the best players), he trims his list (open, top 8, top 5, top 3) and commits once one
//    school clearly leads. Schools cut from his list, you included, are out.
//  - Scouting reveals his real rating range, his motivations and his dealbreaker.
import { SCHOOLS, rosterOf, school, type School } from './data';
import { teamSchedule, record, LAST_WEEK, REG_WEEKS } from './season';
import type { Dynasty, RecruitState } from './store';

// ---- motivations -------------------------------------------------------------------------------
export const MOTIVATIONS = ['Academic Prestige', 'Athletic Facilities', 'Brand Exposure', 'Campus Lifestyle', 'Championship Contender', 'Coach Prestige', 'Coach Stability', 'Conference Prestige', 'Playing Style', 'Playing Time', 'Pro Potential', 'Program Tradition', 'Proximity to Home', 'Stadium Atmosphere'] as const;
export type Motivation = (typeof MOTIVATIONS)[number];
export interface Recruit {
  id: string; n: number; fn: string; ln: string; pos: string; stars: number; rank: number; posRank: number; state: string; city: string; ht: number; wt: number; ovr: number; pot: number;
  /** His three motivations, most important first. */ mot: Motivation[];
  /** Optional dealbreaker (one of his motivations) and the grade score a school needs on it. */ deal?: Motivation; dealReq: number;
  /** Programs recruiting him from the start. */ schools: number[]; face: number;
  /** Where the unscouted rating range sits around the truth (-1..1). */ fuzz: number;
}

const FN = ['Jaylen', 'Marcus', 'Tre', 'Kendrick', 'Cole', 'Brady', 'Isaiah', 'Dominic', 'Xavier', 'Camden', 'Malik', 'Trey', 'Jordan', 'Elijah', 'Gavin', 'Josiah', 'Caden', 'Tyrell', 'Bryce', 'Jalen', 'Derrick', 'Micah', 'Landon', 'Kobe', 'Amari', 'Ty', 'Quentin', 'Rashad', 'Owen', 'Deshawn', 'Nolan', 'Zion', 'Carter', 'Jace', 'Kingston', 'Rocco', 'Dante', 'Terrell', 'Hunter', 'Andre', 'Bishop', 'Cayden', 'Darius', 'Emmanuel', 'Fabian', 'Garrett', 'Hollis', 'Ivan', 'Jabari', 'Keon', 'Lamar', 'Maddox', 'Nehemiah', 'Omari', 'Pierce', 'Quincy', 'Roman', 'Sincere', 'Tobias', 'Ulysses', 'Vince', 'Wyatt', 'Xzavier', 'Yusuf', 'Zay'];
const LN = ['Whitfield', 'Okoro', 'Banks', 'Hollins', 'McCray', 'Pruitt', 'Delacroix', 'Sutton', 'Ivory', 'Kincaid', 'Abernathy', 'Rollins', 'Vance', 'Tate', 'Ashby', 'Boykin', 'Calloway', 'Dandridge', 'Ellerbe', 'Fontenot', 'Gaines', 'Haskins', 'Ingram', 'Jeffries', 'Kemp', 'Lattimore', 'Mabry', 'Nwosu', 'Odom', 'Pettaway', 'Quarles', 'Redd', 'Strother', 'Thibodeaux', 'Underwood', 'Varner', 'Whitlock', 'Yarbrough', 'Zeigler', 'Adebayo', 'Bellamy', 'Cormier', 'Dukes', 'Easley', 'Fair', 'Gatling', 'Holloway', 'Iverson', 'Jessup', 'Knox', 'Lockett', 'Mayfield', 'Nesbitt', 'Ogletree', 'Prather', 'Rountree', 'Shelton', 'Tolbert', 'Vickers', 'Winfrey', 'Yancey', 'Alston', 'Burrell', 'Castile', 'Driscoll'];
const STATES: [string, number, string[]][] = [['TX', 16, ['Houston', 'Dallas', 'Austin', 'San Antonio', 'Katy', 'Allen', 'Duncanville']], ['FL', 14, ['Miami', 'Tampa', 'Jacksonville', 'Orlando', 'Fort Lauderdale']], ['GA', 11, ['Atlanta', 'Savannah', 'Buford', 'Valdosta']], ['CA', 9, ['Los Angeles', 'San Diego', 'Sacramento', 'Mission Viejo']], ['AL', 5, ['Birmingham', 'Mobile', 'Hoover']], ['LA', 5, ['New Orleans', 'Baton Rouge', 'Shreveport']], ['OH', 5, ['Columbus', 'Cincinnati', 'Massillon']], ['NC', 4, ['Charlotte', 'Raleigh']], ['PA', 4, ['Pittsburgh', 'Philadelphia']], ['MI', 3, ['Detroit', 'Grand Rapids']], ['TN', 4, ['Nashville', 'Memphis']], ['SC', 3, ['Columbia', 'Greenville']], ['MS', 3, ['Jackson', 'Starkville']], ['VA', 3, ['Richmond', 'Norfolk']], ['NJ', 3, ['Newark', 'Paramus']], ['AZ', 2, ['Phoenix', 'Chandler']], ['IL', 2, ['Chicago']], ['MD', 2, ['Baltimore']], ['OK', 2, ['Tulsa']], ['MO', 1, ['St. Louis']], ['IN', 1, ['Indianapolis']], ['WA', 1, ['Seattle']], ['UT', 1, ['Salt Lake City']], ['NV', 1, ['Las Vegas']], ['KY', 1, ['Louisville']]];
const MIX: [string, number][] = [['QB', 32], ['RB', 40], ['WR', 70], ['TE', 26], ['OT', 44], ['G', 26], ['C', 10], ['EDGE', 52], ['DT', 44], ['LB', 46], ['CB', 64], ['S', 46], ['K', 6], ['P', 4]];
const SIZE: Record<string, [number, number]> = { QB: [75, 205], RB: [70, 200], WR: [72, 182], TE: [76, 230], OT: [78, 295], G: [76, 300], C: [75, 290], EDGE: [76, 240], DT: [75, 290], LB: [73, 220], CB: [71, 178], S: [72, 192], K: [72, 180], P: [74, 195] };
export const POSITIONS = MIX.map(m => m[0]);

const h = (s: string) => { let x = 2166136261; for (let i = 0; i < s.length; i++) x = Math.imul(x ^ s.charCodeAt(i), 16777619); return x >>> 0; };
/** A stable 0..1 number for a key. */
const u = (s: string) => (h(s) % 100000) / 100000;
const rng = (seed: number) => () => ((seed = Math.imul(seed ^ (seed >>> 15), 2246822507) >>> 0) / 4294967296);
const clamp = (v: number, lo = 5, hi = 99) => Math.max(lo, Math.min(hi, v));

let cache: Recruit[] | null = null;
let byId: Map<string, Recruit> | null = null;
/** The class of 2027 (seeded, so the same every session; ids, names and ratings match older saves). */
export function recruitClass(): Recruit[] {
  if (cache) return cache;
  let seed = 20270101; const r = () => ((seed = Math.imul(seed ^ (seed >>> 15), 2246822507) >>> 0) / 4294967296);
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
  const used = new Set<string>(), out: Recruit[] = [];
  const tot = STATES.reduce((a, s) => a + s[1], 0);
  const posList = MIX.flatMap(([p, n]) => Array(n).fill(p) as string[]).sort(() => r() - 0.5);
  posList.forEach((pos, i) => {
    let fn = '', ln = ''; do { fn = pick(FN); ln = pick(LN); } while (used.has(fn + ln)); used.add(fn + ln);
    let x = r() * tot; const st = STATES.find(s => (x -= s[1]) < 0) ?? STATES[0];
    const talent = Math.pow(r(), 1.8);                         // most prospects are 3-stars; a few are elite
    const stars = talent > 0.93 ? 5 : talent > 0.62 ? 4 : talent > 0.18 ? 3 : 2;
    const ovr = Math.round(46 + talent * 34 + (r() - 0.5) * 6);
    const [H, W] = SIZE[pos];
    [0, 1, 2, 3, 4, 5, 6, 7, 8].sort(() => r() - 0.5);          // keeps the seeded sequence of the first class
    out.push({ id: `R${i}`, n: i, fn, ln, pos, stars, rank: 0, posRank: 0, state: st[0], city: pick(st[2]), ht: H + Math.round((r() - 0.5) * 4), wt: W + Math.round((r() - 0.5) * 30), ovr, pot: Math.min(97, ovr + 12 + Math.round(r() * 14)), mot: [], dealReq: 0, schools: [], face: i, fuzz: 0 });
  });
  out.sort((a, b) => b.ovr + b.stars * 3 - (a.ovr + a.stars * 3)).forEach((x, i) => { x.rank = i + 1; });
  const byPos: Record<string, number> = {};
  for (const x of out) x.posRank = (byPos[x.pos] = (byPos[x.pos] ?? 0) + 1);
  for (const x of out) {
    const q = rng(h(x.id + 'mot'));
    // Motivations: elite prospects lean towards the pros, titles and exposure; others towards
    // playing time and home.
    const w = MOTIVATIONS.map(m => {
      let v = 1;
      if (x.stars >= 4 && ['Pro Potential', 'Championship Contender', 'Brand Exposure', 'Coach Prestige'].includes(m)) v += m === 'Pro Potential' ? 1.3 : 0.7;
      if (x.stars <= 3 && ['Playing Time', 'Proximity to Home', 'Campus Lifestyle'].includes(m)) v += m === 'Campus Lifestyle' ? 0.3 : 0.9;
      if (['QB', 'WR', 'RB'].includes(x.pos) && m === 'Playing Style') v += 0.8;
      if (['OT', 'G', 'C', 'DT'].includes(x.pos) && m === 'Program Tradition') v += 0.4;
      return v;
    });
    while (x.mot.length < 3) {
      let t = q() * w.reduce((a, b, i) => a + (x.mot.includes(MOTIVATIONS[i]) ? 0 : b), 0);
      const i = MOTIVATIONS.findIndex((m, k) => !x.mot.includes(m) && (t -= w[k]) < 0);
      x.mot.push(MOTIVATIONS[i < 0 ? MOTIVATIONS.findIndex(m => !x.mot.includes(m)) : i]);
    }
    if (q() < 0.22 + x.stars * 0.06) { const k = q(); x.deal = x.mot[k < 0.6 ? 0 : k < 0.9 ? 1 : 2]; x.dealReq = [0, 0, 58, 64, 70, 75][x.stars]; }
    x.fuzz = q() * 2 - 1;
    // Who recruits him from day one: the best programs chase the best players, everyone chases
    // the kids near home.
    const target = [0, 1, 1, 2, 3.6, 4.6][x.stars];
    const want = [0, 0, 3, 4, 5, 6][x.stars] + Math.floor(q() * 3);
    const pool = SCHOOLS.map(s => ({ s, w: Math.exp(-((s.prestige - target) ** 2) / 1.3) * (homeState(s) === x.state ? 4 : miles(homeState(s), x.state) < 450 ? 1.8 : 1) }));
    const set: number[] = [];
    while (set.length < want) {
      let t = q() * pool.reduce((a, p) => a + (set.includes(p.s.id) ? 0 : p.w), 0);
      const p = pool.find(p => !set.includes(p.s.id) && (t -= p.w) < 0) ?? pool.find(p => !set.includes(p.s.id))!;
      set.push(p.s.id);
    }
    x.schools = set;
  }
  cache = out; byId = new Map(out.map(x => [x.id, x]));
  return out;
}
export const recruitById = (id: string) => { recruitClass(); return byId!.get(id); };

// ---- geography -----------------------------------------------------------------------------------
const GEO: Record<string, [number, number]> = { AL: [32.8, -86.8], AK: [61.4, -152.3], AZ: [34.2, -111.7], AR: [34.9, -92.4], CA: [36.8, -119.4], CO: [39, -105.5], CT: [41.6, -72.7], DE: [39, -75.5], FL: [28.6, -82.4], GA: [32.7, -83.4], HI: [20.8, -156.3], ID: [44.4, -114.6], IL: [40, -89.2], IN: [39.9, -86.3], IA: [42, -93.5], KS: [38.5, -98.4], KY: [37.5, -85.3], LA: [31.1, -92], ME: [45.4, -69.2], MD: [39, -76.8], MA: [42.3, -71.8], MI: [43.3, -84.5], MN: [46.3, -94.3], MS: [32.7, -89.7], MO: [38.4, -92.5], MT: [47, -109.6], NE: [41.5, -99.8], NV: [39.3, -116.6], NH: [43.7, -71.6], NJ: [40.2, -74.7], NM: [34.4, -106.1], NY: [42.9, -75.5], NC: [35.6, -79.4], ND: [47.5, -100.5], OH: [40.3, -82.8], OK: [35.6, -97.5], OR: [43.9, -120.6], PA: [40.9, -77.8], RI: [41.7, -71.5], SC: [33.9, -80.9], SD: [44.4, -100.2], TN: [35.9, -86.4], TX: [31.5, -99.3], UT: [39.3, -111.7], VT: [44, -72.7], VA: [37.5, -78.9], WA: [47.4, -120.5], WV: [38.6, -80.6], WI: [44.6, -89.9], WY: [43, -107.6], DC: [38.9, -77] };
/** Miles between two states' centres (0 within a state). */
export function miles(a: string, b: string) {
  if (a === b) return 0;
  const p = GEO[a], q = GEO[b]; if (!p || !q) return 900;
  const R = Math.PI / 180, dLa = (q[0] - p[0]) * R, dLo = (q[1] - p[1]) * R;
  const k = Math.sin(dLa / 2) ** 2 + Math.cos(p[0] * R) * Math.cos(q[0] * R) * Math.sin(dLo / 2) ** 2;
  return Math.round(3959 * 2 * Math.asin(Math.sqrt(k)));
}
// A program's home state: the most common home state on its roster.
const homes = new Map<number, string>();
export function homeState(s: School) {
  let st = homes.get(s.id);
  if (!st) { const c: Record<string, number> = {}; for (const p of rosterOf(s.id)) { const m = p.home?.match(/, ([A-Z]{2})$/); if (m) c[m[1]] = (c[m[1]] ?? 0) + 1; } st = Object.entries(c).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '??'; homes.set(s.id, st); }
  return st;
}

// ---- staff (the same seeded numbers the Staff screen shows) --------------------------------------
const OFF_STYLES = ['Spread RPO', 'Pro-style', 'Air Raid', 'Power run', 'Multiple'], DEF_STYLES = ['4-2-5', '3-4 multiple', '4-3 over', 'Tampa 2', 'Quarters'];
export const offenseStyle = (s: School) => OFF_STYLES[(h(`${s.id}-Offensive Coordinator`) >>> 11) % OFF_STYLES.length];
export const defenseStyle = (s: School) => DEF_STYLES[(h(`${s.id}-Defensive Coordinator`) >>> 11) % DEF_STYLES.length];
/** The recruiting coordinator's Evaluation, Closing and Relationships ratings. */
export function coordinator(s: School) {
  const k = h(`${s.id}-Recruiting Coordinator`), base = 46 + s.prestige * 6 + (k % 12);
  const [evaluation, closing, relationships] = [0, 1, 2].map(j => Math.max(40, Math.min(97, base + ((k >>> (j * 4)) % 15) - 6)));
  return { evaluation, closing, relationships };
}

// ---- school grades ---------------------------------------------------------------------------------
const ACADEMIC = new Set(['Stanford', 'Notre Dame', 'Northwestern', 'Vanderbilt', 'Duke', 'Rice', 'Michigan', 'California', 'UCLA', 'Georgia Tech', 'Wake Forest', 'Virginia', 'North Carolina', 'USC', 'Boston College', 'Florida', 'Texas', 'Navy', 'Army', 'Tulane', 'SMU', 'Pittsburgh', 'Miami']);
const CONF: Record<string, number> = { SEC: 97, 'Big Ten': 95, 'Big 12': 82, ACC: 80, 'Pac-12': 62, American: 58, 'Mountain West': 52, 'Sun Belt': 50, 'C-USA': 40, MAC: 38 };
const POWER: Record<string, number> = { SEC: 1, 'Big Ten': 1, 'Big 12': 0.7, ACC: 0.7 };
const SLOTS: Record<string, number> = { QB: 1, RB: 1, WR: 3, TE: 1, OT: 2, G: 2, C: 1, EDGE: 2, DT: 2, LB: 2, CB: 2, S: 2, K: 1, P: 1 };
const STYLE_FIT: Record<string, Record<string, number>> = {
  QB: { 'Air Raid': 95, 'Spread RPO': 90, 'Pro-style': 80, Multiple: 72, 'Power run': 52 }, RB: { 'Power run': 95, 'Pro-style': 85, 'Spread RPO': 80, Multiple: 75, 'Air Raid': 50 },
  WR: { 'Air Raid': 97, 'Spread RPO': 88, Multiple: 72, 'Pro-style': 66, 'Power run': 45 }, TE: { 'Pro-style': 95, 'Power run': 86, Multiple: 82, 'Spread RPO': 62, 'Air Raid': 42 },
  OL: { 'Power run': 95, 'Pro-style': 86, Multiple: 75, 'Spread RPO': 68, 'Air Raid': 56 },
  EDGE: { '3-4 multiple': 95, '4-3 over': 88, '4-2-5': 80, Quarters: 70, 'Tampa 2': 64 }, DT: { '4-3 over': 95, 'Tampa 2': 85, '4-2-5': 78, Quarters: 72, '3-4 multiple': 68 },
  LB: { '3-4 multiple': 93, 'Tampa 2': 90, '4-3 over': 84, Quarters: 70, '4-2-5': 60 }, CB: { Quarters: 92, '4-2-5': 88, '3-4 multiple': 78, '4-3 over': 74, 'Tampa 2': 68 },
  S: { Quarters: 95, '4-2-5': 90, 'Tampa 2': 85, '3-4 multiple': 72, '4-3 over': 68 },
};
const OFFENSE = new Set(['QB', 'RB', 'WR', 'TE', 'OT', 'G', 'C']);

// Depth at each position (returning players' ratings, best first) and the national pecking
// order. Rebuilt whenever ratings move (each week).
let depthStamp = -1;
const depth = new Map<number, Record<string, number[]>>();
let order: Map<number, number> | null = null;
function depthOf(sid: number) {
  let m = depth.get(sid);
  if (!m) { m = {}; for (const p of rosterOf(sid)) if (p.yr < 4) (m[p.pos] ??= []).push(p.ovr); depth.set(sid, m); }
  return m;
}
function freshCaches(d?: Dynasty) {
  const stamp = d?.season?.results.length ?? 0;
  if (stamp === depthStamp) return;
  depthStamp = stamp; depth.clear();
  const pw = d?.season?.power ?? {};
  order = new Map([...SCHOOLS].sort((a, b) => (pw[b.id] ?? b.ovr + b.win * 6) - (pw[a.id] ?? a.ovr + a.win * 6)).map((s, i) => [s.id, i]));
}

/** How well a program grades on one motivation for one prospect, 0-100. */
export function gradeScore(s: School, x: Recruit, m: Motivation, d?: Dynasty): number {
  freshCaches(d);
  const n = (tag: string) => u(s.school + tag);
  const mine = d?.team === s.id, pc = POWER[s.conf] ?? 0;
  switch (m) {
    case 'Academic Prestige': return Math.round(clamp(ACADEMIC.has(s.school) ? 86 + n('ac') * 13 : 38 + n('ac') * 40 + pc * 5));
    case 'Athletic Facilities': return Math.round(clamp(20 + s.prestige * 11 + pc * 6 + n('fac') * 16 + (mine ? ((d!.meters.boost ?? 50) - 50) / 5 : 0)));
    case 'Brand Exposure': return Math.round(clamp(18 + s.prestige * 12 + pc * 5 + n('br') * 14));
    case 'Campus Lifestyle': return Math.round(clamp(48 + n('campus') * 50));
    case 'Championship Contender': { const r = order?.get(s.id) ?? 60; return Math.round(clamp(99 - r * 1.15)); }
    case 'Coach Prestige': return Math.round(clamp(mine ? 36 + s.prestige * 8 + (d?.season ? record(s.id, d.season).w * 2 : 0) : 32 + s.prestige * 11 + n('cp') * 14));
    case 'Coach Stability': return Math.round(clamp(mine ? 50 + s.prestige * 5 : 38 + s.prestige * 6 + n('cs') * 34));
    case 'Conference Prestige': return Math.round(clamp(s.conf === 'Independent' ? (s.prestige >= 4 ? 90 : 46) : (CONF[s.conf] ?? 45) - 2 + n('cf') * 4));
    case 'Playing Style': {
      const key = ['OT', 'G', 'C'].includes(x.pos) ? 'OL' : x.pos, fitT = STYLE_FIT[key];
      if (!fitT) return 75;
      return Math.round(clamp((fitT[OFFENSE.has(x.pos) ? offenseStyle(s) : defenseStyle(s)] ?? 70) + (h(s.school + x.pos) % 7) - 3));
    }
    case 'Playing Time': {
      const proj = x.ovr + 6, ahead = (depthOf(s.id)[x.pos] ?? []).filter(v => v > proj).length, slots = SLOTS[x.pos] ?? 1;
      return Math.round(clamp(ahead < slots ? 95 - ahead * 7 : 80 - (ahead - slots + 1) * 15));
    }
    case 'Pro Potential': return Math.round(clamp(32 + s.prestige * 8 + (s.ovr - 75) * 0.9 + n('pro') * 10));
    case 'Program Tradition': return Math.round(clamp(10 + s.prestige * 12 + s.win * 20 + n('tr') * 16));
    case 'Proximity to Home': { const mi = miles(homeState(s), x.state); return Math.round(clamp(98 - mi * 0.04 - Math.max(0, mi - 800) * 0.01)); }
    case 'Stadium Atmosphere': return Math.round(clamp(30 + s.prestige * 10 + pc * 5 + n('st') * 12 + (mine ? ((d!.meters.hype ?? 55) - 55) / 4 : 0)));
  }
}
const LETTERS: [number, string][] = [[95, 'A+'], [90, 'A'], [85, 'A-'], [80, 'B+'], [75, 'B'], [70, 'B-'], [65, 'C+'], [60, 'C'], [55, 'C-'], [50, 'D+'], [45, 'D'], [40, 'D-'], [0, 'F']];
export const letter = (g: number) => LETTERS.find(([t]) => g >= t)![1];
/** Overall fit: his three motivations, weighted 50/30/20. */
export const fit = (s: School, x: Recruit, d?: Dynasty) => Math.round(x.mot.reduce((a, m, i) => a + gradeScore(s, x, m, d) * [0.5, 0.3, 0.2][i], 0));
/** Does this school fail his dealbreaker? */
export const failsDeal = (s: School, x: Recruit, d?: Dynasty) => !!x.deal && gradeScore(s, x, x.deal, d) < x.dealReq;
export const DEAL_CAP = 40;

// ---- rules ----------------------------------------------------------------------------------------
export type ActionKey = 'dm' | 'ff' | 'hc' | 'house' | 'scout';
export const ACTIONS: Record<ActionKey, { name: string; cost: number; base: number; desc: string }> = {
  dm: { name: 'Direct message', cost: 10, base: 1.3, desc: 'A quick note on social media' },
  ff: { name: 'Contact friends & family', cost: 25, base: 3.1, desc: 'Calls to his parents and his high school coach' },
  hc: { name: 'Send the head coach', cost: 40, base: 5.2, desc: 'You call him yourself. Needs his top 8 or an offer' },
  house: { name: 'Send the house', cost: 50, base: 7, desc: 'Everyone on staff, the max pitch. Needs an offer and his top 5' },
  scout: { name: 'Scout', cost: 15, base: 0, desc: 'Film and calls: rating, motivations, dealbreaker' },
};
export const CAP = 50, BOARD_MAX = 35, OFFERS = 30, CLASS_MAX = 25, VISITS_PER_WEEK = 4;
export const STAGES = ['Open', 'Top 8', 'Top 5', 'Top 3', 'Committed'] as const;
const STAGE_N = [99, 8, 5, 3];
/** Stage cuts and the earliest week he will decide (by star rating, staggered per prospect). */
export function timeline(x: Recruit) {
  const k = h(x.id + 'tl'), late = x.stars >= 4 ? 1 : 0;
  const t8 = 1 + (k % 3) + late, t5 = t8 + 2 + ((k >>> 3) % 2) + late, t3 = t5 + 2 + ((k >>> 5) % 2);
  const decide = [0, 0, 3, 4, 6, 8][x.stars] + ((k >>> 7) % 4);
  return [t8, t5, t3, decide];
}
/** How hard a program finds it to move him: stars, and how far above the program he is. */
export function difficulty(s: School, x: Recruit) {
  const gap = x.stars - 0.5 - s.prestige;
  return [1, 0.7, 0.75, 1, 1.45, 2.05][x.stars] * (gap > 0 ? 1 + gap * 0.22 : Math.max(0.75, 1 + gap * 0.07));
}
const dimin = (cur: number) => Math.max(0.06, 1 - cur / 106) ** 1.15;
const COMMIT_AT = [0, 0, 52, 58, 66, 74];

/** The week's pitch multiplier: what he cares about, times how well you grade there. */
export function pitchMult(s: School, x: Recruit, p: string | undefined, d?: Dynasty) {
  const base = 0.25 + 0.25 * (fit(s, x, d) / 100);
  if (!p || !MOTIVATIONS.includes(p as Motivation)) return base;
  const rank = x.mot.indexOf(p as Motivation), w = rank >= 0 ? [1, 0.75, 0.5][rank] : 0.12;
  const gf = (gradeScore(s, x, p as Motivation, d) - 60) / 35;
  return Math.max(0.1, Math.min(2, base + w * gf * 1.4));
}

// ---- state ------------------------------------------------------------------------------------------
const fresh = (): RecruitState => ({ int: {}, scouted: 0, offered: false, nil: 0, log: [], sc: 0, stg: 0, acts: [], hrs: 0, tot: 0 });
/** His opening state at a given week: the programs on him and how far each has got. */
function initial(x: Recruit, d: Dynasty, week: number): RecruitState {
  const st = fresh();
  for (const sid of x.schools) {
    const s = school(sid); if (!s) continue;
    const ramp = sid === d.team ? 0 : Math.min(week, 10) * (1 + s.prestige * 0.5) / difficulty(s, x);
    let v = 8 + fit(s, x, d) / 7 + s.prestige * 1.5 + u(x.id + sid) * 8 + ramp;
    if (failsDeal(s, x, d)) v = Math.min(v, DEAL_CAP);
    st.int[sid] = Math.round(Math.min(90, v) * 10) / 10;
  }
  const tl = timeline(x);
  const stg = week >= tl[2] ? 3 : week >= tl[1] ? 2 : week >= tl[0] ? 1 : 0;
  if (stg) cut(st, STAGE_N[stg]);
  st.stg = stg; st.wk = week;
  return st;
}
function cut(st: RecruitState, n: number) {
  const ranked = Object.entries(st.int).sort((a, b) => b[1] - a[1]);
  const out = ranked.slice(n).map(([k]) => Number(k));
  for (const k of out) delete st.int[k];
  return out;
}
/** A prospect's state, read-only (an untracked prospect gets his opening state). */
export function stateOf(d: Dynasty, x: Recruit): RecruitState {
  const st = d.recruits[x.id];
  if (!st || d.rv !== 2) return st ? normalise({ ...st, int: { ...st.int } }) : initial(x, d, d.week);
  return st;
}
function normalise(st: RecruitState): RecruitState {
  st.sc ??= [0, 30, 60, 100][st.scouted] ?? 0;
  st.stg ??= 0; st.acts ??= []; st.hrs ??= 0; st.tot ??= 0; st.log ??= [];
  return st;
}
/** Bring a save up to the current rules: every prospect tracked, older recruiting progress kept. */
export function ensureWorld(d: Dynasty) {
  if (d.rv === 2) return;
  for (const x of recruitClass()) {
    const old = d.recruits[x.id];
    if (!old) { d.recruits[x.id] = initial(x, d, d.week); continue; }
    normalise(old);
    // Older saves only tracked schools that had talked to him; give him his full list back.
    const base = initial(x, d, d.week);
    for (const [k, v] of Object.entries(base.int)) if (old.int[Number(k)] === undefined && !old.committed) old.int[Number(k)] = v;
    old.stg = old.committed ? 3 : base.stg;
    if (old.stg && !old.committed) cut(old, STAGE_N[old.stg]);
  }
  d.board = d.board.filter(id => recruitById(id));
  d.rv = 2;
}
const say = (st: RecruitState, w: number, t: string) => { st.log.unshift(`Wk ${w}: ${t}`); st.log.length = Math.min(st.log.length, 14); };
/** Reset a prospect's weekly counters when a new week has started. */
function touch(st: RecruitState, week: number) { if (st.wk !== week) { st.wk = week; st.acts = []; st.hrs = 0; } }

// ---- budget -----------------------------------------------------------------------------------------
/** The program's weekly recruiting hours: prestige, the coordinator's relationships, the buzz. */
export function hoursBudget(d: Dynasty) {
  const s = school(d.team), rc = coordinator(s);
  return Math.round(clamp(270 + s.prestige * 30 + (rc.relationships - 65) * 2.2 + ((d.meters.buzz ?? 50) - 50) * 0.8, 300, 500) / 5) * 5;
}
export const hoursUsed = (d: Dynasty) => Object.values(d.recruits).reduce((a, st) => a + (st.wk === d.week ? st.hrs ?? 0 : 0), 0);
export const hoursLeft = (d: Dynasty) => hoursBudget(d) - hoursUsed(d);
export const hrsThisWeek = (d: Dynasty, st: RecruitState) => (st.wk === d.week ? st.hrs ?? 0 : 0);
export const actsThisWeek = (d: Dynasty, st: RecruitState) => (st.wk === d.week ? st.acts ?? [] : []);
export const offersOut = (d: Dynasty) => Object.values(d.recruits).filter(st => st.offered && (st.committed === undefined || st.committed === d.team) && st.int[d.team] !== undefined).length;
export const commitsOf = (d: Dynasty, sid = d.team) => recruitClass().filter(x => d.recruits[x.id]?.committed === sid);
export const activeBoard = (d: Dynasty) => d.board.filter(id => { const st = d.recruits[id]; return !st || (st.committed === undefined && (d.rv !== 2 || st.int[d.team] !== undefined)); });
export const visitsIn = (d: Dynasty, wk: number) => Object.values(d.recruits).filter(st => st.vis === wk && !st.visited).length;
/** Your remaining regular-season home games (official visit weekends). */
export const homeWeeks = (d: Dynasty) => teamSchedule(d.team, d.season).filter(g => !g.bye && g.home && g.wk > d.week && g.wk <= REG_WEEKS).map(g => g.wk);
export const closed = (d: Dynasty) => d.week >= LAST_WEEK;

/** Why an action is unavailable right now (undefined when it is allowed). */
export function blocked(d: Dynasty, x: Recruit, kind: ActionKey | 'offer' | 'visit' | 'board'): string | undefined {
  const st = stateOf(d, x), me = d.team;
  if (closed(d)) return 'Signing day has passed';
  if (st.committed !== undefined) return st.committed === me ? 'Committed to you' : 'Committed elsewhere';
  const inList = st.int[me] !== undefined;
  if (kind === 'board') {
    if (d.board.includes(x.id)) return undefined;
    if (activeBoard(d).length >= BOARD_MAX) return `Your board is full (${BOARD_MAX})`;
    if (!inList && (st.stg ?? 0) >= 2) return `He has cut his list to a ${STAGES[st.stg!]}`;
    if (!inList && Object.keys(st.int).length >= STAGE_N[st.stg ?? 0]) return 'His top 8 is full';
    return undefined;
  }
  if (!inList) return 'You are not on his list';
  if (!d.board.includes(x.id)) return 'Add him to your board first';
  if (kind === 'offer') {
    if (st.offered) return 'Offer already out';
    if (offersOut(d) >= OFFERS) return `All ${OFFERS} offers are out`;
    if (commitsOf(d).length >= CLASS_MAX) return 'Your class is full';
    return undefined;
  }
  if (kind === 'visit') {
    if (st.visited) return 'He has already visited';
    if (st.vis) return `Visit set for week ${st.vis}`;
    if (!st.offered) return 'Offer him first';
    if (!(st.stg ?? 0)) return 'Needs his top 8';
    if (!homeWeeks(d).some(w => visitsIn(d, w) < VISITS_PER_WEEK)) return 'No open home weekends';
    return undefined;
  }
  const a = ACTIONS[kind], acts = actsThisWeek(d, st), used = hrsThisWeek(d, st);
  if (kind === 'scout') { if ((st.sc ?? 0) >= 100) return 'Fully scouted'; if (acts.filter(k => k === 'scout').length >= 3) return 'Scouted 3 times this week'; }
  else if (acts.includes(kind)) return 'Already done this week';
  if (kind === 'hc' && !(st.stg ?? 0) && !st.offered) return 'Needs his top 8 or an offer';
  if (kind === 'house' && (!st.offered || (st.stg ?? 0) < 2)) return st.offered ? 'Needs his top 5' : 'Needs an offer';
  if (used + a.cost > CAP) return `${CAP}-hour weekly cap for one prospect`;
  if (a.cost > hoursLeft(d)) return 'Not enough hours left this week';
  return undefined;
}

/** One recruiting action. Hours and caps are enforced here, not just in the UI. Returns a log line. */
export function act(d: Dynasty, x: Recruit, kind: ActionKey | 'offer' | 'visit' | 'unvisit' | 'pitch' | 'undo' | 'board' | 'unboard', arg?: string | number): string {
  ensureWorld(d);
  const st = d.recruits[x.id], me = d.team, s = school(me);
  touch(st, d.week);
  if (kind === 'unboard') { d.board = d.board.filter(id => id !== x.id); return `${x.fn} ${x.ln} is off your board.`; }
  if (kind === 'pitch') {
    if (closed(d) || st.committed !== undefined) return 'Recruiting is over for him.';
    if (st.acts!.some(k => k !== 'scout')) return 'The pitch is locked once you have contacted him this week.';
    st.pitch = typeof arg === 'string' && MOTIVATIONS.includes(arg as Motivation) ? arg : undefined;
    return st.pitch ? `This week's pitch: ${st.pitch}.` : 'No pitch set.';
  }
  if (kind === 'undo') {
    const i = st.acts!.map(k => k !== 'scout').lastIndexOf(true);
    if (i < 0) return 'Nothing to undo.';
    const k = st.acts![i] as ActionKey; st.acts!.splice(i, 1); st.hrs = (st.hrs ?? 0) - ACTIONS[k].cost; st.tot = (st.tot ?? 0) - ACTIONS[k].cost;
    return `Cancelled: ${ACTIONS[k].name}. ${ACTIONS[k].cost} hours back.`;
  }
  if (kind === 'unvisit') { if (!st.vis || st.visited) return 'No visit to cancel.'; const w = st.vis; st.vis = undefined; return `Visit for week ${w} cancelled.`; }
  const why = blocked(d, x, kind);
  if (why) return `${why}.`;
  let msg = '';
  if (kind === 'board') {
    if (d.board.includes(x.id)) return 'Already on your board.';
    if (st.int[me] === undefined) { const v = 5 + fit(s, x, d) / 9 + s.prestige * 1.2; st.int[me] = Math.round(Math.min(failsDeal(s, x, d) ? DEAL_CAP : 99, v) * 10) / 10; }
    d.board.push(x.id);
    return `${x.fn} ${x.ln} added to your board.`;
  }
  if (kind === 'offer') { st.offered = true; st.ofw = d.week; msg = 'Scholarship offered. He posted it on social media.'; }
  else if (kind === 'visit') {
    const w = Number(arg), ok = homeWeeks(d).includes(w) && visitsIn(d, w) < VISITS_PER_WEEK;
    if (!ok) return 'That weekend is not available.';
    st.vis = w; msg = `Official visit set for the week ${w} home game.`;
  } else {
    const a = ACTIONS[kind];
    st.acts!.push(kind); st.hrs = (st.hrs ?? 0) + a.cost; st.tot = (st.tot ?? 0) + a.cost;
    if (kind === 'scout') {
      const n = st.acts!.filter(k => k === 'scout').length, ev = coordinator(s).evaluation;
      const before = st.sc ?? 0;
      st.sc = Math.min(100, before + Math.round([34, 22, 14][n - 1] * (0.8 + ev / 250)));
      const learned: string[] = [];
      if (before < 25 && st.sc >= 25) learned.push(`#1 motivation: ${x.mot[0]}`);
      if (before < 50 && st.sc >= 50) learned.push(`#2 motivation: ${x.mot[1]}`, x.deal ? `dealbreaker: ${x.deal}` : 'no dealbreaker');
      if (before < 75 && st.sc >= 75) learned.push(`#3 motivation: ${x.mot[2]}`);
      if (before < 100 && st.sc >= 100) learned.push(`true rating ${x.ovr}`);
      msg = `Scouted (${st.sc}%).${learned.length ? ` Learned ${learned.join(', ')}.` : ' Rating range narrowed.'}`;
    } else msg = `${a.name}${st.pitch ? `, pitching ${st.pitch}` : ''}.`;
  }
  st.lastTouch = d.week;
  say(st, d.week, msg);
  return msg;
}

// ---- the week ---------------------------------------------------------------------------------------
/** Your interest gain this week from your contact, offer and visit (before the cap). */
export function userGain(d: Dynasty, x: Recruit, st: RecruitState, playedWeek: number): number {
  const s = school(d.team), cur = st.int[d.team] ?? 0;
  const acts = actsThisWeek(d, st).filter(k => k !== 'scout') as ActionKey[];
  let raw = 0;
  acts.forEach((k, i) => (raw += ACTIONS[k].base * 0.85 ** i));
  const mult = pitchMult(s, x, st.pitch, d);
  let g = raw * mult;
  if (st.ofw === d.week) g += 3.5;
  if (st.vis === playedWeek && !st.visited) {
    const res = d.season?.results.find(r => r.w === playedWeek && (r.h === d.team || r.a === d.team));
    const won = res ? (res.h === d.team ? res.hs > res.as : res.as > res.hs) : false;
    g += 8 * (0.4 + gradeScore(s, x, 'Stadium Atmosphere', d) / 100) * (won ? 1.25 : 0.7) * (0.7 + 0.3 * Math.min(1.6, mult));
  }
  return (g * (0.9 + coordinator(s).closing / 500)) / difficulty(s, x) * dimin(cur);
}

/** End the week: your contact lands, rival programs recruit, lists are trimmed, decisions made. */
export function endWeek(d: Dynasty) {
  ensureWorld(d);
  const all = recruitClass(), me = d.team, played = d.week + 1, next = d.week + 1;
  freshCaches(d);
  const items: string[] = [];
  const tally: Record<number, { n: number; pos: Record<string, number> }> = {};
  for (const x of all) { const c = d.recruits[x.id].committed; if (c !== undefined) { const t = (tally[c] ??= { n: 0, pos: {} }); t.n++; t.pos[x.pos] = (t.pos[x.pos] ?? 0) + 1; } }
  const posCap: Record<string, number> = { QB: 2, RB: 3, WR: 5, TE: 2, OT: 4, G: 3, C: 2, EDGE: 4, DT: 4, LB: 4, CB: 4, S: 3, K: 1, P: 1 };
  const signing = next >= LAST_WEEK;
  for (const x of all) {
    const st = d.recruits[x.id];
    if (st.committed !== undefined) { touch(st, next); continue; }
    const onBoard = d.board.includes(x.id), name = `${x.fn} ${x.ln}`;
    // You.
    if (st.int[me] !== undefined) {
      const before = st.int[me], contact = actsThisWeek(d, st).some(k => k !== 'scout');
      let g = userGain(d, x, st, played);
      if (!contact && st.vis !== played) g -= onBoard ? 1.2 : 2.2;
      let v = Math.max(0, before + g);
      if (failsDeal(school(me), x, d)) v = Math.min(v, DEAL_CAP);
      st.int[me] = Math.round(Math.min(100, v) * 10) / 10;
      st.dl = Math.round((st.int[me] - before) * 10) / 10;
      if (st.vis === played && !st.visited) { st.visited = true; st.sc = Math.min(100, (st.sc ?? 0) + 25); say(st, played, `Official visit. Interest ${st.dl >= 0 ? '+' : ''}${st.dl}.`); items.push(`visit|${x.id}|${name} took his official visit (${st.dl >= 0 ? '+' : ''}${st.dl})`); }
      else if (onBoard && contact) say(st, played, `Interest ${st.dl >= 0 ? '+' : ''}${st.dl} (pitch: ${st.pitch ?? 'none'}).`);
    }
    // Rival programs.
    for (const sid of Object.keys(st.int).map(Number)) {
      if (sid === me) continue;
      const s = school(sid), t = tally[sid];
      if (t && t.n >= CLASS_MAX) continue;
      const busy = t && (t.pos[x.pos] ?? 0) >= posCap[x.pos] ? 0.2 : 1;
      const noise = 0.55 + u(`${x.id}-${sid}-${played}`) * 0.9;
      const g = (1.0 + s.prestige * 0.62) * (0.35 + fit(s, x, d) / 100 * 1.1) * noise * busy / difficulty(s, x) * dimin(st.int[sid]);
      let v = st.int[sid] + g;
      if (failsDeal(s, x, d)) v = Math.min(v, DEAL_CAP);
      st.int[sid] = Math.round(Math.min(100, v) * 10) / 10;
    }
    // Trim the list.
    const tl = timeline(x);
    const stg = next >= tl[2] ? 3 : next >= tl[1] ? 2 : next >= tl[0] ? 1 : 0;
    if (stg > (st.stg ?? 0)) {
      const out = cut(st, STAGE_N[stg]);
      st.stg = stg;
      if (out.includes(me)) { st.lostReason = 'Cut you from his list'; say(st, next, `Named his ${STAGES[stg]}. You did not make it.`); if (onBoard) items.push(`cut|${x.id}|${name} cut you from his ${STAGES[stg]}`); }
      else if (st.int[me] !== undefined && onBoard) items.push(`stage|${x.id}|${name} named his ${STAGES[stg]}: you are in`);
    }
    // Decide.
    const ranked = Object.entries(st.int).map(([k, v]) => [Number(k), v] as const).sort((a, b) => b[1] - a[1]);
    const [lead, second] = ranked;
    if (!lead) { touch(st, next); continue; }
    const margin = lead[1] - (second?.[1] ?? 0);
    const ready = next >= tl[3] && (((st.stg ?? 0) >= 3 && lead[1] >= COMMIT_AT[x.stars] && margin >= 6 + x.stars * 2) || ((st.stg ?? 0) >= 2 && lead[1] >= COMMIT_AT[x.stars] + 8 && margin >= 22));
    if (ready || signing) {
      let pickId = lead[0];
      if (pickId === me && !st.offered) {
        if (!signing) { say(st, next, 'He is ready to commit to you, but he has no offer.'); if (onBoard) items.push(`info|${x.id}|${name} wants to commit, but needs an offer`); touch(st, next); continue; }
        pickId = second?.[0] ?? -1;
      }
      if (pickId >= 0) {
        st.committed = pickId;
        if (pickId === me) { say(st, next, 'COMMITTED! He announced it at his school.'); items.push(`commit|${x.id}|${name} (${x.stars}★ ${x.pos}) committed to you`); }
        else if (st.int[me] !== undefined || onBoard) {
          const other = school(pickId);
          st.lostReason = failsDeal(school(me), x, d) ? `Dealbreaker: ${x.deal}` : (st.int[me] ?? 0) < lead[1] - 20 ? 'Not enough interest' : `Better fit at ${other.school}`;
          say(st, next, `Committed to ${other.school}. ${st.lostReason}.`);
          if (onBoard) items.push(`lost|${x.id}|${name} committed to ${other.school}`);
        }
      }
    }
    touch(st, next);
  }
  d.recap = { wk: next, items };
  d.week += 1; d.hours = hoursBudget(d);
  d.phase = d.week > 13 ? 'postseason' : d.week > 0 ? 'season' : 'preseason';
}

// ---- needs and rankings -----------------------------------------------------------------------------
const TARGET: Record<string, number> = { QB: 4, RB: 4, WR: 8, TE: 4, OT: 6, G: 5, C: 3, EDGE: 6, DT: 6, LB: 7, CB: 7, S: 5, K: 1, P: 1 };
/** How many of each position the program should sign: departing seniors plus thin spots. */
export function needs(sid: number): Record<string, number> {
  const out: Record<string, number> = {}, ros = rosterOf(sid);
  for (const pos of POSITIONS) {
    const all = ros.filter(p => p.pos === pos), leaving = all.filter(p => p.yr >= 4).length;
    out[pos] = Math.max(pos === 'K' || pos === 'P' ? 0 : 1, Math.min(5, Math.max(leaving, TARGET[pos] - (all.length - leaving))));
  }
  return out;
}
export const STAR_PTS = [0, 0, 20, 45, 90, 160];
/** Class points per school from commitments so far. */
export function classTable(d: Dynasty) {
  const pts: Record<number, { n: number; p: number; top: number }> = {};
  for (const x of recruitClass()) {
    const c = d.recruits[x.id]?.committed; if (c === undefined) continue;
    const e = (pts[c] ??= { n: 0, p: 0, top: 0 }); e.n++; e.p += STAR_PTS[x.stars]; e.top = Math.max(e.top, x.stars);
  }
  return Object.entries(pts).map(([id, v]) => ({ id: Number(id), ...v })).sort((a, b) => b.p - a.p);
}
/** The rating range a scout report shows: vague and off-centre at first, exact once fully scouted. */
export function ovrRange(x: Recruit, sc: number): [number, number] {
  const spread = sc >= 100 ? 0 : sc >= 75 ? 2 : sc >= 50 ? 4 : sc >= 25 ? 6 : 10;
  const c = x.ovr + Math.round(x.fuzz * spread * 0.6);
  return [Math.max(40, c - spread), Math.min(99, c + spread)];
}
/** What scouting has revealed: motivations known (0-3) and whether the dealbreaker is known. */
export const revealed = (sc: number) => ({ mot: sc >= 75 ? 3 : sc >= 50 ? 2 : sc >= 25 ? 1 : 0, deal: sc >= 50 });
