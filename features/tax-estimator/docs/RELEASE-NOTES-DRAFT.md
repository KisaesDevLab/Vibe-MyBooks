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
