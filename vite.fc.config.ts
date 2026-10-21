import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// The football game: one self-contained HTML file, built next to the NFL one.
export default defineConfig({
  root: 'fc',
  plugins: [react(), viteSingleFile()],
  build: { outDir: '../play-fc', emptyOutDir: true, target: 'es2022', chunkSizeWarningLimit: 4000 },
});
