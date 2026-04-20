# Setting default tags on Items, Vendors, and Bank Rules

**Audience:** admins or bookkeepers doing one-time setup to cut down on tag
typing.

You can attach a default tag to three settings objects. Each one pre-fills the
tag on new lines, overridable by anything more specific (see
[How default tags get picked](tag-defaults.md) for the precedence).

All three default sources are **optional and empty by default**. You only need
to set them where it saves real work.

---

## Item default tag

Setting an Item's default tag means that every time a user adds a line
referencing that Item, the line is pre-tagged.

**Good candidates:**

- Service items tied to a specific department ("Consulting" → Consulting tag).
- Product items from a specific project or event inventory.
- Recurring subscription line items that always belong to one cost center.

**Where to set it:**

1. Go to **Items** (or **Products & Services**).
2. Open the Item for edit (or create a new one).
3. In the Accounting defaults section, set **Default Tag**.
4. Save.

From then on, any new line referencing this Item pre-fills the tag.

**Where it does NOT apply:**

- Existing lines. Changing this field does not retroactively tag historical
  transactions.
- Lines where the user explicitly picks a different tag or clears the tag.
- Lines where a Bank Rule or AI suggestion overrides it (those sit higher in
  the precedence).

---

## Vendor default tag

Setting a Vendor's default tag means that every new transaction with that
Vendor pre-fills the tag on every new line.

**Good candidates:**

- A contractor who only ever works on one project.
- A utility whose cost always belongs to one property.
- A subscription vendor tied to a single department.

**Where to set it:**

1. Go to **Vendors** (or **Contacts → Vendors**).
2. Open the Vendor for edit (or create a new one).
3. In the Accounting defaults section, set **Default Tag**.
4. Save.

**Caveat:** a Vendor default applies across every line of the transaction by
default, but is lower priority than the Item default. If a Vendor is
"Acme Supplies" with Vendor default "Operations", and a line uses an Item with
default "Project A", that line gets "Project A" — the more specific default
wins.

---

## Bank Rule "Assign Tag" action

Bank Rules run automatically on incoming bank feed transactions. They can now
assign a tag in addition to assigning a category.

**Good candidates:**

- A rule that matches "STRIPE FEES" and assigns the Stripe tag.
- A rule that matches a specific gas station and assigns a Vehicle tag.
- A rule that matches a property management transfer and assigns the property
  tag.

**Where to set it:**

1. Go to **Banking → Rules** (or **Bank Rules**).
2. Open a rule for edit (or create a new rule).
3. In the **Actions** section, add or edit the **Assign Tag** action and pick a
   tag.
4. Save the rule.

When a feed transaction matches the rule, the tag is stamped on every line
produced during categorization. Bank Rules beat Item and Vendor defaults but
still yield to explicit entry.

**Tiebreak:** if two rules both match, the first match (by rule priority)
wins, same as how existing category-assignment tiebreaks work.

---

## Not in scope

- **Customer default tag** — intentionally not supported. It creates ambiguity
  on AR transactions (an invoice's customer and its line items have different
  tag expectations) and has not been requested.
- **Account-level default tag** — intentionally not supported. Users think of
  tags as project or segment properties, not account properties. Ask if you
  need this and we'll revisit.

## Common questions

**Q. I set a default tag on an Item, but an old transaction using that Item
isn't tagged.**
A. Correct. Default tags apply to **new** lines only. To tag history, open the
transaction and tag the lines manually, or use Merge (see
[Managing tags](managing-tags.md)) if the goal is to consolidate.

**Q. My Vendor default is being ignored.**
A. Check whether the line has an Item with its own default tag, or whether a
Bank Rule or AI suggestion fired. Any of those outrank Vendor. Hover the tag
chip to see the source if shown.

**Q. I want to change every line that uses Tag A to Tag B.**
A. Use the **Merge tags** action on the Tag Manager page. That's the
tag-level action designed for exactly this.
