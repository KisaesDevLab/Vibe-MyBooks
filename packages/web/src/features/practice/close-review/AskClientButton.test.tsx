// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderRoute } from '../../../test-utils';

const askMock = vi.fn();
const mutateMockState: { isPending: boolean; lastImpl?: typeof askMock } = { isPending: false };

vi.mock('../../../api/hooks/useClassificationState', () => ({
  useAskClient: () => ({ mutate: askMock, isPending: mutateMockState.isPending }),
}));

import { AskClientButton } from './AskClientButton';

beforeEach(() => {
  askMock.mockReset();
  mutateMockState.isPending = false;
});

describe('AskClientButton', () => {
  it('opens a modal when the button is pressed', () => {
    renderRoute(<AskClientButton stateId="state-1" description="Acme Coffee" />);
    fireEvent.click(screen.getByRole('button', { name: /Ask Client/ }));
    expect(screen.getByRole('dialog', { name: /Ask the client/ })).toBeInTheDocument();
    expect(screen.getByText(/Acme Coffee/)).toBeInTheDocument();
  });

  it('blocks empty submissions and shows an error', () => {
    renderRoute(<AskClientButton stateId="state-1" />);
    fireEvent.click(screen.getByRole('button', { name: /Ask Client/ }));
    fireEvent.click(screen.getByRole('button', { name: /Send/ }));
    expect(screen.getByText(/Type a question/)).toBeInTheDocument();
    expect(askMock).not.toHaveBeenCalled();
  });

  it('calls useAskClient mutate with the typed body', async () => {
    askMock.mockImplementation((_input: { body: string }, opts?: { onSuccess?: (r: { questionId: string }) => void }) => {
      opts?.onSuccess?.({ questionId: 'q-123' });
    });
    renderRoute(<AskClientButton stateId="state-1" />);
    fireEvent.click(screen.getByRole('button', { name: /Ask Client/ }));
    fireEvent.change(screen.getByPlaceholderText(/Could you confirm/), {
      target: { value: 'Was this for the office party?' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Send/ }));
    await waitFor(() => {
      expect(screen.getByText(/Question sent/)).toBeInTheDocument();
    });
    expect(askMock).toHaveBeenCalledTimes(1);
    expect(askMock.mock.calls[0]?.[0]).toMatchObject({
      stateId: 'state-1',
      body: 'Was this for the office party?',
    });
  });
});
