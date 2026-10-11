# PROGRESS.md — MyBooks Tax Estimator (plan v2.2)

(Was STATE.md; renamed because the repo git-ignores that filename. This file IS committed.)

## Status
- Current phase: **Phase 0 — not started**
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
| 0 Discovery & scaffolding | ⬜ | repo-scout (haiku) | | |
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
_(Phase 0.)_

## Phase 1 sign-off checklist (federal parameters)
_(Phase 1 writes one row per key per year: key · year · value · citation · status. Kurt marks "verified" to open the engine phases.)_

## Phase 2 sign-off checklist (MO, AR)
_(Phase 2 batch 1 writes one row per rule key per state per year.)_

## Manual QA checklist
_(Phase 11.)_
