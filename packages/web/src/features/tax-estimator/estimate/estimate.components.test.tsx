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
    expect(banner).toHaveTextContent('AR estimate rules are unverified');
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
