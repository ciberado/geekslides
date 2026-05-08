/**
 * GeekSlides v2 — CSS Doodle preprocessor.
 *
 * Transforms markdown image syntax into placeholder divs:
 *   ![css-doodle](#pattern-name)
 *   ![css-doodle](#pattern-name,grid=12,opacity=0.3)
 *
 * These placeholders are later processed by the css-doodle-processor.
 */

import type { Preprocessor } from '../types.ts';

/**
 * Regex to match css-doodle image syntax.
 * Captures: #pattern-name or #pattern-name,config1,config2...
 */
const DOODLE_RE = /!\[css-doodle\]\(#([a-z][a-z0-9-]*(?:,[^)]*)?)\)/gi;

/**
 * Preprocessor that converts css-doodle markdown syntax to HTML placeholders.
 */
export const cssDoodlePreprocessor: Preprocessor = (markdown: string): string => {
  return markdown.replace(DOODLE_RE, (_match, params: string) => {
    // URL-encode the parameters to preserve them through markdown parsing
    const escaped = encodeURIComponent(params);
    return `<div class="gs-doodle" data-doodle="${escaped}"></div>`;
  });
};
