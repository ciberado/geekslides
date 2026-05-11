/**
 * Static registry of all built-in GeekSlides slide classes, modifiers, and functions.
 *
 * - Layout classes: auto-generated from layouts.css by scripts/extract-css-docs.ts
 * - Layout-specific modifiers: auto-generated (nested in layout blocks with @modifier tags)
 * - Global modifiers: manually maintained here (mod-partial, mod-cols-4)
 * - Functions: manually maintained here (bgurl, bgcolor)
 */
export type ClassCategory = 'layout' | 'modifier' | 'function';
export interface ClassEntry {
    readonly name: string;
    readonly category: ClassCategory;
    readonly detail: string;
    readonly documentation: string;
    /** Snippet insert text (with $1 placeholders). Defaults to name if omitted. */
    readonly insertText?: string;
    /** True when this layout has a built-in DOM transform applied at render time. */
    readonly hasTransform?: boolean;
}
/**
 * Combined registry:
 * - Generated layouts (from CSS @layout tags)
 * - Generated layout-specific modifiers (from CSS @modifier tags)
 * - Manual global modifiers (mod-partial, mod-cols-4)
 * - Manual functions (bgurl, bgcolor)
 */
export declare const BUILTIN_CLASSES: readonly ClassEntry[];
/** Lookup map by name for fast access. */
export declare function buildClassMap(entries: readonly ClassEntry[]): ReadonlyMap<string, ClassEntry>;
//# sourceMappingURL=class-registry.d.ts.map