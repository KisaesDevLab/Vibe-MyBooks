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
    font-noto-emoji
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

# Create data directories
RUN mkdir -p /data/uploads /data/backups /data/config /data/generated

# Serve static web files from API
ENV NODE_ENV=production
ENV PORT=3001
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -q -O - http://localhost:3001/health || exit 1

# Entry point. Strip any CR characters in case the build context was
# checked out on Windows with core.autocrlf=true — a "#!/bin/sh\r"
# shebang causes the kernel's execve() to fail looking for an
# interpreter named "/bin/sh\r", surfacing as the misleading error
# "exec /docker-entrypoint.sh: no such file or directory".
COPY scripts/docker-entrypoint.sh /docker-entrypoint.sh
RUN sed -i 's/\r$//' /docker-entrypoint.sh && chmod +x /docker-entrypoint.sh
ENTRYPOINT ["/docker-entrypoint.sh"]
