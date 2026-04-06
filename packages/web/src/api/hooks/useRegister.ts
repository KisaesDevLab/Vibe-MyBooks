import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../client';

export interface RegisterLine {
  lineId: string;
  transactionId: string;
  txnType: string;
  txnNumber: string | null;
  txnDate: string;
  payeeName: string | null;
  contactId: string | null;
  accountName: string | null;
  accountId: string | null;
  memo: string | null;
  payment: number | null;
  deposit: number | null;
  runningBalance: number;
  reconciliationStatus: 'cleared' | 'reconciled' | 'uncleared';
  hasAttachments: boolean;
  hasSplits: boolean;
  isEditable: boolean;
  status: string;
}

export interface RegisterData {
  account: { id: string; name: string; accountType: string; detailType: string | null; accountNumber: string | null };
  balanceForward: number;
  endingBalance: number;
  filtersApplied: Record<string, unknown>;
  pagination: { page: number; perPage: number; totalRows: number; totalPages: number };
  allowedEntryTypes: string[];
  lines: RegisterLine[];
}

export interface RegisterSummary {
  currentBalance: number;
  unclearedCount: number;
  lastReconciliationDate: string | null;
  transactionsThisPeriod: number;
}

export interface RegisterFilters {
  startDate?: string;
  endDate?: string;
  txnType?: string;
  payee?: string;
  search?: string;
  reconciled?: string;
  minAmount?: number;
  maxAmount?: number;
  includeVoid?: boolean;
  sortBy?: string;
  sortDir?: string;
  page?: number;
  perPage?: number;
}

export function useRegister(accountId: string, filters: RegisterFilters = {}) {
  const params = new URLSearchParams();
  if (filters.startDate) params.set('start_date', filters.startDate);
  if (filters.endDate) params.set('end_date', filters.endDate);
  if (filters.txnType) params.set('txn_type', filters.txnType);
  if (filters.search) params.set('search', filters.search);
  if (filters.reconciled) params.set('reconciled', filters.reconciled);
  if (filters.sortBy) params.set('sort_by', filters.sortBy);
  if (filters.sortDir) params.set('sort_dir', filters.sortDir);
  if (filters.page) params.set('page', String(filters.page));
  if (filters.perPage) params.set('per_page', String(filters.perPage));
  if (filters.includeVoid) params.set('include_void', 'true');

  const qs = params.toString();
  return useQuery({
    queryKey: ['register', accountId, filters],
    queryFn: () => apiClient<RegisterData>(`/accounts/${accountId}/register${qs ? `?${qs}` : ''}`),
    enabled: !!accountId,
  });
}

export function useRegisterSummary(accountId: string) {
  return useQuery({
    queryKey: ['register-summary', accountId],
    queryFn: () => apiClient<RegisterSummary>(`/accounts/${accountId}/register/summary`),
    enabled: !!accountId,
  });
}
