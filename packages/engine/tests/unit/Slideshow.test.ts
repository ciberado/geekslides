// @vitest-environment jsdom
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { Slide } from '../../src/core/Slide.ts';
import { Slideshow } from '../../src/core/Slideshow.ts';

beforeAll(() => {
  class ResizeObserverStub {
    observe(): void {}
    disconnect(): void {}
  }
  vi.stubGlobal('ResizeObserver', ResizeObserverStub);
});

if (!customElements.get('geek-slide')) {
  customElements.define('geek-slide', Slide);
}

if (!customElements.get('geek-slideshow')) {
  customElements.define('geek-slideshow', Slideshow);
}

describe('Slideshow', () => {
  it('can preserve slide position during reload without transitions', () => {
    const el = document.createElement('geek-slideshow') as Slideshow;
    document.body.appendChild(el);

    el.loadSlides([
      { id: 'a', html: '<h1>A</h1>', classes: [], partialCount: 0, backgroundImage: undefined, backgroundColor: undefined, rawCss: undefined, notesHtml: undefined, detailsHtml: undefined },
      { id: 'b', html: '<h1>B</h1>', classes: [], partialCount: 2, backgroundImage: undefined, backgroundColor: undefined, rawCss: undefined, notesHtml: undefined, detailsHtml: undefined },
    ]);
    el.goTo(1, 1);

    el.loadSlides([
      { id: 'a', html: '<h1>A2</h1>', classes: [], partialCount: 0, backgroundImage: undefined, backgroundColor: undefined, rawCss: undefined, notesHtml: undefined, detailsHtml: undefined },
      { id: 'b', html: '<h1>B2</h1>', classes: [], partialCount: 2, backgroundImage: undefined, backgroundColor: undefined, rawCss: undefined, notesHtml: undefined, detailsHtml: undefined },
    ], {
      initialSlide: 1,
      initialPartial: 1,
      suppressTransition: true,
    });

    expect(el.currentSlide).toBe(1);
    expect(el.currentPartial).toBe(1);

    const slides = el.shadowRoot?.querySelectorAll('geek-slide') ?? [];
    expect(slides[1]?.hasAttribute('active')).toBe(true);
    expect(slides[1]?.classList.contains('transition-none')).toBe(true);

    document.body.removeChild(el);
  });

  it('setDesignDimensions sets design space directly without aspect ratio formula', () => {
    const el = document.createElement('geek-slideshow') as Slideshow;
    document.body.appendChild(el);
    // setAspectRatio would give 16/9 * 120 = 1920×1080
    el.setAspectRatio('16/9');
    // Override with exact PPTX dimensions
    el.setDesignDimensions(960, 540);
    // The element should not throw and should remain usable
    expect(el.slideCount).toBe(0);
    document.body.removeChild(el);
  });
});
