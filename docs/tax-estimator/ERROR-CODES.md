# Tax Estimator error and warning codes

Every `TE_*` code the module can emit, generated from the source on branch
`feat/tax-estimator` (base commit `1029420e` plus the uncommitted working-tree edits (R7 fix track, engine 1.0.0-rc.2) at the time of
writing, 2026-10-12). Companion to [MODULE.md](./MODULE.md) and
[AUDIT-CATALOGUE.md](./AUDIT-CATALOGUE.md).

**219 distinct codes**: 218 emitted, plus one documented-but-never-emitted code listed last. Line numbers
are a snapshot and drift; the code is the key. See "Regenerating" at the bottom.

## How codes reach you

| Channel | Shape | Notes |
|---|---|---|
| HTTP error (`AppError`) | `{ "error": { "message", "code", "details"? } }` with the HTTP status in the Type column | The global handler (`middleware/error-handler.ts`) serialises `code` verbatim. |
| Estimate / readiness / snapshot warning | `warnings[]` entries `{ code, severity: 'warning' \| 'info', message, details? }` on the result DTOs | Never an HTTP error. Printed on the preparer PDF and the assumptions page (the client variant omits them). The engine de-duplicates identical `code + details`. |
| Engine `throws Error` | A plain `Error` whose message starts `TE_X: ...` | An invariant violation or a seed / override defect. Not an `AppError`, so an uncaught one surfaces as `500 INTERNAL_ERROR` ("Internal server error"); the real code is only in the server log (`Unhandled error:`). Treat as a bug or bad data, not a user error. |
| Pass-through | `warnings[].code = err.code ?? 'TE_<FALLBACK>'` | A coded `AppError` raised while reading one linked company is downgraded to a warning with its own code; only an uncoded error gets the fallback code. |

A code can appear in more than one channel (for example `TE_NO_PERSONS` is both a 422 and an engine throw); the Type column lists them all.

Severity semantics: `warning` = the figure may be wrong or an input was assumed (counts in the readiness banner); `info` = explanatory, no action needed.

Column "Where" uses short paths relative to `packages/`: `engine/` = `shared/src/tax-estimator/engine/`, `shared/` = `shared/src/tax-estimator/`, `svc/` = `api/src/services/tax-estimator/` (or `api/src/services/`), `routes/` = `api/src/routes/...`, `mw/` = `api/src/middleware/`.

## Catalogue

| Code | Type | Where emitted | Meaning |
|---|---|---|---|
| `TE_ACCESS_GRANT_FORBIDDEN` | HTTP 403 | `svc/portal-contact.service.ts:219` | Granting tax estimate access needs Tax Estimator access for this client (firm staff) |
| `TE_ACCOUNT_NOT_FOUND` | HTTP 404 | `svc/adjustments.service.ts:84`, `svc/treatments.service.ts:192` | Account not found |
| `TE_ADDL_MEDICARE_MANUAL_OVERRIDE` | warning | `engine/other-taxes.ts:64` | Additional Medicare tax is overridden to … (engine computed …). |
| `TE_ADJUSTMENTS_TRUNCATED` | warning | `svc/estimate.service.ts:252` | Only the first … adjustments were used. |
| `TE_ADJUSTMENT_ACCOUNT_UNREADABLE` | warning | `svc/estimate.service.ts:361` | Adjustment "…" reads an account whose company could not be read (…); only its manual amount is used. |
| `TE_ADJUSTMENT_CAP` | HTTP 422 | `svc/adjustments.service.ts:118` | Too many adjustments in this scenario |
| `TE_ADJUSTMENT_INVALID` | HTTP 422 | `svc/adjustments.service.ts:153` | Invalid adjustment |
| `TE_ADJUSTMENT_LINK_EXCLUDED` | warning | `svc/estimate.service.ts:494` | Adjustment "…" belongs to an entity that is not in this estimate (out of scope, C corporation or skipped); left out. |
| `TE_ADJUSTMENT_LINK_INVALID` | HTTP 422 | `svc/adjustments.service.ts:71` | Entity link does not belong to this taxpayer and year |
| `TE_ADJUSTMENT_LINK_NOT_ALLOWED` | HTTP 422 | `svc/adjustments.service.ts` (validate) | This owner-level deduction is figured per person and cannot be attached to an entity. (QA D1: owner health insurance, SEP/solo 401k, HSA, retirement catch-up — `adjustmentLinkRule` = not_allowed.) |
| `TE_ADJUSTMENT_LINK_REQUIRED` | HTTP 422 | `svc/adjustments.service.ts` (validate) | Choose the business this deduction belongs to. Without an entity it would be treated as an itemized deduction, not a business expense. (QA D1: §179 vehicle, tax-vs-book depreciation and firm deduction types that affect SE/QBI and are not above the line; checked on create and on the merged row of an update.) |
| `TE_ADJUSTMENT_NOT_FOUND` | HTTP 404 | `svc/year-access.ts:27` | Adjustment not found (D17: also for the id of a taxpayer the caller may not see) |
| `TE_ADJUSTMENT_PERSON_INVALID` | HTTP 422 | `svc/adjustments.service.ts:66` | Person does not belong to this taxpayer |
| `TE_ADJUSTMENT_TYPE_INACTIVE` | HTTP 422 | `svc/adjustments.service.ts:107` | Adjustment type is inactive |
| `TE_ADJUSTMENT_TYPE_IN_USE` | HTTP 409 | `svc/adjustment-types.service.ts:104` | This type is used by adjustments; deactivate it instead |
| `TE_ADJUSTMENT_TYPE_MISSING` | warning | `svc/estimate.service.ts:490` | Adjustment "…" has an unknown type; left out. |
| `TE_ADJUSTMENT_TYPE_NAME_TAKEN` | HTTP 409 | `svc/adjustment-types.service.ts:54` | An adjustment type with that name already exists |
| `TE_ADJUSTMENT_TYPE_NOT_FOUND` | HTTP 404 | `svc/adjustment-types.service.ts:28` | Adjustment type not found |
| `TE_ADJUSTMENT_TYPE_READONLY` | HTTP 403 | `svc/adjustment-types.service.ts:60` | Shipped adjustment types are read-only |
| `TE_ADJUSTMENT_UNLINKED_DEDUCTION` | info | `engine/income.ts:360` | …: a deduction with no entity link that is not above the line is treated as an itemized deduction (other) — it is not SE, QBI or §461(l) business income. Link it to an entity if it is a business deduction. |
| `TE_AI_ALREADY_APPLIED` | HTTP 409 | `svc/tax-param-ai-check.service.ts` (applyCheck) | This AI value was already applied. (Q44: each `differs` check can be applied once) |
| `TE_AI_CHECK_STALE` | HTTP 409 | `svc/tax-param-ai-check.service.ts` (applyCheck) | The value changed after this AI check ran; run the check again before applying. (Q44; `details.currentValue`) |
| `TE_AI_NOTHING_TO_CHECK` | HTTP 400 | `svc/tax-param-ai-check.service.ts` (createRun) | Nothing to check: no unverified rows for …. (Q44 check-all on a year / state with every row verified, or a fallback year) |
| `TE_AI_NOT_APPLICABLE` | HTTP 409 | `svc/tax-param-ai-check.service.ts` (applyCheck) | Only a check whose verdict is "differs" can be applied. (Q44) |
| `TE_AI_RUN_ACTIVE` | HTTP 409 | `svc/tax-param-ai-check.service.ts` (createRun) | An AI check is already running for this selection; wait for it or cancel it. (Q44: one active bulk run per year; the same single row is not queued twice; `details.runId`) |
| `TE_AI_TOO_MANY` | HTTP 400 | `svc/tax-param-ai-check.service.ts` (createRun) | Too many rows (…); check federal or one state at a time. (Q44 cap of 3,000 rows per run) |
| `TE_AI_UNAVAILABLE` | HTTP 400 | `svc/tax-param-ai-check.service.ts` (createRun) | AI is turned off in Admin → AI. / No Anthropic API key is saved in Admin → AI. (Q44: the Check buttons are disabled with the same reason) |
| `TE_AMT_NOT_MODELLED` | warning | `engine/federal.ts:241` | AMT exposure was flagged; the alternative minimum tax is out of scope and not included. |
| `TE_BASE_SCENARIO_PROTECTED` | HTTP 422 | `svc/scenarios.service.ts` (delete, rename) | The Base scenario cannot be deleted / The Base scenario cannot be renamed (QA D21) |
| `TE_CAPITAL_LOSS_LIMITED` | warning | `engine/income.ts:423` | Net capital loss … is limited to … this year (§1211); … carries forward (not tracked). |
| `TE_CCORP_BELOW_MIN_TAX` | info | `engine/ccorp.ts:298` | Federal tax … is below …; no estimated-tax installments are required (IRC §6655(f)). The schedule is shown for reference. |
| `TE_CCORP_FAILED` | warning | `svc/estimate.service.ts:662` | Fallback code when computing a linked C corporation fails with an AppError that carries no code; the message is `<company>: <error message>`; the entity is left out. |
| `TE_CCORP_FISCAL_MONTH` | throws Error | `engine/ccorp.ts:213` | fiscal_year_start_month … is not 1..12 |
| `TE_CCORP_INPUTS_LIMITED` | warning | `svc/estimate.service.ts:666` | C corporation estimates use the current-year rule only and no state tax: prior-year tax, prior taxable incomes and state apportionment are not stored yet. |
| `TE_CCORP_INSTALLMENT_LISTS` | throws Error | `engine/ccorp.ts:334` | ccorp.installment_months (…) and ccorp.installment_pcts (…) must be non-empty and the same length |
| `TE_CCORP_INSTALLMENT_MONTH` | throws Error | `engine/ccorp.ts:226` | installment month … is not 1..12 |
| `TE_CCORP_LARGE_CORP_DERIVED` | warning | `engine/ccorp.ts:312` | … is treated as a large corporation: taxable income reached … in one of the … preceding years (IRC §6655(g)(2)); the entity flag is off. |
| `TE_CCORP_PRIOR_YEAR_UNAVAILABLE` | info | `engine/ccorp.ts:327` | The prior-year safe harbor is unavailable (…); installments are based on the current-year tax (IRC §6655(d)(1)(B)(ii)). |
| `TE_COMPANY_NOT_FOUND` | HTTP 404 | `svc/adjustments.service.ts:80`, `svc/entity-type.service.ts:49`, `svc/taxpayers.service.ts:399` | Company not found |
| `TE_COMPANY_NOT_LINKED` | HTTP 409 | `svc/register-flags.service.ts:67` | This company is not linked to a taxpayer in the Tax Estimator (register / transaction-detail non-recurring flag; only a company linked to one of the managing firm's active taxpayers can be flagged) |
| `TE_CONTACT_NOT_FOUND` | HTTP 404 | `svc/taxpayers.service.ts:522`, `svc/taxpayers.service.ts:581` | Contact not found |
| `TE_DEDUCTION_FORCED` | info | `engine/deductions.ts:159` | The … deduction was forced although the … deduction is larger. |
| `TE_DOB_IN_FUTURE` | HTTP 422 | `svc/taxpayers.service.ts:116` | Date of birth cannot be in the future |
| `TE_DUPLICATE_ACCOUNT` | HTTP 400 | `svc/treatments.service.ts:189` | Each account may appear once |
| `TE_DUPLICATE_TRANSACTION` | HTTP 400 | `svc/treatments.service.ts:285` | Each transaction may appear once |
| `TE_EBL_QBI_TIMING` | info | `engine/loss-limits.ts:252` | The §461(l) disallowed loss … still reduces this year's qualified business income; Reg. 1.199A-3(b)(1)(iv) takes it into QBI only in the year it is allowed, so the (untracked) QBI loss carryforward is overstated by up to that amount. |
| `TE_EFFECTIVE_RATE_MISSING` | warning | `engine/bracket-tax.ts:134` | Rate mode is "effective" but no effective rate is set; the brackets were used. |
| `TE_EFFECTIVE_RATE_OVERRIDE` | warning | `engine/bracket-tax.ts:139` | Regular tax uses an effective-rate override of … instead of the brackets (labelled on every surface). |
| `TE_ENTITY_1040_RENTAL` | warning | `svc/entity-type.service.ts:151` | The TB profile is a 1040 rental activity; the estimator treats it as Schedule C. Check the owner link activity type (rental) and the rental QBI setting. |
| `TE_ENTITY_SKIPPED` | warning | `svc/estimate.service.ts:301` | Fallback code when a linked company cannot be read (an AppError without a code); message `<company>: <error>; left out of the estimate.` |
| `TE_ENTITY_TYPE_FROM_COMPANY` | info | `svc/entity-type.service.ts:174` | Entity tax type taken from the company's entity type (…); set a TB tax profile or the estimator entity type to confirm it. |
| `TE_ENTITY_TYPE_MISSING` | warning, throws Error | `svc/entity-type.service.ts:179`, `svc/estimate.service.ts:312`, `engine/bridge.ts:26` | The company has no tax entity type (no TB profile and no estimator setting). Readiness / estimate warning; the entity is left out of the estimate. The bridge throws it as an invariant if called with no type. |
| `TE_ENTITY_TYPE_SETTING_IGNORED` | info | `svc/entity-type.service.ts:161` | The Trial Balance tax profile (…) decides the entity type; the estimator setting (…) is ignored. |
| `TE_ESTIMATES_NOT_REQUIRED` | info | `engine/vouchers.ts:205` | The jurisdiction has no individual quarterly estimate regime or the requirement gate is not met (reason text comes from the state rule); no vouchers are produced. |
| `TE_EXCESS_BUSINESS_LOSS` | warning | `engine/loss-limits.ts:250` | Aggregate business loss … exceeds the §461(l) threshold …; … is disallowed this year and becomes a net operating loss carryforward (not tracked). |
| `TE_FARMER_GROSS_FROM_BOOKS` | info | `svc/estimate.service.ts:573` | Farmer test: gross farming income comes from the books (run-rated to the full year) and other income at its net amount. Enter the gross-income figures on the annual settings to confirm. |
| `TE_FARMER_NO_GROSS_INCOME` | info | `engine/farmer.ts:232` | No gross-income figures were available for the farmer/fisherman test; the regular estimated-tax rules apply. |
| `TE_FARMER_OVERRIDE` | info | `engine/farmer.ts:240` | The … status is set by the entity override (…); the gross-income test was not used. |
| `TE_FARMER_OVERRIDE_CONFLICT` | warning | `svc/estimate.service.ts:567` | One linked entity is marked "not a farmer" while another is a farm (Schedule F or marked "farmer"); the "not a farmer" override was applied to the taxpayer, so the regular installment rules are used. |
| `TE_FARMER_PRIOR_GROSS_FROM_BOOKS` | info | `svc/estimate.service.ts:580` | Farmer test, prior year: gross farming income comes from the books; total gross income is approximated as that farming income plus the prior-year AGI (conservative). Enter the prior-year gross-income figures on the annual settings to confirm. |
| `TE_FARMER_PRIOR_GROSS_MISSING` | info | `svc/estimate.service.ts:582` | Farmer test: no prior-year gross-income figures were entered and the books have no prior-year farming income (or no prior-year AGI is on file), so only the current year was tested. |
| `TE_FARMER_SPOUSE_INCOME_IGNORED` | info | `engine/farmer.ts:218` | The gross-income test on a separate return counts only the filer's gross income; the other person's amounts were ignored. |
| `TE_FARM_INCOME_ASSUMED` | warning | `svc/pl-provider.service.ts:759` | No Trial Balance farm tax codes are assigned, so ALL income accounts are counted as gross farming income for the farmer test. Assign farm codes (or set the farmer override) to confirm. |
| `TE_FARM_INCOME_UNASSIGNED` | warning | `svc/pl-provider.service.ts:768` | … income account(s) have no TB tax code and are left out of gross farming income (farmer test). |
| `TE_FIRM_ADMIN_REQUIRED` | HTTP 403 | `svc/firm-settings.service.ts:36`, `svc/taxpayer-staff.service.ts` | Firm administrator required / Also (D17): Only a firm administrator can change who can see a taxpayer (staff list PUT and staff-candidates; also the firm visibility switch, which rides firm settings) |
| `TE_FIRM_REQUIRED` | HTTP 400 | `svc/firm-scope.service.ts:44`, `svc/firm-scope.service.ts:56` | Select a firm (X-Firm-Id) |
| `TE_GP_CODE_WITHOUT_TREATMENT` | warning | `svc/pl-provider.service.ts:895` | … account(s) carry a TB guaranteed-payment code but no "Guaranteed payment" treatment: the amount is deducted from partnership profit and NOT allocated to any partner, so it is MISSING from every partner's income. Set the Guaranteed payment treatment and pick the partner. |
| `TE_HSA_CAPPED` | warning | `engine/owner-deductions.ts:233` | HSA contribution exceeds the coverage-type limit (only the limit is deducted), or a contribution is recorded but no HDHP coverage type is set (nothing is deducted). |
| `TE_INSTALLMENT_LISTS` | throws Error | `engine/farmer.ts:272` | installments.due_dates (…) and installments.pcts (…) must be non-empty and the same length |
| `TE_INSTALLMENT_POLICY` | throws Error | `engine/vouchers.ts:293`, `engine/vouchers.ts:297`, `engine/vouchers.ts:298` | no due dates / Also: no installment percentages |
| `TE_ITEMIZED_BENEFIT_CAPPED` | warning | `engine/deductions.ts:143` | Itemized deductions reduced by … so their benefit does not exceed … (§68). |
| `TE_LIMITED_ONLY_PARTNERSHIP` | HTTP 422 | `svc/taxpayers.service.ts:381` | Limited partner status applies only to partnerships |
| `TE_LINK_NOT_FOUND` | HTTP 404 | `svc/taxpayers.service.ts:469` | Link not found |
| `TE_LINK_PCT_MISSING` | warning | `engine/income.ts:116` | …: link for person … has no profit % and the entity has several owners; nothing was allocated to it. |
| `TE_LINK_PCT_OVER_100` | HTTP 422 | `svc/taxpayers.service.ts:412` | Profit / loss / capital percentages for the company and year total more than 100%. `details` carries `total` and `field`. |
| `TE_LIVE_UNAVAILABLE` | response field | `svc/estimate-snapshots.service.ts:340` | Fallback `liveUnavailable.code` on a snapshot compare when the live recompute was refused by an AppError without a code (a coded refusal passes its own code through, e.g. TE_SCENARIO_NOT_FOUND). |
| `TE_LOSS_OVERRIDE_APPLIED` | warning | `engine/loss-limits.ts:133` | …: loss limited to … by the basis / at-risk override; … is not deducted this year. |
| `TE_LOSS_OVERRIDE_UNUSED` | info | `engine/loss-limits.ts:121`, `engine/loss-limits.ts:126` | …: an allowed-loss override (…) is set but the share is not a loss; it has no effect. / Also: …: the loss … is within the allowed-loss override …; nothing disallowed. |
| `TE_LOSS_PCT_ALL_ITEMS` | info | `engine/income.ts:218` | …: the entity has a net loss, so every item — including its positive items — is allocated by the loss %, not item by item (MODULE.md step 2). |
| `TE_M1_CODE_ON_PL_ACCOUNT` | warning | `svc/pl-provider.service.ts:902` | P&L accounts carry a Schedule M-1 (book-tax reconciling) code; the BOOK amount is kept as ordinary. Set a character treatment (e.g. Section 1231) or enter the tax amount as an adjustment. |
| `TE_NIIT_MANUAL_OVERRIDE` | warning | `engine/other-taxes.ts:84` | Net investment income tax is overridden to … (engine computed …). |
| `TE_NONREFUNDABLE_CREDIT_CAPPED` | warning | `engine/federal.ts:229` | Nonrefundable credits … exceed the regular tax …; only … is used. |
| `TE_NOT_FIRM_STAFF` | HTTP 403 | `mw/tax-estimator-scope.ts:37` | Firm staff role required |
| `TE_NO_COMPLETE_MONTH` | HTTP 422 | `svc/periods.ts:74` | No complete month in the tax year starting … yet; pass "through" explicitly. |
| `TE_NO_INCOME` | info | `engine/federal.ts:246` | No income was found for the year. |
| `TE_NO_MONTHS_ELAPSED` | warning | `engine/income.ts:203` | …: no closed months; the projection equals the year-to-date books. |
| `TE_NO_PERSONS` | HTTP 422, throws Error | `svc/estimate.service.ts:218`, `engine/context.ts:53`, `engine/federal.ts:166` (+1 more) | The taxpayer has no persons; add the primary person before estimating (HTTP). The engine throws the same code as an invariant if it is ever called with no persons. |
| `TE_NO_PRIOR_YEAR` | HTTP 400 | `svc/tax-parameters.service.ts:370`, `svc/tax-state-rules.service.ts:473` | No earlier tax year to copy from |
| `TE_NO_SHIPPED_VALUE` | HTTP 409 | `svc/tax-parameters.service.ts` (revertOverride), `svc/tax-state-rules.service.ts` (revertOverride) | … has no shipped value for …; removing it would leave the key missing for the year. Edit the value instead. (R6-07: allowed only when the row is the year's / state-year's last row, which restores the fallback) |
| `TE_NO_RECONCILABLE_ACTIVITY` | info | `svc/readiness.service.ts:75` | No bank or credit-card account has activity in the range, so no closed month can be derived. |
| `TE_OFFICER_ONLY_SCORP` | HTTP 422 | `svc/taxpayers.service.ts:384` | Officer applies only to S corporations |
| `TE_OVERRIDE_REASON_REQUIRED` | HTTP 422 | `svc/taxpayers.service.ts:423`, `svc/taxpayers.service.ts:427` | A reason is required to override QBI eligibility / Also: A reason is required for an allowed-loss override |
| `TE_OWNER_ITEM_NO_LINK` | warning | `engine/income.ts:265` | …: person … has owner-level amounts but no link to this entity; they were attached to an empty share. |
| `TE_OWNER_ITEM_UNATTRIBUTED` | warning | `engine/income.ts:130` | …: an owner-level amount has no person and the entity has several owners; it was attributed to the primary person. |
| `TE_OWNER_PERSON_MISSING` | warning | `svc/pl-provider.service.ts:909` | Guaranteed-payment / S corp officer treatments without a person: the amount cannot be attributed to a partner or officer. Pick the person on the treatment. |
| `TE_PACK_AS_OF_REQUIRED` | HTTP 400 | `svc/estimate-documents.service.ts:192` | The tax estimate needs an as-of date (YYYY-MM-DD) |
| `TE_PACK_TAXPAYER_REQUIRED` | HTTP 400 | `routes/reports.routes.ts:1798`, `svc/estimate-documents.service.ts:205` | taxpayer_id must be a UUID / Also: Pick a taxpayer for the Tax Estimate section |
| `TE_PARAM_CHANGED` | HTTP 409 | `svc/tax-parameters.service.ts` (verifyOne), `svc/tax-state-rules.service.ts` (verifyOne), `svc/tax-param-ai-check.service.ts` (applyCheck) | The value of … changed since you read it; review the current value and verify again. (R6-04: the Verify body's `expectedValue` no longer matches the row; `details.currentValue` carries the value now stored. Bulk verify never throws it — changed keys come back in `changed`) |
| `TE_PARAMS_FALLBACK_YEAR` | warning | `svc/estimate.service.ts:223` | No federal parameters exist for …; the … values were used (all provisional). Due dates, the return due date and holidays were rolled forward to …; rates, amounts and the penalty rate table are …'s. |
| `TE_PARAM_INVALID` | HTTP 400, throws Error | `svc/tax-parameters.service.ts:267`, `svc/tax-parameters.service.ts:269`, `svc/tax-parameters.service.ts:271` (+2 more) | HTTP 400 from the parameters admin (override or verify): unknown key, value fails registry validation, a reason under 3 characters, or (QA D6) an installment pair that does not line up — `installments.pcts` / `ccorp.installment_pcts` entries over 1, not totalling 100%, or a different count from `installments.due_dates` / `ccorp.installment_months` (save both with `companion`); also a `companion` that is not the key's partner, or a revert that would orphan a partner with no shipped row. Engine throw: a parameter has the wrong type for how the engine reads it. |
| `TE_PARAM_MISSING` | throws Error | `engine/parameters.ts:48` | The engine read a registry key that is not in the resolved parameter set (a year with an incomplete parameter set). Plain Error, surfaces as 500 INTERNAL_ERROR. |
| `TE_PARAM_UNVERIFIED` | warning | `engine/parameters.ts:162` | Tax parameter '…' is … (not CPA-verified); the estimate uses its current value …. |
| `TE_PASSIVE_ALLOWANCE_PHASED_OUT` | info | `engine/loss-limits.ts:166` | §469(i) rental allowance reduced from … to … because MAGI … exceeds ……. |
| `TE_PASSIVE_LOSS_SUSPENDED` | warning | `engine/loss-limits.ts:201` | Passive losses of … exceed passive income ……; … is suspended (carried forward, not tracked). |
| `TE_PASSIVE_MFS_NO_ALLOWANCE` | warning | `engine/loss-limits.ts:152` | Married filing separately and not living apart all year: no §469(i) rental loss allowance (§469(i)(5)(B)). |
| `TE_PAYMENTS_AFTER_AS_OF` | info | `svc/estimate.service.ts` (withPaymentsAsOf) | … payment(s) dated after … are not counted as paid yet. (QA D13: the live client-portal estimate is computed as of today; staff estimates still project every known payment.) |
| `TE_PAYMENTS_EXCESS` | info | `engine/payments.ts:205` | …: payments exceed the required installments by …; the excess is an overpayment. |
| `TE_PAYMENTS_SHAPE` | throws Error | `engine/payments.ts:138` | withholdingShares must match installments |
| `TE_PAYMENT_ACCOUNT_UNASSIGNED` | info | `svc/pl-provider.service.ts:730` | Some estimated-tax payment accounts are not tied to a taxpayer; their payments are listed but cannot be credited automatically. |
| `TE_PAYMENT_AFTER_RETURN_DUE` | info | `engine/payments.ts:148` | Payment … is dated …, after the return due date …; it reduces the unpaid balance shown on the voucher but the underpayment penalty still accrued to …. |
| `TE_PAYMENT_DATE_REQUIRED` | HTTP 422 | `svc/payments.service.ts:311` | A payment needs a date |
| `TE_PAYMENT_DUPLICATE` | HTTP 409 | `svc/payments.service.ts:339` | This transaction is already recorded for the taxpayer and year |
| `TE_PAYMENT_GL_REF_REQUIRED` | HTTP 422 | `svc/payments.service.ts:312`, `svc/payments.service.ts:313` | A GL payment needs tenantId and transactionId / Also: transactionId needs tenantId |
| `TE_PAYMENT_JURISDICTION_CHANGED` | info | `svc/payments.service.ts:279` | A payment booked to a … payment account on … is recorded as …; the recorded jurisdiction is used. |
| `TE_PAYMENT_JURISDICTION_MISSING` | warning | `svc/payments.service.ts:166` | Payment account … has no jurisdiction; its payments are not credited. Set federal or a state on the treatment. |
| `TE_PAYMENT_NOT_FOUND` | HTTP 404 | `svc/payments.service.ts:63` | Payment not found (D17: also for the id of a taxpayer the caller may not see) |
| `TE_PAYMENT_NOT_POSITIVE` | info, warning | `svc/payments.service.ts:187`, `engine/payments.ts:147` | A payment-account entry nets to zero or negative (refund / reversal) and is not credited (info from the ledger); the engine also ignores a non-positive payment passed to it (warning). |
| `TE_PAYMENT_OTHER_YEAR` | HTTP 409 | `svc/payments.service.ts:330` | This transaction is already recorded for tax year … |
| `TE_PAYMENT_PINNED_OTHER_YEAR` | info | `svc/payments.service.ts:259` | A … payment of … on … is recorded for tax year …; it is not credited to …. |
| `TE_PAYMENT_STATE_NOT_IN_SCENARIO` | warning | `svc/estimate.service.ts:645` | Payments to … are on file but the scenario has no state row for them; they are not applied. |
| `TE_PAYMENT_WINDOW_DEFAULTED` | warning | `svc/payments.service.ts:127` | No usable Q4 installment date for …; January 31 was used as the Q4 cutoff. GL payments are credited to … from … through …. |
| `TE_PAYMENT_YEAR_ASSUMED` | info | `svc/payments.service.ts:268` | A … payment of … on … falls after the … Q4 cutoff and before the first … installment; it is credited to …. If it was a late … payment, record it under …. |
| `TE_PENALTY_METHOD_NOT_COMPUTED` | warning | `engine/penalty.ts:190` | …: penalty method '…' cannot be computed from a rate; no penalty estimate. |
| `TE_PENALTY_RATE_UNCOVERED` | warning | `engine/penalty.ts:220` | …: no published underpayment rate covers part of the accrual period for installment …; the latest published rate was used. Verify. |
| `TE_PENALTY_WAIVED` | info | `engine/penalty.ts:230` | …: the underpayment penalty (… before relief) does not apply — … |
| `TE_PERSON_LIMIT` | HTTP 422 | `svc/taxpayers.service.ts:232` | A taxpayer has at most two persons |
| `TE_PERSON_NOT_FOUND` | HTTP 404 | `svc/taxpayers.service.ts:258`, `svc/taxpayers.service.ts:396`, `svc/treatments.service.ts:143` | Person not found |
| `TE_PERSON_REQUIRED` | HTTP 422 | `svc/treatments.service.ts:178` | A guaranteed payment needs the partner it is paid to (partnership); an S corp owner SEHI / retirement treatment needs the officer (person) it belongs to. `details` carries `accountId` and `treatment`. |
| `TE_PERSON_TAXPAYER_MISMATCH` | HTTP 400 | `svc/treatments.service.ts:145` | The person does not belong to the payment taxpayer |
| `TE_PORTAL_FORBIDDEN` | HTTP 404 | `routes/portal-tax-estimates-public.routes.ts:57`, `svc/portal-estimates.service.ts:56` | Uniform portal miss: unknown taxpayer, not mapped to this contact, no tax_estimates_access, flag off, no annual settings, or a PDF with no estimate. Never says why. |
| `TE_PRIMARY_REQUIRED` | HTTP 422 | `svc/taxpayers.service.ts:235`, `svc/taxpayers.service.ts:260` | Add the primary person before the spouse / Also: Remove the spouse before the primary person |
| `TE_QBI_DEDUCTION_UNALLOCATED` | info | `engine/qbi.ts:132`, `engine/qbi.ts:133` | …: ½ SE tax / retirement deductions … could not be attributed to a business (no SE income); QBI is not reduced by them. / Also: …: the SEHI deduction … could not be attributed to a business; QBI is not reduced by it. |
| `TE_QBI_LINK_EXCLUDED` | info | `engine/qbi.ts:224` | …: not included in QBI — …. |
| `TE_QBI_MANUAL_OVERRIDE` | warning | `engine/qbi.ts:257` | The §199A deduction is overridden to … (engine computed …). |
| `TE_QBI_MINIMUM_APPLIED` | info | `engine/qbi.ts:245` | §199A(i) minimum deduction … applies (active QBI … ≥ …). |
| `TE_QBI_NET_LOSS_CARRYFORWARD` | warning | `engine/qbi.ts:189` | Net qualified business loss … carries forward to next year's QBI (not tracked); no §199A deduction from the businesses this year. |
| `TE_QBI_PRE_68_BASIS` | info | `engine/federal.ts:211` | The §199A overall limit used taxable income on the itemized deduction before the §68 reduction (…); the actual taxable income is higher by that amount (Q32). |
| `TE_QBI_PTP_LOSS_CARRYFORWARD` | info | `engine/qbi.ts:231` | Net REIT / PTP loss … carries forward (not tracked); no REIT / PTP component this year. |
| `TE_QBI_SSTB_PHASED` | info | `engine/qbi.ts:164` | …: specified service business — QBI, W-2 wages and UBIA reduced to … of their amounts (taxable income in the phase-in range). |
| `TE_QBI_UBIA_MISSING` | warning | `engine/qbi.ts:202` | …: UBIA of qualified property is blank; the 25% W-2 + 2.5% UBIA limb was not computed (D8). Enter UBIA on the entity's tax year if the business holds depreciable property. |
| `TE_QBI_W2_WAGES_MISSING` | warning | `engine/qbi.ts:201` | …: W-2 wages for the §199A limit are unknown (no w2_wages accounts and no override); treated as 0. |
| `TE_RANGE_INCLUDES_OPEN_MONTH` | warning | `svc/readiness.service.ts:88` | The estimate range runs through a month after the last closed month (or no month is closed yet). Readiness only; never blocks. |
| `TE_RANGE_PARTIAL_MONTH` | warning | `svc/pl-provider.service.ts:463` | The range runs through …, which is not over yet; it is counted as a whole month in the run-rate. |
| `TE_READINESS_FAILED` | warning | `svc/estimate.service.ts:822` | Fallback code when a company's readiness cannot be computed (an AppError without a code); message `<company>: <error>`. |
| `TE_RETIREMENT_CAPPED` | warning | `engine/owner-deductions.ts:146` | …: … contribution … exceeds the deductible limit …; only … is deducted. |
| `TE_RETIREMENT_PLAN_ASSUMED` | warning | `engine/owner-deductions.ts:68` | …: no retirement plan type is recorded; the contribution limit was figured as a SEP. |
| `TE_SAFE_HARBOR_PRIOR_AGI_MISSING` | warning | `engine/safe-harbor.ts:181` | …: prior-year AGI is missing; the high-AGI safe-harbor percentage could not be tested. |
| `TE_SAFE_HARBOR_RULE_INVALID` | throws Error | `engine/safe-harbor.ts:215` | … |
| `TE_SALT_PHASED_DOWN` | warning | `engine/deductions.ts:118` | SALT cap reduced from … to … because MAGI exceeds …. |
| `TE_SCENARIO_CAP` | HTTP 422 | `svc/scenarios.service.ts:52` | At most … scenarios per tax year |
| `TE_SCENARIO_NAME_TAKEN` | HTTP 409 | `svc/scenarios.service.ts:41` | A scenario with that name already exists |
| `TE_SCENARIO_NOT_FOUND` | HTTP 404 | `svc/estimate-documents.service.ts:222`, `svc/year-access.ts:26` | No … scenario exists for this taxpayer / Also: Scenario not found (D17: also for a scenario of a taxpayer the caller may not see) |
| `TE_SCH1A_MFS_NOT_ALLOWED` | info | `engine/deductions.ts:196` | Married filing separately: no Schedule 1-A deduction (senior, tips, overtime, car-loan interest) — each requires a joint return for a married taxpayer (§151(d)(5)(C)(v), §224(f), §225(e), §163(h)(4)(F)). |
| `TE_SCH1A_NOT_IN_EFFECT` | info | `engine/deductions.ts:192` | Schedule 1-A deductions do not apply to tax year …. |
| `TE_SCH_AI_ASSUMPTION` | info | `engine/sch-ai.ts:396` | One info line per Schedule AI assumption the engine made (its text is the assumption itself), shown on the assumptions page. |
| `TE_SCH_AI_ENTITY_SKIPPED` | info | `svc/sch-ai-snapshots.service.ts:153`, `svc/sch-ai-snapshots.service.ts:157`, `svc/sch-ai-snapshots.service.ts:180` | A linked company was not captured into a Schedule AI snapshot (C corporation, no tax entity type, or the provider refused it); returned in the capture response, not thrown. |
| `TE_SCH_AI_INPUTS_PRORATED` | info | `svc/estimate.service.ts:552` | Schedule AI: full-year person inputs (outside W-2 wages, Schedule 1-A amounts, itemized deductions) were prorated by months to each period end. |
| `TE_SCH_AI_PERIOD_MISSING` | warning | `engine/sch-ai.ts:338` | Schedule AI period … (through …) has no actual figures; the regular installment … was used for that column. |
| `TE_SCH_AI_PERIOD_OPEN` | HTTP 422, info | `svc/sch-ai-snapshots.service.ts:130`, `svc/sch-ai-snapshots.service.ts:164` | That Schedule AI period has not ended yet / Also: The … period has not ended; nothing captured. |
| `TE_SCH_AI_SE_PART2_DIFFERS` | info | `engine/sch-ai.ts:362` | Schedule AI period …: Part II SE tax … differs from the engine's SE tax on the annualized inputs …; Part II is used for line 15. |
| `TE_SCH_AI_SHAPE` | throws Error | `engine/sch-ai.ts:316` | … period parameters and installment percentages must have the same length |
| `TE_SCOPE_MISSING` | HTTP 403 | `mw/tax-estimator-scope.ts:43` | Scope not resolved |
| `TE_SEHI_CAPPED` | warning | `engine/owner-deductions.ts:190` | …: self-employed health insurance … exceeds earned income from the business …; only … is deducted. |
| `TE_SEHI_MONTHS_EXCLUDED` | warning | `engine/owner-deductions.ts:184` | …: self-employed health insurance is deductible for … of … months (an employer-subsidized plan was available in the others); … excluded. |
| `TE_SEHI_MONTHS_INVALID` | HTTP 422, warning | `svc/taxpayers.service.ts:225`, `engine/owner-deductions.ts:178` | SEHI months must be 12 booleans / Also: …: SEHI eligibility has … months instead of …; all months were treated as deductible. |
| `TE_SEHI_W2_S_CORP_ONLY` | HTTP 422 | `svc/entity-settings.service.ts` (upsertYearInputs) | Including >2% shareholder health insurance in W-2 wages applies to S corporations only (QA2-03) |
| `TE_SE_BELOW_MINIMUM` | info | `engine/se-tax.ts:48` | …: net earnings from self-employment … are below …; no SE tax. |
| `TE_SNAPSHOT_IMMUTABLE` | HTTP 409 | `svc/estimate-snapshots.service.ts:47` | PUT / PATCH / DELETE on /snapshots/:id is refused; the DB trigger tax_est_snapshots_immutable raises the same text (restrict_violation) for any UPDATE except re-encryption of the two ciphertext columns. |
| `TE_SNAPSHOT_INTEGRITY` | HTTP 500 | `svc/estimate-snapshots.service.ts:182` | Snapshot integrity check failed |
| `TE_SNAPSHOT_NOT_FOUND` | HTTP 404 | `svc/estimate-snapshots.service.ts:46` | Snapshot not found (D17: also for the id of a taxpayer the caller may not see) |
| `TE_SNAPSHOT_SAVE_FAILED` | HTTP 500 | `svc/estimate-snapshots.service.ts:165` | Snapshot insert failed |
| `TE_SNAPSHOT_TOO_LARGE` | HTTP 422 | `svc/estimate-snapshots.service.ts:153` | The estimate is too large to snapshot (… bytes) |
| `TE_SNAPSHOT_UNREADABLE` | HTTP 500 | `svc/estimate-snapshots.service.ts:180` | Snapshot could not be decrypted with this server's key |
| `TE_SS_WAGES_DEFAULTED` | warning, info | `engine/federal.ts:125`, `engine/federal.ts:127` | A person has no Social Security wages (W-2 box 3) entered, so box 1 wages were used for the SE wage-base offset. Warning (with the maximum SE-tax overstatement as `details.maxOverstatement`) when the SE Social Security part is positive; info when box 1 already uses the whole wage base. This is the largest single SE-tax error in the engine for wage earners until the year-inputs screen exists (R7-01). |
| `TE_STAFF_NOT_ELIGIBLE` | HTTP 422 | `svc/taxpayer-staff.service.ts` | Only active firm staff with Tax Estimator access can be added (D17 staff list: an added user is not an active `firm_staff` / `firm_readonly` member holding `tax_estimator` in the admin's active tenant; `details.userIds` lists them) |
| `TE_STATE_BASE_INVALID` | throws Error | `engine/state.ts:109` | … |
| `TE_STATE_CREDIT_ASSUMED` | warning | `engine/state.ts:183` | …: no verified rule on the credit for other-state taxes; the credit was assumed allowed. Verify. |
| `TE_STATE_CREDIT_CAPPED` | warning | `engine/state.ts:203` | …: credit for other-state taxes … exceeds the resident tax …; only … is used. |
| `TE_STATE_CREDIT_OVERRIDE` | info | `engine/state.ts:198` | …: the computed credit … was replaced by the entered …. |
| `TE_STATE_CREDIT_RESIDENT_SIDE` | info | `engine/state.ts:208` | …: the credit for taxes paid to other states is taken on the resident return. Reverse-credit pairs (AZ, CA, OR, VA, IN and DC with each other) grant it on the NONRESIDENT return instead — not modelled; the estimate may differ. |
| `TE_STATE_CUSTOM_BASE_MISSING` | warning | `engine/state.ts:102` | …: base is 'custom' but no custom base amount was entered; federal AGI was used. |
| `TE_STATE_DUPLICATE` | HTTP 422 | `svc/state-rows.service.ts:82` | State … appears more than once |
| `TE_STATE_DUPLICATE_ROW` | throws Error | `engine/state.ts:224` | … appears more than once |
| `TE_STATE_GATE_INPUT_MISSING` | warning | `engine/state-gates.ts:211` | … estimate-requirement gate (…) needs …; the plain threshold test was shown instead. Verify. |
| `TE_STATE_GATE_NOT_EVALUATED` | warning | `engine/vouchers.ts:500` | …: no estimate-requirement gate was supplied; vouchers are shown. Verify. |
| `TE_STATE_GATE_UNDETERMINED` | warning | `engine/vouchers.ts:497` | …: the estimate-requirement gate could not be decided; vouchers are shown. Verify. |
| `TE_STATE_INVALID` | HTTP 400 | `svc/tax-state-rules.service.ts:86` | Unknown state '…' |
| `TE_STATE_MULTIPLE_RESIDENT` | throws Error | `engine/state.ts:228` | a scenario has at most one resident state |
| `TE_STATE_NONRESIDENT_EQUALS_RESIDENT` | HTTP 422 | `svc/state-rows.service.ts:80` | A nonresident state cannot be the resident state |
| `TE_STATE_NONRESIDENT_FLAT_RATE` | info | `engine/state.ts:149` | Nonresident tax is an effective-rate estimate; most states compute nonresident tax by ratio of the full return. |
| `TE_STATE_NO_ANNUALIZATION` | info | `engine/vouchers.ts:441` | State installments use the regular method only; the state equivalent of Schedule AI is not computed, so a federal Schedule AI reduction does not carry to state vouchers. |
| `TE_STATE_NO_INCOME_TAX` | info | `engine/state.ts:144`, `engine/state.ts:167` | … has no broad-based personal income tax; the row computes 0. |
| `TE_STATE_NO_OTHER_STATE_CREDIT` | info | `engine/state.ts:181` | … allows no credit for taxes paid to other states. |
| `TE_STATE_NO_PRIOR_YEAR_HARBOR` | info | `engine/vouchers.ts:427` | … has no prior-year safe harbor; only the current-year rule applies. |
| `TE_STATE_ONE_RESIDENT` | HTTP 422 | `svc/state-rows.service.ts:74` | Exactly one resident state row is required |
| `TE_STATE_PENALTY_ADDONS_NOT_MODELLED` | info | `engine/state-gates.ts:244` | State underpayment-penalty add-ons and caps (where the state has them) are not modelled; the penalty estimate may differ. |
| `TE_STATE_PRIOR_AGI_FEDERAL_PROXY` | info | `svc/estimate.service.ts:632` | …: no prior-year state AGI on file; the prior-year federal AGI was used for the state's high-AGI test. |
| `TE_STATE_RULES_FALLBACK_YEAR` | warning | `svc/estimate.service.ts` (gather) | No … rules exist for …; the … … rules were used (all provisional). Due dates, the return due date, the farmer dates and holidays were derived for …; thresholds, percentages and penalty rates are …'s. (R6-03: the state mirror of `TE_PARAMS_FALLBACK_YEAR`, one per state; the admin States screen shows the same state as status `fallback`) |
| `TE_STATE_RULES_FALLBACK` | warning | `engine/state-gates.ts:173`, `engine/vouchers.ts:526` | … has no verified estimated-tax rule set; the federal pattern (estimates required at … after withholding and credits) was applied. Verify. / Also: … has no verified estimated-tax rule set; the federal pattern (percentages, due dates, penalty rate) was applied. Verify. |
| `TE_STATE_RULES_MISSING` | warning | `engine/state.ts:86` | No rule set was supplied for …; the federal pattern applies and the state is flagged "verify". |
| `TE_STATE_RULE_INVALID` | HTTP 400, throws Error | `svc/tax-state-rules.service.ts:343`, `svc/tax-state-rules.service.ts:345`, `svc/tax-state-rules.service.ts:347` (+13 more) | HTTP 400 from the state-rules admin: unknown rule key, value fails its registry validation, a reason under 3 characters, or (QA D6) `installments.pcts` that does not total 100%, has an entry over 1, or does not have one entry per `installments.due_dates` date (save both with `companion`; a revert that would orphan a partner with no shipped row is refused). Engine throw: a rule value has the wrong shape (not a date list, number, etc.) or a required rule is absent; a seed or override defect. |
| `TE_STATE_RULE_UNVERIFIED` | warning | `engine/state-types.ts:268` | … rule '…' is … (not CPA-verified); the estimate uses its current value …. |
| `TE_STATE_SOURCED_MISSING` | warning | `engine/state.ts:124` | …: sourced income is manual but blank; 0 was used. |
| `TE_STATE_SOURCED_NONE` | warning | `engine/state.ts:133` | …: no linked entity is sourced to the state, so derived sourced income is 0. Enter it manually or set the entity's state sourcing. |
| `TE_STATE_THRESHOLD_MISSING` | warning | `engine/state-gates.ts:193` | … has no required_threshold; the estimate requirement could not be tested. |
| `TE_SUSPENSE_BALANCE` | warning | `svc/readiness.service.ts:116` | Suspense / uncategorized / ask-my-accountant accounts carry a balance; those amounts are not classified for tax. |
| `TE_TAXPAYER_NOT_FOUND` | HTTP 404 | `svc/taxpayers.service.ts:76`, `svc/treatments.service.ts:132`, `svc/year-access.ts:25` | Taxpayer not found. D17: also the answer for a taxpayer of the caller's own firm that the caller may not see (linked-tenant rule, unlinked-creator rule, staff list) — deliberately identical to another firm's id |
| `TE_TAXPAYER_NOT_LINKED` | HTTP 404 | `svc/estimate-documents.service.ts:217` | The taxpayer is not linked to this company for … (D17: also when the requester may not see the taxpayer — Report Pack request and worker) |
| `TE_TAX_DEPRECIATION_ADJUSTMENT` | info | `svc/pl-provider.service.ts:930` | Book depreciation is used for accounts marked "tax depreciation differs"; enter the tax amount as an adjustment. |
| `TE_TAX_METHOD_MISSING` | warning | `svc/entity-type.service.ts:184` | The company has no accounting method; accrual is assumed. Set the tax method. |
| `TE_TB_CODE_IMPLIES_TREATMENT` | info | `svc/pl-provider.service.ts:923` | The TB tax code implies a different treatment than the estimator treatment; the estimator treatment is applied. |
| `TE_TB_IDENTITY_MISMATCH` | warning | `svc/pl-provider.service.ts:679` | The Trial Balance workpaper and the P&L disagree for this range; review the books before relying on the estimate. |
| `TE_TB_RJE_NOT_APPLIED` | info | `svc/pl-provider.service.ts:689` | Trial Balance tax adjustments (RJEs) exist for this year. They are shown per account but not applied; enter them as estimator adjustments if they should change the estimate. |
| `TE_TENANT_NOT_MANAGED` | HTTP 404, warning | `svc/entity-type.service.ts:29`, `svc/estimate-snapshots.service.ts:222`, `svc/taxpayers.service.ts:73` (+4 more) | The company / tenant is not in the caller's server-resolved scope (firm-managed tenants intersected with the caller's own access); hides whether it exists. As a warning: a linked company, payment or adjustment account in a tenant the firm no longer manages (or the caller can no longer reach) is left out or read for its manual amount only; on a snapshot the figures are hidden. D18: a user on the taxpayer's staff list reads that taxpayer's linked tenants (no warning), but still gets this 404 when adding / changing / removing a link into, or editing the entity setup / treatments / GL references of, a client outside their own access (firm admins may remove links). |
| `TE_THROUGH_OUT_OF_RANGE` | HTTP 400 | `svc/periods.ts:67` | through must be between … and … |
| `TE_TRANSACTION_NOT_FOUND` | HTTP 404 | `svc/payments.service.ts:320`, `svc/treatments.service.ts:288`, `svc/register-flags.service.ts:31` | Transaction not found |
| `TE_TREATMENT_ACCOUNT_TYPE` | HTTP 422 | `svc/treatments.service.ts:163` | The treatment does not apply to this account type (see TREATMENT_ACCOUNT_TYPES). `details`: accountId, treatment, accountType. |
| `TE_TREATMENT_NOT_FOR_ENTITY` | HTTP 422, warning | `svc/treatments.service.ts:170`, `svc/pl-provider.service.ts:916` | The … treatment applies to … entities only (this entity: …) / Also: Treatments that do not apply to this entity type (…) are ignored; the amounts stay in entity profit. |
| `TE_TREATMENT_OTHER_FIRM` | HTTP 409 | `svc/treatments.service.ts:207` | This account's treatment belongs to another firm that also manages these books; it cannot be changed here |
| `TE_UBIA_MISSING` | info | `svc/pl-provider.service.ts:960` | No UBIA entered for …; the QBI UBIA limb is not computed. |
| `TE_UNKNOWN_PERSON` | warning | `engine/context.ts:54` | Person '…' is not on this taxpayer; the amount was attributed to the primary person. |
| `TE_UNMAPPED_ACCOUNTS` | warning | `svc/pl-provider.service.ts:888` | … account(s) with activity have no TB tax-code assignment or estimator treatment; they are treated as ordinary income/expense. |
| `TE_UNPOSTED_BANK_FEED` | warning | `svc/readiness.service.ts:123` | … bank-feed transaction(s) are not posted yet. |
| `TE_UNRECONCILED_ACCOUNTS` | warning | `svc/readiness.service.ts:81` | … bank/credit-card account(s) are not reconciled through …. |
| `TE_W2_OVERRIDE_REASON` | HTTP 400 | `svc/entity-settings.service.ts:125` | A reason is required when overriding W-2 wages |
| `TE_YEAR_EXISTS` | HTTP 409 | `svc/tax-parameters.service.ts`, `svc/tax-state-rules.service.ts` | Tax year … already has parameters / Also: State rules for … already exist for every jurisdiction that has … rules (R6-02: state create is per jurisdiction; `details.skipped` lists them) |
| `TE_YEAR_NOT_CREATED` | HTTP 409 | `svc/tax-parameters.service.ts` (assertYearEditable), `svc/tax-state-rules.service.ts` (assertStateEditable) | Tax year … has no parameters of its own (it is served from an earlier year); create … from the prior year first / Also: … has no … rules of its own …. (R6-02: override and verify on a year or state-year served through the fallback) |
| `TE_YEAR_NOT_SAVED` | warning | `svc/estimate.service.ts:220` | No annual settings are saved for …; defaults were used (no prior-year tax, no withholding, no credits). |
| `TE_YEAR_NOT_SET_UP` | HTTP 422 | `svc/scenarios.service.ts:48` | Save the annual settings for this year first |
| `TE_YEAR_SAVE_FAILED` | HTTP 500 | `svc/years.service.ts:154` | Year upsert failed |

## Documented but never emitted

| Code | Where it is mentioned | Status |
|---|---|---|
| `TE_GP_PERSON_MISSING` | comment on `GuaranteedPaymentTreatment.personId` in `shared/src/tax-estimator/entities-api.ts` ("null only when the person target was deleted ... warning TE_GP_PERSON_MISSING") | No code path emits it. The nearest live signal is `TE_OWNER_PERSON_MISSING` (provider warning for a guaranteed-payment or S corp officer treatment with no person). Either emit it or correct the comment. |

## Strings that look like codes but are not

`TE_PORTAL_RATE_LIMIT_TEST` (env var that re-enables the portal limiter in tests), `TE_COLLAPSED_STORAGE_KEY` and `TE_FLAG` (web constants), `TE_SEP_CAPPED` (a test fixture string with no emitter), the `/FALLBACK|PRIOR_YEAR|TE_ENTITY|...|PCT/` regex in `ReadinessBanner.tsx` (prefix match used to choose which warnings the banner shows).

## Where the web client keys off a code

`TE_FIRM_REQUIRED` (TaxpayerListPage shows the firm chooser), `TE_PARAMS_FALLBACK_YEAR` and any warning code matching the readiness-banner regex (ReadinessBanner; `TE_STATE_RULES_FALLBACK_YEAR` matches it), `TE_SNAPSHOT_IMMUTABLE` (documented in the snapshots hook; no UI path triggers it). The Verify dialogs show a `TE_PARAM_CHANGED` 409 inline and refetch the row.

## Support playbook for the common 4xx

| You see | Usually means | Do |
|---|---|---|
| `TE_FIRM_REQUIRED` 400 | The user belongs to several firms, or a super admin did not choose one. | Send the `X-Firm-Id` header (the UI shows a firm chooser). |
| `TE_TENANT_NOT_MANAGED` 404 | The company's tenant is not (or no longer) actively assigned to the firm, or the caller has no `user_tenant_access` to it. | Fix the firm assignment or the user's client access; it is deliberately indistinguishable from "does not exist". |
| `TE_NOT_FIRM_STAFF` 403 | `firm_readonly` tried a mutation. | Raise the firm role; read-only users may still compute and print. |
| `TE_FIRM_ADMIN_REQUIRED` 403 | A `firm_staff` user edited firm settings (safe-harbor default, disclaimer, `portal_shows`). | Needs `firm_admin`. |
| `TE_TREATMENT_NOT_FOR_ENTITY` / `TE_TREATMENT_ACCOUNT_TYPE` / `TE_PERSON_REQUIRED` 422 | Treatment saved on the wrong entity type or account type, or a guaranteed payment / S corp owner item with no person. | See "Treatment map operator guide" in MODULE.md. |
| `TE_NO_COMPLETE_MONTH` 422 / `TE_THROUGH_OUT_OF_RANGE` 400 | No fully reconciled month yet in the tax year, or `through` is outside the year's window. | Pass `through` explicitly (partial month warns `TE_RANGE_PARTIAL_MONTH`), or reconcile. |
| `TE_YEAR_NOT_SET_UP` 422 | A scenario was created before the annual settings were saved. | Save Annual settings for the year first. |
| `TE_PAYMENT_OTHER_YEAR` / `TE_PAYMENT_DUPLICATE` 409 | The GL transaction is already recorded for another year / this year. | One transaction is credited to one tax year; edit or delete the existing payment row. |
| `TE_SNAPSHOT_UNREADABLE` / `TE_SNAPSHOT_INTEGRITY` 500 | The snapshot ciphertext cannot be decrypted with this server's key, or its plaintext sha256 no longer matches. | Check key rotation / cross-host restore (`*_encrypted` re-encryption sweep); do not edit the row (the trigger forbids it). |
| `TE_PORTAL_FORBIDDEN` 404 | Any portal refusal; it never says why. | Check the portal visibility conditions in MODULE.md "Client portal". |
| `TE_ACCESS_GRANT_FORBIDDEN` 403 | A caller outside the Tax Estimator gates tried to grant `tax_estimates_access`. | A firm user with the `tax_estimator` resource must grant it; revoking is always allowed. |

## Regenerating

The catalogue is generated, not curated. To check for drift (any `diff` output means a code was added, removed or renamed since this page was written):

```bash
cd packages
grep -rhoP "(?<![A-Za-z0-9_])TE_[A-Z][A-Z0-9_]*" --include=*.ts --include=*.tsx \
  --exclude=*.test.ts --exclude=*.test.tsx --exclude-dir=node_modules --exclude-dir=dist . \
  | sort -u | grep -vxE "TE_PORTAL_RATE_LIMIT_TEST|TE_COLLAPSED_STORAGE_KEY|TE_FLAG|TE_SEP_CAPPED|TE_ENTITY" > /tmp/te-src.txt
grep -oP '^\| `\KTE_[A-Z0-9_]+' ../docs/tax-estimator/ERROR-CODES.md | sort -u > /tmp/te-doc.txt
diff /tmp/te-doc.txt /tmp/te-src.txt   # expect no output (TE_GP_PERSON_MISSING is listed in the appendix table, so it matches)
```

R7-02 recommends turning this into a test (every code in source appears in this file); that needs a code change and is not part of this docs-only pass.
