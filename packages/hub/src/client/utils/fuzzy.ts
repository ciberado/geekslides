/**
 * Fuzzy character-sequence matcher.
 *
 * Returns true when every character of `query` appears somewhere in `text`
 * in the same order (case-insensitive). Example: `fuzzyMatch('AWS Talk', 'awt')`
 * returns true because 'a', 'w', 't' all appear in sequence.
 */
export function fuzzyMatch(text: string, query: string): boolean {
  const t = text.toLowerCase();
  const q = query.toLowerCase();
  let ti = 0;
  for (const ch of q) {
    const idx = t.indexOf(ch, ti);
    if (idx === -1) return false;
    ti = idx + 1;
  }
  return true;
}
