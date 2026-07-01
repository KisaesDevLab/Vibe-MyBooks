// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Can } from './Can';

// Mock the /me source that usePermissions reads. A restricted
// bookkeeper: view Invoices, full Receive Payment (the user example).
vi.mock('../../api/hooks/useAuth', () => ({
  useMe: () => ({
    data: {
      user: { role: 'bookkeeper' },
      permissions: { invoices: 'view', receive_payment: 'full' },
    },
  }),
}));

describe('Can', () => {
  it('shows read-allowed content and hides write-denied content', () => {
    render(
      <>
        <Can resource="invoices" action="read"><span>view-invoices</span></Can>
        <Can resource="invoices" action="create"><span>create-invoice</span></Can>
        <Can resource="receive_payment" action="create"><span>receive-payment</span></Can>
        <Can resource="bills" action="read"><span>view-bills</span></Can>
      </>,
    );
    expect(screen.getByText('view-invoices')).toBeTruthy();
    expect(screen.queryByText('create-invoice')).toBeNull();   // view → no write
    expect(screen.getByText('receive-payment')).toBeTruthy();  // full → write ok
    expect(screen.queryByText('view-bills')).toBeNull();       // unset → none
  });

  it('renders the fallback when denied', () => {
    render(
      <Can resource="bills" action="read" fallback={<span>no-access</span>}>
        <span>bills</span>
      </Can>,
    );
    expect(screen.getByText('no-access')).toBeTruthy();
  });
});
