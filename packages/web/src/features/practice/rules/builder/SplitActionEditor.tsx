// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { Plus, Trash2 } from 'lucide-react';
import type { Action } from '@kis-books/shared';
import { AccountSelector } from '../../../../components/forms/AccountSelector';

interface Props {
  action: Extract<Action, { type: 'split_by_percentage' | 'split_by_fixed' }>;
  onChange: (next: Action) => void;
}

// Phase 5a §5.3 — splits row editor. Inline percentage-sum
// validation surfaces immediately rather than waiting for the
// server's Zod refine to fail on save.
export function SplitActionEditor({ action, onChange }: Props) {
  const isPercentage = action.type === 'split_by_percentage';

  const addRow = () => {
    if (isPercentage) {
      onChange({
        ...action,
        splits: [...action.splits, { accountId: '', percent: 0 }],
      });
    } else {
      onChange({
        ...action,
        splits: [...action.splits, { accountId: '', amount: '0.0000' }],
      });
    }
  };

  const removeRow = (i: number) => {
    onChange({
      ...action,
      splits: action.splits.filter((_, idx) => idx !== i),
    } as Action);
  };

  const updateRow = (i: number, patch: Record<string, unknown>) => {
    const splits = action.splits.map((row, idx) => (idx === i ? { ...row, ...patch } : row));
    onChange({ ...action, splits } as Action);
  };

  const sum = isPercentage
    ? (action.splits as Array<{ percent: number }>).reduce((s, r) => s + (r.percent || 0), 0)
    : null;
  const sumOk = sum === null ? true : Math.abs(sum - 100) < 0.01;

  return (
    <div className="flex flex-col gap-2">
      {action.splits.map((row, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="flex-1">
            <AccountSelector
              value={row.accountId || ''}
              onChange={(id) => updateRow(i, { accountId: id })}
              compact
            />
          </div>
          {isPercentage ? (
            <div className="flex items-center gap-1">
              <input
                type="number"
                step="0.01"
                min={0}
                max={100}
                value={String((row as { percent: number }).percent ?? 0)}
                onChange={(e) => updateRow(i, { percent: Number(e.target.value) })}
                className="w-20 rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm font-mono"
              />
              <span className="text-xs text-gray-500">%</span>
            </div>
          ) : (
            <input
              type="text"
              value={(row as { amount: string }).amount ?? '0.0000'}
              onChange={(e) => updateRow(i, { amount: e.target.value })}
              className="w-28 rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm font-mono"
              placeholder="0.0000"
            />
          )}
          <button
            type="button"
            onClick={() => removeRow(i)}
            disabled={action.splits.length <= 2}
            aria-label="Remove split row"
            className="rounded-md p-1.5 text-gray-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={addRow}
          className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
        >
          <Plus className="h-3 w-3" /> Add split row
        </button>
        {isPercentage && (
          <span className={sumOk ? 'text-xs text-emerald-700 font-mono' : 'text-xs text-rose-700 font-mono'}>
            Sum: {sum?.toFixed(2)}% {sumOk ? '✓' : '(must total 100)'}
          </span>
        )}
      </div>
    </div>
  );
}
