import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// The college game with the 3D stadium renderer on game day: play/college3d.html.
export default defineConfig({
  root: 'college',
  define: { __COLLEGE_3D__: 'true' },
  plugins: [react(), viteSingleFile()],
  build: { outDir: '../play-college3d', emptyOutDir: true, target: 'es2022', chunkSizeWarningLimit: 6000 },
});
