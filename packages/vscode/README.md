# `@geekslides/vscode`

VS Code extension for authoring GeekSlides decks.

## MVP features

1. **Start/stop dev server** from the command palette
2. **Create a deck** with the existing CLI scaffolder
3. **Open the deck in the browser**
4. **Bidirectional cursor sync** between the editor and the active browser slide

## Commands

| Command | Purpose |
| --- | --- |
| `GeekSlides: Start Dev Server` | Launch `geekslides dev` for the active deck |
| `GeekSlides: Stop Dev Server` | Stop the running dev server |
| `GeekSlides: Create Deck` | Scaffold a new deck in a selected directory |
| `GeekSlides: Open in Browser` | Open the current deck URL |
| `GeekSlides: Toggle Cursor Sync` | Enable/disable editor/browser synchronization |

## Settings

| Setting | Default |
| --- | --- |
| `geekslides.debounceMs` | `300` |
| `geekslides.autoStartServer` | `false` |
| `geekslides.defaultPort` | `5173` |
| `geekslides.wsPort` | `1234` |

## Development

```bash
npm run build -w @geekslides/vscode
npm run typecheck -w @geekslides/vscode
```

The bundle entry point is `dist/extension.cjs` and is intended to be loaded by VS Code.

For local QA in VS Code:

1. Open the `geekslides` repository in VS Code.
2. Open the **Run and Debug** view.
3. Start **Run Extension** (or press `F5`).
4. In the new **Extension Development Host** window, open a GeekSlides deck workspace.

## Manual QA

1. Open a deck workspace containing `config.json`.
2. Run **GeekSlides: Start Dev Server**.
3. Run **GeekSlides: Open in Browser** and wait for the deck to load.
4. Move the cursor across slide boundaries in `README.md` and confirm the browser follows.
5. Navigate in the browser with arrow keys and confirm the editor cursor jumps to the matching slide source.
6. Edit markdown or CSS and confirm the browser hot reloads while cursor sync keeps working.

## Notes

- The extension resolves a local GeekSlides CLI first, then falls back to a global install.
- Room sync uses `config.sync.room`, matching the browser runtime.
