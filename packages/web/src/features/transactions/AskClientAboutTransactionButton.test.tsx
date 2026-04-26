// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderRoute } from '../../test-utils';

const askMock = vi.fn();
const mutateState: { isPending: boolean } = { isPending: false };
const companyState: { activeCompanyId: string | null } = { activeCompanyId: 'company-1' };

vi.mock('../../providers/CompanyProvider', () => ({
  useCompanyContext: () => ({
    activeCompanyId: companyState.activeCompanyId,
    activeCompanyName: 'Test Co',
    companies: [],
  }),
}));

vi.mock('../../api/hooks/usePortalQuestions', () => ({
  useCreateQuestion: () => ({ mutate: askMock, isPending: mutateState.isPending }),
}));

import { AskClientAboutTransactionButton } from './AskClientAboutTransactionButton';

beforeEach(() => {
  askMock.mockReset();
  mutateState.isPending = false;
  companyState.activeCompanyId = 'company-1';
});

describe('AskClientAboutTransactionButton', () => {
  it('opens the modal with a context summary when clicked', () => {
    renderRoute(
      <AskClientAboutTransactionButton
        transactionId="txn-1"
        contextSummary="Expense · 2026-04-15 · Acme · $50"
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Ask Client/ }));
    expect(screen.getByRole('dialog', { name: /Ask the client/i })).toBeInTheDocument();
    expect(screen.getByText(/Acme/)).toBeInTheDocument();
  });

  it('blocks empty submissions and shows an error', () => {
    renderRoute(<AskClientAboutTransactionButton transactionId="txn-1" />);
    fireEvent.click(screen.getByRole('button', { name: /Ask Client/ }));
    fireEvent.click(screen.getByRole('button', { name: /Send/ }));
    expect(screen.getByText(/Type a question/)).toBeInTheDocument();
    expect(askMock).not.toHaveBeenCalled();
  });

  it('passes companyId + transactionId + body to useCreateQuestion on send', async () => {
    askMock.mockImplementation(
      (_input: { body: string; transactionId?: string; companyId: string }, opts?: { onSuccess?: (r: { id: string }) => void }) => {
        opts?.onSuccess?.({ id: 'question-id-99' });
      },
    );
    renderRoute(<AskClientAboutTransactionButton transactionId="txn-1" />);
    fireEvent.click(screen.getByRole('button', { name: /Ask Client/ }));
    fireEvent.change(screen.getByPlaceholderText(/Could you confirm/), {
      target: { value: 'What was this transaction for?' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Send/ }));
    await waitFor(() => {
      expect(screen.getByText(/Question sent/)).toBeInTheDocument();
    });
    expect(askMock).toHaveBeenCalledTimes(1);
    expect(askMock.mock.calls[0]?.[0]).toEqual({
      companyId: 'company-1',
      body: 'What was this transaction for?',
      transactionId: 'txn-1',
    });
  });

  it('disables the button when no active company is selected', () => {
    companyState.activeCompanyId = null;
    renderRoute(<AskClientAboutTransactionButton transactionId="txn-1" />);
    const btn = screen.getByRole('button', { name: /Ask Client/ });
    expect(btn).toBeDisabled();
  });
});
