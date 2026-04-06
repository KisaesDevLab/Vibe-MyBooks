# KIS Books — Master Build Plan

**Version:** 1.0
**Date:** April 2, 2026
**Repository:** kis-books
**Reference:** QBO_SimpleStart_Alternative_Proposal.md

---

## CLAUDE.md — Instructions for Claude Code

### Project Overview
KIS Books is a self-hosted, open-source bookkeeping application targeting solo entrepreneurs and CPA firms. It is a credible alternative to QuickBooks Online Simple Start, built as a Docker appliance.

### Stack
- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, React Router v6, React Query (TanStack Query)
- **Backend:** Node.js, Express, TypeScript, Drizzle ORM
- **Database:** PostgreSQL 16
- **Job Queue:** BullMQ + Redis
- **PDF Generation:** @react-pdf/renderer (invoices/reports) or Puppeteer
- **Email:** Nodemailer (SMTP configurable)
- **File Storage:** Local disk (Docker volume), S3-compatible optional
- **Auth:** JWT access tokens + HTTP-only refresh tokens, bcrypt password hashing
- **Container:** Docker Compose (web + api + db + redis + worker)
- **Testing:** Vitest (unit/integration), Playwright (e2e)

### Autonomous Execution Rules
1. **Work phase by phase, task by task.** Do not skip ahead. Mark each checkbox `[x]` when complete.
2. **Run all tests after each task.** If tests fail, fix before moving on.
3. **Log questions in QUESTIONS.md** if you encounter ambiguity. Format: `| Phase | Question | Assumption Made | Resolved? |`
4. **Do not invent features** not in this plan or the proposal. If something seems missing, log it in QUESTIONS.md and proceed with the simplest assumption.
5. **Commit after each completed task group** (e.g., after finishing all of Phase 1.2). Commit message format: `phase-X.Y: brief description`
6. **Database migrations are additive only.** Never drop columns or tables in a migration — create a new migration instead.
7. **Every API endpoint must have:** input validation (Zod), error handling, audit trail logging, tenant scoping.
8. **Every UI page must have:** loading state, error state, empty state, responsive layout.
9. **Use decimal(19,4) for all monetary amounts.** Never use float/double for money.
10. **All dates stored as UTC in the database.** Display in user's local timezone on the frontend.

### File Structure
```
kis-books/
├── docker-compose.yml
├── docker-compose.dev.yml
├── .env.example
├── README.md
├── CLAUDE.md (this file's instructions section)
├── BUILD_PLAN.md (this file)
├── QUESTIONS.md
├── packages/
│   ├── shared/                  # Shared types, constants, validation schemas
│   │   ├── src/
│   │   │   ├── types/           # TypeScript interfaces & enums
│   │   │   ├── schemas/         # Zod validation schemas
│   │   │   ├── constants/       # Enums, COA templates, tax codes
│   │   │   └── utils/           # Shared utility functions (money, dates)
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── api/                     # Express backend
│   │   ├── src/
│   │   │   ├── index.ts         # Server entry point
│   │   │   ├── app.ts           # Express app setup (middleware, routes)
│   │   │   ├── config/          # Environment config, database config
│   │   │   ├── db/
│   │   │   │   ├── schema/      # Drizzle schema files (one per entity group)
│   │   │   │   ├── migrations/  # SQL migration files
│   │   │   │   ├── seeds/       # Seed data (COA templates, etc.)
│   │   │   │   └── index.ts     # Drizzle client instance
│   │   │   ├── middleware/       # Auth, tenant, error handler, audit
│   │   │   ├── routes/          # Express routers (one per domain)
│   │   │   ├── services/        # Business logic layer
│   │   │   ├── jobs/            # BullMQ job processors
│   │   │   └── utils/           # Server-side helpers
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── web/                     # React frontend
│   │   ├── src/
│   │   │   ├── main.tsx
│   │   │   ├── App.tsx
│   │   │   ├── api/             # API client, React Query hooks
│   │   │   ├── components/      # Shared UI components
│   │   │   │   ├── ui/          # Primitives (Button, Input, Modal, Table, etc.)
│   │   │   │   ├── layout/      # Shell, Sidebar, Header, etc.
│   │   │   │   └── forms/       # Reusable form components
│   │   │   ├── features/        # Feature modules (one folder per domain)
│   │   │   │   ├── auth/
│   │   │   │   ├── company/
│   │   │   │   ├── accounts/
│   │   │   │   ├── contacts/
│   │   │   │   ├── transactions/
│   │   │   │   ├── invoicing/
│   │   │   │   ├── banking/
│   │   │   │   ├── reports/
│   │   │   │   ├── dashboard/
│   │   │   │   ├── attachments/
│   │   │   │   └── settings/
│   │   │   ├── hooks/           # Global custom hooks
│   │   │   ├── stores/          # Zustand stores (if needed)
│   │   │   ├── utils/           # Frontend helpers
│   │   │   └── styles/          # Global styles, Tailwind config
│   │   ├── index.html
│   │   ├── vite.config.ts
│   │   ├── tailwind.config.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── worker/                  # BullMQ worker process
│       ├── src/
│       │   ├── index.ts
│       │   └── processors/      # Job processors
│       ├── package.json
│       └── tsconfig.json
├── scripts/                     # Dev/build/deploy scripts
│   ├── seed-coa.ts
│   ├── migrate.ts
│   └── backup.sh
└── e2e/                         # Playwright tests
    ├── playwright.config.ts
    └── tests/
```

### Naming Conventions
- **Database tables:** snake_case plural (e.g., `journal_entries`, `line_items`)
- **Database columns:** snake_case (e.g., `created_at`, `tenant_id`)
- **TypeScript interfaces:** PascalCase with descriptive names (e.g., `JournalEntry`, `CreateInvoiceInput`)
- **API routes:** kebab-case, REST conventions (`/api/v1/accounts`, `/api/v1/invoices/:id`)
- **React components:** PascalCase files and exports
- **Feature folders:** kebab-case matching domain

---

## Database Schema

### Tenant & Auth

```sql
-- Every table below includes tenant_id for row-level isolation
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  display_name VARCHAR(255),
  role VARCHAR(50) NOT NULL DEFAULT 'owner',  -- 'owner' | 'accountant' (Phase 2)
  is_active BOOLEAN DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, email)
);

CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  refresh_token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Company

```sql
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  business_name VARCHAR(255) NOT NULL,
  legal_name VARCHAR(255),
  ein VARCHAR(20),
  address_line1 VARCHAR(255),
  address_line2 VARCHAR(255),
  city VARCHAR(100),
  state VARCHAR(50),
  zip VARCHAR(20),
  country VARCHAR(3) DEFAULT 'US',
  phone VARCHAR(30),
  email VARCHAR(255),
  website VARCHAR(255),
  logo_url VARCHAR(500),
  industry VARCHAR(100),
  entity_type VARCHAR(50) NOT NULL, -- 'sole_prop' | 'single_member_llc' | 's_corp' | 'c_corp' | 'partnership'
  fiscal_year_start_month INT DEFAULT 1, -- 1=Jan .. 12=Dec
  accounting_method VARCHAR(10) DEFAULT 'accrual', -- 'cash' | 'accrual'
  default_payment_terms VARCHAR(50) DEFAULT 'net_30',
  invoice_prefix VARCHAR(20) DEFAULT 'INV-',
  invoice_next_number INT DEFAULT 1001,
  default_sales_tax_rate DECIMAL(5,4) DEFAULT 0, -- e.g., 0.0825 = 8.25%
  currency VARCHAR(3) DEFAULT 'USD',
  date_format VARCHAR(20) DEFAULT 'MM/DD/YYYY',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Chart of Accounts

```sql
CREATE TYPE account_type AS ENUM ('asset', 'liability', 'equity', 'revenue', 'expense');

CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  account_number VARCHAR(20),
  name VARCHAR(255) NOT NULL,
  account_type account_type NOT NULL,
  detail_type VARCHAR(100),         -- e.g., 'bank', 'accounts_receivable', 'credit_card', 'other_current_asset'
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  is_system BOOLEAN DEFAULT FALSE,  -- TRUE = protected from deletion
  system_tag VARCHAR(50),           -- 'accounts_receivable' | 'payments_clearing' | 'retained_earnings' | 'opening_balances'
  parent_id UUID REFERENCES accounts(id), -- for sub-accounts
  balance DECIMAL(19,4) DEFAULT 0,  -- running balance (denormalized, updated by triggers/service)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, account_number)
);

CREATE INDEX idx_accounts_tenant ON accounts(tenant_id);
CREATE INDEX idx_accounts_type ON accounts(tenant_id, account_type);
CREATE INDEX idx_accounts_system_tag ON accounts(tenant_id, system_tag);
```

### Contacts

```sql
CREATE TYPE contact_type AS ENUM ('customer', 'vendor', 'both');

CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  contact_type contact_type NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  company_name VARCHAR(255),
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  email VARCHAR(255),
  phone VARCHAR(30),
  -- Billing address
  billing_line1 VARCHAR(255),
  billing_line2 VARCHAR(255),
  billing_city VARCHAR(100),
  billing_state VARCHAR(50),
  billing_zip VARCHAR(20),
  billing_country VARCHAR(3) DEFAULT 'US',
  -- Shipping address (customers)
  shipping_line1 VARCHAR(255),
  shipping_line2 VARCHAR(255),
  shipping_city VARCHAR(100),
  shipping_state VARCHAR(50),
  shipping_zip VARCHAR(20),
  shipping_country VARCHAR(3) DEFAULT 'US',
  -- Customer-specific
  default_payment_terms VARCHAR(50),
  opening_balance DECIMAL(19,4) DEFAULT 0,
  opening_balance_date DATE,
  -- Vendor-specific
  default_expense_account_id UUID REFERENCES accounts(id),
  tax_id VARCHAR(30),
  is_1099_eligible BOOLEAN DEFAULT FALSE,
  -- Shared
  notes TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_contacts_tenant ON contacts(tenant_id);
CREATE INDEX idx_contacts_type ON contacts(tenant_id, contact_type);
CREATE INDEX idx_contacts_name ON contacts(tenant_id, display_name);
```

### Transactions (Double-Entry Ledger)

```sql
CREATE TYPE txn_type AS ENUM (
  'invoice', 'customer_payment', 'cash_sale', 'expense',
  'deposit', 'transfer', 'journal_entry', 'credit_memo', 'customer_refund'
);

CREATE TYPE txn_status AS ENUM ('draft', 'posted', 'void');

CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  txn_type txn_type NOT NULL,
  txn_number VARCHAR(50),           -- e.g., INV-1001, JE-0042
  txn_date DATE NOT NULL,
  due_date DATE,                    -- invoices
  status txn_status DEFAULT 'posted',
  contact_id UUID REFERENCES contacts(id),
  memo TEXT,
  internal_notes TEXT,
  -- Invoice-specific
  payment_terms VARCHAR(50),
  subtotal DECIMAL(19,4),
  tax_amount DECIMAL(19,4) DEFAULT 0,
  total DECIMAL(19,4),
  amount_paid DECIMAL(19,4) DEFAULT 0,
  balance_due DECIMAL(19,4),
  -- Invoice lifecycle
  invoice_status VARCHAR(20),       -- 'draft' | 'sent' | 'viewed' | 'partial' | 'paid' | 'void'
  sent_at TIMESTAMPTZ,
  viewed_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  -- Recurring
  is_recurring BOOLEAN DEFAULT FALSE,
  recurring_schedule_id UUID,
  -- Links
  source_estimate_id UUID REFERENCES transactions(id),  -- estimate that spawned this invoice
  applied_to_invoice_id UUID REFERENCES transactions(id), -- for payments, credit memos
  -- Metadata
  void_reason TEXT,
  voided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_txn_tenant ON transactions(tenant_id);
CREATE INDEX idx_txn_type ON transactions(tenant_id, txn_type);
CREATE INDEX idx_txn_date ON transactions(tenant_id, txn_date);
CREATE INDEX idx_txn_contact ON transactions(tenant_id, contact_id);
CREATE INDEX idx_txn_status ON transactions(tenant_id, status);
CREATE INDEX idx_txn_invoice_status ON transactions(tenant_id, invoice_status) WHERE txn_type = 'invoice';
```

### Journal Lines (Double-Entry Core)

```sql
CREATE TABLE journal_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id),
  debit DECIMAL(19,4) DEFAULT 0,
  credit DECIMAL(19,4) DEFAULT 0,
  description TEXT,
  -- Line item fields (for invoices, cash sales)
  quantity DECIMAL(12,4),
  unit_price DECIMAL(19,4),
  is_taxable BOOLEAN DEFAULT FALSE,
  tax_rate DECIMAL(5,4) DEFAULT 0,
  tax_amount DECIMAL(19,4) DEFAULT 0,
  line_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  -- Constraint: debit or credit must be > 0, not both
  CONSTRAINT chk_debit_credit CHECK (
    (debit > 0 AND credit = 0) OR (debit = 0 AND credit > 0)
  )
);

CREATE INDEX idx_jl_transaction ON journal_lines(transaction_id);
CREATE INDEX idx_jl_account ON journal_lines(tenant_id, account_id);
CREATE INDEX idx_jl_tenant ON journal_lines(tenant_id);
```

### Tags

```sql
CREATE TABLE tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  name VARCHAR(100) NOT NULL,
  color VARCHAR(7),  -- hex color
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, name)
);

CREATE TABLE transaction_tags (
  transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (transaction_id, tag_id)
);
```

### Attachments

```sql
CREATE TABLE attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_size INT,
  mime_type VARCHAR(100),
  -- Polymorphic association
  attachable_type VARCHAR(50) NOT NULL,  -- 'transaction' | 'contact'
  attachable_id UUID NOT NULL,
  -- Receipt OCR
  ocr_status VARCHAR(20),  -- 'pending' | 'complete' | 'failed' | NULL
  ocr_vendor VARCHAR(255),
  ocr_date DATE,
  ocr_total DECIMAL(19,4),
  ocr_tax DECIMAL(19,4),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_attach_tenant ON attachments(tenant_id);
CREATE INDEX idx_attach_ref ON attachments(attachable_type, attachable_id);
```

### Banking

```sql
CREATE TABLE bank_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  account_id UUID NOT NULL REFERENCES accounts(id),  -- linked COA bank/CC account
  provider VARCHAR(50) DEFAULT 'plaid',
  provider_account_id VARCHAR(255),  -- Plaid account_id
  provider_item_id VARCHAR(255),     -- Plaid item_id
  access_token_encrypted TEXT,
  institution_name VARCHAR(255),
  mask VARCHAR(10),                  -- last 4 digits
  last_sync_at TIMESTAMPTZ,
  sync_status VARCHAR(20) DEFAULT 'active', -- 'active' | 'error' | 'disconnected'
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE bank_feed_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  bank_connection_id UUID NOT NULL REFERENCES bank_connections(id),
  provider_transaction_id VARCHAR(255), -- Plaid transaction_id (dedup key)
  feed_date DATE NOT NULL,
  description VARCHAR(500),
  amount DECIMAL(19,4) NOT NULL,       -- positive = debit/spend, negative = credit/deposit (Plaid convention)
  category VARCHAR(255),                -- Plaid category
  -- Review status
  status VARCHAR(20) DEFAULT 'pending', -- 'pending' | 'matched' | 'categorized' | 'excluded'
  matched_transaction_id UUID REFERENCES transactions(id),
  -- AI suggestion
  suggested_account_id UUID REFERENCES accounts(id),
  suggested_contact_id UUID REFERENCES contacts(id),
  confidence_score DECIMAL(3,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, provider_transaction_id)
);

CREATE INDEX idx_bfi_tenant ON bank_feed_items(tenant_id);
CREATE INDEX idx_bfi_status ON bank_feed_items(tenant_id, status);
CREATE INDEX idx_bfi_date ON bank_feed_items(tenant_id, feed_date);
```

### Bank Reconciliation

```sql
CREATE TABLE reconciliations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  account_id UUID NOT NULL REFERENCES accounts(id),
  statement_date DATE NOT NULL,
  statement_ending_balance DECIMAL(19,4) NOT NULL,
  beginning_balance DECIMAL(19,4) NOT NULL,
  cleared_balance DECIMAL(19,4),
  difference DECIMAL(19,4),
  status VARCHAR(20) DEFAULT 'in_progress', -- 'in_progress' | 'complete'
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE reconciliation_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reconciliation_id UUID NOT NULL REFERENCES reconciliations(id) ON DELETE CASCADE,
  journal_line_id UUID NOT NULL REFERENCES journal_lines(id),
  is_cleared BOOLEAN DEFAULT FALSE,
  cleared_at TIMESTAMPTZ
);
```

### Recurring Transactions

```sql
CREATE TABLE recurring_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  template_transaction_id UUID NOT NULL REFERENCES transactions(id),
  frequency VARCHAR(20) NOT NULL,     -- 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annually' | 'custom'
  interval_value INT DEFAULT 1,       -- every N [frequency units]
  mode VARCHAR(20) DEFAULT 'auto',    -- 'auto' | 'reminder'
  start_date DATE NOT NULL,
  end_date DATE,                      -- NULL = indefinite
  next_occurrence DATE NOT NULL,
  last_posted_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Audit Trail

```sql
CREATE TABLE audit_log (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL,
  user_id UUID,
  action VARCHAR(20) NOT NULL,        -- 'create' | 'update' | 'delete' | 'void' | 'login'
  entity_type VARCHAR(50) NOT NULL,   -- 'transaction' | 'account' | 'contact' | etc.
  entity_id UUID,
  before_data JSONB,
  after_data JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_tenant ON audit_log(tenant_id);
CREATE INDEX idx_audit_entity ON audit_log(tenant_id, entity_type, entity_id);
CREATE INDEX idx_audit_date ON audit_log(tenant_id, created_at);
```

### Email Templates

```sql
CREATE TABLE email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  template_type VARCHAR(50) NOT NULL, -- 'invoice_sent' | 'payment_received' | 'payment_reminder'
  subject VARCHAR(500) NOT NULL,
  body TEXT NOT NULL,                 -- Supports {{variables}}
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Invoice Templates

```sql
CREATE TABLE invoice_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  name VARCHAR(100) NOT NULL,
  logo_url VARCHAR(500),
  accent_color VARCHAR(7) DEFAULT '#2563EB',
  show_ship_to BOOLEAN DEFAULT FALSE,
  show_po_number BOOLEAN DEFAULT FALSE,
  show_terms BOOLEAN DEFAULT TRUE,
  footer_text TEXT,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## API Routes

All routes prefixed with `/api/v1`. All require authentication unless noted. Tenant scoping is automatic via middleware.

### Auth
```
POST   /auth/register          # Create tenant + first user (no auth required)
POST   /auth/login             # Returns JWT access + refresh token (no auth required)
POST   /auth/refresh           # Refresh access token (no auth required, needs refresh token)
POST   /auth/logout            # Invalidate refresh token
POST   /auth/forgot-password   # Send reset email (no auth required)
POST   /auth/reset-password    # Reset with token (no auth required)
GET    /auth/me                # Current user profile
```

### Company
```
GET    /company                # Get company profile
PUT    /company                # Update company profile
POST   /company/logo           # Upload logo (multipart)
GET    /company/settings       # Get all settings
PUT    /company/settings       # Update settings
```

### Accounts (COA)
```
GET    /accounts               # List all accounts (filterable: type, active, search)
POST   /accounts               # Create account
GET    /accounts/:id           # Get single account
PUT    /accounts/:id           # Update account
DELETE /accounts/:id           # Deactivate account (soft delete, blocked if system)
POST   /accounts/import        # Import from CSV
GET    /accounts/export        # Export to CSV
POST   /accounts/merge         # Merge two accounts
GET    /accounts/:id/ledger    # Get all journal lines for account (paginated)
```

### Contacts
```
GET    /contacts               # List contacts (filterable: type, active, search)
POST   /contacts               # Create contact
GET    /contacts/:id           # Get single contact
PUT    /contacts/:id           # Update contact
DELETE /contacts/:id           # Deactivate contact (soft delete)
POST   /contacts/import        # Import from CSV
GET    /contacts/export        # Export to CSV
POST   /contacts/merge         # Merge duplicates
GET    /contacts/:id/transactions  # Transaction history for contact
```

### Transactions
```
GET    /transactions           # List transactions (filterable: type, date range, status, contact, account, tag)
POST   /transactions           # Create transaction (body includes journal_lines)
GET    /transactions/:id       # Get transaction with lines, attachments, tags
PUT    /transactions/:id       # Update transaction (recalculates journal lines)
DELETE /transactions/:id       # Void transaction (creates reversing entry)
POST   /transactions/:id/void  # Explicit void with reason
POST   /transactions/:id/duplicate  # Clone a transaction
```

### Invoicing (extends transactions)
```
POST   /invoices               # Create invoice
GET    /invoices               # List invoices (filterable: status, customer, date)
GET    /invoices/:id           # Get invoice detail
PUT    /invoices/:id           # Update draft invoice
POST   /invoices/:id/send      # Send invoice via email, sets status to 'sent'
POST   /invoices/:id/payment   # Record payment against invoice
POST   /invoices/:id/remind    # Send payment reminder
GET    /invoices/:id/pdf       # Generate and return PDF
POST   /invoices/:id/void      # Void invoice

POST   /estimates              # Create estimate
GET    /estimates              # List estimates
GET    /estimates/:id          # Get estimate detail
PUT    /estimates/:id          # Update estimate
POST   /estimates/:id/convert  # Convert estimate to invoice
POST   /estimates/:id/send     # Send estimate via email
GET    /estimates/:id/pdf      # Generate PDF
```

### Banking
```
# Bank connections
GET    /bank-connections                # List connections
POST   /bank-connections/link-token    # Get Plaid link token
POST   /bank-connections               # Exchange public token, create connection
DELETE /bank-connections/:id           # Disconnect
POST   /bank-connections/:id/sync      # Manual sync trigger

# Bank feed
GET    /bank-feed                      # List feed items (filterable: status, connection, date)
PUT    /bank-feed/:id/categorize       # Categorize as new transaction
PUT    /bank-feed/:id/match            # Match to existing transaction
PUT    /bank-feed/:id/exclude          # Mark as excluded
POST   /bank-feed/bulk-approve         # Bulk approve selected items
POST   /bank-feed/import               # Manual CSV/OFX/QFX upload

# Reconciliation
GET    /reconciliations                # List past reconciliations for an account
POST   /reconciliations               # Start new reconciliation
GET    /reconciliations/:id            # Get reconciliation with clearable lines
PUT    /reconciliations/:id/lines      # Update cleared status of lines
POST   /reconciliations/:id/complete   # Finalize reconciliation
POST   /reconciliations/:id/undo       # Undo last reconciliation
GET    /reconciliations/:id/report     # Get reconciliation report PDF
```

### Reports
```
GET    /reports/profit-loss            # P&L (query: start_date, end_date, basis)
GET    /reports/balance-sheet          # Balance sheet (query: as_of_date, basis)
GET    /reports/cash-flow              # Cash flow statement
GET    /reports/ar-aging-summary       # AR aging summary
GET    /reports/ar-aging-detail        # AR aging detail
GET    /reports/customer-balance-summary
GET    /reports/customer-balance-detail
GET    /reports/invoice-list
GET    /reports/expense-by-vendor
GET    /reports/expense-by-category
GET    /reports/vendor-balance-summary
GET    /reports/transaction-list-by-vendor
GET    /reports/bank-reconciliation-summary
GET    /reports/deposit-detail
GET    /reports/check-register         # Query: account_id
GET    /reports/sales-tax-liability
GET    /reports/taxable-sales-summary
GET    /reports/sales-tax-payments
GET    /reports/vendor-1099-summary
GET    /reports/general-ledger
GET    /reports/trial-balance
GET    /reports/transaction-list       # Universal filterable list
GET    /reports/journal-entry-report
GET    /reports/account-report         # Query: account_id

# All reports support: format=json|csv|pdf, date filters, cash/accrual toggle
```

### Tags
```
GET    /tags                           # List all tags
POST   /tags                           # Create tag
PUT    /tags/:id                       # Update tag
DELETE /tags/:id                       # Delete tag
```

### Attachments
```
POST   /attachments                    # Upload file (multipart, body: attachable_type, attachable_id)
GET    /attachments                    # List attachments (filterable)
GET    /attachments/:id                # Get attachment metadata
GET    /attachments/:id/download       # Download file
DELETE /attachments/:id                # Delete attachment
POST   /attachments/:id/ocr           # Trigger OCR processing
POST   /attachments/:id/match         # Match receipt to transaction
```

### Recurring Schedules
```
GET    /recurring                      # List recurring schedules
POST   /recurring                      # Create recurring schedule from transaction
PUT    /recurring/:id                  # Update schedule
DELETE /recurring/:id                  # Deactivate schedule
POST   /recurring/:id/post-now        # Force post next occurrence
```

### Data Management
```
GET    /export/full                    # Full data export (CSV bundle zip)
GET    /audit-log                      # Paginated audit log (filterable)
```

---

## Phase 1 — Project Scaffolding & Auth

**Goal:** Runnable Docker dev environment, database up, user can register and log in.

### 1.1 Monorepo Setup
- [x] Initialize git repo with `README.md`, `.gitignore`, `LICENSE` (BSL 1.1)
- [x] Create monorepo structure with `packages/shared`, `packages/api`, `packages/web`, `packages/worker`
- [x] Set up root `package.json` with npm workspaces
- [x] Create root `tsconfig.base.json` with shared compiler options
- [x] Create `packages/shared/tsconfig.json`, `package.json`, `src/index.ts`
- [x] Create `packages/api/tsconfig.json`, `package.json`, `src/index.ts`
- [x] Create `packages/web/package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.tsx`
- [x] Create `packages/worker/tsconfig.json`, `package.json`, `src/index.ts`
- [x] Create `.env.example` with all required environment variables documented

### 1.2 Docker Compose
- [x] Create `docker-compose.yml` (production-like: api, web, db, redis)
- [x] Create `docker-compose.dev.yml` (override: hot-reload, exposed ports, volume mounts)
- [x] PostgreSQL 16 container with named volume for data persistence
- [x] Redis container for BullMQ
- [x] API container with Dockerfile (Node 20 Alpine)
- [x] Web container with Dockerfile (Node 20 Alpine, Vite dev server)
- [x] Worker container sharing API image, different entrypoint
- [x] Healthcheck definitions for db and redis
- [x] Verify `docker compose -f docker-compose.yml -f docker-compose.dev.yml up` starts all services

### 1.3 Database & ORM Setup
- [x] Install Drizzle ORM + `drizzle-kit` + `pg` driver in `packages/api`
- [x] Create `packages/api/src/db/index.ts` — Drizzle client with connection pool
- [x] Create `packages/api/src/config/env.ts` — typed env config with validation (Zod)
- [x] Create `drizzle.config.ts` for migration tooling
- [x] Create initial migration: `tenants`, `users`, `sessions` tables (exact schema from above)
- [x] Create migration script (`scripts/migrate.ts`) that runs on API startup
- [x] Verify migration runs clean on fresh database

### 1.4 Shared Package — Core Types & Schemas
- [x] Create `packages/shared/src/types/auth.ts` — `User`, `Session`, `LoginInput`, `RegisterInput`
- [x] Create `packages/shared/src/types/tenant.ts` — `Tenant`
- [x] Create `packages/shared/src/schemas/auth.ts` — Zod schemas for login, register, password reset
- [x] Create `packages/shared/src/utils/money.ts` — `toMinorUnits()`, `fromMinorUnits()`, `formatCurrency()`, `Decimal` wrapper
- [x] Create `packages/shared/src/utils/dates.ts` — date formatting, fiscal year helpers
- [x] Export everything from `packages/shared/src/index.ts`

### 1.5 API Skeleton
- [x] Install Express, cors, helmet, morgan, compression, express-async-errors
- [x] Create `packages/api/src/app.ts` — Express app with middleware stack
- [x] Create `packages/api/src/index.ts` — server startup (run migrations, listen)
- [x] Create `packages/api/src/middleware/error-handler.ts` — global error handler with typed errors
- [x] Create `packages/api/src/middleware/validate.ts` — Zod validation middleware factory
- [x] Create `packages/api/src/middleware/tenant.ts` — extract tenant_id from JWT, attach to req
- [x] Create `packages/api/src/middleware/auth.ts` — JWT verification middleware
- [x] Create `packages/api/src/middleware/audit.ts` — audit trail logging middleware/helper
- [x] Create `packages/api/src/utils/errors.ts` — `AppError` class with status codes
- [x] Verify API starts and returns 200 on `GET /health`

### 1.6 Auth Implementation
- [x] Create `packages/api/src/services/auth.service.ts`:
  - `register(input)` — create tenant + company + user, hash password, return tokens
  - `login(email, password)` — verify credentials, return tokens
  - `refresh(refreshToken)` — issue new access token
  - `logout(refreshToken)` — delete session
  - `forgotPassword(email)` — generate reset token, send email (stub email for now)
  - `resetPassword(token, newPassword)` — verify token, update password
- [x] Create `packages/api/src/routes/auth.routes.ts` — all auth endpoints
- [x] JWT access token: 15min expiry, contains `{ userId, tenantId, role }`
- [x] Refresh token: 7-day expiry, stored hashed in `sessions` table
- [x] Write Vitest tests for auth service (register, login, token refresh, logout)
- [x] Verify complete auth flow via curl/Postman

### 1.7 Frontend Skeleton
- [x] Install React 18, React Router v6, TanStack Query, Tailwind CSS, clsx, lucide-react
- [x] Configure Tailwind with sensible defaults, color palette, dark mode support
- [x] Create `packages/web/src/api/client.ts` — fetch wrapper with auth header injection, token refresh logic
- [x] Create `packages/web/src/api/hooks/useAuth.ts` — login, register, logout mutations
- [x] Create `packages/web/src/components/ui/Button.tsx`
- [x] Create `packages/web/src/components/ui/Input.tsx`
- [x] Create `packages/web/src/components/ui/Card.tsx`
- [x] Create `packages/web/src/components/ui/LoadingSpinner.tsx`
- [x] Create `packages/web/src/components/ui/ErrorMessage.tsx`
- [x] Create `packages/web/src/components/layout/AuthLayout.tsx` — centered card layout for login/register
- [x] Create `packages/web/src/components/layout/AppShell.tsx` — sidebar + header + main content area
- [x] Create `packages/web/src/components/layout/Sidebar.tsx` — navigation links (placeholder items)
- [x] Create `packages/web/src/features/auth/LoginPage.tsx`
- [x] Create `packages/web/src/features/auth/RegisterPage.tsx`
- [x] Create `packages/web/src/features/auth/ForgotPasswordPage.tsx`
- [x] Create `packages/web/src/App.tsx` — routes with auth guard (redirect to login if no token)
- [x] Create protected route wrapper component
- [x] Verify: user can register, login, see empty dashboard shell, logout

### 1.8 Phase 1 Ship Gate
- [x] Docker compose up starts all services cleanly
- [x] User can register a new account (creates tenant + company + user)
- [x] User can log in, sees authenticated app shell with sidebar
- [x] User can log out
- [x] JWT refresh works transparently
- [x] All auth endpoints have Vitest tests passing
- [x] QUESTIONS.md reviewed and resolved

---

## Phase 2 — Company Setup & Chart of Accounts

**Goal:** User can configure their company, manage chart of accounts.

### 2.1 Company Setup
- [x] Create migration: `companies` table
- [x] Create `packages/shared/src/types/company.ts` — `Company`, `CompanySettings`, `UpdateCompanyInput`
- [x] Create `packages/shared/src/schemas/company.ts` — Zod schemas
- [x] Create `packages/api/src/db/schema/company.ts` — Drizzle schema
- [x] Create `packages/api/src/services/company.service.ts` — get, update, uploadLogo
- [x] Create `packages/api/src/routes/company.routes.ts` — GET/PUT endpoints
- [x] Logo upload: accept multipart, save to `/data/uploads/logos/`, store path in company record
- [x] Write Vitest tests for company service
- [x] Create `packages/web/src/features/company/CompanyProfilePage.tsx` — form with all fields from §1.1 of proposal
- [x] Create `packages/web/src/features/settings/SettingsPage.tsx` — form with all fields from §1.2 of proposal
- [x] Logo upload component with preview
- [x] Add sidebar navigation links: Settings > Company Profile, Settings > Preferences

### 2.2 Chart of Accounts — Schema & API
- [x] Create migration: `accounts` table (exact schema above)
- [x] Create `packages/shared/src/types/accounts.ts` — `Account`, `AccountType`, `CreateAccountInput`, `UpdateAccountInput`
- [x] Create `packages/shared/src/schemas/accounts.ts` — Zod schemas
- [x] Create `packages/shared/src/constants/coa-templates.ts`:
  - Default template (generic small business)
  - Service business template
  - Retail template
  - Freelancer/consultant template
  - Each template: array of `{ name, accountNumber, accountType, detailType, isSystem, systemTag }`
  - System accounts present in ALL templates: Accounts Receivable, Payments Clearing, Retained Earnings, Opening Balances, Cash on Hand
- [x] Create `packages/api/src/db/schema/accounts.ts` — Drizzle schema
- [x] Create `packages/api/src/services/accounts.service.ts`:
  - `list(tenantId, filters)` — with search, type filter, active filter
  - `getById(tenantId, id)`
  - `create(tenantId, input)` — validate uniqueness of account number
  - `update(tenantId, id, input)` — block name change on system accounts
  - `deactivate(tenantId, id)` — block if system account, block if has balance
  - `seedFromTemplate(tenantId, templateName)` — called during registration
  - `importFromCsv(tenantId, csvData)` — parse and bulk insert
  - `exportToCsv(tenantId)` — generate CSV string
  - `merge(tenantId, sourceId, targetId)` — re-point all journal_lines, deactivate source
  - `getAccountLedger(tenantId, accountId, filters)` — paginated journal lines
- [x] Create `packages/api/src/routes/accounts.routes.ts` — all account endpoints
- [x] Write Vitest tests for accounts service (CRUD, seed, import, merge, system account protection)

### 2.3 Chart of Accounts — Frontend
- [x] Create `packages/web/src/features/accounts/AccountsListPage.tsx`:
  - Table with columns: Number, Name, Type, Detail Type, Balance, Status
  - Filters: account type dropdown, active/inactive toggle, search box
  - Action buttons: New Account, Import CSV, Export CSV
  - Inline active/inactive toggle
  - Click row to edit
- [x] Create `packages/web/src/features/accounts/AccountFormModal.tsx`:
  - Fields: name, account number (optional), account type (dropdown), detail type (dropdown, filtered by type), description, parent account (optional dropdown)
  - System accounts: show read-only badge, disable delete button
  - Create and Edit modes
- [x] Create `packages/web/src/features/accounts/AccountImportModal.tsx` — CSV upload with preview and mapping
- [x] Create `packages/web/src/features/accounts/MergeAccountsModal.tsx` — select source and target
- [x] Create `packages/web/src/api/hooks/useAccounts.ts` — React Query hooks for all account operations
- [x] Add "Chart of Accounts" to sidebar navigation
- [x] Verify COA seeded on registration based on industry selection

### 2.4 Company Setup Wizard (First Run)
- [x] Create `packages/web/src/features/company/SetupWizard.tsx`:
  - Step 1: Business info (name, entity type, industry)
  - Step 2: Fiscal year, accounting method
  - Step 3: Review seeded COA, option to customize
  - Step 4: Done — redirect to dashboard
- [x] Show wizard automatically after first registration (check `company.setup_complete` flag)
- [x] Add `setup_complete BOOLEAN DEFAULT FALSE` to companies table (new migration)

### 2.5 Phase 2 Ship Gate
- [x] Company profile fully editable with logo upload
- [x] COA seeded from template at registration time
- [x] All account CRUD operations work (create, edit, deactivate, merge)
- [x] System accounts cannot be deleted
- [x] CSV import and export work for COA
- [x] Setup wizard runs on first login
- [x] All Vitest tests passing
- [x] QUESTIONS.md reviewed and resolved

---

## Phase 3 — Contacts

**Goal:** Full customer and vendor management.

### 3.1 Contacts — Schema & API
- [x] Create migration: `contacts` table (exact schema above)
- [x] Create `packages/shared/src/types/contacts.ts` — `Contact`, `ContactType`, `CreateContactInput`, `UpdateContactInput`
- [x] Create `packages/shared/src/schemas/contacts.ts` — Zod schemas
- [x] Create `packages/api/src/db/schema/contacts.ts` — Drizzle schema
- [x] Create `packages/api/src/services/contacts.service.ts`:
  - `list(tenantId, filters)` — paginated, filterable by type, active, search
  - `getById(tenantId, id)`
  - `create(tenantId, input)`
  - `update(tenantId, id, input)`
  - `deactivate(tenantId, id)`
  - `importFromCsv(tenantId, csvData, contactType)`
  - `exportToCsv(tenantId, contactType?)`
  - `merge(tenantId, sourceId, targetId)` — re-point all transactions, deactivate source
  - `getTransactionHistory(tenantId, contactId, pagination)` — all transactions linked to contact
- [x] Create `packages/api/src/routes/contacts.routes.ts` — all contact endpoints
- [x] Write Vitest tests for contacts service

### 3.2 Contacts — Frontend
- [x] Create `packages/web/src/features/contacts/ContactsListPage.tsx`:
  - Tab bar: All | Customers | Vendors
  - Table: Name, Type, Email, Phone, Balance, Status
  - Search, active filter
  - New Contact, Import, Export buttons
- [x] Create `packages/web/src/features/contacts/ContactFormPage.tsx`:
  - Full form with all fields from §3.1 and §3.2 of proposal
  - Contact type selector (Customer, Vendor, Both)
  - Conditional sections: shipping address (customers), tax ID / 1099 (vendors)
  - Default payment terms (customers), default expense account (vendors)
- [x] Create `packages/web/src/features/contacts/ContactDetailPage.tsx`:
  - Summary card (name, type, contact info)
  - Transaction history table (linked transactions, chronological)
  - Edit button, deactivate button
- [x] Create `packages/web/src/features/contacts/ContactImportModal.tsx` — CSV upload
- [x] Create `packages/web/src/features/contacts/MergeContactsModal.tsx`
- [x] Create `packages/web/src/api/hooks/useContacts.ts` — React Query hooks
- [x] Add "Customers" and "Vendors" to sidebar navigation

### 3.3 Phase 3 Ship Gate
- [x] Full contact CRUD for customers, vendors, and dual-type contacts
- [x] CSV import/export for contacts
- [x] Merge duplicate contacts
- [x] Contact detail page shows transaction history (empty for now — transactions built in Phase 4)
- [x] All Vitest tests passing
- [x] QUESTIONS.md reviewed and resolved

---

## Phase 4 — Transaction Engine (Double-Entry Core)

**Goal:** All transaction types can be created, and the double-entry ledger is correct.

### 4.1 Transaction & Journal Lines — Schema & API
- [x] Create migration: `transactions`, `journal_lines`, `tags`, `transaction_tags` tables
- [x] Create `packages/shared/src/types/transactions.ts`:
  - `Transaction`, `JournalLine`, `TxnType`, `TxnStatus`
  - `CreateTransactionInput` (includes `lines: JournalLineInput[]`)
  - Specialized inputs: `CreateInvoiceInput`, `CreateExpenseInput`, `CreateJournalEntryInput`, etc.
- [x] Create `packages/shared/src/schemas/transactions.ts`:
  - Validate debits = credits for journal entries
  - Validate required fields per txn_type
  - Validate monetary amounts > 0
- [x] Create `packages/api/src/db/schema/transactions.ts` — Drizzle schema
- [x] Create `packages/api/src/db/schema/journal-lines.ts` — Drizzle schema
- [x] Create `packages/api/src/services/ledger.service.ts` — **core double-entry engine**:
  - `postTransaction(tenantId, input)`:
    1. Validate debits = credits
    2. Insert transaction row
    3. Insert journal_lines
    4. Update running balances on affected accounts
    5. Create audit log entry
    6. Return complete transaction with lines
  - `voidTransaction(tenantId, txnId, reason)`:
    1. Mark original as void
    2. Create reversing journal_lines (swap debits/credits)
    3. Update account balances
    4. Audit log
  - `updateTransaction(tenantId, txnId, input)`:
    1. Reverse original lines (internal)
    2. Apply new lines
    3. Recalculate balances
  - `getAccountBalance(tenantId, accountId, asOfDate?, basis?)` — sum journal_lines
  - `validateBalance(tenantId)` — sum all debits = sum all credits across all accounts
- [x] Write Vitest tests for ledger service:
  - [x] Simple journal entry (2 lines) posts correctly
  - [x] Multi-line journal entry posts correctly
  - [x] Debits != credits is rejected
  - [x] Void creates correct reversing entries
  - [x] Account balances update correctly after post
  - [x] Account balances update correctly after void
  - [x] Cash basis vs accrual basis balance calculation

### 4.2 Transaction Type Services
- [x] Create `packages/api/src/services/invoice.service.ts`:
  - `createInvoice(tenantId, input)` — builds journal lines (DR: AR, CR: Revenue per line item), calculates tax, sets invoice_status = 'draft'
  - `sendInvoice(tenantId, invoiceId)` — update status to 'sent', queue email
  - `recordPayment(tenantId, invoiceId, paymentInput)` — creates customer_payment transaction (DR: Payments Clearing/Bank, CR: AR), updates invoice amount_paid and balance_due, sets status to 'partial' or 'paid'
  - `voidInvoice(tenantId, invoiceId, reason)`
  - `duplicateInvoice(tenantId, invoiceId)`
  - `getInvoice(tenantId, invoiceId)` — with lines, payments, customer
- [x] Create `packages/api/src/services/expense.service.ts`:
  - `createExpense(tenantId, input)` — builds journal lines (DR: Expense account, CR: Bank/CC)
- [x] Create `packages/api/src/services/cash-sale.service.ts`:
  - `createCashSale(tenantId, input)` — (DR: Payments Clearing/Bank, CR: Revenue), tax
- [x] Create `packages/api/src/services/deposit.service.ts`:
  - `createDeposit(tenantId, input)` — (DR: Bank, CR: Payments Clearing/Other), supports grouping multiple pending payments
- [x] Create `packages/api/src/services/transfer.service.ts`:
  - `createTransfer(tenantId, input)` — (DR: Bank to, CR: Bank from)
- [x] Create `packages/api/src/services/credit-memo.service.ts`:
  - `createCreditMemo(tenantId, input)` — (DR: Revenue, CR: AR)
- [x] Create `packages/api/src/services/customer-refund.service.ts`:
  - `createCustomerRefund(tenantId, input)` — (DR: Revenue, CR: Bank/Payments Clearing)
- [x] Create `packages/api/src/services/journal-entry.service.ts`:
  - `createJournalEntry(tenantId, input)` — freeform debit/credit lines
- [x] Create `packages/api/src/routes/transactions.routes.ts` — all transaction endpoints
- [x] Create `packages/api/src/routes/invoices.routes.ts` — invoice-specific endpoints
- [x] Create `packages/api/src/routes/estimates.routes.ts` — estimate endpoints
- [x] Write Vitest tests for each transaction type service

### 4.3 Tags
- [x] Create `packages/api/src/services/tags.service.ts` — CRUD
- [x] Create `packages/api/src/routes/tags.routes.ts`
- [x] Tag assignment during transaction create/update

### 4.4 Transaction Frontend — Journal Entry & Expense
- [x] Create `packages/web/src/features/transactions/TransactionListPage.tsx`:
  - Table: Date, Type, Number, Contact, Memo, Amount, Status
  - Filters: type, date range, status, contact, account, tag
  - Paginated
- [x] Create `packages/web/src/features/transactions/JournalEntryForm.tsx`:
  - Date, memo
  - Dynamic line rows: Account (dropdown), Description, Debit, Credit
  - Running total: Total Debits, Total Credits, Difference
  - Cannot save unless difference = 0
  - Add line / remove line buttons
- [x] Create `packages/web/src/features/transactions/ExpenseForm.tsx`:
  - Date, payee (vendor dropdown with create-new), account paid from (bank/CC), expense account, amount, memo
  - Tags
- [x] Create `packages/web/src/features/transactions/TransferForm.tsx`:
  - Date, from account, to account, amount, memo
- [x] Create `packages/web/src/features/transactions/DepositForm.tsx`:
  - Date, deposit to (bank), line items from Payments Clearing or freeform
- [x] Create `packages/web/src/features/transactions/CashSaleForm.tsx`:
  - Customer, date, line items (like invoice but posts immediately)
- [x] Create `packages/web/src/features/transactions/TransactionDetail.tsx`:
  - Read-only view of any transaction with its journal lines
  - Edit / Void / Duplicate buttons
- [x] Create `packages/web/src/components/forms/AccountSelector.tsx` — searchable dropdown with type filter
- [x] Create `packages/web/src/components/forms/ContactSelector.tsx` — searchable dropdown with create-new
- [x] Create `packages/web/src/components/forms/TagSelector.tsx` — multi-select with create-new
- [x] Create `packages/web/src/components/forms/MoneyInput.tsx` — formatted currency input, decimal(19,4) precision
- [x] Create `packages/web/src/components/forms/DatePicker.tsx`
- [x] Create `packages/web/src/api/hooks/useTransactions.ts` — React Query hooks
- [x] Add "Transactions" to sidebar navigation

### 4.5 Estimate Frontend
- [x] Create `packages/web/src/features/invoicing/EstimateForm.tsx`:
  - Same line-item structure as invoice
  - Status: Draft → Sent → Accepted → Rejected → Converted
- [x] Create `packages/web/src/features/invoicing/EstimateListPage.tsx`
- [x] Convert-to-invoice action button

### 4.6 Phase 4 Ship Gate
- [x] All 9 transaction types create correct journal_lines
- [x] Debits always equal credits on every transaction
- [x] Account running balances update correctly
- [x] Void transactions create proper reversing entries
- [x] Transaction list page with filtering works
- [x] Journal entry form enforces debit/credit balance
- [x] Expense, transfer, deposit, cash sale forms work
- [x] Estimates can be created and converted to invoices
- [x] Tags can be assigned to transactions
- [x] `ledger.validateBalance()` passes (total debits = total credits)
- [x] All Vitest tests passing
- [x] QUESTIONS.md reviewed and resolved

---

## Phase 5 — Invoicing

**Goal:** Full invoice lifecycle — create, customize, send, receive payment, PDF generation.

### 5.1 Invoice PDF Generation
- [x] Create `packages/api/src/services/pdf.service.ts`:
  - `generateInvoicePdf(tenantId, invoiceId)` — produces PDF buffer
  - Uses company logo, accent color, template settings
  - Renders: company info, customer info, line items table, subtotal, tax, total, payment terms, due date, footer
  - Returns Buffer for download or email attachment
- [x] Create invoice PDF template (React PDF or HTML→Puppeteer)
- [x] Store generated PDFs in `/data/generated/invoices/` (cached, regenerate on edit)
- [x] GET `/invoices/:id/pdf` returns PDF with correct Content-Type headers

### 5.2 Invoice Email
- [x] Create `packages/api/src/services/email.service.ts`:
  - `sendInvoice(tenantId, invoiceId)` — send email with PDF attachment
  - `sendPaymentReminder(tenantId, invoiceId)` — reminder email
  - `sendPaymentConfirmation(tenantId, paymentId)` — receipt email
  - Uses Nodemailer with configurable SMTP (from .env)
  - Template rendering with {{company_name}}, {{customer_name}}, {{invoice_number}}, {{amount_due}}, {{due_date}}
- [x] Create `packages/api/src/db/schema/email-templates.ts`
- [x] Seed default email templates on company creation
- [x] Create email template editor in settings (Phase 2 stretch — for now, use defaults)

### 5.3 Invoice Template Customization
- [x] Create migration: `invoice_templates` table
- [x] Create `packages/api/src/services/invoice-template.service.ts` — CRUD
- [x] Create `packages/web/src/features/invoicing/InvoiceTemplateEditor.tsx`:
  - Logo upload
  - Accent color picker
  - Toggle fields: ship-to, PO number, terms
  - Footer text
  - Live preview
  - Save as default

### 5.4 Invoice Frontend
- [x] Create `packages/web/src/features/invoicing/InvoiceForm.tsx`:
  - Customer selector (auto-fills billing address, terms)
  - Invoice number (auto-generated, editable)
  - Date, due date (auto-calc from terms)
  - Line items: Description, Qty, Rate, Amount, Account, Tax toggle
  - Subtotal, tax total, grand total (live calculation)
  - Memo to customer, internal notes
  - Attach files
  - Save as Draft / Save and Send buttons
- [x] Create `packages/web/src/features/invoicing/InvoiceListPage.tsx`:
  - Table: Number, Customer, Date, Due Date, Status, Total, Balance Due
  - Status badge (draft/sent/partial/paid/void/overdue)
  - Filters: status, customer, date range
  - Quick actions: Send, Record Payment, Download PDF, Duplicate, Void
- [x] Create `packages/web/src/features/invoicing/InvoiceDetailPage.tsx`:
  - Full invoice preview (styled like PDF)
  - Payment history table
  - Action buttons: Send, Record Payment, Download PDF, Void, Duplicate
  - Timeline: created → sent → viewed → partial → paid
- [x] Create `packages/web/src/features/invoicing/RecordPaymentModal.tsx`:
  - Amount (pre-filled with balance due), date, deposit-to account, payment method, memo
  - Partial payment support
- [x] Create `packages/web/src/features/invoicing/SendInvoiceModal.tsx`:
  - To email (pre-filled from customer), subject, message (from template), attach PDF preview
- [x] Add "Invoices" and "Estimates" to sidebar navigation

### 5.5 Phase 5 Ship Gate
- [x] Invoice full lifecycle works: Draft → Send (email) → Record Payment (partial + full) → Paid
- [x] PDF generation produces professional-looking invoice with company branding
- [x] Email delivery works via SMTP
- [x] Invoice template customization (logo, color, footer, field toggles)
- [x] Estimate → Invoice conversion works
- [x] Void creates reversing entries
- [x] Duplicate invoice works
- [x] Invoice list with status filtering
- [x] All Vitest tests passing
- [x] QUESTIONS.md reviewed and resolved

---

## Phase 6 — Reports

**Goal:** All reports from §7 of the proposal are functional.

### 6.1 Report Engine
- [x] Create `packages/api/src/services/report.service.ts` — base report engine:
  - `buildProfitAndLoss(tenantId, startDate, endDate, basis)` — aggregate revenue - expenses
  - `buildBalanceSheet(tenantId, asOfDate, basis)` — assets = liabilities + equity
  - `buildCashFlowStatement(tenantId, startDate, endDate)`
  - `buildARAgingSummary(tenantId, asOfDate)` — bucket open invoices by age
  - `buildARAgingDetail(tenantId, asOfDate)` — line-by-line
  - `buildCustomerBalanceSummary(tenantId)`
  - `buildCustomerBalanceDetail(tenantId)`
  - `buildInvoiceList(tenantId, filters)`
  - `buildExpenseByVendor(tenantId, startDate, endDate)`
  - `buildExpenseByCategory(tenantId, startDate, endDate)`
  - `buildVendorBalanceSummary(tenantId)`
  - `buildTransactionListByVendor(tenantId, vendorId, dateRange)`
  - `buildBankReconciliationSummary(tenantId, accountId)`
  - `buildDepositDetail(tenantId, dateRange)`
  - `buildCheckRegister(tenantId, accountId, dateRange)`
  - `buildSalesTaxLiability(tenantId, startDate, endDate)` — aggregate tax on invoices/cash sales
  - `buildTaxableSalesSummary(tenantId, startDate, endDate)`
  - `buildSalesTaxPayments(tenantId, startDate, endDate)`
  - `build1099VendorSummary(tenantId, year)`
  - `buildGeneralLedger(tenantId, startDate, endDate)`
  - `buildTrialBalance(tenantId, asOfDate)`
  - `buildTransactionList(tenantId, filters)`
  - `buildJournalEntryReport(tenantId, dateRange)`
  - `buildAccountReport(tenantId, accountId, dateRange)`
- [x] Each report returns a typed JSON structure
- [x] Cash vs accrual: accrual = all posted transactions; cash = only transactions where cash account is involved
- [x] Create `packages/api/src/routes/reports.routes.ts` — all report endpoints
- [x] All report endpoints accept `format` query param: `json` (default), `csv`, `pdf`

### 6.2 Report CSV/PDF Export
- [x] Create `packages/api/src/services/report-export.service.ts`:
  - `toCsv(reportData, columns)` — generic CSV serializer
  - `toPdf(reportData, template)` — generic report PDF generator
- [x] Report PDF template: header with company name/logo, report title, date range, data table, footer with page numbers
- [x] CSV export with proper escaping and headers

### 6.3 Report Frontend
- [x] Create `packages/web/src/features/reports/ReportShell.tsx` — shared layout: date range picker, basis toggle, filters, export buttons, drill-down handler
- [x] Create `packages/web/src/features/reports/ReportTable.tsx` — generic data table with:
  - Sortable columns
  - Clickable amounts (drill-down to transaction list)
  - Subtotals and totals rows
  - Hierarchical indent (for COA-structured reports)
- [x] Create `packages/web/src/features/reports/DateRangePicker.tsx` — presets (This Month, This Quarter, This Year, Last Year, Custom) + custom date inputs
- [x] Create individual report pages (one component per report, using ReportShell + ReportTable):
  - [x] `ProfitAndLossReport.tsx`
  - [x] `BalanceSheetReport.tsx`
  - [x] `CashFlowReport.tsx` (via GenericReport)
  - [x] `ARAgingSummaryReport.tsx` (via GenericReport)
  - [x] `ARAgingDetailReport.tsx` (via GenericReport)
  - [x] `CustomerBalanceSummary.tsx` (via GenericReport)
  - [x] `CustomerBalanceDetail.tsx` (via GenericReport)
  - [x] `InvoiceListReport.tsx` (via GenericReport)
  - [x] `ExpenseByVendorReport.tsx` (via GenericReport)
  - [x] `ExpenseByCategoryReport.tsx` (via GenericReport)
  - [x] `VendorBalanceSummary.tsx` (via GenericReport)
  - [x] `TransactionsByVendorReport.tsx` (via GenericReport)
  - [x] `BankReconciliationSummary.tsx` (via GenericReport)
  - [x] `DepositDetailReport.tsx` (via GenericReport)
  - [x] `CheckRegisterReport.tsx` (via GenericReport)
  - [x] `SalesTaxLiabilityReport.tsx` (via GenericReport)
  - [x] `TaxableSalesSummary.tsx` (via GenericReport)
  - [x] `SalesTaxPaymentsReport.tsx` (via GenericReport)
  - [x] `Vendor1099Summary.tsx` (via GenericReport)
  - [x] `GeneralLedgerReport.tsx` (via GenericReport)
  - [x] `TrialBalanceReport.tsx` (via GenericReport)
  - [x] `TransactionListReport.tsx` (via GenericReport)
  - [x] `JournalEntryReport.tsx` (via GenericReport)
  - [x] `AccountReport.tsx` (via GenericReport)
- [x] Drill-down: clicking any amount navigates to filtered transaction list
- [x] Export buttons: CSV, Excel (via CSV), PDF
- [x] Add "Reports" section to sidebar with grouped sub-items:
  - Financial Statements: P&L, Balance Sheet, Cash Flow
  - Receivables: AR Aging, Customer Balances, Invoice List
  - Expenses: By Vendor, By Category, Vendor Balances
  - Banking: Reconciliation, Deposits, Check Register
  - Tax: Sales Tax Liability, Taxable Sales, Sales Tax Payments, 1099 Summary
  - General: General Ledger, Trial Balance, Transaction List, Journal Entries

### 6.4 Phase 6 Ship Gate
- [x] P&L and Balance Sheet produce correct numbers (manually verified against test data)
- [x] Cash vs accrual toggle changes report output correctly
- [x] AR Aging buckets are correct
- [x] All 24 report types return data
- [x] Drill-down from report amounts to underlying transactions works
- [x] CSV and PDF export work for all reports
- [x] All Vitest tests passing
- [x] QUESTIONS.md reviewed and resolved

---

## Phase 7 — Banking

**Goal:** Bank feed import (CSV + Plaid), transaction matching, reconciliation.

### 7.1 Bank Connections & Feed — Schema & API
- [x] Create migration: `bank_connections`, `bank_feed_items` tables
- [x] Create `packages/shared/src/types/banking.ts` — all banking types
- [x] Create `packages/api/src/services/bank-connection.service.ts`:
  - `createLinkToken(tenantId)` — Plaid link token
  - `exchangePublicToken(tenantId, publicToken, metadata)` — create connection
  - `sync(tenantId, connectionId)` — pull new transactions from Plaid
  - `disconnect(tenantId, connectionId)`
- [x] Create `packages/api/src/services/bank-feed.service.ts`:
  - `list(tenantId, filters)` — pending, matched, categorized, excluded
  - `categorize(tenantId, feedItemId, input)` — create transaction from feed item
  - `match(tenantId, feedItemId, transactionId)` — link to existing transaction
  - `exclude(tenantId, feedItemId)` — mark excluded
  - `bulkApprove(tenantId, feedItemIds)` — approve multiple categorized items
  - `importFromFile(tenantId, accountId, fileBuffer, format)` — CSV/OFX/QFX parser
  - `suggestCategorization(tenantId, feedItem)` — AI suggestion based on history
- [x] Create `packages/api/src/routes/banking.routes.ts` — all banking endpoints
- [x] Create CSV parser for bank statements (date, description, amount columns — configurable mapping)
- [x] Create OFX/QFX parser (XML-based format, common bank export)
- [x] Write Vitest tests

### 7.2 AI Categorization
- [x] Create `packages/api/src/services/categorization-ai.service.ts`:
  - Lookup payee name in past transactions for same tenant
  - If exact or fuzzy match found, suggest same account + contact
  - Confidence score: 1.0 = exact payee match, 0.8 = fuzzy match, 0.5 = category-based guess
  - Store suggestion in bank_feed_items (suggested_account_id, suggested_contact_id, confidence_score)
- [x] Run AI suggestion on each new bank feed item import (batch process)

### 7.3 Bank Reconciliation — Schema & API
- [x] Create migration: `reconciliations`, `reconciliation_lines` tables
- [x] Create `packages/api/src/services/reconciliation.service.ts`:
  - `start(tenantId, accountId, statementDate, endingBalance)` — create reconciliation, load uncleared lines
  - `getReconciliation(tenantId, reconciliationId)` — with clearable lines
  - `updateLines(tenantId, reconciliationId, lines)` — batch update cleared status
  - `complete(tenantId, reconciliationId)` — validate difference = 0, finalize
  - `undo(tenantId, reconciliationId)` — revert to in_progress, unmark cleared
  - `getHistory(tenantId, accountId)` — past reconciliations
  - `generateReport(tenantId, reconciliationId)` — summary report data
- [x] Write Vitest tests for reconciliation

### 7.4 Banking — Frontend
- [x] Create `packages/web/src/features/banking/BankConnectionsPage.tsx`:
  - List connected accounts with status, last sync, institution name
  - "Connect Bank" button → Plaid Link
  - Manual import button (CSV/OFX)
  - Sync now / Disconnect buttons
- [x] Create `packages/web/src/features/banking/BankFeedPage.tsx`:
  - Table: Date, Description, Amount, Suggested Category, Status
  - For each pending item: Categorize / Match / Exclude action buttons
  - Categorize panel: account selector, contact selector (pre-filled from AI suggestion)
  - Match panel: searchable list of recorded transactions near the date/amount
  - Bulk select + Approve button
  - AI confidence indicator (checkmark = high confidence)
- [x] Create `packages/web/src/features/banking/BankImportModal.tsx`:
  - File upload (CSV, OFX, QFX)
  - For CSV: column mapping UI (date, description, amount, debit/credit)
  - Preview imported rows before confirm
- [x] Create `packages/web/src/features/banking/ReconciliationPage.tsx`:
  - Account selector, statement date, ending balance inputs
  - Table of transactions: Date, Type, Number, Description, Payment, Deposit, Cleared checkbox
  - Running totals: Statement Balance, Cleared Balance, Difference
  - Difference highlighted green when = $0
  - Complete Reconciliation button (disabled until difference = 0)
- [x] Create `packages/web/src/features/banking/ReconciliationHistoryPage.tsx`
- [x] Add "Banking" section to sidebar: Connections, Bank Feed, Reconcile

### 7.5 Phase 7 Ship Gate
- [x] CSV bank import works with column mapping
- [x] OFX/QFX import works
- [x] Plaid connection flow works (or stubbed with mock data if no Plaid keys)
- [x] Bank feed items can be categorized, matched, or excluded
- [x] AI categorization suggests accounts for known payees
- [x] Bulk approve works
- [x] Bank reconciliation: start, clear items, complete when balanced
- [x] Undo reconciliation works
- [x] Reconciliation report generated
- [x] All Vitest tests passing
- [x] QUESTIONS.md reviewed and resolved

---

## Phase 8 — Dashboard

**Goal:** Home dashboard with financial snapshot, cash position, receivables, and action items.

### 8.1 Dashboard API
- [x] Create `packages/api/src/services/dashboard.service.ts`:
  - `getFinancialSnapshot(tenantId)` — net income, revenue, expenses (current month + YTD)
  - `getRevExpTrend(tenantId, months)` — monthly revenue vs expense for last N months
  - `getCashPosition(tenantId)` — balances for all bank + CC accounts
  - `getReceivablesSummary(tenantId)` — total outstanding, overdue count + amount, aging buckets
  - `getActionItems(tenantId)` — pending bank feed count, overdue invoices, stale reconciliations
- [x] Create `packages/api/src/routes/dashboard.routes.ts`

### 8.2 Dashboard Frontend
- [x] Create `packages/web/src/features/dashboard/DashboardPage.tsx`:
  - **Financial Snapshot cards:** Net Income, Revenue, Expenses (MTD + YTD)
  - **Revenue vs Expense chart:** Bar or line chart (recharts), last 6–12 months
  - **Cash Position card:** Bank balances list, CC balances list
  - **Receivables card:** Outstanding total, overdue total, mini aging donut chart
  - **Action Items card:**
    - Bank feed items to review (count, link to bank feed)
    - Overdue invoices (count, link to invoice list filtered)
    - Reconciliation status per account (days since last reconciliation)
- [x] Create chart components using recharts
- [x] Make dashboard the default landing page after login
- [x] Dashboard data refreshes on navigation to page (not polling)

### 8.3 Phase 8 Ship Gate
- [x] Dashboard loads with correct financial data
- [x] Revenue vs Expense chart renders correctly
- [x] Cash position shows real bank/CC balances
- [x] Receivables summary matches AR aging report
- [x] Action items link to correct filtered views
- [x] QUESTIONS.md reviewed and resolved

---

## Phase 9 — Attachments, Receipt Capture & Recurring Transactions

**Goal:** File attachments on transactions/contacts, receipt OCR, recurring transaction scheduling.

### 9.1 Attachments
- [x] Create migration: `attachments` table
- [x] Create `packages/api/src/services/attachment.service.ts`:
  - `upload(tenantId, file, attachableType, attachableId)` — save file, create record
  - `list(tenantId, filters)` — global library view
  - `download(tenantId, attachmentId)` — stream file
  - `delete(tenantId, attachmentId)` — remove file + record
  - File size validation (max 10MB configurable)
- [x] Create `packages/api/src/routes/attachments.routes.ts` — multipart upload endpoint
- [x] Files stored at `/data/uploads/attachments/{tenant_id}/{uuid}.{ext}`
- [x] Create `packages/web/src/features/attachments/AttachmentUploader.tsx` — drag-and-drop zone
- [x] Create `packages/web/src/features/attachments/AttachmentList.tsx` — thumbnail/list of attached files
- [x] Create `packages/web/src/features/attachments/AttachmentLibraryPage.tsx` — browse all attachments
- [x] Integrate attachments into transaction forms and contact detail pages

### 9.2 Receipt Capture & OCR
- [x] Create `packages/api/src/services/ocr.service.ts`:
  - `processReceipt(tenantId, attachmentId)` — extract vendor, date, total, tax from image
  - Use LLM vision API (Anthropic Claude) or Tesseract as fallback
  - Update attachment record with OCR results
  - Set `ocr_status` = 'complete' or 'failed'
- [x] Create `packages/worker/src/processors/ocr.processor.ts` — BullMQ job processor
- [x] On receipt upload, enqueue OCR job
- [x] Create `packages/web/src/features/attachments/ReceiptCaptureModal.tsx`:
  - Upload receipt image
  - Show OCR results (vendor, date, total, tax) — editable
  - "Match to Transaction" or "Create New Expense" buttons
  - Status indicator: Processing → Complete → Matched/Unmatched

### 9.3 Recurring Transactions
- [x] Create migration: `recurring_schedules` table
- [x] Create `packages/api/src/services/recurring.service.ts`:
  - `create(tenantId, templateTransactionId, schedule)` — create schedule from existing transaction
  - `list(tenantId)` — all active schedules with next occurrence
  - `update(tenantId, scheduleId, input)` — change frequency, dates, mode
  - `deactivate(tenantId, scheduleId)`
  - `postNext(tenantId, scheduleId)` — manually post next occurrence
  - `processAllDue()` — called by cron job, posts all auto-mode schedules where next_occurrence <= today
- [x] Create `packages/worker/src/processors/recurring.processor.ts` — scheduled job (daily)
- [x] Create `packages/api/src/routes/recurring.routes.ts`
- [x] Create `packages/web/src/features/transactions/RecurringScheduleModal.tsx`:
  - Frequency, interval, start date, end date, mode (auto/reminder)
  - Preview next 5 occurrences
- [x] Create `packages/web/src/features/transactions/RecurringListPage.tsx`:
  - Table: Transaction, Frequency, Next Occurrence, Mode, Status
  - Post Now / Edit / Deactivate actions
- [x] Add "Recurring" to sidebar navigation

### 9.4 Phase 9 Ship Gate
- [x] Files can be attached to any transaction and any contact
- [x] Attachment library shows all uploaded files
- [x] Receipt upload triggers OCR, extracts vendor/date/total
- [x] OCR results can create new expense or match to existing transaction
- [x] Recurring transactions: create, list, auto-post on schedule, manual post
- [x] Daily worker job processes all due recurring transactions
- [x] All Vitest tests passing
- [x] QUESTIONS.md reviewed and resolved

---

## Phase 10 — Data Management & Audit Trail

**Goal:** Import/export, full data export, audit trail viewer.

### 10.1 Import Utilities
- [x] Create `packages/api/src/services/import.service.ts`:
  - `importCOA(tenantId, csvBuffer)` — validate and insert accounts (already done in Phase 2, wire up UI)
  - `importContacts(tenantId, csvBuffer, contactType)` — validate and insert
  - `importBankTransactions(tenantId, accountId, fileBuffer, format)` — CSV/OFX/QFX (already done in Phase 7, wire up)
  - `importOpeningBalances(tenantId, journalEntryData)` — create JE from balances
- [x] Opening balance import wizard: upload CSV with account names/numbers + balances, auto-generates JE

### 10.2 Export Utilities
- [x] Create `packages/api/src/services/export.service.ts`:
  - `fullExport(tenantId)` — generates ZIP containing CSVs: accounts.csv, contacts.csv, transactions.csv, journal_lines.csv, attachments list
  - Individual report exports already done in Phase 6
- [x] Create `packages/api/src/routes/export.routes.ts` — `GET /export/full`
- [x] Add export UI to settings page

### 10.3 Audit Trail Viewer
- [x] Create `packages/api/src/routes/audit.routes.ts`:
  - `GET /audit-log` — paginated, filterable by entity_type, entity_id, user, action, date range
- [x] Create `packages/web/src/features/settings/AuditLogPage.tsx`:
  - Table: Timestamp, User, Action, Entity Type, Entity, Changes
  - Expandable row showing before/after JSON diff
  - Filters: action type, entity type, date range, search
  - Export to CSV
- [x] Add "Audit Log" to sidebar under Settings

### 10.4 Database Backup Script
- [x] Create `scripts/backup.sh`:
  - `pg_dump` with encryption (gpg)
  - Timestamped filename
  - Retention: keep last 30 daily backups
  - Can be called from within Docker container
- [x] Document backup/restore procedure in README

### 10.5 Phase 10 Ship Gate
- [x] Opening balance import wizard works
- [x] Full data export produces valid ZIP with all CSVs
- [x] Audit trail captures all create/update/delete/void actions
- [x] Audit log viewer with filtering and diff view
- [x] Backup script works
- [x] QUESTIONS.md reviewed and resolved

---


## Phase 11 — First-Run Setup & Deployment Bootstrapping

**Goal:** A non-technical user can go from `docker compose up` to a fully configured, running application with zero manual `.env` editing, no command-line password generation, and no database administration.

### 11.1 Setup Detection & Routing

The application must detect whether it has been configured on every startup and route accordingly.

- [x] Create `packages/api/src/services/setup.service.ts`:
  - `getSetupStatus()` — returns an object describing what is and isn't configured:
    - `envFileExists: boolean` — `.env` file present in the expected location
    - `databaseReachable: boolean` — can connect to PostgreSQL
    - `databaseInitialized: boolean` — migrations have been applied (check for `tenants` table existence)
    - `hasAdminUser: boolean` — at least one user row exists
    - `smtpConfigured: boolean` — SMTP env vars are non-empty
    - `setupComplete: boolean` — all critical items are true
  - `generateSecurePassword(length: number)` — crypto.randomBytes-based generator
  - `generateJwtSecret()` — 64-byte hex string
  - `writeEnvFile(config: SetupConfig)` — writes `.env` to the data volume
  - `testDatabaseConnection(config: DbConfig)` — attempt connection with provided credentials
  - `testSmtpConnection(config: SmtpConfig)` — send test email to admin
  - `initializeDatabase()` — run all migrations
  - `createAdminUser(input: CreateAdminInput)` — create tenant + company + first user
- [x] Create `packages/api/src/routes/setup.routes.ts`:
  - `GET /api/setup/status` — returns setup status (no auth required)
  - `POST /api/setup/generate-secrets` — returns generated passwords/secrets (no auth required, only works if setup incomplete)
  - `POST /api/setup/test-database` — test DB connection with provided config (no auth required, only works if setup incomplete)
  - `POST /api/setup/test-smtp` — test SMTP connection (no auth required, only works if setup incomplete)
  - `POST /api/setup/initialize` — write .env, run migrations, create admin (no auth required, only works if setup incomplete)
  - **Security: All setup endpoints return 403 once setup is complete.** The setup API self-destructs after successful initialization.
- [x] API startup logic updated:
  - On boot, check `getSetupStatus()`
  - If `setupComplete = false`, serve only the setup routes + static setup wizard UI
  - If `setupComplete = true`, serve the full application normally
  - Log clear console messages: `⚙️  First-run setup required. Open http://localhost:3000/setup to begin.`

### 11.2 CLI Bootstrap Script (Advanced Users)

For users who prefer command-line setup or headless/automated deployments.

- [x] Create `scripts/setup.ts` — interactive CLI setup script (runs with `npx ts-node scripts/setup.ts` or `docker exec kisbooks-api node scripts/setup.js`):
  - Step 1: **Generate secrets** — auto-generate and display:
    - PostgreSQL password
    - Redis password (if auth enabled)
    - JWT secret
    - Backup encryption key
  - Step 2: **Database configuration** — prompt for or accept defaults:
    - Host (default: `db` for Docker, `localhost` for bare metal)
    - Port (default: `5432`)
    - Database name (default: `kisbooks`)
    - Username (default: `kisbooks`)
    - Password (auto-generated or user-provided)
    - Test connection before proceeding
  - Step 3: **Redis configuration** — prompt or defaults:
    - Host (default: `redis`)
    - Port (default: `6379`)
    - Password (optional)
  - Step 4: **SMTP configuration** (optional, can skip):
    - Host, port, username, password, from address
    - Send test email to verify
  - Step 5: **Application settings:**
    - App URL (default: `http://localhost:3000`)
    - File upload max size (default: 10MB)
  - Step 6: **Admin account creation:**
    - Email address
    - Password (auto-generated with option to customize)
    - Display name
  - Step 7: **Write configuration:**
    - Generate `.env` file with all values
    - Run database migrations
    - Seed system data
    - Create admin user
    - Print summary with all generated credentials
    - Print clear warning: "Save these credentials now — they will not be shown again."
  - Step 8: **Verification:**
    - Start health check against the configured services
    - Confirm API responds on configured port
    - Print success message with login URL
- [x] Create `scripts/generate-secrets.ts` — standalone script that only generates and prints secrets (useful for CI/CD pipelines)
- [x] Create `scripts/reset-admin-password.ts` — emergency password reset script:
  - Requires direct database access (runs inside the container)
  - Prompts for new password, hashes and updates
  - Logs the action to audit trail

### 11.3 Web-Based Setup Wizard

The primary first-run experience for non-technical users.

- [x] Create `packages/web/src/features/setup/SetupWizard.tsx` — full-page wizard (no app shell, standalone layout):
  - **Step 1: Welcome**
    - "Welcome to KIS Books" hero message
    - Brief explanation: "Let's get your bookkeeping system set up. This takes about 2 minutes."
    - "Get Started" button
  - **Step 2: Database**
    - For Docker deployments: pre-filled with internal Docker hostnames, auto-generated password
    - For bare-metal: editable fields for host, port, database, username, password
    - "Test Connection" button with real-time status indicator (spinner → green check or red X with error message)
    - Auto-generates PostgreSQL password with "Regenerate" button
    - Copy-to-clipboard button on generated password
  - **Step 3: Security**
    - JWT secret: auto-generated, shown as masked field with reveal toggle
    - Backup encryption key: auto-generated
    - "Regenerate All" button
    - Explanation text: "These secrets secure your data. Save them somewhere safe — you'll need them if you move your installation."
    - Downloadable `credentials.txt` file with all generated secrets
  - **Step 4: Email (Optional)**
    - Toggle: "Configure email now" / "Skip — I'll set this up later"
    - If configuring: SMTP host, port, username, password, from address
    - "Send Test Email" button — prompts for recipient, sends a test
    - Common provider presets dropdown: Gmail, Outlook/365, Amazon SES, SendGrid, Custom
    - When a preset is selected, auto-fill host/port/TLS settings
    - Skip text: "You can configure email later in Settings. Without email, you'll need to manually share invoice PDFs."
  - **Step 5: Admin Account**
    - Email address (validated format)
    - Display name
    - Password with strength meter (minimum 12 characters, or auto-generate)
    - "Generate Strong Password" button
    - Confirm password field
  - **Step 6: Company Quick Setup**
    - Business name (required)
    - Industry dropdown (determines COA template)
    - Entity type dropdown
    - "You can fill in the rest later in Settings."
  - **Step 7: Review & Confirm**
    - Summary of all configured values (passwords masked with reveal toggle)
    - Downloadable credentials file (`.txt`) containing:
      - Database password
      - Redis password
      - JWT secret
      - Backup encryption key
      - Admin email and password (if auto-generated)
      - App URL
    - Checkbox: "I have saved my credentials securely"
    - "Complete Setup" button (disabled until checkbox is checked)
  - **Step 8: Finalizing** (progress screen)
    - Animated progress steps with real-time status:
      - ✅ Writing configuration...
      - ✅ Connecting to database...
      - ✅ Running migrations...
      - ✅ Seeding chart of accounts...
      - ✅ Creating admin account...
      - ✅ Verifying installation...
    - On error: show which step failed, display error message, offer "Retry" button
    - On success: "Setup Complete!" with "Go to Dashboard" button
- [x] Create `packages/web/src/features/setup/components/PasswordGenerator.tsx`:
  - Generate button
  - Strength meter (zxcvbn or similar)
  - Copy to clipboard
  - Reveal/hide toggle
- [x] Create `packages/web/src/features/setup/components/ConnectionTester.tsx`:
  - Reusable component for testing DB and SMTP connections
  - States: idle → testing (spinner) → success (green check) → failed (red X + error text)
- [x] Create `packages/web/src/features/setup/components/CredentialDownload.tsx`:
  - Generates a plain text file with all credentials
  - Triggers browser download
  - Warns user this is the only time credentials are shown in the clear
- [x] Create `packages/web/src/features/setup/components/SmtpPresets.tsx`:
  - Dropdown with common providers
  - Auto-fills host, port, TLS config
  - Presets: Gmail (`smtp.gmail.com:587`), Outlook (`smtp-mail.outlook.com:587`), Amazon SES, SendGrid (`smtp.sendgrid.net:587`), Mailgun, Custom
- [x] Frontend routing: if `GET /api/setup/status` returns `setupComplete: false`, redirect all routes to `/setup`

### 11.4 Docker-Specific Bootstrapping

- [x] Update `docker-compose.yml`:
  - PostgreSQL container uses `POSTGRES_PASSWORD_FILE` pointing to a Docker secret, OR falls back to env var
  - Add `kisbooks-setup` profile: `docker compose --profile setup run setup` for CLI-only environments
  - Entrypoint script for API container:
    1. Check if `.env` exists in `/data/config/.env`
    2. If not, print setup instructions and start in setup-only mode
    3. If yes, source `.env`, run migrations, start full application
- [x] Create `scripts/docker-entrypoint.sh`:
  ```
  #!/bin/sh
  CONFIG_FILE="/data/config/.env"
  if [ ! -f "$CONFIG_FILE" ]; then
    echo "============================================="
    echo "  KIS Books — First-Run Setup Required"
    echo "============================================="
    echo ""
    echo "  Open http://localhost:3000/setup in your browser"
    echo "  or run: docker exec -it kisbooks-api node scripts/setup.js"
    echo ""
    echo "============================================="
    node dist/index.js --setup-mode
  else
    set -a; source "$CONFIG_FILE"; set +a
    node dist/index.js
  fi
  ```
- [x] Ensure generated `.env` is written to a mounted Docker volume (`/data/config/`) so it persists across container restarts
- [x] Auto-generate `docker-compose.override.yml` during setup that injects the database password into the PostgreSQL container's environment (so db and api stay in sync)
- [x] Create `scripts/factory-reset.sh`:
  - Stops containers
  - Removes `.env` from data volume
  - Drops and recreates database
  - Prints: "Factory reset complete. Restart to begin setup again."
  - Requires confirmation prompt: "This will DELETE ALL DATA. Type 'RESET' to confirm."

### 11.5 Post-Setup Configuration Changes

Users need to be able to change configuration after initial setup without re-running the wizard.

- [x] Create `packages/web/src/features/settings/SystemSettingsPage.tsx` (admin only):
  - **SMTP Settings:** edit host/port/user/pass/from, test connection
  - **Backup Settings:** encryption key (masked), backup schedule (if automated)
  - **Application URL:** update the base URL
  - **File Storage:** upload size limit
  - These write to the `.env` file and flag the API for graceful restart
  - **Excluded from this page:** Database credentials, JWT secret (too dangerous to change from UI — require CLI)
- [x] Create `packages/api/src/services/system-settings.service.ts`:
  - `getEditableSettings()` — returns non-sensitive config values
  - `updateSettings(input)` — validates, updates `.env`, reloads config in-memory
  - Sensitive values (DB password, JWT secret) cannot be changed via API — only via CLI script
- [x] Add "System" section to sidebar under Settings (visible only to owner role)

### 11.6 Phase 11 Ship Gate
- [x] `docker compose up` on a fresh system (no .env, empty database) boots into setup mode
- [x] Console prints clear instructions pointing to the setup URL
- [x] Web setup wizard completes successfully: generates all secrets, configures DB, creates admin, seeds COA
- [x] Credentials download file contains all generated passwords and secrets
- [x] After setup completes, setup endpoints return 403 (self-destruct)
- [x] App redirects from `/setup` to `/login` after setup is complete
- [x] CLI setup script (`scripts/setup.ts`) works as an alternative to the web wizard
- [x] `scripts/reset-admin-password.ts` successfully resets an admin password
- [x] `scripts/factory-reset.sh` wipes all data and returns to first-run state
- [x] SMTP presets auto-fill correctly for Gmail, Outlook, SendGrid
- [x] SMTP test email sends successfully during setup
- [x] Database connection test works during setup
- [x] Post-setup: SMTP settings can be changed from the System Settings page
- [x] Generated `.env` persists across container restarts (Docker volume)
- [x] All Vitest tests passing
- [x] QUESTIONS.md reviewed and resolved

---


## Phase 12 — Polish, Testing & Packaging

**Goal:** End-to-end tests, production Docker image, documentation.

### 12.1 End-to-End Tests (Playwright)
- [x] Install and configure Playwright
- [x] E2E: Register → Setup Wizard → Complete
- [x] E2E: Create account → Verify in COA list
- [x] E2E: Create customer → Create invoice → Send → Record payment → Verify paid
- [x] E2E: Create expense → Verify in transaction list and P&L report
- [x] E2E: Import bank CSV → Categorize items → Reconcile
- [x] E2E: Generate P&L and Balance Sheet → Verify totals → Export PDF
- [x] E2E: Create recurring invoice → Verify next occurrence → Manual post
- [x] E2E: Upload receipt → OCR → Create expense → Verify attachment linked

### 12.2 Production Docker Build
- [x] Create `Dockerfile` (production multi-stage build):
  - Stage 1: Build API + shared
  - Stage 2: Build Web (Vite production build)
  - Stage 3: Runtime — Node 20 Alpine, serve API + static web assets
- [x] Create production `docker-compose.yml`:
  - Single app container (API serves static web), db, redis
  - Environment variable configuration
  - Volume mounts for data persistence (uploads, generated files)
  - Automatic migrations on startup
- [x] Health check endpoint returns db/redis status
- [x] Create `.env.production.example`

### 12.3 Documentation
- [x] Write `README.md`:
  - Project overview, screenshots
  - Quick start (docker compose up)
  - Configuration (environment variables)
  - Architecture overview
  - Development setup
  - Contributing guide
- [x] Write `docs/DEPLOYMENT.md` — production deployment guide
- [x] Write `docs/BACKUP.md` — backup and restore procedures
- [x] Write `docs/API.md` — API reference (auto-generated from route definitions)
- [x] Add LICENSE file (BSL 1.1, Apache 2.0 conversion after 4 years)

### 12.4 UI Polish
- [x] Responsive layout testing (mobile, tablet, desktop)
- [x] Empty states for all list pages (friendly illustrations/messages)
- [x] Loading skeletons on all data-fetching pages
- [x] Error boundaries with retry buttons
- [x] Toast notifications for success/error actions
- [x] Keyboard shortcuts: Ctrl+N (new transaction), Ctrl+S (save), Esc (close modal)
- [x] Sidebar collapse/expand on mobile
- [x] Consistent color palette and typography throughout
- [x] Favicon and app title

### 12.5 Phase 11 Ship Gate
- [x] All Playwright E2E tests pass
- [x] Production Docker image builds and runs cleanly
- [x] `docker compose up` from clean state: db initializes, migrations run, app loads, user can register
- [x] README and docs are complete
- [x] UI is responsive and polished
- [x] **FULL SHIP GATE:** A user can set up a company, manage COA, create contacts, enter transactions, invoice clients, import bank data, reconcile, and generate all reports from a single Docker container.

---

## Phase 13 (Future) — Gusto Integration, Accountant Access, Online Payments

> These are Phase 2 features per the proposal. Do not build until Phases 1–11 are complete and stable.

### 13.1 Gusto Payroll Integration
- [ ] Apply for Gusto API production keys (start early — up to 2 months)
- [ ] Implement OAuth2 connection flow
- [ ] Payroll sync service: pull runs, generate journal entries
- [ ] Contractor payment sync
- [ ] Account mapping wizard
- [ ] Sync management UI

### 13.2 Accountant Access
- [ ] Multi-user support: invite accountant by email
- [ ] Role-based permissions: owner (full), accountant (read + JE write)
- [ ] Accountant portal: multi-company view

### 13.3 Online Payment Acceptance
- [ ] Stripe integration for invoice payments
- [ ] Payment link on PDF invoices
- [ ] Webhook handler for payment confirmation
- [ ] Auto-record payment on webhook receipt

---

## Seed Data Reference

### Default COA Template (Generic Small Business)

```
1000  Cash on Hand              asset     bank                    SYSTEM
1010  Business Checking         asset     bank
1020  Business Savings          asset     bank
1100  Accounts Receivable       asset     accounts_receivable     SYSTEM(accounts_receivable)
1200  Payments Clearing         asset     other_current_asset     SYSTEM(payments_clearing)
1300  Prepaid Expenses          asset     other_current_asset
1500  Office Equipment          asset     fixed_asset
1510  Accum. Depreciation       asset     fixed_asset
2000  Accounts Payable          liability accounts_payable
2100  Credit Card               liability credit_card
2200  Sales Tax Payable         liability other_current_liability
2300  Payroll Liabilities       liability other_current_liability
2900  Line of Credit            liability long_term_liability
3000  Opening Balances          equity    opening_balance         SYSTEM(opening_balances)
3100  Owner's Equity            equity    owners_equity
3200  Owner's Draw              equity    owners_equity
3900  Retained Earnings         equity    retained_earnings       SYSTEM(retained_earnings)
4000  Service Revenue           revenue   service
4100  Product Revenue           revenue   sales_of_product
4200  Other Revenue             revenue   other_income
5000  Cost of Goods Sold        expense   cost_of_goods_sold
5100  Contract Labor            expense   other_cost_of_service
6000  Advertising               expense   advertising
6100  Bank Charges & Fees       expense   bank_charges
6200  Insurance                 expense   insurance
6300  Meals & Entertainment     expense   meals_entertainment
6400  Office Supplies           expense   office_supplies
6500  Professional Fees         expense   legal_professional
6600  Rent or Lease             expense   rent_or_lease
6700  Repairs & Maintenance     expense   repairs_maintenance
6800  Telephone & Internet      expense   utilities
6900  Travel                    expense   travel
7000  Utilities                 expense   utilities
7100  Wages & Salaries          expense   payroll_expenses
7200  Payroll Tax Expense       expense   payroll_expenses
7500  Depreciation Expense      expense   other_expense
7900  Miscellaneous Expense     expense   other_expense
8000  Interest Income           revenue   interest_earned
8100  Interest Expense          expense   other_expense
```

---

## QUESTIONS.md Template

```markdown
# QUESTIONS.md — KIS Books Build

| # | Phase | Question | Assumption Made | Resolved? | Resolution |
|---|-------|----------|-----------------|-----------|------------|
| 1 | — | — | — | — | — |
```

Log any ambiguity here during build. Do not block on questions — make the simplest reasonable assumption, document it, and continue.
