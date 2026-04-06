# KIS Books — Plaid Banking Integration Feature Plan

**Feature:** Full Plaid integration for bank transaction import with admin portal, user connection management, COA mapping, duplicate prevention, and clean lifecycle management
**Date:** April 2, 2026
**Depends on:** BUILD_PLAN.md Phases 1–4 (auth, COA, contacts, transaction engine), Phase 7 (banking/bank feed)
**Integrates with:** Bank Feed, Bank Reconciliation, Bank Rules, Account Register, Dashboard

---

## Feature Overview

Plaid is the bridge between the user's bank and KIS Books. This plan covers the complete lifecycle:

1. **Super Admin Portal** — system-wide Plaid API key management, environment selection, connection monitoring across all tenants
2. **User Connection Flow** — connect a bank via Plaid Link, map Plaid accounts to COA accounts, manage ongoing connections
3. **Transaction Sync** — pull transactions via `/transactions/sync`, deduplicate, feed into the bank feed review queue
4. **Webhook Handling** — receive and act on Plaid webhooks for transaction updates, errors, and consent expiration
5. **Error Recovery** — handle `ITEM_LOGIN_REQUIRED`, `PENDING_DISCONNECT`, consent expiration via Plaid Link update mode
6. **Duplicate Prevention** — prevent users from connecting the same bank account twice, detect and resolve duplicate Items
7. **Clean Disconnection** — remove connections from both KIS Books and Plaid simultaneously, with data retention options

### Plaid Concepts

| Plaid Term | KIS Books Equivalent | Description |
|---|---|---|
| **Item** | Bank Connection | A login at one financial institution. One Item can expose multiple accounts. |
| **Account** | Linked Account (maps to COA account) | A single bank, credit card, or loan account within an Item. |
| **access_token** | (encrypted, stored server-side) | Permanent token to access an Item's data. Never exposed to client. |
| **link_token** | (ephemeral, created per session) | Short-lived token to initialize Plaid Link. Created server-side, used client-side. |
| **public_token** | (ephemeral, exchanged for access_token) | One-time token returned by Plaid Link on success. 30-minute lifetime. |
| **Webhook** | Plaid event | HTTP callback from Plaid when data changes or errors occur. |

---

## 1. Data Model

### 1.1 Plaid Configuration (System-Level)

```sql
CREATE TABLE plaid_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  environment VARCHAR(20) NOT NULL DEFAULT 'sandbox',  -- 'sandbox' | 'production'
  client_id_encrypted TEXT NOT NULL,
  secret_sandbox_encrypted TEXT,
  secret_production_encrypted TEXT,
  webhook_url VARCHAR(500),
  default_products TEXT[] DEFAULT '{transactions}',
  default_country_codes TEXT[] DEFAULT '{US}',
  default_language VARCHAR(5) DEFAULT 'en',
  max_historical_days INT DEFAULT 90,
  is_active BOOLEAN DEFAULT TRUE,
  configured_by UUID REFERENCES users(id),
  configured_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

This is a singleton table (one row). System-wide, not per-tenant — all tenants share the same Plaid API keys (the KIS Books installation operator provides their Plaid credentials).

### 1.2 Plaid Items (Bank Connections)

```sql
CREATE TABLE plaid_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  plaid_item_id VARCHAR(255) NOT NULL,        -- Plaid's item_id
  plaid_institution_id VARCHAR(100),           -- Plaid's institution_id (e.g., 'ins_109508')
  institution_name VARCHAR(255),
  access_token_encrypted TEXT NOT NULL,        -- AES-256 encrypted access_token
  -- Sync state
  sync_cursor TEXT,                            -- cursor for /transactions/sync pagination
  last_sync_at TIMESTAMPTZ,
  last_sync_status VARCHAR(30),               -- 'success' | 'error' | 'pending'
  last_sync_error TEXT,
  initial_update_complete BOOLEAN DEFAULT FALSE,
  historical_update_complete BOOLEAN DEFAULT FALSE,
  -- Item health
  item_status VARCHAR(30) DEFAULT 'active',   -- 'active' | 'login_required' | 'pending_disconnect' | 'error' | 'revoked' | 'removed'
  error_code VARCHAR(100),
  error_message TEXT,
  consent_expiration_at TIMESTAMPTZ,
  -- Metadata
  link_session_id VARCHAR(255),               -- for debugging
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  removed_at TIMESTAMPTZ,                     -- soft delete timestamp
  UNIQUE(tenant_id, plaid_item_id)
);

CREATE INDEX idx_pi_tenant ON plaid_items(tenant_id);
CREATE INDEX idx_pi_status ON plaid_items(tenant_id, item_status);
CREATE INDEX idx_pi_plaid_item ON plaid_items(plaid_item_id);
```

### 1.3 Plaid Accounts (Linked Accounts)

```sql
CREATE TABLE plaid_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  plaid_item_id UUID NOT NULL REFERENCES plaid_items(id) ON DELETE CASCADE,
  plaid_account_id VARCHAR(255) NOT NULL,     -- Plaid's account_id
  persistent_account_id VARCHAR(255),          -- Plaid's persistent_account_id (for TAN institutions)
  -- Account info from Plaid
  name VARCHAR(255),                           -- account name from institution
  official_name VARCHAR(255),                  -- official account name
  account_type VARCHAR(50),                    -- 'depository' | 'credit' | 'loan' | 'investment' | 'other'
  account_subtype VARCHAR(50),                 -- 'checking' | 'savings' | 'credit card' | etc.
  mask VARCHAR(10),                            -- last 4 digits
  -- Mapping to KIS Books COA
  mapped_account_id UUID REFERENCES accounts(id),  -- the COA account this maps to
  is_mapped BOOLEAN DEFAULT FALSE,
  -- Balance (from last sync)
  current_balance DECIMAL(19,4),
  available_balance DECIMAL(19,4),
  balance_currency VARCHAR(3) DEFAULT 'USD',
  balance_updated_at TIMESTAMPTZ,
  -- Sync control
  is_sync_enabled BOOLEAN DEFAULT TRUE,        -- user can disable sync per account
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, plaid_account_id)
);

CREATE INDEX idx_pa_item ON plaid_accounts(plaid_item_id);
CREATE INDEX idx_pa_tenant ON plaid_accounts(tenant_id);
CREATE INDEX idx_pa_mapped ON plaid_accounts(tenant_id, mapped_account_id);
CREATE INDEX idx_pa_plaid_account ON plaid_accounts(plaid_account_id);
-- Duplicate prevention: one COA account can only map to one Plaid account
CREATE UNIQUE INDEX idx_pa_unique_mapping ON plaid_accounts(tenant_id, mapped_account_id) 
  WHERE mapped_account_id IS NOT NULL AND is_active = TRUE;
```

### 1.4 Plaid Webhook Log

```sql
CREATE TABLE plaid_webhook_log (
  id BIGSERIAL PRIMARY KEY,
  received_at TIMESTAMPTZ DEFAULT NOW(),
  plaid_item_id VARCHAR(255),
  webhook_type VARCHAR(100),       -- 'TRANSACTIONS' | 'ITEM' | etc.
  webhook_code VARCHAR(100),       -- 'SYNC_UPDATES_AVAILABLE' | 'ERROR' | etc.
  payload JSONB NOT NULL,
  processed BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMPTZ,
  error TEXT
);

CREATE INDEX idx_pwl_item ON plaid_webhook_log(plaid_item_id);
CREATE INDEX idx_pwl_unprocessed ON plaid_webhook_log(processed) WHERE processed = FALSE;
```

### 1.5 Duplicate Prevention Index

To prevent the same physical bank account from being connected twice (even through different Plaid Items):

```sql
-- Prevent same institution + mask + subtype from being connected twice per tenant
CREATE UNIQUE INDEX idx_pa_dedup ON plaid_accounts(
  tenant_id, plaid_account_id
) WHERE is_active = TRUE;

-- Soft dedup: same institution + last 4 digits + subtype (catches re-links)
-- This is advisory, not a hard constraint — enforced in application logic
CREATE INDEX idx_pa_soft_dedup ON plaid_accounts(
  tenant_id, mask, account_subtype
) WHERE is_active = TRUE AND mask IS NOT NULL;
```

### 1.6 Encryption

All Plaid secrets and access tokens are encrypted at rest using AES-256-GCM with a dedicated encryption key:

```env
PLAID_ENCRYPTION_KEY=  # 32-byte hex key, separate from backup encryption key
```

The encryption key is never stored in the database. Encrypt on write, decrypt on read, in the service layer only.

---

## 2. Super Admin Portal

The super admin is the person who installed and operates the KIS Books instance. They provide the Plaid API credentials that all tenants share.

### 2.1 Plaid Configuration Page

```
packages/web/src/features/admin/PlaidConfigPage.tsx
```

Accessible only to the system owner (the user who completed the setup wizard).

- [ ] **Environment selector:**
  - Radio buttons: Sandbox / Production
  - Warning when switching: "Switching environments will not migrate existing connections. Sandbox connections do not work in Production and vice versa."

- [ ] **API Credentials:**
  - Client ID (text input, masked)
  - Sandbox Secret (password input, reveal toggle)
  - Production Secret (password input, reveal toggle)
  - "Test Connection" button — calls `/link/token/create` with a dummy request to verify credentials are valid, shows success or error message

- [ ] **Webhook Configuration:**
  - Webhook URL (auto-generated from app URL: `https://your-domain.com/api/v1/plaid/webhooks`)
  - Copy-to-clipboard button
  - "Test Webhook" button (sandbox only) — fires a test webhook via `/sandbox/item/fire_webhook`
  - Note: "Configure this URL in your Plaid Dashboard under Webhooks, or it will be set automatically when creating Link tokens."

- [ ] **Default Settings:**
  - Products: checkboxes (Transactions is required and always on; Auth, Balance, Identity optional)
  - Country codes: US (default), CA, GB (multi-select)
  - Language: English (default)
  - Historical transaction days: slider 30–730 (default 90)

- [ ] **Status:**
  - Active/Inactive toggle (when inactive, no new connections can be created, existing ones stop syncing)
  - Last configuration change timestamp and by whom

### 2.2 Connection Monitor

```
packages/web/src/features/admin/PlaidConnectionsMonitorPage.tsx
```

Admin view across ALL tenants — for monitoring health and usage.

- [ ] **Summary cards:**
  - Total connections (active Items across all tenants)
  - Healthy connections (item_status = 'active')
  - Connections needing attention (login_required, pending_disconnect, error)
  - Total accounts linked

- [ ] **Connections table:**
  - Columns: Tenant, Institution, Accounts (count), Status (badge), Last Sync, Consent Expiration, Created
  - Status filter: All / Active / Needs Attention / Removed
  - Search by tenant name or institution
  - Sort by status, last sync, created date
  - Click row → detail panel showing:
    - All linked accounts with mapping status
    - Sync history (last 10 syncs with status and transaction counts)
    - Webhook history (last 10 webhooks received for this Item)
    - Error details if in error state
  - **Admin cannot see user data (transactions, balances)** — only connection metadata and health. This is a privacy boundary.

- [ ] **Webhook log viewer:**
  - Table: Timestamp, Item ID, Webhook Type, Code, Processed, Error
  - Filter by type, code, processed status
  - Useful for debugging delivery issues

- [ ] Add "Plaid" section under Admin in sidebar (visible only to super admin)

---

## 3. User Connection Flow

### 3.1 Connect Bank — Step by Step

```
User clicks "Connect Bank" → 
  API creates link_token → 
    Plaid Link opens in browser → 
      User selects institution and logs in → 
        Plaid Link returns public_token + account metadata → 
          API exchanges public_token for access_token → 
            API stores Item + Accounts → 
              User maps Plaid accounts to COA accounts → 
                Initial transaction sync begins
```

### 3.2 API Endpoints — Connection

```
POST   /api/v1/plaid/link-token                # Create link_token for new connection
POST   /api/v1/plaid/link-token/update          # Create link_token for update mode (re-auth)
POST   /api/v1/plaid/exchange                   # Exchange public_token for access_token, create Item + Accounts
GET    /api/v1/plaid/items                      # List all Items for this tenant
GET    /api/v1/plaid/items/:id                  # Get Item detail with accounts
PUT    /api/v1/plaid/items/:id                  # Update Item metadata
DELETE /api/v1/plaid/items/:id                  # Remove Item (KIS Books + Plaid)
GET    /api/v1/plaid/items/:id/accounts         # List accounts for an Item
PUT    /api/v1/plaid/accounts/:id               # Update account (mapping, sync enabled)
PUT    /api/v1/plaid/accounts/:id/map           # Map Plaid account to COA account
POST   /api/v1/plaid/items/:id/sync             # Manual sync trigger
GET    /api/v1/plaid/items/:id/sync-history     # Get sync history
POST   /api/v1/plaid/webhooks                  # Webhook receiver (no auth — verified by signature)
```

### 3.3 API Endpoints — Admin

```
GET    /api/v1/admin/plaid/config               # Get Plaid configuration
PUT    /api/v1/admin/plaid/config               # Update Plaid configuration
POST   /api/v1/admin/plaid/test                 # Test API credentials
GET    /api/v1/admin/plaid/connections           # List all connections across all tenants
GET    /api/v1/admin/plaid/connections/:id       # Get connection detail (admin view)
GET    /api/v1/admin/plaid/webhook-log           # View webhook log
GET    /api/v1/admin/plaid/stats                # Usage statistics
```

---

## 4. Service Layer

### 4.1 Plaid Client Service

```
packages/api/src/services/plaid-client.service.ts
```

Wrapper around the Plaid Node SDK that handles configuration, credential decryption, and environment switching.

- [ ] `getClient()` — returns configured PlaidApi instance using decrypted credentials and current environment
- [ ] `createLinkToken(tenantId, userId, options?)` — calls `/link/token/create` with:
  - `client_user_id`: user's UUID
  - `products`: ['transactions'] (+ any additional from config)
  - `country_codes`: from config
  - `language`: from config
  - `webhook`: configured webhook URL
  - `transactions.days_requested`: from config
  - Returns `link_token` for client-side use
- [ ] `createUpdateLinkToken(tenantId, userId, accessToken)` — creates link_token for update mode (re-authentication)
- [ ] `exchangePublicToken(publicToken)` — calls `/item/public_token/exchange`, returns `{ access_token, item_id }`
- [ ] `getItem(accessToken)` — calls `/item/get`, returns Item status and metadata
- [ ] `getAccounts(accessToken)` — calls `/accounts/get`, returns account list with balances
- [ ] `syncTransactions(accessToken, cursor?)` — calls `/transactions/sync` with pagination handling, returns `{ added, modified, removed, next_cursor, has_more }`
- [ ] `getBalances(accessToken, accountIds?)` — calls `/accounts/balance/get`
- [ ] `removeItem(accessToken)` — calls `/item/remove`
- [ ] `rotateAccessToken(accessToken)` — calls `/item/access_token/invalidate`, returns new access_token
- [ ] `verifyWebhook(headers, body)` — verify Plaid webhook signature using JWT verification

### 4.2 Plaid Connection Service

```
packages/api/src/services/plaid-connection.service.ts
```

Business logic for managing connections.

- [ ] `createConnection(tenantId, publicToken, metadata)`:
  1. Exchange public_token for access_token
  2. Call `/item/get` to fetch institution info
  3. Call `/accounts/get` to fetch account list
  4. **Duplicate check:** for each account, look for existing active `plaid_accounts` with same `mask + account_subtype` in this tenant. If found, return error with details: "Account ending in ****1234 (checking) appears to already be connected via [Institution Name]. Would you like to replace the existing connection?"
  5. Encrypt access_token and store `plaid_items` row
  6. Store `plaid_accounts` rows for each account
  7. Trigger initial sync job
  8. Return created Item with accounts

- [ ] `getItems(tenantId)` — list all Items with accounts, status, sync info

- [ ] `getItemDetail(tenantId, itemId)` — Item with accounts, last sync, webhook history

- [ ] `removeConnection(tenantId, itemId, options)`:
  1. Decrypt access_token
  2. Call Plaid `/item/remove` to revoke access on Plaid's side
  3. Mark all `plaid_accounts` for this Item as `is_active = FALSE`
  4. Mark `plaid_items` as `item_status = 'removed'`, set `removed_at`
  5. **Data retention option:** `options.delete_feed_items`:
     - If `true`: delete all `bank_feed_items` that came from this connection and haven't been categorized/matched
     - If `false` (default): keep feed items, they become orphaned but still reviewable
  6. **Do NOT delete categorized transactions** — those are in the ledger and must stay
  7. Audit log the removal

- [ ] `replaceConnection(tenantId, oldItemId, publicToken, metadata)`:
  1. Create new connection (steps from createConnection)
  2. Transfer account mappings from old Item's accounts to new Item's matching accounts (by mask + subtype)
  3. Transfer sync cursor if possible
  4. Remove old connection via removeConnection
  5. This handles the case where a user re-links the same bank

- [ ] `refreshItemStatus(tenantId, itemId)`:
  - Call `/item/get` to check current status
  - Update `item_status`, `error_code`, `error_message`, `consent_expiration_at`

### 4.3 Account Mapping Service

```
packages/api/src/services/plaid-mapping.service.ts
```

- [ ] `mapAccount(tenantId, plaidAccountId, coaAccountId)`:
  - Validate COA account exists, is a bank or credit card type, and belongs to this tenant
  - Check no other active Plaid account already maps to this COA account (unique constraint)
  - Update `plaid_accounts.mapped_account_id` and `is_mapped = TRUE`
  - Update the COA account's balance from Plaid balance data

- [ ] `unmapAccount(tenantId, plaidAccountId)`:
  - Set `mapped_account_id = NULL`, `is_mapped = FALSE`
  - Stop syncing transactions for this account (they have nowhere to go)

- [ ] `autoSuggestMapping(tenantId, plaidAccountId)`:
  - Based on Plaid account type + subtype, suggest matching COA accounts:
    - `depository/checking` → COA accounts with `detail_type = 'bank'`
    - `depository/savings` → COA accounts with `detail_type = 'bank'`
    - `credit/credit card` → COA accounts with `detail_type = 'credit_card'`
  - If account name matches a COA account name (fuzzy), boost that suggestion
  - Return ranked list of suggestions

- [ ] `createAndMapAccount(tenantId, plaidAccountId, newAccountInput)`:
  - Create a new COA account (bank or CC type) from the Plaid account info
  - Auto-fill: name from Plaid account name, type from Plaid type, detail_type from subtype
  - Map the new COA account to the Plaid account

### 4.4 Transaction Sync Service

```
packages/api/src/services/plaid-sync.service.ts
```

- [ ] `syncItem(tenantId, itemId)`:
  1. Fetch the Item and its mapped accounts
  2. Skip unmapped accounts (no COA destination)
  3. Decrypt access_token
  4. Call `/transactions/sync` with stored cursor (or NULL for first sync)
  5. Handle pagination: loop while `has_more = true`, preserving cursor state for restart on error
  6. For each `added` transaction:
     - Check for duplicate: does a `bank_feed_items` row with this `provider_transaction_id` already exist?
     - If not, create a `bank_feed_items` row linked to the correct `bank_connection` (via the mapped account)
     - Set Plaid's category as the feed item's category field
     - Run bank rules evaluation (from Bank Rules feature)
     - Run AI categorization suggestion (if no rule match)
  7. For each `modified` transaction:
     - Find existing `bank_feed_items` row by `provider_transaction_id`
     - If found and status = 'pending': update amount, description, date, category
     - If found and status = 'categorized' or 'matched': log a warning (user already acted on this, don't overwrite)
  8. For each `removed` transaction:
     - Find existing `bank_feed_items` row by `provider_transaction_id`
     - If found and status = 'pending': delete the feed item
     - If found and status = 'categorized': mark as `removed_by_institution` flag, surface to user for review
  9. Update the stored `sync_cursor` to `next_cursor`
  10. Update `last_sync_at`, `last_sync_status`, counts
  11. Update account balances from the latest balance data

- [ ] `syncAllItems(tenantId)` — sync all active Items for a tenant (called by scheduled job)
- [ ] `syncAllTenants()` — sync all active Items across all tenants (called by global scheduled job)

### 4.5 Webhook Handler Service

```
packages/api/src/services/plaid-webhook.service.ts
```

- [ ] `handleWebhook(headers, body)`:
  1. Verify webhook signature (Plaid JWT verification)
  2. Log to `plaid_webhook_log`
  3. Route to specific handler based on `webhook_type` + `webhook_code`:

| Webhook Type | Code | Action |
|---|---|---|
| TRANSACTIONS | SYNC_UPDATES_AVAILABLE | Enqueue sync job for the Item |
| TRANSACTIONS | INITIAL_UPDATE | Set `initial_update_complete = TRUE`, enqueue sync |
| TRANSACTIONS | HISTORICAL_UPDATE | Set `historical_update_complete = TRUE`, enqueue sync |
| ITEM | ERROR | Update Item status, set error code/message, notify user |
| ITEM | LOGIN_REPAIRED | Clear error state, set `item_status = 'active'` |
| ITEM | PENDING_DISCONNECT | Set `item_status = 'pending_disconnect'`, notify user |
| ITEM | USER_PERMISSION_REVOKED | Set `item_status = 'revoked'`, notify user |
| ITEM | NEW_ACCOUNTS_AVAILABLE | Flag Item for user review, show notification |
| ITEM | WEBHOOK_UPDATE_ACKNOWLEDGED | Log only |

  4. Mark webhook as processed

- [ ] Webhook endpoint is unauthenticated (Plaid calls it directly) but verified via Plaid's webhook verification (JWT signature check using Plaid's public key)
- [ ] Idempotent: duplicate webhooks are detected via the log and skipped

### 4.6 Scheduled Jobs

- [ ] **Periodic sync job** (BullMQ, runs every 4 hours):
  - Call `syncAllTenants()` to pull new transactions from all active Items
  - This is a fallback — primary sync is triggered by webhooks
  - Respects Plaid rate limits (handle 429 responses with exponential backoff)

- [ ] **Health check job** (BullMQ, runs daily):
  - For each active Item, call `/item/get` to refresh status
  - Detect stale Items (no sync in 7+ days), flag for review
  - Detect Items approaching consent expiration (< 7 days)
  - Surface health issues in admin dashboard

- [ ] **Balance refresh job** (BullMQ, runs daily):
  - Call `/accounts/balance/get` for all active Items
  - Update `plaid_accounts` balance fields
  - Update mapped COA account balances if they differ

---

## 5. Frontend — User Connection Management

### 5.1 Bank Connections Page

```
packages/web/src/features/banking/BankConnectionsPage.tsx
```

This is the user's primary interface for managing their bank connections.

- [ ] **Connected institutions list:**
  - Card per institution: logo (from Plaid), name, status badge, number of linked accounts, last sync time
  - Status badges:
    - 🟢 Active — syncing normally
    - 🟡 Needs Attention — `ITEM_LOGIN_REQUIRED` or `PENDING_DISCONNECT`
    - 🔴 Error — connection broken
    - ⚪ Removed — disconnected (shown in "removed" section)
  - Expand card → shows linked accounts with mapping status

- [ ] **Per-account detail (within institution card):**
  - Account name, type, last 4 digits (mask)
  - Mapped to: [COA Account Name] or "Not mapped" (with "Map" button)
  - Sync enabled/disabled toggle
  - Current balance (from Plaid)
  - Last sync count: "23 transactions synced in last sync"

- [ ] **Action buttons per institution:**
  - "Sync Now" — manual sync trigger
  - "Update Connection" — launches Plaid Link in update mode (for re-auth)
  - "Disconnect" — opens confirmation dialog (see §5.4)

- [ ] **"Connect Bank" button:**
  - Launches Plaid Link
  - On success → shows account mapping step (see §5.2)

- [ ] **Needs Attention section** (shown at top if any Items need action):
  - Banner: "[Institution Name] requires re-authentication. [Fix Now]"
  - "Fix Now" launches Plaid Link in update mode

### 5.2 Account Mapping Modal

```
packages/web/src/features/banking/AccountMappingModal.tsx
```

Shown immediately after a new connection is created, and accessible from the connections page.

- [ ] **For each Plaid account in the new connection:**
  - Plaid account info: name, type, last 4, balance
  - Mapping options:
    1. "Map to existing account" — COA account dropdown (filtered to matching types, with auto-suggestion highlighted)
    2. "Create new account" — creates a COA account auto-filled from Plaid info (name, type)
    3. "Don't import" — sets `is_sync_enabled = FALSE` for this account
  - Auto-suggest: if a COA account name matches the Plaid account name (or type matches), pre-select it

- [ ] **Duplicate detection:**
  - If a Plaid account's mask + subtype matches an already-connected Plaid account, show a warning:
    - "An account ending in ****1234 (checking) is already connected via [Other Institution]. Connecting it again may cause duplicate transactions."
    - Options: "Replace existing connection" / "Skip this account" / "Connect anyway"

- [ ] **Validation:**
  - A COA account cannot be mapped to two Plaid accounts simultaneously (hard constraint)
  - If user selects a COA account that's already mapped, show: "This account is already linked to [Institution - ****5678]. Unlink it first."

- [ ] "Save Mappings" → starts initial transaction sync for mapped accounts

### 5.3 Remap Account Modal

```
packages/web/src/features/banking/RemapAccountModal.tsx
```

For changing an account's COA mapping after initial setup.

- [ ] Show current mapping (or "Not mapped")
- [ ] COA account dropdown (same as mapping modal)
- [ ] Warning if changing mapping: "Changing the mapping will affect where future transactions are imported. Existing transactions in the bank feed will not be moved."
- [ ] "Create new account" option
- [ ] "Unmap" option (stops syncing transactions for this account)

### 5.4 Disconnect Confirmation Dialog

```
packages/web/src/features/banking/DisconnectDialog.tsx
```

Disconnecting is a significant action. The dialog must be clear about what happens.

- [ ] **What will happen:**
  - "This will revoke KIS Books' access to [Institution Name] on Plaid's servers."
  - "No new transactions will be imported from this connection."

- [ ] **What will NOT happen:**
  - "Transactions already imported and categorized will remain in your books."
  - "Your bank account in your Chart of Accounts will not be deleted."

- [ ] **Data options:**
  - "Delete pending (uncategorized) bank feed items from this connection" — checkbox (default checked)
  - Count shown: "12 pending items will be deleted"

- [ ] **Confirmation:**
  - Type the institution name to confirm
  - "Disconnect" button (red/danger style)

### 5.5 Dashboard Integration

- [ ] **Banking health indicators:**
  - If any Item has `item_status != 'active'`, show a banner: "1 bank connection needs attention. [Fix]"
  - Number of pending bank feed items (from all connections)

---

## 6. Duplicate Prevention — Comprehensive Strategy

### 6.1 Pre-Connection Checks

Before the user even opens Plaid Link:

- [ ] Check if the user already has active connections to the institution they're about to connect
- [ ] If so, warn: "You already have a connection to [Institution]. Connecting again may create duplicates. Would you like to update your existing connection instead?"
- [ ] This check uses Plaid's `institution_id` from existing Items

### 6.2 Post-Connection Checks

After Plaid Link completes and accounts are returned:

- [ ] For each returned Plaid account, check for existing `plaid_accounts` with matching:
  - Same `mask` (last 4 digits) AND same `account_subtype` AND same `tenant_id`
  - OR same `persistent_account_id` (for TAN institutions like Chase, PNC)
- [ ] If a match is found:
  - If the match is on the same Item → this is a re-link (update mode). Transfer the mapping.
  - If the match is on a different Item → this is a potential duplicate:
    - Show warning with details of both connections
    - Offer: "Replace [old institution connection]" or "Skip this account" or "Keep both (advanced)"
    - Default action: replace old connection

### 6.3 Ongoing Dedup

- [ ] Database unique index on `(tenant_id, mapped_account_id)` prevents two Plaid accounts from mapping to the same COA account
- [ ] Transaction dedup: `bank_feed_items.provider_transaction_id` is unique per tenant — the same Plaid transaction cannot be imported twice
- [ ] Plaid's `persistent_account_id` (when available) is used as the definitive account identity for TAN institutions

### 6.4 Admin Dedup Tools

- [ ] Admin connection monitor shows a "Potential Duplicates" flag if two Items from the same institution exist for one tenant
- [ ] Admin can view details but cannot modify user data (privacy boundary)

---

## 7. Error Handling & Recovery

### 7.1 Error States and User Actions

| Error State | Cause | User Action | Auto-Recovery? |
|---|---|---|---|
| `ITEM_LOGIN_REQUIRED` | Password changed, MFA expired, OAuth revoked | Launch update mode via "Fix Now" | Yes — listen for `LOGIN_REPAIRED` webhook |
| `PENDING_DISCONNECT` | OAuth consent expiring, institution API migration | Launch update mode before expiration | No — must re-auth before deadline |
| `USER_PERMISSION_REVOKED` | User revoked access via bank's website | Re-connect via fresh Plaid Link | No — Item is terminal |
| `INSTITUTION_ERROR` | Bank is down or experiencing issues | Wait and retry | Yes — transient, retry on next sync |
| `RATE_LIMIT_EXCEEDED` | Too many API calls | Automatic backoff | Yes — exponential retry |

### 7.2 User Notifications

- [ ] Email notification when a connection enters error state (if SMTP configured)
- [ ] In-app notification banner on dashboard and connections page
- [ ] Specific, actionable messages — not generic "something went wrong"

### 7.3 Access Token Rotation

- [ ] Rotate access tokens periodically (every 90 days) via `/item/access_token/invalidate`
- [ ] Scheduled job handles rotation, re-encrypts and stores new token
- [ ] Transparent to user — no action required

---

## 8. Security

### 8.1 Token Security

- [ ] Access tokens encrypted at rest with AES-256-GCM using dedicated `PLAID_ENCRYPTION_KEY`
- [ ] Encryption key stored only in environment variable, never in database
- [ ] Access tokens never logged, never returned in API responses, never exposed to frontend
- [ ] Token rotation every 90 days

### 8.2 Webhook Security

- [ ] All incoming webhooks verified using Plaid's JWT-based webhook verification
- [ ] Webhook endpoint is public (no auth) but signature-verified
- [ ] Webhook payloads logged but access_tokens are never included in webhooks (Plaid doesn't send them)
- [ ] Rate limiting on webhook endpoint (100 requests/minute)

### 8.3 Link Token Security

- [ ] Link tokens are short-lived (30 minutes) and single-use
- [ ] Created server-side only, passed to client via authenticated API call
- [ ] Include `client_user_id` tied to the authenticated user's ID

### 8.4 Data Access

- [ ] Super admin can see connection metadata but NOT user financial data (balances, transactions)
- [ ] Users can only see their own connections (tenant-scoped)
- [ ] Plaid credentials are system-wide — admin configures once, all tenants share

---

## 9. Build Checklist

### 9.1 Database & Shared Types
- [x] Create migration: `plaid_config` table
- [x] Create migration: `plaid_items` table
- [x] Create migration: `plaid_accounts` table
- [x] Create migration: `plaid_webhook_log` table
- [x] Create unique index for duplicate prevention on `plaid_accounts`
- [x] Create unique mapping index `(tenant_id, mapped_account_id)` (via soft_dedup index)
- [x] Create `packages/shared/src/types/plaid.ts` — all Plaid-related types
- [x] Create `packages/shared/src/schemas/plaid.ts` — Zod schemas
- [x] Add `PLAID_ENCRYPTION_KEY` to `.env.example`

### 9.2 API — Plaid Client
- [x] Install `plaid` Node SDK package
- [x] Create `packages/api/src/services/plaid-client.service.ts` — SDK wrapper with all Plaid API calls
- [x] Implement AES-256-GCM encryption/decryption for access tokens (`utils/encryption.ts`)
- [x] Implement Plaid webhook JWT signature verification (verifyWebhook in plaid-client.service.ts)
- [x] Handle Plaid rate limiting (429 responses) with exponential backoff (retryWithBackoff in sync)
- [ ] Handle Plaid error codes with typed error mapping

### 9.3 API — Connection Management
- [x] Create `packages/api/src/services/plaid-connection.service.ts` — create, list, remove, replace connections
- [x] Implement duplicate detection on connection creation (mask + subtype + tenant)
- [x] Implement `persistent_account_id` matching for TAN institutions
- [x] Create `packages/api/src/services/plaid-mapping.service.ts` — map, unmap, auto-suggest, create-and-map
- [x] Enforce unique COA-to-Plaid mapping constraint
- [x] Implement connection replacement flow (replaceConnection with mapping transfer)
- [x] Create `packages/api/src/routes/plaid.routes.ts` — all user-facing Plaid endpoints
- [x] Create admin Plaid endpoints (in admin.routes.ts)
- [x] Audit trail on all connection operations

### 9.4 API — Transaction Sync
- [x] Create `packages/api/src/services/plaid-sync.service.ts` — sync Item, sync all, handle pagination
- [x] Implement cursor-based pagination with restart-on-error handling
- [x] Implement `added` → create bank_feed_items with dedup check
- [x] Implement `modified` → update pending feed items, warn on categorized items
- [x] Implement `removed` → delete pending feed items, flag categorized items
- [x] Integrate with AI categorization (auto-categorize on sync via batchCategorize)
- [x] Flagging removed categorized transactions with [REMOVED BY INSTITUTION] prefix
- [x] Update account balances after sync

### 9.5 API — Webhooks
- [x] Create `packages/api/src/services/plaid-webhook.service.ts` — handler with routing
- [x] Create `POST /api/v1/plaid/webhooks` endpoint (unauthenticated)
- [x] Handle SYNC_UPDATES_AVAILABLE → trigger sync
- [x] Handle INITIAL_UPDATE / HISTORICAL_UPDATE → update flags
- [x] Handle ITEM ERROR → update Item status
- [x] Handle LOGIN_REPAIRED → clear error state
- [x] Handle PENDING_DISCONNECT → update status
- [x] Handle USER_PERMISSION_REVOKED → mark Item as revoked
- [x] Handle NEW_ACCOUNTS_AVAILABLE → flag for user review
- [x] Implement webhook logging (plaid_webhook_log table)

### 9.6 API — Scheduled Jobs
- [x] Create `packages/worker/src/processors/plaid-sync.processor.ts` — periodic sync
- [x] Create `packages/worker/src/processors/plaid-health.processor.ts` — daily health check
- [x] Create `packages/worker/src/processors/plaid-balance.processor.ts` — daily balance refresh
- [x] Create `packages/worker/src/processors/plaid-token-rotation.processor.ts` — 90-day token rotation

### 9.7 API — Tests
- [x] Write Vitest tests:
  - [x] Encryption round-trip (AES-256-GCM)
  - [x] Config create default + update
  - [x] Auto-suggest mapping by account type
  - [x] Unique constraint prevents double-mapping
  - [x] Webhook log creation
  - [x] Webhook LOGIN_REPAIRED → clears error
  - [x] Webhook ITEM ERROR → updates status
  - [x] Webhook USER_PERMISSION_REVOKED → marks revoked

### 9.8 Frontend — Admin Portal
- [x] Create `PlaidConfigPage.tsx` — credentials, environment, settings, test connection
- [x] Create `PlaidConnectionsMonitorPage.tsx` — cross-tenant connection health dashboard
- [x] Create webhook log viewer (in PlaidConnectionsMonitorPage)
- [x] Add "Plaid" to admin sidebar section
- [x] Implement credential masking (placeholder text)
- [x] Implement "Test Connection" button with success/error feedback

### 9.9 Frontend — User Connection Management
- [x] Install `react-plaid-link` package
- [x] Update `BankConnectionsPage.tsx` — institution cards with status, accounts, actions, Plaid Link
- [x] Create `AccountMappingModal.tsx` — post-connection mapping with COA dropdown
- [x] Create `RemapAccountModal.tsx` — change COA mapping with auto-suggestions
- [x] Create `DisconnectDialog.tsx` — confirmation with data retention options
- [x] Implement Plaid Link launch (new connection via PlaidLinkButton)
- [x] Implement Plaid Link update mode (via useCreateUpdateLinkToken hook)
- [x] Implement "Needs Attention" banner with "Fix Now" action
- [x] Implement per-account sync toggle (checkbox in account rows)
- [x] Implement manual "Sync Now" button
- [x] Implement sync history endpoint (GET /items/:id/sync-history)
- [x] Update dashboard with banking health indicators (banner + connection count)
- [x] Create `packages/web/src/api/hooks/usePlaid.ts` — React Query hooks for all Plaid endpoints

### 9.10 Frontend — Setup Wizard Integration
- [ ] Add optional "Plaid encryption key" field to setup wizard security step
- [ ] Auto-generate Plaid encryption key if not provided
- [ ] Add note: "Plaid API credentials are configured separately in Admin > Plaid after setup."

### 9.11 Ship Gate
- [ ] **Admin:** Configure Plaid credentials → test connection → success
- [ ] **Admin:** Switch environment sandbox → production (with warning)
- [ ] **Admin:** Connection monitor shows all tenant connections with correct status
- [ ] **Admin:** Webhook log shows received webhooks
- [ ] **Admin:** Cannot see user transaction data or balances (privacy boundary)
- [ ] **User:** "Connect Bank" → Plaid Link opens → select institution → login → accounts returned
- [ ] **User:** Account mapping: auto-suggest selects correct COA account type
- [ ] **User:** Account mapping: "Create new account" creates COA account with correct type and maps it
- [ ] **User:** Transactions sync after mapping → bank feed items appear in review queue
- [ ] **User:** Manual "Sync Now" → pulls new transactions
- [ ] **User:** Webhook-triggered sync → new transactions appear without manual action
- [ ] **Duplicate prevention:** Connecting same bank account twice → warning shown with replace/skip options
- [ ] **Duplicate prevention:** Same COA account cannot be mapped to two Plaid accounts (constraint enforced)
- [ ] **Duplicate prevention:** Same Plaid transaction_id cannot create two bank feed items
- [ ] **Error recovery:** Simulate ITEM_LOGIN_REQUIRED → "Needs Attention" banner → "Fix Now" → update mode → connection restored
- [ ] **Error recovery:** PENDING_DISCONNECT webhook → user notified → re-auth before deadline
- [ ] **Disconnect:** User disconnects institution → Plaid /item/remove called → local data soft-deleted → pending feed items optionally deleted
- [ ] **Disconnect:** Categorized transactions survive disconnection (still in ledger)
- [ ] **Re-connect:** After disconnect, user connects same bank again → new Item created, fresh sync starts
- [ ] **Replace:** Duplicate detected → "Replace existing" → old connection removed, mappings transferred to new
- [ ] **Security:** Access tokens encrypted at rest, never in API responses or logs
- [ ] **Security:** Webhook signature verification rejects tampered payloads
- [ ] **Scheduled sync:** 4-hour job runs and pulls new transactions for all active Items
- [ ] **Balance refresh:** Daily balance update matches Plaid balances
- [ ] **Token rotation:** 90-day rotation completes without user action
- [ ] All Vitest tests passing
- [ ] QUESTIONS.md reviewed and resolved
