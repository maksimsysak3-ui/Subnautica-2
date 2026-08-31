import { defineConfig } from 'vite';

// Relative asset paths, deliberately. GitHub Pages might serve this from the
// repo root (/Subnautica-2/) or from the /docs folder (/Subnautica-2/docs/),
// depending on a dropdown in the repo settings. An absolute base only works
// for one of those; './' works for both, and for file:// and any other host.
export default defineConfig({
  base: './',
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
