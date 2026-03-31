/**
 * GeekSlides v2 — CSS selector scoping.
 *
 * Rewrites CSS selectors to scope them to a specific slide by prefixing
 * each selector with `geek-slide[data-id="<slideId>"]`.
 */

/**
 * Scope CSS rules to a specific slide element.
 *
 * Uses regex-based selector prefixing since CSSStyleSheet.replaceSync()
 * is not available in all environments (Node.js tests).
 */
export function scope(css: string, slideId: string): string {
  const prefix = `geek-slide[data-id="${slideId}"]`;

  // Split CSS into rule blocks and at-rules
  return css.replace(
    /([^{}]+)\{/g,
    (match, selectorsRaw: string) => {
      const trimmed = selectorsRaw.trim();

      // Skip empty matches
      if (trimmed.length === 0) {
        return match;
      }

      // Don't prefix at-rule blocks (@keyframes, @media, @supports, etc.)
      if (trimmed.startsWith('@')) {
        return match;
      }

      // Check if we're inside an at-rule context by looking for @ in the raw match
      // This handles cases like nested rules inside @keyframes
      if (selectorsRaw.includes('@')) {
        return match;
      }

      // Prefix each comma-separated selector
      const selectors = trimmed.split(',').map((s) => {
        const sel = s.trim();
        if (sel.length === 0) return sel;

        // Skip selectors that are already scoped
        if (sel.startsWith(prefix)) return sel;

        // Skip :root and :host
        if (sel === ':root' || sel === ':host') return sel;

        // Skip at-rule keywords (from, to) inside @keyframes
        if (sel === 'from' || sel === 'to' || /^\d+%$/.test(sel)) return sel;

        return `${prefix} ${sel}`;
      });

      return `${selectors.join(', ')} {`;
    },
  );
}
