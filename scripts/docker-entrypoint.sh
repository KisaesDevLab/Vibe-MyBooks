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
  # Parse KEY=VALUE lines manually rather than `. "$CONFIG_FILE"`.
  # Sourcing executes arbitrary shell — a corrupted or compromised
  # config file could run `rm -rf /` or exfiltrate secrets on startup.
  # This loop: skips comments / blanks, strips surrounding quotes on
  # the value, and refuses anything that doesn't look like a plain
  # identifier on the left of `=`.
  while IFS= read -r line || [ -n "$line" ]; do
    # Strip CR (Windows line endings) and trim leading whitespace
    line=$(printf '%s' "$line" | tr -d '\r' | sed 's/^[[:space:]]*//')
    case "$line" in
      ''|'#'*) continue ;;  # skip blank + comment lines
    esac
    key=${line%%=*}
    val=${line#*=}
    # Identifier-only keys: A-Z, 0-9, underscore, not starting with a digit.
    case "$key" in
      [A-Za-z_][A-Za-z0-9_]*) ;;
      *) echo "  (skipping malformed line: $key)" >&2; continue ;;
    esac
    # Strip paired surrounding quotes from the value (common in .env)
    case "$val" in
      \"*\") val=$(printf '%s' "$val" | sed 's/^"//;s/"$//') ;;
      \'*\') val=$(printf '%s' "$val" | sed "s/^'//;s/'$//") ;;
    esac
    export "$key=$val"
  done < "$CONFIG_FILE"
  echo "Starting Vibe MyBooks..."
  exec node packages/api/dist/bootstrap.js
fi
