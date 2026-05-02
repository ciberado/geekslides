/**
 * Debounce wrapper for preview updates.
 *
 * Prevents excessive updates during rapid typing by delaying execution
 * until a quiet period (150ms by default).
 */

export interface DebouncerOptions {
  readonly delay?: number;
  readonly setTimeoutFn?: typeof setTimeout;
  readonly clearTimeoutFn?: typeof clearTimeout;
}

export class PreviewDebouncer<T extends unknown[]> {
  readonly #fn: (...args: T) => void;
  readonly #delay: number;
  readonly #setTimeoutFn: typeof setTimeout;
  readonly #clearTimeoutFn: typeof clearTimeout;
  #timer: ReturnType<typeof setTimeout> | null = null;

  constructor(fn: (...args: T) => void, options: DebouncerOptions = {}) {
    this.#fn = fn;
    this.#delay = options.delay ?? 150;
    this.#setTimeoutFn = options.setTimeoutFn ?? setTimeout;
    this.#clearTimeoutFn = options.clearTimeoutFn ?? clearTimeout;
  }

  /**
   * Schedule the function to run after the delay.
   * Cancels any previous pending call.
   */
  call(...args: T): void {
    this.cancel();
    this.#timer = this.#setTimeoutFn(() => {
      this.#timer = null;
      this.#fn(...args);
    }, this.#delay);
  }

  /**
   * Cancel any pending execution.
   */
  cancel(): void {
    if (this.#timer !== null) {
      this.#clearTimeoutFn(this.#timer);
      this.#timer = null;
    }
  }

  /**
   * Returns true if there's a pending execution.
   */
  get pending(): boolean {
    return this.#timer !== null;
  }
}
