/**
 * GeekSlides Plugin SDK — Type definitions for plugin authors.
 *
 * This file defines the contract between the host application and plugins.
 * Plugins receive a `PluginAPI` via their `activate()` function and return
 * a `PluginExports` object containing preprocessors, processors, and/or features.
 *
 * These types are standalone — they do NOT import from `@engine/*` or any
 * internal engine path. This ensures plugins can be compiled independently.
 */

/* ------------------------------------------------------------------ */
/*  Core plugin types                                                  */
/* ------------------------------------------------------------------ */

/**
 * Configuration object shape passed to preprocessors.
 * This is a minimal view — plugins should treat it as opaque beyond
 * the fields they explicitly document.
 */
export interface PluginConfig {
  readonly title: string;
  readonly content: readonly string[];
  readonly styles: readonly string[];
  readonly aspectRatio: string;
  readonly sync: { readonly enabled: boolean; readonly server: string; readonly room: string };
  readonly [key: string]: unknown;
}

/**
 * Result of a preprocessor: either the transformed markdown string,
 * or an object with content + optional line mapping for source-map support.
 */
export interface PreprocessorOutput {
  readonly content: string;
  readonly lineMapping?: readonly number[];
}

export type PreprocessorResult = string | PreprocessorOutput;

/**
 * A preprocessor transforms raw markdown before it is parsed into slides.
 */
export type Preprocessor = (markdown: string, config: PluginConfig) => PreprocessorResult;

/**
 * Context provided to processors when transforming a rendered slide.
 */
export interface ProcessorContext {
  readonly slideIndex: number;
  readonly slideCount: number;
  readonly config: PluginConfig;
  readonly slideshow: HTMLElement;
}

/**
 * A processor transforms a rendered slide's content DOM after HTML insertion.
 */
export type Processor = (slideElement: HTMLElement, context?: ProcessorContext) => void;

/* ------------------------------------------------------------------ */
/*  Feature types (stateful, long-lived extensions)                    */
/* ------------------------------------------------------------------ */

export interface FeatureLifecycleEvents {
  'presentation:ready': { readonly slideCount: number };
  'slide:enter': { readonly slideIndex: number; readonly previousIndex: number };
  'slide:leave': { readonly slideIndex: number; readonly nextIndex: number };
  'partial:reveal': {
    readonly slideIndex: number;
    readonly partialIndex: number;
    readonly partialCount: number;
  };
  'sync:state': {
    readonly connected: boolean;
    readonly following: boolean;
    readonly readonly: boolean;
  };
  'mode:change': { readonly mode: string; readonly previousMode: string };
}

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
  readonly connected: boolean;
  readonly readonly: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getSharedMap(): any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getSharedArray(): any;
}

export interface FeatureOutputAPI {
  show(message: string): void;
}

export interface FeatureContext {
  readonly featureId: string;
  readonly config: PluginConfig;
  readonly role: 'presenter' | 'viewer';
  readonly slideshow: FeatureSlideshowAPI;
  readonly commands: FeatureCommandAPI;
  readonly sync: FeatureSyncAPI | null;
  readonly container: HTMLElement;
  on<K extends keyof FeatureLifecycleEvents>(
    event: K,
    handler: (payload: FeatureLifecycleEvents[K]) => void,
  ): () => void;
  readonly output: FeatureOutputAPI;
  /** Raw SyncManager for advanced features needing direct Yjs access. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly syncManager: any;
}

export interface Feature {
  readonly id: string;
  readonly label: string;
  activate(context: FeatureContext): (() => void) | undefined;
  deactivate?(): void;
}

/* ------------------------------------------------------------------ */
/*  Plugin API — injected at activation time                          */
/* ------------------------------------------------------------------ */

/** Logger interface (subset of pino Logger). */
export interface PluginLogger {
  trace(msg: string, ...args: unknown[]): void;
  trace(obj: object, msg?: string, ...args: unknown[]): void;
  debug(msg: string, ...args: unknown[]): void;
  debug(obj: object, msg?: string, ...args: unknown[]): void;
  info(msg: string, ...args: unknown[]): void;
  info(obj: object, msg?: string, ...args: unknown[]): void;
  warn(msg: string, ...args: unknown[]): void;
  warn(obj: object, msg?: string, ...args: unknown[]): void;
  error(msg: string, ...args: unknown[]): void;
  error(obj: object, msg?: string, ...args: unknown[]): void;
}

/**
 * Factory to create namespaced loggers.
 */
export type CreateLogger = (namespace: string) => PluginLogger;

/**
 * WhiteboardSync class interface — used by the whiteboard feature.
 */
export interface WhiteboardSyncClass {
  new (syncManager: unknown, eventTarget?: EventTarget): WhiteboardSyncInstance;
}

export interface WhiteboardSyncInstance {
  activate(): void;
  deactivate(): void;
}

/**
 * The runtime API injected into plugins via the `activate()` function.
 * This is the only coupling point between plugins and the host.
 */
export interface PluginAPI {
  /** SDK version for compatibility checks. */
  readonly version: number;
  /** Create a namespaced logger. */
  readonly createLogger: CreateLogger;
  /** WhiteboardSync constructor (for the whiteboard feature). */
  readonly WhiteboardSync: WhiteboardSyncClass;
}

/* ------------------------------------------------------------------ */
/*  Plugin module exports                                             */
/* ------------------------------------------------------------------ */

/**
 * The shape a compiled plugin bundle exports.
 *
 * A plugin module must export an `activate` function. The host calls it
 * with the PluginAPI and receives the plugin's contributions.
 */
export interface PluginExports {
  readonly preprocessors?: Readonly<Record<string, Preprocessor>>;
  readonly processors?: Readonly<Record<string, Processor>>;
  readonly features?: Readonly<Record<string, Feature>>;
}

/**
 * The activation function exported by a plugin bundle.
 */
export type PluginActivate = (api: PluginAPI) => PluginExports;
