/**
 * Bundles either page into one self-contained HTML file.
 *
 * The built site in `docs/` is three files and a fetch for `version.json`,
 * which is right for a static host and useless anywhere that will only take a
 * single document -- a preview, an artifact host, an email attachment, a USB
 * stick. This flattens each page into one file: the markup, the stylesheet,
 * and the whole bundle inlined as a classic script.
 *
 * Not a replacement for `npm run build`. The deploy machinery the real pages
 * carry -- the build-id check that replaces a stale cached copy, the service
 * worker eviction, the watchdog that finds `docs/` when the repository root is
 * being served -- all exist because of a static host, and none of it makes
 * sense in a document with nothing beside it. So it is dropped here rather
 * than shipped dead.
 *
 *     node tools/single-file.mjs <index|asset> <out.html> [--body-only]
 *
 * `--body-only` leaves off the doctype, <html> and <head>, for a host that
 * supplies its own skeleton.
 */

import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(new URL('.', import.meta.url)));
const which = process.argv[2] ?? 'asset';
const out = process.argv[3] ?? `${which}-single.html`;
const bodyOnly = process.argv.includes('--body-only');

const PAGES = {
  index: { html: 'index.html', entry: 'src/main.ts', title: 'citysim' },
  asset: { html: 'asset.html', entry: 'src/asset-viewer.ts', title: 'citysim assets' },
};
const page = PAGES[which];
if (!page) throw new Error(`unknown page ${which}; expected index or asset`);

/**
 * Vite's `?raw` suffix, for esbuild.
 *
 * The shaders are imported as strings. Vite understands the suffix natively
 * and esbuild does not, so it is resolved here to the file itself and loaded
 * as text.
 */
const rawSuffix = {
  name: 'raw-suffix',
  setup(build) {
    build.onResolve({ filter: /\?raw$/ }, (args) => ({
      path: path.resolve(args.resolveDir, args.path.replace(/\?raw$/, '')),
      namespace: 'raw',
    }));
    build.onLoad({ filter: /.*/, namespace: 'raw' }, (args) => ({
      contents: `export default ${JSON.stringify(fs.readFileSync(args.path, 'utf8'))};`,
      loader: 'js',
    }));
  },
};

const built = await esbuild.build({
  entryPoints: [path.join(root, page.entry)],
  bundle: true, write: false, format: 'iife', target: 'es2022',
  minify: true, sourcemap: false, plugins: [rawSuffix],
  define: { 'import.meta.env.DEV': 'false', 'import.meta.env.PROD': 'true' },
});
const js = built.outputFiles[0].text;

const src = fs.readFileSync(path.join(root, page.html), 'utf8');
const style = (/<style>([\s\S]*?)<\/style>/.exec(src) ?? [, ''])[1];
// The body, with every script in it removed: the module tag is replaced by the
// inlined bundle and the rest is deploy machinery that does not apply here.
const body = (/<body>([\s\S]*?)<\/body>/.exec(src) ?? [, ''])[1]
  .replace(/<script[\s\S]*?<\/script>/g, '')
  .replace(/\n{3,}/g, '\n');

const head =
  `<title>${page.title}</title>\n<style>${style}</style>\n`;
const doc = bodyOnly
  ? `${head}${body}\n<script>\n${js}\n</script>\n`
  : `<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="UTF-8">\n` +
    `<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">\n` +
    `<meta name="color-scheme" content="dark">\n${head}</head>\n<body>${body}` +
    `<script>\n${js}\n</script>\n</body>\n</html>\n`;

fs.writeFileSync(out, doc);
console.log(`wrote ${out}  (${(doc.length / 1e6).toFixed(2)} MB)`);
