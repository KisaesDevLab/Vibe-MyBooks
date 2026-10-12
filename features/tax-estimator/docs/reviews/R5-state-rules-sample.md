# R5 — State rules sample audit (second opinion after the opus audits)

Reviewer: fable-process-reviewer, 2026-10-12. Scope: `packages/api/src/db/seeds/tax-estimator/state-rules/<ST>.ts`, tax years 2025 and 2026, for MO, AR (all 13 keys, both years) plus a 21-state sample: CA, NY, IL, MI, VA (random), UT, ID, AZ, GA, OK, OR, MT, VT, PA, NJ, RI, NM, MA, CO, HI, ME (non-federal patterns). 23 states x 2 years x 13 keys = 598 rows re-read against primary sources (state revenue-department forms and instructions, statutes, official holiday lists), independently of the citations in the seed files and of the phase-2 reports. Nothing but this file was written; no git, no database.

Method: MO and AR were read by the reviewer directly (documents downloaded and `pdftotext`-ed, statutes from revisor.mo.gov). The other 21 states were split across five fresh general-purpose agents with identical instructions ("primary sources only; do not trust seed citations or prior reports; output CONFIRMED / WRONG / CANNOT VERIFY per key"); their findings were cross-read against the seeds and the phase-2 audits before being adopted here.

## Verdict: PASS WITH FIXES

- **MO/AR stored values: no row is wrong.** Every MO and AR value is confirmed from the state's own documents, including the two items the owner cares most about (MO $100 declaration threshold measured on estimated tax net of credits *including withholding*; AR $1,000 threshold with "more than" semantics). The Arkansas Act 1 of 2026 claim (top rate 3.7% from tax years beginning 1/1/2026) is confirmed from the arkleg text.
- **But two Critical findings would make the owner's Missouri penalty wrong** if the engine reads the 13 keys literally: (C1) Missouri has a **$500 penalty floor** (MO-2210 Part I line 4) distinct from the $100 declaration threshold, and (C2) the MO penalty rate changes every January 1 (8% -> 7% for TY2025) while the key holds one rate per tax year. Both need a key, not a seed edit.
- **Major: 13 findings (26 state-year rows) in the other 21 states**, chiefly: ID installments (four vouchers seeded for a state with no estimate regime), AZ and NM farmer percentages, MT 2025 rate, GA nonresident label, IL farmer exemption encoded as "no rule", and penalty rates that vary within the year (CA, MI, NY, VA, MA) or are not annual rates at all (HI).
- **Minor: 11 findings** (holiday lists in PA, IL, MI, NM, OK, ME, UT; citations; threshold boundary semantics; unrolled farmer dates).
- The 13-key set cannot drive correct vouchers and penalties for roughly half the sample without six additional keys/flags (Part D).

Counts: **Critical 2 (both MO, both design/key gaps, 0 wrong stored values); Major 13 findings / 26 rows; Minor 11 findings.**

## Part B: WRONG findings (all states)

Severity per the brief: Critical = would make the owner's MO/AR vouchers or penalties wrong; Major = wrong value in another state; Minor = citation/holiday/boundary issues.

| # | Sev | State | Year | Key | Stored | Correct | Source |
|---|---|---|---|---|---|---|---|
| C1 | **Critical** | MO | 2025, 2026 | required_threshold (as used for the penalty) | 100 (correct for the declaration) | The *penalty* floor is **$500**: "Subtract Line 3 [withholding] from Line 1 [tax after credits]. If less than $500, stop here; do not complete or file this form. You do not owe the penalty." An engine using `required_threshold` as the §6654(e)(1)-style floor (the federal pattern, where both are $1,000) assesses a **false penalty on every MO balance of $100-$499**. Fix: new key `penalty.min_balance_due = 500` (MO), keep `required_threshold = 100`. | Form MO-2210 2025 Part I line 4 (identical in the 2024 form); MO-1040 Instructions 2025, Line 55 |
| C2 | **Critical** | MO | 2025 (and 2026) | penalty.rate | 0.08 (2025) / 0.07 (2026) | Values are right for days in calendar 2025 / 2026, but the rate is a **calendar-year** rate: a TY2025 underpayment accrues at 8% to 12/31/2025 and **7% from 1/1/2026 to 4/15/2026** (MO-2210 lines 28a/28b compute the two legs separately). The Q4 (Jan 15) installment, the one most often underpaid, accrues entirely at the *next* year's rate. A single tax-year rate overstates MO penalties by 1 point on all post-Dec-31 days (about $5 per $2,000 underpaid for 90 days). The 2027 rate (TY2026 tail) is set by Oct 22, 2026 and is not yet published. Fix: `penalty.rate_schedule` [{from, to, rate}] by calendar date (also needed by OR, MT, VT, CO, NJ, PA, CA, MI, NY, VA, MA, AZ, NM — see Part D). | 12 CSR 10-41.010(1) table (2024 9%, 2025 8%, 2026 7%); MO-2210 2025 lines 28a/28b and 2024 lines 28a (9%)/28b (8%); RSMo §32.065 |
| M1 | Major | ID | 2025, 2026 | installments.due_dates | 4 quarterly dates | **[2026-04-15]** / **[2027-04-15]** (single date). "Idaho doesn't require estimated tax payments"; Form 51 is only the extension-protection payment (100% of prior-year tax or 80% of current, pay by April 15; $50 de minimis). Idaho Code 63-3036A ($500 test) is corporate only. Four seeded dates would fabricate four vouchers and a penalty that does not exist. | Form 40 Instructions EIN00046 (03-02-2026) p.4-5; Form 51 EFO00092; I.C. 63-3036A(a) |
| M2 | Major | ID | 2025, 2026 | installments.pcts | [.25 x4] | **[1.0]** (same reason). `penalty.rate 0.06` is Idaho's *interest* rate (6% 2025-2027), not an estimate penalty; keep only with a kind flag or mirror UT's 2%/month extension penalty. | as M1; tax.idaho.gov interest-rates table |
| M3 | Major | AZ | 2025, 2026 | farmer.rule.current_pct | 0.6666666667 | **0.9**. Arizona has no reduced farmer percentage: Form 221 line 9 is 90%/100% for everyone; the farmer rule is only "one installment on January 15" or "file and pay by March 1". Seed understates the farmer's required payment by a quarter. | 2025 Form 221 instructions; 2025/2026 140ES instructions; A.R.S. 43-581(A) |
| M4 | Major | NM | 2025, 2026 | farmer.rule.current_pct | 0.9 | **0.6666666667**. NMSA 7-2-12.2(E): a rancher/farmer (2/3 test, satisfiable on the *prior* year's income too) pays one installment by Jan 15 or files and pays by Mar 1, and "a penalty under Subsection G shall not be imposed unless the rancher or farmer underpays the tax by more than one-third" — i.e. a 66 2/3% safe harbor, not 90%. The researcher/auditor had it backwards. | NMSA 7-2-12.2(E) (HB 470, 2011 enacted text); 2025 PIT-ES instructions; FYI-320 |
| M5 | Major | MT | 2025 | penalty.rate | 0.07 | **0.08**. Montana DOR historical table: 2025 = 8.00%; the EST-I 2025 instructions give 7% only "as of January 1, 2026" (the 2026 rate, which the seed has right). | revenue.mt.gov "Penalty and Interest" table; Form EST-I 2025 |
| M6 | Major | GA | 2025, 2026 | nonresident_method | ratio | **sourced_flat** (or redefine the enum). IT-511 Schedule 3: the Georgia/total income ratio (line 9) prorates only deductions and exemptions (line 13); Georgia taxable income (line 14) is Georgia-source income less prorated deductions, taxed directly — the same mechanics the seeds label `sourced_flat` for ID, AZ, PA, MI. Informational key, so low impact. | 2025 IT-511 p.26, Schedule 3 lines 9-14 |
| M7 | Major | IL | 2025, 2026 | farmer.rule | null | **exempt**. Illinois farmers (at least 2/3 of federal gross income from farming) are exempt from estimated payments entirely — no Jan 15 payment, no Mar 1 filing. The seed's `null` reads as "no farmer rule" (federal pattern applies), so an engine would schedule four vouchers and a penalty for exempt farmers. PROGRESS.md's special-case list names OK/OR/MT/VT but not IL. | IL-1040-ES (2026) exceptions; IL-2210 instructions; Pub-105 |
| M8 | Major | CA | 2025 | penalty.rate | 0.07 | **8% for 4/15-6/30/2025, 7% from 7/1/2025** (FTB rates are semiannual). 2026: 7% through 12/31/2026 confirmed; Jan-Apr 2027 not yet set. | 2025 FTB 5805 instructions §K; ftb.ca.gov interest and estimate penalty rates |
| M9 | Major | MI | 2025, 2026 | penalty.rate | 0.0866 / 0.0785 | TY2025 MI-2210: **9.47%** 4/15-6/30/25, 8.66% 7/1-12/31/25, **8.48%** 1/1-4/15/26. TY2026: 8.48% 4/15-6/30/26, 7.85% 7/1-12/31/26, **7.77%** 1/1-4/15/27 (published). Michigan also adds a flat **10% penalty (min $10)** on underpaid estimates (MI-2210 Part 3) that no key holds. | MI-2210 TY2025 Part 2; RABs 2024-16, 2025-6, 2025-13, 2026-5, 2026-10 |
| M10 | Major | NY | 2026 | penalty.rate | 0.095 | **8.5% for 4/1-6/30/2026**, 9.5% Q3 and Q4 2026; Q1 2027 TBD. (2025 confirmed: 9.5% every period 4/15/25-4/15/26.) | tax.ny.gov quarterly interest rates 2026 (income underpayment, §697(j)) |
| M11 | Major | VA | 2026 | penalty.rate | 0.09 | **8% for 5/1-6/30/2026**, 9% Q3-Q4 2026; Q1 2027 TBD. (2025 confirmed 9% throughout; §58.1-15(B) carries the Q1 rate through May 1, and the period ends May 1, not Apr 15.) | Tax Bulletins 26-2, 26-3, 26-4; 2025 Form 760C line 23 |
| M12 | Major | MA | 2026 | penalty.rate | 0.08 | **Q1 2026 8%, Q2 2026 7%, Q3 8%, Q4 8%**; Q1 2027 unpublished. (2025 confirmed 8% all year, M-2210 lines 20-23.) | TIR 25-4, 26-2, 26-5 |
| M13 | Major | HI | 2025, 2026 | penalty.rate | 0.08 (annual) | **2/3% (.00667) per month or part of a month** — HRS §235-97(f) and N-210 Part IV count whole months after the due date; a daily 8% accrual understates. Needs a `penalty.method = monthly_or_fraction` flag; the stored 0.08 is only the nominal annual equivalent. Also: Form N-1 no longer exists (seed citations stale; the voucher is N-200V). | HRS §235-97(f); 2025 Form N-210 instructions Part IV; tax.hawaii.gov forms list |
| M14 | Major (partial) | MA | 2025, 2026 | farmer.rule | due_date = file_by = Mar 1/2 | M.G.L. c.62B §14(c): "there shall be **four** required installments" — farmers pay the regular quarterly schedule at 66 2/3%, and §14(h)/M-2210 waive the penalty only if the farmer files **and pays by March 1**. Storing `due_date = March 1` would make the engine print one farmer voucher instead of four 66 2/3% installments. | M.G.L. c.62B §14(c),(h); 2025 Form M-2210 |
| m1 | Minor | AR | 2025, 2026 | required_threshold (comparator) | 1000, engine semantics "at least" | **"more than $1,000"**: AR2210 line 4 "If the result is $1,000 or less, stop here"; Reg 1997-4 §1.26-18-208(6) "shall not be imposed if the tax liability ... is one thousand dollars or less"; AR1000ES "Who must file ... more than one thousand dollars". Only the worksheet note and AR2210 Instr. 1(a) say "$1,000 or more". A penalty at exactly $1,000.00 is the only consequence. Same ">" semantics in IL, MI, VA, NJ, MA, CO (see D2). | AR2210 2025; DFA Reg 1997-4 |
| m2 | Minor | AR | 2025, 2026 | holidays | status `unverified` | List is **correct — upgrade to verified**: OPM Policy 52 (authority Ark. Code §§1-5-101-104, eff. 5/22/2025) lists Jan 1, 3rd Mon Jan, 3rd Mon Feb (Washington/Daisy Gatson Bates), last Mon May, Jul 4, 1st Mon Sep, Nov 11, 4th Thu Nov, Dec 24, Dec 25; "Holidays which occur on a Saturday will be observed on the preceding Friday ... Sunday ... the following Monday." No Juneteenth; day after Thanksgiving only if the Governor declares it. | sas.arkansas.gov OPM Policy 52; UAMS HR holiday schedules 2025/2026 |
| m3 | Minor | PA | 2025, 2026 | holidays | includes Good Friday (2025-04-18, 2026-04-03); 2026-07-04; omits Nov 28, 2025 / Nov 27, 2026 | Commonwealth holidays: 2025: Jan 1, Jan 20, Feb 17, May 26, Jun 19, Jul 4, Sep 1, Oct 13, Nov 11, Nov 27, **Nov 28**, Dec 25. 2026: Jan 1, Jan 19, Feb 16, May 25, Jun 19, **Jul 3**, Sep 7, Oct 12, Nov 11, Nov 26, **Nov 27**, Dec 25. Good Friday is not a holiday. Also: the seed cites "Act 2022-53" for the $11,000/$14,000 income steps; the amendment is **Act 108 of 2022** (P.L.1695). No due date affected. | Admin. Circulars 24-12 and 25-13; 72 P.S. §7325(a) |
| m4 | Minor | IL | 2025, 2026 | holidays | includes Casimir Pulaski Day and Good Friday; omits day after Thanksgiving; 2026-07-04 | State holidays per CMS: no Pulaski Day / Good Friday; add 11/28/25, 11/27/26, 11/26/27; 2026 Jul 4 observed **7/3**; 2027 Juneteenth observed **6/18**, Jul **5**, Christmas **12/24**. No due date affected. | CMS state holidays page + memo 11/18/2025 |
| m5 | Minor | MI | 2025, 2026 | holidays | NY's list (Lincoln's Birthday, Columbus Day) | Michigan: 2025: 1/1, 1/20, 2/17, 5/26, 6/19, 7/4, 9/1, 11/11, 11/27, 11/28, 12/24, 12/25, 12/31. 2026: 1/1, 1/19, 2/16, 5/25, 6/19, 7/3, 9/7, 11/3 (election), 11/11, 11/26, 11/27, 12/24, 12/25, 12/31. 2027 not yet published. No due date affected. | michigan.gov/som state holidays (CSC Reg 5.08) |
| m6 | Minor | NM | 2025, 2026 | holidays | 2025-02-17, 2026-02-16 | New Mexico observes Presidents' Day on the **day after Thanksgiving** (2025-11-28, 2026-11-27), not in February; remove the February dates, add those. 2026-07-04 extra is harmless (07-03 present). | SPO General Memoranda 2024-007 and 2025-015 |
| m7 | Minor | OK | 2025, 2026 | holidays | omits Dec 24 | Add **2025-12-24** and **2026-12-24** (OMES: "Dec. 24 & 25, 2026"; 2025 EFT calendar "Additional Christmas Holiday Observed 12/24/2025"). 2027 per EO 2026-26: Jan 1, Jan 18, Feb 15, May 31, Jul 5, Sep 6, Nov 11, Nov 25-26, **Dec 23-24** (seed's 2027-12-25 and 2027-12-31 are not on it). No due date affected. | OMES holidays page; EO 2025-14, EO 2026-26; SOS 2026 list |
| m8 | Minor | ME | 2025, 2026 | holidays | 2026-07-04; omits Fri after Thanksgiving | Add 11/28/25 and 11/27/26; 2026 Jul 4 observed **7/3**. No due date affected. | Maine BHR holiday schedule |
| m9 | Minor | UT | 2026 (2027 dates) | holidays | 2027-06-18 | **2027-06-21**: Utah Code 63G-1-301(2)(d) moves a Saturday/Sunday Juneteenth to the *following Monday*. Good Friday became a Utah holiday eff. 5/6/2026 (2026-04-03 missing; nothing falls on it). | Utah Code 63G-1-301 |
| m10 | Minor | NY, MI, NM, RI, MA, CO, HI, ME, AZ (convention) | 2025 | farmer.rule.file_by | NY/MI/NM store 2026-03-01 (Sunday) unrolled; CA/VA/PA/MO/AR/GA/RI/AZ/CO/HI/ME/MA store 2026-03-02 | Only CA (540-ES) and PA (REV-413(I)/REV-1630A) print "March 2, 2026"; every other state's form prints "March 1, 2026" and relies on its general weekend rule. Pick one convention (recommend: store the statutory date, let the engine roll with the state's weekend/holiday rule and `holidays`). | respective 2025 forms |
| m11 | Minor | HI | 2025, 2026 | citations | "Form N-1 instructions" | Form N-1 was discontinued; vouchers are Form N-200V; rules are in N-210 and the N-11/N-15 instructions. | tax.hawaii.gov alphabetical forms list |

Confirmed-as-stored but previously `unverified` (status can be raised with a citation fix): AR holidays (both years); CO 2025 holidays, CO 2026 credit_for_other_state, CO 2026 nonresident_method, CO 2026 holidays (2027 dates still CV); ID required_threshold 0, safe_harbor 0.8/1.0, credit, nonresident (as the extension test); AZ required_threshold 1000 (as the penalty floor); GA required_threshold 0; AZ farmer ratio (federal test).

## Part C: CANNOT VERIFY

| State | Year | Key | Reason |
|---|---|---|---|
| MO | 2026 | penalty.rate (Jan 1-Apr 15, 2027 leg) | §32.065 rate for calendar 2027 is set by Oct 22, 2026; not published on 2026-10-12 |
| AR | 2025, 2026 | farmer.rule.current_pct 0.9 | No Arkansas document states a farmer-specific percentage; 0.9 is the correct inference from the general "not less than 90%" rule |
| AR | 2026 | credit_for_other_state, nonresident_method | 2026 AR1000F/AR1000NR instructions and 2026 AR2210 not published; 2025 confirms both, Act 1 of 2026 changes rates only |
| CA, NY, VA, MA, PA, NJ, RI, CO, ME, OR, VT, MT, AZ, NM, MI(published) | 2026 | penalty.rate for Jan 1-Apr 15 (May 1 VA), 2027 | Calendar-2027 rates not yet set (MI's 7.77% is the exception) |
| CA, NY, MI, VA, AR, NM, CO, RI | 2026 | all penalty-form-dependent rows | FTB 5805 (2026), IT-2105.9-I (2026), MI-2210 TY2026, 760C 2026, AR2210 2026, PIT-ES 2026 (404), DR 0104CR/PN 2026 not published; 2026 rows rest on statute + 2025 forms + the 2026 ES instructions |
| PA, MI, CO, GA, NM, OK (partial), ME, NJ | 2026 (2027 dates) | holidays | 2027 lists not issued (Governor/circular-based) |
| IL | 2025 | installments.due_dates | 2025 IL-1040-ES no longer posted; pattern confirmed from the 2026 form and IL-2210 |
| ID | 2025, 2026 | penalty.rate 0.06 | No individual estimate penalty exists; 0.06 is the interest rate — mapping is a design choice, not a verifiable fact |
| MA, CO, HI, ME, NY, MI, NM, RI, AZ | 2025 | farmer.rule.file_by roll (Mar 1 -> Mar 2, 2026) | Forms print "March 1, 2026"; the roll is inferred from each state's general weekend rule |
| Arkansas Code text | — | all AR rows | Every public mirror of Ark. Code §§26-51-911 ff. and §1-5-101 is blocked (403/404/JS-wall); DFA forms, Reg 1997-4 and OPM Policy 52 were used as the agency's primary documents |

## Part A: Missouri and Arkansas (all 13 keys x 2 years)

Primary documents read as text during this review (downloaded 2026-10-11/12, `pdftotext`, or revisor.mo.gov HTML):

| Doc | Used for |
|---|---|
| RSMo §§143.521, 143.531, 143.541, 143.761, 143.851, 143.081, 143.041, 32.065, 9.010 (revisor.mo.gov OneSection) | MO statute text |
| Form MO-1040ES 2025 (Rev. 12-2024) and 2026 (Rev. 12-2025), dor.mo.gov/forms | MO threshold, dates, 90/100, farmer, nonresident |
| Form MO-2210 2025 and 2024, dor.mo.gov/forms | MO penalty lines 1-6, 21-24, 28a/28b, Instr. D and J |
| MO-1040 Instructions 2025, Line 55 | MO penalty trigger text |
| 12 CSR 10-41.010 emergency amendment (dor.mo.gov proposed-rules) | MO annual rate table (2025 = 8%, 2026 = 7%) |
| AR1000ES 2025 (Instr. R 7/5/2024, worksheet R 10/29/2024) and 2026 (Instr. R 10/14/2025, worksheet R 10/17/2025) | AR threshold, dates, 90/lesser-of, 10%, farmer, rate schedule |
| AR2210 2025 (R 6/6/2025) and AR2210 Instructions (R 7/5/2024 / 6/27/2025) | AR required annual payment, $1,000 stop line, penalty formula, exceptions |
| AR1000F/AR1000NR Instructions 2025 (lines 36, 38A-38D, 52A/B) | AR credit, nonresident ratio |
| DFA Regulation 1997-4 §1.26-18-208(6) | AR penalty floor and daily factor |
| DFA Subject 105 (rev. 2/24/2023) | AR summary |
| Act 1 of 2026, First Extraordinary Session (HB1001, approved 5/6/26), arkleg FTP | AR 2026 rates |
| Arkansas OPM Policy 52 "Holidays and Birthday Leave" (eff. 5/22/2025, authority Ark. Code §§1-5-101-104); UAMS 2025/2026 holiday schedules | AR holidays |

Not readable: the Arkansas Code itself (§§26-51-911 ff., §1-5-101) — every mirror (justia, findlaw, casetext, lawserver, public.law, onecle) is blocked or gone. The DFA forms, regulation and OPM policy are agency primary documents and were relied on instead.

### Missouri

| Key | 2025 stored | 2026 stored | Verdict | Source |
|---|---|---|---|---|
| has_income_tax | true | true | CONFIRMED | RSMo §143.011, §143.041; MO-1040ES rate charts (top 4.7% over $9,191 / $9,436) |
| required_threshold | 100 | 100 | CONFIRMED as the *declaration* threshold. **But MO's penalty floor is $500, not $100** (see Critical finding C1) | §143.521.1 "at least one hundred dollars" (director may raise, never below $100); §143.521.3 (net of credits incl. withholding); MO-1040ES Gen. Instr. 1-2 "$100.00 or more"; MO-2210 2025 and 2024 Part I line 4: "Subtract Line 3 [withholding] from Line 1 [tax after credits]. If less than $500, stop here; do not complete or file this form. You do not owe the penalty." |
| safe_harbor.current_pct | 0.9 | 0.9 | CONFIRMED | §143.761.2(1); MO-2210 line 2; MO-1040ES Instr. 8(b); MO-1040 Instr. Line 55 |
| safe_harbor.prior_pct | 1.0 | 1.0 | CONFIRMED | §143.761.4(1); MO-2210 line 5 / Exception 1 (25/50/75/100% of 2024 tax); MO-1040ES Instr. 8(a) |
| safe_harbor.high_agi_rule | null | null | CONFIRMED (no AGI test anywhere in §143.761.4 or the forms) | §143.761.4(1); MO-2210 line 21 |
| installments.due_dates | 04-15, 06-16, 09-15, 2026-01-15 | 2026-04-15, 06-15, 09-15, 2027-01-15 | CONFIRMED | §143.541.1(1); §143.851 (Sat/Sun/legal holiday -> next business day, applies to payments); MO-1040ES Instr. 4-5 both years; MO-2210 2025 columns. June 15, 2025 is a Sunday -> June 16 (MO-2210 prints "June 15, 2025" as the column header; §143.851 makes June 16 timely). 2026 dates are Wed/Mon/Tue/Fri. |
| installments.pcts | 25% x4 | 25% x4 | CONFIRMED | §143.541.1(1) "four equal installments"; MO-1040ES Instr. 4 |
| farmer.rule | 2/3, 66 2/3%, 2026-01-15, 2026-03-02 | 2/3, 66 2/3%, 2027-01-15, 2027-03-01 | CONFIRMED | §143.531.2 (two-thirds of total estimated *Missouri* gross income; declaration by Jan 15); §143.761.2(1) and .4(2) (66 2/3%); §143.521.6 (return filed and paid "on or before March first" counts as the declaration); MO-2210 2025 Instr. J ("paid tax on or before March 1, 2026 ... exempt") — the form prints the Sunday date; §143.851 rolls it to Mon Mar 2, 2026. Jan 15, 2027 Fri / Mar 1, 2027 Mon need no roll. |
| penalty.rate_source | state | state | CONFIRMED | §143.761.1 ("at the rate determined by section 32.065"); §32.065 (prime-rate based, set by Oct 22) |
| penalty.rate | 0.08 | 0.07 | CONFIRMED for days in calendar 2025 (8%) and calendar 2026 (7%). **The rate changes every Jan 1 and a TY2025 underpayment accrues at 7% from 1/1/2026 to 4/15/2026** (Critical C2). Calendar-2027 rate (days 1/1-4/15/2027 of a TY2026 underpayment): CANNOT VERIFY — §32.065.2 sets it by Oct 22, 2026; not published on 2026-10-12. | 12 CSR 10-41.010(1) table: 2024 = 9%, 2025 = 8%, 2026 = 7%; MO-2210 2025 lines 28a (8%, 2025 days) / 28b (7%, 2026 days); MO-2210 2024 lines 28a (9%) / 28b (8%) show the same two-rate pattern every year |
| credit_for_other_state | true | true | CONFIRMED | §143.081.1-.2 (resident credit for income tax of another state/DC, ratio-limited); MO-1040ES worksheet line 11 |
| nonresident_method | ratio | ratio | CONFIRMED | §143.041.1 (tax = resident-basis tax x MO-source AGI / all-source AGI); MO-1040ES Instr. 5 ("$360 = 90% of $400" example) |
| holidays | 2025+2026 list | 2026+2027 list | CONFIRMED — every date recomputed from §9.010 (Jan 1; 3rd Mon Jan; Feb 12; 3rd Mon Feb; May 8; last Mon May; Jun 19; Jul 4; 1st Mon Sep; 2nd Mon Oct; Nov 11; 4th Thu Nov; Dec 25; Sunday -> following Monday; no Saturday rule, so Jul 4 2026 / May 8, Jun 19, Dec 25 2027 stay on Saturday; Jul 4 2027 Sun -> Jul 5) | RSMo §9.010 (eff. 8/28/2022) |

MO extras the keys cannot hold (all confirmed in text): §143.761.4(4) Exception 2 (prior-year facts at current-year rates); Exceptions 3-4 (annualized / actual-period 90%, not for Q4); §143.521.6 Jan 31 file-and-pay relief (Jan 31, 2026 is a Saturday -> Feb 2, 2026 under §143.851); §143.761.3 period ends 15th day of 4th month (Apr 15) or payment; §143.761.5 withholding deemed paid 1/4 per installment unless actual dates shown.

### Arkansas

| Key | 2025 stored | 2026 stored | Verdict | Source |
|---|---|---|---|---|
| has_income_tax | true | true | CONFIRMED. **Act 1 of 2026 (1st Ex. Sess., HB1001, approved 5/6/26) is real and verified from the arkleg text**: §1 rewrites Ark. Code §26-51-201(a)(4) for tax years beginning on/after 1/1/2026 — table to $94,700: 0% to $5,599, 2% $5,600-11,199, 3% $11,200-15,999, 3.4% $16,000-26,399, **3.7% $26,400-94,700**; over $94,700: 2% on first $4,700, 3.7% above, with a $290->$10 bracket adjustment from $94,701-97,600. 2025 top rate 3.9% (AR1000ES 2025 schedule). The 2026 AR1000ES worksheet (R 10/17/2025) still prints 3.9% because it predates the Act. | Act 1 of 2026 §1; AR1000ES 2025/2026 rate schedules |
| required_threshold | 1000 | 1000 | CONFIRMED (value). **Comparator is "more than $1,000" for the penalty**: AR2210 2025 line 4 "If the result [net tax − withholding] is $1,000 or less, stop here"; Reg 1997-4 §1.26-18-208(6) "shall not be imposed if the tax liability ... is one thousand dollars ... or less"; AR1000ES "Who must file": "more than one thousand dollars ($1,000)". Only the worksheet line 8 note and AR2210 Instr. 1(a) say "$1,000 or more". The key's "at least" semantics would assess a penalty at exactly $1,000.00 (Minor, boundary only). | as listed |
| safe_harbor.current_pct | 0.9 | 0.9 | CONFIRMED | AR2210 line 2 (90% of 2025 net tax); AR1000ES 2025/2026 "Underestimate of Tax"; Reg §1.26-18-208(6) |
| safe_harbor.prior_pct | 1.0 | 1.0 | CONFIRMED | AR2210 lines 5-6 (smaller of 90% current or 100% of 2024 net tax); AR1000ES ("lesser of the current year's tax liability or the previous year's tax liability"); Reg (100% of preceding year if 12 months) |
| safe_harbor.high_agi_rule | null | null | CONFIRMED | AR2210 lines 5-6 have no AGI test; Reg §1.26-18-208(6) |
| installments.due_dates | 04-15, 06-16, 09-15, 2026-01-15 | 2026-04-15, 06-15, 09-15, 2027-01-15 | CONFIRMED | AR2210 2025 Part III columns 4-15-2025 / 6-15-2025 / 9-15-2025 / 1-15-2026; vouchers print 06/15/2025; AR1000ES "Important Notice" (Sat/Sun/legal holiday -> next succeeding business day) rolls Sun Jun 15, 2025 to Jun 16. 2026 worksheet: April 15, June 15, September 15, 2026, January 15, 2027 (Wed/Mon/Tue/Fri). |
| installments.pcts | 25% x4 | 25% x4 | CONFIRMED | AR2210 line 7 (1/4 of line 6 per column); AR1000ES worksheet ("one-fourth (1/4) of line 8 ... four (4) installments") |
| farmer.rule | 2/3, 0.9, 2026-02-17, 2026-03-16 | 2/3, 0.9, 2027-02-16, 2027-03-15 | ratio + dates CONFIRMED; current_pct 0.9 CANNOT VERIFY as a farmer-specific figure (no AR document states one; the general "not less than 90%" rule is the only percentage, so 0.9 is the right inference). Dates: Feb 15, 2026 Sun -> Feb 16 = Washington/Bates holiday -> Tue Feb 17; Mar 15, 2026 Sun -> Mar 16. Feb 15, 2027 = 3rd Monday Feb (holiday) -> Feb 16; Mar 15, 2027 Mon. | AR1000ES 2025/2026 "Exception" (2/3 of total gross income; pay by 15th day of 2nd month after year end, or file and pay in full by 15th day of 3rd month); AR2210 Instr. exception 1; OPM Policy 52 |
| penalty.rate_source | state | state | CONFIRMED | AR1000ES "ten percent (10%) per annum"; AR2210 line 16 "x .10"; Reg daily factor .00027397 (= 10%/365) |
| penalty.rate | 0.10 | 0.10 | CONFIRMED (fixed, not indexed) | AR2210 2025 line 16; AR2210 Instr. 2(b) and example; AR1000ES 2026 |
| credit_for_other_state | true | true | 2025 CONFIRMED; 2026 CANNOT VERIFY (2026 AR1000F/NR instructions not published; Act 1 changes only rates) | AR1000F/NR Instr. 2025 line 36: AR1000TC includes "Other State Tax Credit" |
| nonresident_method | ratio | ratio | 2025 CONFIRMED; 2026 CANNOT VERIFY (same reason) | AR1000NR lines 38A-38D: AR AGI / total AGI (6 decimals) x net tax on all income = "Arkansas apportioned tax liability" |
| holidays | 2025+2026 list | 2026+2027 list | **CONFIRMED — upgrade from `unverified`**. OPM Policy 52 (authority Ark. Code §§1-5-101-104) lists exactly: Jan 1; 3rd Mon Jan; 3rd Mon Feb (Washington/Daisy Gatson Bates); last Mon May; Jul 4; 1st Mon Sep; Nov 11; 4th Thu Nov; Dec 24; Dec 25; plus the employee's birthday; "Holidays which occur on a Saturday will be observed on the preceding Friday ... Sunday ... the following Monday." Juneteenth and the day after Thanksgiving are NOT state holidays (UAMS: day after Thanksgiving only if declared by the Governor). The seeded 2025, 2026 and 2027 dates all match (Jul 3, 2026; Jul 5, 2027; Dec 24, 2027 covers both Christmas Eve and the Saturday Christmas). | OPM Policy 52 (sas.arkansas.gov); UAMS HR holiday schedule 2025/2026 |

AR extras the keys cannot hold (confirmed in text): AR2210 Instr. exceptions 2 (file and pay by Jan 31 in lieu of Q4), 3 (no prior-year liability + 12-month year + full-year resident -> no penalty), 5 (retired after 62 / disabled, reasonable cause), 6 (annualized AR2210A); Reg §1.26-18-208(6) ends the penalty period at the earliest of payment, **return filing**, or return due date; AR2210 line 8 deems withholding paid 1/4 per quarter; extension payments are not estimates.

## Part B2: 21-state sample — confirmed rows (summary)

All rows not listed in Part B or Part C are CONFIRMED from primary sources. Highlights that settle open questions from the opus audits:

- **UT**: the "no quarterly individual regime" claim is correct (TC-40 Instr. p.4 verbatim; Utah Code 59-10-516(2)(b) lesser-of 90%/100% prepayment by the return due date; 59-1-401(5) 2% per month, Pub 58: ".24 x days/365 ... maximum of six months, or 12 percent", stops at filing). Seed values (threshold 0, [Apr 15], [1.0], rate 0.24) are a faithful mapping, but the 12% cap and the "stops when filed" rule are not representable.
- **ID**: also no individual regime (M1/M2 above) — the seed kept four quarterly dates and 80%/100% as `unverified`; they should become one Apr 15 date.
- **AZ**: requirement is the two-year gross-income gate (A.R.S. 43-581(A): > $75,000 / $150,000 MFJ in *both* the prior and current year); $1,000 is only the no-penalty exception (43-581(E)(2)); penalty is interest-equivalent capped at 10% of the underpayment (42-1125(Q)); quarterly rate 7% (2025), 7/6/7/7% (2026).
- **GA**: no dollar minimum confirmed (48-7-120; 500 UET); requirement is gross income > exemptions + deductions + $1,000 non-withheld income; 70%/100%; 9% per annum is the statutory penalty rate (48-7-120(a)), not the 48-2-40 interest rate (10.5%/9.75%).
- **OK/OR/MT/VT farmers**: genuinely exempt (68 O.S. 2385.7(B) farming, 1-year lookback; ORS 316.573(1) farming/fishing incl. oyster, lookback; MCA 15-30-2512(1)(a),(6) farming/ranching, no lookback; 32 V.S.A. 5852(a) farming/fishing per IRC). OK 20% is a true fixed annual rate (HB 2730 not enacted). OR 9%/8%, MT 8%/7%, VT 8.5%/7.75% are calendar-year rates. VT adds a separate 1%/month penalty (IN-152 line 13) the keys omit.
- **PA**: $338/$430 are correct derived figures, but 72 P.S. §7325(a) tests *non-withheld income* > $11,000 (2025) / $14,000 (2026) / $17,000 (2027) / $20,000 (2028); 90% is per installment period; prior-year harbor = prior-year taxable income x current rate; 7% for 2025-2026 (REV-1611, 0.000192/day).
- **NJ**: 80%/100%, "more than $400", farmers single Jan 15 payment with no Mar 1 alternative (Feb 15 file-and-pay waives Q4 for everyone); 10.75% (2025) / 10% (2026), changes Jan 1 (NJ-2210 schedule).
- **RI**: $250 or more (44-30-55), 80% *per installment* (44-30-84(b)), 12% both years (44-1-7 floor; ADV 2025-23), farmers incl. fishermen.
- **NM**: $1,000 nets *withholding only* (7-2-12.2(H)(1)); penalty = federal quarterly rate (7% 1/1/25-3/31/26, 6% Q2 2026, 7% Q3-Q4 2026) with the rule that the Q1-after-year rate applies through Apr 15.
- **CO**: 70%/100%/110% over $150k ($75k MFS); farmer 50% / Jan 15 / Mar 1, farmer ignores the 110% rule; 12% (2025) / 11% (2026) calendar-year; Jan 31 Q4 waiver (605(9)).
- **HI**: 60% farmer and general; Apr 20 / Jun 20 / Sep 20 / Jan 20 with weekend rolls correct; nonresident `other` (sourced income with prorated deductions).
- **ME**: two-part threshold (current *and* prior year >= $1,000); .8333%/month 2025, .75%/month 2026 compounded monthly per month-or-fraction (2210ME) — 0.10/0.09 are the right nominal rates but the method differs.
- **CA**: 30/40/0/30 confirmed; $1M/$500k current-year AGI rule removes the prior-year harbor; farmer file_by printed as "March 2, 2026".
- **NY/MI/VA**: 110% over $150k ($75k MFS) NY/MI; VA none. VA first installment May 1 and penalty period ends May 1 (§58.1-15(B) carries the Q1 rate to May 1). VA nonresident `other` (prorates income, then tax table).

## Part D: Design review — can an engine reading only the 13 keys produce correct vouchers and penalties?

Short answer: **for the federal-pattern states (MO, AR, NY, OK, OR, MT, VT, NJ, RI, GA, CO, PA on vouchers) yes for the voucher schedule; no for penalties in any state whose rate changes within the penalty period (almost all of them); and no for vouchers in UT, ID, IL (farmers), MA (farmers), AZ, PA, ME (threshold basis).** The documented special cases (OPEN-QUESTIONS Q25/Q26, PROGRESS "State rules the engine must special-case") are accurate as far as they go but are a prose list the engine cannot read; each needs a key or flag. Ranked by impact on correctness:

**D1 — `penalty.min_balance_due` (money, nullable).** The federal pattern conflates "estimates required" with "no penalty below" because both are $1,000. States split them: **MO $100 declaration vs $500 penalty floor (Critical C1)**; OK $500 requirement vs §2385.13(C) no interest if tax on the return < $1,000; AZ income-gate requirement vs $1,000 no-penalty; NJ/RI/MA/CO ">" boundaries. Without it the engine assesses false penalties in MO ($100-$499), OK ($500-$999) and AZ (anyone under the gross-income gate).

**D2 — `required_threshold.op` ('gt' | 'gte') and `required_threshold.basis`.** "At least" is right for MO, NY, CA, OK, OR, HI, ME, RI; **"more than" for AR, IL, MI, VA, NJ, MA, CO**. Basis differs: default = tax after withholding and credits; NM nets withholding only; **PA = non-withheld income > $11,000/$14,000**; **AZ = AZ gross income > $75k/$150k in both years AND $1,000 tax**; **GA = gross income > exemptions + deductions + $1,000 non-wage income**; **ME = current AND prior-year liability >= $1,000**. An engine following `required_threshold` literally demands vouchers from AZ taxpayers under the gate and GA taxpayers owing $50 (threshold 0), and skips PA taxpayers with large credits who are nonetheless required.

**D3 — `penalty.rate_schedule` [{from, to, rate}] + `penalty.method` + `penalty.addon`.** The single annual `penalty.rate` is wrong for the Jan 1-Apr 15 tail in every state whose rate resets on Jan 1 (**MO C2**, OR, MT, VT, CO, NJ, PA, NY, VA, MA, CA, MI, AZ, NM) and cannot express: semiannual (CA, MI) or quarterly (NY, VA, AZ, NM, MA) rates; **IL's tiered flat 2%/10% late-payment penalty** (rate stored null — the engine must compute *nothing*, not fall back to federal); **HI 2/3% per month-or-fraction**; **ME .8333%/.75% per month compounded**; **UT 2%/month capped at 12% and stopping at filing** (ID similar); add-ons **MI +10% (min $10)** and **VT +1%/month**; RI 80%-per-installment base; `federal` source (NM, AL, SC) needs the federal quarterly table plus NM's "Q1 rate through Apr 15" and VA's "through May 1" carry rules. Proposed: `penalty.method` enum {daily_simple, monthly_or_fraction, monthly_compound, tiered_flat, extension_capped, none}, `penalty.rate_schedule`, `penalty.cap_pct`, `penalty.addon` {pct, min, per_month}.

**D4 — `estimates.regime` ('quarterly' | 'none' | 'prepay_only').** UT and ID have no individual estimate regime. The seeds encode UT as one 100% installment on Apr 15 (and ID, wrongly, as four) — an engine would print an "estimated tax voucher" for a return payment and compute a 24% "penalty" without the 12%/six-month cap or the stop-at-filing rule. Mark both `regime: none`, present the Apr 15 item as "prepayment to protect the extension" with its own cap rule, never as an installment penalty.

**D5 — `farmer.treatment` enum + `farmer.lookback_prior_year` + `farmer.includes_fishermen`.** `farmer.rule = null` currently means three different things: *no farmer rule* (UT, ID), *exempt* (MT, VT, **IL** — IL is not in PROGRESS's special-case list), while OK/OR encode *exempt* as `current_pct: 0` with placeholder Apr 15 dates. An engine applying the federal pattern to the nulls schedules four vouchers and a penalty for exempt IL/MT/VT farmers; an engine using the firm's `prior_year` override on OK/OR computes 100%-of-prior-year installments (false penalty). MA farmers pay **four** installments at 66 2/3% with a Mar 1 file-and-pay waiver (seed's `due_date = Mar 1` would print one voucher). Percentages vary (CO 50%, HI 60%, MO/CA/NY/MI/VA/GA/RI/ME/NJ 66 2/3%, NM 66 2/3% (M4), AR/PA/AZ 90%). Lookback on prior-year income: OK (1 year), OR, NM yes; MT no; VT per IRC. Proposed enum {federal_pattern, exempt, none, quarterly_reduced}.

**D6 — `return_due_date` and `installments.q4_file_and_pay_date`.** The penalty period ends at the state return due date (VA **May 1**, HI **Apr 20**, others Apr 15; AR also at return *filing*), and every sampled state waives the Q4 installment if the return is filed and paid by a date (MO/AR/OK/MT/CO/ME/GA/NM Jan 31; **AZ Feb 1**; **NJ Feb 15**; MA/HI Mar 1 for farmers). MODULE.md gives the federal `return_due_date` and `installments.q4_file_and_pay_date` keys; the state registry has neither, so a VA penalty would stop 16 days early and an early filer in any state would see a false Q4 penalty.

**D7 — high-AGI variants.** `high_agi_rule.threshold_mfs` ($75,000 in CA, NY, MI, CO and the other 110% states) and **CA's `prior_year_harbor_disallowed_above_agi` {1,000,000 / 500,000 MFS}** — without the latter the engine offers a 110% prior-year harbor to a CA taxpayer over $1M and under-vouchers them.

**D8 — holidays and rolled dates.** Because the seeds store already-rolled due dates, `holidays` is load-bearing only for "create year from prior year". Seven of the 23 sampled lists are wrong (m3-m9) and the farmer `file_by` roll convention is inconsistent (m10). Recommend storing statutory dates and rolling in the engine with each state's rule (Sat -> Fri in AR/VA/AZ/OK/ME/IL/NM/CO/HI/UT/ID; Sat stays in MO/MA/RI/CA(state)/NY; Sun -> Mon everywhere) — which makes fixing the holiday lists a prerequisite.

**D9 — informational keys.** `nonresident_method` conflates three mechanics: ratio of full-return tax (MO, AR, NY, NJ, RI, OR, MT, VT, OK, CO, ME, UT, CA), tax on sourced taxable income with prorated deductions (IL, MI, PA, AZ, ID, **GA (M6)**, HI, MA), and VA's prorated-income method. Fine as a label if the enum is documented; not fine if the engine ever branches on it. `credit_for_other_state = true` is residents-only in every sampled state (OK: compensation income only).

**Not expressible and acceptable as assumptions-page notes:** MO/VT/VA/NJ "prior-year income at current-year rates" exception; annualized-income exceptions (all states); zero-prior-year-liability exceptions (AR full-year resident, OK, MT, OR, RI, NM, IL); retired-62/disabled and casualty waivers; NM first-year-resident exemption; PA 100% Tax Forgiveness exemption; MA 4% surtax, NY NYC/Yonkers, CA 1% MHS in the "tax" base (covered by the effective-rate input).

### States where an engine following the keys literally produces a materially wrong result today

| State | Wrong voucher schedule | False or wrong penalty | Fix |
|---|---|---|---|
| **MO** | — | false penalty on $100-$499 balances (C1); 8% applied to 2026 days (C2) | D1, D3 |
| **AR** | — | penalty at exactly $1,000.00 only | D2 |
| ID | four vouchers instead of none | penalty that does not exist | M1/M2 + D4 |
| UT | Apr 15 "estimate" voucher | uncapped 24%, no stop-at-filing | D4, D3 |
| IL | four vouchers for exempt farmers; vouchers at exactly $1,000 | penalty on exempt farmers; any computed rate (should be tiered flat) | M7, D5, D2, D3 |
| MT, VT | four vouchers for exempt farmers if null = "no rule" | penalty on exempt farmers; VT missing +1%/month | D5, D3 |
| OK, OR | prior-year-rule override yields installments for exempt farmers | OK false penalty on $500-$999 (tax < $1,000) | D5, D1 |
| AZ | vouchers for everyone over $1,000 (gross-income gate missing); farmer 66 2/3% understates | penalty on taxpayers under the gate; no 10% cap; Q2-2026 6% | M3, D2, D3 |
| GA | vouchers for any tax amount (income test missing) | — | D2 |
| PA | required-ness by tax not income; prior-year base | — | D2 |
| MA | one farmer voucher instead of four at 66 2/3% | Q2 2026 7% | M14, D5, D3 |
| NM | farmer 90% over-vouchers | federal quarterly rate + Apr 15 carry rule | M4, D3 |
| CA | 110% harbor offered above $1M AGI | 8% Q2 2025 | D7, D3 |
| MI | — | semiannual rates; +10% add-on | M9, D3 |
| HI | — | monthly-or-fraction method | M13, D3 |
| ME | prior-year < $1,000 waiver missing | monthly compounding | D2, D3 |
| NY, VA, CO, NJ, RI, OR, MT, VT, PA | — | Jan 1 / quarterly rate changes; VA period ends May 1 | D3, D6 |

### Recommended actions before Phase 6 engine work
1. Seed edits: M1-M7, M14 values; m2 status upgrade; holiday lists m3-m9; citations m3/m11.
2. Registry additions (shared `stateRuleKeys.ts`, additive): `penalty.min_balance_due`, `required_threshold.op`, `required_threshold.basis`, `penalty.rate_schedule`, `penalty.method`, `penalty.addon`, `estimates.regime`, `farmer.treatment`, `return_due_date`, `installments.q4_file_and_pay_date`, `high_agi_rule.threshold_mfs`, `safe_harbor.prior_year_disallowed_above_agi`. Seed MO/AR first (MO: min_balance_due 500, rate_schedule 2025 8% / 2026 7%, return_due_date Apr 15, q4 date Jan 31 -> Feb 2, 2026; AR: op 'gt', method daily_simple 10%, period end = min(payment, filing, Apr 15), q4 date Jan 31).
3. Mark every 2026 `penalty.rate` row `provisional` until the 2027 calendar-year rate is published (MO: Oct 22, 2026).
4. Re-run the opus audit script's completeness test after the registry change; re-verify the 2026 penalty forms (FTB 5805, IT-2105.9-I, MI-2210, 760C, AR2210, M-2210) when published.

## Source index (reviewer's own reads; subagent URLs are listed in their sections' citations above where load-bearing)
MO: revisor.mo.gov OneSection 143.521, 143.531, 143.541, 143.761, 143.851, 143.081, 143.041, 32.065, 9.010; dor.mo.gov/forms/MO-1040ES_2025.pdf, MO-1040ES_2026.pdf, MO-2210_2025.pdf, MO-2210_2024.pdf, "MO-1040 Instructions_2025.pdf"; dor.mo.gov/resources/proposed-rules/documents/ER_-12_CSR_10-41_010_Emergency_Amendment.pdf.
AR: dfa.arkansas.gov/wp-content/uploads/2025_Final_AR1000ES.pdf, 2026_Final_AR1000ES.pdf, 2025_AR2210_Penalty_for_Underpayment_of_EstimatedTax_1.pdf, 2025_AR2210_Instructions.pdf, 2025_AR1000F_and_AR1000NR_Instructions.pdf, 105-EstimatedTax.pdf, it1997_4.pdf (Reg 1997-4); arkleg.state.ar.us Acts/2026S1/Public/1.pdf; sas.arkansas.gov/wp-content/uploads/52-Holidays-and-Birthday-Leave-5.23.2025.pdf; hr.uams.edu/benefits/holiday-schedule/.
Other states: see the per-state source lists in the five subagent reports summarized in Parts B/B2 (FTB, tax.ny.gov, tax.illinois.gov, michigan.gov/taxes, tax.virginia.gov, tax.utah.gov/le.utah.gov, tax.idaho.gov/legislature.idaho.gov, azdor.gov/azleg.gov, dor.georgia.gov, oklahoma.gov/tax + oklegislature.gov, oregon.gov/dor + oregonlegislature.gov, revenue.mt.gov + archive.legmt.gov, tax.vermont.gov + legislature.vermont.gov, pa.gov/revenue + palegis.us, nj.gov/treasury/taxation, tax.ri.gov + webserver.rilegislature.gov, tax.newmexico.gov + nmlegis.gov + spo.state.nm.us, mass.gov/dor + malegislature.gov, tax.colorado.gov + colorado.public.law + dhr.colorado.gov, files.hawaii.gov/tax + capitol.hawaii.gov + dhrd.hawaii.gov, maine.gov/revenue + legislature.maine.gov + maine.gov/bhr).

## Key-set decisions (applied 2026-10-12)

Seven keys were added to the shared registry (`packages/shared/src/tax-estimator/stateRuleKeys.ts`, now 20 keys). All are in `requiredStateRuleKeys(true)`: every taxed state/year carries a value or an explicit null with a citation saying no separate rule was found or researched (status `unverified` unless confirmed). Two new value types: `date` (one strict YYYY-MM-DD) and `rate_schedule` (non-empty `[{ from, to, rate }]`, inclusive calendar dates, in order, no overlap). Existing `high_agi_rule` and `farmer_rule` values gained optional fields; every existing value stays valid. Federal tables are untouched.

| Part D gap | Representation | Why this one |
|---|---|---|
| D1 penalty floor (C1) | new `penalty.min_balance_due` (money, nullable; null = `required_threshold`) | MO $100 vs $500, OK $500 vs $1,000 and AZ's $1,000 floor are different facts from the declaration threshold; null keeps the 40+ states where they coincide unchanged |
| D2 boundary | new `threshold_comparison` (`at_least` \| `more_than`, nullable; null = at_least), applied to both `required_threshold` and `penalty.min_balance_due` | one enum covers AR/IL/MI/VA/NJ/MA/CO; in every sampled state the requirement and the penalty floor use the same wording |
| D2 basis (income tests) | **not modeled** — documented in OPEN-QUESTIONS Q26 | AZ/GA/PA/ME/NM tests need income inputs the rule store cannot evaluate; a basis enum without the formula would be a label the engine cannot act on |
| D3 dated rates (C2) | new `penalty.rate_schedule` (nullable; null = single `penalty.rate`); helper `statePenaltyRateOn(rules, date)` | supersedes `penalty.rate` per covered day; an uncovered day (unpublished next-year rate) falls back to `penalty.rate` with `covered: false` so the engine can flag it |
| D3 accrual method | new `penalty.method` (`daily_simple` \| `monthly_or_fraction` \| `monthly_compound` \| `tiered_flat`, nullable; null = daily_simple) | HI (M13), ME and IL cannot be expressed as a rate over days; the nominal `penalty.rate` stays the annual equivalent |
| D3 add-ons and caps | **not modeled** — Q26 | MI +10%, VT +1%/month, AZ 10% cap, UT 12% cap are few and heterogeneous; assumptions-page notes until the engine phase decides |
| D4 regime (M1/M2) | new `estimates_required` (bool, required) | the review's three-way `regime` collapses to a bool: UT's prepayment test is already described by threshold 0 / one 100% item; the engine view withholds the installment keys when false |
| D5 farmer treatment (M7, M14) | optional `treatment` inside `farmer.rule` (`single_installment` default \| `quarterly` \| `exempt`) | keeps one key; null keeps meaning "no farmer rule"; OK/OR's existing `current_pct: 0` is documented as equivalent to exempt and left unchanged |
| D5 lookback / fishermen | **documented in citations**, not keys | informational for the two-thirds test; no engine branch depends on it yet |
| D6 period end / Jan 31 relief | new `return_due_date` and `installments.q4_file_and_pay_date` (date, nullable) | mirror the federal parameter names; null = Apr 15 / no relief |
| D7 high-AGI variants | optional `threshold_mfs`, `no_prior_year_agi`, `no_prior_year_agi_mfs` inside `safe_harbor.high_agi_rule` | same rule family; CA seeded and verified; other states' MFS values left for re-research |
| D8 holiday lists / roll convention | value fixes (m3-m9); stored due dates stay pre-rolled | the roll convention change (m10) is an engine-phase decision |
| D9 nonresident label | GA corrected to `sourced_flat` (M6); enum kept informational | no engine branch reads it |

Wiring: DTO `StateRulesEngineView` (shared `state-rules-api.ts`) adds `estimatesRequired`; `resolveStateRulesForEngine` omits `installments.*` when false; `createYearFromPrior` rolls the two date keys to business days and shifts schedule legs one year (all provisional); the admin editor has a typed line editor for rate schedules ("from to rate" per line) and a date editor. The Zod override schema still takes `value: unknown` and the service validates per key with `validateStateRuleValue`, so no schema change was needed.

## Fix status (2026-10-12)

Verified = the fact was read in a primary source during the fix task (sources in each row's citation); unverified = taken from this review without a re-read (agency page blocked or not reached).

| # | Status | What changed |
|---|---|---|
| C1 MO penalty floor | **fixed, verified** | `penalty.min_balance_due = 500` both years (MO-2210 2025 Part I line 4 read); `required_threshold` stays 100; `threshold_comparison = at_least` |
| C2 MO dated rate | **fixed, verified** | `penalty.rate_schedule` 2025: 8% 2025 days / 7% 2026 days (12 CSR 10-41.010, MO-2210 lines 28a/28b read); 2026: 7% for 2026 only — the calendar-2027 rate is not posted until Oct 22, 2026, so those days are uncovered and flagged. MO also got `return_due_date` (Apr 15), `q4_file_and_pay_date` (Feb 2, 2026 / Feb 1, 2027: RSMo §143.521.6 + §143.851), `penalty.method daily_simple`, `estimates_required true`, all verified |
| M1/M2 ID | **fixed** | `estimates_required = false` (2025 verified from the Form 40 instructions; 2026 unverified, booklet not out); installments replaced by one neutral Apr 15 / 100% placeholder, `unverified`, withheld from the engine. `penalty.rate 0.06` left as is (`unverified`, interest rate) |
| M3 AZ farmer | **fixed** | `current_pct 0.9`; 2025 verified (Form 221 2025: one Jan 15 installment / Mar 1, 90% Line 7), 2026 unverified |
| M4 NM farmer | **fixed, verified** | `current_pct 0.6666666667` both years (NMSA 7-2-12.2(E), HB 470 (2011) enacted text read) |
| M5 MT 2025 rate | **fixed, verified** | 0.08 (revenue.mt.gov table); plus `rate_schedule` 8%/7% |
| M6 GA nonresident | **fixed** | `sourced_flat`; 2025 verified (IT-511 Schedule 3 lines 13-14), 2026 unverified |
| M7 IL farmers | **fixed** | `farmer.rule.treatment = exempt` (current_pct 0); 2026 verified (IL-1040-ES 2026), 2025 unverified (form not posted). MT and VT farmers also moved from null to `exempt`, verified from MCA 15-30-2512(1)(a) and 32 V.S.A. §5852(a) |
| M8 CA rates | **fixed, verified** | `rate_schedule` from the FTB rate page (8% Jan-Jun 2025, 7% Jul 2025-Dec 2026) |
| M9 MI rates | **fixed, verified** | semiannual `rate_schedule` from RAB 2026-10 (9.47/8.66/8.48 and 8.48/7.85/7.77). The flat 10% add-on remains inexpressible (Q26) |
| M10 NY 2026 | **fixed, unverified** | `rate_schedule` 8.5% Apr-Jun 2026, 9.5% Jul-Dec 2026 (tax.ny.gov rate pages 404 in this task). NY 2025 left on the single 9.5% because this review's 2025 note (9.5% through 4/15/26) conflicts with M10's 8.5% from 4/1/26 — needs a re-read of IT-2105.9 |
| M11 VA 2026 | **fixed, unverified** | `rate_schedule` 8% May-Jun, 9% Jul-Dec 2026; `return_due_date` May 1 (2026) / May 3 (2027, assumed weekend roll) |
| M12 MA 2026 | **fixed, unverified** | `rate_schedule` 8/7/8% by quarter (mass.gov blocked) |
| M13 HI method | **fixed** | `penalty.method monthly_or_fraction`, `return_due_date` Apr 20; 2025 verified (N-210 2025 Part IV), 2026 unverified; `penalty.rate 0.08` kept as the nominal annual equivalent |
| M14 MA farmers | **fixed, verified** | `treatment quarterly`, due_date = Jan 15 (last installment), file_by = Mar 1 waiver (c.62B §14(c),(h) read) |
| m1 AR boundary | **fixed, verified** | `threshold_comparison = more_than` (AR2210 line 4, AR1000ES "more than $1,000"); IL/MI/VA/NJ/MA/CO seeded `more_than` unverified |
| m2 AR holidays | **fixed, verified** | status raised; OPM Policy 52 read and every date recomputed |
| m3-m9 holidays | **fixed, unverified** | PA, IL, MI, NM, OK, ME, UT lists corrected per this review (rows downgraded to unverified where they were verified, since the official lists were not re-read); MI 2027 reduced to Jan 1 (list unpublished) |
| m3 PA citation, m11 HI citations | **no change needed** | the current seed text has no "Act 2022-53" or "Form N-1" reference |
| m10 farmer file_by roll convention | **not fixed** | engine-phase decision (store statutory vs rolled); dates left as stored |
| Part D D1-D9 | see "Key-set decisions" | D2 basis, D3 add-ons/caps remain inexpressible (Q26) |
| Rec. 3 (2026 `penalty.rate` provisional) | **not done** | superseded for MO/MT/MI/CA by schedules whose unpublished 2027 legs are left uncovered (flagged at run time) |

Also seeded from this review, unverified: calendar-year `rate_schedule` for OR, VT, CO, NJ; `penalty.method` ME `monthly_compound`, IL `tiered_flat`; OK `penalty.min_balance_due 1000`; AZ `penalty.min_balance_due 1000` (2025 verified from Form 221 Line 6).
