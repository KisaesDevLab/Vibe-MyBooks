# QA Checklist — Split-Level Tags v2

Phase 9 / Phase 10 sign-off gate. Work through every section on the
target tenant **before** flipping the feature flag for that tenant.
Record the tester, date, and build SHA at the bottom. A section fails
the whole sheet — do not cherry-pick.

Flags under test:

- `TAGS_SPLIT_LEVEL_V2` — data-model cutover (server).
- `ENTRY_FORMS_V2` — two-line split-row UI (web).
- `TAG_BUDGETS_V1` — tag-scoped budgets + Budget vs. Actuals (both).

Prerequisite state: seed fixture DB with at least one tag-uniform
transaction, one mixed-tag transaction, one untagged transaction, one
recurring template with a header tag, and one Plaid-imported batch of
≥50 rows.

---

## 1. Entry forms (behind `ENTRY_FORMS_V2`)

For each of the nine forms below — **7a Expense, 7b Write Check, 7c
Enter Bill, 7d Enter Vendor Credit, 7e Deposit, 7f Cash Sale, 7g
Invoice, 7h Journal Entry, 7i Register** — verify:

- [ ] First render shows two-line split rows with Description + Tag on
      line 2 (JE: Memo + Tag).
- [ ] Tab order moves horizontally through line 1, then line 2, then
      to the next row.
- [ ] `Cmd/Ctrl+D` duplicates the focused row, including its tag.
- [ ] `Cmd/Ctrl+Backspace` deletes the focused row.
- [ ] `Cmd/Ctrl+Shift+A` on the first row copies its tag to every
      row below whose tag is still untouched. Rows the user has
      already touched stay untouched.
- [ ] Enter from the last field of line 2 appends a new row and
      focuses its first field.
- [ ] Pressing Escape cancels any open tag picker without data loss.
- [ ] Narrow the browser to <768px — rows stack cleanly; nothing is
      clipped or horizontally scrolls.
- [ ] Amount column handles `$9,999,999.99` without clipping.
- [ ] Posting succeeds; re-opening the transaction shows every
      per-line tag preserved.
- [ ] Duplicating the transaction (list action, not row duplicate)
      preserves every per-line tag on the new draft.

Additional per-form checks:

- [ ] Expense / Write Check / Enter Bill / Vendor Credit: AI
      categorization suggestion pre-fills the tag per line when the
      AI returns one. User override sticks.
- [ ] Enter Bill / Cash Sale / Invoice: selecting an item whose
      `defaultTagId` is set pre-fills the tag on that line.
- [ ] Expense / Bill: selecting a vendor contact whose
      `defaultTagId` is set pre-fills the tag on every line that does
      not yet have one.
- [ ] Journal Entry: widened view shows the Tag column without
      cramping the Debit/Credit grid.
- [ ] Register: date field is wide enough to show `MM/DD/YYYY`; the
      second row contains the Tag picker; Payment amount still shows
      the full amount at 1280px.

`ENTRY_FORMS_V2=false` regression — with the flag off, every form
falls back to the legacy single-line layout and tag data still
round-trips through the API.

---

## 2. List views

- [ ] **Transactions** — tag filter in the filter bar; clearing it
      restores the unfiltered view; the Tag column shows a single
      pill when all splits match, "Mixed" with tooltip when they
      differ, "—" when none tagged.
- [ ] **Transactions** — first-time tag-filter banner shows on
      first use after upgrade; `Dismiss` hides it for the session.
- [ ] **Invoices** — Customer column renders; date-range, customer,
      and tag filters all narrow the list correctly; saving column
      visibility to localStorage persists across reloads.
- [ ] **Invoice detail** — customer panel shows name, email,
      phone, billing address when the contact has them; absent
      values render as "—" without breaking layout.
- [ ] **Bills** — date-range and tag filters; exported CSV includes
      the `line_tag` column.
- [ ] **Bank Feed** — tag filter under the date field; text-box
      alignment across the categorize drawer is flush; bulk
      **Set tag…** applies to every selected row and every line
      underneath them; AI-suggested tag pre-fills the categorize
      drawer from `bank_feed_items.suggested_tag_id`.
- [ ] **Batch Entry** — column-visibility toggles show/hide Memo
      and Tag; preferences persist per-user via localStorage; the
      Tag column accepts a picker value and posts through.

---

## 3. Bank Rules, Items, Contacts

- [ ] Bank Rule builder: **Assign Tag** dropdown saves; re-opening
      shows the chosen tag.
- [ ] New bank feed transaction that matches the rule pre-fills the
      tag on every split (precedence position 2 in
      `resolveDefaultTag`).
- [ ] Item form (create + edit): **Default Tag** saves and is
      surfaced in the invoicing/cash-sale forms on item selection.
- [ ] Contact form for a vendor: **Default Tag** saves and flows
      into Expense/Bill defaults. Customer-type contacts do not
      surface the tag into Invoice defaults (ADR 0XY §2.1).

---

## 4. Tag Budgets (behind `TAG_BUDGETS_V1`)

- [ ] Budgets list page shows every budget with tag scope,
      fiscal-year-start, period type, last updated.
- [ ] Budget editor: arrow keys move between cells; Enter moves
      down; Tab moves right; cells accept dollar input and store
      cents; footer totals update live.
- [ ] **Copy from prior year** pulls every line from the prior
      budget; optional inflation % scales every amount; a copied
      budget is marked `status=draft` until the user promotes it.
- [ ] **Seed from prior-year actuals** populates cells from the
      matching P&L report for the budget's fiscal window and tag
      scope (if any). Zero-actual accounts are still created so the
      editor can distinguish "not seeded" from "seeded 0".
- [ ] Budget vs. Actuals page: selecting a budget renders
      Budget / Actual / Variance columns per account per period;
      drill-down from any cell opens Transaction Detail filtered
      to that account + period + tag.
- [ ] Company-wide (no-tag) budget: actuals pull from every split
      regardless of tag.
- [ ] Tag-scoped budget: actuals pull only from splits whose
      `tag_id` matches the budget's tag.
- [ ] CSV export of Budget vs. Actuals matches the on-screen data
      to the cent.

---

## 5. Reports (behind `TAGS_SPLIT_LEVEL_V2`)

For every tag-filtered report below, run once with no filter and
once with a specific tag. Sum of per-tag runs + untagged delta
must equal the unfiltered total to the cent (parity check).

- [ ] Profit & Loss (line-level semantic)
- [ ] Balance Sheet (line-level semantic)
- [ ] Cash Flow Statement
- [ ] General Ledger
- [ ] Trial Balance
- [ ] Transaction Detail / Journal Report
- [ ] Account Transactions / Account Detail
- [ ] AR Aging (header semantic — invoice stays whole if any line
      matches)
- [ ] AP Aging (header semantic)
- [ ] Sales by Customer
- [ ] Sales by Item
- [ ] Expenses by Vendor
- [ ] Expenses by Category
- [ ] Budget vs. Actuals
- [ ] Check Register

Reports explicitly excluded from the tag filter (confirm they
render unchanged with the flag on):

- [ ] 1099 report
- [ ] Sales Tax Liability / Taxable Sales Summary / Sales Tax Payments
- [ ] Customer Statement / Vendor Statement

Cache / export checks:

- [ ] `X-Report-Schema-Version` header on every report response
      reflects the post-cutover value.
- [ ] CSV / Excel exports include `line_tag` on line rows.
- [ ] Active-filter chip rendered on every filtered report; the
      export subtitle contains "(filtered by tag: <name>)".

---

## 6. Automation paths

- [ ] Recurring template with a header tag — post a cycle and
      confirm every generated line carries the template's tag.
- [ ] Recurring template edited to a per-line tag after migration
      — new cycles honor the per-line tags; the old header tag no
      longer overrides.
- [ ] AI categorization on a new bank feed item returns
      `tagId` per suggested split. Persists into
      `bank_feed_items.suggested_tag_id`.
- [ ] Voiding a transaction preserves the per-line tag in the
      reversing entry, so report parity still holds post-void.

---

## 7. Migration & backfill

- [ ] Dry-run the chunked backfill against a staging snapshot with
      ≥1M bank feed items. Worker logs one `processed=10000` line
      per chunk; no long transaction locks held on the
      `bank_feed_items` table (pg_stat_activity).
- [ ] Re-run the backfill — it is a no-op (zero rows updated),
      proving idempotency.
- [ ] Rollback drill: apply `0059_split_level_tags.rollback.sql`
      against a scratch DB, confirm the header-level junction
      still renders reports correctly.

---

## 8. Sign-off

Signed off by: ____________________  Date: __________

Build SHA: ____________________

Notes / exceptions:
