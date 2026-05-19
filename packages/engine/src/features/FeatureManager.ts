/**
 * GeekSlides v2 — FeatureManager.
 *
 * Manages the lifecycle of interactive features: loading, context creation,
 * activation, event dispatch, and teardown.
 */

import * as Y from 'yjs';
import type { GeekSlidesConfig } from '../core/Config.ts';
import type { Slideshow } from '../core/Slideshow.ts';
import type { CommandSystem } from '../input/CommandSystem.ts';
import type { SyncManager } from '../sync/SyncManager.ts';
import { EventBridge } from '../sync/EventBridge.ts';
import type { EventBridgeConfig } from '../sync/EventBridge.ts';
import type {
  Feature,
  FeatureContext,
  FeatureLifecycleEvents,
  FeatureSyncAPI,
} from './types.ts';
import { createLogger } from '../logging.ts';

const log = createLogger('features');

interface ActiveFeature {
  readonly feature: Feature;
  readonly context: FeatureContext;
  readonly container: HTMLElement;
  readonly cleanup: (() => void) | null;
  readonly registeredCommands: string[];
}

type EventHandler<K extends keyof FeatureLifecycleEvents> =
  (payload: FeatureLifecycleEvents[K]) => void;

type AnyEventHandler = (payload: never) => void;

export class FeatureManager {
  readonly #active = new Map<string, ActiveFeature>();
  readonly #listeners = new Map<string, Map<string, Set<AnyEventHandler>>>();
  readonly #slideshow: Slideshow;
  readonly #commands: CommandSystem;
  readonly #sync: SyncManager | null;
  readonly #config: GeekSlidesConfig;
  readonly #role: 'presenter' | 'viewer';
  readonly #featuresContainer: HTMLElement;
  readonly #output: { show(msg: string): void };

  constructor(options: {
    readonly slideshow: Slideshow;
    readonly commands: CommandSystem;
    readonly sync: SyncManager | null;
    readonly config: GeekSlidesConfig;
    readonly role: 'presenter' | 'viewer';
    readonly featuresContainer: HTMLElement;
    readonly output: { show(msg: string): void };
  }) {
    this.#slideshow = options.slideshow;
    this.#commands = options.commands;
    this.#sync = options.sync;
    this.#config = options.config;
    this.#role = options.role;
    this.#featuresContainer = options.featuresContainer;
    this.#output = options.output;
  }

  /**
   * Register and activate a feature.
   */
  register(feature: Feature): void {
    if (this.#active.has(feature.id)) {
      log.warn({ featureId: feature.id }, 'feature already registered, skipping');
      return;
    }

    const container = document.createElement('div');
    container.setAttribute('data-feature', feature.id);
    this.#featuresContainer.appendChild(container);

    const registeredCommands: string[] = [];
    const context = this.#createContext(feature.id, container, registeredCommands);
    let cleanup: (() => void) | null = null;

    try {
      const result = feature.activate(context);
      cleanup = typeof result === 'function' ? result : null;
    } catch (err: unknown) {
      log.error({ featureId: feature.id, err }, 'feature activation failed');
      // Undo any commands registered before the error
      for (const name of registeredCommands) {
        this.#commands.unregister(name);
      }
      container.remove();
      return;
    }

    this.#active.set(feature.id, { feature, context, container, cleanup, registeredCommands });
    log.info({ featureId: feature.id }, 'feature activated');
  }

  /**
   * Deactivate and remove a feature.
   */
  unregister(featureId: string): void {
    const entry = this.#active.get(featureId);
    if (!entry) return;

    try {
      entry.feature.deactivate?.();
    } catch (err: unknown) {
      log.warn({ featureId, err }, 'feature deactivate() threw');
    }

    try {
      entry.cleanup?.();
    } catch (err: unknown) {
      log.warn({ featureId, err }, 'feature cleanup threw');
    }

    // Unregister all commands this feature registered
    for (const name of entry.registeredCommands) {
      this.#commands.unregister(name);
    }

    entry.container.remove();
    this.#listeners.delete(featureId);
    this.#active.delete(featureId);
    log.info({ featureId }, 'feature unregistered');
  }

  /**
   * Dispatch a lifecycle event to all active features.
   */
  emit<K extends keyof FeatureLifecycleEvents>(
    event: K,
    payload: FeatureLifecycleEvents[K],
  ): void {
    for (const [featureId, featureListeners] of this.#listeners) {
      const handlers = featureListeners.get(event);
      if (!handlers) continue;
      for (const handler of handlers) {
        try {
          (handler as EventHandler<K>)(payload);
        } catch (err: unknown) {
          log.error({ featureId, event, err }, 'feature event handler threw');
        }
      }
    }
  }

  /**
   * Deactivate all features (deck teardown).
   */
  deactivateAll(): void {
    for (const featureId of [...this.#active.keys()]) {
      this.unregister(featureId);
    }
  }

  /**
   * List all active feature IDs.
   */
  list(): string[] {
    return [...this.#active.keys()];
  }

  #createContext(featureId: string, container: HTMLElement, registeredCommands: string[]): FeatureContext {
    const slideshow = this.#slideshow;
    const commands = this.#commands;
    const sync = this.#sync;
    const config = this.#config;
    const role = this.#role;
    const output = this.#output;
    const listeners = this.#listeners;

    // Ensure a listener map exists for this feature
    if (!listeners.has(featureId)) {
      listeners.set(featureId, new Map());
    }

    const syncAPI: FeatureSyncAPI | null = sync ? {
      get connected(): boolean {
        return sync.isConnected;
      },
      get readonly(): boolean {
        return sync.isReadonly;
      },
      getSharedMap(): Y.Map<unknown> {
        const root = sync.doc.getMap('features');
        let featureMap = root.get(featureId) as Y.Map<unknown> | undefined;
        if (!featureMap) {
          featureMap = new Y.Map();
          root.set(featureId, featureMap);
        }
        return featureMap;
      },
      getSharedArray(): Y.Array<unknown> {
        const featureMap = this.getSharedMap();
        let arr = featureMap.get('items') as Y.Array<unknown> | undefined;
        if (!arr) {
          arr = new Y.Array();
          featureMap.set('items', arr);
        }
        return arr;
      },
      getEphemeralMap(): Y.Map<unknown> {
        const featureMap = this.getSharedMap();
        let eph = featureMap.get('ephemeral') as Y.Map<unknown> | undefined;
        if (!eph) {
          eph = new Y.Map();
          featureMap.set('ephemeral', eph);
        }
        return eph;
      },
      createEventBridge(config: EventBridgeConfig): EventBridge {
        return new EventBridge(this, config);
      },
    } : null;

    return {
      featureId,
      config,
      role,
      slideshow: {
        get currentSlide(): number { return slideshow.currentSlide; },
        get currentPartial(): number { return slideshow.currentPartial; },
        get slideCount(): number { return slideshow.slideCount; },
        get mode(): string { return slideshow.mode; },
        goTo: (slide: number, partial?: number) => { slideshow.goTo(slide, partial); },
        next: () => { slideshow.next(); },
        prev: () => { slideshow.prev(); },
      },
      commands: {
        register: (command) => {
          commands.register(command);
          registeredCommands.push(command.name);
        },
      },
      sync: syncAPI,
      container,
      on: <K extends keyof FeatureLifecycleEvents>(
        event: K,
        handler: (payload: FeatureLifecycleEvents[K]) => void,
      ): (() => void) => {
        const featureListeners = listeners.get(featureId);
        if (!featureListeners) {
          return () => { /* no-op if feature was already removed */ };
        }

        if (!featureListeners.has(event)) {
          featureListeners.set(event, new Set());
        }
        const handlers = featureListeners.get(event);
        if (!handlers) {
          return () => { /* unreachable — set above */ };
        }
        const wrapped = handler as AnyEventHandler;
        handlers.add(wrapped);

        return () => {
          handlers.delete(wrapped);
        };
      },
      output: {
        show: (msg: string) => { output.show(msg); },
      },
      syncManager: sync,
    };
  }
}
