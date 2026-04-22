/**
 * GeekSlides v2 — Feature system type definitions.
 *
 * Features are stateful, long-lived interactive extensions with access
 * to navigation, sync, commands, and DOM at runtime.
 */

import type * as Y from 'yjs';
import type { GeekSlidesConfig } from '../core/Config.ts';
import type { SyncManager } from '../sync/SyncManager.ts';

/* ------------------------------------------------------------------ */
/*  Lifecycle events                                                  */
/* ------------------------------------------------------------------ */

export interface FeatureLifecycleEvents {
  /** Presentation has been initialized, slides are loaded. */
  'presentation:ready': { readonly slideCount: number };

  /** Navigated to a new slide. */
  'slide:enter': { readonly slideIndex: number; readonly previousIndex: number };

  /** About to leave the current slide. */
  'slide:leave': { readonly slideIndex: number; readonly nextIndex: number };

  /** Partial reveal advanced on the current slide. */
  'partial:reveal': {
    readonly slideIndex: number;
    readonly partialIndex: number;
    readonly partialCount: number;
  };

  /** Sync connection state changed. */
  'sync:state': {
    readonly connected: boolean;
    readonly following: boolean;
    readonly readonly: boolean;
  };

  /** Presentation mode changed (present / overview / speaker). */
  'mode:change': { readonly mode: string; readonly previousMode: string };
}

/* ------------------------------------------------------------------ */
/*  Feature context (API surface passed to features)                  */
/* ------------------------------------------------------------------ */

export interface FeatureSlideshowAPI {
  readonly currentSlide: number;
  readonly currentPartial: number;
  readonly slideCount: number;
  readonly mode: string;
  goTo(slide: number, partial?: number): void;
  next(): void;
  prev(): void;
}

export interface FeatureCommandAPI {
  register(command: {
    readonly name: string;
    readonly label: string;
    readonly execute: (args?: string[]) => void;
    readonly category?: string;
  }): void;
}

export interface FeatureSyncAPI {
  /** Whether sync is currently connected. */
  readonly connected: boolean;
  /** Whether this client is in readonly mode. */
  readonly readonly: boolean;
  /**
   * Feature-scoped shared Y.Map for arbitrary key/value state.
   * Lives under `features.<featureId>` in the Yjs doc.
   */
  getSharedMap(): Y.Map<unknown>;
  /**
   * Feature-scoped shared Y.Array for ordered collections.
   * Lives under `features.<featureId>.items` in the Yjs doc.
   */
  getSharedArray(): Y.Array<unknown>;
}

export interface FeatureOutputAPI {
  show(message: string): void;
}

export interface FeatureContext {
  /** Unique feature identifier (from the Feature definition). */
  readonly featureId: string;

  /** The deck configuration. */
  readonly config: GeekSlidesConfig;

  /** Current role: 'presenter' or 'viewer'. */
  readonly role: 'presenter' | 'viewer';

  /** Navigation API (live — reads always reflect current state). */
  readonly slideshow: FeatureSlideshowAPI;

  /** Command registration API. */
  readonly commands: FeatureCommandAPI;

  /** Sync data API scoped to this feature's namespace. Null when sync is disabled. */
  readonly sync: FeatureSyncAPI | null;

  /** DOM mounting point inside the slideshow shadow root. */
  readonly container: HTMLElement;

  /** Subscribe to a lifecycle event. Returns an unsubscribe function. */
  on<K extends keyof FeatureLifecycleEvents>(
    event: K,
    handler: (payload: FeatureLifecycleEvents[K]) => void,
  ): () => void;

  /** Terminal output helper (shows a transient message). */
  readonly output: FeatureOutputAPI;

  /**
   * Raw SyncManager reference for advanced features that need direct Yjs
   * access beyond the scoped sync API (e.g., whiteboard stroke sync).
   * Null when sync is disabled.
   */
  readonly syncManager: SyncManager | null;
}

/* ------------------------------------------------------------------ */
/*  Feature definition                                                */
/* ------------------------------------------------------------------ */

export interface Feature {
  /** Unique identifier. Must be URL-safe (lowercase, hyphens, dots). */
  readonly id: string;

  /** Human-readable label for the help system. */
  readonly label: string;

  /**
   * Called when the feature is activated. Receives the full API context.
   * May return a cleanup function that will be called on deactivation.
   */
  activate(context: FeatureContext): (() => void) | undefined;

  /**
   * Optional: called before the cleanup function, when the feature is
   * being torn down (deck reload or unregistration).
   */
  deactivate?(): void;
}
