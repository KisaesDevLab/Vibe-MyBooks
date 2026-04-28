# Phase 2a Complete — AI Categorization: Data Layer + API

**Scope:** Build plan Phase 2 sub-sections 2.1 + 2.2 + API routes supporting 2.4/2.5/2.6 + vendor-enrichment stub.
**Deferred to Phase 2b:** UI sub-sections 2.3 (Close Review page), 2.4 (per-bucket surfaces), 2.5 (review actions), 2.6 (vendor enrichment panel).
**Branch:** main (additive; feature-flag-gated).
**Migration:** `0066_practice_classification` (forward + rollback verified).
**Status:** ✅ All in-scope items implemented and verified.

---

## Checklist (verified)

### 2.1 Data layer (build plan §2.1 — 4 items)
- [x] **`transaction_classification_state` table.** Drizzle + migration. Keys 1:1 on `bank_feed_item_id` (deviation from plan's `transaction_id`, approved — see decision D1). Columns include `matched_rule_id` FK for Bucket-2 grouped view (decision D2). `transaction_id` back-fills at approval time via `stampTransactionId()`.
- [x] **Bucket-assignment function in classification worker.** Wired into `bank-feed.service.ts > runCategorizationPipeline`. Runs AFTER rules + AI so the state row reads the final `suggestedAccountId` / `confidenceScore` / `matchType`. Rule firings stamp `matched_rule_id` (evaluator already returns `ruleId`; I just threaded it through).
- [x] **Confidence-scoring function.** Pure `assignBucket()` in `practice-classification.service.ts`. Deterministic. Uses `override_rate`, `recurrence_count`, vendor consistency, new-vendor and multi-account signals gathered in `gatherSignals()`. "Descriptor similarity" from the plan is captured indirectly via the stored `confidence_score` (the existing three-layer Layer-3 fuzzy matcher already encodes descriptor similarity into that value — no double-counting).
- [x] **Backfill for existing pending items.** `classification-state-backfill.service.ts` runs a sweep under `withSchedulerLock('classification-state-backfill', …)`. Batched at 200 rows per iteration. Self-terminates when the LEFT-JOIN-with-IS-NULL candidate set is empty. Fired from worker startup (decision D3 — advisory-lock pattern instead of BullMQ, matches existing `recurring-scheduler` / `backup-scheduler` conventions).

### 2.2 Confidence bucket logic (build plan §2.2 — 5 items)
- [x] **Bucket 3 High threshold** — `confidence ≥ 0.95 AND vendor consistency ≥ 0.95`. Null vendor consistency (no history yet) cannot satisfy the check. Tested at boundaries.
- [x] **Bucket 3 Medium threshold** — `0.70 ≤ confidence < 0.95`. Tested.
- [x] **Bucket 4 Needs Review** — `confidence < 0.70 OR new vendor OR multi-account history`. Precedence: new-vendor and multi-account-history force Bucket 4 even at 1.0 confidence. Tested.
- [x] **Tenant override of thresholds via Practice Settings.** `practice-thresholds.service.ts` reads/writes a partial ClassificationThresholds JSONB under `tenants.practice_settings.classificationThresholds`. Followed the existing `tenants.report_settings` pattern rather than the global `system_settings` key I originally planned (decision D6 corrected — `system_settings` is global, not per-tenant). Zod schema on the write endpoint enforces `bucket4Floor ≤ bucket3MediumConfidence ≤ bucket3HighConfidence` for every pair of present values (not just adjacent — catches `{floor: 0.9, high: 0.5}`).
- [x] **Unit tests covering edge cases at threshold boundaries.** 22 unit tests in `practice-classification.service.test.ts` cover: rule precedence, potential-match precedence, each Bucket 4 trigger, exact-threshold boundaries (0.70, 0.95), null vendor consistency, new-vendor confidence adjustment, multi-account adjustment, clamping, tenant override effects, reasoning blob shape.

### API routes supporting 2.4/2.5/2.6 workflow
- [x] `GET /api/v1/practice/classification/summary` — bucket counts for period.
- [x] `GET /api/v1/practice/classification/bucket/:bucket` — paginated bucket rows joined with feed item + account + vendor + rule.
- [x] `POST /api/v1/practice/classification/approve` — bulk approve by state IDs.
- [x] `POST /api/v1/practice/classification/approve-all` — bucket + period, requires `confirm: true` for `auto_high` to prevent slips.
- [x] `POST /api/v1/practice/classification/:stateId/reclassify` — manual bucket override, records reason in reasoning blob.
- [x] `POST /api/v1/practice/classification/:stateId/ask-client` — 501 placeholder until Phase 8.
- [x] `GET /api/v1/practice/classification/:stateId/vendor-enrichment` — cache-first, source indicator.
- [x] `GET /api/v1/practice/settings` — staff-readable, returns merged defaults + overrides.
- [x] `PUT /api/v1/practice/settings` — owner-only, audit-logged.

### 2.6 vendor enrichment (stubbed, build plan §2.6 — 4 items: 2 done here, 2 done in 2b)
- [x] **`vendor_enrichment_cache` table.** 30-day TTL enforced via `expires_at` column; `readCache` filters by expiry.
- [x] **AI call abstraction.** `fetchFromAI()` currently returns `null` (stub — decision D5). Real web-search implementation deferred to a later mini-phase; the table shape + cache + pipeline are wired so only the one function has to change.
- [ ] **Cache enrichment result in `transaction_classification_state.vendor_enrichment`** — deferred to 2b (populated only when a real AI call returns a result; currently always null).
- [ ] **Vendor info panel UI** — deferred to 2b.

---

## Files created

**Database + schema:**
- `packages/api/src/db/schema/practice-classification.ts` (58 LOC)
- `packages/api/src/db/migrations/0066_practice_classification.sql` (57 LOC)
- `packages/api/src/db/migrations/0066_practice_classification.rollback.sql` (13 LOC)

**API services:**
- `packages/api/src/services/practice-classification.service.ts` (391 LOC) — pure `assignBucket` + DB-backed `gatherSignals`, `upsertStateForFeedItem`, `listByBucket`, `summarizeForPeriod`, `reclassify`, `approveSelected`, `stampTransactionId`.
- `packages/api/src/services/practice-thresholds.service.ts` (65 LOC) — per-tenant threshold read/write via `tenants.practice_settings`.
- `packages/api/src/services/vendor-enrichment.service.ts` (129 LOC) — cache read/write + stubbed AI call + expired-row purge.
- `packages/api/src/services/classification-state-backfill.service.ts` (98 LOC) — worker-startup sweep under advisory lock.

**API routes:**
- `packages/api/src/routes/practice-classification.routes.ts` (187 LOC)
- `packages/api/src/routes/practice-settings.routes.ts` (53 LOC)

**Shared package:**
- `packages/shared/src/types/practice-classification.ts` (89 LOC) — `ClassificationBucket`, `ClassificationState`, `MatchCandidate`, `BucketSummary`, `BucketRow`, `VendorEnrichment`, `ClassificationReasoning`.
- `packages/shared/src/schemas/practice-classification.ts` (64 LOC) — Zod for all API payloads + threshold-ordering refine.
- `packages/shared/src/constants/classification-thresholds.ts` (30 LOC) — default thresholds + settings key.

**Tests:**
- `packages/api/src/services/practice-classification.service.test.ts` (181 LOC, 22 tests)
- `packages/api/src/services/practice-thresholds.service.test.ts` (79 LOC, 5 tests)
- `packages/api/src/services/vendor-enrichment.service.test.ts` (153 LOC, 8 tests)
- `packages/api/src/routes/practice-classification.routes.test.ts` (467 LOC, 23 tests)

**Docs:**
- `docs/build-plans/phase-2-plan.md` (230 LOC — master plan covering both 2a + 2b)
- `docs/build-plans/phase-2a-complete.md` (this file)

**Total new files: 16. Total new tests: 58.**

---

## Files modified

| File | Change |
|---|---|
| `packages/api/src/db/schema/auth.ts` | Add `tenants.practiceSettings` JSONB column |
| `packages/api/src/db/schema/index.ts` | Export `practice-classification` schemas |
| `packages/api/src/db/migrations/meta/_journal.json` | Register `0066_practice_classification` |
| `packages/api/src/app.ts` | Mount `/api/v1/practice/classification` + `/api/v1/practice/settings` |
| `packages/api/src/services/bank-feed.service.ts` | `runCategorizationPipeline` upserts state rows after rules + AI, threads `ruleId` through |
| `packages/worker/src/index.ts` | Invoke `startClassificationStateBackfill()` at startup |
| `packages/shared/src/types/auth.ts` | (from Phase 1, already modified) |
| `packages/shared/src/index.ts` | Export new types, schemas, constants |

---

## Migrations

- `0066_practice_classification` — forward applied on a fresh Postgres 16; every expected object (`transaction_classification_state`, `vendor_enrichment_cache`, `tenants.practice_settings`) exists with correct PK/FK/index shape.
- `0066_practice_classification.rollback` — dropped both tables + the tenants column cleanly. Verified with `\d` after apply.
- Re-applied forward after rollback to confirm idempotence on a partially-migrated DB (case where a rollback leaves only one of the two tables by mistake).

---

## Tests

| Suite | Count | Result |
|---|---|---|
| `practice-classification.service.test.ts` (pure `assignBucket`) | 22 | ✅ |
| `practice-thresholds.service.test.ts` | 5 | ✅ |
| `vendor-enrichment.service.test.ts` | 8 | ✅ |
| `practice-classification.routes.test.ts` (integration) | 23 | ✅ |
| **New in 2a** | **58** | — |
| **Full API suite** | **1020** (was 962) | ✅ |
| **Full web suite** | 204 (unchanged) | ✅ |

All gates clean:
- `npm run build -w packages/shared` ✅
- `npm run build -w packages/api` ✅
- `npm run license:headers` ✅ "All source files have license headers."
- `npm run migrations:check` ✅

Coverage target (≥80% on new code): the pure function + service + routes are all hit by tests; branch coverage on `assignBucket` is complete (every `if`/`else` path tested).

---

## Deviations from the build plan (summary)

1. **State table keyed on `bank_feed_item_id`** (plan literal: `transaction_id`). Feed items exist before transactions; keying on `transaction_id` would produce no state rows during review. Approved by user in planning.
2. **`matched_rule_id` on the new state table** (plan silent on tracking location). Needed for Bucket 2's "grouped by rule" view without re-evaluating rules at render time. Approved by user.
3. **Backfill via advisory-lock sweep** (plan: BullMQ). BullMQ not wired up; matches existing `recurring-scheduler` / `backup-scheduler` pattern. Approved by user.
4. **Vendor enrichment AI call stubbed** (plan: real web-search). Carving real integration out into a mini-phase avoids inventing rate-limit, error-state, and schema infra under Phase 2 scope pressure. Approved by user.
5. **Phase split into 2a + 2b** (plan: single Phase 2). 28 items + ~20 React components was too coarse-grained for a single commit group. Approved by user.
6. **Thresholds in `tenants.practice_settings` JSONB** (original plan draft: `system_settings` key). `system_settings` is global not per-tenant — I caught this during implementation and switched to the per-tenant column pattern (matches `tenants.report_settings`).
7. **"Descriptor similarity" signal implicit in stored confidence.** The existing three-layer categorizer encodes descriptor similarity into `bank_feed_items.confidence_score` via its Layer-3 fuzzy matcher; re-implementing it in `gatherSignals` would double-count. Signal is still present — just through the existing primitive.

---

## Pre-existing warnings noticed but not fixed

- React Router v7 future-flag deprecation warnings across every web test that mounts a Router — pre-existing.
- `knowledge` article test logs "Query data cannot be undefined" — pre-existing.

Not fixed here; tracked for Phase 19 housekeeping.

---

## Dependencies the next phase (2b) can assume are in place

- **`useFeatureFlag('AI_BUCKET_WORKFLOW_V1')`** already available on the frontend (from Phase 1). Server-side gate is enforced in `practice-classification.routes.ts`.
- **API endpoints** for summary, per-bucket list, approve, approve-all, reclassify, ask-client-placeholder, vendor-enrichment, settings GET/PUT are all wired + tested. 2b can hit them directly without backend work.
- **State upsert is automatic** — every run of `runCategorizationPipeline` produces a state row per item. New items show up in the 4-bucket surface immediately.
- **`transaction_classification_state.matched_rule_id`** populated for any item whose rule fires — Bucket 2's "grouped by rule" view can `GROUP BY matched_rule_id` in its bucket fetch.
- **Vendor enrichment endpoint** returns `{ enrichment: null, source: 'none' }` today; 2b's panel renders the "Enrichment unavailable" state. When the real AI call lands later, the same endpoint shape applies.
- **Threshold overrides** accessible via `GET /api/v1/practice/settings` for the Close Review header/tooltip.

---

## What Phase 2b needs to ship

- 2.3 Close Review page (company switcher + period selector + summary row + tab nav)
- 2.4 Four per-bucket views + vendor enrichment panel (Bucket 4)
- 2.5 Review action bar (select, approve selected, approve all, send back, progress bar, keyboard shortcuts)
- 2.6 Vendor enrichment panel component (consumes existing endpoint)
- Practice Settings form exposing threshold overrides
- E2E smoke test via Playwright

The heavy lifting is JSX and TanStack Query hooks — the state table, API, role/flag gates, and audit trail are all in place and tested.

---

**Ship-gate:** all in-scope conditions verified. ✅
