#!/usr/bin/env node
/**
 * Visual proof that an in-place map switch leaves nothing behind.
 *
 * The map-switch test asserts on state — brick counts, garrison size, actor 0.
 * State cannot tell you that the old level's meshes were actually removed from
 * the scene, and a ghost building floating over the new map would pass every
 * one of those assertions.
 */
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = path.resolve(ROOT, 'docs/shots/switch');
await mkdir(OUT, { recursive: true });

const server = await createServer({ root: ROOT, configFile: path.join(ROOT, 'vite.config.ts'),
  server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const url = `http://127.0.0.1:${server.httpServer.address().port}/`;
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium', headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
         '--disable-dev-shm-usage', '--no-sandbox', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => console.error('  [pageerror]', e.message));
await page.goto(url, { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction(() => window.__BM?.ready === true, { timeout: 180000 });

const shoot = async (name, label) => {
  await page.evaluate(() => window.__BM.settle(500));
  await page.waitForTimeout(120);
  await page.screenshot({ path: path.join(OUT, `${name}.png`), timeout: 180000, animations: 'disabled' });
  const s = await page.evaluate(() => {
    const w = window.services.get('world');
    // Count what is actually in the scene, not what the builder thinks it made.
    let meshes = 0, tris = 0;
    w.root.traverse((o) => {
      if (!o.isMesh) return;
      meshes++;
      const g = o.geometry;
      const n = g.index ? g.index.count / 3 : g.attributes.position.count / 3;
      tris += n * (o.isInstancedMesh ? o.count : 1);
    });
    return { map: w.mapId, site: w.site.name, meshes, tris: Math.round(tris) };
  });
  console.log(`  ✓ ${name} — ${label}: ${s.site}, ${s.meshes} meshes, ${(s.tris / 1000).toFixed(1)}k tris in scene`);
  return s;
};

// Park the camera somewhere both maps have ground, looking at the horizon, so
// a leftover building from the other level would be unmissable.
const look = () => page.evaluate(() => {
  const p = window.engine.get('player');
  p.setControlsEnabled(false);
  const cam = window.services.get('render').camera;
  cam.position.set(0, 14, 120);
  cam.lookAt(0, 4, 0);
  cam.updateMatrixWorld(true);
});

await look();
const a = await shoot('1-villa', 'start');
await page.evaluate(() => document.querySelector('.mapbtn[data-map="quay"]').click());
await page.waitForFunction(() => window.services.get('world').mapId === 'quay', { timeout: 60000 });
await look();
const b = await shoot('2-quay', 'after switching');
await page.evaluate(() => document.querySelector('.mapbtn[data-map="villa"]').click());
await page.waitForFunction(() => window.services.get('world').mapId === 'villa', { timeout: 60000 });
await look();
const c = await shoot('3-villa-again', 'switched back');

const ok = Math.abs(c.tris - a.tris) < 200 && Math.abs(c.meshes - a.meshes) <= 2;
console.log(ok
  ? `\n[switch] ✓ scene returns to its original size — no accumulation (${a.meshes}/${a.tris} → ${c.meshes}/${c.tris})`
  : `\n[switch] ✗ SCENE GREW: ${a.meshes} meshes/${a.tris} tris → ${c.meshes}/${c.tris}`);

await browser.close();
await server.close();
process.exit(ok ? 0 : 1);
