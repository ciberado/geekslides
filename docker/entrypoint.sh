#!/bin/sh
# Start yjs-server in background, then run Caddy as the main process.
# Caddy is PID 1 and handles SIGTERM/SIGINT; Node inherits the container lifetime.
node /app/index.cjs &
exec caddy run --config /etc/caddy/Caddyfile --adapter caddyfile
