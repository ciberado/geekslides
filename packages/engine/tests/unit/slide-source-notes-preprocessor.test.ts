import { describe, it, expect } from 'vitest';
import { slideSourceNotesPreprocessor } from '../../src/plugins/builtins/slide-source-notes-preprocessor.ts';

describe('slideSourceNotesPreprocessor', () => {
  it('appends source notes block to a simple slide', () => {
    const input = `[](.layout-title#title)\n# My Title\n## Subtitle\n`;
    const result = slideSourceNotesPreprocessor(input, {} as never);

    expect(result).toContain('::: Notes');
    expect(result).toContain('~~~markdown');
    expect(result).toContain('[](.layout-title#title)');
    expect(result).toContain('# My Title');
    expect(result).toContain(':::');
  });

  it('preserves existing ::: Notes blocks and appends source after them', () => {
    const input = [
      '[](.layout-two-col#cols)',
      '### Heading',
      '',
      '::: Notes',
      'This is a handcrafted note explaining the layout.',
      ':::',
      '',
    ].join('\n');

    const result = slideSourceNotesPreprocessor(input, {} as never);

    // Handcrafted notes preserved
    expect(result).toContain('This is a handcrafted note explaining the layout.');
    // Auto-generated source block added with tilde fence
    expect(result).toContain('~~~markdown');
    expect(result).toContain('[](.layout-two-col#cols)');
    // Source should NOT include the handcrafted Notes content
    const sourceBlockStart = result.indexOf('~~~markdown');
    const sourceBlockEnd = result.indexOf('\n~~~', sourceBlockStart + 10);
    const sourceContent = result.slice(sourceBlockStart, sourceBlockEnd);
    expect(sourceContent).not.toContain('This is a handcrafted note');
  });

  it('handles multiple slides independently', () => {
    const input = [
      '[](.layout-title#title)',
      '# Title',
      '',
      '[](.layout-section#chapter)',
      '# Chapter One',
      '',
    ].join('\n');

    const result = slideSourceNotesPreprocessor(input, {} as never);
    const notesBlocks = result.match(/::: Notes/g);
    expect(notesBlocks).toHaveLength(2);
    expect(result).toContain('layout-title');
    expect(result).toContain('layout-section');
  });

  it('leaves preamble text before first slide separator untouched', () => {
    const input = 'Some intro text\n\n[](.layout-title#title)\n# Title\n';
    const result = slideSourceNotesPreprocessor(input, {} as never);
    expect(result.startsWith('Some intro text')).toBe(true);
  });

  it('escapes triple tildes inside the source to prevent tilde fence breakage', () => {
    const input = '[](.layout-blank#code)\n# Code\n\n~~~\nsome content\n~~~\n';
    const result = slideSourceNotesPreprocessor(input, {} as never);
    // Inner ~~~ lines are escaped as \~~~ so they don't close the outer fence
    expect(result).toContain('\\~~~');
    // The outer ~~~markdown / ~~~ pair is intact
    const tildeOpen = result.indexOf('~~~markdown');
    const tildeClose = result.indexOf('\n~~~\n', tildeOpen + 10);
    expect(tildeOpen).toBeGreaterThan(-1);
    expect(tildeClose).toBeGreaterThan(tildeOpen);
  });

  it('returns empty/whitespace-only input unchanged', () => {
    expect(slideSourceNotesPreprocessor('', {} as never)).toBe('');
    expect(slideSourceNotesPreprocessor('   \n', {} as never)).toBe('   \n');
  });
});
