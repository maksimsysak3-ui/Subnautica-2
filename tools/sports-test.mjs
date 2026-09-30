/**
 * The city's team: founded only with a venue, plays a season, pays and
 * earns, keeps its squad through transfers, and survives a save.
 *
 *   node tools/sports-test.mjs
 */
import * as esbuild from 'esbuild';

const src = new URL('../src/', import.meta.url).pathname;
const bundle = (await esbuild.build({
  stdin: {
    contents: [
      `export { defaultWorld } from '${src}sim/world';`,
      `export { configureSim } from '${src}sim/config';`,
      `export { serialise, deserialise } from '${src}sim/save';`,
      `export { FOUNDING_COST } from '${src}sim/sports';`,
    ].join('\n'),
    resolveDir: src, loader: 'ts',
  },
  bundle: true, format: 'esm', write: false, target: 'es2022', loader: { '.wgsl': 'text' },
})).outputFiles[0].text;
const M = await import('data:text/javascript;base64,' + Buffer.from(bundle).toString('base64'));
M.configureSim({ cityGrid: 200, terrainSize: 9216 });

let failed = 0, checks = 0;
const ok = (cond, what, detail = '') => {
  checks++;
  if (!cond) failed++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${what}${detail ? '  -- ' + detail : ''}`);
};

const world = M.defaultWorld();
const s = world.sports, b = world.budget, news = world.news;
b.balance = 5e6;
ok(s.found('City', 'football', '#c8102e', [], 1, b, news) === 'build a stadium or an arena first', 'no venue, no team');
ok(s.found('City', 'hockey', '#c8102e', ['svc.parks.soccer'], 1, b, news)?.includes('ice arena'), 'a sport needs a venue that suits it');
const before = b.balance;
ok(s.found('Harbour United', 'football', '#c8102e', ['svc.parks.soccer'], 1, b, news) === null, 'founded with a soccer stadium');
ok(before - b.balance === M.FOUNDING_COST, 'founding is paid for');
const t = s.team;
ok(t.roster.length === 20 && t.rivals.length === 7, 'a squad and a league', `${t.roster.length} players, ${t.rivals.length} rivals`);
ok(s.found('Again', 'football', '#000', ['svc.parks.soccer'], 1, b, news) !== null, 'one team per city');

let day = 1, games = 0, gate = 0;
const b0 = b.balance;
while (t.season === 1 && day < 200) { const g = s.update(day, 20000, false, b, news); if (g) { games++; gate += g.gate; } day += 0.5; }
ok(games === s.rounds, 'a season is every rival home and away', `${games} games`);
ok(t.season === 2 && t.history.length === 1, 'the season ends and is remembered', `finished ${t.history[0]?.finish}`);
ok(gate > 0, 'home games take a gate', `${gate}`);
ok(Math.abs(b.balance - b0) > 0, 'the club costs and earns', `${Math.round(b.balance - b0)}`);
const table = s.table();
const played = table.reduce((a, r) => a + r.w + r.d + r.l, 0);
ok(table.length === 8, 'the table lists the whole league');
void played;

const n = t.roster.length;
ok(s.sign(0, b) === null && t.roster.length === n + 1, 'a player can be signed');
ok(s.release(0) === null && t.roster.length === n, 'and one released');

const back = M.deserialise(M.serialise(world, 'sports'));
ok(back?.world.sports.team?.name === 'Harbour United' && back.world.sports.team.season === 2, 'the club survives a save');

console.log(`\n${checks} checks`);
console.log(failed === 0 ? 'SPORTS_OK' : `SPORTS: ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
