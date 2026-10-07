// Real draft classes from current college rosters (cfbfastR / CFBD / ESPN).
// Every prospect is a real player with an ESPN headshot and his school's logo.
//
// Talent score per player:
//   production  - play-level college stats aggregated per season (2026 > 2025 > 2024),
//                 ranked against every college player at the position
//   program     - conference tier and team win rate (talent concentrates at winners)
//   size fit    - height/weight against NFL norms for the position
//   maturity    - class year (upperclassmen are more finished)
// Draft year: seniors 2027; juniors 2027 if elite (declare early) else 2028;
// sophomores 2028 if elite else 2029; freshmen 2029 if elite else 2030.
import { readFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';

const B = 'https://raw.githubusercontent.com/sportsdataverse/cfbfastR-data/main';
const SEASON = 2026;
function get(path, url) {
  if (!existsSync(path)) execSync(`curl -sSfL -o "${path}" "${url}"`, { stdio: 'inherit' });
  return readFileSync(path, 'utf8');
}
function csv(text) {
  const lines = text.split('\n');
  const head = splitLine(lines.shift());
  return lines.filter(Boolean).map(l => { const c = splitLine(l); return Object.fromEntries(head.map((h, i) => [h, c[i] ?? ''])); });
}
function splitLine(line) {
  const out = []; let cell = '', q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) { if (ch === '"') { if (line[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; }
    else if (ch === '"') q = true; else if (ch === ',') { out.push(cell); cell = ''; } else if (ch !== '\r') cell += ch;
  }
  out.push(cell);
  return out;
}
const num = v => (v === '' || v === 'NA' ? 0 : Number(v) || 0);

const TIER = { SEC: 1, 'Big Ten': 1, 'Big 12': 0.9, ACC: 0.88, 'FBS Independents': 0.85, 'Pac-12': 0.82, 'American Athletic': 0.72, 'Mountain West': 0.7, 'Sun Belt': 0.7, 'Conference USA': 0.64, 'Mid-American': 0.64 };
const tierOf = c => TIER[c] ?? 0.48; // FCS and below

// NFL position from the college label plus size.
function nflPos(r) {
  const p = r.position, h = num(r.height), w = num(r.weight);
  switch (p) {
    case 'QB': case 'RB': case 'WR': case 'TE': case 'FB': case 'LS': case 'P': case 'CB': case 'S': return p;
    case 'PK': return 'K';
    case 'OT': case 'G': case 'C': return p;
    case 'OL': return h >= 77 ? 'OT' : w <= 305 && h <= 75 ? 'C' : 'G';
    case 'DE': case 'EDGE': return w >= 285 ? 'DT' : 'EDGE';
    case 'DT': case 'NT': return 'DT';
    case 'DL': return w >= 280 ? 'DT' : 'EDGE';
    case 'LB': return 'LB';
    case 'DB': return h >= 73 || w >= 200 ? 'S' : 'CB';
    case 'ATH': return w >= 215 ? 'RB' : 'WR';
    default: return null;
  }
}
const SIZE = { QB: [75, 220], RB: [70.5, 212], FB: [72.5, 245], WR: [72.5, 200], TE: [76.5, 250], OT: [77.5, 315], G: [76, 315], C: [75, 303], EDGE: [76, 256], DT: [75, 305], LB: [73.5, 236], CB: [71.5, 192], S: [72, 204], K: [72, 195], P: [74, 210], LS: [74, 240] };
function sizeFit(pos, h, w) {
  const [H, W] = SIZE[pos];
  // Bigger than the norm is mostly fine for linemen; undersized hurts everywhere.
  const dh = (h - H) / 2, dw = (w - W) / (W * 0.08);
  return Math.max(0, Math.min(1, 0.6 + Math.min(dh, 1) * 0.15 + Math.max(-2, Math.min(dw, 1.5)) * 0.12));
}

/** Aggregate play-level stats into per-player season lines. */
function seasonStats(year) {
  const text = get(`.cache/cfb/player_stats_${year}.csv`, `${B}/player_stats/csv/player_stats_${year}.csv`);
  const rows = csv(text);
  const P = new Map(), T = new Map();
  const L = id => { let e = P.get(id); if (!e) P.set(id, (e = { games: new Set(), py: 0, pc: 0, pa: 0, ptd: 0, pint: 0, ry: 0, ra: 0, rtd: 0, rec: 0, recy: 0, rectd: 0, tgt: 0, sk: 0, int: 0, pbu: 0, ff: 0, fgm: 0, fga: 0 })); return e; };
  for (const r of rows) {
    const g = r.game_id;
    if (!T.has(r.team)) T.set(r.team, { conf: r.conference, games: new Map() });
    T.get(r.team).games.set(g, num(r.team_score) - num(r.opponent_score));
    const add = (id, f) => { if (id && id !== 'NA') { const e = L(id); e.games.add(g); f(e); } };
    add(r.completion_player_id, e => { e.pc++; e.pa++; e.py += num(r.completion_yds); });
    add(r.incompletion_player_id, e => { e.pa++; });
    add(r.interception_thrown_player_id, e => { e.pint++; e.pa++; });
    add(r.reception_player_id, e => { e.rec++; e.recy += num(r.reception_yds); });
    add(r.target_player_id, e => { e.tgt++; });
    add(r.rush_player_id, e => { e.ra++; e.ry += num(r.rush_yds); });
    add(r.sack_player_id, e => { e.sk += num(r.sack_stat) || 1; });
    add(r.interception_player_id, e => { e.int++; });
    add(r.pass_breakup_player_id, e => { e.pbu++; });
    add(r.fumble_forced_player_id, e => { e.ff++; });
    add(r.field_goal_made_player_id, e => { e.fgm++; e.fga++; });
    add(r.field_goal_missed_player_id, e => { e.fga++; });
    if (r.touchdown_player_id && r.touchdown_player_id !== 'NA') {
      const e = L(r.touchdown_player_id);
      if (r.reception_player_id === r.touchdown_player_id) e.rectd++;
      else if (r.rush_player_id === r.touchdown_player_id) e.rtd++;
    }
    if (r.completion_player_id && r.completion_player_id !== 'NA' && r.touchdown_player_id && r.touchdown_player_id === r.reception_player_id) L(r.completion_player_id).ptd++;
  }
  // Final score margin per game per team -> win rate.
  const teams = new Map();
  for (const [t, v] of T) {
    const margins = [...v.games.values()];
    teams.set(t, { conf: v.conf, win: margins.filter(m => m > 0).length / Math.max(1, margins.length) });
  }
  return { players: P, teams };
}

function production(pos, e) {
  if (!e) return null;
  const g = Math.max(1, e.games.size);
  switch (pos) {
    case 'QB': return e.pa < 60 ? null : (e.py / g) * 0.01 + (e.ptd - e.pint * 1.5) / g * 0.6 + (e.pc / Math.max(1, e.pa)) * 3 + (e.ry / g) * 0.01;
    case 'RB': case 'FB': return e.ra + e.rec < 25 ? null : ((e.ry + e.recy) / g) * 0.02 + (e.rtd + e.rectd) / g * 0.6 + (e.ry / Math.max(1, e.ra)) * 0.25;
    case 'WR': case 'TE': return e.rec < 8 ? null : (e.recy / g) * 0.025 + e.rectd / g * 0.8 + (e.recy / Math.max(1, e.rec)) * 0.06;
    case 'EDGE': case 'DT': case 'LB': return e.sk + e.ff + e.pbu + e.int < 1 ? null : (e.sk * 1 + e.ff * 0.8 + e.pbu * 0.3 + e.int * 0.8) / Math.max(4, g) * 4;
    case 'CB': case 'S': return e.int + e.pbu < 1 ? null : (e.int * 1.2 + e.pbu * 0.6 + e.ff * 0.5) / Math.max(4, g) * 4;
    case 'K': return e.fga < 5 ? null : e.fgm / e.fga + e.fgm * 0.01;
    default: return null;
  }
}

const PEDIGREE = new Set(JSON.parse(readFileSync('tools/pedigree.json', 'utf8')).names);

export function buildProspects() {
  const roster = csv(get('.cache/cfb/cfb_rosters_2026.csv', `${B}/rosters/csv/cfb_rosters_2026.csv`));
  const logos = new Map(csv(get('.cache/cfb/teams.csv', `${B}/teams/teams_colors_logos.csv`)).map(t => [t.school, t]));
  const seasons = [[SEASON, 0.3], [SEASON - 1, 0.5], [SEASON - 2, 0.2]].map(([y, w]) => ({ y, w, ...seasonStats(y) }));
  // Production per player, blended over seasons.
  const cands = [];
  for (const r of roster) {
    const year = num(r.year);
    if (year < 1 || year > 4) continue;
    const pos = nflPos(r);
    if (!pos || !r.first_name || !r.last_name) continue;
    let prod = 0, pw = 0, conf = '', win = 0.5;
    for (const s of seasons) {
      const q = production(pos, s.players.get(r.athlete_id));
      if (q !== null) { prod += q * s.w; pw += s.w; }
      const t = s.teams.get(r.team);
      if (t && !conf) { conf = t.conf; win = t.win; }
    }
    cands.push({ r, pos, year, prod: pw ? prod / pw : null, pw, conf, win });
  }
  // Rank production within position.
  const byPos = new Map();
  for (const c of cands) if (c.prod !== null) (byPos.get(c.pos) ?? byPos.set(c.pos, []).get(c.pos)).push(c.prod);
  for (const v of byPos.values()) v.sort((a, b) => a - b);
  const pct = (pos, v) => { const a = byPos.get(pos) ?? []; let lo = 0, hi = a.length; while (lo < hi) { const m = (lo + hi) >> 1; a[m] < v ? (lo = m + 1) : (hi = m); } return a.length ? lo / a.length : 0.5; };
  const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return ((h >>> 0) % 10000) / 10000; };
  for (const c of cands) {
    const program = tierOf(c.conf) * 0.7 + c.win * 0.3;
    const fit = sizeFit(c.pos, num(c.r.height), num(c.r.weight));
    const mature = [0, 0.35, 0.6, 0.85, 1][c.year];
    const prodPct = c.prod !== null ? pct(c.pos, c.prod) * Math.min(1, 0.4 + c.pw) : null;
    const noise = (hash(c.r.athlete_id) - 0.5) * 0.12; // what film shows and stats do not
    // Linemen and others without box-score stats get a production proxy: starters on
    // strong programs, scaled by experience, but never above a good producer.
    const proxy = 0.22 + 0.4 * program * mature;
    const p = prodPct ?? proxy;
    c.score = p * 0.45 * (0.55 + 0.45 * tierOf(c.conf)) + program * 0.3 + fit * 0.13 + mature * 0.06 + noise;
    if (['K', 'P', 'LS'].includes(c.pos)) c.score *= 0.7; // specialists go late
    if (PEDIGREE.has(`${c.r.first_name} ${c.r.last_name}`)) c.score += 0.09;
    // How the NFL values positions on draft day.
    c.score += { QB: 0.07, EDGE: 0.035, OT: 0.025, WR: 0.02, CB: 0.02, DT: 0.01, S: -0.015, LB: -0.02, TE: -0.015, G: -0.02, C: -0.03, RB: -0.03, FB: -0.08 }[c.pos] ?? 0;
  }
  if (process.env.WHO) for (const c of cands) if (process.env.WHO.split(',').includes(`${c.r.first_name} ${c.r.last_name}`)) console.log('WHO', c.r.first_name, c.r.last_name, c.pos, c.year, c.conf, c.win.toFixed(2), 'prod', c.prod?.toFixed(2), 'pw', c.pw, 'score', c.score.toFixed(3));
  // Who declares when.
  const quant = (list, q) => { const s = list.map(c => c.score).sort((a, b) => b - a); return s[Math.floor(s.length * q)] ?? 1; };
  const byYear = y => cands.filter(c => c.year === y);
  const jr = quant(byYear(3), 0.12), so = quant(byYear(2), 0.015), fr = quant(byYear(1), 0.004);
  for (const c of cands) {
    c.dy = c.year === 4 ? 2027 : c.year === 3 ? (c.score >= jr ? 2027 : 2028) : c.year === 2 ? (c.score >= so ? 2028 : 2029) : (c.score >= fr ? 2029 : 2030);
  }
  // Each class: the best ~300 with a realistic positional mix.
  const MIX = { QB: 16, RB: 24, FB: 3, WR: 42, TE: 18, OT: 24, G: 20, C: 9, EDGE: 33, DT: 26, LB: 25, CB: 36, S: 22, K: 4, P: 4, LS: 2 };
  const out = [];
  for (const dy of [2027, 2028, 2029, 2030]) {
    const pool = cands.filter(c => c.dy === dy).sort((a, b) => b.score - a.score);
    const take = [];
    for (const [pos, n] of Object.entries(MIX)) take.push(...pool.filter(c => c.pos === pos).slice(0, n));
    take.sort((a, b) => b.score - a.score);
    take.forEach((c, i) => {
      const t = logos.get(c.r.team);
      out.push({
        id: `C${c.r.athlete_id}`, fn: c.r.first_name, ln: c.r.last_name, pos: c.pos, col: c.r.team, colLogo: t?.logo?.replace('http://', 'https://'),
        colColor: t?.color, hs: c.r.headshot_url || undefined, ht: num(c.r.height), wt: num(c.r.weight), dy, cls: c.year, rank: i + 1,
        // Projected OVR when he reaches the draft, from his rank in the class.
        ovr: Math.round(Math.max(44, 79 - 9.5 * Math.log10(1 + i * 0.35) - (i > 120 ? (i - 120) * 0.025 : 0))),
        sc: Math.round(c.score * 1000) / 1000,
      });
    });
  }
  return out;
}

if (process.argv[1]?.endsWith('college.mjs')) {
  const p = buildProspects();
  for (const n of ['Arch Manning', 'Jeremiah Smith', 'Dante Moore', 'Ryan Williams', 'LaNorris Sellers', 'Bryce Underwood', 'Dylan Raiola', 'Cade Klubnik']) { const x = p.find(q => `${q.fn} ${q.ln}` === n); console.log(' ', n, x ? `${x.dy} #${x.rank} ${x.pos} ${x.ovr}` : 'not in a class'); }
  for (const dy of [2027, 2028, 2029, 2030]) {
    const c = p.filter(x => x.dy === dy);
    console.log(dy, c.length, c.slice(0, 12).map(x => `${x.fn} ${x.ln} (${x.pos}, ${x.col}) ${x.ovr}`).join(' | '));
  }
}
