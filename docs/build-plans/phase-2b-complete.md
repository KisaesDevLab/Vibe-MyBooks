# Phase 2b Complete — AI Categorization: UI

**Scope:** Build plan Phase 2 sub-sections 2.3, 2.4, 2.5 + 2.6 panel UI + Practice Settings page + e2e smoke + extended `approve` action.
**Builds on:** Phase 2a (data layer, API, pure bucket logic, backfill).
**Status:** ✅ All in-scope items implemented and verified.

---

## Checklist (verified)

### 2.3 Close Review page (build plan §2.3 — 5 items)
- [x] **`CloseReviewPage` component as Practice tab landing.** `packages/web/src/features/practice/close-review/CloseReviewPage.tsx`. Replaces the `CloseReviewPlaceholder` from Phase 1.
- [x] **Company switcher at top.** Reuses the global `useCompanyContext()` (the sidebar `CompanySwitcher` is the source of truth — no in-page duplicate).
- [x] **Close period selector (current month + prior 3).** `ClosePeriodSelector.tsx` + `buildClosePeriods()` helper. UTC-aligned month boundaries so timezone differences don't off-by-one bucket counts.
- [x] **Summary row.** `BucketSummaryRow.tsx` — 4 bucket tiles + Findings tile (Phase-6 placeholder) + total uncategorized (in the page header progress bar). Auto-High and Auto-Medium counts collapse into one "Auto Classifications" tile, with the High/Medium split exposed inside the bucket view.
- [x] **Tab navigation: Buckets | Findings | Manual Queue.** `CloseReviewPage.tsx` renders the three tabs; `BucketsTab.tsx`, `FindingsTab.tsx`, `ManualQueueTab.tsx` render the bodies.

### 2.4 Per-bucket review surfaces (build plan §2.4 — 4 items)
- [x] **Bucket 1 — Potential Matches.** `PotentialMatchesBucket.tsx` renders the shared `BucketTable` with the empty-state message that Phase 3 will populate the matcher.
- [x] **Bucket 2 — Rules.** `RulesBucket.tsx` groups items by `matched_rule_id` (populated in 2a's pipeline hook). Each group is collapsible; expanded group renders the shared `BucketTable` filtered by rule.
- [x] **Bucket 3 — Auto Classifications.** `AutoClassificationsBucket.tsx` with High / Medium sub-tabs. Each sub-tab drives a separate `BucketTable`; counts on the tab buttons come from the summary query so switching is instant. Per-row confidence badge.
- [x] **Bucket 4 — Needs Review.** `NeedsReviewBucket.tsx` renders the shared `BucketTable` with custom row details (new-vendor warning, multi-account warning, candidate count, "Vendor info" button) plus a slide-in `VendorEnrichmentPanel` drawer for the focused row.

### 2.5 Review actions (build plan §2.5 — 7 items)
- [x] **Bulk-select with header checkbox.** `BulkActionBar.tsx` + per-row checkboxes in `BucketTable.tsx`. Header has both an explicit "Select all" button and a checkbox in the table header for screen-reader semantics.
- [x] **"Approve selected".** Wired to `useApprove()` mutation. Calls the backend `POST /approve`, which now actually posts ledger transactions via the existing `bankFeedService.categorize()` path and stamps `transaction_id` on the state row (extension of 2a's stub).
- [x] **"Approve all" per bucket.** `useApproveAll()` mutation. `auto_high` requires native confirm dialog (`ConfirmDialog`); other buckets approve immediately. Server-side enforcement of `confirm: true` for `auto_high` already shipped in 2a.
- [x] **"Send back" reclassify.** Per-row "Send back" button in `BucketTable.tsx` reclassifies to `needs_review` via `useReclassify()`. Reasoning blob records the manual override. (Hidden when already in `needs_review`.)
- [x] **"Ask Client" placeholder.** `AskClientButton.tsx` renders disabled with a tooltip explaining Phase 8 lands the real flow. Client-clicks would 501 against the 2a placeholder endpoint.
- [x] **Keyboard shortcuts.** `useReviewKeyboardShortcuts.ts` hook: `Space` toggle-select focused row, `Enter` approve focused row, `A` approve all in current bucket. Scoped to focus-inside-the-list so browser defaults aren't hijacked. Ignores Ctrl+A so browser select-all still works.
- [x] **Progress bar.** `ProgressBar.tsx` rendered in `CloseReviewPage` header showing total remaining vs total in close period.

### 2.6 Vendor enrichment (build plan §2.6 — 4 items: 2 done in 2a, 2 done here)
- [x] **`vendor_enrichment_cache` table** (2a)
- [x] **AI call abstraction** (2a — stubbed, returns `null`)
- [x] **Cache enrichment result on the state row** — handled by 2a's `vendor-enrichment.service.ts` `lookup()` (cache-first, AI on miss). Real call lands in a future mini-phase.
- [x] **Render vendor info panel.** `VendorEnrichmentPanel.tsx` consumes `useVendorEnrichment()`. When source is `none` (current stub), renders an "Enrichment unavailable" friendly message; when source is `cache` or `ai`, renders the enrichment payload.

### Plus (planned in 2b only, beyond build-plan §2.x checklist)
- [x] **Backend `approve` action posts transactions.** `practice-classification.service.ts > approveSelected` extended to call `bankFeedService.categorize()` and stamp `transaction_id`. Rows with no `suggestedAccountId` fail cleanly with `reason: 'missing_suggested_account'`.
- [x] **Practice Settings page.** `/practice/settings` — owner-only, gated by `AI_BUCKET_WORKFLOW_V1`. Form for the four classification thresholds with client-side validation.
- [x] **`PracticeLayout` rewritten** to do role/flag checks directly rather than via the catalog filter (the catalog had no entry for `/practice/settings`).
- [x] **Real bug fixed**: the original `useEffect([data?.classificationThresholds])` would fire on every TanStack background refetch (different object reference each time). Replaced with primitive-value deps so the effect only runs on actual value change.
- [x] **e2e smoke** at `e2e/tests/practice-close-review.spec.ts`. API-level (mirrors `ai-consent.spec.ts`); covers register → summary shape → settings GET/PUT → approve 400.

---

## Files created (Phase 2b)

| File | LOC |
|---|---|
| `packages/web/src/api/hooks/useClassificationState.ts` | 132 |
| `packages/web/src/api/hooks/usePracticeSettings.ts` | 41 |
| `packages/web/src/features/practice/close-review/CloseReviewPage.tsx` | 138 |
| `packages/web/src/features/practice/close-review/ClosePeriodSelector.tsx` | 56 |
| `packages/web/src/features/practice/close-review/BucketSummaryRow.tsx` | 124 |
| `packages/web/src/features/practice/close-review/BucketsTab.tsx` | 41 |
| `packages/web/src/features/practice/close-review/FindingsTab.tsx` | 17 |
| `packages/web/src/features/practice/close-review/ManualQueueTab.tsx` | 17 |
| `packages/web/src/features/practice/close-review/BulkActionBar.tsx` | 119 |
| `packages/web/src/features/practice/close-review/ProgressBar.tsx` | 28 |
| `packages/web/src/features/practice/close-review/AskClientButton.tsx` | 21 |
| `packages/web/src/features/practice/close-review/useReviewKeyboardShortcuts.ts` | 60 |
| `packages/web/src/features/practice/close-review/VendorEnrichmentPanel.tsx` | 71 |
| `packages/web/src/features/practice/close-review/buckets/BucketTable.tsx` | 207 |
| `packages/web/src/features/practice/close-review/buckets/PotentialMatchesBucket.tsx` | 23 |
| `packages/web/src/features/practice/close-review/buckets/RulesBucket.tsx` | 100 |
| `packages/web/src/features/practice/close-review/buckets/AutoClassificationsBucket.tsx` | 96 |
| `packages/web/src/features/practice/close-review/buckets/NeedsReviewBucket.tsx` | 81 |
| `packages/web/src/features/practice/settings/PracticeSettingsPage.tsx` | 168 |
| `packages/web/src/features/practice/close-review/ClosePeriodSelector.test.ts` | 32 |
| `packages/web/src/features/practice/close-review/BucketSummaryRow.test.tsx` | 56 |
| `packages/web/src/features/practice/close-review/CloseReviewPage.test.tsx` | 71 |
| `packages/web/src/features/practice/close-review/useReviewKeyboardShortcuts.test.tsx` | 87 |
| `packages/web/src/features/practice/settings/PracticeSettingsPage.test.tsx` | 70 |
| `e2e/tests/practice-close-review.spec.ts` | 87 |
| `docs/build-plans/phase-2b-plan.md` | 130 |
| `docs/build-plans/phase-2b-complete.md` | (this file) |

**Files created: 27. Tests added: 22 (close-review × 19, settings × 3) + 1 e2e spec.**

## Files deleted

- `packages/web/src/features/practice/placeholders/CloseReviewPlaceholder.tsx` — replaced by `CloseReviewPage`.

## Files modified

| File | Change |
|---|---|
| `packages/api/src/services/practice-classification.service.ts` | `approveSelected` now actually posts transactions |
| `packages/api/src/routes/practice-classification.routes.ts` | Pass `req.userId` to approve service |
| `packages/api/src/routes/practice-classification.routes.test.ts` | Updated approve tests for new "missing_suggested_account" semantics |
| `packages/shared/src/constants/classification-thresholds.ts` | Type widened from literal `as const` to `interface` so spreads work cleanly |
| `packages/web/src/App.tsx` | Wire `CloseReviewPage` + `PracticeSettingsPage`; remove `CloseReviewPlaceholder` import |
| `packages/web/src/features/practice/PracticeLayout.tsx` | Direct role/flag check; no longer requires a catalog entry per route |

---

## Tests

| Suite | Count | Result |
|---|---|---|
| `useReviewKeyboardShortcuts.test.tsx` | 7 | ✅ |
| `BucketSummaryRow.test.tsx` | 5 | ✅ |
| `ClosePeriodSelector.test.ts` | 3 | ✅ |
| `CloseReviewPage.test.tsx` | 4 | ✅ |
| `PracticeSettingsPage.test.tsx` | 3 | ✅ |
| **New in 2b** | **22** | — |
| **Full web suite** | **226** (was 204) | ✅ |
| **Full API suite** | 1020 (unchanged from 2a) | ✅ |

Build / housekeeping checks:
- `tsc -b` (shared + api + web) — green.
- `npm run license:headers` — "All source files have license headers."
- `npm run migrations:check` — clean.
- Vite production build — green (only pre-existing chunk-size warning).

---

## Bugs fixed during 2b implementation

1. **Threshold-effect re-fire loop in `PracticeSettingsPage`.** The `useEffect([data?.classificationThresholds])` would re-fire on every TanStack background refetch because each refetch produces a new object reference. In tests, this surfaced as a worker-process OOM crash; in production it would have caused a cascade of `setState` calls every refetch. Fixed by depending on the four primitive values, not the parent object.
2. **`PracticeLayout` couldn't gate `/practice/settings`.** The original layout filtered the catalog (`PRACTICE_NAV_CATALOG`) for entries matching `flag` and `minRole`; `/practice/settings` wasn't in the catalog so the layout always redirected. Rewrote to perform role + flag checks directly. Catalog still drives the sidebar/breadcrumb but no longer gates routes.
3. **`ClassificationThresholds` literal type was too narrow.** Defined as `typeof X as const`, which made spreading partial overrides (`{ ...T, bucket4Floor: 0.5 }`) a type error. Widened to a proper `interface`.

---

## Deviations from plan (cumulative across 2a + 2b)

Same seven from `phase-2a-complete.md` plus:

8. **`approveSelected` now posts via `bankFeedService.categorize`.** This was the 2a-deferred work that 2b explicitly took on. No new deviation; just a phase-boundary decision documented for completeness.

---

## Pre-existing warnings noticed but not fixed

- React Router v7 future-flag deprecation warnings — pre-existing across the web suite.
- Vite chunk size > 600 KB — pre-existing.

---

## Acceptance criteria status

- [x] All 28 Phase 2 build-plan checklist items implemented (9 in 2a + 19 in 2b)
- [x] Close Review renders 4-bucket summary + working per-bucket lists
- [x] Bulk select, approve selected, approve all work end-to-end (post ledger transactions)
- [x] Reclassify and Send-back move rows between buckets
- [x] Ask-Client button renders disabled with tooltip
- [x] Keyboard shortcuts work when focused on bucket list
- [x] Progress bar shows X/Y for the active period
- [x] Vendor enrichment panel renders "Enrichment unavailable" when AI returns `source: 'none'`; renders cached data when present
- [x] Practice Settings page lets owner override thresholds with validation
- [x] `AI_BUCKET_WORKFLOW_V1` flag off → Buckets tab disabled; Findings/Manual Queue still visible
- [x] e2e Playwright spec written (covers API surface; UI smoke needed live dev stack to run, see runbook)
- [x] `tsc -b`, `license:headers`, `migrations:check` clean
- [x] API + web suites pass; coverage ≥ 80% on new code

---

## Phase 2 (combined 2a + 2b) — final summary

- **43 new files**, **15 modified**, **1 migration** (`0066_practice_classification`)
- **80 new tests** (58 backend + 22 frontend) — full suites at 1020 API / 226 web all green
- Closed loop on the 4-bucket workflow from data ingestion through UI to ledger posting
- Phase 3 (Potential Matches engine) unblocked — UI shell already renders empty state pending the matcher

**Ship-gate:** all conditions verified. ✅
