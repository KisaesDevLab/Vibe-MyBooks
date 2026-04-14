# BUILD PLAN: Vibe MyBooks — License Enforcement & Subscription Integration

## In-App Licensing for the Per-External-User Model

**Repository:** `KisaesDevLab/vibe-mybooks`
**Stack:** React 18 · TypeScript · Node.js 20 · Express · Drizzle ORM · PostgreSQL 16 · Redis 7 · BullMQ
**License:** PolyForm Internal Use 1.0.0 (free for internal staff, commercial license for client portal access)
**Depends on:** `kisaes-license-portal` at `licensing.kisaes.com`

---

## Overview

This build plan adds license awareness to Vibe MyBooks so that self-hosted instances enforce the per-external-user tier model. The system is designed around three core principles:

1. **Staff never locked out.** Internal/staff users always have full access regardless of license state.
2. **Paying customers over limits get warnings, not lockouts.** Dashboard banners and email nudges, never data restrictions.
3. **Data export always accessible.** Even expired licenses can export all data at any time.

---

## Licensing Tiers (enforced in-app)

| Tier | External User Cap | Requires License Key |
|------|------------------|---------------------|
| Free | 3 | No (built-in default) |
| Starter | 25 | Yes |
| Growth | 100 | Yes |
| Professional | 500 | Yes |
| Enterprise | Unlimited | Yes |

---

## Phase 1 — Database Schema Additions

### 1.1 New Tables

```sql
-- Stores the active license state for this MyBooks instance
CREATE TABLE license_state (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    instance_id TEXT NOT NULL,          -- deterministic hardware fingerprint
    license_key TEXT,                    -- the JWT from kisaes-license-portal (nullable = free tier)
    tier TEXT NOT NULL DEFAULT 'free',   -- 'free','starter','growth','professional','enterprise'
    external_user_cap INTEGER NOT NULL DEFAULT 3,
    status TEXT NOT NULL DEFAULT 'active', -- 'active','grace','expired','unlicensed'
    activated_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    grace_expires_at TIMESTAMPTZ,
    last_heartbeat_at TIMESTAMPTZ,
    last_heartbeat_response JSONB,
    portal_base_url TEXT NOT NULL DEFAULT 'https://licensing.kisaes.com',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Single-row table enforced by application layer (upsert pattern)
CREATE UNIQUE INDEX idx_license_state_singleton ON license_state ((true));

-- Tracks external user count over time for admin visibility
CREATE TABLE license_usage_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_user_count INTEGER NOT NULL,
    internal_user_count INTEGER NOT NULL,
    tier TEXT NOT NULL,
    status TEXT NOT NULL,
    logged_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_license_usage_log_date ON license_usage_log (logged_at);
```

### 1.2 User Table Modifications
- [ ] Add column `users.is_external BOOLEAN NOT NULL DEFAULT false`
- [ ] Add column `users.user_type TEXT NOT NULL DEFAULT 'staff'` — values: `'staff'`, `'client'`, `'external'`
- [ ] Migration: backfill existing users — any user associated with a client entity gets `is_external = true`, `user_type = 'client'`
- [ ] Add database view: `v_external_user_count` → `SELECT COUNT(*) FROM users WHERE is_external = true AND deleted_at IS NULL`

### 1.3 Drizzle Schema Definitions
- [ ] `src/db/schema/license-state.ts`
- [ ] `src/db/schema/license-usage-log.ts`
- [ ] Update `src/db/schema/users.ts` with new columns
- [ ] Migration file via Drizzle Kit

**Checklist items: 10**

---

## Phase 2 — Instance Fingerprint Generation

### 2.1 Fingerprint Service
- [ ] `src/services/instance-fingerprint.ts`
- [ ] Generates deterministic ID from:
  - Server hostname (`os.hostname()`)
  - First non-internal MAC address (`os.networkInterfaces()`)
  - PostgreSQL system identifier (`SELECT system_identifier FROM pg_control_system()`)
- [ ] SHA-256 hash of concatenated values → `inst_<hex>`
- [ ] Cached in memory after first generation (immutable for the life of the process)
- [ ] Fallback: if any component unavailable, use remaining components + random UUID (persisted to `license_state` table on first run)

### 2.2 Fingerprint Stability
- [ ] Fingerprint must survive app restarts and container rebuilds
- [ ] PostgreSQL system identifier is the strongest anchor (survives container rebuilds if PG volume is persistent)
- [ ] If fingerprint changes (hardware swap), user must deactivate old license and reactivate

**Checklist items: 5**

---

## Phase 3 — RSA Public Key & JWT Verification

### 3.1 Public Key Bundling
- [ ] Bundle RSA public key at `src/config/license-public.pem`
- [ ] Include in Docker image at build time
- [ ] Also store in `license_state.portal_base_url` for fetching updated key via `/api/licenses/public-key`

### 3.2 License Key Verification Service
- [ ] `src/services/license-verifier.ts`
- [ ] `verifyLicenseKey(jwt: string): LicenseClaims | null`
  - RS256 signature verification using bundled public key
  - Validates `iss` === `https://licensing.kisaes.com`
  - Validates `aud` === `vibe-mybooks`
  - Validates `exp` > now (accounts for grace period baked into token)
  - Validates `instance_id` matches local fingerprint
  - Returns decoded claims: `{ tier, external_user_cap, expires_at, grace_days, license_id }`
- [ ] `isInGracePeriod(claims: LicenseClaims): boolean`
  - True if current time is between `exp - grace_days` and `exp`
- [ ] `isExpired(claims: LicenseClaims): boolean`
  - True if current time > `exp`

### 3.3 Offline-First Design
- [ ] Verification is entirely local — no network call required
- [ ] The JWT contains all necessary claims for enforcement
- [ ] Network is only needed for: initial activation, heartbeat (optional), and purchasing

**Checklist items: 8**

---

## Phase 4 — License State Machine

### 4.1 State Definitions

```
┌──────────┐     activate      ┌──────────┐
│UNLICENSED├────────────────────►  ACTIVE  │
│ (free)   │                    │          │
└──────────┘                    └────┬─────┘
     ▲                               │
     │ downgrade to ≤3               │ subscription expires
     │ external users                │ OR payment fails
     │                               ▼
     │                          ┌──────────┐
     │                          │  GRACE   │
     │                          │ (60 days)│
     │                          └────┬─────┘
     │                               │
     │         reactivate            │ grace period ends
     │◄──────────────────────────────┤
     │                               ▼
     │                          ┌──────────┐
     └──────────────────────────┤ EXPIRED  │
               reactivate      │          │
                                └──────────┘
```

### 4.2 State Transition Rules
- [ ] `UNLICENSED → ACTIVE`: License key entered and verified, tier > free
- [ ] `ACTIVE → GRACE`: `expires_at` passed but within 60-day grace window
- [ ] `GRACE → EXPIRED`: 60-day grace window passed
- [ ] `EXPIRED → ACTIVE`: New valid license key entered
- [ ] `ACTIVE → UNLICENSED`: License removed and external users ≤ 3 (voluntary downgrade)
- [ ] `ANY → ACTIVE`: Valid license key replaces current state (upgrade, renewal)

### 4.3 State Machine Service
- [ ] `src/services/license-state-machine.ts`
- [ ] `LicenseStateMachine.evaluate(): LicenseStatus`
  - Reads `license_state` table
  - If no license key and external users ≤ 3 → `UNLICENSED` (free tier, fully functional)
  - If no license key and external users > 3 → `UNLICENSED` (show upgrade prompt)
  - If license key valid and not expired → `ACTIVE`
  - If license key valid, past expiry but within grace → `GRACE`
  - If license key valid, past grace → `EXPIRED`
- [ ] State evaluated on every request via middleware (cached in Redis for 60 seconds)
- [ ] State changes logged to `audit_log`

### 4.4 Behavior by State

| State | Staff Access | External Access | New External Users | Data Export | Banners |
|-------|-------------|----------------|-------------------|-------------|---------|
| UNLICENSED (≤3 ext) | Full | Full | Allowed up to 3 | Full | None |
| UNLICENSED (>3 ext) | Full | Full (existing) | Blocked | Full | Upgrade prompt |
| ACTIVE | Full | Full | Allowed up to cap | Full | None |
| ACTIVE (over cap) | Full | Full (existing) | Blocked (new) | Full | Soft warning |
| GRACE | Full | Full | Blocked | Full | Grace countdown |
| EXPIRED | Full | Read-only | Blocked | Full | Renewal CTA |

**Key enforcement detail:** "Blocked" for new external users means the invitation/creation form is disabled with a message — existing external users are NEVER removed or locked out.

**Checklist items: 12**

---

## Phase 5 — Express Middleware Stack

### 5.1 License Middleware
- [ ] `src/middleware/license-check.ts`
- [ ] Runs on every authenticated request
- [ ] Reads license state from Redis cache (falls back to DB)
- [ ] Attaches `req.licenseState` to request object:
  ```typescript
  interface LicenseState {
    tier: 'free' | 'starter' | 'growth' | 'professional' | 'enterprise';
    status: 'active' | 'grace' | 'expired' | 'unlicensed';
    externalUserCap: number;
    currentExternalUsers: number;
    isOverCap: boolean;
    isInGrace: boolean;
    graceDaysRemaining: number | null;
    expiresAt: Date | null;
  }
  ```
- [ ] Middleware NEVER returns 403 for staff users — only adds state info
- [ ] Middleware NEVER blocks data read operations for ANY user
- [ ] Middleware ONLY blocks: creating new external user accounts when over cap or in expired state

### 5.2 External User Creation Guard
- [ ] `src/middleware/external-user-guard.ts`
- [ ] Applied to routes: `POST /api/users` (when `is_external: true`), `POST /api/invitations` (external)
- [ ] Logic:
  ```
  IF licenseState.status === 'expired' → reject with upgrade message
  IF licenseState.status === 'unlicensed' AND currentExternalUsers >= 3 → reject with upgrade message
  IF licenseState.isOverCap → reject with upgrade message
  ELSE → allow
  ```
- [ ] Rejection response: `{ error: 'license_limit', message: '...', upgradeUrl: 'https://licensing.kisaes.com/pricing' }`

### 5.3 License Status API
- [ ] `GET /api/license/status` → returns full `LicenseState` for frontend consumption
- [ ] `POST /api/license/activate` → accepts `{ licenseKey }`, verifies, stores in `license_state`
- [ ] `POST /api/license/deactivate` → removes license key, reverts to free tier
- [ ] `GET /api/license/portal-url` → returns URL to licensing.kisaes.com dashboard for current org

**Checklist items: 10**

---

## Phase 6 — Heartbeat Cron Job

### 6.1 Daily Heartbeat
- [ ] BullMQ recurring job: `license:heartbeat` — runs daily at 2:00 AM server time
- [ ] Calls `POST https://licensing.kisaes.com/api/licenses/heartbeat` with:
  ```json
  {
    "license_key": "<JWT from license_state>",
    "instance_id": "<fingerprint>",
    "external_user_count": 47,
    "app_version": "1.2.0"
  }
  ```
- [ ] Stores response in `license_state.last_heartbeat_response`
- [ ] Updates `license_state.last_heartbeat_at`
- [ ] If heartbeat returns updated tier/cap info (from portal-side upgrade), update local state

### 6.2 Heartbeat Failure Handling
- [ ] Heartbeat is OPTIONAL — app functions fully without it
- [ ] If heartbeat fails (network error, portal down): log warning, retry next day
- [ ] After 30 consecutive heartbeat failures: log admin warning (but do NOT change license state)
- [ ] The JWT is the source of truth, not the heartbeat

### 6.3 Usage Logging
- [ ] After each heartbeat (success or fail), write to `license_usage_log`
- [ ] Retention: 365 days of usage data
- [ ] BullMQ cleanup job: purge logs older than 365 days weekly

**Checklist items: 8**

---

## Phase 7 — Frontend: License Dashboard & Banners

### 7.1 License Status Dashboard Page
- [ ] Route: `/settings/license`
- [ ] Displays:
  - Current tier (with badge: Free, Starter, Growth, Professional, Enterprise)
  - License status (Active, Grace Period, Expired, Unlicensed)
  - External users: current count / cap (progress bar, color-coded)
  - Internal users: count (always shown as "unlimited — always free")
  - License expiry date (if applicable)
  - Grace period countdown (if in grace)
  - Last heartbeat timestamp and status
  - Instance ID (masked, with copy button)
- [ ] Actions:
  - "Enter License Key" button → modal with text input + paste
  - "Buy/Upgrade License" button → opens licensing.kisaes.com in new tab
  - "Manage Billing" button → opens Stripe Customer Portal via portal URL
  - "Deactivate License" button → confirmation dialog → reverts to free tier
  - "Export All Data" button → always enabled regardless of license state

### 7.2 Dashboard Banners (persistent notification bar)
- [ ] Banner component: `src/components/LicenseBanner.tsx`
- [ ] Positioned at top of main layout, above page content
- [ ] Banner states:

| Condition | Color | Message | Dismissable |
|-----------|-------|---------|-------------|
| Free tier, ≤3 external, no prompt needed | (none) | (no banner) | — |
| Free tier, 0 external users, >30 days old | Blue | "Did you know? You can invite up to 3 clients for free." | Yes (once) |
| Approaching cap (>80% of external_user_cap) | Amber | "You're using {n} of {cap} client seats. Upgrade for more." | Yes (7 days) |
| Over cap | Amber | "You've reached your {cap} client seat limit. Upgrade to add more clients." | No |
| Grace period | Orange | "Your license expires in {n} days. Renew to maintain client portal access." | No |
| Grace period <14 days | Red | "Your license expires in {n} days. Client portal will become read-only." | No |
| Expired | Red | "Your license has expired. Client portal is read-only. Renew now." | No |
| Heartbeat failing >7 days | Gray | "Unable to reach licensing server. This won't affect your service." | Yes (1 day) |

- [ ] Banner dismiss state stored in localStorage per banner type
- [ ] Banners only shown to admin/owner users — not to staff or external users

### 7.3 External User Management UI Changes
- [ ] User invitation form: if at/over cap, disable "Invite External User" button
- [ ] Show inline message: "You've reached your plan's client limit. [Upgrade →]"
- [ ] User list: add column/badge for "External" vs "Staff" user type
- [ ] User creation form: radio toggle for "Staff member" vs "Client/External user"
- [ ] Settings > Users page: summary card showing external user count vs cap

### 7.4 Onboarding / First-Run License Prompt
- [ ] On first launch (no license_state row exists), show setup wizard step:
  - "Vibe MyBooks is free for your team and up to 3 client portal users."
  - "Need more? Enter a license key or purchase one."
  - [Enter License Key] [Buy License] [Continue with Free Tier]
- [ ] Wizard step is skippable and can be revisited from Settings > License

**Checklist items: 20**

---

## Phase 8 — External User Identification & Counting

### 8.1 User Type Assignment
- [ ] New user registration/invitation flow includes `user_type` selection
- [ ] Admin can change `user_type` for existing users (Settings > Users > Edit)
- [ ] Changing a user from `external` to `staff` decreases external count (may resolve over-cap)
- [ ] Changing a user from `staff` to `external` increases external count (may trigger cap)
- [ ] Soft-deleted users (`deleted_at IS NOT NULL`) are NOT counted toward cap

### 8.2 Counting Logic
- [ ] `src/services/external-user-counter.ts`
- [ ] `getExternalUserCount(): number` — counts non-deleted users where `is_external = true`
- [ ] Result cached in Redis with 5-minute TTL (key: `license:external_user_count`)
- [ ] Cache invalidated on user create, update (user_type change), or delete
- [ ] Used by: license middleware, heartbeat, dashboard, banner logic

### 8.3 Edge Cases
- [ ] Bulk user import: count check happens before import starts, rejects entire batch if it would exceed cap
- [ ] API-created users: same guard middleware applies
- [ ] Client entity with multiple contact users: each contact with portal access counts as 1 external user
- [ ] Deactivated/suspended external users: still count toward cap (to prevent gaming via suspend/unsuspend cycles)
- [ ] Actually deleted users (hard or soft delete): do NOT count

**Checklist items: 10**

---

## Phase 9 — License Activation Flow (End-to-End)

### 9.1 Manual Activation (License Key Entry)
```
1. Admin navigates to Settings > License
2. Clicks "Enter License Key"
3. Pastes JWT license key from licensing.kisaes.com dashboard
4. Frontend calls POST /api/license/activate { licenseKey }
5. Backend:
   a. Verifies JWT signature (RSA public key)
   b. Validates claims (iss, aud, exp, instance_id match)
   c. Upserts license_state row
   d. Invalidates Redis license cache
   e. Returns new LicenseState
6. Frontend updates dashboard, removes/updates banners
7. Backend fires heartbeat immediately (async, non-blocking)
```

### 9.2 Automatic Activation (Deep Link from Portal)
- [ ] licensing.kisaes.com checkout success page includes deep link:
  `https://<mybooks-instance>/settings/license?activate=<jwt>`
- [ ] MyBooks detects `?activate=` query param on Settings > License route
- [ ] Auto-populates license key field and triggers activation
- [ ] Requires admin session (redirects to login if not authenticated)

### 9.3 License Renewal
- [ ] When Stripe renews the subscription, licensing.kisaes.com issues a new JWT with extended `exp`
- [ ] New JWT delivered via:
  - Daily heartbeat response (includes `new_license_key` field if available)
  - Email notification with new key
  - Customer dashboard on licensing.kisaes.com (copy button)
- [ ] MyBooks heartbeat cron auto-applies new key if present in heartbeat response
- [ ] Manual re-entry also works (paste new key in Settings > License)

### 9.4 License Deactivation
- [ ] Admin clicks "Deactivate License" → confirmation dialog
- [ ] Backend:
  - Calls `POST licensing.kisaes.com/api/licenses/deactivate` (best-effort, non-blocking)
  - Clears `license_state.license_key`
  - Sets tier to `free`, cap to 3
  - If external users > 3: status becomes `unlicensed` (existing users keep access, no new external users)

**Checklist items: 10**

---

## Phase 10 — Grace Period Implementation

### 10.1 Grace Period Logic
- [ ] Grace period = 60 days after `expires_at`
- [ ] Built into the JWT: token `exp` = `subscription_expires_at + 60 days`
- [ ] During grace:
  - All existing users (staff AND external) retain full access
  - No new external user creation
  - Dashboard banners escalate in urgency
  - Email notifications sent at: day 1, day 30, day 46, day 53, day 57, day 59

### 10.2 Post-Grace (Expired) Behavior
- [ ] External users become read-only:
  - Can view their data, documents, reports
  - Cannot create new transactions, upload documents, or modify data
  - Client portal login still works (they can see their books)
- [ ] Staff users retain FULL access (read + write) — business continues
- [ ] Data export: always available for ALL users regardless of state
- [ ] New external user creation: blocked
- [ ] Existing external users: never deleted, never locked out of viewing

### 10.3 Recovery from Expired State
- [ ] Enter new valid license key → immediately restores full access for all users
- [ ] External users regain write access instantly
- [ ] No data loss, no re-invitation needed

**Checklist items: 8**

---

## Phase 11 — Admin & Telemetry

### 11.1 License Admin Page (internal to MyBooks)
- [ ] Route: `/admin/license` (accessible to MyBooks system admin only)
- [ ] Shows:
  - Full license state details (decoded JWT claims)
  - Instance fingerprint components (hostname, MAC, PG ID)
  - Heartbeat history (last 30 days, chart)
  - External user count trend (last 90 days, chart from `license_usage_log`)
  - Raw license_state row for debugging

### 11.2 System Health Check
- [ ] `GET /api/health` response includes license summary:
  ```json
  {
    "license": {
      "tier": "growth",
      "status": "active",
      "externalUsers": "47/100",
      "expiresAt": "2027-04-13T00:00:00Z"
    }
  }
  ```
- [ ] Useful for Portainer/monitoring integration on the appliance

### 11.3 Audit Logging
- [ ] All license state changes logged to existing MyBooks audit log
- [ ] Events: `license.activated`, `license.deactivated`, `license.renewed`, `license.expired`, `license.grace_entered`, `license.tier_changed`, `external_user.cap_reached`, `external_user.created`, `external_user.blocked`

**Checklist items: 8**

---

## Phase 12 — Testing

### 12.1 Unit Tests
- [ ] Instance fingerprint generation (deterministic, stable)
- [ ] JWT verification (valid, expired, wrong issuer, wrong audience, wrong instance)
- [ ] License state machine transitions (all paths)
- [ ] External user counting (include/exclude soft deletes, user type changes)
- [ ] Grace period date math
- [ ] Banner display logic (all conditions)

### 12.2 Integration Tests
- [ ] Middleware: staff user passes through regardless of license state
- [ ] Middleware: external user creation blocked when over cap
- [ ] Middleware: external user creation allowed when under cap
- [ ] Middleware: data export allowed in all states
- [ ] Activation flow: enter key → verify → state updated
- [ ] Heartbeat: successful call → state updated
- [ ] Heartbeat: failed call → no state change, warning logged
- [ ] Grace period: simulate expiry → verify behavior transitions
- [ ] Expired state: external user read-only, staff full access

### 12.3 E2E Tests (Playwright)
- [ ] License settings page renders correctly in each state
- [ ] Banner appears/disappears based on license state
- [ ] Enter license key flow (happy path)
- [ ] External user invitation blocked when over cap (shows message)
- [ ] Upgrade button links to correct licensing.kisaes.com URL

### 12.4 Mock License Server
- [ ] `src/test/mocks/license-server.ts` — Express app mimicking portal API
- [ ] Used in integration and E2E tests
- [ ] Generates valid JWTs signed with test RSA key pair
- [ ] Simulates heartbeat responses (normal, over-cap, new-key-available)

**Checklist items: 18**

---

## Phase 13 — Documentation

### 13.1 User-Facing Documentation
- [ ] `docs/licensing.md` — how licensing works, tier comparison, FAQ
- [ ] `docs/activation-guide.md` — step-by-step activation with screenshots
- [ ] In-app help tooltip on Settings > License page

### 13.2 Developer Documentation
- [ ] Update `CLAUDE.md` with license enforcement conventions
- [ ] `docs/license-architecture.md` — JWT structure, state machine, middleware stack
- [ ] `docs/license-testing.md` — how to test with mock server, test keys

### 13.3 README Update
- [ ] Add licensing section to main README
- [ ] Document environment variables related to licensing
- [ ] Document the RSA public key bundling process

**Checklist items: 8**

---

## Summary

| Phase | Description | Items |
|-------|------------|-------|
| 1 | Database Schema Additions | 10 |
| 2 | Instance Fingerprint Generation | 5 |
| 3 | RSA Public Key & JWT Verification | 8 |
| 4 | License State Machine | 12 |
| 5 | Express Middleware Stack | 10 |
| 6 | Heartbeat Cron Job | 8 |
| 7 | Frontend: Dashboard & Banners | 20 |
| 8 | External User Identification & Counting | 10 |
| 9 | License Activation Flow | 10 |
| 10 | Grace Period Implementation | 8 |
| 11 | Admin & Telemetry | 8 |
| 12 | Testing | 18 |
| 13 | Documentation | 8 |
| **TOTAL** | | **135** |

---

## Cross-Reference: License Server ↔ MyBooks App

| Concern | License Server (Portal) | MyBooks App |
|---------|------------------------|-------------|
| RSA Private Key | Holds it, signs JWTs | Never has it |
| RSA Public Key | Serves via API | Bundled at build time |
| JWT Issuance | Issues on purchase/renewal | Receives and stores |
| JWT Verification | Not needed (it's the issuer) | Verifies locally (offline) |
| External User Count | Receives via heartbeat | Counts locally, reports |
| Tier Enforcement | Sets cap in JWT claims | Reads cap from JWT, enforces |
| Grace Period | Sets expiry + 60 days in JWT | Reads from JWT, enforces behavior |
| Stripe Integration | Full (checkout, webhooks, portal) | None (all billing via portal) |
| User Data | Only org email + license metadata | All client financial data |
| Data Export | N/A | Always allowed, all states |
