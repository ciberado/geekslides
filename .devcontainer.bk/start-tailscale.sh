#!/usr/bin/env bash
# Starts tailscaled + connects to Tailscale with SSH and VS Code tag.
# Requires TAILSCALE_AUTHKEY to be set (injected via devcontainer remoteEnv).
set -euo pipefail

if [[ -z "${TAILSCALE_AUTHKEY:-}" ]]; then
  echo "ERROR: TAILSCALE_AUTHKEY is not set. Export it on the host before opening the dev container." >&2
  exit 1
fi

if [[ -z "${PROJECT_NAME:-}" ]]; then
  echo "ERROR: PROJECT_NAME is not set. Export it on the host before opening the dev container." >&2
  exit 1
fi

# Start the tailscaled daemon if not already running (systemd is absent in containers).
if ! pgrep -x tailscaled > /dev/null 2>&1; then
  echo "Starting tailscaled..."
  sudo mkdir -p /var/run/tailscale /var/lib/tailscale
  sudo tailscaled \
    --state=/var/lib/tailscale/tailscaled.state \
    --socket=/var/run/tailscale/tailscaled.sock \
    >> /var/log/tailscaled.log 2>&1 &
  # Give the daemon a moment to create its socket before we talk to it.
  sleep 2
fi

# Connect (or re-authenticate) to the tailnet.
# --ssh       : enable Tailscale SSH on this node
# --advertise-tags : apply the vscode ACL tag (must exist in the Tailscale admin console)
# --hostname  : friendly name shown in the admin console
sudo tailscale up \
  --authkey="${TAILSCALE_AUTHKEY}" \
  --ssh \
  --advertise-tags=tag:vscode \
  --hostname="vs-${PROJECT_NAME}" \
  --accept-routes

echo "Tailscale up. Node address: $(tailscale ip -4 2>/dev/null || echo 'pending')"

# Ensure OpenSSH is also running (installed by the sshd devcontainer feature).
sudo service ssh start 2>/dev/null || true
