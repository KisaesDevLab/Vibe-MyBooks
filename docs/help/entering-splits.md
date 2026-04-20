# Entering splits with the new row layout

**Audience:** anyone entering expenses, bills, checks, deposits, invoices,
sales receipts, or journal entries.

## The two-line split row

Every entry form now uses a shared split row that takes two visual lines per
logical split:

```
┌─────────────────────────────────────────────────────────────┐
│ [Category ▾  ] [Amount $       ] [extras …]   [⎘] [×]       │  Line 1
│ [Description …………………………………]  [Tag ▾            ]            │  Line 2
└─────────────────────────────────────────────────────────────┘
```

- **Line 1** holds the essentials: Category (or Account), Amount, and any
  type-specific fields (Qty/Rate on Invoice and Cash Sale; Debit/Credit on
  Journal Entry; Payment Method on Deposit; Billable/Customer on Expense).
- **Line 2** holds the secondaries that don't compete with the amount:
  Description and Tag.

The two lines read as one unit — a single logical split. Row actions
(duplicate, delete) sit at the far right of Line 1 so they don't compete with
data entry.

## What this fixes

- **Amount no longer clips.** Even $9,999,999.99 shows in full at standard
  viewport widths.
- **Tag always has a dedicated spot.** No need to reshuffle columns or scroll
  sideways.
- **Description gets its own line** instead of stealing width from Amount.

## Keyboard model

| Key                          | What it does                                     |
|------------------------------|--------------------------------------------------|
| `Tab`                        | Next field, left-to-right then down to Line 2    |
| `Shift+Tab`                  | Previous field                                   |
| `Enter` on Line 2's last field | Add a new split row, focus its Category field |
| `Ctrl/Cmd+D`                 | Duplicate the current row                        |
| `Ctrl/Cmd+Delete`            | Delete the current row (prompts if not empty)    |
| `Ctrl/Cmd+Shift+A` (on first row's Tag field) | Apply this tag to all untouched rows |
| `Ctrl/Cmd+Enter`             | Save the whole transaction (form-level)          |
| `Escape`                     | Blur the current field                           |

Arrow keys inside a text or number input move the cursor, not between rows.
To move between rows or between Line 1 and Line 2, use Tab.

**Row action buttons are deliberately not in the tab stop.** Including them
would add two Tab presses per row, which slows down bulk entry significantly.

## Apply to all

The Tag field on the **first** split row has an "Apply to all" affordance
next to it. It copies that row's tag to every subsequent row that has not been
touched.

- **Touched rows are not overwritten.** If you explicitly typed a tag or
  cleared the tag on row 3, Apply to all leaves row 3 alone.
- **Keyboard:** focus the first row's Tag field and press `Ctrl/Cmd+Shift+A`.
- **To force-overwrite a row:** clear its tag manually first, then run Apply
  to all. (A single "force apply to every row" action isn't offered — it's
  too easy to lose deliberate work.)

See [How default tags get picked](tag-defaults.md) for the full stickiness
rules.

## Journal Entry

The JE page uses the same row component with a wider container so Account,
Debit, and Credit all fit on Line 1, with Memo and Tag on Line 2. The page
is deliberately not a separate full-screen redesign.

## Batch Entry

Batch Entry stays as a single-line grid. It's optimized for speed entry where
the two-line layout would halve throughput. You can still tag per line; the
column is just always visible with no secondary line.

## Register inline entry

The inline-entry row at the top of a register uses the two-line layout at
**compact** density — lower row height for power users scanning a long
register. The Date field is wider than before so localized dates like
`12/31/2026` no longer clip.

## Mobile and narrow widths

On phone-width viewports the two-line layout stacks each field vertically
inside the row. This is strictly better than side-scrolling at small widths.

## Accessibility

- Every split row is announced as "Split N of M" when focus enters it.
- Adding, deleting, or duplicating a row is announced via a live region.
- Amount inputs have `inputmode="decimal"` for touch-keyboard users.
- Delete and Duplicate buttons have descriptive labels ("Delete split 2",
  "Duplicate split 2").

## Common questions

**Q. I miss the old single-line layout.**
A. The legacy layout was retained during rollout for one release to avoid
disruption, and has been removed. The keyboard model was designed so that the
most important muscle memory — `Enter` to add a row, `Tab` to advance — still
works the same way.

**Q. Every row just got taller. My 50-line JE is now a scrolling mess.**
A. The Register uses a compact density that's half the height. A per-user
density preference for the main forms is on the follow-up list. In the
meantime, if you regularly enter 50+ line JEs, Batch Entry may be a better
surface — it's a single-line grid by design.

**Q. The tag auto-filled itself when I picked an Item. Why?**
A. The Item has a default tag. See
[Setting default tags](setting-default-tags.md) to understand where defaults
come from and how to change them.
