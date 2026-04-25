import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createTestDatabase, insertTestUser, insertTestPresentation, type TestDatabase } from './helpers.ts';
import {
  generateSlug,
  ensureUniqueSlug,
  updatePresentationMetadata,
  listPresentations,
  getPresentationById,
  createPresentation,
  refreshFromGitHub,
} from '../../src/server/services/presentation.ts';

describe('presentation service', () => {
  let db: TestDatabase;

  beforeEach(() => {
    db = createTestDatabase();
    insertTestUser(db);
  });

  describe('generateSlug', () => {
    it('converts title to kebab-case', () => {
      expect(generateSlug('My Great Presentation')).toBe('my-great-presentation');
    });

    it('strips special characters', () => {
      expect(generateSlug('Hello! @World #2024')).toBe('hello-world-2024');
    });

    it('collapses multiple dashes', () => {
      expect(generateSlug('too   many   spaces')).toBe('too-many-spaces');
    });

    it('trims leading and trailing dashes', () => {
      expect(generateSlug('---hello---')).toBe('hello');
    });

    it('truncates to 60 characters', () => {
      const long = 'a'.repeat(100);
      expect(generateSlug(long).length).toBeLessThanOrEqual(60);
    });
  });

  describe('ensureUniqueSlug', () => {
    it('returns original slug when no conflict', () => {
      expect(ensureUniqueSlug(db, 'user-1', 'my-deck')).toBe('my-deck');
    });

    it('appends counter when slug exists', () => {
      insertTestPresentation(db, { slug: 'my-deck' });
      expect(ensureUniqueSlug(db, 'user-1', 'my-deck')).toBe('my-deck-1');
    });

    it('increments counter for multiple conflicts', () => {
      insertTestPresentation(db, { id: 'p1', slug: 'my-deck' });
      insertTestPresentation(db, { id: 'p2', slug: 'my-deck-1' });
      expect(ensureUniqueSlug(db, 'user-1', 'my-deck')).toBe('my-deck-2');
    });
  });

  describe('updatePresentationMetadata', () => {
    it('updates title', () => {
      insertTestPresentation(db);
      const result = updatePresentationMetadata(db, 'pres-1', 'user-1', { title: 'New Title' });
      expect(result?.title).toBe('New Title');
    });

    it('updates visibility', () => {
      insertTestPresentation(db);
      const result = updatePresentationMetadata(db, 'pres-1', 'user-1', { visibility: 'public' });
      expect(result?.visibility).toBe('public');
    });

    it('returns undefined for wrong owner', () => {
      insertTestPresentation(db);
      const result = updatePresentationMetadata(db, 'pres-1', 'other-user', { title: 'Hack' });
      expect(result).toBeUndefined();
    });

    it('returns undefined for nonexistent presentation', () => {
      const result = updatePresentationMetadata(db, 'nonexistent', 'user-1', { title: 'X' });
      expect(result).toBeUndefined();
    });
  });

  describe('listPresentations', () => {
    it('returns presentations for user', () => {
      insertTestPresentation(db, { id: 'p1', slug: 'deck-1' });
      insertTestPresentation(db, { id: 'p2', slug: 'deck-2' });
      const results = listPresentations(db, 'user-1');
      expect(results).toHaveLength(2);
    });

    it('does not return other users presentations', () => {
      insertTestUser(db, { id: 'user-2', email: 'other@example.com', providerId: '54321' });
      insertTestPresentation(db, { id: 'p1', ownerId: 'user-2', slug: 'other-deck' });
      const results = listPresentations(db, 'user-1');
      expect(results).toHaveLength(0);
    });

    it('respects limit and offset', () => {
      for (let i = 0; i < 5; i++) {
        insertTestPresentation(db, {
          id: `p${String(i)}`,
          slug: `deck-${String(i)}`,
          updatedAt: new Date(Date.now() + i * 1000),
        });
      }
      const results = listPresentations(db, 'user-1', 2, 1);
      expect(results).toHaveLength(2);
    });
  });

  describe('getPresentationById', () => {
    it('returns presentation when found', () => {
      insertTestPresentation(db);
      const found = getPresentationById(db, 'pres-1');
      expect(found).toBeDefined();
      expect(found?.title).toBe('Test Deck');
    });

    it('returns undefined when not found', () => {
      expect(getPresentationById(db, 'nonexistent')).toBeUndefined();
    });
  });

  describe('createPresentation (with GitHub metadata)', () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hub-pres-test-'));
    });

    it('stores githubUrl and githubSha when provided', async () => {
      const pres = await createPresentation(db, {
        userId: 'user-1',
        title: 'GitHub Deck',
        slug: 'github-deck',
        files: [
          { path: 'config.json', data: Buffer.from('{"content":"README.md"}') },
          { path: 'README.md', data: Buffer.from('# Hello') },
        ],
        repoDir: tmpDir,
        githubUrl: 'https://github.com/user/repo',
        githubSha: 'abc123def456',
      });
      expect(pres.githubUrl).toBe('https://github.com/user/repo');
      expect(pres.githubSha).toBe('abc123def456');
    });

    it('stores null for githubUrl/githubSha when not provided', async () => {
      const pres = await createPresentation(db, {
        userId: 'user-1',
        title: 'Local Deck',
        slug: 'local-deck',
        files: [
          { path: 'config.json', data: Buffer.from('{"content":"README.md"}') },
          { path: 'README.md', data: Buffer.from('# Hello') },
        ],
        repoDir: tmpDir,
      });
      expect(pres.githubUrl).toBeNull();
      expect(pres.githubSha).toBeNull();
    });
  });

  describe('refreshFromGitHub', () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hub-refresh-test-'));
    });

    async function createGitHubPresentation(): Promise<string> {
      const pres = await createPresentation(db, {
        userId: 'user-1',
        title: 'GitHub Import',
        slug: 'github-import',
        files: [
          { path: 'config.json', data: Buffer.from('{"content":"README.md"}') },
          { path: 'README.md', data: Buffer.from('# Version 1') },
        ],
        repoDir: tmpDir,
        githubUrl: 'https://github.com/user/repo',
        githubSha: 'sha-v1',
      });
      return pres.id;
    }

    it('updates files and githubSha', async () => {
      const id = await createGitHubPresentation();
      const updated = await refreshFromGitHub(
        db, id, 'user-1',
        [
          { path: 'config.json', data: Buffer.from('{"content":"README.md"}') },
          { path: 'README.md', data: Buffer.from('# Version 2') },
        ],
        'sha-v2',
        tmpDir,
      );
      expect(updated.githubSha).toBe('sha-v2');
      expect(updated.githubUrl).toBe('https://github.com/user/repo');
    });

    it('throws when presentation was not imported from GitHub', async () => {
      insertTestPresentation(db, { id: 'local-pres', slug: 'local-pres' });
      await expect(
        refreshFromGitHub(db, 'local-pres', 'user-1', [], 'sha-new', tmpDir),
      ).rejects.toThrow('not imported from GitHub');
    });

    it('throws when called by the wrong owner', async () => {
      const id = await createGitHubPresentation();
      await expect(
        refreshFromGitHub(db, id, 'other-user', [], 'sha-new', tmpDir),
      ).rejects.toThrow('access denied');
    });
  });
});
