# PHASES.md — MyBooks Tax Estimator (plan v2.2, adapted to this repo)

Complete phases in order, except where ORCHESTRATION.md §4 allows parallel waves: Phase 2 runs in the background alongside Phases 3–8; Phases 3 and 4 run in separate worktrees; Phase 9 may run alongside Phase 8; Phase 11 UI starts against the engine DTO during Phase 6. Each phase's **Agents** line is binding. Each phase ends with: passing tests (run per MODULE.md D13), `tsc --noEmit` clean in every touched workspace, `scripts/check-license-headers.sh`, `scripts/check-any-baseline.sh` and `scripts/check-migration-policy.sh` green, a conventional commit on `feat/tax-estimator`, and a PROGRESS.md update. All paths below are relative to the repo root; MODULE.md "Where things live" is authoritative.

**Hard gates (MODULE.md D12):** Phases 6–10 may not start until Kurt has marked the Phase 1 federal checklist and the Phase 2 MO/AR checklist **verified** in PROGRESS.md.

---

## Phase 0 — Discovery and scaffolding
**Agents:** orchestrator (opusplan) · `repo-scout` ×3 in parallel (haiku: backend / frontend / infra) · scaffolding by `schema-builder` + `api-builder` (sonnet).
- **Agent setup first:** run `bash features/tax-estimator/claude-config/install.sh` (copies the agent files into the git-ignored `.claude/agents/` and writes `.claude/settings.json` if absent), confirm Claude Code ≥ 2.1.255, run `/agents` and verify all 12 agents.
- Write a **Repo map** in PROGRESS.md covering: `companies` / `tenants` / `firms` / `firm_users` / `tenant_firm_assignments` and how the Clients screen reads across tenants; `requireFirmStaff`, `companyContext`, `requireResource`, `requireFeatureFlag`; chart of accounts and account types; `report.service.ts` P&L builders and cash-basis engine; TB `computeWorkpaper`, `account_tax_assignments`, `company_tax_profiles`, tax-code `activity_type`; bank/credit-card reconciliation status (closed-through month per account); `transactions` (confirm a side table is required for the non-recurring flag); fiscal helpers (month-granular, TB10); money utilities (`shared/src/utils/money.ts`, decimal.js); `auditLog`; permission registry; Report Pack registry + `report-pack-render.ts` + PDF renderer; portal contact model and `portal-financials-public.routes.ts`; feature-flag registry; migration journal and `check-migration-policy.sh`; vitest setup and the D13 test-DB recipe; UI kit (`components/ui`, shared table system); knowledge-base files.
- Scaffold: `packages/shared/src/tax-estimator/{engine,parameterKeys.ts,types.ts}`, `packages/shared/src/schemas/tax-estimator.ts`, `packages/api/src/db/schema/tax-estimator.ts` (empty export), `packages/api/src/services/tax-estimator/`, `packages/api/src/routes/tax-estimator.routes.ts` (mounted, guarded, returns 404 while empty), `packages/web/src/features/tax-estimator/`. Register `TAX_ESTIMATOR_V1` (flag list + default-off set), the `tax_estimator` permission resource, and `taxEstimator: 'base'` in the module manifest.
- Wire `python3 features/tax-estimator/docs/reference-calc/rivera_fixture.py` into an npm script (`test:tax-oracle`) that regenerates the expected JSON and fails if it differs from the committed file.

**Acceptance:** repo map written; scaffolding compiles in all three workspaces; the oracle script runs and matches the committed JSON; flag/resource/manifest registered with their existing tests passing.

## Phase 1 — Federal tax parameters
**Agents:** `tax-law-researcher` (opus) for seeds and verification · `schema-builder` + `api-builder` (sonnet) for tables, registry and service · `ui-builder` (sonnet, worktree) for the admin screen in parallel · `test-writer` (sonnet) · gate: `phase-reviewer` (opus) **then Kurt's sign-off (D12)**.
- Tables `tax_parameters` and `tax_parameter_overrides` (super-admin overrides only, D4; status `override` | `provisional`, reason, created_from_year) in the consolidated migration.
- **Registry** `packages/shared/src/tax-estimator/parameterKeys.ts` containing **every federal key in MODULE.md** (including the new `passive.rental_allowance*`, `charity.nonitemizer.{fs}`, `return_due_date`, `sch_ai.period_months`), with type, unit and filing-status expansion. The engine reads only through the registry.
- **Seed 2025 and 2026 for every key** under `packages/api/src/db/seeds/tax-estimator/federal/`. Verify against Rev. Proc. 2024-40 / 2025-32, OBBBA, the SSA announcement, IRS retirement/HSA notices, Forms 1040-ES / 2210 / 1120-W and the quarterly underpayment-rate news releases. Anything unverifiable is seeded `unverified` and listed in OPEN-QUESTIONS.md.
- `getParameters(year)`: resolves override/provisional → seed → missing-year fallback, and returns statuses, `isFallback` and `fallbackYear`. Completeness check.
- **Admin UI** (`html/04-tax-parameters-admin.html`, UI-SPEC §04) under `/admin/tax-parameters`, super admin only: year tabs, **Federal | States** switch, grouped table, override/revert, **Create year from prior year**, shipped-vs-provisional diff, recent changes.
- **Guard test** against numeric and date literals in `packages/shared/src/tax-estimator/engine/**` (no ESLint in this repo — write it as a vitest that scans the files).
- **Sign-off checklist** written to PROGRESS.md: one row per key per year with value, citation, status.

**Acceptance:** seeds complete for both years; resolution, override, provisional, fallback and diff tested; guard passes; audit entries written; checklist present. **Engine phases wait for Kurt's "verified".**

## Phase 2 — State estimate rules (41 states + DC) — parallel-safe
**Agents:** `state-rules-researcher` (sonnet, background, worktree) in 5 batches of ~8 jurisdictions, max 3 running at once, **MO + AR alone in batch 1** · `tax-law-researcher` (opus) audits each batch before merge · `schema-builder` / `ui-builder` (sonnet) for tables and the States view · gate: every row cited, MO/AR audit pass **and Kurt's sign-off on MO/AR (D12)** · then **R5** state sample review (`fable-process-reviewer`).
- Tables `state_estimate_rules` and `state_estimate_rule_overrides` (super admin), keys from MODULE.md incl. `nonresident_method`, plus a jurisdiction registry (50 states + DC).
- **Seed MO and AR first, fully verified.** Then every remaining jurisdiction with a broad personal income tax for 2025 and 2026 from each revenue department's estimated-payment instructions. Record `has_income_tax=false` states and the interest/dividend-only states.
- Seeds under `packages/api/src/db/seeds/tax-estimator/state-rules/<ST>.ts`, one file per jurisdiction, `source_citation` and status on every row.
- Same resolution, override, create-from-prior and fallback behaviour as federal. A jurisdiction without rules falls back to the federal pattern, marked `verify`.
- Admin UI: the **States** view on the parameters screen.

**Acceptance:** all 42 jurisdictions present for both years; MO/AR verified and signed off; every row cited; fallback tested.

## Phase 3 — Taxpayers, persons, links (firm-scoped, D1)
**Agents:** `schema-builder` + `api-builder` (sonnet) · `ui-builder` (sonnet, worktree) · `test-writer` · runs in parallel with Phase 4's backend in a separate worktree · gate: `phase-reviewer`.
- `tax_est_taxpayers` (firm_id, filing status, resident state, safe-harbor override, `portal_shows`), `tax_est_persons` (role, name, DOB, blind, SEHI months), `tax_est_links` (person, **tenant_id + company_id**, tax year, `profit_pct`, `loss_pct`, `capital_pct`, `partner_se_status` + memo, `is_officer`, `activity_type`, `active_participation`, `qbi_eligible` + reason, `allowed_loss_override` + reason).
- **Firm scope service:** `allowedTenantIds(userId)` from `firm_users` → active `tenant_firm_assignments`; every link write validates the company's tenant is in the set (`TE_TENANT_NOT_MANAGED`, 404); every read joins on the set.
- Validation: profit % and loss % per company ≤ 100% (warn if under); `limited` only for partnerships; officer only for S corps; `rental` defaults `qbi_eligible` from the entity's `rental_qbi_trade_or_business`.
- CRUD API + UI (Taxpayer list/detail with persons and links; company picker searches across the firm's tenants and shows the client name).
- Portal mapping: `portal_contacts` ↔ taxpayer via a `tax_est_taxpayer_contacts` table, plus the new `portal_contact_companies.tax_estimates_access` column.

**Acceptance:** CRUD, validation, **firm/cross-tenant isolation tests** (unmanaged tenant 404; firm A never sees firm B; readonly role cannot mutate; client user_type 404) pass.

## Phase 4 — Entity tax setup: TB-derived type/method, treatments, non-recurring, readiness (D3, D8)
**Agents:** `books-integration-engineer` (opus) for the P&L provider, treatment service, readiness and cache · `schema-builder` (sonnet) for tables · `ui-builder` (sonnet, worktree) for screen 06 · `test-writer` · gate: `phase-reviewer` + **R1** books→tax review (`fable-process-reviewer`; re-checked after Phase 6).
- `tax_est_entity_settings` (tenant_id, company_id): `tax_entity_type` (only used when no TB profile), `tax_method` override, `is_sstb`, `large_corporation`, `farmer_override`, `rental_qbi_trade_or_business`, `state_sourcing`; per-year rows `tax_est_entity_year_inputs` (`w2_wages_override`, `ubia`).
- **Entity type resolver:** `company_tax_profiles.return_form` + TB activity type → estimator type (table in MODULE.md D3); fall back to the estimator field; readiness warning when neither exists.
- `tax_est_account_treatments` (tenant_id, company_id, account_id, treatment, pct, payment_taxpayer_id, payment_person_id, payment_jurisdiction, non_recurring). Suggested defaults by account type and name pattern ("meals" → 50% nondeductible; "owner health" → owner_sehi; "estimated tax" → estimated_tax_payment; wage/salary/officer compensation accounts → `w2_wages`). **Suggestions are never auto-applied without confirmation.**
- `tax_est_transaction_flags` (tenant_id, transaction_id, non_recurring) — side table; `transactions` is not altered.
- **P&L provider service:** P&L by company and month **on the effective tax method** via the existing report builders / TB workpaper; applies TB character + estimator treatments; returns tax-basis lines by character, owner-level reclass amounts, estimated-payment transactions, recurring vs non-recurring split, GL actuals for linked adjustments, gross farming income (current and prior year), and the `w2_wages` total.
- **Readiness service:** last closed month, unreconciled accounts in range, suspense/uncategorized balances, unassigned accounts with activity, missing tax fields, unmanaged-tenant links.
- **UI:** Entity tax setup screen (`html/06-entity-tax-setup.html`, UI-SPEC §06), reached from the company's TB settings and from the taxpayer's links.
- Redis cache of month aggregates keyed by `gl_version_stamp` (TB1/TB6 pattern), invalidated on treatment changes.

**Acceptance:** Rivera Plumbing fixture: books 115,400 → tax-basis profit 128,000 with an SEHI reclass of 10,800 and a meals add-back of 1,800; non-recurring exclusion tested; readiness tested; entity type resolved from a TB profile and from the fallback field; cross-tenant read goes through the allowed-tenant set.

## Phase 5 — Annual settings, scenarios, adjustments
**Agents:** `schema-builder` + `api-builder` (sonnet) · `ui-builder` (sonnet, worktree) · `test-writer` · escalate itemized/Schedule 1-A input validation questions to opus · gate: `phase-reviewer`.
- `tax_est_years` (taxpayer, tax year): **`prior_year_tax_encrypted`, `prior_year_agi_encrypted` (D9)**; prior-year flags (12-month, filed); safe-harbor rule override; rate mode + effective-rate override; deduction mode; itemized detail; Schedule 1-A inputs per person; nonrefundable and refundable credits; HSA coverage type per person.
- `tax_est_scenarios` (Base auto-created; clone copies every child row), `tax_est_adjustment_types` (seeded catalog + firm custom; flags incl. `is_capital_gain_lt/st`, `is_qualified_dividend`, `is_reit_dividend`, `is_ptp`, `is_1231`, `non_recurring`; editable `pct`), `tax_est_adjustments`, `tax_est_state_rows` (scenario, residency, jurisdiction, effective rate, base, sourced income, memo).
- Firm settings (`tax_est_firm_settings`, firm_id): safe-harbor default (default `lesser_of`), disclaimer text, `portal_shows` default.
- Allocation module (pure, in shared).
- UI: Annual settings (`html/02-annual-settings.html`, UI-SPEC §02).

**Acceptance:** allocation, cloning, itemized-vs-standard selection, state-row validation (exactly one resident), encrypted prior-year round-trip (and the value appears in the re-encryption sweep's column list) are tested.

## Phase 6 — Engine core: federal income tax
**Gate to start:** D12 sign-offs recorded.
**Agents:** orchestrator plans in plan mode (opus), then delegates · `tax-engine-architect` (**fable**, xhigh) · `test-writer` (sonnet) writes each function's tests first · `ui-builder` starts Phase 11 screens against the result DTO in a worktree · gate: `oracle-verifier` (**fable**) + `phase-reviewer`.
- Range and projection; MODULE.md steps 1–2, 4–8, 10–12, 14: character-aware income; profit/loss allocation; SE tax; retirement/HSA/SEHI limits with caps and warnings; AGI; standard (65/blind) vs itemized (SALT cap/phase-down) + non-itemizer charitable when parameterised; Schedule 1-A; **bracket tax with the QD/LTCG worksheet**; effective-rate override; credits. Trace includes the marginal rate.

**Acceptance:** Rivera **base** matches the oracle for every line to the federal total (QBI stubbed from fixture input until Phase 7); truck scenario **SEP capped at 12,639** with a warning; effective-rate override test; LTCG worksheet test across 0/15/20; SEHI eligibility test.

## Phase 7 — QBI, Additional Medicare, NIIT, loss limitations
**Agents:** `tax-engine-architect` (fable) · `test-writer` (sonnet) · gate: `oracle-verifier` (fable) + **R2** (`fable-process-reviewer`).
- QBI full incl. **W-2 wages from the `w2_wages` total / override and UBIA (D8)**, REIT/PTP, QD-inclusive net capital gain in the overall limit, minimum deduction.
- Additional Medicare and NIIT.
- Loss limitations: passive vs nonpassive netting with suspended amounts; **§469(i) $25k allowance with active participation and MAGI phase-out (D10)**; §461(l) EBL with NOL note; `allowed_loss_override`.

**Acceptance:** Rivera base + three scenarios match the oracle through the federal total; LP rental excluded from QBI and included in NII; QBI tests below/in/above threshold (SSTB and non-SSTB, wage-limited, UBIA-limited, blank UBIA → warning), loss netting, minimum deduction; NIIT test; passive loss suspended vs allowed under §469(i) incl. phase-out; EBL test.

## Phase 8 — State engine
**Agents:** `tax-engine-architect` (fable) · gate: `oracle-verifier` (fable). May run alongside Phase 9.
- Resident/nonresident with credit for other-state tax; sourced income derived or manual; C corp apportionment; nonresident flat-rate label in the trace.

**Acceptance:** Rivera: MO resident 7,902 gross − 312 AR credit = 7,590; AR nonresident 312; state total 7,902. A test where the other-state rate exceeds the resident rate so the credit is limited.

## Phase 9 — C corp and Sch F
**Agents:** `tax-engine-architect` (fable) · `test-writer` · gate: `oracle-verifier` (fable).
- C corp path (entity-level brackets → `ccorp.rate`, fiscal-year installments, large-corp first-installment rule with recapture, no prior-year option when short/zero, apportionment). Sch F farmer test (current or prior year, joint gross income, override); 66⅔% rule; single installment; Mar 1 note; fishermen flag.

**Acceptance:** FYE-June C corp fixture with large-corp recapture; farmer qualifying on the prior year only; non-qualifying farmer falling back to regular rules.

## Phase 10 — Payments, safe harbor, Schedule AI, vouchers, penalties
**Agents:** `tax-engine-architect` (fable) for safe harbor, Sch AI, application and penalty math · `schema-builder` + `api-builder` (sonnet) for payment tables and the GL payment reader · gate: `oracle-verifier` (fable) + **R3** (`fable-process-reviewer`).
- `tax_est_payments` (manual + GL-derived from `estimated_tax_payment` accounts, deduplicated by transaction id; prior-year overpayment on the due date).
- Safe harbor: both rules; recommendation from firm default (`lesser_of`) or override; prior-year availability; min balance due.
- **Schedule AI per D7:** annualize actual tax-basis income through each period end (12/31 uses the projection); full-year standard deduction and credits; Part II SE tax on the prorated wage base; applicable percentages; each installment = lesser of regular or annualized with recapture.
- Payments applied to the **earliest unpaid installment**; withholding even.
- **§6654 penalty per D7:** per-installment accrual from due date to the earlier of payment or `return_due_date`, quarterly rates. Q4 file-and-pay note; farmer Mar 1 note.
- State vouchers from `state_estimate_rules`.

**Acceptance:** Rivera: required 32,246 (lesser of); 110% prior 34,650 shown; installment 8,062; Q1 +38 and Q2 +77 carried; **Q3 short 485, cured by the Jan 15 payment, penalty ≈ $11**; **Q4 7,046**; Schedule AI period-3 cumulative 24,185 ≈ 3 installments. MO per-installment 1,208; AR none required (under threshold). Seasonal fixture (Phase 14) where Schedule AI lowers early installments.

## Phase 11 — UI: summary and scenarios
**Agents:** `ui-builder` (sonnet), finishing screens started in Phase 6 · `test-writer` · escalate trace or warning-presentation logic to opus · gate: `phase-reviewer` + manual QA list.
- Build to `html/01-estimate-summary.html` and `html/03-scenario-compare.html` (UI-SPEC §01, §03) plus "States to build that the mockups don't show". YTD tax-basis + full-year projection (no "period tax" column). Readiness banner; safe-harbor card with both rules; Schedule AI and penalty columns; marginal-rate tile; nonresident flat-rate label. Scenario compare with marginal rate and safe-harbor rows.
- Nav entry + route guard (flag + staff + resource) per `useTrialBalanceVisibility.ts` / `App.tsx`.
- **Standalone Print/Download** on the taxpayer screen (D15) producing the same PDF as the Report Pack section.

**Acceptance:** component tests (loading/error/empty states); manual QA checklist in PROGRESS.md.

## Phase 12 — Snapshots, assumptions, disclaimer, audit
**Agents:** `api-builder` + `schema-builder` (sonnet) · `books-integration-engineer` (opus) for the assumptions block · `ui-builder` · gate: `phase-reviewer` + **R6** (`fable-process-reviewer`).
- `tax_est_snapshots`: immutable (`TE_SNAPSHOT_IMMUTABLE`); stores resolved federal and state parameters with statuses, readiness warnings, assumptions block, disclaimer text in effect. Finalize; history; read-only view; compare with live.
- Assumptions block from the trace. Audit hooks (`auditLog` with executor) on settings, adjustments, treatments, links, payments, parameter/state-rule overrides, firm defaults, disclaimer. Data dictionary: prior-year tax and AGI tagged as tax return information (§7216).

**Acceptance:** a snapshot stays unchanged after any input or parameter change; assumptions block complete for the fixture.

## Phase 13 — Report Pack and portal
**Agents:** `api-builder` + `ui-builder` (sonnet) · gate: `phase-reviewer` (portal isolation test) + **R4** (`fable-process-reviewer`).
- Report Pack section `tax-estimate` (group "Tax"): `REPORT_CATALOG` entry with a `taxpayerId` option (choices = taxpayers linked to the pack's company), render-map entry in `report-pack-render.ts`, endpoint in `reports.routes.ts`, flag + resource gate. Generating it creates a snapshot. Same renderer as the standalone PDF (D15).
- Portal (`html/05-client-portal-phone.html`): `portal-tax-estimates-public.routes.ts` gated by `CLIENT_PORTAL_V1` + `TAX_ESTIMATOR_V1` (contact's tenant) + `tax_estimates_access`; **live by default (D10)** from a Redis-cached computation with an as-of label, or latest snapshot when `portal_shows = 'snapshot'`; payments by jurisdiction, year total, history, voucher download; firm disclaimer. Never other owners, adjustments, rates or traces.

**Acceptance:** PDF for each entity type; portal isolation test (contact without access 404; contact sees only linked taxpayers; no trace fields in the payload).

## Phase 14 — Hardening, merge readiness
**Agents:** `oracle-verifier` (fable) writes the new oracles · `test-writer` (sonnet) wires the golden suite · `api-builder` (sonnet) for performance/cache · `repo-scout` (haiku) for the docs inventory, docs by `api-builder` · final gate: **R7** (`fable-process-reviewer`).
- **Golden suite:** Rivera; seasonal Sch C (Schedule AI benefit); FY C corp with large-corp recapture; farmer on prior year; high-income MFJ (110%, Additional Medicare, NIIT, QBI phase-in **with wage/UBIA limits**, SALT phase-down, LTCG 15/20%); passive loss + §469(i) allowance + EBL; senior couple with Schedule 1-A; multistate with a higher-rate source state. Sibling Python oracles beside `rivera_fixture.py`.
- Performance: under 500 ms for 10 entities × 24 months with the cache.
- Docs `docs/tax-estimator/MODULE.md` (surfaces, operating notes, annual federal/state update procedure, treatment-map guide, §7216 note) and knowledge-base updates (`articles.ts`, curated md).
- **Merge readiness (D6):** merge `main` into the branch; renumber the consolidated migration to the next free journal idx; `check-migration-policy.sh`, full api + web suites (serial), both tsc, license headers, any-baseline all green; PROGRESS.md marks the feature complete. Merge to main is Kurt's call; deploy per the repo's release recipe with the flag OFF.

**Acceptance:** full suite green; docs complete; migration numbered; PROGRESS.md complete.

---

## Backlog (do not build now)
State bracket tables; AMT; kiddie tax; full basis/at-risk tracking by year; QBI aggregation and carryforward across years; PTET; local taxes; adjusted seasonal installment method (C corp); tax provision journal entries; carrying the estimate forward into next year's prior-year inputs; preparer/reviewer sign-off workflow; nonresident ratio method per state; withholding by actual pay dates.
