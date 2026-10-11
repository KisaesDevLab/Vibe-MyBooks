# Phase 2 audit: state rules batches 2 and 3 (AL AZ CA CO CT DE DC GA / HI ID IL IN IA KS KY LA)

Auditor: tax-law-researcher (audit pass), 2026-10-11. Scope: tax years 2025 and 2026, 13 keys per state-year, files `packages/api/src/db/seeds/tax-estimator/state-rules/<ST>.ts`. Researcher reports audited: `phase2-batch2-sources.md` and `phase2-batch3-sources.md`.

## Method

The auditor re-read every state's primary sources independently: revenue-department estimated-tax forms and instructions, underpayment-penalty forms, statutes and official holiday lists. Each row's citation now names the document and line or section read during this audit.

- **Verified** means the figure was read in a primary source during this audit.
- **Unverified** means it could not be confirmed. The reason is in the row's citation.
- No status was raised to verified from memory.
- Secondary sites were used only to locate documents. Two exceptions are flagged where they arise: the GA statute text came from a third-party mirror (onecle), and the IA prime-rate projection came from FRED.

**Validation** (both clean):
- A throwaway script, `scratchpad/validate.ts`, run with `npx tsx` from `packages/api`, prints `OK` for all 16 states. It checks that:
  - each state-year has exactly the 13 keys, each once;
  - every value passes `validateStateRuleValue`;
  - no citation is empty;
  - installment percentages sum to 1.
- `npx tsc --noEmit -p .` in `packages/api` exits 0.

**Before/after values** come from `git show HEAD:` for each file. All 16 files were unmodified at HEAD when the audit started.

## Settled suspects

| Suspect | Verdict |
|---|---|
| **Idaho requires individual estimates (Form 51 / I.C. 63-3029B, ~$500)** | **Not supported. The researcher was right.** The auditor re-read these sources personally:<br>- tax.idaho.gov/taxes/income-tax/withholding/help/: "Idaho doesn't require estimated tax payments from individuals, but you can make payments at any time using either of these methods: Form 51 ...".<br>- 2025 booklet EIN00046 (rev. 03-02-2026): "Idaho doesn't require estimated tax payments."<br>- I.C. 63-3036A(a): the $500 test begins "Any corporation subject to this chapter ...". It is corporate only.<br>- I.C. 63-3029B is the capital-investment credit.<br>- I.C. 63-3046 has no addition for underpaying estimated tax.<br>- IDAPA 35.01.01 Rules 820-825 are titled "Corporate Estimated Payments".<br>- Form 51's 80%/100% figures are the **extension** payment test of I.C. 63-3033(a). Missing it costs 2% per month under 63-3033(f). That is not an estimated-tax penalty. |
| **AZ threshold (gross-income test)** | A.R.S. 43-581(A) requires estimates only if Arizona gross income exceeds $75,000 ($150,000 MFJ) in **both** the prior and current year. Separately, 43-581(E)(2) and Form 221 line 6 say there is no penalty if tax due after withholding and credits is under $1,000. **Mapping: `required_threshold` = 1000** (was 0), still unverified as a partial mapping. The gross-income test is an extra AND condition the key cannot carry. |
| **GA threshold** | Georgia has **no** tax-due minimum, and there is no "$500" or "$1,000 tax" penalty test (checked in 500 UET Rev. 07/15/25, O.C.G.A. 48-7-120, IT-511 2025). The $1,000 in 48-7-114(b) and on Form 500-ES is an **income** test: gross income over exemptions plus deductions plus $1,000 of income not subject to withholding. **Mapping: `required_threshold` = 0** (was 1000), unverified mapping. Storing 1000 would wrongly exempt, for example, a self-employed filer owing $400. |
| **CA 30/40/0/30 and the $1M rule** | Confirmed in the 2025 and 2026 540-ES instructions and FTB 5805. The 3rd installment carries 0% on a placeholder date (2025-09-15 / 2026-09-15).<br>The $1,000,000 rule ($500,000 MFS) is tested on **current-year** CA AGI. It removes the prior-year safe harbor entirely, leaving 90% of current-year tax. The key set cannot express it; the citation flags it. |
| **AL 2025 carried from TY2024** | Resolved. The 2025 Form 40ES instructions were read from an Internet Archive capture of revenue.alabama.gov/.../2025/02/25f40esinstr.pdf. The 2025 2210AL, 2025 40 and 2025 40NR booklets were also read. All 2025 rows are now verified. |
| **DC D-2210 percentages** | Four 25% installments, from D.C. Code 47-4203(b)(1)(B) and the TY2025 D-2210 (Rev. 05/2025) line 6. The governing section is 47-4203, not 47-1812.08 or 47-1812.14. 110% of prior-year tax applies to **every** individual, with no AGI test. |

## Per state-year verdicts and corrections

Format: `key: before -> after (source)`. Status changes are listed separately. In these lists, "U" means unverified and "V" means verified.

### AL

**AL 2025**
- Corrections:
  - `holidays`: removed 2025-06-19 and 2025-11-28.
    - Source: the official State of Alabama 2025 holiday list (rsa-al.gov, archive capture 2025-10-30).
    - Juneteenth was added to Code 1-3-8 by Act 2025-303 and is kept from 2026 on.
    - The day after Thanksgiving is a holiday only when the Governor designates it, and 2025 had no designation.
- Status U->V: `safe_harbor.prior_pct`, `safe_harbor.high_agi_rule`, `farmer.rule`, `credit_for_other_state`, `nonresident_method`, `holidays`.
- Sources: 2025 40ES instructions items 1-2 and "Special Rule for Higher Income Taxpayers"; 2025 2210AL; Code 40-18-21, 40-18-80, 1-1-4, 1-3-8.

**AL 2026**
- Corrections:
  - `penalty.rate_source`: 'state' -> **'federal'**.
  - `penalty.rate`: 0.07 (U) -> null (V).
  - Source: Code 40-18-80(a) requires individual estimates "in accordance with 26 U.S.C. § 6654", which uses the IRC 6621 underpayment rate. Code 40-1-44(a) also uses the 6621 rate. The 2025 2210AL simply printed .07, the federal rate in force.
- Status U->V: `credit_for_other_state`.
- Residual unverified: `nonresident_method` (the 2026 40NR is not published) and `holidays` (2027 dates computed from 1-3-8; 2027-11-26 assumes the Governor designates it).

### AZ

**AZ 2025**
- Corrections:
  - `required_threshold`: 0 -> 1000. Still U (mapping). See "Settled suspects".
  - `holidays`: removed 2025-06-02, 2025-08-14, 2025-09-17, 2026-06-02, 2026-08-14 and 2026-09-17. Under A.R.S. 1-301(D)-(F), Native American Day, Navajo Code Talkers Day and Constitution Commemoration Day are observed on a Sunday, so they never close a business day.
- Residual unverified: `farmer.rule`. Arizona says only "farmer for federal purposes", with one installment due Jan 15 and no payment needed if the return is filed and paid by Mar 1. The 2/3 ratio and 66 2/3% are federal IRC 6654(i) values, not stated in Arizona's own text.

**AZ 2026**
- Corrections:
  - `required_threshold`: 0 -> 1000 (U mapping).
  - `holidays`: removed the same three Sunday-observed days for 2026 and 2027.
- Status U->V: `credit_for_other_state` (A.R.S. 43-1071) and `nonresident_method` (A.R.S. 43-1091/1094/1095 and the 2026 140ES at 2.5%).
- Residual unverified:
  - `farmer.rule`: same reason as 2025.
  - `penalty.rate` 0.07: the rate is quarterly. The azdor table shows 6% for Q2 2026 and 7% for the rest of 2026; the rate for Jan 1-Apr 15, 2027 is not published.

### CA

**CA 2025**: audit: pass. Citations were sharpened:
- `high_agi_rule` now flags the $1M rule.
- `penalty.rate` now notes the FTB rate is 8% for 1/1-6/30/2025 and 7% from 7/1/2025.

**CA 2026**: audit: pass on values.
- Residual unverified: `holidays` (2027 dates computed from the CalHR rule; no official 2027 list).

The statutes were not readable (leginfo returned 403 for R&TC 19136.3 and Gov. Code 6700). The FTB forms carry the verification.

### CO

**CO 2025**: audit: pass on values.
- The farmer `current_pct` of **0.5 is correct**. DR 0104EP says "50% of the actual net Colorado tax liability", and DR 0204 line 4(b) says "only enter 50%". Farmers get no 110% uplift (line 5(b)).
- The penalty is 12% for 2025 days and 11% for 2026 days (DR 0204 lines 15/18).
- Residual unverified: `holidays` (no official 2025 list was readable).

**CO 2026**: audit: pass on values.
- Residual unverified: `credit_for_other_state` and `nonresident_method` (the 2026 booklet is not published), and `holidays` (2027 dates computed).

### CT

**CT 2025**: audit: pass on values.
- Citations were rebuilt on the 2025 CT-2210 (Rev. 12/25) and C.G.S. 12-701(a), 12-722, 12-704 and 1-4, because the 2025 CT-1040ES is no longer retrievable.
- The nonresident ratio's denominator is **CT AGI**, not federal AGI.
- `high_agi_rule` null is verified: chapter 229 contains no 110% rule.

**CT 2026**
- Corrections:
  - `holidays`: added 2027-12-31. New Year's Day 2028 falls on a Saturday, so C.G.S. 1-4 makes the preceding Friday the holiday.
- All rows verified.

### DE

**DE 2025**
- Corrections:
  - `holidays`: added 2025-05-26 and 2026-05-25. Memorial Day is a legal holiday under 1 Del. C. 501, and the seed had left it out.
- The June 16, 2025 roll is now grounded in 30 Del. C. 551(d) instead of being assumed.
- Statute references corrected:
  - threshold: 30 Del. C. 1169 ("exceed $800");
  - penalty: 30 Del. C. 535(b), 1.5% per month or fraction of a month.
- All rows verified.

**DE 2026**
- Corrections:
  - `holidays`: added 2026-05-25, 2027-05-31 and 2027-12-31.
- All rows verified.

### DC

**DC 2025 and 2026**: audit: pass on values.
- Status U->V: `installments.pcts` and `farmer.rule` (null) in both years. Sources: D.C. Code 47-4203 and 47-1812.08(i), and the TY2025 D-2210, none of which has a farmer provision.
- All 26 rows verified.

### GA

**GA 2025**
- Corrections:
  - `required_threshold`: 1000 -> 0 (U mapping). See "Settled suspects".
  - `nonresident_method`: 'sourced_flat' -> 'ratio'. Form 500 Schedule 3 (Rev. 07/09/25) prorates deductions by Georgia AGI ÷ total AGI and then applies the flat rate. At a single flat rate that equals resident-basis tax × the Georgia ratio.
  - `holidays`: added 2025-12-26. The georgia.gov "Georgia State Holidays 2025" page says Washington's Birthday is observed that day. Status U->V.
- The penalty is a fixed 9% "for tax years 2025 and later" (500 UET). It is not the O.C.G.A. 48-2-40 prime+3% interest rate.

**GA 2026**
- Corrections:
  - `required_threshold`: 1000 -> 0 (U).
  - `nonresident_method`: 'sourced_flat' -> 'ratio' (U; the 2026 IT-511 is not published).
- Residual unverified: `required_threshold`, `credit_for_other_state` and `nonresident_method`.
- Source caveat: the O.C.G.A. text was read only from a third-party mirror (onecle, 2016). Every verified row also rests on a current DOR document.

### HI

**HI 2025**
- Corrections:
  - `farmer.rule.ratio`: 0.6666666667 -> 0.6666666666, the convention of storing "at least 2/3" just under 2/3.
  - `farmer.rule.file_by`: 2026-03-01 -> 2026-03-02. Under HRS 1-32 a Sunday deadline moves to the next business day.
- The farmer `current_pct` of 0.6 is **correct**. HRS 235-97(f)(4) sets the required annual payment at 60% of current-year or 100% of prior-year tax for everyone, farmers included. For the same reason `high_agi_rule` stays null.

**HI 2026**
- Corrections:
  - `farmer.rule.ratio`: 0.6666666667 -> 0.6666666666.
- Status U->V:
  - `penalty.rate_source` and `penalty.rate`: HRS 235-97(f), 2/3 of 1% per month or fraction of a month.
  - `credit_for_other_state`: HRS 235-55.
  - `nonresident_method`: HRS 235-5.
  - The statutes were read via data.capitol.hawaii.gov.
- All rows verified.

### ID

**ID 2025**
- Corrections:
  - `nonresident_method`: 'ratio' -> 'sourced_flat'. On Form 43, line 41 is Idaho-source income less a prorated deduction, and line 42 applies 5.3% (I.C. 63-3026A). Tax is not computed on total income and then multiplied by a percentage.

**ID 2026**
- Corrections:
  - `nonresident_method`: 'ratio' -> 'sourced_flat', status U->V.
- Status U->V: `credit_for_other_state` (I.C. 63-3029(1)).

**Residual unverified in both years (deliberate):** `required_threshold` 0, `safe_harbor.current_pct` 0.8, `safe_harbor.prior_pct` 1.0, `installments.due_dates`, `installments.pcts`, `penalty.rate_source` and `penalty.rate` 0.06.
- These are **modelling placeholders** for a state with no requirement.
- The 6% is Idaho's post-due-date interest rate (6% in 2025, 2026 and 2027).

### IL

**IL 2025**
- Corrections:
  - `holidays`: the basis changed from the 80 IAC 303.190 employee list to the statutory list in 205 ILCS 630/17(a), with the roll rule in 5 ILCS 70/1.11.
    - Added Pulaski Day (2025-03-03, 2026-03-02) and Good Friday (2025-04-18, 2026-04-03).
    - The day after Thanksgiving is not statutory and stays out.
    - Status U->V.
- Values pass:
  - threshold: $1,000 (35 ILCS 5/803(a));
  - safe harbor: 90%/100% (804(c)), with no high-AGI rule (the old 150% rule expired in 2012);
  - farmers are **exempt** (803(a),(e)), so `farmer.rule` null means exempt;
  - penalty: 2%/10% flat (35 ILCS 735/3-3(b-25)), so `penalty.rate` is null.

**IL 2026**
- Corrections:
  - `holidays`: added 2026-03-02, 2026-04-03, 2027-03-01 and 2027-03-26. Status U->V.
- Status U->V: `nonresident_method` (35 ILCS 5/301(c); Schedule NR lines 46-52).
- All rows verified.

### IN

**IN 2025**
- Corrections:
  - `holidays`: added Lincoln's Birthday and Washington's Birthday, which are statutory under IC 1-1-9-1 (2025-02-12, 2025-02-17, 2026-02-12, 2026-02-16). Status U->V; the 2025 SPD memo was read via Wayback.
  - `farmer.rule.ratio`: 0.6666666667 -> 0.6666666666 (auditor normalisation).

**IN 2026**
- Corrections:
  - `holidays`: added 2026-02-12, 2026-02-16, 2027-02-12, 2027-02-15 and 2027-12-31.
  - `farmer.rule.ratio`: 0.6666666667 -> 0.6666666666.
- Status U->V: `safe_harbor.*`, `farmer.rule`, `penalty.*`, `credit_for_other_state` and `nonresident_method`.
  - Sources: IC 6-3-4-4.1 as effective 1-1-2026, read in the official iga.in.gov Title 6 PDF, which incorporates IRC 6654; 26 USC 6654; IC 6-8.1-10-2.1(b); IC 6-3-3-3; IC 6-3-2-1(b)(7).
- All rows verified.

### IA

**IA 2025**
- Corrections:
  - `farmer.rule.file_by`: 2026-03-01 -> 2026-03-02 (IA 2210F weekend/holiday note; Iowa Code 421.9A).
  - `farmer.rule.ratio`: -> 0.6666666666.
- Status U->V:
  - `nonresident_method`: 2025 IA 126 lines 29-34.
  - `holidays`: Iowa Code 421.9A(1) holidays = Code 1C.1 + 1C.2 + USPS-observed federal holidays + Federal Reserve holidays, using OPM/FRB dates. The USPS page returned 404, and that assumption is stated in the citation.
- The $200 threshold for 2025 is confirmed (2025 IA 2210).

**IA 2026**
- Corrections:
  - `holidays`: added 2027-12-31.
  - `farmer.rule.ratio`: -> 0.6666666666.
- Status U->V: `safe_harbor.current_pct`, `farmer.rule`, `holidays`.
- The $1,000 threshold for 2026 is confirmed in Iowa Code 422.16(12)(a)(1) (2025 Acts ch 148).
- Residual unverified: `penalty.rate` 0.10, which is **at risk**. Under Iowa Code 421.7 the calendar-2027 rate is likely 9% (projection from a FRED prime-rate average, a secondary source). The DOR notice is due in Nov. 2026.

### KS

**KS 2025**
- Corrections:
  - `farmer.rule.file_by`: 2026-03-01 -> 2026-03-02 (K-210 next-work-day note).
  - `farmer.rule.ratio`: -> 0.6666666666.
  - `holidays`: **the value was wrong.** It was the Dept. of Administration employee schedule. That list included Juneteenth, the day after Thanksgiving, Christmas Eve and observed Fridays, and left out Presidents' Day and Columbus Day. It is replaced with the statutory "legal holidays" of K.S.A. 35-107(a) (ten days, no weekend shift; 35-107(b)). No due date is affected.

**KS 2026**
- Corrections:
  - `holidays`: statutory basis, now also covering 2027.
  - `farmer.rule.ratio`: -> 0.6666666666.
- Status U->V:
  - `penalty.rate` 0.08: K.S.A. 79-2968 sets the rate at the federal underpayment rate plus 1 point. That gives 8% for 2026 days, and 8% for 2027 days from Rev. Rul. 2026-10.
  - `credit_for_other_state`: 79-32,111(a).
  - `nonresident_method`: 79-32,110(b).
- All rows verified.

### KY

**KY 2025**
- Corrections:
  - `farmer.rule.file_by`: 2026-03-01 -> 2026-03-02. The 2210-K instructions print "March 2, 2026".
  - `farmer.rule.ratio`: -> 0.6666666666 (auditor normalisation).
  - `holidays`: added 2025-01-01 (KRS 2.110).
- The penalty works like interest: rate × days at the KRS 131.183 rate (10% for 2025 days, 9% for 2026 days). It is **not** a flat 10%.

**KY 2026**
- Corrections:
  - `farmer.rule.ratio`: -> 0.6666666666.
- Status U->V: `penalty.rate` 0.09, `credit_for_other_state` (KRS 141.070(1)) and `nonresident_method` (KRS 141.020(4); 3.5% for 2026).
- All rows verified.

### LA

**LA 2025**
- Corrections:
  - `farmer.rule.current_pct`: 0.6666 -> 0.6666666667. La. R.S. 47:118 says "sixty-six and two-thirds percent".
  - `farmer.rule.file_by`: 2026-03-01 -> 2026-03-02 (R.S. 47:103(A)(4)).
  - `farmer.rule.ratio`: -> 0.6666666666.
  - `holidays`: added 2025-12-31 and 2026-01-02 (Proclamation 74 JML 2025), 2026-06-19 (Proclamation 07 JML 2026) and 2026-11-03 (Election Day, R.S. 1:55(B)(1)(a)).
- Residual unverified: `holidays`. The Governor proclaims extra days each year and no complete official calendar exists.

**LA 2026**
- Corrections:
  - `farmer.rule.current_pct`: 0.6666 -> 0.6666666667.
  - `farmer.rule.ratio`: -> 0.6666666666.
  - `holidays`: added 2026-01-02, 2026-06-19, 2026-11-03 and 2027-07-05.
- Status U->V: `safe_harbor.current_pct`, `safe_harbor.prior_pct` and `safe_harbor.high_agi_rule` (R.S. 47:118(B)(2)(b)); `credit_for_other_state` (R.S. 47:33).
- Residual unverified: `nonresident_method` (the 2026 IT-540B is not published) and `holidays`.

## Correction counts

Counts are key-level value changes, not status-only changes.

| State | Value corrections | Unverified rows remaining (of 26) |
|---|---|---|
| AL | 3 | 2 |
| AZ | 4 | 5 |
| CA | 0 | 1 |
| CO | 0 | 4 |
| CT | 1 | 0 |
| DE | 2 | 0 |
| DC | 0 | 0 |
| GA | 5 | 4 |
| HI | 2 | 0 |
| ID | 2 | 14 (placeholders) |
| IL | 2 | 0 |
| IN | 4 | 0 |
| IA | 3 | 1 |
| KS | 4 | 0 |
| KY | 3 | 0 |
| LA | 4 | 3 |
| **Total** | **39** | **34** |

**Farmer `file_by` convention.** Every TY2025 `file_by` in these 16 states is now rolled to 2026-03-02, matching MO. The researcher had left HI, IA, KS, KY and LA unrolled.

**Farmer ratio convention.** Every farmer ratio is now 0.6666666666 ("at least 2/3" stored just under 2/3). Outside this scope, the HI auditor reported that `federal/2025.ts`, `federal/2026.ts` and `VA.ts` still use 0.6666666667. Those files were not edited.

## Material items for the engine author

1. **Idaho:** treat as "estimates not required; no underpayment penalty". Never compute an ID penalty from the 0.06 placeholder. Form 51 payments are voluntary.
2. **AL 2026 is the only seed row with `penalty.rate_source = 'federal'` and `penalty.rate = null`.** No engine code consumes `rate_source` yet. The federal path must apply the quarterly IRC 6621 rate.
3. **Penalty shapes the single `penalty.rate` cannot carry:**
   - **IN:** a flat 10% of each period's underpayment, not annualised, stored as 0.10.
   - **IL:** a flat 2% if paid within 30 days, 10% after that, stored as **null**. IL and IN use opposite conventions for a flat penalty, so the engine must special-case both.
   - **CT, DE, HI:** charged per month or fraction of a month (CT 1%, DE 1.5%, HI 2/3%), stored as 12%, 18% and 8% annual. Round each period up to whole months.
   - **DC:** 10% compounded daily, with an end-of-month rule. The D-2210 factors run about 4% above simple rate × days.
   - **AZ:** compounded annually and capped at 10% of the unpaid amount.
   - **Rates that change mid-period:** CA 8%->7%, CO 12%->11%, KS 9%->8%, KY 10%->9%, AZ quarterly; IA's 2027 rate is likely 9%.
   - **Penalty period end:** LA accrues only through Apr 15; IA through Apr 30.
4. **CA $1M rule:** when current-year CA AGI is $1,000,000 or more ($500,000 MFS), the required annual payment is 90% of current-year tax and the prior-year safe harbor does not apply.
5. **Farmers and the high-AGI rule:**
   - **CO:** farmers owe the lesser of 50% of current-year or 100% of prior-year tax.
   - **HI:** farmers owe the lesser of 60% current or 100% prior, like everyone else.
   - **CO, IN, KY, CA:** the 110% uplift does not apply to farmers.
   - The generic farmer path must not apply `high_agi_rule`.
6. **IL:** farmers are exempt (`farmer.rule` null means exempt, not "no special rule").
7. **Thresholds are not tax-due tests in AZ or GA:**
   - AZ adds a gross-income gate (both years over $75k / $150k MFJ).
   - GA has an income test only, so its threshold is 0.
8. **IN:** threshold, safe harbor and installments all include county tax.

## Rules the 13-key set cannot express (for the CPA)

- **MFS thresholds:**
  - high-AGI at $75,000: AL, CA, CO, DE, IN, IA, KY;
  - CA's $250 requirement threshold for MFS;
  - LA's $2,000 threshold for joint filers.
- **Prior-year tests and exemptions:**
  - **No prior-year liability exemptions:** CT 12-722(j)(2), DE, DC 47-4203(e)(2), HI, IL 804(d), KS 79-32,107(b)(2) (prior-year liability under $200), IN 2026+ (no prior return treated as $0).
  - **Prior-year income at current rates:** MO-style exceptions in GA (Exception 1) and LA 47:118(D)(1)(b). This matters after LA's 2025 move to a 3% flat rate.
  - **CT nonresident with no prior return:** must use 90% of current-year tax.
- **Early file-and-pay relief replacing the last installment:**
  - by Jan 31: CA, CO, CT, DE, GA, HI, KS (non-farmers), LA, IN;
  - AZ by Feb 1 (TY2025 sources disagree: Jan 31 or Feb 1);
  - KY by Feb 1 / Feb 2.
- **Annualised-income and period methods:** CO 17.5/35/52.5/70; GA Exception 3; AL, AZ, DC annualised.
- **Waivers and other special cases:**
  - IL: age 65+ nursing-home exemption;
  - DC: waivers for retirement after age 62 or disability, casualty, and death;
  - HI and AZ: nonresident-alien three-installment schedules.
- **Nonresident label:** `nonresident_method` is informational only.
  - **Mixed mechanics:** AL, HI and IA prorate deductions and then apply graduated rates; they are labelled 'other' or 'ratio'.
  - **Equivalent labels at a flat rate:** when full deduction proration is combined with a flat rate (GA, ID, KY, AZ), 'ratio' and 'sourced_flat' give the same tax.
  - **Labels are inconsistent:** GA is labelled 'ratio', while ID, KY and AZ are labelled 'sourced_flat'. The engine must not branch on this label without CPA review.
- **Holiday caveats:**
  - Holidays proclaimed each year (LA Governor, IA executive council, AL day after Thanksgiving) cannot be predicted.
  - Omitted: Sussex County Return Day (DE) and Mardi Gras (AL counties).

## Still weakest

- **ID:** placeholders by design; the engine needs a "not required" mode.
- **AZ:** threshold mapping, farmer values taken from federal law, and the 2026 quarterly rate.
- **GA:** threshold mapping; statute read only from a mirror.
- **LA:** holidays.
- **IA:** the 2026 penalty rate (likely 9% for 2027 days).
- **CO:** the 2025 holidays and the 2026 booklet rows.
