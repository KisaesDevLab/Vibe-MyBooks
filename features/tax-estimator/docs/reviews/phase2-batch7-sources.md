# Phase 2 batch 7 sources: jurisdictions with no broad personal income tax

Researched 2026-10-11. Seeds: packages/api/src/db/seeds/tax-estimator/state-rules/{AK,FL,NV,NH,SD,TN,TX,WA,WY}.ts.
Each state x {2025, 2026} has one row: `has_income_tax = false`.

## Verdicts

| State | 2025 | 2026 | Status | Primary source read |
|---|---|---|---|---|
| AK | false | false | verified | tax.alaska.gov/programs/programs/index.aspx?10001 ("currently does not have an individual income tax") |
| FL | false | false | verified | Fla. Const. art. VII s.5(a), flsenate.gov/Laws/Constitution |
| NV | false | false | verified | tax.nv.gov/about-nevada-department-of-taxation/income-tax-in-nevada/ |
| NH | false | false | verified | gc.nh.gov/rsa/html/V/77/77-mrg.htm: RSA ch. 77 "Repealed by 2021, 91:99, II, eff. Jan. 1, 2025." |
| SD | false | false | verified | dor.sd.gov/individuals/taxes/ |
| TN | false | false | verified | tn.gov/revenue/taxes/hall-income-tax.html |
| TX | false | false | verified | Tex. Const. art. VIII s.24-a; tlc.texas.gov/docs/amendments/Constamend1876.pdf (current through 2025-11-04: "Adopted" 2019/11/05); HJR 38 enrolled text |
| WA | false | false | verified | dor.wa.gov/taxes-rates/income-tax; RCW 82.87.040 |
| WY | false | false | UNVERIFIED | only an undated Wyoming Business Council page (wyomingbusiness.org/?p=1222) |

No state was found to levy a broad personal income tax in 2025 or 2026, so NO_BROAD_INCOME_TAX_STATES needs no change for those years.

## Documents fetched

- NH: https://gc.nh.gov/rsa/html/NHTOC/NHTOC-V-77.htm ("Chapter is repealed") and https://gc.nh.gov/rsa/html/V/77/77-mrg.htm. NH DRA pages (revenue.nh.gov, incl. notice 2023-003) returned 403 to every fetch; the HB 2 2023 ch. 79 ss. 85-88 acceleration (repeal for periods beginning after 12/31/2024, from after 12/31/2026) comes only from search-result summaries of that notice and press, not read directly. The statute note itself is the primary evidence. Periods beginning on or before 12/31/2024 remain open for audit/collection; no 2025 I&D return exists.
- TN: https://tn.gov/revenue/taxes/hall-income-tax.html ("repealed for tax periods that begin on January 1, 2021, or later"; "do not file a return for any tax year that begins on or after January 1, 2021"). Search results also pointed to revenue.support.tn.gov HIT-3 (not fetched).
- WA: https://dor.wa.gov/taxes-rates/income-tax ("Washington does not currently have an individual income tax"; new 9.9% tax on AGI over $1M starts Jan 1, 2028, first return 2029, via SB 6346); https://app.leg.wa.gov/billsummary?BillNumber=6346&Year=2025 (signed 2026-03-30, C 238 L 26); https://app.leg.wa.gov/RCW/default.aspx?cite=82.87.040 (excise tax on long-term capital assets: 7%, +2.9% above $1,000,000 from 2025); https://dor.wa.gov/taxes-rates/other-taxes/capital-gains-tax (individuals only; 2025 standard deduction $278,000; due with federal return; 80% prepayment rule; prepay up to six months early from TY2026); https://dor.wa.gov/forms-publications/publications-subject/special-notices/new-tiered-rates-washingtons-capital-gains-tax (ESSB 5813, ch. 421, L 2025).
- FL: https://www.flsenate.gov/Laws/Constitution (art. VII s.5(a)).
- TX: https://capitol.texas.gov/tlodocs/86R/billtext/html/HJ00038F.htm, https://www.sos.state.tx.us/elections/voter/2019novballotlang.shtml (Prop 4 ballot language), https://tlc.texas.gov/docs/amendments/Constamend1876.pdf.
- NV: tax.nv.gov income-tax page. SD: dor.sd.gov/individuals/taxes/ ("one of seven states" is stale, the statement is current). AK: tax.alaska.gov page above.
- WY: https://wyomingbusiness.org/?p=1222 ("NO personal state income tax"); https://excise-tax-div.wyo.gov/ (no income tax program listed). No revenue.wyo.gov or statute text stating the point was found.

## Washington decision (for the CPA)

I agree with the registry: WA is `has_income_tax = false` for 2025 and 2026. WA has no wage or broad income tax. The capital gains tax is an excise tax (RCW 82.87.040) on long-term capital asset sales, individuals only, filed on its own return due with the federal return (no quarterly installment regime; an 80% prepayment rule avoids the penalty and prepayment is allowed starting TY2026). It is not a broad-based personal income tax and does not fit the 13-key estimated-installment model. The tool should not model it; the CPA should be told that WA clients with large long-term gains (>$278,000 deduction for 2025) owe 7% / 9.9% separately. Note the user-facing text should say "not modelled".

Warning: ESSB 6346 (ch. 238, L 2026) creates a 9.9% income tax on AGI over $1 million from tax year 2028 (first return 2029; a court challenge and a repeal initiative were reported by secondary sources, not verified). WA must be moved out of NO_BROAD_INCOME_TAX_STATES and given full rules when 2028 rules are seeded. It does not affect 2025 or 2026.

## Other things the CPA should know (not part of the estimator; not verified this task unless stated)

- NH: Business Profits Tax and Business Enterprise Tax apply to businesses (including some unincorporated sole proprietors/partnerships above thresholds); they are not personal income taxes. Not researched here.
- TN: Franchise and excise taxes apply to LLCs, LPs and corporations (not sole proprietors). Not researched here.
- TX: Franchise (margin) tax applies to LLCs/partnerships/corporations, not individuals; art. VIII s.24-a's reach over entities is unsettled (the LBB fiscal note for HJR 38 flagged it). Not modelled.
- NV: Commerce Tax on businesses with gross revenue over $4 million (read on the NV page). Modified Business Tax and others not researched.
- AK: Permanent Fund Dividend is federally taxable but not taxed by Alaska. Some municipalities levy sales taxes; no local income taxes known.
- Local income taxes: none of these nine states was found to authorize local individual income taxes in the pages read; not exhaustively researched.
- WY: re-verify against a Department of Revenue or statutory source before flipping to `verified`.
