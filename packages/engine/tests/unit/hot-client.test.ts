/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { handleContentUpdate, type HotClientOptions } from '../../src/hmr/hot-client.ts';
import type { ContentUpdatePayload } from '../../src/hmr/vite-plugin-geekslides-hmr.ts';

function createMockOptions(overrides: Partial<HotClientOptions> = {}): HotClientOptions {
  return {
    fetchMarkdown: vi.fn().mockResolvedValue('# Updated\n\n---\n\n## Slide 2'),
    fetchConfig: vi.fn().mockResolvedValue({ title: 'Updated' }),
    reloadSlides: vi.fn(),
    applyConfig: vi.fn(),
    getCurrentSlide: vi.fn().mockReturnValue(2),
    getCurrentPartial: vi.fn().mockReturnValue(1),
    goTo: vi.fn(),
    getSlideCount: vi.fn().mockReturnValue(5),
    styleSheets: ['css/local.css'],
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
        fetchConfig: vi.fn().mockResolvedValue({ title: 'New Title' }),
      });
      const payload: ContentUpdatePayload = { file: 'config.json', type: 'config', timestamp: 1 };

      await handleContentUpdate(payload, options);

      expect(options.applyConfig).toHaveBeenCalledWith({ title: 'New Title' });
    });

    it('triggers full reload for structural changes', async () => {
      const reloadMock = vi.fn();
      Object.defineProperty(globalThis, 'location', {
        value: { reload: reloadMock },
        writable: true,
        configurable: true,
      });

      const options = createMockOptions({
        fetchConfig: vi.fn().mockResolvedValue({ plugins: ['new-plugin'] }),
      });
      const payload: ContentUpdatePayload = { file: 'config.json', type: 'config', timestamp: 1 };

      await handleContentUpdate(payload, options);

      expect(reloadMock).toHaveBeenCalled();
      expect(options.applyConfig).not.toHaveBeenCalled();
    });
  });

  describe('style update', () => {
    it('cache-busts matching stylesheet link', async () => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'css/local.css';
      document.head.appendChild(link);

      const options = createMockOptions();
      const payload: ContentUpdatePayload = { file: 'css/local.css', type: 'style', timestamp: 12345 };

      await handleContentUpdate(payload, options);

      expect(link.href).toContain('css/local.css?t=12345');

      document.head.removeChild(link);
    });
  });
});
