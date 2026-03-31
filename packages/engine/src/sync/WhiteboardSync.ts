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
  }

  /**
   * Stop listening.
   */
  deactivate(): void {
    this.#eventTarget.removeEventListener('geek:whiteboard:stroke', this.#onLocalStroke);
  }

  #onLocalStroke = (e: Event): void => {
    const event = e as CustomEvent<WhiteboardStroke>;
    this.#syncManager.addStroke(event.detail);
  };
}
