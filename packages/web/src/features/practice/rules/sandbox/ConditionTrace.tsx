// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import clsx from 'clsx';
import { Check, X } from 'lucide-react';
import type { ConditionTraceWire } from '../../../../api/hooks/useRuleTestSandbox';

interface Props {
  trace: ConditionTraceWire;
  depth?: number;
}

// Phase 5b §5.5 — recursive trace renderer. Mirrors the
// condition-tree shape with a green ✓ on matched leaves and a
// rose ✗ on failed ones. Group nodes inherit pass/fail from
// their children per AND/OR semantics.
export function ConditionTrace({ trace, depth = 0 }: Props) {
  if (trace.kind === 'group') {
    return (
      <div
        className={clsx(
          'rounded-md border p-2 flex flex-col gap-1.5',
          trace.matched ? 'border-emerald-200 bg-emerald-50/40' : 'border-rose-200 bg-rose-50/40',
        )}
      >
        <div className="flex items-center gap-2">
          <Pill matched={trace.matched} />
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-600">
            {trace.op} group
          </span>
        </div>
        <div className="flex flex-col gap-1.5 pl-3 border-l-2 border-gray-200">
          {trace.children.map((c, i) => (
            <ConditionTrace key={i} trace={c} depth={depth + 1} />
          ))}
        </div>
      </div>
    );
  }
  return (
    <div
      className={clsx(
        'rounded-md border p-2 flex items-center gap-2 text-xs',
        trace.matched ? 'border-emerald-200 bg-emerald-50' : 'border-rose-200 bg-rose-50',
      )}
    >
      <Pill matched={trace.matched} />
      <code className="font-mono text-gray-800">
        {trace.field} {trace.operator} {formatValue(trace.value)}
      </code>
      {trace.error && (
        <span className="text-[11px] text-rose-700 italic">{trace.error}</span>
      )}
    </div>
  );
}

function Pill({ matched }: { matched: boolean }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center justify-center h-5 w-5 rounded-full text-white',
        matched ? 'bg-emerald-600' : 'bg-rose-500',
      )}
      aria-label={matched ? 'matched' : 'no match'}
    >
      {matched ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
    </span>
  );
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return 'null';
  if (Array.isArray(v)) return `[${v.join(', ')}]`;
  if (typeof v === 'string') return `"${v}"`;
  return String(v);
}
