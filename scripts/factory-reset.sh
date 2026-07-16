#!/usr/bin/env bash
# Copyright 2026 Kisaes LLC
# Licensed under the PolyForm Small Business License 1.0.0.
# Free for small businesses; see LICENSE for terms.
#
# Vibe MyBooks — Factory Reset
#
# Returns the appliance to a clean FIRST-RUN state: empties the database and
# removes ALL user data AND the installation-identity files that gate the setup
# wizard. Run it from your install directory (the folder holding docker-compose
# and .env), e.g.  cd ~/vibe-mybooks && bash scripts/factory-reset.sh
#
# WARNING: This permanently deletes all accounts, transactions, contacts,
# uploads, backups, and the current recovery key. It CANNOT be undone.
#
# Why this is not just "drop the database": the first-run wizard is gated on
# installation-identity files on the /data volume — /data/.sentinel,
# /data/.host-id and /data/config/.initialized. If you drop the DB but leave
# those behind, the app detects a "database reset" mismatch and locks itself
# into a diagnostic page instead of showing the wizard. This script removes
# them too, which the old DB-only reset did not.
#
# The repo-level .env (your encryption keys / DB password) is KEPT so the stack
# still boots; the wizard mints a fresh installation identity and a NEW recovery
# key under those keys. To also rotate the secrets, delete .env and re-run the
# installer instead.

set -euo pipefail

echo "============================================="
echo "  Vibe MyBooks — Factory Reset"
echo "============================================="
echo ""
echo "  ⚠️  WARNING: This will permanently delete:"
echo "    - All database data (accounts, transactions, contacts, etc.)"
echo "    - All uploaded files and attachments"
echo "    - All local backups"
echo "    - The installation identity and current recovery key"
echo ""
echo "  This action CANNOT be undone."
echo ""
read -rp "  Type 'RESET' to confirm: " confirm
if [ "$confirm" != "RESET" ]; then
  echo "  Factory reset cancelled."
  exit 0
fi

# Must run where docker-compose + .env live so `docker compose` resolves the
# same stack (COMPOSE_FILE in .env selects prod + any host overlay).
if ! docker compose ps &>/dev/null; then
  echo "  ERROR: run this from your install directory (the folder with"
  echo "         docker-compose.*.yml and .env), e.g.  cd ~/vibe-mybooks"
  exit 1
fi

# DB identity from .env (defaults match the shipped compose).
POSTGRES_USER="$(grep -E '^POSTGRES_USER=' .env 2>/dev/null | cut -d= -f2-)"
POSTGRES_DB="$(grep -E '^POSTGRES_DB=' .env 2>/dev/null | cut -d= -f2-)"
POSTGRES_USER="${POSTGRES_USER:-kisbooks}"
POSTGRES_DB="${POSTGRES_DB:-kisbooks}"

echo ""
echo "Performing factory reset..."

# 1. Stop the app so nothing holds a DB connection or re-writes identity files
#    while we wipe (the api self-heals the marker if it sees tenants+users).
echo "  Stopping api and worker..."
docker compose stop api worker >/dev/null 2>&1 || true

# 2. Drop and recreate the database inside the db container (no host psql
#    needed). Terminate any lingering backends first, or DROP DATABASE blocks.
echo "  Resetting database $POSTGRES_DB..."
docker compose exec -T db psql -U "$POSTGRES_USER" -d postgres -v ON_ERROR_STOP=1 <<SQL >/dev/null
SELECT pg_terminate_backend(pid) FROM pg_stat_activity
  WHERE datname = '$POSTGRES_DB' AND pid <> pg_backend_pid();
DROP DATABASE IF EXISTS "$POSTGRES_DB";
CREATE DATABASE "$POSTGRES_DB" OWNER "$POSTGRES_USER";
SQL
echo "  ✓ Database reset"

# 3. Remove the installation-identity files and all user data on /data, using a
#    throwaway container that mounts the same /data volume (api/worker are down).
echo "  Removing installation identity and user data..."
docker compose run --rm --no-deps --entrypoint sh api -c '
  rm -f  /data/.sentinel /data/.host-id /data/.env.recovery
  rm -rf /data/config /data/generated /data/cache
  rm -rf /data/uploads/* /data/uploads/.[!.]* 2>/dev/null || true
  rm -rf /data/backups/* /data/backups/.[!.]* 2>/dev/null || true
' >/dev/null 2>&1 || true
echo "  ✓ Identity and data removed"

# 4. Bring the stack back up — migrations rebuild an empty schema and the app
#    returns to first-run.
echo "  Restarting..."
docker compose up -d >/dev/null 2>&1

echo ""
echo "============================================="
echo "  Factory reset complete."
echo ""
echo "  Open the app and complete the setup wizard again:"
echo "    http://localhost:${VITE_PORT:-5173}/setup"
echo "  Save the NEW recovery key it shows — it is not displayed again."
echo "============================================="
