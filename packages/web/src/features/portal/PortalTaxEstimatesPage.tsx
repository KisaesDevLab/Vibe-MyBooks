// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Tax Estimator Phase 13 — client portal estimate (UI-SPEC §05, mockup
// 05-client-portal-phone.html). Read-only and phone-first. Renders ONLY the
// allow-listed PortalTaxEstimateDTO the server projects: totals, voucher due
// dates / amounts, payments and the firm disclaimer. Never other owners,
// adjustments, rates, traces or readiness details — the server does not send
// them and this page must not go looking for them.

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, MessageSquare, Receipt } from 'lucide-react';
import type {
  PortalTaxEstimateDTO, PortalTaxEstimateListDTO, PortalTaxEstimateResponseDTO, PortalTaxInstallmentDTO, PortalTaxJurisdictionDTO,
} from '@kis-books/shared';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { usePortal } from './PortalLayout';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0, minimumFractionDigits: 0 });
const usd = (v: string | number | null | undefined) => {
  const n = Number(v ?? 0);
  return money.format(Number.isFinite(n) ? n : 0);
};
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** 'YYYY-MM-DD' -> 'Jan 15, 2027' (no timezone shift). */
function fmtDate(iso: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
  return m ? `${MONTHS[Number(m[2]) - 1]} ${Number(m[3])}, ${m[1]}` : '';
}
const fmtShortDate = (iso: string | null | undefined) => fmtDate(iso).replace(/, \d{4}$/, '');
function fmtMonth(ym: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})/.exec(ym ?? '');
  return m ? `${MONTHS[Number(m[2]) - 1]} ${m[1]}` : '';
}
function fmtStamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}
const todayIso = () => new Date().toISOString().slice(0, 10);
const base = () => `${import.meta.env.BASE_URL}api/portal/tax-estimates`;

type ListState =
  | { kind: 'loading' }
  | { kind: 'not_enabled' }
  | { kind: 'error' }
  | { kind: 'ready'; list: PortalTaxEstimateListDTO };

type DetailState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'unavailable' }
  | { kind: 'error' }
  | { kind: 'ready'; data: PortalTaxEstimateResponseDTO };

function StatusBadge({ inst }: { inst: PortalTaxInstallmentDTO }) {
  if (inst.status === 'paid') return <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">Paid</span>;
  if (Number(inst.paid) > 0) return <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">{usd(inst.remaining)} short</span>;
  if (inst.dueDate < todayIso()) return <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">Past due</span>;
  return <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">Due</span>;
}

function History({ j }: { j: PortalTaxJurisdictionDTO }) {
  if (!j.estimatesRequired || j.installments.length === 0) return null;
  return (
    <section className="bg-white border border-gray-200 rounded-lg p-4" aria-label={`${j.label} payments`}>
      <h2 className="text-sm font-semibold text-gray-900 mb-2">{j.label} payments</h2>
      <ul className="divide-y divide-gray-100">
        {j.installments.map((i) => (
          <li key={`${i.label}:${i.dueDate}`} className="flex items-center justify-between gap-3 py-2">
            <div className="min-w-0">
              <p className="text-sm text-gray-900">{i.label} <span className="text-gray-500">&middot; due {fmtShortDate(i.dueDate)}</span></p>
              <p className="text-xs text-gray-500">
                {Number(i.paid) > 0 ? `Paid ${usd(i.paid)}${i.paidOn ? ` · ${fmtShortDate(i.paidOn)}` : ''}` : 'Nothing paid yet'}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-sm font-semibold tabular-nums text-gray-900">{usd(i.amount)}</p>
              <StatusBadge inst={i} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function EstimateView({ e, voucherHref }: { e: PortalTaxEstimateDTO; voucherHref: string }) {
  const federal = e.jurisdictions.find((j) => j.jurisdiction === 'federal');
  const nextDue = e.jurisdictions.map((j) => j.nextPayment?.dueDate).filter((d): d is string => !!d).sort()[0];
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Your {e.taxYear} tax estimate</h1>
        <p className="text-sm text-gray-600">
          {e.booksThrough ? `Based on your books through ${fmtMonth(e.booksThrough)}` : 'Based on your books'}
          {' · '}
          {e.source === 'live' ? `as of ${fmtStamp(e.asOf)}` : `prepared ${fmtDate(e.asOf.slice(0, 10))}`}
        </p>
      </div>

      <section className="bg-white border border-gray-200 rounded-lg p-4" aria-label="Next payments">
        <h2 className="text-sm font-semibold text-gray-900 mb-2">Next payments{nextDue ? ` · due ${fmtDate(nextDue)}` : ''}</h2>
        <ul className="divide-y divide-gray-100">
          {e.jurisdictions.map((j) => (
            <li key={j.jurisdiction} className="flex items-center justify-between py-2">
              <span className="text-sm text-gray-800">{j.label}</span>
              <span className="text-sm font-semibold tabular-nums text-gray-900">
                {j.nextPayment ? (
                  <>{usd(j.nextPayment.amount)}{j.nextPayment.dueDate !== nextDue && <span className="ml-1 text-xs font-normal text-gray-500">due {fmtShortDate(j.nextPayment.dueDate)}</span>}</>
                ) : <span className="font-normal text-gray-500">None required</span>}
              </span>
            </li>
          ))}
        </ul>
        <a
          href={voucherHref}
          download
          className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          <Download className="h-4 w-4" /> Download payment vouchers
        </a>
      </section>

      <section className="bg-white border border-gray-200 rounded-lg p-4" aria-label="Projected total">
        <h2 className="text-sm font-semibold text-gray-900">Projected {e.taxYear} total</h2>
        <p className="text-3xl font-bold tabular-nums text-gray-900 mt-1">{usd(e.totals.total)}</p>
        <dl className="mt-2 space-y-1 text-sm">
          <div className="flex justify-between"><dt className="text-gray-600">Federal</dt><dd className="tabular-nums">{usd(e.totals.federal)}</dd></div>
          <div className="flex justify-between"><dt className="text-gray-600">State</dt><dd className="tabular-nums">{usd(e.totals.state)}</dd></div>
          {federal && (
            <>
              <div className="flex justify-between"><dt className="text-gray-600">Federal estimates paid so far</dt><dd className="tabular-nums">{usd(federal.totals.estimatesPaid)}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-600">Federal withheld from wages</dt><dd className="tabular-nums">{usd(federal.totals.withholding)}</dd></div>
            </>
          )}
        </dl>
      </section>

      {e.jurisdictions.map((j) => <History key={j.jurisdiction} j={j} />)}

      {e.payments.length > 0 && (
        <section className="bg-white border border-gray-200 rounded-lg p-4" aria-label="Payments received">
          <h2 className="text-sm font-semibold text-gray-900 mb-2">Payments on record</h2>
          <ul className="divide-y divide-gray-100">
            {e.payments.map((p, idx) => (
              <li key={`${p.jurisdiction}:${p.date ?? 'carry'}:${idx}`} className="flex justify-between py-1.5 text-sm">
                <span className="text-gray-700">
                  {e.jurisdictions.find((j) => j.jurisdiction === p.jurisdiction)?.label ?? p.jurisdiction}
                  {' · '}{p.date ? fmtDate(p.date) : 'Prior-year overpayment'}
                </span>
                <span className="tabular-nums text-gray-900">{usd(p.amount)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Link
        to="/portal/questions"
        className="flex items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
      >
        <MessageSquare className="h-4 w-4" /> Message your accountant
      </Link>

      <p className="text-xs text-gray-500" data-testid="tax-disclaimer">{e.disclaimer}</p>
      {e.firmName && <p className="text-[11px] text-gray-400">Prepared by {e.firmName}</p>}
    </div>
  );
}

export function PortalTaxEstimatesPage() {
  const { activeCompanyId } = usePortal();
  const [list, setList] = useState<ListState>({ kind: 'loading' });
  const [listAttempt, setListAttempt] = useState(0);
  const [taxpayerId, setTaxpayerId] = useState<string | null>(null);
  const [year, setYear] = useState<number | null>(null);
  const [detail, setDetail] = useState<DetailState>({ kind: 'idle' });
  const [detailAttempt, setDetailAttempt] = useState(0);

  useEffect(() => {
    if (!activeCompanyId) return;
    let cancelled = false;
    setList({ kind: 'loading' });
    fetch(`${base()}?companyId=${activeCompanyId}`, { credentials: 'include' })
      .then(async (r) => {
        if (r.status === 403 || r.status === 404) return { kind: 'not_enabled' } as const;
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const body = (await r.json()) as PortalTaxEstimateListDTO;
        return body.featureEnabled === false ? ({ kind: 'not_enabled' } as const) : ({ kind: 'ready', list: body } as const);
      })
      .then((s) => {
        if (cancelled) return;
        setList(s);
        if (s.kind === 'ready') {
          const first = s.list.taxpayers[0];
          setTaxpayerId((cur) => (cur && s.list.taxpayers.some((t) => t.id === cur) ? cur : first?.id ?? null));
        }
      })
      .catch(() => { if (!cancelled) setList({ kind: 'error' }); });
    return () => { cancelled = true; };
  }, [activeCompanyId, listAttempt]);

  const taxpayers = list.kind === 'ready' ? list.list.taxpayers : [];
  const current = taxpayers.find((t) => t.id === taxpayerId);
  const years = current?.years ?? [];
  const effectiveYear = year != null && years.includes(year) ? year : years[0];

  useEffect(() => {
    if (!activeCompanyId || !current) { setDetail({ kind: 'idle' }); return; }
    let cancelled = false;
    setDetail({ kind: 'loading' });
    const q = `companyId=${activeCompanyId}${effectiveYear != null ? `&year=${effectiveYear}` : ''}`;
    fetch(`${base()}/${current.id}?${q}`, { credentials: 'include' })
      .then(async (r) => {
        if (r.status === 403 || r.status === 404) return { kind: 'unavailable' } as const;
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return { kind: 'ready', data: (await r.json()) as PortalTaxEstimateResponseDTO } as const;
      })
      .then((s) => { if (!cancelled) setDetail(s); })
      .catch(() => { if (!cancelled) setDetail({ kind: 'error' }); });
    return () => { cancelled = true; };
  }, [activeCompanyId, current, effectiveYear, detailAttempt]);

  const notice = (text: string, retry?: () => void) => (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="bg-amber-50 border border-amber-200 rounded-md px-4 py-3 text-sm text-amber-800">
        <p>{text}</p>
        {retry && (
          <button onClick={retry} className="mt-2 text-sm font-medium text-amber-900 underline hover:no-underline">Retry</button>
        )}
      </div>
    </div>
  );

  if (list.kind === 'loading') return <div className="py-10"><LoadingSpinner /></div>;
  if (list.kind === 'not_enabled') return notice('Tax estimates are not enabled for your account. Ask your accountant if you would like to see them here.');
  if (list.kind === 'error') return notice('Failed to load your tax estimate.', () => setListAttempt((a) => a + 1));
  if (taxpayers.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="text-center py-12 border border-dashed border-gray-300 rounded-lg">
          <Receipt className="mx-auto h-10 w-10 text-gray-400 mb-3" />
          <p className="text-sm text-gray-500">No tax estimate shared yet.</p>
        </div>
      </div>
    );
  }

  const voucherHref = current
    ? `${base()}/${current.id}/vouchers.pdf?companyId=${activeCompanyId ?? ''}${effectiveYear != null ? `&year=${effectiveYear}` : ''}`
    : '#';

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
      {(taxpayers.length > 1 || years.length > 1) && (
        <div className="flex flex-wrap gap-2">
          {taxpayers.length > 1 && (
            <select
              aria-label="Taxpayer"
              value={current?.id ?? ''}
              onChange={(ev) => { setTaxpayerId(ev.target.value); setYear(null); }}
              className="text-sm border border-gray-300 rounded-md px-2 py-1 bg-white"
            >
              {taxpayers.map((t) => <option key={t.id} value={t.id}>{t.displayName}</option>)}
            </select>
          )}
          {years.length > 1 && (
            <select
              aria-label="Tax year"
              value={effectiveYear ?? ''}
              onChange={(ev) => setYear(Number(ev.target.value))}
              className="text-sm border border-gray-300 rounded-md px-2 py-1 bg-white"
            >
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          )}
        </div>
      )}
      {current && taxpayers.length === 1 && <p className="text-sm font-medium text-gray-700">{current.displayName}</p>}

      {detail.kind === 'loading' || detail.kind === 'idle' ? <div className="py-10"><LoadingSpinner /></div>
        : detail.kind === 'unavailable' ? notice('This tax estimate is not available.')
        : detail.kind === 'error' ? notice('Failed to load your tax estimate.', () => setDetailAttempt((a) => a + 1))
        : detail.data.estimate == null ? (
          <div className="bg-white border border-dashed border-gray-300 rounded-lg p-6 text-center text-sm text-gray-600">
            Your accountant has not finalized an estimate for {effectiveYear ?? 'this year'} yet. Check back soon.
          </div>
        ) : <EstimateView e={detail.data.estimate} voucherHref={voucherHref} />}
    </div>
  );
}
