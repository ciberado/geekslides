# Deploy with Tailscale (Private + Public)

This guide explains how to run GeekSlides on a private machine inside a Tailscale network and expose it publicly via a second machine running Caddy 2 directly on the host. Every hop is encrypted: Let's Encrypt on the public side and Tailscale's managed TLS on the private side.

## Architecture

```
Browser
  │  HTTPS (Let's Encrypt)
  ▼
Public machine  gs.aprender.cloud:443
  Caddy 2 (systemd service, no Docker)
  │  HTTPS over Tailscale WireGuard tunnel
  ▼
Private machine  gs.snow-burbot.ts.net:443
  Tailscale sidecar — serves ts.net TLS cert
  │  HTTP (loopback, same network namespace)
  ▼
  Caddy 2 :80 (Caddyfile.internal)
  ├─ /ws*    → yjs-server :1234 (WebSocket sync)
  ├─ /api/*  → yjs-server :1234 (content proxy)
  ├─ /hub/*  → Hub server :3000
  └─ /*      → SPA bundle
```

TLS coverage at every hop:

| Hop | Certificate |
|---|---|
| Browser → public Caddy | Let's Encrypt (standard ACME) |
| Public Caddy → private machine | Tailscale TLS (Let's Encrypt via Tailscale CA, publicly trusted) |
| Tailscale sidecar → Caddy `:80` | Loopback — same network namespace, no external exposure |

## Prerequisites

- Both machines are joined to the same Tailscale network (host daemon).
- The private machine runs Docker.
- The public machine runs Caddy 2 as a system service.
- DNS: your public domain points to the public machine's IP.
- Ports 80 and 443 open on the public machine.

## Private machine setup

### 1. Create the deployment directory

```bash
mkdir -p ~/geekslides/data/tailscale ~/geekslides/data/hub
cd ~/geekslides
```

### 2. Copy the deployment files

From your GeekSlides clone, copy these files:

```
docker/docker-compose.tailscale.yml  →  ~/geekslides/docker-compose.tailscale.yml
docker/Caddyfile.internal            →  ~/geekslides/Caddyfile.internal
docker/ts-config/                    →  ~/geekslides/ts-config/
docker/.env-example                  →  ~/geekslides/.env
```

### 3. Create `.env`

Edit `~/geekslides/.env` and fill in all values:

```bash
# Tailscale
TS_AUTHKEY=tskey-auth-REPLACE_ME   # https://login.tailscale.com/admin/settings/keys
TS_HOSTNAME=gs                      # → gs.snow-burbot.ts.net on your tailnet
TS_TAILNET=snow-burbot.ts.net       # shown in Tailscale admin → DNS

# Content — path to your deck directory on this host
CONTENT_DIR=/path/to/your/deck

# Hub
VIEWER_BASE_URL=https://gs.aprender.cloud
JWT_SECRET=$(openssl rand -hex 32)
COOKIE_DOMAIN=aprender.cloud
ADMIN_EMAIL=you@example.com
```

For GitHub or Google OAuth, add the client ID and secret (see [OAuth setup](#oauth-setup) below). Leave them empty to disable a provider.

`CONTENT_DIR` is optional. When unset the built-in welcome/help deck bundled in the image is shown. Set it and uncomment the volume in `docker-compose.tailscale.yml` to serve your own deck (see step 4).

### 4. Start the stack

```bash
docker compose -f docker-compose.tailscale.yml up -d
```

Docker pulls `ciberado/geekslides:latest` and `ciberado/geekslides-hub:latest`, starts the Tailscale sidecar, and brings up GeekSlides and the Hub sharing the sidecar's network namespace.

### 5. Verify the private endpoint

From any other tailnet device, open:

```
https://gs.snow-burbot.ts.net
```

You should see the GeekSlides SPA served over a valid TLS certificate issued by Tailscale.

> **Tip:** If the page doesn't load, check `docker compose -f docker-compose.tailscale.yml logs geekslides-ts` and confirm the node appears in the Tailscale admin console under Machines.

### Data directories

All persistent data lives under `~/geekslides/data/` as bind-mounted directories, making backups straightforward:

| Host path | Container path | Contents |
|---|---|---|
| `./data/tailscale` | `/var/lib/tailscale` | Tailscale node identity and state |
| `./data/hub` | `/data` | Hub SQLite database (`hub.db`), cloned repos, upload cache |
| `$CONTENT_DIR` *(optional)* | `/srv/content` | Your deck files (read-only). When not mounted, the built-in welcome deck is used. |

```bash
# Back up all state
tar czf geekslides-backup-$(date +%F).tar.gz data/
```

### Tailscale serve config

`ts-config/geekslides.json` tells the Tailscale sidecar to serve HTTPS on port 443 and forward traffic to Caddy at `http://localhost:80`. The `${TS_CERT_DOMAIN}` placeholder is substituted by the Tailscale daemon with the node's actual FQDN:

```json
{
  "TCP": {
    "443": {
      "HTTPS": true
    }
  },
  "Web": {
    "${TS_CERT_DOMAIN}:443": {
      "Handlers": {
        "/": {
          "Proxy": "http://localhost:80"
        }
      }
    }
  }
}
```

## Public machine setup

The public machine runs Caddy 2 directly on the host — no Docker required.

### 1. Install Caddy 2

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
  | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
  | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install caddy
```

Verify: `caddy version` should print a `v2.x.x` line.

### 2. Set the environment file

Copy `docker/caddy-public.env.example` to `/etc/caddy/environment` and edit it:

```bash
sudo cp caddy-public.env.example /etc/caddy/environment
sudo chmod 600 /etc/caddy/environment   # keep secrets off world-readable
sudo nano /etc/caddy/environment
```

```bash
PUBLIC_DOMAIN=gs.aprender.cloud
ACME_EMAIL=you@example.com
PRIVATE_DOMAIN=gs.snow-burbot.ts.net
```

The Caddy systemd unit must load this file. Add `EnvironmentFile` to the override:

```bash
sudo systemctl edit caddy
```

Add:

```ini
[Service]
EnvironmentFile=/etc/caddy/environment
```

Save and close the editor.

### 3. Deploy the Caddyfile

```bash
sudo cp docker/Caddyfile.public /etc/caddy/Caddyfile
sudo caddy validate --config /etc/caddy/Caddyfile
```

### 4. Start Caddy

```bash
sudo systemctl reload-or-restart caddy
sudo systemctl enable caddy
```

### 5. Verify

```bash
curl -sI https://gs.aprender.cloud/ | head -5
```

Should return `HTTP/2 200` with a Let's Encrypt certificate. Caddy obtains and renews the certificate automatically.

## WebSocket sync

WebSocket sync (`/ws*`) requires special handling at the public proxy: Caddy prefers HTTP/2 for TLS upstreams, but the WebSocket Upgrade mechanism is HTTP/1.1 only. `Caddyfile.public` explicitly forces HTTP/1.1 for the WebSocket upstream:

```caddy
handle /ws* {
    reverse_proxy https://{$PRIVATE_DOMAIN} {
        transport http {
            versions 1.1
        }
    }
}
```

To verify sync works end-to-end:

1. Open `https://gs.aprender.cloud` in two browser tabs.
2. In one tab, open the terminal (`Escape`) and run `room mytest`.
3. In the other tab, run `room mytest`.
4. Navigate to the next slide in one tab — the other tab should follow.

## OAuth setup

The Hub supports GitHub and Google OAuth for sign-in. Configure at least one provider so users can log in.

**GitHub OAuth app:**

1. Go to [GitHub → Settings → Developer Settings → OAuth Apps](https://github.com/settings/developers) → New OAuth App.
2. Set **Authorization callback URL** to `https://gs.aprender.cloud/hub/auth/github/callback`.
3. Copy the Client ID and generate a Client Secret.
4. Add to `~/geekslides/.env` on the private machine:
   ```bash
   GITHUB_CLIENT_ID=your-client-id
   GITHUB_CLIENT_SECRET=your-client-secret
   ```
5. `docker compose -f docker-compose.tailscale.yml up -d` to apply.

**Google OAuth app:** follow the same pattern using `https://gs.aprender.cloud/hub/auth/google/callback` as the redirect URI. See [Use the Hub](15-use-the-hub.md) for a full walkthrough of the Hub UI and deck management.

## Updating

**Private machine:**

```bash
cd ~/geekslides
docker compose -f docker-compose.tailscale.yml pull
docker compose -f docker-compose.tailscale.yml up -d
```

**Public machine:**

```bash
sudo apt update && sudo apt install --only-upgrade caddy
sudo systemctl reload caddy
```

## Environment variables reference

### Private machine (`docker-compose.tailscale.yml` / `.env`)

| Variable | Required | Description |
|---|---|---|
| `TS_AUTHKEY` | ✓ | Tailscale auth key for the sidecar |
| `TS_HOSTNAME` | — | Tailnet hostname prefix (default: `gs`) |
| `TS_TAILNET` | — | Your tailnet domain (informational, used in docs) |
| `CONTENT_DIR` | — | Host path to deck files. When unset the built-in welcome deck is shown. Uncomment the volume line in `docker-compose.tailscale.yml` to enable |
| `VIEWER_BASE_URL` | ✓ | Full public URL users open in their browser |
| `JWT_SECRET` | ✓ | Random secret for Hub JWT tokens (`openssl rand -hex 32`) |
| `COOKIE_DOMAIN` | ✓ | Root domain for the Hub session cookie |
| `ADMIN_EMAIL` | — | Email for the initial Hub admin user |
| `GITHUB_CLIENT_ID` | — | GitHub OAuth app client ID |
| `GITHUB_CLIENT_SECRET` | — | GitHub OAuth app client secret |
| `GOOGLE_CLIENT_ID` | — | Google OAuth app client ID |
| `GOOGLE_CLIENT_SECRET` | — | Google OAuth app client secret |

### Public machine (`/etc/caddy/environment`)

| Variable | Required | Description |
|---|---|---|
| `PUBLIC_DOMAIN` | ✓ | Public HTTPS domain (e.g. `gs.aprender.cloud`) |
| `ACME_EMAIL` | ✓ | Email for Let's Encrypt notifications |
| `PRIVATE_DOMAIN` | ✓ | Tailscale FQDN of the private node (e.g. `gs.snow-burbot.ts.net`) |

---

← Previous: [Use the Hub](15-use-the-hub.md) | Back to [index →](README.md)

## Architecture

```
Browser
  │  HTTPS (Let's Encrypt)
  ▼
Public machine  gs.aprender.cloud:443
  Caddy (docker-compose.public.yml)
  │  HTTPS over Tailscale WireGuard tunnel
  ▼
Private machine  gs.snow-burbot.ts.net:443
  Tailscale sidecar — serves ts.net TLS cert
  │  HTTP (loopback, same network namespace)
  ▼
  Caddy :80 (Caddyfile.internal)
  ├─ /ws*    → yjs-server :1234 (WebSocket sync)
  ├─ /api/*  → yjs-server :1234 (content proxy)
  ├─ /hub/*  → Hub server :3000
  └─ /*      → SPA bundle
```

TLS coverage at every hop:

| Hop | Certificate |
|---|---|
| Browser → public Caddy | Let's Encrypt (standard ACME) |
| Public Caddy → private machine | Tailscale TLS (Let's Encrypt via Tailscale CA, publicly trusted) |
| Tailscale sidecar → Caddy `:80` | Loopback — same network namespace, no external exposure |

## Prerequisites

- Both machines are joined to the same Tailscale network.
- The private machine runs Docker.
- The public machine runs Docker **and** has Tailscale running as a host daemon (so it can resolve `*.ts.net` hostnames).
- DNS: `PUBLIC_DOMAIN` points to the public machine's IP.
- Port 80 and 443 open on the public machine.

## Private machine setup

### 1. Copy the deployment files

From your GeekSlides clone, copy these files to the private machine:

```
docker/docker-compose.tailscale.yml  →  ~/geekslides/docker-compose.tailscale.yml
docker/Caddyfile.internal            →  ~/geekslides/Caddyfile.internal
docker/ts-config/                    →  ~/geekslides/ts-config/
docker/.env-example                  →  ~/geekslides/.env
```

### 2. Edit `.env`

Fill in the **PRIVATE MACHINE** section:

```bash
# Tailscale
TS_AUTHKEY=tskey-auth-REPLACE_ME   # from https://login.tailscale.com/admin/settings/keys
TS_HOSTNAME=gs                      # → gs.snow-burbot.ts.net
TS_TAILNET=snow-burbot.ts.net

# Content
CONTENT_DIR=/path/to/your/deck

# Hub
VIEWER_BASE_URL=https://gs.aprender.cloud
JWT_SECRET=<output of: openssl rand -hex 32>
COOKIE_DOMAIN=aprender.cloud
ADMIN_EMAIL=you@example.com
```

Leave `GITHUB_CLIENT_ID` / `GOOGLE_CLIENT_ID` empty to disable OAuth for that provider.

### 3. Start the stack

```bash
docker compose -f docker-compose.tailscale.yml up -d
```

Docker pulls `ciberado/geekslides:latest` and `ciberado/geekslides-hub:latest`, starts the Tailscale sidecar, and brings up GeekSlides and the Hub sharing the sidecar's network namespace.

### 4. Verify the private endpoint

From any other tailnet device, open:

```
https://gs.snow-burbot.ts.net
```

You should see the GeekSlides SPA over a valid TLS certificate issued by Tailscale.

> **Tip:** If the page doesn't load, check `docker compose -f docker-compose.tailscale.yml logs geekslides-ts` and confirm the node appears in the Tailscale admin console.

### Tailscale serve config

The file `ts-config/geekslides.json` tells the Tailscale sidecar to serve HTTPS on port 443 and forward traffic to `http://localhost:80` (Caddy). The `${TS_CERT_DOMAIN}` placeholder is automatically substituted by the Tailscale daemon with the node's actual FQDN:

```json
{
  "TCP": {
    "443": {
      "HTTPS": true
    }
  },
  "Web": {
    "${TS_CERT_DOMAIN}:443": {
      "Handlers": {
        "/": {
          "Proxy": "http://localhost:80"
        }
      }
    }
  }
}
```

## Public machine setup

### 1. Copy the deployment files

```
docker/docker-compose.public.yml  →  ~/geekslides-public/docker-compose.public.yml
docker/Caddyfile.public           →  ~/geekslides-public/Caddyfile.public
docker/.env-example               →  ~/geekslides-public/.env
```

### 2. Edit `.env`

Fill in the **PUBLIC MACHINE** section:

```bash
PUBLIC_DOMAIN=gs.aprender.cloud
ACME_EMAIL=you@example.com
PRIVATE_DOMAIN=gs.snow-burbot.ts.net
```

### 3. Start the stack

```bash
docker compose -f docker-compose.public.yml up -d
```

Caddy obtains a Let's Encrypt certificate on the first request. Certificate data is persisted in the `caddy-data` volume.

### 4. Verify

```bash
curl -I https://gs.aprender.cloud/
```

Should return `HTTP/2 200`. Check that the certificate is issued by Let's Encrypt.

## WebSocket sync

WebSocket sync (`/ws*`) requires special handling at the public proxy: Caddy prefers HTTP/2 for TLS upstreams, but the WebSocket Upgrade mechanism is HTTP/1.1 only. `Caddyfile.public` explicitly forces HTTP/1.1 for the WebSocket upstream block:

```caddy
handle /ws* {
    reverse_proxy https://{$PRIVATE_DOMAIN} {
        ...
        transport http {
            versions 1.1
        }
    }
}
```

To verify sync works end-to-end:

1. Open `https://gs.aprender.cloud` in two browser tabs.
2. In one tab, open the terminal (`Escape`) and run `room mytest`.
3. Switch to the other tab and run `room mytest`.
4. Navigate to the next slide in one tab — the other tab should follow.

## Updating

**Private machine:**

```bash
docker compose -f docker-compose.tailscale.yml pull
docker compose -f docker-compose.tailscale.yml up -d
```

**Public machine:**

```bash
docker compose -f docker-compose.public.yml pull
docker compose -f docker-compose.public.yml up -d
```

The Tailscale sidecar and Caddy retain their persistent volumes across updates, preserving tailnet state and TLS certificates.

## Environment variables reference

### Private machine (docker-compose.tailscale.yml)

| Variable | Required | Description |
|---|---|---|
| `TS_AUTHKEY` | ✓ | Tailscale auth key for the sidecar |
| `TS_HOSTNAME` | — | Tailnet hostname (default: `gs`) |
| `CONTENT_DIR` | — | Host path to deck files (read-only) |
| `VIEWER_BASE_URL` | ✓ | Public URL end-users open in their browser |
| `JWT_SECRET` | ✓ | Random secret for Hub JWT tokens |
| `COOKIE_DOMAIN` | ✓ | Root domain for the session cookie |
| `ADMIN_EMAIL` | — | Email for the initial Hub admin user |
| `GITHUB_CLIENT_ID` | — | GitHub OAuth app client ID |
| `GITHUB_CLIENT_SECRET` | — | GitHub OAuth app client secret |
| `GOOGLE_CLIENT_ID` | — | Google OAuth app client ID |
| `GOOGLE_CLIENT_SECRET` | — | Google OAuth app client secret |

### Public machine (docker-compose.public.yml)

| Variable | Required | Description |
|---|---|---|
| `PUBLIC_DOMAIN` | ✓ | Public HTTPS domain (e.g. `gs.aprender.cloud`) |
| `ACME_EMAIL` | ✓ | Email for Let's Encrypt notifications |
| `PRIVATE_DOMAIN` | ✓ | Tailscale FQDN of the private node (e.g. `gs.snow-burbot.ts.net`) |

---

← Previous: [Use the Hub](15-use-the-hub.md) | Back to [index →](README.md)
