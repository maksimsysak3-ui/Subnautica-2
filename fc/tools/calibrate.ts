// League-wide match rates vs real top-flight averages: npx tsx fc/tools/calibrate.ts [matches]
import { createWorld } from '../src/core/world';
import { Match } from '../src/core/engine';
import type { Fixture } from '../src/core/types';

const N = +(process.argv[2] ?? 600);
const t0 = Date.now();
const w = createWorld('arsenal', 'Test', 42);
console.log('world', Object.keys(w.players).length, 'players', Object.keys(w.clubs).length, 'clubs', Date.now() - t0, 'ms');
const top = Object.values(w.clubs).filter(c => c.tier === 1);
const agg = { g: 0, hw: 0, d: 0, aw: 0, shots: 0, sot: 0, xg: 0, poss: 0, pass: 0, acc: 0, corners: 0, fouls: 0, yel: 0, red: 0, off: 0, n: 0, favWin: 0, favN: 0 };
const t1 = Date.now();
for (let i = 0; i < N; i++) {
  const lg = top[Math.floor(Math.random() * top.length)].league;
  const cl = top.filter(c => c.league === lg);
  const h = cl[Math.floor(Math.random() * cl.length)]; let a = h; while (a === h) a = cl[Math.floor(Math.random() * cl.length)];
  const fx: Fixture = { id: i, comp: 'x', stage: '', day: 0, home: h.id, away: a.id };
  const m = new Match(w, fx); const r = m.simToEnd();
  agg.n++; agg.g += r.hg + r.ag; if (r.hg > r.ag) agg.hw++; else if (r.hg === r.ag) agg.d++; else agg.aw++;
  agg.shots += r.stats.shots[0] + r.stats.shots[1]; agg.sot += r.stats.sot[0] + r.stats.sot[1]; agg.xg += r.stats.xg[0] + r.stats.xg[1];
  agg.pass += r.stats.passes[0] + r.stats.passes[1]; agg.acc += r.stats.passAcc[0] + r.stats.passAcc[1]; agg.corners += r.stats.corners[0] + r.stats.corners[1];
  agg.fouls += r.stats.fouls[0] + r.stats.fouls[1]; agg.yel += r.stats.yellows[0] + r.stats.yellows[1]; agg.red += r.stats.reds[0] + r.stats.reds[1]; agg.off += r.stats.offsides[0] + r.stats.offsides[1];
  if (Math.abs(h.rep - a.rep) >= 15) { agg.favN++; const fav = h.rep > a.rep ? 0 : 1; if ((fav === 0 && r.hg > r.ag) || (fav === 1 && r.ag > r.hg)) agg.favWin++; }
}
const n = agg.n;
const f = (v: number) => (v / n).toFixed(2);
console.log(`${n} matches in ${Date.now() - t1}ms`);
console.log(`goals/g ${f(agg.g)} (2.75)  home ${(agg.hw / n * 100).toFixed(0)}% draw ${(agg.d / n * 100).toFixed(0)}% away ${(agg.aw / n * 100).toFixed(0)}% (45/25/30)`);
console.log(`shots ${f(agg.shots)} (25)  on target ${f(agg.sot)} (8.8)  xG ${f(agg.xg)} (2.9)`);
console.log(`passes ${f(agg.pass)} (900)  acc ${(agg.acc / agg.pass * 100).toFixed(0)}% (82)  corners ${f(agg.corners)} (10)  fouls ${f(agg.fouls)} (22)  yellows ${f(agg.yel)} (3.8)  reds ${f(agg.red)} (0.12)  offsides ${f(agg.off)} (3.5)`);
console.log(`favourite (15+ rep gap) wins ${(agg.favWin / Math.max(1, agg.favN) * 100).toFixed(0)}% of ${agg.favN}`);
