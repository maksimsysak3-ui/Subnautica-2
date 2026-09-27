/**
 * Scenarios: objectives tick as the city meets them and stay ticked, the
 * challenge is won only with every one met at once, the deadline ends it, and
 * a save brings back exactly where it stood.
 *
 *   node tools/scenario-test.mjs
 */
import * as esbuild from 'esbuild';

const src = new URL('../src/', import.meta.url).pathname;
const bundle = (await esbuild.build({
  stdin: {
    contents: `export { SCENARIOS, scenarioById, startScenario, checkScenario, restoreScenario } from '${src}sim/scenarios';`,
    resolveDir: src, loader: 'ts',
  },
  bundle: true, format: 'esm', write: false, target: 'es2022', loader: { '.wgsl': 'text' },
})).outputFiles[0].text;
const M = await import('data:text/javascript;base64,' + Buffer.from(bundle).toString('base64'));

let failed = 0, checks = 0;
const check = (ok, what) => { checks++; if (!ok) failed++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}`); };

/** Just enough of a city for the objectives to read. */
const city = (o = {}) => ({
  sim: { people: { population: o.pop ?? 0, happiness: o.happy ?? 0.5 }, economy: { tourism: { visitors: o.visitors ?? 0, beds: o.beds ?? 0 } } },
  world: { council: { finished: o.projects ?? [] }, budget: { balance: o.balance ?? 0 } },
});

check(M.SCENARIOS.length >= 5, `${M.SCENARIOS.length} scenarios`);
check(new Set(M.SCENARIOS.map((s) => s.id)).size === M.SCENARIOS.length, 'every scenario has its own id');
for (const s of M.SCENARIOS) {
  check(s.objectives.length > 0 && s.days > 0 && s.blurb.length > 40, `${s.name} asks for something, by a date, and says so`);
  // Every objective can be read off an empty city without throwing.
  const c = city();
  check(s.objectives.every((o) => { const [h, n] = o.progress(c.sim, c.world); return Number.isFinite(h) && n > 0; }), `${s.name}'s objectives read cleanly`);
}

// Boomtown, step by step.
{
  const def = M.scenarioById('boomtown');
  const st = M.startScenario(def, 0);
  let c = city({ pop: 12500, happy: 0.4 });
  let got = M.checkScenario(st, c.sim, c.world, 10);
  check(got?.met.length === 1 && st.status === 'running', 'the population objective ticks on its own');
  c = city({ pop: 11000, happy: 0.65 });
  got = M.checkScenario(st, c.sim, c.world, 20);
  check(st.status === 'running' && st.met[0] === true, 'a met objective stays ticked, but the win needs both at once');
  c = city({ pop: 12100, happy: 0.62 });
  got = M.checkScenario(st, c.sim, c.world, 30);
  check(got?.ended === 'won' && st.status === 'won' && st.endedOn === 30, 'both at once: won');
  check(M.checkScenario(st, c.sim, c.world, 31) === null, 'a won challenge says nothing more');
}

// The deadline.
{
  const def = M.scenarioById('tourist');
  const st = M.startScenario(def, 5);
  const c = city({ pop: 9000, visitors: 200, beds: 400 });
  check(M.checkScenario(st, c.sim, c.world, st.until - 1)?.ended === undefined, 'still running the day before the deadline');
  check(M.checkScenario(st, c.sim, c.world, st.until)?.ended === 'lost' && st.status === 'lost', 'lost on the deadline');
}

// Project objectives read the council.
{
  const st = M.startScenario(M.scenarioById('floodplain'), 0);
  const c = city({ pop: 6000, projects: ['floodDefences', 'emergencyPlan'] });
  check(M.checkScenario(st, c.sim, c.world, 40)?.ended === 'won', 'a finished project counts');
}

// Save and restore.
{
  const st = M.startScenario(M.scenarioById('green'), 3);
  st.met[2] = true;
  const back = M.restoreScenario(JSON.parse(JSON.stringify(st)));
  check(back?.id === 'green' && back.met[2] === true && back.until === st.until, 'a scenario survives a save');
  check(M.restoreScenario(undefined) === null, 'free play stays free play');
  check(M.restoreScenario({ id: 'nonsense', from: 0, until: 9 }) === null, 'an unknown scenario is refused');
}

console.log(`\n${checks} checks`);
console.log(failed === 0 ? 'SCENARIOS_OK' : `SCENARIOS: ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
