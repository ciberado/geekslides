/**
 * GeekSlides v2 — In-memory room store for protected rooms.
 *
 * Stores presenter tokens for rooms that have been "shared" (protected).
 * Unprotected rooms (no entry here) retain backward-compatible open access.
 */

import { randomBytes, timingSafeEqual } from 'node:crypto';

/** Byte length for generated presenter tokens (32 bytes → 64 hex chars). */
const TOKEN_BYTES = 32;

interface ProtectedRoom {
  readonly presenterToken: string;
  readonly createdAt: number;
}

export class RoomStore {
  readonly #rooms = new Map<string, ProtectedRoom>();

  /**
   * Protect a room by generating a presenter token.
   * If the room is already protected, returns the existing token.
   */
  createRoom(room: string): { presenterToken: string } {
    const existing = this.#rooms.get(room);
    if (existing) {
      return { presenterToken: existing.presenterToken };
    }

    const presenterToken = randomBytes(TOKEN_BYTES).toString('hex');
    this.#rooms.set(room, { presenterToken, createdAt: Date.now() });
    return { presenterToken };
  }

  /**
   * Check whether a room has been protected (has a presenter token).
   */
  isProtected(room: string): boolean {
    return this.#rooms.has(room);
  }

  /**
   * Validate a presenter token for a room using constant-time comparison.
   * Returns false for unprotected rooms (no token to match).
   */
  validateToken(room: string, token: string): boolean {
    const entry = this.#rooms.get(room);
    if (!entry) return false;

    const expected = Buffer.from(entry.presenterToken, 'utf-8');
    const provided = Buffer.from(token, 'utf-8');

    if (expected.length !== provided.length) return false;
    return timingSafeEqual(expected, provided);
  }

  /**
   * Remove a protected room (revoke token).
   */
  deleteRoom(room: string): boolean {
    return this.#rooms.delete(room);
  }

  /**
   * Number of protected rooms (for monitoring/testing).
   */
  get size(): number {
    return this.#rooms.size;
  }
}
