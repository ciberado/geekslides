# Rich Media Demo

GeekSlides supports YouTube, audio, video, and iframe embeds using simple
image-link syntax in markdown. Navigation, whiteboard, and sync all work
alongside media.

::: Notes
This deck demonstrates GeekSlides' rich media embedding system. Media is embedded
using standard markdown image-link syntax — the engine detects the URL type and
renders the appropriate player component. No HTML needed.
:::



[](#youtube-inline)

## YouTube — Inline

Use a YouTube URL as an image link. The video lazy-loads when the slide
becomes active and pauses on navigation.

![Big Buck Bunny](https://www.youtube.com/watch?v=aqz-KE-bpKQ)

::: Notes
Inline YouTube embedding uses standard markdown image syntax with a YouTube URL.
The `youtube-url` preprocessor detects the URL and replaces it with a `<geek-youtube>`
web component. Videos lazy-load when the slide becomes active and auto-pause on navigation.
:::



[](#youtube-cover,.mod-media-cover)

## YouTube — Full Cover

Add `.mod-media-cover` to the slide marker to fill the whole slide.
The nav arrows on the left/right let you move slides even when the
YouTube embed has keyboard focus.

![Big Buck Bunny](https://www.youtube.com/watch?v=aqz-KE-bpKQ)

::: Notes
Adding `.mod-media-cover` to the slide marker makes the video fill the entire slide.
The left/right navigation arrows remain visible on the edges so you can still
advance slides even when the YouTube player has captured keyboard focus.
:::



[](#youtube-short-url)

## YouTube — Short URL

Short `youtu.be` links work too:

![Cosmos Laundromat](https://youtu.be/Y-rmzh0PI3c)

::: Notes
Both full YouTube URLs (`youtube.com/watch?v=...`) and short URLs (`youtu.be/...`)
are supported. The preprocessor extracts the video ID from either format and
renders the same `<geek-youtube>` component.
:::



[](#audio)

## Audio Player

Point an image link at an audio file. A waveform visualiser appears above
the standard controls (Web Audio API for short files; CSS bars for long
ones or CORS-blocked sources).

![Sample audio](./assets/leberch-piano-calm-525211-by-leberch.mp3)

> Supported extensions: `.mp3` `.wav` `.ogg` `.flac` `.aac` `.m4a` `.opus` `.weba`

::: Notes
Audio files are rendered with a `<geek-audio>` component that includes a waveform
visualiser above standard playback controls. Short files use the Web Audio API for
real waveform rendering; long or CORS-blocked files fall back to CSS-animated bars.
:::



[](#video-inline)

## Video — Inline

`.mp4`, `.webm`, `.ogv`, and `.mov` URLs become native video players wrapped
in `<geek-video>` for pause-on-navigate and sync support:

![Sample video](./assets/video-by-eugenio-manghi.mp4)

::: Notes
Native video files (`.mp4`, `.webm`, `.ogv`, `.mov`) are wrapped in a `<geek-video>`
component that provides pause-on-navigate behaviour and sync support. The video
pauses automatically when you leave the slide and resumes when you return.
:::



[](#video-cover,.layout-cover.mod-media-cover)

# Video Background

Navigate with the **‹ ›** arrows even when the video has keyboard focus.

![Sample video](./assets/video-by-eugenio-manghi.mp4)

::: Notes
Combining `.layout-cover` with `.mod-media-cover` creates a full-bleed video
background with text overlaid. The navigation arrows remain accessible on the
slide edges for keyboard-free advancement.
:::



[](#iframe)

## Embedded Page

Link to a `.html`/`.htm` URL to embed another page. A click-to-activate
overlay prevents the iframe from stealing keyboard focus. Use the **‹ ›**
nav buttons on the slide edges when the iframe has focus.

![Interactive demo](./assets/demo.html)

Click the **overlay** to interact with the iframe · Press **Escape** to return navigation.

::: Notes
HTML/HTM URLs are embedded as iframes with a click-to-activate overlay that prevents
the iframe from stealing keyboard focus during navigation. Click the overlay to
interact with the embedded page; press Escape to return focus to slide navigation.
:::



[](#iframe-cover,.mod-media-cover)

## Iframe — Full Cover

Add `.mod-media-cover` to the slide marker for a full-bleed iframe:

![Interactive demo](./assets/demo.html)

::: Notes
`.mod-media-cover` on an iframe slide makes the embedded page fill the entire
slide area. This is useful for interactive demos, dashboards, or third-party
tools you want to show at full size during a presentation.
:::



[](#sync)

## Real-time Sync

Enable the `media-sync` feature in `config.json` (already on in this deck):

```json
{
  "features": ["whiteboard", "media-sync"]
}
```

- **Presenter** controls play/pause/seek.
- **Viewers** automatically follow — drift-corrected for network latency.
- Media pauses automatically when you navigate away from the slide.
- **Autoplay banner**: if the viewer's browser blocks autoplay, a banner
  appears — click it to enable audio/video.

::: Notes
The `media-sync` feature synchronizes media playback across all connected viewers
via Yjs CRDTs. The presenter controls play/pause/seek, and viewers follow
automatically with drift correction for network latency. Media also auto-pauses
when navigating away from the slide.
:::



[](#commands)

## Terminal Commands

Open the terminal (`T`) and type:

| Command | Description |
|---|---|
| `media-play` | Play media on the current slide |
| `media-pause` | Pause media on the current slide |
| `media-seek 30` | Seek to 30 seconds |

The **‹ ›** buttons on slide edges navigate even when media has keyboard focus.

::: Notes
Terminal commands (`media-play`, `media-pause`, `media-seek`) give programmatic
control over media on the current slide. These work in both NORMAL and TERMINAL
input modes. The edge navigation buttons ensure you can always advance slides
regardless of where keyboard focus currently sits.
:::



[](#config)

## Configuration Reference

Add media plugins to your deck's `config.json`:

```json
{
  "plugins": {
    "preprocessors": ["header", "youtube-url", "audio-url", "video-url", "iframe-url"],
    "processors": ["iframe", "video", "audio-url", "iframe-url"]
  },
  "features": ["whiteboard", "media-sync"]
}
```

| Plugin preprocessor | Detects | Emits |
||||
| `youtube-url` | YouTube / youtu.be URLs | `<geek-youtube>` |
| `audio-url` | `.mp3 .wav .ogg .flac .aac .m4a .opus .weba` | `<geek-audio>` |
| `video-url` | `.mp4 .webm .ogv .mov` | `<video controls>` |
| `iframe-url` | `.html .htm` | `<iframe data-src>` |

| Plugin processor | Does |
|||
| `audio-url` | Wraps bare `<audio>` tags in `<geek-audio>` |
| `iframe-url` | Adds click-to-activate overlay on iframes |

::: Notes
To enable media in your own deck, add the relevant preprocessors and processors
to `config.json`. Preprocessors detect URL patterns in markdown and emit the
appropriate web components; processors enhance the rendered DOM elements with
interactivity features like click-to-activate overlays.
:::
