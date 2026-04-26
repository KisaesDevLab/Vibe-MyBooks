// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';

// VIBE_MYBOOKS_PRACTICE_BUILD_PLAN Phase 10 — bookkeeper-side
// Question hooks. /api/v1/practice/portal/questions/...

export interface QuestionListItem {
  id: string;
  companyId: string;
  companyName: string;
  body: string;
  status: 'open' | 'viewed' | 'responded' | 'resolved';
  transactionId: string | null;
  assignedContactId: string | null;
  contactEmail: string | null;
  createdAt: string;
  notifiedAt: string | null;
  respondedAt: string | null;
  closePeriod: string | null;
  messageCount: number;
}

export interface QuestionDetail {
  id: string;
  companyId: string;
  companyName: string;
  body: string;
  status: string;
  transactionId: string | null;
  splitLineId: string | null;
  assignedContactId: string | null;
  contactEmail: string | null;
  createdAt: string;
  notifiedAt: string | null;
  viewedAt: string | null;
  respondedAt: string | null;
  resolvedAt: string | null;
  closePeriod: string | null;
  messages: Array<{
    id: string;
    senderType: 'bookkeeper' | 'contact' | 'system';
    senderId: string;
    body: string;
    createdAt: string;
  }>;
}

export interface PendingBatch {
  contactId: string;
  email: string;
  firstName: string | null;
  questionIds: string[];
}

export interface CreateQuestionInput {
  companyId: string;
  body: string;
  transactionId?: string | null;
  splitLineId?: string | null;
  assignedContactId?: string | null;
}

export function useQuestionsList(opts?: {
  status?: string;
  companyId?: string;
  contactId?: string;
  transactionId?: string;
}) {
  const qs = new URLSearchParams();
  if (opts?.status) qs.set('status', opts.status);
  if (opts?.companyId) qs.set('companyId', opts.companyId);
  if (opts?.contactId) qs.set('contactId', opts.contactId);
  if (opts?.transactionId) qs.set('transactionId', opts.transactionId);
  const suffix = qs.toString() ? `?${qs}` : '';
  return useQuery({
    queryKey: ['practice', 'portal', 'questions', opts ?? {}],
    queryFn: () => apiClient<{ questions: QuestionListItem[] }>(`/practice/portal/questions${suffix}`),
  });
}

export function useQuestionDetail(id: string | undefined) {
  return useQuery({
    queryKey: ['practice', 'portal', 'questions', id],
    queryFn: () => apiClient<{ question: QuestionDetail }>(`/practice/portal/questions/${id}`),
    enabled: !!id,
  });
}

export function useCreateQuestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateQuestionInput) =>
      apiClient<{ id: string }>('/practice/portal/questions', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['practice', 'portal', 'questions'] }),
  });
}

export function useBookkeeperReply(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: string) =>
      apiClient<{ messageId: string }>(`/practice/portal/questions/${id}/replies`, {
        method: 'POST',
        body: JSON.stringify({ body }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['practice', 'portal', 'questions', id] });
      qc.invalidateQueries({ queryKey: ['practice', 'portal', 'questions'] });
    },
  });
}

export function useResolveQuestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiClient<{ ok: boolean }>(`/practice/portal/questions/${id}/resolve`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['practice', 'portal', 'questions'] }),
  });
}

export function usePendingBatches() {
  return useQuery({
    queryKey: ['practice', 'portal', 'questions', 'pending'],
    queryFn: () =>
      apiClient<{ batches: PendingBatch[] }>('/practice/portal/questions/pending-batches'),
  });
}

export function useMarkBatchNotified() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (questionIds: string[]) =>
      apiClient<{ ok: boolean }>('/practice/portal/questions/pending-batches/mark-notified', {
        method: 'POST',
        body: JSON.stringify({ questionIds }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['practice', 'portal', 'questions'] }),
  });
}
