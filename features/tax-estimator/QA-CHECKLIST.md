# Tax Estimator manual QA checklist

Each section is run by a person against a seeded test firm before the phase is signed off.
Tick items in the PR / sign-off record, not in this file.

## Phase 11 — Estimate summary, scenario compare, PDF

Setup: `TAX_ESTIMATOR_V1` ON for the firm's practice tenant, a firm staff user, a firm read-only user, a client (non-staff) user, a second firm's staff user. A taxpayer with the Rivera fixture linked (S corp, Sch C, LP rental), tax year 2026, a Base scenario plus "Buy truck in December" and "Raise Maria's wages".

### Access and navigation
- [ ] Staff user: Tax Estimator group shows in the sidebar; Taxpayers > Rivera shows "Tax estimate" and "Scenarios" links; both open.
- [ ] Section tabs (Summary, Annual settings, Scenarios, Payments) navigate and the active tab is underlined; Payments scrolls to the ledger.
- [ ] Client user and a user with the flag OFF: deep link to `/tax-estimator/taxpayers/<id>/estimate` bounces to the dashboard.
- [ ] Second firm's staff cannot open Rivera's estimate or PDF by URL (not found / error, no data).

### Summary screen
- [ ] "Actuals through" defaults to the last closed month, labelled as such; choosing a later, unreconciled month shows the amber warning.
- [ ] Scenario select changes the figures and the URL (`scenario=`); reload keeps it.
- [ ] Readiness banner lists unreconciled accounts by entity and account, suspense, unmapped accounts, out-of-scope links, unverified/provisional parameters and unverified state rules; each entity item links to Entity tax setup. Clean books show the green "no issues" banner.
- [ ] Missing-year fallback (use a year with no parameters): banner says values are provisional.
- [ ] Key figures: projected total (federal / state), paid & withheld, next federal payment with date and days away (or overdue), marginal rate with effective rate subline.
- [ ] Calculation table: YTD tax-basis column is filled for income lines only; projected column everywhere; there is no "period tax" column.
- [ ] Inline chips: SEP "Capped at limit" in the truck scenario, "Passive loss suspended", "Rules unverified" on the unverified state, nonresident row carries the effective-rate wording.
- [ ] Trace on Regular income tax opens the drawer with bracket rows (label, amount, formula, source, marginal rate); Esc and the close button dismiss it; focus returns sensibly.
- [ ] Safe-harbor card shows BOTH rules (90% current and 100/110% prior), the recommended one outlined, the rule badge with its source, required / withholding / paid / remaining. Prior-year unavailable shows the reason.
- [ ] Voucher table per jurisdiction tab: due dates, Regular, Sch AI (bold where it lowers the installment), W-2 credit, from estimates, paid, remaining, penalty, status, Pay now (catch-up) amounts. A state with no regime shows "none required".
- [ ] Payments ledger: GL rows read-only with account/company; add a manual payment (date + amount required), edit it, delete it with confirmation; the estimate figures refresh. Read-only user sees no add/edit/delete.
- [ ] Farmer and C corp cases (when their fixtures exist) render their own summary cards.
- [ ] Warnings list matches the warnings the API returned; footer shows the firm disclaimer, parameter/rule status and engine version.
- [ ] Error: break a parameter (remove a key in a scratch DB) and confirm the message names the missing key and Try again works.

### Scenario compare
- [ ] Up to three pickers (A required, B and C optional); duplicates are disabled; selection survives reload.
- [ ] Cards show total, change vs. the first scenario (minus = lower, green), bar, next federal payment or overpaid amount.
- [ ] Line-by-line table includes marginal federal rate and federal safe-harbor required rows; "capped at limit" shows on the truck scenario; the change toggle hides/shows deltas.
- [ ] Clone (disabled at the scenario cap), Rename, Delete (never Base) work from the Scenarios page and the pickers refresh.
- [ ] Only one scenario: prompt to clone Base is shown.

### PDF
- [ ] "Print / Download PDF" on the summary downloads `tax-estimate-2026-<name>.pdf`; the file opens, lists summary, federal, state, safe harbor, vouchers, warnings, assumptions placeholder and the firm disclaimer; figures equal the screen.
- [ ] Per-scenario "Download PDF" on the compare cards works; a failed download shows an inline error.
- [ ] Read-only staff can download; another firm's user gets an error.

### Responsive and states
- [ ] 375px width: no horizontal page scroll; tables scroll inside their cards; controls wrap; drawer fits.
- [ ] Every page shows a spinner while loading, an error with retry on failure, and an explanatory empty state (no year, no linked entities, no payments).
