# Phase 1 — Federal parameter sources (TY2025, TY2026)

Researched 2026-10-11 by the tax-law-researcher agent. Seeds:
`packages/api/src/db/seeds/tax-estimator/federal/2025.ts` and `2026.ts` (149 keys each).
The figures were read from the downloaded PDF or statute text, not from summaries. Every seed row's `citation` names the exact section or line.

| Year | Rows | verified | unverified |
|---|---|---|---|
| 2025 | 149 | 136 | 13 |
| 2026 | 149 | 144 | 5 |

## Sources fetched

### Used by both years
| Document | URL | Date |
|---|---|---|
| IRC (Cornell LII, current text incl. Pub. L. 119-21 amendments): §§1, 11, 68, 151, 163, 164, 170, 199A, 223, 224, 225, 402, 461, 469, 1401, 1402, 1411, 3101, 6654, 6655, 7503 | https://www.law.cornell.edu/uscode/text/26/{section} | fetched 2026-10-11 |
| Rev. Proc. 2025-32 (2026 inflation adjustments; §2 summarises OBBBA changes incl. 2025 std deduction) | https://www.irs.gov/pub/irs-drop/rp-25-32.pdf | Oct 2025 |
| Rev. Rul. 2024-25 (Q1 2025), 2025-7 (Q2 2025), 2025-11 (Q3 2025), 2025-18 (Q4 2025), 2025-22 (Q1 2026), 2026-5 (Q2 2026), 2026-10 (Q3 2026), 2026-15 (Q4 2026), §6621 rates | https://www.irs.gov/pub/irs-irbs/irb24-49.pdf, irb25-13, irb25-23, irb25-37, irb25-48, irb26-08, irb26-22, irb26-36 | I.R.B.s Dec 2024 – Aug 31, 2026 |
| IRS "Quarterly interest rates" page (cross-check only) | https://www.irs.gov/payments/quarterly-interest-rates | reviewed 2026-09-10 |
| OPM Federal Holidays schedules 2025–2028 (5 U.S.C. 6103) | https://www.opm.gov/policy-data-oversight/pay-leave/federal-holidays/ | fetched 2026-10-11 |
| D.C. Code §1-612.02 (DC Emancipation Day Apr 16; weekend observance) | https://code.dccouncil.gov/us/dc/council/code/sections/1-612.02 | fetched 2026-10-11 |
| Form 2210 (2025) + Instructions (Schedule AI; farmers' Mar 2, 2026; 110% rule; 7% rate periods through 04/15/26) | https://www.irs.gov/pub/irs-pdf/f2210.pdf, i2210.pdf | 2025 revision |
| Form 2220 (2025) + Instructions (corporate annualization periods/amounts, installment months) | https://www.irs.gov/pub/irs-pdf/f2220.pdf, i2220.pdf | 2025 revision |
| Schedule SE (Form 1040) 2025 + Instructions (92.35%, $400, 50%, $176,100) | https://www.irs.gov/pub/irs-pdf/f1040sse.pdf, i1040sse.pdf | 2025 |

### 2025-specific
| Document | URL | Date |
|---|---|---|
| Rev. Proc. 2024-40 (2025 brackets, LTCG, 65/blind, QBI, EBL) | https://www.irs.gov/pub/irs-drop/rp-24-40.pdf | Oct 2024 |
| Notice 2024-80 (2025 retirement limits) | https://www.irs.gov/pub/irs-drop/n-24-80.pdf | Nov 2024 |
| Rev. Proc. 2024-25 (2025 HSA) | https://www.irs.gov/pub/irs-drop/rp-24-25.pdf | May 2024 |
| Form 1040-ES (2025) (due dates incl. June 16, 2025; Feb 2, 2026; Mar 2, 2026; $176,100) | https://www.irs.gov/pub/irs-prior/f1040es--2025.pdf | 2025 |
| Schedule 1-A (Form 1040) 2025 (senior / tips / overtime / car-loan amounts, thresholds, rounding) | https://www.irs.gov/pub/irs-pdf/f1040s1a.pdf | created 11/4/25 |
| Instructions for Schedule A (2025) (SALT $40,000/$20,000, $500,000/$250,000, 30%, $10,000/$5,000 floor; worksheet) | https://www.irs.gov/pub/irs-pdf/i1040sca.pdf | 2025 |

### 2026-specific
| Document | URL | Date |
|---|---|---|
| Notice 2025-67 (2026 retirement limits) | https://www.irs.gov/pub/irs-drop/n-25-67.pdf | Nov 2025 |
| Rev. Proc. 2025-19 (2026 HSA) | https://www.irs.gov/pub/irs-drop/rp-25-19.pdf | May 2025 |
| Form 1040-ES (2026) (due dates; Feb 1, 2027; Jan 15 / Mar 1, 2027 farmers; $184,500; 2026 What's New for QBI min, charity, Sch 1-A, SALT) | https://www.irs.gov/pub/irs-pdf/f1040es.pdf | Feb 12, 2026 |

Downloaded but not needed: Forms 8995/8995-A + instructions, Form 461 + instructions, Form 8582 + instructions. Not retrievable: SSA contribution-and-benefit-base page (HTTP 403). The wage bases were taken from IRS forms instead. Form 1120-W was not found at the usual URL, so Form 2220 was used for corporate data.

## Keys NOT verified

| Year | Key | Seeded | Reason |
|---|---|---|---|
| 2025 | `charity.agi_floor_pct` | 0 | §170(b)(1)(I) 0.5% floor applies to tax years after 2025 (OBBBA §70425). This is a placeholder for a provision that does not apply. |
| 2025 | `charity.nonitemizer.{single,mfj,mfs,hoh,qss}` | 0 | §170(p) $1,000/$2,000 applies after 2025 (OBBBA §70424). Placeholder. |
| 2025 | `itemized.benefit_cap_rate` | 0.37 | §68 (2/37) applies after 2025 (OBBBA §70111(c)). 0.37 is used as "no cap". The engine must treat 2025 as uncapped. |
| 2025 | `qbi.min_deduction_amount`, `qbi.min_deduction_active_qbi_threshold` | 0, 0 | §199A(i) minimum applies to tax years after 2025 (Rev. Proc. 2025-32 §2.12). Placeholder. |
| both | `sch1a.{senior,tips,overtime}.phaseout_threshold.mfs` | 75,000 / 150,000 / 150,000 | MFS cannot claim these deductions (§151(d)(5)(C)(v), §224(f), §225(e)). The non-joint statutory amount is seeded only so the key exists. The engine must deny the deduction for MFS. |
| 2026 | `itemized.benefit_cap_rate` | 0.35 | §68(a) is a 2/37 reduction of the lesser of itemized deductions or taxable income above the 37% bracket start. 0.35 is the derived effective rate, not a figure stated in the statute. The engine should use the 2/37 formula. |
| both | `penalty.underpayment_rate` | 12 quarters | All of 2025 and 2026 is verified (7% every quarter except Q2 2026, which is **6%**). The four 2027 quarters are unpublished and use 7% as a placeholder. |

## Items for the CPA to double-check
1. **2026 SALT cap $40,400 / threshold $505,000** (MFS $20,200 / $252,500). These come from the statute, §164(b)(7)(A)(ii) and (B)(ii)(II). However, the 2026 Form 1040-ES What's New still prints $40,000 / $500,000. The statute was used.
2. **SALT for MFS.** The statute and the Schedule A worksheet start from the full cap: full cap − 30% × (MAGI − $250,000), floored at $10,000, and then halved. That works out to a 15% slope against `salt.cap.mfs`. The engine must not apply 30% to the already-halved cap.
3. **Q2 2026 underpayment rate is 6%, not 7%** (Rev. Rul. 2026-5). The oracle's flat 7% placeholder is wrong for Apr 1 – Jun 30, 2026.
4. **2026 QBI threshold for MFS is $201,775.** Single/HOH/QSS is $201,750. The QBI phase-in range widens to $75,000 / $150,000 only from 2026; for 2025 it is $50,000 / $100,000.
5. **The 2026 EBL threshold ($256,000 / $512,000) is lower than 2025 ($313,000 / $626,000).** This is because OBBBA §70601 re-based the indexing, and Rev. Proc. 2025-32 §4.31 confirms it.
6. **`retirement.sep.pct_of_comp` = 0.25** is the statutory employee rate. A self-employed owner's effective rate is 20% of net SE earnings after the §164(f) deduction, and the oracle uses 0.20. The engine must apply the reduction.
7. **`retirement.401k.catch_up_60_63` ($11,250) replaces the age-50 catch-up; it is not added to it.** The SIMPLE higher limits ($17,600 / $18,100), SIMPLE 60-63 catch-up ($5,250) and §414(v)(2)(B)(iii) $3,850 are not modeled by the registry.
8. **Rounding rules in Schedule 1-A.** Tips and overtime reduce $100 for each *whole* $1,000 of excess (round down). Car-loan interest reduces $200 for each $1,000 "or portion thereof" (round up).
9. **Farmer 2/3 tests.** These are stored as 0.6666666666 (ratio test, so that exactly 2/3 passes) and 0.6666666667 (safe-harbor %). The corporate annualization factor 1.33333 is copied from Form 2220. Exact 4/3 would differ by a fraction of a cent.
10. **Holidays.** The lists use OPM *observed* dates plus DC Emancipation Day (§7503 counts DC legal holidays). The executive-order closures of 2025-01-09, 2025-12-24 and 2025-12-26 are excluded. Whether an observed Friday (e.g. 2026-07-03) is a §7503 "legal holiday" is an interpretation call. It does not move any 2025–2026 due date.
11. **No 2026 Form 2210 or Form 2220 exists yet.** The 2026 Schedule AI and corporate annualization values rely on the statute plus the 2025 forms. The 2026 return due date (2027-04-15) is computed from §6072(a) and the calendar.
12. **Open question Q13 (Schedule AI line 9 QBI, line 19 credits)** was not in scope for the seed values and remains open.
