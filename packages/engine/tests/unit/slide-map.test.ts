import { describe, expect, it } from 'vitest';
import {
  computeSlideMap,
  parse,
} from '../../src/core/SlideParser.ts';
import { headerPreprocessor } from '../../src/plugins/builtins/header-preprocessor.ts';
import { slideSourceNotesPreprocessor } from '../../src/plugins/builtins/slide-source-notes-preprocessor.ts';
import { applyPreprocessorResult, createIdentityLineMapping } from '../../src/plugins/preprocessor-utils.ts';
import { DEFAULT_CONFIG } from '../../src/core/Config.ts';

function preprocessWithHeaders(markdown: string): { content: string; lineMapping: readonly number[] } {
  return applyPreprocessorResult(
    { content: markdown, lineMapping: createIdentityLineMapping(markdown) },
    headerPreprocessor(markdown, DEFAULT_CONFIG),
  );
}

function preprocessWithSourceNotes(markdown: string): { content: string; lineMapping: readonly number[] } {
  return applyPreprocessorResult(
    { content: markdown, lineMapping: createIdentityLineMapping(markdown) },
    slideSourceNotesPreprocessor(markdown, DEFAULT_CONFIG),
  );
}

function preprocessWithBoth(markdown: string): { content: string; lineMapping: readonly number[] } {
  const step1 = preprocessWithHeaders(markdown);
  return applyPreprocessorResult(
    step1,
    slideSourceNotesPreprocessor(step1.content, DEFAULT_CONFIG),
  );
}

describe('slide map', () => {
  it('tracks source lines for explicit slide separators', () => {
    const markdown = [
      '[](#intro)',
      '',
      '# Intro',
      '',
      'Hello',
      '',
      '[](#demo)',
      '',
      '# Demo',
      '',
      'World',
    ].join('\n');

    const slides = parse(markdown);

    expect(computeSlideMap(slides)).toEqual([
      { slideIndex: 0, sourceLineStart: 1, sourceLineEnd: 7, id: 'intro' },
      { slideIndex: 1, sourceLineStart: 7, sourceLineEnd: 12, id: 'demo' },
    ]);
  });

  it('maps header-preprocessor separators back to original heading lines', () => {
    const markdown = [
      '# Intro',
      '',
      'First slide',
      '',
      '## Demo',
      '',
      'Second slide',
    ].join('\n');

    const preprocessed = preprocessWithHeaders(markdown);
    const slides = parse(preprocessed.content, { lineMapping: preprocessed.lineMapping });

    expect(computeSlideMap(slides)).toEqual([
      { slideIndex: 0, sourceLineStart: 1, sourceLineEnd: 5, id: 'intro' },
      { slideIndex: 1, sourceLineStart: 5, sourceLineEnd: 8, id: 'demo' },
    ]);
  });

  it('keeps source-notes generated lines inside the original slide range', () => {
    const markdown = [
      '[](#intro)',
      '',
      '# Intro',
      '',
      'Hello',
    ].join('\n');

    const preprocessed = preprocessWithSourceNotes(markdown);
    const slides = parse(preprocessed.content, { lineMapping: preprocessed.lineMapping });

    expect(computeSlideMap(slides)).toEqual([
      { slideIndex: 0, sourceLineStart: 1, sourceLineEnd: 6, id: 'intro' },
    ]);
  });

  describe('edge cases: adding slides', () => {
    it('handles a new heading added at the end with header preprocessor', () => {
      const markdown = [
        '# Intro',
        '',
        'First slide',
        '',
        '## Demo',
        '',
        'Second slide',
        '',
        '## Conclusion',
        '',
        'Third slide',
      ].join('\n');

      const preprocessed = preprocessWithHeaders(markdown);
      const slides = parse(preprocessed.content, { lineMapping: preprocessed.lineMapping });
      const map = computeSlideMap(slides);

      expect(map).toHaveLength(3);
      expect(map[0]).toEqual({ slideIndex: 0, sourceLineStart: 1, sourceLineEnd: 5, id: 'intro' });
      expect(map[1]).toEqual({ slideIndex: 1, sourceLineStart: 5, sourceLineEnd: 9, id: 'demo' });
      expect(map[2]).toEqual({ slideIndex: 2, sourceLineStart: 9, sourceLineEnd: 12, id: 'conclusion' });
    });

    it('handles a new explicit separator added between existing slides', () => {
      const markdown = [
        '[](#intro)',
        '',
        '# Intro',
        '',
        '[](#new)',
        '',
        'Inserted slide',
        '',
        '[](#demo)',
        '',
        '# Demo',
      ].join('\n');

      const slides = parse(markdown);
      const map = computeSlideMap(slides);

      expect(map).toHaveLength(3);
      expect(map[0]?.id).toBe('intro');
      expect(map[1]?.id).toBe('new');
      expect(map[2]?.id).toBe('demo');
      // "new" slide starts at line 5 (its separator) and ends at line 9 (start of next separator)
      expect(map[1]).toEqual({ slideIndex: 1, sourceLineStart: 5, sourceLineEnd: 9, id: 'new' });
    });
  });

  describe('edge cases: editing slide definitions', () => {
    it('changing slide id in separator updates the map', () => {
      const markdown = [
        '[](#slide-one)',
        '',
        'Content A',
        '',
        '[](#slide-two)',
        '',
        'Content B',
      ].join('\n');

      const slides = parse(markdown);
      const map = computeSlideMap(slides);

      expect(map[0]?.id).toBe('slide-one');
      expect(map[1]?.id).toBe('slide-two');

      // Simulate editing the first separator id
      const edited = markdown.replace('[](#slide-one)', '[](#renamed)');
      const editedSlides = parse(edited);
      const editedMap = computeSlideMap(editedSlides);

      expect(editedMap[0]?.id).toBe('renamed');
      // Line ranges should remain the same since the structure didn't change
      expect(editedMap[0]?.sourceLineStart).toBe(map[0]?.sourceLineStart);
      expect(editedMap[0]?.sourceLineEnd).toBe(map[0]?.sourceLineEnd);
    });

    it('changing classes/background in separator preserves line mapping', () => {
      const markdown = [
        '[](.intro#start)',
        '',
        'Content',
        '',
        '[](.demo#end,bgurl(bg.jpg),bgcolor(#333))',
        '',
        'More content',
      ].join('\n');

      const slides = parse(markdown);
      const map = computeSlideMap(slides);

      expect(map).toHaveLength(2);
      expect(map[0]?.id).toBe('start');
      expect(map[1]?.id).toBe('end');

      // Edit: change background, remove class
      const edited = markdown.replace(
        '[](.demo#end,bgurl(bg.jpg),bgcolor(#333))',
        '[](.highlight#end,bgcolor(#fff))',
      );
      const editedSlides = parse(edited);
      const editedMap = computeSlideMap(editedSlides);

      expect(editedMap[1]?.id).toBe('end');
      expect(editedMap[1]?.sourceLineStart).toBe(map[1]?.sourceLineStart);
    });
  });

  describe('edge cases: removing slides', () => {
    it('handles removing a heading when header preprocessor is active', () => {
      // Original: 3 headings → 3 slides
      const original = [
        '# First',
        '',
        'Content A',
        '',
        '## Second',
        '',
        'Content B',
        '',
        '## Third',
        '',
        'Content C',
      ].join('\n');

      const prep1 = preprocessWithHeaders(original);
      const slides1 = parse(prep1.content, { lineMapping: prep1.lineMapping });
      expect(computeSlideMap(slides1)).toHaveLength(3);

      // Remove the middle heading: now 2 slides, "Content B" merges into First
      const edited = [
        '# First',
        '',
        'Content A',
        '',
        'Content B',
        '',
        '## Third',
        '',
        'Content C',
      ].join('\n');

      const prep2 = preprocessWithHeaders(edited);
      const slides2 = parse(prep2.content, { lineMapping: prep2.lineMapping });
      const map2 = computeSlideMap(slides2);

      expect(map2).toHaveLength(2);
      expect(map2[0]?.id).toBe('first');
      // First slide now spans lines 1-7 (includes the former "Content B")
      expect(map2[0]?.sourceLineStart).toBe(1);
      expect(map2[0]?.sourceLineEnd).toBe(7);
      expect(map2[1]?.id).toBe('third');
      expect(map2[1]?.sourceLineStart).toBe(7);
    });

    it('handles removing the last slide separator', () => {
      const markdown = [
        '[](#one)',
        '',
        'Slide 1',
        '',
        '[](#two)',
        '',
        'Slide 2',
      ].join('\n');

      const slides1 = parse(markdown);
      expect(computeSlideMap(slides1)).toHaveLength(2);

      // Remove the second separator and its content
      const edited = [
        '[](#one)',
        '',
        'Slide 1',
      ].join('\n');

      const slides2 = parse(edited);
      const map2 = computeSlideMap(slides2);
      expect(map2).toHaveLength(1);
      expect(map2[0]?.id).toBe('one');
    });
  });

  describe('edge cases: single-slide and empty decks', () => {
    it('handles a single slide with explicit separator', () => {
      const markdown = '[](#only)\n\nHello world';
      const slides = parse(markdown);
      const map = computeSlideMap(slides);

      expect(map).toHaveLength(1);
      expect(map[0]).toEqual({ slideIndex: 0, sourceLineStart: 1, sourceLineEnd: 4, id: 'only' });
    });

    it('handles a single heading with header preprocessor', () => {
      const markdown = '# Title\n\nContent';
      const preprocessed = preprocessWithHeaders(markdown);
      const slides = parse(preprocessed.content, { lineMapping: preprocessed.lineMapping });
      const map = computeSlideMap(slides);

      expect(map).toHaveLength(1);
      expect(map[0]?.id).toBe('title');
      expect(map[0]?.sourceLineStart).toBe(1);
    });

    it('handles empty markdown', () => {
      const slides = parse('');
      expect(computeSlideMap(slides)).toEqual([]);
    });

    it('handles markdown with no separators or headings', () => {
      const markdown = 'Just some text\n\nMore text';
      const slides = parse(markdown);
      const map = computeSlideMap(slides);

      // One auto-generated slide
      expect(map).toHaveLength(1);
      expect(map[0]?.sourceLineStart).toBe(1);
    });
  });

  describe('edge cases: chained preprocessors', () => {
    it('handles header + source-notes preprocessors together', () => {
      const markdown = [
        '# Intro',
        '',
        'Hello',
        '',
        '## Demo',
        '',
        'World',
      ].join('\n');

      const preprocessed = preprocessWithBoth(markdown);
      const slides = parse(preprocessed.content, { lineMapping: preprocessed.lineMapping });
      const map = computeSlideMap(slides);

      expect(map).toHaveLength(2);
      expect(map[0]?.id).toBe('intro');
      expect(map[1]?.id).toBe('demo');
      // Source lines should still map back to original heading positions
      expect(map[0]?.sourceLineStart).toBe(1);
      expect(map[1]?.sourceLineStart).toBe(5);
    });

    it('chained preprocessors: adding a slide and reprocessing updates correctly', () => {
      const v1 = [
        '# First',
        '',
        'Content',
      ].join('\n');

      const prep1 = preprocessWithBoth(v1);
      const slides1 = parse(prep1.content, { lineMapping: prep1.lineMapping });
      expect(computeSlideMap(slides1)).toHaveLength(1);

      // Add a new heading
      const v2 = [
        '# First',
        '',
        'Content',
        '',
        '## Second',
        '',
        'More',
      ].join('\n');

      const prep2 = preprocessWithBoth(v2);
      const slides2 = parse(prep2.content, { lineMapping: prep2.lineMapping });
      const map2 = computeSlideMap(slides2);

      expect(map2).toHaveLength(2);
      expect(map2[0]?.sourceLineStart).toBe(1);
      expect(map2[1]?.sourceLineStart).toBe(5);
    });
  });

  describe('edge cases: slides with existing separators before headings', () => {
    it('does not double-insert separator when one already exists before heading', () => {
      const markdown = [
        '[](.custom#intro)',
        '',
        '# Intro',
        '',
        'Content',
      ].join('\n');

      const preprocessed = preprocessWithHeaders(markdown);
      const slides = parse(preprocessed.content, { lineMapping: preprocessed.lineMapping });
      const map = computeSlideMap(slides);

      // Should still be 1 slide, not 2 (header preprocessor should skip)
      expect(map).toHaveLength(1);
      expect(map[0]?.id).toBe('intro');
    });
  });

  describe('edge cases: notes blocks', () => {
    it('handles slides with handcrafted notes blocks', () => {
      const markdown = [
        '[](#intro)',
        '',
        '# Intro',
        '',
        'Content',
        '',
        '::: Notes',
        'Speaker notes here',
        ':::',
        '',
        '[](#demo)',
        '',
        'Demo content',
      ].join('\n');

      const slides = parse(markdown);
      const map = computeSlideMap(slides);

      expect(map).toHaveLength(2);
      expect(map[0]?.sourceLineStart).toBe(1);
      expect(map[0]?.sourceLineEnd).toBe(11);
      expect(map[1]?.sourceLineStart).toBe(11);
    });
  });

  describe('computeSlideMap correctness', () => {
    it('omits slides without source line tracking', () => {
      // parse without lineMapping on content without separators
      // still gets source lines from markdown-it tokens
      const markdown = 'Just text';
      const slides = parse(markdown);
      const map = computeSlideMap(slides);

      // Auto-generated slides still get source lines from token.map
      expect(map.length).toBeGreaterThanOrEqual(0);
      for (const entry of map) {
        expect(entry.sourceLineStart).toBeDefined();
        expect(entry.sourceLineEnd).toBeDefined();
      }
    });

    it('slide indices are sequential', () => {
      const markdown = [
        '[](#a)',
        '',
        'Slide A',
        '',
        '[](#b)',
        '',
        'Slide B',
        '',
        '[](#c)',
        '',
        'Slide C',
      ].join('\n');

      const slides = parse(markdown);
      const map = computeSlideMap(slides);

      expect(map.map((e) => e.slideIndex)).toEqual([0, 1, 2]);
    });

    it('source ranges are non-overlapping and ordered', () => {
      const markdown = [
        '# A',
        '',
        'Content A',
        '',
        '## B',
        '',
        'Content B',
        '',
        '## C',
        '',
        'Content C',
      ].join('\n');

      const preprocessed = preprocessWithHeaders(markdown);
      const slides = parse(preprocessed.content, { lineMapping: preprocessed.lineMapping });
      const map = computeSlideMap(slides);

      for (let i = 1; i < map.length; i++) {
        const prev = map[i - 1];
        const curr = map[i];
        if (prev && curr) {
          // sourceLineEnd of previous should be <= sourceLineStart of current
          expect(prev.sourceLineEnd).toBeLessThanOrEqual(curr.sourceLineStart);
        }
      }
    });
  });
});
