import { describe, it, expect } from 'vitest';
import { renderPrint } from '../../src/print/PrintRenderer.ts';
import { DEFAULT_CONFIG } from '../../src/core/Config.ts';
import type { SlideData } from '../../src/core/SlideParser.ts';

const TEST_SLIDES: SlideData[] = [
  {
    id: 'intro',
    html: '<h2>Introduction</h2><p>Welcome</p>',
    notesHtml: '<p>Start with greeting</p>',
    detailsHtml: '<p>This talk covers the fundamentals of the topic.</p>',
    rawCss: '.intro { color: blue; }',
    classes: ['intro'],
    backgroundImage: 'images/intro.png',
    backgroundColor: '#ffffff',
    partialCount: 0,
  },
  {
    id: '',
    html: '<h2>Details</h2><ul><li>Item 1</li></ul>',
    notesHtml: undefined,
    detailsHtml: undefined,
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
    detailsHtml: '<p>Chapter 2 provides advanced material.</p>',
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

    it('preserves slide classes and background metadata', () => {
      const html = renderPrint(TEST_SLIDES, 'slides', DEFAULT_CONFIG);
      expect(html).toContain('class="gs-slide content intro"');
      expect(html).toContain('data-id="intro"');
      expect(html).toContain('data-background-image="images/intro.png"');
      expect(html).toContain('data-background-color="#ffffff"');
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

  describe('slides-details template', () => {
    it('wraps each slide in a gs-details-page container', () => {
      const html = renderPrint(TEST_SLIDES, 'slides-details', DEFAULT_CONFIG);
      const pages = html.match(/class="gs-details-page/g);
      expect(pages).toHaveLength(3);
    });

    it('marks slides with details as gs-has-details', () => {
      const html = renderPrint(TEST_SLIDES, 'slides-details', DEFAULT_CONFIG);
      const body = html.slice(html.indexOf('<body>'));
      const hasDetails = body.match(/class="gs-details-page gs-has-details/g);
      expect(hasDetails).toHaveLength(2); // intro and ch2 have detailsHtml
    });

    it('marks slides without details as gs-no-details', () => {
      const html = renderPrint(TEST_SLIDES, 'slides-details', DEFAULT_CONFIG);
      const body = html.slice(html.indexOf('<body>'));
      const noDetails = body.match(/class="gs-details-page gs-no-details/g);
      expect(noDetails).toHaveLength(1); // the middle slide
    });

    it('includes detail content for slides that have it', () => {
      const html = renderPrint(TEST_SLIDES, 'slides-details', DEFAULT_CONFIG);
      expect(html).toContain('This talk covers the fundamentals');
      expect(html).toContain('Chapter 2 provides advanced material');
    });

    it('does not include detail pane for slides without details', () => {
      const html = renderPrint(TEST_SLIDES, 'slides-details', DEFAULT_CONFIG);
      const body = html.slice(html.indexOf('<body>'));
      const pages = body.split(/(?=<div class="gs-details-page)/).filter((p) => p.includes('gs-details-page'));
      const noDetailsPages = pages.filter((p) => p.includes('gs-no-details'));
      expect(noDetailsPages).toHaveLength(1);
      expect(noDetailsPages[0]).not.toContain('gs-details-content');
    });

    it('defaults to horizontal layout', () => {
      const html = renderPrint(TEST_SLIDES, 'slides-details', DEFAULT_CONFIG);
      const pages = html.match(/class="gs-details-page [^"]+"/g) ?? [];
      expect(pages.every((p) => p.includes('gs-layout-horizontal'))).toBe(true);
      expect(pages.every((p) => !p.includes('gs-layout-vertical'))).toBe(true);
    });

    it('respects vertical layout option', () => {
      const html = renderPrint(TEST_SLIDES, 'slides-details', DEFAULT_CONFIG, { detailsLayout: 'vertical' });
      const pages = html.match(/class="gs-details-page [^"]+"/g) ?? [];
      expect(pages.every((p) => p.includes('gs-layout-vertical'))).toBe(true);
      expect(pages.every((p) => !p.includes('gs-layout-horizontal'))).toBe(true);
    });

    it('includes details-specific CSS', () => {
      const html = renderPrint(TEST_SLIDES, 'slides-details', DEFAULT_CONFIG);
      expect(html).toContain('.gs-details-page');
      expect(html).toContain('.gs-details-slide');
      expect(html).toContain('.gs-details-content');
    });
  });

  describe('common requirements', () => {
    it('contains no custom elements', () => {
      for (const template of ['slides', 'slides-notes', 'slides-details', 'book'] as const) {
        const html = renderPrint(TEST_SLIDES, template, DEFAULT_CONFIG);
        expect(html).not.toMatch(/<geek-/);
      }
    });

    it('contains no <script> tags', () => {
      for (const template of ['slides', 'slides-notes', 'slides-details', 'book'] as const) {
        const html = renderPrint(TEST_SLIDES, template, DEFAULT_CONFIG);
        expect(html).not.toContain('<script');
      }
    });

    it('substitutes all template placeholders', () => {
      for (const template of ['slides', 'slides-notes', 'slides-details', 'book'] as const) {
        const html = renderPrint(TEST_SLIDES, template, DEFAULT_CONFIG);
        expect(html).not.toContain('{{title}}');
        expect(html).not.toContain('{{slides}}');
        expect(html).not.toContain('{{styles}}');
      }
    });

    it('includes global print CSS', () => {
      const html = renderPrint(TEST_SLIDES, 'slides', DEFAULT_CONFIG);
      expect(html).toContain('@page');
      expect(html).toContain('254mm 143mm');
    });

    it('includes page numbers for slides-notes template', () => {
      const html = renderPrint(TEST_SLIDES, 'slides-notes', DEFAULT_CONFIG);
      expect(html).toContain('@bottom-center');
    });

    it('includes extra CSS when provided', () => {
      const html = renderPrint(TEST_SLIDES, 'slides', DEFAULT_CONFIG, {
        extraCss: '.custom { color: red; }',
      });
      expect(html).toContain('.custom { color: red; }');
    });

    it('places extra CSS imports before base print rules', () => {
      const html = renderPrint(TEST_SLIDES, 'slides', DEFAULT_CONFIG, {
        extraCss: '@import url("https://fonts.example.com/css2?family=Open+Sans:ital,wght@0,300..800;1,300..800");\n.custom { color: red; }',
      });

      expect(html).toContain('@import url("https://fonts.example.com/css2?family=Open+Sans:ital,wght@0,300..800;1,300..800");');
      expect(html.indexOf('@import url("https://fonts.example.com/css2?family=Open+Sans:ital,wght@0,300..800;1,300..800");'))
        .toBeLessThan(html.indexOf('@page'));
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
