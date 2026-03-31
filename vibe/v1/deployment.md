# Deployment Guide

## Architecture overview

```
                    Internet
                       │
              ┌────────▼────────┐
              │  Caddy :80/:443 │  Automatic HTTPS (Let's Encrypt / Tailscale)
              │                 │
              │  /mqtt  ───────▶│── localhost:8883 (Aedes WS)
              │  /slides ──────▶│── /usr/share/caddy/slides (static files)
              │  /content ─────▶│── EXTERNAL_CONTENT_URL (optional proxy)
              │  / (default) ──▶│── localhost:1234 (Parcel dev server)
              └─────────────────┘
                       │
              ┌────────▼────────┐
              │  Node processes │
              │                 │
              │  broker/        │  npm --prefix broker run start
              │  slides/        │  npm --prefix slides run start (Parcel)
              └─────────────────┘
```

All processes run inside a single Docker container. The root `package.json`
orchestrates them with `concurrently`.

---

## Docker build

### Multi-stage Dockerfile

**Stage 1: Builder** (node:lts)
```
1. Copy all source files
2. npm run install (broker + demo + slides dependencies)
3. npm --prefix slides run build  → slides/dist/
```

**Stage 2: Production** (caddy:2-alpine)
```
1. Install Node.js + npm (for running the broker)
2. Copy /app from builder
3. Copy Caddyfile to /etc/caddy/
4. Copy slides/dist/ to /usr/share/caddy/slides (static serving)
5. Create /start.sh that runs:
   - npm start (concurrently: broker + slides dev server) in background
   - caddy run (foreground, main process)
```

Exposed ports: 80 (HTTP), 443 (HTTPS).

### Build & run

```bash
# Build
docker compose build

# Run (foreground, for debugging)
docker compose up

# Run (detached)
docker compose up -d

# View logs
docker compose logs -f
```

---

## Caddy configuration

### Routes

| Path | Target | Description |
|---|---|---|
| `/mqtt*` | `localhost:8883` | MQTT WebSocket broker (with WS upgrade headers) |
| `/slides*` | `/usr/share/caddy/` | Static file server (browseable) for production builds |
| `/content*` | `EXTERNAL_CONTENT_URL` | Optional external content proxy (CDN, cloud storage) |
| `/*` (default) | `localhost:1234` | Parcel dev server (slide engine SPA) |

### HTTPS modes

1. **Let's Encrypt** (default when `DOMAIN` is set): Caddy auto-obtains and renews
   certificates
2. **Tailscale**: Set `DOMAIN=myserver.tailnet.ts.net`, Caddy uses Tailscale certs
3. **Local development**: No `DOMAIN` → listens on `:80` only (HTTP)

### WebSocket support

The `/mqtt` route includes proper headers for WebSocket upgrade:
```
header_up Host {host}
header_up X-Real-IP {remote_host}
header_up X-Forwarded-For {remote_host}
header_up X-Forwarded-Proto {scheme}
```

---

## docker-compose.yml

```yaml
services:
  geekslides:
    build: .
    ports:
      - "80:80"
      - "443:443"
    environment:
      # DOMAIN: geekslides.aprender.cloud   # For automatic HTTPS
      # ACME_EMAIL: admin@example.com        # Let's Encrypt notifications
      # EXTERNAL_CONTENT_URL: https://cdn.example.com
      TZ: Europe/Madrid
    volumes:
      - caddy_data:/data       # Persists TLS certificates
      - caddy_config:/config   # Persists Caddy config
    restart: unless-stopped
```

### Volumes

| Volume | Mount | Purpose |
|---|---|---|
| `caddy_data` | `/data` | TLS certificates, OCSP staples |
| `caddy_config` | `/config` | Caddy runtime configuration |

---

## Environment variables

| Variable | Default | Scope | Description |
|---|---|---|---|
| `DOMAIN` | `localhost` | Caddy | Domain for automatic HTTPS |
| `ACME_EMAIL` | — | Caddy | Email for Let's Encrypt notifications |
| `EXTERNAL_CONTENT_URL` | — | Caddy | Proxy `/content` to this URL |
| `TZ` | `Europe/Madrid` | Container | Timezone |
| `TCP_PORT` | 1883 | Broker | MQTT TCP port |
| `WS_PORT` | 8883 | Broker | MQTT WebSocket port |
| `WSS_PORT` | 8443 | Broker | MQTT WSS port (requires CERT_PATH) |
| `CERT_PATH` | — | Broker | TLS cert directory for WSS |
| `ADMIN_PASS` | auto-generated | Broker | Admin password |
| `NODE_ENV` | — | Broker | `dev` for verbose logging |
| `DEFAULT_HUB_HOST` | `geekslides.aprender.cloud` | Slides engine | Default MQTT server |
| `DEFAULT_HUB_PORT` | 443 | Slides engine | Default MQTT port |

---

## Local development (without Docker)

```bash
# 1. Install all dependencies (broker + slides + demo)
npm run install

# 2. Start broker + slides dev server concurrently
npm run start
```

This runs:
- **Broker**: `node broker/index.js` (MQTT on TCP:1883 + WS:8883)
- **Slides dev server**: `parcel slides/src/index.html` (HTTP:1234, HMR)

Open http://localhost:1234 and either:
- Add `?url=<presentation-base-url>` to load a remote presentation
- Press `O` to enter a presentation URL interactively

### Developing a presentation with live reload

1. Serve your presentation directory (e.g., via Python):
   ```bash
   cd /path/to/my-presentation
   python3 -m http.server 8080
   ```
2. Set `"liveReload": true` in the presentation's `config.json`
3. Open `http://localhost:1234/?url=http://localhost:8080/`
4. Edit `README.md` → browser reloads automatically

---

## Production deployment checklist

1. Set `DOMAIN` environment variable to your domain
2. Ensure ports 80 and 443 are accessible (Caddy needs them for ACME challenges)
3. Optionally set `ACME_EMAIL` for certificate notifications
4. `docker compose up -d --build`
5. Caddy obtains TLS certificate automatically
6. Access at `https://your-domain/`

### External content hosting

To host slide content on a CDN or cloud storage:
1. Set `EXTERNAL_CONTENT_URL=https://cdn.example.com`
2. Upload presentation directories to the CDN
3. Access via `https://your-domain/?url=https://your-domain/content/my-slides/`

Caddy proxies `/content/*` requests to the external URL transparently.

---

## Internal ports map

| Port | Process | Protocol | Exposed externally |
|---|---|---|---|
| 80 | Caddy | HTTP | Yes (Docker) |
| 443 | Caddy | HTTPS | Yes (Docker) |
| 1234 | Parcel (slides) | HTTP | No (internal only) |
| 1883 | Aedes (broker) | MQTT TCP | No (internal only) |
| 8883 | Aedes (broker) | MQTT WS | No (proxied via /mqtt) |
| 8443 | Aedes (broker) | MQTT WSS | No (only if CERT_PATH set) |
