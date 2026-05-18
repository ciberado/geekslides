# Rich Media Demo

GeekSlides supports YouTube, audio, video, and iframe embeds using simple
image-link syntax in markdown. Navigation, whiteboard, and sync all work
alongside media.



[](#youtube-inline)

## YouTube — Inline

Use a YouTube URL as an image link. The video lazy-loads when the slide
becomes active and pauses on navigation.

![Big Buck Bunny](https://www.youtube.com/watch?v=aqz-KE-bpKQ)



[](#youtube-cover,.mod-media-cover)

## YouTube — Full Cover

Add `.mod-media-cover` to the slide marker to fill the whole slide.
The nav arrows on the left/right let you move slides even when the
YouTube embed has keyboard focus.

![Big Buck Bunny](https://www.youtube.com/watch?v=aqz-KE-bpKQ)



[](#youtube-short-url)

## YouTube — Short URL

Short `youtu.be` links work too:

![Cosmos Laundromat](https://youtu.be/Y-rmzh0PI3c)



[](#audio)

## Audio Player

Point an image link at an audio file. A waveform visualiser appears above
the standard controls (Web Audio API for short files; CSS bars for long
ones or CORS-blocked sources).

![Sample audio](./assets/leberch-piano-calm-525211-by-leberch.mp3)

> Supported extensions: `.mp3` `.wav` `.ogg` `.flac` `.aac` `.m4a` `.opus` `.weba`



[](#video-inline)

## Video — Inline

`.mp4`, `.webm`, `.ogv`, and `.mov` URLs become native video players wrapped
in `<geek-video>` for pause-on-navigate and sync support:

![Sample video](./assets/video-by-eugenio-manghi.mp4)



[](#iframe)

## Embedded Page

Link to a `.html`/`.htm` URL to embed another page. A click-to-activate
overlay prevents the iframe from stealing keyboard focus. Use the **‹ ›**
nav buttons on the slide edges when the iframe has focus.

![Interactive demo](./assets/demo.html)

Click the **overlay** to interact with the iframe · Press **Escape** to return navigation.



[](#iframe-cover,.mod-media-cover)

## Iframe — Full Cover

Add `.mod-media-cover` to the slide marker for a full-bleed iframe:

![Interactive demo](./assets/demo.html)



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



[](#commands)

## Terminal Commands

Open the terminal (`T`) and type:

| Command | Description |
|---|---|
| `media-play` | Play media on the current slide |
| `media-pause` | Pause media on the current slide |
| `media-seek 30` | Seek to 30 seconds |

The **‹ ›** buttons on slide edges navigate even when media has keyboard focus.



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
