// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// The expense-lines editor shared by Enter Bill and Bill Capture review.
// Lifted out of EnterBillPage without behaviour changes: phones get a
// labelled card per line, md+ gets the table; the "Apply to all" tag copy
// and the locked-total readout are preserved.

import { AccountSelector } from '../../components/forms/AccountSelector';
import { MoneyInput } from '../../components/forms/MoneyInput';
import { LineTagPicker } from '../../components/forms/SplitRowV2';
import { ENTRY_FORMS_V2 } from '../../utils/feature-flags';
import { Plus, Trash2 } from 'lucide-react';
import { emptyLine, type BillLine } from './billFormShared';

export interface BillLinesTableProps {
  lines: BillLine[];
  onChange: (lines: BillLine[]) => void;
  /** Hide "Add line" and per-row Remove (Single-line mode). */
  fixedRowCount?: boolean;
  /** Editing a paid bill: the sum must equal this. */
  lockedTotal?: number | null;
  title?: string;
}

export function BillLinesTable({ lines, onChange, fixedRowCount = false, lockedTotal = null, title = 'Expense Lines' }: BillLinesTableProps) {
  const updateLine = (i: number, field: 'accountId' | 'description' | 'amount', value: string) =>
    onChange(lines.map((l, idx) => (idx === i ? { ...l, [field]: value } : l)));

  const updateLineTag = (i: number, tagId: string | null, touched: boolean) =>
    onChange(lines.map((l, idx) => (idx === i ? { ...l, tagId, userHasTouchedTag: l.userHasTouchedTag || touched } : l)));

  // ADR 0XY §4.3 — copy the first row's tag to every untouched row.
  const canApplyTagToAll = !!lines[0]?.tagId && lines.length > 1;
  const applyFirstTagToAll = () => {
    const firstTag = lines[0]?.tagId ?? null;
    onChange(lines.map((l, idx) => (idx === 0 || l.userHasTouchedTag ? l : { ...l, tagId: firstTag })));
  };

  const total = lines.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);
  const isLocked = lockedTotal !== null;
  const totalMismatch = isLocked ? Math.abs(total - lockedTotal) > 0.01 : false;
  const lockedDifference = isLocked ? total - lockedTotal : 0;

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
      <h2 className="text-sm font-medium text-gray-700 mb-3">{title}</h2>
      <table className="w-full">
        <thead className="hidden md:table-header-group">
          <tr>
            <th className="text-left text-xs font-medium text-gray-500 uppercase pb-2 w-1/3">Account</th>
            <th className="text-left text-xs font-medium text-gray-500 uppercase pb-2 w-44">Amount</th>
            <th className="text-left text-xs font-medium text-gray-500 uppercase pb-2">Description</th>
            {ENTRY_FORMS_V2 && (
              <th className="text-left text-xs font-medium text-gray-500 uppercase pb-2 w-40">
                <div className="flex items-center gap-2">
                  <span>Tag</span>
                  {canApplyTagToAll && (
                    <button
                      type="button"
                      onClick={applyFirstTagToAll}
                      className="text-[10px] normal-case font-normal text-primary-600 hover:text-primary-700 underline"
                      title="Copy this row's tag to every untouched row below"
                    >
                      Apply to all
                    </button>
                  )}
                </div>
              </th>
            )}
            <th className="w-8 pb-2" />
          </tr>
        </thead>
        <tbody className="block space-y-3 md:table-row-group md:space-y-0">
          {lines.map((line, i) => (
            <tr key={i} className="grid grid-cols-2 gap-x-3 gap-y-2 rounded-lg border border-gray-200 bg-gray-50/60 p-3 md:table-row md:border-0 md:bg-transparent md:p-0 md:align-top">
              <td className="col-span-2 md:table-cell md:pr-2 md:py-1">
                <span className="block md:hidden text-xs font-medium text-gray-500 uppercase mb-1">Account</span>
                <AccountSelector
                  value={line.accountId}
                  onChange={(v) => updateLine(i, 'accountId', v)}
                />
              </td>
              <td className="col-span-2 md:table-cell md:px-2 md:py-1">
                <span className="block md:hidden text-xs font-medium text-gray-500 uppercase mb-1">Amount</span>
                <MoneyInput value={line.amount} onChange={(v) => updateLine(i, 'amount', v)} />
              </td>
              <td className="col-span-2 md:table-cell md:px-2 md:py-1">
                <span className="block md:hidden text-xs font-medium text-gray-500 uppercase mb-1">Description</span>
                <input
                  value={line.description}
                  onChange={(e) => updateLine(i, 'description', e.target.value)}
                  className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="Description"
                />
              </td>
              {ENTRY_FORMS_V2 && (
                <td className="col-span-2 order-last md:order-none md:table-cell md:px-2 md:py-1">
                  <span className="flex md:hidden items-center gap-2 text-xs font-medium text-gray-500 uppercase mb-1">
                    Tag
                    {i === 0 && canApplyTagToAll && (
                      <button type="button" onClick={applyFirstTagToAll} className="text-[10px] normal-case font-normal text-primary-600 underline">
                        Apply to all
                      </button>
                    )}
                  </span>
                  <LineTagPicker value={line.tagId} onChange={(t, touched) => updateLineTag(i, t, touched)} compact />
                </td>
              )}
              <td className="col-span-2 order-first flex items-center justify-between md:order-none md:table-cell md:pl-1 md:py-1 md:pt-2.5">
                <span className="md:hidden text-xs font-semibold text-gray-700">Line {i + 1}</span>
                {lines.length > 1 && !fixedRowCount && (
                  <button
                    type="button"
                    onClick={() => onChange(lines.filter((_, idx) => idx !== i))}
                    className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-red-500"
                    aria-label={`Remove line ${i + 1}`}
                  >
                    <Trash2 className="h-4 w-4" /><span className="md:hidden">Remove</span>
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!fixedRowCount && (
        <button
          type="button"
          onClick={() => onChange([...lines, emptyLine()])}
          className="mt-3 flex items-center gap-1 text-sm text-primary-600"
        >
          <Plus className="h-4 w-4" /> Add line
        </button>
      )}

      <div className="flex justify-end mt-4 border-t pt-4">
        <div className="w-72 space-y-1 text-sm">
          {isLocked && (
            <div className="flex justify-between text-gray-600">
              <span>Required (locked)</span>
              <span className="font-mono">${lockedTotal.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-lg">
            <span>Total</span>
            <span className={`font-mono ${totalMismatch ? 'text-red-600' : ''}`}>
              ${total.toFixed(2)}
            </span>
          </div>
          {totalMismatch && (
            <div className="flex justify-between text-xs text-red-600">
              <span>{lockedDifference > 0 ? 'Over' : 'Short'} by</span>
              <span className="font-mono">${Math.abs(lockedDifference).toFixed(2)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
