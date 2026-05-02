import { PassThrough } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';
import type { ViteDevServer } from 'vite';
import { geekSlidesHmr } from '../../src/hmr/vite-plugin-geekslides-hmr.ts';

type Middleware = (req: PassThrough & { method?: string; url?: string }, res: MockResponse, next: () => void) => void;

class MockResponse {
  statusCode = 200;
  headers = new Map<string, string>();
  body = '';
  ended = false;

  setHeader(name: string, value: string): void {
    this.headers.set(name.toLowerCase(), value);
  }

  end(body?: string): void {
    if (body) {
      this.body += body;
    }
    this.ended = true;
  }
}

function createMockServer(): {
  server: ViteDevServer;
  dispatch: (method: string, url: string, body?: string) => Promise<MockResponse>;
} {
  const middlewares: Middleware[] = [];
  const changeListeners: Array<(filePath: string) => void> = [];

  const server = {
    config: { root: '/workspaces/geekslides/packages/cli/app' },
    middlewares: {
      use(pathOrMiddleware: string | Middleware, maybeMiddleware?: Middleware) {
        if (typeof pathOrMiddleware === 'string') {
          const path = pathOrMiddleware;
          const middleware = maybeMiddleware;
          if (!middleware) {
            return;
          }
          middlewares.push((req, res, next) => {
            if ((req.url ?? '').startsWith(path)) {
              middleware(req, res, next);
              return;
            }
            next();
          });
          return;
        }
        middlewares.push(pathOrMiddleware);
      },
    },
    watcher: {
      add: vi.fn(),
      on: vi.fn((event: string, cb: (filePath: string) => void) => {
        if (event === 'change') {
          changeListeners.push(cb);
        }
      }),
    },
    ws: {
      send: vi.fn(),
    },
  } as unknown as ViteDevServer;

  const dispatch = async (method: string, url: string, body?: string): Promise<MockResponse> => {
    const req = new PassThrough() as PassThrough & { method?: string; url?: string };
    req.method = method;
    req.url = url;

    const res = new MockResponse();

    let index = 0;
    const next = (): void => {
      const middleware = middlewares[index++];
      if (middleware) {
        middleware(req, res, next);
      }
    };

    next();

    if (body !== undefined) {
      req.write(body);
    }
    req.end();

    await new Promise<void>((resolve) => {
      setImmediate(resolve);
    });

    return res;
  };

  return { server, dispatch };
}

describe('geekslides hmr vite plugin', () => {
  it('stores and returns slide map payloads', async () => {
    const plugin = geekSlidesHmr();
    const { server, dispatch } = createMockServer();

    plugin.configureServer?.(server);

    const payload = JSON.stringify([
      { slideIndex: 0, sourceLineStart: 1, sourceLineEnd: 5, id: 'intro' },
    ]);

    const postResponse = await dispatch('POST', '/api/slide-map', payload);
    const getResponse = await dispatch('GET', '/api/slide-map');

    expect(postResponse.statusCode).toBe(204);
    expect(getResponse.statusCode).toBe(200);
    expect(getResponse.headers.get('content-type')).toBe('application/json');
    expect(JSON.parse(getResponse.body)).toEqual([
      { slideIndex: 0, sourceLineStart: 1, sourceLineEnd: 5, id: 'intro' },
    ]);
  });

  it('returns 404 before the browser publishes any slide map', async () => {
    const plugin = geekSlidesHmr();
    const { server, dispatch } = createMockServer();

    plugin.configureServer?.(server);

    const response = await dispatch('GET', '/api/slide-map');

    expect(response.statusCode).toBe(404);
    expect(response.body).toContain('Slide map not available');
  });
});
