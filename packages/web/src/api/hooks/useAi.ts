import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';

export function useAiConfig() {
  return useQuery({
    queryKey: ['ai', 'config'],
    queryFn: () => apiClient<any>('/ai/admin/config'),
  });
}

/**
 * Feature-availability hook for AI features, safe for ALL authenticated
 * users (unlike useAiConfig which hits the super-admin-only endpoint).
 *
 * Returns booleans for each AI feature so pages can decide whether to
 * render the associated UI (bill OCR drop zone, receipt camera, etc.)
 * without needing to know about API keys or provider configuration.
 */
export interface AiStatus {
  isEnabled: boolean;
  hasBillOcr: boolean;
  hasReceiptOcr: boolean;
  hasCategorization: boolean;
  hasStatementParser: boolean;
  hasDocumentClassifier: boolean;
}

export function useAiStatus() {
  return useQuery({
    queryKey: ['ai', 'status'],
    queryFn: () => apiClient<AiStatus>('/ai/status'),
    // Status rarely changes during a session, so a longer stale time
    // avoids hammering the endpoint on every page navigation.
    staleTime: 60_000,
  });
}

export function useUpdateAiConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: any) => apiClient('/ai/admin/config', { method: 'PUT', body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ai'] }),
  });
}

export function useTestAiProvider() {
  return useMutation({
    mutationFn: (provider: string) => apiClient<any>(`/ai/admin/test/${provider}`, { method: 'POST' }),
  });
}

export function useAiCategorize() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (feedItemId: string) => apiClient('/ai/categorize', { method: 'POST', body: JSON.stringify({ feedItemId }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bank-feed'] }),
  });
}

export function useAiBatchCategorize() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (feedItemIds: string[]) => apiClient('/ai/categorize/batch', { method: 'POST', body: JSON.stringify({ feedItemIds }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bank-feed'] }),
  });
}

export function useAiOcrReceipt() {
  return useMutation({
    mutationFn: (attachmentId: string) => apiClient('/ai/ocr/receipt', { method: 'POST', body: JSON.stringify({ attachmentId }) }),
  });
}

export function useAiParseStatement() {
  return useMutation({
    mutationFn: (attachmentId: string) => apiClient('/ai/parse/statement', { method: 'POST', body: JSON.stringify({ attachmentId }) }),
  });
}

export function useAiClassify() {
  return useMutation({
    mutationFn: (attachmentId: string) => apiClient('/ai/classify', { method: 'POST', body: JSON.stringify({ attachmentId }) }),
  });
}

export function useAiUsage(months?: number) {
  return useQuery({
    queryKey: ['ai', 'usage', months],
    queryFn: () => apiClient<any>(`/ai/usage?months=${months || 1}`),
  });
}

export function useAiPrompts() {
  return useQuery({
    queryKey: ['ai', 'prompts'],
    queryFn: () => apiClient<any>('/ai/admin/prompts'),
  });
}
