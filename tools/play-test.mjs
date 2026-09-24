/**
 * The game, played.
 *
 * Every other test here drives the simulation or the renderer directly. This
 * one loads the built page in a browser, presses the button a player presses,
 * drags the zone brush across the ground with real pointer events, and then
 * asks whether buildings came up -- which is the one question every other test
 * answers only in pieces.
 *
 *   node tools/play-test.mjs
 */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import * as esbuild from 'esbuild';

const W = 820, H = 520;
const bundle = (await esbuild.build({
  entryPoints: [new URL('../src/main.ts', import.meta.url).pathname],
  bundle: true, format: 'iife', write: false, target: 'es2022',
  loader: { '.wgsl': 'text' },
})).outputFiles[0].text;
const page0 = fs.readFileSync(new URL('../index.html', import.meta.url).pathname, 'utf8')
  .replace(/<script type="module"[^>]*><\/script>/, '<script src="/main.js"></script>')
  .replace(/<script type="module" src="[^"]*"><\/script>/, '<script src="/main.js"></script>');

const server = http.createServer((req, res) => {
  if (req.url.startsWith('/main.js')) {
    res.writeHead(200, { 'content-type': 'text/javascript' }).end(bundle);
  } else {
    res.writeHead(200, { 'content-type': 'text/html' }).end(page0);
  }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--enable-unsafe-webgpu', '--max-old-space-size=3072',
    '--disable-dev-shm-usage', '--js-flags=--max-old-space-size=3072', '--enable-features=Vulkan', '--use-angle=vulkan',
    '--use-vulkan=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox',
    '--disable-gpu-sandbox'],
});
const page = await browser.newPage({ viewport: { width: W, height: H } });
// The software renderer crashes presenting to a real canvas; see the file.
await page.addInitScript({ path: new URL('./offscreen-canvas.js', import.meta.url).pathname });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e.message)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(`http://127.0.0.1:${port}/?lite`, { waitUntil: 'load' });

const ok = [];
const bad = [];
const note = (good, what, detail = '') => {
  (good ? ok : bad).push(`${what}${detail ? ' — ' + detail : ''}`);
};

// The menu, and the button a player presses.
await page.waitForFunction(() => document.querySelector('button') !== null, { timeout: 120000 });
await page.waitForTimeout(2500);
const pressed = await page.evaluate(() => {
  const b = Array.from(document.querySelectorAll('button'))
    .find((el) => (el.textContent ?? '').includes('New city'));
  if (b === undefined) return false;
  b.click();
  return true;
});
note(pressed, 'the menu offers a new city');
// Founding: a name and a difficulty, on their own screen.
await page.waitForTimeout(800);
const founded = await page.evaluate(() => {
  const field = document.querySelector('#mr-city-name');
  const hard = document.querySelector('[data-difficulty="relaxed"]');
  const go = document.querySelector('.mr-found');
  if (!field || !hard || !go) return false;
  field.value = 'Playtest Vale';
  hard.click();
  go.click();
  return true;
});
note(founded, 'the setup screen names the city and picks a difficulty');
await page.waitForTimeout(14000);

const started = await page.evaluate(() => (window.citysim !== undefined));
note(started, 'the game starts');
if (!started) {
  console.log(bad.join('\n'), errors.slice(0, 5).join('\n'));
  await browser.close(); server.close(); process.exit(1);
}

// Look straight down at the road the game starts with, so a screen point maps
// to a cell without depending on the terrain.
const aim = await page.evaluate(() => {
  const { renderer, camera } = window.citysim;
  const w = renderer.world, g = w.grid, half = g / 2;
  // The road nearest the middle, which is on land the city owns -- the first
  // one from the edge is the motorway coming in, where zoning is refused.
  let found = null, bestD = Infinity;
  for (let z = 10; z < g - 10; z++) {
    for (let x = 10; x < g - 10; x++) {
      if (!w.net.has(x, z)) continue;
      const d = (x - half) ** 2 + (z - half) ** 2;
      if (d < bestD) { bestD = d; found = [x, z]; }
    }
  }
  if (found === null) return null;
  const wx = (found[0] - half) * 8 + 4, wz = (found[1] - half) * 8 + 4;
  camera.focus[0] = wx; camera.focus[2] = wz;
  camera.pitch = 1.35; camera.distance = 190; camera.yaw = 0;
  camera.update();
  return { cell: found, world: [wx, wz] };
});
note(aim !== null, 'the starting world has a road in it');
await page.waitForTimeout(1200);

// Pick the zone tool the way a player does: the zones button, then a tile.
const picked = await page.evaluate(() => {
  const named = (el) => el.getAttribute('aria-label') ?? el.title ?? '';
  const zones = Array.from(document.querySelectorAll('button'))
    .find((el) => named(el).startsWith('Zoning'));
  if (zones === undefined) return 'no zoning button';
  zones.click();
  // The drawer's first zone tile: low-density residential, any style.
  const drawer = Array.from(document.querySelectorAll('[data-branch="zones"]'))
    .find((el) => el.tagName !== 'BUTTON');
  const tile = drawer === undefined ? undefined : Array.from(drawer.querySelectorAll('button'))
    .find((el) => (el.textContent ?? '').startsWith('Whichever'));
  if (tile === undefined) return 'no tile in the drawer';
  tile.click();
  return window.citysim.tools.active ? 'ok' : 'tool not active';
});
note(picked === 'ok', 'the zone tool can be picked', picked);

// And drag it across the ground beside the road.
const before = await page.evaluate(() => {
  const w = window.citysim.renderer.world;
  let zoned = 0;
  for (let i = 0; i < w.zones.length; i++) if (w.zones[i] !== 0) zoned++;
  return { zoned, money: w.budget.balance };
});
const box = { x: W / 2, y: H / 2 };
const under = await page.evaluate(([x, y]) => {
  const el = document.elementFromPoint(x, y);
  return el === null ? 'nothing' : `${el.tagName}.${el.className}#${el.id} ${el.dataset?.panel ?? ''}`;
}, [box.x - 30, box.y - 20]);
console.log(`  under the brush: ${under}`);
// A stroke a player would make: a few seconds' worth of houses along the road.
await page.mouse.move(box.x - 200, box.y - 120);
await page.mouse.down();
for (let i = 1; i <= 24; i++) {
  await page.mouse.move(box.x - 200 + i * 16, box.y - 120 + i * 10);
  await page.waitForTimeout(16);
}
await page.mouse.up();
await page.waitForTimeout(1200);

const after = await page.evaluate(() => {
  const w = window.citysim.renderer.world;
  let zoned = 0;
  for (let i = 0; i < w.zones.length; i++) if (w.zones[i] !== 0) zoned++;
  return { zoned, money: w.budget.balance, status: document.body.innerText.slice(0, 400) };
});
const said = await page.evaluate(() => Array.from(document.querySelectorAll('div'))
  .filter((d) => /zone|drag|land|afford|road/i.test(d.textContent ?? '') && d.children.length === 0)
  .map((d) => d.textContent).slice(0, 6));
console.log('  status:', JSON.stringify(said));
note(after.zoned > before.zoned, 'dragging the brush zones ground',
  `${before.zoned} -> ${after.zoned}`);

// Then time passes, and the ground is supposed to fill.
await page.waitForTimeout(25000);
const grew = await page.evaluate(() => {
  const { renderer, live } = window.citysim;
  const w = renderer.world;
  let zoned = 0, released = 0;
  for (let i = 0; i < w.zones.length; i++) {
    if (w.zones[i] === 0) continue;
    zoned++;
    if (w.grown[i] !== 0) released++;
  }
  const sim = live.sim ?? null;
  return {
    zoned, released,
    homes: sim?.places.homeCapacity ?? -1,
    population: sim?.people.population ?? -1,
    want: sim === null ? '' : [...sim.demand.want].map((v) => v.toFixed(2)).join(','),
    owed: sim?.growth?.report.owed ?? -1,
    buildings: renderer.summary.buildings,
  };
});
note(grew.released > 0, 'the city releases the land it was given',
  `${grew.released} of ${grew.zoned} cells`);
note(grew.homes > 0, 'and buildings come up on it', `${grew.homes} homes`);

console.log(`\nzoned     ${before.zoned} -> ${after.zoned} cells`);
console.log(`released  ${grew.released} of ${grew.zoned}`);
console.log(`homes     ${grew.homes}, population ${grew.population}`);
console.log(`demand    ${grew.want}, owed ${Number(grew.owed).toFixed(1)}`);
if (errors.length > 0) console.log(`\nconsole errors:\n  ${errors.slice(0, 6).join('\n  ')}`);
for (const line of ok) console.log(`PASS  ${line}`);
for (const line of bad) console.log(`FAIL  ${line}`);
await browser.close();
server.close();
process.exit(bad.length === 0 && errors.length === 0 ? 0 : 1);
