#!/usr/bin/env node
/**
 * Viewmodel framing tuner.
 *
 * Posing a first-person weapon by looking at screenshots is guesswork: the
 * numbers that matter (where the muzzle lands in NDC, whether the buttstock is
 * off-frame, how much of the screen the weapon eats) are invisible in the pose
 * constants. This boots the game once, sweeps candidate poses through
 * `__BM.setViewmodelPose`, reads `__BM.viewmodelFraming` back, and scores each
 * against a target layout taken from how real shooters frame a hip carry:
 *
 *   - muzzle low-right of centre, clearly inside frame
 *   - optic visible, not clipped
 *   - buttstock OFF frame (it is behind your shoulder in reality)
 *   - weapon covering roughly a fifth of the screen, not half
 *
 * Usage: node tools/frame-weapon.mjs [--weapon ho-mk4c]
 */

import { chromium } from 'playwright';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : d; };
const WEAPON = arg('weapon', 'ho-mk4c');

// Target layout, in NDC, taken from how tactical shooters actually frame a
// hip carry: weapon in the lower-right third, muzzle below the crosshair so it
// never covers the point of aim, and the receiver angled across the frame so
// you see its *side* rather than looking down the barrel end-on.
//
// sight.x > muzzle.x is the whole three-quarter view: the muzzle swings left
// while the stock stays right. With both at the same x the weapon renders as a
// stubby block and reads as a placeholder.
const TARGET = {
  muzzle: [0.12, -0.30],
  sight: [0.30, -0.27],
  coverage: 0.17,
  minDepth: 0.20,     // nothing may approach the near plane
};

function score(f) {
  if (!f) return { total: 1e9, miss: ['no framing'] };
  const miss = [];
  const sq = (a, b) => (a - b) * (a - b);
  let total =
    12 * sq(f.points.muzzle.x, TARGET.muzzle[0]) +
    12 * sq(f.points.muzzle.y, TARGET.muzzle[1]) +
    9 * sq(f.points.sight.x, TARGET.sight[0]) +
    9 * sq(f.points.sight.y, TARGET.sight[1]) +
    40 * sq(f.coverage, TARGET.coverage);

  // The buttstock belongs behind the shoulder. On frame it is the slab that
  // ate the right third of the last capture.
  if (Math.abs(f.points.buttstock.x) < 1 && Math.abs(f.points.buttstock.y) < 1) {
    total += 3; miss.push('buttstock on frame');
  }
  for (const [k, pt] of Object.entries(f.points)) {
    if (pt.depth < TARGET.minDepth) {
      total += 6 * (TARGET.minDepth - pt.depth) + 1;
      miss.push(`${k} depth ${pt.depth.toFixed(3)}`);
    }
  }
  // Every landmark inside the frustum sides, or the weapon is being cropped.
  if (f.bbox.x1 > 1.35) { total += 2 * (f.bbox.x1 - 1.35); miss.push(`bbox.x1 ${f.bbox.x1}`); }
  return { total, miss };
}

async function main() {
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
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', (e) => console.error('  [pageerror]', e.message));
  await page.goto(url, { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction(() => window.__BM && window.__BM.ready === true, { timeout: 180000 });

  await page.evaluate((w) => {
    window.__BM.equipWeapon(w, { optic: 'opt-rds', muzzle: 'muz-a2',
      underbarrel: 'grip-handstop', handguard: 'hg-mlok-short' });
  }, WEAPON);
  await page.evaluate(() => window.__BM.settle(400));

  // The whole sweep runs inside one page.evaluate: viewmodelFraming is pure
  // projection maths against a candidate pose, so no frames are rendered and a
  // few hundred candidates cost milliseconds instead of minutes.
  const sweep = async (grid) =>
    page.evaluate((g) => g.map((p) => ({ p, f: window.__BM.viewmodelFraming(p) })), grid);

  const grid = [];
  for (const px of [0.05, 0.07, 0.09, 0.11, 0.13])
    for (const py of [-0.21, -0.185, -0.16, -0.135, -0.11])
      for (const pz of [-0.50, -0.46, -0.42, -0.38, -0.34])
        for (const rx of [0.04, 0.09, 0.14, 0.19, 0.24])
          for (const ry of [0.05, 0.11, 0.17, 0.23, 0.29])
            grid.push([px, py, pz, rx, ry, 0.02]);

  console.log(`[frame] sweeping ${grid.length} poses…`);
  let results = (await sweep(grid)).map((r) => ({ ...r, s: score(r.f) }));
  results.sort((a, b) => a.s.total - b.s.total);
  const best = results[0];
  console.log(`[frame] coarse best score=${best.s.total.toFixed(4)} pose=${JSON.stringify(best.p)}`);

  const [bx, by, bz, brx, bry] = best.p;
  const refine = [];
  const around = (v, step) => [v - step, v - step / 2, v, v + step / 2, v + step];
  for (const px of around(bx, 0.015))
    for (const py of around(by, 0.018))
      for (const pz of around(bz, 0.03))
        for (const rx of around(brx, 0.035))
          for (const ry of around(bry, 0.03))
            refine.push([px, py, pz, rx, ry, 0.02]);
  console.log(`[frame] refining ${refine.length} poses…`);
  results = (await sweep(refine)).map((r) => ({ ...r, s: score(r.f) }));
  results.sort((a, b) => a.s.total - b.s.total);

  for (const r of results.slice(0, 6)) {
    console.log(`  ${r.s.total.toFixed(4)}  [${r.p.map((v) => v.toFixed(3)).join(', ')}]  ` +
      `muzzle(${r.f.points.muzzle.x.toFixed(2)},${r.f.points.muzzle.y.toFixed(2)}) ` +
      `sight(${r.f.points.sight.x.toFixed(2)},${r.f.points.sight.y.toFixed(2)}) ` +
      `butt(${r.f.points.buttstock.x.toFixed(2)},${r.f.points.buttstock.y.toFixed(2)}) ` +
      `cov=${r.f.coverage.toFixed(3)}` + (r.s.miss.length ? `  ! ${r.s.miss.join('; ')}` : ''));
  }
  const win = results[0];
  console.log(`\n[frame] BEST  pos(${win.p[0].toFixed(3)}, ${win.p[1].toFixed(3)}, ${win.p[2].toFixed(3)})  ` +
    `rot(${win.p[3].toFixed(3)}, ${win.p[4].toFixed(3)}, ${win.p[5].toFixed(3)})`);
  console.log(`[frame] nearest geometry depth: ${JSON.stringify(
    Object.fromEntries(Object.entries(win.f.points).map(([k, v]) => [k, v.depth])))}`);

  await browser.close();
  await server.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
