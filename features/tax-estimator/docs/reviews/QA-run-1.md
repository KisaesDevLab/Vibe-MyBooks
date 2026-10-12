# Tax Estimator — QA run 1 (manual checklist, headless browser)

- Date: 2026-10-12
- Branch / code under test: `feat/tax-estimator` at `e65c57b0` (two docs-only commits, `12d538fc` and `e32b8a02`, landed during the run; no code changed)
- Script: `features/tax-estimator/QA-CHECKLIST.md`, sections 0–12 and the Phase 11 script
- Tester: QA agent (Playwright 1.59 / Chromium headless, desktop 1366×900 and phone 375×812)

## Environment (throwaway, now torn down)

| Item | Value |
|---|---|
| API | `tsx src/bootstrap.ts` on 127.0.0.1:3111 from the working tree, fresh random JWT/encryption secrets in the process env only |
| Web | `vite --host 127.0.0.1 --port 5183 --strictPort`, proxying to 3111 through env (`VITE_API_URL`); `vite.config.ts` was not edited |
| Worker | `packages/worker` `tsx src/index.ts`, started for the Report Pack section only |
| DB | scratch database `kisbooks_qa` on the db container (port 5434). All 202 migrations were applied. **The database was dropped at the end.** |
| Redis | test redis 127.0.0.1:6390, logical db 7 (empty at start, flushed at end) |
| Files | `DATA_DIR`, `CONFIG_DIR`, `UPLOAD_DIR` and `BACKUP_DIR` pointed at the session scratchpad. `PUPPETEER_EXECUTABLE_PATH` pointed at the Playwright Chromium. |
| Seed | `createAdminUser` (super admin plus the appliance firm and practice tenant), a firm admin, a firm staff user (accountant), a read-only user (tenant role `readonly` + `firm_readonly`), a second read-only user (`firm_readonly` + tenant role `accountant`, added mid-run), a client user (`user_type=client` on Maria Designs), a second firm with its own practice tenant and staff user, a portal contact on Maria Designs, and the Rivera fixture through `seedRivera()` (Sch C / S corp / LP in three client tenants, plus another firm's client) |
| Flags | `TAX_ESTIMATOR_V1` was OFF on a fresh DB and was turned ON through the Admin UI (practice tenant). It was also ON for Maria Designs (portal and report-pack tests) and for the second firm's practice tenant. `CLIENT_PORTAL_V1` was ON for every client tenant. |
| Not touched | ports 3001/5173/6379, the `kisbooks` database, docker compose, `~/vibe-mybooks`. Prod `/health` returned 200 after teardown. Nothing was committed or staged, and `git status` is clean. |

Artifacts are in the session scratchpad (`/tmp/claude-1000/-home-adminvibe/cce54607-829f-431a-a9e5-d08114f886bf/scratchpad/qa/`):
- `shots/` — 130 screenshots (paths below are relative to it)
- `pdf/` — the downloaded estimate, compare, pack and voucher PDFs
- `logs/notes.log` — the run log, including console errors and 4xx/5xx responses
- `portal-responses.json` — captured portal API payloads

## Headline results

- **Oracle cross-check: PASS.** Rivera base total on screen, from the API and in the PDF: federal **35,829**, MO **7,590**, AR **312**, total **43,732**. This holds for the default through-month (Sep 2026) and for Dec 2026. The Sch C company moves from book 115,400 to tax-basis 128,000.
- 31 defects: 1 High, 10 Medium, 2 Low/Medium (D8, D13), 18 Low. The High one: a business adjustment cannot be tied to an entity from the UI, so §179 and similar items are silently treated as itemized deductions.
- Nothing crashed. Console errors were limited to one React duplicate-key warning (D16) and expected 404s.

## Pass/fail by checklist item

Legend: PASS · FAIL · PARTIAL (works, but with a defect or a sub-point missing) · N/T (not tested; reason given)

### 0. Test firm setup
| Item | Result | Notes |
|---|---|---|
| Firm, practice and client tenants, users, portal contact, super admin | PASS (adapted) | Uses the Rivera fixture's three client tenants instead of the A/B tenant layout. Nothing is reconciled, so no "clean books" case. |
| TAX_ESTIMATOR_V1 OFF everywhere on a fresh DB | PASS | Admin > Tenants > Feature Flags showed "Never activated" (`10-admin-flags-before.png`) |

### 1. Enabling the flag
| Item | Result | Notes |
|---|---|---|
| Flag OFF: no group, deep link bounces, API refuses | PASS | API returned 404 `Feature not available` |
| Turn ON in Admin; group appears; collapse/expand remembered; collapse-all | PASS | `11-staff-sidebar-flag-on.png` |
| Read-only staff sees the group; client and second-firm users never do; a user without permission does not | PARTIAL / FAIL | A tenant role `readonly` user sees no group and is bounced, although the API serves reads (**D2**). A `firm_readonly` user with the accountant role sees it. The client user never sees it. The second-firm user sees an empty group because the flag is ON on their own practice tenant, and Rivera returns 404 for them. The "no tax_estimator permission" case was N/T (needs a custom bookkeeper template). |
| Flag OFF again hides the group and keeps data; ON restores it | PASS | |
| New tenant has the flag OFF | PASS | Checked on tenants seeded with `seedDefaultsForNewTenant` (the LP tenant shows enabled=false). No tenant was created through the UI. |

### 2. Taxpayers, persons, links
| Item | Result | Notes |
|---|---|---|
| New taxpayer; "Missouri" rejected; multi-firm staff must pick a firm | FAIL | The input's maxLength=2 silently turns "Missouri" into **"MI"** and creates the taxpayer (**D3**). The API accepts `ZZ` (**D4**). Multi-firm pick was N/T. |
| Search by taxpayer and person, filter, Clear filters, empty states | PARTIAL | Search, the filing-status filter, "Clear filters", "No taxpayers yet" and "No taxpayers match your search." all work. There is no state filter (**D29**). |
| Edit details, Save, safe-harbor and portal selects; read-only disabled | PASS | Persists after reload. With ro2 every field is disabled. |
| Persons: primary + spouse, one primary, future DOB rejected, SEHI all/none | PASS | A future DOB disables Save and shows "Date of birth cannot be in the future" |
| Links across tenants; company picker scoped | PASS | Picker lists the practice tenant plus the three Rivera companies, not the other firm's client |
| Link form fields, reasons required, percent notice | PARTIAL | Partner SE status, active participation, QBI reason and allowed-loss reason all appear and are enforced. The percent notice renders twice and doesn't name the company (**D17**). Active participation saves but is not shown in Notes. |
| Archive: confirm dialog; leaves the default list | PASS | |
| Isolation: second firm gets not found; lost tenant access shows "no longer managed" | PASS | `28-firmb-rivera-url.png`, `38-lost-access.png`. Readiness also lists the out-of-scope link. |

### 3. Entity tax setup
| Item | Result | Notes |
|---|---|---|
| Entity type from the TB profile; override explains profile precedence | PASS | |
| Method, sourcing, SSTB, rental-T/B, large corp, farmer persist | PASS | |
| W-2 override reason; UBIA blank notice; >4 decimals rejected | PASS | |
| GL treatment table: filters, badges, selects, person picker, Non-recurring, Discard; suggestions banner and Dismiss | PARTIAL | Status/treatment filters, "Save 1 change"/Discard and Apply work. There is no search box. A dismissed suggestion comes back after reload (**D14**). The "Entertainment" suggestion is tax-wrong (**D15**). A company without a TB profile gets a duplicate-key warning (**D16**). The practice company shows "No P&L accounts found" under a banner listing three P&L accounts. |
| Rivera check 115,400 → 128,000 | PASS | Seen on the **Sch C** company (Rivera Plumbing); the checklist says "S corp" |
| Read-only sees the table without edit controls; another firm's mapping is read-only | PASS / N/T | The other-firm mapping needs two firms on one book, which can't be set up |
| Readiness panel and Through month | PASS | The Through-month input starts blank (cosmetic) |

### 4. Annual settings
| Item | Result | Notes |
|---|---|---|
| Year selector; "not set up" offers Create; provisional notice | PASS | 2028 shows "No federal parameters exist for 2028; the 2026 values were used (all provisional)" (`64-estimate-2028-provisional.png`). The year input applies only on blur. |
| Deduction method, federal method/rate, credits, withholding, HSA, Sch 1-A, prior year | PASS | Every value persists after reload |
| 110% note; persistence; encrypted at rest (D9) | PARTIAL | The note on this screen is static and shows even at AGI 100,000 (**D28**); the estimate shows the dynamic note. Prior-year values are ciphertext in `tax_est_years.*_encrypted`, and the year list exposes only `priorYear*Present`. |
| States: one resident, other states, credit override, STATE=amount format | PASS | The API returns 422 `TE_STATE_ONE_RESIDENT`. A bad format disables Save and shows "Use STATE=amount" (not linked to the field: **D27**). |
| Firm settings dialog: options; only firm admins can save | PASS | Staff gets no button, and the API returns 403 `TE_FIRM_ADMIN_REQUIRED` |

### 5. Scenarios and adjustments
| Item | Result | Notes |
|---|---|---|
| Clone (name it), rename, delete; Base protected; cap | PARTIAL | Clone creates "Copy of …" without asking for a name, and Base can be renamed (**D21**). Delete has a confirm dialog and Base has no Delete. Clone is disabled at 6 with the title "At most 6 scenarios per year". After a delete the page re-fetches the deleted scenario's data and gets 404s (**D22**). |
| Adjustment editor fields, end<start rejected, %, Run-rate from GL, edit/delete | PARTIAL / FAIL | There is **no entity/link picker**, so business deductions become itemized (**D1**). "Percent applied" shows for meals; end<start shows "End month must not be before the start month". Run-rate from GL was N/T (GL-linked adjustments can't be created in the UI). Adjustment edit/delete was not exercised. |
| Allocation strip | N/T | The component exists in the editor but its rendering wasn't verified |
| Scenario independence | PASS | Each scenario's adjustments are listed separately through the API |

### 6. Estimate summary
| Item | Result | Notes |
|---|---|---|
| Rivera base total = oracle 43,732 | PASS | 35,829 / 7,590 / 312 |
| Changes take effect on Refresh; Actuals-through changes YTD | PASS | Adjustment, payment and through-month changes all apply (YTD Sch C 96,000 → 117,333 at Nov). A treatment change was not exercised. |
| Unverified warnings; an Admin override flips the status | PASS | `std_deduction.mfj` override → `unverified` in `parametersUsed`; "Verify all" → 0 unverified |

### 7. Payments, snapshots, finalize
| Item | Result | Notes |
|---|---|---|
| Ledger: GL rows read-only; manual add/edit/delete; read-only has no controls | PASS | Totals update 34,246 → 35,481 → 36,246 → 34,246 |
| Finalize & issue vouchers, note, "Snapshot saved", listed | PASS | |
| Snapshot view figures/assumptions/vouchers; no edit; PATCH/DELETE 409 | PASS | Both return 409 `TE_SNAPSHOT_IMMUTABLE` |
| Live moves, snapshot doesn't; compare | PASS | "No figures changed" before the edit, a full diff after (one row duplicated: **D24**) |
| PDF twice same day → one PDF snapshot | PASS | |
| Snapshot with an unreachable client is not viewable | PASS | "includes a client you can no longer reach" |

### 8. Report Pack
| Item | Result | Notes |
|---|---|---|
| Add "Tax Estimate" (group Tax); picker shows only linked taxpayers; optional scenario | PARTIAL | Needs the flag **on the client tenant**; without it the section is silently absent (**D9**). There is no scenario picker (**D10**). |
| Generate: pages included, as-of sets through, "report pack" snapshot | PASS | `pdf/pack.pdf` (5 pages; the section says "books through 2026-10"); a `report_pack` snapshot was created |
| Non-staff cannot add/generate; a run by someone without access shows unavailable | PARTIAL | The client user gets 404 on the taxpayers endpoint and has no section in the builder. The "run by someone without access" case was N/T. |
| Unlinked company: explanatory message | PASS | "No taxpayer is linked to this company in the Tax Estimator." |

### 9. Client portal (375px and desktop)
| Item | Result | Notes |
|---|---|---|
| Add contact: only managed-client contacts offered; badge absent until the toggle | PARTIAL | The picker lists only the **active tenant's** contacts, so from the practice tenant it shows "No contacts available" (**D11**). The badge behaves correctly. |
| Practice > Client Portal: tick "Tax estimates", badge appears; clients cannot | PASS | The client user gets 404 on the API |
| Tile shown only when every condition holds | PASS | Absent with no link/grant and with the flag off on the client tenant |
| Phone page: no horizontal scroll, figures, due dates, Past due, disclaimer, as-of/prepared | PARTIAL | No overflow at 375. Content problems: the "next" due date is in the past; MO Q1 says "Nothing paid yet" next to a "Paid" badge (**D12**); post-dated payments count as paid (**D13**). |
| Voucher PDF is client-safe | PASS | No prior-year figures, persons, adjustments or parameters (`pdf/vouchers.pdf`). Wording: **D12**. |
| Network responses carry no internals | PASS | Scanned for person, adjustment, trace, parameter, prior-year and SEP terms: only `displayName` |
| Latest snapshot mode / nothing shared yet | PASS | "prepared Oct 12, 2026"; "Your accountant has not finalized an estimate for 2026 yet" |
| Remove the contact: revoked; another id → not found | PASS | 404 `TE_PORTAL_FORBIDDEN`. Remove has no confirm step (**D30**). |
| Flag OFF on the client tenant: message, tile hidden | PASS | |

### 10. Super-admin parameters and state rules
| Item | Result | Notes |
|---|---|---|
| Page: year selector, search, filter, Missing keys, status, citation, source, shipped value | PARTIAL | Year, search, Federal/States toggle, completeness (161/161), status, source and citation are present. "Shipped" appears only on overridden rows. There is no jurisdiction filter beyond the toggle. |
| Override: units, reason required, toast, estimate uses it, Revert, audited | PASS | `audit_log` row `override_set`. The estimate moved (43,732 → 43,512) and was restored. |
| Create a tax year; Missing keys | PASS | "Create 2027 from 2026" → provisional rows |
| States view: filters, no-income-tax rows, override/revert, arrays only | PARTIAL / FAIL | Filters, search, "No income tax" and revert work. The override accepts a structurally invalid list, which breaks every MO estimate (**D6**). |
| Firm owner/staff blocked | PASS | UI redirects to `/`; API returns 403 |
| Restart: shipped values re-sync, overrides remain | PASS | |
| Verify (scratch only) | PASS | "Verify all unverified in 2026 (17)" dialog → 0 unverified |

### 11. Phase 11 — summary, compare, PDF
| Item | Result | Notes |
|---|---|---|
| Staff sees the group; Tax estimate / Scenarios links | PASS | |
| Section tabs, active underline, Payments scrolls | PASS | Possibly drops `?through=` (**D23**) |
| Client and flag-off deep links bounce | PASS | |
| Second firm can't open the estimate or PDF | PASS | PDF POST → 404 |
| Actuals-through default label; amber warning for a later month | PASS | |
| Scenario select changes figures and URL, survives reload | PASS | |
| Readiness banner items with entity links; green "no issues" | PARTIAL | Duplicate and stale items (**D20**). The green banner was N/T (books are never clean in the fixture). The "unverified state rules" item never appears (all rules verified). |
| Missing-year fallback banner | PASS | |
| Key figures | PASS | |
| Calculation table (YTD on income only, no period column) | PASS | |
| Inline chips | PARTIAL | "Capped at limit" appears only after the truck adjustment is linked through the API (**D1**). "Rules unverified" is misleading (**D18**). "Passive loss suspended" was N/T. |
| Trace drawer on Regular income tax | FAIL | No bracket rows; a raw 25-digit decimal (**D7**); focus is not restored (**D26**). Esc and Close both dismiss it. |
| Safe-harbor card: both rules, recommended outlined, badge, lines; prior-year unavailable reason | PARTIAL | No tile is marked Recommended under "lesser of" (**D8**). The unavailable reason shows. |
| Voucher table per jurisdiction; AR "none required" | PASS | |
| Payments ledger (Summary) | PASS | |
| Farmer / C corp cards | N/T | No fixture |
| Warnings match the API; footer | PASS | 35 = 35 at Dec. The footer shows the firm disclaimer, status and engine version (raw text: **D19**). |
| Broken parameter: error names the key; Try again | PASS | Tested with a broken state rule ("TE_STATE_RULE_INVALID: MO due dates and percentages differ in length"); Try again recovers. The missing-key variant was N/T. |
| Compare: three pickers, duplicates disabled, survives reload; cards; table rows; toggle; clone/rename/delete; single-scenario prompt | PASS | |
| PDF: filename and contents match the screen | PASS | `tax-estimate-2026-Carlos-Maria-Rivera.pdf`, 7 pages, all sections plus the firm disclaimer |
| Per-scenario compare PDF; inline error | PASS / N/T | Every scenario gets the same filename (**D25**). The failed-download error was N/T. |
| Read-only can download; other firm errors | PASS | ro2 → 200 application/pdf; firm B → 404 |
| 375px: no page scroll, tables scroll in cards, controls wrap, drawer fits | FAIL | The estimate page scrolls horizontally (scrollWidth 645) because the action row doesn't wrap (**D5**). The list, detail, annual, compare and entity pages are fine, and the drawer is full-width. |
| Loading spinner / error with retry / empty states | PARTIAL | Error + retry and the empty states (no year, no linked entities, no taxpayers) were seen. Spinners and the empty payments state were not specifically captured. |

### 12. Cross-cutting
| Item | Result | Notes |
|---|---|---|
| KB category "Tax Estimator" with nine articles; chat assistant answer | PASS / N/T | The category lists its articles (`articles.ts` has 9). Chat was N/T: no AI provider in scratch. |
| Rollback 0201 on a scratch DB; tables/columns/flag rows gone; app still boots | PASS | After `0201_tax_estimator.rollback.sql`: no `tax_est_*`/`tax_parameter*`/`state_estimate*` tables, the `report_pack_runs` columns are gone, and 0 flag rows. The API boots (seed-sync failures are logged), health is OK, login works, and the module returns 404. |
| License headers and migration policy scripts | PASS | Both exit 0 |

## Defects

Screenshot paths are relative to the scratchpad `qa/shots/` directory.

| ID | Sev | Area | Steps | Expected | Actual | Evidence |
|---|---|---|---|---|---|---|
| D1 | **High** | Adjustments | Annual settings > scenario "Buy truck in December" > + Add adjustment > Type "Vehicle purchase (§179)", 60,000, One time Dec, Person Carlos | The adjustment can be attached to the Rivera Plumbing (Sch C) link, so it reduces Sch C profit, SE tax, QBI, SEP limit and AGI | The editor has no entity/link field. The engine treats the item as an **itemized "other" deduction** ($60,000 itemized; AGI, SE tax, QBI and state unchanged; federal drops only 6,116). The only hint is an info warning ("Link it to an entity…"), which nothing in the UI can act on. After `PATCH linkId` through the API: total 24,199, SEP "Capped at limit". | `81-truck-p1.png`, `83-truck-linked.png`; `TE_ADJUSTMENT_UNLINKED_DEDUCTION` |
| D2 | Medium | Nav / permissions | Log in as a user with tenant role `readonly` and `firm_readonly`; open `/tax-estimator/taxpayers` | Read-only screens (QA-CHECKLIST §1; MODULE.md role table: "firm_readonly: read-only screens") | No sidebar group; the deep link bounces to `/`. The API still returns 200 for reads. Cause: `filterTaxEstimatorNav` returns `[]` for `role === 'readonly'`, and its unit test pins that. | `13-ro-taxpayers.png` |
| D3 | Medium | New taxpayer | Taxpayers > New taxpayer > Resident state: type "Missouri" > Create | "Use a two-letter state code" | maxLength=2 keeps "MI" (Michigan) and the taxpayer is created with no message | `22-missouri-rejected.png` |
| D4 | Medium | Validation | `POST /tax-estimator/taxpayers {residentState:"ZZ"}` | 400 for an unknown state | 201. Any two letters are accepted. | notes.log |
| D5 | Medium | Responsive | Estimate summary at 375px | No page-level horizontal scroll; controls wrap | scrollWidth 645 vs 375. The Refresh/Print/Snapshots/Finalize row doesn't wrap and "Finalize & issue vouchers" sits off-screen. | `150-375-estimate.png`, `153-375-estimate-scrolledX.png` |
| D6 | Medium | Admin state rules | Admin > Tax parameters > States > 2026 > Missouri > `installments.pcts` > Override, value "0.25", reason > Save | Rejected: the list must match the due-dates length and sum to 1 | Saved as `[0.25]`. **Every MO estimate then fails** with 422 `TE_STATE_RULE_INVALID` until reverted. | `130-estimate-error.png` |
| D7 | Medium | Trace | Summary > Regular income tax > Trace | Bracket rows (label, amount, formula, source, marginal rate) | A single line, "bracket tax on 138725.7318071403638391314", plus "Source: parameter · marginal rate 22%" | `82-trace-drawer.png` |
| D8 | Low/Med | Safe harbor | Rivera summary (firm default "lesser of") | The lower rule's tile (90% current, 32,246) is outlined "Recommended" | Neither tile is marked: the API returns `appliedRule: 'lesser_of'` and `SafeHarborCard` checks only `current_year`/`prior_year` | `41-est-p1.png`; `SafeHarborCard.tsx:41,45` |
| D9 | Medium | Report Pack | With TAX_ESTIMATOR_V1 ON only on the practice tenant (as the module docs instruct), switch to a linked company (Rivera Plumbing) > Reports > Report packs > New | "Tax Estimate" section with Rivera offered (the estimate page hint promises it) | The section is absent with no explanation. `resolvePackScope` needs the flag on the **client** tenant (`/reports/tax-estimate/taxpayers` → 404). Works once the flag is ON for the client tenant. | `91-pack-builder.png` |
| D10 | Low | Report Pack | Builder > Tax Estimate > pick taxpayer | Optional scenario picker (checklist §8) | None (`ReportPackBuilderPage.tsx` has no scenario control; the API accepts `scenario_id`) | `95-pack-te-picked.png` |
| D11 | Medium | Portal contacts | Practice tenant > Taxpayer Rivera > Portal contacts > Add | Contacts from the managed clients (Maria Designs' contact) | "No contacts available": the picker reads only the active tenant's `/practice/portal/contacts`. You have to switch into the client tenant. | `30-rivera-detail.png` |
| D12 | Medium | Client portal | Portal (Maria) > Tax estimate, today = 2026-10-12 | The next payment is the upcoming due date, with past-due items flagged | Header "Next payments · due **Jun 15, 2026**" (past); MO Q1 "Nothing paid yet" alongside a green "Paid" badge (covered by withholding); voucher PDF "Next payment: $1,416 by 2026-06-15" | `111-portal-tax-phone.png`, `pdf/vouchers.pdf` |
| D13 | Low/Med | Payments | Rivera has a GL payment dated 2027-01-15 | Payments after "today" aren't "paid to date" (or are labelled scheduled) | Counted in "Paid & withheld to date"; portal shows Fed Q3/Q4 "Paid … Jan 15" (no year) and lists 2027-01-15 under "Payments on record". Comes from the fixture, but post-dated entries happen in real books. Confirm the intent. | `111-portal-tax-phone.png` |
| D14 | Low | GL treatments | Entity tax setup | Table search; Dismiss persists | No search box. A dismissed suggestion (Entertainment) is back after reload. | `54-after-suggest-apply.png` |
| D15 | Medium | Suggestions (tax) | Practice company (default COA) > GL tax treatment | Entertainment suggested as 100% nondeductible (§274(a)) or not suggested | "61520 Entertainment: Nondeductible % **50%** — Name refers to meals" | `53-practice-entity-p0.png` |
| D16 | Low | Entity setup | Open the entity page for a company with no TB profile | Single notice, no console error | React "two children with the same key" `TE_ENTITY_TYPE_FROM_COMPANY`; the notice shows twice | notes.log |
| D17 | Low | Links | Add a 60% link | One notice naming the company | "Profit/Loss ownership totals 60%" shown above **and** below the table, with no company name | `36-link-added.png` |
| D18 | Low | Summary | Rivera AR row | The chip reflects rule verification | "Rules unverified" chip while every AR rule is `verified` (driven by `row.verify` for the effective-rate method); the footer says "State rules: verified" | `41-est-p1.png`, `41-est-p3.png` |
| D19 | Low | Text formatting | Summary warnings, footer, PDF | Formatted values | Raw JSON rate table in the `penalty.underpayment_rate` warning; "Prior-year AGI 182000 exceeds 150000 … 1.1 of prior-year tax"; "AR: AR: estimates are not required (threshold, threshold 1000 more_than)" (also in the PDF); PDF "recommended: lesser_of", "effective 14.3763%" | `41-est-p2.png`, `pdf/s1.txt` |
| D20 | Low | Readiness | Summary with Actuals through = Dec 2026 | One item per issue, for the selected range | Each entity gets "Checking not reconciled through Sep 2026" **and** "1 bank/credit-card account(s) are not reconciled through 2026-09"; still says "range runs through 2026-09" | `86-snapshots-list.png` |
| D21 | Low | Scenarios | Clone; Rename Base | Name prompted on clone; Base keeps its name | Clone creates "Copy of X" without asking; `PATCH` Base `{name:"Not Base"}` → 200 (reverted) | `72-tabs.png` |
| D22 | Low | Scenarios | Delete a scenario | No requests for the deleted id | GET `/scenarios/<deleted>/adjustments` and `/state-rows` → 404 after each delete | notes.log |
| D23 | Low | Navigation | Summary with `?through=2026-12` > Payments tab | Keeps the through-month | Seen once: the header reverted to "9 months of actuals" (default). Needs confirmation. | notes.log (S7a) |
| D24 | Low | Snapshot compare | Compare after a change | Each row once | "Federal required annual payment" listed twice | `89-compare-changed.png` |
| D25 | Low | PDF | Compare > Download PDF on each card | Filename includes the scenario | All are `tax-estimate-2026-Carlos-Maria-Rivera.pdf` | `pdf/compare-*.pdf` |
| D26 | Low (a11y) | Trace drawer | Open Trace, press Esc / Close | Focus returns to the Trace button | Focus lands on `<body>` (Esc) or the sidebar (Close) | notes.log (S6a) |
| D27 | Low (a11y) | Annual settings | Inspect form controls | Every control has an accessible name; errors tied to inputs | 13 unlabeled controls (farmer/fisherman checkbox + 12 monthly inputs). The state-withholding error has no `aria-invalid`/`aria-describedby`. | notes.log (S12c) |
| D28 | Low | Annual settings | Prior-year AGI 100,000 | The 110% note appears only above 150k/75k | Static note, always shown | notes.log (S4f) |
| D29 | Low | Taxpayer list | List header | State filter (checklist §2) | Sort only, no filter | `20-list.png` |
| D30 | Low | Portal contacts | Taxpayer > Portal contacts > Remove | Confirm before revoking client access | Removes and revokes immediately | notes.log (S9g) |
| D31 | Low | Cosmetic | various | — | Inputs show 4-decimal values ("8000.0000", "150.0000"); label "Nonresident state state code"; admin header "SourceCitation" with no gap; the entity "Through month" input starts blank; Book/Tax columns in a monospace font | `60-annual-p1.png`, `120-admin-params-p0.png` |

## Not tested

- A staff user in several firms having to pick a firm (§2). Needs the same user in two firms.
- A treatment mapped by another firm shown read-only (§3). One tenant can't be actively assigned to two firms.
- Run-rate from GL / GL-linked adjustments (§5). There is no UI path to create one. Adjustment edit/delete, and rendering of the allocation strip.
- A pack run requested by someone without access rendering the section as unavailable (§8).
- "Passive loss suspended" chip, Farmer and C corp summary cards (§11): no fixtures.
- The green "no readiness issues" banner (fixture books are never reconciled), and the missing-key variant of the broken-parameter error.
- Loading spinners as a separate check; failed-download inline error on the compare cards.
- The chat assistant answer (§12): no AI provider in the scratch environment.
- A user with no `tax_estimator` permission (custom bookkeeper template).

## Environment notes (outside the module, seen while testing)

- Report-pack runs: enqueueing fails with BullMQ `Custom Id cannot contain :`, and the API falls back to inline generation (`report-pack.service.ts`). Inline generation needs `PUPPETEER_EXECUTABLE_PATH` on a bare host. The run page polls fast enough to get repeated **429**s on `GET /reports/packs/runs/:id`. Worth checking in the appliance, since it affects every pack, not just this module.
- The login limit is 10 per account per 15 min, held in memory. Scripted QA has to reuse sessions or restart the API.
