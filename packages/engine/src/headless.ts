/**
 * @geekslides/engine — headless entry point.
 *
 * Exports only non-DOM modules (parser, config, print).
 * Safe to import in Node.js without a browser environment.
 * Used by @geekslides/cli.
 */

export const VERSION = '2.0.0-alpha.0';

// Core data pipeline
export { loadConfig, DEFAULT_CONFIG } from './core/Config.ts';
export type { GeekSlidesConfig, SyncConfig, PluginsConfig } from './core/Config.ts';
export { parse } from './core/SlideParser.ts';
export type { SlideData } from './core/SlideParser.ts';
export { scope } from './core/StyleScoper.ts';

// Print
export { renderPrint } from './print/PrintRenderer.ts';
export type { TemplateName, PrintOptions } from './print/PrintRenderer.ts';
