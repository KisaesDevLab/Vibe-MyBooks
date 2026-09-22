// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Reports → Transaction Report: the per-transaction report (header, journal
// lines, what it is linked to, each attachment right after its entry) for
// every transaction in a date range, packed several to a page.
//
// The server plans the report first (GET /transactions/report-plan): the
// matching transactions are split in date order into parts, each within the
// attachment limits, so nothing is ever left out. One part → one Open PDF
// button; several → a list, each built on demand when clicked
// (GET /transactions/report.pdf?…&part=N). Nothing is stored server-side.

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileText, Loader2, Paperclip } from 'lucide-react';
import { TXN_TYPE_LABELS, type TxnType } from '@kis-books/shared';
import { apiClient } from '../../api/client';
import { useTags } from '../../api/hooks/useTags';
import { useSessionState } from '../../hooks/useSessionState';
import { useDebouncedDate } from '../../hooks/useDebouncedValue';
import { useCompanyContext } from '../../providers/CompanyProvider';
import { ReportShell } from './ReportShell';
import { DateRangePicker } from './DateRangePicker';
import { AccountSelector } from '../../components/forms/AccountSelector';
import { ContactSelector } from '../../components/forms/ContactSelector';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../components/ui/Toaster';
import { openReportPdf } from '../transactions/openReportPdf';

interface ReportPart {
  index: number;
  startDate: string;
  endDate: string;
  transactionCount: number;
  attachmentCount: number;
  attachmentBytes: number;
}
interface ReportPlan {
  transactionCount: number;
  attachmentCount: number;
  parts: ReportPart[];
  truncated: boolean;
}

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${m}/${d}/${y}`;
}
function fmtBytes(n: number): string {
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
const TXN_TYPES = Object.keys(TXN_TYPE_LABELS) as TxnType[];
/** 'all' shows every basis; the lens otherwise mirrors the transactions list. */
type BasisLens = 'all' | 'cash' | 'accrual';

function monthStart(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function TransactionRangeReport() {
  const toast = useToast();
  const { activeCompanyId } = useCompanyContext();
  const [startDate, setStartDate] = useSessionState('txnreport.start', monthStart());
  const [endDate, setEndDate] = useSessionState('txnreport.end', today());
  const [txnType, setTxnType] = useSessionState<'' | TxnType>('txnreport.type', '');
  const [contactId, setContactId] = useSessionState('txnreport.contact', '');
  const [accountId, setAccountId] = useSessionState('txnreport.account', '');
  const [tagId, setTagId] = useSessionState('txnreport.tag', '');
  const [basis, setBasis] = useSessionState<BasisLens>('txnreport.basis', 'all');
  const [includeVoid, setIncludeVoid] = useSessionState('txnreport.void', false);
  // Which part is being built right now (0 = the single-part button).
  const [building, setBuilding] = useState<number | null>(null);

  const debStart = useDebouncedDate(startDate);
  const debEnd = useDebouncedDate(endDate);
  const { data: tagData } = useTags({ isActive: true });

  const params = new URLSearchParams();
  params.set('startDate', debStart);
  params.set('endDate', debEnd);
  if (txnType) params.set('txnType', txnType);
  if (contactId) params.set('contactId', contactId);
  if (accountId) params.set('accountId', accountId);
  if (tagId) params.set('tagId', tagId);
  if (basis !== 'all') params.set('basis', basis);
  if (includeVoid) params.set('includeVoid', 'true');
  const lens = params.toString();
  const badRange = !!startDate && !!endDate && startDate > endDate;

  // The plan is what the PDF will be built from, so the counts here and on
  // the report agree by construction.
  const plan = useQuery({
    queryKey: ['transactions', 'range-report-plan', lens, activeCompanyId],
    enabled: !!debStart && !!debEnd && !badRange,
    queryFn: () => apiClient<ReportPlan>(`/transactions/report-plan?${lens}`),
  });
  const parts = plan.data?.parts ?? [];

  const build = async (part: ReportPart | null) => {
    setBuilding(part?.index ?? 0);
    try {
      const q = new URLSearchParams(params);
      if (part && parts.length > 1) q.set('part', String(part.index));
      const suffix = part && parts.length > 1 ? `-part-${part.index}-of-${parts.length}` : '';
      const { skippedAttachments } = await openReportPdf(`/transactions/report.pdf?${q.toString()}`, {
        title: part && parts.length > 1 ? `Transaction Report — Part ${part.index}` : 'Transaction Report',
        fallbackFileName: `transaction-report-${startDate}-to-${endDate}${suffix}.pdf`,
      });
      if (skippedAttachments > 0) {
        toast.info(`${skippedAttachments} attachment${skippedAttachments === 1 ? '' : 's'} could not be included`, {
          detail: 'The report lists each one and why.',
        });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not build the report');
    } finally {
      setBuilding(null);
    }
  };

  return (
    <ReportShell
      title="Transaction Report"
      filters={
        <div className="space-y-3">
          <DateRangePicker startDate={startDate} endDate={endDate} onChange={(s, e) => { setStartDate(s); setEndDate(e); }} />
          <div className="flex flex-wrap items-end gap-4">
            <label className="flex flex-col gap-1 text-sm text-gray-600">
              Type
              <select
                aria-label="Transaction type"
                value={txnType}
                onChange={(e) => setTxnType(e.target.value as '' | TxnType)}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
              >
                <option value="">All types</option>
                {TXN_TYPES.map((t) => <option key={t} value={t}>{TXN_TYPE_LABELS[t]}</option>)}
              </select>
            </label>
            <label className="flex w-64 flex-col gap-1 text-sm text-gray-600">
              Name
              <ContactSelector value={contactId} onChange={setContactId} compact />
            </label>
            <label className="flex w-72 flex-col gap-1 text-sm text-gray-600">
              Account
              <AccountSelector value={accountId} onChange={setAccountId} compact />
            </label>
            <label className="flex flex-col gap-1 text-sm text-gray-600">
              Tag
              <select
                aria-label="Tag"
                value={tagId}
                onChange={(e) => setTagId(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
              >
                <option value="">Any tag</option>
                {(tagData?.tags ?? []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm text-gray-600">
              Basis
              <select
                aria-label="Basis"
                value={basis}
                onChange={(e) => setBasis(e.target.value as BasisLens)}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
              >
                <option value="all">All</option>
                <option value="cash">Cash</option>
                <option value="accrual">Accrual</option>
              </select>
            </label>
            <label className="flex items-center gap-2 pb-1.5 text-sm text-gray-600">
              <input type="checkbox" checked={includeVoid} onChange={(e) => setIncludeVoid(e.target.checked)} />
              Include voided
            </label>
          </div>
        </div>
      }
    >
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-4">
        <p className="text-sm text-gray-700">
          Every matching transaction with its details, journal lines and what it is linked to, several to a page.
          Each attachment is placed right after the entry it belongs to: images under the entry, PDF pages behind it.
        </p>
        {badRange ? (
          <p className="text-sm text-red-600">The start date is after the end date.</p>
        ) : plan.isLoading ? (
          <p className="flex items-center gap-2 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Planning…</p>
        ) : plan.isError ? (
          <p className="text-sm text-red-600">{plan.error instanceof Error ? plan.error.message : 'Could not plan the report.'}</p>
        ) : plan.data ? (
          <>
            <p className="text-sm text-gray-700">
              <strong className="tabular-nums">{plan.data.transactionCount.toLocaleString()}</strong> transaction{plan.data.transactionCount === 1 ? '' : 's'}
              {' '}with{' '}
              <strong className="tabular-nums">{plan.data.attachmentCount.toLocaleString()}</strong> attachment{plan.data.attachmentCount === 1 ? '' : 's'} match.
              {plan.data.truncated && (
                <span className="ml-1 text-amber-700">More than 10,000 matched; narrow the dates or add a filter for the rest.</span>
              )}
            </p>

            {parts.length <= 1 ? (
              <Button onClick={() => build(parts[0] ?? null)} loading={building !== null} disabled={plan.data.transactionCount === 0}>
                <FileText className="h-4 w-4 mr-1" /> Open PDF
              </Button>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-gray-700">
                  The attachments do not fit in one PDF, so the report is split into{' '}
                  <strong>{parts.length} parts</strong> in date order. Each part is built when you open it.
                </p>
                <table className="min-w-full text-sm">
                  <thead className="text-left text-xs uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="py-1.5 pr-4">Part</th>
                      <th className="py-1.5 pr-4">Dates</th>
                      <th className="py-1.5 pr-4 text-right">Transactions</th>
                      <th className="py-1.5 pr-4 text-right">Attachments</th>
                      <th className="py-1.5" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {parts.map((p) => (
                      <tr key={p.index}>
                        <td className="py-2 pr-4 font-medium text-gray-900">{p.index} of {parts.length}</td>
                        <td className="py-2 pr-4 whitespace-nowrap text-gray-700">{fmtDate(p.startDate)} – {fmtDate(p.endDate)}</td>
                        <td className="py-2 pr-4 text-right tabular-nums text-gray-700">{p.transactionCount.toLocaleString()}</td>
                        <td className="py-2 pr-4 text-right tabular-nums text-gray-700">
                          <span className="inline-flex items-center gap-1"><Paperclip className="h-3.5 w-3.5 text-gray-400" />{p.attachmentCount}</span>
                          {p.attachmentBytes > 0 && <span className="ml-1 text-xs text-gray-500">({fmtBytes(p.attachmentBytes)})</span>}
                        </td>
                        <td className="py-2 text-right">
                          <Button size="sm" variant="secondary" onClick={() => build(p)} loading={building === p.index} disabled={building !== null && building !== p.index}>
                            <FileText className="h-4 w-4 mr-1" /> View
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : null}
        <p className="text-xs text-gray-500">
          A part holds up to 250 transactions, 40 attachments and 100 MB of files; the report is split so nothing is left out.
        </p>
      </div>
    </ReportShell>
  );
}
