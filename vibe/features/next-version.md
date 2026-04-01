# Desired features

* Implemented from ground using modern typescript
* Based on vanilla js, without React or similar. Modern toolchain (no parcel anymore).
* Leveraging DOM components.
* Cleaner and simpler architecture.
* Feature parity, but simpler to mantain code.
* Compatible with weasyprint for generating the pdf of the slides, the slides with speaker notes and a book with the slides and details.
* Simpler synchronization of the decks and whiteboards, based in realtime collaboration framework.
* Livepreview of the changes in the browser with support basics for future VSCode extension.
* Commands based on an active key opening a terminal-like prompt (`t`) instead of a mess of hotkeys. Navigation (arrows, space, etc.) stays as direct keystrokes — no prefix needed.
* Extensible, with support for processors and pre-processors but with a cleaner plugin architecture.
* With the ability of adding local styles to each single slide using a simple <style>...</style> syntax in addition to the current one without polluting the rendered mardkown.
* Fully testeable and full of tests (including end-to-end).
* As simple as possible to deploy.
* With docker and docker compose support.
* Slides should be followable from a smartphone browser (touch gestures, responsive toolbar, auto-sync).
* Speaker notes as a proper separate view (separate tab/window with timer, next-slide preview, scrollable notes) instead of CSS tricks.

## Architecture Documents

- [Decisions Record](decisions.md) — all 21 architectural decisions with rationale
- [Architecture Overview](architecture-v2.md) — system context, package structure, data flow diagrams
- [Toolchain & Monorepo](toolchain.md) — Vite, TypeScript strict, npm workspaces, ESLint
- [Web Components](components.md) — Custom Elements, Shadow DOM, dual rendering for print, per-slide style scoping, mobile support
- [Yjs Synchronization](sync.md) — CRDT sync replacing MQTT, Y.Map session state, y-websocket server
- [Plugin System](plugin-system.md) — preprocessor/processor pipeline, built-in plugins, registration via config
- [Command System](command-system.md) — direct keys for navigation, `t` terminal prompt for commands, touch gestures for mobile
- [Speaker Notes](speaker-notes.md) — separate view architecture, `<geek-speaker-view>` component, timer, v1 vs v2 comparison
- [CSS Slide Scaling](css-scaling.md) — `transform: scale()` technique, v1 vs v2 improvements, 5 alternatives evaluated
- [Testing Strategy](testing.md) — Vitest unit/integration, Playwright E2E, CI pipeline
- [Print & PDF](print.md) — WeasyPrint, three output formats, PrintRenderer, CLI integration
- [Deployment](deployment-v2.md) — Docker Compose, Caddy, local dev, production checklist
