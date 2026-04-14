/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { handleContentUpdate, type HotClientOptions } from '../../src/hmr/hot-client.ts';
import type { ContentUpdatePayload } from '../../src/hmr/vite-plugin-geekslides-hmr.ts';

function createMockOptions(overrides: Partial<HotClientOptions> = {}): HotClientOptions {
  return {
    fetchMarkdown: vi.fn().mockResolvedValue('# Updated\n\n---\n\n## Slide 2'),
    fetchStyles: vi.fn().mockResolvedValue('h1 { color: red; }'),
    fetchConfig: vi.fn().mockResolvedValue({ title: 'Updated' }),
    reloadSlides: vi.fn(),
    applyStyles: vi.fn(),
    applyConfig: vi.fn(),
    getCurrentConfig: vi.fn().mockReturnValue({
      title: 'Original',
      content: 'README.md',
      plugins: { preprocessors: ['header'], processors: [] },
      sync: { enabled: true, server: 'ws://localhost:1234', room: 'default' },
      styles: ['css/local.css'],
    }),
    getCurrentSlide: vi.fn().mockReturnValue(2),
    getCurrentPartial: vi.fn().mockReturnValue(1),
    goTo: vi.fn(),
    getSlideCount: vi.fn().mockReturnValue(5),
    getStyleSheetPaths: vi.fn().mockReturnValue(['css/local.css']),
    ...overrides,
  };
}

describe('hot-client', () => {
  describe('markdown update', () => {
    it('re-fetches markdown and reloads slides', async () => {
      const options = createMockOptions();
      const payload: ContentUpdatePayload = { file: 'README.md', type: 'markdown', timestamp: 1 };

      await handleContentUpdate(payload, options);

      expect(options.fetchMarkdown).toHaveBeenCalled();
      expect(options.reloadSlides).toHaveBeenCalledWith('# Updated\n\n---\n\n## Slide 2');
    });

    it('preserves slide position after reload', async () => {
      const options = createMockOptions();
      const payload: ContentUpdatePayload = { file: 'README.md', type: 'markdown', timestamp: 1 };

      await handleContentUpdate(payload, options);

      expect(options.goTo).toHaveBeenCalledWith(2, 1);
    });

    it('clamps position if slides were removed', async () => {
      const options = createMockOptions({
        getCurrentSlide: vi.fn().mockReturnValue(10),
        getCurrentPartial: vi.fn().mockReturnValue(3),
        getSlideCount: vi.fn().mockReturnValue(5),
      });
      const payload: ContentUpdatePayload = { file: 'README.md', type: 'markdown', timestamp: 1 };

      await handleContentUpdate(payload, options);

      // Should clamp to last slide (index 4), partial reset to 0
      expect(options.goTo).toHaveBeenCalledWith(4, 0);
    });
  });

  describe('config update', () => {
    it('applies non-structural config changes', async () => {
      const options = createMockOptions({
        fetchConfig: vi.fn().mockResolvedValue({
          title: 'New Title',
          content: 'README.md',
          plugins: { preprocessors: ['header'], processors: [] },
          sync: { enabled: true, server: 'ws://localhost:1234', room: 'default' },
          styles: ['css/local.css'],
        }),
      });
      const payload: ContentUpdatePayload = { file: 'config.json', type: 'config', timestamp: 1 };

      await handleContentUpdate(payload, options);

      expect(options.applyConfig).toHaveBeenCalledWith({
        title: 'New Title',
        content: 'README.md',
        plugins: { preprocessors: ['header'], processors: [] },
        sync: { enabled: true, server: 'ws://localhost:1234', room: 'default' },
        styles: ['css/local.css'],
      });
    });

    it('triggers full reload for structural changes', async () => {
      const reloadMock = vi.fn();
      Object.defineProperty(globalThis, 'location', {
        value: { reload: reloadMock },
        writable: true,
        configurable: true,
      });

      const options = createMockOptions({
        fetchConfig: vi.fn().mockResolvedValue({
          title: 'Original',
          content: 'README.md',
          plugins: { preprocessors: ['header'], processors: ['iframe'] },
          sync: { enabled: true, server: 'ws://localhost:1234', room: 'default' },
          styles: ['css/local.css'],
        }),
      });
      const payload: ContentUpdatePayload = { file: 'config.json', type: 'config', timestamp: 1 };

      await handleContentUpdate(payload, options);

      expect(reloadMock).toHaveBeenCalled();
      expect(options.applyConfig).not.toHaveBeenCalled();
    });
  });

  describe('style update', () => {
    it('re-fetches and reapplies matching author styles', async () => {
      const options = createMockOptions();
      const payload: ContentUpdatePayload = { file: 'css/local.css', type: 'style', timestamp: 12345 };

      await handleContentUpdate(payload, options);

      expect(options.fetchStyles).toHaveBeenCalled();
      expect(options.applyStyles).toHaveBeenCalledWith('h1 { color: red; }');
    });

    it('ignores unrelated stylesheets', async () => {
      const options = createMockOptions();
      const payload: ContentUpdatePayload = { file: 'css/unrelated.css', type: 'style', timestamp: 12345 };

      await handleContentUpdate(payload, options);

      expect(options.fetchStyles).not.toHaveBeenCalled();
      expect(options.applyStyles).not.toHaveBeenCalled();
    });
  });
});
