/**
 * Fuzzy string matcher for partial class names.
 *
 * Matches user-typed partial strings (e.g., "layout-ti") to valid class names
 * from a registry using a scoring algorithm.
 */
export interface FuzzyMatchResult {
    readonly match: string;
    readonly score: number;
}
/**
 * Find the best matching class name for a partial input string.
 *
 * Returns the class with the highest score (>= 50 threshold).
 * Ties are broken alphabetically.
 *
 * Returns undefined if no match meets the threshold or input is empty.
 */
export declare function fuzzyMatchClass(input: string, candidates: readonly string[]): string | undefined;
/**
 * Find all matches above the threshold, sorted by score descending.
 * Useful for displaying multiple suggestions.
 */
export declare function fuzzyMatchAll(input: string, candidates: readonly string[], threshold?: number): FuzzyMatchResult[];
//# sourceMappingURL=fuzzy-matcher.d.ts.map