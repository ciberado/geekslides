/**
 * GeekSlides Media Plugin Bundle — Entry point.
 *
 * Exports: youtube-url, audio-url, video-url, iframe-url preprocessors,
 * video, audio-url, iframe-url processors, and media-sync feature.
 * This bundle has no runtime engine dependencies.
 */

import type { PluginAPI, PluginExports, PluginActivate } from '../sdk/types.ts';
import { youtubeUrlPreprocessor } from './youtube-url-plugin.ts';
import { audioUrlPreprocessor, audioProcessor } from './audio-url-plugin.ts';
import { videoUrlPreprocessor } from './video-url-plugin.ts';
import { iframeUrlPreprocessor, iframeOverlayProcessor } from './iframe-url-plugin.ts';
import { videoProcessor } from './video-processor.ts';
import { mediaSyncFeature } from './media-sync-feature.ts';

export const activate: PluginActivate = (_api: PluginAPI): PluginExports => ({
  preprocessors: {
    'youtube-url': youtubeUrlPreprocessor,
    'audio-url': audioUrlPreprocessor,
    'video-url': videoUrlPreprocessor,
    'iframe-url': iframeUrlPreprocessor,
  },
  processors: {
    'video': videoProcessor,
    'audio-url': audioProcessor,
    'iframe-url': iframeOverlayProcessor,
  },
  features: {
    'media-sync': mediaSyncFeature,
  },
});
