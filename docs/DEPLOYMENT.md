# Vibe MyBooks — Production Deployment Guide

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
# Complete the setup wizard
```

## One-Line Install

**Linux / macOS:**
```bash
curl -fsSL https://raw.githubusercontent.com/KisaesDevLab/Vibe-MyBooks/main/scripts/install.sh | bash
```

**Windows (PowerShell as Administrator):**
```powershell
irm https://raw.githubusercontent.com/KisaesDevLab/Vibe-MyBooks/main/scripts/install.ps1 | iex
```

## First-Run Setup Wizard

On first launch, Vibe MyBooks presents a setup wizard that:
1. Tests the database connection
2. Generates secure secrets (if not already in `.env`)
3. Creates the super admin account
4. Seeds the default chart of accounts
5. Generates an **installation sentinel** and **recovery key**

**Save your recovery key.** It's a 25-character code (`RKVMB-XXXXX-XXXXX-XXXXX-XXXXX-XXXXX`) shown once during setup. If you lose your `.env` file, this key is the only way to recover your encryption secrets. See [SENTINEL.md](SENTINEL.md) for details.

## HTTPS with Reverse Proxy

Use Nginx, Caddy, or Traefik as a reverse proxy in front of the app container. Set `CORS_ORIGIN` in `.env` to your domain.

Example Caddy config:
```
your-domain.com {
  reverse_proxy localhost:3001
}
```

## Backups

### Portable Backup (Recommended)
Create passphrase-encrypted `.vmb` backups from **Settings > Backup & Restore** in the UI. These can be restored on any Vibe MyBooks instance.

### CLI Backup
```bash
docker exec kisbooks-app sh scripts/backup.sh
```

### Automated Backups
- **Local schedule:** Set in **Settings > Backup** (None / Daily / Weekly / Monthly)
- **Remote/cloud:** Configure S3, Dropbox, Google Drive, or OneDrive under **Settings > File Storage** for automatic off-site backups with GFS retention

See [BACKUP.md](BACKUP.md) for restore procedures and disaster recovery.

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
- Audit log available at **Settings > Audit Log**
- Installation integrity: `docker compose exec api npx tsx scripts/verify-installation.ts`

## Security Checklist

- [ ] Set `POSTGRES_PASSWORD` to a long random value (not `kisbooks`)
- [ ] Set `JWT_SECRET` to a long random value (≥ 48 chars)
- [ ] Set `ENCRYPTION_KEY` and `PLAID_ENCRYPTION_KEY` to distinct 64-hex-char random values
- [ ] Save your recovery key in a secure location (password manager, not the appliance)
- [ ] Optional: set `BACKUP_ENCRYPTION_KEY` if you want encrypted scheduled backups
- [ ] Configure HTTPS via reverse proxy
- [ ] Enable 2FA for all admin accounts
- [ ] Set up automated backups (local + remote)
- [ ] Restrict Docker port exposure in production

## Environment Variables

See [`.env.example`](../.env.example) for the complete list. The four
variables marked Required below must be set before compose will start —
`scripts/install.sh` generates strong random values automatically on a
fresh install; hand-edit `.env` only when you're provisioning by some
other mechanism.

| Variable | Required | Description |
|----------|----------|-------------|
| `POSTGRES_PASSWORD` | Yes | Database password. Generate with `openssl rand -base64 32 \| tr -d '/+='`. Compose refuses to start if unset. |
| `JWT_SECRET` | Yes | Access-token signing key (≥20 chars). Generate with `openssl rand -base64 48`. |
| `ENCRYPTION_KEY` | Yes | 64-hex-char AES-256 key wrapping the installation sentinel. Generate with `openssl rand -hex 32`. **Do not rotate after first boot — the existing sentinel becomes unreadable.** |
| `PLAID_ENCRYPTION_KEY` | Yes | 64-hex-char AES-256 key wrapping **all** encrypted-at-rest columns — Plaid, Stripe, OAuth refresh tokens, TFA secrets. Misleading name kept for backwards compatibility. Generate with `openssl rand -hex 32`. **Do not rotate after first boot.** |
| `DATABASE_URL` | Yes (composed) | Composed automatically inside compose from POSTGRES_USER / POSTGRES_PASSWORD / POSTGRES_DB. Set directly only when running the API outside compose. |
| `BACKUP_ENCRYPTION_KEY` | No | Optional encryption key for scheduled backups. If unset, backups are unencrypted. |
| `SMTP_HOST/PORT/USER/PASS` | No | Email delivery for invoices and notifications. |
| `PLAID_CLIENT_ID/SECRET` | No | Enable Plaid bank connections. Separate from `PLAID_ENCRYPTION_KEY` above. |
| `ANTHROPIC_API_KEY` | No | Enable AI features (categorization, OCR, chat). |
| `TS_AUTHKEY` | No | Tailscale pre-auth key. If blank, pair via the in-app wizard. |
