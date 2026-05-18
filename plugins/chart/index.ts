/**
 * GeekSlides Chart Plugin Bundle — Entry point.
 *
 * Exports: chart processor.
 * No runtime engine dependencies.
 */

import type { PluginAPI, PluginExports, PluginActivate } from '../sdk/types.ts';
import { chartProcessor } from './chart-processor.ts';

export const activate: PluginActivate = (_api: PluginAPI): PluginExports => ({
  processors: {
    'chart': chartProcessor,
  },
});
