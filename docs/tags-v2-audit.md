# Tags V2 — Discovery & Audit (Phase 1 Deliverable)

**Workstream:** ADR 0XX / 0XY / 0XZ / 0XW (split-level tags + resolver + two-line split row + tag budgets).
**Date:** 2026-04-19
**Branch:** `feat/split-level-tags-v2`
**Scope:** inventory every place `tag_id` / `tags` / `transaction_tags` is read or written so we know the blast radius before Phase 3.

> The master build plan (`docs/plans/split-level-tags-build-plan.md`, gitignored) and the four ADRs listed above are the authoritative spec. This audit confirms what those docs assumed vs. what the repo actually contains.

---

## 1. Core finding — the data model is unified, not per-type

The ADR set was written against a QuickBooks-style schema (one header table + one line table per transaction type). **This repo does not have that.** It uses a unified double-entry ledger:

| ADR assumed | Repo actually has |
|---|---|
| 9 header tables: `expenses`, `bills`, `invoices`, `vendor_credits`, `sales_receipts`, `deposits`, `transfers`, `journal_entries`, `checks` | One `transactions` table, discriminated by `txn_type varchar(30)` |
| 9 line tables: `expense_lines`, `bill_lines`, … | One `journal_lines` table, keyed by `transaction_id` |
| Separate `vendors` table (and implicitly `customers`) | Unified `contacts` with `contact_type IN ('customer','vendor','both')` |
| Header-level single `tag_id` column | `transaction_tags(transaction_id, tag_id)` many-to-many junction |

`deposit_lines` exists in `packages/api/src/db/schema/items.ts` but is a deposit-clearing linker (`deposit_id`, `source_transaction_id`, `amount`), not a line-items table. Out of scope for this workstream.

The consolidated addendum `docs/adr/0X-addendum-repo-alignment.md` (local-only) documents how each ADR was re-shaped to this model:

- **ADR 0XX §2.3 DDL** → single `ALTER TABLE journal_lines ADD COLUMN tag_id …` (see migration `0059_split_level_tags.sql`).
- **ADR 0XX §4 header-tag compatibility** → `transaction_tags` junction is the header surface; ledger's `syncTransactionTagsFromLines` keeps it in sync when the flag is on.
- **ADR 0XY §2.1 vendor default** → `contacts.default_tag_id`; the resolver only reads it when `contact_type IN ('vendor','both')`.
- **ADR 0XW §2.2 normalized budget shape** → added new `budget_periods` table alongside the existing `budget_lines` (`month_1..month_12`) to stay additive per CLAUDE.md #13.

---

## 2. Schema and migrations touched

Migrations added (all additive):

| File | Touches |
|---|---|
| `packages/api/src/db/migrations/0059_split_level_tags.sql` | `journal_lines.tag_id` + FK to `tags(id) ON DELETE RESTRICT` + two partial indexes + backfill from `transaction_tags` (first-assigned wins) |
| `packages/api/src/db/migrations/0060_default_tag_sources.sql` | `items.default_tag_id`, `contacts.default_tag_id`, `bank_rules.assign_tag_id` — all nullable, FK'd, indexed |
| `packages/api/src/db/migrations/0061_tag_budgets.sql` | `budgets` extended: `tag_id`, `description`, `period_type`, `status`, `fiscal_year_start`, `created_by`. New `budget_periods` table (normalized per-period rows). Backfilled from `month_N` columns via LATERAL unpivot. |

Pre-existing orphan `0058_recurring_schedules_is_active_bool.sql` was registered in `_journal.json` at the same time (it had been on disk but unlisted).

Drizzle schema files touched:

- `packages/api/src/db/schema/transactions.ts` — `journalLines.tagId` + indexes
- `packages/api/src/db/schema/items.ts` — `defaultTagId` + index
- `packages/api/src/db/schema/contacts.ts` — `defaultTagId` + index
- `packages/api/src/db/schema/bank-rules.ts` — `assignTagId` + index
- `packages/api/src/db/schema/budgets.ts` — new columns + new `budgetPeriods` table

---

## 3. Zod schemas gaining `tagId`

Per-line input schemas in `packages/shared/src/schemas/`:

- `transactions.ts` — `journalLineInputSchema` (JE lines), `createExpenseSchema.lines[]`, `depositLineSchema`, `lineItemSchema` (shared by invoice + cash sale), `createCreditMemoSchema.lines[]`
- `ap.ts` — `billLineSchema`, `vendorCreditLineSchema`
- `checks.ts` — `writeCheckSchema.lines[]`

Settings schemas (ADR 0XY):

- `items.ts` — `createItemSchema`, `updateItemSchema` (`defaultTagId`)
- `contacts.ts` — `createContactSchema`, `updateContactSchema` (`defaultTagId`)
- `bank-rules.ts` — `createBankRuleSchema`, `updateBankRuleSchema` (`assignTagId`)

Default shape: `z.string().uuid().nullable().optional()`. Null = explicit untagged; undefined = caller didn't send a value.

---

## 4. Services changed

Write path — per-type services now forward `tagId` (3-state) without coercing undefined to null, so the ledger resolver can distinguish "user cleared" from "not touched":

- `expense.service.ts`
- `bill.service.ts` (create + update)
- `invoice.service.ts` (revenue lines; AR + sales-tax lines stay untagged)
- `check.service.ts`
- `deposit.service.ts`
- `cash-sale.service.ts` (revenue lines)
- `credit-memo.service.ts`
- `journal-entry.service.ts` — already passes through via `JournalLineInput`

Ledger (`ledger.service.ts`):

- `postTransaction` and `updateTransaction` resolve default tag per line via `resolveDefaultTag` with `contactDefaultTagId` pre-loaded for the header contact.
- `syncTransactionTagsFromLines` mirrors the distinct set of line tags into `transaction_tags` when `TAGS_SPLIT_LEVEL_V2` is on.
- `getTransaction` now returns `tagId` per line.

Bank-feed categorization (`bank-feed.service.ts`):

- `categorize()` accepts `tagId` via `CategorizeInput` and stamps it onto the user-side line.
- `runCleansingPipeline()` passes `ruleResult.assignTagId` into the auto-categorize call.

Bank-rules engine (`bank-rules.service.ts`):

- `evaluateRules()` returns `assignTagId` in the matched-rule shape (tenant-scoped rules read from `rule.assignTagId`; global rules return null).

Budgets (`budget.service.ts`):

- `create()` / `update()` accept `tagId`, `periodType`, `status`, `description`, `fiscalYearStart`.
- `runTagScopedBudgetVsActuals()` — new function, aggregates actuals from `journal_lines` filtered by the budget's `tag_id` (gated behind `TAG_BUDGETS_V1`).

Reports (`report.service.ts`):

- `buildProfitAndLoss(…, tagId?)` — ADR 0XX §5.1 line-level filter via a conjunct on the journal_lines join.
- `buildGeneralLedger(…, tagId?)` — same treatment on both beginning-balance and period-activity joins.

---

## 5. Frontend forms touched

Line-level tag UI added (each via `<LineTagPicker compact />`):

| Form | File |
|---|---|
| Journal Entry | `packages/web/src/features/transactions/JournalEntryForm.tsx` (with `<SplitRowV2>` layout under `ENTRY_FORMS_V2`) |
| New Expense | `packages/web/src/features/transactions/ExpenseForm.tsx` |
| New Deposit | `packages/web/src/features/transactions/DepositForm.tsx` |
| New Cash Sale | `packages/web/src/features/transactions/CashSaleForm.tsx` |
| Enter Vendor Credit | `packages/web/src/features/ap/EnterVendorCreditPage.tsx` |
| Enter Bill | `packages/web/src/features/ap/EnterBillPage.tsx` |
| New Invoice | `packages/web/src/features/invoicing/InvoiceForm.tsx` |

Each form:

- Adds `tagId: string \| null` and `userHasTouchedTag: boolean` to its per-line state.
- Reads `tagId` from the loaded transaction's `JournalLine` on edit.
- Flattens the stickiness flag out of the payload; sends `tagId` to the API verbatim.

Remaining legacy forms not yet retrofitted (Severity 2 follow-up):

- Write Check form (payload already carries `tagId` via the updated `writeCheckSchema` — only UI input is missing).
- Register inline-entry row (`RegisterEntryRow.tsx`).
- Batch entry (column-visibility toggles planned separately).

---

## 6. Automations

- **Bank rules:** UI to set `assign_tag_id` on a rule not yet added. Applying a rule already flows the tag through (§4 above).
- **Recurring templates:** not yet migrated — header tag only.
- **AI categorization:** prompt unchanged — the LLM does not yet suggest a `tagId` per split. Extending the Zod response schema and the system prompt is a Phase 4/5 follow-up.

---

## 7. Report surface

- ✅ P&L — optional `tagId` parameter, line-level filter on the aggregation.
- ✅ General Ledger — optional `tagId` parameter, filters both beginning-balance and period-activity joins.
- ⚠️ Balance Sheet, Cash Flow, Trial Balance, Transaction Detail, AR/AP Aging, Sales by X, Expenses by X — pending.
- ⚠️ Exports (CSV / Excel) — `line_tag` column not yet added.
- ⚠️ Report parity test fixture — not yet authored. Required before rolling the flag in production.

---

## 8. Feature flags

| Flag | Location | Default | Gates |
|---|---|---|---|
| `TAGS_SPLIT_LEVEL_V2` | `packages/api/src/config/env.ts` | `false` | Mirrors `journal_lines.tag_id` into `transaction_tags` and runs the contact-default resolver in the ledger write path. |
| `ENTRY_FORMS_V2` | `packages/web/src/utils/feature-flags.ts` (via `import.meta.env.VITE_ENTRY_FORMS_V2`) | `false` | Enables the `<SplitRowV2>` layout in JournalEntryForm. Other forms use a compact tag column unconditionally. |
| `TAG_BUDGETS_V1` | `packages/api/src/config/env.ts` | `false` | Gates `runTagScopedBudgetVsActuals`. Budget create/update fields are accepted regardless; calc is flagged. |

All three flags are independent so either data-model, UI, or budgets rollout can be rolled back without touching the others.

---

## 9. Verification SQL (run manually against a staging DB after migration 0059)

```sql
-- 1. Every transaction that has a header tag should also have every
--    child journal_line tagged after backfill. Expected: zero rows.
SELECT t.id AS transaction_id,
       count(*) FILTER (WHERE jl.tag_id IS NULL) AS untagged_lines
FROM transactions t
JOIN transaction_tags tt ON tt.transaction_id = t.id
JOIN journal_lines jl ON jl.transaction_id = t.id
GROUP BY t.id
HAVING count(*) FILTER (WHERE jl.tag_id IS NULL) > 0;

-- 2. Sanity-check totals per tenant — count of posted txns with any
--    header tag vs. count of journal lines carrying any tag.
SELECT tenant_id,
       (SELECT count(*) FROM transaction_tags tt WHERE tt.tenant_id = t.tenant_id) AS tagged_rows_junction,
       (SELECT count(*) FROM journal_lines jl WHERE jl.tenant_id = t.tenant_id AND jl.tag_id IS NOT NULL) AS tagged_lines
FROM transactions t
GROUP BY tenant_id;

-- 3. Multi-tag transactions: ones whose junction rows were not fully
--    preserved on lines (secondary tags dropped per ADR 0XX §3.1
--    "first-assigned wins" backfill). Not a bug — these rows surface
--    where multi-tag-per-line future work will start.
SELECT tt.transaction_id,
       count(DISTINCT tt.tag_id) AS distinct_header_tags,
       count(DISTINCT jl.tag_id) FILTER (WHERE jl.tag_id IS NOT NULL) AS distinct_line_tags
FROM transaction_tags tt
JOIN journal_lines jl ON jl.transaction_id = tt.transaction_id
GROUP BY tt.transaction_id
HAVING count(DISTINCT tt.tag_id) > 1;
```

---

## 10. Open follow-ups (Severity 2/3 from the review)

1. Report tag filter on the remaining reports (Balance Sheet, Cash Flow, Trial Balance, Transaction Detail, AR/AP Aging, Sales by X, Expenses by X).
2. CSV/Excel export columns (`line_tag`).
3. Settings UI: Item edit, Contact edit (vendor-scoped), Bank Rule edit — Default Tag / Assign Tag controls.
4. AI categorization prompt + Zod response schema — per-line `tagId` suggestion.
5. Recurring-template tag migration.
6. SplitRowV2 keyboard model (Enter-to-add-row, Cmd/Ctrl+D / Cmd/Ctrl+Delete / Cmd/Ctrl+Shift+A).
7. Apply-tag-to-all action wiring in entry forms.
8. Rollback migrations authored alongside 0059/0060/0061.
9. Report parity test fixture in CI.
10. BullMQ chunked backfill for very large tenants (current single-UPDATE backfill is fine for Plaid-imported history per resolved decisions).

---

## 11. Known semantic weakness

**Contact-default resolution in the ledger overwrites explicit user `null`.** The ledger calls `resolveDefaultTag({ explicitUserTagId: line.tagId, … })`; if a caller sets `tagId: null` intending "user cleared," the resolver honors it only when the 3-state value reaches the ledger as `null`. Current per-type services pass `line.tagId` through without coercion, so UI-sourced explicit clears reach the ledger intact. The ledger-side resolver then returns `null` — the right answer. The weakness is any server-side caller that constructs a line with `tagId: null` meaning "I haven't set a tag yet" (e.g., a legacy script) will get that null honored instead of the contact default. Callers that want default resolution should pass `undefined` or omit the field.

Marked as ADR 0XY §8 "silent tag drift" risk; mitigation is integration-testing the save-load-save cycle (not yet authored).
