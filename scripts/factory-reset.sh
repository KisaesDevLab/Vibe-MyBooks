#!/bin/bash
# Vibe MyBooks — Factory Reset
# WARNING: This will DELETE ALL DATA permanently.

set -euo pipefail

echo "============================================="
echo "  Vibe MyBooks — Factory Reset"
echo "============================================="
echo ""
echo "  ⚠️  WARNING: This will permanently delete:"
echo "    - All database data (accounts, transactions, contacts, etc.)"
echo "    - All uploaded files and attachments"
echo "    - The .env configuration file"
echo ""
echo "  This action CANNOT be undone."
echo ""
read -p "  Type 'RESET' to confirm: " confirm

if [ "$confirm" != "RESET" ]; then
  echo "  Factory reset cancelled."
  exit 0
fi

echo ""
echo "Performing factory reset..."

# Remove .env
CONFIG_FILE="${CONFIG_DIR:-/data/config}/.env"
if [ -f "$CONFIG_FILE" ]; then
  rm "$CONFIG_FILE"
  echo "  ✓ Configuration removed"
fi

# Drop and recreate database
DATABASE_URL="${DATABASE_URL:-postgresql://kisbooks:kisbooks@db:5432/kisbooks}"
DB_NAME=$(echo "$DATABASE_URL" | sed 's/.*\///')
DB_BASE=$(echo "$DATABASE_URL" | sed "s/\/$DB_NAME//")

echo "  Dropping database $DB_NAME..."
psql "$DB_BASE/postgres" -c "DROP DATABASE IF EXISTS $DB_NAME;" 2>/dev/null || true
psql "$DB_BASE/postgres" -c "CREATE DATABASE $DB_NAME;" 2>/dev/null || true
echo "  ✓ Database reset"

# Remove uploads
UPLOAD_DIR="${UPLOAD_DIR:-/data/uploads}"
if [ -d "$UPLOAD_DIR" ]; then
  rm -rf "$UPLOAD_DIR"/*
  echo "  ✓ Uploads removed"
fi

# Remove backups
BACKUP_DIR="${BACKUP_DIR:-/data/backups}"
if [ -d "$BACKUP_DIR" ]; then
  rm -rf "$BACKUP_DIR"/*
  echo "  ✓ Backups removed"
fi

echo ""
echo "============================================="
echo "  Factory reset complete."
echo "  Restart the application to begin setup again."
echo "============================================="
