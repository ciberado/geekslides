/**
 * GeekSlides v2 — Touch Input.
 *
 * Handles swipe gestures and tap zones for mobile navigation.
 */

import type { CommandSystem } from './CommandSystem.ts';

const SWIPE_THRESHOLD_X = 50;
const SWIPE_THRESHOLD_Y = 80;
const LONG_PRESS_MS = 500;
const DEFAULT_TAP_ZONE_RATIO = 0.25;

export interface TouchInputOptions {
  readonly tapZoneRatio?: number;
}

export class TouchInput {
  #commandSystem: CommandSystem;
  #target: HTMLElement;
  #startX = 0;
  #startY = 0;
  #startTime = 0;
  #longPressTimer: ReturnType<typeof setTimeout> | null = null;
  #tapZoneRatio: number;

  constructor(commandSystem: CommandSystem, target: HTMLElement, options?: TouchInputOptions) {
    this.#commandSystem = commandSystem;
    this.#target = target;
    this.#tapZoneRatio = options?.tapZoneRatio ?? DEFAULT_TAP_ZONE_RATIO;
  }

  /**
   * Start listening for touch events.
   */
  activate(): void {
    this.#target.addEventListener('touchstart', this.#onTouchStart, { passive: true });
    this.#target.addEventListener('touchend', this.#onTouchEnd, { passive: true });
  }

  /**
   * Stop listening for touch events.
   */
  deactivate(): void {
    this.#target.removeEventListener('touchstart', this.#onTouchStart);
    this.#target.removeEventListener('touchend', this.#onTouchEnd);
    this.#clearLongPress();
  }

  #onTouchStart = (e: TouchEvent): void => {
    const touch = e.touches[0];
    if (!touch) return;

    this.#startX = touch.clientX;
    this.#startY = touch.clientY;
    this.#startTime = Date.now();

    this.#longPressTimer = setTimeout(() => {
      this.#commandSystem.execute('toggle-toolbar');
    }, LONG_PRESS_MS);
  };

  #onTouchEnd = (e: TouchEvent): void => {
    this.#clearLongPress();

    const touch = e.changedTouches[0];
    if (!touch) return;

    const dx = touch.clientX - this.#startX;
    const dy = touch.clientY - this.#startY;
    const elapsed = Date.now() - this.#startTime;

    // Check for swipes
    if (Math.abs(dx) > SWIPE_THRESHOLD_X && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) {
        this.#commandSystem.execute('next');
      } else {
        this.#commandSystem.execute('prev');
      }
      return;
    }

    if (dy < -SWIPE_THRESHOLD_Y && Math.abs(dy) > Math.abs(dx)) {
      this.#commandSystem.execute('toggle-overview');
      return;
    }

    // Tap zones (only for short taps with minimal movement)
    if (elapsed < LONG_PRESS_MS && Math.abs(dx) < 10 && Math.abs(dy) < 10) {
      const viewportWidth = this.#target.clientWidth;
      const tapX = touch.clientX;

      if (tapX < viewportWidth * this.#tapZoneRatio) {
        this.#commandSystem.execute('prev');
      } else if (tapX > viewportWidth * (1 - this.#tapZoneRatio)) {
        this.#commandSystem.execute('next');
      }
      // Centre dead zone — no command fired
    }
  };

  #clearLongPress(): void {
    if (this.#longPressTimer !== null) {
      clearTimeout(this.#longPressTimer);
      this.#longPressTimer = null;
    }
  }
}
