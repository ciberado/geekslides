# System Architecture

## Runtime topology

```
┌────────────────────────────────────────────────────────────────────┐
│  Browser (presenter)                                               │
│                                                                    │
│  ┌──────────┐  CustomEvents  ┌───────────────────┐                 │
│  │UserInput  │──────────────▶│SlideshowController │                │
│  │Devices    │               │  (orchestrator)    │                 │
│  └──────────┘               │                    │                 │
│                              │  preprocessors     │                 │
│  ┌──────────┐               │  MarkdownToHTML    │                 │
│  │ Toolbar  │──CustomEvents─▶│  processors        │                 │
│  └──────────┘               │  CSS/JS loading    │                 │
│                              └────────┬───────────┘                │
│                                       │ manages                    │
│                              ┌────────▼───────────┐                │
│                              │    Slideshow        │                │
│                              │  (DOM engine)       │                │
│                              │  slides, partials,  │                │
│                              │  aspect ratio,      │                │
│                              │  scaling            │                │
│                              └────────────────────┘                │
│                                                                    │
│  ┌──────────────┐    ┌────────────┐    ┌─────────────────┐        │
│  │SyncController │───▶│ LocalHub   │    │ GlobalWhiteboard│        │
│  │               │    │(Broadcast  │    │ WhiteboardLayer │        │
│  │               │    │ Channel)   │    └─────────────────┘        │
│  │               │───▶│ MqttHub    │                               │
│  └──────────────┘    │(Paho MQTT) │                               │
│                       └─────┬──────┘                               │
│                             │ WSS                                  │
└─────────────────────────────┼──────────────────────────────────────┘
                              │
                    ┌─────────▼──────────┐
                    │   Caddy reverse    │
                    │   proxy            │
                    │   :80/:443         │
                    │                    │
                    │  /mqtt → :8883     │
                    │  /     → :1234     │
                    │  /slides → static  │
                    └─────────┬──────────┘
                              │
                    ┌─────────▼──────────┐
                    │  Aedes MQTT broker │
                    │  TCP :1883         │
                    │  WS  :8883         │
                    │  WSS :8443 (opt.)  │
                    │                    │
                    │  rooms/<name>/     │
                    │    state/slides    │
                    │    state/slides/   │
                    │      whiteboard    │
                    │    config/password │
                    └────────────────────┘
```

## DOM CustomEvent bus

All inter-module communication uses `CustomEvent` objects dispatched on `document`
(global) or on individual slide `<section>` elements. This decouples all modules —
no class imports another to call methods; they listen for and dispatch events.

### Complete event catalog

#### Navigation events (dispatched on `document` or active slide element)

| Event | Source | Listener | Payload |
|---|---|---|---|
| `nextSlide` | `UserInputDevices`, `Toolbar`, iframe button | `SlideshowController` | — |
| `previousSlide` | `UserInputDevices` | `SlideshowController` | — |
| `toggleSpeakerView` | `UserInputDevices` | `SlideshowController` | — |
| `changeAspectRatio` | `UserInputDevices` | `SlideshowController` | — |
| `cloneWindow` | `UserInputDevices` | `SlideshowController` | — |
| `openSlides` | `UserInputDevices` | `SlideshowController` | — |

#### Lifecycle events

| Event | Source | Listener | Payload |
|---|---|---|---|
| `slideShown` | `Slideshow.fireSlideShown()` | `SlideshowController`, `SyncController` | `{slideshow, currentSlideElem, currentSlideId, currentSlideIndex, lastPartialShownIndex}` |
| `partialShown` | `Slideshow.firePartialShown()` | `SlideshowController`, `SyncController`, `ChartSlideController`, `VideoSlideController` | `{slideshow, currentSlideElem, currentSlideIndex, lastPartialShownElem, lastPartialShownIndex}` |
| `slideshowLoaded` | `SlideshowController` | `SyncController` | `{newBaseUrl, currentSlideIndex}` |
| `userOpenedSlides` | `SlideshowController` | `SyncController` | `{baseUrl}` |

#### Sync events

| Event | Source | Listener | Payload |
|---|---|---|---|
| `joinRoom` | `UserInputDevices`, `Toolbar` | `SyncController` | — |
| `toggleEmission` | `UserInputDevices`, `Toolbar` | `SyncController` | — |

#### Whiteboard events

| Event | Source | Listener | Payload |
|---|---|---|---|
| `toggleGlobalWhiteboard` | `UserInputDevices`, `Toolbar` | `GlobalWhiteboard` | — |
| `startWhiteboardStroke` | `WhiteboardLayer` | `SyncController` | `{source, x, y, color, penSize, opacity}` |
| `whiteboardStroke` | `WhiteboardLayer` | `SyncController` | `{source, x, y}` |
| `endWhiteboardStroke` | `WhiteboardLayer` | `SyncController` | `{source}` |
| `clearWhiteboard` | `WhiteboardLayer` | `SyncController` | `{source}` |
| `whiteboardShown` | `GlobalWhiteboard` | `SyncController` | `{source}` |
| `whiteboardHidden` | `GlobalWhiteboard` | `SyncController` | `{source}` |
| `changeWhiteboardPen` | `Toolbar` | `WhiteboardLayer` | `{color?, opacity?, penSize?}` |
| `clearVisibleWhiteboard` | `Toolbar` | `WhiteboardLayer` | — |
| `translucentWhiteboard` | `UserInputDevices` | `WhiteboardLayer` | — |
| `remoteWhiteboard` | `SyncController` | `WhiteboardLayer`, `GlobalWhiteboard` | `{action, ...detail}` |

### Event flow example: pressing right arrow

```
KeyDown(39) → UserInputDevices
  → dispatches CustomEvent("nextSlide") on active slide element
    → SlideshowController listener calls slideshow.gotoNextSlide()
      → Slideshow moves .active class, fires CustomEvent("slideShown")
        → SlideshowController updates location.hash
        → SyncController reads event, calls hub.emitMessage("slides", payload)
          → MqttHub publishes to rooms/<room>/state/slides
            → Remote browsers receive message
              → Remote SyncController calls slideshow.gotoSlideIndex()
```

## Hub abstraction

Both hubs implement the same contract:

```
interface Hub {
  connect(): Promise<void>
  disconnect(): Promise<void>
  subscribeListener(topic: string, listener: (payload: string) => void): void
  emitMessage(topic: string, body: object, qos?: number, retained?: boolean): void
}
```

### LocalHub

Uses the browser's `BroadcastChannel` API with a channel name derived from
`location.origin + location.port + location.pathname`. Messages stay within same-origin
windows/tabs — no network involved. Used by default.

### MqttHub

Wraps the Eclipse Paho MQTT client. Connects over WSS to the Aedes broker. Topic
names are automatically namespaced to `rooms/<roomName>/state/<subtopic>`. Supports
QoS and retained messages. Used after the user joins a room (`j` key or Toolbar
"Join").

### SyncController: bridging events ↔ hub

`SyncController` listens to DOM events and publishes to the active hub. It also
subscribes to hub topics and translates incoming messages back into DOM actions.

Key mechanism — **`desiredLocation` deadlock prevention**: when processing an incoming
`location` message, `desiredLocation` is set to non-null. While non-null,
`#dispatchCurrentSlide()` is a no-op, preventing a feedback loop where local
navigation events triggered by `gotoSlideIndex()` would be re-published back to the
hub.

Message actions exchanged over the `slides` topic:

| `action` | Direction | Purpose |
|---|---|---|
| `control` | outbound | Notifies other instances that this one is taking control |
| `location` | bidirectional | Current slide index + partial index |
| `slideShowLoaded` | bidirectional | A new presentation URL was loaded (retained) |

## Processor pipeline

The transformation from a raw markdown URL to an interactive slideshow involves:

```
  config.json
       │
       ▼
  Fetch markdown file(s)                       ← config.content (string or array)
       │
       ▼
  ┌─────────────────────────────┐
  │  PREPROCESSORS (text → text)│               ← config.preprocessors[]
  │                             │
  │  headerPreprocessor         │  Auto-inserts []() anchors above ## headers
  │  threeEmptyLinesSlicerPre.. │  Converts 3 blank lines into slide separators
  │  emptyLineSeparatorPre..    │  Inserts <!-- --> to preserve blank lines
  │  (custom via config)        │
  └──────────┬──────────────────┘
             │
             ▼
  ┌─────────────────────────────┐
  │  MarkdownToHTML.convert()   │
  │                             │
  │  1. markdown-it render      │  With footnote, container, block-image plugins
  │  2. Custom image renderer   │  Prepends baseUrl, converts .mp4→<video>
  │  3. Custom link renderer    │  Prepends baseUrl for media links
  │  4. Custom text renderer    │  Wraps text nodes in <span>
  │  5. replaceEmptyLinks       │  [](.class#id,...) → <section id class data-*>
  │     WithSections()          │
  └──────────┬──────────────────┘
             │
             ▼
  innerHTML = html
             │
             ▼
  ┌─────────────────────────────┐
  │  PROCESSORS (elem → void)   │               ← config.processors[]
  │                             │
  │  hiddenSlidesProcessor      │  Removes .hidden slides from DOM
  │  bgUrlProcessor             │  data-bgurl → background CSS
  │  bgColorProcessor           │  data-bgcolor → background-color CSS
  │  footnotesProcessor         │  Moves footnote refs into .slide-notes
  │  chartProcessor             │  data-chart → ChartSlideController
  │  iframeProcessor            │  data-iframe → <iframe> injection
  │  partializeProcessor        │  Makes slides with lists into .partial
  │  (custom via config)        │
  └──────────┬──────────────────┘
             │
             ▼
  Set aspect ratio, init whiteboards, init video slides
             │
             ▼
  Dispatch "slideshowLoaded" event
```

## config.json schema

```jsonc
{
  "content": "content.md",          // string or string[] — markdown file paths
  "styles": ["css/theme.css"],      // string or string[] — CSS files to load
  "resolution": "16:9",             // "16:9", "4:3", "1:1", or "WxH" (e.g. "1920x1080")
  "preprocessors": [                // string[] — function names evaluated at runtime
    "headerPreprocessor"
  ],
  "processors": [                   // string[] — function names evaluated at runtime
    "hiddenSlidesProcessor",
    "bgUrlProcessor"
  ],
  "script": "",                     // string — single JS module to load
  "scripts": [],                    // string[] — JS modules to load
  "liveReload": false,              // bool — poll content file for changes (1s interval)
  "slideWhiteBoards": true          // bool — attach WhiteboardLayer canvas to each slide
}
```

All paths are relative to the presentation's base URL unless they start with `http`.
