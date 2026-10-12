// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// D17 taxpayer visibility: the "Who can see this taxpayer" card, the firm switch in the
// firm settings dialog, and the list's lock icon. The server enforces the rules; these
// tests pin what the screens show and send.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import { renderRoute } from '../../../test-utils';
import type { FirmSettingsDTO, TaxpayerListItemDTO, TaxpayerStaffDTO } from '@kis-books/shared';

const h = vi.hoisted(() => ({
  staff: { data: undefined as unknown, isLoading: false, isError: false, refetch: vi.fn() },
  candidates: { data: { data: [] as unknown[], total: 0 }, isLoading: false },
  candidatesEnabled: undefined as boolean | undefined,
  save: { mutate: vi.fn(), isPending: false, isError: false, error: null as unknown },
  list: { data: undefined as unknown, isLoading: false, isError: false, error: null, refetch: vi.fn() },
}));

vi.mock('../../../api/hooks/useTaxEstimatorTaxpayers', () => ({
  useTaxpayerStaff: () => h.staff,
  useTaxpayerStaffCandidates: (_id: string, enabled: boolean) => { h.candidatesEnabled = enabled; return h.candidates; },
  useReplaceTaxpayerStaff: () => h.save,
  useTaxpayers: () => h.list,
  useCreateTaxpayer: () => ({ mutate: vi.fn(), isPending: false, isError: false, error: null }),
  useTaxEstimatorScope: () => ({ data: { firmRole: 'firm_staff', canWrite: true } }),
  setTaxEstimatorFirmId: vi.fn(),
}));
vi.mock('../../../api/hooks/useFirms', () => ({ useFirms: () => ({ data: { firms: [] } }) }));

import { TaxpayerAccessCard } from './TaxpayerAccessCard';
import { TaxpayerListPage } from './TaxpayerListPage';
import { FirmSettingsDialog } from '../years/FirmSettingsDialog';

const staffDto = (over: Partial<TaxpayerStaffDTO> = {}): TaxpayerStaffDTO => ({
  taxpayerId: 'tp1', members: [], total: 0, restrictToLinkedTenants: true, canEdit: true, ...over,
});
const member = (userId: string, name: string) => ({ userId, email: `${userId}@x.com`, displayName: name, firmRole: 'firm_staff' as const, addedAt: '2026-10-12T00:00:00.000Z' });

beforeEach(() => {
  vi.clearAllMocks();
  h.staff = { data: staffDto(), isLoading: false, isError: false, refetch: vi.fn() };
  h.candidates = { data: { data: [
    { userId: 'u1', email: 'ann@x.com', displayName: 'Ann', firmRole: 'firm_staff' },
    { userId: 'u2', email: 'bob@x.com', displayName: 'Bob', firmRole: 'firm_readonly' },
  ], total: 2 }, isLoading: false };
  h.save = { mutate: vi.fn(), isPending: false, isError: false, error: null };
});

describe('TaxpayerAccessCard', () => {
  it('admin, empty list: explains the firm rule and adds a staff member', () => {
    renderRoute(<TaxpayerAccessCard taxpayerId="tp1" />);
    expect(screen.getByText(/Everyone allowed by the firm rule can see it: staff who can reach at least one client company/)).toBeInTheDocument();
    expect(h.candidatesEnabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Limit to staff member'), { target: { value: 'u2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(h.save.mutate).toHaveBeenCalledWith(['u2'], expect.anything());
  });

  it('admin, with a list: shows members, removes one, and can allow everyone again', () => {
    h.staff = { ...h.staff, data: staffDto({ members: [member('u1', 'Ann'), member('u3', 'Cy')], total: 2 }) };
    renderRoute(<TaxpayerAccessCard taxpayerId="tp1" />);
    expect(screen.getByText(/Only the people listed below \(and firm administrators\) can see it, and each still needs access/)).toBeInTheDocument();
    const rows = screen.getAllByTestId('staff-row');
    expect(rows).toHaveLength(2);
    // The picker hides users already on the list.
    expect(within(screen.getByLabelText('Limit to staff member')).queryByText(/Ann/)).toBeNull();
    fireEvent.click(within(rows[0]!).getByRole('button', { name: 'Remove' }));
    expect(h.save.mutate).toHaveBeenLastCalledWith(['u3']);
    fireEvent.click(screen.getByRole('button', { name: 'Allow everyone' }));
    expect(h.save.mutate).toHaveBeenLastCalledWith([]);
  });

  it('non-admin: read-only, no picker, candidates never requested', () => {
    h.staff = { ...h.staff, data: staffDto({ canEdit: false, members: [member('u1', 'Ann')], total: 1, restrictToLinkedTenants: false }) };
    renderRoute(<TaxpayerAccessCard taxpayerId="tp1" />);
    expect(screen.getByText('Only a firm administrator can change this list.')).toBeInTheDocument();
    expect(screen.queryByLabelText('Limit to staff member')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Remove' })).toBeNull();
    expect(h.candidatesEnabled).toBe(false);
    expect(screen.getByText(/Only the people listed below \(and firm administrators\) can see it\.$/)).toBeInTheDocument();
  });

  it('shows the server error inline and has loading / error states', () => {
    h.save = { ...h.save, isError: true, error: new Error('Only active firm staff with Tax Estimator access can be added') };
    const { unmount } = renderRoute(<TaxpayerAccessCard taxpayerId="tp1" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Only active firm staff');
    unmount();
    h.staff = { data: undefined, isLoading: false, isError: true, refetch: vi.fn() };
    renderRoute(<TaxpayerAccessCard taxpayerId="tp1" />);
    expect(screen.getByText('Could not load who can see this taxpayer.')).toBeInTheDocument();
  });
});

describe('FirmSettingsDialog visibility switch', () => {
  const settings: FirmSettingsDTO = {
    firmId: 'f1', safeHarborDefault: 'lesser_of', disclaimerText: null, effectiveDisclaimerText: 'Default', portalShows: 'live',
    restrictTaxpayersToLinkedTenants: true, updatedAt: null,
  };
  it('shows the switch ON with its explanation and saves it OFF', () => {
    const onSave = vi.fn();
    renderRoute(<FirmSettingsDialog open settings={settings} onClose={vi.fn()} onSave={onSave} />);
    const box = screen.getByLabelText('Staff see only taxpayers linked to clients they can access') as HTMLInputElement;
    expect(box.checked).toBe(true);
    expect(screen.getByText(/firm administrators always see everything/)).toBeInTheDocument();
    fireEvent.click(box);
    fireEvent.click(screen.getByRole('button', { name: 'Save settings' }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ restrictTaxpayersToLinkedTenants: false }));
  });
});

describe('TaxpayerListPage lock icon', () => {
  const row = (over: Partial<TaxpayerListItemDTO>): TaxpayerListItemDTO => ({
    id: 'a', displayName: 'Open Taxpayer', filingStatus: 'single', residentState: 'MO', safeHarborOverride: null, portalShows: null,
    isActive: true, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', personNames: [], linkCount: 1, staffRestricted: false, ...over,
  });
  it('marks only taxpayers with a staff list', () => {
    h.list = { data: { data: [row({}), row({ id: 'b', displayName: 'Locked Taxpayer', staffRestricted: true })], total: 2, limit: 25, offset: 0 }, isLoading: false, isError: false, error: null, refetch: vi.fn() };
    renderRoute(<TaxpayerListPage />);
    const locks = screen.getAllByTestId('staff-lock');
    expect(locks).toHaveLength(1);
    expect(locks[0]!.closest('td')).toHaveTextContent('Locked Taxpayer');
  });
});
