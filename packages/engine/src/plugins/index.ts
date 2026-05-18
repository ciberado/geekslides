/**
 * GeekSlides v2 — Plugin barrel export.
 */

export { PluginManager } from './PluginManager.ts';
export type { Plugin, Preprocessor, Processor, ProcessorContext } from './types.ts';
export { isLocalPluginPath, isRemotePluginUrl, importRemotePlugin, extractPreprocessor, extractProcessor } from './local-plugin.ts';
export { headerPreprocessor } from './builtins/header-preprocessor.ts';
export { slideSourceNotesPreprocessor } from './builtins/slide-source-notes-preprocessor.ts';
export { iframeProcessor } from './builtins/iframe-processor.ts';
export { chartProcessor } from './builtins/chart-processor.ts';
export { videoProcessor } from './builtins/video-processor.ts';
export { videoUrlPlugin, videoUrlPreprocessor } from './builtins/video-url-plugin.ts';
export { iframeUrlPlugin, iframeUrlPreprocessor, iframeOverlayProcessor } from './builtins/iframe-url-plugin.ts';
export { youtubeUrlPlugin, youtubeUrlPreprocessor } from './builtins/youtube-url-plugin.ts';
export { audioUrlPlugin, audioUrlPreprocessor, audioProcessor } from './builtins/audio-url-plugin.ts';
