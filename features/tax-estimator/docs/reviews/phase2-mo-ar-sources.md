# Phase 2, batch 1: Missouri and Arkansas state-rule sources (TY2025, TY2026)

Researched 2026-10-11 by the tax-law-researcher agent. The seeds are in
`packages/api/src/db/seeds/tax-estimator/state-rules/MO.ts` (`MO_RULES`) and `AR.ts` (`AR_RULES`). There are 13 keys for each (state, year), 52 rows in all.
The figures come from the downloaded PDFs or the statute text, not from summaries. Each row's `citation` names the section, line or instruction it came from.
The CPA (Kurt) signs off on these rows (D12).

| State | Year | Rows | verified | unverified |
|---|---|---|---|---|
| MO | 2025 | 13 | 13 | 0 |
| MO | 2026 | 13 | 13 | 0 |
| AR | 2025 | 13 | 11 | 2 |
| AR | 2026 | 13 | 11 | 2 |

## RATE DISCREPANCY: the oracle's Arkansas rate for 2026 is out of date

**Arkansas cut its top individual rate from 3.9% to 3.7% for tax years beginning on or after January 1, 2026.** The change is **Act 1 of the 2026 First Extraordinary Session** (HB1001, approved 5/6/26). Its §1 amends Ark. Code §26-51-201(a)(4): the table for net income up to $94,700 tops out at 3.7% from $26,400. Above $94,700 the rates are 2% on the first $4,700 and 3.7% on the rest, with a bracket adjustment phasing out between $94,701 and $97,600.
- `rivera_fixture.py` uses `ar_rate=0.039` for **tax year 2026**, which is out of date. At the oracle's $8,000 of AR-source income, AR tax would be about $296, not $312.
- DFA's own 2026 AR1000ES (worksheet R 10/17/2025) still prints 3.9%, because it predates the Act. DFA's AR1000CRES composite worksheet revised 5/8/2026 uses 3.7% (.037); the October 2025 version used 3.9%.
- This does not change the oracle's threshold conclusion: $296 or $312 is under AR's $1,000 requirement either way.

| State | 2025 top / flat rate | 2026 top / flat rate | Oracle assumption | Source |
|---|---|---|---|---|
| MO | 4.7% (over $9,191) | 4.7% (over $9,436) | `mo_rate=0.04` effective on AGI | MO-1040ES 2025 and 2026 tax rate charts |
| AR | 3.9% | **3.7%** | `ar_rate=0.039` | AR1000ES 2025 rate schedule; Act 1 of 2026 (1st Ex. Sess.) |

The MO oracle rate is an *effective-rate* input applied to AGI. 4.0% is plausible as an effective rate on AGI, given the MO standard deduction and the 2%–4.5% lower brackets, but it is **not** the 4.7% marginal rate. The CPA should confirm that 4.0% is intended as an effective rate.

## Oracle assumptions checked

| Assumption (rivera_fixture.py / OPEN-QUESTIONS) | Finding |
|---|---|
| MO threshold $100 | **Confirmed.** RSMo §143.521.1 ("at least one hundred dollars"), measured on Missouri tax less credits *including withholding* (§143.521.3). |
| MO 90% current / 100% prior | **Confirmed.** RSMo §143.761.4(1)–(3). **No high-AGI (110%) rule.** MO also has a fourth exception: prior-year facts at current rates (§143.761.4(4), MO-2210 line 22). The state-rule keys cannot represent it, and the oracle ignores it. |
| MO due dates | Apr 15 / Jun 15 / Sep 15 / Jan 15, rolled to the next business day (§143.851). TY2025 Q2 is June 16, 2025. |
| MO penalty rate | A **state** rate under RSMo §32.065: 8% for calendar 2025 and 7% for 2026 (12 CSR 10-41.010; MO-2210 2025 lines 28a/28b). The rate changes on Jan 1, but the seed key holds only one rate per tax year. |
| MO nonresident method | **Ratio** (RSMo §143.041): resident-basis tax × MO-source AGI / total AGI. The engine's flat `sourced × rate` is a simplification. |
| AR tax of $312 is under the threshold | **Confirmed.** AR requires estimates when tax after credits and AR withholding is $1,000 or more. It is $296 at the correct 3.7% 2026 rate. |
| AR rate 3.9% | **Correct for 2025, WRONG for 2026** (3.7%; see above). |
| AR safe harbor | 90% current / 100% prior, no high-AGI rule (AR2210 2025 Part II lines 2, 5, 6). |
| AR penalty | Fixed **state 10% per annum** (AR2210 line 16 × .10), not the federal rate. |
| AR nonresident method | **Ratio** (AR1000NR lines 38A–38D). |

## Documents fetched (2026-10-11)

### Missouri
| Document | URL |
|---|---|
| RSMo §143.521 (declaration required; $100; "Missouri estimated tax" definition; Jan 31 / Mar 1 return-as-declaration) | https://revisor.mo.gov/main/OneSection.aspx?section=143.521 |
| RSMo §143.531 (filing dates; farmer two-thirds rule, Jan 15) | https://revisor.mo.gov/main/OneSection.aspx?section=143.531 |
| RSMo §143.541 (four equal installments; dates) | https://revisor.mo.gov/main/OneSection.aspx?section=143.541 |
| RSMo §143.761 (addition to tax; 90% / 66⅔%; prior-year and other exceptions; §32.065 rate; period ends on the 15th day of the 4th month) | https://revisor.mo.gov/main/OneSection.aspx?section=143.761 |
| RSMo §143.851 (Saturday/Sunday/state legal holiday roll; applies to payments) | https://revisor.mo.gov/main/OneSection.aspx?section=143.851 |
| RSMo §32.065 (annual adjusted interest rate) | https://revisor.mo.gov/main/OneSection.aspx?section=32.065 |
| RSMo §143.081 (credit for tax paid to another state) | https://revisor.mo.gov/main/OneSection.aspx?section=143.081 |
| RSMo §143.041, §143.181, §143.051 (nonresident ratio; MO-source income; part-year) | https://revisor.mo.gov/main/OneSection.aspx?section=143.041 (etc.) |
| RSMo §143.011 (rates; triggered reductions) | https://revisor.mo.gov/main/OneSection.aspx?section=143.011 |
| RSMo §9.010, §9.020 (public holidays) | https://revisor.mo.gov/main/OneSection.aspx?section=9.010 |
| Form MO-1040ES 2025 (Rev. 12-2024) | https://dor.mo.gov/forms/MO-1040ES_2025.pdf |
| Form MO-1040ES 2026 (Rev. 12-2025) | https://dor.mo.gov/forms/MO-1040ES_2026.pdf |
| Form MO-2210 2025 (8% 2025 / 7% 2026 lines 28a/28b; exceptions; farmer instruction J) | https://dor.mo.gov/forms/MO-2210_2025.pdf |
| 12 CSR 10-41.010 emergency amendment (rate table 2025 = 8%, 2026 = 7%; future rates posted by Oct 22) | https://dor.mo.gov/resources/proposed-rules/documents/ER_-12_CSR_10-41_010_Emergency_Amendment.pdf |

### Arkansas
| Document | URL |
|---|---|
| AR1000ES 2025 (Instr. R 7/5/2024; worksheet R 10/29/2024) | https://www.dfa.arkansas.gov/wp-content/uploads/2025_Final_AR1000ES.pdf |
| AR1000ES 2026 (Instr. R 10/14/2025; worksheet R 10/17/2025) | https://www.dfa.arkansas.gov/wp-content/uploads/2026_Final_AR1000ES.pdf |
| AR2210 2025 (R 6/6/2025) | https://www.dfa.arkansas.gov/wp-content/uploads/2025_AR2210_Penalty_for_Underpayment_of_EstimatedTax_1.pdf |
| AR2210 Instructions (R 7/5/2024; p. 2 R 6/27/2025) | https://www.dfa.arkansas.gov/wp-content/uploads/2025_AR2210_Instructions.pdf |
| AR1000F / AR1000NR Instructions 2025 (lines 36, 38A–38D) | https://www.dfa.arkansas.gov/wp-content/uploads/2025_AR1000F_and_AR1000NR_Instructions.pdf |
| DFA "Subject 105 Estimated Tax" (rev. 2/24/2023) | https://www.dfa.arkansas.gov/wp-content/uploads/105-EstimatedTax.pdf |
| AR1000CRES composite vouchers 2026: R 10/14/2025 (3.9%) and R 5/8/2026 (3.7%) | https://www.dfa.arkansas.gov/wp-content/uploads/AR1000CRES_CompEstimatedTaxVouchers_2026.pdf, ..._2026_1.pdf |
| Act 1 of 2026, 1st Extraordinary Session (HB1001), approved 5/6/26 | https://arkleg.state.ar.us/Acts/FTPDocument?path=%2FACTS%2F2026S1%2FPublic%2F&file=1.pdf&ddBienniumSession=2025%2F2026S1 |

**Not obtainable:** the Arkansas Code text (Ark. Code §§26-51-907 to -913 on estimated tax; §1-5-101 on holidays). law.justia.com and regulations.justia.com returned HTTP 403, and arkleg's FTP returned a 1×1 GIF. The AR rows rely on the DFA forms and instructions, which are primary agency documents, not on the statute.

## Row-by-row sources

| State/Year | Key | Value | Status | Primary source |
|---|---|---|---|---|
| MO 2025/26 | has_income_tax | true | verified | RSMo §143.011, §143.041 |
| MO 2025/26 | required_threshold | 100 | verified | RSMo §143.521.1, .3; MO-1040ES Gen. Instr. 1–2 |
| MO 2025/26 | safe_harbor.current_pct | 0.9 | verified | RSMo §143.761.2(1), .4(2)–(3); MO-1040ES Instr. 8(b); MO-2210 line 2 |
| MO 2025/26 | safe_harbor.prior_pct | 1.0 | verified | RSMo §143.761.4(1); MO-2210 line 21; MO-1040ES Instr. 8(a) |
| MO 2025/26 | safe_harbor.high_agi_rule | null | verified | RSMo §143.761.4 (no income test) |
| MO 2025 | installments.due_dates | 2025-04-15, 2025-06-16, 2025-09-15, 2026-01-15 | verified | RSMo §143.541.1(1), §143.851; MO-1040ES 2025 Instr. 5 |
| MO 2026 | installments.due_dates | 2026-04-15, 2026-06-15, 2026-09-15, 2027-01-15 | verified | same, 2026 form |
| MO 2025/26 | installments.pcts | 0.25 × 4 | verified | RSMo §143.541.1(1) "four equal installments" |
| MO 2025 | farmer.rule | ⅔ / 66⅔% / 2026-01-15 / 2026-03-02 | verified | RSMo §143.531.2, §143.761, §143.521.6; MO-2210 Instr. J; Mar 1, 2026 is a Sunday |
| MO 2026 | farmer.rule | ⅔ / 66⅔% / 2027-01-15 / 2027-03-01 | verified | same |
| MO 2025/26 | penalty.rate_source | state | verified | RSMo §143.761.1 → §32.065 |
| MO 2025 | penalty.rate | 0.08 | verified | 12 CSR 10-41.010; MO-2210 2025 line 28a (2026 days at 7%, line 28b) |
| MO 2026 | penalty.rate | 0.07 | verified | 12 CSR 10-41.010 (2026 = 7%). The 2027 rate was not yet posted. |
| MO 2025/26 | credit_for_other_state | true | verified | RSMo §143.081 |
| MO 2025/26 | nonresident_method | ratio | verified | RSMo §143.041.1; MO-1040ES Instr. 5 and worksheet line 10 |
| MO 2025/26 | holidays | RSMo §9.010 dates for Y and Y+1 | verified | RSMo §9.010 (Sunday → Monday; Saturday not moved) |
| AR 2025/26 | has_income_tax | true | verified | AR1000ES; Act 1 of 2026 |
| AR 2025/26 | required_threshold | 1000 | verified | AR1000ES worksheet line 8; AR2210 Instr. 1(a); Subject 105 |
| AR 2025/26 | safe_harbor.current_pct | 0.9 | verified | AR2210 2025 line 2; AR1000ES "Underestimate of Tax" |
| AR 2025/26 | safe_harbor.prior_pct | 1.0 | verified | AR2210 2025 lines 5–6; AR1000ES; Subject 105 |
| AR 2025/26 | safe_harbor.high_agi_rule | null | verified | AR2210 2025 lines 5–6 (no AGI test) |
| AR 2025 | installments.due_dates | 2025-04-15, 2025-06-16, 2025-09-15, 2026-01-15 | verified | AR2210 2025 Part III columns; AR1000ES holiday note |
| AR 2026 | installments.due_dates | 2026-04-15, 2026-06-15, 2026-09-15, 2027-01-15 | verified | AR1000ES 2026 worksheet |
| AR 2025/26 | installments.pcts | 0.25 × 4 | verified | AR2210 line 7; AR1000ES worksheet |
| AR 2025 | farmer.rule | ⅔ / 0.9 / 2026-02-17 / 2026-03-16 | **unverified** | AR1000ES Exception; AR2210 Instr. exception 1 (see reason below) |
| AR 2026 | farmer.rule | ⅔ / 0.9 / 2027-02-16 / 2027-03-15 | **unverified** | AR1000ES 2026 Exception |
| AR 2025/26 | penalty.rate_source | state | verified | AR1000ES; AR2210 Instr. 2(b) |
| AR 2025/26 | penalty.rate | 0.10 | verified | AR2210 2025 line 16 (× .10); AR1000ES 2026 |
| AR 2025/26 | credit_for_other_state | true | verified | AR1000F/NR Instr. 2025 line 36 (AR1000TC Other State Tax Credit) |
| AR 2025/26 | nonresident_method | ratio | verified | AR1000F/NR Instr. 2025 lines 38A–38D |
| AR 2025/26 | holidays | Ark. Code §1-5-101 as summarised | **unverified** | the statute could not be read (403) |

## Unverified rows and reasons
1. **AR farmer.rule (2025, 2026).** The two-thirds ratio and the dates (15th day of the 2nd month to pay; 15th day of the 3rd month to file and pay instead) were read in AR1000ES and in the AR2210 Instructions. The `current_pct` of 0.9 is an **inference** from AR's general 90% rule; no AR source states a farmer percentage, and AR has no 66⅔% rule. Rolled dates: Feb 15, 2026 is a Sunday and Feb 16, 2026 is Presidents' Day, so Feb 17, 2026; Mar 15, 2026 is a Sunday, so Mar 16, 2026. Feb 15, 2027 is Presidents' Day, so Feb 16, 2027.
2. **AR holidays (2025, 2026).** I could not read Ark. Code §1-5-101 in a primary source. The list was built from secondary summaries: New Year's Day, MLK Day, Washington/Daisy Gatson Bates Day, Memorial Day, July 4, Labor Day, Veterans Day, Thanksgiving, Christmas Eve and Christmas, with Saturday holidays observed Friday and Sunday holidays Monday. Juneteenth and the 2027 Christmas observance are unconfirmed. The only due date this list affects is the farmer date on Presidents' Day, which is also a federal holiday.

## CPA must double-check
- **Arkansas 2026 rate is 3.7%, not 3.9%** (Act 1 of 2026, 1st Ex. Sess.). Update the oracle's `ar_rate` for TY2026 and regenerate `rivera_expected.json`, with an OPEN-QUESTIONS entry.
- **Missouri 4.0% oracle rate vs the 4.7% top marginal rate** in both years: confirm that 4.0% is meant as an effective rate on AGI.
- **MO penalty rate changes on Jan 1.** TY2025 is 8% through 12/31/2025 and then 7%. TY2026 is 7% through 12/31/2026; the 2027 rate is due to be posted by Oct 22, 2026 and was not available on 2026-10-11. The single-rate key misstates the Q4 and post-year portion.
- **AR threshold at exactly $1,000.** AR1000ES "Who must file" says "more than $1,000", while the worksheet and Subject 105 say "$1,000 or more". AR2210 line 4 skips the penalty when net tax less withholding is "$1,000 or less", and there is no penalty if the tax shown is under $1,000. The seed uses 1000 with the engine's "at least" test.
- **MO extra safe harbor** (§143.761.4(4): prior-year income at current-year rates) and **annualization** exceptions are not modelled by the state keys.
- **MO and AR Q4 relief** is not a seed key. MO lets a taxpayer file the return and pay in full by Jan 31 in place of a Jan 15 declaration (§143.521.6); Jan 31, 2026 is a Saturday. AR lets a taxpayer file and pay by Jan 31 in place of the 4th installment (AR2210 Instr. exception 2).
- **AR farmer `current_pct` = 0.9** is an inference (see above).
- **AR exception 3:** no prior-year liability, a 12-month year and full-year residency mean no penalty. **AR exception 5:** retired after age 62 or disabled, with reasonable cause. Neither is encoded.
- **Nonresident method is `ratio` in both states.** The engine's flat `sourced × rate` estimate can differ materially, especially for AR, where the ratio is applied to tax on the full return.
- **AR holidays** need a read of Ark. Code §1-5-101, including whether Juneteenth is a state holiday.
