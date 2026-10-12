# R2 — Independent adversarial review of the Tax Estimator engine (phases 6–10)

Reviewer: R2 (Fable, independent of the engine authors). Date: 2026-10-12.
Scope: `packages/shared/src/tax-estimator/engine/**` on `feat/tax-estimator` at commits 94c96180 (phase 6), 58ef5322 (phase 8), f70b3803 (phase 7), d356debd (phases 9–10), read against MODULE.md (calc order, D7, D8, D10, D12a/b), OPEN-QUESTIONS.md, the oracle (`docs/reference-calc/rivera_fixture.py` / `rivera_expected.json`) and current federal law (OBBBA-era 2026 rules). Read-only on code; this file is the only artifact written.

Method: full read of every engine source file plus `decimal.ts`, `dates.ts`, `allocation.ts`, the 2026 federal seed, the ID/UT state seeds and the P&L provider's character accumulation; every engine test file run once (`npx vitest run <file>`, per D13); nine targeted probes executed with `tsx` against the real engine and the shipped 2026 seed (script kept in the session scratchpad, not in the repo). Numbers quoted below are engine output.

## Verdict: **FAIL** (one blocker). Becomes **PASS-WITH-FIXES** once R2-01 is fixed and R2-02 / R2-03 are fixed or formally accepted.

Counts: **1 blocker, 3 major, 19 minor** (plus 2 oracle notes and 4 proposed tests).

What is right (so the fixes are not mistaken for a rewrite): the ordinary-bracket tax, the Schedule D Tax Worksheet transcription (checked line-by-line and numerically), SE tax incl. the $400 floor and the wage-base offset, SEP/solo-401(k) limits, SEHI ordering (after ½ SE and retirement), the §68 2/37 formula and base, SALT cap/phase-down/floor, the Additional Medicare threshold-used-by-wages-first form, NIIT base, §199A threshold/phase-in/SSTB/loss-netting arithmetic, the §469(i) phase-out and MFS variants, §461(l) aggregate, Form 2210 Schedule AI lines 22–27 with recapture, Part II prorated wage base, event-driven payment application (earliest unpaid installment, carry-forward of excess), the §6654 accrual that stops at the earlier of payment or return due date and splits at rate / leap-year boundaries, §6654(e)(1)/(e)(2) waivers, §6655 lesser-of with the large-corporation first-installment rule and second-installment recapture, the farmer 2/3 test and single installment, and the D12a parameter/rule-status warnings through the readers. All 23 engine test files pass (268 tests), including both golden files against the oracle.

---

## Findings

### Blocker

**R2-01 — Qualified dividends from the books vanish from total income / AGI; the same dividends are then taxed at 0/15/20 % inside a too-small taxable income.**
Files: `engine/income.ts:349-368` (`netIncome`: total income and `dividends` read only `dividends_ordinary`), `engine/income.ts:170-172` and `engine/income.ts:304-305` (adjustments add a qualified dividend to BOTH buckets), `packages/api/src/services/tax-estimator/pl-provider.service.ts:197,593` (a "Qualified dividends" code or `dividends_qualified` treatment lands in ONE bucket: `rec[a.character]`).
What's wrong: the engine's `IncomeResult.dividends` is documented "ordinary dividends INCLUDING qualified", and the adjustment path keeps that convention by writing a qualified-dividend adjustment to both `dividends_qualified` and `dividends_ordinary`. The P&L provider (the only source of book income) uses an EXCLUSIVE convention. Two consequences: (a) book qualified dividends are in `dividends_qualified` only, so `netIncome` drops them from total income and AGI while `computeRegularTax` still receives them as `qualifiedDividends` and gives them the preferential rate; (b) adjustment qualified dividends are counted twice by `sumCharacters()` (used for the share trace, `applyLossLimitations` nets, `sourcedEntitiesFromFederal`, `TE_QBI_LINK_EXCLUDED`).
Failure scenario (probe P1, 2026 seed, single): partnership investment link, books ordinary 100,000 + qualified dividends 20,000. Engine: total income **100,000**, AGI 100,000, TI 83,900, regular tax **11,770** (worksheet: ordinary portion 63,900, 20,000 at 15 %). Correct: total income 120,000, TI 103,900, ordinary portion 83,900 → 13,170 + 3,000 = **16,170**. Tax understated by **$4,400**, silently, with no warning. Any TB code whose description contains "qualified dividend" (`firmCodeMeaning`) or any `dividends_qualified` treatment triggers it.
Suggested fix (engine-side, one convention): make the buckets EXCLUSIVE everywhere. In `income.ts` remove the two `dividends_ordinary` mirror writes; in `netIncome` set `dividends = dAdd(total.dividends_ordinary, total.dividends_qualified)` and use it in `totalIncome`; keep `qualifiedDividends = total.dividends_qualified`. `other-taxes.ts` already consumes `income.dividends`, so NII follows. Then `sumCharacters` is right by construction. Add the property test below (T1). Bump `TAX_ENGINE_VERSION`.

### Major

**R2-02 — Schedule 1-A deductions are allowed to married-filing-separately taxpayers.**
File: `engine/deductions.ts` `computeSch1a` (no filing-status gate; `countedPersons` merely drops the spouse).
Law: each of the four provisions requires a joint return for a married taxpayer — senior deduction §151(d)(5), tips §224, overtime §225, car-loan interest §163(h)(4) as added by OBBBA; the IRS fact sheet says "married individuals must file jointly to claim". The 2026 seed author knew this: the `sch1a.*.phaseout_threshold.mfs` citations read "MFS NOT ELIGIBLE … the engine must disallow the deduction for MFS" (seed lines 349-353, 385-389, 433-437) — the Phase 1 → Phase 6 hand-off was missed.
Failure scenario (probe P2): MFS, born 1958, wages 60,000 → engine senior deduction **6,000**, TI 36,250 instead of 42,250 (−$720 at 12 %). MFS with tips 8,000 / overtime 5,000 / car interest 3,000 → engine allows all **16,000**.
Fix: at the top of `computeSch1a`, `if (fs === 'mfs') { ctx.info('TE_SCH1A_MFS_NOT_ALLOWED', …); return zeros with inEffect: true }`. Mark the `.mfs` Sch 1-A keys as unused-by-design (or drop them from the registry) so D12a stops warning about them. Test T2.

**R2-03 — §469 suspension is allocated pro rata across ALL loss activities, so the §469(i) rental allowance leaks to non-rental passive losses and rental losses are over-suspended.**
File: `engine/loss-limits.ts:438-449` (the `suspended` pool is split over every `losers` entry by loss share).
Law: Form 8582 Part I/II: the special allowance applies only to rental real estate with active participation; other passive losses are allowed only against passive income. Worksheets 4–6 allocate the allowance to the rental activities first, then the unallowed remainder across the remaining activities.
Failure scenario (probe P5, single, wages 80,000): active-participation rental loss −20,000 (LP) and a passive non-rental business loss −20,000. Engine: allowance used 20,000, suspended 20,000 split **10,000 / 10,000**, so the rental shows allowed −10,000 and the passive business allowed −10,000. Correct: rental −20,000 fully allowed, passive business fully suspended. AGI happens to agree (60,000) but every downstream character-sensitive line is wrong: add a Sch C with QBI 50,000 and the engine's §199A deduction is 20 % × (50,000 − 10,000) = **8,000** instead of **10,000** (TI +2,000, ≈ $440); `income.rental` is −10,000 instead of −20,000 (NIIT rental line, state sourced income); the per-activity suspended carryforward shown to the CPA is wrong for both activities.
Fix: after `rental.used` is known, allocate it to the active-participation rental losers first (pro rata by their loss), then allocate the remaining suspension pro rata over the remaining loss (Form 8582 Wks 5 shape). Test T3.

**R2-04 — `TAX_ENGINE_VERSION` is still `0.6.0` after phases 7–10 changed computed lines.**
File: `engine/version.ts:6` ("Bump when a computed line can change"). Snapshots (MODULE.md "Finalize") store this string as provenance; a Phase 6 snapshot and a Phase 10 snapshot are indistinguishable. Fix: bump per phase (e.g. 0.10.0) and again with the R2 fixes; add a test that the version changes when `federal.golden` expectations change (or at least a CHANGELOG line in the file).

### Minor

**R2-05 — Schedule AI columns: monthly SEHI eligibility is applied to the annualized premiums.**
`engine/sch-ai.ts:354-368` (`annualizeEntity` scales `ownerItems.sehi`; `sehiEligibleMonths` is left as 12 flags) → `owner-deductions.ts` multiplies by eligible/12 again. Probe P6: eligible Jan–Mar only, period-1 actual SEHI 3,000 → Sch AI line 4 should annualize to 12,000; engine column deduction is 3,000 (same as full year). Conservative (column tax too high → Q1 installment too high) and only for partial-year eligibility. Fix: when annualizing, pass the period's eligible-month count scaled to 12 (or pre-apply the month fraction in the column and send all-true flags).

**R2-06 — Schedule AI column warnings and parameter reads are dropped.**
`engine/sch-ai.ts:585` prices each column with `input.calc(scenario)` and uses only `result.exact`; `result.warnings` / `result.parametersUsed` are discarded. A column-only condition (SEHI capped in Q1, QBI W-2 missing because an annualized column crosses the threshold, SALT phased down in one column) never reaches the assumptions page. Fix: merge column warnings with a `period` detail (dedupe by code+details) and union `parametersUsed`.

**R2-07 — Part II is rebuilt from ROUNDED person results.**
`engine/sch-ai.ts:530-533` reads `result.persons[].seIncome` / `totalWages` (whole dollars) and divides by the factor, then compares `R(partIiSeTax)` with `R(engineSeTax)`; the ±$1 drift produces spurious `TE_SCH_AI_SE_PART2_DIFFERS` infos and breaks the "round only at final lines" rule. Also `totalWages` includes `sehiAsW2Wages` (box 1, not Social Security wages), overstating the wage-base offset. Fix: expose exact per-person `seIncome` / `socialSecurityWages` on `FederalResult.exact` (or on the trace) and use those.

**R2-08 — Parameter: `qbi.threshold.mfs` = 201,775 (status verified).**
`seeds/federal/2026.ts:529-533`. §199A(e)(2)(A) has one indexed threshold with MFJ at 200 %; there is no separate MFS figure, so MFS = all-other = 201,750 (the 2024/2025 Rev. Procs. list MFS equal to "all other returns"). 201,775 is the 24 % bracket top for MFS. CPA check; $25 effect on the phase-in fraction only. (Not engine code; listed because the engine reads it as verified and will not warn.)

**R2-09 — §6654 day-boundary convention differs from Form 2210 Part III by one day per rate change.**
`engine/penalty.ts:150-175` assigns each day the rate in force on that day (Jun 30 → Jul 1 at the Q2 rate). Form 2210 counts "days from the due date to 6/30" at the Q2 rate and "days from 6/30 to the payment date" at the Q3 rate, i.e. the day Jun 30→Jul 1 at the Q3 rate. Probe P4: balance 1,000 Jun 15 → Jul 15: engine 16 d @6 % + 14 d @7 % = 5.315; form 15 + 15 = 5.342. Effect ≤ balance × Δrate ÷ 365 per boundary (cents). Document the convention on the assumptions page or shift the split by one day to match the form.

**R2-10 — A payment dated after the return due date zeroes `unpaidAtEnd` and marks the voucher `paid`.**
`engine/payments.ts:166-178` (balance is reduced regardless of date; `paidOn` set). Probe P7: Q1 1,000 paid 2027-06-01 → `unpaidAtEnd '0'`, status `paid`, while the penalty correctly accrues to Apr 15. The field is documented "unpaid as of the return due date". Either keep the penalty semantics and relabel the field ("unpaid at last payment"), or cap application at `endDate` for the unpaid figure.

**R2-11 — `computeItemizedDeductions` always runs, so standard-deduction taxpayers get D12a noise.**
`engine/federal.ts` step 8/9 (scratch + real itemized runs for every return). Every estimate reads `salt.*` and the unverified `itemized.benefit_cap_rate`, which lands in `parametersUsed` and a `TE_PARAM_UNVERIFIED` warning on returns with no itemized inputs. Skip the real itemized run (or suppress its reads) when all itemized inputs and `itemizedOther` are zero and mode ≠ `itemized`.

**R2-12 — Non-link `deduction` adjustments without a type silently become itemized "other".**
`engine/income.ts:320-333`. A business deduction entered without a `linkId` (and not `isAboveTheLine`) is never SE / QBI / §461(l) income and is deducted only if the taxpayer itemizes. Warn (`TE_ADJUSTMENT_UNLINKED_DEDUCTION`) or require the UI to force a link for entity-level types.

**R2-13 — SIMPLE compensation base and 60–63 catch-up.**
`engine/owner-deductions.ts` SIMPLE branch uses `seIncome − ½ SE` as the match base; §408(p)(6)(A)(ii) uses §1402(a) net earnings (92.35 % of profit, before ½ SE). Difference ≈ 0.6 % of profit × 3 %. SIMPLE 60–63 catch-up absent (Q30 already lists it). Low priority.

**R2-14 — Sch 1-A phase-outs are linear where the statute steps "$100 for each $1,000 (or fraction thereof)".**
`engine/deductions.ts` `phasedOut` for tips/overtime (§224(b)(2), §225(b)(2)) and car interest (§163(h)(4)(E), $200 per $1,000). Q30 records the car-interest approximation only; tips/overtime have the same step rule. Understates the reduction by up to $100/$200 per return. Fix: ceil((MAGI − threshold) / 1000) × step when a `*.phaseout_step` parameter is seeded.

**R2-15 — Derived nonresident sourced income uses pre-§469 shares and all characters.**
`engine/state.ts:341-349` (`sourcedEntitiesFromFederal` sums `e.shares[].share`, which `entityResult` takes from allocation, before loss limits) and includes interest / dividends / capital gains, which most states source to the residence state for a nonresident. Manual override exists; label the derived figure "before loss limits; includes portfolio income" or compute from `lossLimitations.shares[].allowed` and ordinary + rental + §1231 only.

**R2-16 — Farmer ratio compares against a truncated 2/3.**
`engine/farmer.ts:559-565` with `farmer.gross_income_ratio` 0.6666666666: a 12-place ratio of exactly 2/3 passes, one of 0.66666666665 passes though below 2/3. Compare `3 × farming ≥ 2 × total` (exact) or seed the ratio as a fraction.

**R2-17 — Loss percentage is applied to every character when the entity's TOTAL is a loss.**
`engine/income.ts:214-217`. Probe P9: ordinary −50,000 / rental +10,000, profit 50 % / loss 90 % → the partner gets 90 % of the positive rental (9,000). Spec-compliant ("a net loss by loss_pct", MODULE.md step 2) but partnership allocations are per item; worth a trace note ("loss % applied to all items").

**R2-18 — `computeStateEstimates` reads `safe_harbor.current_pct` (throws when null) BEFORE the `estimates_required` check.**
`engine/vouchers.ts:536-548`. ID/UT ship placeholder 0.9 values so nothing crashes today, but a future "no regime" row with a cited null (the registry allows it) throws `TE_STATE_RULE_INVALID` instead of returning the no-regime result. Move the `estimatesRegime` test above `stateSafeHarborRates`.

**R2-19 — No state annualized-income method and no assumptions note about it.**
`engine/vouchers.ts:519,558` pass `scheduleAi: null` for every state. Many states (MO Form MO-2210 Part III, AR AR2210A) allow annualization; when Schedule AI lowers a federal installment the state voucher stays regular with no label. Add a note (`TE_STATE_NO_ANNUALIZATION`) to the state estimate.

**R2-20 — §461(l)-disallowed loss still reduces QBI in the current year.**
`engine/qbi.ts:147-151` reads `s.share.*` (post-§469, pre-§461(l)); the EBL add-back in `loss-limits.ts:491-500` goes to the person's `character.ordinary` only. Reg. 1.199A-3(b)(1)(iv) takes a disallowed EBL into account in the year it is allowed. Because EBL only bites when aggregate business income is already a large loss, the current-year deduction is 0 either way; only the (untracked) QBI loss carryforward is overstated. Note on the assumptions page.

**R2-21 — Credit for taxes paid to other states ignores reverse-credit pairs.**
`engine/state.ts:174-206` always credits the resident state. AZ/CA/OR/VA/IN/DC pairs give the credit on the NONRESIDENT return. Rates are user-supplied flat rates anyway (Q17); add an assumptions line.

**R2-22 — `w2SocialSecurityWages == null` defaults to box 1 with no warning.**
`engine/income.ts:270`. Box 1 is below Social Security wages whenever the person defers to a 401(k), so the SE wage-base offset is understated (SE tax overstated, conservative). Emit an info when the default is used and SE income is positive.

**R2-23 — `TE_OWNER_ITEM_NO_LINK` synthetic share is typed `activityType: 'active'` and `qbiEligible: null`.**
`engine/income.ts:255-265`: a person with a guaranteed payment but no link gets an "active" empty share whose GP is SE income — fine — but it is also counted as an eligible QBI component (0 items) and an `activeQbi` participant; harmless today, surprising later. Mark `qbiEligible: false`.

### Oracle notes (places the oracle itself could be wrong)

**O-1 — `penalty_schedule` accrues each segment at the rate in force on the segment's START date** (`rate_on(last[i])`), never splitting at quarter boundaries. Rivera's only shortfall (Q3, Sep 15 → Jan 15) spans Sep 30 and Dec 31 at 7 % throughout, so the $11 agrees today; the moment a 2027 Q1 rate ≠ 7 % is seeded (or a fixture is late across Jun 30), the oracle and the engine will disagree and the golden will fail for an oracle reason. Fix the oracle to split at the `underpayment_rates` boundaries (Form 2210 Part III) before Phase 14's seasonal fixture.

**O-2 — Oracle coverage is thin on exactly the lines that are hardest.** Rivera exercises no QD/LTCG worksheet, no itemized/§68/SALT, no Sch 1-A, no §469 netting or allowance, no §461(l), no W-2/UBIA limit or SSTB phase-in, no positive NIIT or Additional Medicare, no QBI loss netting, no C corp and no farmer. All of those are verified only by unit tests written alongside the code. Before sign-off, add at least one independent high-income MFJ fixture (QD + LTCG, itemized above the SALT phase-down, SSTB in the phase-in range, NIIT > 0) and one passive-loss fixture to `reference-calc/`.

(Checked and found consistent with the engine: the oracle's SE / ½ SE / SEP 20 % / SEHI ordering, Additional Medicare `max(0, wages + NESE − threshold)` (algebraically identical to Form 8959 Parts I + II), NIIT, the full-year standard deduction and credits in the Schedule AI column (D7), the prorated wage base, even withholding, and the MO credit.)

---

## Proposed property / edge tests (snippets only — not added to the repo)

T1 — dividend-bucket convention (guards R2-01); goes in `income.test.ts`:
```ts
it('qualified dividends are counted exactly once wherever they come from', () => {
  const fromBooks = computeFederal(input({ entities: [entity({ entityType: 'partnership', ytd: characters({ dividends_qualified: '20000' }), recurringYtd: characters({ dividends_qualified: '20000' }), links: [{ ...link, partnerSeStatus: 'limited', activityType: 'investment' }] })] }));
  const fromAdj = computeFederal(input({ adjustments: [{ ...adjBase, id: 'qd', kind: 'income', amount: '20000', isQualifiedDividend: true }] }));
  for (const r of [fromBooks, fromAdj]) {
    expect(r.income.totalIncome).toBe('20000');
    expect(r.income.dividends).toBe('20000');
    expect(r.income.qualifiedDividends).toBe('20000');
    expect(r.entities.flatMap((e) => e.shares).every((s) => Number(sumCharacters(s.share)) <= 20000)).toBe(true);
  }
  expect(fromBooks.regularTax.tax).toBe(fromAdj.regularTax.tax);
});
```

T2 — MFS Schedule 1-A (guards R2-02); `deductions.test.ts`:
```ts
it.each(['senior', 'tips', 'overtime', 'carLoanInterest'] as const)('MFS gets no Schedule 1-A %s deduction (joint return required)', (line) => {
  const p = { ...person, age: 70, sch1a: { qualifiedTips: '8000', qualifiedOvertime: '5000', carLoanInterest: '3000' } };
  const r = computeSch1a([p], '60000', ctx('mfs'));
  expect(r[line]).toBe('0');
  expect(r.total).toBe('0');
});
```

T3 — §469(i) allowance goes to rental real estate first (guards R2-03); `loss-limits.test.ts`:
```ts
it('the §469(i) allowance is applied to active-participation rental losses before any other passive loss is allowed', () => {
  const agg = aggregate([share('rental', -20000, { activityType: 'rental', activeParticipation: true }), share('biz', -20000, { activityType: 'passive' })]);
  const r = applyLossLimitations(agg, { magi: '80000', mfsLivedApartAllYear: false }, ctx('single'));
  const byLink = Object.fromEntries(r.shares.map((s) => [s.linkId, s]));
  expect(byLink['rental']!.allowed).toBe('-20000');   // fully allowed by the $25,000 allowance
  expect(byLink['biz']!.allowed).toBe('0');           // no passive income → fully suspended
  expect(r.suspendedPassiveLoss).toBe('20000');
  // invariant for any mix: Σ allowed = −(min(passive losses, passive income) + allowance used)
});
```

T4 — Schedule AI level-income invariant with partial SEHI eligibility (guards R2-05) and the Part II exactness (R2-07); `sch-ai.test.ts`:
```ts
it('level income: every available column reproduces the full-year tax, including a person whose SEHI is deductible only Jan–Mar', () => {
  const flags = Array(12).fill(false); flags[0] = flags[1] = flags[2] = true;
  const mk = (months: number) => riveraLike({ months, sehiEligibleMonths: flags, premiumsYtd: String(12000 * months / 12) });
  const est = computeFederalEstimates({ ...fed(mk(12)), scheduleAi: { base: mk(12), periodActuals: [mk(3), mk(5), mk(8)], calc: computeFederal } });
  const full = est.scheduleAi!.periods[3]!;
  for (const p of est.scheduleAi!.periods.slice(0, 3)) {
    // Sch AI line 4: period SEHI (3,000 actual Jan–Mar) × 4 = 12,000 in column 1; the full year deducts 3,000.
    expect(Number(p.annualizedAgi)).toBeLessThanOrEqual(Number(full.annualizedAgi));
    expect(est.warnings.filter((w) => w.code === 'TE_SCH_AI_SE_PART2_DIFFERS')).toEqual([]); // exact inputs, no rounding drift
  }
});
```

T5 — penalty rate-boundary convention (documents R2-09 either way); `penalty.test.ts`:
```ts
it('accrual across Jun 30 splits at the quarter boundary with the documented day convention', () => {
  const pen = accrue({ due: '2026-06-15', required: '1000', paid: '2026-07-15' });
  expect(pen.segments.map((s) => [s.from, s.to, s.units, s.rate])).toEqual([['2026-06-15', '2026-07-01', 16, '0.06'], ['2026-07-01', '2026-07-15', 14, '0.07']]);
  // Form 2210 Part III would show 15 @ 6% and 15 @ 7%; difference 1000 × 0.01 / 365 ≈ $0.03.
});
```

---

## Checklist against the review brief

| Area | Result |
|---|---|
| SE tax / Addl Medicare / NIIT | Correct (NIIT trade-or-business carve-out already an open assumption, Q33) |
| QBI wage/UBIA, phase-in, SSTB, netting, overall limit, §199A(i) | Correct arithmetic; R2-03 (allocation input), R2-20 (EBL), R2-08 (MFS threshold value) |
| §469(i), §461(l) | Phase-out and MFS correct; **R2-03** allocation wrong |
| QD/LTCG worksheet | Correct transcription, verified numerically; **R2-01** feeds it wrong income |
| SALT / §68 / Sch 1-A / SEP-401k-HSA-SEHI | Correct except **R2-02** (MFS Sch 1-A), R2-13, R2-14 |
| Schedule AI (Part I/II, lines 22–27, recapture) | Correct; R2-05, R2-06, R2-07 |
| §6654 penalty (event-driven, rate legs, cure order) | Correct; R2-09 (1-day convention), R2-10 (labelling) |
| C corp §6655, large-corp recapture | Correct; Form 2220 annualization / short year not modelled (Q34, acknowledged) |
| Farmer | Correct; R2-16 |
| State credit / gates | Correct per spec; R2-15, R2-18, R2-19, R2-21 |
| Rounding | Whole-dollar half-up only at final lines, except R2-07 |
| Money-as-float | None found in the engine; `allocation.ts` cents path is integer-safe; `String(c/100)` round-trips exactly |
| Circularities | QBI → §68 → QBI broken by the pre-§68 base (Q32); §469(i) MAGI by the probe pass — both sound |
| Literals in non-engine helpers | `dates.ts` / `decimal.ts` hold only calendar/radix constants (Q31 accepted); `monthsOrFraction` boundary cases checked |
| D12a warnings | Readers warn once per non-verified key; gaps R2-06, R2-11 |
| Golden / unit tests | 23 files, 268 tests pass on 2026-10-12 |
