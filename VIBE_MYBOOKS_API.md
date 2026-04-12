# Vibe MyBooks API — Integration Reference

Developer guide for building external apps that talk to a running Vibe MyBooks
instance. Optimized for handing to another Claude Code project as context.

**Audience:** Anyone building a sync tool, dashboard, chatbot, mobile app, or
any other client that wants to read or write Vibe MyBooks data.

**Scope:** The stable `/api/v2` REST API plus the specific `/api/v1` endpoints
needed to authenticate and manage API keys. `/api/v1` has ~40 additional route
modules that mirror the admin UI — this reference focuses on the subset most
useful for integrations. When a feature isn't covered here, consult the live
Swagger UI at `<base>/api/docs` or the source in `packages/api/src/routes/`.

---

## Table of contents

1. [Quick start](#quick-start)
2. [Base URL and versioning](#base-url-and-versioning)
3. [Authentication](#authentication)
   - [Option A — API key (recommended for integrations)](#option-a--api-key-recommended-for-integrations)
   - [Option B — JWT with refresh rotation](#option-b--jwt-with-refresh-rotation)
   - [Option C — OAuth 2 for third-party apps](#option-c--oauth-2-for-third-party-apps)
4. [Request and response conventions](#request-and-response-conventions)
   - [Error format](#error-format)
   - [Pagination](#pagination)
   - [Rate limits](#rate-limits)
   - [Data types](#data-types)
5. [Tenants, companies, and scoping](#tenants-companies-and-scoping)
6. [Endpoint reference](#endpoint-reference)
   - [Context](#context)
   - [Chart of Accounts](#chart-of-accounts)
   - [Contacts](#contacts)
   - [Transactions](#transactions)
   - [Invoices](#invoices)
   - [Items / products](#items--products)
   - [Reports](#reports)
7. [TypeScript client scaffold](#typescript-client-scaffold)
8. [Common integration recipes](#common-integration-recipes)
9. [What's NOT in v2 yet](#whats-not-in-v2-yet)
10. [Troubleshooting](#troubleshooting)

---

## Quick start

```bash
# 1. Get an API key from the web UI: Settings → API Keys → Generate
#    Copy the `sk_live_...` value; it is shown exactly once.
export VIBE_API_KEY=sk_live_abcdef0123456789...
export VIBE_API_BASE=https://books.example.com

# 2. Smoke test — this should return your user + tenant + companies
curl -s "$VIBE_API_BASE/api/v2/me" \
  -H "X-API-Key: $VIBE_API_KEY"

# 3. List the chart of accounts
curl -s "$VIBE_API_BASE/api/v2/accounts" \
  -H "X-API-Key: $VIBE_API_KEY"

# 4. Create a simple expense
curl -s -X POST "$VIBE_API_BASE/api/v2/transactions" \
  -H "X-API-Key: $VIBE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "txnType": "expense",
    "txnDate": "2026-04-09",
    "payFromAccountId": "00000000-0000-0000-0000-000000000000",
    "lines": [
      { "expenseAccountId": "00000000-0000-0000-0000-000000000000", "amount": "42.50" }
    ],
    "memo": "Coffee for the team"
  }'
```

If the smoke test returns a user object, you're connected. If it returns
`401 Unauthorized`, the key is invalid, expired, or revoked.

---

## Base URL and versioning

**Self-hosted.** There is no central SaaS deployment — every Vibe MyBooks
install is self-hosted. The base URL depends on where the operator put it:

- Dev default: `http://localhost:3001`
- Production: whatever hostname the operator chose (e.g., `https://books.acme.com`)

**Two API versions:**

| Version | Prefix | Purpose | Stability |
|---|---|---|---|
| v1 | `/api/v1/*` | Powers the web UI. ~40 route modules, most with undocumented shapes. | Unstable — shapes change with the UI. |
| **v2** | `/api/v2/*` | **Stable integration API.** Documented shapes, API-key auth, per-user rate limit, dedicated JSON contract. | **Stable — use this for integrations.** |

Use **v2 for everything** unless the endpoint you need doesn't exist there
yet. If you find yourself reaching for v1, file a request to add it to v2 —
don't build against v1 long-term because the shapes can change whenever the
UI changes.

**Live Swagger UI:** every running instance serves interactive API docs at
`<base>/api/docs`. It's open in development and requires auth in production.

**Health check:** `GET /health` returns `{ status: 'ok', timestamp }` — no
auth, safe for uptime monitors.

---

## Authentication

Vibe MyBooks supports three auth methods. **Pick API keys** unless you have a
specific reason to do otherwise.

### Option A — API key (recommended for integrations)

Long-lived, user-scoped credentials generated from the web UI or via the
`/api/v1/api-keys` endpoint. Sent in the `X-API-Key` request header.

**Creating a key:**

Via the UI: **Settings → API Keys → New Key**. Enter a name (for your
records), pick a role, optionally set an expiration, click Generate. The key
is displayed **exactly once** — copy it immediately.

Via the API (if you have a JWT already — see Option B):

```http
POST /api/v1/api-keys
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "name": "My Sync Tool",
  "role": "accountant",
  "expiresAt": "2027-04-09T00:00:00Z"
}
```

Response:

```json
{
  "key": {
    "id": "uuid",
    "name": "My Sync Tool",
    "keyPrefix": "sk_live_abcd",
    "role": "accountant",
    "createdAt": "2026-04-09T...",
    "expiresAt": "2027-04-09T..."
  },
  "apiKey": "sk_live_abcdef0123456789..."
}
```

**The full `apiKey` value is only returned once** on creation. Store it in a
secret manager immediately. After this response the server only keeps the
SHA-256 hash; there is no way to recover the raw key.

**Using a key:** include it on every request in the `X-API-Key` header:

```http
GET /api/v2/accounts HTTP/1.1
Host: books.example.com
X-API-Key: sk_live_abcdef0123456789...
```

**Roles:**

| Role | Scope |
|---|---|
| `owner` | Full tenant access. Only issuable by an owner. |
| `accountant` | Read/write most financial data. Cannot modify tenant/user settings. |
| `readonly` | Read-only. Safe for dashboards and read-only sync tools. |

You cannot issue a key with a higher role than the user creating it. A
non-owner attempting to create an `owner` key gets a 403.

**Listing, revoking:**

```http
GET    /api/v1/api-keys              # List your keys (never returns the raw value)
PUT    /api/v1/api-keys/:id          # Update name, active flag
DELETE /api/v1/api-keys/:id          # Revoke (soft-delete)
```

**Gotchas:**
- Keys are tenant-scoped. A key issued while the user's active tenant was
  "Acme" can only access Acme data, even after the user switches to another
  tenant.
- You **cannot** send both `X-API-Key` and `Authorization: Bearer`. Pick one;
  the server rejects the request if both are present.
- Revoked keys fail immediately with 401 `Unauthorized`.
- The server records `lastUsedAt` on every successful auth — useful for
  auditing which keys are actually in use.

---

### Option B — JWT with refresh rotation

For apps that want to act on behalf of a logged-in user (e.g., a mobile
client, a desktop companion app). Short-lived access tokens (15 minutes) plus
long-lived refresh tokens (7 days) with rotation.

**Log in:**

```http
POST /api/v1/auth/login HTTP/1.1
Content-Type: application/json

{ "email": "user@example.com", "password": "..." }
```

Response (no 2FA):

```json
{
  "user": { "id": "uuid", "email": "...", "displayName": "...", "role": "owner" },
  "tokens": {
    "accessToken": "eyJhbG...",
    "refreshToken": "hex-encoded..."
  },
  "accessibleTenants": [
    { "id": "uuid", "name": "Acme Corp", "role": "owner" }
  ]
}
```

Response (2FA required):

```json
{
  "tfa_required": true,
  "tfa_token": "short-lived-jwt",
  "available_methods": ["totp", "email", "sms"],
  "preferred_method": "totp"
}
```

Follow up with `POST /api/v1/auth/tfa/verify` using the `tfa_token` as a
Bearer token plus the user's code. That returns the real `tokens`.

**Use the access token:**

```http
GET /api/v2/me HTTP/1.1
Authorization: Bearer eyJhbG...
```

**Refresh when the access token expires:**

```http
POST /api/v1/auth/refresh HTTP/1.1
Content-Type: application/json

{ "refreshToken": "hex-encoded..." }
```

Response:

```json
{ "accessToken": "...", "refreshToken": "..." }
```

**Important:** refresh is **rotating** — the old refresh token is invalidated
the instant `/refresh` succeeds. Store the new one atomically. If the server
returns 401 on a refresh call, assume the session is dead and prompt the
user to log in again.

**Log out:**

```http
POST /api/v1/auth/logout HTTP/1.1
Content-Type: application/json

{ "refreshToken": "..." }
```

This deletes the server-side session, invalidating both tokens.

**Gotchas:**
- The access token is a signed JWT — don't inspect or modify its payload
  client-side. Pass it as an opaque string.
- Presenting an expired access token returns 401 with message `"Invalid or
  expired token"`. Do not attempt auto-refresh on arbitrary 401s; only
  refresh when you're sure the cause is expiry (e.g., compare `exp` or just
  try once).
- Rate limit on auth endpoints: **10 requests per minute per IP**. Enough
  for humans, tight enough to block brute force.
- Losing a refresh token is unrecoverable without a new login. The only way
  to roll back is to log in from scratch.

---

### Option C — OAuth 2 for third-party apps

For apps that want to let END USERS grant access to their Vibe MyBooks data
without sharing credentials. Standard OAuth 2 Authorization Code flow.

**Setup:** Register an OAuth client via the admin UI under **Admin →
Connected Apps**. You get back a `client_id` + `client_secret`.

**Flow:**

1. Redirect the user to `/oauth/authorize?client_id=...&redirect_uri=...&scope=...&state=...`
2. User authenticates and consents on the Vibe MyBooks frontend.
3. Vibe MyBooks redirects back to your `redirect_uri` with `?code=...&state=...`.
4. Exchange the code for tokens:

```http
POST /oauth/token HTTP/1.1
Content-Type: application/json

{
  "grant_type": "authorization_code",
  "client_id": "...",
  "client_secret": "...",
  "code": "...",
  "redirect_uri": "..."
}
```

5. Refresh when the access token expires:

```http
POST /oauth/token HTTP/1.1
Content-Type: application/json

{
  "grant_type": "refresh_token",
  "client_id": "...",
  "client_secret": "...",
  "refresh_token": "..."
}
```

6. Revoke when the user disconnects:

```http
POST /oauth/revoke HTTP/1.1
Content-Type: application/json

{ "token": "..." }
```

This is a full OAuth flow, not a simplified one. Use a battle-tested client
library (e.g., `simple-oauth2`, `openid-client`) rather than rolling your
own.

---

## Request and response conventions

All v2 endpoints accept and return JSON. Dates are ISO 8601 strings. Money
amounts are serialized as **strings** (e.g., `"42.5000"`) to avoid floating
point rounding errors — parse with `Number.parseFloat` if you need numeric
arithmetic, but store and transport as strings.

### Error format

Every error response has the same envelope:

```json
{
  "error": {
    "message": "Human-readable explanation",
    "code": "OPTIONAL_MACHINE_READABLE_CODE",
    "details": [ ... ]
  }
}
```

**HTTP status codes used:**

| Code | Meaning |
|---|---|
| 200 | OK |
| 201 | Created (after a POST) |
| 400 | Bad request — validation failure, missing field, bad input shape. `code` may be `VALIDATION_ERROR` or a domain-specific code. |
| 401 | Unauthorized — no auth, invalid auth, or expired token |
| 403 | Forbidden — authenticated but the user / key doesn't have permission (role too low, trying to cross a tenant boundary, etc.) |
| 404 | Not found — the requested resource doesn't exist OR exists in another tenant (same response for both, on purpose) |
| 409 | Conflict — unique constraint, race condition |
| 429 | Rate limit exceeded |
| 500 | Internal server error |

**Validation errors** (from Zod) return a `details` array with the raw Zod
issue list so you can surface field-level messages:

```json
{
  "error": {
    "message": "lines: At least 1 line is required",
    "code": "VALIDATION_ERROR",
    "details": [
      {
        "code": "too_small",
        "minimum": 1,
        "path": ["lines"],
        "message": "Array must contain at least 1 element(s)"
      }
    ]
  }
}
```

### Pagination

List endpoints return `{ data: T[], total: number }`. Pagination is
**offset-based** via query parameters:

```http
GET /api/v2/transactions?limit=50&offset=100
```

- `limit` — max items per response. Default 50, max 500.
- `offset` — items to skip from the start of the result set.

For large exports, iterate with `offset = 0, 50, 100, ...` until the
returned `data.length < limit`. The total row count is in `total` on the
first page so you can size your progress bar.

### Rate limits

Two layers of rate limiting on `/api/v2`:

- **IP-based** (before auth): 60 req/min per source IP. Protects against
  credential brute force and anonymous abuse.
- **Per-user** (after auth): 100 req/min per authenticated user/key. Fair
  usage across users sharing a tenant.

Auth endpoints (`/api/v1/auth/*`) have a stricter limit of **10 req/min
per IP** to discourage credential stuffing.

Hitting a limit returns **429** with:

```json
{ "error": { "message": "Rate limit exceeded. Max 100 requests per minute.", "code": "RATE_LIMIT" } }
```

Wait at least 60 seconds and retry with backoff. The API does not currently
return `Retry-After` or `X-RateLimit-*` headers, so base your backoff on
the response time and a conservative assumption.

### Data types

- **IDs** are UUIDs (`"00000000-0000-0000-0000-000000000000"`).
- **Dates** are ISO 8601. Dates without time (e.g., `txnDate`) are
  `"YYYY-MM-DD"`; timestamps are `"YYYY-MM-DDTHH:mm:ss.sssZ"`.
- **Money** is `decimal(19, 4)` in the database, serialized as a string
  with 4 decimal places (e.g., `"42.5000"`). Never assume float precision.
- **Booleans** are JSON `true` / `false`.

---

## Tenants, companies, and scoping

Vibe MyBooks has a two-level organizational model:

- A **tenant** is an accounting silo. All data (accounts, transactions,
  contacts, reports) is isolated by `tenant_id`. Two tenants cannot see each
  other's data under any circumstances.
- A **company** lives inside a tenant. A tenant can have one or many
  companies. Companies within the same tenant share a chart of accounts
  (that's a deliberate design decision — see CLAUDE.md).
- A **user** belongs to one or more tenants via the `user_tenant_access`
  junction. Their "home" tenant is the default; they can switch.

**For API-key auth:** the key is tied to the tenant that was active when the
key was generated. All your requests will automatically be scoped to that
tenant — you can't cross tenant boundaries with a single key.

**For JWT auth:** the JWT's `tenantId` claim is set at login time. Call
`POST /api/v2/tenants/switch` with `{ tenantId }` to get a new token pair
scoped to a different tenant (only works if the user has access to that
tenant).

**Active company:** on v2, the active company defaults to the first company
in the tenant. Override per-request with the `X-Company-Id` header:

```http
GET /api/v2/accounts HTTP/1.1
Authorization: Bearer ...
X-Company-Id: 00000000-0000-0000-0000-000000000000
```

For CPA firms managing multiple clients, you typically:
1. Log in or use a key
2. Call `GET /api/v2/me` to discover available companies
3. Set `X-Company-Id` on every subsequent request to pin the context

---

## Endpoint reference

All endpoints below live under `/api/v2` unless noted otherwise. Every
request requires `X-API-Key` (or `Authorization: Bearer`).

### Context

#### `GET /me`

Current user, active tenant, active company, and all accessible
tenants/companies. Use this as a smoke test on startup.

**Response:**

```json
{
  "user": {
    "id": "uuid",
    "email": "alice@acme.com",
    "displayName": "Alice",
    "role": "owner"
  },
  "activeTenantId": "uuid",
  "activeCompanyId": "uuid",
  "companies": [
    { "id": "uuid", "businessName": "Acme Corp" },
    { "id": "uuid", "businessName": "Acme Subsidiary" }
  ],
  "tenants": [
    { "id": "uuid", "name": "Acme", "role": "owner" }
  ]
}
```

#### `GET /tenants`

List the tenants the current user can access.

```json
{
  "tenants": [
    { "id": "uuid", "name": "Acme", "role": "owner" },
    { "id": "uuid", "name": "Baker", "role": "accountant" }
  ]
}
```

#### `POST /tenants/switch`

Switch the active tenant. **Only works with JWT auth** — API keys are
tenant-bound.

```http
POST /api/v2/tenants/switch
{ "tenantId": "uuid" }
```

Returns new tokens scoped to the target tenant:

```json
{ "tokens": { "accessToken": "...", "refreshToken": "..." } }
```

---

### Chart of Accounts

#### `GET /accounts`

List every account in the chart of accounts for the active tenant, ordered by
account number.

**Response:**

```json
{
  "data": [
    {
      "id": "uuid",
      "tenantId": "uuid",
      "companyId": "uuid" | null,
      "accountNumber": "1000",
      "name": "Cash",
      "accountType": "asset",
      "detailType": "bank",
      "balance": "15000.0000",
      "isActive": true,
      "isSystem": false,
      "systemTag": null,
      "createdAt": "2026-01-01T00:00:00.000Z",
      "updatedAt": "..."
    }
  ],
  "total": 47
}
```

**Account types** (fixed enum): `asset` | `liability` | `equity` | `revenue` | `expense`

**System accounts** are created during tenant setup and have `isSystem: true`.
They cannot be deleted or re-typed — they include things like Accounts
Receivable, Accounts Payable, Payments Clearing, Opening Balances, Retained
Earnings. Check `systemTag` to identify them programmatically (e.g.,
`accounts_receivable`, `accounts_payable`, `payments_clearing`).

#### `GET /accounts/:id`

Single account detail. 404 if the account doesn't exist or belongs to
another tenant.

#### `POST /accounts`

Create a new account.

```json
{
  "name": "Consulting Revenue",
  "accountNumber": "4100",
  "accountType": "revenue",
  "detailType": "service",
  "description": "Consulting income"
}
```

- `name` and `accountType` are required.
- `accountNumber` must be unique within the tenant.
- `detailType` is a free-form string (see `detailType` values in Vibe
  MyBooks's COA templates — typical values are listed per account type in
  the web UI's account editor).

---

### Contacts

Contacts are customers, vendors, or both. Used as `contactId` on
transactions.

#### `GET /contacts`

```json
{
  "data": [
    {
      "id": "uuid",
      "displayName": "Acme Supply",
      "contactType": "vendor",
      "email": "ap@acmesupply.com",
      "phone": "555-1234",
      "billingLine1": "123 Main St",
      "billingCity": "Springfield",
      "billingState": "IL",
      "billingZip": "62701",
      "isActive": true
    }
  ],
  "total": 132
}
```

**Contact types:** `customer` | `vendor` | `both`

#### `GET /contacts/:id`

Single contact.

#### `POST /contacts`

```json
{
  "displayName": "New Vendor LLC",
  "contactType": "vendor",
  "email": "billing@newvendor.com",
  "phone": "555-0000",
  "billingLine1": "456 Oak St",
  "billingCity": "Springfield",
  "billingState": "IL",
  "billingZip": "62701"
}
```

Only `displayName` is required; everything else is optional.

---

### Transactions

The ledger. Every financial event in Vibe MyBooks is a transaction with a
double-entry journal (`lines` with `debit` and `credit` sums equal).

#### `GET /transactions`

Filtered, paginated list. Query parameters:

| Param | Type | Description |
|---|---|---|
| `txnType` | enum | Filter by type. One of: `invoice`, `customer_payment`, `cash_sale`, `expense`, `deposit`, `transfer`, `journal_entry`, `credit_memo`, `customer_refund`, `bill`, `bill_payment`, `vendor_credit` |
| `status` | enum | `draft`, `posted`, or `void` |
| `contactId` | uuid | Only transactions referencing this contact |
| `accountId` | uuid | Only transactions that touch this account (any line) |
| `tagId` | uuid | Only transactions with this tag |
| `startDate` | date | `txnDate >= startDate` (inclusive) |
| `endDate` | date | `txnDate <= endDate` (inclusive) |
| `search` | string | Full-text over `memo` and `txnNumber` |
| `limit` | int | 1–500, default 50 |
| `offset` | int | default 0 |

**Response:**

```json
{
  "data": [
    {
      "id": "uuid",
      "tenantId": "uuid",
      "txnType": "expense",
      "txnNumber": null,
      "txnDate": "2026-04-09",
      "status": "posted",
      "contactId": "uuid" | null,
      "memo": "Coffee for team",
      "total": "42.5000",
      "amountPaid": "0",
      "balanceDue": "42.5000",
      "createdAt": "..."
    }
  ],
  "total": 1247
}
```

Note: the list endpoint returns summary fields only. Call `GET /transactions/:id`
to get the journal lines.

#### `GET /transactions/:id`

Full transaction with journal lines.

```json
{
  "transaction": {
    "id": "uuid",
    "txnType": "expense",
    "txnDate": "2026-04-09",
    "status": "posted",
    "total": "42.5000",
    "memo": "Coffee for team",
    "contactId": "uuid" | null,
    "lines": [
      {
        "id": "uuid",
        "accountId": "uuid",
        "debit": "42.5000",
        "credit": "0.0000",
        "description": "Coffee",
        "lineOrder": 0
      },
      {
        "id": "uuid",
        "accountId": "uuid",
        "debit": "0.0000",
        "credit": "42.5000",
        "description": null,
        "lineOrder": 1
      }
    ]
  }
}
```

#### `POST /transactions`

Create a new transaction. The request body shape varies by `txnType`.

**Common envelope:**

```json
{ "txnType": "expense" | "deposit" | "transfer" | "journal_entry" | "cash_sale", ... }
```

**`expense`:** single-step payment to a vendor (debit card, ACH, cash).

```json
{
  "txnType": "expense",
  "txnDate": "2026-04-09",
  "contactId": "uuid (optional)",
  "payFromAccountId": "uuid — must be an asset account (bank / credit card)",
  "lines": [
    {
      "expenseAccountId": "uuid — the expense GL account",
      "amount": "42.50",
      "description": "optional line memo"
    }
  ],
  "memo": "optional transaction memo",
  "tags": ["uuid", ...]
}
```

Posts: DR each expense line, CR the pay-from account.

**`deposit`:** money coming INTO a bank account from a non-revenue source
(owner contribution, loan proceeds, transfer from Payments Clearing).

```json
{
  "txnType": "deposit",
  "txnDate": "2026-04-09",
  "depositToAccountId": "uuid — bank account",
  "lines": [
    {
      "accountId": "uuid — the source account (equity, liability, or Payments Clearing)",
      "amount": "5000.00",
      "description": "owner capital contribution"
    }
  ],
  "memo": "..."
}
```

Posts: DR bank, CR each source line.

**`transfer`:** move money between two asset accounts (checking → savings,
bank → credit card payment, etc.).

```json
{
  "txnType": "transfer",
  "txnDate": "2026-04-09",
  "fromAccountId": "uuid",
  "toAccountId": "uuid",
  "amount": "1000.00",
  "memo": "..."
}
```

Posts: DR toAccount, CR fromAccount.

**`journal_entry`:** raw double-entry for adjustments, accruals, opening
balances, or anything else that doesn't fit another transaction type. You
must supply the debit and credit sides yourself and they must balance
(sum of debits = sum of credits).

```json
{
  "txnType": "journal_entry",
  "txnDate": "2026-04-09",
  "memo": "monthly depreciation",
  "lines": [
    { "accountId": "uuid", "debit": "500.00", "credit": "0" },
    { "accountId": "uuid", "debit": "0", "credit": "500.00" }
  ]
}
```

`lines` must have at least 2 entries. The backend validates balance and
rejects with 400 if they don't match.

**`cash_sale`:** point-of-sale sale with immediate payment. Posts revenue +
deposit in one step.

```json
{
  "txnType": "cash_sale",
  "txnDate": "2026-04-09",
  "contactId": "uuid (optional — customer)",
  "depositToAccountId": "uuid — where the money goes",
  "lines": [
    {
      "accountId": "uuid — revenue account",
      "description": "T-shirt",
      "quantity": "2",
      "unitPrice": "15.00",
      "isTaxable": true,
      "taxRate": "0.0825"
    }
  ],
  "memo": "..."
}
```

**Invoices and bills are NOT created via `POST /transactions`.** Invoices go
through `POST /invoices` (see below). Bills currently do not have a v2
endpoint — use `POST /api/v1/bills` if you need them.

**Response (all transaction types):**

```json
{ "transaction": { "id": "uuid", ... full transaction with lines ... } }
```

**Voiding a transaction** is not in v2 yet. Use `POST /api/v1/transactions/:id/void`
with `{ "reason": "..." }`. Voiding creates a reversing journal entry; the
original is marked `status: "void"` but never deleted (audit trail preserved).

---

### Invoices

Customer invoices. Separate from `POST /transactions` because they have
invoice-specific fields (due date, payment terms, invoice number, amount
paid tracking) and trigger an AR posting.

#### `GET /invoices`

Paginated list — same filters as `/transactions` but pre-filtered to
`txnType: 'invoice'`.

#### `GET /invoices/:id`

Full invoice with lines.

```json
{
  "invoice": {
    "id": "uuid",
    "txnNumber": "INV-00042",
    "txnDate": "2026-04-09",
    "dueDate": "2026-05-09",
    "contactId": "uuid",
    "paymentTerms": "net_30",
    "total": "1500.0000",
    "amountPaid": "0",
    "balanceDue": "1500.0000",
    "invoiceStatus": "sent",
    "memo": "...",
    "lines": [...]
  }
}
```

**Invoice statuses:** `draft` | `sent` | `partial` | `paid` | `overdue` | `void`

#### `POST /invoices`

```json
{
  "txnDate": "2026-04-09",
  "dueDate": "2026-05-09",
  "contactId": "uuid",
  "paymentTerms": "net_30",
  "lines": [
    {
      "accountId": "uuid — revenue account",
      "description": "Consulting — April",
      "quantity": "10",
      "unitPrice": "150.00",
      "isTaxable": false,
      "taxRate": "0"
    }
  ],
  "memo": "optional public memo (shown on the invoice)",
  "internalNotes": "optional private notes"
}
```

- `paymentTerms` is one of `due_on_receipt`, `net_10`, `net_15`, `net_30`,
  `net_45`, `net_60`, `net_90`, `custom`.
- `dueDate` is auto-computed from `txnDate + paymentTerms` if omitted.
- `lines[].quantity` × `unitPrice` = line subtotal. Tax is added per-line
  based on `isTaxable` + `taxRate`.
- The invoice number is auto-assigned from the company's `invoiceNextNumber`
  counter atomically — no race conditions.
- Posts: DR Accounts Receivable (total), CR each revenue line, CR sales tax
  payable if any.

#### `PUT /invoices/:id`

Update an invoice. Same body shape as create. Server enforces:
- Cannot edit a void invoice
- Paid / partial invoices have locked fields (total, customer, date) — you
  can only reallocate lines within the original total
- Draft invoices can be edited freely

---

### Items / products

Optional product/service catalog. Used as a dropdown source for invoice
line items so you don't re-type "Consulting" every time.

#### `GET /items`

```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Consulting",
      "description": "Hourly consulting",
      "unitPrice": "150.0000",
      "incomeAccountId": "uuid",
      "isTaxable": false,
      "isActive": true
    }
  ],
  "total": 12
}
```

#### `POST /items`

```json
{
  "name": "T-Shirt",
  "description": "Cotton tee",
  "unitPrice": "19.99",
  "incomeAccountId": "uuid",
  "isTaxable": true
}
```

`name` and `incomeAccountId` are required.

---

### Reports

All reports return JSON structured for easy consumption. Date parameters are
`YYYY-MM-DD`.

#### `GET /reports/profit-loss`

Query: `?start_date=2026-01-01&end_date=2026-04-09&basis=accrual`

- `basis`: `accrual` (default) or `cash`
- Defaults to year-to-date if no dates given

Response structure (abridged):

```json
{
  "startDate": "2026-01-01",
  "endDate": "2026-04-09",
  "revenue": {
    "accounts": [
      { "accountId": "uuid", "accountNumber": "4000", "name": "Service Revenue", "total": "125000.0000" }
    ],
    "total": "125000.0000"
  },
  "costOfGoodsSold": { "accounts": [], "total": "0" },
  "grossProfit": "125000.0000",
  "expenses": {
    "accounts": [
      { "accountId": "uuid", "accountNumber": "6000", "name": "Office Supplies", "total": "2350.5000" }
    ],
    "total": "47000.0000"
  },
  "netIncome": "78000.0000"
}
```

#### `GET /reports/balance-sheet`

Query: `?as_of_date=2026-04-09&basis=accrual`

Returns `assets`, `liabilities`, `equity` groups each with a list of accounts
and a total. Equity includes computed `netIncomeForPeriod` and
`retainedEarnings`.

#### `GET /reports/trial-balance`

Query: `?start_date=2026-01-01&end_date=2026-04-09`

Flat list of every account with its debit/credit total for the period.
Useful for sanity-checking that the ledger balances.

#### `GET /reports/cash-flow`

Query: `?start_date=2026-01-01&end_date=2026-04-09`

Cash flow statement broken down into operating / investing / financing
activities.

#### `GET /reports/general-ledger`

Query: `?start_date=2026-01-01&end_date=2026-04-09`

Every journal line for every account in the period. Can be large —
consider pagination or date-range batching for multi-year exports.

---

## TypeScript client scaffold

Drop this into your project as `vibe-mybooks-client.ts`. It gives you a
typed, auth-aware wrapper with error handling and typed responses.

```typescript
// vibe-mybooks-client.ts
export interface VibeClientOptions {
  baseUrl: string;        // e.g. 'https://books.example.com'
  apiKey: string;         // sk_live_...
  companyId?: string;     // optional — pins X-Company-Id on every request
  timeoutMs?: number;     // default 30000
}

export class VibeApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string | undefined,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'VibeApiError';
  }
}

export class VibeClient {
  constructor(private readonly opts: VibeClientOptions) {}

  private async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
    path: string,
    body?: unknown,
    query?: Record<string, string | number | undefined>,
  ): Promise<T> {
    const url = new URL(`/api/v2${path}`, this.opts.baseUrl);
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v !== undefined) url.searchParams.set(k, String(v));
      }
    }

    const headers: Record<string, string> = {
      'X-API-Key': this.opts.apiKey,
      'Content-Type': 'application/json',
    };
    if (this.opts.companyId) headers['X-Company-Id'] = this.opts.companyId;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.opts.timeoutMs ?? 30_000);

    try {
      const res = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      const text = await res.text();
      const json = text ? JSON.parse(text) : null;

      if (!res.ok) {
        throw new VibeApiError(
          res.status,
          json?.error?.code,
          json?.error?.message || `HTTP ${res.status}`,
          json?.error?.details,
        );
      }

      return json as T;
    } finally {
      clearTimeout(timeout);
    }
  }

  // ─── Context ──────────────────────────────────────────

  getMe() {
    return this.request<{
      user: { id: string; email: string; displayName: string; role: string };
      activeTenantId: string;
      activeCompanyId: string;
      companies: Array<{ id: string; businessName: string }>;
      tenants: Array<{ id: string; name: string; role: string }>;
    }>('GET', '/me');
  }

  // ─── Accounts ─────────────────────────────────────────

  listAccounts() {
    return this.request<{ data: Account[]; total: number }>('GET', '/accounts');
  }

  getAccount(id: string) {
    return this.request<{ account: Account }>('GET', `/accounts/${id}`);
  }

  createAccount(input: {
    name: string;
    accountType: AccountType;
    accountNumber?: string;
    detailType?: string;
    description?: string;
  }) {
    return this.request<{ account: Account }>('POST', '/accounts', input);
  }

  // ─── Contacts ─────────────────────────────────────────

  listContacts() {
    return this.request<{ data: Contact[]; total: number }>('GET', '/contacts');
  }

  getContact(id: string) {
    return this.request<{ contact: Contact }>('GET', `/contacts/${id}`);
  }

  createContact(input: {
    displayName: string;
    contactType?: 'customer' | 'vendor' | 'both';
    email?: string;
    phone?: string;
    billingLine1?: string;
    billingCity?: string;
    billingState?: string;
    billingZip?: string;
  }) {
    return this.request<{ contact: Contact }>('POST', '/contacts', input);
  }

  // ─── Transactions ─────────────────────────────────────

  listTransactions(filters: {
    txnType?: string;
    status?: string;
    contactId?: string;
    accountId?: string;
    tagId?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
    limit?: number;
    offset?: number;
  } = {}) {
    return this.request<{ data: TransactionSummary[]; total: number }>(
      'GET', '/transactions', undefined, filters,
    );
  }

  getTransaction(id: string) {
    return this.request<{ transaction: Transaction }>('GET', `/transactions/${id}`);
  }

  createExpense(input: {
    txnDate: string;
    payFromAccountId: string;
    lines: Array<{ expenseAccountId: string; amount: string; description?: string }>;
    contactId?: string;
    memo?: string;
    tags?: string[];
  }) {
    return this.request<{ transaction: Transaction }>(
      'POST', '/transactions', { txnType: 'expense', ...input },
    );
  }

  createJournalEntry(input: {
    txnDate: string;
    memo?: string;
    lines: Array<{ accountId: string; debit: string; credit: string; description?: string }>;
  }) {
    return this.request<{ transaction: Transaction }>(
      'POST', '/transactions', { txnType: 'journal_entry', ...input },
    );
  }

  // ─── Invoices ─────────────────────────────────────────

  listInvoices(filters: { startDate?: string; endDate?: string; limit?: number; offset?: number } = {}) {
    return this.request<{ data: TransactionSummary[]; total: number }>(
      'GET', '/invoices', undefined, filters,
    );
  }

  getInvoice(id: string) {
    return this.request<{ invoice: Transaction }>('GET', `/invoices/${id}`);
  }

  createInvoice(input: {
    txnDate: string;
    dueDate?: string;
    contactId: string;
    paymentTerms?: string;
    lines: Array<{
      accountId: string;
      description?: string;
      quantity: string;
      unitPrice: string;
      isTaxable?: boolean;
      taxRate?: string;
    }>;
    memo?: string;
    internalNotes?: string;
  }) {
    return this.request<{ invoice: Transaction }>('POST', '/invoices', input);
  }

  // ─── Reports ──────────────────────────────────────────

  getProfitLoss(params: { startDate?: string; endDate?: string; basis?: 'accrual' | 'cash' } = {}) {
    return this.request<any>('GET', '/reports/profit-loss', undefined, {
      start_date: params.startDate,
      end_date: params.endDate,
      basis: params.basis,
    });
  }

  getBalanceSheet(params: { asOfDate?: string; basis?: 'accrual' | 'cash' } = {}) {
    return this.request<any>('GET', '/reports/balance-sheet', undefined, {
      as_of_date: params.asOfDate,
      basis: params.basis,
    });
  }

  getTrialBalance(params: { startDate?: string; endDate?: string } = {}) {
    return this.request<any>('GET', '/reports/trial-balance', undefined, {
      start_date: params.startDate,
      end_date: params.endDate,
    });
  }
}

// ─── Types ─────────────────────────────────────────────

export type AccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';

export interface Account {
  id: string;
  tenantId: string;
  companyId: string | null;
  accountNumber: string | null;
  name: string;
  accountType: AccountType;
  detailType: string | null;
  balance: string;
  isActive: boolean;
  isSystem: boolean;
  systemTag: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Contact {
  id: string;
  tenantId: string;
  displayName: string;
  contactType: 'customer' | 'vendor' | 'both';
  email: string | null;
  phone: string | null;
  isActive: boolean;
  billingLine1?: string | null;
  billingCity?: string | null;
  billingState?: string | null;
  billingZip?: string | null;
}

export interface JournalLine {
  id: string;
  accountId: string;
  debit: string;
  credit: string;
  description: string | null;
  lineOrder: number;
}

export interface Transaction {
  id: string;
  tenantId: string;
  txnType: string;
  txnNumber: string | null;
  txnDate: string;
  status: 'draft' | 'posted' | 'void';
  contactId: string | null;
  memo: string | null;
  total: string;
  amountPaid: string;
  balanceDue: string;
  lines: JournalLine[];
  createdAt: string;
}

export interface TransactionSummary {
  id: string;
  txnType: string;
  txnNumber: string | null;
  txnDate: string;
  status: string;
  contactId: string | null;
  memo: string | null;
  total: string;
  amountPaid: string;
  balanceDue: string;
  createdAt: string;
}
```

**Usage:**

```typescript
import { VibeClient, VibeApiError } from './vibe-mybooks-client.js';

const client = new VibeClient({
  baseUrl: process.env.VIBE_API_BASE!,
  apiKey: process.env.VIBE_API_KEY!,
});

try {
  const me = await client.getMe();
  console.log(`Connected as ${me.user.email} on tenant ${me.activeTenantId}`);

  const { data: accounts } = await client.listAccounts();
  const bank = accounts.find((a) => a.systemTag === 'cash_on_hand');
  if (!bank) throw new Error('No bank account found');

  const expenseAccount = accounts.find((a) => a.accountType === 'expense' && a.name.includes('Office'));
  if (!expenseAccount) throw new Error('No office expense account');

  const { transaction } = await client.createExpense({
    txnDate: '2026-04-09',
    payFromAccountId: bank.id,
    lines: [{ expenseAccountId: expenseAccount.id, amount: '42.50', description: 'Coffee' }],
    memo: 'Team coffee',
  });
  console.log(`Created expense ${transaction.id}`);
} catch (err) {
  if (err instanceof VibeApiError) {
    console.error(`API error ${err.status}: ${err.message} (${err.code})`);
  } else {
    throw err;
  }
}
```

---

## Common integration recipes

### Daily sync of new transactions into another system

```typescript
const lastSync = getLastSyncDate(); // e.g., '2026-04-08'
const today = new Date().toISOString().split('T')[0];

let offset = 0;
const batchSize = 200;

while (true) {
  const { data, total } = await client.listTransactions({
    startDate: lastSync,
    endDate: today,
    status: 'posted',
    limit: batchSize,
    offset,
  });
  if (data.length === 0) break;

  for (const summary of data) {
    const { transaction } = await client.getTransaction(summary.id);
    await upsertIntoDownstream(transaction);
  }

  offset += data.length;
  if (offset >= total) break;
}

saveLastSyncDate(today);
```

### Monthly P&L export to Google Sheets

```typescript
const start = '2026-03-01';
const end = '2026-03-31';
const pl = await client.getProfitLoss({ startDate: start, endDate: end, basis: 'accrual' });

const rows = [
  ['Profit & Loss', `${start} to ${end}`],
  [],
  ['REVENUE'],
  ...pl.revenue.accounts.map((a: any) => [a.name, a.total]),
  ['Total Revenue', pl.revenue.total],
  [],
  ['EXPENSES'],
  ...pl.expenses.accounts.map((a: any) => [a.name, a.total]),
  ['Total Expenses', pl.expenses.total],
  [],
  ['NET INCOME', pl.netIncome],
];

await appendToGoogleSheet(sheetId, rows);
```

### Write a new expense from a Slack bot

```typescript
// In your Slack slash-command handler
const match = text.match(/(\$?[\d.]+)\s+for\s+(.+?)\s+from\s+(.+)/);
if (!match) return 'Usage: /expense $42.50 for Office Supplies from checking';

const [, amount, categoryName, fromName] = match;
const cleanAmount = amount.replace('$', '');

const { data: accounts } = await client.listAccounts();
const category = accounts.find((a) => a.name.toLowerCase() === categoryName.toLowerCase());
const from = accounts.find((a) => a.name.toLowerCase().includes(fromName.toLowerCase()));

if (!category || !from) return `Could not resolve accounts. Category: ${!!category}, From: ${!!from}`;

const { transaction } = await client.createExpense({
  txnDate: new Date().toISOString().split('T')[0],
  payFromAccountId: from.id,
  lines: [{ expenseAccountId: category.id, amount: cleanAmount }],
  memo: `Via Slack from ${slackUserName}`,
});

return `Posted expense ${transaction.id} — $${cleanAmount} to ${category.name}`;
```

### Nightly balance snapshot

```typescript
const { data: accounts } = await client.listAccounts();
const timestamp = new Date().toISOString();

for (const account of accounts) {
  await db.balanceSnapshots.insert({
    timestamp,
    accountId: account.id,
    accountName: account.name,
    accountType: account.accountType,
    balance: account.balance,
  });
}
```

---

## What's NOT in v2 yet

These areas are only available on `/api/v1` for now. Shapes may change
without notice — use with care and be ready to update:

- **Bills (AP)** — `POST /api/v1/bills`, `PUT /api/v1/bills/:id`, etc.
- **Bill payments** — `POST /api/v1/bill-payments`
- **Vendor credits** — `/api/v1/vendor-credits`
- **Customer payments** — `POST /api/v1/payments`
- **Bank reconciliation** — `/api/v1/banking/reconcile*`
- **Bank feed categorization** — `/api/v1/banking/feed*`
- **Checks (print queue)** — `/api/v1/checks/*`
- **Recurring transactions** — `/api/v1/recurring`
- **Tags** — `/api/v1/tags`
- **Attachments / file uploads** — `/api/v1/attachments` (multipart/form-data, not JSON)
- **Voiding transactions** — `POST /api/v1/transactions/:id/void`
- **Admin endpoints** — `/api/v1/admin/*` (super admin only)
- **AI features (chat, OCR, categorization)** — `/api/v1/ai/*` and `/api/v1/chat/*`

For any of these, inspect the route file under `packages/api/src/routes/`
or hit the live Swagger UI at `<base>/api/docs`.

---

## Troubleshooting

### 401 Unauthorized on every request
- Check the header name: **`X-API-Key`** (not `X-Api-Key`, not `ApiKey`).
  Most HTTP clients normalize header case but some don't.
- Verify the key wasn't revoked: log into the web UI, go to Settings → API
  Keys, check the Active column.
- If using JWT: the access token has probably expired (15-minute lifetime).
  Call `/api/v1/auth/refresh`.
- You cannot send both `X-API-Key` AND `Authorization: Bearer` on the same
  request. The server rejects the combination.

### 403 Forbidden on a write operation
- Your key's role doesn't permit the action. `readonly` keys can't write;
  `accountant` keys can't modify tenant settings. Upgrade the key or create
  a new one with a higher role.
- You're trying to access data in a different tenant than the key was
  issued against. API keys are tenant-bound; create a new key while that
  tenant is active.

### 404 on a resource that exists
- It probably exists in a **different tenant**. The API returns 404 (not
  403) for cross-tenant access attempts to avoid leaking the existence of
  resources in other tenants.
- Double-check the UUID — the routes are strict about UUID format.

### 400 with `VALIDATION_ERROR`
- Inspect `error.details` for the full Zod issue list. `error.message` is
  only the first field-level problem.
- Common causes: amounts sent as numbers instead of strings, dates in the
  wrong format (`MM/DD/YYYY` instead of `YYYY-MM-DD`), missing required
  fields on the chosen `txnType` (e.g., `payFromAccountId` for expenses).

### 429 Rate limit exceeded
- v2 limits are 100 req/min per authenticated user. Backoff at least 60s
  and retry.
- For bulk operations, batch with a sleep between batches rather than
  firing requests as fast as possible.

### "Transaction does not balance" on journal entry
- Sum of `debit` values across `lines` must exactly equal sum of `credit`
  values. Watch for trailing zeros — `"10.00"` and `"10"` parse to the same
  number, but if you're adding `"10.005"` and expecting `"10.01"`, you
  need to round to 4 decimal places yourself (the DB stores
  `decimal(19, 4)`).

### The integration stopped working after the user switched tenants in the UI
- If using JWT: the JWT claims were minted for the OLD tenant. Call
  `POST /api/v2/tenants/switch` with the new tenant ID to get fresh tokens.
- If using an API key: the key is **tenant-bound** and always targets the
  tenant it was created against, regardless of what the user has active in
  the web UI. This is usually what you want — the integration keeps
  working even if the user switches UI context.

### Timezone mismatches on report dates
- The API stores all timestamps as UTC. `txnDate` is a date-only field
  (`YYYY-MM-DD`) interpreted in the server's configured timezone (UTC by
  default). If you see an off-by-one-day error on report boundaries,
  normalize your date range to the server's timezone.

### I need an endpoint that isn't here
- Check the live Swagger UI at `<base>/api/docs` — some endpoints are
  documented there but not in this file.
- For anything under `/api/v1`, read the corresponding file in
  `packages/api/src/routes/` for the exact request shape. Treat these as
  unstable — they may change when the UI changes.
- File a request with the project maintainer to add the endpoint to v2.

---

## Changelog

- **2026-04-09** — Initial version. Covers `/api/v2` and the auth endpoints
  in `/api/v1/auth` + `/api/v1/api-keys`. Documents API key / JWT / OAuth
  auth, error envelope, pagination, rate limits, tenant scoping, and a
  TypeScript client scaffold.
