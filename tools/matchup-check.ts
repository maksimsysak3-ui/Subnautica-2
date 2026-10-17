// Does talent decide games? Points scored against (offense rating - opposing defense rating),
// live engine vs stat engine. Usage: tsx tools/matchup-check.ts [games] [live 0|1]
import { createLeague } from '../src/core/league';
import { GameSim, simHooks } from '../src/sim/game';
import { runLivePlay } from '../src/ui/field/live';

simHooks.live = runLivePlay;
const N = Number(process.argv[2] ?? 60), LIVE = process.argv[3] !== '0';
const L = createLeague('KC', 'Test', { seed: 4242 });
const unit = (abbr: string, spec: [string, number][]) => {
  const ps = Object.values(L.players).filter(p => p.team === abbr && p.status === 'ACT');
  let s = 0, n = 0;
  for (const [pos, k] of spec) for (const p of ps.filter(p => p.pos === pos).sort((a, b) => b.ovr - a.ovr).slice(0, k)) { s += p.ovr; n++; }
  return s / Math.max(1, n);
};
const OFF: [string, number][] = [['QB', 1], ['QB', 1], ['QB', 1], ['RB', 1], ['WR', 3], ['TE', 1], ['OT', 2], ['OG', 2], ['C', 1]];
const DEF: [string, number][] = [['EDGE', 2], ['DT', 2], ['LB', 2], ['CB', 3], ['S', 2]];
const xs: number[] = [], ys: number[] = [];
for (const g of L.games.slice(0, N)) {
  const sim = new GameSim(L, g, 900 + xs.length); sim.liveOn = LIVE;
  const r = sim.simToEnd();
  xs.push(unit(g.away, OFF) - unit(g.home, DEF)); ys.push(r.as);
  xs.push(unit(g.home, OFF) - unit(g.away, DEF)); ys.push(r.hs);
}
const m = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
const mx = m(xs), my = m(ys);
let sxy = 0, sxx = 0, syy = 0; xs.forEach((x, i) => { sxy += (x - mx) * (ys[i] - my); sxx += (x - mx) ** 2; syy += (ys[i] - my) ** 2; });
const top = xs.map((x, i) => [x, ys[i]]).sort((a, b) => b[0] - a[0]), q = Math.floor(top.length / 4);
console.log(`${LIVE ? 'live' : 'stat'}: r=${(sxy / Math.sqrt(sxx * syy)).toFixed(2)}  pts per +1 gap=${(sxy / sxx).toFixed(2)}  best-quarter mismatches ${m(top.slice(0, q).map(v => v[1])).toFixed(1)} pts, worst ${m(top.slice(-q).map(v => v[1])).toFixed(1)} pts, gap sd ${Math.sqrt(sxx / xs.length).toFixed(1)}`);
