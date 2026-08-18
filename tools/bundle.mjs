#!/usr/bin/env node
/**
 * Single-file build for publishing.
 *
 * The game normally ships as index.html plus ES module chunks. The hosting
 * target we publish to serves one self-contained page under a strict CSP —
 * no external hosts, no separate asset requests — so this bundles everything
 * (JS, CSS, markup) inline.
 *
 * It also strips the <html>/<head>/<body> wrapper, because the publish target
 * supplies its own document skeleton and only wants the page content.
 *
 * Usage: node tools/bundle.mjs [--out dist/black-meridian.html]
 */

import { build } from 'vite';
import { readFile, writeFile, rm, mkdir } from 'node:fs/promises';
import { fileURLToPath, URL } from 'node:url';
import path from 'node:path';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function arg(name, dflt) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : dflt;
}

const OUT = path.resolve(ROOT, arg('out', 'dist/black-meridian.html'));
const TMP = path.join(ROOT, 'dist', '_single');

/**
 * Neutralise sequences that change how the HTML parser or the module goal
 * reads an inline script: `</script` would close the tag early, and `<!--`
 * is a syntax error inside a module (unlike a classic script).
 */
function escapeForInlineScript(js) {
  return js.replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');
}

async function main() {
  await rm(TMP, { recursive: true, force: true });

  console.log('[bundle] building…');
  // configFile:false rather than the project config — vite.config.ts sets
  // manualChunks for the normal build, and rollup rejects that combined with
  // inlineDynamicImports. Re-declare the few settings we still need.
  await build({
    root: ROOT,
    configFile: false,
    logLevel: 'error',
    base: './',
    resolve: {
      alias: { '@': fileURLToPath(new URL('../src', import.meta.url)) },
    },
    build: {
      outDir: TMP,
      emptyOutDir: true,
      target: 'es2022',
      sourcemap: false,
      cssCodeSplit: false,
      assetsInlineLimit: 100_000_000, // inline every asset as a data URI
      rollupOptions: {
        output: {
          // One chunk — a single inline <script> can't resolve sibling imports.
          inlineDynamicImports: true,
          entryFileNames: 'app.js',
          assetFileNames: 'app.[ext]',
        },
      },
    },
  });

  const rawHtml = await readFile(path.join(TMP, 'index.html'), 'utf8');

  // Split the document skeleton FIRST. Doing it after inlining is a trap: the
  // bundled JS contains strings like `</head>`, and a regex split would then
  // truncate the script mid-source and yield a syntax error at runtime.
  const headMatch = rawHtml.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
  const bodyMatch = rawHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  let head = headMatch ? headMatch[1] : '';
  let body = bodyMatch ? bodyMatch[1] : rawHtml;

  // Drop tags the publish wrapper already provides; keep <title> and <style>.
  head = head
    .replace(/<meta[^>]*charset[^>]*>/gi, '')
    .replace(/<meta[^>]*viewport[^>]*>/gi, '')
    .replace(/<link[^>]+rel=["']modulepreload["'][^>]*>/gi, '')
    .trim();

  const unresolved = [];

  /** Replace external <link rel=stylesheet> and <script src> with inline tags. */
  async function inlineInto(fragment) {
    let out = fragment;

    const linkRe = /<link[^>]+rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>/gi;
    for (const m of [...out.matchAll(linkRe)]) {
      // Absolute URLs stay as-is. The publish target's CSP admits Google Fonts;
      // everything else is a local build asset that must be inlined.
      if (/^(https?:)?\/\//i.test(m[1])) continue;
      const href = m[1].replace(/^\.?\//, '');
      const css = await readFile(path.join(TMP, href), 'utf8').catch(() => null);
      if (css === null) { unresolved.push(m[1]); continue; }
      // Replacer *function*, not a string: minified bundles contain `$&` and
      // `$'`, which String.replace would expand as pattern references and
      // splice the original tag back into the middle of the source.
      out = out.replace(m[0], () => `<style>\n${css}\n</style>`);
    }

    const scriptRe = /<script[^>]*\ssrc=["']([^"']+)["'][^>]*><\/script>/gi;
    for (const m of [...out.matchAll(scriptRe)]) {
      const src = m[1].replace(/^\.?\//, '');
      const js = await readFile(path.join(TMP, src), 'utf8').catch(() => null);
      if (js === null) { unresolved.push(m[1]); continue; }
      out = out.replace(m[0], () => `<script type="module">\n${escapeForInlineScript(js)}\n</script>`);
    }
    return out;
  }

  head = await inlineInto(head);
  body = await inlineInto(body);

  // Verify by what failed to resolve, not by re-scanning the document: the
  // bundled JS legitimately contains strings like `<script src=`, and the HTML
  // parser ignores those inside a script body anyway.
  if (unresolved.length) {
    throw new Error(
      `[bundle] could not inline ${unresolved.length} external reference(s): ${unresolved.join(', ')}\n` +
      'The published page would break under CSP.',
    );
  }

  const out = `${head}\n${body}`.trim();

  await mkdir(path.dirname(OUT), { recursive: true });
  await writeFile(OUT, out, 'utf8');
  await rm(TMP, { recursive: true, force: true });

  const kb = Math.round(Buffer.byteLength(out, 'utf8') / 1024);
  console.log(`[bundle] → ${path.relative(ROOT, OUT)}  (${kb} kB, self-contained)`);
  if (kb > 15000) console.warn('[bundle] ⚠ approaching the 16 MB publish limit');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
