#!/usr/bin/env node
/**
 * Optic close-up.
 *
 * A red dot's window is ~50 screen pixels at ADS, which is far too small to
 * judge from a full frame — "is that the world showing through the glass or an
 * opaque grey panel?" is not answerable at that size. This captures the same
 * aimed view at a 4x device scale factor and clips to the sight, so the window
 * arrives as a few hundred pixels.
 */
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : d; };
const OUT = path.resolve(ROOT, arg('out', 'docs/shots/optic'));
const SHOT = arg('shot', 'gun-ads');

await mkdir(OUT, { recursive: true });
const server = await createServer({ root: ROOT, configFile: path.join(ROOT, 'vite.config.ts'),
  server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const url = `http://127.0.0.1:${server.httpServer.address().port}/`;
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium', headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
         '--disable-dev-shm-usage', '--no-sandbox', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 640, height: 360 }, deviceScaleFactor: 4 });
page.on('pageerror', (e) => console.error('  [pageerror]', e.message));
await page.goto(url, { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction(() => window.__BM && window.__BM.ready === true, { timeout: 180000 });
await page.evaluate((s) => window.__BM.setupShot(s), SHOT);
await page.evaluate(() => window.__BM.settle(700));
await page.waitForTimeout(150);

// The sight sits on the camera axis at ADS, so clip around frame centre.
const file = path.join(OUT, `${SHOT}-optic.png`);
await page.screenshot({ path: file, timeout: 180000, animations: 'disabled',
  clip: { x: 240, y: 110, width: 160, height: 130 } });
console.log(`  ✓ ${path.relative(ROOT, file)}  (4x device scale → 640x520)`);
await browser.close();
await server.close();
