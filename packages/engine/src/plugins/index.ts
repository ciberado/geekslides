/**
 * GeekSlides v2 — Plugin barrel export.
 */

export { PluginManager } from './PluginManager.ts';
export type { Plugin, Preprocessor, Processor, ProcessorContext } from './types.ts';
export { isLocalPluginPath, isRemotePluginUrl, importRemotePlugin, extractPreprocessor, extractProcessor } from './local-plugin.ts';
export { headerPreprocessor } from './builtins/header-preprocessor.ts';
export { iframeProcessor } from './builtins/iframe-processor.ts';
export { chartProcessor } from './builtins/chart-processor.ts';
export { videoProcessor } from './builtins/video-processor.ts';
