import { defineConfig } from 'vite';
import { resolve } from 'path';
import { posix } from 'node:path';
import { geekSlidesHmr } from './packages/engine/src/hmr/vite-plugin-geekslides-hmr';

const DEFAULT_DEV_DECK_BASE = '/decks/css-doodle-demo';

function resolveDevDeckBase(): string {
  const configuredBase = process.env['GEEKSLIDES_DEV_DECK_BASE'] ?? DEFAULT_DEV_DECK_BASE;
  const withLeadingSlash = configuredBase.startsWith('/') ? configuredBase : `/${configuredBase}`;
  return withLeadingSlash.replace(/\/$/, '');
}

function mapDeckRequestPlugin() {
  const devDeckBase = resolveDevDeckBase();

  return {
    name: 'geekslides-map-deck-request',
    configureServer(server: import('vite').ViteDevServer): void {
      server.middlewares.use((req, _res, next) => {
        const requestUrl = req.url;
        if (!requestUrl || !requestUrl.startsWith('/deck/')) {
          next();
          return;
        }

        // Prevent traversal when remapping /deck/* into the configured local deck path.
        const [pathPart, queryPart] = requestUrl.split('?', 2);
        const rawSuffix = pathPart.slice('/deck/'.length);
        const normalizedSuffix = posix.normalize(`/${rawSuffix}`);
        if (normalizedSuffix.includes('..')) {
          next();
          return;
        }

        const mappedPath = `${devDeckBase}${normalizedSuffix}`;
        req.url = queryPart ? `${mappedPath}?${queryPart}` : mappedPath;
        next();
      });
    },
  };
}

function mapVotePagePlugin() {
  return {
    name: 'geekslides-map-vote-page',
    configureServer(server: import('vite').ViteDevServer): void {
      server.middlewares.use((req, _res, next) => {
        // Rewrite /vote.html and /vote.js → /packages/cli/app/* so Vite can
        // serve and transform them without duplicating the files.
        if (req.url === '/vote.html' || req.url?.startsWith('/vote.html?')) {
          req.url = req.url.replace('/vote.html', '/packages/cli/app/vote.html');
        } else if (req.url === '/vote.js' || req.url?.startsWith('/vote.js?')) {
          req.url = req.url.replace('/vote.js', '/packages/cli/app/vote.js');
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [mapDeckRequestPlugin(), mapVotePagePlugin(), geekSlidesHmr()],
  resolve: {
    alias: [
      { find: /^@engine\/(.+)$/, replacement: resolve(__dirname, 'packages/engine/src/$1') },
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
    allowedHosts : ['vscode-gs.snow-burbot.ts.net'],
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
