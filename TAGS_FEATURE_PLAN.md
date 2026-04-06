# KIS Books — Tags & Tag-Based Report Filtering Feature Plan

**Feature:** Transaction tagging system with report filtering
**Date:** April 2, 2026
**Depends on:** BUILD_PLAN.md Phases 1–4 (auth, COA, contacts, transaction engine), Phase 6 (reports)
**Integrates with:** Account Register feature, Batch Entry feature, Phase 5 (invoicing), Phase 7 (banking)

---

## Feature Overview

Tags are freeform, user-defined labels that can be attached to any transaction. Unlike the Chart of Accounts (which is structural and controls how money flows), tags are a flexible secondary dimension for categorizing transactions however the user needs — by project, property, department, client engagement, funding source, tax category, or anything else.

The critical differentiator from QuickBooks' class/location tracking (which is locked to Plus tier) is that tags are lightweight and multi-assignable: a single transaction can carry multiple tags, and tags don't affect the accounting structure at all. They're purely a reporting and filtering dimension.

### Use Cases

- **Freelancer:** Tag expenses by client project to track profitability per engagement
- **Rental property owner:** Tag income and expenses by property address
- **Service business:** Tag by department, team, or cost center
- **CPA firm:** Tag transactions by tax category or schedule line
- **Any business:** Tag by grant, campaign, event, season, or budget line item

### Where tags appear

- Every transaction form (expense, invoice, cash sale, journal entry, etc.)
- Transaction list page (filter + column)
- Account register (column + filter)
- Batch entry grid (column)
- Bank feed categorization (assign tag during categorization)
- Every report (filter dimension)
- Dashboard (optional filter)
- Dedicated Tag Manager page

---

## 1. Data Model

The database schema already exists in BUILD_PLAN.md. This section extends it with tag groups and additional indexes.

### 1.1 Tag Groups

Tags can optionally belong to a group for organization. Groups are not hierarchical — they're flat categories.

```sql
CREATE TABLE tag_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  is_single_select BOOLEAN DEFAULT FALSE,  -- if true, only one tag from this group per transaction
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, name)
);
```

### 1.2 Updated Tags Table

```sql
CREATE TABLE tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  group_id UUID REFERENCES tag_groups(id) ON DELETE SET NULL,
  name VARCHAR(100) NOT NULL,
  color VARCHAR(7),            -- hex color for visual distinction
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  usage_count INT DEFAULT 0,   -- denormalized count, updated on tag/untag
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, name)
);

CREATE INDEX idx_tags_tenant ON tags(tenant_id);
CREATE INDEX idx_tags_group ON tags(tenant_id, group_id);
CREATE INDEX idx_tags_active ON tags(tenant_id, is_active);
```

### 1.3 Transaction Tags Junction

```sql
CREATE TABLE transaction_tags (
  transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (transaction_id, tag_id)
);

CREATE INDEX idx_tt_tag ON transaction_tags(tenant_id, tag_id);
CREATE INDEX idx_tt_transaction ON transaction_tags(transaction_id);
```

### 1.4 Report Saved Filters (Tag Presets)

Users often run the same report with the same tag filter repeatedly. Saved filters let them bookmark these.

```sql
CREATE TABLE saved_report_filters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  name VARCHAR(255) NOT NULL,
  report_type VARCHAR(100) NOT NULL,  -- 'profit_loss', 'balance_sheet', etc.
  filters JSONB NOT NULL,             -- { tag_ids: [...], date_range: {...}, basis: 'accrual', ... }
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 2. Tag Behavior Rules

### 2.1 Multi-Tag Assignment

- A transaction can have zero, one, or many tags
- Tags from the same group follow the group's `is_single_select` rule:
  - If `is_single_select = true`, applying a second tag from that group replaces the first
  - If `is_single_select = false` (default), multiple tags from the same group are allowed
- Tags from different groups are always independently assignable

### 2.2 Tag Lifecycle

- Tags can be created at any time (from the tag manager, or inline during transaction entry)
- Tags can be renamed — the rename propagates to all tagged transactions (it's an ID reference, not a string copy)
- Tags can be deactivated — deactivated tags remain on existing transactions but cannot be assigned to new ones
- Tags can be deleted — deletes the tag and removes it from all transactions (with confirmation warning showing usage count)
- Tags can be merged — all transactions with the source tag are re-tagged to the target tag, source is deleted

### 2.3 Tag Colors

Each tag has an optional hex color. Colors are used for:
- Badge background in transaction lists and forms
- Chart segments in tag-filtered reports
- Visual grouping in the tag selector dropdown

A default palette of 12 colors is offered during tag creation. Users can also enter a custom hex code.

---

## 3. API Endpoints

### 3.1 Tag Management

```
GET    /api/v1/tags                     # List all tags (filterable: group, active, search)
POST   /api/v1/tags                     # Create tag
GET    /api/v1/tags/:id                 # Get single tag with usage stats
PUT    /api/v1/tags/:id                 # Update tag (name, color, group, active)
DELETE /api/v1/tags/:id                 # Delete tag (removes from all transactions)
POST   /api/v1/tags/merge               # Merge source tag into target tag
GET    /api/v1/tags/usage-summary       # Tag usage counts across all transactions
```

### 3.2 Tag Groups

```
GET    /api/v1/tag-groups               # List all groups with their tags
POST   /api/v1/tag-groups               # Create group
PUT    /api/v1/tag-groups/:id           # Update group
DELETE /api/v1/tag-groups/:id           # Delete group (tags become ungrouped, not deleted)
PUT    /api/v1/tag-groups/reorder       # Update sort_order for groups
```

### 3.3 Transaction Tagging

```
POST   /api/v1/transactions/:id/tags    # Add tags to transaction (body: { tag_ids: [...] })
DELETE /api/v1/transactions/:id/tags    # Remove tags from transaction (body: { tag_ids: [...] })
PUT    /api/v1/transactions/:id/tags    # Replace all tags on transaction (body: { tag_ids: [...] })
POST   /api/v1/transactions/bulk-tag    # Add tag(s) to multiple transactions (body: { transaction_ids: [...], tag_ids: [...] })
POST   /api/v1/transactions/bulk-untag  # Remove tag(s) from multiple transactions
```

### 3.4 Report Filtering

All existing report endpoints (from BUILD_PLAN.md Phase 6) gain additional query parameters:

```
GET /api/v1/reports/profit-loss?tag_ids=uuid1,uuid2&tag_mode=any
GET /api/v1/reports/balance-sheet?tag_ids=uuid1&tag_mode=all
GET /api/v1/reports/transaction-list?tag_ids=uuid1,uuid2,uuid3&tag_mode=any
```

**New query parameters on ALL report endpoints:**

| Param | Type | Default | Description |
|---|---|---|---|
| `tag_ids` | UUID[] | (none) | Filter to transactions with these tags |
| `tag_mode` | enum | `any` | `any` = transaction has ANY of the listed tags; `all` = transaction has ALL of the listed tags |
| `exclude_tag_ids` | UUID[] | (none) | Exclude transactions with these tags |
| `untagged_only` | boolean | false | Show only transactions with NO tags |

### 3.5 Tag-Specific Reports

```
GET /api/v1/reports/profit-loss-by-tag           # P&L broken out by tag (columns = tags)
GET /api/v1/reports/expense-by-tag               # Expenses grouped by tag
GET /api/v1/reports/income-by-tag                # Revenue grouped by tag
GET /api/v1/reports/tag-comparison               # Compare any metric across 2+ tags
```

### 3.6 Saved Report Filters

```
GET    /api/v1/saved-filters            # List saved filters
POST   /api/v1/saved-filters            # Create saved filter
PUT    /api/v1/saved-filters/:id        # Update saved filter
DELETE /api/v1/saved-filters/:id        # Delete saved filter
```

---

## 4. Service Layer

### 4.1 Tag Service

```
packages/api/src/services/tags.service.ts
```

- [ ] `list(tenantId, filters)` — list tags with optional group filter, active filter, search, sorted by group then sort_order
- [ ] `getById(tenantId, tagId)` — single tag with usage count
- [ ] `create(tenantId, input)` — create tag, validate unique name per tenant
- [ ] `update(tenantId, tagId, input)` — update name, color, group, active status
- [ ] `delete(tenantId, tagId)` — remove tag from all transactions, delete tag
- [ ] `merge(tenantId, sourceTagId, targetTagId)` — reassign all transaction_tags from source to target, delete source, update usage counts
- [ ] `getUsageSummary(tenantId)` — usage counts per tag, sorted by most used

### 4.2 Tag Group Service

```
packages/api/src/services/tag-groups.service.ts
```

- [ ] `list(tenantId)` — list groups with nested tags
- [ ] `create(tenantId, input)` — create group
- [ ] `update(tenantId, groupId, input)` — update group
- [ ] `delete(tenantId, groupId)` — set group_id = NULL on child tags, delete group
- [ ] `reorder(tenantId, orderedIds)` — update sort_order

### 4.3 Transaction Tagging Service

```
packages/api/src/services/transaction-tags.service.ts
```

- [ ] `addTags(tenantId, transactionId, tagIds)` — insert junction rows, enforce single-select group rules, increment usage counts
- [ ] `removeTags(tenantId, transactionId, tagIds)` — delete junction rows, decrement usage counts
- [ ] `replaceTags(tenantId, transactionId, tagIds)` — replace all tags on transaction (remove existing, add new)
- [ ] `bulkAddTags(tenantId, transactionIds, tagIds)` — add tag(s) to multiple transactions in one operation
- [ ] `bulkRemoveTags(tenantId, transactionIds, tagIds)` — remove tag(s) from multiple transactions
- [ ] `getTagsForTransaction(tenantId, transactionId)` — return all tags on a transaction
- [ ] `getTagsForTransactions(tenantId, transactionIds)` — batch fetch tags for a list of transactions (avoids N+1 in list views)

### 4.4 Report Tag Filtering

The existing report service methods (from Phase 6) need to be updated to accept and apply tag filters.

**Core change:** Every report query that aggregates `journal_lines` or `transactions` must optionally join through `transaction_tags` when `tag_ids` is provided.

```sql
-- Without tag filter (existing behavior):
SELECT ... FROM journal_lines jl
JOIN transactions t ON jl.transaction_id = t.id
WHERE jl.tenant_id = $1 AND t.txn_date BETWEEN $2 AND $3

-- With tag filter (tag_mode = 'any'):
SELECT ... FROM journal_lines jl
JOIN transactions t ON jl.transaction_id = t.id
WHERE jl.tenant_id = $1 AND t.txn_date BETWEEN $2 AND $3
  AND t.id IN (
    SELECT transaction_id FROM transaction_tags
    WHERE tag_id = ANY($4::uuid[])
  )

-- With tag filter (tag_mode = 'all'):
SELECT ... FROM journal_lines jl
JOIN transactions t ON jl.transaction_id = t.id
WHERE jl.tenant_id = $1 AND t.txn_date BETWEEN $2 AND $3
  AND t.id IN (
    SELECT transaction_id FROM transaction_tags
    WHERE tag_id = ANY($4::uuid[])
    GROUP BY transaction_id
    HAVING COUNT(DISTINCT tag_id) = $5  -- $5 = length of tag_ids array
  )

-- Exclude tags:
  AND t.id NOT IN (
    SELECT transaction_id FROM transaction_tags
    WHERE tag_id = ANY($6::uuid[])
  )

-- Untagged only:
  AND t.id NOT IN (
    SELECT transaction_id FROM transaction_tags
    WHERE tenant_id = $1
  )
```

- [ ] Create `packages/api/src/services/report-tag-filter.ts` — shared helper that builds the tag filter SQL fragment:
  - `buildTagFilterClause(tagIds?, tagMode?, excludeTagIds?, untaggedOnly?)` — returns a SQL fragment and params array
  - Used by every report builder method

### 4.5 Tag-Specific Report Builders

- [ ] `buildProfitAndLossByTag(tenantId, startDate, endDate, basis, tagIds)`:
  - Produces a P&L where each tag is a column
  - Rows = accounts (same as standard P&L)
  - Values = amounts only from transactions tagged with that tag
  - "Untagged" column for transactions without any tags
  - Total column sums across all tags
  - Note: transactions with multiple tags will appear in multiple tag columns (double-counting is expected and documented in the report header)

- [ ] `buildExpenseByTag(tenantId, startDate, endDate, tagIds?)`:
  - Rows = tags
  - Columns: Tag name, total expense amount, % of total, transaction count
  - If `tagIds` provided, limit to those tags; otherwise show all tags with expenses

- [ ] `buildIncomeByTag(tenantId, startDate, endDate, tagIds?)`:
  - Same structure as expense by tag, but for revenue accounts

- [ ] `buildTagComparison(tenantId, startDate, endDate, tagIds, metrics)`:
  - Compare selected tags across chosen metrics (revenue, expenses, net income, transaction count)
  - Each tag is a column, each metric is a row

---

## 5. Frontend Components

### 5.1 Tag Manager Page

```
packages/web/src/features/tags/TagManagerPage.tsx
```

Dedicated settings page for managing tags and groups.

- [ ] **Tag Groups panel (left):**
  - List of groups, each expandable to show child tags
  - "Ungrouped" section for tags without a group
  - Drag to reorder groups
  - Click group to filter the tag list on the right
  - "Add Group" button
  - Group context menu: Edit, Delete

- [ ] **Tag List panel (right):**
  - Table: Color dot, Name, Group, Usage Count, Status, Actions
  - Sortable by name, usage, group
  - Search box
  - Active/Inactive filter
  - Bulk select (checkboxes) for bulk delete or bulk move to group
  - "Add Tag" button

- [ ] **Tag Create/Edit Modal:**
  - Name (required, validated unique)
  - Color picker (12-color palette + custom hex)
  - Group dropdown (optional)
  - Description (optional)
  - Active toggle
  - Preview: shows how the tag badge will look

- [ ] **Tag Merge Modal:**
  - Source tag selector
  - Target tag selector
  - Preview: "X transactions will be re-tagged from [Source] to [Target]. [Source] will be deleted."
  - Confirmation button

- [ ] **Group Create/Edit Modal:**
  - Name (required)
  - Description (optional)
  - Single-select toggle (with explanation: "When enabled, each transaction can only have one tag from this group")

- [ ] Add "Tags" to sidebar under Settings

### 5.2 Tag Selector Component

```
packages/web/src/components/forms/TagSelector.tsx
```

Reusable component used in every transaction form, the register, batch entry, and bank feed.

- [ ] **Multi-select dropdown** with:
  - Search/filter input at the top
  - Tags organized by group (group headers as visual separators)
  - Ungrouped tags at the bottom
  - Each tag shown as a colored badge
  - Click to toggle selection
  - Selected tags shown as removable chips above or below the dropdown
  - "Create new tag" option at the bottom of the dropdown (inline quick-add: just name + optional color, no modal)
  - Keyboard: type to filter, Enter to select highlighted, Escape to close

- [ ] **Single-select mode** (when a group has `is_single_select = true`):
  - Behaves like a radio group for tags within that group
  - Selecting a new tag from the group auto-removes the previous one

- [ ] **Compact mode** (for use in dense grids like the register or batch entry):
  - Shows tag count badge ("3 tags") instead of full chip list
  - Click to expand the selector
  - Hover to show tag names in a tooltip

### 5.3 Tag Filter Component

```
packages/web/src/components/forms/TagFilter.tsx
```

Reusable filter widget used in report pages, transaction list, and register.

- [ ] **Filter bar element** that shows:
  - "Tags: All" (default state, no filter active)
  - Click to open a dropdown with:
    - Tag multi-select checkboxes (organized by group)
    - Mode toggle: "Any of these tags" / "All of these tags"
    - "Exclude" section: select tags to exclude
    - "Untagged only" checkbox
    - "Apply" and "Clear" buttons
  - When active: shows selected tags as colored chips in the filter bar
  - Remove individual tag filters by clicking the X on the chip

- [ ] **Saved filters dropdown:**
  - "Saved filters" button next to the tag filter
  - Shows list of saved report filters (for the current report type)
  - Click to apply saved filter (replaces current tag + date + basis settings)
  - "Save current filter" option → name input → save
  - Edit/delete saved filters

### 5.4 Transaction Form Integration

Every existing transaction form needs the tag selector added.

- [ ] **Expense form:** Tag selector below the memo field
- [ ] **Invoice form:** Tag selector in the header section (tags the whole invoice)
- [ ] **Cash sale form:** Tag selector below memo
- [ ] **Journal entry form:** Tag selector in the header (tags the whole JE)
- [ ] **Deposit form:** Tag selector below memo
- [ ] **Transfer form:** Tag selector below memo
- [ ] **Credit memo form:** Tag selector below memo
- [ ] **Customer refund form:** Tag selector below memo
- [ ] **Estimate form:** Tag selector in header (tags carry over to converted invoice)
- [ ] Transaction create/update API calls include `tag_ids` array in the request body

### 5.5 Transaction List Integration

- [ ] Add "Tags" column to the transaction list table (shows colored tag badges, truncated with "+N" if many)
- [ ] Add tag filter to the transaction list filter toolbar (using TagFilter component)
- [ ] Bulk tag action: select multiple transactions → "Add Tags" / "Remove Tags" button in toolbar
- [ ] Tag badges in the list are clickable → filters the list to that tag

### 5.6 Account Register Integration

- [ ] Add "Tags" column to the register (compact mode — count badge with tooltip)
- [ ] Add tag filter to the register toolbar (using TagFilter component)
- [ ] Inline entry row includes a tag selector (compact)
- [ ] Inline edit row shows and allows editing tags

### 5.7 Batch Entry Integration

- [ ] Add optional "Tags" column to the batch entry grid (all transaction types)
- [ ] Tags cell: comma-separated tag names (on paste from Excel) or tag selector dropdown (on click)
- [ ] During validation, resolve tag names to IDs (exact match → fuzzy match → create option)
- [ ] Unresolved tag names highlighted amber with "will be created" indicator

### 5.8 Bank Feed Integration

- [ ] Add tag selector to the bank feed categorization panel
- [ ] When categorizing a bank feed item as a new transaction, tags can be assigned
- [ ] AI categorization can suggest tags based on payee/account history (if past transactions to the same payee had tags)

### 5.9 Report Pages Integration

Every existing report page (from Phase 6) needs the tag filter added.

- [ ] **Report toolbar update:**
  - Add TagFilter component to every report's toolbar, positioned after the date range picker and basis toggle
  - Tag filter state included in the report API request
  - When tags are filtered, report header shows "Filtered by tags: [tag names]"

- [ ] **Updated report pages** (add tag filter to each):
  - [ ] Profit & Loss
  - [ ] Balance Sheet
  - [ ] Cash Flow Statement
  - [ ] AR Aging Summary / Detail
  - [ ] Customer Balance Summary / Detail
  - [ ] Invoice List
  - [ ] Expense by Vendor
  - [ ] Expense by Category
  - [ ] Vendor Balance Summary
  - [ ] Transaction List by Vendor
  - [ ] Deposit Detail
  - [ ] Check Register
  - [ ] Sales Tax Liability
  - [ ] Taxable Sales Summary
  - [ ] Sales Tax Payments
  - [ ] 1099 Vendor Summary
  - [ ] General Ledger
  - [ ] Trial Balance
  - [ ] Transaction List
  - [ ] Journal Entry Report
  - [ ] Account Report

- [ ] **New tag-specific report pages:**
  - [ ] `ProfitAndLossByTagReport.tsx` — P&L with tag columns
  - [ ] `ExpenseByTagReport.tsx` — expenses grouped by tag
  - [ ] `IncomeByTagReport.tsx` — revenue grouped by tag
  - [ ] `TagComparisonReport.tsx` — compare metrics across selected tags

- [ ] **Saved filters integration:**
  - "Save this filter" button on every report page
  - "Saved filters" dropdown to recall saved filters
  - Saved filters persist tag selections, date range, basis, and any other active filters

### 5.10 Dashboard Integration

- [ ] Optional global tag filter in the dashboard header
- [ ] When a tag filter is active, all dashboard widgets filter to only tagged transactions
- [ ] Dashboard financial snapshot, cash position (estimated), receivables — all tag-filtered
- [ ] Visual indicator: "Filtered by: [tag badges]" banner at top of dashboard

---

## 6. API Hooks

```
packages/web/src/api/hooks/useTags.ts
```

- [ ] `useTags(filters?)` — list all tags
- [ ] `useTagGroups()` — list all groups with nested tags
- [ ] `useCreateTag()` — mutation
- [ ] `useUpdateTag()` — mutation
- [ ] `useDeleteTag()` — mutation
- [ ] `useMergeTags()` — mutation
- [ ] `useCreateTagGroup()` — mutation
- [ ] `useUpdateTagGroup()` — mutation
- [ ] `useDeleteTagGroup()` — mutation
- [ ] `useAddTransactionTags()` — mutation
- [ ] `useRemoveTransactionTags()` — mutation
- [ ] `useBulkTag()` — mutation
- [ ] `useBulkUntag()` — mutation
- [ ] `useTagUsageSummary()` — query
- [ ] `useSavedFilters(reportType)` — query
- [ ] `useSaveFilter()` — mutation
- [ ] `useDeleteFilter()` — mutation

---

## 7. Build Checklist

### 7.1 Database & Shared Types
- [ ] Create migration: `tag_groups` table
- [ ] Update migration: `tags` table (add `group_id`, `description`, `is_active`, `usage_count`, `sort_order`)
- [ ] Update migration: `transaction_tags` table (add `tenant_id`, `created_at`)
- [ ] Create migration: `saved_report_filters` table
- [ ] Add indexes: `idx_tags_tenant`, `idx_tags_group`, `idx_tags_active`, `idx_tt_tag`, `idx_tt_transaction`
- [ ] Create `packages/shared/src/types/tags.ts` — `Tag`, `TagGroup`, `CreateTagInput`, `UpdateTagInput`, `TagFilter`, `SavedReportFilter`
- [ ] Create `packages/shared/src/schemas/tags.ts` — Zod schemas for all tag and group operations
- [ ] Create `packages/shared/src/constants/tag-colors.ts` — default 12-color palette

### 7.2 API — Tag Management
- [ ] Create `packages/api/src/db/schema/tags.ts` — Drizzle schema (tags, tag_groups, transaction_tags, saved_report_filters)
- [ ] Create `packages/api/src/services/tags.service.ts` — full CRUD + merge + usage summary
- [ ] Create `packages/api/src/services/tag-groups.service.ts` — full CRUD + reorder
- [ ] Create `packages/api/src/services/transaction-tags.service.ts` — add, remove, replace, bulk tag/untag, batch fetch
- [ ] Create `packages/api/src/routes/tags.routes.ts` — all tag endpoints
- [ ] Create `packages/api/src/routes/tag-groups.routes.ts` — all group endpoints
- [ ] Create `packages/api/src/routes/saved-filters.routes.ts` — saved filter CRUD
- [ ] Update `packages/api/src/routes/transactions.routes.ts` — add tag endpoints on transactions
- [ ] Update transaction create/update services to accept and persist `tag_ids`
- [ ] Enforce single-select group rules in `addTags()`
- [ ] Update usage_count on tag/untag operations
- [ ] Audit trail: log tag assignments and bulk operations
- [ ] Write Vitest tests:
  - [ ] Tag CRUD (create, update, deactivate, delete)
  - [ ] Tag uniqueness per tenant enforced
  - [ ] Tag merge reassigns all transactions and deletes source
  - [ ] Group CRUD (create, update, delete with tags becoming ungrouped)
  - [ ] Single-select group enforcement (second tag replaces first)
  - [ ] Multi-tag assignment (multiple tags from different groups)
  - [ ] Bulk tag: add tag to 100 transactions in one call
  - [ ] Batch fetch tags for 50 transactions (no N+1)
  - [ ] Usage count increments and decrements correctly

### 7.3 API — Report Tag Filtering
- [ ] Create `packages/api/src/services/report-tag-filter.ts` — shared SQL builder for tag filter clauses
- [ ] Update `report.service.ts` — add tag filter parameters to ALL report builder methods:
  - [ ] `buildProfitAndLoss` — tag filter
  - [ ] `buildBalanceSheet` — tag filter
  - [ ] `buildCashFlowStatement` — tag filter
  - [ ] `buildARAgingSummary` / `buildARAgingDetail` — tag filter
  - [ ] `buildCustomerBalanceSummary` / `buildCustomerBalanceDetail` — tag filter
  - [ ] `buildInvoiceList` — tag filter
  - [ ] `buildExpenseByVendor` — tag filter
  - [ ] `buildExpenseByCategory` — tag filter
  - [ ] `buildVendorBalanceSummary` — tag filter
  - [ ] `buildTransactionListByVendor` — tag filter
  - [ ] `buildDepositDetail` — tag filter
  - [ ] `buildCheckRegister` — tag filter
  - [ ] `buildSalesTaxLiability` — tag filter
  - [ ] `buildTaxableSalesSummary` — tag filter
  - [ ] `buildSalesTaxPayments` — tag filter
  - [ ] `build1099VendorSummary` — tag filter
  - [ ] `buildGeneralLedger` — tag filter
  - [ ] `buildTrialBalance` — tag filter
  - [ ] `buildTransactionList` — tag filter
  - [ ] `buildJournalEntryReport` — tag filter
  - [ ] `buildAccountReport` — tag filter
- [ ] Create new report builders:
  - [ ] `buildProfitAndLossByTag` — P&L with tag columns
  - [ ] `buildExpenseByTag` — expenses grouped by tag
  - [ ] `buildIncomeByTag` — revenue grouped by tag
  - [ ] `buildTagComparison` — multi-metric comparison across tags
- [ ] Add tag filter query params to all report route handlers
- [ ] Add new tag-specific report routes
- [ ] Write Vitest tests:
  - [ ] P&L with tag filter returns only tagged transaction amounts
  - [ ] P&L with tag_mode=any returns transactions matching any tag
  - [ ] P&L with tag_mode=all returns only transactions matching all tags
  - [ ] P&L with exclude_tag_ids correctly excludes
  - [ ] P&L with untagged_only returns only untagged transactions
  - [ ] P&L by tag produces correct per-tag columns
  - [ ] Tag filter applies correctly to balance sheet
  - [ ] Tag filter applies correctly to AR aging
  - [ ] Expense by tag report aggregates correctly

### 7.4 Frontend — Tag Management UI
- [ ] Create `TagManagerPage.tsx` with groups panel, tag list, create/edit/merge modals
- [ ] Create `TagCreateEditModal.tsx` with color picker and group selector
- [ ] Create `TagMergeModal.tsx` with usage count preview
- [ ] Create `TagGroupModal.tsx` with single-select toggle
- [ ] Create color picker component (12-color palette + custom hex)
- [ ] Create `packages/web/src/api/hooks/useTags.ts` — all tag hooks

### 7.5 Frontend — Tag Selector & Filter Components
- [ ] Create `TagSelector.tsx` — multi-select dropdown with groups, inline create, compact mode
- [ ] Create `TagFilter.tsx` — report filter widget with any/all mode toggle, exclude, untagged-only
- [ ] Create `SavedFiltersDropdown.tsx` — save/recall report filter presets

### 7.6 Frontend — Integration with Existing Features
- [ ] Add TagSelector to all 9 transaction forms (expense, invoice, cash sale, deposit, transfer, JE, credit memo, customer refund, estimate)
- [ ] Add Tags column + TagFilter to transaction list page
- [ ] Add bulk tag/untag actions to transaction list
- [ ] Add Tags column (compact) + TagFilter to account register
- [ ] Add Tags column to batch entry grid with name-to-ID resolution
- [ ] Add TagSelector to bank feed categorization panel
- [ ] Add TagFilter to all 21 report page toolbars
- [ ] Create 4 new tag-specific report pages (P&L by tag, expense by tag, income by tag, tag comparison)
- [ ] Add SavedFiltersDropdown to all report pages
- [ ] Add optional tag filter to dashboard header
- [ ] Add "Tags" under Reports section in sidebar (links to tag-specific reports)
- [ ] Clickable tag badges in lists → filter by that tag

### 7.7 Ship Gate
- [ ] Tag CRUD: create, rename, change color, deactivate, delete — all work
- [ ] Tag groups: create, assign tags to groups, single-select enforcement, delete group (tags become ungrouped)
- [ ] Tag merge: 50 transactions re-tagged, source deleted, usage counts correct
- [ ] Assign 3 tags to an expense → tags visible in transaction list, register, and detail page
- [ ] Remove 1 tag → only 2 remain
- [ ] Bulk tag: select 20 transactions → add tag → all 20 now tagged
- [ ] Transaction list: filter by tag → only tagged transactions shown
- [ ] Account register: filter by tag → register shows only matching lines, running balance recomputes for filtered set
- [ ] Batch entry: paste rows with tag names → tags resolve and assign on save
- [ ] Bank feed: assign tag during categorization → transaction has tag
- [ ] P&L report: filter by "Project Alpha" tag → only Project Alpha transactions in the report
- [ ] P&L report: tag_mode=all with 2 tags → only transactions with BOTH tags
- [ ] P&L report: exclude_tag_ids → those transactions excluded
- [ ] P&L report: untagged_only → only untagged transactions
- [ ] P&L by tag report: each tag is a column with correct amounts
- [ ] Expense by tag report: tags listed with expense totals
- [ ] Balance sheet with tag filter produces correct balances
- [ ] Saved filter: save a P&L filter with 2 tags + date range → recall it → report loads with saved settings
- [ ] Tag-specific reports appear under Reports > Tags in sidebar
- [ ] Dashboard: optional tag filter shows filtered financial snapshot
- [ ] Tag selector inline-create: type new name → "Create [name]" → tag created and assigned
- [ ] Deactivated tag: still visible on existing transactions, not available in selector for new transactions
- [ ] All Vitest tests passing
- [ ] QUESTIONS.md reviewed and resolved

---

## 8. UX Notes

### Tag Badge Design

Tags are displayed as small colored pills throughout the UI:

- Height: 20px
- Border radius: 10px (full pill)
- Background: tag color at 15% opacity
- Text: tag color at 100% opacity, 12px, font-weight 500
- No border
- Removable (X icon) in edit contexts, static in read contexts
- When multiple tags overflow available space: show first N + "+3 more" badge

### Tag Selector Dropdown

- Max height: 300px (scrollable)
- Group headers: 11px uppercase muted text, non-selectable
- Tag items: colored dot (8px circle) + name, checkmark when selected
- Search input pinned at top
- "Create [typed text]" option appears when search has no exact match
- Recently used tags section at top (last 5 tags used by this tenant)

### Report Header When Filtered

When a report is filtered by tags, the report header should clearly show:

```
Profit & Loss
Kisaes LLC
January 1 – March 31, 2026
Accrual Basis
Filtered by tags: Project Alpha, Q1 Campaign (any match)
```

This appears in the on-screen report, the PDF export, and the CSV header row.

### Performance Considerations

- Tag lookups are frequent (every list view, every form) — use React Query caching aggressively (staleTime: 5 minutes for tag list)
- Batch fetch `getTagsForTransactions()` to avoid N+1 on list pages
- Tag filter on reports uses a subquery (not a JOIN) to avoid row multiplication when a transaction has multiple tags
- `usage_count` is denormalized to avoid COUNT queries on the junction table for the tag manager
