// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import type { ActionsField } from '@kis-books/shared';
import { renderRoute } from '../../../../test-utils';

vi.mock('../../../../api/hooks/useAccounts', () => ({
  useAccounts: () => ({ data: { data: [], total: 0 }, isLoading: false }),
}));
vi.mock('../../../../api/hooks/useCompany', () => ({
  useCompanySettings: () => ({ data: { settings: { categoryFilterMode: 'all' } } }),
}));
vi.mock('../../../../api/hooks/useContacts', () => ({
  useContacts: () => ({ data: { data: [], total: 0 }, refetch: vi.fn() }),
  useCreateContact: () => ({ mutateAsync: vi.fn() }),
}));

// Import after mocks. ActionsEditor exports both the flat editor
// and the branching one — the branch path is what we exercise here.
import { ActionsEditor } from './ActionsEditor';

const FLAT_ACTIONS: ActionsField = [
  { type: 'set_account', accountId: '' },
];

describe('ActionsEditor / BranchEditor', () => {
  it('starts in flat mode for an Action[] value', () => {
    renderRoute(<ActionsEditor value={FLAT_ACTIONS} onChange={vi.fn()} />);
    expect(screen.getByText(/Convert to if \/ then \/ else/)).toBeInTheDocument();
  });

  it('Convert to if/then/else flips to a branch', () => {
    const onChange = vi.fn();
    renderRoute(<ActionsEditor value={FLAT_ACTIONS} onChange={onChange} />);
    fireEvent.click(screen.getByText(/Convert to if \/ then \/ else/));
    const next = onChange.mock.calls[0]?.[0];
    expect(next).toHaveProperty('if');
    expect(next).toHaveProperty('then');
  });

  it('renders branch shell with depth indicator', () => {
    const branch: ActionsField = {
      if: { type: 'leaf', field: 'descriptor', operator: 'contains', value: 'amazon' },
      then: FLAT_ACTIONS,
    };
    renderRoute(<ActionsEditor value={branch} onChange={vi.fn()} />);
    expect(screen.getByText(/depth 0 of 5/)).toBeInTheDocument();
  });

  it('Add Else if appends an elif entry', () => {
    const branch: ActionsField = {
      if: { type: 'leaf', field: 'descriptor', operator: 'contains', value: 'amazon' },
      then: FLAT_ACTIONS,
    };
    const onChange = vi.fn();
    renderRoute(<ActionsEditor value={branch} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /Else if/ }));
    const next = onChange.mock.calls[0]?.[0] as { elif: unknown[] };
    expect(next.elif).toHaveLength(1);
  });

  it('Add Else creates an else branch and disables the button thereafter', () => {
    const branch: ActionsField = {
      if: { type: 'leaf', field: 'descriptor', operator: 'contains', value: 'amazon' },
      then: FLAT_ACTIONS,
    };
    const onChange = vi.fn();
    renderRoute(<ActionsEditor value={branch} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /^Else$/ }));
    const next = onChange.mock.calls[0]?.[0] as { else: unknown };
    expect(next.else).toBeDefined();
  });

  it('shows depth-limit warning at depth 4 (one slot remaining)', () => {
    const branch: ActionsField = {
      if: { type: 'leaf', field: 'descriptor', operator: 'contains', value: 'amazon' },
      then: FLAT_ACTIONS,
    };
    renderRoute(<ActionsEditor value={branch} onChange={vi.fn()} depth={4} />);
    expect(screen.getByText(/depth limit reached/i)).toBeInTheDocument();
  });

  it('Convert to flat list extracts the then body', () => {
    const branch: ActionsField = {
      if: { type: 'leaf', field: 'descriptor', operator: 'contains', value: 'amazon' },
      then: [{ type: 'set_memo', memo: 'kept' }],
      else: [{ type: 'set_memo', memo: 'dropped' }],
    };
    const onChange = vi.fn();
    renderRoute(<ActionsEditor value={branch} onChange={onChange} />);
    fireEvent.click(screen.getByText(/Convert to flat list/));
    const next = onChange.mock.calls[0]?.[0] as Array<{ memo: string }>;
    expect(next).toEqual([{ type: 'set_memo', memo: 'kept' }]);
  });
});
