#!/usr/bin/env node
/**
 * Map picker test.
 *
 * The published build runs inside an iframe whose address bar the player
 * cannot reach, so `?map=` was never a control anyone could operate. This
 * checks the in-game picker end to end, against the built bundle.
 */
import { chromium } from 'playwright';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const tmp = path.join(os.tmpdir(), 'bm-mapswitch.html');
await writeFile(tmp, await readFile(path.join(ROOT, 'dist/black-meridian.html'), 'utf8'));

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium', headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
         '--disable-dev-shm-usage', '--no-sandbox', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => console.error('  [pageerror]', e.message));

const results = [];
const check = (name, pass, detail) => {
  results.push({ pass });
  console.log(`  ${pass ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`);
};

// Count loads. If the picker ever navigates, this climbs above 1 — and a
// navigation is precisely what fails inside an artifact iframe.
await page.addInitScript(() => {
  window.__NAVCOUNT = (Number(sessionStorage.getItem('nav')) || 0) + 1;
  try { sessionStorage.setItem('nav', String(window.__NAVCOUNT)); } catch { /* blocked */ }
});
await page.goto('file://' + tmp, { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction(() => window.__BM?.ready === true, { timeout: 180000 });

const first = await page.evaluate(() => ({
  map: window.services.get('world').mapId,
  site: window.services.get('world').site.name,
  buttons: Array.from(document.querySelectorAll('.mapbtn')).map((b) => b.dataset.map),
  marked: document.querySelector('.mapbtn.on')?.dataset.map,
  bricks: window.services.get('world').buildStats.bricks,
}));
check('picker is present', first.buttons.length === 2, first.buttons.join(', '));
check('default map is the villa', first.map === 'villa', first.site);
check('current map is marked', first.marked === 'villa', String(first.marked));

// Click the quay button. It rebuilds the level IN PLACE — no reload, because
// reloading an artifact iframe fails outright.
// Click in-page rather than through Playwright's actionability checks. Under
// SwiftShader the frame rate is ~10 fps and the overlay carries a CSS
// transition, so "visible, enabled and stable" times out on a button that is
// perfectly clickable.
await page.evaluate(() => document.querySelector('.mapbtn[data-map="quay"]').click());
await page.waitForFunction(
  () => window.services.get('world').mapId === 'quay', { timeout: 60000 });
await page.evaluate(() => window.__BM.settle(400));
const second = await page.evaluate(() => ({
  map: window.services.get('world').mapId,
  site: window.services.get('world').site.name,
  marked: document.querySelector('.mapbtn.on')?.dataset.map,
  hostiles: window.engine.get('actors').all.filter((a) => a.faction !== 'player').length,
  bricks: window.services.get('world').buildStats.bricks,
}));
check('picking the quay switches the map', second.map === 'quay', second.site);
check('the quay is marked after the switch', second.marked === 'quay', String(second.marked));
check('the quay has its own garrison', second.hostiles >= 10, `${second.hostiles} hostiles`);
check('the quay geometry actually built', second.bricks > 500, `${second.bricks} bricks`);

// And back again, so the picker is not one-way.
await page.evaluate(() => document.querySelector('.mapbtn[data-map="villa"]').click());
await page.waitForFunction(
  () => window.services.get('world').mapId === 'villa', { timeout: 60000 });
await page.evaluate(() => window.__BM.settle(400));
const third = await page.evaluate(() => ({
  name: window.services.get('world').site.name,
  hostiles: window.engine.get('actors').all.filter((a) => a.faction !== 'player').length,
  player: !!window.engine.get('actors').get(0),
  navOk: !!window.services.get('nav'),
}));
check('switching back works', third.name.includes('Verdugo'), third.name);
check('the villa garrison is back', third.hostiles >= 10, `${third.hostiles} hostiles`);
check('the player is still actor 0 after two switches', third.player);

// The page must never have navigated — a reload is what broke the artifact.
const navigated = await page.evaluate(() => window.__NAVCOUNT ?? 1);
check('no page reload occurred', navigated === 1, `${navigated} load(s)`);

// The same map must build identically every time, or it cannot be learned and
// no before/after capture compares the same building.
const rebuilt = await page.evaluate(() => window.services.get('world').buildStats.bricks);
check('the villa rebuilds identically', rebuilt === first.bricks,
  `${first.bricks} then ${rebuilt} bricks`);

await browser.close();
const failed = results.filter((r) => !r.pass).length;
console.log(`\n[map] ${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
