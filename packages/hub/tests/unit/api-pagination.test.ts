import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiClient } from '../../src/client/services/api.ts';

function toUrlString(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

describe('ApiClient pagination', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('listAllPresentations loops across pages until a short page', async () => {
    const seen: string[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
      const url = toUrlString(input);
      seen.push(url);
      const offset = Number(new URL(url, 'http://localhost').searchParams.get('offset') ?? '0');
      const items =
        offset === 0
          ? Array.from({ length: 100 }, (_, i) => ({ id: `p${String(i)}`, title: `Deck ${i}` }))
          : offset === 100
            ? [{ id: 'p-edge', title: 'Third page item' }]
            : [];
      return new Response(JSON.stringify({ items }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    globalThis.fetch = fetchMock as typeof fetch;

    const items = await new ApiClient().listAllPresentations();

    expect(items).toHaveLength(101);
    // A full first page (100) triggers the next request; a short page stops it.
    expect(items[0]!.id).toBe('p0');
    expect(items[100]!.id).toBe('p-edge');
    expect(seen).toEqual([
      '/hub/api/presentations?limit=100&offset=0',
      '/hub/api/presentations?limit=100&offset=100',
    ]);
  });

  it('listAllPresentations returns the full set when it fits one page', async () => {
    const fetchMock = vi.fn(async (): Promise<Response> => {
      return new Response(JSON.stringify({ items: [{ id: 'only' }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    globalThis.fetch = fetchMock as typeof fetch;

    const items = await new ApiClient().listAllPresentations();

    expect(items).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
