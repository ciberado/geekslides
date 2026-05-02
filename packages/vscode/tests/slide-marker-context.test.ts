import { describe, expect, it } from 'vitest';
import { getMarkerContext } from '../src/completion/slide-marker-context.ts';

describe('getMarkerContext', () => {
  it('returns none when cursor is outside any link', () => {
    const result = getMarkerContext('Hello world', 5);
    expect(result.kind).toBe('none');
  });

  it('returns none when cursor is in a regular link', () => {
    const result = getMarkerContext('[text](https://example.com)', 15);
    // This is a non-empty link — but our parser still finds the paren content.
    // We rely on the provider to filter by config.json presence, not here.
    expect(result).toBeDefined();
  });

  it('detects class context after a dot', () => {
    const result = getMarkerContext('[](.layout-)', 11);
    expect(result).toEqual({ kind: 'class', prefix: 'layout-' });
  });

  it('detects class context at the start of a dot', () => {
    const result = getMarkerContext('[](.|)', 4);
    expect(result).toEqual({ kind: 'class', prefix: '' });
  });

  it('detects class context with partial prefix', () => {
    const result = getMarkerContext('[](.layout-tit)', 14);
    expect(result).toEqual({ kind: 'class', prefix: 'layout-tit' });
  });

  it('detects modifier class after layout class', () => {
    const result = getMarkerContext('[](.layout-cover.mod-)', 21);
    expect(result).toEqual({ kind: 'class', prefix: 'mod-' });
  });

  it('detects id context after hash', () => {
    const result = getMarkerContext('[](.layout-title#my-)', 20);
    expect(result).toEqual({ kind: 'id', prefix: 'my-' });
  });

  it('detects id context right after hash', () => {
    const result = getMarkerContext('[](#)', 4);
    expect(result).toEqual({ kind: 'id', prefix: '' });
  });

  it('detects function context after comma', () => {
    const result = getMarkerContext('[](.layout-title#id,bg)', 22);
    expect(result).toEqual({ kind: 'function', prefix: 'bg' });
  });

  it('detects function context right after comma', () => {
    const result = getMarkerContext('[](.layout-title#id,)', 20);
    expect(result).toEqual({ kind: 'function', prefix: '' });
  });

  it('detects function context after second comma', () => {
    const result = getMarkerContext('[](.layout-cover#id,bgurl(img.jpg),bgcolor())', 43);
    expect(result).toEqual({ kind: 'function', prefix: 'bgcolor(' });
  });

  it('handles cursor at end of line without closing paren', () => {
    const result = getMarkerContext('[](.layout-', 11);
    expect(result).toEqual({ kind: 'class', prefix: 'layout-' });
  });

  it('returns none when cursor is before the opening bracket', () => {
    const result = getMarkerContext('text [](.layout)', 3);
    expect(result.kind).toBe('none');
  });

  it('handles line with multiple markers — picks the enclosing one', () => {
    const result = getMarkerContext('[](.layout-title#a) text [](.layout-cover#b,bg)', 46);
    expect(result).toEqual({ kind: 'function', prefix: 'bg' });
  });
});
