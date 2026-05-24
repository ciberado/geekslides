import { describe, it, expect } from 'vitest';
import { parseHtmlSlides, extractHtmlSlideDimensions } from '../../src/core/HtmlSlideParser.ts';

describe('parseHtmlSlides', () => {
  describe('basic parsing', () => {
    it('returns empty array for empty string', () => {
      expect(parseHtmlSlides('')).toEqual([]);
    });

    it('returns empty array when no sections present', () => {
      expect(parseHtmlSlides('<div>Not a section</div>')).toEqual([]);
    });

    it('parses a single section', () => {
      const slides = parseHtmlSlides('<section style="width:960px;"><p>Hello</p></section>');
      expect(slides).toHaveLength(1);
      expect(slides[0]?.html).toContain('<p>Hello</p>');
    });

    it('parses multiple sections', () => {
      const html = `
        <section><p>Slide 1</p></section>
        <section><p>Slide 2</p></section>
        <section><p>Slide 3</p></section>
      `;
      expect(parseHtmlSlides(html)).toHaveLength(3);
    });

    it('handles sections with attributes on the opening tag', () => {
      const html = '<section class="dark" data-id="foo"><p>Content</p></section>';
      const slides = parseHtmlSlides(html);
      expect(slides).toHaveLength(1);
      expect(slides[0]?.html).toContain('<p>Content</p>');
    });
  });

  describe('IDs', () => {
    it('assigns sequential ids with default "pptx-slide" prefix', () => {
      const html = '<section>A</section><section>B</section>';
      const slides = parseHtmlSlides(html);
      expect(slides[0]?.id).toBe('pptx-slide-1');
      expect(slides[1]?.id).toBe('pptx-slide-2');
    });

    it('uses custom idPrefix when provided', () => {
      const html = '<section>A</section><section>B</section>';
      const slides = parseHtmlSlides(html, { idPrefix: 'deck' });
      expect(slides[0]?.id).toBe('deck-1');
      expect(slides[1]?.id).toBe('deck-2');
    });
  });

  describe('background color extraction', () => {
    it('extracts solid background-color from section style into backgroundColor', () => {
      const html = '<section style="background-color:#1B2A4A; width:960px;">Content</section>';
      expect(parseHtmlSlides(html)[0]?.backgroundColor).toBe('#1B2A4A');
      expect(parseHtmlSlides(html)[0]?.backgroundCss).toBeUndefined();
    });

    it('extracts background-color with spaces around value', () => {
      const html = '<section style="background-color: #fff;">Content</section>';
      expect(parseHtmlSlides(html)[0]?.backgroundColor).toBe('#fff');
    });

    it('returns undefined backgroundColor when no background-color in style', () => {
      const html = '<section style="width:960px;">Content</section>';
      expect(parseHtmlSlides(html)[0]?.backgroundColor).toBeUndefined();
    });

    it('returns undefined backgroundColor when section has no style attribute', () => {
      const html = '<section><p>No style</p></section>';
      expect(parseHtmlSlides(html)[0]?.backgroundColor).toBeUndefined();
    });

    it('extracts gradient background into backgroundCss, not backgroundColor', () => {
      const html = '<section style="background: linear-gradient(90deg, #000, #fff);">Content</section>';
      const slide = parseHtmlSlides(html)[0];
      expect(slide?.backgroundColor).toBeUndefined();
      expect(slide?.backgroundCss).toContain('linear-gradient');
    });

    it('extracts image background into backgroundCss', () => {
      const html = '<section style="background: url(data:image/png;base64,abc);">Content</section>';
      const slide = parseHtmlSlides(html)[0];
      expect(slide?.backgroundColor).toBeUndefined();
      expect(slide?.backgroundCss).toContain('url(');
    });

    it('extracts solid background shorthand into backgroundColor', () => {
      const html = '<section style="background: #3344aa;">Content</section>';
      const slide = parseHtmlSlides(html)[0];
      expect(slide?.backgroundColor).toBe('#3344aa');
      expect(slide?.backgroundCss).toBeUndefined();
    });
  });

  describe('slide data shape', () => {
    it('sets classes to empty array', () => {
      expect(parseHtmlSlides('<section>A</section>')[0]?.classes).toEqual([]);
    });

    it('sets partialCount to 0', () => {
      expect(parseHtmlSlides('<section>A</section>')[0]?.partialCount).toBe(0);
    });

    it('leaves rawCss, backgroundImage, detailsHtml undefined', () => {
      const slide = parseHtmlSlides('<section>A</section>')[0];
      expect(slide?.rawCss).toBeUndefined();
      expect(slide?.backgroundImage).toBeUndefined();
      expect(slide?.detailsHtml).toBeUndefined();
    });

    it('leaves notesHtml undefined when no aside present', () => {
      const slide = parseHtmlSlides('<section><p>Content</p></section>')[0];
      expect(slide?.notesHtml).toBeUndefined();
    });
  });

  describe('speaker notes extraction', () => {
    it('extracts notesHtml from gs-notes aside', () => {
      const html = '<section><p>Slide</p><aside class="gs-notes"><p>Speak here</p></aside></section>';
      const slide = parseHtmlSlides(html)[0];
      expect(slide?.notesHtml).toBe('<p>Speak here</p>');
    });

    it('removes the aside from slide html', () => {
      const html = '<section><p>Slide</p><aside class="gs-notes"><p>Notes</p></aside></section>';
      const slide = parseHtmlSlides(html)[0];
      expect(slide?.html).not.toContain('gs-notes');
      expect(slide?.html).not.toContain('<aside');
      expect(slide?.html).toContain('<p>Slide</p>');
    });

    it('handles notes with bold and italic formatting', () => {
      const html = '<section>Content<aside class="gs-notes"><p>Say <strong>this</strong> and <em>that</em></p></aside></section>';
      const slide = parseHtmlSlides(html)[0];
      expect(slide?.notesHtml).toContain('<strong>this</strong>');
      expect(slide?.notesHtml).toContain('<em>that</em>');
    });

    it('handles multi-paragraph notes', () => {
      const notes = '<p>First paragraph</p>\n<p>Second paragraph</p>';
      const html = `<section>Content<aside class="gs-notes">${notes}</aside></section>`;
      const slide = parseHtmlSlides(html)[0];
      expect(slide?.notesHtml).toContain('<p>First paragraph</p>');
      expect(slide?.notesHtml).toContain('<p>Second paragraph</p>');
    });

    it('leaves notesHtml undefined on slides without aside', () => {
      const html = `
        <section>Slide 1<aside class="gs-notes"><p>Notes 1</p></aside></section>
        <section>Slide 2</section>
        <section>Slide 3<aside class="gs-notes"><p>Notes 3</p></aside></section>
      `;
      const slides = parseHtmlSlides(html);
      expect(slides[0]?.notesHtml).toBe('<p>Notes 1</p>');
      expect(slides[1]?.notesHtml).toBeUndefined();
      expect(slides[2]?.notesHtml).toBe('<p>Notes 3</p>');
    });
  });

  describe('content fidelity', () => {
    it('preserves complex nested HTML inside the section', () => {
      const inner = '<div style="position:absolute; top:0;"><svg><rect/></svg></div>';
      const html = `<section>${inner}</section>`;
      expect(parseHtmlSlides(html)[0]?.html).toContain(inner);
    });

    it('correctly separates content of adjacent sections', () => {
      const html = '<section>First content</section><section>Second content</section>';
      const slides = parseHtmlSlides(html);
      expect(slides[0]?.html).toContain('First content');
      expect(slides[1]?.html).toContain('Second content');
    });
  });
});

describe('extractHtmlSlideDimensions', () => {
  it('returns undefined for empty string', () => {
    expect(extractHtmlSlideDimensions('')).toBeUndefined();
  });

  it('extracts width and height from the first section style', () => {
    const html = '<section style="width:960px; height:540px;"><p>Slide</p></section>';
    expect(extractHtmlSlideDimensions(html)).toEqual({ width: 960, height: 540 });
  });

  it('returns undefined when width or height is missing', () => {
    const html = '<section style="width:960px;"><p>Slide</p></section>';
    expect(extractHtmlSlideDimensions(html)).toBeUndefined();
  });

  it('reads from the first section only', () => {
    const html = `
      <section style="width:960px; height:540px;">A</section>
      <section style="width:1280px; height:720px;">B</section>
    `;
    expect(extractHtmlSlideDimensions(html)).toEqual({ width: 960, height: 540 });
  });
});

