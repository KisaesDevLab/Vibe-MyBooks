// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderRoute } from '../../test-utils';
import { accountsMocks } from '../../test-mocks';

const createMutateAsync = vi.fn().mockResolvedValue({ template: { id: 'tpl-1', name: 'Payroll accrual', lines: [] } });
const saveLinesMutateAsync = vi.fn().mockResolvedValue({});
const templateStore: { data: unknown } = { data: undefined };

vi.mock('../../api/hooks/useJeTemplates', () => ({
  useJeTemplates: () => ({
    data: { templates: [{ id: 'tpl-1', name: 'Payroll accrual', memo: null, defaultTagId: null, isActive: true }] },
    isLoading: false,
  }),
  useJeTemplate: () => ({ data: templateStore.data, isLoading: false }),
  useCreateJeTemplate: () => ({ mutateAsync: createMutateAsync, isPending: false }),
  useUpdateJeTemplate: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteJeTemplate: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useReplaceJeTemplateLines: () => ({ mutateAsync: saveLinesMutateAsync, isPending: false }),
}));
vi.mock('../../api/hooks/useAccounts', () => accountsMocks());

import { JournalTemplatesPage } from './JournalTemplatesPage';

beforeEach(() => {
  createMutateAsync.mockClear();
  saveLinesMutateAsync.mockClear();
  templateStore.data = undefined;
});

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
});
