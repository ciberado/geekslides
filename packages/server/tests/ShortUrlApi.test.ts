/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument */
/**
 * Unit tests for ShortUrlApi.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { handleShortUrl, clearStore, getStoreSize } from '../src/ShortUrlApi.ts';
import { IncomingMessage } from 'node:http';
import { Socket } from 'node:net';

function createMockReq(method: string, url: string, body?: string): IncomingMessage {
  const socket = new Socket();
  const req = new IncomingMessage(socket);
  req.method = method;
  req.url = url;
  req.headers = { host: 'localhost:3000' };

  if (body) {
    process.nextTick(() => {
      req.emit('data', Buffer.from(body));
      req.emit('end');
    });
  } else {
    process.nextTick(() => {
      req.emit('end');
    });
  }

  return req;
}

function createMockRes(): any {
  const res: any = {
    _status: 200,
    _body: '',
    _headers: {} as Record<string, string>,
    writeHead(status: number, headers?: Record<string, string>) {
      res._status = status;
      if (headers) {
        for (const [k, v] of Object.entries(headers)) {
          res._headers[k] = String(v);
        }
      }
    },
    end(body?: string) {
      if (body) res._body = body;
    },
    setHeader(name: string, value: string) {
      res._headers[name] = value;
    },
  };
  return res;
}

describe('ShortUrlApi', () => {
  beforeEach(() => {
    clearStore();
  });

  describe('POST /api/short', () => {
    it('creates a short URL', async () => {
      const req = createMockReq('POST', '/api/short', JSON.stringify({ url: 'https://example.com/long-url' }));
      const res = createMockRes();

      const handled = await handleShortUrl(req, res);
      expect(handled).toBe(true);
      expect(res._status).toBe(201);

      const body = JSON.parse(res._body) as { id: string; short: string };
      expect(body.id).toHaveLength(6);
      expect(body.short).toContain('/s/');
      expect(getStoreSize()).toBe(1);
    });

    it('returns existing short URL for same original', async () => {
      const url = 'https://example.com/same-url';

      const req1 = createMockReq('POST', '/api/short', JSON.stringify({ url }));
      const res1 = createMockRes();
      await handleShortUrl(req1, res1);

      const req2 = createMockReq('POST', '/api/short', JSON.stringify({ url }));
      const res2 = createMockRes();
      await handleShortUrl(req2, res2);

      expect(res2._status).toBe(200);
      const body1 = JSON.parse(res1._body) as { id: string };
      const body2 = JSON.parse(res2._body) as { id: string };
      expect(body1.id).toBe(body2.id);
      expect(getStoreSize()).toBe(1);
    });

    it('rejects missing url field', async () => {
      const req = createMockReq('POST', '/api/short', JSON.stringify({ notUrl: 'bad' }));
      const res = createMockRes();

      await handleShortUrl(req, res);
      expect(res._status).toBe(400);
    });

    it('rejects invalid JSON', async () => {
      const req = createMockReq('POST', '/api/short', 'not json');
      const res = createMockRes();

      await handleShortUrl(req, res);
      expect(res._status).toBe(400);
    });

    it('rejects GET method', async () => {
      const req = createMockReq('GET', '/api/short');
      const res = createMockRes();

      await handleShortUrl(req, res);
      expect(res._status).toBe(405);
    });
  });

  describe('GET /s/:id', () => {
    it('redirects to original URL', async () => {
      // First create a short URL
      const createReq = createMockReq('POST', '/api/short', JSON.stringify({ url: 'https://example.com/target' }));
      const createRes = createMockRes();
      await handleShortUrl(createReq, createRes);
      const { id } = JSON.parse(createRes._body) as { id: string };

      // Now request the redirect
      const redirectReq = createMockReq('GET', `/s/${id}`);
      const redirectRes = createMockRes();
      const handled = await handleShortUrl(redirectReq, redirectRes);

      expect(handled).toBe(true);
      expect(redirectRes._status).toBe(302);
      expect(redirectRes._headers['Location']).toBe('https://example.com/target');
    });

    it('returns 404 for unknown ID', async () => {
      const req = createMockReq('GET', '/s/unknown');
      const res = createMockRes();

      const handled = await handleShortUrl(req, res);
      expect(handled).toBe(true);
      expect(res._status).toBe(404);
    });
  });

  describe('unhandled routes', () => {
    it('returns false for non-matching paths', async () => {
      const req = createMockReq('GET', '/api/other');
      const res = createMockRes();

      const handled = await handleShortUrl(req, res);
      expect(handled).toBe(false);
    });
  });
});
