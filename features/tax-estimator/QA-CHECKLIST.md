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
- [ ] (QA D2) A firm staff member whose ACTIVE-tenant role is `readonly` sees the group and the read-only screens (no New taxpayer, Save, Finalize or other write controls; `GET /tax-estimator/scope` returns `canWrite: false`); their write calls are 403.
- [ ] Turn the flag OFF again: group disappears, data is untouched; ON again restores it.
- [ ] A new tenant created afterwards has the flag OFF.

## 2. Taxpayers, persons, links
- [ ] New taxpayer: display name, filing status, resident state picked from a list of the 51 jurisdictions ("MO · Missouri"; there is no free-text box, so "Missouri" can never become MI). The API rejects an unknown code (`residentState: "ZZ"` → 400 "Use a two-letter state code …"). Created and listed; a staff user with several firms must pick a firm.
- [ ] List: search by taxpayer and by person name; filter by filing status and by state (column filters); Clear filters; empty states ("No taxpayers yet" / "No taxpayers match").
- [ ] Taxpayer page: edit details, Save details; Safe-harbor rule and Client portal shows select Firm default or an override; read-only staff sees fields disabled.
- [ ] Persons: add primary + spouse; only one primary; future date of birth rejected; SEHI month checkboxes plus All months / No months.
- [ ] Links: add a link for the S corp (tenant A) and the Sch C + rental (tenant B) -- one taxpayer across two client tenants. Company picker lists only companies in clients the firm manages and the user can access.
- [ ] Link form: profit/loss/capital %, partner SE status for a partnership, activity type, active participation on a rental, QBI override requires a reason, allowed-loss override requires a reason. Percent totals notice appears when a company's profit % does not total 100: once below the table, naming the company (QA D17); active participation shows in Notes.
- [ ] Archive: confirm dialog; archived taxpayer leaves the default list.
- [ ] Isolation: second firm's staff cannot open the taxpayer by URL (not found); a user who lost access to tenant B sees that link as "no longer managed by your firm" and cannot see its figures.

## 2a. Taxpayer visibility (D17)
Setup: firm admin A (access to the practice tenant only); staff S1 with access to client tenant 1; staff S2 with access to client tenant 2 only; staff S3 with access to the practice tenant only; read-only staff R with access to client tenant 1. Taxpayer T linked to companies in client tenants 1 and 2.
- [ ] Firm settings (admin): "Staff see only taxpayers linked to clients they can access" is ON by default with its explanation. Staff and read-only users cannot change it (API PUT `/firm-settings` → 403 `TE_FIRM_ADMIN_REQUIRED`).
- [ ] Switch ON: S1 and S2 both see T (S2's view of the tenant-1 link says "no longer managed by your firm" / no figures from it — partial view). S3 does not see T in the list (the count excludes it) and opening it by URL shows "Taxpayer not found" (404 `TE_TAXPAYER_NOT_FOUND`, the same as another firm's taxpayer). Admin A and a super admin (with the firm chosen) see every taxpayer.
- [ ] Unlinked taxpayer created by S3: S3 sees it; S1 does not; admin A does. After S1 (or an admin with access) links it to client tenant 1, S3 no longer sees it.
- [ ] Switch OFF (admin): S3 sees every firm taxpayer; ON again restores the rule. Audit: a `tax_est_visibility_switch` row per change (before/after flag only).
- [ ] Taxpayer page, "Who can see this taxpayer" card: admin adds S1 → the list shows a lock beside T; S2 and R no longer see T (404 by URL), S1 does; admin and super admin still do. Staff and read-only users see the card read-only ("Only a firm administrator can change this list."); API PUT `/staff` from them → 403, from S3 (cannot see T) → 404.
- [ ] The picker lists only active firm staff / read-only members with Tax Estimator access (no firm admins, no other firm's users); adding anyone else via the API → 422 `TE_STAFF_NOT_ELIGIBLE`. Remove and "Allow everyone" work; each change writes one `tax_est_taxpayer_staff` audit row with user ids only.
- [ ] A staff-list member who reaches no linked client still cannot see T while the switch is ON.
- [ ] Hidden taxpayer everywhere: estimate, readiness, payments, PDF, snapshots (history, view, compare, re-print by snapshot id), scenarios / adjustments / payments by id → 404 for the hidden user.
- [ ] Report Pack (inside client tenant 1's company): the Tax Estimate section's taxpayer choices omit T for a user who may not see it; the ad-hoc PDF for T → 404; a pack run requested by them renders without the section's PDF (worker re-check). The register NR flag still works for them (it is entity data) but names no hidden taxpayer.
- [ ] Client portal unchanged: a contact mapped to T still sees T's estimate whatever the staff list says.

## 3. Entity tax setup
- [ ] Open from a link: entity type derived from the Trial Balance profile (Automatic); override works and explains the profile wins when set.
- [ ] Tax method override, state sourcing, SSTB, rental-is-trade-or-business, large corporation, Farmer / Not a farmer; Save tax profile persists after reload.
- [ ] Year inputs: W-2 wages override requires a reason; UBIA blank shows the "UBIA limb not computed" notice; values with more than 4 decimals are rejected.
- [ ] GL tax treatment table: filters (status, treatment), account search box, Suggested / Mapped / None / Unmapped with activity badges, tax effect select, person picker for owner items, Non-recurring toggle, Discard. Suggestions banner: nothing is applied until accepted; Dismiss works and stays dismissed after a reload (per browser; a changed suggestion shows again).
- [ ] Suggestions (QA D15): "Entertainment" → Nondeductible 100% (§274(a)); "Meals" → 50%; "Meals & Entertainment" → 50% with a note to split out the entertainment.
- [ ] A company with no TB profile shows the entity-type notice once (no duplicate-key console error); an empty treatment table explains it lists accounts with activity in the range.
- [ ] Rivera check: the **Sch C company (Rivera Plumbing)** profit moves from book 115,400 to tax-basis 128,000 after treatments are applied (see docs/reference-calc).
- [ ] Read-only user sees the table without edit controls. A treatment mapped by another firm sharing the books is read-only with its note.
- [ ] Readiness panel and Through month selector list unreconciled accounts, suspense, unmapped accounts; the Through month input shows the month in use (not blank).

## 3a. Non-recurring flag on a transaction (register / transaction detail)
Setup: TAX_ESTIMATOR_V1 ON for the CLIENT tenant (the flag is evaluated on the tenant you are working in); switch into client tenant B as firm staff; the Sch C company is linked to the taxpayer, a second company in B is not.
- [ ] Open a transaction of the linked company (Transactions or a register row): a **Tax Estimator** card shows "Recurring" and the linked taxpayer name; **Mark non-recurring** turns it to "Non-recurring" (counted once, not run-rated). Reload: the state persists.
- [ ] The account register shows an **NR** badge beside the type of that transaction (hover title explains it). **Mark recurring** removes the card state and the badge.
- [ ] Estimate summary (Refresh): the flagged amount is no longer projected forward (Entity tax setup preview: non-recurring line); unflagging restores the run-rate.
- [ ] Admin audit: a `tax_est_treatment` row with `kind: transaction_flag` per change (create / delete), tagged with the firm.
- [ ] Transaction of the unlinked company, a NULL-company transaction, flag OFF on the client tenant, a client (non-staff) user, a user whose firm does not manage the tenant: no card and no badges (API: 404 for no access; PUT on an unlinked company 409 `TE_COMPANY_NOT_LINKED`).
- [ ] Firm read-only staff: card shows the state without the button; API PUT returns 403.

## 4. Annual settings
- [ ] Tax year selector; "Year not set up" offers Create; creating a year with no parameters shows the provisional notice later.
- [ ] Year inputs: deduction method (automatic / standard forced / itemized forced), federal method (bracket / effective-rate override with a rate), credits, withholding, HSA coverage, prior-year tax and AGI.
- [ ] Schedule 1-A (Deductions card): chips read "Senior · <names> 65+" (or "none 65+", from each person's date of birth), "Tips · $", "Overtime · $", "Car loan interest · $". **Edit Schedule 1-A** opens the dialog: per person tips / overtime / car-loan interest, the senior line says 65 or older / under 65 / no date of birth. "3,700" or a negative is rejected (Apply disabled); Apply updates the chips, Cancel / Esc discards; values persist only after **Save annual settings** and round-trip after reload. No people → the dialog says to add them first. Read-only staff gets **View Schedule 1-A** (inputs disabled, Close only).
- [ ] MFS taxpayer: the chips row and the dialog both say Schedule 1-A is not allowed when married filing separately; the estimate's Schedule 1-A line stays 0 with amounts entered.
- [ ] Prior-year AGI above $150,000 (above $75,000 MFS) shows the 110% note; at or below it the note is absent (QA D28). Values persist after reload and are not visible in plain text via the API list (encrypted; D9). Stored amounts edit as plain numbers ("8000", not "8000.0000").
- [ ] States: exactly one resident state (validation message), states chosen from the jurisdiction list, other states with effective rates, other-state credit override, state withholding "STATE=amount" format (the error is announced on the field: aria-invalid / aria-describedby). Every control on the page has an accessible name (farmer/fisherman inputs included).
- [ ] Firm settings dialog: safe-harbor default (lesser of / current year / prior year), disclaimer text, Client portal shows (Live / Latest snapshot). Only firm admins/owners with write rights can save.

## 5. Scenarios and adjustments
- [ ] Scenario tabs: Clone asks for the copy's name (prefilled "Copy of …"); rename and delete non-base scenarios; Base has no Rename or Delete (API: rename/delete Base → 422 `TE_BASE_SCENARIO_PROTECTED`); clone disabled at the scenario cap. After a delete the page does not request the deleted scenario again (no 404s in the network log).
- [ ] Adjustment editor: label, amount, **Entity** (the taxpayer's links for the year), person or household, cadence, start/end month (end before start rejected), percent applied, memo, Non-recurring, Run-rate from GL fills an amount. Edit and delete with confirmation.
- [ ] (QA D1) "Vehicle purchase (§179)" and "Depreciation (tax vs book)" require an entity: Save stays disabled with "Choose the business this deduction belongs to …" until one is picked (API without `linkId` → 422 `TE_ADJUSTMENT_LINK_REQUIRED`). Picking Rivera Plumbing fills the person from the link. With the truck linked, the estimate lowers Sch C profit, SE tax, QBI and AGI and the SEP line shows "Capped at limit". Owner health insurance / SEP / HSA / catch-up offer no entity (API with `linkId` → 422 `TE_ADJUSTMENT_LINK_NOT_ALLOWED`). An older unlinked §179 row is flagged in the grid.
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
- [ ] Change an input afterwards: live moves, snapshot does not. Compare with live lists changed figures (each line once; "Federal required annual payment" appears once), warning changes, parameter/state-rule changes; with nothing changed it says "No figures changed".
- [ ] Download PDF twice the same day with no change: one PDF snapshot reused (not two).
- [ ] Snapshot containing a client the viewer lost access to: not viewable ("includes a client you can no longer reach").

## 8. Report Pack
- [ ] Reports > Report packs: for a linked company, add the "Tax Estimate" section (group Tax). Taxpayer picker lists only taxpayers linked to that company; then an optional **Scenario** select (Base by default; the year's other scenarios).
- [ ] (QA D9) With TAX_ESTIMATOR_V1 ON only on the firm's practice tenant (not on the client tenant), switch into the linked client company: the section is offered (the flag counts when it is ON in the pack's tenant or in another tenant of the same firm in your scope). With the flag OFF everywhere in the firm, it is absent.
- [ ] Generate: the pack PDF includes the tax estimate pages; as-of date sets actuals-through; a snapshot with reason "report pack" is created.
- [ ] A non-staff user cannot add or generate the section; a pack run requested by someone without access renders the section as unavailable, not as data.
- [ ] Pack for an unlinked company: section shows no choices / explanatory message.

## 9. Client portal (phone width, 375px, and desktop)
- [ ] Taxpayer > Portal contacts > Add contact **from the practice tenant**: the picker lists the active contacts of the taxpayer's linked client companies ("Name — Company"), never another firm's; an empty list explains why. Added contact is listed but the "Estimates access" badge is absent until the toggle is on. Remove asks for confirmation (it revokes access).
- [ ] Practice > Client Portal > contact > company permissions: tick "Tax estimates". Badge appears. Client users cannot set it.
- [ ] Portal home shows the "Tax estimate" tile only when all conditions are met; the tile is absent with the toggle off, the flag off on the client tenant, or no link.
- [ ] Portal page (phone): no horizontal scroll; projected total, next payments with due dates, Past due badge when late, paid/withheld, payments on record, disclaimer; "as of" label for live, "prepared" for snapshot.
- [ ] (QA D12) "Next payments · due …" is the next UPCOMING due date (with any earlier unpaid amount included), never a past date; past-due installments stay in the list with "Past due". An installment covered by withholding says "Covered by withholding or earlier payments" (not "Nothing paid yet" beside "Paid"); paid dates show the year. The voucher PDF's "Next payment" matches.
- [ ] (QA D13) A payment dated after today (Rivera books one on 2027-01-15) is not counted as paid in the live portal view and is not listed under "Payments on record"; the staff "Paid & withheld to date" tile leaves it out and says "$X dated after today not included".
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
- [ ] (QA D6) Override MO `installments.pcts` with "0.25": refused before saving ("must add up to 100%"); "0.5, 0.5" against four due dates is refused ("has 2 entries but installments.due_dates has 4 …"). The dialog shows the due dates beside the percentages; editing both saves them together. API without the partner → 400 `TE_STATE_RULE_INVALID` (federal: `TE_PARAM_INVALID`, also for `ccorp.installment_pcts` / months). Reverting one half also reverts an overridden partner that would no longer line up. MO estimates keep working throughout.
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
- [ ] Section tabs (Summary, Annual settings, Scenarios, Payments) navigate and the active tab is underlined; Payments scrolls to the ledger and keeps `?through=`.
- [ ] Client user and a user with the flag OFF: deep link to `/tax-estimator/taxpayers/<id>/estimate` bounces to the dashboard.
- [ ] Second firm's staff cannot open Rivera's estimate or PDF by URL (not found / error, no data).

### Summary screen
- [ ] "Actuals through" defaults to the last closed month, labelled as such; choosing a later, unreconciled month shows the amber warning.
- [ ] Scenario select changes the figures and the URL (`scenario=`); reload keeps it.
- [ ] Readiness banner lists unreconciled accounts by entity and account, suspense, unmapped accounts, out-of-scope links, unverified/provisional parameters and unverified state rules; each entity item links to Entity tax setup; one item per issue, for the selected "Actuals through" month (QA D20). Clean books show the green "no issues" banner.
- [ ] Missing-year fallback (use a year with no parameters): banner says values are provisional.
- [ ] Key figures: projected total (federal / state), paid & withheld, next federal payment with date and days away (or overdue), marginal rate with effective rate subline.
- [ ] Calculation table: YTD tax-basis column is filled for income lines only; projected column everywhere; there is no "period tax" column.
- [ ] Inline chips: SEP "Capped at limit" in the truck scenario, "Passive loss suspended", "Rules unverified" only on a state whose used rules are not all verified ("Verify" for other review reasons, QA D18), nonresident row carries the effective-rate wording.
- [ ] Trace on Regular income tax opens the drawer with one row per bracket reached ("Bracket 2: 24,800 to 100,800 at 0.12", slice × rate, marginal rate) and the total; amounts in formulas are formatted (no long decimals); Esc and the close button dismiss it and focus returns to the Trace button.
- [ ] Safe-harbor card shows BOTH rules (90% current and 100/110% prior), the recommended one outlined (under "lesser of", the lower available amount, QA D8), the rule badge with its source, required / withholding / paid / remaining. Prior-year unavailable shows the reason. (The "Q4 under the other rule" line is not in v1: the engine result does not carry it.)
- [ ] Self-employment tax by person: one tile per person with SE tax, SE income and the ½ SE tax deduction (Rivera: Daniel $18,086 / SE income per the oracle; Maria $0 "No self-employment income · wages …"). Additional Medicare shows once, as the household Form 8959 figure, only when non-zero. No people → explanatory empty text.
- [ ] Voucher table per jurisdiction tab: due dates, Regular, Sch AI (bold where it lowers the installment), W-2 credit, from estimates, paid, remaining, penalty, status, Pay now (catch-up) amounts. A state with no regime shows "none required".
- [ ] Payments ledger: GL rows read-only with account/company; add a manual payment (date + amount required), edit it, delete it with confirmation; the estimate figures refresh. Read-only user sees no add/edit/delete.
- [ ] Farmer and C corp cases (when their fixtures exist) render their own summary cards.
- [ ] Warnings list matches the warnings the API returned, in readable form (no raw JSON rate tables, "more than $1,000" not "more_than", no "AR: AR:", grouped numbers; the PDF matches); footer shows the firm disclaimer, parameter/rule status and engine version.
- [ ] Error: break a parameter (remove a key in a scratch DB) and confirm the message names the missing key and Try again works.

### Scenario compare
- [ ] Up to three pickers (A required, B and C optional); duplicates are disabled; selection survives reload.
- [ ] Cards show total, change vs. the first scenario (minus = lower, green), bar, next federal payment or overpaid amount.
- [ ] Line-by-line table includes marginal federal rate and federal safe-harbor required rows; "capped at limit" shows on the truck scenario; the change toggle hides/shows deltas.
- [ ] Clone (disabled at the scenario cap), Rename, Delete (never Base) work from the Scenarios page and the pickers refresh.
- [ ] Only one scenario: prompt to clone Base is shown.

### PDF
- [ ] "Print / Download PDF" on the summary downloads `tax-estimate-2026-<name>.pdf`; the file opens, lists summary, federal, state, safe harbor, vouchers, warnings, assumptions placeholder and the firm disclaimer; figures equal the screen.
- [ ] Per-scenario "Download PDF" on the compare cards works and each file carries its scenario (`tax-estimate-2026-<name>-<scenario>.pdf`; Base keeps the plain name); a failed download shows an inline error.
- [ ] Read-only staff can download; another firm's user gets an error.

### Responsive and states
- [ ] 375px width: no horizontal page scroll (the Refresh / Print / Snapshots / Finalize row wraps); tables scroll inside their cards; controls wrap; drawer fits.
- [ ] Every page shows a spinner while loading, an error with retry on failure, and an explanatory empty state (no year, no linked entities, no payments).
