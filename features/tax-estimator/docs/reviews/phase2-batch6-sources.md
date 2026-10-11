# Phase 2 batch 6 state rules: RI, SC, UT, VT, VA, WV, WI

Research date 2026-10-11. Seeds: `packages/api/src/db/seeds/tax-estimator/state-rules/{RI,SC,UT,VT,VA,WV,WI}.ts` (13 keys x tax years 2025 and 2026 each). Validation: `tsc --noEmit` clean; throwaway script confirmed all 13 keys exactly once per state-year, values pass `validateStateRuleValue`, citations non-empty.

## Counts (verified / unverified)

| State | 2025 | 2026 |
|---|---|---|
| RI | 13 / 0 | 8 / 5 |
| SC | 12 / 1 | 9 / 4 |
| UT | 8 / 5 | 6 / 7 |
| VT | 11 / 2 | 9 / 4 |
| VA | 13 / 0 | 11 / 2 |
| WV | 13 / 0 | 3 / 10 |
| WI | 13 / 0 | 9 / 4 |

## Documents fetched (all read as text this task)

- RI: 2025 RI-1040ES https://tax.ri.gov/sites/g/files/xkgbur541/files/2024-12/2025%20RI-1040ES_w.pdf ; 2026 RI-1040ES .../2026-01/2026%20RI-1040ES_w.pdf ; 2025 RI-2210 .../2026-01/2025%20RI-2210_w.pdf ; ADV 2025-09 (June 16 due date) .../2025-06/ADV_2025_09_Estimated_Payments.pdf ; ADV 2025-23 (2026 interest rates) .../2025-11/ADV_2025_23_Interest_Rates.pdf ; 2025 RI-1040NR Schedule II .../2026-01/2025%20RI-1040NR%20Schedule%20II_w.pdf ; R.I. Gen. Laws 25-1-1 (webserver.rilegislature.gov/Statutes/TITLE25/25-1/25-1-1.htm).
- SC: SC1040ES 2025 https://dor.sc.gov/forms-site/Forms/SC1040ES_2025.pdf ; SC1040ES 2026 https://dor.sc.gov/sites/dor/files/forms/SC1040ES_2026.pdf ; SC2210 2025 https://dor.sc.gov/sites/dor/files/SoftwareDeveloperForms/SC2210_2025.pdf ; Information Letter 26-15 https://dor.sc.gov/sites/dor/files/policies/IL26-15.pdf ; 2025 IIT Packet https://dor.sc.gov/sites/dor/files/forms/IITPacket_2025.pdf ; SCDOR news on Act 110 (WebFetch) ; S.C. Code 53-5-10/53-5-30 https://www.scstatehouse.gov/code/t53c005.php.
- UT: TC-546 (Rev. 10/26) https://files.tax.utah.gov/tax/forms/current/tc-546.pdf ; TC-547 (read, return-payment coupon only) ; 2025 TC-40 Instructions https://files.tax.utah.gov/tax/forms/current/tc-40inst.pdf ; TC-40B .../current/tc-40b.pdf ; Pub 58 (Rev. 11/25) https://files.tax.utah.gov/tax/forms/pubs/pub-58.pdf ; https://incometax.utah.gov/filing/extensions-and-prepayments ; Utah Code 63G-1-301 three versions (le.utah.gov/xcode/Title63G/Chapter1/C63G-1-S301_2025050720250507.pdf, ..._2026050620260506.pdf, ..._2026050620270101.pdf).
- VT: 32 V.S.A. 5851, 5852, 5855, 5857, 5858 (legislature.vermont.gov/statutes/section/32/151/...) ; 1 V.S.A. 371 (.../statutes/section/01/007/00371) ; IN-114 2025 and 2026 form + instructions https://tax.vermont.gov/sites/tax/files/documents/IN-114-Instr-2025.pdf (and -2026, IN-114-2025/2026.pdf) ; IN-111 2025 Instructions .../IN-111-Instr-2025.pdf ; https://tax.vermont.gov/research-and-reports/interest-rates.
- VA: 760ES 2025 https://tax.virginia.gov/sites/default/files/taxforms/individual-income-tax/2025/760es-2025.pdf ; 760ES 2026 (.../2026/760es-2026.pdf) ; 760C 2025 (.../2025/760c-2025.pdf) ; 763 2025 (.../2025/763-2025.pdf) ; Va. Code 2.2-3300 (law.lis.virginia.gov/vacode/title2.2/chapter33/section2.2-3300/).
- WV: 2025 IT-140 booklet incl. IT-210 https://tax.wv.gov/Documents/PIT/2025/it140.PersonalIncomeTaxFormsAndInstructions.2025.pdf ; IT-140ESI (Sept 2023) https://tax.wv.gov/Documents/TaxForms/it140esi.pdf ; IT-140ES voucher (partly garbled OCR) ; TSD 365 (Rev. March 2026) https://tax.wv.gov/Documents/TSD/tsd365.pdf ; W. Va. Code 2-2-1 (code.wvlegislature.gov/2-2-1/).
- WI: 2025 and 2026 Form 1-ES Instructions https://revenue.wi.gov/TaxForms2025/2025-Form1-ES-Inst.pdf (and TaxForms2026) ; 2025 Schedule U + Instructions .../2025-ScheduleU.pdf, .../2025-ScheduleU-Inst.pdf ; 2025 Form 1 Instructions and Form 1NPR Instructions (www.revenue.wi.gov/TaxForms2025/) ; Wis. Stat. 995.20 (docs.legis.wisconsin.gov/statutes/statutes/995/20).

Blocked / not found: Utah le.utah.gov HTML pages (certificate error; PDFs used instead); RI 2026 RI-2210, SC2210 2026, WV TY2026 booklet/IT-210, WI Schedule U 2026, VT/UT TY2026 return instructions (not published at research date); RI statutes 44-30-98 / 44-1-7 (not fetched).

## Unverified rows and reasons

RI 2026: `safe_harbor.current_pct` and `prior_pct` (80% / 100% carried from 2025 RI-2210; 2026 RI-2210 unpublished), `installments.pcts` (same), `farmer.rule` (same; 2026 ES silent on farmers), `nonresident_method` (2026 NR booklet unpublished).

SC 2025: `farmer.rule` (current_pct 0.6667 is the federal Form 2210F value SC incorporates by reference; not printed in SC text). SC 2026: `farmer.rule` (same), `penalty.rate` (rate varies by quarter: 7% to 3/31/26, 6% Q2 2026, 7% Q3 2026, later unknown), `credit_for_other_state` and `nonresident_method` (2026 SC1040 packet unpublished; Act 110 changes the 2026 tax base).

UT 2025 and 2026: `required_threshold`, `installments.due_dates`, `installments.pcts`, `penalty.rate`, `farmer.rule` are mappings of a rule the key set cannot express (see below). UT 2026 additionally: `credit_for_other_state`, `nonresident_method` (TY2026 forms unpublished).

VT 2025 and 2026: `required_threshold` ($500 is the interest/penalty de minimis in 32 V.S.A. 5855(b), not a pay-or-not floor) and `farmer.rule` (Vermont exempts farmers entirely; null stored). VT 2026 additionally: `credit_for_other_state`, `nonresident_method` (2026 IN-111 instructions unpublished).

VA 2026: `penalty.rate` (quarterly rate 8-9%, 2027 quarters unknown; bulletins found via search and not opened), plus `nonresident_method` (2026 Form 763 unpublished).

WV 2026: `has_income_tax`, `required_threshold`, `safe_harbor.current_pct`, `prior_pct`, `high_agi_rule`, `installments.due_dates`, `installments.pcts`, `farmer.rule`, `credit_for_other_state`, `nonresident_method` all carried from the 2025 booklet and IT-140ESI (Sept 2023) because the TY2026 booklet is unpublished.

WI 2026: `farmer.rule` (current_pct 0.9 from 2025 Schedule U), `penalty.rate` (12% carried from 2025 Schedule U), `credit_for_other_state`, `nonresident_method` (2026 Form 1/1NPR instructions unpublished).

## Rules the key set cannot express

- **Utah**: no quarterly estimated payments for individuals ("Utah does not require quarterly estimated tax payments", 2025 TC-40 Instructions). Only one prepayment test by the original return due date (lesser of 90% of current or 100% of prior tax) to avoid a 2% per month extension penalty plus 6% interest. Stored as threshold 0, one installment (April 15 of the following year) at 100%, penalty 0.24. The engine should probably not schedule four vouchers for UT.
- **Vermont**: farmers are exempt from estimated payments entirely (null stored); $500 is a penalty de minimis, not a requirement floor.
- **Virginia**: threshold is "more than" $150 (2025) and "more than" $1,000 (2026, a change); income-based exemptions (single AGI under $11,950, joint under $23,900); late-starter 3/2/1 installments (33 1/3%, 50%); nonresident tax is computed on taxable income prorated by an allocation percentage (stored `other`).
- **South Carolina**: MFS high-AGI threshold is $75,000 (SC2210 line 7), the key holds one threshold ($150,000); option to file by Feb 1/2 in lieu of the last installment; nonresident prorates deductions (stored `other`).
- **West Virginia**: $600 test is waived if liability is under 10% of estimated tax; zero-prior-tax exception when current tax under $5,000.
- **Rhode Island**: safe harbor is 80% of current tax (not 90%); the stored pair means min(80% current, 100% prior).
- **Wisconsin**: farmer "pay in full" is the ordinary required annual payment (current_pct 0.9), no 66 2/3% reduction; estates/trusts with taxable income of $20,000 or more lose the prior-year safe harbor.
- **All**: single-rate `penalty.rate` cannot hold rates that change by calendar year or quarter (RI, VT, WV, MO-style: days of a TY2025 underpayment in 2026 accrue at the 2026 rate; VT 7.75%, WV 11.5%; SC and VA vary by quarter).

## Auditor re-check first

1. Utah mapping (threshold 0 / single installment / 0.24) and whether the engine should special-case UT.
2. VA 2026 threshold jump to $1,000 (read in the 2026 760ES) and VA `nonresident_method` = `other`.
3. RI 80% current-year safe harbor (RI-2210 line 2) and RI farmer file_by rolled to 2026-03-02 (form prints March 1); same roll applied to SC, VA, WV 2025 farmer dates (MO convention).
4. SC farmer current_pct and SC/VA 2026 penalty rates.
5. WV 2025 June installment rolled to 2025-06-16 (booklet only says the day "may shift" for weekends; IT-140ESI states next business day).
6. Holiday lists: RI includes Thanksgiving (governor-appointed under 25-1-1), UT includes Good Friday for 2026-2027 and the moving Juneteenth rule, WV and WI omit primary-election days (dates not read).
