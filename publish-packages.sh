#!/usr/bin/env bash
# publish-packages.sh — publish @geekslides/cli, server, and hub to npm.
#
# Usage:
#   NPM_TOKEN=<token> ./publish-packages.sh [--dry-run]
#
# The NPM_TOKEN environment variable must be set (or ~/.npmrc must already
# contain an auth token for registry.npmjs.org).

set -euo pipefail

DRY_RUN=""
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN="--dry-run"
  echo "▶ Dry-run mode — nothing will actually be published."
fi

# If a token is provided via env, write it to a temporary .npmrc scoped to
# this process so it doesn't persist on disk after the script exits.
if [[ -n "${NPM_TOKEN:-}" ]]; then
  export npm_config_userconfig="$(mktemp)"
  echo "//registry.npmjs.org/:_authToken=${NPM_TOKEN}" > "${npm_config_userconfig}"
  trap 'rm -f "${npm_config_userconfig}"' EXIT
fi

PACKAGES=(cli server hub)

for pkg in "${PACKAGES[@]}"; do
  dir="packages/${pkg}"
  name=$(node -p "require('./${dir}/package.json').name")
  version=$(node -p "require('./${dir}/package.json').version")
  echo ""
  echo "▶ Publishing ${name}@${version} …"
  npm publish "./${dir}" --access=public ${DRY_RUN}
done

echo ""
echo "✓ Done."
