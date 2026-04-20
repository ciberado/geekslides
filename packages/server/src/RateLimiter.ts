/**
 * GeekSlides v2 — Rate limiter for auth attempts.
 *
 * Sliding-window counter per key (typically client IP).
 * Prevents brute-force token guessing on protected rooms.
 */

interface WindowEntry {
  count: number;
  resetAt: number;
}

export interface RateLimiterOptions {
  /** Maximum allowed failures within the window. */
  readonly maxAttempts: number;
  /** Window duration in milliseconds. */
  readonly windowMs: number;
}

const DEFAULT_OPTIONS: RateLimiterOptions = {
  maxAttempts: 10,
  windowMs: 60_000,
};

export class RateLimiter {
  readonly #options: RateLimiterOptions;
  readonly #windows = new Map<string, WindowEntry>();
  #cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(options: Partial<RateLimiterOptions> = {}) {
    this.#options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Record a failed attempt for a key. Returns true if the key is now rate-limited.
   */
  recordFailure(key: string): boolean {
    const now = Date.now();
    const entry = this.#windows.get(key);

    if (!entry || now >= entry.resetAt) {
      this.#windows.set(key, { count: 1, resetAt: now + this.#options.windowMs });
      return false;
    }

    entry.count++;
    return entry.count > this.#options.maxAttempts;
  }

  /**
   * Check whether a key is currently rate-limited (without recording a new attempt).
   */
  isLimited(key: string): boolean {
    const now = Date.now();
    const entry = this.#windows.get(key);
    if (!entry) return false;
    if (now >= entry.resetAt) {
      this.#windows.delete(key);
      return false;
    }
    return entry.count > this.#options.maxAttempts;
  }

  /**
   * Start periodic cleanup of expired entries.
   */
  startCleanup(intervalMs = 60_000): void {
    this.stopCleanup();
    this.#cleanupTimer = setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.#windows) {
        if (now >= entry.resetAt) {
          this.#windows.delete(key);
        }
      }
    }, intervalMs);

    // Allow process to exit even if cleanup timer is running
    if (typeof this.#cleanupTimer === 'object' && 'unref' in this.#cleanupTimer) {
      this.#cleanupTimer.unref();
    }
  }

  /**
   * Stop periodic cleanup.
   */
  stopCleanup(): void {
    if (this.#cleanupTimer !== null) {
      clearInterval(this.#cleanupTimer);
      this.#cleanupTimer = null;
    }
  }

  /**
   * Number of tracked keys (for testing).
   */
  get size(): number {
    return this.#windows.size;
  }

  /**
   * Clear all entries (for testing).
   */
  clear(): void {
    this.#windows.clear();
  }
}
