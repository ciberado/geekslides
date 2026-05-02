/**
 * Scans a markdown document for existing slide IDs and provides
 * duplicate detection and kebab-case suggestions.
 */

/** Result of scanning a document for slide IDs. */
export interface SlideIdScanResult {
  /** All IDs found in the document, in order. */
  readonly ids: readonly string[];
  /** IDs that appear more than once. */
  readonly duplicates: ReadonlySet<string>;
}

/**
 * Scan document text for slide marker IDs.
 *
 * Looks for `#id` within `[]()` empty-link markers and extracts the ID portion.
 */
export function scanSlideIds(documentText: string): SlideIdScanResult {
  const ids: string[] = [];
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  // Match [](...#id...) patterns — extract the #id portion
  const markerRegex = /\[\]\([^)]*#([a-zA-Z0-9_-]+)[^)]*\)/g;
  let match: RegExpExecArray | null;
  while ((match = markerRegex.exec(documentText)) !== null) {
    const id = match[1];
    if (id) {
      ids.push(id);
      if (seen.has(id)) {
        duplicates.add(id);
      }
      seen.add(id);
    }
  }

  return { ids, duplicates };
}

/**
 * Check if a proposed ID is valid kebab-case.
 */
export function isValidKebabCase(id: string): boolean {
  return /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(id);
}
