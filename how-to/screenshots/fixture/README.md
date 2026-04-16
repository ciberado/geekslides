[](#welcome)

# Welcome to GeekSlides

A markdown-first presentation engine for technical talks.

::: Notes
This is the opening slide. Mention that GeekSlides is designed
for developers who want to focus on content, not slide design.
:::

[](.partial#features)

## Key Features

- Write slides in Markdown
- Real-time sync across devices
- Speaker view with notes and timer
- Export to PDF in multiple formats
- Hot-reload during development

::: Notes
Walk through each feature briefly.
Emphasize the Markdown-first workflow — no GUI, no drag-and-drop.
:::

::: Details
GeekSlides is built on Web Components and uses Yjs for real-time
collaboration. The rendering engine supports Shadow DOM for style
isolation and scales slides to fit any viewport.
:::

[](#architecture)

## System Architecture

```
┌────────────────┐       ┌────────────────┐
│  Your Editor   │──────▶│  Vite + HMR    │
└────────────────┘       └───────┬────────┘
                                 │
                         ┌───────▼────────┐
                         │    Browser     │
                         │ (SPA + WebSocket)
                         └───────┬────────┘
                                 │
                         ┌───────▼────────┐
                         │  Yjs Server    │
                         │    (sync)      │
                         └────────────────┘
```

::: Notes
Explain the three components: editor, browser, sync server.
The dev server watches files and pushes changes via HMR.
:::

[](#styling)

## Custom Styling

Use CSS variables and per-slide styles to make your deck unique.

<style>
h2 { color: #e94560; }
section.content {
  background: linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%);
  color: #f0f0f0;
}
code { color: #4ecdc4; }
</style>

::: Notes
This slide demonstrates per-slide custom CSS.
The gradient background and colored heading are scoped to this slide only.
:::

[](#closing)

## Start Building

```bash
npx geekslides create --title "My Talk"
npx geekslides dev --config my-talk/config.json
```

Open your editor, write Markdown, present.
