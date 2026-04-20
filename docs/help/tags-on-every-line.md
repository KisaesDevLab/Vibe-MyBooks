# Tags on every line

**Audience:** anyone who used tags before this release.

## What changed

Tags used to live on the **transaction** — one tag per bill, invoice, expense,
or check, shared across every line. Starting with this release, tags live on
each **split line**. A single expense with three lines can now carry three
different tags.

This matches how QuickBooks Classes and Xero Tracking Categories work, and it's
what makes accurate project-level and property-level reporting possible.

## What you'll see on existing transactions

- **Every existing line keeps its tag.** If an old transaction had one tag,
  every line on that transaction now carries that same tag. Nothing has been
  lost; the backfill is idempotent and was verified line-by-line before the
  change went live.
- **The transaction header still shows a tag — sometimes.** When every line on
  a transaction shares one tag, the header shows that tag as a summary. When
  the lines disagree (e.g., line 1 is "Project A" and line 2 is "Project B"),
  the header shows no tag. This is intentional: a header tag that contradicts
  the lines would be misleading.
- **Reports that filtered on the old header tag keep working.** The filter is
  rewritten to ask "does any line on this transaction carry this tag?" — same
  behavior users expect, now implemented against the line-level data.

## What's new you can do

1. **Split a single receipt across projects.** A Home Depot run that covers
   Office Supplies for HQ and Materials for a job site can now tag each line
   separately.
2. **Get accurate segment P&L.** A tag-filtered P&L now sums only the matching
   lines, not the whole transaction.
3. **AI categorization assigns tags per line.** If you use receipt OCR or AI
   categorization, the AI can propose different tags for different lines of
   the same transaction.
4. **Budget against a tag.** See [Tag Budgets](tag-budgets.md).

## What's not changing

- **Tags themselves.** The tags you've created, their colors, and their groups
  are unchanged.
- **Tag permissions.** The same roles that could tag before can tag now.
- **1099, Sales Tax, and Customer/Vendor statements** do not have a tag filter
  and never will — those reports are entity- or jurisdiction-driven, not
  segment-driven. See [Filtering reports by tag](tag-filtered-reports.md).

## Common questions

**Q. Can a single line have two tags?**
A. Not in this release. One tag per line. Multi-tag may arrive later; the data
model has been chosen so that adding it won't require a re-migration.

**Q. Do I have to go back and re-tag my history?**
A. No. Historical transactions keep their tags exactly as they were.

**Q. If I change a tag on a line, does it update old transactions?**
A. No. Tag defaults apply to **new** lines only. Changing the default tag on an
Item or Vendor does not retroactively re-tag historical lines.

**Q. What happens if I delete a tag?**
A. You can't delete a tag that is in use. See [Managing tags](managing-tags.md).
