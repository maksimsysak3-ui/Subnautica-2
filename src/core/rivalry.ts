// Rivalries. Every pair of teams carries "heat" (0-100). Division rivals start warm and
// the league's classic feuds start hot; close finishes, overtime, blowouts, playoff
// knockouts and podium trash talk raise it, and it cools a little every offseason.
// Heat makes the game itself different: a louder home crowd, more personal fouls,
// and more volatile results.
import type { Game, League } from './types';
import { clamp } from './rng';
import { news } from './season';

const CLASSIC: [string, string][] = [
  ['GB', 'CHI'], ['DAL', 'PHI'], ['DAL', 'WAS'], ['NYG', 'DAL'], ['PIT', 'BAL'], ['PIT', 'CLE'], ['KC', 'LV'], ['DEN', 'LV'],
  ['NE', 'NYJ'], ['SF', 'SEA'], ['SF', 'DAL'], ['NO', 'ATL'], ['GB', 'MIN'], ['BAL', 'CIN'], ['BUF', 'MIA'], ['KC', 'BUF'],
];
export const HEAT_LEVELS = [[0, 'Cold'], [25, 'Heated'], [50, 'Bad Blood'], [75, 'Blood Feud']] as const;
export const heatLevel = (h: number) => [...HEAT_LEVELS].reverse().find(([min]) => h >= min)![1];

const key = (a: string, b: string) => (a < b ? `${a}-${b}` : `${b}-${a}`);
function store(L: League): Record<string, number> {
  const S = L as League & { rivalry?: Record<string, number> };
  if (S.rivalry) return S.rivalry;
  const r: Record<string, number> = {};
  const teams = Object.values(L.teams);
  for (const a of teams) for (const b of teams) if (a.abbr < b.abbr && a.conf === b.conf && a.div === b.div) r[key(a.abbr, b.abbr)] = 35;
  for (const [a, b] of CLASSIC) if (L.teams[a] && L.teams[b]) r[key(a, b)] = Math.max(r[key(a, b)] ?? 0, 60);
  S.rivalry = r;
  return r;
}
export const heat = (L: League, a: string, b: string) => store(L)[key(a, b)] ?? 0;
function bump(L: League, a: string, b: string, d: number) {
  const r = store(L), k = key(a, b), before = r[k] ?? 0;
  r[k] = clamp(before + d, 0, 100);
  const was = heatLevel(before), now = heatLevel(r[k]);
  if (now !== was && r[k] > before && (a === L.user || b === L.user || r[k] >= 75))
    news(L, 'league', `${L.teams[a].nick}-${L.teams[b].nick} has turned into ${now === 'Blood Feud' ? 'a blood feud' : now === 'Bad Blood' ? 'bad blood' : 'a heated rivalry'}.`, [a, b], { big: now === 'Blood Feud' });
}

/** After every game: what it did to the rivalry. */
export function rivalryAfterGame(L: League, g: Game) {
  const r = g.result; if (!r) return;
  const m = Math.abs(r.hs - r.as);
  const div = L.teams[g.home].conf === L.teams[g.away].conf && L.teams[g.home].div === L.teams[g.away].div;
  let d = div ? 2 : 0;
  if (m <= 3) d += 7; else if (m <= 8) d += 3;
  if (r.ot) d += 5;
  if (m >= 24) d += 4;                       // nobody forgets a humiliation
  if (g.week > 18) d += 18;                  // playoff knockouts linger for years
  if (d) bump(L, g.home, g.away, d);
}
/** Bulletin-board material from the podium heats it up too. */
export function rivalryTrashTalk(L: League, opp: string) { bump(L, L.user, opp, 6); }
/** The offseason cools every rivalry a little (classic ones never go cold). */
export function rivalryOffseason(L: League) {
  const r = store(L);
  for (const k of Object.keys(r)) r[k] = Math.max(CLASSIC.some(([a, b]) => key(a, b) === k) ? 45 : 0, Math.round(r[k] * 0.88));
}
/** The user's hottest rivalries. */
export function topRivals(L: League, team = L.user, n = 3) {
  return Object.keys(L.teams).filter(t => t !== team).map(t => ({ t, h: heat(L, team, t) })).filter(x => x.h > 0).sort((a, b) => b.h - a.h).slice(0, n);
}
