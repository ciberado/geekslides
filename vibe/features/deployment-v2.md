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

```yaml
# docker/docker-compose.yml
services:
  slides:
    build:
      context: ..
      dockerfile: docker/Dockerfile
    restart: unless-stopped
    volumes:
      # Mount presentation content from host
      - ${CONTENT_DIR:-.}:/srv/content:ro

  yjs-server:
    build:
      context: ..
      dockerfile: docker/Dockerfile.server
    restart: unless-stopped
    environment:
      - PORT=1234
      - HOST=0.0.0.0
    # Optional: persist Yjs docs
    # volumes:
    #   - yjs-data:/data

  caddy:
    image: caddy:2-alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy-data:/data
      - caddy-config:/config
    environment:
      - DOMAIN=${DOMAIN:-localhost}
    depends_on:
      - slides
      - yjs-server

volumes:
  caddy-data:
  caddy-config:
  # yjs-data:
```

### Dockerfile (slides — multi-stage)

```dockerfile
# docker/Dockerfile
# Stage 1: Build
FROM node:22-alpine AS builder

WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/engine/package.json packages/engine/
COPY packages/cli/package.json packages/cli/

RUN npm ci --workspace=@geekslides/engine --workspace=@geekslides/cli

COPY packages/engine/ packages/engine/
COPY packages/cli/ packages/cli/
COPY tsconfig.json vite.config.ts ./

RUN npm run build --workspace=@geekslides/engine

# Stage 2: Serve with Caddy
FROM caddy:2-alpine

COPY --from=builder /app/packages/engine/dist /srv/slides
COPY docker/Caddyfile.slides /etc/caddy/Caddyfile

EXPOSE 5173
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile"]
```

### Dockerfile.server (yjs-server)

```dockerfile
# docker/Dockerfile.server
FROM node:22-alpine

WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/server/package.json packages/server/

RUN npm ci --workspace=@geekslides/server --omit=dev

COPY packages/server/ packages/server/

EXPOSE 1234
USER node
CMD ["node", "packages/server/src/index.js"]
```

### Caddyfile

```caddyfile
# docker/Caddyfile
{$DOMAIN:localhost} {
    # Static slides files
    handle /* {
        reverse_proxy slides:5173
    }

    # Yjs WebSocket
    handle /ws {
        reverse_proxy yjs-server:1234
    }

    # HTTPS (automatic with real domain, self-signed for localhost)
    tls {$ACME_EMAIL:internal}
}
```

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

```bash
# Clone and install
git clone <repo>
cd geekslides
npm install

# Start dev server (watches all packages)
npm run dev
# → Engine dev server: http://localhost:5173
# → Yjs server: ws://localhost:1234
# → HMR active for .ts, .css, .md, .json files
```

### Developing a Presentation

```bash
# In a separate terminal, serve a presentation repo
cd ~/presentations/my-talk
npx geekslides dev
# → Opens http://localhost:5173 serving this presentation
# → Watches README.md, config.json, images/, local.css
# → HMR reloads on save, preserving current slide position
```

### Development with Docker

```bash
# Build and run with docker compose
cd docker
CONTENT_DIR=~/presentations/my-talk docker compose up --build

# Access at https://localhost (self-signed cert)
```

## Production Deployment

### Quick Deploy

```bash
# On a server with Docker installed
git clone <repo>
cd geekslides/docker

# Set environment
export DOMAIN=slides.example.com
export ACME_EMAIL=admin@example.com

# Build and start
docker compose up -d --build
```

### With External Presentation Content

```bash
# Serve a specific presentation
CONTENT_DIR=/path/to/presentation docker compose up -d
```

### Azure Static Website (Alternative)

For static deployments without real-time sync:

```bash
# Build static site
npm run build

# Upload to Azure Blob Storage
az storage blob upload-batch \
  --account-name $STORAGE_ACCOUNT \
  --source packages/engine/dist \
  --destination '$web'
```

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

```yaml
# docker-compose.yml additions
services:
  slides:
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:5173/"]
      interval: 30s
      timeout: 5s
      retries: 3

  yjs-server:
    healthcheck:
      test: ["CMD", "node", "-e", "const ws = new (require('ws'))('ws://localhost:1234'); ws.on('open', () => { ws.close(); process.exit(0); }); ws.on('error', () => process.exit(1));"]
      interval: 30s
      timeout: 5s
      retries: 3
```

## Checklist

- [ ] `DOMAIN` environment variable set for production
- [ ] `ACME_EMAIL` set (not `internal`) for real Let's Encrypt certs
- [ ] Firewall allows ports 80, 443
- [ ] DNS A record points to server IP
- [ ] Content directory mounted or baked into image
- [ ] yjs-server persistence enabled if room state should survive restarts
- [ ] Docker volumes backed up (caddy-data for certificates)
