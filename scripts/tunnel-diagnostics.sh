#!/usr/bin/env bash
# Copyright 2026 Kisaes LLC
# Licensed under the PolyForm Internal Use License 1.0.0.
# You may not distribute this software. See LICENSE for terms.
#
# CLOUDFLARE_TUNNEL_PLAN Phase 9 — support triage script.
#
# Prints a self-contained report on the Cloudflare Tunnel sidecar's
# state. Safe to share with Kisaes support during a troubleshooting
# session — it contains no secrets (CLOUDFLARE_TUNNEL_TOKEN is never
# read or printed, Turnstile keys are not touched) and runs entirely
# against the local Compose stack.
#
# Usage:
#   bash scripts/tunnel-diagnostics.sh
#
# Run on the host where `docker compose` is installed, from the
# project directory. Exits 0 whether the tunnel is healthy or not —
# this is a report, not a gate.

set -u

cd "$(dirname "$0")/.." || exit 1

hr() { printf -- "--- %s ---\n" "$1"; }

hr "container status"
if ! docker compose ps cloudflared 2>/dev/null | tail -n +2 | grep -q .; then
  echo "cloudflared service is not running."
  echo "Enable it with: docker compose --profile tunnel up -d"
  echo
  echo "If you intentionally run LAN-only without a tunnel, this is expected."
  exit 0
fi
docker compose ps cloudflared

hr "last 50 log lines"
docker compose logs --tail=50 cloudflared 2>/dev/null || true

hr "recent reconnect events (last 200 log lines)"
docker compose logs --tail=200 cloudflared 2>/dev/null \
  | grep -iE "reconnect|registered|disconnect|failed to connect" \
  | tail -20 || echo "(none detected in the recent log window)"

hr "connector metrics snapshot"
# /metrics is exposed on the Compose network at cloudflared:2000, but
# the host can't reach that DNS name directly. Shell out through the
# api container's curl / wget so we hit exactly the same URL the
# in-app admin widget uses.
if docker compose exec -T api sh -c 'command -v wget >/dev/null 2>&1'; then
  docker compose exec -T api wget -q -O - http://cloudflared:2000/metrics 2>/dev/null \
    | grep -E "^cloudflared_tunnel_(ha_connections|total_connections|tunnel_register_failures|connection_errors) " \
    || echo "(metrics endpoint unreachable from api container)"
else
  echo "(wget not available inside api container; skipped)"
fi

hr "configured public hostnames (from CF-side config; requires token)"
# cloudflared keeps the ingress mapping in memory once it's started —
# we can't introspect it without hitting CF's API. Document the
# expected mapping so support can cross-check at a glance.
echo "Configured by the firm's admin in their Cloudflare Zero Trust"
echo "dashboard (Networks → Tunnels → <name> → Public Hostnames)."
echo "Expected targets per docs/firm-cloudflare-setup.md Part D:"
echo "  mybooks.*  → api:3001"
echo "  clients.*  → api:3001"
echo "  admin.*    → api:3001"

hr "hostname DNS resolution (from host, not the container)"
if command -v dig >/dev/null 2>&1; then
  for host in "mybooks" "clients" "admin"; do
    # Best-effort — operator's domain is not known here, so we only
    # probe that the container network can resolve its own service
    # DNS, which is the part we actually control.
    :
  done
  # Resolve the internal service name from inside the api container
  docker compose exec -T api sh -c 'getent hosts cloudflared 2>/dev/null || echo "cloudflared not resolvable from api"' 2>/dev/null || true
else
  echo "(dig not installed on host)"
fi

hr "done"
echo "Report generated $(date -u +'%Y-%m-%dT%H:%M:%SZ')"
