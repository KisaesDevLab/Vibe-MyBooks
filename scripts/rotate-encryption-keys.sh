#!/usr/bin/env bash
# Copyright 2026 Kisaes LLC
# Licensed under the PolyForm Small Business License 1.0.0.
# Free for small businesses; see LICENSE for terms.
#
# Operator runbook, scripted: rotate the appliance's two at-rest keys.
#
#   PLAID_ENCRYPTION_KEY  wraps every stored credential (Plaid, SMS/2FA,
#                         AI/Stripe keys, storage + backup creds, 1099 TINs,
#                         check-signature images). Rotated by re-encrypting
#                         every ciphertext (packages/api/src/scripts/
#                         rotate-encryption-keys.ts) — DB + files.
#   ENCRYPTION_KEY        wraps the installation sentinel (/data/.sentinel)
#                         and peppers screen-share join codes. Holds no DB
#                         data: rotated by swapping the value and letting
#                         preflight regenerate the sentinel on next boot.
#
# Usage, from the deployment directory that holds .env and the compose files:
#
#   scripts/rotate-encryption-keys.sh --dry-run          # report only, api stays up
#   scripts/rotate-encryption-keys.sh --apply            # ~1-2 min api outage
#   scripts/rotate-encryption-keys.sh --apply --keep-installation-key
#                                                        # rotate PLAID key only
#
# What --apply does, in order:
#   1. backs up .env and takes a pg_dump into ~/keyrotate-<ts>/ (0700)
#   2. stops api + worker (web keeps serving; users see "reconnecting")
#   3. runs the re-encryption script in a one-off api container as uid 1001,
#      NEW key via env, OLD key from .env — single DB transaction
#   4. writes the new key(s) into .env; moves /data/.sentinel aside so the
#      api regenerates it under the new ENCRYPTION_KEY
#   5. starts api + worker, restarts web (stale nginx DNS), checks /health
#   6. prints the follow-ups: Admin → Security → "Generate new recovery key",
#      then shred the backup dir once verified.
# On any failure before step 4 nothing has changed and api/worker are
# restarted on the OLD keys. Re-running is safe (idempotent).

set -euo pipefail

MODE=""
KEEP_INSTALL_KEY=0
for a in "$@"; do
  case "$a" in
    --dry-run) MODE=dry ;;
    --apply) MODE=apply ;;
    --keep-installation-key) KEEP_INSTALL_KEY=1 ;;
    -h|--help) sed -n '5,40p' "$0"; exit 0 ;;
    *) echo "unknown arg: $a" >&2; exit 2 ;;
  esac
done
[ -n "$MODE" ] || { echo "usage: $0 --dry-run | --apply [--keep-installation-key]" >&2; exit 2; }

DEPLOY_DIR="$(pwd)"
[ -f "$DEPLOY_DIR/.env" ] || { echo "run from the deployment directory (no .env here: $DEPLOY_DIR)" >&2; exit 2; }
SCRIPT_TS="$DEPLOY_DIR/packages/api/src/scripts/rotate-encryption-keys.ts"
[ -f "$SCRIPT_TS" ] || { echo "missing $SCRIPT_TS — pull the repo first" >&2; exit 2; }
command -v docker >/dev/null || { echo "docker not found" >&2; exit 2; }

envget() { grep -E "^$1=" "$DEPLOY_DIR/.env" | head -1 | cut -d= -f2- | tr -d '\r\n'; }
OLD_PLAID="$(envget PLAID_ENCRYPTION_KEY)"
OLD_ENC="$(envget ENCRYPTION_KEY)"
[ -n "$OLD_PLAID" ] || { echo "PLAID_ENCRYPTION_KEY not set in .env" >&2; exit 2; }
[ -n "$OLD_ENC" ] || { echo "ENCRYPTION_KEY not set in .env" >&2; exit 2; }

NEW_PLAID="$(openssl rand -hex 32)"
NEW_ENC="$(openssl rand -hex 32)"
TS="$(date -u +%Y%m%dT%H%M%SZ)"

# Where the api's /data lives on the host (sentinel path). Parse compose;
# fall back to the appliance default.
DATA_HOST_DIR="$(docker compose config 2>/dev/null | awk '
  $1=="source:" {src=$2}
  $1=="target:" && $2=="/data" {print src; exit}')"
DATA_HOST_DIR="${DATA_HOST_DIR:-/var/lib/vibe/mybooks/data}"

run_rotate() { # $1 = extra args ("" or "--apply")
  # --user 1001: the entrypoint (which normally drops to uid 1001) is
  # bypassed, and signature files rewritten as root would become
  # unreadable to the app. -e overrides the env_file value for the NEW key.
  docker compose run --rm --no-deps --user 1001 --entrypoint '' \
    -v "$SCRIPT_TS:/app/packages/api/src/scripts/rotate-encryption-keys.ts:ro" \
    -e OLD_PLAID_ENCRYPTION_KEY="$OLD_PLAID" \
    -e PLAID_ENCRYPTION_KEY="$NEW_PLAID" \
    api npx tsx packages/api/src/scripts/rotate-encryption-keys.ts $1
}

if [ "$MODE" = dry ]; then
  echo "== DRY RUN (nothing is written; api keeps running) =="
  run_rotate ""
  echo
  echo "If the report looks right (rotate>0, unreadable=0 or only known-dead rows), run: $0 --apply"
  exit 0
fi

# ── APPLY ────────────────────────────────────────────────────────────────
BK="$HOME/keyrotate-$TS"
mkdir -p "$BK" && chmod 700 "$BK"
cp "$DEPLOY_DIR/.env" "$BK/env.before" && chmod 600 "$BK/env.before"
echo "[1/6] backup: .env → $BK/env.before ; pg_dump → $BK/db.before.sql.gz"
docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' | gzip > "$BK/db.before.sql.gz"
chmod 600 "$BK/db.before.sql.gz"
[ -s "$BK/db.before.sql.gz" ] || { echo "pg_dump produced no output — aborting before any change" >&2; exit 1; }

echo "[2/6] stopping api + worker (web stays up)"
docker compose stop api worker >/dev/null

restart_on_old() {
  echo "!! restoring service on the OLD keys (nothing was applied)" >&2
  docker compose up -d api worker >/dev/null || true
  docker compose restart web >/dev/null || true
}

echo "[3/6] re-encrypting every stored credential (single DB transaction)…"
if ! run_rotate "--apply"; then
  restart_on_old
  echo "Rotation FAILED — .env unchanged, api/worker restarted on old keys. Backups in $BK. Fix the reported problem and re-run." >&2
  exit 1
fi

echo "[4/6] writing new key(s) to .env"
python3 - "$DEPLOY_DIR/.env" "$NEW_PLAID" "$NEW_ENC" "$KEEP_INSTALL_KEY" <<'PY'
import re, sys
p, new_plaid, new_enc, keep = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4] == '1'
s = open(p).read()
s, n1 = re.subn(r'^PLAID_ENCRYPTION_KEY=.*$', 'PLAID_ENCRYPTION_KEY=' + new_plaid, s, flags=re.M)
assert n1 == 1, 'PLAID_ENCRYPTION_KEY line not found exactly once'
if not keep:
    s, n2 = re.subn(r'^ENCRYPTION_KEY=.*$', 'ENCRYPTION_KEY=' + new_enc, s, flags=re.M)
    assert n2 == 1, 'ENCRYPTION_KEY line not found exactly once'
open(p, 'w').write(s)
PY
chmod 600 "$DEPLOY_DIR/.env"

if [ "$KEEP_INSTALL_KEY" = 0 ]; then
  SENT="$DATA_HOST_DIR/.sentinel"
  if sudo -n test -f "$SENT"; then
    sudo -n mv "$SENT" "$SENT.pre-rotation-$TS"
    echo "      moved $SENT aside → preflight will regenerate it under the new ENCRYPTION_KEY"
  else
    echo "      (no sentinel at $SENT — nothing to move)"
  fi
fi

echo "[5/6] starting api + worker; restarting web"
docker compose up -d api worker >/dev/null
for i in $(seq 1 30); do
  st="$(docker inspect --format '{{.State.Health.Status}}' "$(docker compose ps -q api)" 2>/dev/null || echo starting)"
  [ "$st" = healthy ] && break
  sleep 3
done
docker compose restart web >/dev/null
sleep 3
VP="$(envget VITE_PORT)"; VP="${VP:-5173}"; case "$VP" in *:*) HP="$VP" ;; *) HP="127.0.0.1:$VP" ;; esac
HEALTH="$(curl -s -m 15 "http://$HP/api/v1/health" 2>/dev/null || true)"
case "$HEALTH" in *'"status":"ok"'*) echo "      health: ok" ;; *) echo "      health check did not return ok — inspect: docker compose logs api --tail 50" ; echo "      $HEALTH" ;; esac

echo "[6/6] DONE. Follow-ups:"
echo "  • Sign in as super-admin → Admin → Security → 'Generate new recovery key' (writes /data/.env.recovery"
echo "    with the NEW keys; the old recovery file/key are now stale). Store the new key offline."
echo "  • Confirm one credential-backed feature works (e.g. Admin → SMS/2FA 'test', a Plaid sync, or Admin → Remote"
echo "    Backup 'Test Connection'), then shred the backup dir (it holds the OLD keys + a DB dump):"
echo "      shred -u $BK/* && rmdir $BK      # or keep it offline until you're satisfied"
echo "  • The previous sentinel is at $DATA_HOST_DIR/.sentinel.pre-rotation-$TS (delete once the api has booted clean)."
