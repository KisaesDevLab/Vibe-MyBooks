# End-User Help — Tag Changes

Internal help articles for customer-facing support. Audience is the person using
Vibe MyBooks day to day (bookkeeper, CPA, solo owner), not the developer.

These articles describe the tag workstream shipped on
`feat/split-level-tags-v2`. They are written to be copy-pasteable into a support
reply or lifted into an in-app help drawer.

## What changed in plain language

Before, a tag applied to a **whole transaction**. After, each **line** on a
transaction carries its own tag. That change makes everything else in this
folder possible: per-line tagging, line-aware reports, tag-scoped budgets, and
default tags that fill themselves in from Items, Vendors, and bank rules.

## Articles

1. [Tags on every line](tags-on-every-line.md) — what moved and what it means
   for existing transactions.
2. [How default tags get picked](tag-defaults.md) — the precedence chain and
   stickiness rules.
3. [Setting default tags on Items, Vendors, and Bank Rules](setting-default-tags.md)
   — one-time setup that saves typing on every transaction.
4. [Entering splits with the new row layout](entering-splits.md) — the two-line
   split row, keyboard model, and Apply-to-all.
5. [Filtering reports by tag](tag-filtered-reports.md) — what "filter by tag"
   means on each report, and which reports don't offer it.
6. [Tag Budgets and Budget vs. Actuals](tag-budgets.md) — scoping a budget to a
   tag, quick-setup options, and reading the report.
7. [Managing tags](managing-tags.md) — create, archive, rename, merge, and
   delete, including what to do when deletion is blocked.

## For support staff

- If a customer asks "why did the tag disappear from my transaction?", start
  with [Tags on every line](tags-on-every-line.md). The header tag is now a
  derived value — it shows up only when every line shares a tag.
- If a customer asks "why is my Budget vs. Actuals number different from the
  P&L?", it is almost always a tag-scope mismatch. See
  [Tag Budgets](tag-budgets.md) for the reconciliation rule.
- If a customer can't delete a tag, point them at
  [Managing tags](managing-tags.md) — deletion is blocked while the tag is
  referenced anywhere, and Merge is the usual answer.
