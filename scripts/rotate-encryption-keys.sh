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
#   scripts/rotate-encryption-keys.sh --apply --resume-from ~/keyrotate-<ts>
#                                                        # finish an interrupted --apply
#                                                        # with the SAME new keys
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
# On any failure before step 4 nothing has changed in the DB / .env and
# api/worker are restarted on the OLD keys. The NEW keys are written to
# <backup dir>/keys.new BEFORE anything is rewritten, and every signature
# file gets a .pre-rotation copy, so an interrupted run is finished with
# `--apply --resume-from <backup dir>` (same keys → idempotent). Never
# re-run a plain --apply after a partial failure: it would mint different
# keys and strand any file already rewritten under the first pair.

set -euo pipefail

MODE=""
KEEP_INSTALL_KEY=0
RESUME_FROM=""
while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run) MODE=dry ;;
    --apply) MODE=apply ;;
    --keep-installation-key) KEEP_INSTALL_KEY=1 ;;
    --resume-from) shift; RESUME_FROM="${1:-}"; [ -n "$RESUME_FROM" ] || { echo "--resume-from needs a directory" >&2; exit 2; } ;;
    -h|--help) sed -n '5,46p' "$0"; exit 0 ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac
  shift
done
[ -n "$MODE" ] || { echo "usage: $0 --dry-run | --apply [--keep-installation-key] [--resume-from DIR]" >&2; exit 2; }

DEPLOY_DIR="$(pwd)"
[ -f "$DEPLOY_DIR/.env" ] || { echo "run from the deployment directory (no .env here: $DEPLOY_DIR)" >&2; exit 2; }
SCRIPT_TS="$DEPLOY_DIR/packages/api/src/scripts/rotate-encryption-keys.ts"
[ -f "$SCRIPT_TS" ] || { echo "missing $SCRIPT_TS — pull the repo first" >&2; exit 2; }
command -v docker >/dev/null || { echo "docker not found" >&2; exit 2; }

# `|| true`: with pipefail a missing key would otherwise abort the script
# (VITE_PORT is routinely absent from .env).
envget() { { grep -E "^$1=" "$DEPLOY_DIR/.env" || true; } | head -1 | cut -d= -f2- | tr -d '\r\n'; }
OLD_PLAID="$(envget PLAID_ENCRYPTION_KEY)"
OLD_ENC="$(envget ENCRYPTION_KEY)"
[ -n "$OLD_PLAID" ] || { echo "PLAID_ENCRYPTION_KEY not set in .env" >&2; exit 2; }
[ -n "$OLD_ENC" ] || { echo "ENCRYPTION_KEY not set in .env" >&2; exit 2; }

TS="$(date -u +%Y%m%dT%H%M%SZ)"
if [ -n "$RESUME_FROM" ]; then
  # Reuse the keys minted by the interrupted run so already-rewritten
  # ciphertexts/files are recognised as "current" and the rest are rotated.
  [ -f "$RESUME_FROM/keys.new" ] || { echo "no keys.new in $RESUME_FROM — cannot resume" >&2; exit 2; }
  # shellcheck disable=SC1091
  . "$RESUME_FROM/keys.new"
  [ -n "${NEW_PLAID:-}" ] && [ -n "${NEW_ENC:-}" ] || { echo "keys.new is incomplete" >&2; exit 2; }
  echo "resuming with the keys from $RESUME_FROM/keys.new"
else
  NEW_PLAID="$(openssl rand -hex 32)"
  NEW_ENC="$(openssl rand -hex 32)"
fi

run_rotate() { # $1 = extra args ("" or "--apply")
  # --user 1001: the entrypoint (which normally drops to uid 1001) is
  # bypassed, and signature files rewritten as root would become
  # unreadable to the app. The keys are passed by NAME (-e VAR, value taken
  # from this process's environment) so they never appear on the docker
  # argv / in `ps`.
  OLD_PLAID_ENCRYPTION_KEY="$OLD_PLAID" PLAID_ENCRYPTION_KEY="$NEW_PLAID" \
  docker compose run --rm --no-deps --user 1001 --entrypoint '' \
    -v "$SCRIPT_TS:/app/packages/api/src/scripts/rotate-encryption-keys.ts:ro" \
    -e OLD_PLAID_ENCRYPTION_KEY \
    -e PLAID_ENCRYPTION_KEY \
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
if [ -n "$RESUME_FROM" ]; then
  BK="$RESUME_FROM"
else
  BK="$HOME/keyrotate-$TS"
  mkdir -p "$BK" && chmod 700 "$BK"
fi
cp "$DEPLOY_DIR/.env" "$BK/env.before-$TS" && chmod 600 "$BK/env.before-$TS"
# Persist the NEW keys before anything is rewritten: this is what makes an
# interrupted run resumable (see --resume-from) instead of data-losing.
umask 077
printf 'NEW_PLAID=%s\nNEW_ENC=%s\n' "$NEW_PLAID" "$NEW_ENC" > "$BK/keys.new"
chmod 600 "$BK/keys.new"
echo "[1/6] backup: .env → $BK/env.before-$TS ; new keys → $BK/keys.new ; pg_dump → $BK/db.before-$TS.sql.gz"
docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' | gzip > "$BK/db.before-$TS.sql.gz"
chmod 600 "$BK/db.before-$TS.sql.gz"
[ -s "$BK/db.before-$TS.sql.gz" ] || { echo "pg_dump produced no output — aborting before any change" >&2; exit 1; }

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
  echo "Rotation FAILED — .env unchanged, api/worker restarted on old keys. Backups in $BK." >&2
  echo "Fix the reported problem, then finish with the SAME keys:  $0 --apply --resume-from $BK" >&2
  echo "(do NOT run a plain --apply again — signature files already rewritten would be stranded under the first key pair)" >&2
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
  # Move the sentinel from INSIDE a one-off api container (same /data
  # mount, uid 1001): no sudo, no host-path guessing (named volume vs bind
  # mount). Distinguish "moved" / "none" from a failed command — a silent
  # miss here would leave the api booting BLOCKED (sentinel decrypt-failed
  # under the new key) with no hint why.
  SENT_OUT="$(docker compose run --rm --no-deps --user 1001 --entrypoint '' api sh -c \
    "if [ -f /data/.sentinel ]; then mv /data/.sentinel /data/.sentinel.pre-rotation-$TS && echo moved; else echo none; fi" 2>&1 | tail -1 || true)"
  case "$SENT_OUT" in
    moved) echo "      moved /data/.sentinel aside → preflight will regenerate it under the new ENCRYPTION_KEY" ;;
    none)  echo "      (no /data/.sentinel — nothing to move)" ;;
    *)     echo "!! could not move /data/.sentinel ($SENT_OUT)." >&2
           echo "!! The api will boot BLOCKED (sentinel decrypt failed). Either move it by hand:" >&2
           echo "!!   docker compose run --rm --no-deps --user 1001 --entrypoint '' api mv /data/.sentinel /data/.sentinel.pre-rotation-$TS" >&2
           echo "!! or use the diagnostic 'regenerate sentinel' flow after boot." >&2 ;;
  esac
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
echo "  • The previous sentinel is at /data/.sentinel.pre-rotation-$TS inside the api's data volume, and each rewritten"
echo "    signature file left a .pre-rotation-<ts> copy next to it (old-key ciphertext) — delete both once the api has"
echo "    booted clean and signatures print."
