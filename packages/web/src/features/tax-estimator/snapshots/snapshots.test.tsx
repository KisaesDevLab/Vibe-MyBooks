// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// See LICENSE for terms.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import type { EstimateSnapshotListItemDTO, SnapshotCompareDTO } from '@kis-books/shared';
import { renderRoute } from '../../../test-utils';
import { makeEstimate } from '../estimate/test-fixtures';

type Q = { data?: unknown; isLoading?: boolean; isError?: boolean; error?: unknown; refetch: () => void };
const q = (over: Partial<Q> = {}): Q => ({ data: undefined, isLoading: false, isError: false, refetch: vi.fn(), ...over });
const h = vi.hoisted(() => ({
  list: null as unknown, snap: null as unknown, compare: null as unknown,
  download: vi.fn(), estDownload: vi.fn(), year: null as unknown,
}));

vi.mock('../../../api/hooks/useTaxEstimatorSnapshots', () => ({
  SNAPSHOTS_KEY: 'tax-estimator-snapshots',
  useSnapshots: () => h.list,
  useSnapshot: () => h.snap,
  useSnapshotCompare: () => h.compare,
  useFinalizeSnapshot: () => ({ mutate: vi.fn(), reset: vi.fn(), isPending: false, isError: false }),
  downloadSnapshotPdf: (...a: unknown[]) => h.download(...a),
}));

import { SnapshotHistory } from './SnapshotHistory';
import { SnapshotCompare } from './SnapshotCompare';
import { SnapshotViewPage } from './SnapshotViewPage';

const summary = { federalTotal: '35829', stateTotal: '7902', total: '43732', federalRequiredAnnualPayment: '32246', federalUnpaid: '7046', federalPenalty: '11', statePenalty: '0', marginalRate: '0.22' };
const row = (over: Partial<EstimateSnapshotListItemDTO> = {}): EstimateSnapshotListItemDTO => ({
  id: 'snap-1', taxpayerId: 'tp1', taxYear: 2026, scenarioId: 's1', scenarioName: 'Base', reason: 'finalize', note: 'Q4 vouchers',
  engineVersion: '1.0.0', inputsHash: 'h', createdBy: 'u1', createdAt: '2026-10-01T15:00:00.000Z', accessible: true, summary, ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  h.list = q({ data: { data: [row(), row({ id: 'snap-2', reason: 'pdf', accessible: false, summary: null, note: null })], total: 2, limit: 20, offset: 0 } });
});

describe('SnapshotHistory', () => {
  it('lists snapshots with reason, total and actions; inaccessible rows are greyed with no figures', () => {
    renderRoute(<SnapshotHistory taxpayerId="tp1" taxYear={2026} />);
    const rows = screen.getAllByTestId('snapshot-row');
    expect(rows).toHaveLength(2);
    expect(rows[0]!.textContent).toContain('Finalized');
    expect(rows[0]!.textContent).toContain('$43,732');
    expect(rows[0]!.textContent).toContain('Q4 vouchers');
    expect(screen.getByRole('link', { name: 'View' }).getAttribute('href')).toBe('/tax-estimator/taxpayers/tp1/snapshots/snap-1?year=2026');
    expect(screen.getByRole('link', { name: 'Compare with live' }).getAttribute('href')).toBe('/tax-estimator/taxpayers/tp1/snapshots/snap-1?year=2026&compare=1');
    expect(rows[1]!.textContent).toContain('PDF generated');
    expect(rows[1]!.textContent).toContain('Includes a client you can no longer reach');
    expect(rows[1]!.textContent).not.toContain('$');
    fireEvent.click(screen.getByRole('button', { name: 'PDF' }));
    expect(h.download).toHaveBeenCalledWith('snap-1');
  });

  it('D5: the visually hidden Actions header stays inside the scroll container', () => {
    const { container } = renderRoute(<SnapshotHistory taxpayerId="tp1" taxYear={2026} />);
    const hidden = Array.from(container.querySelectorAll('th .sr-only'));
    expect(hidden.length).toBeGreaterThan(0);
    for (const el of hidden) expect(el.closest('[class*="overflow-x-auto"]')!.className).toMatch(/\brelative\b/);
  });

  it('empty and error states', () => {
    h.list = q({ data: { data: [], total: 0, limit: 20, offset: 0 } });
    const { unmount } = renderRoute(<SnapshotHistory taxpayerId="tp1" taxYear={2026} />);
    expect(screen.getByText(/No snapshots yet/)).toBeTruthy();
    unmount();
    const refetch = vi.fn();
    h.list = q({ isError: true, refetch });
    renderRoute(<SnapshotHistory taxpayerId="tp1" taxYear={2026} />);
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(refetch).toHaveBeenCalled();
  });
});

const cmp: SnapshotCompareDTO = {
  snapshotId: 'snap-1', snapshotCreatedAt: '2026-10-01T15:00:00.000Z', liveComputedAt: '2026-10-12T15:00:00.000Z', liveUnavailable: null,
  engineVersionChanged: true, inputsHashChanged: true,
  summary: { snapshot: summary, live: { ...summary, total: '44000' } },
  differences: [
    { path: 'summary.total', label: 'Total tax', snapshot: '43732', live: '44000', delta: '268' },
    { path: 'summary.marginalRate', label: 'Marginal rate', snapshot: '0.22', live: '0.24', delta: '0.02' },
  ],
  parameterChanges: [{ scope: 'federal', key: 'se.ss_wage_base', snapshot: { value: 176100, status: 'verified' }, live: { value: 184500, status: 'verified' } }],
  warningsAdded: [{ code: 'TE_X', severity: 'warning', message: 'A new warning' }],
  warningsRemoved: [],
};

describe('SnapshotCompare', () => {
  it('shows changed figures, parameter changes, warnings and the engine note', () => {
    renderRoute(<SnapshotCompare compare={cmp} />);
    expect(screen.getByText('Total tax')).toBeTruthy();
    expect(screen.getByText('$44,000')).toBeTruthy();
    expect(screen.getByText('$268')).toBeTruthy();
    expect(screen.getByText('24%')).toBeTruthy();
    expect(screen.getByText(/se\.ss_wage_base/)).toBeTruthy();
    expect(screen.getByText('A new warning')).toBeTruthy();
    expect(screen.getByText(/calculation engine has changed/)).toBeTruthy();
  });

  it('R3-18: a deleted scenario shows the reason instead of a live column', () => {
    renderRoute(<SnapshotCompare compare={{
      ...cmp, liveComputedAt: null, liveUnavailable: { code: 'TE_SCENARIO_NOT_FOUND', message: 'The scenario "Base" no longer exists, so there is no live estimate to compare with.' },
      summary: { snapshot: summary, live: null }, differences: [], parameterChanges: [], warningsAdded: [],
    }} />);
    expect(screen.getByRole('status').textContent).toMatch(/no longer exists/);
    expect(screen.queryByText('Changed figures')).toBeNull();
  });
});

describe('SnapshotViewPage', () => {
  const snapshot = {
    ...row(), payloadSha256: 'x',
    payload: {
      version: 1,
      inputs: { throughMonth: '2026-09', taxpayer: { id: 'tp1', displayName: 'Rivera Family', filingStatus: 'mfj', residentState: 'MO' } },
      result: makeEstimate(),
      assumptions: { version: 1, disclaimerText: 'Frozen disclaimer.', sections: [
        { id: 'rate_mode', title: 'Rate mode', items: [{ label: 'Federal', detail: 'Brackets', badge: null }] },
        { id: 'parameters', title: 'Unverified and provisional parameters', items: [{ label: 'Federal penalty.underpayment_rate', detail: '[{"to":"2025-03-31","rate":0.07}] (unverified).', badge: 'unverified' }] },
        { id: 'disclaimer', title: 'Disclaimer', items: [{ label: 'Disclaimer', detail: 'Frozen disclaimer.' }] },
      ] },
      disclaimerText: 'Frozen disclaimer.',
    },
  };

  it('renders the read-only banner, frozen figures, assumptions and the frozen disclaimer', () => {
    h.snap = q({ data: snapshot });
    h.compare = q();
    renderRoute(<SnapshotViewPage />, { path: '/tax-estimator/taxpayers/:id/snapshots/:snapshotId', route: '/tax-estimator/taxpayers/tp1/snapshots/snap-1?year=2026' });
    expect(screen.getByRole('status').textContent).toMatch(/Snapshot — read only\. Taken .*Finalized.*actuals through Sep 2026/);
    expect(screen.getByText('Rate mode')).toBeTruthy();
    expect(screen.getByText('Brackets')).toBeTruthy();
    // QA D19: a value frozen as JSON reads for people.
    expect(screen.getByText(/a table of 1 row \(see Admin > Tax parameters\)/)).toBeTruthy();
    expect(screen.queryByText(/\{"to"/)).toBeNull();
    expect(screen.getByText('Frozen disclaimer.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Download PDF' }));
    expect(h.download).toHaveBeenCalledWith('snap-1');
  });

  it('switches to Compare with live', async () => {
    h.snap = q({ data: snapshot });
    h.compare = q({ data: cmp });
    renderRoute(<SnapshotViewPage />, { path: '/tax-estimator/taxpayers/:id/snapshots/:snapshotId', route: '/tax-estimator/taxpayers/tp1/snapshots/snap-1?compare=1' });
    await waitFor(() => expect(screen.getByLabelText('Compare with live')).toBeTruthy());
    expect(screen.getByText('Total tax')).toBeTruthy();
  });

  it('404 explains the snapshot is out of reach', () => {
    h.snap = q({ isError: true, error: Object.assign(new Error('nf'), { status: 404 }) });
    h.compare = q();
    renderRoute(<SnapshotViewPage />, { path: '/tax-estimator/taxpayers/:id/snapshots/:snapshotId', route: '/tax-estimator/taxpayers/tp1/snapshots/snap-1' });
    expect(screen.getByText(/includes a client you can no longer reach/)).toBeTruthy();
  });
});
