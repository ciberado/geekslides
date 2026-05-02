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
 * Calculate Levenshtein distance between two strings.
 * Used as a fallback scoring mechanism.
 */
function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    const row0 = matrix[0];
    if (row0) {
      row0[j] = j;
    }
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      const currentRow = matrix[i];
      const prevRow = matrix[i - 1];
      if (!currentRow || !prevRow) continue;

      if (b[i - 1] === a[j - 1]) {
        const prevVal = prevRow[j - 1];
        if (prevVal !== undefined) {
          currentRow[j] = prevVal;
        }
      } else {
        const diagVal = prevRow[j - 1];
        const leftVal = currentRow[j - 1];
        const upVal = prevRow[j];
        if (diagVal !== undefined && leftVal !== undefined && upVal !== undefined) {
          currentRow[j] = Math.min(
            diagVal + 1, // substitution
            leftVal + 1, // insertion
            upVal + 1,   // deletion
          );
        }
      }
    }
  }

  const lastRow = matrix[b.length];
  const result = lastRow?.[a.length];
  return result ?? 0;
}

/**
 * Score a candidate class name against a partial input string.
 *
 * Scoring:
 * - Exact match: 100
 * - Starts with input: 80 + input.length
 * - Contains input: 50 + position bonus (0-50)
 * - Edit distance fallback: max(0, 40 - distance)
 */
function scoreMatch(input: string, candidate: string): number {
  const lowerInput = input.toLowerCase();
  const lowerCandidate = candidate.toLowerCase();

  // Exact match
  if (lowerInput === lowerCandidate) {
    return 100;
  }

  // Starts with input (prefix match)
  if (lowerCandidate.startsWith(lowerInput)) {
    return 80 + lowerInput.length;
  }

  // Contains input (substring match)
  const containsIndex = lowerCandidate.indexOf(lowerInput);
  if (containsIndex >= 0) {
    // Position bonus: earlier occurrence scores higher
    const positionBonus = Math.max(0, 50 - containsIndex * 2);
    return 50 + positionBonus;
  }

  // Edit distance fallback
  const distance = levenshteinDistance(lowerInput, lowerCandidate);
  return Math.max(0, 40 - distance);
}

/**
 * Find the best matching class name for a partial input string.
 *
 * Returns the class with the highest score (>= 50 threshold).
 * Ties are broken alphabetically.
 *
 * Returns undefined if no match meets the threshold or input is empty.
 */
export function fuzzyMatchClass(input: string, candidates: readonly string[]): string | undefined {
  if (input.length === 0) {
    return undefined;
  }

  let bestMatch: string | undefined;
  let bestScore = 50; // Minimum threshold

  for (const candidate of candidates) {
    const score = scoreMatch(input, candidate);

    if (score > bestScore) {
      bestScore = score;
      bestMatch = candidate;
    } else if (score === bestScore && bestMatch !== undefined) {
      // Tie-breaking: alphabetically first
      if (candidate < bestMatch) {
        bestMatch = candidate;
      }
    }
  }

  return bestMatch;
}

/**
 * Find all matches above the threshold, sorted by score descending.
 * Useful for displaying multiple suggestions.
 */
export function fuzzyMatchAll(
  input: string,
  candidates: readonly string[],
  threshold = 50,
): FuzzyMatchResult[] {
  if (input.length === 0) {
    return [];
  }

  const results: FuzzyMatchResult[] = [];

  for (const candidate of candidates) {
    const score = scoreMatch(input, candidate);
    if (score >= threshold) {
      results.push({ match: candidate, score });
    }
  }

  // Sort by score descending, then alphabetically
  results.sort((a, b) => {
    if (a.score !== b.score) {
      return b.score - a.score;
    }
    return a.match.localeCompare(b.match);
  });

  return results;
}
