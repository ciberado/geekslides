/**
 * GeekSlides v2 — Plugin type definitions.
 */

import type { GeekSlidesConfig } from '../core/Config.ts';

/**
 * Transforms raw markdown before parsing into slides.
 */
export type Preprocessor = (markdown: string, config: GeekSlidesConfig) => string;

/**
 * Transforms a rendered slide's DOM element after HTML insertion.
 */
export type Processor = (slideElement: HTMLElement, context: ProcessorContext) => void;

/**
 * Context passed to each processor when processing a slide.
 */
export interface ProcessorContext {
  readonly slideIndex: number;
  readonly slideCount: number;
  readonly config: GeekSlidesConfig;
  readonly slideshow: HTMLElement;
}

/**
 * A plugin bundle that can provide preprocessors and/or processors.
 */
export interface Plugin {
  readonly name: string;
  readonly preprocessors?: readonly Preprocessor[];
  readonly processors?: readonly Processor[];
}
