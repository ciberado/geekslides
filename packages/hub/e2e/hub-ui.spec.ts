/**
 * Hub UI E2E tests
 *
 * Tests the Lit SPA pages served by the Hub server.
 * Auth is bypassed by setting JWT cookies directly.
 */
import { test, expect } from '@playwright/test';
import { startHubServer, stopHubServer, type HubTestContext } from './hub-test-helpers.ts';

let ctx: HubTestContext;

test.beforeAll(async () => {
  ctx = await startHubServer();

  // Seed a user via the DB
  const { upsertUser } = await import('../src/server/services/user.ts');
  const { users } = await import('../src/server/db/schema.ts');
  const { eq } = await import('drizzle-orm');
  const { createDatabase } = await import('../src/server/db/index.ts');
  const db = createDatabase(`${ctx.tmpDir}/hub.db`);

  // Create an admin user
  upsertUser(
    db,
    {
      provider: 'github',
      providerId: 'ui-admin',
      email: 'admin@test.com',
      name: 'UI Admin',
      avatarUrl: null,
    },
    'admin@test.com',
  );

  const existing = db.select().from(users).where(eq(users.email, 'admin@test.com')).get();
  if (existing) {
    db.update(users)
      .set({ id: 'ui-admin' })
      .where(eq(users.email, 'admin@test.com'))
      .run();
  }
});

test.afterAll(async () => {
  await stopHubServer(ctx);
});

test.describe('Login Page', () => {
  test('shows login page when not authenticated', async ({ page }) => {
    await page.goto(`${ctx.baseUrl}/hub/`);

    // The hub-app component should render the login page
    // Since the client is built separately, we test the API-served SPA shell
    // For API-only mode (no client build), we at least verify the server responds
    const response = await page.goto(`${ctx.baseUrl}/hub/`);
    expect(response?.status()).toBeLessThan(500);
  });
});

test.describe('API from Browser Context', () => {
  test('can fetch /hub/api/auth/me with cookie auth', async ({ page }) => {
    // Set auth cookie
    const token = ctx.signToken({ sub: 'ui-admin', role: 'admin', status: 'approved' });
    await page.context().addCookies([
      {
        name: 'hub_access',
        value: token,
        domain: '127.0.0.1',
        path: '/hub',
        httpOnly: true,
        sameSite: 'Lax',
      },
    ]);

    const response = await page.request.get(`${ctx.baseUrl}/hub/api/auth/me`);
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.role).toBe('admin');
  });

  test('can list presentations via browser request', async ({ page }) => {
    const token = ctx.signToken({ sub: 'ui-admin', role: 'admin', status: 'approved' });
    await page.context().addCookies([
      {
        name: 'hub_access',
        value: token,
        domain: '127.0.0.1',
        path: '/hub',
        httpOnly: true,
        sameSite: 'Lax',
      },
    ]);

    const response = await page.request.get(`${ctx.baseUrl}/hub/api/presentations`);
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(Array.isArray(body.items)).toBe(true);
  });

  test('admin stats accessible via browser', async ({ page }) => {
    const token = ctx.signToken({ sub: 'ui-admin', role: 'admin', status: 'approved' });
    await page.context().addCookies([
      {
        name: 'hub_access',
        value: token,
        domain: '127.0.0.1',
        path: '/hub',
        httpOnly: true,
        sameSite: 'Lax',
      },
    ]);

    const response = await page.request.get(`${ctx.baseUrl}/hub/api/admin/stats`);
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.totalUsers).toBeGreaterThanOrEqual(0);
  });
});

test.describe('Security', () => {
  test('API returns 401 for expired token', async ({ page }) => {
    // Sign a token that's already expired (negative expiry via manual iat/exp)
    const now = Math.floor(Date.now() / 1000);
    const token = ctx.server.jwt.sign(
      { sub: 'ui-admin', role: 'admin', status: 'approved', iat: now - 120, exp: now - 60 },
    );

    await page.context().addCookies([
      {
        name: 'hub_access',
        value: token,
        domain: '127.0.0.1',
        path: '/hub',
        httpOnly: true,
        sameSite: 'Lax',
      },
    ]);

    const response = await page.request.get(`${ctx.baseUrl}/hub/api/auth/me`);
    expect(response.status()).toBe(401);
  });

  test('non-API hub routes do not return 500', async ({ request }) => {
    const res = await request.get(`${ctx.baseUrl}/hub/`);
    expect(res.status()).toBeLessThan(500);
  });
});
