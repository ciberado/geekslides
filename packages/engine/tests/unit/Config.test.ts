import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadConfig, DEFAULT_CONFIG } from '../../src/core/Config.ts';

function mockFetchJson(body: unknown, contentType = 'application/json'): void {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    headers: new Headers({ 'content-type': contentType }),
    text: () => Promise.resolve(JSON.stringify(body)),
  }));
}

function mockFetchText(body: string, contentType = 'text/plain'): void {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    headers: new Headers({ 'content-type': contentType }),
    text: () => Promise.resolve(body),
  }));
}

describe('Config', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('applies defaults for missing optional fields', async () => {
    mockFetchJson({ content: 'slides.md' });

    const config = await loadConfig('config.json');
    expect(config.title).toBe(DEFAULT_CONFIG.title);
    expect(config.content).toBe('slides.md');
    expect(config.aspectRatio).toBe('16/9');
    expect(config.sync.enabled).toBe(true);
    expect(config.plugins.preprocessors).toEqual(['header']);
  });

  it('throws when content field is missing', async () => {
    mockFetchJson({ title: 'Test' });
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
    mockFetchJson({
      title: 'My Talk',
      content: 'README.md',
      aspectRatio: '4/3',
      styles: ['theme.css'],
      sync: { enabled: true, server: 'wss://example.com', room: 'room1' },
      plugins: { preprocessors: ['custom'], processors: [] },
    });

    const config = await loadConfig('config.json');
    expect(config.title).toBe('My Talk');
    expect(config.aspectRatio).toBe('4/3');
    expect(config.styles).toEqual(['theme.css']);
    expect(config.sync.enabled).toBe(true);
    expect(config.sync.server).toBe('wss://example.com');
    expect(config.plugins.preprocessors).toEqual(['custom']);
    expect(config.plugins.processors).toEqual([]);
  });

  it('rejects array content from the archived v1 config shape', async () => {
    mockFetchJson({ content: ['README.md'] });
    await expect(loadConfig('config.json')).rejects.toThrow("'content' must be a single string path");
  });

  it('rejects root-level legacy plugin fields', async () => {
    mockFetchJson({
      content: 'README.md',
      preprocessors: ['headerPreprocessor'],
    });
    await expect(loadConfig('config.json')).rejects.toThrow("plugins.preprocessors");
  });

  it('rejects legacy resolution field', async () => {
    mockFetchJson({
      content: 'README.md',
      resolution: '1920x1080',
    });
    await expect(loadConfig('config.json')).rejects.toThrow("'resolution'");
  });

  it('throws a clear error when the server returns HTML instead of JSON', async () => {
    mockFetchText(
      '<!DOCTYPE html><html><body>SPA fallback</body></html>',
      'text/html',
    );
    await expect(loadConfig('/@fs/tmp/deck/config.json')).rejects.toThrow('Expected JSON but received HTML');
    await expect(loadConfig('/@fs/tmp/deck/config.json')).rejects.toThrow('/@fs/tmp/deck/config.json');
  });

  it('detects HTML by content even without text/html content-type', async () => {
    mockFetchText(
      '<!DOCTYPE html><html><body>fallback</body></html>',
      'application/octet-stream',
    );
    await expect(loadConfig('config.json')).rejects.toThrow('Expected JSON but received HTML');
  });

  it('throws a descriptive error for invalid JSON content', async () => {
    mockFetchText('not json at all', 'application/json');
    await expect(loadConfig('config.json')).rejects.toThrow('not valid JSON');
    await expect(loadConfig('config.json')).rejects.toThrow('config.json');
  });
});
