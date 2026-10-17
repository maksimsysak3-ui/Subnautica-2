// The live play engine against real NFL rates: whole games with every scrimmage play run
// by 22 players on the field (src/ui/field/live.ts). Usage: tsx tools/live-calibrate.ts [games]
import { createLeague } from '../src/core/league';
import { GameSim, simHooks } from '../src/sim/game';
import { runLivePlay } from '../src/ui/field/live';

simHooks.live = runLivePlay;
const N = Number(process.argv[2] ?? 40);
const TARGET: Record<string, [number, number]> = {
  'comp %': [65.0, 2.5], 'yds/att': [7.0, 0.5], 'sack %': [6.8, 1.2], 'int %': [2.2, 0.5], 'yds/carry': [4.35, 0.35],
  'points/team': [22.3, 2.5], 'td/team': [2.5, 0.4], 'yds/catch': [11.0, 1.0], 'air yds/att': [7.5, 1.2], 'scramble %': [3.5, 2],
};
const league = createLeague('KC', 'Test', { seed: 4242 });
const a: Record<string, number> = {};
const add = (k: string, v: number) => (a[k] = (a[k] ?? 0) + v);
let games = 0, plays = 0, t0 = Date.now(), longest = 0;
for (const g of league.games.slice(0, N)) {
  const sim = new GameSim(league, g, 900 + games);
  sim.liveOn = true;
  const res = sim.simToEnd();
  games++; add('points', res.hs + res.as);
  for (const l of Object.values(res.box!.players)) {
    add('pa', l.pa ?? 0); add('pc', l.pc ?? 0); add('py', l.py ?? 0); add('pint', l.pint ?? 0); add('sk', l.sk ?? 0);
    add('ra', l.ra ?? 0); add('ry', l.ry ?? 0); add('td', (l.ptd ?? 0) + (l.rtd ?? 0) + (l.dtd ?? 0) + (l.rettd ?? 0));
  }
  for (const e of sim.events) {
    if (e.type === 'pass' && e.air !== undefined) { add('airsum', e.air); add('airn', 1); }
    if (e.type === 'scramble') add('scr', 1);
    if (e.type === 'pass' || e.type === 'run' || e.type === 'sack' || e.type === 'scramble') { plays++; longest = Math.max(longest, e.yards); }
  }
}
const tg = games * 2;
const out: Record<string, number> = {
  'comp %': (a.pc / a.pa) * 100, 'yds/att': a.py / a.pa, 'sack %': (a.sk / (a.pa + a.sk)) * 100, 'int %': (a.pint / a.pa) * 100,
  'yds/carry': a.ry / a.ra, 'points/team': a.points / tg, 'td/team': a.td / tg, 'yds/catch': a.py / a.pc, 'air yds/att': a.airsum / a.airn,
  'scramble %': ((a.scr ?? 0) / (a.pa + a.sk + (a.scr ?? 0))) * 100,
};
let bad = 0;
for (const [k, v] of Object.entries(out)) { const [r, tol] = TARGET[k]; const ok = Math.abs(v - r) <= tol; if (!ok) bad++; console.log(`${ok ? ' ok ' : 'MISS'}  ${k.padEnd(12)} ${v.toFixed(2).padStart(7)}   (real ${r} ± ${tol})`); }
console.log(`${games} games, ${plays} live plays, longest ${longest}, ${((Date.now() - t0) / plays).toFixed(1)} ms/play, ${bad} misses`);
