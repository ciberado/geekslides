/**
 * Static scaffold assets written to every new deck, regardless of whether
 * it is created from the built-in template or a GitHub deck template.
 *
 * Each export is the literal file content that will be written to disk.
 */

/** .gitignore placed at the deck root. */
export const GITIGNORE_CONTENT = `# macOS
.DS_Store

# Editor
.vscode/
.idea/
*.swp
*.swo

# Logs
*.log

# Node (if you add local tooling)
node_modules/

# GeekSlides build artefacts
dist/
`;

/**
 * AGENTS.md placed at the deck root.
 * The placeholder %%TITLE%% is replaced with the deck title at scaffold time.
 */
export const AGENTS_MD_TEMPLATE = `# Deck: %%TITLE%%

## Structure

\`\`\`
%%DIR%%/
├── config.json          # Deck metadata (title, content, styles, plugins)
├── README.md            # Slide content — Markdown with layout markers
├── css/
│   ├── layouts.css      # Structural layout rules (usually unchanged)
│   ├── theme-*.css      # Colour and typography theme
│   └── local.css        # Per-deck style overrides
├── images/              # Image assets
└── .copilot/
    └── skills/          # Copilot skill scripts for common tasks
\`\`\`

## Editing slides

Slides are written in Markdown. Each slide begins with an empty Markdown link
(**slide marker**) that carries layout classes, an id, and optional metadata:

\`\`\`markdown
[](.layout-two-col#my-slide)

### My Slide Title

Left column content here.

#### Right Column Heading

Right column content here.
\`\`\`

Marker anatomy: \`[](.class1.class2#id,bgurl(img.jpg),bgcolor(#fff))\`

- **Classes** (e.g. \`.layout-title\`, \`.mod-coverbg\`) — layout and modifier.
- **id** — optional anchor used in speaker-view URLs.
- **bgurl / bgcolor** — optional background image or solid colour.

See \`README.md\` for a live example of every layout, and
[GeekSlides layouts docs](https://github.com/ciberado/geekslides/blob/main/how-to/07-style-your-deck.md)
for the full reference.

## Common layouts

| Class | Purpose |
|---|---|
| \`.layout-title\` | Hero/title slide |
| \`.layout-cover\` | Full-bleed background cover |
| \`.layout-section\` | Chapter divider |
| \`.layout-two-col\` | Two-column content |
| \`.layout-img-text\` | Image left, text right |
| \`.layout-three-col\` | Three-column cards |
| \`.layout-big-stat\` | Giant number or pull quote |
| \`.layout-timeline\` | Horizontal process steps |
| \`.layout-chart\` | Table as a data chart |
| \`.layout-team\` | Photo grid for team slides |
| \`.layout-grid\` | Responsive image gallery |
| \`.layout-blank\` | Empty canvas (whiteboard) |

## Dev server

\`\`\`bash
npx geekslides dev --config config.json
\`\`\`

Open <http://localhost:5173> to preview the deck. Changes hot-reload instantly.

## Export to PDF

\`\`\`bash
npx geekslides pdf --config config.json --output slides.pdf
\`\`\`

## Skills

Use the Copilot skills in \`.copilot/skills/\` for common tasks:

| Skill | Trigger phrase |
|---|---|
| \`add-slide\` | "add a new slide" |
| \`export-pdf\` | "export to pdf" |
| \`update-theme\` | "change the theme" |
`;

/** .copilot/skills/add-slide.md */
export const SKILL_ADD_SLIDE = `---
description: >
  Add a new slide to the deck. Appends a slide marker and content block to
  README.md. Use when the user asks to add a slide, create a new section, or
  insert content into the presentation.
---

## Add a new slide

1. Open \`README.md\` (the \`content\` field in \`config.json\` tells you the file name).
2. Locate the position in the file where the new slide should appear.
3. Insert a slide marker followed by the slide content:

\`\`\`markdown
[](.layout-two-col#new-slide-id)

### Slide Title

First column content.

#### Second Column

Second column content.
\`\`\`

4. Replace the placeholder layout class with the appropriate one for the content type.
   Refer to the layout table in \`AGENTS.md\` or ask the user what layout they want.
5. Confirm the change by briefly describing the slide added.

### Choosing the right layout

- Single heading + body text → no layout class (default)
- Hero / opening slide → \`.layout-title\`
- Chapter divider → \`.layout-section\`
- Two pieces of content side by side → \`.layout-two-col\`
- Image with text explanation → \`.layout-img-text\`
- Statistics or pull quote → \`.layout-big-stat\`
- Team photos → \`.layout-team\`
- Image gallery → \`.layout-grid\`
`;

/** .copilot/skills/export-pdf.md */
export const SKILL_EXPORT_PDF = `---
description: >
  Export the deck as a PDF file. Use when the user asks to export, print, or
  share the presentation as a PDF.
---

## Export the deck to PDF

Run the following command from the deck directory (or any parent directory
where \`config.json\` is reachable):

\`\`\`bash
npx geekslides pdf --config config.json --output slides.pdf
\`\`\`

### Options

| Flag | Description |
|---|---|
| \`--config\` | Path to \`config.json\` (required) |
| \`--output\` | PDF output path (default: \`slides.pdf\`) |
| \`--details\` | Include speaker notes as an appendix |

### Requirements

Playwright Chromium must be installed. Install it with:

\`\`\`bash
npx playwright install chromium
\`\`\`

### Troubleshooting

- **Blank slides** — make sure the dev server is NOT running on the same port.
  The PDF command starts its own headless browser session.
- **Missing images** — use relative paths in Markdown (\`images/photo.jpg\`).
- **Font issues** — remote fonts (Google Fonts, etc.) require internet access
  during the Playwright capture.
`;

/** .copilot/skills/update-theme.md */
export const SKILL_UPDATE_THEME = `---
description: >
  Change the visual theme of the deck. Use when the user asks to change colours,
  fonts, the theme, or the visual style of the presentation.
---

## Update the deck theme

### Switch to a different built-in theme

1. Open \`config.json\`.
2. Find the entry in \`styles\` that points to a \`css/theme-*.css\` file.
3. Replace it with the new theme name, e.g.:

\`\`\`json
"styles": ["css/layouts.css", "css/theme-ocean.css", "css/local.css"]
\`\`\`

4. Copy the new theme CSS file into \`css/\` by running:

\`\`\`bash
npx geekslides create --title "." --theme ocean --no-git --dir /tmp/theme-swap
cp /tmp/theme-swap/css/theme-ocean.css css/
rm -rf /tmp/theme-swap
\`\`\`

### Available built-in themes

\`default\`, \`aurora\`, \`solarized\`, \`ocean\`, \`forest\`, \`sunset\`,
\`nordic\`, \`crimson\`, \`monochrome\`, \`candy\`, \`volcano\`

### Customise colours and fonts

Edit \`css/local.css\` to override design tokens:

\`\`\`css
:host {
  --gs-color-accent: #E63946;
  --gs-font-family: 'Inter', system-ui, sans-serif;
  --gs-color-bg: #0d1117;
  --gs-color-text: #e6edf3;
}
\`\`\`

CSS changes hot-reload instantly in the dev server — no restart needed.
`;
