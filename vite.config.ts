import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// One self-contained HTML file (data, code and styles inlined) so the game can be
// served straight from the repository with no server or build step on the host.
export default defineConfig({
  root: 'app',
  plugins: [react(), viteSingleFile()],
  build: { outDir: '../play', emptyOutDir: true, target: 'es2022', chunkSizeWarningLimit: 4000 },
});
