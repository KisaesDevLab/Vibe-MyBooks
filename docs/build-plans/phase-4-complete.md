# Phase 4 Complete — Conditional Rules Engine: Core

**Build plan source:** `Build Plans/VIBE_MYBOOKS_PRACTICE_BUILD_PLAN.md` Phase 4 (lines 300–340).
**Migration:** `0067_conditional_rules` (forward + rollback verified).
**Feature flag:** `CONDITIONAL_RULES_V1`.
**Status:** ✅ All in-scope items implemented and verified.

---

## Checklist (verified)

### 4.1 Schema (3 items)
- [x] **`conditional_rules` table.** Drizzle + migration. Columns: `id`, `tenant_id`, `company_id` (nullable for tenant-wide), `name`, `priority`, `conditions` (JSONB), `actions` (JSONB), `continue_after_match`, `active`, `created_by`, timestamps. Indexes on `(tenant_id, active)` and `(tenant_id, priority)`.
- [x] **`conditional_rule_audit` table.** One row per rule fire (per plan §D3 — not per evaluation). Columns: `rule_id`, `bank_feed_item_id`, `transaction_id`, `matched_at`, `actions_applied`, `was_overridden`, `overridden_at`. Index on `(tenant_id, rule_id, matched_at DESC)`.
- [x] **`conditional_rule_stats` view.** Aggregates total fires, 30-day fires, 7-day fires, override count, override rate, last fired timestamp. Defined in the migration SQL; queried via raw SQL in `conditional-rules.service > statsForTenant`.

### 4.2 Condition engine (5 items)
- [x] **Condition AST** — `{type: 'group', op: 'AND'|'OR', children: [...]}` and `{type: 'leaf', field, operator, value}`. Defined in `shared/src/types/conditional-rules.ts`.
- [x] **Supported fields** — `descriptor`, `amount`, `amount_sign`, `account_source_id`, `date`, `day_of_week` (+ deferred `class_id` / `location_id` per plan §D2 — defined in catalog, rejected by Zod, throws `NOT_IMPLEMENTED` if reached).
- [x] **Supported operators per field type** — string operators (`equals`/`not_equals`/`contains`/`not_contains`/`starts_with`/`not_starts_with`/`ends_with`/`not_ends_with`/`matches_regex`/`not_matches_regex`), numeric (`eq`/`ne`/`gt`/`gte`/`lt`/`lte`/`between`), date (`before`/`after`/`between`/`on_day_of_week`). Field × operator validity enforced by `FIELD_OPERATOR_MAP`.
- [x] **Pure condition evaluator** — `evaluateCondition(condition, ctx)` in `conditional-rules-engine.service.ts`. No DB access; takes a `ConditionalRuleContext` built by `contextFromFeedItem(feedItem)`.
- [x] **30+ unit tests** — 46 tests in `conditional-rules-engine.service.test.ts` covering every operator, AND/OR groups, nested groups, branching, deferred-field throws, contextFromFeedItem.

### 4.3 Action engine (3 items)
- [x] **Action types** — `set_account`, `set_vendor`, `set_tag`, `set_memo`, `set_class` (deferred), `set_location` (deferred), `split_by_percentage`, `split_by_fixed`, `mark_for_review`, `skip_ai`. All defined in `shared/src/types/conditional-rules.ts` with discriminated union; Zod validates payload shape per variant.
- [x] **Action executor** — `evaluateActions` (engine) walks the actions tree; `applyForFeedItem` (apply service) stages results on `bank_feed_items` (sets suggestedAccountId / suggestedContactId / suggestedTagId / memo / skip_ai / splits_config).
- [x] **Split actions produce multiple journal_lines with correct totals** — see plan §D1 (splits via `journal_lines`, no separate `transaction_splits` table). The `bank-feed.service > categorize` path consumes `splits_config` and posts N user-facing journal lines + 1 cash line. Percentage splits use last-row-takes-rounding to ensure exact total preservation; fixed-amount splits use the persisted decimal strings directly.

### 4.4 Conditional branching (3 items)
- [x] **if/then/else chain** — `ActionBranch` type with `if`, `then`, optional `elif[]`, optional `else`. Recursive evaluator handles each branch.
- [x] **Nested else-if up to 5 levels** — `MAX_BRANCH_DEPTH = 5`. Enforced by both Zod (creation-time check via `depthOfActions` walker) and the runtime evaluator (defensive throw with `BRANCH_TOO_DEEP` code).
- [x] **First-match-wins + `continue_after_match`** — `evaluateRules` short-circuits on first match unless that rule's `continueAfterMatch=true`. Stacked rules accumulate; later actions overwrite earlier ones via the apply service's `aggregateActions`.

### 4.5 Rule evaluation pipeline (4 items)
- [x] **Hooks BEFORE legacy bank-rule evaluation** — `runCategorizationPipeline` runs the conditional engine first, captures which items short-circuited, then runs legacy `evaluateRules` only for items that didn't short-circuit.
- [x] **Skips legacy bank-rule evaluation when conditional fires** — items in `conditionalShortCircuited` set are skipped in the legacy-rule for-loop.
- [x] **Falls through to legacy rules unchanged when no conditional matches** — the `applyForFeedItem` returns `shortCircuitedLegacyRules: false` when nothing matched; the item proceeds to the unmodified legacy block.
- [x] **Logs every fire to `conditional_rule_audit`** — `crudService.recordFire` writes one audit row per matched rule per item. (Plan said "every evaluation"; we ship "every fire" per approved deviation §D3.)

### 4.6 Priority handling (implicit in §4.5)
- [x] **Rules evaluated in priority order (lowest first)** — `listActiveOrderedByPriority` returns rules ordered by `(priority ASC, id ASC)` for stable tiebreak.
- [x] **Drag-reorder UI persists priorities** — backend supports it via `POST /reorder` which re-sequences in 100-step increments. UI itself is Phase 5.
- [x] **Priority conflicts resolved by id** — secondary sort on `id` for deterministic tiebreak.

---

## Files created (Phase 4)

| File | LOC | Purpose |
|---|---|---|
| `packages/shared/src/constants/conditional-rules.ts` | 70 | Field/operator catalogs, action types, depth limit |
| `packages/shared/src/types/conditional-rules.ts` | 116 | `ConditionAST`, `Action`, `ActionBranch`, `ConditionalRule`, `RuleStats` |
| `packages/shared/src/schemas/conditional-rules.ts` | 198 | Recursive Zod schemas with cross-cutting refines |
| `packages/api/src/db/schema/conditional-rules.ts` | 60 | Drizzle for `conditional_rules` + `conditional_rule_audit` |
| `packages/api/src/db/migrations/0067_conditional_rules.sql` | 76 | Schema + view + bank_feed_items extensions |
| `packages/api/src/db/migrations/0067_conditional_rules.rollback.sql` | 16 | DROP companion |
| `packages/api/src/services/conditional-rules-engine.service.ts` | 220 | Pure evaluator (condition + actions + multi-rule) |
| `packages/api/src/services/conditional-rules-engine.service.test.ts` | 304 | 46 tests |
| `packages/api/src/services/conditional-rules.service.ts` | 188 | CRUD + audit writer + stats reader |
| `packages/api/src/services/conditional-rules-apply.service.ts` | 207 | Engine output → bank_feed_items + audit |
| `packages/api/src/routes/conditional-rules.routes.ts` | 117 | CRUD + reorder endpoints |
| `packages/api/src/routes/conditional-rules.routes.test.ts` | 280 | 14 tests |
| `docs/build-plans/phase-4-plan.md` | 285 | Phase plan |
| `docs/build-plans/phase-4-complete.md` | (this) | Completion report |

**Files created: 14. New tests: 60** (46 engine + 14 routes).

## Files modified

| File | Change |
|---|---|
| `packages/shared/src/index.ts` | Export new types/schemas/constants |
| `packages/api/src/db/schema/index.ts` | Export `conditional-rules` schema |
| `packages/api/src/db/schema/banking.ts` | Add `skipAi` boolean + `splitsConfig` JSONB columns to `bankFeedItems` |
| `packages/api/src/db/migrations/meta/_journal.json` | Register `0067_conditional_rules` |
| `packages/api/src/services/bank-feed.service.ts` | `runCategorizationPipeline` runs conditional engine BEFORE legacy bank rules; AI step filters `skipAi=true` items; `categorize` posts N journal lines when `splitsConfig` is present |
| `packages/api/src/app.ts` | Mount `conditional-rules.routes` at `/api/v1/practice/conditional-rules` |

---

## Tests

| Suite | Count | Result |
|---|---|---|
| `conditional-rules-engine.service.test.ts` | 46 | ✅ |
| `conditional-rules.routes.test.ts` | 14 | ✅ |
| **New in Phase 4** | **60** | — |
| Phase 2 + 3 regression sweep (139 tests) | 139 | ✅ no regressions |

Build / housekeeping:
- `tsc -b` (shared, api, web) — ✅
- `npm run license:headers` — "All source files have license headers."
- `npm run migrations:check` — clean.
- Vite production build — green (only pre-existing chunk-size warning).

Migration round-trip on a transient Postgres 16:
- Forward applied — every expected object exists with correct shape.
- Rollback applied — `Did not find any relation named "conditional_rules"`.
- Re-applied forward — clean (idempotent).

---

## Deviations from plan (cumulative; new in Phase 4)

11. **Splits write `journal_lines`, not a `transaction_splits` table** (plan §D1). Approved.
12. **`class_id` / `location_id` condition fields deferred** (plan §D2). Approved. Defined in catalog so future class/location features have a place to wire.
13. **Audit only RULE FIRES, not every evaluation** (plan §D3). Approved.
14. **`set_class` / `set_location` actions accepted by Zod but filtered out by evaluator** — same rationale as the deferred fields. Action catalog stays stable.
15. **Build plan claimed "32 items"; actual checklist count is 21**. Built all 21.

---

## Pre-existing warnings noticed but not fixed

- React Router v7 future-flag deprecation warnings — pre-existing.
- Vite chunk-size > 600 KB — pre-existing.
- Vitest tinypool IPC shutdown noise on full-suite runs — environmental.

---

## Dependencies the next phase (5) can assume

- **CRUD endpoints** at `/api/v1/practice/conditional-rules` are wired and tested.
- **Stats view** is queryable via `GET /` (rules list returns merged stats per rule).
- **Reorder endpoint** is ready for the drag-and-drop UI.
- **AST shapes** are the same in shared types and Zod schemas — the visual builder can construct rules client-side and Zod validates them on the wire.
- **Engine internals** (`evaluateRule`, `evaluateRules`, `contextFromFeedItem`) are exposed for the Phase-5 sandbox tester to dry-run a candidate rule against a sample transaction without persisting.
- **Audit + override** wiring: `crudService.markOverridden(tenantId, auditId)` is available — Phase 5's stats UI can wire it to the bookkeeper's "this rule was wrong" override action.

---

## Acceptance criteria

- [x] Schema applies forward + rollback cleanly.
- [x] Pure evaluator handles every documented operator and AND/OR groups.
- [x] Branching supports if/then/else + elif chains up to 5 levels.
- [x] First-match-wins by priority; `continue_after_match` allows stacking.
- [x] Pipeline skips legacy bank rules when a conditional rule fires.
- [x] `skip_ai` action keeps the AI categorizer off that item.
- [x] `mark_for_review` action lands the row in needs_review (via low confidence stamp).
- [x] Splits action posts multiple journal_lines correctly on approval.
- [x] Audit rows are written per fire; override rate accurate via the view.
- [x] CRUD endpoints respect role + flag + tenant isolation; AST validated.
- [x] ≥30 unit tests on the pure engine (46 shipped); full API + web suites green.
- [x] License headers, migration policy, tsc all clean.

**Ship-gate:** all conditions verified. ✅
