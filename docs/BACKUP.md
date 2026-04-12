# Vibe MyBooks — Backup & Restore

## Backup Formats

Vibe MyBooks supports two backup formats:

| Format | Extension | Encryption | Portability |
|--------|-----------|------------|-------------|
| **Portable** | `.vmb` | AES-256-GCM with user passphrase (PBKDF2) | Restorable on any Vibe MyBooks instance |
| **Legacy** | `.kbk` | AES-256-GCM with server `BACKUP_ENCRYPTION_KEY` | Requires the same server encryption key |

Portable backups (`.vmb`) are the recommended format. They are encrypted with a passphrase you choose, so they can be restored on any instance without needing the original server's encryption key.

## Creating Backups

### From the UI (Portable)
1. Go to **Settings > Backup & Restore**
2. Click **Create Encrypted Backup**
3. Enter a passphrase (minimum 12 characters) — a strength meter guides you
4. The `.vmb` file downloads automatically

**Important:** If you forget the passphrase, the backup cannot be recovered. Store it securely.

### From CLI (Legacy)
```bash
docker exec kisbooks-app sh scripts/backup.sh
```

This creates a `.kbk` backup encrypted with `BACKUP_ENCRYPTION_KEY` from your `.env`.

### Automated Schedule
Set the backup schedule in **Settings > Backup** (None / Daily / Weekly / Monthly). Scheduled backups use the legacy format.

## Cloud / Remote Backups

Vibe MyBooks can automatically push backups to cloud storage with Grandfather-Father-Son (GFS) retention:

**Supported providers:** S3 (AWS, MinIO, R2), Dropbox, Google Drive, OneDrive

Configure under **Settings > File Storage** or via the admin panel. Remote backups run on a schedule alongside local backups and are retained according to GFS policy (daily, weekly, monthly tiers).

## Restoring

### From the UI
1. Go to **Settings > Backup & Restore**
2. Click **Restore from Backup**
3. Upload the backup file (`.vmb` or `.kbk`)
4. For `.vmb` files: enter the backup passphrase
5. Type `RESTORE` to confirm
6. Wait for restore to complete

### Important Notes
- Restoring **replaces ALL current data** for the affected tenants
- A safety backup is created automatically before restore
- You will be logged out after restore completes
- For `.kbk` files: the `BACKUP_ENCRYPTION_KEY` must match the one used when the backup was created
- For `.vmb` files: only the passphrase is needed (no server key required)

### Cross-Host Restore
Portable `.vmb` backups can be restored on a different server. When a cross-host restore is detected:
- A new installation sentinel and recovery key are generated
- The response includes the new recovery key — **save it immediately**
- Audit log records the host change

## Backup History
The **Settings > Backup & Restore** page shows all previous backups with:
- Filename, size, and creation date
- Format (Portable or Legacy)
- Download and delete buttons

## Retention
- Default: keep last 30 daily backups (local)
- Remote/cloud backups follow GFS retention policy
- Configurable via environment variables and admin settings
- Old backups are automatically cleaned up

## Disaster Recovery

### Full Recovery (Fresh Server)
1. Deploy fresh: `docker compose -f docker-compose.prod.yml up -d`
2. Wait for services to start
3. Complete the setup wizard (creates a temporary admin account)
4. Go to **Settings > Backup & Restore**
5. Upload your `.vmb` backup file and enter the passphrase
6. Log in with your original credentials

### Environment Recovery (Lost .env)
If your `.env` file is lost but your data volume (`./data`) survives:
1. The boot process detects missing environment variables
2. A diagnostic page offers recovery-key input
3. Enter your 25-character recovery key (`RKVMB-XXXXX-...`)
4. The system decrypts the stored secrets and writes a fresh `.env`
5. Restart the container

See [SENTINEL.md](SENTINEL.md) for details on the installation integrity system.

### CLI Recovery
```bash
# Headless env recovery
docker compose exec api npx tsx scripts/recover-env.ts

# Full installation integrity check
docker compose exec api npx tsx scripts/verify-installation.ts
```
