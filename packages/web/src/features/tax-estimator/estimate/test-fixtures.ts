// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// See LICENSE for terms.

// Test fixture: a trimmed EstimateResultDTO (Rivera-shaped figures) covering the fields the screens read.
import type { EstimateResultDTO } from '@kis-books/shared';

const inst = (i: number, over: Record<string, unknown> = {}) => ({
  index: i, label: `Q${i + 1}`, dueDate: ['2026-04-15', '2026-06-15', '2026-09-15', '2027-01-15'][i], statutoryDueDate: '2026-04-15',
  regularInstallment: '8062', annualizedInstallment: i === 0 ? '5000' : null, required: '8062', withholdingShare: '1125', carriedIn: '0', netRequired: '6937',
  estimatesApplied: i < 3 ? '6937' : '0', unpaid: i < 3 ? '0' : '6937', catchUpAmount: i < 3 ? '0' : '7046', paidInFullOn: i < 3 ? '2026-06-01' : null,
  status: i < 3 ? 'paid' : 'unpaid', ...over,
});
const estimates = (jurisdiction: string, required = true) => ({
  jurisdiction, taxYear: 2026, estimatesRequired: required, estimatesRequiredReason: required ? 'Required' : 'Below the threshold', usesFederalFallback: false, verify: false,
  safeHarbor: {
    jurisdiction, policy: 'p', rule: 'lesser_of', ruleSource: 'firm_default', appliedRule: 'current_year',
    currentYear: { tax: '35829', pct: '0.9', amount: '32246' },
    priorYear: { available: false, unavailableReason: 'unfiled', unavailableDetail: 'No prior-year return was filed.', tax: null, agi: null, pct: '1', highAgiApplied: false, highAgiUntested: false, amount: null },
    requiredAnnualPayment: '32246', noPenaltyReason: null, verify: false, notes: [],
  },
  scheduleAi: null, installments: required ? [0, 1, 2, 3].map((i) => inst(i)) : [],
  payments: null, penalty: required ? { total: '85', computed: true, installments: [{ index: 0, penalty: '85' }] } : null,
  returnDueDate: '2027-04-15', lastInstallmentReliefDate: '2027-01-31',
  totals: { required: '32246', withholding: '4500', estimatesPaid: '19200', unpaid: '7046', excess: '0' }, notes: [], trace: [{ id: `${jurisdiction}.voucher.4`, label: `${jurisdiction} Q4 voucher`, amount: '7046', formula: 'unpaid 6937 + earlier 109', source: 'input' }],
  warnings: [], parametersUsed: [], rulesUsed: [],
});

export function makeEstimate(over: Record<string, unknown> = {}): EstimateResultDTO {
  return {
    taxpayerId: 'tp1', taxYear: 2026, scenarioId: 's1', scenarioName: 'Base', filingStatus: 'mfj', engineVersion: 'te-1', computedAt: '2026-10-12T00:00:00Z', cached: false,
    inputsHash: 'h', safeHarborRule: 'lesser_of', safeHarborRuleSource: 'firm_default',
    entities: [{ tenantId: 't', companyId: 'c1', companyName: 'Rivera Plumbing LLC', entityType: 's_corp', path: 'individual', skippedReason: null, throughMonth: '2026-09', throughMonthSource: 'last_closed', monthsElapsed: 9, monthsRemaining: 3, glVersionStamp: 1, providerCached: false, owners: [{ personId: 'p1', personRole: 'taxpayer', displayName: 'Ana Rivera', profitPct: 60, lossPct: 60 }] }],
    federal: {
      engineVersion: 'te-1', taxYear: 2026, filingStatus: 'mfj',
      persons: [{ personId: 'p1', displayName: 'Daniel Rivera', seIncome: '128000', halfSeTax: '9043', totalWages: '0', seTax: '18086', retirement: { capped: true }, sehi: { capped: false }, hsa: { capped: false } }],
      entities: [{ companyId: 'c1', companyName: 'Rivera Plumbing LLC', entityType: 'sole_prop', ytd: { ordinary: '150000' }, projectedProfit: '200000', shares: [{ linkId: 'l1', personId: 'p1', activityType: 'active', profitFraction: '0.6', lossFraction: '0.6', share: { ordinary: '120000' } }] }],
      lossLimitations: { suspendedPassiveLoss: '1200', excessBusinessLoss: '0' },
      income: { wages: '32400', interest: '0', dividends: '0', capitalGainNet: '0', section1231: '0', otherIncome: '0', totalIncome: '232400' },
      adjustmentsToIncome: { halfSeTax: '9043', retirement: '15000', sehi: '0', hsa: '0', other: '0', total: '24043' },
      agi: '208357',
      deductions: { mode: 'auto', chosen: 'standard', deduction: '32200', standard: { total: '32200' }, itemized: { total: '20000' }, sch1a: { inEffect: false, total: '0' } },
      qbi: { method: 'computed', deduction: '15000' }, taxableIncome: '161157',
      regularTax: { method: 'brackets', tax: '24000', marginalOrdinaryRate: '0.22' }, credits: { nonrefundableAllowed: '0', refundable: '0' },
      seTax: '18086', additionalMedicareTax: '0', niit: '0', federalTotal: '35829',
      trace: [
        { step: 'regular_tax', id: 'regular_tax.brackets', label: 'Regular tax from brackets', amount: '24000', exact: '24000', formula: '10% x 24,800 + 12% x ...', source: 'parameter', marginalRate: '0.22' },
        { step: 'agi', id: 'agi', label: 'AGI', amount: '208357', exact: '208357', source: 'input' },
      ],
      warnings: [], parametersUsed: [],
    },
    state: { rows: [
      { rowId: 'r1', state: 'MO', residency: 'resident', grossTax: '7902', creditForOtherStates: '312', netTax: '7590', sourcedIncome: '0', effectiveRate: '0.04', verify: false, usesFederalFallback: false },
      { rowId: 'r2', state: 'AR', residency: 'nonresident', grossTax: '312', creditForOtherStates: '0', netTax: '312', sourcedIncome: '8000', effectiveRate: '0.039', verify: true, usesFederalFallback: false },
    ], stateTotal: '7902', trace: [{ step: 'state_tax', id: 'state.MO.gross', state: 'MO', label: 'MO gross tax', amount: '7902', exact: '7902', source: 'rule', formula: 'base x rate' }] },
    federalEstimates: estimates('federal'), stateEstimates: [estimates('MO'), estimates('AR', false)],
    farmer: null, ccorps: [], payments: [], scheduleAi: [],
    summary: { federalTotal: '35829', stateTotal: '7902', total: '43731', federalRequiredAnnualPayment: '32246', federalUnpaid: '7046', federalPenalty: '85', statePenalty: '0', marginalRate: '0.22' },
    warnings: [{ code: 'TE_SEP_CAPPED', severity: 'warning', message: 'SEP contribution capped at the limit.' }],
    parametersUsed: [{ key: 'brackets', status: 'verified', value: 1 }], rulesUsed: [{ state: 'AR', key: 'k', status: 'unverified', value: 1 }],
    ...over,
  } as unknown as EstimateResultDTO;
}
