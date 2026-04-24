import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  root: resolve(__dirname, 'src/client'),
  base: '/hub/',
  build: {
    outDir: resolve(__dirname, 'dist/client'),
    emptyOutDir: true,
    target: 'ES2022',
  },
  server: {
    port: 3001,
    proxy: {
      '/hub/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
