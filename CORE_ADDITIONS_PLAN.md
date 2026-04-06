# KIS Books — Core Bookkeeping Additions Feature Plan

**Features:** Automatic year-end closing, bank rules (exportable), comparative reports, duplicate detection, backup/restore UI, enhanced audit trail, simple budgets
**Date:** April 2, 2026
**Depends on:** BUILD_PLAN.md Phases 1–10 (full MVP)
**Integrates with:** Reports, Banking, Dashboard, Settings, Account Register

---

## 1. Automatic Year-End Closing

### Overview

QuickBooks handles year-end closing transparently — there's no manual closing entry. When a report spans a fiscal year boundary, the system automatically computes Retained Earnings by netting all prior-year income and expense balances. The user never sees a closing journal entry; it just works.

KIS Books will replicate this approach. Year-end closing happens automatically at report time — the user never sees a closing journal entry.

### 1.1 How It Works

There is no physical closing entry posted to the ledger. Instead:

**For Balance Sheet reports:**
- As-of dates on or after the fiscal year start: revenue and expense account balances from all prior fiscal years are netted and added to the Retained Earnings balance automatically
- This is computed at report time, not stored as a transaction

**For Profit & Loss reports:**
- Reports only show activity within the selected date range
- If the date range spans fiscal year boundaries, prior-year income/expense is excluded (the P&L resets at the fiscal year start)

**The calculation (run at report time):**

```sql
-- Auto-closing amount for Retained Earnings on the Balance Sheet
-- Computed for all fiscal years that ended BEFORE the report's as-of date

SELECT 
  COALESCE(SUM(CASE WHEN a.account_type = 'revenue' THEN jl.credit - jl.debit ELSE 0 END), 0)
  - COALESCE(SUM(CASE WHEN a.account_type = 'expense' THEN jl.debit - jl.credit ELSE 0 END), 0)
  AS retained_earnings_adjustment
FROM journal_lines jl
JOIN transactions t ON jl.transaction_id = t.id
JOIN accounts a ON jl.account_id = a.id
WHERE jl.tenant_id = $1
  AND a.account_type IN ('revenue', 'expense')
  AND t.status != 'void'
  AND t.txn_date < $2  -- fiscal year start date of the reporting period
```

This adjustment is added to the Retained Earnings account balance on every Balance Sheet report. It is never posted as a transaction.

### 1.2 Build Checklist — Year-End Closing

- [ ] Update `packages/api/src/services/report.service.ts`:
  - `buildBalanceSheet()` — add automatic retained earnings adjustment for all completed fiscal years prior to the report date
  - Compute fiscal year boundaries from `companies.fiscal_year_start_month`
  - Net income/expense balances for each completed prior year and add to Retained Earnings line
- [ ] Write Vitest tests:
  - [ ] Balance sheet includes retained earnings adjustment for completed prior year
  - [ ] Balance sheet with no prior-year data shows $0 adjustment
  - [ ] Multi-year: 3 fiscal years of data, retained earnings accumulates correctly
  - [ ] P&L resets at fiscal year boundary (does not include prior-year amounts)

---

## 2. Bank Rules (with Export/Import)

### Overview

User-defined rules that automatically categorize bank feed transactions. When a new bank feed item arrives, the system checks it against the user's rules before falling back to AI categorization. Rules provide deterministic, instant categorization for known recurring transactions.

### 2.1 Data Model

```sql
CREATE TABLE bank_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  name VARCHAR(255) NOT NULL,
  priority INT DEFAULT 0,                    -- higher = evaluated first
  is_active BOOLEAN DEFAULT TRUE,
  -- Conditions (ALL must match)
  apply_to VARCHAR(10) NOT NULL DEFAULT 'both',  -- 'deposits' | 'expenses' | 'both'
  bank_account_id UUID REFERENCES accounts(id),  -- NULL = applies to all bank accounts
  -- Condition fields (NULL = don't check this field)
  description_contains VARCHAR(255),          -- case-insensitive substring match
  description_exact VARCHAR(255),             -- exact match (case-insensitive)
  amount_equals DECIMAL(19,4),
  amount_min DECIMAL(19,4),
  amount_max DECIMAL(19,4),
  -- Actions (what to assign when rule matches)
  assign_account_id UUID REFERENCES accounts(id),
  assign_contact_id UUID REFERENCES contacts(id),
  assign_memo VARCHAR(500),
  assign_tag_ids UUID[],                     -- array of tag IDs to apply
  auto_confirm BOOLEAN DEFAULT FALSE,         -- if true, skip the review queue and post directly
  -- Metadata
  times_applied INT DEFAULT 0,
  last_applied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_br_tenant ON bank_rules(tenant_id);
CREATE INDEX idx_br_active ON bank_rules(tenant_id, is_active, priority DESC);
```

### 2.2 Rule Evaluation Logic

When a bank feed item is imported (from Plaid or CSV):

1. Fetch all active rules for the tenant, sorted by priority descending
2. For each rule, check all non-NULL conditions against the feed item:
   - `apply_to` matches the feed item direction (deposit or expense)
   - `bank_account_id` matches (or rule has NULL = any account)
   - `description_contains`: feed item description contains the substring (case-insensitive)
   - `description_exact`: feed item description equals the value (case-insensitive)
   - `amount_equals`: feed item amount matches exactly
   - `amount_min` / `amount_max`: feed item amount within range
3. First rule where ALL non-NULL conditions match wins
4. Apply the rule's actions: set suggested account, contact, memo, tags on the feed item
5. If `auto_confirm = true`, automatically create the transaction (no review needed)
6. If no rule matches, fall back to AI categorization
7. Increment `times_applied` and update `last_applied_at` on the matched rule

### 2.3 Export/Import Format

Rules export and import as CSV:

```csv
name,apply_to,bank_account,description_contains,description_exact,amount_equals,amount_min,amount_max,assign_account,assign_contact,assign_memo,assign_tags,auto_confirm,priority
"Amazon Purchases",expenses,,AMZN,,,,,"Office Supplies","Amazon",,,"false",100
"Monthly Rent",expenses,,"PROP MGMT",,2500.00,,,"Rent Expense","ABC Realty","Monthly office rent","rent,office","true",200
"Client Deposits",deposits,,"WIRE IN",,,,,"Service Revenue",,,,false,50
```

Account and contact columns use names (not IDs) for portability between tenants. On import, names are resolved to IDs with fuzzy matching and error reporting for unresolved names.

### 2.4 API Endpoints

```
GET    /api/v1/bank-rules               # List all rules (sorted by priority)
POST   /api/v1/bank-rules               # Create rule
GET    /api/v1/bank-rules/:id           # Get single rule with usage stats
PUT    /api/v1/bank-rules/:id           # Update rule
DELETE /api/v1/bank-rules/:id           # Delete rule
PUT    /api/v1/bank-rules/reorder       # Update priority ordering
POST   /api/v1/bank-rules/test          # Test a rule against a sample description/amount
GET    /api/v1/bank-rules/export        # Export all rules as CSV
POST   /api/v1/bank-rules/import        # Import rules from CSV
```

### 2.5 Frontend

- [ ] **Bank Rules Manager Page** (`packages/web/src/features/banking/BankRulesPage.tsx`):
  - Table: Priority (drag to reorder), Name, Conditions summary, Actions summary, Times Applied, Active toggle
  - "New Rule" button
  - "Import Rules" / "Export Rules" buttons
  - Search box

- [ ] **Rule Create/Edit Form** (modal or inline):
  - Name
  - Apply to: Deposits / Expenses / Both (radio)
  - Bank account: All accounts / specific account (dropdown)
  - **Conditions section:**
    - Description contains (text input)
    - Description exact match (text input)
    - Amount: equals / between min–max (radio + inputs)
  - **Actions section:**
    - Assign to account (account selector)
    - Assign payee/vendor (contact selector)
    - Set memo (text input)
    - Apply tags (tag selector)
    - Auto-confirm toggle (with warning: "Transactions matching this rule will post automatically without review")
  - "Test Rule" button — enter a sample description and amount, shows whether the rule would match

- [ ] **Import Rules Modal:**
  - CSV upload
  - Preview resolved rules (highlight any unresolved account/contact names in amber)
  - "Import N rules" button

- [ ] Add "Bank Rules" under Banking section in sidebar

### 2.6 Bank Feed Integration

- [ ] Update `packages/api/src/services/bank-feed.service.ts`:
  - On new feed item import, run rule evaluation before AI categorization
  - Rule match → set `suggested_account_id`, `suggested_contact_id`, `confidence_score = 1.0` (deterministic)
  - Auto-confirm rules → create transaction immediately, set feed item status = 'categorized'
  - No rule match → fall back to existing AI categorization logic

- [ ] Update bank feed UI:
  - Items matched by a rule show a "Rule: [rule name]" badge
  - Items auto-confirmed show as already categorized with rule attribution

### 2.7 Build Checklist — Bank Rules

- [ ] Create migration: `bank_rules` table
- [ ] Create `packages/shared/src/types/bank-rules.ts` — types and schemas
- [ ] Create `packages/api/src/services/bank-rules.service.ts` — CRUD, reorder, test, evaluate, export, import
- [ ] Create `packages/api/src/routes/bank-rules.routes.ts` — all endpoints
- [ ] Integrate rule evaluation into bank feed import pipeline (before AI)
- [ ] Implement CSV export with name-based columns
- [ ] Implement CSV import with name-to-ID resolution and fuzzy matching
- [ ] Create `BankRulesPage.tsx` with drag-to-reorder, CRUD, import/export
- [ ] Create rule form with conditions builder and test button
- [ ] Update bank feed UI with rule match badges
- [ ] Write Vitest tests:
  - [ ] Rule with description_contains matches correctly
  - [ ] Rule with amount range matches within range, rejects outside
  - [ ] Multiple conditions: all must match (AND logic)
  - [ ] Priority ordering: higher priority rule wins over lower
  - [ ] Auto-confirm rule creates transaction without review
  - [ ] No matching rule falls through to AI categorization
  - [ ] CSV export produces valid CSV with account/contact names
  - [ ] CSV import resolves names to IDs and creates rules
  - [ ] Import rejects rules with unresolvable required fields (account)

---

## 3. Comparative Reports

### Overview

Add period-over-period comparison columns to the P&L and Balance Sheet. Users can see how their numbers changed month-to-month, quarter-to-quarter, or year-to-year — with dollar and percentage change columns.

### 3.1 Comparison Modes

| Mode | Column Layout | Use Case |
|---|---|---|
| **Previous Period** | This Month \| Last Month \| $ Change \| % Change | Monthly review |
| **Previous Year** | This Period \| Same Period Last Year \| $ Change \| % Change | YoY seasonal comparison |
| **Year-to-Date vs Prior YTD** | Jan–Mar 2026 \| Jan–Mar 2025 \| $ Change \| % Change | Annual progress |
| **Multi-Period** | Jan \| Feb \| Mar \| Apr \| ... (up to 12 columns) | Trend spotting |
| **Budget vs Actual** | Actual \| Budget \| $ Variance \| % Variance | Budget tracking (see §7) |

### 3.2 API Changes

Update existing report endpoints with new query parameters:

```
GET /api/v1/reports/profit-loss?compare=previous_period
GET /api/v1/reports/profit-loss?compare=previous_year
GET /api/v1/reports/profit-loss?compare=ytd_vs_prior_ytd
GET /api/v1/reports/profit-loss?compare=multi_period&periods=12&period_type=month
GET /api/v1/reports/profit-loss?compare=budget
GET /api/v1/reports/balance-sheet?compare=previous_period
GET /api/v1/reports/balance-sheet?compare=previous_year
```

**New query parameters:**

| Param | Type | Default | Description |
|---|---|---|---|
| `compare` | enum | (none) | Comparison mode |
| `periods` | int | 2 | Number of periods for multi-period mode (max 12) |
| `period_type` | enum | `month` | Period granularity for multi-period: `month`, `quarter`, `year` |

**Response shape change:**

Standard report (no comparison):
```json
{
  "rows": [
    { "account": "Service Revenue", "amount": 15000 }
  ]
}
```

Comparative report:
```json
{
  "comparison_mode": "previous_period",
  "columns": [
    { "label": "Mar 2026", "start_date": "2026-03-01", "end_date": "2026-03-31" },
    { "label": "Feb 2026", "start_date": "2026-02-01", "end_date": "2026-02-28" },
    { "label": "$ Change", "type": "variance" },
    { "label": "% Change", "type": "percent_variance" }
  ],
  "rows": [
    {
      "account": "Service Revenue",
      "values": [15000, 12000, 3000, 25.0]
    }
  ]
}
```

Multi-period:
```json
{
  "comparison_mode": "multi_period",
  "columns": [
    { "label": "Jan 2026" },
    { "label": "Feb 2026" },
    { "label": "Mar 2026" },
    { "label": "Total" }
  ],
  "rows": [
    {
      "account": "Service Revenue",
      "values": [10000, 12000, 15000, 37000]
    }
  ]
}
```

### 3.3 Frontend

- [ ] **Report toolbar additions:**
  - "Compare" dropdown: None, Previous Period, Previous Year, Year-to-Date, Multi-Period, Budget vs Actual
  - When multi-period selected: period count (2–12) and period type (Month/Quarter/Year) inputs
  - Comparison columns render with distinct styling (lighter background for prior period, colored for variance)

- [ ] **Variance display:**
  - Positive change (favorable): green text, upward arrow
  - Negative change (unfavorable): red text, downward arrow
  - For revenue accounts: increase = favorable (green), decrease = unfavorable (red)
  - For expense accounts: increase = unfavorable (red), decrease = favorable (green)
  - Zero change: gray dash
  - Division by zero (prior period was $0): show "N/A" instead of infinity

- [ ] **Multi-period display:**
  - Horizontally scrollable table if columns exceed viewport
  - Sticky account name column
  - Total column at the end
  - Sparkline mini-chart per row (optional, shows trend across periods)

### 3.4 Build Checklist — Comparative Reports

- [ ] Create `packages/api/src/services/report-comparison.service.ts`:
  - `buildComparativePL(tenantId, baseRange, compareMode, options)` — returns multi-column P&L
  - `buildComparativeBS(tenantId, asOfDate, compareMode, options)` — returns multi-column Balance Sheet
  - `computeVariance(current, prior)` — returns { dollar_change, percent_change }
  - Handle edge cases: prior period has no data, division by zero, negative-to-positive swing
- [ ] Update report route handlers to accept `compare`, `periods`, `period_type` params
- [ ] Update `ProfitAndLossReport.tsx` — comparison dropdown, multi-column table, variance coloring
- [ ] Update `BalanceSheetReport.tsx` — same comparison features
- [ ] Create sparkline component for multi-period rows (optional)
- [ ] CSV and PDF export include comparison columns
- [ ] Write Vitest tests:
  - [ ] Previous period: correct prior period date range calculated
  - [ ] Previous year: same month/quarter last year
  - [ ] YTD vs prior YTD: correct cumulative ranges
  - [ ] Multi-period (6 months): 6 columns with correct amounts
  - [ ] Variance calculation: positive, negative, zero, division-by-zero
  - [ ] Favorable/unfavorable direction correct for revenue vs expense accounts
  - [ ] Balance Sheet comparison: asset/liability changes computed correctly

---

## 4. Duplicate Detection

### Overview

Automatically flag potential duplicate transactions based on matching amount, date proximity, and payee. Surface duplicates in a review queue and on the transaction itself, so the user can merge or dismiss them.

### 4.1 Detection Logic

A transaction is flagged as a potential duplicate if another transaction exists with:

- Same `tenant_id`
- Same `total` amount (exact match)
- Same `contact_id` (or both have no contact)
- `txn_date` within ±3 days of each other
- Neither transaction is voided
- The two transactions are not already linked (e.g., a payment applied to an invoice is not a duplicate)

Exclude from detection:
- Journal entries (too generic to flag meaningfully)
- Transactions already dismissed as "not a duplicate" by the user
- Transfers (amount match between "from" and "to" is expected)

### 4.2 Data Model

```sql
CREATE TABLE duplicate_dismissals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  transaction_id_a UUID NOT NULL REFERENCES transactions(id),
  transaction_id_b UUID NOT NULL REFERENCES transactions(id),
  dismissed_by UUID REFERENCES users(id),
  dismissed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, transaction_id_a, transaction_id_b)
);
```

### 4.3 Detection Timing

Duplicates are detected at two points:

1. **On transaction create/import:** After a new transaction is saved, check for existing matches. If found, flag the new transaction with a `has_potential_duplicates` indicator.

2. **On-demand scan:** A "Scan for Duplicates" action in Settings or the transaction list that runs the detection query across all transactions within a date range.

### 4.4 API Endpoints

```
GET    /api/v1/duplicates                    # List all potential duplicate pairs (paginated)
POST   /api/v1/duplicates/scan               # Run a full scan for a date range
POST   /api/v1/duplicates/:id/dismiss        # Dismiss a duplicate pair (not actually duplicates)
POST   /api/v1/duplicates/:id/merge          # Merge: keep one transaction, void the other
GET    /api/v1/transactions/:id/duplicates   # Get potential duplicates for a specific transaction
```

### 4.5 Service Layer

- [ ] Create `packages/api/src/services/duplicate-detection.service.ts`:
  - `findDuplicates(tenantId, transactionId)` — find potential matches for a single transaction
  - `scanDateRange(tenantId, startDate, endDate)` — batch scan, returns all duplicate pairs
  - `dismissDuplicate(tenantId, txnIdA, txnIdB, userId)` — mark pair as reviewed/not-duplicate
  - `mergeDuplicate(tenantId, keepTxnId, voidTxnId, userId)` — void the duplicate, keep the original, transfer any attachments/tags from voided to kept

### 4.6 Frontend

- [ ] **Duplicate review page** (`packages/web/src/features/transactions/DuplicateReviewPage.tsx`):
  - List of duplicate pairs, each showing:
    - Side-by-side comparison: Date, Type, Payee, Amount, Account, Memo, Source (manual / bank feed / batch)
    - Matching fields highlighted
    - "Keep Left / Void Right" and "Keep Right / Void Left" buttons
    - "Not a Duplicate" dismiss button
  - Filter by date range
  - Count badge: "12 potential duplicates found"

- [ ] **Transaction detail integration:**
  - If a transaction has potential duplicates, show a warning banner: "This transaction may be a duplicate. [Review]"
  - Link to the comparison view

- [ ] **Transaction list integration:**
  - Duplicate indicator icon on rows that have potential matches
  - Filter option: "Show potential duplicates only"

- [ ] **Bank feed integration:**
  - When a bank feed item matches an existing transaction (same amount ± 3 days), surface it as a match candidate before allowing categorization as a new transaction
  - "This looks like it might already be recorded. [Match to existing] or [Create new]"

- [ ] Add "Duplicate Review" link in sidebar under Transactions (with count badge when duplicates exist)

### 4.7 Build Checklist — Duplicate Detection

- [ ] Create migration: `duplicate_dismissals` table
- [ ] Create `packages/api/src/services/duplicate-detection.service.ts` — find, scan, dismiss, merge
- [ ] Create `packages/api/src/routes/duplicates.routes.ts`
- [ ] Integrate detection into transaction create pipeline (check on save)
- [ ] Integrate detection into bank feed import pipeline
- [ ] Create `DuplicateReviewPage.tsx` — side-by-side comparison with keep/void/dismiss actions
- [ ] Add duplicate warning banner to transaction detail page
- [ ] Add duplicate indicator to transaction list
- [ ] Add "Duplicate Review" to sidebar with count badge
- [ ] Write Vitest tests:
  - [ ] Same amount + same payee + same date = flagged
  - [ ] Same amount + same payee + 3 days apart = flagged
  - [ ] Same amount + same payee + 5 days apart = NOT flagged
  - [ ] Same amount + different payee = NOT flagged
  - [ ] Dismissed pair not flagged again
  - [ ] Merged duplicate: one voided, attachments/tags transferred to kept transaction
  - [ ] Journal entries excluded from detection
  - [ ] Transfers excluded from detection

---

## 5. Backup & Restore (UI)

### Overview

One-click backup to a downloadable encrypted file, and one-click restore with confirmation — all from the Settings page. No terminal access needed.

### 5.1 Backup Format

The backup is a single encrypted archive containing:

```
kis-books-backup-2026-03-15T143022Z.kbk
├── metadata.json          # backup timestamp, app version, tenant info
├── database.sql           # pg_dump output (schema + data for this tenant)
├── attachments/           # all uploaded files for this tenant
│   ├── {uuid}.pdf
│   ├── {uuid}.jpg
│   └── ...
└── config.json            # company settings, check settings, display prefs (non-secret)
```

**Encryption:** AES-256-GCM using the backup encryption key from `.env`. Without the key, the `.kbk` file is unreadable.

**Scope:** Single-tenant backup. Each backup contains only one tenant's data. Multi-tenant installations backup each tenant separately.

### 5.2 API Endpoints

```
POST   /api/v1/backup/create              # Trigger backup creation, returns job ID
GET    /api/v1/backup/status/:jobId        # Check backup job progress
GET    /api/v1/backup/download/:jobId      # Download completed backup file
GET    /api/v1/backup/history              # List past backups (date, size, status)
POST   /api/v1/backup/restore             # Upload and restore from backup file (multipart)
GET    /api/v1/backup/restore/status/:jobId # Check restore progress
DELETE /api/v1/backup/:id                  # Delete a stored backup from server
```

### 5.3 Backup Process

1. User clicks "Create Backup" in Settings
2. API enqueues a BullMQ background job
3. Job runs `pg_dump` for the tenant's data (filtered by tenant_id)
4. Job copies all attachment files for the tenant
5. Job writes metadata.json with version info
6. Job packages everything into a tar archive
7. Job encrypts the archive with AES-256-GCM
8. Job stores the encrypted file at `/data/backups/{tenant_id}/{timestamp}.kbk`
9. Frontend polls status endpoint until complete
10. "Download" button becomes available

### 5.4 Restore Process

1. User clicks "Restore from Backup" in Settings
2. Upload the `.kbk` file
3. API decrypts and validates the archive (check metadata, version compatibility)
4. **Confirmation gate:** "Restoring will replace ALL current data with the backup data. This cannot be undone. Type 'RESTORE' to confirm."
5. API enqueues a restore job
6. Job creates a safety backup of current data first (auto-backup before restore)
7. Job truncates all tenant tables and re-inserts from the backup SQL
8. Job restores attachment files
9. Job restores settings
10. Frontend polls status until complete
11. User is logged out and must log back in (session invalidated for safety)

### 5.5 Automatic Scheduled Backups

- [ ] Company setting: "Automatic backup schedule" — None / Daily / Weekly / Monthly
- [ ] BullMQ scheduled job runs at the configured frequency
- [ ] Retention: keep last N backups (configurable, default 30 for daily, 12 for weekly, 12 for monthly)
- [ ] Old backups auto-deleted based on retention policy
- [ ] Backup status visible in Settings: "Last backup: March 15, 2026 at 2:30 PM (42 MB)"

### 5.6 Frontend

- [ ] **Settings → Backup & Restore section:**
  - "Create Backup Now" button with progress indicator
  - Download button for completed backups
  - Backup history table: Date, Size, Status, Download, Delete
  - Automatic schedule dropdown: None / Daily / Weekly / Monthly
  - Retention setting: "Keep last __ backups"
  - "Restore from Backup" upload zone with confirmation gate
  - Restore progress indicator
  - "Last automatic backup" timestamp

### 5.7 Build Checklist — Backup & Restore

- [ ] Create `packages/api/src/services/backup.service.ts`:
  - `createBackup(tenantId)` — pg_dump + file copy + encrypt + store
  - `getBackupStatus(jobId)` — progress tracking
  - `downloadBackup(tenantId, backupId)` — stream encrypted file
  - `listBackups(tenantId)` — history with metadata
  - `deleteBackup(tenantId, backupId)` — remove file
  - `restoreFromBackup(tenantId, fileBuffer)` — decrypt + validate + restore
  - `getRestoreStatus(jobId)` — progress tracking
- [ ] Create `packages/worker/src/processors/backup.processor.ts` — BullMQ job for backup creation
- [ ] Create `packages/worker/src/processors/restore.processor.ts` — BullMQ job for restore
- [ ] Create `packages/api/src/routes/backup.routes.ts`
- [ ] Implement AES-256-GCM encryption/decryption using backup key from env
- [ ] Implement scheduled backup job (daily/weekly/monthly)
- [ ] Implement retention-based cleanup
- [ ] Create backup/restore UI section in Settings page
- [ ] Implement progress polling in frontend
- [ ] Write Vitest tests:
  - [ ] Backup produces valid encrypted archive
  - [ ] Archive contains database dump, attachments, and metadata
  - [ ] Restore from backup: data matches original
  - [ ] Restore creates safety backup first
  - [ ] Encrypted backup cannot be read without correct key
  - [ ] Version compatibility check rejects incompatible backups
  - [ ] Retention cleanup deletes oldest backups beyond limit

---

## 6. Enhanced Audit Trail

### Overview

The BUILD_PLAN.md Phase 10 includes a basic audit trail (create/update/delete logging with before/after data). This section enhances it with login tracking, report access logging, a richer query interface, and immutable export for compliance.

### 6.1 Additional Event Types

Extend the existing `audit_log` table's `action` enum:

```sql
ALTER TABLE audit_log ALTER COLUMN action TYPE VARCHAR(30);
-- New action values beyond create/update/delete/void:
-- 'login', 'logout', 'login_failed', 'password_change', 'password_reset'
-- 'report_viewed', 'report_exported'
-- 'backup_created', 'backup_restored'
-- 'settings_changed'
-- 'bulk_operation' (batch entry, bulk tag, bulk delete)
```

### 6.2 Login Tracking

- [ ] Log every login attempt (successful and failed) with IP address and user agent
- [ ] Log logouts
- [ ] Log password changes and resets
- [ ] Failed login tracking: after 5 consecutive failures from the same IP within 15 minutes, temporarily lock the account (15-minute cooldown)

### 6.3 Report Access Logging

- [ ] Log when a report is viewed: which report, what filters were applied, who viewed it
- [ ] Log when a report is exported (CSV, PDF): same details plus export format
- [ ] Useful for compliance: "Who accessed the financial statements and when?"

### 6.4 Enhanced Audit Log Viewer

Update the existing audit log UI (from Phase 10) with:

- [ ] **Filter panel:**
  - Date range
  - Action type (multi-select: create, update, delete, void, login, report_viewed, etc.)
  - Entity type (transaction, account, contact, settings, etc.)
  - User (dropdown of all users)
  - Search (free text across entity descriptions and memo fields)

- [ ] **Detail expansion:**
  - Click any row to expand and see full before/after JSON diff
  - For updates: highlight changed fields in green (added/changed) and red (removed)
  - For login events: show IP address, user agent, success/failure

- [ ] **Timeline view** (alternative to table):
  - Chronological feed grouped by date
  - Visual icons per action type
  - Collapsible date groups

- [ ] **Export:**
  - CSV export of filtered audit log
  - PDF export with company header (for auditors)
  - Export is itself logged as an audit event

### 6.5 Immutable Export

For regulatory or audit compliance, produce a signed export:

- [ ] "Generate Audit Report" button: produces a PDF/CSV covering a date range with a SHA-256 hash of the content
- [ ] The hash is stored in the audit log itself, creating a tamper-evident chain
- [ ] If the exported file is later altered, the hash won't match

### 6.6 Build Checklist — Enhanced Audit Trail

- [ ] Update audit_log action column to support new event types
- [ ] Add login/logout/failed login logging to auth service
- [ ] Add report viewed/exported logging to report routes
- [ ] Add backup/restore event logging
- [ ] Add settings change logging
- [ ] Implement failed login lockout (5 attempts / 15 minutes)
- [ ] Update audit log viewer: enhanced filters, JSON diff view, timeline view
- [ ] Implement CSV and PDF export of audit log
- [ ] Implement SHA-256 hash on audit exports for tamper detection
- [ ] Write Vitest tests:
  - [ ] Successful login creates audit entry with IP and user agent
  - [ ] Failed login creates audit entry with failure reason
  - [ ] 5 consecutive failed logins trigger temporary lockout
  - [ ] Report view creates audit entry with report type and filters
  - [ ] Settings change logs before/after values
  - [ ] Audit export includes correct SHA-256 hash
  - [ ] Audit log query with all filters returns correct results

---

## 7. Simple Budgets

### Overview

A straightforward annual budget: enter a monthly dollar amount for each account, then compare actual results against the budget on the dashboard and in reports. No multi-scenario budgeting, no rolling forecasts — just one budget per fiscal year with monthly granularity.

### 7.1 Data Model

```sql
CREATE TABLE budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  name VARCHAR(255) NOT NULL,
  fiscal_year INT NOT NULL,                    -- e.g., 2026
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, fiscal_year)               -- one budget per fiscal year
);

CREATE TABLE budget_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id UUID NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id),
  month_1 DECIMAL(19,4) DEFAULT 0,            -- fiscal month 1 (e.g., January if FY starts Jan)
  month_2 DECIMAL(19,4) DEFAULT 0,
  month_3 DECIMAL(19,4) DEFAULT 0,
  month_4 DECIMAL(19,4) DEFAULT 0,
  month_5 DECIMAL(19,4) DEFAULT 0,
  month_6 DECIMAL(19,4) DEFAULT 0,
  month_7 DECIMAL(19,4) DEFAULT 0,
  month_8 DECIMAL(19,4) DEFAULT 0,
  month_9 DECIMAL(19,4) DEFAULT 0,
  month_10 DECIMAL(19,4) DEFAULT 0,
  month_11 DECIMAL(19,4) DEFAULT 0,
  month_12 DECIMAL(19,4) DEFAULT 0,
  annual_total DECIMAL(19,4) GENERATED ALWAYS AS (
    month_1 + month_2 + month_3 + month_4 + month_5 + month_6 +
    month_7 + month_8 + month_9 + month_10 + month_11 + month_12
  ) STORED,
  UNIQUE(budget_id, account_id)
);

CREATE INDEX idx_bl_budget ON budget_lines(budget_id);
```

### 7.2 Budget Entry Helpers

Users shouldn't have to type 12 monthly values for every account. Provide shortcuts:

- **Annual amount → spread evenly:** Enter $12,000/year → auto-fills $1,000/month
- **Monthly amount → fill all:** Enter $1,000 in January → "Apply to all months" button fills Feb–Dec
- **Copy from prior year:** Copy last year's budget as a starting point
- **Copy from actuals:** Fill budget with last year's actual amounts per month
- **Percentage increase:** "Increase all amounts by 5%" across the board or per account

### 7.3 API Endpoints

```
GET    /api/v1/budgets                      # List budgets (by fiscal year)
POST   /api/v1/budgets                      # Create budget for a fiscal year
GET    /api/v1/budgets/:id                  # Get budget with all lines
PUT    /api/v1/budgets/:id                  # Update budget metadata (name, active)
DELETE /api/v1/budgets/:id                  # Delete budget
GET    /api/v1/budgets/:id/lines            # Get all budget lines
PUT    /api/v1/budgets/:id/lines            # Bulk update budget lines (spreadsheet save)
POST   /api/v1/budgets/:id/copy-from/:sourceId  # Copy lines from another budget
POST   /api/v1/budgets/:id/fill-from-actuals    # Fill from prior year actuals
GET    /api/v1/reports/budget-vs-actual      # Budget vs Actual report
GET    /api/v1/reports/budget-overview        # Budget summary (annual by account)
```

### 7.4 Budget vs Actual Report

The core report: for each budgeted account, show the budget amount, actual amount, dollar variance, and percentage variance — by month, quarter, or YTD.

**Columns:**

| Account | Budget | Actual | $ Variance | % Variance |
|---|---|---|---|---|
| Service Revenue | $15,000 | $17,200 | $2,200 | 14.7% (favorable) |
| Office Supplies | $500 | $620 | ($120) | -24.0% (unfavorable) |

**Favorable/unfavorable logic:**
- Revenue accounts: actual > budget = favorable (green)
- Expense accounts: actual < budget = favorable (green)
- Revenue accounts: actual < budget = unfavorable (red)
- Expense accounts: actual > budget = unfavorable (red)

**Rollup rows:**
- Total Revenue (budget vs actual)
- Total Expenses (budget vs actual)
- Net Income (budget vs actual)

### 7.5 Dashboard Integration

- [ ] **Budget widget on dashboard** (shown only when an active budget exists for the current fiscal year):
  - "Budget Performance" card
  - Current month: Actual vs Budget with a progress bar
  - YTD: Actual vs Budget with a progress bar
  - Net income: Actual vs Budget
  - Color coding: on track (green), within 10% (amber), over/under by >10% (red)
  - Click → navigates to full Budget vs Actual report

### 7.6 Frontend

- [ ] **Budget Editor Page** (`packages/web/src/features/budgets/BudgetEditorPage.tsx`):
  - Fiscal year selector (create new or edit existing)
  - Spreadsheet-style grid:
    - Rows: accounts (revenue and expense accounts from COA, grouped by type)
    - Columns: 12 months + Annual Total
    - Editable cells (currency input)
    - Row totals auto-calculate
    - Column totals auto-calculate
  - Toolbar shortcuts:
    - "Spread annual amount" — enter annual, divide by 12
    - "Apply to all months" — fill one month's value across all 12
    - "Copy from prior year budget"
    - "Fill from prior year actuals"
    - "Increase by %" — percentage adjustment
  - "Save" button (bulk saves all lines)
  - Accounts with $0 budget across all months can be hidden/shown via toggle

- [ ] **Budget vs Actual Report Page** (`packages/web/src/features/reports/BudgetVsActualReport.tsx`):
  - Date range (defaults to current month or current YTD)
  - Period granularity: Month / Quarter / YTD / Annual
  - Table: Account, Budget, Actual, $ Variance, % Variance
  - Favorable/unfavorable coloring
  - Rollup subtotals: Total Revenue, Total Expenses, Net Income
  - Export to CSV / PDF

- [ ] **Budget Overview Report Page:**
  - Full annual budget displayed: 12 monthly columns + annual total
  - No actuals — just the budget plan
  - Useful for planning review and sharing with stakeholders

- [ ] Add "Budgets" to sidebar (under Reports or as top-level)

### 7.7 Comparative Report Integration

Connect budgets to the comparative report system (§3):

- [ ] `compare=budget` mode on the P&L report uses the active budget for the fiscal year
- [ ] Columns: Actual | Budget | $ Variance | % Variance
- [ ] Works with the existing comparative report framework

### 7.8 Build Checklist — Simple Budgets

- [ ] Create migration: `budgets` and `budget_lines` tables
- [ ] Create `packages/shared/src/types/budgets.ts` — types and schemas
- [ ] Create `packages/api/src/services/budget.service.ts`:
  - CRUD for budgets and budget lines
  - Bulk line update (spreadsheet save)
  - Copy from another budget
  - Fill from actuals (query prior year actual amounts per account per month)
  - Percentage adjustment
- [ ] Create `packages/api/src/services/budget-report.service.ts`:
  - `buildBudgetVsActual(tenantId, budgetId, dateRange, granularity)`
  - `buildBudgetOverview(tenantId, budgetId)`
  - Favorable/unfavorable variance calculation with correct direction per account type
- [ ] Create `packages/api/src/routes/budgets.routes.ts`
- [ ] Integrate `compare=budget` mode into existing comparative P&L report
- [ ] Create `BudgetEditorPage.tsx` with spreadsheet grid and helper shortcuts
- [ ] Create `BudgetVsActualReport.tsx` with variance coloring
- [ ] Create `BudgetOverviewReport.tsx` — annual plan view
- [ ] Create dashboard budget widget with progress bars
- [ ] Write Vitest tests:
  - [ ] Budget CRUD (create, update lines, delete)
  - [ ] One budget per fiscal year enforced
  - [ ] Budget vs Actual: correct variance calculation for revenue accounts
  - [ ] Budget vs Actual: correct variance calculation for expense accounts
  - [ ] Budget vs Actual: net income line = revenue variance - expense variance
  - [ ] Copy from prior year creates identical lines for new year
  - [ ] Fill from actuals matches prior year transaction totals per month per account
  - [ ] Percentage increase applies correctly across all lines
  - [ ] Spread annual: $12,000 → $1,000 × 12
  - [ ] Dashboard widget shows correct MTD and YTD budget performance

---

## Master Ship Gate — All Features

- [ ] **Year-End Closing:** Balance sheet shows correct retained earnings across 2+ fiscal years without manual closing entry
- [ ] **Year-End Closing:** P&L resets at fiscal year boundary
- [ ] **Bank Rules:** Rule with "description contains AMZN" auto-categorizes Amazon transactions
- [ ] **Bank Rules:** Priority ordering: higher priority rule wins
- [ ] **Bank Rules:** Auto-confirm rule posts transaction without review queue
- [ ] **Bank Rules:** Export 10 rules to CSV → import into a different company → rules resolve correctly
- [ ] **Comparative Reports:** P&L previous period shows two columns with correct $ and % change
- [ ] **Comparative Reports:** P&L multi-period (6 months) shows 6 columns with monthly totals
- [ ] **Comparative Reports:** Balance sheet previous year comparison is correct
- [ ] **Comparative Reports:** Budget vs Actual mode on P&L works when a budget exists
- [ ] **Duplicate Detection:** Two expenses with same amount/payee within 3 days are flagged
- [ ] **Duplicate Detection:** Dismissed pair is not flagged again
- [ ] **Duplicate Detection:** Merge keeps one transaction, voids the other, transfers attachments
- [ ] **Backup:** Create backup → download → file is encrypted and contains database + attachments
- [ ] **Backup:** Restore from backup → all data matches the backup state
- [ ] **Backup:** Restore creates a safety backup of current data first
- [ ] **Backup:** Scheduled daily backup runs automatically and old backups are cleaned up
- [ ] **Audit Trail:** Login attempt (success and failure) logged with IP address
- [ ] **Audit Trail:** Failed login lockout triggers after 5 consecutive failures
- [ ] **Audit Trail:** Report view and export logged
- [ ] **Audit Trail:** JSON diff view shows before/after for updates
- [ ] **Audit Trail:** Export with SHA-256 hash for tamper detection
- [ ] **Budget:** Create FY2026 budget → enter monthly amounts → save
- [ ] **Budget:** Budget vs Actual report shows correct variances with favorable/unfavorable coloring
- [ ] **Budget:** Dashboard widget shows MTD and YTD budget progress bars
- [ ] **Budget:** "Fill from prior year actuals" populates correct amounts
- [ ] **Budget:** Compare=budget on P&L report works correctly
- [ ] All Vitest tests passing
- [ ] QUESTIONS.md reviewed and resolved
