// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import type { ConditionalRule } from '@kis-books/shared';
import { renderRoute } from '../../../test-utils';

// Stub the data hook so the page renders deterministically
// without a network round-trip.
const sampleRule: ConditionalRule & { stats: { lastFiredAt: string | null; fires30d: number; overrideRate: number | null } | null } = {
  id: 'rule-1',
  tenantId: 't1',
  companyId: null,
  name: 'Amazon → Office Supplies',
  priority: 100,
  conditions: { type: 'leaf', field: 'descriptor', operator: 'contains', value: 'amazon' },
  actions: [{ type: 'set_account', accountId: '00000000-0000-0000-0000-000000000010' }],
  continueAfterMatch: false,
  active: true,
  createdBy: null,
  // 3-tier rules plan, Phase 5 — synthetic ConditionalRule
  // fixture needs the tier columns the type added in Phase 2.
  scope: 'tenant_user',
  ownerUserId: 'u1',
  ownerFirmId: null,
  forkedFromGlobalId: null,
  createdAt: '2026-04-01T00:00:00.000Z',
  updatedAt: '2026-04-01T00:00:00.000Z',
  stats: { lastFiredAt: '2026-04-15T00:00:00.000Z', fires30d: 12, overrideRate: 0.08 },
};

const { listFn, mutateFn } = vi.hoisted(() => ({
  listFn: vi.fn(),
  mutateFn: vi.fn(),
}));

vi.mock('../../../api/hooks/useConditionalRules', () => ({
  useConditionalRules: () => ({ data: listFn(), isLoading: false }),
  useCreateConditionalRule: () => ({ mutateAsync: mutateFn, mutate: mutateFn, isPending: false }),
  useUpdateConditionalRule: () => ({ mutateAsync: mutateFn, mutate: mutateFn, isPending: false }),
  useDeleteConditionalRule: () => ({ mutateAsync: mutateFn, mutate: mutateFn, isPending: false }),
  useReorderConditionalRules: () => ({ mutate: mutateFn, isPending: false }),
}));
vi.mock('../../../api/hooks/useAccounts', () => ({
  useAccounts: () => ({ data: { data: [], total: 0 }, isLoading: false }),
}));
vi.mock('../../../api/hooks/useCompany', () => ({
  useCompanySettings: () => ({ data: { settings: { categoryFilterMode: 'all' } } }),
}));
vi.mock('../../../api/hooks/useContacts', () => ({
  useContacts: () => ({ data: { data: [], total: 0 }, refetch: vi.fn() }),
  useCreateContact: () => ({ mutateAsync: vi.fn() }),
}));

import { RulesPage } from './RulesPage';

describe('RulesPage', () => {
  it('renders the page heading and "New rule" button', () => {
    listFn.mockReturnValue({ rules: [] });
    renderRoute(<RulesPage />);
    expect(screen.getByRole('heading', { name: 'Rules' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /New rule/ })).toBeInTheDocument();
  });

  it('shows empty-state row when rules list is empty', () => {
    listFn.mockReturnValue({ rules: [] });
    renderRoute(<RulesPage />);
    expect(screen.getByText(/No conditional rules yet/)).toBeInTheDocument();
  });

  it('renders a rule row with name, fires30d and override rate', () => {
    listFn.mockReturnValue({ rules: [sampleRule] });
    renderRoute(<RulesPage />);
    expect(screen.getByText(sampleRule.name)).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('8%')).toBeInTheDocument();
  });

  it('opens builder modal when "New rule" clicked', () => {
    listFn.mockReturnValue({ rules: [] });
    renderRoute(<RulesPage />);
    fireEvent.click(screen.getByRole('button', { name: /New rule/ }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/New Conditional Rule/)).toBeInTheDocument();
  });

  it('filter bar drops an inactive rule when "Active only" is selected', () => {
    listFn.mockReturnValue({
      rules: [
        sampleRule,
        { ...sampleRule, id: 'rule-2', name: 'Inactive Rule', active: false },
      ],
    });
    renderRoute(<RulesPage />);
    expect(screen.getByText('Inactive Rule')).toBeInTheDocument();
    const statusSelect = screen.getByLabelText('Status') as HTMLSelectElement;
    fireEvent.change(statusSelect, { target: { value: 'active' } });
    expect(screen.queryByText('Inactive Rule')).toBeNull();
  });
});
