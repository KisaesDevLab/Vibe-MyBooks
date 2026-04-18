# Vibe MyBooks

A self-hosted, source-available bookkeeping application for solo entrepreneurs, freelancers, and CPA firms. Ships as a single Docker Compose appliance with everything you need to manage your books.

**License:** PolyForm Internal Use 1.0.0 | **Author:** [Kisaes LLC](https://kisaes.com)

---

## Prerequisites

Vibe MyBooks runs as Docker containers, so **Docker must be installed and running** before you run the installer. The installer will exit with instructions if it isn't.

### Install Docker

| OS | Install |
|----|---------|
| **Linux** (Debian / Ubuntu / Fedora / Arch / etc.) | `curl -fsSL https://get.docker.com \| sh` then `sudo usermod -aG docker $USER && newgrp docker` |
| **macOS** | [Docker Desktop](https://docker.com/products/docker-desktop) — also works with [OrbStack](https://orbstack.dev) or Colima |
| **Windows** | [Docker Desktop](https://docker.com/products/docker-desktop) (requires WSL 2 on Win 10/11) |

Docker Desktop bundles everything; on Linux you can install Docker Engine directly with the one-liner above. Either way you also need **Docker Compose v2** (the `docker compose` subcommand), which is included in all modern Docker installs.

### Install git

The installer clones this repo via `git`, so it must be on `PATH`.

| OS | Install |
|----|---------|
| **Linux** | Preinstalled on most distros. If missing: `sudo apt-get install -y git` (Debian/Ubuntu), `sudo dnf install -y git` (Fedora/RHEL), `sudo pacman -S git` (Arch). |
| **macOS** | Preinstalled via Xcode Command Line Tools. If missing: run `xcode-select --install` or `brew install git`. |
| **Windows** | `winget install --id Git.Git -e --source winget` (works on Win 10 2004+ / Win 11 out of the box). Fallback: download the installer from [git-scm.com/download/win](https://git-scm.com/download/win). |

### Sanity check

Before running the installer, confirm in your terminal:
1. Docker Desktop is running (macOS/Windows) or `systemctl start docker` (Linux).
2. `docker info` succeeds.
3. `docker compose version` prints `v2.x` or higher.
4. `git --version` prints a version number.

---

## One-Line Install

**Linux / macOS:**
```bash
curl -fsSL https://raw.githubusercontent.com/KisaesDevLab/Vibe-MyBooks/main/scripts/install.sh | bash
```

**Windows (PowerShell as Administrator):**
```powershell
irm https://raw.githubusercontent.com/KisaesDevLab/Vibe-MyBooks/main/scripts/install.ps1 | iex
```

This clones the repo into `~/vibe-mybooks` (`%USERPROFILE%\vibe-mybooks` on Windows), generates a `.env` with random secure secrets, **pulls the pre-built production image** from `ghcr.io/kisaesdevlab/vibe-mybooks`, and starts the app. The image contains the compiled API + web bundle, so there's no local TypeScript build — first run takes about as long as your connection needs to fetch ~300 MB. Open **http://localhost:3001** when it's ready and complete the first-run setup wizard.

> **Pin a version** by adding `VIBE_MYBOOKS_TAG=v1.2.3` (or any published tag, including `main-<sha>`) to your `.env` before running the installer. Defaults to `latest`. Browse published images at [ghcr.io/kisaesdevlab/vibe-mybooks](https://github.com/KisaesDevLab/Vibe-MyBooks/pkgs/container/vibe-mybooks).

> **Building from source** (contributors only): clone the repo and run `docker compose -f docker-compose.yml -f docker-compose.dev.yml up` for the hot-reload dev stack, or `docker compose -f docker-compose.prod.yml build` to exercise the production Dockerfile locally.

### Update to Latest

**Linux / macOS:**
```bash
curl -fsSL https://raw.githubusercontent.com/KisaesDevLab/Vibe-MyBooks/main/scripts/install.sh | bash -s -- --update
```

**Windows (PowerShell):**
```powershell
& ([scriptblock]::Create((irm https://raw.githubusercontent.com/KisaesDevLab/Vibe-MyBooks/main/scripts/install.ps1))) -update
```

### Stop / start manually

After install, the app lives at `~/vibe-mybooks`. From there:

```bash
docker compose -f docker-compose.prod.yml down      # stop
docker compose -f docker-compose.prod.yml up -d     # start
docker compose -f docker-compose.prod.yml logs -f   # tail logs
```

---

## Features

### Core Bookkeeping
- **Double-entry accounting** with 9 transaction types (invoices, expenses, deposits, transfers, journal entries, cash sales, credit memos, customer refunds, customer payments)
- **Chart of Accounts** with 4 industry-specific templates and system account protection
- **Transaction editing** with full journal line reversal and reposting
- **Account registers** with inline transaction entry and running balances
- **Batch transaction entry** — spreadsheet-style power tool for bulk data entry with paste-from-Excel and CSV import
- **Tags** for flexible transaction categorization with report filtering and tag groups (single/multi-select)
- **Recurring transactions** with auto-post scheduling (daily, weekly, monthly, quarterly, annually)
- **Duplicate detection** with merge/dismiss workflow

### Sales & Invoicing
- **Invoicing** with PDF generation, email delivery, payment tracking, and template customization
- **Estimates** that convert to invoices
- **Items catalog** (Products & Services) for quick invoice line entry with default pricing
- **Receive Payment → Bank Deposit** workflow with Payments Clearing account
- **Check writing & printing** with voucher and standard formats, batch print queue

### Accounts Payable
- **Bills** with vendor terms, due dates, and partial payment tracking
- **Vendor credits** with apply-to-bill workflow
- **Pay Bills** — batch payment screen with credit application
- **Bill OCR** — AI-powered scanning of vendor invoices to pre-fill bill entry
- **AP Aging** reports (summary and detail)

### Banking
- **Bank feed import** (CSV, OFX, QFX) with multi-step name cleansing pipeline
- **AI-powered categorization** with three-layer matching (rules, history, LLM)
- **Bank rules** (tenant + global) with auto-confirm for hands-free categorization
- **Categorization learning** — learns from your accept/override decisions over time
- **Bank statement import** — AI extracts transactions from PDF/image statements
- **Bank reconciliation** with clearing workflow and reconciliation history
- **Duplicate detection** on import (date + amount + description matching)
- **Plaid integration** for live bank connections with auto-sync (optional)

### File Attachments
- **Drag-and-drop attachments** on every transaction form — upload before or after saving
- **Attach existing files** — picker modal to link previously uploaded receipts/documents
- **Receipt capture** with AI-powered OCR (vendor, date, total, tax extraction)
- **Attachment library** — browse and manage all uploaded files across the company
- **Cloud storage providers** — Local disk, S3, Dropbox, Google Drive, OneDrive (per-tenant config)
- **Storage migration** between providers with progress tracking

### AI Features
- **Multi-provider support** — Anthropic (Claude), OpenAI (GPT-4o), Google Gemini, Ollama (self-hosted)
- **Transaction categorization** with configurable confidence thresholds
- **Receipt OCR** — extract vendor, date, total, and tax from receipt photos
- **Bill scanning** — extract vendor invoices into structured bill data
- **Statement parsing** — AI-powered extraction of transactions from PDF statements
- **In-app chat assistant** — context-aware help with accounting concepts and app navigation
- **Chat knowledge base** — 13 curated articles plus auto-generated screen catalog

### Reports
- **30+ financial reports** including P&L, Balance Sheet, Cash Flow, AR/AP Aging (summary + detail), Trial Balance, General Ledger, Customer/Vendor Balance, Expense by Vendor/Category, Check Register, Deposit Detail, Sales Tax, 1099 Preparation, and more
- **Comparative reports** (previous period, previous year, multi-period, budget vs actual)
- **Budgets** with monthly granularity, quick-setup options, and actuals comparison
- **Tag filtering** on all reports for project/department/location analysis
- **Export** — CSV, Excel, and PDF for all reports

### Payroll
- **Payroll import** — CSV/Excel upload from any payroll provider
- **Two import modes** — employee-level detail (Mode A) or pre-built journal entries (Mode B)
- **Auto-detection** of payroll provider format with column mapping
- **Preview and post** — review generated journal entries before recording

### Security & Authentication
- **Two-factor authentication** — TOTP (authenticator apps), SMS, and email codes
- **Passkey / WebAuthn** login — fingerprint, face recognition, or hardware security keys
- **Magic link** email login (requires 2FA configured)
- **Recovery codes** — single-use backup codes for 2FA recovery
- **Trusted devices** — optional 30-day 2FA bypass per browser
- **OAuth 2.0** for third-party application integration

### Administration
- **Multi-tenant** architecture with row-level isolation
- **Multi-company** support per tenant with one-click company switching
- **Super admin dashboard** with tenant/user management
- **Team management** — invite users with role-based access per company
- **AI processing config** — per-task provider selection with usage tracking
- **MCP server** with API key management for AI assistant integration
- **Installation sentinel** — tamper-evident protection against accidental re-setup
- **Recovery key** system — 25-character key to recover encrypted secrets after env loss
- **Dark mode** and font size scaling
- **Full audit trail** with before/after diff viewer

### Backup & Data
- **Portable backups** — passphrase-encrypted `.vmb` files, restorable on any instance
- **Legacy backups** — server-key encrypted `.kbk` files
- **Cloud backup** — scheduled remote backups to S3, Dropbox, Google Drive, OneDrive with GFS retention
- **Data export** — CSV, JSON, Excel for all entity types
- **Tenant export/import** — move company data between instances

---

## Quick Start (Manual)

```bash
# Clone the repository
git clone https://github.com/KisaesDevLab/Vibe-MyBooks.git
cd Vibe-MyBooks

# Copy environment config
cp .env.example .env

# Generate the four required secrets — paste the output into .env,
# overwriting the blank POSTGRES_PASSWORD / JWT_SECRET /
# ENCRYPTION_KEY / PLAID_ENCRYPTION_KEY lines.
npx tsx scripts/generate-secrets.ts

# Start all services (first run builds images — 5-10 minutes)
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build -d

# Open http://localhost:5173 to register
```

## Development Setup

```bash
# Prerequisites: Node.js 20+, Docker

# Install dependencies (host-side, so your IDE's type-checker works)
npm install

# Pre-build the shared package. The dev compose stack bind-mounts
# ./packages/shared/dist into the api/web/worker containers; on a
# fresh clone that directory doesn't exist yet, Docker would create
# it root-owned, and the in-container tsc --watch (running as UID
# 1001) then can't write to it. Building once up-front creates the
# dir with your user's ownership, after which the watcher takes over.
npm run build --workspace=@kis-books/shared

# Start database and Redis
docker compose up db redis -d

# Run in dev mode (hot reload)
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build

# Run tests
npm test
```

---

## Architecture

```
Vibe-MyBooks/
├── packages/
│   ├── shared/          # Shared types, Zod schemas, constants, utilities
│   ├── api/             # Express backend (Node.js 20, Drizzle ORM, TypeScript)
│   ├── web/             # React frontend (Vite, Tailwind CSS, TanStack Query)
│   └── worker/          # BullMQ background job processor
├── scripts/             # CLI tools (install, migrate, backup, seed)
├── installer/           # Windows installer (Inno Setup + PowerShell)
├── e2e/                 # Playwright end-to-end tests
├── docs/                # Deployment, backup, API, and licensing docs
├── docker-compose.yml   # Base Docker config
├── docker-compose.dev.yml  # Dev overrides (hot reload, exposed ports)
└── docker-compose.prod.yml # Production config
```

### Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, React Router v6, TanStack Query v5, Recharts |
| Backend | Node.js 20, Express, TypeScript, Drizzle ORM |
| Database | PostgreSQL 16 |
| Cache/Queue | Redis 7, BullMQ |
| PDF | Puppeteer (HTML to PDF) |
| Email | Nodemailer (SMTP) |
| Auth | JWT + refresh tokens, bcrypt, WebAuthn, TOTP |
| AI | Anthropic, OpenAI, Gemini, Ollama (configurable per task) |
| Storage | Local disk, S3, Dropbox, Google Drive, OneDrive |
| Testing | Vitest (unit/integration), Playwright (E2E) |

---

## Configuration

See [`.env.example`](.env.example) for all available environment variables.

Key settings:
- `DATABASE_URL` — PostgreSQL connection string
- `JWT_SECRET` — **Must change in production**
- `SMTP_HOST/PORT/USER/PASS` — Email delivery for invoices and notifications
- `BACKUP_ENCRYPTION_KEY` — AES-256 encryption for backups

---

## Scripts

| Script | Description |
|--------|-------------|
| `scripts/install.sh` | One-line install/update for Linux/macOS |
| `scripts/install.ps1` | One-line install/update for Windows |
| `scripts/migrate.ts` | Run database migrations |
| `scripts/generate-secrets.ts` | Generate secure passwords and keys |
| `scripts/reset-admin-password.ts` | Emergency admin password reset |
| `scripts/backup.sh` | Create encrypted database backup |
| `scripts/factory-reset.sh` | Wipe all data and start fresh |
| `scripts/seed-demo-data.ts` | Seed sample transactions for testing |
| `scripts/license-audit.sh` | Full license compliance audit (`npm run license:audit`) |
| `scripts/check-license-headers.sh` | Verify PolyForm headers on source files |
| `scripts/add-license-header.sh` | Backfill PolyForm headers where missing |
| `scripts/generate-sbom.sh` | Emit CycloneDX SBOM + flat license inventory |

---

## License Compliance

Vibe MyBooks ships under the PolyForm Internal Use License 1.0.0. Every dependency is scanned to ensure no incompatible licenses (GPL-2.0, AGPL, SSPL, proprietary) enter the tree. The policy is enforced on every pull request and on a weekly schedule.

**Run the audit locally:**

```bash
npm run license:audit          # full report to stdout
npm run license:audit:json     # also emit scripts/license-audit-result.json
npm run license:headers        # verify PolyForm headers on source files
npm run license:headers:fix    # add headers to any files missing them
npm run license:sbom           # generate CycloneDX SBOM + license inventory
```

**Before adding a new dependency:** check its SPDX identifier against [`scripts/license-policy.json`](scripts/license-policy.json).

- `allowed` list → safe to add.
- `reviewRequired` list → add only with a documented `knownIssues` entry (rationale + resolution).
- `denied` list → find an alternative.

If a transitive dependency pulls in something problematic, pin a different version using the root `overrides` field in `package.json` (see the `unzipper` entry for an example). The pre-commit hook runs a fast header check on staged source files and a full audit whenever any `package.json` is touched.

---

## License

**PolyForm Internal Use License 1.0.0** — see [LICENSE](LICENSE) for full text.

- Free to use and modify for personal or internal business operations
- Free for individuals, freelancers, and firms for internal/staff-operated use
- **Distribution is not permitted** under this license
- Commercial license required for client-facing portal access — see [COMMERCIAL_LICENSE.md](COMMERCIAL_LICENSE.md)

For licensing questions: licensing@kisaes.com

---

Built by [Kisaes LLC](https://kisaes.com)
