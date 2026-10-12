# MODULE.md — MyBooks Tax Estimator (plan v2.2, adapted to this repo)

> This is the kit's former `CLAUDE.md`. It is named MODULE.md because the repo
> git-ignores every `CLAUDE.md`, `STATE.md` and `QUESTIONS.md` by design; the
> other renamed files are `PROGRESS.md` (was STATE.md) and `OPEN-QUESTIONS.md`
> (was QUESTIONS.md). The repo's own `CLAUDE.md` rules (#9–#25 and TB1–TB14)
> apply to every file this module adds. Where this document and the repo
> rules disagree, the repo rules win and the conflict goes into
> OPEN-QUESTIONS.md.

You are building the **Tax Estimator** module inside Vibe MyBooks (self-hosted bookkeeping appliance, Kisaes LLC, repo `Vibe-MyBooks`). Work through `PHASES.md` in order. Record progress in `PROGRESS.md` after every phase. Put any blocking uncertainty in `OPEN-QUESTIONS.md`, take the documented default, and keep going. Stop only when a decision cannot be undone and the default is unclear, or when a gate in PHASES.md says "Kurt signs off".

v2.2 (2026-10-11) folds in the repo-adaptation review and the owner's decisions D1–D16 below. v2 folded in a CPA review of v1 (bracket tax, resident/nonresident states, Schedule AI and §6654 penalties, GL tax-treatment map, loss limits, Schedule 1-A, retirement/HSA/SEHI limits, C corp and farmer rules, assumptions page).

## Agents and models
Work is split across Claude Code subagents on different models according to **`ORCHESTRATION.md`**, which is binding (tiers, routing, escalation, Fable budget guard, ownership scopes, independence rule, per-phase routing, hand-off discipline). The orchestrating session runs on `opusplan`. Only `tax-engine-architect`, `oracle-verifier` and `fable-process-reviewer` use Fable.

## Stack (existing — do not change)
React 18 + TypeScript + Vite + Tailwind + TanStack Query v5 · Node 24 (`node:24-alpine` images) · Express 4 · Drizzle ORM 0.45 · PostgreSQL 16 · Redis 7 · BullMQ · Zod 3 · Vitest 3 · `decimal.js` (api package). npm workspaces: `packages/shared` (`@kis-books/shared`), `packages/api`, `packages/web`, `packages/worker`.

## Where things live (D2)
This folder (`features/tax-estimator/`) holds **planning and reference only**: MODULE.md, PHASES.md, ORCHESTRATION.md, OPEN-QUESTIONS.md, PROGRESS.md, BUILD-PLAN.md (original v2.1 text, superseded where this file differs), `claude-config/` (agent definitions + installer), `docs/reference-calc/` (oracles), `docs/ui-mockups/`, `docs/agent-handoffs/`, `docs/reviews/`.

**App code goes into the workspaces**, following the Trial Balance module layout, so tsc, vitest, the license-header check and the `any` baseline cover it:

| Layer | Path |
|---|---|
| Pure engine (no IO) | `packages/shared/src/tax-estimator/engine/**` — in **shared**, like `financial-statements/` (rule TB14), so the browser and the server compute identical numbers |
| Parameter registry + types + Zod | `packages/shared/src/tax-estimator/{parameterKeys.ts,types.ts}`, `packages/shared/src/schemas/tax-estimator.ts` |
| Drizzle schema | `packages/api/src/db/schema/tax-estimator.ts` (re-exported from `schema/index.ts`) |
| Migration | `packages/api/src/db/migrations/NNNN_tax_estimator.sql` + `NNNN_tax_estimator.rollback.sql` + `meta/_journal.json` entry (see D6) |
| Seeds | `packages/api/src/db/seeds/tax-estimator/{federal,state-rules}/**` |
| Services | `packages/api/src/services/tax-estimator/**` |
| Routes | `packages/api/src/routes/tax-estimator.routes.ts` (staff), `routes/portal-tax-estimates-public.routes.ts` (portal), admin parameter routes inside `tax-estimator-admin.routes.ts` |
| Web | `packages/web/src/features/tax-estimator/**`, hooks in `packages/web/src/api/hooks/useTaxEstimator*.ts` |
| Tests | next to the source as `*.test.ts(x)` (repo convention; not `__tests__/`) |
| Module docs | `docs/tax-estimator/MODULE.md` (surfaces, operating notes — written in Phase 14) |

## Owner decisions (2026-10-11, Kurt) — binding, change only via OPEN-QUESTIONS.md

- **D1 — Taxpayers are firm-scoped and may span tenants.** A Taxpayer belongs to a firm (`firm_id`), never to a tenant. A taxpayer-entity link points at a `companies` row in any tenant the firm manages (active `tenant_firm_assignments`). The server resolves the allowed tenant set as **the firm's active `tenant_firm_assignments` ∩ the caller's active `user_tenant_access`** (the Clients-screen contract: nothing the caller couldn't already reach by switching into the client; super admins, who have no access rows by design, get the firm's full managed set) in `services/tax-estimator/firm-scope.service.ts`; the router is **session-auth only** (`requireSessionAuth`, API keys are single-tenant) and the firm is chosen by the caller's single membership or an `X-Firm-Id` header that must name a firm they belong to (else 404). **Every** query touching books data is `WHERE tenant_id = ANY(:allowedTenantIds)` with the array computed server-side (rule #17 extended, never a client-supplied list). Access is firm staff only via `requireFirmStaff` (`packages/api/src/middleware/firm-access.ts`); `user_type = 'client'` gets 404 on the whole router (TB13 pattern). Mandatory tests: linking a company in an unmanaged tenant → 404; estimate output for firm A never contains firm B data; a tenant removed from the firm drops out of the next computation with a readiness warning. The Clients screen (`auth.routes.ts`, "bank-feed backlog per client") is the only existing cross-tenant read; copy its guard discipline, not its query shape.
- **D2 — Layout** as in the table above.
- **D3 — Extend Trial Balance, don't duplicate it.** Entity tax type derives from `company_tax_profiles.return_form` (1040 → `sch_c` or `sch_f` by the TB `default_activity_type`/farm codes, 1065 → `partnership`, 1120S → `s_corp`, 1120 → `c_corp`); a company with no TB profile gets an estimator-only `tax_entity_type` field, and the profile wins once it exists. Tax method = `companies.accounting_method` with an estimator override. Income **character** uses the TB `account_tax_assignments` (tax codes already say ordinary / rental / capital gain / interest / dividends / §1231 / farm) where assigned. The estimator adds **only** what TB lacks, in a side table `tax_est_account_treatments` (tenant_id, company_id, account_id): `nondeductible_pct`, `owner_sehi`, `owner_retirement`, `owner_personal`, `estimated_tax_payment` (+ taxpayer/person/jurisdiction), `tax_depreciation_differs`, `w2_wages`, `non_recurring`; R1 (owner, 2026-10-12): + `guaranteed_payment` (partner) and the character treatments `capital_gain_lt`/`_st`, `section_1231`, `interest`, `dividends_ordinary`/`_qualified` for income accounts the TB seed has no code for (see Tax-treatment map). Never a second ordinary/capital/rental classification where TB has a code.
- **D4 — Parameters are platform-wide.** Federal `tax_parameters` and `state_estimate_rules` are edited by **super admin only** (no firm-level overrides; the kit's `*_overrides` tables become super-admin override rows with reason + audit). Each **firm** sets its own safe-harbor default rule (default **`lesser_of`**), disclaimer text and `portal_shows` (default **`live`**).
- **D5 — Flag `TAX_ESTIMATOR_V1`, default OFF.** Add to `PRACTICE_FEATURE_FLAGS` (`packages/shared/src/constants/feature-flags.ts`), to `FLAGS_DEFAULT_OFF_FOR_NEW_TENANTS` (`feature-flags.service.ts`), and seed an OFF row per existing tenant in the migration (pattern: `0189_financial_statements.sql`). Routers use `requireFeatureFlag('TAX_ESTIMATOR_V1')`. The staff flag is evaluated on the caller's **active tenant** like every other module (enable it on the firm's practice tenant(s)); the portal checks the **portal contact's tenant**; a linked company in a tenant without the flag is still computed (data read, no UI exposure there). The portal additionally needs a new per-contact boolean `portal_contact_companies.tax_estimates_access` (default false), like `financials_access`.
- **D6 — One release when complete.** Branch `feat/tax-estimator`; merge `main` into it after every prod release. The schema stays **one consolidated migration** `NNNN_tax_estimator.sql` with its `.rollback.sql`; `NNNN` is assigned (next free journal idx) on the day it merges to main. Additive only (rule #13, `scripts/check-migration-policy.sh`). Deploy per the repo's release recipe after merge; flag stays OFF until Kurt turns it on per tenant.
- **D7 — The oracle was corrected before any engine code** (nine-month proration replaced by a true Schedule AI period-3 column with full-year standard deduction and credits; §6654 penalty is event-driven: payments to the earliest unpaid installment, accrual to the earlier of payment or return due date). Logged in OPEN-QUESTIONS.md Q13–Q14; `rivera_expected.json` regenerated.
- **D8 — QBI W-2 wages come from the books.** `w2_wages` treatment on wage accounts (incl. officer wages); the year's total is the default; a per-entity-per-year override field wins when set. UBIA is a manual per-entity-per-year input. Blank UBIA → UBIA limb not computed, warning shown.
- **D9 — Prior-year tax and AGI are encrypted at rest** as `prior_year_tax_encrypted` / `prior_year_agi_encrypted` text columns using `encrypt()`/`decrypt()` from `packages/api/src/utils/encryption.ts`, decrypted only inside the service. The repo's credential re-encryption sweep (`credential-reencrypt.service.ts`) discovers every top-level `*_encrypted` text column from `information_schema`, so the naming is what enrols them in key rotation and cross-host restore recovery. §7216 note goes in the data dictionary and docs.
- **D10 — Defaults changed from the kit:** firm safe-harbor default `lesser_of` (was `prior_year`); the **§469(i) $25,000 rental allowance is computed in v1** (needs `active_participation` on rental links and parameters `passive.rental_allowance`, `passive.rental_allowance_phaseout_start`, `passive.rental_allowance_phaseout_end`, MFS rules); portal default **live** (computed on request, Redis-cached, labelled with as-of time; `portal_shows` can switch a taxpayer to latest snapshot). Unchanged defaults: ÷3 quarterly allocation, QBI carryforward out of scope, S corp >2% health as officer W-2 + SEHI, withholding even, mid-year ownership as weighted %, individuals calendar-year, nonresident sourcing from entity state × share with override, unmapped accounts ordinary + warning, charitable floor/35% cap when seeded.
- **D11 — Scope is the full kit** plus the District of Columbia (42 income-tax jurisdictions). Seed and verify **Missouri and Arkansas first**; they are the firm's filing states.
- **D12 — CPA sign-off gate.** Phase 1 (federal parameters) and the MO/AR batch of Phase 2 end with a checklist in PROGRESS.md (every value, its citation, status). **Engine phases 6–10 do not start until Kurt marks that checklist verified.** Agent verification is the first pass, not the last.
- **D13 — Development and tests run on this host, which is the production server.** Rules every agent must obey: API tests run from `packages/api` with `DATABASE_URL=postgresql://kisbooks:<POSTGRES_PASSWORD from ~/vibe-mybooks/.env>@localhost:5434/kisbooks_test` and `REDIS_URL=redis://127.0.0.1:6390` (container `vibe-test-redis`); run **one test file at a time** (connection cap); **never** `redis://…:6379`, database `kisbooks`, ports 3001/5173, `docker compose restart`, or any write to `~/vibe-mybooks`. `scripts/*.sh` run from the repo root. No ESLint config exists in the repo; use `tsc --noEmit` per workspace. Web tests: `npm test -w packages/web`.
- **D14 — Target: usable for Q4 2026 vouchers (Jan 15, 2027); Kurt accepts that the full scope may slip past it.** Phases run in the kit's order and parallel waves; no milestone split.
- **D15 — PDF delivery is both** a Report Pack section (`tax-estimate`, group "Tax", selectable in any pack of a linked company, the section option picks the taxpayer) **and** a standalone Print/Download on the taxpayer screen producing the identical PDF.
- **D16 — Fable is available at the kit's level.** Keep the tiering as written; log usage in PROGRESS.md.

## What the feature does
For a Taxpayer (individual or couple), the feature estimates the full-year federal, self-employment and state tax across all linked entities. It works from each entity's books on its **tax method**, after the **tax-treatment map** (TB assignments + estimator treatments) and the user's adjustments. It produces:
1. A **full-year projection** (straight run-rate on closed months, with non-recurring items excluded from annualization), shown next to **YTD tax-basis amounts** for income and adjustment lines.
2. **Safe-harbor** amounts (all rules shown; the recommended rule comes from the firm default with a per-Taxpayer override). The installment schedule uses the **lesser of the regular or annualized (Schedule AI)** amount for each installment, per Form 2210.
3. A **voucher schedule** per jurisdiction, with state-specific rules, paid vs. remaining, and an estimated **§6654 penalty accrual** on short installments.
4. Named **what-if scenarios** compared side by side, calculated with brackets so marginal effects are correct.
5. A **snapshot** on finalize, a **Report Pack section / standalone PDF with an assumptions page**, and a **read-only portal view**.

Included in all license tiers (module manifest `taxEstimator: 'base'` in `shared/src/constants/modules.ts`). The disclaimer text is **firm-editable**. The default is: "Projection based on bookkeeping records and the assumptions listed. Not a tax return."

## Locked design decisions (change only via an OPEN-QUESTIONS.md entry)

### Entities, Taxpayers, links
- **Entity** = a `companies` row (TB2). **Entity tax types:** `sch_c` (including SMLLC), `sch_f`, `s_corp`, `partnership`, `c_corp` — derived per D3.
- **Entity tax fields** (estimator-owned, per company, in `tax_est_entity_settings`):
  - `tax_method` override of `companies.accounting_method` (`cash` | `accrual`). The estimator always pulls the P&L on the effective basis.
  - `is_sstb`, `large_corporation`, `farmer_override`, `rental_qbi_trade_or_business` (Rev. Proc. 2019-38 safe harbor or §162 determination), `state_sourcing` (default state for nonresident sourcing).
  - Per tax year: `w2_wages_override`, `ubia` (D8).
- **Taxpayer** (`tax_est_taxpayers`, `firm_id`): filing status, resident state. Each **person** (`tax_est_persons`) carries role, name, date of birth (65 test, catch-ups), blind flag, monthly **SEHI eligibility** (`sehi_eligible_months`, 12 booleans). **Polarity as built (Phase 3): `true` = no employer-subsidized plan was available that month, so SEHI IS deductible for it; default all true. The original kit prose said the opposite ("eligible for an employer plan"); the engine must read `true` as "deduction allowed".**
- **taxpayer_entity_links** (`tax_est_links`, per person, per company, per tax year): `profit_pct`, `loss_pct`, `capital_pct` (informational); `partner_se_status` (`general` | `limited` | `llc_member_manager`) + memo; `is_officer`; `activity_type` (`active` | `passive` | `rental` | `investment`); `active_participation` (rental, for §469(i), D10); `qbi_eligible` (+ override reason); `allowed_loss_override` (amount + reason).
- Estimates **roll up per Taxpayer across all linked entities** (across tenants, D1). C corps are entity-level only.

### Tax-treatment map (per entity) — D3
Character comes from TB `account_tax_assignments` where assigned. `tax_est_account_treatments` adds, per account:
- `nondeductible_pct` (meals defaults to 50%)
- `owner_sehi`, `owner_retirement`, `owner_personal` (with a person; the person is required on an S corp). A TB code that already says owner SEHI (887/888, 689/690) routes to the owner without a treatment; the treatment wins when both exist.
- `guaranteed_payment` (partnership only, with the partner — required): kept as the partnership's deduction and added to that partner's ordinary income. TB guaranteed-payment codes are suggested, never auto-applied, and warned while untreated.
- `estimated_tax_payment` (with Taxpayer/person + jurisdiction; may also sit on equity/draw accounts, where it only feeds the payment ledger; always read on a cash basis)
- `tax_depreciation_differs` (book depreciation; the tax amount comes from an adjustment)
- `w2_wages` (QBI wage limit source, D8; optional person = officer wages per officer)
- Character, on income / other-income accounts, where the TB seed has no code for it: `capital_gain_lt`, `capital_gain_st`, `section_1231`, `interest`, `dividends_ordinary`, `dividends_qualified` (wins over the TB code's character).
- `non_recurring` flag. Individual transactions can carry their own `non_recurring` flag (side table `tax_est_transaction_flags`, since `transactions` is not altered).
Unassigned accounts with activity are **ordinary + warning**.

The **P&L provider** applies the map **before** the engine: owner items removed from entity profit and routed to the owner level (SEHI, retirement) for Sch C / Sch F / partnerships, or dropped (personal); on an S corp, >2% shareholder health stays an S corp deduction and goes to that officer as W-2 box 1 wages (not SS / Medicare) plus SEHI, and owner retirement stays the corporation's deduction (D10); guaranteed payments stay a partnership deduction and go to the named partner; estimated tax payments removed and fed to the payment ledger; nondeductible % added back; gains carried as separate character; every reclass appears in the trace. It reads the GL through the existing report builders (`report.service.ts`: `buildProfitAndLoss`, `cashBasisLinesWith`, fiscal helpers) and the TB workpaper (`services/tb/balance-engine.service.ts: computeWorkpaper`), never through its own ledger queries. Tag filtering, if ever used, follows TB7.

### Books readiness
- Range end defaults to the **last closed month**: the latest month whose bank and credit-card accounts are all reconciled. Selecting an open month is allowed, with a warning. `companies.lock_date` (TB5) is shown as the closing date.
- Warnings (never blocks; also printed on the assumptions page): unreconciled accounts in range; uncategorized / suspense / "ask my accountant" balances; accounts with activity and no treatment/assignment; missing entity tax method or tax type; linked company in a tenant no longer managed by the firm (D1).

### Projection
- Range snaps to whole calendar months (platform is month-granular, TB10; there is no 4-4-5). Individuals use the calendar year; C corps use the entity fiscal year (`companies.fiscal_year_start_month`).
- Projection = actual YTD for every line + run-rate on the **recurring** portion: (recurring YTD ÷ months elapsed) × remaining months. Non-recurring items count once.
- Adjustments are allocated by whole months (monthly, quarterly ÷3, annual ÷12, active ranges). An adjustment linked to GL uses actuals YTD plus the manual amount (or run-rate) for remaining months.

### Federal calculation order (individual) — pure functions
1. **Entity tax-basis income** = P&L on the tax method → treatment map → entity-level adjustments. Income is kept by character: ordinary, capital gain (short/long), §1231, interest, dividends (qualified/ordinary), rental.
2. **Allocate to persons:** income by `profit_pct`, a net loss by `loss_pct`. Guaranteed payments go to the specific partner. Officer wages go to the officer as W-2 wages.
3. **Loss limitations:**
   - Apply `allowed_loss_override` (basis / at-risk).
   - Passive losses (`passive` or `rental` activity) offset only passive income. **§469(i): up to the parameter allowance of net rental real-estate loss is allowed against nonpassive income when the person has `active_participation`, phased out between the MAGI parameters; MFS rules per parameters (D10).** The remaining excess is suspended and shown, not deducted.
   - **Excess business loss (§461(l))** uses the parameter threshold. The excess becomes an NOL note.
4. **SE income** per person: Sch C / Sch F full share; partnership `general` / `llc_member_manager`: ordinary share + GP excluding rental, interest, dividends and gains; `limited`: GP only; S corp: none. Adjustments flagged `affects_se` apply.
5. **SE tax** per person: NESE = SE income × `se.nese_factor` (zero below `se.min_nese`); SS = `se.ss_rate` × min(NESE, wage base − person's W-2 SS wages); Medicare = `se.medicare_rate` × NESE.
6. **Limits on owner deductions:** SEP / solo 401(k) / SIMPLE from parameters on net SE earnings after ½ SE tax, **capped with a warning**; HSA by coverage type and catch-up; SEHI only for months not eligible for employer coverage, capped at earned income from the business the plan is under.
7. **AGI** = total income (by character) − ½ SE tax − capped above-the-line items.
8. **Deductions:** standard (with 65/blind add-ons) vs itemized detail (SALT with cap and MAGI phase-down; mortgage interest; charitable with the 0.5%-of-AGI floor and the 35% benefit cap if parameterised; other) — larger wins unless forced. **Non-itemizer charitable deduction** when parameterised for the year (`charity.nonitemizer.{fs}`; verify). **Schedule 1-A** (senior, tips, overtime, car-loan interest) on top of either, with phase-outs and per-person eligibility.
9. **QBI (§199A), full:** per qualifying link after attributable ½ SE, SEHI and retirement; **W-2 wage (D8) / UBIA limits**, threshold and phase-in, SSTB rules; loss netting within the year; REIT/PTP component; overall limit = rate × (taxable income before QBI − net capital gain incl. qualified dividends); minimum deduction for active QBI ≥ the parameter threshold.
10. Taxable income = AGI − deduction − Schedule 1-A − QBI.
11. **Regular tax:** default `rate_mode = 'brackets'` (ordinary brackets + QD/LTCG worksheet with 0/15/20 breakpoints + 25%/28% buckets where flagged); `rate_mode = 'effective'` is an override labelled everywhere.
12. **Credits:** nonrefundable (manual, capped at regular tax) and refundable (manual).
13. **Additional Medicare** (wages + NESE above the threshold, reduced by wages first). **NIIT** = rate × min(NII, MAGI − threshold); NII = interest, dividends, gains, rental, passive/investment K-1 income, less allocable deductions.
14. Federal total = regular tax − nonrefundable + SE tax + Additional Medicare + NIIT − refundable.

AMT and the kiddie tax are out of scope (warning line if the user flags AMT exposure).

### State calculation
- One **resident** state, zero or more **nonresident** states (incl. DC). Each row: `effective_rate` (user input; brackets later), `base` (`federal_agi` | `federal_taxable` | `custom`), and for nonresident rows `sourced_income` (manual or derived).
- **Nonresident tax** = sourced income × rate. **This is a flat-rate simplification; the UI and assumptions page label it "effective-rate estimate; most states compute nonresident tax by ratio of the full return".**
- **Resident tax** = base × rate − credit for taxes paid to other states, credit = Σ min(other-state tax, resident rate × income sourced there).
- C corps: apportionment % × taxable income × rate.

### Safe harbor, Schedule AI, vouchers, penalties
**Individual federal**
- Required annual payment: (a) `safe_harbor.current_pct` × current-year tax (Form 2210 definition); (b) `prior_pct` or `prior_pct_high_agi` × prior-year tax (high-AGI test on prior-year AGI; unavailable if the prior year was short or unfiled; zero prior tax → no penalty).
- **Both shown.** Recommended rule = firm default (**`lesser_of`**, D10) with a per-Taxpayer override.
- **Schedule AI:** annualize actual tax-basis income through 3/31, 5/31, 8/31, 12/31 (12/31 uses the projection) with the factors and applicable percentages from parameters; **full-year standard deduction and full-year credits (D7)**; Part II SE tax on period net earnings against the prorated wage base, then annualized; each installment = lesser of regular or annualized with recapture; shown even when not used.
- **Payments:** from the GL (`estimated_tax_payment`) plus manual entries; prior-year overpayment counts as paid on the original due date; **applied to the earliest unpaid required installment**; withholding treated as paid evenly.
- **Penalty (D7):** each installment's unpaid balance accrues at the quarterly §6654 rate from its due date to the **earlier of the date it is paid or the return due date**; estimate labelled as such. Q4 relief note (file and pay by Jan 31). Farmer/fisherman and C corp rules as in the kit (66⅔% / Jan 15 / Mar 1; 4th-6th-9th-12th month installments, large-corp first-installment rule with recapture).
- **States:** per-jurisdiction rule set from `state_estimate_rules`; a jurisdiction without verified rules falls back to the federal pattern with a "verify" badge.

### Scenarios, snapshots, standards
- Base scenario + named clones, each holding a full copy of all inputs. Compare up to 3.
- **Finalize** stores an immutable snapshot (inputs, results, engine version, resolved parameters with statuses, readiness warnings, user, timestamp) when vouchers are issued or a PDF is generated.
- The PDF includes an **assumptions page** (rate mode, projection method and months, non-recurring exclusions, reclass totals, adjustments, safe-harbor rule chosen and why, state methods incl. the nonresident flat-rate label, unverified/provisional parameters, readiness warnings, firm disclaimer).
- Prior-year tax and AGI are **tax return information** (D9): encrypted, marked in the data dictionary, audited.

### Tax parameters (D4)
- **Federal:** `tax_parameters` (tax_year, key) with source citation and status `verified` | `unverified` | `provisional`; super-admin overrides with reason, audited; **create year from prior year** (provisional, dates rolled with weekend/holiday adjustment, flagged "verify"); **missing-year fallback** (latest year, all provisional, banner); **shipped-vs-provisional diff** with "adopt shipped".
- **State:** `state_estimate_rules` (jurisdiction, tax_year, key), same lifecycle. DC is a jurisdiction row.
- **Never hardcode** a rate, percentage, threshold, limit, date or dollar amount in engine code. The only allowed literals are structural (0, 1, 12, array indices). A guard test enforces this.

**Federal parameter keys.** `{fs}` = single | mfj | mfs | hoh | qss.
- **SE:** `se.nese_factor`, `se.min_nese`, `se.ss_rate`, `se.medicare_rate`, `se.ss_wage_base`, `se.deduction_factor`
- **Brackets:** `brackets.{fs}`, `ltcg.breakpoints.{fs}`, `ltcg.rates`, `collectibles_rate`, `unrecaptured_1250_rate`
- **Medicare / NIIT:** `addl_medicare.rate`, `addl_medicare.threshold.{fs}`, `niit.rate`, `niit.threshold.{fs}`
- **Deductions:** `std_deduction.{fs}`, `std_deduction.additional_65_blind.{unmarried|married}`, `salt.cap.{standard|mfs}`, `salt.phase_down.threshold.{standard|mfs}`, `salt.phase_down.rate`, `salt.floor.{standard|mfs}`, `charity.agi_floor_pct`, `charity.nonitemizer.{fs}` (new; verify), `itemized.benefit_cap_rate`
- **Schedule 1-A:** `sch1a.senior.*`, `sch1a.tips.*`, `sch1a.overtime.*`, `sch1a.car_interest.*`, `sch1a.first_year`, `sch1a.last_year` (as in the kit)
- **QBI:** `qbi.rate`, `qbi.threshold.{fs}`, `qbi.phase_in_range.{fs}`, `qbi.w2_wage_pct`, `qbi.alt_w2_wage_pct`, `qbi.ubia_pct`, `qbi.taxable_income_limit_pct`, `qbi.min_deduction_amount`, `qbi.min_deduction_active_qbi_threshold`
- **Losses:** `ebl.threshold.{standard|mfj}`; **new (D10):** `passive.rental_allowance.{standard|mfs_living_apart}`, `passive.rental_allowance_phaseout_start.{standard|mfs_living_apart}`, `passive.rental_allowance_phaseout_end.{standard|mfs_living_apart}`
- **Retirement / HSA:** `retirement.sep.pct_of_comp`, `retirement.sep.dollar_limit`, `retirement.comp_limit`, `retirement.401k.deferral`, `retirement.401k.catch_up_50`, `retirement.401k.catch_up_60_63`, `retirement.simple.deferral`, `retirement.simple.catch_up`, `hsa.limit.{self|family}`, `hsa.catch_up_55`
- **C corp:** `ccorp.rate`, `ccorp.large_corp_threshold`, `ccorp.installment_months`, `ccorp.installment_pcts`, `ccorp.safe_harbor_current_pct`, `ccorp.safe_harbor_prior_pct`, `ccorp.sch_ai.*`
- **Individual safe harbor:** `safe_harbor.current_pct`, `safe_harbor.prior_pct`, `safe_harbor.prior_pct_high_agi`, `safe_harbor.high_agi_threshold.{standard|mfs}`, `safe_harbor.min_balance_due`
- **Installments:** `installments.due_dates`, `installments.pcts`, `installments.q4_file_and_pay_date`, `return_due_date` (new, for the penalty end date)
- **Schedule AI:** `sch_ai.period_ends`, `sch_ai.annualization_factors`, `sch_ai.applicable_pcts`, `sch_ai.period_months` (new, for the prorated wage base)
- **Farmer:** `farmer.gross_income_ratio`, `farmer.safe_harbor_current_pct`, `farmer.safe_harbor_prior_pct`, `farmer.single_due_date`, `farmer.file_by_date`
- **Penalty:** `penalty.underpayment_rate` (array of {from, to, rate} by quarter)
- **Dates:** `holidays` (federal + DC legal holidays)

**State rule keys** (`state_estimate_rules`, per jurisdiction and year; registry `shared/src/tax-estimator/stateRuleKeys.ts`; every taxed state carries all 20, a value or an explicit cited null): `has_income_tax`, `estimates_required` (false = no quarterly individual regime, ID/UT: no vouchers, no underpayment penalty; the engine view withholds the installment keys), `required_threshold`, `threshold_comparison` (`at_least` | `more_than`, null = at_least; applies to `required_threshold` and `penalty.min_balance_due`), `safe_harbor.current_pct`, `safe_harbor.prior_pct`, `safe_harbor.high_agi_rule` (`{ threshold, pct }` + optional `threshold_mfs`, `no_prior_year_agi`, `no_prior_year_agi_mfs` = current-year AGI at or above which the prior-year harbor is unavailable, CA), `installments.due_dates`, `installments.pcts`, `installments.q4_file_and_pay_date` (date; last installment waived if the return is filed and paid by it; null = none), `return_due_date` (date ending the penalty period; null = Apr 15), `farmer.rule` (`{ ratio, current_pct, due_date, file_by }` + optional `treatment`: `single_installment` (default) | `quarterly` (MA) | `exempt` (IL/MT/VT; OK/OR keep the equivalent `current_pct: 0`)), `penalty.rate_source`, `penalty.rate`, `penalty.rate_schedule` (`[{ from, to, rate }]` by calendar date; supersedes `penalty.rate` on covered days — `statePenaltyRateOn`), `penalty.method` (`daily_simple` | `monthly_or_fraction` | `monthly_compound` | `tiered_flat`, null = daily_simple), `penalty.min_balance_due` (no penalty below this balance after withholding; null = `required_threshold`; MO 500), `credit_for_other_state`, `nonresident_method` (`ratio` | `sourced_flat` | `other`, informational label), `holidays`; every row has a citation and status. Key-set rationale: docs/reviews/R5-state-rules-sample.md "Key-set decisions".

Adjustment-catalog percentages (meals) are an editable `pct` on the adjustment type or treatment row, not tax parameters.

### Access (D1, D4, D5)
| Actor | Access |
|---|---|
| super admin | everything + parameter/state-rule library (`/admin/tax-parameters`) |
| firm admin (`firm_role = firm_admin`) | all staff rights + firm safe-harbor default, disclaimer, `portal_shows` |
| firm staff with the `tax_estimator` permission resource (new row in `shared/src/constants/permissions.ts`, like `trial_balance`) | taxpayers, links, entity settings, treatments, scenarios, payments, finalize, PDF |
| `firm_readonly` | read-only screens, no mutations, no finalize |
| `user_type = 'client'` | 404 on `/api/v1/tax-estimator/*` |
| portal contact | `portal-tax-estimates-public` router only: tenant flag + `tax_estimates_access`; sees summary + vouchers for linked Taxpayers; never other owners, adjustments, rates or traces |

Delegable admin routes (if any are added for firm admins) must be registered in `admin.delegation-manifest.test.ts`.

## Engineering rules
- **Engine:** pure, deterministic TypeScript in `packages/shared/src/tax-estimator/engine/` with no DB or IO. Typed input DTO in; typed result out, with a line-by-line **trace** (label, amount, formula, source: `gl` | `gl_map` | `adjustment` | `parameter` | `state_rule` | `input`). The trace drives the UI drill-down, the assumptions page and the PDF. Services call the engine only through its DTO; never re-implement tax math in the API or web.
- **Money:** Postgres `decimal(19,4)` (rule #11); `decimal.js` in the api; the shared engine uses a string-decimal helper (no new dependency in shared without the licence audit). Never floats. Round to whole dollars, half-up, only at final per-line amounts.
- **Tests:** unit tests for every engine function; **golden tests must match `docs/reference-calc/rivera_expected.json`** (produced by `rivera_fixture.py`). Engine and oracle disagree → investigate both; never edit the expected file to pass without an OPEN-QUESTIONS.md entry. Tenant/firm isolation tests for every route (D1). Vitest, files beside the source, run per D13.
- **Database:** additive-only migration + rollback file + journal entry (D6); license header on the SQL; `CREATE TABLE IF NOT EXISTS`; `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`; `tenant_id uuid NOT NULL` on every books-scoped table, `firm_id` on taxpayer-scoped tables; CHECK constraints for enums (no PG enums); indexes lead with `(tenant_id, company_id, …)` or `(firm_id, …)`; `timestamptz NOT NULL DEFAULT now()`. Table prefix `tax_est_` for everything except `tax_parameters*` and `state_estimate_rules*`.
- **API:** `/api/v1/tax-estimator/...` mounted in `app.ts`; router-level `authenticate` → client-404 guard → `requireFirmStaff` → `requireFeatureFlag('TAX_ESTIMATOR_V1')` → `requireResource('tax_estimator')`. Zod schemas from `@kis-books/shared`; service-layer logic (rule #15); pagination with totals (rule #16); `auditLog` (`middleware/audit.ts`, pass the transaction `executor` for atomicity) on every mutation; error codes inline `TE_*` SCREAMING_SNAKE (`TE_TENANT_NOT_MANAGED`, `TE_LINK_PCT_OVER_100`, `TE_PARAM_MISSING`, `TE_SNAPSHOT_IMMUTABLE`, `TE_PORTAL_FORBIDDEN`, … list maintained here).
- **Repo gates every phase must pass:** `tsc --noEmit` in shared/api/web; targeted vitest files; `bash scripts/check-license-headers.sh`; `bash scripts/check-any-baseline.sh` (no new `any`; baseline api 319 / web 1 / worker 0); `bash scripts/check-migration-policy.sh`; `npm run license:audit` if a dependency changed.
- **Commits:** conventional, `feat(tax-est): …`, one per logical step, at least one per phase, on `feat/tax-estimator`. Never `git add -A` (the repo has had a secret-leak incident); add paths explicitly. Attribution trailer per the session's rules.
- **UI reference:** `docs/ui-mockups/UI-SPEC.md` + `docs/ui-mockups/html/` define layout, content, states and interactions. Styling comes from the existing component library (`packages/web/src/components/ui`, shared `ColumnFilter`/`SortableTh`/`useColumnView` tables). Every page has loading, error and empty states (rule #10). Nav + route guard follow `useTrialBalanceVisibility.ts` and `App.tsx`.
- **Knowledge base:** when the module ships, update `packages/web/src/features/help/articles.ts` (template literals — no backticks in text) and `packages/api/src/knowledge/curated/`.
- Do not modify unrelated modules, except integration hooks: Report Pack registry (`shared/src/reports/registry.ts`, `report-pack-render.ts`, `reports.routes.ts` endpoint map), portal nav + `portal_contact_companies` column, permission registry, feature-flag registry, module manifest, TB entity settings screen (link to Tax setup).
