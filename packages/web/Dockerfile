# Production-ready web container. Two-stage: build the Vite bundle, then
# serve the static dist via nginx. The previous version started `vite dev`
# which is not production-safe (no compression, HMR, source-maps served).
#
# The API container also serves packages/web/dist when NODE_ENV=production,
# so an operator can either run this container OR disable it and let the API
# serve the SPA directly. Both paths produce the same built artifact.

# ── Stage 1: build ────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# VITE_BASE_URL is baked into the built bundle — Vite rewrites asset
# URLs and the SPA router basename to this prefix. Default '/' keeps
# root deployment working; pass `--build-arg VITE_BASE_URL=/mb/` for
# a subpath deployment where the upstream proxy strips the prefix.
ARG VITE_BASE_URL=/
ENV VITE_BASE_URL=$VITE_BASE_URL

# ADR 0XZ — two-line split-row entry forms with per-line tag picker.
# Baked in at build time; flip the compose build arg and rebuild `web`.
ARG VITE_ENTRY_FORMS_V2=true
ENV VITE_ENTRY_FORMS_V2=$VITE_ENTRY_FORMS_V2

COPY package.json package-lock.json* tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/web/package.json ./packages/web/

RUN npm install --workspace=@kis-books/shared --workspace=@kis-books/web

COPY packages/shared/ ./packages/shared/
COPY packages/web/ ./packages/web/

RUN npm run build --workspace=@kis-books/shared
RUN npm run build --workspace=@kis-books/web

# ── Stage 2: serve ────────────────────────────────────────────────
FROM nginx:1.27-alpine
# SPA fallback: unknown paths fall through to index.html so client-side
# routing works on refresh. /api and /oauth are proxied to the API
# service (docker-compose service name: `api`).
RUN printf 'server {\n  listen 5173;\n  server_name _;\n  root /usr/share/nginx/html;\n  index index.html;\n  gzip on;\n  gzip_types text/css application/javascript application/json image/svg+xml;\n  # Long-cache hashed assets, no-cache the HTML entry point so deploys take effect.\n  location ~* \\.(js|css|woff2?|ttf|eot|svg|png|jpg|jpeg|gif|webp|ico)$ {\n    expires 1y;\n    add_header Cache-Control "public, immutable";\n    try_files $uri =404;\n  }\n  location / {\n    add_header Cache-Control "no-store";\n    try_files $uri /index.html;\n  }\n  location /api/ {\n    proxy_pass http://api:3001;\n    proxy_set_header Host $host;\n    proxy_set_header X-Real-IP $remote_addr;\n    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n    proxy_set_header X-Forwarded-Proto $scheme;\n    client_max_body_size 50m;\n  }\n  location /oauth/ {\n    proxy_pass http://api:3001;\n    proxy_set_header Host $host;\n    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n  }\n}\n' > /etc/nginx/conf.d/default.conf

COPY --from=builder /app/packages/web/dist /usr/share/nginx/html

EXPOSE 5173

CMD ["nginx", "-g", "daemon off;"]
