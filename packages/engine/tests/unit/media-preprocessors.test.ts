/**
 * Unit tests for the four media URL preprocessors.
 *
 * These are pure string-transform functions — no DOM required.
 */
import { describe, it, expect } from 'vitest';
import { youtubeUrlPreprocessor } from '../../../../plugins/media/youtube-url-plugin.ts';
import { audioUrlPreprocessor } from '../../../../plugins/media/audio-url-plugin.ts';
import { videoUrlPreprocessor } from '../../../../plugins/media/video-url-plugin.ts';
import { iframeUrlPreprocessor } from '../../../../plugins/media/iframe-url-plugin.ts';

// ── YouTube URL Preprocessor ─────────────────────────────────────────────────

describe('youtubeUrlPreprocessor', () => {
  it('converts youtu.be short URL to geek-youtube element', () => {
    const input = '![My Talk](https://youtu.be/dQw4w9WgXcQ)';
    const out = youtubeUrlPreprocessor(input);
    expect(out).toBe('<geek-youtube data-id="dQw4w9WgXcQ" title="My Talk"></geek-youtube>');
  });

  it('converts watch?v= URL to geek-youtube element', () => {
    const input = '![Demo](https://www.youtube.com/watch?v=abc123)';
    const out = youtubeUrlPreprocessor(input);
    expect(out).toBe('<geek-youtube data-id="abc123" title="Demo"></geek-youtube>');
  });

  it('converts embed URL to geek-youtube element', () => {
    const input = '![](https://www.youtube.com/embed/XYZ789)';
    const out = youtubeUrlPreprocessor(input);
    expect(out).toBe('<geek-youtube data-id="XYZ789"></geek-youtube>');
  });

  it('converts m.youtube.com watch URL', () => {
    const input = '![Mobile](https://m.youtube.com/watch?v=mob42)';
    const out = youtubeUrlPreprocessor(input);
    expect(out).toBe('<geek-youtube data-id="mob42" title="Mobile"></geek-youtube>');
  });

  it('treats alt text "cover" as a regular title (no special attribute)', () => {
    const input = '![cover](https://youtu.be/dQw4w9WgXcQ)';
    const out = youtubeUrlPreprocessor(input);
    expect(out).toContain('title="cover"');
    expect(out).not.toContain(' cover>');
    expect(out).not.toContain(' cover ');
  });

  it('treats alt text "COVER" as a regular title (case-insensitive, no special attr)', () => {
    const input = '![COVER](https://youtu.be/dQw4w9WgXcQ)';
    const out = youtubeUrlPreprocessor(input);
    expect(out).toContain('title="COVER"');
    expect(out).not.toContain(' cover>');
  });

  it('does not transform regular image URLs', () => {
    const input = '![Photo](https://example.com/photo.jpg)';
    const out = youtubeUrlPreprocessor(input);
    expect(out).toBe(input);
  });

  it('does not transform non-YouTube URLs', () => {
    const input = '![Video](https://vimeo.com/123456)';
    const out = youtubeUrlPreprocessor(input);
    expect(out).toBe(input);
  });

  it('leaves non-image markdown unchanged', () => {
    const input = '[Not an image](https://youtube.com/watch?v=x)';
    const out = youtubeUrlPreprocessor(input);
    expect(out).toBe(input);
  });

  it('escapes HTML special chars in title', () => {
    const input = '![A&B "Talk"](https://youtu.be/id1)';
    const out = youtubeUrlPreprocessor(input);
    expect(out).toContain('A&amp;B &quot;Talk&quot;');
  });

  it('handles multiple YouTube embeds in same string', () => {
    const input = [
      '![First](https://youtu.be/aaa)',
      '![Second](https://youtu.be/bbb)',
    ].join('\n');
    const out = youtubeUrlPreprocessor(input);
    expect(out).toContain('data-id="aaa"');
    expect(out).toContain('data-id="bbb"');
  });
});

// ── Audio URL Preprocessor ───────────────────────────────────────────────────

describe('audioUrlPreprocessor', () => {
  it.each(['.mp3', '.wav', '.ogg', '.flac', '.aac', '.m4a', '.opus', '.weba'])(
    'converts %s extension to geek-audio element',
    (ext) => {
      const input = `![Track](https://example.com/audio${ext})`;
      const out = audioUrlPreprocessor(input);
      expect(out).toContain('<geek-audio');
      expect(out).toContain(`src="https://example.com/audio${ext}"`);
      expect(out).toContain('title="Track"');
    },
  );

  it('emits element without title when alt is empty', () => {
    const input = '![](./music.mp3)';
    const out = audioUrlPreprocessor(input);
    expect(out).toBe('<geek-audio src="./music.mp3"></geek-audio>');
  });

  it('handles query string in URL', () => {
    const input = '![](https://cdn.example.com/audio.mp3?v=2)';
    const out = audioUrlPreprocessor(input);
    expect(out).toContain('<geek-audio');
  });

  it('is case-insensitive for extensions', () => {
    const input = '![](./track.MP3)';
    const out = audioUrlPreprocessor(input);
    expect(out).toContain('<geek-audio');
  });

  it('does not transform non-audio image links', () => {
    const input = '![Image](https://example.com/photo.jpg)';
    const out = audioUrlPreprocessor(input);
    expect(out).toBe(input);
  });

  it('escapes special chars in src', () => {
    const input = '![](https://example.com/a&b.mp3)';
    const out = audioUrlPreprocessor(input);
    expect(out).toContain('src="https://example.com/a&amp;b.mp3"');
  });
});

// ── Video URL Preprocessor ───────────────────────────────────────────────────

describe('videoUrlPreprocessor', () => {
  it.each(['.mp4', '.webm', '.ogv', '.mov'])(
    'converts %s extension to video element',
    (ext) => {
      const input = `![Clip](https://example.com/video${ext})`;
      const out = videoUrlPreprocessor(input);
      expect(out).toContain('<video');
      expect(out).toContain(`src="https://example.com/video${ext}"`);
      expect(out).toContain('controls');
    },
  );

  it('includes title attribute when alt is present', () => {
    const input = '![My demo](./demo.mp4)';
    const out = videoUrlPreprocessor(input);
    expect(out).toContain('title="My demo"');
  });

  it('omits title attribute when alt is empty', () => {
    const input = '![](./demo.mp4)';
    const out = videoUrlPreprocessor(input);
    expect(out).not.toContain('title=');
  });

  it('does not transform non-video image links', () => {
    const input = '![Image](https://example.com/photo.jpg)';
    const out = videoUrlPreprocessor(input);
    expect(out).toBe(input);
  });

  it('is case-insensitive for extensions', () => {
    const input = '![](./clip.MP4)';
    const out = videoUrlPreprocessor(input);
    expect(out).toContain('<video');
  });
});

// ── Iframe URL Preprocessor ──────────────────────────────────────────────────

describe('iframeUrlPreprocessor', () => {
  it('converts .html URL to wrapped iframe', () => {
    const input = '![My App](https://example.com/demo.html)';
    const out = iframeUrlPreprocessor(input);
    expect(out).toContain('gs-iframe-wrapper');
    expect(out).toContain('<iframe');
    expect(out).toContain('data-src="https://example.com/demo.html"');
    expect(out).toContain('title="My App"');
  });

  it('converts .htm URL to wrapped iframe', () => {
    const input = '![](./page.htm)';
    const out = iframeUrlPreprocessor(input);
    expect(out).toContain('data-src="./page.htm"');
  });

  it('is case-insensitive for .HTML extension', () => {
    const input = '![](./page.HTML)';
    const out = iframeUrlPreprocessor(input);
    expect(out).toContain('<iframe');
  });

  it('handles query string in URL', () => {
    const input = '![](https://example.com/app.html?param=1)';
    const out = iframeUrlPreprocessor(input);
    expect(out).toContain('<iframe');
  });

  it('omits title when alt is empty', () => {
    const input = '![](./page.html)';
    const out = iframeUrlPreprocessor(input);
    expect(out).not.toContain('title=');
  });

  it('does not transform non-HTML links', () => {
    const input = '![Image](https://example.com/photo.jpg)';
    const out = iframeUrlPreprocessor(input);
    expect(out).toBe(input);
  });

  it('does not transform bare http links without extension', () => {
    const input = '![App](https://example.com/app)';
    const out = iframeUrlPreprocessor(input);
    expect(out).toBe(input);
  });

  it('escapes special chars in data-src', () => {
    const input = '![](https://example.com/a&b.html)';
    const out = iframeUrlPreprocessor(input);
    expect(out).toContain('data-src="https://example.com/a&amp;b.html"');
  });
});
