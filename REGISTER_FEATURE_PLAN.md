# KIS Books — Account Register Feature Plan

**Feature:** Account Register (inline ledger view with quick-entry)
**Date:** April 2, 2026
**Depends on:** BUILD_PLAN.md Phases 1–4 (auth, COA, contacts, transaction engine)
**Integrates with:** Phase 5 (invoicing), Phase 6 (reports), Phase 7 (banking/reconciliation)

---

## Feature Overview

The account register is a per-account transaction ledger that displays every journal line affecting a specific account in chronological order, with a running balance and the ability to create, edit, and void transactions inline — without navigating away to a separate form.

This is the power-user interface. While the standard transaction forms (invoice form, expense form, journal entry form) are the guided path for new users, the register is the fast path for accountants and experienced bookkeepers who want to enter and review transactions in the same view.

### Where it lives

- **Chart of Accounts list → "View register"** action button on every balance sheet account (Asset, Liability, Equity)
- **Chart of Accounts list → "Run report"** on income/expense accounts (these don't have a register — they show the Account Report from §7.6 of the proposal instead)
- **Sidebar → Banking → select account** opens that account's register
- **Dashboard → Cash Position → click account balance** opens that account's register

### What it shows

Every transaction that touched the selected account — all journal lines where `account_id` matches — displayed as a flat chronological list with a running balance, regardless of how the transaction was originally entered (invoice, expense, bank feed, journal entry, etc.).

### What it can do

- View all transactions for the account with running balance
- Add new transactions inline (type depends on account — see §2 below)
- Edit existing transactions inline (click to expand, modify fields, save)
- Open the full transaction form for complex edits
- Filter by date range, transaction type, payee, reconciliation status, amount range
- Sort by date, ref number, type, amount
- Search within the register (payee name, memo, amount)
- Reconciliation status indicator per line (cleared ✓, reconciled R, uncleared)
- Print register
- Export to CSV / Excel

---

## 1. Data Model

No new database tables are required. The register is a **read view** over existing `journal_lines` joined to `transactions` and `contacts`, plus a **write interface** that calls the existing transaction services.

### Register Query

The core query that powers the register:

```sql
SELECT
  jl.id AS line_id,
  jl.transaction_id,
  jl.debit,
  jl.credit,
  jl.description AS line_description,
  t.txn_type,
  t.txn_number,
  t.txn_date,
  t.status,
  t.memo,
  t.invoice_status,
  c.display_name AS payee_name,
  c.id AS contact_id,
  -- Determine payment or deposit relative to this account's normal balance
  CASE
    WHEN a.account_type IN ('asset', 'expense') THEN jl.debit
    ELSE jl.credit
  END AS increase_amount,
  CASE
    WHEN a.account_type IN ('asset', 'expense') THEN jl.credit
    ELSE jl.debit
  END AS decrease_amount,
  -- Running balance computed in application layer or window function
  rl.is_cleared,
  rl.reconciliation_id
FROM journal_lines jl
JOIN transactions t ON jl.transaction_id = t.id
JOIN accounts a ON jl.account_id = a.id
LEFT JOIN contacts c ON t.contact_id = c.id
LEFT JOIN reconciliation_lines rl ON rl.journal_line_id = jl.id
WHERE jl.tenant_id = $1
  AND jl.account_id = $2
  AND t.status != 'void'  -- optionally include void with filter
ORDER BY t.txn_date ASC, t.created_at ASC
```

### Running Balance Computation

Running balance is calculated in the application layer, not in SQL, because:
- It must account for all prior transactions (not just the filtered page)
- It needs to be computed from the account's opening balance forward
- It must respect the account's normal balance direction

```
For asset/expense accounts (debit-normal):
  running_balance = opening_balance + Σ(debits) - Σ(credits)

For liability/equity/revenue accounts (credit-normal):
  running_balance = opening_balance + Σ(credits) - Σ(debits)
```

The API returns a `balance_forward` value for the first visible row (sum of all prior rows), then the frontend computes running balance row by row.

---

## 2. Transaction Types Allowed Per Account Type

Not every transaction type makes sense in every register. The inline "Add transaction" dropdown is filtered by account type:

| Account Detail Type | Allowed Inline Types | Rationale |
|---|---|---|
| **Bank** | Check (expense), Deposit, Transfer, Journal Entry | Core bank register actions |
| **Credit Card** | Charge (expense), Credit (refund), Transfer, Journal Entry | CC register actions |
| **Accounts Receivable** | *Read-only register* — no inline entry | Must use Invoice/Payment forms to maintain AR integrity |
| **Payments Clearing** | *Read-only register* — no inline entry | Populated by payments and deposits only |
| **Other Current Asset** | Journal Entry, Deposit | General asset tracking |
| **Fixed Asset** | Journal Entry | Depreciation, purchases |
| **Other Current Liability** | Journal Entry | Tax payable, payroll liabilities |
| **Long Term Liability** | Journal Entry, Check (payment) | Loan payments |
| **Equity** | Journal Entry | Owner draws, contributions |

### Inline Entry Fields Per Type

**Check / Expense (bank or CC register):**
| Field | Required | Notes |
|---|---|---|
| Date | Yes | Defaults to today |
| Ref No. | No | Check number or reference |
| Payee | No | Contact selector (vendor/customer) |
| Account | Yes | Expense/asset account (the "other side" of the entry) |
| Memo | No | Free text |
| Payment | Yes | Amount (debit to expense, credit to this bank) |
| Splits | No | Expand to multi-line (multiple accounts) |

**Deposit (bank register):**
| Field | Required | Notes |
|---|---|---|
| Date | Yes | Defaults to today |
| Ref No. | No | Deposit slip number |
| Received From | No | Contact selector (customer) |
| Account | Yes | Revenue or Payments Clearing |
| Memo | No | Free text |
| Deposit | Yes | Amount (debit to bank, credit to account) |
| Splits | No | Expand to multi-line |

**Transfer (bank or CC register):**
| Field | Required | Notes |
|---|---|---|
| Date | Yes | Defaults to today |
| Transfer To/From | Yes | Other bank/CC account |
| Amount | Yes | Transfer amount |
| Memo | No | Free text |

**Journal Entry (any register):**
| Field | Required | Notes |
|---|---|---|
| Date | Yes | Defaults to today |
| Ref No. | No | JE number |
| Account | Yes | The "other side" account |
| Memo | No | Free text |
| Debit | Conditional | One of debit/credit required |
| Credit | Conditional | One of debit/credit required |
| Splits | No | Expand to multi-line |

---

## 3. API Endpoints

```
GET  /api/v1/accounts/:id/register
```

**Query parameters:**
| Param | Type | Default | Description |
|---|---|---|---|
| `start_date` | date | 90 days ago | Filter from date |
| `end_date` | date | today | Filter to date |
| `txn_type` | string | all | Filter by transaction type |
| `payee` | string | | Search payee name (partial match) |
| `search` | string | | Search memo, payee, ref number |
| `reconciled` | enum | all | `cleared`, `reconciled`, `uncleared`, `all` |
| `min_amount` | decimal | | Minimum amount filter |
| `max_amount` | decimal | | Maximum amount filter |
| `include_void` | boolean | false | Include voided transactions |
| `sort_by` | string | `date` | `date`, `ref_no`, `type`, `amount` |
| `sort_dir` | string | `asc` | `asc` or `desc` |
| `page` | int | 1 | Page number |
| `per_page` | int | 50 | Rows per page (max 200) |

**Response shape:**

```json
{
  "account": {
    "id": "uuid",
    "name": "Business Checking",
    "account_type": "asset",
    "detail_type": "bank",
    "account_number": "1010"
  },
  "balance_forward": 12450.00,
  "ending_balance": 15230.75,
  "filters_applied": { ... },
  "pagination": {
    "page": 1,
    "per_page": 50,
    "total_rows": 342,
    "total_pages": 7
  },
  "allowed_entry_types": ["expense", "deposit", "transfer", "journal_entry"],
  "lines": [
    {
      "line_id": "uuid",
      "transaction_id": "uuid",
      "txn_type": "expense",
      "txn_number": "EXP-0042",
      "txn_date": "2026-03-15",
      "payee_name": "Office Depot",
      "contact_id": "uuid",
      "account_name": "Office Supplies",
      "account_id": "uuid",
      "memo": "Printer paper and toner",
      "payment": 127.50,
      "deposit": null,
      "running_balance": 12322.50,
      "reconciliation_status": "cleared",
      "has_attachments": true,
      "has_splits": false,
      "is_editable": true
    }
  ]
}
```

**Write operations use existing transaction endpoints:**
- `POST /api/v1/transactions` — create (with register context for redirect-back)
- `PUT /api/v1/transactions/:id` — update
- `POST /api/v1/transactions/:id/void` — void

No new write endpoints needed. The register is a UI layer over the existing transaction engine.

---

## 4. Service Layer

### 4.1 Register Service

```
packages/api/src/services/register.service.ts
```

- [ ] `getRegister(tenantId, accountId, filters, pagination)`:
  - Validate account exists and belongs to tenant
  - Determine account type and normal balance direction
  - Compute `balance_forward`: sum of all journal lines for this account before `start_date`
  - Query journal lines joined to transactions and contacts with applied filters
  - Transform raw debit/credit into `payment`/`deposit` columns based on account normal balance direction:
    - **Asset/Expense accounts (debit-normal):** debit = increase (deposit for bank), credit = decrease (payment from bank)
    - **Liability/Equity/Revenue accounts (credit-normal):** credit = increase, debit = decrease
    - **Bank accounts specifically:** debit = deposit INTO bank, credit = payment FROM bank
  - Return `allowed_entry_types` based on account detail type (see §2 table)
  - Calculate running balance per row (balance_forward + cumulative increases - cumulative decreases)
  - Set `is_editable` per row: false for reconciled transactions, false for system-generated (opening balance)
  - Set `reconciliation_status`: 'reconciled' if line is in a completed reconciliation, 'cleared' if in an in-progress reconciliation and marked cleared, 'uncleared' otherwise

- [ ] `getRegisterSummary(tenantId, accountId)`:
  - Current balance
  - Number of uncleared transactions
  - Last reconciliation date
  - Number of transactions in current period

### 4.2 Integration Points

The register service does NOT duplicate transaction creation logic. It calls the existing services:

- `ledger.service.ts` → `postTransaction()` for inline creates
- `expense.service.ts` → `createExpense()` for check/charge entries
- `deposit.service.ts` → `createDeposit()` for deposit entries
- `transfer.service.ts` → `createTransfer()` for transfer entries
- `journal-entry.service.ts` → `createJournalEntry()` for JE entries

The register passes a `source_account_id` context so the transaction service knows which account the user is "in" and can pre-fill the correct side of the double entry.

---

## 5. Frontend Components

### 5.1 Register Page

```
packages/web/src/features/accounts/RegisterPage.tsx
```

Full-page view opened from COA list, sidebar banking, or dashboard.

- [ ] **Header bar:**
  - Account name and number (left)
  - Account type badge (e.g., "Bank", "Credit Card", "Liability")
  - Current balance (right, large)
  - Account switcher dropdown (jump to another account's register)

- [ ] **Toolbar:**
  - Date range picker (presets: This Month, This Quarter, This Year, Last 90 Days, All, Custom)
  - Filter dropdown panel:
    - Transaction type multi-select
    - Reconciliation status (All, Cleared, Reconciled, Uncleared)
    - Payee search
    - Amount range (min/max)
  - Search box (searches payee, memo, ref number)
  - Clear filters link
  - Sort toggle (by date, ref no, amount)
  - Print button
  - Export dropdown (CSV, Excel)

- [ ] **Inline entry row** (pinned at top of register, above transaction list):
  - Transaction type dropdown (filtered per account type — see §2)
  - When type is selected, row expands to show the fields for that type
  - Quick-save button (Enter key also saves)
  - Cancel button (Esc key)
  - After save: row animates into the list at the correct date position, running balances recalculate

- [ ] **Transaction list** (the register itself):
  - Column layout varies by account type:

  **Bank / Credit Card register columns:**
  | Date | Ref No. | Type | Payee | Memo | Payment | Deposit | Balance | ✓ |
  
  **Other balance sheet account columns:**
  | Date | Ref No. | Type | Name | Memo | Decrease | Increase | Balance | ✓ |

  - Each row:
    - Click to expand inline edit (same fields as entry row, pre-filled)
    - "Edit" link → opens full transaction form in a modal or navigates to transaction detail page
    - "Void" link → confirmation dialog, calls void endpoint
    - Reconciliation status indicator: blank (uncleared), `C` (cleared), `R` (reconciled)
    - Attachment paperclip icon if `has_attachments`
    - Void transactions: shown with strikethrough text, muted color, "VOID" badge (only if `include_void` filter is on)
  - Running balance column updates with every row
  - **Splits indicator:** if a transaction has multiple journal lines (split across accounts), show a "Splits" link that expands to show all lines

- [ ] **Footer:**
  - Summary row: Total payments, Total deposits, Ending balance
  - Pagination controls
  - Row count: "Showing 1–50 of 342 transactions"

### 5.2 Inline Entry Component

```
packages/web/src/features/accounts/RegisterEntryRow.tsx
```

- [ ] Renders inside the register table, visually consistent with data rows
- [ ] Transaction type dropdown as first field
- [ ] On type change, fields animate in/out to match the selected type
- [ ] Date field: defaults to today, date picker on focus
- [ ] Payee field: searchable contact dropdown with "Add new" option
- [ ] Account field: searchable account dropdown (filtered to valid accounts for this transaction type)
- [ ] Amount fields: MoneyInput component with auto-formatting
- [ ] Memo field: free text
- [ ] Splits toggle: expands to multi-line entry (multiple account/amount rows)
- [ ] Keyboard navigation:
  - Tab moves between fields
  - Enter saves the transaction
  - Escape cancels and collapses the entry row
- [ ] After save: success toast, entry row resets, register refreshes, new transaction highlighted briefly

### 5.3 Inline Edit Component

```
packages/web/src/features/accounts/RegisterEditRow.tsx
```

- [ ] Click on any transaction row to enter edit mode
- [ ] Row expands in-place, showing editable fields (same layout as entry row, pre-filled)
- [ ] "Save" and "Cancel" buttons
- [ ] "Open full form" link → navigates to the transaction's full form page
- [ ] Reconciled transactions: show fields as read-only with a note "This transaction has been reconciled and cannot be edited in the register"
- [ ] Keyboard: Enter saves, Escape cancels

### 5.4 Splits Expansion

```
packages/web/src/features/accounts/RegisterSplitsPanel.tsx
```

- [ ] Expands below a transaction row when "Splits" is clicked
- [ ] Shows all journal lines for that transaction (account, description, debit, credit)
- [ ] In edit mode: add/remove split lines, adjust amounts, auto-balance
- [ ] Total row shows sum of debits and credits, highlights imbalance in red

### 5.5 Register Export

```
packages/web/src/features/accounts/RegisterExportMenu.tsx
```

- [ ] CSV export: all visible rows with current filters applied
- [ ] Excel export: formatted with headers, account info, date range, running balance
- [ ] Print: browser print dialog with print-optimized CSS (no toolbar, compact rows)

### 5.6 Account Switcher

```
packages/web/src/features/accounts/AccountSwitcher.tsx
```

- [ ] Dropdown in the register header
- [ ] Shows all balance sheet accounts grouped by type (Bank, Credit Card, Other Asset, Liability, Equity)
- [ ] Current account highlighted
- [ ] Quick search/filter within the dropdown
- [ ] Selecting an account navigates to that account's register, preserving date filters

---

## 6. Integration with Existing Features

### 6.1 Chart of Accounts Page Updates
- [ ] Add "View register" action button on all balance sheet accounts (asset, liability, equity)
- [ ] Add "Run report" action button on all income/expense accounts (links to Account Report)
- [ ] Balance column in COA list links to the register for balance sheet accounts
- [ ] Remove any existing "Account Ledger" links — the register replaces this view

### 6.2 Dashboard Integration
- [ ] Cash Position card: clicking any account balance opens that account's register
- [ ] Receivables card: clicking opens AR register (read-only)

### 6.3 Bank Reconciliation Integration
- [ ] Register's reconciliation status column (`C`/`R`/blank) stays in sync with the reconciliation module
- [ ] From the register, user can see which transactions are cleared/reconciled
- [ ] "Reconcile" button in register toolbar opens the reconciliation page pre-filtered to this account
- [ ] After completing a reconciliation, returning to the register shows updated `R` indicators

### 6.4 Bank Feed Integration
- [ ] Transactions created via bank feed categorization appear in the register
- [ ] Bank feed items matched to existing register transactions show as matched
- [ ] Register toolbar could show a badge: "5 bank feed items to review" linking to the bank feed page

### 6.5 Reports Integration
- [ ] The existing Check Register report (§7.4 of proposal) should use the same underlying query as the register API — single source of truth
- [ ] "Run report" from the register toolbar generates the Check Register report for the current account and date range

---

## 7. Build Checklist

### 7.1 API — Register Service
- [ ] Create `packages/api/src/services/register.service.ts` with `getRegister()` and `getRegisterSummary()`
- [ ] Implement balance-forward calculation (sum of all prior lines)
- [ ] Implement running balance computation per row
- [ ] Implement payment/deposit column mapping based on account normal balance direction
- [ ] Implement `allowed_entry_types` logic per account detail type
- [ ] Implement `is_editable` logic (false for reconciled, system transactions)
- [ ] Implement reconciliation status lookup (join to `reconciliation_lines`)
- [ ] Implement filter logic: date range, txn_type, payee, reconciled status, amount range, search
- [ ] Implement sort logic: date (default), ref_no, type, amount
- [ ] Implement pagination with total count
- [ ] Add `GET /api/v1/accounts/:id/register` endpoint to accounts routes
- [ ] Add `GET /api/v1/accounts/:id/register/summary` endpoint
- [ ] Write Vitest tests:
  - [ ] Balance forward calculation with various date ranges
  - [ ] Running balance correctness across multiple transaction types
  - [ ] Payment/deposit column mapping for asset accounts (debit-normal)
  - [ ] Payment/deposit column mapping for liability accounts (credit-normal)
  - [ ] Filter combinations (type + date + payee)
  - [ ] Reconciliation status indicators
  - [ ] Pagination (page 1 balance_forward = 0 for full range, page 2 balance_forward = end of page 1)
  - [ ] Voided transactions excluded by default, included with flag
  - [ ] Allowed entry types per account type

### 7.2 Frontend — Register Page
- [ ] Create `RegisterPage.tsx` with header, toolbar, entry row, transaction list, footer
- [ ] Create `RegisterEntryRow.tsx` with type-driven field rendering
- [ ] Create `RegisterEditRow.tsx` with inline edit mode
- [ ] Create `RegisterSplitsPanel.tsx` for multi-line expansion
- [ ] Create `RegisterExportMenu.tsx` for CSV/Excel/Print
- [ ] Create `AccountSwitcher.tsx` dropdown component
- [ ] Create `packages/web/src/api/hooks/useRegister.ts` — React Query hooks:
  - `useRegister(accountId, filters)` — paginated register data
  - `useRegisterSummary(accountId)` — balance, uncleared count
- [ ] Implement column layout switching based on account type (Bank vs Other)
- [ ] Implement running balance display (computed client-side from balance_forward + rows)
- [ ] Implement reconciliation status indicators (blank / C / R)
- [ ] Implement keyboard navigation (Tab between fields, Enter to save, Escape to cancel)
- [ ] Implement filter toolbar with date range presets, type multi-select, payee search, amount range
- [ ] Implement search box (debounced, searches payee/memo/ref)
- [ ] Implement sort toggles on column headers
- [ ] Implement pagination controls
- [ ] Implement print view (CSS print media query)
- [ ] Implement CSV and Excel export (client-side from loaded data, or server-side download for large sets)
- [ ] Transaction row click → expand to inline edit
- [ ] "Open full form" link from edit row → navigate to transaction detail page
- [ ] Void action with confirmation dialog
- [ ] Attachment paperclip icon visible on rows with attachments
- [ ] Void transactions: strikethrough styling, "VOID" badge, hidden by default
- [ ] Splits: expandable detail showing all journal lines for the transaction
- [ ] Loading skeleton while data fetches
- [ ] Empty state: "No transactions found" with contextual message
- [ ] Error state with retry

### 7.3 Integration Updates
- [ ] Update `AccountsListPage.tsx`: add "View register" / "Run report" action buttons
- [ ] Update COA balance column to link to register for balance sheet accounts
- [ ] Update Dashboard Cash Position card to link to register
- [ ] Update Dashboard Receivables card to link to AR register
- [ ] Add "Reconcile" shortcut button in register toolbar (links to reconciliation page for this account)
- [ ] Update existing Check Register report to share query logic with register service
- [ ] Add register route to React Router: `/accounts/:id/register`
- [ ] Add "Registers" section or "View Register" shortcut to sidebar Banking section

### 7.4 Ship Gate
- [ ] Register loads for a bank account with correct running balance
- [ ] Register loads for a credit card account with correct column mapping (charges vs credits)
- [ ] Register loads for a liability account with correct normal balance direction
- [ ] AR register is read-only (no inline entry allowed)
- [ ] Inline entry: create an expense from the bank register → transaction posts correctly, double entry balanced, register refreshes
- [ ] Inline entry: create a deposit → posts correctly
- [ ] Inline entry: create a transfer → posts correctly
- [ ] Inline entry: create a journal entry → posts correctly
- [ ] Inline entry: multi-line split entry → all lines post correctly, debits = credits
- [ ] Inline edit: modify an existing transaction → journal lines updated, running balance recalculated
- [ ] Void from register: creates reversing entry, row shows strikethrough
- [ ] Reconciled transactions are not editable in the register
- [ ] Filters: date range, type, payee, reconciliation status, amount range all work
- [ ] Search: finds transactions by payee name, memo text, or ref number
- [ ] Sort by date (default), ref no, type, amount — all work
- [ ] Pagination: balance_forward is correct on page 2+
- [ ] Export: CSV and Excel produce correct data matching the filtered view
- [ ] Print: produces clean, print-friendly output
- [ ] Account switcher: navigate between accounts preserving filters
- [ ] Keyboard shortcuts: Tab, Enter, Escape all work as expected
- [ ] From COA list → "View register" opens the correct register
- [ ] From Dashboard → click balance → opens the correct register
- [ ] Running balance matches the account balance in the COA list
- [ ] All Vitest tests passing
- [ ] QUESTIONS.md reviewed and resolved

---

## 8. UX Notes

### Visual Design

The register should feel like a spreadsheet — dense, information-rich, minimal chrome. It is the one place in the app where data density is more important than whitespace.

- Monospace font for amounts and ref numbers
- Compact row height (32–36px per row)
- Alternating row shading for readability (subtle, using `--color-background-secondary` on even rows)
- Sticky header row (column labels + inline entry row stay visible while scrolling)
- Running balance column right-aligned, bold
- Negative balances shown in red
- Reconciliation status column is narrow (24px), centered, single character

### Performance Considerations

- Default to last 90 days to keep initial load fast
- Paginate at 50 rows (server-side)
- Running balance: compute balance_forward server-side, compute per-row client-side (avoids N+1 queries)
- Debounce search input (300ms)
- Optimistic updates on inline save (show transaction immediately, revert on error)
- Invalidate register query on any transaction mutation (React Query cache key includes account_id + filters)

### Accessibility

- Full keyboard navigation (Tab order: type → date → ref → payee → account → amount → memo → save)
- ARIA roles: table, row, cell, with proper column headers
- Screen reader announcements on save ("Transaction saved: $127.50 to Office Depot")
- Focus management: after save, focus returns to the type dropdown in the entry row
