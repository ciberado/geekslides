/**
 * GeekSlides v2 — Header preprocessor.
 *
 * Matches lines starting with `# `, `## `, `### `, etc. and inserts an
 * empty-link slide separator above each one. Headings inside `::: …`
 * container blocks (Notes, Details, …) are left untouched.
 */

import type { Preprocessor } from '../types.ts';

/**
 * Generate a URL-safe anchor from a heading title.
 */
function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export const headerPreprocessor: Preprocessor = (markdown: string) => {
  const lines = markdown.split('\n');
  const result: string[] = [];
  const lineMapping: number[] = [];
  let insideContainer = 0;

  for (const [index, line] of lines.entries()) {
    const sourceLine = index + 1;
    // Track ::: container blocks (Notes, Details, …)
    if (/^:::\s*\S/.test(line)) {
      insideContainer++;
    } else if (/^:::\s*$/.test(line)) {
      insideContainer = Math.max(0, insideContainer - 1);
    }

    if (insideContainer === 0 && /^#{1,3} /.test(line)) {
      // Skip if a slide marker already precedes this heading.
      const lastNonBlank = findLastNonBlank(result);
      if (lastNonBlank === undefined || !/^\[]\(/.test(lastNonBlank)) {
        const title = line.replace(/^#{1,3} /, '').trim();
        const anchor = slugify(title);
        result.push(`[](.slide#${anchor})`);
        result.push('');
        lineMapping.push(sourceLine, sourceLine);
      }
    }
    result.push(line);
    lineMapping.push(sourceLine);
  }

  return {
    content: result.join('\n'),
    lineMapping,
  };
};

function findLastNonBlank(lines: string[]): string | undefined {
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    if (line !== undefined && line.trim() !== '') return line;
  }
  return undefined;
}
