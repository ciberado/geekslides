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
| [Use the Docker CLI](10-use-the-docker-cli.md) | Run GeekSlides commands via Docker without installing Node.js |
| [Add Mermaid Diagrams](11-add-mermaid-diagrams.md) | Render flowcharts and sequence diagrams in slides with fenced code blocks |
| [Sync Your Presentation](12-sync-your-presentation.md) | Set up real-time sync rooms, follow/unfollow, whiteboard sharing, and multi-device workflows |
| [Add a Feature](13-add-a-feature.md) | Enable the whiteboard, load local or remote features, and configure per-deck |
| [Create a Custom Feature](14-create-a-custom-feature.md) | Build a synced countdown timer feature from scratch with commands, UI, and lifecycle events |
| [Use the Hub](15-use-the-hub.md) | Deploy the community hub, sign in with OAuth, upload decks, edit metadata, share presentations, and keep GitHub imports up to date |
| [Deploy with Tailscale](16-deploy-with-tailscale.md) | Run GeekSlides on a private Tailscale node with a public HTTPS proxy, full TLS at every hop, WebSocket sync, and Hub routing |
| [Use the VS Code Extension](18-use-the-vscode-extension.md) | Start the dev server, create decks, open the browser, and verify cursor-to-slide sync from VS Code |
| [Create a Custom Layout with Modifiers](19-create-layout-with-modifiers.md) | ⭐ Build layouts with nested modifier variations using CSS nesting and structured documentation |
| [Add CSS Doodle Backgrounds](20-add-css-doodle-backgrounds.md) | Add beautiful generative parametric patterns as decorative backgrounds with automatic theme integration |

## Screenshots

The `screenshots/` directory contains images generated with Playwright.
Run the screenshot script to regenerate them:

```bash
npx playwright test --config=how-to/screenshots/playwright.config.ts
```
