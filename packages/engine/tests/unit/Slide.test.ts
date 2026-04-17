// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { Slide } from '../../src/core/Slide.ts';
import { parse } from '../../src/core/SlideParser.ts';

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
});