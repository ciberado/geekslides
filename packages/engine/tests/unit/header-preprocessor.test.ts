import { describe, it, expect } from 'vitest';
import { headerPreprocessor } from '../../src/plugins/builtins/header-preprocessor.ts';
import { DEFAULT_CONFIG } from '../../src/core/Config.ts';

describe('header-preprocessor', () => {
  it('inserts separator above ## headings', () => {
    const md = '## My Title\n\nSome content';
    const result = headerPreprocessor(md, DEFAULT_CONFIG);
    const lines = result.split('\n');

    expect(lines[0]).toBe('[](.slide#my-title)');
    expect(lines[1]).toBe('');
    expect(lines[2]).toBe('## My Title');
  });

  it('handles multiple ## headings', () => {
    const md = '## First\n\nContent\n\n## Second\n\nMore content';
    const result = headerPreprocessor(md, DEFAULT_CONFIG);

    expect(result).toContain('[](.slide#first)');
    expect(result).toContain('[](.slide#second)');
  });

  it('does not affect # (h1) or ### (h3) headings', () => {
    const md = '# H1 Title\n\n### H3 Title';
    const result = headerPreprocessor(md, DEFAULT_CONFIG);

    expect(result).not.toContain('[](.slide');
    expect(result).toBe(md);
  });

  it('generates clean anchors from special characters', () => {
    const md = '## Hello, World! (2024)';
    const result = headerPreprocessor(md, DEFAULT_CONFIG);

    expect(result).toContain('[](.slide#hello-world-2024)');
  });

  it('handles empty heading', () => {
    const md = '## ';
    const result = headerPreprocessor(md, DEFAULT_CONFIG);

    expect(result).toContain('[](.slide#)');
  });
});
