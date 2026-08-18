#!/usr/bin/env node
/**
 * Boot-checks the single-file bundle the way the publish target will serve it:
 * wrapped in a bare document skeleton, loaded from disk, no dev server.
 * Catches anything that only worked because Vite was resolving modules.
 */
import { chromium } from 'playwright';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const file = process.argv[2] ?? 'dist/black-meridian.html';
const content = await readFile(file, 'utf8');
const wrapped = `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"></head><body>
${content}
</body></html>`;
const tmp = path.resolve('dist/_verify.html');
await writeFile(tmp, wrapped, 'utf8');

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium', headless: true,
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));

await page.goto('file://' + tmp, { waitUntil: 'load', timeout: 120000 });
let ok = true;
try {
  await page.waitForFunction(() => window.__BM?.ready === true, { timeout: 120000 });
} catch { ok = false; }

// Interaction regression: pointer lock is refused in many embeddings, so the
// overlay must dismiss on click anyway and the view must still be steerable.
// This is the exact failure that shipped once — a click that did nothing.
let interaction = 'not run';
if (ok) {
  await page.mouse.click(640, 360);
  await page.waitForTimeout(250);
  const overlayHidden = await page.evaluate(() =>
    document.getElementById('click-to-play')?.classList.contains('hidden') ?? false);

  // Drive the simulation deterministically rather than waiting on wall clock:
  // this harness renders through SwiftShader at ~2fps, so a timed key-hold
  // produces almost no frames and the fixed step never runs. settle() steps
  // the engine directly, which is what it exists for.
  const yawBefore = await page.evaluate(() => window.engine.get('player').yaw);
  const locked = await page.evaluate(() => window.engine.get('input')?.isLocked ?? false);

  // Check whichever control is actually live. Arrow-key look is deliberately
  // suppressed while the pointer is locked so the two can't fight, so testing
  // it unconditionally would fail on exactly the configuration we want.
  if (locked) {
    await page.mouse.move(640, 360);
    await page.mouse.move(760, 360);
  } else {
    await page.keyboard.down('ArrowRight');
  }
  await page.evaluate(() => window.__BM.settle(400));
  if (!locked) await page.keyboard.up('ArrowRight');

  const yawAfter = await page.evaluate(() => window.engine.get('player').yaw);
  const turned = Math.abs(yawAfter - yawBefore) > 0.01;

  interaction = `overlay dismissed: ${overlayHidden}, look (${locked ? 'pointer lock' : 'keyboard'}): ${turned}`;
  if (!overlayHidden || !turned) ok = false;
}
console.log('[verify] interaction — ' + interaction);

await page.screenshot({ path: 'dist/_verify.png' });
console.log(ok ? '[verify] ✓ bundle boots standalone' : '[verify] ✗ bundle did NOT reach ready');
if (errors.length) { console.log('[verify] console errors:'); errors.forEach(e => console.log('   ' + e)); }
await browser.close();
process.exit(ok && errors.length === 0 ? 0 : 1);
