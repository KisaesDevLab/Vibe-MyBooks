# PROGRESS.md — MyBooks Tax Estimator (plan v2.2)

(Was STATE.md; renamed because the repo git-ignores that filename. This file IS committed.)

## Status
- Current phase: **Phase 0 — complete; Phase 1 next**
- Plan version: v2.2 (2026-10-11 — repo adaptation + owner decisions D1–D16 folded in; v2 = Oct 8 CPA review)
- Branch: `feat/tax-estimator` (from main @ `ecac490a`, v0.9.218)
- Engine version: 0.0.0
- Target: usable for Q4 2026 vouchers (Jan 15, 2027); slip accepted (D14)

## Hard gates
| Gate | Owner | Status |
|---|---|---|
| Phase 1 federal parameter checklist verified | Kurt (CPA) | ⬜ |
| Phase 2 MO + AR rules checklist verified | Kurt (CPA) | ⬜ |
| Merge to main (Phase 14) | Kurt | ⬜ |

## Phase log
| Phase | Status | Lead agent (model) | Commit(s) | Notes |
|---|---|---|---|---|
| 0 Discovery & scaffolding | ✅ 2026-10-11 | orchestrator (direct; repo already surveyed by an Explore agent) | see git log | flag/resource/manifest registered, router + firm-scope service + 10 isolation tests, migration 0201 (flag seed), oracle npm script |
| 1 Federal tax parameters | ⬜ | tax-law-researcher (opus) | | ends with Kurt's sign-off |
| 2 State estimate rules (41 + DC) | ⬜ | state-rules-researcher (sonnet) + audit (opus) | | Parallel-safe; MO+AR batch 1, Kurt's sign-off |
| 3 Taxpayers, persons, links (firm-scoped) | ⬜ | schema/api-builder (sonnet) | | |
| 4 Entity tax setup, treatments, readiness | ⬜ | books-integration-engineer (opus) | | |
| 5 Settings, scenarios, adjustments | ⬜ | schema/api-builder (sonnet) | | |
| 6 Engine core (federal income tax) | ⬜ | tax-engine-architect (fable) | | blocked on both sign-offs |
| 7 QBI / Medicare / NIIT / losses / §469(i) | ⬜ | tax-engine-architect (fable) | | |
| 8 State engine | ⬜ | tax-engine-architect (fable) | | |
| 9 C corp & Sch F | ⬜ | tax-engine-architect (fable) | | |
| 10 Payments, safe harbor, Sch AI, penalties | ⬜ | tax-engine-architect (fable) | | |
| 11 UI summary & scenarios + standalone PDF | ⬜ | ui-builder (sonnet) | | |
| 12 Snapshots, assumptions, audit | ⬜ | api-builder (sonnet) + books-integration-engineer (opus) | | |
| 13 Report Pack section & portal | ⬜ | api/ui-builder (sonnet) | | |
| 14 Hardening, docs, merge readiness | ⬜ | oracle-verifier (fable) | | |

## Decisions made during build
| Date | Decision | Source |
|---|---|---|
| 2026-10-11 | D1–D16 recorded in MODULE.md; defaults 5, 8, 9 changed; Q13–Q24 added | Kurt, Q&A with Claude |
| 2026-10-11 | Oracle corrected (Schedule AI period-3 column; event-driven §6654 penalty); `rivera_expected.json` regenerated; base total 43,732 unchanged | Review (Q13, Q14) |
| 2026-10-11 | Kit renamed for the repo: CLAUDE.md → MODULE.md, STATE.md → PROGRESS.md, QUESTIONS.md → OPEN-QUESTIONS.md; agents under `claude-config/agents/` with `install.sh` because `.claude/` is git-ignored | Review |

## Usage log
One row per working session so model shares can be tuned (ORCHESTRATION.md §7).

| Date | Phase | Session / agent | Model | Effort | 5-hr windows used | Escalations | Notes |
|---|---|---|---|---|---|---|---|

## Fable deep reviews
| ID | Process | Date | Verdict | Critical / Major / Minor | Fixes merged |
|---|---|---|---|---|---|
| R1 | Books → tax-basis income | | | | |
| R2 | Owner allocation & character | | | | |
| R3 | Payments → vouchers | | | | |
| R4 | End-to-end | | | | |
| R5 | State rules sample | | | | |
| R6 | Parameter lifecycle | | | | |
| R7 | Final tax-logic audit | | | | |

## Escalations
_(Task, from tier → to tier, reason, outcome.)_

## Repo map
_(Phase 0, 2026-10-11. Paths relative to repo root.)_

**Tenancy and firms.** `tenants` is the isolation unit; every books table is `tenant_id`-keyed. `companies` (tenant_id, business_name, ein, entity_type, fiscal_year_start_month, accounting_method, lock_date) is the "entity" (TB2); company chosen by `X-Company-Id` via `middleware/company.ts`. `firms`, `firm_users` (firm_role firm_admin|firm_staff|firm_readonly, capabilities jsonb), `tenant_firm_assignments` (one active firm per tenant), `user_tenant_access` (per-user per-tenant reach). The only existing cross-tenant read is the Clients screen (`services/client-banking-status.service.ts`, `routes/auth.routes.ts` accessible-tenants/*) behind `requireSessionAuth`.

**Guards.** `authenticate` + `requireSessionAuth` (`middleware/auth.ts`), `requireFeatureFlag(flag)` (`middleware/feature-flag.ts`, 404 when off), `requireResource(key)` (`middleware/permission.ts`, map in `shared/src/constants/permissions.ts`), firm helpers in `middleware/firm-access.ts` (path-based; the estimator uses its own `middleware/tax-estimator-scope.ts`). Client `user_type` gets 404 on firm-side routers (TB13).

**Books and reports.** P&L / BS / cash-basis engine in `services/report.service.ts` (`buildProfitAndLoss`, `cashBasisLinesWith`, `getFiscalYearStart`, `PLResult`); TB `computeWorkpaper` + `getGlVersionStamp` in `services/tb/balance-engine.service.ts` (Redis-cached by gl_version_stamp, TB1/TB6); `buildTbTaxBasisPl`, `buildTbCodeSummary` in `services/tb/tb-reports.service.ts`. Account→tax code: `account_tax_assignments` (per company/account/optional activity unit, effective_tax_year); `company_tax_profiles.return_form` ∈ 1040|1065|1120|1120S; tax-code `activity_type` ∈ business|rental|farm|farm_rental. Fiscal awareness is month-granular only (`fiscal_year_start_month`, TB10). Payroll import tables exist (`db/schema/payroll.ts`) but D8 reads wages from flagged accounts.

**Money and crypto.** `decimal(19,4)` columns; `decimal.js` is an api dependency (not shared); `shared/src/utils/money.ts` string helpers. `encrypt()/decrypt()` in `utils/encryption.ts`; `services/credential-reencrypt.service.ts` enrols every top-level `*_encrypted` text column automatically from `information_schema`.

**Audit and errors.** `auditLog(tenantId, action, entityType, entityId, before, after, userId?, executor?)` in `middleware/audit.ts` (actions create|update|delete|void|login|download|signoff|override). `AppError.{badRequest,forbidden,notFound,locked}`; codes are inline SCREAMING_SNAKE (`TE_*` for this module).

**Flags / permissions / manifest.** `PRACTICE_FEATURE_FLAGS` (`shared/src/constants/feature-flags.ts`), `FLAGS_DEFAULT_OFF_FOR_NEW_TENANTS` (`services/feature-flags.service.ts`), `tenant_feature_flags`; seeding pattern in `0189_financial_statements.sql`. `MODULE_LICENSE_TIERS` in `shared/src/constants/modules.ts`.

**Report Packs.** `REPORT_CATALOG` + `getReportDef` in `shared/src/reports/registry.ts`; server render map `services/report-pack-render.ts`; ad-hoc endpoint map in `routes/reports.routes.ts` (~line 1743); packs are pinned to one `company_id` (`db/schema/report-packs.ts`).

**Portal.** `portal_contacts`, `portal_contact_companies` (per-contact booleans: financials/files/questions/banking/billPay/categorize/bankRepair/billUpload), `routes/portal-*.routes.ts` (model: `portal-financials-public.routes.ts`); portal contacts have no `/api/v1` access (TB13).

**Migrations.** `packages/api/src/db/migrations/NNNN_name.sql` + `.rollback.sql` + `meta/_journal.json` entry (hand-written, `when` strictly increasing); additive-only enforced by `scripts/check-migration-policy.sh`; next free idx at branch time = 201 (taken by `0201_tax_estimator`).

**Tests.** Vitest; API tests need `DATABASE_URL=…@localhost:5434/kisbooks_test` + `REDIS_URL=redis://127.0.0.1:6390`, one file at a time; harness idiom in `routes/feature-flags.routes.test.ts` (express + http.request + jwt.sign). Shared dist must be rebuilt (`npm run build --workspace=@kis-books/shared`) before api typechecks see new shared exports. Gates: `scripts/check-license-headers.sh`, `check-any-baseline.sh` (319/1/0), `check-migration-policy.sh`.

**UI.** `packages/web/src/features/<module>/`, `components/ui`, shared table system (ColumnFilter/SortableTh/useColumnView), nav/guard pattern `hooks/useTrialBalanceVisibility.ts` + `App.tsx`. Knowledge base: `features/help/articles.ts` (template literals — no backticks), `packages/api/src/knowledge/curated/`.

**Phase 0 deliverables.** `TAX_ESTIMATOR_V1` (flag list + default-off set + migration seed), `tax_estimator` resource (group 'Trial Balance'), `taxEstimator: 'base'` manifest, `shared/src/tax-estimator/{index,types,parameterKeys,engine/index}.ts`, `api/src/db/schema/tax-estimator.ts` (empty), `api/src/services/tax-estimator/{index,firm-scope.service}.ts`, `api/src/middleware/tax-estimator-scope.ts`, `api/src/routes/tax-estimator.routes.ts` (mounted `/api/v1/tax-estimator`, `GET /scope`), `0201_tax_estimator(.rollback).sql`, `npm run test:tax-oracle`, `routes/tax-estimator.routes.test.ts` (10 tests: guard chain, firm∩access scope, deactivated assignment/access, X-Firm-Id, readonly, super admin).

## Phase 1 sign-off checklist (federal parameters)
_(Phase 1 writes one row per key per year: key · year · value · citation · status. Kurt marks "verified" to open the engine phases.)_

## Phase 2 sign-off checklist (MO, AR)
_(Phase 2 batch 1 writes one row per rule key per state per year.)_

## Manual QA checklist
_(Phase 11.)_
