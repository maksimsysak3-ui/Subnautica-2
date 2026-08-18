#!/usr/bin/env node
/**
 * Boot-checks the single-file bundle the way the publish target will serve it:
 * wrapped in a bare document skeleton, loaded from disk, no dev server.
 * Catches anything that only worked because Vite was resolving modules.
 */
import { chromium } from 'playwright';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const file = process.argv[2] ?? 'dist/black-meridian.html';
const content = await readFile(file, 'utf8');
const wrapped = `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"></head><body>
${content}
</body></html>`;
const tmp = path.resolve('dist/_verify.html');
await writeFile(tmp, wrapped, 'utf8');

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium', headless: true,
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));

await page.goto('file://' + tmp, { waitUntil: 'load', timeout: 120000 });
let ok = true;
try {
  await page.waitForFunction(() => window.__BM?.ready === true, { timeout: 120000 });
} catch { ok = false; }

await page.screenshot({ path: 'dist/_verify.png' });
console.log(ok ? '[verify] ✓ bundle boots standalone' : '[verify] ✗ bundle did NOT reach ready');
if (errors.length) { console.log('[verify] console errors:'); errors.forEach(e => console.log('   ' + e)); }
await browser.close();
process.exit(ok && errors.length === 0 ? 0 : 1);
