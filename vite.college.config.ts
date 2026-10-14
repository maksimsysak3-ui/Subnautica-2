import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// The college game: its own single self-contained HTML file, built next to the NFL one.
export default defineConfig({
  root: 'college',
  plugins: [react(), viteSingleFile()],
  build: { outDir: '../play-college', emptyOutDir: true, target: 'es2022', chunkSizeWarningLimit: 4000 },
});
