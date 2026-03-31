import { describe, it, expect } from 'vitest';
import { scope } from '../../src/core/StyleScoper.ts';

describe('StyleScoper', () => {
  it('prefixes simple selectors', () => {
    const css = 'h2 { color: blue; }';
    const result = scope(css, 'slide-1');
    expect(result).toContain('geek-slide[data-id="slide-1"] h2');
  });

  it('prefixes compound selectors', () => {
    const css = '.box > .title { font-size: 2rem; }';
    const result = scope(css, 's2');
    expect(result).toContain('geek-slide[data-id="s2"] .box > .title');
  });

  it('does not double-prefix already-scoped selectors', () => {
    const css = 'geek-slide[data-id="s1"] h2 { color: red; }';
    const result = scope(css, 's1');
    // Should not have double prefix
    const count = (result.match(/geek-slide/g) ?? []).length;
    expect(count).toBe(1);
  });

  it('preserves @keyframes at-rules', () => {
    const css = '@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }';
    const result = scope(css, 's1');
    expect(result).toContain('@keyframes fadeIn');
  });

  it('preserves @media at-rules', () => {
    const css = '@media (max-width: 768px) { h2 { font-size: 1rem; } }';
    const result = scope(css, 's1');
    expect(result).toContain('@media');
  });

  it('prefixes comma-separated selectors independently', () => {
    const css = 'h1, h2, h3 { margin: 0; }';
    const result = scope(css, 's1');
    expect(result).toContain('geek-slide[data-id="s1"] h1');
    expect(result).toContain('geek-slide[data-id="s1"] h2');
    expect(result).toContain('geek-slide[data-id="s1"] h3');
  });

  it('skips :root selectors', () => {
    const css = ':root { --color: blue; }';
    const result = scope(css, 's1');
    expect(result).toContain(':root');
    expect(result).not.toContain('geek-slide[data-id="s1"] :root');
  });
});
