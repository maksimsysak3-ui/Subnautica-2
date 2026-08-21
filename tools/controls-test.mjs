#!/usr/bin/env node
/**
 * Control regression test.
 *
 * These are the failures that actually reached the player, so they get a test
 * rather than a screenshot:
 *   - a click that does not capture the cursor AND does not fall back to drag,
 *     leaving a view that cannot be turned at all
 *   - a pointer-lock failure that latches, so every later click is a no-op
 *   - aim bound only to a held right mouse button
 *   - no jump
 *
 * Runs against the built single-file bundle, because that is what is actually
 * published — a dev-server pass would not exercise the embedding at all.
 */
import { chromium } from 'playwright';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const html = await readFile(path.join(ROOT, 'dist/black-meridian.html'), 'utf8');
const tmp = path.join(os.tmpdir(), 'bm-controls.html');
await writeFile(tmp, html);

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium', headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
         '--disable-dev-shm-usage', '--no-sandbox', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => console.error('  [pageerror]', e.message));
await page.goto('file://' + tmp, { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction(() => window.__BM?.ready === true, { timeout: 180000 });

const results = [];
const check = (name, pass, detail) => {
  results.push({ name, pass, detail });
  console.log(`  ${pass ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`);
};

// --- 1. click takes control -------------------------------------------------
await page.mouse.click(640, 400);
await page.waitForTimeout(300);
const engaged = await page.evaluate(() => ({
  overlayHidden: document.getElementById('click-to-play')?.classList.contains('hidden') ?? false,
  locked: window.engine.get('input').isLocked,
  armed: window.engine.get('input').engaged,
}));
check('click dismisses the overlay', engaged.overlayHidden);
check('click engages control', engaged.armed, engaged.locked ? 'pointer lock' : 'drag fallback');

// --- 2. the view can be turned, whichever mode is live ----------------------
const turn = async (label) => {
  const before = await page.evaluate(() => window.engine.get('player').yaw);
  if (await page.evaluate(() => window.engine.get('input').isLocked)) {
    await page.mouse.move(640, 400);
    await page.mouse.move(820, 400);
  } else {
    await page.mouse.move(640, 400);
    await page.mouse.down();
    await page.mouse.move(820, 400, { steps: 6 });
    await page.mouse.up();
  }
  await page.evaluate(() => window.__BM.settle(200));
  const after = await page.evaluate(() => window.engine.get('player').yaw);
  check(label, Math.abs(after - before) > 0.02, `yaw ${before.toFixed(3)} → ${after.toFixed(3)}`);
};
await turn('view turns after the first click');

// A second click must not be swallowed — the latching bug made every click
// after the first a no-op.
//
// Settle AFTER the click and before measuring: Playwright's click implicitly
// moves the virtual cursor back from wherever the last turn left it, and under
// pointer lock that move is itself a look delta. Left unflushed it exactly
// cancels the turn that follows and the test fails on its own artefact.
await page.mouse.click(640, 400);
await page.evaluate(() => window.__BM.settle(200));
await turn('view still turns after a second click');

// --- 3. aim on E ------------------------------------------------------------
const adsBefore = await page.evaluate(() => window.engine.get('player').adsProgress);
await page.keyboard.down('KeyE');
await page.evaluate(() => window.__BM.settle(500));
const adsHeld = await page.evaluate(() => window.engine.get('player').adsProgress);
await page.keyboard.up('KeyE');
await page.evaluate(() => window.__BM.settle(600));
const adsReleased = await page.evaluate(() => window.engine.get('player').adsProgress);
check('E aims down sights', adsHeld > 0.85, `${adsBefore.toFixed(2)} → ${adsHeld.toFixed(2)}`);
check('releasing E lowers the weapon', adsReleased < 0.15, `→ ${adsReleased.toFixed(2)}`);

// --- 4. jump ----------------------------------------------------------------
// Sample the whole arc rather than one arbitrary instant: apex is at v/g,
// about 480 ms in, and a fixed early sample under-reports the jump by half.
const y0 = await page.evaluate(() => window.engine.get('player').position.y);
await page.keyboard.press('Space');
let yPeak = y0;
for (let i = 0; i < 12; i++) {
  await page.evaluate(() => window.__BM.settle(70));
  yPeak = Math.max(yPeak, await page.evaluate(() => window.engine.get('player').position.y));
}
await page.evaluate(() => window.__BM.settle(1200));
const yLand = await page.evaluate(() => window.engine.get('player').position.y);
check('Space jumps clear of a waist-high wall', yPeak - y0 > 0.9, `apex +${(yPeak - y0).toFixed(3)} m`);
check('lands again', Math.abs(yLand - y0) < 0.08, `${(yLand - y0).toFixed(3)} m from start`);

// --- 5. crouch toggle -------------------------------------------------------
await page.keyboard.press('KeyC');
await page.evaluate(() => window.__BM.settle(600));
const crouched = await page.evaluate(() => window.engine.get('player').stance);
await page.keyboard.press('KeyC');
await page.evaluate(() => window.__BM.settle(600));
const stood = await page.evaluate(() => window.engine.get('player').stance);
check('C crouches', crouched === 'crouch', crouched);
check('C stands back up', stood === 'stand', stood);

await browser.close();
const failed = results.filter((r) => !r.pass);
console.log(`\n[controls] ${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
