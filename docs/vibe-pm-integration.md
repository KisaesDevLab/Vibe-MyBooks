# Vibe Practice Management ⇄ Vibe MyBooks — client portal integration

**Audience:** the Vibe PM build (repo `KisaesDevLab/Vibe-Time-Billing`).
**Status:** MyBooks side shipped 2026-09-08 (migration 0172). PM side: to build from this spec.

## 1. What this is

Clients get one login — the PM client portal at `portal.<firm>.com` — and see their
bookkeeping there too: questions from the bookkeeper, published financials, receipt
upload, standing document requests, bank balances, bill pay and bank-login repair.
PM renders those screens natively and fetches the data from MyBooks over a
server-to-server API. MyBooks becomes a headless provider of its client-portal
features; there is no SSO hand-off, no iframe, and the client never sees a MyBooks URL.

The MyBooks client portal keeps working unchanged for firms that do not use PM.

## 2. Trust model

Asymmetric. PM holds a private key; the MyBooks firm admin registers the matching
**public** key (or a JWKS URL) under **Firm → Settings → Vibe Practice Management**.
Nothing secret is stored in MyBooks. Each request carries a short-lived JWT PM signs.

```
PM server ──Authorization: Bearer <jwt>──▶ MyBooks /api/peer/pm/…
   ▲                                              │
   │ verifies with the registered public key,     │ acts as the linked
   │ single-use jti, ≤ 5 min lifetime             ▼ portal contact
PM browser (client) never talks to MyBooks
```

### 2.1 Keys

Generate once per PM instance (EC P-256 recommended):

```sh
openssl ecparam -name prime256v1 -genkey -noout -out pm-peer.key
openssl ec -in pm-peer.key -pubout -out pm-peer.pub      # paste THIS into MyBooks
```

RSA alternative: `openssl genrsa -out pm-peer.key 2048` + `openssl rsa -in pm-peer.key -pubout`.
Accepted: RSA ≥ 2048 (RS256), EC P-256 (ES256), EC P-384 (ES384). A private key pasted
by mistake is refused (`PEER_KEY_PRIVATE`).

JWKS mode (for key rotation without a paste): expose `https://<pm>/.well-known/jwks.json`
`{ "keys": [ { "kty":"EC","crv":"P-256","x":"…","y":"…","kid":"2026-09" } ] }` and put
`kid` in every token header. MyBooks caches the document 10 min, refetches at most once a
minute on an unknown `kid`, requires https, and refuses private/loopback/metadata hosts
(DNS-pinned at connect time). Publish the new key before you start signing with it.

### 2.2 Token

Header: `{ "alg": "ES256", "typ": "vibe-pm-peer", "kid": "…"(JWKS mode only) }`

| Claim | Required | Value |
|---|---|---|
| `iss` | yes | Exactly the issuer string registered in MyBooks (e.g. `https://portal.yourfirm.com`). Globally unique across firms. |
| `aud` | yes | `vibe-mybooks` |
| `iat`, `exp` | yes | `exp − iat ≤ 300` s. Clock skew tolerance 30 s. Sign on demand, per request. |
| `nbf` | no | Must be ≤ `exp`. |
| `jti` | yes | Unique per token, 8–128 chars `[A-Za-z0-9._~-]` (a UUID). **Single use** — MyBooks remembers it for 6 min; a second presentation is a 401. |
| `sub` | no | Free text ≤ 255 (PM's own id for the signed-in portal user). |
| `pm_client_id` | for `/portal/*` | PM's client entity id, 1–120 chars `[A-Za-z0-9._:@~-]`. Selects the linked MyBooks client. |
| `actor` | no | `{ "email": "…", "name": "…" }` — the PM portal user. Audit only. |

Mint one token per outgoing request. Never reuse a token, never hand one to a browser.

Node example (`jsonwebtoken`):

```ts
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
const token = jwt.sign(
  { iss: ISSUER, aud: 'vibe-mybooks', jti: randomUUID(), pm_client_id: client.id,
    actor: { email: user.email, name: user.name } },
  PRIVATE_KEY_PEM,
  { algorithm: 'ES256', expiresIn: 120, header: { typ: 'vibe-pm-peer' } },
);
```

### 2.3 Request rules

* Base URL: `https://<mybooks>/api/peer/pm`. Always over TLS.
* `Authorization: Bearer <token>`; JSON bodies; multipart for uploads (below).
* **Do not send an `Origin` header** — its presence is refused (browser fingerprint).
* Responses are `Cache-Control: private, no-store`. PM may cache `/portal/context` for
  ≤ 60 s per client; nothing else.
* Rate limits: 600 requests/min per PM IP before auth; 600/min per (firm, client) after.
  Plaid-touching, bill-mark and categorize writes carry their own 10–30/min per client.
  A 429 has `error.code = RATE_LIMIT`.
* Errors are `{ "error": { "message", "code", "details"? } }`.

| HTTP | code | Meaning |
|---|---|---|
| 401 | `PEER_TOKEN_INVALID` | Any token failure (signature, expiry, replay, unknown/disabled issuer, `Origin` present, replay store down). Uniform on purpose; the firm sees the reason under Firm Settings → Last error. |
| 400 | `PEER_CLIENT_ID_REQUIRED` | `/portal/*` without `pm_client_id`. |
| 404 | `PM_LINK_NOT_FOUND` | No usable link for `pm_client_id`: never linked, contact paused/deleted, contact unlinked from the company, company portal paused, tenant left the firm. Uniform on purpose. |
| 400 | `PEER_COMPANY_MISMATCH` | A `companyId` you sent differs from the linked company (PM bug — you mixed clients). Also 403 with this code when a receipt upload names a document request of a sibling company. |
| 403 | `FEATURE_DISABLED`, `BANKING_NOT_ENABLED`, `BILL_PAY_NOT_ENABLED`, `CATEGORIZE_NOT_ENABLED`, `BANK_REPAIR_NOT_ENABLED` | The firm has not turned that feature on for this tenant/contact. Check `features` in `/portal/context` first. |

## 3. Discovery

### `GET /health`
No link needed. `{ ok: true, issuer, firm: { id, name } }`. Use it in PM's settings screen.

### `GET /links`
Every PM client the firm has linked, with a live `active` flag:

```json
{ "links": [ { "id", "pmClientId", "tenant": {"id","name"}, "company": {"id","name"},
  "contact": {"id","email","firstName","lastName","status"}, "active": true, "createdAt" } ] }
```
PM shows a "Bookkeeping" tab only for clients that appear here with `active: true`.

### `GET /portal/context` (needs `pm_client_id`)
Who the token acts as and what it may do — built from the link, never from a session:

```json
{
  "pmClientId": "cl_123",
  "tenant":  { "id", "name", "slug" },
  "company": { "id", "name" },
  "contact": { "id", "email", "firstName", "lastName" },
  "permissions": { "financialsAccess", "filesAccess", "questionsForUsAccess",
                   "bankingAccess", "billPayAccess", "categorizeAccess", "bankRepairAccess" },
  "features": { "questions": true, "questionsForUs", "financials", "receipts",
                "documentRequests", "banking", "bankRepair", "billPay", "categorize" },
  "practice": { "name", "brandingLogoUrl", "brandingPrimaryColor", "announcement" }
}
```
`features.*` = tenant feature flag ∧ the contact's per-company grant. Render a tab only
when its feature is true; the API refuses otherwise.

**`companyId` is implied by the link.** You may omit it everywhere below; if you send it,
it must equal `company.id`.

## 4. Portal API (all under `/portal/…`, all need `pm_client_id`)

These are the MyBooks client-portal endpoints re-mounted for the linked contact. Shapes
are those of `packages/api/src/routes/portal-*-public.routes.ts`.

### 4.1 Questions (feature `questions`; `questionsForUs` for `/ask`)

| Method | Path | Notes |
|---|---|---|
| GET | `/portal/questions` | `{ open: [{id, body, status, transactionId, askedAt}], answered: [{…, respondedAt, resolvedAt}] }` |
| GET | `/portal/questions/:id` | `{ question: { id, body, status, transactionId, askedAt, messages: [{id, senderType, body, attachments, createdAt}], transactionContext: {amount, memo, date} \| null } }`. Marks it viewed. |
| POST | `/portal/questions/:id/answers` | JSON `{ body }` **or** multipart `body` + up to 5 `files` (jpeg/png/gif/webp/heic/pdf/csv/txt/xlsx/xls/docx, 10 MB each). → `201 { messageId }` |
| GET | `/portal/questions/:id/attachments/:attachmentId/download` | Binary with `Content-Type` + `Content-Disposition: attachment`. Proxy it to the browser. |
| POST | `/portal/questions/ask` | `{ body (≤ 4000), transactionId? }` → `201 { id }` |

### 4.2 Financials (feature `financials`)

| GET | `/portal/financials` | `{ reports: [...] }` — published report instances for the company |
| GET | `/portal/financials/:id/download` | `application/pdf`, `Content-Disposition: inline`. Proxy it; ignore any `pdfUrl` in the list. |

### 4.3 Receipts (feature `receipts`)

| POST | `/portal/receipts/upload` | multipart: `file` (jpeg/png/heic/webp/pdf, 10 MB), optional `documentRequestId`. → `201 { id, duplicate }`. A request from another company → 403 `PEER_COMPANY_MISMATCH`. |
| GET | `/portal/receipts` | `{ receipts: [...] }` — this contact's own uploads, last 30 days |

### 4.4 Document requests (feature `documentRequests`)

| GET | `/portal/document-requests` | `{ featureEnabled, items: [{ id, companyId, documentType, description, periodLabel, requestedAt, dueDate, status, submittedAt, … }] }` — pending requests for the linked company. Fulfil one by uploading a receipt with `documentRequestId`. |

### 4.5 Banking (feature `banking`)

| GET | `/portal/banking/accounts` | `{ featureEnabled, asOf, accounts: [{ id, name, type, balance, … }] }` |
| GET | `/portal/banking/accounts/:accountId/register?startDate&endDate&search&page&perPage` | `{ featureEnabled, rows, total, … }` — sanitized register (no memos/recon flags) |

### 4.6 Bank-login repair (feature `bankRepair`)

Plaid Link must run in the **client's browser** (PM's page); MyBooks only mints and
completes. Flow:

1. `GET /portal/banking/connections` → `{ featureEnabled, connections: [{ plaidItemId, institutionName, status, needsRepair, accounts:[…] }] }`
2. `POST /portal/banking/connections/:plaidItemId/link-token` → `{ linkToken, institutionName, oauthReturnEnabled }`
   (10/min per client). Open Plaid Link in update mode with it, in PM's page.
3. On `onSuccess`, `POST /portal/banking/connections/:plaidItemId/repair-complete`
   → `{ ok, institutionName, healthy, itemStatus }`. MyBooks re-checks the item and re-syncs.

Plaid OAuth banks return the user to the `redirect_uri` registered with Plaid — that is
the MyBooks origin. For OAuth institutions PM must therefore either (a) open Link in a
popup so the MyBooks return page can complete the hand-back, or (b) skip repair for
those and show "Ask your bookkeeper". Non-OAuth banks work inline.

### 4.7 Bill pay (feature `billPay`)

| GET | `/portal/bills` | `{ featureEnabled, configured, bills: [...], queuedPayments: [...] }` |
| POST | `/portal/bills/mark` | `{ billIds: [uuid…] }` (10/min per client) → the mark result. Posts real GL transactions. |

### 4.8 Categorize (feature `categorize`)

| GET | `/portal/categorize/queue?limit&offset` | `{ featureEnabled, items, total }` |
| GET | `/portal/categorize/categories` | `{ featureEnabled, categories }` |
| GET | `/portal/categorize/history?limit&offset` | `{ featureEnabled, rows, total }` |
| POST | `/portal/categorize/suggestions` | `{ items: [{ targetKind: 'bank_feed_item'\|'transaction', targetId, categoryId \| 'personal' \| 'not_sure', note? }] }` (≤ 100, 30/min) → `201 { accepted, rejected }` |
| DELETE | `/portal/categorize/suggestions/:id` | withdraw a pending answer |
| GET | `/portal/categorize/attachments?targetKind&targetId` | this contact's files on a row |
| POST | `/portal/categorize/attachments` | multipart `targetKind`, `targetId`, up to 5 `files` (jpeg/png/gif/webp/heic/pdf) (20/min) |
| DELETE | `/portal/categorize/attachments/:id` | remove one of your own |

## 5. PM obligations

1. **The token never reaches a browser.** Mint and use it server-side only; PM's own
   portal session authenticates the client to PM.
2. **Scope every call to the signed-in PM user's client.** `pm_client_id` must be the
   client entity the user is authorised for in PM. MyBooks trusts that mapping.
3. **One token per request**, minted just in time. Do not pre-mint or reuse.
4. **Proxy binaries** (downloads and uploads). Never surface MyBooks URLs to the client.
5. **Cache `/portal/context` ≤ 60 s**; drive tab visibility from `features`.
6. Treat 404 `PM_LINK_NOT_FOUND` as "no bookkeeping for this client" (hide the tab), not
   as an error page.
7. Send `actor` so the MyBooks audit trail names the PM user who acted.
8. Keep clocks in sync (NTP). Tokens are valid for at most 5 minutes with 30 s skew.

## 6. PM-side settings screen (per firm)

* Show the issuer string PM signs with (the firm pastes it into MyBooks).
* Show the public key PEM (copy button) and/or the JWKS URL.
* Show each client's `client.id` on the client record — MyBooks staff paste it when linking.
* A "Test connection" button calls `GET /health` and shows `firm.name`.
* Optional: a nightly `GET /links` to flag PM clients that are linked/unlinked.

## 7. Firm workflow in MyBooks

1. Firm admin: **Firm → Settings → Vibe Practice Management** — enable, paste issuer +
   public key (or JWKS URL), Save. "Test a token" verifies a PM-minted token without
   consuming it.
   On the shared appliance firm ("Default Practice") only the system administrator can do
   this — it spans every tenant on the box.
2. Firm staff with access to the client: **Linked clients** card — PM client id, client
   (tenant), company, portal contact. The contact's per-company toggles under
   Practice → Client Portal (financials, files, questions, banking, bill pay, categorize,
   fix bank logins) are exactly what PM inherits. Pausing the contact or unlinking the
   company cuts PM off immediately.
3. Ops: the card shows **Last seen** and **Last error** (`sig_invalid`, `unknown_kid`,
   `expired`, `replay`, `jwks_fetch_failed`, `no_link`). Every accepted token writes an
   audit row `portal_peer_access` under the client tenant with the PM actor.

## 8. Key rotation

PEM mode: paste the new public key (old tokens fail from that moment; PM must switch at
the same time). JWKS mode: publish the new key with a new `kid` first, start signing
with it, retire the old entry after 10 minutes.

## 9. Reference (MyBooks side)

* Tables: `firm_peers`, `pm_client_links` (migration `0172_firm_peers`).
* Verification: `packages/api/src/services/peer-token.service.ts`; jti store
  `utils/peer-jti-store.ts` (Redis `SET NX EX`, fails closed).
* Middleware: `middleware/peer-auth.ts` (`peerAuth`, `requirePeerLink`,
  `peerCompanyScope`, `scopedCompanyId`).
* Router: `routes/peer-pm.routes.ts` mounted at `/api/peer/pm`.
* Firm management: `routes/firms.routes.ts` (`/:firmId/integrations/vibe-pm`,
  `/:firmId/pm-links`), `services/firm-peers.service.ts`.
* Tests: `peer-token.service.test.ts`, `peer-jti-store.test.ts`, `peer-pm.routes.test.ts`,
  `firms.routes.peers.test.ts`.
