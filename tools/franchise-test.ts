// Plays a franchise through several full years (every phase) and checks that the
// league stays healthy: schedules, rosters, cap, rating levels, drafts, awards.
import { createLeague, teamRatings } from '../src/core/league';
import { advance } from '../src/core/season';
import { capSpace } from '../src/core/contracts';
import type { League } from '../src/core/types';

const years = Number(process.argv[2] ?? 6);
const league: League = createLeague('DET', 'Test GM', { seed: 4242 });
const problems: string[] = [];
const t0 = Date.now();
const summary = (L: League) => {
  const act = Object.values(L.players).filter(p => p.team !== 'FA' && p.team !== 'RET' && p.status === 'ACT');
  const avg = act.reduce((a, p) => a + p.ovr, 0) / act.length;
  const n90 = act.filter(p => p.ovr >= 90).length;
  const fa = Object.values(L.players).filter(p => p.team === 'FA' && p.status === 'FA').length;
  return { avg: avg.toFixed(1), n90, act: act.length, fa };
};
console.log('start', summary(league));
for (let y = 0; y < years; y++) {
  const season = league.season;
  // Schedule sanity.
  const games = league.games.filter(g => g.season === season && g.week <= 18);
  const count: Record<string, number> = {};
  for (const g of games) { count[g.home] = (count[g.home] ?? 0) + 1; count[g.away] = (count[g.away] ?? 0) + 1; }
  if (games.length !== 272 || Object.values(count).some(n => n !== 17)) problems.push(`${season}: schedule ${games.length} games, counts ${[...new Set(Object.values(count))]}`);
  let guard = 0;
  while (league.season === season && guard++ < 200) await advance(league, { auto: true });
  // Now in the new league year's re-sign phase: run to the next opener.
  while (league.phase !== 'regular' && guard++ < 400) await advance(league, { auto: true });
  const a = league.awards.find(x => x.season === season);
  const champ = a?.champion ? league.teams[a.champion].nick : '?';
  const mvp = a?.mvp ? `${league.players[a.mvp].fn} ${league.players[a.mvp].ln}` : '?';
  for (const t of Object.keys(league.teams)) {
    const act = Object.values(league.players).filter(p => p.team === t && p.status === 'ACT').length;
    if (act < 46 || act > 53) problems.push(`${league.season} ${t}: ${act} active`);
    if (capSpace(league, t) < -15_000_000) problems.push(`${league.season} ${t}: cap ${Math.round(capSpace(league, t) / 1e6)}M`);
    if (!Object.values(league.players).some(p => p.team === t && p.pos === 'QB' && p.status === 'ACT')) problems.push(`${league.season} ${t}: no QB`);
  }
  const top = Object.keys(league.teams).map(t => [t, teamRatings(league, t).ovr] as const).sort((a, b) => b[1] - a[1]);
  console.log(season, `champ ${champ}, MVP ${mvp}`, summary(league), `best team ${top[0][0]} ${top[0][1]}, worst ${top[31][0]} ${top[31][1]}`);
}
console.log(`${years} seasons in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
if (problems.length) { console.log('PROBLEMS:\n' + [...new Set(problems)].slice(0, 30).join('\n')); process.exitCode = 1; }
