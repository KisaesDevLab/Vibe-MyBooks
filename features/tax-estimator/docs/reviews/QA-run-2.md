# Tax Estimator — QA run 2 (retest of QA run 1 fixes, headless browser)

- Date: 2026-10-12
- Code under test: `main` at `cea174bd` (read-only working tree; nothing edited, staged or committed)
- Tester: QA agent (Playwright / Chromium headless, desktop 1366×900 and phone 375×812)
- Scope: (A) retest D1–D31, (B) new behaviours since run 1, (C) items run 1 could not test, (D) oracle cross-check, (E) console / network / overflow / a11y

## Environment (throwaway, torn down at the end)

| Item | Value |
|---|---|
| API | `tsx src/bootstrap.ts` on port 3111, fresh random JWT / encryption / Plaid keys in the process env only |
| Web | `vite --host 127.0.0.1 --port 5183 --strictPort`, proxied to 3111 via `VITE_API_URL` (no config edits) |
| Worker | not started (packs fall back to inline generation, see Environment notes) |
| DB | scratch `kisbooks_qa2` on the db container (5434), created with `docker exec vibe-mybooks-db-1 psql -U kisbooks -d postgres`; all 202 migrations applied with `src/migrate.ts`; **dropped at the end** |
| Redis | test Redis `redis://127.0.0.1:6390/7` (empty at start; only db 7 flushed at the end) |
| Files | `DATA_DIR`/`CONFIG_DIR`/`UPLOAD_DIR`/`BACKUP_DIR` in the session scratchpad; `PUPPETEER_EXECUTABLE_PATH` = Playwright Chromium |
| Seed | Run-1 seed adapted: `createAdminUser` (super admin + practice tenant), firm admin, firm staff, tenant-`readonly` + `firm_readonly` user, `firm_readonly` + accountant user (ro2), **bookkeeper with a permission row granting no `tax_estimator`** (new, for the "no permission" case), client user on Maria Designs, second firm (practice tenant + staff), portal contact on Maria Designs, Rivera fixture via `seedRivera()` (`rivera.test-fixtures.ts`) |
| Flags | `TAX_ESTIMATOR_V1` ON for the practice tenant and firm B's practice tenant from the start; the client tenants stayed OFF until the D9 test was done, then ON for Rivera Plumbing / Maria Designs / Oak Street. `CLIENT_PORTAL_V1` ON for every client tenant. Scratch DB only. |
| Not touched | ports 3001/5173/3121, Redis 6379, database `kisbooks`, docker compose, `~/vibe-mybooks` (DB password read only) |

Artifacts (session scratchpad `.../scratchpad/qa2/`): `shots/` (screenshots named below), `pdf/` (estimate, compare, pack, voucher PDFs and their `pdftotext` output), `logs/notes.log` (run log incl. console errors and 4xx/5xx), `portal-responses.json`, `portal-live.json`, `portal-snap.json`.

## Headline results

- **Oracle cross-check (D): PASS on screen, API and PDF.** Rivera base: federal **35,829**, MO **7,590**, AR **312**, state 7,902, total **43,732** (API `summary`, estimate page key figures + calculation table at the start and again at the end of the run, base PDF `tax-estimate-2026-Carlos-Maria-Rivera.pdf`). Bonus: the truck scenario built through the UI gives **24,199** (oracle `truck.total`), delta −19,533 (oracle `truck_delta`), on screen, API, compare page and the report-pack PDF.
- **D1–D31: 24 fixed, 5 partially fixed (D5, D13, D18, D19, D31), 1 not fixed (D22), 0 regressed.** D3 fixed with a small type-ahead caveat (QA2-08).
- **New defects: 9** (0 High, 2 Medium, 7 Low), plus 3 environment observations, one of which (portal cold deep link freezes the tab) should be checked on a production build before it is dismissed.
- No page errors and no React warnings this run. The only console errors are a transient `[CompanyProvider] /company/list failed: Failed to fetch` during a tenant switch (5×).

## (A) Retest of QA-run-1 defects

| ID | Sev (run 1) | Result | Evidence / notes |
|---|---|---|---|
| D1 | High | **Fixed** | Adjustment editor has an **Entity** field. "Vehicle purchase (§179)" and "Depreciation (tax vs book)" show "Entity (required)"; Save stays disabled with "Choose the business this deduction belongs to…" (`aria-invalid`, `aria-describedby`). Picking "Carlos · Rivera Plumbing LLC (1040)" fills and locks Person = Carlos. Owner health insurance / SEP / HSA / catch-up show no entity field. API: §179 without `linkId` → 422 `TE_ADJUSTMENT_LINK_REQUIRED`; SEP with `linkId` → 422 `TE_ADJUSTMENT_LINK_NOT_ALLOWED`. Truck scenario total **24,199** = oracle, SEP chip "Capped at limit". `R4b-179-no-entity.png`, `R4b-179-linked.png`, `R5-truck-p0.png` |
| D2 | Medium | **Fixed** | Tenant-`readonly` + `firm_readonly`: sidebar group shown, list/detail/annual/estimate open, no New taxpayer / Save / Add adjustment / Finalize / Add payment / Link / Archive; "View Schedule 1-A" only; 37/38 detail inputs disabled (the enabled one is the entity-links Tax year filter). `scope.canWrite=false`; PATCH/POST → 403. `R1-readonly-estimate.png`, `R1-readonly-annual.png` |
| D3 | Medium | **Fixed** (see QA2-08) | Resident state is a `<select>` of the 51 jurisdictions ("MO · Missouri"); no free text, so nothing is silently truncated. `R2-new-taxpayer.png` |
| D4 | Medium | **Fixed** | `residentState: "ZZ"` and `"Missouri"` → 400 "Use a two-letter state code (one of the 50 states or DC)"; `"mo"` normalised to `MO` (201) |
| D5 | Medium | **Partially fixed — still fails** | The Refresh / Print / Snapshots / Finalize row now wraps (Finalize at x=29, fully visible: `R14-375-estimate-actions.png`). But the estimate page **still scrolls horizontally at 375px: `documentElement.scrollWidth` 645 vs 375** (`R5-375-est-scrolledX.png` shows ~270 px of blank page). New cause: the Payments ledger header `<th><span class="sr-only">Actions</span></th>` (`PaymentsLedger.tsx:85`) is `position:absolute` inside an `overflow-x-auto` card that is not positioned, so the span escapes the scroll container (it sits at left=644). All other tables are contained. List, detail, annual, compare, entity, snapshot view: no overflow. |
| D6 | Medium | **Fixed** | MO `installments.pcts` "0.25" → "must add up to 100% (they add up to 25%)"; "0.5, 0.5" → "has 2 entries but installments.due_dates has 4 due dates; they must match (edit both together)"; the dialog shows the due dates as a partner field "saved together". API `[0.25]` → 400 `TE_STATE_RULE_INVALID`; federal `ccorp.installment_pcts [0.5,0.5]` → 400 `TE_PARAM_INVALID`. MO estimate kept working (43,732). `R9-d6-dialog.png` |
| D7 | Medium | **Fixed** | Trace drawer lists "Bracket 1: 0 to 24,800 at 0.1 — $2,480 — 24,800 × 0.1", Bracket 2 ($9,120), Bracket 3 "37,925.73 × 0.22" ($8,344), total $19,944 "bracket tax on 138,725.73"; no long decimals. `R5-trace-drawer.png` |
| D8 | Low/Med | **Fixed** | Under "Lesser of both · firm default", the 90% tile ($32,246) carries "Recommended". `L-est.png` |
| D9 | Medium | **Fixed** | Flag ON only on the practice tenant, staff switched into Maria Designs: "Tax Estimate" section offered, Rivera listed. With the flag OFF everywhere in the firm the section is absent and `/reports/tax-estimate/taxpayers` → 404. `R7-pack-builder.png`, `R7c-builder-flag-off.png` |
| D10 | Low | **Fixed** | "Tax Estimate scenario" select: "Base (default) / QA2 Truck (2026)". Pack generated with QA2 Truck: PDF says "Scenario: QA2 Truck", total $24,199, "books through 2026-10"; a `report_pack` snapshot was created. `R7-pack-te-scenario.png`, `pdf/pack-truck.pdf` |
| D11 | Medium | **Fixed** | From the practice tenant the picker lists "Maria Rivera — Maria Designs Inc"; added with "Grant tax estimates access" → listed with the "Estimates access" badge. Empty list explains "Only active portal contacts of this taxpayer's linked companies can be added…" |
| D12 | Medium | **Fixed** | Portal: "Next payments · due **Jan 15, 2027**" (upcoming), federal $7,046 / Missouri $4,831 including earlier unpaid amounts; MO Q2/Q3 "Past due"; MO Q1 "Covered by withholding or earlier payments"; paid dates carry the year. Voucher PDF: "Next payment: $7,046 by 2027-01-15 (includes any earlier unpaid amount)". `R8-portal-tax-phone.png`, `pdf/vouchers.pdf` |
| D13 | Low/Med | **Partially fixed** | Fixed: staff tile says "$7,046 dated after today not included"; portal "Federal estimates paid so far $19,200" and "Payments on record" leave out 2027-01-15. Still wrong: the per-installment status credits the post-dated payment — portal Federal Q3 (due Sep 15, 2026) shows "**Paid $6,000 · Jan 15, 2027**" with a green **Paid** badge; payload `{"amount":"6485","paid":"6000","remaining":"0","status":"paid","paidOn":"2027-01-15"}`. As of today Q3 is $408 short (past due). In "Latest snapshot" mode the portal shows "Federal estimates paid so far **$26,246**" (post-dated payment included). See QA2-01. |
| D14 | Low | **Fixed** | "Search accounts" box filters the treatment table ("supp" 5 → 1 row). A dismissed suggestion stays dismissed after reload. |
| D15 | Medium | **Fixed** | "61520 Entertainment: Nondeductible % 100% — … (IRC §274(a))"; "61500 Meals & Entertainment: 50%" with the split-it-out note; "61530 Working Meals: 50%". `R3-practice-entity-p0.png` |
| D16 | Low | **Fixed** | Practice company (no TB profile): no duplicate-key console message; one entity-type notice. |
| D17 | Low | **Fixed** | One notice per type, below the table, naming the company: "Maria Designs Inc: Profit ownership totals 50% (under 100%)". |
| D18 | Low | **Partially fixed** | Screen fixed: the AR row shows "Verify" (review reason), not "Rules unverified"; footer "State rules: verified". The PDF still prints "**AR (nonresident) - unverified**" and "AR (verify)" headings (`pdf/base.txt` lines 43, 61). |
| D19 | Low | **Partially fixed** | Screen fixed: "(a table of 12 rows; see Admin > Tax parameters)", "more than $1,000", "Prior-year AGI 182,000 exceeds 150,000: … 110%", no "AR: AR:". The **PDF still contains the raw JSON rate table twice** (`Federal penalty.underpayment_rate [UNVERIFIED]: [{"to":"2025-03-31",…` and the full 12-row JSON under Readiness warnings), plus `Base "federal_agi"`, "withholding 2000" (no grouping), "Tax 7,590.29 less withholding 2000", "threshold 1000 (more than)" and "may differ.." (double period). `pdf/base.txt` lines 209–247 |
| D20 | Low | **Fixed** (summary banner) | At Actuals through = Dec 2026: one item per issue, "Checking not reconciled through Dec 2026", "The range runs through 2026-12…". `R5-dec-readiness.png`. The Entity tax setup readiness panel still repeats the issue (QA2-09). |
| D21 | Low | **Fixed** | Clone opens "Name the copy" prefilled "Copy of Base"; Base has no Rename/Delete; API rename/delete Base → 422 `TE_BASE_SCENARIO_PROTECTED`. |
| D22 | Low | **Not fixed** | Annual settings > select scenario "QA2 Disposable R" > Delete > confirm: the page immediately requests `GET /scenarios/<deleted>/adjustments` and `/state-rows` → **404** (deleted id confirmed absent in `tax_est_scenarios`). The fix (`useDeleteScenario` removes the two queries) does not help because the page still holds the deleted id as the selected scenario, so the mounted `useAdjustments`/state-rows observers re-create and refetch the queries. notes.log "R4c" |
| D23 | Low | **Fixed** | Payments tab keeps `through=2026-12` (URL and "12 months of actuals"). |
| D24 | Low | **Fixed** | Compare after a +$20,000 change lists "Federal required annual payment" once (25 changed rows). `R6c-compare-changed-p0.png` |
| D25 | Low | **Fixed** | Base → `tax-estimate-2026-Carlos-Maria-Rivera.pdf`; truck → `tax-estimate-2026-Carlos-Maria-Rivera-QA2-Truck.pdf`. |
| D26 | Low | **Fixed** | Focus returns to the Trace button after Esc and after Close. |
| D27 | Low | **Fixed** | 0 unlabeled controls on Annual settings (farmer section open: 13 inputs labelled). Bad "MO 2000": `aria-invalid="true"`, `aria-describedby="state-wh-error"` → "Use STATE=amount, comma separated". |
| D28 | Low | **Fixed** | 110% note absent at 100,000 and 150,000, present at 150,001. |
| D29 | Low | **Fixed** | State column filter (searchable). With a TX taxpayer present, TX filter: 5 rows → 1. `R13-d29-tx-filter.png` |
| D30 | Low | **Fixed** | Remove asks "Remove portal contact? … (their tax estimates access is revoked)"; Cancel keeps the contact. `R8-remove-confirm.png` |
| D31 | Low | **Partially fixed** | Fixed: annual inputs show "2200", "6000", "31500", "182000"; no "state state code"; admin header cells separate; entity Through month shows "September 2026"; table cells sans-serif. Residual: the treatment table's Nondeductible % input still shows **"50.0000"** (6420 Meals). `R3-schc-entity-p1.png` |

## (B) New behaviours

| Behaviour | Result | Notes |
|---|---|---|
| People card (Annual settings) | PASS | Per person: W-2 box 1, box 3, retirement plan select, box-3 hint; investment-expense and farmer test inputs; all labelled. |
| Schedule 1-A dialog | PASS | Chips "Senior · none 65+ / Tips / Overtime / Car loan interest". Dialog per person with "Under 65 at the end of 2026". "3,700" and "-5" disable Apply ("Enter an amount"). Esc discards; Apply updates chips; reload without Save reverts; Save → persists after reload; reverted afterwards. Read-only gets "View Schedule 1-A". MFS taxpayer: chips and dialog both say Schedule 1-A is not allowed for MFS; senior chip "Sam 65+" from DOB. `R4a-sch1a-*.png`, `R13-mfs-sch1a.png` |
| SE tax tiles | PASS | "Carlos Rivera · SE tax $18,086 · SE income $128,000 · ½ SE $9,043"; "Maria Rivera · SE tax $0 · No self-employment income · wages $54,000"; no Additional Medicare line (zero). |
| Register non-recurring flag + NR badge | PASS | Rivera Plumbing Jan supplies JE: card "Tax Estimator · Recurring … Linked taxpayer: Carlos & Maria Rivera" → Mark non-recurring → persists after reload; register (range "All") shows **NR** with the explanatory title; estimate 43,732 → 44,209; Mark recurring removes badge, estimate back to 43,732. Audit rows `create`/`delete` on `tax_est_treatment`. Tenant-readonly: GET 200 `canEdit=false`, PUT 403. Bookkeeper without permission: GET/PUT 403. Client and firm-B users cannot enter the tenant. `R10-card-*.png`, `R10b-register-nr-all.png`. (The register defaults to the last 90 days, so a January row needs "All".) |
| In-app Verify with expectedValue conflict | PASS (see QA2-06) | Dialog opened for `sch1a.phaseout_step`; value changed underneath via API override; Mark verified → 409 shown in the dialog: "The value of sch1a.phaseout_step for 2026 changed since you read it; review the current value and verify again". Override reverted. `R9-verify-conflict.png` |
| Fallback year read-only | PASS | API: GET 2028 `isFallback=true, fallbackYear=2026`; override / verify on 2028 → 409 `TE_YEAR_NOT_CREATED`; MO state rule on 2028 → 409. UI: after "Create 2027 from 2026" (federal), States 2027 shows "51 fallback", "Using 2026 rules · verify", "Create 2027 state rules from 2026"; Missouri has 0 Override / 0 Mark verified buttons and 20 "Create 2027 from prior to edit". `R9b-states-2027-fallback.png` |
| SEHI-in-W2 switch | PASS (see QA2-03) | Maria Designs (S corp) checkbox saves and survives reload; the base PDF assumptions state "Maria Designs Inc - Sec. 199A W-2 wages: >2% shareholder health insurance … is INCLUDED". Base total unchanged (wage limit does not bind for Rivera), as expected. |
| State select | PASS | Resident / nonresident states are selects of 51 (`aria-label` "Resident MO state", "Nonresident AR state"); + Add state adds a row. |
| Adjustment entity link rules | PASS | See D1. Entity options show person and return form. |
| Portal next payment / as-of | PASS (see D13, QA2-07) | Live: "Based on your books through Sep 2026 · as of Oct 12, 2026, 5:00 PM". Snapshot mode: "prepared Oct 12, 2026". No horizontal overflow at 375/1366. Network payloads contain no person, adjustment, trace, parameter, prior-year or SEP fields. |
| Report pack scenario picker | PASS | See D10. |
| Practice-tenant flag rule (pack) | PASS | See D9. |

## (C) Items run 1 could not test

| Item | Result | Notes |
|---|---|---|
| GL-linked adjustment run-rate | PASS (see QA2-04) | Still no UI path to create one; created via API (Other deduction, Rivera Plumbing Supplies, `amount: null`). Grid shows "From GL" and "Run-rate"; engine `fullYearAmount` 50,199.99 (37,650 YTD ÷ 9 × 12); truck total 24,199 → 22,039; editor placeholder "Run-rate from GL", Save enabled with a blank amount. |
| Adjustment edit / delete | PARTIAL | Edit: entity and amount prefilled; memo edit saved. Delete works but has **no confirmation** (QA2-02). |
| Allocation strip | PASS | §179 one-time Dec: Dec only, "Year total $60,000.00"; monthly 4,000: 12 × 4,000, "Year total $48,000.00". (Wrong for GL-linked rows: QA2-04.) |
| Pack run by someone without access | PASS | Gates: bookkeeper-without-permission and client user in Maria Designs get 404 for the tax pack, its runs, the taxpayer list and a new run; their builder has no section and their pack list hides the tax pack. Render-time recheck: copies of the run with `requested_by` = bookkeeper and = firm-B staff, rendered through `generateReportPackRun`, end `partial` with the section failing "Feature not available" (1 page, no data) and **no** snapshot created. |
| Readiness green banner | PASS | New TX taxpayer linked only to Rivera Plumbing, scratch reconciliation of Checking through 2026-09-30, all 2026 parameters verified: "Books readiness: no issues found." (`R12b-green-banner.png`). Reconciliation row removed afterwards. |
| User without tax_estimator permission | PASS | Bookkeeper with a permission row (`tax_estimator: none`): no sidebar group, deep links bounce to `/`, API 403 `PERMISSION_DENIED`. |

## (D) Totals cross-check

| Source | Federal | MO | AR | State | Total |
|---|---|---|---|---|---|
| `rivera_expected.json` base | 35,829 | 7,590 | 312 | 7,902 | 43,732 |
| API `POST …/estimate` `summary` | 35,829 | 7,590 (row `netTax`) | 312 | 7,902 | 43,732 |
| Screen (start and end of run) | 35,829 | 7,590 | 312 | 7,902 | 43,732 |
| PDF (`tax-estimate-2026-Carlos-Maria-Rivera.pdf`, 7 pages) | 35,829 | 7,590 | 312 | 7,902 | 43,732 |
| Truck scenario (oracle 24,199): API / screen / compare / pack PDF | 18,433 | — | — | 5,766 | 24,199 |

## (E) Console, network, overflow, a11y

- Console: no `pageerror`, no React key warnings. 5× `[CompanyProvider] /company/list failed: TypeError: Failed to fetch` right after a tenant switch (QA-ENV-3).
- Failed requests: all expected (403s for the no-permission user, 404s for firm B / flag off / the D22 refetch, one 409 for the Verify-conflict test), plus 429s on `/auth/methods` and `/setup/status` when five users logged in within a minute (auth limiter 10/min per IP; scripted QA only).
- 375px: overflow only on the estimate page (D5). Portal 375/1366: none.
- a11y: list, detail, annual, estimate, compare and entity pages each have one `h1`, 0 unnamed buttons/links, 0 unlabeled inputs, 0 images without alt. Trace drawer focus return fixed (D26).

## New defects

| ID | Sev | Area | Steps | Expected | Actual | Evidence |
|---|---|---|---|---|---|---|
| QA2-01 | Medium | Portal / payments (D13 remainder) | Portal (Maria) > Tax estimate, today 2026-10-12; Rivera has GL payments Apr 15 6,600, Jun 15 6,600, Sep 15 6,000 and a post-dated Jan 15, 2027 7,046 | Q3 (due Sep 15, 2026; required 6,485, 6,077 applied by today) shows the $408 shortfall (6,485 − 6,077) as Past due; the future payment is not credited | Q3 "Paid $6,000 · Jan 15, 2027" with a green Paid badge; payload `paid 6000 < amount 6485`, `remaining 0`, `status paid`, `paidOn 2027-01-15`. MO Q1 also carries `paidOn 2027-01-15` (displayed as "Covered by withholding"). In snapshot mode "paid so far" is $26,246 (includes the 2027 payment). Staff voucher table also shows Q3/Q4 "Paid … full Jan 15, 2027" | `R8-portal-tax-phone.png`, `portal-live.json`, `portal-snap.json` |
| QA2-02 | Low/Med | Adjustments | Annual settings > scenario > adjustment row > Delete | Confirmation before deleting (checklist §5 "Edit and delete with confirmation") | Deleted immediately (`AdjustmentsSection.tsx:213` calls `onDelete(a.id)` directly) | notes.log R4b ("adj delete confirm dialog: NONE") |
| QA2-03 | Low | Entity setup | Open Entity tax setup for Rivera Plumbing (Sch C) | The ">2% shareholder health insurance in §199A W-2 wages" switch appears only for S corporations | Shown (and saveable) on the Sch C entity, with its own text "S corporations only" | `R3-schc-entity-p0.png` |
| QA2-04 | Low | Adjustments | Edit a GL-linked (run-rate) adjustment | Strip shows the run-rate allocation, or says it is computed from the GL | Every month 0 and "Year total $0.00" while the engine uses 50,199.99 | `R11-gl-linked-editor.png` |
| QA2-05 | Low | Estimate summary | Rivera key figures | Sub-line adds up to the headline | "$27,200 — Federal estimates $26,246 · withholding $6,000 · $7,046 dated after today not included": 26,246 − 7,046 + 6,000 = 25,200; the other $2,000 (MO withholding) is not mentioned, and $26,246 itself includes the excluded payment | `L-est.png` |
| QA2-06 | Low | Admin Verify | Tax parameters > Mark verified on any row | The dialog shows the value being signed (R6-04: "signs the value the admin saw") | The dialog names the key but not the value; the value is only visible in the table behind the modal | `R9-verify-conflict.png` |
| QA2-07 | Low | Portal (snapshot mode) | Taxpayer portal shows = Latest snapshot; snapshot has the federal balance fully covered (incl. post-dated payment) | Wording such as "Nothing due" / "Paid in full" | "Federal (IRS) — **None required**", which reads as "estimates not required" (the same text AR uses) | `R8f-snapshot-via-dash.png`, `portal-snap.json` |
| QA2-08 | Low | Taxpayer form | New taxpayer > Resident state, type "Missouri" on the keyboard | Lands on MO | Options start with the code ("MI · Michigan"), so type-ahead "Mi…" selects **MI**. Visible in the control, so not silent like D3, but easy to miss | notes.log R2 |
| QA2-09 | Low | Entity setup readiness | Entity tax setup > Books readiness | One line per issue (as D20 fixed on the summary) | "Unreconciled accounts: 1010 Checking (reconciled through never)" and "1 bank/credit-card account(s) are not reconciled through 2026-09" both shown | `R3-schc-entity-p1.png` |

D5, D18, D19, D22 and D31 residuals are listed in the retest table above and not repeated here.

## Environment observations (outside the module or not confirmed as product defects)

- **QA-ENV-1 (check on a production build):** in the vite dev server, a cold load / refresh of `/portal/tax-estimates` freezes the tab (main thread blocked: no further requests, `page.evaluate` and screenshots time out). Reproduced 4 times, live and snapshot mode. Navigating `/portal` → `/portal/tax-estimates` works every time. `/portal/questions` freezes the same way on a cold load, so this is portal-wide and probably dev-server / service-worker related, not the estimator page. If it reproduces on the appliance build it is High (a client opening a bookmarked or emailed link).
- QA-ENV-2: report-pack enqueue still fails with BullMQ `Custom Id cannot contain :` (`jobId: pack:<id>` in `extraction/queue.ts:169`); packs generate inline. The run page now polls without 429s.
- QA-ENV-3: `[CompanyProvider] /company/list failed: Failed to fetch` logged once per tenant switch.

## Not tested

- A staff user in several firms having to pick a firm; a treatment mapped by another firm shown read-only (fixture limits, as in run 1).
- "Passive loss suspended" chip; Farmer and C corp summary cards (no fixtures).
- Broken-parameter error naming a missing key; failed-download inline error on compare cards; loading spinners as a separate check.
- Register NR card on an unlinked company's or a NULL-company transaction (every Rivera company is linked; firm B's company is not reachable by firm A staff).
- Payments ledger edit (add and delete-with-confirm were exercised); chat assistant (no AI provider); restart re-sync and rollback (passed in run 1, not repeated).
- Through a real worker: the worker was not started (inline fallback used).

## Cleanup (confirmed)

- API (3111) and vite (5183) process groups stopped; `ss` shows both ports free. Port 3121 was never used.
- `kisbooks_qa2` dropped (`pg_database` now lists only `kisbooks` and `kisbooks_test`).
- Test Redis db 7 flushed (`dbsize` 0); no other db index touched.
- The scratch env file holding the DB password, cached API tokens and browser storage states deleted; a scan of the scratchpad and this report for the password found nothing.
- Prod `GET http://127.0.0.1:3001/api/health` → 200 (read-only).
- Repo: only this report is new (`git status`: `?? features/tax-estimator/docs/reviews/QA-run-2.md`); nothing staged or committed.
