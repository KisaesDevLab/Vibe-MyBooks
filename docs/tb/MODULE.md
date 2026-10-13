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
| Leadsheets | `/tb/leadsheets` | Grouping tree (renamable), per-group workpaper (basis toggle), tickmarks, notes, sign-offs (all per period end) with staleness + attribution, per-leadsheet PDF, per-row PDF attachments ref-coded A001… per period end with click-to-place tickmark stamps burned at download |
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

## Decision log

### 2026-10-13 — Tickmarks, notes and sign-offs are period-end scoped (migration 0208)

Requested by Kurt (owner): "make the tickmarks tied to the period end of
the trial balance." Binding decisions:

1. `tb_tickmark_applications`, `tb_notes` and `tb_leadsheet_signoffs`
   gain `period_end DATE NOT NULL` — the workpaper period end (the TB
   as-of date in the TB / Leadsheets header date box), the same notion
   `tb_row_attachments` already used (0150). A mark, note or sign-off
   made on 08/31 never appears on 07/31 and vice versa. The tickmark
   LIBRARY (`tb_tickmarks`) stays shared across periods.
2. **No roll-forward.** A new period end starts blank; there is no
   copy/ghost UI.
3. `tax_year` stays on all three tables as a **derived** column
   (`taxYearOf(period_end, companies.fiscal_year_start_month)`, computed
   server-side on write; a client-supplied `taxYear` is ignored) for
   indexing/back-compat. Every reader filters on `period_end`.
4. Sign-off uniqueness is one live row per `(grouping_id, period_end,
   role)` (index `uniq_tb_leadsheet_signoffs_live` replaced). Order rule
   (preparer before reviewer), re-sign invalidation and staleness (GL
   version stamp) all work within one period end; signing 08/31 does
   not satisfy 07/31.
5. `tb_status` remains per **tax year**; its `complete` gate checks
   reviewer sign-offs on the tax year's **fiscal-year-end** period
   (`fiscalYearEnd(taxYear, fyStartMonth)`), so interim sign-offs do not
   complete the year (firm-admin override unchanged).
6. API: `GET /tb/tickmark-applications|notes|signoffs` take
   `?periodEnd=YYYY-MM-DD`; if omitted they fall back to the FY end of
   `?taxYear` (or of the current tax year) and echo the resolved
   `periodEnd`/`taxYear` in the response. `POST` on all three
   **requires** `periodEnd` (400 otherwise; invalid calendar dates are
   rejected). The web always sends `periodEnd`; the popout receives the
   main window's period end via `?periodEnd=`.
7. Readers switched to the period end: TB grid + popout + cell picker,
   Leadsheets screen, TB report family (workpaper, grouped, leadsheets
   PDF/CSV incl. legend, workpaper index counts) — which also covers TB
   Download and Report Packs since they call the same builders with the
   pack/report end date. The financial-statements builder, close review
   and portal read none of these tables (verified).
8. Backfill (in 0208): existing tickmark applications with
   `tax_year = 2026` → **2026-07-31** (owner's explicit choice for the 4
   prod marks), applied only where 07/31/2026 actually falls inside
   TY2026 for that company (FY start month 1 or 8–12); every other
   tickmark application, every note, and every sign-off (incl.
   invalidated ones) → the fiscal-year end of its tax year, computed in
   SQL exactly like `fiscalYearEnd()` / 0150. Rows whose company row is
   gone, or whose FY start month is NULL, are treated as calendar-year.
   Rollback (`0208_….rollback.sql`) is lossy by nature: it invalidates
   all but the newest live sign-off per (grouping, tax_year, role) before
   restoring the tax-year index, and merges period marks/notes back into
   their tax year.
