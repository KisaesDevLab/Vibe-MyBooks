# Phase 5b Plan — Conditional Rules UI: Sandbox + Stats + Suggestions + Import/Export

**Build plan source:** `Build Plans/VIBE_MYBOOKS_PRACTICE_BUILD_PLAN.md` Phase 5 sub-sections 5.5-5.8 (10 items).
**Builds on:** Phase 5a (rules list + builder modal).
**Feature flag:** `CONDITIONAL_RULES_V1`.

---

## Scope

### 5.5 Testing sandbox (5 items)
- [ ] "Test rule" tab within rule editor
- [ ] Paste or select a sample transaction (sample dropdown lists last 25 pending feed items)
- [ ] Evaluator runs; UI shows pass/fail per condition leaf + group
- [ ] Shows final action set
- [ ] "Test against last 100 transactions" batch mode (table of how many would fire + first-N matches)

### 5.6 Rule stats (2 items)
- [ ] Stats panel: fires (all time / 30d / 7d), override rate, last fired (added as a "Stats" tab in the rule editor modal)
- [ ] Paginated audit log of `conditional_rule_audit` rows with transaction-link drill-down

### 5.7 Auto-suggest (3 items)
- [ ] Detection logic: scan categorization_history for high-confidence patterns
- [ ] Banner on Rules page: "N potential rules detected" → opens suggestions modal
- [ ] One-click "Create rule" from suggestion

### 5.8 Import/export (4 items)
- [ ] Export all rules to JSON (single download)
- [ ] Export all rules to CSV (flat representation; conditions/actions JSON-stringified per cell)
- [ ] Import from JSON with Zod validation (atomic — all-or-nothing transaction)
- [ ] QBO-format CSV import — DEFERRED with stub UI explaining the format isn't yet documented

---

## Architectural decisions

### D1 — Sandbox endpoint accepts an UNSAVED rule

The endpoint takes `{rule: <create-shape>, sampleFeedItemId | sampleContext}` and returns a trace. This lets bookkeepers test changes BEFORE saving — the alternative (test only after save) defeats the point of a sandbox. The Zod creation schema is reused for the rule body; the `id` field is optional.

### D2 — Auto-suggest computed on-demand, not as a background job

Same pattern as the matcher: BullMQ isn't wired up. The Rules-page banner triggers a synchronous detection query when the page mounts (cached for 5 min). Detection scans `categorization_history` for `(payeePattern, accountId)` pairs with `timesConfirmed >= 5 AND override_rate < 10%` that don't already have a matching conditional rule. Lightweight enough to run on every Rules page load.

### D3 — Stats + audit log live in the existing rule editor modal as a "Stats" tab

The modal already has Visual + JSON sections; adding a third tab keeps the navigation surface compact. The list-page row already shows summary stats (fires30d + overrideRate) so the modal tab is the detail view.

### D4 — Audit log paginated by cursor on `matched_at DESC`

Same pattern as Phase 2's bucket pagination. Cursor = ISO timestamp; pages of 50.

### D5 — JSON import uses a single transaction; partial failures roll back entirely

If the user uploads a JSON file with 50 rules and rule 23 fails Zod validation, the entire import is rejected with a per-rule error report. Half-imported rules would leave the tenant in an inconsistent state and surprise the user.

### D6 — CSV export uses a flat schema with JSON-stringified `conditions` + `actions` cells

Pure flat CSV (every leaf condition as its own column) doesn't fit the recursive AST. Stringifying conditions/actions into JSON cells is the cleanest representation that round-trips through Excel and supports re-import via JSON-paste later. Fields per row: `id, name, priority, active, continue_after_match, company_id, conditions_json, actions_json, fires_total, override_rate`.

### D7 — QBO CSV import skipped with explanatory stub

Build plan §5.8 calls for QBO CSV import. I don't have a QBO export-format spec; inventing one to map against is throwaway work. The Import button shows a "QBO format" tab with a "Coming soon" message and a link to JSON import as the recommended alternative. Flagging this as a deviation.

---

## Files to create

### Backend
- `packages/api/src/services/rule-test-sandbox.service.ts` — `runOnSample(tenantId, rule, sampleContext)` + `runOnLast100(tenantId, rule)`. Pure functions on top of the engine.
- `packages/api/src/services/rule-suggestions.service.ts` — `detectSuggestions(tenantId)` reading `categorization_history`.
- `packages/api/src/services/rule-import-export.service.ts` — JSON/CSV serialization + atomic import.
- Add tests for each service.
- `packages/api/src/routes/conditional-rules.routes.ts` — extend with:
  - `POST /sandbox/run` — body `{rule, sampleFeedItemId?, sampleContext?}`
  - `POST /sandbox/run-batch` — body `{rule, limit?}`
  - `GET /:id/audit?cursor&limit` — paginated audit log
  - `GET /suggestions` — auto-suggest list
  - `POST /import` — JSON import
  - `GET /export.json` — JSON download
  - `GET /export.csv` — CSV download
- Extend `conditional-rules.routes.test.ts` with tests for the new endpoints.

### Frontend
- `packages/web/src/api/hooks/useRuleTestSandbox.ts` — `useRunSandbox`, `useRunBatchSandbox`.
- `packages/web/src/api/hooks/useRuleSuggestions.ts` — `useRuleSuggestions`.
- `packages/web/src/api/hooks/useRuleAudit.ts` — `useRuleAudit(ruleId)`.
- `packages/web/src/api/hooks/useRuleImportExport.ts` — `useImportRules`, exports done via direct download links.
- `packages/web/src/features/practice/rules/sandbox/SandboxTab.tsx` — paste/select + run + trace display.
- `packages/web/src/features/practice/rules/sandbox/ConditionTrace.tsx` — recursive walker showing pass/fail per node.
- `packages/web/src/features/practice/rules/stats/StatsTab.tsx` — counters + audit log table.
- `packages/web/src/features/practice/rules/suggestions/SuggestionsBanner.tsx` — banner on RulesPage.
- `packages/web/src/features/practice/rules/suggestions/SuggestionsModal.tsx` — one-click create.
- `packages/web/src/features/practice/rules/io/ImportExportMenu.tsx` — header dropdown on RulesPage.
- Tests for each new component.

### Files modified
- `packages/web/src/features/practice/rules/RuleBuilderModal.tsx` — add Sandbox + Stats tabs alongside the existing Visual/JSON layout.
- `packages/web/src/features/practice/rules/RulesPage.tsx` — render `<SuggestionsBanner />` and `<ImportExportMenu />`.
- `packages/api/src/app.ts` — no change (router already mounted; new endpoints added inside it).

---

## Schema changes

**None.** Phase 5b reuses Phase 4's `conditional_rule_audit` table.

---

## Open questions

> If any need adjustment, stop me before Step 3.

1. **Sandbox endpoint accepts UNSAVED rule body** so test-before-save works. Confirm.
2. **Auto-suggest computed on-demand** when the Rules page mounts (no background job; matches existing CLAUDE.md "BullMQ deferred" stance). Confirm.
3. **Auto-suggest detection threshold**: `timesConfirmed >= 5 AND override_rate < 10%` AND no existing rule matches the pattern. Confirm or propose different thresholds.
4. **Stats + audit log as a tab inside the rule editor modal**, not a separate detail page. Confirm.
5. **JSON import is atomic** — partial failures roll back; user gets per-rule error report. Confirm.
6. **CSV export uses flat schema with JSON-stringified `conditions` + `actions` cells.** Re-import via CSV directly is not supported in 5b (the cell-level JSON would re-encode through Excel and break); users round-trip via the JSON download instead. Confirm.
7. **QBO CSV import deferred** with an explanatory stub. The format isn't documented anywhere I can audit. Confirm.

---

## Implementation order

1. Backend sandbox service + endpoint + tests
2. Backend audit-log pagination endpoint + tests
3. Backend suggestions service + endpoint + tests
4. Backend import/export service + endpoints + tests
5. Frontend hooks
6. Sandbox tab + ConditionTrace + tests
7. Stats tab + audit table + tests
8. Suggestions banner + modal + tests
9. Import/export menu + tests
10. Wire all three tabs into `RuleBuilderModal`; render banner + menu on `RulesPage`
11. Full suites green; completion report

Commit per step.

---

## Acceptance criteria

- [ ] All 10 5b items implemented (with QBO import explicitly stubbed)
- [ ] Sandbox runs on unsaved rule + shows per-condition trace + final action set
- [ ] Batch sandbox shows fire count + first-N matched feed items
- [ ] Stats tab shows all-time / 30d / 7d / override rate / last fired
- [ ] Audit log paginates by cursor (50/page) with transaction drill-down link
- [ ] Auto-suggest banner appears when ≥1 suggestion exists; one-click creates a rule
- [ ] JSON export / import round-trips; failed imports leave the DB unchanged
- [ ] CSV export downloads correctly with stringified AST cells
- [ ] `tsc -b`, `license:headers`, full web + API suites green

---

**Tell me which open questions to overrule, or "continue" to take all seven as proposed.**
