# Phase 2 batch 5 audit: NJ, NM, NY, NC, ND, OH, OK, OR, PA

Auditor: tax-law-researcher, 2026-10-11. Scope: `packages/api/src/db/seeds/tax-estimator/state-rules/<ST>.ts`, tax years 2025 and 2026. The researcher's report is `phase2-batch5-sources.md`.

Method: each state was re-checked against primary documents fetched during this audit and read as text (pdftotext or HTML stripped). The researcher's own doubts were checked first. A row is `verified` only if this audit read the fact in a primary source. Validation passed: `npx tsc --noEmit -p .` (packages/api) exits 0. A throwaway tsx script (scratchpad, not in the repo) checked every state-year: exactly 13 keys, each key once, valid values, non-empty citations, holidays sorted with no duplicates, and an `UNVERIFIED` reason on every unverified row. It printed OK.

## Verdicts

| State-year | Verdict | Status after audit (verified / unverified) |
|---|---|---|
| NJ 2025 | corrections: holidays | 13 / 0 |
| NJ 2026 | corrections: holidays, penalty.rate status | 13 / 0 |
| NM 2025 | corrections: farmer.rule, nonresident_method, holidays | 13 / 0 |
| NM 2026 | corrections: farmer.rule, nonresident_method, holidays | 13 / 0 |
| NY 2025 | corrections: holidays citation only | 13 / 0 |
| NY 2026 | corrections: penalty.rate status, holidays citation | 13 / 0 |
| NC 2025 | corrections: holidays | 13 / 0 |
| NC 2026 | corrections: holidays, penalty.rate status | 13 / 0 |
| ND 2025 | audit: pass | 13 / 0 |
| ND 2026 | audit: pass | 13 / 0 |
| OH 2025 | corrections: farmer.rule | 13 / 0 |
| OH 2026 | corrections: farmer.rule | 13 / 0 |
| OK 2025 | corrections: installments.due_dates status, farmer.rule status, nonresident_method status, holidays | 12 / 1 |
| OK 2026 | corrections: farmer.rule status, nonresident_method status, holidays | 12 / 1 |
| OR 2025 | corrections: farmer.rule status | 13 / 0 |
| OR 2026 | corrections: farmer.rule status | 13 / 0 |
| PA 2025 | corrections: holidays citation (status stays unverified) | 12 / 1 |
| PA 2026 | corrections: holidays citation (status stays unverified) | 12 / 1 |

## Corrections (key: before -> after; source)

### New Jersey
- **holidays (2025, 2026)**: the researcher wrote "Saturday holidays are not moved". That is wrong. N.J.S.A. 36:1-1.2 says that when a holiday falls on a Saturday, the preceding Friday is the holiday and State public offices are closed. Added 2026-07-03 and 2027-12-24. I re-read the statute verbatim in the Legislature's STATUTES-TEXT bulk file. The Division's own roll rule was also found: 2026 NJ-1040-ES Instructions "When to File" say "When any date falls on a Saturday, Sunday, or legal holiday, substitute the next regular workday." Lincoln's Birthday is correctly excluded under 36:1-1(d). Juneteenth is the third Friday in June.
- **penalty.rate 2026**: 0.10 unverified -> 0.10 verified. Source: TB-21(R), issued Dec 1, 2025: 10.00% (prime 7.00% + 3%) for Jan 1 to Dec 31, 2026. That covers Apr 16 to Dec 31, 2026, the largest part of the TY2026 window. The calendar-2027 rate is unknown.
- Confirmed with no change: $400 threshold, 80% current safe harbor (NJ-2210 line 4a ".80"), 100% prior, the 2025 dates including June 16, 10.75% for 4/16/25-1/15/26, two-thirds farmers paying in full by Jan 15, NJ-2210NR income-percentage ratio, credit on NJ-1040 line 44. Small mismatch: the NJ-1040-ES says "more than $400", while the NJ-2210 says "$400 or more". The stored value is 400.

### New Mexico
- **farmer.rule (2025, 2026)**: `{current_pct: 0.9}` unverified -> same value, verified. Form RPD-41272 (2025), instruction 10, tells a qualified farmer to enter "100% of the required annual payment" on the Jan 15 column. Lines 5-7 define that payment as the lesser of 90% of current-year tax or 100% of prior-year tax. So NM uses 90%, not the federal 66 2/3%, even though its instructions call the rule "identical to the federal rule".
- **nonresident_method (2025, 2026)**: `other` unverified -> `ratio` verified. Source: 2025 Schedule PIT-B lines 12-14. Line 12 is the NM percentage (NM income / total income). Line 13 is tax on all net income. Line 14 multiplies them and goes to PIT-1 line 18.
- **holidays (2025, 2026)**: replaced the bank-holiday list and changed unverified -> verified. RPD-41272 says the Department "does observe Federal and State holidays", so the list is the union of:
  - federal holidays under 5 U.S.C. §6103 (read), with the Saturday-to-Friday move (§6103(b)) and Sunday-to-Monday move;
  - the State Personnel Board paid-holiday schedules: SPO General Memorandum 2024-007 for 2025 and 2025-015 for 2026. These add the Friday after Thanksgiving ("Presidents' Day (Observed)": 2025-11-28, 2026-11-27) and July 3, 2026.

  2027 carries only federal dates because the 2027 state schedule is not published. NMSA §12-5-2 itself still returns 403.

### New York
- **penalty.rate 2026**: 0.095 unverified -> 0.095 verified. Tax Law §685(c)(1) (read) applies the §697(j) underpayment rate. The Tax Department's quarterly pages give 8.5% for 4/1-6/30/26 and 9.5% for 7/1-9/30/26 and 10/1-12/31/26. 9.5% therefore covers the largest part of the window. **Note: Apr 16 to Jun 30, 2026 accrues at 8.5%, not 9.5%.**
- **holidays citation (2025, 2026)**: General Construction Law §24 was re-read verbatim through newyork.public.law, which reproduces the nysenate.gov text updated Oct 16, 2020. The list is unchanged. It includes Lincoln's Birthday, Flag Day (always a Sunday, and it does not move), each general election day, and the Sunday-to-next-day rule. A Saturday holiday is not moved.
- Confirmed: $300 threshold; 90% / 100% / 110% when NYAGI is over $150,000 ($75,000 MFS); the farmer rule (§685(c)(5)(C) style: 66 2/3%, Jan 15, March 1); 9.5% for all TY2025 quarters (IT-2105.9-I 2025).

### North Carolina
- **holidays (2025, 2026)**: a researcher doubt that turned out to be a material gap. NCDOR Directive TA-16-1 (read) says G.S. 105-263(a) makes IRC §§7502/7503 govern timeliness. So a "legal holiday" includes **District of Columbia legal holidays**: the Directive's own example rolls an April 15 due date for Emancipation Day. A statewide NC holiday also counts. The list is now G.S. 103-4 plus the federal/DC holidays. Added: Emancipation Day (2025-04-16, 2026-04-16, 2027-04-16), Juneteenth, 2026-07-03, 2027-06-18, 2027-12-24, 2027-12-31. G.S. 103-4 was re-read: R.E. Lee, Greek Independence, Halifax, Confederate Memorial, Mecklenburg, First Responders Day, Yom Kippur, election Tuesday. G.S. 103-5 alone would limit holidays to days when the office is closed, but TA-16-1 controls for tax.
- **penalty.rate 2026**: 0.07 unverified -> 0.07 verified. The NCDOR Interest Rate page shows 7% for July 1 to December 31, 2026, and 7% for all of 2025-2026.
- Confirmed in NC-40: $1,000 threshold, 90% (66 2/3% for farmers) / 100%, farmer pays by Jan 15 or files by March 1, Saturday/Sunday/holiday next-business-day rule.

### North Dakota: audit: pass
I re-read N.D.C.C. ch. 1-03. The holiday list matches §1-03-01: no Columbus Day and no Juneteenth. Under §§1-03-02/02.1, Sunday moves to Monday and Saturday to Friday for Jan 1, Jul 4, Nov 11 and Dec 25. 2026 ND-1ES: $1,000, 90% (66 2/3% for farmers), 12% interest, holiday roll.

### Ohio
- **farmer.rule (2025, 2026)**: `current_pct 0.9` unverified -> `1.0` verified. Sources:
  - The 2025 IT/SD 2210, "Farmers and Fishermen", requires "payment in full of the tax due". It prints "January 1, 2026", evidently meaning Jan 15.
  - Ohio Adm. Code 5703-7-04(C), re-read, is consistent.

  No 90% reduction exists for Ohio farmers. file_by stays 2026-03-02 (March 1, 2026 is a Sunday; the roll follows R.C. 1.14).
- Confirmed: R.C. 1.14 holiday list. A Saturday holiday is not moved, but R.C. 1.14 rolls any day the office is closed. Penalty rate: 8% for 2025 days and 7% for 2026 days (IT/SD 2210).

### Oklahoma
- **holidays (2025, 2026)**: the list was wrong. 25 O.S. 2021 §82.1 is reproduced in HB 1692 (2025, as introduced), and it has **no Juneteenth and no Columbus Day**. Removed 2025-06-19, 2026-06-19 and 2027-06-18. Added 2027-12-23 and 2027-12-24 (Christmas 2027 is a Saturday, so the Thursday and Friday before are holidays). The row stays unverified for two reasons. First, the Governor's executive order chooses the day before or after Christmas in 2025 and 2026; I omitted those dates, and they cannot move any due date. Second, HB 1692 inserts "the day upon which any General Election is held", and its underlining was lost in extraction.
- **installments.due_dates 2025**: unverified -> verified (value unchanged, June 16). §82.1(A) makes Saturday and Sunday holidays, and §82.1(C) allows next-business-day performance.
- **farmer.rule (2025, 2026)**: unverified -> verified (mapping unchanged). Farmers are genuinely exempt. The 511 packet p.5 and line 22, the 511-NR packet and the OTC Pay Taxes page all say "estimated payments are not required" when 2/3 or more of gross income is from farming, this year or last.
- **nonresident_method (2025, 2026)**: `ratio` unverified -> verified. 2025 Form 511-NR packet: tax on all income × OK-source AGI / AGI from all sources (lines 16-18).
- Confirmed: 70% current / 100% prior (511 packet and OTC page), $500 requirement, 20% interest.

### Oregon
- **farmer.rule (2025, 2026)**: unverified -> verified (mapping unchanged). Farmers are genuinely exempt. The 2026 OR-ESTIMATE says "you don't have to make Oregon estimated tax payments". The 2025 OR-10 Exception 1 says no underpayment interest.
- Confirmed: ORS 187.010, re-read: Juneteenth included, no Columbus Day, Saturday moves to Friday, Sunday to Monday. 9% for 2025 and 8% for 2026 (OR-10 instructions). 90% / 100% safe harbors.

### Pennsylvania
- **holidays (2025, 2026)**: values unchanged, citation rewritten, status stays unverified. 1 Pa.C.S. §1908 (read) excludes "any day made a legal holiday by the laws of this Commonwealth or of the United States", so the federal list is properly included. The Pennsylvania-only list (44 P.S. §11: Good Friday, Flag Day, Election Day) is still unread. One piece of evidence: the 2026 REV-413(I) prints Jun 15, 2026 even though Flag Day, June 14, 2026, is a Sunday. So the Department does not treat Flag Day as a roll day.
- Confirmed in the 2025/2026 REV-413(I):
  - Threshold: $338 for 2025 and $430 for 2026 (worksheet: "$338 or greater").
  - Safe harbors: 90% per installment period, or the current rate × prior-year net PA taxable income for full-year residents only.
  - Farmers: two-thirds rule; pay all estimated tax by Jan 15, or file by March 2, 2026 (TY2025) / March 1, 2027 (TY2026).
  - Interest: REV-1611 7% for 2025-2026.

## Residual unverified rows
- **OK 2025/2026 holidays**: depends on the Governor's executive order (Christmas Eve or the day after) and on whether general election day was added by HB 1692. No current due date is affected.
- **PA 2025/2026 holidays**: the Pennsylvania Legal Holiday Law text (44 P.S. §11) has not been read.

## Rates that change mid-window (single-rate key; value = rate covering the largest part)
- **NJ 2025**: 10.75%, then 10.00% from 1/16/26.
- **NJ 2026**: 10.00% (2027 unknown).
- **NY 2026**: 8.5% for 4/16-6/30/26, then 9.5%.
- **NC 2026**: 7% (2027 unknown).
- **OH**: 8% then 7%.
- **OR**: 9% then 8%.
- **MO-style caution** applies to all of the above.

## Rules the key set cannot express
- **Exempt farmers (OK, OR)**: stored as `current_pct: 0` with due_date and file_by set to the return due date. **The engine must treat `current_pct = 0` as "no installments, no penalty"**, not as a divide-by-zero or as a single Jan-15 installment of zero.
- **NM farmers**: use 90% of current-year tax *or* 100% of prior-year tax (the full required annual payment). `farmer.rule.current_pct` cannot carry the prior-year alternative.
- **NY**: the high-AGI threshold is $75,000 for MFS. A return filed and paid by Jan 31 waives the 4th-installment penalty (§685(c), "Special rule where return filed on or before January thirty-first"). NM has the same Jan 31 rule (PIT-ES).
- **NC due-date holidays** include DC Emancipation Day (federal §7503 incorporation). Other states' lists do not.
- **OK has two thresholds**: estimates are required at $500 of liability over withholding, but no underpayment interest is charged if the tax shown on the return is under $1,000.
- **ND requires all of these**: the taxpayer must pay federal estimates, prior-year ND liability must be ≥ $1,000, and current-year tax after withholding must be ≥ $1,000.
- **OH threshold** is strictly "more than $500". **NJ** says "more than $400" on the ES and "$400 or more" on the 2210.
- **PA safe harbors**: the prior-year option is prior-year taxable income × the current rate, available to full-year residents only. The 90% test is applied per installment period. PA's threshold is set as an income amount ($11,000 / $14,000).
- **Annualized-income methods** and late-start installment schedules (NJ, NM, PA tables) are not expressible.
