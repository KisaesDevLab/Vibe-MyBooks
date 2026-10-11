// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Display helpers for tax-parameter values.
import type { ParameterValueType } from '@kis-books/shared';

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 2 });

export function formatRate(n: number): string {
  const pct = Math.round(n * 100 * 1e4) / 1e4;
  return `${pct}%`;
}

export function formatScalar(type: ParameterValueType, v: unknown): string {
  if (v == null) return '—';
  switch (type) {
    case 'money': case 'money_list': return typeof v === 'number' ? usd.format(v) : String(v);
    case 'rate': case 'rate_list': return typeof v === 'number' ? formatRate(v) : String(v);
    default: return String(v);
  }
}

export const isTableType = (t: ParameterValueType) => t === 'bracket_table' || t === 'rate_period_list';

/** Compact one-line text; tables are rendered by <ParameterValue/> as sub-tables. */
export function formatValue(type: ParameterValueType, v: unknown): string {
  if (Array.isArray(v)) {
    if (type === 'bracket_table') return `${v.length} brackets`;
    if (type === 'rate_period_list') return `${v.length} periods`;
    const elType = type.replace('_list', '') as ParameterValueType;
    return v.map((x) => formatScalar(elType, x)).join(', ');
  }
  return formatScalar(type, v);
}

export function shortCitation(c: string, max = 60): string {
  return c.length > max ? `${c.slice(0, max - 1)}…` : c;
}
