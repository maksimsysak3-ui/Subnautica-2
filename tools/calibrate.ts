// Simulates whole regular seasons headless and compares league-wide output with
// real NFL rates (2023-25 averages). Usage: tsx tools/calibrate.ts [seasons]
import { createLeague } from '../src/core/league';
import { GameSim } from '../src/sim/game';

const seasons = Number(process.argv[2] ?? 3);
const TARGET: Record<string, [number, number]> = {
  // stat: [real value, tolerance]
  'points/team': [22.3, 1.5], 'pass att/team': [33.5, 2.5], 'comp %': [65.0, 2.0], 'yds/att': [7.0, 0.4],
  'sack %': [6.8, 1.0], 'int %': [2.2, 0.4], 'rush att/team': [23.5, 2.5] /* below the real 26.5 by design: fewer, more meaningful runs */, 'yds/carry': [4.35, 0.25],
  'plays/team': [60, 3] /* ~5% under real pace by design */, 'penalties/team': [6.0, 1.2], 'fg %': [84.5, 3], 'xp %': [95.5, 1.5], 'punts/team': [3.4, 0.7],
  'turnovers/team': [1.3, 0.25], 'sacks/team': [2.4, 0.4], 'home win %': [55, 4], 'ot games %': [6, 3], 'td/team': [2.5, 0.3],
  '4th att/team': [1.4, 0.5], 'total yds/team': [330, 20],
};

const acc: Record<string, number> = {};
const add = (k: string, v: number) => { acc[k] = (acc[k] ?? 0) + v; };
let games = 0, homeWins = 0, ot = 0, ties = 0, oneScore = 0, blowout = 0;
const season0: Record<string, Record<string, number>> = {};
const bySeason: Record<string, Record<string, number>>[] = [];
const wins: Record<string, number> = {};
const t0 = Date.now();
for (let s = 0; s < seasons; s++) {
  const league = createLeague('KC', 'Test', { seed: 1000 + s });
  for (const g of league.games) {
    const sim = new GameSim(league, g, 77 + s * 1000 + games);
    const res = sim.simToEnd();
    games++;
    if (res.hs > res.as) homeWins++; else if (res.hs === res.as) ties++;
    if (res.ot) ot++;
    const m = Math.abs(res.hs - res.as); if (m <= 8) oneScore++; if (m >= 21) blowout++;
    for (const [id, l] of Object.entries(res.box!.players)) { const t = ((bySeason[s] ??= {})[id] ??= {}); for (const [k, v] of Object.entries(l)) t[k] = (t[k] ?? 0) + (v as number); }
    if (s === 0) { wins[g.home] = (wins[g.home] ?? 0) + (res.hs > res.as ? 1 : res.hs === res.as ? 0.5 : 0); wins[g.away] = (wins[g.away] ?? 0) + (res.as > res.hs ? 1 : res.hs === res.as ? 0.5 : 0); for (const [id, l] of Object.entries(res.box!.players)) { const t = (season0[id] ??= {}); for (const [k, v] of Object.entries(l)) t[k] = (t[k] ?? 0) + (v as number); } }
    add('points', res.hs + res.as);
    for (const tb of res.box!.teams) { add('plays', tb.plays); add('pen', tb.pen); add('to', tb.to); add('yds', tb.yds); add('sacks', tb.sacks); }
    for (const l of Object.values(res.box!.players)) {
      add('pa', l.pa ?? 0); add('pc', l.pc ?? 0); add('py', l.py ?? 0); add('pint', l.pint ?? 0); add('sk', l.sk ?? 0);
      add('ra', l.ra ?? 0); add('ry', l.ry ?? 0); add('fga', l.fga ?? 0); add('fgm', l.fgm ?? 0); add('xpa', l.xpa ?? 0); add('xpm', l.xpm ?? 0);
      add('pun', l.pun ?? 0); add('td', (l.ptd ?? 0) + (l.rtd ?? 0) + (l.dtd ?? 0) + (l.rettd ?? 0));
    }
    for (const e of sim.events) if (e.down === 4 && (e.type === 'run' || e.type === 'pass' || e.type === 'sack' || e.type === 'scramble')) add('fourth', 1);
  }
}
const tg = games * 2;
// Single-season leaderboards: the league leader and the 5th-best, averaged over every
// simulated season, against recent NFL seasons (2021-24).
const LEAD: Record<string, [number, number]> = { py: [5030, 4350], ptd: [41, 31], ry: [1730, 1250], recy: [1815, 1400], rec: [130, 110], dsk: [19, 14], dint: [8, 5.5] };
let leadBad = 0;
for (const [k, [r1, r5]] of Object.entries(LEAD)) {
  const tops = bySeason.map(se => Object.values(se).map(l => l[k] ?? 0).sort((a, b) => b - a));
  const t1 = tops.reduce((a, t) => a + t[0], 0) / tops.length, t5 = tops.reduce((a, t) => a + t[4], 0) / tops.length;
  const ok = Math.abs(t1 / r1 - 1) <= 0.1 && Math.abs(t5 / r5 - 1) <= 0.1; if (!ok) leadBad++;
  console.log(`${ok ? ' ok ' : 'MISS'}  leader ${k.padEnd(5)} #1 ${t1.toFixed(0).padStart(5)} (real ${r1})   #5 ${t5.toFixed(0).padStart(5)} (real ${r5})`);
}
const out: Record<string, number> = {
  'points/team': acc.points / tg, 'pass att/team': acc.pa / tg, 'comp %': (acc.pc / acc.pa) * 100, 'yds/att': acc.py / acc.pa,
  'sack %': (acc.sk / (acc.pa + acc.sk)) * 100, 'int %': (acc.pint / acc.pa) * 100, 'rush att/team': acc.ra / tg, 'yds/carry': acc.ry / acc.ra,
  'plays/team': acc.plays / tg, 'penalties/team': acc.pen / tg, 'fg %': (acc.fgm / acc.fga) * 100, 'xp %': (acc.xpm / acc.xpa) * 100,
  'punts/team': acc.pun / tg, 'turnovers/team': acc.to / tg, 'sacks/team': acc.sacks / tg, 'home win %': (homeWins / (games - ties)) * 100,
  'ot games %': (ot / games) * 100, 'td/team': acc.td / tg, '4th att/team': (acc.fourth ?? 0) / tg, 'total yds/team': acc.yds / tg,
};
let bad = 0;
for (const [k, v] of Object.entries(out)) {
  const [t, tol] = TARGET[k];
  const ok = Math.abs(v - t) <= tol;
  if (!ok) bad++;
  console.log(`${ok ? ' ok ' : 'MISS'}  ${k.padEnd(16)} ${v.toFixed(2).padStart(7)}   real ${t}`);
}
console.log(`one-score games ${(oneScore / games * 100).toFixed(1)}% (real ~49%), 21+ blowouts ${(blowout / games * 100).toFixed(1)}% (real ~18%)`);
const w = Object.values(wins).sort((a, b) => b - a); console.log(`season 1 wins: best ${w[0]}, worst ${w[w.length - 1]}, sd ${Math.sqrt(w.reduce((a, x) => a + (x - 8.5) ** 2, 0) / w.length).toFixed(2)} (real sd ~3.1)`);
const names = createLeague('KC', 'Test', { seed: 1000 }).players;
const extra: Record<string, string> = { py: 'pa', ry: 'ra', recy: 'rec', dsk: 'gp', ptd: 'pint', rec: 'tgt', dint: 'pd', tkl: 'gp' };
const lead = (k: string) => Object.entries(season0).sort((a, b) => (b[1][k] ?? 0) - (a[1][k] ?? 0)).slice(0, 3).map(([id, l]) => `${names[id]?.ln}(${names[id]?.ovr}) ${l[k]}/${l[extra[k]]}`).join('  ');
for (const k of ['py', 'ptd', 'ry', 'recy', 'rec', 'dsk', 'dint', 'tkl']) console.log(`  leader ${k.padEnd(5)} ${lead(k)}`);
console.log(`${games} games in ${((Date.now() - t0) / 1000).toFixed(1)}s, ${ties} ties. ${bad} metric(s) outside tolerance, ${leadBad} leaderboard(s) off.`);
process.exitCode = bad > 3 ? 1 : 0;
