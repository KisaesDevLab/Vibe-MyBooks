import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';

export function useAiConfig() {
  return useQuery({
    queryKey: ['ai', 'config'],
    queryFn: () => apiClient<any>('/ai/admin/config'),
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
