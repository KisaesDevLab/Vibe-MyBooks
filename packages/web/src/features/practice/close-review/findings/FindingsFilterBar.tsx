// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import type { CheckRegistryEntry, FindingSeverity, FindingStatus } from '@kis-books/shared';
import { FINDING_SEVERITIES, FINDING_STATUSES } from '@kis-books/shared';
import { STATUS_LABELS } from './StatusBadge';

const SEVERITY_LABELS: Record<FindingSeverity, string> = {
  low: 'Low',
  med: 'Medium',
  high: 'High',
  critical: 'Critical',
};

interface Props {
  status: FindingStatus | null;
  severity: FindingSeverity | null;
  checkKey: string | null;
  registry: CheckRegistryEntry[];
  onStatus: (s: FindingStatus | null) => void;
  onSeverity: (s: FindingSeverity | null) => void;
  onCheckKey: (k: string | null) => void;
  onClearAll: () => void;
}

// Build plan §7.2 filter row. Three dropdowns + a "clear" link.
// Status and severity feed off the shared enums; check list comes
// from the live registry so a tenant that disables a check still
// sees only enabled options.
export function FindingsFilterBar({
  status,
  severity,
  checkKey,
  registry,
  onStatus,
  onSeverity,
  onCheckKey,
  onClearAll,
}: Props) {
  const hasFilters = !!(status || severity || checkKey);
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2">
      <Select
        label="Status"
        value={status ?? ''}
        onChange={(v) => onStatus((v as FindingStatus) || null)}
        options={FINDING_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))}
      />
      <Select
        label="Severity"
        value={severity ?? ''}
        onChange={(v) => onSeverity((v as FindingSeverity) || null)}
        options={FINDING_SEVERITIES.map((s) => ({ value: s, label: SEVERITY_LABELS[s] }))}
      />
      <Select
        label="Check"
        value={checkKey ?? ''}
        onChange={(v) => onCheckKey(v || null)}
        options={registry.map((r) => ({ value: r.checkKey, label: r.name }))}
      />
      {hasFilters && (
        <button
          type="button"
          onClick={onClearAll}
          className="text-xs font-medium text-indigo-700 hover:text-indigo-900"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}

interface SelectProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}

function Select({ label, value, onChange, options }: SelectProps) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-xs font-medium text-gray-600">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-sm"
      >
        <option value="">All</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
