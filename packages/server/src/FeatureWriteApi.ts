/**
 * GeekSlides v2 — Generic feature-write HTTP API.
 *
 * Allows readonly (viewer) connections to write into their feature's Y.Map
 * slot without going through the Yjs WebSocket (which is blocked for readonly
 * sessions).  The server applies the updates on behalf of the viewer and
 * broadcasts them to all connected clients via the existing Yjs sync.
 *
 * The endpoint has NO knowledge of individual features — it simply writes
 * the key-value pairs supplied by the caller into:
 *   doc.getMap('features').get(featureId)  →  Y.Map
 *
 * Request: POST /api/feature-write
 * Body (JSON):
 *   {
 *     room:      string,              // Yjs room name
 *     featureId: string,              // e.g. "poll"
 *     updates:   Record<string, unknown>  // key-value pairs to set
 *   }
 *
 * Responses:
 *   200  { ok: true }
 *   400  { error: string }   — missing / invalid fields
 *   404  { error: string }   — room not found
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { docs } from 'y-websocket/bin/utils';
import { createLogger } from './logging.ts';

/**
 * Duck-typed interface for a Yjs Y.Map.
 *
 * We deliberately avoid `import * as Y from 'yjs'` here because y-websocket
 * bundles its own copy of Yjs.  Importing a second copy causes the infamous
 * "Yjs was already imported" double-instance warning, and any `new Y.Map()`
 * created from our copy will throw "Unexpected content type" when inserted
 * into the doc managed by y-websocket's Yjs.  Using duck-typing lets us work
 * with whatever Y.Map instance lives inside the doc without touching the
 * constructor.
 */
type YMapLike = {
  set(key: string, value: unknown): void;
  get(key: string): unknown;
};

function isYMapLike(v: unknown): v is YMapLike {
  return (
    typeof v === 'object' &&
    v !== null &&
    typeof (v as { set?: unknown }).set === 'function'
  );
}

const log = createLogger('feature-write');

export const FEATURE_WRITE_PATH = '/api/feature-write';
const MAX_BODY = 16_384;
const MAX_UPDATES = 64;

async function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk: Buffer) => {
      data += chunk.toString();
      if (data.length > MAX_BODY) reject(new Error('Body too large'));
    });
    req.on('end', () => { resolve(data); });
    req.on('error', reject);
  });
}

function json(res: ServerResponse, status: number, body: Record<string, unknown>): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

/** Returns true if the value is a JSON-primitive (safe to store in a Y.Map). */
function isPrimitive(v: unknown): v is boolean | number | string | null {
  return v === null || typeof v === 'boolean' || typeof v === 'number' || typeof v === 'string';
}

export async function handleFeatureWrite(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<boolean> {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);

  if (url.pathname !== FEATURE_WRITE_PATH || req.method !== 'POST') return false;

  let body: Record<string, unknown>;
  try {
    const raw = await readBody(req);
    body = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    json(res, 400, { error: 'Invalid JSON body' });
    return true;
  }

  const { room, featureId, updates } = body;

  if (
    typeof room !== 'string' || room.length === 0 ||
    typeof featureId !== 'string' || featureId.length === 0 ||
    typeof updates !== 'object' || updates === null || Array.isArray(updates)
  ) {
    json(res, 400, { error: 'Required fields: room (string), featureId (string), updates (object)' });
    return true;
  }

  const entries = Object.entries(updates as Record<string, unknown>);

  if (entries.length === 0) {
    json(res, 400, { error: 'updates must contain at least one key' });
    return true;
  }
  if (entries.length > MAX_UPDATES) {
    json(res, 400, { error: `updates must not exceed ${String(MAX_UPDATES)} keys` });
    return true;
  }
  for (const [k, v] of entries) {
    if (typeof k !== 'string' || !isPrimitive(v)) {
      json(res, 400, { error: 'updates values must be primitives (boolean, number, string, null)' });
      return true;
    }
  }

  const doc = docs.get(room);
  if (!doc) {
    log.debug({ room, featureId }, 'feature-write rejected — room not found');
    json(res, 404, { error: 'Room not found or no active session' });
    return true;
  }

  const featuresRoot = doc.getMap('features');
  const featureMap = featuresRoot.get(featureId);

  if (!isYMapLike(featureMap)) {
    // The presenter has not yet initialised this feature's Y.Map on the server.
    // Return 404 — the client should retry once the presenter is on-slide.
    log.debug({ room, featureId }, 'feature-write rejected — feature map not initialised');
    json(res, 404, { error: 'Feature map not initialised — presenter has not activated this feature yet' });
    return true;
  }

  doc.transact(() => {
    for (const [k, v] of entries) {
      featureMap.set(k, v);
    }
  });

  log.debug({ room, featureId, keys: entries.map(([k]) => k) }, 'feature-write applied');
  json(res, 200, { ok: true });
  return true;
}
