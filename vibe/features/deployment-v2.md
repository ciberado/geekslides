# Deployment (v2)

## Overview

v2 ships as a **single Docker image** combining the SPA, the y-websocket sync server, and Caddy
into one container. No orchestration or compose file is required for simple deployments.

## Docker Architecture

```
┌─────────────────────────────────────────────┐
│            Single Container                  │
│                                             │
│  ┌─────────────────────────────────────┐    │
│  │           Caddy (PID 1)              │    │
│  │                                     │    │
│  │  :443 (HTTPS)                       │    │
│  │  /deck/*  → /srv/content (files)    │    │
│  │  /ws*     → localhost:1234 (ws)     │    │
│  │  /api/*   → localhost:1234 (http)   │    │
│  │  /*       → /srv/slides (SPA)       │    │
│  └─────────────────────────────────────┘    │
│                     │                        │
│                     ▼                        │
│  ┌─────────────────────────────────────┐    │
│  │    Node.js y-websocket + API (bg)    │    │
│  │    listening on 127.0.0.1:1234       │    │
│  └─────────────────────────────────────┘    │
└─────────────────────────────────────────────┘
```

Caddy runs as PID 1 and handles SIGTERM. The yjs-server is started as a background process
by `docker/entrypoint.sh` before `exec caddy`.

## Docker Files

### Dockerfile (3-stage)

- **Stage 1 (`app-builder`)**: `node:22-alpine`. Installs all workspace deps, runs
  `npm run build:app --workspace=@geekslides/cli` to produce the SPA bundle in
  `packages/cli/dist/app`.
- **Stage 2 (`server-builder`)**: `node:22-alpine`. Installs only server deps, runs
  `npm run build --workspace=@geekslides/server` to produce `packages/server/dist/index.cjs`
  (esbuild CJS bundle, no node_modules at runtime).
- **Stage 3 (runtime)**: `node:22-alpine` + `caddy` via `apk`. Copies SPA to `/srv/slides`,
  server bundle to `/app/index.cjs`, and the Caddyfile. `entrypoint.sh` starts Node then
  exec-replaces itself with Caddy.

### docker-compose.yml

Defines a single `geekslides` service. Mounts `CONTENT_DIR` (defaults to `.`) at
`/srv/content:ro` for the presentation, plus `caddy-data` and `caddy-config` named volumes
for TLS cert persistence.

### Caddyfile

Listens on `{$DOMAIN}` (default `localhost`). Routes:
- `/deck/*` — strips prefix, serves files directly from `/srv/content`
- `/ws*` — WebSocket proxy to `localhost:1234` with correct `Upgrade`/`Connection` headers
- `/api/*` — HTTP proxy to `localhost:1234` for the content proxy API (deck upload/serving)
- `/*` — SPA shell from `/srv/slides` with `index.html` fallback

TLS configured via `{$ACME_EMAIL}` — `internal` generates self-signed certs for development.

### npm Docker Scripts

Root `package.json` provides convenience scripts for building and pushing all images:

| Script | Image | Description |
|--------|-------|-------------|
| `docker:build` | (all) | Builds all four images sequentially |
| `docker:build:main` | `ciberado/geekslides:latest` | Full-stack: SPA + yjs server + Caddy |
| `docker:build:server` | `ciberado/geekslides-server:latest` | Standalone yjs-server only |
| `docker:build:cli` | `ciberado/geekslides-cli:latest` | CLI slim (Alpine, ~200 MB) |
| `docker:build:cli:chromium` | `ciberado/geekslides-cli:chromium` | CLI with Chromium (~800 MB) |
| `docker:push` | (all) | Pushes all four images to Docker Hub |
| `docker:push:main` | `ciberado/geekslides:latest` | |
| `docker:push:server` | `ciberado/geekslides-server:latest` | |
| `docker:push:cli` | `ciberado/geekslides-cli:latest` | |
| `docker:push:cli:chromium` | `ciberado/geekslides-cli:chromium` | |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DOMAIN` | `localhost` | Domain for Caddy HTTPS cert |
| `ACME_EMAIL` | `internal` | Email for Let's Encrypt. `internal` = self-signed |
| `CONTENT_DIR` | `.` | Host path to presentation content (optional — see below) |
| `PORT` | `1234` | y-websocket server port (internal, not exposed) |
| `GEEKSLIDES_LOG_FORMAT` | `json` | Log format: `json` (structured, Docker-safe) or `pretty` (dev only). Default in Docker images is `json` to avoid pino-pretty runtime crash. |

## Local Development

### Prerequisites

- Node.js 22+
- npm 10+

### Setup

Prerequisites: Node.js 22+ and npm 10+.

1. Clone and `npm install` to install all workspace dependencies.
2. `npm run dev` starts the engine dev server (`http://localhost:5173`), the Yjs server (`ws://localhost:1234`), and watches `.ts`, `.css`, `.md`, `.json` files with HMR.

### Developing a Presentation

In a separate terminal, navigate to a presentation repo and run `npx geekslides dev --config /absolute/path/to/config.json`. The installed CLI serves its packaged app shell on `http://localhost:5173`, points the browser at the chosen deck, and watches `README.md`, `config.json`, and author CSS for changes. The same workflow works for decks outside the GeekSlides repo via Vite's `/@fs/...` file serving, and HMR preserves the current slide position on save.

### Development with Docker

From the repo root:

```sh
CONTENT_DIR=~/presentations/my-talk docker compose -f docker/docker-compose.yml up --build
```

Access at `https://localhost` (self-signed cert). The container serves the SPA, the deck
content at `/deck/*`, and the sync server at `/ws*`.

## Production Deployment

### Quick Deploy

On a server with Docker:

```sh
DOMAIN=slides.example.com \
ACME_EMAIL=you@example.com \
CONTENT_DIR=/path/to/my-talk \
docker compose -f docker/docker-compose.yml up -d --build
```

First run will obtain a Let's Encrypt certificate automatically.

### Without a Local Deck (Remote Presentations)

`CONTENT_DIR` is optional. If omitted, `/srv/content` is empty and `/deck/config.json` will
404. The app still loads — use the `?config=` query parameter or the `load` terminal command
to point it at a remote deck URL:

```
https://yourserver/?config=https://example.com/my-talk/config.json
```

Or at runtime press `t` and run:

```
load https://example.com/my-talk/config.json
```

Relative asset paths in `config.json` (`content`, `styles`, `images/`) resolve against the
config URL's base, so remote decks work end-to-end as long as the host sends CORS headers.

### Content Proxy (Automatic Deck Sharing)

When sync is enabled, the presenter's browser automatically uploads all deck assets
(config, markdown, CSS, referenced images) to the server via `POST /api/rooms/:room/content`.
The server stores them in a per-room temp directory. All audience clients in the same sync room
receive the proxy URL via the Yjs shared state and load the deck from the server instead of
needing direct access to the presenter's local files or network.

This makes "serverless" deployments fully functional for remote audiences:

```sh
# Deploy server without any mounted content
DOMAIN=slides.example.com ACME_EMAIL=you@example.com \
  docker compose -f docker/docker-compose.yml up -d --build
```

The presenter opens the SPA, loads their local deck via `?config=` or the `load` command,
and the content proxy uploads it automatically. Audience members visiting the same room URL
receive the deck without needing access to the original source.

Proxy content is room-scoped and ephemeral — it is cleaned up when the room is destroyed
or the server restarts. Max upload size: 200 MB.

### Azure Static Website (Alternative)

For static deployments without real-time sync: run `npm run build`, then upload the `packages/engine/dist` directory to an Azure Blob Storage `$web` container using `az storage blob upload-batch`.

## CLI Docker Image

The CLI is also available as a standalone Docker image for authoring presentations without
installing Node.js locally. Two tags are published:

- `ciberado/geekslides-cli:latest` — Alpine-based, all commands except PDF export (~200 MB)
- `ciberado/geekslides-cli:chromium` — Debian-based with Playwright + Chromium for PDF export (~800 MB)

Running the image with no arguments prints a wrapper script:

```sh
docker run --rm ciberado/geekslides-cli > geekslides && chmod +x geekslides
./geekslides dev   # starts dev server on port 3000, mounts $PWD
```

See [CLI Docker Image](cli-docker-image.md) for the full design.

## Comparison with v1 Deployment

| Aspect | v1 | v2 |
|--------|----|----|
| Containers | 3 (slides + broker + Caddy) | 1 (all-in-one) |
| Broker | Aedes (TCP 1883 + WS 8883 + WSS 8443) | y-websocket (localhost:1234) |
| Ports exposed | 3 | 2 (80 redirect, 443 HTTPS) |
| Config | Complex multi-service Compose + Caddyfile | Single Dockerfile + single Caddyfile |
| Auth | Username/password per MQTT room | Room token via y-websocket URL params |
| SSL Termination | Caddy + broker self-signed WS | Caddy only |
| Static files | Parcel build → Caddy | Vite build → Caddy |
| Remote decks | Not supported | Supported via `?config=<url>`, `load` command, or automatic content proxy |

## Content Proxy API

The Node.js server exposes an HTTP API alongside the WebSocket sync:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/rooms/:room/content` | `POST` | Upload deck assets (multipart/form-data, max 200 MB) |
| `/api/rooms/:room/content/:path` | `GET` | Fetch a proxied deck file |
| `/api/plugin-proxy?url=<encoded-url>` | `GET` | Proxy a remote JavaScript plugin file (`.js` only, max 1 MB) |
| `/api/rooms/:room/share` | `POST` | Create a protected room, returns `{ presenterToken }` |
| `/api/rooms/:room/auth` | `POST` | Validate a presenter token, returns `{ role }` |
| `/api/rooms/:room/role` | `GET` | Check if a room is protected, returns `{ protected }` |

Content is stored in per-room temp directories and cleaned up on server restart.
Path traversal is blocked — `..` segments return 404. See [Content Proxy](content-proxy.md)
for the full design.

The plugin proxy fetches remote `.js` files on behalf of the browser to avoid CORS
restrictions. It requires `https:` in production (`http:` allowed in dev mode),
enforces a 1 MB size limit, and caches responses for 5 minutes. See
[Plugin System](plugin-system.md) for details.

## Health Checks

Both services should include Docker health checks:

- **slides**: Uses `wget --spider -q http://localhost:5173/` every 30 s with a 5 s timeout and 3 retries.
- **yjs-server**: Uses a Node.js one-liner that opens a WebSocket to `ws://localhost:1234`, exits 0 on successful open, exits 1 on error. Same 30 s interval, 5 s timeout, 3 retries.

## Checklist

- [ ] `DOMAIN` environment variable set for production
- [ ] `ACME_EMAIL` set (not `internal`) for real Let's Encrypt certs
- [ ] Firewall allows ports 80, 443
- [ ] DNS A record points to server IP
- [ ] Content directory mounted or baked into image
- [ ] yjs-server persistence enabled if room state should survive restarts
- [ ] Docker volumes backed up (caddy-data for certificates)
