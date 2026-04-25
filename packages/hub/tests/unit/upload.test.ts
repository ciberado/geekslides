import { describe, it, expect, vi, afterEach } from 'vitest';
import { validateDeckFiles, extractZip, importFromGitHub, fetchGitHubLatestSha } from '../../src/server/services/upload.ts';
import type { RepoFile } from '../../src/server/services/git.ts';
import AdmZip from 'adm-zip';

function makeFile(filePath: string, content: string): RepoFile {
  return { path: filePath, data: Buffer.from(content) };
}

describe('upload service', () => {
  describe('validateDeckFiles', () => {
    it('accepts valid deck with config.json and content file', () => {
      const files: RepoFile[] = [
        makeFile('config.json', JSON.stringify({ content: 'README.md', title: 'Test' })),
        makeFile('README.md', '# Hello'),
      ];
      const result = validateDeckFiles(files);
      expect(result.valid).toBe(true);
      expect(result.files).toHaveLength(2);
    });

    it('rejects when config.json is missing', () => {
      const files: RepoFile[] = [makeFile('README.md', '# Hello')];
      const result = validateDeckFiles(files);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Missing config.json');
    });

    it('rejects when config.json has no content field', () => {
      const files: RepoFile[] = [
        makeFile('config.json', JSON.stringify({ title: 'Test' })),
      ];
      const result = validateDeckFiles(files);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('content');
    });

    it('rejects when content file is not in the upload', () => {
      const files: RepoFile[] = [
        makeFile('config.json', JSON.stringify({ content: 'slides.md' })),
      ];
      const result = validateDeckFiles(files);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('slides.md');
    });

    it('silently skips path traversal attempts', () => {
      const files: RepoFile[] = [
        makeFile('config.json', JSON.stringify({ content: 'README.md' })),
        makeFile('../../../etc/passwd', 'hack'),
        makeFile('README.md', '# Hello'),
      ];
      const result = validateDeckFiles(files);
      expect(result.valid).toBe(true);
      expect(result.files).toHaveLength(2);
      expect(result.files.find((f) => f.path.includes('passwd'))).toBeUndefined();
    });

    it('silently skips dotfiles and dot-directories', () => {
      const files: RepoFile[] = [
        makeFile('config.json', JSON.stringify({ content: 'README.md' })),
        makeFile('.git/config', 'hack'),
        makeFile('.gitignore', 'node_modules'),
        makeFile('.DS_Store', 'binary'),
        makeFile('README.md', '# Hello'),
      ];
      const result = validateDeckFiles(files);
      expect(result.valid).toBe(true);
      expect(result.files).toHaveLength(2);
      expect(result.files.find((f) => f.path.includes('.git'))).toBeUndefined();
    });

    it('rejects invalid JSON in config.json', () => {
      const files: RepoFile[] = [
        makeFile('config.json', '{invalid}'),
      ];
      const result = validateDeckFiles(files);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid JSON');
    });

    it('normalizes backslashes in paths', () => {
      const files: RepoFile[] = [
        makeFile('config.json', JSON.stringify({ content: 'README.md' })),
        makeFile('images\\photo.png', 'img data'),
        makeFile('README.md', '# Hello'),
      ];
      const result = validateDeckFiles(files);
      expect(result.valid).toBe(true);
      expect(result.files.find((f) => f.path === 'images/photo.png')).toBeDefined();
    });
  });

  describe('extractZip', () => {
    it('extracts files from zip buffer', () => {
      const zip = new AdmZip();
      zip.addFile('config.json', Buffer.from('{"content":"README.md"}'));
      zip.addFile('README.md', Buffer.from('# Hello'));
      const buffer = zip.toBuffer();

      const files = extractZip(buffer);
      expect(files).toHaveLength(2);
      expect(files.find((f) => f.path === 'config.json')).toBeDefined();
    });

    it('strips common directory prefix', () => {
      const zip = new AdmZip();
      zip.addFile('my-deck/config.json', Buffer.from('{"content":"README.md"}'));
      zip.addFile('my-deck/README.md', Buffer.from('# Hello'));
      const buffer = zip.toBuffer();

      const files = extractZip(buffer);
      expect(files.find((f) => f.path === 'config.json')).toBeDefined();
      expect(files.find((f) => f.path === 'README.md')).toBeDefined();
    });

    it('skips directory entries', () => {
      const zip = new AdmZip();
      zip.addFile('config.json', Buffer.from('{}'));
      zip.addFile('images/', Buffer.alloc(0));
      const buffer = zip.toBuffer();

      const files = extractZip(buffer);
      expect(files).toHaveLength(1);
    });

    it('skips files with invalid paths', () => {
      const zip = new AdmZip();
      zip.addFile('good.txt', Buffer.from('ok'));
      zip.addFile('../bad.txt', Buffer.from('hack'));
      const buffer = zip.toBuffer();

      const files = extractZip(buffer);
      expect(files.every((f) => !f.path.includes('..'))).toBe(true);
    });
  });

  describe('importFromGitHub', () => {
    afterEach(() => { vi.restoreAllMocks(); });

    function mockGitHubApi({
      sha = 'abc1234567890',
      tree = [
        { path: 'config.json', type: 'blob', url: 'https://api.github.com/blobs/c1' },
        { path: 'README.md', type: 'blob', url: 'https://api.github.com/blobs/r1' },
      ],
      blobs = new Map([
        ['https://api.github.com/blobs/c1', '{"content":"README.md"}'],
        ['https://api.github.com/blobs/r1', '# Hello'],
      ]),
    } = {}): void {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: RequestInfo | URL) => {
        const urlStr = String(url);
        if (urlStr.includes('/git/ref/heads/')) {
          return new Response(JSON.stringify({ object: { sha } }), { status: 200 });
        }
        if (urlStr.includes('/git/trees/')) {
          return new Response(JSON.stringify({ tree }), { status: 200 });
        }
        for (const [blobUrl, content] of blobs.entries()) {
          if (urlStr === blobUrl) {
            return new Response(
              JSON.stringify({ content: Buffer.from(content).toString('base64'), encoding: 'base64' }),
              { status: 200 },
            );
          }
        }
        return new Response('Not Found', { status: 404 });
      });
    }

    it('parses a standard GitHub URL and returns files with sha', async () => {
      mockGitHubApi({ sha: 'deadbeef1234' });
      const result = await importFromGitHub('https://github.com/user/repo');
      expect(result.sha).toBe('deadbeef1234');
      expect(result.files).toHaveLength(2);
      expect(result.files.find((f) => f.path === 'config.json')).toBeDefined();
      expect(result.files.find((f) => f.path === 'README.md')).toBeDefined();
    });

    it('strips subpath prefix from file paths', async () => {
      mockGitHubApi({
        tree: [
          { path: 'decks/my-talk/config.json', type: 'blob', url: 'https://api.github.com/blobs/c1' },
          { path: 'decks/my-talk/README.md', type: 'blob', url: 'https://api.github.com/blobs/r1' },
          { path: 'other/file.txt', type: 'blob', url: 'https://api.github.com/blobs/o1' },
        ],
        blobs: new Map([
          ['https://api.github.com/blobs/c1', '{"content":"README.md"}'],
          ['https://api.github.com/blobs/r1', '# Hello'],
        ]),
      });
      const result = await importFromGitHub('https://github.com/user/repo/tree/main/decks/my-talk');
      expect(result.files.find((f) => f.path === 'config.json')).toBeDefined();
      expect(result.files.find((f) => f.path === 'README.md')).toBeDefined();
      expect(result.files.find((f) => f.path.startsWith('decks/'))).toBeUndefined();
    });

    it('skips dotfiles from GitHub tree', async () => {
      mockGitHubApi({
        tree: [
          { path: 'config.json', type: 'blob', url: 'https://api.github.com/blobs/c1' },
          { path: 'README.md', type: 'blob', url: 'https://api.github.com/blobs/r1' },
          { path: '.gitignore', type: 'blob', url: 'https://api.github.com/blobs/g1' },
          { path: '.github/workflows/ci.yml', type: 'blob', url: 'https://api.github.com/blobs/gh1' },
        ],
        blobs: new Map([
          ['https://api.github.com/blobs/c1', '{"content":"README.md"}'],
          ['https://api.github.com/blobs/r1', '# Hello'],
        ]),
      });
      const result = await importFromGitHub('https://github.com/user/repo');
      expect(result.files.find((f) => f.path === '.gitignore')).toBeUndefined();
      expect(result.files.find((f) => f.path.includes('.github'))).toBeUndefined();
      expect(result.files).toHaveLength(2);
    });

    it('throws on invalid GitHub URL', async () => {
      await expect(importFromGitHub('https://gitlab.com/user/repo')).rejects.toThrow('Invalid GitHub repository URL');
    });

    it('throws when GitHub API returns an error', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response('Not Found', { status: 404 }));
      await expect(importFromGitHub('https://github.com/user/repo')).rejects.toThrow();
    });

    it('falls back to commits API when ref lookup fails', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: RequestInfo | URL) => {
        const urlStr = String(url);
        if (urlStr.includes('/git/ref/heads/')) {
          return new Response('Not Found', { status: 404 });
        }
        if (urlStr.includes('/commits/')) {
          return new Response(JSON.stringify({ sha: 'fallback-sha' }), { status: 200 });
        }
        if (urlStr.includes('/git/trees/')) {
          return new Response(JSON.stringify({ tree: [
            { path: 'config.json', type: 'blob', url: 'https://api.github.com/blobs/c1' },
            { path: 'README.md', type: 'blob', url: 'https://api.github.com/blobs/r1' },
          ] }), { status: 200 });
        }
        return new Response(
          JSON.stringify({ content: Buffer.from('x').toString('base64'), encoding: 'base64' }),
          { status: 200 },
        );
      });
      const result = await importFromGitHub('https://github.com/user/repo');
      expect(result.sha).toBe('fallback-sha');
    });
  });

  describe('fetchGitHubLatestSha', () => {
    afterEach(() => { vi.restoreAllMocks(); });

    it('returns the sha from the ref API', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ object: { sha: 'latest-sha-123' } }), { status: 200 }),
      );
      const sha = await fetchGitHubLatestSha('https://github.com/user/repo');
      expect(sha).toBe('latest-sha-123');
    });

    it('falls back to commits API when ref lookup fails', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: RequestInfo | URL) => {
        if (String(url).includes('/git/ref/heads/')) return new Response('Not Found', { status: 404 });
        return new Response(JSON.stringify({ sha: 'commit-sha-456' }), { status: 200 });
      });
      const sha = await fetchGitHubLatestSha('https://github.com/user/repo');
      expect(sha).toBe('commit-sha-456');
    });

    it('returns null for invalid URL', async () => {
      const sha = await fetchGitHubLatestSha('https://gitlab.com/user/repo');
      expect(sha).toBeNull();
    });

    it('returns null when both API calls fail', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('Error', { status: 500 }));
      const sha = await fetchGitHubLatestSha('https://github.com/user/repo');
      expect(sha).toBeNull();
    });

    it('detects an update when the returned sha differs from stored sha', async () => {
      const storedSha = 'old-sha-aaaaaa';
      const latestSha = 'new-sha-bbbbbb';
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ object: { sha: latestSha } }), { status: 200 }),
      );
      const fetched = await fetchGitHubLatestSha('https://github.com/user/repo');
      expect(fetched).toBe(latestSha);
      expect(fetched !== storedSha).toBe(true);   // hasUpdate === true
    });

    it('detects no update when the returned sha matches stored sha', async () => {
      const storedSha = 'current-sha-cccc';
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ object: { sha: storedSha } }), { status: 200 }),
      );
      const fetched = await fetchGitHubLatestSha('https://github.com/user/repo');
      expect(fetched).toBe(storedSha);
      expect(fetched !== storedSha).toBe(false);  // hasUpdate === false
    });
  });
});
