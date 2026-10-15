// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// See LICENSE for terms.

import { useState } from 'react';
import type { ParameterValueType } from '@kis-books/shared';
import { formatRate, formatValue, isTableType, formatScalar } from './format';

export function ParameterValue({ type, value }: { type: ParameterValueType; value: unknown }) {
  const [open, setOpen] = useState(false);
  if (!isTableType(type) || !Array.isArray(value)) {
    return <span className="tabular-nums">{formatValue(type, value)}</span>;
  }
  return (
    <div>
      <button type="button" className="text-primary-600 hover:underline text-sm" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        {open ? 'Hide ' : 'Show '}{formatValue(type, value)}
      </button>
      {open && (
        <table className="mt-1 text-xs border border-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {type === 'bracket_table'
                ? (<><th className="px-2 py-1 text-left">Up to</th><th className="px-2 py-1 text-left">Rate</th></>)
                : (<><th className="px-2 py-1 text-left">From</th><th className="px-2 py-1 text-left">To</th><th className="px-2 py-1 text-left">Rate</th></>)}
            </tr>
          </thead>
          <tbody>
            {value.map((row, i) => type === 'bracket_table'
              ? (
                <tr key={i}>
                  <td className="px-2 py-1 tabular-nums">{(row as [number | null, number])[0] == null ? 'No limit' : formatScalar('money', (row as [number, number])[0])}</td>
                  <td className="px-2 py-1 tabular-nums">{formatRate((row as [number, number])[1])}</td>
                </tr>
              ) : (
                <tr key={i}>
                  <td className="px-2 py-1">{(row as { from: string }).from}</td>
                  <td className="px-2 py-1">{(row as { to: string }).to}</td>
                  <td className="px-2 py-1 tabular-nums">{formatRate((row as { rate: number }).rate)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
