# R7 — Final independent audit of the Tax Estimator (merge readiness)

Reviewer: R7 (Fable 5.1, independent of every build and fix agent). Date: 2026-10-12. Branch `feat/tax-estimator` @ `1029420e` (main @ `ecac490a`, v0.9.218; `git rev-list --count HEAD..main` = 0, so main has not moved since the branch point and 0201 is still the next free journal index). Read-only on code; this file is the only artifact written.

Method: read R1–R5 and checked every "fixed" row against the current source (not the review text); read MODULE.md / OPEN-QUESTIONS.md / PROGRESS.md / PHASES.md Phase 14 / UI-SPEC / DATA-DICTIONARY / release notes / both knowledge bases; traced the full path books → `pl-provider` → `bridge.ts` → `computeFederal` / `computeState` / `computeFederalEstimates` / `computeStateEstimates` / `computeFarmer` / `computeCcorp` → `EstimateResultDTO` → `buildEstimateAssumptions` → PDF / portal projection; diffed `main...HEAD` (407 files, +64,973 / −35) for touches outside the module; ran the repo gates and the test suites under D13 (`kisbooks_test:5434`, redis `6390`, one API file at a time).

## Verdict: **MERGE-READY-WITH-FIXES** — 0 blocker, 2 major, 11 minor

Merging to main is safe: the flag is OFF everywhere (shipped list, new-tenant default-off set, migration seeds `FALSE` per existing tenant), `portal_contact_companies.tax_estimates_access` and `report_pack_runs.allow_tax_estimate` default `FALSE`, firm defaults are `lesser_of` / `live`, the `tax_estimator` resource resolves like `trial_balance` (by role, and still behind flag + firm scope), the migration is additive with a complete rollback, every gate is green, and nothing outside the module changes behaviour for existing users (details in §4). What is **not** ready is *enabling it for the firm*: the two majors below (wage-earner inputs have no UI; the error-code / audit / module docs promised in MODULE.md and PHASES.md Phase 14 do not exist) plus Kurt's two open sign-off gates. Fix R7-01 and R7-02 before the flag is turned on; the minors can ride the first point release.

### Gate results (2026-10-12)

| Gate | Result |
|---|---|
| `tsc --noEmit` shared / api / web | 0 / 0 / 0 errors |
| `scripts/check-license-headers.sh` | all headers present |
| `scripts/check-migration-policy.sh` | exit 0 (additive) |
| `scripts/check-any-baseline.sh` | api 319 / web 1 / worker 0 (at baseline) |
| shared `src/tax-estimator` | 29 files, **394 passed** (incl. `federal.golden`, `estimates.golden`, `oracle.scenarios.golden`, `no-literals.guard`) |
| web tax-estimator + portal + report-pack tests | 15 files, **122 passed** |
| api (18 files, serial): routes guard chain, `pl-provider.r1`, `estimate.integration` (Rivera via DB = oracle), `estimate.r3.integration`, snapshots, `tax-estimate.r4`, portal routes, report-pack R4, estimate/pdf/years/entities routes, pl-provider, tax-parameters, both seed completeness suites | **all passed** (≈ 497 tests) |
| secrets / `console.log` / `TODO` / `FIXME` / `debugger` in branch source | none in module code (the only `console.log`s are the two boot lines in `index.ts`, matching the existing boot log style) |
| working tree | clean (`git status` empty) |

### Prior-review fixes — verified present at HEAD (not regressed)

R1 F1–F16: all present (`guaranteed_payment` route + `TE_GP_CODE_WITHOUT_TREATMENT`, S corp `officer_sehi` / `officer_retirement`, TB 887/888/689/690 routing, payments read `basis: 'cash'`, last-closed-month default via `closed-month.service.ts`, character by seed code identity + `TE_M1_CODE_ON_PL_ACCOUNT`, `w2Wages.{ytd,projectedYear,effective}`, farm fallback, `TREATMENT_ACCOUNT_TYPES`, person targets, firm-code hash, `exactAmounts`). R2-01…R2-23: all present (exclusive dividend buckets `income.ts:12-15,431`; MFS Sch 1-A `deductions.ts:195`; Form 8582 Wks 4/5 allocation `loss-limits.ts:175-197`; version `1.0.0-rc.1` with history; R2-05/06/07 in `sch-ai.ts`; R2-10 relabel; R2-11 skip; R2-12 info; R2-13 §1402(a) base; R2-14 step; R2-15 `shareAfterLossLimits` + ordinary/rental/§1231 only; R2-16 accepted; R2-18 regime-first; R2-19 note; R2-21 note; R2-22 info; R2-23 `qbiEligible:false`). R3-01…R3-18: all present (scope digest in `inputsHash`, Q4-cutoff attribution window, reconciliation state in `loadConfigVersion`, fallback date roll, tri-state `farmerOverride`, PDF → `pdf` snapshot + `download` audit, `READ_POSTS` for `/estimate` and `/pdf`, `pageOf`, `TE_PAYMENT_*` codes, parameterised `tenantInScopeSql`, `TE_*_SAVE_FAILED`, `live: null`). R4-01…R4-10: all present (pack gate `taxEstimateReportScope`, encrypted `.pdf.enc` artifacts, requester-only runs, preview initiator re-check, worker permission re-check, `audience: 'client'` with `CLIENT_ASSUMPTION_SECTIONS`, paragraph-wrapped disclaimer, `notFound()` when no base scenario, uniform 404, `TE_ACCESS_GRANT_FORBIDDEN` + `tax_est_contact_access` audit, `reuseSameDay`). R5: MO 0 unverified rows; AR 2 (`farmer.rule`, documented); seven new keys wired through `resolveStateRulesForEngine`.

Oracle: `rivera_expected.json` and `scenarios_expected.json` match the engine on every line (Q35/Q37), and the DB-seeded Rivera reproduces 35,829 / 7,590 / 312 / 43,732 / $11.

---

## 1. Findings

### R7-01 — Major — Outside W-2 wages, Social Security wages, retirement plan type and employee deferral (Q28) and the Q33/Q34 year inputs have no UI; the knowledge base tells users to enter wages as adjustments, which the engine would mis-characterise

**Where.** `packages/web/src/features/tax-estimator/years/YearInputsForm.tsx` (whole file: prior year, rate mode, deductions, Sch 1-A, credits, HSA coverage, withholding — nothing else); `grep -rn personInputs|retirementPlanType|employeeDeferral|w2SocialSecurityWages|mfsLivedApart|niiAllocable|farmerGross|isFisherman packages/web/src/features/tax-estimator` → **no hits**. The API accepts them (`shared/src/schemas/tax-estimator-years.ts:77,107-111`; the DB Rivera test sets `personInputs.*.retirementPlanType` through the service, `estimate.integration.test.ts:161`) and the bridge maps them (`engine/bridge.ts:118-129` `personYearInputsFromDto`; `estimate.service.ts:504`). The shipped adjustment catalog (`migrations/parts/years.sql:145-167`) has **no wages type**; an income adjustment lands in `adjustmentCharacter()` → `'ordinary'` (`engine/income.ts:139-146`) and never in `PersonIncome.wages` / `socialSecurityWages` (`income.ts:316, 335-337`). The help article says the opposite: "outside W-2 income, interest, dividends and the like are entered as adjustments" (`web/src/features/help/articles.ts:3266`).

**Defect.** OPEN-QUESTIONS Q28 ("Add `retirement_plan_type` + `employee_deferral` and person W-2 wages to year inputs … before Phase 11 UI") was done in the schema and bridge but never surfaced. A household where one spouse has a W-2 job — the most common CPA-firm case after Rivera — cannot be modelled from the screens; the only UI path is wrong.

**Failure scenario.** Sch C owner, profit 100,000, same person also earns 150,000 W-2 at an unrelated employer, MFJ. Entered correctly (API): SS wages 150,000 leave 184,500 − 150,000 = 34,500 of wage base → SE SS part 12.4% × 34,500 = 4,278. Not entered (UI user): SE SS part 12.4% × 92,350 = 11,451 — **SE tax overstated ≈ 7,173**, and the 150,000 of wages is missing from AGI (income tax understated ≈ 33,000 at 22%). Entered as an `other_income` adjustment per the help article: AGI right, but the wages are "business ordinary" — SE wage-base offset still lost (same 7,173), Additional Medicare threshold-by-wages-first wrong, Sch AI Part II wrong, `otherTaxPersons.medicareWages` wrong. Same for a solo-401(k) owner: the UI cannot say "solo_401k", so `TE_RETIREMENT_PLAN_ASSUMED` fires and the SEP limit (20%) is applied to a plan whose limit is deferral + 20%.

**Fix (ui-builder, sonnet; 1 screen).** Add a "People" card to Annual settings (one row per person): W-2 wages (box 1), Social Security wages (box 3, optional, hint "usually higher than box 1 with 401(k) deferrals"), retirement plan type (none / SEP / solo 401(k) / SIMPLE), employee deferral; plus year-level `mfsLivedApartAllYear` (MFS only), `niiAllocableDeductions`, farmer gross-income figures (shown when a Sch F / farmer entity is linked) and `isFisherman`. Wire to `personInputs` etc. on `upsertYear` (API already there). Then correct `articles.ts:3266` and the curated md (see R7-03). Until shipped, say in the KB that wages are entered per person on Annual settings, never as adjustments.

### R7-02 — Major (docs / operability) — The module documentation MODULE.md promises does not exist: ~190 `TE_*` error codes with 17 documented, no audit entity-type catalogue, and `docs/tax-estimator/MODULE.md` (PHASES.md Phase 14 deliverable) was never written

**Where.** MODULE.md:195 says the `TE_*` list is "maintained here" and names 24 codes; `docs/tax-estimator/` contains only `DATA-DICTIONARY.md`. Count at HEAD: `grep -ohE "'TE_[A-Z0-9_]+'"` over branch source = **202 distinct codes** (plus template-literal throws such as `TE_PARAM_MISSING` / `TE_PARAM_INVALID` in `engine/parameters.ts:48,54`); codes in any doc = 17. Audit entity types written by the module (none listed anywhere): `tax_est_taxpayer`, `tax_est_person`, `tax_est_link`, `tax_est_entity_settings`, `tax_est_entity_year_inputs`, treatment / transaction-flag rows, `tax_est_year`, `tax_est_scenario`, `tax_est_adjustment`, `tax_est_adjustment_type`, `tax_est_state_rows`, `tax_est_firm_settings`, `tax_est_payment`, `tax_est_sch_ai_snapshots`, `tax_est_snapshot` (create + `download`), `tax_est_contact_access`, parameter / state-rule overrides. PHASES.md:137 also asks for the annual federal/state update procedure and the treatment-map guide; neither exists (the KB articles cover users, not operators).

**Defect.** The support path for a 422 (`TE_TREATMENT_NOT_FOR_ENTITY`, `TE_NO_COMPLETE_MONTH`, `TE_PAYMENT_OTHER_YEAR`, `TE_THROUGH_OUT_OF_RANGE` …) and the annual "new tax year" operator procedure (create year from prior → verify → adopt shipped → statuses) are undocumented; the audit trail D9 relies on cannot be reviewed against a list.

**Fix (api-builder, sonnet).** Write `docs/tax-estimator/MODULE.md`: surfaces (staff router, admin routers, portal router, pack section), guard chain, the generated `TE_*` table (code → HTTP status → where → meaning; generate it from a grep so it cannot drift, and add a test that every code in source appears in the doc), the audit entity-type table (entity, actions, what `after_data` holds), the annual update procedure, the treatment-map guide, the §7216 pointer to DATA-DICTIONARY. Fix the two path drifts in MODULE.md while there: admin routes are `tax-parameters-admin.routes.ts` + `tax-state-rules-admin.routes.ts` (not `tax-estimator-admin.routes.ts`, MODULE.md:34), and the chain uses `resolveTaxEstimatorScope` rather than `requireFirmStaff` (MODULE.md:195).

### R7-03 — Minor — Knowledge-base statements that do not match behaviour

| Where | Says | Behaviour |
|---|---|---|
| `articles.ts:3266` | outside W-2 income is entered as adjustments | no wages adjustment type; wages belong in `personInputs` (API only — R7-01) |
| `articles.ts:3381` ("Adjustments are spread across the remaining quarters equally") and `curated/47-tax-estimator.md:40,90` ("spread evenly over remaining quarters") | even quarterly spread | `allocateAdjustment` spreads by **cadence**: monthly, quarterly ÷ 3, annual ÷ 12, active start–end range; GL-linked = actuals YTD + plan or run-rate (`shared/tax-estimator/allocation.ts:136-143`) |
| `curated/47-tax-estimator.md:76` | "the firm **or the taxpayer** can switch it to the latest finalized snapshot" | only firm staff set `portal_shows` (per taxpayer or firm default); the client has no control |
| `articles.ts:3273` | "Retirement plan type is assumed to be a SEP" | true only because the UI lacks the field; the engine honours `solo_401k` / `simple` / `none` when sent (R7-01) |
| `curated:…"Finalize … downloading the PDF, and generating a Report Pack … each freeze an immutable snapshot"` | each | identical same-day `pdf` / `report_pack` issues reuse one snapshot (R4-09, `estimate-snapshots.service.ts:124-130`); the help article (`articles.ts:3473`) already says so — align the curated text |

Fix: edit the two files together (MODULE.md "Knowledge base" rule: update both), regenerate `app-knowledge.json` / `app-knowledge-prompt.md`.

### R7-04 — Minor — Dead code and dead engine inputs

- `purgeTaxpayerPayments` (`services/tax-estimator/payments.service.ts:414-417`): exported, no caller anywhere in `packages/` (tests included). Remove, or use it where taxpayers are deleted.
- `PersonYearInputs.withholding` / `.hsaContribution` (`engine/bridge.ts:56-66`) are never populated by `personYearInputsFromDto` (`:118-129`); `EnginePerson.withholding` is read by no engine function (vouchers use the year-level withholding). The golden test sets Maria's person-level withholding to 6,000 (`federal.golden.test.ts:96`) while the service always sends `'0'` — harmless today, misleading tomorrow. Drop the fields or document them as unused.
- `YearExtras` — `unrecaptured1250Gain`, `collectiblesGain`, `amtExposureFlagged` (`bridge.ts:115-150`) — `estimate.service.ts:505` calls `engineYearFromDto(y)` with no extras, so the 25% / 28% worksheet buckets and `TE_AMT_NOT_MODELLED` are **unreachable** from the app although MODULE.md step 11 and "AMT … warning line if the user flags AMT exposure" promise them. Either add the three year inputs (schema + UI) or mark them backlog in OPEN-QUESTIONS.
- `RetirementLimitInput.employeeDeferral` (`engine/owner-deductions.ts:37`) is accepted and never read: the solo-401(k) limit assumes the maximum deferral was made (`:102-103`). Correct as an upper bound; the input is dead. Remove or use it to cap the deferral leg at what was actually deferred.

### R7-05 — Minor — A GL-linked adjustment flagged non-recurring is still run-rated to year end

**Where.** `estimate.service.ts:367` passes `{ amount, cadence, startMonth, endMonth, glLinked: true }` to `allocateAdjustment`; `allocation.ts:136-143` run-rates when `amount == null`; `a.nonRecurring` is only read for the assumptions text (`assumptions.ts:208`) and the DTO.
**Scenario.** GL-linked adjustment with "Run-rate from GL" (amount null) on an account that received a one-time 30,000 insurance recovery in March, flagged non-recurring: through September the engine adds 30,000 ÷ 9 × 3 = 10,000 of phantom income for Oct–Dec.
**Fix.** When `a.nonRecurring && a.amount == null`, call `allocateAdjustment` with run-rate off (actuals only); when `a.nonRecurring` and a plan amount exists, keep the plan but never run-rate the actuals. One test in `estimate.r3.integration.test.ts`.

### R7-06 — Minor — Phase 14 acceptance not met: golden suite, performance target, manual QA

- PHASES.md:135 lists eight independent oracles; delivered: Rivera + seasonal, late payments, MFS, high-income MFJ, itemizer/SALT (`scenarios_fixture.py`). **Missing an independent oracle:** FY C corp with large-corp recapture, farmer on the prior year, passive loss + §469(i) + EBL, senior couple with Schedule 1-A, multistate with a higher-rate source state. Those paths are covered only by unit tests written beside the code (R2 O-2 half-closed).
- PHASES.md:136 "under 500 ms for 10 entities × 24 months with the cache" — no measurement anywhere in PROGRESS.md or tests. A cold estimate does 12 monthly P&L builds + a detail report per linked company, three more provider runs for Schedule AI columns, and a 12-subquery `loadConfigVersion` (incl. an `md5(string_agg(…))` over every reconciliation of the tenant, `pl-provider.service.ts:347-350`) per company per request.
- PROGRESS.md:33: "UI never opened in a browser; manual QA open"; `QA-CHECKLIST.md` (12 sections) has no ticked run. The 122 web unit tests exercise components, not the shell integration (sidebar group, route guard redirect, lazy chunks, Report Pack picker against a live API).
**Fix.** Run QA-CHECKLIST §0–§11 once on the test firm before enabling; add a timing assertion (or at least a logged measurement) to `estimate.integration.test.ts`; schedule the three missing oracles (C corp recapture, §469(i)+EBL, farmer prior year) for the first point release.

### R7-07 — Minor — UI built vs UI-SPEC (what is not there)

Built and matching the spec: Taxpayers list/detail, persons, links (% totals notice), contacts panel; Entity tax setup (profile, owners, readiness, treatment table with suggestions banner, preview footer book → reclass → tax-basis); Annual settings (scenario pills, rate mode, deductions, Sch 1-A per-person **inline fields** rather than a dialog — acceptable, credits, HSA, prior year, states editor, adjustments grid + allocation strip); Estimate summary (actuals-through, scenario select, readiness banner incl. fallback-year note, key figures, calculation table with trace drawer, safe-harbor two tiles, per-jurisdiction voucher tabs with Sch AI / penalty / pay-now, special cases for farmer + C corp, payments ledger, finalize dialog, snapshots history / view / compare); Scenario compare (3 cards + line table); Admin tax parameters (federal + states, overrides, create year from prior, shipped diff / adopt); portal tile + page + vouchers PDF; Report Pack section option.

Not built (API-only or absent):
1. Person-level year inputs and Q33/Q34 inputs (R7-01).
2. Transaction-level `non_recurring` flag in the register (`tax_est_transaction_flags`): no UI anywhere in `features/banking` / transactions; UI-SPEC §06 footnote promises it.
3. GL-account picker for GL-linked adjustments (`AdjustmentsSection.tsx:135-139` only carries an existing `gl` object; PROGRESS.md "Known gaps" confirms API-only).
4. Safe-harbor card: "a line showing what Q4 would be under the other rule" (UI-SPEC §01) — `SafeHarborCard.tsx` has no such line.
5. "Income by source card … plus per-person SE tax tiles" — per-person SE tax appears only as calculation-table rows (`calcLines.ts:98`).
6. State-rule verification badge on each Annual-settings state card (UI-SPEC §02) — `StateRowsEditor.tsx` shows only validation problems; rule status is surfaced later on the estimate banner.
7. Admin "Verify" action per row (UI-SPEC §04) — no route or mutation changes a status; statuses can only change by editing the seed files (see Kurt brief, "how a row becomes verified").
8. AMT exposure flag, unrecaptured §1250 / collectibles gain inputs (R7-04).
9. "Add to Report Pack" is a link to Report Packs with instructions (`EstimateSummaryPage.tsx:152-153`), not an action — acceptable.
10. Sidebar icon rail (`collapsed`) hides the Tax Estimator group entirely (`Sidebar.tsx:609` pattern shared with `TrialBalanceGroup`) — consistent with TB, noted only.

### R7-08 — Minor — Three age / step parameters seeded `unverified` make every estimate carry "N federal parameter(s) are unverified" until Kurt verifies them

`std_deduction.additional_age`, `sch1a.senior.age` and `sch1a.phaseout_step` are read unconditionally on every non-MFS return (`deductions.ts:199-200,180`), so the readiness banner (`ReadinessBanner.tsx:40-42`), the warnings list and the preparer PDF flag every estimate, drowning the signal for the parameters that actually need review. `penalty.underpayment_rate` is unverified as a whole key because its 2027 quarters are placeholders, so the flag fires on every penalty computation even for days in verified quarters. Fix: Kurt verifies the three age/step keys (statutory: §63(f) 65, §151(d)(5) 65, §224(b)(2) / §225(b)(2) $1,000) in the Phase 1 checklist and the seed statuses are flipped; split `penalty.underpayment_rate` status per leg (or mark the key `provisional` with the leg-level `covered:false` flag the state schedules already have) so only 2027 days warn.

### R7-09 — Minor — C corporation path is current-year-only and cannot be adjusted

`estimate.service.ts:646-665`: taxable income = projected book characters; link-level adjustments for a C corp link are dropped with `TE_ADJUSTMENT_LINK_EXCLUDED` (`:491-494`); `priorYearsTaxableIncome: null, priorYear: null, states: []` (Q34). A C corp with book/tax depreciation differences or a prior-year safe harbor gets 100%-of-current installments on book income with no way to correct it. Warned (`TE_CCORP_INPUTS_LIMITED`) and acknowledged in Q34; listed so the first point release scopes it (C corp year inputs: prior-year tax, 3-year taxable incomes, apportionment %, entity-level adjustments).

### R7-10 — Minor — Startup re-sync of shipped seeds runs on every boot

`packages/api/src/index.ts:181-196` upserts every shipped federal parameter and state-rule row (≈ 300 + ≈ 1,700 rows, `onConflictDoUpdate` of value/status/citation) on every API start. Overrides live in separate tables so nothing user-set is lost, and failures are logged not fatal — correct. Note for operators: a seed edit in code is the *only* way a row's status changes (R7-07 item 7), and it takes effect at the next deploy; document in the Phase 14 docs (R7-02) and consider skipping the sync when a per-seed content hash is unchanged.

### R7-11 — Minor — Readiness banner labels every non-verified parameter "federal"

`ReadinessBanner.tsx:40-42` counts `estimate.parametersUsed` with `status !== 'verified'` as "N federal parameter(s) are provisional/unverified"; the fallback-year case correctly makes them all provisional. State rules are counted separately via `rulesUsed`? — no: `rulesUsed` is not read by the banner; state `verify` badges appear only on the state rows of the calculation table and the voucher tabs. Add a "M state rule(s) unverified (ST, ST)" item from `rulesUsed`.

### R7-12 — Minor — `TE_SS_WAGES_DEFAULTED` is an `info`, but its effect is the largest single SE-tax error in the engine

`federal.ts:120-122`: when `w2SocialSecurityWages` is null the box-1 figure is used for the wage-base offset — conservative, as R2-22 said — but with R7-01 the service always sends null, so every wage earner is affected. Raise to `warning` and include the dollar effect (`se.ss_rate × min(nese, wages − box1)` upper bound) until the SS-wages input exists.

### R7-13 — Minor — Doc drift in MODULE.md that will mislead the next maintainer

MODULE.md:34 (admin routes file name), :195 (`requireFirmStaff` in the chain — actual is `resolveTaxEstimatorScope`), :37 (module docs path "written in Phase 14" — not written), :171 ("every taxed state carries all 20" keys — correct) vs OPEN-QUESTIONS Q26 "1,698 rows … 541 unverified" (statuses, fine). Also PROGRESS.md "Fable deep reviews" table says R1/R5 fixes merged in `f746d98f` — correct — but the R6 row (parameter lifecycle) is empty and no R6 report exists in `docs/reviews/`; either run it or strike it from ORCHESTRATION §5.

---

## 2. End-to-end integration checks that PASSED (so the fixes above are not read as a rewrite)

**Books → provider → bridge.** Entity type from `company_tax_profiles.return_form` with estimator fallback; tax method = `companies.accounting_method` with override; P&L on the effective basis; payments always cash; last-closed-month default, partial month only on request with `TE_RANGE_PARTIAL_MONTH`; character by seed code identity; owner items routed per entity type; GP kept in the partnership and emitted per partner; S corp officer wages per officer (`w2Wages.byPerson`) → `officerWages` → projected whole (`income.ts:223`) → added to `wages` **and** `socialSecurityWages` (`:335-337`); `sehiAsW2Wages` → box 1 only; `w2WagesEffective` (projected full year or override) → §199A limb per link × profit fraction (`qbi.ts:153`); UBIA per entity-year; book depreciation kept and swapped by the `depreciation_tax_vs_book` adjustment with the sign convention consistent end to end (provider `s4(acc.book)` profit-positive → `bridge.test.ts:37` expects `'-4500'` → `income.ts:167-173` adds back `−book × fraction`).

**Bridge → engine.** `engineEntityFromTaxBasisPl` filters links by tenant/company/**taxYear**/in-scope; persons get Sch 1-A and HSA coverage by role; `personYearInputsFromDto` passes spouse inputs when present (R7-01 is UI-only); adjustments carry type flags; `mfsLivedApartAllYear` reaches `applyLossLimitations` (`federal.ts:170`); `niiAllocableDeductions` reaches NIIT (`estimate.service.ts:509`).

**Engine order.** §469(i) MAGI probe pass → real pass; SE tax per person with the person's own SS wages (Q37 per-person offset confirmed); SEP/401k/SIMPLE after ½ SE; SEHI after retirement, capped at SE earned income + S corp officer wages; AGI; standard (65/blind by Jan-1 age, §170(p) non-itemizer) vs itemized (SALT cap/phase-down/floor, §170 0.5% floor, §68 2/37) with the pre-§68 QBI base (Q32) and R2-11 skip; Sch 1-A gated by year and MFS; QBI with W-2/UBIA limbs, SSTB, phase-in, loss netting, REIT/PTP, overall limit, §199A(i) minimum; QD/LTCG worksheet; credits capped; Additional Medicare (wages first, Medicare wages = max(box 1, SS wages) + officer wages); NIIT; farmer 2/3 test with current + prior legs; C corp §6655 with large-corp recapture.

**Estimates.** Rounded federal total / state net tax as current-year tax (Q34); safe harbor both rules, `lesser_of` default, high-AGI on **prior-year** AGI, CA current-AGI cutoff; §6654(e)(1) floor and zero-prior-tax waiver; installments rolled past federal holidays; Schedule AI columns from Sch AI snapshots (frozen) or live provider runs through the period month, with GL-linked adjustments sliced to the period, SEHI period fraction (R2-05), exact Part II (R2-07), column warnings merged (R2-06), 12/31 column = projection, farmers skip Sch AI; payments filtered per jurisdiction inside the engine, prior-year overpayment on the prior return due date, event-driven application and §6654 accrual split at rate / year boundaries (Form 2210 convention, Q35); state vouchers per `state_estimate_rules` incl. `estimates_required`, `penalty.min_balance_due`, `threshold_comparison`, `rate_schedule` with uncovered-day fallback + verify, `method`, `return_due_date`, `q4_file_and_pay_date`, farmer treatments, AZ/GA/PA/ME/NM income gates (D12b) fed from the state-row gate inputs (`estimate.service.ts:609-619`); orphan state payments warned.

**DTO → assumptions → PDF / portal.** `buildEstimateAssumptions` in one place for cache, snapshot and PDF; the preparer PDF prints warnings, readiness codes, unverified parameters, engine version; the client PDF (pack section) prints only summary, federal/state, safe harbor amounts, vouchers, projection / non-recurring assumptions and the disclaimer; the portal projection builds a fresh object from named fields only (R4 verified, re-read).

**Isolation / defaults / migration.** Guard chain pinned by tests; `allowedTenantIds` = assignments ∩ access; every books read after `assertEntityInScope`; cache keys carry firm + scope digest; portal computes under the firm's full set and projects; pack artifacts encrypted and requester-only. Flag and both booleans default OFF/false; `FLAGS_DEFAULT_OFF_FOR_NEW_TENANTS` updated. Migration 0201: 59 `IF NOT EXISTS`, every `CREATE TABLE` / `ADD COLUMN` / function / trigger has a matching `DROP … IF EXISTS` in the rollback (17 added columns ↔ 17 dropped; 18 tables ↔ 18 drops; flag rows deleted), children before parents, journal `when` strictly increasing; `check-migration-policy.sh` passes; no backfill of existing data.

**Touches outside the module** (all within MODULE.md's "integration hooks" allowance, all additive): `report.service.ts` (`exactAmounts` opt-in; the `amount === 0` skip now also honours a non-zero exact value — only when the option is on), `portal-contact.service.ts` (R4-08: omitted `taxEstimatesAccess` keeps the stored value, grants need the gate — the other seven portal booleans are untouched), report-pack service/routes/documents/templates/generate (gate, encryption, requester, section renderer), `permissions.ts`, `feature-flags.ts`, `modules.ts`, `reports/registry.ts`, `app.ts` mounts, `index.ts` seed sync, `schema/portal-contacts.ts` + `schema/report-packs.ts` columns, web `App.tsx` / `Sidebar.tsx` / portal dashboard + layout / `ClientPortalAdminPage` toggle / `ReportPackBuilderPage` section option / two hooks, `package.json` oracle script, knowledge files.

---

## 3. Kurt sign-off brief — the shortest list of what only Kurt can confirm

**A. Phase 1 federal parameters the engine reads for Rivera and typical 2026 cases while still `unverified`** (everything else Rivera reads is `verified`; checklist rows in PROGRESS.md):

| Key | Seeded | Read when | Note |
|---|---|---|---|
| `std_deduction.additional_age` | 65 | every return | §63(f) |
| `sch1a.senior.age` | 65 | every non-MFS return | §151(d)(5)(C) |
| `sch1a.phaseout_step` | 1,000, rounded **up** | every non-MFS return; bites only with tips / overtime / car interest above the threshold | the 2025 Schedule 1-A instructions round tips/overtime **down** and car interest up (Q36/Q37b) — decide the direction |
| `penalty.underpayment_rate` | 2027 Q1–Q4 = 7% placeholder | every penalty leg after 2026-12-31 (Rivera's Q3 leg Sep 15 → Jan 15) | replace each quarter as Rev. Rul. publishes |
| `itemized.benefit_cap_rate` | 0.35 | itemizers only (2026 §68 2/37) | |
| `capital_loss.limit.standard / .mfs` | 3,000 / 1,500 | net capital loss only | §1211(b) |
| `hsa.catch_up_age` 55; `retirement.catch_up_age` 50; `retirement.401k.catch_up_60_63_ages` [60,63]; `retirement.simple.match_pct` 0.03 | | HSA / solo 401(k) / SIMPLE owners | |
| `ccorp.installment_day` 15, `ccorp.large_corp_lookback_years` 3, `ccorp.min_tax_for_estimates` 500 | | C corp links | |
| `sch1a.*.phaseout_threshold.mfs` (3 keys) | | never (MFS disallowed) | unused by design |

Plus the seven researcher flags at PROGRESS.md:95-102 (SALT 40,400 / 505,000 vs the 1040-ES print; MFS SALT halving; Q2 2026 6%; QBI MFS 201,775; EBL 256,000 / 512,000; SEP 25% → 20% self-employed; Sch 1-A rounding).

**B. Phase 2 MO / AR.** Every MO row is verified (incl. $500 penalty floor, 8% / 7% rate legs, Feb 2 2026 Q4 relief). AR: `farmer.rule.current_pct` 0.9 is inferred from the general rule (no AR document states a farmer percentage) — accept or research; `threshold_comparison = more_than` ($1,000 exactly → no penalty). Rate inputs are yours: the fixture's AR 3.9% is a 2025 rate (Act 1 of 2026: 3.7% from TY2026), MO 4% is an effective rate on AGI. MO 2027 penalty rate is set by Oct 22, 2026: until seeded, 2027 days fall back to 7% with a verify flag.

**C. Decisions only a CPA should make (engine takes the stated default today):**
1. §199A W-2 wages **exclude** the >2% shareholder health add-on (`sehiAsW2Wages` not added to `w2WagesEffective`). Box-1-based definitions include it; confirm.
2. Schedule AI: QBI figured on annualized amounts (Q13a); credits and standard deduction full-year (Q13b) — confirmed by the oracle rewrite, your sign-off still open.
3. NIIT: no §1411 trade-or-business carve-out for gains (Q33); §469(i) MAGI = AGI without passive losses; §461(l) aggregate definition (Q33).
4. SEHI cap pooled across all SE businesses + S corp officer wages (Q30); owner items run-rated as recurring.
5. Nonresident state tax = sourced income × your effective rate, labelled (Q17); derived sourcing = ordinary + rental + §1231 after §469.
6. Payment-year attribution window (Q4 cutoff rule, MODULE.md "Payment year attribution") — a payment between Jan 31 and Apr 15 goes to the **next** year unless pinned.
7. `firm_readonly` may issue PDFs (each freezes a `pdf` snapshot) and compute estimates; tenant-side staff may revoke but not grant portal access.
8. Defaults: firm safe harbor `lesser_of`, portal `live`, treatment suggestions never auto-applied, unmapped accounts ordinary + warning.
9. R7-01: ship v1 with person-level inputs API-only (and tell staff how), or hold enablement until the "People" card exists.
10. How a row becomes verified: there is no in-app "Verify"; your ticked checklist → seed status edit in code → next release re-syncs. Confirm that workflow is acceptable for the Jan 15 window.

**D. Before turning the flag on:** run QA-CHECKLIST §0–§11 on the test firm (never done), confirm the three missing oracles can wait (C corp recapture, §469(i)+EBL, farmer prior year), and renumber 0201 only if main gains a migration before merge (today it does not).
