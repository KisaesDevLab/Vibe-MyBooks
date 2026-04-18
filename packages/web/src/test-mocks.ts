// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

// Shared mock builders for render tests.
//
// Every page in the app reaches for 3–15 React Query hooks. Naming each
// export in every test's vi.mock factory is noisy and breaks whenever a
// new hook gets added to an existing module. This file exports helper
// factories that produce "passthrough" implementations for every hook
// name we have; tests import the factory map they need and pass it to
// vi.mock.
//
// Usage:
//   vi.mock('../../api/hooks/useBanking', () => bankingMocks());
//
// Individual tests can override a specific hook by merging:
//   vi.mock('../../api/hooks/useBanking', () => ({ ...bankingMocks(), useBankConnections: customFn }));

import { vi } from 'vitest';

export const emptyList = {
  data: { data: [], total: 0 },
  isLoading: false,
  isError: false,
  refetch: vi.fn(),
};

export const passthroughMutation = () => ({
  mutate: vi.fn(),
  mutateAsync: vi.fn(() => Promise.resolve()),
  isPending: false,
  isError: false,
  isSuccess: false,
  error: null,
  data: undefined,
  reset: vi.fn(),
});

export const passthroughQuery = <T>(data: T) => () => ({
  data,
  isLoading: false,
  isError: false,
  error: null,
  refetch: vi.fn(),
  isFetching: false,
});

// ─── Per-module mock maps ─────────────────────────────────────────

export const accountsMocks = () => ({
  useAccounts: () => emptyList,
  useAccount: passthroughQuery(null),
  useCreateAccount: passthroughMutation,
  useUpdateAccount: passthroughMutation,
  useDeactivateAccount: passthroughMutation,
  useMergeAccounts: passthroughMutation,
  useExportAccounts: passthroughMutation,
  useImportAccounts: passthroughMutation,
});

export const aiMocks = () => ({
  useAiConfig: passthroughQuery(null),
  useAiStatus: passthroughQuery({ isEnabled: false }),
  useUpdateAiConfig: passthroughMutation,
  useTestAiProvider: passthroughMutation,
  useAiCategorize: passthroughMutation,
  useAiBatchCategorize: passthroughMutation,
  useAiOcrReceipt: passthroughMutation,
  useAiParseStatement: passthroughMutation,
  useAiClassify: passthroughMutation,
  useAiUsage: passthroughQuery({ rows: [] }),
  useAiPrompts: passthroughQuery({ prompts: [] }),
  useSystemAiDisclosure: passthroughQuery(null),
  useAcceptSystemAiDisclosure: passthroughMutation,
  useAiConsentStatus: passthroughQuery(null),
  useCompanyAiDisclosure: passthroughQuery(null),
  useAcceptCompanyAiDisclosure: passthroughMutation,
  useRevokeCompanyAiConsent: passthroughMutation,
  useSetCompanyAiTasks: passthroughMutation,
});

export const apMocks = () => ({
  useBills: () => emptyList,
  useBill: passthroughQuery(null),
  useCreateBill: passthroughMutation,
  useUpdateBill: passthroughMutation,
  useVoidBill: passthroughMutation,
  usePayableBills: passthroughQuery({ bills: [] }),
  useVendorCredits: () => emptyList,
  useVendorCredit: passthroughQuery(null),
  useCreateVendorCredit: passthroughMutation,
  useVoidVendorCredit: passthroughMutation,
  usePayBills: passthroughMutation,
  useBillPayment: passthroughQuery(null),
  useVoidBillPayment: passthroughMutation,
});

export const authMocks = () => ({
  useLogin: passthroughMutation,
  useRegister: passthroughMutation,
  useLogout: passthroughMutation,
  useMe: passthroughQuery({
    user: { id: 'u1', email: 't@x', isSuperAdmin: false, displayPreferences: {} },
    companies: [],
    accessibleTenants: [],
    activeTenantId: 't1',
  }),
});

export const bankingMocks = () => ({
  useBankConnections: passthroughQuery({ connections: [] }),
  useCreateBankConnection: passthroughMutation,
  useDisconnectBank: passthroughMutation,
  useBankFeed: () => emptyList,
  useCategorizeFeedItem: passthroughMutation,
  usePayrollOverlapCheck: passthroughQuery({ overlaps: [] }),
  useMatchFeedItem: passthroughMutation,
  useMatchCandidates: passthroughQuery({ candidates: [] }),
  useExcludeFeedItem: passthroughMutation,
  useBulkApprove: passthroughMutation,
  useBulkCategorize: passthroughMutation,
  useBulkRecleanse: passthroughMutation,
  useBulkExclude: passthroughMutation,
  useImportBankFile: passthroughMutation,
  useReconciliations: passthroughQuery({ reconciliations: [] }),
  useReconciliation: passthroughQuery(null),
  useStartReconciliation: passthroughMutation,
  useUpdateReconciliationLines: passthroughMutation,
  useCompleteReconciliation: passthroughMutation,
  useUndoReconciliation: passthroughMutation,
});

export const batchMocks = () => ({
  useValidateBatch: passthroughMutation,
  useSaveBatch: passthroughMutation,
  useParseCsv: passthroughMutation,
});

export const chatMocks = () => ({
  useChatStatus: passthroughQuery({ available: false }),
  useChatConversations: passthroughQuery({ conversations: [] }),
  useChatConversation: passthroughQuery(null),
  useSendChatMessage: passthroughMutation,
  useDeleteChatConversation: passthroughMutation,
  useChatSuggestions: passthroughQuery({ suggestions: [] }),
});

export const checksMocks = () => ({
  useWriteCheck: passthroughMutation,
  useChecks: () => emptyList,
  usePrintQueue: passthroughQuery({ checks: [] }),
  usePrintChecks: passthroughMutation,
  useCheckSettings: passthroughQuery({ checkSettings: {} }),
  useUpdateCheckSettings: passthroughMutation,
});

export const coaTemplateOptionsMocks = () => ({
  useCoaTemplateOptions: () => [],
});

// Mocks for `providers/CompanyProvider` — a context consumer pattern
// distinct from the data-hook mocks above. Many pages (banking, reports,
// settings) call `useCompanyContext()` at render time; the production
// provider runs network fetches on mount, so we supply a static context
// value instead.
export const companyProviderMocks = () => {
  const ctx = {
    activeCompanyId: 'co1',
    companies: [{ id: 'co1', businessName: 'Test Co', setupComplete: true, currency: 'USD' }],
    activeCompanyName: 'Test Co',
    setActiveCompany: () => {},
    refreshCompanies: () => {},
    clearActiveCompany: () => {},
  };
  return {
    CompanyProvider: ({ children }: { children: React.ReactNode }) => children,
    useCompanyContext: () => ctx,
  };
};

export const companyMocks = () => ({
  useCompany: passthroughQuery({
    company: {
      id: 'co1', businessName: 'Test Co', setupComplete: true,
      fiscalYearStartMonth: 1, defaultSalesTaxRate: '0',
      invoiceNextNumber: 1001, invoicePrefix: 'INV-', currency: 'USD',
      invoiceTemplate: null, checkSettings: {},
    },
  }),
  useUpdateCompany: passthroughMutation,
  useUploadLogo: passthroughMutation,
  useCompanySettings: passthroughQuery({
    defaultSalesTaxRate: '0', invoiceNextNumber: 1001, invoicePrefix: 'INV-', currency: 'USD',
  }),
  useUpdateCompanySettings: passthroughMutation,
  useMarkSetupComplete: passthroughMutation,
});

export const contactsMocks = () => ({
  useContacts: () => emptyList,
  useContact: passthroughQuery(null),
  useCreateContact: passthroughMutation,
  useUpdateContact: passthroughMutation,
  useDeactivateContact: passthroughMutation,
  useMergeContacts: passthroughMutation,
  useExportContacts: passthroughMutation,
  useImportContacts: passthroughMutation,
  useContactTransactions: passthroughQuery({ transactions: [] }),
});

export const invoicesMocks = () => ({
  useInvoices: () => emptyList,
  useInvoice: passthroughQuery(null),
  useCreateInvoice: passthroughMutation,
  useSendInvoice: passthroughMutation,
  useRecordPayment: passthroughMutation,
  useVoidInvoice: passthroughMutation,
  useDuplicateInvoice: passthroughMutation,
});

export const itemsMocks = () => ({
  useItems: () => emptyList,
  useItem: passthroughQuery(null),
  useCreateItem: passthroughMutation,
  useUpdateItem: passthroughMutation,
  useDeactivateItem: passthroughMutation,
  useExportItems: passthroughMutation,
});

export const paymentsMocks = () => ({
  useReceivePayment: passthroughMutation,
  useOpenInvoices: passthroughQuery({ invoices: [] }),
  usePaymentsForInvoice: passthroughQuery({ payments: [] }),
  usePendingDeposits: passthroughQuery({ deposits: [] }),
  useDeposits: passthroughQuery({ deposits: [] }),
  useCreateDeposit: passthroughMutation,
  useVoidDeposit: passthroughMutation,
  usePendingCustomerPayments: passthroughQuery({ payments: [] }),
  useUndepositedPayments: passthroughQuery({ payments: [] }),
});

export const payrollImportMocks = () => ({
  usePayrollSessions: passthroughQuery({ sessions: [] }),
  usePayrollSession: passthroughQuery(null),
  usePayrollPreview: passthroughQuery(null),
  usePayrollUpload: passthroughMutation,
  useApplyMapping: passthroughMutation,
  useDescriptionMap: passthroughQuery({ mappings: [] }),
  useSaveDescriptionMap: passthroughMutation,
  useValidateSession: passthroughMutation,
  useGenerateJE: passthroughMutation,
  usePostJE: passthroughMutation,
  useReversePayroll: passthroughMutation,
  useDeletePayrollSession: passthroughMutation,
  usePayrollTemplates: passthroughQuery({ templates: [] }),
  usePayrollChecks: passthroughQuery({ checks: [] }),
  usePostChecks: passthroughMutation,
  usePayrollAccountMappings: passthroughQuery({ mappings: [] }),
  useSavePayrollAccountMappings: passthroughMutation,
  useAutoMapPayrollAccounts: passthroughMutation,
});

export const plaidMocks = () => ({
  usePlaidItems: passthroughQuery({ items: [] }),
  usePlaidItemDetail: passthroughQuery(null),
  useCreateLinkToken: passthroughMutation,
  useExchangeToken: passthroughMutation,
  useCheckInstitution: passthroughMutation,
  useUnmapCompany: passthroughMutation,
  useRemovePlaidItem: passthroughMutation,
  useAssignPlaidAccount: passthroughMutation,
  useMapPlaidAccount: passthroughMutation,
  useUnmapPlaidAccount: passthroughMutation,
  useRemapPlaidAccount: passthroughMutation,
  useUpdateSyncDate: passthroughMutation,
  useTogglePlaidSync: passthroughMutation,
  usePlaidAccountSuggestions: passthroughQuery({ suggestions: [] }),
  useSyncPlaidItem: passthroughMutation,
  useCreateUpdateLinkToken: passthroughMutation,
  usePlaidActivity: passthroughQuery({ activity: [] }),
});

export const registerMocks = () => ({
  useRegister: passthroughQuery({
    account: { id: 'acc', name: 'Acc', accountType: 'asset', detailType: 'checking', accountNumber: '1000' },
    lines: [],
    balanceForward: '0.00',
    endingBalance: '0.00',
    pagination: { page: 1, pageSize: 50, totalPages: 1 },
    allowedEntryTypes: ['deposit', 'expense'],
  }),
  useRegisterSummary: passthroughQuery({ openingBalance: '0.00', endingBalance: '0.00' }),
});

export const tagsMocks = () => ({
  useTags: passthroughQuery({ tags: [] }),
  useTagGroups: passthroughQuery({ groups: [] }),
  useCreateTag: passthroughMutation,
  useUpdateTag: passthroughMutation,
  useDeleteTag: passthroughMutation,
  useMergeTags: passthroughMutation,
  useCreateTagGroup: passthroughMutation,
  useDeleteTagGroup: passthroughMutation,
  useAddTransactionTags: passthroughMutation,
  useReplaceTransactionTags: passthroughMutation,
  useBulkTag: passthroughMutation,
  useSavedFilters: passthroughQuery([]),
  useSaveFilter: passthroughMutation,
});

export const tailscaleMocks = () => ({
  // Tailscale status shape: StatusCard reads currentTailscaleIPs[0] and a
  // state-keyed color lookup; HealthPanel reads health.overall to look up
  // a banner icon. Supply a realistic empty-but-structured value so the
  // smoke test doesn't crash on deep indexing.
  useTailscaleStatus: passthroughQuery({
    state: 'not-running', backendState: 'NoState',
    currentTailscaleIPs: [], peers: [], self: null, health: [],
  }),
  // HealthPanel looks up OVERALL_BANNER[health.overall]; 'healthy' is one
  // of the defined keys. Must match or the page crashes on .icon access.
  // It also maps over health.checks and renders health.lastCheckAt.
  useTailscaleHealth: passthroughQuery({
    overall: 'healthy', checks: [], lastCheckAt: new Date().toISOString(),
    warnings: [], items: [],
  }),
  useTailscaleUpdateCheck: passthroughQuery({ updateAvailable: false }),
  useTailscaleServe: passthroughQuery({ enabled: false, config: null }),
  useTailscaleAudit: passthroughQuery({ entries: [] }),
  useTailscaleConnect: passthroughMutation,
  useTailscaleDisconnect: passthroughMutation,
  useTailscaleReauth: passthroughMutation,
  useTailscaleEnableServe: passthroughMutation,
  useTailscaleDisableServe: passthroughMutation,
});

export const transactionsMocks = () => ({
  useTransactions: () => emptyList,
  useTransaction: passthroughQuery(null),
  useCreateTransaction: passthroughMutation,
  useUpdateTransaction: passthroughMutation,
  useVoidTransaction: passthroughMutation,
  useDuplicateTransaction: passthroughMutation,
});
