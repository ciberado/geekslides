/**
 * GeekSlides v2 — dev command.
 *
 * Starts Vite dev server + optional y-websocket server.
 */

import type { Command } from 'commander';
import { existsSync } from 'node:fs';
import { access } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { createServer, type InlineConfig } from 'vite';
import { geekSlidesHmr } from '@geekslides/engine/hmr';

declare const __dirname: string | undefined;

function resolveCliRoot(): string {
  const candidateDirs = [
    typeof __dirname === 'string' ? __dirname : '',
    process.argv[1] ? dirname(resolve(process.argv[1])) : '',
    resolve(process.cwd(), 'packages/cli'),
    resolve(process.cwd(), 'node_modules', '@geekslides', 'cli'),
    process.cwd(),
  ].filter(Boolean);

  for (const startDir of candidateDirs) {
    let currentDir = startDir;
    while (currentDir !== dirname(currentDir)) {
      if (
        existsSync(resolve(currentDir, 'package.json')) &&
        existsSync(resolve(currentDir, 'app', 'index.html'))
      ) {
        return currentDir;
      }
      currentDir = dirname(currentDir);
    }
  }

  throw new Error('Could not locate the GeekSlides CLI package root.');
}

const CLI_ROOT = resolveCliRoot();
const APP_ROOT = resolve(CLI_ROOT, 'app');

function normalizePathForUrl(path: string): string {
  return path.replace(/\\/g, '/');
}

export function resolveDeckConfigPath(configPath: string, cwd: string = process.cwd()): string {
  return isAbsolute(configPath) ? configPath : resolve(cwd, configPath);
}

export function toBrowserServedPath(filePath: string, appRoot: string = APP_ROOT): string {
  const absolutePath = resolve(filePath);
  const relativePath = relative(appRoot, absolutePath);

  if (relativePath.length > 0 && !relativePath.startsWith('..') && !isAbsolute(relativePath)) {
    return `/${normalizePathForUrl(relativePath)}`;
  }

  return `/@fs/${normalizePathForUrl(absolutePath)}`;
}

export function resolveCliAppRoot(): string {
  return APP_ROOT;
}

export function buildDeckDevUrl(baseUrl: string, browserConfigPath: string, speakerView: boolean = false): string {
  const url = new URL('/', baseUrl);
  url.searchParams.set('config', browserConfigPath);
  if (speakerView) {
    url.searchParams.set('view', 'speaker');
  }
  return url.toString();
}

export function getDeckRedirectTarget(requestUrl: string, browserConfigPath: string): string | null {
  const url = new URL(requestUrl, 'http://localhost');
  const isHtmlRequest = url.pathname === '/' || url.pathname === '/index.html';

  if (!isHtmlRequest || url.searchParams.has('config')) {
    return null;
  }

  url.searchParams.set('config', browserConfigPath);
  return `${url.pathname}${url.search}`;
}

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
      const deckConfigPath = resolveDeckConfigPath(opts.config);
      const deckDir = dirname(deckConfigPath);
      const browserConfigPath = toBrowserServedPath(deckConfigPath);
      const presentationUrl = buildDeckDevUrl(`http://localhost:${String(port)}`, browserConfigPath);
      const speakerUrl = buildDeckDevUrl(`http://localhost:${String(port)}`, browserConfigPath, true);
      const openTarget = new URL(presentationUrl);

      await access(deckConfigPath);

      // Start y-websocket server if sync enabled
      if (opts.sync) {
        const { createServer: createWsServer } = await import('@geekslides/server');
        createWsServer({ port: wsPort });
        console.log(`  Sync server running on ws://localhost:${String(wsPort)}`);
      }

      // Vite dev server config
      const viteConfig: InlineConfig = {
        plugins: [geekSlidesHmr()],
        server: {
          port,
          open: opts.open ? `${openTarget.pathname}${openTarget.search}` : false,
          fs: {
            allow: [APP_ROOT, deckDir],
          },
          ...(opts.sync
            ? {
                proxy: {
                  '/ws': { target: `ws://localhost:${String(wsPort)}`, ws: true },
                  '/api': { target: `http://localhost:${String(wsPort)}` },
                },
              }
            : {}),
        },
        configFile: false,
        root: APP_ROOT,
      };

      const server = await createServer(viteConfig);

      server.middlewares.use((req, res, next) => {
        const redirectTarget = getDeckRedirectTarget(req.url ?? '/', browserConfigPath);
        if (!redirectTarget) {
          next();
          return;
        }

        res.statusCode = 302;
        res.setHeader('Location', redirectTarget);
        res.end();
      });

      await server.listen();

      console.log(`  Deck config:   ${deckConfigPath}`);
      console.log(`  Presentation:  ${presentationUrl}`);
      console.log(`  Speaker view:  ${speakerUrl}`);
    });
}
