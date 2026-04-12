# Vibe MyBooks — Backup & Restore

## Creating Backups

### From the UI
Settings > Backup > "Create Backup Now"

### From CLI
```bash
docker exec kisbooks-app sh scripts/backup.sh
```

### Automated Schedule
Set the backup schedule in Settings > Backup (None / Daily / Weekly / Monthly).

## Backup Format

Backups are AES-256-GCM encrypted files with `.kbk` extension containing:
- Database dump (all tenant data)
- Metadata (timestamp, app version)

**Encryption key:** Set via `BACKUP_ENCRYPTION_KEY` in `.env`. Without this key, backups cannot be decrypted.

## Restoring

### From the UI
1. Settings > Backup > "Restore from Backup"
2. Upload the `.kbk` file
3. Type `RESTORE` to confirm
4. Wait for restore to complete

### Important Notes
- Restoring replaces ALL current data
- A safety backup is created automatically before restore
- You will be logged out after restore completes
- The `BACKUP_ENCRYPTION_KEY` must match the one used when the backup was created

## Retention

- Default: keep last 30 daily backups
- Configurable via `RETENTION_DAYS` environment variable
- Old backups are automatically deleted by the backup script

## Disaster Recovery

1. Fresh server: `docker compose -f docker-compose.prod.yml up -d`
2. Wait for services to start
3. Register a temporary account
4. Settings > Backup > Restore from your backup file
5. Log in with your original credentials
