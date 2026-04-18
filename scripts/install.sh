#!/usr/bin/env bash
# Copyright 2026 Kisaes LLC
# Licensed under the PolyForm Internal Use License 1.0.0.
# You may not distribute this software. See LICENSE for terms.
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
APP_PORT="${APP_PORT:-3001}"
UPDATE_MODE=false

for arg in "$@"; do
  case $arg in
    --update) UPDATE_MODE=true ;;
  esac
done

info()    { echo -e "\033[0;36m[Vibe MyBooks]\033[0m $1"; }
success() { echo -e "\033[0;32m[Vibe MyBooks]\033[0m $1"; }
error()   { echo -e "\033[0;31m[Vibe MyBooks ERROR]\033[0m $1"; }

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
  echo "  Install git from: https://git-scm.com/downloads"
  exit 1
fi

info "Docker and git are ready."

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

  info "Pulling latest image..."
  docker compose -f "$COMPOSE_FILE" pull
  docker compose -f "$COMPOSE_FILE" up -d

  success "Update complete!"
  success "Vibe MyBooks is running at http://localhost:$APP_PORT"
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
CORS_ORIGIN=http://localhost:$APP_PORT

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
  echo "  Open:  http://localhost:$APP_PORT"
  echo "  Dir:   $INSTALL_DIR"
  echo ""
  echo "  First run? Visit http://localhost:$APP_PORT/setup to complete the wizard."
  echo ""
  echo "  To stop:    cd $INSTALL_DIR && docker compose -f $COMPOSE_FILE down"
  echo "  To update:  curl -fsSL https://raw.githubusercontent.com/KisaesDevLab/Vibe-MyBooks/main/scripts/install.sh | bash -s -- --update"
  echo ""
else
  error "Services did not become ready within 3 minutes."
  error "Check logs: cd $INSTALL_DIR && docker compose -f $COMPOSE_FILE logs"
  error "Try opening http://localhost:$APP_PORT manually."
fi
