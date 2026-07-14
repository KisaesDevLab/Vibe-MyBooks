// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Regression: the Quick Add Contact modal lives inside page-level
// <form>s (Expense, Write Check, Enter Bill…). Its submit used to
// bubble through the React tree into the OUTER form's onSubmit —
// submitting/navigating the whole page, losing the user's inputs, and
// aborting the contact creation. The modal is now portaled to <body>
// and stops propagation on submit.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderRoute } from '../../test-utils';

const createMutate = vi.fn((_input: unknown, opts?: { onSuccess?: (r: unknown) => void }) =>
  opts?.onSuccess?.({
    contact: {
      id: 'new-contact-1', displayName: 'Acme Plumbing', contactType: 'vendor',
      defaultExpenseAccountId: null, defaultTagId: null,
    },
  }),
);

vi.mock('../../api/hooks/useContacts', () => ({
  useContacts: () => ({ data: { data: [], total: 0 }, isLoading: false, refetch: vi.fn() }),
  useContact: () => ({ data: undefined, isLoading: false }),
  useCreateContact: () => ({ mutate: createMutate, isPending: false, error: null }),
}));

import { ContactSelector } from './ContactSelector';

beforeEach(() => createMutate.mockClear());

function Harness({ onOuterSubmit, onChange }: { onOuterSubmit: () => void; onChange: (v: string) => void }) {
  return (
    <form onSubmit={(e) => { e.preventDefault(); onOuterSubmit(); }}>
      <ContactSelector value="" onChange={onChange} contactTypeFilter="vendor" />
      <button type="submit">Post outer form</button>
    </form>
  );
}

async function openQuickAdd() {
  // Open the dropdown, type a name, click the "Add …" row.
  fireEvent.focus(screen.getByPlaceholderText('Search contacts...'));
  fireEvent.change(screen.getByPlaceholderText('Search contacts...'), { target: { value: 'Acme Plumbing' } });
  fireEvent.click(await screen.findByText('Add "Acme Plumbing"'));
  await screen.findByText('Quick Add Contact');
}

describe('ContactSelector — Quick Add modal inside a parent form', () => {
  it('creates and selects the contact WITHOUT submitting the outer form', async () => {
    const onOuterSubmit = vi.fn();
    const onChange = vi.fn();
    renderRoute(<Harness onOuterSubmit={onOuterSubmit} onChange={onChange} />);
    await openQuickAdd();

    fireEvent.click(screen.getByRole('button', { name: /add contact/i }));

    await waitFor(() => expect(createMutate).toHaveBeenCalledTimes(1));
    expect((createMutate.mock.calls[0]![0] as { displayName: string }).displayName).toBe('Acme Plumbing');
    // The new contact is selected in the parent field…
    expect(onChange).toHaveBeenCalledWith('new-contact-1');
    // …and the page's own form was NOT submitted (the reported bug:
    // the screen "refreshed" and inputs were lost).
    expect(onOuterSubmit).not.toHaveBeenCalled();
    // Modal closed after success.
    expect(screen.queryByText('Quick Add Contact')).toBeNull();
  });

  it('pressing Enter inside the modal does not submit the outer form either', async () => {
    const onOuterSubmit = vi.fn();
    renderRoute(<Harness onOuterSubmit={onOuterSubmit} onChange={() => {}} />);
    await openQuickAdd();

    const nameInput = screen.getByLabelText('Display Name');
    fireEvent.submit(nameInput.closest('form')!);

    await waitFor(() => expect(createMutate).toHaveBeenCalledTimes(1));
    expect(onOuterSubmit).not.toHaveBeenCalled();
  });

  it('renders the modal outside the parent form element (portal)', async () => {
    renderRoute(<Harness onOuterSubmit={() => {}} onChange={() => {}} />);
    await openQuickAdd();
    const modalForm = screen.getByLabelText('Display Name').closest('form')!;
    // No nested <form>: the modal's form must not sit inside the page form.
    expect(modalForm.parentElement?.closest('form')).toBeNull();
  });
});
