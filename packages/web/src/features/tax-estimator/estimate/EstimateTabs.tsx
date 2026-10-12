// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { Link } from 'react-router-dom';

export type EstimateTab = 'summary' | 'settings' | 'scenarios';
interface Props { taxpayerId: string; taxYear: number; active: EstimateTab; scenarioId?: string; through?: string }

/** Section tabs shared by the estimator screens: Summary . Annual settings . Scenarios . Payments. */
export function EstimateTabs({ taxpayerId, taxYear, active, scenarioId, through }: Props) {
  const base = `/tax-estimator/taxpayers/${taxpayerId}`;
  // QA D23: Summary / Payments keep the chosen Actuals-through month.
  const q = `year=${taxYear}${scenarioId ? `&scenario=${scenarioId}` : ''}${through ? `&through=${through}` : ''}`;
  const items: Array<{ key: EstimateTab | 'payments'; label: string; to: string | { pathname: string; search: string; hash: string } }> = [
    { key: 'summary', label: 'Summary', to: `${base}/estimate?${q}` },
    { key: 'settings', label: 'Annual settings', to: `${base}/annual-settings?year=${taxYear}` },
    { key: 'scenarios', label: 'Scenarios', to: `${base}/scenarios?year=${taxYear}` },
    { key: 'payments', label: 'Payments', to: { pathname: `${base}/estimate`, search: `?${q}`, hash: '#payments' } },
  ];
  return (
    <nav aria-label="Estimator sections" className="flex flex-wrap gap-1 border-b border-gray-200">
      {items.map((i) => (
        <Link key={i.key} to={i.to} aria-current={i.key === active ? 'page' : undefined}
          className={`px-3 py-2 text-sm border-b-2 ${i.key === active ? 'border-primary-600 font-semibold text-gray-900' : 'border-transparent text-gray-600 hover:text-gray-900'}`}>
          {i.label}
        </Link>
      ))}
    </nav>
  );
}
