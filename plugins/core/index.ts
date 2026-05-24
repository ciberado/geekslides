/**
 * GeekSlides Core Plugin Bundle — Entry point.
 *
 * Exports: header preprocessor, iframe processor, source-notes preprocessor.
 * This bundle has no runtime engine dependencies.
 */

import type { PluginExports, PluginActivate } from '../sdk/types.ts';
import { headerPreprocessor } from './header-preprocessor.ts';
import { iframeProcessor } from './iframe-processor.ts';
import { slideSourceNotesPreprocessor } from './slide-source-notes-preprocessor.ts';

export const activate: PluginActivate = (): PluginExports => ({
  preprocessors: {
    'header': headerPreprocessor,
    'source-notes': slideSourceNotesPreprocessor,
  },
  processors: {
    'iframe': iframeProcessor,
  },
});
