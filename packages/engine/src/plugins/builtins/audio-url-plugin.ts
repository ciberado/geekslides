/**
 * GeekSlides v2 — Audio URL plugin.
 *
 * Preprocessor: detects audio file URLs in image syntax and emits
 * `<geek-audio>` elements.
 *
 * Processor: wraps bare `<audio>` elements in `<geek-audio>` (same pattern
 * as the built-in `video` processor for `<video>` → `<geek-video>`).
 *
 * Supported extensions: .mp3, .wav, .ogg, .flac, .aac, .m4a, .opus, .weba
 *
 * Markdown examples:
 *   ![Background track](https://example.com/music.mp3)
 *   ![](./assets/intro.ogg)
 *
 * Add to config.json:
 *   { "plugins": { "preprocessors": ["header", "audio-url"], "processors": ["iframe", "video", "audio-url"] } }
 */

import type { Plugin, Preprocessor, Processor } from '../types.ts';

const AUDIO_EXT_RE = /\.(mp3|wav|ogg|flac|aac|m4a|opus|weba)(\?[^)]*)?$/i;
const IMAGE_SYNTAX_RE = /!\[([^\]]*)\]\(([^)]+)\)/g;

function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

export const audioUrlPreprocessor: Preprocessor = (markdown: string): string =>
  markdown.replace(IMAGE_SYNTAX_RE, (match, alt: string, url: string) => {
    if (!AUDIO_EXT_RE.test(url.trim())) return match;
    const title = alt.trim();
    const titleAttr = title ? ` title="${escapeAttr(title)}"` : '';
    return `<geek-audio src="${escapeAttr(url.trim())}"${titleAttr}></geek-audio>`;
  });

/**
 * Wraps bare `<audio>` elements in `<geek-audio>` so they gain the visualiser
 * and lifecycle management (pause on slide change, sync events).
 */
export const audioProcessor: Processor = (slideElement: HTMLElement): void => {
  const audios = slideElement.querySelectorAll('audio:not(geek-audio audio)');
  if (audios.length === 0) return;

  audios.forEach((audio) => {
    const geekAudio = document.createElement('geek-audio');
    const src = audio.getAttribute('src');
    if (src) geekAudio.setAttribute('src', src);
    const title = audio.getAttribute('title');
    if (title) geekAudio.setAttribute('title', title);
    audio.replaceWith(geekAudio);
  });
};

export const audioUrlPlugin: Plugin = {
  name: 'audio-url',
  preprocessors: [audioUrlPreprocessor],
  processors: [audioProcessor],
};
