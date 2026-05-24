/**
 * GeekSlides v2 — EventBridge.
 *
 * A generic, reusable bridge that listens for local DOM events and forwards
 * data to the sync layer (Y.Map, Y.Array, or ephemeral per-client map).
 * This generalizes the pattern used by WhiteboardSync for any plugin.
 *
 * Usage:
 *   const bridge = new EventBridge(syncAPI, {
 *     eventTarget: document,
 *     actions: [
 *       { event: 'my:stroke', target: 'array' },
 *       { event: 'my:progress', target: 'ephemeral' },
 *       { event: 'my:state', target: 'map', key: 'currentState' },
 *     ],
 *   });
 *   bridge.activate();
 *   // ... later ...
 *   bridge.deactivate();
 */

import type * as Y from 'yjs';

/**
 * Describes how a single DOM event maps to a sync operation.
 */
export interface EventBridgeAction {
  /** DOM event name to listen for. */
  readonly event: string;

  /** Where to store the event data. */
  readonly target: 'map' | 'array' | 'ephemeral';

  /**
   * For 'map' target: the key to set in the shared map.
   * If omitted, the event name is used as the key.
   */
  readonly key?: string;

  /**
   * Optional transform applied to event.detail before storing.
   * Defaults to identity (stores the raw detail).
   */
  readonly transform?: (detail: unknown) => unknown;

  /**
   * For 'ephemeral' target: if true, clears the ephemeral entry
   * instead of setting it (useful for "end" events).
   */
  readonly clear?: boolean;
}

/**
 * Configuration for an EventBridge instance.
 */
export interface EventBridgeConfig {
  /** DOM EventTarget to listen on. Defaults to document. */
  readonly eventTarget?: EventTarget;

  /** List of event-to-sync action mappings. */
  readonly actions: readonly EventBridgeAction[];
}

/**
 * The sync primitives the EventBridge operates on.
 * This matches the FeatureSyncAPI shape so it can be constructed from ctx.sync.
 */
export interface EventBridgeSyncAPI {
  readonly readonly: boolean;
  getSharedMap(): Y.Map<unknown>;
  getSharedArray(): Y.Array<unknown>;
  getEphemeralMap(): Y.Map<unknown>;
}

function getEventDetail(event: Event): unknown {
  if (!(event instanceof CustomEvent)) {
    return undefined;
  }

  return (event as CustomEvent<unknown>).detail;
}

/**
 * A generic DOM-event-to-sync bridge with activate/deactivate lifecycle.
 */
export class EventBridge {
  readonly #syncAPI: EventBridgeSyncAPI;
  readonly #config: EventBridgeConfig;
  readonly #eventTarget: EventTarget;
  readonly #handlers: Map<string, (e: Event) => void> = new Map();
  #active = false;

  constructor(syncAPI: EventBridgeSyncAPI, config: EventBridgeConfig) {
    this.#syncAPI = syncAPI;
    this.#config = config;
    this.#eventTarget = config.eventTarget ?? document;
  }

  /**
   * Start listening for configured DOM events and forwarding to sync.
   */
  activate(): void {
    if (this.#active) return;
    this.#active = true;

    for (const action of this.#config.actions) {
      const handler = (e: Event): void => {
        if (this.#syncAPI.readonly) return;

        const detail = getEventDetail(e);
        const value = action.transform ? action.transform(detail) : detail;

        switch (action.target) {
          case 'map': {
            const key = action.key ?? action.event;
            this.#syncAPI.getSharedMap().set(key, value);
            break;
          }
          case 'array': {
            this.#syncAPI.getSharedArray().push([value]);
            break;
          }
          case 'ephemeral': {
            if (action.clear) {
              this.#syncAPI.getEphemeralMap().delete('_self');
            } else {
              this.#syncAPI.getEphemeralMap().set('_self', value);
            }
            break;
          }
        }
      };

      this.#handlers.set(action.event, handler);
      this.#eventTarget.addEventListener(action.event, handler);
    }
  }

  /**
   * Stop listening and clean up handlers.
   */
  deactivate(): void {
    if (!this.#active) return;
    this.#active = false;

    for (const [event, handler] of this.#handlers) {
      this.#eventTarget.removeEventListener(event, handler);
    }
    this.#handlers.clear();
  }

  /**
   * Whether the bridge is currently active.
   */
  get isActive(): boolean {
    return this.#active;
  }
}
