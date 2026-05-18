/**
 * GeekSlides v2 — Slide-source-notes preprocessor.
 *
 * Appends each slide's own markdown source as a fenced code block inside a
 * ::: Notes block. Useful for showcase / tutorial decks where the speaker
 * view should show how each slide was written.
 *
 * Behaviour:
 *   - Every slide gets an auto-generated ::: Notes block containing its
 *     markdown source wrapped in a ```markdown fence.
 *   - Any handcrafted ::: Notes block already present is preserved. Both
 *     blocks appear in the speaker view (parser collects all Notes tokens).
 *   - The auto-generated block shows the slide source *without* any
 *     handcrafted Notes content (those are meta, not slide markup).
 *   - Content before the first slide separator (preamble) is left untouched.
 */

import type { Preprocessor } from '@engine/plugins/types.ts';

/**
 * Remove all ::: Notes … ::: blocks from a string, leaving other content.
 * Handles a single level of nesting (standard for Notes blocks).
 */
function stripNotesBlocks(text: string): string {
  const lines = text.split('\n');
  const result: string[] = [];
  let insideNotes = false;

  for (const line of lines) {
    if (/^::: Notes\b/.test(line)) {
      insideNotes = true;
      continue;
    }
    if (insideNotes && /^:::\s*$/.test(line)) {
      insideNotes = false;
      continue;
    }
    if (!insideNotes) {
      result.push(line);
    }
  }

  return result.join('\n');
}

/**
 * Escape any occurrence of triple tildes inside the source so they don't
 * accidentally close the ~~~ tilde fence wrapper.
 */
function escapeForTildeFence(source: string): string {
  return source.replace(/^~~~/gm, '\\~~~');
}

export const slideSourceNotesPreprocessor: Preprocessor = (markdown: string) => {
  if (!markdown.trim()) {
    return markdown;
  }

  const inputLines = markdown.split('\n');
  const outputLines: string[] = [];
  const lineMapping: number[] = [];
  const separatorIndexes = inputLines
    .map((line, index) => (/^\[]\(/.test(line) ? index : -1))
    .filter((index) => index >= 0);

  const firstSeparator = separatorIndexes[0];
  if (firstSeparator === undefined) {
    return markdown;
  }

  const pushLines = (lines: readonly string[], mappingLine: number): void => {
    for (const line of lines) {
      outputLines.push(line);
      lineMapping.push(mappingLine);
    }
  };

  const trimTrailingBlankLines = (lines: readonly string[]): string[] => {
    const copy = [...lines];
    while (copy.length > 0 && copy[copy.length - 1]?.trim() === '') {
      copy.pop();
    }
    return copy;
  };

  const preambleLines = inputLines.slice(0, firstSeparator);
  for (const [index, line] of preambleLines.entries()) {
    outputLines.push(line);
    lineMapping.push(index + 1);
  }

  for (const [chunkIndex, start] of separatorIndexes.entries()) {
    const end = separatorIndexes[chunkIndex + 1] ?? inputLines.length;
    const chunkLines = inputLines.slice(start, end);

    if (!chunkLines[0]?.startsWith('[](')) {
      pushLines(chunkLines, start + 1);
      continue;
    }

    const trimmedChunkLines = trimTrailingBlankLines(chunkLines);
    for (const [index, line] of trimmedChunkLines.entries()) {
      outputLines.push(line);
      lineMapping.push(start + index + 1);
    }

    const chunkText = chunkLines.join('\n');
    const source = escapeForTildeFence(stripNotesBlocks(chunkText).trimEnd());
    const sourceLines = source.split('\n');
    const chunkTerminalLine = start + chunkLines.length;

    pushLines(['', '', '::: Notes', '~~~markdown'], chunkTerminalLine);
    pushLines(sourceLines, chunkTerminalLine);
    pushLines(['~~~', ':::'], chunkTerminalLine);
  }

  return {
    content: outputLines.join('\n'),
    lineMapping,
  };
};
