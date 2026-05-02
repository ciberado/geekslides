/**
 * Detects the cursor context within a GeekSlides slide marker.
 *
 * Slide markers use the empty-link syntax:
 *   [](.class1.class2#id,bgurl(url),bgcolor(color))
 *
 * This module determines what kind of completion to offer based on
 * cursor position within that syntax.
 */

export type MarkerContext =
  | { readonly kind: 'class'; readonly prefix: string }
  | { readonly kind: 'id'; readonly prefix: string }
  | { readonly kind: 'function'; readonly prefix: string }
  | { readonly kind: 'none' };

/**
 * Analyse the current line and cursor column to determine the context
 * for slide marker autocompletion.
 *
 * Returns `{ kind: 'none' }` when the cursor is not inside a `[]()` marker.
 */
export function getMarkerContext(lineText: string, cursorColumn: number): MarkerContext {
  // Find the innermost []() enclosing the cursor
  const parenContent = findEnclosingParenContent(lineText, cursorColumn);
  if (parenContent === undefined) {
    return { kind: 'none' };
  }

  const { content, offsetInContent } = parenContent;
  const textBeforeCursor = content.slice(0, offsetInContent);

  // After a comma → function context (bgurl, bgcolor)
  const lastComma = textBeforeCursor.lastIndexOf(',');
  if (lastComma >= 0) {
    const afterComma = textBeforeCursor.slice(lastComma + 1).trimStart();
    return { kind: 'function', prefix: afterComma };
  }

  // After a hash → id context
  const lastHash = textBeforeCursor.lastIndexOf('#');
  if (lastHash >= 0) {
    const afterHash = textBeforeCursor.slice(lastHash + 1);
    return { kind: 'id', prefix: afterHash };
  }

  // After a dot → class context
  const lastDot = textBeforeCursor.lastIndexOf('.');
  if (lastDot >= 0) {
    const afterDot = textBeforeCursor.slice(lastDot + 1);
    return { kind: 'class', prefix: afterDot };
  }

  // Inside parens but no dot/hash/comma yet
  return { kind: 'none' };
}

interface ParenContent {
  readonly content: string;
  readonly offsetInContent: number;
}

/**
 * Find the content of a `[]()` empty-link enclosing the cursor.
 * Returns the text between the parens and the cursor's offset within it.
 */
function findEnclosingParenContent(lineText: string, cursorColumn: number): ParenContent | undefined {
  // Look backward for `](` — the transition from link text to link href
  const textBeforeCursor = lineText.slice(0, cursorColumn);

  // Find the last `](` before cursor — this is our candidate opening
  let openIdx = -1;
  for (let i = textBeforeCursor.length - 1; i >= 1; i--) {
    if (textBeforeCursor[i] === '(' && textBeforeCursor[i - 1] === ']') {
      // Make sure the `]` is preceded by `[` to confirm it's an empty-link `[](…)`
      // (or at least a link syntax)
      const bracketStart = findMatchingBracket(textBeforeCursor, i - 1);
      if (bracketStart !== undefined) {
        openIdx = i + 1; // position after `(`
        break;
      }
    }
  }

  if (openIdx < 0) {
    return undefined;
  }

  // Find closing `)` after cursor (or end of line)
  let closeIdx = lineText.indexOf(')', cursorColumn);
  if (closeIdx < 0) {
    closeIdx = lineText.length;
  }

  const content = lineText.slice(openIdx, closeIdx);
  const offsetInContent = cursorColumn - openIdx;

  return { content, offsetInContent };
}

function findMatchingBracket(text: string, closeBracketIdx: number): number | undefined {
  // Walk backward from the `]` to find the matching `[`
  for (let i = closeBracketIdx - 1; i >= 0; i--) {
    if (text[i] === '[') {
      return i;
    }
    // If we hit another `]` before finding `[`, this is nested — not our target
    if (text[i] === ']') {
      return undefined;
    }
  }
  return undefined;
}
