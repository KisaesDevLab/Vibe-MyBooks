#!/bin/sh
set -e

CONFIG_FILE="/data/config/.env"

if [ ! -f "$CONFIG_FILE" ]; then
  echo "============================================="
  echo "  Vibe MyBooks — First-Run Setup Required"
  echo "============================================="
  echo ""
  echo "  Open http://localhost:3001/setup in your browser"
  echo "  to complete the setup wizard."
  echo ""
  echo "  Or run the CLI setup:"
  echo "  docker exec -it kisbooks-api npx tsx scripts/setup.ts"
  echo ""
  echo "============================================="
  echo ""
  echo "Starting in setup mode..."
  exec node packages/api/dist/bootstrap.js
else
  echo "Loading configuration from $CONFIG_FILE..."
  set -a
  . "$CONFIG_FILE"
  set +a
  echo "Starting Vibe MyBooks..."
  exec node packages/api/dist/bootstrap.js
fi
