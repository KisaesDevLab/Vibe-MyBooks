# Phase 2, batch 3: HI, ID, IL, IN, IA, KS, KY, LA state-rule sources (TY2025, TY2026)

Researched 2026-10-11 by the state-rules-researcher agent. Seeds are in `packages/api/src/db/seeds/tax-estimator/state-rules/<ST>.ts`. Each (state, year) has all 13 keys (208 rows). Every row's `citation` names the document and section. Values were read from downloaded PDFs or HTML pages. The validation script (13 keys once each, `validateStateRuleValue` passes, non-empty citation) passes; `tsc --noEmit` is clean.

Conventions: installment dates are stored with the weekend/holiday roll applied when the source states a roll rule. `farmer.rule.file_by` is stored as the date the form prints (March 1), not rolled, except Indiana, whose form itself prints March 2, 2026. `penalty.rate` is a single number per tax year even where the rate changes on Jan 1.

## Verified / unverified counts

| State | Year | verified | unverified |
|---|---|---|---|
| HI | 2025 | 13 | 0 |
| HI | 2026 | 9 | 4 |
| ID | 2025 | 6 | 7 |
| ID | 2026 | 4 | 9 |
| IL | 2025 | 12 | 1 |
| IL | 2026 | 11 | 2 |
| IN | 2025 | 12 | 1 |
| IN | 2026 | 5 | 8 |
| IA | 2025 | 11 | 2 |
| IA | 2026 | 9 | 4 |
| KS | 2025 | 13 | 0 |
| KS | 2026 | 10 | 3 |
| KY | 2025 | 13 | 0 |
| KY | 2026 | 10 | 3 |
| LA | 2025 | 12 | 1 |
| LA | 2026 | 7 | 6 |

Most 2026 'unverified' rows are carry-forwards: the 2026 penalty/return forms are not published yet (early October 2026), so a rule read on the 2025 form is carried forward but not confirmed for 2026. The auditor can promote them once 2026 forms appear.

## Rules the key set cannot express

| State | Rule | How seeded |
|---|---|---|
| ID | Idaho does NOT require individual estimated payments (booklet: "Idaho doesn't require estimated tax payments"; Idaho Code 63-3036A is corporate-only). No underpayment penalty, no safe harbor, no installment dates. Interest runs on unpaid tax from the return due date. | `required_threshold` 0, safe harbor 80%/100% (the Form 51 filing-extension payment test), federal-style dates, `penalty.rate` 6% (interest rate), all marked unverified as modeling placeholders. `farmer.rule` and `high_agi_rule` are null (verified). Decision needed: the engine should probably treat ID as "no estimate required, voluntary Form 51 payments only". |
| IL | Late-payment penalty is a flat 2% (1-30 days late) or 10% (31+ days) of each underpaid installment, not an annual rate. | `penalty.rate_source` 'state', `penalty.rate` null. |
| IL | Farmers (two-thirds of federal gross income from farming) are exempt from estimates and penalty. | `farmer.rule` null (an exemption cannot be written as ratio/pct/due/file_by). |
| IN | Penalty is a flat 10% of each period's underpayment, not an annual rate and not time-prorated. | `penalty.rate` 0.10 with caution in the citation. |
| IN, IA, KY | High-AGI rule has a lower MFS threshold ($75,000) and (IN, KY) excludes farmers. | Stored as {150000, 1.10}; MFS/farmer exceptions in the citation only. KY's threshold is Kentucky AGI; IN/IA use federal AGI (IA plus modifications). |
| LA | Threshold is $1,000 single / $2,000 joint. | `required_threshold` 1000; joint tier in the citation only. |
| HI | Nonresident tax is graduated-rate tax on Hawaii-source income with deductions/exemptions prorated by the Hawaii/total AGI ratio. | `nonresident_method` 'other'. |
| KS, KY, HI, IA, LA | Penalty/interest rate changes each January 1 within one tax year's underpayment period (KS 9% -> 8%; KY 10% -> 9%; the others carry a single rate). | Single rate per year; calendar-year split in citations. |

## Documents fetched (2026-10-11)

### Hawaii
- Tax Facts 2019-3 "Estimated Income Tax for Individuals" (rev. Feb 2026): https://files.hawaii.gov/tax/legal/taxfacts/tf2019-3.pdf
- Form N-210 (Rev. 2025): https://files.hawaii.gov/tax/forms/current/n210_i.pdf
- Form N-15 (Rev. 2025): https://files.hawaii.gov/tax/forms/current/n15_i.pdf; Form N-11 (Rev. 2025): https://files.hawaii.gov/tax/forms/current/n11_i.pdf
- Schedule CR (Rev. 2025): https://files.hawaii.gov/tax/forms/current/schcr_f.pdf and schcr_i.pdf
- DoTax CY 2026 Calendar of Due Dates (state holidays 2026): https://files.hawaii.gov/tax/images/CY-2026-DoTax-Calendar-of-Due-Dates.pdf
- DHRD holidays 2025-2026: https://dhrd.hawaii.gov/wp-content/uploads/2025/01/State-Holidays-2025-2026-1.pdf; 2026-2027: https://dhrd.hawaii.gov/wp-content/uploads/2026/06/State-Holidays-2026-2027.pdf
- Blocked: capitol.hawaii.gov (HRS 8-1, 231-39, 235-55, 235-97) returned a Cloudflare 403. The CY 2025 DoTax calendar URL returned 404.

### Idaho
- 2025 Individual Income Tax booklet EIN00046 (rev. 03-02-2026): https://tax.idaho.gov/wp-content/uploads/forms/EIN00046/EIN00046_03-02-2026.pdf
- Form 51 voucher EFO00092 (09-18-2025): https://tax.idaho.gov/document-mngr/forms_EFO00092/
- Interest rates: https://tax.idaho.gov/online-services/compliance/penalty-and-interest/interest-rates/; penalties page https://tax.idaho.gov/penalties
- Idaho Code 63-3036, 63-3036A, 63-3036B: https://legislature.idaho.gov/statutesrules/idstat/Title63/T63CH30/SECT63-3036A/ (and siblings); 73-108: https://legislature.idaho.gov/statutesrules/idstat/Title73/T73CH1/SECT73-108/

### Illinois
- Publication 105 (R-12/25): https://tax.illinois.gov/content/dam/soi/en/web/tax/research/publications/pubs/documents/pub-105.pdf
- IL-1040-ES 2026 (R-09/26): https://tax.illinois.gov/content/dam/soi/en/web/tax/forms/incometax/documents/currentyear/individual/il-1040-es.pdf
- 2025 IL-2210 (R-12/25) and instructions: .../individual/il-2210.pdf, il-2210-instr-es-us.pdf
- 2025 IL-1040 Instructions: .../individual/il-1040-instr.pdf
- 80 Ill. Adm. Code 303.190: https://www.ilga.gov/ftp/JCAR/AdminCode/080/080003030B01900R.html
- Not obtained: 5 ILCS 490/17 (ilga.gov returned an error page); a 2025 IL-1040-ES (only the 2026 one is posted); Schedule NR instructions (404).

### Indiana
- Information Bulletin #3 (March 2023): https://www.in.gov/dor/files/ib03.pdf
- Form ES-40 for 2025 (id 16339) and 2026 (id 16906): https://forms.in.gov/Download.aspx?id=16906
- Schedule IT-2210 2025: https://forms.in.gov/Download.aspx?id=16926 (also 2024 id 16349, IT-2210A ids 16928/16350)
- Form IT-40PNR 2025: https://forms.in.gov/Download.aspx?id=16919; Schedule 6 2025: https://forms.in.gov/Download.aspx?id=16940
- SPD holiday memos 2026 https://secure.in.gov/spd/benefits/files/2026-Holidays-Memorandum.pdf and 2027 https://secure.in.gov/spd/benefits/files/2027%20Holidays%20Memorandum.pdf
- Not obtained: IC 6-3-4-4.1 (iga.in.gov is a JavaScript app); the 2025 holiday memo (404).

### Iowa
- Estimated Income Tax Payments page: https://revenue.iowa.gov/taxes/tax-guidance/individual-income-tax/estimated-income-tax-payments
- 2025 IA 2210 (id 4399), 2025 IA 2210F (id 4398): https://revenue.iowa.gov/media/4399/download, .../4398/download
- 2026 IA 1040ES instructions (id 2725): https://revenue.iowa.gov/media/2725/download?inline=
- Line 35 expanded instructions: https://revenue.iowa.gov/taxes/tax-guidance/individual-income-tax/1040-expanded-instructions/penalty-underpayment
- Iowa Code 421.9A, 1C.1, 1C.2, 422.8: https://www.legis.iowa.gov/docs/code/421.9A.pdf (and siblings)

### Kansas
- 2025 K-40ES: https://www.ksrevenue.gov/pdf/k-40es25.pdf; 2026 K-40ES: https://www.ksrevenue.gov/pdf/k-40es26.pdf
- 2025 K-210: https://www.ksrevenue.gov/pdf/k-21025.pdf; 2025 individual booklet: https://www.ksrevenue.gov/pdf/ip25.pdf
- DOA holidays: https://admin.ks.gov/offices/personnel-services/agency-information/holidays-for-state-of-kansas-executive-branch-employees/holidays-for-2025 (and -2026). The 2027 page is not yet published.

### Kentucky
- 2026 estimated-tax instructions: https://revenue.ky.gov/Forms/740-ES%20Instructions%20(2025).pdf; 2025 instructions: https://revenue.ky.gov/Forms/740-ES%20Instructions%20(2024).pdf
- 2025 Form 740 and 740-NP packet instructions: https://revenue.ky.gov/Forms/740%20Packet%20Instructions.pdf and https://revenue.ky.gov/Forms/740-NP%20Packet%20Instructions%20(2025).pdf
- Interest-rate notices: https://revenue.ky.gov/News/Pages/Tax-Interest-Rate-Update-for-01-01-25.aspx and ...-26.aspx
- Personnel holidays: https://extranet.personnel.ky.gov/Pages/Leave.aspx and https://extranet.personnel.ky.gov/Personnel%20Memos/2024-20.pdf

### Louisiana
- IT-540ESi 2025 and 2026: https://dam.ldr.la.gov/taxforms/IT540ESi-2026.pdf (2025 file name has a space/parentheses)
- R-210R-i (1/26) for tax year 2025: https://dam.ldr.la.gov/taxforms/210Ri(1_26).pdf; R-210R-i (1/25) for 2024 (compared)
- 2025 IT-540B: https://dam.ldr.la.gov/taxforms/IT540B(2025)WEB-BC-F.pdf; 2025 IT-540 instructions: https://dam.ldr.la.gov/taxforms/IT540i-WEB-2025.pdf; R-10606 (1/26): https://dam.ldr.la.gov/taxforms/10606-1-26-F.pdf
- La. R.S. 1:55: https://legis.la.gov/Legis/LawPrint.aspx?d=74097. La. R.S. 47:116/117/118 text not read directly; the department forms quote them.

## Facts to re-check first (auditor)

1. **Idaho** modeling: decide how the engine treats a state with no estimate requirement.
2. **Holiday proxies:** IA, IL, LA holiday rows are unverified (rule lists computed, not an official dated calendar). IN 2025 holidays unverified (memo 404).
3. **Date-roll conventions:** HI Apr 21 / Sep 22, 2025 and Jun 22 / Sep 21, 2026; IA Feb 2, 2026 and Feb 1, 2027; farmer `file_by` stored unrolled (Mar 1) except IN (Mar 2, 2026).
4. **KS, KY** penalty rates change Jan 1 within the period (single-rate key).
5. **LA** 2026 safe harbor is carried from the 2025 R-210R-i.

## Every unverified row

| State | Year | Key | Reason (truncated; full text in the seed citation) |
|---|---|---|---|
| HI | 2026 | penalty.rate_source | 2026 Form N-210 not yet published; Hawaii uses its own penalty computed at .00667 per month on the 2025 Form N-210 (Rev. 2025) Part IV line 20. HRS 231-39 and the... |
| HI | 2026 | penalty.rate | Carried from Form N-210 (Rev. 2025) Part IV line 20 (.00667 per month = 8% per annum). 2026 Form N-210 not yet published; statute HRS 231-39 not readable... |
| HI | 2026 | credit_for_other_state | Verified for 2025 on Schedule CR (Rev. 2025) line 12; 2026 Schedule CR not yet published (HRS 235-55 not readable, capitol.hawaii.gov blocked), carried... |
| HI | 2026 | nonresident_method | Form N-15 (Rev. 2025) lines 35-44 (deductions/exemptions prorated by Hawaii AGI ratio, graduated rate schedule on Hawaii taxable income); 2026 Form N-15 not yet... |
| ID | 2025 | required_threshold | MODELING PLACEHOLDER: Idaho does not require individuals to make estimated payments (Idaho 2025 Individual Income Tax booklet (EIN00046, rev. 03-02-2026),... |
| ID | 2025 | safe_harbor.current_pct | Not an estimated-tax safe harbor: the only percentages Idaho publishes are the filing-extension payment tests in Idaho Form 51 voucher (EFO00092, 09-18-2025),... |
| ID | 2025 | safe_harbor.prior_pct | Same extension payment test as safe_harbor.current_pct (Idaho Form 51 voucher (EFO00092, 09-18-2025), tax.idaho.gov/document-mngr/forms_EFO00092/ worksheet line 1 and... |
| ID | 2025 | installments.due_dates | Federal-style placeholder dates. Idaho law fixes no individual installment dates; the Form 51 voucher (Idaho Form 51 voucher (EFO00092, 09-18-2025),... |
| ID | 2025 | installments.pcts | Placeholder equal installments; Idaho prescribes none for individuals. MODELING PLACEHOLDER: Idaho does not require individuals to make estimated payments (Idaho 2025... |
| ID | 2025 | penalty.rate_source | Idaho charges interest (not an estimated-tax penalty) on tax unpaid after the original due date: Idaho 2025 Individual Income Tax booklet (EIN00046, rev. 03-02-2026),... |
| ID | 2025 | penalty.rate | Idaho charges interest (not an estimated-tax penalty) on tax unpaid after the original due date: Idaho 2025 Individual Income Tax booklet (EIN00046, rev. 03-02-2026),... |
| ID | 2026 | required_threshold | MODELING PLACEHOLDER: Idaho does not require individuals to make estimated payments (Idaho 2025 Individual Income Tax booklet (EIN00046, rev. 03-02-2026),... |
| ID | 2026 | safe_harbor.current_pct | Not an estimated-tax safe harbor: the only percentages Idaho publishes are the filing-extension payment tests in Idaho Form 51 voucher (EFO00092, 09-18-2025),... |
| ID | 2026 | safe_harbor.prior_pct | Same extension payment test as safe_harbor.current_pct (Idaho Form 51 voucher (EFO00092, 09-18-2025), tax.idaho.gov/document-mngr/forms_EFO00092/ worksheet line 1 and... |
| ID | 2026 | installments.due_dates | Federal-style placeholder dates. Idaho law fixes no individual installment dates; the Form 51 voucher (Idaho Form 51 voucher (EFO00092, 09-18-2025),... |
| ID | 2026 | installments.pcts | Placeholder equal installments; Idaho prescribes none for individuals. MODELING PLACEHOLDER: Idaho does not require individuals to make estimated payments (Idaho 2025... |
| ID | 2026 | penalty.rate_source | Idaho charges interest (not an estimated-tax penalty) on tax unpaid after the original due date: Idaho 2025 Individual Income Tax booklet (EIN00046, rev. 03-02-2026),... |
| ID | 2026 | penalty.rate | Idaho charges interest (not an estimated-tax penalty) on tax unpaid after the original due date: Idaho 2025 Individual Income Tax booklet (EIN00046, rev. 03-02-2026),... |
| ID | 2026 | credit_for_other_state | Idaho 2025 Individual Income Tax booklet (EIN00046, rev. 03-02-2026), tax.idaho.gov/wp-content/uploads/forms/EIN00046/EIN00046_03-02-2026.pdf 'Line 21 Income Tax Paid to... |
| ID | 2026 | nonresident_method | Idaho 2025 Individual Income Tax booklet (EIN00046, rev. 03-02-2026), tax.idaho.gov/wp-content/uploads/forms/EIN00046/EIN00046_03-02-2026.pdf Form 43 instructions, line... |
| IL | 2025 | holidays | Illinois 80 Ill. Adm. Code 303.190 'Authorized Holidays' (State employees: New Year's Day, Martin Luther King Day, Lincoln's Birthday, Washington's Birthday, Memorial... |
| IL | 2026 | nonresident_method | 2025 IL-1040 Instructions ('Who must file' nonresident: Schedule NR Step 5 line 46 Illinois base income vs line 50 exemption allowance) with the flat 4.95% rate (2025... |
| IL | 2026 | holidays | Illinois 80 Ill. Adm. Code 303.190 'Authorized Holidays' (State employees: New Year's Day, Martin Luther King Day, Lincoln's Birthday, Washington's Birthday, Memorial... |
| IN | 2025 | holidays | 2026 portion verified: Indiana SPD 2026 Holidays Memorandum (secure.in.gov/spd/benefits/files/2026-Holidays-Memorandum.pdf). 2025 portion UNVERIFIED: the 2025 memorandum... |
| IN | 2026 | safe_harbor.current_pct | 2026 Schedule IT-2210 is not yet published; rule taken from the 2025 form and Indiana DOR Income Tax Information Bulletin #3 (March 2023), in.gov/dor/files/ib03.pdf... |
| IN | 2026 | safe_harbor.prior_pct | 2026 Schedule IT-2210 is not yet published; rule taken from the 2025 form and Indiana DOR Income Tax Information Bulletin #3 (March 2023), in.gov/dor/files/ib03.pdf... |
| IN | 2026 | safe_harbor.high_agi_rule | 2026 Schedule IT-2210 is not yet published; rule taken from the 2025 form and Indiana DOR Income Tax Information Bulletin #3 (March 2023), in.gov/dor/files/ib03.pdf... |
| IN | 2026 | farmer.rule | 2026 Schedule IT-2210 is not yet published; rule taken from the 2025 form and Indiana DOR Income Tax Information Bulletin #3 (March 2023), in.gov/dor/files/ib03.pdf... |
| IN | 2026 | penalty.rate_source | Indiana's penalty is 10% of each period's underpayment (flat per installment period, not an annual rate and not time-prorated): Indiana DOR Income Tax Information... |
| IN | 2026 | penalty.rate | Indiana's penalty is 10% of each period's underpayment (flat per installment period, not an annual rate and not time-prorated): Indiana DOR Income Tax Information... |
| IN | 2026 | credit_for_other_state | Verified for 2025 on Schedule 6 line 5; 2026 Schedule 6 not yet published, carried... |
| IN | 2026 | nonresident_method | Verified for 2025 on Form IT-40PNR line 8; 2026 IT-40PNR not yet published (2026 ES-40 shows state rate .0295), carried... |
| IA | 2025 | nonresident_method | Verified for 2026 on the 2026 IA 1040ES instructions (45-009a/b, 08/29/2025), revenue.iowa.gov/media/2725/download traditional worksheet lines 9-11 ('Percentage of Iowa... |
| IA | 2025 | holidays | Iowa Code 421.9A(1) defines 'holiday' as a legal public holiday (Iowa Code 1C.1: Jan 1, MLK, Feb 12, Washington's Birthday, Memorial Day, Jul 4, Labor Day, Nov 11,... |
| IA | 2026 | safe_harbor.current_pct | 2026 IA 2210 not yet published; 90% of current-year tax per 2025 IA 2210 (45-007a/b), revenue.iowa.gov/media/4399/download line 4 and Iowa DOR 'Estimated Income Tax... |
| IA | 2026 | farmer.rule | 2026 IA 1040ES instructions (45-009a/b, 08/29/2025), revenue.iowa.gov/media/2725/download 'Farmers and Fishers' (two-thirds or more of estimated gross income from... |
| IA | 2026 | penalty.rate | 2025 IA 2210F (45-008a), revenue.iowa.gov/media/4398/download ('10% per annum = 0.027397% per day (01/01/26 - 12/31/26)') covers calendar 2026 days only; the rate for... |
| IA | 2026 | holidays | Iowa Code 421.9A(1) defines 'holiday' as a legal public holiday (Iowa Code 1C.1: Jan 1, MLK, Feb 12, Washington's Birthday, Memorial Day, Jul 4, Labor Day, Nov 11,... |
| KS | 2026 | penalty.rate | Kansas 2025 Schedule K-210 and instructions, ksrevenue.gov/pdf/k-21025.pdf lines 15-16 give 8% for days from 1/1/26. The 2026 Schedule K-210 is not yet published, so the... |
| KS | 2026 | credit_for_other_state | Verified for 2025 on Form K-40 line 13 and the credit worksheet; 2026 K-40 not yet published, carried... |
| KS | 2026 | nonresident_method | Verified for 2025 on Form K-40 lines 9-10 and Schedule S Part B; 2026 K-40 not yet published, carried... |
| KY | 2026 | penalty.rate | Kentucky DOR 'Tax Interest Rate Update for 01-01-26' (base 7%, unpaid-tax rate 9%), revenue.ky.gov/News/Pages/Tax-Interest-Rate-Update-for-01-01-26.aspx gives 9% for... |
| KY | 2026 | credit_for_other_state | Verified for 2025 on the Kentucky 2025 Form 740 packet instructions, revenue.ky.gov/Forms/740%20Packet%20Instructions.pdf (Line 6; KRS 141.070); 2026 packet not yet... |
| KY | 2026 | nonresident_method | Verified for 2025 on Form 740-NP line 14 (four percent x Kentucky taxable income); 2026 Form 740-NP not yet published (2026 rate 3.5% per the 2026 estimated-tax... |
| LA | 2025 | holidays | La. R.S. 1:55(A)(1) legal holidays (legis.la.gov/Legis/LawPrint.aspx?d=74097): Jan 1; Jan 8 (Battle of New Orleans); 3rd Mon Jan (MLK); 3rd Mon Feb (Washington's... |
| LA | 2026 | safe_harbor.current_pct | 2026 Form R-210R-i is not yet published; the 2026 IT-540ESi does not restate this rule. Carried forward from Louisiana R-210R-i (1/26), Underpayment of Individual Income... |
| LA | 2026 | safe_harbor.prior_pct | 2026 Form R-210R-i is not yet published; the 2026 IT-540ESi does not restate this rule. Carried forward from Louisiana R-210R-i (1/26), Underpayment of Individual Income... |
| LA | 2026 | safe_harbor.high_agi_rule | 2026 Form R-210R-i is not yet published; the 2026 IT-540ESi does not restate this rule. Carried forward from Louisiana R-210R-i (1/26), Underpayment of Individual Income... |
| LA | 2026 | credit_for_other_state | Verified for 2025 (IT-540 Schedule C Line 1, R-10606 (1/26)); 2026 IT-540 instructions not yet published, carried... |
| LA | 2026 | nonresident_method | Verified for 2025 on IT-540B line 13; 2026 IT-540B not yet published, carried... |
| LA | 2026 | holidays | La. R.S. 1:55(A)(1) legal holidays (legis.la.gov/Legis/LawPrint.aspx?d=74097): Jan 1; Jan 8 (Battle of New Orleans); 3rd Mon Jan (MLK); 3rd Mon Feb (Washington's... |
