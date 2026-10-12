# R6 — Parameter lifecycle (independent adversarial review)

Reviewer: R6 (Fable), 2026-10-12. Branch `feat/tax-estimator` @ `e65c57b0`. Read-only on code.
Scope: federal `tax_parameters` / `tax_parameter_overrides` and state `state_estimate_rules` / `state_estimate_rule_overrides` across their whole life: seeding and per-boot re-sync, resolution (override > provisional > seed > missing-year fallback), create-year-from-prior, the R3-04 fallback date roll, the R7 in-app Verify (single, bulk, confirm, who/when/note, audit, idempotence, races), override with reason and revert, shipped-vs-provisional diff and adopt, completeness, concurrency, estimate-cache and snapshot behaviour under parameter change, D12a warnings, the annual runbook in `docs/tax-estimator/MODULE.md` §9–10, the `verification.sql` part of migration 0201, and test coverage.
Files read in full: `services/tax-estimator/tax-parameters.service.ts`, `tax-state-rules.service.ts`, `routes/tax-parameters-admin.routes.ts`, `routes/tax-state-rules-admin.routes.ts`, `routes/tax-estimator/state-rules.routes.ts`, `shared/src/tax-estimator/dates.ts`, `parameterKeys.ts` (registry + validation), `engine/parameters.ts`, `engine/state-types.ts` (reader), `engine/state.ts:311-318`, `engine/vouchers.ts:287-305`, `estimate.service.ts` (gather / inputsHash / cache), `estimate-snapshots.service.ts` (freeze + compare), the four admin UI files, the two service test files, the three route test files, both seed completeness tests, `dates.test.ts`, migration 0201 lines 1–80 and 600–630 + rollback, `index.ts:181-197`, MODULE.md §9, §10, §15.
Method: code read plus two probe scripts run from the session scratchpad: `dates-probe.ts` (pure shared helpers against the shipped seeds, no DB) and `db-probe.mts` (service calls against `kisbooks_test:5434` with `REDIS_URL=redis://localhost:6390`, fixture years 2080–2085, audit rows and tables cleaned at the end). The existing `tax-parameters.service.test.ts` (22 tests) was run once first to apply migrations and confirm the baseline: green. Raw probe output is in §4. Nothing touched the production DB, Redis 6379, Docker or `~/vibe-mybooks`.

## Verdict: **PASS-WITH-FIXES** — 0 blocker, 4 major, 10 minor

What holds: the re-sync never touches the override tables and provably keeps an in-app sign-off only while the shipped value is unchanged (jsonb equality is semantic: `1.0 = 1`, key order ignored, array order significant — probe F); the resolution order is implemented exactly as documented; Verify writes only status + `verified_*`, is idempotent for an already-verified row, needs `confirm: true` for bulk, is super-admin only (`requireSuperAdmin` + fresh admin session), and a new override value clears it; bulk verify in a fallback year is a no-op and single verify is a 404; the estimate cache key is a SHA-256 over the full resolved parameter and state-rule DTOs (`estimate.service.ts:262-275`), so a verify / override / revert / re-sync is reflected on the next request with no explicit invalidation, and snapshots freeze the full `federalParameters` + `stateRules` DTOs and compare `parametersUsed` / `rulesUsed` by value and status (`estimate-snapshots.service.ts:137-142, 295-313`); D12a warnings fire for every non-verified read including fallback rows (status forced to `provisional`) and stop as soon as the row is verified; the migration part is additive, the rollback drops the three columns in order.

What does not hold is the **year rollover itself** — the one thing R6 exists for ("year-rollover mistakes only show up a year later", ORCHESTRATION.md §5). The date roll produces wrong dates for 2027 from the shipped 2026 seed (and reproduces wrong 2026 dates from the shipped 2025 seed), one stray override turns a fallback year into an unusable partial year and locks out create-from-prior, the admin States screen and the estimate disagree about what a missing state-year does, and Verify signs whatever value is current at commit time rather than the value the admin saw.

| ID | Sev | Where | Defect |
|---|---|---|---|
| R6-01 | Major | `tax-parameters.service.ts:179-191, 356-364`; `tax-state-rules.service.ts:432-462`; `shared/.../dates.ts:27-32` | Create-year and the R3-04 fallback roll **observed** dates and **fixed month/day** holidays. Rolling the shipped 2026 seed to 2027 gives Q4 due 2028-01-17 (MLK Day; correct 01-18), Q4 file-and-pay 2028-02-01 (correct 01-31), return due 2028-04-17 (observed Emancipation Day; correct 04-18), farmer due 2028-01-17 (correct 01-18). Rolling 2025→2026 reproduces 06-16 / 02-02 / 03-02 against the shipped 06-15 / 02-01 / 03-01, and 17 of 24 rolled holidays are wrong (probe §4.1) |
| R6-02 | Major | `tax-parameters.service.ts:126-131, 196-204, 263-288, 368`; `tax-state-rules.service.ts:268-275, 337, 471`; `TaxParametersPage.tsx:197`; `StatesView.tsx:111` | One override (or one verify-then-override) on a year with no rows ends the fallback: the year becomes 1/161 complete, every estimate for it fails `TE_PARAM_MISSING` (422), and `create-from-prior` returns 409 `TE_YEAR_EXISTS` with no way out but a manual DELETE. The state version blocks create-from-prior for **all 51 jurisdictions** on one stray row. The Override button is shown on fallback rows (reachable in the UI through States → a "missing" state) — probe §4.2 A1–A3, B1–B3 |
| R6-03 | Major | `estimate.service.ts:247` + `engine/state.ts:311-318` vs `tax-state-rules.service.ts:13-15, 282-321`; `StatesView.tsx:252` | For a state-year with no rows the admin screen says "missing · Federal fallback · verify" (`listSummaries` → `engineView`, no year fallback) while the estimate uses `getStateRules`, which **falls back to last year's rules rolled forward** (with the R6-01 defects and last year's rate legs / thresholds). `resolveStateRulesForEngine` is dead code in the API; the file comment and MODULE.md §9.1 describe the dead path. No year-level warning (there is `TE_PARAMS_FALLBACK_YEAR` for federal, nothing for state) — probe §4.2 B2/B4/B5 |
| R6-04 | Major | `tax-parameters.service.ts:315-334`; `tax-state-rules.service.ts:388-412`; `routes/tax-parameters-admin.routes.ts:72-76`; `useTaxParameters.ts:98` | Verify is not bound to the value it signs: the request carries only `year/key(/note)`, and `verifyOne` is read-then-update with no lock or precondition. Two admins verifying at once both "succeed", two `signoff` audit rows are written, the second verifier's identity and note are lost (probe §4.2 G). An admin who opens the dialog, while another admin overrides the key, signs the **new** value unseen |
| R6-05 | Minor | `tax-parameters.service.ts:393-415`; `tax-state-rules.service.ts:508-532`; `ParameterPanels.tsx:32`; MODULE.md:334 | The shipped-vs-provisional diff lists rows whose values are identical (probe §4.2 K) with no "same" marker; the UI text "No differences — provisional values match the shipped seed" and MODULE.md ("lists keys where the shipped value differs") both describe a filter that does not exist. Identical provisional rows still shadow the shipped row's status, so they must stay adoptable — but they need to be labelled |
| R6-06 | Minor | `tax-parameters.service.ts:156, 381-383`; `tax-state-rules.service.ts:493`; migration 0201:31-43 | A federal year created from prior has **no citations** (`tax_parameter_overrides` has no citation column; the resolver takes `seed?.citation ?? ''` and there is no seed yet), so the admin's Citation column is empty for all 161 rows of the year they are asked to verify. The state table carries `citation` and copies it |
| R6-07 | Minor | `tax-parameters.service.ts:290-300`; `TaxParametersPage.tsx:258`; `StatesView.tsx:164` | Reverting a provisional row that has no shipped counterpart deletes it outright: the key is missing for the year (no fallback because the year still has rows), the next estimate throws `TE_PARAM_MISSING` (probe §4.2 J). The confirm text says "Revert … to the shipped value" even when there is none |
| R6-08 | Minor | `tax-parameters.service.ts:276-282`; `tax-state-rules.service.ts:350-357` | Re-saving an override with the **same** value clears the sign-off (probe §4.2 D). Editing a provisional row flips `status` to `override` permanently: it leaves the diff / adopt flow and shadows a later-shipped seed until someone reverts by hand; `created_from_year` stays on the row |
| R6-09 | Minor | `tax-parameters.service.ts:283-285, 439-447`; `routes/tax-parameters-admin.routes.ts:58-62`; `ParameterPanels.tsx:63` | Audit `before` for an override of a seed-only key is `null` (probe §4.2 E) although the effective value was the seed's; `GET /:year/changes` parses `:year` and ignores it (`listChanges(limit)` lists every year) while the panel reads "No changes recorded for {year}" |
| R6-10 | Minor | `tax-parameters.service.ts:107-110`; `tax-state-rules.service.ts:139-143` | The re-sync keeps a sign-off when only the **citation** changes. MODULE.md §9.3 defines `verified` as "checked the value against its citation"; a release that re-sources a value silently keeps the old sign-off |
| R6-11 | Minor | `tax-parameters.service.ts:133-138, 196-204` | Fallback only looks backward. A year before the oldest seed (e.g. 2024) resolves to zero rows, every estimate fails `TE_PARAM_MISSING`, and `create-from-prior` says `TE_NO_PRIOR_YEAR`. Not documented in §9.1 / §10 |
| R6-12 | Minor | `test-setup.ts:11` | `REDIS_URL` defaults to `redis://localhost:6379` — the production Redis — for every API test file. The estimate / snapshot tests write cache entries; running them without exporting `REDIS_URL` violates D13 |
| R6-13 | Minor | MODULE.md:273, 281, 298, 327, 334; `tax-state-rules.service.ts:13-15` | Doc vs reality: §9.4 says no Verify UI exists (`VerifyDialog.tsx` is shipped and tested); the §9 table limits `tax_parameters.status` to verified/unverified (CHECK and resolver allow `provisional`); §9.1 and the service comment describe the dead federal-pattern path (R6-03); runbook step 1 does not warn that rolled dates are observed dates and floating holidays are wrong (R6-01); §10.5 describes a diff filter that does not exist (R6-05) |
| R6-14 | Minor | `tax-parameters.service.test.ts`, `tax-state-rules.service.test.ts`, `dates.test.ts`, route tests | Coverage gaps listed in §3: no test rolls a real seed year against the next shipped year; the fallback test asserts one rate only (the R3-04 date roll is untested at service level); no override-on-fallback-year, concurrent-verify, verify-after-change, revert-hole, identical-diff, state-fallback-in-estimate, or cache-key-changes-on-verify test |

---

## 1. Findings in detail

### R6-01 — Major — The date roll carries observed dates and rolls floating holidays by month/day

`rollDateToYear` (`dates.ts:27-32`) keeps month and day. `rollYearDates` (`tax-parameters.service.ts:179-191`) rolls the prior year's `holidays` list that way, then lands every other `rollsWithYear` date on the next business day after those holidays (`rollValue`, `:356-364`); `rollStateDates` does the same per state (`tax-state-rules.service.ts:432-462`). Both create-year-from-prior and the R3-04 fallback (`getParameters:208`) use it, and the engine then applies `nextBusinessDay` again against the same rolled holidays (`vouchers.ts:299-301`), so nothing downstream can repair it.

Two independent errors:

1. **The seeds store observed dates, not statutory ones.** 2025 ships `installments.due_dates[1] = 2025-06-16` (Jun 15 was a Sunday), `q4_file_and_pay_date = 2026-02-02`, `farmer.file_by_date = 2026-03-02`. Rolling an observed date one year forward yields a non-statutory date that `nextBusinessDay` can only move later, never back. 2026 ships `q4_file_and_pay_date = 2027-02-01` (Jan 31, 2027 is a Sunday); rolled it becomes 2028-02-01, a Tuesday, while Jan 31, 2028 is a Monday.
2. **Federal legal holidays are rules, not dates.** MLK, Presidents', Memorial, Labor, Columbus and Thanksgiving are n-th weekdays; New Year's, Juneteenth, July 4, Veterans, Christmas and Emancipation Day move to Friday/Monday when they fall on a weekend. Only 7 of the 24 rolled holidays match the real 2026/2027 list (probe §4.1).

Failure scenario (the real one): no 2027 federal seed has shipped by January 2027; every 2027 estimate runs on the fallback (`TE_PARAMS_FALLBACK_YEAR`), or the super admin creates 2027 from 2026 per runbook step 1. Rolled: Q4 due **2028-01-17** = MLK Day 2028 (the engine's own `nextBusinessDay` cannot see it because the rolled list says 01-18) — correct **2028-01-18**; `q4_file_and_pay_date` **2028-02-01** — correct **2028-01-31**; `return_due_date` **2028-04-17** — Apr 15, 2028 is a Saturday, Emancipation Day (Apr 16) is a Sunday observed Monday 17, so the §7503 date is **2028-04-18**; `farmer.single_due_date` 2028-01-17 — correct 01-18. The return due date is the penalty accrual end and the payment-window end (R3-02/R3-04 consumers), so it moves money, not just a label. The rows carry `provisional` and a `verify` badge, which is the intended safety net — but the admin screen shows a plausible-looking date with no hint that the roll itself is unreliable, and `rolledDates` in the audit row reads as "done".

Fix (schema-builder + api-builder, one PR; needs Kurt's sign-off on the calendar rule):
- Put the **statutory** definition in the registry, not the observed date: each `rollsWithYear` key gets `statutory: { monthDay: 'MM-DD', yearOffset: 0 | 1 }` (`installments.due_dates` → `04-15, 06-15, 09-15, 01-15+1`; `q4_file_and_pay_date` → `01-31+1`; `return_due_date` → `04-15+1`; `farmer.single_due_date` → `01-15+1`; `farmer.file_by_date` → `03-01+1`). Create-year and fallback derive the target year's dates from these, never from the prior year's stored (observed) dates.
- Compute `holidays` for the target year from the deterministic OPM rules (5 U.S.C. 6103 fixed dates with the Sat→Fri / Sun→Mon observance, the five floating Mondays, Thanksgiving 4th Thursday, DC Emancipation Day Apr 16 with observance), for the target year **and the following January–April** (the Q4 date and return due date live there). Shared helper in `dates.ts`, unit-tested against the shipped 2025/2026/2027 lists; still flagged `provisional`.
- Until that lands: when rolling, compute the statutory day first (strip a prior bump by comparing against the registry month-day) and **emit `holidays` as an empty list with a loud `TE_HOLIDAYS_UNKNOWN` warning** rather than a wrong list; put a one-line warning in the runbook.
- Test: `createYearFromPrior(2026)` from the 2025 seed must equal the shipped 2026 dates (and the same for 2027 once it ships). This single test would have caught both errors.

### R6-02 — Major — One stray override converts a fallback year into an unusable partial year and locks out create-from-prior

`yearHasRows` (`tax-parameters.service.ts:126-131`) counts seed **or override** rows. `setOverride` (`:263-288`) and `verifyOne` do not check it. The UI shows **Override** on every row, including `source: 'fallback'` rows (`TaxParametersPage.tsx:197`; `StatesView.tsx:111`). The federal year tabs list only years that have rows, so federal fallback rows are reachable only through the API; the States view uses the federal year list, so a state whose rules have not shipped for an existing federal year renders its fallback rows **with Override buttons** (the "missing" state → detail path in `StatesView.tsx`).

Probe §4.2: with 2085 falling back to 2080 (5/5 present), one `setOverride(2085, 'se.ss_wage_base')` → `isFallback: false, present: 1 / 161`; `createYearFromPrior(2085)` → 409 `TE_YEAR_EXISTS`; `getYears` now lists 2085 as a real year. Every estimate for 2085 would throw `TE_PARAM_MISSING` (422 via `runEngine`, `estimate.service.ts:93-101`) for the first parameter the engine reads. The only recovery is `DELETE /:year/:key`, which nothing on the screen suggests (the row shows source `override`, status `unverified`, and the Revert button says "to the shipped value").

State variant: `anyRowsInYear` (`tax-state-rules.service.ts:268-275`) is **year-wide**, so one override on one state for 2085 → `createYearFromPrior` 409 for all 51 jurisdictions (probe B3), while the other 50 states still display the per-state fallback (B2). The `canCreate` button in `StatesView.tsx:200` requires every state to be "missing", so it disappears too.

Fix (api-builder + ui-builder):
- Server: in federal `setOverride` / `verifyParameter`, refuse when `!yearHasRows(year)` with 409 `TE_YEAR_NOT_CREATED` ("Create {year} from prior first"); in state `setOverride` / `verifyStateRule`, refuse when the state has no rows for the year. Keep the override path for years that exist.
- State `createYearFromPrior`: make it **per state** — skip states that already have rows for the year (report them in the result) instead of 409 on the whole year; keep 409 only when every taxed state already has rows.
- UI: hide Override / Mark verified on `source === 'fallback'` rows and show "Create {year} from prior to edit" instead; make the Revert text say "Remove the override" when `shippedValue === undefined`.
- Test: override on a fallback year → 409; state create-from-prior with one pre-existing state → creates the other 50.

### R6-03 — Major — The admin States screen and the estimate disagree about a missing state-year

`listSummaries` and `resolveStateRulesForEngine` (`tax-state-rules.service.ts:282-326`) resolve the requested year only: a state with no rows is `status: 'missing', usesFederalFallback: true` and the UI shows "Federal fallback · verify" (`StatesView.tsx:252`). The estimate does **not** call that function. `estimate.service.ts:247` calls `getStateRules(year, state)`, which falls back to the state's latest earlier year (`:286-294`), rolls its dates (R6-01) and reports `complete: true`; `jurisdictionFromStateRules` (`engine/state.ts:315`) then sets `usesFederalFallback = !dto.complete = false` and the engine applies **last year's state rules** — thresholds, safe-harbor percentages, `penalty.rate_schedule` legs date-shifted with last year's rates — with only the per-rule `TE_STATE_RULE_UNVERIFIED` (status `provisional`) warnings and the verify badge. Probe §4.2 B2/B4/B5 shows the three views side by side for AR 2085. `resolveStateRulesForEngine` has no caller outside its own test; the file's header comment (`:13-15`) and MODULE.md §9.1 ("A state with no usable rule set falls back to the federal pattern") describe the dead path.

Failure scenario: January 2027, federal 2027 created or shipped, state 2027 rules not yet created. The super admin opens States → 2027, sees 51 × "missing · Federal fallback", and reasonably concludes that MO/AR vouchers use the federal pattern (which is what MODULE.md says). The firm's MO/AR clients actually receive 2026 MO/AR rules rolled by R6-01, with no `TE_STATE_RULES_FALLBACK_YEAR`-style notice on the readiness banner or PDF (the federal side has `TE_PARAMS_FALLBACK_YEAR`; the state side has nothing year-level).

Fix (api-builder): decide one behaviour and make both sides say it. Recommended — keep the prior-year fallback (it is what the federal side does and what R3-04 intended) but (a) add `TE_STATE_RULES_FALLBACK_YEAR` per state in `gather()` mirroring the federal warning, (b) make `listSummaries` report `status: 'fallback'` with `fallbackYear` and a chip "Using {fallbackYear} rules · verify" instead of "Federal fallback", (c) delete `resolveStateRulesForEngine` or route the estimate through it, and (d) fix the comment and §9.1. Test: `computeEstimate` for a year with federal rows and no state rows asserts the fallback warning and the rules' `fallbackYear`.

### R6-04 — Major — Verify signs the current value at commit time, not the value the admin saw

`verifyOne` (`tax-parameters.service.ts:315-334`; state `:388-412`) does `SELECT` → `if (verifiedAt) return false` → `UPDATE … WHERE id = ?` → `auditLog`. No `FOR UPDATE`, no value or `updated_at` precondition, and the route body is `{ note? }` only (`verifyTaxParameterSchema`, `schemas/tax-estimator.ts:37-39`).

Observed (probe §4.2 G): two concurrent `verifyParameter` calls for the same seed row by two admins both return 200 with `status: 'verified'`, **two** `signoff` audit rows are written, and the row keeps whichever `UPDATE` landed last — both responses showed admin A's note, so admin B's sign-off exists only in the audit log and contradicts the row. Idempotence holds only for sequential calls.

Not probed but follows from the same shape: admin A opens "Mark verified" on `se.ss_wage_base` showing 176,100; admin B saves an override 184,500 (which clears the sign-off); A clicks confirm — `verifyOne` finds the override row with `verifiedAt = null` and marks **184,500** verified by A with A's note "checked against Rev. Proc. …". The migration comment's contract ("a row is verified for its CURRENT value") is met literally and violated in substance. Bulk verify widens this: `verifyAllParameters` resolves the year, then verifies key by key in one transaction, each key by the same unguarded path — a whole year's sign-offs can attach to values changed under it.

Fix (api-builder):
- Carry the value: `verifyTaxParameterSchema` gains `expectedValue: unknown` (required from the UI, optional for scripts) and the server compares with `deepEqual` against the row it is about to sign; mismatch → 409 `TE_PARAM_CHANGED` with the current value so the dialog can re-render.
- Make the write conditional: `UPDATE … SET verified_at = now(), … WHERE id = $1 AND verified_at IS NULL [AND value = $expected] RETURNING id`; write the audit row only when a row came back; `verifyAllParameters` collects only keys that actually flipped (it already filters by status, but the status it read is stale by the time it writes).
- Same two changes in `tax-state-rules.service.ts`. Tests: concurrent verify → exactly one audit row and one verifier; verify with stale `expectedValue` → 409.

### R6-05 — Minor — Diff lists identical rows as differences

`diffShippedVsProvisional` returns every provisional row that has a seed, without comparing values (probe §4.2 K: `se.ss_wage_base` and `holidays` listed with identical values). MODULE.md:334 and `ParameterPanels.tsx:32` both promise a differences-only list. The rows do matter — an identical provisional row still hides the shipped row's `status` and citation from the engine, so adopting it is the right move — but the admin should see "same value" and the doc should say "lists every provisional row that has a shipped counterpart, marking identical values". Fix: add `same: boolean` to the DTO (`deepEqual`), render a chip, and reword the empty-state text and MODULE.md.

### R6-06 — Minor — A created federal year has no citations

`tax_parameter_overrides` has no `citation` column (0201:31-43); `resolveYear` uses `seed?.citation ?? ''` (`:156`), and there is no seed until the release ships. The Verify workflow asks the admin to check each of 161 values "against its source" from a screen whose Citation column is blank for the whole year. The state table has `citation` and `createYearFromPrior` copies it (`tax-state-rules.service.ts:493`). Fix: additive `ALTER TABLE tax_parameter_overrides ADD COLUMN IF NOT EXISTS citation TEXT NOT NULL DEFAULT ''` in the 0201 verification part, copy the prior year's citation on create (prefixed "Carried from {fromYear}: "), and prefer it in the resolver when no seed exists.

### R6-07 — Minor — Reverting a provisional row with no shipped counterpart leaves a hole

`revertOverride` deletes the row regardless of whether a seed exists (`:290-300`). In a created year the key is then missing; the year still has rows so no fallback; `completeness.present` drops (probe §4.2 J: `se.nese_factor` MISSING, 4/5) and the next estimate throws `TE_PARAM_MISSING`. The confirm text says "to the shipped value". Fix: when no seed exists for (year, key), either refuse (409 `TE_NO_SHIPPED_VALUE`, "edit it instead") or re-create the provisional row from the prior year; UI text conditional on `shippedValue !== undefined`.

### R6-08 — Minor — Same-value re-override clears the sign-off; editing a provisional row makes it an override forever

Probe §4.2 D: saving an override with the value that was just verified resets `status` to `unverified` and `verified_at` to null — harmless but noisy (an admin fixing a typo in the reason loses the sign-off). More important: `setOverride` on a `provisional` row sets `status = 'override'`, so the row leaves `diffShippedVsProvisional` / `adoptShipped` (both filter `status = 'provisional'`) and will shadow the seed shipped in the next release until someone notices and reverts; `created_from_year` is left on the row. Fix: keep `verified_*` when `deepEqual(prev.value, value)`; keep `status = 'provisional'` (and `created_from_year`) when editing a provisional row that still has no seed, or surface override rows in the diff too.

### R6-09 — Minor — Change feed: null `before` for seed overrides, `:year` ignored

`setOverride` audits `before.value = prev?.value ?? null` (`:283-285`) — null when the previous effective value was the seed's. `GET /:year/changes` parses `year` and calls `listChanges(limit)` (`routes:58-62`), which lists every year; `ParameterPanels.tsx:63` says "No changes recorded for {year}". Fix: `before` = the resolved effective value; filter `after_data->>'year'` in SQL.

### R6-10 — Minor — A citation-only seed change keeps the sign-off

The re-sync's CASE compares `value` only (`:107-110`). A release that corrects a citation (the source the admin checked) leaves `verified_*` intact. Fix: compare `(value, citation)`, or record `verified_citation` and show a "source changed since sign-off" chip.

### R6-11 — Minor — Backward-only fallback is undocumented

`latestYearBefore` only. Requesting a year below the oldest seed (2024) returns zero rows; an estimate fails `TE_PARAM_MISSING`; `create-from-prior` says `TE_NO_PRIOR_YEAR`. Fine as a rule, but §9.1 / §10 should say "the module serves 2025 onward; earlier years are not supported", and the UI year list could say so.

### R6-12 — Minor — Test setup defaults to the production Redis

`test-setup.ts:11`: `REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379'`. The parameter tests do not touch Redis, but the estimate / snapshot / portal tests write `te:estimate:*` entries. Anyone running `vitest run` on this host without exporting `REDIS_URL=redis://localhost:6390` writes test cache entries into production Redis (D13). Fix: default to 6390 on this host or fail fast when `REDIS_URL` is unset in `NODE_ENV=test`.

### R6-13 — Minor — Documentation vs reality

| MODULE.md | Says | Reality |
|---|---|---|
| :273 table | `tax_parameters.status` is `verified` / `unverified` | CHECK and resolver also allow `provisional` |
| :281 | state with no usable rule set falls back to the federal pattern | true for the admin summary, false for the estimate (R6-03) |
| :298 | "no UI button was found in `packages/web` yet … use the API" | `VerifyDialog.tsx` + per-row / bulk buttons are shipped and tested |
| :327 step 1 | holidays shift by the year difference, dates land on the next business day | that is the defect in R6-01; the step needs a warning |
| :334 step 5 | diff "lists keys where the shipped value differs" | lists every provisional row with a seed (R6-05) |
| `tax-state-rules.service.ts:13-15` | "The estimator itself uses resolveStateRulesForEngine()" | dead code; estimate uses `getStateRules` |

### R6-14 — Minor — Test coverage gaps (see §3)

---

## 2. What was checked and holds

- **Re-sync vs overrides / provisional / verifications.** `syncShippedSeeds` writes only `tax_parameters`; the stale-key delete is scoped to shipped years; the CASE keeps `verified_*` and status `verified` only when the stored jsonb equals the new seed value (probe F: numeric `1.0 = 1` true, key order ignored, array order significant — so a reordered `holidays` list counts as a change, which is right). Seeds with status `unverified` re-synced over an in-app-verified row keep `verified` (test `:254-262` covers it). State mirror identical.
- **Resolution order.** `resolveYear` / `resolveRows`: override row (either status) wins over seed; derived status `verified` iff `verified_at`, else `unverified` (override) / `provisional`; unknown DB keys ignored; `shippedValue` only when it differs.
- **Create-year.** Copies the **effective** value (override wins), all rows `provisional` with reason "Created from Y; verify", `created_from_year` set, one `year_created` audit row with `rolledDates`; 409 / 400 guards; rates and amounts carried verbatim (documented). Status downgrade is correct — only the dates are wrong (R6-01).
- **Verify.** Super-admin only (401/403 tested); `confirm: z.literal(true)` enforced (400 tested); seed row → `status='verified'` + `verified_*`; override/provisional row → `verified_*` only, resolver reports `verified`; already verified → no write, no audit; unknown key 400 `TE_PARAM_INVALID`; fallback year → 404 single / `[]` bulk; override after verify → `unverified`, revert → back to the seed's own state; `verifiedByEmail` resolved for display; audit `signoff` / `op: 'verified'` with source. Bulk verify blast radius = every non-verified key of one federal year or one state-year, inside one transaction, with the note on every row — as specified (§9.4 "end of the checklist walk").
- **Cache.** `inputsHash` (`estimate.service.ts:262-275`) covers `params: g.paramsDto` and `stateRules: g.stateRules` in full (values, statuses, `verifiedAt`, `verifiedByEmail`, `isFallback`), plus `day`; the Redis key embeds the hash (`:719-721`). Any verify / override / revert / adopt / re-sync therefore misses the cache on the next request; no explicit invalidation is needed and none is missing. `refresh: true` is used by snapshot creation.
- **Snapshots.** Payload freezes `federalParameters` and `stateRules` DTOs and the result's `parametersUsed` / `rulesUsed`; the compare view reports value **and status** changes per key (a later verify shows up as a status change, which is the intended semantics). Rollback drops the verification columns; audit rows survive.
- **D12a.** `ParameterReader.warnings()` / `StateRuleReader.warnings()` emit one warning per non-verified key read, status included; fallback rows are forced `provisional` so they warn; verifying a row removes its warning on the next (uncached) compute. `TE_PARAMS_FALLBACK_YEAR` names the fallback year and what was rolled.
- **Migration part.** Twelve `ADD COLUMN IF NOT EXISTS` on the four tables, additive, last in the file; rollback drops them before the tables.

---

## 3. Test coverage gaps

Existing: 22 federal + 23 state service tests, 2 route files with Verify cases, 2 web test files, seed completeness suites, `dates.test.ts`. Missing:

1. **Roll against reality** — `createYearFromPrior(2026)` from the 2025 seed vs the shipped 2026 seed (would fail today: R6-01). Same for holidays.
2. **Fallback date roll at service level** — the fallback test (`:107-114`) asserts `se.nese_factor` only; R3-04's fix has no assertion on `return_due_date` / `installments.due_dates` under `getParameters`.
3. Override / verify on a fallback year (R6-02) and state create-from-prior with one pre-existing state.
4. Concurrent verify and verify-after-override (R6-04).
5. Estimate for a year with federal rows and no state rows asserts which rules the engine used (R6-03).
6. Revert of a provisional row with no seed (R6-07); same-value re-override (R6-08).
7. Diff with identical values (R6-05); `listChanges` year filter (R6-09).
8. Cache: compute → verify a parameter → compute again returns `cached: false` with the warning gone (the mechanism is a hash so this is cheap to assert and it protects the contract).
9. Seed hygiene: a completeness-suite check that every `rollsWithYear` date in a seed equals `nextBusinessDay(statutory, holidays)` for that year (catches a mistyped observed date), and that `holidays` covers January–April of year+1.

---

## 4. Probe output (verbatim, trimmed)

### 4.1 `dates-probe.ts` — shipped seeds rolled with the module's own helpers

```
== roll 2025 -> 2026
holidays rolled: 2026-01-01 2026-01-20 2026-02-17 2026-04-16 2026-05-26 2026-06-19 2026-07-04 2026-09-01 2026-10-13 2026-11-11 2026-11-27 2026-12-25 2027-01-01 2027-01-19 2027-02-16 2027-04-16 2027-05-25 2027-06-19 2027-07-03 2027-09-07 2027-10-12 2027-11-11 2027-11-26 2027-12-25
installments.due_dates 2026-04-15(Wed) 2026-06-16(Tue) 2026-09-15(Tue) 2027-01-15(Fri)
installments.q4_file_and_pay_date 2027-02-02(Tue)
return_due_date 2027-04-15(Thu)
farmer.single_due_date 2027-01-15(Fri)
farmer.file_by_date 2027-03-02(Tue)
-- actual shipped 2026 :
installments.due_dates 2026-04-15 2026-06-15 2026-09-15 2027-01-15
installments.q4_file_and_pay_date 2027-02-01
return_due_date 2027-04-15
farmer.single_due_date 2027-01-15
farmer.file_by_date 2027-03-01
holidays 2026-01-01 2026-01-19 2026-02-16 2026-04-16 2026-05-25 2026-06-19 2026-07-03 2026-09-07 2026-10-12 2026-11-11 2026-11-26 2026-12-25 2027-01-01 2027-01-18 2027-02-15 2027-04-16 2027-05-31 2027-06-18 2027-07-05 2027-09-06 2027-10-11 2027-11-11 2027-11-25 2027-12-24 2027-12-31

== roll 2026 -> 2027
holidays rolled: 2027-01-01 2027-01-19 2027-02-16 2027-04-16 2027-05-25 2027-06-19 2027-07-03 2027-09-07 2027-10-12 2027-11-11 2027-11-26 2027-12-25 2028-01-01 2028-01-18 2028-02-15 2028-04-16 2028-05-31 2028-06-18 2028-07-05 2028-09-06 2028-10-11 2028-11-11 2028-11-25 2028-12-24 2028-12-31
installments.due_dates 2027-04-15(Thu) 2027-06-15(Tue) 2027-09-15(Wed) 2028-01-17(Mon)
installments.q4_file_and_pay_date 2028-02-01(Tue)
return_due_date 2028-04-17(Mon)
farmer.single_due_date 2028-01-17(Mon)
farmer.file_by_date 2028-03-01(Wed)
2028-01-15 Sat  2028-01-17 Mon  2028-01-18 Tue  2028-01-31 Mon  2028-02-01 Tue  2028-04-15 Sat  2028-04-17 Mon  2028-04-18 Tue
```
Calendar facts used: MLK Day 2028 = third Monday of January = Jan 17; Emancipation Day Apr 16, 2028 is a Sunday, observed Monday Apr 17 (D.C. Code §1-612.02); the module's own 2026 seed citation states the observance rule it then fails to apply when rolling.

### 4.2 `db-probe.mts` — service calls against `kisbooks_test` (fixture years 2080/2081/2085, cleaned)

```
## F jsonb equality                 {"num":true,"keyorder":true,"arr":false}
## A0 fallback before               {"isFallback":true,"fallbackYear":2080,"completeness":5}
## A1 after one override            {"isFallback":false,"present":1,"total":161,"missingSample":["se.nese_factor","se.min_nese","se.ss_rate"]}
## A2 createYearFromPrior now       ERR 409 TE_YEAR_EXISTS Tax year 2085 already has parameters
## A3 years                         {"years":[2025,2026,2080,2085],"shippedYears":[2025,2026,2080]}
## C verify on fallback year        ERR 404 NOT_FOUND Parameter not found
## D same-value re-override         {"status":"unverified","verifiedAt":null}
## E audit before/after override_set (newest first)
   [{"before":176100,"after":176100,"reason":"probe same value again"},
    {"before":null,"after":176100,"reason":"probe same value as seed"},
    {"before":null,"after":190000,"reason":"probe: override on a fallback year"}]
## G concurrent verify              {"notes":["admin A","admin A"],"verifiedBy":["1111…1111","1111…1111"],"signoffAuditRows":2}
## I created from partial prior     {"created":5,"present":5}
## J revert provisional, no seed    {"isFallback":false,"present":4,"nese":"MISSING"}
## K diff rows                      [{"key":"se.ss_wage_base","shipped":176100,"prov":176100,"same":true},
                                     {"key":"installments.due_dates","shipped":["2080-06-16"],"prov":["2081-06-16"],"same":false},
                                     {"key":"return_due_date","shipped":"2080-06-14","prov":"2081-06-16","same":false},
                                     {"key":"holidays","shipped":["2081-06-18"],"prov":["2081-06-18"],"same":true}]
## B0 state fallback before         {"isFallback":true,"fallbackYear":2080,"complete":false}
## B1 MO after one override         {"isFallback":false,"complete":false,"missing":19}
## B2 AR still per-state fallback   {"isFallback":true,"fallbackYear":2080}
## B3 state createYearFromPrior     ERR 409 TE_YEAR_EXISTS State rules for 2085 already exist
## B4 summary for AR                {"state":"AR","status":"missing","counts":{...all 0},"usesFederalFallback":true}
## B5 resolveStateRulesForEngine AR {"rules":{},"usesFederalFallback":true,"verifyBadge":true,"estimatesRequired":true}
cleaned
```
(`se.ss_wage_base` / `holidays` in K are identical because the probe re-synced 2081 seeds equal to the 2080 fixture apart from the rolled holiday; this is exactly the state a real year is in after the release ships values the admin already carried forward.)

Probe files: `scratchpad/r6/dates-probe.ts`, `scratchpad/r6/db-probe.mts` (session scratchpad, not committed).

---

## 5. Recommended order

1. **R6-01** before any 2027 year is created or any 2027 estimate is shown to a client — statutory month-day in the registry + computed holiday calendar + the 2025→2026 regression test. Needs Kurt to confirm the §7503 / OPM observance rules as the module's calendar authority.
2. **R6-04** before the Verify screen is used for Kurt's sign-off — `expectedValue` + conditional UPDATE; it is a small change and the sign-off record is the module's audit evidence.
3. **R6-02 + R6-03** together (the two paths share `yearHasRows` / `anyRowsInYear` and the fallback semantics) — 409 guards, per-state create, fallback-aware summary, `TE_STATE_RULES_FALLBACK_YEAR`.
4. R6-05 … R6-11 and the MODULE.md corrections (R6-13) in the same PR as the tests in §3.
5. R6-12 is a one-line test-setup change; do it first if any estimate test is going to be run on this host.
