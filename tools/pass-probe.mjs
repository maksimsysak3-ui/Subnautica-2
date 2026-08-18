#!/usr/bin/env node
/**
 * Captures one shot repeatedly with individual post passes disabled, so a
 * regression can be attributed to a specific pass instead of guessed at.
 */
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const SHOT = process.argv[2] ?? 'env-harsh-noon';
const OUT = path.resolve(process.argv[3] ?? 'docs/shots/passprobe');
await mkdir(OUT, { recursive: true });

const server = await createServer({ root: process.cwd(), configFile: 'vite.config.ts',
  server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const url = `http://127.0.0.1:${server.httpServer.address().port}/`;

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true,
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: parseInt(process.argv[4] ?? '1100', 10), height: parseInt(process.argv[5] ?? '620', 10) } });
page.on('pageerror', e => console.log('PAGEERR', e.message));
await page.goto(url, { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction(() => window.__BM?.ready === true, { timeout: 180000 });

const passes = await page.evaluate(() => window.__BM.listPasses());
console.log('passes:', passes.map(p => `${p.id}(${p.order})${p.enabled?'':'[off]'}`).join(' '));

async function shoot(label, disable) {
  await page.evaluate(({ shot, disable, all }) => {
    // setupShot re-applies the quality preset, which resets every pass's
    // enabled flag. Toggling before it silently undoes the whole experiment —
    // which is how this tool once reported that no pass caused an artifact
    // every pass was contributing to. Always set flags AFTER the shot.
    window.__BM.setupShot(shot);
    for (const p of all) window.__BM.setPass(p.id, !disable.includes(p.id) && p.enabled);
  }, { shot: SHOT, disable, all: passes });
  await page.evaluate(() => window.__BM.settle(400));
  await page.screenshot({ path: path.join(OUT, `${label}.png`), timeout: 180000 });
  console.log('  ✓', label);
}

await shoot('00-all-on', []);
for (const p of passes) {
  if (p.id === 'present') continue; // without present nothing reaches the screen
  await shoot(`no-${p.id}`, [p.id]);
}
await browser.close(); await server.close();
