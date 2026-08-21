#!/usr/bin/env node
/**
 * Door census and open test.
 *
 * "The gate doesn't open" has several possible causes that look identical from
 * inside the game: the door was never registered, the interaction reach never
 * finds it, it is locked, or it animates but its leaf never moves out of the
 * doorway. This distinguishes them.
 */
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : d; };
const MAP = arg('map', 'quay');

const server = await createServer({ root: ROOT, configFile: path.join(ROOT, 'vite.config.ts'),
  server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const url = `http://127.0.0.1:${server.httpServer.address().port}/?map=${MAP}`;
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium', headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
         '--disable-dev-shm-usage', '--no-sandbox', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
page.on('pageerror', (e) => console.error('  [pageerror]', e.message));
await page.goto(url, { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction(() => window.__BM?.ready === true, { timeout: 180000 });

const census = await page.evaluate(() => {
  const w = window.services.get('world');
  return {
    map: w.mapId, site: w.site.name,
    spawn: (() => { const p = window.engine.get('player').position; return [+p.x.toFixed(1), +p.z.toFixed(1)]; })(),
    doors: w.doors.all.map((d) => ({
      id: d.id, name: d.name, x: +d.x.toFixed(1), y: +d.y.toFixed(1), z: +d.z.toFixed(1),
      w: +d.width?.toFixed(2), h: +d.height?.toFixed(2),
      locked: !!d.locked, state: d.state, open: +d.openAmount?.toFixed(2),
    })),
  };
});
console.log(`[doors] ${census.site} — ${census.doors.length} doors, player spawns at ${census.spawn}`);
for (const d of census.doors) {
  console.log(`  #${String(d.id).padStart(2)} ${d.name.padEnd(26)} (${d.x}, ${d.z}) y${d.y} ` +
    `${d.w}x${d.h}m ${d.locked ? 'LOCKED' : 'unlocked'} ${d.state}`);
}

// Two separate questions, tested separately, because walking the player to
// every door and settling each one takes minutes on a software renderer and
// tells you less.
//
//   1. REACHABLE — does the interaction query find this door from a sensible
//      standing position? That is pure maths, no simulation needed.
//   2. ANIMATES — does the leaf actually move when the door is told to open?
//      Every door can be told at once and settled together.
console.log('\n[doors] reachability:');
const reach = await page.evaluate(() => {
  const w = window.services.get('world');
  const out = [];
  for (const d of w.doors.all) {
    // Stand 1.3 m out on each side; a door only has to be reachable from one.
    let found = null;
    for (const sign of [1, -1]) {
      const eye = { x: d.x, y: d.y + 1.2, z: d.z + sign * 1.3 };
      // The player's interaction point: 0.9 m ahead, 0.5 m below the eye.
      const probe = { x: d.x, y: eye.y - 0.5, z: d.z + sign * 0.4 };
      const hit = w.doors.nearest(probe, 2.2);
      if (hit && hit.id === d.id) { found = sign; break; }
    }
    out.push({ id: d.id, name: d.name, found });
  }
  return out;
});
for (const r of reach) {
  if (r.found === null) console.log(`  ✗ #${String(r.id).padStart(2)} ${r.name} — NOT REACHABLE`);
}
console.log(`  ${reach.filter((r) => r.found !== null).length}/${reach.length} reachable`);

console.log('\n[doors] animation:');
const anim = await page.evaluate(() => {
  const w = window.services.get('world');
  const before = w.doors.all.map((d) => ({ id: d.id, name: d.name, locked: !!d.locked,
                                            open: d.openAmount }));
  for (const d of w.doors.all) if (!d.locked) w.doors.open(d.id);
  window.__BM.settle(700);
  return before.map((b) => {
    const d = w.doors.get(b.id);
    return { ...b, after: +d.openAmount.toFixed(2) };
  });
});
let stuck = 0;
for (const d of anim) {
  if (d.locked) continue;
  if (d.after < 0.9) { console.log(`  ✗ #${String(d.id).padStart(2)} ${d.name} — stuck at ${d.after}`); stuck++; }
}
const unlocked = anim.filter((d) => !d.locked).length;
console.log(`  ${unlocked - stuck}/${unlocked} unlocked doors open fully`);

await browser.close();
await server.close();
const bad = reach.filter((r) => r.found === null).length + stuck;
process.exit(bad ? 1 : 0);
