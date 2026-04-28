# Phase 2 Plan — AI Categorization: Bucket UI

**Build plan source:** `Build Plans/VIBE_MYBOOKS_PRACTICE_BUILD_PLAN.md` Phase 2 (lines 218–262), 28 items across 6 subsections
**Feature flag:** `AI_BUCKET_WORKFLOW_V1` (provisioned in Phase 1)
**State file:** `.practice-build-state.json` (currently `current_phase: 2`)
**Status:** Draft — awaiting approval

---

## Objective

Ship the **Close Review** landing page of the Practice tab with a 4-bucket surface that wraps the existing three-layer categorization. The scoring primitives (`categorizationHistory`, `bankFeedItems.confidenceScore`, `matchType`) already exist; Phase 2 is a thin computation + UX layer on top of them.

At the end of Phase 2:
- The `CloseReviewPlaceholder` is replaced with a real `CloseReviewPage` gated behind `AI_BUCKET_WORKFLOW_V1`.
- Every bank-feed item pending review has a row in `transaction_classification_state` with a bucket assignment and confidence score.
- A bookkeeper can select / approve / approve-all / reclassify items per bucket via keyboard or mouse.
- Vendor enrichment produces a "likely business type + suggested account + source URL" panel for the unknown-vendor case in Bucket 4.
- Bucket 1 (Potential Matches) renders the UI shell that Phase 3's matcher will populate — for Phase 2, Bucket 1 shows an empty state unless a bank-rule-like match already exists.

---

## Dependencies (verified against current repo state)

| Dependency | Status | Notes |
|---|---|---|
| Practice foundation (Phase 1) | ✅ Done | Feature flags, `PracticeLayout`, sidebar group all shipped |
| `AI_BUCKET_WORKFLOW_V1` flag | ✅ Provisioned | Phase 1 seeded it for every tenant |
| `bank_feed_items` table | ✅ Exists | `packages/api/src/db/schema/banking.ts:25` — `confidenceScore decimal(3,2)`, `matchType varchar(20)`, `status varchar(20)` |
| `categorization_history` learning layer | ✅ Exists | `packages/api/src/db/schema/ai.ts:182` — `timesConfirmed`, `timesOverridden`, keyed by `(tenantId, payeePattern)` |
| Three-layer categorization service | ✅ Exists | `packages/api/src/services/ai-categorization.service.ts` + `categorization-ai.service.ts` — outputs confidence + matchType |
| `bank_rules` table | ✅ Exists | `packages/api/src/db/schema/bank-rules.ts:7` — priority, conditions, assigned account/contact/memo/tag |
| AI orchestrator (for Bucket 4 vendor enrichment) | ✅ Exists | `packages/api/src/services/ai-orchestrator.service.ts` — multi-provider abstraction |
| Advisory-lock scheduler pattern | ✅ Exists | `packages/api/src/utils/scheduler-lock.ts:25` — `withSchedulerLock(name, fn)` |
| `CompanySwitcher` component | ✅ Exists | `packages/web/src/components/layout/CompanySwitcher.tsx` |
| `transaction_classification_state` table | ❌ Missing | Must create in Phase 2 |
| `vendor_enrichment_cache` table | ❌ Missing | Must create in Phase 2 |
| BullMQ for backfill job | ⚠️ Not wired up | CLAUDE.md confirms migration to BullMQ is deferred. Use the advisory-lock scheduler pattern for the backfill instead of adding BullMQ in this phase. |
| Bank-rule application tracking (which rule fired) | ❌ Missing | Bank-rule apply updates `bankFeedItems` with `matchType='rule'` but doesn't record `matched_rule_id`. Needed for Bucket 2 "grouped by rule" view. |

---

## Architectural decisions

### D1 — `transaction_classification_state` keyed by `bank_feed_item_id`, not `transaction_id`

Build plan Phase 2.1 says the table has a `transaction_id` column. In the actual data model, **at the time of classification there is no transaction** — items are pending `bank_feed_items` rows until a bookkeeper approves them, which *creates* a transaction. Keying by `transaction_id` only would mean no state exists while the item is in the review queue, defeating the purpose of the bucket surface.

**Decision:** `transaction_classification_state` keys primarily on `bank_feed_item_id` (1:1). A nullable `transaction_id` propagates forward when the feed item is approved and becomes a transaction. This preserves a full audit trail (what bucket was this in when it was approved?) while letting the surface function pre-posting.

This is a deviation from the literal plan language. Flagged in Open Questions for approval.

### D2 — Bucket 2 "grouped by rule" requires recording which rule fired

The bank-rule evaluator stamps `bankFeedItems.matchType='rule'` + `suggestedAccountId` but doesn't record WHICH rule fired. To render a bucket grouped by rule, we need either:
- Add `matched_rule_id` to `bank_feed_items` (or better, to the new state table)
- Re-evaluate at display time (expensive; would require rules engine call per render)

**Decision:** `transaction_classification_state.matched_rule_id uuid` (nullable, FK to `bank_rules`). Populated at the same point where `matchType='rule'` is stamped — we extend the existing rule-apply code path. For already-applied historical items, the backfill job can do a best-effort match back to the active rule set based on fields, but if ambiguous, groups them under a "Legacy (rule pre-dates tracking)" pseudo-bucket. This is pragmatic; the Phase 4 conditional-rules work will re-home rule-fire tracking anyway.

### D3 — Backfill via worker startup sweep, not BullMQ

Plan says "Backfill via BullMQ one-off job." BullMQ isn't wired up (CLAUDE.md confirms). Rather than introduce BullMQ as a side effect of Phase 2, use the existing `withSchedulerLock` pattern:
- Worker startup calls `startClassificationStateBackfill()` once.
- The function iterates `bank_feed_items` with `status='pending'` (or `categorizing`) and no corresponding state row, inserts state rows in batches.
- Advisory lock prevents concurrent backfills across API/worker.
- Self-terminates when the queue is empty.

Migration to BullMQ is called out in CLAUDE.md as a later-phase concern.

### D4 — Confidence scoring: reuse what's stored, don't recompute

The existing services already write `confidenceScore` to `bank_feed_items`. Phase 2's "confidence-scoring function" is a read-side pure function that:
1. Reads the stored `confidenceScore` as the baseline.
2. Adjusts by learning-layer signals from `categorization_history` (override rate) and `bank_feed_items` aggregate (recurrence count, descriptor similarity to prior accepted items).
3. Emits the final score and reasoning blob.

This function is pure (takes the input record + history rows, returns a number and reasoning) and fully unit-tested. It does NOT overwrite the stored `confidenceScore` — it's derived at assignment time from the state table's columns plus the learning join. This keeps us consistent with the build plan's principle that "scoring primitives already exist."

### D5 — Vendor enrichment defer-or-stub decision

Phase 2.6 calls for a web-search tool call via the AI abstraction. Checking `ai-orchestrator.service.ts` — the multi-provider abstraction exists but I need to verify web-search capability. Two scenarios:

- **If web-search is already wired:** build the real enrichment pipeline.
- **If it isn't:** implement a stub that returns `null` enrichment and renders an "Enrichment pending" state, with a TODO to enable once web-search lands. The `vendor_enrichment_cache` table ships regardless; the cache is just empty.

I'll audit `ai-orchestrator.service.ts` during Step 3 Day 1 and pick the branch. Open question #4.

### D6 — Tenant threshold overrides via `tenant_feature_flags`? no — via `system_settings` JSONB

Phase 2.2 item: "Tenant override of thresholds via Practice Settings." Options:
- Add a new `tenant_practice_settings` table (heavy)
- Reuse `system_settings` (tenant-scoped) — already used for SMTP, branding, etc.

**Decision:** reuse `system_settings` with a new key `practice.classification_thresholds` — JSONB payload containing `bucket3High`, `bucket3Medium`, `bucket4Floor`, each optional; falls back to plan defaults (0.95, 0.70, 0.70). Tenant-scoped reads already exist via `adminService.getSetting`. Values exposed via a `GET /api/v1/practice/settings` endpoint; writes through a dedicated route since changing thresholds is a staff-owner action with audit implications.

---

## Files to create

### Shared
- `packages/shared/src/types/practice-classification.ts` — `ClassificationBucket = 'potential_match' | 'rule' | 'auto_high' | 'auto_medium' | 'needs_review'`, `ClassificationState`, `MatchCandidate`, `BucketSummary`, `ReviewActionInput`.
- `packages/shared/src/schemas/practice-classification.ts` — Zod schemas for all API payloads (approve, approve-all, reclassify, settings).
- `packages/shared/src/constants/classification-thresholds.ts` — authoritative default threshold constants.

### Database
- `packages/api/src/db/schema/practice-classification.ts` — Drizzle schemas for `transaction_classification_state` and `vendor_enrichment_cache`.
- `packages/api/src/db/migrations/0066_practice_classification.sql` — create both tables, add `matched_rule_id` relationship (via the state table, not `bank_feed_items`), indexes.
- `packages/api/src/db/migrations/0066_practice_classification.rollback.sql`.
- Register in `meta/_journal.json`.

### API services
- `packages/api/src/services/practice-classification.service.ts` — pure functions:
  - `assignBucket(item, history, thresholds): {bucket, confidenceScore, reasoningBlob}`
  - `upsertState(tenantId, bankFeedItemId, assignment): Promise<ClassificationState>`
  - `listByBucket(tenantId, companyId, periodStart, periodEnd, bucket): Promise<{rows, total}>`
  - `summarizeForPeriod(tenantId, companyId, periodStart, periodEnd): Promise<BucketSummary>`
  - `approveSelected(tenantId, stateIds, userId): Promise<{approved, failed}>`
  - `reclassify(tenantId, stateId, newBucket, userId)`
- `packages/api/src/services/practice-classification.service.test.ts` — tests for `assignBucket` threshold boundaries, tenant override, reasoning blob shape.
- `packages/api/src/services/practice-thresholds.service.ts` — read/write tenant threshold overrides via `system_settings`; merges with defaults.
- `packages/api/src/services/practice-thresholds.service.test.ts`.
- `packages/api/src/services/vendor-enrichment.service.ts` — cache lookup, AI-call dispatcher (stubbed if web-search not wired), cache write with 30-day TTL.
- `packages/api/src/services/vendor-enrichment.service.test.ts` — cache hit, expiry, AI fallback.
- `packages/api/src/services/classification-state-backfill.service.ts` — one-shot worker sweep under advisory lock. Batches of 200 rows, exits when `bank_feed_items` with pending classification state is empty.

### API routes
- `packages/api/src/routes/practice-classification.routes.ts` — mounted at `/api/v1/practice/classification`:
  - `GET /summary?companyId&periodStart&periodEnd` — returns `BucketSummary`.
  - `GET /bucket/:bucket?companyId&periodStart&periodEnd&cursor&limit` — paginated rows.
  - `POST /approve` — body `{stateIds: string[]}`.
  - `POST /approve-all` — body `{bucket, companyId, periodStart, periodEnd}`.
  - `POST /:stateId/reclassify` — body `{bucket}`.
  - `POST /:stateId/ask-client` — placeholder returns 501 until Phase 8.
  - `GET /vendor-enrichment/:stateId` — hits cache, kicks off AI call on miss.
- `packages/api/src/routes/practice-settings.routes.ts` — `GET /api/v1/practice/settings`, `PUT /api/v1/practice/settings`.
- `packages/api/src/routes/practice-classification.routes.test.ts` — integration tests, auth, tenant isolation, role gating.

### Worker
- `packages/worker/src/index.ts` — import and call `startClassificationStateBackfill()`.

### Frontend

- `packages/web/src/features/practice/close-review/CloseReviewPage.tsx` — the landing page itself, mounted in `App.tsx` in place of `CloseReviewPlaceholder`.
- `packages/web/src/features/practice/close-review/ClosePeriodSelector.tsx` — current month + prior 3 dropdown.
- `packages/web/src/features/practice/close-review/BucketSummaryRow.tsx` — 4 bucket count tiles + uncategorized count + findings placeholder.
- `packages/web/src/features/practice/close-review/BucketsTab.tsx` — tab container for the 4 bucket views.
- `packages/web/src/features/practice/close-review/FindingsTab.tsx` — Phase 6 placeholder.
- `packages/web/src/features/practice/close-review/ManualQueueTab.tsx` — placeholder for transactions not triaged into any bucket.
- `packages/web/src/features/practice/close-review/buckets/PotentialMatchesBucket.tsx` — Bucket 1 view.
- `packages/web/src/features/practice/close-review/buckets/RulesBucket.tsx` — Bucket 2 view, grouped by rule.
- `packages/web/src/features/practice/close-review/buckets/AutoClassificationsBucket.tsx` — Bucket 3 with High/Medium sub-tabs.
- `packages/web/src/features/practice/close-review/buckets/NeedsReviewBucket.tsx` — Bucket 4.
- `packages/web/src/features/practice/close-review/BulkActionBar.tsx` — select-all, approve-selected, approve-all, send-back.
- `packages/web/src/features/practice/close-review/ProgressBar.tsx` — "X of Y remaining."
- `packages/web/src/features/practice/close-review/VendorEnrichmentPanel.tsx` — Bucket 4's vendor info box.
- `packages/web/src/features/practice/close-review/AskClientButton.tsx` — disabled placeholder until Phase 8.
- `packages/web/src/features/practice/close-review/useReviewKeyboardShortcuts.ts` — Space/Enter/A handler hook.
- `packages/web/src/api/hooks/useClassificationState.ts` — queries for summary, bucket, and mutations (approve, reclassify).
- `packages/web/src/features/practice/close-review/CloseReviewPage.test.tsx` — smoke test + per-bucket render.
- `packages/web/src/features/practice/close-review/useReviewKeyboardShortcuts.test.ts` — key handler unit tests.

### Settings UI (to expose threshold overrides)
- `packages/web/src/features/practice/PracticeSettingsPage.tsx` — minimal form exposing threshold overrides; mounted at `/practice/settings`, owner-role only, `AI_BUCKET_WORKFLOW_V1` gated.

---

## Files to modify

| File | Nature of change |
|---|---|
| `packages/api/src/db/schema/index.ts` | Export new `practice-classification` schemas |
| `packages/shared/src/index.ts` | Export new types, schemas, constants |
| `packages/api/src/app.ts` | Mount `/api/v1/practice/classification` and `/api/v1/practice/settings` routers |
| `packages/api/src/services/bank-rules.service.ts` | When a rule fires on a feed item, also upsert state with `matched_rule_id` + `bucket='rule'` |
| `packages/api/src/services/categorization-ai.service.ts` | After writing `confidenceScore`/`matchType`, call `assignBucket` → upsert state |
| `packages/api/src/services/ai-categorization.service.ts` | Same as above (wrap the post-categorization write) |
| `packages/api/src/services/bank-feed.service.ts` | On approve-to-transaction, set `transaction_classification_state.transaction_id` |
| `packages/web/src/App.tsx` | Replace `<CloseReviewPlaceholder />` with `<CloseReviewPage />`; add `/practice/settings` route |
| `packages/web/src/hooks/usePracticeVisibility.ts` | Add `settings` nav item or leave as owner-gated separate route (prefer: page not in sidebar, linked from Close Review header) |
| `packages/worker/src/index.ts` | Register `startClassificationStateBackfill()` call |

---

## Schema migrations

### `0066_practice_classification.sql`

```sql
CREATE TABLE transaction_classification_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  company_id UUID,
  bank_feed_item_id UUID NOT NULL REFERENCES bank_feed_items(id) ON DELETE CASCADE,
  transaction_id UUID,  -- filled in when item is approved into a transaction
  bucket VARCHAR(20) NOT NULL CHECK (bucket IN (
    'potential_match', 'rule', 'auto_high', 'auto_medium', 'needs_review'
  )),
  confidence_score DECIMAL(4,3) NOT NULL DEFAULT 0,
  suggested_account_id UUID,
  suggested_vendor_id UUID,
  matched_rule_id UUID REFERENCES bank_rules(id) ON DELETE SET NULL,
  reasoning_blob JSONB,
  model_used VARCHAR(100),
  match_candidates JSONB,
  vendor_enrichment JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (bank_feed_item_id)
);

CREATE INDEX idx_tcs_tenant_bucket ON transaction_classification_state (tenant_id, bucket);
CREATE INDEX idx_tcs_tenant_period ON transaction_classification_state (tenant_id, company_id, created_at);
CREATE INDEX idx_tcs_matched_rule ON transaction_classification_state (tenant_id, matched_rule_id) WHERE matched_rule_id IS NOT NULL;

CREATE TABLE vendor_enrichment_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  vendor_key VARCHAR(255) NOT NULL,  -- normalized description
  likely_business_type VARCHAR(100),
  suggested_account_type VARCHAR(50),
  source_url TEXT,
  summary TEXT,
  provider VARCHAR(50),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,  -- created_at + 30 days
  UNIQUE (tenant_id, vendor_key)
);

CREATE INDEX idx_vec_expiry ON vendor_enrichment_cache (tenant_id, expires_at);
```

Additive — no non-additive-exception marker required.

---

## New API endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/api/v1/practice/classification/summary` | Staff | Per-bucket counts for a period |
| `GET` | `/api/v1/practice/classification/bucket/:bucket` | Staff | Paginated rows for a bucket |
| `POST` | `/api/v1/practice/classification/approve` | Bookkeeper+ | Bulk approve selected state IDs |
| `POST` | `/api/v1/practice/classification/approve-all` | Bookkeeper+ (confirm required for auto_high) | Approve everything in a bucket |
| `POST` | `/api/v1/practice/classification/:stateId/reclassify` | Bookkeeper+ | Move to a different bucket manually |
| `POST` | `/api/v1/practice/classification/:stateId/ask-client` | Bookkeeper+ | 501 placeholder (Phase 8) |
| `GET` | `/api/v1/practice/classification/:stateId/vendor-enrichment` | Bookkeeper+ | Cached vendor info |
| `GET` | `/api/v1/practice/settings` | Staff | Current thresholds (defaults if no overrides) |
| `PUT` | `/api/v1/practice/settings` | Owner | Set threshold overrides |

All routes:
- Enforce `AI_BUCKET_WORKFLOW_V1` server-side via `featureFlagsService.isEnabled` (Phase 1 primitive).
- Emit audit-log entries on approve / reclassify / settings change.
- Use `req.tenantId` + `company_id` scoping — never trust client-supplied tenant.

---

## New UI routes

| Path | Component | Guards |
|---|---|---|
| `/practice/close-review` | `CloseReviewPage` (replacing placeholder) | `PracticeLayout` with `flag=CLOSE_REVIEW_V1, minRole=bookkeeper` |
| `/practice/settings` | `PracticeSettingsPage` | `PracticeLayout` with `flag=AI_BUCKET_WORKFLOW_V1, minRole=owner` |

Note: Close Review is primarily gated by `CLOSE_REVIEW_V1` (the landing page) but the bucket-workflow features inside it are gated by `AI_BUCKET_WORKFLOW_V1`. A tenant with Close Review on but Bucket Workflow off sees the Findings tab only (Phase 6) — not the Buckets tab. This interaction is flagged in Open Questions.

---

## Testing plan

| Area | Test file | Target |
|---|---|---|
| Pure `assignBucket` function | `practice-classification.service.test.ts` | 15+ tests at threshold boundaries, tenant override, reasoning blob shape |
| Threshold service | `practice-thresholds.service.test.ts` | 5+ tests for defaults, partial overrides, full overrides |
| Vendor enrichment | `vendor-enrichment.service.test.ts` | 8+ tests for cache hit, cache miss, expiry, AI fallback disabled |
| Backfill job | `classification-state-backfill.service.test.ts` | Idempotence, batch size, advisory lock contention |
| API routes | `practice-classification.routes.test.ts` | 15+ tests for auth, role, tenant isolation, feature-flag gate, approve/reclassify |
| Close Review page smoke | `CloseReviewPage.test.tsx` | Renders each bucket variant, loading / empty / populated states |
| Keyboard shortcuts | `useReviewKeyboardShortcuts.test.ts` | Space/Enter/A mapping, no-op when no row focused |

Target coverage: ≥80% on new code. Service-level pure functions are the highest-leverage test surface.

---

## Out of scope (explicitly deferred)

- **Bucket 1 matcher logic** (open-invoice/bill/JE/transfer matching) — Phase 3. Phase 2 only renders the UI shell; `match_candidates` JSONB stays empty until Phase 3 populates it.
- **Conditional rules engine** — Phase 4. Bucket 2 shows rules that fired via the existing legacy `bank_rules` table; conditional rules ship later.
- **Ask Client button functionality** — Phase 8. Button is disabled with a tooltip in Phase 2.
- **Findings tab content** — Phase 6. Placeholder only.
- **Published close-review reports to client portal** — Phase 7/13/14.
- **1099 integration** (1099 threshold check) — Phase 12.

---

## Open questions

> STOP if any of these should be answered differently from my assumptions.

1. **`transaction_classification_state` keyed by `bank_feed_item_id`, not `transaction_id`.** The build plan says the column is `transaction_id`. Our data model creates transactions only when bookkeepers approve feed items, so keying purely on `transaction_id` would mean no state row exists during the review queue — which defeats the feature. My proposed shape: primary key on `bank_feed_item_id`, nullable `transaction_id` that propagates forward on approval. Confirm.

2. **`matched_rule_id` on the new state table, not on `bank_feed_items`.** Keeping the tracking on the new state table means legacy columns stay untouched and the foreign key only lives where the bucket workflow needs it. Confirm.

3. **Backfill via worker startup sweep under advisory lock, not BullMQ.** CLAUDE.md confirms BullMQ migration is deferred. My approach matches the existing `withSchedulerLock` pattern for recurring/backup schedulers. Confirm — or flag if you'd like Phase 2 to introduce BullMQ.

4. **Vendor enrichment: audit AI orchestrator for web-search capability.** If it's already wired, build the real enrichment call. If not, ship a stub that returns `null` enrichment with a clear TODO, and the schema is ready for when web-search lands. I'll make this determination in Step 3 Day 1 of implementation and note the choice in the completion report.

5. **Tenant threshold overrides via `system_settings` JSONB row, not a new table.** Matches the existing pattern for SMTP / branding / tfa. Confirm.

6. **Close Review tab when `AI_BUCKET_WORKFLOW_V1` is off.** Plan's Phase 2 is explicitly gated by `AI_BUCKET_WORKFLOW_V1`. Separately, the Close Review sidebar item is gated by `CLOSE_REVIEW_V1`. If `CLOSE_REVIEW_V1` is on but `AI_BUCKET_WORKFLOW_V1` is off, users see Close Review but the Buckets tab renders a "feature disabled" state and only Findings / Manual Queue are visible. Confirm this degraded-mode behavior is acceptable, or simplify by requiring both flags for the tab to appear at all.

7. **"Approve selected" semantics.** The plan says approval "applies suggested classification, moves to `coded` status." Our model has no `coded` status on transactions — items go from `bank_feed_items.status='pending'` to `'matched'` or `'categorized'` once posted as a transaction. "Approve" in Phase 2 maps to: post the transaction using the suggested account/vendor/tag, set `bank_feed_items.status='matched'`, stamp `transaction_classification_state.transaction_id`, emit audit log. I'll use the existing bank-feed approval path (which already creates the transaction correctly) rather than inventing a parallel flow. Confirm.

8. **Practice Settings page placement.** Not in the sidebar (sidebar is already crowded); linked from a gear icon in the Close Review header. The page inherits `PracticeLayout` protections. Acceptable? If you'd rather have a sidebar entry, say so.

9. **Scope size.** 28 build-plan items + 2 structural additions (matched_rule_id tracking, threshold overrides service) + ~20 React components is a large but tractable phase. If you'd like to split it into Phase 2a (data layer + API) and Phase 2b (UI) — splitting by sub-section 2.1–2.2 vs 2.3–2.6 — tell me. Otherwise I'll ship it as one phase with one completion report.

---

## Implementation order (§Step 3)

Commit per sub-section (1.1-format: `phase-2.1: brief description`, etc.).

1. **2.1 data layer** — migration, schemas, service skeleton, backfill, wire in classification writers
2. **2.2 bucket-assignment pure function + tests** — threshold logic, reasoning blob
3. **2.3 Close Review page shell** — page component, company switcher, period selector, summary row, tab nav
4. **2.4 per-bucket surfaces** — one sub-commit per bucket (Bucket 1 empty, Bucket 2 grouped, Bucket 3 tabs, Bucket 4 with candidates)
5. **2.5 review actions** — bulk select, approve, approve-all, reclassify, keyboard shortcuts, progress bar
6. **2.6 vendor enrichment** — cache table, service, AI call (or stub), panel UI

Per sub-section: implement → add tests → run full suites → commit. The `phase-2.1: …` commit message convention matches Phase 1 except for the explicit phase number prefix.

---

## Risks + mitigations

| Risk | Mitigation |
|---|---|
| Writer-path changes to classification/rule services break existing tests | Run full `packages/api` suite after each writer-path change; the existing suite covers categorization and bank-rule apply |
| Backfill on a large tenant blocks startup | Batched inserts (200/tick), advisory-lock-protected, self-terminates when empty — worker continues even if backfill never finishes |
| Bucket counts get out of sync with actual bank_feed_items | Summary endpoint queries the state table directly; a drift detection test in the backfill re-reconciles if necessary. Alternatively compute summary by joining to bank_feed_items and treating missing state as `needs_review`. |
| AI enrichment call pegs the AI provider rate limit | Cache-first (30-day TTL), per-tenant concurrency cap of 5, skip cache-miss enrichment for non-Bucket-4 items |
| Threshold override UI lets a user set `bucket3High < bucket3Medium` | Zod schema enforces ordering: `needs_review_floor ≤ bucket3_medium ≤ bucket3_high ≤ 1.0` |
| Breadcrumb "Practice > Close Review > Buckets > Potential Matches" too deep | Render breadcrumb up to the page, use sub-tabs within the page; no breadcrumb crumbs for tab navigation |
| Keyboard shortcuts conflict with browser defaults | Only active when focus is on the review list (onFocus/onBlur toggle); Space still scrolls when focus is elsewhere |

---

## Acceptance criteria (ship-gate)

- [ ] All 28 build-plan checklist items implemented and verified
- [ ] `transaction_classification_state` + `vendor_enrichment_cache` migrations apply cleanly forward and backward
- [ ] Backfill job populates state rows for every existing `bank_feed_items` row; idempotent on re-run
- [ ] `assignBucket` pure function has ≥15 unit tests covering threshold boundaries and tenant overrides
- [ ] `CloseReviewPage` renders the 4-bucket surface with real data from the API
- [ ] Bulk approve, approve-all, reclassify, ask-client buttons all wired (ask-client shows "Coming soon")
- [ ] Keyboard shortcuts Space/Enter/A work on the review list
- [ ] Vendor enrichment cache hits on the second visit within 30 days
- [ ] Progress bar shows accurate "X of Y remaining" for the active close period
- [ ] `AI_BUCKET_WORKFLOW_V1` flag toggles the feature on/off — disabled state renders empty shell
- [ ] Audit trail captures approve / reclassify / threshold changes
- [ ] `pnpm test` + `tsc -b` + `license:headers` + `migrations:check` all clean
- [ ] Coverage ≥80% on new code

---

**Ready to proceed on approval of open questions above.**
