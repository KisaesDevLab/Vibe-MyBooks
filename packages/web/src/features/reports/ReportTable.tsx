// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// The generic report table. Every report hands it the WHOLE result set, so
// sorting and the per-column value filter run client-side through the shared
// column view (one persisted view per report path). Money columns sort
// numerically; text columns with a manageable number of distinct values get
// the ▾ value filter. When a filter is active the footer totals are
// recomputed over the visible rows so the "Total" never contradicts them.

import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { SortableTh } from '../../components/ui/SortableTh';
import { useColumnView } from '../../hooks/useColumnView';
import { distinctOptions, selectRows } from '../../utils/columnView';

// Context handed to drillDown so columns defined at module level in App.tsx
// can still build URLs that reflect the report's current date filters.
export interface DrillContext {
  startDate?: string;
  endDate?: string;
  asOfDate?: string;
}

interface Column {
  key: string;
  label: string;
  align?: 'left' | 'right' | 'center';
  format?: 'money' | 'text';
  drillDown?: (row: Record<string, unknown>, ctx: DrillContext) => string | null;
}

interface ReportTableProps {
  columns: Column[];
  data: Record<string, unknown>[];
  totals?: Record<string, number>;
  drillContext?: DrillContext;
  // Label used on the "Back to <label>" link in TransactionListPage when
  // the drill navigates away. Defaults to "Report" when absent.
  returnLabel?: string;
}

// Past this many distinct values a checklist stops being useful.
const MAX_FILTER_OPTIONS = 200;

// Columns whose values must never reach a value-filter, because the chosen
// values are remembered in sessionStorage and these carry identifiers: the
// 1099 reports render an unmasked tax_id, which for a sole proprietor is an
// SSN, and addresses identify a person just as well. Sorting stays; only the
// checklist is withheld, so nothing writes a taxpayer identifier into the
// browser's storage where nothing in the app would ever clear it.
const NEVER_FILTERABLE = /(^|_)(tax_?id|ssn|ein|tin|address|account_?number|routing)(_|$)/i;

function fmt(val: unknown): string {
  if (val === null || val === undefined) return '—';
  const n = typeof val === 'string' ? parseFloat(val) : (val as number);
  if (isNaN(n)) return String(val);
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function asNumber(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null;
  const n = typeof val === 'number' ? val : parseFloat(String(val));
  return Number.isFinite(n) ? n : null;
}

export function ReportTable({ columns, data, totals, drillContext, returnLabel }: ReportTableProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = `${location.pathname}${location.search}`;

  const keys = useMemo(() => columns.map((c) => c.key), [columns]);
  const view = useColumnView<string>(`vibe:report:${location.pathname}:view`, {
    sortKeys: keys,
    defaultDir: (k) => (columns.find((c) => c.key === k)?.format === 'money' ? 'desc' : 'asc'),
  });

  const rows = useMemo(() => selectRows(data, view, {
    filterValue: Object.fromEntries(columns.map((c) => [c.key, (r: Record<string, unknown>) => String(r[c.key] ?? '')])),
    sortValue: Object.fromEntries(columns.map((c) => [c.key, (r: Record<string, unknown>) =>
      c.format === 'money' ? asNumber(r[c.key]) : (r[c.key] === null || r[c.key] === undefined ? null : String(r[c.key]))])),
  }), [data, view, columns]);

  const filterOptionsFor = (col: Column) => {
    if (col.format === 'money') return null;
    if (NEVER_FILTERABLE.test(col.key)) return null;
    const opts = distinctOptions(data.map((r) => String(r[col.key] ?? '')));
    return opts.length > 0 && opts.length <= MAX_FILTER_OPTIONS ? opts : null;
  };

  // Totals follow the rows on screen once a filter narrows them.
  const shownTotals = useMemo(() => {
    if (!totals || !view.anyFilterActive) return totals;
    const out: Record<string, number> = {};
    for (const key of Object.keys(totals)) {
      out[key] = rows.reduce((sum, r) => sum + (asNumber(r[key]) ?? 0), 0);
    }
    return out;
  }, [totals, rows, view.anyFilterActive]);

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50 text-xs font-medium text-gray-500 uppercase">
          <tr>
            {columns.map((col) => {
              const opts = filterOptionsFor(col);
              return (
                <SortableTh
                  key={col.key}
                  padding="px-4 py-2"
                  label={col.label}
                  align={col.align === 'right' ? 'right' : col.align === 'center' ? 'center' : 'left'}
                  {...view.thProps(col.key)}
                  filter={opts ? view.filterProps(col.key, opts, { ariaLabel: `Filter ${col.label}`, searchable: opts.length > 8 }) : undefined}
                />
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.length === 0 && view.anyFilterActive && (
            <tr>
              <td colSpan={columns.length} className="px-4 py-6 text-center text-gray-500">
                No rows match the column filters.{' '}
                <button type="button" onClick={() => view.clearAll()} className="text-primary-700 underline">Clear filters</button>
              </td>
            </tr>
          )}
          {rows.map((row, i) => (
            <tr key={i} className="hover:bg-gray-50">
              {columns.map((col) => {
                const val = row[col.key];
                const isMoney = col.format === 'money';
                const drillPath = col.drillDown?.(row, drillContext ?? {}) ?? null;
                return (
                  <td key={col.key} className={`px-4 py-2 ${col.align === 'right' ? 'text-right font-mono' : ''}`}>
                    {drillPath ? (
                      <button
                        onClick={() => navigate(drillPath, { state: { returnTo, returnLabel: returnLabel ?? 'Report' } })}
                        className="cursor-pointer focus:outline-none focus:underline"
                      >
                        {isMoney ? `$${fmt(val)}` : String(val ?? '—')}
                      </button>
                    ) : (
                      isMoney ? `$${fmt(val)}` : String(val ?? '—')
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
        {shownTotals && (
          <tfoot>
            <tr className="font-bold bg-gray-50 border-t-2">
              {columns.map((col, i) => (
                <td key={col.key} className={`px-4 py-2 ${col.align === 'right' ? 'text-right font-mono' : ''}`}>
                  {i === 0 ? 'Total' : shownTotals[col.key] !== undefined ? `$${fmt(shownTotals[col.key])}` : ''}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
