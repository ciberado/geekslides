import { describe, expect, it } from 'vitest';
import { scanSlideIds, isValidKebabCase } from '../src/completion/slide-id-helper.ts';

describe('scanSlideIds', () => {
  it('extracts IDs from slide markers', () => {
    const md = `[](.layout-title#title)

## Content

[](.layout-two-col#comparison)

## More

[](#closing)
`;
    const result = scanSlideIds(md);
    expect(result.ids).toEqual(['title', 'comparison', 'closing']);
    expect(result.duplicates.size).toBe(0);
  });

  it('detects duplicate IDs', () => {
    const md = `[](.layout-title#hero)

## First

[](.layout-section#hero)

## Second
`;
    const result = scanSlideIds(md);
    expect(result.duplicates.has('hero')).toBe(true);
  });

  it('handles no markers', () => {
    const result = scanSlideIds('# Hello\n\nJust text.');
    expect(result.ids).toHaveLength(0);
  });

  it('handles markers with bgurl after ID', () => {
    const md = '[](.layout-cover#vision,bgurl(hero.jpg))';
    const result = scanSlideIds(md);
    expect(result.ids).toEqual(['vision']);
  });
});

describe('isValidKebabCase', () => {
  it('accepts valid kebab-case', () => {
    expect(isValidKebabCase('my-slide')).toBe(true);
    expect(isValidKebabCase('hero')).toBe(true);
    expect(isValidKebabCase('section-2-intro')).toBe(true);
  });

  it('rejects invalid kebab-case', () => {
    expect(isValidKebabCase('MySlide')).toBe(false);
    expect(isValidKebabCase('my_slide')).toBe(false);
    expect(isValidKebabCase('-start')).toBe(false);
    expect(isValidKebabCase('')).toBe(false);
  });
});
