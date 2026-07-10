// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { describe, it, expect, vi } from 'vitest';
import { renderRoute, expectPageRendered } from '../../test-utils';

vi.mock('../../api/client', async () => {
  const actual = await vi.importActual<typeof import('../../api/client')>('../../api/client');
  return { ...actual, apiClient: vi.fn().mockResolvedValue({ data: [], total: 0 }) };
});

import { AttachmentLibraryPage } from './AttachmentLibraryPage';

describe('attachments pages', () => {
  it('AttachmentLibraryPage renders', () => {
    renderRoute(<AttachmentLibraryPage />);
    expectPageRendered();
  });
});
