#!/usr/bin/env bash
# docker-build-push.sh — Build and push all GeekSlides Docker images.
#
# Tag strategy:
#   - When HEAD is exactly on a git tag (a "release"):
#       → tags the image as :<version>  AND  :latest
#   - Otherwise (untagged commit):
#       → tags as <package-version>-<short-sha> only  (no :latest)
#
# Usage:
#   ./scripts/docker-build-push.sh          # build + push
#   ./scripts/docker-build-push.sh --build  # build only
#   ./scripts/docker-build-push.sh --push   # push only (images must already exist)

set -euo pipefail

# ── resolve version tag ──────────────────────────────────────────────────────
GIT_TAG=$(git tag --points-at HEAD 2>/dev/null | grep -E '^v?[0-9]' | head -1 || true)

if [[ -n "$GIT_TAG" ]]; then
  VERSION="${GIT_TAG#v}"   # strip leading "v" if present
  IS_RELEASE=true
  echo "→ Release tag detected: ${GIT_TAG}  (will also update :latest)"
else
  PKG_VERSION=$(node -p "require('./packages/hub/package.json').version" 2>/dev/null || echo "0.0.0")
  SHORT_SHA=$(git rev-parse --short HEAD)
  VERSION="${PKG_VERSION}-${SHORT_SHA}"
  IS_RELEASE=false
  echo "→ Untagged commit: ${VERSION}  (:latest will NOT be updated)"
fi

echo ""

# ── helper: tags for a given base image name ──────────────────────────────────
tags_for() {
  local image="$1"
  local suffix="${2:-}"
  local t="-t ${image}:${VERSION}${suffix}"
  if [[ "$IS_RELEASE" == "true" ]]; then
    t+=" -t ${image}:latest${suffix}"
  fi
  echo "$t"
}

push_tags_for() {
  local image="$1"
  local suffix="${2:-}"
  docker push "${image}:${VERSION}${suffix}"
  if [[ "$IS_RELEASE" == "true" ]]; then
    docker push "${image}:latest${suffix}"
  fi
}

# ── image definitions ─────────────────────────────────────────────────────────
declare -A IMAGES=(
  ["ciberado/geekslides"]="docker/Dockerfile"
  ["ciberado/geekslides-server"]="docker/Dockerfile.server"
  ["ciberado/geekslides-hub"]="docker/Dockerfile.hub"
)

CLI_IMAGE="ciberado/geekslides-cli"
CLI_DOCKERFILE="docker/Dockerfile.cli"

MODE="${1:-}"   # --build | --push | (empty = both)

# ── build ─────────────────────────────────────────────────────────────────────
if [[ "$MODE" != "--push" ]]; then
  echo "── Building images ────────────────────────────────────────────────────"

  for IMAGE in "${!IMAGES[@]}"; do
    DOCKERFILE="${IMAGES[$IMAGE]}"
    echo "  ${IMAGE}:${VERSION}"
    # shellcheck disable=SC2046
    docker build $(tags_for "$IMAGE") -f "${DOCKERFILE}" .
  done

  echo "  ${CLI_IMAGE}:${VERSION}  (slim)"
  # shellcheck disable=SC2046
  docker build --target slim $(tags_for "$CLI_IMAGE") -f "${CLI_DOCKERFILE}" .

  # chromium uses a "-chromium" suffix so the versioned tag doesn't collide with slim
  echo "  ${CLI_IMAGE}:${VERSION}-chromium"
  # shellcheck disable=SC2046
  docker build --target chromium $(tags_for "$CLI_IMAGE" "-chromium") -f "${CLI_DOCKERFILE}" .

  echo "── Build complete ──────────────────────────────────────────────────────"

  echo ""
  echo "── Image smoke checks ─────────────────────────────────────────────────"
  bash "$(dirname "$0")/docker-image-smoke.sh" "$VERSION"
fi

# ── push ──────────────────────────────────────────────────────────────────────
if [[ "$MODE" != "--build" ]]; then
  echo ""
  echo "── Pushing images ─────────────────────────────────────────────────────"

  for IMAGE in "${!IMAGES[@]}"; do
    push_tags_for "$IMAGE"
  done

  push_tags_for "$CLI_IMAGE"
  push_tags_for "$CLI_IMAGE" "-chromium"

  echo "── Push complete ───────────────────────────────────────────────────────"
fi

echo ""
echo "Done.  Tagged as :${VERSION}${IS_RELEASE:+ and :latest}"
