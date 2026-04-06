# KIS Books — Plaid Integration Addendum: Cross-Company Connections

**Addendum to:** PLAID_INTEGRATION_PLAN.md
**Replaces:** PLAID_CROSS_TENANT_PLAN.md (retired), PLAID_TENANT_OWNERSHIP_PLAN.md (retired)
**Feature:** System-scoped Plaid connections shared across companies with filtered account visibility, two-step mapping, per-account sync dates, and safe deletion cascade
**Date:** April 5, 2026

---

## Overview

This addendum modifies the Plaid integration architecture to support a single Plaid connection serving multiple companies — without exposing any company's account details to another company's users.

### What changes from the original plan

| Aspect | Original Plan | This Addendum |
|---|---|---|
| **Item scope** | Tenant-scoped (one Item per company) | System-scoped (one Item, multiple companies) |
| **Account visibility** | All accounts visible to the tenant | Filtered: users see only their company's accounts + unassigned |
| **Duplicate Items** | Allowed (each company connects separately) | Prevented (system detects existing institution, offers shared access) |
| **Account mapping** | Single step (pick COA account) | Two steps: assign company → map to COA with sync start date |
| **Deletion** | Remove Item for one tenant | Two-tier: unmap one company OR delete entire connection |
| **Ownership** | Implicitly user-owned | System-owned, company-managed, user-attributed |
| **Sync date** | All available history | Per-account sync start date |

### Core Privacy Principle

**A user only sees accounts that are assigned to companies they have admin access to, plus accounts that are unassigned.** Accounts assigned to other companies are invisible — not grayed out, not counted by name, not accessible by any API call. Only a count of "N other accounts assigned to other companies" is ever disclosed.

---

## 1. Data Model

### 1.1 plaid_items (System-Scoped)

```sql
CREATE TABLE plaid_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- NO tenant_id — system-scoped
  plaid_item_id VARCHAR(255) NOT NULL UNIQUE,
  plaid_institution_id VARCHAR(100),
  institution_name VARCHAR(255),
  access_token_encrypted TEXT NOT NULL,
  -- Sync state
  sync_cursor TEXT,
  last_sync_at TIMESTAMPTZ,
  last_sync_status VARCHAR(30),
  last_sync_error TEXT,
  initial_update_complete BOOLEAN DEFAULT FALSE,
  historical_update_complete BOOLEAN DEFAULT FALSE,
  -- Item health
  item_status VARCHAR(30) DEFAULT 'active',
  error_code VARCHAR(100),
  error_message TEXT,
  consent_expiration_at TIMESTAMPTZ,
  -- Attribution (informational, not ownership)
  created_by UUID REFERENCES users(id),
  created_by_name VARCHAR(255),
  created_by_email VARCHAR(255),
  link_session_id VARCHAR(255),
  -- Lifecycle
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  removed_at TIMESTAMPTZ,
  removed_by UUID REFERENCES users(id),
  removed_by_name VARCHAR(255)
);

CREATE INDEX idx_pi_status ON plaid_items(item_status);
CREATE INDEX idx_pi_institution ON plaid_items(plaid_institution_id) WHERE removed_at IS NULL;
CREATE INDEX idx_pi_created_by ON plaid_items(created_by);
```

### 1.2 plaid_accounts (System-Scoped)

```sql
CREATE TABLE plaid_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- NO tenant_id — inherits system scope from parent Item
  plaid_item_id UUID NOT NULL REFERENCES plaid_items(id) ON DELETE CASCADE,
  plaid_account_id VARCHAR(255) NOT NULL UNIQUE,
  persistent_account_id VARCHAR(255),
  -- Account info from Plaid
  name VARCHAR(255),
  official_name VARCHAR(255),
  account_type VARCHAR(50),
  account_subtype VARCHAR(50),
  mask VARCHAR(10),
  -- Balance
  current_balance DECIMAL(19,4),
  available_balance DECIMAL(19,4),
  balance_currency VARCHAR(3) DEFAULT 'USD',
  balance_updated_at TIMESTAMPTZ,
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pa_item ON plaid_accounts(plaid_item_id);
CREATE INDEX idx_pa_plaid_account ON plaid_accounts(plaid_account_id);
CREATE INDEX idx_pa_mask_subtype ON plaid_accounts(mask, account_subtype) WHERE is_active = TRUE;
```

### 1.3 plaid_account_mappings (Tenant-Scoped Bridge)

The link between system-level Plaid accounts and company-level COA accounts:

```sql
CREATE TABLE plaid_account_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plaid_account_id UUID NOT NULL REFERENCES plaid_accounts(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  mapped_account_id UUID NOT NULL REFERENCES accounts(id),
  -- Sync control
  sync_start_date DATE,                        -- NULL = import all available history
  is_sync_enabled BOOLEAN DEFAULT TRUE,
  -- Attribution
  mapped_by UUID NOT NULL REFERENCES users(id),
  mapped_by_name VARCHAR(255),
  -- Lifecycle
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  -- Constraints
  UNIQUE(plaid_account_id),                    -- one bank account → one company (physical reality)
  UNIQUE(tenant_id, mapped_account_id)         -- one COA account → one Plaid feed
);

CREATE INDEX idx_pam_tenant ON plaid_account_mappings(tenant_id);
CREATE INDEX idx_pam_plaid ON plaid_account_mappings(plaid_account_id);
```

### 1.4 plaid_item_activity (Activity Log)

```sql
CREATE TABLE plaid_item_activity (
  id BIGSERIAL PRIMARY KEY,
  plaid_item_id UUID NOT NULL REFERENCES plaid_items(id),
  tenant_id UUID REFERENCES tenants(id),       -- NULL for system-level actions (create, delete)
  action VARCHAR(50) NOT NULL,
  -- 'item_created', 'item_removed', 'item_reauthorized'
  -- 'account_mapped', 'account_unmapped', 'account_remapped'
  -- 'sync_triggered', 'sync_completed', 'sync_failed'
  -- 'company_unmapped_all' (company removed all their mappings)
  performed_by UUID REFERENCES users(id),
  performed_by_name VARCHAR(255),
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pia_item ON plaid_item_activity(plaid_item_id);
CREATE INDEX idx_pia_tenant ON plaid_item_activity(tenant_id);
```

---

## 2. Connection Flow — Existing Institution Detection

### 2.1 Before Plaid Link Opens

When a user clicks "Connect Bank", before launching Plaid Link:

- [ ] `checkExistingConnections(userId)`:
  1. Get all companies the user has admin access to
  2. Query `plaid_account_mappings` for those tenants → get the `plaid_item_ids`
  3. These are Items the user already knows about (through their companies)
  4. Store in session — used after Plaid Link to detect if the same institution is returned

### 2.2 After Plaid Link Completes

- [ ] `processNewConnection(userId, publicToken, metadata)`:
  1. Exchange public_token for access_token (standard Plaid flow)
  2. Get `institution_id` from the metadata
  3. **Check for existing Item with same institution:**
     - Query `plaid_items` where `plaid_institution_id = institution_id AND removed_at IS NULL`
     - If found: this institution is already connected to the system
  4. **If NO existing Item:** create a new `plaid_items` record + `plaid_accounts` records. Proceed to mapping.
  5. **If existing Item found:**
     - Compare the newly returned accounts with the existing Item's accounts (by `plaid_account_id`)
     - **Same accounts already exist:** this is a re-connection. Update the existing Item's access_token (Plaid may have rotated it). Do not create duplicates.
     - **New accounts found:** add them to the existing Item's `plaid_accounts`. These are new accounts the user opened at the same bank.
     - **Revoke the duplicate access token:** if Plaid issued a new access_token for what's effectively the same Item, call `/item/remove` on the NEW token and keep the existing one. OR replace the old token with the new one — depends on whether the existing token is still valid.
     - Present only unassigned + user-accessible accounts for mapping

### 2.3 Handling Truly Duplicate Items

If Plaid creates a second Item for the same institution (different `item_id`, different `access_token`) because the user went through Link again:

- [ ] **Option A: Merge** — Transfer all accounts and mappings from the old Item to the new one, then remove the old Item from Plaid. This is clean but requires careful cursor handling.
- [ ] **Option B: Replace** — Keep the new Item, remove the old Item from Plaid, transfer all existing mappings to matching accounts on the new Item (match by `plaid_account_id` or `mask + subtype`).
- [ ] **User choice:** "You already have a connection to Chase Bank. Would you like to update the existing connection or create a new one?"
  - "Update existing" → Option B (replace, transfer mappings)
  - "Create new" → keep both Items (escape hatch for edge cases)

---

## 3. Two-Step Mapping Flow

### 3.1 Step 1: Assign Companies

After connection, the user sees all accounts returned from the bank and assigns each to a company.

- [ ] **Account list:** each Plaid account with name, type, mask, balance
- [ ] **Company dropdown per account:**
  - Lists only companies where the current user has admin/owner role
  - "Don't import" option (leaves the account unassigned)
  - Default: current company context (if the user launched from within a company)
- [ ] **Already-assigned accounts** (from existing connection):
  - Shown but not editable by the current user unless they have access to that company
  - "Assigned to [Company Name]" (if user has access) or "Assigned to another company" (if not)
- [ ] "Next: Map to accounts →" button

### 3.2 Step 2: Map to COA with Sync Start Date

Accounts grouped by company. For each account:

- [ ] **COA account dropdown:**
  - Filtered to the assigned company's chart of accounts
  - Further filtered by compatible types (Plaid checking → COA bank accounts, Plaid credit → COA credit card accounts)
  - Auto-suggest: match by name first, then by type
  - "+ Create new account" option at bottom → inline form pre-filled from Plaid data

- [ ] **Sync start date picker:**
  - Date input per account
  - Quick-select buttons: common fiscal year starts (Jan 1, Apr 1, Jul 1, Oct 1, current month start)
  - "All available" button → sets to NULL (import everything Plaid provides)
  - Default: first day of current month
  - Hint text: "Only transactions on or after this date will be imported."

- [ ] **Validation:**
  - COA account cannot already have a Plaid mapping (unique constraint)
  - Sync start date cannot be in the future
  - At least one account must be mapped to proceed

- [ ] "Save and start syncing" button → creates `plaid_account_mappings` rows, triggers initial sync

### 3.3 Subsequent Account Claims

When a user from a different company encounters the "institution already connected" flow:

- [ ] They see ONLY:
  - Unassigned accounts (with full name, mask, balance)
  - Accounts already assigned to companies they have admin access to (can remap if needed)
  - A count of accounts assigned to other companies: "3 other accounts are assigned to companies you don't manage"
- [ ] They do NOT see:
  - Account names, masks, balances, or types of accounts assigned to companies they don't manage
- [ ] They have an escape hatch: "Connect separately instead" → creates a new Plaid Item (duplicate, but independent)

---

## 4. Filtered Account Visibility

### 4.1 Visibility Rules

```typescript
function getVisibleAccounts(userId: string, plaidItemId: string): PlaidAccount[] {
  const userTenants = getUserAdminTenants(userId);
  const allAccounts = getAccountsForItem(plaidItemId);
  
  return allAccounts.filter(account => {
    const mapping = getMapping(account.id);
    if (!mapping) return true;                          // unassigned → visible
    if (userTenants.includes(mapping.tenant_id)) return true;  // user's company → visible
    return false;                                        // other company → invisible
  });
}

function getHiddenAccountCount(userId: string, plaidItemId: string): number {
  // Returns count only — no details about hidden accounts
  const userTenants = getUserAdminTenants(userId);
  const allAccounts = getAccountsForItem(plaidItemId);
  
  return allAccounts.filter(account => {
    const mapping = getMapping(account.id);
    return mapping && !userTenants.includes(mapping.tenant_id);
  }).length;
}
```

### 4.2 API Enforcement

- [ ] Every API endpoint that returns Plaid account data MUST run the visibility filter
- [ ] The filter runs at the service layer (not just the UI) — an API call cannot bypass it
- [ ] The response includes `hidden_account_count` as an integer but NEVER includes details about hidden accounts
- [ ] The `/transactions/sync` response routes transactions per-mapping — a tenant's API scope only includes their own feed items

### 4.3 Super Admin View

The super admin connection monitor shows:

- [ ] Item metadata: institution name, status, created by, total account count
- [ ] Per-company summary: company name + number of mapped accounts (no account details)
- [ ] Unassigned account count
- [ ] **No account names, masks, balances, or transaction data** — only aggregate counts

---

## 5. Transaction Sync Routing

### 5.1 Multi-Tenant Sync

When `/transactions/sync` returns results for a shared Item:

- [ ] Build routing map: `{ plaid_account_id → { tenant_id, mapped_account_id, sync_start_date } }`
- [ ] For each transaction in `added`:
  1. Look up the account's mapping
  2. If no mapping exists → skip (unassigned account)
  3. If `sync_start_date` is set and `txn_date < sync_start_date` → skip (before cutoff)
  4. Create `bank_feed_items` row in the correct tenant (using `mapping.tenant_id`)
  5. Run bank rules for that tenant
  6. Run AI categorization for that tenant
- [ ] Same routing for `modified` and `removed` transactions
- [ ] One Plaid API call serves all companies — no duplicate API charges

### 5.2 Sync Start Date Enforcement

- [ ] The `sync_start_date` filter is applied AFTER receiving transactions from Plaid (Plaid doesn't support date filtering on `/transactions/sync`)
- [ ] Transactions before the cutoff are silently discarded — not stored, not logged
- [ ] The sync cursor advances past discarded transactions (they won't come back in future syncs)
- [ ] Changing the sync start date backward triggers a re-sync: reset the cursor and re-fetch, this time accepting older transactions

### 5.3 Sync Start Date Change

- [ ] **Moving the date forward** (e.g., Jan 1 → Mar 1):
  - Future syncs skip transactions before Mar 1
  - Existing feed items between Jan 1 and Mar 1 are NOT retroactively deleted (they're already in the ledger or review queue)

- [ ] **Moving the date backward** (e.g., Mar 1 → Jan 1):
  - Requires a "historical backfill" — system resets the sync cursor and re-processes
  - Only creates feed items for transactions that don't already exist (dedup by `plaid_transaction_id`)
  - Warning: "This will fetch older transactions from your bank. Depending on the date range, this may take a few minutes."

---

## 6. Two-Tier Deletion

### 6.1 Tier 1: Unmap Company (Safe, Local Only)

**Who can do it:** Any admin/owner of the affected company.

**What it does:**
1. Removes all `plaid_account_mappings` rows for this company from this Item
2. Optionally deletes pending (uncategorized) bank feed items from this company that came from this connection
3. Logs to `plaid_item_activity`
4. Writes audit trail entry for the company

**What it does NOT do:**
- Does NOT call Plaid `/item/remove`
- Does NOT affect other companies' mappings
- Does NOT delete the Plaid Item or accounts
- Does NOT affect posted transactions, COA accounts, or reconciliation history

**The accounts become unassigned** and can be claimed by another company or re-mapped by this company later.

### 6.2 Tier 2: Delete Entire Connection (Destructive, Affects All Companies)

**Who can do it:**
- The original creator of the connection
- The super admin
- A user who is admin/owner of ALL companies with active mappings from this Item

**What it does (in order, as a single transaction):**

1. **Call Plaid `/item/remove`** — revoke access on Plaid's servers
   - If this fails: abort everything, show error, change nothing locally
2. **Cancel pending sync jobs** — remove all BullMQ jobs for this Item
3. **Delete pending bank feed items** (if user checked the option) — for ALL companies with mappings from this Item
4. **Delete all `plaid_account_mappings`** — across all companies
5. **Soft-delete `plaid_accounts`** — set `is_active = FALSE`, `removed_at = NOW()`
6. **Soft-delete `plaid_items`** — set `item_status = 'removed'`, `removed_at = NOW()`, wipe `access_token_encrypted`
7. **Write `plaid_item_activity`** entry — action = 'item_removed', details include all affected companies and account counts
8. **Write audit trail** — one entry per affected company + one system-level entry
9. **Notify affected companies** — in-app notification + email to all admin/owner users: "The [Institution] connection has been disconnected by [User Name]."

**What survives:**
- Posted/categorized transactions (in the ledger)
- COA bank accounts (just stop receiving feed)
- Reconciliation history
- Receipts and attachments
- Bank rules and categorization history
- The audit trail (permanent)

### 6.3 Confirmation Dialog

The deletion confirmation must clearly show the impact:

- [ ] Institution name and connection date
- [ ] List of ALL affected companies with their mapped accounts (names, masks)
  - Only shows details for companies the user has admin access to
  - For companies they don't manage: "and [N] other companies"
- [ ] Count of pending feed items per company
- [ ] Checkbox: "Delete pending (uncategorized) bank feed items from all affected companies" (default checked, shows counts)
- [ ] Clear statements of what stays untouched
- [ ] Type-to-confirm: institution name
- [ ] Red "Disconnect from [Institution]" button

---

## 7. Connection Management

### 7.1 Re-Authentication

When a shared Item enters `ITEM_LOGIN_REQUIRED`:

- [ ] ALL companies with mappings from this Item see the "Needs Attention" banner
- [ ] ANY admin/owner from ANY affected company can click "Fix Now"
- [ ] Launches Plaid Link in update mode using the existing Item's access token
- [ ] On success: Item restored for ALL companies simultaneously
- [ ] Activity log: "Reauthorized by [User Name] (from [Company Name])"
- [ ] Notification sent to all other affected companies: "[Institution] connection has been restored."

### 7.2 Post-Setup Account Management

From any company's Bank Connections page:

- [ ] **Remap account:** change which COA account receives the feed (dropdown of compatible COA accounts)
- [ ] **Change sync start date:** adjust the cutoff date (with historical backfill warning if moving backward)
- [ ] **Pause sync:** toggle `is_sync_enabled` to temporarily stop importing for one account without unmapping
- [ ] **Unmap account:** remove this company's claim on one account (account becomes unassigned)
- [ ] **Unmap all:** remove all this company's mappings from this Item (Tier 1 deletion)

### 7.3 Claiming Unassigned Accounts

When accounts are unassigned (either never mapped or unmapped by a previous company):

- [ ] Any user who can see the Item (has admin access to at least one company with a mapping, or is the original creator, or is super admin) can map unassigned accounts to their companies
- [ ] This is done from the "Manage Accounts" action on the connections page
- [ ] The two-step flow (assign company → map to COA + sync date) applies

### 7.4 Connection Handoff

Since connections are system-scoped and not user-owned:

- [ ] If the creator leaves: connection continues syncing. Activity log records who created it (name/email snapshot).
- [ ] Any admin in any affected company can re-authenticate, remap, or manage their company's mappings
- [ ] Only the super admin can manage connections where no active admins exist for any mapped company (orphan detection in health check)

---

## 8. Access Control Summary

| Action | Who Can Do It |
|---|---|
| Create a Plaid connection (Plaid Link) | Any user with admin/owner role in at least one company |
| See an Item in connections list | Admin/owner of any company mapped to this Item, or the creator, or super admin |
| See a specific account's details | Admin/owner of the company the account is mapped to, OR the account is unassigned |
| Map an unassigned account to a company | Admin/owner of the target company who can see the Item |
| Remap/unmap an account for their company | Admin/owner of that company |
| Re-authenticate the Item (update mode) | Any admin/owner of any affected company |
| Trigger manual sync | Any admin/owner of any affected company |
| Unmap their company (Tier 1) | Admin/owner of that company |
| Delete entire Item (Tier 2) | Creator, super admin, or admin/owner of ALL affected companies |
| View connection activity log | Admin/owner of any affected company (sees only entries for their company + system-level entries) |
| View full activity log | Super admin only |

---

## 9. Bank Connections Page — Per-Company View

### 9.1 What the Company Admin Sees

- [ ] **Institution card:**
  - Bank logo, name, status badge (active/needs attention/error)
  - "N accounts connected to [Company Name]"
  - If shared: subtle note "Shared connection" (no other company names)
  - Last sync time, created by [snapshot name]

- [ ] **Account list** (only this company's mapped accounts):
  - Account name, type, mask
  - Mapped to: COA account name
  - Sync start date
  - Balance (from Plaid)
  - Status: syncing / paused / unmapped

- [ ] **Actions per account:**
  - "Change COA mapping" → COA dropdown
  - "Change sync start date" → date picker
  - "Pause sync" / "Resume sync" toggle
  - "Unmap" → removes this company's claim

- [ ] **Actions per institution:**
  - "Sync Now" → manual sync for entire Item
  - "Fix Connection" → Plaid Link update mode (shown when needs attention)
  - "Manage Accounts" → opens mapping view showing this company's accounts + unassigned accounts
  - "Disconnect [Company Name]" → Tier 1: unmap all this company's accounts
  - "Delete Connection" → Tier 2: full removal (shown only if user has permission)

### 9.2 Unassigned Accounts in Manage View

When the user clicks "Manage Accounts":

- [ ] **This company's accounts:** full details with remap/unmap controls
- [ ] **Unassigned accounts:** full details with "Map to [Company Name]" button and COA/date pickers
- [ ] **Other companies' accounts:** only a count: "[N] accounts assigned to other companies"
- [ ] "Map unassigned account" triggers the Step 2 flow (COA + sync date) for just that account

---

## 10. Build Checklist

### 10.1 Database
- [x] Create migration: `plaid_items` (system-scoped, no tenant_id)
- [x] Create migration: `plaid_accounts` (system-scoped, no tenant_id)
- [x] Create migration: `plaid_account_mappings` (tenant-scoped bridge with sync_start_date)
- [x] Create migration: `plaid_item_activity` (activity log)
- [x] Unique constraint: `plaid_account_mappings(plaid_account_id)` — one bank account, one company
- [x] Unique constraint: `plaid_account_mappings(tenant_id, mapped_account_id)` — one COA account, one feed
- [x] Index: `plaid_items(plaid_institution_id)` for existing connection detection
- [x] Update shared types: `packages/shared/src/types/plaid.ts`

### 10.2 API — Existing Connection Detection
- [x] `checkExistingInstitution(institutionId)` — find active Items for this bank
- [x] `getVisibleAccounts(userId, plaidItemId)` — filtered account list based on user's tenant access
- [x] `getHiddenAccountCount(userId, plaidItemId)` — returned as hiddenAccountCount in getVisibleAccounts
- [x] Handle re-connection to same institution: merge/replace logic in createConnection
- [x] Handle new accounts on existing Item: add to plaid_accounts without duplicating

### 10.3 API — Two-Step Mapping
- [x] `assignAccountToCompany(plaidAccountId, tenantId, coaAccountId, syncStartDate, userId)` — combined Step 1+2
- [x] `autoSuggestCoaAccount(plaidAccountId, tenantId)` — suggest COA account by name and type matching
- [x] `createAndMapCoaAccount(plaidAccountId, tenantId, newAccountInput, syncStartDate, userId)` — create + map
- [x] Validate: COA account belongs to target tenant
- [x] Validate: no existing mapping on target COA account (unique constraint)
- [x] Validate: no existing mapping on Plaid account (one bank → one company)
- [x] Validate: sync_start_date is not in the future

### 10.4 API — Sync Start Date
- [x] Filter transactions by `sync_start_date` during sync (skip transactions before cutoff)
- [x] `updateSyncStartDate(plaidAccountId, tenantId, newDate)` — change the cutoff
- [x] Historical backfill: reset cursor and re-process when date moves backward (in updateSyncStartDate)
- [x] Dedup on backfill: skip transactions that already exist as feed items

### 10.5 API — Multi-Tenant Sync Routing
- [x] Build routing map: `plaid_account_id → { tenant_id, coa_account_id, sync_start_date }`
- [x] Route each transaction to the correct tenant based on account mapping
- [x] Create `bank_feed_items` in the correct tenant
- [x] Run AI categorization per tenant (auto-categorize after import)
- [x] Update balances per mapped account
- [x] Skip unmapped accounts (no feed items created)
- [x] Scheduled sync iterates over Items (not tenants) — one API call per Item

### 10.6 API — Tier 1 Deletion (Unmap Company)
- [x] `unmapCompany(plaidItemId, tenantId, deletePendingItems, userId)`:
  - Delete all `plaid_account_mappings` for this tenant + Item
  - Optionally delete pending `bank_feed_items` from this connection
  - Log to `plaid_item_activity`
  - Audit trail entry
  - No Plaid API call
  - Accounts become unassigned (available for other companies)

### 10.7 API — Tier 2 Deletion (Full Removal)
- [x] `deleteConnection(plaidItemId, deletePendingItems, userId)`:
  - Permission check: creator OR super admin OR admin of ALL affected companies
  - Call Plaid `/item/remove` — abort on failure
  - Delete pending `bank_feed_items` (if opted in) for ALL affected tenants
  - Delete all `plaid_account_mappings`
  - Soft-delete `plaid_accounts` (is_active = FALSE)
  - Soft-delete `plaid_items` (item_status = 'removed', removed_at, wipe access_token)
  - Write `plaid_item_activity` with full impact details
  - Audit trail: one entry per affected tenant

### 10.8 API — Access Control & Visibility
- [x] Enforce visibility filter on ALL account-returning endpoints (getVisibleAccounts in service layer)
- [x] Filter runs at service layer (not just UI)
- [x] `hidden_account_count` returned as integer, never with details
- [x] Tenant-scoped activity log: company admins see only their entries + system-level entries

### 10.9 API — Connection Management
- [x] Re-authentication: any user who can see the Item can trigger update mode
- [x] Pause/resume sync per account mapping (toggleSync)
- [x] Remap account COA (remapAccount)
- [x] Orphan detection in health check (flags items with no company mappings)

### 10.10 API — Tests
- [ ] Write Vitest tests:
  - [ ] Create connection: Item created at system level (no tenant_id)
  - [ ] Step 1: assign account to Company A → company assignment recorded
  - [ ] Step 2: map to COA + sync date → mapping created with all fields
  - [ ] Auto-suggest: Plaid "Business Checking" matches COA "Business Checking"
  - [ ] Create new COA account from Plaid data → account created in correct tenant + mapped
  - [ ] Visibility: user in Tenant A sees only Tenant A's accounts + unassigned
  - [ ] Visibility: user in Tenant A cannot see Tenant B's account details
  - [ ] Visibility: hidden_account_count returns correct number
  - [ ] Existing institution detection: same bank returns existing Item, offers merge
  - [ ] Sync routing: transactions from Account 1 go to Tenant A, Account 2 to Tenant B
  - [ ] Sync start date: transaction before cutoff silently skipped
  - [ ] Sync start date: transaction on or after cutoff imported normally
  - [ ] Sync date change backward: triggers backfill, deduplicates existing items
  - [ ] Sync date change forward: future syncs skip older transactions
  - [ ] Tier 1 (unmap): mappings removed, Item stays active, other companies unaffected
  - [ ] Tier 1 (unmap): pending feed items deleted when opted in
  - [ ] Tier 1 (unmap): posted transactions untouched
  - [ ] Tier 2 (delete): Plaid /item/remove called first
  - [ ] Tier 2 (delete): Plaid API failure → entire deletion aborted, nothing changed
  - [ ] Tier 2 (delete): all mappings across all companies removed
  - [ ] Tier 2 (delete): access_token wiped after soft-delete
  - [ ] Tier 2 (delete): notifications sent to all affected companies
  - [ ] Tier 2 permission: admin of only one affected company → blocked
  - [ ] Tier 2 permission: admin of ALL affected companies → allowed
  - [ ] Tier 2 permission: creator → allowed regardless of company membership
  - [ ] Tier 2 permission: super admin → always allowed
  - [ ] Re-auth: any affected company admin can trigger → Item restored for all
  - [ ] Creator leaves: connection keeps syncing, other admins manage
  - [ ] Unassigned account: visible to any user who can see the Item
  - [ ] Claimed account: only visible to that company's admins

### 10.11 Frontend
- [x] Create PlaidMappingWizard with COA selector + sync start date picker with quick-select buttons
- [x] COA account selector filtered by compatible types
- [x] Update Bank Connections page: filtered account list (mapped vs unassigned)
- [x] "Shared connection" indicator (Share2 icon) when hiddenAccountCount > 0
- [x] "Map Accounts" button for unassigned accounts → opens PlaidMappingWizard
- [x] "Disconnect [Company]" action → Tier 1 unmapCompany with confirmation
- [x] Re-auth "Fix Now" button shown in needs-attention banner
- [x] Connection activity log viewer (inline, filtered to company + system entries)
- [x] Remap account COA from connections page (Pencil icon → RemapAccountModal)
- [x] Pause/resume sync toggle per account (checkbox per row)
- [x] Hidden account count shown ("N in other companies")
- [x] Updated usePlaid.ts hooks for all new endpoints
- [x] "Connect separately instead" escape hatch (ExistingInstitutionDialog with two options)
- [x] Company selector dropdown for multi-company users (in PlaidMappingWizard)
- [x] Tier 2 full deletion dialog (FullDisconnectDialog with cross-company impact, type-to-confirm)

### 10.12 Ship Gate
- [ ] **Single-company use:** Connect bank → Step 1 assigns all to current company → Step 2 maps to COA with sync dates → sync delivers transactions → identical to single-tenant experience
- [ ] **Cross-company mapping:** Connect Chase → assign 2 accounts to Acme, 1 to Baker, leave 1 unassigned → each company sees only their accounts
- [ ] **Sync routing:** Transaction from Acme's checking → appears in Acme's bank feed only. Transaction from Baker's checking → Baker's feed only.
- [ ] **Sync start date:** Set Jan 1, 2026 → December 2025 transactions not imported → January 2026 transactions imported
- [ ] **Sync date change backward:** Move to Nov 1, 2025 → backfill fetches Nov–Dec transactions without duplicating January
- [ ] **Visibility:** Acme admin cannot see Baker's account name, mask, or balance. Only sees "1 account assigned to another company."
- [ ] **Existing institution:** Second user connects to Chase → "Chase is already connected" → sees only unassigned accounts → maps to their company
- [ ] **Existing institution escape:** User chooses "Connect separately" → new independent Item created
- [ ] **Tier 1 unmap:** Baker admin disconnects Baker → Baker mappings removed → Acme unaffected → Baker's accounts become unassigned
- [ ] **Tier 2 delete:** Creator clicks delete → confirmation shows all 3 companies → type institution name → Plaid /item/remove called → all mappings deleted → all companies notified
- [ ] **Tier 2 abort:** Plaid API fails during delete → nothing changes locally → user sees "Could not reach Plaid"
- [ ] **Tier 2 permission:** Admin of only Acme cannot delete a connection shared with Baker
- [ ] **Re-auth:** Chase requires re-login → Acme and Baker both see "Needs Attention" → Acme admin fixes → both restored → Baker notified
- [ ] **Creator leaves:** Sarah created connection → Sarah deactivated → connection keeps syncing → Bob (Acme admin) manages it
- [ ] **Claim unassigned:** XYZ admin opens "Manage Accounts" → sees unassigned ****4444 → maps to XYZ with sync date → XYZ starts receiving transactions
- [ ] **No cross-contamination:** API requests scoped to Tenant A never return Tenant B's feed items, even from the same Plaid Item
- [ ] **Super admin:** Connection monitor shows "Chase · 3 companies · 6 accounts" with no account details
- [ ] **Posted transactions survive deletion:** Delete connection → categorized transactions still in all companies' ledgers
- [ ] All Vitest tests passing
- [ ] QUESTIONS.md reviewed and resolved
