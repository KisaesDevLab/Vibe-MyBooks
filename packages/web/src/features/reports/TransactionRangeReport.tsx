// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Reports → Transaction Report: the per-transaction report (header, journal
// lines, what it is linked to, every attachment) for every transaction in a
// date range, packed several to a page. The server builds the PDF
// (GET /transactions/report.pdf); this screen picks the range and lenses and
// shows how many transactions they match before the PDF is asked for.

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileText, Loader2 } from 'lucide-react';
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

/** Mirrors MAX_RANGE_TRANSACTIONS on the server; the PDF says so too. */
const MAX_TRANSACTIONS = 250;
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
  const [building, setBuilding] = useState(false);

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
  const lens = params.toString();

  // How many transactions the PDF will hold: the list's own count, so the
  // number here and the number on the report agree. Voids are counted
  // separately because the list has no "not void" filter.
  const count = useQuery({
    queryKey: ['transactions', 'range-report-count', lens, activeCompanyId],
    enabled: !!debStart && !!debEnd && debStart <= debEnd,
    queryFn: async () => {
      const all = await apiClient<{ total: number }>(`/transactions?${lens}&limit=1`);
      const voided = await apiClient<{ total: number }>(`/transactions?${lens}&status=void&limit=1`);
      return { all: all.total, voided: voided.total };
    },
  });
  const matching = count.data ? (includeVoid ? count.data.all : count.data.all - count.data.voided) : null;
  const badRange = !!startDate && !!endDate && startDate > endDate;

  const build = async () => {
    setBuilding(true);
    try {
      const q = new URLSearchParams(params);
      if (includeVoid) q.set('includeVoid', 'true');
      const { skippedAttachments } = await openReportPdf(`/transactions/report.pdf?${q.toString()}`, {
        title: 'Transaction Report', fallbackFileName: `transaction-report-${startDate}-to-${endDate}.pdf`,
      });
      if (skippedAttachments > 0) {
        toast.info(`${skippedAttachments} attachment${skippedAttachments === 1 ? '' : 's'} could not be included`, {
          detail: 'The report lists each one and why.',
        });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not build the report');
    } finally {
      setBuilding(false);
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
          One PDF with every matching transaction: its details, journal lines and what it is linked to,
          several to a page, followed by every attachment in transaction order.
        </p>
        {badRange ? (
          <p className="text-sm text-red-600">The start date is after the end date.</p>
        ) : count.isLoading ? (
          <p className="flex items-center gap-2 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Counting…</p>
        ) : matching !== null ? (
          <p className="text-sm text-gray-700">
            <strong className="tabular-nums">{matching.toLocaleString()}</strong> transaction{matching === 1 ? '' : 's'} match.
            {matching > MAX_TRANSACTIONS && (
              <span className="ml-1 text-amber-700">
                The report holds the first {MAX_TRANSACTIONS}; narrow the dates or add a filter for the rest.
              </span>
            )}
          </p>
        ) : null}
        <Button onClick={build} loading={building} disabled={badRange || matching === 0}>
          <FileText className="h-4 w-4 mr-1" /> Open PDF
        </Button>
        <p className="text-xs text-gray-500">
          Attachments are limited to 40 files and 300 pages per report; the report lists any it had to leave out.
        </p>
      </div>
    </ReportShell>
  );
}
