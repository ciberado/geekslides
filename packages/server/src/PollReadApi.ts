/**
 * GeekSlides v2 — Poll options read API.
 *
 * Reads poll options and frozen state directly from the server-side Yjs doc
 * so the voter page can render immediately without waiting for WebSocket sync.
 *
 * GET /api/poll-options?room={room}&slide={slideIndex}
 * Response: { options: string[], frozen: boolean }
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { docs } from 'y-websocket/bin/utils';
import { createLogger } from './logging.ts';

type YMapLike = {
  get(key: string): unknown;
};

function isYMapLike(v: unknown): v is YMapLike {
  return typeof v === 'object' && v !== null && typeof (v as { get?: unknown }).get === 'function';
}

const log = createLogger('poll-read');

export const POLL_READ_PATH = '/api/poll-options';

function json(res: ServerResponse, status: number, body: Record<string, unknown>): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

export function handlePollRead(req: IncomingMessage, res: ServerResponse): boolean {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  if (url.pathname !== POLL_READ_PATH) return false;
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return true;
  }
  if (req.method !== 'GET') return false;

  const room = url.searchParams.get('room');
  const slideStr = url.searchParams.get('slide');

  if (!room || !slideStr) {
    json(res, 400, { error: 'Missing room or slide parameter' });
    return true;
  }

  const slideIndex = parseInt(slideStr, 10);
  if (!Number.isFinite(slideIndex) || slideIndex < 0) {
    json(res, 400, { error: 'Invalid slide parameter' });
    return true;
  }

  const slideKey = String(slideIndex);

  const doc = docs.get(room);
  if (!doc) {
    json(res, 404, { error: 'Room not found or no active session' });
    return true;
  }

  const featuresRoot = doc.getMap('features');
  const pollMap = featuresRoot.get('poll');

  if (!isYMapLike(pollMap)) {
    json(res, 404, { error: 'Poll feature not active in this room' });
    return true;
  }

  const optionsJson = pollMap.get(`slide-${slideKey}-options`);
  if (typeof optionsJson !== 'string') {
    json(res, 404, { error: 'Poll options not found for this slide' });
    return true;
  }

  let options: unknown;
  try {
    options = JSON.parse(optionsJson);
  } catch {
    json(res, 500, { error: 'Could not parse poll options' });
    return true;
  }

  if (!Array.isArray(options)) {
    json(res, 500, { error: 'Poll options is not an array' });
    return true;
  }

  const frozen = pollMap.get(`slide-${slideKey}-frozen`) === true;

  log.debug({ room, slideIndex }, 'poll-options read');
  json(res, 200, { options, frozen });
  return true;
}
