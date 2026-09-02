# TB vendor export formats (plan 11.2)

Format assumptions for each tax-software import file. **Verify each
against the vendor's current import spec (or the Vibe TB crosswalk
workpapers) before first client use** — vendors revise import layouts
between tax years. The crosswalk columns come from the tax-code seed
(`ultratax_code`, `cch_code`, `lacerte_code`, `gosystem_code`,
`generic_code`).

| Software | File | Sheet | Layout | Notes |
|---|---|---|---|---|
| UltraTax CS | `.xlsx` | `UltraTax CS Export` | `AccountNumber, AccountName, TaxCode, Book Basis Amt, Tax Basis Amt` — one row per account | `TaxCode` = the seed's `ultratax_code` crosswalk. |
| CCH Axcess | `.xlsx` | `CCH Axcess Export` | `AccountNumber, AccountName, CCHCode, Description, Book Basis Amt, Tax Basis Amt` | Header not centered (reference quirk). |
| Lacerte | `.xlsx` | `Lacerte Export` | `LineCode, Description, Book Basis Amt, Tax Basis Amt` | `Description` is the ACCOUNT name; no account-number column. |
| GoSystem Tax RS | `.xlsx` | `GoSystem Tax RS Export` | same as Lacerte | Sheet/filename differ only. |
| Generic | `.xlsx` | `Generic Export` | `AccountNumber, AccountName, TaxCode, TaxDescription, Book Basis Amt, Tax Basis Amt` | Canonical code + description (no software crosswalk). |
| Working TB | `.xlsx` | `Working TB` | Five columns + tax code, sectioned by account type with subtotals | The CPA-facing Excel workpaper (11.7a), not a vendor import. Accepts the workpaper screen's activity view (`view.activityView`: `''` consolidated, `'tags'` by tag / unit # with a `Unit` column and unit-numbered account numbers — untagged and balance sheet = unit 0 — or a unit id), plus `periodEnd`, `tagId` and toolbar filters, so the screen's Download matches what's shown. The same options drive the `tb-workpaper` report (`activity_view`, `account_type`, `q`, `nonzero_only`). |

Shared conventions (byte-matched to the Vibe Trial Balance reference
implementation, `server/src/routes/exports.ts` there):

- **Account grain** — one row per account, ordered by account number
  ascending. When a book splits a P&L account across activity units,
  one row per unit slice with the unit number attached to the account
  number — suffix `6050-2` by default, or prefix `2-6050` when the tax
  profile's "Unit # on exports" is set to prepend. Balance sheet
  accounts are never segmented by tag/unit: they always export as a
  single row with the plain account number (a balance sheet cannot
  balance per activity, and Schedule L is entity-level).
- **Both bases** — every vendor file carries `Book Basis Amt`
  (Adjusted) and `Tax Basis Amt` (Adjusted + RJE); debits positive,
  credits negative, no normal-balance flip; `#,##0.00` number format.
- **Styling** — header row bold white on `FF1E3A5F`, frozen top row,
  workbook creator `Trial Balance App`; leading `= + - @ TAB CR` cells
  get an apostrophe guard (formula injection).
- **Consolidation** — checked tax codes collapse to ONE row whose
  AccountNumber/AccountName become the custom "Export as" values (the
  software code stays the tax line's). Consolidated rows are emitted
  first, ordered by tax-code sort order, then pass-through accounts. A
  consolidated identity colliding with a real account number is a 409
  `DUPLICATE_ACCOUNT`.

Validation gates before any vendor file generates (11.8):

- **Hard blocks** — unassigned accounts (with balances), tag-split gaps,
  and codes lacking a vendor code for the selected software (11.8a;
  resolve by reassigning, DONOTMAP, or filling the vendor code on the
  seed/firm code).
- **Firm-admin override only** — out-of-balance columns (11.8b);
  overrides are audit-logged and stamped on the export record.

Every export row records `gl_version_stamp` + `basis` at generation, so
the history list can show "generated before N subsequent GL changes"
(rule TB11). DONOTMAP lines are excluded from every vendor file.
