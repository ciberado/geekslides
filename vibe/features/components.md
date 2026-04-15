# Web Components Architecture

## Overview

geekslides v2 uses native Web Components (Custom Elements + Shadow DOM) for slide
rendering and interactive features. The implementation favors small focused components
and orchestration from the root slideshow element.

## Implemented Components

| Component | Purpose |
|---|---|
| `<geek-slideshow>` | Root controller for slide state, navigation, scaling, and mode |
| `<geek-slide>` | One rendered slide with scoped styles and partial reveal support |
| `<geek-terminal>` | Terminal-like command prompt opened with `t` |
| `<geek-whiteboard>` | Canvas overlay for drawing and sync-ready stroke events |
| `<geek-chart>` | Table-to-chart rendering component |
| `<geek-video>` | Video wrapper with partial-driven timestamp seeking |
| `<geek-speaker-view>` | Separate speaker UI for current/next slide, notes, and controls |

## Component Hierarchy

```
<geek-slideshow>
├── <geek-slide> x N
│   ├── slide HTML (from markdown)
│   ├── scoped style injection
│   └── optional rich elements (<geek-chart>, <geek-video>)
├── <geek-whiteboard> (overlay, hidden by default)
└── <geek-terminal> (overlay prompt, hidden by default)

Separate route/tab:
<geek-speaker-view>
```

## Rendering Strategy

### Browser Rendering (Shadow DOM on)

- `geek-slideshow` owns viewport layout and scaling (`transform: scale()` with contain behavior).
- Each `geek-slide` hosts content in Shadow DOM and keeps transitions isolated.
- External deck CSS is injected per slide and adapted for shadow context (`body` selectors rewritten to `:host`).
- Font `@import` rules are hoisted to document head to ensure consistent font loading.

### Print Rendering (Shadow DOM off)

Print output is generated as flat HTML (no custom-element/shadow dependencies) by the print renderer.
This supports browser-backed PDF export for four formats:

- slides
- slides + notes
- slides + details
- book

## Command UI

The command workflow is terminal-based:

- Press `t` to open `<geek-terminal>`.
- Type command (`help`, `goto 8`, `speaker`, `whiteboard`, `sync`, `follow`, `emit`).
- Press Enter to execute; Esc closes the terminal.
- Navigation keys remain direct and always available in normal mode.

## Smartphone Support

Mobile follow mode is supported in browser:

- Swipe/tap navigation through `TouchInput`
- Long press opens terminal
- Room sync keeps audience clients following presenter state

The mobile model is interaction-first (touch + sync), not a reduced desktop clone.

## Registration

Component registration is centralized in the engine entrypoint:

- `packages/engine/src/index.ts`

Registered tags include:

- `geek-slideshow`
- `geek-slide`
- `geek-terminal`
- `geek-whiteboard`
- `geek-chart`
- `geek-video`
- `geek-speaker-view`

## Notes On Slide Styles

Per-slide style blocks are supported and scoped by parser/scoper flow. The current engine also supports legacy deck CSS patterns used by existing v1-style decks.
