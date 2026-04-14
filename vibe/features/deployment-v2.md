# Deployment (v2)

## Overview

v2 simplifies deployment to two Docker services behind Caddy, replacing v1's three-listener
MQTT broker with a single y-websocket server.

## Docker Architecture

```
┌──────────────────────────────────────────────────┐
│                  Docker Compose                   │
│                                                  │
│  ┌────────────────────────────────────────────┐  │
│  │              caddy (reverse proxy)          │  │
│  │                                            │  │
│  │  :443 (HTTPS)                              │  │
│  │  ┌──────────────────────────────────────┐  │  │
│  │  │ /*        → slides:5173 (static)     │  │  │
│  │  │ /ws       → yjs-server:1234 (ws)     │  │  │
│  │  └──────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────┘  │
│                    │              │               │
│        ┌───────────┘              └─────────┐    │
│        ▼                                    ▼    │
│  ┌──────────────┐                ┌──────────────┐│
│  │    slides     │                │  yjs-server  ││
│  │              │                │              ││
│  │  Caddy       │                │  Node.js     ││
│  │  (static     │                │  y-websocket ││
│  │   files)     │                │  :1234       ││
│  └──────────────┘                └──────────────┘│
└──────────────────────────────────────────────────┘
```

## Docker Files

### docker-compose.yml

The `docker/docker-compose.yml` defines three services:

- **slides**: Builds from the root Dockerfile, restarts unless stopped. Mounts the `CONTENT_DIR` (defaults to `.`) as read-only at `/srv/content`.

- **yjs-server**: Builds from Dockerfile.server, restarts unless stopped. Environment variables `PORT=1234` and `HOST=0.0.0.0`. Optionally mounts a `yjs-data` volume for persistence.

- **caddy**: Uses the `caddy:2-alpine` image, restarts unless stopped. Maps ports 80 and 443. Mounts the Caddyfile as read-only, plus `caddy-data` and `caddy-config` volumes. Takes `DOMAIN` from the environment (defaults to `localhost`). Depends on both slides and yjs-server.

Two named volumes are defined: `caddy-data` and `caddy-config`.

### Dockerfile (slides — multi-stage)

Stage 1 (builder): Uses `node:22-alpine`. Copies workspace package.json files for engine and CLI, runs `npm ci` for those workspaces, copies the source files, tsconfig, and vite config, then runs the engine build.

Stage 2 (serve): Uses `caddy:2-alpine`. Copies the built dist from the builder into `/srv/slides`, copies a Caddyfile for static serving, exposes port 5173.

### Dockerfile.server (yjs-server)

Uses `node:22-alpine`. Copies the workspace root and server package.json, runs `npm ci --workspace=@geekslides/server --omit=dev`, copies the server source. Exposes port 1234, runs as the `node` user, and starts with `node packages/server/src/index.js`.

### Caddyfile

The `docker/Caddyfile` listens on the configured domain (or localhost). It reverse-proxies `/*` to `slides:5173` for static files, and `/ws` to `yjs-server:1234` for WebSocket connections. TLS is configured via the `ACME_EMAIL` variable — setting it to `internal` generates self-signed certs for development.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DOMAIN` | `localhost` | Domain for Caddy HTTPS cert |
| `ACME_EMAIL` | `internal` | Email for Let's Encrypt. `internal` = self-signed |
| `CONTENT_DIR` | `.` | Host path to presentation content |
| `PORT` | `1234` | yjs-server WebSocket port |

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

From the `docker/` directory, run `CONTENT_DIR=~/presentations/my-talk docker compose up --build`. Access at `https://localhost` (self-signed cert).

## Production Deployment

### Quick Deploy

On a server with Docker: clone the repo, `cd` into `docker/`, set `DOMAIN` and `ACME_EMAIL` environment variables, and run `docker compose up -d --build`.

### With External Presentation Content

Mount a specific presentation via `CONTENT_DIR=/path/to/presentation docker compose up -d`.

### Azure Static Website (Alternative)

For static deployments without real-time sync: run `npm run build`, then upload the `packages/engine/dist` directory to an Azure Blob Storage `$web` container using `az storage blob upload-batch`.

## Comparison with v1 Deployment

| Aspect | v1 | v2 |
|--------|----|----|
| Services | 3 (slides + broker + Caddy) | 2 (slides + yjs-server + Caddy) |
| Broker | Aedes (TCP 1883 + WS 8883 + WSS 8443) | y-websocket (single WS port) |
| Ports exposed | 3 | 1 (443, Caddy handles routing) |
| Config | Complex Caddyfile with MQTT proxy | Simple reverse proxy |
| Auth | Username/password per MQTT room | Room token via y-websocket URL params |
| SSL Termination | Caddy + broker self-signed WS | Caddy only |
| Static files | Parcel build → Caddy | Vite build → Caddy |

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
