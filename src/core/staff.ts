// Coaching staff: every team carries an Offensive Coordinator, a Defensive Coordinator,
// a Special Teams Coordinator and a Strength & Conditioning coach under its head coach.
// Each has a rating, a scheme (coordinators), a trait, an age and a contract paid from a
// staff budget. They matter on game day (unit bonuses, kicking), in development (XP) and
// in the training room (recovery, injuries). Every offseason the market turns over,
// contracts run out, coaches age, and teams looking for a head coach poach the league's
// best coordinators; yours included.
import type { League, OffScheme, DefScheme, Player } from './types';
import { Rng, clamp, hash } from './rng';
import { mail, news } from './season';

export type StaffRole = 'OC' | 'DC' | 'ST' | 'SC';
export const ROLES: StaffRole[] = ['OC', 'DC', 'ST', 'SC'];
export const ROLE_NAME: Record<StaffRole, string> = { OC: 'Offensive Coordinator', DC: 'Defensive Coordinator', ST: 'Special Teams Coordinator', SC: 'Strength & Conditioning' };
export type StaffTrait = 'Play Caller' | 'Teacher' | 'Rising Star' | 'Scheme Flexible' | 'Injury Prevention' | 'Recovery Expert' | 'Kicking Guru' | 'Motivator';
export const TRAIT_DESC: Record<StaffTrait, string> = {
  'Play Caller': 'His game-day bonus is 40% stronger.',
  Teacher: 'His unit earns 10% more XP.',
  'Rising Star': 'Improves 2-3 points a year, but head-coach hunters notice.',
  'Scheme Flexible': 'No penalty when his scheme differs from the head coach.',
  'Injury Prevention': '10% fewer in-game injuries.',
  'Recovery Expert': '+4 condition recovered each week.',
  'Kicking Guru': 'Kickers and punters gain another +1.5.',
  Motivator: 'Players on the roster gain +1 morale a week.',
};
const TRAITS_FOR: Record<StaffRole, StaffTrait[]> = {
  OC: ['Play Caller', 'Teacher', 'Rising Star', 'Scheme Flexible'],
  DC: ['Play Caller', 'Teacher', 'Rising Star', 'Scheme Flexible'],
  ST: ['Kicking Guru', 'Teacher', 'Motivator', 'Rising Star'],
  SC: ['Injury Prevention', 'Recovery Expert', 'Motivator', 'Teacher'],
};
export const OFF_UNIT = new Set(['QB', 'RB', 'FB', 'WR', 'TE', 'OT', 'G', 'C']);
export const DEF_UNIT = new Set(['EDGE', 'DT', 'LB', 'CB', 'S']);
const OFF: OffScheme[] = ['West Coast', 'Vertical', 'Wide Zone', 'Power Run', 'Spread'];
const DEF: DefScheme[] = ['4-3 Over', '3-4 Two-Gap', 'Cover 3', 'Two-High', 'Blitz'];
export const COACH_FIRST = ['Mike', 'Dan', 'Kevin', 'Brian', 'Steve', 'Matt', 'Jim', 'Todd', 'Bill', 'Ron', 'Sean', 'Josh', 'Frank', 'Joe', 'Arthur', 'Aaron', 'Bobby', 'Klint', 'Anthony', 'Chris', 'Greg', 'Wink', 'Vic', 'Lou', 'Drew', 'Zac', 'Grant', 'Nick', 'Marcus', 'Darren'];
export const COACH_LAST = ['Johnson', 'Kubiak', 'Slowik', 'Fangio', 'Weaver', 'Grimes', 'Monken', 'Flores', 'Spagnuolo', 'Evero', 'Glenn', 'Joseph', 'Rizzi', 'Hafley', 'Udinski', 'Brady', 'Scheelhaase', 'Kafka', 'Petzing', 'Fassel', 'Martindale', 'Bieniemy', 'Kingsbury', 'Getsy', 'Hackett', 'Daboll', 'Graham', 'Wilks', 'Orr', 'Toub'];

export interface Staff { id: string; name: string; role: StaffRole; rating: number; age: number; scheme?: string; trait?: StaffTrait; salary: number; years: number }
interface StaffState { teams: Record<string, Partial<Record<StaffRole, Staff>>>; market: Staff[]; season: number; budget: Record<string, number>; declined: string[]; mayLeave?: string; n: number }
export const STAFF_BUDGET = 9_000_000;

/** Market salary for a coach of this rating and role. */
export const staffSalary = (role: StaffRole, rating: number) => Math.round((role === 'OC' || role === 'DC' ? 0.6 : 0.3) * Math.max(0.4, ((rating - 55) / 10) ** 1.6) * 1_000_000 / 50_000) * 50_000;

function makeStaff(st: StaffState, rng: Rng, role: StaffRole, rating?: number): Staff {
  const r = rating ?? Math.round(clamp(rng.normal(73, 8), 55, 94));
  const age = role === 'SC' ? rng.int(34, 62) : rng.int(36, 66);
  const trait = rng.chance(0.55) ? rng.pick(TRAITS_FOR[role]) : undefined;
  return {
    id: `st${++st.n}`, name: `${rng.pick(COACH_FIRST)} ${rng.pick(COACH_LAST)}`, role, rating: r, age,
    scheme: role === 'OC' ? rng.pick(OFF) : role === 'DC' ? rng.pick(DEF) : undefined,
    trait: trait === 'Rising Star' && age > 50 ? undefined : trait,
    salary: staffSalary(role, r), years: rng.int(1, 4),
  };
}

/** The league's staff, created on first use (also for saves from before staffs existed). */
export function staffState(L: League): StaffState {
  const S = L as League & { staff?: StaffState };
  if (S.staff) return S.staff;
  const rng = new Rng(hash(`staff-${L.seed}`));
  const st: StaffState = { teams: {}, market: [], season: L.season, budget: {}, declined: [], n: 0 };
  for (const t of Object.values(L.teams)) {
    const crew: Partial<Record<StaffRole, Staff>> = {};
    for (const role of ROLES) {
      const s = makeStaff(st, rng, role);
      // Most coordinators were hired to run the head coach's system.
      if (role === 'OC' && rng.chance(0.7)) s.scheme = t.coach.off;
      if (role === 'DC' && rng.chance(0.7)) s.scheme = t.coach.def;
      crew[role] = s;
    }
    st.teams[t.abbr] = crew;
  }
  refillMarket(st, rng);
  S.staff = st;
  return st;
}
function refillMarket(st: StaffState, rng: Rng) {
  const want: Record<StaffRole, number> = { OC: 7, DC: 7, ST: 4, SC: 4 };
  for (const role of ROLES) {
    let have = st.market.filter(s => s.role === role).length;
    while (have++ < want[role]) st.market.push(makeStaff(st, rng, role, Math.round(clamp(rng.normal(70, 8), 55, 90))));
  }
}

export const staffOf = (L: League, abbr: string) => staffState(L).teams[abbr] ?? {};
export const staffPayroll = (L: League, abbr: string) => Object.values(staffOf(L, abbr)).reduce((a, s) => a + (s?.salary ?? 0), 0) + (staffState(L).budget[abbr] ?? 0);

/** Does a coordinator's scheme match his head coach's? */
export function schemeFits(L: League, abbr: string, s: Staff) {
  const t = L.teams[abbr];
  return s.role === 'OC' ? s.scheme === t.coach.off : s.role === 'DC' ? s.scheme === t.coach.def : true;
}

/** Game-day rating bonus for one unit (offense or defense), from the coordinator. */
export function unitEdge(L: League, abbr: string, unit: 'OC' | 'DC'): number {
  const s = staffOf(L, abbr)[unit];
  if (!s) return -1;   // nobody calling plays: an interim assistant
  let v = (s.rating - 75) * 0.05 * (s.trait === 'Play Caller' ? 1.4 : 1);
  if (s.trait !== 'Scheme Flexible') v += schemeFits(L, abbr, s) ? 0.25 : -0.25;
  return v;
}
/** Kicker/punter bonus from the special teams coordinator. */
export function kickEdge(L: League, abbr: string): number {
  const s = staffOf(L, abbr).ST;
  return s ? (s.rating - 75) * 0.08 + (s.trait === 'Kicking Guru' ? 1.5 : 0) : -1;
}
/** XP multiplier for a player from his unit's coach. */
export function staffXpMult(L: League, p: Player): number {
  const crew = staffOf(L, p.team);
  const s = OFF_UNIT.has(p.pos) ? crew.OC : DEF_UNIT.has(p.pos) ? crew.DC : crew.ST;
  if (!s) return 0.95;
  return 1 + (s.rating - 75) * 0.004 + (s.trait === 'Teacher' ? 0.1 : 0) + (crew.SC?.trait === 'Teacher' ? 0.03 : 0);
}
/** Weekly condition recovery bonus from the strength staff. */
export function recoveryEdge(L: League, abbr: string): number {
  const s = staffOf(L, abbr).SC;
  return s ? (s.rating - 75) * 0.1 + (s.trait === 'Recovery Expert' ? 4 : 0) : -2;
}
/** Chance an in-game injury is avoided thanks to the strength staff (0..0.2). */
export function injuryShield(L: League, abbr: string): number {
  const s = staffOf(L, abbr).SC;
  return s ? clamp((s.rating - 75) * 0.004, -0.06, 0.08) + (s.trait === 'Injury Prevention' ? 0.1 : 0) : -0.06;
}
export const moraleBoost = (L: League, abbr: string) => Object.values(staffOf(L, abbr)).some(s => s?.trait === 'Motivator') ? 1 : 0;

/** One-line description of what this coach is doing for the team right now. */
export function staffEffect(L: League, abbr: string, s: Staff): string {
  if (s.role === 'OC' || s.role === 'DC') { const v = unitEdge(L, abbr, s.role); return `${v >= 0 ? '+' : ''}${v.toFixed(2)} to the ${s.role === 'OC' ? 'offense' : 'defense'} on game day · ${fmtPct(staffXpUnit(s))} unit XP`; }
  if (s.role === 'ST') { const v = kickEdge(L, abbr); return `${v >= 0 ? '+' : ''}${v.toFixed(1)} kicking and punting · ${fmtPct(staffXpUnit(s))} specialist XP`; }
  const r = recoveryEdge(L, abbr), i = injuryShield(L, abbr);
  return `${r >= 0 ? '+' : ''}${r.toFixed(1)} weekly recovery · ${i > 0 ? '−' : '+'}${Math.abs(Math.round(i * 100))}% in-game injuries`;
}
const staffXpUnit = (s: Staff) => (s.rating - 75) * 0.004 + (s.trait === 'Teacher' ? 0.1 : 0);
const fmtPct = (v: number) => `${v >= 0 ? '+' : ''}${Math.round(v * 100)}%`;

// ---- hiring ---------------------------------------------------------------------------------
/** How much a candidate wants to work for this team (0..1). Stable within a season. */
export function interest(L: League, abbr: string, s: Staff): number {
  const games = L.games.filter(g => g.result && (g.home === abbr || g.away === abbr) && g.season >= L.season - 1);
  const wins = games.filter(g => (g.home === abbr ? g.result!.hs > g.result!.as : g.result!.as > g.result!.hs)).length;
  const winPct = games.length ? wins / games.length : 0.5;
  const fit = s.role === 'OC' || s.role === 'DC' ? (schemeFits(L, abbr, s) ? 0.12 : -0.05) : 0;
  const lvl = abbr === L.user ? L.coachTree.level * 0.01 : 0;
  const noise = ((hash(`${s.id}-${abbr}-${L.season}`) >>> 0) % 100) / 100 * 0.2 - 0.1;
  return clamp(0.55 + (winPct - 0.5) * 0.6 + fit + lvl - (s.rating - 72) * 0.012 + noise, 0.05, 0.97);
}
export type HireResult = { ok: true } | { ok: false; reason: string };
/** Try to hire a market coach into his role, replacing whoever holds it. */
export function hire(L: League, abbr: string, id: string): HireResult {
  const st = staffState(L);
  const s = st.market.find(x => x.id === id);
  if (!s) return { ok: false, reason: 'He is no longer available.' };
  if (st.declined.includes(`${abbr}:${id}`)) return { ok: false, reason: `${s.name} already turned you down this year.` };
  const cur = st.teams[abbr][s.role];
  const room = STAFF_BUDGET - staffPayroll(L, abbr) + (cur ? cur.salary : 0);
  if (s.salary > room) return { ok: false, reason: `Over the staff budget: ${money(s.salary)} asked, ${money(Math.max(0, room))} available.` };
  if (interest(L, abbr, s) < 0.5) { st.declined.push(`${abbr}:${id}`); return { ok: false, reason: `${s.name} took another job. He did not see the fit.` }; }
  if (cur) fire(L, abbr, s.role, true);
  st.market = st.market.filter(x => x.id !== id);
  st.teams[abbr][s.role] = s;
  if (abbr === L.user) news(L, 'coach', `The ${L.teams[abbr].nick} hired ${s.name} as ${ROLE_NAME[s.role].toLowerCase()}.`, [abbr]);
  return { ok: true };
}
/** Let a coach go: he joins the market; his salary for this season stays on the books. */
export function fire(L: League, abbr: string, role: StaffRole, quiet = false) {
  const st = staffState(L);
  const s = st.teams[abbr][role];
  if (!s) return;
  st.budget[abbr] = (st.budget[abbr] ?? 0) + s.salary;
  delete st.teams[abbr][role];
  st.market.push({ ...s, years: 0 });
  st.declined.push(`${abbr}:${s.id}`);   // he won't come straight back
  if (!quiet && abbr === L.user) news(L, 'coach', `The ${L.teams[abbr].nick} fired ${ROLE_NAME[role].toLowerCase()} ${s.name}.`, [abbr]);
}
/** Extend a coach two more years at his market rate. */
export function extend(L: League, abbr: string, role: StaffRole): HireResult {
  const s = staffOf(L, abbr)[role];
  if (!s) return { ok: false, reason: 'Nobody in that role.' };
  if (s.years >= 3) return { ok: false, reason: `${s.name} is already signed through ${L.season + s.years - 1}.` };
  const pay = staffSalary(role, s.rating);
  if (pay - s.salary > STAFF_BUDGET - staffPayroll(L, abbr)) return { ok: false, reason: 'Not enough room in the staff budget.' };
  s.salary = Math.max(s.salary, pay); s.years += 2;
  return { ok: true };
}

/** AI teams fill any empty chair with the best fit they can afford. */
function aiFill(L: League, rng: Rng) {
  const st = staffState(L);
  for (const t of Object.values(L.teams)) {
    if (t.abbr === L.user) continue;
    for (const role of ROLES) {
      if (st.teams[t.abbr][role]) continue;
      const pool = st.market.filter(s => s.role === role).sort((a, b) => b.rating + (schemeFits(L, t.abbr, b) ? 4 : 0) - (a.rating + (schemeFits(L, t.abbr, a) ? 4 : 0)));
      const pick = pool[Math.min(pool.length - 1, rng.int(0, 2))];
      if (!pick) { st.teams[t.abbr][role] = makeStaff(st, rng, role, rng.int(58, 68)); continue; }
      st.market = st.market.filter(s => s !== pick);
      pick.years = rng.int(2, 4);
      st.teams[t.abbr][role] = pick;
    }
  }
}

/**
 * A team needs a head coach: half the time it promotes a top coordinator from another
 * staff. Returns his name and the scheme he brings, or nothing (an outside hire).
 */
export function poachHeadCoach(L: League, rng: Rng, hiring: string): { name: string; off?: OffScheme; def?: DefScheme; rating: number } | undefined {
  const st = staffState(L);
  if (!rng.chance(0.5)) return undefined;
  const cands: [string, Staff][] = [];
  for (const [abbr, crew] of Object.entries(st.teams)) for (const role of ['OC', 'DC'] as const) {
    const s = crew[role];
    if (s && abbr !== hiring && s.age <= 60 && s.rating >= 80) cands.push([abbr, s]);
  }
  if (!cands.length) return undefined;
  const w = cands.map(([a, s]) => [[a, s], (s.rating - 75) * (s.trait === 'Rising Star' ? 2 : 1) * (s.id === st.mayLeave ? 4 : 1)] as const);
  const [from, s] = rng.weighted(w);
  delete st.teams[from][s.role];
  const team = L.teams[from];
  news(L, 'coach', `The ${L.teams[hiring].nick} hired ${team.nick} ${s.role === 'OC' ? 'offensive' : 'defensive'} coordinator ${s.name} as their head coach.`, [hiring, from], { big: from === L.user });
  if (from === L.user) mail(L, 'Front Office', `${s.name} is leaving`, `The ${L.teams[hiring].name} hired ${s.name} as their head coach. Your ${ROLE_NAME[s.role].toLowerCase()} job is open: an interim assistant is calling plays until you hire someone from Coach Central → Coaching Staff.`);
  return { name: s.name, off: s.role === 'OC' ? s.scheme as OffScheme : undefined, def: s.role === 'DC' ? s.scheme as DefScheme : undefined, rating: Math.round(clamp(s.rating - 6, 60, 88)) };
}

/** The new league year: contracts, aging, growth, and a fresh market. Runs after the coaching carousel. */
export function staffOffseason(L: League, rng: Rng) {
  const st = staffState(L);
  st.budget = {}; st.declined = []; st.mayLeave = undefined;
  // The unsigned market ages out; a new class arrives.
  st.market = st.market.filter(s => rng.chance(0.5) && s.age < 64).map(s => ({ ...s, age: s.age + 1, salary: staffSalary(s.role, s.rating), years: rng.int(1, 4) }));
  const leaving: string[] = [];
  for (const [abbr, crew] of Object.entries(st.teams)) for (const role of ROLES) {
    const s = crew[role];
    if (!s) continue;
    s.age++;
    s.rating = clamp(Math.round(s.rating + (s.trait === 'Rising Star' ? rng.int(2, 3) : s.age > 62 ? -rng.int(1, 3) : rng.int(-1, 2))), 50, 97);
    s.years--;
    if (s.years > 0) continue;
    if (s.age >= 68 || rng.chance(abbr === L.user ? (s.rating >= 72 ? 0.1 : 0.6) : 0.35)) {
      delete crew[role];
      if (s.age < 68) st.market.push({ ...s, salary: staffSalary(role, s.rating), years: rng.int(1, 4) });
      if (abbr === L.user) leaving.push(`${s.name} (${ROLE_NAME[role]}, ${s.rating}) ${s.age >= 68 ? 'retired' : 'did not re-sign and is on the market'}.`);
    } else {
      s.years = rng.int(2, 3); s.salary = Math.max(s.salary, staffSalary(role, s.rating));
      if (abbr === L.user) leaving.push(`${s.name} (${ROLE_NAME[role]}) re-signed for ${s.years} years at ${money(s.salary)} a year.`);
    }
  }
  refillMarket(st, rng);
  aiFill(L, rng);
  st.season = L.season;
  if (leaving.length) mail(L, 'Front Office', 'Coaching staff contracts', leaving.join('\n') + (ROLES.some(r => !st.teams[L.user][r]) ? '\n\nYou have open jobs on your staff. Hire from Coach Central → Coaching Staff.' : ''));
}

/** Weekly: fill AI vacancies mid-season, motivators lift the room. */
export function staffWeekly(L: League) {
  const st = staffState(L);
  if (Object.entries(st.teams).some(([a, c]) => a !== L.user && ROLES.some(r => !c[r]))) aiFill(L, new Rng(hash(`sw-${L.seed}-${L.season}-${L.week}`)));
}
const money = (v: number) => `$${(v / 1_000_000).toFixed(v >= 10_000_000 ? 0 : 1)}M`;
