/**
 * Writes the zone icons out as standalone SVG files, plus a legend sheet.
 *
 * The icons live in src/ui/zones.ts because the game draws them; these files
 * exist so they can be opened, dropped into a document, or diffed when the
 * colour code changes. Generated, never hand-edited.
 *
 *   node tools/zone-icons.mjs
 */

import * as esbuild from 'esbuild';
import { mkdirSync, writeFileSync } from 'node:fs';

const bundle = (
  await esbuild.build({
    entryPoints: [new URL('../src/ui/zones.ts', import.meta.url).pathname],
    bundle: true, format: 'esm', write: false, target: 'es2022',
  })
).outputFiles[0].text;

const { ZONE_ICON, ZONE_STYLE } = await import(
  'data:text/javascript;base64,' + Buffer.from(bundle).toString('base64'));

const dir = new URL('../public/zones/', import.meta.url);
mkdirSync(dir, { recursive: true });

const rows = [];
for (const [zone, svg] of Object.entries(ZONE_ICON)) {
  writeFileSync(new URL(`${zone}.svg`, dir), svg + '\n');
  const s = ZONE_STYLE[zone];
  rows.push(`  <figure>
    <img src="${zone}.svg" width="72" height="72" alt="${s.label}">
    <figcaption><b>${s.label}</b><span>${s.blurb}</span>
      <ul>${['deep', 'base', 'light', 'wash'].map((k) =>
        `<li><i style="background:${s[k]}"></i>${k} ${s[k]}</li>`).join('')}</ul>
    </figcaption>
  </figure>`);
  console.log(`${s.label.padEnd(12)} ${s.deep}  ${s.base}  ${s.light}  ${s.wash}`);
}

writeFileSync(new URL('index.html', dir), `<!doctype html>
<meta charset="utf-8"><title>Zone colour code</title>
<style>
  body { margin: 0; padding: 32px; background: #10151b; color: #e6edf4;
    font: 13px/1.5 ui-sans-serif, system-ui, sans-serif; }
  h1 { font-size: 12px; letter-spacing: .3em; text-transform: uppercase;
    color: #7d8b99; font-weight: 500; }
  figure { margin: 0 0 18px; display: flex; gap: 18px; align-items: flex-start;
    background: #161d25; border: 1px solid #232d38; border-radius: 12px; padding: 16px; }
  figcaption b { display: block; font-size: 15px; }
  figcaption span { color: #93a1b0; }
  ul { list-style: none; margin: 10px 0 0; padding: 0; display: flex; gap: 14px; flex-wrap: wrap; }
  li { font-family: ui-monospace, Menlo, monospace; font-size: 11px; color: #93a1b0;
    display: flex; align-items: center; gap: 6px; }
  i { width: 14px; height: 14px; border-radius: 4px; border: 1px solid #0006; }
</style>
<h1>Zone colour code</h1>
${rows.join('\n')}
`);

console.log(`\nwrote ${Object.keys(ZONE_ICON).length} icons + index.html to public/zones/`);
