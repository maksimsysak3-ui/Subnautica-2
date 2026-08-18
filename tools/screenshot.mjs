#!/usr/bin/env node
/**
 * Headless capture harness.
 *
 * Boots the built game in Chromium, drives it through a scripted camera/state
 * sequence, and writes PNGs. Critics compare these frames against reference
 * material — so the loop is grounded in what the game actually renders, not in
 * what a builder claims it renders.
 *
 * Usage:
 *   node tools/screenshot.mjs                       # default shot list
 *   node tools/screenshot.mjs --shots a,b,c         # named shots only
 *   node tools/screenshot.mjs --out docs/shots/r3   # output directory
 *   node tools/screenshot.mjs --width 2560 --height 1440
 */

import { chromium } from 'playwright';
import { createServer } from 'vite';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function arg(name, dflt) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : dflt;
}
function flag(name) {
  return process.argv.includes(`--${name}`);
}

const OUT = path.resolve(ROOT, arg('out', 'docs/shots/latest'));
const WIDTH = parseInt(arg('width', '1920'), 10);
const HEIGHT = parseInt(arg('height', '1080'), 10);
const SHOTS = arg('shots', '') ? arg('shots', '').split(',').map((s) => s.trim()) : null;
const SETTLE_MS = parseInt(arg('settle', '900'), 10);
const VERBOSE = flag('verbose');

async function main() {
  await mkdir(OUT, { recursive: true });

  const server = await createServer({
    root: ROOT,
    configFile: path.join(ROOT, 'vite.config.ts'),
    server: { port: 0, host: '127.0.0.1' },
    logLevel: 'error',
  });
  await server.listen();
  const addr = server.httpServer.address();
  const url = `http://127.0.0.1:${addr.port}/`;
  console.log(`[shot] dev server ${url}`);

  // The sandbox ships a pinned Chromium build that may not match the npm
  // package's expected revision. Use the preinstalled binary directly — it is
  // the full browser, which also has better WebGL support than headless_shell.
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium',
    headless: true,
    args: [
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--disable-dev-shm-usage',
      '--no-sandbox',
      '--enable-webgl',
      '--ignore-gpu-blocklist',
    ],
  });

  const page = await browser.newPage({
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: 1,
  });

  const logs = [];
  page.on('console', (m) => {
    const t = `[${m.type()}] ${m.text()}`;
    logs.push(t);
    if (VERBOSE || m.type() === 'error') console.log('  ' + t);
  });
  page.on('pageerror', (e) => {
    const t = `[pageerror] ${e.message}\n${e.stack ?? ''}`;
    logs.push(t);
    console.error('  ' + t);
  });

  await page.goto(url, { waitUntil: 'load', timeout: 120000 });

  // The game exposes window.__BM for automation.
  try {
    await page.waitForFunction(() => window.__BM && window.__BM.ready === true, { timeout: 180000 });
  } catch (err) {
    await page.screenshot({ path: path.join(OUT, '_boot-failure.png') });
    await writeFile(path.join(OUT, '_console.log'), logs.join('\n'), 'utf8');
    console.error('[shot] game never reported ready — wrote _boot-failure.png and _console.log');
    await browser.close();
    await server.close();
    process.exit(1);
  }

  const available = await page.evaluate(() => window.__BM.listShots());
  const list = SHOTS ?? available;
  console.log(`[shot] capturing ${list.length} of ${available.length} available shots at ${WIDTH}x${HEIGHT}`);

  const manifest = [];
  for (const name of list) {
    if (!available.includes(name)) {
      console.warn(`[shot] unknown shot "${name}" — skipping`);
      continue;
    }
    const meta = await page.evaluate((n) => window.__BM.setupShot(n), name);
    // Let temporal effects (TAA, fog, exposure adaptation) converge.
    await page.evaluate((ms) => window.__BM.settle(ms), SETTLE_MS);
    await page.waitForTimeout(120);
    const file = path.join(OUT, `${name}.png`);
    // SwiftShader renders the full post chain on the CPU; a frame can take
    // several seconds, so the default 30s screenshot timeout is not enough.
    await page.screenshot({ path: file, timeout: 180000, animations: 'disabled' });
    manifest.push({ name, file: path.relative(ROOT, file), ...meta });
    console.log(`  ✓ ${name}${meta && meta.label ? ` — ${meta.label}` : ''}`);
  }

  const perf = await page.evaluate(() => window.__BM.perfReport());
  await writeFile(
    path.join(OUT, 'manifest.json'),
    JSON.stringify({ capturedAt: new Date().toISOString(), width: WIDTH, height: HEIGHT, shots: manifest, perf }, null, 2),
    'utf8',
  );
  await writeFile(path.join(OUT, '_console.log'), logs.join('\n'), 'utf8');

  const errCount = logs.filter((l) => l.startsWith('[error]') || l.startsWith('[pageerror]')).length;
  console.log(`[shot] done → ${path.relative(ROOT, OUT)}  (${errCount} console errors)`);
  console.log(`[shot] perf: ${JSON.stringify(perf)}`);

  await browser.close();
  await server.close();
  if (errCount > 0) process.exitCode = 2;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
