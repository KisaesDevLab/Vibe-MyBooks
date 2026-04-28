// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import type { Action } from '@kis-books/shared';
import { renderRoute } from '../../../../test-utils';

// AccountSelector pulls from useAccounts which calls the API.
// Stub it so the test doesn't need a network round-trip.
vi.mock('../../../../api/hooks/useAccounts', () => ({
  useAccounts: () => ({ data: { data: [], total: 0 }, isLoading: false }),
}));
vi.mock('../../../../api/hooks/useCompany', () => ({
  useCompanySettings: () => ({ data: { settings: { categoryFilterMode: 'all' } } }),
}));

import { SplitActionEditor } from './SplitActionEditor';

describe('SplitActionEditor', () => {
  it('shows percentage sum and OK indicator when 100', () => {
    const action: Action = {
      type: 'split_by_percentage',
      splits: [
        { accountId: 'a1', percent: 60 },
        { accountId: 'a2', percent: 40 },
      ],
    };
    renderRoute(<SplitActionEditor action={action} onChange={vi.fn()} />);
    expect(screen.getByText(/Sum: 100\.00%/)).toBeInTheDocument();
    expect(screen.getByText(/✓/)).toBeInTheDocument();
  });

  it('shows error when percentage sum is not 100', () => {
    const action: Action = {
      type: 'split_by_percentage',
      splits: [
        { accountId: 'a1', percent: 60 },
        { accountId: 'a2', percent: 30 },
      ],
    };
    renderRoute(<SplitActionEditor action={action} onChange={vi.fn()} />);
    expect(screen.getByText(/must total 100/)).toBeInTheDocument();
  });

  it('disables remove button when only 2 rows remain', () => {
    const action: Action = {
      type: 'split_by_percentage',
      splits: [
        { accountId: 'a1', percent: 50 },
        { accountId: 'a2', percent: 50 },
      ],
    };
    renderRoute(<SplitActionEditor action={action} onChange={vi.fn()} />);
    const removeButtons = screen.getAllByRole('button', { name: /Remove split row/ });
    for (const btn of removeButtons) {
      expect(btn).toBeDisabled();
    }
  });

  it('renders amount input with text type for fixed-amount splits', () => {
    const action: Action = {
      type: 'split_by_fixed',
      splits: [
        { accountId: 'a1', amount: '50.00' },
        { accountId: 'a2', amount: '25.00' },
      ],
    };
    renderRoute(<SplitActionEditor action={action} onChange={vi.fn()} />);
    expect(screen.getByDisplayValue('50.00')).toBeInTheDocument();
    expect(screen.queryByText(/Sum:/)).toBeNull(); // no percentage sum hint
  });

  it('Add split row calls onChange with an extra entry', () => {
    const onChange = vi.fn();
    const action: Action = {
      type: 'split_by_percentage',
      splits: [
        { accountId: 'a1', percent: 50 },
        { accountId: 'a2', percent: 50 },
      ],
    };
    renderRoute(<SplitActionEditor action={action} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /Add split row/ }));
    const next = onChange.mock.calls[0]?.[0] as { splits: unknown[] };
    expect(next.splits).toHaveLength(3);
  });
});
