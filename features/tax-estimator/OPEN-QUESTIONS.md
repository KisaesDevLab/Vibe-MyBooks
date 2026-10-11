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
