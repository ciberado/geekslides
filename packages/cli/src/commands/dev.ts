/**
 * GeekSlides v2 — dev command.
 *
 * Starts Vite dev server + optional y-websocket server.
 */

import type { Command } from 'commander';
import { createServer, type InlineConfig } from 'vite';

export function registerDevCommand(program: Command): void {
  program
    .command('dev')
    .description('Start development server')
    .option('--port <n>', 'Vite dev server port', '5173')
    .option('--ws-port <n>', 'y-websocket server port', '1234')
    .option('--no-sync', 'Disable y-websocket server')
    .option('--open', 'Open browser automatically')
    .option('--config <path>', 'Config file path', 'config.json')
    .action(async (opts: { port: string; wsPort: string; sync: boolean; open: boolean; config: string }) => {
      const port = Number(opts.port);
      const wsPort = Number(opts.wsPort);

      // Start y-websocket server if sync enabled
      if (opts.sync) {
        const { createServer: createWsServer } = await import('@geekslides/server');
        createWsServer({ port: wsPort });
        console.log(`  Sync server running on ws://localhost:${String(wsPort)}`);
      }

      // Vite dev server config
      const viteConfig: InlineConfig = {
        server: {
          port,
          open: opts.open,
          ...(opts.sync
            ? { proxy: { '/ws': { target: `ws://localhost:${String(wsPort)}`, ws: true } } }
            : {}),
        },
        configFile: false,
        root: process.cwd(),
      };

      const server = await createServer(viteConfig);
      await server.listen();

      console.log(`  Presentation:  http://localhost:${String(port)}/`);
      console.log(`  Speaker view:  http://localhost:${String(port)}/?view=speaker`);
    });
}
