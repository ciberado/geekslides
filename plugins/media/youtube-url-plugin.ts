/**
 * GeekSlides v2 — YouTube URL plugin.
 *
 * Preprocessor that detects YouTube video URLs in image syntax and emits
 * `<geek-youtube>` elements.
 *
 * Supported URL patterns:
 *   https://www.youtube.com/watch?v=VIDEO_ID
 *   https://youtu.be/VIDEO_ID
 *   https://www.youtube.com/embed/VIDEO_ID
 *   https://m.youtube.com/watch?v=VIDEO_ID
 *
 * Markdown examples:
 *   ![My Talk](https://youtu.be/dQw4w9WgXcQ)
 *   ![](https://www.youtube.com/watch?v=dQw4w9WgXcQ)
 *
 * For full-cover layout, add the `.mod-media-cover` class to the slide marker:
 *   [](#slide-id,.mod-media-cover)
 *   ![My Talk](https://youtu.be/dQw4w9WgXcQ)
 *
 * Add to config.json:
 *   { "plugins": { "preprocessors": ["header", "youtube-url"] } }
 */

import type { Preprocessor } from '../sdk/types.ts';

const YOUTUBE_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be']);

const IMAGE_SYNTAX_RE = /!\[([^\]]*)\]\(([^)]+)\)/g;

/**
 * Extract the YouTube video ID from a URL, or return null if not a YouTube URL.
 */
function extractYouTubeId(rawUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }

  const host = url.hostname;
  if (!YOUTUBE_HOSTS.has(host)) return null;

  // youtu.be/<id>
  if (host === 'youtu.be') {
    const id = url.pathname.slice(1).split('/')[0];
    return id ?? null;
  }

  // youtube.com/watch?v=<id>
  const v = url.searchParams.get('v');
  if (v) return v;

  // youtube.com/embed/<id>
  const embedMatch = /^\/embed\/([^/?#]+)/.exec(url.pathname);
  if (embedMatch) return embedMatch[1] ?? null;

  return null;
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

export const youtubeUrlPreprocessor: Preprocessor = (markdown: string): string =>
  markdown.replace(IMAGE_SYNTAX_RE, (match, alt: string, url: string) => {
    const id = extractYouTubeId(url.trim());
    if (!id) return match;

    const title = alt.trim();
    const titleAttr = title ? ` title="${escapeAttr(title)}"` : '';

    return `<geek-youtube data-id="${escapeAttr(id)}"${titleAttr}></geek-youtube>`;
  });

export const youtubeUrlPlugin = {
  name: 'youtube-url',
  preprocessors: [youtubeUrlPreprocessor],
};
