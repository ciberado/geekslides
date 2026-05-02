export interface CursorSyncDependencies {
  readonly deckContentPath: string;
  readonly debounceMs: number;
  readonly refreshSlideMap: () => Promise<unknown>;
  readonly getSlideForLine: (line: number) => number | undefined;
  readonly getLineForSlide: (slideIndex: number) => number | undefined;
  readonly setSlide: (slideIndex: number, partial?: number) => void;
  readonly onRemoteSlideChange: (listener: (slideIndex: number) => void) => () => void;
  readonly moveCursorToLine: (line: number) => void;
  readonly now?: () => number;
  readonly setTimeoutFn?: typeof setTimeout;
  readonly clearTimeoutFn?: typeof clearTimeout;
}

export class CursorSyncController {
  readonly #deps: CursorSyncDependencies;
  readonly #now: () => number;
  readonly #setTimeoutFn: typeof setTimeout;
  readonly #clearTimeoutFn: typeof clearTimeout;
  #enabled = true;
  #pendingTimer: ReturnType<typeof setTimeout> | null = null;
  #lastPublishedSlide: number | undefined;
  #cooldownUntil = 0;
  #unsubscribeRemote: (() => void) | null = null;

  constructor(deps: CursorSyncDependencies) {
    this.#deps = deps;
    this.#now = deps.now ?? Date.now;
    this.#setTimeoutFn = deps.setTimeoutFn ?? setTimeout;
    this.#clearTimeoutFn = deps.clearTimeoutFn ?? clearTimeout;
  }

  start(): void {
    this.#unsubscribeRemote = this.#deps.onRemoteSlideChange((slideIndex) => {
      void this.#handleRemoteSlideChange(slideIndex);
    });
  }

  stop(): void {
    if (this.#pendingTimer) {
      this.#clearTimeoutFn(this.#pendingTimer);
      this.#pendingTimer = null;
    }
    this.#unsubscribeRemote?.();
    this.#unsubscribeRemote = null;
  }

  toggle(): boolean {
    this.#enabled = !this.#enabled;
    return this.#enabled;
  }

  onSelectionChange(documentPath: string, line: number): void {
    if (!this.#enabled || documentPath !== this.#deps.deckContentPath) {
      return;
    }

    if (this.#pendingTimer) {
      this.#clearTimeoutFn(this.#pendingTimer);
    }

    this.#pendingTimer = this.#setTimeoutFn(() => {
      void this.#publishCursorSlide(line);
    }, this.#deps.debounceMs);
  }

  async #publishCursorSlide(line: number): Promise<void> {
    await this.#deps.refreshSlideMap();
    const slideIndex = this.#deps.getSlideForLine(line);
    if (slideIndex === undefined || slideIndex === this.#lastPublishedSlide) {
      return;
    }

    this.#deps.setSlide(slideIndex, 0);
    this.#lastPublishedSlide = slideIndex;
    this.#cooldownUntil = this.#now() + 500;
  }

  async #handleRemoteSlideChange(slideIndex: number): Promise<void> {
    if (!this.#enabled || this.#now() < this.#cooldownUntil) {
      return;
    }

    await this.#deps.refreshSlideMap();
    const line = this.#deps.getLineForSlide(slideIndex);
    if (line === undefined) {
      return;
    }

    this.#deps.moveCursorToLine(line);
  }
}
