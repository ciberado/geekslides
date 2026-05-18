/**
 * GeekSlides Mermaid Plugin Bundle — Entry point.
 *
 * Exports: mermaid processor.
 * Runtime dependency: createLogger (received from PluginAPI).
 */

import type { PluginAPI, PluginExports, PluginActivate } from '../sdk/types.ts';
import { createMermaidProcessor } from './mermaid-processor.ts';

export const activate: PluginActivate = (api: PluginAPI): PluginExports => ({
  processors: {
    'mermaid': createMermaidProcessor(api.createLogger),
  },
});

