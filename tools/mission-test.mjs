#!/usr/bin/env node
/**
 * Mission loop test.
 *
 * A mission system that compiles is not a mission. This drives a real mission
 * to completion and to failure, and asserts on what the player would actually
 * see: a briefing, a task list that ticks, gated extraction, and a debrief
 * that says why.
 */
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : d; };
const MAP = arg('map', 'villa');

const server = await createServer({ root: ROOT, configFile: path.join(ROOT, 'vite.config.ts'),
  server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const url = `http://127.0.0.1:${server.httpServer.address().port}/?map=${MAP}`;
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium', headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
         '--disable-dev-shm-usage', '--no-sandbox', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 900, height: 500 } });
page.on('pageerror', (e) => console.error('  [pageerror]', e.message));
await page.goto(url, { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction(() => window.__BM?.ready === true, { timeout: 180000 });

const results = [];
const check = (name, pass, detail) => {
  results.push({ pass });
  console.log(`  ${pass ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`);
};

const m = () => page.evaluate(() => {
  const s = window.services.get('missions');
  return {
    codename: s.current?.codename ?? null,
    briefing: (s.current?.briefing ?? '').length,
    objectives: s.objectives.map((o) => ({
      id: o.id, kind: o.kind, state: o.state, optional: o.optional,
      progress: o.progress, required: o.required,
      at: o.position ? [+o.position.x.toFixed(0), +o.position.z.toFixed(0)] : null,
    })),
    result: s.result,
    stats: { ...s.stats },
  };
});

// --- 1. a mission exists and is legible -------------------------------------
const a = await m();
check('a mission is running', !!a.codename, a.codename);
check('it has a briefing', a.briefing > 80, `${a.briefing} chars`);
check('objectives are defined', a.objectives.length >= 3, `${a.objectives.length} objectives`);
check('non-dependent objectives start active',
  a.objectives.some((o) => o.state === 'active'),
  a.objectives.map((o) => `${o.id}=${o.state}`).join(' '));
check('the exfil starts gated',
  a.objectives.find((o) => o.kind === 'extract')?.state === 'pending',
  String(a.objectives.find((o) => o.kind === 'extract')?.state));

// --- 2. the task list is rendered -------------------------------------------
const hud = await page.evaluate(() => ({
  codename: document.querySelector('#hud .tasks .codename')?.textContent ?? '',
  tasks: document.querySelectorAll('#hud .tasks .task').length,
  markers: [...document.querySelectorAll('#hud .markers b')]
    .filter((e) => e.style.display !== 'none').length,
}));
check('the HUD shows the codename', hud.codename.length > 3, hud.codename);
check('the HUD lists tasks', hud.tasks >= 2, `${hud.tasks} shown`);
check('objective markers render', hud.markers >= 1, `${hud.markers} markers`);

// --- 3. standing on a position objective completes it -----------------------
const posObj = a.objectives.find((o) => o.at && o.kind !== 'extract' && o.state === 'active');
if (posObj) {
  await page.evaluate((id) => {
    const s = window.services.get('missions');
    const o = s.objectives.find((x) => x.id === id);
    const p = window.engine.get('player');
    const w = window.services.get('world');
    const f = w.floorAt(o.position.x, o.position.z, o.position.y + 5);
    p.position.set(o.position.x, f + p.eyeHeight, o.position.z);
    window.__BM.settle(400);
  }, posObj.id);
  const b = await m();
  const now = b.objectives.find((o) => o.id === posObj.id);
  check(`reaching "${posObj.id}" completes it`, now.state === 'complete', now.state);
} else {
  check('a position objective exists to test', false, 'none found');
}

// --- 4. extraction stays gated until the rest is done -----------------------
await page.evaluate(() => {
  const s = window.services.get('missions');
  const ex = s.objectives.find((o) => o.kind === 'extract');
  const p = window.engine.get('player');
  const w = window.services.get('world');
  const f = w.floorAt(ex.position.x, ex.position.z, ex.position.y + 6);
  p.position.set(ex.position.x, f + p.eyeHeight, ex.position.z);
  window.__BM.settle(500);
});
const c = await m();
check('standing on the exfil early does not end the mission', c.result === null,
  c.result ? c.result.outcome : 'still running');

// --- 5. complete everything, then extract -----------------------------------
await page.evaluate(() => {
  // Step OFF the exfil first. Left standing on it, the extract objective goes
  // straight from pending to complete the instant its dependencies clear —
  // which is correct behaviour and makes the "did it become active" assertion
  // below unobservable.
  const p = window.engine.get('player');
  p.position.x += 60;
  const s = window.services.get('missions');
  for (const o of s.objectives) {
    if (o.optional || o.kind === 'extract') continue;
    o.state = 'active';
    s.reportProgress(o.id, o.required);
  }
  window.__BM.settle(200);
});
const d = await m();
// Assert it left 'pending', not that it is specifically 'active'. If the
// player happens to be standing on the exfil when its dependencies clear it
// goes pending -> active -> complete inside one step, which is correct and
// makes 'active' unobservable. The gating itself is proven above, by the
// mission NOT ending when the player stood on the exfil early.
check('completing a task un-gates what depended on it',
  d.objectives.find((o) => o.kind === 'extract')?.state !== 'pending',
  String(d.objectives.find((o) => o.kind === 'extract')?.state));

// Now walk back onto it.
await page.evaluate(() => {
  const s = window.services.get('missions');
  const ex = s.objectives.find((o) => o.kind === 'extract');
  const p = window.engine.get('player');
  const w = window.services.get('world');
  p.position.set(ex.position.x, w.floorAt(ex.position.x, ex.position.z, ex.position.y + 6)
    + p.eyeHeight, ex.position.z);
  window.__BM.settle(600);
});
const e = await m();
check('extracting ends the mission', !!e.result, e.result?.outcome ?? 'still running');
check('the debrief explains why', (e.result?.reason ?? '').length > 20, e.result?.reason ?? '');

const shown = await page.evaluate(() => ({
  on: document.querySelector('#hud .debrief')?.classList.contains('on') ?? false,
  title: document.querySelector('#hud .debrief h2')?.textContent ?? '',
  rows: document.querySelectorAll('#hud .debrief dt').length,
}));
check('the debrief is displayed', shown.on, shown.title);
check('the debrief reports stats', shown.rows >= 8, `${shown.rows} rows`);

await browser.close();
await server.close();
const failed = results.filter((r) => !r.pass).length;
console.log(`\n[mission] ${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
