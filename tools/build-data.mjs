// Builds src/data/league.json from nflverse public data (downloads cached in .cache/).
//
// Ratings model
//   1. Every position has a set of metrics: box score, Next Gen Stats and PFR
//      advanced (pressures, coverage allowed, broken tackles, drops ...). Most are
//      rates against opportunity (per snap, per target, per attempt).
//   2. Each metric is scored against that season's field: 0 = replacement level
//      (20th percentile of qualified players), 1 = the elite (mean of the top 3).
//   3. Seasons blend 2025 > 2024 > 2023, weighted by how much the player played.
//   4. Production is blended with the market (contract share of the cap, second
//      contracts only) and role (snap share per game played).
//   5. Draft slot only stands in where there is little NFL evidence (rookies).
//   6. The talent score is ranked within the position onto a Madden-like curve.
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { parquetReadObjects } from 'hyparquet';
import { compressors } from 'hyparquet-compressors';

const SEASON = 2026;
const PAST = [SEASON - 1, SEASON - 2, SEASON - 3];
const SEASON_W = [0.6, 0.27, 0.13];
const REL = 'https://github.com/nflverse/nflverse-data/releases/download';
const FILES = {
  roster: `${REL}/rosters/roster_${SEASON}.csv`,
  teams: `${REL}/teams/teams_colors_logos.csv`,
  // The CSV export of this file stopped in 2022; the parquet one is current.
  contracts: `${REL}/contracts/historical_contracts.parquet`,
  combine: `${REL}/combine/combine.csv`,
  games: 'https://raw.githubusercontent.com/nflverse/nfldata/master/data/games.csv',
  advDef: `${REL}/pfr_advstats/advstats_season_def.csv`,
  advPass: `${REL}/pfr_advstats/advstats_season_pass.csv`,
  advRush: `${REL}/pfr_advstats/advstats_season_rush.csv`,
  advRec: `${REL}/pfr_advstats/advstats_season_rec.csv`,
  ngsPass: `${REL}/nextgen_stats/ngs_passing.csv.gz`,
  ngsRec: `${REL}/nextgen_stats/ngs_receiving.csv.gz`,
  ngsRush: `${REL}/nextgen_stats/ngs_rushing.csv.gz`,
};
for (const y of [SEASON, ...PAST]) {
  FILES[`snaps${y}`] = `${REL}/snap_counts/snap_counts_${y}.csv`;
  if (y < SEASON) FILES[`stats${y}`] = `${REL}/stats_player/stats_player_reg_${y}.csv`;
}

mkdirSync('.cache', { recursive: true });
function fetchCached(key) {
  const url = FILES[key];
  const path = `.cache/${url.split('/').pop()}`;
  if (!existsSync(path)) execSync(`curl -sSfL -o "${path}" "${url}"`, { stdio: 'inherit' });
  const buf = readFileSync(path);
  return path.endsWith('.gz') ? gunzipSync(buf) : buf;
}
const load = key => parseCsv(fetchCached(key).toString('utf8'));
async function loadParquet(key, columns) {
  const b = fetchCached(key);
  return parquetReadObjects({ file: b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), compressors, columns });
}
function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (c !== '\r') cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const head = rows.shift();
  return rows.filter(r => r.length > 1).map(r => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])));
}
const num = v => (v === '' || v === 'NA' || v == null ? 0 : Number(v) || 0);
const has = v => v !== '' && v !== 'NA' && v != null;
const norm = s => s.toLowerCase().replace(/\b(jr|sr|ii|iii|iv|v)\b\.?/g, '').replace(/[^a-z]/g, '');

// ---- positions -------------------------------------------------------------------
const POS_MAP = {
  QB: 'QB', RB: 'RB', FB: 'FB', WR: 'WR', TE: 'TE', T: 'OT', OT: 'OT', G: 'G', OG: 'G', C: 'C',
  DE: 'EDGE', OLB: 'EDGE', DT: 'DT', NT: 'DT', ILB: 'LB', MLB: 'LB', LB: 'LB',
  CB: 'CB', FS: 'S', SS: 'S', S: 'S', DB: 'CB', K: 'K', P: 'P', LS: 'LS',
};
const gamePos = r => POS_MAP[r.depth_chart_position] ?? POS_MAP[r.position] ?? ({ OL: 'G', DL: 'DT', DB: 'CB' })[r.position] ?? 'WR';
const OFF = new Set(['QB', 'RB', 'FB', 'WR', 'TE', 'OT', 'G', 'C']);

// ---- teams & schedule --------------------------------------------------------------
const games = load('games').filter(g => g.season === String(SEASON) && g.game_type === 'REG');
const coach = {}, venue = {};
for (const g of games) {
  coach[g.home_team] = g.home_coach; coach[g.away_team] = g.away_coach;
  if (g.location === 'Home') venue[g.home_team] = { stadium: g.stadium, roof: g.roof, surface: g.surface };
}
const teams = load('teams').filter(t => !['LAR', 'OAK', 'SD', 'STL'].includes(t.team_abbr)).map(t => ({
  abbr: t.team_abbr, name: t.team_name, nick: t.team_nick, conf: t.team_conf, div: t.team_division.split(' ')[1],
  colors: [t.team_color, t.team_color2, t.team_color3, t.team_color4],
  logo: t.team_logo_espn, logoAlt: t.team_logo_wikipedia, wordmark: t.team_wordmark,
  coach: coach[t.team_abbr] ?? '', ...(venue[t.team_abbr] ?? { stadium: '', roof: 'outdoors', surface: 'grass' }),
}));
const schedule = games.map(g => ({ w: num(g.week), a: g.away_team, h: g.home_team, day: g.weekday.slice(0, 3), t: g.gametime, n: g.location === 'Neutral' ? g.stadium : undefined }));

// ---- roster: latest row per player --------------------------------------------------
const latest = new Map();
for (const r of load('roster')) {
  const prev = latest.get(r.gsis_id);
  if (!prev || num(r.week) >= num(prev.week)) latest.set(r.gsis_id, r);
}
const roster = [...latest.values()].filter(r => r.gsis_id && r.status !== 'RET' && r.full_name);

// ---- lookups: every source indexed by its id and by normalised name -------------------
function index(rows, idKey, nameKey, seasonKey) {
  const m = new Map();
  for (const r of rows) {
    const s = seasonKey ? r[seasonKey] : '';
    if (r[idKey]) m.set(`${r[idKey]}|${s}`, r);
    if (nameKey && r[nameKey]) m.set(`${norm(r[nameKey])}|${s}`, r);
  }
  return (row, season = '') => m.get(`${row.gsis_id}|${season}`) ?? m.get(`${row.pfr_id}|${season}`) ?? m.get(`${norm(row.full_name)}|${season}`);
}
const stats = Object.fromEntries(PAST.map(y => [y, index(load(`stats${y}`), 'player_id', 'player_display_name')]));
const advDef = index(load('advDef'), 'pfr_id', 'player', 'season');
const advPass = index(load('advPass'), 'pfr_id', 'player', 'season');
const advRush = index(load('advRush'), 'pfr_id', 'player', 'season');
const advRec = index(load('advRec'), 'pfr_id', 'player', 'season');
const ngsSeason = key => index(load(key).filter(r => r.week === '0' && r.season_type === 'REG'), 'player_gsis_id', 'player_display_name', 'season');
const ngsPass = ngsSeason('ngsPass'), ngsRec = ngsSeason('ngsRec'), ngsRush = ngsSeason('ngsRush');

function snapTable(rows) {
  const acc = new Map();
  const weeks = Math.max(1, ...rows.map(r => num(r.week)));
  for (const r of rows) {
    if (r.game_type !== 'REG') continue;
    const off = OFF.has(POS_MAP[r.position] ?? '');
    const pct = off ? num(r.offense_pct) : Math.max(num(r.defense_pct), num(r.offense_pct));
    const snaps = off ? num(r.offense_snaps) : num(r.defense_snaps);
    for (const key of [r.pfr_player_id, `${norm(r.player)}|${r.team}`, norm(r.player)]) {
      const e = acc.get(key) ?? { sum: 0, st: 0, n: 0, tot: 0 };
      e.sum += pct; e.st += num(r.st_pct); e.n++; e.tot += snaps;
      acc.set(key, e);
    }
  }
  // Share per game played measures role rather than availability.
  const minGames = Math.min(4, weeks);
  for (const e of acc.values()) { const d = Math.max(e.n, minGames); e.share = e.sum / d; e.stShare = e.st / d; }
  return row => (row.pfr_id && acc.get(row.pfr_id)) || acc.get(`${norm(row.full_name)}|${row.team}`) || acc.get(norm(row.full_name));
}
const snaps = Object.fromEntries([SEASON, ...PAST].map(y => [y, snapTable(load(`snaps${y}`))]));

const contracts = {};
for (const c of await loadParquet('contracts', ['player', 'gsis_id', 'is_active', 'year_signed', 'years', 'apy', 'guaranteed', 'apy_cap_pct', 'position'])) {
  if (!c.is_active) continue;
  for (const k of [c.gsis_id, norm(c.player)]) if (k && (!contracts[k] || c.year_signed > contracts[k].year_signed)) contracts[k] = c;
}
// Optional PFF grades (paywalled; not downloadable here). Drop an export at
// .cache/pff_grades.csv with columns pff_id or player, season, grade (0-100).
const pff = new Map();
if (existsSync('.cache/pff_grades.csv')) {
  for (const g of parseCsv(readFileSync('.cache/pff_grades.csv', 'utf8'))) {
    const v = num(g.grade ?? g.grades_offense ?? g.grades_defense);
    if (!v) continue;
    if (g.pff_id || g.player_id) pff.set(`${g.pff_id || g.player_id}|${g.season}`, v);
    if (g.player) pff.set(`${norm(g.player)}|${g.season}`, v);
  }
  console.log(`PFF grades: ${pff.size} rows`);
}
const pffGrade = (row, y) => pff.get(`${row.pff_id}|${y}`) ?? pff.get(`${norm(row.full_name)}|${y}`);

const combine = Object.fromEntries(load('combine').filter(c => c.pfr_id).map(c => [c.pfr_id, c]));

// ---- metrics per position ----------------------------------------------------------------
// Each metric: [name, weight, fn(ctx) -> value | undefined, lowerIsBetter?]. ctx holds the
// season's box score (s), PFR advanced (def/pass/rush/rec), NGS rows and snap total.
const per = (v, d, k = 1) => (d > 0 ? (v / d) * k : undefined);
const M = {
  QB: [
    ['EPA/play', 0.26, c => per(num(c.s.passing_epa) + num(c.s.rushing_epa), c.plays)],
    ['CPOE', 0.12, c => (c.ngsP ? num(c.ngsP.completion_percentage_above_expectation) : has(c.s.passing_cpoe) ? num(c.s.passing_cpoe) : undefined)],
    ['On-target %', 0.08, c => (c.pass ? num(c.pass.on_tgt_pct) : undefined)],
    ['Bad throw %', 0.05, c => (c.pass ? num(c.pass.bad_throw_pct) : undefined), true],
    ['Net yds/att', 0.1, c => per(num(c.s.passing_yards) - num(c.s.sack_yards_lost), num(c.s.attempts) + num(c.s.sacks_suffered))],
    ['TD %', 0.07, c => per(num(c.s.passing_tds), num(c.s.attempts), 100)],
    ['INT %', 0.08, c => per(num(c.s.passing_interceptions), num(c.s.attempts), 100), true],
    ['Sack %', 0.08, c => per(num(c.s.sacks_suffered), num(c.s.attempts) + num(c.s.sacks_suffered), 100), true],
    ['Pressure %', 0.04, c => (c.pass && num(c.pass.times_pressured) > 20 ? num(c.pass.pressure_pct) : undefined), true],
    ['Rush yds/g', 0.06, c => per(num(c.s.rushing_yards), num(c.s.games))],
    ['Air yds/att', 0.06, c => (c.ngsP ? num(c.ngsP.avg_intended_air_yards) : undefined)],
  ],
  RB: [
    ['RYOE/att', 0.22, c => (c.ngsR ? num(c.ngsR.rush_yards_over_expected_per_att) : undefined)],
    ['Yds after contact', 0.14, c => (c.rush ? num(c.rush.yac_att) : undefined)],
    ['Broken tkl/att', 0.12, c => (c.rush ? per(num(c.rush.brk_tkl), num(c.rush.att)) : undefined)],
    ['EPA/touch', 0.14, c => per(num(c.s.rushing_epa) + num(c.s.receiving_epa), num(c.s.carries) + num(c.s.targets))],
    ['Yds/carry', 0.1, c => per(num(c.s.rushing_yards), num(c.s.carries))],
    ['Scrim yds/snap', 0.14, c => per(num(c.s.rushing_yards) + num(c.s.receiving_yards), c.snaps)],
    ['Rec yds/snap', 0.07, c => per(num(c.s.receiving_yards), c.snaps)],
    ['Fumble rate', 0.07, c => per(num(c.s.rushing_fumbles) + num(c.s.receiving_fumbles), num(c.s.carries) + num(c.s.receptions), 100), true],
  ],
  WR: [
    ['Yds/route', 0.24, c => per(num(c.s.receiving_yards), c.snaps)],
    ['EPA/target', 0.14, c => per(num(c.s.receiving_epa), num(c.s.targets))],
    ['Target share', 0.12, c => (has(c.s.target_share) ? num(c.s.target_share) : undefined)],
    ['Separation', 0.08, c => (c.ngsC ? num(c.ngsC.avg_separation) : undefined)],
    ['YAC over exp', 0.07, c => (c.ngsC ? num(c.ngsC.avg_yac_above_expectation) : undefined)],
    ['Yds/target', 0.09, c => per(num(c.s.receiving_yards), num(c.s.targets))],
    ['1st downs/tgt', 0.09, c => per(num(c.s.receiving_first_downs), num(c.s.targets))],
    ['Drop %', 0.07, c => (c.rec ? num(c.rec.drop_percent) : undefined), true],
    ['Air yds share', 0.05, c => (has(c.s.air_yards_share) ? num(c.s.air_yards_share) : undefined)],
    ['Broken tkl/rec', 0.05, c => (c.rec ? per(num(c.rec.brk_tkl), num(c.rec.rec)) : undefined)],
  ],
  EDGE: [
    ['Pressures/100', 0.34, c => (c.def ? per(num(c.def.prss), c.snaps, 100) : undefined)],
    ['Sacks/100', 0.2, c => per(num(c.s.def_sacks), c.snaps, 100)],
    ['QB hits/100', 0.1, c => per(num(c.s.def_qb_hits), c.snaps, 100)],
    ['TFL/100', 0.14, c => per(num(c.s.def_tackles_for_loss), c.snaps, 100)],
    ['Tackles/100', 0.1, c => per(num(c.s.def_tackles_solo) + 0.5 * num(c.s.def_tackle_assists), c.snaps, 100)],
    ['Missed tkl %', 0.06, c => (c.def && num(c.def.comb) >= 10 ? num(c.def.m_tkl_percent) : undefined), true],
    ['Forced fum/100', 0.06, c => per(num(c.s.def_fumbles_forced), c.snaps, 100)],
  ],
  LB: [
    ['Tackles/100', 0.2, c => per(num(c.s.def_tackles_solo) + 0.5 * num(c.s.def_tackle_assists), c.snaps, 100)],
    ['Missed tkl %', 0.14, c => (c.def && num(c.def.comb) >= 15 ? num(c.def.m_tkl_percent) : undefined), true],
    ['TFL/100', 0.12, c => per(num(c.s.def_tackles_for_loss), c.snaps, 100)],
    ['Yds/tgt allowed', 0.14, c => (c.def && num(c.def.tgt) >= 15 ? num(c.def.yds_tgt) : undefined), true],
    ['Rating allowed', 0.1, c => (c.def && num(c.def.tgt) >= 15 ? num(c.def.rat) : undefined), true],
    ['Pressures/100', 0.12, c => (c.def ? per(num(c.def.prss), c.snaps, 100) : undefined)],
    ['Ball plays/100', 0.18, c => per(num(c.s.def_pass_defended) + 2 * num(c.s.def_interceptions), c.snaps, 100)],
  ],
  CB: [
    ['Rating allowed', 0.24, c => (c.def && num(c.def.tgt) >= 20 ? num(c.def.rat) : undefined), true],
    ['Yds/tgt allowed', 0.18, c => (c.def && num(c.def.tgt) >= 20 ? num(c.def.yds_tgt) : undefined), true],
    ['Cmp % allowed', 0.14, c => (c.def && num(c.def.tgt) >= 20 ? num(c.def.cmp_percent) : undefined), true],
    ['Ball plays/100', 0.22, c => per(num(c.s.def_pass_defended) + 2 * num(c.s.def_interceptions), c.snaps, 100)],
    ['Missed tkl %', 0.12, c => (c.def && num(c.def.comb) >= 10 ? num(c.def.m_tkl_percent) : undefined), true],
    ['Tackles/100', 0.1, c => per(num(c.s.def_tackles_solo), c.snaps, 100)],
  ],
  S: [
    ['Rating allowed', 0.15, c => (c.def && num(c.def.tgt) >= 15 ? num(c.def.rat) : undefined), true],
    ['Yds/tgt allowed', 0.12, c => (c.def && num(c.def.tgt) >= 15 ? num(c.def.yds_tgt) : undefined), true],
    ['Ball plays/100', 0.22, c => per(num(c.s.def_pass_defended) + 2 * num(c.s.def_interceptions), c.snaps, 100)],
    ['Tackles/100', 0.15, c => per(num(c.s.def_tackles_solo) + 0.5 * num(c.s.def_tackle_assists), c.snaps, 100)],
    ['Missed tkl %', 0.16, c => (c.def && num(c.def.comb) >= 15 ? num(c.def.m_tkl_percent) : undefined), true],
    ['TFL/100', 0.1, c => per(num(c.s.def_tackles_for_loss), c.snaps, 100)],
    ['Pressures/100', 0.1, c => (c.def ? per(num(c.def.prss), c.snaps, 100) : undefined)],
  ],
  K: [
    ['FG %', 0.55, c => (num(c.s.fg_att) >= 8 ? per(num(c.s.fg_made), num(c.s.fg_att)) : undefined)],
    ['50+ makes', 0.25, c => (num(c.s.fg_att) >= 8 ? num(c.s.fg_made_50_59) + num(c.s.fg_made_60_) : undefined)],
    ['XP %', 0.2, c => (num(c.s.pat_att) >= 10 ? per(num(c.s.pat_made), num(c.s.pat_att)) : undefined)],
  ],
  P: [
    ['Net avg', 0.6, c => (num(c.s.pt_att) >= 15 ? per(num(c.s.pt_net_yards), num(c.s.pt_att)) : undefined)],
    ['Inside 20 %', 0.25, c => (num(c.s.pt_att) >= 15 ? per(num(c.s.pt_inside_20), num(c.s.pt_att)) : undefined)],
    ['Touchback %', 0.15, c => (num(c.s.pt_att) >= 15 ? per(num(c.s.pt_touchback), num(c.s.pt_att)) : undefined), true],
  ],
};
M.FB = M.RB; M.TE = M.WR; M.DT = M.EDGE;
// [volume, volume for full weight, minimum to be scored at all]
const VOLUME = {
  QB: c => [c.plays, 250, 60], RB: c => [num(c.s.carries) + num(c.s.targets), 120, 25], FB: c => [c.snaps, 250, 60],
  WR: c => [num(c.s.targets), 60, 15], TE: c => [num(c.s.targets), 45, 12],
  EDGE: c => [c.snaps, 350, 100], DT: c => [c.snaps, 350, 100], LB: c => [c.snaps, 350, 100], CB: c => [c.snaps, 350, 100], S: c => [c.snaps, 350, 100],
  K: c => [num(c.s.fg_att), 20, 8], P: c => [num(c.s.pt_att), 40, 15],
};

function seasonCtx(row, year) {
  const s = stats[year](row);
  if (!s) return null;
  const sn = snaps[year](row);
  const y = String(year);
  return {
    s, snaps: sn?.tot ?? 0, plays: num(s.attempts) + num(s.sacks_suffered) + num(s.carries),
    def: advDef(row, y), pass: advPass(row, y), rush: advRush(row, y), rec: advRec(row, y),
    ngsP: ngsPass(row, y), ngsC: ngsRec(row, y), ngsR: ngsRush(row, y),
  };
}

// ---- assemble player rows -----------------------------------------------------------------
const players = roster.map(r => {
  const pos = gamePos(r);
  const c = contracts[r.gsis_id] ?? contracts[norm(r.full_name)];
  const contractOk = c && (OFF.has(pos) === OFF.has(POS_MAP[c.position] ?? pos) || ['K', 'P', 'LS'].includes(pos));
  const special = ['K', 'P', 'LS'].includes(pos);
  const snapW = { [SEASON]: 0.3, [SEASON - 1]: 0.5, [SEASON - 2]: 0.2 };
  let snap = 0, sw = 0;
  for (const y of [SEASON, SEASON - 1, SEASON - 2]) {
    const e = snaps[y](r);
    if (e) { snap += (special ? e.stShare : e.share) * snapW[y]; sw += snapW[y]; }
  }
  const cb = combine[r.pfr_id];
  const age = (Date.UTC(SEASON, 8, 1) - Date.parse(r.birth_date || `${SEASON - 25}-01-01`)) / 3.156e10;
  const ext = contractOk && c.year_signed > num(r.entry_year) && c.year_signed - num(r.entry_year) <= 4 ? 1 : 0;
  return {
    id: r.gsis_id, fn: r.football_name || r.first_name, ln: r.last_name, pos,
    team: ['CUT', 'INA'].includes(r.status) ? 'FA' : r.team,
    st: r.status === 'DEV' ? 'PS' : r.status === 'RES' ? 'IR' : r.status === 'CUT' ? 'FA' : 'ACT',
    num: num(r.jersey_number), age: Math.round(age * 10) / 10, ht: num(r.height), wt: num(r.weight),
    col: (r.college || '').split(';')[0].trim(), exp: num(r.years_exp), hs: r.headshot_url || undefined,
    pick: num(r.draft_number), dy: num(r.entry_year) || SEASON - num(r.years_exp), dt: r.draft_club || undefined,
    // parquet money is in millions; an extension signed inside the rookie deal starts a season later
    apy: contractOk ? Math.round(c.apy * 1e6) : 0, gtd: contractOk ? Math.round(c.guaranteed * 1e6) : 0,
    cy: contractOk ? Math.max(0, c.year_signed + c.years - SEASON + ext) : 0, signed: contractOk ? c.year_signed : 0,
    forty: cb ? num(cb.forty) : 0, bench: cb ? num(cb.bench) : 0, vert: cb ? num(cb.vertical) : 0, cone: cb ? num(cb.cone) : 0, broad: cb ? num(cb.broad_jump) : 0, shuttle: cb ? num(cb.shuttle) : 0,
    _row: r, _cap: contractOk ? c.apy_cap_pct : 0, _snap: Math.min(1, sw ? snap / sw : 0), _snap26: snaps[SEASON](r)?.share ?? 0,
  };
});

// ---- score metrics against each season's field ---------------------------------------------
const byPos = {};
for (const p of players) (byPos[p.pos] ??= []).push(p);
for (const [pos, list] of Object.entries(byPos)) {
  const metrics = M[pos];
  for (const p of list) p._prod = { sum: 0, w: 0 };
  if (!metrics) continue;
  PAST.forEach((year, yi) => {
    const rows = [];
    for (const p of list) {
      const c = seasonCtx(p._row, year);
      if (!c) continue;
      const [vol, full, min] = VOLUME[pos](c);
      if (vol < min) continue;
      rows.push({ p, rel: Math.min(1, vol / full), vals: metrics.map(m => m[2](c)) });
    }
    const scales = metrics.map((m, i) => {
      const v = rows.map(r => r.vals[i]).filter(x => x !== undefined && Number.isFinite(x)).map(x => (m[3] ? -x : x)).sort((a, b) => b - a);
      if (v.length < 8) return null;
      const elite = (v[0] + v[1] + v[2]) / 3;
      return { elite, repl: Math.min(v[Math.floor(v.length * 0.8)], elite - 1e-6) };
    });
    for (const { p, rel, vals } of rows) {
      let sum = 0, w = 0;
      metrics.forEach((m, i) => {
        const sc = scales[i], v = vals[i];
        if (!sc || v === undefined || !Number.isFinite(v)) return;
        sum += m[1] * Math.max(-0.4, Math.min(1.15, ((m[3] ? -v : v) - sc.repl) / (sc.elite - sc.repl)));
        w += m[1];
      });
      if (w < 0.4) return; // too few metrics to trust this season
      const sw = SEASON_W[yi] * rel;
      p._prod.sum += (sum / w) * sw;
      p._prod.w += sw;
    }
  });
}

// ---- blend into a talent score and place on the curve --------------------------------------
const W = { // market, production, role
  QB: [0.25, 0.6, 0.15], RB: [0.2, 0.55, 0.25], FB: [0.3, 0.15, 0.55], WR: [0.3, 0.5, 0.2], TE: [0.3, 0.38, 0.32],
  OT: [0.45, 0, 0.55], G: [0.45, 0, 0.55], C: [0.45, 0, 0.55],
  EDGE: [0.3, 0.48, 0.22], DT: [0.35, 0.4, 0.25], LB: [0.3, 0.4, 0.3], CB: [0.35, 0.37, 0.28], S: [0.3, 0.4, 0.3],
  K: [0.2, 0.7, 0.1], P: [0.2, 0.7, 0.1], LS: [0.4, 0, 0.6],
};
// [top, number of 90+, starters]: rank 0 = top, last 90+ = 90, half the starters ~80,
// last starter ~72, twice that ~63, deepest reserve 45.
const CURVE = {
  QB: [98, 6, 32], RB: [95, 4, 32], FB: [86, 0, 12], WR: [98, 10, 96], TE: [95, 4, 40],
  OT: [96, 8, 64], G: [94, 5, 64], C: [93, 3, 32], EDGE: [98, 10, 64], DT: [97, 7, 64],
  LB: [93, 5, 64], CB: [96, 8, 96], S: [94, 6, 64], K: [85, 0, 32], P: [84, 0, 32], LS: [72, 0, 32],
};
function curve(pos, rank, n) {
  const [top, n90, st] = CURVE[pos];
  const pts = [[0, top]];
  if (n90 > 1) pts.push([n90 - 1, 90]);
  pts.push([Math.max(n90, st / 2), n90 ? 80 : top - 8], [st, n90 ? 72 : top - 15], [Math.min(n - 2, st * 2), n90 ? 63 : top - 25], [Math.max(n - 1, st * 2 + 1), 45]);
  for (let i = 1; i < pts.length; i++) {
    const [r0, v0] = pts[i - 1], [r1, v1] = pts[i];
    if (rank <= r1) return v0 + (v1 - v0) * ((rank - r0) / Math.max(1, r1 - r0));
  }
  return 45;
}
function pctRank(vals) {
  vals = [...vals].sort((a, b) => a - b);
  return v => {
    let lo = 0, hi = vals.length;
    while (lo < hi) { const m = (lo + hi) >> 1; vals[m] < v ? (lo = m + 1) : (hi = m); }
    return vals.length > 1 ? Math.min(1, lo / (vals.length - 1)) : 0.5;
  };
}
// Draft capital, used only where NFL evidence is thin.
const pickPct = n => (n <= 0 ? 0.22 : Math.max(0.3, 0.97 * Math.exp(-0.0055 * (n - 1))));

for (const [pos, list] of Object.entries(byPos)) {
  const capRank = pctRank(list.filter(p => p._cap > 0 && p.exp >= 4).map(p => p._cap));
  const snapRank = pctRank(list.map(p => p._snap));
  const [wc, wp, ws] = W[pos];
  for (const p of list) {
    const evidence = Math.min(1, p._prod.w / 0.6); // 1 = a full, recent season or more
    const prodQ = p._prod.w ? p._prod.sum / p._prod.w : 0;
    // Thin samples regress toward a modest baseline rather than trusting a hot streak.
    const ps = Math.max(0, Math.min(1.1, evidence * prodQ + (1 - evidence) * 0.3));
    const secondDeal = p._cap > 0 && p.exp >= 4;
    const ms = secondDeal ? 0.1 + capRank(p._cap) * 0.9 : undefined;
    const rs = snapRank(p._snap) * 0.4 + p._snap * 0.6;
    // PFF grade, when supplied: season-weighted, scaled 60 -> 0 and 90 -> 1.
    let pg = 0, pw = 0;
    PAST.forEach((y, i) => { const g = pffGrade(p._row, y); if (g) { pg += g * SEASON_W[i]; pw += SEASON_W[i]; } });
    let score;
    if (ms !== undefined) score = ms * wc + ps * wp + rs * ws;
    else if (wp >= 0.35) score = ps * (wp + wc * 0.6) + rs * (ws + wc * 0.4);
    // Linemen: no box score, and a rookie deal tells us nothing, so a full-time
    // starter is treated as holding a league-median deal.
    else score = (0.15 + 0.45 * p._snap) * wc + ps * wp + rs * ws;
    if (pw > 0.3) {
      const pf = Math.max(0, Math.min(1.1, (pg / pw - 60) / 30));
      score = wp ? score * 0.7 + pf * 0.3 : score * 0.55 + pf * 0.45; // linemen lean on it most
    }
    // Draft slot fills in only for players without an NFL track record.
    const draftW = p.exp === 0 ? 0.45 : p.exp === 1 ? 0.3 * (1 - evidence) : 0;
    score = score * (1 - draftW) + pickPct(p.pick) * 0.8 * draftW;
    if (p.st === 'PS') score -= 0.04;
    if (p.age > 31) score -= 0.012 * (p.age - 31) * (['QB', 'K', 'P', 'LS'].includes(pos) ? 0.4 : 1);
    p._score = score;
  }
  list.sort((a, b) => b._score - a._score);
  // Rank on the curve, nudged up to 3 points by the margin over the field.
  const [top, n90, st] = CURVE[pos];
  const sTop = list[0]._score, sSt = list[Math.min(list.length - 1, st)]._score;
  const lastStarter = curve(pos, st, list.length);
  list.forEach((p, r) => {
    const byRank = curve(pos, r, list.length);
    const byMargin = lastStarter + (top - lastStarter) * (p._score - sSt) / Math.max(1e-6, sTop - sSt);
    let ovr = Math.min(top, byRank + Math.max(-3, Math.min(3, (byMargin - byRank) * 0.5)));
    if (r >= n90) ovr = Math.min(ovr, 89.4); // the 90+ club stays exclusive
    if (p.exp === 0) ovr = Math.min(ovr, 76 + 8 * p._snap26); // rookies earn their way up
    p.ovr = Math.round(Math.max(40, ovr));
  });
}

const debug = new Set((process.env.DEBUG ?? '').split(','));
for (const p of players) {
  if (debug.has(p.ln)) console.log(`  ${p.fn} ${p.ln} ${p.pos} exp${p.exp} prod=${(p._prod.sum / (p._prod.w || 1)).toFixed(2)} w=${p._prod.w.toFixed(2)} cap=${p._cap} snap=${p._snap.toFixed(2)} score=${p._score.toFixed(3)} ovr=${p.ovr}`);
  for (const k of Object.keys(p)) if (k.startsWith('_') || (p[k] === 0 && !['num', 'exp', 'ovr', 'pick', 'cy'].includes(k))) delete p[k];
}
mkdirSync('src/data', { recursive: true });
writeFileSync('src/data/league.json', JSON.stringify({ season: SEASON, teams, schedule, players }));

for (const pos of Object.keys(CURVE)) console.log(pos.padEnd(5), byPos[pos].slice(0, 10).map(p => `${p.fn} ${p.ln} ${p.ovr}`).join(', '));
console.log('QB 11-24 ', byPos.QB.slice(10, 24).map(p => `${p.ln} ${p.ovr}`).join(', '));
console.log('WR 11-36 ', byPos.WR.slice(10, 36).map(p => `${p.ln} ${p.ovr}`).join(', '));
console.log(`90+: ${players.filter(p => p.ovr >= 90).length}  80-89: ${players.filter(p => p.ovr >= 80 && p.ovr < 90).length}  ${teams.length} teams, ${players.length} players, ${schedule.length} games`);
