// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { describe, it, expect, vi } from 'vitest';
import { renderRoute, expectPageRendered } from '../../test-utils';
import { authMocks } from '../../test-mocks';

vi.mock('../../api/hooks/useAuth', () => authMocks());
vi.mock('../../api/client', async () => {
  const actual = await vi.importActual<typeof import('../../api/client')>('../../api/client');
  return { ...actual, apiClient: vi.fn().mockResolvedValue({ articles: [] }) };
});

import { KnowledgeBasePage } from './KnowledgeBasePage';
import { ArticlePage } from './ArticlePage';

describe('help pages', () => {
  it('KnowledgeBasePage renders', () => {
    renderRoute(<KnowledgeBasePage />);
    expectPageRendered();
  });

  it('ArticlePage renders with an id', () => {
    renderRoute(<ArticlePage />, { route: '/help/test', path: '/help/:id' });
    expectPageRendered();
  });
});
