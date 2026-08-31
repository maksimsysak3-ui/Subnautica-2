import { defineConfig } from 'vite';

/**
 * Identifies this build. Baked into index.html and written to version.json,
 * so a page loaded from a stale cache can notice and replace itself.
 *
 * GitHub Pages serves HTML with a ten-minute max-age and gives no way to
 * change that, so without this a deploy is invisible to anyone holding a
 * cached copy -- and telling people to hard-reload is not a deployment
 * strategy.
 */
const BUILD_ID = Date.now().toString(36);

// Relative asset paths, deliberately. GitHub Pages might serve this from the
// repo root (/Subnautica-2/) or from the /docs folder (/Subnautica-2/docs/),
// depending on a dropdown in the repo settings. An absolute base only works
// for one of those; './' works for both, and for file:// and any other host.
export default defineConfig({
  base: './',
  plugins: [
    {
      name: 'build-version',
      transformIndexHtml(html) {
        return html.replace(/__BUILD_ID__/g, BUILD_ID);
      },
      generateBundle() {
        this.emitFile({
          type: 'asset',
          fileName: 'version.json',
          source: JSON.stringify({ build: BUILD_ID }),
        });
      },
    },
  ],
  build: {
    // Built site is committed so GitHub Pages can serve it straight from
    // the branch ("Deploy from a branch" -> /docs). See README.
    outDir: 'docs',
    emptyOutDir: true,
    target: 'es2022',
    sourcemap: true,
  },
  server: {
    headers: {
      // Required for SharedArrayBuffer (crossOriginIsolated). Dev server can
      // set these directly; on GitHub Pages we can't, so a service worker
      // does it instead (public/coi-serviceworker.js).
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  preview: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
});
