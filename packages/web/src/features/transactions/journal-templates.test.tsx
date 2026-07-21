// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderRoute } from '../../test-utils';
import { accountsMocks, transactionsMocks } from '../../test-mocks';

const createMutateAsync = vi.fn().mockResolvedValue({ template: { id: 'tpl-1', name: 'Payroll accrual', lines: [] } });
const saveLinesMutateAsync = vi.fn().mockResolvedValue({});
const updateMutateAsync = vi.fn().mockResolvedValue({ template: { id: 'tpl-1' } });
const templateStore: { data: unknown } = { data: undefined };

vi.mock('../../api/hooks/useJeTemplates', () => ({
  useJeTemplates: () => ({
    data: { templates: [{ id: 'tpl-1', name: 'Payroll accrual', memo: null, defaultTagId: null, isActive: true }] },
    isLoading: false,
  }),
  useJeTemplate: () => ({ data: templateStore.data, isLoading: false }),
  useCreateJeTemplate: () => ({ mutateAsync: createMutateAsync, isPending: false }),
  useUpdateJeTemplate: () => ({ mutateAsync: updateMutateAsync, isPending: false }),
  useDeleteJeTemplate: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useReplaceJeTemplateLines: () => ({ mutateAsync: saveLinesMutateAsync, isPending: false }),
}));
vi.mock('../../api/hooks/useAccounts', () => accountsMocks());
const createTxnMutate = vi.fn((_p: unknown, opts?: { onSuccess?: (r: unknown) => void }) =>
  opts?.onSuccess?.({ transaction: { id: 'txn-1' } }),
);
vi.mock('../../api/hooks/useTransactions', () => ({
  ...transactionsMocks(),
  useCreateTransaction: () => ({ mutate: createTxnMutate, isPending: false }),
}));

import { JournalTemplatesPage } from './JournalTemplatesPage';
import { JournalTemplateEntryPage } from './JournalTemplateEntryPage';

beforeEach(() => {
  createMutateAsync.mockClear();
  saveLinesMutateAsync.mockClear();
  updateMutateAsync.mockClear();
  createTxnMutate.mockClear();
  templateStore.data = undefined;
});

const PAYROLL_TEMPLATE = {
  template: {
    id: 'tpl-1', name: 'Payroll accrual', memo: 'Monthly payroll accrual', defaultTagId: null, isActive: true,
    lines: [
      { id: 'l1', templateId: 'tpl-1', label: 'Gross wages', accountId: 'acct-exp', normalSide: 'debit', sortOrder: 0, isRequired: true, isActive: true },
      { id: 'l2', templateId: 'tpl-1', label: 'Employer taxes', accountId: 'acct-exp2', normalSide: 'debit', sortOrder: 1, isRequired: false, isActive: true },
      { id: 'l3', templateId: 'tpl-1', label: 'Accrued payroll', accountId: 'acct-liab', normalSide: 'credit', sortOrder: 2, isRequired: true, isActive: true },
    ],
  },
};

describe('JournalTemplatesPage', () => {
  it('lists templates and shows the empty builder prompt', () => {
    renderRoute(<JournalTemplatesPage />);
    expect(screen.getByRole('heading', { name: 'Journal Entry Templates' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Payroll accrual' })).toBeInTheDocument();
    expect(screen.getByText(/Select a template to edit/)).toBeInTheDocument();
  });

  it('creates a template from the New template panel', async () => {
    renderRoute(<JournalTemplatesPage />);
    fireEvent.click(screen.getByRole('button', { name: /new template/i }));
    fireEvent.change(screen.getByLabelText('Template name'), { target: { value: 'Depreciation' } });
    fireEvent.click(screen.getByRole('button', { name: /^create$/i }));
    await waitFor(() => expect(createMutateAsync).toHaveBeenCalledWith({ name: 'Depreciation' }));
  });

  it('opens the builder with the template lines (label, account, side, required)', async () => {
    templateStore.data = {
      template: {
        id: 'tpl-1', name: 'Payroll accrual', memo: null, defaultTagId: null, isActive: true,
        lines: [
          { id: 'l1', templateId: 'tpl-1', label: 'Gross wages', accountId: null, normalSide: 'debit', sortOrder: 0, isRequired: true, isActive: true },
          { id: 'l2', templateId: 'tpl-1', label: 'Accrued payroll', accountId: null, normalSide: 'credit', sortOrder: 1, isRequired: true, isActive: true },
        ],
      },
    };
    renderRoute(<JournalTemplatesPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Payroll accrual' }));
    await waitFor(() => expect(screen.getByDisplayValue('Gross wages')).toBeInTheDocument());
    expect(screen.getByDisplayValue('Accrued payroll')).toBeInTheDocument();
    expect(screen.getByLabelText('Side for Gross wages')).toHaveValue('debit');
    expect(screen.getByLabelText('Side for Accrued payroll')).toHaveValue('credit');
    expect(screen.getByRole('button', { name: /use template/i })).toBeInTheDocument();

    // Saving sends the lines back with required flags intact.
    fireEvent.click(screen.getByRole('button', { name: /save template/i }));
    await waitFor(() => expect(saveLinesMutateAsync).toHaveBeenCalledTimes(1));
    const sent = saveLinesMutateAsync.mock.calls[0]![0] as { id: string; lines: Array<{ label: string; isRequired: boolean; normalSide: string }> };
    expect(sent.id).toBe('tpl-1');
    expect(sent.lines.map((l) => l.label)).toEqual(['Gross wages', 'Accrued payroll']);
    expect(sent.lines.every((l) => l.isRequired)).toBe(true);
  });

  it('shows the default memo from the template and persists edits on save', async () => {
    templateStore.data = PAYROLL_TEMPLATE; // memo: 'Monthly payroll accrual'
    renderRoute(<JournalTemplatesPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Payroll accrual' }));

    // The Default memo field is seeded from the template.
    const memoInput = await screen.findByLabelText('Default memo');
    expect(memoInput).toHaveValue('Monthly payroll accrual');

    // Editing + saving persists the memo via the template update endpoint.
    fireEvent.change(memoInput, { target: { value: 'Depreciation — building' } });
    fireEvent.click(screen.getByRole('button', { name: /save template/i }));
    await waitFor(() => expect(updateMutateAsync).toHaveBeenCalledWith({ id: 'tpl-1', memo: 'Depreciation — building' }));
  });

  it('sends memo:null when the default memo is cleared', async () => {
    templateStore.data = PAYROLL_TEMPLATE;
    renderRoute(<JournalTemplatesPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Payroll accrual' }));
    const memoInput = await screen.findByLabelText('Default memo');
    fireEvent.change(memoInput, { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: /save template/i }));
    await waitFor(() => expect(updateMutateAsync).toHaveBeenCalledWith({ id: 'tpl-1', memo: null }));
  });

  it('drag-and-drop reorders the lines and the new order persists on save', async () => {
    templateStore.data = {
      template: {
        id: 'tpl-1', name: 'Payroll accrual', memo: null, defaultTagId: null, isActive: true,
        lines: [
          { id: 'l1', templateId: 'tpl-1', label: 'Gross wages', accountId: null, normalSide: 'debit', sortOrder: 0, isRequired: false, isActive: true },
          { id: 'l2', templateId: 'tpl-1', label: 'Accrued payroll', accountId: null, normalSide: 'credit', sortOrder: 1, isRequired: false, isActive: true },
        ],
      },
    };
    renderRoute(<JournalTemplatesPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Payroll accrual' }));
    await screen.findByDisplayValue('Gross wages');

    // Drag row 1's grip over row 2 → order flips.
    const grip = screen.getByLabelText('Reorder Gross wages');
    fireEvent.dragStart(grip, { dataTransfer: { setData: () => {}, effectAllowed: 'move' } });
    fireEvent.dragOver(screen.getByDisplayValue('Accrued payroll').closest('[class*="px-4 py-3"]')!);
    fireEvent.dragEnd(grip);

    fireEvent.click(screen.getByRole('button', { name: /save template/i }));
    await waitFor(() => expect(saveLinesMutateAsync).toHaveBeenCalledTimes(1));
    const sent = saveLinesMutateAsync.mock.calls[0]![0] as { lines: Array<{ label: string; sortOrder: number }> };
    expect(sent.lines.map((l) => l.label)).toEqual(['Accrued payroll', 'Gross wages']);
    expect(sent.lines.map((l) => l.sortOrder)).toEqual([0, 1]);
  });
});

describe('JournalTemplateEntryPage', () => {
  it('groups lines into Debit/Credit sections with side notation', async () => {
    templateStore.data = PAYROLL_TEMPLATE;
    renderRoute(<JournalTemplateEntryPage />, { route: '/transactions/journal-templates/enter?template=tpl-1' });
    await screen.findByText('Debit lines');
    expect(screen.getByText('Credit lines')).toBeInTheDocument();
    // Section chips + one chip per line: 2 sections + 3 lines.
    expect(screen.getAllByText('Dr')).toHaveLength(3); // section header + 2 debit lines
    expect(screen.getAllByText('Cr')).toHaveLength(2); // section header + 1 credit line
    // Required lines are starred; memo seeded from the template.
    expect(screen.getByText(/Gross wages \*/)).toBeInTheDocument();
    expect(screen.getByDisplayValue('Monthly payroll accrual')).toBeInTheDocument();
  });

  it('blocks posting until balanced and required amounts are present, then posts a JE', async () => {
    templateStore.data = PAYROLL_TEMPLATE;
    renderRoute(<JournalTemplateEntryPage />, { route: '/transactions/journal-templates/enter?template=tpl-1' });
    await screen.findByText('Debit lines');

    const post = screen.getByRole('button', { name: /post journal entry/i });
    expect(post).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/Gross wages/), { target: { value: '1000' } });
    fireEvent.change(screen.getByLabelText(/Accrued payroll/), { target: { value: '1000' } });
    await waitFor(() => expect(post).not.toBeDisabled());

    fireEvent.click(post);
    await waitFor(() => expect(createTxnMutate).toHaveBeenCalledTimes(1));
    const payload = createTxnMutate.mock.calls[0]![0] as {
      txnType: string;
      lines: Array<{ accountId: string; debit: string; credit: string; description: string }>;
    };
    expect(payload.txnType).toBe('journal_entry');
    expect(payload.lines).toHaveLength(2);
    expect(payload.lines[0]).toMatchObject({ accountId: 'acct-exp', debit: '1000.0000', credit: '0', description: 'Gross wages' });
    expect(payload.lines[1]).toMatchObject({ accountId: 'acct-liab', debit: '0', credit: '1000.0000', description: 'Accrued payroll' });
  });
});
