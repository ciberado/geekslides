# Rich Media Support

GeekSlides v2 supports embedded YouTube videos, audio players, video files,
and iframes via ergonomic markdown image-link syntax. Media is lazy-loaded,
navigation-safe, layout-aware, and optionally synchronised across presenter
and viewer sessions.

---

## Overview

| Media type | Markdown syntax | Component |
|---|---|---|
| YouTube | `![alt](https://youtu.be/ID)` or `watch?v=` / `embed/` | `<geek-youtube>` |
| Audio | `![alt](./audio.mp3)` (any common extension) | `<geek-audio>` |
| Video file | `![alt](./video.mp4)` | `<geek-video>` (existing) |
| Iframe | `![alt](./page.html)` or `.htm` | `<iframe data-src>` |

---

## Architecture

### Plugin layer (preprocessors + processors)

Each media type is an optional *Plugin* (see `packages/engine/src/plugins/types.ts`) loaded by name from `config.json`.

**Preprocessors** run before markdown-it and rewrite image-link syntax into raw HTML:

| Plugin | File | Transforms |
|---|---|---|
| `youtube-url` | `youtube-url-plugin.ts` | YouTube URLs → `<geek-youtube data-id>` |
| `audio-url` | `audio-url-plugin.ts` | Audio extensions → `<geek-audio src>` |
| `video-url` | `video-url-plugin.ts` | Video extensions → `<video controls>` |
| `iframe-url` | `iframe-url-plugin.ts` | `.html`/`.htm` → `<div class=gs-iframe-wrapper><iframe data-src>` |

**Processors** run after HTML parsing on each slide's DOM:

| Plugin | Effect |
|---|---|
| `audio-url` | Wraps bare `<audio>` elements in `<geek-audio>` |
| `iframe-url` | Adds click-to-activate overlay to every `.gs-iframe-wrapper` iframe |

The existing `video` and `iframe` processors handle wrapping `<video>` → `<geek-video>` and activating `data-src` iframes on slide entry.

### Web Components

#### `<geek-youtube>` (`YoutubeSlide.ts`)

- Uses the [YouTube IFrame API](https://developers.google.com/youtube/iframe_api_reference) loaded asynchronously via script tag.
- A shared `ytReady: Promise<void>` singleton prevents loading the API script twice across multiple components on the same page.
- Lazy-loads the player (network request deferred) until the parent `<geek-slide>` receives the `active` attribute.
- Pauses on slide leave.
- Supports `cover` attribute for backward compatibility. Full-slide cover is applied via the `mod-media-cover` modifier class in `layouts.css` (CSS injection approach — no JS class detection needed).
- Dispatches `geek:media:state` `CustomEvent` (bubbles, composed) on play/pause/state change.
- Exposes `applyRemoteState(state: MediaState)` for sync.

**Window access pattern:** The `YT` global is a UMD library injected at runtime. We avoid TypeScript's UMD global restrictions by defining a minimal local `YouTubeAPI` interface and accessing `window` via a `Record<string, unknown>` cast in `getYouTubeAPI()`.

#### `<geek-audio>` (`AudioSlide.ts`)

- Renders `<audio controls>` plus a Canvas visualiser inside Shadow DOM.
- **Visualiser strategy:**
  - On `loadedmetadata`: if `audio.duration > threshold` (default 300 s, configurable via `data-vis-threshold`), sets `#useCssVisualiser = true`.
  - On play → `#setupWebAudio()`: creates `AudioContext` + `AnalyserNode` for real-time frequency bars. If the audio is CORS-blocked (`createMediaElementSource` throws), falls back to CSS animated bars silently.
  - CSS bars use `@keyframes gs-eq-bounce` with per-bar animation-duration variation.
- Pauses and stops the visualiser on slide leave.
- Dispatches `geek:media:state` and exposes `applyRemoteState()`.

#### `<geek-video>` (`VideoSlide.ts`) — extended

- Adds `#observeSlide()` (MutationObserver on the `<geek-slide>` host) to pause on slide leave.
- Adds `#wireEvents()` to dispatch `geek:media:state` on play/pause/seeked.
- Adds `applyRemoteState(state: MediaState)` for sync.

### Iframe overlay (`iframeOverlayProcessor`)

Iframes capture keyboard events when focused, which breaks slide navigation (arrow keys, space).

The `iframe-url` plugin's processor appends a transparent `div.gs-iframe-overlay` in front of each iframe wrapper. The overlay:

1. Forwards navigation keys (`ArrowLeft/Right/Up/Down`, `Space`, `PageUp/Down`) to `document` so slides keep navigating.
2. Removes itself on click, letting the user interact with the iframe.
3. Restores itself when the slide becomes inactive (via `MutationObserver` on the host `<geek-slide>`), so the next visit starts protected again.

Pressing `Escape` while an iframe is focused returns keyboard control to the browser (standard browser behaviour; does not require custom code).

### `iframe-processor` fix

The existing `iframe-processor` had a bug: it observed `section.content` (the processor's `slideElement` argument) for the `active` attribute, but `active` is set on `<geek-slide>` (the shadow host). Fixed by:

```typescript
const root = slideElement.getRootNode();
const hostSlide = root instanceof ShadowRoot ? root.host : slideElement;
new MutationObserver(...).observe(hostSlide, { attributes: true, attributeFilter: ['active'] });
```

The same pattern is used in all new processors and components.

### Media sync Feature (`media-sync-feature.ts`)

Sync is handled by a **Feature** (not a preprocessor/processor), because Features get lifecycle events and a scoped Yjs `getSharedMap()`.

**Feature ID:** `media-sync`

**Presenter flow:**
1. Listens for `geek:media:state` events (bubbling, composed) on `document`.
2. Finds the `<geek-slide>` ancestor of the event target.
3. Looks up the slide's index in the slideshow.
4. Writes a `MediaState` entry `{ playing, currentTime, timestamp }` to the shared Yjs map keyed by slide index.

**Viewer flow:**
1. Observes the shared Yjs map.
2. On change: resolves the slide by index, finds `<geek-youtube>` / `<geek-audio>` / `<geek-video>` inside it, calls `applyRemoteState(state)`.
3. Drift correction: `targetTime = state.currentTime + (state.playing ? elapsed : 0)` where `elapsed = (Date.now() - state.timestamp) / 1000`.

**Lifecycle:**
- On `slide:leave`: pauses all media components in the slide being left (presenter and viewer alike).

**Commands registered:**
- `media-play` (category: `media`)
- `media-pause` (category: `media`)
- `media-seek` (category: `media`)

---

## Layout integration

Media components participate in the existing layout system:

| Variant | How to use |
|---|---|
| Inline (default) | `![alt](url)` — block, `width: 100%`, `height: auto` |
| Full-cover | Add `.mod-media-cover` to the slide marker — `position: absolute; inset: 0` via injected CSS |
| With columns | Use `mod-cols-2` / `mod-cols-4` — media fills the column like `<img>` |

### CSS injection mechanism

`layouts.css` is injected into every `<geek-slide>`'s shadow DOM via `Slideshow.injectStyles()` /
`Slide.injectStyles()`. This means `section.content.mod-media-cover geek-youtube { ... }` selectors
in `layouts.css` **do** work inside slide shadow roots — no JS class detection is needed.
The slide marker class is applied to both the `<geek-slide>` host and `section.content` by `Slide.loadContent()`.

CSS is in `packages/cli/src/templates/layouts.css` (media section at the bottom).

---

## Configuration

```json
{
  "plugins": {
    "preprocessors": ["header", "youtube-url", "audio-url", "video-url", "iframe-url"],
    "processors": ["iframe", "video", "audio-url", "iframe-url"]
  },
  "features": ["whiteboard", "media-sync"]
}
```

All four media preprocessors and both processors are **opt-in** — they don't activate unless listed in `config.json`.

The `media-sync` feature is also opt-in and requires a Yjs websocket server.

---

## Security considerations

- YouTube embeds load from `www.youtube.com` (or `www.youtube-nocookie.com` if you set that on the element). Add `frame-src https://www.youtube.com;` to your CSP.
- Iframe embeds: add `frame-src <domain>;` for each external origin.
- Audio/video URLs are passed through unchanged — same-origin or CORS-enabled sources work natively; CORS-blocked audio gracefully falls back to CSS visualiser.

---

## Files

| File | Purpose |
|---|---|
| `packages/engine/src/plugins/builtins/youtube-url-plugin.ts` | YouTube URL preprocessor |
| `packages/engine/src/plugins/builtins/audio-url-plugin.ts` | Audio URL preprocessor + audio processor |
| `packages/engine/src/plugins/builtins/video-url-plugin.ts` | Video URL preprocessor |
| `packages/engine/src/plugins/builtins/iframe-url-plugin.ts` | Iframe URL preprocessor + overlay processor |
| `packages/engine/src/components/YoutubeSlide.ts` | `<geek-youtube>` web component |
| `packages/engine/src/components/AudioSlide.ts` | `<geek-audio>` web component |
| `packages/engine/src/components/VideoSlide.ts` | `<geek-video>` (extended) |
| `packages/engine/src/features/builtins/media-sync-feature.ts` | `media-sync` Feature |
| `packages/engine/src/plugins/builtins/iframe-processor.ts` | Fixed to observe shadow host |
| `packages/engine/src/sync/types.ts` | `MediaState` interface |
| `packages/cli/src/templates/layouts.css` | Media CSS (appended section) |
| `packages/engine/tests/unit/media-preprocessors.test.ts` | Unit tests for all preprocessors |
| `decks/media-demo/` | Demo deck |
