# Phase 2, batch 4: ME, MD, MA, MI, MN, MS, MT, NE state-rule sources (TY2025, TY2026)

Researched 2026-10-11 by the state-rules-researcher agent. Seeds: `packages/api/src/db/seeds/tax-estimator/state-rules/{ME,MD,MA,MI,MN,MS,MT,NE}.ts`. 13 keys per (state, year), 208 rows. Documents were downloaded and read as text (PDF via pdftotext, HTML stripped). Four statute pages could only be read through a summarising fetch tool or not at all, and those rows are unverified. Installment dates are stored rolled to the next business day (June 15, 2025 is a Sunday, so June 16, 2025), as in the MO seed. Farmer `due_date` / `file_by` of March 1, 2026 (a Sunday) are stored as the state prints them, not rolled. Holiday lists cover calendar 2025-2027 in both years.

| State | Year | Rows | verified | unverified |
|---|---|---|---|---|
| ME | 2025 | 13 | 13 | 0 |
| ME | 2026 | 13 | 13 | 0 |
| MD | 2025 | 13 | 10 | 3 |
| MD | 2026 | 13 | 8 | 5 |
| MA | 2025 | 13 | 13 | 0 |
| MA | 2026 | 13 | 13 | 0 |
| MI | 2025 | 13 | 10 | 3 |
| MI | 2026 | 13 | 11 | 2 |
| MN | 2025 | 13 | 13 | 0 |
| MN | 2026 | 13 | 13 | 0 |
| MS | 2025 | 13 | 10 | 3 |
| MS | 2026 | 13 | 6 | 7 |
| MT | 2025 | 13 | 13 | 0 |
| MT | 2026 | 13 | 10 | 3 |
| NE | 2025 | 13 | 12 | 1 |
| NE | 2026 | 13 | 11 | 2 |

Totals: 179 verified, 29 unverified (all 29 itemised in the last table).

## Rules the key set cannot express

- **ME threshold is two-part.** Estimates are required only if current-year Maine tax after withholding and credits is at least $1,000 AND prior-year liability was also at least $1,000 (36 M.R.S. 5228(2-C), (2-D)). Only the $1,000 is stored. Maine also has an "unusual event income" rule (90% on non-withheld income that rises $500,000 or more over the same quarter of the prior year, with no prior-year safe harbor on that income).
- **MT farmers are exempt from estimates entirely** (two-thirds farming/ranching gross income) rather than given a single January installment. `farmer.rule` is null with the explanation; the engine must treat such a taxpayer as owing no Montana estimates.
- **MA farmers** have no January 15 installment in the documents read. They pay in full with the return by March 1, so `due_date = file_by = March 1`.
- **MD farmer** pays line 10 of Form 502UP (lesser of 90% current / 110% prior) in one installment, so `current_pct` is 0.90, not 2/3.
- **MI and NE high-AGI rule** has a lower married-filing-separately threshold ($75,000) that the `{threshold, pct}` shape cannot carry. MN uses $150,000 for all filers.
- **Penalty rates float but the key holds one value.** MA is quarterly (2026: 8%, 7%, 8%, 8%); MI is six-monthly (9.47%, 8.66%, 8.48%, 7.85%, 7.77%); MD was 11.4825% to 12/31/2025 and 10.8133% after; ME 10% (2025) and 9% (2026); MN 8% (2025) and 7% (2026); MT uses the rate of the year the return is due. The chosen value and the alternatives are in each citation.
- **MD** adds a 2.25% special nonresident tax on top of the ratio-computed tax; `nonresident_method = ratio` captures only the ratio part. MD county tax and MI city income taxes are outside the key set.

## Documents fetched (2026-10-11)

### Maine
- Form 1040ES-ME instructions 2026 (Rev. July 2026): https://www.maine.gov/revenue/sites/maine.gov.revenue/files/inline-files/26_1040es_fillable.pdf
- Form 1040ES-ME instructions 2025: https://www.maine.gov/revenue/sites/maine.gov.revenue/files/inline-files/25_1040es_dwnld_ff.pdf (vouchers in 25_1040es_dwnld.pdf show "Due June 16, 2025")
- Form 2220ME 2025 (Rev. Dec 2025), penalty-rate table for 2025 and 2026 (corporate form): https://www.maine.gov/revenue/sites/maine.gov.revenue/files/inline-files/25_2220me_fillable.pdf
- Form INS-6 2026 (2026 interest rate 9%): https://www.maine.gov/revenue/sites/maine.gov.revenue/files/inline-files/26_ins_6_fillable.pdf
- 36 M.R.S. 186, 5111, 5142, 5217-A, 5228 (https://legislature.maine.gov/statutes/36/title36sec5228.html and the matching secNNN pages); 4 M.R.S. 1051 (https://legislature.maine.gov/statutes/4/title4sec1051-1.html)

### Maryland
- Form 502UP 2025 (Rev. 09/25): https://www.marylandcomptroller.gov/content/dam/mdcomp/tax/forms/2025/502up.pdf
- Payment Voucher Worksheet (declaration instructions, for 2026 estimates): https://www.marylandcomptroller.gov/content/dam/mdcomp/tax/forms/worksheets/2025-PV-Worksheet.pdf (and 2024-PV-Worksheet.pdf)
- Form 505 (2025) and Form 505NR (2025): https://www.marylandcomptroller.gov/content/dam/mdcomp/tax/forms/2025/505.pdf ; .../2025/505nr.pdf
- Statutes read only through a summarising fetch of mgaleg.maryland.gov (script-rendered): General Provisions 1-111 (holidays), Tax-General 10-703 (credit)

### Massachusetts (mass.gov blocks default clients; browser-style headers were needed)
- Form 1-ES 2026 instructions: https://www.mass.gov/doc/2026-form-1-es-estimated-tax-payment-vouchers-instructions-and-worksheets/download (the "2025" URL returns the identical 2026 file; no TY2025 1-ES was read)
- Form M-2210 2025: https://www.mass.gov/doc/2025-form-m-2210-underpayment-of-massachusetts-estimated-income-tax/download
- AP 241 Estimated Income Tax Payments (01/29/2025): https://www.mass.gov/administrative-procedure/ap-241-requirement-to-make-estimated-income-tax-payments
- TIR 26-2 and TIR 26-5 (interest rates): https://www.mass.gov/technical-information-release/tir-26-2-interest-rate-on-overpayments-and-underpayments ; .../tir-26-5-interest-rate-on-overpayments-and-underpayments
- G.L. c.62 5A and 6; c.4 7 and 9: https://malegislature.gov/Laws/GeneralLaws/PartI/TitleIX/Chapter62/Section5A (and Section6; PartI/TitleI/Chapter4/Section7 and Section9)

### Michigan
- MI-1040ES 2026: https://www.michigan.gov/taxes/-/media/Project/Websites/taxes/Forms/IIT/TY2025/MI-1040ES-(2026).pdf
- MI-1040ES 2025: https://www.michigan.gov/taxes/-/media/Project/Websites/taxes/Forms/IIT/TY2024/MI-1040ES_2025.pdf
- MI-2210 2025: https://www.michigan.gov/taxes/-/media/Project/Websites/taxes/Forms/IIT/TY2025/MI-2210.pdf
- MI-1040 2025 instruction book: https://www.michigan.gov/taxes/-/media/Project/Websites/taxes/Forms/IIT/TY2025/MI-1040-Book.pdf
- Revenue Administrative Bulletin 2026-10 (interest rates): https://www.michigan.gov/taxes/rep-legal/rab/2026-revenue-administrative-bulletins/revenue-administrative-bulletin-2026-10
- MCL 435.101 (legal holidays): https://www.legislature.mi.gov/Laws/MCL?objectName=mcl-435-101

### Minnesota
- Estimated Tax Payments for Individuals: https://www.revenue.state.mn.us/estimated-tax ; Calculating Penalty and Interest: https://www.revenue.state.mn.us/calculating-penalty-and-interest ; Penalties and Interest for Individuals: https://www.revenue.state.mn.us/penalties-and-interest-individuals
- Minn. Stat. 289A.25, 290.06 (subd. 2c and 22), 290.014, 645.44: https://www.revisor.mn.gov/statutes/cite/289A.25 (and 290.06, 290.014, 645.44). Schedule M15 itself was not located.

### Mississippi
- Form 80-100 2025 instruction booklet (Rev. 12/25): https://www.dor.ms.gov/sites/default/files/tax-forms/individual/80100251%202.pdf
- Form 80-320 2025 interest/penalty worksheet: https://www.dor.ms.gov/sites/default/files/tax-forms/individual/80320258%201.pdf
- Individual Income Tax FAQ: https://www.dor.ms.gov/individual/individual-income-tax-frequently-asked-questions
- Miss. Code 3-3-7: current text NOT read (only the 2025 introduced bill SB 2588: https://billstatus.ls.state.ms.us/documents/2025/pdf/SB/2500-2599/SB2588IN.pdf). No 2026 Mississippi forms exist yet.

### Montana
- Publication 1 (2026): https://revenuefiles.mt.gov/files/Forms/Publication-1/Publication-1-2026.pdf (also -2025.pdf)
- Form EST-I 2025: https://revenuefiles.mt.gov/files/Forms/EST-I/EST-I-2025.pdf
- Making Estimated Tax Payments: https://revenue.mt.gov/taxes/estimated-tax-payments
- Form 2 (2025) schedules II and III: https://revenue.mt.gov/files/Forms/Montana-Individual-Income-Tax-Return-Form-2/2025_Montana_Individual_Income_Tax_Return_Form_2.pdf
- MCA 1-1-216: https://archive.legmt.gov/bills/mca/title_0010/chapter_0010/part_0020/section_0160/0010-0010-0020-0160.html

### Nebraska
- Form 1040N-ES 2025 booklet: https://revenue.nebraska.gov/sites/default/files/doc/tax-forms/2024/f_1040N-ES_2025.pdf ; 2026 booklet: https://revenue.nebraska.gov/sites/default/files/doc/tax-forms/2025/f_1040N-ES.pdf
- Form 2210N 2025: https://revenue.nebraska.gov/sites/default/files/doc/tax-forms/2025/f_2210N.pdf ; DRAFT 2026 Form 2210N: https://revenue.nebraska.gov/sites/default/files/doc/tax-forms/drafts/f_2210n.pdf
- Neb. Rev. Stat. 25-2221, 77-2715, 77-2730: https://nebraskalegislature.gov/laws/statutes.php?statute=77-2715 (and the other section numbers)

## Unverified rows (full reason in each row's citation)

| State | Year | Key | Citation / reason |
|---|---|---|---|
| MD | 2025 | `installments.due_dates` | Form 502UP (2025) line 16 header ("DUE DATES OF INSTALLMENTS April 15, 2025 June 15, 2025 Sept 15, 2025 Jan 15, 2026"). June 15, 2025 is a Sunday and is stored as June 16, 2025 on the general next-business-day rule; the estimated-installment weekend rule itself was not found in the Maryland documents read (Forms PVW/PV state it only for extension/return payments), so this row is unverified. |
| MD | 2025 | `credit_for_other_state` | Md. Code, Tax-General 10-703 (resident credit for income tax paid to another state, capped so Maryland tax is not reduced below the tax computed without that income). Read only through a summarising web-fetch of mgaleg.maryland.gov (script-rendered page), and Form 502CR instructions were not read, so unverified. |
| MD | 2025 | `holidays` | Md. Code, General Provisions 1-111(a)-(b) (New Year's Day; MLK 3rd Mon Jan; Lincoln's Birthday Feb 12; Washington's Birthday 3rd Mon Feb; Maryland Day Mar 25; Good Friday; Memorial Day; Juneteenth; July 4; Labor Day; Defenders' Day Sep 12; Columbus Day 2nd Mon Oct; Nov 11; Thanksgiving; Friday after Thanksgiving; Dec 25; each statewide general election day; Sunday holiday observed the following Monday). READ ONLY THROUGH A SUMMARISING WEB-FETCH of mgaleg.maryland.gov (the statute page is script-rendered), so the list and the ones-off dates are not confirmed against raw statute text. Good Friday and Nov 3, 2026 election day computed. Calendar 2025-2027. |
| MD | 2026 | `safe_harbor.current_pct` | Not stated in the 2026 PVW; carried from Form 502UP (2025) line 8 / Exception B(2) (90% of current-year tax). No 2026 Form 502UP exists yet (published after year end). Tax-General 13-602/13-702 text not read. |
| MD | 2026 | `farmer.rule` | 2026 PVW "Farmers and fishermen" (at least two-thirds of gross income from farming or fishing; "2026 declaration and full payment of the estimated tax are due on or before January 15, 2027 ... file ... complete tax return ... and pay the full amount of tax due on or before March 1, 2027"). current_pct 0.90 is carried from Form 502UP (2025) (line 10 = lesser of 90% / 110%) because the 2026 PVW does not state the farmer percentage, so this row is unverified. |
| MD | 2026 | `nonresident_method` | Form 505NR (2025) Part II (Maryland income factor method; special nonresident tax 2.25%); no 2026 Form 505NR exists yet and Tax-General text was not read, so unchanged-law is assumed |
| MD | 2026 | `credit_for_other_state` | Md. Code, Tax-General 10-703 (resident credit for income tax paid to another state; read only through a summarising web-fetch of mgaleg.maryland.gov, raw statute text not seen), so unverified. |
| MD | 2026 | `holidays` | Md. Code, General Provisions 1-111(a)-(b) (New Year's Day; MLK 3rd Mon Jan; Lincoln's Birthday Feb 12; Washington's Birthday 3rd Mon Feb; Maryland Day Mar 25; Good Friday; Memorial Day; Juneteenth; July 4; Labor Day; Defenders' Day Sep 12; Columbus Day 2nd Mon Oct; Nov 11; Thanksgiving; Friday after Thanksgiving; Dec 25; each statewide general election day; Sunday holiday observed the following Monday). READ ONLY THROUGH A SUMMARISING WEB-FETCH of mgaleg.maryland.gov (the statute page is script-rendered), so the list and the ones-off dates are not confirmed against raw statute text. Good Friday and Nov 3, 2026 election day computed. Calendar 2025-2027. |
| MI | 2025 | `installments.due_dates` | MI-1040ES (2025) "Payment Due Dates" (April 15, June 15, September 15, 2025 and January 15, 2026). June 15, 2025 is a Sunday and is stored as June 16, 2025 on the general next-business-day rule; the Michigan documents read (MI-1040ES, MI-2210, MI-1040 book) contain no weekend/holiday sentence for estimated installments, so the roll is unverified. |
| MI | 2025 | `farmer.rule` | MI-1040ES (2025) states only that estimated payments are not needed if two-thirds of gross income is from farming/fishing and uses 66 2/3% for farmers; the January 15 voucher and March 1 return dates are taken from MI-1040ES (2026) "Estimated Tax Payments for Farmers, Fishermen" ("File your first 2026 voucher on or before January 15 ... File your 2026 MI-1040 return on or before March 1, 2027, and pay the entire tax") shifted one year; the 2025 booklet text was not seen, so unverified. |
| MI | 2025 | `nonresident_method` | MI-1040 2025 instruction book, Schedule NR (Michigan-source income in Column B taxed at the flat 4.25% rate; exemptions prorated by Michigan-source / total income, Worksheet 6 "Exemption allowance for Schedule NR"); MCL 206.30 and 206.110 not read |
| MI | 2026 | `credit_for_other_state` | MI-1040 2025 instruction book, Line 18 (credit for income tax imposed by another state: lesser of the other-state tax or Michigan tax x out-of-state income / total income subject to Michigan tax; worked example); 2026 book not yet issued, unchanged-law assumed |
| MI | 2026 | `nonresident_method` | MI-1040 2025 instruction book, Schedule NR (Michigan-source income in Column B taxed at the flat 4.25% rate; exemptions prorated by Michigan-source / total income, Worksheet 6 "Exemption allowance for Schedule NR"); MCL 206.30 and 206.110 not read; 2026 book not yet issued |
| MS | 2025 | `installments.due_dates` | Form 80-100 (2025) Declaration of Estimated Tax table (First quarter April 15th, Second June 15th, Third September 15th, Fourth January 15th) and Form 80-320 (2025) columns (Apr. 15, 2025; June 15, 2025; Sept. 15, 2025; Jan. 15, 2026). June 15, 2025 is a Sunday and is stored as June 16, 2025 on the next-business-day rule that the DOR FAQ states for returns ("If the due date falls on a Saturday, Sunday or legal holiday, the return is due the next business day"); no estimated-installment roll sentence was found, so unverified. |
| MS | 2025 | `nonresident_method` | Form 80-100 (2025) instructions on Form 80-205: "Prorate ... the ratio that income from sources within Mississippi (Line 50, Mississippi Only Income) bears to the total income from all sources" applies to adjustments; the tax is then figured on Mississippi-only income at the flat rate schedule. The tax-computation line of Form 80-205 itself was not read, so the method label is unverified. |
| MS | 2025 | `holidays` | Miss. Code 3-3-7 (legal holidays) -- CURRENT TEXT NOT READ (justia and state sites blocked or script-rendered). The list is rebuilt from the 2025 introduced bill SB 2588 (which shows the statute's structure: New Year's Day; 3rd Mon Jan (Lee/King); 3rd Mon Feb; last Mon May; July 4; Labor Day; Nov 11; Thanksgiving; Dec 25), plus Confederate Memorial Day (last Monday in April), which that bill proposed to repeal and whose repeal was not confirmed. Juneteenth omitted (SB 2588 proposed adding it; enactment not confirmed). Sunday holiday observed Monday. Calendar 2025-2027 computed. |
| MS | 2026 | `safe_harbor.prior_pct` | Carried from Form 80-320 (2025) lines 3-4 (lesser of 80% of current-year or 100% of prior-year liability); no 2026 Form 80-320 is published yet and the DOR FAQ does not mention the prior-year alternative |
| MS | 2026 | `safe_harbor.high_agi_rule` | No high-AGI rule: Form 80-320 (2025) line 4 uses 100% of prior-year liability with no income test |
| MS | 2026 | `installments.pcts` | Carried from Form 80-320 (2025) line 5 (1/4th per installment); no 2026 form published yet |
| MS | 2026 | `farmer.rule` | Carried from Form 80-320 / Form 80-100 (2025) farmers-or-fishermen exception (80% by January 15 or file and pay by March 1); no 2026 form published yet |
| MS | 2026 | `credit_for_other_state` | Form 80-100 (2025) Line 18 "Credit for Income Tax Paid to Another State"; no 2026 booklet yet, unchanged-law assumed |
| MS | 2026 | `nonresident_method` | Form 80-100 (2025) instructions on Form 80-205: "Prorate ... the ratio that income from sources within Mississippi (Line 50, Mississippi Only Income) bears to the total income from all sources" applies to adjustments; the tax is then figured on Mississippi-only income at the flat rate schedule. The tax-computation line of Form 80-205 itself was not read, so the method label is unverified. |
| MS | 2026 | `holidays` | Miss. Code 3-3-7 (legal holidays) -- CURRENT TEXT NOT READ (justia and state sites blocked or script-rendered). The list is rebuilt from the 2025 introduced bill SB 2588 (which shows the statute's structure: New Year's Day; 3rd Mon Jan (Lee/King); 3rd Mon Feb; last Mon May; July 4; Labor Day; Nov 11; Thanksgiving; Dec 25), plus Confederate Memorial Day (last Monday in April), which that bill proposed to repeal and whose repeal was not confirmed. Juneteenth omitted (SB 2588 proposed adding it; enactment not confirmed). Sunday holiday observed Monday. Calendar 2025-2027 computed. |
| MT | 2026 | `penalty.rate` | Montana Publication 1 (2026) "Interest on the Underpayment of Estimated Tax" (TY2026 uses the interest rate effective for calendar 2027, not yet announced); 7% is the 2026 rate carried from Form EST-I (2025). Unverified until the 2027 rate is published. |
| MT | 2026 | `credit_for_other_state` | Montana Form 2 (2025) Schedule III Part II "Credit For Income Taxes Paid to Another State or Country" (separate computations for ordinary income and net long-term capital gains); 2026 form not yet issued, unchanged-law assumed |
| MT | 2026 | `nonresident_method` | Montana Form 2 (2025) Schedule II "Tax on Montana Source Income" lines 17-25 (Montana source ordinary income ratio = line 15 / line 16 everywhere ordinary income; tax x ratio; same for net long-term capital gains); 2026 form not yet issued, unchanged-law assumed |
| NE | 2025 | `holidays` | Neb. Rev. Stat. 25-2221 (time computation; days courts and offices may be closed: Jan 1; MLK 3rd Mon Jan; President's Day 3rd Mon Feb; Arbor Day last Friday in April; Memorial Day; Juneteenth; July 4; Labor Day; Indigenous Peoples' Day/Columbus Day 2nd Mon Oct; Nov 11; Thanksgiving; day after Thanksgiving; Dec 25; Sunday holiday -> Monday, Saturday holiday -> preceding Friday). This is the COURT/time-computation holiday statute; the Department of Revenue does not state which list it applies, and the state-employee holiday statute (Neb. Rev. Stat. 84-1001) was not read, so unverified. Calendar 2025-2027 computed; Jan 1, 2028 (Saturday) -> Dec 31, 2027. |
| NE | 2026 | `penalty.rate` | Nebraska DRAFT Form 2210N for 2026 ("DRAFT AS OF 8/17/2026 DO NOT FILE") line 22a ("8% per year ... number of days in 2026"). The final 2026 form and Neb. Rev. Stat. 45-104.02 / 77-2790 rate text not read, so unverified. |
| NE | 2026 | `holidays` | Neb. Rev. Stat. 25-2221 (time computation; days courts and offices may be closed: Jan 1; MLK 3rd Mon Jan; President's Day 3rd Mon Feb; Arbor Day last Friday in April; Memorial Day; Juneteenth; July 4; Labor Day; Indigenous Peoples' Day/Columbus Day 2nd Mon Oct; Nov 11; Thanksgiving; day after Thanksgiving; Dec 25; Sunday holiday -> Monday, Saturday holiday -> preceding Friday). This is the COURT/time-computation holiday statute; the Department of Revenue does not state which list it applies, and the state-employee holiday statute (Neb. Rev. Stat. 84-1001) was not read, so unverified. Calendar 2025-2027 computed; Jan 1, 2028 (Saturday) -> Dec 31, 2027. |
