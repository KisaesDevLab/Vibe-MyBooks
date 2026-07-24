// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';

export interface InvoiceTemplate {
  id: string;
  name: string;
  logoUrl: string | null;
  accentColor: string | null;
  showShipTo: boolean;
  showPoNumber: boolean;
  showTerms: boolean;
  footerText: string | null;
  isDefault: boolean;
}

export type UpdateInvoiceTemplateInput = Partial<
  Pick<
    InvoiceTemplate,
    'name' | 'logoUrl' | 'accentColor' | 'showShipTo' | 'showPoNumber' | 'showTerms' | 'footerText'
  >
>;

export function useInvoiceTemplate() {
  return useQuery({
    queryKey: ['invoice-template'],
    queryFn: () => apiClient<{ template: InvoiceTemplate | null }>('/company/invoice-template'),
  });
}

export function useUpdateInvoiceTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateInvoiceTemplateInput) =>
      apiClient<{ template: InvoiceTemplate }>('/company/invoice-template', {
        method: 'PUT',
        body: JSON.stringify(input),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['invoice-template'] }),
  });
}
