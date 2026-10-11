# Phase 2 batch 5 state rules: sources and review notes

Researcher: state-rules-researcher, 2026-10-11. Jurisdictions: NJ, NM, NY, NC, ND, OH, OK, OR, PA; tax years 2025 and 2026. Seed files: `packages/api/src/db/seeds/tax-estimator/state-rules/<ST>.ts`. Method: documents fetched with curl/WebFetch, read as text (pdftotext); `verified` only where the figure was read in the cited document during this task. Installment dates are stored rolled to the next business day where the state's own document says so (seed convention from MO/AR); farmer `file_by` dates are stored as printed by the state (several fall on a Sunday: NM/NY/NC TY2025 = 2026-03-01; OH/PA TY2025 stored as 2026-03-02 because the state source rolls them). Holidays cover calendar 2025-2027 in both year rows.

## Counts per state-year (13 keys each)

| State-year | verified | unverified |
|---|---|---|
| NJ 2025 | 13 | 0 |
| NJ 2026 | 12 | 1 |
| NM 2025 | 10 | 3 |
| NM 2026 | 10 | 3 |
| NY 2025 | 13 | 0 |
| NY 2026 | 12 | 1 |
| NC 2025 | 13 | 0 |
| NC 2026 | 12 | 1 |
| ND 2025 | 13 | 0 |
| ND 2026 | 13 | 0 |
| OH 2025 | 12 | 1 |
| OH 2026 | 12 | 1 |
| OK 2025 | 9 | 4 |
| OK 2026 | 10 | 3 |
| OR 2025 | 12 | 1 |
| OR 2026 | 12 | 1 |
| PA 2025 | 12 | 1 |
| PA 2026 | 12 | 1 |

## Documents fetched (primary sources)

**New Jersey**: Form NJ-1040-ES 2026 Instructions (nj.gov/treasury/taxation/pdf/current/1040esi.pdf); NJ-1040-ES 2025 voucher (nj.gov/njbonds/treasury/taxation/pdf/current/1040es-25.pdf); Form NJ-2210 2025 + Instructions (nj.gov/treasury/taxation/pdf/current/2210.pdf); NJ-2210NR 2025 (nj.gov/treasury/taxation/pdf/current/2210nr.pdf); GIT-8 Estimating Income Taxes, Jan 2026 (nj.gov/treasury/unclaimed-property/treasury/taxation/pdf/pubs/tgi-ee/git8.pdf); N.J.S.A. 36:1-1 from the Legislature's STATUTES-TEXT.zip (pub.njleg.state.nj.us/statutes/STATUTES-TEXT.zip). The 2026 NJ-2210 does not exist yet.

**New Mexico**: TRD Estimated Payments page (tax.newmexico.gov/individuals/file-your-taxes-overview/estimated-payments/); 2025 PIT-ES Instructions (realfile.tax.newmexico.gov/2025pit-es-ins.pdf; the 2026 file path returned 404 and the page says the vouchers are not tax-year specific); 2025 PIT-1 Instructions (realfile.tax.newmexico.gov/2025pit-1-ins.pdf); 2025 PIT-B and PIT-CR instructions downloaded but not read in depth; RLD Financial Institution Holidays 2025 and 2026 notices (rld.nm.gov). FYI-320 (AWS host 502), the penalty-interest-rates page and NMSA 12-5-2 (403) were not read.

**New York**: Instructions for IT-2105 for 2025 (tax.ny.gov/pdf/2025/inc/it2105i_2025.pdf) and 2026 (.../2026/inc/it2105i_2026.pdf); IT-2105.9-I 2025 and IT-2105.9 2025 (.../2025/inc/it2105_9i_2025.pdf, it2105_9_2025_fill_in.pdf); IT-112-R-I 2025 (.../2025/inc/it112ri_2025.pdf); IT-203-I 2025 (.../2025/inc/it203i_2025.pdf); General Construction Law s.24 via WebFetch of nysenate.gov/legislation/laws/GCN/24 (tool returns a model summary, not verbatim text). The 2026 IT-2105.9-I returned 404.

**North Carolina**: NC-40 instructions (ncdor.gov/individual-estimated-income-tax/open, web 7-25); 2025 Form D-422 (ncdor.gov/2025-form-d-422-underpayment-estimated-tax-individuals/open, web 12-25); 2025 D-400 Schedule PN (ncdor.gov/2025-d-400-schedule-pn-web-fill-version/open); NCDOR interest-rate memo Jan-Jun 2026 (ncdor.gov/interest-rate-memo-jan-jun-2026pdf/open); ncdor.gov Nonresidents and Part-Year Residents page; G.S. 105-153.9 and G.S. 103-4 (ncleg.gov).

**North Dakota**: Form ND-1ES 2026 (tax.nd.gov/.../2025-iit/28709-form-nd-1es-2026.pdf) and 2025 (.../2024-iit/28709-form-nd-1es-2025.pdf); N.D.C.C. ch. 57-38 (ndlegis.gov/cencode/t57c38.pdf: ss. 57-38-30.3, 57-38-45, 57-38-62, 57-38-63) and ch. 1-03 (t01c03.pdf).

**Ohio**: 2026 and 2025 Ohio Estimated Income Tax Instructions / IT 1040 ES worksheet (dam.assets.ohio.gov/.../individual/2026/ites-instructions-fi.pdf and .../2025/ites-instructions-fi.pdf); 2025 IT/SD 2210 (dam.assets.ohio.gov/.../2025/itsd2210-fi.pdf); R.C. 1.14, 5703.47, 5747.05, 5747.09 and Ohio Adm. Code 5703-7-04 (codes.ohio.gov). tax.ohio.gov interest-rate pages returned 403/404; the 7% (2026) figure is read from the 2025 IT/SD 2210 text.

**Oklahoma**: OTC Pay Taxes page (oklahoma.gov/tax/individuals/pay-taxes.html); 2025 Resident Income Tax Packet / Form 511 instructions (oklahoma.gov/content/dam/ok/en/tax/documents/forms/individuals/current/511-Pkt.pdf); OW-8-ES General Instructions (digitalprairie.ok.gov/digital/api/collection/forms/id/2734/download; revision year not shown); OAC 710:50-13-6 (law.cornell.edu); SB 1531 (2024) introduced text quoting 25 O.S. s.82.1 (oklegislature.gov). Statutes 68 O.S. 2385.x and 25 O.S. 82.1 were not read as current law (Justia 403, OSCN returned another document). The Form 511-NR instructions and 511-TX were not retrievable.

**Oregon**: 2026 and 2025 Publication OR-ESTIMATE (oregon.gov/dor/forms/FormsPubs/publication-or-estimate_101-026_2026.pdf and _2025.pdf); 2025 Form OR-10 Instructions (.../form-or-10-instructions_101-031-1_2025.pdf); ORS 316.082, 316.587 and 187.010 (oregon.public.law). Publication OR-21-EST (pass-through entity) was fetched by mistake and not used.

**Pennsylvania**: 2026 and 2025 REV-413 (I) (pa.gov/content/dam/copapwp-pagov/en/revenue/documents/formsandpublications/formsforindividuals/pit/documents/2026/2026_rev-413i.pdf and .../2025/2025_rev-413i.pdf); 2025 PA-40 Instructions (.../2025/2025_pa-40in.pdf); 2025 REV-1630A farmers (.../2025/2025_rev-1630a.pdf); REV-1611 (AD+) 11-25 Interest Rate and Calculation Method (.../otherforms/documents/rev-1611.pdf). No primary source for PA legal holidays was reachable.

## Unverified rows and reasons

- **NJ 2026 penalty.rate (0.10)**: only the 2025 NJ-2210 Interest Rate Schedule was read (10.00% for 1/16/26-4/15/26); rates from 4/16/26 (the TY2026 window) are unpublished in anything read.
- **NM 2025/2026 farmer.rule**: instructions call the rule "identical to the federal rule" but state the amount as "the required annual payment"; current_pct 0.9 is a mapping (federal would be 0.6667).
- **NM 2025/2026 nonresident_method (other)**: PIT-B allocation is referenced but the exact computation was not located.
- **NM 2025/2026 holidays**: NMSA 12-5-2 unreachable; list built from the RLD bank-holiday notices and a secondary summary (Indigenous Peoples' Day).
- **NY 2026 penalty.rate (0.095)**: 2026 IT-2105.9-I not found; 9.5% is the last published quarterly rate (Jan 1-Apr 15, 2026). Rule is federal short-term + 5.5 points, minimum 7.5%.
- **NC 2026 penalty.rate (0.07)**: only the Jan-Jun 2026 rate (7%) was read, from an NCDOR local-government memo; the rate for Jul 2026 onward is set by Dec 1, 2026.
- **OH 2025/2026 farmer.rule**: Adm. Code 5703-7-04 requires "payment in full" with no percentage; current_pct 0.9 is a mapping from R.C. 5747.09.
- **OK 2025 installments.due_dates**: June 15, 2025 (Sunday) rolled to June 16 on the strength of 25 O.S. 82.1(C), not read as current law.
- **OK 2025/2026 farmer.rule**: farmers are exempt from estimated payments entirely; mapped as current_pct 0 with due_date/file_by = return due date.
- **OK 2025/2026 nonresident_method (ratio)**: Form 511-NR instructions not retrievable; recorded from memory.
- **OK 2025/2026 holidays**: 25 O.S. 82.1 not readable as current law; built from bill text and summaries.
- **OR 2025/2026 farmer.rule**: farmers/fishermen are exempt from estimated payments entirely; same mapping as OK.
- **PA 2025/2026 holidays**: no primary source reachable (Legal Holiday Law of 1893, 1 Pa.C.S. 1908); federal holidays plus Good Friday from secondary summaries.

## Rules the key set cannot express (all recorded as best mapping; the verified/unverified flag reflects the mapping risk)

- **Exempt farmers (OK, OR)**: no estimated payments required at all; stored as `current_pct = 0` with due/file dates = return due date.
- **NJ safe harbor is 80% (not 90%)**; OK is 70%. Both stored as `current_pct` as read. NJ's NJ-2210 compares payments to the LESSER of 80% current or 100% prior (as do the others).
- **NY high-AGI rule**: threshold is $150,000 ($75,000 if married filing separately); only the $150,000 value is stored. 110% does not apply to farmers.
- **PA safe harbor**: prior-year option is prior-year net PA taxable income x the CURRENT rate (3.07%), not prior-year tax; the 90% test is applied per installment period on actual income. `prior_pct = 1.0` approximates this and the full-year-resident requirement is not representable.
- **PA threshold** is stated by Pennsylvania as an income test ($11,000 / $14,000 of income not subject to withholding) with the equivalent tax figure ($338 / $430); the tax figure is stored.
- **Ohio threshold** is "more than $500", not "at least".
- **Single-rate penalty key vs rates that change mid-window**: NJ (10.75% then 10.00%), NY (quarterly), OH (8% for 2025 days, 7% for 2026 days), OR (9% then 8%), NC (semiannual).
- **Estimated installment catch-up schedules** (late starters), January 31 relief, annualized-income methods: not in the key set.
- **NM penalty rate source** is the IRC rate (stored as `federal`, rate null); NM's 20% maximum penalty on tax is separate.

## Re-check first

1. NY holidays row (General Construction Law s.24 read through WebFetch's summariser, not verbatim; confirm Lincoln's Birthday and general-election-day treatment every year).
2. NC holidays (G.S. 103-4 includes Confederate/Greek dates and Yom Kippur; confirm NCDOR actually uses it rather than the State HR schedule).
3. NJ holidays (N.J.S.A. 36:1-1 is a bills-of-exchange/public-office statute; Lincoln's Birthday excluded under 36:1-1(d); third-Friday Juneteenth).
4. The mappings flagged above (OK/OR farmer exemption, NM/OH farmer current_pct, NM nonresident `other`).
5. Single-rate penalty values for TY2026 (NJ, NY, NC unverified; OH/OR/PA verified only through calendar 2026).
