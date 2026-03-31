# Desired features

* Implemented from ground using modern typescript
* Based on vanilla js, without React or similar. Modern toolchain (no parcel anymore).
* Leveraging DOM components.
* Cleaner and simpler architecture.
* Feature parity, but simpler to mantain code.
* Compatible with weasyprint for generating the pdf of the slides, the slides with speaker notes and a book with the slides and details.
* Simpler synchronization of the decks and whiteboards, based in realtime collaboration framework.
* Livepreview of the changes in the browser with support basics for future VSCode extension.
* Commands based on active key (like vim or tmux with ctrl+b and :) instead of a mess of hotkeys.
* Extensible, with support for processors and pre-processors but with a cleaner plugin architecture.
* With the ability of adding local styles to each single slide using a simple <style>...</style> syntax in addition to the current one without polluting the rendered mardkown.
* Fully testeable and full of tests (including end-to-end).
* As simple as possible to deploy.
* With docker and docker compose support.

## Architecture Documents

- [Decisions Record](decisions.md) — all 18 architectural decisions with rationale
- [Architecture Overview](architecture-v2.md) — system context, package structure, data flow diagrams
- [Toolchain & Monorepo](toolchain.md) — Vite, TypeScript strict, npm workspaces, ESLint
- [Web Components](components.md) — Custom Elements, Shadow DOM, dual rendering for print, per-slide style scoping
- [Yjs Synchronization](sync.md) — CRDT sync replacing MQTT, Y.Map session state, y-websocket server
- [Plugin System](plugin-system.md) — preprocessor/processor pipeline, built-in plugins, registration via config
- [Command System](command-system.md) — Ctrl+B prefix key, colon command palette, state machine, key bindings
- [Testing Strategy](testing.md) — Vitest unit/integration, Playwright E2E, CI pipeline
- [Print & PDF](print.md) — WeasyPrint, three output formats, PrintRenderer, CLI integration
- [Deployment](deployment-v2.md) — Docker Compose, Caddy, local dev, production checklist
