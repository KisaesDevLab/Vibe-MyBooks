# Installation Sentinel

Vibe MyBooks ships with a tamper-evident installation sentinel that prevents the
first-run setup wizard from accidentally re-running on an already-configured
installation. This document is the operator runbook.

## Threat model

The primary scenario: an operator runs `docker compose down -v` (perhaps to
prune unused volumes) and the postgres named volume is destroyed. The
bind-mounted `./data` directory survives because bind mounts are outside
Docker's volume system. Without protection, the next `docker compose up`
would:

1. Find an empty database → render the setup wizard.
2. Let the operator create a new admin with new credentials.
3. Leave the old attachments, backups, and config orphaned on `/data`.
4. If the operator's old credentials were good and the env file is intact,
   they'd also silently overwrite `.env` (or refuse, depending on flags).

The sentinel makes this safe: the next boot detects the mismatch between the
surviving storage volume and the empty database, blocks startup, and shows a
diagnostic page explaining what happened and how to recover.

## Volume layout (verified)

From `docker-compose.yml`:

- `pgdata` — **Docker-managed named volume**, destroyed by `docker compose down -v`.
- `./data:/data` — **host bind mount**, survives `docker volume prune` and
  `down -v`.

The separation is real. The sentinel lives on the bind-mounted side so it
survives database wipes.

## Files the sentinel system writes

All paths inside the container, relative to `/data`:

| Path | Purpose | Created | Encrypted? |
|---|---|---|---|
| `/data/.sentinel` | Encrypted installation record | first `/initialize` | AES-256-GCM with `ENCRYPTION_KEY` |
| `/data/.host-id` | Volume-pinned UUID (F8 signal) | first boot | No — plaintext UUID |
| `/data/config/.initialized` | Legacy marker (pre-existing) | first `/initialize` | No — plaintext JSON |

The sentinel file format is documented in `packages/api/src/services/sentinel.service.ts`.
Magic bytes: `KISS`. Version 1 uses a length-prefixed plaintext JSON header,
CRC32, GCM-encrypted payload.

The plaintext header stays readable even if `ENCRYPTION_KEY` is lost, so the
diagnostic pages can still show installation ID, setup date, and admin email
during recovery.

## Validation on every boot

On every API container start, `bootstrap.ts` runs preflight before the
normal Express app is brought up:

1. Run database migrations (so `system_settings` exists).
2. Read `system_settings.installation_id` from the DB.
3. Read the sentinel header from `/data/.sentinel`.
4. Decrypt the sentinel payload with `ENCRYPTION_KEY`.
5. Read `/data/.host-id`.
6. Compare all three against each other.
7. Decide one of: OK, fresh install, regenerate sentinel, or BLOCKED.

## Block codes and what they mean

If preflight decides BLOCKED, a minimal diagnostic Express app listens on
`PORT` instead of the normal API. It exposes only `/api/diagnostic/*` and the
static frontend. None of the normal routes — including `/api/setup/*` — are
mounted. The diagnostic frontend reads `/api/diagnostic/status` and renders
the matching page.

### `DATABASE_RESET_DETECTED`

The sentinel is valid but `system_settings.installation_id` is missing.

**Most common causes:**
- `docker compose down -v` destroyed `pgdata`.
- A migration or restore failed partway through.
- `DATABASE_URL` is pointing at the wrong (empty) database.

**Recovery options:**
1. **Restore from a backup (recommended, no shell needed).** The database is
   empty, so no account can authenticate; the diagnostic page instead asks
   for the installation's **recovery key** (it must decrypt
   `/data/.env.recovery`) plus a typed `RESTORE`. `POST
   /api/diagnostic/prepare-restore` then sets `/data/.sentinel` and
   `/data/config/.initialized` aside as timestamped copies, **keeps
   `/data/.host-id`** (so the restore is recognised as same-host: credentials
   stay readable and the recovery key stays valid) and writes
   `/data/.restore-intent`. Restart the api; preflight treats "host-id, no
   sentinel, empty DB **+ intent**" as a sanctioned fresh install instead of
   `ORPHANED_DATA`, and the setup wizard offers *Restore from backup*
   (upload, local backup folder / mounted drive, or Backblaze B2). The intent
   file is removed when setup or the restore completes.
2. Fix `DATABASE_URL` / `POSTGRES_PASSWORD` in the install `.env` and restart
   (when the api was simply pointed at the wrong or an empty database).
3. Regenerate the sentinel in place from the diagnostic page (requires valid
   super-admin credentials — only possible when the database still holds
   accounts).
4. Without a recovery key, file-system access is the proof of ownership:
   ```
   docker compose exec api sh -c 'mv /data/.sentinel /data/.sentinel.pre-restore-$(date +%s); \
     mv /data/config/.initialized /data/config/.initialized.pre-restore-$(date +%s) 2>/dev/null; \
     echo "{\"requestedAt\":\"$(date -u +%FT%TZ)\",\"source\":\"manual\"}" > /data/.restore-intent'
   docker compose restart api
   ```
   or interactively `docker compose exec api npx tsx scripts/reset-sentinel.ts`.

**Why the marker is not enough on its own.** `/data/config/.initialized` is a
strong signal, not an oracle: `getSetupStatus` always cross-checks it against
the database. A marker over a database with **no users** (volume carried to a
new server, Postgres wiped) re-opens setup — there is no account to protect
and nothing to log in with — and is logged as
`installation.stale_marker_detected`. A marker over a database with users
keeps the lock; an unreachable database fails closed.

### `SENTINEL_DECRYPT_FAILED`

Sentinel header parses cleanly (CRC passes) but GCM decryption fails. Almost
always means `ENCRYPTION_KEY` in `.env` no longer matches the one used at
setup time.

**Recovery:** restore the correct `ENCRYPTION_KEY`. Do NOT generate a new
one — a new key cannot decrypt the existing sentinel, and regenerating it
will also not help if the key mismatch came from the env file being lost.

### `SENTINEL_CORRUPT`

Magic bytes / CRC / format version check failed. The file is damaged at the
byte level — disk corruption, an interrupted write, or manual tampering.
This is distinct from DECRYPT_FAILED because the CRC covers the plaintext
header, catching byte-flips before GCM is even attempted.

**Recovery:** same as decrypt failed — regenerate the sentinel from the
diagnostic page with super-admin credentials, or restore from backup.

### `INSTALLATION_MISMATCH`

The DB `installation_id` and the sentinel's `installationId` both exist but
disagree. Almost always means `DATABASE_URL` is pointing at a different
installation's database, or the storage volume was attached to the wrong
server.

**Recovery:** manual investigation. No automatic fix — starting over risks
data corruption. The diagnostic page shows both IDs and both host IDs side
by side to help triage.

### `ORPHANED_DATA`

`/data/.host-id` exists but there's no sentinel and no `installation_id` in
the database. Means `/data` contains leftover state from a previous
installation.

**Recovery:** if the old data is junk, delete `/data/.host-id` (and any
`/data/config/.initialized`) and restart. If the old data matters, keep
`.host-id`, write `/data/.restore-intent` (see DATABASE_RESET_DETECTED option
4) and restart — the wizard then offers *Restore from backup* as a same-host
restore.

## CLI scripts

### `reset-sentinel.ts`

```
docker compose exec api npx tsx scripts/reset-sentinel.ts
```

Prompts for RESET confirmation. Deletes only `/data/.sentinel`. Audit-logs
the action to stdout. To fully reset the installation, you also need:

```
docker compose exec api rm /data/config/.initialized
docker compose exec api rm /data/config/.env
docker compose restart api
```

## `factory-reset.sh`

`scripts/factory-reset.sh` deletes `/data/` wholesale. This removes the
sentinel, host ID, `.initialized`, `.env`, attachments, and backups. Next
boot behaves as a fresh install — the setup wizard runs and a new
installation ID is generated. This is the correct "nuke it from orbit" path
and does not need special handling for the sentinel.

## Phase B — Recovery Key System

Phase B adds a 25-character recovery key (`RKVMB-XXXXX-XXXXX-XXXXX-XXXXX-XXXXX`)
that protects the three env values you cannot reconstruct after a loss:
`ENCRYPTION_KEY`, `JWT_SECRET`, `DATABASE_URL`.

### What's stored where

| Path | Purpose | Created by |
|---|---|---|
| `/data/.env.recovery` | AES-256-GCM(PBKDF2(recovery_key)) over the three secrets | Setup wizard, admin Security page |
| (none — key is never persisted) | The 25-char key itself | Shown to operator once |

### Setup flow

After the wizard writes the sentinel, it:

1. Generates a fresh recovery key
2. Writes `/data/.env.recovery` using the key as the passphrase
3. Returns the key in the `/initialize` response body
4. The UI renders it with Copy / Print buttons and a mandatory checkbox

The key is never logged, never stored in the DB, and never shown again.
If the operator refreshes the page before clicking the checkbox, the key
is lost — the recovery file stays behind (useless), and they'll need to
regenerate from the admin Security page.

### Env-missing recovery

If `DATABASE_URL`, `JWT_SECRET`, or `ENCRYPTION_KEY` is missing at boot,
`bootstrap.ts` detects this BEFORE importing `config/env.ts` and starts a
minimal diagnostic server that:

1. Reads the sentinel header (works without env vars)
2. If the header is present, offers a recovery-key input
3. On valid key: decrypts `/data/.env.recovery` and writes
   `/data/config/.env` containing **only the recovered secrets**
   (`DATABASE_URL`, `JWT_SECRET`, `ENCRYPTION_KEY`, and
   `PLAID_ENCRYPTION_KEY` from a v2 file). `docker-entrypoint.sh` uses that
   file to *fill in* variables the compose environment leaves unset or
   empty — a value compose already supplies always wins, so the recovered
   file can never shadow a rotated `POSTGRES_PASSWORD` or a changed
   `CORS_ORIGIN`. A v1 file carries no `PLAID_ENCRYPTION_KEY`; if the
   environment lacks it too the endpoint answers `409
   MISSING_AFTER_RECOVERY` and the page lets the operator either add the
   original value to the install `.env` or knowingly generate a new key
   (existing Plaid/SMS/AI/TOTP ciphertext becomes unreadable).
4. Prompts for a container restart

The env-missing app is rate-limited to 10 POSTs per minute per IP. The
headless equivalent is `scripts/recover-env.ts`.

### Admin Security page (`/admin/security`)

Super admins can:

- **Generate new recovery key** — invalidates the old one; shows the new
  one once
- **Rotate installation ID** — generates a new UUID, rewrites sentinel +
  recovery file, shows a new recovery key (use after a suspected
  compromise or on a compliance schedule)
- **Test a recovery key** — verifies without revealing the decrypted
  contents
- **Delete recovery file** — for operators who manage `.env` externally
  and consider the recovery file a liability

Every destructive action requires the caller's current password.

## Phase C — Polish & Integration

### DB fingerprint

`/data/.db-fingerprint` is a plaintext JSON snapshot of tenant/user/
transaction counts, rewritten hourly by `startFingerprintScheduler()`.
It's a supplementary integrity signal — if the sentinel and
`installation_id` both pass but the transaction count silently dropped
from 12,450 to 0, `scripts/verify-installation.ts` will flag the
divergence even though preflight wouldn't have blocked.

### Backup integration

`createSystemBackup()` now embeds `/data/.sentinel`, `/data/.host-id`, and
`/data/.env.recovery` into the `.vmb` archive under an `installation_files`
key. On restore, `/restore/execute` compares the backup's `hostId` to the
current `/data/.host-id`:

- **Same host, same secrets** → the bundle's `.env.recovery` is written
  back verbatim and the operator's original recovery key stays valid
  (`recoveryKeyPreserved: true`). "Same secrets" is *proven*, not assumed:
  the bundle's own sentinel must decrypt with the current `ENCRYPTION_KEY`
  and carry the current `JWT_SECRET` hash, and the restored credentials
  (including every user's TOTP secret) must decrypt with the current
  `PLAID_ENCRYPTION_KEY`.
- **Same host, rotated keys** (`keysRotatedSinceBackup: true`) → treated
  like a cross-host restore for key purposes: the bundle's recovery file is
  parked at `/data/.env.recovery.source`, a new recovery key is issued, and
  credential re-encryption runs if the operator supplied the original key.
- **Different host (or no host-id in backup)** → audit-logged as
  `installation.host_id_changed`, `crossHostRestore: true`, new recovery
  key returned in the run result.

Two more restore outcomes are first-class:

- **Bundles with no user accounts** (every tenant-scoped `.vmx`/`.vmb`, or a
  system bundle exported before any user existed) restore their data but
  do **not** write the sentinel or the `.initialized` marker — that used to
  lock the setup router with nobody able to sign in. The run result says
  `needsAdminUser: true`, `/api/setup/status` reports `needsAdminUser`, and
  the wizard continues to the admin step; `/initialize` with
  `adoptExistingTenants: true` creates the admin inside the restored data
  (owner access to every restored tenant, no new tenant, no COA seed) and
  then writes sentinel + marker.
- **Locked-out 2FA users.** `users.tfa_totp_secret_encrypted` is keyed by
  `PLAID_ENCRYPTION_KEY`. The checklist's `tfa` item (status `error`) and
  the run's `tfaLockedUsers` list name every user — super admins first —
  whose authenticator secret cannot be decrypted on this server. The wizard
  shows the list with a recovery-key field that calls `POST
  /api/setup/restore/runs/:runId/recover-credentials` (the unguessable
  runId is the bearer credential, as for polling) to re-encrypt all
  restored credentials and TOTP secrets *before* the login page. At login,
  an unreadable TOTP secret now answers `409 TFA_SECRET_UNREADABLE` with
  instructions instead of an endless "Invalid code".

If the sentinel cannot be written **after** the database restore has
committed (typically `/data` not writable by UID 1001), the run still
completes: `finalization: { ok: false, error }` plus a warning explain that
the data is restored, no recovery key was issued, and the sentinel is
regenerated at the next boot once permissions are fixed. Retrying the
restore would only 409 — the data is already there.

### `scripts/verify-installation.ts`

Standalone CLI that prints the full integrity state — sentinel, host-id,
recovery file, DB fingerprint, installation ID agreement between DB and
sentinel. Exits 0 (healthy), 1 (needs attention), 2 (blocked), or
3 (unrecoverable error). Use for CI health checks and first-line triage.

```
docker compose exec api npx tsx scripts/verify-installation.ts
```

### CLI script index

| Script | Purpose |
|---|---|
> The published api image ships `scripts/` (`COPY scripts/ ./scripts/` in
> `packages/api/Dockerfile`), so `docker compose exec api npx tsx
> scripts/<name>.ts` works as written. Earlier images omitted the directory
> and every command below failed with "Cannot find module".

| `scripts/reset-sentinel.ts` | Delete the sentinel to allow intentional re-initialization |
| `scripts/recover-env.ts` | Headless recovery of `/data/config/.env` from a recovery key |
| `scripts/verify-installation.ts` | Full-state integrity diagnostic |

See `SETUP_SENTINEL_PLAN.md` for the original specification and
`.claude/plans/serialized-watching-moler.md` for implementation notes.
