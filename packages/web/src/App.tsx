import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppShell } from './components/layout/AppShell';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { AdminRoute } from './components/layout/AdminRoute';
import { LoadingSpinner } from './components/ui/LoadingSpinner';

// Eager-load only what the login path actually needs. Everything else is
// route-lazy — the main bundle no longer ships chart/pdf/admin code on
// first load, and route changes pull chunks on demand. Named exports are
// mapped onto `default` in the lazy wrapper because React.lazy only
// accepts default-exporting modules.

import { LoginPage } from './features/auth/LoginPage';
import { RegisterPage } from './features/auth/RegisterPage';
import { ForgotPasswordPage } from './features/auth/ForgotPasswordPage';
import { MagicLinkVerifyPage } from './features/auth/MagicLinkVerifyPage';
import { ResetPasswordPage } from './features/auth/ResetPasswordPage';
import { OAuthConsentPage } from './features/auth/OAuthConsentPage';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { CompanyProvider } from './providers/CompanyProvider';
import { DiagnosticRouter } from './features/diagnostics/DiagnosticRouter';
import { FirstRunSetupWizard } from './features/setup/FirstRunSetupWizard';
import { NotFoundPage } from './features/NotFoundPage';
import { PublicInvoicePage } from './features/public/PublicInvoicePage';

// Helper to lazy-load a named export. React.lazy expects `default`, so we
// shim the named export onto it. Each call produces a separately chunked
// bundle unless the file is already bundled into a manualChunk.
const lazyNamed = <T extends string>(
  loader: () => Promise<Record<T, React.ComponentType<any>>>,
  name: T,
) => lazy(async () => ({ default: (await loader())[name] }));

// QuickZoom helper for GenericReport columns whose rows carry an account
// identifier. Builds the /transactions URL filtered by that account and
// the report's current date range. Returns null when either piece is
// missing so the cell renders as plain text (e.g. the Retained Earnings
// row on the trial balance has no source account).
const drillByAccount =
  (idKey: string) =>
  (row: Record<string, unknown>, ctx: { startDate?: string; endDate?: string }) => {
    const id = row[idKey];
    if (!id || typeof id !== 'string' || !ctx.startDate || !ctx.endDate) return null;
    const qs = new URLSearchParams({ account: id, from: ctx.startDate, to: ctx.endDate });
    return `/transactions?${qs.toString()}`;
  };

// Contact-scoped drill (customer/vendor balance, aging summaries, 1099).
// Date range is optional — some of these reports are as-of-now rather than
// bound to a period, and an empty from/to produces "all time" on the
// transactions list, which matches the aggregation in the source report.
const drillByContact =
  (idKey: string) =>
  (row: Record<string, unknown>, ctx: { startDate?: string; endDate?: string }) => {
    const id = row[idKey];
    if (!id || typeof id !== 'string') return null;
    const qs = new URLSearchParams({ contact: id });
    if (ctx.startDate) qs.set('from', ctx.startDate);
    if (ctx.endDate) qs.set('to', ctx.endDate);
    return `/transactions?${qs.toString()}`;
  };

// Record-level drill: rows that already represent individual transactions
// (invoice list, unpaid bills, aging detail, check register, etc.) jump
// straight to TransactionDetail, which renders the same record regardless
// of whether it's an invoice, bill, or journal entry. Going via
// /transactions/:id keeps the back-to-report breadcrumb working in one
// place instead of wiring returnTo into every record-type detail page.
const drillToTxn =
  (idKey: string) =>
  (row: Record<string, unknown>) => {
    const id = row[idKey];
    if (!id || typeof id !== 'string') return null;
    return `/transactions/${id}`;
  };

// ─── Settings / company ────────────────────────────────────────
const CompanyProfilePage = lazyNamed(() => import('./features/company/CompanyProfilePage'), 'CompanyProfilePage');
const SettingsPage = lazyNamed(() => import('./features/settings/SettingsPage'), 'SettingsPage');
const SetupWizard = lazyNamed(() => import('./features/company/SetupWizard'), 'SetupWizard');
const BackupRestorePage = lazyNamed(() => import('./features/settings/BackupRestorePage'), 'BackupRestorePage');
const AuditLogPage = lazyNamed(() => import('./features/settings/AuditLogPage'), 'AuditLogPage');
const DataExportPage = lazyNamed(() => import('./features/settings/DataExportPage'), 'DataExportPage');
const TenantExportPage = lazyNamed(() => import('./features/settings/TenantExportPage'), 'TenantExportPage');
const TenantImportPage = lazyNamed(() => import('./features/settings/TenantImportPage'), 'TenantImportPage');
const RemoteBackupSettingsPage = lazyNamed(() => import('./features/settings/RemoteBackupSettingsPage'), 'RemoteBackupSettingsPage');
const OpeningBalancesPage = lazyNamed(() => import('./features/settings/OpeningBalancesPage'), 'OpeningBalancesPage');
const PreferencesPage = lazyNamed(() => import('./features/settings/PreferencesPage'), 'PreferencesPage');
const EmailSettingsPage = lazyNamed(() => import('./features/settings/EmailSettingsPage'), 'EmailSettingsPage');
const ReportLabelsPage = lazyNamed(() => import('./features/settings/ReportLabelsPage'), 'ReportLabelsPage');
const TeamPage = lazyNamed(() => import('./features/settings/TeamPage'), 'TeamPage');
const ApiKeysPage = lazyNamed(() => import('./features/settings/ApiKeysPage'), 'ApiKeysPage');
const TfaSettingsPage = lazyNamed(() => import('./features/settings/TfaSettingsPage'), 'TfaSettingsPage');
const ConnectedAppsPage = lazyNamed(() => import('./features/settings/ConnectedAppsPage'), 'ConnectedAppsPage');
const StorageSettingsPage = lazyNamed(() => import('./features/settings/StorageSettingsPage'), 'StorageSettingsPage');
const StripeSettingsPage = lazyNamed(() => import('./features/settings/StripeSettingsPage'), 'StripeSettingsPage');
const CheckPrintSettingsPage = lazyNamed(() => import('./features/settings/CheckPrintSettingsPage'), 'CheckPrintSettingsPage');
const SystemSettingsPage = lazyNamed(() => import('./features/settings/SystemSettingsPage'), 'SystemSettingsPage');
const PayrollAccountMappingPage = lazyNamed(() => import('./features/payroll/PayrollAccountMappingPage'), 'PayrollAccountMappingPage');

// ─── Accounts ────────────────────────────────────────────────
const AccountsListPage = lazyNamed(() => import('./features/accounts/AccountsListPage'), 'AccountsListPage');
const AccountRegisterPage = lazyNamed(() => import('./features/accounts/RegisterPage'), 'RegisterPage');
const RegistersPage = lazyNamed(() => import('./features/accounts/RegistersPage'), 'RegistersPage');

// ─── Contacts ────────────────────────────────────────────────
const ContactsListPage = lazyNamed(() => import('./features/contacts/ContactsListPage'), 'ContactsListPage');
const ContactFormPage = lazyNamed(() => import('./features/contacts/ContactFormPage'), 'ContactFormPage');
const ContactDetailPage = lazyNamed(() => import('./features/contacts/ContactDetailPage'), 'ContactDetailPage');

// ─── Transactions ────────────────────────────────────────────
const TransactionListPage = lazyNamed(() => import('./features/transactions/TransactionListPage'), 'TransactionListPage');
const TransactionDetail = lazyNamed(() => import('./features/transactions/TransactionDetail'), 'TransactionDetail');
const JournalEntryForm = lazyNamed(() => import('./features/transactions/JournalEntryForm'), 'JournalEntryForm');
const ExpenseForm = lazyNamed(() => import('./features/transactions/ExpenseForm'), 'ExpenseForm');
const TransferForm = lazyNamed(() => import('./features/transactions/TransferForm'), 'TransferForm');
const DepositForm = lazyNamed(() => import('./features/transactions/DepositForm'), 'DepositForm');
const CashSaleForm = lazyNamed(() => import('./features/transactions/CashSaleForm'), 'CashSaleForm');
const BatchEntryPage = lazyNamed(() => import('./features/transactions/BatchEntryPage'), 'BatchEntryPage');
const DuplicateReviewPage = lazyNamed(() => import('./features/transactions/DuplicateReviewPage'), 'DuplicateReviewPage');
const RecurringListPage = lazyNamed(() => import('./features/transactions/RecurringListPage'), 'RecurringListPage');

// ─── Tags / items ────────────────────────────────────────────
const TagManagerPage = lazyNamed(() => import('./features/tags/TagManagerPage'), 'TagManagerPage');
const ItemsListPage = lazyNamed(() => import('./features/items/ItemsListPage'), 'ItemsListPage');

// ─── Banking / checks ────────────────────────────────────────
const WriteCheckPage = lazyNamed(() => import('./features/checks/WriteCheckPage'), 'WriteCheckPage');
const PrintChecksPage = lazyNamed(() => import('./features/checks/PrintChecksPage'), 'PrintChecksPage');
const BankConnectionsPage = lazyNamed(() => import('./features/banking/BankConnectionsPage'), 'BankConnectionsPage');
const BankFeedPage = lazyNamed(() => import('./features/banking/BankFeedPage'), 'BankFeedPage');
const ReconciliationPage = lazyNamed(() => import('./features/banking/ReconciliationPage'), 'ReconciliationPage');
const ReconciliationHistoryPage = lazyNamed(() => import('./features/banking/ReconciliationHistoryPage'), 'ReconciliationHistoryPage');
const BankRulesPage = lazyNamed(() => import('./features/banking/BankRulesPage'), 'BankRulesPage');
const BankDepositPage = lazyNamed(() => import('./features/banking/BankDepositPage'), 'BankDepositPage');
const StatementUploadPage = lazyNamed(() => import('./features/banking/StatementUploadPage'), 'StatementUploadPage');

// ─── Attachments ─────────────────────────────────────────────
const AttachmentLibraryPage = lazyNamed(() => import('./features/attachments/AttachmentLibraryPage'), 'AttachmentLibraryPage');

// ─── Invoicing / AP / payments ───────────────────────────────
const ReceivePaymentPage = lazyNamed(() => import('./features/invoicing/ReceivePaymentPage'), 'ReceivePaymentPage');
const InvoiceListPage = lazyNamed(() => import('./features/invoicing/InvoiceListPage'), 'InvoiceListPage');
const InvoiceForm = lazyNamed(() => import('./features/invoicing/InvoiceForm'), 'InvoiceForm');
const InvoiceDetailPage = lazyNamed(() => import('./features/invoicing/InvoiceDetailPage'), 'InvoiceDetailPage');
const InvoiceTemplateEditor = lazyNamed(() => import('./features/invoicing/InvoiceTemplateEditor'), 'InvoiceTemplateEditor');
const BillListPage = lazyNamed(() => import('./features/ap/BillListPage'), 'BillListPage');
const EnterBillPage = lazyNamed(() => import('./features/ap/EnterBillPage'), 'EnterBillPage');
const BillDetailPage = lazyNamed(() => import('./features/ap/BillDetailPage'), 'BillDetailPage');
const EnterVendorCreditPage = lazyNamed(() => import('./features/ap/EnterVendorCreditPage'), 'EnterVendorCreditPage');
const VendorCreditListPage = lazyNamed(() => import('./features/ap/VendorCreditListPage'), 'VendorCreditListPage');
const PayBillsPage = lazyNamed(() => import('./features/ap/PayBillsPage'), 'PayBillsPage');

// ─── Budgets ─────────────────────────────────────────────────
const BudgetEditorPage = lazyNamed(() => import('./features/budgets/BudgetEditorPage'), 'BudgetEditorPage');

// ─── Reports (heavy: ships charts + pdf libs) ────────────────
const ReportsPage = lazyNamed(() => import('./features/reports/ReportsPage'), 'ReportsPage');
const ProfitAndLossReport = lazyNamed(() => import('./features/reports/ProfitAndLossReport'), 'ProfitAndLossReport');
const BalanceSheetReport = lazyNamed(() => import('./features/reports/BalanceSheetReport'), 'BalanceSheetReport');
const GeneralLedgerReport = lazyNamed(() => import('./features/reports/GeneralLedgerReport'), 'GeneralLedgerReport');
const GenericReport = lazyNamed(() => import('./features/reports/GenericReport'), 'GenericReport');
const BudgetVsActualReport = lazyNamed(() => import('./features/reports/BudgetVsActualReport'), 'BudgetVsActualReport');
const BudgetOverviewReport = lazyNamed(() => import('./features/reports/BudgetOverviewReport'), 'BudgetOverviewReport');

// ─── Admin (super-admin only; rarely loaded) ─────────────────
const AdminDashboard = lazyNamed(() => import('./features/admin/AdminDashboard'), 'AdminDashboard');
const TenantListPage = lazyNamed(() => import('./features/admin/TenantListPage'), 'TenantListPage');
const TenantDetailPage = lazyNamed(() => import('./features/admin/TenantDetailPage'), 'TenantDetailPage');
const UserListPage = lazyNamed(() => import('./features/admin/UserListPage'), 'UserListPage');
const GlobalBankRulesPage = lazyNamed(() => import('./features/admin/GlobalBankRulesPage'), 'GlobalBankRulesPage');
const TfaConfigPage = lazyNamed(() => import('./features/admin/TfaConfigPage'), 'TfaConfigPage');
const InstallationSecurityPage = lazyNamed(() => import('./features/admin/InstallationSecurityPage'), 'InstallationSecurityPage');
const PlaidConfigPage = lazyNamed(() => import('./features/admin/PlaidConfigPage'), 'PlaidConfigPage');
const PlaidConnectionsMonitorPage = lazyNamed(() => import('./features/admin/PlaidConnectionsMonitorPage'), 'PlaidConnectionsMonitorPage');
const AiConfigPage = lazyNamed(() => import('./features/admin/AiConfigPage'), 'AiConfigPage');
const McpConfigPage = lazyNamed(() => import('./features/admin/McpConfigPage'), 'McpConfigPage');
const CoaTemplatesPage = lazyNamed(() => import('./features/admin/CoaTemplatesPage'), 'CoaTemplatesPage');
const TailscaleAdminPage = lazyNamed(() => import('./features/admin/TailscaleAdminPage'), 'TailscaleAdminPage');

// ─── Payroll / help ──────────────────────────────────────────
const PayrollImportPage = lazyNamed(() => import('./features/payroll/PayrollImportPage'), 'PayrollImportPage');
const PayrollHistoryPage = lazyNamed(() => import('./features/payroll/PayrollHistoryPage'), 'PayrollHistoryPage');
const KnowledgeBasePage = lazyNamed(() => import('./features/help/KnowledgeBasePage'), 'KnowledgeBasePage');
const ArticlePage = lazyNamed(() => import('./features/help/ArticlePage'), 'ArticlePage');

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <LoadingSpinner size="lg" />
    </div>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <DiagnosticRouter>
      <CompanyProvider>
      <BrowserRouter>
        <Suspense fallback={<LoadingFallback />}>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/auth/magic" element={<MagicLinkVerifyPage />} />
          <Route path="/oauth/consent" element={<OAuthConsentPage />} />
          <Route path="/first-run-setup" element={<FirstRunSetupWizard />} />
          <Route path="/pay/:token" element={<PublicInvoicePage />} />

          {/* Setup wizard */}
          <Route
            path="/setup"
            element={
              <ProtectedRoute>
                <SetupWizard />
              </ProtectedRoute>
            }
          />

          {/* Protected routes */}
          <Route
            element={
              <ProtectedRoute>
                <AppShell />
              </ProtectedRoute>
            }
          >
            <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
            <Route path="/admin/tenants" element={<AdminRoute><TenantListPage /></AdminRoute>} />
            <Route path="/admin/tenants/:id" element={<AdminRoute><TenantDetailPage /></AdminRoute>} />
            <Route path="/admin/users" element={<AdminRoute><UserListPage /></AdminRoute>} />
            <Route path="/admin/system" element={<AdminRoute><SystemSettingsPage /></AdminRoute>} />
            <Route path="/admin/bank-rules" element={<AdminRoute><GlobalBankRulesPage /></AdminRoute>} />
            <Route path="/admin/coa-templates" element={<AdminRoute><CoaTemplatesPage /></AdminRoute>} />
            <Route path="/" element={<DashboardPage />} />
            <Route path="/accounts" element={<AccountsListPage />} />
            <Route path="/accounts/:id/register" element={<AccountRegisterPage />} />
            <Route path="/registers" element={<RegistersPage />} />
            <Route path="/contacts" element={<ContactsListPage />} />
            <Route path="/contacts/new" element={<ContactFormPage />} />
            <Route path="/contacts/:id" element={<ContactDetailPage />} />
            <Route path="/contacts/:id/edit" element={<ContactFormPage />} />
            <Route path="/transactions" element={<TransactionListPage />} />
            <Route path="/transactions/:id" element={<TransactionDetail />} />
            <Route path="/transactions/new/journal-entry" element={<JournalEntryForm />} />
            <Route path="/transactions/new/expense" element={<ExpenseForm />} />
            <Route path="/transactions/new/transfer" element={<TransferForm />} />
            <Route path="/transactions/new/deposit" element={<DepositForm />} />
            <Route path="/transactions/new/cash-sale" element={<CashSaleForm />} />
            <Route path="/transactions/:id/edit/expense" element={<ExpenseForm />} />
            <Route path="/transactions/:id/edit/transfer" element={<TransferForm />} />
            <Route path="/transactions/:id/edit/deposit" element={<DepositForm />} />
            <Route path="/transactions/:id/edit/cash-sale" element={<CashSaleForm />} />
            <Route path="/transactions/:id/edit/journal-entry" element={<JournalEntryForm />} />
            <Route path="/transactions/batch" element={<BatchEntryPage />} />
            <Route path="/checks/write" element={<WriteCheckPage />} />
            <Route path="/checks/print" element={<PrintChecksPage />} />
            <Route path="/settings/check-printing" element={<CheckPrintSettingsPage />} />
            <Route path="/banking" element={<BankConnectionsPage />} />
            <Route path="/banking/feed" element={<BankFeedPage />} />
            <Route path="/banking/statement-upload" element={<StatementUploadPage />} />
            <Route path="/banking/reconcile" element={<ReconciliationPage />} />
            <Route path="/banking/reconciliation-history" element={<ReconciliationHistoryPage />} />
            <Route path="/banking/rules" element={<BankRulesPage />} />
            <Route path="/duplicates" element={<DuplicateReviewPage />} />
            <Route path="/items" element={<ItemsListPage />} />
            <Route path="/receive-payment" element={<ReceivePaymentPage />} />
            <Route path="/banking/deposit" element={<BankDepositPage />} />
            <Route path="/invoices" element={<InvoiceListPage />} />
            <Route path="/invoices/new" element={<InvoiceForm />} />
            <Route path="/invoices/:id" element={<InvoiceDetailPage />} />
            <Route path="/invoices/:id/edit" element={<InvoiceForm />} />
            <Route path="/settings/invoice-template" element={<InvoiceTemplateEditor />} />
            <Route path="/bills" element={<BillListPage />} />
            <Route path="/bills/new" element={<EnterBillPage />} />
            <Route path="/bills/:id" element={<BillDetailPage />} />
            <Route path="/bills/:id/edit" element={<EnterBillPage />} />
            <Route path="/vendor-credits" element={<VendorCreditListPage />} />
            <Route path="/vendor-credits/new" element={<EnterVendorCreditPage />} />
            <Route path="/pay-bills" element={<PayBillsPage />} />
            <Route path="/attachments" element={<AttachmentLibraryPage />} />
            <Route path="/recurring" element={<RecurringListPage />} />
            <Route path="/settings/tags" element={<TagManagerPage />} />
            <Route path="/budgets" element={<BudgetEditorPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/reports/profit-loss" element={<ProfitAndLossReport />} />
            <Route path="/reports/balance-sheet" element={<BalanceSheetReport />} />
            <Route path="/reports/cash-flow" element={<GenericReport title="Cash Flow Statement" endpoint="cash-flow" columns={[{key:'operatingActivities',label:'Operating',align:'right',format:'money'},{key:'netChange',label:'Net Change',align:'right',format:'money'}]} dataKey="__single" />} />
            <Route path="/reports/ar-aging-summary" element={<GenericReport title="AR Aging Summary" endpoint="ar-aging-summary" useDateRange={false} useAsOfDate columns={[{key:'customer_name',label:'Customer'},{key:'bucket',label:'Bucket'},{key:'balance',label:'Amount',align:'right',format:'money',drillDown:drillByContact('contact_id')}]} dataKey="details" />} />
            <Route path="/reports/ar-aging-detail" element={<GenericReport title="AR Aging Detail" endpoint="ar-aging-detail" useDateRange={false} useAsOfDate columns={[{key:'txn_number',label:'Invoice',drillDown:drillToTxn('id')},{key:'customer_name',label:'Customer'},{key:'txn_date',label:'Date'},{key:'due_date',label:'Due'},{key:'balance',label:'Balance',align:'right',format:'money'}]} dataKey="details" />} />
            <Route path="/reports/customer-balance-summary" element={<GenericReport title="Customer Balance Summary" endpoint="customer-balance-summary" useDateRange={false} columns={[{key:'display_name',label:'Customer'},{key:'balance',label:'Balance',align:'right',format:'money',drillDown:drillByContact('id')}]} />} />
            <Route path="/reports/customer-balance-detail" element={<GenericReport title="Customer Balance Detail" endpoint="customer-balance-detail" useDateRange={false} columns={[{key:'display_name',label:'Customer'},{key:'balance',label:'Balance',align:'right',format:'money',drillDown:drillByContact('id')}]} />} />
            <Route path="/reports/invoice-list" element={<GenericReport title="Invoice List" endpoint="invoice-list" columns={[{key:'txn_number',label:'Number',drillDown:drillToTxn('id')},{key:'customer_name',label:'Customer'},{key:'txn_date',label:'Date'},{key:'invoice_status',label:'Status'},{key:'total',label:'Total',align:'right',format:'money'},{key:'balance_due',label:'Balance',align:'right',format:'money'}]} />} />
            <Route path="/reports/expense-by-vendor" element={<GenericReport title="Expenses by Vendor" endpoint="expense-by-vendor" columns={[{key:'vendor_name',label:'Vendor'},{key:'total',label:'Total',align:'right',format:'money',drillDown:drillByContact('contact_id')}]} />} />
            <Route path="/reports/expense-by-category" element={<GenericReport title="Expenses by Category" endpoint="expense-by-category" columns={[{key:'account_number',label:'#'},{key:'category',label:'Category'},{key:'total',label:'Total',align:'right',format:'money',drillDown:drillByAccount('account_id')}]} />} />
            <Route path="/reports/vendor-balance-summary" element={<GenericReport title="Vendor Balance Summary" endpoint="vendor-balance-summary" useDateRange={false} columns={[{key:'display_name',label:'Vendor'},{key:'total_spent',label:'Total Spent',align:'right',format:'money',drillDown:drillByContact('id')}]} />} />
            <Route path="/reports/ap-aging-summary" element={<GenericReport title="AP Aging Summary" endpoint="ap-aging-summary" useDateRange={false} useAsOfDate columns={[{key:'vendor_name',label:'Vendor'},{key:'current',label:'Current',align:'right',format:'money'},{key:'bucket1to30',label:'1-30',align:'right',format:'money'},{key:'bucket31to60',label:'31-60',align:'right',format:'money'},{key:'bucket61to90',label:'61-90',align:'right',format:'money'},{key:'bucketOver90',label:'90+',align:'right',format:'money'},{key:'total',label:'Total',align:'right',format:'money',drillDown:drillByContact('contact_id')}]} dataKey="vendors" />} />
            <Route path="/reports/ap-aging-detail" element={<GenericReport title="AP Aging Detail" endpoint="ap-aging-detail" useDateRange={false} useAsOfDate columns={[{key:'txn_number',label:'Bill #',drillDown:drillToTxn('id')},{key:'vendor_name',label:'Vendor'},{key:'vendor_invoice_number',label:'Vendor Inv #'},{key:'txn_date',label:'Date'},{key:'due_date',label:'Due'},{key:'days_overdue',label:'Days Overdue',align:'right'},{key:'balance',label:'Balance',align:'right',format:'money'}]} dataKey="details" />} />
            <Route path="/reports/unpaid-bills" element={<GenericReport title="Unpaid Bills" endpoint="unpaid-bills" useDateRange={false} columns={[{key:'vendor_name',label:'Vendor'},{key:'txn_number',label:'Bill #',drillDown:drillToTxn('id')},{key:'vendor_invoice_number',label:'Vendor Inv #'},{key:'txn_date',label:'Date'},{key:'due_date',label:'Due'},{key:'total',label:'Total',align:'right',format:'money'},{key:'balance_due',label:'Balance',align:'right',format:'money'}]} />} />
            <Route path="/reports/bill-payment-history" element={<GenericReport title="Bill Payment History" endpoint="bill-payment-history" columns={[{key:'txn_date',label:'Date'},{key:'txn_number',label:'Payment #',drillDown:drillToTxn('id')},{key:'vendor_name',label:'Vendor'},{key:'check_number',label:'Check #'},{key:'bill_count',label:'# Bills',align:'right'},{key:'total',label:'Amount',align:'right',format:'money'}]} />} />
            <Route path="/reports/ap-1099-prep" element={<GenericReport title="1099 Preparation" endpoint="ap-1099-prep" useDateRange={false} columns={[{key:'vendor_name',label:'Vendor'},{key:'address',label:'Address'},{key:'tax_id',label:'Tax ID'},{key:'total_paid',label:'Total Paid',align:'right',format:'money'}]} />} />
            <Route path="/reports/transaction-list-by-vendor" element={<GenericReport title="Transactions by Vendor" endpoint="transaction-list-by-vendor" columns={[{key:'txn_date',label:'Date'},{key:'txn_type',label:'Type'},{key:'txn_number',label:'Number',drillDown:drillToTxn('id')},{key:'total',label:'Amount',align:'right',format:'money'}]} />} />
            <Route path="/reports/bank-reconciliation-summary" element={<GenericReport title="Bank Reconciliation" endpoint="bank-reconciliation-summary" useDateRange={false} columns={[]} />} />
            <Route path="/reports/deposit-detail" element={<GenericReport title="Deposit Detail" endpoint="deposit-detail" columns={[{key:'txn_date',label:'Date'},{key:'txn_number',label:'Number',drillDown:drillToTxn('id')},{key:'total',label:'Amount',align:'right',format:'money'},{key:'memo',label:'Memo'}]} />} />
            <Route path="/reports/check-register" element={<GenericReport title="Check Register" endpoint="check-register" columns={[{key:'txn_date',label:'Date'},{key:'txn_type',label:'Type'},{key:'txn_number',label:'Number',drillDown:drillToTxn('id')},{key:'debit',label:'Debit',align:'right',format:'money'},{key:'credit',label:'Credit',align:'right',format:'money'}]} />} />
            <Route path="/reports/sales-tax-liability" element={<GenericReport title="Sales Tax Liability" endpoint="sales-tax-liability" columns={[]} dataKey="__single" />} />
            <Route path="/reports/taxable-sales-summary" element={<GenericReport title="Taxable Sales Summary" endpoint="taxable-sales-summary" columns={[]} dataKey="__single" />} />
            <Route path="/reports/sales-tax-payments" element={<GenericReport title="Sales Tax Payments" endpoint="sales-tax-payments" columns={[{key:'txn_date',label:'Date'},{key:'total',label:'Amount',align:'right',format:'money'}]} />} />
            <Route path="/reports/vendor-1099-summary" element={<GenericReport title="1099 Vendor Summary" endpoint="vendor-1099-summary" useDateRange={false} columns={[{key:'display_name',label:'Vendor'},{key:'tax_id',label:'Tax ID'},{key:'total_paid',label:'Total Paid',align:'right',format:'money',drillDown:drillByContact('id')}]} />} />
            <Route path="/reports/general-ledger" element={<GeneralLedgerReport />} />
            <Route path="/reports/trial-balance" element={<GenericReport title="Trial Balance" endpoint="trial-balance" useDateRange={true} columns={[{key:'account_number',label:'#'},{key:'name',label:'Account'},{key:'account_type',label:'Type'},{key:'total_debit',label:'Debit',align:'right',format:'money',drillDown:drillByAccount('id')},{key:'total_credit',label:'Credit',align:'right',format:'money',drillDown:drillByAccount('id')}]} />} />
            <Route path="/reports/transaction-list" element={<GenericReport title="Transaction List" endpoint="transaction-list" columns={[{key:'txn_date',label:'Date'},{key:'txn_type',label:'Type'},{key:'txn_number',label:'Number',drillDown:drillToTxn('id')},{key:'contact_name',label:'Contact'},{key:'total',label:'Amount',align:'right',format:'money'},{key:'memo',label:'Memo'}]} />} />
            <Route path="/reports/journal-entry-report" element={<GenericReport title="Journal Entries" endpoint="journal-entry-report" columns={[{key:'txn_date',label:'Date'},{key:'txn_number',label:'Number',drillDown:drillToTxn('id')},{key:'total',label:'Amount',align:'right',format:'money'},{key:'memo',label:'Memo'}]} />} />
            <Route path="/reports/budget-vs-actual" element={<BudgetVsActualReport />} />
            <Route path="/reports/budget-overview" element={<BudgetOverviewReport />} />
            <Route path="/settings/company" element={<CompanyProfilePage />} />
            <Route path="/settings/backup" element={<BackupRestorePage />} />
            <Route path="/settings/audit-log" element={<AuditLogPage />} />
            <Route path="/settings/export" element={<DataExportPage />} />
            <Route path="/settings/tenant-export" element={<TenantExportPage />} />
            <Route path="/settings/tenant-import" element={<TenantImportPage />} />
            <Route path="/settings/remote-backup" element={<RemoteBackupSettingsPage />} />
            <Route path="/settings/opening-balances" element={<OpeningBalancesPage />} />
            <Route path="/settings/preferences" element={<PreferencesPage />} />
            <Route path="/settings/email" element={<EmailSettingsPage />} />
            <Route path="/settings/report-labels" element={<ReportLabelsPage />} />
            <Route path="/settings/online-payments" element={<StripeSettingsPage />} />
            <Route path="/settings/team" element={<TeamPage />} />
            <Route path="/settings/api-keys" element={<ApiKeysPage />} />
            <Route path="/settings/security" element={<TfaSettingsPage />} />
            <Route path="/settings/connected-apps" element={<ConnectedAppsPage />} />
            <Route path="/settings/storage" element={<StorageSettingsPage />} />
            <Route path="/admin/tfa" element={<AdminRoute><TfaConfigPage /></AdminRoute>} />
            <Route path="/admin/security" element={<AdminRoute><InstallationSecurityPage /></AdminRoute>} />
            <Route path="/admin/plaid" element={<AdminRoute><PlaidConfigPage /></AdminRoute>} />
            <Route path="/admin/plaid/connections" element={<AdminRoute><PlaidConnectionsMonitorPage /></AdminRoute>} />
            <Route path="/admin/ai" element={<AdminRoute><AiConfigPage /></AdminRoute>} />
            <Route path="/admin/mcp" element={<AdminRoute><McpConfigPage /></AdminRoute>} />
            <Route path="/admin/tailscale" element={<AdminRoute><TailscaleAdminPage /></AdminRoute>} />
            <Route path="/payroll/import" element={<PayrollImportPage />} />
            <Route path="/payroll/imports" element={<PayrollHistoryPage />} />
            <Route path="/settings/payroll-accounts" element={<PayrollAccountMappingPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/help" element={<KnowledgeBasePage />} />
            <Route path="/help/:id" element={<ArticlePage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
        </Suspense>
      </BrowserRouter>
      </CompanyProvider>
      </DiagnosticRouter>
    </QueryClientProvider>
  );
}
