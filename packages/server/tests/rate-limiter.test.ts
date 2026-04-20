import { describe, it, expect, beforeEach } from 'vitest';
import { RateLimiter } from '../src/RateLimiter.ts';

describe('RateLimiter', () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    limiter = new RateLimiter({ maxAttempts: 3, windowMs: 1000 });
  });

  it('allows requests below the threshold', () => {
    expect(limiter.recordFailure('1.2.3.4')).toBe(false);
    expect(limiter.recordFailure('1.2.3.4')).toBe(false);
    expect(limiter.recordFailure('1.2.3.4')).toBe(false);
  });

  it('blocks after exceeding the threshold', () => {
    limiter.recordFailure('1.2.3.4');
    limiter.recordFailure('1.2.3.4');
    limiter.recordFailure('1.2.3.4');
    // 4th attempt exceeds maxAttempts=3
    expect(limiter.recordFailure('1.2.3.4')).toBe(true);
  });

  it('tracks IPs independently', () => {
    limiter.recordFailure('1.2.3.4');
    limiter.recordFailure('1.2.3.4');
    limiter.recordFailure('1.2.3.4');
    // IP A is at the limit
    expect(limiter.recordFailure('1.2.3.4')).toBe(true);
    // IP B is fresh
    expect(limiter.recordFailure('5.6.7.8')).toBe(false);
  });

  it('isLimited returns false for unknown IPs', () => {
    expect(limiter.isLimited('unknown')).toBe(false);
  });

  it('isLimited returns true after exceeding the threshold', () => {
    limiter.recordFailure('1.2.3.4');
    limiter.recordFailure('1.2.3.4');
    limiter.recordFailure('1.2.3.4');
    limiter.recordFailure('1.2.3.4');
    expect(limiter.isLimited('1.2.3.4')).toBe(true);
  });

  it('resets after window expires', async () => {
    const shortLimiter = new RateLimiter({ maxAttempts: 1, windowMs: 50 });
    shortLimiter.recordFailure('1.2.3.4');
    expect(shortLimiter.recordFailure('1.2.3.4')).toBe(true);

    await new Promise((r) => setTimeout(r, 80));

    // Window expired — should allow again
    expect(shortLimiter.isLimited('1.2.3.4')).toBe(false);
    expect(shortLimiter.recordFailure('1.2.3.4')).toBe(false);
  });

  it('clear removes all entries', () => {
    limiter.recordFailure('1.2.3.4');
    limiter.recordFailure('5.6.7.8');
    expect(limiter.size).toBe(2);

    limiter.clear();
    expect(limiter.size).toBe(0);
    expect(limiter.isLimited('1.2.3.4')).toBe(false);
  });

  it('cleanup timer removes expired entries', async () => {
    const shortLimiter = new RateLimiter({ maxAttempts: 1, windowMs: 30 });
    shortLimiter.recordFailure('1.2.3.4');
    expect(shortLimiter.size).toBe(1);

    shortLimiter.startCleanup(20);
    await new Promise((r) => setTimeout(r, 80));

    expect(shortLimiter.size).toBe(0);
    shortLimiter.stopCleanup();
  });
});
