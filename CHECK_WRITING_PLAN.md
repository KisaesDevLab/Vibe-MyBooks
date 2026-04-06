# KIS Books — Check Writing & Printing Feature Plan

**Feature:** Write, queue, and print checks in standard voucher and 3-per-page formats, on pre-printed or blank check stock
**Date:** April 2, 2026
**Depends on:** BUILD_PLAN.md Phases 1–4 (auth, COA, contacts, transaction engine)
**Integrates with:** Account Register, Batch Entry, Banking/Reconciliation, Reports

---

## Feature Overview

Check writing adds a formal check transaction type to KIS Books with the ability to print physical checks on standard check stock from the browser. Users write checks to pay vendors, contractors, or any other payee, queue them for printing, and batch-print to their printer — all without leaving the app.

### What this adds to the existing system

The current BUILD_PLAN.md has an "Expense" transaction type that records payments from a bank account. Check writing extends this with:

- A dedicated **Write Check** form with check-specific fields (check number, payee address, printed memo)
- A **Print Later** queue that accumulates checks waiting to be printed
- A **Print Checks** batch screen that sends formatted check output to the browser's print dialog
- **Two print formats:** voucher (1 per page with two detail stubs) and standard (3 per page)
- **Blank stock printing:** the check layout includes MICR-encoded routing/account numbers and bank info, so users can print on blank security paper instead of ordering expensive pre-printed stock
- **Check alignment** controls so users can fine-tune positioning to match their specific check stock and printer

### What it does NOT include

- Digital/electronic payments (ACH, wire) — future feature
- Positive pay file generation — future feature
- Check signing (physical signature printing) — users sign by hand
- Check images/deposit capture — future feature

---

## 1. Data Model

No new tables needed. Checks are a specialization of the existing `transactions` table with additional fields.

### 1.1 Transaction Table Additions

```sql
ALTER TABLE transactions ADD COLUMN check_number INT;
ALTER TABLE transactions ADD COLUMN print_status VARCHAR(20);
  -- NULL (not a printable check), 'queue' (waiting to print), 'printed', 'hand_written'
ALTER TABLE transactions ADD COLUMN payee_name_on_check VARCHAR(255);
  -- May differ from the contact display_name (e.g., "John Smith" vs "Smith Consulting LLC")
ALTER TABLE transactions ADD COLUMN payee_address TEXT;
  -- Full mailing address printed on check (optional)
ALTER TABLE transactions ADD COLUMN printed_memo VARCHAR(255);
  -- Memo line printed on the physical check (separate from internal memo)
ALTER TABLE transactions ADD COLUMN printed_at TIMESTAMPTZ;
ALTER TABLE transactions ADD COLUMN print_batch_id UUID;
  -- Groups checks that were printed together for reprint/void tracking

CREATE INDEX idx_txn_print_status ON transactions(tenant_id, print_status) 
  WHERE print_status IS NOT NULL;
CREATE INDEX idx_txn_check_number ON transactions(tenant_id, check_number) 
  WHERE check_number IS NOT NULL;
```

### 1.2 Check Print Settings (Company-Level)

```sql
ALTER TABLE companies ADD COLUMN check_settings JSONB DEFAULT '{
  "format": "voucher",
  "bank_name": "",
  "bank_address": "",
  "routing_number": "",
  "account_number": "",
  "fractional_routing": "",
  "print_on_blank_stock": false,
  "print_company_info": true,
  "print_signature_line": true,
  "alignment_offset_x": 0,
  "alignment_offset_y": 0,
  "next_check_number": 1001,
  "default_bank_account_id": null
}'::jsonb;
```

**Fields:**
- `format`: `"voucher"` (1 per page, check + 2 stubs) or `"standard"` (3 per page)
- `bank_name`, `bank_address`: printed on blank stock checks
- `routing_number`, `account_number`: printed as MICR line on blank stock
- `fractional_routing`: the fractional routing number printed in the upper-right corner of checks (e.g., "12-345/6789")
- `print_on_blank_stock`: if true, includes all bank info and MICR line; if false, only prints variable data (for pre-printed stock)
- `print_company_info`: print company name/address on check (typically pre-printed on stock)
- `print_signature_line`: print a "Signature" line on the check
- `alignment_offset_x`, `alignment_offset_y`: pixel offsets to adjust print positioning
- `next_check_number`: auto-incrementing starting number
- `default_bank_account_id`: default bank account for new checks

---

## 2. Check Formats & Layout

### 2.1 Voucher Check (1 per page)

Full page: 8.5" × 11" (letter size). Three sections, each ~3.5" tall.

```
┌─────────────────────────────────────────────────────────┐
│  CHECK (top third — 3.5")                               │
│                                                         │
│  [Company Name]                    Check No. 1001       │
│  [Company Address]                 Date: 03/15/2026     │
│                                                         │
│  Pay to the order of: ___John Smith________________     │
│                                                         │
│  **One Thousand Five Hundred and 00/100*************    │
│                                                    $1,500.00
│                                                         │
│  [Bank Name]                                            │
│  [Bank Address]           Memo: March consulting____    │
│                                                         │
│  ⑆091000019⑆ ⑇123456789⑇ 1001                         │
│  (MICR line — routing, account, check number)           │
├─────────────────────────────────────────────────────────┤
│  STUB 1 (middle third — 3.5") — Detachable stub        │
│                                                         │
│  [Company Name]           Check No: 1001                │
│  Pay to: John Smith       Date: 03/15/2026              │
│  Amount: $1,500.00        Bank: Business Checking       │
│                                                         │
│  Account               Description              Amount  │
│  ─────────────────────────────────────────────────────  │
│  6500 Professional Fees March consulting       1,500.00 │
│                                                         │
│  Memo: March consulting services                        │
├─────────────────────────────────────────────────────────┤
│  STUB 2 (bottom third — 3.5") — Identical to stub 1    │
│  (one copy for the payee, one for the payor's records)  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 2.2 Standard Check (3 per page)

Full page: 8.5" × 11". Three checks, each ~3.5" tall. No stubs.

```
┌─────────────────────────────────────────────────────────┐
│  CHECK 1 (3.5")                                         │
│  [Same check layout as voucher, without stubs]          │
│  ⑆091000019⑆ ⑇123456789⑇ 1001                         │
├─────────────────────────────────────────────────────────┤
│  CHECK 2 (3.5")                                         │
│  ⑆091000019⑆ ⑇123456789⑇ 1002                         │
├─────────────────────────────────────────────────────────┤
│  CHECK 3 (3.5")                                         │
│  ⑆091000019⑆ ⑇123456789⑇ 1003                         │
├─────────────────────────────────────────────────────────┤
│  (½" stub/margin at bottom)                             │
└─────────────────────────────────────────────────────────┘
```

### 2.3 Check Face Layout (Detail)

The check face (used in both formats) follows the standard US check layout:

```
┌─────────────────────────────────────────────────────────┐
│ [Company Name]                              No. [1001]  │
│ [Address Line 1]                     [Date ___/___/___] │
│ [Address Line 2]                                        │
│ [City, State ZIP]                                       │
│                                                         │
│ Pay to the                                              │
│ order of ___[Payee Name]___________________  $ [Amount] │
│                                                         │
│ [Amount in words]******************************* DOLLARS│
│                                                         │
│ [Bank Name]                                             │
│ [Bank Address]        Memo [___________________]        │
│                       ________________________________  │
│                                        Authorized Sig.  │
│                                                         │
│ ⑆[Routing]⑆ ⑇[Account]⑇ [Check No.]                   │
└─────────────────────────────────────────────────────────┘
```

### 2.4 Amount in Words

Convert numeric amount to words for the check face. Standard US check format:

| Amount | Words |
|---|---|
| $1,500.00 | One Thousand Five Hundred and 00/100 |
| $42.50 | Forty-Two and 50/100 |
| $10,000.00 | Ten Thousand and 00/100 |
| $0.99 | Zero and 99/100 |

The cents portion is always displayed as a fraction (XX/100). Asterisks fill the remaining space to prevent alteration.

### 2.5 MICR Line (Blank Stock Only)

The MICR (Magnetic Ink Character Recognition) line at the bottom of the check uses the E-13B font standard:

```
⑆091000019⑆ ⑇123456789⑇ 0001001
 ↑ routing    ↑ account    ↑ check number
```

- `⑆` = transit symbol (brackets around routing number)
- `⑇` = on-us symbol (brackets around account number)
- Font: E-13B MICR (a free web font can be embedded, or users can install a MICR font)
- Position: 0.1875" from bottom edge, 0.625" from left edge (ABA standard)

Note: Checks printed on blank stock with a standard laser printer won't have magnetic ink. They are still accepted by most banks for deposit (including mobile deposit) but may not be machine-readable at all institutions. The plan includes a disclaimer in the print settings.

---

## 3. API Endpoints

### 3.1 Write Check

```
POST   /api/v1/checks                      # Create check (posts immediately or queues for printing)
GET    /api/v1/checks                       # List checks (filterable: status, date, payee, bank account)
GET    /api/v1/checks/:id                   # Get single check
PUT    /api/v1/checks/:id                   # Update check (only if print_status = 'queue' or 'hand_written')
POST   /api/v1/checks/:id/void             # Void a check
```

### 3.2 Print Queue

```
GET    /api/v1/checks/print-queue           # List all checks with print_status = 'queue', by bank account
POST   /api/v1/checks/print                 # Mark selected checks as printed, assign check numbers
POST   /api/v1/checks/reprint/:batchId      # Reprint a batch (reset to queue, reassign numbers)
```

**POST /checks/print request:**

```json
{
  "bank_account_id": "uuid",
  "check_ids": ["uuid", "uuid", "uuid"],
  "starting_check_number": 1001,
  "format": "voucher"
}
```

**Response:**

```json
{
  "batch_id": "uuid",
  "checks_printed": 3,
  "check_number_range": "1001–1003",
  "pdf_url": "/api/v1/checks/print-batch/uuid/pdf"
}
```

### 3.3 Print Output

```
GET    /api/v1/checks/print-batch/:batchId/pdf   # Download formatted PDF for printing
GET    /api/v1/checks/:id/pdf                     # Single check PDF (for reprints)
```

### 3.4 Check Settings

```
GET    /api/v1/company/check-settings       # Get check print settings
PUT    /api/v1/company/check-settings       # Update check print settings
POST   /api/v1/company/check-alignment-test # Generate alignment test PDF
```

---

## 4. Service Layer

### 4.1 Check Service

```
packages/api/src/services/check.service.ts
```

- [ ] `createCheck(tenantId, input)`:
  - Create transaction with `txn_type = 'expense'` and check-specific fields populated
  - Journal lines: DR Expense/Asset Account, CR Bank Account
  - For split checks (multiple accounts): multiple DR lines, one CR to bank
  - If `print_later = true`: set `print_status = 'queue'`, leave `check_number = NULL`
  - If `print_later = false`: set `print_status = 'hand_written'`, assign next check number immediately
  - Auto-fill `payee_name_on_check` from contact's `display_name` (editable)
  - Auto-fill `payee_address` from contact's billing address (editable)
  - Return created check

- [ ] `updateCheck(tenantId, checkId, input)`:
  - Only allowed if `print_status` is `'queue'` or `'hand_written'`
  - Printed checks cannot be edited — must be voided and rewritten

- [ ] `voidCheck(tenantId, checkId, reason)`:
  - Uses existing void logic (reversing journal entry)
  - Keeps the check number assigned (void checks retain their number for audit trail)
  - Sets `print_status = NULL`

- [ ] `getCheckById(tenantId, checkId)`:
  - Return check with journal lines, contact info, bank account info

- [ ] `listChecks(tenantId, filters)`:
  - Filter by: bank account, date range, payee, print status, check number range
  - Sort by: date, check number, payee, amount

### 4.2 Print Queue Service

```
packages/api/src/services/check-print.service.ts
```

- [ ] `getPrintQueue(tenantId, bankAccountId)`:
  - Return all checks with `print_status = 'queue'` for the specified bank account
  - Sorted by creation date (FIFO)
  - Include: payee name, date, amount, memo

- [ ] `printChecks(tenantId, bankAccountId, checkIds, startingNumber, format)`:
  - Validate all checks belong to the specified bank account
  - Validate all checks have `print_status = 'queue'`
  - Assign sequential check numbers starting from `startingNumber`
  - Set `print_status = 'printed'`, `printed_at = NOW()`
  - Assign a shared `print_batch_id` to all checks in this print run
  - Update company's `next_check_number` to one past the last assigned
  - Generate print-ready PDF (see §4.3)
  - Return batch summary with PDF URL

- [ ] `reprintBatch(tenantId, batchId)`:
  - Reset all checks in the batch to `print_status = 'queue'`
  - Clear `printed_at`
  - User must re-run printChecks to assign new (or same) numbers
  - Use case: printer jammed, checks came out misaligned

### 4.3 Check PDF Service

```
packages/api/src/services/check-pdf.service.ts
```

- [ ] `generateCheckPdf(tenantId, checks, format, settings)`:
  - Takes an array of check transactions and the print format
  - Returns a PDF buffer ready for download/printing
  - **Voucher format:** one page per check (check + 2 stubs)
  - **Standard format:** 3 checks per page, pad last page with blanks if not divisible by 3
  - Applies alignment offsets from settings

- [ ] `generateAlignmentTestPdf(tenantId, format, settings)`:
  - Produces a single page with alignment grid lines and sample data
  - User prints on blank paper, holds up against check stock, adjusts offsets

- [ ] `numberToWords(amount)`:
  - Convert numeric amount to check words format
  - "One Thousand Five Hundred and 00/100"
  - Handle edge cases: zero, amounts over $999,999.99, negative (reject)

- [ ] **PDF layout engine:**
  - Uses Puppeteer or @react-pdf/renderer to generate precise PDF at 72 DPI
  - All measurements in inches, matching US check stock dimensions
  - MICR font embedded for routing/account/check number line (E-13B)
  - Company logo positioned top-left of check face (if blank stock mode)
  - Amount in both numeric ($1,500.00) and words format
  - Payee address block (optional, for window envelopes)
  - Voucher stubs: itemize journal lines (account name, description, amount)

---

## 5. Frontend Components

### 5.1 Write Check Page

```
packages/web/src/features/checks/WriteCheckPage.tsx
```

- [ ] **Header:**
  - Bank account selector (defaults to company's default checking account)
  - Current bank balance displayed

- [ ] **Check form (mimics the visual layout of a physical check):**
  - Payee selector (contact dropdown — vendor or customer, with quick-add)
  - Payee name on check (auto-filled from contact, editable — for cases where the legal name differs)
  - Date (defaults to today)
  - Check number (auto-filled if hand-written, blank if print-later)
  - Amount (currency input — large, prominent)
  - Amount in words (auto-generated, displayed read-only as preview)
  - Payee address (auto-filled from contact billing address, editable, optional)
  - Printed memo (the memo line on the physical check)
  - Internal memo (does not print)

- [ ] **Expense detail section (below the check face):**
  - Line items: Account, Description, Amount
  - Split capability: multiple lines that sum to the check total
  - Add / remove line buttons
  - Item mode: optionally select from items list (if items feature is built)
  - Tags (if tags feature is built)

- [ ] **Action buttons:**
  - "Save and Print" — saves check, adds to print queue, opens Print Checks screen
  - "Save and Queue" — saves check with `print_status = 'queue'`
  - "Save" — saves as hand-written check (assigns number immediately)
  - "Clear" — reset form

- [ ] **Access points:**
  - Sidebar → Transactions → "Write Check"
  - "+ New" menu → "Check"
  - Account register → FAB / entry row → "Check" type
  - Batch Entry → "Expense" type (checks flow through as expenses with check numbers)

### 5.2 Print Checks Page

```
packages/web/src/features/checks/PrintChecksPage.tsx
```

- [ ] **Toolbar:**
  - Bank account selector (filters the queue)
  - Starting check number input (auto-filled from company settings, editable)
  - Format toggle: Voucher / Standard
  - "Select All" / "Deselect All" buttons

- [ ] **Print queue table:**
  - Columns: Checkbox, Date Created, Payee, Amount, Memo
  - Sorted by creation date
  - Select individual checks or all
  - Total selected: count and dollar amount

- [ ] **Print actions:**
  - "Preview" — opens PDF in a new browser tab or inline preview panel
  - "Print" — generates PDF → opens browser print dialog
  - After printing: confirmation dialog "Did the checks print correctly?"
    - "Yes" → marks selected checks as printed, assigns check numbers
    - "No, reprint" → keeps checks in queue for another attempt
    - "Some printed, some didn't" → lets user check off which ones printed correctly

- [ ] **Access points:**
  - Sidebar → Transactions → "Print Checks" (shows badge count of queued checks)
  - After saving a check with "Save and Queue"
  - Dashboard action items → "N checks ready to print" link

### 5.3 Check Print Settings Page

```
packages/web/src/features/settings/CheckPrintSettingsPage.tsx
```

- [ ] **Check format:**
  - Radio buttons: Voucher (1 per page) / Standard (3 per page)
  - Visual preview of each format

- [ ] **Stock type:**
  - Radio buttons: Pre-printed check stock / Blank stock
  - If pre-printed: only variable data prints (payee, amount, date, memo)
  - If blank stock: full check layout prints including bank info and MICR line

- [ ] **Bank information (visible when blank stock selected):**
  - Bank name
  - Bank address (line 1, line 2)
  - Routing number (validated: 9 digits, ABA checksum)
  - Account number
  - Fractional routing number (optional)

- [ ] **Print options:**
  - Print company name and address on check (toggle)
  - Print signature line (toggle)
  - Print payee address (toggle — for window envelopes)
  - Default bank account for new checks

- [ ] **Alignment:**
  - Horizontal offset (pixels, + or -)
  - Vertical offset (pixels, + or -)
  - "Print Alignment Test" button → generates test page PDF
  - Instructions: "Print on blank paper. Hold against your check stock. Adjust offsets until text aligns with the fields."

- [ ] **Check numbering:**
  - Next check number (editable)
  - Note: "This number auto-increments after each print run."

- [ ] **MICR disclaimer** (shown when blank stock is selected):
  - "Checks printed on blank stock with a standard laser printer do not use magnetic ink. Most banks accept laser-printed checks for deposit, including mobile deposit. Verify with your bank if you plan to use blank stock for high-value or regular payments."

- [ ] Add "Check Printing" section under Settings in sidebar

### 5.4 Check Register Integration

The account register for bank accounts already displays all transactions. Checks appear with their check number in the Ref No. column and a print status indicator.

- [ ] Check number column shows in the register for bank accounts
- [ ] Print status indicator: 🖨 (queued), ✓ (printed), ✍ (hand-written)
- [ ] From the register, user can click a check to view/edit
- [ ] Void check action available from the register

### 5.5 Dashboard Integration

- [ ] Action Items card: show count of checks in the print queue
  - "3 checks ($4,250.00) ready to print" → links to Print Checks page

---

## 6. Build Checklist

### 6.1 Database & Shared Types
- [ ] Create migration: add `check_number`, `print_status`, `payee_name_on_check`, `payee_address`, `printed_memo`, `printed_at`, `print_batch_id` to `transactions` table
- [ ] Create migration: add `check_settings` JSONB column to `companies` table
- [ ] Add indexes on `print_status` and `check_number`
- [ ] Create `packages/shared/src/types/checks.ts` — `WriteCheckInput`, `PrintCheckInput`, `CheckSettings`, `PrintBatchResult`
- [ ] Create `packages/shared/src/schemas/checks.ts` — Zod schemas for all check inputs
- [ ] Create `packages/shared/src/utils/number-to-words.ts` — amount-to-words converter with tests

### 6.2 API — Check Service
- [ ] Create `packages/api/src/services/check.service.ts` — createCheck, updateCheck, voidCheck, listChecks
- [ ] Create `packages/api/src/services/check-print.service.ts` — getPrintQueue, printChecks, reprintBatch
- [ ] Create `packages/api/src/services/check-pdf.service.ts` — generateCheckPdf, generateAlignmentTestPdf
- [ ] Create `packages/api/src/routes/checks.routes.ts` — all check endpoints
- [ ] Update company routes for check settings endpoints
- [ ] Implement number-to-words conversion with edge case handling
- [ ] Implement voucher PDF layout (check face + 2 stubs per page)
- [ ] Implement standard PDF layout (3 checks per page, blank padding)
- [ ] Implement MICR line rendering with E-13B font embedding
- [ ] Implement alignment offset application in PDF generation
- [ ] Implement split check support (multiple expense lines on one check)
- [ ] Implement check number auto-assignment and company next_check_number update
- [ ] Implement print batch tracking (batch_id grouping)
- [ ] Implement ABA routing number validation (9-digit checksum)
- [ ] Audit trail on all check operations (create, print, void, reprint)
- [ ] Write Vitest tests:
  - [ ] Check creation posts correct journal lines (DR expense, CR bank)
  - [ ] Split check: 3 expense lines, 1 bank credit, totals balance
  - [ ] Print-later check has print_status = 'queue' and no check number
  - [ ] Hand-written check has print_status = 'hand_written' and assigned number
  - [ ] Print batch assigns sequential numbers starting from specified start
  - [ ] Company next_check_number updates after print
  - [ ] Printed check cannot be edited (returns 400)
  - [ ] Queued check can be edited
  - [ ] Void check creates reversing entry, retains check number
  - [ ] Reprint resets batch to queue status
  - [ ] Number-to-words: $0.99, $1.00, $42.50, $1500.00, $999999.99
  - [ ] ABA routing checksum validates correctly
  - [ ] PDF generates without error for voucher format
  - [ ] PDF generates without error for standard format
  - [ ] Alignment offset shifts content in generated PDF

### 6.3 Frontend — Check UI
- [ ] Create `WriteCheckPage.tsx` — check form with visual check layout
- [ ] Create `PrintChecksPage.tsx` — print queue with selection and print/preview
- [ ] Create `CheckPrintSettingsPage.tsx` — format, stock type, bank info, alignment, numbering
- [ ] Create `packages/web/src/api/hooks/useChecks.ts` — React Query hooks
- [ ] Implement check form payee auto-fill from contact (name + address)
- [ ] Implement amount-to-words live preview on check form
- [ ] Implement split check line items (multiple accounts summing to total)
- [ ] Implement print queue with select/deselect and batch totals
- [ ] Implement PDF preview (open in new tab or inline iframe)
- [ ] Implement post-print confirmation flow ("Did checks print correctly?")
- [ ] Implement alignment test PDF generation and print
- [ ] Implement MICR disclaimer for blank stock mode
- [ ] Implement routing number validation with real-time feedback
- [ ] Add "Write Check" to sidebar under Transactions
- [ ] Add "Print Checks" to sidebar under Transactions (with queue badge count)
- [ ] Add "Check" to "+ New" quick-create menu
- [ ] Add "Check Printing" to Settings sidebar section
- [ ] Update dashboard Action Items with print queue count

### 6.4 Integration Updates
- [ ] Update account register: show check number in Ref No. column, print status indicator
- [ ] Update account register inline entry: "Check" as a transaction type option
- [ ] Update batch entry: checks can be entered as expense type rows and marked for printing via a "Print Later" column toggle
- [ ] Update Check Register report (§7.4 of proposal): include check number, payee, print status columns
- [ ] Checks appear in all existing reports as expense transactions (no special handling needed)

### 6.5 Ship Gate
- [ ] Write check with single expense line → journal lines balanced, transaction saved
- [ ] Write check with 3 split lines → all lines post correctly, sum equals check total
- [ ] "Save and Queue" → check appears in print queue with no check number
- [ ] "Save" (hand-written) → check number assigned immediately from next_check_number
- [ ] Print queue shows correct checks filtered by bank account
- [ ] Select 3 checks → Preview → PDF shows 3 voucher pages (or 1 standard page with 3 checks)
- [ ] Print → confirm "Yes" → check numbers assigned (1001, 1002, 1003), print_status = 'printed'
- [ ] Company next_check_number updated to 1004
- [ ] Print → confirm "No, reprint" → checks remain in queue, no numbers assigned
- [ ] Reprint batch → checks reset to queue
- [ ] Printed check → attempt edit → blocked (400 error)
- [ ] Void printed check → reversing entry created, check number retained
- [ ] Blank stock: PDF includes company info, bank info, MICR line with correct routing/account
- [ ] Pre-printed stock: PDF only includes variable data (payee, date, amount, memo)
- [ ] Alignment offset: changing offset visibly shifts content in PDF
- [ ] Alignment test page prints with grid lines
- [ ] Amount in words: "$1,234.56" renders as "One Thousand Two Hundred Thirty-Four and 56/100"
- [ ] Check appears in bank register with check number and print status icon
- [ ] Dashboard shows "3 checks ready to print" when queue is populated
- [ ] ABA routing number validation rejects invalid numbers in settings
- [ ] All Vitest tests passing
- [ ] QUESTIONS.md reviewed and resolved
