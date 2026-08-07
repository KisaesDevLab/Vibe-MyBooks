# TB vendor export formats (plan 11.2)

Format assumptions for each tax-software import file. **Verify each
against the vendor's current import spec (or the Vibe TB crosswalk
workpapers) before first client use** — vendors revise import layouts
between tax years. The crosswalk columns come from the tax-code seed
(`ultratax_code`, `cch_code`, `lacerte_code`, `gosystem_code`,
`generic_code`).

| Software | File | Layout | Notes |
|---|---|---|---|
| UltraTax CS | `.xlsx` | `Tax Code, Description, Unit, Amount` — one row per (UltraTax code, activity unit) | UltraTax's Excel/ASCII import keys on its numeric tax codes; activity units map to the form-unit number. Amounts are tax-basis (Adjusted + RJE). |
| Lacerte | `.csv` | `code, description, amount` | Lacerte import codes are screen/line references (e.g. `01A`). |
| CCH Axcess | `.csv` | `code, description, amount` | CCH interview-form codes (e.g. `10200.0000`). |
| GoSystem RS | `.csv` | `code, description, amount` | GoSystem field codes (e.g. `30-100`). |
| Generic | `.csv` | `tax_code, description, …crosswalk…, activity_unit, amount` — one row per (code, unit, account) | Full-detail export for any other software or review. |
| Working TB | `.xlsx` | Five columns + tax code, sectioned by account type with subtotals | The CPA-facing Excel workpaper (11.7a), not a vendor import. |

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
