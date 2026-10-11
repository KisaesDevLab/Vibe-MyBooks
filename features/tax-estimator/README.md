# MyBooks Tax Estimator — build kit (plan v2.2, adapted to this repo)

This folder is the **planning and reference home** for the Tax Estimator module. App code does **not** live here; it goes into the workspaces (`packages/shared`, `packages/api`, `packages/web`) exactly as MODULE.md "Where things live" says, so the repo's typecheck, tests, license-header and `any` checks cover it.

v2.2 (2026-10-11) adapts the v2.1 kit to this repository and records the owner's decisions D1–D16 (firm-scoped cross-tenant taxpayers, Trial Balance reuse, super-admin parameters, flag OFF by default, single release from `feat/tax-estimator`, corrected oracle, QBI wage/UBIA inputs, encrypted prior-year data, changed defaults, 42 jurisdictions, CPA sign-off gates, production-host test rules, Report Pack section + standalone PDF).

## Contents
| Path | Purpose |
|---|---|
| `MODULE.md` | **Start here.** Locked design decisions, owner decisions D1–D16, calculation order, parameter keys, engineering rules for this repo (was `CLAUDE.md`; renamed because the repo git-ignores that name) |
| `ORCHESTRATION.md` | Model tiers, routing, escalation, Fable budget guard, agent ownership, per-phase routing and parallel waves |
| `PHASES.md` | 15 phases (0–14) with deliverables, acceptance criteria and the two CPA sign-off gates |
| `OPEN-QUESTIONS.md` | Resolved defaults, review findings Q13–Q24, parameters and state rules still to verify (was `QUESTIONS.md`) |
| `PROGRESS.md` | Phase log, gates, decisions, usage log, review log, sign-off checklists (was `STATE.md`; committed) |
| `BUILD-PLAN.md` | The original v2.1 long-form plan, kept for reference. Where it differs from MODULE.md/PHASES.md, those win |
| `claude-config/agents/*.md` | 12 subagent definitions adapted to this repo. `claude-config/install.sh` copies them into the git-ignored `.claude/agents/` |
| `claude-config/settings.tax-estimator.json` | `opusplan` main model + default subagent model; the installer writes it to `.claude/settings.json` if none exists |
| `docs/reference-calc/rivera_fixture.py` | Independent reference calculator (test oracle) for golden case 1 — corrected 2026-10-11 (Schedule AI column, event-driven penalty) |
| `docs/reference-calc/rivera_expected.json` | Expected engine output: base + 2 scenarios, Schedule AI period 3, safe harbor + penalty schedule, MO |
| `docs/ui-mockups/UI-SPEC.md` + `html/` | Screen-by-screen spec and six rendered mockups (layout and behaviour; styling from the MyBooks UI kit) |
| `docs/ui-mockups/dc-source/` | Design-canvas sources (reference only) |
| `docs/agent-handoffs/`, `docs/reviews/` | Written during the build (per-phase hand-offs; Fable review reports) |

## Kick-off prompt for Claude Code
From the repo root, on branch `feat/tax-estimator`, start `claude --model opusplan`, then:
```
Read features/tax-estimator/MODULE.md, ORCHESTRATION.md, PHASES.md, PROGRESS.md,
OPEN-QUESTIONS.md and docs/ui-mockups/UI-SPEC.md. Do Phase 0 step 1 (run
claude-config/install.sh, verify the 12 agents), then act as orchestrator:
execute PHASES.md using the agents, models and parallel waves in
ORCHESTRATION.md. Delegate every task to its owning agent at the lowest tier
that fits; escalate per the ladder. Golden tests must match
docs/reference-calc/rivera_expected.json. Stop at the two CPA sign-off gates.
Obey MODULE.md D13 (this host is production: test DB kisbooks_test on :5434,
test Redis :6390, one test file at a time). Update PROGRESS.md (including the
usage log) after each phase, log defaults taken from OPEN-QUESTIONS.md, use
conventional commits on feat/tax-estimator, never git add -A. /clear between phases.
```

## Notes
- The oracle uses a 7% underpayment-rate placeholder, treats Arkansas as under its estimate threshold, and assumes Schedule AI line 9 (QBI) uses annualized amounts and line 19 credits are full-year. All are listed in OPEN-QUESTIONS.md to verify in Phase 1.
- State effective rates are user inputs in v1; nonresident tax is a flat-rate estimate and is labelled as such. State bracket tables and the ratio method are in the backlog.
- Regenerate the expected JSON with `python3 features/tax-estimator/docs/reference-calc/rivera_fixture.py` (Phase 0 wires this into `npm run test:tax-oracle`).
