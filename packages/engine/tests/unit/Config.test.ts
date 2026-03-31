import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadConfig, DEFAULT_CONFIG } from '../../src/core/Config.ts';

describe('Config', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('applies defaults for missing optional fields', async () => {
    const mockJson = { content: 'slides.md' };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockJson),
    }));

    const config = await loadConfig('config.json');
    expect(config.title).toBe(DEFAULT_CONFIG.title);
    expect(config.content).toBe('slides.md');
    expect(config.aspectRatio).toBe('16/9');
    expect(config.sync.enabled).toBe(false);
    expect(config.plugins.preprocessors).toEqual(['header']);
  });

  it('throws when content field is missing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ title: 'Test' }),
    }));

    await expect(loadConfig('config.json')).rejects.toThrow("'content'");
  });

  it('throws on fetch failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    }));

    await expect(loadConfig('config.json')).rejects.toThrow('404');
  });

  it('overrides defaults with provided values', async () => {
    const mockJson = {
      title: 'My Talk',
      content: 'README.md',
      aspectRatio: '4/3',
      styles: ['theme.css'],
      sync: { enabled: true, server: 'wss://example.com', room: 'room1' },
      plugins: { preprocessors: ['custom'], processors: [] },
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockJson),
    }));

    const config = await loadConfig('config.json');
    expect(config.title).toBe('My Talk');
    expect(config.aspectRatio).toBe('4/3');
    expect(config.styles).toEqual(['theme.css']);
    expect(config.sync.enabled).toBe(true);
    expect(config.sync.server).toBe('wss://example.com');
    expect(config.plugins.preprocessors).toEqual(['custom']);
    expect(config.plugins.processors).toEqual([]);
  });
});
