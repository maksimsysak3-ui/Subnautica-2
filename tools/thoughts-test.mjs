/**
 * The thought bubbles, both halves.
 *
 * FIRST, WHAT A BUILDING SAYS. Run headlessly against the simulation alone: cut
 * the power to a district and every building in it says "no power"; give it back
 * and they stop. This is the part that decides whether the feature is honest, and
 * asserting it exactly is cheap because it needs no browser.
 *
 * THEN, WHETHER THE PLAYER SEES IT. In a real browser over a real city with a
 * real camera, because this half fails silently: a projection with the wrong sign
 * puts every bubble behind the camera on screen mirrored, a layer the browser has
 * not laid out yet projects everything to the corner, an icon key with no entry
 * draws an empty circle, and none of the three throws.
 *
 *   node tools/thoughts-test.mjs
 */

import { chromium } from 'playwright';
import http from 'node:http';
import * as esbuild from 'esbuild';

let failed = 0, checks = 0;
const ok = (cond, what, detail = '') => {
  checks++;
  if (!cond) { failed++; console.log(`  FAIL  ${what}${detail ? '  -- ' + detail : ''}`); }
};
const section = (name) => console.log(`\n${name}`);

// ---- the model -------------------------------------------------------------

const src = new URL('../src/', import.meta.url).pathname;
const nodeBundle = (await esbuild.build({
  stdin: {
    contents: [
      `export { Simulation } from '${src}sim/agents/sim';`,
      `export { Gripe, GRIPE_INFO } from '${src}sim/agents/complaints';`,
      `export { Util } from '${src}sim/agents/utilities';`,
      `export { makeCity } from '${src}sim/city';`,
      `export { defaultWorld } from '${src}sim/world';`,
      `export { PLOTS } from '${src}sim/plots';`,
      `export { configureSim } from '${src}sim/config';`,
    ].join('\n'),
    resolveDir: src, loader: 'ts',
  },
  bundle: true, format: 'esm', write: false, target: 'es2022',
})).outputFiles[0].text;
const M = await import('data:text/javascript;base64,'
  + Buffer.from(nodeBundle).toString('base64'));
const { Simulation, Gripe, GRIPE_INFO, makeCity, defaultWorld, PLOTS, configureSim } = M;

section('what a building says');
{
  configureSim({ cityGrid: 200, terrainSize: 9216 });
  const world = defaultWorld();
  for (let p = 0; p < PLOTS * PLOTS; p++) world.land.take(p);
  const sim = new Simulation(makeCity(world), world.net, 0x7401, world);
  sim.found(60);
  sim.step(900);

  // Every gripe in the table has a title, a symptom, a remedy and an icon. A
  // bubble with no sentence behind it is a bubble that says nothing, and the
  // only way that happens is a gripe somebody added and did not describe.
  let described = 0;
  for (const g of Object.values(Gripe)) {
    if (g === Gripe.NONE) continue;
    const info = GRIPE_INFO[g];
    if (info && info.title && info.what && info.fix && info.icon) described++;
  }
  ok(described === Object.values(Gripe).length - 1,
    'every gripe has a card behind it', `${described} of ${Object.values(Gripe).length - 1}`);

  // The round trip, both ways, because either direction alone can pass for the
  // wrong reason: a gripe that never fires and a gripe that never clears look
  // identical from one side.
  //
  // Driven by setting the supply rather than by building power stations, because
  // the claim under test is the mapping from a reading to a sentence -- whether
  // a generating city generates enough is the utility model's own test.
  const have = sim.utilities.have[0];
  have.fill(255);
  for (let i = 0; i < 80; i++) sim.complaints.survey();
  let poweredComplaints = 0;
  for (const c of sim.complaints.list) if (c.gripe === Gripe.POWER) poweredComplaints++;
  ok(poweredComplaints === 0, 'a city with power does not complain about it',
    `${poweredComplaints} did`);

  // Now cut it, which is what a blackout is, and sweep again.
  have.fill(0);
  // A full sweep of the table, however big it is.
  for (let i = 0; i < 80; i++) sim.complaints.survey();
  let dark = 0, lit = 0;
  for (const c of sim.complaints.list) {
    if (c.gripe === Gripe.POWER) dark++; else lit++;
  }
  ok(dark > 20, 'cutting the power makes them say so', `${dark} said it`);
  ok(dark > lit, 'and it outranks everything else they could say',
    `${dark} power vs ${lit} other`);

  // And back. The gripe has to clear, not merely be outranked.
  have.fill(255);
  for (let i = 0; i < 80; i++) sim.complaints.survey();
  let still = 0;
  for (const c of sim.complaints.list) if (c.gripe === Gripe.POWER) still++;
  ok(still === 0, 'restoring it clears them', `${still} still complaining`);

  // The sweep is bounded, which is the claim that keeps it affordable.
  const t0 = performance.now();
  for (let i = 0; i < 100; i++) sim.complaints.survey();
  const us = ((performance.now() - t0) / 100) * 1000;
  ok(us < 900, 'a sweep is bounded', `${us.toFixed(0)} us a visit`);
  console.log(`  ${sim.places.count} buildings, ${us.toFixed(0)} us a visit,`
    + ` ${(sim.complaints.bytes() / 1024).toFixed(1)} KiB`);
}

// ---- and whether the player sees it ----------------------------------------

const bundle = (await esbuild.build({
  entryPoints: [new URL('../src/headless.ts', import.meta.url).pathname],
  bundle: true, format: 'iife', globalName: 'HEADLESS', write: false,
  target: 'es2022', loader: { '.wgsl': 'text' },
})).outputFiles[0].text;

const server = http.createServer((req, res) => {
  if (req.url.startsWith('/headless.js')) {
    res.writeHead(200, { 'content-type': 'text/javascript' }).end(bundle);
  } else {
    res.writeHead(200, { 'content-type': 'text/html' })
      .end('<!doctype html><meta charset=utf-8><body><script src="/headless.js"></script>');
  }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-angle=vulkan',
         '--use-vulkan=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox',
         '--disable-gpu-sandbox'],
});
const page = await browser.newPage();
const logs = [];
page.on('console', (m) => logs.push(`${m.type()}: ${m.text()}`));
page.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));
await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load' });

const r = await page.evaluate(async () => {
  try {
    return await HEADLESS.probeThoughts(640, 360);
  } catch (err) {
    return { error: String(err && err.stack ? err.stack : err) };
  }
});
await browser.close();
server.close();

section('and whether the player sees it');
if (r.error) {
  ok(false, 'the probe ran', r.error);
  for (const l of logs.slice(0, 8)) console.log(`  ${l}`);
} else {
  ok(r.complaints > 0, 'the city has something to say', `${r.complaints} complaints`);
  ok(r.shown > 0, 'bubbles are on screen', `${r.shown} shown`);
  ok(r.shown <= 12, 'and never more than a dozen', `${r.shown}`);
  ok(r.inside === r.shown, 'all of them inside the viewport',
    `${r.shown - r.inside} outside`);
  ok(r.distinct.every((t) => t.length > 0), 'each carries a legible title',
    r.distinct.join(', '));
  ok(r.cardOpen, 'clicking one opens its card');
  ok(r.cardFix, 'which says what is wrong and what to do about it');
  ok(r.closed, 'and clicking again puts it away');
  const first = Object.keys(r.tally), second = Object.keys(r.next);
  ok(second.length > 0 && second.every((t) => !first.includes(t)),
    'with the mains and the coverage sorted it says something else entirely',
    `${first.join(', ')}  ->  ${second.join(', ')}`);
  ok(r.nextShown > 0, 'and still draws it', `${r.nextShown}`);
  console.log(`  ${r.complaints} complaining, ${r.shown} drawn, ${r.behind} behind the camera`);
  console.log(`  on screen: ${r.distinct.join(', ')}`);
  const rows = Object.entries(r.tally).sort((a, b) => b[1] - a[1]);
  for (const [k, v] of rows) console.log(`  ${k.padEnd(22)} ${v}`);
  console.log(`  with the mains and the coverage sorted, ${r.nextShown} drawn: ${r.nextDistinct.join(', ')}`);
  for (const [k, v] of Object.entries(r.next).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.padEnd(22)} ${v}`);
  }
}

console.log(`\n${checks - failed}/${checks} checks`);
process.exit(failed === 0 ? 0 : 1);
