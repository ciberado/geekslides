import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@geekslides/engine/headless': resolve(__dirname, 'packages/engine/src/headless.ts'),
      '@geekslides/engine/hmr': resolve(__dirname, 'packages/engine/src/hmr/vite-plugin-geekslides-hmr.ts'),
      '@geekslides/engine': resolve(__dirname, 'packages/engine/src/index.ts'),
    },
  },
  test: {
    include: ['packages/*/tests/**/*.test.ts'],
    exclude: ['node_modules', 'dist', 'e2e'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['packages/*/src/**/*.ts'],
      exclude: ['**/*.d.ts', '**/index.ts'],
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80,
      },
    },
  },
});
