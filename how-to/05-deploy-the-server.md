# Deploy the Server

GeekSlides ships as a single Docker container that bundles the SPA, the sync server, and a Caddy reverse proxy with automatic HTTPS. This guide covers every deployment scenario from a quick local test to production.

## What gets deployed

The Docker image contains three layers:

| Component | Role | Port |
|---|---|---|
| **Caddy** | Reverse proxy, static file server, automatic TLS | 80, 443 |
| **Yjs WebSocket server** | Real-time sync (CRDT) + content proxy API | 1234 (internal) |
| **SPA bundle** | The GeekSlides frontend | served by Caddy |

Caddy routes requests internally:

```
/ws*      → WebSocket server (sync)
/api/*    → Content proxy API
/deck/*   → Mounted deck files (optional)
/*        → SPA (with fallback to index.html)
```

## Quick start with Docker Compose

### With a local deck mounted

```bash
DOMAIN=localhost \
ACME_EMAIL=internal \
CONTENT_DIR=/path/to/my-talk \
docker compose -f docker/docker-compose.yml up -d
```

Open `https://localhost` (accept the self-signed certificate). Your slides are served at `/deck/`.

### Server-only (no local content)

Skip `CONTENT_DIR` to deploy just the server. Presenters upload their deck through the content proxy at runtime:

```bash
DOMAIN=slides.example.com \
ACME_EMAIL=you@example.com \
docker compose -f docker/docker-compose.yml up -d
```

Then open:

```
https://slides.example.com/?config=https://other-host.com/my-talk/config.json
```

The `?config=` parameter accepts a directory URL too — `config.json` is appended automatically:

```
https://slides.example.com/?config=https://other-host.com/my-talk
```

Or use the `load` command in the terminal to load any deck by URL.

## Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `DOMAIN` | `localhost` | Domain for Caddy's HTTPS certificate |
| `ACME_EMAIL` | `internal` | Let's Encrypt email. Use `internal` for self-signed certs |
| `CONTENT_DIR` | `.` (current directory) | Path to deck directory to mount at `/deck/` |

## Production deployment

For a real domain with automatic Let's Encrypt certificates:

```bash
DOMAIN=slides.yourcompany.com \
ACME_EMAIL=ops@yourcompany.com \
docker compose -f docker/docker-compose.yml up -d
```

**Requirements:**
- Port 80 and 443 open and reachable from the internet
- DNS pointing `slides.yourcompany.com` to your server
- The `ACME_EMAIL` must be a valid email (Let's Encrypt requires it)

Caddy handles certificate issuance, renewal, and HTTPS redirect automatically.

### Persistent volumes

The Compose file defines two volumes:

```yaml
volumes:
  caddy-data:     # TLS certificates — keep this across deployments
  caddy-config:   # Caddy runtime config
```

These persist certificate data, so you don't hit Let's Encrypt rate limits on redeployment.

## Building the Docker image

If you want to build the image yourself instead of using Compose:

```bash
docker build -f docker/Dockerfile -t geekslides .
```

The build is a three-stage process:

1. **app-builder** — Installs deps, builds the SPA
2. **server-builder** — Installs deps, builds the sync server (esbuild → CJS)
3. **runtime** — Alpine + Node 22 + Caddy, copies only the built artifacts

Run it directly:

```bash
docker run -d \
  -p 80:80 -p 443:443 \
  -e DOMAIN=localhost \
  -e ACME_EMAIL=internal \
  -v /path/to/deck:/srv/content:ro \
  geekslides
```

## Health checks

The container includes a health check against Caddy's admin API:

```bash
docker inspect --format='{{.State.Health.Status}}' <container>
```

Caddy's admin endpoint runs on port 2019 internally.

## Architecture overview

```
┌──────────────────────────────────────────────────┐
│  Docker Container                                │
│                                                  │
│  ┌────────────────────────────────────────────┐  │
│  │  Caddy (PID 1)                             │  │
│  │  :80 → redirect to :443                    │  │
│  │  :443 → TLS termination                    │  │
│  │    /ws*   → localhost:1234                  │  │
│  │    /api/* → localhost:1234                  │  │
│  │    /deck/ → /srv/content/                  │  │
│  │    /*     → /srv/slides/ (SPA)             │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  ┌────────────────────────────────────────────┐  │
│  │  Node.js (background)                      │  │
│  │  Yjs WebSocket server + Content API        │  │
│  │  :1234                                     │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  /srv/slides/   ← Built SPA                     │
│  /srv/content/  ← Mounted deck (optional, ro)   │
└──────────────────────────────────────────────────┘
```

## Deploying to a cloud VM

A minimal deployment on any Linux VM:

```bash
# Install Docker
curl -fsSL https://get.docker.com | sh

# Clone and deploy
git clone https://github.com/ciberado/geekslides.git
cd geekslides

DOMAIN=slides.example.com \
ACME_EMAIL=you@example.com \
docker compose -f docker/docker-compose.yml up -d
```

That's it. Caddy obtains the TLS certificate on first request.

## Updating

Pull the latest code and rebuild:

```bash
git pull
docker compose -f docker/docker-compose.yml up -d --build
```

The `caddy-data` volume preserves your certificates across rebuilds.

## Troubleshooting

**Certificate errors in browser**
If `ACME_EMAIL=internal`, Caddy generates a self-signed certificate. This is expected for local development. For production, use a real email address.

**WebSocket connection fails**
Make sure your reverse proxy / load balancer supports WebSocket upgrades. If you're behind Cloudflare, enable WebSocket support in the dashboard.

**Content proxy returns 404**
The presenter must join a room (`?room=name`) and the content is uploaded automatically. The upload happens client-side when sync is enabled.

---

Next: [Export to PDF →](06-export-to-pdf.md)
