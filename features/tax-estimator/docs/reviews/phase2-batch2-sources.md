# Phase 2 batch 2 state rules: sources and review notes

Researcher: state-rules-researcher, 2026-10-11. Jurisdictions: AL, AZ, CA, CO, CT, DE, DC, GA; tax years 2025 and 2026. Seed files: `packages/api/src/db/seeds/tax-estimator/state-rules/<ST>.ts`. Method: documents fetched with curl/WebFetch and read as text (pdftotext); `verified` only where the figure was read in the cited primary document during this task. Dates are stored rolled to the next business day where the state's rule says so (seed convention from MO/AR); holidays cover calendar years Y and Y+1.

## Counts per state-year (13 keys each)

| State-year | verified | unverified |
|---|---|---|
| AL 2025 | 7 | 6 |
| AL 2026 | 9 | 4 |
| AZ 2025 | 11 | 2 |
| AZ 2026 | 8 | 5 |
| CA 2025 | 13 | 0 |
| CA 2026 | 12 | 1 |
| CO 2025 | 12 | 1 |
| CO 2026 | 10 | 3 |
| CT 2025 | 13 | 0 |
| CT 2026 | 13 | 0 |
| DE 2025 | 13 | 0 |
| DE 2026 | 13 | 0 |
| DC 2025 | 11 | 2 |
| DC 2026 | 11 | 2 |
| GA 2025 | 11 | 2 |
| GA 2026 | 10 | 3 |

## Documents fetched (primary sources)

**Alabama**: Form 40ES 2026 Instructions (revenue.alabama.gov/wp-content/uploads/2026/01/26f40esinstr.pdf); Form 2210AL 2025 (.../2026/01/25f2210al.pdf); Form 2210AL Instructions TY2024 (.../2025/01/24f2210al_inst.pdf); Form 40 Booklet TY2024 (.../2025/01/24f40bk.pdf); Form 40NR Booklet TY2024 (.../2025/01/24f40nrbk.pdf); 2026 Official State Holidays (rsa-al.gov/about-rsa/holidays). The 2025 Form 40ES instructions (25f40esinstr.pdf) returned 404 at every guessed path; Code of Alabama 1-3-8 host (alisondb.legislature.state.al.us) unreachable.

**Arizona**: Form 140ES 2025 Instructions (azdor.gov/sites/default/files/document/FORMS_INDIVIDUAL_2025_140ESi.pdf); Form 140ES 2026 Booklet (.../FORMS_INDIVIDUAL_2026_140ESBooklet.pdf); azdor.gov/individuals/individual-estimated-tax-payments; Form 221-SBI 2025 instructions (.../FORMS_INDIVIDUAL_2025_221-SBIi.pdf; the individual Form 221 was not fetched, the SBI version shares the rules); azdor.gov/business/interest-rates; Form 140 and 140NR Booklets 2025; A.R.S. 1-301 and 1-303 (azleg.gov).

**California**: 2025 and 2026 Instructions for Form 540-ES (ftb.ca.gov/forms/2025|2026/20xx-540-es-instructions.pdf); Form FTB 5805 2025 (ftb.ca.gov/forms/2025/2025-5805.pdf); FTB interest and estimate penalty rates page (ftb.ca.gov/pay/penalties-and-interest/interest-and-estimate-penalty-rates.html); Secretary of State State Holidays page (sos.ca.gov/state-holidays). Government Code 6700 (leginfo) returned 403.

**Colorado**: DR 0104EP 2025 and 2026 (tax.colorado.gov/sites/tax/files/documents/DR0104EP_2025.pdf, .../sites/default/files/documents/DR_0104EP_2026.pdf, both rev. 06/10/25 content); DR 0204 (09/25/25) (.../DR0204_2025.pdf); DR 0104 Booklet 2025 incl. DR 0104PN and DR 0104CR (.../Book104_2025.pdf); Tax Topics: Penalties and Interest; Individual Income Tax Guide; Colorado State Holidays (tax.colorado.gov/holidays). Direct curl was 403; PDFs obtained through WebFetch's saved copies. C.R.S. 24-11-101 not read.

**Connecticut**: Form CT-1040ES 2025 (Rev. 01/25) and 2026 (Rev. 01/26) (portal.ct.gov/-/media/drs/forms/2025/...); Informational Publication 2021(2); Legal State Holidays page (portal.ct.gov/about/legal-state-holidays). cga.ct.gov certificate failed so C.G.S. 1-4 text itself was not read (the state portal restates it).

**Delaware**: PIT-EST Instructions 2025 (revenuefiles.delaware.gov/2024/PIT_2024_Forms/PIT_Instructions/PIT-EST_2025-01_Instructions.pdf) and 2026 (rev. 11/10/25) (.../2025/PITForms_Instructions/Instructions/PIT-EST_Instructions_2026-01.pdf); PIT-NON and PIT-RES Instructions 2025; legacy Form 200-ES (old, superseded; used only for context); 1 Del. C. 501 (delcode.delaware.gov/title1/c005).

**District of Columbia**: OTR Underpayment of Estimated Tax Interest page; OTR Individual Income Tax Forms page (D-40ES voucher dates 2022-2026); Form D-2210 (rev. 09/2024) (otr.cfo.dc.gov/.../2024_D2210_0002_121824.pdf); D.C. Code 47-1812.08, 47-1806.01, 47-1806.04, 1-612.02 (code.dccouncil.gov, read through WebFetch excerpts). The 2025/2026 D-2210 and D-40ES instructions were not retrieved.

**Georgia**: Form 500-ES 2025 and 2026 instructions (dor.georgia.gov/document/document/20xx-500-es-estimated-tax-individuals-and-fiduciaries/download); Form 500 UET (Rev. 07/15/25, tax years 2025 and later); IT-511 2025 Individual Income Tax Booklet; State of Georgia Holiday Schedule (team.georgia.gov/all-articles/state-georgia-holiday-schedule, 2026 and 2027 only).

## Unverified rows and reasons

**AL 2025**
- `safe_harbor.prior_pct`: UNVERIFIED for TY2025: the 2025 Form 40ES instructions could not be retrieved (25f40esinstr.pdf returns 404). Consistent evidence: Form 40 Booklet TY2024 ("100% of your 2023 tax"), Form 2210AL (2025) line 7 "maximum required annual payment based on prior year's tax", Form 40ES 2026 Instructions item 2b (100% of 2025 tax; 12-month return).
- `safe_harbor.high_agi_rule`: UNVERIFIED for TY2025: 2025 Form 40ES instructions not retrievable. Form 2210AL instructions for TY2024 (24f2210al_inst.pdf: "If your AGI for 2024 was more than $150,000 ($75,000 if ... married filing separately), substitute 110% for 100%") and Form 40ES 2026 Instructions "Special Rule for Higher Income Taxpayers" both state it; MFS threshold is $75,000 (single value stored).
- `farmer.rule`: PARTLY UNVERIFIED: Form 2210AL (2025) Part IV (66 2/3% of 2025 tax, payments by January 15, 2026, farmers with at least two-thirds of 2024 or 2025 gross income from farming/fishing) read; the March 1 file-and-pay alternative was read only in Form 40 Booklet TY2024 ("total tax by March 1, 2025") and 2026 instructions ("March 1, 2027"). March 1, 2026 is a Sunday, so file_by is rolled to 2026-03-02 (seed convention; ...
- `credit_for_other_state`: UNVERIFIED for TY2025: read only in the Alabama Form 40 Booklet for TY2024, Form 40A eligibility ("You are not claiming credit for taxes paid to another state") and Form 40NR booklet (line "Taxes paid to another state"). Code of Alabama 40-18-21 not read.
- `nonresident_method`: UNVERIFIED for TY2025: Form 40NR Booklet TY2024, "Page 2, Part III"/Part II: personal and dependent exemptions and itemized/standard deductions are prorated by the ratio of Alabama income to total income, then tax rates apply to Alabama taxable income - neither a ratio of the full return nor a flat rate. 2025/2026 booklets not read.
- `holidays`: UNVERIFIED for 2025 dates: State of Alabama 2026 Official State Holidays (rsa-al.gov/about-rsa/holidays: "Holidays that fall on Sunday are observed on Monday; holidays that fall on Saturday are observed on Friday") read for 2026 only; 2025 and 2027 dates computed from the same pattern, no official 2025 or 2027 list retrieved. Mardi Gras (Mobile/Baldwin counties only) and Mrs. Rosa L. Parks Day (commemorative) omit...

**AL 2026**
- `penalty.rate`: UNVERIFIED for TY2026: the 2026 Form 2210AL is not published. 0.07 carried from Form 2210AL (2025) line 11; Alabama DOR notices cite a quarterly rate under Code 40-1-44 (6% for Q2 2026, 7% from July 2026, per Bloomberg Tax/DOR notice summaries), so the rate may differ.
- `credit_for_other_state`: UNVERIFIED for TY2026: read only in the Alabama Form 40 Booklet for TY2024, Form 40A eligibility ("You are not claiming credit for taxes paid to another state") and Form 40NR booklet (line "Taxes paid to another state"). Code of Alabama 40-18-21 not read.
- `nonresident_method`: UNVERIFIED for TY2026: Form 40NR Booklet TY2024, "Page 2, Part III"/Part II: personal and dependent exemptions and itemized/standard deductions are prorated by the ratio of Alabama income to total income, then tax rates apply to Alabama taxable income - neither a ratio of the full return nor a flat rate. 2025/2026 booklets not read.
- `holidays`: UNVERIFIED for 2027 dates: State of Alabama 2026 Official State Holidays (rsa-al.gov/about-rsa/holidays) read for 2026 (matches this list); 2027 dates computed from the same pattern (no official 2027 list retrieved). Mardi Gras and Parks Day omitted. Calendar years 2026-2027.

**AZ 2025**
- `required_threshold`: UNVERIFIED MAPPING: Arizona has no tax-due threshold. Arizona Form 140ES 2025 Instructions ("Required Payments") requires estimates only if Arizona gross income for the prior year AND the current year each exceed $75,000 ($150,000 married filing joint; $75,000 single/MFS/HOH). Key cannot express a gross-income test; 0 stored (always show estimates; penalty exposure only above the gross-income test).
- `farmer.rule`: PARTLY UNVERIFIED: Arizona Form 140ES 2025 Instructions item 2 (farmer/fisherman "for federal purposes" makes one installment due January 15, 2026; no estimate required if the return is filed on or before March 1, 2026 and paid in full) read. The two-thirds ratio and 66 2/3% current-year percent are not stated by Arizona (it incorporates the federal IRC 6654(i) farmer definition) and are federal values. March 1, 2...

**AZ 2026**
- `required_threshold`: UNVERIFIED MAPPING: Arizona has no tax-due threshold. azdor.gov Individual Estimated Tax Payments page and Arizona Form 140ES 2026 Booklet ("Required Payments") requires estimates only if Arizona gross income for the prior year AND the current year each exceed $75,000 ($150,000 married filing joint; $75,000 single/MFS/HOH). Key cannot express a gross-income test; 0 stored (always show estimates; penalty exposure o...
- `farmer.rule`: PARTLY UNVERIFIED: Arizona Form 140ES 2026 Booklet item 2 (one installment due January 15, 2027; no payment required if the 2026 return is filed on or before March 1, 2027 and paid in full) read. Ratio 2/3 and 66 2/3% are the federal IRC 6654(i) values Arizona incorporates by reference, not stated by Arizona.
- `penalty.rate`: UNVERIFIED for TY2026: Arizona sets the rate quarterly; azdor.gov Interest Rates table shows 7% (Q1 2026), 6% (Q2 2026), 7% (Q3 2026); the Q4 2026 and 2027 rates were not published at research time. 0.07 is the latest observed rate.
- `credit_for_other_state`: UNVERIFIED for TY2026: Arizona Form 140 Booklet 2025, Credit for Taxes Paid to Another State ("Credit Form 309 is used to claim a tax credit on Form 140 for taxes paid to other states ...") - 2025 booklet; the 2026 booklet is not yet published
- `nonresident_method`: UNVERIFIED for TY2026: Arizona Form 140NR Booklet 2025: Arizona-source income taxed at the flat 2.5% rate (2025 Form 140ES instruction: "the tax rate for estimating your tax liability is 2.5%"); standard deduction prorated by the Arizona income ratio ("You must prorate the standard deduction"). 2026 booklet not published; 2.5% rate per 2026 Form 140ES booklet worksheet.

**CA 2026**
- `holidays`: UNVERIFIED for 2027 dates: California Secretary of State "State Holidays" page lists 2026 as printed; the 2027 dates are computed from the same pattern (no official 2027 list retrieved). Calendar years 2026-2027.

**CO 2025**
- `holidays`: UNVERIFIED: Colorado DOR "Colorado State Holidays" page (tax.colorado.gov/holidays) lists 2026 only (Frances Xavier Cabrini Day on the first Monday of October, Juneteenth June 19, Independence Day observed Friday July 3). C.R.S. 24-11-101 itself was not read; 2025 dates and Saturday/Sunday observance pattern computed from the 2026 list. Calendar years 2025-2026.

**CO 2026**
- `credit_for_other_state`: UNVERIFIED for TY2026: read in the Colorado DR 0104 Booklet 2025 ("Lines 27-34 Credit for Tax Paid to Another State") and DOR Individual Income Tax Guide; 2026 booklet not published.
- `nonresident_method`: UNVERIFIED for TY2026: DR 0104PN lines 34-36 and DR 0104 Booklet 2025 (apportioned tax = table tax x Colorado percentage); 2026 booklet not published.
- `holidays`: UNVERIFIED: Colorado DOR "Colorado State Holidays" page lists 2026 only; 2027 dates computed from the same pattern (DHR schedule snippets show 2027 New Year, MLK, Presidents, Memorial, Juneteenth observed June 18). C.R.S. 24-11-101 not read. Calendar years 2026-2027.

**DC 2025**
- `farmer.rule`: UNVERIFIED absence: D.C. Code 47-1812.08(i) (read via excerpt) contains no farmer/fisherman provision; D-2210 (rev. 09/2024) lists no farmer rule.
- `installments.pcts`: UNVERIFIED for TY2025: D-2210 (rev. 09/2024) line 6 ("Multiply Line 5 amount by 25%") and D.C. Code 47-4203 (via search summary) give four 25% installments; TY2025 D-2210 not retrieved.

**DC 2026**
- `farmer.rule`: UNVERIFIED absence: D.C. Code 47-1812.08(i) (read via excerpt) contains no farmer/fisherman provision; D-2210 (rev. 09/2024) lists no farmer rule.
- `installments.pcts`: UNVERIFIED for TY2026: D-2210 (rev. 09/2024) line 6 ("Multiply Line 5 amount by 25%") and D.C. Code 47-4203 (via search summary) give four 25% installments; TY2026 D-2210 not retrieved.

**GA 2025**
- `required_threshold`: UNVERIFIED MAPPING: Georgia Form 500-ES 2025 (Rev. 07/24/24) instructions require estimates when gross income exceeds exemptions + estimated deductions + $1,000 of income not subject to withholding - an income-based test, not a tax-due threshold. $1,000 stored as the nearest representable figure.
- `holidays`: UNVERIFIED for 2025 dates: State of Georgia Holiday Schedule (team.georgia.gov/all-articles/state-georgia-holiday-schedule) lists only 2026 and 2027; 2026 dates are as printed there (including Good Friday April 3, the Friday after Thanksgiving, and Washington's Birthday observed Dec 24); 2025 dates computed from the same pattern (Good Friday April 18, 2025 assumed state holiday). Calendar years 2025-2026.

**GA 2026**
- `required_threshold`: UNVERIFIED MAPPING: Georgia Form 500-ES 2026 (Rev. 05/12/25) instructions require estimates when gross income exceeds exemptions + estimated deductions + $1,000 of income not subject to withholding - an income-based test, not a tax-due threshold. $1,000 stored as the nearest representable figure.
- `credit_for_other_state`: UNVERIFIED for TY2026: IT-511 2025 Booklet "Other State's Tax Credit Worksheet"; 2026 booklet not published.
- `nonresident_method`: UNVERIFIED for TY2026: Georgia IT-511 2025 Booklet, Form 500 Schedule 3 (Georgia-source income, prorated deductions, flat rate); 2026 booklet not published.

## Rules the key set cannot fully express

- **AZ and GA required_threshold**: both states test gross income, not tax due (AZ: prior- and current-year Arizona gross income each over $75,000, $150,000 MFJ; GA: gross income over exemptions + deductions + $1,000 of income not subject to withholding). AZ stored as 0 and GA as 1000, both marked unverified mappings. The auditor/engine owner should decide how the engine handles an income-based test.
- **Single-rate penalty key**: AL, AZ, CA, CO and MO-style rates change mid-period (CO 12% -> 11%, CA 8% -> 7%, AZ quarterly 7/6/7). DC is 10% compounded daily; CT is 1% per month or fraction; DE is 1.5% per month or fraction (stored as 12% and 18% annual).
- **MFS-specific thresholds** (AL, CA, CO, DE high-AGI at $75,000; CA $250 MFS estimate threshold) cannot be expressed; single-filer values stored.
- **CA**: 30/40/0/30 schedule has a placeholder date for the 0% third installment; the AGI >= $1,000,000 current-year-only rule is not expressible; early-filing relief (file and pay by January 31 in lieu of the 4th installment, also AZ February 1, CT/DE/CO January 31) is not in the key set.
- **CO**: 70% current-year safe harbor with a separate annualized schedule (17.5/35/52.5/70%).
- **DC**: nonresidents are not subject to the individual income tax on wages (only the unincorporated business franchise tax), so `nonresident_method = other`; installment percentages and farmer absence unverified for 2025-2026.
- **AL and GA nonresident**: prorated deductions/exemptions by an income ratio with rates applied to in-state income; stored as `other` (AL) and `sourced_flat` (GA, AZ).
- **Alternative safe harbors** (GA Exceptions 1-3 prior-year income at current rates, 90% period tests; AL/CO annualized) are not represented.
- **Holidays**: DE Sussex County Return Day and AL Mardi Gras (two counties) omitted; observed Friday/Monday shifts are included together with the statutory date.

## What the auditor should re-check first

1. AZ and GA `required_threshold` mapping.
2. `farmer.rule` ratio/current_pct for AZ (federal values assumed) and AL 2025 (Mar 1 date from TY2024 booklet).
3. Penalty rates for TY2026 (AL, AZ unverified) and the period caveats for CO, CA.
4. DC installment percentages, farmer absence, and whether DC should roll June 15, 2025 (Sunday) to 2025-06-16 (assumed).
5. Delaware first installment April 30 and the 2025 June 16 roll (no roll language in the instructions; assumed).
6. Holiday lists for AL, CO, GA 2025 (computed from patterns).
7. Rolled `farmer.rule.file_by` for TY2025 (2026-03-02) follows the MO convention; states print "March 1" except CA, which prints March 2, 2026.
