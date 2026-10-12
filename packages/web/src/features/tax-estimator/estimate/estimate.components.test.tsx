// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, render, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { makeEstimate } from './test-fixtures';
import { buildCalcSections } from './calcLines';
import { buildCompareRows, deltaOf } from './compareRows';
import { dollars, pct, fmtDate, daysUntil } from './format';
import { CalculationTable } from './CalculationTable';
import { SafeHarborCard } from './SafeHarborCard';
import { VoucherTable } from './VoucherTable';
import { KeyFigures, nextFederalPayment } from './KeyFigures';
import { ReadinessBanner } from './ReadinessBanner';
import { WarningsList } from './WarningsList';
import { SpecialCases } from './SpecialCases';
import { EstimateTabs } from './EstimateTabs';
import { TraceDrawer } from './TraceDrawer';

const TODAY = new Date(2026, 9, 7);
const wrap = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe('format helpers', () => {
  it('formats whole dollars, percentages and dates without timezone drift', () => {
    expect(dollars('43732')).toBe('$43,732');
    expect(dollars('-100')).toContain('100');
    expect(pct('0.22', 0)).toBe('22%');
    expect(pct('0.188')).toBe('18.8%');
    expect(fmtDate('2027-01-15')).toBe('Jan 15, 2027');
    expect(fmtDate(null)).toBe('—');
    expect(daysUntil('2026-10-12', new Date(2026, 9, 7))).toBe(5);
  });
});

describe('state chips (QA D18)', () => {
  it('says "Rules unverified" only when a used rule is unverified; a verified-rules row with verify=true reads "Verify"', () => {
    const unverified = buildCalcSections(makeEstimate()).flatMap((s) => s.lines).find((l) => l.key === 'st.r2')!;
    expect(unverified.chips?.[0]?.text).toBe('Rules unverified');
    const verified = buildCalcSections(makeEstimate({ rulesUsed: [{ state: 'AR', key: 'k', status: 'verified', value: 1 }] }))
      .flatMap((s) => s.lines).find((l) => l.key === 'st.r2')!;
    expect(verified.chips?.[0]?.text).toBe('Verify');
  });
});

describe('buildCalcSections', () => {
  it('has YTD only on income lines, a marginal-rate note, no "period tax", and data-driven chips', () => {
    const sections = buildCalcSections(makeEstimate());
    const lines = sections.flatMap((s) => s.lines);
    expect(lines.filter((l) => l.ytd != null).map((l) => l.key)).toEqual(['inc.c1']);
    expect(lines.find((l) => l.key === 'tax.regular')!.sub).toContain('22%');
    expect(lines.find((l) => l.key === 'adj.ret')!.chips?.[0]?.text).toMatch(/capped/i);
    expect(lines.find((l) => l.key === 'inc.total')!.chips?.[0]?.text).toMatch(/Passive loss suspended/);
    const nonres = lines.find((l) => l.key === 'st.r2')!;
    expect(nonres.sub).toContain('effective-rate estimate');
    expect(nonres.chips?.[0]?.text).toBe('Rules unverified');
    expect(JSON.stringify(sections)).not.toMatch(/period tax/i);
    expect(sections.at(-1)!.lines[0]!.projected).toBe('43731');
  });
});

describe('CalculationTable', () => {
  it('shows YTD and projected columns and opens the trace drawer with label, amount, formula and source', () => {
    wrap(<CalculationTable estimate={makeEstimate()} />);
    expect(screen.getByRole('columnheader', { name: 'YTD tax basis' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: '2026 projected' })).toBeInTheDocument();
    expect(screen.queryByText(/period tax/i)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Trace Regular income tax' }));
    const drawer = screen.getByRole('dialog', { name: /Trace: Regular income tax/ });
    expect(within(drawer).getByText('Regular tax from brackets')).toBeInTheDocument();
    expect(within(drawer).getByText(/10% x 24,800/)).toBeInTheDocument();
    expect(within(drawer).getByText(/Source: parameter/)).toBeInTheDocument();
    expect(within(drawer).getByText(/marginal rate 22%/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close trace' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('shows an empty-trace message when the engine recorded none', () => {
    wrap(<CalculationTable estimate={makeEstimate()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Trace Federal total' }));
    expect(screen.getByText('No trace rows were recorded for this line.')).toBeInTheDocument();
  });
});

describe('SafeHarborCard', () => {
  it('shows both rules, outlines the recommended one and names the rule source', () => {
    const e = makeEstimate();
    wrap(<SafeHarborCard estimate={e.federalEstimates} rule={e.safeHarborRule} ruleSource={e.safeHarborRuleSource} />);
    expect(screen.getByText(/90% of current year/)).toBeInTheDocument();
    expect(screen.getByText(/of prior year|Prior year/)).toBeInTheDocument();
    expect(screen.getByText('Recommended')).toBeInTheDocument();
    expect(screen.getByText('Not available')).toBeInTheDocument();
    expect(screen.getByText('No prior-year return was filed.')).toBeInTheDocument();
    expect(screen.getByText(/Lesser of both . firm default/)).toBeInTheDocument();
    expect(screen.getByText('Remaining').nextSibling).toHaveTextContent('$7,046');
  });

  it('QA D8: under "lesser of" with both rules available, the lower amount is outlined Recommended', () => {
    const e = makeEstimate();
    const fe = e.federalEstimates;
    const est = { ...fe, safeHarbor: { ...fe.safeHarbor, appliedRule: 'lesser_of' as const,
      currentYear: { ...fe.safeHarbor.currentYear, amount: '32246' },
      priorYear: { ...fe.safeHarbor.priorYear, available: true, amount: '34650', tax: '31500', pct: '1.1', unavailableDetail: null } } };
    wrap(<SafeHarborCard estimate={est} rule="lesser_of" ruleSource="firm_default" />);
    const badge = screen.getByText('Recommended');
    expect(badge.closest('div.rounded-lg')).toHaveTextContent('$32,246');
    expect(screen.getAllByText('Recommended')).toHaveLength(1);
  });
});

describe('VoucherTable', () => {
  it('renders installments with Sch AI bold where it lowers, penalty, status and pay-now', () => {
    const e = makeEstimate();
    wrap(<VoucherTable estimate={e.federalEstimates} />);
    const rows = screen.getAllByRole('row');
    const q1 = within(rows[1]!).getAllByRole('cell');
    expect(q1[3]).toHaveClass('font-bold'); // Sch AI 5,000 < regular 8,062
    expect(within(rows[4]!).getByText('Unpaid')).toBeInTheDocument();
    expect(within(rows[4]!).getByText('$7,046')).toBeInTheDocument();
    expect(within(rows[1]!).getByText('$85')).toBeInTheDocument();
    expect(screen.getByText(/Payments are applied to the earliest unpaid installment/)).toBeInTheDocument();
  });

  it('QA2-01: an installment only covered by an amount dated after today is not shown as Paid', () => {
    const e = makeEstimate();
    const fed = { ...e.federalEstimates, installments: e.federalEstimates.installments.map((i, k) => (k === 2 ? { ...i, paidInFullOn: '2027-01-15' } : i)) };
    wrap(<VoucherTable estimate={fed} today={new Date(2026, 9, 12)} />);
    const rows = screen.getAllByRole('row');
    expect(within(rows[3]!).queryByText('Paid')).toBeNull();
    expect(within(rows[3]!).getByText('Covered later')).toBeInTheDocument();
    expect(within(rows[3]!).getByText(/covered Jan 15, 2027 \(after today\)/)).toBeInTheDocument();
    expect(within(rows[1]!).getByText('Paid')).toBeInTheDocument();
  });

  it('says "none required" for a jurisdiction without vouchers', () => {
    const e = makeEstimate();
    wrap(<VoucherTable estimate={e.stateEstimates[1]!} />);
    expect(screen.getByText(/No estimated payments required for AR/)).toBeInTheDocument();
  });
});

describe('KeyFigures', () => {
  it('shows total, paid & withheld, next payment with days away, and the marginal rate', () => {
    const e = makeEstimate();
    wrap(<KeyFigures estimate={e} today={TODAY} />);
    expect(screen.getByText('$43,731')).toBeInTheDocument();
    expect(screen.getByText('22%')).toBeInTheDocument();
    expect(screen.getByText(/Due Jan 15, 2027/)).toBeInTheDocument();
    expect(nextFederalPayment(e, TODAY)!.label).toBe('Q4');
  });

  it('QA D13: a payment dated after today is not "paid to date"', () => {
    const base = makeEstimate();
    const fed = base.federalEstimates;
    const e = { ...base, federalEstimates: { ...fed, totals: { ...fed.totals, estimatesPaid: '10000', withholding: '0' } }, stateEstimates: [],
      payments: [{ id: 'gl:1', stored: false, jurisdiction: 'federal', date: '2027-01-15', amount: '4000', source: 'gl', memo: null }] } as never;
    wrap(<KeyFigures estimate={e} today={TODAY} />);
    expect(screen.getByText('$6,000')).toBeInTheDocument();
    expect(screen.getByText(/\$4,000 dated after today not included/)).toBeInTheDocument();
  });
});

describe('KeyFigures — QA2-05 the "Paid & withheld" breakdown adds up to the tile', () => {
  it('federal estimates (as of today) + federal withholding + state = the headline; the dated-later amount is listed apart', () => {
    const base = makeEstimate();
    const fed = base.federalEstimates;
    const mo = { ...fed, jurisdiction: 'MO', totals: { ...fed.totals, estimatesPaid: '0', withholding: '2000' } };
    const e = { ...base, federalEstimates: { ...fed, totals: { ...fed.totals, estimatesPaid: '26246', withholding: '6000' } }, stateEstimates: [mo],
      payments: [{ id: 'gl:9', stored: false, jurisdiction: 'federal', date: '2027-01-15', amount: '7046', source: 'gl', memo: null }] } as never;
    wrap(<KeyFigures estimate={e} today={TODAY} />);
    const tile = screen.getByText('Paid & withheld to date').parentElement!;
    // 19,200 + 6,000 + 2,000 = 27,200
    expect(tile).toHaveTextContent('$27,200');
    expect(tile).toHaveTextContent('Federal estimates $19,200 · federal withholding $6,000 · state $2,000 · $7,046 dated after today not included');
  });
});

describe('ReadinessBanner', () => {
  const readiness = {
    taxpayerId: 'tp1', taxYear: 2026, outOfScopeLinks: 0, schAiPeriods: [], ready: false, warnings: [],
    entities: [{ tenantId: 't', companyId: 'c1', companyName: 'Ozark Bakery', linkCount: 1, inScope: true, error: null, readiness: {
      throughMonth: '2026-09', lastClosedMonth: '2026-08', unreconciledAccounts: [{ accountId: 'a', name: 'Business Visa' }], suspense: { balance: '0', transactionCount: 0, unpostedFeedCount: 0 },
      unmappedAccounts: [], warnings: [],
    } }],
  };
  it('lists unreconciled accounts, unverified parameters/rules, with links to where they are fixed', () => {
    wrap(<ReadinessBanner taxpayerId="tp1" taxYear={2026} estimate={makeEstimate({ parametersUsed: [{ key: 'k', status: 'provisional', value: 1 }] })} readiness={readiness as never} />);
    const banner = screen.getByRole('status', { name: 'Books readiness' });
    expect(banner).toHaveTextContent('Business Visa');
    expect(within(banner).getByRole('link', { name: 'Open entity tax setup' })).toHaveAttribute('href', '/tax-estimator/entities/t/c1');
    expect(banner).toHaveTextContent('1 federal parameter(s) are provisional');
    expect(banner).toHaveTextContent('1 state rule(s) are unverified (AR)');
  });
  it('QA D20: one item per issue (no duplicate "N account(s) are not reconciled" line next to the per-account row)', () => {
    const dup = { ...readiness, entities: [{ ...readiness.entities[0]!, readiness: { ...readiness.entities[0]!.readiness, warnings: [
      { code: 'TE_UNRECONCILED_ACCOUNTS', severity: 'warning', message: '1 bank/credit-card account(s) are not reconciled through 2026-09.' },
    ] } }] };
    wrap(<ReadinessBanner taxpayerId="tp1" taxYear={2026} estimate={makeEstimate({ rulesUsed: [] })} readiness={dup as never} />);
    const banner = screen.getByRole('status', { name: 'Books readiness' });
    expect(banner).toHaveTextContent('Business Visa');
    expect(banner).not.toHaveTextContent('bank/credit-card account(s)');
    expect(banner).toHaveTextContent('Books readiness · 1 item');
  });
  it('shows the all-clear state', () => {
    wrap(<ReadinessBanner taxpayerId="tp1" taxYear={2026} estimate={makeEstimate({ rulesUsed: [] })} readiness={{ ...readiness, entities: [] } as never} />);
    expect(screen.getByText('Books readiness: no issues found.')).toBeInTheDocument();
  });
});

describe('WarningsList and SpecialCases', () => {
  it('renders warnings, and nothing when empty', () => {
    const { container, rerender } = wrap(<WarningsList warnings={makeEstimate().warnings} />);
    expect(screen.getByText('SEP contribution capped at the limit.')).toBeInTheDocument();
    rerender(<MemoryRouter><WarningsList warnings={[]} /></MemoryRouter>);
    expect(container).toBeEmptyDOMElement();
  });
  it('renders a qualifying farmer and a C corp with recapture', () => {
    const e = makeEstimate({
      farmer: { label: 'farmer', qualifies: true, basis: 'prior_year', requiredRatio: '0.6667', installments: [{ number: 1, dueDate: '2027-01-15', pct: '1' }], fileAndPayByDate: '2027-03-01', fileAndPayNote: 'File and pay by Mar 1 to avoid the penalty.', requiredAnnualPayment: { required: '9000', currentYear: '9000', priorYear: null } },
      ccorps: [{ companyId: 'cc', companyName: 'Acme Inc', taxableIncome: '100000', rate: '0.21', federalTax: '21000', stateTotal: '1000', totalTax: '22000', fiscalYearStart: '2026-07-01', fiscalYearEnd: '2027-06-30', largeCorporation: true, estimatesRequired: true, states: [{ state: 'MO', apportionmentPct: '0.5' }], installments: [{ number: 1, dueDate: '2026-10-15', required: '5000', recapture: '0' }, { number: 2, dueDate: '2026-12-15', required: '6000', recapture: '1000' }] }],
    });
    wrap(<SpecialCases estimate={e} />);
    expect(screen.getByLabelText('Farmer summary')).toHaveTextContent('Qualifies (prior year');
    expect(screen.getByLabelText('Acme Inc C corporation')).toHaveTextContent('Large corporation');
    expect(screen.getByLabelText('Acme Inc C corporation')).toHaveTextContent('$1,000');
  });
});

describe('buildCompareRows', () => {
  it('has marginal rate and safe-harbor rows, a capped note, and signed deltas vs the first scenario', () => {
    const base = makeEstimate();
    const truck = makeEstimate({ scenarioId: 's2', scenarioName: 'Truck', summary: { ...base.summary, total: '24199', marginalRate: '0.24' } });
    const rows = buildCompareRows([base, truck], TODAY);
    expect(rows.map((r) => r.key)).toEqual(expect.arrayContaining(['marginal', 'shreq', 'total', 'ret']));
    const total = rows.find((r) => r.key === 'total')!;
    expect(total.values).toEqual(['43731', '24199']);
    expect(deltaOf(total.values[0]!, total.values[1]!)).toBe(-19532);
    expect(rows.find((r) => r.key === 'ret')!.notes[0]).toBe('capped at limit');
    expect(rows.find((r) => r.key === 'marginal')!.kind).toBe('rate');
  });
});

beforeEach(() => vi.clearAllMocks());

describe('EstimateTabs (QA D23)', () => {
  it('keeps ?through= on the Summary and Payments links', () => {
    render(<MemoryRouter><EstimateTabs taxpayerId="tp1" taxYear={2026} active="summary" scenarioId="s1" through="2026-12" /></MemoryRouter>);
    expect(screen.getByRole('link', { name: 'Payments' })).toHaveAttribute('href', '/tax-estimator/taxpayers/tp1/estimate?year=2026&scenario=s1&through=2026-12#payments');
    expect(screen.getByRole('link', { name: 'Summary' }).getAttribute('href')).toContain('through=2026-12');
  });
});

describe('TraceDrawer (QA D7 / D26)', () => {
  it('formats money in labels and formulas and lists bracket rows with their marginal rate', () => {
    render(<TraceDrawer title="Regular income tax" onClose={vi.fn()} rows={[
      { id: 'regular_tax.bracket.2', label: 'Bracket 2: 24800 to 100800 at 0.12', amount: '9120', formula: '76000 × 0.12', source: 'parameter', marginalRate: '0.12' },
      { id: 'regular_tax', label: 'Regular tax (ordinary brackets)', amount: '20843', formula: 'bracket tax on 138725.7318071403638391314', source: 'parameter', marginalRate: '0.22' },
    ]} />);
    expect(screen.getByText('Bracket 2: 24,800 to 100,800 at 0.12')).toBeInTheDocument();
    expect(screen.getByText('76,000 × 0.12')).toBeInTheDocument();
    expect(screen.getByText('bracket tax on 138,725.73')).toBeInTheDocument();
    expect(screen.queryByText(/138725\.7318/)).toBeNull();
  });

  it('returns focus to the control that opened it', () => {
    const opener = document.createElement('button');
    document.body.appendChild(opener);
    opener.focus();
    const { unmount } = render(<TraceDrawer title="X" rows={[]} onClose={vi.fn()} />);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close trace' }));
    unmount();
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });
});
