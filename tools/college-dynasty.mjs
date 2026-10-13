// Data for the college game: every FBS program (logo, colours, conference) and its full
// 2026 roster with ESPN headshots, from cfbfastR. Ratings come from the same production,
// size and program model the NFL game uses for prospects, rescaled for college:
// a true freshman at a small school sits in the 50s, an All-American in the 90s.
// Writes college/src/data.json.
import { writeFileSync, mkdirSync } from 'node:fs';
import { csv, get, num, tierOf, nflPos, sizeFit, seasonStats, production } from './college.mjs';

const B = 'https://raw.githubusercontent.com/sportsdataverse/cfbfastR-data/main';
const FBS = new Set(['SEC', 'Big Ten', 'Big 12', 'ACC', 'FBS Independents', 'Pac-12', 'American Athletic', 'Mountain West', 'Sun Belt', 'Conference USA', 'Mid-American']);
const CONF_SHORT = { 'American Athletic': 'American', 'FBS Independents': 'Independent', 'Conference USA': 'C-USA', 'Mid-American': 'MAC' };

const teamsRaw = csv(get('.cache/cfb/teams.csv', `${B}/teams/teams_colors_logos.csv`)).filter(t => FBS.has(t.conference));
const roster = csv(get('.cache/cfb/cfb_rosters_2026.csv', `${B}/rosters/csv/cfb_rosters_2026.csv`));
// Last season's production is what the rating is built on (the current one is partial).
const s25 = seasonStats(2025), s24 = seasonStats(2024);

const bySchool = new Map(teamsRaw.map(t => [t.school, t]));
const cands = [];
for (const r of roster) {
  const t = bySchool.get(r.team); if (!t) continue;
  const pos = nflPos(r); if (!pos || !r.first_name) continue;
  const prod = production(pos, s25.players.get(r.athlete_id)) ?? production(pos, s24.players.get(r.athlete_id));
  cands.push({ r, t, pos, prod });
}
// Production as a percentile among all FBS players at the position.
const byPos = new Map();
for (const c of cands) if (c.prod !== null) (byPos.get(c.pos) ?? byPos.set(c.pos, []).get(c.pos)).push(c.prod);
for (const a of byPos.values()) a.sort((x, y) => x - y);
const pct = (pos, v) => { const a = byPos.get(pos) ?? []; let lo = 0, hi = a.length; while (lo < hi) { const m = (lo + hi) >> 1; a[m] < v ? (lo = m + 1) : (hi = m); } return a.length ? lo / a.length : 0.5; };
// Win rate (last season) lifts a program's whole roster a little: talent concentrates at winners.
const win = school => s25.teams.get(school)?.win ?? 0.5;
// Program prestige: the blue bloods recruit and develop at another level.
const PRESTIGE = { 'Ohio State': 1, Georgia: 1, Alabama: 1, Texas: 0.95, Oregon: 0.95, 'Notre Dame': 0.9, LSU: 0.85, Michigan: 0.85, 'Penn State': 0.85, Clemson: 0.8, Tennessee: 0.75, Miami: 0.75, USC: 0.75, Oklahoma: 0.75, 'Texas A&M': 0.7, 'Florida State': 0.65, Florida: 0.65, 'Ole Miss': 0.7, Auburn: 0.6, Indiana: 0.6, 'South Carolina': 0.5, Washington: 0.55, Utah: 0.5, Iowa: 0.45, Wisconsin: 0.45, Nebraska: 0.45, Missouri: 0.5, 'Texas Tech': 0.5, 'Arizona State': 0.45, BYU: 0.45, 'Kansas State': 0.4, Louisville: 0.45, 'Virginia Tech': 0.35, SMU: 0.4, 'Boise State': 0.4, Baylor: 0.35, TCU: 0.35, UCLA: 0.35, Colorado: 0.35, Illinois: 0.35, Kentucky: 0.3, Arkansas: 0.3, 'Mississippi State': 0.25, Vanderbilt: 0.3, 'Iowa State': 0.35, Minnesota: 0.3, Pittsburgh: 0.3, Duke: 0.3, 'North Carolina': 0.35, 'NC State': 0.3, 'Georgia Tech': 0.3 };
const YEAR = ['', 'FR', 'SO', 'JR', 'SR', 'SR'];

let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const players = cands.map(({ r, t, pos, prod }) => {
  const yr = Math.max(1, Math.min(5, num(r.year) || 1));
  const tier = tierOf(t.conference);
  const p = prod === null ? null : pct(pos, prod);
  let ovr = 47 + tier * 9 + win(t.school) * 5 + (PRESTIGE[t.school] ?? 0) * 9 + (yr - 1) * 3.2 + sizeFit(pos, num(r.height), num(r.weight)) * 6;
  ovr += p === null ? -2 + rnd() * 6 : p * 22 - 4;
  ovr = Math.round(Math.max(42, Math.min(97, ovr)));
  const out = { id: r.athlete_id, fn: r.first_name, ln: r.last_name, t: Number(t.team_id), pos, yr, ht: num(r.height), wt: num(r.weight), num: num(r.jersey) || 0, ovr };
  if (r.headshot_url) out.hs = 1;
  if (r.home_city) out.home = `${r.home_city}${r.home_state ? `, ${r.home_state}` : ''}`;
  return out;
});
// Keep a realistic 85-ish scholarship roster per team: the best by rating, all positions covered.
const keep = [];
for (const t of teamsRaw) {
  const mine = players.filter(p => p.t === Number(t.team_id)).sort((a, b) => b.ovr - a.ovr);
  keep.push(...mine.slice(0, 95));
}
const rating = id => { const top = keep.filter(p => p.t === id).sort((a, b) => b.ovr - a.ovr).slice(0, 24); return top.length ? Math.round(top.reduce((a, p) => a + p.ovr, 0) / top.length) : 0; };
const teams = teamsRaw.map(t => ({
  id: Number(t.team_id), school: t.school, mascot: t.mascot, abbr: t.abbreviation, conf: CONF_SHORT[t.conference] ?? t.conference,
  prestige: Math.round((0.2 + (PRESTIGE[t.school] ?? 0) * 0.8 + tierOf(t.conference) * 0.2) * 5 * 2) / 2, c1: t.color || '#333333', c2: t.alt_color || '#ffffff', ovr: rating(Number(t.team_id)), win: Math.round(win(t.school) * 100) / 100,
})).filter(t => t.ovr > 0).sort((a, b) => b.ovr - a.ovr);

mkdirSync('college/src', { recursive: true });
writeFileSync('college/src/data.json', JSON.stringify({ season: 2026, teams, players: keep.filter(p => teams.some(t => t.id === p.t)) }));
console.log(teams.length, 'teams', keep.length, 'players');
console.log(teams.slice(0, 12).map(t => `${t.school} ${t.ovr}`).join(' | '));
console.log(teams.slice(-5).map(t => `${t.school} ${t.ovr}`).join(' | '));
