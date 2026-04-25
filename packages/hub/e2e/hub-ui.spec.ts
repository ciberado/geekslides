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

// ────────────────────────────────────────────────────────────
// Dashboard: filter + layout toggle (requires built SPA client)
// ────────────────────────────────────────────────────────────

test.describe('Dashboard filter and layout toggle', () => {
  const DOMAIN = '127.0.0.1';
  const USER_ID = 'filter-test-user';

  test.beforeAll(async () => {
    // Seed a user and three presentations with distinct titles
    const { upsertUser } = await import('../src/server/services/user.ts');
    const { createPresentation, generateSlug } = await import('../src/server/services/presentation.ts');
    const { users } = await import('../src/server/db/schema.ts');
    const { eq } = await import('drizzle-orm');
    const { createDatabase } = await import('../src/server/db/index.ts');
    const db = createDatabase(`${ctx.tmpDir}/hub.db`);

    upsertUser(db, {
      provider: 'github',
      providerId: USER_ID,
      email: 'filteruser@test.com',
      name: 'Filter User',
      avatarUrl: null,
    }, '');

    const existing = db.select().from(users).where(eq(users.email, 'filteruser@test.com')).get();
    if (existing) {
      db.update(users)
        .set({ id: USER_ID, role: 'user', status: 'approved' })
        .where(eq(users.email, 'filteruser@test.com'))
        .run();
    }

    const titles = ['AWS Cloud Architecture', 'Kubernetes Deep Dive', 'Docker Compose Tips'];
    for (const title of titles) {
      await createPresentation(db, {
        userId: USER_ID,
        title,
        slug: generateSlug(title),
        files: [
          { path: 'config.json', data: Buffer.from('{"content":"README.md"}') },
          { path: 'README.md', data: Buffer.from(`# ${title}`) },
        ],
        repoDir: `${ctx.tmpDir}/repos`,
      });
    }
  });

  async function openDashboard(page: import('@playwright/test').Page): Promise<void> {
    const token = ctx.signToken({ sub: USER_ID, role: 'user', status: 'approved' });
    await page.context().addCookies([{
      name: 'hub_access',
      value: token,
      domain: DOMAIN,
      path: '/hub',
      httpOnly: true,
      sameSite: 'Lax',
    }]);
    await page.goto(`${ctx.baseUrl}/hub/`);
    // Wait for the toolbar (shown only when presentations exist)
    await expect(page.locator('.toolbar')).toBeVisible({ timeout: 10000 });
  }

  test('shows all presentations on load', async ({ page }) => {
    await openDashboard(page);
    await expect(page.locator('.card-title')).toHaveCount(3);
  });

  test('filter hides non-matching cards', async ({ page }) => {
    await openDashboard(page);
    await page.getByPlaceholder('Filter presentations…').fill('aws');
    await expect(page.locator('.card-title')).toHaveCount(1);
    await expect(page.locator('.card-title')).toHaveText('AWS Cloud Architecture');
  });

  test('fuzzy filter: sparse characters match', async ({ page }) => {
    await openDashboard(page);
    // 'kdd' matches 'Kubernetes Deep Dive'
    await page.getByPlaceholder('Filter presentations…').fill('kdd');
    await expect(page.locator('.card-title')).toHaveCount(1);
    await expect(page.locator('.card-title')).toHaveText('Kubernetes Deep Dive');
  });

  test('filter shows no-results message when nothing matches', async ({ page }) => {
    await openDashboard(page);
    await page.getByPlaceholder('Filter presentations…').fill('zzznomatch');
    await expect(page.locator('.card-title')).toHaveCount(0);
    await expect(page.locator('.no-results')).toBeVisible();
  });

  test('clearing the filter restores all presentations', async ({ page }) => {
    await openDashboard(page);
    const input = page.getByPlaceholder('Filter presentations…');
    await input.fill('aws');
    await expect(page.locator('.card-title')).toHaveCount(1);
    await input.fill('');
    await expect(page.locator('.card-title')).toHaveCount(3);
  });

  test('switching to list view renders list rows instead of cards', async ({ page }) => {
    await openDashboard(page);
    // Cards visible by default
    await expect(page.locator('.card')).toHaveCount(3);
    await expect(page.locator('.list-row')).toHaveCount(0);

    // Click list view button (title="List view")
    await page.getByTitle('List view').click();
    await expect(page.locator('.list-row')).toHaveCount(3);
    await expect(page.locator('.card')).toHaveCount(0);
  });

  test('filter works in list view too', async ({ page }) => {
    await openDashboard(page);
    await page.getByTitle('List view').click();
    await page.getByPlaceholder('Filter presentations…').fill('docker');
    await expect(page.locator('.list-row')).toHaveCount(1);
    await expect(page.locator('.list-row-title')).toHaveText('Docker Compose Tips');
  });

  test('switching back to card view restores cards', async ({ page }) => {
    await openDashboard(page);
    await page.getByTitle('List view').click();
    await expect(page.locator('.list-row')).toHaveCount(3);
    await page.getByTitle('Card view').click();
    await expect(page.locator('.card')).toHaveCount(3);
    await expect(page.locator('.list-row')).toHaveCount(0);
  });
});
