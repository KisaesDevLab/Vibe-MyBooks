// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// See LICENSE for terms.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor, within } from '@testing-library/react';
import { renderRoute } from '../../../test-utils';

// Real react-query hooks; only the HTTP layer and the taxpayer hooks are stubbed, so the
// test sees exactly which scenario URLs the page requests after a delete (QA D22).
const h = vi.hoisted(() => ({ calls: [] as string[], deleted: new Set<string>() }));
vi.mock('../../../api/client', () => ({
  apiClient: vi.fn(async (path: string, init: RequestInit = {}) => {
    const method = init.method ?? 'GET';
    h.calls.push(`${method} ${path}`);
    const scen = /\/scenarios\/([^/?]+)/.exec(path)?.[1];
    if (method === 'DELETE' && scen) { h.deleted.add(scen); return undefined; }
    if (scen && h.deleted.has(scen)) throw Object.assign(new Error('Scenario not found'), { status: 404 });
    if (/\/years\/2026$/.test(path)) {
      // After the delete the year detail answers late (a slow network), so the page re-renders
      // from the faster year list first while the deleted id is still selected.
      if (h.deleted.size > 0) await new Promise((r) => setTimeout(r, 150));
      const scenarios = [{ id: 'base', name: 'Base', isBase: true }, { id: 'tmp', name: 'Disposable', isBase: false }].filter((s) => !h.deleted.has(s.id));
      return { data: { exists: true, year: { updatedAt: 'u1' }, scenarios } };
    }
    if (/\/years$/.test(path)) return { data: [{ taxYear: 2026, priorYearTaxPresent: false, priorYearAgiPresent: false, scenarioCount: 2 - h.deleted.size }] };
    if (path.endsWith('/adjustments?limit=500&offset=0')) return { data: [], total: 0 };
    if (path.endsWith('/state-rows')) return { data: [] };
    if (path.endsWith('/adjustment-types')) return { data: [] };
    return { data: null };
  }),
}));
vi.mock('../../../api/hooks/useTaxEstimatorTaxpayers', () => ({
  getTaxEstimatorFirmId: () => null,
  useTaxEstimatorScope: () => ({ data: { firmRole: 'firm_staff', canWrite: true } }),
  useTaxpayer: () => ({ isLoading: false, isError: false, data: { taxpayer: { id: 'tp1', displayName: 'Rivera', filingStatus: 'mfj', residentState: 'MO' }, persons: [] } }),
  useTaxpayerLinks: () => ({ data: { data: [] } }),
}));
vi.mock('./YearInputsForm', () => ({ YearInputsForm: () => <div data-testid="year-form" /> }));
vi.mock('./StateRowsEditor', () => ({ StateRowsEditor: () => <div data-testid="state-rows" /> }));
vi.mock('./AdjustmentsSection', () => ({ AdjustmentsSection: () => <div data-testid="adjustments" /> }));

import { AnnualSettingsPage } from './AnnualSettingsPage';

beforeEach(() => { h.calls = []; h.deleted = new Set(); });

describe('AnnualSettingsPage — QA D22', () => {
  it('deleting the selected scenario switches to Base and never requests the deleted scenario again', async () => {
    const { queryClient } = renderRoute(<AnnualSettingsPage />, { path: '/tp/:id/annual', route: '/tp/tp1/annual?year=2026' });
    // The app's defaults (App.tsx): cached 30 s, kept after unmount, one retry.
    queryClient.setDefaultOptions({ queries: { staleTime: 30_000, gcTime: 300_000, retry: false } });
    fireEvent.click(await screen.findByRole('tab', { name: 'Disposable' }));
    await waitFor(() => expect(h.calls).toContain('GET /tax-estimator/scenarios/tmp/state-rows'));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(h.calls).toContain('DELETE /tax-estimator/scenarios/tmp'));
    await waitFor(() => expect(screen.queryByRole('tab', { name: 'Disposable' })).toBeNull());
    await waitFor(() => expect(h.calls.filter((c) => c === 'GET /tax-estimator/scenarios/base/state-rows').length).toBeGreaterThan(0));
    const afterDelete = h.calls.slice(h.calls.indexOf('DELETE /tax-estimator/scenarios/tmp') + 1);
    expect(afterDelete.filter((c) => c.includes('/scenarios/tmp'))).toEqual([]);
  });
});
