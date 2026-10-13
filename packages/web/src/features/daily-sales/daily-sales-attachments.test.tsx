// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Daily Sales attachments: files attached on a new entry ride the draft id
// into the created entry; a saved draft shows the entry's own files; a
// posted entry shows its journal entry's files; the list shows a count.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderRoute } from '../../test-utils';

const TEMPLATE = {
  id: 't1', name: 'Bar', defaultTagId: null, isActive: true,
  lines: [
    { id: 'l1', templateId: 't1', section: 'sales', label: 'Food sales', accountId: 'acct-sales', normalSide: 'credit', sortOrder: 0, isActive: true, tagId: null },
    { id: 'l2', templateId: 't1', section: 'payment', label: 'Cash', accountId: 'acct-cash', normalSide: 'debit', sortOrder: 1, isActive: true, tagId: null },
  ],
};

const createDraft = vi.fn().mockResolvedValue({ entry: { id: 'entry-new' } });
const updateDraft = vi.fn().mockResolvedValue({ entry: { id: 'entry-1' } });
const postEntry = vi.fn().mockResolvedValue({ entry: { id: 'entry-new', status: 'posted' } });
const entryStore: { data: unknown } = { data: undefined };
const listEntries: unknown[] = [];

vi.mock('../../api/hooks/useDailySales', () => ({
  useDailySalesTemplates: () => ({ data: { templates: [{ id: 't1', name: 'Bar' }] } }),
  useDailySalesTemplate: (id?: string) => ({ data: id ? { template: TEMPLATE } : undefined }),
  useDailySalesEntry: (id?: string) => ({ data: id ? entryStore.data : undefined, isLoading: false }),
  useCreateDailySalesDraft: () => ({ mutateAsync: createDraft, isPending: false }),
  useUpdateDailySalesDraft: () => ({ mutateAsync: updateDraft, isPending: false }),
  usePostDailySalesEntry: () => ({ mutateAsync: postEntry, isPending: false }),
  useVoidDailySalesEntry: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDailySalesEntries: () => ({ data: { entries: listEntries, total: listEntries.length }, isLoading: false, isError: false, refetch: vi.fn() }),
}));
vi.mock('../../api/hooks/useTags', () => ({
  useTags: () => ({ data: { tags: [] } }),
}));
vi.mock('../../components/forms/SplitRowV2', () => ({
  LineTagPicker: () => <div data-testid="tag-picker" />,
}));
// AttachmentPanel has its own tests; render where it points.
vi.mock('../attachments/AttachmentPanel', () => ({
  AttachmentPanel: ({ attachableType, attachableId }: { attachableType: string; attachableId: string }) => (
    <div data-testid="attachments" data-type={attachableType} data-id={attachableId} />
  ),
}));

import { DailySalesEntryPage } from './DailySalesEntryPage';
import { DailySalesEntriesPage } from './DailySalesEntriesPage';

function savedEntry(status: 'draft' | 'posted' | 'void', transactionId: string | null) {
  return {
    entry: {
      id: 'entry-1', templateId: 't1', templateName: 'Bar', businessDate: '2026-10-01', status, transactionId,
      overShortAmount: '0', totalSales: '100', totalTax: '0', totalPayments: '100', postedAt: null, createdAt: null,
      tagId: null, notes: null,
      values: [{ templateLineId: 'l1', amount: '100.0000', tagId: null }, { templateLineId: 'l2', amount: '100.0000', tagId: null }],
      template: TEMPLATE,
    },
  };
}

beforeEach(() => {
  createDraft.mockClear();
  updateDraft.mockClear();
  postEntry.mockClear();
  entryStore.data = undefined;
  listEntries.length = 0;
  sessionStorage.clear();
});

describe('DailySalesEntryPage — attachments', () => {
  it('new entry: files attach as a draft and the draft id goes with the created entry, then posts', async () => {
    renderRoute(<DailySalesEntryPage />, { route: '/daily-sales/new', path: '/daily-sales/new' });
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 't1' } });
    const panel = await screen.findByTestId('attachments');
    expect(panel.dataset['type']).toBe('draft');
    const draftId = panel.dataset['id']!;
    expect(draftId).toMatch(/^[0-9a-f-]{36}$/);

    fireEvent.change(screen.getByLabelText(/Food sales/), { target: { value: '100' } });
    fireEvent.change(screen.getByLabelText(/^Cash/), { target: { value: '100' } });
    fireEvent.click(screen.getByRole('button', { name: /post entry/i }));

    await waitFor(() => expect(postEntry).toHaveBeenCalledWith('entry-new'));
    expect(createDraft).toHaveBeenCalledTimes(1);
    expect(createDraft.mock.calls[0]![0]).toMatchObject({ templateId: 't1', draftAttachmentId: draftId });
  });

  it('a failed post after the draft was created continues on the saved draft', async () => {
    postEntry.mockRejectedValueOnce(new Error('Period is locked'));
    renderRoute(<DailySalesEntryPage />, { route: '/daily-sales/new', path: '/daily-sales/new' });
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 't1' } });
    await screen.findByTestId('attachments');
    fireEvent.change(screen.getByLabelText(/Food sales/), { target: { value: '100' } });
    fireEvent.click(screen.getByRole('button', { name: /post entry/i }));
    await waitFor(() => expect(postEntry).toHaveBeenCalledTimes(1));
    // Navigated off the /new route (the test route only matches /new).
    await waitFor(() => expect(screen.queryByTestId('attachments')).not.toBeInTheDocument());
  });

  it('saved draft: shows the entry\'s own attachments', async () => {
    entryStore.data = savedEntry('draft', null);
    renderRoute(<DailySalesEntryPage />, { route: '/daily-sales/entries/entry-1', path: '/daily-sales/entries/:id' });
    const panel = await screen.findByTestId('attachments');
    expect(panel.dataset['type']).toBe('daily_sales_entry');
    expect(panel.dataset['id']).toBe('entry-1');
  });

  it('posted entry: shows the journal entry\'s attachments', async () => {
    entryStore.data = savedEntry('posted', 'txn-9');
    renderRoute(<DailySalesEntryPage />, { route: '/daily-sales/entries/entry-1', path: '/daily-sales/entries/:id' });
    const panel = await screen.findByTestId('attachments');
    expect(panel.dataset['type']).toBe('daily_sales');
    expect(panel.dataset['id']).toBe('txn-9');
  });
});

describe('DailySalesEntriesPage — attachment count', () => {
  it('shows a paperclip count only on rows with files', () => {
    const base = { templateId: 't1', templateName: 'Bar', businessDate: '2026-10-01', transactionId: null,
      overShortAmount: '0', totalSales: '1', totalTax: '0', totalPayments: '1', postedAt: null, createdAt: null };
    listEntries.push({ ...base, id: 'a', status: 'posted', attachmentCount: 2 }, { ...base, id: 'b', status: 'draft', attachmentCount: 0 });
    renderRoute(<DailySalesEntriesPage />);
    expect(screen.getByTestId('attachments-a')).toHaveTextContent('2');
    expect(screen.queryByTestId('attachments-b')).not.toBeInTheDocument();
  });
});
