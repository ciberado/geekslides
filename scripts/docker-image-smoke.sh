#!/usr/bin/env bash
# docker-image-smoke.sh — Verify built Docker images contain required files.
#
# Run AFTER docker build, BEFORE docker push.  Exits non-zero if any check
# fails so the push step is skipped.
#
# Checks:
#   ciberado/geekslides         — SPA served, all plugin bundles present,
#                                 plugin JS is not HTML (SPA fallback)
#   ciberado/geekslides-hub     — jsdom available at runtime, not bundled
#
# Usage:
#   ./scripts/docker-image-smoke.sh <version-tag>
#   ./scripts/docker-image-smoke.sh 2.4.5

set -euo pipefail

VERSION="${1:-latest}"
PASS=0
FAIL=0

pass() { echo "  ✓ $*"; ((PASS+=1)); }
fail() { echo "  ✗ $*" >&2; ((FAIL+=1)); }

check_image() {
  local image="$1"; shift
  local cmd="$*"
  docker run --rm --entrypoint sh "$image" -c "$cmd" 2>/dev/null
}

# ── ciberado/geekslides ───────────────────────────────────────────────────────
echo ""
echo "── Checking ciberado/geekslides:${VERSION} ─────────────────────────────"

IMAGE="ciberado/geekslides:${VERSION}"

# SPA shell
if check_image "$IMAGE" 'test -f /srv/slides/index.html' >/dev/null 2>&1; then
  pass "SPA index.html present"
else
  fail "SPA index.html MISSING at /srv/slides/index.html"
fi

# All expected plugin bundles
for PLUGIN in core media chart mermaid css-doodle whiteboard poll; do
  PLUGIN_PATH="/srv/slides/plugins/dist/${PLUGIN}/index.js"
  if check_image "$IMAGE" "test -f ${PLUGIN_PATH}" >/dev/null 2>&1; then
    pass "Plugin bundle: ${PLUGIN}"
  else
    fail "Plugin bundle MISSING: ${PLUGIN_PATH}"
  fi
done

# Plugin JS must not be HTML (would happen if Caddy serves SPA fallback instead)
FIRST_LINE=$(check_image "$IMAGE" "head -1 /srv/slides/plugins/dist/core/index.js" 2>/dev/null || echo "")
if echo "$FIRST_LINE" | grep -qi '<!doctype\|<html'; then
  fail "plugins/dist/core/index.js looks like HTML (SPA fallback?): ${FIRST_LINE}"
else
  pass "Plugin core/index.js is not HTML"
fi

# ── ciberado/geekslides-hub ───────────────────────────────────────────────────
echo ""
echo "── Checking ciberado/geekslides-hub:${VERSION} ──────────────────────────"

HUB="ciberado/geekslides-hub:${VERSION}"

# jsdom must be external (not bundled)
if check_image "$HUB" 'grep -q "default-stylesheet" /app/index.cjs' >/dev/null 2>&1; then
  fail "jsdom IS bundled (default-stylesheet found in /app/index.cjs)"
else
  pass "jsdom not bundled in /app/index.cjs"
fi

# jsdom must be available as an external module
if check_image "$HUB" 'test -f /app/node_modules/jsdom/package.json' >/dev/null 2>&1; then
  pass "jsdom available at /app/node_modules/jsdom"
else
  fail "jsdom MISSING from /app/node_modules/jsdom"
fi

# Better-sqlite3 native addon must be present
if check_image "$HUB" 'find /app/node_modules/better-sqlite3 -name "*.node" | grep -q .' >/dev/null 2>&1; then
  pass "better-sqlite3 native addon present"
else
  fail "better-sqlite3 native addon MISSING"
fi

# ── summary ───────────────────────────────────────────────────────────────────
echo ""
echo "── Image smoke results ────────────────────────────────────────────────"
echo "   Passed: ${PASS}   Failed: ${FAIL}"
if [[ $FAIL -gt 0 ]]; then
  echo ""
  echo "✗ Image smoke FAILED — fix the issues above before pushing."
  exit 1
fi
echo ""
echo "✓ All image smoke checks passed."
