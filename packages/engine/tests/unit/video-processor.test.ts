// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { videoProcessor } from '../../../../plugins/media/video-processor.ts';
import { DEFAULT_CONFIG } from '../../src/core/Config.ts';

describe('video-processor', () => {
  it('wraps <video> in <geek-video>', () => {
    const el = document.createElement('div');
    el.innerHTML = '<video src="test.mp4" data-timestamps="0,5,10"></video>';

    const ctx = { slideIndex: 0, slideCount: 1, config: DEFAULT_CONFIG, slideshow: el };
    videoProcessor(el, ctx);

    const geekVideo = el.querySelector('geek-video');
    expect(geekVideo).not.toBeNull();
    expect(geekVideo?.getAttribute('data-timestamps')).toBe('0,5,10');
  });

  it('ignores slides without video', () => {
    const el = document.createElement('div');
    el.innerHTML = '<p>No video here</p>';

    const ctx = { slideIndex: 0, slideCount: 1, config: DEFAULT_CONFIG, slideshow: el };
    videoProcessor(el, ctx);

    expect(el.querySelector('geek-video')).toBeNull();
  });
});
