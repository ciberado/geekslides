/**
 * GeekSlides v2 — WhiteboardSync.
 *
 * Thin layer bridging local whiteboard events to SyncManager.
 */

import type { SyncManager } from './SyncManager.ts';
import type { WhiteboardStroke } from './types.ts';

export class WhiteboardSync {
  #syncManager: SyncManager;
  #eventTarget: EventTarget;

  constructor(syncManager: SyncManager, eventTarget: EventTarget = document) {
    this.#syncManager = syncManager;
    this.#eventTarget = eventTarget;
  }

  /**
   * Start listening for local whiteboard stroke events.
   */
  activate(): void {
    this.#eventTarget.addEventListener('geek:whiteboard:stroke', this.#onLocalStroke);
    this.#eventTarget.addEventListener('geek:whiteboard:stroke-progress', this.#onLocalProgress);
  }

  /**
   * Stop listening.
   */
  deactivate(): void {
    this.#eventTarget.removeEventListener('geek:whiteboard:stroke', this.#onLocalStroke);
    this.#eventTarget.removeEventListener('geek:whiteboard:stroke-progress', this.#onLocalProgress);
  }

  #onLocalStroke = (e: Event): void => {
    const event = e as CustomEvent<WhiteboardStroke>;
    this.#syncManager.clearLiveStroke();
    this.#syncManager.addStroke(event.detail);
  };

  #onLocalProgress = (e: Event): void => {
    const event = e as CustomEvent<WhiteboardStroke>;
    this.#syncManager.updateLiveStroke(event.detail);
  };
}
