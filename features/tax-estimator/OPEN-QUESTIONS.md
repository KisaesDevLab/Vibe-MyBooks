# OPEN-QUESTIONS.md — MyBooks Tax Estimator (plan v2.2)

(Was QUESTIONS.md; renamed because the repo git-ignores that filename.)

Format: question → **default taken** → status. Take the default, log it in PROGRESS.md, and continue unless the item is marked BLOCKING.

## Resolved by Kurt on 2026-10-11 (see MODULE.md D1–D16)
1. Quarterly adjustment allocation → **÷3.** Confirmed default.
2. QBI loss carryforward across years → **out of scope; netting within the year only.** Confirmed default.
3. S corp >2% shareholder health insurance → **officer W-2 wages (no FICA) + SEHI deduction, monthly eligibility flags.** Confirmed default.
4. Withholding timing → **even.** Confirmed default (actual-date election in backlog).
5. Portal default view → **LIVE estimate** (Redis-cached, as-of label), firm can switch a taxpayer to latest snapshot. **Changed from the kit's default.** (D10)
6. Mid-year ownership changes → **per tax year only; weighted %.** Confirmed default.
7. Individuals calendar year → **yes.** Confirmed default.
8. Firm safe-harbor default → **`lesser_of`.** **Changed from the kit's `prior_year`.** (D10)
9. Passive rental $25k allowance (§469(i)) → **COMPUTED in v1** with `active_participation` per rental link and MAGI phase-out parameters. **Changed from the kit's default.** (D10)
10. Charitable 0.5% floor and 35% itemized benefit cap → **yes, when seeded.** Confirmed default.
11. Nonresident sourced income for K-1s → **entity `state_sourcing` × share, manual override per row.** Confirmed default.
12. Unmapped GL accounts with activity → **ordinary + warning.** Confirmed default.

## Added by the 2026-10-11 repo-adaptation review
13. **Oracle: nine-month case prorated the standard deduction and credits and scaled brackets.** Form 2210 Schedule AI uses the full-year standard deduction and full-year credits and figures tax on annualized taxable income. → **Replaced by a true Schedule AI period-3 column (Jan–Aug, factor 1.5, 67.5%).** Items still to verify inside it: (a) QBI deduction on Schedule AI line 9 uses annualized amounts; (b) credits on line 19 are full-year, not annualized. Resolved pending (a)/(b) verification in Phase 1.
14. **Oracle: penalty period ended at the next installment date.** §6654(b)(2): the period runs from the installment due date to the earlier of the date the underpayment is paid or the return due date, with payments applied to the earliest unpaid installment. → **Oracle rewritten event-driven; Rivera's $11 is unchanged because the Jan 15 payment cures the Q3 shortfall.** Resolved.
15. **QBI W-2 wages / UBIA were never collected.** → **`w2_wages` treatment total with per-entity-year override; UBIA manual; blank UBIA → limb not computed + warning.** (D8) Resolved.
16. **DC was missing from "41 states".** → **42 jurisdictions; DC is a `state_estimate_rules` row.** (D11) Resolved.
17. **Nonresident tax = sourced income × flat rate** is not how most states compute it (ratio of the full return). → **Kept for v1 because rates are user input; labelled "effective-rate estimate" in UI, trace and assumptions; `nonresident_method` key records the state's actual method; ratio method in backlog.** Resolved.
18. **Non-itemizer charitable deduction (2026+)** absent from the parameter list. → **Key `charity.nonitemizer.{fs}` added; amounts and MFS rule to verify in Phase 1.** Open (Phase 1).
19. **Firm-level parameter overrides** conflict with the platform-wide nature of tax parameters. → **Super admin only; firms set defaults/disclaimer only.** (D4) Resolved.
20. **Cross-tenant taxpayers.** → **Firm-scoped with a server-resolved allowed-tenant set and mandatory isolation tests.** (D1) Resolved.
21. **Where the engine lives.** The kit put it in the server; TB14 puts pure engines in `@kis-books/shared` so browser and server share numbers. → **Shared.** (MODULE.md "Where things live") Resolved.
22. **Agent/test isolation on the production host.** → **D13 rules written into every agent definition.** Resolved.
23. **Long-lived branch vs sequential migration numbering.** → **One consolidated migration, numbered at merge; merge main after each prod release.** (D6) Resolved.
24. **Deadline vs scope.** Jan 15, 2027 target with full scope and one release. → **Kurt accepts possible slip.** (D14) Resolved.

25. **MO/AR research findings (Phase 2 batch 1; full table in docs/reviews/phase2-mo-ar-sources.md).** (a) The researcher reports Arkansas Act 1 of the 2026 First Extraordinary Session (approved 5/6/26) cut the AR top rate to **3.7% for tax years from 1/1/2026**; the Rivera fixture's 3.9% is correct for 2025 only (AR tax on $8,000 would be ~$296, still under AR's $1,000 threshold). The fixture rates are user-supplied effective rates, so the oracle is left unchanged and this is a **CPA check**. (b) Missouri's top rate is 4.7% in both years; the fixture's 4% is an effective rate on AGI. (c) Confirmed: MO $100 threshold, MO 90% current / 100% prior with no 110% rule; AR $1,000 threshold; both states compute nonresident tax by ratio of the full return (`nonresident_method = ratio`). (d) Unverified: AR farmer 90% figure (inferred; the 2/3 test and dates are verified) and AR holiday list (statute unreadable). (e) **CPA must double-check:** MO penalty rate (8% for 2025, 7% for 2026, 2027 unposted); AR at exactly $1,000 (forms disagree "more than" vs "$1,000 or more"). (f) **Rules the key set cannot hold:** MO's prior-year-income-at-current-rates exception and both states' Jan 31 file-and-pay relief. → Recorded as assumptions-page notes; revisit key set if the CPA wants them modeled. Open (Kurt sign-off, D12).

26. **Phase 2 state-rule seeds (51 jurisdictions x 2025/2026; 1,698 rows after the R5 key extension: 1,157 verified, 541 unverified — 475 of the unverified are the new R5 keys' cited nulls/defaults in states R5 did not research).** R5 (docs/reviews/R5-state-rules-sample.md, "Key-set decisions" and "Fix status") added seven keys, so these are **now expressible**: no estimate regime (`estimates_required = false`, ID/UT); exempt farmers (`farmer.rule.treatment = 'exempt'`, IL/MT/VT; OK/OR `current_pct: 0`) and MA's four 66 2/3% farmer installments (`treatment = 'quarterly'`); MO's $500 penalty floor (`penalty.min_balance_due`); "more than" thresholds (`threshold_comparison`, AR verified, IL/MI/VA/NJ/MA/CO unverified); dated / semiannual / quarterly penalty rates (`penalty.rate_schedule`: MO, MT, MI, CA verified; NY, VA, MA, OR, VT, CO, NJ unverified); HI per-month-or-fraction, ME monthly compounding, IL tiered flat (`penalty.method`); VA May 1 / HI Apr 20 penalty-period end (`return_due_date`); Jan 31 file-and-pay relief (`installments.q4_file_and_pay_date`, MO/AR seeded); CA MFS $75k and $1M/$500k current-AGI rule (`safe_harbor.high_agi_rule` extras). **Still genuinely inexpressible** (engine/assumptions-page handling, CPA decision on what to model): *income-based requirement gates* — AZ (> $75k/$150k gross in both years), GA (gross income > exemptions + deductions + $1,000), PA (non-withheld income > $11k/$14k), ME (current AND prior-year liability >= $1,000), NM (threshold nets withholding only); *penalty add-ons and caps* — MI +10% (min $10), VT +1%/month, IN flat 10%, AZ 10%-of-underpayment cap, UT 12% / six-month cap and stop-at-filing (ID similar), DC daily compounding, CT/DE per-month rates not yet mapped to `penalty.method`; *carry rules for federal-source states* — NM "Q1 rate through Apr 15", AL 2026 federal source; *period end at return filing* (AR); *per-installment 90%/80% bases* (PA, RI); MD 2.25% special nonresident tax; *MFS high-AGI thresholds* outside CA (IN, IA, KY, MI, NE, NY, SC, CO — field exists, values not yet seeded); *unpublished calendar-2027 rates* (MO by Oct 22, 2026, and every other state's Jan 1-Apr 15, 2027 leg: uncovered days fall back to `penalty.rate`, flagged). WA leaves the no-income-tax list when 2028 rules are seeded (ESSB 6346: 9.9% on AGI over $1M from 2028). Open (D12 covers MO/AR only — both now carry every R5 key verified; all other states ship with their statuses and the verify badge).

27. **Gate waiver and scope answers (2026-10-12, Kurt Q&A).** Engine phases start before sign-off (D12a); unverified parameters are used with warnings; AZ/GA/PA/ME/NM income gates are modeled (D12b); if Jan 15 slips, portal live view + standalone PDF move to a point release (D14a). Resolved.

28. **Retirement plan type per person is not stored** (Phase 5 has HSA coverage only). Engine assumes SEP + `TE_RETIREMENT_PLAN_ASSUMED`; outside W-2/SS wages have no DB field. → Add `retirement_plan_type` + `employee_deferral` and person W-2 wages to year inputs (schema-builder, before Phase 11 UI). Open.
29. **Age thresholds (65/50/55/60-63) are parameters** because the literal guard forbids them in engine code; seeded unverified (8 keys, both years). → CPA verify. Open.
30. **Engine approximations (warn / assumptions page):** no SIMPLE 60-63 catch-up; charitable 60%-of-AGI and mortgage-interest limits not applied; MAGI = AGI for SALT/Sch 1-A/§469; car-loan phase-out linear; S-corp SEHI cap = officer wages; SEHI cap pooled across businesses; owner items run-rated as recurring; null-person owner items go to the primary with `TE_OWNER_ITEM_UNATTRIBUTED`. Open (CPA).
31. **`decimal.ts` lives beside `allocation.ts`, outside `engine/`** (guard forbids radix literals). Accepted. Resolved.
32. **Phase 7 note:** QBI needs TI-before-QBI using the pre-§68 deduction; compute QBI before the §68 base. Raise scenario models Maria at 50% of an 80,000-profit S corp (oracle comment to add). Open.

33. **Phase 7 interpretations (CPA):** §199A(i) minimum applied after overall limit; §469(i) MAGI = AGI without passive losses; §461(l) aggregate = ordinary+rental+§1231 of non-investment links+GP after §469; NII has no §1411 trade-or-business carve-out for gains. Inputs `mfsLivedApartAllYear`, `niiAllocableDeductions` need schema/UI. Open.
34. **Phase 9/10 gaps:** C corp short current year (§6655(i)) and Form 2220 annualized installments not modelled; large-corp +2% penalty rate and $500 minimum not modelled; no C corp return-due-date key. Prior-year STATE tax/AGI, state gate inputs (withholding, credits, gross income, exemptions), farmer gross-income figures, `tax_est_payments` table, and Schedule AI period snapshots need schema + services before Phase 11. Prior-year overpayment dated at original due date; late-filed prior return not modelled. Penalty method difference vs oracle (segments split at rate/year boundaries, Form 2210 method) gives identical $11. Services must pass the ROUNDED federal total / state net tax as current-year tax. Open.

35. **Oracle penalty rate legs (R2 O-1).** `rivera_fixture.py` accrues each leg at the leg-start rate and never splits at rate boundaries; the engine splits at every rate/year boundary (Form 2210 convention). Agreement today is accidental (all 7%). → Keep the engine convention; split the oracle at `underpayment_rates` boundaries before Phase 14's seasonal fixture. Open (oracle-verifier).
36. **R2 amendments.** Q30 "car-loan phase-out linear" is obsolete: tips/overtime/car-loan phase-outs step by `sch1a.phaseout_step` ($1,000 or fraction, round-up; seeded unverified — CPA check for §224/§225). SIMPLE 60-63 catch-up still absent; SIMPLE compensation is now §1402(a) NESE. `qbi.threshold.mfs` 2026 = $201,775 confirmed against Rev. Proc. 2025-32 §4.26 (R2-08 not a defect). R2-10: a payment after the return due date still clears the voucher balance (relabelled 'unpaid after known payments'); R2-16 (2/3 truncation) accepted. Engine version 1.0.0-rc.1. Resolved except CPA checks.

## Parameters to verify (Phase 1) — Kurt signs off (D12)
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
- Charitable floor, the 35% benefit cap, and the non-itemizer deduction (Q18).
- §469(i) allowance and MAGI phase-out ($25,000 / $100,000–$150,000; MFS living apart half) — statutory, not indexed; confirm (Q9).
- 2026 retirement limits (401(k) deferral, catch-ups incl. ages 60–63, SIMPLE, SEP dollar limit, compensation limit) and 2026 HSA limits.
- QBI minimum deduction ($400 / $1,000 active QBI) — first year it applies.
- Quarterly underpayment rates for 2026 (the oracle uses 7% as a placeholder).
- Federal legal holidays for 2026–2028; 2026 return due date (Apr 15, 2027).
- Schedule AI: line 9 QBI treatment and line 19 credits (Q13).

## State rules to verify (Phase 2) — Kurt signs off MO and AR (D12)
- MO: required threshold ($100 assumed), safe harbor (90% current / 100% prior — high-AGI rule?), due dates, penalty rate, nonresident method.
- AR: required threshold (the oracle assumes AR tax of $312 is under it), safe harbor, due dates, nonresident method.
- Every other jurisdiction incl. DC: seeded `unverified` until audited.

## Resolved earlier (v1 → v2, Oct 8, 2026)
Bracket mode default with effective-rate override; resident/nonresident model with credit; firm safe-harbor default with per-Taxpayer override; Schedule AI in v1; GL tax-treatment map; tax method per entity; non-recurring flags; readiness warnings (default range = last closed month); activity type per link; EBL + passive netting + allowed-loss override; Schedule 1-A, 65/blind, itemized detail; retirement/HSA limits capped with warnings; split credits; §6654 penalty estimate; state rules for all jurisdictions in their own phase; monthly SEHI eligibility; profit/loss %; C corp, farmer and Q4 edge rules; assumptions page and firm-editable disclaimer.
