# Trial Balance module

Firm-side tax-preparation workpapers computed live from the MyBooks
general ledger. Enabled per tenant via the `TRIAL_BALANCE_V1` feature
flag (Admin → Feature Flags); registered in the module manifest as
`tb: base` (PolyForm Internal Use — no commercial gate).

> **Supersedes the planned MyBooks ↔ Vibe TB API integration.** Vibe TB
> remains the standalone product for external-books clients; no sync
> between the two exists or will be built. The tax-code seed shares the
> Vibe TB crosswalk format so the mapping is maintained once.

## Surfaces

| Surface | Route | What it does |
|---|---|---|
| Workpaper | `/tb/workpaper` | Five-column TB (Unadjusted → AJE → Adjusted → Tax RJE → Tax), basis + PY toggles, inline tax-code assignment, diagnostics, drill-down, workflow status, popout launcher |
| Tax Mapping | `/tb/mapping` | Mapping-focused pass: progress bar, unmapped/mapped filters, per-account code picker with source + confidence badges, AI auto-assign panel |
| Live popout | `/tb/popout` | Live TB in its own window (BroadcastChannel + SSE + poll refresh, diff-flash); Adjusted/Tax amount clicks open the tickmark popup |
| Adjusting entries | `/tb/ajes` | Firm-only AJE register + form; AJE-001 per client per FY; reverse/duplicate/void |
| Tax adjustments | `/tb/tax-entries` | Tax-basis-only RJEs (never touch the GL); RJE-001 per tax year; M-1 flags |
| Leadsheets | `/tb/leadsheets` | Grouping tree (renamable), per-group workpaper (basis toggle), tickmarks, notes, sign-offs with staleness + attribution, per-leadsheet PDF, per-row PDF attachments ref-coded A001… per tax year with click-to-place tickmark stamps burned at download |
| Schedule M-1/M-2 | `/tb/m1` | Book→tax bridge + equity rollforward with role mapping |
| TB Reports | `/tb/reports` | 14-report family (incl. Leadsheets), CSV/PDF, all in Report Packs too |
| Tax Exports | `/tb/exports` | UltraTax / Lacerte / CCH / GoSystem / generic CSV / Excel working TB with validation gates + history |
| TB Settings | `/tb/settings` | Tax profile, closing date, activity units, tag mapping, tickmark library, firm custom codes |
| Seed admin | `/admin/tax-codes` | Super-admin tax-code seed library (versioned imports, dry-run diff, per-code CRUD with in-use guards, Excel download in the re-importable seed layout) |

## Operating notes

- Seed the tax-code library once per install:
  `npm run seed:tax-codes -w @kis-books/api -- 2025` (or upload the
  xlsx at `/admin/tax-codes`). Annual updates import as a NEW version;
  entities pin or float per ADR-TB-05.
- The closing date IS `companies.lock_date`; ADR-TB-04 semantics
  (423 + firm override + audit) live at the ledger choke point.
- Export format layouts are documented in `docs/tb/exports/README.md`
  and must be verified against current vendor import specs before
  first client use.
- Architecture decisions and invariants: CLAUDE.md rules TB1–TB13
  (local), full plan in `docs/tb/BUILD_PLAN.md` (local).
