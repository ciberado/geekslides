import { describe, expect, it, vi } from 'vitest';
import { SlideMapClient } from '../src/sync/slide-map-client.ts';

describe('SlideMapClient', () => {
  it('loads a slide map and resolves line lookups', async () => {
    const client = new SlideMapClient(vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        { slideIndex: 0, sourceLineStart: 1, sourceLineEnd: 5, id: 'intro' },
        { slideIndex: 1, sourceLineStart: 5, sourceLineEnd: 9, id: 'demo' },
      ],
    }) as typeof fetch);

    await client.refresh('http://localhost:5173');

    expect(client.getSlideForLine(0)).toBe(0);
    expect(client.getSlideForLine(5)).toBe(1);
    expect(client.getLineForSlide(1)).toBe(4);
  });

  it('returns undefined for lines outside any slide range', async () => {
    const client = new SlideMapClient(vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        { slideIndex: 0, sourceLineStart: 5, sourceLineEnd: 10, id: 'only' },
      ],
    }) as typeof fetch);

    await client.refresh('http://localhost:5173');

    // Line 3 is 0-based → source line 4, which is before slide start (5)
    expect(client.getSlideForLine(3)).toBeUndefined();
    // Line 10 is 0-based → source line 11, which is past slide end (10 exclusive)
    expect(client.getSlideForLine(10)).toBeUndefined();
  });

  it('returns undefined for a slide index that does not exist', async () => {
    const client = new SlideMapClient(vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        { slideIndex: 0, sourceLineStart: 1, sourceLineEnd: 5, id: 'a' },
      ],
    }) as typeof fetch);

    await client.refresh('http://localhost:5173');
    expect(client.getLineForSlide(99)).toBeUndefined();
  });

  it('throws on HTTP error', async () => {
    const client = new SlideMapClient(vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    }) as typeof fetch);

    await expect(client.refresh('http://localhost:5173')).rejects.toThrow('HTTP 500');
  });

  it('filters out malformed entries', async () => {
    const client = new SlideMapClient(vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        { slideIndex: 0, sourceLineStart: 1, sourceLineEnd: 5, id: 'good' },
        { slideIndex: 'bad', sourceLineStart: 5, sourceLineEnd: 10, id: 'bad' },
        null,
        42,
        { slideIndex: 1 }, // missing fields
      ],
    }) as typeof fetch);

    await client.refresh('http://localhost:5173');
    expect(client.entries).toHaveLength(1);
    expect(client.entries[0]?.id).toBe('good');
  });

  it('replaces previous entries on refresh', async () => {
    const fetchMock = vi.fn();
    const client = new SlideMapClient(fetchMock as typeof fetch);

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        { slideIndex: 0, sourceLineStart: 1, sourceLineEnd: 5, id: 'v1' },
      ],
    });
    await client.refresh('http://localhost:5173');
    expect(client.entries[0]?.id).toBe('v1');

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        { slideIndex: 0, sourceLineStart: 1, sourceLineEnd: 3, id: 'v2' },
        { slideIndex: 1, sourceLineStart: 3, sourceLineEnd: 7, id: 'v2b' },
      ],
    });
    await client.refresh('http://localhost:5173');
    expect(client.entries).toHaveLength(2);
    expect(client.entries[0]?.id).toBe('v2');
  });
});
