# TB module — structured review packet (Phase 15.4)

For: Kurt. Built 2026-08-07 across phases 0–15 of the TB build plan.
Everything is behind `TRIAL_BALANCE_V1` (default OFF — flip it per
tenant under Admin → Feature Flags when ready to trial).

## What shipped

- **Engine (ADR-TB-01):** five-column workpaper computed from the GL at
  request time; cash basis rides the exact same virtual-ledger CTE as
  every other report; Redis cache keyed on a trigger-maintained
  glVersionStamp (exact invalidation — RJE edits bump it too).
  Perf: 2,000 accounts / 100k txns → 546ms accrual / 664ms cash
  (target < 1500ms).
- **AJEs (D10/D17):** real GL entries, txn_type `aje`, AJE-001 per
  client per FY (concurrency-proven), closing-date-exempt, purple
  badges + filter everywhere, reverse/duplicate, firm-only via the tb
  router with the generic routes fenced.
- **Tax RJEs (ADR-TB-03):** off-GL, net-to-zero enforced, proven
  byte-identical GL before/after in tests.
- **Activity units (D3/D13):** line-level tag → unit splits, default
  unit fallback, per-unit assignment resolution.
- **Codes (ADR-TB-05):** 2,846-row TY2025 seed imported as v1;
  versioned re-imports with dry-run diff; FIRM: namespace isolation
  proven; AI auto-assign (accept-only, confidence-badged) with firm
  cross-client few-shot context.
- **Leadsheets (D18):** seeded A–M structure, tickmarks (12 standards),
  notes, preparer→reviewer sign-offs stamped with the glVersionStamp —
  staleness + re-sign chains tested; tb_status 'complete' gates on
  reviewer sign-offs.
- **Closing date (ADR-TB-04):** 423 TB_PERIOD_LOCKED, client hard
  block, staff override modal → audited `override` rows, closed-period
  drift banner. NOTE: this changed the lock rejection from 400 to 423
  app-wide (importers/jobs fail items gracefully — tested).
- **M-1/M-2 (D16/D18):** bridge reconciles by construction; unflagged
  differences surfaced as the review diagnostic; M-2 role mapping with
  per-entity overrides.
- **Reports (12):** 13-report family shared between routes and Report
  Packs; Tax Return Order follows seed sort_order.
- **Exports (D4):** UltraTax/Lacerte/CCH/GoSystem/generic/working-TB
  with hard validation gates + firm-admin-only balance override;
  history with staleness.

## Test evidence

44 TB vitest specs green (invariants: Adjusted ≡ GL per basis, ΣDR=ΣCR
per column, RJEs invisible to GL, splits sum to account, numbering
concurrency, sign-off ordering/staleness, 423 matrix, export gates) +
full-workflow 1120S E2E + full API/web regression suites + prod build.

## Open items / decisions to confirm

1. **Vendor file layouts** (docs/tb/exports/README.md) are reasoned
   from the crosswalk, not verified against current vendor import
   specs — check UltraTax/Lacerte/CCH/GoSystem before first client use.
2. **Deferred:** export consolidation options (Vibe TB screenshot 9),
   dedicated Tax Mapping screen, Schedule M-3, state apportionment,
   K-1 preview, depreciation bridge, per-form override modals beyond
   the JE form (QUESTIONS.md #8–#10 + plan §6).
3. **4-4-5 calendars** don't exist platform-wide; TB is month-granular.
4. Prod rollout: run the tax-code seed once after deploy, then enable
   the flag for a pilot tenant.
