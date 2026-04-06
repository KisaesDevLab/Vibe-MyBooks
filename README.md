# Vibe MyBooks

A self-hosted, open-source bookkeeping application — a credible alternative to QuickBooks Online Simple Start. Ships as a single Docker Compose appliance targeting solo entrepreneurs, freelancers, and CPA firms.

## Features

- **Double-entry accounting** with 9 transaction types (invoices, expenses, deposits, transfers, journal entries, cash sales, credit memos, customer refunds, customer payments)
- **Chart of Accounts** with 4 industry-specific templates and system account protection
- **Invoicing** with PDF generation, email delivery, payment tracking, and template customization
- **Bank feed import** (CSV/OFX/QFX) with AI-powered categorization and bank rules
- **Bank reconciliation** with clearing workflow
- **24 financial reports** (P&L, Balance Sheet, Cash Flow, AR Aging, Trial Balance, General Ledger, and more)
- **Comparative reports** (previous period, previous year, multi-period, budget vs actual)
- **Account registers** with inline transaction entry (QBO-style)
- **Batch transaction entry** — spreadsheet-style power tool for bulk data entry
- **Check writing & printing** with voucher and standard formats
- **Items catalog** for quick invoice line entry
- **Receive Payment → Bank Deposit** workflow
- **Tags** for flexible transaction categorization with report filtering
- **Recurring transactions** with auto-post scheduling
- **Receipt capture** with OCR (Claude vision API ready)
- **Budgets** with monthly granularity and budget vs actual reports
- **Dark mode** and font size scaling
- **Duplicate detection** with merge/dismiss workflow
- **Backup & restore** with AES-256 encryption
- **Full audit trail** with before/after diff viewer
- **Multi-tenant** architecture with row-level isolation

## Quick Start

```bash
# Clone the repository
git clone https://github.com/kisaes/kis-books.git
cd kis-books

# Copy environment config
cp .env.example .env

# Start all services
docker compose up

# Open http://localhost:5173 to register
```

## Development Setup

```bash
# Prerequisites: Node.js 20+, Docker, PostgreSQL 16

# Install dependencies
npm install

# Start database and Redis
docker compose up db redis -d

# Run migrations
DATABASE_URL=postgresql://kisbooks:kisbooks@localhost:5434/kisbooks npx tsx scripts/migrate.ts

# Start API server
cd packages/api && npm run dev

# Start web dev server (separate terminal)
cd packages/web && npm run dev

# Run tests
npm test
```

## Architecture

```
kis-books/
├── packages/
│   ├── shared/          # Shared types, schemas, constants, utilities
│   ├── api/             # Express backend (Node.js, Drizzle ORM)
│   ├── web/             # React frontend (Vite, Tailwind CSS)
│   └── worker/          # BullMQ background job processor
├── scripts/             # CLI tools (migrate, backup, setup, seed)
├── e2e/                 # Playwright end-to-end tests
├── docker-compose.yml   # Development Docker config
└── Dockerfile           # Production multi-stage build
```

### Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, React Router v6, TanStack Query v5, Recharts |
| Backend | Node.js 20, Express, TypeScript, Drizzle ORM |
| Database | PostgreSQL 16 |
| Cache/Queue | Redis 7, BullMQ |
| PDF | Puppeteer (HTML → PDF) |
| Email | Nodemailer (SMTP) |
| Auth | JWT access tokens (15min) + HTTP-only refresh tokens (7d), bcrypt |
| Testing | Vitest (72 unit/integration tests), Playwright (E2E) |

## Configuration

See [`.env.example`](.env.example) for all available environment variables.

Key settings:
- `DATABASE_URL` — PostgreSQL connection string
- `JWT_SECRET` — **Must change in production** (use `npx tsx scripts/generate-secrets.ts`)
- `SMTP_HOST/PORT/USER/PASS` — Email delivery for invoices
- `BACKUP_ENCRYPTION_KEY` — AES-256 encryption for backups

## Production Deployment

```bash
# Generate secrets
npx tsx scripts/generate-secrets.ts

# Configure
cp .env.production.example .env
# Edit .env with generated secrets

# Build and start
docker compose -f docker-compose.prod.yml up -d
```

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for detailed production deployment guide.

## Scripts

| Script | Description |
|--------|-------------|
| `scripts/migrate.ts` | Run database migrations |
| `scripts/generate-secrets.ts` | Generate secure passwords and keys |
| `scripts/reset-admin-password.ts` | Emergency admin password reset |
| `scripts/backup.sh` | Create encrypted database backup |
| `scripts/factory-reset.sh` | Wipe all data and start fresh |
| `scripts/seed-demo-data.ts` | Seed sample transactions for testing |

## License

Elastic License 2.0 (ELv2) — see [LICENSE](LICENSE) for details.

Free for individuals, freelancers, and firms for internal/staff-operated use. Commercial license required for client-facing portal access — see [COMMERCIAL_LICENSE.md](COMMERCIAL_LICENSE.md).

For licensing questions: licensing@kisaes.com

Built by [Kisaes LLC](https://kisaes.com).
