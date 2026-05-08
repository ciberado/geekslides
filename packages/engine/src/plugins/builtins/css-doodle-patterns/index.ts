/**
 * GeekSlides v2 — CSS Doodle pattern registry.
 *
 * Central registry for all built-in css-doodle patterns.
 * Patterns are organized by category and can be retrieved by name.
 */

import type { DoodlePattern } from './types.ts';

/**
 * Pattern registry storing all available patterns.
 */
class PatternRegistry {
  readonly #patterns = new Map<string, DoodlePattern>();

  /**
   * Register a pattern.
   */
  register(pattern: DoodlePattern): void {
    this.#patterns.set(pattern.name, pattern);
  }

  /**
   * Register multiple patterns.
   */
  registerAll(patterns: readonly DoodlePattern[]): void {
    for (const pattern of patterns) {
      this.register(pattern);
    }
  }

  /**
   * Get a pattern by name. Returns undefined if not found.
   */
  get(name: string): DoodlePattern | undefined {
    return this.#patterns.get(name);
  }

  /**
   * List all registered patterns.
   */
  list(): readonly DoodlePattern[] {
    return Array.from(this.#patterns.values());
  }

  /**
   * List patterns by category.
   */
  listByCategory(category: DoodlePattern['category']): readonly DoodlePattern[] {
    return this.list().filter((p) => p.category === category);
  }

  /**
   * Check if a pattern exists.
   */
  has(name: string): boolean {
    return this.#patterns.has(name);
  }
}

/**
 * Global pattern registry instance.
 */
export const patternRegistry = new PatternRegistry();

// Import and register all built-in patterns
import { geometricPatterns } from './geometric.ts';
import { organicPatterns } from './organic.ts';
import { abstractPatterns } from './abstract.ts';
import { techPatterns } from './tech.ts';
import { decorativePatterns } from './decorative.ts';

patternRegistry.registerAll([
  ...geometricPatterns,
  ...organicPatterns,
  ...abstractPatterns,
  ...techPatterns,
  ...decorativePatterns,
]);
