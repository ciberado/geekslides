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

import type { Preprocessor } from '../types.ts';

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

export const slideSourceNotesPreprocessor: Preprocessor = (markdown: string): string => {
  // Split just before each slide separator line: [](...) at start of line.
  // The lookahead keeps the separator attached to its own chunk.
  const chunks = markdown.split(/(?=^\[]\()/m);

  return chunks
    .map((chunk) => {
      // Skip empty chunks and any preamble before the first slide separator.
      if (!chunk.trim() || !chunk.startsWith('[](')) return chunk;

      // Derive the display source by stripping existing ::: Notes blocks.
      const source = escapeForTildeFence(stripNotesBlocks(chunk).trimEnd());

      // Use tilde fences (~~~) so any backtick fences in the slide source
      // don't accidentally close the outer code block.
      const autoNotes = `\n\n::: Notes\n~~~markdown\n${source}\n~~~\n:::`;
      return chunk.trimEnd() + autoNotes + '\n';
    })
    .join('');
};
