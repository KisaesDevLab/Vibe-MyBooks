// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// D17 taxpayer visibility: the "Who can see this taxpayer" card, the firm switch in the
// firm settings dialog, and the list's lock icon. The server enforces the rules; these
// tests pin what the screens show and send. Q54 (Kurt, 2026-10-13) restated the card's texts
// (firm admins are hidden by a list that does not name them), added the manager rule / remove-
// yourself confirm / lost-access redirect, and the list's "Ask a firm admin" empty state.
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
  scope: { firmRole: 'firm_staff', canWrite: true } as Record<string, unknown>,
  me: { id: 'me', isSuperAdmin: false },
  navigate: vi.fn(),
}));
vi.mock('react-router-dom', async (orig) => ({ ...(await orig<typeof import('react-router-dom')>()), useNavigate: () => h.navigate }));
vi.mock('../../../api/hooks/useAuth', () => ({ useMe: () => ({ data: { user: h.me } }) }));

vi.mock('../../../api/hooks/useTaxEstimatorTaxpayers', () => ({
  useTaxpayerStaff: () => h.staff,
  useTaxpayerStaffCandidates: (_id: string, enabled: boolean) => { h.candidatesEnabled = enabled; return h.candidates; },
  useReplaceTaxpayerStaff: () => h.save,
  useTaxpayers: () => h.list,
  useCreateTaxpayer: () => ({ mutate: vi.fn(), isPending: false, isError: false, error: null }),
  useTaxEstimatorScope: () => ({ data: h.scope }),
  setTaxEstimatorFirmId: vi.fn(),
}));
vi.mock('../../../api/hooks/useFirms', () => ({ useFirms: () => ({ data: { firms: [] } }) }));
// Q52 firm cards fetch on their own; covered by FirmDashboardCards.test.tsx.
vi.mock('./FirmDashboardCards', () => ({ FirmDashboardCards: () => null }));

import { TaxpayerAccessCard } from './TaxpayerAccessCard';
import { TaxpayerListPage } from './TaxpayerListPage';
import { FirmSettingsDialog } from '../years/FirmSettingsDialog';

const staffDto = (over: Partial<TaxpayerStaffDTO> = {}): TaxpayerStaffDTO => ({
  taxpayerId: 'tp1', members: [], total: 0, restrictToLinkedTenants: true, canEdit: true, ...over,
});
const member = (userId: string, name: string, firmRole: 'firm_admin' | 'firm_staff' = 'firm_staff') => ({ userId, email: `${userId}@x.com`, displayName: name, firmRole, addedAt: '2026-10-12T00:00:00.000Z' });

beforeEach(() => {
  vi.clearAllMocks();
  h.staff = { data: staffDto(), isLoading: false, isError: false, refetch: vi.fn() };
  h.candidates = { data: { data: [
    { userId: 'u1', email: 'ann@x.com', displayName: 'Ann', firmRole: 'firm_staff' },
    { userId: 'u2', email: 'bob@x.com', displayName: 'Bob', firmRole: 'firm_readonly' },
  ], total: 2 }, isLoading: false };
  h.save = { mutate: vi.fn(), isPending: false, isError: false, error: null };
  h.scope = { firmRole: 'firm_staff', canWrite: true };
  h.me = { id: 'me', isSuperAdmin: false };
});

describe('TaxpayerAccessCard', () => {
  it('admin, empty list: explains the firm rule (Q54: capability needed) and adds a staff member', () => {
    h.me = { id: 'sa', isSuperAdmin: true }; // a super admin (not a firm member) is neither auto-added nor asked
    renderRoute(<TaxpayerAccessCard taxpayerId="tp1" />);
    expect(screen.getByText(/No list: firm administrators can see it, and so can staff granted "Tax Estimator: view taxpayers" who can reach at least one client company/)).toBeInTheDocument();
    expect(screen.getByText(/Client access alone does not show a taxpayer/)).toBeInTheDocument();
    expect(screen.getByText(/sees only the linked companies in clients they can open/)).toBeInTheDocument();
    expect(h.candidatesEnabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Limit to staff member'), { target: { value: 'u2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(h.save.mutate).toHaveBeenCalledWith(['u2'], expect.anything());
  });

  it('Q54: the first entry of a new list brings the editing firm admin along (a list needs a manager)', () => {
    h.candidates = { data: { data: [
      { userId: 'me', email: 'me@x.com', displayName: 'Me', firmRole: 'firm_admin' },
      { userId: 'u1', email: 'ann@x.com', displayName: 'Ann', firmRole: 'firm_staff' },
    ], total: 2 }, isLoading: false };
    renderRoute(<TaxpayerAccessCard taxpayerId="tp1" />);
    expect(screen.getByText(/You.ll be added too/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Limit to staff member'), { target: { value: 'u1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(h.save.mutate).toHaveBeenCalledWith(['me', 'u1'], expect.anything());
  });

  it('admin, with a list: shows members, removes one, and can allow everyone again', () => {
    h.staff = { ...h.staff, data: staffDto({ members: [member('me', 'Me', 'firm_admin'), member('u1', 'Ann'), member('u3', 'Cy')], total: 3 }) };
    renderRoute(<TaxpayerAccessCard taxpayerId="tp1" />);
    // D18 / Q54: a non-empty list replaces the firm rule — firm admins included.
    expect(screen.getByText(/Only the people listed and super admins \u2014 including firm admins \u2014 can see this taxpayer/)).toBeInTheDocument();
    expect(screen.getByText(/Listed people see all of its linked companies even in clients they can.t otherwise open/)).toBeInTheDocument();
    const rows = screen.getAllByTestId('staff-row');
    expect(rows).toHaveLength(3);
    // The picker hides users already on the list.
    expect(within(screen.getByLabelText('Limit to staff member')).queryByText(/Ann/)).toBeNull();
    fireEvent.click(within(rows[1]!).getByRole('button', { name: 'Remove' }));
    expect(h.save.mutate).toHaveBeenLastCalledWith(['me', 'u3'], expect.anything());
    fireEvent.click(screen.getByRole('button', { name: 'Allow everyone' }));
    expect(h.save.mutate).toHaveBeenLastCalledWith([], expect.anything());
  });

  it('Q54: removing yourself asks first ("you will lose access"); a lost-access save returns to the list', () => {
    h.staff = { ...h.staff, data: staffDto({ members: [member('me', 'Me', 'firm_admin'), member('u9', 'Other Admin', 'firm_admin')], total: 2 }) };
    h.save.mutate = vi.fn((_ids: string[], opts?: { onSuccess?: (d: TaxpayerStaffDTO) => void }) => opts?.onSuccess?.(staffDto({ callerLostAccess: true, canEdit: false })));
    renderRoute(<TaxpayerAccessCard taxpayerId="tp1" />);
    fireEvent.click(within(screen.getAllByTestId('staff-row')[0]!).getByRole('button', { name: 'Remove' }));
    expect(h.save.mutate).not.toHaveBeenCalled();
    expect(screen.getByText(/You will lose access to this taxpayer/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Remove my access' }));
    expect(h.save.mutate).toHaveBeenCalledWith(['u9'], expect.anything());
    expect(h.navigate).toHaveBeenCalledWith('/tax-estimator/taxpayers');
  });

  it('Q54: a super admin is never asked (always keeps access); the no-manager error reads plainly', async () => {
    h.me = { id: 'sa', isSuperAdmin: true };
    const { ApiError } = await import('../../../api/client');
    h.save = { ...h.save, isError: true, error: new ApiError('x', 'TE_STAFF_LIST_NO_MANAGER', undefined, 422) };
    h.staff = { ...h.staff, data: staffDto({ members: [member('u1', 'Ann'), member('u3', 'Cy')], total: 2 }) };
    renderRoute(<TaxpayerAccessCard taxpayerId="tp1" />);
    fireEvent.click(within(screen.getAllByTestId('staff-row')[0]!).getByRole('button', { name: 'Remove' }));
    expect(h.save.mutate).toHaveBeenCalledWith(['u3'], expect.anything());
    expect(screen.getByRole('alert')).toHaveTextContent('Keep at least one firm administrator on the list');
  });

  it('non-admin: read-only, no picker, candidates never requested', () => {
    h.staff = { ...h.staff, data: staffDto({ canEdit: false, members: [member('u1', 'Ann')], total: 1, restrictToLinkedTenants: false }) };
    renderRoute(<TaxpayerAccessCard taxpayerId="tp1" />);
    expect(screen.getByText('Only a firm administrator on this list (or a super admin) can change it.')).toBeInTheDocument();
    expect(screen.queryByLabelText('Limit to staff member')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Remove' })).toBeNull();
    expect(h.candidatesEnabled).toBe(false);
    expect(screen.getByText(/Only the people listed and super admins/)).toBeInTheDocument();
    expect(screen.queryByText(/still needs access/)).toBeNull();
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
    // Q54: the switch applies to staff holding the capability; firm admins see only unlisted taxpayers.
    expect(screen.getByText(/Applies to staff granted/)).toBeInTheDocument();
    expect(screen.getByText(/firm administrators see every taxpayer without an access list/)).toBeInTheDocument();
    fireEvent.click(box);
    fireEvent.click(screen.getByRole('button', { name: 'Save settings' }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ restrictTaxpayersToLinkedTenants: false }));
  });
});

describe('TaxpayerListPage lock icon', () => {
  const row = (over: Partial<TaxpayerListItemDTO>): TaxpayerListItemDTO => ({
    id: 'a', displayName: 'Open Taxpayer', filingStatus: 'single', residentState: 'MO', safeHarborOverride: null, portalShows: null,
    isActive: true, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', personNames: [], linkCount: 1, staffRestricted: false, showOnCompanyDashboard: false, ...over,
  });
  it('marks only taxpayers with a staff list', () => {
    h.list = { data: { data: [row({}), row({ id: 'b', displayName: 'Locked Taxpayer', staffRestricted: true })], total: 2, limit: 25, offset: 0 }, isLoading: false, isError: false, error: null, refetch: vi.fn() };
    renderRoute(<TaxpayerListPage />);
    const locks = screen.getAllByTestId('staff-lock');
    expect(locks).toHaveLength(1);
    expect(locks[0]!.closest('td')).toHaveTextContent('Locked Taxpayer');
    expect(locks[0]!.getAttribute('title')).toMatch(/listed staff see all of its linked companies/);
  });
});

describe('Q54 TaxpayerListPage access empty state', () => {
  const empty = { data: { data: [], total: 0, limit: 25, offset: 0 }, isLoading: false, isError: false, error: null, refetch: vi.fn() };
  it('a member without "Tax Estimator: view taxpayers" sees "Ask a firm admin for Tax Estimator access"', () => {
    h.list = empty;
    h.scope = { firmRole: 'firm_staff', canWrite: true, canViewUnlistedTaxpayers: false };
    renderRoute(<TaxpayerListPage />);
    expect(screen.getByTestId('te-access-needed')).toHaveTextContent('Ask a firm admin for Tax Estimator access');
    expect(screen.queryByText(/No taxpayers yet/)).toBeNull();
  });
  it('with the capability the ordinary empty state shows', () => {
    h.list = empty;
    h.scope = { firmRole: 'firm_staff', canWrite: true, canViewUnlistedTaxpayers: true };
    renderRoute(<TaxpayerListPage />);
    expect(screen.queryByTestId('te-access-needed')).toBeNull();
    expect(screen.getByText(/No taxpayers yet/)).toBeInTheDocument();
  });
});
