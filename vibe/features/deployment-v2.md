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
│  │  /*       → /srv/slides (SPA)       │    │
│  └─────────────────────────────────────┘    │
│                     │                        │
│                     ▼                        │
│  ┌─────────────────────────────────────┐    │
│  │    Node.js y-websocket (bg)          │    │
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
- `/*` — SPA shell from `/srv/slides` with `index.html` fallback

TLS configured via `{$ACME_EMAIL}` — `internal` generates self-signed certs for development.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DOMAIN` | `localhost` | Domain for Caddy HTTPS cert |
| `ACME_EMAIL` | `internal` | Email for Let's Encrypt. `internal` = self-signed |
| `CONTENT_DIR` | `.` | Host path to presentation content (optional — see below) |
| `PORT` | `1234` | y-websocket server port (internal, not exposed) |

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

### Azure Static Website (Alternative)

For static deployments without real-time sync: run `npm run build`, then upload the `packages/engine/dist` directory to an Azure Blob Storage `$web` container using `az storage blob upload-batch`.

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
| Remote decks | Not supported | Supported via `?config=<url>` or `load` command |

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
