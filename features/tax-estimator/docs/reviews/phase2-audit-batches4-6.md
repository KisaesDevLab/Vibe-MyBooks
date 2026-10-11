# Phase 2 audit: batches 4 and 6 (ME MD MA MI MN MS MT NE / RI SC UT VT VA WV WI), TY2025 and TY2026

Audited on 2026-10-11 by the tax-law-researcher auditor. Every row was rechecked independently against primary sources: state revenue forms, instructions and publications, and statute text, fetched as raw text with curl and pdftotext. A row is `verified` only if its fact was read in a primary source during this audit. Any row that could not be confirmed is `unverified`, with the reason given in its citation. The researcher reports are `phase2-batch4-sources.md` and `phase2-batch6-sources.md`.

Validation: `npx tsc --noEmit -p .` (packages/api) is clean. A throwaway script asserted that each of the 30 state-years has exactly 13 keys, each present once, that every value passes `validateStateRuleValue`, that no citation is empty, and that the installment date and percentage lists have equal length.

## Status after audit

| State | 2025 verified / unverified | 2026 verified / unverified |
|---|---|---|
| ME | 13 / 0 | 13 / 0 |
| MD | 11 / 2 | 12 / 1 |
| MA | 13 / 0 | 13 / 0 |
| MI | 13 / 0 | 13 / 0 |
| MN | 13 / 0 | 13 / 0 |
| MS | 12 / 1 | 9 / 4 |
| MT | 13 / 0 | 13 / 0 |
| NE | 13 / 0 | 13 / 0 |
| RI | 13 / 0 | 10 / 3 |
| SC | 13 / 0 | 13 / 0 |
| UT | 13 / 0 | 13 / 0 |
| VT | 12 / 1 | 12 / 1 |
| VA | 13 / 0 | 12 / 1 |
| WV | 13 / 0 | 13 / 0 |
| WI | 13 / 0 | 11 / 2 |

## Findings the engine author must act on

1. **Utah has no quarterly estimated payments for individuals. The suspicion that it does is refuted.** The 2025 TC-40 instructions say so verbatim. TC-547 is only a coupon for paying the return balance. Utah Code 59-10-107 does not exist. The only requirement is Utah Code 59-10-516: by the return's original due date, prepay the lesser of 90% of current-year tax or 100% of prior-year tax, or owe the 2%-per-month extension penalty. The seed maps this as threshold 0, one 100% installment due April 15 of the following year, and penalty rate 0.24. The engine must special-case UT. A federal-pattern fallback would wrongly schedule four vouchers.
2. **In Montana (MT) and Vermont (VT), `farmer.rule = null` means the farmer is EXEMPT** (two-thirds of gross income from farming or ranching), not "use the regular schedule". This needs a special case.
3. **Some penalties are charged on top of interest, and the single `penalty.rate` key cannot hold them.** Michigan adds a penalty of 10% of the underpaid installment (25% if nothing was paid). Vermont adds 1% per month (Worksheet IN-152). Utah's 2%-per-month figure is itself an extension penalty, not interest. Maine and Maryland charge by the month, with a part month counting as a whole one.
4. **South Carolina's penalty rate source is now `federal`**, changed from `state`, with the rate set to null. S.C. Code 12-54-25(D) ties it to the federal quarterly underpayment rate.
5. **Minnesota uses one rate for the whole tax year** (Minn. Stat. 270C.40 subd. 4): 8% for TY2025 and 7% for TY2026. The researcher's warning that 2026 days of a 2025 underpayment accrue at 7% was wrong and has been removed.
6. **Maryland's 110% prior-year safe harbor is measured on prior-year tax after the credit for tax paid to other states.**
7. **Virginia's threshold rises from $150 (TY2025) to $1,000 (TY2026).** The test is "more than", not "at least". This is confirmed in the 2026 Form 760ES.
8. **Massachusetts has no January 15 farmer installment.** A farmer either pays four installments at 66 2/3% or files and pays by March 1. The seed stores `due_date = file_by = March 1`.
9. **The farmer `file_by` for Sunday March 1, 2026 is rolled to March 2 in most states**, under each state's weekend rule. Michigan and Nebraska keep March 1 as printed, because their forms give no roll for that date (see their sections). The CPA may choose otherwise.
10. **Normalization:** farmer `current_pct` in RI and SC (both years) was changed from 0.6667 to 0.6666666667, the federal seed convention, by the lead auditor. The UT/VA/WV pass made the same change for VA and WV.

## Per-state detail

Each section gives the verdict per state-year, the corrections (key | before | after | source), the rows still unverified, and the rules the key set cannot express.


## Maine (ME)

Primary sources read 2026-10-11: Form 1040ES-ME 2025 (Rev. Dec 2024) and 2026 instructions; **Form 2210ME (2025)** individual underpayment form + instructions (maine.gov/revenue .../25_form_2210_fillable.pdf); 36 M.R.S. 153, 186, 5111, 5217-A, 5228; 4 M.R.S. 1051 (legislature.maine.gov, raw HTML).

### ME 2025 — corrections
| key | before | after | source |
|---|---|---|---|
| penalty.rate | 0.10, cited to corporate Form 2220ME | 0.10 (value unchanged), cited to individual Form 2210ME (2025): ".8333% per month ... compounded monthly" for 2025, ".75%" for 2026 | Form 2210ME (2025) instructions; 36 M.R.S. 5228(5), 186 |
| farmer.rule | file_by 2026-03-01 (Sunday, stored unrolled) | file_by 2026-03-02 | 36 M.R.S. 153(2) (Saturday/Sunday/legal-holiday roll); 5228(10) |
| required_threshold | citation (value 1000) | value unchanged; citation adds 5228(2)(C)-(D) text and the 2210ME note that prior-year liability is measured before credits/withholding | 36 M.R.S. 5228(2); Form 2210ME |
| installments.due_dates, credit_for_other_state, holidays | citation | values unchanged; citations to raw text (2210ME June 16, 2025 column; 36 M.R.S. 153(2); 5217-A as replaced by PL 2025 c.650; 4 M.R.S. 1051 re-read, dates recomputed) | as cited |

Everything else: audit: pass (90% / 100% / no high-AGI; 4 x 25%; 66 2/3% farmer; state source; credit true; ratio).

### ME 2026 — corrections
| key | before | after | source |
|---|---|---|---|
| penalty.rate | 0.09, cited to Form 2220ME / INS-6 | 0.09 (unchanged), cited to Form 2210ME (2025) (".75% per month" for calendar 2026) | Form 2210ME; 36 M.R.S. 186 |
| farmer.rule | citation said "March 1, 2026 is a Sunday" (wrong year) | citation fixed: Jan 15, 2027 (Fri) / Mar 1, 2027 (Mon), no roll | 1040ES-ME 2026 item 4; 36 M.R.S. 153(2) |
| required_threshold, credit_for_other_state, nonresident_method, holidays | citation | values unchanged; raw statute citations | as cited |

All other rows: audit: pass.

### Residual unverified
None. Caution only: TY2026 penalty months in calendar 2027 use a rate not yet set.

### Rules the key set cannot express
- Two-part threshold: estimates waived if current-year net liability < $1,000 OR prior-year liability < $1,000 (prior-year liability measured before credits/withholding); the prior-year waiver and the prior-year safe harbor do not apply to "unusual event" income (non-withheld income up $500,000+ over the same period of the prior year; 90% of the tax on it is due with that quarter).
- Penalty is monthly, "per month or fraction thereof", compounded monthly, at a calendar-year rate (10% in 2025, 9% in 2026), not a daily simple rate.
- No penalty on the 4th installment if the return is filed and tax paid by January 31 (5228(9)).
- Farmer test is the IRC 6654(i)(2) gross-income test (5228(1)(B-1)); the 1040ES-ME text says "adjusted gross income".
- TY2026: 2% surcharge on high Maine taxable income (36 M.R.S. 5111(7)); affects tax, not the estimate rules.


## Maryland (MD)

Primary sources read 2026-10-11: Form 502UP (2025); 2025-PV-Worksheet (2026 estimates) and 2024 PVW; Form 505NR (2025); raw statute text from mgaleg.maryland.gov (it does return server-rendered text to curl): Tax-General 10-703, 10-815, 10-820, 10-902, 13-602, 13-604, 10-106.1; General Provisions 1-111, 1-302.

### MD 2025 — corrections
| key | before | after | source |
|---|---|---|---|
| credit_for_other_state | true, unverified (summarising fetch) | true, **verified** | TG 10-703(b)-(e) raw text |
| holidays | list unchanged, unverified | **verified** (list matches statute; dates recomputed incl. Good Friday, Nov 3 2026 election, Sunday rolls) | GP 1-111 raw text |
| farmer.rule | file_by 2026-03-01, verified | file_by 2026-03-02, **unverified** (roll not stated by MD for this date; GP 1-302(b)(1) Sunday rule supports it); current_pct 0.90 confirmed | TG 10-820(c), 10-902(c), 13-602(a)(2); Form 502UP |
| installments.due_dates | unverified | still unverified; citation adds TG 10-820(b) and notes 502UP itself prints/computes from June 15, 2025 | TG 10-820(b); 502UP; GP 1-302 |
| required_threshold, safe_harbor.current_pct/prior_pct, installments.pcts, penalty.rate_source | form citations | statute citations added (TG 10-815(a), 13-602(a)/(c), 10-902(a), 13-604); values unchanged | as cited |

penalty.rate 0.114825, nonresident ratio, high-AGI null: audit: pass.

### MD 2026 — corrections
| key | before | after | source |
|---|---|---|---|
| safe_harbor.current_pct | 0.9 unverified (carried from 2025 form) | 0.9 **verified** | TG 13-602(a)(2)(i) current law |
| farmer.rule | unverified (0.90 carried) | **verified** | TG 10-820(c), 10-902(c), 13-602(a)(2); 2026 PVW |
| credit_for_other_state | unverified | **verified** | TG 10-703 raw text |
| holidays | unverified | **verified** | GP 1-111 raw text |
| nonresident_method | unverified | still unverified; citation adds 2026 PVW nonresident rate .0225 and TG 10-106.1 | 505NR (2025), 2026 PVW |
| required_threshold, prior_pct, pcts, penalty.rate_source | citation | statute citations added; values unchanged | as cited |

### Residual unverified
- MD 2025 installments.due_dates: June 16, 2025 roll — no Maryland source states a weekend roll for estimated installments; 502UP (2025) prints and counts interest from June 15, 2025. Engine impact: at most one month of interest timing.
- MD 2025 farmer.rule: same issue for March 1, 2026 -> March 2.
- MD 2026 nonresident_method: no 2026 Form 505NR yet.

### Rules the key set cannot express
- Prior-year safe harbor is 110% for everyone, of prior-year tax **reduced by the 10-703 other-state credit** (13-602(a)(2)(ii)).
- Interest, not penalty: monthly, "treat a partial month as one month", Comptroller calendar-year rate (11.4825% annual in 2025; 10.8133% from 2026), floor 9% (13-604).
- 13-602(b): no interest where at least 90% of taxable income is also taxed by another state and only county tax is underestimated.
- Option to file the final return and pay by January 31 instead of the Jan 15 installment (10-820(b)(3)).
- Wagering income: separate declaration within 60 days (10-815(b), 10-820(d)).
- Nonresidents add the special nonresident tax (lowest county rate, 2.25%) on top of the ratio tax; county tax for residents is outside the key set.
- Credit is disallowed where the other state grants the credit (reverse-credit states).


## Massachusetts (MA)

Sources re-read 2026-10-11: Form M-2210 (2025); Form 1-ES (2026) (the "2025" 1-ES URL still serves the identical 2026 file, md5-equal, so no TY2025 1-ES exists online; TY2025 rows rest on M-2210 (2025) + statute); AP 241; TIR 26-5 (09/01/2026); G.L. c.62B ss.13-14, c.62 ss.5A and 6, c.4 ss.7 and 9 (malegislature.gov, raw text).

### MA 2025: 1 value correction + citation strengthening
| key | before | after | source |
|---|---|---|---|
| farmer.rule | `{due_date: 2026-03-01, file_by: 2026-03-01}` (Sunday, stored unrolled) | `{due_date: 2026-03-02, file_by: 2026-03-02}` | G.L. c.62B s.14(h) (March 1); G.L. c.4 s.9 (Sunday -> next business day); M-2210 (2025) weekend sentence |
Citation-only: required_threshold (c.62B s.13 / s.14(d)(i)), safe_harbor.* (c.62B s.14(c)), installments.pcts (s.14(c) "twenty-five per cent"), penalty.rate_source / penalty.rate (s.14(a) "without daily compounding"; TIR 26-5 2025 = 8%, Q1 2026 = 8%).
All other values pass (80% / 100% / no high-AGI / $400 / Jun 16 roll / 8% / credit / sourced_flat / holidays recomputed from c.4 s.7 Eighteenth: exact match).

### MA 2026: citation corrections only (values pass)
farmer.rule citation wrongly described March 1, 2026; now cites c.62B s.14(h) and March 1, 2027 (Monday). penalty.rate 0.08 re-checked against TIR 26-5 (Q1 8%, Q2 7%, Q3 8%, Q4 8%): pass.

### Residual unverified: none.

### Not expressible
- Farmers: Massachusetts has NO January 15 single installment. A qualifying farmer owes four 25% installments of 66 2/3% (c.62B s.14(c)) OR is excused entirely by filing and paying by March 1 (s.14(h)). The farmer_rule shape forces a single date; stored due_date = file_by = March 1 (rolled).
- Threshold: s.13 "more than $400" vs s.14(d)(i) "less than $400" (exactly $400 is a gap); key holds 400.
- Rate is quarterly (federal short-term + 4); single key.
- 80% current-year safe harbor (stored correctly as 0.8; engine must not assume 90%).
- Penalty is simple interest (no daily compounding) per s.14(a), unlike c.62C s.32 deficiencies.


## Michigan (MI)

Sources re-read 2026-10-11: MI-1040ES 2025 (Rev. 07-24) and 2026 (Rev. 04-25); MI-2210 (2025) form + instructions; MI-1040 2025 instruction book; Revenue Administrative Bulletin 2026-10 (approved Sept. 30, 2026); MCL 206.301, 206.110, 206.255, 205.23, 205.24, 435.101 (legislature.mi.gov, raw text).

### MI 2025: 3 corrections (status upgrades, values unchanged) + citation strengthening
| key | before | after | source |
|---|---|---|---|
| installments.due_dates | unverified (roll to Jun 16 assumed) | verified, value unchanged `[2025-04-15, 2025-06-16, 2025-09-15, 2026-01-15]` | MI-1040ES (2025) prints "June 16, 2025"; MI-2210 (2025) line-10 instructions "through June 16, 2025"; MCL 206.301(1) |
| farmer.rule | unverified (dates borrowed from 2026 form) | verified, value unchanged `{2/3, 66 2/3%, 2026-01-15, 2026-03-01}` | MCL 206.301(6) (farmer/fisherman/seafarer may follow the IRC 6654 alternative schedule); MI-1040ES (2025) 66 2/3%; MI-2210 (2025) "filed ... and paid the entire tax due by March 1, 2026" |
| nonresident_method | unverified | verified (`sourced_flat`) | MCL 206.110(2) read; Schedule NR |
Citation-only: required_threshold (MCL 206.301(1) "more than $500"), installments.pcts (206.301(1) "1/4"), penalty.rate (MCL 205.23(2) + separate-penalty note), credit_for_other_state (MCL 206.255).
Penalty rate 0.0866 re-checked against RAB 2026-10 table: pass.

### MI 2026: 2 corrections (status upgrades)
| key | before | after | source |
|---|---|---|---|
| credit_for_other_state | unverified | verified (true) | MCL 206.255(1),(3) (current law) |
| nonresident_method | unverified | verified (`sourced_flat`) | MCL 206.110(2) (current law) |
Citation-only: required_threshold, installments.pcts, penalty.rate (RAB 2026-10: 8.48% / 7.85% / 7.77%; 0.0785 stored, pass).

### Residual unverified: none.

### Not expressible
- Threshold is "more than $500" (strict) - key holds 500.
- MFS high-AGI threshold $75,000 (key carries only $150,000).
- Interest rate resets every Jan 1 / Jul 1 (three rates per tax year).
- SEPARATE PENALTY on top of interest: 10% of the underpaid installment (min $10) or 25% if no payment (min $25) (MI-2210 Part 3). Engine computing only rate x days understates Michigan's charge.
- No penalty (interest still due) if estimates were not required in the preceding year (MI-2210 general instructions).
- Farmer file_by stored as printed (Sunday March 1, 2026); no Michigan weekend-roll text for it was found, though Treasury rolled June 15, 2025 to June 16.
- Option to file the return by Feb 1 instead of the 4th voucher (MI-1040ES).


## Minnesota (MN)

Sources re-read 2026-10-11: Minn. Stat. 289A.25, 270C.40, 290.06 (subd. 2c(e), 22), 645.44 (revisor.mn.gov, raw text); DOR pages "Estimated Tax Payments for Individuals" (updated Jan. 7, 2026), "Calculating Penalty and Interest", "Penalties and Interest for Individuals". Schedule M15 not located (not needed: statute is complete).

### MN 2025: 1 value correction + citation fixes
| key | before | after | source |
|---|---|---|---|
| farmer.rule | `file_by: 2026-03-01` (Sunday, unrolled) | `file_by: 2026-03-02` | 289A.25 subd. 10; DOR page next-business-day rule |
| farmer.rule citation | cited "subd. 8" | cites subd. 10 (subd. 8 is the withholding rule) | 289A.25 subd. 10 |
| installments.pcts citation | cited subd. 3 | subd. 5 ("25 percent of the required annual payment") | 289A.25 subd. 5 |
| installments.due_dates citation | subd. 3 | subd. 3(b) | 289A.25 subd. 3(b) |
| required_threshold citation | DOR page + subd. 4 | subd. 4 ("less than $500") first | 289A.25 subd. 4 |
| penalty.rate citation | "CAUTION: days after Jan 1, 2026 accrue at 7%" | WRONG caution removed: 270C.40 subd. 4 fixes the rate for the whole underpayment period at the rate for the January 1 on which the taxable year begins (8% for all TY2025 days) | Minn. Stat. 270C.40 subd. 4 |

### MN 2026: citation fixes only (values pass)
Same subdivision fixes; penalty.rate 0.07 now cites 270C.40 subd. 4 (7% covers TY2026 days falling in 2027 too; the stale "2027 rate not read" caution removed). farmer.rule 2027-01-15 / 2027-03-01 pass.

Holidays recomputed from 645.44 subd. 5 (Sunday -> Monday, Saturday -> Friday for the five fixed-date holidays; Friday after Thanksgiving): exact match both years.

### Residual unverified: none.

### Not expressible
- Nonresident / part-year resident: high-AGI test uses the Minnesota share of AGI (289A.25 subd. 5(2)(i)); prior-year safe harbor needs at least $1 of prior-year Minnesota liability (DOR page).
- Jan 31 file-and-pay relief for the 4th installment (subd. 9).
- 645.44 general holiday list includes Indigenous Peoples Day, which the executive branch (DOR) does not observe; it is kept (no estimate date falls in October) - harmless.


## Mississippi (MS)

Sources read during the audit (2026-10-11): Form 80-100 (2025, Rev. 12/25) booklet; Form 80-320 (2025, Rev. 09/25) and its instructions; Form 80-106 (Rev. 09/25) voucher; Form 80-205 (2025); the DOR Individual Income Tax FAQ (live page); the Miss. Code 3-3-7 text as reproduced in HB 641 (2026, signed, approved 02/17/2026) and SB 2098 (2026, introduced); the billstatus.ls.state.ms.us code-section 3-3-7 histories for 2025 and 2026 and the SB 2588 history (died 02/04/2025). No TY2026 Mississippi forms (80-106/80-320/80-100/80-205 "26") are on the DOR form search yet. The statute text of Miss. Code 27-7-319..327 could not be read (Justia returns 403, and no session bill touched those sections in 2023-2026).

**MS 2025: 3 corrections**

| key | before | after | source |
|---|---|---|---|
| farmer.rule | file_by 2026-03-01 (unrolled) | file_by 2026-03-02 (status stays verified); the citation now flags the 80% inconsistency | DOR FAQ: "If the due date falls on a Saturday, Sunday or legal holiday, the return is due the next business day" (MO roll convention). current_pct 0.8 is printed only on Form 80-100 Line 30. Form 80-320 and the booklet's Declaration section omit "80%". |
| nonresident_method | sourced_flat, unverified | sourced_flat, verified | Form 80-205 (2025) lines 13a-20: Mississippi-source income less deductions and exemptions prorated by the MS AGI / total AGI ratio, then taxed on the rate schedule. |
| holidays | unverified (rebuilt from the dead SB 2588) | verified, same dates | Miss. Code 3-3-7 text (HB 641 signed 2026; SB 2098 existing-law text). Confederate Memorial Day stays. Juneteenth is not a legal holiday: every 2025-2026 Juneteenth bill died. A Sunday holiday moves to the next day; a Saturday holiday does not move. |

**MS 2026: 3 corrections**

| key | before | after | source |
|---|---|---|---|
| holidays | unverified | verified | Same as 2025 (HB 641 signed text, 2026 bill histories) |
| credit_for_other_state | unverified | verified | DOR FAQ (live): resident credit for "the other state's actual tax liability" |
| nonresident_method | unverified | verified | DOR FAQ (live): only Mississippi-source wages are taxed; total income is reported "to prorate exemptions and deductions". Form 80-205 (2025) |

**Residual unverified rows (5):**
- 2025 `installments.due_dates`: the June 16 roll. Mississippi publishes a weekend rule only for returns, and Form 80-320 prints "June 15, 2025".
- 2026 `safe_harbor.prior_pct`, `safe_harbor.high_agi_rule`, `installments.pcts` and `farmer.rule`: all carried from the 2025 Form 80-320 / 80-100. No 2026 form is published and the 27-7-3xx statute text was not readable. The FAQ states only the 80% current-year test.

**Rules the key set cannot express:**
- Estimates are required only when tax exceeds $200 AND less than 80% of the liability is prepaid through withholding.
- The farmer 80%-by-Jan-15 test conflicts between Mississippi's own forms.
- The prior-year safe harbor does not apply when prior-year liability is zero and current-year liability is over $200 with no estimates paid (Form 80-320 line 4 instruction): line 2 (80% current) is used instead.
- The penalty is 1/2% per month interest (6% simple), computed per period "until paid or next payment due date".
- Nonresident deductions are prorated, so `sourced_flat` is an approximation.


## Montana (MT)

Sources read during the audit (2026-10-11): Montana Publication 1 (2026); Form EST-I (2025); MCA (2025) 15-30-2512, 15-1-216, 15-30-2302, 15-30-2104 and 1-1-216 (archive.legmt.gov); the IRS Quarterly Interest Rates page (2026 table). There is no 2026 Form EST-I (404).

**MT 2025: audit: pass** (13/13 verified; values and dates confirmed: $500 threshold, 90%/100%, no high-AGI rule, 4 x 25%, June 16, 2025 roll per Pub 1 and the DOR page, farmer exemption, 7% rate, ratio method, holidays per MCA 1-1-216 with the Saturday-to-Friday and Sunday-to-Monday shifts and Nov 3, 2026 election day).

**MT 2026: 3 corrections**

| key | before | after | source |
|---|---|---|---|
| penalty.rate | 0.07, unverified | 0.07, verified | MCA 15-1-216(7)(a)(i): the calendar-year rate equals the IRS §6621 individual underpayment rate for Q3 of the preceding year. Pub 1 (2026): TY2026 uses the 2027 rate. IRS Q3 2026 rate = 7% (IRB 2026-22), so the 2027 Montana rate is 7% by formula. The DOR's own 2027 notice has not been seen. |
| credit_for_other_state | true, unverified | true, verified | MCA 15-30-2302 (2025) |
| nonresident_method | ratio, unverified | ratio, verified | MCA 15-30-2104(1)(a) (2025): resident-basis tax x Montana-source / total income |

**Residual unverified: none.**

**Rules the key set cannot express:**
- **Farmers and ranchers (66 2/3% of gross income) are fully exempt from estimates** (MCA 15-30-2512(1)(a), (6)). `farmer.rule = null` must NOT be read as "farmers follow the regular schedule". The engine needs a Montana special case.
- These are also exempt: taxpayers with zero prior-year liability for a 12-month year, and taxpayers not required to file the prior year (Pub 1). So are taxpayers who retired at 62+ or became disabled, in that year and the following year.
- The prior-year method requires that a return was filed for a 12-month preceding year.
- Interest runs only to the 15th day of the 4th month. There is no Q4 interest if the return is filed and paid by the last day of January (15-30-2512(5)(d)).
- The credit is denied where the other state grants a reverse credit (15-30-2302(3)).


## Nebraska (NE)

Sources read during the audit (2026-10-11):
- Form 1040N-ES 2025 and 2026 booklets
- Form 2210N 2025 (final) and DRAFT 2026 (8/17/2026)
- 2025 Individual Income Tax Booklet
- Neb. Rev. Stat. 25-2221, 84-1001, 45-104.02, 77-2769, 77-2788, 77-2790, 77-2730 and 77-2715 (nebraskalegislature.gov)

No final 2026 Form 2210N exists yet.

**NE 2025: 1 correction; 1 citation clarified**

| key | before | after | source |
|---|---|---|---|
| holidays | unverified (court-holiday proxy) | verified, same dates | Neb. Rev. Stat. 84-1001(3) makes the 25-2221 list the state-employee paid holidays (plus proclaimed days) with the same Sat-to-Fri and Sun-to-Mon shifts. 25-2221 adds that the federal observance date controls. All 2025-2027 dates were re-computed and match. |
| farmer.rule | file_by 2026-03-01 (Sunday) | unchanged, kept as printed; the citation now explains why | The 2025 booklet prints "on or before March 1, 2026", says an extension cannot move it, and gives no roll. Nebraska's printed weekend rule covers installments and the April 15 return only. This intentionally departs from the MO roll convention. The CPA may choose to roll it to March 2. |

**NE 2026: 2 corrections; 1 citation fixed**

| key | before | after | source |
|---|---|---|---|
| holidays | unverified | verified | As for 2025 |
| penalty.rate | 0.08, unverified | 0.08, verified | 45-104.02(2): the rate is redetermined every other year from Jan 1, 1993 (odd years), so the 2025 rate (8%, final 2025 Form 2210N) continues through 2026. Also the DRAFT 2026 Form 2210N line 22a (8%) and 77-2788 / 77-2790(3). Caveat: a new rate may start Jan 1, 2027. |
| farmer.rule | citation said "March 1, 2026 is a Sunday" | citation corrected: Jan 15, 2027 (Fri) and Mar 1, 2027 (Mon) need no roll | 1040N-ES 2026 |

**Residual unverified: none.**

**Rules the key set cannot express:**
- The MFS high-AGI threshold is $75,000.
- The farmer two-thirds test passes if met in either the current or the prior year.
- Under 77-2769(5) estimated due dates follow federal law, so a federal (DC) holiday roll could in principle differ from the state list.
- Ad-hoc proclaimed closure days are not listed.
- The single-rate key cannot follow a 2027 rate change.


## RI (Rhode Island)

Sources read in audit (2026-10-11): 2025 Form RI-2210 (form + instructions); 2025 and 2026 Form RI-1040ES; ADV 2025-09 (June 16, 2025); ADV 2025-23 (2026 rates); 2025 RI-1040NR Schedule II; R.I. Gen. Laws §§25-1-1, 44-1-7, 44-30-18, 44-30-55, 44-30-56, 44-30-84.

**80% safe harbor confirmed by statute**: §44-30-84(b) charges interest on the amount by which payments are "less than eighty percent (80%) of the installment at the time it is due". RI-2210 line 2 = 80% of current tax; lines 5-6 = smaller of that and 100% of prior-year tax. The prior-year alternative comes from the form, not the statute (§44-30-84(b) brings in only IRC §6654(e)(1)-(2)).

### RI 2025: corrections
| key | before | after | source |
|---|---|---|---|
| holidays | no 2025-05-05 | added 2025-05-05 | §25-1-1: "when either of the above days falls on the first day of the week, then the day following it" (May 4, 2025 is a Sunday) |
| required_threshold, penalty.rate_source, credit_for_other_state | citation (form only) | statute added (§44-30-55(a), §44-30-84(b) + §44-1-7, §44-30-18); value unchanged | statute text |

### RI 2026: corrections
| key | before | after | source |
|---|---|---|---|
| safe_harbor.current_pct | 0.8 unverified | 0.8 **verified** | §44-30-84(b); 2026 RI-1040ES "80% of such installment" |
| installments.pcts | unverified | **verified** | §44-30-56(a) "equal installments" |
| holidays | no 2025-05-05 | added 2025-05-05 | §25-1-1 |
| required_threshold, penalty.rate_source, credit_for_other_state, safe_harbor.prior_pct | citation | statute added; value unchanged (prior_pct status unchanged) | statute text |

Residual unverified rows (RI 2026): `safe_harbor.prior_pct` (100% comes only from the RI-2210 form, and the 2026 RI-2210 is not published); `farmer.rule` (the farmer rule is only in RI-2210 instructions; 2026 edition not published); `nonresident_method` (2026 RI-1040NR not published; statute §44-30-2.6 did not settle the method).

Rules the key set cannot express: the 80% applies per installment (§44-30-84(b)); the stored pair gives min(80% of current, 100% of prior). The January installment can be skipped by filing and paying in full by Jan 31 (2025 RI-2210) or by Feb 15 (2026 RI-1040ES; §44-30-55(e) "15th day of the second month"); the two documents disagree. The 2027 interest rate is not yet published (floor 12% under §44-1-7). Saturday holidays move to Monday only "for state employees" (stored as moved).


## SC (South Carolina)

Sources read in audit (2026-10-11): Form SC2210 (2025) form and instructions; Form SC1040ES 2025 and 2026; SC Information Letter #26-15; S.C. Code §§12-6-1720, 12-6-3400, 12-6-3910, 12-54-25, 12-54-55, 53-5-10, 53-5-30.

**SC adopts IRC §6654 by statute.** Under §12-6-3910(A) and §12-54-55(1), estimated payments and the penalty follow IRC §6654, with a $100 small-amount rule. So the §6654(i) farmer rule (66 2/3%, Jan 15 / Mar 1) applies, and SC2210 tells farmers to complete federal Form 2210F "for South Carolina purposes". Under **§12-54-25(D) the SC underpayment rate is set "in the same manner and at the same time as" IRC §6621(a)(2)**. That makes it the federal quarterly rate: IL 26-15 shows 7% / 7% / 6% / 7%, the same as the federal rates.

### SC 2025: corrections
| key | before | after | source |
|---|---|---|---|
| penalty.rate_source | state | **federal** | §12-54-25(D); §12-54-55(1) |
| penalty.rate | 0.07 | **null** (NM convention for federal) | §12-54-25(D); IL 26-15 |
| farmer.rule | unverified | **verified** (value unchanged, current_pct 0.6667) | §12-6-3910(A), §12-54-55(1) -> IRC §6654(i); SC2210 farmer instructions |
| required_threshold, nonresident_method | citation | statute added; value unchanged | §12-6-3910(A)(1); §12-6-1720 |

### SC 2026: corrections
| key | before | after | source |
|---|---|---|---|
| penalty.rate_source | state | **federal** | §12-54-25(D) |
| penalty.rate | 0.07 unverified | **null** verified | §12-54-25(D); IL 26-15 |
| farmer.rule | unverified | **verified** | §12-6-3910(A); 2026 SC1040ES (Jan 15, 2027 / Mar 1, 2027) |
| credit_for_other_state | unverified | **verified** | §12-6-3400(A) |
| nonresident_method | other, unverified | other, **verified** | §12-6-1720 (resident-style computation on SC-source income only) |

Holidays were checked against §53-5-10 and §53-5-30 for 2025-2027 (Sat holiday -> Fri, Sun -> Mon; Dec 24-26; no Juneteenth or election day): **audit: pass**.

Residual unverified rows: none.

Rules the key set cannot express: the MFS high-AGI threshold is $75,000 (SC2210 line 7). Filers may file by Feb 1/2 and pay in full in place of the January installment. The farmer rule also allows 100% of prior-year tax (§6654(i)). There is no penalty on underpayment caused by personal-service income taxed and withheld by another state (§12-54-55(1)). Act 110 changes the 2026 base, but no percentage, threshold or date.


## Utah (UT)

**Settled: Utah has NO individual estimated-tax installment requirement.** The suspicion that Utah requires quarterly estimates is not supported by any primary source read:
- 2025 TC-40 Instructions p.4: "Utah does not require quarterly estimated tax payments. You can prepay at any time at tap.utah.gov, or by mailing your payment with form TC-546."
- Pub 58 (Rev. 11/25) "Underpayment Penalties" covers only corporation, insurance and severance-tax quarterly payments; the individual rule is "Insufficient Prepayment (Extension Penalty)".
- Form TC-547 (Rev. 10/26) is the *return payment coupon* ("Do not use this return payment coupon to prepay future individual income taxes. Use form TC-546"); it is not an underpayment-penalty form.
- Utah Code 59-10-107 does not exist on le.utah.gov (no version served). The operative statutes are 59-10-514 (tax payable by the return due date, without regard to extension) and 59-10-516(2)(b)-(3) (no extension-period penalty if, by the return due date, the taxpayer pays the lesser of 90% of current-year tax or 100% of prior-year tax; otherwise a 59-1-401 penalty).

The researcher's mapping (threshold 0, one 100% "installment" on the original return due date, penalty 0.24 = 2%/month extension penalty) is kept. Because every mapped value is now traced to statute/form text, those rows are upgraded to verified, with citations that say plainly that there are no quarterly estimates.

### UT 2025 corrections
| key | before | after | source |
|---|---|---|---|
| required_threshold | 0, unverified | 0, verified (citation rewritten) | Utah Code 59-10-516(2)(b); TC-40 Instr. 2025 p.4; TC-546 (Rev. 10/26) |
| installments.due_dates | ["2026-04-15"], unverified | same value, verified | TC-40 Instr. 2025 ("by April 15, 2026"); 59-10-514(2) |
| installments.pcts | [1.0], unverified | same value, verified | 59-10-516(2)(b); TC-546 worksheet |
| farmer.rule | null, unverified | null, verified | 59-10-516 (no farmer variant); Pub 58; TC-546 |
| penalty.rate | 0.24, unverified | 0.24, verified (citation: extension penalty only, max 6 months; late-payment penalty applies instead if filed on time unpaid) | Pub 58 formula "x .24"; TC-546 "2 percent ... each month" |
| holidays | included "2026-04-03" (Good Friday 2026) | removed | Utah Code 63G-1-301: Good Friday added by the version effective 5/6/2026, after April 3, 2026 |

### UT 2026 corrections
Same five mapping rows as 2025 (due date April 15, 2027 verified via 59-10-514(1)(a)(i) + IRC 6072(a)), same holiday removal, plus:
| key | before | after | source |
|---|---|---|---|
| credit_for_other_state | true, unverified | true, verified | Utah Code 59-10-1003 (unchanged since 2006) |
| nonresident_method | ratio, unverified | ratio, verified | Utah Code 59-10-116(1), 59-10-103(1)(x),(z)(ii) (eff. 5/7/2025) |

Residual unverified: none. Notes: Pub 58 interest 6% runs through 12/31/2026; the 2027 rate is not yet published.

### Not expressible / engine must know
- **UT must be special-cased**: no quarterly vouchers, no installment-underpayment penalty. The only exposure is (a) the 59-10-516 extension penalty (2%/month, max 6 months, only while on extension) and (b) interest from the original due date. If the engine schedules four federal-pattern vouchers for UT (e.g. via the "unverified -> federal fallback" path) it is wrong.
- Prepayment counts withholding, prior refunds applied, credits and carryovers (TC-40 Instr.).


## VT (Vermont)

Sources read in audit (2026-10-11): 32 V.S.A. §§3108, 5822, 5825, 5851, 5852, 5855; 1 V.S.A. §371; 2025 and 2026 IN-114 instructions; 2025 IN-111 instructions; Worksheet IN-152 (2025); tax.vermont.gov Interest Rates page.

**$500 meaning**: §5855(b)(1) says there is no interest or penalty if return tax less Vermont withholding is under $500.00. This works like the federal $1,000 de minimis in IRC §6654(e)(1), which is how the key is used elsewhere, so the mapping is exact and the row was upgraded. §5852(a) itself has no dollar floor.

**Farmer**: §5852(a) exempts anyone "receiving at least two-thirds of his or her income from farming or fishing" from installments entirely. The fact is verified. A null `farmer.rule` (meaning "no farmer rule") misrepresents it, so the row stays unverified.

**MATERIAL: the penalty is understated.** Worksheet IN-152 (2025) charges interest (8.5% for 2025 days, 7.75% for 2026 days) **plus a 1% per month penalty** on each quarter's underpayment (a partial month counts as a whole month). The key stores only the interest rate.

### VT 2025: corrections
| key | before | after | source |
|---|---|---|---|
| required_threshold | 500 unverified | 500 **verified** | §5855(b)(1); IN-111 Line 31 |
| penalty.rate | citation | value 0.085 unchanged; CAUTION about the 1%/month penalty added | IN-152 lines 9-14; §3108 |
| nonresident_method, credit_for_other_state | citation | statute added | §5822(e); §5825(a) |

### VT 2026: corrections
| key | before | after | source |
|---|---|---|---|
| required_threshold | unverified | **verified** | §5855(b)(1); 2026 IN-114 |
| credit_for_other_state | unverified | **verified** | §5825(a) |
| nonresident_method | ratio, unverified | ratio, **verified** | §5822(e) (tax reduced by the non-Vermont share of AGI) |
| penalty.rate | citation | 0.0775 unchanged; 1%/month penalty CAUTION added | Interest Rates page; IN-152 |

Holidays were checked against 1 V.S.A. §371 (Town Meeting Day; Bennington Aug 16; Saturday -> Friday, Sunday -> Monday): **pass**.

Residual unverified rows: `farmer.rule` in 2025 and 2026 (an exemption that the shape cannot hold).

Rules the key set cannot express: the farmer exemption; the 1%/month penalty on top of interest; the rate change at the calendar year (2025 days 8.5%, 2026 days 7.75%, 2027 rate not yet set); the zero-prior-year exception (§5855(b)(2)); the §5852(b) federal-annualized alternative (24% of the federal required payment, prorated).


## Virginia (VA)

Checked against Form 760ES 2025 (Rev. 09/24) and 2026 (Rev. 09/25), Form 760C 2025, Form 763 2025, Va. Code 58.1-490, 58.1-492, 58.1-15, 58.1-325, 58.1-332, 2.2-3300, and irs.gov Quarterly interest rates.

**2026 threshold change confirmed**: 2026 760ES Section I "For taxable years beginning on and after January 1, 2026, if your Virginia income tax liability, after subtracting income tax withheld and any allowable credits, is expected to be more than $1,000". 2025 760ES: "more than $150". Va. Code 58.1-490(A) delegates the amount to regulation, so the form is the operative primary source. Due dates May 1 / June 15 / Sept 15 / Jan 15 confirmed (58.1-490(E), 760ES); 760ES weekend/holiday sentence supports June 16, 2025.

### VA 2025 corrections
| key | before | after | source |
|---|---|---|---|
| farmer.rule | current_pct 0.6667 | 0.6666666667 (MO convention); statute added | Va. Code 58.1-490(F),(I); 58.1-492(A)(1) |
| penalty.rate_source | citation relied on bulletins "not opened" | citation = statute | Va. Code 58.1-492(A), 58.1-15(A)-(B) |
| penalty.rate | 0.09, citation relied on unopened bulletins | 0.09, citation = 760C line 23 + 58.1-15 + IRS rates | Form 760C 2025 line 23 "(9% Per Annum)" |
| nonresident_method | other (form only) | other, + statute | Va. Code 58.1-325(A) |
| credit_for_other_state | true | true, + statute limitation note | Va. Code 58.1-332(A) |

### VA 2026 corrections
| key | before | after | source |
|---|---|---|---|
| farmer.rule | current_pct 0.6667 | 0.6666666667 | as above |
| nonresident_method | other, unverified | other, verified | Va. Code 58.1-325(A) (statute unchanged; 2026 Form 763 unpublished) |
| penalty.rate | 0.09, unverified (unopened bulletins) | 0.09, still unverified; citation now primary | 58.1-15 + irs.gov 2026 underpayment 7/6/7/7% -> VA 9/8/9/9%; Q1 2027 rate (runs through May 1, 2027) unknown |
| penalty.rate_source / credit_for_other_state | citations | statute added | 58.1-492/58.1-15; 58.1-332 |

Residual unverified: VA 2026 `penalty.rate` (quarterly variation; Q1-2027 rate not announced).

### Not expressible
- Threshold is strictly "more than" $150 / $1,000; income-based exemptions (single VAGI < $11,950, joint < $23,900).
- Late-starter 3/2/1 installment schedule (33 1/3%, 50%, 100%).
- Penalty period ends May 1 (VA return due date) per 58.1-492(B); quarterly rate changes.
- Credit for other-state tax only on earned/business income and capital gains (58.1-332), and not for AZ, CA, OR, DC residents' nonresident tax (760ES).
- Nonresident: taxable income (not tax) is prorated, then taxed at graduated rates ("other").


## West Virginia (WV)

TY2026 IT-140 booklet / IT-210 / IT-140ES are **still not published** (2026-10-11: tax.wv.gov Forms and Individuals pages list only /Documents/PIT/2025/ files; /Documents/PIT/2026/ URLs 404). The 10 carried TY2026 rows were therefore re-verified against the West Virginia Code in force (read on code.wvlegislature.gov): 11-21-3, 11-21-20, 11-21-30, 11-21-55, 11-21-56, 11-10-17a, 11-10-18a, 2-2-1, 3-5-1. 2025 rows spot-checked against the 2025 IT-140 booklet ("Special Rules for Farmers") and TSD 365 (Rev. March 2026: 12.25% for 2025, 11.5% for 2026) - pass apart from the items below.

### WV 2025 corrections
| key | before | after | source |
|---|---|---|---|
| farmer.rule | current_pct 0.6667 | 0.6666666667; statute added | W. Va. Code 11-21-55(e), 11-10-18a(j) |
| installments.due_dates | value unchanged | statutory roll basis added (June 16, 2025 confirmed) | W. Va. Code 11-21-56(a)(1), 2-2-1(e) |
| holidays | no primary-election days | added 2026-05-12 (statewide primary) | W. Va. Code 2-2-1(a)(13), 3-5-1 (second Tuesday in May, even years) |

### WV 2026 corrections
| key | before | after | source |
|---|---|---|---|
| has_income_tax | unverified | verified | 11-21-3(a) |
| required_threshold | 600, unverified | 600, verified | 11-10-18a(e)(1) ("less than $600") |
| safe_harbor.current_pct | 0.9, unverified | verified | 11-10-18a(b)(1) |
| safe_harbor.prior_pct | 1.0, unverified | verified | 11-10-18a(d)(1) |
| safe_harbor.high_agi_rule | null, unverified | verified | 11-10-18a(d)(1) (no income test) |
| installments.due_dates | unverified | verified | 11-21-55(d), 11-21-56(a)(1), 2-2-1(e) |
| installments.pcts | unverified | verified | 11-21-56(a)(1) "four equal installments" |
| farmer.rule | current_pct 0.6667, unverified | 0.6666666667, verified | 11-21-55(e), 11-10-18a(j) |
| credit_for_other_state | unverified | verified | 11-21-20 |
| nonresident_method | ratio, unverified | ratio, verified | 11-21-30(a)(2) (tentative resident tax x WV-source / federal AGI) |
| holidays | no primary day | + 2026-05-12 | 2-2-1(a)(13), 3-5-1 |

Residual unverified: none. Caution kept in citations: 2027 interest rate (set each December under 11-10-17a(c)) is unknown; 2026 days of a TY2025 underpayment accrue at 11.5%, not 12.25%.

### Not expressible
- Declaration requirement in statute is an income test (11-21-55(a): WV AGI other than withheld wages over $400 plus exemptions); the $600 key is the 11-10-18a(e)(1) penalty floor the booklet uses.
- Zero-prior-year-tax exception when current-year tax < $5,000 (11-10-18a(e)(2)); Q4 relief if return filed and paid by January 31 (11-10-18a(i)); booklet's "less than 10% of estimated tax" carve-out.
- Annualized-income applicable percentages 22.5/45/67.5/90 (11-10-18a(d)(2)).
- Rate changes on January 1 (single-rate key).
- Special-election and governor-proclaimed holidays (2-2-1(a)(13),(15)) cannot be listed in advance.


## WI (Wisconsin)

Sources read in audit (2026-10-11): Wis. Stat. §§71.09, 71.84(1), 995.20, 5.02(12s); 2025 Form 1-ES Instructions (June 16, 2025 / March 2, 2026 and the weekend/holiday roll); the researcher's 2025 Schedule U, 2026 1-ES and Form 1/1NPR text are cited unchanged.

**Farmer rule**: under §71.09(3) farmers may pay the estimated tax "required by sub. (2)" by Jan 15. The amount is the ordinary amount under §71.09(13)(a): lower of 90% of current or 100% of prior. There is no 66 2/3% reduction, so current_pct 0.9 is correct. §71.09(4) lets a farmer file by the first day of the 3rd month and pay in full instead. **Penalty**: §71.84(1) sets a fixed "12 percent per year", so 12% is right for both years and all days.

### WI 2025: corrections
| key | before | after | source |
|---|---|---|---|
| holidays | no partisan primary | added **2026-08-11** | §995.20 ("the day of holding the partisan primary election"); §5.02(12s) (2nd Tuesday in August) |
| farmer.rule, penalty.rate_source, penalty.rate, required_threshold | citation | statute added (§71.09, §71.84(1), §71.09(11)(a)); values unchanged | statute text |

### WI 2026: corrections
| key | before | after | source |
|---|---|---|---|
| holidays | no partisan primary | added 2026-08-11 | §995.20; §5.02(12s) |
| farmer.rule | unverified | **verified** | §71.09(1)(a), (3), (4), (13)(a) |
| penalty.rate | 0.12 unverified | 0.12 **verified** | §71.84(1) |
| penalty.rate_source, required_threshold | citation | statute added | §71.84(1); §71.09(11)(a) |

Residual unverified rows (WI 2026): `credit_for_other_state` and `nonresident_method`. The 2026 Form 1/1NPR instructions are not published, and the §71.07 statute page fetched did not include the credit text.

Rules the key set cannot express: estates and trusts with taxable income of $20,000 or more lose the prior-year safe harbor (§71.09(13)(c)); zero-prior-year resident exception (§71.09(11)(b)); annualized 22.5/45/67.5/90% (§71.09(13)(d)); the farmer March 1 alternative. Saturday holidays do not move under §995.20, so July 4, 2026 (a Saturday) is stored as itself.

