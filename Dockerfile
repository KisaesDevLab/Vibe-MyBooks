# Stage 1: Build shared + API
FROM node:20-alpine AS api-build
WORKDIR /app
# Skip Puppeteer's bundled Chromium download during npm install — this
# image never runs Puppeteer in the build stage, and the bundled binary
# is built for glibc and won't run on alpine anyway (see runtime stage).
ENV PUPPETEER_SKIP_DOWNLOAD=true
COPY package.json package-lock.json* tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/api/package.json ./packages/api/
RUN npm install --workspace=@kis-books/shared --workspace=@kis-books/api
COPY packages/shared/ ./packages/shared/
COPY packages/api/ ./packages/api/
RUN npm run build --workspace=@kis-books/shared
RUN npm run build --workspace=@kis-books/api

# Stage 2: Build web
FROM node:20-alpine AS web-build
WORKDIR /app
ENV PUPPETEER_SKIP_DOWNLOAD=true
# VITE_BASE_URL is baked into the web bundle at build time — Vite
# rewrites asset URLs and the SPA router basename to this prefix. Pass
# `--build-arg VITE_BASE_URL=/mb/` when the appliance's front nginx
# serves the app under a path prefix. Default `/` keeps the bundle
# identical for root deployments.
ARG VITE_BASE_URL=/
ENV VITE_BASE_URL=$VITE_BASE_URL
# ADR 0XZ — two-line split-row entry forms with per-line tag picker.
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

# Stage 3: Runtime
FROM node:20-alpine AS runtime
WORKDIR /app

# Chromium for Puppeteer (PDF generation: invoices, checks, reports).
# Puppeteer's bundled Chromium is built for glibc and won't run on alpine
# (musl libc), so we install Chromium from apk and point Puppeteer at it
# via PUPPETEER_EXECUTABLE_PATH. The font packages are required for
# Chromium to render text — without them PDFs render as empty boxes.
# This must match packages/api/Dockerfile's install block; the two
# Dockerfiles are used by different compose setups (production vs dev)
# but both need a working Chromium at runtime.
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    font-noto-emoji \
    su-exec
ENV PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Install production dependencies only. PUPPETEER_SKIP_DOWNLOAD (set
# above) prevents npm from pulling the broken-on-alpine bundled Chromium
# when puppeteer is installed as a production dependency.
COPY package.json package-lock.json* tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/api/package.json ./packages/api/
RUN npm install --workspace=@kis-books/shared --workspace=@kis-books/api --omit=dev

# Copy built artifacts
COPY --from=api-build /app/packages/shared/dist ./packages/shared/dist
COPY --from=api-build /app/packages/api/dist ./packages/api/dist
COPY --from=api-build /app/packages/api/src/db/migrations ./packages/api/src/db/migrations
COPY --from=web-build /app/packages/web/dist ./packages/web/dist

# Copy scripts
COPY scripts/ ./scripts/
RUN chmod +x scripts/*.sh 2>/dev/null || true

# Create data directories with ownership for the non-root runtime user.
# UID/GID 1001 is used deliberately (not the `node` user at UID 1000)
# so host bind-mounts of ./data don't accidentally collide with any
# host-side user.
RUN addgroup -g 1001 -S app && adduser -S -u 1001 -G app app \
  && mkdir -p /data/uploads /data/backups /data/config /data/generated \
  && chown -R app:app /app /data

# Version stamp — CI passes the release tag (e.g. v1.2.3) via
# `--build-arg VERSION=$GITHUB_REF_NAME`. When absent (local `docker
# compose build`) we fall back to "dev" so the in-app update-check can
# still render something meaningful without pretending the image is a
# release. Read at runtime via process.env.VIBE_MYBOOKS_VERSION.
ARG VERSION=dev
ENV VIBE_MYBOOKS_VERSION=$VERSION

# Serve static web files from API
ENV NODE_ENV=production
ENV PORT=3001
EXPOSE 3001

# Health check — app:app has access via the unprivileged port (3001).
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -q -O - http://localhost:3001/health || exit 1

# Entry point. Strip any CR characters in case the build context was
# checked out on Windows with core.autocrlf=true — a "#!/bin/sh\r"
# shebang causes the kernel's execve() to fail looking for an
# interpreter named "/bin/sh\r", surfacing as the misleading error
# "exec /docker-entrypoint.sh: no such file or directory".
COPY scripts/docker-entrypoint.sh /docker-entrypoint.sh
RUN sed -i 's/\r$//' /docker-entrypoint.sh && chmod +x /docker-entrypoint.sh

# Note: we deliberately do NOT `USER app` here. The entrypoint starts as
# root so it can chown the bind-mounted /data volume (owned on the host
# by whoever ran `docker compose up`, commonly UID 1000) to UID 1001,
# then `su-exec`s down to the `app` user before running the CMD. Every
# line of Node.js / bootstrap / migration code still runs as UID 1001 —
# only the first few ms of /docker-entrypoint.sh execute as root.
ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["node", "packages/api/dist/bootstrap.js"]
