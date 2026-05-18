/**
 * GeekSlides v2 — Plugin barrel export.
 */

export { PluginManager } from './PluginManager.ts';
export type { Plugin, Preprocessor, Processor, ProcessorContext } from './types.ts';
export { isLocalPluginPath, isRemotePluginUrl, importRemotePlugin, extractPreprocessor, extractProcessor } from './local-plugin.ts';
export { headerPreprocessor } from '../../../../plugins/core/header-preprocessor.ts';
export { slideSourceNotesPreprocessor } from '../../../../plugins/core/slide-source-notes-preprocessor.ts';
export { iframeProcessor } from '../../../../plugins/core/iframe-processor.ts';
export { chartProcessor } from '../../../../plugins/chart/chart-processor.ts';
export { videoProcessor } from '../../../../plugins/media/video-processor.ts';
export { videoUrlPlugin, videoUrlPreprocessor } from '../../../../plugins/media/video-url-plugin.ts';
export { iframeUrlPlugin, iframeUrlPreprocessor, iframeOverlayProcessor } from '../../../../plugins/media/iframe-url-plugin.ts';
export { youtubeUrlPlugin, youtubeUrlPreprocessor } from '../../../../plugins/media/youtube-url-plugin.ts';
export { audioUrlPlugin, audioUrlPreprocessor, audioProcessor } from '../../../../plugins/media/audio-url-plugin.ts';
