import { describe, it, expect } from 'vitest';
import { RoomStore } from '../src/RoomStore.ts';

describe('RoomStore', () => {
  it('starts empty', () => {
    const store = new RoomStore();
    expect(store.size).toBe(0);
  });

  it('creates a protected room with a cryptographic token', () => {
    const store = new RoomStore();
    const { presenterToken } = store.createRoom('demo');

    expect(presenterToken).toBeTypeOf('string');
    expect(presenterToken).toHaveLength(64); // 32 bytes → 64 hex chars
    expect(/^[0-9a-f]{64}$/.test(presenterToken)).toBe(true);
    expect(store.isProtected('demo')).toBe(true);
    expect(store.size).toBe(1);
  });

  it('returns the same token for an already-protected room', () => {
    const store = new RoomStore();
    const first = store.createRoom('demo');
    const second = store.createRoom('demo');

    expect(second.presenterToken).toBe(first.presenterToken);
    expect(store.size).toBe(1);
  });

  it('generates unique tokens for different rooms', () => {
    const store = new RoomStore();
    const a = store.createRoom('room-a');
    const b = store.createRoom('room-b');

    expect(a.presenterToken).not.toBe(b.presenterToken);
    expect(store.size).toBe(2);
  });

  it('validates a correct token', () => {
    const store = new RoomStore();
    const { presenterToken } = store.createRoom('demo');

    expect(store.validateToken('demo', presenterToken)).toBe(true);
  });

  it('rejects an incorrect token', () => {
    const store = new RoomStore();
    store.createRoom('demo');

    expect(store.validateToken('demo', 'wrong-token')).toBe(false);
  });

  it('rejects a token for an unprotected room', () => {
    const store = new RoomStore();
    expect(store.validateToken('no-room', 'any-token')).toBe(false);
  });

  it('rejects a token with the right length but wrong value', () => {
    const store = new RoomStore();
    store.createRoom('demo');
    const fakeToken = '0'.repeat(64);

    expect(store.validateToken('demo', fakeToken)).toBe(false);
  });

  it('reports unprotected rooms correctly', () => {
    const store = new RoomStore();
    expect(store.isProtected('unknown')).toBe(false);
  });

  it('deletes a protected room', () => {
    const store = new RoomStore();
    store.createRoom('demo');
    expect(store.deleteRoom('demo')).toBe(true);
    expect(store.isProtected('demo')).toBe(false);
    expect(store.size).toBe(0);
  });

  it('returns false when deleting a non-existent room', () => {
    const store = new RoomStore();
    expect(store.deleteRoom('ghost')).toBe(false);
  });

  it('cannot validate after deletion', () => {
    const store = new RoomStore();
    const { presenterToken } = store.createRoom('demo');
    store.deleteRoom('demo');

    expect(store.validateToken('demo', presenterToken)).toBe(false);
  });
});
