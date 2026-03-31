// @geekslides/engine — v2 entry point

export const VERSION = '2.0.0-alpha.0';

// Phase 1: Core data pipeline
export { loadConfig, DEFAULT_CONFIG } from './core/Config.ts';
export type { GeekSlidesConfig, SyncConfig, PluginsConfig } from './core/Config.ts';
export { parse } from './core/SlideParser.ts';
export type { SlideData } from './core/SlideParser.ts';
export { scope } from './core/StyleScoper.ts';

// Phase 2: Web Components
import { Slideshow as SlideshowImpl } from './core/Slideshow.ts';
import { Slide as SlideImpl } from './core/Slide.ts';
export { Slideshow } from './core/Slideshow.ts';
export type { SlideshowMode } from './core/Slideshow.ts';
export { Slide } from './core/Slide.ts';

// Register custom elements
function registerElements(): void {
  if (typeof customElements !== 'undefined') {
    if (!customElements.get('geek-slideshow')) {
      customElements.define('geek-slideshow', SlideshowImpl);
    }
    if (!customElements.get('geek-slide')) {
      customElements.define('geek-slide', SlideImpl);
    }
  }
}

registerElements();
