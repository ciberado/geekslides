import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRoom, uploadContent } from '../../src/server/services/server-client.ts';

function toUrlString(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

describe('server-client service', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('retries room creation without /hub suffix when SERVER_BASE_URL includes /hub', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
      const url = toUrlString(input);
      if (url === 'https://example.com/hub/api/rooms/room-1/share') {
        return new Response(JSON.stringify({ error: 'Not found' }), {
          status: 404,
          statusText: 'Not Found',
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url === 'https://example.com/api/rooms/room-1/share') {
        return new Response(
          JSON.stringify({ room: 'room-1', presenterToken: 'p', viewerToken: 'v' }),
          {
            status: 201,
            headers: { 'Content-Type': 'application/json' },
          },
        );
      }

      return new Response(JSON.stringify({ error: 'Unexpected URL' }), { status: 500 });
    });

    globalThis.fetch = fetchMock as typeof fetch;

    const result = await createRoom('https://example.com/hub', 'room-1');

    expect(result.room).toBe('room-1');
    expect(result.presenterToken).toBe('p');
    expect(result.viewerToken).toBe('v');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('retries content upload without /hub suffix when SERVER_BASE_URL includes /hub', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
      const url = toUrlString(input);
      if (url === 'https://example.com/hub/api/rooms/room-2/content') {
        return new Response(JSON.stringify({ error: 'Not found' }), {
          status: 404,
          statusText: 'Not Found',
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url === 'https://example.com/api/rooms/room-2/content') {
        return new Response(
          JSON.stringify({ room: 'room-2', files: ['config.json'], totalSize: 12 }),
          {
            status: 201,
            headers: { 'Content-Type': 'application/json' },
          },
        );
      }

      return new Response(JSON.stringify({ error: 'Unexpected URL' }), { status: 500 });
    });

    globalThis.fetch = fetchMock as typeof fetch;

    const result = await uploadContent('https://example.com/hub', 'room-2', [
      { path: 'config.json', data: Buffer.from('{"title":"Deck"}') },
    ]);

    expect(result.room).toBe('room-2');
    expect(result.files).toEqual(['config.json']);
    expect(result.totalSize).toBe(12);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
