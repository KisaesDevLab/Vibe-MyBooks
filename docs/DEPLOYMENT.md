# KIS Books — Production Deployment Guide

## Prerequisites

- Docker Engine 24+ and Docker Compose v2
- Domain name (optional, for HTTPS)
- SMTP credentials (optional, for email delivery)

## Quick Deploy

```bash
# 1. Generate secrets
npx tsx scripts/generate-secrets.ts
# Save the output — you'll need these values

# 2. Configure
cp .env.production.example .env
# Edit .env with your generated secrets and SMTP config

# 3. Build and start
docker compose -f docker-compose.prod.yml up -d

# 4. Open http://your-server:3001
# Register your first account
```

## HTTPS with Reverse Proxy

Use Nginx, Caddy, or Traefik as a reverse proxy in front of the app container. Set `CORS_ORIGIN` in `.env` to your domain.

Example Caddy config:
```
your-domain.com {
  reverse_proxy localhost:3001
}
```

## Backups

```bash
# Manual backup
docker exec kisbooks-app sh scripts/backup.sh

# Automated daily backups (cron)
0 2 * * * docker exec kisbooks-app sh scripts/backup.sh
```

See [BACKUP.md](BACKUP.md) for restore procedures.

## Updating

```bash
git pull
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
# Migrations run automatically on startup
```

## Monitoring

- Health check: `GET /health` returns `{ status: "ok" }`
- Docker healthcheck built in (auto-restarts on failure)
- Audit log available at Settings > Audit Log
