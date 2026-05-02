/**
 * Vite plugin for GeekSlides HMR.
 *
 * Intercepts .md, .json, and .css file changes and sends targeted
 * WebSocket messages to the client instead of triggering full page reloads.
 */

import type { Plugin, ViteDevServer, HmrContext } from 'vite';
import { isAbsolute, relative, resolve } from 'node:path';
import type { SlideMapEntry } from '../core/SlideParser.ts';

const HMR_EVENT = 'geekslides:content-update';
const WATCHED_EXTENSIONS = /\.(md|json|css)$/;

export interface ContentUpdatePayload {
  file: string;
  type: 'markdown' | 'config' | 'style';
  timestamp: number;
}

function classifyFile(filePath: string): ContentUpdatePayload['type'] | null {
  if (filePath.endsWith('.md')) return 'markdown';
  if (filePath.endsWith('.json')) return 'config';
  if (filePath.endsWith('.css')) return 'style';
  return null;
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/');
}

function toPublicFilePath(filePath: string, root: string): string {
  const absolutePath = resolve(filePath);
  const relativePath = relative(root, absolutePath);

  if (relativePath.length > 0 && !relativePath.startsWith('..') && !isAbsolute(relativePath)) {
    return normalizePath(relativePath);
  }

  return `/@fs${normalizePath(absolutePath)}`;
}

function toWatchedFilePath(filePath: string, root: string): string | null {
  const normalized = filePath.split('?')[0] ?? '';

  if (normalized.startsWith('/@fs')) {
    return normalized.slice('/@fs'.length);
  }

  const relativePath = normalized.replace(/^\/+/, '');
  if (relativePath.length === 0) {
    return null;
  }

  return resolve(root, relativePath);
}

export function geekSlidesHmr(): Plugin {
  let server: ViteDevServer | undefined;
  let root = '';
  let slideMapCache: SlideMapEntry[] | null = null;

  const sendContentUpdate = (filePath: string): void => {
    const fileType = classifyFile(filePath);

    if (!fileType || !WATCHED_EXTENSIONS.test(filePath)) {
      return;
    }

    const payload: ContentUpdatePayload = {
      file: toPublicFilePath(filePath, root),
      type: fileType,
      timestamp: Date.now(),
    };

    server?.ws.send({
      type: 'custom',
      event: HMR_EVENT,
      data: payload,
    });
  };

  return {
    name: 'geekslides-hmr',
    enforce: 'pre',

    configureServer(srv: ViteDevServer) {
      server = srv;
      root = srv.config.root;

      srv.middlewares.use('/api/slide-map', (req, res, next) => {
        if (req.method === 'GET') {
          if (!slideMapCache) {
            res.statusCode = 404;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
              error: 'Slide map not available. Load the deck in a browser first so it can publish the current mapping.',
            }));
            return;
          }

          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(slideMapCache));
          return;
        }

        if (req.method === 'POST') {
          const chunks: Buffer[] = [];
          req.on('data', (chunk: Buffer) => chunks.push(chunk));
          req.on('end', () => {
            try {
              const body = Buffer.concat(chunks).toString('utf8');
              const parsed = JSON.parse(body) as unknown;
              if (!Array.isArray(parsed)) {
                res.statusCode = 400;
                res.end('Expected slide map array');
                return;
              }

              slideMapCache = parsed.flatMap((entry) => {
                if (typeof entry !== 'object' || entry === null) {
                  return [];
                }
                const record = entry as Record<string, unknown>;
                if (
                  typeof record['slideIndex'] !== 'number' ||
                  typeof record['sourceLineStart'] !== 'number' ||
                  typeof record['sourceLineEnd'] !== 'number' ||
                  typeof record['id'] !== 'string'
                ) {
                  return [];
                }

                return [{
                  slideIndex: record['slideIndex'],
                  sourceLineStart: record['sourceLineStart'],
                  sourceLineEnd: record['sourceLineEnd'],
                  id: record['id'],
                }];
              });

              res.statusCode = 204;
              res.end();
            } catch {
              res.statusCode = 400;
              res.end('Invalid JSON');
            }
          });
          return;
        }

        next();
      });

      srv.middlewares.use('/__geekslides_watch', (req, res, next) => {
        if (req.method === 'POST') {
          const chunks: Buffer[] = [];
          req.on('data', (chunk: Buffer) => chunks.push(chunk));
          req.on('end', () => {
            try {
              const bodyText = Buffer.concat(chunks).toString('utf8');
              const parsed = JSON.parse(bodyText) as { files?: unknown };
              const files = Array.isArray(parsed.files) ? parsed.files : [];

              for (const file of files) {
                if (typeof file !== 'string' || !WATCHED_EXTENSIONS.test(file)) {
                  continue;
                }

                const watchedPath = toWatchedFilePath(file, root);
                if (!watchedPath) {
                  continue;
                }

                srv.watcher.add(watchedPath);
              }

              res.statusCode = 204;
              res.end();
            } catch {
              res.statusCode = 400;
              res.end();
            }
          });
          return;
        }

        next();
      });

      srv.middlewares.use((req, _res, next) => {
        const requestPath = req.url?.split('?')[0] ?? '';
        if (WATCHED_EXTENSIONS.test(requestPath)) {
          const watchedPath = toWatchedFilePath(requestPath, root);
          if (watchedPath) {
            srv.watcher.add(watchedPath);
          }
        }
        next();
      });

      srv.watcher.on('change', sendContentUpdate);
    },

    handleHotUpdate(ctx: HmrContext) {
      const fileType = classifyFile(ctx.file);

      if (!fileType || !WATCHED_EXTENSIONS.test(ctx.file)) {
        return; // Let Vite handle non-content files
      }

      // Return empty array to prevent Vite's default full-page reload
      return [];
    },
  };
}
