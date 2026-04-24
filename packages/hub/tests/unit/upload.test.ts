import { describe, it, expect } from 'vitest';
import { validateDeckFiles, extractZip } from '../../src/server/services/upload.ts';
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
});
