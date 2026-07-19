#!/usr/bin/env bash
# Copyright 2026 Kisaes LLC
# Licensed under the PolyForm Small Business License 1.0.0.
# Free for small businesses; see LICENSE for terms.
#
# Vibe MyBooks — One-Line Install & Update Script (Production)
# Usage:
#   Install:  curl -fsSL https://raw.githubusercontent.com/KisaesDevLab/Vibe-MyBooks/main/scripts/install.sh | bash
#   Update:   curl -fsSL https://raw.githubusercontent.com/KisaesDevLab/Vibe-MyBooks/main/scripts/install.sh | bash -s -- --update
#
# This script uses the production compose file (docker-compose.prod.yml) and
# pulls a pre-built image from ghcr.io/kisaesdevlab/vibe-mybooks rather than
# compiling TypeScript locally. Pin a version by setting VIBE_MYBOOKS_TAG in
# the generated .env (defaults to `latest`). For a dev setup with hot reload,
# clone the repo and run
#   docker compose -f docker-compose.yml -f docker-compose.dev.yml up

set -euo pipefail

REPO="https://github.com/KisaesDevLab/Vibe-MyBooks.git"
INSTALL_DIR="${VIBE_MYBOOKS_DIR:-$HOME/vibe-mybooks}"
COMPOSE_FILE="docker-compose.prod.yml"
# APP_PORT   → the API (health + /api). VITE_PORT / WEB_PORT → the web UI and
# the first-run setup wizard, which is what a human opens in a browser.
APP_PORT="${APP_PORT:-3001}"
WEB_PORT="${WEB_PORT:-5173}"
# Host directory tree the production compose binds into the containers. Created
# and owned below so a fresh box doesn't fail with an opaque permission error.
DATA_ROOT="${VIBE_MYBOOKS_DATA_ROOT:-/var/lib/vibe/mybooks}"
APP_UID=1001  # the in-container `app` user the api/worker drop to (see Dockerfile)
UPDATE_MODE=false

for arg in "$@"; do
  case $arg in
    --update) UPDATE_MODE=true ;;
  esac
done

info()    { echo -e "\033[0;36m[Vibe MyBooks]\033[0m $1"; }
success() { echo -e "\033[0;32m[Vibe MyBooks]\033[0m $1"; }
error()   { echo -e "\033[0;31m[Vibe MyBooks ERROR]\033[0m $1"; }

# Root escalation for writing under $DATA_ROOT (usually /var/lib). Empty when we
# already run as root or sudo isn't available (best-effort; failures are warned).
SUDO=""
if [ "$(id -u)" -ne 0 ] && command -v sudo &>/dev/null; then SUDO="sudo"; fi

# Preserve the installation-identity files across the ephemeral→bind /data change.
#
# Releases up to v0.9.118 bind-mounted only /data/uploads and /data/backups, so
# /data/.env.recovery, /data/.sentinel, /data/.host-id, /data/.db-fingerprint and
# /data/config/.initialized lived on the container's THROWAWAY layer. v0.9.119+
# bind-mounts all of /data — the correct fix — but the first recreate under the
# new mount shadows the ephemeral /data with an empty host dir, DISCARDING those
# files. Losing .env.recovery invalidates the operator's recovery key; losing the
# sentinel/host-id trips the reset-detection guard. So, if the currently running
# api container is still on the old ephemeral layout, copy those files onto the
# host bind BEFORE recreating. (The api entrypoint chowns /data to the app user
# on boot, so copied root-owned files are normalized automatically.)
preserve_identity_files() {
  local cid
  cid=$(docker compose -f "$COMPOSE_FILE" ps -q api 2>/dev/null | head -1)
  [ -z "$cid" ] && return 0   # nothing running → fresh install, nothing to save
  # If the running container already bind-mounts /data, it's already migrated.
  local has_bind
  has_bind=$(docker inspect "$cid" \
    --format '{{range .Mounts}}{{if eq .Destination "/data"}}yes{{end}}{{end}}' 2>/dev/null)
  [ "$has_bind" = "yes" ] && return 0

  info "Preserving installation identity (recovery key, sentinel) across the storage change..."
  # Guarded: this function is best-effort by contract, but an unguarded
  # mkdir under set -e aborts the whole update on a non-root host
  # without sudo before the pull even starts.
  if ! $SUDO mkdir -p "$DATA_ROOT/data/config"; then
    info "Could not create $DATA_ROOT/data/config — skipping identity preservation."
    return 0
  fi
  local f saved=0
  for f in .env.recovery .sentinel .host-id .db-fingerprint config/.initialized; do
    # docker cp runs via the daemon (root), so it can write under $DATA_ROOT.
    if docker cp "$cid:/data/$f" "$DATA_ROOT/data/$f" 2>/dev/null; then
      info "  preserved /data/$f"; saved=$((saved + 1))
    fi
  done
  if [ "$saved" -gt 0 ]; then
    success "Preserved $saved identity file(s) — your recovery key survives this update."
  else
    info "No legacy identity files found to preserve (already migrated, or never set up)."
  fi
}

# ─── Check prerequisites ──────────────────────────────────────
info "Checking prerequisites..."

if ! command -v docker &>/dev/null; then
  error "Docker is not installed."
  echo ""
  echo "  Install Docker:"
  echo "    Linux:   curl -fsSL https://get.docker.com | sh"
  echo "    macOS:   Install Docker Desktop from https://docker.com/products/docker-desktop"
  echo "    Windows: Install Docker Desktop from https://docker.com/products/docker-desktop"
  echo ""
  echo "  On Linux, after installing you may also need to run:"
  echo "    sudo usermod -aG docker \$USER && newgrp docker"
  echo ""
  echo "  Then re-run this script."
  exit 1
fi

if ! docker info &>/dev/null; then
  error "Docker is installed but the daemon isn't reachable."
  echo ""
  echo "  - On macOS / Windows: open Docker Desktop and wait for it to finish starting."
  echo "  - On Linux:           sudo systemctl start docker"
  echo "  - Permission denied?  sudo usermod -aG docker \$USER && newgrp docker"
  exit 1
fi

# Docker Compose v2 ('docker compose' subcommand, not the old 'docker-compose' binary)
if ! docker compose version &>/dev/null 2>&1; then
  error "Docker Compose v2 is required. Please update Docker to a recent version."
  exit 1
fi

if ! command -v git &>/dev/null; then
  error "git is not installed."
  echo "  Install git:  Debian/Ubuntu: sudo apt-get install -y git   |   Fedora: sudo dnf install -y git   |   macOS: xcode-select --install"
  exit 1
fi

# openssl mints the secrets below; curl runs the readiness probe. Both ship on
# most systems, but check up front so we fail with a fix instead of mid-run.
for tool in openssl curl; do
  if ! command -v "$tool" &>/dev/null; then
    error "$tool is not installed (needed to $([ "$tool" = openssl ] && echo 'generate secrets' || echo 'check readiness'))."
    echo "  Install:  Debian/Ubuntu: sudo apt-get install -y $tool   |   Fedora: sudo dnf install -y $tool   |   macOS: preinstalled"
    exit 1
  fi
done

info "Docker, git, openssl and curl are ready."

# ─── Port availability check ──────────────────────────────────
# Catch the common "something's already on 3001" case before we clone,
# pull, and `up -d` — otherwise compose fails with a bare "port is
# already allocated" that doesn't tell the user how to recover. We
# probe via bash's built-in /dev/tcp (works on every bash ≥ 2.04,
# no extra tools required). If the port is taken and stdin is a real
# terminal, offer to pick a free alternative and re-export $APP_PORT
# so the .env generation below writes the new value.
port_in_use() {
  local p=$1
  # A successful connect means something is listening there.
  (exec 3<>/dev/tcp/127.0.0.1/"$p") 2>/dev/null && { exec 3>&-; return 0; } || return 1
}

pick_free_port() {
  local candidate
  for candidate in 3011 3021 3031 3111 3211 3311 8001 8081 8181; do
    if ! port_in_use "$candidate"; then
      echo "$candidate"
      return 0
    fi
  done
  echo "" # nothing free in our shortlist — caller handles the empty case
}

if port_in_use "$APP_PORT"; then
  error "Port $APP_PORT is already in use on this host."
  if [ -t 0 ] && [ -t 1 ]; then
    alt=$(pick_free_port)
    if [ -n "$alt" ]; then
      read -rp "Use port $alt instead? [Y/n] " confirm
      if [[ -z "$confirm" || "$confirm" =~ ^[Yy]$ ]]; then
        APP_PORT=$alt
        info "Using port $APP_PORT."
      else
        echo ""
        echo "  Re-run with APP_PORT=<free-port> set, or free up port 3001 first:"
        echo "    APP_PORT=$alt bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/KisaesDevLab/Vibe-MyBooks/main/scripts/install.sh)\""
        exit 1
      fi
    else
      error "Could not find a free port in the default shortlist."
      error "Re-run with APP_PORT=<free-port> set."
      exit 1
    fi
  else
    error "Non-interactive shell — re-run with APP_PORT=<free-port> set."
    exit 1
  fi
fi

# Same pre-flight for the web UI port — compose's bare "port is already
# allocated" error is exactly what this section exists to pre-empt.
if port_in_use "$WEB_PORT"; then
  error "Port $WEB_PORT (web UI) is already in use on this host."
  error "Re-run with WEB_PORT=<free-port> set, or free up port $WEB_PORT first."
  exit 1
fi

# ─── Update mode ──────────────────────────────────────────────
if [ "$UPDATE_MODE" = true ]; then
  if [ ! -d "$INSTALL_DIR" ]; then
    error "Vibe MyBooks is not installed at $INSTALL_DIR"
    error "Run without --update to install."
    exit 1
  fi

  info "Updating Vibe MyBooks..."
  cd "$INSTALL_DIR"

  git stash --quiet 2>/dev/null || true
  git pull origin main --ff-only || {
    error "Failed to pull updates. You may have local modifications."
    error "Run: cd $INSTALL_DIR && git pull"
    exit 1
  }

  # Save the recovery key / sentinel BEFORE recreating, in case this update is
  # the one that moves /data from the container layer onto a host bind mount.
  preserve_identity_files

  info "Pulling latest image..."
  docker compose -f "$COMPOSE_FILE" pull
  docker compose -f "$COMPOSE_FILE" up -d

  success "Update complete!"
  success "Vibe MyBooks is running at http://localhost:$WEB_PORT"
  exit 0
fi

# ─── Fresh install ────────────────────────────────────────────
if [ -d "$INSTALL_DIR" ]; then
  info "Directory $INSTALL_DIR already exists."
  read -rp "Reinstall? Containers will be recreated, data is preserved. [y/N] " confirm
  if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 0
  fi
else
  info "Cloning Vibe MyBooks to $INSTALL_DIR..."
  git clone "$REPO" "$INSTALL_DIR"
fi

cd "$INSTALL_DIR"

# ─── Generate .env with secure secrets ────────────────────────
# The production compose file requires POSTGRES_PASSWORD, ENCRYPTION_KEY,
# PLAID_ENCRYPTION_KEY, and JWT_SECRET. Missing/weak values will either
# fail the startup validator or run with a known default, so we mint
# fresh random values on a fresh install.
if [ ! -f ".env" ]; then
  info "Generating configuration with secure secrets..."

  JWT_SECRET=$(openssl rand -base64 48 | tr -d '/+=\n' | head -c 48)
  ENCRYPTION_KEY=$(openssl rand -hex 32)
  PLAID_ENCRYPTION_KEY=$(openssl rand -hex 32)
  POSTGRES_PASSWORD=$(openssl rand -base64 32 | tr -d '/+=\n' | head -c 32)

  cat > .env <<ENVEOF
# Vibe MyBooks — auto-generated on $(date -u '+%Y-%m-%d %H:%M:%S UTC')
# Values here are secrets; DO NOT commit this file.

# Database
POSTGRES_USER=kisbooks
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
POSTGRES_DB=kisbooks

# Auth / crypto
JWT_SECRET=$JWT_SECRET
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d
ENCRYPTION_KEY=$ENCRYPTION_KEY
PLAID_ENCRYPTION_KEY=$PLAID_ENCRYPTION_KEY

# Runtime
NODE_ENV=production
PORT=$APP_PORT
VITE_PORT=$WEB_PORT
# The browser talks to the web UI on WEB_PORT, so that is the CORS origin the
# API must allow — NOT the API's own port.
CORS_ORIGIN=http://localhost:$WEB_PORT

# Email (SMTP) — fill in to enable outbound mail
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=noreply@example.com

# File storage
UPLOAD_DIR=/data/uploads
MAX_FILE_SIZE_MB=10

# Plaid (optional — leave blank to disable bank connections)
PLAID_CLIENT_ID=
PLAID_SECRET=
PLAID_ENV=sandbox

# LLM (optional)
ANTHROPIC_API_KEY=
LLM_MODEL=claude-sonnet-4-20250514

# Backup
BACKUP_DIR=/data/backups
BACKUP_ENCRYPTION_KEY=
ENVEOF
  chmod 600 .env
  success "Configuration generated with secure secrets at $INSTALL_DIR/.env"
else
  info "Existing .env found — keeping it."
fi

# ─── Create the host data directories ─────────────────────────
# The production compose binds these absolute paths into the containers. If
# they don't exist Docker creates them as root:root, which the api entrypoint
# then chowns for /data — but pre-creating with the right owner avoids a
# first-boot permission error on hosts with restrictive /var/lib perms or
# SELinux/AppArmor. Best-effort: a failure here is not fatal (the entrypoint
# self-heals /data on most hosts), so we warn and continue.
info "Preparing data directories under $DATA_ROOT..."
if $SUDO mkdir -p \
     "$DATA_ROOT/postgres-data" "$DATA_ROOT/redis-data" \
     "$DATA_ROOT/uploads" "$DATA_ROOT/backups" "$DATA_ROOT/data" 2>/dev/null; then
  # Postgres/Redis images self-chown their own dirs; the app dirs must be owned
  # by the in-container app user (UID $APP_UID) so uploads/backups/recovery write.
  $SUDO chown -R "$APP_UID:$APP_UID" \
     "$DATA_ROOT/uploads" "$DATA_ROOT/backups" "$DATA_ROOT/data" 2>/dev/null || true
  success "Data directories ready at $DATA_ROOT"
else
  info "Could not pre-create $DATA_ROOT (need root/sudo). Continuing — the"
  info "container will create and chown /data itself on first boot."
fi

# Reinstalling over an existing (possibly legacy-layout) stack recreates the
# containers too, so preserve the recovery key / sentinel first here as well.
preserve_identity_files

# ─── Pull image and start ─────────────────────────────────────
info "Pulling Vibe MyBooks image (first run downloads ~300 MB)..."
docker compose -f "$COMPOSE_FILE" pull
info "Starting Vibe MyBooks..."
docker compose -f "$COMPOSE_FILE" up -d

# ─── Wait for ready ──────────────────────────────────────────
info "Waiting for services to start..."
MAX_WAIT=180
WAITED=0
READY=false

while [ $WAITED -lt $MAX_WAIT ]; do
  sleep 3
  WAITED=$((WAITED + 3))
  if curl -s -o /dev/null -w "%{http_code}" "http://localhost:$APP_PORT/health" 2>/dev/null | grep -q "200"; then
    READY=true
    break
  fi
  echo "  Starting... (${WAITED}s)"
done

echo ""
if [ "$READY" = true ]; then
  success "Vibe MyBooks is ready!"
  echo ""
  echo "  Open the app:   http://localhost:$WEB_PORT"
  echo "  First-run setup: http://localhost:$WEB_PORT/setup"
  echo "  Install dir:    $INSTALL_DIR"
  echo ""
  echo "  IMPORTANT: the setup wizard shows a one-time RECOVERY KEY (RKVMB-…)."
  echo "  Write it down and store it off this machine — it is the only way to"
  echo "  recover your encryption keys after a disaster. It is not shown again."
  echo ""
  echo "  To stop:    cd $INSTALL_DIR && docker compose -f $COMPOSE_FILE down"
  echo "  To update:  curl -fsSL https://raw.githubusercontent.com/KisaesDevLab/Vibe-MyBooks/main/scripts/install.sh | bash -s -- --update"
  echo ""
else
  error "Services did not become ready within 3 minutes."
  error "Check logs: cd $INSTALL_DIR && docker compose -f $COMPOSE_FILE logs"
  error "Once healthy, open the app at http://localhost:$WEB_PORT (setup: /setup)."
fi
