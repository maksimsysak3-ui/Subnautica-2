// Creates a franchise from the imported real-world data.
import data from '../data/league.json';
import type { Coach, DefScheme, League, OffScheme, Pick, Player, Pos, StatLine, Team } from './types';
import { Rng, clamp, hash } from './rng';
import { archetype, assignAbilities, buildAttrs, devTrait, overall, potential } from './ratings';
import { seasonForm, starterMeans } from './offseason';
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
  for (const abbr of Object.keys(teams)) autoDepth(league, abbr);
  seasonForm(league, rng);
  league.baseline = starterMeans(league);
  return league;
}

// ---- depth charts -----------------------------------------------------------------------
export const DEPTH_SLOTS: Record<Pos, number> = { QB: 3, RB: 4, FB: 1, WR: 6, TE: 3, OT: 4, G: 4, C: 2, EDGE: 5, DT: 5, LB: 5, CB: 6, S: 4, K: 1, P: 1, LS: 1 };
export function rosterOf(league: League, team: string, includeInactive = false): Player[] {
  return Object.values(league.players).filter(p => p.team === team && (includeInactive ? p.status !== 'RET' : p.status === 'ACT'));
}
/** Best available player first at every position; injured players go to the bottom. */
export function autoDepth(league: League, team: string) {
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
export const effOvr = (p: Player) => (p.injury ? p.ovr - 40 : p.ovr) - (100 - p.cond) * 0.15;

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
  const off = qb * 0.42 + skill * 0.33 + ol * 0.25;
  const def = dl * 0.38 + lb * 0.22 + db * 0.4;
  return { qb, skill, ol, dl, lb, db, st, off, def, ovr: Math.round(off * 0.52 + def * 0.42 + st * 0.06) };
}
