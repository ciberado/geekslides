/**
 * GeekSlides Poll Plugin Bundle — Entry point.
 *
 * Exports: poll feature.
 * Runtime dependency: createLogger (received from PluginAPI).
 */

import type { PluginAPI, PluginExports, PluginActivate } from '../sdk/types.ts';
import { createPollFeature } from './poll-feature.ts';

export const activate: PluginActivate = (api: PluginAPI): PluginExports => ({
  features: {
    'poll': createPollFeature(api.createLogger),
  },
});
