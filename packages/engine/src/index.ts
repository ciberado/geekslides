// @geekslides/engine — v2 entry point

export const VERSION = '2.0.0-alpha.0';

// Phase 1: Core data pipeline
export { loadConfig, DEFAULT_CONFIG } from './core/Config.ts';
export type { GeekSlidesConfig, SyncConfig, PluginsConfig } from './core/Config.ts';
export { parse } from './core/SlideParser.ts';
export type { SlideData } from './core/SlideParser.ts';
export { scope } from './core/StyleScoper.ts';
