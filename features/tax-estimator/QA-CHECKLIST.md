# Tax Estimator manual QA script

Each section is run by a person against a seeded test firm before the phase is signed off.
Tick items in the PR / sign-off record, not in this file.

Run the sections in order on a scratch/test firm (D13: never on the production tenant data; never the kisbooks database). Sections 0-10 build on each other; section 11 is the Phase 11 script (summary, compare, PDF).

## 0. Test firm setup
- Firm with a practice tenant and two client tenants (A, B); firm owner, firm staff (write), firm read-only staff, a client (non-staff) user, a second firm's staff user, a portal contact in tenant A (CLIENT_PORTAL_V1 on for A and B), a super admin.
- Books: tenant A company with an S corp (wages, officer wages, owner health insurance, an estimated-tax payment account); tenant B company with a Schedule C business and a rental; a few months reconciled, one not.
- Expected: flag TAX_ESTIMATOR_V1 is OFF everywhere on a fresh DB (Admin > Tenants > Feature Flags card).

## 1. Enabling the flag
- [ ] With the flag OFF on the practice tenant: no Tax Estimator sidebar group; /tax-estimator/taxpayers bounces to the dashboard; API /api/v1/tax-estimator/* returns 403/404.
- [ ] Admin > Tenants > practice tenant > Feature Flags: turn TAX_ESTIMATOR_V1 ON. Staff user reloads: group "Tax Estimator" with Taxpayers appears; collapse/expand works and is remembered; the sidebar "collapse all" collapses it.
- [ ] Read-only staff sees the group (read). Client user and second-firm user never see it. A user with no tax_estimator permission does not.
- [ ] Turn the flag OFF again: group disappears, data is untouched; ON again restores it.
- [ ] A new tenant created afterwards has the flag OFF.

## 2. Taxpayers, persons, links
- [ ] New taxpayer: display name, filing status, resident state (two letters; "Missouri" is rejected with "Use a two-letter state code"). Created and listed; a staff user with several firms must pick a firm.
- [ ] List: search by taxpayer and by person name; filter by filing status and state; Clear filters; empty states ("No taxpayers yet" / "No taxpayers match").
- [ ] Taxpayer page: edit details, Save details; Safe-harbor rule and Client portal shows select Firm default or an override; read-only staff sees fields disabled.
- [ ] Persons: add primary + spouse; only one primary; future date of birth rejected; SEHI month checkboxes plus All months / No months.
- [ ] Links: add a link for the S corp (tenant A) and the Sch C + rental (tenant B) -- one taxpayer across two client tenants. Company picker lists only companies in clients the firm manages and the user can access.
- [ ] Link form: profit/loss/capital %, partner SE status for a partnership, activity type, active participation on a rental, QBI override requires a reason, allowed-loss override requires a reason. Percent totals notice appears when a company's profit % does not total 100.
- [ ] Archive: confirm dialog; archived taxpayer leaves the default list.
- [ ] Isolation: second firm's staff cannot open the taxpayer by URL (not found); a user who lost access to tenant B sees that link as "no longer managed by your firm" and cannot see its figures.

## 3. Entity tax setup
- [ ] Open from a link: entity type derived from the Trial Balance profile (Automatic); override works and explains the profile wins when set.
- [ ] Tax method override, state sourcing, SSTB, rental-is-trade-or-business, large corporation, Farmer / Not a farmer; Save tax profile persists after reload.
- [ ] Year inputs: W-2 wages override requires a reason; UBIA blank shows the "UBIA limb not computed" notice; values with more than 4 decimals are rejected.
- [ ] GL tax treatment table: filters (status, search), Suggested / Mapped / None / Unmapped with activity badges, tax effect select, person picker for owner items, Non-recurring toggle, Discard. Suggestions banner: nothing is applied until accepted; Dismiss works.
- [ ] Rivera check: the S corp profit moves from 115,400 to 128,000 after treatments are applied (see docs/reference-calc).
- [ ] Read-only user sees the table without edit controls. A treatment mapped by another firm sharing the books is read-only with its note.
- [ ] Readiness panel and Through month selector list unreconciled accounts, suspense, unmapped accounts.

## 4. Annual settings
- [ ] Tax year selector; "Year not set up" offers Create; creating a year with no parameters shows the provisional notice later.
- [ ] Year inputs: deduction method (automatic / standard forced / itemized forced), federal method (bracket / effective-rate override with a rate), credits, withholding, HSA coverage, Schedule 1-A per person (needs persons first), prior-year tax and AGI.
- [ ] Prior-year AGI above $150,000 (above $75,000 MFS) shows the 110% note. Values persist after reload and are not visible in plain text via the API list (encrypted; D9).
- [ ] States: exactly one resident state (validation message), other states with effective rates, other-state credit override, state withholding "STATE=amount" format.
- [ ] Firm settings dialog: safe-harbor default (lesser of / current year / prior year), disclaimer text, Client portal shows (Live / Latest snapshot). Only firm admins/owners with write rights can save.

## 5. Scenarios and adjustments
- [ ] Scenario tabs: clone Base (name it), rename, delete; Base cannot be deleted or renamed away; clone disabled at the scenario cap.
- [ ] Adjustment editor: label, amount, person or household, cadence, start/end month (end before start rejected), percent applied, memo, Non-recurring, Run-rate from GL fills an amount. Edit and delete with confirmation.
- [ ] Allocation strip: adjustments are spread evenly across remaining quarters.
- [ ] Adjustments in one scenario do not change another scenario.

## 6. Estimate summary
Run the Phase 11 script (section 11) for the full screen-by-screen steps. In addition:
- [ ] Rivera base total equals the oracle total in docs/reference-calc/rivera_expected.json (base total 43,732 per PROGRESS.md) when the Rivera fixture is loaded.
- [ ] Changing a treatment, adjustment or payment changes the estimate on Refresh; changing "Actuals through" changes YTD columns.
- [ ] Unverified parameter/state rule warnings show; Admin override of one flips its status in the trace.

## 7. Payments, snapshots, finalize
- [ ] Payments ledger: GL-derived row (the estimated-tax account) read-only; add/edit/delete a manual payment; read-only staff has no controls.
- [ ] Finalize & issue vouchers: dialog with optional note; confirms "Snapshot saved"; appears in Snapshots with scenario/date/reason/note.
- [ ] Snapshot view: figures, Assumptions list, Voucher schedule match what was on screen at finalize time. No edit/delete controls; direct API PATCH/DELETE returns 409 TE_SNAPSHOT_IMMUTABLE.
- [ ] Change an input afterwards: live moves, snapshot does not. Compare with live lists changed figures, warning changes, parameter/state-rule changes; with nothing changed it says "No figures changed".
- [ ] Download PDF twice the same day with no change: one PDF snapshot reused (not two).
- [ ] Snapshot containing a client the viewer lost access to: not viewable ("includes a client you can no longer reach").

## 8. Report Pack
- [ ] Reports > Report packs: for a linked company, add the "Tax Estimate" section (group Tax). Taxpayer picker lists only taxpayers linked to that company; optional scenario.
- [ ] Generate: the pack PDF includes the tax estimate pages; as-of date sets actuals-through; a snapshot with reason "report pack" is created.
- [ ] A non-staff user cannot add or generate the section; a pack run requested by someone without access renders the section as unavailable, not as data.
- [ ] Pack for an unlinked company: section shows no choices / explanatory message.

## 9. Client portal (phone width, 375px, and desktop)
- [ ] Taxpayer > Portal contacts > Add contact: only contacts in managed clients are offered. Added contact is listed but the "Estimates access" badge is absent until the toggle is on.
- [ ] Practice > Client Portal > contact > company permissions: tick "Tax estimates". Badge appears. Client users cannot set it.
- [ ] Portal home shows the "Tax estimate" tile only when all conditions are met; the tile is absent with the toggle off, the flag off on the client tenant, or no link.
- [ ] Portal page (phone): no horizontal scroll; projected total, next payments with due dates, Past due badge when late, paid/withheld, payments on record, disclaimer; "as of" label for live, "prepared" for snapshot.
- [ ] Download payment vouchers returns a PDF with only the client-safe content.
- [ ] Client never sees persons, other owners, adjustments, trace, parameters, safe-harbor workings or prior-year figures (inspect the network response too).
- [ ] Switch Client portal shows to Latest snapshot: portal shows the finalized snapshot, or "No tax estimate shared yet" before one exists.
- [ ] Remove the contact: access is revoked; a different contact or another firm's taxpayer id returns not found.
- [ ] Flag OFF on the client tenant: page says estimates are not enabled; dashboard tile hidden.

## 10. Super-admin parameters and state rules
- [ ] Admin > Tax parameters: year selector, search, jurisdiction filter, Missing keys list, status, citation, source and Shipped value columns.
- [ ] Override a parameter: value in the right units, Reason required, saved toast; the estimate uses it; Revert returns to shipped. Override is audited (Admin > audit).
- [ ] Create a tax year from the page; Missing keys shows what is not seeded.
- [ ] States view: All states / status filter / search; No income tax rows; Complete / Partial / Missing; override and revert a state rule (JSON array values accepted only as arrays).
- [ ] Firm owner and staff cannot open Admin > Tax parameters or the admin API.
- [ ] Restart the API: shipped values re-sync, overrides remain.

## 12. Cross-cutting
- [ ] Knowledge Base: Help > category "Tax Estimator" shows nine articles; the chat assistant answers "what is the tax estimator" from the curated knowledge.
- [ ] Rollback: on a scratch DB apply 0201 (or its renumbered file) then its .rollback.sql; the tax_est_* tables, tax_parameters and report_pack_runs.allow_tax_estimate / requested_by are removed and the app still boots with the flag row absent.
- [ ] License headers and migration policy scripts pass.

## 11. Phase 11 — Estimate summary, scenario compare, PDF

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
