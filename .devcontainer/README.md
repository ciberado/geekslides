# Dev Container — Tailscale Setup

This dev container automatically joins your Tailscale network on start, enabling SSH access and VS Code Remote-SSH from any device on the tailnet.

## Prerequisites

1. **Install the devcontainer CLI**
   ```bash
   npm install -g @devcontainers/cli
   ```

2. **Create a Tailscale pre-auth key**  
   Go to <https://login.tailscale.com/admin/settings/keys> and create a key with:
   - ✅ Reusable
   - ✅ Ephemeral (node auto-expires when the container stops)
   - Tags: `tag:vscode` (must be pre-configured in your ACL policy)

3. **Set the required environment variables on the host**
   ```bash
   export TAILSCALE_AUTHKEY=tskey-auth-<your-key>
   export PROJECT_NAME=geekslides        # becomes the tailnet hostname: vs-geekslides
   ```

   Add these to your `~/.zshrc` / `~/.bashrc` / `~/.profile` so they persist across sessions.

## Starting the container

```bash
devcontainer up --workspace-folder .
```

The `postStartCommand` will run automatically and:
- Start the `tailscaled` daemon
- Call `tailscale up` with SSH enabled, `tag:vscode`, and hostname `vs-${PROJECT_NAME}`
- Ensure OpenSSH (`sshd`) is running

## Connecting via SSH

Once the container is up, find its Tailscale IP:

```bash
devcontainer exec --workspace-folder . tailscale ip -4
```

Then connect from any tailnet device:

```bash
ssh node@vs-geekslides          # using MagicDNS
ssh node@<tailscale-ip>         # using the IP directly
```

Or add it to your `~/.ssh/config` for VS Code Remote-SSH:

```sshconfig
Host vs-geekslides
  HostName vs-geekslides
  User node
```

## Running arbitrary commands inside the container

```bash
devcontainer exec --workspace-folder . <command>
```

## Environment variable reference

| Variable | Where set | Description |
|---|---|---|
| `TAILSCALE_AUTHKEY` | Host shell | Pre-auth key from the Tailscale admin console |
| `PROJECT_NAME` | Host shell | Becomes the tailnet hostname `vs-<PROJECT_NAME>` |
