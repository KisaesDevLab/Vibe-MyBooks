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
              encrypted Redis cache: te:estimate:te-estimate-v2:<firm>:<taxpayer>:<scenario>:<hash>
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
vs itemized deduction, Schedule 1-A, QBI, regular tax with the QD / LTCG worksheet, credits,
Additional Medicare, NIIT, federal total. The kit file lists the same steps with the legal basis.

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
7. Per route, mutations also pass `requireTaxEstimatorWrite` (`firm_admin` or `firm_staff` only; otherwise `TE_NOT_FIRM_STAFF` 403). Firm settings writes need `firm_admin` (`TE_FIRM_ADMIN_REQUIRED`).

| Area | Routes (relative to `/api/v1/tax-estimator`) |
|---|---|
| Scope, parameters | `GET /scope`, `GET /parameters/:year` |
| Taxpayers | `GET/POST /taxpayers`, `GET /taxpayers/company-options`, `GET/PATCH/DELETE /taxpayers/:id` (DELETE archives), `PUT/DELETE /taxpayers/:id/persons/:role`, `GET/PUT /taxpayers/:id/links`, `DELETE /taxpayers/:id/links/:linkId`, `GET/POST /taxpayers/:id/contacts`, `DELETE /taxpayers/:id/contacts/:contactId` |
| Entity setup | `/entities/:tenantId/:companyId/` + `settings` (GET/PUT), `year-inputs/:taxYear` (GET/PUT), `treatments` (GET/PUT), `treatment-suggestions`, `transaction-flags` (GET/PUT), `readiness`, `tax-basis-pl` |
| Annual settings | `GET /taxpayers/:id/years`, `GET/PUT /taxpayers/:id/years/:taxYear`, scenarios (`GET/POST .../scenarios`, `PATCH/DELETE /scenarios/:id`, `POST /scenarios/:id/clone`), adjustments (`GET/POST /scenarios/:id/adjustments`, `PATCH/DELETE /adjustments/:id`), state rows (`GET/PUT /scenarios/:id/state-rows`), adjustment types (`/adjustment-types`), `GET/PUT /firm-settings` |
| State rules (read) | `GET /state-rules/:year`, `GET /state-rules/:year/:state` |
| Estimate | `POST /taxpayers/:id/years/:taxYear/scenarios/:scenarioId/estimate`, `GET .../readiness`, payments (`GET/POST .../payments`, `PATCH/DELETE /payments/:id`), Schedule AI (`GET/POST .../sch-ai-snapshots`) |
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
| Books-scoped (tenant_id) | `tax_est_entity_settings`, `tax_est_entity_year_inputs`, `tax_est_account_treatments`, `tax_est_transaction_flags` |
| Per taxpayer and year | `tax_est_years`, `tax_est_scenarios`, `tax_est_adjustments`, `tax_est_state_rows`, `tax_est_payments`, `tax_est_sch_ai_snapshots` |
| Frozen output | `tax_est_snapshots` (trigger `trg_tax_est_snapshots_immutable`) |

Columns added to existing tables: `portal_contact_companies.tax_estimates_access` (default false) and
`report_pack_runs.requested_by`, `report_pack_runs.allow_tax_estimate` (default false). The flag is
seeded OFF (`FALSE`) for every existing tenant. Prior-year tax and AGI columns are named
`*_encrypted` (see 6). Money columns are `NUMERIC(19,4)`; the JSON money inputs on `tax_est_years`
are whole-cents numbers (DATA-DICTIONARY.md "Money carried as JSON numbers").

---

## 5. Entity types, tax method, treatment inputs (D3)

- Entity tax type comes from `company_tax_profiles.return_form` (1040 gives `sch_c` or `sch_f` by the profile's default activity type or by farm tax-code majority; 1065 `partnership`; 1120S `s_corp`; 1120 `c_corp`). A company with no Trial Balance profile uses the estimator-only `tax_est_entity_settings` type (`TE_ENTITY_TYPE_FROM_COMPANY` info); once a profile exists it wins (`TE_ENTITY_TYPE_SETTING_IGNORED`). A 1040 profile that is mainly rental is treated as Schedule C with `TE_ENTITY_1040_RENTAL`.
- Tax method is `companies.accounting_method` with an estimator override; missing means accrual assumed (`TE_TAX_METHOD_MISSING`). Estimated-tax payments are always read cash basis.
- Individuals use the calendar year; C corps use the entity fiscal year (`fiscal_year_start_month`).
- The range end defaults to the **last closed month** (latest month whose bank and credit-card accounts are all reconciled). An open or partial month is allowed only by passing `through`, with a warning.

---

## 6. Caching and encryption (D9)

| Cache | Key | Value | TTL |
|---|---|---|---|
| Books P&L | `te:pl:v2:<tenant>:<company>:<taxYear>:<basis>:<throughMonth>:<glVersionStamp>:<configVersion>` | `TaxBasisPl` as **plain JSON** (books data, not return information) | 6 hours (garbage collection only) |
| Estimate | `te:estimate:te-estimate-v2:<firmId>:<taxpayerId>:<scenarioId>:<inputsHash>` | `{ enc: <AES-256-GCM ciphertext> }` of the whole `EstimateResultDTO` | 6 hours |

Both go through the Trial Balance Redis helpers (`services/tb/tb-redis.ts`), which are Redis-optional:
any failure computes fresh. Invalidation is exact by construction, not by TTL:

- `glVersionStamp` is bumped by the Postgres triggers on `journal_lines` and `transactions` (rule TB6).
- `configVersion` (`loadConfigVersion`) is an `md5` over eleven small aggregates: treatments, transaction flags, entity settings, year inputs, TB assignments, the firm codes those use, the TB profile, tax RJEs, accounts, the company row and the tenant's reconciliations (so a treatment edit or a reconciliation change changes the key).
- `inputsHash` (sha256) covers cache version, engine version, firm, request, **day** (so a live estimate never outlives a UTC day), sorted allowed tenants, year, persons, links, per-company stamp and config version and settings, adjustments, types, state rows, resolved parameters, resolved state rules, payments, Schedule AI snapshots, firm settings and the taxpayer's `portal_shows`.
- A value that does not decrypt (rotated key, pre-v2 entry) is a cache miss, never an error. Redis entries are not migrated across keys; they expire.
- `refresh: true` on the estimate request bypasses the cache but refills it. Finalize always computes fresh.

Encryption at rest (prior-year tax and AGI are IRC §7216 tax return information):

- `tax_est_years.prior_year_tax_encrypted`, `prior_year_agi_encrypted`, `tax_est_state_rows.prior_year_tax_encrypted`, `prior_year_agi_encrypted`, `tax_est_snapshots.payload_encrypted`, `summary_encrypted`. All are top-level `TEXT` columns named `*_encrypted` using `encrypt()` / `decrypt()` from `utils/encryption.ts`; that naming is what enrols them in `credential-reencrypt.service.ts` (key rotation and cross-host restore recovery). Prior-year figures are decrypted only inside the service and returned only by the single-year GET; state-row figures are write-only (the DTO carries `priorYearTaxPresent`). No audit row ever contains them.
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
| `tax_parameters` | Shipped federal values with `status` (`verified` / `unverified`) and a `citation` | **Code only**: `syncShippedSeeds()` at every API start from `db/seeds/tax-estimator/federal/<year>.ts` |
| `tax_parameter_overrides` | Super-admin overrides (`status = 'override'`, mandatory reason) and provisional rows (`status = 'provisional'`) created by create-year-from-prior | The admin API |
| `state_estimate_rules`, `state_estimate_rule_overrides` | Same split per jurisdiction (`state`, `tax_year`, `key`), 20 rule keys per taxed state; DC is a jurisdiction row | Startup sync (`syncShippedStateRules`) and the admin API |

Effective value per key: **override > provisional > shipped seed** (`resolveYear` in `tax-parameters.service.ts`).
An override reports status `unverified`; a provisional row reports `provisional`. A year with **no rows at all** falls back to the latest earlier year: every value is served as `provisional`, the date keys that roll with the year (due dates, return due date, farmer dates, holidays) are rolled to the requested year with next-business-day adjustment, and amounts, rates and the penalty-rate table stay the fallback year's (`TE_PARAMS_FALLBACK_YEAR` warning).

The engine reads every parameter through a recording reader; each parameter used that is not `verified`
produces a `TE_PARAM_UNVERIFIED` (federal) or `TE_STATE_RULE_UNVERIFIED` (state) warning that reaches the readiness banner, the preparer PDF and the assumptions page (D12a: the build proceeded before Kurt's sign-off on the strength of these warnings). A state with no usable rule set falls back to the federal pattern with a "verify" badge (`TE_STATE_RULES_FALLBACK` / `TE_STATE_RULES_MISSING`).

### 9.2 Startup re-sync

`index.ts` calls `syncShippedSeeds()` and `syncShippedStateRules()` on every boot, after the other startup seeds:

- Upserts every shipped row (value, status, citation) and deletes rows of that year whose key is no longer in the seed (**the code is the source of truth**). About 300 federal and 1,700 state rows (counts from R7) are upserted per boot; there is no content hash (R7-10).
- Never touches overrides or provisional rows.
- Validates everything before writing anything; a bad seed row is logged (`Failed to sync tax parameter seeds:`) and is **not fatal**. After a deploy, check the boot log for `Synced N tax parameter seed rows across Y year(s)` and `Synced N state rule seed rows across Y state-year set(s)`.
- Consequence: **a shipped row's value changes only by editing the seed in code and deploying.** Its status can additionally move to `verified` through the in-app Verify (9.4), and that sign-off survives the re-sync only while the shipped value is unchanged; a changed seed value resets the row to the seed's status and clears the sign-off.

### 9.3 Statuses

`verified` = a CPA checked the value against its citation. `unverified` = could not be confirmed in a primary source (or a placeholder for a provision that does not apply that year). `provisional` = copied from another year and date-rolled, awaiting confirmation. `override` = a super admin set it by hand. Agents may seed rows as `verified` after their own audit, but the sign-off checklists in PROGRESS.md (Phase 1 federal, MO and AR state rules) are Kurt's, and agents never tick them. The in-app Verify (9.4) is the sign-off record.

### 9.4 In-app Verify (super-admin sign-off)

Added by the R7 fix track (UI-SPEC section 04; present in the routes and services at the time of writing; **no UI button was found in `packages/web` yet**, only the "Verified" label in the change feed, so use the API until the screen ships).

| Call | Effect |
|---|---|
| `POST /api/v1/admin/tax-parameters/:year/:key/verify` body `{ note? }` | Marks one key verified **for its current value** |
| `POST /api/v1/admin/tax-parameters/:year/verify-all` body `{ confirm: true, note? }` | Verifies every key of the year whose effective status is not yet verified |
| `POST /api/v1/admin/tax-state-rules/:year/:state/:key/verify` body `{ note? }` | Same for one state rule |
| `POST /api/v1/admin/tax-state-rules/:year/:state/verify-all` body `{ confirm: true, note? }` | Verifies every not-yet-verified rule of one state-year |

Rules (from `verifyOne` in the two services and the migration comment):

- It signs off the value the engine actually reads: the override or provisional row when one exists, otherwise the shipped seed row. A shipped row's `status` becomes `verified`; an override or provisional row keeps its stored status but now carries `verified_at`, and the resolved status reports `verified`.
- Only `status` and `verified_by` / `verified_at` / `verification_note` change. Value, citation and every other row are untouched. A verified row can still be overridden with a reason.
- A row that is already verified is a no-op and writes no audit row. A fallback year (no rows) has nothing to verify.
- **Verification is bound to the value.** A new override value clears the sign-off; the startup re-sync keeps it only while the shipped value is unchanged. Seeds and migrations never set it. A verified override that is later reverted falls back to the shipped row's own state.
- The DTO rows then carry `verifiedAt`, `verifiedBy`, `verifiedByEmail` and `verificationNote`.
- Audit: action `signoff`, entity type `tax_parameter` / `tax_state_rule`, `after_data.op = 'verified'` (AUDIT-CATALOGUE.md); the change feed lists it as "Verified".
- Bulk verify is for the end of Kurt's checklist walk, not a way around it: the note records why. Agents may not run it on Kurt's behalf.

---

## 10. Annual update runbook: adding a tax year

Do this each autumn, when the IRS publishes next year's inflation-adjusted figures and the retirement / HSA notices, and again when the SSA announces the wage base. Federal and state are independent: do the federal steps, then repeat for state rules.

Preconditions: super-admin login; a developer able to ship a release. Ranked by urgency: until step 3 ships the new year runs on provisional values copied from the prior year.

1. **Create the year from the prior year (super admin, `/admin/tax-parameters`, or `POST /api/v1/admin/tax-parameters/<year>/create-from-prior`).**
   - Allowed only if the year has no rows (`TE_YEAR_EXISTS` 409) and an earlier year exists (`TE_NO_PRIOR_YEAR`).
   - Writes one `provisional` override row per registry key, copying the prior year's effective values and rolling every `rollsWithYear` date: holidays shift by the year difference; every other date lands on the next business day after the rolled holidays.
   - Audit: `year_created` with `{ fromYear, created, rolledDates }`.
   - Result: staff can already build estimates for the year; every figure warns `provisional` and the readiness banner shows it.
   - The same endpoint under `/api/v1/admin/tax-state-rules/<year>/create-from-prior` does it for all states (audit value includes the `states` list).
2. **Research and fill the new values.** Sources named in `PHASES.md` Phase 1: Rev. Proc. for the year (brackets, standard deduction, QBI thresholds, SALT, §461(l) threshold), the SSA wage-base announcement, IRS retirement-plan and HSA notices, Forms 1040-ES / 2210 / 1120-W, the quarterly underpayment-rate news releases (the `penalty.underpayment_rate` array of `{ from, to, rate }` by quarter: future quarters are unpublished placeholders and keep that key unverified as a whole). For states: the state's estimated-tax instructions and statute for each of the 20 rule keys, or an explicit cited `null`. Every row needs a `citation`.
3. **Ship the seed.** Add `packages/api/src/db/seeds/tax-estimator/federal/<year>.ts` (an exported `ParameterSeedRow[]`: `key`, `value`, `citation`, `status`) and one line in `federal/index.ts` (`FEDERAL_SEEDS`). State rules go in each `state-rules/<ST>.ts` as `StateRuleSeedRow` entries with the new `year`. Statuses: `verified` only for values read in a primary source; otherwise `unverified`. Run the completeness suites (`federal/seeds.completeness.test.ts` and the state-rules one): they require **every registry key exactly once, no unknown keys, valid values, a citation and a status on every row**. Run the golden tests (`federal.golden`, `estimates.golden`, `oracle.scenarios.golden`) and expect to regenerate expectations if a value moved; the `no-literals.guard` test must stay green. Bump `TAX_ENGINE_VERSION` only if engine logic changed, not for new values.
4. **Deploy, then check the boot log** for the two `Synced ...` lines (section 9.2). The shipped rows now sit in `tax_parameters` / `state_estimate_rules` underneath the provisional overrides.
5. **Diff and adopt (super admin).** `GET .../<year>/diff` (the "shipped vs provisional" view) lists keys where the shipped value differs from the provisional copy. `POST .../<year>/adopt-shipped` with an optional `keys` list deletes the provisional override rows for those keys so the shipped value takes effect (state rules identify rows as `ST:key`). Audit: one `shipped_adopted` row per key. Adopt everything that you verified; leave a key provisional only if you want the copied value on purpose.
6. **Overrides, only when needed.** If a value must change before the next deploy: `PUT .../<year>/<key>` with a `value` and a reason of at least 3 characters (`TE_PARAM_INVALID` / `TE_STATE_RULE_INVALID` 400 otherwise; the value is validated against the registry type). The row reports `unverified` and shows the shipped value alongside. `DELETE` reverts. Make the permanent fix in the seed and deploy, then revert the override. Audit: `override_set` / `override_reverted`. A recent-changes feed is at `GET .../<year>/changes`.
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
| `estimated_tax_payment` | any (may sit on equity / draw accounts) | any | taxpayer and person, plus **jurisdiction** (`federal` or a state) | Removed from P&L and fed to the payment ledger, cash basis |
| `capital_gain_lt`, `capital_gain_st`, `section_1231`, `interest`, `dividends_ordinary`, `dividends_qualified` | income, other income | any | no | Sets the character explicitly; wins over the TB code. The 2025 TB seed has no code for short-term gain, §1231 or qualified dividends, and no 1040 interest or dividend code |

Rules and traps:

- The API refuses an inapplicable treatment: wrong account type is `TE_TREATMENT_ACCOUNT_TYPE`, wrong entity type `TE_TREATMENT_NOT_FOR_ENTITY`, a missing person `TE_PERSON_REQUIRED` (all 422). The provider **warns instead** (`TE_TREATMENT_NOT_FOR_ENTITY`, `TE_OWNER_PERSON_MISSING`) when it meets one that became invalid later (entity type changed, person deleted); the amounts stay in profit.
- A Schedule M-1 code on a P&L account (`TE_M1_CODE_ON_PL_ACCOUNT`) keeps the **book** amount as ordinary; set a character treatment (e.g. §1231) if the gain is not ordinary.
- `non_recurring` can be set on an account (treatment row) and, via API, on single transactions (`tax_est_transaction_flags`; there is no register UI for it yet). Non-recurring amounts count once in the projection; everything else is run-rated.
- Each row also holds the person (and taxpayer) target in `payment_person_id` / `payment_taxpayer_id`. Targets must belong to the caller's firm (`TE_TAXPAYER_NOT_FOUND`, `TE_PERSON_TAXPAYER_MISMATCH`).
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
- **Live or snapshot**: the taxpayer's `portal_shows`, else the firm default (default `live`). Live computes through the same scoped service under the **firm's full managed-tenant set** (the contact has no user), served through the encrypted cache. `snapshot` shows the latest `finalize` / `vouchers` snapshot, or nothing yet. Only firm staff change `portal_shows`; the client cannot.
- Compute endpoints are rate limited to **20 requests a minute per contact** (`PORTAL_TE_COMPUTE_PER_MINUTE`), responses are `Cache-Control: no-store`, and the vouchers PDF (`GET /:taxpayerId/vouchers.pdf`) is rendered from the projection. Portal reads and PDFs are not audited.
- **Granting access**: `tax_estimates_access` defaults false. Only a caller who passes the Tax Estimator gates may grant it; a tenant bookkeeper outside the firm may only revoke or leave it (`TE_ACCESS_GRANT_FORBIDDEN` 403). A payload that omits the field keeps the stored value. Every change writes `tax_est_contact_access`. "Link contact" on the taxpayer can turn access on for the contact's companies, and "Unlink" can revoke it for companies no other taxpayer still grants.
- **View as Client** preview: the initiating staff user must pass the Tax Estimator gates in the contact's tenant, otherwise the section is hidden / 404.

---

## 13. Report Pack section

- Report id `tax-estimate` (group "Tax", `options: { taxpayer: true }`, as-of temporal), registered in `shared/src/reports/registry.ts` (`TAX_ESTIMATOR_REPORT_IDS`). Endpoints `GET /api/v1/reports/tax-estimate` and `GET .../tax-estimate/taxpayers`.
- Gate (`taxEstimateReportScope`): session auth, not a client user, `tax_estimator` read on the caller's role, the pack tenant managed by a firm the caller belongs to (or a super admin), `TAX_ESTIMATOR_V1` on that tenant, and the tenant inside the caller's D1 scope. The taxpayer must belong to the firm and be linked to the pack's company for the year. A caller failing the gate sees the pack as 404 (not listed, readable, editable, copyable, deletable or runnable; the section cannot be added).
- The run records `requested_by` and `allow_tax_estimate`; the worker re-derives the scope at render time, so access removed in between drops the section, and a failed run loses its grant.
- The section prints the **client** variant of the estimate PDF: no warnings, readiness codes, unverified-parameter dump, engine version or prior-year AGI notes. A run that rendered the section is readable only by its requester, and its artifact is stored AES-256-GCM encrypted (`.pdf.enc`) for 15 minutes.
- Snapshot reason `report_pack`; same-day reuse applies (section 7). Standalone Print / Download on the Estimate screen produces the preparer variant (`pdf` snapshot).

---

## 14. Enabling the flag per tenant (rollout checklist)

Do not enable until: Kurt has completed the sign-off gates, `QA-CHECKLIST.md` sections 0 to 11 have been run once on the test firm (PROGRESS.md notes the UI has not been opened in a browser), and the R7 majors are resolved (wage-earner year inputs UI, these docs).

1. Merge and deploy per the repo release recipe. Confirm migration `0201_tax_estimator` applied (renumber to the next free journal idx on the day it merges if main took 0201, D6) and the boot log shows both `Synced ...` lines.
2. Enable `TAX_ESTIMATOR_V1` on the **firm's practice tenant(s)** (the staff flag is evaluated on the caller's active tenant) through the Admin feature-flag toggle: `POST /api/v1/admin/feature-flags/:tenantId/TAX_ESTIMATOR_V1` with `{ "enabled": true }` (admin principal with `admin_tenant_ops`; a firm member's reach is limited to tenants their firm manages). A linked company in a tenant **without** the flag is still computed (data read) but has no UI there.
3. Check the firm's users have a role that grants the `tax_estimator` resource (the permission matrix) and are `firm_staff` or `firm_admin` for write access. The sidebar group appears only for firm staff with the flag on and `tax_estimator` read.
4. As a `firm_admin`, set firm settings (safe-harbor default `lesser_of` unless the firm prefers otherwise, disclaimer text, `portal_shows`).
5. For client-portal access, additionally enable `CLIENT_PORTAL_V1` on the **client** tenant, `TAX_ESTIMATOR_V1` on that tenant, map the portal contact to the taxpayer and grant `tax_estimates_access`.
6. Create a taxpayer, link its entities and set entity types / treatments; confirm the readiness list; save Annual settings; build an estimate and compare it with the firm's own working paper before relying on it.

To disable: turn the flag off per tenant; all data stays. Disabling hides the screens and 404s the staff router for that tenant's users and hides the portal tile for that tenant's contacts.

---

## 15. Rollback and migration notes

- `0201_tax_estimator.sql` is **additive only** (`scripts/check-migration-policy.sh` passes): every `CREATE TABLE` / `ADD COLUMN` / function / trigger is `IF NOT EXISTS` / `OR REPLACE`; nothing in existing data is backfilled. The flag rows are inserted `FALSE` for every tenant.
- `0201_tax_estimator.rollback.sql` is the DROP companion (children before parents; the Report Pack columns first, then snapshots and the trigger function, then estimate tables, years, entities, taxpayers, state rules, parameters, and the flag rows). By repo precedent rollback files are **not auto-applied**: run it by hand in a transaction, after turning the flag off and **taking a backup**, because it destroys taxpayers, scenarios, payments and snapshots. Snapshots are tax return information; consider an export before dropping.
- Rolling the application back without the DB: the flag is the control (turn it off first). Older code was not tested against the 0201 tables; do not roll the DB back and leave newer code running.
- Verification columns: the `verification.sql` part adds `verified_by`, `verified_at`, `verification_note` to the four parameter tables (additive; its rollback drops them). It is appended last in the consolidated migration; rolling back drops the sign-off history (the audit rows stay in `audit_log`).
- Because the seeds re-sync on every boot, rolling back to an older build that ships fewer seed years leaves the extra rows alone (it only prunes keys of years it ships).
- Backup and restore: every `*_encrypted` column follows the credential re-encryption sweep; after a key rotation or a cross-host restore, snapshots that fail with `TE_SNAPSHOT_UNREADABLE` indicate the sweep did not run or the key is wrong. Redis cache entries do not need migration.

---

## 16. Performance notes

No measurement exists yet. PHASES.md targets under 500 ms for 10 entities by 24 months with the cache; R7-06 records that this is unmeasured, and no timing assertion exists in the tests. What is known from the code:

- **Cold estimate** per linked company: twelve monthly P&L builds through the report builders plus a detail report; Schedule AI columns can add provider runs through the period month for each period not frozen as a snapshot; plus `loadConfigVersion` (eleven aggregates, including an `md5(string_agg(...))` over every reconciliation of the tenant) once per company per request. Cross-tenant taxpayers multiply this by the number of tenants.
- **Warm path**: the encrypted estimate cache hits when the day, stamps, config versions and inputs are unchanged. The first request after any GL change in a linked tenant recomputes only the changed company's P&L (the P&L cache key carries that company's stamp).
- Capture Schedule AI snapshots after each period closes (`POST .../sch-ai-snapshots`) so later estimates read frozen figures instead of rerunning the provider.
- The portal live view reuses the same cache and is limited to 20 computes a minute per contact.
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
