/**
 * GeekSlides CSS Doodle Plugin Bundle — Entry point.
 *
 * Exports: css-doodle preprocessor and processor.
 * Runtime dependency: createLogger (received from PluginAPI).
 */

import type { PluginAPI, PluginExports, PluginActivate } from '../sdk/types.ts';
import { cssDoodlePreprocessor } from './css-doodle-preprocessor.ts';
import { createCssDoodleProcessor } from './css-doodle-processor.ts';

export const activate: PluginActivate = (api: PluginAPI): PluginExports => ({
  preprocessors: {
    'css-doodle': cssDoodlePreprocessor,
  },
  processors: {
    'css-doodle': createCssDoodleProcessor(api.createLogger),
  },
});

