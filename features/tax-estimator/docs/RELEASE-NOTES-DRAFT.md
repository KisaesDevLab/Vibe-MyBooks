# Tax Estimator -- release notes (DRAFT)

Branch `feat/tax-estimator`. Flag `TAX_ESTIMATOR_V1`, OFF by default.

## What's new (user-facing)

The Tax Estimator gives your firm a running estimate of a household's federal and state income tax and its quarterly payment vouchers, built from the books of every client company the household owns.

- **Taxpayers** (Tax Estimator > Taxpayers): a household with its people and the companies each one owns, even across different client books.
- **Entity tax setup**: tell the estimator how each company is taxed and how each profit and loss account should be treated. Suggestions are never applied automatically.
- **Annual settings**: deductions, credits, withholding, Schedule 1-A, HSA, prior-year figures (stored encrypted) and state rows.
- **Scenarios and adjustments**: compare up to three scenarios side by side ("buy a truck in December").
- **The estimate**: federal (brackets, self-employment tax, QBI, Medicare surtaxes, NIIT, loss limits, the $25,000 rental allowance), 51 jurisdictions' state rules, a trace for every line, warnings, and a readiness banner for unreconciled or unmapped books.
- **Safe harbor, Schedule AI, vouchers and penalty**: both safe-harbor rules side by side, annualized installments, catch-up amounts and an estimated underpayment penalty.
- **Snapshots**: finalize and freeze an estimate; compare it with live later.
- **PDF and Report Pack**: download a PDF, or add the "Tax Estimate" section to a Report Pack.
- **Client portal**: a read-only estimate and voucher download per client contact, controlled by a per-company "Tax estimates" toggle.
- **Admin > Tax parameters**: super admins maintain federal parameters and state rules with audited overrides.

It is an estimate, not tax advice. Version 1 limits (even quarterly allocation, no QBI loss carryforward, effective-rate nonresident tax, SEP assumed, unmodeled compounding state penalties and C corporation short years) are listed in the Help article "Tax Estimator -- what it is and what it is not" and on every snapshot's assumptions. Some tax parameters and state rules are still marked unverified; they are used with warnings until a CPA verifies them.

## Operator notes

- **Flag**: `TAX_ESTIMATOR_V1` is OFF for every existing and new tenant. Nothing changes for anyone until an administrator turns it on.
- **How to enable**: Admin > Tenants > the firm's practice tenant > Feature Flags > TAX_ESTIMATOR_V1. For the portal view also enable it (with CLIENT_PORTAL_V1) on each client tenant, then tick **Tax estimates** for the contact's company at Practice > Client Portal and link the contact on the taxpayer page.
- **Migration**: one consolidated, additive migration, currently `0201_tax_estimator.sql` with `0201_tax_estimator.rollback.sql`. **The number must be reassigned to the next free journal index when the branch merges to main** (rename both files and fix the `meta/_journal.json` entry); re-run `scripts/check-migration-policy.sh`. It creates the `tax_est_*` tables, `tax_parameters`, `state_estimate_rules` tables, snapshot immutability trigger, adds `allow_tax_estimate` and `requested_by` to `report_pack_runs`, and seeds an OFF flag row per tenant.
- **No backfill**: no existing data is read, rewritten or migrated. Parameters and state rules are seeded from code at startup (idempotent, overrides preserved).
- **Rollback**: stop the app, apply `NNNN_tax_estimator.rollback.sql` (drops everything above, children first), then deploy the previous image. Snapshots and taxpayers are lost on rollback; export PDFs first if needed. Because the flag defaults OFF, disabling the flag is the first, non-destructive rollback step.
- **Encryption**: prior-year tax/AGI columns are `*_encrypted` and are covered by the credential re-encryption sweep and cross-host restore recovery.
- **Permissions**: staff need the `tax_estimator` permission; the module is firm-staff only; super admin only for Admin > Tax parameters.
- **Before relying on it**: have a CPA verify the parameters/state rules marked unverified (PROGRESS.md sign-off checklists), especially MO and AR.
- **Knowledge base**: nine Help articles (category "Tax Estimator") and `curated/47-tax-estimator.md`; `app-knowledge.json` and `app-knowledge-prompt.md` were regenerated.

## Dependents and dependent credits (Q44, engine 1.0.0-rc.4)

User-facing:
- **Dependents** card on the taxpayer page (name, date of birth, relationship, qualifying child / relative, months lived with the taxpayer, student, disabled, first / last tax year). No Social Security number is collected.
- **Child and dependent care expenses paid** on Annual settings; the manual credit fields are now **Other nonrefundable / Other refundable credits** (credits not tied to dependents).
- The estimate computes the **child tax credit** (with the phase-out), the **credit for other dependents**, the refundable **additional child tax credit** and the **child and dependent care credit** (2026 OBBBA percentages), each with its own line and trace, in the calculation view, the PDF and the Schedule AI / safe-harbor figures. Warnings when the earned income credit may apply and when a single filer with a qualifying child may qualify as head of household.
- **State personal / dependent exemptions and exemption credits** for the resident state (all 41 income-tax states and DC), e.g. Arkansas's $29 credits, Georgia's dependent exemption, Missouri's head-of-household exemption. Phase-outs are not modelled and say so.
- The assumptions page lists the dependents by initials and age group (no date of birth).

Operator notes:
- Migration `0204_tax_est_dependents.sql` (+ rollback; part `parts/dependents.sql`): new table `tax_est_dependents`, new column `tax_est_years.care_expenses` (default 0). Additive; estimates without dependents or care expenses are unchanged.
- New federal parameters (group "Credits", 2025 and 2026) and the state rule `exemptions` (84 rows) arrive through the startup seed re-sync, all **unverified** — Kurt verifies them in Admin > Tax parameters.
- Live estimates for a taxpayer with dependents, care expenses or a resident state with exemptions change on the first request after deploy (engine version 1.0.0-rc.4 re-keys the cache). Frozen snapshots are untouched.

## Businesses outside MyBooks (Q45, engine 1.0.0-rc.5)

User-facing:
- **Outside businesses** card on the taxpayer page (next to Entity links) for businesses whose books are not in MyBooks: K-1s, a spouse's practice, a farm kept elsewhere. The business (name, Schedule C / F, S corporation, partnership or C corporation, owner, profit / loss %, activity type, partner SE status, officer, QBI / SSTB, state sourcing) carries forward; the amounts are entered per tax year.
- Each year chooses **Full-year projection** (used as entered) or **Year to date** through a month (projected like the books), and whether the amounts are the **entity total** (allocated by the owner %) or the **owner's share** (e.g. a K-1; the % is informational).
- Outside businesses get the full treatment (self-employment tax, QBI deduction, passive and excess-business-loss limits, NIIT, state sourcing); a C corporation is estimated at the entity level. The Calculation view, the PDF and the assumptions page mark them "Outside MyBooks · entered"; an owner's-share entry shows the owner's line "(K-1 share, N% owned)". The client portal shows only the totals, as before.

Operator notes:
- Migration `0206_tax_est_outside_entities.sql` (+ rollback; part `parts/outside-entities.sql`; journal idx 206, `when` 1784800000280 — 0205 belongs to the AI parameter-check branch): new tables `tax_est_outside_entities` and `tax_est_outside_entity_years`. Additive; estimates without outside businesses are unchanged to the cent.
- Engine 1.0.0-rc.5 and estimate cache version `te-estimate-v5` re-key every live estimate once on deploy (no figure changes without outside businesses). Frozen snapshots are untouched; results computed before rc.5 render as before.
- Kurt's review list (defaults taken: Schedule AI spread / proration, all YTD amounts recurring, C corp defaults, Schedule F farmer test, plain-NUMERIC storage of K-1 figures): OPEN-QUESTIONS.md Q45.

## Prior-year trend projection (Q46, engine 1.0.0-rc.6)

User-facing:
- **Projection method** on Entity tax setup > year inputs (per company and tax year): **Run rate** (the default, unchanged), **Prior-year seasonal (scaled)** (last year's remaining months scaled by this year's recurring year-to-date vs. last year's same months, scale kept between 0.25 and 4) or **Prior-year seasonal (dollar)** (last year's remaining months as-is). Ordinary income only; other income kinds keep the run rate.
- Last year comes from the same company's books through the same GL tax treatment, non-recurring items excluded. Incomplete prior-year books (a month without activity) or figures that do not support a trend fall back to the run rate with a warning (estimate and readiness).
- The Calculation view shows the method on the company line ("Prior-year seasonal (scaled ×1.20)") with a "Run rate would be $X" note; the trace shows the prior-year figures; the assumptions page / PDF state the method per business.

Operator notes:
- Migration `0207_tax_est_projection_method.sql` (+ rollback; part `parts/projection-method.sql`; journal idx 207, `when` 1784800000290): new column `tax_est_entity_year_inputs.projection_method` (default `run_rate`, CHECK). Additive; every estimate is unchanged until a method is chosen.
- Engine 1.0.0-rc.6 and estimate cache version `te-estimate-v6` re-key every live estimate once on deploy (no figure changes for run-rate entities). A selected prior-year method reads 12 more months per company (Redis-cached by the GL stamp).
- Kurt's review list (prior-year definition and flags, completeness rule, dollar method guardrails, C corp restriction): OPEN-QUESTIONS.md Q46.

## Per-year entity type override (Q49)

User-facing:
- **Entity type for <year>** on Entity tax setup > year inputs (per company and tax year): "Use TB profile (1065 → Partnership)" (the default, unchanged) or one of Schedule C, Schedule F, S corporation, Partnership, C corporation. Use it when the return for that year differs from the Trial Balance tax profile — e.g. an LLC filing 1065 that elected S corporation status for 2026. The override wins for that year only; the Trial Balance tax profile and other years are not changed.
- The estimate follows the chosen type: S corporation (no self-employment tax on the K-1, officer wages, officer links allowed for that year), partnership (guaranteed payments, partner SE tax), or C corporation (estimated at the entity level, out of the owners' individual totals). Inputs left over from the other type (a guaranteed-payment treatment on an S corp, an officer link on a partnership) are ignored with a warning — the estimate still computes.
- Entity tax setup shows the effective type with "Overridden for 2026 (TB profile says 1065)"; the Calculation view shows "Entity type overridden: S corp (TB profile says 1065)" on the business line, and the preparer assumptions page states it. The client PDF / portal show only the type used.
- The "estimator setting is ignored" note under a TB profile now points to the per-year override.

Operator notes:
- Migration `0209_tax_est_entity_type_override.sql` (+ rollback; part `parts/entity-type-override.sql`; journal idx 209, `when` 1784800000310): new nullable column `tax_est_entity_year_inputs.entity_type_override` (CHECK: the five entity tax types). Additive; every estimate is unchanged until an override is set.
- No engine change (engine stays 1.0.0-rc.6). Estimate cache version `te-estimate-v7` and P&L provider cache `te:pl:v3` re-key live estimates once on deploy (no figure changes without an override).
- Kurt's review list (treatments not per year, link-kind follows the year, prior-year trend uses the current year's type, display wording): OPEN-QUESTIONS.md Q49.

## Owner pickers and owner splits (Q50)

User-facing:
- On Entity tax setup > GL tax treatment, the person / taxpayer for W-2 wages, owner or officer health insurance and retirement, guaranteed payments and estimated tax payments now lists **only the owners linked to this business** (no more firm-wide taxpayer list). With no linked owner the row says to link the owner first (Taxpayers > the taxpayer > Linked businesses). Saving an unlinked owner is refused; older rows naming one keep working and warn.
- **Split between owners** on those accounts: by **%** (must total 100%; "Default from ownership" fills the link profit %) or by **fixed annual $** per owner for the year (the last owner takes the books' difference, with a warning). S corp officer wages and >2% shareholder health land on each shareholder's W-2 box 1 / health deduction; guaranteed payments and retirement split the same way; estimated tax payments can be shared between taxpayers (each taxpayer's payment ledger gets its share). The trace shows each share.

Operator notes:
- Migration `0210_tax_est_treatment_splits.sql` (+ rollback; part `parts/treatment-splits.sql`; journal idx 210, `when` 1784800000320 — 0209 belongs to the entity-type override branch): new table `tax_est_account_treatment_splits` and column `tax_est_account_treatments.split_mode` (default `pct`). Additive; no data migration — a treatment without split rows computes exactly as before.
- Provider cache `te:pl:v3` and estimate cache `te-estimate-v7` re-key once on deploy (no figure changes without splits). Engine unchanged (no version bump, no oracle change). New endpoint `GET /api/v1/tax-estimator/entities/:tenantId/:companyId/owner-candidates` (firm admin / staff).
- New codes: `TE_TARGET_NOT_LINKED` (422 / warning), `TE_SPLIT_PCT_TOTAL`, `TE_SPLIT_DUPLICATE_TARGET`, `TE_SPLIT_AMOUNT_TOTAL_ZERO` (400), `TE_SPLIT_REMAINDER` (warning), `TE_SPLIT_AMOUNT_YEAR_MISSING` (info). After deploy, check readiness for `TE_TARGET_NOT_LINKED`: existing W-2 wage / owner-item rows that name a taxpayer not linked to the business (the old picker allowed any firm taxpayer).
- Kurt's review list (defaults a–j: $-mode YTD / projection rule, missing-year fallback, payment $ mode, rounding, existing unlinked rows, names in the trace): OPEN-QUESTIONS.md Q50.

## Portal view options (Q51)

User-facing:
- **Choose what each portal contact sees** of the tax estimates shared with them — a spouse or an in-house bookkeeper can see less. Four switches per contact: **Calculation summary** (new, off by default: income by business showing only the household's share, adjustments total, AGI, deduction, QBI deduction, taxable income, the federal tax lines, tax per state and the total — no rates, formulas or adjustment detail), **Quarterly estimates and vouchers** (on), **Payments on record** (on) and **Download the estimate PDF** (off; a PDF of exactly what that contact sees — the projected total plus the sections switched on, never business totals, other owners, rates or adjustment detail). The projected total always shows. Set them on the taxpayer page (Portal contacts > What they see) or in Practice > Client Portal > edit the contact > "Tax estimates in the portal". One setting per contact, for every taxpayer the contact can open.
- **Share what-if scenarios**: on Annual settings, select a scenario and tick **Show this scenario in the client portal**. Base is always shown; when more than one is shared the client gets a scenario picker. Clients see the scenario name exactly as written, so name it for them. When the portal shows finalized snapshots, each shared scenario shows its own latest finalized snapshot and a scenario without one is not offered.
- "View as Client" shows exactly what the previewed contact sees.

Operator notes:
- Migration `0211_tax_est_portal_options.sql` (+ rollback; part `parts/portal-options.sql`; journal idx 211, `when` 1784800000330 — 0209 / 0210 belong to parallel branches): new table `tax_est_portal_contact_options` and column `tax_est_scenarios.show_in_portal` (default false). Additive; with no rows every contact sees exactly what they saw before (byte-identical portal response).
- Turning a section on needs firm staff with Tax Estimator access; tenant staff outside the firm may only switch sections off (`TE_ACCESS_GRANT_FORBIDDEN`). Changes audit `tax_est_portal_options`; every portal estimate-PDF download audits `tax_est_portal_pdf` (metadata only).
- Behaviour change in snapshot mode: the portal used the latest finalized snapshot of ANY scenario; it now uses the shared scenario's own (Base unless a what-if is shared).
- Kurt chose the portal-safe PDF and confirmed the snapshot-mode change; still to confirm: per-contact vs per-taxpayer and no snapshot frozen per portal download (OPEN-QUESTIONS.md Q51).

## v0.9.228 integration (Q49 + Q50 + Q51 + Q52 together)

Operator notes:
- Migrations 0209 → 0212 apply in this order (journal `when` 1784800000310 … 340); all additive.
- Cache versions: Q49 and Q50 each bumped the estimate cache to `te-estimate-v7` and the P&L provider cache to `te:pl:v3` on their own branch; the merged release uses `te-estimate-v8` and `te:pl:v4` (the key carries both the entity-type override and the owner splits). Every live estimate re-keys once on deploy; no figure changes without an override or splits.
- Fix: in a business owned by several households, each taxpayer's estimate now gets only its own persons' officer wages, owner / officer health and retirement and guaranteed payments (before, another owner's items were attributed to the taxpayer's primary person with a TE_UNKNOWN_PERSON warning — e.g. a 60 / 40 officer-wage split gave each shareholder 100%). Figures change for such businesses only.
- The owner's company-dashboard card follows the owner's portal contact's Q51 options (Quarterly estimates off → projected total only) and the Base scenario (snapshot mode: Base's latest finalized snapshot). Several active contacts with the owner's e-mail → most restrictive options.

## Dashboard cards (Q52, migration 0212_tax_est_dashboard_summaries)

User-facing:
- **Company dashboard**: three Tax Estimator cards per taxpayer linked to the company — **Next estimated payment** (next federal and state voucher: date, amount, paid or unpaid), **Projected tax for the year** (federal + state, change since the last finalized estimate, books-through month) and **Paid vs required to date** (shortfall; staff also see the estimated underpayment penalty). Firm staff see every taxpayer they may see with a **Refresh** button and a "Not computed yet — Open taxpayer" line where nothing is computed; the company **owner** sees only their own estimate (the taxpayer mapped to the client-portal contact with their e-mail and Tax estimates access on the company), with the same figures the client portal shows. Nobody else sees the cards.
- **Tax Estimator home**: **Vouchers due in the next 30 days** and **Behind on payments** across every taxpayer you can see, each row opening the taxpayer and with its own Refresh, plus the taxpayers not computed yet.
- Every card says where its figures come from (live estimate or finalized estimate) and as of when. Opening a dashboard never runs an estimate.

Operator notes:
- Shown only where `TAX_ESTIMATOR_V1` is ON: for the company cards, on the **client's own tenant** (the practice tenant alone is not enough).
- **Migration** `0212_tax_est_dashboard_summaries` (additive, one table; journal idx 212 — renumber at merge if 0209-0211 land differently). Rollback `0212_tax_est_dashboard_summaries.rollback.sql` drops the table (a derived cache, rebuilt by the next estimate). The table's `summary_encrypted` column is covered by the credential re-encryption sweep.
- No backfill: the firm cards fill as estimates are viewed, finalized or refreshed; until then they show finalized snapshots or "Not computed yet".

## State rate schedules, state capital gains and the 25% / 28% gains (Q53, engine 1.0.0-rc.9)

User-facing:
- **State tax now uses each state's rate schedule** (all income-tax states and DC, 2025 and 2026): the state's starting point, capital gains rule, federal-tax deduction (Missouri, Alabama, Oregon), standard deduction, exemptions and tax brackets for the filing status. Each state row has **Tax computed by**: *State rate schedule* (default) or *Effective-rate override* (the previous method, labelled as such everywhere). With no schedule on file the row's rate is used and the estimate warns.
- **Nonresident states** default to the state's own method: the tax as if a resident on all income × the income sourced there ÷ federal AGI (ratio states), or the schedule on the sourced income less prorated deductions (states that tax only in-state income). *Sourced income × rate* stays available per row. The resident state's credit is limited to its tax × the sourced income ÷ its AGI.
- **State capital gains**: Missouri's 100% capital gain subtraction (HB 594, from 2025), Arkansas's 50% net long-term gain exclusion (all of it over $10 million), Wisconsin 30%, North Dakota 40%, South Carolina 44%, Arizona 25%, Vermont and New Mexico flat exclusions, Hawaii's 7.25% maximum rate, Montana's separate long-term rates, Massachusetts' 8.5% short-term rate, Maryland's 2% surtax over $350,000 federal AGI. Deductions limited to in-state or long-held assets are noted, not applied. **Washington's capital gains tax** is computed for a Washington resident row.
- **Unrecaptured §1250 gain and collectibles gain** on Annual settings, and account treatments *Long-term gain: unrecaptured §1250 (25%)* / *collectibles (28%)*, feed the 25% / 28% Schedule D worksheet rates.
- The Calculation view, assumptions page and PDF show the schedule computation per state (and the ratio for nonresident rows), or "Effective-rate override".
- Admin > Tax parameters > States shows the new rules (bracket tables per filing status) with override, verify and the AI check like every other rule. Every new value is **unverified** — Kurt verifies MO and AR first.

Operator notes:
- Migration `0213_tax_est_state_brackets.sql` (+ rollback; part `parts/state-brackets.sql`; journal idx 213, `when` 1784800000350): state-row modes, the two year inputs, and the account-treatment CHECK re-created with the two new treatments (non-additive exception: DROP + ADD of the same constraint). The new state rules (344 rows) arrive through the startup seed re-sync.
- **Live estimate numbers change on deploy** for every scenario with state rows: existing rows switch to the rate schedule (the previously entered rate stays as the override value — flip a row back to *Effective-rate override* to restore the old figure). Snapshots already issued are unchanged.
- Engine 1.0.0-rc.9. Estimate cache `te-estimate-v10`, P&L cache `te:pl:v6` (v0.9.229 integration: above the Q49–Q52 `v8` / `v4` and the Q53 branch's own `v9` / `v5`) re-key every live estimate once.
- Kurt's review list (defaults, simplifications, carried-forward 2026 states): OPEN-QUESTIONS.md Q53.

## Strict taxpayer visibility + company-dashboard switch (Q54, migration 0215_tax_est_company_dashboard_switch)

User-facing:
- **"Who can see this taxpayer" now applies to firm admins too.** Once a taxpayer has a list, only the people on it and super admins can see it — a firm administrator who is not listed gets "Taxpayer not found" everywhere (taxpayer list and counts, estimate, scenarios, payments, snapshots, PDFs, Report Pack, portal-contact mapping, dashboards, owner pickers). Listed firm admins get the full estimate, like listed staff. Taxpayers without a list: firm admins still see them.
- **New firm access right "Tax Estimator: view taxpayers"** (Firm > Staff > Access rights, group "Tax Estimator"; OFF for everyone by default, and the one right a read-only firm member may hold). Staff and read-only members see a taxpayer without a list only with this right (plus the "linked clients" rule while the firm setting is ON). Access to a client company alone no longer shows its taxpayers. Taxpayers they created and have not linked yet stay visible to them. Members who see nothing get "Ask a firm admin for Tax Estimator access".
- A list must keep at least one firm administrator (or super admin) on it; firm administrators can now be picked. Removing yourself asks first ("you will lose access") and returns you to the taxpayer list. Adding the first person to a new list adds you too.
- **"Show on linked company dashboards"** on the taxpayer page: the company-dashboard tax cards (Next payment / Projected tax / Paid vs required) appear only for taxpayers with this ON. **OFF for every taxpayer by default.** The Tax Estimator home cards are unchanged.

Operator notes:
- **Behaviour change on deploy (tell Kurt):** (1) the four firm_staff members who saw "Jonthan & Irene" only through their Accountant access to ROCA LLC lose it until a firm admin grants them "Tax Estimator: view taxpayers" or lists them on the taxpayer; (2) firm admins keep seeing taxpayers without a list; (3) to hide "Kurt Krueger" from Gary Shaffer and Steven Harner, Kurt adds a "Who can see this taxpayer" list naming himself; (4) **every company-dashboard tax card disappears** until someone turns "Show on linked company dashboards" on per taxpayer. Production had no staff lists at deploy time, so no list is orphaned.
- **Migration 0215** (additive): `tax_est_taxpayers.show_on_company_dashboard BOOLEAN NOT NULL DEFAULT false`; rollback `0215_tax_est_company_dashboard_switch.rollback.sql` drops it (roll the code back with it). 0214 belongs to a parallel branch. The access right needs no migration (`firm_users.capabilities`, absent key = OFF).
- New error code `TE_STAFF_LIST_NO_MANAGER` (422). Capability grants are audited as `firm_user_capabilities`, list changes as `tax_est_taxpayer_staff`, the dashboard switch as a `tax_est_taxpayer` update.
