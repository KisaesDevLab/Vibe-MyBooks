# Tax Estimator audit catalogue

Every `audit_log` row the Tax Estimator writes, built by reading each `auditLog(...)` call
and the two wrappers (`auditYears` in `services/tax-estimator/year-access.ts`, `audit` in
`taxpayers.service.ts`) on branch `feat/tax-estimator` (2026-10-12). Companion to
[MODULE.md](./MODULE.md), [ERROR-CODES.md](./ERROR-CODES.md) and the sensitivity
classification in [DATA-DICTIONARY.md](./DATA-DICTIONARY.md).

## Conventions

- Writer: `auditLog(tenantId, action, entityType, entityId, before, after, userId, executor)` in
  `middleware/audit.ts`. Actions the writer allows: `create | update | delete | void | login | download | signoff | override`. The module uses `create`, `update`, `delete`, `download`, `override` and `signoff`.
- Every row is written inside the same transaction as the change (the transaction handle is passed
  as the executor), so a rolled-back change leaves no audit row. The one exception is the PDF
  `download` row (see below), written after the file is rendered.
- **Which tenant the row sits under** (`audit_log.tenant_id`), because the module crosses tenants (D1):

  | Written by | Tenant |
  |---|---|
  | Firm-scoped rows (taxpayer, person, link, year, scenario, adjustment, state rows, payment, snapshot, Schedule AI, firm settings, visibility switch, staff list, adjustment type) | The caller's **active tenant** (`actor.tenantId`). The firm id is added into `before_data` / `after_data` as `firmId` (the `tag()` helper), so a firm's history is found by `firmId`, not by tenant. |
  | Books-scoped rows (entity settings, entity year inputs, treatments, transaction flags) | The **books tenant that owns the company** being configured. Treatment rows also carry `firmId` in the data. |
  | Platform reference data (federal parameters, state rules) | The all-zero tenant id `00000000-0000-0000-0000-000000000000` (no tenant), action `override` (edits) or `signoff` (Verify). |
  | Portal access grants | The portal contact's tenant. |

- `before_data` / `after_data` are JSON strings. Prior-year tax and AGI are **never** in an audit row:
  the year and state-row shapes strip the `*_encrypted` columns and record only
  `priorYearTaxPresent` / `priorYearAgiPresent` (and, for a year update, `priorYearChanged: { changed: true }`).
  Snapshot rows record metadata only, never the payload or summary.
- Not audited (reads and derived data): computing an estimate, the readiness endpoint, listing or
  viewing or comparing snapshots, all portal reads, the portal vouchers PDF, the startup re-sync of shipped
  parameter and state-rule seeds, and the Redis caches.

## Catalogue by entity type

### Taxpayers, persons, links, contacts (`services/tax-estimator/taxpayers.service.ts`)

| Entity type | Actions | entity_id | What the data holds |
|---|---|---|---|
| `tax_est_taxpayer` | `create` | taxpayer id | after = taxpayer DTO (display name, filing status, resident state, safe-harbor override, `portalShows`, active flag) + `firmId` |
| `tax_est_taxpayer` | `update` | taxpayer id | before / after = taxpayer DTO |
| `tax_est_taxpayer` | `delete` | taxpayer id | **Archive** (`is_active = false`), not a row delete; before / after = taxpayer DTO |
| `tax_est_taxpayer` | `update` with `after_data.op = 'link_contact'` | taxpayer id | `{ op, portalContactId, grantAccess, grantedCompanies }`: a portal contact mapped to the taxpayer, optionally turning on `tax_estimates_access` for the contact's linked companies |
| `tax_est_taxpayer` | `update` with `after_data.op = 'unlink_contact'` | taxpayer id | before `{ op: 'link_contact', portalContactId }`; after `{ op, portalContactId, revokeAccess, revokedCompanies }` |
| `tax_est_person` | `create`, `update` | person id | person DTO (role, name, date of birth, blind flag, SEHI eligible months) |
| `tax_est_person` | `delete` | person id | before = person DTO; after = `{ removedLinks: n }` (the person's links cascade) |
| `tax_est_dependent` | `create`, `update`, `delete` | dependent id | Q44, metadata only: `{ id, taxpayerId, kind, relationship, birthYear, monthsLivedWith, isStudent, isDisabled, firstTaxYear, lastTaxYear }` — never the name or the full date of birth (create: before null; delete: after null) |
| `tax_est_link` | `create`, `update` | link id | the full `tax_est_links` row (tenant, company, tax year, percentages, partner SE status, officer flag, activity type, QBI eligibility and override reason, allowed-loss override and reason) |
| `tax_est_link` | `delete` | link id | before = the link row |
| `tax_est_outside_entity` | `create`, `update`, `delete` | outside business id | Q45: the definition `{ id, taxpayerId, name, entityType, personId, personRole, profitPct, lossPct, partnerSeStatus, isOfficer, activityType, activeParticipation, qbiEligible, isSstb, rentalQbiTradeOrBusiness, stateSourcing }` + `firmId` (delete: before also lists the tax years whose amounts cascade; a person delete cascades the person's outside businesses without per-row audit, like links) |
| `tax_est_outside_entity_year` | `create`, `update`, `delete` | year row id | Q45: the year's amounts DTO `{ outsideEntityId, taxYear, entryMode, amountBasis, throughMonth, amounts, guaranteedPayments, officerWages, ownerSehi, ownerRetirement, sehiAsW2Wages, w2Wages, ubia, includeSehiInW2Wages, allowedLossOverride }` + `taxpayerId`, `firmId` (amounts included, like links / adjustments) |

### Annual settings, scenarios, adjustments, state rows (`years`, `scenarios`, `adjustments`, `adjustment-types`, `state-rows`, `firm-settings`)

| Entity type | Actions | entity_id | What the data holds |
|---|---|---|---|
| `tax_est_year` | `create`, `update` | year row id | Year settings without ciphertext (rate mode, deductions, Sch 1-A, credits, withholding, person inputs, farmer inputs, ...) plus `priorYearTaxPresent`, `priorYearAgiPresent` and, when either prior-year figure was changed, `priorYearChanged: { changed: true }` (the values are not logged) |
| `tax_est_scenario` | `create` | scenario id | scenario DTO; a clone adds `clonedFrom`, `adjustments` (count copied), `stateRows` (count copied) |
| `tax_est_scenario` | `update`, `delete` | scenario id | before / after = scenario DTO (the Base scenario cannot be deleted: `TE_BASE_SCENARIO_PROTECTED`) |
| `tax_est_adjustment` | `create`, `update`, `delete` | adjustment id | adjustment DTO including type name, amount, cadence, dates, GL link, flags |
| `tax_est_adjustment_type` | `create`, `update`, `delete` | type id | adjustment type DTO (firm-defined types only; shipped types are read-only) |
| `tax_est_state_rows` | `update` | **scenario id** | The whole replace-set: before `{ rows: [...] }`, after `{ rows: [...] }` (state, residency, rate, base, sourced income, credits, ...) with `priorYearTaxPresent` / `priorYearAgiPresent` only |
| `tax_est_firm_settings` | `create`, `update` | **firm id** | firm settings DTO (safe-harbor default, disclaimer text, `portalShows`, D17 `restrictTaxpayersToLinkedTenants`) |
| `tax_est_visibility_switch` | `update` | **firm id** | D17, written in addition to the `tax_est_firm_settings` row ONLY when the switch actually changes: before `{ restrictTaxpayersToLinkedTenants }`, after `{ restrictTaxpayersToLinkedTenants }` (+ `firmId`). Metadata only. Firm admins / super admins only |

### Taxpayer visibility staff list (`services/tax-estimator/taxpayer-staff.service.ts`, D17)

| Entity type | Actions | entity_id | What the data holds |
|---|---|---|---|
| `tax_est_taxpayer_staff` | `update` | **taxpayer id** | One row per effective change of a taxpayer's staff allow-list (an unchanged PUT writes nothing; since D18 a non-empty list REPLACES the firm rule and grants its members that taxpayer's full data): before `{ userIds: [...] }`, after `{ userIds: [...], added: [...], removed: [...] }` (+ `firmId`). User ids only — no names, emails or taxpayer data. Tenant = the admin's active tenant. Firm admins / super admins only |

### Payments and Schedule AI (`payments`, `sch-ai-snapshots`)

| Entity type | Actions | entity_id | What the data holds |
|---|---|---|---|
| `tax_est_payment` | `create`, `update`, `delete` | payment id | stored payment DTO (jurisdiction, date, amount, source `manual` / `gl` / `prior_year_overpayment`, tenant + transaction reference, memo). Amounts and dates are bookkeeping data, not return information |
| `tax_est_sch_ai_snapshots` | `update` | **taxpayer id** | `{ taxYear, periods: [indexes], written: n, replace }`, written only when at least one row was written; D18: `elevated: true` when the capturer is on the taxpayer's staff list and captured companies outside their own client access |

### Snapshots and issued PDFs (`estimate-snapshots`, `estimate-documents`)

| Entity type | Actions | entity_id | What the data holds |
|---|---|---|---|
| `tax_est_snapshot` | `create` | snapshot id | metadata only: `taxpayerId, taxYear, scenarioId, scenarioName, reason, note, engineVersion, inputsHash, payloadSha256, payloadBytes` (+ `firmId`; D18: `elevated: true` when the creator read the taxpayer through its staff list with tenants outside their own client access). `reason` is `finalize`, `vouchers`, `pdf` or `report_pack`. Created by Finalize, by the standalone PDF, and by the Report Pack section; a same-day identical `pdf` / `report_pack` issue reuses the existing snapshot and writes no new `create` row |
| `tax_est_snapshot` | `download` | snapshot id | `{ firmId, taxpayerId, taxYear, scenarioId, snapshotReason, format: 'pdf', issued, payloadSha256 }` (before_data is null; D18: plus `elevated: true` when the requester is on the taxpayer's staff list and it includes linked tenants outside their own client access — absent otherwise). `issued: true` = the PDF was generated and a snapshot was frozen or reused for it (standalone Print, Report Pack section); `issued: false` = an existing snapshot's PDF was re-downloaded. Written **after** rendering and outside the snapshot transaction. Never contains figures |

### Entity setup (books-scoped; `entity-settings`, `treatments`)

| Entity type | Actions | entity_id | What the data holds |
|---|---|---|---|
| `tax_est_entity_settings` | `create`, `update` | settings row id | full row: estimator entity type, tax method override, fiscal-year and per-entity flags. Tenant = the company's tenant; no `firmId` tag |
| `tax_est_entity_year_inputs` | `create`, `update` | row id | full row: W-2 wages override and its mandatory reason (`TE_W2_OVERRIDE_REASON`), UBIA, the Q41 switch, the Q46 `projection_method`. Tenant = the company's tenant |
| `tax_est_treatment` | `create`, `update`, `delete` | treatment row id | account treatment row (account, treatment, pct, payment taxpayer / person / jurisdiction, `nonRecurring`, `splitMode`) + `splits[]` (Q50 owner split rows: taxpayer / person, pct or amount + tax year, sort order; `[]` = single target) + `firmId`. A treatment cleared to null with no non-recurring flag is a `delete` (its split rows go with it) |
| `tax_est_treatment` with `kind: 'transaction_flag'` in the data | `create`, `delete` | flag row id | A transaction-level `non_recurring` flag in `tax_est_transaction_flags` (same entity type string as treatments; tell them apart by `kind`). Re-flagging an already flagged transaction writes nothing. The register / transaction-detail toggle (`PUT /tax-estimator/register/transactions/:id`) writes through the same path, so its rows are identical |

### Portal access (`services/portal-contact.service.ts`)

| Entity type | Actions | entity_id | What the data holds |
|---|---|---|---|
| `tax_est_contact_access` | `create` | contact id | `{ granted: [companyIds] }`, written when a new portal contact is created with `tax_estimates_access` on. Written in addition to the ordinary `portal_contact` row |
| `tax_est_contact_access` | `update` | contact id | `{ granted: [...], revoked: [...] }`, only when the company assignment update actually grants or revokes (a payload that omits the field keeps the stored value and writes nothing) |

Related rows that are **not** Tax Estimator entities but are written in the same operations: `portal_contact`, `portal_contact_companies` (existing portal audit).

### Platform reference data (`tax-parameters.service.ts`, `tax-state-rules.service.ts`)

Both write under the zero tenant and carry the operation in `after_data.op`: action `override` for the first four ops, action `signoff` for `verified`. The admin
"Recent changes" feed (`GET .../changes`) reads these rows and ignores any other `op`.

| Entity type | Actions | `after_data.op` | entity_id | What the data holds |
|---|---|---|---|---|
| `tax_parameter` | `override` | `override_set` | override row id | before `{ year, key, value }` (previous override value or null); after `{ op, year, key, value, reason }` |
| `tax_parameter` | `override` | `override_reverted` | deleted override row id | before `{ year, key, value }`; after `{ op, year, key, value: null, reason: null }` |
| `tax_parameter` | `override` | `year_created` | null | before `{ year, key: null, value: null }`; after `{ op, year, key: null, value: { fromYear, created, rolledDates }, reason }` |
| `tax_parameter` | `override` | `shipped_adopted` | removed provisional row id (one audit row per key) | before `{ year, key, value }`; after `{ op, year, key, value: null, reason: null }` |
| `tax_parameter` | `signoff` | `verified` | override / provisional row id, else the shipped row id | before `{ year, key, value, status }`; after `{ op, year, key, value, source: 'seed' \| 'override' \| 'provisional', reason: <note or null> }`. One row per key changed; an already-verified row writes nothing. Bulk `verify-all` writes one row per key it flips |
| `tax_state_rule` | `override` | `override_set` | override row id | as above with `state` in both blobs |
| `tax_state_rule` | `override` | `override_reverted` | deleted override row id | as above with `state` |
| `tax_state_rule` | `override` | `year_created` | null | after `value = { fromYear, created, states, rolledDates }`, `state: null`, `key: null` |
| `tax_state_rule` | `override` | `shipped_adopted` | removed provisional row id (one row per state / key) | as above with `state` |
| `tax_state_rule` | `signoff` | `verified` | override / provisional row id, else the shipped row id | as the `tax_parameter` row, with `state` in both blobs |

An override written by **Apply AI value** (Q48) is an ordinary `override_set` row whose `after_data` also carries `aiCheckId` and `sourceUrl` (and `citation` when the admin ticked "use the AI source as the citation"); its reason reads "Applied AI check <id>: <source>". It shows in Recent changes like any override.

### AI parameter check (`tax-param-ai-check.service.ts`, Q48)

Zero tenant; the acting super admin in `user_id`.

| Entity type | Actions | `after_data.op` | entity_id | What the data holds |
|---|---|---|---|---|
| `tax_param_ai_check_run` | `create` | `ai_check_run_started` | run id | `{ op, year, scope, state, key, total, model }` |
| `tax_param_ai_check_run` | `update` | `ai_check_run_cancel_requested` | run id | before `{ status }`; after `{ op, year }` |
| `tax_param_ai_check_run` | `update` | `ai_check_run_finished` | run id | before `{ status: 'running' }`; after `{ op, year, status, done, total, counts, error }` (user = the run's creator) |
| `tax_param_ai_check` | `update` | `ai_value_applied` | check id | before `{ year, jurisdiction, key, value }` (value replaced); after `{ op, year, jurisdiction, key, value, aiCheckId, sourceUrl, updateCitation }` |

The individual results are stored in `tax_param_ai_checks` (verdict, found value, quote, source, rationale, model, token usage, server notes), not in the audit log.

Verification is audited (`signoff` / `verified`, with the verifier in `user_id` and the free-text note in `reason`) and is also stored on the row (`verified_by`, `verified_at`, `verification_note`). A status that changes because a seed was edited and deployed has **no audit row**; the deploy history is the trail, and the startup re-sync (which also clears a sign-off when the shipped value changed) is not audited.

## Quick reference

| Entity type string | Written under tenant | Source file |
|---|---|---|
| `tax_est_taxpayer`, `tax_est_person`, `tax_est_dependent`, `tax_est_link`, `tax_est_outside_entity`, `tax_est_outside_entity_year` | active tenant | `taxpayers.service.ts` |
| `tax_est_year`, `tax_est_scenario`, `tax_est_adjustment`, `tax_est_adjustment_type`, `tax_est_state_rows`, `tax_est_firm_settings`, `tax_est_payment`, `tax_est_sch_ai_snapshots`, `tax_est_snapshot` | active tenant | `years`, `scenarios`, `adjustments`, `adjustment-types`, `state-rows`, `firm-settings`, `payments`, `sch-ai-snapshots`, `estimate-snapshots`, `estimate-documents` services |
| `tax_est_entity_settings`, `tax_est_entity_year_inputs`, `tax_est_treatment` | the company's tenant | `entity-settings.service.ts`, `treatments.service.ts` |
| `tax_est_contact_access` | the contact's tenant | `portal-contact.service.ts` |
| `tax_parameter`, `tax_state_rule` | zero tenant | `tax-parameters.service.ts`, `tax-state-rules.service.ts` |

## Querying

```sql
-- One taxpayer's history across tenants: the firm-scoped rows hold the taxpayer in the data blobs.
SELECT created_at, tenant_id, action, entity_type, entity_id, after_data
FROM audit_log
WHERE entity_type LIKE 'tax\_est\_%' AND after_data::text LIKE '%"taxpayerId":"<uuid>"%'
ORDER BY id;

-- Who finalized or printed what: snapshot create + download rows.
SELECT created_at, user_id, action, entity_id, after_data
FROM audit_log WHERE entity_type = 'tax_est_snapshot' ORDER BY id DESC LIMIT 50;

-- Parameter / state-rule administration history (platform-wide).
SELECT created_at, user_id, entity_type, after_data
FROM audit_log
WHERE tenant_id = '00000000-0000-0000-0000-000000000000' AND entity_type IN ('tax_parameter','tax_state_rule')  -- actions: override, signoff
ORDER BY id DESC;
```

`audit_log.before_data` / `after_data` are text columns holding JSON strings, hence the `LIKE` form; cast with `::jsonb` if you need path queries.

## Known gaps

- `TE_ACCESS_GRANT_FORBIDDEN` refusals (a blocked grant attempt) are not audited; only successful changes are.
- The `download` row is not in a transaction with the PDF render; a render failure writes no row, which is correct, but a crash between render and audit would lose the row (the snapshot row still exists).
- Portal reads (including the vouchers PDF) are not audited; the portal limiter (20 requests a minute per contact) is the only control.
