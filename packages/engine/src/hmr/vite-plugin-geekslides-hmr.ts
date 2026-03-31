/**
 * Vite plugin for GeekSlides HMR.
 *
 * Intercepts .md, .json, and .css file changes and sends targeted
 * WebSocket messages to the client instead of triggering full page reloads.
 */

import type { Plugin, ViteDevServer, HmrContext } from 'vite';
import { relative } from 'node:path';

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

export function geekSlidesHmr(): Plugin {
  let server: ViteDevServer | undefined;
  let root = '';

  return {
    name: 'geekslides-hmr',
    enforce: 'pre',

    configureServer(srv: ViteDevServer) {
      server = srv;
      root = srv.config.root;
    },

    handleHotUpdate(ctx: HmrContext) {
      const fileType = classifyFile(ctx.file);

      if (!fileType || !WATCHED_EXTENSIONS.test(ctx.file)) {
        return; // Let Vite handle non-content files
      }

      const relativePath = relative(root, ctx.file);

      const payload: ContentUpdatePayload = {
        file: relativePath,
        type: fileType,
        timestamp: Date.now(),
      };

      server?.ws.send({
        type: 'custom',
        event: HMR_EVENT,
        data: payload,
      });

      // Return empty array to prevent Vite's default full-page reload
      return [];
    },
  };
}
