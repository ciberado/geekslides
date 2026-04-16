import { describe, it, expect } from 'vitest';
import {
  scanMarkdownImages,
  scanCssUrls,
  buildManifest,
} from '../../src/sync/DeckUploader.ts';

describe('DeckUploader', () => {
  describe('scanMarkdownImages', () => {
    it('extracts standard markdown image paths', () => {
      const md = '# Title\n![Logo](images/logo.png)\nText\n![Alt](photos/bg.jpg)';
      const images = scanMarkdownImages(md);
      expect(images).toContain('images/logo.png');
      expect(images).toContain('photos/bg.jpg');
    });

    it('extracts bgurl() references', () => {
      const md = '[](.cover,bgurl(images/hero.jpg))\n';
      const images = scanMarkdownImages(md);
      expect(images).toContain('images/hero.jpg');
    });

    it('extracts <img src="..."> references', () => {
      const md = '<img src="images/diagram.svg" alt="diagram">';
      const images = scanMarkdownImages(md);
      expect(images).toContain('images/diagram.svg');
    });

    it('skips absolute URLs', () => {
      const md = '![Logo](https://example.com/logo.png)\n![Local](images/local.png)';
      const images = scanMarkdownImages(md);
      expect(images).not.toContain('https://example.com/logo.png');
      expect(images).toContain('images/local.png');
    });

    it('deduplicates references', () => {
      const md = '![a](img.png)\n![b](img.png)';
      const images = scanMarkdownImages(md);
      expect(images).toEqual(['img.png']);
    });

    it('returns empty array for no images', () => {
      const md = '# Just text\nNo images here.';
      expect(scanMarkdownImages(md)).toEqual([]);
    });
  });

  describe('scanCssUrls', () => {
    it('extracts url() references', () => {
      const css = '.bg { background: url(images/pattern.png); }';
      const urls = scanCssUrls(css);
      expect(urls).toContain('images/pattern.png');
    });

    it('handles quoted urls', () => {
      const css = '@font-face { src: url("fonts/custom.woff2"); }';
      const urls = scanCssUrls(css);
      expect(urls).toContain('fonts/custom.woff2');
    });

    it('skips absolute URLs', () => {
      const css = '.bg { background: url(https://cdn.example.com/bg.png); }';
      expect(scanCssUrls(css)).toEqual([]);
    });

    it('skips data: URIs', () => {
      const css = '.icon { background: url(data:image/svg+xml,...); }';
      expect(scanCssUrls(css)).toEqual([]);
    });
  });

  describe('buildManifest', () => {
    it('builds a complete manifest from config, markdown, and CSS', () => {
      const config = { content: 'README.md', styles: ['local.css'] };
      const markdown = '# Slide\n![](images/photo.jpg)\n[](.bg,bgurl(images/hero.webp))';
      const css = '.custom { background: url(images/pattern.png); }';

      const manifest = buildManifest('deck/config.json', config, markdown, css);

      expect(manifest.configPath).toBe('config.json');
      expect(manifest.contentPath).toBe('README.md');
      expect(manifest.stylePaths).toEqual(['local.css']);
      expect(manifest.imagePaths).toContain('images/photo.jpg');
      expect(manifest.imagePaths).toContain('images/hero.webp');
      expect(manifest.imagePaths).toContain('images/pattern.png');
    });

    it('deduplicates images across markdown and CSS', () => {
      const config = { content: 'README.md' };
      const markdown = '![](images/shared.png)';
      const css = '.bg { background: url(images/shared.png); }';

      const manifest = buildManifest('config.json', config, markdown, css);
      const sharedCount = manifest.imagePaths.filter((p) => p === 'images/shared.png').length;
      expect(sharedCount).toBe(1);
    });

    it('handles config with no styles', () => {
      const config = { content: 'README.md' };
      const manifest = buildManifest('config.json', config, '# Hello', '');
      expect(manifest.stylePaths).toEqual([]);
    });
  });
});
