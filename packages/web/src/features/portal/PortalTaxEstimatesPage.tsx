// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Tax Estimator Phase 13 — client portal estimate (UI-SPEC §05, mockup
// 05-client-portal-phone.html). Read-only and phone-first. Renders ONLY the
// allow-listed PortalTaxEstimateDTO the server projects: totals, voucher due
// dates / amounts, payments and the firm disclaimer. Never other owners,
// adjustments, rates, traces or readiness details — the server does not send
// them and this page must not go looking for them.
// Q51: what a section shows depends on the contact's options, decided on the SERVER —
// a section whose key is absent is simply not rendered (installments / next payment and
// vouchers, payments on record), the calculation summary and the estimate PDF appear when
// the server sends them, and a scenario picker appears when more than one is shared.

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, FileText, MessageSquare, Receipt } from 'lucide-react';
import type {
  PortalTaxCalcSummaryDTO, PortalTaxEstimateDTO, PortalTaxEstimateListDTO, PortalTaxEstimateResponseDTO, PortalTaxInstallmentDTO, PortalTaxJurisdictionDTO,
} from '@kis-books/shared';
import { portalDefaultYear } from '@kis-books/shared';
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
  // QA2-01: a partly paid installment whose due date has passed is past due by what is left.
  if (Number(inst.paid) > 0 && inst.dueDate < todayIso()) return <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">{usd(inst.remaining)} past due</span>;
  if (Number(inst.paid) > 0) return <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">{usd(inst.remaining)} short</span>;
  if (inst.dueDate < todayIso()) return <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">Past due</span>;
  return <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">Due</span>;
}

/**
 * QA D12: never "Nothing paid yet" beside a green "Paid" badge — an installment covered by
 * withholding or an earlier overpayment says so; a payment date always carries its year.
 */
export function installmentPaidText(i: PortalTaxInstallmentDTO): string {
  if (Number(i.paid) > 0) return `Paid ${usd(i.paid)}${i.paidOn ? ` · ${fmtDate(i.paidOn)}` : ''}`;
  if (i.status === 'paid') return 'Covered by withholding or earlier payments';
  return 'Nothing paid yet';
}

/**
 * QA2-07: what the Next payments row says when there is no upcoming payment. "None required"
 * only when the jurisdiction requires no estimates (the AR case); a covered schedule says
 * "Nothing due", and money still owed after the last due date says it is past due.
 */
export function noNextPaymentText(j: PortalTaxJurisdictionDTO): string {
  if (!j.estimatesRequired) return 'None required';
  if (Number(j.totals.remaining) > 0) return `${usd(j.totals.remaining)} past due`;
  return 'Nothing due';
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
                {installmentPaidText(i)}
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

/** Q51: the client-friendly calculation summary (sent only when the firm shares it). */
function CalcSummary({ s, taxYear }: { s: PortalTaxCalcSummaryDTO; taxYear: number }) {
  const Row = ({ label, value, bold, credit }: { label: string; value: string; bold?: boolean; credit?: boolean }) => (
    <div className={`flex justify-between gap-3 py-1 ${bold ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
      <dt className="min-w-0">{label}</dt>
      <dd className="tabular-nums shrink-0">{credit && Number(value) !== 0 ? `-${usd(value)}` : usd(value)}</dd>
    </div>
  );
  const nz = (v: string) => Number(v) !== 0;
  return (
    <section className="bg-white border border-gray-200 rounded-lg p-4" aria-label="How your estimate is calculated">
      <h2 className="text-sm font-semibold text-gray-900 mb-1">How your {taxYear} estimate is calculated</h2>
      <p className="text-xs text-gray-500 mb-2">Full-year projection. Business amounts are your share.</p>
      <dl className="text-sm divide-y divide-gray-100">
        <div className="pb-1">
          {s.businesses.map((b, i) => <Row key={`b${i}`} label={b.name || 'Business'} value={b.amount} />)}
          {s.otherIncome.map((o) => <Row key={o.label} label={o.label} value={o.amount} />)}
          <Row label="Total income" value={s.totalIncome} bold />
        </div>
        <div className="py-1">
          {nz(s.adjustmentsTotal) && <Row label="Adjustments to income" value={s.adjustmentsTotal} credit />}
          <Row label="Adjusted gross income" value={s.agi} bold />
          <Row label={s.deduction.kind === 'itemized' ? 'Itemized deductions' : 'Standard deduction'} value={s.deduction.amount} credit />
          {nz(s.additionalDeductions) && <Row label="Additional deductions" value={s.additionalDeductions} credit />}
          {nz(s.qbiDeduction) && <Row label="Qualified business income deduction" value={s.qbiDeduction} credit />}
          <Row label="Taxable income" value={s.taxableIncome} bold />
        </div>
        <div className="py-1">
          <Row label="Income tax" value={s.regularTax} />
          {nz(s.credits) && <Row label="Credits" value={s.credits} credit />}
          {nz(s.selfEmploymentTax) && <Row label="Self-employment tax" value={s.selfEmploymentTax} />}
          {nz(s.additionalMedicareTax) && <Row label="Additional Medicare tax" value={s.additionalMedicareTax} />}
          {nz(s.niit) && <Row label="Net investment income tax" value={s.niit} />}
          <Row label="Federal total" value={s.federalTotal} bold />
        </div>
        {s.states.length > 0 && (
          <div className="py-1">
            {s.states.map((st) => <Row key={st.state} label={st.label} value={st.amount} />)}
            <Row label="State total" value={s.stateTotal} bold />
          </div>
        )}
        <div className="pt-1"><Row label="Total estimated tax" value={s.total} bold /></div>
      </dl>
    </section>
  );
}

function EstimateView({ e, voucherHref, pdfHref }: { e: PortalTaxEstimateDTO; voucherHref: string; pdfHref: string | null }) {
  const jurisdictions = e.jurisdictions;
  const federal = jurisdictions?.find((j) => j.jurisdiction === 'federal');
  const nextDue = (jurisdictions ?? []).map((j) => j.nextPayment?.dueDate).filter((d): d is string => !!d).sort()[0];
  const labelOf = (code: string) => jurisdictions?.find((j) => j.jurisdiction === code)?.label ?? (code === 'federal' ? 'Federal (IRS)' : code);
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

      {jurisdictions && (
        <section className="bg-white border border-gray-200 rounded-lg p-4" aria-label="Next payments">
          <h2 className="text-sm font-semibold text-gray-900 mb-2">Next payments{nextDue ? ` · due ${fmtDate(nextDue)}` : ''}</h2>
          <ul className="divide-y divide-gray-100">
            {jurisdictions.map((j) => (
              <li key={j.jurisdiction} className="flex items-center justify-between py-2">
                <span className="text-sm text-gray-800">{j.label}</span>
                <span className="text-sm font-semibold tabular-nums text-gray-900">
                  {j.nextPayment ? (
                    <>{usd(j.nextPayment.amount)}{j.nextPayment.dueDate !== nextDue && <span className="ml-1 text-xs font-normal text-gray-500">due {fmtShortDate(j.nextPayment.dueDate)}</span>}</>
                  ) : <span className="font-normal text-gray-500">{noNextPaymentText(j)}</span>}
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
      )}

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
        {pdfHref && (
          <a
            href={pdfHref}
            download
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
          >
            <FileText className="h-4 w-4" /> Download estimate (PDF)
          </a>
        )}
      </section>

      {e.calculationSummary && <CalcSummary s={e.calculationSummary} taxYear={e.taxYear} />}

      {(jurisdictions ?? []).map((j) => <History key={j.jurisdiction} j={j} />)}

      {e.payments && e.payments.length > 0 && (
        <section className="bg-white border border-gray-200 rounded-lg p-4" aria-label="Payments received">
          <h2 className="text-sm font-semibold text-gray-900 mb-2">Payments on record</h2>
          <ul className="divide-y divide-gray-100">
            {e.payments.map((p, idx) => (
              <li key={`${p.jurisdiction}:${p.date ?? 'carry'}:${idx}`} className="flex justify-between py-1.5 text-sm">
                <span className="text-gray-700">
                  {labelOf(p.jurisdiction)}
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
  // Q51: the picked scenario (null = the server's default, Base).
  const [scenarioId, setScenarioId] = useState<string | null>(null);
  // Kept while a picked scenario loads, so the picker does not blink away.
  const [scenarioOptions, setScenarioOptions] = useState<NonNullable<PortalTaxEstimateResponseDTO['scenarios']>>([]);
  const [shownScenarioId, setShownScenarioId] = useState<string>('');
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
  // Same default as the server (portalDefaultYear): the newest year not after this one.
  const effectiveYear = year != null && years.includes(year) ? year : portalDefaultYear(years);

  useEffect(() => {
    if (!activeCompanyId || !current) { setDetail({ kind: 'idle' }); return; }
    let cancelled = false;
    setDetail({ kind: 'loading' });
    const q = `companyId=${activeCompanyId}${effectiveYear != null ? `&year=${effectiveYear}` : ''}${scenarioId ? `&scenarioId=${scenarioId}` : ''}`;
    fetch(`${base()}/${current.id}?${q}`, { credentials: 'include' })
      .then(async (r) => {
        if (r.status === 403 || r.status === 404) return { kind: 'unavailable' } as const;
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return { kind: 'ready', data: (await r.json()) as PortalTaxEstimateResponseDTO } as const;
      })
      .then((s) => {
        if (cancelled) return;
        setDetail(s);
        setScenarioOptions(s.kind === 'ready' ? s.data.scenarios ?? [] : []);
        setShownScenarioId(s.kind === 'ready' ? s.data.scenarioId ?? '' : '');
      })
      .catch(() => { if (!cancelled) setDetail({ kind: 'error' }); });
    return () => { cancelled = true; };
  }, [activeCompanyId, current, effectiveYear, scenarioId, detailAttempt]);

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

  const query = `companyId=${activeCompanyId ?? ''}${effectiveYear != null ? `&year=${effectiveYear}` : ''}${scenarioId ? `&scenarioId=${scenarioId}` : ''}`;
  const voucherHref = current ? `${base()}/${current.id}/vouchers.pdf?${query}` : '#';
  const pdfHref = current && detail.kind === 'ready' && detail.data.pdfDownload ? `${base()}/${current.id}/estimate.pdf?${query}` : null;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
      {(taxpayers.length > 1 || years.length > 1 || scenarioOptions.length > 1) && (
        <div className="flex flex-wrap gap-2">
          {taxpayers.length > 1 && (
            <select
              aria-label="Taxpayer"
              value={current?.id ?? ''}
              onChange={(ev) => { setTaxpayerId(ev.target.value); setYear(null); setScenarioId(null); }}
              className="text-sm border border-gray-300 rounded-md px-2 py-1 bg-white"
            >
              {taxpayers.map((t) => <option key={t.id} value={t.id}>{t.displayName}</option>)}
            </select>
          )}
          {years.length > 1 && (
            <select
              aria-label="Tax year"
              value={effectiveYear ?? ''}
              onChange={(ev) => { setYear(Number(ev.target.value)); setScenarioId(null); }}
              className="text-sm border border-gray-300 rounded-md px-2 py-1 bg-white"
            >
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          )}
          {scenarioOptions.length > 1 && (
            <select
              aria-label="Scenario"
              value={scenarioId ?? shownScenarioId}
              onChange={(ev) => setScenarioId(ev.target.value)}
              className="text-sm border border-gray-300 rounded-md px-2 py-1 bg-white"
            >
              {scenarioOptions.map((sc) => <option key={sc.id} value={sc.id}>{sc.name}</option>)}
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
        ) : <EstimateView e={detail.data.estimate} voucherHref={voucherHref} pdfHref={pdfHref} />}
    </div>
  );
}
