/**
 * @geekslides/engine — headless entry point.
 *
 * Exports only non-DOM modules (parser, config, print).
 * Safe to import in Node.js without a browser environment.
 * Used by @geekslides/cli.
 */

export const VERSION = '2.0.0-alpha.0';

// Core data pipeline
export { loadConfig, DEFAULT_CONFIG, VALID_TRANSITIONS } from './core/Config.ts';
export type { GeekSlidesConfig, SyncConfig, PluginsConfig, TransitionName } from './core/Config.ts';
export { parse } from './core/SlideParser.ts';
export type { SlideData } from './core/SlideParser.ts';
export { parseHtmlSlides } from './core/HtmlSlideParser.ts';
export type { HtmlSlideParserOptions } from './core/HtmlSlideParser.ts';
export { scope } from './core/StyleScoper.ts';

// Print
export { renderPrint } from './print/PrintRenderer.ts';
export type { TemplateName, PrintOptions, DetailsLayout } from './print/PrintRenderer.ts';
