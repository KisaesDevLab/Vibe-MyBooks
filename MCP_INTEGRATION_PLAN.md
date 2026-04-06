# KIS Books — MCP Server Integration Plan

**Feature:** Model Context Protocol (MCP) server exposing full KIS Books functionality to AI assistants, with tenant-scoped access control, dual authentication (API key + OAuth 2.0), and comprehensive audit logging
**Date:** April 5, 2026
**Depends on:** BUILD_PLAN.md (full MVP), all feature plans
**Integrates with:** Auth system, all application services

---

## Overview

KIS Books exposes an MCP server that allows AI assistants (Claude, GPT, etc.) to interact with the bookkeeping system on behalf of an authenticated user. The MCP server provides the same capabilities as the web UI — querying data, creating transactions, running reports, managing contacts — but scoped to only the companies the authenticated user has access to.

### Key Principles

- **User-permissioned access:** MCP operates under the authenticated user's permissions. If the user can't do it in the UI, the MCP tool can't do it either.
- **Tenant isolation:** Every MCP call requires a company context. The server rejects any request that targets a company the user doesn't have access to.
- **Full financial access:** Unlike the internal AI processing features (which are processing-only), MCP gives the user's own AI assistant access to their financial data — because the user deliberately connected it.
- **Audited:** Every MCP call is logged with source = 'mcp', the tool name, parameters, and the API key or OAuth token used.
- **Rate-limited:** Per-key rate limiting prevents runaway AI loops.

### MCP vs Internal AI Processing

| Aspect | Internal AI (AI_PROCESSING_PLAN) | MCP Server (this plan) |
|---|---|---|
| Who controls it | System admin configures providers | User connects their own AI assistant |
| Data access | Processing only — no reporting or analysis | Full access — everything the user can see |
| PII handling | Sanitized before sending to cloud LLMs | User's choice — it's their AI assistant and their data |
| Authentication | Internal service calls (no user auth) | User API key or OAuth token |
| Scope | Categorization, OCR, document parsing | All CRUD, reports, banking, settings |

---

## 1. Architecture

### 1.1 MCP Server Endpoint

```
MCP Transport: Streamable HTTP (POST /mcp)
URL: https://your-kisbooks-instance.com/mcp
Auth: Bearer token (API key or OAuth access token)
```

The MCP server runs as part of the existing Express application — not a separate service. It shares the same database, services, and middleware.

### 1.2 Request Flow

```
AI Assistant (Claude, GPT, etc.)
  │
  ├→ MCP Request (tool call or resource read)
  │    Headers: Authorization: Bearer <api_key_or_oauth_token>
  │
  ├→ KIS Books MCP Endpoint (/mcp)
  │    │
  │    ├→ Authenticate: validate token → resolve user
  │    ├→ Rate limit check: per-key throttle
  │    ├→ Company context: resolve from tool params or active session
  │    ├→ Permission check: user has access to this company + action
  │    ├→ Execute: call existing service layer (same code as UI)
  │    ├→ Audit log: record MCP call with tool, params, result status
  │    └→ Response: structured result
  │
  └→ AI Assistant processes response
```

### 1.3 Company Context

Every MCP tool call requires a company context. Two approaches coexist:

**Explicit (recommended):** Each tool accepts a `company_id` parameter. The AI assistant specifies which company to operate on per-call.

**Session-based:** The `set_active_company` tool establishes context for subsequent calls. Useful for conversational flows where the user says "let's work on Acme LLC" and subsequent commands assume Acme.

If neither is provided, the server returns an error listing available companies for the user to choose from.

---

## 2. Authentication

### 2.1 API Keys

```sql
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,                  -- "Claude Desktop", "My GPT Assistant"
  key_hash VARCHAR(255) NOT NULL,              -- SHA-256 hash of the key (key itself shown once)
  key_prefix VARCHAR(12) NOT NULL,             -- first 8 chars for identification: "kis_abc12345..."
  -- Permissions
  scopes TEXT[] DEFAULT '{all}',               -- 'all' | 'read' | 'write' | 'reports' | specific scopes
  allowed_companies UUID[],                    -- NULL = all companies user has access to; specific IDs = restricted
  -- Rate limiting
  rate_limit_per_minute INT DEFAULT 60,
  rate_limit_per_hour INT DEFAULT 1000,
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  last_used_at TIMESTAMPTZ,
  last_used_ip INET,
  total_requests BIGINT DEFAULT 0,
  -- Lifecycle
  expires_at TIMESTAMPTZ,                      -- NULL = never expires
  created_at TIMESTAMPTZ DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES users(id)
);

CREATE INDEX idx_ak_user ON api_keys(user_id);
CREATE INDEX idx_ak_hash ON api_keys(key_hash) WHERE is_active = TRUE;
CREATE INDEX idx_ak_prefix ON api_keys(key_prefix);
```

**Key format:** `kis_` prefix + 40 random alphanumeric characters. Example: `kis_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0`

**Key lifecycle:**
- Generated in user settings → shown ONCE → user copies → stored as SHA-256 hash
- Key can be restricted to specific companies (`allowed_companies`)
- Key can be restricted to specific scopes (read-only, write, reports-only)
- Key can have an expiration date
- Key can be revoked at any time (instant, all active sessions terminated)

### 2.2 OAuth 2.0

```sql
CREATE TABLE oauth_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id VARCHAR(100) NOT NULL UNIQUE,
  client_secret_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,                  -- "Claude.ai", "Custom Integration"
  redirect_uris TEXT[] NOT NULL,
  grant_types TEXT[] DEFAULT '{authorization_code}',
  scopes TEXT[] DEFAULT '{all}',
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES users(id),        -- super admin creates OAuth clients
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE oauth_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES oauth_clients(id),
  user_id UUID NOT NULL REFERENCES users(id),
  access_token_hash VARCHAR(255) NOT NULL,
  refresh_token_hash VARCHAR(255),
  scopes TEXT[] NOT NULL,
  access_token_expires_at TIMESTAMPTZ NOT NULL,
  refresh_token_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  revoked_at TIMESTAMPTZ
);

CREATE TABLE oauth_authorization_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES oauth_clients(id),
  user_id UUID NOT NULL REFERENCES users(id),
  code_hash VARCHAR(255) NOT NULL,
  redirect_uri TEXT NOT NULL,
  scopes TEXT[] NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,             -- short-lived: 10 minutes
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**OAuth flow:**
1. AI assistant redirects user to `GET /oauth/authorize?client_id=...&redirect_uri=...&scope=...`
2. User logs in (if not already) and sees consent screen: "Allow [App Name] to access your KIS Books data?"
3. User approves → redirect with authorization code
4. AI assistant exchanges code for access_token + refresh_token via `POST /oauth/token`
5. Access token used as Bearer token on MCP calls
6. Refresh token used to get new access tokens when they expire

### 2.3 Token Resolution Middleware

```typescript
async function resolveMcpAuth(req): Promise<McpAuthContext> {
  const token = extractBearerToken(req);
  
  // Try API key first (starts with "kis_")
  if (token.startsWith('kis_')) {
    const hash = sha256(token);
    const apiKey = await findApiKeyByHash(hash);
    if (!apiKey || !apiKey.is_active) throw new AuthError('Invalid API key');
    if (apiKey.expires_at && apiKey.expires_at < now()) throw new AuthError('API key expired');
    return { user: apiKey.user, source: 'api_key', keyId: apiKey.id, scopes: apiKey.scopes, allowedCompanies: apiKey.allowed_companies };
  }
  
  // Try OAuth token
  const hash = sha256(token);
  const oauthToken = await findOAuthTokenByHash(hash);
  if (!oauthToken || oauthToken.revoked_at) throw new AuthError('Invalid token');
  if (oauthToken.access_token_expires_at < now()) throw new AuthError('Token expired');
  return { user: oauthToken.user, source: 'oauth', scopes: oauthToken.scopes, allowedCompanies: null };
}
```

---

## 3. MCP Tools

### 3.1 Context Tools

| Tool | Description | Parameters |
|---|---|---|
| `list_companies` | List all companies the user has access to | — |
| `set_active_company` | Set the active company for subsequent calls | `company_id` |
| `get_active_company` | Get the currently active company | — |
| `get_company_info` | Get company details (name, address, fiscal year, settings) | `company_id?` |

### 3.2 Chart of Accounts Tools

| Tool | Description | Parameters |
|---|---|---|
| `list_accounts` | List COA accounts with optional filters | `company_id?`, `type?`, `active_only?`, `search?` |
| `get_account` | Get account detail with balance | `company_id?`, `account_id` |
| `create_account` | Create a new COA account | `company_id?`, `name`, `type`, `detail_type`, `number?`, `description?` |
| `update_account` | Update an account | `company_id?`, `account_id`, `name?`, `description?`, `is_active?` |
| `get_account_balance` | Get current balance for an account | `company_id?`, `account_id`, `as_of_date?` |

### 3.3 Contact Tools

| Tool | Description | Parameters |
|---|---|---|
| `list_contacts` | List contacts with filters | `company_id?`, `type?`, `search?`, `active_only?` |
| `get_contact` | Get contact detail | `company_id?`, `contact_id` |
| `create_contact` | Create a new contact | `company_id?`, `display_name`, `type`, `email?`, `phone?`, `address?` |
| `update_contact` | Update a contact | `company_id?`, `contact_id`, `fields...` |

### 3.4 Transaction Tools

| Tool | Description | Parameters |
|---|---|---|
| `list_transactions` | List transactions with filters | `company_id?`, `type?`, `date_from?`, `date_to?`, `contact_id?`, `account_id?`, `search?`, `limit?`, `offset?` |
| `get_transaction` | Get full transaction detail with journal lines | `company_id?`, `transaction_id` |
| `create_expense` | Create an expense/check | `company_id?`, `date`, `payee_id`, `account_id`, `amount`, `lines[]`, `memo?` |
| `create_deposit` | Create a deposit | `company_id?`, `date`, `account_id`, `amount`, `lines[]`, `memo?` |
| `create_invoice` | Create an invoice | `company_id?`, `customer_id`, `date`, `due_date`, `lines[]`, `memo?` |
| `create_cash_sale` | Create a cash sale | `company_id?`, `customer_id`, `date`, `lines[]`, `payment_method?` |
| `create_journal_entry` | Create a journal entry | `company_id?`, `date`, `lines[]`, `memo?` |
| `create_transfer` | Transfer between accounts | `company_id?`, `from_account_id`, `to_account_id`, `amount`, `date`, `memo?` |
| `update_transaction` | Update a transaction | `company_id?`, `transaction_id`, `fields...` |
| `void_transaction` | Void a transaction | `company_id?`, `transaction_id`, `reason?` |

### 3.5 Invoice Tools

| Tool | Description | Parameters |
|---|---|---|
| `list_invoices` | List invoices with status filter | `company_id?`, `status?`, `customer_id?`, `date_from?`, `date_to?`, `overdue_only?` |
| `get_invoice` | Get invoice detail | `company_id?`, `invoice_id` |
| `send_invoice` | Send invoice via email | `company_id?`, `invoice_id`, `email?` |
| `record_payment` | Record payment against invoice(s) | `company_id?`, `customer_id`, `amount`, `date`, `applications[]`, `deposit_to?` |
| `get_overdue_summary` | Get overdue invoice summary | `company_id?` |

### 3.6 Bank Feed Tools

| Tool | Description | Parameters |
|---|---|---|
| `list_bank_feed_items` | List pending bank feed items | `company_id?`, `account_id?`, `status?`, `date_from?`, `date_to?` |
| `categorize_feed_item` | Categorize a bank feed item | `company_id?`, `feed_item_id`, `account_id`, `contact_id?`, `memo?` |
| `match_feed_item` | Match a feed item to existing transaction | `company_id?`, `feed_item_id`, `transaction_id` |
| `get_bank_connections` | List Plaid connections and status | `company_id?` |
| `sync_bank_connection` | Trigger manual sync | `company_id?`, `connection_id` |

### 3.7 Report Tools

| Tool | Description | Parameters |
|---|---|---|
| `run_profit_loss` | Generate P&L report | `company_id?`, `start_date`, `end_date`, `compare?`, `cash_or_accrual?` |
| `run_balance_sheet` | Generate balance sheet | `company_id?`, `as_of_date`, `compare?` |
| `run_cash_flow` | Generate cash flow statement | `company_id?`, `start_date`, `end_date` |
| `run_trial_balance` | Generate trial balance | `company_id?`, `as_of_date` |
| `run_ar_aging` | Accounts receivable aging | `company_id?`, `as_of_date` |
| `run_ap_aging` | Accounts payable aging | `company_id?`, `as_of_date` |
| `run_general_ledger` | General ledger for an account or all | `company_id?`, `account_id?`, `start_date`, `end_date` |
| `run_sales_by_customer` | Sales summary by customer | `company_id?`, `start_date`, `end_date` |
| `run_expense_by_vendor` | Expense summary by vendor | `company_id?`, `start_date`, `end_date` |
| `run_budget_vs_actual` | Budget vs actual report | `company_id?`, `start_date`, `end_date` |
| `run_custom_report` | Run any report by name with params | `company_id?`, `report_name`, `params` |

### 3.8 Items Tools

| Tool | Description | Parameters |
|---|---|---|
| `list_items` | List products/services | `company_id?`, `active_only?`, `search?` |
| `get_item` | Get item detail | `company_id?`, `item_id` |
| `create_item` | Create a new item | `company_id?`, `name`, `unit_price`, `income_account_id`, `is_taxable?`, `description?` |
| `update_item` | Update an item | `company_id?`, `item_id`, `fields...` |

### 3.9 Tags Tools

| Tool | Description | Parameters |
|---|---|---|
| `list_tags` | List tag groups and tags | `company_id?` |
| `create_tag` | Create a tag | `company_id?`, `group_id`, `name` |
| `tag_transaction` | Apply tags to a transaction | `company_id?`, `transaction_id`, `tag_ids[]` |

### 3.10 Reconciliation Tools

| Tool | Description | Parameters |
|---|---|---|
| `get_reconciliation_status` | Get reconciliation status for an account | `company_id?`, `account_id` |
| `list_unreconciled` | List unreconciled transactions | `company_id?`, `account_id` |

### 3.11 Search Tool

| Tool | Description | Parameters |
|---|---|---|
| `search` | Global search across transactions, contacts, invoices | `company_id?`, `query`, `entity_types?` |

---

## 4. MCP Resources

MCP resources provide read-only access to data that AI assistants can reference.

| Resource URI | Description |
|---|---|
| `kisbooks://companies` | List of companies the user can access |
| `kisbooks://company/{id}/chart-of-accounts` | Full COA for a company |
| `kisbooks://company/{id}/contacts` | Contact list |
| `kisbooks://company/{id}/recent-transactions` | Last 50 transactions |
| `kisbooks://company/{id}/bank-feed/pending` | Pending bank feed items |
| `kisbooks://company/{id}/invoices/overdue` | Overdue invoices |
| `kisbooks://company/{id}/dashboard` | Dashboard summary (balances, receivables, payables) |

Resources are read-only snapshots. The AI assistant can subscribe to resource updates for real-time changes (if the MCP transport supports it).

---

## 5. Tenant Scoping

### 5.1 Company Resolution

Every tool call goes through company resolution:

```typescript
function resolveCompany(auth: McpAuthContext, params: ToolParams): string {
  // 1. Explicit company_id in params (highest priority)
  if (params.company_id) {
    if (!userHasAccess(auth.user, params.company_id)) {
      throw new McpError('ACCESS_DENIED', 'You do not have access to this company');
    }
    if (auth.allowedCompanies && !auth.allowedCompanies.includes(params.company_id)) {
      throw new McpError('ACCESS_DENIED', 'This API key is not authorized for this company');
    }
    return params.company_id;
  }
  
  // 2. Active company from session
  if (auth.activeCompanyId) {
    return auth.activeCompanyId;
  }
  
  // 3. User has exactly one company — use it implicitly
  const companies = getUserCompanies(auth.user);
  if (companies.length === 1) {
    return companies[0].id;
  }
  
  // 4. Ambiguous — ask the user to specify
  throw new McpError('COMPANY_REQUIRED', 
    'Multiple companies available. Please specify company_id or use set_active_company.',
    { available_companies: companies.map(c => ({ id: c.id, name: c.name })) }
  );
}
```

### 5.2 Scope Enforcement

- [ ] Every service call from MCP passes through the same tenant-scoped middleware as the web UI
- [ ] API key `allowed_companies` array provides an additional restriction layer (subset of user's access)
- [ ] OAuth scopes can further restrict access (e.g., `read` scope blocks write tools)
- [ ] The MCP server never constructs queries without a `tenant_id` filter

### 5.3 Permission Matrix

| Scope | What it allows |
|---|---|
| `all` | Everything the user can do |
| `read` | All list/get/report tools. No create/update/void. |
| `write` | Create and update transactions, contacts, items. No void/delete. |
| `reports` | Report tools only. No transaction access. |
| `banking` | Bank feed tools only. |
| `invoicing` | Invoice and payment tools only. |

Scopes are additive — an API key with `['read', 'invoicing']` can read everything and also create/send invoices.

---

## 6. Rate Limiting

### 6.1 Per-Key Limits

```typescript
interface RateLimits {
  perMinute: number;    // default 60
  perHour: number;      // default 1000
  perDay: number;       // default 10000
}
```

- [ ] Rate limits tracked in Redis per API key or OAuth token
- [ ] When exceeded: return MCP error with `retry_after_seconds`
- [ ] Rate limits configurable per API key (user can lower, admin can set system maximums)
- [ ] Separate limits for read vs write operations (writes are more expensive)

### 6.2 System-Wide Limits

- [ ] Admin configurable maximum requests per minute across ALL MCP keys (protects the server)
- [ ] Default: 500 requests/minute system-wide
- [ ] If system limit hit: all MCP requests get throttled, individual key limits don't matter

---

## 7. Audit Trail

### 7.1 MCP Request Logging

```sql
CREATE TABLE mcp_request_log (
  id BIGSERIAL PRIMARY KEY,
  -- Auth context
  user_id UUID NOT NULL REFERENCES users(id),
  auth_method VARCHAR(20) NOT NULL,            -- 'api_key' | 'oauth'
  api_key_id UUID REFERENCES api_keys(id),
  oauth_client_id UUID REFERENCES oauth_clients(id),
  -- Request
  tool_name VARCHAR(100),                      -- 'create_expense', 'run_profit_loss', etc.
  resource_uri VARCHAR(500),                   -- for resource reads
  company_id UUID REFERENCES tenants(id),
  parameters JSONB,                            -- tool parameters (sanitized — no sensitive values)
  -- Response
  status VARCHAR(20),                          -- 'success' | 'error' | 'rate_limited'
  error_code VARCHAR(50),
  response_summary TEXT,                       -- brief description of what was returned/done
  -- Metadata
  ip_address INET,
  user_agent TEXT,
  duration_ms INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_mrl_user ON mcp_request_log(user_id, created_at);
CREATE INDEX idx_mrl_key ON mcp_request_log(api_key_id, created_at);
CREATE INDEX idx_mrl_company ON mcp_request_log(company_id, created_at);
```

### 7.2 What Gets Logged

- [ ] Every tool call: tool name, parameters, company context, result status
- [ ] Every resource read: resource URI, company context
- [ ] Authentication failures: token prefix (not full token), IP address, failure reason
- [ ] Rate limit events: key ID, current count, limit

### 7.3 Parameter Sanitization

Before logging parameters to `mcp_request_log`:
- [ ] Redact any field named `password`, `secret`, `token`, `key`
- [ ] Truncate long text fields (memo, description) to 200 characters
- [ ] Keep financial amounts, dates, IDs, and entity references intact (needed for audit)

### 7.4 Integration with Existing Audit Trail

MCP write operations (create, update, void) also create entries in the existing `audit_log` table with `source = 'mcp'`. This means:
- [ ] Transaction created via MCP shows in the audit trail as "Created by [User Name] via MCP ([Key Name])"
- [ ] The audit trail viewer can filter by source: UI / MCP / API
- [ ] The activity is attributed to the user, not to the AI assistant

---

## 8. Admin Configuration

### 8.1 MCP System Settings

```sql
ALTER TABLE companies ADD COLUMN mcp_enabled BOOLEAN DEFAULT FALSE;
  -- per-company MCP toggle (company admin controls)

-- System-level MCP configuration
CREATE TABLE mcp_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  is_enabled BOOLEAN DEFAULT FALSE,            -- master switch
  max_keys_per_user INT DEFAULT 5,
  system_rate_limit_per_minute INT DEFAULT 500,
  allowed_scopes TEXT[] DEFAULT '{all,read,write,reports,banking,invoicing}',
  oauth_enabled BOOLEAN DEFAULT FALSE,
  require_key_expiration BOOLEAN DEFAULT FALSE, -- force all keys to have an expiry
  max_key_lifetime_days INT,                    -- NULL = unlimited
  configured_by UUID REFERENCES users(id),
  configured_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 8.2 Admin MCP Page

```
packages/web/src/features/admin/McpConfigPage.tsx
```

- [ ] **Master switch:** Enable/Disable MCP for the entire installation
- [ ] **Rate limits:** System-wide max requests per minute
- [ ] **Key policies:**
  - Max keys per user
  - Require expiration on all keys (toggle + max lifetime)
  - Available scopes (admin can disable certain scopes system-wide)
- [ ] **OAuth settings:**
  - Enable/Disable OAuth (separate from API keys)
  - OAuth client management: create, view, revoke clients
- [ ] **Usage overview:**
  - Total active API keys across all users
  - Requests in last 24h / 7d / 30d
  - Top users by request volume
  - Top tools by call frequency
- [ ] **MCP request log viewer:**
  - Filterable by user, key, company, tool, status, date range
  - Same format as audit trail viewer
- [ ] Add "MCP / API Access" to admin sidebar

### 8.3 Company-Level MCP Toggle

Each company can independently enable or disable MCP access:

- [ ] In company Settings: "Allow API & MCP access to [Company Name]" toggle
- [ ] Default: OFF (must be explicitly enabled)
- [ ] When disabled: all MCP calls targeting this company return `ACCESS_DENIED` regardless of user permissions or API key configuration
- [ ] This gives the company owner control even if the user's API key has broader access

---

## 9. User API Key Management

### 9.1 API Key Settings Page

```
packages/web/src/features/settings/ApiKeysPage.tsx
```

- [ ] **Key list table:**
  - Columns: Name, Key Prefix (kis_abc1...), Scopes, Companies, Created, Last Used, Expires, Status
  - Status: Active (green) / Expired (gray) / Revoked (red)

- [ ] **Create key flow:**
  - Step 1: Name the key ("Claude Desktop", "Automation Script")
  - Step 2: Select scopes (checkboxes, default "Full access")
  - Step 3: Select companies ("All my companies" or pick specific ones)
  - Step 4: Set expiration (optional date picker, or "Never expires")
  - Step 5: Key revealed — show ONCE with copy button and warning: "This key will not be shown again. Copy it now."
  - Download as `.env` snippet: `KISBOOKS_API_KEY=kis_abc123...`

- [ ] **Key actions:**
  - "Revoke" — immediately deactivate (with confirmation)
  - "Edit" — change name, scopes, companies, expiration (cannot see the key again)

- [ ] **Usage stats per key:**
  - Requests today / this week / this month
  - Last used: timestamp + IP
  - Most-called tools

- [ ] Add "API Keys" to user security settings (alongside 2FA and passkeys)

### 9.2 OAuth Consent Screen

```
packages/web/src/features/auth/OAuthConsentPage.tsx
```

- [ ] Shown when an OAuth client requests authorization
- [ ] Displays:
  - App name and logo (from `oauth_clients` record)
  - Requested scopes in plain language: "This app wants to: Read your financial data, Create transactions, Run reports"
  - Company selector: "Allow access to:" (checkboxes of user's companies)
- [ ] "Authorize" / "Deny" buttons
- [ ] "You can revoke access at any time from Settings → Connected Apps"

### 9.3 Connected Apps Page

```
packages/web/src/features/settings/ConnectedAppsPage.tsx
```

- [ ] List of OAuth apps the user has authorized
- [ ] Per app: name, scopes granted, companies authorized, authorized date
- [ ] "Revoke access" button per app

---

## 10. MCP Server Implementation

### 10.1 Server Setup

```
packages/api/src/mcp/
├── server.ts                    # MCP server initialization and transport
├── auth.ts                      # Token resolution middleware
├── context.ts                   # Company context resolution
├── rate-limiter.ts              # Per-key rate limiting
├── audit.ts                     # Request logging
├── tools/
│   ├── company.tools.ts         # list_companies, set_active_company, get_company_info
│   ├── accounts.tools.ts        # COA CRUD
│   ├── contacts.tools.ts        # Contact CRUD
│   ├── transactions.tools.ts    # Transaction CRUD + void
│   ├── invoices.tools.ts        # Invoice CRUD + send + payment
│   ├── bank-feed.tools.ts       # Bank feed categorize + match
│   ├── reports.tools.ts         # All report generators
│   ├── items.tools.ts           # Items CRUD
│   ├── tags.tools.ts            # Tags CRUD
│   ├── reconciliation.tools.ts  # Reconciliation status
│   └── search.tools.ts          # Global search
└── resources/
    └── resources.ts             # Resource definitions and handlers
```

### 10.2 Tool Implementation Pattern

Each tool follows the same pattern:

```typescript
{
  name: 'create_expense',
  description: 'Create an expense transaction (check or payment)',
  inputSchema: {
    type: 'object',
    properties: {
      company_id: { type: 'string', description: 'Company ID (optional if active company set)' },
      date: { type: 'string', format: 'date', description: 'Transaction date (YYYY-MM-DD)' },
      payee_id: { type: 'string', description: 'Contact ID of the payee' },
      bank_account_id: { type: 'string', description: 'Bank account to pay from' },
      lines: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            account_id: { type: 'string', description: 'Expense account' },
            amount: { type: 'number', description: 'Line amount' },
            description: { type: 'string', description: 'Line description' }
          },
          required: ['account_id', 'amount']
        }
      },
      memo: { type: 'string', description: 'Internal memo' },
      check_number: { type: 'integer', description: 'Check number (optional)' }
    },
    required: ['date', 'payee_id', 'bank_account_id', 'lines']
  },
  handler: async (params, auth) => {
    const companyId = resolveCompany(auth, params);
    checkScope(auth, 'write');
    
    // Call existing service — same code as UI
    const result = await transactionService.createExpense(companyId, {
      date: params.date,
      contact_id: params.payee_id,
      bank_account_id: params.bank_account_id,
      lines: params.lines,
      memo: params.memo,
      check_number: params.check_number
    });
    
    return { transaction_id: result.id, ref_number: result.ref_number, total: result.total };
  }
}
```

### 10.3 Error Responses

MCP errors follow a structured format:

| Error Code | Meaning |
|---|---|
| `AUTH_REQUIRED` | No or invalid Bearer token |
| `AUTH_EXPIRED` | Token or API key has expired |
| `ACCESS_DENIED` | User doesn't have access to this company or action |
| `COMPANY_REQUIRED` | No company context and user has multiple companies |
| `SCOPE_DENIED` | API key scope doesn't allow this action |
| `RATE_LIMITED` | Rate limit exceeded (includes `retry_after_seconds`) |
| `VALIDATION_ERROR` | Invalid parameters (includes field-level errors) |
| `NOT_FOUND` | Entity not found (in the user's accessible scope) |
| `CONFLICT` | Business rule violation (e.g., duplicate, balance mismatch) |
| `MCP_DISABLED` | MCP is disabled system-wide or for this company |

---

## 11. Build Checklist

### 11.1 Database
- [ ] Create migration: `api_keys` table
- [ ] Create migration: `oauth_clients` table
- [ ] Create migration: `oauth_tokens` table
- [ ] Create migration: `oauth_authorization_codes` table
- [ ] Create migration: `mcp_request_log` table
- [ ] Create migration: `mcp_config` table
- [ ] Create migration: add `mcp_enabled` to `companies`
- [ ] Create shared types: `packages/shared/src/types/mcp.ts`

### 11.2 API — Authentication
- [ ] Implement API key generation (cryptographic random + SHA-256 storage)
- [ ] Implement API key validation middleware
- [ ] Implement OAuth 2.0 authorization code flow:
  - `GET /oauth/authorize` — consent screen
  - `POST /oauth/token` — code exchange + refresh
  - `POST /oauth/revoke` — token revocation
- [ ] Implement token resolution middleware (API key or OAuth)
- [ ] Implement scope checking per tool call
- [ ] Implement company restriction from API key `allowed_companies`

### 11.3 API — MCP Server
- [ ] Install MCP SDK: `@modelcontextprotocol/sdk`
- [ ] Create MCP server with Streamable HTTP transport at `POST /mcp`
- [ ] Implement company context resolution (explicit → session → single-company → error)
- [ ] Implement rate limiting (Redis-backed, per-key + system-wide)
- [ ] Implement request audit logging
- [ ] Implement parameter sanitization for logs

### 11.4 API — MCP Tools
- [ ] Implement context tools: `list_companies`, `set_active_company`, `get_active_company`, `get_company_info`
- [ ] Implement COA tools: `list_accounts`, `get_account`, `create_account`, `update_account`, `get_account_balance`
- [ ] Implement contact tools: `list_contacts`, `get_contact`, `create_contact`, `update_contact`
- [ ] Implement transaction tools: `list_transactions`, `get_transaction`, `create_expense`, `create_deposit`, `create_invoice`, `create_cash_sale`, `create_journal_entry`, `create_transfer`, `update_transaction`, `void_transaction`
- [ ] Implement invoice tools: `list_invoices`, `get_invoice`, `send_invoice`, `record_payment`, `get_overdue_summary`
- [ ] Implement bank feed tools: `list_bank_feed_items`, `categorize_feed_item`, `match_feed_item`, `get_bank_connections`, `sync_bank_connection`
- [ ] Implement report tools: `run_profit_loss`, `run_balance_sheet`, `run_cash_flow`, `run_trial_balance`, `run_ar_aging`, `run_ap_aging`, `run_general_ledger`, `run_sales_by_customer`, `run_expense_by_vendor`, `run_budget_vs_actual`, `run_custom_report`
- [ ] Implement items tools: `list_items`, `get_item`, `create_item`, `update_item`
- [ ] Implement tags tools: `list_tags`, `create_tag`, `tag_transaction`
- [ ] Implement reconciliation tools: `get_reconciliation_status`, `list_unreconciled`
- [ ] Implement search tool: `search`

### 11.5 API — MCP Resources
- [ ] Implement resource handlers for all defined resource URIs
- [ ] Tenant-scope all resource queries

### 11.6 API — Tests
- [ ] Write Vitest tests:
  - [ ] API key creation: key generated, hash stored, prefix extractable
  - [ ] API key auth: valid key → user resolved → access granted
  - [ ] API key auth: revoked key → rejected
  - [ ] API key auth: expired key → rejected
  - [ ] API key scope: read-only key → write tool blocked
  - [ ] API key company restriction: key for Acme only → Baker tool call blocked
  - [ ] OAuth flow: authorize → code → exchange → access_token works
  - [ ] OAuth refresh: expired access_token → refresh → new access_token
  - [ ] OAuth revoke: token revoked → subsequent calls rejected
  - [ ] Company context: explicit company_id → uses that company
  - [ ] Company context: active company set → uses active
  - [ ] Company context: single company user → auto-resolved
  - [ ] Company context: multi-company user, no context → error with company list
  - [ ] Company access: user calls tool for company they don't belong to → ACCESS_DENIED
  - [ ] Company MCP disabled: tool call for that company → MCP_DISABLED
  - [ ] Rate limit: exceed per-minute → RATE_LIMITED with retry_after
  - [ ] Audit log: tool call creates mcp_request_log entry with correct fields
  - [ ] Audit trail integration: create_expense via MCP → audit_log entry with source = 'mcp'
  - [ ] Tool: list_companies returns only user's companies
  - [ ] Tool: list_transactions returns only specified company's transactions
  - [ ] Tool: create_expense creates correct journal lines
  - [ ] Tool: run_profit_loss returns correct report data
  - [ ] Tool: void_transaction creates reversing entry
  - [ ] Resource: company chart-of-accounts returns tenant-scoped data
  - [ ] Parameter sanitization: password fields redacted in log

### 11.7 Frontend — Admin
- [ ] Create `McpConfigPage.tsx` — master switch, rate limits, key policies, OAuth clients, usage stats, request log
- [ ] Implement OAuth client management (create, view, revoke)
- [ ] Implement request log viewer with filters
- [ ] Add "MCP / API Access" to admin sidebar

### 11.8 Frontend — User
- [ ] Create `ApiKeysPage.tsx` — key list, create wizard, revoke, usage stats
- [ ] Implement key creation wizard (name → scopes → companies → expiry → reveal key once)
- [ ] Create `OAuthConsentPage.tsx` — consent screen for OAuth authorization
- [ ] Create `ConnectedAppsPage.tsx` — list and revoke OAuth apps
- [ ] Add "API Keys" to user security settings
- [ ] Add company-level MCP toggle to company Settings page

### 11.9 Ship Gate
- [ ] **API key creation:** User creates key → key shown once → copy works → key stored as hash
- [ ] **API key auth:** Use key as Bearer token on MCP endpoint → tool call succeeds
- [ ] **API key revoke:** Revoke key → immediate → next call rejected
- [ ] **API key scope:** Read-only key → `create_expense` returns SCOPE_DENIED → `list_transactions` works
- [ ] **API key company restriction:** Key restricted to Acme → Baker tool call returns ACCESS_DENIED
- [ ] **OAuth flow:** Register client → authorize → get tokens → use access_token on MCP → works
- [ ] **OAuth consent:** User sees app name, scopes, company selector → approves → code issued
- [ ] **Company context:** User with 3 companies calls tool without company_id → error lists companies → user specifies → tool works
- [ ] **Company context:** User with 1 company → company auto-resolved, no need to specify
- [ ] **set_active_company:** Set active to Acme → subsequent tool calls default to Acme
- [ ] **Tenant isolation:** User calls `list_transactions` for company they don't manage → ACCESS_DENIED
- [ ] **Company MCP disabled:** Company toggles MCP off → all MCP calls for that company return MCP_DISABLED
- [ ] **Rate limiting:** Send 61 requests in 1 minute (limit 60) → 61st returns RATE_LIMITED with retry_after
- [ ] **Audit log:** Create expense via MCP → mcp_request_log entry with tool name and params + audit_log entry with source = 'mcp'
- [ ] **Report via MCP:** `run_profit_loss` returns correct P&L data for the specified company and date range
- [ ] **Create via MCP:** `create_expense` creates transaction with correct journal lines, visible in UI
- [ ] **Bank feed via MCP:** `list_bank_feed_items` returns pending items → `categorize_feed_item` categorizes → item posted to ledger
- [ ] **Admin:** System MCP disabled → all MCP calls return MCP_DISABLED regardless of key or user
- [ ] **Admin:** Request log shows all MCP calls with user, tool, company, status
- [ ] All Vitest tests passing
- [ ] QUESTIONS.md reviewed and resolved
