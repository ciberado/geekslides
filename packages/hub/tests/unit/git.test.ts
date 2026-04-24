import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { initRepo, commitFiles, checkoutFiles, getLog, repoSize, type RepoFile } from '../../src/server/services/git.ts';

describe('git service', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hub-git-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  const repoPath = (): string => path.join(tmpDir, 'test-repo');

  describe('initRepo', () => {
    it('creates a git repository', async () => {
      await initRepo(repoPath());
      expect(fs.existsSync(path.join(repoPath(), '.git'))).toBe(true);
    });

    it('is idempotent', async () => {
      await initRepo(repoPath());
      await initRepo(repoPath());
      expect(fs.existsSync(path.join(repoPath(), '.git'))).toBe(true);
    });
  });

  describe('commitFiles', () => {
    it('commits files and returns a SHA', async () => {
      await initRepo(repoPath());
      const files: RepoFile[] = [
        { path: 'README.md', data: Buffer.from('# Hello') },
        { path: 'config.json', data: Buffer.from('{}') },
      ];
      const sha = await commitFiles(repoPath(), files, 'Initial commit');
      expect(sha).toBeTruthy();
      expect(typeof sha).toBe('string');
    });

    it('creates files on disk', async () => {
      await initRepo(repoPath());
      await commitFiles(repoPath(), [{ path: 'test.txt', data: Buffer.from('hello') }], 'Add test');
      expect(fs.readFileSync(path.join(repoPath(), 'test.txt'), 'utf-8')).toBe('hello');
    });

    it('creates nested directories', async () => {
      await initRepo(repoPath());
      await commitFiles(repoPath(), [{ path: 'a/b/c.txt', data: Buffer.from('nested') }], 'Nested');
      expect(fs.readFileSync(path.join(repoPath(), 'a', 'b', 'c.txt'), 'utf-8')).toBe('nested');
    });
  });

  describe('checkoutFiles', () => {
    it('returns committed files', async () => {
      await initRepo(repoPath());
      await commitFiles(repoPath(), [{ path: 'doc.md', data: Buffer.from('# Doc') }], 'Add doc');
      const files = await checkoutFiles(repoPath());
      expect(files).toHaveLength(1);
      expect(files[0]?.path).toBe('doc.md');
      expect(files[0]?.data.toString()).toBe('# Doc');
    });

    it('returns empty array for empty repo', async () => {
      await initRepo(repoPath());
      const files = await checkoutFiles(repoPath());
      expect(files).toHaveLength(0);
    });
  });

  describe('getLog', () => {
    it('returns commit history', async () => {
      await initRepo(repoPath());
      await commitFiles(repoPath(), [{ path: 'a.txt', data: Buffer.from('a') }], 'First');
      await commitFiles(repoPath(), [{ path: 'a.txt', data: Buffer.from('b') }], 'Second');

      const log = await getLog(repoPath());
      expect(log).toHaveLength(2);
      expect(log[0]?.message).toBe('Second\n');
    });

    it('returns empty for empty repo', async () => {
      await initRepo(repoPath());
      const log = await getLog(repoPath());
      expect(log).toHaveLength(0);
    });
  });

  describe('repoSize', () => {
    it('calculates size of files (excluding .git)', async () => {
      await initRepo(repoPath());
      const content = 'x'.repeat(1000);
      await commitFiles(repoPath(), [{ path: 'big.txt', data: Buffer.from(content) }], 'Big file');

      const size = repoSize(repoPath());
      expect(size).toBeGreaterThanOrEqual(1000);
    });

    it('returns 0 for nonexistent repo', () => {
      expect(repoSize('/nonexistent/repo')).toBe(0);
    });
  });
});
