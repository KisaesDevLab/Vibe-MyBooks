#!/bin/sh
# Copyright 2026 Kisaes LLC
# Licensed under the PolyForm Internal Use License 1.0.0.
# You may not distribute this software. See LICENSE for terms.

# Entry point for both the production image (Dockerfile at repo root)
# and the dev image (packages/api/Dockerfile). Two responsibilities:
#
#   1. If the image started as root, normalize the bind-mounted /data
#      volume to UID 1001 (the "app" user) and then drop privileges via
#      su-exec. A host-created ./data directory is owned by whoever ran
#      `docker compose up` (commonly UID 1000) and is unwritable from
#      inside the container without this step, surfacing as an EACCES
#      mkdir during route module init on first request.
#
#   2. If an on-disk config file exists at /data/config/.env (the
#      recovery path — env-missing UI writes this after the operator
#      pastes their recovery key), source it before exec'ing bootstrap.
#      On the install.sh happy path, compose supplies env via env_file:
#      .env and this branch is a no-op.
#
# Both branches end with `exec "$@"` running bootstrap.ts/bootstrap.js
# as the `app` user.

set -e

# --- Step 1: run-as-root privilege-drop block -------------------------
# Re-exec'd as `app` via su-exec; the inner run trips id -u == 1001 and
# skips this branch.
if [ "$(id -u)" = "0" ]; then
  if [ -d /data ]; then
    # Only chown files that don't already belong to app. A full -R on
    # an established install with thousands of attachments would push
    # a lot of metadata writes through the bind mount on every restart.
    find /data ! -user 1001 -exec chown 1001:1001 {} + 2>/dev/null || \
      echo "[entrypoint] WARNING: could not chown parts of /data — the container may still work but writes could fail. On Linux check SELinux / AppArmor, or pre-create ./data with:  sudo chown -R 1001:1001 ./data" >&2
    # Make sure the expected subdirs exist with correct ownership even
    # when the host mount was empty.
    for sub in uploads backups config generated cache; do
      mkdir -p "/data/$sub"
      chown 1001:1001 "/data/$sub" 2>/dev/null || true
    done
  fi
  # Re-exec this same script as the unprivileged user, preserving CMD.
  exec su-exec app:app "$0" "$@"
fi

# --- Step 2: optional /data/config/.env loader ------------------------
# Runs as `app` (either from su-exec above or from `USER app` in a
# legacy dev image). Reads env vars from the recovery config file if
# present, otherwise just exec's whatever CMD compose supplied.
CONFIG_FILE="/data/config/.env"

if [ -f "$CONFIG_FILE" ]; then
  echo "[entrypoint] loading configuration from $CONFIG_FILE..."
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
fi

echo "[entrypoint] starting Vibe MyBooks..."
exec "$@"
