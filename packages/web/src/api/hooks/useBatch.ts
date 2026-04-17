// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';

interface BatchRow {
  rowNumber: number;
  date?: string;
  refNo?: string;
  contactName?: string;
  accountName?: string;
  memo?: string;
  amount?: number;
  debit?: number;
  credit?: number;
  description?: string;
  dueDate?: string;
  invoiceNo?: string;
}

interface ValidationResult {
  validCount: number;
  invalidCount: number;
  rows: Array<{
    rowNumber: number;
    status: 'valid' | 'invalid' | 'warning';
    resolvedContactId: string | null;
    resolvedAccountId: string | null;
    errors: Array<{ field: string; message: string }>;
    newContact?: { displayName: string; contactType: string };
  }>;
}

interface SaveResult {
  savedCount: number;
  skippedCount: number;
  createdContacts: Array<{ displayName: string; id: string }>;
  transactions: Array<{ id: string; txnNumber: string | null; rowNumber: number }>;
}

export function useValidateBatch() {
  return useMutation({
    mutationFn: (input: { txn_type: string; context_account_id: string | null; rows: BatchRow[] }) =>
      apiClient<ValidationResult>('/batch/validate', { method: 'POST', body: JSON.stringify(input) }),
  });
}

export function useSaveBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { txn_type: string; context_account_id: string | null; rows: BatchRow[]; auto_create_contacts?: boolean; skip_invalid?: boolean }) =>
      apiClient<SaveResult>('/batch/save', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['accounts'] });
      qc.invalidateQueries({ queryKey: ['register'] });
    },
  });
}

export function useParseCsv() {
  return useMutation({
    mutationFn: async (input: { file: File; txnType: string }) => {
      const formData = new FormData();
      formData.append('file', input.file);
      formData.append('txn_type', input.txnType);
      const res = await fetch('/api/v1/batch/parse-csv', {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` },
        body: formData,
      });
      if (!res.ok) throw new Error('Parse failed');
      return res.json() as Promise<{ rows: BatchRow[]; count: number }>;
    },
  });
}
