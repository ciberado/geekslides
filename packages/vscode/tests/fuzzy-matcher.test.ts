import { describe, expect, it } from 'vitest';
import { fuzzyMatchClass, fuzzyMatchAll } from '../src/preview/fuzzy-matcher.ts';

describe('fuzzyMatchClass', () => {
  const classes = [
    'layout-title',
    'layout-two-col',
    'layout-three-col',
    'layout-cover',
    'layout-section',
    'mod-coverbg',
    'mod-heading-center',
    'mod-partial',
  ];

  it('returns undefined for empty input', () => {
    expect(fuzzyMatchClass('', classes)).toBeUndefined();
  });

  it('returns exact match', () => {
    expect(fuzzyMatchClass('layout-title', classes)).toBe('layout-title');
  });

  it('returns best prefix match', () => {
    expect(fuzzyMatchClass('layout-ti', classes)).toBe('layout-title');
    expect(fuzzyMatchClass('layout-t', classes)).toBe('layout-three-col'); // alphabetically first among 'two' and 'three'
  });

  it('returns best substring match', () => {
    // 'cover' matches earlier in 'mod-coverbg' (index 4) than 'layout-cover' (index 7)
    expect(fuzzyMatchClass('cover', classes)).toBe('mod-coverbg');
    expect(fuzzyMatchClass('coverbg', classes)).toBe('mod-coverbg');
    expect(fuzzyMatchClass('layout-c', classes)).toBe('layout-cover'); // Prefix match
  });

  it('handles case insensitive matching', () => {
    expect(fuzzyMatchClass('LAYOUT-TITLE', classes)).toBe('layout-title');
    expect(fuzzyMatchClass('Layout-Title', classes)).toBe('layout-title');
  });

  it('returns undefined for no good matches', () => {
    expect(fuzzyMatchClass('xyz', classes)).toBeUndefined();
    expect(fuzzyMatchClass('qwerty', classes)).toBeUndefined();
  });

  it('handles ambiguous prefix with alphabetical tie-breaking', () => {
    // "layout-t" matches both "layout-title", "layout-two-col", "layout-three-col"
    // All have same prefix score, so alphabetically first wins
    const result = fuzzyMatchClass('layout-t', classes);
    expect(['layout-three-col', 'layout-title', 'layout-two-col']).toContain(result);
  });

  it('prefers longer common prefix', () => {
    expect(fuzzyMatchClass('layout-tw', classes)).toBe('layout-two-col');
    expect(fuzzyMatchClass('layout-th', classes)).toBe('layout-three-col');
  });

  it('handles modifier class matching', () => {
    expect(fuzzyMatchClass('mod-c', classes)).toBe('mod-coverbg');
    expect(fuzzyMatchClass('mod-h', classes)).toBe('mod-heading-center');
    expect(fuzzyMatchClass('mod-p', classes)).toBe('mod-partial');
  });
});

describe('fuzzyMatchAll', () => {
  const classes = [
    'layout-title',
    'layout-two-col',
    'layout-three-col',
    'layout-cover',
  ];

  it('returns empty array for empty input', () => {
    expect(fuzzyMatchAll('', classes)).toEqual([]);
  });

  it('returns all matches sorted by score', () => {
    const results = fuzzyMatchAll('layout-t', classes);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]!.match).toBe('layout-three-col'); // Assuming alphabetical tie-breaking
    expect(results.every((r) => r.score >= 50)).toBe(true);
  });

  it('respects threshold parameter', () => {
    const results = fuzzyMatchAll('cover', classes, 80);
    expect(results.every((r) => r.score >= 80)).toBe(true);
  });

  it('returns results sorted by score descending', () => {
    const results = fuzzyMatchAll('layout', classes);
    for (let i = 0; i < results.length - 1; i++) {
      expect(results[i]!.score).toBeGreaterThanOrEqual(results[i + 1]!.score);
    }
  });
});
