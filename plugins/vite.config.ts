/**
 * GeekSlides Plugins — Vite build configuration.
 *
 * Builds each plugin bundle to a standalone ES module at plugins/{name}/dist/index.js.
 * Plugins receive the PluginAPI at runtime via their activate() function; they do NOT
 * import from the engine at runtime.
 *
 * Usage:
 *   npx vite build --config plugins/vite.config.ts
 *
 * Or via npm script: npm run build:plugins
 */

import { defineConfig } from 'vite';
import { resolve } from 'path';
import { readdirSync, existsSync } from 'fs';

const PLUGINS_DIR = resolve(__dirname);
const BUNDLE_NAMES = readdirSync(PLUGINS_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory() && d.name !== 'sdk' && d.name !== 'node_modules')
  .filter((d) => existsSync(resolve(PLUGINS_DIR, d.name, 'index.ts')))
  .map((d) => d.name);

// Build all plugin bundles as a multi-entry library
const input: Record<string, string> = {};
for (const name of BUNDLE_NAMES) {
  input[name] = resolve(PLUGINS_DIR, name, 'index.ts');
}

export default defineConfig({
  build: {
    outDir: resolve(PLUGINS_DIR, 'dist'),
    lib: {
      entry: input,
      formats: ['es'],
    },
    rollupOptions: {
      output: {
        entryFileNames: '[name]/index.js',
        chunkFileNames: '_shared/[name]-[hash].js',
      },
      // External dependencies that must be provided by the host or loaded separately.
      // For fully standalone remote use, these would need to be bundled in;
      // use `external: []` in a separate "standalone" build profile.
      external: ['mermaid', 'css-doodle', 'chart.js', 'qrcode'],
    },
    // Each plugin bundle is relatively small
    minify: false,
    sourcemap: true,
  },
  resolve: {
    alias: [
      // SDK types resolve to the local sdk directory
      { find: /^\.\.\/sdk\/types\.ts$/, replacement: resolve(PLUGINS_DIR, 'sdk/types.ts') },
    ],
  },
});
