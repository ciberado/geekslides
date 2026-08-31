#!/usr/bin/env bash
# start-dev.sh — Launch all GeekSlides dev services.
#
# With tmux: opens/reuses a window named "dev" with three panes:
#   pane 0  viewer (yjs-server + Vite)    :1234 + :5173
#   pane 1  hub (Fastify + Vite SPA)      :3000 (API) + :3001 (Vite SPA)
#   pane 2  caddy reverse proxy           :8080
#
# Without tmux: starts all three services as background processes.
#
# Ports in use (see Caddyfile.dev for the proxy routes):
#   :5173  viewer Vite dev server   (deck + HMR)
#   :1234  yjs-server               (real-time sync + content proxy API)
#   :3000  hub Fastify              (/hub/api/*)
#   :3001  hub Vite dev server      (/hub/* SPA + HMR)
#   :8080  Caddy reverse proxy      (single entry point: http://localhost:8080)
#   :2019  Caddy admin endpoint
#
# Caddy binary: looks for caddy in PATH first, then /tmp/caddy.
# If not found, downloads it automatically.
#
# Session selection: by default the first running session is reused.
# Set GEEKSLIDES_TMUX_SESSION=<name> to target a specific session (which may
# be a freshly created, otherwise-empty session) instead of the first one.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CADDY_BIN=""

# ─── locate / download caddy ─────────────────────────────────────────────────

find_or_install_caddy() {
  if command -v caddy &>/dev/null; then
    CADDY_BIN="caddy"
    return
  fi
  if [[ -x /tmp/caddy ]]; then
    CADDY_BIN="/tmp/caddy"
    return
  fi
  echo "[start-dev] Caddy not found — downloading v2 to /tmp/caddy..."
  local os arch
  os="$(uname -s | tr '[:upper:]' '[:lower:]')"
  arch="$(uname -m)"
  [[ "$arch" == "x86_64" ]] && arch="amd64"
  [[ "$arch" == "aarch64" ]] && arch="arm64"
  curl -fsSL "https://caddyserver.com/api/download?os=${os}&arch=${arch}" -o /tmp/caddy
  chmod +x /tmp/caddy
  CADDY_BIN="/tmp/caddy"
}

find_or_install_caddy

# ─── tmux path ────────────────────────────────────────────────────────────────

if command -v tmux &>/dev/null && tmux ls &>/dev/null 2>&1; then
  WINDOW="dev"

  # Choose the target session: the overriding env var if set, else the first
  # running session (works whether we're inside tmux or not).
  SESSION="${GEEKSLIDES_TMUX_SESSION:-$(tmux list-sessions -F '#S' | head -1)}"
  if ! tmux has-session -t "${SESSION}" 2>/dev/null; then
    echo "[start-dev] Session '${SESSION}' does not exist — creating it."
    tmux new-session -d -s "${SESSION}"
  fi

  # Kill existing dev window for a clean restart
  tmux kill-window -t "${SESSION}:${WINDOW}" 2>/dev/null || true

  # kill-window does NOT terminate foreground processes (notably Caddy, a plain
  # foreground process without --kill-others), leaving them holding the known
  # ports. Free the ports so the fresh services can bind. Otherwise a re-run
  # collides with the stale Caddy on :8080, the new pane's process exits, and
  # tmux closes the empty window.
  fuser -k 1234/tcp 5173/tcp 3000/tcp 8080/tcp 2019/tcp 2>/dev/null || true
  sleep 1

  # Create new window in that session (trailing colon = pick next free index).
  # Capture pane ids with absolute pane_id (%N) identifiers so the rest of the
  # script works regardless of the session's base-index/pane-base-index setting
  # (some tmux configs number panes from 1 instead of 0). After each split the
  # newly created pane becomes the active pane.
  {
    tmux new-window -t "${SESSION}:" -n "${WINDOW}" -c "${REPO_ROOT}"
  } >/dev/null 2>&1
  WINTARGET="${SESSION}:${WINDOW}"

  # pane 0 — viewer (yjs-server + Vite via concurrently)
  tmux send-keys -t "${WINTARGET}" "npm run dev" Enter

  # pane 1 — hub
  tmux split-window -h -t "${WINTARGET}" -c "${REPO_ROOT}"
  tmux send-keys -t "${WINTARGET}" "npm run dev:hub" Enter

  # pane 2 — caddy
  tmux split-window -v -t "${WINTARGET}" -c "${REPO_ROOT}"
  tmux send-keys -t "${WINTARGET}" "${CADDY_BIN} run --config Caddyfile.dev" Enter

  echo ""
  echo "[start-dev] Services started in tmux window '${SESSION}:${WINDOW}'."
  echo "  viewer + yjs : http://localhost:5173  (or via Caddy: :8080)"
  echo "  hub          : http://localhost:3000/hub/"
  echo "  caddy proxy  : http://localhost:8080"
  echo ""
  echo "Switch to the window with:  tmux select-window -t ${SESSION}:${WINDOW}"

else
  # ─── no tmux (or outside a session): background processes ─────────────────
  echo "[start-dev] tmux not available — starting services in background."
  cd "${REPO_ROOT}"

  # Kill any previously running instances on known ports
  fuser -k 1234/tcp 5173/tcp 3000/tcp 8080/tcp 2>/dev/null || true

  npm run dev   > /tmp/geekslides-viewer.log 2>&1 &
  echo "[start-dev] viewer (yjs + Vite) PID $! → /tmp/geekslides-viewer.log"

  npm run dev:hub > /tmp/geekslides-hub.log 2>&1 &
  echo "[start-dev] hub PID $! → /tmp/geekslides-hub.log"

  sleep 2
  "${CADDY_BIN}" run --config "${REPO_ROOT}/Caddyfile.dev" > /tmp/geekslides-caddy.log 2>&1 &
  echo "[start-dev] caddy PID $! → /tmp/geekslides-caddy.log"

  echo ""
  echo "[start-dev] All services started. Access via http://localhost:8080"
fi
