# Embed Rich Media in Slides

Add YouTube videos, audio players, video files, and embedded pages to your
slides using ordinary image-link syntax. All media types lazy-load (no network
requests for off-screen slides), pause automatically on navigation, and
participate in the layout system including full-cover backgrounds.

---

## Enable the plugins

Add the media plugins to your deck's `config.json`:

```json
{
  "plugins": {
    "preprocessors": ["header", "youtube-url", "audio-url", "video-url", "iframe-url"],
    "processors": ["iframe", "video", "audio-url", "iframe-url"]
  },
  "features": ["whiteboard", "media-sync"]
}
```

You only need to list the types you use. The table below shows which plugins each media type requires:

| Media type | Preprocessor(s) | Processor(s) |
|---|---|---|
| YouTube | `youtube-url` | *(none)* |
| Audio | `audio-url` | `audio-url` |
| Video file | `video-url` | `video` |
| Embedded page | `iframe-url` | `iframe`, `iframe-url` |

> **Tip:** Keep `header` as the first preprocessor so slide separators and
> class/id markers are processed before media detection.

---

## Embed a YouTube video

Paste a YouTube URL where you'd normally put an image:

```markdown
![My Talk](https://www.youtube.com/watch?v=dQw4w9WgXcQ)
```

Supported URL formats:

| Format | Example |
|---|---|
| Watch page | `https://www.youtube.com/watch?v=ID` |
| Short link | `https://youtu.be/ID` |
| Embed URL | `https://www.youtube.com/embed/ID` |
| Mobile | `https://m.youtube.com/watch?v=ID` |

The video loads only when you reach the slide, and pauses automatically when
you navigate away.

### Full-cover YouTube background

Use `cover` as the alt text to fill the entire slide:

```markdown
![cover](https://youtu.be/dQw4w9WgXcQ)
```

This is equivalent to `mod-coverbg` for images — the video sits behind your
slide content at `position: absolute; inset: 0`.

> **CSP note:** Add `frame-src https://www.youtube.com;` to your
> Content-Security-Policy headers when serving the presentation from a server.

---

## Embed an audio player

Link to any common audio file extension:

```markdown
![Background track](https://example.com/music.mp3)
```

Supported extensions: `.mp3` `.wav` `.ogg` `.flac` `.aac` `.m4a` `.opus` `.weba`

The `<geek-audio>` component renders standard `<audio controls>` plus a
graphical visualiser above it:

- **Short files (≤ 5 minutes):** real-time frequency bars via the Web Audio API.
- **Long files or CORS-blocked sources:** animated CSS equaliser bars (decorative fallback).

Configure the threshold with a `data-vis-threshold` attribute (seconds, default `300`):

```html
<geek-audio src="./long-podcast.mp3" data-vis-threshold="60"></geek-audio>
```

---

## Embed a video file

Link to a video file by extension:

```markdown
![Demo clip](https://example.com/demo.mp4)
```

Supported extensions: `.mp4` `.webm` `.ogv` `.mov`

The `video-url` preprocessor emits a `<video controls>` element; the existing
`video` processor then wraps it in `<geek-video>`, giving you pause-on-navigate
and sync support.

---

## Embed a page in an iframe

Link to a `.html` or `.htm` URL:

```markdown
![Interactive demo](https://example.com/demo.html)
```

A transparent **click-to-activate overlay** appears over the iframe by default.
This prevents the iframe from capturing arrow-key and space events that would
otherwise break slide navigation.

- **Click** the overlay to interact with the embedded page.
- Press **Escape** to return keyboard focus to the browser (standard browser behaviour).
- The overlay restores itself whenever you return to the slide.

> **CSP note:** Add `frame-src <domain>;` for each external domain you embed.

---

## Layout options

Media elements are block-level and respond to the standard layout modifiers.

### Columns

```markdown
[](#layout-example,.mod-cols-2)

![First](https://youtu.be/AAA)

![Second](https://youtu.be/BBB)
```

### Full-cover video/audio

Any media type accepts `![cover](url)` to fill the slide as a background:

```markdown
![cover](https://example.com/bg.mp4)

# Slide title on top of the video
```

You can also apply the layout class `.mod-media-cover` to a slide to make all
media children cover the slide.

---

## Real-time sync across devices

Enable the `media-sync` feature (listed above in `config.json`). With a
running [y-websocket server](05-deploy-the-server.md), play/pause/seek actions
by the **presenter** are automatically mirrored to all **viewers** with
latency correction.

Viewers never need to interact with media controls — the presenter drives
everything.

---

## Troubleshooting

| Problem | Solution |
|---|---|
| YouTube video doesn't appear | Check that `youtube-url` is in `preprocessors` and the URL is a valid YouTube link |
| Audio shows CSS bars instead of waveform | File is either long (> 5 min) or CORS-blocked — this is expected fallback behaviour |
| Iframe steals arrow key focus | The overlay is not applied — verify `iframe-url` is in both `preprocessors` and `processors` |
| Video plays on the wrong slide | Confirm `video` is in `processors` so `<video>` is wrapped in `<geek-video>` |
| Sync not working | Verify `media-sync` is listed in `features` and a y-websocket server is running |

---

Next: [← Back to index](README.md)
