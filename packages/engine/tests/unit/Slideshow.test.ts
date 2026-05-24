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

  describe('setTransition', () => {
    function makeSlide(id: string, classes: string[] = []): import('../../src/core/SlideParser.ts').SlideData {
      return { id, html: `<h1>${id}</h1>`, classes, partialCount: 0, backgroundImage: undefined, backgroundColor: undefined, rawCss: undefined, notesHtml: undefined, detailsHtml: undefined };
    }

    it('defaults to "slide" transition (no transition class added)', () => {
      const el = document.createElement('geek-slideshow') as Slideshow;
      document.body.appendChild(el);
      el.loadSlides([makeSlide('a'), makeSlide('b')]);

      const slides = el.shadowRoot?.querySelectorAll('geek-slide') ?? [];
      expect(slides[0]?.classList.contains('transition-fade')).toBe(false);
      expect(slides[0]?.classList.contains('transition-none')).toBe(false);
      expect(el.transition).toBe('slide');
      document.body.removeChild(el);
    });

    it('applies fade transition to all slides', () => {
      const el = document.createElement('geek-slideshow') as Slideshow;
      document.body.appendChild(el);
      el.loadSlides([makeSlide('a'), makeSlide('b')]);
      el.setTransition('fade');

      const slides = el.shadowRoot?.querySelectorAll('geek-slide') ?? [];
      expect(slides[0]?.classList.contains('transition-fade')).toBe(true);
      expect(slides[1]?.classList.contains('transition-fade')).toBe(true);
      expect(el.transition).toBe('fade');
      document.body.removeChild(el);
    });

    it('does not override per-slide transition classes', () => {
      const el = document.createElement('geek-slideshow') as Slideshow;
      document.body.appendChild(el);
      el.loadSlides([makeSlide('a', ['transition-none']), makeSlide('b')]);
      el.setTransition('fade');

      const slides = el.shadowRoot?.querySelectorAll('geek-slide') ?? [];
      // First slide has explicit transition-none, should NOT get fade
      expect(slides[0]?.classList.contains('transition-none')).toBe(true);
      expect(slides[0]?.classList.contains('transition-fade')).toBe(false);
      // Second slide should get fade
      expect(slides[1]?.classList.contains('transition-fade')).toBe(true);
      document.body.removeChild(el);
    });

    it('does not override succession class', () => {
      const el = document.createElement('geek-slideshow') as Slideshow;
      document.body.appendChild(el);
      el.loadSlides([makeSlide('a', ['succession']), makeSlide('b')]);
      el.setTransition('fade');

      const slides = el.shadowRoot?.querySelectorAll('geek-slide') ?? [];
      expect(slides[0]?.classList.contains('transition-fade')).toBe(false);
      expect(slides[1]?.classList.contains('transition-fade')).toBe(true);
      document.body.removeChild(el);
    });

    it('removes previous default transition when switching', () => {
      const el = document.createElement('geek-slideshow') as Slideshow;
      document.body.appendChild(el);
      el.loadSlides([makeSlide('a'), makeSlide('b')]);
      el.setTransition('fade');
      el.setTransition('none');

      const slides = el.shadowRoot?.querySelectorAll('geek-slide') ?? [];
      expect(slides[0]?.classList.contains('transition-fade')).toBe(false);
      expect(slides[0]?.classList.contains('transition-none')).toBe(true);
      document.body.removeChild(el);
    });

    it('removes transition class when switching back to slide', () => {
      const el = document.createElement('geek-slideshow') as Slideshow;
      document.body.appendChild(el);
      el.loadSlides([makeSlide('a')]);
      el.setTransition('fade');
      el.setTransition('slide');

      const slides = el.shadowRoot?.querySelectorAll('geek-slide') ?? [];
      expect(slides[0]?.classList.contains('transition-fade')).toBe(false);
      expect(slides[0]?.classList.contains('transition-none')).toBe(false);
      document.body.removeChild(el);
    });

    it('applies config transition during loadSlides', () => {
      const el = document.createElement('geek-slideshow') as Slideshow;
      document.body.appendChild(el);
      el.setTransition('fade');
      el.loadSlides([makeSlide('a'), makeSlide('b')]);

      const slides = el.shadowRoot?.querySelectorAll('geek-slide') ?? [];
      expect(slides[0]?.classList.contains('transition-fade')).toBe(true);
      expect(slides[1]?.classList.contains('transition-fade')).toBe(true);
      document.body.removeChild(el);
    });

    it('does not apply default transition when suppressTransition is set', () => {
      const el = document.createElement('geek-slideshow') as Slideshow;
      document.body.appendChild(el);
      el.setTransition('fade');
      el.loadSlides([makeSlide('a'), makeSlide('b')], { suppressTransition: true });

      const slides = el.shadowRoot?.querySelectorAll('geek-slide') ?? [];
      // suppressTransition adds transition-none, should not also add transition-fade
      expect(slides[0]?.classList.contains('transition-none')).toBe(true);
      expect(slides[0]?.classList.contains('transition-fade')).toBe(false);
      document.body.removeChild(el);
    });

    it('rejects invalid transition names', () => {
      const el = document.createElement('geek-slideshow') as Slideshow;
      document.body.appendChild(el);
      el.loadSlides([makeSlide('a')]);
      el.setTransition('fade');
      // @ts-expect-error — testing invalid value at runtime
      el.setTransition('flip');
      // Should remain 'fade'
      expect(el.transition).toBe('fade');
      document.body.removeChild(el);
    });
  });
});
