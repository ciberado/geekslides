/**
 * GeekSlides Chart Plugin Bundle — Entry point.
 *
 * Exports: chart processor.
 * No runtime engine dependencies.
 */

import type { PluginExports, PluginActivate } from '../sdk/types.ts';
import { chartProcessor } from './chart-processor.ts';

export const activate: PluginActivate = (): PluginExports => ({
  processors: {
    'chart': chartProcessor,
  },
});
