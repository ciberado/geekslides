import { describe, it, expect } from 'vitest';
import { renderPrint } from '../../src/print/PrintRenderer.ts';
import { DEFAULT_CONFIG } from '../../src/core/Config.ts';
import type { SlideData } from '../../src/core/SlideParser.ts';

const TEST_SLIDES: SlideData[] = [
  {
    id: 'intro',
    html: '<h2>Introduction</h2><p>Welcome</p>',
    notesHtml: '<p>Start with greeting</p>',
    rawCss: '.intro { color: blue; }',
    classes: ['intro'],
    backgroundImage: undefined,
    backgroundColor: undefined,
    partialCount: 0,
  },
  {
    id: '',
    html: '<h2>Details</h2><ul><li>Item 1</li></ul>',
    notesHtml: undefined,
    rawCss: undefined,
    classes: [],
    backgroundImage: undefined,
    backgroundColor: undefined,
    partialCount: 2,
  },
  {
    id: 'ch2',
    html: '<h1>Chapter 2</h1><p>New chapter</p>',
    notesHtml: '<p>Transition slowly</p>',
    rawCss: '.ch2 { font-size: 2rem; }',
    classes: [],
    backgroundImage: undefined,
    backgroundColor: undefined,
    partialCount: 0,
  },
];

describe('PrintRenderer', () => {
  describe('slides template', () => {
    it('produces correct number of <section> elements', () => {
      const html = renderPrint(TEST_SLIDES, 'slides', DEFAULT_CONFIG);
      const sections = html.match(/<section /g);
      expect(sections).toHaveLength(3);
    });

    it('does not include speaker notes content', () => {
      const html = renderPrint(TEST_SLIDES, 'slides', DEFAULT_CONFIG);
      expect(html).not.toContain('<aside class="gs-notes">');
      expect(html).not.toContain('Start with greeting');
    });

    it('includes scoped CSS', () => {
      const html = renderPrint(TEST_SLIDES, 'slides', DEFAULT_CONFIG);
      expect(html).toContain('.intro { color: blue; }');
    });
  });

  describe('slides-notes template', () => {
    it('includes <aside class="gs-notes"> for slides with notes', () => {
      const html = renderPrint(TEST_SLIDES, 'slides-notes', DEFAULT_CONFIG);
      expect(html).toContain('<aside class="gs-notes">');
      expect(html).toContain('Start with greeting');
    });

    it('omits notes aside for slides without notes', () => {
      const html = renderPrint(TEST_SLIDES, 'slides-notes', DEFAULT_CONFIG);
      const wrappers = html.match(/<div class="gs-slide-with-notes">/g);
      expect(wrappers).toHaveLength(3); // 3 wrappers
      const asides = html.match(/<aside class="gs-notes">/g);
      expect(asides).toHaveLength(2); // only 2 have notes
    });
  });

  describe('book template', () => {
    it('produces flowing layout with notes as div paragraphs', () => {
      const html = renderPrint(TEST_SLIDES, 'book', DEFAULT_CONFIG);
      expect(html).toContain('gs-book-notes');
      expect(html).toContain('gs-book-slide');
      expect(html).toContain('Transition slowly');
    });

    it('adds chapter class for <h1> slides', () => {
      const html = renderPrint(TEST_SLIDES, 'book', DEFAULT_CONFIG);
      expect(html).toContain('gs-book-chapter');
    });
  });

  describe('common requirements', () => {
    it('contains no custom elements', () => {
      for (const template of ['slides', 'slides-notes', 'book'] as const) {
        const html = renderPrint(TEST_SLIDES, template, DEFAULT_CONFIG);
        expect(html).not.toMatch(/<geek-/);
      }
    });

    it('contains no <script> tags', () => {
      for (const template of ['slides', 'slides-notes', 'book'] as const) {
        const html = renderPrint(TEST_SLIDES, template, DEFAULT_CONFIG);
        expect(html).not.toContain('<script');
      }
    });

    it('substitutes all template placeholders', () => {
      for (const template of ['slides', 'slides-notes', 'book'] as const) {
        const html = renderPrint(TEST_SLIDES, template, DEFAULT_CONFIG);
        expect(html).not.toContain('{{title}}');
        expect(html).not.toContain('{{slides}}');
        expect(html).not.toContain('{{styles}}');
      }
    });

    it('includes global print CSS', () => {
      const html = renderPrint(TEST_SLIDES, 'slides', DEFAULT_CONFIG);
      expect(html).toContain('@page');
      expect(html).toContain('page-break-after');
    });

    it('includes extra CSS when provided', () => {
      const html = renderPrint(TEST_SLIDES, 'slides', DEFAULT_CONFIG, {
        extraCss: '.custom { color: red; }',
      });
      expect(html).toContain('.custom { color: red; }');
    });

    it('sets document title from config', () => {
      const html = renderPrint(TEST_SLIDES, 'slides', DEFAULT_CONFIG);
      expect(html).toContain('<title>Untitled Presentation</title>');
    });

    it('includes slide id attributes', () => {
      const html = renderPrint(TEST_SLIDES, 'slides', DEFAULT_CONFIG);
      expect(html).toContain('id="intro"');
    });

    it('produces valid HTML document structure', () => {
      const html = renderPrint(TEST_SLIDES, 'slides', DEFAULT_CONFIG);
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html');
      expect(html).toContain('</html>');
    });
  });
});
