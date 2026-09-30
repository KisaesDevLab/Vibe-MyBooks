# Report-ready financial statements (FINANCIAL_STATEMENTS_V1)

Trial Balance → Financial Statements builds compilation-style statements
(balance sheet, income statement, equity, indirect-method cash flows, and
supplementary schedules) on top of the TB leadsheets, with a firm library
(letterhead, accountant's-report letters, style presets, layout templates),
Draft → Final versioning, PDF / DOCX / XLSX output and portal publishing.

## Where things live

| Piece | Location |
|---|---|
| Zod contracts (layout tree, style, settings, front matter) | `packages/shared/src/financial-statements/schemas.ts` |
| Engine (pure): claims, polarity, rounding plugs, schedules, equity, cash flows, checks | `packages/shared/src/financial-statements/engine/` |
| HTML renderer (preview + PDF) | `packages/shared/src/financial-statements/render/html.ts` |
| Fonts (SIL OFL, embedded) | `packages/api/assets/fs-fonts` (copied into the runtime image) |
| Source loader (TB workpaper → engine input) | `packages/api/src/services/tb/fs/fs-source.service.ts` |
| PDF / DOCX / XLSX | `fs-render.service.ts`, `fs-docx.service.ts`, `fs-xlsx.service.ts` |
| Finalize / versions / publish | `fs-issuance.service.ts` |
| Routes | `packages/api/src/routes/tb-fs.routes.ts` (mounted at `/api/v1/tb/fs`) |
| Web | `packages/web/src/features/tb/fs/` |

## Numbers

- Source = `computeWorkpaper` per period: Adjusted column (GAAP / cash) or
  Tax column (income tax basis). Openings always use Adjusted (tax RJEs are
  current-year only), surfaced as `TB_FS_TAX_PY_RJE`.
- Balance sheets are **closed**: fiscal-year-to-date P&L is folded into the
  retained-earnings fold account (system RE, else the virtual RE row).
- Month column = YTD − prior month-end YTD within the fiscal year.
- A tag filter applies to the income statement only; equity and cash flows
  are suppressed with `TB_FS_TAG_PARTIAL`.

## Rounding contract

Details are rounded half away from zero; each anchor (roles `total_assets`,
`total_liabilities_equity`, `net_income`, explicit anchors, schedule totals)
is settled innermost-first to `round(exact)` by plugging the difference to
the chosen line (default: the largest non-cash line). Net income is derived
from the rounded equity roll-forward (balance-sheet equity − rounded
beginning equity − rounded equity activity) so the income statement, equity
statement and cash flows show the same net income and every column foots.
Cash flows anchor ending cash to the balance sheet and plug to a
working-capital line.

## Known v1 limits

- Fixed-asset disposals are not split into proceeds and gain/loss on the
  cash flow statement (the net change in the asset leadsheet shows); staff
  can override classifications.
- No notes to the financial statements and no review (AR-C 90) report.
- Prior-year columns come from the ledger only (no manual prior-year entry).
