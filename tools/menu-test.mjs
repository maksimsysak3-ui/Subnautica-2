#!/usr/bin/env node
/**
 * Menu regression test.
 *
 * The menu is the only part of the game that can silently do nothing: a button
 * that renders and is wired to a hook that was never assigned looks perfect in
 * a screenshot. So every one of these assertions reads state back out of the
 * running engine rather than off the DOM.
 */
import { chromium } from 'playwright';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const html = await readFile(path.join(ROOT, 'dist/black-meridian.html'), 'utf8');
const tmp = path.join(os.tmpdir(), 'bm-menu.html');
await writeFile(tmp, html);

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium', headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
         '--disable-dev-shm-usage', '--no-sandbox', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 800 } });
page.on('pageerror', (e) => console.error('  [pageerror]', e.message));
await page.goto('file://' + tmp, { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction(() => window.__BM?.ready === true, { timeout: 180000 });

const results = [];
const check = (name, pass, detail) => {
  results.push({ name, pass, detail });
  console.log(`  ${pass ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`);
};

const evalPage = (fn, arg) => page.evaluate(fn, arg);

console.log('\n— opening —');
await page.evaluate(() => document.getElementById('open-menu').click());
await page.waitForTimeout(400);

let s = await evalPage(() => ({
  visible: document.getElementById('menu')?.classList.contains('on') ?? false,
  paused: window.engine.get('menu') ? window.engine.ctx?.paused : null,
  panes: Array.from(document.querySelectorAll('#menu nav button')).map((b) => b.dataset.screen),
  deployPaneOn: document.querySelector('#menu [data-pane="deploy"]')?.classList.contains('on') ?? false,
  missionsListed: document.querySelectorAll('#menu [data-pick="mission"]').length,
  sitesListed: document.querySelectorAll('#menu [data-pick="site"]').length,
  briefingChars: (document.querySelector('#menu [data-pane="deploy"] .detail p')?.textContent ?? '').length,
  overlayHidden: document.getElementById('click-to-play')?.classList.contains('hidden') ?? false,
}));
check('menu opens', s.visible);
check('opens on the deploy screen', s.deployPaneOn);
check('four screens available', s.panes.length === 4, s.panes.join(','));
check('both sites listed', s.sitesListed === 2, `${s.sitesListed}`);
check('tasking listed for the site', s.missionsListed >= 2, `${s.missionsListed} missions`);
check('briefing has real text', s.briefingChars > 120, `${s.briefingChars} chars`);
check('click-to-play stands down', s.overlayHidden);

console.log('\n— loadout —');
await page.evaluate(() => document.querySelector('#menu nav [data-screen="loadout"]').click());
await page.waitForTimeout(200);
s = await evalPage(() => ({
  slots: document.querySelectorAll('#menu [data-pick="slot"]').length,
  choices: document.querySelectorAll('#menu [data-pick="weapon"]').length,
  skins: document.querySelectorAll('#menu [data-pick="skin"]').length,
  statRows: document.querySelectorAll('#menu .stat dt').length,
}));
check('four loadout slots', s.slots === 4, `${s.slots}`);
check('weapon choices offered', s.choices >= 5, `${s.choices}`);
check('skins offered', s.skins >= 6, `${s.skins}`);
check('weapon stats shown', s.statRows >= 6, `${s.statRows} rows`);

// Swap the primary and confirm the *engine* changed, not just the DOM.
const before = await evalPage(() => window.engine.get('weaponRuntime').loadout[0].specId);
await page.evaluate(() => {
  const btns = Array.from(document.querySelectorAll('#menu [data-pick="weapon"]'));
  const other = btns.find((b) => !b.classList.contains('on'));
  other.click();
});
await page.waitForTimeout(300);
const after = await evalPage(() => ({
  specId: window.engine.get('weaponRuntime').loadout[0].specId,
  equipped: window.engine.get('weaponRuntime').equipped?.specId,
  reserve: window.engine.get('weaponRuntime').reserve.get(
    window.engine.get('weaponRuntime').loadout[0].ammoId),
}));
check('changing the weapon changes the loadout', after.specId !== before, `${before} → ${after.specId}`);
check('the new weapon is actually in hand', after.equipped === after.specId, `${after.equipped}`);
check('reserve ammunition provided', (after.reserve ?? 0) > 0, `${after.reserve}`);

// Skin: engine field AND a viewmodel rebuild.
const vmBefore = await evalPage(() => window.engine.get('viewmodel').currentKey ?? null);
await page.evaluate(() => {
  const btns = Array.from(document.querySelectorAll('#menu [data-pick="skin"]'));
  btns.find((b) => !b.classList.contains('on')).click();
});
await page.waitForTimeout(500);
const skinState = await evalPage(() => ({
  skinId: window.engine.get('weaponRuntime').loadout[0].skinId ?? null,
  key: window.engine.get('viewmodel').currentKey ?? null,
  tris: window.engine.get('viewmodel').model?.triangles ?? 0,
}));
check('skin recorded on the weapon', !!skinState.skinId && skinState.skinId !== 'issue', `${skinState.skinId}`);
check('viewmodel rebuilt for the new finish', skinState.key !== vmBefore && skinState.tris > 200,
  `${skinState.tris} tris`);

console.log('\n— settings —');
await page.evaluate(() => document.querySelector('#menu nav [data-screen="settings"]').click());
await page.waitForTimeout(200);
await page.evaluate(() => {
  const el = document.querySelector('#menu [data-setting="fov"]');
  el.value = '66';
  el.dispatchEvent(new Event('input', { bubbles: true }));
  const sn = document.querySelector('#menu [data-setting="sensitivity"]');
  sn.value = '30';
  sn.dispatchEvent(new Event('input', { bubbles: true }));
  const iv = document.querySelector('#menu [data-setting="invert"]');
  iv.checked = true;
  iv.dispatchEvent(new Event('input', { bubbles: true }));
});
await page.waitForTimeout(200);
s = await evalPage(() => ({
  fov: window.engine.get('render').baseFov,
  sens: window.engine.get('input').sensitivity,
  invert: window.engine.get('input').invertY,
}));
check('FOV slider reaches the camera', Math.abs(s.fov - 66) < 0.01, `${s.fov}`);
check('sensitivity slider reaches input', Math.abs(s.sens - 0.030) < 1e-6, `${s.sens}`);
check('invert reaches input', s.invert === true);

console.log('\n— controls —');
await page.evaluate(() => document.querySelector('#menu nav [data-screen="controls"]').click());
await page.waitForTimeout(200);
s = await evalPage(() => document.querySelectorAll('#menu .keys kbd').length);
check('controls documented', s >= 15, `${s} bindings`);

console.log('\n— deploy —');
await page.evaluate(() => document.querySelector('#menu nav [data-screen="deploy"]').click());
await page.waitForTimeout(200);
const target = await evalPage(() => {
  const cur = window.engine.get('world').mapId;
  const other = cur === 'villa' ? 'quay' : 'villa';
  document.querySelector(`#menu [data-pick="site"][data-value="${other}"]`).click();
  const t = document.querySelector('#menu [data-pick="mission"]');
  t.click();
  return { other, missionId: t.dataset.value };
});
await page.evaluate(() => document.querySelector('#menu [data-act="deploy"]').click());
await page.waitForTimeout(1800);
s = await evalPage(() => ({
  mapId: window.engine.get('world').mapId,
  menuOpen: document.getElementById('menu').classList.contains('on'),
  missionId: window.engine.get('missions').current?.id ?? null,
  codename: window.engine.get('missions').current?.codename ?? null,
  objectives: window.engine.get('missions').current?.objectives.length ?? 0,
  hostiles: Array.from(window.engine.get('actors').all).filter((a) => a.faction !== 'player').length,
  paused: window.engine.ctx?.paused ?? null,
}));
check('deploy switched the site', s.mapId === target.other, `${s.mapId}`);
check('deploy started the chosen tasking', (s.missionId ?? '').startsWith(target.missionId),
  `${s.missionId} (asked ${target.missionId})`);
check('the tasking has objectives', s.objectives >= 2, `${s.objectives}`);
check('the site is garrisoned', s.hostiles > 3, `${s.hostiles}`);
check('menu closed on deploy', !s.menuOpen);
check('the sim resumed', s.paused === false, `paused=${s.paused}`);

console.log('\n— escape reopens —');
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
s = await evalPage(() => ({
  open: document.getElementById('menu').classList.contains('on'),
  paused: window.engine.ctx?.paused ?? null,
}));
check('escape reopens the menu', s.open);
check('the sim pauses behind it', s.paused === true, `paused=${s.paused}`);

await page.keyboard.press('Escape');
await page.waitForTimeout(300);
s = await evalPage(() => ({
  open: document.getElementById('menu').classList.contains('on'),
  paused: window.engine.ctx?.paused ?? null,
}));
check('escape closes it again', !s.open);
check('and hands the sim back', s.paused === false, `paused=${s.paused}`);

await browser.close();
const passed = results.filter((r) => r.pass).length;
console.log(`\n${passed}/${results.length} passed\n`);
process.exit(passed === results.length ? 0 : 1);
