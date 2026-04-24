import { defineConfig, type Plugin } from 'vite';
import { resolve } from 'node:path';
import { request as httpRequest, type IncomingMessage, type ServerResponse } from 'node:http';

/**
 * Vite plugin that proxies non-hub requests to the main viewer dev server
 * on port 5173. This lets the hub serve everything through a single port,
 * which is required for VS Code tunnels / Codespaces where each port gets
 * a separate forwarded URL.
 */
function viewerProxy(): Plugin {
  return {
    name: 'hub-viewer-proxy',
    configureServer(server) {
      // Return a function → runs as post-middleware (after Vite's own handlers)
      return (): void => {
        server.middlewares.use((req: IncomingMessage, res: ServerResponse) => {
          const proxyReq = httpRequest(
            {
              hostname: 'localhost',
              port: 5173,
              path: req.url,
              method: req.method,
              headers: { ...req.headers, host: 'localhost:5173' },
            },
            (proxyRes) => {
              res.writeHead(proxyRes.statusCode ?? 200, proxyRes.headers);
              proxyRes.pipe(res);
            },
          );
          proxyReq.on('error', () => {
            res.writeHead(502);
            res.end('Viewer dev server not running on :5173 — start it with: npm run dev');
          });
          req.pipe(proxyReq);
        });
      };
    },
  };
}

export default defineConfig({
  root: resolve(__dirname, 'src/client'),
  base: '/hub/',
  build: {
    outDir: resolve(__dirname, 'dist/client'),
    emptyOutDir: true,
    target: 'ES2022',
  },
  plugins: [viewerProxy()],
  server: {
    port: 3001,
    proxy: {
      '/hub/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/api': {
        target: 'http://localhost:1234',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:1234',
        ws: true,
      },
    },
  },
});
