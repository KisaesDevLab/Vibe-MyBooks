// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// "Ask the client for help" on the In suspense tab.
//
// What matters: the request goes to the ticked contacts only (the server
// decides who those are; the screen shows them), the channels the firm can
// actually use are the ones offered, and the three "they would log in to
// nothing" states are said out loud before the button is enabled.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderRoute } from '../../../test-utils';
import { accountsMocks, companyMocks, contactsMocks, passthroughMutation } from '../../../test-mocks';

const sendMutate = vi.fn();
let recipientsView: Record<string, unknown> = {};

const baseView = {
  portalEnabled: true,
  queueCount: 3,
  smsAvailable: false,
  smsUnavailableReason: 'Text messages are switched off for this firm (Practice → Client Portal settings).',
  companyName: 'Darrow Enterprises',
  contacts: [
    {
      contactId: 'c1', name: 'Dana Darrow', email: 'dana@example.com', phone: '+15555550100',
      emailSuppressed: false, smsSuppressed: false, lastSeenAt: null, lastAskedAt: null,
    },
    {
      contactId: 'c2', name: 'Pat Books', email: 'pat@example.com', phone: null,
      emailSuppressed: false, smsSuppressed: false, lastSeenAt: null, lastAskedAt: null,
    },
  ],
};

vi.mock('../../../api/hooks/useUncategorized', () => ({
  useSuspenseSummary: () => ({ data: undefined, isLoading: false, isError: false }),
  useInSuspense: () => ({
    data: { rows: [], total: 0, suspenseAccountId: 'acct-suspense' },
    isLoading: false, isError: false, refetch: vi.fn(),
  }),
  useClearSuspense: passthroughMutation,
  useHelpRecipients: () => ({ data: recipientsView, isLoading: false, isError: false, refetch: vi.fn() }),
  useSendHelpRequest: () => ({ ...passthroughMutation(), mutate: sendMutate, isPending: false }),
}));
vi.mock('../../../api/hooks/useAccounts', () => accountsMocks());
vi.mock('../../../api/hooks/useContacts', () => contactsMocks());
vi.mock('../../../api/hooks/useCompany', () => companyMocks());

import { InSuspenseTab } from './InSuspenseTab';

beforeEach(() => {
  sendMutate.mockClear();
  recipientsView = { ...baseView };
});

async function openModal() {
  renderRoute(<InSuspenseTab />);
  fireEvent.click(screen.getByRole('button', { name: /ask the client for help/i }));
  await waitFor(() => screen.getByRole('dialog', { name: /ask the client/i }));
}

describe('In suspense — Ask the client for help', () => {
  it('lists the eligible contacts, all ticked, and says how many rows they will find', async () => {
    await openModal();
    expect(screen.getByText('Dana Darrow')).toBeTruthy();
    expect(screen.getByText('Pat Books')).toBeTruthy();
    expect((screen.getByLabelText('Send to Dana Darrow') as HTMLInputElement).checked).toBe(true);
    expect(screen.getByText('3')).toBeTruthy();
  });

  it('sends email to the ticked contacts with the note', async () => {
    await openModal();
    fireEvent.click(screen.getByLabelText('Send to Pat Books'));
    fireEvent.change(screen.getByPlaceholderText(/anything you remember helps/i), {
      target: { value: 'Mostly the August checks.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send request/i }));
    expect(sendMutate).toHaveBeenCalledTimes(1);
    expect(sendMutate.mock.calls[0]![0]).toEqual({
      contactIds: ['c1'],
      channels: ['email'],
      note: 'Mostly the August checks.',
      confirmEmpty: undefined,
    });
  });

  it('offers texting only when the firm can send texts, and says why not', async () => {
    await openModal();
    const sms = screen.getByLabelText(/text message/i) as HTMLInputElement;
    expect(sms.disabled).toBe(true);
    expect(screen.getByText(/switched off for this firm/i)).toBeTruthy();
  });

  it('includes sms when it is available and chosen', async () => {
    recipientsView = { ...baseView, smsAvailable: true, smsUnavailableReason: null };
    await openModal();
    fireEvent.click(screen.getByLabelText(/text message/i));
    fireEvent.click(screen.getByRole('button', { name: /send request/i }));
    expect(sendMutate.mock.calls[0]![0].channels).toEqual(['email', 'sms']);
  });

  it('holds the button until staff confirm an empty portal queue', async () => {
    recipientsView = { ...baseView, queueCount: 0 };
    await openModal();
    const button = screen.getByRole('button', { name: /send request/i }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(screen.getByText(/would\s+log in and find nothing/i)).toBeTruthy();
    fireEvent.click(screen.getByLabelText(/send anyway/i));
    expect(button.disabled).toBe(false);
    fireEvent.click(button);
    expect(sendMutate.mock.calls[0]![0].confirmEmpty).toBe(true);
  });

  it('explains when nobody is allowed to suggest categories', async () => {
    recipientsView = { ...baseView, contacts: [] };
    await openModal();
    expect(screen.getByText(/can suggest categories/i)).toBeTruthy();
    expect((screen.getByRole('button', { name: /send request/i }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('explains when the portal flag is off', async () => {
    recipientsView = { ...baseView, portalEnabled: false };
    await openModal();
    expect(screen.getByText(/PORTAL_CATEGORIZE_V1/)).toBeTruthy();
    expect((screen.getByRole('button', { name: /send request/i }) as HTMLButtonElement).disabled).toBe(true);
  });
});
