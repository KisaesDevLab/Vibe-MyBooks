# How default tags get picked

**Audience:** anyone who wonders why a tag appeared on a new line they didn't
type into, or why a tag they cleared came back.

When you add a new line to any transaction, Vibe MyBooks pre-fills a default
tag so you don't have to type one every time. The default comes from one of a
few places, in a fixed order.

## Precedence, most specific wins

1. **What you typed on the line itself.**
2. **A matching Bank Rule** (if the transaction came from a bank feed and a
   rule fired).
3. **An AI suggestion** (if AI categorization proposed a tag for this line).
4. **The Item's default tag** (if the line references an Item that has one).
5. **The Vendor's default tag** (if the transaction's Vendor has one).
6. **No tag.**

The resolver walks the list top-down and stops at the first thing that's set.
A user-authored bank rule beats a blanket Item default because you took the
trouble to write the rule. An Item default beats a Vendor default because the
Item is more specific than the Vendor selling it.

## Explicit entry always wins

Once you touch a line's tag field — by typing into it, picking from the list,
or clearing it — that line's tag stops listening to defaults.

- **Typed a tag?** It sticks. Changing the Item or Vendor on that line does not
  overwrite your tag.
- **Cleared the tag deliberately?** The blank sticks. The Item or Vendor
  default will not come back to fill it in.
- **Never touched the field?** The default rebuilds whenever the Item or
  Vendor on the line changes.

This is the **stickiness rule**. It exists so that a late edit (e.g., swapping
a misspelled Vendor) never silently overwrites a tag you had reviewed and
approved.

## "Apply to all lines" respects stickiness

In the two-line split row, the first row's Tag field has an **Apply to all**
affordance (keyboard: `Ctrl+Shift+A` while focused on that first Tag field).
It copies the first row's tag only to rows that haven't been touched. Rows
where you explicitly picked or cleared a tag are left alone.

If that's not what you want, clear the other rows' tags yourself first, then
Apply to all. A "force apply to every row" action is intentionally not
included — it's too easy to lose deliberate work.

## When you duplicate a transaction

- Lines that had a tag are duplicated **as touched** — the duplicate carries
  the same tag, and the stickiness rule is on.
- Lines that had no tag are duplicated **as untouched** — the duplicate picks
  up whatever default applies to the current Item/Vendor at the time of the
  duplicate, not what applied historically.

## Where this shows up

- **New Expense, Write Check, Enter Bill, Enter Vendor Credit**
- **New Invoice, New Cash Sale, New Deposit**
- **Journal Entry**
- **Register inline entry** and **Batch Entry**
- **Bank-feed categorization** — when you accept or convert a bank feed item,
  the resolver runs with the matching rule's tag (if any) plugged in.
- **Recurring templates and duplication** — same resolver, same stickiness.

## Common questions

**Q. A tag showed up on a new line I didn't type into. Where did it come
from?**
A. Something earlier in the chain — a bank rule, AI suggestion, Item default,
or Vendor default — supplied it. Hover over the tag chip on the line for a
tooltip indicating the source (when available). To change it, just type a new
one or clear the field; that locks the line to your choice.

**Q. I cleared the tag and it came back on save.**
A. That usually means the field wasn't recognized as "touched" — for example,
if the clear happened inside a duplicated row where stickiness was already
off. Type a tag and clear it again; the empty state should stick the second
time. If it still comes back, file a bug with the exact steps.

**Q. Can I set a precedence different from the one above?**
A. Not in this release. Precedence is fixed everywhere so the same line behaves
the same whether it's typed on the Expense form, suggested by the AI, or
converted from a bank feed.
