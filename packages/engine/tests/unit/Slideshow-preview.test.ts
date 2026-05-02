// @vitest-environment jsdom
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Slide } from '../../src/core/Slide.ts';
import { Slideshow } from '../../src/core/Slideshow.ts';
import type { SlideData } from '../../src/core/SlideParser.ts';

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

describe('Slideshow preview', () => {
  let slideshow: Slideshow;
  const slides: SlideData[] = [
    {
      id: 'slide-1',
      html: '<h1>Slide 1</h1>',
      classes: ['layout-title'],
      backgroundImage: undefined,
      backgroundColor: undefined,
      rawCss: undefined,
      notesHtml: undefined,
      detailsHtml: undefined,
      partialCount: 0,
    },
    {
      id: 'slide-2',
      html: '<h1>Slide 2</h1>',
      classes: ['layout-two-col'],
      backgroundImage: undefined,
      backgroundColor: undefined,
      rawCss: undefined,
      notesHtml: undefined,
      detailsHtml: undefined,
      partialCount: 0,
    },
  ];

  beforeEach(() => {
    slideshow = document.createElement('geek-slideshow') as Slideshow;
    document.body.appendChild(slideshow);
    slideshow.loadSlides(slides);
  });

  it('applyPreviewClass adds preview class and marks with data-preview', () => {
    slideshow.applyPreviewClass(0, 'layout-cover');

    const slideEl = slideshow.shadowRoot!.querySelectorAll('geek-slide')[0] as HTMLElement;
    expect(slideEl?.classList.contains('layout-cover')).toBe(true);
    expect(slideEl?.hasAttribute('data-preview')).toBe(true);
  });

  it('applyPreviewClass removes conflicting layout classes', () => {
    const slideEl = slideshow.shadowRoot!.querySelectorAll('geek-slide')[0] as HTMLElement;
    expect(slideEl?.classList.contains('layout-title')).toBe(true);

    slideshow.applyPreviewClass(0, 'layout-cover');

    expect(slideEl?.classList.contains('layout-title')).toBe(false);
    expect(slideEl?.classList.contains('layout-cover')).toBe(true);
  });

  it('clearPreview restores original classes', () => {
    const slideEl = slideshow.shadowRoot!.querySelectorAll('geek-slide')[0] as HTMLElement;
    const originalClasses = Array.from(slideEl!.classList);

    slideshow.applyPreviewClass(0, 'layout-cover');
    slideshow.clearPreview();

    const restoredClasses = Array.from(slideEl!.classList);
    expect(restoredClasses).toEqual(originalClasses);
    expect(slideEl?.hasAttribute('data-preview')).toBe(false);
  });

  it('clearPreview does nothing if no preview active', () => {
    expect(() => {
      slideshow.clearPreview();
      slideshow.clearPreview();
    }).not.toThrow();
  });

  it('applyPreviewClass on different slide clears previous preview', () => {
    slideshow.applyPreviewClass(0, 'layout-cover');
    const slide1 = slideshow.shadowRoot!.querySelectorAll('geek-slide')[0] as HTMLElement;
    expect(slide1?.classList.contains('layout-cover')).toBe(true);

    slideshow.applyPreviewClass(1, 'layout-three-col');
    expect(slide1?.classList.contains('layout-cover')).toBe(false);
    expect(slide1?.classList.contains('layout-title')).toBe(true); // restored

    const slide2 = slideshow.shadowRoot!.querySelectorAll('geek-slide')[1] as HTMLElement;
    expect(slide2?.classList.contains('layout-three-col')).toBe(true);
  });

  it('applyPreviewClass updates same slide multiple times', () => {
    slideshow.applyPreviewClass(0, 'layout-cover');
    slideshow.applyPreviewClass(0, 'layout-section');

    const slideEl = slideshow.shadowRoot!.querySelectorAll('geek-slide')[0] as HTMLElement;
    expect(slideEl?.classList.contains('layout-cover')).toBe(false);
    expect(slideEl?.classList.contains('layout-section')).toBe(true);
  });

  it('applyPreviewClass ignores invalid slideIndex', () => {
    expect(() => {
      slideshow.applyPreviewClass(-1, 'layout-cover');
      slideshow.applyPreviewClass(999, 'layout-cover');
    }).not.toThrow();
  });

  it('clearPreview removes data-preview attribute', () => {
    slideshow.applyPreviewClass(0, 'layout-cover');
    const slideEl = slideshow.shadowRoot!.querySelectorAll('geek-slide')[0] as HTMLElement;
    expect(slideEl?.hasAttribute('data-preview')).toBe(true);

    slideshow.clearPreview();
    expect(slideEl?.hasAttribute('data-preview')).toBe(false);
  });
});
