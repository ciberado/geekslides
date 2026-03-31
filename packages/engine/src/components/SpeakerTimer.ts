/**
 * GeekSlides v2 — SpeakerTimer.
 *
 * Presentation timer using requestAnimationFrame for smooth HH:MM:SS display.
 */

export class SpeakerTimer {
  #startTime = 0;
  #elapsed = 0;
  #running = false;
  #rafId = 0;
  readonly #callback: (formatted: string) => void;

  constructor(callback: (formatted: string) => void) {
    this.#callback = callback;
  }

  get running(): boolean {
    return this.#running;
  }

  start(): void {
    if (this.#running) return;
    this.#running = true;
    this.#startTime = performance.now() - this.#elapsed;
    this.#tick();
  }

  pause(): void {
    if (!this.#running) return;
    this.#running = false;
    this.#elapsed = performance.now() - this.#startTime;
    cancelAnimationFrame(this.#rafId);
  }

  reset(): void {
    this.#running = false;
    this.#elapsed = 0;
    this.#startTime = 0;
    cancelAnimationFrame(this.#rafId);
    this.#callback('00:00:00');
  }

  #tick(): void {
    if (!this.#running) return;

    this.#elapsed = performance.now() - this.#startTime;
    this.#callback(SpeakerTimer.format(this.#elapsed));
    this.#rafId = requestAnimationFrame(() => { this.#tick(); });
  }

  static format(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return [hours, minutes, seconds]
      .map((n) => String(n).padStart(2, '0'))
      .join(':');
  }
}
