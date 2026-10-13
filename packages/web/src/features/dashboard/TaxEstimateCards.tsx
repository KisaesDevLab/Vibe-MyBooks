// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Company dashboard — Tax Estimator cards (OPEN-QUESTIONS.md Q52): "Next estimated payment",
// "Projected tax for the year" and "Paid vs required" per taxpayer linked to this company.
// The server decides who sees what (staff: every visible linked taxpayer, with the penalty
// estimate and Refresh; company owner: only the taxpayer they personally are, portal-style)
// and returns null when the cards are hidden (flag off, nothing linked, not entitled) — then
// this renders nothing. Figures are display-only: no tax math here.
import { Link } from 'react-router-dom';
import { CalendarClock, Landmark, RefreshCw, Scale } from 'lucide-react';
import type { TaxEstDashboardTaxpayerDTO, TaxEstDashboardAudience } from '@kis-books/shared';
import { useCompanyTaxEstimates, useRefreshCompanyTaxEstimate } from '../../api/hooks/useTaxEstimatorDashboard';
import { dollars, fmtDate, fmtMonth } from '../tax-estimator/estimate/format';

const CARD = 'bg-white rounded-lg border border-gray-200 shadow-sm p-5';

function sourceLabel(t: TaxEstDashboardTaxpayerDTO): string {
  if (!t.asOf) return '';
  return `${t.source === 'snapshot' ? 'Finalized estimate' : 'Live estimate'} as of ${fmtDate(t.asOf.slice(0, 10))}`;
}

function signed(v: string): string {
  const n = Number(v);
  if (n === 0) return 'no change';
  return `${n > 0 ? '+' : '−'}${dollars(Math.abs(n))}`;
}

function CardShell({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className={CARD}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm text-gray-500">{title}</p>
        <Icon className="h-5 w-5 text-gray-400" aria-hidden />
      </div>
      {children}
    </div>
  );
}

function NextPaymentCard({ t }: { t: TaxEstDashboardTaxpayerDTO }) {
  const rows = t.jurisdictions.filter((j) => j.estimatesRequired);
  return (
    <CardShell title="Next estimated payment" icon={CalendarClock}>
      {rows.length === 0 ? <p className="text-sm text-gray-500">No estimated payments are required for {t.taxYear}.</p> : (
        <ul className="space-y-2">
          {rows.map((j) => (
            <li key={j.jurisdiction} className="text-sm">
              <p className="text-gray-500 text-xs">{j.label}</p>
              {j.nextVoucher ? (
                <p className="flex items-baseline justify-between gap-2">
                  <span className="text-gray-900 font-semibold">{j.nextVoucher.label} · {fmtDate(j.nextVoucher.dueDate)}</span>
                  <span className="tabular-nums text-gray-900">{dollars(j.nextVoucher.amount)}</span>
                  <span className={`text-xs font-medium ${j.nextVoucher.status === 'paid' ? 'text-green-600' : 'text-amber-600'}`}>
                    {j.nextVoucher.status === 'paid' ? 'Paid' : 'Unpaid'}
                  </span>
                </p>
              ) : <p className="text-gray-500">No vouchers left for {t.taxYear}</p>}
            </li>
          ))}
        </ul>
      )}
    </CardShell>
  );
}

function ProjectedCard({ t }: { t: TaxEstDashboardTaxpayerDTO }) {
  return (
    <CardShell title={`Projected tax for ${t.taxYear}`} icon={Landmark}>
      <p className="text-2xl font-bold text-gray-900 tabular-nums">{dollars(t.totals?.total)}</p>
      <p className="text-xs text-gray-500 mt-1">Federal {dollars(t.totals?.federal)} · State {dollars(t.totals?.state)}</p>
      {t.changeSinceSnapshot && (
        <p className="text-xs text-gray-600 mt-1" data-testid="change-since-snapshot">
          {signed(t.changeSinceSnapshot.amount)} since the estimate finalized {fmtDate(t.changeSinceSnapshot.snapshotAt.slice(0, 10))}
        </p>
      )}
      {t.booksThrough && <p className="text-xs text-gray-400 mt-1">Books through {fmtMonth(t.booksThrough)}</p>}
    </CardShell>
  );
}

function PaidVsRequiredCard({ t, audience }: { t: TaxEstDashboardTaxpayerDTO; audience: TaxEstDashboardAudience }) {
  const rows = t.jurisdictions.filter((j) => j.estimatesRequired);
  const behind = Number(t.shortfall) > 0;
  return (
    <CardShell title="Paid vs required to date" icon={Scale}>
      {rows.length === 0 ? <p className="text-sm text-gray-500">Nothing required yet.</p> : (
        <ul className="space-y-1">
          {rows.map((j) => (
            <li key={j.jurisdiction} className="text-sm flex justify-between gap-2">
              <span className="text-gray-600">{j.label}</span>
              <span className="tabular-nums text-gray-900">{dollars(j.paidToDate)} of {dollars(j.requiredToDate)}</span>
            </li>
          ))}
        </ul>
      )}
      {behind ? (
        <p className="text-sm text-red-600 mt-2 font-medium" data-testid="shortfall">
          Behind by {dollars(t.shortfall)}
          {audience === 'staff' && t.penalty != null && Number(t.penalty) > 0 && <span className="font-normal"> · est. penalty {dollars(t.penalty)}</span>}
        </p>
      ) : rows.length > 0 && <p className="text-sm text-green-600 mt-2">On track</p>}
    </CardShell>
  );
}

function TaxpayerBlock({ t, audience }: { t: TaxEstDashboardTaxpayerDTO; audience: TaxEstDashboardAudience }) {
  const refresh = useRefreshCompanyTaxEstimate();
  const staff = audience === 'staff';
  const href = `/tax-estimator/taxpayers/${t.taxpayerId}/estimate?year=${t.taxYear}`;
  return (
    <div className="space-y-2" data-testid={`tax-est-${t.taxpayerId}`}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-sm font-semibold text-gray-700">
          Estimated taxes · {staff ? <Link className="text-primary-700 hover:underline" to={href}>{t.displayName}</Link> : t.displayName} · {t.taxYear}
        </h2>
        <div className="flex items-center gap-3 text-xs text-gray-400">
          {t.status === 'ok' && <span>{sourceLabel(t)}</span>}
          {staff && (
            <button type="button" className="inline-flex items-center gap-1 text-primary-700 hover:underline disabled:opacity-50"
              disabled={refresh.isPending} onClick={() => refresh.mutate(t.taxpayerId)}>
              <RefreshCw className={`h-3.5 w-3.5 ${refresh.isPending ? 'animate-spin' : ''}`} aria-hidden /> Refresh
            </button>
          )}
        </div>
      </div>
      {refresh.isError && <p className="text-xs text-red-600" role="alert">{refresh.error instanceof Error ? refresh.error.message : 'Could not refresh the estimate'}</p>}
      {t.status === 'not_computed' ? (
        <div className={`${CARD} text-sm text-gray-500`}>
          Not computed yet — <Link className="text-primary-700 hover:underline" to={href}>Open taxpayer</Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <NextPaymentCard t={t} />
          <ProjectedCard t={t} />
          <PaidVsRequiredCard t={t} audience={audience} />
        </div>
      )}
    </div>
  );
}

export function TaxEstimateCards() {
  const { data } = useCompanyTaxEstimates();
  // Hidden while loading, on error and when the server says there is nothing to show.
  if (!data || data.taxpayers.length === 0) return null;
  return (
    <section className="space-y-4" aria-label="Estimated taxes">
      {data.taxpayers.map((t) => <TaxpayerBlock key={t.taxpayerId} t={t} audience={data.audience} />)}
    </section>
  );
}
