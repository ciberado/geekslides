#!/usr/bin/env bash
# publish-packages.sh — publish @geekslides/cli, server, and hub to npm.
#
# Usage:
#   ./publish-packages.sh [--dry-run]
#
# Auth (choose one):
#   1. Set NPM_TOKEN env var:   NPM_TOKEN=<token> ./publish-packages.sh
#   2. Already logged in via:   npm login  (or ~/.npmrc has a token)

set -euo pipefail

DRY_RUN=""
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN="--dry-run"
  echo "▶ Dry-run mode — nothing will actually be published."
fi

# Build a temporary .npmrc that includes the auth token if NPM_TOKEN is set.
# Otherwise fall back to the default npmrc (~/.npmrc or project .npmrc).
NPMRC_FILE="${HOME}/.npmrc"
TEMP_NPMRC=""

if [[ -n "${NPM_TOKEN:-}" ]]; then
  TEMP_NPMRC="$(mktemp)"
  # Preserve existing .npmrc entries (if any), then add/override the token.
  [[ -f "${NPMRC_FILE}" ]] && cat "${NPMRC_FILE}" > "${TEMP_NPMRC}"
  echo "//registry.npmjs.org/:_authToken=${NPM_TOKEN}" >> "${TEMP_NPMRC}"
  NPMRC_FILE="${TEMP_NPMRC}"
  trap 'rm -f "${TEMP_NPMRC}"' EXIT
fi

PACKAGES=(cli server hub)

for pkg in "${PACKAGES[@]}"; do
  dir="packages/${pkg}"
  name=$(node -p "require('./${dir}/package.json').name")
  version=$(node -p "require('./${dir}/package.json').version")
  echo ""
  echo "▶ Publishing ${name}@${version} …"
  npm publish "./${dir}" --access=public --userconfig="${NPMRC_FILE}" ${DRY_RUN}
done

echo ""
echo "✓ Done."
