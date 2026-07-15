# Vibe MyBooks — Backup & Restore

## Backup Formats

Vibe MyBooks supports two backup formats:

| Format | Extension | Encryption | Portability |
|--------|-----------|------------|-------------|
| **System package** | `.vmx` | AES-256-GCM per entry, key from user passphrase (PBKDF2) | Restorable on any Vibe MyBooks instance; includes attachment files |
| **Portable (DB-only)** | `.vmb` | AES-256-GCM with user passphrase (PBKDF2) | Restorable on any Vibe MyBooks instance; database rows only |
| **Legacy** | `.kbk` | AES-256-GCM with server `BACKUP_ENCRYPTION_KEY` | Requires the same server encryption key |

The disaster-recovery bundle (**Admin → Installation Security → Download DR bundle**) is a `.vmx` system package: all tenants, users, configuration, attachment files, and the installation recovery files.

### What a system bundle contains (format `kis-books-system-v2`)

The system bundle is **complete by construction**: every table in the database
is exported unless it appears on a short, explicit exclusion list, and a unit
test (`backup-table-plan.test.ts`) fails the build if a new table is neither
exported nor consciously excluded.

- **Per-tenant data** — every table with a `tenant_id` column, per tenant.
- **Global data** (`global_tables` section) — every other table whole:
  Plaid configuration and item access tokens, SMS/2FA provider settings, AI
  provider configuration, SMTP settings, firm integrations, OAuth grants,
  passkeys, budget lines/periods, reconciliation lines, payroll import rows,
  report pack items, global bank rules (`tenant_id IS NULL`), and so on.
- **Credentials are included verbatim.** Encrypted credential columns
  (`*_encrypted`) travel as stored; they decrypt on the restored server as
  long as it has the original `PLAID_ENCRYPTION_KEY` (recovered via
  `/data/.env.recovery` + your recovery key). The bundle itself is
  passphrase-encrypted (PBKDF2 + AES-256-GCM), so possession of the file
  alone reveals nothing. The post-restore checklist probe-decrypts one
  restored credential and warns if the encryption key doesn't match.
- **Files beyond receipts** — the bundle packages every upload category:
  receipt/document attachments, bank-statement extraction sources, portal
  receipt and Q&A uploads, payroll import files, and generated report PDFs.
- **Excluded (deliberately):** short-TTL security tokens only — active login
  sessions, one-time OTP codes, magic links, portal session tokens, password
  reset tokens, OAuth authorization codes. Users simply sign in again after a
  restore. Each exclusion is documented in
  `packages/api/src/services/backup-table-plan.ts`.

**Compatibility:** v1 bundles (`kis-books-system-v1`, pre-v2 releases) still
restore; current code additionally applies their `system_config` section
(SMTP settings), which older restore code ignored. v1 bundles simply never
captured Plaid/SMS credentials, budget lines, or non-attachment files — take
a fresh bundle after upgrading. Old releases restoring a v2 bundle recover
tenants/users/tenant data/attachments but skip the new `global_tables` and
extra file categories.

**Known limitation:** single-tenant backups (Settings → Backup) capture the
tenant's own tables; child tables without a `tenant_id` column (e.g. budget
lines) and system-level settings are only in the **system** bundle — use the
DR bundle for full disaster recovery.

### Multi-part bundles

A DR bundle larger than the per-part budget (`BACKUP_PART_MAX_MB`, default **90 MB**) downloads as **several `.vmx` part files**:

```
kis-books-backup-<timestamp>.part01of03.vmx
kis-books-backup-<timestamp>.part02of03.vmx
kis-books-backup-<timestamp>.part03of03.vmx
```

The default budget keeps every part under common proxy upload limits (e.g. Cloudflare's 100 MB request cap), so a restore works through your public hostname from anywhere.

- **Keep every part together — all parts are required to restore.** The restore refuses to run with any part missing and says exactly which ones it lacks.
- Every part is individually encrypted and carries an authenticated inventory; a corrupted, tampered, or mismatched part is detected and named during upload.
- All parts share one passphrase (the one you set when creating the bundle).

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

**Supported providers:** S3 (AWS, MinIO, R2), Backblaze B2, Dropbox, Google Drive, OneDrive

Backblaze B2 uses its S3-compatible API: enter the bucket's S3 endpoint (e.g. `https://s3.us-west-004.backblazeb2.com`), the application key's keyID, and the applicationKey itself in **Admin > System Settings > Remote Backup Storage**.

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

### Restoring on a Fresh Server (Disaster Recovery)

On a brand-new install, open the first-run wizard (`/first-run-setup`) and choose **Restore from backup**:

1. Select **all** of the bundle's files at once (one `.vmx`/`.vmb`, or every `.partNNofMM.vmx` file)
2. Enter the backup passphrase
3. Click **Upload & Validate** — each part is verified as it uploads
4. Click **Restore Now** once every part is staged
5. **Save the new recovery key** shown on the completion screen

### Cross-Host Restore
Passphrase-encrypted backups (`.vmx`/`.vmb`) can be restored on a different server. When a cross-host restore is detected:
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
