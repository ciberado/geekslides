/**
 * GeekSlides v2 — Plugin manager.
 *
 * Manages registration and sequential execution of preprocessors and processors.
 */

import type { GeekSlidesConfig } from '../core/Config.ts';
import type { Plugin, Preprocessor, Processor, ProcessorContext } from './types.ts';

interface NamedPreprocessor {
  name: string;
  fn: Preprocessor;
}

interface NamedProcessor {
  name: string;
  fn: Processor;
}

export class PluginManager {
  #preprocessors: NamedPreprocessor[] = [];
  #processors: NamedProcessor[] = [];

  /**
   * Register a plugin, adding its preprocessors and processors to the pipeline.
   */
  register(plugin: Plugin): void {
    if (plugin.preprocessors) {
      for (const fn of plugin.preprocessors) {
        this.#preprocessors.push({ name: plugin.name, fn });
      }
    }
    if (plugin.processors) {
      for (const fn of plugin.processors) {
        this.#processors.push({ name: plugin.name, fn });
      }
    }
  }

  /**
   * Run all preprocessors sequentially, threading output through each.
   */
  preprocess(markdown: string, config: GeekSlidesConfig): string {
    let result = markdown;
    for (const { fn } of this.#preprocessors) {
      result = fn(result, config);
    }
    return result;
  }

  /**
   * Run all processors on a slide element.
   */
  process(slideElement: HTMLElement, context: ProcessorContext): void {
    for (const { fn } of this.#processors) {
      fn(slideElement, context);
    }
  }

  /**
   * List registered plugin names for diagnostics.
   */
  list(): { preprocessors: string[]; processors: string[] } {
    return {
      preprocessors: this.#preprocessors.map((p) => p.name),
      processors: this.#processors.map((p) => p.name),
    };
  }
}
