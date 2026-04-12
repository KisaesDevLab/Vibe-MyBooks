import { useState } from 'react';

interface ProviderInstructions {
  name: string;
  mode: 'A' | 'B';
  steps: string[];
  notes?: string[];
  fileExpected: string;
}

const PROVIDER_GUIDES: ProviderInstructions[] = [
  {
    name: 'Gusto',
    mode: 'A',
    steps: [
      'Log in to your Gusto admin dashboard.',
      'Click the Reports tab in the left-hand menu.',
      'Select Payroll Journal.',
      'Choose detail options (employee info, earnings breakdown, tax breakdown, deductions, etc.) as needed.',
      'Set the date range (Annually, Quarterly, Monthly, or Custom).',
      'Click Generate Report, then click Download and choose CSV as the format.',
      'Upload the downloaded CSV file here.',
    ],
    notes: [
      'The export contains one row per employee per pay period.',
      'Gusto splits state-specific taxes into individual columns (e.g. "CA SDI", "NY SIT"). These are automatically mapped to the appropriate tax fields.',
      'Gusto also offers PDF and Excel downloads — choose CSV for import.',
    ],
    fileExpected: 'CSV file with columns: Employee Name, Check Date, Gross Pay, Net Pay, Federal Income Tax, Social Security (Employee), etc.',
  },
  {
    name: 'ADP Run',
    mode: 'A',
    steps: [
      'Log in to RUN Powered by ADP.',
      'Hover over REPORTS in the top menu bar and select Payroll Detail (or Payroll Summary).',
      'Set the date range using the From and To pay period fields. Leave Name set to "All" to include all employees.',
      'Click Refresh to generate the report.',
      'Click Export to Excel to download the file.',
      'Upload the downloaded Excel file here.',
    ],
    notes: [
      'ADP exports often include 4-6 company header rows above the actual data. The system will attempt to auto-detect the header row, but you may need to adjust it in the Column Mapping step.',
      'Subtotal/Grand Total rows are automatically skipped.',
    ],
    fileExpected: 'Excel file with columns: File #, Employee Name, Check Date, Reg Earnings, OT Earnings, Gross, Federal W/H, State W/H, SS/EE, Med/EE, Net Pay, etc.',
  },
  {
    name: 'QuickBooks Online Payroll',
    mode: 'A',
    steps: [
      'Log in to QuickBooks Online.',
      'Go to Reports in the left navigation panel.',
      'Search for "Payroll Summary by Employee" (or "Payroll Summary") and select it.',
      'Set the date range for the pay period and click Apply to generate the report.',
      'Click the Export icon in the top-right corner and select Export to Excel.',
      'Upload the downloaded Excel file here.',
    ],
    notes: [
      'QBO prepends several metadata rows (company name, report title, date range). The header row is usually row 3-5. Adjust in the Column Mapping step if auto-detection misses it.',
      'QBO sometimes aggregates federal taxes into a single column rather than splitting FIT, SS, and Medicare.',
      'You can also access payroll reports via the Payroll menu > Reports tab.',
    ],
    fileExpected: 'Excel file with columns: Employee, Gross Pay, Adjusted Gross Pay, Federal Taxes, State Taxes, Net Pay, Employer Taxes and Contributions.',
  },
  {
    name: 'Paychex Flex',
    mode: 'A',
    steps: [
      'Log in to Paychex Flex.',
      'Go to Reporting and select the Payroll Register report (or use Custom Reporting to build a payroll report).',
      'Select the check date or pay period range.',
      'Click Run Report to generate the report.',
      'Click the Export icon and select Excel 2007+ to download.',
      'Upload the downloaded Excel file here.',
    ],
    notes: [
      'Paychex Flex exports as Excel by default. If you need CSV, open the Excel file and save as CSV before uploading.',
      'Paychex column names may vary depending on your company configuration. Adjust mappings in the Column Mapping step as needed.',
    ],
    fileExpected: 'Excel file with columns: EE Name, Check Date, Gross, Federal Withholding, State Withholding, Social Security/EE, Medicare/EE, Social Security/ER, Medicare/ER, FUTA, SUTA, Net.',
  },
  {
    name: 'Square Payroll',
    mode: 'A',
    steps: [
      'Log in to the Square Dashboard.',
      'Go to Staff > Payroll.',
      'Under Payroll history, click View all, then click Download reports.',
      'Select the report type — choose Paycheck Details for the most detailed export.',
      'Set the date range and select the team members to include.',
      'Click Download.',
      'Upload the downloaded file here.',
    ],
    notes: [
      'Square offers three report types: Paycheck Details (per-check breakdown), Employee Totals (aggregated per employee), and Company Totals (company-wide summary). Paycheck Details provides the most useful data for import.',
      'The Paycheck Details report includes individual tax line items (Federal Income Tax, Social Security, Medicare, State Income Tax). The Employee/Company Totals reports may aggregate taxes.',
      'Custom reports can only be downloaded from a computer, not the Square Team mobile app.',
    ],
    fileExpected: 'CSV file with columns: Employee Name, Pay Period Start, Pay Period End, Check Date, Gross Pay, Federal Income Tax, Social Security, Medicare, State Income Tax, Deductions, Net Pay.',
  },
  {
    name: 'Payroll Relief (AccountantsWorld)',
    mode: 'B',
    steps: [
      'Log in to Payroll Relief.',
      'Go to Integration > Export G/L to open the Export Payroll Transactions screen.',
      'Specify a date range in the From and To fields.',
      'Select a transaction type: General Journal Entries or Tax Payments and Employee Checks.',
      'Select the Generic format (CSV).',
      'Click View to preview the transactions within your selected date range.',
      'Click Export to download a zip file containing the export.',
      'Extract the zip and upload the CSV file(s) here. If the zip contains both a GL entries file and a checks file, drop both together.',
    ],
    notes: [
      'This is a Mode B (Pre-Built JE) import. The file contains balanced debit/credit journal entries grouped by pay date, not employee-level detail.',
      'Payroll Relief bundles General Journal Entries and Tax Payments/Employee Checks into a single zip file.',
      'You will need to map each description (e.g. "Wages and Salary", "Social Security Payable") to an account in your chart of accounts. Once mapped, these mappings are saved and automatically applied to future imports.',
      'If the export contains multiple pay dates, each date will generate a separate journal entry.',
      'Lines prefixed with "1099" (e.g. "1099 Wages and Salary") represent contractor payments and are handled separately.',
      'The optional checks file contains individual check/direct deposit records that can be posted as cash disbursement transactions.',
    ],
    fileExpected: 'Zipped CSV export from Integration > Export G/L. GL entries file with columns: Date, Reference, Account, Description, Debit, Credit, Memo. Optionally also a checks file with columns: Check Number, Date, Payee Name, Cash Account, Account, Amount, Memo.',
  },
  {
    name: 'Other / Custom Provider',
    mode: 'A',
    steps: [
      'Export your payroll data from your provider as a CSV or Excel file.',
      'The file should contain one row per employee per pay period.',
      'Upload the file here — the system will attempt to auto-detect the format.',
      'If auto-detection fails, you will manually map each column in the next step.',
    ],
    notes: [
      'At minimum, your file must contain columns for: Employee Name, Check Date (or Pay Date), Gross Pay, and Net Pay.',
      'Additional columns for tax withholdings, deductions, and employer taxes will produce a more detailed journal entry.',
      'You can save your custom column mapping as a reusable template for future imports.',
    ],
    fileExpected: 'CSV or Excel file with at least: employee name, pay date, gross pay, net pay.',
  },
];

export function ProviderGuide() {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div>
      <h3 className="text-sm font-medium text-gray-700 mb-3">
        How to Export from Your Payroll Provider
      </h3>
      <div className="space-y-1">
        {PROVIDER_GUIDES.map((guide) => (
          <div key={guide.name} className="border border-gray-200 rounded-lg overflow-hidden">
            <button
              className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
              onClick={() => setExpanded(expanded === guide.name ? null : guide.name)}
            >
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-gray-900">{guide.name}</span>
                <span className={`inline-flex px-1.5 py-0.5 rounded text-xs font-medium ${
                  guide.mode === 'A'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-purple-100 text-purple-700'
                }`}>
                  {guide.mode === 'A' ? 'Employee-Level' : 'Pre-Built JE'}
                </span>
              </div>
              <svg
                className={`w-4 h-4 text-gray-400 transition-transform ${expanded === guide.name ? 'rotate-180' : ''}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {expanded === guide.name && (
              <div className="px-4 pb-4 border-t border-gray-100">
                {/* Steps */}
                <div className="mt-3">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Steps</p>
                  <ol className="list-decimal list-inside space-y-1.5">
                    {guide.steps.map((step, i) => (
                      <li key={i} className="text-sm text-gray-700">{step}</li>
                    ))}
                  </ol>
                </div>

                {/* Expected file */}
                <div className="mt-3">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Expected File</p>
                  <p className="text-sm text-gray-600 bg-gray-50 rounded px-3 py-2 font-mono text-xs">
                    {guide.fileExpected}
                  </p>
                </div>

                {/* Notes */}
                {guide.notes && guide.notes.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Notes</p>
                    <ul className="space-y-1.5">
                      {guide.notes.map((note, i) => (
                        <li key={i} className="text-sm text-gray-600 flex gap-2">
                          <span className="text-gray-400 flex-shrink-0">&#8226;</span>
                          <span>{note}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
