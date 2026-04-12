# Installation Sentinel

KIS Books ships with a tamper-evident installation sentinel that prevents the
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
1. Restore from a `.vmb` backup file into the current database.
2. Fix `DATABASE_URL` in `/data/config/.env` and restart.
3. Regenerate the sentinel in place from the diagnostic page (requires valid
   super-admin credentials).
4. Accept the reset: `docker compose exec api npx tsx scripts/reset-sentinel.ts`
   — this removes only the sentinel. You must also `rm /data/config/.initialized`
   and `/data/config/.env` to actually re-run setup. The two-step design
   prevents a single command from dropping a new admin onto existing data.

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

**Recovery:** if the old data is junk, delete `/data/.host-id` and restart.
If the old data matters, restore from a backup.

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
3. On valid key: decrypts `/data/.env.recovery`, writes a fresh
   `/data/config/.env` with the recovered values and sensible defaults,
   and prompts for a container restart

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

- **Same host** → restore is treated as in-place recovery, generates a
  fresh sentinel + new recovery key, and the response says
  `crossHostRestore: false`
- **Different host (or no host-id in backup)** → treated as a cross-host
  handoff, audit-logged as `installation.host_id_changed`, and the
  response carries `crossHostRestore: true`. The new recovery key is
  returned in the `/restore/execute` response body for the operator to
  save.

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
| `scripts/reset-sentinel.ts` | Delete the sentinel to allow intentional re-initialization |
| `scripts/recover-env.ts` | Headless recovery of `/data/config/.env` from a recovery key |
| `scripts/verify-installation.ts` | Full-state integrity diagnostic |

See `SETUP_SENTINEL_PLAN.md` for the original specification and
`.claude/plans/serialized-watching-moler.md` for implementation notes.
