import Fastify, { type FastifyInstance } from 'fastify';
import fastifyCookie from '@fastify/cookie';
import fastifyCors from '@fastify/cors';
import fastifyJwt from '@fastify/jwt';
import fastifyMultipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import { resolve } from 'node:path';
import { mkdirSync, existsSync } from 'node:fs';
import { createDatabase } from './db/index.ts';
import { migrate } from './db/migrate.ts';
import authPlugin from './plugins/auth.ts';
import { registerAuthRoutes } from './routes/auth.ts';
import { registerPresentationRoutes } from './routes/presentations.ts';
import { registerShareRoutes } from './routes/shares.ts';
import { registerSearchRoutes } from './routes/search.ts';
import { registerLaunchRoutes } from './routes/launch.ts';
import { registerAdminRoutes } from './routes/admin.ts';
import { registerAnalyticsRoutes } from './routes/analytics.ts';
import { type HubServerOptions, defaultOptions } from './config.ts';

export type { HubServerOptions } from './config.ts';

export async function createHubServer(
  overrides: Partial<HubServerOptions> = {},
): Promise<FastifyInstance> {
  const options: HubServerOptions = { ...defaultOptions, ...overrides };

  // Ensure data directories exist
  const dbDir = resolve(options.dbPath, '..');
  if (!existsSync(dbDir)) mkdirSync(dbDir, { recursive: true });
  if (!existsSync(options.repoDir)) mkdirSync(options.repoDir, { recursive: true });

  const db = createDatabase(options.dbPath);
  migrate(db);

  const fastify = Fastify({ logger: true });

  await fastify.register(fastifyCors, {
    origin: true,
    credentials: true,
  });

  await fastify.register(fastifyCookie);

  await fastify.register(fastifyJwt, {
    secret: options.jwtSecret || 'dev-secret-change-in-production',
    cookie: { cookieName: 'hub_access', signed: false },
  });

  await fastify.register(fastifyMultipart, {
    limits: { fileSize: 50 * 1024 * 1024 },
  });

  await fastify.register(authPlugin);

  // Serve built Lit client.
  // Use __dirname (CJS bundle) with a fallback to import.meta.dirname (native ESM / dev).
  // In the CJS bundle __dirname === /app, and dist/client is at /app/dist/client.
  // In dev (ESM), this file is packages/hub/src/server/index.ts → ../../dist/client is correct.
  const _dirname: string = typeof __dirname !== 'undefined'
    ? __dirname
    : import.meta.dirname;
  const clientRelPath = typeof __dirname !== 'undefined' ? 'dist/client' : '../../dist/client';
  const clientDir = resolve(_dirname, clientRelPath);
  if (existsSync(clientDir)) {
    await fastify.register(fastifyStatic, {
      root: clientDir,
      prefix: '/hub/',
      wildcard: false,
    });

    // SPA fallback
    fastify.setNotFoundHandler(async (request, reply) => {
      if (request.url.startsWith('/hub/api/')) {
        await reply.status(404).send({ error: 'Not found' });
        return;
      }
      if (request.url.startsWith('/hub')) {
        await reply.sendFile('index.html');
        return;
      }
      await reply.status(404).send({ error: 'Not found' });
    });
  }

  // Health check — used by Docker HEALTHCHECK and bundle smoke test
  fastify.get('/healthz', async (_request, reply) => {
    await reply.send({ ok: true });
  });

  // Register routes
  registerAuthRoutes(fastify, db, options);
  registerPresentationRoutes(fastify, db, options);
  registerShareRoutes(fastify, db);
  registerSearchRoutes(fastify, db);
  registerLaunchRoutes(fastify, db, options);
  registerAdminRoutes(fastify, db);
  registerAnalyticsRoutes(fastify, db);

  return fastify;
}

// Direct execution — matches both dev (`hub/src/server/index.ts`) and
// the bundled output (`index.cjs`) produced by the Docker build.
const isDirectRun = process.argv[1]?.includes('hub') === true
  || process.argv[1]?.endsWith('index.cjs') === true;
if (isDirectRun) {
  void createHubServer({
    port: Number(process.env['PORT']) || 3000,
    host: process.env['HOST'] ?? '0.0.0.0',
    dbPath: process.env['DB_PATH'] ?? './data/hub.db',
    repoDir: process.env['REPO_DIR'] ?? './data/repos',
    serverBaseUrl: process.env['SERVER_BASE_URL'] ?? 'http://localhost:1234',
    viewerBaseUrl: process.env['VIEWER_BASE_URL'] ?? 'http://localhost:5173',
    githubClientId: process.env['GITHUB_CLIENT_ID'] ?? '',
    githubClientSecret: process.env['GITHUB_CLIENT_SECRET'] ?? '',
    googleClientId: process.env['GOOGLE_CLIENT_ID'] ?? '',
    googleClientSecret: process.env['GOOGLE_CLIENT_SECRET'] ?? '',
    adminEmail: process.env['ADMIN_EMAIL'] ?? '',
    jwtSecret: process.env['JWT_SECRET'] ?? '',
    cookieDomain: process.env['COOKIE_DOMAIN'] ?? 'localhost',
    devMode: process.env['HUB_DEV_MODE'] === 'true'
      || (process.env['NODE_ENV'] !== 'production'
        && !process.env['GITHUB_CLIENT_ID']
        && !process.env['GOOGLE_CLIENT_ID']),
  }).then(async (server) => {
    await server.listen({
      port: Number(process.env['PORT']) || 3000,
      host: process.env['HOST'] ?? '0.0.0.0',
    });
  });
}
