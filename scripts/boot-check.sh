#!/usr/bin/env bash
# Copyright 2026 Kisaes LLC
# Licensed under the PolyForm Small Business License 1.0.0.
# Free for small businesses; see LICENSE for terms.
# =============================================================================
# boot-check.sh <api-image>
#
# Starts an API image against a scratch Postgres and Redis and waits for
# /health to report the database as reachable. Exits non-zero, with the
# container's log, when the image exits or never answers.
#
# Why: 0.9.242 was built, signed and tagged with a module missing from the
# lockfile and exited at boot ("Cannot find module 'uuid'"). The build and
# the test jobs both passed; only starting the image shows it. The publish
# workflow runs this on every API image before its digest is tagged.
#
# Everything it creates is named bootcheck-$$ and removed on exit.
# =============================================================================
set -euo pipefail

image="${1:?usage: boot-check.sh <api-image>}"
id="bootcheck-$$"
port="${BOOT_CHECK_PORT:-3901}"

cleanup() {
  docker rm -f "$id-api" "$id-db" "$id-redis" >/dev/null 2>&1 || true
  docker network rm "$id" >/dev/null 2>&1 || true
}
trap cleanup EXIT

docker network create "$id" >/dev/null
docker run -d --name "$id-db" --network "$id" \
  -e POSTGRES_USER=kisbooks -e POSTGRES_PASSWORD=bootcheck -e POSTGRES_DB=kisbooks \
  postgres:16-alpine >/dev/null
docker run -d --name "$id-redis" --network "$id" redis:7-alpine >/dev/null

for _ in $(seq 1 30); do
  docker exec "$id-db" pg_isready -U kisbooks >/dev/null 2>&1 && break
  sleep 2
done

# Throwaway values, valid only for this run.
key="$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')"
docker run -d --name "$id-api" --network "$id" -p "127.0.0.1:$port:3001" \
  -e DATABASE_URL="postgresql://kisbooks:bootcheck@$id-db:5432/kisbooks" \
  -e REDIS_URL="redis://$id-redis:6379" \
  -e JWT_SECRET="$key" -e ENCRYPTION_KEY="$key" -e PLAID_ENCRYPTION_KEY="$key" \
  -e NODE_ENV=production "$image" >/dev/null

# First boot runs every migration; allow it three minutes.
for _ in $(seq 1 60); do
  if curl -sS -m 3 "http://127.0.0.1:$port/health" 2>/dev/null | grep -q '"db":"ok"'; then
    echo "boot check: $image started and answers /health"
    exit 0
  fi
  if [ "$(docker inspect -f '{{.State.Running}}' "$id-api" 2>/dev/null)" != "true" ]; then
    break
  fi
  sleep 3
done

echo "boot check: $image did not start" >&2
docker logs --tail 80 "$id-api" >&2 || true
exit 1
