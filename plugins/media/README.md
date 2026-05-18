# media

Embeds YouTube videos, local/remote audio, local/remote video, and arbitrary HTML pages in slides. Adds cross-client playback sync so all viewers see the same state, plus terminal commands for controlling playback.

Depends on: [`core`](../core/README.md)

## What it provides

| Part | Name | Role |
|------|------|------|
| Preprocessor | `youtube-url` | `![alt](https://youtu.be/…)` → `<geek-youtube>` |
| Preprocessor | `audio-url` | `![alt](file.mp3)` → `<geek-audio>` |
| Preprocessor | `video-url` | `![alt](file.mp4)` → `<video>` (wrapped by `video` processor) |
| Preprocessor | `iframe-url` | `![alt](page.html)` → lazy-loading `<iframe>` |
| Processor | `video` | Wraps bare `<video>` elements in `<geek-video>` |
| Processor | `audio-url` | Wraps bare `<audio>` elements in `<geek-audio>` |
| Processor | `iframe-url` | Adds click-to-activate overlay on iframes to prevent keyboard capture |
| Feature | `media-sync` | Syncs play/pause/seek state across all connected clients via Yjs |

Also pulls in `core` (header preprocessor + iframe lazy-loader).

## Usage

```json
{ "plugins": ["media"] }
```

This replaces the old verbose form:

```json
{
  "plugins": {
    "preprocessors": ["header", "youtube-url", "audio-url", "video-url", "iframe-url"],
    "processors": ["iframe", "video", "audio-url", "iframe-url"]
  },
  "features": ["media-sync"]
}
```

## Markdown syntax

### YouTube

```markdown
![My talk](https://youtu.be/dQw4w9WgXcQ)
![](https://www.youtube.com/watch?v=dQw4w9WgXcQ)
```

Supported URL forms: `youtu.be/<id>`, `youtube.com/watch?v=<id>`, `youtube.com/embed/<id>`, `m.youtube.com/watch?v=<id>`.

### Video file

```markdown
![Demo clip](./assets/demo.mp4)
![](https://cdn.example.com/talk.webm)
```

Supported extensions: `.mp4`, `.webm`, `.ogv`, `.mov`.

### Audio file

```markdown
![Background music](./assets/intro.mp3)
![](https://cdn.example.com/podcast.ogg)
```

Supported extensions: `.mp3`, `.wav`, `.ogg`, `.flac`, `.aac`, `.m4a`, `.opus`, `.weba`.

### HTML page / iframe

```markdown
![Live demo](./demos/interactive.html)
![External](https://example.com/embed.html)
```

Supported extensions: `.html`, `.htm`.

## Terminal commands (registered by `media-sync`)

| Command | Description |
|---------|-------------|
| `media-play` | Play media on the current slide |
| `media-pause` | Pause media on the current slide |
| `media-seek <s>` | Seek to `<s>` seconds (e.g. `media-seek 30`) |

## Full-cover layout

Add `.mod-media-cover` to the slide marker for a full-bleed media embed:

```markdown
[](#my-slide,.mod-media-cover)
![My Talk](https://youtu.be/dQw4w9WgXcQ)
```
