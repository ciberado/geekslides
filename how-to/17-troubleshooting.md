# 17 — Troubleshooting GeekSlides

This guide explains the most common errors, what they mean, and how to fix them.

## Deck Proxy Errors

All `/api/deck-proxy` errors return a structured JSON body:

```json
{
  "code": "BLOCKED_HOST",
  "message": "Host \"localhost\" is not allowed by the proxy security policy",
  "hint": "To load from localhost during development, set DEV_PROXY=true and restart the server",
  "details": { "url": "http://localhost:8080/config.json", "hostname": "localhost" },
  "timestamp": 1714000000000
}
```

| Code | Meaning | Fix |
|---|---|---|
| `MISSING_URL` | The `url` query parameter was not provided | Append `?url=<encoded-url>` to the request |
| `INVALID_URL` | The URL could not be parsed | Check the URL starts with `http://` or `https://` |
| `BLOCKED_PROTOCOL` | Only `http:` and `https:` are supported | Change the URL scheme |
| `BLOCKED_HOST` | The hostname is blocked for security | For `localhost`, set `DEV_PROXY=true` and restart |
| `UPSTREAM_ERROR` | The remote server returned an error status | Verify the URL and that the remote server is up |
| `OVERSIZED_RESPONSE` | The remote resource exceeds 50 MB | Split the resource or host it behind a CDN |
| `FETCH_FAILED` | Network error reaching the remote server | Check connectivity from the GeekSlides host |
| `FETCH_TIMEOUT` | The remote server did not respond within 15 s | Check whether the server is overloaded or unreachable |

### Loading decks from localhost during development

By default the proxy blocks `localhost` and `127.0.0.1` to prevent server-side request forgery (SSRF).
To serve a deck from a local server during development:

```bash
DEV_PROXY=true geekslides dev
```

## Config Loading Errors

### "Network error loading config from …"

The browser could not reach the dev server or the proxy.
Run `geekslides dev` and make sure the terminal shows no startup errors.

### "Failed to load config from …: HTTP 404"

The `config.json` file was not found.
- Run `geekslides create <name>` to scaffold a new deck.
- Or pass `--config <path>` to point to an existing config.

### "Expected JSON but received HTML from …"

The server returned its fallback HTML page instead of the config file.
This usually means the path is wrong or the file does not exist at that location.

### "Config is not valid JSON (…)"

The `config.json` file contains a syntax error.
The error message includes parse details (e.g. position information) from the JSON parser.
Open the file in an editor, look for the reported position, and fix the syntax.

### "Config 'content' must be a non-empty string or array of non-empty strings"

The `content` field is missing or empty.  Add it:

```json
{ "content": "README.md" }
```

## Plugin Errors

### "Preprocessor from plugin 'X' threw an error"

A markdown preprocessor crashed.
The error includes:
- The plugin name (`X`) so you know which plugin to check.
- A snippet of the markdown that was being processed when the crash occurred.
- The original exception as `error.cause`.

Enable debug logging to see more context:

```bash
GEEKSLIDES_LOG=debug geekslides dev
```

### "Processor from plugin 'X' threw an error on slide N of M"

A slide processor crashed on slide N.
Check the plugin's documentation and verify the slide's HTML structure is valid.

## Sync / WebSocket Errors

### Sync disconnects immediately after connecting

Check the browser DevTools console for WebSocket close code details.
Common causes:

| WS Close Code | Cause | Fix |
|---|---|---|
| 1006 | Server unreachable / URL wrong | Check `sync.server` in `config.json` |
| 4001 / 4003 | Auth rejected | Verify the presenter or viewer token |

### "sync WebSocket closed abnormally"

The `sync.server` URL in `config.json` may be wrong, or the server is not running.
Example of a valid sync server URL: `ws://localhost:1234`.

## CLI Errors

### "Config file not found: …"

Run `geekslides create <name>` to scaffold a new deck or pass the correct path with `--config <path>`.

### "Port N is already in use"

Another process is listening on the same port.
- Find and stop the other process: `lsof -i :<port>` (macOS/Linux)
- Or use a different port: `geekslides dev --port 5174`

### "Failed to start sync server on port …"

The WebSocket sync server port is busy.
Use `--ws-port <n>` to choose a different port.

## Enable Debug Logging

Set `GEEKSLIDES_LOG=debug` (or `trace` for maximum verbosity) before any GeekSlides command:

```bash
GEEKSLIDES_LOG=debug geekslides dev
```

All log lines include a `ns` (namespace) field so you can filter by component:

```bash
GEEKSLIDES_LOG=debug geekslides dev 2>&1 | grep '"ns":"deck-proxy"'
```

---

← Previous: [Deploy with Tailscale](16-deploy-with-tailscale.md) | Next: [Use the VS Code Extension →](18-use-the-vscode-extension.md)
