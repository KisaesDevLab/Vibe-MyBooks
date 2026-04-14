# Stage 1: Build shared + API
FROM node:20-alpine AS api-build
WORKDIR /app
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

# Install production dependencies only
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

# Entry point
COPY scripts/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh
ENTRYPOINT ["/docker-entrypoint.sh"]
