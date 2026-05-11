import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: resolve(__dirname, 'app'),
  build: {
    outDir: resolve(__dirname, 'dist/app'),
    emptyOutDir: true,
    target: 'es2022',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'app/index.html'),
        vote: resolve(__dirname, 'app/vote.html'),
      },
    },
  },
  configFile: false,
});
