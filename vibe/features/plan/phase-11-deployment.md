# Phase 11: Deployment

**Status**: In progress (implementation landed; deployment validation and root README Docker quick-start are pending)
**Depends on**: Phase 9 (build output for static serving, server package)
**Unlocks**: Phase 12 (E2E tests can run against Docker setup)

## Goal

Create the Docker and Docker Compose configuration for production deployment:
multi-stage Dockerfile for the slides static build, Dockerfile for the yjs-server,
Caddy reverse proxy configuration, and environment variable documentation.

At the end of this phase, `docker compose up` starts a fully functional
presentation server with HTTPS, WebSocket sync, and static file serving.

## Deliverables

### 1. Slides Dockerfile (`docker/Dockerfile`)

Multi-stage build:

**Stage 1 (builder)**: `node:22-alpine` base. Copies workspace root `package.json`,
engine and CLI `package.json` files. Runs `npm ci` for those workspaces. Copies all
source files, `tsconfig.json`, and `vite.config.ts`. Runs the build command.

**Stage 2 (serve)**: `caddy:2-alpine` base. Copies the built `dist/` from the builder
stage into `/srv/slides`. Copies a minimal Caddyfile for static serving. Exposes
port 5173.

### 2. Server Dockerfile (`docker/Dockerfile.server`)

Single-stage build: `node:22-alpine` base. Copies workspace root and server
`package.json`. Runs `npm ci --workspace=@geekslides/server --omit=dev`. Copies
server source. Exposes port 1234. Runs as `node` user. Entry point:
`node packages/server/src/index.js`.

> **Bug**: The current `CMD` in `docker/Dockerfile.server` points at
> `packages/server/src/index.ts` (a TypeScript file). Node cannot execute `.ts`
> files directly, so the server container will fail to start at runtime. Fix:
> either add a `tsc` compile step in the Dockerfile and point CMD at the compiled
> `.js` output, or add `tsx` as a production dependency and use
> `CMD ["npx", "tsx", "packages/server/src/index.ts"]`.

### 3. Docker Compose (`docker/docker-compose.yml`)

Three services:

- **slides**: Build from `docker/Dockerfile`. Restart unless stopped. Mount
  `$CONTENT_DIR` (default `.`) as read-only at `/srv/content`.

- **yjs-server**: Build from `docker/Dockerfile.server`. Restart unless stopped.
  Environment: `PORT=1234`, `HOST=0.0.0.0`. Optional `yjs-data` volume for
  LevelDB persistence.

- **caddy**: Use `caddy:2-alpine` image. Map ports 80 and 443. Mount the
  Caddyfile as read-only. Named volumes `caddy-data` and `caddy-config`.
  Environment: `DOMAIN` (default `localhost`). Depends on slides and yjs-server.

### 4. Caddyfile (`docker/Caddyfile`)

- Listen on `{$DOMAIN}` (configured via environment).
- Route `/*` → `slides:5173` (static files reverse proxy).
- Route `/ws` → `yjs-server:1234` (WebSocket reverse proxy, with proper upgrade headers).
- TLS via `{$ACME_EMAIL}` — `internal` for self-signed (dev), email address for
  Let's Encrypt (production).

### 5. Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DOMAIN` | `localhost` | Domain for Caddy HTTPS cert |
| `ACME_EMAIL` | `internal` | Let's Encrypt email or `internal` for self-signed |
| `CONTENT_DIR` | `.` | Host path to presentation content |
| `PORT` | `1234` | yjs-server WebSocket port |

### 6. Health checks

Add Docker health checks to both services:
- **slides**: `curl -f http://localhost:5173/ || exit 1` every 30 s.
- **yjs-server**: TCP check on port 1234 every 30 s.

### 7. .dockerignore

Exclude `node_modules/`, `dist/`, `coverage/`, `.git/`, `e2e/`, `vibe/`.

### 8. Documentation update

Update the root `README.md` with quick-start instructions for Docker deployment.

## File List

```
docker/
├── Dockerfile
├── Dockerfile.server
├── docker-compose.yml
├── Caddyfile
└── .dockerignore
```

## Acceptance Criteria

- [ ] `docker compose up --build` starts all three services without errors. *(Blocked by `Dockerfile.server` CMD bug)*
- [ ] Presentation is accessible at `https://localhost` (self-signed cert).
- [ ] WebSocket sync works through `wss://localhost/ws`.
- [ ] Health checks pass for both services.
- [ ] `CONTENT_DIR` mount correctly serves external presentation content.
- [ ] `.dockerignore` file exists. *(Not yet created)*
- [ ] Root `README.md` Docker quick-start section. *(Not yet written)*
- [ ] Setting `DOMAIN` and `ACME_EMAIL` to real values enables Let's Encrypt.
- [ ] Images are minimal (Alpine-based, no unnecessary files).
- [ ] Root `README.md` includes Docker deployment quick-start instructions.

## Reference Docs

- [deployment-v2.md](../deployment-v2.md) — full Docker architecture, Caddyfile, env vars
- [decisions.md](../decisions.md) — D18 (two-service Docker topology)
