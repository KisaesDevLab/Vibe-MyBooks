// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Cash / Accrual accounting-basis selector shared across reports.

export type ReportBasis = 'cash' | 'accrual';

export function BasisSelector({ value, onChange }: { value: ReportBasis; onChange: (v: ReportBasis) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm text-gray-600">
      Basis
      <select
        aria-label="Accounting basis"
        value={value}
        onChange={(e) => onChange(e.target.value as ReportBasis)}
        className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
      >
        <option value="accrual">Accrual</option>
        <option value="cash">Cash</option>
      </select>
    </label>
  );
}
