// Creates a franchise from the imported real-world data.
import data from '../data/league.json';
import type { Coach, DefScheme, League, OffScheme, Pick, Player, Pos, StatLine, Team } from './types';
import { Rng, clamp, hash } from './rng';
import { archetype, assignAbilities, buildAttrs, devTrait, overall, potential } from './ratings';
import { seasonForm, starterMeans, applyDelta } from './offseason';
import { ensureFuture } from './draft';
import { CAP_2026, capSpace, makeContract, minSalary, restructure, rookieContract } from './contracts';

interface RawP {
  id: string; fn: string; ln: string; pos: Pos; team: string; st: string; num: number; age: number; ht?: number; wt?: number;
  col?: string; exp: number; hs?: string; pick: number; dy?: number; dt?: string; apy?: number; gtd?: number; cy: number; signed?: number;
  forty?: number; bench?: number; vert?: number; cone?: number; broad?: number; shuttle?: number; ovr: number; sig?: Record<string, number>; trend?: number;
}
interface RawT { abbr: string; name: string; nick: string; conf: 'AFC' | 'NFC'; div: string; colors: string[]; logo: string; logoAlt: string; wordmark: string; coach: string; stadium: string; roof: string; surface: string }
const D = data as unknown as { season: number; teams: RawT[]; schedule: { w: number; a: string; h: string; day: string; t: string; n?: string }[]; players: RawP[] };

export const SEASON0 = D.season;
export const RAW_TEAMS = D.teams;

const BIG = ['NYG', 'NYJ', 'LA', 'LAC', 'CHI', 'DAL', 'PHI', 'SF', 'WAS'];
const SMALL = ['GB', 'BUF', 'JAX', 'TEN', 'IND', 'CIN', 'KC', 'NO', 'CAR', 'CLE'];
const WARM = ['MIA', 'TB', 'JAX', 'ARI', 'LV', 'LA', 'LAC', 'SF', 'HOU', 'NO', 'ATL', 'DAL', 'CAR', 'TEN'];
const TRADITION: Record<string, number> = { GB: 0.95, PIT: 0.95, DAL: 0.9, NE: 0.85, SF: 0.85, KC: 0.85, CHI: 0.85, NYG: 0.8, BAL: 0.75, PHI: 0.75, DEN: 0.7, SEA: 0.65, MIA: 0.6, LV: 0.6, WAS: 0.6 };
// Known schemes for current head coaches; others are inferred from a hash.
const SCHEMES: Record<string, [OffScheme, DefScheme, number]> = {
  'Kyle Shanahan': ['Wide Zone', '4-3 Over', 0.55], 'Sean McVay': ['Wide Zone', 'Two-High', 0.55], 'Matt LaFleur': ['West Coast', 'Two-High', 0.5],
  'Andy Reid': ['Spread', 'Blitz', 0.6], 'Dan Campbell': ['Power Run', 'Blitz', 0.85], 'John Harbaugh': ['Power Run', '3-4 Two-Gap', 0.7],
  'Sean McDermott': ['Spread', 'Cover 3', 0.45], 'Mike Vrabel': ['Power Run', '3-4 Two-Gap', 0.6], 'Mike Macdonald': ['Wide Zone', 'Two-High', 0.6],
  'Nick Sirianni': ['Spread', '4-3 Over', 0.8], 'Kevin O\'Connell': ['West Coast', 'Blitz', 0.6], 'Sean Payton': ['West Coast', '3-4 Two-Gap', 0.55],
  'Jim Harbaugh': ['Power Run', '3-4 Two-Gap', 0.55], 'DeMeco Ryans': ['Wide Zone', '4-3 Over', 0.5], 'Ben Johnson': ['Spread', '4-3 Over', 0.75],
  'Mike Tomlin': ['West Coast', '3-4 Two-Gap', 0.45], 'Zac Taylor': ['Vertical', '4-3 Over', 0.5], 'Liam Coen': ['Wide Zone', 'Cover 3', 0.6],
  'Shane Steichen': ['Spread', 'Cover 3', 0.55], 'Dan Quinn': ['West Coast', 'Cover 3', 0.6], 'Todd Bowles': ['West Coast', 'Blitz', 0.5],
  'Raheem Morris': ['Wide Zone', 'Two-High', 0.5], 'Kellen Moore': ['Spread', '4-3 Over', 0.6], 'Brian Daboll': ['Vertical', 'Blitz', 0.55],
  'Jonathan Gannon': ['Wide Zone', 'Two-High', 0.55], 'Pete Carroll': ['Power Run', 'Cover 3', 0.45], 'Dave Canales': ['Wide Zone', '4-3 Over', 0.5],
  'Brian Schottenheimer': ['Vertical', '4-3 Over', 0.55], 'Kevin Stefanski': ['Wide Zone', '4-3 Over', 0.5],
};
const OFF_SCHEMES: OffScheme[] = ['West Coast', 'Vertical', 'Wide Zone', 'Power Run', 'Spread'];
const DEF_SCHEMES: DefScheme[] = ['4-3 Over', '3-4 Two-Gap', 'Cover 3', 'Two-High', 'Blitz'];

export function makeCoach(name: string, rng: Rng, rating?: number): Coach {
  const k = SCHEMES[name];
  const h = hash(name);
  return {
    name,
    off: k?.[0] ?? OFF_SCHEMES[h % 5], def: k?.[1] ?? DEF_SCHEMES[(h >> 3) % 5], aggr: k?.[2] ?? 0.35 + ((h >> 6) % 40) / 100,
    rating: rating ?? Math.round(clamp(rng.normal(72, 8), 55, 95)), age: 40 + ((h >> 9) % 25),
  };
}

export const emptyLine = (): StatLine => ({
  gp: 0, gs: 0, pa: 0, pc: 0, py: 0, ptd: 0, pint: 0, sk: 0, sky: 0, plng: 0, ra: 0, ry: 0, rtd: 0, rlng: 0, fum: 0, fuml: 0,
  tgt: 0, rec: 0, recy: 0, rectd: 0, reclng: 0, drop: 0, tkl: 0, tfl: 0, dsk: 0, qbh: 0, dint: 0, pd: 0, ff: 0, fr: 0, dtd: 0,
  fgm: 0, fga: 0, fglng: 0, xpm: 0, xpa: 0, pun: 0, puny: 0, kr: 0, kry: 0, pr: 0, pry: 0, rettd: 0, pancake: 0, sacka: 0,
});

/** Turn a raw data row into a full player. */
export function playerFromRaw(r: RawP, season: number, rng: Rng): Player {
  const attrs = buildAttrs({ ...r, ovr: r.ovr }, rng);
  const ovr = overall(r.pos, attrs);
  const dev = devTrait(ovr, r.age, rng);
  const { abil, xf } = assignAbilities(r.pos, attrs, dev, rng);
  const p: Player = {
    id: r.id, fn: r.fn, ln: r.ln, pos: r.pos, team: r.team, status: r.st === 'PS' ? 'PS' : r.st === 'IR' ? 'IR' : r.team === 'FA' ? 'FA' : 'ACT',
    num: r.num, age: r.age, born: season - Math.round(r.age), ht: r.ht ?? 72, wt: r.wt ?? 220, col: r.col ?? '', exp: r.exp, hs: r.hs,
    draft: { year: r.dy ?? season - r.exp, round: r.pick ? Math.ceil(r.pick / 32) : 0, pick: r.pick, team: r.dt ?? '' },
    // Potential reads the stat trajectory: rising production means more room left.
    attrs, ovr, pot: Math.round(clamp(potential(ovr, r.age, dev, rng) + (r.trend ?? 0) * (r.age <= 26 ? 14 : 5), ovr, 99)), dev, arch: archetype(r.pos, attrs), abil, xf,
    contract: { years: [] }, stats: {}, post: {}, cond: 100, morale: 70 + rng.int(-10, 15), xp: 0,
    traits: { work: rng.int(30, 99), cons: rng.int(35, 99), clutch: rng.int(30, 99), ego: rng.int(10, 90), prone: rng.int(5, 70) },
    motiv: [], awards: [], face: hash(r.id),
    combine: r.forty ? { forty: r.forty, bench: r.bench ?? 0, vert: r.vert ?? 0, broad: r.broad ?? 0, cone: r.cone ?? 0, shuttle: r.shuttle ?? 0 } : undefined,
  };
  p.contract = initialContract(r, p, season);
  // The roster data is an end-of-2025 snapshot: most players on injured reserve then
  // have healed over the offseason. Some carry the injury into the new season.
  if (p.status === 'IR') {
    const h = hash(p.id + 'ir') % 100;
    if (h < 15) p.injury = { type: 'Recovering from 2025 injury', weeks: 2 + (h % 7) };
    else p.status = 'ACT';
  }
  return p;
}

function initialContract(r: RawP, p: Player, season: number) {
  if (r.team === 'FA') return { years: [] };
  const left = Math.max(1, r.cy || 0);
  if (r.apy && r.apy > minSalary(r.exp, season) * 1.05 && r.cy > 0) {
    // Real APY and guarantees. Guaranteed money still owed is front-loaded.
    const total = r.apy * left;
    const gtdLeft = Math.min(total * 0.85, (r.gtd ?? 0) * (left / Math.max(left, 3)));
    return makeContract(season, left, r.apy, gtdLeft / total, { bonusShare: 0.55, exp: r.exp });
  }
  if (r.exp <= 3 && r.pick > 0) {
    const c = rookieContract(r.pick, (r.dy ?? season - r.exp));
    c.years = c.years.filter(y => y.s >= season);
    if (c.years.length) return c;
  }
  // Minimum-type deal, 1-2 years.
  return makeContract(season, r.exp >= 6 ? 1 : 2, minSalary(r.exp, season) * (r.ovr > 70 ? 1.6 : 1), r.ovr > 70 ? 0.2 : 0, { bonusShare: 0.5, exp: r.exp });
}

const MOTIVS = ['Highest Offer', 'Contender', 'Scheme Fit', 'Starting Role', 'Big Market', 'Warm Weather', 'Loyalty', 'Winning Culture'] as const;
export function rollMotivations(rng: Rng) {
  const pool = [...MOTIVS];
  rng.shuffle(pool);
  // Most players care about money first; the other two vary.
  const out = [rng.chance(0.65) ? 'Highest Offer' : pool[0]];
  for (const m of pool) if (out.length < 3 && !out.includes(m)) out.push(m);
  return out as Player['motiv'];
}

export function createLeague(user: string, gm: string, opts: { difficulty?: League['difficulty']; seed?: number; name?: string } = {}): League {
  const seed = opts.seed ?? (Date.now() & 0x7fffffff);
  const rng = new Rng(seed);
  const season = D.season;
  const teams: Record<string, Team> = {};
  for (const t of D.teams) {
    teams[t.abbr] = {
      abbr: t.abbr, name: t.name, nick: t.nick, conf: t.conf, div: t.div, colors: t.colors, logo: t.logo, logoAlt: t.logoAlt, wordmark: t.wordmark,
      stadium: t.stadium, roof: t.roof, surface: t.surface, coach: makeCoach(t.coach || `${t.nick} Coach`, rng),
      depth: {}, dead: {}, rollover: 0, mode: 'balanced', plan: { off: 'Balanced', def: 'Balanced', practice: 'Normal' },
      market: BIG.includes(t.abbr) ? 3 : SMALL.includes(t.abbr) ? 1 : 2, warm: WARM.includes(t.abbr), tradition: TRADITION[t.abbr] ?? 0.45,
    };
  }
  const players: Record<string, Player> = {};
  for (const r of D.players) {
    if (r.team !== 'FA' && !teams[r.team]) continue;
    const p = playerFromRaw(r, season, rng);
    p.motiv = rollMotivations(rng);
    players[p.id] = p;
  }
  const picks: Pick[] = [];
  for (let s = season + 1; s <= season + 3; s++)
    for (let round = 1; round <= 7; round++)
      for (const abbr of Object.keys(teams)) picks.push({ id: `${s}-${round}-${abbr}`, season: s, round, orig: abbr, owner: abbr });

  const games = D.schedule.map((g, i) => ({ id: `${season}-${g.w}-${i}`, season, week: g.w, away: g.a, home: g.h, day: g.day, time: g.t, neutral: g.n }));
  const league: League = {
    version: 1, id: `L${seed.toString(36)}`, name: opts.name ?? `${teams[user].nick} Franchise`, season, week: 1, phase: 'preseason',
    user, gm, teams, players, games, picks, news: [], inbox: [], awards: [], history: [], cap: { [season]: CAP_2026 },
    seed, counter: 1, coachTree: { points: 2, xp: 0, level: 1, unlocked: [] }, scoutPoints: 400, security: 70,
    records: {}, difficulty: opts.difficulty ?? 'Pro', tradeDeadlineWeek: 9,
  };
  // Teams over the cap do what real ones do: restructure their biggest deals.
  for (const abbr of Object.keys(teams)) {
    let guard = 0;
    while (capSpace(league, abbr) < 2_000_000 && guard++ < 12) {
      const big = Object.values(players).filter(p => p.team === abbr && p.contract.years.length >= 2).sort((a, b) => (b.contract.years[0]?.base ?? 0) - (a.contract.years[0]?.base ?? 0))[0];
      if (!big || restructure(big, season) <= 0) break;
    }
  }
  // Free agents keep an asking price for when they sign.
  for (const p of Object.values(players)) if (p.team === 'FA') p.contract = { years: [] };
  starFloors(league, rng);
  liftRatings(league, rng);
  for (const abbr of Object.keys(teams)) autoDepth(league, abbr);
  seasonForm(league, rng);
  league.baseline = starterMeans(league);
  // Next spring's class exists all season so it can be scouted.
  ensureFuture(league);
  return league;
}

/**
 * Reputation floors: stars whose 2025 numbers undersell them (injuries, scheme, a down
 * year) start where the league actually rates them. Floors only raise a player; the
 * attributes move with the rating so the sim plays him as that good.
 */
const STAR_FLOOR: Record<string, number> = {
  'Patrick Mahomes|QB': 95, 'Justin Herbert|QB': 90, 'C.J. Stroud|QB': 85, 'Jayden Daniels|QB': 89, 'Trevor Lawrence|QB': 85,
  'Christian McCaffrey|RB': 92, 'Saquon Barkley|RB': 92, 'Josh Jacobs|RB': 88, 'Kyren Williams|RB': 87,
  'CeeDee Lamb|WR': 94, 'Justin Jefferson|WR': 97, 'Malik Nabers|WR': 90, 'Brian Thomas|WR': 87, 'Garrett Wilson|WR': 88, 'Rashee Rice|WR': 88,
  'Tee Higgins|WR': 88, 'Ladd McConkey|WR': 86, 'Mike Evans|WR': 85, 'Davante Adams|WR': 85,
  'Travis Kelce|TE': 87, 'Mark Andrews|TE': 85, 'Brock Bowers|TE': 94,
  'Trent Williams|OT': 93, 'Lane Johnson|OT': 90, 'Rashawn Slater|OT': 91, 'Landon Dickerson|G': 90, 'Joe Thuney|G': 92,
  'T.J. Watt|EDGE': 94, 'Nick Bosa|EDGE': 94, 'Maxx Crosby|EDGE': 95, 'Jared Verse|EDGE': 88, 'Brian Burns|EDGE': 89, 'Danielle Hunter|EDGE': 90,
  'Dexter Lawrence|DT': 94, 'Jalen Carter|DT': 92, 'Quinnen Williams|DT': 91, 'Vita Vea|DT': 88,
  'Fred Warner|LB': 95, 'Roquan Smith|LB': 93,
  'Christian Gonzalez|CB': 93, 'Ahmad Gardner|CB': 92, 'Trent McDuffie|CB': 91, 'Devon Witherspoon|CB': 90, 'Jaycee Horn|CB': 89,
  'Denzel Ward|CB': 88, 'Marlon Humphrey|CB': 88, 'Cooper DeJean|CB': 88, 'Jalen Ramsey|CB': 84, 'Patrick Surtain II|CB': 96,
  'Kyle Hamilton|S': 96, 'Antoine Winfield|S': 89, 'Jessie Bates|S': 89, 'Budda Baker|S': 87,
};
function starFloors(league: League, rng: Rng) {
  for (const p of Object.values(league.players)) {
    const f = STAR_FLOOR[`${p.fn} ${p.ln}|${p.pos}`] ?? STAR_FLOOR[`${p.fn} ${p.ln.replace(/ (Jr\.|Sr\.|II|III)$/, '')}|${p.pos}`];
    if (!f) continue;
    // Several passes: one delta rarely lands exactly on the target.
    for (let k = 0; k < 4 && p.ovr < f; k++) {
      const before = p.ovr;
      applyDelta(p, Math.min(14, f - p.ovr), rng);
      p.ovr = overall(p.pos, p.attrs);
      p.pot = Math.max(p.ovr, p.pot + (p.ovr - before));
      if (p.ovr === before) break;
    }
  }
}

// ---- depth charts -----------------------------------------------------------------------
/** Starters per team at each position (the sim's base personnel). */
const STARTERS_N: Partial<Record<Pos, number>> = { QB: 1, RB: 1, WR: 3, TE: 1, OT: 2, G: 2, C: 1, EDGE: 2, DT: 2, LB: 2, CB: 3, S: 2, K: 1, P: 1 };
/**
 * Lift the bottom of each position so every team's starters are real NFL starters:
 * nobody starting below 70, and 70-72 only for the weakest starters on bad rosters.
 * Below the median starter the gap is halved (a 66 starter becomes ~73), starters are
 * floored at 70, and backups get a smaller lift so they stay behind the starters.
 * Stars are untouched.
 */
function liftRatings(league: League, rng: Rng) {
  const lift = (p: Player, target: number) => {
    const delta = Math.min(14, Math.round(target - p.ovr));
    if (delta <= 0) return;
    const before = p.ovr;
    applyDelta(p, delta, rng);
    p.ovr = overall(p.pos, p.attrs);
    p.pot = Math.max(p.ovr, p.pot + (p.ovr - before));
  };
  for (const abbr of Object.keys(league.teams)) autoDepth(league, abbr);
  for (const [pos, n] of Object.entries(STARTERS_N) as [Pos, number][]) {
    const starters = Object.keys(league.teams).flatMap(a => (league.teams[a].depth[pos] ?? []).slice(0, n)).map(id => league.players[id]).filter(Boolean);
    if (!starters.length) continue;
    const ids = new Set(starters.map(p => p.id));
    const med = starters.map(p => p.ovr).sort((a, b) => a - b)[Math.floor(starters.length / 2)];
    // Each team's actual starters: gap to the median cut to 40%, never below 70.
    for (const p of starters) if (p.ovr < med) lift(p, Math.max(70, med - (med - p.ovr) * 0.4));
    // Everyone else at the position: a smaller lift, so backups stay behind starters.
    for (const p of Object.values(league.players)) if (p.pos === pos && !ids.has(p.id) && p.status !== 'PROSPECT' && p.status !== 'RET' && p.ovr < med) lift(p, med - (med - p.ovr) * 0.75);
  }
}

/** Each preseason: anyone set to start who has slipped below 73 is brought up to the low 70s. */
export function floorStarters(league: League, rng: Rng) {
  for (const [pos, n] of Object.entries(STARTERS_N) as [Pos, number][]) for (const abbr of Object.keys(league.teams)) {
    for (const id of (league.teams[abbr].depth[pos] ?? []).slice(0, n)) {
      const p = league.players[id];
      if (!p || p.ovr >= 73) continue;
      // Lands at 72-74 rather than exactly 70, so 70-72 starters stay rare.
      const before = p.ovr, target = Math.max(72, 75 - (75 - p.ovr) * 0.4);
      applyDelta(p, Math.min(14, Math.round(target - p.ovr)), rng);
      p.ovr = overall(p.pos, p.attrs);
      p.pot = Math.max(p.ovr, p.pot + (p.ovr - before));
    }
  }
}

export const DEPTH_SLOTS: Record<Pos, number> = { QB: 3, RB: 4, FB: 1, WR: 6, TE: 3, OT: 4, G: 4, C: 2, EDGE: 5, DT: 5, LB: 5, CB: 6, S: 4, K: 1, P: 1, LS: 1 };
export function rosterOf(league: League, team: string, includeInactive = false): Player[] {
  return Object.values(league.players).filter(p => p.team === team && (includeInactive ? p.status !== 'RET' : p.status === 'ACT'));
}
/** Best available player first at every position; injured players go to the bottom. */
/** Healthy players sitting on injured reserve come back to the active roster. Returns who was activated. */
export function activateHealthy(league: League, team?: string) {
  const back: Player[] = [];
  for (const p of Object.values(league.players)) if (p.status === 'IR' && !p.injury && (!team || p.team === team)) { p.status = 'ACT'; back.push(p); }
  return back;
}
export function autoDepth(league: League, team: string) {
  if (activateHealthy(league, team).length && team !== league.user && (league.phase === 'regular' || league.phase === 'playoffs')) {
    // AI teams make room for players back from IR by waiving their lowest-rated depth.
    const act = Object.values(league.players).filter(p => p.team === team && p.status === 'ACT').sort((a, b) => a.ovr - b.ovr);
    for (const p of act.slice(0, Math.max(0, act.length - 53))) { p.team = 'FA'; p.status = 'FA'; p.contract = { years: [] }; }
  }
  const t = league.teams[team];
  const roster = rosterOf(league, team);
  const depth: Team['depth'] = {};
  for (const pos of Object.keys(DEPTH_SLOTS) as Pos[]) {
    depth[pos] = roster.filter(p => p.pos === pos).sort((a, b) => effOvr(b) - effOvr(a)).map(p => p.id);
  }
  // Thin spots borrow from neighbouring positions.
  const borrow: [Pos, Pos[]][] = [['FB', ['TE', 'RB']], ['C', ['G']], ['G', ['OT', 'C']], ['OT', ['G']], ['S', ['CB']], ['LB', ['EDGE', 'S']], ['DT', ['EDGE']], ['EDGE', ['DT', 'LB']], ['LS', ['TE', 'C']], ['P', ['K']], ['K', ['P']]];
  for (const [pos, from] of borrow) {
    const need = Math.min(DEPTH_SLOTS[pos], pos === 'FB' || pos === 'LS' || pos === 'K' || pos === 'P' ? 1 : 2);
    for (const f of from) {
      if ((depth[pos]?.length ?? 0) >= need) break;
      const extra = (depth[f] ?? []).filter(id => !depth[pos]!.includes(id)).slice(need === 1 ? 0 : 1, (need === 1 ? 0 : 1) + need - depth[pos]!.length);
      depth[pos]!.push(...extra);
    }
  }
  t.depth = depth;
}
/** Positions whose order the user set by hand; the rest are kept sorted for him every week. */
export const manualDepth = (t: Team) => ((t as Team & { depthSet?: Pos[] }).depthSet ??= []);
export function markDepth(t: Team, pos: Pos) { const m = manualDepth(t); if (!m.includes(pos)) m.push(pos); }
export function unmarkDepth(t: Team) { (t as Team & { depthSet?: Pos[] }).depthSet = []; }
export const effOvr = (p: Player) => (p.injury || (p as Player & { holdout?: unknown }).holdout ? p.ovr - 40 : p.ovr) - (100 - p.cond) * 0.15;

/** Team strength by unit, used by AI, previews and the sim's pregame line. */
export function teamRatings(league: League, team: string) {
  const t = league.teams[team];
  const get = (pos: Pos, n: number) => (t.depth[pos] ?? []).slice(0, n).map(id => league.players[id]).filter(Boolean);
  const avg = (ps: Player[], n: number) => (ps.length ? ps.reduce((a, p) => a + effOvr(p), 0) / Math.max(n, ps.length) : 40);
  const qb = avg(get('QB', 1), 1);
  const skill = avg([...get('RB', 1), ...get('WR', 3), ...get('TE', 1)], 5);
  const ol = avg([...get('OT', 2), ...get('G', 2), ...get('C', 1)], 5);
  const dl = avg([...get('EDGE', 2), ...get('DT', 2)], 4);
  const lb = avg(get('LB', 2), 2);
  const db = avg([...get('CB', 3), ...get('S', 2)], 5);
  const st = avg([...get('K', 1), ...get('P', 1)], 2);
  // Madden leans hard on the quarterback.
  const off = qb * 0.5 + skill * 0.3 + ol * 0.2;
  const def = dl * 0.38 + lb * 0.22 + db * 0.4;
  // Madden-style team overall: starters weighted by unit, stretched from 50 so
  // contenders land near 90 and the weakest rosters in the mid 70s.
  const raw = off * 0.52 + def * 0.42 + st * 0.06;
  // Unit ratings: offense is QB-driven so it spreads wider than defense and
  // gets no stretch; both bend past 86 and never exceed 92.
  const unit = (v: number) => Math.round(Math.min(92, v > 86 ? 86 + (v - 86) * 0.6 : v));
  // Below the league's middle the team overall is stretched so bad rosters read as bad (high 60s).
  const t0 = Math.min(99, 50 + (raw - 50) * 1.13), stretched = t0 < 83 ? 83 - (83 - t0) * 1.5 : t0;
  return { qb, skill, ol, dl, lb, db, st, off: unit(off), def: unit(50 + (def - 50) * 1.15), ovr: Math.round(stretched) };
}
