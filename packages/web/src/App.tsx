import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppShell } from './components/layout/AppShell';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { AdminRoute } from './components/layout/AdminRoute';
import { LoginPage } from './features/auth/LoginPage';
import { RegisterPage } from './features/auth/RegisterPage';
import { ForgotPasswordPage } from './features/auth/ForgotPasswordPage';
import { MagicLinkVerifyPage } from './features/auth/MagicLinkVerifyPage';
import { ResetPasswordPage } from './features/auth/ResetPasswordPage';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { CompanyProfilePage } from './features/company/CompanyProfilePage';
import { SettingsPage } from './features/settings/SettingsPage';
import { AccountsListPage } from './features/accounts/AccountsListPage';
import { ContactsListPage } from './features/contacts/ContactsListPage';
import { ContactFormPage } from './features/contacts/ContactFormPage';
import { ContactDetailPage } from './features/contacts/ContactDetailPage';
import { TransactionListPage } from './features/transactions/TransactionListPage';
import { TransactionDetail } from './features/transactions/TransactionDetail';
import { JournalEntryForm } from './features/transactions/JournalEntryForm';
import { ExpenseForm } from './features/transactions/ExpenseForm';
import { TransferForm } from './features/transactions/TransferForm';
import { DepositForm } from './features/transactions/DepositForm';
import { CashSaleForm } from './features/transactions/CashSaleForm';
import { BatchEntryPage } from './features/transactions/BatchEntryPage';
import { TagManagerPage } from './features/tags/TagManagerPage';
import { ItemsListPage } from './features/items/ItemsListPage';
import { ReceivePaymentPage } from './features/invoicing/ReceivePaymentPage';
import { BankDepositPage } from './features/banking/BankDepositPage';
import { WriteCheckPage } from './features/checks/WriteCheckPage';
import { PrintChecksPage } from './features/checks/PrintChecksPage';
import { CheckPrintSettingsPage } from './features/settings/CheckPrintSettingsPage';
import { BankConnectionsPage } from './features/banking/BankConnectionsPage';
import { BankFeedPage } from './features/banking/BankFeedPage';
import { ReconciliationPage } from './features/banking/ReconciliationPage';
import { ReconciliationHistoryPage } from './features/banking/ReconciliationHistoryPage';
import { BankRulesPage } from './features/banking/BankRulesPage';
import { DuplicateReviewPage } from './features/transactions/DuplicateReviewPage';
import { AttachmentLibraryPage } from './features/attachments/AttachmentLibraryPage';
import { RecurringListPage } from './features/transactions/RecurringListPage';
import { RegisterPage as AccountRegisterPage } from './features/accounts/RegisterPage';
import { RegistersPage } from './features/accounts/RegistersPage';
import { InvoiceListPage } from './features/invoicing/InvoiceListPage';
import { InvoiceForm } from './features/invoicing/InvoiceForm';
import { InvoiceDetailPage } from './features/invoicing/InvoiceDetailPage';
import { InvoiceTemplateEditor } from './features/invoicing/InvoiceTemplateEditor';
import { BillListPage } from './features/ap/BillListPage';
import { EnterBillPage } from './features/ap/EnterBillPage';
import { BillDetailPage } from './features/ap/BillDetailPage';
import { EnterVendorCreditPage } from './features/ap/EnterVendorCreditPage';
import { VendorCreditListPage } from './features/ap/VendorCreditListPage';
import { PayBillsPage } from './features/ap/PayBillsPage';
import { ReportsPage } from './features/reports/ReportsPage';
import { ProfitAndLossReport } from './features/reports/ProfitAndLossReport';
import { BalanceSheetReport } from './features/reports/BalanceSheetReport';
import { GeneralLedgerReport } from './features/reports/GeneralLedgerReport';
import { GenericReport } from './features/reports/GenericReport';
import { SetupWizard } from './features/company/SetupWizard';
import { BudgetEditorPage } from './features/budgets/BudgetEditorPage';
import { BudgetVsActualReport } from './features/reports/BudgetVsActualReport';
import { BudgetOverviewReport } from './features/reports/BudgetOverviewReport';
import { BackupRestorePage } from './features/settings/BackupRestorePage';
import { AuditLogPage } from './features/settings/AuditLogPage';
import { DataExportPage } from './features/settings/DataExportPage';
import { TenantExportPage } from './features/settings/TenantExportPage';
import { TenantImportPage } from './features/settings/TenantImportPage';
import { RemoteBackupSettingsPage } from './features/settings/RemoteBackupSettingsPage';
import { OpeningBalancesPage } from './features/settings/OpeningBalancesPage';
import { CompanyProvider } from './providers/CompanyProvider';
import { FirstRunSetupWizard } from './features/setup/FirstRunSetupWizard';
import { DiagnosticRouter } from './features/diagnostics/DiagnosticRouter';
import { SystemSettingsPage } from './features/settings/SystemSettingsPage';
import { PreferencesPage } from './features/settings/PreferencesPage';
import { EmailSettingsPage } from './features/settings/EmailSettingsPage';
import { TeamPage } from './features/settings/TeamPage';
import { ApiKeysPage } from './features/settings/ApiKeysPage';
import { AdminDashboard } from './features/admin/AdminDashboard';
import { TenantListPage } from './features/admin/TenantListPage';
import { TenantDetailPage } from './features/admin/TenantDetailPage';
import { UserListPage } from './features/admin/UserListPage';
import { GlobalBankRulesPage } from './features/admin/GlobalBankRulesPage';
import { TfaConfigPage } from './features/admin/TfaConfigPage';
import { InstallationSecurityPage } from './features/admin/InstallationSecurityPage';
import { PlaidConfigPage } from './features/admin/PlaidConfigPage';
import { PlaidConnectionsMonitorPage } from './features/admin/PlaidConnectionsMonitorPage';
import { AiConfigPage } from './features/admin/AiConfigPage';
import { McpConfigPage } from './features/admin/McpConfigPage';
import { CoaTemplatesPage } from './features/admin/CoaTemplatesPage';
import { TailscaleAdminPage } from './features/admin/TailscaleAdminPage';
import { OAuthConsentPage } from './features/auth/OAuthConsentPage';
import { ConnectedAppsPage } from './features/settings/ConnectedAppsPage';
import { StorageSettingsPage } from './features/settings/StorageSettingsPage';
import { StatementUploadPage } from './features/banking/StatementUploadPage';
import { PayrollImportPage } from './features/payroll/PayrollImportPage';
import { PayrollHistoryPage } from './features/payroll/PayrollHistoryPage';
import { PayrollAccountMappingPage } from './features/payroll/PayrollAccountMappingPage';
import { TfaSettingsPage } from './features/settings/TfaSettingsPage';
import { KnowledgeBasePage } from './features/help/KnowledgeBasePage';
import { PublicInvoicePage } from './features/public/PublicInvoicePage';
import { StripeSettingsPage } from './features/settings/StripeSettingsPage';
import { ArticlePage } from './features/help/ArticlePage';
import { NotFoundPage } from './features/NotFoundPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <DiagnosticRouter>
      <CompanyProvider>
      <BrowserRouter>
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
            <Route path="/reports/ar-aging-summary" element={<GenericReport title="AR Aging Summary" endpoint="ar-aging-summary" useDateRange={false} useAsOfDate columns={[{key:'customer_name',label:'Customer'},{key:'bucket',label:'Bucket'},{key:'balance',label:'Amount',align:'right',format:'money'}]} dataKey="details" />} />
            <Route path="/reports/ar-aging-detail" element={<GenericReport title="AR Aging Detail" endpoint="ar-aging-detail" useDateRange={false} useAsOfDate columns={[{key:'txn_number',label:'Invoice'},{key:'customer_name',label:'Customer'},{key:'txn_date',label:'Date'},{key:'due_date',label:'Due'},{key:'balance',label:'Balance',align:'right',format:'money'}]} dataKey="details" />} />
            <Route path="/reports/customer-balance-summary" element={<GenericReport title="Customer Balance Summary" endpoint="customer-balance-summary" useDateRange={false} columns={[{key:'display_name',label:'Customer'},{key:'balance',label:'Balance',align:'right',format:'money'}]} />} />
            <Route path="/reports/customer-balance-detail" element={<GenericReport title="Customer Balance Detail" endpoint="customer-balance-detail" useDateRange={false} columns={[{key:'display_name',label:'Customer'},{key:'balance',label:'Balance',align:'right',format:'money'}]} />} />
            <Route path="/reports/invoice-list" element={<GenericReport title="Invoice List" endpoint="invoice-list" columns={[{key:'txn_number',label:'Number'},{key:'customer_name',label:'Customer'},{key:'txn_date',label:'Date'},{key:'invoice_status',label:'Status'},{key:'total',label:'Total',align:'right',format:'money'},{key:'balance_due',label:'Balance',align:'right',format:'money'}]} />} />
            <Route path="/reports/expense-by-vendor" element={<GenericReport title="Expenses by Vendor" endpoint="expense-by-vendor" columns={[{key:'vendor_name',label:'Vendor'},{key:'total',label:'Total',align:'right',format:'money'}]} />} />
            <Route path="/reports/expense-by-category" element={<GenericReport title="Expenses by Category" endpoint="expense-by-category" columns={[{key:'account_number',label:'#'},{key:'category',label:'Category'},{key:'total',label:'Total',align:'right',format:'money'}]} />} />
            <Route path="/reports/vendor-balance-summary" element={<GenericReport title="Vendor Balance Summary" endpoint="vendor-balance-summary" useDateRange={false} columns={[{key:'display_name',label:'Vendor'},{key:'total_spent',label:'Total Spent',align:'right',format:'money'}]} />} />
            <Route path="/reports/ap-aging-summary" element={<GenericReport title="AP Aging Summary" endpoint="ap-aging-summary" useDateRange={false} useAsOfDate columns={[{key:'vendor_name',label:'Vendor'},{key:'current',label:'Current',align:'right',format:'money'},{key:'bucket1to30',label:'1-30',align:'right',format:'money'},{key:'bucket31to60',label:'31-60',align:'right',format:'money'},{key:'bucket61to90',label:'61-90',align:'right',format:'money'},{key:'bucketOver90',label:'90+',align:'right',format:'money'},{key:'total',label:'Total',align:'right',format:'money'}]} dataKey="vendors" />} />
            <Route path="/reports/ap-aging-detail" element={<GenericReport title="AP Aging Detail" endpoint="ap-aging-detail" useDateRange={false} useAsOfDate columns={[{key:'txn_number',label:'Bill #'},{key:'vendor_name',label:'Vendor'},{key:'vendor_invoice_number',label:'Vendor Inv #'},{key:'txn_date',label:'Date'},{key:'due_date',label:'Due'},{key:'days_overdue',label:'Days Overdue',align:'right'},{key:'balance',label:'Balance',align:'right',format:'money'}]} dataKey="details" />} />
            <Route path="/reports/unpaid-bills" element={<GenericReport title="Unpaid Bills" endpoint="unpaid-bills" useDateRange={false} columns={[{key:'vendor_name',label:'Vendor'},{key:'txn_number',label:'Bill #'},{key:'vendor_invoice_number',label:'Vendor Inv #'},{key:'txn_date',label:'Date'},{key:'due_date',label:'Due'},{key:'total',label:'Total',align:'right',format:'money'},{key:'balance_due',label:'Balance',align:'right',format:'money'}]} />} />
            <Route path="/reports/bill-payment-history" element={<GenericReport title="Bill Payment History" endpoint="bill-payment-history" columns={[{key:'txn_date',label:'Date'},{key:'txn_number',label:'Payment #'},{key:'vendor_name',label:'Vendor'},{key:'check_number',label:'Check #'},{key:'bill_count',label:'# Bills',align:'right'},{key:'total',label:'Amount',align:'right',format:'money'}]} />} />
            <Route path="/reports/ap-1099-prep" element={<GenericReport title="1099 Preparation" endpoint="ap-1099-prep" useDateRange={false} columns={[{key:'vendor_name',label:'Vendor'},{key:'address',label:'Address'},{key:'tax_id',label:'Tax ID'},{key:'total_paid',label:'Total Paid',align:'right',format:'money'}]} />} />
            <Route path="/reports/transaction-list-by-vendor" element={<GenericReport title="Transactions by Vendor" endpoint="transaction-list-by-vendor" columns={[{key:'txn_date',label:'Date'},{key:'txn_type',label:'Type'},{key:'txn_number',label:'Number'},{key:'total',label:'Amount',align:'right',format:'money'}]} />} />
            <Route path="/reports/bank-reconciliation-summary" element={<GenericReport title="Bank Reconciliation" endpoint="bank-reconciliation-summary" useDateRange={false} columns={[]} />} />
            <Route path="/reports/deposit-detail" element={<GenericReport title="Deposit Detail" endpoint="deposit-detail" columns={[{key:'txn_date',label:'Date'},{key:'txn_number',label:'Number'},{key:'total',label:'Amount',align:'right',format:'money'},{key:'memo',label:'Memo'}]} />} />
            <Route path="/reports/check-register" element={<GenericReport title="Check Register" endpoint="check-register" columns={[{key:'txn_date',label:'Date'},{key:'txn_type',label:'Type'},{key:'txn_number',label:'Number'},{key:'debit',label:'Debit',align:'right',format:'money'},{key:'credit',label:'Credit',align:'right',format:'money'}]} />} />
            <Route path="/reports/sales-tax-liability" element={<GenericReport title="Sales Tax Liability" endpoint="sales-tax-liability" columns={[]} dataKey="__single" />} />
            <Route path="/reports/taxable-sales-summary" element={<GenericReport title="Taxable Sales Summary" endpoint="taxable-sales-summary" columns={[]} dataKey="__single" />} />
            <Route path="/reports/sales-tax-payments" element={<GenericReport title="Sales Tax Payments" endpoint="sales-tax-payments" columns={[{key:'txn_date',label:'Date'},{key:'total',label:'Amount',align:'right',format:'money'}]} />} />
            <Route path="/reports/vendor-1099-summary" element={<GenericReport title="1099 Vendor Summary" endpoint="vendor-1099-summary" useDateRange={false} columns={[{key:'display_name',label:'Vendor'},{key:'tax_id',label:'Tax ID'},{key:'total_paid',label:'Total Paid',align:'right',format:'money'}]} />} />
            <Route path="/reports/general-ledger" element={<GeneralLedgerReport />} />
            <Route path="/reports/trial-balance" element={<GenericReport title="Trial Balance" endpoint="trial-balance" useDateRange={true} columns={[{key:'account_number',label:'#'},{key:'name',label:'Account'},{key:'account_type',label:'Type'},{key:'total_debit',label:'Debit',align:'right',format:'money'},{key:'total_credit',label:'Credit',align:'right',format:'money'}]} />} />
            <Route path="/reports/transaction-list" element={<GenericReport title="Transaction List" endpoint="transaction-list" columns={[{key:'txn_date',label:'Date'},{key:'txn_type',label:'Type'},{key:'txn_number',label:'Number'},{key:'contact_name',label:'Contact'},{key:'total',label:'Amount',align:'right',format:'money'},{key:'memo',label:'Memo'}]} />} />
            <Route path="/reports/journal-entry-report" element={<GenericReport title="Journal Entries" endpoint="journal-entry-report" columns={[{key:'txn_date',label:'Date'},{key:'txn_number',label:'Number'},{key:'total',label:'Amount',align:'right',format:'money'},{key:'memo',label:'Memo'}]} />} />
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
      </BrowserRouter>
      </CompanyProvider>
      </DiagnosticRouter>
    </QueryClientProvider>
  );
}
