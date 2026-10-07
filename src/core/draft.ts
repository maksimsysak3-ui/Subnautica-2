// Draft classes, Madden-style scouting, the combine, draft order, AI boards and picks.
import type { League, Player, Pos } from './types';
import { Rng, clamp, hash } from './rng';
import { archetype, assignAbilities, buildAttrs, devTrait, overall } from './ratings';
import { emptyLine, rollMotivations } from './league';
import { rookieContract } from './contracts';
import data from '../data/league.json';

interface RealProspect { id: string; fn: string; ln: string; pos: Pos; col: string; colLogo?: string; hs?: string; ht: number; wt: number; dy: number; cls: number; rank: number; ovr: number; /** Scouting-board grade, when known (tools/scouting.json). */ g?: number }
const REAL_PROSPECTS = ((data as unknown as { prospects?: RealProspect[] }).prospects ?? []);
const SEASON_DATA = (data as unknown as { season: number }).season;
import { standings, REG_WEEKS, news, mail } from './season';

// Positions in a real class (per ~260 draftable prospects).
const CLASS_MIX: [Pos, number][] = [
  ['QB', 14], ['RB', 22], ['FB', 3], ['WR', 38], ['TE', 16], ['OT', 22], ['G', 18], ['C', 8],
  ['EDGE', 30], ['DT', 24], ['LB', 22], ['CB', 34], ['S', 20], ['K', 4], ['P', 4], ['LS', 2],
];
const COLLEGES = ['Alabama', 'Georgia', 'Ohio State', 'Michigan', 'LSU', 'Texas', 'Oregon', 'Penn State', 'Clemson', 'Notre Dame', 'USC', 'Florida', 'Florida State', 'Miami', 'Oklahoma', 'Tennessee', 'Texas A&M', 'Auburn', 'Washington', 'Utah', 'Iowa', 'Wisconsin', 'Ole Miss', 'Missouri', 'Kentucky', 'South Carolina', 'Arizona State', 'UCLA', 'Colorado', 'Louisville', 'NC State', 'North Carolina', 'Duke', 'Virginia Tech', 'Pittsburgh', 'Boise State', 'TCU', 'Baylor', 'Kansas State', 'Iowa State', 'Minnesota', 'Nebraska', 'Purdue', 'Illinois', 'Arkansas', 'Mississippi State', 'Texas Tech', 'BYU', 'SMU', 'Tulane', 'Memphis', 'Toledo', 'Western Michigan', 'App State', 'James Madison', 'North Dakota State', 'Montana', 'South Dakota State', 'Houston', 'Cincinnati'];
const FIRST = ['Jalen', 'Marcus', 'Tyler', 'Jaylen', 'Caleb', 'Malik', 'Brandon', 'Darius', 'Xavier', 'Isaiah', 'Elijah', 'Josh', 'Cam', 'Trey', 'Devin', 'Jordan', 'Chris', 'Tre', 'Bryce', 'Garrett', 'Luke', 'Will', 'Mason', 'Drake', 'Kendrick', 'DeShawn', 'Quinton', 'Amari', 'Zion', 'Jaxon', 'Carson', 'Hunter', 'Cole', 'Dylan', 'Nick', 'Bo', 'Kobe', 'Treveyon', 'Javon', 'Kenneth', 'Rashad', 'Terrell', 'Andre', 'Micah', 'Nolan', 'Ty', 'Keon', 'Jayden', 'Kyren', 'Sam', 'Ryan', 'Matt', 'Austin', 'Davion', 'Jamari', 'Tavion', 'Omarion', 'Ja\'Quan', 'Kamari', 'Bryson', 'Landon', 'Grant', 'Owen', 'Princeton', 'Darnell', 'Emeka', 'Tetairoa', 'Kalen', 'Marvin', 'Rome', 'Keandre', 'Troy', 'Ashton', 'Ricky', 'Shedeur', 'Jahdae', 'Mykel', 'Quinshon'];
const LAST = ['Johnson', 'Williams', 'Smith', 'Brown', 'Jackson', 'Davis', 'Harris', 'Thomas', 'Robinson', 'Walker', 'Allen', 'Young', 'King', 'Wright', 'Scott', 'Green', 'Baker', 'Adams', 'Nelson', 'Carter', 'Mitchell', 'Turner', 'Phillips', 'Campbell', 'Parker', 'Evans', 'Edwards', 'Collins', 'Stewart', 'Morris', 'Rogers', 'Reed', 'Cook', 'Bell', 'Murphy', 'Bailey', 'Cooper', 'Richardson', 'Howard', 'Ward', 'Watson', 'Brooks', 'Sanders', 'Price', 'Bennett', 'Wood', 'Barnes', 'Henderson', 'Coleman', 'Jenkins', 'Perry', 'Powell', 'Long', 'Patterson', 'Hughes', 'Washington', 'Simmons', 'Foster', 'Bryant', 'Alexander', 'Griffin', 'Hayes', 'Myers', 'Ford', 'Hamilton', 'Graham', 'Sullivan', 'Wallace', 'Woods', 'Cole', 'West', 'Jordan', 'Owens', 'Reynolds', 'Fisher', 'Ellis', 'Gibson', 'McDonald', 'Marshall', 'Mosley', 'Okafor', 'Tagovailoa', 'Nwosu', 'Fautanu', 'Ezeiruaku', 'Mafah', 'Batiste', 'Thibodeaux', 'Fontenot'];

const HEIGHT: Record<Pos, [number, number]> = { QB: [75, 1.5], RB: [70.5, 1.5], FB: [72.5, 1], WR: [72.5, 2], TE: [76.5, 1.2], OT: [77.5, 1], G: [76, 1], C: [75, 0.8], EDGE: [76, 1.2], DT: [75, 1.2], LB: [73.5, 1.2], CB: [71.5, 1.3], S: [72, 1.3], K: [72, 2], P: [74, 2], LS: [74, 1.5] };
const WEIGHT: Record<Pos, [number, number]> = { QB: [220, 10], RB: [212, 12], FB: [245, 8], WR: [198, 12], TE: [250, 9], OT: [314, 10], G: [314, 9], C: [303, 8], EDGE: [256, 12], DT: [305, 14], LB: [236, 9], CB: [192, 8], S: [204, 9], K: [195, 12], P: [210, 12], LS: [240, 8] };

/**
 * A class: true ratings and potential, a consensus board that is noisy about them,
 * and combine numbers derived from the athlete. Top of a class is ~70-80 OVR now.
 */
export function generateClass(league: League, year: number): Player[] {
  const rng = new Rng(hash(`class-${league.seed}-${year}`));
  const real = REAL_PROSPECTS.filter(r => r.dy === year);
  if (real.length) return realClass(league, year, real, rng);
  const pool: Pos[] = [];
  for (const [pos, n] of CLASS_MIX) for (let i = 0; i < n + rng.int(-2, 3); i++) pool.push(pos);
  rng.shuffle(pool);
  const prospects: Player[] = [];
  pool.forEach((pos, i) => {
    // Talent: a long tail, so a few blue-chippers and many projects.
    const tier = Math.pow(rng.next(), 1.6);
    let ovr = Math.round(clamp(46 + (1 - tier) * 30 + rng.normal(0, 3.5), 40, 81));
    if (['K', 'P', 'LS'].includes(pos)) ovr = Math.min(ovr, 74);
    const age = rng.chance(0.25) ? 21 : rng.chance(0.7) ? 22 : 23;
    const ht = Math.round(rng.normal(...HEIGHT[pos])), wt = Math.round(rng.normal(...WEIGHT[pos]));
    const attrs = buildAttrs({ pos, ovr, age, ht, wt }, rng);
    const real = overall(pos, attrs);
    const dev = devTrait(real + rng.normal(4, 4), age, rng);
    const growth = { Normal: 4, Star: 8, Superstar: 12, 'X-Factor': 15 }[dev];
    const pot = Math.round(clamp(real + growth + rng.normal(0, 4), real + 2, 99));
    const { abil, xf } = assignAbilities(pos, attrs, dev, rng);
    const p: Player = {
      id: `P${year}-${i}`, fn: rng.pick(FIRST), ln: rng.pick(LAST), pos, team: 'FA', status: 'PROSPECT', num: 0, age, born: year - age,
      ht, wt, col: rng.pick(COLLEGES), exp: 0, draft: { year, round: 0, pick: 0, team: '' },
      attrs, ovr: real, pot, dev, arch: archetype(pos, attrs), abil, xf, contract: { years: [] }, stats: {}, post: {}, cond: 100, morale: 75, xp: 0,
      traits: { work: rng.int(30, 99), cons: rng.int(30, 99), clutch: rng.int(30, 99), ego: rng.int(10, 90), prone: rng.int(5, 70) },
      motiv: rollMotivations(rng), awards: [], face: hash(`face-${year}-${i}`), scout: 0,
    };
    p.combine = combineFor(p, rng);
    prospects.push(p);
  });
  // Consensus big board: true value seen through scouts' fog. Ceiling counts.
  const value = (p: Player) => p.ovr * 0.55 + p.pot * 0.45 + POS_PREMIUM[p.pos] + rng.normal(0, 3.2);
  prospects.sort((a, b) => value(b) - value(a)).forEach((p, i) => (p.proj = i + 1));
  return prospects;
}
/** A class built from real college players (their projected OVR at draft time is hidden). */
function realClass(league: League, year: number, real: RealProspect[], rng: Rng): Player[] {
  void league;
  const out = real.map(r => {
    // About 18 + class year now, plus the years until his draft.
    const age = 17 + Math.min(4, r.cls) + (year - SEASON_DATA) + rng.int(0, 1);
    const attrs = buildAttrs({ pos: r.pos, ovr: r.ovr, age, ht: r.ht, wt: r.wt }, rng);
    const real = overall(r.pos, attrs);
    let dev = devTrait(real + rng.normal(3, 3), age, rng);
    // Blue-chip prospects on the scouting board carry the upside scouts see in them.
    const floor = !r.g ? null : r.g >= 94 ? 'Superstar' : r.g >= 86 ? 'Star' : null;
    const RANK = { Normal: 0, Star: 1, Superstar: 2, 'X-Factor': 3 } as const;
    if (floor && RANK[dev] < RANK[floor]) dev = floor;
    const growth = { Normal: 4, Star: 8, Superstar: 12, 'X-Factor': 15 }[dev] + (r.g ? Math.max(0, r.g - 84) * 0.35 : 0);
    const { abil, xf } = assignAbilities(r.pos, attrs, dev, rng);
    const p: Player = {
      id: r.id, fn: r.fn, ln: r.ln, pos: r.pos, team: 'FA', status: 'PROSPECT', num: 0, age, born: year - age, ht: r.ht || 72, wt: r.wt || 220,
      col: r.col, colLogo: r.colLogo, hs: r.hs, exp: 0, draft: { year, round: 0, pick: 0, team: '' },
      attrs, ovr: real, pot: Math.round(clamp(real + growth + rng.normal(0, 3), real + 2, 99)), dev, arch: archetype(r.pos, attrs), abil, xf,
      contract: { years: [] }, stats: {}, post: {}, cond: 100, morale: 75, xp: 0,
      traits: { work: rng.int(30, 99), cons: rng.int(30, 99), clutch: rng.int(30, 99), ego: rng.int(10, 90), prone: rng.int(5, 70) },
      motiv: rollMotivations(rng), awards: [], face: hash(r.id), scout: 0, proj: r.rank,
    };
    p.combine = combineFor(p, rng);
    return p;
  });
  // Consensus board: their real-data rank seen through a little media noise.
  // Boards agree at the top and scatter further down.
  const noisy = new Map(out.map(p => [p.id, p.proj! + rng.normal(0, 0.6 + p.proj! * 0.04)]));
  out.sort((a, b) => noisy.get(a.id)! - noisy.get(b.id)!).forEach((p, i) => (p.proj = i + 1));
  return out;
}

export const POS_PREMIUM: Record<Pos, number> = { QB: 5, EDGE: 3, OT: 2.5, WR: 2, CB: 2, DT: 1.5, S: 0, LB: -0.5, TE: 0, G: -0.5, C: -1, RB: -1, FB: -6, K: -8, P: -9, LS: -12 };

function combineFor(p: Player, rng: Rng) {
  const a = p.attrs;
  return {
    forty: Math.round((4.28 + (97 - a.SPD) / 58 + rng.normal(0, 0.03)) * 100) / 100,
    bench: Math.max(4, Math.round(20 + (a.STR - (['OT', 'G', 'C', 'DT'].includes(p.pos) ? 88 : 65)) / 0.6 * 0.4 + rng.normal(0, 3))),
    vert: Math.round((26 + (a.JMP - 50) / 3 + rng.normal(0, 1.2)) * 2) / 2,
    broad: Math.round(108 + (a.JMP - 60) * 0.55 + (a.SPD - 75) * 0.3 + rng.normal(0, 3)),
    cone: Math.round((6.6 + (96 - a.AGI) / 30 + rng.normal(0, 0.05)) * 100) / 100,
    shuttle: Math.round((4.0 + (96 - a.AGI) / 45 + rng.normal(0, 0.04)) * 100) / 100,
  };
}

// ---- scouting (user only) ----------------------------------------------------------------
// Level 1 reveals the top three ratings and archetype; level 2 all ratings within a range;
// level 3 exact ratings, development trait and potential.
export const SCOUT_COST = [0, 25, 50, 80];
export function scout(league: League, p: Player): boolean {
  const lvl = p.scout ?? 0;
  if (lvl >= 3) return false;
  const discount = league.coachTree.unlocked.includes('Eye for Talent') ? 0.75 : 1;
  const cost = Math.round(SCOUT_COST[lvl + 1] * discount);
  if (league.scoutPoints < cost) return false;
  league.scoutPoints -= cost;
  p.scout = lvl + 1;
  return true;
}
/** What the user's scouts believe about a prospect. */
export function scoutedView(p: Player) {
  const lvl = p.scout ?? 0;
  // Before your own scouts dig in you mostly know what everyone knows (the consensus
  // board); each level of scouting replaces more of that with your own read.
  const err = [8, 5, 2, 0][lvl];
  const consensus = p.proj ? 79 - 9.5 * Math.log10(1 + (p.proj - 1) * 0.35) : p.ovr;
  const own = p.ovr + ((p.face % 1000) / 1000 - 0.5) * 2 * err;
  const w = [0.55, 0.3, 0.1, 0][lvl];
  const ovr = Math.round(clamp(consensus * w + own * (1 - w), 35, 90));
  return { lvl, ovrLo: Math.max(35, ovr - err), ovrHi: Math.min(95, ovr + err), dev: lvl >= 3 ? p.dev : undefined, pot: lvl >= 3 ? p.pot : undefined, attrsExact: lvl >= 3, attrsShown: lvl >= 1 };
}

/** Letter grade from what your scouts believe (overall stays hidden until drafted). */
export function draftGrade(p: Player): string {
  const v = scoutedView(p);
  const mid = (v.ovrLo + v.ovrHi) / 2;
  const val = mid * 0.65 + (v.pot ?? mid + 6) * 0.35;
  const scale: [number, string][] = [[78, 'A+'], [75, 'A'], [72, 'A-'], [69, 'B+'], [66, 'B'], [63, 'B-'], [60, 'C+'], [57, 'C'], [54, 'C-'], [50, 'D']];
  return scale.find(([t]) => val >= t)?.[1] ?? 'F';
}

// ---- order and picking -------------------------------------------------------------------
/** Non-playoff teams by record (worst first), then playoff teams by round of exit, champion last. */
export function draftOrder(league: League, season: number): string[] {
  const st = standings(league, season);
  const exitRound: Record<string, number> = {};
  for (const g of league.games) {
    if (g.season !== season || g.week <= REG_WEEKS || !g.result) continue;
    const loser = g.result.hs >= g.result.as ? g.away : g.home;
    exitRound[loser] = g.week;
    if (g.week === 22) exitRound[g.result.hs >= g.result.as ? g.home : g.away] = 23;
  }
  const sos = (a: string) => st[a].pct;
  return Object.keys(league.teams).sort((a, b) => (exitRound[a] ?? 0) - (exitRound[b] ?? 0) || st[a].pct - st[b].pct || sos(a) - sos(b) || hash(a) - hash(b));
}

export function startDraft(league: League) {
  const year = league.season;
  const order = draftOrder(league, year - 1);
  league.picks.filter(p => p.season === year).forEach(p => (p.no = (p.round - 1) * 32 + order.indexOf(p.orig) + 1));
  league.draft = { order, cursor: 0, done: false };
  league.phase = 'draft';
  if (!picksInOrder(league).length) league.draft.done = true;
}
export const picksInOrder = (league: League) => league.picks.filter(p => p.season === league.season && p.no).sort((a, b) => a.no! - b.no!);
export const prospects = (league: League) => Object.values(league.players).filter(p => p.status === 'PROSPECT');

/** AI board: value with its own scouting error, bumped for needs. */
export function aiChoose(league: League, team: string, rng: Rng): Player | undefined {
  const pool = prospects(league);
  const need = positionNeeds(league, team);
  let best: Player | undefined, bv = -Infinity;
  for (const p of pool) {
    const err = ((hash(team + p.id) % 1000) / 1000 - 0.5) * 7;
    const v = p.ovr * 0.55 + p.pot * 0.45 + POS_PREMIUM[p.pos] + err + (need[p.pos] ?? 0) * 2.2 - (p.proj ?? 200) * 0.02 + rng.normal(0, 0.5);
    if (v > bv) { bv = v; best = p; }
  }
  return best;
}
export function positionNeeds(league: League, team: string): Partial<Record<Pos, number>> {
  const want: Record<Pos, [number, number]> = { QB: [1, 3], RB: [2, 4], FB: [0, 1], WR: [3, 6], TE: [2, 3], OT: [2, 4], G: [2, 4], C: [1, 2], EDGE: [2, 5], DT: [2, 5], LB: [2, 5], CB: [3, 6], S: [2, 4], K: [1, 1], P: [1, 1], LS: [1, 1] };
  const roster = Object.values(league.players).filter(p => p.team === team && (p.status === 'ACT' || p.status === 'IR'));
  const out: Partial<Record<Pos, number>> = {};
  for (const pos of Object.keys(want) as Pos[]) {
    const ps = roster.filter(p => p.pos === pos).sort((a, b) => b.ovr - a.ovr);
    const [starters, depth] = want[pos];
    const starterQ = ps.slice(0, starters).reduce((a, p) => a + p.ovr, 0) / Math.max(1, starters);
    const ageing = ps.slice(0, starters).filter(p => p.age >= 31).length;
    out[pos] = clamp((ps.length < depth ? (depth - ps.length) * 0.6 : 0) + (starterQ < 72 ? (72 - starterQ) / 6 : 0) + ageing * 0.5, 0, 4);
  }
  return out;
}

export function makePick(league: League, playerId: string) {
  const d = league.draft!;
  const pick = picksInOrder(league)[d.cursor];
  const p = league.players[playerId];
  if (!pick || !p || p.status !== 'PROSPECT') return;
  p.team = pick.owner; p.status = 'ACT';
  p.draft = { year: league.season, round: pick.round, pick: pick.no!, team: pick.owner };
  p.contract = rookieContract(pick.no!, league.season);
  p.num = freeNumber(league, pick.owner, p.pos);
  p.stats = {}; p.scout = 3;
  if (pick.no! <= 32 || pick.owner === league.user) news(league, 'draft', `Pick ${pick.no} (Rd ${pick.round}): ${league.teams[pick.owner].nick} select ${p.pos} ${p.fn} ${p.ln}, ${p.col}.`, [pick.owner], { pid: p.id, big: pick.no! <= 3 });
  d.cursor++;
  if (d.cursor >= picksInOrder(league).length) finishDraft(league);
}
export function aiPickNow(league: League, rng: Rng) {
  const pick = picksInOrder(league)[league.draft!.cursor];
  if (!pick) return;
  const p = aiChoose(league, pick.owner, rng);
  if (p) makePick(league, p.id);
}
/** Sim picks until it is the user's turn (or the draft ends). */
export function simToUserPick(league: League) {
  const rng = new Rng(hash(`draft-${league.seed}-${league.season}`) + league.draft!.cursor);
  while (!league.draft!.done) {
    const pick = picksInOrder(league)[league.draft!.cursor];
    if (!pick || pick.owner === league.user) break;
    aiPickNow(league, rng);
  }
}
function finishDraft(league: League) {
  league.draft!.done = true;
  // Undrafted free agents: sign to minimum deals with the best fits.
  const rng = new Rng(hash(`udfa-${league.seed}-${league.season}`));
  const rest = prospects(league).sort((a, b) => (b.ovr + b.pot) - (a.ovr + a.pot));
  for (const p of rest) {
    if (p.ovr + p.pot < 108 || rng.chance(0.25)) { delete league.players[p.id]; continue; }
    const teams = Object.keys(league.teams).sort((a, b) => (positionNeeds(league, b)[p.pos] ?? 0) - (positionNeeds(league, a)[p.pos] ?? 0) + rng.normal(0, 1));
    const t = teams[0];
    p.team = t; p.status = 'ACT'; p.num = freeNumber(league, t, p.pos);
    p.draft = { year: league.season, round: 0, pick: 0, team: '' };
    p.contract = rookieContract(260, league.season);
    p.contract.rookie = true; p.scout = 3;
  }
  for (const p of generateClass(league, league.season + 1)) league.players[p.id] = p;
  mail(league, 'Director of Player Personnel', 'Draft complete', 'The draft is in the books and undrafted free agents have been signed. Training camp opens next.');
}

const NUMBERS: Record<Pos, [number, number][]> = {
  QB: [[1, 19]], RB: [[0, 49]], FB: [[30, 49]], WR: [[0, 19], [80, 89]], TE: [[80, 89], [40, 49]], OT: [[60, 79]], G: [[60, 79]], C: [[50, 79]],
  EDGE: [[90, 99], [40, 59]], DT: [[90, 99], [50, 79]], LB: [[40, 59], [0, 19]], CB: [[0, 49]], S: [[0, 49]], K: [[1, 19]], P: [[1, 19]], LS: [[40, 69]],
};
export function freeNumber(league: League, team: string, pos: Pos): number {
  const used = new Set(Object.values(league.players).filter(p => p.team === team).map(p => p.num));
  for (const [a, b] of NUMBERS[pos]) for (let n = a; n <= b; n++) if (!used.has(n) && n > 0) return n;
  return 0;
}
export { emptyLine };
