#!/usr/bin/env bash
# release.sh — One-command release: tag, build, push git + Docker.
#
# Reads the version from packages/hub/package.json, creates a git tag,
# builds Docker images (which will detect the tag), and pushes everything.
#
# Usage:
#   ./scripts/release.sh          # full release (tag + build + push)
#   ./scripts/release.sh --dry    # show what would happen, don't execute
#
# Prerequisites:
#   - Working tree must be clean (all changes committed)
#   - Version in package.json must not already have a corresponding git tag
#   - Docker must be logged in to push images

set -euo pipefail

DRY_RUN=false
[[ "${1:-}" == "--dry" ]] && DRY_RUN=true

# ── read version ──────────────────────────────────────────────────────────────
VERSION=$(node -p "require('./packages/hub/package.json').version")
TAG="v${VERSION}"

echo "╭────────────────────────────────────────╮"
echo "│  GeekSlides release ${VERSION}          "
echo "╰────────────────────────────────────────╯"
echo ""

# ── preflight checks ─────────────────────────────────────────────────────────
ERRORS=()

# Clean working tree
if [[ -n "$(git status --porcelain)" ]]; then
  ERRORS+=("Working tree is dirty — commit or stash changes first.")
fi

# Tag doesn't already exist
if git rev-parse "$TAG" >/dev/null 2>&1; then
  ERRORS+=("Git tag ${TAG} already exists. Bump the version first.")
fi

# All package.json versions match
VERSIONS=$(grep '"version"' packages/*/package.json | awk -F'"' '{print $4}' | sort -u)
if [[ $(echo "$VERSIONS" | wc -l) -ne 1 ]]; then
  ERRORS+=("Package versions are inconsistent: $(echo "$VERSIONS" | tr '\n' ' ')")
fi

if [[ ${#ERRORS[@]} -gt 0 ]]; then
  echo "✗ Preflight failed:"
  for err in "${ERRORS[@]}"; do
    echo "  • $err"
  done
  exit 1
fi

echo "  ✓ Working tree clean"
echo "  ✓ Tag ${TAG} available"
echo "  ✓ All packages at ${VERSION}"
echo ""

if [[ "$DRY_RUN" == "true" ]]; then
  echo "── Dry run — would execute: ────────────────────────────────────────────"
  echo "  1. git tag ${TAG}"
  echo "  2. git push origin main ${TAG}"
  echo "  3. npm run docker:build   (images tagged :${VERSION} and :latest)"
  echo "  4. npm run docker:push"
  echo ""
  echo "Run without --dry to execute."
  exit 0
fi

# ── 1. create git tag ─────────────────────────────────────────────────────────
echo "── Creating tag ${TAG} ──────────────────────────────────────────────────"
git tag "$TAG"
echo "  ✓ Tagged HEAD as ${TAG}"
echo ""

# ── 2. push git (commits + tag) ──────────────────────────────────────────────
echo "── Pushing to origin ────────────────────────────────────────────────────"
git push origin main "$TAG"
echo "  ✓ Pushed main + ${TAG}"
echo ""

# ── 3. build Docker images ───────────────────────────────────────────────────
echo "── Building Docker images ───────────────────────────────────────────────"
bash scripts/docker-build-push.sh --build
echo ""

# ── 4. push Docker images ───────────────────────────────────────────────────
echo "── Pushing Docker images ────────────────────────────────────────────────"
bash scripts/docker-build-push.sh --push
echo ""

echo "╭────────────────────────────────────────╮"
echo "│  ✓ Release ${VERSION} complete          "
echo "│                                         "
echo "│  Git:    ${TAG} pushed to origin        "
echo "│  Docker: :${VERSION} and :latest pushed "
echo "╰────────────────────────────────────────╯"
