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

  it('createRoom continues to next candidate when fetch() throws a network error', async () => {
    let callCount = 0;
    const fetchMock = vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
      const url = toUrlString(input);
      callCount++;
      if (url === 'https://example.com/hub/api/rooms/room-3/share') {
        throw new TypeError('fetch failed');
      }
      if (url === 'https://example.com/api/rooms/room-3/share') {
        return new Response(
          JSON.stringify({ room: 'room-3', presenterToken: 'p2', viewerToken: 'v2' }),
          { status: 201, headers: { 'Content-Type': 'application/json' } },
        );
      }
      return new Response('', { status: 500 });
    });

    globalThis.fetch = fetchMock as typeof fetch;

    const result = await createRoom('https://example.com/hub', 'room-3');
    expect(result.room).toBe('room-3');
    expect(callCount).toBe(2);
  });

  it('uploadContent continues to next candidate when fetch() throws a network error', async () => {
    let callCount = 0;
    const fetchMock = vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
      const url = toUrlString(input);
      callCount++;
      if (url === 'https://example.com/hub/api/rooms/room-4/content') {
        throw new TypeError('fetch failed');
      }
      if (url === 'https://example.com/api/rooms/room-4/content') {
        return new Response(
          JSON.stringify({ room: 'room-4', files: ['config.json'], totalSize: 10 }),
          { status: 201, headers: { 'Content-Type': 'application/json' } },
        );
      }
      return new Response('', { status: 500 });
    });

    globalThis.fetch = fetchMock as typeof fetch;

    const result = await uploadContent('https://example.com/hub', 'room-4', [
      { path: 'config.json', data: Buffer.from('{}') },
    ]);
    expect(result.room).toBe('room-4');
    expect(callCount).toBe(2);
  });

  it('createRoom throws with descriptive message when all candidates fail with network error', async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new TypeError('fetch failed');
    }) as typeof fetch;

    await expect(createRoom('http://localhost:1234', 'room-x')).rejects.toThrow(
      'Cannot reach yjs-server at http://localhost:1234: fetch failed',
    );
  });
});
