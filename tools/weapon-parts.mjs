#!/usr/bin/env node
/**
 * Weapon part census.
 *
 * Walks the assembled viewmodel and reports every mesh's local bounds, so a
 * part that is missing, floating detached, or intersecting another can be
 * found by arithmetic instead of by squinting at a render.
 */
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : d; };
const WEAPON = arg('weapon', 'ho-mk4c');
const ATT = JSON.parse(arg('att', '{"optic":"opt-rds","muzzle":"muz-a2","underbarrel":"grip-handstop","handguard":"hg-mlok-short"}'));

const server = await createServer({ root: ROOT, configFile: path.join(ROOT, 'vite.config.ts'),
  server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const url = `http://127.0.0.1:${server.httpServer.address().port}/`;
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium', headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
         '--disable-dev-shm-usage', '--no-sandbox', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
page.on('pageerror', (e) => console.error('  [pageerror]', e.message));
await page.goto(url, { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction(() => window.__BM && window.__BM.ready === true, { timeout: 180000 });
await page.evaluate(({ w, a }) => window.__BM.equipWeapon(w, a), { w: WEAPON, a: ATT });
await page.evaluate(() => window.__BM.settle(200));

const report = await page.evaluate(() => {
  const THREE = window.THREE__ ?? null;
  const vm = window.engine.get('viewmodel');
  const g = vm.model.group;
  g.updateMatrixWorld(true);
  const inv = g.matrixWorld.clone().invert();
  const rows = [];
  g.traverse((o) => {
    if (!o.isMesh) return;
    o.geometry.computeBoundingBox();
    const bb = o.geometry.boundingBox.clone();
    const m = o.matrixWorld.clone().premultiply(inv);
    bb.applyMatrix4(m);
    rows.push({
      mat: o.material.name || (o.material.color ? '#' + o.material.color.getHexString() : '?'),
      rough: o.material.roughness ?? null,
      metal: o.material.metalness ?? null,
      x: [+bb.min.x.toFixed(4), +bb.max.x.toFixed(4)],
      y: [+bb.min.y.toFixed(4), +bb.max.y.toFixed(4)],
      z: [+bb.min.z.toFixed(4), +bb.max.z.toFixed(4)],
    });
  });
  const all = { x: [9, -9], y: [9, -9], z: [9, -9] };
  for (const r of rows) for (const k of ['x', 'y', 'z']) {
    all[k][0] = Math.min(all[k][0], r[k][0]); all[k][1] = Math.max(all[k][1], r[k][1]);
  }
  return { count: rows.length, all, rows };
});

console.log(`[parts] ${report.count} meshes`);
console.log(`[parts] overall  x ${report.all.x}  y ${report.all.y}  z ${report.all.z}`);

// Group by material so the census is readable.
const byMat = new Map();
for (const r of report.rows) {
  const k = `${r.mat} r${r.rough} m${r.metal}`;
  if (!byMat.has(k)) byMat.set(k, { n: 0, x: [9, -9], y: [9, -9], z: [9, -9] });
  const e = byMat.get(k); e.n++;
  for (const a of ['x', 'y', 'z']) { e[a][0] = Math.min(e[a][0], r[a][0]); e[a][1] = Math.max(e[a][1], r[a][1]); }
}
console.log('\n[parts] by material (local metres, -Z forward):');
for (const [k, e] of [...byMat.entries()].sort((a, b) => b[1].n - a[1].n)) {
  const f = (a) => `[${a[0].toFixed(3)}, ${a[1].toFixed(3)}]`;
  console.log(`  ${String(e.n).padStart(3)}x  ${k.padEnd(34)}  x${f(e.x)} y${f(e.y)} z${f(e.z)}`);
}

// Vertical slices tell you where the mass actually is.
console.log('\n[parts] lowest 10 meshes (is the magazine there?):');
for (const r of [...report.rows].sort((a, b) => a.y[0] - b.y[0]).slice(0, 10)) {
  console.log(`  ${r.mat}  y[${r.y[0].toFixed(3)}, ${r.y[1].toFixed(3)}]  z[${r.z[0].toFixed(3)}, ${r.z[1].toFixed(3)}]  x[${r.x[0].toFixed(3)}, ${r.x[1].toFixed(3)}]`);
}

await browser.close();
await server.close();
