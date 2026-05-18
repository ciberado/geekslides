/**
 * GeekSlides v2 — Plugin barrel export.
 */

export { PluginManager } from './PluginManager.ts';
export type { Plugin, Preprocessor, Processor, ProcessorContext } from './types.ts';
export { isLocalPluginPath, isRemotePluginUrl, importRemotePlugin, extractPreprocessor, extractProcessor } from './local-plugin.ts';
