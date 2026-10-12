# R4 — Report Pack section + client portal: adversarial security / privacy review

- **Target:** `feat/tax-estimator` @ `21165e3b` (Phase 13). Read-only review; nothing in the repo was changed by this review.
- **Reviewer:** R4 (independent). Date 2026-10-12.
- **Scope:** `routes/portal-tax-estimates-public.routes.ts`, `services/tax-estimator/portal-estimates.service.ts`, `shared/tax-estimator/portal-api.ts`, `services/tax-estimator/estimate-documents.service.ts`, `reports.routes.ts` tax-estimate endpoints, `middleware/tax-estimator-scope.ts`, the Report Pack worker path (`report-pack.service.ts`, `report-pack-documents.ts`, `report-pack-generate.service.ts`, `report-packs.routes.ts`), `portal-contact.service.ts` / `portal-contacts.routes.ts` (`tax_estimates_access`), preview sessions, the Vibe PM peer path, the voucher PDF, snapshot mode, the firm disclaimer, caching, logging, and the allow-list test.
- **Method:** code reading against HEAD, then three probes run from the session scratchpad (`scratchpad/r4/probe/r4.probe.ts`, config `vitest.probe.config.ts` rooted at `packages/api`) against `kisbooks_test` on :5434 and the test Redis on :6390 (never the prod Redis / DB, per D13). PDF text extracted with `pdftotext`. All three probes reproduced the defects they target (P1 → R4-01, P2 → R4-02, P3 → R4-05/R4-04).
- **Concurrency note:** another agent was fixing R3 findings while this ran. The working tree differed from HEAD in `portal-estimates.service.ts` (only `defaultYear` moved to shared) and `estimate-documents.service.ts` (download audit rows added). Neither change touches any finding below; all line numbers are HEAD's.

## Verdict

**FAIL** — one blocker (R4-01), two majors (R4-02, R4-03), seven minors. Once R4-01 is fixed the verdict becomes PASS-WITH-FIXES; the remaining items are contained.

| id | sev | one-line |
|---|---|---|
| R4-01 | **blocker** | A finished Report Pack run holding the Tax Estimate section is downloadable by ANY tenant user with `reports:read` — including `user_type = 'client'` logins and staff outside the firm — bypassing every Tax Estimator gate; the artifact prints prior-year AGI / tax in plain text and sits unencrypted in tenant storage for an hour. Probe P1. |
| R4-02 | major | "View as Client" preview lets tenant staff who are not firm members and lack the `tax_estimator` resource read the taxpayer's totals / vouchers through the portal router; the initiator is never re-validated against the Tax Estimator gates. Probe P2. |
| R4-03 | major | Worker re-derivation (`resolvePackScopeForUser`) re-checks firm membership, flag, tenant scope and user active — but not the `tax_estimator` permission resource, `user_type`, or `authKind`; a permission revoked between request and render still renders (TOCTOU), and `allow_tax_estimate` persists on re-claimable `failed` runs. |
| R4-04 | minor | The client-facing PDF is the preparer's working paper: readiness warning codes, unverified-parameter JSON dumps, engine version, "verify" markers and the raw prior-year AGI appear in a document whose stated audience (D15, pack of a linked company) is the client. No client-safe variant exists. |
| R4-05 | minor | Firm disclaimer newlines are rendered as literal `?` in both PDFs (`safe()` / `winAnsi()` replace `\n`); voucher PDF does not paginate a long disclaimer. Probe P3: `Paragraph one ends here.?Paragraph two starts here.??Third.` |
| R4-06 | minor | Portal and pack fall back to `scenarios[0]` when no base scenario exists — an arbitrary what-if scenario would be shown to the client. |
| R4-07 | minor | 404-uniformity breaks in preview (403 "Preview is scoped to one company"); flags-off list response lacks `Cache-Control: no-store`. |
| R4-08 | minor | `setCompanyAssignments` delete-and-reinsert silently resets `tax_estimates_access` to false whenever the caller omits the field (older UI / CSV import / scripts); tenant-side (non-firm) staff can also flip the grant on. |
| R4-09 | minor | Every `GET /reports/tax-estimate` and every pack run freezes a new immutable snapshot (≤ 12 MB, no delete route) — 30/min/user growth vector with no dedupe. |
| R4-10 | minor | Pack runs are tenant-scoped only (`X-Company-Id` ignored) — pre-existing Report Pack behaviour, now carrying personal tax data. |

## Findings

### R4-01 — blocker — Pack-run artifact bypasses every Tax Estimator gate

**Where.**
- `packages/api/src/routes/report-packs.routes.ts:34-35` — router chain is `authenticate` → `companyContext` only; no `userType === 'client'` 404, no firm, flag or `tax_estimator` gate.
- `:111` `GET /packs/:id`, `:184` `GET /packs/runs/:runId`, `:189-196` `GET /packs/runs/:runId/pdf` — all gated by `readPerm = requirePermission('reports','read')` only.
- `packages/api/src/services/report-pack.service.ts:334-352` — `getRun` / `readRunArtifact` filter by `tenant_id` alone.
- `packages/api/src/services/report-pack-documents.ts:428-442` — `renderTaxEstimate` renders the FULL `estimate-pdf.service` document (prior-year harbor, all linked businesses across tenants, adjustments, state rows, warnings) into the pack; the gates (`allowTaxEstimate`, `resolvePackScopeForUser`) run at render time only, never at download time.
- `packages/api/src/services/report-pack.service.ts:27` — artifact kept 60 min in the tenant's storage provider, plaintext.

**Defect.** The module's access model (MODULE.md "Access": `user_type = 'client'` → 404; portal contacts see only the allow-listed summary; D9 prior-year figures encrypted at rest) is enforced on every *live* endpoint, but the pack worker writes the preparer's full estimate PDF into an artifact whose read path has none of those checks. A client-type owner login, the other partner's bookkeeper, or any tenant staff member with `reports:read` downloads it.

**Exploit (probe P1, passed).** Firm staff creates a pack with `{reportId:'tax-estimate', options:{taxpayerId}}` (201). A `user_type='client'` user of the same tenant: `GET /api/v1/reports/tax-estimate…` → 404 (gate works); `GET /api/v1/reports/packs/:id` → 200, body contains the taxpayer id; `GET /api/v1/reports/packs/runs/:runId/pdf` → **200 `%PDF-`**; `pdftotext` shows "Prepared for Carlos & Maria Rivera … Businesses included: Rivera Plumbing LLC, Maria Designs Inc, Oak Street Rentals LP … 110% of prior-year tax $34,650 … Prior-year AGI 182000 exceeds 150000 … SEP contribution: deduction $15,000". The run artifact was produced with `renderPackSection` exactly as the worker does. (In production the worker produces the same bytes; the probe only skipped Chromium.)

Why this matters beyond "the client sees their own pack": a company pack is addressed to the *company*, which can have several owners and several logins; the taxpayer is one individual whose other businesses, prior-year AGI and owner-level adjustments now sit in a document every user of that company can open. It also voids D9 for the artifact's lifetime.

**Fix (pick one, or both).**
1. Gate the read side: when a pack contains any `TAX_ESTIMATOR_REPORT_IDS` item, or a run has `allow_tax_estimate = true`, require `taxEstimateReportScope(req) !== null` on `GET /packs/:id`, `/packs/runs/:runId`, `/packs/runs/:runId/pdf` (and the pack list), answering 404 like the rest of the module. Cheapest; keeps D15.
2. Or make the pack section client-safe: render the portal projection (`toPortalEstimate` → a summary/voucher page, same renderer as `renderVouchersPdf`) into packs, and keep the full working-paper PDF on the staff-only standalone / snapshot paths.
Either way, store the artifact encrypted (`encrypt()` on upload, decrypt in `readRunArtifact`) when it carries a tax-estimate section, or exclude that section from the stored artifact.

### R4-02 — major — Preview sessions bypass the firm / resource gates

**Where.** `packages/api/src/routes/portal-tax-estimates-public.routes.ts:43-54` (`caller()` accepts `pc.isPreview` and only pins `companyId`); `packages/api/src/services/portal-auth.service.ts:890-910` (`startPreview` checks only the practice role allow-list, default `owner,bookkeeper,accountant`); `:982` `verifyPreviewToken` is a signature check with no DB re-validation.

**Defect.** The portal router's documented gates are "contact's tenant flags + mapping + `tax_estimates_access` + managing firm". A preview token substitutes the staff initiator for the contact, so the effective principal becomes any tenant staff user allowed to start previews — regardless of firm membership or the `tax_estimator` resource that every staff-side route demands. A tenant's in-house bookkeeper (not a firm member) therefore reads the owner's personal totals, installment schedule and payments.

**Exploit (probe P2, passed).** User role `bookkeeper`, no `firm_users` row, no `user_tenant_access`: `startPreview(...)` → token; `GET /api/portal/tax-estimates/:taxpayerId?year=2026` with `kisbooks_portal_preview` cookie → **200** with `totals.total`, jurisdictions, payments. Vouchers PDF would follow.

**Fix.** In `caller()`, when `pc.isPreview`: load the initiator (`pc.previewInitiatorId`) and require the same gates as `taxEstimateReportScope` (active staff user, `tax_estimator:read` for the contact's tenant, member of the tenant's managing firm or super admin); otherwise return `featureEnabled:false` on the list and 404 on the rest. Alternatively hide the section entirely in preview (`isPreview → featureEnabled:false`). Also consider having `verifyPreviewToken` confirm the `preview_sessions` row is still open (ended previews currently stay valid for the 30-min TTL — pre-existing).

### R4-03 — major — Worker TOCTOU: scope re-derived, permission not

**Where.** `packages/api/src/services/tax-estimator/estimate-documents.service.ts:105-109` (`resolvePackScopeForUser`), `:87-102` (`resolvePackScope`); `packages/api/src/middleware/tax-estimator-scope.ts:55-59` (request-side gate checks `userType`, `authKind`, `can(perms,'tax_estimator','read')`); `packages/api/src/services/report-pack-documents.ts:428-432`; `packages/api/src/services/report-pack-generate.service.ts` claim logic (runs in `failed` are re-claimable).

**Defect.** The run row records `requested_by` + `allow_tax_estimate`; the worker re-derives firm membership, flag, tenant-in-scope and `users.is_active` — but not the `tax_estimator` permission resource, nor `users.user_type`. Scenarios: (a) a firm member's `tax_estimator` resource is revoked (or role dropped to `readonly`) between `POST /runs` and render → section still renders; (b) a run that failed for an unrelated reason is retried later (queue redelivery / `failed` re-claim) with the stale `allow_tax_estimate = true`; (c) `requested_by` user is re-typed to `client` → still renders. Low probability, but it contradicts the stated contract ("re-derive everything at render time").

**Fix.** In `resolvePackScopeForUser`, load `role`/`user_type` and call `permissionService.getEffectivePermissions(tenantId, userId, role, userType, isSuperAdmin)`; return 404 unless `can(perms,'tax_estimator','read')` and `userType !== 'client'`. Consider stamping the run with `allow_tax_estimate_checked_at` and refusing to render a tax-estimate section on a run older than N minutes without re-validation.

### R4-04 — minor — Client deliverable carries preparer-only content

**Where.** `packages/api/src/services/tax-estimator/estimate-pdf.service.ts:237` (prior-year harbor amount), `:285-287` (Warnings — up to 40 engine warnings), `:289` (`renderAssumptions` → every section of the assumptions block incl. `readiness` codes, `Unverified and provisional parameters` with raw JSON values, `Engine approximations`), footer `engine ${r.engineVersion}`; `packages/shared/src/tax-estimator/assumptions.ts:238` pushes every engine note verbatim, including `safe-harbor.ts:185` "Prior-year AGI 182000 exceeds 150000".

**Defect.** D15 says the pack section goes "in any pack of a linked company" — a client-facing deliverable — yet the PDF prints `TE_UNMAPPED_ACCOUNTS [VERIFY]`, `TE_PENALTY_RATE_UNCOVERED`, a 700-character JSON rate schedule, "(not CPA-verified)", "engine 1.0.0-rc.1" and the raw prior-year AGI (D9 figure). Probe P3 output (7 pages, 3+ of them warnings/assumptions). This is excellent as a working paper and wrong as a client document. Not a leak to the wrong person by itself, but it compounds R4-01.

**Fix.** Add an `audience: 'preparer' | 'client'` option to `renderEstimatePdf`; the client variant drops Warnings, Readiness, Unverified parameters, Engine approximations, engine version and the prior-year AGI sentence, keeping Summary, Federal/State, Safe harbor (amounts only), Vouchers, Assumptions-for-the-client (method/months, exclusions, disclaimer). Use `'client'` for the Report Pack section.

### R4-05 — minor — Disclaimer newline mangling; voucher page overflow

**Where.** `packages/api/src/services/tax-estimator/estimate-pdf.service.ts:51-54` (`safe()` maps anything outside `\x20-\x7E`/`\xA0-\xFF` — including `\n`, `\r`, `\t` — to `?`), `:85` (`wrap` splits on `\s+` only after `safe()` ran); `packages/api/src/services/tax-estimator/portal-estimates.service.ts:231` (`winAnsi`), `:273` (same order), `:271-279` (no page break while wrapping; `y` goes negative for a long disclaimer, then the footer is drawn at `M-20` regardless).

**Defect.** The firm disclaimer (`MAX_DISCLAIMER = 4000`, `.trim()` only, newlines allowed) is firm-editable text. A multi-paragraph disclaimer renders with `?` glyphs where the paragraph breaks were, in the client's voucher PDF and in the pack PDF. Probe P3: `Paragraph one ends here.?Paragraph two starts here.??Third.` (both PDFs). A disclaimer near the 4000-char cap (~40 lines at 8pt) runs past the bottom margin of the single voucher page and over the footer. No script/PDF injection is possible (pdf-lib encodes text operators; the web page renders `{e.disclaimer}` as a text node) — this is a correctness/legal-text defect, not XSS.

**Fix.** Normalise whitespace before encoding (`t.replace(/\s+/g, ' ')`, or split on `\n{2,}` into paragraphs and wrap each); in `renderVouchersPdf`, add a page when `y < M + 40`; in the voucher PDF draw the "Figures as of" footer after the disclaimer only when room remains.

### R4-06 — minor — `scenarios[0]` fallback can show a what-if scenario

**Where.** `portal-estimates.service.ts:213` (`scenarios.find((s) => s.isBase) ?? scenarios[0]`), `estimate-documents.service.ts:170` (same, when no `scenarioId` is given).

**Defect.** `years.service.ts:148-150` creates the base scenario on `upsertYear` and `scenarios.service.ts:94` protects it from deletion, so today the fallback is unreachable through the API — but a direct data repair or a future bulk import that leaves a year with only what-if scenarios would silently publish a "sell the building" scenario to the client / pack. Fail closed.

**Fix.** Throw `notFound()` (portal) / `TE_SCENARIO_NOT_FOUND` (pack) when no base scenario exists and none was requested.

### R4-07 — minor — Uniform-404 contract exceptions

**Where.** `portal-tax-estimates-public.routes.ts:50` (403 `FORBIDDEN` "Preview is scoped to one company"), `:58-64` (flags-off list → 200 without `Cache-Control: no-store`).

**Defect.** The router's header says every miss is a 404 that does not say why. In preview, a `companyId` mismatch answers 403 with a distinct message (probe P2: `{"code":"FORBIDDEN"}`); staff-only surface, so negligible, but it is the one place the contract is broken. The flags-off list omits `no-store` (the `/api/v1/` no-store middleware does not cover `/api/portal`), so a shared cache could serve a stale `featureEnabled:false` after the flag is turned on — harmless direction, but inconsistent.

**Fix.** Return `forbidden()` (404) for the preview mismatch; set `no-store` before the early return.

### R4-08 — minor — `tax_estimates_access` plumbing: silent reset and tenant-side grant

**Where.** `packages/api/src/services/portal-contact.service.ts:378-415` (`setCompanyAssignments`: `DELETE` all rows then re-insert with `taxEstimatesAccess: a.taxEstimatesAccess ?? false`); `packages/api/src/routes/portal-contacts.routes.ts:50,187-193` (any non-client, non-readonly tenant staff may call it; the schema makes the field optional).

**Defect.** (a) Any caller that omits `taxEstimatesAccess` — an older web bundle (service-worker stale shell is a known failure mode on this product), CSV import, the PM peer, a script — wipes firm-granted access for every company of the contact in one call, with no Tax Estimator audit event (`audit` entity is `portal_contact_companies`, no `TE_*` marker). The firm's Contacts panel will show "no access" and nobody knows why. (b) The reverse: tenant staff outside the firm can switch the grant on. The mapping (`tax_est_taxpayer_contacts`) remains firm-only, so this is one of two keys — acceptable per D5 ("like `financials_access`") but worth a line in the data dictionary because, unlike financials, the data behind it is another natural person's return information.

**Fix.** Treat an omitted `taxEstimatesAccess` as "keep the current value" (read before delete), or make the update a per-column upsert; emit a `tax_est_contact_access` audit row when the flag changes.

### R4-09 — minor — Unbounded snapshot creation

**Where.** `reports.routes.ts:1792-1809` (every GET freezes a `report_pack` snapshot via `renderPackSection` → `issueEstimatePdf` → `createSnapshot`), `estimate-snapshots.service.ts` (`MAX_PAYLOAD_BYTES = 12 MB`, immutable, no delete endpoint in `tax-estimator.routes.ts`); limiter `reportsRouter.use(expensiveOpLimiter)` = 30/min/user.

**Defect.** Any firm member (or the pack builder's preview button, if one is wired to this endpoint) can grow `tax_est_snapshots` by up to ~360 MB/min per user, forever. Not a confidentiality issue; a resource-exhaustion vector and audit noise.

**Fix.** Reuse the latest `report_pack` snapshot whose `inputs_hash` matches within a short window (e.g. 10 min) instead of freezing a new one; or add a `?dry_run=1` path for pack-builder previews that renders without freezing.

### R4-10 — minor — Pack runs are tenant-scoped, not company-scoped

**Where.** `report-pack.service.ts:334-352`; `report-packs.routes.ts:184-196`.

**Defect.** `X-Company-Id` is required by `companyContext` but ignored when reading a run or its PDF, so a user whose access is restricted to company A (if such restriction exists in the permission model) can fetch company B's pack. Pre-existing Report Pack behaviour; listed because the artifact now carries personal tax data (R4-01).

**Fix.** Filter `getRun` by `(tenant_id, company_id)` with `company_id = req.companyId`, or at least on the PDF route.

## Verified — no finding

- **Allow-list projection** (`portal-estimates.service.ts:119-155`, `portal-api.ts`): builds a fresh object from named fields only; no spread of engine objects; `payments` drops `tenantId`/`companyId`; no `warnings`, `trace`, `assumptions`, `entities` (only `throughMonth` is read), no persons/links. The route test's path-set assertion plus banned-strings check would catch a nested-key regression. Figures that remain (installment amounts, `totals.required`) can in principle let the contact back out their own prior-year tax when the prior-year harbor binds — inherent to any voucher (Form 1040-ES shows the same) and the contact is the taxpayer's designee.
- **Access predicate** (`visible()`, `:68-87`): single query joining mapping ∧ link in the contact's tenant ∧ `portal_contact_companies.tax_estimates_access` ∧ `tax_est_years` ∧ firm = active managing firm ∧ active taxpayer; `companyId` from the query only narrows the join (a foreign/unknown id yields nothing). Test file exercises the matrix (no access, unmapped, other firm, unlinked, wrong company, wrong year, flags off, tenant leaves firm). `tfa_tenant_active_unique_idx` guarantees `firmForTenant`'s `limit(1)` is deterministic.
- **IDOR:** `taxpayerId` → `visible()`; `scenario_id` (pack) → `scenarios.find` restricted to taxpayer+year; `snapshotId` → `loadSnapshotRow` filters `firm_id` and requires all `tenant_ids` in scope; `companyId` → join; `taxpayer_id` (pack) → firm + link to THIS company for the year (`estimate-documents.service.ts:158-167`).
- **Feature flags on the right tenant:** portal checks `CLIENT_PORTAL_V1 ∧ TAX_ESTIMATOR_V1` on `pc.tenantId` (the contact's); pack checks `TAX_ESTIMATOR_V1` on the active tenant (`resolvePackScope`). Matches D5.
- **Vibe PM peer:** `caller()` refuses `pc.viaPeer || req.peerLink` (404); `peer-pm.routes.ts:85-94` never mounts the tax-estimates router; `requirePeerLink` sets `viaPeer: true`.
- **Cache reuse:** estimate cache key = firm + taxpayer + scenario + `inputsHash`, and the hash includes `scope.allowedTenantIds` (R3-01) — a portal compute under the firm's full set never serves a narrower staff scope; payload is AES-GCM. Snapshot payload/summary encrypted with SHA-256 integrity; `redactForView` strips prior-year inputs. Portal responses `no-store`.
- **Mass assignment:** zod `z.object` strips unknown keys on every input (`querySchema`, `companyAssignmentSchema`, `reportPackItemOptionsSchema` enforces UUIDs).
- **Content-Disposition:** portal filename is an integer year; pack filename is `slugify()`'d to `[A-Za-z0-9-]`; run filename already ASCII-safe (`renderPackFilename`). Probe: `attachment; filename="tax-estimate-2026-Carlos-Maria-Rivera.pdf"`.
- **Text injection:** pdf-lib `drawText` + `safe()`/`winAnsi()` → no PDF operator injection; `setTitle` likewise; web renders disclaimer/firm name as React text nodes (no `dangerouslySetInnerHTML` in `features/portal/`).
- **Logging:** morgan logs URL (UUIDs + year only); `pl-provider` logs component/event/companyId; snapshot audit is metadata-only (`auditShape`); portal-contact audits record assignments, not figures. No return information in logs.
- **Enumeration / timing:** one query decides visibility before any compute; a bad UUID, wrong year, wrong company, flags-off and "not yours" all return the same 404 body; 401 only for no session. Compute-time difference exists only for authorised callers.
- **Rate limiting:** portal rides the global 300/min/IP; live compute is cached and `refresh` is not exposed to the portal; `/reports/*` has the 30/min/user `expensiveOpLimiter`.
- **Snapshot mode:** `FINALIZED_REASONS = ['finalize','vouchers']` — `pdf`/`report_pack` snapshots do not surface in the portal (tested); a snapshot touching a tenant the firm no longer manages is withheld (`accessible()`).
- **D1 in the portal:** compute runs under the firm's FULL managed set (`allowedTenantIds(firmId,'',true)`, `:179`) — deliberate and documented (the contact has no user to intersect with); the output is the projection only.

## Probe artefacts

`scratchpad/r4/probe/r4.probe.ts`, `scratchpad/r4/run2.log`, `scratchpad/r4/p1-client-downloaded.pdf`, `p3-vouchers.pdf`, `p3-staff.pdf`. Run with `DATABASE_URL=…kisbooks_test@localhost:5434`, `REDIS_URL=redis://localhost:6390`, from `packages/api`: `npx vitest run --config <scratchpad>/r4/vitest.probe.config.ts`. The probe seeds and purges its own firms/tenants (Rivera fixture).
