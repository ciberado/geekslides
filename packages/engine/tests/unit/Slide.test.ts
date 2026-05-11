// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { Slide } from '../../src/core/Slide.ts';
import { parse } from '../../src/core/SlideParser.ts';
import { registerLayoutTransform } from '../../src/core/LayoutTransforms.ts';

if (!customElements.get('geek-slide')) {
  customElements.define('geek-slide', Slide);
}

describe('Slide', () => {
  it('turns [partial] markers into revealable partial elements', () => {
    const md = `# Slide

- Item 1 [partial]
- Item 2 [partial]
`;
    const slideData = parse(md)[0]!;

    const el = document.createElement('geek-slide') as Slide;
    document.body.appendChild(el);

    el.loadContent(slideData.html, {
      id: slideData.id,
      classes: slideData.classes,
      partialCount: slideData.partialCount,
    });

    const shadow = el.shadowRoot!;
    const content = shadow.querySelector('section.content');
    const partials = shadow.querySelectorAll('.gs-partial');

    expect(partials).toHaveLength(2);
    expect(content?.textContent).not.toContain('[partial]');

    el.revealPartial(1);
    const visiblePartials = [...partials].filter((partial) => partial.classList.contains('gs-visible'));
    expect(visiblePartials).toHaveLength(1);

    document.body.removeChild(el);
  });

  it('sets ARIA attributes when connected', () => {
    const el = document.createElement('geek-slide') as Slide;
    document.body.appendChild(el);

    expect(el.getAttribute('role')).toBe('group');
    expect(el.getAttribute('aria-roledescription')).toBe('slide');

    document.body.removeChild(el);
  });

  it('applies built-in layout-compare transform when class is present', () => {
    const md = `- Option A

#### vs

- Option B
`;
    const slideData = parse(md)[0]!;
    const el = document.createElement('geek-slide') as Slide;
    document.body.appendChild(el);

    el.loadContent(slideData.html, {
      id: 'compare-test',
      classes: ['layout-compare'],
      partialCount: 0,
    });

    const content = el.shadowRoot!.querySelector('section.content')!;
    const badge = content.querySelector('.gs-vs-badge');
    expect(badge).not.toBeNull();
    expect(badge?.tagName).toBe('SPAN');
    expect(content.querySelector('h4')).toBeNull();

    document.body.removeChild(el);
  });

  it('applies built-in layout-three-col transform wrapping cards', () => {
    const md = `#### Card A

Content A.

#### Card B

Content B.

#### Card C

Content C.
`;
    const slideData = parse(md)[0]!;
    const el = document.createElement('geek-slide') as Slide;
    document.body.appendChild(el);

    el.loadContent(slideData.html, {
      id: 'three-col-test',
      classes: ['layout-three-col'],
      partialCount: 0,
    });

    const content = el.shadowRoot!.querySelector('section.content')!;
    const cards = content.querySelectorAll('.gs-card');
    expect(cards).toHaveLength(3);

    document.body.removeChild(el);
  });

  it('applies a custom layout transform registered before loadContent', () => {
    registerLayoutTransform('layout-custom-slide-test', (section) => {
      const banner = document.createElement('div');
      banner.className = 'custom-banner';
      banner.textContent = 'Custom!';
      section.prepend(banner);
    });

    const el = document.createElement('geek-slide') as Slide;
    document.body.appendChild(el);

    el.loadContent('<p>Slide content</p>', {
      id: 'custom-transform-test',
      classes: ['layout-custom-slide-test'],
      partialCount: 0,
    });

    const content = el.shadowRoot!.querySelector('section.content')!;
    expect(content.querySelector('.custom-banner')?.textContent).toBe('Custom!');

    document.body.removeChild(el);
  });

  it('does not apply transforms when the layout class is absent', () => {
    let called = false;
    registerLayoutTransform('layout-should-not-fire', () => { called = true; });

    const el = document.createElement('geek-slide') as Slide;
    document.body.appendChild(el);

    el.loadContent('<p>Plain slide</p>', {
      id: 'no-transform-test',
      classes: [],
      partialCount: 0,
    });

    expect(called).toBe(false);

    document.body.removeChild(el);
  });
});