/**
 * GeekSlides v2 — Plugin manager.
 *
 * Manages registration and sequential execution of preprocessors and processors.
 */

import type { GeekSlidesConfig } from '../core/Config.ts';
import type { Plugin, Preprocessor, Processor, ProcessorContext } from './types.ts';
import { createLogger } from '../logging.ts';

const log = createLogger('plugins');

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
    log.debug({ plugin: plugin.name }, 'plugin registered');
  }

  /**
   * Run all preprocessors sequentially, threading output through each.
   * Errors are re-thrown with the plugin name and a snippet of the input
   * so the root cause is easy to locate.
   */
  preprocess(markdown: string, config: GeekSlidesConfig): string {
    let result = markdown;
    for (const { name, fn } of this.#preprocessors) {
      try {
        result = fn(result, config);
      } catch (err) {
        const snippet = result.slice(0, 120).replace(/\n/g, '↵');
        throw new Error(
          `Preprocessor from plugin "${name}" threw an error.\n` +
          `Input snippet: ${snippet}${result.length > 120 ? '…' : ''}`,
          { cause: err },
        );
      }
    }
    return result;
  }

  /**
   * Run all processors on a slide element.
   * Errors are re-thrown with the plugin name and slide context.
   */
  process(slideElement: HTMLElement, context: ProcessorContext): void {
    for (const { name, fn } of this.#processors) {
      try {
        fn(slideElement, context);
      } catch (err) {
        throw new Error(
          `Processor from plugin "${name}" threw an error on slide ${String(context.slideIndex + 1)} of ${String(context.slideCount)}.`,
          { cause: err },
        );
      }
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
