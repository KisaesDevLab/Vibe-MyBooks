// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Tax Estimator home — firm-wide cards (OPEN-QUESTIONS.md Q52): "Vouchers due in the next 30
// days" and "Behind on payments" across every taxpayer the caller may see (D17 / D18, decided
// server-side). Loading never computes an estimate: figures are the newest stored live
// estimate or finalized snapshot, each labelled with its as-of date; the per-row Refresh
// computes that one taxpayer. Hidden when the server returns null (no visible taxpayer).
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, CalendarClock, RefreshCw } from 'lucide-react';
import type { TaxEstDashboardSource } from '@kis-books/shared';
import { useFirmTaxEstDashboard, useRefreshFirmTaxEstimate } from '../../../api/hooks/useTaxEstimatorDashboard';
import { dollars, fmtDate } from '../estimate/format';

const CARD = 'bg-white rounded-lg border border-gray-200 shadow-sm p-4';
const TH = 'py-1.5 px-2 text-left text-xs font-medium text-gray-500';
const TD = 'py-1.5 px-2 text-sm';

const asOf = (source: TaxEstDashboardSource, iso: string) => `${source === 'snapshot' ? 'Finalized' : 'Live'} · as of ${fmtDate(iso.slice(0, 10))}`;

function RefreshButton({ taxpayerId, taxYear, label }: { taxpayerId: string; taxYear: number; label: string }) {
  const refresh = useRefreshFirmTaxEstimate();
  return (
    <button type="button" aria-label={label} title={refresh.isError ? 'Could not refresh the estimate' : label}
      className={`p-1 rounded hover:bg-gray-100 disabled:opacity-50 ${refresh.isError ? 'text-red-600' : 'text-gray-400 hover:text-primary-700'}`}
      disabled={refresh.isPending} onClick={(e) => { e.stopPropagation(); refresh.mutate({ taxpayerId, taxYear }); }}>
      <RefreshCw className={`h-3.5 w-3.5 ${refresh.isPending ? 'animate-spin' : ''}`} aria-hidden />
    </button>
  );
}

export function FirmDashboardCards() {
  const navigate = useNavigate();
  const { data } = useFirmTaxEstDashboard();
  if (!data) return null;
  const open = (id: string, year: number) => navigate(`/tax-estimator/taxpayers/${id}/estimate?year=${year}`);
  return (
    <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4" aria-label="Firm estimated-tax overview">
      <div className={CARD}>
        <div className="flex items-center gap-2 mb-2">
          <CalendarClock className="h-4 w-4 text-gray-400" aria-hidden />
          <h2 className="text-sm font-semibold text-gray-700">Vouchers due in the next {data.windowDays} days</h2>
          <span className="ml-auto text-xs text-gray-400">{data.vouchersDue.length}</span>
        </div>
        {data.vouchersDue.length === 0 ? <p className="text-sm text-gray-500 py-2">No vouchers due in the next {data.windowDays} days.</p> : (
          <div className="max-h-72 overflow-y-auto overflow-x-auto">
            <table className="min-w-full">
              <thead className="border-b"><tr>
                <th className={TH}>Taxpayer</th><th className={TH}>Jurisdiction</th><th className={TH}>Due</th>
                <th className={`${TH} text-right`}>Amount</th><th className={TH}>Status</th><th className={TH}><span className="sr-only">Refresh</span></th>
              </tr></thead>
              <tbody>
                {data.vouchersDue.map((v) => (
                  <tr key={`${v.taxpayerId}|${v.taxYear}|${v.jurisdiction}|${v.installment}`} className="border-b last:border-0 hover:bg-gray-50 cursor-pointer"
                    onClick={() => open(v.taxpayerId, v.taxYear)}>
                    <td className={TD}>
                      <span className="text-primary-700">{v.displayName}</span>
                      <span className="block text-xs text-gray-400">{asOf(v.source, v.asOf)}</span>
                    </td>
                    <td className={TD}>{v.jurisdictionLabel} <span className="text-gray-400">{v.installment}</span></td>
                    <td className={`${TD} whitespace-nowrap`}>{fmtDate(v.dueDate)}</td>
                    <td className={`${TD} text-right tabular-nums`}>{dollars(v.amount)}</td>
                    <td className={TD}><span className={v.status === 'paid' ? 'text-green-600' : 'text-amber-600'}>{v.status === 'paid' ? 'Paid' : 'Unpaid'}</span></td>
                    <td className={TD}><RefreshButton taxpayerId={v.taxpayerId} taxYear={v.taxYear} label={`Refresh ${v.displayName}`} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div className={CARD}>
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className="h-4 w-4 text-gray-400" aria-hidden />
          <h2 className="text-sm font-semibold text-gray-700">Behind on payments</h2>
          <span className="ml-auto text-xs text-gray-400">{data.behind.length}</span>
        </div>
        {data.behind.length === 0 ? <p className="text-sm text-gray-500 py-2">No taxpayer is behind on estimated payments.</p> : (
          <div className="max-h-72 overflow-y-auto overflow-x-auto">
            <table className="min-w-full">
              <thead className="border-b"><tr>
                <th className={TH}>Taxpayer</th><th className={TH}>Year</th><th className={`${TH} text-right`}>Shortfall</th>
                <th className={`${TH} text-right`}>Est. penalty</th><th className={TH}><span className="sr-only">Refresh</span></th>
              </tr></thead>
              <tbody>
                {data.behind.map((b) => (
                  <tr key={`${b.taxpayerId}|${b.taxYear}`} className="border-b last:border-0 hover:bg-gray-50 cursor-pointer" onClick={() => open(b.taxpayerId, b.taxYear)}>
                    <td className={TD}>
                      <span className="text-primary-700">{b.displayName}</span>
                      <span className="block text-xs text-gray-400">{asOf(b.source, b.asOf)}</span>
                    </td>
                    <td className={TD}>{b.taxYear}</td>
                    <td className={`${TD} text-right tabular-nums text-red-600`}>{dollars(b.shortfall)}</td>
                    <td className={`${TD} text-right tabular-nums`}>{dollars(b.penalty)}</td>
                    <td className={TD}><RefreshButton taxpayerId={b.taxpayerId} taxYear={b.taxYear} label={`Refresh ${b.displayName}`} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {data.notComputed.length > 0 && (
        <div className="lg:col-span-2 text-xs text-gray-500 flex flex-wrap items-center gap-x-3 gap-y-1" data-testid="not-computed">
          <span>Not computed yet ({data.notComputed.length}):</span>
          {data.notComputed.map((n) => (
            <span key={`${n.taxpayerId}|${n.taxYear}`} className="inline-flex items-center gap-0.5">
              <button type="button" className="text-primary-700 hover:underline" onClick={() => open(n.taxpayerId, n.taxYear)}>{n.displayName}</button>
              <RefreshButton taxpayerId={n.taxpayerId} taxYear={n.taxYear} label={`Compute ${n.displayName}`} />
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
