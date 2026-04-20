# Managing tags

**Audience:** anyone creating, renaming, archiving, merging, or deleting tags.

Tag Manager is at **Settings → Tags** (or wherever your tenant has it
surfaced). Every action here is tenant-scoped — your tags don't mix with
anyone else's.

## Create a tag

1. Click **New Tag**.
2. Enter a **Name** (required).
3. Pick a **Color** from the palette — this is what shows up on tag chips
   across the app.
4. Optionally assign the tag to a **Group** (see below).
5. Click **Create**.

## Groups

A **Tag Group** is an organizational container for related tags. Two things
to know:

- **Single-select groups** — when checked, a transaction line can carry at
  most one tag from that group. This doesn't prevent line-level tagging in
  general; it prevents two tags from the *same group* on one line. Useful
  for things like "Region" where a line can only belong to one region.
- **Groups are visual only when not single-select.** They help users find
  the tag they want in a long list.

Create a group with **New Group**. Groups can be deleted; their tags become
ungrouped.

## Rename or recolor a tag

Hover a tag row in Tag Manager and use the inline edit affordance. Renaming
a tag updates the tag name everywhere — historical transactions, budgets,
item and vendor defaults, bank rules, reports — because they all reference
the tag by ID, not by name.

## Activate / deactivate (archive)

- **Deactivating** a tag hides it from tag pickers on new entry and from new
  budget scoping. Existing references remain intact.
- **Reactivating** brings it back everywhere.

Use deactivation when a tag has served its purpose (e.g., a completed
project) but historical transactions must still show it correctly.

## Merge two tags

**Merge** re-tags every reference from a source tag to a target tag, then
deletes the source. Use it to consolidate duplicates ("Marketing" and
"marketing ") or to retire a finer-grained tag in favor of a broader one.

1. Click **Merge** at the top of Tag Manager.
2. Pick the **Source** (the tag to remove).
3. Pick the **Target** (the tag that stays).
4. Confirm.

All transactions, budgets, item/vendor defaults, and bank rules are
re-pointed to the target in one database transaction. No history is lost —
the activity tagged with the source is now tagged with the target.

## Delete a tag

Deletion is **blocked while the tag is in use**. This is deliberate: silently
breaking historical references is never the right answer.

When you click Delete on a tag, a dialog shows a live usage snapshot:

- Transaction lines
- Transactions referencing it at the header level
- Budgets scoped to it
- Items with it as a default
- Vendors with it as a default
- Customers referencing it
- Bank Rules assigning it

If any of those are non-zero, Delete is disabled and the dialog offers
**Merge into another tag** instead. Merge is almost always the right move.

If every count is zero — typically because the tag was created, left
unused, and is being cleaned up — Delete is enabled and removes the tag.

### If you really need to delete an in-use tag

1. Clear its references first:
   - Reassign any Item or Vendor defaults.
   - Remove the Assign-Tag action from any Bank Rule.
   - Archive or delete any Budget scoped to it (Budgets must be archived
     before they can be deleted).
   - For transaction lines, either re-tag them manually or merge the source
     tag into a target tag. Merge is faster.
2. Reopen the Delete dialog. When every count is zero, Delete is enabled.

## Usage count in the list

Each tag row shows a "N uses" count reflecting the rolled-up reference total
across the surfaces above. This is a quick check for orphans — tags with 0
uses are candidates for deletion.

## Common questions

**Q. I renamed a tag but old reports still show the old name.**
A. Refresh the page. All references are by ID, so the new name shows
everywhere on the next fetch. If a cached export still has the old name,
re-export.

**Q. Why can't I just delete the tag? I'll accept the history losing its
tag.**
A. Because the delete would silently strip tags from potentially thousands
of historical lines — a data-integrity problem that's hard to undo. Merge
gives the same result (tag gone from the list, history re-pointed) without
that risk. If a "destructive delete" ever becomes necessary, it will be a
separate action with a stronger confirmation.

**Q. I deactivated a tag. Why do old transactions still show it?**
A. Deactivation hides the tag from new-entry pickers and new budget scoping;
it does not re-tag history. That's by design. To remove the tag from
history, merge it into another tag.

**Q. My merge failed.**
A. Merge runs in a single database transaction; if it fails, nothing
changed. Common causes: the source tag was already deleted from another
session, or the target was archived mid-operation. Retry after refreshing.
If it keeps failing, file a bug with the two tag IDs.

**Q. Who can manage tags?**
A. Admins have full access. Bookkeepers can create, rename, and merge.
Viewers cannot edit tags. Check your tenant's role mapping if this doesn't
match what you see.
