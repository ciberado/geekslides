#!/usr/bin/env bash
# start-dev.sh — Launch all GeekSlides dev services.
#
# With tmux: opens/reuses a window named "dev" with three panes:
#   pane 0  viewer (yjs-server + Vite)    :1234 + :5173
#   pane 1  hub (Fastify + Vite)          :3000
#   pane 2  caddy reverse proxy           :8080
#
# Without tmux: starts all three services as background processes.
#
# Caddy binary: looks for caddy in PATH first, then /tmp/caddy.
# If not found, downloads it automatically.

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

  # Grab first session name (works whether we're inside tmux or not)
  SESSION="$(tmux list-sessions -F '#S' | head -1)"

  # Kill existing dev window for a clean restart
  tmux kill-window -t "${SESSION}:${WINDOW}" 2>/dev/null || true

  # Create new window in that session (trailing colon = pick next free index)
  tmux new-window -t "${SESSION}:" -n "${WINDOW}" -c "${REPO_ROOT}"

  # pane 0 — viewer (yjs-server + Vite via concurrently)
  tmux send-keys -t "${SESSION}:${WINDOW}.0" "npm run dev" Enter

  # pane 1 — hub
  tmux split-window -h -t "${SESSION}:${WINDOW}.0" -c "${REPO_ROOT}"
  tmux send-keys -t "${SESSION}:${WINDOW}.1" "npm run dev:hub" Enter

  # pane 2 — caddy
  tmux split-window -v -t "${SESSION}:${WINDOW}.1" -c "${REPO_ROOT}"
  tmux send-keys -t "${SESSION}:${WINDOW}.2" "${CADDY_BIN} run --config Caddyfile.dev" Enter

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
