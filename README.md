# Vibe MyBooks

A self-hosted, open-source bookkeeping application for solo entrepreneurs, freelancers, and CPA firms. Ships as a single Docker Compose appliance with everything you need to manage your books.

**License:** Elastic License 2.0 (ELv2) | **Author:** [Kisaes LLC](https://kisaes.com)

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

This will clone the repo, generate secure secrets, build the Docker images, and start all services. Open **http://localhost:5173** when complete.

### Update to Latest

**Linux / macOS:**
```bash
curl -fsSL https://raw.githubusercontent.com/KisaesDevLab/Vibe-MyBooks/main/scripts/install.sh | bash -s -- --update
```

**Windows (PowerShell):**
```powershell
irm https://raw.githubusercontent.com/KisaesDevLab/Vibe-MyBooks/main/scripts/install.ps1 | iex -update
```

---

## Features

### Core Bookkeeping
- **Double-entry accounting** with 9 transaction types (invoices, expenses, deposits, transfers, journal entries, cash sales, credit memos, customer refunds, customer payments)
- **Chart of Accounts** with 4 industry-specific templates and system account protection
- **Transaction editing** with full journal line reversal and reposting
- **Account registers** with inline transaction entry
- **Batch transaction entry** — spreadsheet-style power tool for bulk data entry
- **Tags** for flexible transaction categorization with report filtering
- **Recurring transactions** with auto-post scheduling
- **Duplicate detection** with merge/dismiss workflow

### Sales & Invoicing
- **Invoicing** with PDF generation, email delivery, payment tracking, and template customization
- **Items catalog** for quick invoice line entry
- **Receive Payment to Bank Deposit** workflow
- **Check writing & printing** with voucher and standard formats

### Banking
- **Bank feed import** (CSV, OFX, QFX) with multi-step name cleansing pipeline
- **AI-powered categorization** with three-layer matching (rules, history, LLM)
- **Bank rules** (tenant + global) with auto-confirm for hands-free categorization
- **Categorization learning** — learns from your accept/override decisions over time
- **Bank statement import** — AI extracts transactions from PDF/image statements
- **Bank reconciliation** with clearing workflow
- **Duplicate detection** on import (date + amount + description matching)
- **Plaid integration** for live bank connections (optional)

### File Attachments
- **Drag-and-drop attachments** on every transaction form — upload before or after saving
- **Attach existing files** — picker modal to link previously uploaded receipts/documents
- **Receipt capture** with AI-powered OCR (vendor, date, total, tax extraction)
- **Cloud storage providers** — Local disk, S3, Dropbox, Google Drive, OneDrive (per-tenant config)
- **Storage migration** between providers with progress tracking

### Reports
- **24 financial reports** (P&L, Balance Sheet, Cash Flow, AR Aging, Trial Balance, General Ledger, and more)
- **Comparative reports** (previous period, previous year, multi-period, budget vs actual)
- **Budgets** with monthly granularity

### Administration
- **Multi-tenant** architecture with row-level isolation
- **Multi-company** support per tenant with company switching
- **Super admin dashboard** with tenant/user management
- **AI processing config** — multi-provider (Anthropic, OpenAI, Gemini, Ollama)
- **MCP server** with API key management and OAuth
- **Two-factor authentication** (TOTP, SMS, email)
- **Passkey / WebAuthn** login
- **Dark mode** and font size scaling
- **Full audit trail** with before/after diff viewer
- **Backup & restore** with AES-256 encryption
- **Data export** (CSV, JSON)

---

## Quick Start (Manual)

```bash
# Clone the repository
git clone https://github.com/KisaesDevLab/Vibe-MyBooks.git
cd Vibe-MyBooks

# Copy environment config
cp .env.example .env

# Generate secure secrets (edit .env with output)
npx tsx scripts/generate-secrets.ts

# Start all services (first run builds images — 5-10 minutes)
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build -d

# Open http://localhost:5173 to register
```

## Development Setup

```bash
# Prerequisites: Node.js 20+, Docker

# Install dependencies
npm install

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

---

## License

**Elastic License 2.0 (ELv2)** — see [LICENSE](LICENSE) for full text.

- Free for individuals, freelancers, and firms for internal/staff-operated use
- You may self-host, modify, and redistribute under ELv2 terms
- You may **not** offer Vibe MyBooks as a hosted/managed service to third parties
- Commercial license required for client-facing portal access — see [COMMERCIAL_LICENSE.md](COMMERCIAL_LICENSE.md)

For licensing questions: licensing@kisaes.com

---

Built by [Kisaes LLC](https://kisaes.com)
