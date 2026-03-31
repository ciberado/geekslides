# Geekslides — Architecture Documentation

Geekslides is a markdown-based presentation engine rendered as HTML with real-time
multi-instance synchronization over MQTT. Presentations are authored as plain markdown
files in standalone Git repos and loaded at runtime by the engine, which transforms
them into an interactive slideshow with partials, charts, video playback, whiteboards
and speaker notes.

## Monorepo layout

```
geekslides/
├── broker/          MQTT broker (Aedes) for real-time sync between instances
├── slides/          Browser-side presentation engine (Parcel-bundled)
├── demo/            Sample presentation (config.json + content.md + CSS + images)
├── tools/
│   ├── gs2pdf/      Playwright-based PDF exporter
│   ├── imageattr/   markdown-it image token processor (standalone utility)
│   ├── imageoptimizer/  sharp-based bulk image download+resize
│   └── pptx/        PowerPoint → geekslides markdown converter (Python)
├── Dockerfile       Multi-stage build (Node builder → Caddy alpine)
├── Caddyfile        Reverse proxy: /mqtt → broker, / → slides dev server
├── docker-compose.yml   Single-container deployment
└── package.json     Root orchestrator (install + concurrently start)
```

## Tech stack

| Layer | Technology |
|---|---|
| Slide engine | Vanilla JS (ES modules), no framework |
| Markdown → HTML | markdown-it + footnote/container/block-image plugins |
| Bundler | Parcel |
| Charts | Chart.js + tinycolor2 |
| Real-time sync | Paho MQTT (browser) → Aedes MQTT broker (Node) |
| Local sync | BroadcastChannel API |
| UI notifications | notie |
| Whiteboard | HTML5 Canvas 2D |
| PDF export | Playwright + PDFKit |
| Image optimization | sharp |
| Reverse proxy | Caddy 2 (automatic HTTPS) |
| Tests | Jest |

## Key architectural decisions

1. **Config-driven presentations** — each presentation is a repo with `config.json`
   declaring content files, CSS, resolution, preprocessors, processors, and scripts.
2. **DOM CustomEvent bus** — all module communication happens through `CustomEvent`
   objects dispatched on `document` or slide elements. No direct coupling between
   modules.
3. **Hub abstraction** — `LocalHub` (BroadcastChannel) and `MqttHub` (Paho MQTT)
   share the same interface (`connect`, `disconnect`, `subscribeListener`,
   `emitMessage`), making sync transport swappable at runtime.
4. **Processor pipeline** — markdown is transformed through a two-stage pipeline:
   *preprocessors* (text→text, before markdown-it) and *processors*
   (HTMLElement→void, after DOM insertion). Both are configurable in `config.json`.
5. **Invisible link encoding** — slide metadata (id, classes, background) is
   encoded as empty markdown links `[](.class#id,bgurl(...))` that are invisible
   when rendered by GitHub/GitLab but decoded into `<section>` attributes by the
   engine.

## Documentation index

| Document | Description |
|---|---|
| [architecture.md](architecture.md) | System-wide runtime architecture, event catalog, hub abstraction, processor pipeline |
| [slides-engine.md](slides-engine.md) | Deep dive into the `slides/` engine: every class, CSS architecture, tests |
| [broker.md](broker.md) | MQTT broker: auth model, room lifecycle, topic patterns |
| [tools.md](tools.md) | PDF exporter, image optimizer, image attr processor, PPTX converter |
| [presentation-format.md](presentation-format.md) | How to author presentations: config schema, markdown conventions, current workflow |
| [deployment.md](deployment.md) | Docker, Caddy, docker-compose, local dev setup |
