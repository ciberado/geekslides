/**
 * GeekSlides v2 — CSS Doodle pattern type definitions.
 */

/**
 * Configuration for a css-doodle pattern.
 */
export interface DoodlePatternConfig {
  readonly grid: string;
  readonly colors: readonly string[];
  readonly animate: boolean;
  readonly speed: number;
  seed?: string;
}

/**
 * A css-doodle pattern definition.
 */
export interface DoodlePattern {
  readonly name: string;
  readonly category: 'geometric' | 'organic' | 'abstract' | 'tech' | 'decorative';
  readonly defaultGrid: string;
  readonly description: string;
  readonly generate: (config: DoodlePatternConfig) => string;
}

/**
 * Parsed configuration from markdown syntax.
 * Example: #triangles,grid=12,opacity=0.3,colors=pink|teal
 */
export interface ParsedDoodleConfig {
  patternName: string;
  grid?: string;
  size?: string;
  /** Shape scale in percent: >100 bigger shapes, <100 smaller shapes. */
  shape?: number;
  opacity?: string;
  colors?: string[];
  seed?: string;
  bg?: boolean;
  cover?: boolean;
  animate?: boolean;
  speed?: number;
  /** When true, replaces the surface color (c5) with a dark accent shade
   * so shapes never become invisible against the slide background. */
  nohole?: boolean;
}
