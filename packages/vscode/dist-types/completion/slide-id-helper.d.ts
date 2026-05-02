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
export declare function scanSlideIds(documentText: string): SlideIdScanResult;
/**
 * Check if a proposed ID is valid kebab-case.
 */
export declare function isValidKebabCase(id: string): boolean;
//# sourceMappingURL=slide-id-helper.d.ts.map