# Release Process

How to ship a new version of GeekSlides (git tag + Docker images).

## Single Command

```bash
npm run release
```

This runs `scripts/release.sh` which orchestrates the full flow.

## Steps (in order)

1. **Preflight checks** — Validates:
   - Working tree is clean (no uncommitted changes)
   - Git tag `v<version>` doesn't already exist
   - All `packages/*/package.json` have the same version

2. **Create git tag** — `git tag v<version>` using the version from `packages/hub/package.json`

3. **Push git** — `git push origin main v<version>` (commits + tag together)

4. **Build Docker images** — `scripts/docker-build-push.sh --build`
   - Detects the tag on HEAD → uses clean `:version` + `:latest` tags
   - Runs `scripts/docker-image-smoke.sh` between build and push

5. **Push Docker images** — `scripts/docker-build-push.sh --push`

## Why This Order Matters

The Docker build script (`scripts/docker-build-push.sh`) determines image tags by running:

```bash
git tag --points-at HEAD
```

- If HEAD has a tag → images are tagged `:2.5.0` + `:latest` ✓
- If HEAD has no tag → images are tagged `:2.5.0-a958a65` (dev build)

Therefore: **git tag must exist before docker build**.

The release script ensures this ordering automatically.

## Dry Run

Preview what would happen without executing:

```bash
npm run release:dry
```

## Manual Release (Step by Step)

If you need to run steps individually:

```bash
# 1. Ensure all packages have the same version
grep '"version"' packages/*/package.json

# 2. Create and push the tag
git tag v2.5.0
git push origin main v2.5.0

# 3. Build (tag is now on HEAD, so images get clean version)
npm run docker:build

# 4. Push
npm run docker:push
```

## Version Bump Checklist

Before releasing, bump the version:

1. Update `packages/*/package.json` — all 5 packages must have the same version
2. Add a `## [X.Y.Z] - YYYY-MM-DD` entry to `CHANGELOG.md`
3. Commit: `chore: bump version to X.Y.Z`

## Docker Tag Strategy

| Scenario | Image tag(s) |
|----------|-------------|
| HEAD has git tag `v2.5.0` | `:2.5.0`, `:latest` |
| HEAD is untagged | `:<pkg-version>-<short-sha>` |

The `:latest` tag is only updated for tagged releases.

## Images Published

| Image | Description |
|-------|-------------|
| `ciberado/geekslides` | Full container (SPA + sync + Caddy) |
| `ciberado/geekslides-server` | Sync server only |
| `ciberado/geekslides-hub` | Hub server (multi-deck management) |
| `ciberado/geekslides-cli` | CLI tool (slim, no browser) |
| `ciberado/geekslides-cli:*-chromium` | CLI tool with Chromium (for PDF export) |
