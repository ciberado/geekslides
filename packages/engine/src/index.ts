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

// Phase 3: Plugin System
export { PluginManager } from './plugins/PluginManager.ts';
export type { Plugin, Preprocessor, Processor, ProcessorContext } from './plugins/types.ts';
export { isLocalPluginPath, isRemotePluginUrl, importRemotePlugin, extractPreprocessor, extractProcessor } from './plugins/local-plugin.ts';
export { headerPreprocessor } from './plugins/builtins/header-preprocessor.ts';
export { slideSourceNotesPreprocessor } from './plugins/builtins/slide-source-notes-preprocessor.ts';
export { iframeProcessor } from './plugins/builtins/iframe-processor.ts';
export { chartProcessor } from './plugins/builtins/chart-processor.ts';
export { videoProcessor } from './plugins/builtins/video-processor.ts';
export { mermaidProcessor } from './plugins/builtins/mermaid-processor.ts';

// Phase 6: Rich Components
import { ChartSlide as ChartSlideImpl } from './components/ChartSlide.ts';
import { VideoSlide as VideoSlideImpl } from './components/VideoSlide.ts';
import { Whiteboard as WhiteboardImpl } from './components/Whiteboard.ts';
import { WhiteboardToolbar as WhiteboardToolbarImpl } from './components/WhiteboardToolbar.ts';
export { ChartSlide } from './components/ChartSlide.ts';
export { VideoSlide } from './components/VideoSlide.ts';
export { Whiteboard } from './components/Whiteboard.ts';
export { WhiteboardToolbar } from './components/WhiteboardToolbar.ts';
export type { WhiteboardTool, ToolSettings } from './components/WhiteboardToolbar.ts';
export { TOOL_SETTINGS, PALETTE_COLORS } from './components/WhiteboardToolbar.ts';

// Phase 7: Speaker View
import { SpeakerView as SpeakerViewImpl } from './components/SpeakerView.ts';
export { SpeakerView } from './components/SpeakerView.ts';
export { SpeakerTimer } from './components/SpeakerTimer.ts';

// Phase 4: Input & Terminal
export { CommandSystem } from './input/CommandSystem.ts';
export type { Command } from './input/CommandSystem.ts';
export { KeyBindings } from './input/KeyBindings.ts';
export { TouchInput } from './input/TouchInput.ts';
export type { TouchInputOptions } from './input/TouchInput.ts';
import { Terminal as TerminalImpl } from './components/Terminal.ts';
export { Terminal } from './components/Terminal.ts';

// Phase 8: Print
export { renderPrint } from './print/PrintRenderer.ts';
export type { TemplateName, PrintOptions } from './print/PrintRenderer.ts';

// Phase 5: Sync
export { SyncManager } from './sync/SyncManager.ts';
export type { SyncTarget } from './sync/SyncManager.ts';
export { WhiteboardSync } from './sync/WhiteboardSync.ts';
export type { WhiteboardStroke } from './sync/types.ts';
export { uploadDeck, buildManifest, scanMarkdownImages, scanCssUrls, getProxyBaseUrl } from './sync/DeckUploader.ts';
export type { DeckManifest } from './sync/DeckUploader.ts';

// Phase 9: Feature System
export { FeatureManager, loadFeature } from './features/index.ts';
export type {
  Feature,
  FeatureContext,
  FeatureLifecycleEvents,
  FeatureSlideshowAPI,
  FeatureCommandAPI,
  FeatureSyncAPI,
  FeatureOutputAPI,
} from './features/index.ts';
export { whiteboardFeature } from './features/builtins/whiteboard-feature.ts';

// Register custom elements
function registerElements(): void {
  if (typeof customElements !== 'undefined') {
    if (!customElements.get('geek-slideshow')) {
      customElements.define('geek-slideshow', SlideshowImpl);
    }
    if (!customElements.get('geek-slide')) {
      customElements.define('geek-slide', SlideImpl);
    }
    if (!customElements.get('geek-speaker-view')) {
      customElements.define('geek-speaker-view', SpeakerViewImpl);
    }
    if (!customElements.get('geek-terminal')) {
      customElements.define('geek-terminal', TerminalImpl);
    }
    if (!customElements.get('geek-chart')) {
      customElements.define('geek-chart', ChartSlideImpl);
    }
    if (!customElements.get('geek-video')) {
      customElements.define('geek-video', VideoSlideImpl);
    }
    if (!customElements.get('geek-whiteboard')) {
      customElements.define('geek-whiteboard', WhiteboardImpl);
    }
    if (!customElements.get('geek-whiteboard-toolbar')) {
      customElements.define('geek-whiteboard-toolbar', WhiteboardToolbarImpl);
    }
  }
}

registerElements();
