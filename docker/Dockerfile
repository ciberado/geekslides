# ----- Stage 1: Build SPA -----
FROM node:22-alpine AS app-builder

WORKDIR /app

COPY package.json package-lock.json* ./
COPY packages/engine/package.json packages/engine/
COPY packages/cli/package.json packages/cli/
COPY packages/server/package.json packages/server/

RUN npm ci --ignore-scripts

COPY tsconfig.json vite.config.ts ./
COPY packages/engine/ packages/engine/
COPY packages/cli/ packages/cli/
COPY index.html ./

RUN npm run build:app --workspace=@geekslides/cli

# ----- Stage 2: Build yjs server -----
FROM node:22-alpine AS server-builder

WORKDIR /app

COPY package.json package-lock.json* ./
COPY packages/server/package.json packages/server/

RUN npm ci --workspace=@geekslides/server --ignore-scripts

COPY packages/server/ packages/server/

RUN npm run build --workspace=@geekslides/server

# ----- Stage 3: Runtime (Node + Caddy) -----
FROM node:22-alpine

RUN apk add --no-cache 'caddy~=2'

WORKDIR /app

COPY --from=app-builder /app/packages/cli/dist/app /srv/slides
COPY --from=server-builder /app/packages/server/dist/index.cjs ./index.cjs
# Bundle the welcome deck — shown when no CONTENT_DIR is mounted
COPY decks/welcome-deck/ /srv/content/
COPY docker/Caddyfile /etc/caddy/Caddyfile
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 80 443

ENV PORT=1234
ENV HOST=127.0.0.1
ENV GEEKSLIDES_LOG_FORMAT=json

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO /dev/null http://127.0.0.1:2019/config/ || exit 1

ENTRYPOINT ["/entrypoint.sh"]
