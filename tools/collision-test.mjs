#!/usr/bin/env node
/**
 * Collision regression test.
 *
 * Walks the player into geometry from several headings and asserts they never
 * end up inside a solid brick. This is the check that would have caught the
 * original bug, where the controller resolved against a mesh list that never
 * contained any level geometry, so the player walked through every wall.
 */
import { chromium } from 'playwright';
import { createServer } from 'vite';

const server = await createServer({ root: process.cwd(), configFile: 'vite.config.ts',
  server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const url = `http://127.0.0.1:${server.httpServer.address().port}/`;
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true,
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 480, height: 270 } });
page.on('pageerror', e => console.log('PAGEERR', e.message));
await page.goto(url, { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction(() => window.__BM?.ready === true, { timeout: 180000 });

// Start on the approach and walk in on eight headings, 4 seconds each.
const headings = [0, 0.785, 1.571, 2.356, 3.142, 3.927, 4.712, 5.498];
let failures = 0;
const results = [];

for (const yaw of headings) {
  const start = await page.evaluate((y) => window.__BM.placePlayer(6, 96, y), yaw);
  const end = await page.evaluate(() => window.__BM.drivePlayer({ moveZ: 1, sprint: true }, 240));
  const dist = Math.hypot(end.x - start.x, end.z - start.z);
  const bad = end.insideGeometry || !Number.isFinite(end.y) || end.y < -50;
  if (bad) failures++;
  results.push({ yaw: yaw.toFixed(2), dist: dist.toFixed(1), y: end.y,
                 grounded: end.grounded, inside: end.insideGeometry });
}

// Walk straight at the compound from outside: must be stopped by the wall.
await page.evaluate(() => window.__BM.placePlayer(0, 78, 0));
const wall = await page.evaluate(() => window.__BM.drivePlayer({ moveZ: 1, sprint: true }, 600));

console.table(results);
console.log('head-on into compound:', JSON.stringify(wall));
console.log(failures === 0 && !wall.insideGeometry
  ? '[collision] ✓ no clipping on any heading'
  : `[collision] ✗ ${failures} heading(s) ended inside geometry`);

await browser.close(); await server.close();
process.exit(failures === 0 && !wall.insideGeometry ? 0 : 1);
