// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { useState } from 'react';
import type { EstimatePaymentDTO, CreatePaymentInput } from '@kis-books/shared';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';
import { ErrorMessage } from '../../../components/ui/ErrorMessage';
import { TableScroll } from '../../../components/ui/TableScroll';
import { usePaymentLedger, useCreatePayment, useUpdatePayment, useDeletePayment } from '../../../api/hooks/useTaxEstimatorEstimate';
import { SELECT_CLASS } from '../taxpayers/labels';
import { formatMoney } from '../../../utils/money';
import { errMsg, fmtDate, JURISDICTION_LABEL } from './format';

const SOURCE_LABEL: Record<string, string> = { gl: 'Books (GL)', manual: 'Manual', prior_year_overpayment: 'Prior-year overpayment' };

interface Draft { jurisdiction: string; date: string; amount: string; memo: string }
const EMPTY: Draft = { jurisdiction: 'federal', date: '', amount: '', memo: '' };
const valid = (d: Draft) => /^\d{4}-\d{2}-\d{2}$/.test(d.date) && /^\d+(\.\d{1,4})?$/.test(d.amount) && Number(d.amount) > 0;

interface Props { taxpayerId: string; taxYear: number; jurisdictions: string[]; canWrite: boolean }

/** Payments ledger: GL-derived rows are read-only; manual rows can be added, edited and deleted (firm staff). */
export function PaymentsLedger({ taxpayerId, taxYear, jurisdictions, canWrite }: Props) {
  const ledger = usePaymentLedger(taxpayerId, taxYear);
  const create = useCreatePayment(taxpayerId, taxYear);
  const update = useUpdatePayment();
  const del = useDeletePayment();
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [confirm, setConfirm] = useState<EstimatePaymentDTO | null>(null);
  const options = [...new Set(['federal', ...jurisdictions])];

  const startNew = () => { setDraft(EMPTY); setEditing('new'); };
  const startEdit = (p: EstimatePaymentDTO) => { setDraft({ jurisdiction: p.jurisdiction, date: p.date ?? '', amount: String(Number(p.amount)), memo: p.memo ?? '' }); setEditing(p.id); };
  const save = () => {
    const base = { jurisdiction: draft.jurisdiction, date: draft.date, amount: draft.amount, memo: draft.memo.trim() || null };
    const done = { onSuccess: () => setEditing(null) };
    if (editing === 'new') create.mutate({ ...base, source: 'manual' } as CreatePaymentInput, done);
    else if (editing) update.mutate({ id: editing, input: base }, done);
  };
  const saving = create.isPending || update.isPending;
  const mutationError = create.isError ? errMsg(create.error) : update.isError ? errMsg(update.error) : del.isError ? errMsg(del.error) : undefined;

  return (
    <section id="payments" aria-label="Payments ledger" className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-semibold text-gray-900">Payments</h2>
        {canWrite && editing == null && <Button size="sm" className="ml-auto" onClick={startNew}>Add payment</Button>}
      </div>
      {editing != null && (
        <form className="grid grid-cols-1 sm:grid-cols-5 gap-3 items-end rounded-lg border border-gray-200 bg-white p-3" aria-label="Payment form"
          onSubmit={(e) => { e.preventDefault(); if (valid(draft)) save(); }}>
          <div>
            <label htmlFor="pay-j" className="block text-sm font-medium text-gray-700 mb-1">Jurisdiction</label>
            <select id="pay-j" className={SELECT_CLASS} value={draft.jurisdiction} onChange={(e) => setDraft({ ...draft, jurisdiction: e.target.value })}>
              {options.map((j) => <option key={j} value={j}>{JURISDICTION_LABEL(j)}</option>)}
            </select>
          </div>
          <Input label="Date paid" type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} />
          <Input label="Amount" inputMode="decimal" placeholder="0.00" value={draft.amount} onChange={(e) => setDraft({ ...draft, amount: e.target.value })} />
          <Input label="Memo" maxLength={200} value={draft.memo} onChange={(e) => setDraft({ ...draft, memo: e.target.value })} />
          <div className="flex gap-2">
            <Button type="submit" size="sm" loading={saving} disabled={!valid(draft)}>Save payment</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
          </div>
        </form>
      )}
      {mutationError && <p className="text-sm text-red-600" role="alert">{mutationError}</p>}
      {ledger.isLoading ? <LoadingSpinner className="py-6" />
        : ledger.isError || !ledger.data ? <ErrorMessage message="Could not load the payments ledger." onRetry={() => ledger.refetch()} />
        : ledger.data.payments.length === 0 ? (
          <p className="rounded-lg border border-dashed border-gray-300 bg-white p-4 text-sm text-gray-700">
            No payments recorded for {taxYear}. Payments posted to an estimated-tax account in the books appear here automatically{canWrite ? '; use Add payment for anything paid outside the books.' : '.'}
          </p>
        ) : (
          <>
            <TableScroll>
              <table className="min-w-[40rem] w-full text-sm">
                <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                  <tr><th scope="col" className="px-3 py-2 text-left">Date</th><th scope="col" className="px-3 py-2 text-left">Jurisdiction</th><th scope="col" className="px-3 py-2 text-left">Source</th>
                    <th scope="col" className="px-3 py-2 text-right">Amount</th><th scope="col" className="px-3 py-2 text-left">Memo</th><th scope="col" className="px-3 py-2"><span className="sr-only">Actions</span></th></tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {ledger.data.payments.map((p) => (
                    <tr key={p.id}>
                      <td className="px-3 py-2 whitespace-nowrap">{p.date ? fmtDate(p.date) : 'Prior year'}</td>
                      <td className="px-3 py-2">{JURISDICTION_LABEL(p.jurisdiction)}</td>
                      <td className="px-3 py-2">{SOURCE_LABEL[p.source] ?? p.source}{p.accountName && <div className="text-xs text-gray-500">{p.companyName ? `${p.companyName} · ` : ''}{p.accountName}</div>}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatMoney(p.amount)}</td>
                      <td className="px-3 py-2 text-gray-600">{p.memo ?? ''}</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        {canWrite && p.stored && (
                          <>
                            <Button size="sm" variant="ghost" aria-label={`Edit payment ${p.date ?? ''}`} onClick={() => startEdit(p)}>Edit</Button>
                            <Button size="sm" variant="ghost" aria-label={`Delete payment ${p.date ?? ''}`} onClick={() => setConfirm(p)}>Delete</Button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 font-medium">
                    <td className="px-3 py-2" colSpan={6}>
                      {Object.entries(ledger.data.totals).map(([j, v]) => <span key={j} className="mr-4">{JURISDICTION_LABEL(j)} {formatMoney(v)}</span>)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </TableScroll>
            {ledger.data.total > ledger.data.payments.length && <p className="text-xs text-gray-500">Showing {ledger.data.payments.length} of {ledger.data.total} payments.</p>}
          </>
        )}
      <ConfirmDialog open={!!confirm} variant="danger" confirmLabel="Delete" title="Delete this payment?"
        message="The payment is removed from the ledger and the estimate is recalculated."
        onCancel={() => setConfirm(null)}
        onConfirm={() => { const p = confirm; setConfirm(null); if (p) del.mutate(p.id); }} />
    </section>
  );
}
