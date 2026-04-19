import { defineConfig } from 'vite';
import { resolve } from 'path';
import { geekSlidesHmr } from './packages/engine/src/hmr/vite-plugin-geekslides-hmr';

export default defineConfig({
  plugins: [geekSlidesHmr()],
  resolve: {
    alias: [
      { find: /^@geekslides\/engine$/, replacement: resolve(__dirname, 'packages/engine/src/index.ts') },
    ],
  },
  build: {
    lib: {
      entry: resolve(__dirname, 'packages/engine/src/index.ts'),
      name: 'GeekSlides',
      formats: ['es'],
      fileName: 'geekslides',
    },
    rollupOptions: {
      external: ['yjs', 'y-websocket', 'chart.js'],
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/ws': {
        target: 'ws://localhost:1234',
        ws: true,
      },
      '/api': {
        target: 'http://localhost:1234',
      },
    },
  },
});
