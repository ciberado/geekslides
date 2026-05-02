/**
 * GeekSlides v2 — SyncManager.
 *
 * Bridges the local slideshow and a shared Yjs document for real-time sync.
 * Replaces v1's MQTT-based sync entirely.
 */

import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import type { WhiteboardStroke } from './types.ts';
import { createLogger } from '../logging.ts';

const log = createLogger('sync');

export interface SyncTarget {
  goTo(slide: number, partial?: number): void;
  set mode(value: string);
  get currentSlide(): number;
  get currentPartial(): number;
  get mode(): string;
  applyPreviewClass(slideIndex: number, className: string): void;
  clearPreview(): void;
}

export class SyncManager {
  readonly doc: Y.Doc;
  readonly #sessionState: Y.Map<unknown>;
  readonly #whiteboardStrokes: Y.Array<unknown>;
  readonly #liveStrokes: Y.Map<unknown>;
  #provider: WebsocketProvider | null = null;
  #currentRoom: string | null = null;
  #target: SyncTarget | null = null;
  #isRemoteUpdate = false;
  #followPresenter = true;
  #clientId: string;
  #eventTarget: EventTarget;
  #readonly: boolean;

  constructor(eventTarget: EventTarget = document, options?: { readonly?: boolean }) {
    this.doc = new Y.Doc();
    this.#sessionState = this.doc.getMap('sessionState');
    this.#whiteboardStrokes = this.doc.getArray('whiteboardStrokes');
    this.#liveStrokes = this.doc.getMap('liveStrokes');
    this.#clientId = Math.random().toString(36).slice(2, 10);
    this.#eventTarget = eventTarget;
    this.#readonly = options?.readonly === true;

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
   * Pass `viewerToken` for a token-authenticated read-only connection (preferred).
   * Falls back to `?readonly` for backward-compatible unprotected room viewer access.
   */
  connect(serverUrl: string, room: string, options?: { token?: string; viewerToken?: string }): void {
    if (this.#provider) {
      this.disconnect();
    }

    this.#currentRoom = room;

    const wsParams: Record<string, string> = {};
    if (options?.viewerToken) {
      // Authenticated viewer: token is the credential, no need for ?readonly
      wsParams['vtoken'] = options.viewerToken;
    } else if (this.#readonly) {
      // Backward-compat: unprotected room viewer
      wsParams['readonly'] = '';
    }
    if (options?.token) {
      wsParams['token'] = options.token;
    }

    this.#provider = new WebsocketProvider(serverUrl, room, this.doc, { params: wsParams });
    log.info({ room, readonly: this.#readonly }, 'connecting to sync server');

    this.#provider.on('status', (event: { status: string }) => {
      log.debug({ status: event.status, room }, 'sync connection status changed');
      if (event.status === 'disconnected') {
        log.warn(
          { room, serverUrl },
          'sync disconnected — check network connectivity and that the sync server is running',
        );
      }
      this.#eventTarget.dispatchEvent(new CustomEvent('geek:sync:state', {
        bubbles: true,
        detail: {
          connected: event.status === 'connected',
          following: this.#followPresenter,
          readonly: this.#readonly,
        },
      }));
    });

    // y-websocket surfaces connection errors as WebSocket close events.
    // Log them with actionable hints so users know why sync failed.
    this.#provider.ws?.addEventListener('close', (event: CloseEvent) => {
      if (event.code === 1006) {
        log.error(
          { room, serverUrl, code: event.code },
          'sync WebSocket closed abnormally — server may be unreachable or the URL is wrong. ' +
          'Check the sync.server config value and verify the server is running.',
        );
      } else if (event.code === 4001 || event.code === 4003) {
        log.error(
          { room, serverUrl, code: event.code },
          'sync WebSocket closed with auth rejection — check your presenter token or viewer token.',
        );
      } else if (!event.wasClean) {
        log.warn({ room, serverUrl, code: event.code, reason: event.reason }, 'sync WebSocket closed unexpectedly');
      }
    });
  }

  /**
   * Update the authentication token on the live connection.
   * The new token is stored in the provider's URL params so that any future
   * reconnection by y-websocket uses it automatically.  No disconnect/reconnect
   * is performed — the existing WebSocket stays open.
   */
  updateConnectionToken(token: string): void {
    if (this.#provider) {
      this.#provider.params['token'] = token;
    }
  }

  /**
   * Disconnect from the server and clean up.
   */
  disconnect(): void {
    log.info({ room: this.#currentRoom }, 'disconnecting from sync server');
    this.#provider?.destroy();
    this.#provider = null;
    this.#currentRoom = null;
  }

  /**
   * Publish local state to the shared document.
   * No-op in readonly mode.
   */
  publishState(slide: number, partial: number, mode: string): void {
    if (this.#readonly) return;
    if (this.#isRemoteUpdate) return;

    log.trace({ slide, partial, mode }, 'publishing state');
    this.doc.transact(() => {
      this.#sessionState.set('slide', slide);
      this.#sessionState.set('partial', partial);
      this.#sessionState.set('mode', mode);
      this.#sessionState.set('presenterId', this.#clientId);
      this.#sessionState.set('presenterActive', true);
    });
  }

  /**
   * Return all existing whiteboard strokes (for late-joining clients).
   */
  getStrokes(): WhiteboardStroke[] {
    const result: WhiteboardStroke[] = [];
    for (let i = 0; i < this.#whiteboardStrokes.length; i++) {
      result.push(this.#whiteboardStrokes.get(i) as WhiteboardStroke);
    }
    return result;
  }

  /**
   * Add a whiteboard stroke to the shared array.
   * No-op in readonly mode.
   */
  addStroke(stroke: WhiteboardStroke): void {
    if (this.#readonly) return;
    this.#whiteboardStrokes.push([stroke]);
  }

  /**
   * Update the in-progress (live) stroke for this client.
   * Remote observers will see incremental drawing progress.
   * No-op in readonly mode.
   */
  updateLiveStroke(stroke: WhiteboardStroke): void {
    if (this.#readonly) return;
    this.#liveStrokes.set(this.#clientId, stroke);
  }

  /**
   * Clear the live stroke for this client (called on finalization).
   * No-op in readonly mode.
   */
  clearLiveStroke(): void {
    if (this.#readonly) return;
    this.#liveStrokes.delete(this.#clientId);
  }

  /**
   * Clear whiteboard strokes for a specific slide.
   * No-op in readonly mode.
   */
  clearStrokes(slideIndex: number): void {
    if (this.#readonly) return;
    const arr = this.#whiteboardStrokes;
    this.doc.transact(() => {
      for (let i = arr.length - 1; i >= 0; i--) {
        const item = arr.get(i) as WhiteboardStroke | undefined;
        if (item?.slideIndex === slideIndex) {
          arr.delete(i, 1);
        }
      }
    });
  }

  /**
   * Clear all whiteboard strokes across every slide.
   * Called when a new deck is loaded to discard drawings from the previous deck.
   * No-op in readonly mode.
   */
  clearAllStrokes(): void {
    if (this.#readonly) return;
    const arr = this.#whiteboardStrokes;
    if (arr.length === 0) return;
    this.doc.transact(() => {
      arr.delete(0, arr.length);
    });
  }

  /**
   * Publish whiteboard canvas visibility to all connected sessions.
   * No-op in readonly mode.
   */
  publishWhiteboardVisible(visible: boolean): void {
    if (this.#readonly) return;
    this.#sessionState.set('whiteboardVisible', visible);
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

  get isReadonly(): boolean {
    return this.#readonly;
  }

  get currentRoom(): string | null {
    return this.#currentRoom;
  }

  get clientId(): string {
    return this.#clientId;
  }

  #setupObservers(): void {
    // Observe remote session state changes
    this.#sessionState.observe((event) => {
      if (event.transaction.local) return;

      // Whiteboard visibility is independent of follow-presenter mode.
      if (event.keysChanged.has('whiteboardVisible')) {
        const visible = this.#sessionState.get('whiteboardVisible') as boolean | undefined;
        if (visible !== undefined) {
          this.#eventTarget.dispatchEvent(new CustomEvent('geek:whiteboard:remote-visibility', {
            bubbles: true,
            detail: { visible },
          }));
        }
      }

      // Class preview is independent of follow-presenter mode.
      if (event.keysChanged.has('classPreview')) {
        const preview = this.#sessionState.get('classPreview') as
          | { slideIndex: number; className: string; timestamp: number }
          | null
          | undefined;

        if (preview === null || preview === undefined) {
          // Clear preview
          this.#target?.clearPreview();
        } else if (typeof preview === 'object') {
          // Validate timestamp (must be < 5000ms old)
          const age = Date.now() - preview.timestamp;
          if (age < 5000) {
            // Validate className (must start with layout- or mod-)
            if (preview.className.startsWith('layout-') || preview.className.startsWith('mod-')) {
              this.#target?.applyPreviewClass(preview.slideIndex, preview.className);
            }
          }
        }
      }

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

      // Handle stroke deletions — notify clients to clear and redraw.
      if (event.changes.deleted.size > 0) {
        const clearedSlides = new Set<number>();
        for (const item of event.changes.deleted) {
          const content = item.content.getContent() as WhiteboardStroke[];
          for (const stroke of content) {
            clearedSlides.add(stroke.slideIndex);
          }
        }
        const remaining = this.getStrokes();
        for (const slideIndex of clearedSlides) {
          this.#eventTarget.dispatchEvent(new CustomEvent('geek:whiteboard:remote-clear', {
            bubbles: true,
            detail: {
              slideIndex,
              remaining: remaining.filter((s) => s.slideIndex === slideIndex),
            },
          }));
        }
      }
    });

    // Observe live (in-progress) stroke updates
    this.#liveStrokes.observe((event) => {
      if (event.transaction.local) return;

      for (const [clientId, change] of event.changes.keys) {
        if (change.action === 'delete') continue;
        const stroke = this.#liveStrokes.get(clientId);
        if (!stroke) continue;
        this.#eventTarget.dispatchEvent(new CustomEvent('geek:whiteboard:remote-stroke-progress', {
          bubbles: true,
          detail: stroke,
        }));
      }
    });
  }
}
