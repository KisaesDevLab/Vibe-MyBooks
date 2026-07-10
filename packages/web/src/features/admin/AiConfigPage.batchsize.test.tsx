// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderRoute } from '../../test-utils';
import { authMocks, companyMocks, aiMocks, tailscaleMocks } from '../../test-mocks';

const hoisted = vi.hoisted(() => ({ mutate: vi.fn() }));

// A minimally-complete AI config so AiConfigPage's data useEffect populates
// the form, with an existing batchSize override on the Categorization task.
const AI_CONFIG = {
  isEnabled: true,
  categorizationProvider: 'ollama', categorizationModel: '',
  ocrProvider: '', ocrModel: '',
  ollamaBaseUrl: '', openaiCompatBaseUrl: '', openaiCompatModel: '', openaiCompatMode: 'auto',
  glmOcrEnabled: false, glmOcrBaseUrl: '', glmOcrModel: '', glmOcrPrompt: '',
  glmOcrTimeoutMs: null, glmOcrConcurrency: null, glmOcrForceOcr: false, glmOcrRenderDpi: null,
  statementExtractionProvider: 'local', statementExtractionModel: '',
  autoCategorizeOnImport: true, autoOcrOnUpload: true,
  categorizationConfidenceThreshold: 0.7, maxConcurrentJobs: 5, monthlyBudgetLimit: null,
  piiProtectionLevel: 'strict', cloudVisionEnabled: false,
  fallbackChain: ['ollama'],
  taskOptions: { categorization: { batchSize: 15 } },
};

vi.mock('../../api/hooks/useAuth', () => authMocks());
vi.mock('../../api/hooks/useCompany', () => companyMocks());
vi.mock('../../api/hooks/useTailscale', () => tailscaleMocks());
vi.mock('../../api/hooks/useAi', () => ({
  ...aiMocks(),
  useAiConfig: () => ({ data: AI_CONFIG, isLoading: false, isError: false, error: null, refetch: vi.fn(), isFetching: false }),
  useUpdateAiConfig: () => ({
    mutate: hoisted.mutate, mutateAsync: vi.fn(() => Promise.resolve()),
    isPending: false, isError: false, isSuccess: false, error: null, data: undefined, reset: vi.fn(),
  }),
}));
vi.mock('../../api/client', async () => {
  const actual = await vi.importActual<typeof import('../../api/client')>('../../api/client');
  return {
    ...actual,
    apiClient: vi.fn().mockResolvedValue({ models: [], config: {}, data: [], total: 0 }),
  };
});

beforeEach(() => {
  hoisted.mutate.mockReset();
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true, status: 200, json: async () => ({ models: [], config: {} }),
  } as Partial<Response>));
});

import { AiConfigPage } from './AiConfigPage';

describe('AiConfigPage — categorization batch size', () => {
  function expandCategorizationCard() {
    // The function label appears in a few spots (help text, task-assignment
    // label). The collapsible Task Settings card header is the one rendered
    // inside a <button> — click it to expand the card.
    const header = screen
      .getAllByText('Transaction Categorization & Name Cleanup')
      .find((el) => el.closest('button'));
    fireEvent.click(header!.closest('button')!);
  }

  it('renders the batch-size input for Categorization showing the current value', () => {
    renderRoute(<AiConfigPage />, { route: '/admin/ai', path: '/admin/ai' });
    expandCategorizationCard();

    const input = screen.getByPlaceholderText('Default 15') as HTMLInputElement;
    expect(input).toBeInTheDocument();
    expect(input.value).toBe('15');
    // The shared-model help text is shown so admins know one model covers both.
    expect(screen.getAllByText(/single AI call, so one model covers both/i).length).toBeGreaterThan(0);
  });

  it('saves an edited batch size through the taskOptions PATCH path', () => {
    renderRoute(<AiConfigPage />, { route: '/admin/ai', path: '/admin/ai' });
    expandCategorizationCard();

    const input = screen.getByPlaceholderText('Default 15');
    fireEvent.change(input, { target: { value: '20' } });

    fireEvent.click(screen.getByRole('button', { name: /Save Configuration/i }));

    expect(hoisted.mutate).toHaveBeenCalledTimes(1);
    const payload = hoisted.mutate.mock.calls[0]![0] as { taskOptions?: { categorization?: { batchSize?: number } } };
    expect(payload.taskOptions?.categorization?.batchSize).toBe(20);
  });
});
