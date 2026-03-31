import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@geekslides/engine': resolve(__dirname, 'packages/engine/src/index.ts'),
    },
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
    },
  },
});
