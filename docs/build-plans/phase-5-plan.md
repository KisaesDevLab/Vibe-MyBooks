# Phase 5 Plan — Conditional Rules Engine: UI

**Build plan source:** `Build Plans/VIBE_MYBOOKS_PRACTICE_BUILD_PLAN.md` Phase 5 (lines 342–393), 26 items across 8 subsections.
**Builds on:** Phase 4 (engine + CRUD endpoints + audit + stats view).
**Feature flag:** `CONDITIONAL_RULES_V1`.

---

## Split decision

Phase 5 has the same scope/risk profile that triggered the 2a/2b split. Recommending the same split here:

- **Phase 5a — Core CRUD + visual builder + branching** (5.1-5.4): bookkeeper can author and manage rules end-to-end. ~16 items.
- **Phase 5b — Sandbox + stats + auto-suggest + import/export** (5.5-5.8): quality-of-life and tooling. ~10 items.

5a is the keystone — without it the engine shipped in Phase 4 is unusable from the UI. 5b adds tooling around the working surface. If you'd rather ship as one phase, say so before I start.

---

## Phase 5a scope (16 items)

### 5.1 Rules list page (5 items)
- [ ] Table: name, priority, active toggle, last fired, fires count, override rate
- [ ] Sort by priority (drag handle) / name / last fired
- [ ] Filter: active/inactive, company scope, action type
- [ ] "New rule" button opens builder
- [ ] Bulk actions: enable, disable, delete (export to CSV → 5b)

### 5.2 Visual condition builder (6 items)
- [ ] Nested groups UI with AND/OR toggle per group
- [ ] "Add condition" inserts leaf condition with field/operator/value dropdowns
- [ ] "Add group" inserts nested group
- [ ] Field dropdown filters operators to valid set (driven by `FIELD_OPERATOR_MAP`)
- [ ] Value input type changes based on field (text / number / date / account picker)
- [ ] Live JSON preview for power users (collapsible side panel)

### 5.3 Visual action builder (4 items)
- [ ] "Add action" button; action type dropdown
- [ ] Action-specific configuration form per type (set_account → AccountSelector, set_vendor → ContactSelector, etc.)
- [ ] Split actions: dynamic row-add with percentage or fixed amount validation (must sum to 100)
- [ ] Reorderable action list

### 5.4 Conditional branching UI (3 items)
- [ ] "Add else-if" and "Add else" buttons
- [ ] Visual tree representation of branching logic
- [ ] Indent levels show nesting depth (with depth-counter showing remaining slots out of 5)

### Plus
- [ ] Replace `RulesPlaceholder` with the real page; update App.tsx route

---

## Phase 5b scope (deferred to next checkpoint)

### 5.5 Testing sandbox (5 items) — Phase 5b
- "Test rule" tab within rule editor + paste/select sample transaction + match-highlight UI + final-action-set display + batch "test against last 100" mode

### 5.6 Rule stats (2 items) — Phase 5b
- Stats panel per rule + paginated audit log

### 5.7 Auto-suggest (3 items) — Phase 5b
- Background job + Rules-page banner + suggestion modal

### 5.8 Import/export (4 items) — Phase 5b
- Export JSON / CSV; import JSON; QBO-format CSV import (mapping common patterns)

---

## Architectural decisions for 5a

### D1 — Recursive component pattern for condition + action trees

`ConditionNode` and `ActionNode` are recursive React components. Each takes a node + an `onChange(nextNode)` callback + a `depth` prop. Group nodes render their children recursively. This is the smallest pattern that handles arbitrary nesting and matches the AST shape exactly.

### D2 — One builder modal per rule (not full-page)

Following the existing `BankRulesPage.tsx` pattern — the builder opens in a modal/drawer rather than a separate route. Keeps the URL stable and the back-button intuitive. The modal is wide (~900px) since the recursive UI can get visually deep.

### D3 — JSON preview as a toggleable side panel, not a separate route

A toggle in the modal header switches the right pane between "Visual" and "JSON". Power users can edit JSON directly; on switching back to Visual, the JSON is parsed and applied. If the JSON is invalid, switching back is blocked with an error message.

### D4 — Drag-reorder uses the existing `POST /reorder` endpoint

Phase 4 already shipped `POST /api/v1/practice/conditional-rules/reorder`. The UI uses native HTML5 drag-and-drop (no new dep) and persists the new order via a single API call on drop.

### D5 — Account / vendor / tag pickers reuse existing components

`AccountSelector`, `ContactSelector`, and `LineTagPicker` (or its equivalent in the codebase) are already used by `BankRulesPage`. The conditional rules builder uses the same components — no new pickers.

### D6 — No live engine evaluation in 5a (defer to 5b sandbox)

5a doesn't include the sandbox tester. Authors get visual feedback through Zod validation errors only; the "test this rule against a real transaction" UX comes in 5b. This keeps 5a focused on the CRUD-and-builder happy path.

---

## Files to create (5a)

### Hooks
- `packages/web/src/api/hooks/useConditionalRules.ts` — `useConditionalRules`, `useConditionalRule(id)`, `useCreateConditionalRule`, `useUpdateConditionalRule`, `useDeleteConditionalRule`, `useReorderConditionalRules`.

### Page + builder
- `packages/web/src/features/practice/rules/RulesPage.tsx` — list page replacing `RulesPlaceholder`.
- `packages/web/src/features/practice/rules/RulesTable.tsx` — sortable, filterable table with drag-reorder.
- `packages/web/src/features/practice/rules/RulesFilterBar.tsx` — active/inactive + action-type filter.
- `packages/web/src/features/practice/rules/BulkActionMenu.tsx` — enable / disable / delete.
- `packages/web/src/features/practice/rules/RuleBuilderModal.tsx` — modal shell with Visual/JSON toggle.
- `packages/web/src/features/practice/rules/builder/ConditionNode.tsx` — recursive condition renderer.
- `packages/web/src/features/practice/rules/builder/LeafConditionEditor.tsx` — field/operator/value dropdowns.
- `packages/web/src/features/practice/rules/builder/ActionsEditor.tsx` — top-level actions/branch dispatcher.
- `packages/web/src/features/practice/rules/builder/ActionNode.tsx` — single action editor.
- `packages/web/src/features/practice/rules/builder/SplitActionEditor.tsx` — percentage / fixed split row editor.
- `packages/web/src/features/practice/rules/builder/BranchEditor.tsx` — if/then/elif/else tree.
- `packages/web/src/features/practice/rules/builder/JsonPreview.tsx` — read-only / editable JSON pane.

### Tests
- `packages/web/src/features/practice/rules/RulesPage.test.tsx` — smoke + filter/sort interactions.
- `packages/web/src/features/practice/rules/RuleBuilderModal.test.tsx` — open / submit / Zod-error paths.
- `packages/web/src/features/practice/rules/builder/ConditionNode.test.tsx` — nested AND/OR + add/remove leaf/group.
- `packages/web/src/features/practice/rules/builder/SplitActionEditor.test.tsx` — percentage sum validation, fixed-amount entry.
- `packages/web/src/features/practice/rules/builder/BranchEditor.test.tsx` — add elif, depth limit warning.

---

## Files to modify (5a)

| File | Change |
|---|---|
| `packages/web/src/App.tsx` | Replace `<RulesPlaceholder />` with `<RulesPage />`; remove the placeholder import |
| `packages/web/src/features/practice/placeholders/RulesPlaceholder.tsx` | Delete |
| `packages/web/src/hooks/usePracticeVisibility.ts` | (no change — `Rules` nav item already gated by `CONDITIONAL_RULES_V1`) |

No backend changes for 5a — all endpoints from Phase 4 are sufficient.

---

## Schema / API changes

**None** for 5a. Phase 4 ships everything 5a needs:
- `GET /` returns rules + merged stats per rule
- `POST /` creates with full Zod validation including depth + percentage-sum
- `PUT /:id` and `DELETE /:id` exist
- `POST /reorder` exists

---

## Open questions

> If any need to resolve differently from my assumption, stop me before Step 3.

1. **Split into 5a + 5b**, scope above. Same pattern as 2a/2b.
2. **Builder in a modal, not a separate route.** Matches `BankRulesPage`. Confirm.
3. **JSON preview as side panel toggle.** Power users can edit JSON; invalid JSON blocks switch back to Visual. Confirm (alternative: read-only preview).
4. **Native HTML5 drag-and-drop for reordering.** No new dep. If you want a richer DnD library, say so.
5. **No sandbox in 5a** (deferred to 5b). Confirm.
6. **Field/operator/value dropdown UX**: when field changes, operator dropdown filters AND value input shape changes. Confirm — the alternative would let bookkeepers craft invalid rules that Zod then rejects on save.

---

## Implementation order (5a)

1. Hooks (`useConditionalRules`, etc.)
2. Recursive `ConditionNode` + `LeafConditionEditor` + tests
3. Recursive `ActionsEditor` + `ActionNode` + `SplitActionEditor` + `BranchEditor` + tests
4. `JsonPreview` (toggleable Visual ↔ JSON)
5. `RuleBuilderModal` (wires the above)
6. `RulesTable` + `RulesFilterBar` + `BulkActionMenu` + drag-reorder
7. `RulesPage` (composes the above) + replace placeholder in App.tsx + tests
8. Full web suite + `tsc -b` + `license:headers` green; completion report

Commit per step (`phase-5a.N: brief`).

---

## Acceptance criteria

- [ ] All 16 5a items implemented
- [ ] Recursive condition/action builder handles arbitrary depth up to 5 levels
- [ ] Field changes filter operators; operator changes adjust value input shape
- [ ] Splits validation on percentage sum to 100 surfaces inline (not just on save)
- [ ] Drag-reorder persists via the existing `/reorder` endpoint
- [ ] Bulk enable/disable/delete operate on selected rows
- [ ] JSON preview round-trips: Visual → JSON → edit → Visual works for valid edits
- [ ] `tsc -b`, `license:headers`, full web + API suites green
- [ ] Web tests cover the recursive component invariants

---

**Tell me which open questions to overrule, or "continue" to take all six as proposed.**
