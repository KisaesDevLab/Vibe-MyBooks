#!/bin/bash
# Vibe MyBooks Database Backup Script
# Usage: ./scripts/backup.sh
# Can be called from within Docker container or host

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/data/backups}"
DATABASE_URL="${DATABASE_URL:-postgresql://kisbooks:kisbooks@db:5432/kisbooks}"
BACKUP_ENCRYPTION_KEY="${BACKUP_ENCRYPTION_KEY:-}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"

TIMESTAMP=$(date -u +"%Y-%m-%dT%H%M%SZ")
FILENAME="kis-books-backup-${TIMESTAMP}.sql"
ENCRYPTED_FILENAME="${FILENAME}.gpg"

mkdir -p "${BACKUP_DIR}"

echo "=== Vibe MyBooks Backup ==="
echo "Timestamp: ${TIMESTAMP}"
echo "Backup dir: ${BACKUP_DIR}"

# Dump database
echo "Running pg_dump..."
pg_dump "${DATABASE_URL}" --no-owner --no-privileges > "${BACKUP_DIR}/${FILENAME}"
echo "Dump complete: $(du -h "${BACKUP_DIR}/${FILENAME}" | cut -f1)"

# Encrypt if key is provided
if [ -n "${BACKUP_ENCRYPTION_KEY}" ]; then
  echo "Encrypting backup..."
  gpg --batch --yes --symmetric --cipher-algo AES256 \
    --passphrase "${BACKUP_ENCRYPTION_KEY}" \
    --output "${BACKUP_DIR}/${ENCRYPTED_FILENAME}" \
    "${BACKUP_DIR}/${FILENAME}"
  rm "${BACKUP_DIR}/${FILENAME}"
  echo "Encrypted: ${ENCRYPTED_FILENAME}"
else
  echo "WARNING: No BACKUP_ENCRYPTION_KEY set. Backup is NOT encrypted."
  ENCRYPTED_FILENAME="${FILENAME}"
fi

# Retention cleanup
echo "Cleaning up backups older than ${RETENTION_DAYS} days..."
find "${BACKUP_DIR}" -name "kis-books-backup-*" -mtime +${RETENTION_DAYS} -delete 2>/dev/null || true
REMAINING=$(ls -1 "${BACKUP_DIR}"/kis-books-backup-* 2>/dev/null | wc -l)
echo "Backups retained: ${REMAINING}"

echo "=== Backup Complete ==="
echo "File: ${BACKUP_DIR}/${ENCRYPTED_FILENAME}"
