# ----- Stage 1: Build -----
FROM node:22-alpine AS builder

WORKDIR /app

# Copy workspace root and package files for dependency resolution
COPY package.json package-lock.json* ./
COPY packages/engine/package.json packages/engine/
COPY packages/cli/package.json packages/cli/
COPY packages/server/package.json packages/server/

RUN npm ci --ignore-scripts

# Copy source files
COPY tsconfig.json vite.config.ts ./
COPY packages/engine/ packages/engine/
COPY packages/cli/ packages/cli/
COPY index.html ./

RUN npm run build --workspace=@geekslides/engine 2>/dev/null || \
    npx vite build --outDir dist

# ----- Stage 2: Serve -----
FROM caddy:2-alpine

COPY docker/Caddyfile.static /etc/caddy/Caddyfile
COPY --from=builder /app/dist /srv/slides

EXPOSE 5173

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q --spider http://localhost:5173/ || exit 1
