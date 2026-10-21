// Full seasons end to end: npx tsx fc/tools/season-test.ts [seasons]
import { createWorld } from '../src/core/world';
import { advanceDay, endSeason, startSeason, table, playFixture } from '../src/core/season';
import { fmtMoney } from '../src/core/transfers';

const N = +(process.argv[2] ?? 1);
const w = createWorld('arsenal', 'Test', 7);
startSeason(w);
for (let s = 0; s < N; s++) {
  const t0 = Date.now();
  let guard = 0;
  for (;;) {
    const stop = advanceDay(w);
    if (stop?.kind === 'match') { playFixture(w, stop.fx); continue; }
    if (stop?.kind === 'seasonEnd') break;
    if (stop?.kind === 'sacked') { console.log('sacked'); w.sacked = false; }
    if (++guard > 400) throw new Error('stuck');
  }
  const unplayed = w.fixtures.filter(f => !f.res).length;
  console.log(`season ${w.season} done in ${Date.now() - t0}ms, fixtures ${w.fixtures.length}, unplayed ${unplayed}`);
  for (const id of ['english-premier-league', 'la-liga', 'bundesliga', 'serie-a', 'ligue-1']) {
    const t = table(w, id);
    console.log(id, t.slice(0, 4).map(r => `${w.clubs[r.id].short} ${r.pts}`).join(', '), '...', t.slice(-3).map(r => `${w.clubs[r.id].short} ${r.pts}`).join(', '));
  }
  for (const id of ['ucl', 'uel', 'cup-england', 'cup-spain']) console.log(id, 'winner', w.comps[id].winner && w.clubs[w.comps[id].winner!].name, w.comps[id].phase ?? '');
  const tr = w.transfers.filter(t => t.season === w.season);
  console.log('transfers', tr.length, 'top:', [...tr].sort((a, b) => b.fee - a.fee).slice(0, 5).map(t => `${t.name} ${w.clubs[t.from]?.short ?? 'FA'}->${w.clubs[t.to].short} ${fmtMoney(t.fee)}`).join('; '));
  const scorers = Object.values(w.players).sort((a, b) => b.s.goals - a.s.goals).slice(0, 5);
  console.log('scorers', scorers.map(p => `${p.name} ${p.s.goals}`).join(', '));
  endSeason(w);
  console.log('awards', w.awards.filter(a => a.season === w.season - 1).slice(0, 4).map(a => `${a.title}: ${w.players[a.pid!]?.name}`).join(' | '));
  console.log('players', Object.keys(w.players).length, 'avg top-flight ovr', (Object.values(w.players).filter(p => p.club && w.clubs[p.club].tier === 1).reduce((s, p) => s + p.ovr, 0) / Object.values(w.players).filter(p => p.club && w.clubs[p.club].tier === 1).length).toFixed(1));
}
