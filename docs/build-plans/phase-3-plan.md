# Phase 3 Plan — AI Categorization: Potential Matches Engine

**Build plan source:** `Build Plans/VIBE_MYBOOKS_PRACTICE_BUILD_PLAN.md` Phase 3 (lines 265–296), 19 items across 5 subsections.
**Builds on:** Phase 2 (state table, bucket workflow, Bucket 1 UI shell rendering empty state).
**Feature flag:** `AI_BUCKET_WORKFLOW_V1` (existing). No new flag; this is a deeper implementation of the same surface.
**State file:** `.practice-build-state.json` (`current_phase: 3, current_subphase: null`).

---

## Objective

Implement Bucket 1 — match incoming bank-feed transactions against **existing ledger items** so a bookkeeper can apply a one-click match instead of categorizing each row individually. Five matchers: open invoices (deposits), open bills (expenses), unposted journal entries, inter-account transfers, upcoming recurring-template hits. Composite scoring across amount + date + name. Top-3 candidates persist on `transaction_classification_state.match_candidates`. UI surfaces "Apply match" / "Not a match" / partial-payment / pending-remainder / duplicate-warning affordances on the existing Bucket 1 view.

---

## Dependencies (verified)

| Dependency | Status | Notes |
|---|---|---|
| `transaction_classification_state.match_candidates` JSONB | ✅ Phase 2a | Empty today; this phase populates it |
| `bank-feed.service.ts > runCategorizationPipeline` hook | ✅ Phase 2a | Add a Step 0 (matcher) before the existing rule + AI + state-upsert steps |
| `transactions` table with invoiceStatus / billStatus / balanceDue | ✅ Exists | `packages/api/src/db/schema/transactions.ts:8` |
| `recurring_schedules` table | ✅ Exists | `packages/api/src/db/schema/attachments.ts:34` (oddly co-located but it's the right one) |
| `cleanBankDescription` utility | ✅ Exists | `packages/api/src/utils/bank-name-cleaner.ts` |
| `bankFeedService.match()` for transaction-link | ✅ Exists | `bank-feed.service.ts:272` — sets `matchedTransactionId` |
| `paymentService.recordPayment()` for invoice payments | ✅ Exists | Will need to verify exact signature |
| `billPaymentService.payBill()` for bill payments | ✅ Exists | Same |
| `useBucket('potential_match')` hook | ✅ Phase 2b | Already wired; just needs match data to render |
| Fuzzy string similarity (Levenshtein, trigram, etc.) | ❌ Missing | Build for this phase |
| Match-apply route handler | ❌ Missing | Build for this phase |
| BullMQ queue infrastructure | ⚠️ Not wired | Per CLAUDE.md, deferred. Phase 3 keeps the matcher synchronous in `runCategorizationPipeline`, same pattern as 2a. |

---

## Architectural decisions

### D1 — Matcher runs synchronously inside `runCategorizationPipeline`

Build plan §3.3 names a "BullMQ queue: `potential-match-detector`." BullMQ isn't wired up (CLAUDE.md confirms). Ship the matcher as a synchronous step inside `runCategorizationPipeline` between the rule + AI categorization steps and the state-row upsert. Same pattern as Phase 2a's classification-state upsert.

When BullMQ lands as a separate phase, the matcher service can be invoked from a queue worker without any service-level rewrite — the pure `findMatches(tenantId, feedItem)` function is already a clean unit.

### D2 — "Trigger on new invoice/bill/JE insert" deferred

Build plan §3.3 also calls for re-matching existing pending feed items when a new invoice/bill/JE is created. Implementing this naively means a synchronous O(pending_count) scan inside the invoice/bill/JE create paths, which we don't want — those services are hot. With no BullMQ to defer the work to, I'll ship Phase 3 with **forward-only matching** (run the matcher when a feed item is ingested or recategorized; do NOT re-match on ledger inserts). I'll add an admin-callable "rematch all pending" endpoint as the manual escape hatch, plus a TODO note for the BullMQ phase.

This is a real plan deviation. Flagged in Open Questions.

### D3 — Levenshtein-based name similarity, not trigram

For the name-similarity scoring component, the standard options are:
- **Levenshtein distance** — pure JS, no deps, well-understood for short strings (vendor names are typically <40 chars)
- **PG `pg_trgm` extension** — fast, indexed, but requires DB superuser to install
- **Custom Jaccard** — trigram-based without the extension

Going with Levenshtein computed in the application layer. Vendor names are short, the candidate set per match attempt is small (≤200 open invoices/bills typically), and we don't want to require DB extensions for a self-hosted appliance. If perf becomes an issue, swap in pg_trgm later — the scoring helper is a single function.

### D4 — Apply match dispatches by candidate kind

The match candidate stores `kind: 'invoice' | 'bill' | 'journal_entry' | 'transfer' | 'recurring'`. The "Apply match" handler dispatches to the right existing service:

| Kind | Action |
|---|---|
| `invoice` | Call `paymentService.recordPayment` against the invoice for the bank-feed amount, attach the payment to the bank feed via `bank-feed.service.ts:match()` |
| `bill` | Call `billPaymentService.payBill` against the bill for the bank-feed amount, attach |
| `journal_entry` | Set `bankFeedItems.matchedTransactionId = je.id`, mark feed item matched |
| `transfer` | Pair the two opposite-sign feed items into a transfer transaction via the existing transfer-creation flow |
| `recurring` | Materialize the upcoming recurrence via `recurring.service.ts > materializeOccurrence`, then match the bank feed to it |

Each dispatch is wrapped in try/catch so a failure in one sub-flow yields a clean error message rather than leaving the system in a half-applied state. Failures revert the feed item to `pending`.

### D5 — "Not a match" demotes from `match_candidates`, not bucket

Plan says "demotes to next applicable bucket." The cleanest interpretation: drop the candidate from `match_candidates` and re-run `assignBucket`. If no other candidate scores above 0.80, the row falls into whichever bucket the AI/learning layer would naturally assign (rule / auto_high / auto_medium / needs_review).

### D6 — Composite score formula

Per build plan §3.2:
- Amount: exact 1.0, within 1% 0.85, within 5% 0.60
- Date: exact 1.0, within 3 days 0.85, within 7 days 0.60
- Name: fuzzy [0, 1]
- Composite: weighted average, threshold 0.80 to qualify for Bucket 1

Weights I'll use: `0.5 amount + 0.3 date + 0.2 name`. Amount is the strongest signal (a bookkeeping payment must equal an invoice, modulo small bank fees). Plan doesn't specify weights; I'll surface them as constants in `shared/src/constants/match-scoring.ts` so they're discoverable and tuneable.

### D7 — Top-3 candidates only

The plan says "Store top-3 match candidates." More than 3 candidates is overwhelming UI. The matcher computes all candidates for the row, sorts by composite score desc, slices to 3, persists. Anything not in the top 3 is implicitly "Not a match" for that row.

---

## Files to create

### Shared
- `packages/shared/src/constants/match-scoring.ts` — `MATCH_SCORE_WEIGHTS`, `BUCKET1_QUALIFY_THRESHOLD = 0.80`, `AMOUNT_TOLERANCE_BANDS`, `DATE_TOLERANCE_BANDS_DAYS`.
- `packages/shared/src/schemas/match-actions.ts` — Zod for `applyMatchSchema`, `notAMatchSchema`.

### API services
- `packages/api/src/utils/string-similarity.ts` — `levenshtein()`, `nameSimilarity(a, b)` (uses `cleanBankDescription` for normalization first, then Levenshtein-derived similarity in [0, 1]).
- `packages/api/src/utils/string-similarity.test.ts`.
- `packages/api/src/services/potential-match.service.ts` — five matcher functions plus the orchestrator `findMatches(tenantId, feedItem) → MatchCandidate[]`. Pure-data; no side effects beyond DB reads.
- `packages/api/src/services/potential-match.service.test.ts` — boundary tests for each matcher, scoring math, top-3 cap, threshold filter.
- `packages/api/src/services/match-apply.service.ts` — dispatch by candidate kind; calls existing payment/bill-payment/match services. Uses transactions for atomicity.
- `packages/api/src/services/match-apply.service.test.ts` — happy paths + the "wrong tenant" defenses.

### API routes
- `packages/api/src/routes/match-actions.routes.ts` — mounted at `/api/v1/practice/classification/:stateId/match-actions`. Three endpoints:
  - `POST /apply` — applies the chosen candidate.
  - `POST /not-a-match` — drops candidate index from the state row.
  - `POST /rematch` — admin-callable, re-runs `findMatches` for the state row (used by the admin "rematch all pending" path described below).
- `packages/api/src/routes/match-actions.routes.test.ts` — integration tests including tenant isolation and feature-flag gate.

### Admin escape hatch
- `packages/api/src/routes/practice-classification.routes.ts` — extend with `POST /admin/rematch-all-pending` (super-admin only). Iterates all pending feed items in the caller's tenant, re-runs the matcher. Bounded to the calling tenant; not super-fast but safe.

### Frontend hooks
- `packages/web/src/api/hooks/useMatchActions.ts` — `useApplyMatch`, `useNotAMatch`, `useRematch`.

### Frontend Bucket 1 view (replacing the empty state)
- `packages/web/src/features/practice/close-review/buckets/PotentialMatchesBucket.tsx` — substantial revision. Renders match candidate cards inline.
- `packages/web/src/features/practice/close-review/buckets/MatchCandidateCard.tsx` — shows kind icon, target details (invoice number, customer, total, balance due), score breakdown, "Apply match" + "Not a match" buttons.
- `packages/web/src/features/practice/close-review/buckets/MatchCandidateCard.test.tsx`.

### Tests
- See above.

---

## Files to modify

| File | Change |
|---|---|
| `packages/api/src/services/practice-classification.service.ts` | `gatherSignals` reads existing match candidates; bucket assignment looks at `hasPotentialMatch` derived from candidate scores |
| `packages/api/src/services/bank-feed.service.ts` | `runCategorizationPipeline` calls `potentialMatchService.findMatches` after AI categorization, threads candidates into `upsertStateForFeedItem` |
| `packages/api/src/services/practice-classification.service.ts` | `upsertStateForFeedItem` accepts optional `matchCandidates` and writes them |
| `packages/api/src/app.ts` | Mount `match-actions.routes` and the new admin `rematch-all-pending` route |
| `packages/web/src/features/practice/close-review/buckets/BucketTable.tsx` | When `bucket === 'potential_match'`, render `MatchCandidateCard` for each candidate instead of the default `<DefaultDetails>` row |
| `packages/web/src/features/practice/close-review/buckets/PotentialMatchesBucket.tsx` | Pass through to `BucketTable` with the candidate-card renderer |

---

## Schema changes

**None.** All Phase 3 data fits inside `transaction_classification_state.match_candidates` (already JSONB from Phase 2a). The candidate shape is already declared in `MatchCandidate` from Phase 2a's types.

---

## New API endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `POST` | `/api/v1/practice/classification/:stateId/match-actions/apply` | Bookkeeper+, flag-gated | Apply a specific candidate |
| `POST` | `/api/v1/practice/classification/:stateId/match-actions/not-a-match` | Bookkeeper+, flag-gated | Drop a candidate index |
| `POST` | `/api/v1/practice/classification/:stateId/match-actions/rematch` | Bookkeeper+, flag-gated | Re-run matcher for a single row |
| `POST` | `/api/v1/practice/classification/admin/rematch-all-pending` | Super-admin or owner | Tenant-scoped sweep |

All four enforce the existing Phase 2 feature-flag + role gate pattern. Audit-logged.

---

## Testing plan

| Area | Test file | Target |
|---|---|---|
| Levenshtein + name similarity | `string-similarity.test.ts` | 10+ tests: identical, one-edit, prefix, longer-vs-shorter, empty, normalization |
| Each matcher (5) | `potential-match.service.test.ts` | 20+ tests: invoice match found, no-match, amount-tolerance bands, date-window bands, multi-candidate sort, top-3 cap, threshold filter |
| Match-apply dispatcher | `match-apply.service.test.ts` | 15+ tests: each kind happy path, wrong-tenant 404, double-apply 400, partial-payment success, transfer-pair |
| Match action routes | `match-actions.routes.test.ts` | 12+ tests: auth, role, flag, tenant isolation |
| Match candidate card UI | `MatchCandidateCard.test.tsx` | 6+ tests: render kind, invoice details, button wiring, score badge |
| End-to-end via existing e2e spec | `e2e/tests/practice-close-review.spec.ts` | Add one test that creates an invoice, ingests a matching feed item, asserts the row appears in Bucket 1 |

Target coverage: ≥80% on new code.

---

## Edge case implementation

### Partial payment (build plan §3.5)
When candidate amount > feed amount on an invoice match: the candidate card surfaces "Partial payment" with a small badge. `match-apply.service` calls `paymentService.recordPayment` with the actual feed amount. `paymentService` already handles partial payments — invoice's `balanceDue` decrements, status stays `partial` until paid.

### Pending remainder
After applying a match, if the invoice still has `balanceDue > 0`, the state-row's `match_candidates` is cleared and the row moves out of Bucket 1. The bookkeeper sees the remainder on the next deposit pass-through (when another bank feed item matches the remaining balance).

### Duplicate-possible warnings
When multiple candidates have composite scores within 0.05 of each other, the card stack renders a warning banner: "Two close matches — verify before applying." Implemented as a UI hint, no backend change.

---

## Out of scope (explicitly deferred)

- **Trigger on invoice/bill/JE insert.** Plan §3.3 calls for this; deferred to a later phase that can run async (see D2). The "rematch all pending" admin endpoint is the manual escape hatch.
- **BullMQ queue.** Plan §3.3 names it; deferred to the dedicated infra phase.
- **Web-search vendor enrichment for unknown vendors when no match found.** That's Phase 2.6's territory; already stubbed.

---

## Open questions

> If any need to resolve differently from my assumption, stop me before Step 3.

1. **Skip "trigger on invoice/bill/JE insert."** Going forward-only; documented as a follow-up. Reason: synchronous re-match-on-insert is a hot-path performance risk and BullMQ is the right tool. Confirm — or ask me to wire a synchronous version anyway.
2. **Levenshtein over pg_trgm.** Easier deploy, sufficient for short vendor names. Confirm.
3. **Apply-match for `transfer` kind.** I'm proposing to pair the two opposite-sign feed items into a transfer-transaction; this means the SECOND feed item's classification state needs to be linked too. Confirm this two-sided coordination is acceptable, or if you'd rather treat the transfer match more conservatively (just stamp matchedTransactionId on this side, leave the other side for a separate match attempt).
4. **Score weight defaults `0.5 amount + 0.3 date + 0.2 name`.** Plan doesn't specify; I'm picking. Confirm or override.
5. **Top-3 candidates only.** Plan says "top-3"; I'm following. If you want all candidates above threshold (could be 5-6), say so.

---

## Implementation order

1. **Step 1 — String similarity utility + tests.** Pure function; isolated.
2. **Step 2 — Match-scoring constants in shared.**
3. **Step 3 — `potential-match.service.ts` (5 matchers + orchestrator) + tests.** No DB writes, all reads. Tests use seeded transactions.
4. **Step 4 — Wire into `runCategorizationPipeline`.** Update the existing 2a hook to thread match candidates into `upsertStateForFeedItem`.
5. **Step 5 — Update `assignBucket` + `gatherSignals` to consume `hasPotentialMatch` from stored candidates.**
6. **Step 6 — `match-apply.service.ts` + tests.**
7. **Step 7 — Routes (apply / not-a-match / rematch / admin rematch-all) + tests.**
8. **Step 8 — Frontend hooks + Bucket 1 UI + tests.**
9. **Step 9 — Full suite green + completion report.**

Commit per step (`phase-3.N: brief`).

---

## Acceptance criteria

- [ ] All 19 build-plan checklist items in Phase 3 implemented and verified
- [ ] Five matchers produce candidates per the scoring spec
- [ ] Composite score with documented weights, ≥0.80 threshold for Bucket 1
- [ ] Top-3 candidates persist on state row
- [ ] Bucket 1 UI renders candidate cards with score breakdown
- [ ] "Apply match" dispatches to the right service per kind, posts the transaction, links the feed item
- [ ] "Not a match" drops the candidate, recomputes bucket
- [ ] Partial-payment + pending-remainder + duplicate-warning UI affordances render correctly
- [ ] All matcher / scoring / dispatcher logic has ≥80% coverage
- [ ] Full API + web suites pass; license + migration policy + tsc clean
- [ ] e2e spec extended with one Bucket 1 happy-path test

---

**Open questions need answers (or implicit approval) before Step 1.**
