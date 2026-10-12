# Tax Estimator — data dictionary (sensitive fields)

Module: Tax Estimator (`TAX_ESTIMATOR_V1`), migration `0201_tax_estimator.sql`
(parts in `packages/api/src/db/migrations/parts/`). This page lists every stored
field that holds **tax return information** and how it is protected. It is the
data-dictionary entry required by MODULE.md D9 and PHASES.md Phase 12.

## Classification

**Tax return information (IRC §7216, Treas. Reg. §301.7216-1(b)(3))** — any
information furnished to, or derived by, the firm in connection with preparing a
tax return, including figures taken from a filed return. In this module that is:

- the prior-year **federal** tax liability and **federal AGI** a CPA enters for the
  safe-harbor tests;
- the prior-year **state** tax liability and **state AGI** entered per state row;
- every figure **derived** from them (safe-harbor prior-year amounts, the required
  annual payment, installment amounts, penalty estimates) wherever it is stored.

Disclosure or use beyond preparing the client's return needs the client's written
consent under §7216. Do not export, email, log or copy these fields outside the
estimator, and do not add them to analytics, AI prompts or support bundles.

## Fields

| Table.column | Contents | Classification | Protection |
|---|---|---|---|
| `tax_est_years.prior_year_tax_encrypted` | Prior-year federal tax (decimal string) | §7216 tax return information | AES-256-GCM (`utils/encryption.ts`); decrypted only in `years.service.ts`; returned only by the single-year GET; audit rows carry a "changed" flag, never the value |
| `tax_est_years.prior_year_agi_encrypted` | Prior-year federal AGI | §7216 tax return information | as above |
| `tax_est_state_rows.prior_year_tax_encrypted` | Prior-year state tax per state row | §7216 tax return information | AES-256-GCM; write-only (DTO carries `priorYearTaxPresent` only); never audited |
| `tax_est_state_rows.prior_year_agi_encrypted` | Prior-year state AGI per state row | §7216 tax return information | as above |
| `tax_est_snapshots.payload_encrypted` | Frozen estimate: inputs (incl. the four values above), engine result, resolved federal parameters and state rules with statuses, readiness, assumptions, disclaimer | §7216 tax return information (contains and derives from the prior-year figures) | AES-256-GCM; `payload_sha256` (hash of the plaintext) verified on every read; immutable (no update path; BEFORE UPDATE trigger, `TE_SNAPSHOT_IMMUTABLE`); the read-only view withholds the raw prior-year inputs |
| `tax_est_snapshots.summary_encrypted` | Snapshot totals for the history list | §7216 tax return information (derived) | AES-256-GCM; `summary_sha256` verified on read; returned only to callers who still reach every tenant in `tenant_ids` (D1) |
| Redis `te:estimate:te-estimate-v3:*` | Cached live estimate (6 h TTL, key embeds the inputs hash, which covers the caller's tenant scope and every company's reconciliation state — R3-01 / R3-03) | §7216 tax return information (derived) | value is `{ enc: <AES-256-GCM ciphertext> }`; a value that does not decrypt is a cache miss |

Not tax return information (books data, stored in clear): payment ledger rows
(`tax_est_payments`), Schedule AI period figures (`tax_est_sch_ai_snapshots`), entity
settings, treatments and adjustments. Snapshot metadata (`tax_year`, `scenario_name`,
`reason`, `engine_version`, `inputs_hash`, `tenant_ids`, `created_by`, `created_at`) is
plain so the history list needs no decryption.

## Payment ledger: which tax year a booked payment belongs to (R3-02)

`tax_est_payments` rows and live GL lines on `estimated_tax_payment` accounts form the
payment ledger. A booked (GL) payment is credited to **exactly one** tax year:

- **Attribution window** of tax year *Y* = the day after year *Y−1*'s **Q4 cutoff**
  through year *Y*'s Q4 cutoff. The Q4 cutoff of *Y* is the later of the last
  individual installment due date (`installments.due_dates`, Jan 15 of *Y+1*) and the
  Q4 file-and-pay date (`installments.q4_file_and_pay_date`, Jan 31 of *Y+1*,
  business-day adjusted); Jan 31 of *Y+1* when neither parameter is usable
  (`TE_PAYMENT_WINDOW_DEFAULTED`). For 2026 that is 2026-02-03 → 2027-02-01.
  Consecutive windows never overlap.
- So a payment dated in *Y+1* before the return due date counts for *Y* only when it is
  the January (Q4) installment payment; one made after the Q4 cutoff (a late Q4 or an
  extension payment) is credited to *Y+1* by default, with an info warning
  `TE_PAYMENT_YEAR_ASSUMED` when it falls before *Y+1*'s first installment.
- **Pins override the default.** A stored row (`source = 'gl'`, `transaction_id`) for
  any year claims that transaction: it supersedes every GL row of the transaction in its
  own year, whatever the jurisdiction (`TE_PAYMENT_JURISDICTION_CHANGED` when they differ,
  R3-11), and removes it from every other year's live read (`TE_PAYMENT_PINNED_OTHER_YEAR`).
  One transaction can be pinned to one tax year only (409 `TE_PAYMENT_OTHER_YEAR`).
- `return_due_date` is no longer the GL read limit; it is reported as
  `window.returnDueDate` and still ends penalty accrual.

## Disclosure audit (R3-06 / R3-16)

Every estimate PDF that leaves the system — the standalone Print / Download (snapshot
reason `pdf`), the Report Pack section (`report_pack`) and a re-print of an existing
snapshot — writes one `audit_log` row: action `download`, entity type
`tax_est_snapshot`, entity id = the snapshot id, under the caller's active tenant.
`after_data` is **metadata only**: `firmId`, `taxpayerId`, `taxYear`, `scenarioId`,
`snapshotReason`, `format`, `issued` (true = new snapshot, false = re-print) and
`payloadSha256`. Never figures. The snapshot id leads to the frozen, encrypted payload.
Screen views (the single-year GET, the snapshot view) are not audited per view; the
snapshot itself records what was issued.

## Money carried as JSON numbers (R3-13)

`tax_est_years` jsonb inputs `itemized`, `sch1a`, `withholding`, `person_inputs` and
`farmer_gross` hold money as JSON numbers (not `decimal(19,4)`). They are accepted only
as **whole cents** (`nonNegNumber` in `schemas/tax-estimator-years.ts`, |v| ≤ 1e12), so
they round-trip exactly through jsonb and the string-decimal bridge; the engine never
sees a float. `AdjustmentDTO.monthly` is the cents-integer allocation of a 4-place
decimal amount. Converting these to decimal strings would change the stored shape, the
bridge and every form; recorded here instead (repo rule #11 exception, no float math).

## Shared books: treatment rows (R3-17)

`tax_est_account_treatments` is books-scoped (one row per account), and several firms
may manage one tenant. A row whose payment taxpayer / person belongs to another firm is
that firm's mapping: other firms see it with `targetOtherFirm: true` and the foreign ids
withheld, and cannot change or delete it (409 `TE_TREATMENT_OTHER_FIRM`). The firm that
owns the target edits it as usual.

## Key rotation and restore

Every column above is a top-level `TEXT` column named `*_encrypted`, so the credential
re-encryption sweep (`services/credential-reencrypt.service.ts`) discovers it from
`information_schema` and re-encrypts it on key rotation or cross-host restore. The
snapshot immutability trigger allows exactly that: an UPDATE that changes only
`payload_encrypted` / `summary_encrypted`. Tests: `years-reencrypt.test.ts`,
`snapshots-reencrypt.test.ts`. Redis entries are not migrated; they expire (6 h) or miss.

## Retention

Snapshots have no delete path in the API; they are removed only when their taxpayer
row is deleted (`ON DELETE CASCADE`). Archiving a taxpayer keeps them.
