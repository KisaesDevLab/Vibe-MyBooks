#!/bin/sh
# Copyright 2026 Kisaes LLC
# Licensed under the PolyForm Internal Use License 1.0.0.
# You may not distribute this software. See LICENSE for terms.
#
# Vibe MyBooks web container — runs as a /docker-entrypoint.d/ hook before
# nginx starts (the upstream nginx:1.27-alpine image's /docker-entrypoint.sh
# walks /docker-entrypoint.d/*.sh in numerical order).
#
# The SPA is built with `base: '/__VIBE_BASE_PATH__/'` (see
# packages/web/vite.config.ts) so a single image serves either '/'
# (single-app) or '/<prefix>/' (multi-app behind shared Caddy). This
# script substitutes the placeholder before nginx starts.
#
# VITE_BASE_PATH defaults to '/'. A bare prefix without a trailing slash
# is normalized so React Router and asset URLs both stay consistent.
#
# Lifted from KisaesDevLab/Vibe-Trial-Balance:deploy/web-entrypoint.sh —
# keep the two in sync if either gets a fix.

set -eu

raw="${VITE_BASE_PATH:-/}"

# Reject anything outside [A-Za-z0-9_./-]. The value lands inside `sed
# s|...|...|` at runtime; characters like `&`, `\`, `|`, `$` would break
# the substitution (sed treats `&` in the replacement as the matched
# string, etc.).
case "$raw" in
  *[!A-Za-z0-9_./-]*)
    echo "[web-entrypoint] ERROR: VITE_BASE_PATH='$raw' contains characters outside [A-Za-z0-9_./-]" >&2
    exit 1
    ;;
esac

case "$raw" in
  /) base='/' ;;
  /*/) base="$raw" ;;
  /*) base="${raw}/" ;;
  *) base="/${raw}/" ;;
esac

echo "[web-entrypoint] applying VITE_BASE_PATH=$base"

# Replace the build-time sentinel across SPA assets in place. Idempotent:
# if the container is restarted, the second pass finds no matches.
find /usr/share/nginx/html -type f \
  \( -name '*.html' -o -name '*.js' -o -name '*.css' -o -name '*.json' -o -name '*.map' \) \
  -exec sed -i "s|/__VIBE_BASE_PATH__/|${base}|g" {} +

# Drop a marker so the active value is observable inside the container
# (operators can `docker exec ... cat /usr/share/nginx/html/.base-path`).
echo "$base" > /usr/share/nginx/html/.base-path
