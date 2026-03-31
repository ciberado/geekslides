/**
 * GeekSlides v2 — SyncManager.
 *
 * Bridges the local slideshow and a shared Yjs document for real-time sync.
 * Replaces v1's MQTT-based sync entirely.
 */

import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import type { WhiteboardStroke } from './types.ts';

export interface SyncTarget {
  goTo(slide: number, partial?: number): void;
  set mode(value: string);
  get currentSlide(): number;
  get currentPartial(): number;
  get mode(): string;
}

export class SyncManager {
  readonly doc: Y.Doc;
  readonly #sessionState: Y.Map<unknown>;
  readonly #whiteboardStrokes: Y.Array<unknown>;
  #provider: WebsocketProvider | null = null;
  #target: SyncTarget | null = null;
  #isRemoteUpdate = false;
  #followPresenter = true;
  #clientId: string;
  #eventTarget: EventTarget;

  constructor(eventTarget: EventTarget = document) {
    this.doc = new Y.Doc();
    this.#sessionState = this.doc.getMap('sessionState');
    this.#whiteboardStrokes = this.doc.getArray('whiteboardStrokes');
    this.#clientId = Math.random().toString(36).slice(2, 10);
    this.#eventTarget = eventTarget;

    this.#setupObservers();
  }

  /**
   * Bind a slideshow target for remote state application.
   */
  bind(target: SyncTarget): void {
    this.#target = target;
  }

  /**
   * Connect to a y-websocket server.
   */
  connect(serverUrl: string, room: string): void {
    if (this.#provider) {
      this.disconnect();
    }

    this.#provider = new WebsocketProvider(serverUrl, room, this.doc);

    this.#provider.on('status', (event: { status: string }) => {
      this.#eventTarget.dispatchEvent(new CustomEvent('geek:sync:state', {
        bubbles: true,
        detail: { connected: event.status === 'connected', following: this.#followPresenter },
      }));
    });
  }

  /**
   * Disconnect from the server and clean up.
   */
  disconnect(): void {
    this.#provider?.destroy();
    this.#provider = null;
  }

  /**
   * Publish local state to the shared document.
   */
  publishState(slide: number, partial: number, mode: string): void {
    if (this.#isRemoteUpdate) return;

    this.doc.transact(() => {
      this.#sessionState.set('slide', slide);
      this.#sessionState.set('partial', partial);
      this.#sessionState.set('mode', mode);
      this.#sessionState.set('presenterId', this.#clientId);
      this.#sessionState.set('presenterActive', true);
    });
  }

  /**
   * Add a whiteboard stroke to the shared array.
   */
  addStroke(stroke: WhiteboardStroke): void {
    this.#whiteboardStrokes.push([stroke]);
  }

  /**
   * Clear whiteboard strokes for a specific slide.
   */
  clearStrokes(slideIndex: number): void {
    const arr = this.#whiteboardStrokes;
    for (let i = arr.length - 1; i >= 0; i--) {
      const item = arr.get(i) as WhiteboardStroke | undefined;
      if (item?.slideIndex === slideIndex) {
        arr.delete(i, 1);
      }
    }
  }

  /**
   * Toggle follow-presenter mode.
   */
  toggleFollow(): void {
    this.#followPresenter = !this.#followPresenter;

    if (this.#followPresenter && this.#target) {
      // Snap to presenter's current position
      const slide = this.#sessionState.get('slide') as number | undefined;
      const partial = this.#sessionState.get('partial') as number | undefined;
      if (slide !== undefined) {
        this.#isRemoteUpdate = true;
        this.#target.goTo(slide, partial);
        this.#isRemoteUpdate = false;
      }
    }

    this.#eventTarget.dispatchEvent(new CustomEvent('geek:sync:state', {
      bubbles: true,
      detail: { connected: this.#provider !== null, following: this.#followPresenter },
    }));
  }

  get isFollowing(): boolean {
    return this.#followPresenter;
  }

  get isConnected(): boolean {
    return this.#provider !== null;
  }

  get clientId(): string {
    return this.#clientId;
  }

  #setupObservers(): void {
    // Observe remote session state changes
    this.#sessionState.observe((event) => {
      if (event.transaction.local) return;
      if (!this.#followPresenter) return;
      if (!this.#target) return;

      this.#isRemoteUpdate = true;

      const slide = this.#sessionState.get('slide') as number | undefined;
      const partial = this.#sessionState.get('partial') as number | undefined;
      const mode = this.#sessionState.get('mode') as string | undefined;

      if (slide !== undefined) {
        this.#target.goTo(slide, partial);
      }
      if (mode !== undefined) {
        this.#target.mode = mode;
      }

      this.#isRemoteUpdate = false;
    });

    // Observe remote whiteboard strokes
    this.#whiteboardStrokes.observe((event) => {
      if (event.transaction.local) return;

      for (const item of event.changes.added) {
        const content = item.content.getContent() as unknown[];
        for (const stroke of content) {
          this.#eventTarget.dispatchEvent(new CustomEvent('geek:whiteboard:remote-stroke', {
            bubbles: true,
            detail: stroke,
          }));
        }
      }
    });
  }
}
