# Geekslides Deployment Guide

This simplified deployment uses a single Docker container with Caddy as a reverse proxy, providing automatic HTTPS and a unified entry point for both the broker and slides services.

## Features

- **Single Container**: Runs both broker and slides services
- **Automatic HTTPS**: Caddy handles Let's Encrypt certificates automatically
- **Tailscale Support**: Can be configured for Tailscale HTTPS
- **External Content**: Optional proxying to external slide storage
- **Simple Configuration**: Environment variable based setup

## Quick Start

### Local Development (HTTP)

```bash
docker compose up --build
```

Access at: http://localhost

### Production with Automatic HTTPS

1. Copy and configure environment variables:
```bash
cp .env.example .env
# Edit .env and set your DOMAIN
```

2. Update `docker-compose.yml` and uncomment the DOMAIN line:
```yaml
environment:
  DOMAIN: geekslides.aprender.cloud
```

3. Build and run:
```bash
docker compose up -d --build
```

Caddy will automatically obtain and renew Let's Encrypt certificates for your domain.

## Configuration

### Environment Variables

- `DOMAIN`: Your domain name (required for automatic HTTPS)
- `ACME_EMAIL`: Email for Let's Encrypt notifications (optional)
- `EXTERNAL_CONTENT_URL`: External URL for hosting slides content via `/content` path (optional)
- `TZ`: Timezone (default: Europe/Madrid)

### Ports

- `80`: HTTP (redirects to HTTPS when domain is set)
- `443`: HTTPS
- Internal services:
  - Slides: localhost:1234
  - Broker: localhost:8883

### Routes

- `/`: Main slides application
- `/mqtt`: WebSocket MQTT broker
- `/slides`: Static slides content (browseable)
- `/content`: Proxied to external URL if `EXTERNAL_CONTENT_URL` is set

## Tailscale HTTPS

To use Tailscale HTTPS:

1. Install Tailscale on your server or use a Tailscale sidecar container
2. Set your Tailscale hostname as DOMAIN:
```yaml
environment:
  DOMAIN: myserver.tailnet.ts.net
```

Caddy will automatically use Tailscale certificates.

## External Content Hosting

To host slide content externally (CDN, cloud storage, etc.):

1. Set the `EXTERNAL_CONTENT_URL` environment variable:
```yaml
environment:
  EXTERNAL_CONTENT_URL: https://cdn.example.com
```

2. Access your external content via `/content/*` - Caddy will proxy requests to your external URL.

## Docker Compose Commands

```bash
# Build and start
docker compose up -d --build

# View logs
docker compose logs -f

# Stop
docker compose down

# Rebuild after changes
docker compose up -d --build --force-recreate
```

## Certificate Management

Certificates are automatically managed by Caddy and stored in the `caddy_data` volume. To renew certificates manually:

```bash
docker compose exec geekslides caddy reload --config /etc/caddy/Caddyfile
```

## Troubleshooting

### Port 80/443 already in use
Stop any existing web servers (nginx, apache) before starting.

### Certificates not working
- Ensure your domain DNS points to your server
- Check firewall allows ports 80 and 443
- View logs: `docker compose logs geekslides`

### Services not starting
Check logs for specific service errors:
```bash
docker compose logs -f geekslides
```
