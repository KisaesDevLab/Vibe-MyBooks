// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useLocation, useNavigate } from 'react-router-dom';

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

function fmt(val: unknown): string {
  if (val === null || val === undefined) return '—';
  const n = typeof val === 'string' ? parseFloat(val) : (val as number);
  if (isNaN(n)) return String(val);
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function ReportTable({ columns, data, totals, drillContext, returnLabel }: ReportTableProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = `${location.pathname}${location.search}`;

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            {columns.map((col) => (
              <th key={col.key} className={`px-4 py-2 text-xs font-medium text-gray-500 uppercase ${col.align === 'right' ? 'text-right' : 'text-left'}`}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {data.map((row, i) => (
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
        {totals && (
          <tfoot>
            <tr className="font-bold bg-gray-50 border-t-2">
              {columns.map((col, i) => (
                <td key={col.key} className={`px-4 py-2 ${col.align === 'right' ? 'text-right font-mono' : ''}`}>
                  {i === 0 ? 'Total' : totals[col.key] !== undefined ? `$${fmt(totals[col.key])}` : ''}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
