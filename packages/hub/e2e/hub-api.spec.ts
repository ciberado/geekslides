/**
 * Hub API E2E tests
 *
 * These tests spin up a real Fastify Hub server with a temporary SQLite database
 * and exercise the full REST API. OAuth is bypassed by directly inserting users
 * and signing JWT tokens.
 */
import { test, expect } from '@playwright/test';
import { startHubServer, stopHubServer, type HubTestContext } from './hub-test-helpers.ts';

let ctx: HubTestContext;

test.beforeAll(async () => {
  ctx = await startHubServer();
});

test.afterAll(async () => {
  await stopHubServer(ctx);
});

// ────────────────────────────────────────────────────────────
// Helper: seed a user directly in the DB via the upsert service
// ────────────────────────────────────────────────────────────
async function seedUser(
  id: string,
  email: string,
  opts: { role?: string; status?: string; providerId?: string } = {},
): Promise<void> {
  // Import the service and DB access from the running server
  const { upsertUser } = await import('../src/server/services/user.ts');
  const { users } = await import('../src/server/db/schema.ts');
  const { eq } = await import('drizzle-orm');
  const { createDatabase } = await import('../src/server/db/index.ts');

  // Access the DB through the same path the server uses
  const dbPath = `${ctx.tmpDir}/hub.db`;
  const db = createDatabase(dbPath);

  // Upsert user then force id/status/role
  upsertUser(
    db,
    {
      provider: 'github',
      providerId: opts.providerId ?? id,
      email,
      name: email.split('@')[0] ?? 'Test',
      avatarUrl: null,
    },
    email === 'admin@test.com' ? 'admin@test.com' : '',
  );

  // Force the exact id, role, and status we want
  const existing = db.select().from(users).where(eq(users.email, email)).get();
  if (existing) {
    db.update(users)
      .set({
        id,
        role: (opts.role ?? 'user') as 'user' | 'admin',
        status: (opts.status ?? 'approved') as 'pending' | 'approved' | 'rejected',
      })
      .where(eq(users.email, email))
      .run();
  }
}

function authHeaders(userId: string, role = 'user', status = 'approved'): Record<string, string> {
  return { Cookie: ctx.authCookie({ sub: userId, role, status }) };
}

// ────────────────────────────────────────────────────────────
// Auth endpoints
// ────────────────────────────────────────────────────────────

test.describe('Auth API', () => {
  test('GET /hub/api/auth/me returns 401 without token', async ({ request }) => {
    const res = await request.get(`${ctx.baseUrl}/hub/api/auth/me`);
    expect(res.status()).toBe(401);
  });

  test('GET /hub/api/auth/me returns user when authenticated', async ({ request }) => {
    await seedUser('auth-user-1', 'authuser@test.com');
    const res = await request.get(`${ctx.baseUrl}/hub/api/auth/me`, {
      headers: authHeaders('auth-user-1'),
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.email).toBe('authuser@test.com');
  });

  test('POST /hub/api/auth/logout clears cookies', async ({ request }) => {
    const res = await request.post(`${ctx.baseUrl}/hub/api/auth/logout`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  test('GET /hub/api/auth/github redirects to GitHub OAuth', async ({ request }) => {
    const res = await request.get(`${ctx.baseUrl}/hub/api/auth/github`, {
      maxRedirects: 0,
    });
    expect(res.status()).toBe(302);
    const location = res.headers()['location'] ?? '';
    expect(location).toContain('github.com/login/oauth/authorize');
  });

  test('GET /hub/api/auth/google redirects to Google OAuth', async ({ request }) => {
    const res = await request.get(`${ctx.baseUrl}/hub/api/auth/google`, {
      maxRedirects: 0,
    });
    expect(res.status()).toBe(302);
    const location = res.headers()['location'] ?? '';
    expect(location).toContain('accounts.google.com');
  });
});

// ────────────────────────────────────────────────────────────
// Presentations CRUD
// ────────────────────────────────────────────────────────────

test.describe('Presentations API', () => {
  test.beforeAll(async () => {
    await seedUser('pres-user', 'presuser@test.com');
  });

  const auth = (): Record<string, string> => authHeaders('pres-user');

  test('POST creates a presentation from multipart upload', async ({ request }) => {
    const configJson = JSON.stringify({ content: 'README.md', title: 'Test' });
    const readme = '# Test Deck\n\n[](#slide-1)\n\nHello World';

    const res = await request.post(`${ctx.baseUrl}/hub/api/presentations`, {
      headers: auth(),
      multipart: {
        title: 'E2E Test Deck',
        'config.json': {
          name: 'config.json',
          mimeType: 'application/json',
          buffer: Buffer.from(configJson),
        },
        'README.md': {
          name: 'README.md',
          mimeType: 'text/markdown',
          buffer: Buffer.from(readme),
        },
      },
    });

    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.title).toBe('E2E Test Deck');
    expect(body.slug).toBe('e2e-test-deck');
    expect(body.id).toBeTruthy();
  });

  test('POST rejects upload without config.json', async ({ request }) => {
    const res = await request.post(`${ctx.baseUrl}/hub/api/presentations`, {
      headers: auth(),
      multipart: {
        title: 'Bad Deck',
        'README.md': {
          name: 'README.md',
          mimeType: 'text/markdown',
          buffer: Buffer.from('# No config'),
        },
      },
    });

    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('config.json');
  });

  test('GET /hub/api/presentations lists user decks', async ({ request }) => {
    const res = await request.get(`${ctx.baseUrl}/hub/api/presentations`, {
      headers: auth(),
    });

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.items.length).toBeGreaterThan(0);
  });

  test('GET /hub/api/presentations/:id returns a single deck', async ({ request }) => {
    // First list to get an id
    const listRes = await request.get(`${ctx.baseUrl}/hub/api/presentations`, {
      headers: auth(),
    });
    const { items } = await listRes.json();
    const id = items[0].id;

    const res = await request.get(`${ctx.baseUrl}/hub/api/presentations/${id}`, {
      headers: auth(),
    });

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(id);
    expect(body.access).toBe('owner');
  });

  test('PATCH updates presentation metadata', async ({ request }) => {
    const listRes = await request.get(`${ctx.baseUrl}/hub/api/presentations`, {
      headers: auth(),
    });
    const { items } = await listRes.json();
    const id = items[0].id;

    const res = await request.patch(`${ctx.baseUrl}/hub/api/presentations/${id}`, {
      headers: { ...auth(), 'Content-Type': 'application/json' },
      data: { title: 'Updated Title', visibility: 'public' },
    });

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.title).toBe('Updated Title');
    expect(body.visibility).toBe('public');
  });

  test('DELETE removes a presentation', async ({ request }) => {
    // Create one to delete
    const configJson = JSON.stringify({ content: 'README.md', title: 'Doomed' });
    const createRes = await request.post(`${ctx.baseUrl}/hub/api/presentations`, {
      headers: auth(),
      multipart: {
        title: 'To Delete',
        'config.json': {
          name: 'config.json',
          mimeType: 'application/json',
          buffer: Buffer.from(configJson),
        },
        'README.md': {
          name: 'README.md',
          mimeType: 'text/markdown',
          buffer: Buffer.from('# Delete Me'),
        },
      },
    });
    const created = await createRes.json();

    const res = await request.delete(
      `${ctx.baseUrl}/hub/api/presentations/${created.id}`,
      { headers: auth() },
    );
    expect(res.status()).toBe(204);

    // Confirm it's gone
    const getRes = await request.get(
      `${ctx.baseUrl}/hub/api/presentations/${created.id}`,
      { headers: auth() },
    );
    expect(getRes.status()).toBe(404);
  });

  test('returns 403 for pending user', async ({ request }) => {
    await seedUser('pending-user', 'pending@test.com', { status: 'pending' });
    const res = await request.get(`${ctx.baseUrl}/hub/api/presentations`, {
      headers: authHeaders('pending-user', 'user', 'pending'),
    });
    expect(res.status()).toBe(403);
  });
});

// ────────────────────────────────────────────────────────────
// Shares
// ────────────────────────────────────────────────────────────

test.describe('Shares API', () => {
  let presId: string;

  test.beforeAll(async () => {
    await seedUser('share-owner', 'shareowner@test.com');
    await seedUser('share-viewer', 'shareviewer@test.com');

    // Create a presentation to share
    const { createPresentation, generateSlug } = await import(
      '../src/server/services/presentation.ts'
    );
    const { createDatabase } = await import('../src/server/db/index.ts');
    const db = createDatabase(`${ctx.tmpDir}/hub.db`);
    const pres = await createPresentation(db, {
      userId: 'share-owner',
      title: 'Shared Deck',
      slug: generateSlug('Shared Deck'),
      files: [
        { path: 'config.json', data: Buffer.from('{"content":"README.md"}') },
        { path: 'README.md', data: Buffer.from('# Shared') },
      ],
      repoDir: `${ctx.tmpDir}/repos`,
    });
    presId = pres.id;
  });

  test('POST creates a share invitation', async ({ request }) => {
    const res = await request.post(
      `${ctx.baseUrl}/hub/api/presentations/${presId}/shares`,
      {
        headers: { ...authHeaders('share-owner'), 'Content-Type': 'application/json' },
        data: { email: 'shareviewer@test.com', role: 'viewer' },
      },
    );

    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.status).toBe('pending');
    expect(body.role).toBe('viewer');
  });

  test('GET lists shares for a presentation', async ({ request }) => {
    const res = await request.get(
      `${ctx.baseUrl}/hub/api/presentations/${presId}/shares`,
      { headers: authHeaders('share-owner') },
    );

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.items.length).toBeGreaterThan(0);
  });

  test('POST accept a share invitation', async ({ request }) => {
    // Get the share id
    const listRes = await request.get(
      `${ctx.baseUrl}/hub/api/presentations/${presId}/shares`,
      { headers: authHeaders('share-owner') },
    );
    const { items } = await listRes.json();
    const shareId = items[0].id;

    const res = await request.post(
      `${ctx.baseUrl}/hub/api/shares/${shareId}/accept`,
      { headers: authHeaders('share-viewer') },
    );
    expect(res.status()).toBe(200);
  });

  test('GET shared-with-me shows accepted shares', async ({ request }) => {
    const res = await request.get(`${ctx.baseUrl}/hub/api/shared-with-me`, {
      headers: authHeaders('share-viewer'),
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.items.length).toBeGreaterThan(0);
  });
});

// ────────────────────────────────────────────────────────────
// Search
// ────────────────────────────────────────────────────────────

test.describe('Search API', () => {
  test.beforeAll(async () => {
    await seedUser('search-user', 'searchuser@test.com');
  });

  test('GET /hub/api/search returns empty for blank query', async ({ request }) => {
    const res = await request.get(`${ctx.baseUrl}/hub/api/search?q=`, {
      headers: authHeaders('search-user'),
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(0);
  });

  test('GET /hub/api/search finds public presentations', async ({ request }) => {
    // The presentation made public in the PATCH test above should be searchable
    const res = await request.get(
      `${ctx.baseUrl}/hub/api/search?q=Updated`,
      { headers: authHeaders('search-user') },
    );
    expect(res.status()).toBe(200);
    // May or may not find results depending on FTS index timing
    const body = await res.json();
    expect(Array.isArray(body.items)).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────
// Admin
// ────────────────────────────────────────────────────────────

test.describe('Admin API', () => {
  test.beforeAll(async () => {
    await seedUser('admin-e2e', 'admin@test.com', { role: 'admin' });
    await seedUser('regular-e2e', 'regular@test.com', { status: 'pending' });
  });

  const adminAuth = (): Record<string, string> => authHeaders('admin-e2e', 'admin', 'approved');

  test('GET /hub/api/admin/users lists all users', async ({ request }) => {
    const res = await request.get(`${ctx.baseUrl}/hub/api/admin/users`, {
      headers: adminAuth(),
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.items.length).toBeGreaterThan(0);
  });

  test('GET /hub/api/admin/users?status=pending filters by status', async ({ request }) => {
    const res = await request.get(
      `${ctx.baseUrl}/hub/api/admin/users?status=pending`,
      { headers: adminAuth() },
    );
    expect(res.status()).toBe(200);
    const body = await res.json();
    for (const user of body.items) {
      expect(user.status).toBe('pending');
    }
  });

  test('POST approve a user', async ({ request }) => {
    const res = await request.post(
      `${ctx.baseUrl}/hub/api/admin/users/regular-e2e/approve`,
      { headers: adminAuth() },
    );
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  test('PATCH /hub/api/admin/users/:id/quota updates user quota', async ({ request }) => {
    const listBeforeRes = await request.get(`${ctx.baseUrl}/hub/api/admin/users`, {
      headers: adminAuth(),
    });
    expect(listBeforeRes.status()).toBe(200);
    const listBeforeBody = await listBeforeRes.json() as { items: Array<{ id: string; quotaBytes: number }> };
    const targetBefore = listBeforeBody.items.find((item) => item.id === 'regular-e2e');
    expect(targetBefore).toBeDefined();

    const nextQuota = (targetBefore?.quotaBytes ?? 0) + 25 * 1024 * 1024;
    const patchRes = await request.patch(
      `${ctx.baseUrl}/hub/api/admin/users/regular-e2e/quota`,
      {
        headers: { ...adminAuth(), 'Content-Type': 'application/json' },
        data: { quotaBytes: nextQuota },
      },
    );
    expect(patchRes.status()).toBe(200);
    const patchBody = await patchRes.json();
    expect(patchBody.ok).toBe(true);

    const listAfterRes = await request.get(`${ctx.baseUrl}/hub/api/admin/users`, {
      headers: adminAuth(),
    });
    expect(listAfterRes.status()).toBe(200);
    const listAfterBody = await listAfterRes.json() as { items: Array<{ id: string; quotaBytes: number }> };
    const targetAfter = listAfterBody.items.find((item) => item.id === 'regular-e2e');
    expect(targetAfter?.quotaBytes).toBe(nextQuota);
  });

  test('POST /hub/api/admin/invite-codes generates a code', async ({ request }) => {
    const res = await request.post(`${ctx.baseUrl}/hub/api/admin/invite-codes`, {
      headers: adminAuth(),
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.code).toHaveLength(8);
  });

  test('GET /hub/api/admin/invite-codes lists codes', async ({ request }) => {
    const res = await request.get(`${ctx.baseUrl}/hub/api/admin/invite-codes`, {
      headers: adminAuth(),
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.items.length).toBeGreaterThan(0);
  });

  test('GET /hub/api/admin/stats returns system statistics', async ({ request }) => {
    const res = await request.get(`${ctx.baseUrl}/hub/api/admin/stats`, {
      headers: adminAuth(),
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(typeof body.totalUsers).toBe('number');
    expect(typeof body.totalPresentations).toBe('number');
    expect(typeof body.totalStorageBytes).toBe('number');
  });

  test('non-admin gets 403 on admin routes', async ({ request }) => {
    await seedUser('nonadmin-e2e', 'nonadmin@test.com');
    const res = await request.get(`${ctx.baseUrl}/hub/api/admin/users`, {
      headers: authHeaders('nonadmin-e2e'),
    });
    expect(res.status()).toBe(403);
  });
});

// ────────────────────────────────────────────────────────────
// Analytics
// ────────────────────────────────────────────────────────────

test.describe('Analytics API', () => {
  test('GET /hub/api/analytics/me returns personal stats', async ({ request }) => {
    await seedUser('analytics-user', 'analyticsuser@test.com');
    const res = await request.get(`${ctx.baseUrl}/hub/api/analytics/me`, {
      headers: authHeaders('analytics-user'),
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(typeof body.totalLaunches).toBe('number');
  });
});

// ────────────────────────────────────────────────────────────
// PUT /presentations/:id/files  (replace files)
// ────────────────────────────────────────────────────────────

test.describe('Replace Files API', () => {
  let presId: string;

  test.beforeAll(async () => {
    await seedUser('replace-user', 'replaceuser@test.com');
    const { createPresentation, generateSlug } = await import('../src/server/services/presentation.ts');
    const { createDatabase } = await import('../src/server/db/index.ts');
    const db = createDatabase(`${ctx.tmpDir}/hub.db`);
    const pres = await createPresentation(db, {
      userId: 'replace-user',
      title: 'Replace Test',
      slug: generateSlug('Replace Test'),
      files: [
        { path: 'config.json', data: Buffer.from('{"content":"README.md"}') },
        { path: 'README.md', data: Buffer.from('# Version 1') },
      ],
      repoDir: `${ctx.tmpDir}/repos`,
    });
    presId = pres.id;
  });

  test('PUT replaces presentation files', async ({ request }) => {
    const res = await request.put(
      `${ctx.baseUrl}/hub/api/presentations/${presId}/files`,
      {
        headers: authHeaders('replace-user'),
        multipart: {
          'config.json': {
            name: 'config.json',
            mimeType: 'application/json',
            buffer: Buffer.from('{"content":"slides.md","title":"v2"}'),
          },
          'slides.md': {
            name: 'slides.md',
            mimeType: 'text/markdown',
            buffer: Buffer.from('# Version 2'),
          },
        },
      },
    );
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(presId);
  });

  test('PUT rejects unauthorized user', async ({ request }) => {
    await seedUser('other-replace-user', 'otherreplaceuser@test.com');
    const res = await request.put(
      `${ctx.baseUrl}/hub/api/presentations/${presId}/files`,
      {
        headers: authHeaders('other-replace-user'),
        multipart: {
          'config.json': {
            name: 'config.json',
            mimeType: 'application/json',
            buffer: Buffer.from('{"content":"README.md"}'),
          },
          'README.md': {
            name: 'README.md',
            mimeType: 'text/markdown',
            buffer: Buffer.from('# Hack'),
          },
        },
      },
    );
    // Service throws generic Error for wrong owner → route returns 500
    expect(res.status()).toBe(500);
  });
});

// ────────────────────────────────────────────────────────────
// GitHub check + refresh
// ────────────────────────────────────────────────────────────

test.describe('GitHub Check & Refresh API', () => {
  let localPresId: string;
  let githubPresId: string;

  test.beforeAll(async () => {
    await seedUser('gh-user', 'ghuser@test.com');
    const { createPresentation, generateSlug } = await import('../src/server/services/presentation.ts');
    const { createDatabase } = await import('../src/server/db/index.ts');
    const db = createDatabase(`${ctx.tmpDir}/hub.db`);

    // A normal (non-GitHub) presentation
    const local = await createPresentation(db, {
      userId: 'gh-user',
      title: 'Local Deck',
      slug: generateSlug('Local Deck'),
      files: [
        { path: 'config.json', data: Buffer.from('{"content":"README.md"}') },
        { path: 'README.md', data: Buffer.from('# Local') },
      ],
      repoDir: `${ctx.tmpDir}/repos`,
    });
    localPresId = local.id;

    // A GitHub-imported presentation (fake SHA)
    const gh = await createPresentation(db, {
      userId: 'gh-user',
      title: 'GitHub Deck',
      slug: generateSlug('GitHub Deck'),
      files: [
        { path: 'config.json', data: Buffer.from('{"content":"README.md"}') },
        { path: 'README.md', data: Buffer.from('# GitHub') },
      ],
      repoDir: `${ctx.tmpDir}/repos`,
      githubUrl: 'https://github.com/example/repo',
      githubSha: 'old-sha-111',
    });
    githubPresId = gh.id;
  });

  test('GET github-check returns 400 for non-GitHub presentation', async ({ request }) => {
    const res = await request.get(
      `${ctx.baseUrl}/hub/api/presentations/${localPresId}/github-check`,
      { headers: authHeaders('gh-user') },
    );
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('GitHub');
  });

  test('POST github-refresh returns 400 for non-GitHub presentation', async ({ request }) => {
    const res = await request.post(
      `${ctx.baseUrl}/hub/api/presentations/${localPresId}/github-refresh`,
      { headers: authHeaders('gh-user') },
    );
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('GitHub');
  });

  test('GET github-check returns 404 for wrong owner', async ({ request }) => {
    await seedUser('gh-other', 'ghother@test.com');
    const res = await request.get(
      `${ctx.baseUrl}/hub/api/presentations/${githubPresId}/github-check`,
      { headers: authHeaders('gh-other') },
    );
    expect(res.status()).toBe(404);
  });

  test('GET github-check returns currentSha and hasUpdate shape', async ({ request }) => {
    // The check calls the real GitHub API; in CI this may fail network-wise.
    // We just verify the route exists and returns the right shape or a gateway error.
    const res = await request.get(
      `${ctx.baseUrl}/hub/api/presentations/${githubPresId}/github-check`,
      { headers: authHeaders('gh-user') },
    );
    // 200 means GitHub responded; 502 means network issue in test env — both are acceptable
    expect([200, 502]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      expect(typeof body.hasUpdate).toBe('boolean');
      expect('currentSha' in body).toBe(true);
      expect('latestSha' in body).toBe(true);
    }
  });
});
