// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Where Pay Bills lands after a successful payment. Non-check methods used
// to navigate to '/bill-payments', which is an API path, not a screen — the
// payment posted and the user got a 404. Every target asserted here must be
// a real <Route> in App.tsx.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderRoute } from '../../test-utils';
import { apMocks, accountsMocks, passthroughQuery } from '../../test-mocks';

const navigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigate };
});

const mutate = vi.fn((_input: unknown, opts?: { onSuccess?: (r: unknown) => void }) => {
  opts?.onSuccess?.({ payments: [{ id: 'p1' }] });
});

vi.mock('../../api/hooks/useAp', () => ({
  ...apMocks(),
  usePayableBills: passthroughQuery({
    bills: [{ id: 'b1', contactId: 'v1', contactName: 'Acme Supply', txnNumber: 'BILL-1', balanceDue: '125.0000', total: '125.0000' }],
    credits: [],
  }),
  usePayBills: () => ({ mutate, isPending: false }),
}));
vi.mock('../../api/hooks/useAccounts', () => accountsMocks());
vi.mock('../../api/hooks/useChecks', () => ({
  useCheckSettings: passthroughQuery({ settings: { defaultBankAccountId: 'bank-1' } }),
}));

import { PayBillsPage } from './PayBillsPage';

function payWith(method: string) {
  renderRoute(<PayBillsPage />, { route: '/pay-bills', path: '/pay-bills' });
  fireEvent.change(screen.getByDisplayValue('Check (Print Later)'), { target: { value: method } });
  fireEvent.click(screen.getAllByRole('checkbox')[0]!);
  fireEvent.click(screen.getByRole('button', { name: 'Pay Selected' }));
}

beforeEach(() => {
  navigate.mockClear();
  mutate.mockClear();
});

describe('PayBillsPage post-payment redirect', () => {
  // Every method except the print-later check is finished once it posts.
  for (const method of ['ach', 'check_handwritten', 'credit_card', 'cash', 'other']) {
    it(`returns to Bills after a ${method} payment`, () => {
      payWith(method);
      expect(mutate).toHaveBeenCalledTimes(1);
      expect(mutate.mock.calls[0]![0]).toMatchObject({ method, printLater: false, bankAccountId: 'bank-1' });
      expect(navigate).toHaveBeenCalledTimes(1);
      expect(navigate).toHaveBeenCalledWith('/bills');
      expect(screen.getByText('Payment recorded')).toBeTruthy();
    });
  }

  it('goes to the print queue after a print-later check', () => {
    payWith('check');
    expect(mutate.mock.calls[0]![0]).toMatchObject({ method: 'check', printLater: true });
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith('/checks/print');
  });
});
