// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { useEffect, useMemo, useState } from 'react';
import { Receipt, Clock, CheckCircle2 } from 'lucide-react';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { usePortal } from './PortalLayout';

// PORTAL_BILL_PAY_V1 — unpaid bills with checkbox selection and a
// sticky "Pay N bills" bar. Marking pays each bill's FULL balance due;
// the server posts the payments and queues checks for the firm to
// print. A second section shows payments already queued (they drop off
// once the firm prints).

interface PortalBill {
  id: string;
  vendorName: string | null;
  vendorInvoiceNumber: string | null;
  txnDate: string;
  dueDate: string | null;
  total: string | null;
  amountPaid: string | null;
  balanceDue: string | null;
  billStatus: string | null;
  daysOverdue: number;
}

interface QueuedPayment {
  paymentId: string;
  vendorName: string | null;
  amount: string | null;
  txnDate: string;
  bills: Array<{ vendorInvoiceNumber: string | null; amount: string }>;
}

interface BillsResponse {
  featureEnabled: boolean;
  configured: boolean;
  bills: PortalBill[];
  queuedPayments: QueuedPayment[];
}

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const num = (v: string | null) => parseFloat(v ?? '0');

export function PortalBillsPage() {
  const { me, activeCompanyId } = usePortal();
  const isPreview = !!me.preview;

  const [data, setData] = useState<BillsResponse | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [retryable, setRetryable] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!activeCompanyId) return;
    let cancelled = false;
    setData(null);
    setSelected(new Set());
    setError(null);
    setRetryable(false);
    fetch(`${import.meta.env.BASE_URL}api/portal/bills?companyId=${activeCompanyId}`, {
      credentials: 'include',
    })
      .then((r) => {
        if (r.status === 403) {
          if (!cancelled) setError('Bill payments are not enabled for your account.');
          return null;
        }
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d: BillsResponse | null) => {
        if (!d || cancelled) return;
        if (d.featureEnabled === false) {
          setError('Bill payments are not enabled for your account.');
          return;
        }
        setData(d);
      })
      .catch(() => {
        if (!cancelled) {
          setError('Failed to load bills.');
          setRetryable(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [activeCompanyId, attempt]);

  const selectedBills = useMemo(
    () => (data ? data.bills.filter((b) => selected.has(b.id)) : []),
    [data, selected],
  );
  const selectedTotal = selectedBills.reduce((s, b) => s + num(b.balanceDue), 0);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const submit = async () => {
    if (!activeCompanyId || selectedBills.length === 0) return;
    setSubmitting(true);
    setNotice(null);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/portal/bills/mark`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId: activeCompanyId, billIds: selectedBills.map((b) => b.id) }),
      });
      const body = await res.json().catch(() => null);
      if (res.status === 409) {
        setNotice(body?.error?.message ?? 'Some bills were just paid. Refresh and try again.');
      } else if (!res.ok) {
        setNotice(body?.error?.message ?? 'Failed to submit payment request.');
      } else {
        const paid = body?.payments?.length ?? 0;
        const skipped = body?.skipped?.length ?? 0;
        setNotice(
          paid > 0
            ? `Done — ${paid} check${paid === 1 ? '' : 's'} queued for your accounting firm to print.` +
              (skipped > 0 ? ` ${skipped} bill(s) were already handled and were skipped.` : '')
            : 'Those bills were already handled — nothing to pay.',
        );
      }
      setConfirming(false);
      setAttempt((a) => a + 1); // refetch the list either way
    } catch {
      setNotice('Failed to submit payment request. Check your connection and try again.');
      setConfirming(false);
    } finally {
      setSubmitting(false);
    }
  };

  if (error) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="bg-amber-50 border border-amber-200 rounded-md px-4 py-3 text-sm text-amber-800">
          <p>{error}</p>
          {retryable && (
            <button
              onClick={() => setAttempt((a) => a + 1)}
              className="mt-2 text-sm font-medium text-amber-900 underline hover:no-underline"
            >
              Retry
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 pb-28">
      <h1 className="text-xl font-semibold text-gray-900 mb-1">Bills to pay</h1>
      <p className="text-sm text-gray-600 mb-6">
        Select the bills you&apos;d like paid. Your accounting firm prints and mails the checks.
      </p>

      {notice && (
        <div className="mb-4 bg-blue-50 border border-blue-200 rounded-md px-4 py-3 text-sm text-blue-800">
          {notice}
        </div>
      )}

      {!data ? (
        <div className="py-10">
          <LoadingSpinner />
        </div>
      ) : (
        <>
          {!data.configured && (
            <div className="mb-4 bg-amber-50 border border-amber-200 rounded-md px-4 py-3 text-sm text-amber-800">
              Bill payments aren&apos;t set up for your company yet — contact your accountant.
            </div>
          )}

          {data.bills.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-gray-300 rounded-lg">
              <Receipt className="mx-auto h-10 w-10 text-gray-400 mb-3" />
              <p className="text-sm text-gray-500">No unpaid bills. Nice.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {data.bills.map((b) => {
                const partial = num(b.amountPaid) > 0;
                const canPay = data.configured && !isPreview;
                return (
                  <label
                    key={b.id}
                    className={`flex items-start gap-3 bg-white border rounded-lg px-4 py-3 ${
                      selected.has(b.id) ? 'border-indigo-400 ring-1 ring-indigo-200' : 'border-gray-200'
                    } ${canPay ? 'cursor-pointer' : 'opacity-75'}`}
                  >
                    <input
                      type="checkbox"
                      className="mt-1 rounded"
                      disabled={!canPay}
                      checked={selected.has(b.id)}
                      onChange={() => toggle(b.id)}
                    />
                    <span className="flex-1 min-w-0">
                      <span className="flex items-baseline justify-between gap-3">
                        <span className="text-sm font-semibold text-gray-900 truncate">
                          {b.vendorName ?? 'Vendor'}
                        </span>
                        <span className="text-sm font-semibold text-gray-900 tabular-nums shrink-0">
                          {money.format(num(b.balanceDue))}
                        </span>
                      </span>
                      <span className="block text-xs text-gray-500 mt-0.5">
                        {b.vendorInvoiceNumber ? `Inv ${b.vendorInvoiceNumber} · ` : ''}
                        {b.dueDate ? `due ${b.dueDate}` : `dated ${b.txnDate}`}
                        {b.daysOverdue > 0 && (
                          <span className="text-red-700 font-medium"> · {b.daysOverdue}d overdue</span>
                        )}
                        {partial && <span> · partially paid ({money.format(num(b.amountPaid))} of {money.format(num(b.total))})</span>}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          )}

          {data.queuedPayments.length > 0 && (
            <section className="mt-8">
              <h2 className="text-base font-semibold text-gray-900 mb-2">Queued for printing</h2>
              <div className="space-y-2">
                {data.queuedPayments.map((p) => (
                  <div key={p.paymentId} className="bg-white border border-gray-200 rounded-lg px-4 py-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="text-sm font-medium text-gray-900 truncate flex items-center gap-1.5">
                        <Clock className="h-4 w-4 text-amber-600 shrink-0" />
                        {p.vendorName ?? 'Vendor'}
                      </p>
                      <p className="text-sm font-semibold text-gray-900 tabular-nums">{money.format(num(p.amount))}</p>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 ml-5">
                      Check pending — will be printed by your accounting firm.
                      {p.bills.length > 0 &&
                        ` Covers ${p.bills.map((x) => x.vendorInvoiceNumber ?? 'a bill').join(', ')}.`}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {selectedBills.length > 0 && !isPreview && (
        <div className="fixed bottom-0 inset-x-0 z-20 bg-white border-t border-gray-200 shadow-lg">
          <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
            <p className="text-sm text-gray-700">
              <span className="font-semibold">{selectedBills.length}</span> bill
              {selectedBills.length === 1 ? '' : 's'} · <span className="font-semibold tabular-nums">{money.format(selectedTotal)}</span>
            </p>
            <button
              onClick={() => setConfirming(true)}
              disabled={submitting}
              className="px-4 py-2 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
            >
              Pay {selectedBills.length === 1 ? 'bill' : 'bills'}
            </button>
          </div>
        </div>
      )}

      {confirming && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-5">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="h-5 w-5 text-indigo-600" />
              <h2 className="text-base font-semibold text-gray-900">Confirm payment request</h2>
            </div>
            <p className="text-sm text-gray-600">
              This will queue {selectedBills.length === 1 ? 'a check' : `${selectedBills.length} checks`} totaling{' '}
              <span className="font-semibold tabular-nums">{money.format(selectedTotal)}</span> for your
              accounting firm to print and mail. Each bill is paid in full.
            </p>
            <ul className="mt-3 max-h-40 overflow-y-auto text-sm text-gray-700 space-y-1">
              {selectedBills.map((b) => (
                <li key={b.id} className="flex justify-between gap-3">
                  <span className="truncate">{b.vendorName ?? 'Vendor'}{b.vendorInvoiceNumber ? ` · ${b.vendorInvoiceNumber}` : ''}</span>
                  <span className="tabular-nums shrink-0">{money.format(num(b.balanceDue))}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setConfirming(false)}
                disabled={submitting}
                className="px-4 py-2 rounded-md border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => void submit()}
                disabled={submitting}
                className="px-4 py-2 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
              >
                {submitting ? 'Submitting…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PortalBillsPage;
