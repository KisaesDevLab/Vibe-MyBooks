# Phase 4 Plan — Conditional Rules Engine: Core

**Build plan source:** `Build Plans/VIBE_MYBOOKS_PRACTICE_BUILD_PLAN.md` Phase 4 (lines 300–340), 21 items across 6 subsections (build plan says "32 items" — actual count is closer to 21; the plan's totals appear inflated for some phases).
**Builds on:** Phase 2 (state-row upsert hook), Phase 3 (matcher hook). The conditional rules engine slots in BEFORE the legacy bank-rule evaluator in `runCategorizationPipeline`.
**Feature flag:** `CONDITIONAL_RULES_V1` (provisioned in Phase 1).
**Scope:** Engine + schema only. Phase 5 ships the visual rule builder UI.

---

## Objective

Add composable if/then/else rule support that runs BEFORE the existing legacy `bank_rules` evaluator. A conditional rule has:

- a **conditions AST** (groups + leaves with field/operator/value),
- an **actions list** (set_account, set_vendor, set_tag, set_memo, split_by_*, mark_for_review, skip_ai),
- optional **else / else-if branches** (up to 5 levels),
- a **priority** (lower number = earlier evaluation),
- a `continue_after_match` flag for additive rules.

When the engine fires for a feed item, the actions apply, the legacy bank-rule evaluator is **skipped** for that item, and an audit row is written. When the engine doesn't fire, the existing pipeline runs unchanged.

---

## Dependencies (verified)

| Dependency | Status | Notes |
|---|---|---|
| `runCategorizationPipeline` hook | ✅ Phase 2a | Already called from bank-feed insert path; Phase 4 inserts a Step 0 here |
| Legacy `bankRulesService.evaluateRules` | ✅ Exists | Phase 4 wraps the call in a "did conditional rules fire?" check |
| `bank_feed_items` row context (description, amount, bankConnectionAccountId, feedDate) | ✅ Exists | Direct read — same fields the legacy evaluator already consumes |
| `journal_lines` for split actions | ✅ Exists | Build plan calls them "transaction_splits"; deviation documented in §D1 |
| `transactions` table for actions (set_memo, etc.) | ✅ Exists | `bankFeedItems.suggestedAccountId/suggestedContactId/memo` are the staging slots before posting |
| `audit_log` table | ✅ Exists | Used by Phase 1+2 for feature-flag toggles, classification approvals, etc. — same helper |
| `CONDITIONAL_RULES_V1` flag | ✅ Phase 1 | Server-side gate via `featureFlagsService.isEnabled` |
| `class_id` / `location_id` columns on transactions | ❌ Don't exist | Skipping these as condition fields (deviation §D2) |
| `transaction_splits` table | ❌ Doesn't exist | Splits are journal_lines (§D1) |

---

## Architectural decisions

### D1 — Split actions write `journal_lines`, not a new `transaction_splits` table

Build plan §4.3 mentions "transaction_splits rows." Our model uses `journal_lines` for split lines (each split = one journal line). The split actions in this phase do NOT create their own row table; they configure the staging on `bankFeedItems` so when the bookkeeper approves the categorization (existing `bank-feed.service > categorize` path or Phase 2b's bulk-approve), the resulting transaction's journal_lines reflect the split.

**Implementation**: split actions persist a `splitsConfig` JSONB blob on the bank-feed item (new column) listing `{accountId, percent | fixed_amount, tagId?, memo?}` per split. The `categorize` path reads this blob if present and posts the transaction with multiple journal_lines instead of the standard 2-line debit/credit. If not present, behavior is unchanged.

Migration: `ALTER TABLE bank_feed_items ADD COLUMN splits_config JSONB`. Additive.

### D2 — `class_id` and `location_id` condition fields are deferred

Build plan §4.2 lists `class_id` and `location_id` as supported condition fields. The data model has neither. Class tracking and location tracking are separate accounting features not yet shipped. Phase 4 will:
- Define these fields in the operator catalog so future migrations can wire them without schema churn here
- Have the evaluator throw `NOT_IMPLEMENTED` if a rule's condition references them (Zod prevents creation at the API layer too)

When class/location features ship, this becomes a one-line evaluator extension.

### D3 — Audit only RULE FIRES, not every evaluation

Build plan §4.5: "Log every evaluation (matched or not) to `conditional_rule_audit`."

For a tenant with N rules and M feed items, that's N×M audit rows per ingestion. On a typical bookkeeper workload (5 rules × 200 items/month), it's 1000 rows/month — fine. On a power-user workload (50 rules × 5000 items/month), it's 250K rows/month — that's a hot table requiring partitioning to stay performant. Logging only fires gives us the observability bookkeepers actually want (which rules are firing, override rate) without the row-count problem.

I'll stamp `conditional_rule_audit` rows ONLY when a rule fires, plus `was_overridden` is updated when a bookkeeper later changes the resulting categorization. The override-rate stats view derives from `was_overridden / fires`. This is the pragmatic interpretation of the plan's intent.

### D4 — Conditional engine runs INSIDE the existing `runCategorizationPipeline` hook

Same pattern as Phase 2a + 3: insert a step at the start of the for-loop that:
1. Loads active conditional rules for the tenant ordered by priority
2. Evaluates each against the feed item context
3. On the first match (unless `continue_after_match=true`), applies the rule's actions to the feed item and writes the audit row
4. Records that conditional rules fired so the legacy bank-rule step skips this item

If `continue_after_match=true`, multiple rules can stack their actions (e.g., a vendor rule sets account, a tag rule adds a tag — both apply).

### D5 — Conditional branching: if/then/else as a JSONB tree, evaluator is recursive

The actions blob has shape:
```ts
type ActionBranch = {
  if: ConditionAST;
  then: Action[];
  elif?: ActionBranch[];     // 0..5 of these
  else?: Action[];
};
type ActionsField = Action[] | ActionBranch;
```

The simple case (no branching) is just `Action[]`. The branching case is the discriminated `ActionBranch`. The evaluator:
- If actions is `Action[]`, execute them.
- If actions is `ActionBranch`, evaluate the `if` condition. If true → run `then`. Else evaluate each `elif`. If any → run that `then`. Else run `else` if present.

5-level depth limit enforced by the Zod schema (recursive `z.lazy` with depth-counter param).

### D6 — `skip_ai` action prevents AI categorization but allows everything else

A common request is "for this descriptor pattern, never call the AI." The `skip_ai` action sets a flag on the feed item that the AI step in `runCategorizationPipeline` (`categorizationService.suggestForBatch`) checks. For Phase 4 we add a column `bank_feed_items.skip_ai BOOLEAN DEFAULT FALSE` — additive — and the AI step filters those out.

`mark_for_review` is similar but explicit — it stamps the bucket directly to `needs_review` via the classification state row.

---

## Files to create

### Shared
- `packages/shared/src/types/conditional-rules.ts` — `ConditionAST`, `Action`, `ActionsField`, `ActionBranch`, `ConditionField`, `ConditionOperator`, `RuleStats`.
- `packages/shared/src/schemas/conditional-rules.ts` — Zod for the entire AST + create/update payloads. Recursive lazy schema with depth limit.
- `packages/shared/src/constants/conditional-rules.ts` — `MAX_BRANCH_DEPTH = 5`, supported field/operator catalogs, action-type list.

### Database
- `packages/api/src/db/schema/conditional-rules.ts` — Drizzle for `conditional_rules` + `conditional_rule_audit`.
- `packages/api/src/db/migrations/0067_conditional_rules.sql` — both tables, the stats view, `bank_feed_items.skip_ai` + `bank_feed_items.splits_config` columns.
- Rollback file.

### API services
- `packages/api/src/services/conditional-rules.service.ts` — CRUD + the `findActiveForTenant` query.
- `packages/api/src/services/conditional-rules-engine.service.ts` — pure evaluator: `evaluateCondition(condition, ctx)`, `evaluateActions(actions, ctx) → AppliedActions`, `evaluateRule(rule, ctx)`, `evaluateRules(tenantId, ctx) → {matched, applied, audit}`.
- `packages/api/src/services/conditional-rules-engine.service.test.ts` — 35+ unit tests for the evaluator (per build plan §4.2 ≥30+).
- `packages/api/src/services/conditional-rules-apply.service.ts` — applies the result of evaluator to the bank feed item (sets suggestedAccountId, suggestedContactId, suggestedTagId, memo, skip_ai, splits_config) and writes the audit row.
- `packages/api/src/services/conditional-rules-stats.service.ts` — read-only helpers powering the stats view.

### API routes
- `packages/api/src/routes/conditional-rules.routes.ts` — CRUD endpoints (`GET /`, `POST /`, `GET /:id`, `PUT /:id`, `DELETE /:id`, `POST /reorder` for priority changes).
- `packages/api/src/routes/conditional-rules.routes.test.ts` — auth/role/tenant-isolation/feature-flag tests + AST validation.

### Tests
- See above. Plus `packages/api/src/db/schema/conditional-rules.test.ts` for migration round-trip.

---

## Files to modify

| File | Change |
|---|---|
| `packages/api/src/db/schema/index.ts` | Export new schemas |
| `packages/api/src/db/schema/banking.ts` | Add `splitsConfig: jsonb('splits_config')` and `skipAi: boolean('skip_ai').default(false)` to `bankFeedItems` |
| `packages/api/src/db/migrations/meta/_journal.json` | Register `0067_conditional_rules` |
| `packages/api/src/services/bank-feed.service.ts` | `runCategorizationPipeline` runs conditional engine BEFORE legacy rules; if any conditional rule fires (without `continue_after_match`), legacy rule eval is skipped for that item |
| `packages/api/src/app.ts` | Mount `conditional-rules.routes` |
| `packages/api/src/services/categorization-ai.service.ts` (or wherever the AI batch entry lives) | Skip items with `bank_feed_items.skip_ai = true` |
| `packages/api/src/services/bank-feed.service.ts > categorize` | When approving a feed item with `splits_config`, post multiple journal_lines from the config instead of the standard two-line layout |
| `packages/shared/src/index.ts` | Export new types/schemas/constants |

---

## Schema migration

```sql
CREATE TABLE conditional_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  company_id UUID,        -- nullable = tenant-wide
  name VARCHAR(255) NOT NULL,
  priority INTEGER NOT NULL DEFAULT 100,
  conditions JSONB NOT NULL,
  actions JSONB NOT NULL,
  continue_after_match BOOLEAN NOT NULL DEFAULT FALSE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_cond_rules_tenant_active ON conditional_rules (tenant_id, active);
CREATE INDEX idx_cond_rules_tenant_priority ON conditional_rules (tenant_id, priority);

CREATE TABLE conditional_rule_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  rule_id UUID NOT NULL REFERENCES conditional_rules(id) ON DELETE CASCADE,
  bank_feed_item_id UUID,
  transaction_id UUID,
  matched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  actions_applied JSONB,
  was_overridden BOOLEAN NOT NULL DEFAULT FALSE,
  overridden_at TIMESTAMPTZ
);
CREATE INDEX idx_cra_tenant_rule ON conditional_rule_audit (tenant_id, rule_id, matched_at DESC);

CREATE OR REPLACE VIEW conditional_rule_stats AS
SELECT
  r.id AS rule_id,
  r.tenant_id,
  r.name,
  COUNT(a.id) AS fires_total,
  COUNT(a.id) FILTER (WHERE a.was_overridden) AS overrides,
  COUNT(a.id) FILTER (WHERE a.matched_at > now() - INTERVAL '30 days') AS fires_30d,
  COUNT(a.id) FILTER (WHERE a.matched_at > now() - INTERVAL '7 days')  AS fires_7d,
  MAX(a.matched_at) AS last_fired_at,
  CASE
    WHEN COUNT(a.id) > 0
    THEN ROUND((COUNT(a.id) FILTER (WHERE a.was_overridden))::NUMERIC / COUNT(a.id), 4)
    ELSE NULL
  END AS override_rate
FROM conditional_rules r
LEFT JOIN conditional_rule_audit a ON a.rule_id = r.id
GROUP BY r.id;

ALTER TABLE bank_feed_items ADD COLUMN IF NOT EXISTS skip_ai BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE bank_feed_items ADD COLUMN IF NOT EXISTS splits_config JSONB;
```

Additive — no policy exception needed.

---

## New API endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/api/v1/practice/conditional-rules` | Bookkeeper+, flag-gated | List active + inactive rules with stats |
| `GET` | `/api/v1/practice/conditional-rules/:id` | Bookkeeper+ | Single rule detail + recent audit history |
| `POST` | `/api/v1/practice/conditional-rules` | Bookkeeper+ | Create — Zod validates the AST |
| `PUT` | `/api/v1/practice/conditional-rules/:id` | Bookkeeper+ | Update |
| `DELETE` | `/api/v1/practice/conditional-rules/:id` | Owner | Remove (audit rows preserved) |
| `POST` | `/api/v1/practice/conditional-rules/reorder` | Bookkeeper+ | Body `{orderedIds: string[]}` — re-sequence priorities |

All four enforce `CONDITIONAL_RULES_V1` server-side. All writes audit-logged at the action layer (separate from the per-fire `conditional_rule_audit`).

---

## Testing plan

| Area | Test file | Target |
|---|---|---|
| Pure condition evaluator (boundaries, every operator, AND/OR groups, regex, dates) | `conditional-rules-engine.service.test.ts` | 35+ tests (build plan §4.2 ≥30+) |
| Action executor (each action type, splits, action ordering) | Same file | 10+ tests |
| Branching (if/then/else, elif chains, depth limit) | Same file | 6+ tests |
| Pipeline integration (legacy rules skipped when conditional fires; ordering by priority) | `bank-feed.service.test.ts` (extend existing) | 4+ tests |
| CRUD routes | `conditional-rules.routes.test.ts` | 12+ tests including AST validation rejection |

Target ≥80% coverage.

---

## Out of scope (Phase 5+)

- Visual rule builder, testing sandbox, stats panel, auto-suggest, import/export — Phase 5.
- `class_id` / `location_id` condition fields — deferred until those features exist.
- Materialized stats view — regular view is fine until row count justifies it.

---

## Open questions

> If any need adjustment, stop me before Step 3.

1. **Splits via `journal_lines` not a `transaction_splits` table.** Plan literal language vs actual data model. Confirm.
2. **Defer `class_id` / `location_id` condition fields.** Underlying features don't exist. Confirm — or tell me to ship them as stubs that always fail.
3. **Audit only fires, not every evaluation.** Storage + perf reasons. Confirm — or tell me to log every evaluation despite the row-count concern.
4. **5-level branching depth limit** enforced via Zod recursive schema with depth counter. The plan says "up to 5 levels deep" — confirming I'm reading that as a hard ceiling, not a recommended limit.
5. **`continue_after_match` is a per-rule flag** (not a global pipeline mode). A rule with the flag stacks on top of subsequent matches; without the flag, first match short-circuits. Confirm semantics.
6. **`skip_ai` is a per-item state stored on `bank_feed_items`** rather than a per-tenant config. This means a rule can selectively suppress AI for a specific descriptor pattern (the common "stop suggesting accounts for ATM withdrawals" case). Confirm.

---

## Implementation order

1. Shared types/schemas/constants
2. DB schema + migration + journal entry
3. Pure evaluator + 35+ tests
4. Apply service (writes to feed item + audit row)
5. Conditional rule CRUD service + tests
6. Routes + tests
7. Pipeline hook in `runCategorizationPipeline`
8. AI-skip wiring in `categorizationService`
9. Splits-config wiring in `categorize` (post multiple journal lines)
10. Full suites green + completion report

Commit per step (`phase-4.N: brief`).

---

## Acceptance criteria

- [ ] Schema applies forward + rollback cleanly
- [ ] Pure evaluator handles every documented operator and AND/OR groups
- [ ] Branching supports if/then/else + elif chains up to 5 levels
- [ ] First-match-wins by priority; `continue_after_match` allows stacking
- [ ] Pipeline skips legacy bank rules when a conditional rule fires
- [ ] `skip_ai` action keeps the AI categorizer off that item
- [ ] `mark_for_review` action lands the row in Bucket 4 (needs_review)
- [ ] Splits action posts multiple journal_lines correctly on approval
- [ ] Audit rows are written per fire, override rate accurate via the view
- [ ] CRUD endpoints respect role + flag + tenant isolation; AST validated
- [ ] ≥35 unit tests on the pure engine; full API + web suites green
- [ ] License headers, migration policy, tsc all clean

---

**Open questions need answers (or implicit approval) before Step 1.**
