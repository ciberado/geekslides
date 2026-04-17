# Phase 14: CLI Docker Image

**Status**: In Progress
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

- [ ] `docker build --target slim -f docker/Dockerfile.cli .` succeeds
- [ ] `docker build --target chromium -f docker/Dockerfile.cli .` succeeds
- [ ] `docker run --rm ciberado/geekslides-cli` outputs a valid shell script
- [ ] Generated script correctly mounts volumes and maps ports
- [ ] `./geekslides dev` starts the dev server accessible on port 3000
- [ ] `./geekslides build` produces a production bundle
- [ ] `./geekslides create --title Test` scaffolds a new deck
- [ ] `./geekslides pdf --config config.json` works with `:chromium` tag
- [ ] Unit tests pass for wrapper script content validation
- [ ] How-to guide covers installation and all commands
