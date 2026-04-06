#!/usr/bin/env bash
# Vibe MyBooks — One-Line Install & Update Script
# Usage:
#   Install:  curl -fsSL https://raw.githubusercontent.com/KisaesDevLab/Vibe-MyBooks/main/scripts/install.sh | bash
#   Update:   curl -fsSL https://raw.githubusercontent.com/KisaesDevLab/Vibe-MyBooks/main/scripts/install.sh | bash -s -- --update

set -euo pipefail

REPO="https://github.com/KisaesDevLab/Vibe-MyBooks.git"
INSTALL_DIR="${VIBE_MYBOOKS_DIR:-$HOME/vibe-mybooks}"
COMPOSE_FILE="docker-compose.yml"
COMPOSE_DEV_FILE="docker-compose.dev.yml"
UPDATE_MODE=false

# Parse args
for arg in "$@"; do
  case $arg in
    --update) UPDATE_MODE=true ;;
  esac
done

info()  { echo -e "\033[0;36m[Vibe MyBooks]\033[0m $1"; }
success() { echo -e "\033[0;32m[Vibe MyBooks]\033[0m $1"; }
error() { echo -e "\033[0;31m[Vibe MyBooks ERROR]\033[0m $1"; }

# ─── Check prerequisites ──────────────────────────────────────
info "Checking prerequisites..."

if ! command -v docker &>/dev/null; then
  error "Docker is not installed."
  echo ""
  echo "  Install Docker:"
  echo "    Linux:  curl -fsSL https://get.docker.com | sh"
  echo "    macOS:  brew install --cask docker"
  echo ""
  echo "  Then re-run this script."
  exit 1
fi

if ! docker info &>/dev/null; then
  error "Docker is not running. Please start Docker and try again."
  exit 1
fi

if ! docker compose version &>/dev/null 2>&1; then
  error "Docker Compose v2 is required. Please update Docker."
  exit 1
fi

info "Docker is ready."

# ─── Update mode ──────────────────────────────────────────────
if [ "$UPDATE_MODE" = true ]; then
  if [ ! -d "$INSTALL_DIR" ]; then
    error "Vibe MyBooks is not installed at $INSTALL_DIR"
    error "Run without --update to install."
    exit 1
  fi

  info "Updating Vibe MyBooks..."
  cd "$INSTALL_DIR"

  # Stash any local changes
  git stash --quiet 2>/dev/null || true

  # Pull latest
  git pull origin main --ff-only || {
    error "Failed to pull updates. You may have local modifications."
    error "Run: cd $INSTALL_DIR && git pull"
    exit 1
  }

  # Rebuild and restart
  info "Rebuilding containers..."
  docker compose -f "$COMPOSE_FILE" -f "$COMPOSE_DEV_FILE" up --build -d

  success "Update complete!"
  success "Vibe MyBooks is running at http://localhost:5173"
  exit 0
fi

# ─── Fresh install ────────────────────────────────────────────
if [ -d "$INSTALL_DIR" ]; then
  info "Directory $INSTALL_DIR already exists."
  read -rp "Reinstall? This will rebuild containers (data is preserved). [y/N] " confirm
  if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 0
  fi
else
  info "Cloning Vibe MyBooks to $INSTALL_DIR..."
  git clone "$REPO" "$INSTALL_DIR"
fi

cd "$INSTALL_DIR"

# ─── Generate .env if needed ──────────────────────────────────
if [ ! -f ".env" ]; then
  info "Generating configuration..."
  cp .env.example .env

  # Generate secure JWT secret
  JWT_SECRET=$(openssl rand -base64 40 | tr -d '/+=' | head -c 48)
  ENCRYPTION_KEY=$(openssl rand -hex 32)

  # Replace defaults with generated secrets
  if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s/change-me-in-production/$JWT_SECRET/" .env
  else
    sed -i "s/change-me-in-production/$JWT_SECRET/" .env
  fi

  success "Configuration generated with secure secrets."
else
  info "Existing .env found — keeping it."
fi

# ─── Build and start ──────────────────────────────────────────
info "Building and starting Vibe MyBooks (first run may take 5-10 minutes)..."
docker compose -f "$COMPOSE_FILE" -f "$COMPOSE_DEV_FILE" up --build -d

# ─── Wait for ready ──────────────────────────────────────────
info "Waiting for services to start..."
MAX_WAIT=120
WAITED=0
READY=false

while [ $WAITED -lt $MAX_WAIT ]; do
  sleep 3
  WAITED=$((WAITED + 3))
  if curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/ 2>/dev/null | grep -q "200"; then
    READY=true
    break
  fi
  echo "  Starting... (${WAITED}s)"
done

echo ""
if [ "$READY" = true ]; then
  success "Vibe MyBooks is ready!"
  echo ""
  echo "  Open: http://localhost:5173"
  echo "  Dir:  $INSTALL_DIR"
  echo ""
  echo "  To stop:   cd $INSTALL_DIR && docker compose down"
  echo "  To update: curl -fsSL https://raw.githubusercontent.com/KisaesDevLab/Vibe-MyBooks/main/scripts/install.sh | bash -s -- --update"
  echo ""
else
  error "Services did not become ready within 2 minutes."
  error "Check logs: cd $INSTALL_DIR && docker compose logs"
  error "Try opening http://localhost:5173 manually."
fi
