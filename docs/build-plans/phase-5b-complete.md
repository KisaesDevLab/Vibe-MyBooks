# Phase 5b Complete — Conditional Rules UI: Sandbox + Stats + Suggestions + I/O

**Scope:** Build plan Phase 5 sub-sections 5.5, 5.6, 5.7, 5.8 (10 items, with QBO CSV import explicitly stubbed per plan §D7).
**Builds on:** Phase 5a (rules list + visual builder).
**Status:** ✅ All in-scope items implemented and verified.

---

## Checklist (verified)

### 5.5 Testing sandbox (5 items)
- [x] **"Test rule" tab within rule editor** — `SandboxTab` rendered as one of three tabs in `RuleBuilderModal` (Builder / Sandbox / Stats).
- [x] **Paste or select sample transaction** — dropdown sourced by `GET /sandbox/recent-samples` returns last 25 feed items.
- [x] **Evaluator runs; UI highlights matched conditions** — `traceCondition` engine helper produces a per-node trace; `ConditionTrace` component renders ✓/✗ pills recursively.
- [x] **Shows final action set** — green "Actions that would apply" panel below the trace when matched.
- [x] **Batch mode "test against last 100"** — `runOnLast100` service method; UI renders `totalMatched / totalScanned` + first-10 sample hits.

### 5.6 Rule stats (2 items)
- [x] **Stats panel** — `StatsTab`. Four-tile summary (total / 30d / 7d / override rate) + last-fired timestamp.
- [x] **Paginated audit log** — `useRuleAudit` cursor-based pagination (50/page); table shows matched_at, feed-item / transaction link, applied actions, was-overridden flag. Drill-down link to `/transactions/:id` for any audit row with a transaction id.

### 5.7 Auto-suggest (3 items)
- [x] **Detection logic** — `rule-suggestions.service > detectSuggestions`. Scans `categorization_history` for `(payeePattern, accountId)` pairs with `timesConfirmed >= 5 AND override_rate < 10%`; filters out patterns already covered by an existing leaf-`descriptor contains` rule.
- [x] **Banner on Rules page** — `SuggestionsBanner` renders amber tile when `suggestions.length > 0`; click opens `SuggestionsModal`.
- [x] **One-click create** — modal lists each suggestion with a "Create rule" button that POSTs the proposed rule directly via `useCreateConditionalRule`.

### 5.8 Import/export (4 items)
- [x] **Export to JSON** — `GET /export.json` returns versioned bundle; `useExportJsonRules` triggers Blob-based download.
- [x] **Export to CSV** — `GET /export.csv` returns flat CSV with JSON-stringified `conditions` + `actions` cells.
- [x] **Import from JSON** — `POST /import` validates the entire bundle then inserts inside a single transaction. Failed validation throws `AppError(400, 'IMPORT_VALIDATION_FAILED', { errors })` with a per-rule error list. Round-trip with the JSON export verified by route test.
- [⚠️] **QBO-format CSV import** — STUBBED per plan §D7. Header dropdown shows a "QBO format?" link that explains the format isn't yet documented and recommends JSON import.

---

## Files created (5b)

### Backend
| File | LOC |
|---|---|
| `packages/api/src/services/rule-test-sandbox.service.ts` | 145 |
| `packages/api/src/services/rule-suggestions.service.ts` | 105 |
| `packages/api/src/services/rule-import-export.service.ts` | 165 |

### Frontend hooks
| File | LOC |
|---|---|
| `packages/web/src/api/hooks/useRuleTestSandbox.ts` | 78 |
| `packages/web/src/api/hooks/useRuleSuggestions.ts` | 32 |
| `packages/web/src/api/hooks/useRuleAudit.ts` | 47 |
| `packages/web/src/api/hooks/useRuleImportExport.ts` | 65 |

### Frontend components + tests
| File | LOC |
|---|---|
| `packages/web/src/features/practice/rules/sandbox/SandboxTab.tsx` | 117 |
| `packages/web/src/features/practice/rules/sandbox/ConditionTrace.tsx` | 78 |
| `packages/web/src/features/practice/rules/sandbox/ConditionTrace.test.tsx` | 75 |
| `packages/web/src/features/practice/rules/stats/StatsTab.tsx` | 144 |
| `packages/web/src/features/practice/rules/suggestions/SuggestionsModal.tsx` | 102 |
| `packages/web/src/features/practice/rules/suggestions/SuggestionsBanner.tsx` | 47 |
| `packages/web/src/features/practice/rules/suggestions/SuggestionsBanner.test.tsx` | 67 |
| `packages/web/src/features/practice/rules/io/ImportExportMenu.tsx` | 110 |
| `packages/web/src/features/practice/rules/io/ImportExportMenu.test.tsx` | 51 |
| `docs/build-plans/phase-5b-plan.md` | 137 |
| `docs/build-plans/phase-5b-complete.md` | (this) |

**Files created: 17. Tests added: 13** (5 ConditionTrace + 4 SuggestionsBanner + 4 ImportExportMenu) + **7 new backend tests** added to `conditional-rules.routes.test.ts` (sandbox / sandbox-batch / audit / suggestions / export.json / import-success / import-atomic-rollback).

## Files modified

| File | Change |
|---|---|
| `packages/api/src/services/conditional-rules-engine.service.ts` | Add `traceCondition()` for the sandbox trace |
| `packages/api/src/services/conditional-rules.service.ts` | Add `listAudit()` for paginated audit log |
| `packages/api/src/routes/conditional-rules.routes.ts` | Mount 7 new endpoints (sandbox/run, sandbox/run-batch, sandbox/recent-samples, /:id/audit, /suggestions, /export.json, /export.csv, /import) |
| `packages/api/src/routes/conditional-rules.routes.test.ts` | 7 new tests for the new endpoints |
| `packages/shared/src/types/conditional-rules.ts` | `LeafCondition.value` widened from union to `value?: unknown` so Zod's `z.unknown()` inference round-trips through API boundaries cleanly |
| `packages/web/src/features/practice/rules/RuleBuilderModal.tsx` | Add tab nav (Builder / Sandbox / Stats); tab body switches between the three views |
| `packages/web/src/features/practice/rules/RulesPage.tsx` | Render `<SuggestionsBanner />` above filter bar; `<ImportExportMenu />` next to "New rule" button |

---

## Tests

| Suite | Count | Result |
|---|---|---|
| Backend route tests added (sandbox / suggestions / I/O) | 7 | ✅ |
| `ConditionTrace.test.tsx` | 5 | ✅ |
| `SuggestionsBanner.test.tsx` | 4 | ✅ |
| `ImportExportMenu.test.tsx` | 4 | ✅ |
| **New in 5b** | **20** | — |
| **Full web suite** | **274** (was 261) | ✅ |
| **Full API conditional-rules routes** | **21** (was 14 — added 7) | ✅ |
| **Engine pure-function tests** | 46 (unchanged) | ✅ |

Build / housekeeping:
- `tsc -b` (shared, api, web) — ✅
- `npm run license:headers` — "All source files have license headers."
- Vite production build — green (only pre-existing chunk-size warning).

---

## Architectural notes

1. **`LeafCondition.value` is now `unknown` (optional).** The Zod recursive schema infers `value?: unknown`, which conflicts with the previous explicit union (`string | number | string[] | number[] | null`). Widening matches reality: a leaf's value type depends on the (field, operator) pair and the runtime evaluator already narrows. Affects Phase 4 too — the existing engine tests still pass because evaluation handles unknowns defensively.
2. **Sandbox endpoint accepts unsaved rule body.** The frontend builder's in-memory state is sent as `{rule: {conditions, actions}, sampleFeedItemId | sampleContext}`. No round-trip through DB persistence required to test.
3. **Auto-suggest is on-demand**, computed on every `GET /suggestions` call (cached client-side for 5 min). Detection scans the existing `categorization_history` learning layer; no new state introduced.
4. **JSON import is atomic** — the entire bundle validates before any insert; failures throw `AppError(400)` with the per-rule errors attached to the `details` payload (`IMPORT_VALIDATION_FAILED` code).
5. **Export downloads through `apiClient`** + Blob trigger, not raw `<a href>` — the existing apiClient handles the auth header so authenticated routes resolve correctly without inventing a download-token mechanism.
6. **Import file picker** uses a hidden `<input type="file">` triggered by the visible button. Accepts `application/json` only.
7. **QBO CSV import is a deliberately user-visible stub** — clicking "QBO format?" reveals an explanatory tooltip instead of pretending the feature works.

---

## Pre-existing warnings noticed but not fixed

- React Router v7 future-flag deprecation warnings — pre-existing.
- Vite chunk-size > 600 KB — pre-existing.

---

## Phase 5 (combined 5a + 5b) — final summary

- **35 new files**, ~6 modified, no schema changes
- **48 new tests** (28 in 5a + 20 in 5b)
- Conditional rules engine end-to-end: list, build (recursive AST), save, fire, observe, audit, sandbox, auto-suggest, import/export
- All eight build-plan checklist subsections (5.1-5.8) covered, with QBO CSV import explicitly deferred per documented plan deviation

---

## Acceptance criteria (5b)

- [x] All 10 5b items implemented (with QBO import explicitly stubbed)
- [x] Sandbox runs on unsaved rule + shows per-condition trace + final action set
- [x] Batch sandbox shows fire count + first-N matched feed items
- [x] Stats tab shows all-time / 30d / 7d / override rate / last fired
- [x] Audit log paginates by cursor (50/page) with transaction drill-down link
- [x] Auto-suggest banner appears when ≥1 suggestion exists; one-click creates a rule
- [x] JSON export / import round-trips; failed imports leave the DB unchanged
- [x] CSV export downloads correctly with stringified AST cells
- [x] `tsc -b`, `license:headers`, full web + API suites green

**Ship-gate:** all conditions verified. ✅
