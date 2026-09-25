/**
 * The information views, end to end, in a browser.
 *
 * The simulation's own tests already prove the numbers. What this proves is the
 * part between the numbers and the player, which is where the failures are silent:
 *
 *   - the rail opens and has one icon per view, with the right names on them;
 *   - clicking one fills the card with rows and bars;
 *   - and the map actually changes, which is the claim that matters. A bind group
 *     written to the wrong index, a uniform in a buffer nothing samples, a texture
 *     bound to a pipeline that never reads it: WebGPU accepts all three without
 *     complaint and the frame comes out identical. So the test is the pixels.
 *
 * Rendered to a texture rather than a canvas, for the same reason every other
 * tool here is: the software rasteriser takes canvas presentation down within a
 * second of boot.
 *
 *   node tools/views-test.mjs
 */

import { chromium } from 'playwright';
import http from 'node:http';
import * as esbuild from 'esbuild';

const bundle = (await esbuild.build({
  entryPoints: [new URL('../src/headless.ts', import.meta.url).pathname],
  bundle: true, format: 'iife', globalName: 'HEADLESS', write: false,
  target: 'es2022', loader: { '.wgsl': 'text' },
})).outputFiles[0].text;

const server = http.createServer((req, res) => {
  if (req.url.startsWith('/headless.js')) {
    res.writeHead(200, { 'content-type': 'text/javascript' }).end(bundle);
  } else {
    // Loopback, because WebGPU is only exposed in a secure context.
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
    return await HEADLESS.probeViews();
  } catch (err) {
    return { error: String(err && err.stack ? err.stack : err) };
  }
});

const fails = [];
const push = (m) => fails.push(m);

if (r.error) {
  console.error('FAIL  the probe threw\n' + r.error);
  console.error('\n' + logs.slice(-20).join('\n'));
  await browser.close();
  server.close();
  process.exit(1);
}

const EXPECTED = ['Traffic', 'Power', 'Water', 'Sewage', 'Rubbish', 'Fire',
  'Police', 'Health', 'Schools', 'Parks', 'Transport', 'Desirability',
  'Land value', 'Pollution', 'Resources', 'Districts', 'Budget'];

if (!r.railHidden) push('the rail was already open before anything was clicked');
if (!r.railShown) push('clicking the launcher did not open the rail');
if (r.icons !== EXPECTED.length) {
  push(`the rail has ${r.icons} icons where it should have ${EXPECTED.length}`);
}
for (const name of EXPECTED) {
  if (!r.views.includes(name)) push(`no button for the ${name} view`);
}
if (r.budgetRows < 8) push(`the budget panel has ${r.budgetRows} rows`);
if (r.taxSliders !== 4) push(`the budget has ${r.taxSliders} tax sliders, not four`);
if (!r.rateMoved) push('dragging a tax slider did not change the rate');
if (r.budgetPainted > 0.01) {
  push(`opening the budget painted ${(r.budgetPainted * 100).toFixed(1)}% of the map`);
}

console.log(`rail     ${r.icons} icons: ${r.views.join(', ')}`);
console.log(`budget   ${r.budgetRows} rows, ${r.taxSliders} sliders, `
  + `rate ${r.rateMoved ? 'moves' : 'STUCK'}, `
  + `map untouched (${(r.budgetPainted * 100).toFixed(2)}%)`);

if (r.title !== 'Traffic') push(`the card is headed "${r.title}", not "Traffic"`);
if (r.rows < 8) push(`the traffic card has ${r.rows} rows, which is not a panel of statistics`);
if (r.bars < 3) push(`${r.bars} of those rows drew a bar; the view defines more than that`);
console.log(`card     "${r.title}", ${r.rows} rows, ${r.bars} with bars`);

// The heatmap. A surface view keeps the shading and takes the hue, so the frame
// should move over most of the ground without collapsing to one flat colour --
// and the ground is the larger part of this shot.
if (r.trafficMoved < 0.20) {
  push(`opening the traffic view changed ${(r.trafficMoved * 100).toFixed(1)}% of the `
    + 'frame; the overlay is not reaching the shader');
}
// Underground buries the world, so it must be darker as well as different. This
// is the assertion that would have caught the ramp being applied only where there
// was a reading, which left the unserved half of the map at full brightness.
if (r.buriedMoved < 0.35) {
  push(`the underground view changed ${(r.buriedMoved * 100).toFixed(1)}% of the frame; `
    + 'it should bury all of it');
}
if (r.buried >= r.plain * 0.75) {
  push(`the underground view is at ${r.buried.toFixed(1)} against ${r.plain.toFixed(1)} `
    + 'plain; burying the world should visibly darken it');
}
console.log(`pixels   plain ${r.plain.toFixed(1)}  traffic ${r.traffic.toFixed(1)} `
  + `(${(r.trafficMoved * 100).toFixed(0)}% moved)  underground ${r.buried.toFixed(1)} `
  + `(${(r.buriedMoved * 100).toFixed(0)}% moved)`);

if (!r.closed) push('closing the view left the statistics card up');
if (r.closedBack > 0.02) {
  push(`closing the view left ${(r.closedBack * 100).toFixed(1)}% of the frame tinted`);
}
console.log(`close    card down, ${(r.closedBack * 100).toFixed(2)}% of the frame still tinted`);

if (r.population <= 0) push('the simulation is not running: nobody lives in the city');
console.log(`sim      ${r.population.toLocaleString()} citizens after three simulated seconds`);

if (fails.length) {
  console.error('\nFAIL\n' + fails.map((f) => '  - ' + f).join('\n'));
  console.error('\n' + logs.slice(-15).join('\n'));
  process.exitCode = 1;
} else {
  console.log('\nPASS  the views open, fill, tint the map, and put it back');
}

await browser.close();
server.close();
