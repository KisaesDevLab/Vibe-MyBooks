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
