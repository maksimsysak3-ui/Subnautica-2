import { defineConfig } from 'vite';

// The repo name — GitHub Pages serves the site from a subpath.
const BASE = '/Subnautica-2/';

export default defineConfig({
  base: BASE,
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
