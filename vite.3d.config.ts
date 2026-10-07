import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// The standalone 3D game: one self-contained file, play/3d.html (three.js inlined).
export default defineConfig({
  root: 'app3d',
  plugins: [viteSingleFile()],
  build: { outDir: '../play', emptyOutDir: false, target: 'es2022', chunkSizeWarningLimit: 4000, rollupOptions: { input: 'app3d/3d.html' } },
});
