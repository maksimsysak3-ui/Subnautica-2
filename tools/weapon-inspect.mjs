#!/usr/bin/env node
/**
 * Weapon inspection rig.
 *
 * Judging a weapon model from a hip-carry frame is hopeless — it is 17% of the
 * screen, half in shadow, at an oblique angle. This poses the weapon large and
 * centred at several angles so model quality can actually be seen: silhouette,
 * proportion, where the hands sit, whether parts intersect.
 *
 * Usage: node tools/weapon-inspect.mjs [--weapon ho-mk4c] [--out docs/shots/inspect]
 */

import { chromium } from 'playwright';
import { createServer } from 'vite';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : d; };
const WEAPON = arg('weapon', 'ho-mk4c');
const OUT = path.resolve(ROOT, arg('out', 'docs/shots/inspect'));
const ATT = JSON.parse(arg('att', '{"optic":"opt-rds","muzzle":"muz-a2","underbarrel":"grip-handstop","handguard":"hg-mlok-short"}'));

// pos + rot for the viewmodel, chosen to fill the frame from each side.
const ANGLES = [
  { name: 'left',   p: [0.02, -0.045, -0.62], r: [0.00, 1.57, 0.0] },
  { name: 'right',  p: [0.02, -0.045, -0.62], r: [0.00, -1.57, 0.0] },
  { name: 'three-q', p: [0.03, -0.055, -0.60], r: [0.10, 0.95, 0.0] },
  { name: 'top',    p: [0.02, -0.02, -0.66], r: [1.35, 1.57, 0.0] },
  { name: 'hands',  p: [0.05, -0.10, -0.36], r: [0.05, 0.75, 0.0] },
];

async function main() {
  await mkdir(OUT, { recursive: true });
  const server = await createServer({ root: ROOT, configFile: path.join(ROOT, 'vite.config.ts'),
    server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' });
  await server.listen();
  const url = `http://127.0.0.1:${server.httpServer.address().port}/`;

  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium',
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
           '--disable-dev-shm-usage', '--no-sandbox', '--enable-webgl', '--ignore-gpu-blocklist'],
  });
  const page = await browser.newPage({ viewport: { width: 1100, height: 620 } });
  page.on('pageerror', (e) => console.error('  [pageerror]', e.message));
  await page.goto(url, { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction(() => window.__BM && window.__BM.ready === true, { timeout: 180000 });

  // A clean overhead sky puts the weapon against something flat, so the
  // silhouette is what the eye reads rather than a busy level behind it.
  await page.evaluate(({ w, a }) => {
    window.__BM.setupShot('gun-hip');
    window.__BM.equipWeapon(w, a);
    window.__BM.setStudio(true);
    document.getElementById('hud')?.style.setProperty('display', 'none');
  }, { w: WEAPON, a: ATT });
  await page.evaluate(() => window.__BM.settle(500));

  const info = await page.evaluate(() => {
    const e = window.engine.get('viewmodel');
    return { tris: e.model?.triangles ?? 0 };
  });
  console.log(`[inspect] ${WEAPON} — ${info.tris} triangles`);

  for (const a of ANGLES) {
    await page.evaluate((q) => {
      window.__BM.setViewmodelPose(q[0], q[1], q[2], q[3], q[4], q[5]);
    }, [...a.p, ...a.r]);
    await page.evaluate(() => window.__BM.settle(90));
    await page.waitForTimeout(80);
    const file = path.join(OUT, `${WEAPON}-${a.name}.png`);
    await page.screenshot({ path: file, timeout: 180000, animations: 'disabled' });
    console.log(`  ✓ ${a.name}`);
  }
  await writeFile(path.join(OUT, 'info.json'), JSON.stringify({ weapon: WEAPON, ...info }, null, 2));
  await browser.close();
  await server.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
