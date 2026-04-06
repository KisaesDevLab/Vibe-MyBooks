# KIS Books — Batch Transaction Entry Feature Plan

**Feature:** Batch Transaction Entry (spreadsheet-style power data entry)
**Date:** April 2, 2026
**Depends on:** BUILD_PLAN.md Phases 1–4 (auth, COA, contacts, transaction engine)
**Integrates with:** Phase 5 (invoicing), Phase 7 (banking), Account Register feature

---

## Feature Overview

Batch Transaction Entry is a spreadsheet-style grid that lets users enter, paste, and save large volumes of transactions at once. The user selects a transaction type (expenses, deposits, journal entries, invoices, etc.) and an account, and the grid presents the correct columns for that type. Rows can be typed manually, pasted from Excel/Google Sheets, or populated from a CSV upload. All rows are validated and saved in a single batch operation.

This is the accountant's power tool. While the register (single-account view) and standard forms (guided entry) serve everyday use, the batch entry screen is purpose-built for:

- Entering a shoebox of receipts at year-end
- Migrating historical data from another system
- Catching up on months of unrecorded transactions
- Entering after-the-fact transactions from paper records
- Importing cleaned bank data that didn't come through a feed

### Where it lives

- **Sidebar → Transactions → Batch Entry** (dedicated menu item)
- **Settings → Import → "Enter transactions manually in bulk"** (cross-link)
- **Account Register → toolbar → "Batch Entry"** button (pre-selects account + type)

---

## 1. Supported Transaction Types & Grid Columns

Each transaction type presents a different set of columns. The user selects the type first, then the grid reconfigures.

### 1.1 Expenses / Checks

Use case: entering checks written, debit card purchases, or general expenses paid from a bank account.

**Required context:** Bank or Credit Card account (the "paid from" account).

| Column | Required | Type | Notes |
|---|---|---|---|
| Date | Yes | Date picker | Defaults to today |
| Ref No. | No | Text | Check number or reference |
| Payee | No | Contact autocomplete | Vendor selector with quick-add |
| Account | Yes | Account autocomplete | Expense or asset account (the "other side") |
| Memo | No | Text | Free text description |
| Amount | Yes | Currency | Payment amount |
| Class | No | Text | Reserved for future class tracking |

**Accounting entry per row:** DR Account (expense), CR Selected Bank/CC.

### 1.2 Deposits

Use case: entering bank deposits, customer payments received outside invoicing.

**Required context:** Bank account (the "deposit to" account).

| Column | Required | Type | Notes |
|---|---|---|---|
| Date | Yes | Date picker | |
| Ref No. | No | Text | Deposit slip number |
| Received From | No | Contact autocomplete | Customer selector with quick-add |
| Account | Yes | Account autocomplete | Revenue, Payments Clearing, or other source |
| Memo | No | Text | |
| Amount | Yes | Currency | Deposit amount |

**Accounting entry per row:** DR Selected Bank, CR Account (revenue/source).

### 1.3 Credit Card Charges

Use case: entering credit card transactions.

**Required context:** Credit Card account.

| Column | Required | Type | Notes |
|---|---|---|---|
| Date | Yes | Date picker | |
| Ref No. | No | Text | |
| Payee | No | Contact autocomplete | Vendor |
| Account | Yes | Account autocomplete | Expense account |
| Memo | No | Text | |
| Amount | Yes | Currency | Charge amount |

**Accounting entry per row:** DR Account (expense), CR Selected CC.

### 1.4 Credit Card Credits

Use case: entering refunds or credits to a credit card.

**Required context:** Credit Card account.

| Column | Required | Type | Notes |
|---|---|---|---|
| Date | Yes | Date picker | |
| Ref No. | No | Text | |
| Payee | No | Contact autocomplete | Vendor |
| Account | Yes | Account autocomplete | Expense account (reversal) |
| Memo | No | Text | |
| Amount | Yes | Currency | Credit amount |

**Accounting entry per row:** DR Selected CC, CR Account (expense reversal).

### 1.5 Invoices

Use case: entering a batch of customer invoices (single line item per row — multi-line invoices should use the standard invoice form).

**Required context:** Accounts Receivable account (auto-selected, not user-chosen).

| Column | Required | Type | Notes |
|---|---|---|---|
| Date | Yes | Date picker | Invoice date |
| Invoice No. | No | Text | Auto-generated if blank |
| Customer | Yes | Contact autocomplete | Customer selector with quick-add |
| Due Date | No | Date picker | Auto-calculated from customer terms if blank |
| Account | Yes | Account autocomplete | Revenue account |
| Description | No | Text | Line item description |
| Amount | Yes | Currency | Invoice total |
| Memo | No | Text | Internal memo |

**Accounting entry per row:** DR Accounts Receivable, CR Account (revenue). Creates a single-line invoice transaction.

### 1.6 Credit Memos

Use case: entering customer credits in bulk.

**Required context:** Accounts Receivable account (auto-selected).

| Column | Required | Type | Notes |
|---|---|---|---|
| Date | Yes | Date picker | |
| Customer | Yes | Contact autocomplete | |
| Account | Yes | Account autocomplete | Revenue account |
| Description | No | Text | |
| Amount | Yes | Currency | Credit amount |
| Memo | No | Text | |

**Accounting entry per row:** DR Account (revenue), CR Accounts Receivable.

### 1.7 Journal Entries

Use case: entering adjusting entries, reclassifications, or imported journal data.

**Required context:** None (freeform).

| Column | Required | Type | Notes |
|---|---|---|---|
| Date | Yes | Date picker | |
| Ref No. | No | Text | JE number |
| Account | Yes | Account autocomplete | Any account |
| Name | No | Contact autocomplete | Customer or vendor |
| Memo | No | Text | |
| Debit | Conditional | Currency | One of debit/credit required per line |
| Credit | Conditional | Currency | |

**Special behavior:** Journal entries are multi-line by nature. Rows with the same Date + Ref No. are grouped into a single journal entry. The grid validates that debits = credits within each group. Rows that don't share a Ref No. are treated as standalone two-line entries where the system prompts for the offsetting account.

### 1.8 Customer Payments

Use case: recording payments received against outstanding invoices.

**Required context:** Bank or Payments Clearing account (the "deposit to" account).

| Column | Required | Type | Notes |
|---|---|---|---|
| Date | Yes | Date picker | Payment date |
| Customer | Yes | Contact autocomplete | |
| Invoice No. | No | Text / autocomplete | Match to open invoice (auto-lookup by customer) |
| Amount | Yes | Currency | Payment amount |
| Ref No. | No | Text | Check number, confirmation number |
| Memo | No | Text | |

**Accounting entry per row:** DR Selected Bank/Payments Clearing, CR Accounts Receivable. Applies payment to matched invoice.

---

## 2. Data Flow

### 2.1 Entry Methods

**Manual typing:** User clicks into cells and types values. Tab moves between columns, Enter moves to the next row. The grid auto-creates new blank rows as the user types into the last row.

**Paste from clipboard:** User copies rows from Excel, Google Sheets, or any tab-separated/comma-separated source and pastes (Ctrl+V) into the grid. The grid parses the clipboard data, maps columns by position, and fills rows. Column order must match the grid layout (user can reorder grid columns to match their source).

**CSV file import:** User clicks "Import CSV" and selects a file. A column mapping dialog appears (source column → grid column), then rows populate into the grid for review before saving.

### 2.2 Validation

Validation runs on every row before the batch can be saved.

**Per-row validation:**
- Date is present and valid
- Required fields are populated (account, amount, customer for invoices)
- Amount is > 0
- Account exists and is active
- Contact exists (or flagged as "will quick-add")
- For journal entries: debit or credit is filled (not both, not neither)

**Batch-level validation:**
- For journal entries: each ref-no group must balance (Σ debits = Σ credits)
- No duplicate invoice numbers within the batch
- Total row count within limits (max 1,000 rows per batch)

**Validation feedback:**
- Valid rows: green checkmark indicator in the row status column
- Invalid rows: red indicator, cell with error highlighted in red with tooltip explaining the issue
- Unresolved contacts (payee/customer not found in system): highlighted in amber, user can quick-add or select from suggestions
- Save button disabled until all rows are valid (or user explicitly skips invalid rows)

### 2.3 Save Operation

When the user clicks "Save All":

1. Frontend sends the full batch to the API as a single request
2. API wraps all transaction inserts in a database transaction (all-or-nothing)
3. For each row:
   - Create the transaction via the appropriate service (expense, deposit, invoice, etc.)
   - Post journal lines through the ledger service
   - Update account running balances
   - Create audit log entries
4. If any row fails validation server-side, the entire batch rolls back
5. API returns a result summary: N transactions saved, N skipped, any errors
6. Frontend shows a success summary with options to view the transactions or start a new batch

---

## 3. API Endpoints

```
POST /api/v1/batch/validate
```

Validates a batch without saving. Returns per-row validation results.

**Request body:**
```json
{
  "txn_type": "expense",
  "context_account_id": "uuid",
  "rows": [
    {
      "row_number": 1,
      "date": "2026-03-15",
      "ref_no": "1234",
      "contact_name": "Office Depot",
      "account_name": "Office Supplies",
      "memo": "Printer paper",
      "amount": 127.50
    }
  ]
}
```

**Response:**
```json
{
  "valid_count": 48,
  "invalid_count": 2,
  "rows": [
    {
      "row_number": 1,
      "status": "valid",
      "resolved_contact_id": "uuid",
      "resolved_account_id": "uuid",
      "errors": []
    },
    {
      "row_number": 15,
      "status": "invalid",
      "errors": [
        { "field": "account_name", "message": "Account 'Ofice Supplies' not found. Did you mean 'Office Supplies'?" }
      ]
    },
    {
      "row_number": 32,
      "status": "warning",
      "errors": [
        { "field": "contact_name", "message": "Vendor 'Staples Inc' not found. Will be created on save." }
      ],
      "new_contact": { "display_name": "Staples Inc", "contact_type": "vendor" }
    }
  ]
}
```

```
POST /api/v1/batch/save
```

Validates and saves all rows in a single database transaction.

**Request body:** Same as validate, plus options:
```json
{
  "txn_type": "expense",
  "context_account_id": "uuid",
  "auto_create_contacts": true,
  "skip_invalid": false,
  "rows": [ ... ]
}
```

**Response:**
```json
{
  "saved_count": 50,
  "skipped_count": 0,
  "created_contacts": [
    { "display_name": "Staples Inc", "id": "uuid" }
  ],
  "transactions": [
    { "id": "uuid", "txn_number": "EXP-0051", "row_number": 1 }
  ]
}
```

```
POST /api/v1/batch/parse-csv
```

Parses a CSV file and returns rows in the grid format.

**Request:** Multipart upload with CSV file + `txn_type` + optional column mapping.

**Response:** Array of parsed rows ready for the grid, plus detected column mapping.

---

## 4. Service Layer

### 4.1 Batch Service

```
packages/api/src/services/batch.service.ts
```

- [ ] `validateBatch(tenantId, txnType, contextAccountId, rows)`:
  - Resolve all contact names to IDs (exact match, then fuzzy match with suggestions)
  - Resolve all account names to IDs (exact match, then fuzzy match)
  - Run per-row validation rules for the transaction type
  - For journal entries: validate debit/credit balance within ref-no groups
  - Return per-row status with resolved IDs and errors

- [ ] `saveBatch(tenantId, txnType, contextAccountId, rows, options)`:
  - Open a database transaction
  - Auto-create contacts if `auto_create_contacts` is true
  - For each valid row, call the appropriate transaction service:
    - `expense` / `credit_card_charge` → `expense.service.createExpense()`
    - `deposit` → `deposit.service.createDeposit()`
    - `credit_card_credit` → `customer-refund.service.createCustomerRefund()` or custom
    - `invoice` → `invoice.service.createInvoice()` (single-line)
    - `credit_memo` → `credit-memo.service.createCreditMemo()`
    - `journal_entry` → `journal-entry.service.createJournalEntry()` (grouped by ref no)
    - `customer_payment` → `invoice.service.recordPayment()` (match to invoice)
  - If `skip_invalid` is false, rollback on any failure
  - Return summary with created transaction IDs

- [ ] `parseCsv(tenantId, txnType, fileBuffer, columnMapping?)`:
  - Parse CSV with Papaparse
  - Auto-detect columns if no mapping provided (match header names to grid column names)
  - Normalize dates, amounts, trim whitespace
  - Return rows in the standard grid format

### 4.2 Fuzzy Matching

- [ ] `resolveContactByName(tenantId, name, contactType)`:
  - Exact match on `display_name` first
  - Then case-insensitive match
  - Then fuzzy match (Levenshtein distance ≤ 2) with top 3 suggestions
  - Return: `{ match: Contact | null, suggestions: Contact[], is_exact: boolean }`

- [ ] `resolveAccountByName(tenantId, name)`:
  - Same approach: exact → case-insensitive → fuzzy
  - Also try matching by account_number
  - Return: `{ match: Account | null, suggestions: Account[], is_exact: boolean }`

---

## 5. Frontend Components

### 5.1 Batch Entry Page

```
packages/web/src/features/transactions/BatchEntryPage.tsx
```

Full-page layout with a toolbar and a data grid.

- [ ] **Toolbar (top):**
  - Transaction type dropdown: Expense, Deposit, Credit Card Charge, Credit Card Credit, Invoice, Credit Memo, Journal Entry, Customer Payment
  - Account selector (bank/CC account — shown for types that require it, hidden for invoices/JEs)
  - Row count indicator: "48 rows — 46 valid, 2 errors"
  - Actions:
    - "Import CSV" button → opens CSV import modal
    - "Clear All" button → clears the grid (with confirmation)
    - "Validate" button → runs validation on all rows
    - "Save All" button → saves the batch (disabled until all rows valid or user opts to skip invalid)
  - Auto-create contacts toggle: "Automatically add new customers/vendors" (checkbox)

- [ ] **Data grid (main area):**
  - Spreadsheet-style grid with columns matching the selected transaction type
  - Column headers: resizable, reorderable (drag to rearrange for paste alignment)
  - Row status column (leftmost): green check, red X, amber warning, or empty (unvalidated)
  - Row number column
  - Data cells: editable inline
  - Last row is always a blank "new row" that auto-extends when typed into
  - Select multiple rows (shift-click, ctrl-click) for bulk delete
  - Right-click context menu: Insert Row Above, Insert Row Below, Delete Row(s), Copy, Paste, Clear Row

- [ ] **Footer:**
  - Batch total: sum of all amounts
  - For journal entries: total debits, total credits, difference
  - Save summary after save completes

### 5.2 Data Grid Component

```
packages/web/src/features/transactions/BatchGrid.tsx
```

This is the core spreadsheet-like component.

- [ ] Built on a virtual scrolling table (handle 1,000+ rows without DOM bloat)
- [ ] Cell types:
  - **Text cell:** plain text input
  - **Date cell:** text input with date picker popup on focus
  - **Currency cell:** formatted number input (right-aligned, 2 decimal places, auto-formats on blur)
  - **Autocomplete cell:** text input with dropdown suggestions (contacts, accounts)
    - Typing filters suggestions
    - Arrow keys navigate suggestions, Enter selects
    - If no match: cell highlights amber, tooltip says "Not found — will be created" or offers suggestions
    - Quick-add: "Add [typed name] as new vendor/customer" option at bottom of dropdown
- [ ] Keyboard navigation:
  - Tab / Shift+Tab: move between cells horizontally
  - Enter: move to next row (same column) — like Excel
  - Arrow keys: move between cells when not in edit mode
  - Ctrl+V: paste from clipboard (multi-row, multi-column)
  - Ctrl+Z: undo last edit
  - Ctrl+Shift+Z: redo
  - Delete / Backspace: clear cell contents
  - Ctrl+D: fill down (copy cell value to selected cells below)
- [ ] Clipboard paste handling:
  - Detect tab-separated (TSV) or comma-separated data
  - Parse into rows and columns
  - Map to grid columns by position
  - Fill cells starting from the currently selected cell
  - Handle rows that extend beyond the current grid (auto-add rows)
  - Show paste preview count: "Pasting 150 rows..."
- [ ] Row operations:
  - Add blank row at end (auto)
  - Insert row above/below (context menu)
  - Delete selected rows (context menu or Delete key)
  - Drag to select range of cells
  - Multi-row select via checkboxes in row number column
- [ ] Validation display:
  - Invalid cells: red border + red background tint
  - Hover on invalid cell: tooltip with error message
  - Warning cells (unresolved contact): amber border
  - Row status icon reflects worst cell status in the row
- [ ] Column customization:
  - "Customize Columns" button opens a panel
  - Show/hide optional columns
  - Reorder columns via drag-and-drop
  - Column order persists in localStorage for next session
- [ ] Performance:
  - Virtual scrolling: only render visible rows + buffer (react-window or similar)
  - Debounce autocomplete lookups (200ms)
  - Validate on blur (not on every keystroke)
  - Batch validation request: send all rows to `/batch/validate` in one call, not per-row

### 5.3 CSV Import Modal

```
packages/web/src/features/transactions/CsvImportModal.tsx
```

- [ ] File upload zone (drag and drop or browse)
- [ ] File preview: first 5 rows of raw data
- [ ] Column mapping interface:
  - Left column: detected CSV headers
  - Right column: dropdown of grid column names
  - Auto-map where header names match (case-insensitive, fuzzy)
  - Unmapped columns shown with "Skip" option
  - Required columns highlighted if unmapped
- [ ] Date format selector (MM/DD/YYYY, DD/MM/YYYY, YYYY-MM-DD, auto-detect)
- [ ] Amount format options: "Amount" single column, or "Debit"/"Credit" split columns
- [ ] Preview: show first 10 mapped rows as they would appear in the grid
- [ ] "Import into Grid" button → populates the batch grid
- [ ] Row count: "Importing 347 rows from transactions.csv"

### 5.4 Validation Results Panel

```
packages/web/src/features/transactions/BatchValidationPanel.tsx
```

- [ ] Collapsible panel below the toolbar
- [ ] Summary: "46 valid, 2 errors, 2 warnings"
- [ ] Error list: clickable items that scroll to and highlight the offending row/cell
  - "Row 15: Account 'Ofice Supplies' not found — Did you mean 'Office Supplies'?"
  - Click "Office Supplies" to auto-fix
- [ ] Warning list: new contacts to be created
  - "Row 32: Vendor 'Staples Inc' will be created"
  - Option to map to existing contact instead
- [ ] "Fix All Suggestions" button: apply all auto-fix suggestions at once
- [ ] "Re-validate" button after manual fixes

### 5.5 Save Summary Modal

```
packages/web/src/features/transactions/BatchSaveResultModal.tsx
```

- [ ] Shows after batch save completes
- [ ] Summary: "50 transactions saved successfully"
- [ ] Created contacts list (if any were auto-created)
- [ ] Transaction number range: "EXP-0051 through EXP-0100"
- [ ] Actions:
  - "View Transactions" → navigate to transaction list filtered to this batch's date range
  - "Enter Another Batch" → clear grid, keep type/account selection
  - "Done" → return to previous page

### 5.6 Hooks

```
packages/web/src/api/hooks/useBatch.ts
```

- [ ] `useValidateBatch()` — mutation that calls `/batch/validate`
- [ ] `useSaveBatch()` — mutation that calls `/batch/save`
- [ ] `useParseCsv()` — mutation that calls `/batch/parse-csv`
- [ ] `useAccountLookup(query)` — debounced search for account autocomplete
- [ ] `useContactLookup(query, type)` — debounced search for contact autocomplete

---

## 6. Journal Entry Grouping Logic

Journal entries require special handling because they're multi-line by nature.

### 6.1 Grouping Rules

Rows in the journal entry grid are grouped into individual journal entries by:

1. **Same Date + Same Ref No.** = one journal entry with multiple lines
2. **Same Date + blank Ref No.** = each row is a separate two-line JE (system prompts for or auto-assigns the offsetting account)
3. **Different dates** always = separate journal entries (even with the same Ref No.)

### 6.2 Balance Validation

The grid shows a per-group subtotal row (visual separator):

```
Date       | Ref No. | Account          | Name | Memo      | Debit    | Credit
2026-03-31 | ADJ-001 | Depreciation Exp |      | Monthly   | 500.00   |
2026-03-31 | ADJ-001 | Accum. Deprec.   |      | Monthly   |          | 500.00
                                          GROUP TOTAL:        500.00     500.00  ✓
2026-03-31 | ADJ-002 | Prepaid Exp      |      | Insurance | 1,200.00 |
2026-03-31 | ADJ-002 | Insurance Exp    |      | Insurance |          | 1,200.00
                                          GROUP TOTAL:      1,200.00   1,200.00  ✓
```

If a group doesn't balance, the group total row highlights in red with the difference displayed.

### 6.3 Auto-Ref Assignment

If the user leaves Ref No. blank, the system auto-assigns sequential numbers (JE-0001, JE-0002, etc.) per group. Two consecutive rows without a Ref No. on the same date are treated as separate single-line JEs unless the user explicitly assigns them the same Ref No.

---

## 7. Integration with Existing Features

### 7.1 Account Register
- [ ] "Batch Entry" button in the register toolbar
- [ ] Pre-selects the register's account and an appropriate default type (expense for bank, charge for CC)
- [ ] After batch save, register refreshes to show new transactions

### 7.2 Bank Reconciliation
- [ ] Transactions entered via batch appear as uncleared in the reconciliation
- [ ] No special handling needed — they're regular transactions

### 7.3 Reports
- [ ] All batch-entered transactions appear in reports identically to manually entered ones
- [ ] No "batch" indicator in reports (transactions are first-class citizens)

### 7.4 Audit Trail
- [ ] Each transaction in a batch creates its own audit log entry
- [ ] The batch save also creates a batch-level audit entry: "Batch entry: 50 expense transactions saved"

---

## 8. Build Checklist

### 8.1 API — Batch Service
- [ ] Create `packages/api/src/services/batch.service.ts`
- [ ] Implement `validateBatch()` with per-row and batch-level validation
- [ ] Implement `saveBatch()` with database transaction wrapping (all-or-nothing)
- [ ] Implement `parseCsv()` with Papaparse, auto-detect columns, date normalization
- [ ] Implement `resolveContactByName()` with exact → case-insensitive → fuzzy matching
- [ ] Implement `resolveAccountByName()` with exact → case-insensitive → fuzzy → account number matching
- [ ] Implement journal entry grouping logic (same date + ref no. = one JE)
- [ ] Implement auto-create contacts during save when option is enabled
- [ ] Implement invoice number auto-generation for batch invoices
- [ ] Implement customer payment matching to open invoices
- [ ] Create `POST /api/v1/batch/validate` endpoint
- [ ] Create `POST /api/v1/batch/save` endpoint
- [ ] Create `POST /api/v1/batch/parse-csv` endpoint (multipart)
- [ ] Write Vitest tests:
  - [ ] Expense batch: 10 rows save correctly, all journal lines balanced
  - [ ] Deposit batch: correct debit/credit direction
  - [ ] Invoice batch: creates valid invoices with AR entries
  - [ ] Journal entry batch: grouping by date + ref no., balance validation
  - [ ] Journal entry batch: unbalanced group is rejected
  - [ ] Fuzzy contact matching returns suggestions for misspelled names
  - [ ] Fuzzy account matching returns suggestions for misspelled accounts
  - [ ] Auto-create contacts creates vendor/customer records
  - [ ] CSV parse handles various date formats (MM/DD/YYYY, YYYY-MM-DD)
  - [ ] CSV parse handles amount with currency symbols and commas ($1,234.56)
  - [ ] Batch rollback: if row 50 fails, rows 1–49 are also rolled back
  - [ ] 1,000-row batch completes within 30 seconds

### 8.2 Frontend — Batch Entry UI
- [ ] Create `BatchEntryPage.tsx` with toolbar, grid, footer
- [ ] Create `BatchGrid.tsx` spreadsheet component:
  - [ ] Virtual scrolling for 1,000+ rows
  - [ ] Editable cells: text, date, currency, autocomplete
  - [ ] Keyboard navigation: Tab, Enter, arrows, Ctrl+V, Ctrl+Z, Ctrl+D
  - [ ] Clipboard paste: detect TSV/CSV, parse multi-row multi-column, fill grid
  - [ ] Row operations: insert, delete, select range, context menu
  - [ ] Auto-extend: new blank row appears when typing into last row
  - [ ] Column reordering via drag-and-drop
  - [ ] Column customization panel (show/hide/reorder)
- [ ] Create autocomplete cells:
  - [ ] Account autocomplete with fuzzy search, filtered by valid types for context
  - [ ] Contact autocomplete with quick-add, filtered by customer/vendor based on txn type
- [ ] Create validation display:
  - [ ] Red border + tooltip on invalid cells
  - [ ] Amber border on unresolved contacts
  - [ ] Row status icons (valid/invalid/warning)
- [ ] Create `CsvImportModal.tsx`:
  - [ ] File upload with drag-and-drop
  - [ ] Column mapping interface with auto-detect
  - [ ] Date format selector
  - [ ] Preview mapped rows
  - [ ] Import into grid
- [ ] Create `BatchValidationPanel.tsx`:
  - [ ] Error and warning lists with click-to-fix
  - [ ] "Fix All Suggestions" bulk action
  - [ ] Re-validate button
- [ ] Create `BatchSaveResultModal.tsx`:
  - [ ] Save summary with counts
  - [ ] Created contacts list
  - [ ] Navigation actions (view transactions, enter another batch, done)
- [ ] Create `packages/web/src/api/hooks/useBatch.ts` — React Query hooks
- [ ] Transaction type switch: changing type clears grid with confirmation if rows exist
- [ ] Journal entry grid: show group subtotal rows, balance indicators
- [ ] Grid footer: batch total (sum of amounts), JE total debits/credits/difference
- [ ] Loading state during save (progress bar for large batches)
- [ ] Add "Batch Entry" to sidebar under Transactions
- [ ] Add "Batch Entry" button to Account Register toolbar

### 8.3 Ship Gate
- [ ] User selects "Expense" type + bank account → grid shows correct columns
- [ ] User types 10 rows of expenses → validates → saves → all 10 transactions appear in transaction list
- [ ] User pastes 50 rows from Excel → grid fills correctly, autocomplete resolves contacts and accounts
- [ ] Paste from Google Sheets works identically to Excel paste
- [ ] CSV import: upload file → map columns → preview → import into grid → save
- [ ] Unresolved contact name highlights amber, offers quick-add, creates vendor on save
- [ ] Unresolved account name highlights red, suggests similar accounts, click to fix
- [ ] "Fix All Suggestions" resolves all fuzzy-match issues at once
- [ ] Invoice batch: creates valid invoices with correct AR entries and auto-generated invoice numbers
- [ ] Journal entry batch: rows with same date + ref no. group into single JE
- [ ] Journal entry batch: unbalanced group shows red, prevents save
- [ ] Batch of 500 rows saves within 15 seconds
- [ ] Batch of 1,000 rows saves within 30 seconds
- [ ] Failed row causes full rollback (no partial saves when skip_invalid = false)
- [ ] Keyboard navigation: Tab between cells, Enter moves down, Ctrl+V pastes, Ctrl+Z undoes
- [ ] Column reordering persists across sessions
- [ ] Account register "Batch Entry" button pre-selects account and type
- [ ] Audit trail records each transaction plus a batch summary entry
- [ ] All Vitest tests passing
- [ ] QUESTIONS.md reviewed and resolved

---

## 9. UX Notes

### Visual Design

The grid should feel like Excel — dense, fast, keyboard-driven. This is not a pretty form; it's a power tool.

- Monospace font for amounts, ref numbers
- Compact row height (28–32px)
- Cell borders visible (light grid lines)
- Active cell: blue border (2px)
- Selected range: light blue background
- Sticky header row (column labels stay visible)
- Sticky first column (row number + status) on horizontal scroll
- Grid fills available viewport height (no outer scroll — grid scrolls internally)

### Autocomplete Behavior

The autocomplete dropdowns must be fast and forgiving:

- Show suggestions after 1 character typed
- Fuzzy match: "ofce sup" should find "Office Supplies"
- Recent/frequent items appear first (based on tenant's transaction history)
- Keyboard: arrow keys navigate, Enter selects, Escape closes dropdown
- If user types a value not found and moves to the next cell, mark the cell as "unresolved" (amber) — don't block them from continuing entry
- Unresolved items are flagged during validation, not during typing

### Paste Intelligence

When pasting from Excel:

- Detect and skip header rows (if first row matches column names)
- Parse amounts that include currency symbols ($), commas (1,234.56), parentheses for negatives ((500.00))
- Parse dates in multiple formats — try common US (MM/DD/YYYY), ISO (YYYY-MM-DD), and European (DD/MM/YYYY) with auto-detection based on which interpretation produces valid dates for more rows
- Trim whitespace from all cells
- Show a toast after paste: "Pasted 150 rows — validating..."

### Performance Budget

- Initial render (empty grid, 50 visible rows): < 100ms
- Paste 500 rows: parse + populate < 500ms
- Paste 1,000 rows: parse + populate < 1s
- Validate 1,000 rows (API round trip): < 3s
- Save 1,000 rows (API round trip): < 30s
- Autocomplete suggestions: < 200ms from keystroke to dropdown visible
