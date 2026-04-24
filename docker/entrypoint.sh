#!/bin/sh
# Start yjs-server in background, then run Caddy as the main process.
# Caddy is PID 1 and handles SIGTERM/SIGINT; Node inherits the container lifetime.
node /app/index.cjs &

# Start hub server if present (all-in-one mode)
if [ -f /app/hub.cjs ]; then
  node /app/hub.cjs &
fi

exec caddy run --config /etc/caddy/Caddyfile --adapter caddyfile
