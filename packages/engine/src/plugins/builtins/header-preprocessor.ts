/**
 * GeekSlides v2 — Header preprocessor.
 *
 * Matches lines starting with `## ` and inserts an empty-link slide separator
 * above each one. Replicates v1's headerPreprocessor logic.
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

export const headerPreprocessor: Preprocessor = (markdown: string): string => {
  const lines = markdown.split('\n');
  const result: string[] = [];

  for (const line of lines) {
    if (/^## /.test(line)) {
      const title = line.replace(/^## /, '').trim();
      const anchor = slugify(title);
      result.push(`[](.slide#${anchor})`);
      result.push('');
    }
    result.push(line);
  }

  return result.join('\n');
};
