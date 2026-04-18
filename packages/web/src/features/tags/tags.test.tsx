// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderRoute } from '../../test-utils';

const useTagsMock = vi.fn();
const useTagGroupsMock = vi.fn();
const noopMutation = { mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false };

vi.mock('../../api/hooks/useTags', () => ({
  useTags: (...a: unknown[]) => useTagsMock(...a),
  useTagGroups: (...a: unknown[]) => useTagGroupsMock(...a),
  useCreateTag: () => noopMutation,
  useUpdateTag: () => noopMutation,
  useDeleteTag: () => noopMutation,
  useMergeTags: () => noopMutation,
  useCreateTagGroup: () => noopMutation,
  useDeleteTagGroup: () => noopMutation,
}));

import { TagManagerPage } from './TagManagerPage';

describe('tags pages', () => {
  it('TagManagerPage shows a loading state while tags are loading', () => {
    useTagsMock.mockReturnValue({ data: undefined, isLoading: true });
    useTagGroupsMock.mockReturnValue({ data: undefined, isLoading: true });
    renderRoute(<TagManagerPage />);
    expect(screen.getByRole('status', { name: /loading/i })).toBeInTheDocument();
  });

  it('TagManagerPage renders once tags resolve', () => {
    useTagsMock.mockReturnValue({ data: { tags: [] }, isLoading: false });
    useTagGroupsMock.mockReturnValue({ data: { groups: [] }, isLoading: false });
    renderRoute(<TagManagerPage />);
    // The page's New Tag / New Group buttons are always rendered.
    expect(screen.getByRole('button', { name: /new tag/i })).toBeInTheDocument();
  });
});
