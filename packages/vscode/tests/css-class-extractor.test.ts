import { describe, expect, it } from 'vitest';
import { extractClassSelectorsFromCss } from '../src/completion/css-class-extractor.ts';

describe('extractClassSelectorsFromCss', () => {
  it('extracts layout- prefixed classes', () => {
    const css = `
      section.content.layout-hero { display: flex; }
      section.content.layout-two-col { display: grid; }
    `;
    const result = extractClassSelectorsFromCss(css);
    expect(result).toContain('layout-hero');
    expect(result).toContain('layout-two-col');
  });

  it('extracts mod- prefixed classes', () => {
    const css = `
      section.content.layout-team.mod-heading-center { text-align: center; }
      &.mod-cols-2 { grid-template-columns: repeat(2, 1fr); }
    `;
    const result = extractClassSelectorsFromCss(css);
    expect(result).toContain('mod-heading-center');
    expect(result).toContain('mod-cols-2');
  });

  it('does not extract unrelated classes', () => {
    const css = `
      .content { padding: 20px; }
      .block-image { margin: 0; }
      h1 { font-size: 72pt; }
    `;
    const result = extractClassSelectorsFromCss(css);
    expect(result).toHaveLength(0);
  });

  it('deduplicates classes', () => {
    const css = `
      .layout-title { display: flex; }
      .layout-title h1 { margin: 0; }
    `;
    const result = extractClassSelectorsFromCss(css);
    const titleCount = result.filter((c) => c === 'layout-title').length;
    expect(titleCount).toBe(1);
  });

  it('handles empty CSS', () => {
    expect(extractClassSelectorsFromCss('')).toHaveLength(0);
  });
});
