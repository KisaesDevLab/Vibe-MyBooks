// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderRoute } from '../../../test-utils';

const meHolder: { user: { isSuperAdmin: boolean; userType: 'staff' | 'client' } } = { user: { isSuperAdmin: false, userType: 'staff' } };
vi.mock('../../../api/hooks/useAuth', async () => {
  const actual = await vi.importActual<typeof import('../../../api/hooks/useAuth')>('../../../api/hooks/useAuth');
  return { ...actual, useMe: () => ({ data: meHolder }) };
});

const saveMutate = vi.fn();
const applyMutate = vi.fn();
const pack = {
  id: 'p1', tenantId: 't1', companyId: 'co1', name: 'Board Package', description: null, periodPreset: 'this-month',
  customRangeStart: null, customRangeEnd: null, asOfMode: 'range-end', asOfCustom: null, defaultBasis: 'accrual',
  defaultTagId: null, coverPage: true, toc: true, pageNumbers: true, pageFooter: null, filenameTemplate: '{pack}-{date}',
  onError: 'skip', letterId: null, createdBy: 'u1', createdAt: '2026-07-01T00:00:00Z', updatedAt: '2026-07-02T00:00:00Z',
  deletedAt: null, itemCount: 2,
};
vi.mock('../../../api/hooks/useReportPacks', () => ({
  useReportPacks: () => ({ data: { packs: [pack] }, isLoading: false, isError: false, refetch: vi.fn() }),
  useReportPackWorkerHealth: () => ({ data: { redisReachable: true, workerRunning: true } }),
  useDeleteReportPack: () => ({ mutate: vi.fn(), isPending: false }),
  useDuplicateReportPack: () => ({ mutate: vi.fn(), isPending: false }),
  useCreatePackRun: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useReportPackTemplates: () => ({
    data: { templates: [{ id: 'tp1', name: 'Firm Close', description: null, reportCount: 2, reportIds: ['profit-loss', 'balance-sheet'], createdAt: '', updatedAt: '' }] },
    isLoading: false, isError: false,
  }),
  useSavePackAsTemplate: () => ({ mutate: saveMutate, isPending: false }),
  useApplyPackTemplate: () => ({ mutate: applyMutate, isPending: false, variables: undefined }),
  useRenamePackTemplate: () => ({ mutate: vi.fn(), isPending: false }),
  useDeletePackTemplate: () => ({ mutate: vi.fn(), isPending: false }),
}));

import { ReportPacksListPage } from './ReportPacksListPage';

beforeEach(() => { saveMutate.mockReset(); applyMutate.mockReset(); });

describe('report pack templates UI', () => {
  it('super admin saves a pack as a template', () => {
    meHolder.user = { isSuperAdmin: true, userType: 'staff' };
    renderRoute(<ReportPacksListPage />, { route: '/reports/packs' });
    fireEvent.click(screen.getByRole('button', { name: 'Save Board Package as template' }));
    fireEvent.change(screen.getByLabelText('Template name'), { target: { value: 'Firm Close' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save template' }));
    expect(saveMutate).toHaveBeenCalledWith({ packId: 'p1', name: 'Firm Close', description: null }, expect.anything());
  });

  it('staff (not super admin) can apply a template but not save one', () => {
    meHolder.user = { isSuperAdmin: false, userType: 'staff' };
    renderRoute(<ReportPacksListPage />, { route: '/reports/packs' });
    expect(screen.queryByRole('button', { name: 'Save Board Package as template' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /From template/ }));
    expect(screen.getByText(/Profit and Loss|Profit & Loss/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Delete Firm Close' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Use template' }));
    expect(applyMutate).toHaveBeenCalledWith({ templateId: 'tp1' }, expect.anything());
  });

  it('client users do not see templates', () => {
    meHolder.user = { isSuperAdmin: false, userType: 'client' };
    renderRoute(<ReportPacksListPage />, { route: '/reports/packs' });
    expect(screen.queryByRole('button', { name: /From template/ })).toBeNull();
  });
});
