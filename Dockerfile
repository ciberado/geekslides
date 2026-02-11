FROM node:lts AS builder

ENV TZ=Europe/Madrid
RUN echo Europe/Madrid > /etc/timezone && \
    apt-get update && \
    DEBIAN_FRONTEND=noninteractive TZ=Europe/Madrid apt-get install tzdata -y

# Copy all source files
COPY . /app
WORKDIR /app

# Install all dependencies (broker, slides, demo which includes concurrently)
RUN npm run install

# Build the slides production bundle
RUN npm --prefix slides run build

# Production stage
FROM caddy:2-alpine

# Install node for running the broker and slides
RUN apk add --no-cache nodejs npm

# Copy application files
COPY --from=builder /app /app
WORKDIR /app

# Copy the Caddyfile
COPY Caddyfile /etc/caddy/Caddyfile

# Copy built slides to Caddy's web root
COPY --from=builder /app/slides/dist /usr/share/caddy/slides

# Expose ports
# 80 and 443 for HTTP/HTTPS
# 1234 for slides dev server (internal)
# 8883 for broker (internal)
EXPOSE 80 443

# Start both the broker and slides, then Caddy
# Using a simple shell script to manage the processes
RUN echo '#!/bin/sh' > /start.sh && \
    echo 'cd /app && npm start &' >> /start.sh && \
    echo 'exec caddy run --config /etc/caddy/Caddyfile --adapter caddyfile' >> /start.sh && \
    chmod +x /start.sh

ENTRYPOINT ["/start.sh"]
