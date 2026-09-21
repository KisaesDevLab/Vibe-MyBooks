// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Write Check seeds the printed memo from the vendor's account number
// (contacts.vendor_account_number). The rules under test:
//   - a vendor with a number fills the memo; one without leaves it blank
//   - the previous vendor's number never rides onto the next payee's check
//   - a memo the user typed themselves survives a change of vendor

import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderRoute } from '../../test-utils';
import {
  checksMocks, accountsMocks, contactsMocks, companyMocks, tagsMocks, apMocks, transactionsMocks,
} from '../../test-mocks';

const VENDORS: Record<string, { displayName: string; vendorAccountNumber: string | null }> = {
  water: { displayName: 'City Water', vendorAccountNumber: '00-4471-A' },
  power: { displayName: 'Power Co', vendorAccountNumber: '998877' },
  plain: { displayName: 'No Number LLC', vendorAccountNumber: null },
};

vi.mock('../../api/hooks/useChecks', () => checksMocks());
vi.mock('../../api/hooks/useAccounts', () => accountsMocks());
vi.mock('../../api/hooks/useContacts', () => ({
  ...contactsMocks(),
  useContact: (id: string) => ({ data: VENDORS[id] ? { contact: { id, ...VENDORS[id] } } : undefined, isLoading: false }),
}));
vi.mock('../../api/hooks/useCompany', () => companyMocks());
vi.mock('../../api/hooks/useTags', () => tagsMocks());
vi.mock('../../api/hooks/useAp', () => apMocks());
vi.mock('../../api/hooks/useTransactions', () => transactionsMocks());
// The real selector is a search combobox; the page only needs its two callbacks.
vi.mock('../../components/forms/ContactSelector', () => ({
  ContactSelector: ({ onChange, onSelect }: { onChange: (id: string) => void; onSelect: (c: unknown) => void }) => (
    <div>
      {Object.entries(VENDORS).map(([id, v]) => (
        <button key={id} type="button" onClick={() => { onChange(id); onSelect({ id, displayName: v.displayName }); }}>
          pick {id}
        </button>
      ))}
    </div>
  ),
}));

import { WriteCheckPage } from './WriteCheckPage';

const memo = () => screen.getByLabelText('Printed Memo') as HTMLInputElement;
const pick = (id: string) => fireEvent.click(screen.getByRole('button', { name: `pick ${id}` }));

describe('WriteCheckPage vendor account number → printed memo', () => {
  it('fills the memo from the vendor, verbatim, and follows a change of vendor', () => {
    renderRoute(<WriteCheckPage />, { route: '/checks/write', path: '/checks/write' });
    expect(memo().value).toBe('');

    pick('water');
    expect(memo().value).toBe('Acct 00-4471-A');

    pick('power');
    expect(memo().value).toBe('Acct 998877');

    // No number on file → blank, not the previous vendor's number.
    pick('plain');
    expect(memo().value).toBe('');
  });

  it('drops an edited memo that still carries the previous vendor’s number', () => {
    renderRoute(<WriteCheckPage />, { route: '/checks/write', path: '/checks/write' });
    pick('water');
    fireEvent.change(memo(), { target: { value: 'Acct 00-4471-A - June' } });
    pick('power');
    expect(memo().value).toBe('Acct 998877');
  });

  it('keeps a memo the user wrote themselves when the vendor changes', () => {
    renderRoute(<WriteCheckPage />, { route: '/checks/write', path: '/checks/write' });
    pick('water');
    fireEvent.change(memo(), { target: { value: 'June rent' } });
    pick('power');
    expect(memo().value).toBe('June rent');
  });
});
