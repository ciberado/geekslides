/**
 * GeekSlides v2 — Video URL plugin.
 *
 * Preprocessor that detects video file URLs in image syntax and emits
 * a raw `<video>` element. The built-in `video` processor then wraps
 * it in `<geek-video>` for timestamp/partial control.
 *
 * Supported extensions: .mp4, .webm, .ogv, .mov
 *
 * Markdown syntax:
 *   ![alt text](https://example.com/demo.mp4)
 *   ![](relative/clip.webm)
 */

import type { Plugin, Preprocessor } from '@engine/plugins/types.ts';

const VIDEO_EXT_RE = /\.(mp4|webm|ogv|mov)(\?[^)]*)?$/i;
const IMAGE_SYNTAX_RE = /!\[([^\]]*)\]\(([^)]+)\)/g;

function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

export const videoUrlPreprocessor: Preprocessor = (markdown: string): string =>
  markdown.replace(IMAGE_SYNTAX_RE, (match, alt: string, url: string) => {
    if (!VIDEO_EXT_RE.test(url)) return match;
    const title = alt.trim();
    const titleAttr = title ? ` title="${escapeAttr(title)}"` : '';
    return `<video src="${escapeAttr(url)}" controls${titleAttr}></video>`;
  });

export const videoUrlPlugin: Plugin = {
  name: 'video-url',
  preprocessors: [videoUrlPreprocessor],
};
