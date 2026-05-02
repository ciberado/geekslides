/**
 * Extracts CSS class selectors from deck stylesheet files.
 *
 * Reads the `styles` array from a deck's `config.json`, resolves
 * each path relative to the config directory, and parses the CSS
 * to find `.layout-*` and `.mod-*` class selectors.
 */
import type { ClassEntry } from './class-registry.ts';
export interface CssExtractorDeps {
    readonly readText?: (path: string, encoding: 'utf8') => Promise<string>;
}
/**
 * Extract custom class names from a deck's CSS files.
 *
 * Returns ClassEntry items for any `.layout-*` or `.mod-*` classes
 * found that are NOT already in the built-in registry.
 */
export declare function extractClassesFromDeck(configPath: string, builtinNames: ReadonlySet<string>, deps?: CssExtractorDeps): Promise<ClassEntry[]>;
/**
 * Extract `.layout-*` and `.mod-*` class selectors from raw CSS text.
 * Also extracts any other `.xyz` classes used with `section.content.`
 * selector patterns common in GeekSlides layouts.
 */
export declare function extractClassSelectorsFromCss(css: string): string[];
//# sourceMappingURL=css-class-extractor.d.ts.map