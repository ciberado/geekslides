import { describe, it, expect } from 'vitest';
import { slideSourceNotesPreprocessor } from '../../../../plugins/core/slide-source-notes-preprocessor.ts';
import { normalizePreprocessorResult } from '../../src/plugins/preprocessor-utils.ts';

function preprocess(input: string): { content: string; lineMapping: readonly number[] } {
  return normalizePreprocessorResult(slideSourceNotesPreprocessor(input, {} as never));
}

describe('slideSourceNotesPreprocessor', () => {
  it('appends source notes block to a simple slide', () => {
    const input = `[](.layout-title#title)\n# My Title\n## Subtitle\n`;
    const result = preprocess(input);

    expect(result.content).toContain('::: Notes');
    expect(result.content).toContain('~~~markdown');
    expect(result.content).toContain('[](.layout-title#title)');
    expect(result.content).toContain('# My Title');
    expect(result.content).toContain(':::');
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

    const result = preprocess(input);

    // Handcrafted notes preserved
    expect(result.content).toContain('This is a handcrafted note explaining the layout.');
    // Auto-generated source block added with tilde fence
    expect(result.content).toContain('~~~markdown');
    expect(result.content).toContain('[](.layout-two-col#cols)');
    // Source should NOT include the handcrafted Notes content
    const sourceBlockStart = result.content.indexOf('~~~markdown');
    const sourceBlockEnd = result.content.indexOf('\n~~~', sourceBlockStart + 10);
    const sourceContent = result.content.slice(sourceBlockStart, sourceBlockEnd);
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

    const result = preprocess(input);
    const notesBlocks = result.content.match(/::: Notes/g);
    expect(notesBlocks).toHaveLength(2);
    expect(result.content).toContain('layout-title');
    expect(result.content).toContain('layout-section');
  });

  it('leaves preamble text before first slide separator untouched', () => {
    const input = 'Some intro text\n\n[](.layout-title#title)\n# Title\n';
    const result = preprocess(input);
    expect(result.content.startsWith('Some intro text')).toBe(true);
  });

  it('escapes triple tildes inside the source to prevent tilde fence breakage', () => {
    const input = '[](.layout-blank#code)\n# Code\n\n~~~\nsome content\n~~~\n';
    const result = preprocess(input);
    // Inner ~~~ lines are escaped as \~~~ so they don't close the outer fence
    expect(result.content).toContain('\\~~~');
    // The outer ~~~markdown / ~~~ pair is intact
    const tildeOpen = result.content.indexOf('~~~markdown');
    const tildeClose = result.content.indexOf('\n~~~\n', tildeOpen + 10);
    expect(tildeOpen).toBeGreaterThan(-1);
    expect(tildeClose).toBeGreaterThan(tildeOpen);
  });

  it('returns empty/whitespace-only input unchanged', () => {
    expect(slideSourceNotesPreprocessor('', {} as never)).toBe('');
    expect(slideSourceNotesPreprocessor('   \n', {} as never)).toBe('   \n');
  });

  it('maps generated notes lines back to the original slide range', () => {
    const result = preprocess('[](#demo)\n# Demo\n');

    expect(result.lineMapping[0]).toBe(1);
    expect(result.lineMapping.at(-1)).toBe(3);
  });
});
