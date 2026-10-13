# Tax Estimator: module reference

Operator and developer reference for the MyBooks Tax Estimator (`TAX_ESTIMATOR_V1`). This is the
Phase 14 deliverable promised by `features/tax-estimator/PHASES.md` and `MODULE.md` (the kit file). It
describes what is **built**, checked against the code on branch `feat/tax-estimator` (2026-10-12).
The decisions D1 to D16 live in `features/tax-estimator/MODULE.md`; this page does not repeat their
rationale, it says where each one is enforced.

Companion pages in this folder:

| Page | What it is |
|---|---|
| [ERROR-CODES.md](./ERROR-CODES.md) | Every `TE_*` error and warning code: type, where emitted, meaning |
| [AUDIT-CATALOGUE.md](./AUDIT-CATALOGUE.md) | Every `audit_log` entity type and action the module writes |
| [DATA-DICTIONARY.md](./DATA-DICTIONARY.md) | Tax return information (IRC §7216) fields, encryption, payment-year rule, retention |

Status: flag OFF everywhere, nothing merged to main, Kurt's Phase 1 and MO/AR parameter sign-offs
still open (PROGRESS.md). Engine version at the time of writing: `1.0.0-rc.2`
(`packages/shared/src/tax-estimator/engine/version.ts`; bump it whenever a computed line can change).

---

## 1. Architecture

### 1.1 Layers

| Layer | Path | Notes |
|---|---|---|
| Pure engine | `packages/shared/src/tax-estimator/engine/**` | No IO, no DB. Same code in browser and server (rule TB14 pattern). Entry points `computeFederal`, `computeState`, `computeFederalEstimates`, `computeStateEstimates`, `computeFarmer`, `computeCcorp`; `bridge.ts` maps service DTOs to engine inputs |
| Shared contracts | `packages/shared/src/tax-estimator/*.ts`, `schemas/tax-estimator*.ts` | DTOs, Zod schemas, parameter registry (`parameterKeys.ts`), state rule registry (`stateRuleKeys.ts`), string-decimal helper (`decimal.ts`), month allocation (`allocation.ts`), assumptions builder (`assumptions.ts`), date helpers (`dates.ts`) |
| Drizzle schema | `packages/api/src/db/schema/tax-estimator*.ts` | Re-exported from `schema/index.ts` |
| Migration | `packages/api/src/db/migrations/0201_tax_estimator.sql` (+ `.rollback.sql`, journal idx 201) | One consolidated additive migration, assembled from `migrations/parts/*.sql` |
| Seeds | `packages/api/src/db/seeds/tax-estimator/federal/{2025,2026}.ts`, `state-rules/<ST>.ts` | Shipped parameters and state rules, re-synced from code at every API start |
| Services | `packages/api/src/services/tax-estimator/**` | All business logic and IO (see 1.2) |
| Routes | `routes/tax-estimator.routes.ts` (staff, fans out to `routes/tax-estimator/{taxpayers,entities,state-rules,years,estimate,pdf}.routes.ts`), `routes/tax-parameters-admin.routes.ts`, `routes/tax-state-rules-admin.routes.ts`, `routes/portal-tax-estimates-public.routes.ts`, plus `/reports/tax-estimate*` in `reports.routes.ts` | Mounted in `app.ts` |
| Middleware | `middleware/tax-estimator-scope.ts` | `resolveTaxEstimatorScope`, `requireTaxEstimatorWrite`, `getScope`, `taxEstimateReportScope` |
| Web | `packages/web/src/features/tax-estimator/**`, `features/portal/PortalTaxEstimatesPage`, hooks `api/hooks/useTaxEstimator*.ts`, `hooks/useTaxEstimatorVisibility.ts`, sidebar `components/layout/TaxEstimatorGroup.tsx` | Routes under `/tax-estimator/*` and `/admin/tax-parameters` |

The engine must not be re-implemented in services or the browser, and no rate, threshold, limit,
date or dollar amount may appear as a literal in engine code (a guard test, `no-literals.guard`,
enforces this). Everything numeric comes from the parameter registry.

### 1.2 Services (what each owns)

| Service | Owns |
|---|---|
| `firm-scope.service.ts` | The D1 scope: firm choice, allowed tenant set, `isTenantInScope` |
| `taxpayers.service.ts` | Taxpayers, persons (max two), links (per person, company, year), portal contact mapping |
| `entity-type.service.ts`, `entity-settings.service.ts`, `treatments.service.ts`, `readiness.service.ts` | Entity tax type resolution (D3), estimator entity settings and year inputs (W-2 wages override, UBIA), the treatment map, books readiness |
| `pl-provider.service.ts` | Books to tax-basis P&L per company (the only reader of the GL for the engine) |
| `closed-month.service.ts`, `periods.ts` | Last-closed-month default and tax-year windows |
| `years.service.ts`, `scenarios.service.ts`, `adjustments.service.ts`, `adjustment-types.service.ts`, `state-rows.service.ts`, `firm-settings.service.ts` | Annual settings (prior-year figures encrypted), scenarios (at most 6 per taxpayer and year in total, the Base scenario included: `TE_SCENARIO_CAP`), adjustments, state rows, firm defaults |
| `payments.service.ts`, `sch-ai-snapshots.service.ts` | Payment ledger (stored plus live GL), Schedule AI period snapshots |
| `estimate.service.ts` | Assembles one `EstimateResultDTO`: gather, bridge, engine, cache |
| `estimate-snapshots.service.ts`, `estimate-documents.service.ts`, `estimate-pdf.service.ts` | Immutable snapshots, issued PDFs, Report Pack section |
| `portal-estimates.service.ts` | Allow-list projection for the client portal, vouchers PDF |
| `tax-parameters.service.ts`, `tax-state-rules.service.ts` | Parameter and state-rule store: resolution, overrides, create year, diff / adopt, startup sync, change feed |

### 1.3 Data flow

```
 books (per tenant)                              estimator setup (firm-scoped, D1)
 ------------------                              ----------------------------------
 GL, accounts, TB assignments,                   tax_est_taxpayers / persons / links
 reconciliations, lock date                      tax_est_years / scenarios / adjustments / state_rows
        |                                        tax_est_account_treatments, entity settings, payments
        v                                                  |
 pl-provider.service  --(report builders, cash/accrual, treatment map, character)-->  TaxBasisPl
        |   cache: te:pl:v2:<tenant>:<company>:<year>:<basis>:<through>:<glStamp>:<configVersion>
        v                                                  |
        +------------------------+-------------------------+
                                 v
                  estimate.service.ts  (gather inputs, scope digest, hash)
                                 |
        engine/bridge.ts -> computeFederal -> FederalResult
                                 |            \-> computeState (per row), computeFarmer, computeCcorp
                                 v
        computeFederalEstimates / computeStateEstimates
        (safe harbor, Schedule AI, vouchers, event-driven 6654 penalty, payments applied)
                                 |
                                 v
                    EstimateResultDTO (+ assumptions block, warnings, trace)
              encrypted Redis cache: te:estimate:te-estimate-v3:<firm>:<taxpayer>:<scenario>:<hash>
                                 |
     +---------------+-----------+-------------+-------------------+
     v               v                         v                   v
  staff screens   snapshot (finalize,       portal projection   Report Pack section
  /tax-estimator  vouchers, pdf,            (allow-list,        (client PDF variant,
                  report_pack): frozen,     live or latest      encrypted run artifact)
                  encrypted, immutable      snapshot)
```

Order inside the engine, per `engine/federal.ts`: loss limitations (a §469(i) MAGI probe pass, then
the real pass), SE tax per person, owner deductions (SEP / 401(k) / SIMPLE, SEHI, HSA), AGI, standard
vs itemized deduction, Schedule 1-A, QBI, regular tax with the QD / LTCG worksheet, credits
(Q44, `engine/dependents.ts`: §21 care credit, then §24 child tax credit / credit for other
dependents with the phase-out, then the manual other credits; additional child tax credit
refundable), Additional Medicare, NIIT, federal total. The state engine subtracts the resident
state's personal / dependent exemptions (`exemptions` state rule) from a federal-AGI or
federal-taxable base and its exemption credits from the tax (custom base: credits only;
nonresident rows: none). The kit file lists the same steps with the legal basis.

---

## 2. Scope model (D1): firm-scoped taxpayers, cross-tenant reads

A Taxpayer belongs to a **firm** (`tax_est_taxpayers.firm_id`), never to a tenant. A link points at a
`companies` row in any tenant the firm manages. This makes the module a deliberate exception to
"every query has `WHERE tenant_id = <request tenant>`", and the exception lives in one function,
never in client input:

```
allowedTenantIds = tenants the firm ACTIVELY manages (tenant_firm_assignments)
                 ∩ tenants the CALLER can reach (user_tenant_access)
```

(`services/tax-estimator/firm-scope.service.ts`.) This is the Clients-screen contract: nothing the
caller could not reach by switching into the client. Super admins have no access rows by design, so
they get the firm's full managed set.

- **Firm choice**: one membership picks the firm; several memberships require an `X-Firm-Id` header
  naming a firm the caller belongs to (a firm they are not in answers 404, a missing header on a
  multi-firm user answers `TE_FIRM_REQUIRED` 400). A super admin must always send `X-Firm-Id` and acts as `firm_admin`.
- **Every** books read is preceded by `assertEntityInScope`; a tenant that drops out of either set
  drops out of the next computation (the estimate warns `TE_TENANT_NOT_MANAGED` for linked data it can
  no longer read; a snapshot containing such a tenant shows its history row without figures and
  answers 404 on view and compare).
- The router is **session auth only** (`requireSessionAuth`): API keys are single-tenant and are refused.
- The cache key and `inputsHash` embed the sorted `allowedTenantIds`, so two firm members with
  different client access never share a cached result.
- Roles come from the firm membership (`firm_admin`, `firm_staff`, `firm_readonly`); the
  `tax_estimator` permission resource is checked on the caller's active-tenant role in addition.
- Treatment rows are books-scoped but several firms can manage one tenant. A row whose payment target
  belongs to another firm is shown with `targetOtherFirm: true` and the foreign ids withheld, and cannot be
  changed (`TE_TREATMENT_OTHER_FIRM` 409).

### 2.1 Taxpayer visibility (D17, migration 0202; D18 staff-list override)

On top of the firm scope, **which taxpayers** a member sees is decided by one predicate,
`visibleTaxpayerFilter(scope)` in `firm-scope.service.ts` (SQL on `tax_est_taxpayers`, includes
`firm_id`). `resolveScope` resolves the viewer with the scope: user id, **bypass** (`firm_admin` in
the firm, or super admin) and the firm switch `tax_est_firm_settings.restrict_taxpayers_to_linked_tenants`
(default ON; a firm with no settings row is ON).

| Viewer | Sees a taxpayer when |
|---|---|
| bypass (firm admin, super admin) | always (any firm taxpayer) |
| anyone else, taxpayer HAS a staff list (D18) | they are on it — nothing else (tenant reach and the switch play no part) |
| anyone else, no staff list, switch ON | a link of the taxpayer, any year, points into their `allowedTenantIds` OR the taxpayer has no **active** link — none into a tenant the firm still actively manages — and `created_by` is them |
| anyone else, no staff list, switch OFF | always |

- The predicate is in the list query's WHERE (the `total` counts only visible rows; the lock flag
  `staffRestricted` is a row-local EXISTS, no N+1) and in every by-id loader: `loadTaxpayerForFirm`,
  `loadScenarioForFirm`, `loadAdjustmentForFirm` (`year-access.ts`), the taxpayers service loader, the
  payment and snapshot loaders. A hidden taxpayer is indistinguishable from another firm's: 404
  `TE_TAXPAYER_NOT_FOUND` (or `TE_SCENARIO_` / `TE_ADJUSTMENT_` / `TE_PAYMENT_` / `TE_SNAPSHOT_NOT_FOUND`
  on routes keyed by those ids).
- Visibility is about the taxpayer; under the firm rule the **data** from linked tenants outside the
  viewer's scope stays hidden exactly as in section 2 (partial view: those links are `outOfScope`,
  their figures left out).
- **D18 full data for listed users** (OPEN-QUESTIONS.md Q43). `scopeForTaxpayer(scope, taxpayerId)`
  (`firm-scope.service.ts`) returns the scope for reads / computations OF that taxpayer: for a
  non-bypass viewer on its staff list, `allowedTenantIds` gains every tenant the firm still actively
  manages that the taxpayer links into (any year), and the scope carries `elevation { taxpayerId,
  baseTenantIds }`; otherwise it is unchanged. It checks the list membership itself. Used by: the
  estimate (`computeEstimateWithInputs`, cache key adds `elevated`), estimate readiness, `listLinks`
  (links read only through the list are `viaStaffList: true`), the taxpayer detail (`elevatedAccess`),
  the payment ledger, Schedule AI list / capture / stored figures, estimate snapshots (create, history,
  view, compare — the snapshot's tenant gate is checked against the widened set), PDFs and the Report
  Pack section (request and worker). `baseScope(scope)` strips it at every write that could reach the
  books: `upsertLink`, `removeLink` (non-admins need their own reach into a still-managed tenant),
  company options, portal contacts, entity settings / year inputs, treatments, transaction flags, GL-linked
  adjustments, payments, the register flag. Routes keyed by tenant (`/entities/*`, `/register/*`) and
  everything outside the estimator never see a widened scope. `EstimateResultDTO.elevatedAccess` drives
  the estimate-page note; audit rows written under a widened scope carry `elevated: true`.
- Report Pack: the `tax-estimate` choices and `renderPackSection` apply the requester's visibility;
  the worker re-derives the scope from `requested_by` (`resolvePackScopeForUser`), so a staff list
  set after the run was queued is honoured at render time. A hidden taxpayer is `TE_TAXPAYER_NOT_LINKED` 404 there.
- The register non-recurring flag (`/register/*`): `linked` is firm-wide (the flag is entity data);
  the `taxpayers` names it returns follow visibility.
- Client portal: unchanged (`UNRESTRICTED_VIEWER`; the contact mapping governs it).
- Account treatments (entity setup) stay firm-checked only (OPEN-QUESTIONS.md Q42 (d)).
- **Staff list** (`tax_est_taxpayer_staff`): `GET /taxpayers/:id/staff` (anyone who sees the
  taxpayer; `canEdit` for firm admins with `tax_estimator` update), `GET /taxpayers/:id/staff-candidates`
  and `PUT /taxpayers/:id/staff` `{ userIds }` (firm admins / super admins only, else 403
  `TE_FIRM_ADMIN_REQUIRED`; a caller who cannot see the taxpayer gets 404 first). Candidates: active
  `firm_staff` / `firm_readonly` members, active staff users, holding `tax_estimator` read in the
  admin's ACTIVE tenant. Additions outside that set: 422 `TE_STAFF_NOT_ELIGIBLE`; members already on
  the list may stay. Changing the list writes one `tax_est_taxpayer_staff` audit row (user ids
  before / after / added / removed); flipping the switch writes `tax_est_visibility_switch`.
- Unlinked taxpayers created before D17 keep their `created_by` (every service-created taxpayer has
  it); a row with NULL `created_by` is visible to firm admins only while unlinked.

---

## 3. Surfaces

### 3.1 Staff router: `/api/v1/tax-estimator`

Guard chain (pinned by `tax-estimator.routes.test.ts`), in order:

1. `authenticate`
2. `requireSessionAuth` (no API keys)
3. `user_type = 'client'` answers 404 "Feature not available"
4. `requireFeatureFlag('TAX_ESTIMATOR_V1')` on the **caller's active tenant**
5. `requirePermission('tax_estimator', read | update)`, inferred from the method, except that `POST .../scenarios/:id/estimate` and `POST .../scenarios/:id/pdf` are treated as **reads** (a `firm_readonly` member may compute and print)
6. `resolveTaxEstimatorScope` (firm and allowed tenants, sets `req.taxEstimatorScope`)
7. Per route, mutations also pass `requireTaxEstimatorWrite` (`firm_admin` or `firm_staff` only; otherwise `TE_NOT_FIRM_STAFF` 403). Firm settings writes and staff-list changes need `firm_admin` (`TE_FIRM_ADMIN_REQUIRED`).
8. Every taxpayer read and write is limited to the taxpayers the caller may see (section 2.1, D17).

| Area | Routes (relative to `/api/v1/tax-estimator`) |
|---|---|
| Scope, parameters | `GET /scope` (firm, firm role, managed-tenant count, `canWrite` — QA D2), `GET /parameters/:year` |
| Taxpayers | `GET/POST /taxpayers`, `GET /taxpayers/company-options`, `GET/PATCH/DELETE /taxpayers/:id` (DELETE archives), `PUT/DELETE /taxpayers/:id/persons/:role`, `GET/PUT /taxpayers/:id/links`, `DELETE /taxpayers/:id/links/:linkId`, `GET/POST /taxpayers/:id/contacts`, `GET /taxpayers/:id/contact-candidates` (active contacts of the linked client companies in scope — QA D11), `DELETE /taxpayers/:id/contacts/:contactId`, D17 staff list `GET/PUT /taxpayers/:id/staff`, `GET /taxpayers/:id/staff-candidates` |
| Outside businesses (Q45) | `GET/POST /taxpayers/:id/outside-entities` (GET `?taxYear=` attaches that year's amounts), `PUT/DELETE /taxpayers/:id/outside-entities/:outsideEntityId`, `PUT/DELETE /taxpayers/:id/outside-entities/:outsideEntityId/years/:taxYear`; part of the taxpayer (D17 / D18 visibility, writes need `requireTaxEstimatorWrite`) |
| Entity setup | `/entities/:tenantId/:companyId/` + `settings` (GET/PUT), `year-inputs/:taxYear` (GET/PUT), `treatments` (GET/PUT; Q50 `splitMode` + `splits`), `owner-candidates` (GET, staff / admin; Q50), `treatment-suggestions`, `transaction-flags` (GET/PUT), `readiness`, `tax-basis-pl` |
| Register flag | `GET /register/flags` (flagged transactions of the active company, max 500), `GET/PUT /register/transactions/:transactionId` (`{ nonRecurring }`). Mounted after guards 1-5 and **before** guard 6: the firm is the active tenant's managing firm and the tenant must be in the caller's D1 scope (`resolvePackScope`, else 404); the company is the active one (`X-Company-Id`); the transaction must belong to it (else 404 `TE_TRANSACTION_NOT_FOUND`); setting needs a company linked to an active firm taxpayer (409 `TE_COMPANY_NOT_LINKED`) and `firm_admin` / `firm_staff`. Writes go through the `transaction-flags` path (same audit rows). Used by the transaction detail card and the register `NR` badge |
| Annual settings | `GET /taxpayers/:id/years`, `GET/PUT /taxpayers/:id/years/:taxYear`, scenarios (`GET/POST .../scenarios`, `PATCH/DELETE /scenarios/:id`, `POST /scenarios/:id/clone` with an optional `{ name }`; Base cannot be renamed or deleted), adjustments (`GET/POST /scenarios/:id/adjustments`, `PATCH/DELETE /adjustments/:id`), state rows (`GET/PUT /scenarios/:id/state-rows`), adjustment types (`/adjustment-types`), `GET/PUT /firm-settings` |
| State rules (read) | `GET /state-rules/:year`, `GET /state-rules/:year/:state` |
| Estimate | `POST /taxpayers/:id/years/:taxYear/scenarios/:scenarioId/estimate`, `GET .../readiness` (optional `?throughMonth=YYYY-MM`, QA D20), payments (`GET/POST .../payments`, `PATCH/DELETE /payments/:id`), Schedule AI (`GET/POST .../sch-ai-snapshots`) |
| Snapshots, PDF | `POST .../scenarios/:id/snapshots` (finalize), `GET .../snapshots`, `GET /snapshots/:id`, `GET /snapshots/:id/compare`, `GET /snapshots/:id/pdf`, `POST .../scenarios/:id/pdf`; PUT / PATCH / DELETE on a snapshot answer 409 `TE_SNAPSHOT_IMMUTABLE` |

Lists that are naturally bounded page with `limit` / `offset` (default whole set, max 500) and return `total`.

### 3.2 Admin routers (super admin only: `authenticate` + `requireSuperAdmin`)

| Router | Routes |
|---|---|
| `/api/v1/admin/tax-parameters` (`tax-parameters-admin.routes.ts`) | `GET /years`, `GET /:year`, `PUT /:year/:key` (override with reason), `DELETE /:year/:key` (revert), `POST /:year/create-from-prior`, `GET /:year/diff`, `POST /:year/adopt-shipped`, `GET /:year/changes`, **`POST /:year/:key/verify`** and **`POST /:year/verify-all`** (section 9.4) |
| `/api/v1/admin/tax-state-rules` (`tax-state-rules-admin.routes.ts`) | `GET /:year/summary`, `GET /:year/diff`, `GET /:year/changes`, `POST /:year/create-from-prior`, `POST /:year/adopt-shipped`, `GET /:year/:state`, `PUT /:year/:state/:key`, `DELETE /:year/:state/:key`, **`POST /:year/:state/:key/verify`** and **`POST /:year/:state/verify-all`** |

UI: `/admin/tax-parameters` (federal and states).

### 3.3 Client portal

See section 12.

### 3.4 Report Pack

See section 13.

### 3.6 Dashboard cards (Q52, migration `0212_tax_est_dashboard_summaries`)

Kurt's decisions of 2026-10-13 (OPEN-QUESTIONS.md Q52). Loading a dashboard never computes an estimate.

| Surface | Route | Who | Cards |
|---|---|---|---|
| Company dashboard (`features/dashboard/TaxEstimateCards.tsx`, under the Financial Snapshot row) | `GET /api/v1/dashboard/tax-estimates` (`routes/dashboard-tax-estimates.routes.ts`, inside the dashboard router: `authenticate` + `dashboard:read` + `companyContext`); `POST .../:taxpayerId/refresh` (staff) | session only; `TAX_ESTIMATOR_V1` ON for the company's **own** tenant; then **staff** = the Report Pack gate (`taxEstimateReportScope`: not a client user, `tax_estimator` read, member of the firm managing the tenant, tenant in their D1 scope) seeing every D17 / D18-visible taxpayer linked to the active company; else the tenant **owner** (active-tenant role `owner`) seeing only the taxpayers they personally are; anyone else `{ data: null }` | per taxpayer: Next estimated payment (next federal / state voucher: date, amount, paid / unpaid), Projected tax for the year (total, federal / state, change since the latest finalized snapshot, books-through month), Paid vs required to date (per jurisdiction, shortfall; staff also the engine's penalty estimate) |
| Tax Estimator home (`features/tax-estimator/taxpayers/FirmDashboardCards.tsx`, above the taxpayer list — there is no Practice dashboard page) | `GET /api/v1/tax-estimator/dashboard`, `POST .../dashboard/taxpayers/:id/years/:taxYear/refresh` (a read-POST like `/estimate`, R3-07) | the staff router's guard chain; every taxpayer through `visibleTaxpayerFilter`; `null` when the caller sees no active taxpayer | Vouchers due in the next 30 days (today through today + 30, both inclusive; taxpayer, jurisdiction, installment, due date, amount, paid status, as-of), Behind on payments (as-of shortfall > $0 on installments due to date, engine penalty), Not computed yet (current-year setups with no figures) |

**Owner linkage.** "The taxpayer they personally are" = a taxpayer mapped (`tax_est_taxpayer_contacts`) to an **active** portal contact of the tenant whose e-mail equals the owner user's e-mail (case-insensitive) and who holds `tax_estimates_access` on the active company, the taxpayer belonging to the firm that actively manages the tenant, linked to that company for the year, with annual settings: the portal access predicate keyed by e-mail. That contact can already open the same figures in the portal, so the card discloses nothing new. No new schema. The owner sees the portal allow-list projection only (no penalty, other owners, rates, traces, adjustments, "not computed" rows, links or Refresh).

**Owner × Q51 portal options (integration, v0.9.228).** The owner card mirrors the portal: it reads the per-contact options (`portal-options.service optionsForContact`) of every ACTIVE contact of the tenant with the owner's e-mail and applies the most restrictive combination (AND of the switches; `mostRestrictiveOptionsForContacts`) — normally there is one. `quarterly_estimates` off → the taxpayer row carries no `jurisdictions` / `shortfall` keys (absent, never empty), so no next voucher and no paid vs required; the projected total always shows (as in the portal). Scenario = the one the portal shows by default, Base: live → Base's cache entry; snapshot (and the live-mode fallback) → Base's own latest finalized snapshot only, never a newer finalized snapshot of a shared what-if. Staff cards are unchanged (newest finalized snapshot of the year).

**Data source.** Company cards, per taxpayer, default year = `portalDefaultYear` of the years linked to the company: (1) the Redis-cached live estimate of the Base scenario when its cache key matches today's inputs (`estimate.service peekCachedEstimate`: the same gather + inputs hash, no engine / P&L provider run); (2) else the latest finalized snapshot (reason `finalize` / `vouchers`) the caller may open; (3) else "Not computed yet — Open taxpayer" (staff) / omitted (owner). The owner follows `portal_shows` like the portal: `snapshot` → the snapshot only; `live` → the portal's own cache entry (firm's full managed set, payments as of today), then the snapshot. Firm cards: the newer of (a) the stored summary (`tax_est_dashboard_summaries`) of the latest live Base estimate whose tenant set the viewer's effective scope (D18 widening included) covers AND that read every linked tenant of the year the viewer reaches, and (b) the latest finalized snapshot the viewer may open. `recordDashboardSummary` stores / refreshes a summary on every compute or cache hit of the Base scenario with the default range and no as-of payment filter (staff estimate screen, finalize, refresh); failures are logged (`dashboard_summary_write_failed`) and never fail the estimate. Every card shows its source and as-of time.

**Figures.** No new tax math: the result is projected as of today with the portal's `toPortalEstimate` (→ `installmentsAsOf`), then `shared/tax-estimator/dashboard-api.ts` only selects and sums: next voucher = first installment due today or later; required to date = Σ voucher amounts due on or before today; paid to date = Σ estimated payments applied to them dated on or before today; shortfall = Σ their as-of remaining; penalty = the engine's per-jurisdiction penalty total. A prior year stops counting as "behind" after its return due date. Reads and refreshes are not audited (no new audit entity).

### 3.5 Permission, manifest, flag

- Permission resource `tax_estimator` (`shared/src/constants/permissions.ts`, group "Trial Balance", writable). It resolves like `trial_balance`: by role, and it is still behind the flag and firm scope.
- Module manifest `taxEstimator: 'base'` (`shared/src/constants/modules.ts`): included in every license tier. No license gate.
- Flag `TAX_ESTIMATOR_V1`: in `PRACTICE_FEATURE_FLAGS` (`shared/src/constants/feature-flags.ts`) and in `FLAGS_DEFAULT_OFF_FOR_NEW_TENANTS` (`api/src/services/feature-flags.service.ts`).

---

## 4. Tables

Migration `0201_tax_estimator.sql` creates **21 tables** (each with a matching `DROP TABLE IF EXISTS` in the rollback), the flag seed, the snapshot immutability trigger, and additive columns on two existing tables.

| Group | Tables |
|---|---|
| Platform reference data (global, no tenant) | `tax_parameters` (shipped seed rows), `tax_parameter_overrides` (super-admin overrides and provisional rows), `state_estimate_rules`, `state_estimate_rule_overrides` |
| Firm-scoped setup | `tax_est_taxpayers`, `tax_est_persons`, `tax_est_links`, `tax_est_taxpayer_contacts`, `tax_est_firm_settings`, `tax_est_adjustment_types` (shipped types have `firm_id` NULL) |
| Books-scoped (tenant_id) | `tax_est_entity_settings`, `tax_est_entity_year_inputs`, `tax_est_account_treatments`, `tax_est_account_treatment_splits` (Q50), `tax_est_transaction_flags` |
| Per taxpayer and year | `tax_est_years`, `tax_est_scenarios`, `tax_est_adjustments`, `tax_est_state_rows`, `tax_est_payments`, `tax_est_sch_ai_snapshots` |
| Frozen output | `tax_est_snapshots` (trigger `trg_tax_est_snapshots_immutable`) |
| Q44 dependents (migration `0204_tax_est_dependents`) | `tax_est_dependents` (taxpayer_id ON DELETE CASCADE; display name, date of birth, relationship, kind `qualifying_child` / `qualifying_relative`, months lived with, student / disabled, first / last tax year; no SSN) and the column `tax_est_years.care_expenses` (NUMERIC(19,4), default 0) |
| Q45 businesses outside MyBooks (migration `0206_tax_est_outside_entities`) | `tax_est_outside_entities` (taxpayer_id + person_id ON DELETE CASCADE; name, entity type, profit / loss %, partner SE status, officer, activity type, active participation, QBI eligibility, SSTB, rental §162, state sourcing) and `tax_est_outside_entity_years` (outside_entity_id ON DELETE CASCADE, UNIQUE (outside_entity_id, tax_year); entry mode `full_year` / `ytd`, amount basis `entity_total` / `owner_share`, through month, the eight income characters, guaranteed payments, officer wages, owner SEHI / retirement, >2% health add-on, §199A W-2 wages / UBIA, the Q41 switch, allowed-loss override — money NUMERIC(19,4)) |
| Q52 dashboard cards (migration `0212_tax_est_dashboard_summaries`) | `tax_est_dashboard_summaries` (firm_id, taxpayer_id + scenario_id ON DELETE CASCADE, tax_year, `tenant_set_key` = sha256 of the sorted `tenant_ids` (UNIQUE per firm + taxpayer + year + key), `inputs_hash`, `engine_version`, `computed_at`, `summary_encrypted`): a derived cache of the latest live Base estimate per tenant set for the firm-wide cards (3.6) |
| D17 visibility (migration `0202_tax_est_taxpayer_visibility`) | `tax_est_taxpayer_staff` (firm_id, taxpayer_id, user_id, created_by, created_at; unique per firm + taxpayer + user; cascades with the taxpayer) and the column `tax_est_firm_settings.restrict_taxpayers_to_linked_tenants` (default TRUE) |

Columns added to existing tables: `portal_contact_companies.tax_estimates_access` (default false) and
`report_pack_runs.requested_by`, `report_pack_runs.allow_tax_estimate` (default false). The flag is
seeded OFF (`FALSE`) for every existing tenant. Prior-year tax and AGI columns are named
`*_encrypted` (see 6). Money columns are `NUMERIC(19,4)`; the JSON money inputs on `tax_est_years`
are whole-cents numbers (DATA-DICTIONARY.md "Money carried as JSON numbers").

---

## 5. Entity types, tax method, treatment inputs (D3)

- Entity tax type comes from `company_tax_profiles.return_form` (1040 gives `sch_c` or `sch_f` by the profile's default activity type or by farm tax-code majority; 1065 `partnership`; 1120S `s_corp`; 1120 `c_corp`). A company with no Trial Balance profile uses the estimator-only `tax_est_entity_settings` type (`TE_ENTITY_TYPE_FROM_COMPANY` info); once a profile exists it wins (`TE_ENTITY_TYPE_SETTING_IGNORED`). A 1040 profile that is mainly rental is treated as Schedule C with `TE_ENTITY_1040_RENTAL`.
- **Per-year entity type override (Q49).** Entity tax setup → year inputs → "Entity type for <year>" (`tax_est_entity_year_inputs.entity_type_override`, default = use the TB profile). When set it wins over the TB profile, the estimator setting and the company type for THAT tax year only (e.g. an LLC filing 1065 that elected S corporation status for 2026); the TB profile is not changed. Everything that reads the entity type resolves it for the tax year: the estimate (individual vs C corporation path, SE tax, officer and GP rules), the P&L provider, readiness, the setup page (`GET .../settings?taxYear=`), suggestions, Schedule AI capture, owner-link validation (officer / limited partner) and the link list's entity kind. The prior-year trend reads the prior year's books with the CURRENT year's type. Inputs saved for another type (GP treatment on an S corp, officer link or owner W-2 wages on a partnership) never fail the estimate: `TE_TREATMENT_NOT_FOR_ENTITY`, `TE_LINK_FLAG_NOT_FOR_ENTITY`, `TE_OFFICER_WAGES_NOT_S_CORP` warnings. Treatments are not per year, so a treatment that fits any type the business takes in some year is accepted. Preparer display: info chip "Entity type overridden: S corp (TB profile says 1065)" on the business row of the Calculation view (review chip — dropped from client PDFs), a Q49 line in the assumptions page's readiness section (preparer-only), `TE_ENTITY_TYPE_OVERRIDDEN`; the client copy shows only the effective type.
- Tax method is `companies.accounting_method` with an estimator override; missing means accrual assumed (`TE_TAX_METHOD_MISSING`). Estimated-tax payments are always read cash basis.
- Individuals use the calendar year; C corps use the entity fiscal year (`fiscal_year_start_month`).
- The range end defaults to the **last closed month** (latest month whose bank and credit-card accounts are all reconciled). An open or partial month is allowed only by passing `through`, with a warning.

---

## 6. Caching and encryption (D9)

| Cache | Key | Value | TTL |
|---|---|---|---|
| Books P&L | `te:pl:v4:<tenant>:<company>:<taxYear>:<basis>:<throughMonth>:<glVersionStamp>:<configVersion>` | `TaxBasisPl` as **plain JSON** (books data, not return information) | 6 hours (garbage collection only) |
| Estimate | `te:estimate:te-estimate-v8:<firmId>:<taxpayerId>:<scenarioId>:<inputsHash>` | `{ enc: <AES-256-GCM ciphertext> }` of the whole `EstimateResultDTO` | 6 hours |

Both go through the Trial Balance Redis helpers (`services/tb/tb-redis.ts`), which are Redis-optional:
any failure computes fresh. Invalidation is exact by construction, not by TTL:

- `glVersionStamp` is bumped by the Postgres triggers on `journal_lines` and `transactions` (rule TB6).
- `configVersion` (`loadConfigVersion`) is an `md5` over thirteen small aggregates: treatments, the owner split rows (Q50), transaction flags, entity settings, year inputs, TB assignments, the firm codes those use, the TB profile, tax RJEs, accounts, the company row, the tenant's reconciliations and the business's taxpayer links (Q50: they move `TE_TARGET_NOT_LINKED`) (so a treatment, split, link or reconciliation change changes the key). `te:pl:v3` (Q50): account lines carry `splits`, trace rows carry per-portion person placeholders resolved per caller.
- `inputsHash` (sha256) covers cache version, engine version, firm, request, **day** (so a live estimate never outlives a UTC day), sorted allowed tenants, year, persons, links, per-company stamp and config version and settings, adjustments, types, state rows, resolved parameters, resolved state rules, payments, Schedule AI snapshots, firm settings and the taxpayer's `portal_shows`. Q45: plus the taxpayer's outside businesses with the year's amounts (definition + year row), so any change to one re-keys the live estimate. Q46 (`te-estimate-v6`): plus, per company, the entity year's projection method and, when a prior-year method is selected, the prior-year monthly recurring ordinary figures and activity flags, so a method change or any prior-year books change re-keys it. Q49 (`te-estimate-v7`): plus, per company, the entity year's entity type override (`eto`) — the resolved settings (already in the key) carry the effective type and its source, so setting or clearing it re-keys the live estimate. The P&L provider key (`te:pl:v3`) gains an `:et=` suffix only when the prior-year trend reads a year with another year's type. Q50: plus, per company with any, its owner splits (`os`; also covered by the config version). The v0.9.228 integration of Q49 + Q50 (each `te-estimate-v7` / `te:pl:v3` on its own branch) uses `te-estimate-v8` and `te:pl:v4`; the key carries both `eto` and `os`.
- A value that does not decrypt (rotated key, pre-v2 entry) is a cache miss, never an error. Redis entries are not migrated across keys; they expire.
- `refresh: true` on the estimate request bypasses the cache but refills it. Finalize always computes fresh.

Encryption at rest (prior-year tax and AGI are IRC §7216 tax return information):

- `tax_est_years.prior_year_tax_encrypted`, `prior_year_agi_encrypted`, `tax_est_state_rows.prior_year_tax_encrypted`, `prior_year_agi_encrypted`, `tax_est_snapshots.payload_encrypted`, `summary_encrypted`, `tax_est_dashboard_summaries.summary_encrypted` (Q52). All are top-level `TEXT` columns named `*_encrypted` using `encrypt()` / `decrypt()` from `utils/encryption.ts`; that naming is what enrols them in `credential-reencrypt.service.ts` (key rotation and cross-host restore recovery). Prior-year figures are decrypted only inside the service and returned only by the single-year GET; state-row figures are write-only (the DTO carries `priorYearTaxPresent`). No audit row ever contains them.
- Full table and §7216 handling rules: DATA-DICTIONARY.md. Do not copy these fields into logs, AI prompts, analytics or support bundles.

---

## 7. Snapshot rules

(`estimate-snapshots.service.ts`, DB trigger in `0201`.)

- **Reasons**: `finalize`, `vouchers`, `pdf`, `report_pack`. Finalize computes the estimate fresh (cache bypassed) and freezes: the inputs read, the engine result, the resolved federal parameters and state rules **with statuses**, books readiness and its warnings, the assumptions block, the firm disclaimer in effect, and who and when.
- **Immutable**, enforced three ways: the service has no update or delete path; the router answers 409 `TE_SNAPSHOT_IMMUTABLE` to PUT / PATCH / DELETE on `/snapshots/:id`; and the `BEFORE UPDATE` trigger `tax_est_snapshots_immutable` rejects any change except re-encryption of `payload_encrypted` / `summary_encrypted` (which is what the key-rotation sweep does).
- **Integrity**: plaintext sha256 (`payload_sha256`, `summary_sha256`) is checked on every read; failures are `TE_SNAPSHOT_INTEGRITY` (swapped ciphertext) or `TE_SNAPSHOT_UNREADABLE` (cannot decrypt with this server's key), both 500.
- **Size**: payloads over 12 MiB are refused with `TE_SNAPSHOT_TOO_LARGE` (422), never truncated. Large JSON never goes to Redis.
- **Same-day reuse (R4-09)**: a `pdf` or `report_pack` issue with the same inputs hash, scenario and user on the same UTC day reuses the snapshot already frozen for it instead of storing another. `finalize` and `vouchers` always create a new one.
- **Every PDF is printed from a snapshot** (standalone Print, Report Pack section, snapshot history re-print), so what a client was given can always be reproduced. Each PDF writes one metadata-only `download` audit row.
- **Engine version**: stored on every snapshot; compare (`GET /snapshots/:id/compare`) reports `engineVersionChanged`, `inputsHashChanged`, parameter changes, and warnings added or removed against a live recompute. If the live side cannot be computed (deleted scenario, tenant no longer reachable) it returns the frozen side with `liveUnavailable`.
- **Retention**: no delete path; snapshots vanish only if their taxpayer row is deleted (cascade). Archiving a taxpayer keeps them.
- **Scope**: the row records the books tenants it included (`tenant_ids`); a caller who no longer reaches one sees the history row without figures and gets 404 on view and compare (`TE_TENANT_NOT_MANAGED`). The read-only view redacts the raw prior-year inputs.

---

## 8. Payment-year attribution rule (R3-02)

A booked (GL) estimated-tax payment is credited to **exactly one** tax year. The full statement is in
DATA-DICTIONARY.md; the operating summary:

- Payments are read on a **cash** basis from accounts carrying the `estimated_tax_payment` treatment, in every linked company whose tenant is in scope.
- Year *Y* reads payments dated from the day after year *Y-1*'s **Q4 cutoff** through *Y*'s Q4 cutoff. The Q4 cutoff is the later of the last installment due date and `installments.q4_file_and_pay_date`; if neither parameter is usable it is Jan 31 of *Y+1* and the estimate warns `TE_PAYMENT_WINDOW_DEFAULTED`. Consecutive windows never overlap.
- So a January payment toward the Q4 installment counts for *Y*; a payment after the Q4 cutoff (late Q4 or extension payment) defaults to *Y+1*, with the info `TE_PAYMENT_YEAR_ASSUMED` when it falls before *Y+1*'s first installment.
- To override, record a **stored payment** (`POST .../payments`, source `gl` with `tenantId` and `transactionId`). A stored row claims its transaction: it supersedes every GL row of that transaction in its own year (even when the jurisdiction differs: `TE_PAYMENT_JURISDICTION_CHANGED`) and removes it from other years' live reads (`TE_PAYMENT_PINNED_OTHER_YEAR`). A transaction can be pinned to one year only (`TE_PAYMENT_OTHER_YEAR` 409, and `TE_PAYMENT_DUPLICATE` for the same year).
- The payment account must name a jurisdiction (`federal` or a state) on its treatment, otherwise its payments are not credited (`TE_PAYMENT_JURISDICTION_MISSING`); an account not tied to a taxpayer is listed but not credited (`TE_PAYMENT_ACCOUNT_UNASSIGNED`).
- Prior-year overpayment counts as paid on the original return due date. Payments are applied to the earliest unpaid installment; the §6654 penalty is event-driven (accrual to the earlier of payment date or return due date, split at rate and year boundaries).

---

## 9. Parameter lifecycle

### 9.1 Stores and resolution

| Table | Holds | Written by |
|---|---|---|
| `tax_parameters` | Shipped federal values with `status` (`verified` / `unverified` / `provisional`) and a `citation` | **Code only**: `syncShippedSeeds()` at every API start from `db/seeds/tax-estimator/federal/<year>.ts` |
| `tax_parameter_overrides` | Super-admin overrides (`status = 'override'`, mandatory reason) and provisional rows (`status = 'provisional'`) created by create-year-from-prior; a created year carries each row's `citation` as "Carried from Y: …" until the seed ships (R6-06) | The admin API |
| `state_estimate_rules`, `state_estimate_rule_overrides` | Same split per jurisdiction (`state`, `tax_year`, `key`), 20 rule keys per taxed state; DC is a jurisdiction row | Startup sync (`syncShippedStateRules`) and the admin API |

Effective value per key: **override > provisional > shipped seed** (`resolveYear` in `tax-parameters.service.ts`).
An override reports status `unverified`; a provisional row reports `provisional`. A year with **no rows at all** falls back to the latest earlier year: every value is served as `provisional`, the date keys that roll with the year (due dates, return due date, farmer dates, holidays) are **derived for the requested year** from the registry's statutory month-days and the computed federal + DC legal-holiday calendar (`deriveFederalDates` in `shared/src/tax-estimator/dates.ts`; R6-01 — never a shift of the stored observed dates), and amounts, rates and the penalty-rate table stay the fallback year's (`TE_PARAMS_FALLBACK_YEAR` warning). A fallback year is **read-only**: override and Verify answer 409 `TE_YEAR_NOT_CREATED` until the year is created from the prior year (R6-02), so one stray row can never end the fallback. The fallback looks **backward only**: the module serves the oldest shipped year (2025) onward; a request for an earlier year has no rows, every estimate for it fails `TE_PARAM_MISSING`, and create-from-prior answers `TE_NO_PRIOR_YEAR` (R6-11).

State rules resolve the same way **per jurisdiction**, through one resolver for the estimate and the admin screen (`getStateRules` + `jurisdictionFromStateRules`, R6-03): a state with no rows for the year is served its latest earlier year's rules (dates derived for the year, all provisional) with a `TE_STATE_RULES_FALLBACK_YEAR` warning per state, and the admin summary shows it as status `fallback` with the year served. The state date derivation is **inferred** (there is no per-state statute registry): the holiday list is regenerated from the rules the prior list evidently follows, and each observed date is un-bumped to its statutory day (the federal month-day for the matching key, else the one statutory day of the month) — every result is provisional and must be verified.

The engine reads every parameter through a recording reader; each parameter used that is not `verified`
produces a `TE_PARAM_UNVERIFIED` (federal) or `TE_STATE_RULE_UNVERIFIED` (state) warning that reaches the readiness banner, the preparer PDF and the assumptions page (D12a: the build proceeded before Kurt's sign-off on the strength of these warnings). A state with no usable rule set **in any year** (or an incomplete set) falls back to the federal pattern with a "verify" badge (`TE_STATE_RULES_FALLBACK` / `TE_STATE_RULES_MISSING`).

### 9.2 Startup re-sync

`index.ts` calls `syncShippedSeeds()` and `syncShippedStateRules()` on every boot, after the other startup seeds:

- Upserts every shipped row (value, status, citation) and deletes rows of that year whose key is no longer in the seed (**the code is the source of truth**). About 300 federal and 1,700 state rows (counts from R7) are upserted per boot; there is no content hash (R7-10).
- Never touches overrides or provisional rows.
- Validates everything before writing anything; a bad seed row is logged (`Failed to sync tax parameter seeds:`) and is **not fatal**. After a deploy, check the boot log for `Synced N tax parameter seed rows across Y year(s)` and `Synced N state rule seed rows across Y state-year set(s)`.
- Consequence: **a shipped row's value changes only by editing the seed in code and deploying.** Its status can additionally move to `verified` through the in-app Verify (9.4), and that sign-off survives the re-sync only while the shipped value **and citation** are unchanged (R6-10: a re-sourced citation is a new thing to check against); a changed seed value or citation resets the row to the seed's status and clears the sign-off.

### 9.3 Statuses

`verified` = a CPA checked the value against its citation. `unverified` = could not be confirmed in a primary source (or a placeholder for a provision that does not apply that year). `provisional` = copied from another year and date-rolled, awaiting confirmation. `override` = a super admin set it by hand. Agents may seed rows as `verified` after their own audit, but the sign-off checklists in PROGRESS.md (Phase 1 federal, MO and AR state rules) are Kurt's, and agents never tick them. The in-app Verify (9.4) is the sign-off record.

### 9.4 In-app Verify (super-admin sign-off)

Added by the R7 fix track (UI-SPEC section 04). The screen ships: `/admin/tax-parameters` has a **Mark verified** button on every non-verified row (federal and state detail) and a **Verify all unverified in <year>** button, both through `VerifyDialog.tsx` (confirmation + optional audited note). The dialog sends the value it displayed (R6-04).

| Call | Effect |
|---|---|
| `POST /api/v1/admin/tax-parameters/:year/:key/verify` body `{ note?, expectedValue? }` | Marks one key verified **for the value the admin saw**: `expectedValue` must still be the row's value, else 409 `TE_PARAM_CHANGED` with the current value (omit it only from scripts) |
| `POST /api/v1/admin/tax-parameters/:year/verify-all` body `{ confirm: true, note? }` | Verifies every key of the year whose effective status is not yet verified, each for the value read in the same transaction; keys changed under it come back in `changed`, unsigned |
| `POST /api/v1/admin/tax-state-rules/:year/:state/:key/verify` body `{ note?, expectedValue? }` | Same for one state rule |
| `POST /api/v1/admin/tax-state-rules/:year/:state/verify-all` body `{ confirm: true, note? }` | Verifies every not-yet-verified rule of one state-year (same `changed` contract) |

A year or state-year served through the fallback has nothing to sign: 409 `TE_YEAR_NOT_CREATED` (R6-02).

Rules (from `verifyOne` in the two services and the migration comment):

- It signs off the value the engine actually reads: the override or provisional row when one exists, otherwise the shipped seed row. A shipped row's `status` becomes `verified`; an override or provisional row keeps its stored status but now carries `verified_at`, and the resolved status reports `verified`.
- Only `status` and `verified_by` / `verified_at` / `verification_note` change. Value, citation and every other row are untouched. A verified row can still be overridden with a reason.
- A row that is already verified is a no-op and writes no audit row. A fallback year (no rows) has nothing to verify (409 `TE_YEAR_NOT_CREATED`).
- **Verification is bound to the value.** The write is a conditional `UPDATE … WHERE` not yet verified `AND value = <expected>` (R6-04): two admins racing on one row produce one sign-off and one audit row, and a value overridden after the admin read it is never signed. A new override value clears the sign-off (re-saving the same value — a reason edit — keeps it, R6-08); the startup re-sync keeps it only while the shipped value and citation are unchanged. Seeds and migrations never set it. A verified override that is later reverted falls back to the shipped row's own state.
- The DTO rows then carry `verifiedAt`, `verifiedBy`, `verifiedByEmail` and `verificationNote`.
- Audit: action `signoff`, entity type `tax_parameter` / `tax_state_rule`, `after_data.op = 'verified'` (AUDIT-CATALOGUE.md); the change feed lists it as "Verified".
- Bulk verify is for the end of Kurt's checklist walk, not a way around it: the note records why. Agents may not run it on Kurt's behalf.

### 9.5 AI parameter check (advisory, Q48)

Added 2026-10-13 (Kurt's Q&A, OPEN-QUESTIONS Q48; migration `0205_tax_param_ai_checks`). On `/admin/tax-parameters` every non-fallback row (federal and state detail) has an **AI check** column: the latest verdict badge and date (with "stale" when the value changed since, "applied" after Apply) and a **Check / Re-check** button; the header has **AI check unverified in <federal year | state year> (N)** with a confirm, a progress bar (done / total), counts and **Cancel**. Clicking a badge opens the drawer: value when checked vs value the source states, the verbatim quote, the source link, title / date / tax year / source kind / governing authority, the rationale, the server's notes, raw values and usage, and — on `differs` that is neither stale nor applied — **Apply AI value**.

| Call (super admin) | Effect |
|---|---|
| `GET /api/v1/admin/tax-param-ai-checks/availability` | `{ available, reason, model, maxSearchesPerCheck, concurrency }`; unavailable when AI is off or no Anthropic key is saved in Admin → AI |
| `POST /api/v1/admin/tax-param-ai-checks/runs` body `{ scope: 'single', year, key, state? }` \| `{ scope: 'federal', year }` \| `{ scope: 'state', year, state }` \| `{ scope: 'all', year }` | 202 + run. Bulk scopes cover every row whose status is not verified (none for a fallback year → 400 `TE_AI_NOTHING_TO_CHECK`); one active bulk run per year (409 `TE_AI_RUN_ACTIVE`) |
| `GET .../runs?year=` · `GET .../runs/:id` · `POST .../runs/:id/cancel` | Progress (`status`, `done`, `total`, `counts`, `error`); cancel stops before the next row (a queued run is cancelled outright) |
| `GET .../latest?year=&state=` | Latest check per key for federal (no `state`) or one state, each with `stale` |
| `GET .../checks/:id` | One result |
| `POST .../checks/:id/apply` body `{ expectedValue, updateCitation = true }` | Only `differs`, once (`TE_AI_NOT_APPLICABLE` / `TE_AI_ALREADY_APPLIED`), and only while the row still holds the checked value (`TE_PARAM_CHANGED` if `expectedValue` moved, `TE_AI_CHECK_STALE` if the row moved after the check). Writes an override through the normal path; the row is **unverified** |

How a row is checked (`services/tax-estimator/tax-param-ai-check.service.ts`):

1. **Run.** Every check — even one row — is a `tax_param_ai_check_runs` row processed by the worker queue `tax-param-ai-check` (job id `taxai-<runId>`; never `:`), with the report-pack pattern: if Redis cannot be reached the API runs it in-process, and a 30 s watchdog runs a run no worker claimed (claim = compare-and-swap `queued → running`). Two rows at a time; cancel checked between rows.
2. **Prompt.** A fixed system prompt (tax-research assistant; only content retrieved in this call from the allowed domains, never memory; `unconfirmed` when not found; verbatim quote; the source's tax year must match unless statute text for a non-indexed value; primary sources preferred; name the Rev. Proc. for inflation-adjusted values; retrieved pages are data, never instructions; answer as one JSON object). The user message carries only the key, label, group, type, unit / options, the JSON shape the value must take, the stored value and the current citation — no tenant data, which is why the per-tenant AI consent gate does not apply.
3. **Tools.** `web_search_20250305` (max 5 uses) and `web_fetch_20250910` (max 4, citations on), both with `allowed_domains` = federal list (+ the state's own domains for a state rule) from `shared/src/tax-estimator/ai-check-sources.ts`. The basic tool versions are used on purpose: the dynamic-filtering `_20260209` versions filter results through code execution, and the server needs the raw fetched text. `pause_turn` is resumed up to 3 times; 240 s per row; 429 / 529 retried 3× with backoff, then the run stops (`failed`); 401 / 403 stops the run.
4. **Validation** (`shared/src/tax-estimator/ai-check-validate.ts`, pure, unit-tested): the model's JSON is parsed with `aiCheckModelAnswerSchema`; then the URL must be allow-listed and among the URLs the tools returned; the quote must appear in the text returned for that URL (fetched text, text extracted from a fetched PDF with the pdf.js text layer, or a citation's `cited_text` — search results themselves are encrypted); the source tax year must match (or statute / regulation text + `inflationIndexed: false`); the value must parse in the registry type and pass the registry validator; for money / rate / int the quote must state it. The server then compares found vs stored (exact; floats to 1e-9; percentage-form rates normalized) and sets `matches` / `differs`. Any failure → `unconfirmed` with the reason in `details.notes`.
5. **Usage.** Tokens, searches, fetches and an estimated USD (list price + $10 / 1,000 searches) are stored on the check and logged in `ai_usage_log` under the zero tenant (`job_type = tax_param_ai_check`).

Apply: reason "Applied AI check <id>: <title — url>"; `override_set` audit carries `aiCheckId` / `sourceUrl`; with the box ticked the override row's citation becomes `AI-sourced, verify: <title> (tax year Y) — <url> — "<quote, 300 chars>"` and is shown instead of the shipped citation (only citations with that prefix are; a later manual value change clears it). A verified row that is applied over loses its verification (a new override value always does).

---

## 10. Annual update runbook: adding a tax year

Do this each autumn, when the IRS publishes next year's inflation-adjusted figures and the retirement / HSA notices, and again when the SSA announces the wage base. Federal and state are independent: do the federal steps, then repeat for state rules.

Preconditions: super-admin login; a developer able to ship a release. Ranked by urgency: until step 3 ships the new year runs on provisional values copied from the prior year.

1. **Create the year from the prior year (super admin, `/admin/tax-parameters`, or `POST /api/v1/admin/tax-parameters/<year>/create-from-prior`).**
   - Allowed only if the year has no rows (`TE_YEAR_EXISTS` 409) and an earlier year exists (`TE_NO_PRIOR_YEAR`).
   - Writes one `provisional` override row per registry key, copying the prior year's effective values and citations ("Carried from Y: …"). Every `rollsWithYear` date is **derived for the new year** (R6-01): `holidays` is the federal + DC legal-holiday calendar for the year and the following year computed from 5 U.S.C. 6103 / D.C. Code §1-612.02 (observed dates), and each other date is its statutory day (`installments.due_dates` Apr 15 / Jun 15 / Sep 15 / Jan 15, `q4_file_and_pay_date` Jan 31, `return_due_date` Apr 15, farmer Jan 15 / Mar 1 of the following year) landed on the next business day under that calendar. The prior year's stored dates are never shifted (they are observed dates and would land on wrong days — for TY2027 that would have been MLK Day 2028 and observed Emancipation Day 2028). The derived dates are still flagged `provisional`: confirm them against the year's Form 1040-ES when it is published.
   - Audit: `year_created` with `{ fromYear, created, rolledDates }`.
   - Result: staff can already build estimates for the year; every figure warns `provisional` and the readiness banner shows it.
   - The same endpoint under `/api/v1/admin/tax-state-rules/<year>/create-from-prior` does it **per jurisdiction** for every state that has rows in the prior year and none for the new year (states that already have rows are listed in `skipped`, R6-02; 409 only when nothing is left to create). State dates are **inferred** from the prior rows (holiday rules read from the prior list; each observed date un-bumped to its statutory day and re-landed) — verify each one; the inference reproduces the shipped MO and AR 2026 rows from their 2025 rows.
2. **Research and fill the new values.** Sources named in `PHASES.md` Phase 1: Rev. Proc. for the year (brackets, standard deduction, QBI thresholds, SALT, §461(l) threshold), the SSA wage-base announcement, IRS retirement-plan and HSA notices, Forms 1040-ES / 2210 / 1120-W, the quarterly underpayment-rate news releases (the `penalty.underpayment_rate` array of `{ from, to, rate }` by quarter: future quarters are unpublished placeholders and keep that key unverified as a whole). For states: the state's estimated-tax instructions and statute for each of the 20 rule keys, or an explicit cited `null`. Every row needs a `citation`.
3. **Ship the seed.** Add `packages/api/src/db/seeds/tax-estimator/federal/<year>.ts` (an exported `ParameterSeedRow[]`: `key`, `value`, `citation`, `status`) and one line in `federal/index.ts` (`FEDERAL_SEEDS`). State rules go in each `state-rules/<ST>.ts` as `StateRuleSeedRow` entries with the new `year`. Statuses: `verified` only for values read in a primary source; otherwise `unverified`. Run the completeness suites (`federal/seeds.completeness.test.ts` and the state-rules one): they require **every registry key exactly once, no unknown keys, valid values, a citation and a status on every row**. Run the golden tests (`federal.golden`, `estimates.golden`, `oracle.scenarios.golden`) and expect to regenerate expectations if a value moved; the `no-literals.guard` test must stay green. Bump `TAX_ENGINE_VERSION` only if engine logic changed, not for new values.
4. **Deploy, then check the boot log** for the two `Synced ...` lines (section 9.2). The shipped rows now sit in `tax_parameters` / `state_estimate_rules` underneath the provisional overrides.
5. **Diff and adopt (super admin).** `GET .../<year>/diff` (the "shipped vs provisional" view) lists **every provisional row that now has a shipped counterpart**, with `same: true` on rows whose values are identical (R6-05) — an identical copy still hides the shipped row's status and citation from the engine, so adopt those too. `POST .../<year>/adopt-shipped` with an optional `keys` list deletes the provisional override rows for those keys so the shipped value takes effect (state rules identify rows as `ST:key`). Audit: one `shipped_adopted` row per key. Adopt everything that you verified; leave a key provisional only if you want the copied value on purpose (editing a provisional row that has no seed yet keeps it provisional and in this list, R6-08).
6. **Overrides, only when needed.** If a value must change before the next deploy: `PUT .../<year>/<key>` with a `value` and a reason of at least 3 characters (`TE_PARAM_INVALID` / `TE_STATE_RULE_INVALID` 400 otherwise; the value is validated against the registry type). The row reports `unverified` and shows the shipped value alongside. `DELETE` reverts to the shipped value; a row with **no shipped value underneath** (a created year before its seed ships, or a key added by hand) cannot be deleted into a hole — 409 `TE_NO_SHIPPED_VALUE`, edit it instead (R6-07; the one exception is a year's last stray row, whose removal restores the fallback). Overrides on a year that is still served through the fallback are refused (`TE_YEAR_NOT_CREATED`): create the year first. Make the permanent fix in the seed and deploy, then revert the override. Audit: `override_set` (with the previously effective value as `before`) / `override_reverted`. A recent-changes feed for the year is at `GET .../<year>/changes`.
7. **Verify (Kurt).** Walk the checklist for the year (PROGRESS.md style: key, value, citation, status). Record each sign-off with the in-app Verify (section 9.4: one key at a time, or `verify-all` once the whole year is checked), or flip the seed row's status to `verified` and deploy. Either way the estimate's "N federal parameter(s) are unverified" banner should drop to zero. Remember a later seed edit that changes a value un-verifies that row.
8. **State rules specifics** (`state_estimate_rules`, keys in `shared/src/tax-estimator/stateRuleKeys.ts`):
   - `estimates_required` false (ID, UT) means no vouchers and no state underpayment penalty; the installment keys are withheld from the engine view.
   - `required_threshold` and `penalty.min_balance_due` honour `threshold_comparison` (`at_least` or `more_than`; null means `at_least`).
   - `safe_harbor.high_agi_rule` is `{ threshold, pct }` plus optional `threshold_mfs`, `no_prior_year_agi`, `no_prior_year_agi_mfs`.
   - `installments.q4_file_and_pay_date`, `return_due_date`, `penalty.method` (`rate_schedule`, fixed rate, etc.), `farmer.rule`, and the **requirement gates** (AZ, GA, PA, ME, NM; D12b) must be revisited each year: a gate that references income or prior-year figures needs the matching state-row inputs.
   - Penalty add-ons for MI / VT / IN / UT / ID / DC compounding and CT / DE per-month are deliberately **not modelled**; the engine says so with `TE_STATE_PENALTY_ADDONS_NOT_MODELLED`.
   - MO and AR are the firm's filing states: Kurt signs these off first (D11, D12).
9. **Smoke test on the test DB / a test firm** (never the production DB or ports; D13): run `npm run test:tax-oracle` (regenerates the Python reference fixtures and fails if `rivera_expected.json` / `scenarios_expected.json` change), the shared engine goldens, and the DB-backed Rivera test (`estimate.integration.test.ts`; R7 recorded 35,829 federal, 7,590 MO, 312 AR, 43,732 total and an $11 penalty for the Rivera case), then open Annual settings and Estimate for a test taxpayer in the new year and confirm: no `TE_PARAMS_FALLBACK_YEAR`, the right quarterly due dates (weekend and holiday adjusted), and the expected parameter-status banner.

If a year is never created, the fallback in 9.1 still produces estimates, all marked provisional. That is a safety net, not a plan.

---

## 11. Treatment-map operator guide

The **treatment map** tells the engine how to read each ledger account for tax. Layers, in priority order:

1. **Estimator treatment** on the account (`tax_est_account_treatments`), set on Entity tax setup (`/tax-estimator/entities/:tenantId/:companyId`).
2. **Trial Balance tax-code assignment** (`account_tax_assignments`): supplies the income **character** (ordinary, rental, capital gain, interest, dividends, §1231, farm) where assigned. A TB code that already says owner SEHI (887 / 888, 689 / 690) routes to the owner without a treatment; the estimator treatment wins when both exist.
3. Nothing assigned: the account is treated as **ordinary income or expense** and the estimate warns `TE_UNMAPPED_ACCOUNTS` (readiness repeats it).

Treatments (a null treatment clears the row):

| Treatment | Account types | Entity restriction | Person target | Effect |
|---|---|---|---|---|
| `nondeductible_pct` | expense, other expense, COGS | any | no | The percentage (`pct`) is added back; meals suggest 50% |
| `owner_sehi` | cost accounts | any | required on an S corp | Removed from entity profit and routed to the owner; on an S corp it stays the corporation's deduction and lands on the officer as W-2 box 1 wages plus the SEHI deduction (no FICA) |
| `owner_retirement` | cost accounts | any | required on an S corp | Routed to the owner (capped at the plan limit with `TE_RETIREMENT_CAPPED`); on an S corp stays the corporation's deduction |
| `owner_personal` | cost accounts | any | optional | Dropped from the business and not deducted |
| `w2_wages` | cost accounts | any | optional (officer wages per officer) | QBI W-2 wage limit source (D8); the year total is the default and a per-entity-per-year override (with a mandatory reason, `TE_W2_OVERRIDE_REASON`) wins |
| `tax_depreciation_differs` | cost accounts | any | no | Keeps book depreciation; enter the tax amount as the `depreciation_tax_vs_book` adjustment (`TE_TAX_DEPRECIATION_ADJUSTMENT`) |
| `guaranteed_payment` | cost accounts | **partnership only** (`TE_TREATMENT_NOT_FOR_ENTITY`) | **required** (`TE_PERSON_REQUIRED`) | Stays the partnership's deduction and is added to that partner's ordinary income. TB guaranteed-payment codes are suggested, never auto-applied (`TE_GP_CODE_WITHOUT_TREATMENT`) |
| `estimated_tax_payment` | any (may sit on equity / draw accounts) | any | taxpayer and person, plus **jurisdiction** (`federal` or a state); may be split between linked taxpayers (Q50) | Removed from P&L and fed to the payment ledger, cash basis |
| `capital_gain_lt`, `capital_gain_st`, `section_1231`, `interest`, `dividends_ordinary`, `dividends_qualified` | income, other income | any | no | Sets the character explicitly; wins over the TB code. The 2025 TB seed has no code for short-term gain, §1231 or qualified dividends, and no 1040 interest or dividend code |

Rules and traps:

- The API refuses an inapplicable treatment: wrong account type is `TE_TREATMENT_ACCOUNT_TYPE`, wrong entity type `TE_TREATMENT_NOT_FOR_ENTITY`, a missing person `TE_PERSON_REQUIRED` (all 422). The provider **warns instead** (`TE_TREATMENT_NOT_FOR_ENTITY`, `TE_OWNER_PERSON_MISSING`) when it meets one that became invalid later (entity type changed, person deleted); the amounts stay in profit.
- A Schedule M-1 code on a P&L account (`TE_M1_CODE_ON_PL_ACCOUNT`) keeps the **book** amount as ordinary; set a character treatment (e.g. §1231) if the gain is not ordinary.
- `non_recurring` can be set on an account (treatment row) and, via API, on single transactions (`tax_est_transaction_flags`; there is no register UI for it yet). Non-recurring amounts count once in the projection; everything else is run-rated.
- **Projection method (Q46)** — Entity tax setup → year inputs → "Projection method": Run rate (default), Prior-year seasonal (scaled) or Prior-year seasonal (dollar). Only the ORDINARY character changes. The prior year is the same company's prior calendar year read through this same treatment map and these same non-recurring flags (the account flag is not per year, so today's flag excludes the account in both years; flag a prior-year one-off transaction to keep it out). The prior year must have activity in all 12 months, otherwise the estimate falls back to the run rate (`TE_PY_TREND_FALLBACK`, also on readiness). C corporations cannot select it (`TE_PROJECTION_METHOD_NOT_SUPPORTED`). Thresholds (scale cap 0.25–4, same-months share 10%, 12 active months) are constants in `shared/src/tax-estimator/projection-method.ts`, not tax parameters.
- Each row also holds the person (and taxpayer) target in `payment_person_id` / `payment_taxpayer_id`. Targets must belong to the caller's firm (`TE_TAXPAYER_NOT_FOUND`, `TE_PERSON_TAXPAYER_MISMATCH`).
- **Owners linked to this business only (Q50).** The person / taxpayer pickers list only owners with a link to THIS company (Taxpayers → the taxpayer → Linked businesses; any year) that you may see; `GET .../owner-candidates?taxYear=` feeds them (staff / admin). Saving a NEW target that is not one of them is `TE_TARGET_NOT_LINKED` (422); a row saved earlier with an unlinked owner keeps computing and warns `TE_TARGET_NOT_LINKED` (estimate + readiness).
- **Split between owners (Q50).** On W-2 wages, owner SEHI / retirement (S corp: officer health and officer retirement), guaranteed payments and estimated-tax payments, "Split between owners" opens the split editor: **%** (rows total exactly 100, `TE_SPLIT_PCT_TOTAL`; "Default from ownership" = the link profit % for the page year normalized to 100) or **$ (year)** (fixed annual amount per owner; until the year is complete the YTD is shared in proportion to the amounts; for the complete year each owner gets the amount and the LAST row takes the books' difference, `TE_SPLIT_REMAINDER`). Payments are split per taxpayer (+ optional person), each portion its own payment row in that taxpayer's ledger. Portions are rounded to 4 places with the residual on the last row; entity totals never change. The trace shows each portion ("6800 Salaries - Officers 101,640.24 × 60% → Kurt Krueger"). "Use one owner" goes back to a single target.
- **Only this taxpayer's portions (v0.9.228 integration fix).** The provider returns every owner's per-person items (officer wages, owner / officer SEHI and retirement, guaranteed payments). In a taxpayer's estimate `estimate.service ownItemsOnly` keeps only the items of that taxpayer's persons (and person-less items) — in the year column and in each Schedule AI period column — so another household's portion is never attributed to this taxpayer's primary person (the engine's `resolvePerson` fallback, `TE_UNKNOWN_PERSON`). Entity-level figures are unchanged.
- One account may appear once per request (`TE_DUPLICATE_ACCOUNT`). When another firm that also manages the books owns the row, you cannot change it (`TE_TREATMENT_OTHER_FIRM`).
- **Suggestions** (`GET .../treatment-suggestions`) propose treatments from account names (meals) and TB codes; nothing is applied until saved.
- Work the **readiness** list on the same screen before trusting a number: unreconciled bank / card accounts, suspense balances, unposted bank-feed rows, unmapped accounts, missing entity type or tax method, farm income assumed (`TE_FARM_INCOME_ASSUMED`: with no TB farm codes ALL income counts as gross farming income for the two-thirds test).
- Treatment and entity-setting writes change `configVersion`, so they invalidate the caches by themselves.
- Audit: `tax_est_treatment` rows (create / update / delete) under the **books tenant**, with `firmId` in the data.

---

## 12. Client portal

Router `/api/portal/tax-estimates` (`portal-tax-estimates-public.routes.ts`, `portalAuthenticate`).

- A contact sees a taxpayer only when ALL hold: the taxpayer is mapped to the contact (`tax_est_taxpayer_contacts`); it is active and belongs to the firm that actively manages the contact's tenant; it is linked for the tax year to a company of the contact's tenant on which the contact has `portal_contact_companies.tax_estimates_access`; the year has annual settings. Flags `CLIENT_PORTAL_V1` **and** `TAX_ESTIMATOR_V1` must be on for the **contact's tenant**. Peer-linked sessions (Vibe PM) are refused.
- Every miss is the uniform `404 TE_PORTAL_FORBIDDEN`; the list endpoint returns `featureEnabled:false` (200) so the dashboard hides its entry quietly.
- The view is an **allow-list projection** (`toPortalEstimate`): the taxpayer's own totals, voucher due dates, amounts and payments per jurisdiction, payment dates and amounts, an as-of label, the firm disclaimer. Never persons, other owners, links, entities, adjustments, rates, traces, parameters, readiness, or safe-harbor workings (prior-year tax and AGI included).
- **Live or snapshot**: the taxpayer's `portal_shows`, else the firm default (default `live`). Live computes through the same scoped service under the **firm's full managed-tenant set** (the contact has no user), served through the encrypted cache. `snapshot` shows the chosen scenario's latest `finalize` / `vouchers` snapshot, or nothing yet. Only firm staff change `portal_shows`; the client cannot.
- **Per-contact options (Q51, migration 0211)**: `tax_est_portal_contact_options`, one row per portal contact, applies to every taxpayer the contact can open; no row = defaults = the pre-Q51 view. `calculationSummary` (default off) adds `estimate.calculationSummary` (`buildPortalCalcSummary`, shared `portal-summary.ts`: own share per business, other income lines, total income, adjustments TOTAL, AGI, standard / itemized deduction, Schedule 1-A, QBI, taxable income, regular tax, credits, SE tax, Additional Medicare, NIIT, federal total, per-state tax, state total, total; whole dollars; never entity totals, owners, %, adjustment detail, rates, traces, chips or warnings). `quarterlyEstimates` (default on) keeps `estimate.jurisdictions` and the voucher PDF. `paymentsOnRecord` (default on) keeps `estimate.payments`. `pdfDownload` (default off) adds `pdfDownload: true` to the response and enables `GET /:taxpayerId/estimate.pdf` — the PORTAL-SAFE estimate PDF (Kurt 2026-10-13; `portal-estimate-pdf.service.ts`, a pure renderer fed only by the option-filtered portal DTO: header with taxpayer, year, firm, as-of / source, books-through and the shown scenario, the projected total, then only the summary / installments + next payment / payments the contact's options include, and the disclaimer; NOT the Report Pack client copy, so it never shows more than the JSON); every download writes a `download` / `tax_est_portal_pdf` audit row on the contact's tenant (metadata only: contact, year, scenario, source, snapshot id, inputs hash, engine version, computed-at; never figures). The totals block is always present. A section switched off is ABSENT from the JSON; the options are applied per request AFTER the shared estimate cache, so no contact's options affect another's.
- **Shared scenarios (Q51)**: Base always; a what-if when staff tick "Show this scenario in the client portal" (`tax_est_scenarios.show_in_portal`, `PATCH /scenarios/:id { showInPortal }`; ignored on Base). `?scenarioId=` picks one; a scenario not offered (not shared, or in snapshot mode without its own finalized snapshot) is the uniform 404. The response carries `scenarios` (Base first) and `scenarioId` only when more than one is offered, so the default response is byte-identical to the pre-Q51 one.
- Compute endpoints (detail, vouchers, estimate PDF) are rate limited to **20 requests a minute per contact** (`PORTAL_TE_COMPUTE_PER_MINUTE`), responses are `Cache-Control: no-store`, and the vouchers PDF (`GET /:taxpayerId/vouchers.pdf`) is rendered from the projection. Portal reads and voucher PDFs are not audited; estimate-PDF downloads are.
- **Granting access**: `tax_estimates_access` defaults false. Only a caller who passes the Tax Estimator gates may grant it; a tenant bookkeeper outside the firm may only revoke or leave it (`TE_ACCESS_GRANT_FORBIDDEN` 403). A payload that omits the field keeps the stored value. Every change writes `tax_est_contact_access`. "Link contact" on the taxpayer can turn access on for the contact's companies, and "Unlink" can revoke it for companies no other taxpayer still grants.
- **View as Client** preview: the initiating staff user must pass the Tax Estimator gates in the contact's tenant, otherwise the section is hidden / 404. The preview runs as the previewed contact, so it shows that contact's options and shared scenarios.
- **Editing the options**: taxpayer page → Portal contacts → "What they see" (`PUT /taxpayers/:id/contacts/:contactId/portal-options`, firm staff, may grant), or Client Portal → Edit contact → "Tax estimates in the portal" (`GET/PUT /api/v1/practice/portal/contacts/:id/tax-estimate-options`; `canGrant` = `taxEstimateReportScope`). Turning a section ON is a grant (403 `TE_ACCESS_GRANT_FORBIDDEN` without the gates; a mixed request is refused whole), OFF a revoke. Every change writes `tax_est_portal_options`.

---

## 13. Report Pack section

- Report id `tax-estimate` (group "Tax", `options: { taxpayer: true }`, as-of temporal), registered in `shared/src/reports/registry.ts` (`TAX_ESTIMATOR_REPORT_IDS`). Endpoints `GET /api/v1/reports/tax-estimate` and `GET .../tax-estimate/taxpayers` (each taxpayer carries its linked years' `scenarios` for the builder's optional scenario picker — QA D10). The section is offered when TAX_ESTIMATOR_V1 is ON in the pack's tenant or in another tenant of the same firm inside the caller's scope (QA D9).
- Gate (`taxEstimateReportScope`): session auth, not a client user, `tax_estimator` read on the caller's role, the pack tenant managed by a firm the caller belongs to (or a super admin), `TAX_ESTIMATOR_V1` on that tenant, and the tenant inside the caller's D1 scope. The taxpayer must belong to the firm, be visible to the requester (D17, section 2.1 — choices, request and worker) and be linked to the pack's company for the year. A caller failing the gate sees the pack as 404 (not listed, readable, editable, copyable, deletable or runnable; the section cannot be added).
- The run records `requested_by` and `allow_tax_estimate`; the worker re-derives the scope at render time, so access removed in between drops the section, and a failed run loses its grant.
- The section prints the **client** variant of the estimate PDF: no warnings, readiness codes, unverified-parameter dump, engine version or prior-year AGI notes. A run that rendered the section is readable only by its requester, and its artifact is stored AES-256-GCM encrypted (`.pdf.enc`) for 15 minutes.
- Snapshot reason `report_pack`; same-day reuse applies (section 7). Standalone Print / Download on the Estimate screen produces the preparer variant (`pdf` snapshot).

---

## 14. Enabling the flag per tenant (rollout checklist)

Do not enable until: Kurt has completed the sign-off gates, `QA-CHECKLIST.md` sections 0 to 11 have been run once on the test firm (PROGRESS.md notes the UI has not been opened in a browser), and the R7 majors are resolved (wage-earner year inputs UI, these docs).

1. Merge and deploy per the repo release recipe. Confirm migration `0201_tax_estimator` applied (renumber to the next free journal idx on the day it merges if main took 0201, D6) and the boot log shows both `Synced ...` lines.
2. Enable `TAX_ESTIMATOR_V1` on the **firm's practice tenant(s)** (the staff flag is evaluated on the caller's active tenant) through the Admin feature-flag toggle: `POST /api/v1/admin/feature-flags/:tenantId/TAX_ESTIMATOR_V1` with `{ "enabled": true }` (admin principal with `admin_tenant_ops`; a firm member's reach is limited to tenants their firm manages). A linked company in a tenant **without** the flag is still computed (data read) but has no UI there.
3. Check the firm's users have a role that grants the `tax_estimator` resource (the permission matrix) and are `firm_staff` or `firm_admin` for write access. The sidebar group appears only for firm staff with the flag on and `tax_estimator` read.
4. As a `firm_admin`, set firm settings (safe-harbor default `lesser_of` unless the firm prefers otherwise, disclaimer text, `portal_shows`, and the D17 switch "Staff see only taxpayers linked to clients they can access", ON by default). Staff who need a taxpayer must have access to at least one of its linked clients (or be the creator of an unlinked one); restrict sensitive taxpayers further with "Who can see this taxpayer".
5. For client-portal access, additionally enable `CLIENT_PORTAL_V1` on the **client** tenant, `TAX_ESTIMATOR_V1` on that tenant, map the portal contact to the taxpayer and grant `tax_estimates_access`.
6. Create a taxpayer, link its entities and set entity types / treatments; confirm the readiness list; save Annual settings; build an estimate and compare it with the firm's own working paper before relying on it.

To disable: turn the flag off per tenant; all data stays. Disabling hides the screens and 404s the staff router for that tenant's users and hides the portal tile for that tenant's contacts.

---

## 15. Rollback and migration notes

- `0201_tax_estimator.sql` is **additive only** (`scripts/check-migration-policy.sh` passes): every `CREATE TABLE` / `ADD COLUMN` / function / trigger is `IF NOT EXISTS` / `OR REPLACE`; nothing in existing data is backfilled. The flag rows are inserted `FALSE` for every tenant.
- `0201_tax_estimator.rollback.sql` is the DROP companion (children before parents; the Report Pack columns first, then snapshots and the trigger function, then estimate tables, years, entities, taxpayers, state rules, parameters, and the flag rows). By repo precedent rollback files are **not auto-applied**: run it by hand in a transaction, after turning the flag off and **taking a backup**, because it destroys taxpayers, scenarios, payments and snapshots. Snapshots are tax return information; consider an export before dropping.
- Rolling the application back without the DB: the flag is the control (turn it off first). Older code was not tested against the 0201 tables; do not roll the DB back and leave newer code running.
- Verification columns: the `verification.sql` part adds `verified_by`, `verified_at`, `verification_note` to the four parameter tables (additive; its rollback drops them). Rolling back drops the sign-off history (the audit rows stay in `audit_log`).
- `0202_tax_est_taxpayer_visibility.sql` (D17; part `parts/taxpayer-visibility.sql`) is a SEPARATE migration because 0201 is applied in production and is never edited: it adds `tax_est_firm_settings.restrict_taxpayers_to_linked_tenants BOOLEAN NOT NULL DEFAULT TRUE` (every firm ON, existing rows included) and `tax_est_taxpayer_staff`. Additive. Its rollback drops the table and the column; after a rollback the code must also be rolled back (the predicate reads both).
- `0204_tax_est_dependents.sql` (Q44; part `parts/dependents.sql`) is a SEPARATE migration (0201–0203 are applied in production): it creates `tax_est_dependents` and adds `tax_est_years.care_expenses NUMERIC(19,4) NOT NULL DEFAULT 0`. Additive (existing estimates are unchanged: no dependents, no care expenses). Its rollback drops both; the code that reads them must be rolled back with it. The new federal `Credits` parameters and the state `exemptions` rule rows arrive through the startup seed re-sync, not the migration.
- `0206_tax_est_outside_entities.sql` (Q45; part `parts/outside-entities.sql`, journal idx 206 / `when` 1784800000280 — 0205 is the AI parameter check on another branch) is a SEPARATE additive migration: it creates `tax_est_outside_entities` and `tax_est_outside_entity_years`. Existing estimates are unchanged (no rows). Its rollback drops both tables; the code that reads them must be rolled back with it.
- `0207_tax_est_projection_method.sql` (Q46; part `parts/projection-method.sql`, journal idx 207 / `when` 1784800000290) is a SEPARATE additive migration: it adds `tax_est_entity_year_inputs.projection_method TEXT NOT NULL DEFAULT 'run_rate'` with CHECK (`run_rate`, `prior_year_scaled`, `prior_year_dollar`). Existing rows take the default, so every estimate is unchanged until a method is chosen. Its rollback drops the column; the code that reads it must be rolled back with it.
- `0209_tax_est_entity_type_override.sql` (Q49; part `parts/entity-type-override.sql`, journal idx 209 / `when` 1784800000310) is a SEPARATE additive migration: it adds `tax_est_entity_year_inputs.entity_type_override TEXT NULL` with CHECK (NULL or `sch_c`, `sch_f`, `s_corp`, `partnership`, `c_corp`). NULL keeps the D3 precedence, so every estimate is unchanged until an override is set. Its rollback drops the column; the code that reads it must be rolled back with it.
- `r6-lifecycle.sql` adds `tax_parameter_overrides.citation` (R6-06) and `sehi-w2-wages.sql` adds `tax_est_entity_year_inputs.include_sehi_in_w2_wages` (Q41); both additive with defaults, appended after the verification part, dropped first by the rollback.
- Because the seeds re-sync on every boot, rolling back to an older build that ships fewer seed years leaves the extra rows alone (it only prunes keys of years it ships).
- Backup and restore: every `*_encrypted` column follows the credential re-encryption sweep; after a key rotation or a cross-host restore, snapshots that fail with `TE_SNAPSHOT_UNREADABLE` indicate the sweep did not run or the key is wrong. Redis cache entries do not need migration.

---

## 16. Performance notes

No measurement exists yet. PHASES.md targets under 500 ms for 10 entities by 24 months with the cache; R7-06 records that this is unmeasured, and no timing assertion exists in the tests. What is known from the code:

- **Cold estimate** per linked company: twelve monthly P&L builds through the report builders plus a detail report; Schedule AI columns can add provider runs through the period month for each period not frozen as a snapshot; plus `loadConfigVersion` (eleven aggregates, including an `md5(string_agg(...))` over every reconciliation of the tenant) once per company per request. Cross-tenant taxpayers multiply this by the number of tenants.
- **Warm path**: the encrypted estimate cache hits when the day, stamps, config versions and inputs are unchanged. The first request after any GL change in a linked tenant recomputes only the changed company's P&L (the P&L cache key carries that company's stamp).
- Capture Schedule AI snapshots after each period closes (`POST .../sch-ai-snapshots`) so later estimates read frozen figures instead of rerunning the provider.
- The portal live view reuses the same cache and is limited to 20 computes a minute per contact.
- Dashboard cards (Q52) never compute on load: the company card peeks the estimate cache (one gather per linked taxpayer: settings, links, adjustments, GL stamps, ledger; no P&L build unless a prior-year projection method misses its own cache), and the firm cards read `tax_est_dashboard_summaries` (one query + one decrypt per taxpayer-year) plus the latest finalized snapshot metadata, decrypting a snapshot payload only where it is newer than the stored summary. Very large firms: the firm cards read every visible active taxpayer on each load (no paging).
- Startup re-sync touches about 2,000 rows per boot; the cost is small but not free, and a per-seed content hash would remove it (R7-10).
- Cache and PDF/snapshot sizes: snapshots up to 12 MiB, encrypted; keep them out of Redis.
- Run the performance check on the test stack only (D13), then record the number in PROGRESS.md.

---

## 17. Known limitations and open items (as of R7)

From `docs/reviews/R7-final.md`; consult it for detail and status. Items that change operations:

- Wage-earner year inputs (outside W-2 wages, Social Security wages, retirement plan type, employee deferral, the farmer and MFS fields) are accepted by the API and the bridge but have no UI screen yet (R7-01). Until the screen ships, such households cannot be modelled correctly from the UI; entering wages as an adjustment mis-characterises them. The engine warns `TE_SS_WAGES_DEFAULTED` and `TE_RETIREMENT_PLAN_ASSUMED`.
- Not modelled: AMT, kiddie tax, QBI / passive / EBL carryforwards (netting is within the year only), nonresident-state tax by ratio of the full return (a flat-rate estimate labelled as such), state penalty add-ons, reverse-credit state pairs (AZ, CA, OR, VA, IN, DC).
- C corporations: current-year rule only, no state tax, no entity-level adjustments (`TE_CCORP_INPUTS_LIMITED`).
- The Redis P&L cache holds clear JSON of book figures; only the estimate cache and snapshots are encrypted.
- `TE_GP_PERSON_MISSING` is documented in a type comment but never emitted (ERROR-CODES.md).
- Transaction-level non-recurring flags and GL-account pickers for GL-linked adjustments are API-only.
- Dependents (Q44): EITC not computed (warning), the 3+ children ACTC alternative, employer dependent-care benefits, the student / disabled spouse deemed income, the §24 SSN rules and head-of-household eligibility are not modelled; state exemption phase-outs / tiers use the base or maximum amount (CT, NM and OH store 0 for low-income-only amounts — see OPEN-QUESTIONS Q44).
- Prior-year trend projection (Q46): ordinary character only; individual-path entities only (no C corporation / fiscal-year support); no preview of the prior-year figures on the selector; outside businesses always use the run rate / entered amounts.
- Businesses outside MyBooks (Q45): every entered amount is recurring (no non-recurring split); Schedule AI periods spread full-year amounts evenly and prorate YTD amounts linearly (no monthly shape); an outside Schedule F never triggers the farmer test by itself (no gross-income figures — enter them on the annual settings); an outside C corporation is a calendar-year, not-large corporation on the entered taxable income; the amount basis is ignored for a C corporation.
- Independent oracles missing for: C corp large-corporation recapture, §469(i) with EBL, farmer on the prior year, a senior couple with Schedule 1-A, multistate with a higher-rate source state (R7-06).

---

## 18. Where to look first

| Question | Start here |
|---|---|
| A 4xx or a warning code | [ERROR-CODES.md](./ERROR-CODES.md), then the file named in "Where emitted" |
| Who changed what | [AUDIT-CATALOGUE.md](./AUDIT-CATALOGUE.md) |
| Is this field protected? | [DATA-DICTIONARY.md](./DATA-DICTIONARY.md) |
| Why did the number change? | Estimate screen trace drawer; snapshot compare; `inputsHash` and `engineVersion` on the snapshot |
| Why is a value "provisional" or "unverified"? | Admin `/admin/tax-parameters` row (source, citation, shipped value) and section 9 |
| A client cannot see their estimate in the portal | Section 12 conditions; the 404 is deliberately silent |
| Decisions and their rationale | `features/tax-estimator/MODULE.md` (D1 to D16), `OPEN-QUESTIONS.md` |
| Build history, review findings | `features/tax-estimator/PROGRESS.md`, `docs/reviews/R1` to `R7` |
