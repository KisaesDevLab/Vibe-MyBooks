# Vibe MyBooks

A self-hosted, source-available bookkeeping application for solo entrepreneurs, freelancers, and CPA firms. Ships as a single Docker Compose appliance with everything you need to manage your books.

**License:** PolyForm Internal Use 1.0.0 | **Author:** [Kisaes LLC](https://kisaes.com)

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

**PolyForm Internal Use License 1.0.0** — see [LICENSE](LICENSE) for full text.

- Free to use and modify for personal or internal business operations
- Free for individuals, freelancers, and firms for internal/staff-operated use
- **Distribution is not permitted** under this license
- Commercial license required for client-facing portal access — see [COMMERCIAL_LICENSE.md](COMMERCIAL_LICENSE.md)

For licensing questions: licensing@kisaes.com

---

Built by [Kisaes LLC](https://kisaes.com)
