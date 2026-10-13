// Recruiting: the class of 2027. 520 fictional high-school prospects (names, faces and ratings
// are generated; no real minors). Each has hidden priorities: the three that matter most decide
// where he signs. Scouting and visits reveal them; pitching a priority he cares about, where your
// program grades well, moves him. Rival programs recruit him every week, and a recruit who hears
// nothing from you cools off. He commits once one school leads clearly (he needs an offer).
import { SCHOOLS, rosterOf, school, type School } from './data';
import type { Dynasty, RecruitState } from './store';

export const PRIORITIES = ['Playing Time', 'NIL Money', 'Championship Contender', 'Close to Home', 'Program Prestige', 'Pro Potential', 'Academics', 'Coach Stability', 'Campus Life'] as const;
export type Priority = (typeof PRIORITIES)[number];
export interface Recruit { id: string; n: number; fn: string; ln: string; pos: string; stars: number; rank: number; posRank: number; state: string; city: string; ht: number; wt: number; ovr: number; pot: number; pri: Priority[]; schools: number[]; face: number }

const FN = ['Jaylen', 'Marcus', 'Tre', 'Kendrick', 'Cole', 'Brady', 'Isaiah', 'Dominic', 'Xavier', 'Camden', 'Malik', 'Trey', 'Jordan', 'Elijah', 'Gavin', 'Josiah', 'Caden', 'Tyrell', 'Bryce', 'Jalen', 'Derrick', 'Micah', 'Landon', 'Kobe', 'Amari', 'Ty', 'Quentin', 'Rashad', 'Owen', 'Deshawn', 'Nolan', 'Zion', 'Carter', 'Jace', 'Kingston', 'Rocco', 'Dante', 'Terrell', 'Hunter', 'Andre', 'Bishop', 'Cayden', 'Darius', 'Emmanuel', 'Fabian', 'Garrett', 'Hollis', 'Ivan', 'Jabari', 'Keon', 'Lamar', 'Maddox', 'Nehemiah', 'Omari', 'Pierce', 'Quincy', 'Roman', 'Sincere', 'Tobias', 'Ulysses', 'Vince', 'Wyatt', 'Xzavier', 'Yusuf', 'Zay'];
const LN = ['Whitfield', 'Okoro', 'Banks', 'Hollins', 'McCray', 'Pruitt', 'Delacroix', 'Sutton', 'Ivory', 'Kincaid', 'Abernathy', 'Rollins', 'Vance', 'Tate', 'Ashby', 'Boykin', 'Calloway', 'Dandridge', 'Ellerbe', 'Fontenot', 'Gaines', 'Haskins', 'Ingram', 'Jeffries', 'Kemp', 'Lattimore', 'Mabry', 'Nwosu', 'Odom', 'Pettaway', 'Quarles', 'Redd', 'Strother', 'Thibodeaux', 'Underwood', 'Varner', 'Whitlock', 'Yarbrough', 'Zeigler', 'Adebayo', 'Bellamy', 'Cormier', 'Dukes', 'Easley', 'Fair', 'Gatling', 'Holloway', 'Iverson', 'Jessup', 'Knox', 'Lockett', 'Mayfield', 'Nesbitt', 'Ogletree', 'Prather', 'Rountree', 'Shelton', 'Tolbert', 'Vickers', 'Winfrey', 'Yancey', 'Alston', 'Burrell', 'Castile', 'Driscoll'];
const STATES: [string, number, string[]][] = [['TX', 16, ['Houston', 'Dallas', 'Austin', 'San Antonio', 'Katy', 'Allen', 'Duncanville']], ['FL', 14, ['Miami', 'Tampa', 'Jacksonville', 'Orlando', 'Fort Lauderdale']], ['GA', 11, ['Atlanta', 'Savannah', 'Buford', 'Valdosta']], ['CA', 9, ['Los Angeles', 'San Diego', 'Sacramento', 'Mission Viejo']], ['AL', 5, ['Birmingham', 'Mobile', 'Hoover']], ['LA', 5, ['New Orleans', 'Baton Rouge', 'Shreveport']], ['OH', 5, ['Columbus', 'Cincinnati', 'Massillon']], ['NC', 4, ['Charlotte', 'Raleigh']], ['PA', 4, ['Pittsburgh', 'Philadelphia']], ['MI', 3, ['Detroit', 'Grand Rapids']], ['TN', 4, ['Nashville', 'Memphis']], ['SC', 3, ['Columbia', 'Greenville']], ['MS', 3, ['Jackson', 'Starkville']], ['VA', 3, ['Richmond', 'Norfolk']], ['NJ', 3, ['Newark', 'Paramus']], ['AZ', 2, ['Phoenix', 'Chandler']], ['IL', 2, ['Chicago']], ['MD', 2, ['Baltimore']], ['OK', 2, ['Tulsa']], ['MO', 1, ['St. Louis']], ['IN', 1, ['Indianapolis']], ['WA', 1, ['Seattle']], ['UT', 1, ['Salt Lake City']], ['NV', 1, ['Las Vegas']], ['KY', 1, ['Louisville']]];
const MIX: [string, number][] = [['QB', 32], ['RB', 40], ['WR', 70], ['TE', 26], ['OT', 44], ['G', 26], ['C', 10], ['EDGE', 52], ['DT', 44], ['LB', 46], ['CB', 64], ['S', 46], ['K', 6], ['P', 4]];
const SIZE: Record<string, [number, number]> = { QB: [75, 205], RB: [70, 200], WR: [72, 182], TE: [76, 230], OT: [78, 295], G: [76, 300], C: [75, 290], EDGE: [76, 240], DT: [75, 290], LB: [73, 220], CB: [71, 178], S: [72, 192], K: [72, 180], P: [74, 195] };

let cache: Recruit[] | null = null;
/** The class of 2027 (seeded, so the same every session). */
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
    const pri = [...PRIORITIES].sort(() => r() - 0.5);
    out.push({ id: `R${i}`, n: i, fn, ln, pos, stars, rank: 0, posRank: 0, state: st[0], city: pick(st[2]), ht: H + Math.round((r() - 0.5) * 4), wt: W + Math.round((r() - 0.5) * 30), ovr, pot: Math.min(97, ovr + 12 + Math.round(r() * 14)), pri, schools: [], face: i });
  });
  out.sort((a, b) => b.ovr + b.stars * 3 - (a.ovr + a.stars * 3)).forEach((x, i) => { x.rank = i + 1; });
  const byPos: Record<string, number> = {};
  for (const x of out) x.posRank = (byPos[x.pos] = (byPos[x.pos] ?? 0) + 1);
  // Who recruits him: elite prospects hear from the elite programs, everyone hears from home.
  for (const x of out) {
    const near = SCHOOLS.filter(s => homeState(s) === x.state);
    const tierPool = SCHOOLS.filter(s => (x.stars >= 5 ? s.prestige >= 4 : x.stars === 4 ? s.prestige >= 3 : x.stars === 3 ? s.prestige <= 4 : s.prestige <= 2));
    const set = new Set<number>();
    for (const s of near.sort(() => r() - 0.5).slice(0, 2)) if (s.prestige + 1 >= x.stars - 1) set.add(s.id);
    while (set.size < 3 + Math.floor(r() * 3)) set.add(pick(tierPool.length ? tierPool : SCHOOLS).id);
    x.schools = [...set];
  }
  cache = out;
  return out;
}

// A program's home state: the most common home state on its roster (good enough for "close to home").
const homes = new Map<number, string>();
export function homeState(s: School) {
  let st = homes.get(s.id);
  if (!st) { const c: Record<string, number> = {}; for (const p of rosterOf(s.id)) { const m = p.home?.match(/, ([A-Z]{2})$/); if (m) c[m[1]] = (c[m[1]] ?? 0) + 1; } st = Object.entries(c).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '??'; homes.set(s.id, st); }
  return st;
}
const ACADEMIC = new Set(['Stanford', 'Notre Dame', 'Northwestern', 'Vanderbilt', 'Duke', 'Rice', 'Michigan', 'California', 'UCLA', 'Georgia Tech', 'Wake Forest', 'Virginia', 'North Carolina', 'USC', 'Boston College', 'Florida', 'Texas', 'Navy', 'Army', 'Tulane', 'SMU', 'Pittsburgh', 'Miami']);
const h = (s: string) => { let x = 2166136261; for (let i = 0; i < s.length; i++) x = Math.imul(x ^ s.charCodeAt(i), 16777619); return x >>> 0; };
/** How well a program sells one priority to one recruit, 0-100. */
export function grade(s: School, x: Recruit, p: Priority, nil = 0): number {
  switch (p) {
    case 'Playing Time': { const st = rosterOf(s.id).filter(q => q.pos === x.pos).slice(0, 2); const bar = st.length ? st[st.length - 1].ovr : 50; return clamp(70 + (x.pot - 6 - bar) * 3); }
    case 'NIL Money': return clamp(s.prestige * 14 + nil / 8000);
    case 'Championship Contender': return clamp((s.ovr - 64) * 3);
    case 'Close to Home': return homeState(s) === x.state ? 98 : 35 + (h(s.school + x.state) % 25);
    case 'Program Prestige': return clamp(s.prestige * 20 - 4);
    case 'Pro Potential': return clamp(s.prestige * 12 + (s.ovr - 70) * 2);
    case 'Academics': return ACADEMIC.has(s.school) ? 88 + (h(s.school) % 10) : 45 + (h(s.school) % 35);
    case 'Coach Stability': return clamp(55 + s.prestige * 6);
    case 'Campus Life': return 50 + (h(s.school + 'campus') % 48);
  }
}
const clamp = (v: number) => Math.round(Math.max(5, Math.min(99, v)));
export const letter = (g: number) => (g >= 93 ? 'A+' : g >= 85 ? 'A' : g >= 78 ? 'B+' : g >= 70 ? 'B' : g >= 62 ? 'C+' : g >= 54 ? 'C' : g >= 45 ? 'D' : 'F');
/** Overall fit: his top three priorities, weighted 50/30/20. */
export const fit = (s: School, x: Recruit, nil = 0) => Math.round(grade(s, x, x.pri[0], nil) * 0.5 + grade(s, x, x.pri[1], nil) * 0.3 + grade(s, x, x.pri[2], nil) * 0.2);

/** Interest from each rival at a given week, for a recruit you have not touched (deterministic). */
function rivalInterest(x: Recruit, sid: number, week: number) {
  const s = school(sid);
  return Math.min(100, Math.round(18 + (h(x.id + sid) % 14) + week * (1.6 + fit(s, x) / 40)));
}
export function stateOf(d: Dynasty, x: Recruit): RecruitState {
  return d.recruits[x.id] ?? { int: Object.fromEntries(x.schools.filter(id => id !== d.team).map(id => [id, rivalInterest(x, id, d.week)])), scouted: 0, offered: false, nil: 0, log: [] };
}
/** Where an untouched recruit stands: committed to a rival already, or still open. */
export function untouchedCommit(x: Recruit, week: number, mine: number): number | undefined {
  const ids = x.schools.filter(id => id !== mine);
  const scores = ids.map(id => [id, rivalInterest(x, id, week)] as const).sort((a, b) => b[1] - a[1]);
  const commitWeek = 4 + (h(x.id + 'cw') % 12) - (x.stars >= 5 ? 0 : 2);
  return week >= commitWeek && scores[0] && scores[0][1] >= 60 ? scores[0][0] : undefined;
}

export const COST = { scout: 6, call: 3, sell: 10, visit: 15 };
export const HOURS = 50, SCHOLARSHIPS = 25;
const say = (st: RecruitState, w: number, t: string) => { st.log.unshift(`Wk ${w}: ${t}`); st.log.length = Math.min(st.log.length, 12); };

/** One recruiting action from you this week. Returns a line for the log. */
export function act(d: Dynasty, x: Recruit, kind: 'scout' | 'call' | 'sell' | 'visit' | 'offer' | 'nil', arg?: Priority | number): string {
  const me = school(d.team), st = stateOf(d, x);
  if (st.committed) return 'He has already committed.';
  const mine = st.int[d.team] ?? 0;
  const cost = kind === 'scout' ? COST.scout : kind === 'call' ? COST.call : kind === 'sell' ? COST.sell : kind === 'visit' ? COST.visit : 0;
  if (cost > d.hours) return 'Not enough recruiting hours left this week.';
  d.hours -= cost;
  let msg = '';
  const reveal = () => { if (st.scouted < 3) { st.scouted++; return ` You learned his #${st.scouted} priority: ${x.pri[st.scouted - 1]}.`; } return ''; };
  if (kind === 'scout') { st.int[d.team] = mine + 1; msg = `Scouted his film and spoke to his coach.${reveal()}`; }
  if (kind === 'call') { st.int[d.team] = mine + 3; msg = 'Good phone call. He sounds interested.'; }
  if (kind === 'visit') { st.int[d.team] = mine + 9; msg = `Home visit with his family.${reveal()}`; }
  if (kind === 'offer') {
    const used = Object.values(d.recruits).filter(r => r.offered).length;
    if (st.offered) return 'You already offered him.';
    if (used >= SCHOLARSHIPS) return 'You are out of scholarships.';
    st.offered = true; st.int[d.team] = mine + 6; msg = 'Scholarship offered. He posted it on social media.';
  }
  if (kind === 'nil') {
    const amt = Number(arg) || 0;
    if (amt > d.nilBudget + st.nil) return 'The collective cannot cover that.';
    d.nilBudget -= amt - st.nil; const before = st.nil; st.nil = amt;
    const rank = x.pri.indexOf('NIL Money');
    const gain = Math.round(((amt - before) / 25000) * (rank === 0 ? 2.2 : rank === 1 ? 1.5 : rank === 2 ? 1 : 0.3));
    st.int[d.team] = mine + gain; msg = `NIL package set at $${Math.round(amt / 1000)}K.${rank >= 0 && rank < 3 ? ' That matters to him.' : ' He barely reacted.'}`;
  }
  if (kind === 'sell') {
    if (st.hard) { d.hours += cost; return 'You already made your big pitch this week.'; }
    const p = arg as Priority, rank = x.pri.indexOf(p), g = grade(me, x, p, st.nil);
    st.hard = true;
    if (rank >= 0 && rank < 3) {
      const gain = Math.round((g - 45) / 4 * [1.6, 1.15, 0.8][rank] + 3);
      st.int[d.team] = Math.max(0, mine + gain);
      msg = gain > 6 ? `Hard sell on ${p} landed. He lit up.` : gain > 0 ? `Pitched ${p}. He listened.` : `Pitched ${p}, but your program grades poorly there. It backfired.`;
      if (rank >= st.scouted) { st.scouted = Math.max(st.scouted, 0); msg += ' (It is one of his top priorities.)'; }
    } else { st.int[d.team] = Math.max(0, mine - 3); msg = `Pitched ${p}. He does not care about that. Wasted pitch.`; }
  }
  st.int[d.team] = Math.min(100, st.int[d.team]);
  st.lastTouch = d.week;
  say(st, d.week, msg);
  d.recruits[x.id] = st;
  if (!d.board.includes(x.id)) d.board.push(x.id);
  return msg;
}

/** End the week: rivals recruit, the neglected cool off, and anyone with a clear leader commits. */
export function endWeek(d: Dynasty) {
  const all = recruitClass();
  for (const id of d.board) {
    const x = all.find(r => r.id === id)!, st = stateOf(d, x);
    if (st.committed) continue;
    for (const sid of Object.keys(st.int).map(Number)) {
      if (sid === d.team) continue;
      const s = school(sid);
      st.int[sid] = Math.min(100, st.int[sid] + Math.round(1.4 + fit(s, x) / 45 + ((h(x.id + sid + d.week) % 100) / 100) * 2));
    }
    if ((st.lastTouch ?? -1) < d.week) { st.int[d.team] = Math.max(0, (st.int[d.team] ?? 0) - 3); say(st, d.week, 'No contact this week. His interest dropped.'); }
    const ranked = Object.entries(st.int).map(([k, v]) => [Number(k), v] as const).sort((a, b) => b[1] - a[1]);
    const [lead, second] = ranked;
    if (d.week >= 3 && lead && lead[1] >= 72 && lead[1] - (second?.[1] ?? 0) >= 8) {
      if (lead[0] === d.team && !st.offered) say(st, d.week, 'He wants to commit to you, but you have not offered him.');
      else {
        st.committed = lead[0];
        if (lead[0] !== d.team) {
          const mineNil = st.nil, nilRank = x.pri.indexOf('NIL Money');
          st.lostReason = nilRank >= 0 && nilRank < 3 && mineNil < 50000 ? 'Lost on NIL money' : (st.int[d.team] ?? 0) < 40 ? 'Lack of interest' : 'Better fit elsewhere';
          say(st, d.week, `Committed to ${school(lead[0]).school}. ${st.lostReason}.`);
        } else say(st, d.week, 'COMMITTED! He announced it at his school.');
      }
    }
    st.hard = false;
    d.recruits[x.id] = st;
  }
  d.week += 1; d.hours = HOURS;
  d.phase = d.week > 13 ? 'postseason' : d.week > 0 ? 'season' : 'preseason';
}
