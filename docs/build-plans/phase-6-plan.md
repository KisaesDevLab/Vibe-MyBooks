# Phase 6 Plan — Review Checks: Check Registry & Engine

**Build plan source:** `Build Plans/VIBE_MYBOOKS_PRACTICE_BUILD_PLAN.md` Phase 6 (lines 396–442), 26 items across 6 subsections.
**Builds on:** Phase 1 feature flags. No prior-phase data dependencies.
**Feature flag:** `CLOSE_REVIEW_V1` (existing — Phase 7 ships the UI inside Close Review).
**Scope:** Backend only. Phase 7 ships the dashboard UI.

---

## Objective

Build the close-cycle anomaly-detection engine. A `check_registry` defines stock checks; per-tenant per-company runs invoke each handler; results land in `findings` for the bookkeeper to triage. Suppressions block known-non-issues. A nightly scheduled runner + on-demand endpoint trigger the engine.

---

## Architectural decisions

### D1 — 5 new tables + 1 overrides table = 6 tables, all additive

| Table | Purpose |
|---|---|
| `check_registry` | Catalog of available checks (seeded; one row per `check_key`) |
| `check_runs` | One row per orchestrator invocation (tenant, company, started/completed timestamps, counts) |
| `findings` | Per-detection rows; the bookkeeper triages from here |
| `finding_events` | State-transition history for each finding |
| `check_suppressions` | "Don't surface this kind of finding for this pattern" rules |
| `check_params_overrides` | Per-tenant / per-company parameter overrides for individual checks |

### D2 — Nightly scheduler uses the existing advisory-lock pattern, not BullMQ

Same call as Phase 2a / Phase 3 / Phase 4 — BullMQ isn't wired up; CLAUDE.md confirms that's a separate phase. The check runner registers a scheduler in `worker/src/index.ts` via `startCheckScheduler()` that runs every 30 minutes and only triggers a tenant's per-company sweep if it's been ≥24h since the last run for that (tenant, company). Per-tenant timezone is honored by storing the local-time threshold rather than a global UTC trigger.

### D3 — Handler signature: `(tenantId, companyId, params, db) => Promise<Finding[]>`

Pure data producers — no writes. The orchestrator is responsible for dedupe + suppression + bulk insert. Each handler is a single function in `services/check-handlers/<check_key>.ts`.

### D4 — Dedupe key: `(tenant_id, check_key, transaction_id, vendor_id, COALESCE(payload->>'dedupe_key', ''))`

Same finding can re-fire across runs if status is `resolved` or `ignored` (those are terminal — re-firing means the issue regressed). Findings with status in `(open, assigned, in_review)` are not re-inserted. The optional `payload.dedupe_key` lets handlers that don't have a transaction or vendor (e.g., a global "uncategorized count" check) supply their own uniqueness key.

### D5 — 13 stock checks with thoughtful scoping

| Check key | Notes |
|---|---|
| `parent_account_posting` | Direct posting to a parent account (children exist). |
| `missing_attachment_above_threshold` | Expense ≥ default $75 with no attachment row. Threshold is per-tenant overridable. |
| `uncategorized_stale` | Bank-feed item still `pending` after N days (default 14). |
| `auto_posted_by_rule_sampling` | 10% sample of conditional-rule fires (Phase 4 audit) flagged for review. |
| `tag_inconsistency_vs_history` | Transaction tagged differently than the historical mode for that vendor. |
| `transaction_above_materiality` | Single transaction ≥ default $10,000 (per-tenant override). |
| `duplicate_candidate` | Two transactions in same week, same vendor, same amount. |
| `round_dollar_above_threshold` | Whole-dollar amounts ≥ default $500. |
| `weekend_holiday_posting` | Sat/Sun posting. Holiday calendar deferred — flagged in plan §D7 as v1 limitation. |
| `negative_non_liability` | Asset/expense/revenue account with negative balance. |
| `closed_period_posting` | Posting to a date < tenant's `close_lock_date` system-setting (currently unused). Stub handler returns `[]` until close-lock feature ships; documented per plan §D7. |
| `vendor_1099_threshold_no_w9` | Vendor paid ≥$600 YTD with no `taxId` set on the contact. (1099 form generation is Phase 12; this just flags the gap.) |
| `missing_required_class_location_customer` | Class/location columns don't exist (deferred from Phase 4). v1 limited to `missing_required_customer` — flag transactions with `txnType in ('invoice','customer_payment')` and null `contactId`. Renamed for clarity. |

### D6 — Per-check params resolved via merge: `defaults ⊕ tenantOverride ⊕ companyOverride`

The resolver runs once per (check, tenant, company) at orchestrator start; handlers receive the merged `params` object and don't know about override layers.

### D7 — Audit emit per finding via existing `auditLog()` helper

Every finding insertion writes an audit row (`entityType: 'finding'`, `action: 'create'`). State transitions in Phase 7 will use the same helper.

### D8 — Bounded run cap

The orchestrator caps at 5000 findings per run per tenant. Hitting the cap aborts further checks and writes a `truncated: true` flag on the `check_runs` row. Defends against a runaway handler producing millions of findings on a misconfigured tenant.

### D9 — `check_suppressions.match_pattern` is a JSONB matcher

Shape: `{transactionId?, vendorId?, payloadEquals?: Record<string, unknown>}`. The orchestrator filters candidate findings against active (unexpired) suppressions for the (tenant, check_key) pair before insert.

---

## Files to create

### Database
- `packages/api/src/db/schema/review-checks.ts` — Drizzle for all 6 tables.
- `packages/api/src/db/migrations/0068_review_checks.sql` — schema + seeds the 13 stock checks into `check_registry`.
- `packages/api/src/db/migrations/0068_review_checks.rollback.sql`.

### Shared
- `packages/shared/src/types/review-checks.ts` — `Finding`, `FindingStatus`, `FindingSeverity`, `CheckParams`, `CheckRegistryEntry`.
- `packages/shared/src/constants/review-checks.ts` — check keys, default params, severity values.
- `packages/shared/src/schemas/review-checks.ts` — Zod for run-trigger payload, suppression create, override write.

### API services
- `packages/api/src/services/review-checks/registry.service.ts` — read registry + resolve params.
- `packages/api/src/services/review-checks/orchestrator.service.ts` — `runForCompany(tenantId, companyId)` + `runForTenant(tenantId)`.
- `packages/api/src/services/review-checks/findings.service.ts` — read API + dedupe helper + audit emit.
- `packages/api/src/services/review-checks/suppressions.service.ts` — list/create/delete + matcher.
- `packages/api/src/services/review-checks/scheduler.service.ts` — `startCheckScheduler()` for the worker.
- `packages/api/src/services/review-checks/handlers/<check_key>.ts` — 13 handler files (one per check).
- `packages/api/src/services/review-checks/handlers/index.ts` — handler registry: `Record<string, Handler>`.

### API routes
- `packages/api/src/routes/review-checks.routes.ts` — endpoints:
  - `POST /api/v1/practice/checks/run` — on-demand trigger, body `{companyId?}`
  - `GET /api/v1/practice/checks/findings` — list (filters: severity, status, check, company)
  - `GET /api/v1/practice/checks/findings/:id` — single
  - `GET /api/v1/practice/checks/registry` — list registered checks
  - `GET /api/v1/practice/checks/runs` — recent run history
  - `POST /api/v1/practice/checks/suppressions` — create
  - `GET /api/v1/practice/checks/suppressions` — list
  - `DELETE /api/v1/practice/checks/suppressions/:id` — remove
  - `PUT /api/v1/practice/checks/overrides/:checkKey` — set per-(tenant,company) param override

### Tests
- `packages/api/src/services/review-checks/orchestrator.service.test.ts` — dedupe, suppression filter, override merge, run-cap.
- One handler test file per check: `services/review-checks/handlers/<check_key>.test.ts`. 13 files; each a focused fixture.
- `packages/api/src/routes/review-checks.routes.test.ts` — auth/role/flag, all endpoints.
- `packages/api/src/db/migrations/0068_review_checks.sql` round-trip via the existing scratch-DB pattern.

### Worker
- `packages/worker/src/index.ts` — call `startCheckScheduler()` alongside the other schedulers.

### Files modified
- `packages/api/src/app.ts` — mount the new router.
- `packages/api/src/db/schema/index.ts` + `packages/shared/src/index.ts` — export the new modules.
- `packages/api/src/db/migrations/meta/_journal.json` — register `0068_review_checks`.

---

## Schema migration

```sql
CREATE TABLE check_registry (
  check_key VARCHAR(80) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  handler_name VARCHAR(80) NOT NULL,
  default_severity VARCHAR(10) NOT NULL CHECK (default_severity IN ('low', 'med', 'high', 'critical')),
  default_params JSONB NOT NULL DEFAULT '{}',
  category VARCHAR(20) NOT NULL CHECK (category IN ('close', 'data', 'compliance')),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE check_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  company_id UUID,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  checks_executed INTEGER NOT NULL DEFAULT 0,
  findings_created INTEGER NOT NULL DEFAULT 0,
  truncated BOOLEAN NOT NULL DEFAULT FALSE,
  error TEXT
);
CREATE INDEX idx_check_runs_tenant ON check_runs (tenant_id, started_at DESC);

CREATE TABLE findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  company_id UUID,
  check_key VARCHAR(80) NOT NULL REFERENCES check_registry(check_key),
  transaction_id UUID,
  vendor_id UUID,
  severity VARCHAR(10) NOT NULL CHECK (severity IN ('low', 'med', 'high', 'critical')),
  status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'assigned', 'in_review', 'resolved', 'ignored')),
  assigned_to UUID,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolution_note TEXT
);
CREATE INDEX idx_findings_tenant_status ON findings (tenant_id, status);
CREATE INDEX idx_findings_tenant_check ON findings (tenant_id, check_key);
CREATE INDEX idx_findings_tenant_company ON findings (tenant_id, company_id);
CREATE INDEX idx_findings_open ON findings (tenant_id) WHERE status = 'open';

CREATE TABLE finding_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  finding_id UUID NOT NULL REFERENCES findings(id) ON DELETE CASCADE,
  from_status VARCHAR(20),
  to_status VARCHAR(20) NOT NULL,
  user_id UUID,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_finding_events_finding ON finding_events (finding_id, created_at);

CREATE TABLE check_suppressions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  company_id UUID,
  check_key VARCHAR(80) NOT NULL REFERENCES check_registry(check_key),
  match_pattern JSONB NOT NULL,
  reason TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ
);
CREATE INDEX idx_suppressions_tenant_check ON check_suppressions (tenant_id, check_key);

CREATE TABLE check_params_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  company_id UUID,
  check_key VARCHAR(80) NOT NULL REFERENCES check_registry(check_key),
  params JSONB NOT NULL,
  UNIQUE (tenant_id, company_id, check_key)
);

-- Seed the 13 stock checks
INSERT INTO check_registry (check_key, name, description, handler_name, default_severity, default_params, category) VALUES
  ('parent_account_posting',                'Direct posting to parent account',     'parent_account_posting',                'med',  '{}',                            'data'),
  ('missing_attachment_above_threshold',    'Missing attachment',                   'missing_attachment_above_threshold',    'low',  '{"thresholdAmount":75}',        'compliance'),
  ('uncategorized_stale',                   'Uncategorized bank-feed items',         'uncategorized_stale',                   'med',  '{"olderThanDays":14}',          'close'),
  ('auto_posted_by_rule_sampling',          'Auto-posted by rule (sample)',          'auto_posted_by_rule_sampling',          'low',  '{"samplePercent":0.10}',        'data'),
  ('tag_inconsistency_vs_history',          'Tag inconsistent with vendor history',  'tag_inconsistency_vs_history',          'low',  '{}',                            'data'),
  ('transaction_above_materiality',         'Above materiality threshold',           'transaction_above_materiality',         'high', '{"thresholdAmount":10000}',     'close'),
  ('duplicate_candidate',                   'Possible duplicate transaction',        'duplicate_candidate',                   'high', '{"windowDays":7}',              'data'),
  ('round_dollar_above_threshold',          'Round-dollar amount',                   'round_dollar_above_threshold',          'low',  '{"thresholdAmount":500}',       'data'),
  ('weekend_holiday_posting',               'Weekend or holiday posting',            'weekend_holiday_posting',               'low',  '{}',                            'close'),
  ('negative_non_liability',                'Negative balance on non-liability',     'negative_non_liability',                'high', '{}',                            'data'),
  ('closed_period_posting',                 'Posting in a closed period',            'closed_period_posting',                 'critical', '{}',                       'close'),
  ('vendor_1099_threshold_no_w9',           '1099 vendor over threshold w/o W-9',    'vendor_1099_threshold_no_w9',           'med',  '{"thresholdAmount":600}',       'compliance'),
  ('missing_required_customer',             'Customer required but missing',         'missing_required_customer',             'med',  '{}',                            'data');
```

Additive — no policy exception needed.

---

## Open questions

> If any need to resolve differently, stop me before Step 3.

1. **6 tables (5 plan + check_params_overrides as a separate table per plan §6.6).** Confirm.
2. **Scheduler via advisory-lock setInterval (every 30 min, ≥24h-since-last per company), not BullMQ cron.** Same as previous phases. Confirm.
3. **`closed_period_posting` shipped as a stub** (returns `[]`) until a close-lock feature exists. Confirm — alternative is to skip the check entirely from the registry seed.
4. **`weekend_holiday_posting` checks Sat/Sun only in v1**; full holiday calendar deferred. Confirm.
5. **`missing_required_class_location_customer` renamed to `missing_required_customer`** (class/location not in schema). Confirm.
6. **`vendor_1099_threshold_no_w9` triggers when contact has no `taxId`** (W-9 form workflow ships in Phase 12; this just flags the gap today). Confirm.
7. **Run cap of 5000 findings per tenant per run** — defends against runaway handlers. Confirm.
8. **Audit emit per finding** via existing `auditLog()` helper. Confirm — alternative is to skip per-finding audit (reduces audit-log volume).

---

## Implementation order

1. Shared types/schemas/constants
2. DB schema + migration + journal entry
3. Registry service + handler-index skeleton
4. Findings service (CRUD + dedupe helper + audit emit)
5. Suppressions service + matcher
6. Orchestrator service + tests
7. 13 handlers (one file each, ~30 LOC each)
8. Per-handler tests (one file each, focused fixture)
9. Routes + tests
10. Scheduler service + worker hook
11. Full suites green; completion report

Commit per step (`phase-6.N: brief`).

---

## Acceptance criteria

- [ ] All 26 6.x items implemented (with documented stubs/scope-trims for closed_period, holiday calendar, class/location)
- [ ] 13 handler files exist and have at least one positive + one negative test each
- [ ] Orchestrator dedupes by `(check_key, transaction_id, vendor_id, payload.dedupe_key)`
- [ ] Suppressions filter findings before insert
- [ ] Per-tenant + per-company params merge correctly
- [ ] Scheduler fires every 30 min via advisory lock, no double-runs
- [ ] On-demand `POST /run` endpoint works for owner/bookkeeper roles
- [ ] Findings emit audit-log entries
- [ ] Migration round-trips forward + backward; license headers + tsc green

---

**Tell me which open questions to overrule, or "continue" to take all eight as proposed.**
