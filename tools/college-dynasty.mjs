// Data for the college game: every FBS program (logo, colours, 2026 conference) and its full
// 2026 roster with ESPN headshots, from cfbfastR. Ratings: three seasons of production, playing
// time, experience, size and program strength, mapped onto a realistic curve (a walk-on in the
// 40s and 50s, starters in the 70s and 80s, All-Americans in the 90s), with evaluators' grades
// as a floor for the best-known players.
// Writes college/src/data.json.
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { csv, get, num, tierOf, nflPos, sizeFit, seasonStats, production } from './college.mjs';

const B = 'https://raw.githubusercontent.com/sportsdataverse/cfbfastR-data/main';
const FBS = new Set(['SEC', 'Big Ten', 'Big 12', 'ACC', 'FBS Independents', 'Pac-12', 'American Athletic', 'Mountain West', 'Sun Belt', 'Conference USA', 'Mid-American']);
const CONF_SHORT = { 'American Athletic': 'American', 'FBS Independents': 'Independent', 'Conference USA': 'C-USA', 'Mid-American': 'MAC' };

const teamsCsv = csv(get('.cache/cfb/teams.csv', `${B}/teams/teams_colors_logos.csv`));
const roster = csv(get('.cache/cfb/cfb_rosters_2026.csv', `${B}/rosters/csv/cfb_rosters_2026.csv`));
const S = { 2024: seasonStats(2024), 2025: seasonStats(2025), 2026: seasonStats(2026) };

// ---- programs ------------------------------------------------------------------------------
// Conference membership comes from the 2025 games themselves (the teams file still has the
// old map: Texas in the Big 12, USC in the Pac-12), plus the moves that took effect for 2026.
const MOVES_2026 = {
  'Boise State': 'Pac-12', 'Colorado State': 'Pac-12', 'Fresno State': 'Pac-12', 'San Diego State': 'Pac-12', 'Utah State': 'Pac-12', 'Texas State': 'Pac-12', 'Oregon State': 'Pac-12', 'Washington State': 'Pac-12',
  UTEP: 'Mountain West', 'Northern Illinois': 'Mountain West',
};
const norm = n => n.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const csvByName = new Map();
for (const t of teamsCsv) for (const n of [t.school, t.alt_name1, t.alt_name2, t.alt_name3, t.abbreviation]) if (n && !csvByName.has(norm(n))) csvByName.set(norm(n), t);
const ALIAS = { Massachusetts: 'UMass', 'App State': 'Appalachian State' };
for (const [a, b] of Object.entries(ALIAS)) if (!csvByName.has(norm(a)) && csvByName.has(norm(b))) csvByName.set(norm(a), csvByName.get(norm(b)));
const confOf = name => MOVES_2026[name] ?? (S[2025].teams.get(name)?.conf || S[2026].teams.get(name)?.conf);
const programs = new Map();      // roster team name -> program
for (const name of new Set(roster.map(r => r.team))) {
  const conf = confOf(name);
  if (!FBS.has(conf)) continue;
  const t = csvByName.get(norm(name)); if (!t) { console.warn('no logo/colours for', name); continue; }
  programs.set(name, { t, conf, name });
}

// ---- production ----------------------------------------------------------------------------
// Each season's production is a percentile among all FBS players at the position, scaled by
// how much he played (eight games is a full share). Recent seasons count more; a breakout
// this year or last outweighs a quiet one before it.
const cands = [];
for (const r of roster) {
  const pr = programs.get(r.team); if (!pr) continue;
  const pos = nflPos(r); if (!pos || !r.first_name) continue;
  cands.push({ r, pr, pos, yr: Math.max(1, Math.min(5, num(r.year) || 1)) });
}
const pcts = {};
for (const y of [2024, 2025, 2026]) {
  const byPos = new Map();
  for (const c of cands) { const v = production(c.pos, S[y].players.get(c.r.athlete_id)); if (v !== null) (byPos.get(c.pos) ?? byPos.set(c.pos, []).get(c.pos)).push(v); }
  for (const a of byPos.values()) a.sort((x, z) => x - z);
  pcts[y] = (pos, id) => {
    const e = S[y].players.get(id), v = production(pos, e); if (v === null) return null;
    const a = byPos.get(pos) ?? []; let lo = 0, hi = a.length; while (lo < hi) { const m = (lo + hi) >> 1; a[m] < v ? (lo = m + 1) : (hi = m); }
    return (a.length ? lo / a.length : 0.5) * Math.min(1, e.games.size / 8) ** 0.5;
  };
}
const prodScore = (pos, id) => {
  let best = null;
  for (const [y, w] of [[2026, 1], [2025, 1], [2024, 0.85]]) { const p = pcts[y](pos, id); if (p !== null) best = Math.max(best ?? 0, p * w); }
  return best;
};

// ---- program strength ----------------------------------------------------------------------
// Talent concentrates at winners and blue bloods: last season's record, conference tier and
// prestige lift a whole roster (this is what recruiting stars would otherwise tell us).
const PRESTIGE = { 'Ohio State': 1, Georgia: 1, Alabama: 1, Texas: 0.95, Oregon: 0.95, 'Notre Dame': 0.9, LSU: 0.85, Michigan: 0.85, 'Penn State': 0.85, Clemson: 0.8, Tennessee: 0.75, Miami: 0.75, USC: 0.75, Oklahoma: 0.75, 'Texas A&M': 0.7, 'Florida State': 0.65, Florida: 0.65, 'Ole Miss': 0.7, Auburn: 0.6, Indiana: 0.6, 'South Carolina': 0.5, Washington: 0.55, Utah: 0.5, Iowa: 0.45, Wisconsin: 0.45, Nebraska: 0.45, Missouri: 0.5, 'Texas Tech': 0.5, 'Arizona State': 0.45, BYU: 0.45, 'Kansas State': 0.4, Louisville: 0.45, 'Virginia Tech': 0.35, SMU: 0.4, 'Boise State': 0.4, Baylor: 0.35, TCU: 0.35, UCLA: 0.35, Colorado: 0.35, Illinois: 0.35, Kentucky: 0.3, Arkansas: 0.3, 'Mississippi State': 0.25, Vanderbilt: 0.3, 'Iowa State': 0.35, Minnesota: 0.3, Pittsburgh: 0.3, Duke: 0.3, 'North Carolina': 0.35, 'NC State': 0.3, 'Georgia Tech': 0.3 };
const win = name => S[2025].teams.get(name)?.win ?? 0.5;
const program = name => { const pr = programs.get(name); return tierOf(pr.conf) * 0.45 + (PRESTIGE[name] ?? 0) * 0.35 + win(name) * 0.2; };

// ---- players -------------------------------------------------------------------------------
// Raw talent = production (or, for linemen and players with no counting stats, how good the
// unit around him is) + experience + size for the position + program. Starters are the top
// of each team's position group on that score; they get a bump, as playing time is itself
// evidence of ability. The raw score is then mapped onto a realistic rating curve.
const STARTERS = { QB: 1, RB: 1, FB: 0, WR: 3, TE: 1, OT: 2, G: 2, C: 1, EDGE: 2, DT: 2, LB: 2, CB: 2, S: 2, K: 1, P: 1, LS: 1 };
const NO_STATS = new Set(['OT', 'G', 'C', 'LS', 'P', 'FB']);
for (const c of cands) {
  const prod = NO_STATS.has(c.pos) ? null : prodScore(c.pos, c.r.athlete_id);
  const size = sizeFit(c.pos, num(c.r.height), num(c.r.weight));
  const prog = program(c.r.team);
  c.prod = prod;
  c.raw = (prod ?? (NO_STATS.has(c.pos) ? 0.18 + prog * 0.35 : 0.08)) * 0.42 + (c.yr - 1) / 4 * 0.18 + size * 0.1 + prog * 0.3;
}
const groups = new Map();
for (const c of cands) { const k = `${c.r.team}|${c.pos}`; (groups.get(k) ?? groups.set(k, []).get(k)).push(c); }
for (const g of groups.values()) g.sort((a, b) => b.raw - a.raw).forEach((c, i) => { c.starter = i < (STARTERS[c.pos] ?? 1); if (c.starter) c.raw += 0.06; });
// Rating curve: share of FBS players at or below a raw score -> rating.
const CURVE = [[0, 44], [0.1, 53], [0.3, 60], [0.55, 66], [0.75, 72], [0.88, 78], [0.95, 83], [0.988, 88], [0.998, 93], [1, 97]];
const sortedRaw = cands.map(c => c.raw).sort((a, b) => a - b);
const curve = raw => {
  let lo = 0, hi = sortedRaw.length; while (lo < hi) { const m = (lo + hi) >> 1; sortedRaw[m] < raw ? (lo = m + 1) : (hi = m); }
  const q = lo / sortedRaw.length;
  for (let i = 1; i < CURVE.length; i++) if (q <= CURVE[i][0]) { const [q0, r0] = CURVE[i - 1], [q1, r1] = CURVE[i]; return r0 + (r1 - r0) * (q - q0) / (q1 - q0); }
  return 98;
};
// Evaluators' board: the best-known players' grades set a floor (draft grade -> college rating).
const BOARD = JSON.parse(readFileSync('tools/scouting.json', 'utf8')).board;
const nn = n => n.toLowerCase().replace(/\b(jr|sr|ii|iii|iv|v)\b\.?/g, '').replace(/[^a-z]/g, '');
const boardFloor = c => { const b = BOARD.find(x => nn(x.n) === nn(`${c.r.first_name} ${c.r.last_name}`) && (x.s ? nn(x.s) === nn(c.r.team) : (PRESTIGE[c.r.team] ?? 0) > 0)); return b ? Math.min(99, 60 + b.g * 0.4) : 0; };
const players = cands.map(c => {
  // Specialists live on a narrower scale: the best kicker in the country is an 88, not a 98.
  const base = ['K', 'P', 'LS'].includes(c.pos) ? 50 + (curve(c.raw) - 44) * 0.72 : curve(c.raw);
  const ovr = Math.round(Math.max(boardFloor(c), Math.min(97, base)));
  const r = c.r;
  const out = { id: r.athlete_id, fn: r.first_name, ln: r.last_name, t: Number(c.pr.t.team_id), pos: c.pos, yr: c.yr, ht: num(r.height), wt: num(r.weight), num: num(r.jersey) || 0, ovr };
  if (c.starter) out.st = 1;
  // Last season's line (2025): games, passing, rushing, receiving, defence, kicking.
  const e = S[2025].players.get(r.athlete_id);
  if (e && e.games.size) out.s = [e.games.size, e.pc, e.pa, e.py, e.ptd, e.pint, e.ra, e.ry, e.rtd, e.rec, e.recy, e.rectd, Math.round(e.sk * 10) / 10, e.int, e.pbu, e.ff, e.fgm, e.fga];
  if (r.headshot_url) out.hs = 1;
  if (r.home_city) out.home = `${r.home_city}${r.home_state ? `, ${r.home_state}` : ''}`;
  return out;
});
// An 85-scholarship-plus roster per team: everyone who rates, best first.
const keep = [];
for (const pr of programs.values()) keep.push(...players.filter(p => p.t === Number(pr.t.team_id)).sort((a, b) => b.ovr - a.ovr).slice(0, 95));
// Team rating: the 22 starters weighted, with depth counting a little.
const rating = id => {
  const mine = keep.filter(p => p.t === id), st = mine.filter(p => p.st), depth = mine.filter(p => !p.st).sort((a, b) => b.ovr - a.ovr).slice(0, 20);
  if (!st.length) return 0;
  const a = st.reduce((s, p) => s + p.ovr, 0) / st.length, d = depth.reduce((s, p) => s + p.ovr, 0) / Math.max(1, depth.length);
  return Math.round(a * 0.85 + d * 0.15);
};
const teams = [...programs.values()].map(({ t, conf, name }) => ({
  id: Number(t.team_id), school: name, mascot: t.mascot, abbr: t.abbreviation, conf: CONF_SHORT[conf] ?? conf,
  prestige: Math.min(5, Math.max(1, Math.round((0.15 + (PRESTIGE[name] ?? 0) * 0.7 + tierOf(conf) * 0.15) * 5))), c1: t.color || '#333333', c2: t.alt_color || '#ffffff',
  ovr: rating(Number(t.team_id)), win: Math.round(win(name) * 100) / 100,
})).filter(t => t.ovr > 0).sort((a, b) => b.ovr - a.ovr);
// Spread team ratings over the range players expect (about 66 to 95).
{ const hi = teams[0].ovr, lo = teams[teams.length - 1].ovr; for (const t of teams) t.ovr = Math.round(66 + (t.ovr - lo) / Math.max(1, hi - lo) * 29); }

mkdirSync('college/src', { recursive: true });
writeFileSync('college/src/data.json', JSON.stringify({ season: 2026, teams, players: keep.filter(p => teams.some(t => t.id === p.t)) }));
console.log(teams.length, 'teams', keep.length, 'players');
console.log(teams.slice(0, 25).map(t => `${t.school} ${t.ovr}`).join(' | '));
console.log(teams.slice(-5).map(t => `${t.school} ${t.ovr}`).join(' | '));

const byName = n => keep.find(p => `${p.fn} ${p.ln}` === n);
for (const n of ['Jeremiah Smith', 'Arch Manning', 'Dante Moore', 'Ryan Williams', 'LaNorris Sellers', 'Bryce Underwood', 'Cade Klubnik', 'Julian Sayin', 'Caleb Downs', 'Peter Woods', 'Jeremiyah Love', 'Carson Beck']) { const p = byName(n); console.log(' ', n, p ? `${p.pos} ${p.ovr}${p.st ? ' starter' : ''}` : '-'); }
const top = [...keep].sort((a, b) => b.ovr - a.ovr).slice(0, 15).map(p => `${p.fn} ${p.ln} ${p.pos} ${p.ovr} (${teams.find(t => t.id === p.t)?.school})`); console.log(top.join(' | '));
const hist = {}; for (const p of keep) { const b = Math.floor(p.ovr / 10) * 10; hist[b] = (hist[b] ?? 0) + 1; } console.log(hist);
