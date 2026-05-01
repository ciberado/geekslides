# Phase 14: CLI Docker Image

**Status**: Implemented (dev/create/build/pdf smoke tests pass in container)
**Depends on**: Phase 9 (CLI Tooling), Phase 11 (Deployment)

## Goal

Package the `@geekslides/cli` tool as a Docker image that outputs a self-installing wrapper
script, enabling users to run all CLI commands without installing Node.js locally.

## Deliverables

### Code

| File | Description |
|------|-------------|
| `docker/Dockerfile.cli` | Multi-target Dockerfile (slim + chromium) |
| `docker/cli-entrypoint.sh` | Entrypoint: prints wrapper script or runs CLI |

### Tests

| File | Description |
|------|-------------|
| `packages/cli/tests/unit/docker-wrapper.test.ts` | Unit tests for wrapper script generation |

### Documentation

| File | Description |
|------|-------------|
| `vibe/features/cli-docker-image.md` | Architecture and design doc |
| `vibe/features/deployment-v2.md` | Updated with CLI image section |
| `how-to/10-use-the-docker-cli.md` | How-to guide for Docker-based CLI usage |

## Acceptance Criteria

- [x] `docker build --target slim -f docker/Dockerfile.cli .` succeeds.
- [x] `docker build --target chromium -f docker/Dockerfile.cli .` succeeds.
- [x] `docker run --rm <image>` outputs a valid shell script (validated with local test tags).
- [x] Generated script correctly mounts volumes and maps ports.
- [x] `./geekslides dev` starts the dev server accessible on port 3000. Validated with smoke test (`timeout` run using wrapper with `GEEKSLIDES_PORT=4567` to avoid local host port conflicts).
- [x] `./geekslides build` produces a production bundle. Fixed: added `target: 'es2022'` to inline Vite config in `build.ts`.
- [x] `./geekslides create --title Test` scaffolds a new deck.
- [x] `./geekslides pdf --config config.json` works with `:chromium` tag. Fixed: removed separate `chromium-deps` playwright install; chromium stage now runs `playwright install chromium` using the workspace playwright version (1.58.2) after copying builder's `node_modules`.
- [x] Unit tests exist for wrapper script content validation.
- [x] How-to guide covers installation and the main commands.

## Review Notes

- `docker/Dockerfile.cli` includes both `slim` and `chromium` targets and sets image defaults for wrapper generation.
- `docker/cli-entrypoint.sh` emits a wrapper script when stdout is piped and executes the CLI directly when arguments are provided.
- `packages/cli/tests/docker-wrapper.test.ts` covers script generation, default image selection, port mapping, mount behavior, and shell syntax validation.
- During smoke validation, `docker/Dockerfile.cli` needed fixes for runtime dependency completeness and workspace package wiring.
- Runtime defects found during smoke testing were resolved: build target mismatch, Chromium runtime dependencies, Playwright/browser version mismatch, and duplicate sync-server startup in `dev` mode.
