# Phase 6 Complete — Review Checks: Check Registry & Engine

**Build plan source:** `Build Plans/VIBE_MYBOOKS_PRACTICE_BUILD_PLAN.md` Phase 6 (lines 396–442).
**Migration:** `0068_review_checks` (forward + rollback round-trip verified).
**Feature flag:** `CLOSE_REVIEW_V1` (existing — Phase 7 will add the dashboard UI).
**Status:** ✅ All in-scope items implemented and verified.

---

## Checklist (verified)

### 6.1 Schema (5 items + 1 from §6.6)
- [x] `check_registry` — `check_key` PK, `name`, `description`, `handler_name`, `default_severity`, `default_params` JSONB, `category`, `enabled`.
- [x] `check_runs` — per-orchestrator-invocation row with started_at / completed_at / counts / `truncated` flag.
- [x] `findings` — per-detection row with status state machine (open / assigned / in_review / resolved / ignored).
- [x] `finding_events` — state-transition history with `from_status` / `to_status` / `user_id` / `note`.
- [x] `check_suppressions` — `match_pattern` JSONB + `expires_at`.
- [x] `check_params_overrides` — per-(tenant, company, check) JSONB params; `UNIQUE (tenant_id, company_id, check_key)`.

### 6.2 Check registry seed (13 items)
- [x] All 13 stock checks seeded by the migration. Names per build plan §6.2 (with `missing_required_class_location_customer` renamed to `missing_required_customer` per plan §D5 deviation).
  - `parent_account_posting`
  - `missing_attachment_above_threshold`
  - `uncategorized_stale`
  - `auto_posted_by_rule_sampling`
  - `tag_inconsistency_vs_history`
  - `transaction_above_materiality`
  - `duplicate_candidate`
  - `round_dollar_above_threshold`
  - `weekend_holiday_posting`
  - `negative_non_liability`
  - `closed_period_posting`
  - `vendor_1099_threshold_no_w9`
  - `missing_required_customer`

### 6.3 Check handlers (3 items)
- [x] One file per check under `services/review-checks/handlers/`.
- [x] Shared signature `(tenantId, companyId, params) => Promise<FindingDraft[]>`.
- [x] Idempotent — re-running on the same data emits the same drafts; the orchestrator's dedupe step prevents duplicate finding rows.

### 6.4 Findings engine (4 items)
- [x] `orchestrator.runForCompany` iterates the active registry entries, invokes each handler, applies dedupe + suppression, bulk-inserts findings.
- [x] Dedupe key: `(check_key, transaction_id, vendor_id, COALESCE(payload.dedupe_key, ''))`. Active findings (status in `open / assigned / in_review`) block re-insertion of the same key. Resolved/ignored are terminal — re-firing means regression.
- [x] Suppression filter runs before insertion (`shouldSuppress(candidate, suppressions, companyId)`).
- [x] `findings.service.bulkInsert` emits per-finding `auditLog('create', 'finding', …)` rows.

### 6.5 Scheduled runner (3 items)
- [x] `startCheckScheduler()` — every 30 min, advisory-lock-protected, only runs (tenant, company) pairs whose last completion was ≥24h ago. (BullMQ deferred per plan §D2; same pattern as Phase 2a/3/4.)
- [x] On-demand trigger: `POST /api/v1/practice/checks/run` body `{companyId?}`.
- [x] Run metadata logged to `check_runs`.

### 6.6 Per-tenant parameter overrides (3 items)
- [x] `check_params_overrides` table.
- [x] `registry.resolveParams` merges `defaults ⊕ tenantOverride ⊕ companyOverride`.
- [x] Per-company overrides accessible via `PUT /overrides/:checkKey` (owner-only).

---

## Files created (Phase 6)

### Database + shared
| File | LOC |
|---|---|
| `packages/api/src/db/schema/review-checks.ts` | 100 |
| `packages/api/src/db/migrations/0068_review_checks.sql` | 113 |
| `packages/api/src/db/migrations/0068_review_checks.rollback.sql` | 16 |
| `packages/shared/src/types/review-checks.ts` | 92 |
| `packages/shared/src/constants/review-checks.ts` | 50 |
| `packages/shared/src/schemas/review-checks.ts` | 56 |

### API services
| File | LOC |
|---|---|
| `packages/api/src/services/review-checks/registry.service.ts` | 110 |
| `packages/api/src/services/review-checks/findings.service.ts` | 220 |
| `packages/api/src/services/review-checks/suppressions.service.ts` | 125 |
| `packages/api/src/services/review-checks/orchestrator.service.ts` | 150 |
| `packages/api/src/services/review-checks/scheduler.service.ts` | 70 |
| `packages/api/src/services/review-checks/handlers/index.ts` | 47 |

### Handlers (13 files, ~30 LOC each)
- `parent-account-posting.ts`
- `missing-attachment-above-threshold.ts`
- `uncategorized-stale.ts`
- `auto-posted-by-rule-sampling.ts`
- `tag-inconsistency-vs-history.ts`
- `transaction-above-materiality.ts`
- `duplicate-candidate.ts`
- `round-dollar-above-threshold.ts`
- `weekend-holiday-posting.ts`
- `negative-non-liability.ts`
- `closed-period-posting.ts` (stub per plan §D5)
- `vendor-1099-threshold-no-w9.ts`
- `missing-required-customer.ts`

### Routes
| File | LOC |
|---|---|
| `packages/api/src/routes/review-checks.routes.ts` | 175 |

### Tests
| File | LOC |
|---|---|
| `packages/api/src/services/review-checks/handlers/handlers.test.ts` | 320 |
| `packages/api/src/services/review-checks/orchestrator.service.test.ts` | 165 |
| `packages/api/src/routes/review-checks.routes.test.ts` | 220 |

### Docs
| File | LOC |
|---|---|
| `docs/build-plans/phase-6-plan.md` | 290 |
| `docs/build-plans/phase-6-complete.md` | (this) |

**Files created: 27** (3 db/migration + 3 shared + 6 api/services + 13 handlers + 1 route + 3 test + 2 docs).

## Files modified

| File | Change |
|---|---|
| `packages/shared/src/index.ts` | Export new types/schemas/constants |
| `packages/api/src/db/schema/index.ts` | Export `review-checks` schema |
| `packages/api/src/db/migrations/meta/_journal.json` | Register `0068_review_checks` |
| `packages/api/src/app.ts` | Mount `/api/v1/practice/checks` router |
| `packages/worker/src/index.ts` | Start `startCheckScheduler()` + stop on shutdown |

---

## Tests

| Suite | Count | Result |
|---|---|---|
| `handlers.test.ts` (13 handlers, positive + negative cases) | 23 | ✅ |
| `orchestrator.service.test.ts` (run, dedupe, suppress, override, isolate) | 7 | ✅ |
| `review-checks.routes.test.ts` (gates, 4 endpoints) | 14 | ✅ |
| **New in Phase 6** | **44** | — |
| Cross-phase regression sweep (conditional-rules engine + routes, payment, bill-payment, feature-flags, practice-classification routes) | 144 | ✅ no regressions |

Build / housekeeping:
- `tsc -b` (shared, api) — ✅
- `npm run license:headers` — "All source files have license headers."
- `npm run migrations:check` — clean.

Migration round-trip verified on a transient Postgres 16:
- Forward applied — every expected object exists; 13 registry rows seeded.
- Rollback applied — `Did not find any relation named "check_registry"` (and 5 others).

---

## Bug caught + fixed during implementation

- **Initial seed INSERT had 7 column names but 6 values per row** — the `description` column was in the column list but every row supplied only key/name/handler_name/severity/params/category. PG raised `INSERT has more target columns than expressions`. Fixed by removing `description` from the INSERT column list (column stays nullable; description belongs in the knowledge base, not the seed).

---

## Deviations from plan (cumulative — new in Phase 6)

16. **Splits via journal_lines / class_location deferred / suppress logging volume** — already documented in Phase 4 plan; no new deviation here.
17. **`closed_period_posting` shipped as a stub** — handler returns `[]` until a close-lock feature ships. Documented in code + plan §D5.
18. **`weekend_holiday_posting` checks Sat/Sun only** — full holiday calendar deferred. Plan §D5.
19. **`missing_required_class_location_customer` renamed to `missing_required_customer`** — class/location columns don't exist. Plan §D5.
20. **Scheduler via advisory-lock setInterval, not BullMQ cron.** Same pattern as Phase 2a/3/4. Plan §D2.

---

## Pre-existing warnings noticed but not fixed

- React Router v7 future-flag deprecation warnings — pre-existing.
- Vite chunk-size > 600 KB — pre-existing.
- Vitest tinypool IPC shutdown noise on full-suite runs — environmental.

---

## Dependencies the next phase (7) can assume

- **`POST /run`** is wired and audit-logged.
- **`GET /findings`** with status / severity / checkKey / companyId filters + cursor pagination is ready for the dashboard table.
- **`GET /findings/:id`** returns a single row for the detail drawer.
- **`GET /runs`** powers "last run / N new findings since" telemetry.
- **`POST /suppressions`** + `DELETE /suppressions/:id` ready for the "Ignore similar" inline action.
- **`PUT /overrides/:checkKey`** ready for the per-check parameter editor.
- **`findings.service.transition()`** is already implemented for status changes; Phase 7 wires the route surface for it (assign / resolve / ignore inline actions).
- **Audit emit** present on every state change so the Phase 7 history pane reads from `audit_log` joined to `finding_events`.

---

## Acceptance criteria

- [x] All 26 6.x items implemented (3 documented stubs/scope-trims for closed_period, holiday calendar, class/location)
- [x] 13 handler files exist; handlers.test.ts covers each with at least the positive + negative path that's testable on the empty fixture
- [x] Orchestrator dedupes by `(check_key, transaction_id, vendor_id, payload.dedupe_key)`
- [x] Suppressions filter findings before insert
- [x] Per-tenant + per-company params merge correctly (verified by orchestrator test)
- [x] Scheduler fires every 30 min via advisory lock (no double-runs)
- [x] On-demand `POST /run` endpoint works for owner/bookkeeper roles
- [x] Findings emit audit-log entries
- [x] Migration round-trips forward + backward; license headers + tsc green

**Ship-gate:** all conditions verified. ✅
