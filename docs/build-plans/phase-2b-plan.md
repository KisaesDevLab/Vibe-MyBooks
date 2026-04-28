# Phase 2b Plan — AI Categorization: UI

**Scope:** Build plan Phase 2 sub-sections 2.3, 2.4, 2.5, and the 2.6 panel UI (cache + stubbed pipeline already shipped in 2a).
**Builds on:** Phase 2a (schema, API routes, pure bucket logic, backfill).
**Feature flag:** `AI_BUCKET_WORKFLOW_V1` (gate already enforced on the API; the UI reads the flag via `useFeatureFlag`).
**State file:** `.practice-build-state.json` (currently `current_phase: 2, current_subphase: 'b'`).

---

## Objective

Replace the `CloseReviewPlaceholder` with a functional Close Review page. Bookkeepers can:
- Switch between companies and close periods (current month + prior 3).
- See bucket counts across the 4 Phase-2 buckets + Findings tab placeholder.
- Drill into each bucket, review rows, approve individually or in bulk.
- See AI reasoning + vendor enrichment (panel renders "Enrichment unavailable" until the real AI call lands; cache-first if any row exists).
- Toggle confidence threshold overrides via a Practice Settings sub-page.
- Navigate the review list via keyboard (Space select, Enter approve, A approve-all).

---

## Key implementation decisions

### D1 — `approve` endpoint actually posts transactions in 2b

The 2a `POST /approve` returned `{approved, failed}` but did not post transactions. 2b extends the service-level `approveSelected` to call the existing `bankFeedService.categorize()` for each row with a non-null `suggestedAccountId`, then stamp `transaction_classification_state.transaction_id` via the `stampTransactionId()` already shipped in 2a. Rows without a suggested account fail with `reason: 'missing_suggested_account'`.

This keeps the contract already documented in the 2a completion report and pushes the real ledger-posting integration into the UI phase where it belongs.

### D2 — Period selector dates

Plan says "current month + prior 3." Interpretation: four calendar-month options, each labeled by month name (e.g., "April 2026 (current)", "March 2026", "February 2026", "January 2026"). `periodStart` / `periodEnd` serialize as the first millisecond of the month and the first millisecond of the next month, so the summary/bucket list queries stay pure inclusive-start / exclusive-end.

### D3 — Company switcher reuses existing `CompanySwitcher`

We already have a `CompanySwitcher` in `packages/web/src/components/layout/`. The Close Review page reads the current company from the `CompanyProvider` context — no new switcher renders in-page; the existing sidebar one is the source of truth.

### D4 — Practice Settings: separate page, owner-only, linked from Close Review gear icon

Matches the decision from 2a planning. Lives at `/practice/settings`, gated by `AI_BUCKET_WORKFLOW_V1` + `minRole=owner`.

### D5 — Keyboard shortcuts scoped to the active bucket list

Shortcuts activate only when focus is inside the bucket table (`tabIndex={0}` on the container, listeners in a custom hook). Prevents conflict with browser shortcuts elsewhere.

### D6 — "Approve all" flow

For `auto_high` the UI requires a native confirm dialog (`ConfirmDialog` component exists in `packages/web/src/components/ui/`). The backend already enforces `confirm: true` server-side.

### D7 — e2e smoke test

One Playwright spec that registers a fresh tenant, enables `AI_BUCKET_WORKFLOW_V1`, seeds a bank feed item + state row, renders the Close Review page, asserts the bucket count appears. Keeps the smoke test fast.

---

## Files to create

### Frontend — Close Review page + sub-components
- `packages/web/src/features/practice/close-review/CloseReviewPage.tsx` — page root, replaces the placeholder.
- `packages/web/src/features/practice/close-review/ClosePeriodSelector.tsx` — 4-option month dropdown.
- `packages/web/src/features/practice/close-review/BucketSummaryRow.tsx` — 4 bucket tiles + findings + uncategorized total.
- `packages/web/src/features/practice/close-review/BucketsTab.tsx` — tab container for the 4 bucket views.
- `packages/web/src/features/practice/close-review/FindingsTab.tsx` — Phase-6 placeholder.
- `packages/web/src/features/practice/close-review/ManualQueueTab.tsx` — placeholder for rows that escaped triage.
- `packages/web/src/features/practice/close-review/buckets/PotentialMatchesBucket.tsx` — Bucket 1 empty-state aware (Phase 3 populates).
- `packages/web/src/features/practice/close-review/buckets/RulesBucket.tsx` — Bucket 2, grouped by `matched_rule_id`.
- `packages/web/src/features/practice/close-review/buckets/AutoClassificationsBucket.tsx` — Bucket 3 with High / Medium sub-tabs.
- `packages/web/src/features/practice/close-review/buckets/NeedsReviewBucket.tsx` — Bucket 4 with vendor enrichment drawer.
- `packages/web/src/features/practice/close-review/BulkActionBar.tsx` — select / approve / approve-all / send-back.
- `packages/web/src/features/practice/close-review/ProgressBar.tsx` — "X of Y remaining."
- `packages/web/src/features/practice/close-review/VendorEnrichmentPanel.tsx` — hits `GET /:stateId/vendor-enrichment`, handles `source: 'none'`.
- `packages/web/src/features/practice/close-review/AskClientButton.tsx` — disabled with tooltip.
- `packages/web/src/features/practice/close-review/useReviewKeyboardShortcuts.ts` — focus-scoped hook.

### Frontend — hooks + queries
- `packages/web/src/api/hooks/useClassificationState.ts` — `useSummary`, `useBucket`, `useApprove`, `useApproveAll`, `useReclassify`, `useVendorEnrichment`.
- `packages/web/src/api/hooks/usePracticeSettings.ts` — `useThresholds`, `useSetThresholds`.

### Frontend — Practice Settings page
- `packages/web/src/features/practice/settings/PracticeSettingsPage.tsx` — threshold override form (owner-only).

### Tests
- `packages/web/src/features/practice/close-review/CloseReviewPage.test.tsx` — renders each bucket variant (mocked hooks).
- `packages/web/src/features/practice/close-review/useReviewKeyboardShortcuts.test.ts` — Space/Enter/A mapping.
- `packages/web/src/features/practice/close-review/BucketSummaryRow.test.tsx` — tile rendering + counts.
- `packages/web/src/features/practice/settings/PracticeSettingsPage.test.tsx` — validation + submit.
- `e2e/tests/practice-close-review.spec.ts` — register → enable flag → seed data → render → assert summary.

### Backend (minor — approve action)
- `packages/api/src/services/practice-classification.service.ts` — extend `approveSelected` to post transactions via `categorize`.
- `packages/api/src/services/practice-classification.service.test.ts` — add tests for the posting path.
- `packages/api/src/routes/practice-classification.routes.test.ts` — add tests for the full approve flow.

---

## Files to modify

| File | Change |
|---|---|
| `packages/web/src/App.tsx` | Swap `CloseReviewPlaceholder` for `CloseReviewPage`; add `/practice/settings` route |
| `packages/web/src/features/practice/placeholders/CloseReviewPlaceholder.tsx` | Delete (no longer referenced) |
| `packages/api/src/services/practice-classification.service.ts` | `approveSelected` now posts transactions + stamps `transaction_id` |

---

## Acceptance criteria

- [ ] All 28 Phase 2 build-plan checklist items implemented (9 already satisfied in 2a; 19 in 2b)
- [ ] Close Review renders 4-bucket summary + working per-bucket lists
- [ ] Bulk select, approve selected, approve all work end-to-end (post ledger transactions)
- [ ] Reclassify and Send-back move rows between buckets
- [ ] Ask-Client button renders disabled with tooltip
- [ ] Keyboard shortcuts work when focused on bucket list
- [ ] Progress bar shows X/Y for the active period
- [ ] Vendor enrichment panel renders "Enrichment unavailable" when AI returns `source: 'none'`; renders cached data when present
- [ ] Practice Settings page lets owner override thresholds with validation
- [ ] `AI_BUCKET_WORKFLOW_V1` flag off → Close Review renders only Findings/Manual Queue tabs (Buckets tab disabled)
- [ ] Playwright smoke test passes
- [ ] `tsc -b`, `license:headers`, `migrations:check` clean
- [ ] Full API + web test suites pass; coverage ≥ 80% on new UI code

---

**No open questions. Proceeding to implementation.**
