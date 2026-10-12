// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// D18 (OPEN-QUESTIONS Q43): a company the viewer sees only through the taxpayer's access
// list is shown (with its figures) but stays read-only — no entity-setup link, no Edit,
// no Remove — in the links table and the readiness banner.
import { describe, it, expect, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderRoute } from '../../../test-utils';
import type { EstimateReadinessDTO, LinkDTO } from '@kis-books/shared';
import { makeEstimate } from '../estimate/test-fixtures';

const h = vi.hoisted(() => ({ links: [] as unknown[] }));
vi.mock('../../../api/hooks/useTaxEstimatorTaxpayers', () => ({
  useTaxpayerLinks: () => ({ data: { data: h.links, total: h.links.length, warnings: [] }, isLoading: false, isError: false, refetch: vi.fn() }),
  useUpsertLink: () => ({ mutate: vi.fn(), reset: vi.fn(), isPending: false, isError: false, error: null }),
  useRemoveLink: () => ({ mutate: vi.fn(), isPending: false, isError: false, error: null }),
}));

import { LinksSection } from './LinksSection';
import { ReadinessBanner } from '../estimate/ReadinessBanner';

const link = (over: Partial<LinkDTO>): LinkDTO => ({
  id: 'l1', taxpayerId: 'tp1', personId: 'p1', personRole: 'primary', taxYear: new Date().getFullYear(), tenantId: 't1', companyId: 'c1',
  tenantName: 'Client One', companyName: 'Own Co', entityKind: null, returnForm: null, outOfScope: false,
  profitPct: 100, lossPct: 100, capitalPct: null, partnerSeStatus: null, partnerSeMemo: null, isOfficer: false, activityType: 'active',
  activeParticipation: false, qbiEligible: null, qbiOverrideReason: null, allowedLossOverride: null, allowedLossReason: null, ...over,
});

describe('D18 access-list companies', () => {
  it('links table: badge, and no entity setup / Edit / Remove for a company seen via the access list', () => {
    h.links = [link({}), link({ id: 'l2', tenantId: 't2', companyId: 'c2', tenantName: 'Client Two', companyName: 'Listed Co', viaStaffList: true })];
    renderRoute(<LinksSection taxpayerId="tp1" persons={[{ id: 'p1', taxpayerId: 'tp1', role: 'primary', firstName: 'A', lastName: 'B', dateOfBirth: null, isBlind: false, sehiEligibleMonths: [] }]} canWrite />);
    const [own, listed] = screen.getAllByTestId('link-row');
    expect(within(own!).getByText('Entity tax setup')).toBeInTheDocument();
    expect(within(own!).getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    expect(within(own!).getByRole('button', { name: 'Remove' })).toBeInTheDocument();
    expect(within(own!).queryByTestId('via-staff-list')).toBeNull();
    expect(within(listed!).getByText(/Listed Co/)).toBeInTheDocument();
    expect(within(listed!).getByTestId('via-staff-list')).toHaveTextContent('Via access list');
    expect(within(listed!).queryByText('Entity tax setup')).toBeNull();
    expect(within(listed!).queryByRole('button', { name: 'Edit' })).toBeNull();
    expect(within(listed!).queryByRole('button', { name: 'Remove' })).toBeNull();
  });

  it('readiness banner: no entity-setup link for a company seen via the access list', () => {
    const readiness = (viaStaffList: boolean): EstimateReadinessDTO => ({
      taxpayerId: 'tp1', taxYear: 2026, outOfScopeLinks: 0, schAiPeriods: [], ready: false, warnings: [],
      entities: [{
        tenantId: 't2', companyId: 'c2', companyName: 'Listed Co', linkCount: 1, inScope: true, error: null, ...(viaStaffList ? { viaStaffList } : {}),
        readiness: { unreconciledAccounts: [], suspense: { balance: '0', transactionCount: 0 }, unmappedAccounts: [{ accountId: 'a1' }], warnings: [], throughMonth: '2026-09' } as never,
      }],
    });
    const { unmount } = renderRoute(<ReadinessBanner taxpayerId="tp1" taxYear={2026} estimate={makeEstimate()} readiness={readiness(false)} />);
    expect(screen.getByText('Open entity tax setup')).toBeInTheDocument();
    unmount();
    renderRoute(<ReadinessBanner taxpayerId="tp1" taxYear={2026} estimate={makeEstimate()} readiness={readiness(true)} />);
    expect(screen.getByText(/Listed Co: 1 account\(s\) with activity have no tax treatment/)).toBeInTheDocument();
    expect(screen.queryByText('Open entity tax setup')).toBeNull();
  });
});
