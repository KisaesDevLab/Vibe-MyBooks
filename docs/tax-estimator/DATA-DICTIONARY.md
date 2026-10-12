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
| Redis `te:estimate:te-estimate-v2:*` | Cached live estimate (6 h TTL, key embeds the inputs hash) | §7216 tax return information (derived) | value is `{ enc: <AES-256-GCM ciphertext> }`; a value that does not decrypt is a cache miss |

Not tax return information (books data, stored in clear): payment ledger rows
(`tax_est_payments`), Schedule AI period figures (`tax_est_sch_ai_snapshots`), entity
settings, treatments and adjustments. Snapshot metadata (`tax_year`, `scenario_name`,
`reason`, `engine_version`, `inputs_hash`, `tenant_ids`, `created_by`, `created_at`) is
plain so the history list needs no decryption.

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
