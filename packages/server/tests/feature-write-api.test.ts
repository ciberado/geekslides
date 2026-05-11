/**
 * Tests for the generic feature-write HTTP endpoint.
 *
 * Tests the handler directly without a real HTTP server to keep tests fast.
 * The FeatureWriteApi is stateless except for its interaction with the
 * y-websocket `docs` map, which we mock.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as Y from 'yjs';
import type { IncomingMessage, ServerResponse } from 'node:http';

// ---------------------------------------------------------------------------
// Mock y-websocket/bin/utils — expose a controllable docs map
// ---------------------------------------------------------------------------

const { mockDocs } = vi.hoisted(() => ({ mockDocs: new Map<string, Y.Doc>() }));

vi.mock('y-websocket/bin/utils', () => ({ docs: mockDocs }));

vi.mock('../src/logging.ts', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

import { handleFeatureWrite, FEATURE_WRITE_PATH } from '../src/FeatureWriteApi.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeReq(opts: {
  method?: string;
  path?: string;
  body?: Record<string, unknown>;
}): IncomingMessage {
  const req = {
    method: opts.method ?? 'POST',
    url: opts.path ?? FEATURE_WRITE_PATH,
    headers: { host: 'localhost' },
    on: vi.fn(),
  } as unknown as IncomingMessage;

  // Simulate readable stream delivering JSON body
  const bodyStr = JSON.stringify(opts.body ?? {});
  let endCb: (() => void) | null = null;
  let dataCb: ((chunk: Buffer) => void) | null = null;

  (req.on as ReturnType<typeof vi.fn>).mockImplementation(
    (event: string, cb: unknown) => {
      if (event === 'data') dataCb = cb as (chunk: Buffer) => void;
      if (event === 'end') endCb = cb as () => void;
      if (event === 'error') { /* noop */ }
      // Emit data + end synchronously after all listeners are registered
      if (dataCb && endCb) {
        dataCb(Buffer.from(bodyStr));
        endCb();
        dataCb = null;
        endCb = null;
      }
    },
  );

  return req;
}

function makeRes(): { res: ServerResponse; status: () => number; body: () => string } {
  let capturedStatus = 0;
  let capturedBody = '';

  const res = {
    writeHead: vi.fn((code: number) => { capturedStatus = code; }),
    end: vi.fn((data: string) => { capturedBody = data; }),
  } as unknown as ServerResponse;

  return {
    res,
    status: () => capturedStatus,
    body: () => capturedBody,
  };
}

function makeDoc(): Y.Doc {
  return new Y.Doc();
}

/** Create a doc with the feature Y.Map pre-initialised (simulating browser presenter). */
function makeDocWithFeature(featureId: string): Y.Doc {
  const doc = new Y.Doc();
  const featureMap = new Y.Map<unknown>();
  doc.transact(() => {
    doc.getMap<Y.Map<unknown>>('features').set(featureId, featureMap);
  });
  return doc;
}

// ---------------------------------------------------------------------------
// Route matching
// ---------------------------------------------------------------------------

describe('handleFeatureWrite — route matching', () => {
  beforeEach(() => { mockDocs.clear(); });

  it('returns false for non-matching paths', async () => {
    const { res } = makeRes();
    const req = makeReq({ path: '/api/other' });
    expect(await handleFeatureWrite(req, res)).toBe(false);
  });

  it('returns false for GET requests on the correct path', async () => {
    const { res } = makeRes();
    const req = makeReq({ method: 'GET', path: FEATURE_WRITE_PATH });
    expect(await handleFeatureWrite(req, res)).toBe(false);
  });

  it('returns true for POST to FEATURE_WRITE_PATH', async () => {
    const doc = makeDoc();
    mockDocs.set('room-x', doc);
    const { res } = makeRes();
    const req = makeReq({
      body: { room: 'room-x', featureId: 'poll', updates: { key: 'val' } },
    });
    expect(await handleFeatureWrite(req, res)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

describe('handleFeatureWrite — input validation', () => {
  beforeEach(() => { mockDocs.clear(); });

  it('returns 400 for invalid JSON body', async () => {
    const req = {
      method: 'POST',
      url: FEATURE_WRITE_PATH,
      headers: { host: 'localhost' },
      on: vi.fn((event: string, cb: unknown) => {
        if (event === 'data') (cb as (b: Buffer) => void)(Buffer.from('not json'));
        if (event === 'end') (cb as () => void)();
      }),
    } as unknown as IncomingMessage;
    const { res, status, body } = makeRes();
    await handleFeatureWrite(req, res);
    expect(status()).toBe(400);
    expect(body()).toContain('Invalid JSON');
  });

  it('returns 400 when room is missing', async () => {
    const { res, status } = makeRes();
    await handleFeatureWrite(makeReq({ body: { featureId: 'poll', updates: { k: 1 } } }), res);
    expect(status()).toBe(400);
  });

  it('returns 400 when featureId is missing', async () => {
    const { res, status } = makeRes();
    await handleFeatureWrite(makeReq({ body: { room: 'r', updates: { k: 1 } } }), res);
    expect(status()).toBe(400);
  });

  it('returns 400 when updates is missing', async () => {
    const { res, status } = makeRes();
    await handleFeatureWrite(makeReq({ body: { room: 'r', featureId: 'poll' } }), res);
    expect(status()).toBe(400);
  });

  it('returns 400 when updates is an array', async () => {
    const { res, status } = makeRes();
    await handleFeatureWrite(makeReq({ body: { room: 'r', featureId: 'poll', updates: [1, 2] } }), res);
    expect(status()).toBe(400);
  });

  it('returns 400 when updates is empty', async () => {
    const { res, status } = makeRes();
    await handleFeatureWrite(makeReq({ body: { room: 'r', featureId: 'poll', updates: {} } }), res);
    expect(status()).toBe(400);
  });

  it('returns 400 when an update value is an object (non-primitive)', async () => {
    const { res, status } = makeRes();
    await handleFeatureWrite(makeReq({
      body: { room: 'r', featureId: 'poll', updates: { k: { nested: true } } },
    }), res);
    expect(status()).toBe(400);
  });

  it('returns 400 when an update value is an array', async () => {
    const { res, status } = makeRes();
    await handleFeatureWrite(makeReq({
      body: { room: 'r', featureId: 'poll', updates: { k: [1, 2] } },
    }), res);
    expect(status()).toBe(400);
  });

  it('accepts null as a valid primitive value', async () => {
    const doc = makeDocWithFeature('f');
    mockDocs.set('room-null', doc);
    const { res, status } = makeRes();
    await handleFeatureWrite(makeReq({
      body: { room: 'room-null', featureId: 'f', updates: { key: null } },
    }), res);
    expect(status()).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// Room lookup
// ---------------------------------------------------------------------------

describe('handleFeatureWrite — room lookup', () => {
  beforeEach(() => { mockDocs.clear(); });

  it('returns 404 when room is not in docs map', async () => {
    const { res, status, body } = makeRes();
    await handleFeatureWrite(makeReq({
      body: { room: 'nonexistent', featureId: 'poll', updates: { k: 1 } },
    }), res);
    expect(status()).toBe(404);
    expect(body()).toContain('Room not found');
  });
});

// ---------------------------------------------------------------------------
// Yjs write behaviour
// ---------------------------------------------------------------------------

describe('handleFeatureWrite — Yjs writes', () => {
  beforeEach(() => { mockDocs.clear(); });

  it('writes a single update into the feature Y.Map', async () => {
    const doc = makeDocWithFeature('poll');
    mockDocs.set('room-a', doc);
    const { res, status } = makeRes();
    await handleFeatureWrite(makeReq({
      body: { room: 'room-a', featureId: 'poll', updates: { 'slide-0-vote-voter1': 2 } },
    }), res);

    expect(status()).toBe(200);
    const featMap = doc.getMap<Y.Map<unknown>>('features');
    const pollMap = featMap.get('poll') as Y.Map<unknown>;
    expect(pollMap.get('slide-0-vote-voter1')).toBe(2);
  });

  it('writes multiple updates atomically', async () => {
    const doc = makeDocWithFeature('poll');
    mockDocs.set('room-b', doc);
    const { res, status } = makeRes();
    await handleFeatureWrite(makeReq({
      body: {
        room: 'room-b',
        featureId: 'poll',
        updates: {
          'slide-0-vote-v1': 0,
          'slide-0-vote-v2': 1,
        },
      },
    }), res);

    expect(status()).toBe(200);
    const pollMap = (doc.getMap<Y.Map<unknown>>('features')).get('poll') as Y.Map<unknown>;
    expect(pollMap.get('slide-0-vote-v1')).toBe(0);
    expect(pollMap.get('slide-0-vote-v2')).toBe(1);
  });

  it('returns 404 when feature Y.Map has not been initialised by the presenter', async () => {
    const doc = makeDoc(); // no feature map pre-populated
    mockDocs.set('room-c', doc);
    const { res, status } = makeRes();
    await handleFeatureWrite(makeReq({
      body: { room: 'room-c', featureId: 'new-feature', updates: { foo: 'bar' } },
    }), res);

    expect(status()).toBe(404);
    // No Y.Map should have been created server-side
    const featMap = doc.getMap<Y.Map<unknown>>('features');
    expect(featMap.get('new-feature')).toBeUndefined();
  });

  it('does not touch other feature namespaces', async () => {
    const doc = makeDoc();
    // Pre-populate another feature's map
    const existing = new Y.Map<unknown>();
    doc.transact(() => {
      doc.getMap<Y.Map<unknown>>('features').set('other-feature', existing);
      existing.set('secret', 42);
    });
    mockDocs.set('room-d', doc);

    const { res } = makeRes();
    // 'poll' Y.Map doesn't exist → 404; other-feature must be untouched
    await handleFeatureWrite(makeReq({
      body: { room: 'room-d', featureId: 'poll', updates: { k: 'v' } },
    }), res);

    const otherMap = doc.getMap<Y.Map<unknown>>('features').get('other-feature') as Y.Map<unknown>;
    expect(otherMap.get('secret')).toBe(42);
  });

  it('overwrites an existing value', async () => {
    const doc = makeDoc();
    const pollMap = new Y.Map<unknown>();
    doc.transact(() => {
      doc.getMap<Y.Map<unknown>>('features').set('poll', pollMap);
      pollMap.set('slide-0-vote-voter1', 0);
    });
    mockDocs.set('room-e', doc);

    const { res, status } = makeRes();
    await handleFeatureWrite(makeReq({
      body: { room: 'room-e', featureId: 'poll', updates: { 'slide-0-vote-voter1': 1 } },
    }), res);

    expect(status()).toBe(200);
    expect(pollMap.get('slide-0-vote-voter1')).toBe(1);
  });

  it('returns 200 with { ok: true } on success', async () => {
    const doc = makeDocWithFeature('poll');
    mockDocs.set('room-f', doc);
    const { res, status, body } = makeRes();
    await handleFeatureWrite(makeReq({
      body: { room: 'room-f', featureId: 'poll', updates: { k: true } },
    }), res);

    expect(status()).toBe(200);
    expect(JSON.parse(body())).toEqual({ ok: true });
  });
});
