import { describe, it, expect } from 'vitest';
import { headerPreprocessor } from '../../src/plugins/builtins/header-preprocessor.ts';
import { DEFAULT_CONFIG } from '../../src/core/Config.ts';
import { normalizePreprocessorResult } from '../../src/plugins/preprocessor-utils.ts';

function preprocess(markdown: string): { content: string; lineMapping: readonly number[] } {
  return normalizePreprocessorResult(headerPreprocessor(markdown, DEFAULT_CONFIG));
}

describe('header-preprocessor', () => {
  it('inserts separator above ## headings', () => {
    const md = '## My Title\n\nSome content';
    const result = preprocess(md);
    const lines = result.content.split('\n');

    expect(lines[0]).toBe('[](.slide#my-title)');
    expect(lines[1]).toBe('');
    expect(lines[2]).toBe('## My Title');
    expect(result.lineMapping.slice(0, 3)).toEqual([1, 1, 1]);
  });

  it('handles multiple ## headings', () => {
    const md = '## First\n\nContent\n\n## Second\n\nMore content';
    const result = preprocess(md);

    expect(result.content).toContain('[](.slide#first)');
    expect(result.content).toContain('[](.slide#second)');
  });

  it('inserts separator above # (h1) headings', () => {
    const md = '# Main Title\n\nSome content';
    const result = preprocess(md);
    const lines = result.content.split('\n');

    expect(lines[0]).toBe('[](.slide#main-title)');
    expect(lines[1]).toBe('');
    expect(lines[2]).toBe('# Main Title');
  });

  it('inserts separator above ### (h3) headings', () => {
    const md = '### Sub Slide\n\nSome content';
    const result = preprocess(md);
    const lines = result.content.split('\n');

    expect(lines[0]).toBe('[](.slide#sub-slide)');
    expect(lines[1]).toBe('');
    expect(lines[2]).toBe('### Sub Slide');
  });

  it('handles all heading levels', () => {
    const md = '# H1 Title\n\n## H2 Title\n\n### H3 Title';
    const result = preprocess(md);

    expect(result.content).toContain('[](.slide#h1-title)');
    expect(result.content).toContain('[](.slide#h2-title)');
    expect(result.content).toContain('[](.slide#h3-title)');
  });

  it('does not affect headings inside ::: container blocks', () => {
    const md = '::: Notes\n## Hidden Heading\n:::\n\n## Visible Heading';
    const result = preprocess(md);

    expect(result.content).not.toContain('[](.slide#hidden-heading)');
    expect(result.content).toContain('[](.slide#visible-heading)');
  });

  it('handles nested ::: blocks correctly', () => {
    const md = '::: Notes\n# Title Inside\n::: Details\n## Also Inside\n:::\n:::\n\n### Outside';
    const result = preprocess(md);

    expect(result.content).not.toContain('[](.slide#title-inside)');
    expect(result.content).not.toContain('[](.slide#also-inside)');
    expect(result.content).toContain('[](.slide#outside)');
  });

  it('generates clean anchors from special characters', () => {
    const md = '## Hello, World! (2024)';
    const result = preprocess(md);

    expect(result.content).toContain('[](.slide#hello-world-2024)');
  });

  it('skips heading when an explicit marker already precedes it', () => {
    const md = '[](.coverbg#hero)\n\n### My Slide\n\nContent';
    const result = preprocess(md);

    expect(result.content).not.toContain('[](.slide#my-slide)');
    expect(result.content).toContain('[](.coverbg#hero)');
    expect(result.content).toContain('### My Slide');
  });

  it('handles empty heading', () => {
    const md = '## ';
    const result = preprocess(md);

    expect(result.content).toContain('[](.slide#)');
  });
});
