# GeekSlides How-To Guides

Practical, step-by-step tutorials to get you productive with GeekSlides.

| Guide | What you'll learn |
|---|---|
| [Install the CLI](01-install-the-cli.md) | Install GeekSlides and verify everything works |
| [Create Your First Deck](02-create-your-first-deck.md) | Scaffold a presentation and understand the file structure |
| [Evolve Your Deck](03-evolve-your-deck.md) | Add slides, partials, speaker notes, images, and custom styles |
| [Present Like a Pro](04-present-like-a-pro.md) | Master navigation, terminal commands, speaker view, and mobile |
| [Deploy the Server](05-deploy-the-server.md) | Run GeekSlides in production with Docker, HTTPS, and sync |
| [Export to PDF](06-export-to-pdf.md) | Generate slides, handouts, and book-format PDFs |
| [Style Your Deck](07-style-your-deck.md) | Understand the CSS layers: base, theme, and per-slide styles |
| [Write a Custom Plugin](08-write-a-custom-plugin.md) | Build a preprocessor and a processor with practical examples |
| [Add Local Plugins](09-add-local-plugins.md) | Ship plain JS plugins alongside your deck or load them from remote URLs |

## Screenshots

The `screenshots/` directory contains images generated with Playwright.
Run the screenshot script to regenerate them:

```bash
npx playwright test --config=how-to/screenshots/playwright.config.ts
```
