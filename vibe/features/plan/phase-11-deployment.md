# Phase 11: Deployment

**Status**: In progress (runtime smoke testing executed; core HTTPS/API path validated, with remaining operational issues documented below)
**Depends on**: Phase 9 (build output for static serving, server package)
**Unlocks**: Phase 12 (E2E tests can run against Docker setup)

## Goal

Create the Docker and Docker Compose configuration for production deployment:
multi-stage Dockerfiles for the bundled viewer/server runtime and supporting services,
Caddy reverse proxy configuration, and environment variable documentation.

At the end of this phase, the repo contains a deployable Docker stack that serves
the SPA, `/deck/*` content, `/api/*`, and `/ws*` behind Caddy, with an optional Hub service.

## Deliverables

### 1. Runtime Dockerfile (`docker/Dockerfile`)

Multi-stage build:

**Stage 1 (app-builder)**: `node:22-alpine` base. Installs workspace dependencies,
copies engine/cli sources, and builds the SPA shell.

**Stage 2 (server-builder)**: `node:22-alpine` base. Installs server dependencies,
copies server sources, and builds the compiled Node server bundle.

**Stage 3 (runtime)**: `node:22-alpine` plus `caddy`. Bundles the SPA in `/srv/slides`,
the welcome deck in `/srv/content`, the compiled server as `index.cjs`, and launches
both services through `docker/entrypoint.sh`.

### 2. Server Dockerfile (`docker/Dockerfile.server`)

Dedicated server image for standalone deployments and debugging. It now compiles the
server in a builder stage, copies `dist/index.cjs` into a slim runtime image, exposes
port `1234`, and includes a TCP health check.

### 3. Docker Compose (`docker/docker-compose.yml`)

Current compose file defines two services:

- **geekslides**: Build from `docker/Dockerfile`. Restart unless stopped. Terminates
  TLS in Caddy, serves the bundled SPA, proxies `/ws*` and `/api/*` to the local
  Node server, and mounts `$CONTENT_DIR` (default `.`) read-only at `/srv/content`.

- **hub**: Optional Fastify/Lit Hub service built from `docker/Dockerfile.hub` and
  published on port `3000`.

### 4. Caddyfile (`docker/Caddyfile`)

- Listen on `{$DOMAIN}` (configured via environment).
- Serve mounted deck content from `/srv/content` under `/deck/*`.
- Proxy `/ws*` and `/api/*` to the local Node server on port `1234`.
- Proxy `/hub/*` to the local Hub service on port `3000`.
- Serve the SPA shell from `/srv/slides` with `try_files` fallback.
- TLS via `{$ACME_EMAIL}` — `internal` for self-signed (dev), email address for
  Let's Encrypt (production).

### 5. Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DOMAIN` | `localhost` | Domain for Caddy HTTPS cert |
| `ACME_EMAIL` | `internal` | Let's Encrypt email or `internal` for self-signed |
| `CONTENT_DIR` | `.` | Host path to presentation content |
| `VIEWER_BASE_URL` | `http://localhost` | External base URL forwarded to the Hub |

### 6. Health checks

Health checks are present on the bundled runtime image and the standalone server image:
- **docker/Dockerfile**: probes the Caddy admin endpoint on `127.0.0.1:2019/config/`
- **docker/Dockerfile.server**: TCP probe against port `1234`

### 7. .dockerignore

Exclude `node_modules/`, `dist/`, `coverage/`, `.git/`, `e2e/`, `vibe/`.

### 8. Documentation update

Deployment guidance lives in [deployment-v2.md](../deployment-v2.md) and
[how-to/05-deploy-the-server.md](../../../how-to/05-deploy-the-server.md).
The root `README.md` still only contains light Docker context, so a concise quick-start
there remains a follow-up.

## File List

```
docker/
├── Dockerfile
├── Dockerfile.server
├── Dockerfile.hub
├── docker-compose.yml
├── Caddyfile
└── .dockerignore
```

## Acceptance Criteria

- [ ] `docker compose up --build` starts the current stack without errors. Smoke run built images successfully but failed to start `hub` on this host because port `3000` was already in use.
- [x] Presentation is accessible at `https://localhost` (self-signed cert).
- [ ] WebSocket sync works through `wss://localhost/ws`. Not fully validated in this run.
- [x] Health checks exist and pass for the bundled runtime image and the standalone server image.
- [x] `CONTENT_DIR` is mounted read-only into `/srv/content` by compose.
- [x] `.dockerignore` file exists.
- [ ] Root `README.md` Docker quick-start section is still thin.
- [ ] Setting `DOMAIN` and `ACME_EMAIL` to real values enables Let's Encrypt. Configuration is wired, but not validated in this run.
- [x] Images use Alpine-based runtime stages for the main deployment path.

## Smoke Test Notes (2026-05-01)

- `docker compose -f docker/docker-compose.yml up -d --build` built both `geekslides` and `hub` images.
- Compose startup failed for `hub` due host port conflict on `0.0.0.0:3000`.
- Running `geekslides` service alone succeeded and served `https://localhost/` with status `200`.
- `/api/deck-proxy` path is reachable via Caddy and forwarded to the Node server.
- The bundled image healthcheck passes after updating the probe to `http://127.0.0.1:2019/config/`.

## Reference Docs

- [deployment-v2.md](../deployment-v2.md) — full Docker architecture, Caddyfile, env vars
- [decisions.md](../decisions.md) — D18 (two-service Docker topology)
