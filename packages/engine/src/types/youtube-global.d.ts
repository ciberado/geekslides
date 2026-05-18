// Extend Window with the YouTube IFrame API callback used by YoutubeSlide.ts.
// window.YT itself is accessed via a Record<string,unknown> cast at runtime
// to avoid conflicts with @types/youtube UMD global declaration.
interface Window {
  onYouTubeIframeAPIReady: (() => void) | undefined;
}

