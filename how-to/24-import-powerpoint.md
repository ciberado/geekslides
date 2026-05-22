# Import a PowerPoint Presentation

The Hub can convert `.pptx` files into fully functional GeekSlides decks at upload time.
Each slide is preserved as HTML with inline styles, so you get keyboard navigation, speaker
view, PDF export, and live sync — all without editing a line of markdown.

## What Gets Converted

| Feature | Preserved | Notes |
|---------|-----------|-------|
| Text content | ✅ | Selectable and searchable |
| Layout and positioning | ✅ | Absolute positioning, inline styles |
| Background colors | ✅ | Extracted per slide |
| Shapes and SVGs | ✅ | Inline SVG in the HTML |
| Embedded images | ✅ | Inlined as base64 data URIs |
| Slide title | ✅ | Auto-extracted from largest text on slide 1 |
| Animations / transitions | ❌ | Not supported by the conversion library |
| Embedded audio / video | ❌ | Not extracted |

## Prerequisites

- A running Hub ([Use the Hub](15-use-the-hub.md))
- A `.pptx` file to upload

## Upload a PPTX File

1. Open the Hub dashboard (`http://localhost:3001/hub/` in dev mode)
2. Click **New Presentation**
3. Click the **PPTX** tab in the upload panel
4. Optionally enter a title — if you leave it blank, the Hub extracts it automatically
   from the largest-font text on slide 1, or falls back to the filename
5. Click **Choose File** and select your `.pptx`
6. Click **Create** — the button label changes to **Converting…** while the server processes the file

Once done, the deck appears on your dashboard like any other presentation.

> **Tip:** For large decks with many embedded images, conversion can take a few seconds.
> The "Converting…" label confirms the server is still working — just wait for it to finish.

## What the Hub Creates

The conversion produces two files stored in the deck's internal git repository:

**`config.json`**
```json
{
  "title": "Your Presentation Title",
  "content": "slides.html",
  "aspectRatio": "16/9"
}
```

**`slides.html`** — one `<section>` per slide:
```html
<section style="width:960px; height:540px; background-color:#1B2A4A;">
  <div style="position:absolute; top:153px; left:43px; ...">
    <span style="color:#fff; font-size:40pt; font-family:Trebuchet MS; font-weight:bold;">
      Slide Title
    </span>
  </div>
  <!-- more absolutely-positioned elements -->
</section>

<section style="width:960px; height:540px; background-color:#F4F7F9;">
  <!-- slide 2 -->
</section>
```

All styles are inline — no shared CSS block, no class dependencies.

## Launch the Converted Deck

Click **Present** on the deck card. The converted deck behaves identically to any other
GeekSlides presentation:

- Arrow keys / swipe to navigate
- `S` to open speaker view (if you have a notes layout)
- `O` for the slide overview
- `T` to open the terminal
- PDF export via the CLI ([Export to PDF](06-export-to-pdf.md))
- Live sync with an audience ([Sync Your Presentation](12-sync-your-presentation.md))

## Replace a Converted Deck

To update a PPTX deck with a newer version of the file:

1. Open the deck on the dashboard
2. Click **Replace Files**
3. Select the **PPTX** tab and choose the updated `.pptx` file
4. Click **Update** — the server re-converts and commits the new `slides.html`

Previous versions are preserved in the internal git history.

## Troubleshooting

**Title shows "Untitled" after upload**

The title extractor looks for the largest `font-size` value in slide 1. If the first slide
contains only shapes or images with no text, extraction returns nothing. Enter the title
manually in the title field before uploading.

**Slide content looks cut off**

All slides are rendered at 960×540 px. If the source deck uses a non-standard slide size
(e.g. 4:3 or a custom size), content may overflow. Re-export the `.pptx` at 16:9
(1920×1080 or 960×540) from PowerPoint before uploading.

**Animations are missing**

This is a known limitation. `@jvmr/pptx-to-html` converts the final static state of each
slide. PowerPoint animations and transitions are not preserved.

---

← Previous: [Configure Custom Keybindings](23-configure-custom-keybindings.md) | [Back to index](README.md)
