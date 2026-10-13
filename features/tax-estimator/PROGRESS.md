# PROGRESS.md — MyBooks Tax Estimator (plan v2.2)

(Was STATE.md; renamed because the repo git-ignores that filename. This file IS committed.)

## Status
- Current phase: **Phases 0-13 built, reviewed (R1-R5) and fixed; Phase 14 hardening in progress (seasonal golden fixture, final Fable audit R7, full regression). Engine started at Kurt's risk before sign-off (D12a); Kurt's checklists still OPEN. Nothing merged or deployed; flag OFF.**
- Plan version: v2.2 (2026-10-11 — repo adaptation + owner decisions D1–D16 folded in; v2 = Oct 8 CPA review)
- Branch: `feat/tax-estimator` (from main @ `ecac490a`, v0.9.218)
- Engine version: 1.0.0-rc.1
- Target: usable for Q4 2026 vouchers (Jan 15, 2027); slip accepted (D14)

## Hard gates
| Gate | Owner | Status |
|---|---|---|
| Phase 1 federal parameter checklist verified | Kurt (CPA) | ⬜ |
| Phase 2 MO + AR rules checklist verified | Kurt (CPA) | ⬜ |
| Merge to main (Phase 14) | Kurt | ⬜ |

## Phase log
| Phase | Status | Lead agent (model) | Commit(s) | Notes |
|---|---|---|---|---|
| 0 Discovery & scaffolding | ✅ 2026-10-11 | orchestrator (direct; repo already surveyed by an Explore agent) | see git log | flag/resource/manifest registered, router + firm-scope service + 10 isolation tests, migration 0201 (flag seed), oracle npm script |
| 1 Federal tax parameters | ✅ built 2026-10-11, ⏳ awaiting Kurt's sign-off | tax-law-researcher (opus) + schema/api/ui-builder (sonnet) | see git log | registry 149 keys/yr; 2025: 136 verified/13 unverified; 2026: 144/5; admin screen + API + 41 tests |
| 2 State estimate rules (41 + DC) | ✅ built 2026-10-11: all 51 jurisdictions seeded and opus-audited (1,050/1,110 rows verified); ⏳ Kurt's MO/AR sign-off (D12); R5 Fable review in progress | state-rules-researcher (sonnet), MO/AR researcher (opus) | see git log | awaiting Kurt's MO/AR sign-off (D12) |
| 3 Taxpayers, persons, links (firm-scoped) | ✅ built 2026-10-11 | schema/api/ui-builder (sonnet) | see git log | 22 route+service tests incl. cross-tenant isolation; web pages + sidebar group |
| 4 Entity tax setup, treatments, readiness | ✅ backend + Entity tax setup screen built 2026-10-11; R1 review pending | books-integration-engineer (opus) | see git log | Rivera 115,400 → 128,000 reproduced; 31 tests |
| 5 Settings, scenarios, adjustments | ✅ built 2026-10-11 | schema/api/ui-builder (sonnet) | see git log | allocation module, encrypted prior-year data, firm settings; 27 api + 12 web tests |
| 6 Engine core (federal income tax) | ✅ 2026-10-12 | tax-engine-architect (fable) | 94c96180 | Rivera base/truck/raise match oracle; R2 fixes 0ac225bc |
| 7 QBI / Medicare / NIIT / losses / §469(i) | ✅ 2026-10-12 | tax-engine-architect (fable) | f70b3803 | full QBI, Form 8959/8960, Form 8582 allocation after R2 |
| 8 State engine | ✅ 2026-10-12 | tax-engine-architect (fable) | 58ef5322 | MO 7,590 + AR 312 = 7,902; AZ/GA/PA/ME/NM gates (D12b) |
| 9 C corp & Sch F | ✅ 2026-10-12 | tax-engine-architect (fable) | d356debd | large-corp recapture, farmer 66⅔% |
| 10 Payments, safe harbor, Sch AI, penalties | ✅ 2026-10-12 | tax-engine-architect (fable) | d356debd, b46618bf (10b service + DB) | Rivera via DB matches oracle; penalty $11 |
| 11 UI summary & scenarios + standalone PDF | ✅ built 2026-10-12 (UI never opened in a browser; manual QA open) | ui-builder (sonnet) | f642e39b |  |
| 12 Snapshots, assumptions, audit | ✅ 2026-10-12 | integration engineer (opus) | ad097aa0 | immutable encrypted snapshots, assumptions block, encrypted cache |
| 13 Report Pack section & portal | ✅ 2026-10-12 | opus | 21165e3b; R3 fixes 9a979aa1; R4 fixes 6b0cb4b3 | R4 blocker fixed |
| 14 Hardening, docs, merge readiness | ⏳ docs a6856ab0 done; oracle batch 1 (seasonal, late payments, MFS, high-income, SALT) + batch 2 (FY C corp recapture, farmer prior-year, §469(i)+§461(l), senior Sch 1-A, multistate + AZ/GA/PA gates) + perf guard done 2026-10-12 (Q37; engine Sch 1-A rounding fix); R7 + full regression in progress | oracle-verifier (fable) |  | `scenarios2_fixture.py`, `oracle.scenarios2.golden.test.ts`, `performance.test.ts` (12.9 ms median) |

## Decisions made during build
| Date | Decision | Source |
|---|---|---|
| 2026-10-11 | D1–D16 recorded in MODULE.md; defaults 5, 8, 9 changed; Q13–Q24 added | Kurt, Q&A with Claude |
| 2026-10-11 | Oracle corrected (Schedule AI period-3 column; event-driven §6654 penalty); `rivera_expected.json` regenerated; base total 43,732 unchanged | Review (Q13, Q14) |
| 2026-10-11 | Kit renamed for the repo: CLAUDE.md → MODULE.md, STATE.md → PROGRESS.md, QUESTIONS.md → OPEN-QUESTIONS.md; agents under `claude-config/agents/` with `install.sh` because `.claude/` is git-ignored | Review |

## Usage log
One row per working session so model shares can be tuned (ORCHESTRATION.md §7).

| Date | Phase | Session / agent | Model | Effort | 5-hr windows used | Escalations | Notes |
|---|---|---|---|---|---|---|---|

## Fable deep reviews
| ID | Process | Date | Verdict | Critical / Major / Minor | Fixes merged |
|---|---|---|---|---|---|
| R1 | Books → tax-basis income | 2026-10-11 | FAIL → fixed | 16 findings | f746d98f (re-check in R3) |
| R2 | Engine (phases 6-10) | 2026-10-12 | FAIL → fixed | 1 blocker / 3 major / 19 minor | 0ac225bc |
| R3 | Service layer | 2026-10-12 | PASS-WITH-FIXES → fixed | 0 / 6 / 12 | 9a979aa1 |
| R4 | Portal + Report Pack security | 2026-10-12 | FAIL → fixed | 1 / 2 / 7 | 6b0cb4b3 |
| R5 | State rules sample | 2026-10-11 | PASS-WITH-FIXES → fixed | see review | f746d98f |
| R6 | Parameter lifecycle | | | | |
| R7 | Final tax-logic audit | | | | |

## Escalations
_(Task, from tier → to tier, reason, outcome.)_

## Repo map
_(Phase 0, 2026-10-11. Paths relative to repo root.)_

**Tenancy and firms.** `tenants` is the isolation unit; every books table is `tenant_id`-keyed. `companies` (tenant_id, business_name, ein, entity_type, fiscal_year_start_month, accounting_method, lock_date) is the "entity" (TB2); company chosen by `X-Company-Id` via `middleware/company.ts`. `firms`, `firm_users` (firm_role firm_admin|firm_staff|firm_readonly, capabilities jsonb), `tenant_firm_assignments` (one active firm per tenant), `user_tenant_access` (per-user per-tenant reach). The only existing cross-tenant read is the Clients screen (`services/client-banking-status.service.ts`, `routes/auth.routes.ts` accessible-tenants/*) behind `requireSessionAuth`.

**Guards.** `authenticate` + `requireSessionAuth` (`middleware/auth.ts`), `requireFeatureFlag(flag)` (`middleware/feature-flag.ts`, 404 when off), `requireResource(key)` (`middleware/permission.ts`, map in `shared/src/constants/permissions.ts`), firm helpers in `middleware/firm-access.ts` (path-based; the estimator uses its own `middleware/tax-estimator-scope.ts`). Client `user_type` gets 404 on firm-side routers (TB13).

**Books and reports.** P&L / BS / cash-basis engine in `services/report.service.ts` (`buildProfitAndLoss`, `cashBasisLinesWith`, `getFiscalYearStart`, `PLResult`); TB `computeWorkpaper` + `getGlVersionStamp` in `services/tb/balance-engine.service.ts` (Redis-cached by gl_version_stamp, TB1/TB6); `buildTbTaxBasisPl`, `buildTbCodeSummary` in `services/tb/tb-reports.service.ts`. Account→tax code: `account_tax_assignments` (per company/account/optional activity unit, effective_tax_year); `company_tax_profiles.return_form` ∈ 1040|1065|1120|1120S; tax-code `activity_type` ∈ business|rental|farm|farm_rental. Fiscal awareness is month-granular only (`fiscal_year_start_month`, TB10). Payroll import tables exist (`db/schema/payroll.ts`) but D8 reads wages from flagged accounts.

**Money and crypto.** `decimal(19,4)` columns; `decimal.js` is an api dependency (not shared); `shared/src/utils/money.ts` string helpers. `encrypt()/decrypt()` in `utils/encryption.ts`; `services/credential-reencrypt.service.ts` enrols every top-level `*_encrypted` text column automatically from `information_schema`.

**Audit and errors.** `auditLog(tenantId, action, entityType, entityId, before, after, userId?, executor?)` in `middleware/audit.ts` (actions create|update|delete|void|login|download|signoff|override). `AppError.{badRequest,forbidden,notFound,locked}`; codes are inline SCREAMING_SNAKE (`TE_*` for this module).

**Flags / permissions / manifest.** `PRACTICE_FEATURE_FLAGS` (`shared/src/constants/feature-flags.ts`), `FLAGS_DEFAULT_OFF_FOR_NEW_TENANTS` (`services/feature-flags.service.ts`), `tenant_feature_flags`; seeding pattern in `0189_financial_statements.sql`. `MODULE_LICENSE_TIERS` in `shared/src/constants/modules.ts`.

**Report Packs.** `REPORT_CATALOG` + `getReportDef` in `shared/src/reports/registry.ts`; server render map `services/report-pack-render.ts`; ad-hoc endpoint map in `routes/reports.routes.ts` (~line 1743); packs are pinned to one `company_id` (`db/schema/report-packs.ts`).

**Portal.** `portal_contacts`, `portal_contact_companies` (per-contact booleans: financials/files/questions/banking/billPay/categorize/bankRepair/billUpload), `routes/portal-*.routes.ts` (model: `portal-financials-public.routes.ts`); portal contacts have no `/api/v1` access (TB13).

**Migrations.** `packages/api/src/db/migrations/NNNN_name.sql` + `.rollback.sql` + `meta/_journal.json` entry (hand-written, `when` strictly increasing); additive-only enforced by `scripts/check-migration-policy.sh`; next free idx at branch time = 201 (taken by `0201_tax_estimator`).

**Tests.** Vitest; API tests need `DATABASE_URL=…@localhost:5434/kisbooks_test` + `REDIS_URL=redis://127.0.0.1:6390`, one file at a time; harness idiom in `routes/feature-flags.routes.test.ts` (express + http.request + jwt.sign). Shared dist must be rebuilt (`npm run build --workspace=@kis-books/shared`) before api typechecks see new shared exports. Gates: `scripts/check-license-headers.sh`, `check-any-baseline.sh` (319/1/0), `check-migration-policy.sh`.

**UI.** `packages/web/src/features/<module>/`, `components/ui`, shared table system (ColumnFilter/SortableTh/useColumnView), nav/guard pattern `hooks/useTrialBalanceVisibility.ts` + `App.tsx`. Knowledge base: `features/help/articles.ts` (template literals — no backticks), `packages/api/src/knowledge/curated/`.

**Phase 0 deliverables.** `TAX_ESTIMATOR_V1` (flag list + default-off set + migration seed), `tax_estimator` resource (group 'Trial Balance'), `taxEstimator: 'base'` manifest, `shared/src/tax-estimator/{index,types,parameterKeys,engine/index}.ts`, `api/src/db/schema/tax-estimator.ts` (empty), `api/src/services/tax-estimator/{index,firm-scope.service}.ts`, `api/src/middleware/tax-estimator-scope.ts`, `api/src/routes/tax-estimator.routes.ts` (mounted `/api/v1/tax-estimator`, `GET /scope`), `0201_tax_estimator(.rollback).sql`, `npm run test:tax-oracle`, `routes/tax-estimator.routes.test.ts` (10 tests: guard chain, firm∩access scope, deactivated assignment/access, X-Firm-Id, readonly, super admin).

## Phase 1 sign-off checklist (federal parameters)
**How to sign off (Kurt):** review each row against its citation; flag any you dispute in OPEN-QUESTIONS.md; when satisfied, change the gate in "Hard gates" to ✅ with your initials and date. Agents may not do this. Rows the researcher could not verify from a primary source are marked `unverified` and are listed first in `docs/reviews/phase1-parameter-sources.md`.

**Read these seven first (researcher flags):**
1. 2026 SALT cap $40,400 / threshold $505,000 follow the statute; the 2026 Form 1040-ES instructions still print $40,000 / $500,000.
2. MFS SALT cap = half of (full cap − 30% of the excess): effective 15% slope against the halved cap. The engine must not apply 30% to the halved cap.
3. Q2 2026 underpayment rate is 6%, not 7% (the oracle now uses the real quarterly table; 2027 quarters are unpublished placeholders).
4. 2026 QBI threshold for MFS is $201,775, not $201,750.
5. 2026 excess business loss threshold ($256,000 single / $512,000 MFJ) is below 2025's ($313,000 / $626,000).
6. SEP rate seeded at the statutory 25% of compensation; a self-employed owner's effective rate is 20% (the oracle's `sep_pct_of_net`).
7. Schedule 1-A rounding differs by deduction: tips and overtime round down to whole $1,000s, car-loan interest rounds up.

### Tax year 2025: 149 keys, 136 verified by the researcher, 13 unverified

| ☐ | Key | Value | Researcher status | Citation |
|---|---|---|---|---|
| ☐ | `se.nese_factor` | 0.9235 | verified | Schedule SE (Form 1040) 2025 line 4a "multiply line 3 by 92.35% (0.9235)"; IRC §1402(a)(12) (deduction = NESE x one-half of the §1401(a)+(b)(1) rates = 7.65%) |
| ☐ | `se.min_nese` | 400 | verified | IRC §1402(b)(2) (no SE income if net earnings from self-employment are less than $400); Schedule SE 2025 line 4c |
| ☐ | `se.ss_rate` | 0.124 | verified | IRC §1401(a) (12.4 percent OASDI tax on self-employment income) |
| ☐ | `se.medicare_rate` | 0.029 | verified | IRC §1401(b)(1) (2.9 percent hospital insurance tax on self-employment income) |
| ☐ | `se.ss_wage_base` | 176100 | verified | Contribution and benefit base (42 U.S.C. 430 via IRC §1402(b)(1)): $176,100 for 2025 per Schedule SE (Form 1040) 2025 line 7 and 2025 Form 1040-ES "Social security tax maximum income" (SSA cbb page returned HTTP 403, not read) |
| ☐ | `se.deduction_factor` | 0.5 | verified | IRC §164(f)(1) (one-half of SE taxes); Schedule SE 2025 line 13 "Multiply line 12 by 50% (0.50)" |
| ☐ | `brackets.single` | [[11925,0.1],[48475,0.12],[103350,0.22],[197300,0.24],[250525,0.32],[626350,0.35],[null… | verified | Rev. Proc. 2024-40 §2.01 Table 3 (IRC §1(j)(2), rates made permanent by Pub. L. 119-21 (OBBBA) §70101) |
| ☐ | `brackets.mfj` | [[23850,0.1],[96950,0.12],[206700,0.22],[394600,0.24],[501050,0.32],[751600,0.35],[null… | verified | Rev. Proc. 2024-40 §2.01 Table 1 (IRC §1(j)(2), rates made permanent by Pub. L. 119-21 (OBBBA) §70101) |
| ☐ | `brackets.mfs` | [[11925,0.1],[48475,0.12],[103350,0.22],[197300,0.24],[250525,0.32],[375800,0.35],[null… | verified | Rev. Proc. 2024-40 §2.01 Table 4 (IRC §1(j)(2), rates made permanent by Pub. L. 119-21 (OBBBA) §70101) |
| ☐ | `brackets.hoh` | [[17000,0.1],[64850,0.12],[103350,0.22],[197300,0.24],[250500,0.32],[626350,0.35],[null… | verified | Rev. Proc. 2024-40 §2.01 Table 2 (IRC §1(j)(2), rates made permanent by Pub. L. 119-21 (OBBBA) §70101) |
| ☐ | `brackets.qss` | [[23850,0.1],[96950,0.12],[206700,0.22],[394600,0.24],[501050,0.32],[751600,0.35],[null… | verified | Rev. Proc. 2024-40 §2.01 Table 1 (surviving spouses) (IRC §1(j)(2), rates made permanent by Pub. L. 119-21 (OBBBA) §70101) |
| ☐ | `ltcg.breakpoints.single` | [48350,533400] | verified | Rev. Proc. 2024-40 §2.03 (IRC §1(j)(5)(B)) maximum zero rate amount / maximum 15% rate amount, All Other Individuals row |
| ☐ | `ltcg.breakpoints.mfj` | [96700,600050] | verified | Rev. Proc. 2024-40 §2.03 (IRC §1(j)(5)(B)) maximum zero rate amount / maximum 15% rate amount, MFJ and surviving spouse row |
| ☐ | `ltcg.breakpoints.mfs` | [48350,300000] | verified | Rev. Proc. 2024-40 §2.03 (IRC §1(j)(5)(B)) maximum zero rate amount / maximum 15% rate amount, MFS row |
| ☐ | `ltcg.breakpoints.hoh` | [64750,566700] | verified | Rev. Proc. 2024-40 §2.03 (IRC §1(j)(5)(B)) maximum zero rate amount / maximum 15% rate amount, Heads of Household row |
| ☐ | `ltcg.breakpoints.qss` | [96700,600050] | verified | Rev. Proc. 2024-40 §2.03 (IRC §1(j)(5)(B)) maximum zero rate amount / maximum 15% rate amount, MFJ and surviving spouse row |
| ☐ | `ltcg.rates` | [0,0.15,0.2] | verified | IRC §1(h)(1)(B), (C), (D) (0 / 15 / 20 percent of adjusted net capital gain) |
| ☐ | `collectibles_rate` | 0.28 | verified | IRC §1(h)(1)(F) and §1(h)(4) (28-percent rate gain, incl. collectibles gain) |
| ☐ | `unrecaptured_1250_rate` | 0.25 | verified | IRC §1(h)(1)(E) (25 percent of unrecaptured section 1250 gain) |
| ☐ | `addl_medicare.rate` | 0.009 | verified | IRC §3101(b)(2) and §1401(b)(2)(A) (0.9 percent Additional Medicare Tax) |
| ☐ | `addl_medicare.threshold.single` | 200000 | verified | IRC §3101(b)(2)(C) / §1401(b)(2)(A)(iii) "any other case" $200,000 (surviving spouse is not a joint return; statutory, not indexed) |
| ☐ | `addl_medicare.threshold.mfj` | 250000 | verified | IRC §3101(b)(2)(A) / §1401(b)(2)(A)(i) joint return $250,000 (statutory, not indexed) |
| ☐ | `addl_medicare.threshold.mfs` | 125000 | verified | IRC §3101(b)(2)(B) / §1401(b)(2)(A)(ii) MFS one-half of $250,000 (statutory, not indexed) |
| ☐ | `addl_medicare.threshold.hoh` | 200000 | verified | IRC §3101(b)(2)(C) / §1401(b)(2)(A)(iii) "any other case" $200,000 (surviving spouse is not a joint return; statutory, not indexed) |
| ☐ | `addl_medicare.threshold.qss` | 200000 | verified | IRC §3101(b)(2)(C) / §1401(b)(2)(A)(iii) "any other case" $200,000 (surviving spouse is not a joint return; statutory, not indexed) |
| ☐ | `niit.rate` | 0.038 | verified | IRC §1411(a)(1) (3.8 percent of the lesser of NII or MAGI over threshold) |
| ☐ | `niit.threshold.single` | 200000 | verified | IRC §1411(b)(3) any other case $200,000 (statutory, not indexed) |
| ☐ | `niit.threshold.mfj` | 250000 | verified | IRC §1411(b)(1) joint return $250,000 (statutory, not indexed) |
| ☐ | `niit.threshold.mfs` | 125000 | verified | IRC §1411(b)(2) MFS one-half of $250,000 (statutory, not indexed) |
| ☐ | `niit.threshold.hoh` | 200000 | verified | IRC §1411(b)(3) any other case $200,000 (statutory, not indexed) |
| ☐ | `niit.threshold.qss` | 250000 | verified | IRC §1411(b)(1) surviving spouse (§2(a)) $250,000 (statutory, not indexed) |
| ☐ | `std_deduction.single` | 15750 | verified | IRC §63(c)(7) as amended by Pub. L. 119-21 (OBBBA) §70102 (2025 amounts $15,750 single/MFS, $23,625 HOH, $31,500 MFJ/surviving spouse), read in Rev. Proc. 2025-32 §2.08 (supersedes Rev. Proc. 2024-40 §2.15(1)) |
| ☐ | `std_deduction.mfj` | 31500 | verified | IRC §63(c)(7) as amended by Pub. L. 119-21 (OBBBA) §70102 (2025 amounts $15,750 single/MFS, $23,625 HOH, $31,500 MFJ/surviving spouse), read in Rev. Proc. 2025-32 §2.08 (supersedes Rev. Proc. 2024-40 §2.15(1)) |
| ☐ | `std_deduction.mfs` | 15750 | verified | IRC §63(c)(7) as amended by Pub. L. 119-21 (OBBBA) §70102 (2025 amounts $15,750 single/MFS, $23,625 HOH, $31,500 MFJ/surviving spouse), read in Rev. Proc. 2025-32 §2.08 (supersedes Rev. Proc. 2024-40 §2.15(1)) |
| ☐ | `std_deduction.hoh` | 23625 | verified | IRC §63(c)(7) as amended by Pub. L. 119-21 (OBBBA) §70102 (2025 amounts $15,750 single/MFS, $23,625 HOH, $31,500 MFJ/surviving spouse), read in Rev. Proc. 2025-32 §2.08 (supersedes Rev. Proc. 2024-40 §2.15(1)) |
| ☐ | `std_deduction.qss` | 31500 | verified | IRC §63(c)(7) as amended by Pub. L. 119-21 (OBBBA) §70102 (2025 amounts $15,750 single/MFS, $23,625 HOH, $31,500 MFJ/surviving spouse), read in Rev. Proc. 2025-32 §2.08 (supersedes Rev. Proc. 2024-40 §2.15(1)) |
| ☐ | `std_deduction.additional_65_blind.unmarried` | 2000 | verified | Rev. Proc. 2024-40 §2.15(3) (IRC §63(f); $2,000 if unmarried and not a surviving spouse) |
| ☐ | `std_deduction.additional_65_blind.married` | 1600 | verified | Rev. Proc. 2024-40 §2.15(3) (IRC §63(f); $1,600) |
| ☐ | `salt.cap.standard` | 40000 | verified | IRC §164(b)(7)(A)(i) applicable limitation amount $40,000 for 2025. IRC §164(b)(6)-(7) as amended by OBBBA §70120 (Cornell LII current text); 2025 Schedule A instructions SALT worksheet and What's New |
| ☐ | `salt.cap.mfs` | 20000 | verified | IRC §164(b)(6)(B) MFS = half the applicable limitation amount ($40,000/2). IRC §164(b)(6)-(7) as amended by OBBBA §70120 (Cornell LII current text); 2025 Schedule A instructions SALT worksheet and What's New |
| ☐ | `salt.phase_down.threshold.standard` | 500000 | verified | IRC §164(b)(7)(B)(ii)(I) threshold amount $500,000 for 2025. IRC §164(b)(6)-(7) as amended by OBBBA §70120 (Cornell LII current text); 2025 Schedule A instructions SALT worksheet and What's New |
| ☐ | `salt.phase_down.threshold.mfs` | 250000 | verified | IRC §164(b)(7)(B)(i) MFS uses half the threshold amount ($500,000/2). IRC §164(b)(6)-(7) as amended by OBBBA §70120 (Cornell LII current text); 2025 Schedule A instructions SALT worksheet and What's New |
| ☐ | `salt.phase_down.rate` | 0.3 | verified | IRC §164(b)(7)(B)(i) (reduced by 30 percent of MAGI over threshold). ENGINE NOTE: per the statute and the Schedule A worksheet, MFS takes HALF of (full-cap - 30% x excess over the MFS threshold), floored at $10,000 before halving — i.e. an effective 15% slope against salt.cap.mfs; do not apply 30% to the halved cap. IRC §164(b)(6)-(7) as amended by OBBBA §70120 (Cornell LII current text); 2025 Schedule A instructions SALT worksheet and What's New |
| ☐ | `salt.floor.standard` | 10000 | verified | IRC §164(b)(7)(B)(iii) (reduction may not take the applicable limitation amount below $10,000). IRC §164(b)(6)-(7) as amended by OBBBA §70120 (Cornell LII current text); 2025 Schedule A instructions SALT worksheet and What's New |
| ☐ | `salt.floor.mfs` | 5000 | verified | IRC §164(b)(6)(B) + §164(b)(7)(B)(iii): MFS half of the $10,000 floor; $5,000 stated in 2025 Schedule A instructions. IRC §164(b)(6)-(7) as amended by OBBBA §70120 (Cornell LII current text); 2025 Schedule A instructions SALT worksheet and What's New |
| ☐ | `charity.agi_floor_pct` | 0 | unverified | NOT APPLICABLE FOR 2025: the 0.5%-of-contribution-base floor in IRC §170(b)(1)(I) was added by Pub. L. 119-21 (OBBBA) §70425 and applies to taxable years beginning after Dec 31, 2025 (LII effective-date note). 0 = no floor. |
| ☐ | `charity.nonitemizer.single` | 0 | unverified | NOT APPLICABLE FOR 2025: the non-itemizer cash charitable deduction in IRC §170(p) ($1,000 / $2,000 joint) applies to taxable years beginning after Dec 31, 2025 (Pub. L. 119-21 (OBBBA) §70424(b)). 0 = no deduction. |
| ☐ | `charity.nonitemizer.mfj` | 0 | unverified | NOT APPLICABLE FOR 2025: the non-itemizer cash charitable deduction in IRC §170(p) ($1,000 / $2,000 joint) applies to taxable years beginning after Dec 31, 2025 (Pub. L. 119-21 (OBBBA) §70424(b)). 0 = no deduction. |
| ☐ | `charity.nonitemizer.mfs` | 0 | unverified | NOT APPLICABLE FOR 2025: the non-itemizer cash charitable deduction in IRC §170(p) ($1,000 / $2,000 joint) applies to taxable years beginning after Dec 31, 2025 (Pub. L. 119-21 (OBBBA) §70424(b)). 0 = no deduction. |
| ☐ | `charity.nonitemizer.hoh` | 0 | unverified | NOT APPLICABLE FOR 2025: the non-itemizer cash charitable deduction in IRC §170(p) ($1,000 / $2,000 joint) applies to taxable years beginning after Dec 31, 2025 (Pub. L. 119-21 (OBBBA) §70424(b)). 0 = no deduction. |
| ☐ | `charity.nonitemizer.qss` | 0 | unverified | NOT APPLICABLE FOR 2025: the non-itemizer cash charitable deduction in IRC §170(p) ($1,000 / $2,000 joint) applies to taxable years beginning after Dec 31, 2025 (Pub. L. 119-21 (OBBBA) §70424(b)). 0 = no deduction. |
| ☐ | `itemized.benefit_cap_rate` | 0.37 | unverified | NOT APPLICABLE FOR 2025: the OBBBA §68 itemized-deduction limitation (2/37 reduction, effectively a 35% benefit cap) applies to taxable years beginning after Dec 31, 2025 (Pub. L. 119-21 (OBBBA) §70111(c)); Pease was suspended for 2018-2025. 0.37 (= top bracket rate) seeded so that no cap applies; engine must treat 2025 as uncapped. |
| ☐ | `sch1a.senior.amount` | 6000 | verified | IRC §151(d)(5)(C)(i) ($6,000 per qualified individual, tax years beginning before 2029), added by Pub. L. 119-21 (OBBBA) §70103; 2025 Schedule 1-A (Form 1040) Part V lines 33-35 |
| ☐ | `sch1a.senior.phaseout_rate` | 0.06 | verified | IRC §151(d)(5)(C)(iii)(I) (reduced by 6 percent of MAGI over threshold); 2025 Schedule 1-A (Form 1040) line 34 (6%) |
| ☐ | `sch1a.senior.phaseout_threshold.single` | 75000 | verified | IRC §151(d)(5)(C)(iii)(I) $75,000 (non-joint; surviving spouse is not a joint return); 2025 Schedule 1-A (Form 1040) line 32 |
| ☐ | `sch1a.senior.phaseout_threshold.mfj` | 150000 | verified | IRC §151(d)(5)(C)(iii)(I) $150,000 joint return; 2025 Schedule 1-A (Form 1040) line 32 |
| ☐ | `sch1a.senior.phaseout_threshold.mfs` | 75000 | unverified | IRC §151(d)(5)(C)(iii)(I) $75,000. MFS NOT ELIGIBLE: IRC §151(d)(5)(C)(v) requires married taxpayers to file jointly; seeded the non-joint statutory amount only so the key exists — the engine must disallow the deduction for MFS. |
| ☐ | `sch1a.senior.phaseout_threshold.hoh` | 75000 | verified | IRC §151(d)(5)(C)(iii)(I) $75,000 (non-joint; surviving spouse is not a joint return); 2025 Schedule 1-A (Form 1040) line 32 |
| ☐ | `sch1a.senior.phaseout_threshold.qss` | 75000 | verified | IRC §151(d)(5)(C)(iii)(I) $75,000 (non-joint; surviving spouse is not a joint return); 2025 Schedule 1-A (Form 1040) line 32 |
| ☐ | `sch1a.tips.max` | 25000 | verified | IRC §224(b)(1) ($25,000), added by Pub. L. 119-21 (OBBBA) §70201; 2025 Schedule 1-A (Form 1040) line 7 |
| ☐ | `sch1a.tips.phaseout_threshold.single` | 150000 | verified | IRC §224(b)(2)(A) $150,000 (non-joint); 2025 Schedule 1-A (Form 1040) line 9 |
| ☐ | `sch1a.tips.phaseout_threshold.mfj` | 300000 | verified | IRC §224(b)(2)(A) $300,000 joint return; 2025 Schedule 1-A (Form 1040) line 9 |
| ☐ | `sch1a.tips.phaseout_threshold.mfs` | 150000 | unverified | IRC §224(b)(2)(A) $150,000. MFS NOT ELIGIBLE: IRC §224(f) requires married taxpayers to file jointly; seeded the non-joint statutory amount only so the key exists — the engine must disallow the deduction for MFS. |
| ☐ | `sch1a.tips.phaseout_threshold.hoh` | 150000 | verified | IRC §224(b)(2)(A) $150,000 (non-joint); 2025 Schedule 1-A (Form 1040) line 9 |
| ☐ | `sch1a.tips.phaseout_threshold.qss` | 150000 | verified | IRC §224(b)(2)(A) $150,000 (non-joint); 2025 Schedule 1-A (Form 1040) line 9 |
| ☐ | `sch1a.tips.phaseout_rate` | 0.1 | verified | IRC §224(b)(2)(A) ($100 for each $1,000 of MAGI over threshold = 0.10). ENGINE NOTE: Schedule 1-A 2025 lines 11-12 count only WHOLE $1,000s (round the excess down) before multiplying by $100. |
| ☐ | `sch1a.overtime.max.standard` | 12500 | verified | IRC §225(b)(1) ($12,500), added by Pub. L. 119-21 (OBBBA) §70202; 2025 Schedule 1-A (Form 1040) line 15 |
| ☐ | `sch1a.overtime.max.mfj` | 25000 | verified | IRC §225(b)(1) ($25,000 in the case of a joint return); 2025 Schedule 1-A (Form 1040) line 15 |
| ☐ | `sch1a.overtime.phaseout_threshold.single` | 150000 | verified | IRC §225(b)(2)(A) $150,000 (non-joint); 2025 Schedule 1-A (Form 1040) line 17 |
| ☐ | `sch1a.overtime.phaseout_threshold.mfj` | 300000 | verified | IRC §225(b)(2)(A) $300,000 joint return; 2025 Schedule 1-A (Form 1040) line 17 |
| ☐ | `sch1a.overtime.phaseout_threshold.mfs` | 150000 | unverified | IRC §225(b)(2)(A) $150,000. MFS NOT ELIGIBLE: IRC §225(e) requires married taxpayers to file jointly; seeded the non-joint statutory amount only so the key exists — the engine must disallow the deduction for MFS. |
| ☐ | `sch1a.overtime.phaseout_threshold.hoh` | 150000 | verified | IRC §225(b)(2)(A) $150,000 (non-joint); 2025 Schedule 1-A (Form 1040) line 17 |
| ☐ | `sch1a.overtime.phaseout_threshold.qss` | 150000 | verified | IRC §225(b)(2)(A) $150,000 (non-joint); 2025 Schedule 1-A (Form 1040) line 17 |
| ☐ | `sch1a.overtime.phaseout_rate` | 0.1 | verified | IRC §225(b)(2)(A) ($100 for each $1,000 = 0.10). ENGINE NOTE: Schedule 1-A 2025 lines 19-20 count only WHOLE $1,000s (round the excess down). |
| ☐ | `sch1a.car_interest.max` | 10000 | verified | IRC §163(h)(4)(C)(i) ($10,000), added by Pub. L. 119-21 (OBBBA) §70203; 2025 Schedule 1-A (Form 1040) line 24 |
| ☐ | `sch1a.car_interest.phaseout_threshold.single` | 100000 | verified | IRC §163(h)(4)(C)(ii)(I) $100,000 (non-joint; no joint-filing requirement for this deduction); 2025 Schedule 1-A (Form 1040) line 26 |
| ☐ | `sch1a.car_interest.phaseout_threshold.mfj` | 200000 | verified | IRC §163(h)(4)(C)(ii)(I) $200,000 joint return; 2025 Schedule 1-A (Form 1040) line 26 |
| ☐ | `sch1a.car_interest.phaseout_threshold.mfs` | 100000 | verified | IRC §163(h)(4)(C)(ii)(I) $100,000 (non-joint; no joint-filing requirement for this deduction); 2025 Schedule 1-A (Form 1040) line 26 |
| ☐ | `sch1a.car_interest.phaseout_threshold.hoh` | 100000 | verified | IRC §163(h)(4)(C)(ii)(I) $100,000 (non-joint; no joint-filing requirement for this deduction); 2025 Schedule 1-A (Form 1040) line 26 |
| ☐ | `sch1a.car_interest.phaseout_threshold.qss` | 100000 | verified | IRC §163(h)(4)(C)(ii)(I) $100,000 (non-joint; no joint-filing requirement for this deduction); 2025 Schedule 1-A (Form 1040) line 26 |
| ☐ | `sch1a.car_interest.phaseout_rate` | 0.2 | verified | IRC §163(h)(4)(C)(ii)(I) ($200 for each $1,000 "or portion thereof" = 0.20). ENGINE NOTE: Schedule 1-A 2025 line 28 rounds the excess/1,000 UP to the next whole number. |
| ☐ | `sch1a.first_year` | 2025 | verified | IRC §224 and §225 apply to tax years beginning after Dec 31, 2024 (OBBBA §70201(j), §70202); §163(h)(4)(A) 2025-2028; §151(d)(5)(C) per 2025 Schedule 1-A Part V |
| ☐ | `sch1a.last_year` | 2028 | verified | IRC §224(h) and §225(g) (no deduction for tax years beginning after Dec 31, 2028); §163(h)(4)(A) (before Jan 1, 2029); §151(d)(5)(C)(i) (tax years beginning before Jan 1, 2029) |
| ☐ | `qbi.rate` | 0.2 | verified | IRC §199A(b)(2)(A) and (a)(1) (20 percent of qualified business income) |
| ☐ | `qbi.threshold.single` | 197300 | verified | Rev. Proc. 2024-40 §2.27 (IRC §199A(e)(2)) threshold, All Other Returns row |
| ☐ | `qbi.threshold.mfj` | 394600 | verified | Rev. Proc. 2024-40 §2.27 (IRC §199A(e)(2)) threshold, MFJ row |
| ☐ | `qbi.threshold.mfs` | 197300 | verified | Rev. Proc. 2024-40 §2.27 (IRC §199A(e)(2)) threshold, MFS row |
| ☐ | `qbi.threshold.hoh` | 197300 | verified | Rev. Proc. 2024-40 §2.27 (IRC §199A(e)(2)) threshold, All Other Returns row |
| ☐ | `qbi.threshold.qss` | 197300 | verified | Rev. Proc. 2024-40 §2.27 (IRC §199A(e)(2)) threshold, All Other Returns row |
| ☐ | `qbi.phase_in_range.single` | 50000 | verified | Rev. Proc. 2024-40 §2.27 phase-in range end $247,300 less threshold $197,300 (IRC §199A(b)(3)(B) $50,000 / $100,000 joint, pre-OBBBA; OBBBA §70105 widening applies only after 2025) |
| ☐ | `qbi.phase_in_range.mfj` | 100000 | verified | Rev. Proc. 2024-40 §2.27 phase-in range end $494,600 less threshold $394,600 (IRC §199A(b)(3)(B) $50,000 / $100,000 joint, pre-OBBBA; OBBBA §70105 widening applies only after 2025) |
| ☐ | `qbi.phase_in_range.mfs` | 50000 | verified | Rev. Proc. 2024-40 §2.27 phase-in range end $247,300 less threshold $197,300 (IRC §199A(b)(3)(B) $50,000 / $100,000 joint, pre-OBBBA; OBBBA §70105 widening applies only after 2025) |
| ☐ | `qbi.phase_in_range.hoh` | 50000 | verified | Rev. Proc. 2024-40 §2.27 phase-in range end $247,300 less threshold $197,300 (IRC §199A(b)(3)(B) $50,000 / $100,000 joint, pre-OBBBA; OBBBA §70105 widening applies only after 2025) |
| ☐ | `qbi.phase_in_range.qss` | 50000 | verified | Rev. Proc. 2024-40 §2.27 phase-in range end $247,300 less threshold $197,300 (IRC §199A(b)(3)(B) $50,000 / $100,000 joint, pre-OBBBA; OBBBA §70105 widening applies only after 2025) |
| ☐ | `qbi.w2_wage_pct` | 0.5 | verified | IRC §199A(b)(2)(B)(i) (50 percent of W-2 wages) |
| ☐ | `qbi.alt_w2_wage_pct` | 0.25 | verified | IRC §199A(b)(2)(B)(ii) (25 percent of W-2 wages plus 2.5 percent of UBIA) |
| ☐ | `qbi.ubia_pct` | 0.025 | verified | IRC §199A(b)(2)(B)(ii) (2.5 percent of unadjusted basis immediately after acquisition of qualified property) |
| ☐ | `qbi.taxable_income_limit_pct` | 0.2 | verified | IRC §199A(a)(2) (20 percent of taxable income less net capital gain) |
| ☐ | `qbi.min_deduction_amount` | 0 | unverified | NOT APPLICABLE FOR 2025: the $400 minimum deduction in IRC §199A(i) (Pub. L. 119-21 (OBBBA) §70105) applies to taxable years beginning after Dec 31, 2025 (Rev. Proc. 2025-32 §2.12; §70105(c)). 0 = no minimum. |
| ☐ | `qbi.min_deduction_active_qbi_threshold` | 0 | unverified | NOT APPLICABLE FOR 2025: the $1,000 active-QBI requirement in IRC §199A(i)(2)(A) applies after 2025 (Rev. Proc. 2025-32 §2.12). Paired with a $0 minimum, so it has no effect. |
| ☐ | `ebl.threshold.standard` | 313000 | verified | Rev. Proc. 2024-40 §2.32 (IRC §461(l)(3)(A)(ii)(II)) |
| ☐ | `ebl.threshold.mfj` | 626000 | verified | Rev. Proc. 2024-40 §2.32 (IRC §461(l)(3)(A)(ii)(II), joint returns) |
| ☐ | `passive.rental_allowance.standard` | 25000 | verified | IRC §469(i)(2) ($25,000; statutory, not indexed). MFS spouses who lived together at any time in the year get $0 (§469(i)(5)(B)). |
| ☐ | `passive.rental_allowance.mfs_living_apart` | 12500 | verified | IRC §469(i)(5)(A)(i) ($12,500 for MFS who lived apart at all times during the year; statutory, not indexed) |
| ☐ | `passive.rental_allowance_phaseout_start.standard` | 100000 | verified | IRC §469(i)(3)(A) (reduced by 50 percent of AGI, as modified by §469(i)(3)(E), over $100,000; statutory, not indexed) |
| ☐ | `passive.rental_allowance_phaseout_start.mfs_living_apart` | 50000 | verified | IRC §469(i)(5)(A)(ii) ($50,000 substituted for $100,000 for MFS living apart) |
| ☐ | `passive.rental_allowance_phaseout_end.standard` | 150000 | verified | Derived from IRC §469(i)(2)-(3)(A): $100,000 + $25,000 / 50% = $150,000 (allowance fully phased out) |
| ☐ | `passive.rental_allowance_phaseout_end.mfs_living_apart` | 75000 | verified | Derived from IRC §469(i)(5)(A): $50,000 + $12,500 / 50% = $75,000 |
| ☐ | `retirement.sep.pct_of_comp` | 0.25 | verified | IRC §402(h)(2)(A) (25 percent of compensation) and §404(h)(1)(C). NOTE: for a self-employed owner the effective rate on net SE earnings is 20% (25%/(1+25%)) after the §164(f) deduction, per Pub. 560 rate table — the engine must apply the self-employed reduction. |
| ☐ | `retirement.sep.dollar_limit` | 70000 | verified | Notice 2024-80 (IRC §415(c)(1)(A) defined contribution limit $70,000 for 2025) |
| ☐ | `retirement.comp_limit` | 350000 | verified | Notice 2024-80 (IRC §401(a)(17), §404(l), §408(k)(3)(C) annual compensation limit $350,000 for 2025) |
| ☐ | `retirement.401k.deferral` | 23500 | verified | Notice 2024-80 (IRC §402(g)(1) elective deferral limit $23,500 for 2025) |
| ☐ | `retirement.401k.catch_up_50` | 7500 | verified | Notice 2024-80 (IRC §414(v)(2)(B)(i) catch-up, age 50+, $7,500 for 2025) |
| ☐ | `retirement.401k.catch_up_60_63` | 11250 | verified | Notice 2024-80 (IRC §414(v)(2)(E)(i) catch-up for individuals who attain age 60, 61, 62 or 63 in 2025: $11,250). This REPLACES (is not added to) the age-50 catch-up. |
| ☐ | `retirement.simple.deferral` | 16500 | verified | Notice 2024-80 (IRC §408(p)(2)(E)(i)(III) general SIMPLE limit $16,500 for 2025; the higher §408(p)(2)(E)(i)(I)/(II) limit for certain small/elected plans, $17,600, is not modeled) |
| ☐ | `retirement.simple.catch_up` | 3500 | verified | Notice 2024-80 (IRC §414(v)(2)(B)(ii) SIMPLE catch-up, age 50+, $3,500 for 2025; the age 60-63 SIMPLE catch-up is $5,250 and the §414(v)(2)(B)(iii) amount is $3,850 — neither is modeled by this key) |
| ☐ | `hsa.limit.self` | 4300 | verified | Rev. Proc. 2024-25 §3.01(1) (IRC §223(b)(2)(A) self-only, calendar 2025) |
| ☐ | `hsa.limit.family` | 8550 | verified | Rev. Proc. 2024-25 §3.01(1) (IRC §223(b)(2)(B) family, calendar 2025) |
| ☐ | `hsa.catch_up_55` | 1000 | verified | IRC §223(b)(3)(B) table ("2009 and thereafter $1,000"; statutory, not indexed) |
| ☐ | `ccorp.rate` | 0.21 | verified | IRC §11(b) (21 percent of taxable income) |
| ☐ | `ccorp.large_corp_threshold` | 1000000 | verified | IRC §6655(g)(2)(A) (taxable income of $1,000,000 or more in any of the 3 preceding years) |
| ☐ | `ccorp.installment_months` | [4,6,9,12] | verified | IRC §6655(c)(2) (April 15, June 15, September 15, December 15 for calendar-year corporations) and §6655(i); Instructions for Form 2220 (2025) "15th day of the 4th, 6th, 9th, and 12th months" |
| ☐ | `ccorp.installment_pcts` | [0.25,0.25,0.25,0.25] | verified | IRC §6655(d)(1)(A) (each required installment is 25 percent of the required annual payment) |
| ☐ | `ccorp.safe_harbor_current_pct` | 1 | verified | IRC §6655(d)(1)(B)(i) (100 percent of current-year tax) |
| ☐ | `ccorp.safe_harbor_prior_pct` | 1 | verified | IRC §6655(d)(1)(B)(ii) (100 percent of prior-year tax; unavailable to large corporations except for the 1st installment, §6655(d)(2), and if the prior year was short or showed no liability) |
| ☐ | `ccorp.sch_ai.period_ends` | ["03-31","03-31","06-30","09-30"] | verified | IRC §6655(e)(2)(A)(i) standard annualization periods (first 3, 3, 6 and 9 months); Instructions for Form 2220 (2025) Part II line 20 "Standard option 3 3 6 9" (calendar-year corporation month ends) |
| ☐ | `ccorp.sch_ai.annualization_factors` | [4,4,2,1.33333] | verified | Instructions for Form 2220 (2025) Part II line 22, Corporations, Standard option annualization amounts 4, 4, 2, 1.33333 (= 12/months) |
| ☐ | `ccorp.sch_ai.applicable_pcts` | [0.25,0.5,0.75,1] | verified | IRC §6655(e)(2)(B)(ii) (25 / 50 / 75 / 100); Form 2220 (2025) line 30 |
| ☐ | `safe_harbor.current_pct` | 0.9 | verified | IRC §6654(d)(1)(B)(i) (90 percent of current-year tax) |
| ☐ | `safe_harbor.prior_pct` | 1 | verified | IRC §6654(d)(1)(B)(ii) (100 percent of prior-year tax; prior year must be a 12-month return that was filed) |
| ☐ | `safe_harbor.prior_pct_high_agi` | 1.1 | verified | IRC §6654(d)(1)(C)(i) (110 percent if prior-year AGI exceeds the threshold) |
| ☐ | `safe_harbor.high_agi_threshold.standard` | 150000 | verified | IRC §6654(d)(1)(C)(i) ($150,000 prior-year AGI; statutory, not indexed); Form 1040-ES (2025) Special Rules "Higher income taxpayers" |
| ☐ | `safe_harbor.high_agi_threshold.mfs` | 75000 | verified | IRC §6654(d)(1)(C)(ii) ($75,000 if MFS for the current year); Form 1040-ES (2025) |
| ☐ | `safe_harbor.min_balance_due` | 1000 | verified | IRC §6654(e)(1) (no addition to tax if tax shown less withholding credit is less than $1,000) |
| ☐ | `installments.due_dates` | ["2025-04-15","2025-06-16","2025-09-15","2026-01-15"] | verified | IRC §6654(c)(2) (Apr 15, Jun 15, Sep 15, Jan 15) with §7503: 2025 Form 1040-ES Payment Due Dates "April 15, 2025; June 16, 2025; Sept. 15, 2025; Jan. 15, 2026" (June 15, 2025 is a Sunday) |
| ☐ | `installments.pcts` | [0.25,0.25,0.25,0.25] | verified | IRC §6654(d)(1)(A) (25 percent of the required annual payment per installment) |
| ☐ | `installments.q4_file_and_pay_date` | "2026-02-02" | verified | IRC §6654(h) (file and pay by January 31) with §7503: Jan 31, 2026 is a Saturday; 2025 Form 1040-ES "if you file your 2025 tax return by February 2, 2026" |
| ☐ | `return_due_date` | "2026-04-15" | verified | IRC §6072(a) (15th day of April) and §6654(b)(2)(B); Instructions for Form 2210 (2025) "If you file your 2025 return by April 15, 2026" and Rate Period 4 ending 04/15/26 |
| ☐ | `sch_ai.period_ends` | ["03-31","05-31","08-31","12-31"] | verified | IRC §6654(d)(2)(B)(i) (months ending before each due date); Form 2210 (2025) Schedule AI column headings 1/1-3/31, 1/1-5/31, 1/1-8/31, 1/1-12/31 |
| ☐ | `sch_ai.annualization_factors` | [4,2.4,1.5,1] | verified | Form 2210 (2025) Schedule AI lines 2 and 5 (4, 2.4, 1.5, 1) |
| ☐ | `sch_ai.applicable_pcts` | [0.225,0.45,0.675,0.9] | verified | IRC §6654(d)(2)(C)(ii) (22.5 / 45 / 67.5 / 90); Form 2210 (2025) Schedule AI line 20 |
| ☐ | `sch_ai.period_months` | [3,5,8,12] | verified | IRC §6654(d)(2)(B)(i) and Form 2210 (2025) Schedule AI period columns (3, 5, 8, 12 months) |
| ☐ | `farmer.gross_income_ratio` | 0.6666666666 | verified | IRC §6654(i)(2) (gross income from farming or fishing at least 66 2/3 percent of total gross income, current or prior year). Stored as 0.6666666666 (just under 2/3) so a ratio of exactly 2/3 computed to 20 digits passes the "at least" test. |
| ☐ | `farmer.safe_harbor_current_pct` | 0.6666666667 | verified | IRC §6654(i)(1)(C) (66 2/3 percent substituted for 90 percent); Form 1040-ES "substitute 66 2/3% for 90%". Rounded to 10 places. |
| ☐ | `farmer.safe_harbor_prior_pct` | 1 | verified | IRC §6654(i)(1)(C) (required annual payment determined "without regard to subparagraph (C) of subsection (d)(1)" — i.e. 100%, never 110%); Form 1040-ES "this rule doesn't apply" to farmers |
| ☐ | `farmer.single_due_date` | "2026-01-15" | verified | IRC §6654(i)(1)(B) (January 15 of the following year); 2025 Form 1040-ES "Pay all of your estimated tax by January 15, 2026" |
| ☐ | `farmer.file_by_date` | "2026-03-02" | verified | IRC §6654(i)(1)(D)(i) (March 1 substituted for January 31) with §7503: Mar 1, 2026 is a Sunday; Instructions for Form 2210 (2025) "paid the entire tax due by March 2, 2026"; 2025 Form 1040-ES "by March 2, 2026" |
| ☐ | `penalty.underpayment_rate` | [{"from":"2025-01-01","to":"2025-03-31","rate":0.07},{"from":"2025-04-01","to":"2025-06… | unverified | IRC §6654(a)(1) / §6621(a)(2) underpayment rate by calendar quarter, read in each quarterly revenue ruling: Q1 2025 7% Rev. Rul. 2024-25 (I.R.B. 2024-49); Q2 2025 7% Rev. Rul. 2025-7 (I.R.B. 2025-13); Q3 2025 7% Rev. Rul. 2025-11 (I.R.B. 2025-23); Q4 2025 7% Rev. Rul. 2025-18 (I.R.B. 2025-37); Q1 2026 7% Rev. Rul. 2025-22 (I.R.B. 2025-48); Q2 2026 6% Rev. Rul. 2026-5 (I.R.B. 2026-8); Q3 2026 7% Rev. Rul. 2026-10 (I.R.B. 2026-22); Q4 2026 7% Rev. Rul. 2026-15 (I.R.B. 2026-36). UNVERIFIED PART: Q1-Q4 2027 are not yet published (as of 2026-10-11) and carry the latest published rate (7%, Q4 2026) as a placeholder; replace when the IRS announces each 2027 quarter. Every 2025-2026 quarter is verified. |
| ☐ | `holidays` | ["2025-01-01","2025-01-20","2025-02-17","2025-04-16","2025-05-26","2025-06-19","2025-07… | verified | Legal holidays of 2025 and 2026 for the IRC §7503 weekend/holiday rule ("legal holiday" = legal holiday in the District of Columbia): federal holidays per 5 U.S.C. 6103(a) as listed on the OPM Federal Holidays schedules for 2025 and 2026 (observed dates; Saturday holidays observed the preceding Friday, Sunday holidays the following Monday per 5 U.S.C. 6103(b) / E.O. 11582), plus DC Emancipation Day (April 16) per D.C. Code §1-612.02(a)(11) and (b)(1). Inauguration Day 2025 (5 U.S.C. 6103(c), DC area) coincides with Jan 20 MLK Day. Ad hoc executive-order closures (e.g. 2025-01-09, 2025-12-24, 2025-12-26) are not statutory legal holidays and are excluded. |

### Tax year 2026: 149 keys, 144 verified by the researcher, 5 unverified

| ☐ | Key | Value | Researcher status | Citation |
|---|---|---|---|---|
| ☐ | `se.nese_factor` | 0.9235 | verified | Schedule SE (Form 1040) 2025 line 4a "multiply line 3 by 92.35% (0.9235)"; IRC §1402(a)(12) (deduction = NESE x one-half of the §1401(a)+(b)(1) rates = 7.65%) |
| ☐ | `se.min_nese` | 400 | verified | IRC §1402(b)(2) (no SE income if net earnings from self-employment are less than $400); Schedule SE 2025 line 4c |
| ☐ | `se.ss_rate` | 0.124 | verified | IRC §1401(a) (12.4 percent OASDI tax on self-employment income) |
| ☐ | `se.medicare_rate` | 0.029 | verified | IRC §1401(b)(1) (2.9 percent hospital insurance tax on self-employment income) |
| ☐ | `se.ss_wage_base` | 184500 | verified | Contribution and benefit base (42 U.S.C. 430 via IRC §1402(b)(1)): $184,500 for 2026 per 2026 Form 1040-ES, What's New "Social security tax" (SSA cbb page returned HTTP 403, not read) |
| ☐ | `se.deduction_factor` | 0.5 | verified | IRC §164(f)(1) (one-half of SE taxes); Schedule SE 2025 line 13 "Multiply line 12 by 50% (0.50)" |
| ☐ | `brackets.single` | [[12400,0.1],[50400,0.12],[105700,0.22],[201775,0.24],[256225,0.32],[640600,0.35],[null… | verified | Rev. Proc. 2025-32 §4.01 Table 3 (IRC §1(j)(2), rates made permanent by Pub. L. 119-21 (OBBBA) §70101) |
| ☐ | `brackets.mfj` | [[24800,0.1],[100800,0.12],[211400,0.22],[403550,0.24],[512450,0.32],[768700,0.35],[nul… | verified | Rev. Proc. 2025-32 §4.01 Table 1 (IRC §1(j)(2), rates made permanent by Pub. L. 119-21 (OBBBA) §70101) |
| ☐ | `brackets.mfs` | [[12400,0.1],[50400,0.12],[105700,0.22],[201775,0.24],[256225,0.32],[384350,0.35],[null… | verified | Rev. Proc. 2025-32 §4.01 Table 4 (IRC §1(j)(2), rates made permanent by Pub. L. 119-21 (OBBBA) §70101) |
| ☐ | `brackets.hoh` | [[17700,0.1],[67450,0.12],[105700,0.22],[201750,0.24],[256200,0.32],[640600,0.35],[null… | verified | Rev. Proc. 2025-32 §4.01 Table 2 (IRC §1(j)(2), rates made permanent by Pub. L. 119-21 (OBBBA) §70101) |
| ☐ | `brackets.qss` | [[24800,0.1],[100800,0.12],[211400,0.22],[403550,0.24],[512450,0.32],[768700,0.35],[nul… | verified | Rev. Proc. 2025-32 §4.01 Table 1 (surviving spouses) (IRC §1(j)(2), rates made permanent by Pub. L. 119-21 (OBBBA) §70101) |
| ☐ | `ltcg.breakpoints.single` | [49450,545500] | verified | Rev. Proc. 2025-32 §4.03 (IRC §1(j)(5)(B)) maximum zero rate amount / maximum 15% rate amount, All Other Individuals row |
| ☐ | `ltcg.breakpoints.mfj` | [98900,613700] | verified | Rev. Proc. 2025-32 §4.03 (IRC §1(j)(5)(B)) maximum zero rate amount / maximum 15% rate amount, MFJ and surviving spouse row |
| ☐ | `ltcg.breakpoints.mfs` | [49450,306850] | verified | Rev. Proc. 2025-32 §4.03 (IRC §1(j)(5)(B)) maximum zero rate amount / maximum 15% rate amount, MFS row |
| ☐ | `ltcg.breakpoints.hoh` | [66200,579600] | verified | Rev. Proc. 2025-32 §4.03 (IRC §1(j)(5)(B)) maximum zero rate amount / maximum 15% rate amount, Heads of Household row |
| ☐ | `ltcg.breakpoints.qss` | [98900,613700] | verified | Rev. Proc. 2025-32 §4.03 (IRC §1(j)(5)(B)) maximum zero rate amount / maximum 15% rate amount, MFJ and surviving spouse row |
| ☐ | `ltcg.rates` | [0,0.15,0.2] | verified | IRC §1(h)(1)(B), (C), (D) (0 / 15 / 20 percent of adjusted net capital gain) |
| ☐ | `collectibles_rate` | 0.28 | verified | IRC §1(h)(1)(F) and §1(h)(4) (28-percent rate gain, incl. collectibles gain) |
| ☐ | `unrecaptured_1250_rate` | 0.25 | verified | IRC §1(h)(1)(E) (25 percent of unrecaptured section 1250 gain) |
| ☐ | `addl_medicare.rate` | 0.009 | verified | IRC §3101(b)(2) and §1401(b)(2)(A) (0.9 percent Additional Medicare Tax) |
| ☐ | `addl_medicare.threshold.single` | 200000 | verified | IRC §3101(b)(2)(C) / §1401(b)(2)(A)(iii) "any other case" $200,000 (surviving spouse is not a joint return; statutory, not indexed) |
| ☐ | `addl_medicare.threshold.mfj` | 250000 | verified | IRC §3101(b)(2)(A) / §1401(b)(2)(A)(i) joint return $250,000 (statutory, not indexed) |
| ☐ | `addl_medicare.threshold.mfs` | 125000 | verified | IRC §3101(b)(2)(B) / §1401(b)(2)(A)(ii) MFS one-half of $250,000 (statutory, not indexed) |
| ☐ | `addl_medicare.threshold.hoh` | 200000 | verified | IRC §3101(b)(2)(C) / §1401(b)(2)(A)(iii) "any other case" $200,000 (surviving spouse is not a joint return; statutory, not indexed) |
| ☐ | `addl_medicare.threshold.qss` | 200000 | verified | IRC §3101(b)(2)(C) / §1401(b)(2)(A)(iii) "any other case" $200,000 (surviving spouse is not a joint return; statutory, not indexed) |
| ☐ | `niit.rate` | 0.038 | verified | IRC §1411(a)(1) (3.8 percent of the lesser of NII or MAGI over threshold) |
| ☐ | `niit.threshold.single` | 200000 | verified | IRC §1411(b)(3) any other case $200,000 (statutory, not indexed) |
| ☐ | `niit.threshold.mfj` | 250000 | verified | IRC §1411(b)(1) joint return $250,000 (statutory, not indexed) |
| ☐ | `niit.threshold.mfs` | 125000 | verified | IRC §1411(b)(2) MFS one-half of $250,000 (statutory, not indexed) |
| ☐ | `niit.threshold.hoh` | 200000 | verified | IRC §1411(b)(3) any other case $200,000 (statutory, not indexed) |
| ☐ | `niit.threshold.qss` | 250000 | verified | IRC §1411(b)(1) surviving spouse (§2(a)) $250,000 (statutory, not indexed) |
| ☐ | `std_deduction.single` | 16100 | verified | Rev. Proc. 2025-32 §4.14(1) (IRC §63(c)(2)), unmarried / MFS row |
| ☐ | `std_deduction.mfj` | 32200 | verified | Rev. Proc. 2025-32 §4.14(1) (IRC §63(c)(2)), MFJ and surviving spouses row |
| ☐ | `std_deduction.mfs` | 16100 | verified | Rev. Proc. 2025-32 §4.14(1) (IRC §63(c)(2)), unmarried / MFS row |
| ☐ | `std_deduction.hoh` | 24150 | verified | Rev. Proc. 2025-32 §4.14(1) (IRC §63(c)(2)), heads of households row |
| ☐ | `std_deduction.qss` | 32200 | verified | Rev. Proc. 2025-32 §4.14(1) (IRC §63(c)(2)), MFJ and surviving spouses row |
| ☐ | `std_deduction.additional_65_blind.unmarried` | 2050 | verified | Rev. Proc. 2025-32 §4.14(3) (IRC §63(f); $2,050 if unmarried and not a surviving spouse) |
| ☐ | `std_deduction.additional_65_blind.married` | 1650 | verified | Rev. Proc. 2025-32 §4.14(3) (IRC §63(f); $1,650) |
| ☐ | `salt.cap.standard` | 40400 | verified | IRC §164(b)(7)(A)(ii) applicable limitation amount $40,400 for 2026. IRC §164(b)(6)-(7) as amended by OBBBA §70120 (Cornell LII current text); NOTE: 2026 Form 1040-ES What's New still prints $40,000/$500,000 ($20,000/$250,000 MFS) — the statute fixes $40,400/$505,000 for 2026; statute used |
| ☐ | `salt.cap.mfs` | 20200 | verified | IRC §164(b)(6)(B) MFS = half the applicable limitation amount ($40,400/2). IRC §164(b)(6)-(7) as amended by OBBBA §70120 (Cornell LII current text); NOTE: 2026 Form 1040-ES What's New still prints $40,000/$500,000 ($20,000/$250,000 MFS) — the statute fixes $40,400/$505,000 for 2026; statute used |
| ☐ | `salt.phase_down.threshold.standard` | 505000 | verified | IRC §164(b)(7)(B)(ii)(II) threshold amount $505,000 for 2026. IRC §164(b)(6)-(7) as amended by OBBBA §70120 (Cornell LII current text); NOTE: 2026 Form 1040-ES What's New still prints $40,000/$500,000 ($20,000/$250,000 MFS) — the statute fixes $40,400/$505,000 for 2026; statute used |
| ☐ | `salt.phase_down.threshold.mfs` | 252500 | verified | IRC §164(b)(7)(B)(i) MFS uses half the threshold amount ($505,000/2). IRC §164(b)(6)-(7) as amended by OBBBA §70120 (Cornell LII current text); NOTE: 2026 Form 1040-ES What's New still prints $40,000/$500,000 ($20,000/$250,000 MFS) — the statute fixes $40,400/$505,000 for 2026; statute used |
| ☐ | `salt.phase_down.rate` | 0.3 | verified | IRC §164(b)(7)(B)(i) (reduced by 30 percent of MAGI over threshold). ENGINE NOTE: per the statute and the Schedule A worksheet, MFS takes HALF of (full-cap - 30% x excess over the MFS threshold), floored at $10,000 before halving — i.e. an effective 15% slope against salt.cap.mfs; do not apply 30% to the halved cap. IRC §164(b)(6)-(7) as amended by OBBBA §70120 (Cornell LII current text); NOTE: 2026 Form 1040-ES What's New still prints $40,000/$500,000 ($20,000/$250,000 MFS) — the statute fixes $40,400/$505,000 for 2026; statute used |
| ☐ | `salt.floor.standard` | 10000 | verified | IRC §164(b)(7)(B)(iii) (reduction may not take the applicable limitation amount below $10,000). IRC §164(b)(6)-(7) as amended by OBBBA §70120 (Cornell LII current text); NOTE: 2026 Form 1040-ES What's New still prints $40,000/$500,000 ($20,000/$250,000 MFS) — the statute fixes $40,400/$505,000 for 2026; statute used |
| ☐ | `salt.floor.mfs` | 5000 | verified | IRC §164(b)(6)(B) + §164(b)(7)(B)(iii): MFS half of the $10,000 floor; $5,000 stated in 2026 Form 1040-ES What's New. IRC §164(b)(6)-(7) as amended by OBBBA §70120 (Cornell LII current text); NOTE: 2026 Form 1040-ES What's New still prints $40,000/$500,000 ($20,000/$250,000 MFS) — the statute fixes $40,400/$505,000 for 2026; statute used |
| ☐ | `charity.agi_floor_pct` | 0.005 | verified | IRC §170(b)(1)(I) (individual charitable contributions allowed only to the extent they exceed 0.5 percent of the contribution base), added by Pub. L. 119-21 (OBBBA) §70425, effective for taxable years beginning after Dec 31, 2025; also 2026 Form 1040-ES What's New "Charitable deduction floor" |
| ☐ | `charity.nonitemizer.single` | 1000 | verified | IRC §170(p) "not in excess of $1,000" (only a joint return gets $2,000; a surviving spouse / MFS return is not a joint return) as amended by Pub. L. 119-21 (OBBBA) §70424, effective 2026+; 2026 Form 1040-ES What's New "$1,000 ($2,000 for married filing jointly)" |
| ☐ | `charity.nonitemizer.mfj` | 2000 | verified | IRC §170(p) "$2,000 in the case of a joint return" as amended by Pub. L. 119-21 (OBBBA) §70424, effective 2026+; 2026 Form 1040-ES What's New "$1,000 ($2,000 for married filing jointly)" |
| ☐ | `charity.nonitemizer.mfs` | 1000 | verified | IRC §170(p) "not in excess of $1,000" (only a joint return gets $2,000; a surviving spouse / MFS return is not a joint return) as amended by Pub. L. 119-21 (OBBBA) §70424, effective 2026+; 2026 Form 1040-ES What's New "$1,000 ($2,000 for married filing jointly)" |
| ☐ | `charity.nonitemizer.hoh` | 1000 | verified | IRC §170(p) "not in excess of $1,000" (only a joint return gets $2,000; a surviving spouse / MFS return is not a joint return) as amended by Pub. L. 119-21 (OBBBA) §70424, effective 2026+; 2026 Form 1040-ES What's New "$1,000 ($2,000 for married filing jointly)" |
| ☐ | `charity.nonitemizer.qss` | 1000 | verified | IRC §170(p) "not in excess of $1,000" (only a joint return gets $2,000; a surviving spouse / MFS return is not a joint return) as amended by Pub. L. 119-21 (OBBBA) §70424, effective 2026+; 2026 Form 1040-ES What's New "$1,000 ($2,000 for married filing jointly)" |
| ☐ | `itemized.benefit_cap_rate` | 0.35 | unverified | DERIVED, MODEL TO CONFIRM: IRC §68(a) as amended by Pub. L. 119-21 (OBBBA) §70111 (2026+) reduces itemized deductions by 2/37 of the lesser of itemized deductions or taxable income above the 37% bracket start (2026 Form 1040-ES What's New: "5.4%" above $768,700 MFJ/QSS, $640,600 single/HOH, $384,350 MFS). 0.35 = 37% x (1 - 2/37) is the commonly cited effective benefit rate, not a figure in the statute; the engine should implement the 2/37 formula. |
| ☐ | `sch1a.senior.amount` | 6000 | verified | IRC §151(d)(5)(C)(i) ($6,000 per qualified individual, tax years beginning before 2029), added by Pub. L. 119-21 (OBBBA) §70103; 2026 Form 1040-ES What's New; Enhanced deduction for seniors |
| ☐ | `sch1a.senior.phaseout_rate` | 0.06 | verified | IRC §151(d)(5)(C)(iii)(I) (reduced by 6 percent of MAGI over threshold); 2026 Form 1040-ES What's New |
| ☐ | `sch1a.senior.phaseout_threshold.single` | 75000 | verified | IRC §151(d)(5)(C)(iii)(I) $75,000 (non-joint; surviving spouse is not a joint return); 2026 Form 1040-ES What's New;  |
| ☐ | `sch1a.senior.phaseout_threshold.mfj` | 150000 | verified | IRC §151(d)(5)(C)(iii)(I) $150,000 joint return; 2026 Form 1040-ES What's New;  |
| ☐ | `sch1a.senior.phaseout_threshold.mfs` | 75000 | unverified | IRC §151(d)(5)(C)(iii)(I) $75,000. MFS NOT ELIGIBLE: IRC §151(d)(5)(C)(v) requires married taxpayers to file jointly; seeded the non-joint statutory amount only so the key exists — the engine must disallow the deduction for MFS. |
| ☐ | `sch1a.senior.phaseout_threshold.hoh` | 75000 | verified | IRC §151(d)(5)(C)(iii)(I) $75,000 (non-joint; surviving spouse is not a joint return); 2026 Form 1040-ES What's New;  |
| ☐ | `sch1a.senior.phaseout_threshold.qss` | 75000 | verified | IRC §151(d)(5)(C)(iii)(I) $75,000 (non-joint; surviving spouse is not a joint return); 2026 Form 1040-ES What's New;  |
| ☐ | `sch1a.tips.max` | 25000 | verified | IRC §224(b)(1) ($25,000), added by Pub. L. 119-21 (OBBBA) §70201; 2026 Form 1040-ES What's New; No tax on tips |
| ☐ | `sch1a.tips.phaseout_threshold.single` | 150000 | verified | IRC §224(b)(2)(A) $150,000 (non-joint); 2026 Form 1040-ES What's New;  |
| ☐ | `sch1a.tips.phaseout_threshold.mfj` | 300000 | verified | IRC §224(b)(2)(A) $300,000 joint return; 2026 Form 1040-ES What's New;  |
| ☐ | `sch1a.tips.phaseout_threshold.mfs` | 150000 | unverified | IRC §224(b)(2)(A) $150,000. MFS NOT ELIGIBLE: IRC §224(f) requires married taxpayers to file jointly; seeded the non-joint statutory amount only so the key exists — the engine must disallow the deduction for MFS. |
| ☐ | `sch1a.tips.phaseout_threshold.hoh` | 150000 | verified | IRC §224(b)(2)(A) $150,000 (non-joint); 2026 Form 1040-ES What's New;  |
| ☐ | `sch1a.tips.phaseout_threshold.qss` | 150000 | verified | IRC §224(b)(2)(A) $150,000 (non-joint); 2026 Form 1040-ES What's New;  |
| ☐ | `sch1a.tips.phaseout_rate` | 0.1 | verified | IRC §224(b)(2)(A) ($100 for each $1,000 of MAGI over threshold = 0.10). ENGINE NOTE: Schedule 1-A 2025 lines 11-12 count only WHOLE $1,000s (round the excess down) before multiplying by $100. |
| ☐ | `sch1a.overtime.max.standard` | 12500 | verified | IRC §225(b)(1) ($12,500), added by Pub. L. 119-21 (OBBBA) §70202; 2026 Form 1040-ES What's New; No tax on overtime |
| ☐ | `sch1a.overtime.max.mfj` | 25000 | verified | IRC §225(b)(1) ($25,000 in the case of a joint return); 2026 Form 1040-ES What's New; No tax on overtime |
| ☐ | `sch1a.overtime.phaseout_threshold.single` | 150000 | verified | IRC §225(b)(2)(A) $150,000 (non-joint); 2026 Form 1040-ES What's New;  |
| ☐ | `sch1a.overtime.phaseout_threshold.mfj` | 300000 | verified | IRC §225(b)(2)(A) $300,000 joint return; 2026 Form 1040-ES What's New;  |
| ☐ | `sch1a.overtime.phaseout_threshold.mfs` | 150000 | unverified | IRC §225(b)(2)(A) $150,000. MFS NOT ELIGIBLE: IRC §225(e) requires married taxpayers to file jointly; seeded the non-joint statutory amount only so the key exists — the engine must disallow the deduction for MFS. |
| ☐ | `sch1a.overtime.phaseout_threshold.hoh` | 150000 | verified | IRC §225(b)(2)(A) $150,000 (non-joint); 2026 Form 1040-ES What's New;  |
| ☐ | `sch1a.overtime.phaseout_threshold.qss` | 150000 | verified | IRC §225(b)(2)(A) $150,000 (non-joint); 2026 Form 1040-ES What's New;  |
| ☐ | `sch1a.overtime.phaseout_rate` | 0.1 | verified | IRC §225(b)(2)(A) ($100 for each $1,000 = 0.10). ENGINE NOTE: Schedule 1-A 2025 lines 19-20 count only WHOLE $1,000s (round the excess down). |
| ☐ | `sch1a.car_interest.max` | 10000 | verified | IRC §163(h)(4)(C)(i) ($10,000), added by Pub. L. 119-21 (OBBBA) §70203; 2026 Form 1040-ES What's New; No tax on car loan interest |
| ☐ | `sch1a.car_interest.phaseout_threshold.single` | 100000 | verified | IRC §163(h)(4)(C)(ii)(I) $100,000 (non-joint; no joint-filing requirement for this deduction); 2026 Form 1040-ES What's New;  |
| ☐ | `sch1a.car_interest.phaseout_threshold.mfj` | 200000 | verified | IRC §163(h)(4)(C)(ii)(I) $200,000 joint return; 2026 Form 1040-ES What's New;  |
| ☐ | `sch1a.car_interest.phaseout_threshold.mfs` | 100000 | verified | IRC §163(h)(4)(C)(ii)(I) $100,000 (non-joint; no joint-filing requirement for this deduction); 2026 Form 1040-ES What's New;  |
| ☐ | `sch1a.car_interest.phaseout_threshold.hoh` | 100000 | verified | IRC §163(h)(4)(C)(ii)(I) $100,000 (non-joint; no joint-filing requirement for this deduction); 2026 Form 1040-ES What's New;  |
| ☐ | `sch1a.car_interest.phaseout_threshold.qss` | 100000 | verified | IRC §163(h)(4)(C)(ii)(I) $100,000 (non-joint; no joint-filing requirement for this deduction); 2026 Form 1040-ES What's New;  |
| ☐ | `sch1a.car_interest.phaseout_rate` | 0.2 | verified | IRC §163(h)(4)(C)(ii)(I) ($200 for each $1,000 "or portion thereof" = 0.20). ENGINE NOTE: Schedule 1-A 2025 line 28 rounds the excess/1,000 UP to the next whole number. |
| ☐ | `sch1a.first_year` | 2025 | verified | IRC §224 and §225 apply to tax years beginning after Dec 31, 2024 (OBBBA §70201(j), §70202); §163(h)(4)(A) 2025-2028; §151(d)(5)(C) per 2025 Schedule 1-A Part V |
| ☐ | `sch1a.last_year` | 2028 | verified | IRC §224(h) and §225(g) (no deduction for tax years beginning after Dec 31, 2028); §163(h)(4)(A) (before Jan 1, 2029); §151(d)(5)(C)(i) (tax years beginning before Jan 1, 2029) |
| ☐ | `qbi.rate` | 0.2 | verified | IRC §199A(b)(2)(A) and (a)(1) (20 percent of qualified business income) |
| ☐ | `qbi.threshold.single` | 201750 | verified | Rev. Proc. 2025-32 §4.26 (IRC §199A(e)(2)) threshold, All Other Returns row |
| ☐ | `qbi.threshold.mfj` | 403500 | verified | Rev. Proc. 2025-32 §4.26 (IRC §199A(e)(2)) threshold, MFJ row |
| ☐ | `qbi.threshold.mfs` | 201775 | verified | Rev. Proc. 2025-32 §4.26 (IRC §199A(e)(2)) threshold, MFS ($201,775, not $201,750) row |
| ☐ | `qbi.threshold.hoh` | 201750 | verified | Rev. Proc. 2025-32 §4.26 (IRC §199A(e)(2)) threshold, All Other Returns row |
| ☐ | `qbi.threshold.qss` | 201750 | verified | Rev. Proc. 2025-32 §4.26 (IRC §199A(e)(2)) threshold, All Other Returns row |
| ☐ | `qbi.phase_in_range.single` | 75000 | verified | Rev. Proc. 2025-32 §4.26 phase-in range end $276,750 less threshold $201,750; IRC §199A(b)(3)(B)(i) as amended by Pub. L. 119-21 (OBBBA) §70105 ($75,000; $150,000 joint) |
| ☐ | `qbi.phase_in_range.mfj` | 150000 | verified | Rev. Proc. 2025-32 §4.26 phase-in range end $553,500 less threshold $403,500; IRC §199A(b)(3)(B)(i) as amended by Pub. L. 119-21 (OBBBA) §70105 ($75,000; $150,000 joint) |
| ☐ | `qbi.phase_in_range.mfs` | 75000 | verified | Rev. Proc. 2025-32 §4.26 phase-in range end $276,775 less threshold $201,775; IRC §199A(b)(3)(B)(i) as amended by Pub. L. 119-21 (OBBBA) §70105 ($75,000; $150,000 joint) |
| ☐ | `qbi.phase_in_range.hoh` | 75000 | verified | Rev. Proc. 2025-32 §4.26 phase-in range end $276,750 less threshold $201,750; IRC §199A(b)(3)(B)(i) as amended by Pub. L. 119-21 (OBBBA) §70105 ($75,000; $150,000 joint) |
| ☐ | `qbi.phase_in_range.qss` | 75000 | verified | Rev. Proc. 2025-32 §4.26 phase-in range end $276,750 less threshold $201,750; IRC §199A(b)(3)(B)(i) as amended by Pub. L. 119-21 (OBBBA) §70105 ($75,000; $150,000 joint) |
| ☐ | `qbi.w2_wage_pct` | 0.5 | verified | IRC §199A(b)(2)(B)(i) (50 percent of W-2 wages) |
| ☐ | `qbi.alt_w2_wage_pct` | 0.25 | verified | IRC §199A(b)(2)(B)(ii) (25 percent of W-2 wages plus 2.5 percent of UBIA) |
| ☐ | `qbi.ubia_pct` | 0.025 | verified | IRC §199A(b)(2)(B)(ii) (2.5 percent of unadjusted basis immediately after acquisition of qualified property) |
| ☐ | `qbi.taxable_income_limit_pct` | 0.2 | verified | IRC §199A(a)(2) (20 percent of taxable income less net capital gain) |
| ☐ | `qbi.min_deduction_amount` | 400 | verified | IRC §199A(i)(1)(B) ($400), added by Pub. L. 119-21 (OBBBA) §70105, effective for tax years beginning after Dec 31, 2025; Rev. Proc. 2025-32 §2.12 (indexed only after 2026); 2026 Form 1040-ES What's New "Changes to QBID" |
| ☐ | `qbi.min_deduction_active_qbi_threshold` | 1000 | verified | IRC §199A(i)(2)(A) (aggregate QBI from active qualified trades or businesses — material participation per §469(h) — of at least $1,000); Rev. Proc. 2025-32 §2.12; 2026 Form 1040-ES What's New |
| ☐ | `ebl.threshold.standard` | 256000 | verified | Rev. Proc. 2025-32 §4.31 (IRC §461(l)(3)(A)(ii)(II); lower than 2025 because OBBBA §70601 changed the indexing base) |
| ☐ | `ebl.threshold.mfj` | 512000 | verified | Rev. Proc. 2025-32 §4.31 (IRC §461(l)(3)(A)(ii)(II), joint returns) |
| ☐ | `passive.rental_allowance.standard` | 25000 | verified | IRC §469(i)(2) ($25,000; statutory, not indexed). MFS spouses who lived together at any time in the year get $0 (§469(i)(5)(B)). |
| ☐ | `passive.rental_allowance.mfs_living_apart` | 12500 | verified | IRC §469(i)(5)(A)(i) ($12,500 for MFS who lived apart at all times during the year; statutory, not indexed) |
| ☐ | `passive.rental_allowance_phaseout_start.standard` | 100000 | verified | IRC §469(i)(3)(A) (reduced by 50 percent of AGI, as modified by §469(i)(3)(E), over $100,000; statutory, not indexed) |
| ☐ | `passive.rental_allowance_phaseout_start.mfs_living_apart` | 50000 | verified | IRC §469(i)(5)(A)(ii) ($50,000 substituted for $100,000 for MFS living apart) |
| ☐ | `passive.rental_allowance_phaseout_end.standard` | 150000 | verified | Derived from IRC §469(i)(2)-(3)(A): $100,000 + $25,000 / 50% = $150,000 (allowance fully phased out) |
| ☐ | `passive.rental_allowance_phaseout_end.mfs_living_apart` | 75000 | verified | Derived from IRC §469(i)(5)(A): $50,000 + $12,500 / 50% = $75,000 |
| ☐ | `retirement.sep.pct_of_comp` | 0.25 | verified | IRC §402(h)(2)(A) (25 percent of compensation) and §404(h)(1)(C). NOTE: for a self-employed owner the effective rate on net SE earnings is 20% (25%/(1+25%)) after the §164(f) deduction, per Pub. 560 rate table — the engine must apply the self-employed reduction. |
| ☐ | `retirement.sep.dollar_limit` | 72000 | verified | Notice 2025-67 (IRC §415(c)(1)(A) defined contribution limit $72,000 for 2026) |
| ☐ | `retirement.comp_limit` | 360000 | verified | Notice 2025-67 (IRC §401(a)(17), §404(l), §408(k)(3)(C) annual compensation limit $360,000 for 2026) |
| ☐ | `retirement.401k.deferral` | 24500 | verified | Notice 2025-67 (IRC §402(g)(1) elective deferral limit $24,500 for 2026) |
| ☐ | `retirement.401k.catch_up_50` | 8000 | verified | Notice 2025-67 (IRC §414(v)(2)(B)(i) catch-up, age 50+, $8,000 for 2026) |
| ☐ | `retirement.401k.catch_up_60_63` | 11250 | verified | Notice 2025-67 (IRC §414(v)(2)(E)(i) catch-up for individuals who attain age 60, 61, 62 or 63 in 2026: $11,250). This REPLACES (is not added to) the age-50 catch-up. |
| ☐ | `retirement.simple.deferral` | 17000 | verified | Notice 2025-67 (IRC §408(p)(2)(E)(i)(III) general SIMPLE limit $17,000 for 2026; the higher §408(p)(2)(E)(i)(I)/(II) limit for certain small/elected plans, $18,100, is not modeled) |
| ☐ | `retirement.simple.catch_up` | 4000 | verified | Notice 2025-67 (IRC §414(v)(2)(B)(ii) SIMPLE catch-up, age 50+, $4,000 for 2026; the age 60-63 SIMPLE catch-up is $5,250 and the §414(v)(2)(B)(iii) amount is $3,850 — neither is modeled by this key) |
| ☐ | `hsa.limit.self` | 4400 | verified | Rev. Proc. 2025-19 §3.01(1) (IRC §223(b)(2)(A) self-only, calendar 2026) |
| ☐ | `hsa.limit.family` | 8750 | verified | Rev. Proc. 2025-19 §3.01(1) (IRC §223(b)(2)(B) family, calendar 2026) |
| ☐ | `hsa.catch_up_55` | 1000 | verified | IRC §223(b)(3)(B) table ("2009 and thereafter $1,000"; statutory, not indexed) |
| ☐ | `ccorp.rate` | 0.21 | verified | IRC §11(b) (21 percent of taxable income) |
| ☐ | `ccorp.large_corp_threshold` | 1000000 | verified | IRC §6655(g)(2)(A) (taxable income of $1,000,000 or more in any of the 3 preceding years) |
| ☐ | `ccorp.installment_months` | [4,6,9,12] | verified | IRC §6655(c)(2) (April 15, June 15, September 15, December 15 for calendar-year corporations) and §6655(i); Instructions for Form 2220 (2025) "15th day of the 4th, 6th, 9th, and 12th months" |
| ☐ | `ccorp.installment_pcts` | [0.25,0.25,0.25,0.25] | verified | IRC §6655(d)(1)(A) (each required installment is 25 percent of the required annual payment) |
| ☐ | `ccorp.safe_harbor_current_pct` | 1 | verified | IRC §6655(d)(1)(B)(i) (100 percent of current-year tax) |
| ☐ | `ccorp.safe_harbor_prior_pct` | 1 | verified | IRC §6655(d)(1)(B)(ii) (100 percent of prior-year tax; unavailable to large corporations except for the 1st installment, §6655(d)(2), and if the prior year was short or showed no liability) |
| ☐ | `ccorp.sch_ai.period_ends` | ["03-31","03-31","06-30","09-30"] | verified | IRC §6655(e)(2)(A)(i) standard annualization periods (first 3, 3, 6 and 9 months); Instructions for Form 2220 (2025) Part II line 20 "Standard option 3 3 6 9" (calendar-year corporation month ends); 2026 Form 2220 not yet released — statute unchanged |
| ☐ | `ccorp.sch_ai.annualization_factors` | [4,4,2,1.33333] | verified | Instructions for Form 2220 (2025) Part II line 22, Corporations, Standard option annualization amounts 4, 4, 2, 1.33333 (= 12/months); 2026 Form 2220 not yet released — statute unchanged |
| ☐ | `ccorp.sch_ai.applicable_pcts` | [0.25,0.5,0.75,1] | verified | IRC §6655(e)(2)(B)(ii) (25 / 50 / 75 / 100); Form 2220 (2025) line 30 |
| ☐ | `safe_harbor.current_pct` | 0.9 | verified | IRC §6654(d)(1)(B)(i) (90 percent of current-year tax) |
| ☐ | `safe_harbor.prior_pct` | 1 | verified | IRC §6654(d)(1)(B)(ii) (100 percent of prior-year tax; prior year must be a 12-month return that was filed) |
| ☐ | `safe_harbor.prior_pct_high_agi` | 1.1 | verified | IRC §6654(d)(1)(C)(i) (110 percent if prior-year AGI exceeds the threshold) |
| ☐ | `safe_harbor.high_agi_threshold.standard` | 150000 | verified | IRC §6654(d)(1)(C)(i) ($150,000 prior-year AGI; statutory, not indexed); Form 1040-ES (2026) Special Rules "Higher income taxpayers" |
| ☐ | `safe_harbor.high_agi_threshold.mfs` | 75000 | verified | IRC §6654(d)(1)(C)(ii) ($75,000 if MFS for the current year); Form 1040-ES (2026) |
| ☐ | `safe_harbor.min_balance_due` | 1000 | verified | IRC §6654(e)(1) (no addition to tax if tax shown less withholding credit is less than $1,000) |
| ☐ | `installments.due_dates` | ["2026-04-15","2026-06-15","2026-09-15","2027-01-15"] | verified | IRC §6654(c)(2) with §7503: 2026 Form 1040-ES Payment Due Dates "April 15, 2026; June 15, 2026; Sept. 15, 2026; Jan. 15, 2027" (none falls on a weekend or legal holiday) |
| ☐ | `installments.pcts` | [0.25,0.25,0.25,0.25] | verified | IRC §6654(d)(1)(A) (25 percent of the required annual payment per installment) |
| ☐ | `installments.q4_file_and_pay_date` | "2027-02-01" | verified | IRC §6654(h) with §7503: Jan 31, 2027 is a Sunday; 2026 Form 1040-ES "if you file your 2026 tax return by February 1, 2027" |
| ☐ | `return_due_date` | "2027-04-15" | verified | IRC §6072(a) (15th day of April following the calendar year); April 15, 2027 is a Thursday and not a federal or DC legal holiday (DC Emancipation Day is Fri Apr 16, 2027), so no §7503 roll. Date computed from the statute; the 2026 Form 1040/2210 instructions are not yet published. |
| ☐ | `sch_ai.period_ends` | ["03-31","05-31","08-31","12-31"] | verified | IRC §6654(d)(2)(B)(i) (months ending before each due date); Form 2210 (2025) Schedule AI (2026 Form 2210 not yet released; IRC §6654(d)(2) unchanged) column headings 1/1-3/31, 1/1-5/31, 1/1-8/31, 1/1-12/31 |
| ☐ | `sch_ai.annualization_factors` | [4,2.4,1.5,1] | verified | Form 2210 (2025) Schedule AI (2026 Form 2210 not yet released; IRC §6654(d)(2) unchanged) lines 2 and 5 (4, 2.4, 1.5, 1) |
| ☐ | `sch_ai.applicable_pcts` | [0.225,0.45,0.675,0.9] | verified | IRC §6654(d)(2)(C)(ii) (22.5 / 45 / 67.5 / 90); Form 2210 (2025) Schedule AI (2026 Form 2210 not yet released; IRC §6654(d)(2) unchanged) line 20 |
| ☐ | `sch_ai.period_months` | [3,5,8,12] | verified | IRC §6654(d)(2)(B)(i) and Form 2210 (2025) Schedule AI (2026 Form 2210 not yet released; IRC §6654(d)(2) unchanged) period columns (3, 5, 8, 12 months) |
| ☐ | `farmer.gross_income_ratio` | 0.6666666666 | verified | IRC §6654(i)(2) (gross income from farming or fishing at least 66 2/3 percent of total gross income, current or prior year). Stored as 0.6666666666 (just under 2/3) so a ratio of exactly 2/3 computed to 20 digits passes the "at least" test. |
| ☐ | `farmer.safe_harbor_current_pct` | 0.6666666667 | verified | IRC §6654(i)(1)(C) (66 2/3 percent substituted for 90 percent); Form 1040-ES "substitute 66 2/3% for 90%". Rounded to 10 places. |
| ☐ | `farmer.safe_harbor_prior_pct` | 1 | verified | IRC §6654(i)(1)(C) (required annual payment determined "without regard to subparagraph (C) of subsection (d)(1)" — i.e. 100%, never 110%); Form 1040-ES "this rule doesn't apply" to farmers |
| ☐ | `farmer.single_due_date` | "2027-01-15" | verified | IRC §6654(i)(1)(B); 2026 Form 1040-ES Farming and fishing "Pay all of your estimated tax by January 15, 2027" |
| ☐ | `farmer.file_by_date` | "2027-03-01" | verified | IRC §6654(i)(1)(D)(i) (March 1); Mar 1, 2027 is a Monday; 2026 Form 1040-ES "File your 2026 Form 1040 or 1040-SR by March 1, 2027" |
| ☐ | `penalty.underpayment_rate` | [{"from":"2025-01-01","to":"2025-03-31","rate":0.07},{"from":"2025-04-01","to":"2025-06… | unverified | IRC §6654(a)(1) / §6621(a)(2) underpayment rate by calendar quarter, read in each quarterly revenue ruling: Q1 2025 7% Rev. Rul. 2024-25 (I.R.B. 2024-49); Q2 2025 7% Rev. Rul. 2025-7 (I.R.B. 2025-13); Q3 2025 7% Rev. Rul. 2025-11 (I.R.B. 2025-23); Q4 2025 7% Rev. Rul. 2025-18 (I.R.B. 2025-37); Q1 2026 7% Rev. Rul. 2025-22 (I.R.B. 2025-48); Q2 2026 6% Rev. Rul. 2026-5 (I.R.B. 2026-8); Q3 2026 7% Rev. Rul. 2026-10 (I.R.B. 2026-22); Q4 2026 7% Rev. Rul. 2026-15 (I.R.B. 2026-36). UNVERIFIED PART: Q1-Q4 2027 are not yet published (as of 2026-10-11) and carry the latest published rate (7%, Q4 2026) as a placeholder; replace when the IRS announces each 2027 quarter. Every 2025-2026 quarter is verified. |
| ☐ | `holidays` | ["2026-01-01","2026-01-19","2026-02-16","2026-04-16","2026-05-25","2026-06-19","2026-07… | verified | Legal holidays of 2026 and 2027 for the IRC §7503 weekend/holiday rule ("legal holiday" = legal holiday in the District of Columbia): federal holidays per 5 U.S.C. 6103(a) as listed on the OPM Federal Holidays schedules for 2026 and 2027 (observed dates; Saturday holidays observed the preceding Friday, Sunday holidays the following Monday per 5 U.S.C. 6103(b) / E.O. 11582), plus DC Emancipation Day (April 16) per D.C. Code §1-612.02(a)(11) and (b)(1). 2027-12-31 is the observed New Year's Day 2028 holiday. Ad hoc executive-order closures (e.g. 2025-01-09, 2025-12-24, 2025-12-26) are not statutory legal holidays and are excluded. |


## Phase 2 sign-off checklist (MO, AR)
**For Kurt:** these four state-years are the owner's filing states. Read OPEN-QUESTIONS Q25 first (AR rate cut to 3.7% from 2026 per Act 1 of the 2026 First Extraordinary Session; MO penalty rate; AR at exactly $1,000; rules the key set cannot hold). Sign off in "Hard gates" when satisfied. Agents may not.

### MO 2025: 13 keys, 13 verified by the researcher

| ☐ | Key | Value | Status | Citation |
|---|---|---|---|---|
| ☐ | `has_income_tax` | true | verified | RSMo §143.011.1 ("A tax is hereby imposed for every taxable year on the Missouri taxable income of every resident"); RSMo §143.041.1 (nonresidents) |
| ☐ | `required_threshold` | 100 | verified | RSMo §143.521.1 (declaration required "if the Missouri estimated tax can reasonably be expected to be at least one hundred dollars"); §143.521.3 ("Missouri estimated tax" = estimated Chapter 143 tax less estimated cre… |
| ☐ | `safe_harbor.current_pct` | 0.9 | verified | RSMo §143.761.2(1) and .4(2)-(3) ("ninety percent ... of the tax shown on the return"); 2025 Form MO-1040ES General Instruction 8(b) ("90% ... of the total amount due for the current year"); Form MO-2210 (2025) Part I… |
| ☐ | `safe_harbor.prior_pct` | 1 | verified | RSMo §143.761.4(1) (no addition if payments equal "The tax shown on the return ... for the preceding taxable year, if a return showing a liability for tax was filed for the preceding year and such preceding year was a… |
| ☐ | `safe_harbor.high_agi_rule` | null | verified | No high-AGI rule: RSMo §143.761.4(1) uses 100% of the preceding year's tax with no income test (no analogue of IRC §6654(d)(1)(C) 110%); Form MO-2210 (2025) line 21 Exception No. 1 = 100% of 2024 tax for all taxpayers |
| ☐ | `installments.due_dates` | ["2025-04-15","2025-06-16","2025-09-15","2026-01-15"] | verified | RSMo §143.541.1(1) (April 15, June 15, September 15, January 15 of the succeeding year); 2025 Form MO-1040ES Instruction 5 table + note "If the due date falls on a Saturday, Sunday, or legal holiday, the voucher will … |
| ☐ | `installments.pcts` | [0.25,0.25,0.25,0.25] | verified | RSMo §143.541.1(1) ("the estimated tax shall be paid in four equal installments"); Form MO-2210 (2025) line 21 cumulative 25%/50%/75%/100% |
| ☐ | `farmer.rule` | {"ratio":0.6666666666,"current_pct":0.6666666667,"due_date":"2026-0… | verified | RSMo §143.531.2 (farming gross income at least two-thirds of total Missouri gross income; declaration on or before January 15 of the succeeding year); §143.761.2(1)/.4(2) ("sixty-six and two-thirds percent in the case… |
| ☐ | `penalty.rate_source` | "state" | verified | RSMo §143.761.1 (addition to tax "at the rate determined by section 32.065"); RSMo §32.065 (director sets annual adjusted rate from the September prime rate) |
| ☐ | `penalty.rate` | 0.08 | verified | 12 CSR 10-41.010(1) table (2025 = 8%, 2026 = 7%); Form MO-2210 (2025) lines 28a/28b (8% for days in 2025, 7% for days from Jan 1, 2026 to the payment date or April 15, 2026). CAUTION: single-rate key; underpayment day… |
| ☐ | `credit_for_other_state` | true | verified | RSMo §143.081.1-.2 (resident credit for income tax imposed by another state or DC on income derived there, limited to the ratio of other-state-source Missouri AGI to total Missouri AGI times Missouri tax) |
| ☐ | `nonresident_method` | "ratio" | verified | RSMo §143.041.1 (nonresident tax = resident-basis tax x Missouri-source AGI / Missouri AGI from all sources); 2025 Form MO-1040ES General Instruction 5 and worksheet Line 10 "Nonresident" (Missouri income percentage x… |
| ☐ | `holidays` | ["2025-01-01","2025-01-20","2025-02-12","2025-02-17","2025-05-08","… | verified | RSMo §9.010 public holidays (Jan 1; 3rd Mon Jan; Feb 12; 3rd Mon Feb; May 8; last Mon May; June 19; July 4; 1st Mon Sep; 2nd Mon Oct; Nov 11; 4th Thu Nov; Dec 25; a Sunday holiday moves to the following Monday, a Satu… |

### MO 2026: 13 keys, 13 verified by the researcher

| ☐ | Key | Value | Status | Citation |
|---|---|---|---|---|
| ☐ | `has_income_tax` | true | verified | RSMo §143.011.1 (tax on Missouri taxable income of every resident); RSMo §143.041.1 (nonresidents); 2026 Form MO-1040ES tax rate chart |
| ☐ | `required_threshold` | 100 | verified | RSMo §143.521.1 ("at least one hundred dollars"); §143.521.3 (net of credits incl. withholding); 2026 Form MO-1040ES (Rev. 12-2025) General Instructions 1-2 ("$100.00 or more (Section 143.521.1, RSMo)") |
| ☐ | `safe_harbor.current_pct` | 0.9 | verified | RSMo §143.761.2(1) and .4(2)-(3) (ninety percent); 2026 Form MO-1040ES General Instruction 8(b) ("90% ... of the total amount due for the current year") |
| ☐ | `safe_harbor.prior_pct` | 1 | verified | RSMo §143.761.4(1) (100% of the tax shown on the preceding 12-month return showing a liability); 2026 Form MO-1040ES General Instruction 8(a). §143.761.4(4) (prior-year facts at current rates) is an additional excepti… |
| ☐ | `safe_harbor.high_agi_rule` | null | verified | No high-AGI rule: RSMo §143.761.4(1) has no income test; 2026 Form MO-1040ES Instruction 8(a) ("the tax shown on the preceding year's return") with no AGI-based percentage |
| ☐ | `installments.due_dates` | ["2026-04-15","2026-06-15","2026-09-15","2027-01-15"] | verified | RSMo §143.541.1(1); 2026 Form MO-1040ES Instruction 5 table (April 15, June 15, September 15, January 15) + weekend/holiday note; RSMo §143.851. None of these dates is a weekend or RSMo §9.010 holiday (Wed/Mon/Tue/Fri). |
| ☐ | `installments.pcts` | [0.25,0.25,0.25,0.25] | verified | RSMo §143.541.1(1) ("four equal installments"); 2026 Form MO-1040ES General Instruction 4 ("in equal installments on or before April 15, June 15, September 15, and January 15") |
| ☐ | `farmer.rule` | {"ratio":0.6666666666,"current_pct":0.6666666667,"due_date":"2027-0… | verified | RSMo §143.531.2 (two-thirds farming gross income; declaration by January 15); §143.761.2(1)/.4(2) (66 2/3%); §143.521.6 (return and full payment by March 1); 2026 Form MO-1040ES General Instructions 3 and 8(b). Jan 15… |
| ☐ | `penalty.rate_source` | "state" | verified | RSMo §143.761.1 (rate determined by §32.065); RSMo §32.065 |
| ☐ | `penalty.rate` | 0.07 | verified | 12 CSR 10-41.010(1) emergency amendment filed Oct. 2025, effective Jan. 1, 2026 (calendar 2026 = 7%); Form MO-2210 (2025) line 28b (7% for 2026 days). CAUTION: the calendar-2027 rate (days Jan 1-Apr 15, 2027 of a TY20… |
| ☐ | `credit_for_other_state` | true | verified | RSMo §143.081.1-.2 (resident credit for other-state/DC income tax, ratio-limited); 2026 Form MO-1040ES worksheet Line 11 ("credit for income tax to be paid to another state") |
| ☐ | `nonresident_method` | "ratio" | verified | RSMo §143.041.1 (ratio of Missouri-source AGI to all-source AGI applied to resident-basis tax); 2026 Form MO-1040ES General Instruction 5 and worksheet Line 10 "Nonresident" |
| ☐ | `holidays` | ["2026-01-01","2026-01-19","2026-02-12","2026-02-16","2026-05-08","… | verified | RSMo §9.010 public holidays (statutory dates; Sunday -> following Monday, e.g. July 4, 2027 -> July 5, 2027; Saturday holidays not moved) used by RSMo §143.851. Calendar years 2026-2027 (all installment and farmer dat… |

### AR 2025: 13 keys, 11 verified by the researcher

| ☐ | Key | Value | Status | Citation |
|---|---|---|---|---|
| ☐ | `has_income_tax` | true | verified | DFA AR1000ES 2025 tax rate schedule (2.0%-3.9%); AR1000F/AR1000NR Instructions 2025 (resident and nonresident returns) |
| ☐ | `required_threshold` | 1000 | verified | DFA AR1000ES 2025 worksheet line 8 (estimated tax = total tax - credits - AR withholding; "If $1,000 or more, file the Declaration Voucher. If less than $1,000 no Declaration Voucher is required"); AR2210 Instructions… |
| ☐ | `safe_harbor.current_pct` | 0.9 | verified | AR2210 (2025) Part II line 2 ("Enter 90% (.90) of the amount shown on line 1" = 2025 net tax) and line 6 (smaller of line 2 or line 5); AR1000ES 2025 "Underestimate of Tax" ("not less than ninety percent (90%) of the … |
| ☐ | `safe_harbor.prior_pct` | 1 | verified | AR2210 (2025) Part II line 5 ("2024 net tax") and line 6 ("Required annual payment. Enter the smaller of line 2 or line 5"); AR1000ES 2025 ("computed on the lesser of the current year's tax liability or the previous y… |
| ☐ | `safe_harbor.high_agi_rule` | null | verified | No high-AGI rule: AR2210 (2025) Part II lines 5-6 use 100% of 2024 net tax with no AGI test; DFA Subject 105 states only 90% current / 100% prior |
| ☐ | `installments.due_dates` | ["2025-04-15","2025-06-16","2025-09-15","2026-01-15"] | verified | AR2210 (2025) Part III column dates 4-15-2025, 6-15-2025, 9-15-2025, 1-15-2026; AR2210 Instructions 1(c) (15th day of the 4th, 6th, 9th months and 1st month after year end); AR1000ES 2025 "Important Notice" (Saturday,… |
| ☐ | `installments.pcts` | [0.25,0.25,0.25,0.25] | verified | AR2210 (2025) line 7 ("Enter 1/4 (.25) of line 6 ... in each column"); AR1000ES 2025 worksheet ("Enter on voucher one-fourth (1/4) of line 8. (Make four (4) installments.)") |
| ☐ | `farmer.rule` | {"ratio":0.6666666666,"current_pct":0.9,"due_date":"2026-02-17","fi… | unverified | Ratio and dates VERIFIED: AR1000ES 2025 "Exception" and AR2210 Instructions exception 1 (farming income at least two-thirds of total gross income; declare and pay by the 15th day of the 2nd month after year end, or fi… |
| ☐ | `penalty.rate_source` | "state" | verified | AR1000ES 2025 "Underestimate of Tax" ("a penalty of ten percent (10%) per annum shall be added to the amount of the underestimate"); AR2210 Instructions 2(b); AR2210 (2025) line 16 (x .10) - a fixed state rate, not th… |
| ☐ | `penalty.rate` | 0.1 | verified | AR2210 (2025) line 16 ("Underpayment from line 13 x Number of days from line 15 / 365 x .10"), line 15 (days to payment date or 4-15-2026, whichever is earlier); AR1000ES 2025 (10% per annum, assessed quarterly) |
| ☐ | `credit_for_other_state` | true | verified | AR1000F/AR1000NR Instructions 2025, Line 36 (Form AR1000TC credits include "Other State Tax Credit") |
| ☐ | `nonresident_method` | "ratio" | verified | AR1000F/AR1000NR Instructions 2025, Lines 38A-38D (AR1000NR: Arkansas AGI (col. C) / total AGI (cols. A+B) = Arkansas percentage of income, x net tax computed on all income = "Arkansas apportioned tax liability") |
| ☐ | `holidays` | ["2025-01-01","2025-01-20","2025-02-17","2025-05-26","2025-07-04","… | unverified | UNVERIFIED: Ark. Code §1-5-101 (state holidays) could not be read in a primary source (Justia/arkleg returned 403); list built from secondary summaries of that section (New Year's Day; MLK Day 3rd Mon Jan; George Wash… |

### AR 2026: 13 keys, 11 verified by the researcher

| ☐ | Key | Value | Status | Citation |
|---|---|---|---|---|
| ☐ | `has_income_tax` | true | verified | Act 1 of 2026 (1st Extraordinary Session, HB1001, approved 5/6/26) §1 amending Ark. Code §26-51-201(a)(4) (individual rates for tax years beginning on or after Jan. 1, 2026); DFA AR1000ES 2026 |
| ☐ | `required_threshold` | 1000 | verified | DFA AR1000ES 2026 (Instr. R 10/14/2025) worksheet line 8 ("If $1,000 or more, file the Declaration Voucher. If less than $1,000 no Declaration Voucher is required"; estimated tax = tax - credits - AR withholding). CAU… |
| ☐ | `safe_harbor.current_pct` | 0.9 | verified | DFA AR1000ES 2026 "Underestimate of Tax" ("not less than ninety percent (90%) of the amount actually due"; penalty if quarterly payments are not "at least ninety percent (90%) of the amount actually due"). 2026 AR2210… |
| ☐ | `safe_harbor.prior_pct` | 1 | verified | DFA AR1000ES 2026 "Underestimate of Tax" ("The Underestimate Penalty is computed on the lesser of the current year's tax liability or the previous year's tax liability"); DFA Subject 105 (100% of last year's tax if a … |
| ☐ | `safe_harbor.high_agi_rule` | null | verified | No high-AGI rule: DFA AR1000ES 2026 refers only to "the previous year's tax liability" with no AGI test; DFA Subject 105; AR2210 (2025) lines 5-6 |
| ☐ | `installments.due_dates` | ["2026-04-15","2026-06-15","2026-09-15","2027-01-15"] | verified | DFA AR1000ES 2026 worksheet (declaration dates April 15, June 15, September 15, 2026 and January 15, 2027) and holiday/weekend note; AR2210 Instructions 1(c). None of these dates is a weekend or AR holiday (Wed/Mon/Tu… |
| ☐ | `installments.pcts` | [0.25,0.25,0.25,0.25] | verified | DFA AR1000ES 2026 worksheet ("If you first become liable to file a declaration on April 15, 2026: Enter on voucher one-fourth (1/4) of line 8. (Make four (4) installments.)") |
| ☐ | `farmer.rule` | {"ratio":0.6666666666,"current_pct":0.9,"due_date":"2027-02-16","fi… | unverified | Ratio and dates VERIFIED: DFA AR1000ES 2026 "Exception" (farming income at least two-thirds; pay by the 15th day of the 2nd month after year end, or file and pay in full by the 15th day of the 3rd month). Feb 15, 2027… |
| ☐ | `penalty.rate_source` | "state" | verified | DFA AR1000ES 2026 "Underestimate of Tax" (penalty of ten percent (10%) per annum, assessed on a quarterly basis) - fixed state rate |
| ☐ | `penalty.rate` | 0.1 | verified | DFA AR1000ES 2026 "Underestimate of Tax" ("a penalty of ten percent (10%) per annum shall be added to the amount of the underestimate"); AR2210 Instructions (R 6/27/2025) Part II (days / 365 x 10%) |
| ☐ | `credit_for_other_state` | true | verified | AR1000F/AR1000NR Instructions 2025, Line 36 (AR1000TC "Other State Tax Credit"); no 2026 change found. 2026 return instructions not yet published at research time. |
| ☐ | `nonresident_method` | "ratio" | verified | AR1000F/AR1000NR Instructions 2025, Lines 38A-38D (Arkansas percentage of income x net tax on all income). 2026 instructions not yet published at research time; method unchanged by Act 1 of 2026 (rates only). |
| ☐ | `holidays` | ["2026-01-01","2026-01-19","2026-02-16","2026-05-25","2026-07-03","… | unverified | UNVERIFIED: Ark. Code §1-5-101 could not be read in a primary source (403); list built from secondary summaries (see TY2025 row). Calendar years 2026-2027; Dec 25, 2027 (Saturday) observance overlaps Christmas Eve Fri… |


## Manual QA checklist
_(Phase 11.)_


## Notes for the engine author (Phase 6) — collected from the Phase 1-5 builders
**Parameters:** read only through the registry/`getParameters(year)`; values are JSON (money/counts exact numbers, rates fractions, dates `YYYY-MM-DD`). Override rows report status `unverified`.
**Taxpayer data:** `sehi_eligible_months[m] === true` means SEHI is deductible that month (polarity inverted from the original kit prose). Links carry `tenant_id` + `company_id`; always go through the `FirmScope`.
**Books → tax basis (`getTaxBasisPl`):** money is a 4-decimal string; character totals and account amounts are profit-positive (income +, expense −); owner amounts, guaranteed payments, payments, add-backs, W-2 wages and farming gross income are positive magnitudes. Character comes from TB codes by seed CODE identity (table below); an estimator character treatment wins; unassigned accounts are ordinary + warning. TB RJEs are shown per account but NOT applied (avoids double counting with estimator adjustments); the RJE year is the estimator tax year. Depreciation flagged `tax_depreciation_differs` keeps the BOOK amount in profit; the adjustment 'Depreciation (tax vs book)' carries the FULL TAX amount and the engine replaces book with tax (so the engine must net book vs tax itself; the provider reports the book amount). Suspense look-alikes are company-scoped. Cache key = (tenant, company, year, basis, through, GL stamp, config hash incl. firm codes), no Redis invalidation needed.
**Readiness:** an account is closed through a month only if its completed reconciliation's statement date is that month's last day (a statement ending Sep 15 counts as closed through August); an account never reconciled and with no activity before the tax year is closed through the month before its first activity.

### R1 fixes the engine must consume (review R1-books-to-tax-basis.md)
- **Range end:** omit `through` and the provider uses the last closed month, else the last complete calendar month (never the current partial month; a year with no complete month is 422 `TE_NO_COMPLETE_MONTH`). `throughMonthSource` / `throughMonthReason` say which; `monthsElapsed` is the run-rate divisor and `monthsRemaining` the multiplier. A requested current month is allowed with `TE_RANGE_PARTIAL_MONTH`.
- **Guaranteed payments (partnership):** `guaranteedPayments[] = {personId, amount, accounts, trace}`. The amount is ALREADY deducted from entity profit (`byCharacter`); the engine allocates entity profit by `profit_pct` and then adds each GP to that partner's ordinary SE income (and QBI rules for GPs: not QBI). An account with a TB GP code and no treatment raises `TE_GP_CODE_WITHOUT_TREATMENT` (the GP reaches no partner).
- **Owner items:** Sch C / Sch F / partnership `owner_sehi` / `owner_retirement` are removed from entity profit (`ownerLevel.ownerSehi` / `ownerRetirement`, per person in `ownerLevel.byPerson`, personId null = the single owner). S corp: `owner_sehi` STAYS in entity profit and the officer gets `sehiAsW2Wages` (add to W-2 box 1 only — not SS / Medicare wages, not the §199A wage total unless Phase 6 decides otherwise) plus `ownerSehi` (the SEHI deduction); S corp `owner_retirement` stays in entity profit, reported as `employerRetirement` (no owner deduction). TB 887/888 (Sch C) and 689/690 (Sch F) route to owner SEHI without an estimator treatment (`treatmentSource: 'tb_code'`).
- **W-2 wages:** `w2Wages.effective` is the FULL-YEAR figure for the §199A limit (override, else `projectedYear` = YTD + recurring ÷ monthsElapsed × monthsRemaining); `ytd` is the books YTD; `byPerson` = officer wages per officer.
- **Payments:** always read on a cash basis (a payment is the date cash left).
- **Farmer test:** a `sch_f` entity (or `farmer_override = true`) with no TB farm codes counts ALL income accounts as gross farming income (`TE_FARM_INCOME_ASSUMED`).

**Character map (seed 2025, by return form | activity | code):**

| Seed code(s) | Character |
|---|---|
| any form, activity `rental` / `farm_rental` | `rental` |
| 1065 common 110 Interest income, 115 U.S. interest | `interest` (income accounts only) |
| 1065 common 111 Ordinary dividends | `dividends_ordinary` (income accounts only) |
| 1065 common 399 Sch D L14 Capital gain distributions | `capital_gain_lt` |
| 1065 common 155 Tax-exempt interest, 482 M-1 other tax-exempt income | excluded (tax-exempt) |
| 1065 common 491 M-1 4797 gain/loss - book | ordinary + `TE_M1_CODE_ON_PL_ACCOUNT` (never §1231) |
| 1120S common 150 / 151 interest | `interest` |
| 1120S common 156 Ordinary dividends | `dividends_ordinary` |
| 1120S common 104 / 105 Capital gain distribution (105 = 28%) | `capital_gain_lt` (28% rate not modelled) |
| 1120S common 485 / 486 / 487 M-1 income on books not on Sch K | excluded (tax-exempt) |
| 1120S common 482 / 483 / 484 M-1 expenses on books not on Sch K | excluded (nondeductible) |
| 1120S common 488 M-1 4797 gain/loss - book | ordinary + `TE_M1_CODE_ON_PL_ACCOUNT` |
| 1120 business 105 / 106; common 107-122; 125; 487 / 488; 484 / 485; 489 | interest; dividends_ordinary; capital_gain_lt; excluded; excluded (nondeductible); ordinary + warning |
| any other `is_m1_adjustment` code on a P&L account | ordinary + `TE_M1_CODE_ON_PL_ACCOUNT` |
| everything else (every 1040 code included) | `ordinary` |

The seed has no short-term gain, §1231, qualified-dividend code and no 1040 interest/dividend code: those come only from the estimator character treatments `capital_gain_lt`, `capital_gain_st`, `section_1231`, `interest`, `dividends_ordinary`, `dividends_qualified` (income / other-income accounts). FIRM: codes have no stable identity and fall back to their description. The test `pl-provider.r1.test.ts › F6` iterates the real seed and pins this table.

**Adjustments:** `kind` ∈ income|deduction|addback with positive `amount`; meals is an addback with `default_pct` 50, the adjustment's `pct` overrides; month index 0 = January; `allocateAdjustment` / `splitActualsAndRemaining` in shared are the allocators; GL-linked adjustment with `amount = NULL` means run-rate; `sourced_manual = false` means derive sourced income (entity `state_sourcing` × share). Year-level inputs are shared across scenarios (only adjustments and state rows are cloned). Safe-harbor precedence: year → taxpayer → firm default (`lesser_of`). Prior-year tax/AGI are decrypted only in `years.service.ts`; the engine takes them through a service call.
**Known gaps for later phases:** estimated-tax payments are read only within the calendar year window — **Phase 10 must also include January payments of the following year toward the Q4 installment** (and the prior-year overpayment on the original due date); the Annual-settings UI has no GL-account picker for GL-linked adjustments (API only) and no state-rule verification badge; (the Entity tax setup screen has since been built).
**State rules:** `resolveStateRulesForEngine(state, year)` → `{rules, usesFederalFallback, verifyBadge}`; a complete provisional-from-prior set is usable with the verify badge; incomplete or missing sets fall back to the federal pattern. Idaho, Arizona and Georgia estimate tests are not expressible with `required_threshold` (gross-income tests / unverified mappings): see the batch reports before relying on them.

**State rules the engine must special-case (from the Phase 2 audits and R5, see OPEN-QUESTIONS Q26):** read `resolveStateRulesForEngine` — when `estimatesRequired` is false (ID, UT) produce no vouchers and no installment penalty (the installment keys are withheld; Utah's prepayment test is described by threshold 0 / one 100% item); `farmer.rule.treatment = 'exempt'` (IL, MT, VT) or `current_pct: 0` (OK, OR) means no farmer installments and no penalty, `'quarterly'` (MA) means the regular four installments at `current_pct`; penalty only when the balance after withholding reaches `penalty.min_balance_due` (MO 500; null = `required_threshold`), boundary per `threshold_comparison` (AR `more_than`); penalty rate per day from `statePenaltyRateOn` (`penalty.rate_schedule` legs supersede `penalty.rate`; an uncovered day — e.g. unpublished 2027 rates — falls back to `penalty.rate` with verify); accrual per `penalty.method` (HI monthly_or_fraction, ME monthly_compound, IL tiered_flat with a null rate: compute nothing, never fall back to federal); penalty period ends at `return_due_date` (VA May 1, HI Apr 20; null = Apr 15) and the last installment is waived when filed and paid by `installments.q4_file_and_pay_date`; CA `high_agi_rule.no_prior_year_agi` removes the prior-year harbor. Still prose-only: AZ/GA/PA/ME/NM income-based requirement tests, MI/VT/IN add-ons, AZ/UT caps, AL 2026 and NM federal-source carry rules (no engine code reads penalty source yet).

## 2026-10-13 — Q44 dependents (feat/tax-est-dependents)
Dependents per taxpayer (migration 0204_tax_est_dependents), care expenses on the year, engine 1.0.0-rc.4 (§21 care credit, §24 CTC / ODC / ACTC, EITC / HoH warnings, Schedule AI full-year credits), state `exemptions` rule for 41 states + DC (2025 / 2026, unverified), Dependents card + year input, PDF / assumptions lines, independent oracle `dependents_fixture.py` + golden test. Decisions and Kurt's review list: OPEN-QUESTIONS.md Q44. All new parameters and state rows are `unverified` (Kurt verifies in Admin).

## 2026-10-13 — Q45 businesses outside MyBooks (feat/tax-est-dependents)
Outside businesses per taxpayer (migration 0206_tax_est_outside_entities: definition + per-year amounts), engine 1.0.0-rc.5 (`engineEntityFromOutside` / `outsidePeriodEntity` bridge; `EntityResult.source / amountBasis / entryMode`), estimate assembly (individual path, C corp entity path, Schedule AI period figures, state sourcing, cache key, snapshot inputs, readiness info), "Outside businesses" card with per-year amounts, Calculation view / PDF / assumptions lines, independent oracle `outside_fixture.py` (linked Sch C + outside passive K-1 owner share + outside YTD Sch C) + golden test, unit / API isolation / estimate tests. Decisions and Kurt's review list: OPEN-QUESTIONS.md Q45 (MODULE.md D19).

## 2026-10-13 — Q46 prior-year trend projection (feat/tax-est-dependents)
`projection_method` per entity year (migration 0207_tax_est_projection_method, default `run_rate`), engine 1.0.0-rc.6 (`engine/py-trend.ts`: `priorYearTrendFor` / `evaluatePriorYearTrend`; ordinary character only; guardrail fallbacks `TE_PY_TREND_FALLBACK`, cap `TE_PY_TREND_CAPPED`; `EntityResult.projection` only when selected, so run-rate results are byte-identical to rc.5), prior-year reader `prior-year-trend.service.ts` (the same P&L provider for taxYear − 1), estimate gather / cache (`te-estimate-v6`, method + PY figures in the key) / snapshot inputs / readiness line, C corp 422, year-inputs selector, Calculation view sub-label + chips, assumptions. Independent oracle `pytrend_fixture.py` (seasonal Sch C under all three methods + a capped factor) + golden test. Decisions / defaults for Kurt: OPEN-QUESTIONS Q46.
