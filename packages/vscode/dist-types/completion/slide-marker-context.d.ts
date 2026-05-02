/**
 * Detects the cursor context within a GeekSlides slide marker.
 *
 * Slide markers use the empty-link syntax:
 *   [](.class1.class2#id,bgurl(url),bgcolor(color))
 *
 * This module determines what kind of completion to offer based on
 * cursor position within that syntax.
 */
export type MarkerContext = {
    readonly kind: 'class';
    readonly prefix: string;
} | {
    readonly kind: 'id';
    readonly prefix: string;
} | {
    readonly kind: 'function';
    readonly prefix: string;
} | {
    readonly kind: 'none';
};
/**
 * Analyse the current line and cursor column to determine the context
 * for slide marker autocompletion.
 *
 * Returns `{ kind: 'none' }` when the cursor is not inside a `[]()` marker.
 */
export declare function getMarkerContext(lineText: string, cursorColumn: number): MarkerContext;
//# sourceMappingURL=slide-marker-context.d.ts.map