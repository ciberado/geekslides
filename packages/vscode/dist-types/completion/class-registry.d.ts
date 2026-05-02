/**
 * Static registry of all built-in GeekSlides slide classes, modifiers, and functions.
 *
 * Each entry includes metadata used by the CompletionItemProvider to display
 * labels, detail, and documentation in the autocomplete popup.
 */
export type ClassCategory = 'layout' | 'modifier' | 'function';
export interface ClassEntry {
    readonly name: string;
    readonly category: ClassCategory;
    readonly detail: string;
    readonly documentation: string;
    /** Snippet insert text (with $1 placeholders). Defaults to name if omitted. */
    readonly insertText?: string;
}
export declare const BUILTIN_CLASSES: readonly ClassEntry[];
/** Lookup map by name for fast access. */
export declare function buildClassMap(entries: readonly ClassEntry[]): ReadonlyMap<string, ClassEntry>;
//# sourceMappingURL=class-registry.d.ts.map