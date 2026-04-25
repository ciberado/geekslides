import { describe, it, expect } from 'vitest';
import { fuzzyMatch } from '../../src/client/utils/fuzzy.ts';

describe('fuzzyMatch', () => {
  it('returns true for an exact match', () => {
    expect(fuzzyMatch('Hello World', 'hello world')).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(fuzzyMatch('AWS Talk', 'aws')).toBe(true);
    expect(fuzzyMatch('aws talk', 'AWS')).toBe(true);
  });

  it('matches when all query characters appear in order', () => {
    expect(fuzzyMatch('Kubernetes Deep Dive', 'kdd')).toBe(true);
    expect(fuzzyMatch('Docker Compose Tips', 'dct')).toBe(true);
  });

  it('returns false when a character is missing', () => {
    expect(fuzzyMatch('AWS Talk', 'xyz')).toBe(false);
    expect(fuzzyMatch('Hello', 'hx')).toBe(false);
  });

  it('returns false when characters are out of order', () => {
    // 'ba' requires 'b' before 'a', but in 'abc' 'b' comes after 'a'
    expect(fuzzyMatch('abc', 'ca')).toBe(false);
  });

  it('returns true for an empty query (matches everything)', () => {
    expect(fuzzyMatch('anything', '')).toBe(true);
    expect(fuzzyMatch('', '')).toBe(true);
  });

  it('returns false when query is longer than text', () => {
    expect(fuzzyMatch('ab', 'abc')).toBe(false);
  });

  it('handles repeated characters correctly', () => {
    // 'oo' requires two 'o' characters
    expect(fuzzyMatch('foobar', 'oo')).toBe(true);
    expect(fuzzyMatch('fobar', 'oo')).toBe(false);
  });

  it('matches partial title fragments', () => {
    // Typical use: user types a few letters of a presentation title
    expect(fuzzyMatch('Introduction to TypeScript', 'its')).toBe(true);
    expect(fuzzyMatch('Introduction to TypeScript', 'tts')).toBe(true);
    expect(fuzzyMatch('Introduction to TypeScript', 'xyz')).toBe(false);
  });

  it('handles unicode characters', () => {
    expect(fuzzyMatch('Résumé Talk', 'rsm')).toBe(true);
  });
});
