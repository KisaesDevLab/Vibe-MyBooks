# R1 — Books → tax-basis income (incl. cross-tenant scoping)

Reviewer: `fable-process-reviewer` (Fable 5.1) · Date: 2026-10-12 · Branch: `feat/tax-estimator` · Read-only review; no code changed.

Scope reviewed: MODULE.md D1/D3/D8, "Tax-treatment map", "Books readiness", "Projection", federal order steps 1–2; PHASES.md Phase 4; `rivera_fixture.py` + UI-SPEC "Rivera fixture"; `services/tax-estimator/{firm-scope,entity-type,entity-settings,treatments,pl-provider,readiness,taxpayers}.service.ts`, `year-access.ts`, `middleware/tax-estimator-scope.ts`, `routes/tax-estimator.routes.ts`, `routes/tax-estimator/{entities,taxpayers,years}.routes.ts`, schema `tax-estimator-{entities,taxpayers,years}.ts`, shared `entities-api.ts`/`taxpayers-api.ts`/`allocation.ts`, and the books code they call (`report.service.ts: buildProfitAndLoss / cashBasisLinesWith / buildAccountDetailReport`, `tb/balance-engine.service.ts: computeWorkpaper`, `tb/assignments.service.ts: listAvailableCodes`). Seed descriptions were checked against the live `tax_codes` table in `kisbooks_test` (read-only).

## Verdict: **FAIL** (1 Critical, 7 Major, 8 Minor) — tenant isolation itself **passes** with no findings

Isolation (severity-1 sweep) found nothing: every entity route re-checks the path tenant against the server-resolved scope before any query, every taxpayer/scenario/adjustment load is `firm_id = scope.firmId`, cross-tenant reads use `tenantInScopeSql`, the cache key carries tenant+company and is only consulted after the scope check, API keys/download tokens are rejected (`requireSessionAuth`), `client` user_type gets 404, `firm_readonly` is blocked from mutations at the router, prior-year secrets are stripped from the audit shape. Details in §4.

The failure is on severity 2 (wrong tax numbers from the books). The Rivera **Sch C** fixture passes exactly, but the provider is **entity-type-blind** and the TB seed does not contain the codes the character regex was tested against, so partnerships and S corps — the bulk of a CPA firm's book — produce materially wrong tax-basis income, and the payment ledger is misread for accrual entities. Fix F1–F3 before Phase 6 consumes the DTO; F4–F8 can land in the same Phase 4 follow-up.

| # | Sev | Finding | Where |
|---|---|---|---|
| F1 | **Critical** | Partnership guaranteed payments vanish: deducted from entity profit, never routed to the partner | `pl-provider.service.ts:164-188, 431-438`; TB codes 1065 `201/267/268`, farm `684`, rental `584` |
| F2 | Major | `owner_sehi` / `owner_retirement` applied identically to Sch C, partnership and S corp (D10 says S corp >2% health = officer W-2 + SEHI) | `pl-provider.service.ts:164-177, 179-188, 430-436` |
| F3 | Major | TB code `Sch 1; L17 - Self-employed health insurance` (887/689) is ignored unless the estimator treatment is also set — silent, no warning | `pl-provider.service.ts:419-425, 574`; `treatments.service.ts:284-305` |
| F4 | Major | Estimated-tax payment ledger is read on the entity's **tax method**; on accrual an unpaid IRS bill counts as paid, dated the bill date | `pl-provider.service.ts:506-509` → `report.service.ts:1407-1420` |
| F5 | Major | Default `through` = current (partial) month, counted as a whole elapsed month; MODULE says last closed month | `pl-provider.service.ts:99-109, 651`; `readiness.service.ts:70, 181` |
| F6 | Major | Capital-gain / §1231 / qualified-dividend characters are unreachable from the real seed; regex tests use descriptions that do not exist | `pl-provider.service.ts:128-141`; `pl-provider.service.test.ts:244-257` |
| F7 | Major | `w2Wages.effective` is YTD-through-month but named/used as the D8 "year's total" | `pl-provider.service.ts:664-670`; `entities-api.ts:243-249` |
| F8 | Major | Sch F entity with no TB farm codes → `farmingGrossIncome` = 0/0 → farmer test silently fails | `pl-provider.service.ts:439-441, 541-551` |
| F9 | Minor | Treatments are not validated against account type (`owner_sehi` on a revenue account → negative SEHI; `nondeductible_pct` on income → income cut) | `schemas/tax-estimator-entities.ts:53-73`; `treatments.service.ts:102-111` |
| F10 | Minor | Owner-level amounts have no person target; officer wages per officer not surfaced | `tax-estimator-entities.ts:50-67`; `entities-api.ts:231-235` |
| F11 | Minor | A never-reconciled account opened mid-year nulls `lastClosedMonth` for the whole company | `readiness.service.ts:126-131` |
| F12 | Minor | Suspense look-alike scan is tenant-wide, not company-scoped | `readiness.service.ts:158-161` |
| F13 | Minor | Cache config hash misses `firm_tax_codes` description edits (which change character) | `pl-provider.service.ts:204-229` |
| F14 | Minor | RJE/workpaper tax-year label uses the fiscal year for pass-throughs on a calendar window | `pl-provider.service.ts:473-475` |
| F15 | Minor | Float hop: `PLEntry.amount` / detail `debit`,`credit` are JS numbers rounded to 4 dp per month before `Decimal` | `report.service.ts:33-38`; `pl-provider.service.ts:277, 386, 514` |
| F16 | Minor | Treatment audits lack `firmId`; taxpayer audits have it | `treatments.service.ts:127,149,213,221` vs `taxpayers.service.ts:95-102` |

---

## 1. Critical

### F1 — Guaranteed payments are deducted from the partnership and never reach the partner
**Where:** `packages/api/src/services/tax-estimator/pl-provider.service.ts:164-188` (`entityShare`/`routeOf` have no GP route), `:431-438` (owner switch), shared `TaxBasisPl` (`packages/shared/src/tax-estimator/entities-api.ts:209-260`) has no GP field. The TB seed already codes them: `1065|business|201 "1065; L10 - Guaranteed payments"`, `267 "Guar pymts - health insurance"`, `268 "Guar pymts - pensions and IRAs"`, `farm|684`, `rental|584` (verified in `kisbooks_test.tax_codes`).

**Scenario:** 1065, partners A 50% / B 50%, books: revenue 300,000, expenses 100,000, account "Guaranteed payments – A" 60,000 assigned TB code 201. Provider: `byCharacter.ordinary = 140,000`, nothing else. Engine (MODULE step 2, "income by profit_pct … guaranteed payments go to the specific partner") has no GP amount → A gets 70,000, B 70,000. Correct: A 70,000 + 60,000 GP (SE income), B 70,000. **60,000 of ordinary SE income disappears from A's estimate** (≈ 60,000 × 15.3% ≈ 9,180 SE tax + ≈ 13,200 income tax at 22%, before QBI effects). Code 267 (health insurance treated as GP) has the same hole — see F2.

**Fix (books-integration-engineer, opus; schema-builder for the column):** add treatment `guaranteed_payment` with `payment_person_id`-style target (reuse the column, rename to `target_person_id`, or add `owner_person_id`) and route `'guaranteed_payment'`; keep the expense in entity profit (it IS deductible by the partnership) and emit `guaranteedPayments: Array<{ personId, accountId, amount, character: 'ordinary' | 'health' | 'retirement' }>` on `TaxBasisPl` + per-month. Auto-suggest it when the account's TB code ∈ {201, 267, 268, 684, 780, 584, 588, 589, 635, 636, 778, 779}. Log the D3 omission in OPEN-QUESTIONS.md (the owner's treatment list has no GP item). Add a test: 50/50 partnership with a 60,000 GP account.

## 2. Major

### F2 — Owner treatments are entity-type-blind (S corp and partnership)
**Where:** `pl-provider.service.ts:164-177` (`entityShare` returns ZERO for `owner_sehi`/`owner_retirement` regardless of `resolved.entityType`), `:430-436`.

**Scenario (S corp, D10 rule):** 1120S, Maria 50% officer; books: "Officer health insurance" 12,000 mapped `owner_sehi`. Provider removes 12,000 from S corp profit → K-1 ordinary up by 6,000 to Maria (and 6,000 to the other shareholder, who may be a different taxpayer), `ownerSehi = 12,000` with no person. Correct (D10 "S corp >2% health as officer W-2 + SEHI"): premium stays deductible by the S corp, is added to Maria's Box 1 wages (also raising the §199A W-2 wage total), and she takes 12,000 SEHI. Effects: other shareholder over-taxed by 6,000 × rate; Maria's QBI base overstated (K-1 instead of wages) by 6,000 → QBI deduction overstated ≈ 1,200; W-2 wage limit understated by 12,000. `owner_retirement` on an S corp (employer SEP for the shareholder-employee is the corporation's deduction, not the owner's) is wrong the same way.

**Scenario (partnership):** partner-A health insurance 10,000 mapped `owner_sehi` → +5,000 ordinary to each partner instead of 10,000 GP to A; same hole as F1.

**Fix (books-integration-engineer, opus):** branch `entityShare`/`routeOf` on `resolved.entityType`: `sch_c`/`sch_f` → current behaviour; `s_corp` → route `'entity'` (deduction kept) + add to `w2Wages.booksYtd` + emit `ownerSehi` with a person target (F10); `partnership` → treat as GP of character health/retirement (F1); `c_corp` → route `'entity'` only (no owner level). Trace each branch. Tests: the Ozark Hearth Bakery fixture with an officer health account.

### F3 — TB SEHI codes are silently ignored
**Where:** `pl-provider.service.ts:419-425` (character only), `:574` (an account with a code is never "unmapped"); `treatments.service.ts:284-305` (`suggestTreatments` matches names only, never `account_tax_assignments`). Seed codes: `1040|business|887 "Sch 1; L17 - Self-employed health insurance"`, `1040|farm|689`, `888/690 "Long-term care premiums"`.

**Scenario (Rivera):** bookkeeper assigns 6200 Owner Health Insurance to TB code 887 (its natural TB code); preparer does not add the estimator treatment. Provider: Sch C profit 117,200 (not 128,000), `ownerSehi = 0`, **no warning** (the account has a code). SE tax understated ≈ 10,800 × 0.9235 × 15.3% ≈ 1,526; SEHI deduction lost; QBI/½SE wrong. MODULE D3: "character comes from TB … the estimator adds only what TB lacks" — TB does not lack SEHI.

**Fix (books-integration-engineer):** in `loadCharacterMap`/step 4, derive route `owner_sehi` when the code is 887/689 (and `owner_retirement`-equivalents when TB has them: none today for Sch C; GP codes per F1); emit `TE_TB_CODE_IMPLIES_TREATMENT` when a code implies a route the treatment row contradicts; make `suggestTreatments` read assignments (code 887 → `owner_sehi`, 201/267/268 → `guaranteed_payment`). Test: account coded 887 with no treatment → tax-basis 128,000.

### F4 — Payment ledger read on the entity's tax method
**Where:** `pl-provider.service.ts:506-509` passes `basis` (= `resolved.taxMethod`) to `buildAccountDetailReport`; the accrual branch at `report.service.ts:1407-1420` selects raw journal lines by `t.txn_date` with `t.status='posted' AND t.basis <> 'cash'`, which includes `bill` transactions.

**Scenario:** accrual-basis Sch C (or `tax_method` override `accrual`); preparer enters the Q3 voucher as a **bill** to "IRS" dated 2026-09-01 (Dr 3030 Estimated Tax Payments / Cr AP), paid 2026-10-20 (or never). Provider lists `{date: '2026-09-01', amount: 6,000}` as paid. Voucher table shows Q3 paid on time; §6654 accrual from 9/15 → 10/20 omitted; if the bill is never paid the estimate still shows it paid. On cash basis the same books are correct (rule 3 re-dates the line to the payment and uses `pay.id`, `report.service.ts:191, 210`).

**Fix (books-integration-engineer):** payments are cash events — always call the step-6 detail report with `basis: 'cash'` regardless of `resolved.taxMethod`; document in the DTO comment. Test: accrual company, unpaid bill to the payment account → no payment row; paid bill → payment at the payment date.

### F5 — Default range end is the current partial month
**Where:** `pl-provider.service.ts:99-109` (`resolveThroughMonth` → today's month), `:651` (`monthsElapsed = months.length` counts it as whole); `readiness.service.ts:70, 181` (readiness itself calls the provider with that default, after it has computed `lastClosedMonth`). Both route query schemas make `through` optional (`schemas/tax-estimator-entities.ts:94-102`).

**Scenario:** Rivera on 2026-10-11 with no `through`: YTD includes 11 days of October, `monthsElapsed = 10`. Run-rate = recurring ÷ 10 × 2 → October's missing ~⅔ month deflates the annual projection by ≈ 1/15 ≈ 8,500 of profit ≈ 2,500 of tax; MODULE "Projection"/"Books readiness": range end defaults to the **last closed month**.

**Fix (books-integration-engineer):** default `throughMonth` to the previous whole month (never the current one) at the provider, and let readiness pass its computed `lastClosedMonth` to `getTaxBasisPl`; the engine (Phase 6) must receive `through` explicitly from readiness. Add `TE_RANGE_PARTIAL_MONTH` when `throughMonth` equals the current month. Test with a fixed `today`.

### F6 — Capital-gain / §1231 / qualified-dividend characters cannot occur from the real seed
**Where:** `pl-provider.service.ts:128-141`; test `pl-provider.service.test.ts:244-257` uses `'Sch D; L7 - Short-term capital gain'`, `'4797; Section 1231 gain'`, `'Sch K; L06b - Qualified dividends'` — **none exist** in the 2025 seed. Live `tax_codes` (`kisbooks_test`, one seed version) matching `gain|1231|4797`: only `Sch D; L14 - Capital gain distributions` (1065/1120/1120S, incl. a 28% row), `Sch K; L13a/13b - Capital gain property` (charitable), and `Sch M-1; var - 4797 gain/loss - book` (`is_m1_adjustment = true`). There are no Sch K L8/L9a/L10 codes, no qualified-dividend code, no 1040 `common` family (so a Sch C has no interest/dividend/Sch D code at all).

**Scenario:** Sch C owner books 2,400 of business bank interest to "Interest income" → the only assignable codes are Sch C lines → ordinary **SE** income (should be Sch B, no SE). Partnership sells equipment, "Gain on sale" 40,000 assigned to the only fitting code, M-1 `4797 gain/loss - book` → `section_1231` on the **book** gain (the M-1 code's meaning is "back this book figure out"), while the tax gain/recapture must come from an adjustment anyway; `Capital gain distribution 28%` → `capital_gain_lt` at 15/20%.

**Fix (orchestrator → OPEN-QUESTIONS; books-integration-engineer):** decide the mechanism: (a) a new seed version adding Sch K L8/L9a/L10, Sch D/4797 codes for 1040 and 1120S/1065 portfolio lines, or (b) since D3 forbids a second classification, let estimator **adjustments** recharacterize an account's amount (type flags `is_capital_gain_lt/st`, `is_1231` already exist in Phase 5). Until then: treat `is_m1_adjustment` codes as **ordinary + `TE_M1_CODE_ON_PL_ACCOUNT` warning**, not as character; add a test that iterates the real seed descriptions through `characterForCode` and asserts which codes yield each character (so the regexes are tied to the seed, not to fiction).

### F7 — `w2Wages.effective` is YTD, documented as the year's total
**Where:** `pl-provider.service.ts:664-670`; `entities-api.ts:243-249`. D8: "the year's total is the default; a per-entity-per-year override field wins". `booksYtd` is a sum through `throughMonth`; `effective = override ?? booksYtd`; there is no recurring/non-recurring split for wages and no projected value.

**Scenario:** Ozark Hearth Bakery through September: `effective = 40,500` (9 × 4,500) vs the year's 54,000. If Phase 6 uses `effective` as the §199A W-2 limb, 50% × 40,500 = 20,250 vs 27,000 — a wage-limited taxpayer loses 6,750 of QBI deduction.

**Fix (books-integration-engineer; tax-engine-architect to consume):** rename to `w2Wages.booksYtd` + `w2Wages.projectedYear` (run-rate on the recurring wage accounts, non-recurring once) and `effective = override ?? projectedYear`; add `recurring/nonRecurring` wage totals per month (the per-account `nonRec` is already computed).

### F8 — Sch F without TB farm codes reports zero farming gross income
**Where:** `pl-provider.service.ts:439-441` (counts only accounts with a `farm`/`farm_rental` code), `:544` (prior year computed only when such codes exist). `entity-type.service.ts:166-169` lets `tax_entity_type = 'sch_f'` exist with no TB profile/codes.

**Scenario:** farm client, no TB profile, estimator type `sch_f`, revenue 400,000 all unassigned → `farmingGrossIncome = {0, 0}` → farmer test (≥ 2/3 gross from farming) fails → four installments at 90% instead of one Jan-15 installment at 66⅔%; no warning says why. `farmer_override` exists but the default is silently wrong.

**Fix (books-integration-engineer):** when `entityType === 'sch_f'` and no farm codes exist, count all `revenue`/`other_revenue` accounts as farming gross income and emit `TE_FARM_INCOME_ASSUMED`; when codes exist but some income accounts are unassigned, warn that they are excluded from the farming test.

## 3. Minor

- **F9 — No account-type validation of treatments** (`schemas/tax-estimator-entities.ts:53-73`, `treatments.service.ts:102-111`). `owner_sehi` on a revenue account x = +1,000 → `removed = −1,000` → `ownerSehi` negative; `nondeductible_pct 50` on revenue halves income (`entityShare`, `:172-173`); `w2_wages` on an asset account is accepted (never read). Fix (api-builder, sonnet): in `putTreatments` require cost types for `nondeductible_pct`/`owner_*`/`w2_wages`/`tax_depreciation_differs`; allow any type only for `estimated_tax_payment`; return `TE_TREATMENT_ACCOUNT_TYPE`.
- **F10 — Owner-level amounts have no person target** (`tax-estimator-entities.ts:50-67`: `payment_person_id` is payments-only). Two spouses each linked to one partnership/S corp → `ownerSehi` cannot be attributed; MODULE step 2 "officer wages go to the officer" has no books source per officer (only the entity-wide `w2Wages`). Fix (schema-builder + books-integration-engineer): generalize `payment_person_id` → `target_person_id` for `owner_sehi`/`owner_retirement`/`guaranteed_payment`/`officer_wages`; expose per-person arrays on the DTO.
- **F11 — Mid-year account nulls the closed month** (`readiness.service.ts:126-131`). Checking reconciled through Sep; new credit card opened Sep 20 with activity, never reconciled → `lastClosedMonth = null` although Jan–Aug are closed. Fix: compute each account's first-activity month and treat it as closed through the month before that; only then apply "earliest across accounts".
- **F12 — `previewSuspenseConsolidation(tenantId)`** (`readiness.service.ts:160`) lists look-alike accounts of every company in the tenant (same scope, so not a leak), inflating `TE_SUSPENSE_BALANCE` for multi-company tenants. Fix: filter candidates by `company_id IN (companyId, NULL)`.
- **F13 — Cache hash omits `firm_tax_codes`** (`pl-provider.service.ts:204-229`): editing a firm code's description from "Other income" to "Capital gain distributions" flips `characterForCode` but not the key. Fix: add `(SELECT count || max(updated_at) FROM firm_tax_codes WHERE firm_id = owner firm OR tenant_id = tenant)`.
- **F14 — RJE tax-year label** (`pl-provider.service.ts:473-475`): a pass-through with `fiscal_year_start_month = 7` uses a calendar window but `taxYearOf(throughDate, 7)` labels Sep 2026 as TB year 2027, so RJEs shown per account come from a different TB year than the window. Fix: for non-C-corps pass `taxYear` (calendar) directly.
- **F15 — Float hop** (`report.service.ts:33-38` `num`/`sub` → `Number(…toFixed(4))`; consumed at `pl-provider.service.ts:277, 386, 514`): amounts are rounded to 4 dp per account per month then re-wrapped in `Decimal`. Error ≤ 0.00005 × 12 per account per year — immaterial today, but it violates the "never floats" rule and silently depends on `toFixed(4)` in the report builder. Fix (books-integration-engineer, later): add a `raw: true` option to the builders returning numeric strings, or sum SQL `numeric` directly for the estimator.
- **F16 — Treatment audit rows carry no `firmId`** (`treatments.service.ts:127, 149, 213, 221`) while taxpayer/link audits tag it (`taxpayers.service.ts:100`). A client-tenant admin sees `tax_est_treatment` edits by an unknown firm user. Fix (api-builder): tag `firmId` as the taxpayer audits do.

## 4. Isolation sweep — what was checked and passed

- Guard chain `tax-estimator.routes.ts:26-37`: `authenticate → requireSessionAuth → client 404 → flag (active tenant, D5) → requireResource('tax_estimator') (GET=read, else update) → resolveTaxEstimatorScope`. `requireSessionAuth` (`middleware/auth.ts:215-220`) rejects API keys and download tokens. Super admin without `X-Firm-Id` → 400; unknown/non-member firm → 404 (`firm-scope.service.ts:38-61`); memberships require `firm_users.is_active` and `firms.is_active` (`firms.service.ts:90-103`, `firm-users.service.ts:160-178`).
- `allowedTenantIds` = active `tenant_firm_assignments` ∩ active `user_tenant_access` (`firm-scope.service.ts:63-86`); recomputed per request, so a tenant that leaves the firm drops out on the next call; `tenantInScopeSql` strips non-hex before interpolation (`:101-105`).
- Every entities route parses path ids with Zod and calls `assertEntityInScope` **before** any books query; the company is loaded strictly by `(tenant_id, id)` (`entity-type.service.ts:38-59`); treatments/flags verify accounts by `(tenant, company|NULL)` and transactions by `(tenant, company)` before writing (`treatments.service.ts:108-110, 199-201`); payment targets must belong to the firm (`:76-100`).
- Books builders are pinned: `buildProfitAndLoss` accounts `a.tenant_id`, lines `t.tenant_id AND t.company_id`; `cashBasisLinesWith` pins tenant on every join; `computeWorkpaper` pins `(tenant, company)`; `loadConfigVersion` pins tenant/company on every subquery.
- Cache key `te:pl:v1:<tenant>:<company>:<year>:<basis>:<through>:<stamp>:<config>` cannot collide across tenants/companies/years/basis and is consulted only after the scope check (`pl-provider.service.ts:296-317`).
- Taxpayer surfaces: all loads `firm_id = scope.firmId` (`taxpayers.service.ts:105-111`, `year-access.ts:33-57`); links check `isTenantInScope(input.tenantId)` first and `resolveEntityKind` by strict pair (`:388-399`); out-of-scope links return opaque ids only, excluded from `companyMeta`/options; contacts in out-of-scope tenants return blank email/name; `unlinkContact` revokes only in scope and only companies no other taxpayer grants.
- Audit: years strip `*_encrypted` and log `priorYearChanged: {changed: true}` (`years.service.ts:53, 147-148`); no prior-year value reaches `audit_log`. Readiness/provider payloads expose only in-scope account names/amounts.
- Residual notes (not findings): `GET …/readiness` and `…/tax-basis-pl` run 12 P&L builds + a full-range detail report per call with no rate limit beyond the global one (DoS surface, not exposure); `TE_COMPANY_NOT_FOUND` vs `TE_TENANT_NOT_MANAGED` only tells the caller what they already know (their own scope).

## 5. Checks that passed on the numbers

Cash vs accrual selection (`companies.accounting_method` → estimator override, `entity-type.service.ts:182-186`); month attribution on cash basis via the virtual ledger's payment date (`report.service.ts:186-220`); 12 monthly P&Ls sum to the annual (date-bounded by payment date, rule-3 lines carry `pay.id`, so flagging the **payment** works as documented); void/reversed excluded (`status='posted'`, `is_void_reversal=false`); AJEs included on both sides and the TB identity check compares like with like (`pl-provider.service.ts:470-490`); tax RJEs shown per account, never applied — consistent in provider, DTO comment and warning (`TE_TB_RJE_NOT_APPLIED`); multi-company `company_id` strictness matches TB; tag filtering unused (TB7 n/a); Dec-31/Jan-1 edges via `monthEnd` (UTC) and `date` comparisons; nondeductible add-back = `x × pct/100` with correct sign on expenses; `estimated_tax_payment` removed from profit **and** listed once (no double count); SEHI removed once; non-recurring split never changes the total; Rivera 115,400 → 128,000 reproduces (`pl-provider.service.test.ts:117-151`).

## 6. Tests the suite is missing (test-writer, sonnet, after fixes)

1. Partnership with a guaranteed-payment account coded 201 (F1). 2. S corp officer health account mapped `owner_sehi` (F2). 3. Account coded 887 with **no** estimator treatment (F3). 4. Accrual entity: unpaid bill to a payment-mapped account (F4). 5. `getTaxBasisPl` with no `through` and a fixed `today` mid-month (F5). 6. `characterForCode` over the **real** seed rows (F6). 7. `w2Wages` through September vs December (F7). 8. `sch_f` via estimator setting with unassigned revenue (F8). 9. `owner_sehi` on a revenue account rejected (F9). 10. Readiness with an account whose first activity is after the other accounts' closed month (F11).

## Fix status

Fixed by `books-integration-engineer` on 2026-10-12 (not committed). Regression tests live in `packages/api/src/services/tax-estimator/pl-provider.r1.test.ts` (one `describe` per finding); all 25 finding tests were run against the pre-fix code (HEAD) and failed, and pass after the fix. Migration `0201_tax_estimator.sql` (+ `parts/entities.sql`) was edited in place (treatment CHECK + person-target CHECK); the rollback needed no change (it drops the table). Verified on a fresh `kisbooks_migcheck`: migrate from zero → rollback → re-apply → re-apply (idempotent).

| # | Status | Test(s) |
|---|---|---|
| F1 | Fixed — `guaranteed_payment` treatment (partner required: Zod + 422 `TE_PERSON_REQUIRED`; partnership only: 422 `TE_TREATMENT_NOT_FOR_ENTITY`); kept as the partnership deduction and emitted in `guaranteedPayments[]` (personId, amount, accounts, trace) + `months[].guaranteedPayments`; TB GP codes 201/267/268, 684/635/636, 780/778/779, 584/588/589 are suggested (`basis: 'tb_code'`, never applied) and warned (`TE_GP_CODE_WITHOUT_TREATMENT`) | `F1 ›` all 4; `entities.routes.test.ts › happy path` (400 / 422) |
| F2 | Fixed — routing by entity type: Sch C / Sch F / partnership removed to owner level (as before); S corp `owner_sehi` → route `officer_sehi` (kept in S corp profit; `sehiAsW2Wages` + `ownerSehi` on the officer), S corp `owner_retirement` → `officer_retirement` (kept; `employerRetirement`, no owner deduction); C corp kept + `TE_TREATMENT_NOT_FOR_ENTITY` | `F2 / F10 ›` all 3 |
| F3 | Fixed — TB 887/888 (Sch C) and 689/690 (Sch F) route to owner SEHI with no treatment (`treatmentSource: 'tb_code'`, trace "from TB code N"); the estimator treatment wins, never double-removed; conflicts → `TE_TB_CODE_IMPLIES_TREATMENT`. The 2025 seed has no owner-retirement code (Sch C 819 / Sch F 625 are employee plans), so none is derived | `F3 ›` both |
| F4 | Fixed — payment ledger always read with `basis: 'cash'` | `F4 › accrual entity …` |
| F5 | Fixed — default range end = last closed month (shared `closed-month.service.ts`, also used by readiness), else last complete month, never the current one; `throughMonthSource` / `throughMonthReason` / `monthsRemaining` on the DTO; `TE_RANGE_PARTIAL_MONTH` when a requested month is not over; 422 `TE_NO_COMPLETE_MONTH` when the year has no complete month | `F5 ›` all 4; `pl-provider.service.test.ts › windows` |
| F6 | Fixed — character by seed CODE identity (table in the provider header and PROGRESS.md); M-1 codes never become a character (`TE_M1_CODE_ON_PL_ACCOUNT`); new character treatments `capital_gain_lt/_st`, `section_1231`, `interest`, `dividends_ordinary/_qualified` (income accounts); FIRM codes alone use their description | `F6 ›` all 3 (iterates the real seed); `pl-provider.service.test.ts › character mapping` (rewritten) |
| F7 | Fixed — `w2Wages.{ytd, recurringYtd, nonRecurringYtd, projectedYear}`; `effective` = override ?? projected full year (`booksYtd` renamed `ytd`) | `F7 ›` |
| F8 | Fixed — Sch F (or `farmer_override = true`) without farm codes counts all income accounts, current and prior year, with `TE_FARM_INCOME_ASSUMED`; unassigned income with farm codes present → `TE_FARM_INCOME_UNASSIGNED` | `F8 ›` |
| F9 | Fixed — `TREATMENT_ACCOUNT_TYPES` (shared) enforced in `putTreatments` → 422 `TE_TREATMENT_ACCOUNT_TYPE`; the UI only offers allowed treatments | `F9 ›`; `entities.routes.test.ts`; web `entities.components.test.tsx` |
| F10 | Fixed — person target (stored in `payment_person_id` / `payment_taxpayer_id`) allowed on GP, owner SEHI / retirement and W-2 wages; required for GP and S corp owner items; `ownerLevel.byPerson[]`, `w2Wages.byPerson[]` (officer wages per officer) | `F2 / F10 ›` |
| F11 | Fixed — a never-reconciled account with no pre-year activity is closed through the month before its first activity (`closedThroughSource`, `firstActivityMonth` on the DTO) | `F11 / F12 ›`; `entity-setup.services.test.ts` (expectation updated: Jan, not null) |
| F12 | Fixed — look-alike candidates filtered to `company_id IN (company, NULL)` | `F11 / F12 ›` |
| F13 | Fixed — config hash includes the FIRM codes the company's assignments use; cache key version bumped to `v2` | `F13 ›` |
| F14 | Fixed — `computeWorkpaper` gets the estimator `taxYear` | `F14 ›` |
| F15 | Fixed — additive `exactAmounts` option on `buildProfitAndLoss` (`PLEntry.amountExact`) and `buildAccountDetailReport` (`debitExact` / `creditExact`); the provider sums exact decimal strings | `F15 ›` |
| F16 | Fixed — treatment and flag audit rows tagged with `firmId` | `F16 ›` |

Not done / follow-ups: the person target is checked to belong to the caller's firm, not to have a link to this entity (the engine should warn when a GP / officer person has no link); `sehiAsW2Wages` is NOT added to the §199A W-2 wage total (Phase 6 decision); 1120S code 105 (28% capital gain distribution) is carried as `capital_gain_lt` without the 28% rate; character treatments are limited to income / other-income accounts as decided, so a §1231 or capital LOSS booked to an `other_expense` account still needs an adjustment.
