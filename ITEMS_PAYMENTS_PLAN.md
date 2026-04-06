# KIS Books — Items, Invoice Line Modes & Payment-to-Deposit Feature Plan

**Feature:** Items list, invoice line entry mode switching, and receive-payment-to-bank-deposit workflow
**Date:** April 2, 2026
**Depends on:** BUILD_PLAN.md Phases 1–5 (auth, COA, contacts, transaction engine, invoicing)
**Integrates with:** Cash Sales, Estimates, Reports, Batch Entry, Account Register

---

## Feature Overview

Three connected capabilities that round out the sales workflow:

### 1. Items List

A simple catalog of the things you sell. Each item has a name, default description, unit price, income account, and taxable flag. When selected on an invoice or cash sale, the item auto-fills the line — saving the user from re-typing the same information on every transaction.

No item types, no bundles, no inventory tracking, no purchasing side. Just a flat lookup list with sensible defaults.

### 2. Invoice Line Entry Modes

Invoice and cash sale line items currently work in **category mode** — the user manually picks a revenue account, types a description, and enters a rate. This plan adds a second mode: **item mode**, where the user selects from the items catalog and the line auto-fills.

The user can switch between modes per line or set a default for the company. Both modes can coexist on the same invoice — line 1 might be an item, line 2 might be a freeform category entry.

### 3. Receive Payment → Bank Deposit Workflow

The existing plan describes recording a payment against an invoice but doesn't fully specify the two-step receive-and-deposit flow. This section defines:

1. **Receive Payment** — record money received from a customer against one or more invoices (payment lands in Payments Clearing or directly to a bank account)
2. **Bank Deposit** — group one or more received payments (sitting in Payments Clearing) into a single bank deposit that matches the actual bank statement

This is the same workflow used in every professional accounting system and is essential for clean bank reconciliation.

---

## 1. Data Model — Items

### 1.1 Items Table

```sql
CREATE TABLE items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  name VARCHAR(255) NOT NULL,
  description TEXT,                        -- default description on sales forms
  unit_price DECIMAL(19,4),                -- default rate (can be overridden per line)
  income_account_id UUID NOT NULL REFERENCES accounts(id),  -- revenue account
  is_taxable BOOLEAN DEFAULT TRUE,         -- default taxable flag for this item
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, name)
);

CREATE INDEX idx_items_tenant ON items(tenant_id);
CREATE INDEX idx_items_active ON items(tenant_id, is_active);
```

That's it. Name, description, price, account, taxable — five meaningful fields. Everything else is handled on the invoice line at time of entry.

### 1.2 Journal Lines Update

Add an item reference to journal_lines so reports can aggregate sales by item:

```sql
ALTER TABLE journal_lines ADD COLUMN item_id UUID REFERENCES items(id);
CREATE INDEX idx_jl_item ON journal_lines(tenant_id, item_id) WHERE item_id IS NOT NULL;
```

### 1.3 Company Settings Update

Add a company-level default for invoice line entry mode:

```sql
ALTER TABLE companies ADD COLUMN default_line_entry_mode VARCHAR(20) DEFAULT 'category';
-- Values: 'category' | 'item'
```

---

## 2. Data Model — Payment & Deposit Workflow

No new tables needed. The existing `transactions` and `journal_lines` tables handle everything. This section clarifies the data relationships.

### 2.1 Receive Payment Transaction

When a customer pays an invoice:

```
Transaction:
  txn_type = 'customer_payment'
  contact_id = customer
  total = payment amount
  applied_to_invoice_id = invoice (or NULL if applied to multiple)

Journal Lines:
  DR  Payments Clearing (or Bank)    [payment amount]
  CR  Accounts Receivable            [payment amount]
```

### 2.2 Payment Applications Table

A single payment may apply to multiple invoices (or partially to one). Track the allocation:

```sql
CREATE TABLE payment_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  payment_id UUID NOT NULL REFERENCES transactions(id),
  invoice_id UUID NOT NULL REFERENCES transactions(id),
  amount DECIMAL(19,4) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT chk_amount_positive CHECK (amount > 0)
);

CREATE INDEX idx_pa_payment ON payment_applications(payment_id);
CREATE INDEX idx_pa_invoice ON payment_applications(invoice_id);
```

### 2.3 Bank Deposit Transaction

When one or more payments (sitting in Payments Clearing) are deposited at the bank:

```
Transaction:
  txn_type = 'deposit'
  total = sum of all payments in this deposit

Journal Lines:
  DR  Bank Account                   [deposit total]
  CR  Payments Clearing              [payment 1 amount]
  CR  Payments Clearing              [payment 2 amount]
  CR  Payments Clearing              [payment N amount]
  (additional CR lines for other funds if included — cash sales, refunds, other income)
```

The deposit groups multiple payments into one transaction that matches a single line on the bank statement.

### 2.4 Deposit-Line-to-Payment Link

Track which payments are included in which deposit:

```sql
CREATE TABLE deposit_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deposit_id UUID NOT NULL REFERENCES transactions(id),
  source_transaction_id UUID NOT NULL REFERENCES transactions(id), -- the payment or cash sale
  amount DECIMAL(19,4) NOT NULL,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_dl_deposit ON deposit_lines(deposit_id);
CREATE INDEX idx_dl_source ON deposit_lines(source_transaction_id);
```

---

## 3. API Endpoints

### 3.1 Items

```
GET    /api/v1/items                    # List items (filterable: active, search)
POST   /api/v1/items                    # Create item
GET    /api/v1/items/:id                # Get single item
PUT    /api/v1/items/:id                # Update item
DELETE /api/v1/items/:id                # Deactivate item (soft delete)
POST   /api/v1/items/import             # Import from CSV
GET    /api/v1/items/export             # Export to CSV
```

### 3.2 Receive Payment

```
POST   /api/v1/payments/receive         # Record payment from customer
```

**Request body:**

```json
{
  "customer_id": "uuid",
  "date": "2026-03-15",
  "amount": 1500.00,
  "deposit_to": "uuid",              // Payments Clearing account ID or Bank account ID
  "payment_method": "check",          // 'check' | 'cash' | 'credit_card' | 'ach' | 'other'
  "ref_no": "1234",                   // check number, confirmation number
  "memo": "Payment for March services",
  "applications": [                   // how the payment applies to open invoices
    { "invoice_id": "uuid", "amount": 1000.00 },
    { "invoice_id": "uuid", "amount": 500.00 }
  ]
}
```

**Behavior:**
- Creates a `customer_payment` transaction
- Creates `payment_application` rows linking payment to invoices
- Updates each invoice's `amount_paid`, `balance_due`, and `invoice_status` (partial or paid)
- If `deposit_to` is a bank account (not Payments Clearing), the payment goes directly to the bank — no separate deposit step needed
- If `deposit_to` is Payments Clearing, the payment sits there until included in a bank deposit

### 3.3 Bank Deposit

```
GET    /api/v1/deposits/pending         # List payments in Payments Clearing (available for deposit)
POST   /api/v1/deposits                 # Create bank deposit from selected payments
```

**GET /deposits/pending response:**

```json
{
  "payments_clearing_balance": 3750.00,
  "items": [
    {
      "transaction_id": "uuid",
      "txn_type": "customer_payment",
      "date": "2026-03-15",
      "customer_name": "Acme Corp",
      "ref_no": "1234",
      "payment_method": "check",
      "amount": 1500.00
    },
    {
      "transaction_id": "uuid",
      "txn_type": "cash_sale",
      "date": "2026-03-16",
      "customer_name": "Walk-in",
      "amount": 250.00
    }
  ]
}
```

**POST /deposits request body:**

```json
{
  "deposit_to_account_id": "uuid",     // bank account
  "date": "2026-03-17",
  "memo": "Weekly deposit",
  "lines": [
    { "source_transaction_id": "uuid", "amount": 1500.00 },
    { "source_transaction_id": "uuid", "amount": 250.00 }
  ],
  "other_funds": [                     // additional funds not from existing transactions
    {
      "account_id": "uuid",           // revenue or other account
      "description": "Cash over",
      "amount": 5.00
    }
  ]
}
```

**Behavior:**
- Creates a `deposit` transaction
- Journal lines: DR Bank, CR Payments Clearing (per selected payment)
- Creates `deposit_line` rows linking deposit to source transactions
- Additional "other funds" lines create ad hoc CR entries to specified accounts
- Validates that selected payments are actually in Payments Clearing (not already deposited)

### 3.4 Item-Based Reports

```
GET    /api/v1/reports/sales-by-item-summary     # Revenue by item, date range
GET    /api/v1/reports/sales-by-item-detail       # Individual transactions by item
```

---

## 4. Service Layer

### 4.1 Item Service

```
packages/api/src/services/items.service.ts
```

- [ ] `list(tenantId, filters)` — paginated, filterable by active status and search (name/description)
- [ ] `getById(tenantId, itemId)` — single item
- [ ] `create(tenantId, input)` — validate unique name per tenant, require income_account_id
- [ ] `update(tenantId, itemId, input)` — item changes do not affect past transactions (lines store a snapshot)
- [ ] `deactivate(tenantId, itemId)` — soft delete, item remains on existing transactions but cannot be selected for new ones
- [ ] `importFromCsv(tenantId, csvData)` — parse and bulk create items
- [ ] `exportToCsv(tenantId)` — generate CSV

### 4.2 Payment Service (Enhanced)

```
packages/api/src/services/payment.service.ts
```

The existing invoice payment logic from Phase 5 needs to be refactored into a standalone service.

- [ ] `receivePayment(tenantId, input)`:
  - Create `customer_payment` transaction
  - Create journal lines: DR deposit_to, CR AR
  - Create `payment_application` rows for each invoice
  - Update each invoice: increment `amount_paid`, decrement `balance_due`
  - Set invoice status: `'paid'` if balance_due = 0, `'partial'` if balance_due > 0
  - If overpayment: remaining amount creates a credit on the customer's account
  - Return created payment with application details

- [ ] `getOpenInvoicesForCustomer(tenantId, customerId)`:
  - Return all invoices with balance_due > 0, sorted by oldest first
  - Include: invoice number, date, due date, original amount, amount paid, balance due, overdue flag

- [ ] `getPaymentsForInvoice(tenantId, invoiceId)`:
  - Return all payments applied to this invoice via payment_applications
  - Include: payment date, amount applied, payment method, ref no, deposit status

- [ ] `unapplyPayment(tenantId, paymentId, invoiceId)`:
  - Remove payment application
  - Update invoice balance_due and status
  - Used for correcting misapplied payments

### 4.3 Deposit Service (Enhanced)

```
packages/api/src/services/deposit.service.ts
```

- [ ] `getPendingDeposits(tenantId)`:
  - Query Payments Clearing account for all undeposited funds
  - Group by source transaction (customer payments, cash sales)
  - Return with customer names, dates, amounts, payment methods

- [ ] `createDeposit(tenantId, input)`:
  - Validate all source transactions exist and are in Payments Clearing
  - Validate no source transaction is already included in another deposit
  - Create `deposit` transaction
  - Journal lines: DR Bank, CR Payments Clearing (per source)
  - Journal lines for other_funds: DR Bank, CR specified accounts
  - Create `deposit_line` rows
  - Return created deposit with all lines

- [ ] `getDeposit(tenantId, depositId)`:
  - Return deposit with all lines, source transaction details, and totals

---

## 5. Frontend Components

### 5.1 Items List Page

```
packages/web/src/features/items/ItemsListPage.tsx
```

- [ ] **Toolbar:**
  - Search box (name, description)
  - Active/Inactive toggle
  - "New Item" button
  - Import CSV / Export CSV buttons

- [ ] **Item list table:**
  - Columns: Name, Description (truncated), Unit Price, Income Account, Taxable (check/x), Status
  - Click row → edit
  - Sort by name or price

- [ ] Add "Items" to sidebar navigation

### 5.2 Item Create/Edit Form

```
packages/web/src/features/items/ItemFormModal.tsx
```

- [ ] **Fields:**
  - Name (required)
  - Description (textarea — default description that appears on sales forms)
  - Unit price (currency input — can be left blank for variable pricing)
  - Income account (account selector, filtered to revenue accounts, required)
  - Taxable toggle (default from company settings)
  - Active toggle

Simple modal — no tabs, no sections, no types. One form for all items.

### 5.3 Item Selector Component

```
packages/web/src/components/forms/ItemSelector.tsx
```

Reusable dropdown used on invoice and cash sale line items.

- [ ] Searchable dropdown showing item name and unit price
- [ ] Recently used items appear first (last 10 used by this tenant)
- [ ] "Create new item" option at bottom (opens quick-add: name + price + account, minimal fields)
- [ ] On selection: auto-fill the line's description, rate, account, and taxable flag from item defaults
- [ ] User can still override any auto-filled value on the line

### 5.4 Invoice Line Mode Switching

```
packages/web/src/features/invoicing/InvoiceLineItem.tsx (updated)
```

Each line item on an invoice or cash sale can operate in one of two modes:

**Category mode (current behavior):**
- Account selector (revenue account)
- Free-text description
- Quantity, rate (manual entry)
- Taxable toggle

**Item mode (new):**
- Item selector (from items catalog)
- On item selection: description, rate, account, taxable auto-fill from item
- User can override any auto-filled value
- Quantity (manual entry)

- [ ] **Mode toggle per line:**
  - A small toggle or icon button at the left of each line: "Category" / "Item"
  - Switching modes clears the line (with confirmation if data exists)
  - Both modes can coexist on the same invoice — line 1 can be item mode, line 2 can be category mode

- [ ] **Company default setting:**
  - In Settings > Preferences: "Default line entry mode" — Category or Item
  - New invoices start all lines in the chosen default mode
  - User can always switch individual lines to the other mode

- [ ] **Affected forms:**
  - Invoice form
  - Cash sale form
  - Estimate form
  - Credit memo form

### 5.5 Receive Payment Page

```
packages/web/src/features/invoicing/ReceivePaymentPage.tsx
```

Standalone form for recording a customer payment.

- [ ] **Header:**
  - Customer selector (required) — on selection, loads open invoices
  - Payment date (default today)
  - Payment method dropdown: Check, Cash, Credit Card, ACH/Bank Transfer, Other
  - Reference number (check number, confirmation code)
  - Deposit to: account selector (Payments Clearing is default; bank accounts also available)
  - Amount received (currency input)
  - Memo

- [ ] **Open invoices table** (appears after customer is selected):
  - Columns: Invoice No., Date, Due Date, Original Amount, Amount Due, Payment (editable)
  - Each row has a checkbox to include in this payment
  - Checking a row auto-fills the Payment column with the full amount due
  - Payment column is editable for partial payments
  - Total applied shown below the table
  - If Amount Received > Total Applied, show "Unapplied amount: $X.XX" note (creates a customer credit)
  - If Amount Received < Total Applied, show error "Applied amount exceeds payment"

- [ ] **Auto-apply logic:**
  - When user enters Amount Received and clicks "Apply automatically": allocate to oldest invoices first until fully applied
  - User can manually override allocations

- [ ] **Actions:**
  - "Save" — records payment, returns to invoice list
  - "Save and New" — records payment, clears form for next customer
  - "Cancel" — discard

- [ ] **Access points:**
  - From invoice detail page → "Record Payment" button (pre-fills customer + opens with that invoice selected)
  - From invoice list → action menu → "Receive Payment" (pre-fills customer)
  - From sidebar → Transactions → "Receive Payment"
  - From "+ New" menu → "Receive Payment"

### 5.6 Bank Deposit Page

```
packages/web/src/features/banking/BankDepositPage.tsx
```

Form for grouping received payments into a bank deposit.

- [ ] **Header:**
  - Deposit to: bank account selector (required)
  - Date (default today)
  - Memo

- [ ] **Payments to deposit table** (populated from Payments Clearing):
  - Columns: Checkbox, Date, Type, Customer/Description, Ref No., Payment Method, Amount
  - All items unchecked by default
  - Select individual payments or "Select All"
  - Filter by payment method, date range, customer
  - Selected total shown prominently

- [ ] **Other funds section** (expandable):
  - For depositing money that didn't come from a recorded payment
  - Each line: Received From (contact), Account (revenue or other), Description, Amount
  - Add / remove line buttons

- [ ] **Summary:**
  - Selected payments total
  - Other funds total
  - Deposit total (sum of both)

- [ ] **Actions:**
  - "Save" — creates deposit, clears payments from Payments Clearing
  - "Save and New" — creates deposit, opens fresh deposit form
  - "Cancel"

- [ ] **Access points:**
  - From sidebar → Banking → "Make Deposit"
  - From dashboard → Action Items → "Payments to deposit" link (if any exist)
  - From "+ New" menu → "Bank Deposit"

### 5.7 Dashboard Integration

- [ ] Action Items card: show count of payments sitting in Payments Clearing
  - "5 payments ($3,750.00) ready to deposit" → links to Bank Deposit page
- [ ] If Payments Clearing balance > 0, show a subtle banner or badge

### 5.8 Item Reports

```
packages/web/src/features/reports/SalesByItemSummaryReport.tsx
packages/web/src/features/reports/SalesByItemDetailReport.tsx
```

- [ ] **Sales by Item Summary:**
  - Rows: each item
  - Columns: Quantity Sold, Amount, % of Total Sales
  - Date range filterable
  - Sort by amount, quantity, or name

- [ ] **Sales by Item Detail:**
  - Rows: individual transactions
  - Grouped under each item
  - Columns: Date, Transaction Type, Transaction No., Customer, Quantity, Rate, Amount
  - Drill-down to transaction detail

---

## 6. Build Checklist

### 6.1 Database & Shared Types
- [ ] Create migration: `items` table (name, description, unit_price, income_account_id, is_taxable, is_active)
- [ ] Create migration: add `item_id` column to `journal_lines`
- [ ] Create migration: `payment_applications` table
- [ ] Create migration: `deposit_lines` table
- [ ] Create migration: add `default_line_entry_mode` to `companies`
- [ ] Create `packages/shared/src/types/items.ts` — `Item`, `CreateItemInput`, `UpdateItemInput`
- [ ] Create `packages/shared/src/types/payments.ts` — `ReceivePaymentInput`, `PaymentApplication`, `DepositInput`, `DepositLine`, `PendingDeposit`
- [ ] Create `packages/shared/src/schemas/items.ts` — Zod schemas
- [ ] Create `packages/shared/src/schemas/payments.ts` — Zod schemas

### 6.2 API — Items
- [ ] Create `packages/api/src/db/schema/items.ts` — Drizzle schema
- [ ] Create `packages/api/src/services/items.service.ts` — CRUD, CSV import/export
- [ ] Create `packages/api/src/routes/items.routes.ts` — all item endpoints
- [ ] Audit trail on all item operations
- [ ] Write Vitest tests:
  - [ ] Item CRUD (create, update, deactivate)
  - [ ] Name uniqueness enforcement
  - [ ] Deactivated item not returned in active-only queries
  - [ ] CSV import creates items with correct accounts
  - [ ] CSV export matches import format

### 6.3 API — Payments & Deposits
- [ ] Create `packages/api/src/db/schema/payments.ts` — Drizzle schema for payment_applications, deposit_lines
- [ ] Create `packages/api/src/services/payment.service.ts` — receivePayment, getOpenInvoices, getPaymentsForInvoice, unapplyPayment
- [ ] Update `packages/api/src/services/deposit.service.ts` — getPendingDeposits, createDeposit (enhanced with deposit_lines), getDeposit
- [ ] Create `packages/api/src/routes/payments.routes.ts` — receive payment endpoint
- [ ] Update `packages/api/src/routes/deposits.routes.ts` — pending deposits + create deposit endpoints
- [ ] Payment → invoice status cascade: update amount_paid, balance_due, invoice_status on each application
- [ ] Deposit → validate source transactions are in Payments Clearing and not already deposited
- [ ] Audit trail on all payment and deposit operations
- [ ] Write Vitest tests:
  - [ ] Receive full payment → invoice status changes to 'paid'
  - [ ] Receive partial payment → invoice status changes to 'partial', balance_due correct
  - [ ] Payment applied to multiple invoices → each invoice updated correctly
  - [ ] Overpayment → remaining amount tracked (customer credit)
  - [ ] Payment to Payments Clearing → shows in pending deposits
  - [ ] Payment directly to bank → does NOT show in pending deposits
  - [ ] Bank deposit from 3 payments → Payments Clearing debited 3 times, bank credited once
  - [ ] Deposit rejects already-deposited payments
  - [ ] Deposit with other funds → additional journal lines created
  - [ ] Unapply payment → invoice balance_due restored, invoice status reverted

### 6.4 API — Item Reports
- [ ] Add `buildSalesByItemSummary(tenantId, startDate, endDate)` to report service
- [ ] Add `buildSalesByItemDetail(tenantId, startDate, endDate, itemId?)` to report service
- [ ] Add routes for both reports
- [ ] Write Vitest tests for report accuracy

### 6.5 Frontend — Items UI
- [ ] Create `ItemsListPage.tsx` — item list with search, active filter, CRUD
- [ ] Create `ItemFormModal.tsx` — create/edit modal (name, description, unit price, income account, taxable)
- [ ] Create `ItemSelector.tsx` — reusable searchable dropdown with inline quick-add
- [ ] Create `packages/web/src/api/hooks/useItems.ts` — React Query hooks
- [ ] Add "Items" to sidebar navigation
- [ ] CSV import modal with column mapping

### 6.6 Frontend — Invoice Line Mode Switching
- [ ] Update `InvoiceLineItem.tsx` — add item mode alongside category mode
- [ ] Per-line mode toggle (Category / Item icon button)
- [ ] Item selection auto-fills description, rate, income account, taxable
- [ ] Override any auto-filled value
- [ ] Add `default_line_entry_mode` setting to company preferences page
- [ ] Update Cash Sale, Estimate, and Credit Memo forms with same line mode switching
- [ ] Store `item_id` on journal_lines when item is used

### 6.7 Frontend — Receive Payment
- [ ] Create `ReceivePaymentPage.tsx` — full receive payment form
- [ ] Customer selector → loads open invoices
- [ ] Open invoices table with checkbox selection and editable payment amounts
- [ ] Auto-apply logic (oldest first)
- [ ] Deposit-to account selector (Payments Clearing default, bank accounts listed)
- [ ] Payment method dropdown
- [ ] Save / Save and New / Cancel actions
- [ ] Access from: invoice detail, invoice list action menu, sidebar, "+ New" menu

### 6.8 Frontend — Bank Deposit
- [ ] Create `BankDepositPage.tsx` — full deposit form
- [ ] Pending payments table (from Payments Clearing) with checkboxes
- [ ] Filter pending payments by method, date, customer
- [ ] Other funds section for ad hoc deposit items
- [ ] Deposit total calculation
- [ ] Save / Save and New / Cancel actions
- [ ] Access from: sidebar Banking, dashboard action items, "+ New" menu

### 6.9 Frontend — Reports & Dashboard
- [ ] Create `SalesByItemSummaryReport.tsx`
- [ ] Create `SalesByItemDetailReport.tsx`
- [ ] Add both to Reports section in sidebar under "Sales"
- [ ] Update dashboard Action Items: show pending deposit count and amount
- [ ] Add "Receive Payment" and "Bank Deposit" to the "+ New" quick-create menu

### 6.10 Ship Gate
- [ ] Item CRUD: create, edit, deactivate — all work
- [ ] Item on invoice (item mode): select item → description, rate, account, taxable auto-fill → save invoice → journal lines correct with item_id
- [ ] Item on invoice (override): select item → change rate → save → uses overridden rate, not default
- [ ] Mixed invoice: line 1 = item mode, line 2 = category mode → both lines save correctly
- [ ] Company default line mode: set to "Item" → new invoices default to item selector
- [ ] CSV import: 20 items imported with names, prices, accounts
- [ ] Receive full payment: invoice balance goes to $0, status = 'paid', payment lands in Payments Clearing
- [ ] Receive partial payment: invoice balance reduced, status = 'partial'
- [ ] Payment applied to 3 invoices: each invoice's amount_paid updated correctly
- [ ] Auto-apply: enter $5,000 → clicks "Apply automatically" → allocates to oldest invoices first
- [ ] Receive payment directly to bank: payment does NOT appear in pending deposits
- [ ] Pending deposits list: shows all payments in Payments Clearing with correct totals
- [ ] Bank deposit: select 4 payments → save → DR Bank, CR Payments Clearing × 4, all balanced
- [ ] Bank deposit with other funds: additional line for cash over → journal lines correct
- [ ] Deposited payments no longer appear in pending deposits list
- [ ] Dashboard shows "4 payments ($3,750) ready to deposit" when payments are pending
- [ ] Sales by Item Summary report: items listed with correct quantities and amounts
- [ ] Sales by Item Detail report: individual transactions grouped under each item
- [ ] Estimate with items: convert to invoice → items carry over with correct defaults
- [ ] Cash sale with items: posts correctly
- [ ] Deactivated item: still visible on past transactions, not selectable for new ones
- [ ] All Vitest tests passing
- [ ] QUESTIONS.md reviewed and resolved
