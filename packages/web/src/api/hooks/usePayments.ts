import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ReceivePaymentInput, PendingDepositItem, Transaction } from '@kis-books/shared';
import { apiClient } from '../client';

export function useReceivePayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ReceivePaymentInput) =>
      apiClient<{ transaction: Transaction }>('/payments/receive', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['pending-deposits'] });
    },
  });
}

export interface OpenInvoice {
  id: string;
  invoiceNumber: string;
  txnDate: string;
  dueDate: string | null;
  total: string;
  amountPaid: string;
  balanceDue: string;
}

export function useOpenInvoices(customerId: string) {
  return useQuery({
    queryKey: ['payments', 'open-invoices', customerId],
    queryFn: () => apiClient<{ invoices: OpenInvoice[] }>(`/payments/open-invoices/${customerId}`),
    enabled: !!customerId,
  });
}

export function usePaymentsForInvoice(invoiceId: string) {
  return useQuery({
    queryKey: ['payments', 'for-invoice', invoiceId],
    queryFn: () => apiClient<{ payments: Transaction[] }>(`/payments/for-invoice/${invoiceId}`),
    enabled: !!invoiceId,
  });
}

export function usePendingDeposits() {
  return useQuery({
    queryKey: ['pending-deposits'],
    queryFn: () => apiClient<{ paymentsClearingBalance: number; items: PendingDepositItem[] }>('/payments/pending-deposits'),
  });
}
