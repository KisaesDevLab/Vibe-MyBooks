# Filtering reports by tag

**Audience:** anyone running reports for a single project, property,
department, or other tag.

Most reports now let you filter by a single tag. The filter behaves
differently on different reports — always consistent with what you'd expect
the report to mean, but worth knowing so you can read the numbers correctly.

## Two kinds of reports, two different semantics

### Line-level reports: matching lines only

These reports hide non-matching lines and sum only what matches.

- **Profit & Loss**
- **Balance Sheet**
- **Cash Flow**
- **General Ledger**
- **Transaction Detail** (a.k.a. Journal / Transaction List)
- **Trial Balance**
- **Account Transactions**

**Example.** An Expense has three lines: $100 tagged "Project A", $50 tagged
"Project B", $75 untagged. On a P&L filtered by "Project A", only the $100
line is included. The transaction still appears in the drill-down, but only
the matching line contributes to the totals.

### Header-level reports: whole transaction if any line matches

These reports return the full transaction amount if any line carries the
matching tag.

- **AR Aging**
- **AP Aging**
- **Sales by Customer** (summary)
- **Customer Balance Detail**
- **Vendor Balance Detail**

**Example.** An Invoice totals $500 with one line tagged "Project A" for $100
and the rest untagged. On an AR Aging filtered by "Project A", the Invoice
appears at its full $500 balance — the filter is a "does this invoice touch
Project A at all" question, not a line-by-line sum.

This is the right behavior for aging reports, because you don't want to look
at "$100 is 30 days overdue" when the real receivable is $500 against a
customer who owes for a project you're chasing.

### Reports that do not offer a tag filter

Three report families don't have a tag filter, by design:

- **1099 report** — IRS reporting is entity-level. Tag filtering would produce
  misleading totals that don't match the vendor's reportable payments.
- **Sales tax reports** — jurisdiction-driven, not segment-driven. A tag can't
  change what you owe to a state.
- **Customer / Vendor Statements** — external-facing documents. An outside
  party shouldn't see a slice of their own activity filtered by your internal
  segment.

These are deliberate product decisions, not missing features.

## Running a tag-filtered report

1. Open the report.
2. Use the **Tag** filter in the report header.
3. Pick a single tag. (Multi-select is not supported in this release.)
4. The report reruns; an active-filter chip appears at the top and
   exports carry a "Filtered by tag: *Tag Name*" subtitle.

Clear the filter by removing the chip or choosing "All tags".

## Exports

- CSV and Excel line-level exports include a new `line_tag` column so each
  line carries its tag explicitly.
- Every filtered export includes the "Filtered by tag" subtitle on the first
  metadata row so the recipient can tell the report is a slice.

## Budget vs. Actuals is automatically scoped

If a budget is tag-scoped, its Budget vs. Actuals report already filters by
that tag — you don't add a tag filter on top. See
[Tag Budgets](tag-budgets.md).

## Common questions

**Q. Why is my P&L smaller than expected after applying a tag filter?**
A. A tag filter on a line-level report sums only the matching lines. If your
transactions aren't fully tagged (e.g., only the income side is tagged on a
mixed-purpose transaction), the untagged lines don't contribute. Run the P&L
without a filter to confirm the full picture, then inspect the transactions
for missing tags.

**Q. Why is my AR Aging showing a big balance for a project tag, when only
$100 of the invoice is tagged?**
A. AR Aging is a header-level report — the filter asks "does this invoice
touch the tag at all?" and if yes, shows the full balance. This is correct
behavior for aging reports.

**Q. Can I filter by two tags at once?**
A. Not in this release. You can save two separate filtered reports and compare
them, or run the reports against each tag in turn. Multi-select is on the
follow-up list.

**Q. Will the totals be different after the upgrade?**
A. Company-wide totals (no filter) are unchanged. Tag-filtered totals are
strictly more accurate than before — the old filter was a crude
whole-transaction match, the new filter actually sums the matching lines. A
parity test runs in CI to confirm no-filter totals match pre-migration to the
cent.
