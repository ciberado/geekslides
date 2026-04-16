# Export to PDF

GeekSlides uses Playwright and headless Chromium to render your slides as PDF. Four export formats cover different use cases — from clean slide decks to detailed reference documents.

## Prerequisites

Playwright and its browsers are included in the project dependencies. If you haven't already:

```bash
npm ci
npx playwright install chromium
```

## Basic export

```bash
npx geekslides pdf --config my-talk/config.json
```

This generates `my-talk.pdf` with one slide per landscape page at 1920×1080 resolution.

## Export formats

Use `--format` to choose the output layout:

### `slides` (default)

One slide per page. Landscape orientation. What you see on screen is what you get in the PDF.

```bash
npx geekslides pdf --config my-talk/config.json --format slides
```

Best for: sharing slide decks, archiving presentations.

### `slides-notes`

Each page shows the slide as a thumbnail with your speaker notes below it. A4 portrait layout.

```bash
npx geekslides pdf --config my-talk/config.json --format slides-notes
```

Best for: printed handouts for workshops, personal reference during a talk.

### `slides-details`

Like `slides-notes`, but uses the `Details` block instead of speaker notes. A4 portrait.

```bash
npx geekslides pdf --config my-talk/config.json --format slides-details
```

Best for: technical documentation, post-talk reference material with deep explanations.

### `book`

A flowing document with slide images and notes formatted as continuous prose. A4 portrait with page breaks at natural boundaries.

```bash
npx geekslides pdf --config my-talk/config.json --format book
```

Best for: turning a presentation into a readable document or study material.

## Options

| Flag | Default | Description |
|---|---|---|
| `--config` | (required) | Path to the deck's `config.json` |
| `--format` | `slides` | Export format: `slides`, `slides-notes`, `slides-details`, `book` |
| `--out` | `<deck-name>.pdf` | Output file path |

## How it works

Under the hood, the `pdf` command:

1. Starts an ephemeral Vite server to serve your deck
2. Launches headless Chromium via Playwright
3. Navigates each slide, revealing all partials
4. Takes a 1920×1080 screenshot of each slide
5. Assembles the screenshots into a PDF according to the chosen format
6. Shuts everything down

All partials are expanded in the export — every reveal step is captured. Assets are waited on to ensure images and fonts are fully loaded.

## Writing content for different formats

Structure your slides to take advantage of all three content layers:

```markdown
[](#scaling)
## Auto Scaling

Scale your fleet automatically based on demand.

::: Notes
Remind the audience about the CloudWatch alarm setup 
we did in the previous section. 
Walk through the scaling policy configuration step by step.
:::

::: Details
### How Auto Scaling Works

Auto Scaling Groups monitor CloudWatch metrics (CPU, memory, 
custom metrics) and adjust the number of EC2 instances to 
maintain the target utilization.

**Key configuration:**
- **Minimum capacity**: Floor for the group size
- **Desired capacity**: Normal operating count
- **Maximum capacity**: Ceiling to control costs

Scaling policies can be:
1. **Target tracking** — maintain a metric at a target value
2. **Step scaling** — add/remove based on alarm thresholds
3. **Predictive** — ML-based forecasting from historical patterns
:::
```

With this structure:
- `slides` → Shows the slide content only
- `slides-notes` → Shows the slide + the `Notes` block
- `slides-details` → Shows the slide + the `Details` block
- `book` → Flows everything into a continuous document

## Tips

- **Check your deck first.** Run `npx geekslides dev` and review all slides before exporting. What shows on screen is what ends up in the PDF.
- **Image resolution matters.** Use high-resolution images (at least 1920px wide for full-bleed backgrounds). The export renders at 1920×1080.
- **Custom fonts.** If your CSS loads web fonts, they'll be included in the export — Playwright waits for all assets to load.
- **Large decks take time.** Each slide requires a screenshot. A 50-slide deck might take 30–60 seconds depending on content complexity.

---

← [Deploy the Server](05-deploy-the-server.md) | [Back to index](README.md)
