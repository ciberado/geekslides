/**
 * Route-level tests for the presentation export endpoint and PPTX source
 * preservation feature, exercised via Fastify inject.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import fastifyCookie from '@fastify/cookie';
import fastifyJwt from '@fastify/jwt';
import fastifyMultipart from '@fastify/multipart';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import AdmZip from 'adm-zip';
import { createTestDatabase, insertTestUser, type TestDatabase } from './helpers.ts';
import authPlugin from '../../src/server/plugins/auth.ts';
import { registerPresentationRoutes } from '../../src/server/routes/presentations.ts';
import { createPresentation } from '../../src/server/services/presentation.ts';
import { checkoutFiles } from '../../src/server/services/git.ts';
import type { HubServerOptions } from '../../src/server/config.ts';

// ─── Mock pptx converter ─────────────────────────────────────────────────────
// The real converter requires a heavy PPTX parsing library and is tested
// separately in pptx-convert.test.ts. Here we only care about the route logic.

vi.mock('../../src/server/services/pptx-convert.ts', () => ({
  convertPptx: vi.fn().mockResolvedValue({
    files: [
      { path: 'config.json', data: Buffer.from(JSON.stringify({ content: 'slides.html', title: 'Test PPTX' })) },
      { path: 'slides.html', data: Buffer.from('<section>Slide 1</section>') },
    ],
    extractedTitle: 'Test PPTX',
  }),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

const JWT_SECRET = 'test-secret-presentations-routes';

function testOptions(repoDir: string): HubServerOptions {
  return {
    port: 0,
    host: '127.0.0.1',
    dbPath: ':memory:',
    repoDir,
    serverBaseUrl: 'http://localhost:1234',
    viewerBaseUrl: 'http://localhost:5173',
    githubClientId: '',
    githubClientSecret: '',
    googleClientId: '',
    googleClientSecret: '',
    adminEmail: '',
    jwtSecret: JWT_SECRET,
    cookieDomain: 'localhost',
    devMode: false,
  };
}

async function buildTestApp(db: TestDatabase, repoDir: string): Promise<FastifyInstance> {
  const fastify = Fastify({ logger: false });
  await fastify.register(fastifyCookie);
  await fastify.register(fastifyJwt, {
    secret: JWT_SECRET,
    cookie: { cookieName: 'hub_access', signed: false },
  });
  await fastify.register(fastifyMultipart, { limits: { fileSize: 10 * 1024 * 1024 } });
  await fastify.register(authPlugin);
  registerPresentationRoutes(fastify, db, testOptions(repoDir));
  await fastify.ready();
  return fastify;
}

function makeAuthCookie(fastify: FastifyInstance, userId = 'user-1'): string {
  const token = fastify.jwt.sign({ sub: userId, role: 'user', status: 'approved' });
  return `hub_access=${token}`;
}

/** Build a multipart/form-data payload manually (no external deps needed). */
function buildMultipartBody(
  fields: Record<string, string>,
  files: Array<{ fieldname: string; filename: string; data: Buffer; mime?: string }>,
): { body: Buffer; contentType: string } {
  const boundary = '----ViTestBoundary' + Math.random().toString(36).slice(2);
  const parts: Buffer[] = [];

  for (const [name, value] of Object.entries(fields)) {
    parts.push(Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`,
    ));
  }

  for (const file of files) {
    const mime = file.mime ?? 'application/octet-stream';
    const header = `--${boundary}\r\nContent-Disposition: form-data; name="${file.fieldname}"; filename="${encodeURIComponent(file.filename)}"\r\nContent-Type: ${mime}\r\n\r\n`;
    parts.push(Buffer.concat([Buffer.from(header), file.data, Buffer.from('\r\n')]));
  }

  parts.push(Buffer.from(`--${boundary}--\r\n`));
  return { body: Buffer.concat(parts), contentType: `multipart/form-data; boundary=${boundary}` };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('presentation export route', () => {
  let db: TestDatabase;
  let tmpDir: string;
  let app: FastifyInstance;

  beforeEach(async () => {
    db = createTestDatabase();
    insertTestUser(db);
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hub-export-test-'));
    app = await buildTestApp(db, tmpDir);
  });

  afterEach(async () => {
    await app.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns a zip file containing all presentation files', async () => {
    const pres = await createPresentation(db, {
      userId: 'user-1',
      title: 'Export Test',
      slug: 'export-test',
      files: [
        { path: 'config.json', data: Buffer.from(JSON.stringify({ content: 'slides.md' })) },
        { path: 'slides.md', data: Buffer.from('# Slide 1') },
        { path: 'style.css', data: Buffer.from('body { color: red; }') },
      ],
      repoDir: tmpDir,
    });

    const res = await app.inject({
      method: 'GET',
      url: `/hub/api/presentations/${pres.id}/export`,
      headers: { Cookie: makeAuthCookie(app) },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('application/zip');
    expect(res.headers['content-disposition']).toContain('export-test.zip');

    const zip = new AdmZip(res.rawPayload);
    const entries = zip.getEntries().map((e) => e.entryName);
    expect(entries).toContain('config.json');
    expect(entries).toContain('slides.md');
    expect(entries).toContain('style.css');
  });

  it('preserves file contents in the zip', async () => {
    const markdownContent = '# My Slides\n\nSlide content here.';
    const pres = await createPresentation(db, {
      userId: 'user-1',
      title: 'Content Test',
      slug: 'content-test',
      files: [
        { path: 'config.json', data: Buffer.from(JSON.stringify({ content: 'slides.md' })) },
        { path: 'slides.md', data: Buffer.from(markdownContent) },
      ],
      repoDir: tmpDir,
    });

    const res = await app.inject({
      method: 'GET',
      url: `/hub/api/presentations/${pres.id}/export`,
      headers: { Cookie: makeAuthCookie(app) },
    });

    const zip = new AdmZip(res.rawPayload);
    const mdEntry = zip.readAsText('slides.md');
    expect(mdEntry).toBe(markdownContent);
  });

  it('returns 401 without authentication', async () => {
    const pres = await createPresentation(db, {
      userId: 'user-1',
      title: 'Auth Test',
      slug: 'auth-test',
      files: [
        { path: 'config.json', data: Buffer.from(JSON.stringify({ content: 'slides.md' })) },
        { path: 'slides.md', data: Buffer.from('# Hello') },
      ],
      repoDir: tmpDir,
    });

    const res = await app.inject({
      method: 'GET',
      url: `/hub/api/presentations/${pres.id}/export`,
    });

    expect(res.statusCode).toBe(401);
  });

  it('returns 404 for a nonexistent presentation', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/hub/api/presentations/nonexistent-id/export',
      headers: { Cookie: makeAuthCookie(app) },
    });

    expect(res.statusCode).toBe(404);
  });

  it('returns 404 when presentation belongs to a different user', async () => {
    insertTestUser(db, { id: 'user-2', email: 'other@example.com', providerId: '99999' });
    const pres = await createPresentation(db, {
      userId: 'user-2',
      title: 'Other User Deck',
      slug: 'other-deck',
      files: [
        { path: 'config.json', data: Buffer.from(JSON.stringify({ content: 'slides.md' })) },
        { path: 'slides.md', data: Buffer.from('# Private') },
      ],
      repoDir: tmpDir,
    });

    // user-1 tries to export user-2's private deck
    const res = await app.inject({
      method: 'GET',
      url: `/hub/api/presentations/${pres.id}/export`,
      headers: { Cookie: makeAuthCookie(app, 'user-1') },
    });

    expect(res.statusCode).toBe(404);
  });

  it('zip filename is derived from the presentation slug', async () => {
    const pres = await createPresentation(db, {
      userId: 'user-1',
      title: 'Slug Test',
      slug: 'my-cool-deck',
      files: [
        { path: 'config.json', data: Buffer.from(JSON.stringify({ content: 'slides.md' })) },
        { path: 'slides.md', data: Buffer.from('# Hello') },
      ],
      repoDir: tmpDir,
    });

    const res = await app.inject({
      method: 'GET',
      url: `/hub/api/presentations/${pres.id}/export`,
      headers: { Cookie: makeAuthCookie(app) },
    });

    expect(res.headers['content-disposition']).toBe('attachment; filename="my-cool-deck.zip"');
  });
});

describe('PPTX source preservation', () => {
  let db: TestDatabase;
  let tmpDir: string;
  let app: FastifyInstance;

  beforeEach(async () => {
    db = createTestDatabase();
    insertTestUser(db);
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hub-pptx-test-'));
    app = await buildTestApp(db, tmpDir);
  });

  afterEach(async () => {
    await app.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('stores source.pptx in the repo when uploading a PPTX', async () => {
    const fakePptxData = Buffer.from('PK\x03\x04fake-pptx-binary-data');
    const { body, contentType } = buildMultipartBody(
      { title: 'PPTX Deck' },
      [{ fieldname: 'files', filename: 'presentation.pptx', data: fakePptxData }],
    );

    const res = await app.inject({
      method: 'POST',
      url: '/hub/api/presentations',
      headers: { 'Content-Type': contentType, Cookie: makeAuthCookie(app) },
      payload: body,
    });

    expect(res.statusCode).toBe(201);
    const pres = JSON.parse(res.body) as { id: string; slug: string };

    // Verify source.pptx was committed to the git repo
    const repoPath = path.join(tmpDir, 'user-1', pres.slug);
    const repoFiles = await checkoutFiles(repoPath);
    const sourcePptx = repoFiles.find((f) => f.path === 'source.pptx');

    expect(sourcePptx).toBeDefined();
    expect(sourcePptx?.data).toEqual(fakePptxData);
  });

  it('includes source.pptx in the exported zip for a PPTX-originated deck', async () => {
    const fakePptxData = Buffer.from('PK\x03\x04fake-pptx-for-export');
    const { body, contentType } = buildMultipartBody(
      { title: 'Export PPTX Deck' },
      [{ fieldname: 'files', filename: 'slides.pptx', data: fakePptxData }],
    );

    const createRes = await app.inject({
      method: 'POST',
      url: '/hub/api/presentations',
      headers: { 'Content-Type': contentType, Cookie: makeAuthCookie(app) },
      payload: body,
    });
    expect(createRes.statusCode).toBe(201);
    const pres = JSON.parse(createRes.body) as { id: string };

    const exportRes = await app.inject({
      method: 'GET',
      url: `/hub/api/presentations/${pres.id}/export`,
      headers: { Cookie: makeAuthCookie(app) },
    });
    expect(exportRes.statusCode).toBe(200);

    const zip = new AdmZip(exportRes.rawPayload);
    const entries = zip.getEntries().map((e) => e.entryName);
    expect(entries).toContain('source.pptx');
    expect(entries).toContain('config.json');
    expect(entries).toContain('slides.html');
  });

  it('updates source.pptx when re-uploading a PPTX via PUT /files', async () => {
    // First create via direct service call (simulating an existing deck)
    const pres = await createPresentation(db, {
      userId: 'user-1',
      title: 'PPTX Deck v1',
      slug: 'pptx-deck-v1',
      files: [
        { path: 'config.json', data: Buffer.from(JSON.stringify({ content: 'slides.html' })) },
        { path: 'slides.html', data: Buffer.from('<section>Old</section>') },
        { path: 'source.pptx', data: Buffer.from('PK\x03\x04old-pptx') },
      ],
      repoDir: tmpDir,
    });

    // Re-upload with a new PPTX
    const newPptxData = Buffer.from('PK\x03\x04new-pptx-v2-data');
    const { body, contentType } = buildMultipartBody(
      {},
      [{ fieldname: 'files', filename: 'updated.pptx', data: newPptxData }],
    );

    const res = await app.inject({
      method: 'PUT',
      url: `/hub/api/presentations/${pres.id}/files`,
      headers: { 'Content-Type': contentType, Cookie: makeAuthCookie(app) },
      payload: body,
    });

    expect(res.statusCode).toBe(200);

    const repoPath = path.join(tmpDir, 'user-1', 'pptx-deck-v1');
    const repoFiles = await checkoutFiles(repoPath);
    const sourcePptx = repoFiles.find((f) => f.path === 'source.pptx');

    expect(sourcePptx).toBeDefined();
    expect(sourcePptx?.data).toEqual(newPptxData);
  });

  it('does not create source.pptx when uploading regular files (non-PPTX)', async () => {
    const { body, contentType } = buildMultipartBody(
      { title: 'Markdown Deck' },
      [
        { fieldname: 'files', filename: 'config.json', data: Buffer.from(JSON.stringify({ content: 'slides.md' })) },
        { fieldname: 'files', filename: 'slides.md', data: Buffer.from('# Slide 1') },
      ],
    );

    const res = await app.inject({
      method: 'POST',
      url: '/hub/api/presentations',
      headers: { 'Content-Type': contentType, Cookie: makeAuthCookie(app) },
      payload: body,
    });

    expect(res.statusCode).toBe(201);
    const pres = JSON.parse(res.body) as { id: string; slug: string };

    const repoPath = path.join(tmpDir, 'user-1', pres.slug);
    const repoFiles = await checkoutFiles(repoPath);
    const sourcePptx = repoFiles.find((f) => f.path === 'source.pptx');

    expect(sourcePptx).toBeUndefined();
  });
});
