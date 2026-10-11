# BUILD-PLAN.md — MyBooks Tax Estimator (plan v2.1)

> **Superseded where it differs.** This is the original v2.1 long-form plan kept for reference.
> On 2026-10-11 it was adapted to the Vibe-MyBooks repository and the owner's decisions D1–D16;
> the binding documents are now `MODULE.md`, `PHASES.md`, `ORCHESTRATION.md`, `OPEN-QUESTIONS.md`
> and `PROGRESS.md` in this folder. Paths like `server/**`, `client/**`, `__tests__`, and the
> file names CLAUDE.md / STATE.md / QUESTIONS.md in this file are obsolete.


The single build plan for the **Tax Estimator** feature in Vibe MyBooks (KisaesDevLab). It combines the project rules, agent and model orchestration, phases, open questions, UI spec, golden fixture, state template and subagent definitions.

## How to use this file
1. Put this file at `features/tax-estimator/BUILD-PLAN.md`. Alongside it, keep:
   - `docs/reference-calc/` (the test oracle and expected JSON);
   - `docs/ui-mockups/html/` (the rendered mockups).
2. Start Claude Code at the repo root with `claude --model opusplan` and give it this prompt:
```
Read features/tax-estimator/BUILD-PLAN.md completely. Run Phase 0 step 1:
create the subagent files from Appendix A in the repo root .claude/agents/,
merge Appendix B into .claude/settings.json, and create living STATE.md and
QUESTIONS.md beside this file from Parts 6 and 4. Then act as orchestrator:
execute Part 3 using the agents, models, escalation ladder and parallel waves
in Part 2, following every rule in Part 1. Golden tests must match
docs/reference-calc/rivera_expected.json. Update STATE.md (including the usage
log and review tracker) after each phase, log defaults taken from
QUESTIONS.md, and use conventional commits. /clear between phases.
```
3. **Reference mapping.** Wherever this plan says `CLAUDE.md`, read Part 1. `ORCHESTRATION.md` means Part 2, `PHASES.md` Part 3, `UI-SPEC.md` Part 5. `STATE.md` and `QUESTIONS.md` are the living files created in Phase 0 from Parts 6 and 4. Subagents must read this file in place of those names.
4. BUILD-PLAN.md is the spec and is not edited during the build. Progress goes in `STATE.md`; new questions and resolutions go in `QUESTIONS.md`.

## Contents
- Part 1 — Project rules and design decisions
- Part 2 — Agents, models and parallel work
- Part 3 — Phases
- Part 4 — Open questions and items to verify
- Part 5 — UI specification and golden fixture
- Part 6 — State tracking template
- Appendix A — Subagent definitions (12)
- Appendix B — Claude Code settings
- Appendix C — Package files referenced


---

# Part 1 — Project rules and design decisions
_Binding for every agent. Formerly CLAUDE.md._

You are building the **Tax Estimator** feature inside Vibe MyBooks (self-hosted bookkeeping appliance, KisaesDevLab). Work autonomously through `PHASES.md` in order. Record progress in `STATE.md` after every phase. Put any blocking uncertainty in `QUESTIONS.md`, take the documented default, and keep going. Stop only when a decision cannot be undone and the default is unclear.

v2 folds in a CPA review of v1. The main changes:
- Bracket-based tax with preferential rates.
- A resident/nonresident state model with credits, plus state estimate rules for all 41 income-tax states.
- Schedule AI and §6654 penalty estimates.
- A GL tax-treatment map, the entity tax method, non-recurring items, and books-readiness checks.
- Activity characterization (passive, rental, NIIT), loss limitations, and Schedule 1-A deductions.
- Retirement, HSA and SEHI limits, and split credits.
- Profit and loss percentages for partners.
- C corp and Q4 edge rules.
- An assumptions page and a firm-editable disclaimer.

### Agents and models
Work is split across Claude Code subagents on different models according to **`ORCHESTRATION.md`**, which is binding:
- the model tiers and complexity routing rule;
- the escalation ladder;
- the Fable budget guard;
- agent ownership scopes (only the owning agent writes in its scope);
- the independence rule (the engine author never edits oracles or golden files);
- the per-phase routing table and parallel waves;
- hand-off discipline.

The orchestrating session runs on `opusplan`. Only `tax-engine-architect`, `oracle-verifier` and `fable-process-reviewer` use Fable. `fable-process-reviewer` performs the deep process reviews R1–R7 at the gates named in PHASES.md.

### Stack (existing — do not change)
React 18 + TypeScript, Node.js 20, Express, Drizzle ORM, PostgreSQL 16, Redis 7, BullMQ.

Match the existing repo conventions for:
- folder layout and API route style;
- auth/permission middleware and multi-tenant (firm/entity) scoping;
- audit logging and money handling;
- the fiscal calendar (including 4-4-5), cash/accrual P&L reporting, bank reconciliation status;
- Report Packs and portal read-only views.

Phase 0 discovers these conventions. Never invent a parallel pattern when one already exists.

### What the feature does
For a Taxpayer (individual or couple), the feature estimates the full-year federal, self-employment and state tax across all linked entities. It works from each entity's books on its **tax method**, after the **GL tax-treatment map** and the user's adjustments. It produces:
1. A **full-year projection** (straight run-rate on closed months, with non-recurring items excluded from annualization), shown next to **YTD tax-basis amounts** for income and adjustment lines.
2. **Safe-harbor** amounts (all rules shown; the recommended rule comes from the firm default with a per-Taxpayer override). The installment schedule uses the **lesser of the regular or annualized (Schedule AI)** amount for each installment, per Form 2210.
3. A **voucher schedule** per jurisdiction, with state-specific rules, paid vs. remaining, and an estimated **§6654 penalty accrual** on short installments.
4. Named **what-if scenarios** compared side by side, calculated with brackets so marginal effects are correct.
5. A **snapshot** on finalize, a **Report Pack PDF page with an assumptions page**, and a **read-only portal view**.

Included in all license tiers. The disclaimer text is **firm-editable**. The default is: "Projection based on bookkeeping records and the assumptions listed. Not a tax return."

### Locked design decisions (change only via a QUESTIONS.md entry)

#### Entities, Taxpayers, links
- **Entity tax types:** `sch_c` (including SMLLC), `sch_f`, `s_corp`, `partnership`, `c_corp`.
- **Entity tax fields:**
  - `tax_method` (`cash` | `accrual`). The estimator always pulls the P&L on this basis.
  - `is_sstb`, `large_corporation`, `farmer_override`.
  - `rental_qbi_trade_or_business` (yes/no; the Rev. Proc. 2019-38 safe harbor or a §162 determination).
- **Taxpayer:** an individual or a couple. Each **person** carries:
  - age-65 and blind flags;
  - monthly **SEHI eligibility** (12 booleans: "eligible for an employer-subsidized plan through own or spouse's employer").
  - The Taxpayer itself carries the filing status and resident state.
- **taxpayer_entity_links** (per person, per tax year):
  - `profit_pct`, `loss_pct`, `capital_pct` (capital % is informational);
  - `partner_se_status` (`general` | `limited` | `llc_member_manager`) with a memo;
  - `is_officer`;
  - **`activity_type`** (`active` | `passive` | `rental` | `investment`);
  - `qbi_eligible` (defaults from entity type and activity; can be overridden);
  - `allowed_loss_override` (amount + reason) for basis and at-risk limits.
- Estimates **roll up per Taxpayer across all linked entities**. C corps are entity-level only.

#### GL tax-treatment map (per entity)
Every P&L account has a `tax_treatment`:
- `ordinary` (default)
- `nondeductible_pct` (with a %; meals defaults to 50%)
- `owner_sehi`
- `owner_retirement`
- `owner_personal`
- `estimated_tax_payment` (with Taxpayer/person + jurisdiction; may also be set on equity/draw accounts, where it only feeds the payment ledger)
- `tax_depreciation_differs` (book depreciation; the tax amount comes from an adjustment)
- `capital_gain` / `section_1231`
- `other_investment`

Each account also has a `non_recurring` flag. Individual transactions can carry their own `non_recurring` flag.

The **P&L provider** applies the map **before** the engine:
- Owner items are removed from entity profit and routed to the owner level (SEHI, retirement) or dropped (personal).
- Estimated tax payments are removed and fed to the payment ledger.
- The nondeductible % is added back.
- Gains are carried as separate character so preferential rates and NII apply.
- Every reclass appears in the trace.

#### Books readiness
- The range end defaults to the **last closed month**: the latest month whose bank and credit-card accounts are all reconciled. Selecting an open month is allowed, with a warning.
- The summary shows warnings for:
  - unreconciled accounts in the range;
  - uncategorized / suspense / "ask my accountant" balances;
  - accounts with no tax-treatment mapping that have activity;
  - missing entity tax method or tax type.
- These are **warnings, not blocks**. They also print on the assumptions page.

#### Projection
- Range snaps to whole calendar months, including for 4-4-5 entities. Individuals use the calendar year; C corps use the entity fiscal year.
- Projection = actual YTD for every line + run-rate on the **recurring** portion: (recurring YTD ÷ months elapsed) × remaining months. Non-recurring items count once.
- Adjustments are allocated by whole months (monthly, quarterly ÷3, annual ÷12, active ranges). An adjustment linked to GL uses actuals YTD plus the manual amount (or run-rate) for remaining months.

#### Federal calculation order (individual) — pure functions
1. **Entity tax-basis income** = P&L on the tax method → GL tax-treatment map → entity-level adjustments. Income is kept by character: ordinary, capital gain (short/long), §1231, interest, dividends (qualified/ordinary), rental.
2. **Allocate to persons:** income by `profit_pct`, a net loss by `loss_pct`. Guaranteed payments go to the specific partner. Officer wages go to the officer as W-2 wages.
3. **Loss limitations:**
   - Apply `allowed_loss_override` (basis / at-risk).
   - Passive losses (`passive` or `rental` activity) offset only passive income. The excess is suspended and shown, not deducted. The $25k rental allowance is not modeled in v1; it is a manual override.
   - **Excess business loss (§461(l))** uses the parameter threshold. The excess becomes an NOL note.
4. **SE income** per person:
   - Sch C / Sch F: the full share.
   - Partnership `general` / `llc_member_manager`: ordinary share + GP, excluding rental, interest, dividends and gains.
   - Partnership `limited`: GP only.
   - S corp: none.
   - Adjustments flagged `affects_se` apply.
5. **SE tax** per person:
   - NESE = SE income × `se.nese_factor` (zero below `se.min_nese`).
   - SS = `se.ss_rate` × min(NESE, wage base − person's W-2 SS wages).
   - Medicare = `se.medicare_rate` × NESE.
6. **Limits on owner deductions:**
   - **SEP / solo 401(k) / SIMPLE**: limits from parameters, computed on net SE earnings after ½ SE tax. **Capped, with a warning.**
   - **HSA**: limit by coverage type (self/family) and catch-up.
   - **SEHI**: only for months the person was not eligible for employer coverage, and capped at earned income from the business the plan is established under.
7. **AGI** = total income (by character) − ½ SE tax − capped above-the-line items.
8. **Deductions:**
   - The **standard deduction** includes the 65/blind add-ons from parameters.
   - **Itemized detail**: SALT with the cap and MAGI phase-down from parameters; mortgage interest; charitable (with the 0.5%-of-AGI floor and the 35% benefit cap if they are in the parameters); other.
   - Use the larger of standard or itemized, unless the user forces one.
   - **Schedule 1-A** (senior, tips, overtime, car-loan interest) applies on top of either, with phase-outs from parameters and per-person eligibility.
9. **QBI (§199A), full:**
   - Per qualifying link (`qbi_eligible`): QBI after attributable ½ SE, SEHI and retirement.
   - W-2 wage / UBIA limits, threshold and phase-in, SSTB rules.
   - Loss netting across businesses within the year.
   - REIT dividends / PTP component (adjustment flags).
   - Overall limit = rate × (taxable income before QBI − **net capital gain including qualified dividends**).
   - Minimum deduction (parameters) for active QBI ≥ the parameter threshold.
10. Taxable income = AGI − deduction − Schedule 1-A − QBI.
11. **Regular tax:**
    - Default `rate_mode = 'brackets'`: ordinary brackets by filing status, plus the **qualified dividend / LTCG worksheet** (0/15/20 breakpoints) and the 25%/28% buckets where flagged.
    - `rate_mode = 'effective'` is an override: rate × taxable income, labeled "override" everywhere.
12. **Credits:** **nonrefundable** (manual, capped at regular tax) and **refundable** (manual).
13. **Additional Medicare** (wages + NESE above the threshold, which is reduced by wages first). **NIIT** = rate × min(NII, MAGI − threshold). NII = interest, dividends, gains, rental, and passive or investment K-1 income, less allocable deductions.
14. Federal total = regular tax − nonrefundable + SE tax + Additional Medicare + NIIT − refundable.

AMT and the kiddie tax are out of scope. If the user flags AMT exposure, a warning line is shown.

#### State calculation
- Each Taxpayer has one **resident** state and zero or more **nonresident** states.
- Each state row holds:
  - `effective_rate` (user input; state brackets are a later phase);
  - `base` (`federal_agi` | `federal_taxable` | `custom` amount);
  - for nonresident rows, `sourced_income` (manual, or from linked entities/links tagged with that state).
- **Nonresident tax** = sourced income × rate.
- **Resident tax** = base × rate − **credit for taxes paid to other states**, where the credit = Σ min(other-state tax, resident rate × income sourced there).
- C corps: state rows use apportionment % × taxable income × rate.

#### Safe harbor, Schedule AI, vouchers, penalties
**Individual federal**
- Required annual payment options:
  - (a) `safe_harbor.current_pct` × current-year tax (Form 2210 definition: total above, net of refundable credits);
  - (b) `prior_pct` or `prior_pct_high_agi` × prior-year tax. The high-AGI test uses prior-year AGI. Option (b) is unavailable if the prior year was not 12 months or had no return; if prior-year tax was 0, no penalty applies.
- **Both are always shown.** The recommended rule = firm default (`prior_year` | `lesser_of`), with a per-Taxpayer override.
- **Schedule AI:**
  - Annualize actual tax-basis income through 3/31, 5/31, 8/31 and 12/31 (12/31 uses the projection), using the factors and applicable percentages from parameters.
  - Each installment = lesser of the regular or annualized amount, with recapture of any regular-method shortfall in later installments.
  - The annualized method is shown even when it isn't used.
- **Payments:**
  - From the GL (`estimated_tax_payment` accounts) plus manual entries. Prior-year overpayment counts as paid on the original due date.
  - Payments are applied to the **earliest unpaid required installment**.
  - Withholding is treated as paid evenly.
- **Penalty:** estimated §6654 accrual on each underpaid installment, from its due date to the earlier of the date paid or the projected due date of the next payment. Uses quarterly underpayment-rate parameters, with a note that it is an estimate.
- **Q4 relief note:** no Q4 penalty if the return is filed and the tax paid by Jan 31 (date from parameters).
- **Farmer/fisherman** (Sch F):
  - The gross-income test is met if gross farming income ≥ the parameter ratio of total gross income (joint), in the **current or prior year**. There is an override.
  - The required payment is the lesser of 66⅔% of current-year tax or 100% of prior-year tax. The 110% rule does not apply.
  - One installment due Jan 15. No penalty if filed and paid by Mar 1.
- **C corp:**
  - Installments are due the 15th of the 4th, 6th, 9th and 12th months; percentages come from parameters.
  - Required = lesser of 100% current or 100% prior. Prior-year is unavailable when the prior year was short or had $0 tax.
  - A **large corporation** may use prior-year for the first installment only, and the shortfall is **recaptured in the next installment**.
  - Schedule AI annualization for C corps uses the same engine with the C corp periods; the adjusted seasonal method is out of scope.
- **States:**
  - Per-state rule set from `state_estimate_rules`: required-payment threshold, safe-harbor %s (including whether a high-AGI rule exists), installment count, percentages and due dates, farmer rules, penalty rate.
  - A state without verified rules falls back to the federal pattern with a "verify" badge.

#### Scenarios, snapshots, standards
- Each Taxpayer-year has a Base scenario plus named clones, each holding a full copy of all inputs. Compare up to 3 scenarios.
- **Finalize** stores an immutable snapshot: inputs, results, engine version, resolved federal and state parameter set with statuses, readiness warnings, user and timestamp. This happens when vouchers are issued or a Report Pack is generated.
- The Report Pack page includes an **assumptions page**: rate mode, projection method and months used, non-recurring exclusions, GL reclass totals, adjustments list, safe-harbor rule chosen and why, state methods, unverified/provisional parameters, readiness warnings, and the firm disclaimer.
- Prior-year tax and AGI are **tax return information**. Mark them in the data dictionary and audit them like other return data (WISP / §7216 note in the docs).

#### Tax parameters
- **Federal:**
  - `tax_parameters` (tax_year, key) with source citation and status `verified` | `unverified` | `provisional`.
  - Firm overrides with a reason, audited.
  - **Create year from prior year** (copies as provisional, rolls dates forward with weekend/holiday adjustment, flags dates "verify").
  - **Missing-year fallback** (latest year, all provisional, with a banner).
  - **Shipped-vs-provisional diff** with "adopt shipped."
- **State:** `state_estimate_rules` (state, tax_year, key) with the same status, override, create-from-prior and fallback behavior.
- **Never hardcode** a rate, percentage, threshold, limit, date or dollar amount in engine code. The only allowed literals are structural (0, 1, 12, array indices). A guard test enforces this.

**Federal parameter keys.** `{fs}` = single | mfj | mfs | hoh | qss.
- **SE:** `se.nese_factor`, `se.min_nese`, `se.ss_rate`, `se.medicare_rate`, `se.ss_wage_base`, `se.deduction_factor`
- **Brackets:**
  - `brackets.{fs}` (array of [upper, rate])
  - `ltcg.breakpoints.{fs}` (0% / 15% upper bounds)
  - `ltcg.rates` ([0, 0.15, 0.20])
  - `collectibles_rate` (0.28), `unrecaptured_1250_rate` (0.25)
- **Medicare / NIIT:** `addl_medicare.rate`, `addl_medicare.threshold.{fs}`, `niit.rate`, `niit.threshold.{fs}`
- **Deductions:**
  - `std_deduction.{fs}`, `std_deduction.additional_65_blind.{unmarried|married}`
  - `salt.cap.{standard|mfs}`, `salt.phase_down.threshold.{standard|mfs}`, `salt.phase_down.rate`, `salt.floor.{standard|mfs}`
  - `charity.agi_floor_pct`, `itemized.benefit_cap_rate` (if applicable for the year)
- **Schedule 1-A:**
  - `sch1a.senior.amount`, `sch1a.senior.phaseout_threshold.{fs}`, `sch1a.senior.phaseout_rate`
  - `sch1a.tips.max`, `sch1a.tips.phaseout_threshold.{fs}`, `sch1a.tips.phaseout_rate`
  - `sch1a.overtime.max.{standard|mfj}`, `sch1a.overtime.phaseout_threshold.{fs}`, `sch1a.overtime.phaseout_rate`
  - `sch1a.car_interest.max`, `sch1a.car_interest.phaseout_threshold.{fs}`, `sch1a.car_interest.phaseout_rate`
  - `sch1a.first_year`, `sch1a.last_year`
- **QBI:**
  - `qbi.rate`, `qbi.threshold.{fs}`, `qbi.phase_in_range.{fs}`
  - `qbi.w2_wage_pct`, `qbi.alt_w2_wage_pct`, `qbi.ubia_pct`, `qbi.taxable_income_limit_pct`
  - `qbi.min_deduction_amount`, `qbi.min_deduction_active_qbi_threshold`
- **Losses:** `ebl.threshold.{standard|mfj}`
- **Retirement / HSA:**
  - `retirement.sep.pct_of_comp` (0.25), `retirement.sep.dollar_limit`, `retirement.comp_limit`
  - `retirement.401k.deferral`, `retirement.401k.catch_up_50`, `retirement.401k.catch_up_60_63`
  - `retirement.simple.deferral`, `retirement.simple.catch_up`
  - `hsa.limit.{self|family}`, `hsa.catch_up_55`
- **C corp:**
  - `ccorp.rate`, `ccorp.large_corp_threshold`, `ccorp.installment_months`, `ccorp.installment_pcts`
  - `ccorp.safe_harbor_current_pct`, `ccorp.safe_harbor_prior_pct`
- **Individual safe harbor:**
  - `safe_harbor.current_pct`, `safe_harbor.prior_pct`, `safe_harbor.prior_pct_high_agi`
  - `safe_harbor.high_agi_threshold.{standard|mfs}`, `safe_harbor.min_balance_due`
- **Installments:** `installments.due_dates`, `installments.pcts`, `installments.q4_file_and_pay_date`
- **Schedule AI:**
  - `sch_ai.period_ends` (["03-31","05-31","08-31","12-31"])
  - `sch_ai.annualization_factors` ([4, 2.4, 1.5, 1])
  - `sch_ai.applicable_pcts` ([0.225, 0.45, 0.675, 0.90])
  - the C corp equivalents under `ccorp.sch_ai.*`
- **Farmer:**
  - `farmer.gross_income_ratio`, `farmer.safe_harbor_current_pct`, `farmer.safe_harbor_prior_pct`
  - `farmer.single_due_date`, `farmer.file_by_date`
- **Penalty:** `penalty.underpayment_rate` (array of {from, to, rate} by quarter)
- **Dates:** `holidays` (federal + DC legal holidays)

**State rule keys** (`state_estimate_rules`, per state and year):
- `has_income_tax`, `required_threshold`
- `safe_harbor.current_pct`, `safe_harbor.prior_pct`, `safe_harbor.high_agi_rule` (null | {threshold, pct})
- `installments.due_dates`, `installments.pcts`
- `farmer.rule` (null | {ratio, current_pct, due_date, file_by})
- `penalty.rate_source` (`federal` | `state`), `penalty.rate`
- `credit_for_other_state` (yes/no)
- `holidays` (state holidays used for roll-forward)
- `source_citation`

Adjustment-catalog percentages (such as meals) are an editable `pct` on the adjustment type or account mapping. They are not tax parameters. Per-scenario inputs: effective-rate override, state effective rates, sourced income, credits.

#### Access
- Firm staff with bookkeeping edit permission can edit.
- A firm admin manages parameters, the safe-harbor default and the disclaimer.
- Portal users see a read-only summary and voucher schedule for linked Taxpayers only, from the latest finalized snapshot by default. They never see other owners, adjustments, rates or traces.

### Engineering rules
- **Engine:** a pure, deterministic TypeScript module (`tax-estimator/engine`) with no DB or IO. Typed input DTO in; typed result out, with a line-by-line **trace** (label, amount, formula, source: `gl` | `gl_map` | `adjustment` | `parameter` | `state_rule` | `input`). The trace drives the UI drill-down, the assumptions page and the PDF.
- **Money:** use the repo's decimal approach, or `decimal.js` if there is none. Never use floats for money. Round to whole dollars, half-up, only at final per-line amounts.
- **Tests:**
  - Unit tests for every engine function.
  - **Golden tests must match `docs/reference-calc/rivera_expected.json`.** That file is produced by the independent oracle `docs/reference-calc/rivera_fixture.py`. If the engine and the oracle disagree, investigate both; never edit the expected file to make a test pass without a QUESTIONS.md entry.
- Drizzle migrations must be reversible. Table prefix `tax_est_`, except `tax_parameters*`, `state_estimate_rules*` and `taxpayers*`.
- API under `/api/tax-estimator/...` using the existing router, auth and tenant middleware.
- Conventional commits (`feat(tax-est): …`). One per logical step, and at least one per phase.
- **UI reference:** `docs/ui-mockups/UI-SPEC.md` + `docs/ui-mockups/html/`. They define layout, content, states and interactions. Styling comes from the existing MyBooks component library.
- Do not modify unrelated modules, except integration hooks: Report Pack registry, portal nav, permission registry, account settings (tax-treatment map) and entity settings (tax fields).


---

# Part 2 — Agents, models and parallel work
_Binding. Formerly ORCHESTRATION.md._

How the build is split across Claude Code subagents and models so the hard tax logic gets the strongest model and everything else runs on cheaper, faster ones. CLAUDE.md rules still apply to every agent. This file decides **who does the work and on which model**.

### 1. Setup (Phase 0, step 1)
1. Create each Appendix A block as a file in the **repo root** `.claude/agents/`, and merge Appendix B into the repo's `.claude/settings.json`. Subagents are only discovered from the project's root `.claude/`.
2. Use Claude Code 2.1.255 or later (needed for Fable 5.1).
3. Start the orchestrating session with `claude --model opusplan`: Opus plans each phase in plan mode, then Sonnet executes.
4. Run `/agents` and confirm the 12 agents below are listed with their models.

### 2. Model tiers — when to use which

| Tier | Model (alias) | Effort | Use for | Never use for |
|---|---|---|---|---|
| T0 | `haiku` | low | Read-only repo search, file inventories, docs formatting, changelog/STATE.md bookkeeping | Writing app code; anything tax-related |
| T1 | `sonnet` | medium | Migrations, CRUD routes/services, React screens from mockups, seed-file typing, unit tests written from a spec, state-rule web research | Engine math, deciding tax treatment, reconciling disagreements with the oracle |
| T2 | `opus` | high | Phase planning (via `opusplan`), P&L provider + GL map, parameter verification, state-rule audits, snapshot/assumptions logic, code review, debugging outside the engine | Bulk CRUD/UI (wasteful) |
| T3 | `fable` | xhigh | The calculation engine (Phases 6–10), oracle disagreements, and **deep reviews of complex processes** (§5) | Anything a lower tier can do — Fable is capped at 50% of the weekly Max limit and uses it faster |

#### Complexity routing rule
Score each task before delegating. **Use the lowest tier whose row matches.**

| Signal | Tier |
|---|---|
| Only reads or searches files | T0 |
| Follows an existing repo pattern, the spec states exactly what to build, and no tax judgment is involved | T1 |
| Touches more than one module, requires choosing among designs, or maps books to tax character | T2 |
| Implements an IRC/Form-2210/1040 computation, ordering, limit or interaction; or any engine-vs-oracle mismatch | T3 |
| Reviews a finished multi-step process where an error would produce wrong tax or expose client data (§5 checkpoints) | T3 review |

#### Escalation ladder (automatic)
- A T1 agent that fails the same test **twice**, or has to make a design choice not in the spec, stops and returns `ESCALATE: <reason>`. The orchestrator re-runs the task on T2.
- A T2 agent that hits tax-law ambiguity or an oracle mismatch returns `ESCALATE` → T3.
- A T3 agent that cannot resolve a mismatch writes a QUESTIONS.md entry (BLOCKING if the expected value may be wrong) and moves on.
- **De-escalate:** once T3 has written an engine function and its tests pass, any follow-on refactors, renames or wiring go back to T1.

#### Fable budget guard
- Only `tax-engine-architect`, `oracle-verifier` and `fable-process-reviewer` may run on `fable`. No other agent and no main session uses it.
- Priority when the cap is tight: (1) oracle mismatches, (2) §5 critical-path reviews R1–R4, (3) engine authoring, (4) other reviews. Engine authoring can fall back to `opus` + `ultrathink`. Reviews should **wait for the reset** rather than downgrade, because a review on a weaker model can't be trusted to catch what the strong model would have built wrong.
- Log Fable sessions in STATE.md → "Usage log". If the weekly Fable cap is reached:
  - switch both agents to `opus` by passing `model: opus` per invocation, or by editing their frontmatter;
  - add `xhigh` effort and the word `ultrathink` in the delegation prompt for engine functions;
  - log the swap, and re-run the oracle verifier on Fable when the cap resets.

### 3. Agents (definitions in Appendix A)

| Agent | Model | Effort | Isolation | Owns (write scope) | Phases |
|---|---|---|---|---|---|
| `repo-scout` | haiku | low | — (read-only) | none | 0, ad hoc |
| `schema-builder` | sonnet | medium | — | `server/**/tax-estimator/db/**`, migrations | 1, 2, 3, 4, 5, 7, 10, 12 |
| `api-builder` | sonnet | medium | — | `server/**/tax-estimator/{routes,services}/**` (except the P&L provider) | 1–5, 10, 12, 13 |
| `ui-builder` | sonnet | medium | worktree | `client/**/tax-estimator/**` | 1, 2, 3, 4, 5, 11, 12, 13 |
| `state-rules-researcher` | sonnet | medium | worktree, background | `server/**/tax-estimator/db/seeds/state-rules/**` | 2 |
| `tax-law-researcher` | opus | high | — | `server/**/tax-estimator/db/seeds/federal/**`, QUESTIONS.md | 1, 2 (audit) |
| `books-integration-engineer` | opus | high | — | P&L provider, readiness service, account map service | 4 |
| `tax-engine-architect` | **fable** | xhigh | — | `server/**/tax-estimator/engine/**` | 6, 7, 8, 9, 10 |
| `oracle-verifier` | **fable** | high | — (read-only + run tests) | `docs/reference-calc/**` (new oracles only), test reports | 6–10, 14 |
| `test-writer` | sonnet | medium | — | `**/__tests__/**` outside golden tests | 1–13 |
| `phase-reviewer` | opus | high | — (read-only) | review notes in STATE.md | end of every phase |
| `fable-process-reviewer` | **fable** | xhigh | — (read-only) | `docs/reviews/**` | §5 checkpoints |

**Ownership rule.** Only the owning agent writes inside its scope. Cross-scope changes go back through the orchestrator. This prevents parallel agents from colliding, and worktree merges stay clean.

**Independence rule.** The agent that writes engine code never edits golden expected files or oracles. `oracle-verifier` checks the engine without having written it, so the work isn't grading itself.

### 4. Phase-by-phase routing and parallel waves

| Phase | Orchestrator | Lead agent (model) | Helpers in parallel | Gate before merge |
|---|---|---|---|---|
| 0 Discovery | opusplan | `repo-scout` ×3 (haiku): backend / frontend / infra | — | Repo map in STATE.md |
| 1 Federal params | opusplan | `tax-law-researcher` (opus) for seeds; `schema-builder` + `api-builder` (sonnet) | `ui-builder` (sonnet, worktree) builds the admin screen | Completeness + guard tests; `phase-reviewer` |
| 2 State rules | opusplan | `state-rules-researcher` (sonnet, background, worktree) in **5 batches of ~8 states**, max 3 concurrent | `tax-law-researcher` (opus) **audits each batch** before it merges | Every row cited; MO/AR verified by audit; **R5** |
| 3 Taxpayers | opusplan | `schema-builder`, `api-builder` (sonnet) | `ui-builder` (worktree) | CRUD, tenant isolation tests |
| 4 Entity setup | opusplan | `books-integration-engineer` (opus) | `schema-builder`, `ui-builder` (sonnet) | Rivera books 115,400 → 128,000; **R1** |
| 5 Settings | opusplan | `schema-builder`, `api-builder` (sonnet) | `ui-builder`, `test-writer` | Allocation + cloning tests |
| 6 Engine core | **plan mode on opus, then delegate** | `tax-engine-architect` (fable) | `test-writer` (sonnet) writes unit tests **from CLAUDE.md before** each function; `ui-builder` starts Phase 11 screens against the engine's typed result DTO, with fixture data | `oracle-verifier` (fable) |
| 7 QBI/NIIT/losses | same | `tax-engine-architect` | `test-writer` | `oracle-verifier`; **R2** |
| 8 State engine | same | `tax-engine-architect` | — | `oracle-verifier` |
| 9 C corp / Sch F | same | `tax-engine-architect` — **may run in a second session in parallel with Phase 8** (separate engine modules) | `test-writer` | `oracle-verifier` |
| 10 Payments / Sch AI | same | `tax-engine-architect` | `schema-builder`, `api-builder` for payment tables/GL reader | `oracle-verifier`; **R3** |
| 11 UI | opusplan | `ui-builder` (sonnet), finishing what started in Phase 6 | `test-writer` | `phase-reviewer` + manual QA list |
| 12 Snapshots | opusplan | `api-builder` (sonnet); assumptions block by `books-integration-engineer` (opus) | `ui-builder` | Snapshot immutability test; **R6** |
| 13 Report Pack / portal | opusplan | `api-builder`, `ui-builder` (sonnet) | — | Portal isolation test; **R4** |
| 14 Hardening | opusplan | `oracle-verifier` (fable) writes the 7 new oracles; `test-writer` (sonnet) wires them | `repo-scout` (haiku) for docs inventory | Full suite; **R7** final tax-logic audit |

#### Wave timeline
```
Wave 1  Phase 0 ──► Phase 1
Wave 2  Phase 2 (background, batches) ───────────────────────────────►
        Phase 3 ∥ Phase 4 backend (separate worktrees) ──► Phase 5
Wave 3  Phase 6 ──► Phase 7 ──► Phase 8 ∥ Phase 9 ──► Phase 10
        └─ ui-builder builds Phase 11 screens against the DTO in parallel
Wave 4  Phase 11 finish ──► Phase 12 ──► Phase 13 ──► Phase 14
```

### 5. Fable deep reviews
`phase-reviewer` (opus) checks each phase against its checklist. `fable-process-reviewer` does something different: it traces a **whole process across phases** and tries to break it with adversarial cases. Run each checkpoint **once, after that process's tests are green**, and run a re-review only on the fix diff.

| ID | Process reviewed | When | Why it needs Fable |
|---|---|---|---|
| R1 | **Books → tax-basis income**: P&L on the tax method, GL tax-treatment map, owner reclasses, non-recurring exclusion, run-rate projection, readiness | End of Phase 4, re-check after Phase 6 | Double counting or dropped items here silently corrupt every number downstream |
| R2 | **Owner allocation & character**: profit/loss %, guaranteed payments, officer wages, activity type → SE / QBI / NII / passive / EBL | End of Phase 7 | Interacting rules; tests cover single paths, not the combinations |
| R3 | **Payments → safe harbor → Schedule AI → installment application → penalty → vouchers** (federal + state rules) | End of Phase 10 | Form 2210 ordering, recapture, earliest-installment application and date roll-forward are easy to get subtly wrong |
| R4 | **End-to-end Rivera + one seasonal client**: books → engine → summary UI → snapshot → assumptions page → Report Pack PDF → portal | End of Phase 13 | Confirms every surface shows the same numbers, the trace and assumptions match, and the portal shows nothing it shouldn't |
| R5 | **State rules sample audit**: 5 random non-MO/AR states and every state whose rule pattern differs from the federal one | End of Phase 2 (after the opus batch audits) | Second-opinion check on the largest research-driven data set |
| R6 | **Parameter lifecycle**: seed → override → create-from-prior → shipped-vs-provisional diff → missing-year fallback → snapshot of resolved parameters | End of Phase 12 | Year rollover mistakes only show up a year later |
| R7 | **Final tax-logic audit** of `engine/**` against CLAUDE.md and the authorities, with the full golden suite | Phase 14 gate | Last line of defense before release; replaces running `phase-reviewer` on Fable |

**Keeping reviews affordable:**
- Give the reviewer the process's file list or diff and the relevant spec sections only. It may trace further calls, but should not read the whole repo.
- Run each checkpoint once; re-review only the fix diff.
- Findings go to the owning agent at the lowest tier that can fix them. Fable reviews; it doesn't fix.
- Expected Fable use for R1–R7 is about 7–10 sessions in total, which is small next to engine authoring.

### 6. Context and hand-off discipline (saves the most usage)
- **New session per phase.** Start each phase with `/clear`. The orchestrator re-reads only CLAUDE.md, ORCHESTRATION.md, this phase's section of PHASES.md, STATE.md and QUESTIONS.md.
- **Subagents return summaries, not dumps.** Every delegation prompt ends with: "Return ≤ 250 words: files changed, tests run and results, open issues, ESCALATE if needed." Full detail goes in the commit and in `docs/agent-handoffs/phase-NN.md`.
- **Scope prompts tightly.** Name the exact files, the CLAUDE.md section, the acceptance test and the mockup file. Never send "build Phase N" to a T1 agent.
- **Repo reading goes through `repo-scout`** (haiku), so expensive models don't spend tokens on file discovery.
- **Batch small T1 tasks** (e.g. all CRUD routes for one table group) into one delegation rather than one call per file.
- **Worktree merges** are done by the orchestrator after the gate passes. A conflicting merge goes back to the owning agent.

### 7. Usage estimate by tier (from the v2 estimate of ~60–120M tokens processed)

| Tier | Share of tokens | Notes |
|---|---|---|
| Haiku | ~5% | Discovery, docs, bookkeeping |
| Sonnet | ~55% | CRUD, UI, tests, state research |
| Opus | ~17% | Planning, GL map/P&L provider, audits, phase reviews |
| Fable | ~23% | Engine Phases 6–10 (~17%), oracle verification and deep reviews R1–R7 (~6%) — sized to stay under the 50% weekly Fable cap on Max 20x when spread across 2–3 weeks |

Record actual sessions per phase and model in STATE.md → "Usage log" to tune these shares for future Vibe builds.


---

# Part 3 — Phases
_Formerly PHASES.md._

Complete phases in order, except where ORCHESTRATION.md §4 allows parallel waves: Phase 2 runs in the background alongside Phases 3–8; Phases 3 and 4 run in separate worktrees; Phase 9 may run alongside Phase 8; Phase 11 UI starts against the engine DTO during Phase 6. Each phase's **Agents** line is binding; see ORCHESTRATION.md for models and escalation. Each phase ends with passing tests, lint/typecheck clean, a conventional commit, and a STATE.md update.

---

### Phase 0 — Discovery and scaffolding
**Agents:** orchestrator (opusplan) · `repo-scout` ×3 in parallel (haiku: backend / frontend / infra) · scaffolding by `schema-builder` + `api-builder` (sonnet).
- **Agent setup first:**
  - create the Appendix A agents in the repo root `.claude/agents/` and merge Appendix B into `.claude/settings.json`;
  - create living `STATE.md` and `QUESTIONS.md` beside BUILD-PLAN.md from Parts 6 and 4;
  - confirm Claude Code ≥ 2.1.255;
  - run `/agents` to verify all 12 agents.
- Write a **Repo map** in STATE.md covering:
  - entity/client tables and tenant scoping;
  - chart of accounts and account types;
  - the P&L service, and **whether it supports cash and accrual basis**;
  - **bank/credit-card reconciliation status** (closed-through month per account);
  - transactions (can a flag be added?);
  - fiscal calendar (including 4-4-5);
  - money/decimal utilities;
  - permission registry, audit log, Report Pack registry and PDF renderer;
  - portal user model;
  - migrations, test framework, UI kit.
- Note any existing entity tax-type, tax-method or account-classification fields.
- Scaffold `server/.../tax-estimator/{engine,services,routes,db}` and `client/.../tax-estimator/`. Add feature flag `taxEstimator`, on for all tiers.
- Copy `docs/reference-calc/` into the repo and wire `python3 docs/reference-calc/rivera_fixture.py` into a test script to regenerate the expected JSON.

**Acceptance:** repo map written; scaffolding compiles; the oracle runs.

### Phase 1 — Federal tax parameters
**Agents:** `tax-law-researcher` (opus) for seeds and verification · `schema-builder` + `api-builder` (sonnet) for tables, registry and service · `ui-builder` (sonnet, worktree) for the admin screen in parallel · `test-writer` (sonnet) · gate: `phase-reviewer` (opus).
- Tables `tax_parameters` and `tax_parameter_overrides` (status `override` | `provisional`, reason, created_from_year).
- **Registry** `engine/parameterKeys.ts` containing **every federal key in CLAUDE.md**, with type, unit and filing-status expansion. The engine reads only through the registry.
- **Seed 2025 and 2026 for every key.** Verify against Rev. Proc. 2024-40 / 2025-32, OBBBA, the SSA announcement, IRS retirement/HSA notices, Forms 1040-ES / 2210 / 1120-W and the quarterly underpayment-rate news releases. Anything unverifiable is seeded `unverified` and listed in QUESTIONS.md.
- `getParameters(firmId, year)`: resolves override/provisional → seed → missing-year fallback, and returns statuses, `isFallback` and `fallbackYear`. Add a completeness check.
- **Admin UI** (`html/04-tax-parameters-admin.html`, UI-SPEC §04):
  - year tabs and a **Federal | States** switch;
  - grouped table, override/revert;
  - **Create year from prior year**;
  - shipped-vs-provisional diff;
  - recent changes.
- **Guard test** against numeric and date literals in `engine/`, plus ESLint `no-magic-numbers` scoped to `engine/`.

**Acceptance:** seeds complete for both years; resolution, override, provisional, fallback and diff are tested; guard passes; audit entries written.

### Phase 2 — State estimate rules (all 41 income-tax states) — parallel-safe
**Agents:** `state-rules-researcher` (sonnet, background, worktree) in 5 batches of ~8 states, max 3 running at once, MO + AR in batch 1 · `tax-law-researcher` (opus) audits each batch before merge · `schema-builder` / `ui-builder` (sonnet) for tables and the States view · gate: every row cited, MO/AR audit pass · then **R5** state sample review (`fable-process-reviewer`).
- Tables `state_estimate_rules` and `state_estimate_rule_overrides`, with the keys from CLAUDE.md, plus a state registry.
- **Seed MO and AR first, fully verified.** Then seed every remaining state with a broad personal income tax for 2025 and 2026, from each state's estimated-payment instructions. Also record `has_income_tax=false` states and the interest/dividend-only states.
- Each state row carries `source_citation` and a status. Anything unverified gets `unverified` and appears in QUESTIONS.md under "State rules to verify".
- The same resolution, override, create-from-prior and fallback behavior as federal. A state without rules falls back to the federal pattern, marked `verify`.
- Admin UI: the **States** view on the parameters screen (state list with status counts; per-state detail with the same table pattern).

**Acceptance:** all 41 states present for both years; MO/AR verified; every row cited; fallback tested.

### Phase 3 — Taxpayers, persons, links
**Agents:** `schema-builder` + `api-builder` (sonnet) · `ui-builder` (sonnet, worktree) · `test-writer` · runs in parallel with Phase 4's backend in a separate worktree · gate: `phase-reviewer`.
- Taxpayers: filing status, resident state.
- Persons: role, name, date of birth (for the 65 test and catch-up eligibility), blind flag, **SEHI eligibility by month**.
- Links: `profit_pct`, `loss_pct`, `capital_pct`, `partner_se_status` + memo, `is_officer`, `activity_type`, `qbi_eligible` (+ override reason), `allowed_loss_override` (+ reason), and the tax year.
- Validation:
  - profit % and loss % across an entity's links ≤ 100% (warn if under);
  - `limited` only for partnerships; officer only for S corps;
  - `rental` activity defaults `qbi_eligible` from the entity's `rental_qbi_trade_or_business`.
- CRUD API + UI (Taxpayer detail with persons and links; an "Owners & activity" section on Entity tax setup).
- Portal user ↔ Taxpayer mapping.

**Acceptance:** CRUD, validation and tenant isolation tests pass.

### Phase 4 — Entity tax setup: method, GL tax-treatment map, non-recurring, readiness
**Agents:** `books-integration-engineer` (opus) for the P&L provider, account-map, readiness and cache · `schema-builder` (sonnet) for tables and columns · `ui-builder` (sonnet, worktree) for screen 06 · `test-writer` · gate: `phase-reviewer` + **R1** books→tax review (`fable-process-reviewer`; re-checked after Phase 6).
- **Entity fields:** `tax_entity_type`, `tax_method`, `is_sstb`, `large_corporation`, `farmer_override`, `rental_qbi_trade_or_business`, `state_sourcing` (default state for nonresident sourcing).
- **`tax_est_account_map`** (entity_id, account_id, tax_treatment, pct, payment_taxpayer_id, payment_person_id, payment_jurisdiction, non_recurring). Provide suggested defaults by account type and name pattern (e.g. "meals" → nondeductible 50%; "owner health" → owner_sehi; "estimated tax" → estimated_tax_payment). **Suggestions are never auto-applied without confirmation.**
- **Transaction-level `non_recurring` flag**: add a column, or a side table if the transactions table can't be altered.
- **P&L provider service:**
  - P&L by entity and month **on the entity's tax method**;
  - applies the map and returns tax-basis lines by character;
  - returns owner-level reclass amounts (SEHI, retirement) and estimated-payment transactions;
  - returns recurring vs. non-recurring split and GL actuals for linked adjustments;
  - returns gross farming income for the farmer test (current and prior year).
- **Readiness service:** last closed month (all bank/CC accounts reconciled), unreconciled accounts in range, suspense/uncategorized balances, unmapped accounts with activity, missing tax fields.
- **UI:** Entity tax setup screen (`html/06-entity-tax-setup.html`, UI-SPEC §06).
- Redis cache of month aggregates, invalidated on posting, reconciliation, or map changes.

**Acceptance:** for the Rivera Plumbing fixture, books 115,400 → tax-basis profit 128,000 with an SEHI reclass of 10,800 and a meals add-back of 1,800. The non-recurring exclusion is tested. Readiness is tested.

### Phase 5 — Annual settings, scenarios, adjustments
**Agents:** `schema-builder` + `api-builder` (sonnet) · `ui-builder` (sonnet, worktree) · `test-writer` · escalate itemized/Schedule 1-A input validation questions to opus · gate: `phase-reviewer`.
- `tax_est_years`:
  - prior-year tax and AGI; prior-year flags (12-month, filed);
  - safe-harbor rule override (null = firm default);
  - rate mode (`brackets` default) and effective-rate override;
  - deduction mode (auto | standard | itemized);
  - itemized detail (SALT paid, mortgage interest, charitable cash/non-cash, other);
  - Schedule 1-A inputs per person (qualified tips, qualified overtime, car-loan interest);
  - nonrefundable and refundable credits;
  - HSA coverage type per person.
- `tax_est_scenarios` (Base is auto-created; clone copies every child row).
- `tax_est_adjustment_types` (seeded catalog + firm custom; flags from v1 plus `is_capital_gain_lt`, `is_capital_gain_st`, `is_qualified_dividend`, `is_reit_dividend`, `is_ptp`, `is_1231`, `non_recurring`; editable `pct`). Meals and owner items now normally come from the GL map. The adjustments catalog keeps them for books outside MyBooks.
- `tax_est_adjustments` (v1 fields + `non_recurring`).
- `tax_est_state_rows` (scenario, residency `resident` | `nonresident`, state, effective rate, base, sourced income (manual or derived), memo).
- Firm settings: **safe-harbor default rule** and **disclaimer text**.
- Allocation module (pure) as in v1.
- UI: Annual settings (`html/02-annual-settings.html`, UI-SPEC §02).

**Acceptance:** allocation, cloning, itemized-vs-standard selection and state-row validation (exactly one resident) are tested.

### Phase 6 — Engine core: federal income tax
**Agents:** orchestrator plans in plan mode (opus), then delegates · `tax-engine-architect` (**fable**, xhigh) · `test-writer` (sonnet) writes each function's tests first · `ui-builder` starts Phase 11 screens against the result DTO in a worktree · gate: `oracle-verifier` (**fable**) + `phase-reviewer`.
- **Range and projection:** snap to whole months; tax year boundaries; recurring run-rate with non-recurring excluded.
- **Steps 1–2 and 4–8, 10–12, 14** from CLAUDE.md:
  - character-aware income;
  - profit/loss allocation;
  - SE tax per person;
  - **retirement/HSA/SEHI limits with caps and warnings**;
  - AGI;
  - standard (with 65/blind) vs. itemized (SALT cap and phase-down);
  - Schedule 1-A with phase-outs;
  - **bracket tax with the QD/LTCG worksheet**;
  - effective-rate override;
  - nonrefundable (capped) and refundable credits.
- The trace includes the marginal rate.

**Acceptance:**
- The Rivera **base** matches the oracle for every line up to the federal total, excluding QBI until Phase 7 (stub QBI from the fixture input).
- Truck scenario: **SEP capped at 12,639** with a warning.
- A test where the effective-rate override replaces bracket tax.
- An LTCG worksheet test across the 0/15/20 breakpoints.
- An SEHI eligibility test (eligible months zero the deduction).

### Phase 7 — QBI, Additional Medicare, NIIT, loss limitations
**Agents:** `tax-engine-architect` (fable) · `test-writer` (sonnet) · gate: `oracle-verifier` (fable) + **R2** allocation & character review (`fable-process-reviewer`).
- QBI full (CLAUDE.md step 9), including REIT/PTP, the qualified-dividend-inclusive net capital gain in the overall limit, and the minimum deduction.
- Additional Medicare and NIIT, with NII from character and activity type. Passive or rental K-1 income counts as NII.
- **Loss limitations:** passive vs. nonpassive netting with suspended amounts shown; §461(l) excess business loss with an NOL note; `allowed_loss_override`.

**Acceptance:**
- The Rivera base and all three scenarios match the oracle through the **federal total**. The LP rental is excluded from QBI and included in NII.
- QBI tests: below threshold, in the phase-in, above threshold (SSTB and non-SSTB), loss netting, minimum deduction.
- NIIT test above the threshold with passive income.
- Passive loss suspended against active income; EBL test.

### Phase 8 — State engine
**Agents:** `tax-engine-architect` (fable) · gate: `oracle-verifier` (fable). May run alongside Phase 9 in a second session.
- Resident/nonresident calculation with the credit for other-state tax (CLAUDE.md "State calculation"). Sourced income is derived from links/entities tagged with a state, or manual. C corp apportionment.

**Acceptance:**
- Rivera: **MO resident 7,902 gross − 312 AR credit = 7,590; AR nonresident 312; state total 7,902.**
- A test where the other-state rate is higher than the resident rate, so the credit is limited to the resident rate.

### Phase 9 — C corp and Sch F
**Agents:** `tax-engine-architect` (fable; a second session may run it alongside Phase 8 — separate engine modules) · `test-writer` · gate: `oracle-verifier` (fable).
- C corp path: entity-level tax with brackets → `ccorp.rate`; fiscal-year installments; large-corp first-installment rule **with recapture**; no prior-year option when the prior year was short or had $0 tax; state apportionment.
- Sch F farmer test (current **or** prior year, joint gross income, override); 66⅔% rule; single installment; Mar 1 note; fishermen use the same rules (flag).

**Acceptance:** an FYE-June C corp fixture (large-corp recapture case); a farmer qualifying on the prior year only; a non-qualifying farmer falling back to the regular rules.

### Phase 10 — Payments, safe harbor, Schedule AI, vouchers, penalties
**Agents:** `tax-engine-architect` (fable) for safe harbor, Sch AI, application and penalty math · `schema-builder` + `api-builder` (sonnet) for payment tables and the GL payment reader · gate: `oracle-verifier` (fable) + **R3** payments→vouchers review (`fable-process-reviewer`).
- `tax_est_payments` (manual + GL-derived from `estimated_tax_payment` accounts, deduplicated by transaction id). Prior-year overpayment is entered as paid on the due date.
- Safe harbor: both rules computed; recommendation from firm default or override; prior-year availability rules; min balance due.
- **Schedule AI**: annualize actual tax-basis income through each period end (the projection is used for 12/31), compute annualized tax with the same engine, and apply applicable percentages. Each installment = lesser of regular or annualized, with recapture.
- Payments are applied to the **earliest unpaid installment**. Withholding is treated as even.
- **§6654 penalty estimate** per installment, using the quarterly rate parameters.
- Q4 file-and-pay note; farmer Mar 1 note.
- **State vouchers** from `state_estimate_rules` (threshold, safe harbor, installment %/dates, penalty rate).

**Acceptance:**
- Rivera: required 32,246 (lesser of); 110% prior 34,650 shown; installment 8,062; Q1 +38 and Q2 +77 carried; **Q3 short 485, penalty ≈ $11**; **Q4 7,046**.
- MO per-installment 1,208. AR none required (under threshold).
- A **seasonal fixture** (Phase 14) where Schedule AI lowers the early installments.

### Phase 11 — UI: summary and scenarios
**Agents:** `ui-builder` (sonnet), finishing screens started in Phase 6 · `test-writer` · escalate trace or warning-presentation logic to opus · gate: `phase-reviewer` + manual QA list.
- Build to `html/01-estimate-summary.html` and `html/03-scenario-compare.html` (UI-SPEC §01, §03), plus every item in "States to build that the mockups don't show."
- The summary shows **YTD tax-basis amounts for income and adjustment lines and the full-year projection**. There is no "period tax" column.
- Readiness banner; the safe-harbor card shows both rules and which one is recommended; Schedule AI and penalty columns in the voucher table; the marginal-rate tile.
- Scenario compare with marginal rate and safe-harbor rows.

**Acceptance:** component tests; manual QA checklist in STATE.md.

### Phase 12 — Snapshots, assumptions, disclaimer, audit
**Agents:** `api-builder` + `schema-builder` (sonnet) for snapshots and audit hooks · `books-integration-engineer` (opus) for the assumptions block · `ui-builder` · gate: `phase-reviewer` + **R6** parameter lifecycle review (`fable-process-reviewer`).
- `tax_est_snapshots`: immutable; stores the resolved federal and state parameters with statuses, the readiness warnings, the assumptions block and the disclaimer text in effect.
- Finalize action; snapshot history; read-only snapshot view; compare with live.
- **Assumptions block** generated from the trace (CLAUDE.md "Scenarios, snapshots, standards").
- Audit hooks on settings, adjustments, account map, links, payments, parameter/state-rule overrides, firm defaults and disclaimer changes.
- Data dictionary: prior-year tax and AGI tagged as tax return information.

**Acceptance:** a snapshot stays unchanged after any input or parameter change; the assumptions block is complete for the fixture.

### Phase 13 — Report Pack and portal
**Agents:** `api-builder` + `ui-builder` (sonnet) · gate: `phase-reviewer` (portal isolation test) + **R4** end-to-end review (`fable-process-reviewer`).
- "Tax Estimate" Report Pack page: summary, safe harbor (both rules), voucher schedules by jurisdiction, **assumptions page**, optional condensed trace, firm disclaimer. Generating it creates a snapshot.
- Portal (`html/05-client-portal-phone.html`): read-only, latest snapshot by default (`portal_shows` setting); payments by jurisdiction, year total, history, voucher download; firm disclaimer.

**Acceptance:** PDF for each entity type; portal isolation test.

### Phase 14 — Hardening
**Agents:** `oracle-verifier` (fable) writes the 7 new oracles · `test-writer` (sonnet) wires the golden suite · `api-builder` (sonnet) for performance/cache · `repo-scout` (haiku) for the docs inventory, with docs written by `api-builder` · final gate: **R7** tax-logic audit of the engine by `fable-process-reviewer`.
- **Golden suite:**
  1. Rivera (oracle JSON, all scenarios);
  2. a **seasonal Sch C** (Schedule AI benefit);
  3. a fiscal-year C corp with large-corp recapture;
  4. a farmer qualifying on the prior year;
  5. a high-income MFJ case (110% rule, additional Medicare, NIIT, QBI in phase-in, SALT phase-down, LTCG at 15/20%);
  6. a passive-loss + EBL case;
  7. a senior couple with Schedule 1-A;
  8. a multistate case with a higher-rate source state.
- Extend `rivera_fixture.py`, or add sibling oracles, for each case.
- Performance: under 500 ms for 10 entities × 24 months, using the cache.
- Docs `docs/tax-estimator.md`: user guide; calculation reference generated from the registry; GL tax-treatment map guide; annual federal and state update procedure; the WISP/§7216 note on prior-year return data.
- Clear out QUESTIONS.md, moving deferred items to the backlog.

**Acceptance:** full suite green; docs complete; STATE.md marks the feature complete.

---

### Backlog (do not build now)
State bracket tables; AMT; kiddie tax; full basis/at-risk tracking by year; the $25k rental allowance computation; QBI aggregation and carryforward across years; PTET; local taxes; adjusted seasonal installment method (C corp); tax provision journal entries; carrying the estimate forward into next year's prior-year inputs; preparer/reviewer sign-off workflow.


---

# Part 4 — Open questions and items to verify
_Seeds the living `QUESTIONS.md` created in Phase 0._

Format: question → **default taken** → status. Take the default, log it in STATE.md, and continue unless the item is marked BLOCKING.

### Open — defaults pre-selected (Kurt to confirm when convenient)
1. **Quarterly adjustment allocation**: ÷3 across the quarter's months, or entirely in the quarter-end month? → **÷3.** Open.
2. **QBI loss carryforward** across years: out of scope? → **Yes, out of scope. Netting within the year only; a prior-year carryforward is entered as a manual adjustment.** Open.
3. **S corp >2% shareholder health insurance**: modeled as officer W-2 wages (no FICA) plus an SEHI deduction, subject to the monthly eligibility flags? → **Yes.** Open.
4. **Withholding timing**: always treated as even, with the actual-date election deferred? → **Yes.** Open.
5. **Portal default view**: latest snapshot or live? → **Latest snapshot; the firm can switch per Taxpayer.** Open.
6. **Mid-year ownership changes**: per tax year only? → **Yes. Enter a weighted %.** Open.
7. **Individuals** are always calendar year. → **Yes.** Open.
8. **Firm safe-harbor default** on install: `lesser_of` or `prior_year`? → **`prior_year`.** It is the conservative CPA default; the Rivera fixture overrides to `lesser_of` so it can show both. Open.
9. **Passive rental $25k allowance** (§469(i)): not computed in v1? → **Not computed. Passive losses are suspended unless `allowed_loss_override` is entered.** Open.
10. **Charitable 0.5% floor and 35% itemized benefit cap** (OBBBA, 2026+): include in the itemized calculation? → **Yes, when the parameters are seeded for the year.** Open.
11. **Nonresident sourced income** for K-1s: derived from the entity's `state_sourcing` × the person's share? → **Yes, with a manual override per state row.** Open.
12. **Unmapped GL accounts with activity**: treat as ordinary and warn? → **Yes.** Open.

### Parameters to verify (Phase 1)
Verified while reviewing this plan (re-confirm against primary sources when seeding):
- 2026 SS wage base $184,500.
- 2026 standard deduction MFJ $32,200 / single $16,100 / HOH $24,150.
- 2026 §199A threshold $403,500 MFJ ($201,750 single), phase-in end $553,500 MFJ.
- 2026 EBL threshold $512,000 MFJ.
- 2026 MFJ brackets (24,800 / 100,800 / 211,400 / 403,550 / 512,450 / 768,700).
- 2026 0% LTCG breakpoint MFJ $98,900.

Still to verify:
- 2026 LTCG 15% upper breakpoint (all statuses).
- Schedule 1-A amounts, phase-outs and years.
- SALT cap, phase-down and floor for 2026.
- Charitable floor and the 35% benefit cap.
- 2026 retirement limits (401(k) deferral, catch-ups including ages 60–63, SIMPLE, SEP dollar limit, compensation limit) and 2026 HSA limits.
- QBI minimum deduction ($400 / $1,000 active QBI) — first year it applies.
- Quarterly underpayment rates for 2026 (the oracle uses 7% as a placeholder).
- Federal legal holidays for 2026–2028.

### State rules to verify (Phase 2)
- MO: required threshold, safe harbor (90% current / 100% prior — is there a high-AGI rule?), due dates, penalty rate.
- AR: required threshold (the oracle assumes AR tax of $312 is under it), safe harbor, due dates.
- Every other income-tax state: listed here as each one is seeded `unverified`.

### Resolved
- v1 → v2 decisions (Oct 8, 2026):
  - bracket mode is the default, with effective rate as an override;
  - resident/nonresident state model with credit;
  - safe-harbor firm default with per-Taxpayer override;
  - Schedule AI in v1 replaces the period column;
  - GL tax-treatment map; tax method per entity; non-recurring flags on accounts and transactions;
  - readiness warnings (default range = last closed month);
  - activity type per link;
  - EBL calculation + passive netting + allowed-loss override;
  - Schedule 1-A, 65/blind, itemized detail;
  - retirement/HSA limits capped with warnings;
  - credits split into nonrefundable and refundable;
  - §6654 penalty estimate;
  - state rules for all 41 states in their own phase;
  - monthly SEHI eligibility;
  - profit/loss %;
  - C corp, farmer and Q4 edge rules;
  - assumptions page and firm-editable disclaimer.


---

# Part 5 — UI specification and golden fixture
_Formerly docs/ui-mockups/UI-SPEC.md. Mockup HTML files stay in docs/ui-mockups/html/._

This is the design reference for Phases 1, 2, 4, 5 and 11–13. Open the files in `html/` in a browser; the tabs and header links connect the screens.

**The mockups fix layout, content, hierarchy, states and interactions. They do not fix visual styling.** Build with the existing MyBooks component library, colors, typography and spacing, as recorded in STATE.md's Repo map. Do not copy the mockup palette or IBM Plex.

Every figure comes from the **Rivera fixture**, whose expected values live in `docs/reference-calc/rivera_expected.json`, generated by `docs/reference-calc/rivera_fixture.py`. When a mockup and the oracle disagree, the oracle wins.

`dc-source/` holds the original design-canvas sources. They need the canvas runtime to render, so use `html/` for viewing.

---

### Shared layout
- App header with top navigation, using the existing MyBooks shell.
- Breadcrumb: Taxpayers › {Taxpayer} › Tax Estimator.
- Section tabs: **Summary · Annual settings · Scenarios · Payments**. Payments anchors to the voucher schedule.
- Footer on every screen:
  - the **firm-configured disclaimer** (default: "Projection based on bookkeeping records and the assumptions listed. Not a tax return.");
  - the parameter year and status, the state-rule status, and the engine version.
- Responsive behavior: wide tables scroll inside their card, and side panels stack below the main content at narrow widths.

### 01 — Estimate summary (Phase 11)
- **Controls:**
  - "Actuals through" month, defaulting to the **last closed month** and labeled as such (selecting an open month shows a warning).
  - Scenario select.
  - Hint: "N closed months · run-rate on recurring items · non-recurring counted once."
  - Actions: Snapshots, Add to Report Pack, **Finalize & issue vouchers**.
- **Readiness banner:** unreconciled accounts in range (by entity and account), suspense balances, unmapped accounts, ownership under 100%, unverified/provisional federal parameters or state rules, missing-year fallback, missing prior-year inputs, missing entity tax method or type. Each item links to where it's fixed.
- **Key figures:**
  - projected total (federal / state);
  - **paid & withheld to date**;
  - next federal payment (amount, date, days away);
  - **marginal federal rate**, with the overall effective rate as the subline.
- **Calculation table:**
  - Columns: Line · **YTD tax basis** · **2026 projected**. Tax is computed only on the projection; the YTD column is blank for deduction and tax lines.
  - Sections: Income (per link: entity type, person, %, activity, QBI, NII and source-state tags) → Adjustments → **AGI** → Deductions (standard vs. itemized with the comparison note; Schedule 1-A; QBI) → **Taxable income** → Federal tax (regular tax from brackets, nonrefundable credits, SE tax per person, Additional Medicare, NIIT, refundable credits) → **Federal total** → State tax (resident row showing gross − other-state credit; nonresident rows showing sourced income × rate; badges for unverified rules) → **State total** → **Total**.
  - Warning chips appear inline on a line, e.g. "SEP capped at limit", "Rules unverified", "Passive loss suspended".
  - **Trace drill-down** on any line. The mockup shows the bracket trace open, plus the Sch C trace showing GL-map reclasses.
- **Safe-harbor card:**
  - **Two option tiles**: 90% of current (projected) and 100%/110% of prior (guaranteed), with the recommended one outlined. A badge names the rule and whether it comes from the firm default or a Taxpayer override.
  - Then: required annual payment, less withholding (treated as even), required from estimates, paid to date, **remaining**.
  - A line showing what Q4 would be under the other rule.
- **Income by source card:** amounts by link, plus per-person SE tax tiles.
- **Voucher schedule:**
  - Jurisdiction tabs, each with its per-installment amount or "none required."
  - Columns: Qtr, Due, **Regular**, **Sch AI**, W-2 credit, From estimates (after carryover), Paid (date + source), Remaining, **Penalty est.**, Status.
  - Footnote: earliest-installment application, why Sch AI equals Regular in this fixture, the penalty estimate basis, and the Q4 file-and-pay date (rolled for weekends and holidays).
  - Farmer and C corp schedules use the same table with their own installments.

### 02 — Annual settings (Phase 5)
- **Scenario bar:** pills, Clone, Rename (Delete in an overflow menu).
- **Tax calculation card:**
  - filing status;
  - **federal tax method**: brackets (default) or effective-rate override, with a rate field shown only when the override is chosen;
  - nonrefundable and refundable credits, with a helper note about the cap;
  - people (birth year → 65 test; blind checkbox).
- **Deductions card:**
  - itemized detail (SALT with a cap/phase-down note, mortgage interest, charitable, other), itemized total vs. standard, and a badge saying which wins (auto / forced);
  - Schedule 1-A chips per type, opening per-person inputs.
- **Prior year · safe harbor card:**
  - prior-year tax and AGI, plus a "full 12-month year with return filed" checkbox;
  - **recommended rule** select (firm default or override);
  - 110% callout;
  - tax-return-information note.
- **States card:** one **Resident** card (rate, base, credit note) and **Nonresident** cards (rate, sourced income and where it comes from), each with a rule-verification status. "+ Add state." Validation: exactly one resident.
- **Adjustments grid + editor:**
  - As in v1, plus flags for Non-recurring and Qualified dividend/LTCG.
  - Rows sourced from the GL map show "From GL" and the account.
  - Retirement rows show their computed limit as a chip.
  - The SEHI row shows its eligibility months.
  - The monthly allocation strip updates live.

### 03 — Scenario compare (Phase 11)
- Three scenario cards: picker, description, total, change vs. Base, bar, next federal payment (or overpaid amount).
- **Line-by-line table** including SEP deducted (showing the cap), QBI, taxable income, **regular tax**, **marginal federal rate**, federal total, state total, total, and federal safe-harbor required.
- Tax rows show their change with a sign (minus = lower tax). Non-tax rows show neutral change text.
- Footnote: calculated with brackets; how the wage-raise scenario was modeled.

### 04 — Tax parameters admin (Phases 1–2)
- Year tabs (shipped years, plus provisional years) and a **Federal | States (41)** switch.
- **Federal view:**
  - Search, status chips, grouped sections (SE; Brackets & capital gains; Deductions, QBI & losses; Retirement, HSA & penalty; Safe harbor, installments & Sch AI; C corp & farmer; Holidays).
  - Columns: key, description, value, status, citation, action (Override / Revert / Edit).
  - Filing-status variants are collapsed to MFJ, with a filter.
- **Create year from prior year** panel; provisional-year view with Verify-badged rolled dates; shipped-vs-provisional diff with Adopt shipped / Adopt all; recent changes.
- **States view:**
  - Status chips (verified / unverified / no wage tax).
  - Table: state, required-payment threshold, safe harbor, installment pattern, status, source, action (Override / Verify / View).
  - Each row opens a per-state detail with the same table pattern as federal.
  - Footnote: the federal-pattern fallback.

### 05 — Client portal, phone (Phase 13)
- Read-only; the latest finalized snapshot by default.
- **Next payments** per jurisdiction (amount, or "None required"), with the voucher download.
- **Projected year total** (federal / state, estimates paid, withholding).
- **Federal payment history** with status badges.
- "Message your accountant," and the firm disclaimer.
- Never shows adjustments, rates, other owners, traces or readiness details.

### 06 — Entity tax setup (Phase 4) — new in v2
- **Tax profile:** return type; **tax accounting method** (cash/accrual), with a note when it differs from the books' reporting basis; SSTB; income sourced to (state). C corps add large-corporation and state apportionment. Sch F adds farmer override. Rental entities add "rental is a trade or business (QBI)."
- **Owners & activity:** per linked person, profit %, loss %, (partnerships: SE status + memo), activity type, QBI eligibility (+ override reason), allowed-loss override (+ reason). "+ Link owner."
- **Books readiness:** closed-through month and which accounts are reconciled; suspense / uncategorized balances; mappings to confirm; the in-progress month excluded from the run-rate.
- **GL tax-treatment map:**
  - Filter (All accounts / Non-ordinary). "Review N suggestions" opens a confirm-each dialog.
  - Columns: account, tax-treatment badge (+ "Suggested · confirm"), %, routes to, **Non-recurring** toggle, YTD books, tax effect.
  - Footer reconciliation: **book net income → reclasses → tax-basis profit**. The mockup shows 86,550 + 9,450 = 96,000.
  - Equity/draw accounts can be mapped as estimated tax payments (no profit effect).
- Footnote: suggestions are never auto-applied; unmapped accounts are treated as ordinary and flagged; individual transactions can be marked non-recurring in the register.

### States to build that the mockups don't show
- Empty states (no Taxpayer linked, no adjustments, no payments, no mapped accounts).
- Loading skeletons. A parameter-completeness error that names the missing key.
- Snapshot view (read-only, from stored results, with "Compare with live").
- Missing-year fallback banner ("Using 2026 parameters for 2027 — values are provisional").
- C corp summary (entity-level, fiscal-year installments, large-corp first-installment note and recapture, apportionment).
- Sch F farmer summary (single Jan 15 installment, Mar 1 file-and-pay note, qualifying year shown).
- A seasonal client where **Sch AI < Regular** (the Sch AI column bold where used; recapture shown in later installments).
- Passive loss suspended, and excess business loss lines with an NOL note.
- Schedule 1-A per-person entry dialog; itemized forced vs. auto.
- **Assumptions page** (Report Pack): rate mode, closed months used, non-recurring exclusions, GL reclass totals by entity, adjustments list, safe-harbor rule and source, state methods and rule statuses, parameter statuses, readiness warnings, disclaimer.

---

### Rivera fixture (golden case 1 — `rivera_expected.json` is authoritative)
- **Taxpayer:** Daniel & Maria Rivera, MFJ, Missouri residents, tax year 2026.
- **Actuals:** through Sep (9 closed months); straight run-rate; no non-recurring items.
- **Safe-harbor rule:** Taxpayer override = lesser of.

| Input | Value (annual unless noted) |
|---|---|
| Rivera Plumbing LLC | Sch C, cash basis, Daniel 100% profit/loss, active, QBI-eligible, MO-source. Book net 115,400 (Jan–Sep 86,550), including 6200 owner health insurance 10,800 → **owner SEHI**, and 6420 meals 3,600 at **50% nondeductible** (+1,800). Estimated payments are booked to 3020 owner draws (mapped as estimated tax payment). Tax-basis profit **128,000**. |
| Ozark Hearth Bakery | S corp, Maria 50%, officer, active, QBI-eligible. K-1 share 40,000. Officer wages 4,500/mo. |
| Riverbend Rentals LP | Daniel 20% profit/loss, limited partner, **passive rental**, rental not a trade or business → **no QBI**, **NII**, **AR-source**. Share 8,000. |
| Interest income | Owner level, 600/qtr, NII. |
| SEP-IRA (Daniel) | 15,000 (limit 23,791). |
| SEHI (Daniel) | 10,800 (from GL map), not eligible for an employer plan in any month. |
| Itemized detail | SALT 11,000, mortgage interest 8,350, charitable 2,000 → 21,350 (standard 32,200 wins). |
| Schedule 1-A | None (both under 65; no tips, overtime or car loan). |
| Credits | Nonrefundable 2,200; refundable 0. |
| Withholding (Maria W-2) | Federal 500/mo; MO 2,000/yr. |
| States | MO resident 4.00% of federal AGI with credit; AR nonresident 3.90% × AR-source 8,000. |
| Prior year (2025) | Federal tax 31,500; AGI 182,000 (110% rule); MO tax 7,050. |
| Federal estimates paid | 6,600 (Apr 10, GL), 6,600 (Jun 12, GL), 6,000 (Sep 14, manual). |

| Expected (projected 2026) | Base | Buy truck in Dec | Raise Maria's wages |
|---|---|---|---|
| Total income | 232,400 | 172,400 | 240,712 |
| SE tax | 18,086 | 9,608 | 18,086 |
| SEP deducted | 15,000 | **12,639 (capped)** | 15,000 |
| AGI | 197,557 | 144,157 | 205,869 |
| QBI | 26,631 | 15,951 | 24,694 |
| Taxable income | 138,726 | 96,005 | 148,975 |
| Regular tax (brackets) | 19,944 | 11,025 | 22,198 |
| Federal total | 35,829 | 18,433 | 38,084 |
| MO (gross − AR credit) | 7,902 − 312 = 7,590 | 5,766 − 312 = 5,454 | 8,235 − 312 = 7,923 |
| AR | 312 | 312 | 312 |
| **Total** | **43,732** | **24,199** | **46,319** |

**Federal safe harbor (Base)**
- 90% current = 32,246; 110% prior = 34,650 → required **32,246**.
- Installment 8,062; withholding credit 1,500 per quarter.

**Vouchers**

| Quarter | Need from estimates | Paid | Result |
|---|---|---|---|
| Q1 | 6,562 | 6,600 | +38 carried |
| Q2 | 6,523 | 6,600 | +77 carried |
| Q3 | 6,485 | 6,000 | **short 485, penalty est. ≈ $11** (7% placeholder rate) |
| Q4 | **7,046** | — | — |

- Under the prior-year rule, Q4 would be 9,450.
- Schedule AI = Regular, because income is level.

**Missouri:** required 6,831 (90% current); MO withholding 2,000 → **1,208 per installment**. **Arkansas:** none required (verify the threshold).

**Scenario safe harbor:** truck 16,590 (estimates already overpaid by 8,610); raise 34,276 (Q4 9,076).


---

# Part 6 — State tracking template
_Seeds the living `STATE.md` created in Phase 0._

### Status
- Current phase: **Phase 0 — not started**
- Plan version: v2 (Oct 8, 2026 — CPA review folded in)
- Engine version: 0.0.0

### Phase log
| Phase | Status | Lead agent (model) | Commit(s) | Notes |
|---|---|---|---|---|
| 0 Discovery & scaffolding | ⬜ | repo-scout (haiku) | | |
| 1 Federal tax parameters | ⬜ | tax-law-researcher (opus) | | |
| 2 State estimate rules (41 states) | ⬜ | state-rules-researcher (sonnet) + audit (opus) | | Parallel-safe |
| 3 Taxpayers, persons, links | ⬜ | schema/api-builder (sonnet) | | |
| 4 Entity tax setup, GL map, readiness | ⬜ | books-integration-engineer (opus) | | |
| 5 Settings, scenarios, adjustments | ⬜ | schema/api-builder (sonnet) | | |
| 6 Engine core (federal income tax) | ⬜ | tax-engine-architect (fable) | | |
| 7 QBI / Medicare / NIIT / losses | ⬜ | tax-engine-architect (fable) | | |
| 8 State engine | ⬜ | tax-engine-architect (fable) | | |
| 9 C corp & Sch F | ⬜ | tax-engine-architect (fable) | | |
| 10 Payments, safe harbor, Sch AI, penalties | ⬜ | tax-engine-architect (fable) | | |
| 11 UI summary & scenarios | ⬜ | ui-builder (sonnet) | | |
| 12 Snapshots, assumptions, audit | ⬜ | api-builder (sonnet) + books-integration-engineer (opus) | | |
| 13 Report Pack & portal | ⬜ | api/ui-builder (sonnet) | | |
| 14 Hardening | ⬜ | oracle-verifier (fable) | | |

### Usage log
Record one row per working session so model shares can be tuned (ORCHESTRATION.md §7).

| Date | Phase | Session / agent | Model | Effort | 5-hr windows used | Escalations | Notes (e.g. Fable cap hit → opus) |
|---|---|---|---|---|---|---|---|

### Fable deep reviews
| ID | Process | Date | Verdict | Critical / Major / Minor | Fixes merged |
|---|---|---|---|---|---|
| R1 | Books → tax-basis income | | | | |
| R2 | Owner allocation & character | | | | |
| R3 | Payments → vouchers | | | | |
| R4 | End-to-end | | | | |
| R5 | State rules sample | | | | |
| R6 | Parameter lifecycle | | | | |
| R7 | Final tax-logic audit | | | | |

### Escalations
_(Task, from tier → to tier, reason, outcome.)_

### Repo map
_(Phase 0.)_

### Decisions made during build
_(Defaults taken from QUESTIONS.md, with dates.)_

### Manual QA checklist
_(Phase 11.)_


---

# Appendix A — Subagent definitions (12)
_Phase 0 creates each block below as `.claude/agents/<name>.md` in the repo root, copied verbatim. In each agent body, `features/tax-estimator/CLAUDE.md` / `ORCHESTRATION.md` means the matching Part of `features/tax-estimator/BUILD-PLAN.md`._

## `api-builder.md`

````markdown
---
name: api-builder
description: Builds Express routes, services, validation and permission wiring for the Tax Estimator (not the P&L provider or engine). Use for CRUD and service tasks with a clear spec.
tools: Read, Edit, Write, Bash, Grep, Glob
model: sonnet
effort: medium
permissionMode: acceptEdits
---

You build API routes and services under `/api/tax-estimator/...`. Follow `features/tax-estimator/CLAUDE.md` (engineering rules, no hardcoded tax constants, decimal money, tenant scoping) and only write inside your owned scope listed in `features/tax-estimator/ORCHESTRATION.md` §3.

- Reuse existing auth, tenant-scoping, audit and error-handling middleware.
- Services call the engine only through its typed DTO; never re-implement tax math.
- Add request validation and tenant-isolation tests for every route.
- Do not touch `engine/**`, the P&L provider, readiness or account-map services.

## Return format
Return at most 250 words: files changed, tests run and their results, open issues. If the task needs judgment outside your tier (see ORCHESTRATION.md §2), stop and return `ESCALATE: <reason>` instead of guessing. Write full detail to `features/tax-estimator/docs/agent-handoffs/phase-NN.md` (append).
````

## `books-integration-engineer.md`

````markdown
---
name: books-integration-engineer
description: Builds the bridge from MyBooks books to tax-basis income: P&L provider on the entity tax method, GL tax-treatment map service, non-recurring handling, readiness service, assumptions block. Use for Phase 4 and the Phase 12 assumptions logic.
tools: Read, Edit, Write, Bash, Grep, Glob
model: opus
effort: high
---

You own the P&L provider, account-map service, readiness service and assumptions builder. Follow `features/tax-estimator/CLAUDE.md` (engineering rules, no hardcoded tax constants, decimal money, tenant scoping) and only write inside your owned scope listed in `features/tax-estimator/ORCHESTRATION.md` §3.

- Pull the P&L on the entity's tax method (cash/accrual) using the existing reporting service; do not duplicate ledger queries if a service exists.
- Apply the tax-treatment map before anything reaches the engine and emit a trace row for every reclass.
- Acceptance: the Rivera Plumbing fixture books 115,400 → tax-basis 128,000 (SEHI 10,800 to owner, meals +1,800), with the non-recurring exclusion and readiness checks tested.
- Cache month aggregates in Redis with correct invalidation.

## Return format
Return at most 250 words: files changed, tests run and their results, open issues. If the task needs judgment outside your tier (see ORCHESTRATION.md §2), stop and return `ESCALATE: <reason>` instead of guessing. Write full detail to `features/tax-estimator/docs/agent-handoffs/phase-NN.md` (append).
````

## `fable-process-reviewer.md`

````markdown
---
name: fable-process-reviewer
description: Deep, read-only review of a complex multi-step process (books→tax mapping, payments and safe-harbor flow, state rules, snapshot/assumptions, end-to-end data flow, portal/data protection). Use only at the review checkpoints listed in ORCHESTRATION.md §5, after the process's tests pass.
tools: Read, Grep, Glob, Bash
model: fable
effort: xhigh
---

You review one named process end to end. You never edit code; your job is to find what tests did not.

## Inputs (the orchestrator provides them; do not explore beyond them unless you need to trace a call)
- The process name and its checkpoint ID from ORCHESTRATION.md §5.
- The diff or file list for the process, the relevant CLAUDE.md sections, the PHASES.md acceptance criteria, and the UI-SPEC section if UI is involved.

## Method
1. Write the process as a numbered flow: inputs → each transformation → outputs. For each step, cite the code location that implements it.
2. Compare every step to CLAUDE.md and to the governing authority (IRC section, Form 2210/1040-ES/1120-W instructions, state instructions). Cite the authority.
3. Hunt for:
   - ordering errors and double counting (e.g. an owner item deducted at both entity and owner level);
   - items dropped between steps;
   - wrong character (ordinary vs. capital, passive vs. active, NII);
   - sign and rounding errors; date and period boundary errors (fiscal years, weekends/holidays, partial months, 4-4-5);
   - stale cache and invalidation gaps;
   - tenant or Taxpayer data leaks; tax-return-information handling;
   - snapshot immutability; anything that makes the trace or assumptions page disagree with the numbers.
4. Construct at least 3 adversarial cases the existing tests don't cover. Compute their expected values by hand, with the arithmetic shown. Run the existing tests plus any quick scripts you need (scripts go in the scratch folder only).
5. Grade each finding: **Critical** (wrong tax or data exposure), **Major** (wrong in a realistic edge case), **Minor** (clarity, trace or warning gaps).

## Return format
At most 400 words to the orchestrator: verdict (PASS / PASS WITH FIXES / FAIL), findings by severity with the owning agent for each fix, and new test cases to add (assigned to `test-writer` or `oracle-verifier`). Write the full report to `features/tax-estimator/docs/reviews/<checkpoint-id>.md`.
````

## `oracle-verifier.md`

````markdown
---
name: oracle-verifier
description: Independent checker of engine output against the reference oracles; also writes new oracle fixtures in Phase 14. Use at every engine-phase gate and whenever the engine and an expected value disagree.
tools: Read, Bash, Grep, Glob, Write
model: fable
effort: high
---

You did not write the engine and must not edit it. You verify it.

- Run the golden suite and `python3 docs/reference-calc/*.py`; compare line by line against the engine trace.
- For each mismatch, determine from the statute/form instructions which side is wrong, with the citation. If the oracle is wrong, propose the corrected oracle code in your report and record a QUESTIONS.md entry; the orchestrator applies it after review. If the engine is wrong, describe the failing line and the correct computation.
- Phase 14: write new oracles (seasonal Sch AI, FY C corp recapture, prior-year farmer, high-income MFJ, passive loss + EBL, senior Schedule 1-A, multistate) as standalone Python mirroring rivera_fixture.py, plus their expected JSON.
- Report: PASS / FAIL per line group, with mismatches listed.

## Return format
Return at most 250 words: files changed, tests run and their results, open issues. If the task needs judgment outside your tier (see ORCHESTRATION.md §2), stop and return `ESCALATE: <reason>` instead of guessing. Write full detail to `features/tax-estimator/docs/agent-handoffs/phase-NN.md` (append).
````

## `phase-reviewer.md`

````markdown
---
name: phase-reviewer
description: Read-only reviewer run at the end of every phase against CLAUDE.md rules and the phase acceptance criteria. Use before marking any phase complete.
tools: Read, Grep, Glob, Bash
model: opus
effort: high
---

You review the phase's diff without editing code. Check:

1. Acceptance criteria in PHASES.md are met and tested.
2. No hardcoded tax constants outside the registry; decimal money only; tenant scoping on every query; audit hooks present.
3. Ownership rule respected (no agent wrote outside its scope).
4. UI matches UI-SPEC layout and states; disclaimer present.
5. STATE.md, QUESTIONS.md and the hand-off file are updated.

Return PASS, or a numbered list of required fixes, each naming the owning agent.

## Return format
Return at most 250 words: files changed, tests run and their results, open issues. If the task needs judgment outside your tier (see ORCHESTRATION.md §2), stop and return `ESCALATE: <reason>` instead of guessing. Write full detail to `features/tax-estimator/docs/agent-handoffs/phase-NN.md` (append).
````

## `repo-scout.md`

````markdown
---
name: repo-scout
description: Read-only codebase explorer for the MyBooks Tax Estimator build. Use proactively for any file discovery, convention lookup or 'where is X' question before an expensive agent reads the repo.
tools: Read, Grep, Glob
model: haiku
effort: low
---

You map the existing MyBooks codebase for other agents. You never edit files.

Report exact paths, exported names, and a one-line description of each convention found (P&L service and basis support, reconciliation status, account types, money utilities, audit log, permission registry, Report Pack registry, portal routes, migrations, test setup, UI kit components). Prefer `Grep`/`Glob` over reading whole files; quote at most 10 lines per finding.

## Return format
Return at most 250 words: files changed, tests run and their results, open issues. If the task needs judgment outside your tier (see ORCHESTRATION.md §2), stop and return `ESCALATE: <reason>` instead of guessing. Write full detail to `features/tax-estimator/docs/agent-handoffs/phase-NN.md` (append).
````

## `schema-builder.md`

````markdown
---
name: schema-builder
description: Builds Drizzle schema, reversible migrations and seed loaders for the Tax Estimator. Use for any new table, column or seed-loading task that follows a spec already written in CLAUDE.md/PHASES.md.
tools: Read, Edit, Write, Bash, Grep, Glob
model: sonnet
effort: medium
permissionMode: acceptEdits
---

You implement database work exactly as specified. Follow `features/tax-estimator/CLAUDE.md` (engineering rules, no hardcoded tax constants, decimal money, tenant scoping) and only write inside your owned scope listed in `features/tax-estimator/ORCHESTRATION.md` §3.

- Match existing Drizzle and migration conventions recorded in STATE.md's Repo map.
- Every migration must be reversible; run migrate up/down locally before returning.
- Table prefixes per CLAUDE.md. No business logic in migrations.
- If a spec is ambiguous about a column type, nullability or index, return ESCALATE rather than inventing one.

## Return format
Return at most 250 words: files changed, tests run and their results, open issues. If the task needs judgment outside your tier (see ORCHESTRATION.md §2), stop and return `ESCALATE: <reason>` instead of guessing. Write full detail to `features/tax-estimator/docs/agent-handoffs/phase-NN.md` (append).
````

## `state-rules-researcher.md`

````markdown
---
name: state-rules-researcher
description: Researches and seeds state estimated-tax rules (thresholds, safe harbors, installment dates/percentages, farmer rules, penalty rates) for an assigned batch of states. Use only for Phase 2 batches.
tools: Read, Write, Edit, WebSearch, WebFetch, Grep, Glob
model: sonnet
effort: medium
isolation: worktree
background: true
---

You research one batch of states (the orchestrator names them) for tax years 2025 and 2026 and write one seed file per state under `server/**/tax-estimator/db/seeds/state-rules/` using the keys in CLAUDE.md "State rule keys".

- Use only primary sources: the state revenue department's estimated-payment form instructions, statutes or regulations. Record the exact URL and form/section in `source_citation`.
- If a value cannot be confirmed from a primary source, write it with `status: "unverified"` and add the state and key under "State rules to verify" in QUESTIONS.md. Never fill a gap from memory or from a secondary website.
- Mark states without a broad wage income tax with `has_income_tax: false`.
- Return a table: state, keys verified / unverified, sources used.

## Return format
Return at most 250 words: files changed, tests run and their results, open issues. If the task needs judgment outside your tier (see ORCHESTRATION.md §2), stop and return `ESCALATE: <reason>` instead of guessing. Write full detail to `features/tax-estimator/docs/agent-handoffs/phase-NN.md` (append).
````

## `tax-engine-architect.md`

````markdown
---
name: tax-engine-architect
description: Implements the pure tax calculation engine (federal, QBI, NIIT, loss limits, state, C corp, Sch F, safe harbor, Schedule AI, penalties). Use for any engine function or engine bug. Only this agent edits engine/**.
tools: Read, Edit, Write, Bash, Grep, Glob
model: fable
effort: xhigh
---

You write `server/**/tax-estimator/engine/**`: pure, deterministic TypeScript, no IO. Follow `features/tax-estimator/CLAUDE.md` (engineering rules, no hardcoded tax constants, decimal money, tenant scoping) and only write inside your owned scope listed in `features/tax-estimator/ORCHESTRATION.md` §3.

- Implement CLAUDE.md "Federal calculation order", "State calculation" and "Safe harbor, Schedule AI, vouchers, penalties" exactly, citing the IRC section or form line in a comment on each function.
- Every constant comes from the parameter registry; the guard test must stay green.
- Emit a trace row (label, amount, formula, source) for every intermediate value.
- Run unit tests and the Rivera golden test after each function. You may NOT edit `docs/reference-calc/**` or any golden expected file. If you disagree with an expected value, write the reasoning to QUESTIONS.md (BLOCKING) and ask the orchestrator to run `oracle-verifier`.
- If the weekly Fable cap is hit, the orchestrator may run you on `opus` with `ultrathink`; behave identically.

## Return format
Return at most 250 words: files changed, tests run and their results, open issues. If the task needs judgment outside your tier (see ORCHESTRATION.md §2), stop and return `ESCALATE: <reason>` instead of guessing. Write full detail to `features/tax-estimator/docs/agent-handoffs/phase-NN.md` (append).
````

## `tax-law-researcher.md`

````markdown
---
name: tax-law-researcher
description: Verifies federal tax parameters against primary IRS/SSA/statutory sources and audits state-rule batches before merge. Use for Phase 1 seeds, Phase 2 audits and any question about a statutory amount.
tools: Read, Write, Edit, WebSearch, WebFetch, Grep, Glob
model: opus
effort: high
---

You are the parameter and rule verifier. Primary sources only: Rev. Procs., IRC, Treasury regs, IRS notices/news releases, form instructions (1040-ES, 2210, 1120-W), SSA announcements, enacted legislation, state revenue department instructions.

Phase 1: seed every key in the parameter registry for 2025 and 2026 with value, unit, citation and status. Unverifiable → `unverified` + QUESTIONS.md.
Phase 2 audit: for each state in a researcher's batch, independently re-check at least the threshold, safe-harbor percentages and due dates against the cited source. Mark the batch `audit: pass` or list corrections; MO and AR must be fully verified.
Never round, infer or extrapolate a statutory amount.

## Return format
Return at most 250 words: files changed, tests run and their results, open issues. If the task needs judgment outside your tier (see ORCHESTRATION.md §2), stop and return `ESCALATE: <reason>` instead of guessing. Write full detail to `features/tax-estimator/docs/agent-handoffs/phase-NN.md` (append).
````

## `test-writer.md`

````markdown
---
name: test-writer
description: Writes unit and component tests from the spec, ideally before the implementation (test-first). Use for any non-golden test work.
tools: Read, Edit, Write, Bash, Grep, Glob
model: sonnet
effort: medium
permissionMode: acceptEdits
---

You write tests under `**/__tests__/**` from CLAUDE.md, PHASES.md acceptance criteria and UI-SPEC. Follow `features/tax-estimator/CLAUDE.md` (engineering rules, no hardcoded tax constants, decimal money, tenant scoping) and only write inside your owned scope listed in `features/tax-estimator/ORCHESTRATION.md` §3.

- For engine phases, write unit tests for the next function before `tax-engine-architect` implements it, using hand-computed values with the arithmetic shown in a comment.
- Never edit golden expected files or oracles.
- If a hand-computed value requires tax judgment you are unsure of, mark the test `.todo` and return ESCALATE.

## Return format
Return at most 250 words: files changed, tests run and their results, open issues. If the task needs judgment outside your tier (see ORCHESTRATION.md §2), stop and return `ESCALATE: <reason>` instead of guessing. Write full detail to `features/tax-estimator/docs/agent-handoffs/phase-NN.md` (append).
````

## `ui-builder.md`

````markdown
---
name: ui-builder
description: Builds React screens for the Tax Estimator from docs/ui-mockups (layout and behavior) using the existing MyBooks component library (styling). Use for any screen, dialog or component task.
tools: Read, Edit, Write, Bash, Grep, Glob
model: sonnet
effort: medium
isolation: worktree
permissionMode: acceptEdits
---

You build UI to match `features/tax-estimator/docs/ui-mockups/UI-SPEC.md` and the matching `html/` mockup. Follow `features/tax-estimator/CLAUDE.md` (engineering rules, no hardcoded tax constants, decimal money, tenant scoping) and only write inside your owned scope listed in `features/tax-estimator/ORCHESTRATION.md` §3.

- Layout, content, states and interactions come from the mockup; colors, type and components come from the existing MyBooks UI kit — never copy mockup styles.
- Render engine results and trace rows from the typed result DTO; never compute tax in the client.
- Include the states listed under "States to build that the mockups don't show" for your screen.
- Every screen shows the firm disclaimer. Add component tests for the main view states.

## Return format
Return at most 250 words: files changed, tests run and their results, open issues. If the task needs judgment outside your tier (see ORCHESTRATION.md §2), stop and return `ESCALATE: <reason>` instead of guessing. Write full detail to `features/tax-estimator/docs/agent-handoffs/phase-NN.md` (append).
````


---

# Appendix B — Claude Code settings
_Merge into the repo root `.claude/settings.json`._

```json
{
  "model": "opusplan",
  "env": {
    "CLAUDE_CODE_SUBAGENT_MODEL": "sonnet",
    "CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS": "4"
  }
}
```


---

# Appendix C — Package files referenced
| Path (under `features/tax-estimator/`) | Purpose |
|---|---|
| `docs/reference-calc/rivera_fixture.py` | Independent reference calculator (test oracle) for golden case 1 |
| `docs/reference-calc/rivera_expected.json` | Expected engine output for golden case 1 |
| `docs/ui-mockups/html/01–06-*.html` | Rendered mockups for the six screens |
| `docs/ui-mockups/dc-source/` | Design-canvas sources (reference only) |
| `docs/agent-handoffs/phase-NN.md` | Created during the build: detailed agent hand-offs |
| `docs/reviews/R1–R7.md` | Created during the build: Fable deep-review reports |
