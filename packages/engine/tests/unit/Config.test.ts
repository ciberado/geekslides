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
    expect(config.content).toEqual(['slides.md']);
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

  it('accepts an array of content files', async () => {
    mockFetchJson({ content: ['part1.md', 'part2.md', 'part3.md'] });
    const config = await loadConfig('config.json');
    expect(config.content).toEqual(['part1.md', 'part2.md', 'part3.md']);
  });

  it('normalises a single string content to a one-element array', async () => {
    mockFetchJson({ content: 'README.md' });
    const config = await loadConfig('config.json');
    expect(config.content).toEqual(['README.md']);
  });

  it('throws when content is an empty array', async () => {
    mockFetchJson({ content: [] });
    await expect(loadConfig('config.json')).rejects.toThrow("'content'");
  });

  it('coerces root-level preprocessors into plugins.preprocessors', async () => {
    mockFetchJson({ content: 'README.md', preprocessors: ['headerPreprocessor'] });
    const config = await loadConfig('config.json');
    expect(config.plugins.preprocessors).toEqual(['headerPreprocessor']);
  });

  it('coerces root-level processors into plugins.processors', async () => {
    mockFetchJson({ content: 'README.md', processors: ['myProcessor'] });
    const config = await loadConfig('config.json');
    expect(config.plugins.processors).toEqual(['myProcessor']);
  });

  it('converts legacy resolution field to aspectRatio', async () => {
    mockFetchJson({ content: 'README.md', resolution: '1920x1080' });
    const config = await loadConfig('config.json');
    expect(config.aspectRatio).toBe('16/9');
  });

  it('converts 4:3 resolution to aspectRatio', async () => {
    mockFetchJson({ content: 'README.md', resolution: '1024x768' });
    const config = await loadConfig('config.json');
    expect(config.aspectRatio).toBe('4/3');
  });

  it('coerces styles string to array', async () => {
    mockFetchJson({ content: 'README.md', styles: 'styles.css' });
    const config = await loadConfig('config.json');
    expect(config.styles).toEqual(['styles.css']);
  });

  it('excludes whiteboard feature when slideWhiteBoards is false', async () => {
    mockFetchJson({ content: 'README.md', slideWhiteBoards: false });
    const config = await loadConfig('config.json');
    expect(config.features).not.toContain('whiteboard');
  });

  it('keeps whiteboard feature when slideWhiteBoards is true', async () => {
    mockFetchJson({ content: 'README.md', slideWhiteBoards: true });
    const config = await loadConfig('config.json');
    expect(config.features).toContain('whiteboard');
  });

  it('silently ignores liveReload field', async () => {
    mockFetchJson({ content: 'README.md', liveReload: true });
    const config = await loadConfig('config.json');
    expect(config.content).toEqual(['README.md']);
  });

  it('parses scripts field as string array', async () => {
    mockFetchJson({ content: 'README.md', scripts: ['./components/widget.js', './components/chart.js'] });
    const config = await loadConfig('config.json');
    expect(config.scripts).toEqual(['./components/widget.js', './components/chart.js']);
  });

  it('defaults scripts to empty array when not provided', async () => {
    mockFetchJson({ content: 'README.md' });
    const config = await loadConfig('config.json');
    expect(config.scripts).toEqual([]);
  });

  it('coerces scripts string to array', async () => {
    mockFetchJson({ content: 'README.md', scripts: './components/widget.js' });
    const config = await loadConfig('config.json');
    expect(config.scripts).toEqual(['./components/widget.js']);
  });

  it('defaults scripts to empty array for non-array non-string value', async () => {
    mockFetchJson({ content: 'README.md', scripts: 42 });
    const config = await loadConfig('config.json');
    expect(config.scripts).toEqual([]);
  });

  it('defaults scripts to empty array for boolean value', async () => {
    mockFetchJson({ content: 'README.md', scripts: true });
    const config = await loadConfig('config.json');
    expect(config.scripts).toEqual([]);
  });

  it('defaults scripts to empty array for object value', async () => {
    mockFetchJson({ content: 'README.md', scripts: { file: 'app.js' } });
    const config = await loadConfig('config.json');
    expect(config.scripts).toEqual([]);
  });

  it('preserves remote script URLs in scripts array', async () => {
    mockFetchJson({ content: 'README.md', scripts: ['https://cdn.example.com/widget.js', './local.js'] });
    const config = await loadConfig('config.json');
    expect(config.scripts).toEqual(['https://cdn.example.com/widget.js', './local.js']);
  });

  it('accepts full legacy v1 config shape', async () => {
    mockFetchJson({
      content: ['README.md'],
      styles: ['local.css'],
      resolution: '1920x1080',
      liveReload: true,
      slideWhiteBoards: false,
      preprocessors: ['headerPreprocessor'],
      processors: [],
      scripts: ['app.js'],
    });
    const config = await loadConfig('config.json');
    expect(config.content).toEqual(['README.md']);
    expect(config.styles).toEqual(['local.css']);
    expect(config.aspectRatio).toBe('16/9');
    expect(config.plugins.preprocessors).toEqual(['headerPreprocessor']);
    expect(config.plugins.processors).toEqual([]);
    expect(config.features).not.toContain('whiteboard');
    expect(config.scripts).toEqual(['app.js']);
  });

  describe('Plugin bundle syntax (plugins: string[])', () => {
    it('expands a single bundle into preprocessors, processors, and features', async () => {
      mockFetchJson({ content: 'README.md', plugins: ['whiteboard'] });
      const config = await loadConfig('config.json');
      expect(config.features).toContain('whiteboard');
      expect(config.plugins.preprocessors).toEqual([]);
      expect(config.plugins.processors).toEqual([]);
    });

    it('expands the media bundle including its core dependency', async () => {
      mockFetchJson({ content: 'README.md', plugins: ['media'] });
      const config = await loadConfig('config.json');
      // Core dependency contributes header + iframe
      expect(config.plugins.preprocessors).toContain('header');
      expect(config.plugins.processors).toContain('iframe');
      // Media itself contributes its preprocessors and processors
      expect(config.plugins.preprocessors).toContain('youtube-url');
      expect(config.plugins.preprocessors).toContain('audio-url');
      expect(config.plugins.processors).toContain('video');
      // media-sync feature
      expect(config.features).toContain('media-sync');
      expect(config.features).not.toContain('whiteboard');
    });

    it('merges multiple bundles, deduplicating shared dependencies', async () => {
      // Both media and a hypothetical second bundle depending on core
      // should not duplicate header/iframe
      mockFetchJson({ content: 'README.md', plugins: ['media', 'whiteboard'] });
      const config = await loadConfig('config.json');
      const ppCount = config.plugins.preprocessors.filter((p) => p === 'header').length;
      expect(ppCount).toBe(1);
      const procCount = config.plugins.processors.filter((p) => p === 'iframe').length;
      expect(procCount).toBe(1);
      expect(config.features).toContain('media-sync');
      expect(config.features).toContain('whiteboard');
    });

    it('merges bundle features with explicit features', async () => {
      mockFetchJson({ content: 'README.md', plugins: ['media'], features: ['poll'] });
      const config = await loadConfig('config.json');
      expect(config.features).toContain('media-sync');
      expect(config.features).toContain('poll');
    });

    it('deduplicates when a feature appears in both a bundle and the features list', async () => {
      mockFetchJson({ content: 'README.md', plugins: ['whiteboard'], features: ['whiteboard'] });
      const config = await loadConfig('config.json');
      const count = config.features.filter((f) => f === 'whiteboard').length;
      expect(count).toBe(1);
    });

    it('throws on an unknown bundle name', async () => {
      mockFetchJson({ content: 'README.md', plugins: ['does-not-exist'] });
      await expect(loadConfig('config.json')).rejects.toThrow("Unknown plugin bundle: 'does-not-exist'");
    });

    it('expands the chart bundle', async () => {
      mockFetchJson({ content: 'README.md', plugins: ['chart'] });
      const config = await loadConfig('config.json');
      expect(config.plugins.processors).toContain('chart');
    });

    it('expands the css-doodle bundle', async () => {
      mockFetchJson({ content: 'README.md', plugins: ['css-doodle'] });
      const config = await loadConfig('config.json');
      expect(config.plugins.preprocessors).toContain('css-doodle');
      expect(config.plugins.processors).toContain('css-doodle');
    });
  });

  describe('Default features', () => {
    it('defaults features to empty array when not provided', async () => {
      mockFetchJson({ content: 'README.md' });
      const config = await loadConfig('config.json');
      expect(config.features).toEqual([]);
    });
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

  it('preserves the JSON SyntaxError as the cause when JSON is invalid', async () => {
    mockFetchText('{ broken json }', 'application/json');
    const err = await loadConfig('config.json').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(Error);
    const error = err as Error;
    // The cause must be the original SyntaxError — not swallowed
    expect(error.cause).toBeInstanceOf(SyntaxError);
    // The wrapper message must include parse detail from the SyntaxError
    expect(error.message).toContain('not valid JSON');
    expect(error.message).toContain('config.json');
  });

  it('includes the JSON parse position/detail in the error message', async () => {
    mockFetchText('{"title": "ok", "broken": }', 'application/json');
    const err = await loadConfig('config.json').catch((e: unknown) => e);
    const error = err as Error;
    // SyntaxError.message typically mentions "Unexpected token" or position info
    // — verify the detail surfaces in the wrapper message, not just "invalid JSON"
    expect(error.message).toContain('not valid JSON');
    expect(error.message.length).toBeGreaterThan(50);
  });

  it('preserves the network error as cause when fetch throws', async () => {
    const networkError = new TypeError('Failed to fetch');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(networkError));
    const err = await loadConfig('config.json').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(Error);
    const error = err as Error;
    expect(error.cause).toBe(networkError);
    expect(error.message).toContain('Network error');
    expect(error.message).toContain('config.json');
  });

  it('includes actionable hint for 404 config fetch failures', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    }));
    const err = await loadConfig('config.json').catch((e: unknown) => e);
    const error = err as Error;
    expect(error.message).toContain('404');
    expect(error.message).toContain('geekslides create');
  });
});
