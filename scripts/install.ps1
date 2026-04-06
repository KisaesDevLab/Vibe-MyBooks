# Vibe MyBooks — One-Line Install & Update Script (Windows)
# Usage:
#   Install:  irm https://raw.githubusercontent.com/KisaesDevLab/Vibe-MyBooks/main/scripts/install.ps1 | iex
#   Update:   Set-Variable update $true; irm https://raw.githubusercontent.com/KisaesDevLab/Vibe-MyBooks/main/scripts/install.ps1 | iex

param([switch]$update)

$ErrorActionPreference = "Stop"
$Repo = "https://github.com/KisaesDevLab/Vibe-MyBooks.git"
$InstallDir = if ($env:VIBE_MYBOOKS_DIR) { $env:VIBE_MYBOOKS_DIR } else { "$env:USERPROFILE\vibe-mybooks" }
$ComposeFile = "docker-compose.yml"
$ComposeDevFile = "docker-compose.dev.yml"

function Write-Info($msg) { Write-Host "[Vibe MyBooks] $msg" -ForegroundColor Cyan }
function Write-Ok($msg) { Write-Host "[Vibe MyBooks] $msg" -ForegroundColor Green }
function Write-Err($msg) { Write-Host "[Vibe MyBooks ERROR] $msg" -ForegroundColor Red }

# ─── Check prerequisites ──────────────────────────────────────
Write-Info "Checking prerequisites..."

# Check Docker
$dockerInstalled = $false
try {
    $null = & docker --version 2>$null
    $dockerInstalled = ($LASTEXITCODE -eq 0)
} catch {}

if (-not $dockerInstalled) {
    Write-Err "Docker is not installed."
    Write-Host ""
    Write-Host "  Install Docker Desktop from: https://docker.com/products/docker-desktop"
    Write-Host "  Then re-run this script."
    Write-Host ""
    exit 1
}

# Check Docker is running
$dockerRunning = $false
try {
    $null = & docker info 2>$null
    $dockerRunning = ($LASTEXITCODE -eq 0)
} catch {}

if (-not $dockerRunning) {
    Write-Info "Starting Docker Desktop..."
    $dockerPath = "$env:ProgramFiles\Docker\Docker\Docker Desktop.exe"
    if (Test-Path $dockerPath) {
        Start-Process $dockerPath
        Write-Info "Waiting for Docker to start (30-60 seconds)..."
        $maxWait = 120
        $waited = 0
        while ($waited -lt $maxWait) {
            Start-Sleep -Seconds 5
            $waited += 5
            try {
                $null = & docker info 2>$null
                if ($LASTEXITCODE -eq 0) { $dockerRunning = $true; break }
            } catch {}
            Write-Host "  Waiting... ($waited seconds)" -ForegroundColor Gray
        }
    }
    if (-not $dockerRunning) {
        Write-Err "Docker Desktop did not start. Please start it manually and try again."
        exit 1
    }
}

Write-Info "Docker is ready."

# Check git
$gitInstalled = $false
try {
    $null = & git --version 2>$null
    $gitInstalled = ($LASTEXITCODE -eq 0)
} catch {}

if (-not $gitInstalled) {
    Write-Err "Git is not installed."
    Write-Host "  Install from: https://git-scm.com/downloads"
    exit 1
}

# ─── Update mode ──────────────────────────────────────────────
if ($update) {
    if (-not (Test-Path $InstallDir)) {
        Write-Err "Vibe MyBooks is not installed at $InstallDir"
        Write-Err "Run without -update to install."
        exit 1
    }

    Write-Info "Updating Vibe MyBooks..."
    Set-Location $InstallDir

    & git stash --quiet 2>$null
    & git pull origin main --ff-only
    if ($LASTEXITCODE -ne 0) {
        Write-Err "Failed to pull updates."
        exit 1
    }

    Write-Info "Rebuilding containers..."
    & docker compose -f $ComposeFile -f $ComposeDevFile up --build -d

    Write-Ok "Update complete!"
    Write-Ok "Vibe MyBooks is running at http://localhost:5173"
    exit 0
}

# ─── Fresh install ────────────────────────────────────────────
if (Test-Path $InstallDir) {
    Write-Info "Directory $InstallDir already exists."
    $confirm = Read-Host "Reinstall? Containers will rebuild, data is preserved. [y/N]"
    if ($confirm -ne "y" -and $confirm -ne "Y") {
        Write-Host "Aborted."
        exit 0
    }
} else {
    Write-Info "Cloning Vibe MyBooks to $InstallDir..."
    & git clone $Repo $InstallDir
}

Set-Location $InstallDir

# ─── Generate .env if needed ──────────────────────────────────
$envFile = Join-Path $InstallDir ".env"
if (-not (Test-Path $envFile)) {
    Write-Info "Generating configuration with secure secrets..."

    $jwtSecret = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 48 | ForEach-Object { [char]$_ })
    $encryptionKey = -join ((48..57) + (97..102) | Get-Random -Count 64 | ForEach-Object { [char]$_ })

    $envContent = @"
# Vibe MyBooks Configuration (auto-generated)
DATABASE_URL=postgresql://kisbooks:kisbooks@db:5432/kisbooks
REDIS_URL=redis://redis:6379
JWT_SECRET=$jwtSecret
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d
PORT=3001
VITE_PORT=5173
DB_HOST_PORT=5434
REDIS_HOST_PORT=6379
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=noreply@example.com
UPLOAD_DIR=/data/uploads
MAX_FILE_SIZE_MB=10
PLAID_CLIENT_ID=
PLAID_SECRET=
PLAID_ENV=sandbox
PLAID_ENCRYPTION_KEY=$encryptionKey
ANTHROPIC_API_KEY=
LLM_MODEL=claude-sonnet-4-20250514
BACKUP_DIR=/data/backups
BACKUP_ENCRYPTION_KEY=
"@
    Set-Content -Path $envFile -Value $envContent
    Write-Ok "Configuration generated with secure secrets."
} else {
    Write-Info "Existing .env found - keeping it."
}

# ─── Build and start ──────────────────────────────────────────
Write-Info "Building and starting Vibe MyBooks (first run may take 5-10 minutes)..."
& docker compose -f $ComposeFile -f $ComposeDevFile up --build -d

if ($LASTEXITCODE -ne 0) {
    Write-Err "Failed to start containers. Check Docker Desktop logs."
    exit 1
}

# ─── Wait for ready ──────────────────────────────────────────
Write-Info "Waiting for services to start..."
$maxWait = 120
$waited = 0
$ready = $false

while ($waited -lt $maxWait) {
    Start-Sleep -Seconds 3
    $waited += 3
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:5173" -TimeoutSec 5 -UseBasicParsing -ErrorAction SilentlyContinue
        if ($response.StatusCode -eq 200) { $ready = $true; break }
    } catch {}
    Write-Host "  Starting... ($waited seconds)" -ForegroundColor Gray
}

Write-Host ""
if ($ready) {
    Write-Ok "Vibe MyBooks is ready!"
    Write-Host ""
    Write-Host "  Open: http://localhost:5173" -ForegroundColor White
    Write-Host "  Dir:  $InstallDir" -ForegroundColor White
    Write-Host ""
    Write-Host "  To stop:   cd $InstallDir; docker compose down" -ForegroundColor Gray
    Write-Host "  To update: Set-Variable update `$true; irm .../install.ps1 | iex" -ForegroundColor Gray
    Write-Host ""
    Start-Process "http://localhost:5173"
} else {
    Write-Err "Services did not become ready within 2 minutes."
    Write-Err "Check: cd $InstallDir; docker compose logs"
    Write-Err "Try opening http://localhost:5173 manually."
}
