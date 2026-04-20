# Tag Budgets and Budget vs. Actuals

**Audience:** bookkeepers or owners planning a fiscal year, and anyone
comparing actual performance to a plan.

A **budget** in Vibe MyBooks is a plan for revenue and expense accounts
across a fiscal year. A **tag-scoped budget** is a plan for the slice of
activity carrying one tag — e.g., a Q2 product launch, a specific property,
or a consulting department.

## Company-wide vs. tag-scoped

- **Company-wide budget** — covers every transaction. Tag is left empty.
- **Tag-scoped budget** — covers only lines tagged with the selected tag.
  The Budget vs. Actuals report automatically filters actuals to that tag;
  you don't add a tag filter on top.

You can run both at the same time. A company-wide 2026 plan and a
"Project Apollo 2026" tag-scoped plan coexist without fighting — each
reports against its own scope.

You can also keep **multiple budgets** for the same tag and fiscal year
(e.g., Conservative vs. Aggressive scenarios). Pick which one the report
runs against at report time.

## Creating a budget

1. Go to **Budgets** → **New budget**.
2. Pick a **Fiscal year start**. Use any date — non-calendar fiscal years
   (June-end, September-end) are supported.
3. Pick a **Period type**:
   - **Monthly** — 12 cells per account.
   - **Quarterly** — 4 cells per account.
   - **Annual** — 1 cell per account.
4. Optionally pick a **Tag** to scope the budget. Leave empty for company-wide.
5. Give the budget a name. Names are unique per tenant per fiscal-year start,
   so use the name to distinguish scenarios ("2026 Plan — Conservative").
6. Pick a status: **Draft** (planning), **Active** (in use), **Archived**
   (historical).
7. Save.

The editor opens on an empty grid.

## Quick-setup options

After creating a budget, the editor offers four starting points:

- **Start blank** — all cells empty.
- **Copy last year's budget** — visible when a prior-year budget with the
  same period type exists. Copies line-for-line.
- **Use last year's actuals** — pre-fills each cell with what actually posted
  to that account in the corresponding prior-year period, filtered to the
  same tag scope.
- **Actuals + Growth** — same as above, adjusted by a percentage you enter
  (positive or negative).

Use "Actuals + Growth" for "Do last year again, but +5%" in one click.

## Bulk actions

- **Adjust by percent** — multiplies every cell by `1 + pct/100`. Handy for
  applying a blanket cut or bump after the fact. Use negative values to
  decrease.
- **Hide zero rows** — toggles visibility of accounts with no budget amounts
  set. Useful on crowded grids where most revenue accounts are expense-
  focused budgets.

## Running Budget vs. Actuals

1. Go to **Reports → Budget vs. Actuals**.
2. Pick the budget to compare against. The report picks up its fiscal year,
   period type, and tag scope automatically.
3. Each cell shows Budget / Actual / Variance / Variance %.

Variance is sign-adjusted so that **positive is always "good"**:

- Revenue accounts: `Actual − Budget` (beating plan → positive).
- Expense accounts: `Budget − Actual` (spending less than planned →
  positive).

Variance % is `Variance ÷ |Budget|`. When the budget cell is 0, the percent
shows as `—` because it would otherwise divide by zero.

### Drill-through

Click any cell to open the Transactions list filtered by:

- That row's account.
- That cell's period date range.
- The budget's tag (if the budget is tag-scoped).

This is how you answer "why did Meals blow the budget in March?" — one click
gets you the list of transactions that made the Actual what it is.

### CSV export

The **Download** button on the report exports the whole grid as CSV, with
one row per account and triple columns (Budget / Actual / Variance) per
period plus row totals.

## The reconciliation rule

For any company-wide annual budget with a single account, the Budget vs.
Actuals Actual must match the P&L total for that account/year to the cent.
A parity test runs continuously in CI to catch drift. If you see a mismatch
in production, file it — the calculation is not supposed to drift from
other reports.

## Authorization

- **Admin:** read, write, delete.
- **Bookkeeper:** read and write. Archive is allowed; delete is not.
- **Viewer:** read only.
- **External client portal users:** no budget access. Budgets are internal
  artifacts.

## Subaccounts

At V1, budgets are set at the account level, not the subaccount level. If
your chart of accounts has subaccounts, their actuals roll up to the parent
account for the purposes of Budget vs. Actuals. The editor calls this out
inline so you don't expect a per-subaccount grid.

## Deleting a budget

To prevent fat-fingered loss:

1. **Archive** the budget first.
2. Only archived budgets can be deleted.

Archiving is reversible (archive ↔ active); deleting is not.

## Common questions

**Q. My Budget vs. Actuals number doesn't match the P&L.**
A. Almost always one of these:
- The budget is tag-scoped and the P&L is not (or vice versa).
- The P&L is company-wide but the budget covers a narrower period.
- Subaccount roll-up is surprising you — check whether the account in the
  budget has children that are capturing the activity.

If you've ruled those out, file a bug — the reports are supposed to
reconcile to the cent.

**Q. Can a budget span more than one fiscal year?**
A. No. Budgets are fiscal-year scoped. For multi-year planning, create one
budget per fiscal year and run the reports side by side.

**Q. Can I set a budget by customer or by job?**
A. Not directly, but you can set a tag per customer/job and scope a budget
to that tag. That's the intended pattern.

**Q. Why can't I change period type after saving?**
A. Period type and fiscal-year start are fixed once the budget exists —
changing them would silently re-interpret every cell's date range. Create
a new budget instead.

**Q. An archived tag shows up in the Tag picker on the budget form.**
A. Only active tags are selectable for new budgets. If you see an archived
tag in the picker, file a bug.
