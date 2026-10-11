# ORCHESTRATION.md — agents, models and parallel work (v2.2, adapted to this repo)

How the build is split across Claude Code subagents and models so the hard tax logic gets the strongest model and everything else runs on cheaper, faster ones. MODULE.md rules (and the repo's CLAUDE.md rules) still apply to every agent. This file decides **who does the work and on which model**.

## 1. Setup (Phase 0, step 1)
1. From the repo root run `bash features/tax-estimator/claude-config/install.sh`. It copies `claude-config/agents/*.md` into `.claude/agents/` (git-ignored in this repo, which is why the committed copies live under `claude-config/`) and writes `.claude/settings.json` from `settings.tax-estimator.json` **only if no settings file exists** (otherwise it prints the keys to merge by hand). Re-run it whenever an agent file changes; the committed copy is the source of truth.
2. Use Claude Code 2.1.255 or later (Fable 5.1). This host has 2.1.296.
3. Start the orchestrating session on branch `feat/tax-estimator` with `claude --model opusplan`: Opus plans each phase in plan mode, then Sonnet executes.
4. Run `/agents` and confirm the 12 agents below are listed with their models.

## 2. Model tiers — when to use which

| Tier | Model (alias) | Effort | Use for | Never use for |
|---|---|---|---|---|
| T0 | `haiku` | low | Read-only repo search, file inventories, docs formatting, PROGRESS.md bookkeeping | Writing app code; anything tax-related |
| T1 | `sonnet` | medium | Schema + the consolidated migration, CRUD routes/services, React screens from mockups, seed-file typing, unit tests written from a spec, state-rule web research | Engine math, deciding tax treatment, reconciling disagreements with the oracle |
| T2 | `opus` | high | Phase planning (via `opusplan`), P&L provider + treatment map, parameter verification, state-rule audits, snapshot/assumptions logic, code review, debugging outside the engine | Bulk CRUD/UI (wasteful) |
| T3 | `fable` | xhigh | The calculation engine (Phases 6–10), oracle disagreements, and **deep reviews of complex processes** (§5) | Anything a lower tier can do — Fable is capped at 50% of the weekly Max limit and uses it faster |

### Complexity routing rule
Score each task before delegating. **Use the lowest tier whose row matches.**

| Signal | Tier |
|---|---|
| Only reads or searches files | T0 |
| Follows an existing repo pattern, the spec states exactly what to build, and no tax judgment is involved | T1 |
| Touches more than one module, requires choosing among designs, maps books to tax character, or crosses tenants (D1) | T2 |
| Implements an IRC/Form-2210/1040 computation, ordering, limit or interaction; or any engine-vs-oracle mismatch | T3 |
| Reviews a finished multi-step process where an error would produce wrong tax or expose client data (§5 checkpoints) | T3 review |

### Escalation ladder (automatic)
- A T1 agent that fails the same test **twice**, or has to make a design choice not in the spec, stops and returns `ESCALATE: <reason>`. The orchestrator re-runs the task on T2.
- A T2 agent that hits tax-law ambiguity or an oracle mismatch returns `ESCALATE` → T3.
- A T3 agent that cannot resolve a mismatch writes an OPEN-QUESTIONS.md entry (BLOCKING if the expected value may be wrong) and moves on.
- **De-escalate:** once T3 has written an engine function and its tests pass, any follow-on refactors, renames or wiring go back to T1.
- **Owner gates are not escalations:** the two CPA sign-offs (D12) stop the engine phases until Kurt marks them verified in PROGRESS.md. No agent may mark them.

### Fable budget guard
- Only `tax-engine-architect`, `oracle-verifier` and `fable-process-reviewer` may run on `fable`. No other agent and no main session uses it.
- Priority when the cap is tight: (1) oracle mismatches, (2) §5 critical-path reviews R1–R4, (3) engine authoring, (4) other reviews. Engine authoring can fall back to `opus` + `ultrathink`. Reviews should **wait for the reset** rather than downgrade.
- Log Fable sessions in PROGRESS.md → "Usage log". If the weekly Fable cap is reached: switch the engine agents to `opus` per invocation (`model: opus`), add `xhigh` effort and `ultrathink` in the delegation prompt, log the swap, and re-run the oracle verifier on Fable when the cap resets.

## 3. Agents (committed in `claude-config/agents/`, installed to `.claude/agents/`)

| Agent | Model | Effort | Isolation | Owns (write scope) | Phases |
|---|---|---|---|---|---|
| `repo-scout` | haiku | low | — (read-only) | none | 0, ad hoc |
| `schema-builder` | sonnet | medium | — | `packages/api/src/db/schema/tax-estimator.ts`, the consolidated migration + rollback + journal entry, `packages/api/src/db/seeds/tax-estimator/**` loaders | 1, 2, 3, 4, 5, 7, 10, 12 |
| `api-builder` | sonnet | medium | — | `packages/api/src/routes/tax-estimator*.ts`, `routes/portal-tax-estimates-public.routes.ts`, `packages/api/src/services/tax-estimator/**` (except the P&L provider, treatment and readiness services), `packages/shared/src/schemas/tax-estimator.ts`, integration hooks listed in MODULE.md | 1–5, 10, 12, 13 |
| `ui-builder` | sonnet | medium | worktree | `packages/web/src/features/tax-estimator/**`, `packages/web/src/api/hooks/useTaxEstimator*.ts`, nav/route-guard hooks | 1, 2, 3, 4, 5, 11, 12, 13 |
| `state-rules-researcher` | sonnet | medium | worktree, background | `packages/api/src/db/seeds/tax-estimator/state-rules/**` | 2 |
| `tax-law-researcher` | opus | high | — | `packages/api/src/db/seeds/tax-estimator/federal/**`, OPEN-QUESTIONS.md, PROGRESS.md sign-off checklists | 1, 2 (audit) |
| `books-integration-engineer` | opus | high | — | `services/tax-estimator/{pl-provider,treatments,readiness,assumptions}*.ts` | 4, 12 |
| `tax-engine-architect` | **fable** | xhigh | — | `packages/shared/src/tax-estimator/engine/**` | 6, 7, 8, 9, 10 |
| `oracle-verifier` | **fable** | high | — (read-only + run tests) | `features/tax-estimator/docs/reference-calc/**` (new oracles only), test reports | 6–10, 14 |
| `test-writer` | sonnet | medium | — | `*.test.ts(x)` beside the source, outside golden tests | 1–13 |
| `phase-reviewer` | opus | high | — (read-only) | review notes in PROGRESS.md | end of every phase |
| `fable-process-reviewer` | **fable** | xhigh | — (read-only) | `features/tax-estimator/docs/reviews/**` | §5 checkpoints |

**Ownership rule.** Only the owning agent writes inside its scope. Cross-scope changes go back through the orchestrator.

**Independence rule.** The agent that writes engine code never edits golden expected files or oracles. `oracle-verifier` checks the engine without having written it.

**Repo rules every agent carries (also appended to each definition):** MODULE.md D13 test-host rules; additive-only migration + rollback; license header on every new file; no `any`; Zod from shared; tenant/firm scoping with the server-resolved allowed-tenant set (D1); `auditLog` on mutations; `TE_*` error codes; `feat(tax-est): …` commits on `feat/tax-estimator`; never `git add -A`; never touch `~/vibe-mybooks`, prod Redis (6379), the `kisbooks` database or ports 3001/5173.

## 4. Phase-by-phase routing and parallel waves

| Phase | Orchestrator | Lead agent (model) | Helpers in parallel | Gate before merge |
|---|---|---|---|---|
| 0 Discovery | opusplan | `repo-scout` ×3 (haiku): backend / frontend / infra | `schema-builder`, `api-builder` scaffold | Repo map in PROGRESS.md; scaffold compiles |
| 1 Federal params | opusplan | `tax-law-researcher` (opus) for seeds; `schema-builder` + `api-builder` (sonnet) | `ui-builder` (sonnet, worktree) builds the admin screen | Completeness + guard tests; `phase-reviewer`; **Kurt sign-off** |
| 2 State rules | opusplan | `state-rules-researcher` (sonnet, background, worktree) in **5 batches**, MO+AR alone first, max 3 concurrent | `tax-law-researcher` (opus) **audits each batch** before it merges | Every row cited; MO/AR audited + **Kurt sign-off**; **R5** |
| 3 Taxpayers | opusplan | `schema-builder`, `api-builder` (sonnet) | `ui-builder` (worktree) | CRUD + firm/cross-tenant isolation tests |
| 4 Entity setup | opusplan | `books-integration-engineer` (opus) | `schema-builder`, `ui-builder` (sonnet) | Rivera books 115,400 → 128,000; **R1** |
| 5 Settings | opusplan | `schema-builder`, `api-builder` (sonnet) | `ui-builder`, `test-writer` | Allocation + cloning + encrypted round-trip tests |
| 6 Engine core | **plan mode on opus, then delegate** | `tax-engine-architect` (fable) | `test-writer` (sonnet) writes unit tests **before** each function; `ui-builder` starts Phase 11 screens against the DTO | `oracle-verifier` (fable) |
| 7 QBI/NIIT/losses | same | `tax-engine-architect` | `test-writer` | `oracle-verifier`; **R2** |
| 8 State engine | same | `tax-engine-architect` | — | `oracle-verifier` |
| 9 C corp / Sch F | same | `tax-engine-architect` — may run in a second session alongside Phase 8 | `test-writer` | `oracle-verifier` |
| 10 Payments / Sch AI | same | `tax-engine-architect` | `schema-builder`, `api-builder` for payment tables/GL reader | `oracle-verifier`; **R3** |
| 11 UI | opusplan | `ui-builder` (sonnet) | `test-writer` | `phase-reviewer` + manual QA list |
| 12 Snapshots | opusplan | `api-builder` (sonnet); assumptions block by `books-integration-engineer` (opus) | `ui-builder` | Snapshot immutability test; **R6** |
| 13 Report Pack / portal | opusplan | `api-builder`, `ui-builder` (sonnet) | — | Portal isolation test; **R4** |
| 14 Hardening / merge readiness | opusplan | `oracle-verifier` (fable) writes the new oracles; `test-writer` wires them | `repo-scout` (haiku) docs inventory | Full suite; migration renumbered; **R7** |

### Wave timeline
```
Wave 1  Phase 0 ──► Phase 1 ──► [Kurt signs off federal]
Wave 2  Phase 2 (background, batches; MO+AR first ──► [Kurt signs off MO/AR]) ────────────►
        Phase 3 ∥ Phase 4 backend (separate worktrees) ──► Phase 5
Wave 3  (both sign-offs in) Phase 6 ──► Phase 7 ──► Phase 8 ∥ Phase 9 ──► Phase 10
        └─ ui-builder builds Phase 11 screens against the DTO in parallel
Wave 4  Phase 11 finish ──► Phase 12 ──► Phase 13 ──► Phase 14 ──► merge main in, renumber migration
```
After every production release on `main`, the orchestrator merges `main` into `feat/tax-estimator` before starting the next phase (D6).

## 5. Fable deep reviews
`phase-reviewer` (opus) checks each phase against its checklist. `fable-process-reviewer` traces a **whole process across phases** and tries to break it with adversarial cases. Run each checkpoint **once, after that process's tests are green**, and re-review only the fix diff. Reports go to `features/tax-estimator/docs/reviews/R<n>-<slug>.md`.

| ID | Process reviewed | When | Why it needs Fable |
|---|---|---|---|
| R1 | **Books → tax-basis income**: P&L on the tax method, TB character + estimator treatments, owner reclasses, non-recurring exclusion, run-rate projection, readiness, **cross-tenant allowed-set discipline** | End of Phase 4, re-check after Phase 6 | Double counting or dropped items here silently corrupt every number downstream; a scoping slip leaks another firm's books |
| R2 | **Owner allocation & character**: profit/loss %, guaranteed payments, officer wages, activity type → SE / QBI (wages/UBIA) / NII / passive incl. §469(i) / EBL | End of Phase 7 | Interacting rules; tests cover single paths, not combinations |
| R3 | **Payments → safe harbor → Schedule AI → installment application → penalty → vouchers** (federal + state rules) | End of Phase 10 | Form 2210 ordering, recapture, earliest-installment application, penalty period end and date roll-forward are easy to get subtly wrong |
| R4 | **End-to-end Rivera + one seasonal client**: books → engine → summary UI → snapshot → assumptions → Report Pack section + standalone PDF → portal (live and snapshot modes) | End of Phase 13 | Every surface shows the same numbers; the portal shows nothing it shouldn't |
| R5 | **State rules sample audit**: 5 random non-MO/AR jurisdictions + every one whose pattern differs from federal + DC | End of Phase 2 | Second opinion on the largest research-driven data set |
| R6 | **Parameter lifecycle**: seed → super-admin override → create-from-prior → shipped-vs-provisional diff → missing-year fallback → snapshot of resolved parameters | End of Phase 12 | Year-rollover mistakes only show up a year later |
| R7 | **Final tax-logic audit** of `engine/**` against MODULE.md and the authorities, full golden suite | Phase 14 gate | Last line of defence before merge |

**Keeping reviews affordable:** give the reviewer the process's file list or diff and the relevant spec sections only; run each checkpoint once; findings go to the owning agent at the lowest tier that can fix them. Fable reviews; it doesn't fix.

## 6. Context and hand-off discipline
- **New session per phase.** `/clear`, then re-read only MODULE.md, ORCHESTRATION.md, this phase's section of PHASES.md, PROGRESS.md and OPEN-QUESTIONS.md.
- **Subagents return summaries, not dumps.** Every delegation prompt ends with: "Return ≤ 250 words: files changed, tests run and results, open issues, ESCALATE if needed." Full detail goes in the commit and in `features/tax-estimator/docs/agent-handoffs/phase-NN.md`.
- **Scope prompts tightly.** Name the exact files, the MODULE.md section, the acceptance test and the mockup file. Never send "build Phase N" to a T1 agent.
- **Repo reading goes through `repo-scout`** (haiku).
- **Batch small T1 tasks** into one delegation.
- **Worktree merges** are done by the orchestrator after the gate passes. A conflicting merge goes back to the owning agent.
- **Every delegation prompt repeats D13** (test DB/Redis, one file at a time, nothing prod) in one line.

## 7. Usage estimate by tier (from the v2 estimate of ~60–120M tokens processed)

| Tier | Share of tokens | Notes |
|---|---|---|
| Haiku | ~5% | Discovery, docs, bookkeeping |
| Sonnet | ~55% | CRUD, UI, tests, state research |
| Opus | ~17% | Planning, P&L provider/treatments, audits, phase reviews |
| Fable | ~23% | Engine Phases 6–10 (~17%), oracle verification and deep reviews R1–R7 (~6%) — under the 50% weekly Fable cap when spread across 2–3 weeks |

Record actual sessions per phase and model in PROGRESS.md → "Usage log".
