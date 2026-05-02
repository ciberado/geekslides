# Use the VS Code Extension

This guide shows you how to use the GeekSlides VS Code extension for the MVP workflow: starting and stopping the dev server, creating a deck, opening it in the browser, and verifying the bidirectional cursor-to-slide sync that links your editor to the live presentation.

## Understand what the extension does

The extension adds five commands to VS Code:

| Command | What it does |
| --- | --- |
| `GeekSlides: Start Dev Server` | Runs the local GeekSlides dev server for the active deck |
| `GeekSlides: Stop Dev Server` | Stops the running dev server |
| `GeekSlides: Create Deck` | Scaffolds a new deck with the existing CLI template |
| `GeekSlides: Open in Browser` | Opens the current deck in your default browser |
| `GeekSlides: Toggle Cursor Sync` | Enables or disables editor/browser synchronization |

The sync feature works in both directions:

1. Move the cursor in the deck markdown file and the browser navigates to the matching slide.
2. Navigate in the browser and the editor jumps to the corresponding slide source.

## Install the extension for local testing

The MVP package is intended for local installation from the repository, not Marketplace publishing.

From the repo root:

```bash
npm install
npm run build -w @geekslides/vscode
```

The extension bundle is written to:

```bash
packages/vscode/dist/extension.cjs
```

To test it in VS Code:

1. Open the `geekslides` repository in VS Code.
2. Open the **Run and Debug** view.
3. Start **Run Extension** (or press `F5`).
4. In the new **Extension Development Host** window, open a deck workspace that contains `config.json`.
5. Rebuild and restart the extension host after code changes when needed.

> **Tip:** If you are developing the extension inside this monorepo, the extension prefers a local GeekSlides CLI binary first and only falls back to a global `geekslides` install if no local binary is available.

## Start a deck server from VS Code

Open a workspace that contains a GeekSlides deck with a `config.json` file.

Then run:

1. **GeekSlides: Start Dev Server**
2. Wait for the status bar to change from `GeekSlides: Stopped` to `GeekSlides: :5173` (or your configured port)

The extension resolves the active deck by looking for the nearest `config.json` from the current editor file or workspace root.

If the command cannot find a deck, check that:

- the workspace contains a `config.json`
- the deck markdown file referenced by `content` exists
- the workspace is opened at the deck root or inside it

## Open the deck in the browser

Once the server is running, run:

```text
GeekSlides: Open in Browser
```

The extension uses the presentation URL reported by the dev server, so it opens the same `?config=` URL that the CLI prints in the terminal.

You should see the live deck in your default browser.

## Create a new deck from VS Code

To scaffold a fresh deck:

1. Run **GeekSlides: Create Deck**
2. Enter the presentation title
3. Pick the target directory

The extension reuses the CLI scaffolder, so the generated output matches `geekslides create`.

The new deck opens its `README.md` automatically after creation.

## Verify cursor-to-slide sync

This is the key manual QA scenario for the extension.

### 1. Prepare the test

Open a deck that contains multiple slides in its markdown source and start the dev server.

Then:

1. Run **GeekSlides: Open in Browser**
2. Keep the browser and VS Code visible side by side

### 2. Check editor -> browser sync

In the deck markdown file:

1. Click inside the first slide
2. Move the cursor into the next slide's heading or body
3. Move it again into a third slide

Expected result:

- the browser follows the editor cursor
- each jump lands on the matching slide
- repeated cursor movement inside the same slide does **not** cause unnecessary extra navigation

### 3. Check browser -> editor sync

Now switch to the browser and navigate with the usual presentation controls:

1. Press `ArrowRight`
2. Press `ArrowRight` again
3. Press `ArrowLeft`

Expected result:

- the editor cursor jumps to the source lines of the active slide
- the cursor lands near the slide marker or heading for that slide
- the jump should feel stable, without oscillation or ping-pong

### 4. Check sync with HMR

Edit the deck while both VS Code and the browser are open:

1. Change slide text in `README.md`
2. Save the file
3. Add or remove a heading if the deck uses the `header` preprocessor

Expected result:

- the browser hot reloads the deck content
- the current slide stays coherent after reload
- cursor sync still works after the deck structure changes

## Verify with a synced room

If your deck has sync enabled, the extension uses the same room name as the browser by reading `config.sync.room`.

Use this quick check:

1. Start the dev server
2. Open the deck in the browser
3. Confirm the deck config contains a `sync.room` value or uses the default room
4. Move the cursor in the editor and verify the browser follows

This confirms the extension is writing slide state into the same Yjs `sessionState` document as the browser runtime.

## Useful settings

The MVP exposes these settings:

| Setting | Default | Purpose |
| --- | --- | --- |
| `geekslides.debounceMs` | `300` | Delay before editor cursor changes publish a slide change |
| `geekslides.autoStartServer` | `false` | Start the server automatically when the workspace opens |
| `geekslides.defaultPort` | `5173` | Default Vite port |
| `geekslides.wsPort` | `1234` | Default sync server port |

## Manual QA checklist

Use this checklist before calling the feature ready:

| Check | Expected result |
| --- | --- |
| Start server | Status bar shows a running port |
| Stop server | Status bar returns to stopped |
| Create deck | New deck files are scaffolded and `README.md` opens |
| Open in browser | Default browser opens the live deck |
| Editor -> browser sync | Cursor movement navigates slides |
| Browser -> editor sync | Slide navigation moves the cursor |
| HMR after markdown edits | Browser content updates and sync still works |
| HMR after slide-boundary edits | Slide map refreshes and sync stays correct |

## Troubleshoot common issues

If something does not behave as expected:

- server fails to start -> check for port conflicts
- browser opens but does not sync -> confirm `sync.enabled` and `sync.room`
- cursor moves but browser does not follow -> verify the browser deck is loaded from the same dev server session
- browser navigation does not move the cursor -> confirm the active editor is the deck's content file, not another markdown file

For general platform errors, see the troubleshooting guide:

- [Troubleshooting GeekSlides](17-troubleshooting.md)

---

← Previous: [Troubleshooting GeekSlides](17-troubleshooting.md) | Back to [index →](README.md)
