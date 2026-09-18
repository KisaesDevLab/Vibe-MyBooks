// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Quick Add Account from any account dropdown: offered to firm staff
// only, restricted to the dropdown's account types, and — like Quick Add
// Contact — never submits the page-level form it sits in.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderRoute } from '../../test-utils';

const createMutate = vi.fn((_input: unknown, opts?: { onSuccess?: (r: unknown) => void }) =>
  opts?.onSuccess?.({ account: { id: 'new-acct-1', name: 'Feed - Alfalfa', accountType: 'expense' } }),
);
let firms: Array<{ id: string }> = [{ id: 'firm-1' }];

vi.mock('../../api/hooks/useAccounts', () => ({
  useAccounts: () => ({ data: { data: [], total: 0 }, isLoading: false }),
  useCreateAccount: () => ({ mutate: createMutate, isPending: false, error: null }),
}));
vi.mock('../../api/hooks/useCompany', () => ({
  useCompanySettings: () => ({ data: { settings: { categoryFilterMode: 'by_type' } } }),
}));
vi.mock('../../api/hooks/useAuth', () => ({
  useMe: () => ({ data: { user: { isSuperAdmin: false } } }),
}));
vi.mock('../../api/hooks/useFirms', () => ({
  useFirms: () => ({ data: { firms } }),
}));
vi.mock('../../api/hooks/useDetailTypes', () => ({
  useDetailTypes: () => ({ optionsFor: () => [{ value: 'other_expense', label: 'Other Expense' }] }),
}));

import { AccountSelector } from './AccountSelector';

beforeEach(() => {
  createMutate.mockClear();
  firms = [{ id: 'firm-1' }];
});

function Harness({ onOuterSubmit, onChange }: { onOuterSubmit: () => void; onChange: (v: string) => void }) {
  return (
    <form onSubmit={(e) => { e.preventDefault(); onOuterSubmit(); }}>
      <AccountSelector value="" onChange={onChange} accountTypeFilter="expense" />
      <button type="submit">Post outer form</button>
    </form>
  );
}

function typeInDropdown(text: string) {
  fireEvent.focus(screen.getByPlaceholderText('Search accounts...'));
  fireEvent.change(screen.getByPlaceholderText('Search accounts...'), { target: { value: text } });
}

describe('AccountSelector — Quick Add Account', () => {
  it('firm staff create and select a new account without submitting the outer form', async () => {
    const onOuterSubmit = vi.fn();
    const onChange = vi.fn();
    renderRoute(<Harness onOuterSubmit={onOuterSubmit} onChange={onChange} />);
    typeInDropdown('Feed - Alfalfa');
    fireEvent.click(await screen.findByText('Add "Feed - Alfalfa"'));
    await screen.findByText('Quick Add Account');

    // Type is locked to the dropdown's filter.
    const typeSelect = screen.getByLabelText('Account Type') as HTMLSelectElement;
    expect(typeSelect.value).toBe('expense');
    expect(typeSelect.disabled).toBe(true);

    fireEvent.change(screen.getByLabelText('Account Number (optional)'), { target: { value: '61191' } });
    fireEvent.click(screen.getByRole('button', { name: /add account/i }));

    await waitFor(() => expect(createMutate).toHaveBeenCalledTimes(1));
    expect(createMutate.mock.calls[0]![0]).toEqual({
      name: 'Feed - Alfalfa', accountNumber: '61191', accountType: 'expense', detailType: null,
    });
    expect(onChange).toHaveBeenCalledWith('new-acct-1');
    expect(onOuterSubmit).not.toHaveBeenCalled();
    expect(screen.queryByText('Quick Add Account')).toBeNull();
  });

  it('is not offered to users outside a firm', async () => {
    firms = [];
    renderRoute(<Harness onOuterSubmit={() => {}} onChange={() => {}} />);
    typeInDropdown('Feed - Alfalfa');
    await waitFor(() => expect(screen.queryByText('Add "Feed - Alfalfa"')).toBeNull());
  });
});
