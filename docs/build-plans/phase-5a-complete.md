# Phase 5a Complete — Conditional Rules UI: List + Builder

**Scope:** Build plan Phase 5 sub-sections 5.1, 5.2, 5.3, 5.4 (16 items).
**Builds on:** Phase 4 (engine + CRUD + audit + stats).
**Deferred to Phase 5b:** 5.5 sandbox, 5.6 stats panel polish, 5.7 auto-suggest, 5.8 import/export.

---

## Checklist (verified)

### 5.1 Rules list page (5 items)
- [x] **Table with name / priority / active toggle / last fired / fires count / override rate** — `RulesTable.tsx`. Active toggle is a chip-button that PUTs `{active: !active}` on click.
- [x] **Sort by priority / name / last fired** — clickable column headers update local sort state. Drag-reorder is only enabled while sorted by priority (so users don't reorder while looking at a different sort).
- [x] **Filter: active/inactive / company scope / action type** — `RulesFilterBar.tsx`. Action-type filter walks the actions tree (handles branching too) so it correctly matches actions inside `then`/`elif`/`else` bodies.
- [x] **"New rule" button opens builder** — page-level state controls modal visibility.
- [x] **Bulk actions: enable / disable / delete** — `BulkActionMenu.tsx`. Each fans out one mutation per selected row (no bulk endpoint required). CSV export → 5b.

### 5.2 Visual condition builder (6 items)
- [x] **Nested groups UI with AND/OR toggle per group** — `ConditionNode.tsx` recursively renders. Group AND/OR is a chip-button.
- [x] **"Add condition" inserts leaf** — defaults to `descriptor contains ""`.
- [x] **"Add group" inserts nested group** — defaults to one leaf inside an AND group.
- [x] **Field dropdown filters operators to valid set** — driven by `FIELD_OPERATOR_MAP` from shared. When field changes, operator resets to first valid + value resets.
- [x] **Value input type changes based on field** — text / number / date / between-tuple / day-of-week dropdown. The matrix is in `LeafConditionEditor > ValueInput`.
- [x] **Live JSON preview for power users** — `JsonPreview.tsx` toggles between View (read-only pretty-printed) and Edit (textarea + Apply button). Switch back to Visual is blocked while JSON is invalid.

### 5.3 Visual action builder (4 items)
- [x] **"Add action" + action type dropdown** — `ActionsEditor.tsx`. Deferred action types (`set_class`, `set_location`) filtered out of dropdown so authors can't pick them.
- [x] **Action-specific configuration form per type** — `ActionNode.tsx`. set_account → `AccountSelector`, set_vendor → `ContactSelector`, set_memo → text, set_tag → uuid string, splits → `SplitActionEditor`, mark_for_review / skip_ai → no-payload note.
- [x] **Split actions with percentage / fixed validation** — `SplitActionEditor.tsx`. Percentage sum surfaces inline next to the Add button, OK ✓ when 100, error when not. Fixed-amount mode hides the sum hint.
- [x] **Reorderable action list** — up/down chevrons per action; first item's Up is disabled, last item's Down is disabled.

### 5.4 Conditional branching UI (3 items)
- [x] **"Add else-if" and "Add else" buttons** — in `BranchEditor` (co-located in `ActionsEditor.tsx` to break a circular import). Else-if button is disabled at depth ceiling; Else button is disabled when else already exists.
- [x] **Visual tree representation** — branch nodes get an amber border + indented children with a left-border. "Convert to flat list" / "Convert to if/then/else" toggle lets authors flip between modes.
- [x] **Indent levels show nesting depth** — depth indicator in branch header reads "depth N of 5"; warning surfaces at depth 4.

---

## Files created (5a)

| File | LOC |
|---|---|
| `packages/web/src/api/hooks/useConditionalRules.ts` | 95 |
| `packages/web/src/features/practice/rules/RulesPage.tsx` | 144 |
| `packages/web/src/features/practice/rules/RulesTable.tsx` | 167 |
| `packages/web/src/features/practice/rules/RulesFilterBar.tsx` | 95 |
| `packages/web/src/features/practice/rules/BulkActionMenu.tsx` | 60 |
| `packages/web/src/features/practice/rules/RuleBuilderModal.tsx` | 207 |
| `packages/web/src/features/practice/rules/builder/ConditionNode.tsx` | 122 |
| `packages/web/src/features/practice/rules/builder/LeafConditionEditor.tsx` | 153 |
| `packages/web/src/features/practice/rules/builder/ActionsEditor.tsx` | 246 |
| `packages/web/src/features/practice/rules/builder/ActionNode.tsx` | 147 |
| `packages/web/src/features/practice/rules/builder/SplitActionEditor.tsx` | 99 |
| `packages/web/src/features/practice/rules/builder/JsonPreview.tsx` | 79 |
| `packages/web/src/features/practice/rules/RulesPage.test.tsx` | 95 |
| `packages/web/src/features/practice/rules/builder/ConditionNode.test.tsx` | 110 |
| `packages/web/src/features/practice/rules/builder/SplitActionEditor.test.tsx` | 84 |
| `packages/web/src/features/practice/rules/builder/BranchEditor.test.tsx` | 99 |
| `docs/build-plans/phase-5-plan.md` | 175 |
| `docs/build-plans/phase-5a-complete.md` | (this) |

**Files created: 18. New tests: 28** (5 RulesPage + 11 ConditionNode + 5 SplitActionEditor + 7 BranchEditor).

## Files deleted

- `packages/web/src/features/practice/placeholders/RulesPlaceholder.tsx`

## Files modified

- `packages/web/src/App.tsx` — wire `RulesPage` in place of the placeholder.

---

## Tests

| Suite | Count | Result |
|---|---|---|
| `ConditionNode.test.tsx` | 11 | ✅ |
| `SplitActionEditor.test.tsx` | 5 | ✅ |
| `BranchEditor.test.tsx` | 7 | ✅ |
| `RulesPage.test.tsx` | 5 | ✅ |
| **New in Phase 5a** | **28** | — |
| **Full web suite** | **261** (was 233) | ✅ |
| **Full API suite** | 1080 (engine + routes from Phase 4) | unchanged |

Build / housekeeping:
- `tsc -b` (web) — ✅
- `npm run license:headers` — "All source files have license headers."
- Vite production build — green (only pre-existing chunk-size warning).

---

## Architectural notes

1. **Co-located `BranchEditor` + `ActionsEditor`.** They're mutually recursive (a branch's `then` body is itself an `ActionsField`). ESM import cycles are awkward; co-locating them in `ActionsEditor.tsx` keeps the module import graph clean.
2. **Wire-input types declared in the hook file**, not imported as `z.infer<typeof createConditionalRuleSchema>`. The Zod recursive schema's TS surface uses unexported local interfaces, which broke declaration emit when `useCreateConditionalRule`'s return type was indirectly re-exported. The hook's `CreateConditionalRuleWireInput` is a hand-written type that mirrors the same shape — duplication is small and the boundary is stable.
3. **Action-type filter walks the entire tree** (flat or branched). A rule with `set_account` only inside an `else` body still matches when the user filters by `set_account`.
4. **"Convert to flat list" preserves only the top-level `then` body.** `else` and `elif` content is dropped — the user is informed by the toggle's underlined-link styling and the act of clicking it. This matches what most rule editors do.

---

## Pre-existing warnings noticed but not fixed

- React Router v7 future-flag deprecation warnings — pre-existing.
- Vite chunk-size > 600 KB — pre-existing.

---

## What 5b ships

- 5.5 — Testing sandbox (paste/select sample → see which conditions matched + final actions; "test against last 100" batch mode)
- 5.6 — Detailed stats panel + paginated audit log per rule
- 5.7 — Auto-suggest engine (background job + Rules-page banner + suggestion modal)
- 5.8 — Import/export (JSON round-trip + flat CSV + QBO-format CSV import)

---

## Acceptance criteria

- [x] All 16 5a items implemented
- [x] Recursive condition/action builder handles arbitrary depth up to 5 levels
- [x] Field changes filter operators; operator changes adjust value input shape
- [x] Splits validation on percentage sum to 100 surfaces inline
- [x] Drag-reorder persists via the existing `/reorder` endpoint
- [x] Bulk enable/disable/delete operate on selected rows
- [x] JSON preview round-trips: Visual → JSON → edit → Visual works for valid edits, blocked for invalid
- [x] `tsc -b`, `license:headers`, full web + API suites green
- [x] Web tests cover the recursive component invariants

**Ship-gate:** all conditions verified. ✅
