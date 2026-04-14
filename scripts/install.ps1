# Vibe MyBooks — One-Line Install & Update Script (Windows, production)
# Usage:
#   Install:  irm https://raw.githubusercontent.com/KisaesDevLab/Vibe-MyBooks/main/scripts/install.ps1 | iex
#   Update:   & ([scriptblock]::Create((irm https://raw.githubusercontent.com/KisaesDevLab/Vibe-MyBooks/main/scripts/install.ps1))) -update
#
# This script uses docker-compose.prod.yml — single `app` container built
# from the multi-stage root Dockerfile that serves the API plus the
# pre-built web bundle. For a dev setup with hot reload, clone the repo
# and run `docker compose -f docker-compose.yml -f docker-compose.dev.yml up`.

param([switch]$update)

$ErrorActionPreference = "Stop"
$Repo = "https://github.com/KisaesDevLab/Vibe-MyBooks.git"
$InstallDir = if ($env:VIBE_MYBOOKS_DIR) { $env:VIBE_MYBOOKS_DIR } else { "$env:USERPROFILE\vibe-mybooks" }
$ComposeFile = "docker-compose.prod.yml"
$AppPort = if ($env:APP_PORT) { $env:APP_PORT } else { "3001" }

# ─── Logging + no-disappear-on-error ──────────────────────────
# When this script is run via `irm ... | iex`, the usual failure pattern
# is that `exit 1` closes the host window before the user can read the
# error. Two defenses:
#   1. Start-Transcript tees all output to a log file, so even if the
#      window vanishes the full run is on disk.
#   2. Every exit path goes through Stop-InstallAndPause, which prints
#      the log path and waits for a keypress before returning control.
$LogFile = Join-Path $env:TEMP "vibe-mybooks-install.log"
try { Start-Transcript -Path $LogFile -Append -Force | Out-Null } catch { }

function Write-Info($msg) { Write-Host "[Vibe MyBooks] $msg" -ForegroundColor Cyan }
function Write-Ok($msg)   { Write-Host "[Vibe MyBooks] $msg" -ForegroundColor Green }
function Write-Err($msg)  { Write-Host "[Vibe MyBooks ERROR] $msg" -ForegroundColor Red }

function Pause-Then-Exit([int]$code) {
    try { Stop-Transcript | Out-Null } catch { }
    Write-Host ""
    Write-Host "  Log file: $LogFile" -ForegroundColor DarkGray
    # Only pause when stdin is an actual console. When the script is
    # piped non-interactively (CI, one-shot run), Read-Host would hang
    # forever waiting for input that never comes.
    if ([Environment]::UserInteractive -and -not [Console]::IsInputRedirected) {
        try { Read-Host "Press Enter to close this window" | Out-Null } catch { }
    }
    exit $code
}

# Trap any unhandled error / terminating exception so the user sees
# *something* even when we didn't anticipate the failure.
trap {
    Write-Err ("Unhandled error: " + $_.Exception.Message)
    Write-Host $_.ScriptStackTrace -ForegroundColor DarkGray
    Pause-Then-Exit 1
}

# ─── Check prerequisites ──────────────────────────────────────
Write-Info "Checking prerequisites..."

# Docker CLI present?
$dockerInstalled = $false
try {
    $null = & docker --version 2>$null
    $dockerInstalled = ($LASTEXITCODE -eq 0)
} catch {}

if (-not $dockerInstalled) {
    Write-Err "Docker is not installed."
    Write-Host ""
    Write-Host "  Install Docker Desktop for Windows:"
    Write-Host "    https://docker.com/products/docker-desktop"
    Write-Host ""
    Write-Host "  (Docker Desktop bundles both Docker Engine and Compose v2.)"
    Write-Host "  Then re-run this script."
    Write-Host ""
    Pause-Then-Exit 1
}

# Docker daemon running?
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
        Write-Info "Waiting for Docker to start (30-120 seconds)..."
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
        Pause-Then-Exit 1
    }
}

# Compose v2 available?
try {
    $null = & docker compose version 2>$null
    if ($LASTEXITCODE -ne 0) { throw "compose v2 unavailable" }
} catch {
    Write-Err "Docker Compose v2 is required. Please update Docker Desktop to a recent version."
    Pause-Then-Exit 1
}

# git present?
$gitInstalled = $false
try {
    $null = & git --version 2>$null
    $gitInstalled = ($LASTEXITCODE -eq 0)
} catch {}

if (-not $gitInstalled) {
    # Try winget — it's built into Win 10 2004+ and Win 11 and can
    # install git unattended. If winget is also missing we fall back to
    # telling the user where to get the installer.
    $wingetAvailable = $false
    try {
        $null = & winget --version 2>$null
        $wingetAvailable = ($LASTEXITCODE -eq 0)
    } catch {}

    if ($wingetAvailable) {
        Write-Info "Git is not installed. Installing via winget..."
        & winget install --id Git.Git -e --source winget --accept-source-agreements --accept-package-agreements --silent 2>&1 | Out-Host
        # winget sets git on PATH for new shells; for the current shell,
        # add the default install path explicitly so `git` resolves now.
        $gitBin = "$env:ProgramFiles\Git\cmd"
        if (Test-Path "$gitBin\git.exe") { $env:PATH = "$gitBin;$env:PATH" }
        try {
            $null = & git --version 2>$null
            $gitInstalled = ($LASTEXITCODE -eq 0)
        } catch {}
    }

    if (-not $gitInstalled) {
        Write-Err "Git is not installed and could not be installed automatically."
        Write-Host ""
        Write-Host "  Install manually:"
        Write-Host "    winget install --id Git.Git -e --source winget"
        Write-Host "  Or download from:"
        Write-Host "    https://git-scm.com/download/win"
        Write-Host ""
        Write-Host "  Close this window, install git, open a NEW PowerShell, and re-run the installer."
        Pause-Then-Exit 1
    }
    Write-Ok "Git installed."
}

Write-Info "Docker and git are ready."

# ─── Update mode ──────────────────────────────────────────────
if ($update) {
    if (-not (Test-Path $InstallDir)) {
        Write-Err "Vibe MyBooks is not installed at $InstallDir"
        Write-Err "Run without -update to install."
        Pause-Then-Exit 1
    }

    Write-Info "Updating Vibe MyBooks..."
    Set-Location $InstallDir

    & git stash --quiet 2>$null
    & git pull origin main --ff-only
    if ($LASTEXITCODE -ne 0) {
        Write-Err "Failed to pull updates."
        Pause-Then-Exit 1
    }

    Write-Info "Rebuilding containers..."
    & docker compose -f $ComposeFile up --build -d

    Write-Ok "Update complete!"
    Write-Ok "Vibe MyBooks is running at http://localhost:$AppPort"
    Pause-Then-Exit 0
}

# ─── Fresh install ────────────────────────────────────────────
if (Test-Path $InstallDir) {
    Write-Info "Directory $InstallDir already exists."
    $confirm = Read-Host "Reinstall? Containers will rebuild, data is preserved. [y/N]"
    if ($confirm -ne "y" -and $confirm -ne "Y") {
        Write-Host "Aborted."
        Pause-Then-Exit 0
    }
} else {
    Write-Info "Cloning Vibe MyBooks to $InstallDir..."
    & git clone $Repo $InstallDir
}

Set-Location $InstallDir

# ─── Generate .env with secure secrets ────────────────────────
# The production compose file requires POSTGRES_PASSWORD, ENCRYPTION_KEY,
# PLAID_ENCRYPTION_KEY, and JWT_SECRET. Missing values fail the startup
# validator. Fresh installs get newly-minted random values.
$envFile = Join-Path $InstallDir ".env"
if (-not (Test-Path $envFile)) {
    Write-Info "Generating configuration with secure secrets..."

    # All secrets are hex-encoded so the output length is fully predictable:
    # N bytes of hex = 2N characters, no padding or character stripping
    # needed. The earlier base64 approach stripped `+` and `/` after the
    # fact, which produced strings shorter than the requested Substring
    # length and crashed on a fresh Windows install.
    function New-SecretHex([int]$Bytes) {
        $buf = New-Object byte[] $Bytes
        [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($buf)
        ($buf | ForEach-Object { $_.ToString('x2') }) -join ''
    }

    $jwtSecret           = New-SecretHex 24  # 48 hex chars (JWT_SECRET min is 20)
    $encryptionKey       = New-SecretHex 32  # 64 hex chars / 32 bytes
    $plaidEncryptionKey  = New-SecretHex 32  # 64 hex chars / 32 bytes
    $postgresPassword    = New-SecretHex 16  # 32 hex chars
    $generatedAt         = (Get-Date).ToUniversalTime().ToString('yyyy-MM-dd HH:mm:ss UTC')

    $envContent = @"
# Vibe MyBooks — auto-generated on $generatedAt
# Values here are secrets; DO NOT commit this file.

# Database
POSTGRES_USER=kisbooks
POSTGRES_PASSWORD=$postgresPassword
POSTGRES_DB=kisbooks

# Auth / crypto
JWT_SECRET=$jwtSecret
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d
ENCRYPTION_KEY=$encryptionKey
PLAID_ENCRYPTION_KEY=$plaidEncryptionKey

# Runtime
NODE_ENV=production
PORT=$AppPort
CORS_ORIGIN=http://localhost:$AppPort

# Email (SMTP) — fill in to enable outbound mail
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=noreply@example.com

# File storage
UPLOAD_DIR=/data/uploads
MAX_FILE_SIZE_MB=10

# Plaid (optional)
PLAID_CLIENT_ID=
PLAID_SECRET=
PLAID_ENV=sandbox

# LLM (optional)
ANTHROPIC_API_KEY=
LLM_MODEL=claude-sonnet-4-20250514

# Backup
BACKUP_DIR=/data/backups
BACKUP_ENCRYPTION_KEY=
"@
    Set-Content -Path $envFile -Value $envContent
    Write-Ok "Configuration generated with secure secrets at $envFile"
} else {
    Write-Info "Existing .env found - keeping it."
}

# ─── Build and start ──────────────────────────────────────────
Write-Info "Building and starting Vibe MyBooks (first run may take 5-10 minutes)..."
& docker compose -f $ComposeFile up --build -d

if ($LASTEXITCODE -ne 0) {
    Write-Err "Failed to start containers. Check Docker Desktop logs."
    Pause-Then-Exit 1
}

# ─── Wait for ready ──────────────────────────────────────────
Write-Info "Waiting for services to start..."
$maxWait = 180
$waited = 0
$ready = $false

while ($waited -lt $maxWait) {
    Start-Sleep -Seconds 3
    $waited += 3
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:$AppPort/health" -TimeoutSec 5 -UseBasicParsing -ErrorAction SilentlyContinue
        if ($response.StatusCode -eq 200) { $ready = $true; break }
    } catch {}
    Write-Host "  Starting... ($waited seconds)" -ForegroundColor Gray
}

Write-Host ""
if ($ready) {
    Write-Ok "Vibe MyBooks is ready!"
    Write-Host ""
    Write-Host "  Open:  http://localhost:$AppPort" -ForegroundColor White
    Write-Host "  Dir:   $InstallDir" -ForegroundColor White
    Write-Host ""
    Write-Host "  First run? Visit http://localhost:$AppPort/setup to complete the wizard." -ForegroundColor Gray
    Write-Host ""
    Write-Host "  To stop:    cd $InstallDir; docker compose -f $ComposeFile down" -ForegroundColor Gray
    Write-Host "  To update:  & ([scriptblock]::Create((irm .../install.ps1))) -update" -ForegroundColor Gray
    Write-Host ""
    Start-Process "http://localhost:$AppPort"
    Pause-Then-Exit 0
} else {
    Write-Err "Services did not become ready within 3 minutes."
    Write-Err "Check: cd $InstallDir; docker compose -f $ComposeFile logs"
    Write-Err "Try opening http://localhost:$AppPort manually."
    Pause-Then-Exit 1
}
