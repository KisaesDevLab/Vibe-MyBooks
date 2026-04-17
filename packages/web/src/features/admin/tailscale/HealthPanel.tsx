// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useState } from 'react';
import type { HealthCheck, TailscaleHealth } from '@kis-books/shared';
import { Activity, CheckCircle2, AlertTriangle, XCircle, ChevronDown } from 'lucide-react';

const OVERALL_BANNER = {
  healthy: {
    bg: 'bg-green-50',
    border: 'border-green-200',
    text: 'text-green-800',
    icon: CheckCircle2,
    label: 'All systems healthy',
  },
  degraded: {
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-800',
    icon: AlertTriangle,
    label: 'Degraded — warnings present',
  },
  critical: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    text: 'text-red-800',
    icon: XCircle,
    label: 'Critical — action required',
  },
  disconnected: {
    bg: 'bg-gray-50',
    border: 'border-gray-200',
    text: 'text-gray-700',
    icon: XCircle,
    label: 'Disconnected',
  },
} as const;

const CHECK_ICON = {
  pass: { cls: 'text-green-600', Icon: CheckCircle2 },
  warn: { cls: 'text-amber-600', Icon: AlertTriangle },
  fail: { cls: 'text-red-600', Icon: XCircle },
} as const;

function CheckRow({ check }: { check: HealthCheck }) {
  const [open, setOpen] = useState(false);
  const { cls, Icon } = CHECK_ICON[check.status];
  const hasDetails = !!check.details && Object.keys(check.details).length > 0;

  return (
    <div className="border-b border-gray-100 last:border-0">
      <button
        onClick={() => hasDetails && setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 disabled:cursor-default"
        disabled={!hasDetails}
      >
        <Icon className={`h-5 w-5 flex-shrink-0 ${cls}`} />
        <div className="flex-1">
          <div className="text-sm font-medium text-gray-900 capitalize">
            {check.name.replace(/_/g, ' ')}
          </div>
          <div className="text-xs text-gray-600">{check.message}</div>
        </div>
        {hasDetails && (
          <ChevronDown
            className={`h-4 w-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
          />
        )}
      </button>
      {open && hasDetails && (
        <div className="px-12 pb-3">
          <pre className="text-xs text-gray-700 bg-gray-50 border border-gray-200 rounded p-2 overflow-x-auto">
            {JSON.stringify(check.details, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

export function HealthPanel({ health }: { health: TailscaleHealth }) {
  const banner = OVERALL_BANNER[health.overall];
  const BannerIcon = banner.icon;

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
      <div className="px-6 py-4 border-b border-gray-200 flex items-center gap-2">
        <Activity className="h-5 w-5 text-gray-600" />
        <h2 className="text-lg font-semibold text-gray-900">Network Health</h2>
      </div>
      <div className={`px-6 py-3 border-b ${banner.bg} ${banner.border}`}>
        <div className={`flex items-center gap-2 ${banner.text}`}>
          <BannerIcon className="h-5 w-5" />
          <span className="font-semibold">{banner.label}</span>
        </div>
      </div>
      <div>
        {health.checks.map((c) => (
          <CheckRow key={c.name} check={c} />
        ))}
      </div>
      <div className="px-6 py-2 text-xs text-gray-500 border-t border-gray-100">
        Last checked {new Date(health.lastCheckAt).toLocaleTimeString()}
      </div>
    </div>
  );
}
