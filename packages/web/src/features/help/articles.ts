export interface Article {
  id: string;
  title: string;
  category: string;
  summary: string;
  body: string;
}

export const categories = [
  'Getting Started',
  'Transactions',
  'Sales & Invoicing',
  'Banking',
  'Checks',
  'Reports',
  'Settings',
  'Security',
  'AI Processing',
  'API & Integrations',
  'Accounting Concepts',
] as const;

export const articles: Article[] = [
  // ─── Getting Started ──────────────────────────────────────────
  {
    id: 'setup-company',
    title: 'Setting Up Your Company',
    category: 'Getting Started',
    summary: 'How to configure your company profile, logo, and basic settings after registration.',
    body: `
## Setting Up Your Company

After registering your account, your company is created with default settings. Here's how to customize it:

### Company Profile
Navigate to **Settings > Company Profile** to update:
- **Business Name** and **Legal Name**
- **EIN / Tax ID** (used for 1099 reporting)
- **Address, Phone, Email, and Website**
- **Company Logo** — upload a PNG or JPEG image, displayed on invoices

### Preferences
Go to **Settings > Preferences** to configure:
- **Fiscal Year Start** — the month your fiscal year begins (default: January)
- **Accounting Method** — Accrual or Cash basis
- **Default Sales Tax Rate**
- **Currency** — 3-letter code (USD, EUR, GBP, etc.)
- **Category Filter Mode** — choose whether transaction forms show all accounts or only type-relevant ones

### Chart of Accounts
Your company is seeded with a default Chart of Accounts. You can customize it under **Chart of Accounts** in the sidebar:
- Add new accounts as needed
- Edit account names and numbers
- System accounts (marked with a lock icon) cannot be deleted

### Next Steps
Once your company is configured, you can start recording transactions, setting up contacts, and creating invoices.
`,
  },
  {
    id: 'understanding-dashboard',
    title: 'Understanding the Dashboard',
    category: 'Getting Started',
    summary: 'A guide to the dashboard widgets and what the key metrics mean.',
    body: `
## Understanding the Dashboard

The Dashboard gives you a quick overview of your company's financial health.

### Key Metrics
- **Total Income** — sum of all revenue transactions for the selected period
- **Total Expenses** — sum of all expense transactions for the selected period
- **Net Income** — income minus expenses (profit or loss)
- **Bank Balance** — current balance across all bank accounts

### Charts
- **Income vs. Expenses** — a bar chart comparing monthly income and expenses over the last 12 months
- **Expense Breakdown** — a pie chart showing expenses by category

### Recent Transactions
The bottom section shows your most recent transactions for quick reference. Click any transaction to view its details.

### Tips
- The dashboard reflects data for the **active company** shown in the company switcher at the top of the sidebar
- All amounts are in your company's configured currency
- Click on any metric card to navigate to the relevant report
`,
  },
  {
    id: 'chart-of-accounts',
    title: 'Chart of Accounts Basics',
    category: 'Getting Started',
    summary: 'Learn about account types, how they are organized, and how to add new accounts.',
    body: `
## Chart of Accounts Basics

The Chart of Accounts (COA) is the foundation of your bookkeeping. It lists every account where financial activity is recorded.

### Account Types
Vibe MyBooks uses these standard account types:

| Type | Normal Balance | Examples |
|------|---------------|----------|
| **Asset** | Debit | Cash, Accounts Receivable, Equipment |
| **Liability** | Credit | Accounts Payable, Loans, Credit Cards |
| **Equity** | Credit | Owner's Equity, Retained Earnings |
| **Revenue** | Credit | Sales, Service Revenue, Interest Income |
| **Expense** | Debit | Rent, Utilities, Office Supplies |

### Adding an Account
1. Go to **Chart of Accounts** in the sidebar
2. Click **Add Account**
3. Enter the account number, name, and type
4. Optionally add a description and parent account (for sub-accounts)

### System Accounts
Some accounts are created automatically and marked as system accounts. These cannot be deleted or have their type changed because other features depend on them (e.g., Accounts Receivable, Accounts Payable, Retained Earnings).

### Account Numbers
Account numbers help organize your COA. A common numbering scheme:
- **1000-1999** — Assets
- **2000-2999** — Liabilities
- **3000-3999** — Equity
- **4000-4999** — Revenue
- **5000-6999** — Expenses
`,
  },
  {
    id: 'multi-company',
    title: 'Managing Multiple Companies',
    category: 'Getting Started',
    summary: 'How to add and switch between companies under a single login.',
    body: `
## Managing Multiple Companies

Vibe MyBooks supports multiple companies under a single user account — ideal for freelancers with side businesses or CPAs managing clients.

### Adding a Company
1. Click the **company switcher** at the top of the sidebar
2. Click **+ Add Company**
3. Enter the business name, entity type, and industry
4. The new company is created with its own Chart of Accounts

### Switching Companies
- Click the **company switcher** dropdown in the sidebar
- Select the company you want to work in
- All data (transactions, contacts, invoices, reports) updates immediately — no re-login needed

### Company Isolation
Each company has completely separate data:
- Its own Chart of Accounts, contacts, transactions, and invoices
- Its own email (SMTP) settings
- Its own preferences (fiscal year, tax rate, etc.)

Data from one company is never visible in another.
`,
  },

  // ─── Transactions ─────────────────────────────────────────────
  {
    id: 'recording-transactions',
    title: 'Recording Transactions',
    category: 'Transactions',
    summary: 'How to create expenses, deposits, transfers, journal entries, and cash sales.',
    body: `
## Recording Transactions

Vibe MyBooks supports several transaction types. Navigate to **Transactions** and click **New Transaction** to choose one.

### Transaction Types

**Expense**
Record a payment for goods or services. Select the bank/credit card account it was paid from, a vendor (contact), category (expense account), and amount.

**Deposit**
Record money received into a bank account. This could be a customer payment, owner contribution, or other income.

**Transfer**
Move money between two accounts (e.g., checking to savings). Both sides are recorded automatically.

**Journal Entry**
The most flexible type — manually specify debit and credit lines. Used for adjustments, corrections, and complex transactions. Debits must equal credits.

**Cash Sale**
Record an immediate sale with payment received (no invoice). Useful for retail or one-time sales.

### Common Fields
- **Date** — when the transaction occurred
- **Contact** — the vendor or customer (optional)
- **Category** — the account to classify the transaction
- **Memo** — a note for your reference
- **Tags** — optional labels for extra categorization

### Editing & Voiding
- Click any transaction to view its details and journal lines
- Use **Void** to reverse a transaction (creates offsetting entries — the original is never deleted)
`,
  },
  {
    id: 'batch-entry',
    title: 'Using Batch Entry',
    category: 'Transactions',
    summary: 'Quickly enter multiple transactions at once using the batch entry screen.',
    body: `
## Using Batch Entry

Batch Entry lets you enter multiple transactions quickly in a spreadsheet-like grid.

### How to Use
1. Go to **Transactions > Batch Entry** in the sidebar
2. Each row is a transaction — fill in the date, type, contact, category, amount, and memo
3. Use **Tab** to move between fields and **Enter** to advance to the next row
4. Click **Save All** when done

### Tips
- The grid starts with 10 rows. Click **Add Rows** to add more
- **Contact dropdown** supports type-to-search — start typing to filter
- **Category dropdown** filters based on the selected transaction type
- If a contact has a **default category** set, selecting that contact auto-fills the category
- All transactions in a batch are validated before saving — if any row has errors, none are saved

### When to Use Batch Entry
- Entering a stack of receipts or invoices at once
- Monthly data entry from paper records
- Migrating historical transactions from another system
`,
  },
  {
    id: 'recurring-transactions',
    title: 'Setting Up Recurring Transactions',
    category: 'Transactions',
    summary: 'Automate repeating transactions like rent, subscriptions, or monthly invoices.',
    body: `
## Setting Up Recurring Transactions

Recurring transactions automatically create new transactions on a schedule.

### Creating a Recurring Transaction
1. Go to **Recurring** in the sidebar
2. Click **New Recurring Transaction**
3. Fill in the transaction template (type, accounts, amount, contact)
4. Set the **frequency**: daily, weekly, monthly, or yearly
5. Set the **start date** and optionally an **end date**
6. Choose whether to **auto-post** or create as draft for review

### Managing Recurring Transactions
- **Pause** — temporarily stop a recurring transaction without deleting it
- **Edit** — change the template, frequency, or schedule
- **Delete** — permanently remove the recurring transaction (previously created transactions are not affected)

### How It Works
The system checks for due recurring transactions periodically. When one is due:
- If **auto-post** is enabled, the transaction is created and posted automatically
- If not, a draft transaction is created for you to review and post manually

### Common Uses
- Monthly rent or mortgage payments
- Subscription services (software, utilities)
- Regular payroll entries
- Monthly depreciation entries
`,
  },
  {
    id: 'duplicates',
    title: 'Finding and Merging Duplicates',
    category: 'Transactions',
    summary: 'How the duplicate detection system works and how to review flagged transactions.',
    body: `
## Finding and Merging Duplicates

When importing bank transactions, Vibe MyBooks automatically flags potential duplicates.

### How Detection Works
The system compares incoming transactions against existing ones based on:
- **Amount** — exact match
- **Date** — within a few days of each other
- **Contact** — if both reference the same vendor/customer

### Reviewing Duplicates
1. Go to **Duplicates** in the sidebar
2. Each flagged pair shows both transactions side by side
3. Choose one of:
   - **Merge** — keep one transaction, delete the other
   - **Dismiss** — mark as not a duplicate (they won't be flagged again)

### Tips
- Review duplicates regularly, especially after importing bank data
- Dismissed pairs are remembered — the same pair won't be flagged again
- If you accidentally merge the wrong transactions, you can void the remaining one and re-enter both
`,
  },
  {
    id: 'registers',
    title: 'Using Account Registers',
    category: 'Transactions',
    summary: 'View transaction history for any account in a register-style view.',
    body: `
## Using Account Registers

A register shows all transactions for a specific account in chronological order, similar to a checkbook register.

### Accessing Registers
- Go to **Registers** in the sidebar to see a list of all accounts with their balances
- Click any account to open its register
- Alternatively, from **Chart of Accounts**, click the register icon next to any account

### Register View
Each register shows:
- **Date** — transaction date
- **Type** — expense, deposit, transfer, etc.
- **Description / Memo** — what the transaction is for
- **Debit / Credit** — the amount affecting this account
- **Running Balance** — the account balance after each transaction

### Filtering
- Use the **date range** filter to narrow the view
- Search by memo or transaction number
- Filter by transaction type

### Tips
- The running balance helps you verify your records match bank statements
- Click any transaction row to view its full details
- Bank account registers are especially useful for reconciliation preparation
`,
  },

  // ─── Sales & Invoicing ────────────────────────────────────────
  {
    id: 'creating-invoices',
    title: 'Creating and Sending Invoices',
    category: 'Sales & Invoicing',
    summary: 'How to create professional invoices and send them to customers.',
    body: `
## Creating and Sending Invoices

Invoices track money owed to you by customers.

### Creating an Invoice
1. Go to **Invoices** in the sidebar
2. Click **New Invoice**
3. Select a **customer** (contact)
4. Add line items — either by **category** (revenue account) or **item** (from your items catalog)
5. Set the **invoice date**, **due date**, and **payment terms**
6. Add an optional **memo** or **notes**
7. Click **Save**

### Line Items
Each line has:
- **Description** — what you're billing for
- **Quantity** and **Rate** — multiplied to calculate the line total
- **Account** — the revenue account to credit

### Sending Invoices
- Click **Send** on any invoice to email it as a PDF to the customer
- Requires **email (SMTP)** to be configured in **Settings > Email Settings**
- The PDF uses your invoice template (customizable under **Settings > Invoice Template**)

### Invoice Statuses
- **Draft** — not yet finalized
- **Sent** — emailed to the customer
- **Paid** — fully paid
- **Partial** — partially paid
- **Overdue** — past the due date with balance remaining
- **Void** — cancelled

### Payment Terms
Default payment terms are set in **Settings > Preferences** but can be overridden per invoice. Options include Net 15, Net 30, Net 60, Due on Receipt, and more.
`,
  },
  {
    id: 'receiving-payments',
    title: 'Receiving Payments',
    category: 'Sales & Invoicing',
    summary: 'How to record payments received against outstanding invoices.',
    body: `
## Receiving Payments

When a customer pays an invoice, record it using Receive Payment.

### Recording a Payment
1. Go to **Receive Payment** in the sidebar
2. Select the **customer**
3. All outstanding invoices for that customer are listed
4. Enter the **payment amount** and **date**
5. Check which invoices the payment applies to
6. Select the **deposit to** account (usually a Payments Clearing or bank account)
7. Click **Save**

### Partial Payments
If a customer pays less than the full invoice amount:
- Enter the actual amount received
- The system applies it to the selected invoices
- The remaining balance stays on the invoice as "Partial" status

### Payments Clearing Account
By default, received payments go to a **Payments Clearing** account rather than directly to the bank. This mirrors real-world practice where multiple payments may be deposited together.

To move money from Payments Clearing to the bank, use **Bank Deposit** (under Banking).

### Tips
- Payment confirmation emails are sent automatically if SMTP is configured
- You can also apply payments when editing an invoice directly
`,
  },
  {
    id: 'managing-items',
    title: 'Managing Items and Products',
    category: 'Sales & Invoicing',
    summary: 'Set up products and services for faster invoice creation.',
    body: `
## Managing Items and Products

Items are products or services you sell. Using items speeds up invoice creation by pre-filling descriptions, rates, and accounts.

### Adding an Item
1. Go to **Items** in the sidebar
2. Click **Add Item**
3. Fill in:
   - **Name** — the item name shown on invoices
   - **Description** — detailed description
   - **Rate** — the default price
   - **Account** — the revenue account to credit when sold
   - **Type** — Service, Inventory, or Non-inventory

### Using Items on Invoices
When creating an invoice:
1. Set the line entry mode to **Item** (or toggle per line)
2. Select an item from the dropdown
3. The description, rate, and account auto-fill
4. Adjust the quantity as needed

### Tips
- Set **Default Invoice Line Entry Mode** in **Settings > Preferences** to default to items instead of categories
- Items can also be used on Cash Sales
- Edit an item to update its rate — existing invoices are not affected
`,
  },

  // ─── Banking ──────────────────────────────────────────────────
  {
    id: 'bank-connections',
    title: 'Connecting Bank Accounts',
    category: 'Banking',
    summary: 'How to connect your bank for automatic transaction imports.',
    body: `
## Connecting Bank Accounts

Vibe MyBooks can import transactions from your bank automatically.

### Setting Up a Connection
1. Go to **Banking** in the sidebar
2. Click **Connect Bank**
3. Search for your bank and log in with your banking credentials
4. Select which accounts to connect
5. Transactions are imported automatically

### Manual Import
If your bank isn't supported for automatic connection:
1. Download a statement from your bank (CSV, OFX, or QFX format)
2. Go to **Banking** and click **Import**
3. Upload the file and map the columns
4. Review and accept the imported transactions

### Bank Feed
Imported transactions appear in the **Bank Feed** where you can:
- **Match** them to existing transactions in Vibe MyBooks
- **Create** new transactions from them
- **Categorize** them with the correct accounts

### Tips
- Bank rules can automatically categorize recurring transactions (see Bank Rules article)
- Review the bank feed regularly to keep your books up to date
- Connected accounts sync automatically on a schedule
`,
  },
  {
    id: 'bank-reconciliation',
    title: 'Bank Reconciliation',
    category: 'Banking',
    summary: 'How to reconcile your books against your bank statement.',
    body: `
## Bank Reconciliation

Reconciliation ensures your books match your bank statement.

### Starting a Reconciliation
1. Go to **Banking** in the sidebar
2. Click **Reconcile** on the account you want to reconcile
3. Enter the **statement date** and **statement ending balance** from your bank statement

### Reconciliation Process
1. A list of uncleared transactions appears
2. Check off each transaction that appears on your bank statement
3. The **difference** field shows the gap between your cleared balance and the statement balance
4. When the difference is **$0.00**, your books are reconciled
5. Click **Finish** to save

### Tips
- Start with the most recent statement and work backwards if you've never reconciled
- If the difference isn't zero, look for:
  - Transactions in your books that aren't on the statement (timing differences)
  - Transactions on the statement that aren't in your books (missing entries)
  - Amount discrepancies
- Reconciliation history is saved — you can review past reconciliations under **Banking > Reconciliation History**
- Never delete or modify transactions that have been reconciled
`,
  },
  {
    id: 'bank-rules',
    title: 'Setting Up Bank Rules',
    category: 'Banking',
    summary: 'Automate transaction categorization with rules that match bank feed descriptions.',
    body: `
## Setting Up Bank Rules

Bank rules automatically categorize transactions imported from your bank, saving time on repetitive data entry.

### Creating a Rule
1. Go to **Bank Rules** in the sidebar
2. Click **Add Rule**
3. Set the **conditions** — match on description, amount, or both
4. Set the **actions** — assign a category (account), contact, memo, and/or tags
5. Choose the **priority** — rules are evaluated in order; first match wins

### Condition Types
- **Description contains** — matches if the bank description includes the text
- **Description equals** — exact match only
- **Amount equals** — matches a specific amount
- **Amount between** — matches a range

### How Rules Apply
When new bank feed transactions arrive:
1. Each transaction is checked against your rules (highest priority first)
2. The first matching rule auto-fills the category, contact, and other fields
3. You review and confirm in the bank feed before posting

### Tips
- Create rules for recurring charges (rent, subscriptions, payroll)
- Use specific descriptions to avoid false matches
- Rules are evaluated before AI categorization, so they take priority
`,
  },
  {
    id: 'bank-deposits',
    title: 'Making Bank Deposits',
    category: 'Banking',
    summary: 'How to group multiple payments into a single bank deposit.',
    body: `
## Making Bank Deposits

Bank Deposit lets you combine multiple received payments into a single deposit, matching how deposits work at the bank.

### Why Use Bank Deposit?
When you receive multiple checks or payments, you typically deposit them together at the bank as one lump sum. Bank Deposit lets you record this accurately:
- Individual payments stay as separate transactions
- The bank deposit groups them to match the single amount on your bank statement
- This makes bank reconciliation much easier

### Creating a Deposit
1. Go to **Bank Deposit** in the sidebar
2. Undeposited funds (in Payments Clearing) are listed
3. Check the payments you're depositing together
4. Select the **bank account** to deposit into
5. The total is calculated automatically
6. Click **Save**

### Tips
- Always use **Receive Payment** first, then deposit — don't record income directly to the bank account
- The Payments Clearing account should have a zero balance once all received payments are deposited
`,
  },

  // ─── Checks ───────────────────────────────────────────────────
  {
    id: 'writing-checks',
    title: 'Writing Checks',
    category: 'Checks',
    summary: 'How to record check payments in Vibe MyBooks.',
    body: `
## Writing Checks

The Write Check feature records a payment by check, creating the proper accounting entries.

### Writing a Check
1. Go to **Write Check** in the sidebar
2. Select the **bank account** the check is drawn from
3. Enter the **payee** (contact), **date**, and **check number**
4. Add line items with categories and amounts
5. Click **Save**

### What Happens
- A transaction is created debiting the expense account(s) and crediting the bank account
- The check number is recorded for reference
- The transaction appears in the bank account register

### Tips
- Check numbers auto-increment based on your check settings
- You can write checks to any contact type (vendor, employee, etc.)
- For checks you've already written physically, still record them here to keep your books accurate
`,
  },
  {
    id: 'printing-checks',
    title: 'Printing Checks',
    category: 'Checks',
    summary: 'How to print checks on blank or pre-printed check stock.',
    body: `
## Printing Checks

Vibe MyBooks can print checks on standard check stock.

### Setup
Before printing, configure your check settings at **Settings > Check Printing**:
- **Check format** — Voucher (full page with stub) or Standard (3-per-page)
- **Bank information** — bank name, address, routing number, account number
- **Company info** — whether to print your company name and address
- **Alignment** — fine-tune horizontal and vertical offsets to align with your check stock

### Printing
1. Go to **Print Checks** in the sidebar
2. Unprinted checks are listed
3. Select the checks you want to print
4. Click **Print** — a PDF is generated for your printer
5. After printing, confirm which checks printed correctly

### Tips
- Print a test page on plain paper first to verify alignment
- If a check didn't print correctly, you can re-queue it
- The check number on the physical stock should match the number in the system
`,
  },

  // ─── Reports ──────────────────────────────────────────────────
  {
    id: 'running-reports',
    title: 'Running Reports',
    category: 'Reports',
    summary: 'Overview of available reports and how to filter and export them.',
    body: `
## Running Reports

Navigate to **Reports** in the sidebar to see all available reports organized by category.

### Report Categories
- **Financial Statements** — Profit & Loss, Balance Sheet, Cash Flow
- **Accounts Receivable** — AR Aging, Customer Balances, Invoice List
- **Accounts Payable** — Expense by Vendor, Vendor Balances, Transactions by Vendor
- **Banking** — Reconciliation Summary, Deposit Detail, Check Register
- **Tax** — Sales Tax Liability, Taxable Sales, 1099 Summary
- **Accounting** — General Ledger, Trial Balance, Transaction List, Journal Entries
- **Budgets** — Budget vs. Actual

### Filtering Reports
Most reports support:
- **Date Range** — select a start and end date
- **As-of Date** — for point-in-time reports like Balance Sheet and Trial Balance
- **Comparison** — compare to prior period or prior year

### Exporting
- Reports can be exported to **CSV** for further analysis in a spreadsheet
- Use **Settings > Export Data** for bulk data exports
`,
  },
  {
    id: 'profit-and-loss',
    title: 'Profit & Loss Report',
    category: 'Reports',
    summary: 'Understanding the Profit & Loss (Income Statement) report.',
    body: `
## Profit & Loss Report

The Profit & Loss (P&L) report, also called an Income Statement, shows your revenue, expenses, and net income for a period.

### Sections
1. **Income** — all revenue account totals
2. **Cost of Goods Sold** — direct costs (if applicable)
3. **Gross Profit** — income minus COGS
4. **Expenses** — all expense account totals
5. **Net Income** — gross profit minus expenses

### How to Read It
- Positive net income means you're profitable for the period
- Negative net income (net loss) means expenses exceeded revenue
- Compare periods to identify trends

### Options
- **Date Range** — choose the reporting period
- **Comparative** — add a column for the prior period or prior year
- **Cash vs. Accrual** — reports use your company's accounting method setting

### Tips
- Run this report monthly to track business performance
- Large changes in any category warrant investigation
- The P&L is one of the most important reports for tax preparation
`,
  },
  {
    id: 'balance-sheet',
    title: 'Balance Sheet Report',
    category: 'Reports',
    summary: 'Understanding the Balance Sheet report.',
    body: `
## Balance Sheet Report

The Balance Sheet shows your company's financial position at a specific point in time.

### The Accounting Equation
**Assets = Liabilities + Equity**

The Balance Sheet must always balance — total assets must equal total liabilities plus equity.

### Sections
1. **Assets** — what you own (cash, receivables, equipment)
2. **Liabilities** — what you owe (payables, loans, credit cards)
3. **Equity** — the owner's stake (contributions, retained earnings)

### How to Read It
- **Current Assets** (cash, receivables) show your short-term liquidity
- **Current Liabilities** (payables, credit cards) show your short-term obligations
- **Working Capital** = Current Assets - Current Liabilities
- **Retained Earnings** accumulates your net income over time

### Tips
- Run as of the end of each month or quarter
- Compare to prior periods to track growth
- If the balance sheet doesn't balance, there may be a data entry error — check the Trial Balance report
`,
  },
  {
    id: 'budget-vs-actual',
    title: 'Budget vs. Actual Report',
    category: 'Reports',
    summary: 'How to create budgets and compare them to actual spending.',
    body: `
## Budget vs. Actual

The Budget vs. Actual report compares your planned spending to what actually happened.

### Setting Up a Budget
1. Go to **Budgets** in the sidebar
2. Click **New Budget** or edit an existing one
3. Select the **year** for the budget
4. Enter monthly amounts for each account
5. Click **Save**

### Running the Report
1. Go to **Reports > Budget vs. Actual**
2. Select the budget and date range
3. The report shows three columns per account:
   - **Budget** — what you planned
   - **Actual** — what was recorded
   - **Variance** — the difference (favorable or unfavorable)

### Tips
- Start with your largest expense categories
- Update budgets quarterly if your business changes significantly
- Use the variance column to identify areas that need attention
`,
  },

  // ─── Settings ─────────────────────────────────────────────────
  {
    id: 'email-smtp-setup',
    title: 'Configuring Email (SMTP)',
    category: 'Settings',
    summary: 'How to set up outbound email for sending invoices and notifications.',
    body: `
## Configuring Email (SMTP)

Email settings allow Vibe MyBooks to send invoices, payment reminders, and payment confirmations.

### Setup
1. Go to **Settings > Email (SMTP)**
2. Enter your SMTP server details:
   - **Host** — your email provider's SMTP server (e.g., smtp.gmail.com)
   - **Port** — usually 587 (TLS) or 465 (SSL)
   - **Username** — your email login
   - **Password** — your email password or app-specific password
   - **From Address** — the email address that appears as the sender
3. Click **Test Connection** to verify
4. Click **Save Email Settings**

### Per-Company Settings
SMTP is configured per company. Each company can use its own email server so invoices and notifications come from the correct sender address.

### Common SMTP Providers
| Provider | Host | Port |
|----------|------|------|
| Gmail | smtp.gmail.com | 587 |
| Outlook/365 | smtp.office365.com | 587 |
| Yahoo | smtp.mail.yahoo.com | 587 |
| Amazon SES | email-smtp.us-east-1.amazonaws.com | 587 |

### Gmail Notes
If using Gmail, you'll need an **App Password** (not your regular password):
1. Enable 2-factor authentication on your Google account
2. Go to Security > App Passwords
3. Generate a password for "Mail"
4. Use that password in the SMTP settings
`,
  },
  {
    id: 'tags-categorization',
    title: 'Using Tags',
    category: 'Settings',
    summary: 'Organize transactions with custom tags for flexible categorization.',
    body: `
## Using Tags

Tags provide an extra dimension of categorization beyond accounts. Use them to track projects, departments, locations, or any custom grouping.

### Tag Groups
Tags are organized into groups. For example:
- **Department** — Sales, Marketing, Engineering
- **Project** — Project Alpha, Project Beta
- **Location** — Office, Remote, Field

### Creating Tags
1. Go to **Tags** in the sidebar (or **Settings > Tags**)
2. Create a **Tag Group** first (e.g., "Department")
3. Add tags within the group (e.g., "Sales", "Marketing")

### Applying Tags
- When creating or editing any transaction, you'll see a **Tags** field
- Select one or more tags from any group
- Tags are optional — you can use them on some transactions and not others

### Reporting
Tags can be used to filter and group reports, giving you insights like:
- Total expenses by department
- Revenue by project
- Spending by location
`,
  },
  {
    id: 'backup-restore',
    title: 'Backup and Restore',
    category: 'Settings',
    summary: 'How to create backups and restore your data.',
    body: `
## Backup and Restore

Regular backups protect your financial data against accidental loss.

### Creating a Backup
1. Go to **Settings > Backup & Restore**
2. Click **Create Backup**
3. A database snapshot is created and available for download

### Restoring from Backup
1. Go to **Settings > Backup & Restore**
2. Click **Restore**
3. Select a backup file
4. Confirm the restore — **this replaces all current data**

### Automatic Backups
The system administrator can configure automatic backup schedules under **Admin > System Settings**:
- **Daily** — backup every day
- **Weekly** — backup every week
- **Monthly** — backup every month

### Tips
- Always create a backup before making major changes (importing data, year-end close, etc.)
- Store backup files in a separate location (external drive, cloud storage)
- Test restoring a backup periodically to ensure they work
`,
  },
  {
    id: 'exporting-data',
    title: 'Exporting Data',
    category: 'Settings',
    summary: 'How to export your transactions, contacts, and accounts to CSV.',
    body: `
## Exporting Data

Export your data for use in spreadsheets, tax preparation, or migration to another system.

### Available Exports
Go to **Settings > Export Data** to export:
- **Transactions** — all transactions with full details
- **Contacts** — customer and vendor list
- **Chart of Accounts** — full account list with balances

### Format
All exports are in **CSV** format, which can be opened in:
- Microsoft Excel
- Google Sheets
- LibreOffice Calc
- Any text editor

### Tips
- Use date filters to export specific periods
- Export before year-end for tax preparation
- The audit log is also available for export to track all changes
`,
  },

  // ─── Accounting Concepts ──────────────────────────────────────
  {
    id: 'double-entry-accounting',
    title: 'Double-Entry Accounting',
    category: 'Accounting Concepts',
    summary: 'The fundamental principle behind Vibe MyBooks and all professional bookkeeping.',
    body: `
## Double-Entry Accounting

Vibe MyBooks uses double-entry accounting — the standard for all professional bookkeeping.

### The Core Principle
Every transaction affects at least two accounts. For every debit, there must be an equal and opposite credit. This ensures your books always balance.

### Example: Paying Rent
When you pay $1,000 rent by check:
- **Debit** Rent Expense $1,000 (expense increases)
- **Credit** Checking Account $1,000 (asset decreases)

The total debits ($1,000) equal the total credits ($1,000).

### Example: Receiving Payment
When a customer pays a $500 invoice:
- **Debit** Payments Clearing $500 (asset increases)
- **Credit** Accounts Receivable $500 (asset decreases)

### Why It Matters
- **Accuracy** — errors are caught because the books must balance
- **Completeness** — every transaction is fully recorded
- **Auditability** — there's always a trail showing where money came from and went

### Don't Worry
Vibe MyBooks handles the debits and credits automatically. When you record an expense, deposit, or invoice, the system creates the correct journal entries behind the scenes. You only need to understand double-entry if you're creating manual journal entries.
`,
  },
  {
    id: 'account-types-explained',
    title: 'Account Types Explained',
    category: 'Accounting Concepts',
    summary: 'What each account type means and how they interact.',
    body: `
## Account Types Explained

Understanding account types helps you categorize transactions correctly.

### Assets (what you own)
Money and things of value. Includes bank accounts, accounts receivable, equipment, and inventory.
- **Normal balance: Debit**
- Increases with debits, decreases with credits

### Liabilities (what you owe)
Debts and obligations. Includes accounts payable, credit cards, loans, and taxes owed.
- **Normal balance: Credit**
- Increases with credits, decreases with debits

### Equity (owner's stake)
The owner's investment in the business plus accumulated profits.
- **Normal balance: Credit**
- Includes Owner's Equity, Owner's Draw, and Retained Earnings

### Revenue (money earned)
Income from sales and services.
- **Normal balance: Credit**
- Increases with credits (when you make a sale)

### Expenses (money spent)
Costs of running the business.
- **Normal balance: Debit**
- Increases with debits (when you incur a cost)

### The Relationship
At any point in time: **Assets = Liabilities + Equity + (Revenue - Expenses)**

Revenue and expenses eventually flow into Retained Earnings (equity) at year-end, keeping the fundamental equation in balance.
`,
  },
  {
    id: 'debits-and-credits',
    title: 'Understanding Debits and Credits',
    category: 'Accounting Concepts',
    summary: 'A simple guide to when accounts are debited vs. credited.',
    body: `
## Understanding Debits and Credits

Debits and credits can be confusing at first. Here's a simple reference.

### Quick Reference

| Account Type | Debit (+) | Credit (-) |
|-------------|-----------|------------|
| **Asset** | Increase | Decrease |
| **Expense** | Increase | Decrease |
| **Liability** | Decrease | Increase |
| **Revenue** | Decrease | Increase |
| **Equity** | Decrease | Increase |

### Memory Aid
**DEA-LER**: **D**ebits increase **E**xpenses and **A**ssets. Credits increase **L**iabilities, **E**quity, and **R**evenue.

### Common Transactions

**You buy office supplies for $50 cash:**
| Account | Debit | Credit |
|---------|-------|--------|
| Office Supplies (Expense) | $50 | |
| Checking (Asset) | | $50 |

**A customer pays you $200:**
| Account | Debit | Credit |
|---------|-------|--------|
| Checking (Asset) | $200 | |
| Sales Revenue | | $200 |

**You take out a $5,000 loan:**
| Account | Debit | Credit |
|---------|-------|--------|
| Checking (Asset) | $5,000 | |
| Bank Loan (Liability) | | $5,000 |

### In Vibe MyBooks
You rarely need to think about debits and credits directly. The transaction forms (Expense, Deposit, Invoice, etc.) handle this automatically. Debits and credits only come into play when creating **Journal Entries**.
`,
  },

  // ─── API & Integrations ───────────────────────────────────
  {
    id: 'api-getting-started',
    title: 'Getting Started with the API',
    category: 'API & Integrations',
    summary: 'How to authenticate and make your first API call.',
    body: `
## Getting Started with the API

Vibe MyBooks provides a REST API (v2) for external integrations, automation, and custom reporting.

### Base URL
All API v2 endpoints are under:
\`\`\`
https://your-server/api/v2/
\`\`\`

### Authentication

Two authentication methods are supported:

**API Key (recommended for integrations):**
1. Go to **Settings > API Keys**
2. Click **Generate Key**
3. Copy the key (shown only once)
4. Include it in every request:
\`\`\`
X-API-Key: sk_live_abc123...
\`\`\`

**JWT Bearer Token (for web/mobile apps):**
1. Call \`POST /api/v1/auth/login\` with email and password
2. Use the returned \`accessToken\`:
\`\`\`
Authorization: Bearer eyJhbG...
\`\`\`

### Your First API Call

Test your authentication:
\`\`\`
curl -H "X-API-Key: sk_live_your_key" https://your-server/api/v2/me
\`\`\`

This returns your user info, active tenant, and companies.

### Rate Limiting
- **100 requests per minute** per API key
- Exceeding the limit returns HTTP 429

### Interactive Documentation
Full Swagger documentation with "Try it out" is available at:
\`\`\`
https://your-server/api/docs/
\`\`\`
`,
  },
  {
    id: 'api-endpoints-reference',
    title: 'API Endpoints Reference',
    category: 'API & Integrations',
    summary: 'Complete list of available API v2 endpoints.',
    body: `
## API Endpoints Reference

### Context
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/v2/me | Current user, tenant, and companies |
| GET | /api/v2/tenants | List accessible tenants |
| POST | /api/v2/tenants/switch | Switch active tenant |

### Chart of Accounts
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/v2/accounts | List all accounts |
| GET | /api/v2/accounts/:id | Get account detail |
| POST | /api/v2/accounts | Create an account |

### Contacts
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/v2/contacts | List contacts |
| GET | /api/v2/contacts/:id | Get contact detail |
| POST | /api/v2/contacts | Create a contact |

### Transactions
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/v2/transactions | List/search transactions |
| GET | /api/v2/transactions/:id | Get transaction with journal lines |
| POST | /api/v2/transactions | Create transaction (expense, deposit, transfer, journal entry, cash sale) |

### Invoices
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/v2/invoices | List invoices |
| GET | /api/v2/invoices/:id | Get invoice detail |
| POST | /api/v2/invoices | Create invoice |
| PUT | /api/v2/invoices/:id | Update invoice |

### Items
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/v2/items | List items/products |
| POST | /api/v2/items | Create item |

### Reports
| Method | Endpoint | Parameters |
|--------|----------|------------|
| GET | /api/v2/reports/trial-balance | start_date, end_date |
| GET | /api/v2/reports/profit-loss | start_date, end_date, basis |
| GET | /api/v2/reports/balance-sheet | as_of_date, basis |
| GET | /api/v2/reports/cash-flow | start_date, end_date |
| GET | /api/v2/reports/general-ledger | start_date, end_date |
`,
  },
  {
    id: 'api-creating-transactions',
    title: 'Creating Transactions via API',
    category: 'API & Integrations',
    summary: 'How to create expenses, deposits, transfers, and journal entries through the API.',
    body: `
## Creating Transactions via API

Use \`POST /api/v2/transactions\` with a \`txnType\` field to specify the transaction type.

### Expense
\`\`\`json
{
  "txnType": "expense",
  "txnDate": "2026-04-01",
  "payFromAccountId": "uuid-of-bank-account",
  "contactId": "uuid-of-vendor",
  "memo": "Office supplies",
  "lines": [
    { "expenseAccountId": "uuid-of-expense-account", "amount": "150.00", "description": "Paper and ink" }
  ]
}
\`\`\`

### Deposit
\`\`\`json
{
  "txnType": "deposit",
  "txnDate": "2026-04-01",
  "depositToAccountId": "uuid-of-bank-account",
  "revenueAccountId": "uuid-of-revenue-account",
  "amount": "500.00",
  "memo": "Client payment"
}
\`\`\`

### Transfer
\`\`\`json
{
  "txnType": "transfer",
  "txnDate": "2026-04-01",
  "fromAccountId": "uuid-checking",
  "toAccountId": "uuid-savings",
  "amount": "1000.00"
}
\`\`\`

### Journal Entry
\`\`\`json
{
  "txnType": "journal_entry",
  "txnDate": "2026-04-01",
  "memo": "Depreciation entry",
  "lines": [
    { "accountId": "uuid-depreciation-expense", "debit": "500.00", "credit": "0" },
    { "accountId": "uuid-accum-depreciation", "debit": "0", "credit": "500.00" }
  ]
}
\`\`\`

### Important Notes
- All transactions must balance (total debits = total credits)
- Amounts are strings to preserve decimal precision
- Transactions respect the lock date — dates on or before the lock date are rejected
- The response includes the created transaction with its ID and journal lines
`,
  },
  {
    id: 'api-reports',
    title: 'Pulling Reports via API',
    category: 'API & Integrations',
    summary: 'How to retrieve financial reports programmatically.',
    body: `
## Pulling Reports via API

All report endpoints return JSON data that can be consumed by spreadsheets, dashboards, or automation tools.

### Trial Balance
\`\`\`
GET /api/v2/reports/trial-balance?start_date=2026-01-01&end_date=2026-12-31
\`\`\`
Returns each account's total debits and credits. Revenue/expense accounts show only the current fiscal year (virtual year-end closing applied).

### Profit & Loss
\`\`\`
GET /api/v2/reports/profit-loss?start_date=2026-01-01&end_date=2026-03-31&basis=accrual
\`\`\`
Returns revenue, expenses, and net income for the period. Supports \`accrual\` or \`cash\` basis.

### Balance Sheet
\`\`\`
GET /api/v2/reports/balance-sheet?as_of_date=2026-03-31&basis=accrual
\`\`\`
Returns assets, liabilities, and equity as of a specific date. Automatically computes retained earnings from prior fiscal years.

### Cash Flow
\`\`\`
GET /api/v2/reports/cash-flow?start_date=2026-01-01&end_date=2026-03-31
\`\`\`

### General Ledger
\`\`\`
GET /api/v2/reports/general-ledger?start_date=2026-01-01&end_date=2026-03-31
\`\`\`

### Tips
- All date parameters use \`YYYY-MM-DD\` format
- Omitting dates defaults to the current calendar year
- Reports respect the active tenant — switch tenants with \`POST /api/v2/tenants/switch\` if needed
- Reports return the same data as the web UI — no differences in calculation
`,
  },
  {
    id: 'api-multi-tenant',
    title: 'Working with Multiple Tenants',
    category: 'API & Integrations',
    summary: 'How to access multiple companies and switch between tenants via the API.',
    body: `
## Working with Multiple Tenants

If your account has access to multiple tenants (e.g., accountants managing multiple clients), the API lets you switch between them.

### List Your Tenants
\`\`\`
GET /api/v2/tenants
\`\`\`
Returns:
\`\`\`json
{
  "tenants": [
    { "tenantId": "uuid-1", "tenantName": "My Company", "role": "owner" },
    { "tenantId": "uuid-2", "tenantName": "Client ABC", "role": "accountant" }
  ]
}
\`\`\`

### Switch Tenant
\`\`\`
POST /api/v2/tenants/switch
{ "tenantId": "uuid-2" }
\`\`\`
Returns new JWT tokens scoped to the target tenant. Use the new tokens for subsequent requests.

### API Keys and Tenants
Each API key is scoped to the tenant where it was created. To access multiple tenants programmatically, either:
- Generate a separate API key in each tenant
- Use JWT auth with tenant switching

### Company Context
Within a tenant, you may have multiple companies. Set the active company with the \`X-Company-Id\` header:
\`\`\`
X-Company-Id: uuid-of-company
\`\`\`
If omitted, the default company is used.
`,
  },
  {
    id: 'api-keys-management',
    title: 'Managing API Keys',
    category: 'API & Integrations',
    summary: 'How to generate, list, and revoke API keys.',
    body: `
## Managing API Keys

API keys provide secure, long-lived authentication for external tools and integrations.

### Generating a Key
1. Go to **Settings > API Keys**
2. Click **Generate Key**
3. **Step 1:** Enter a name (e.g., "Claude Desktop", "Zapier", "Custom Dashboard")
4. **Step 2:** Select permissions (scopes):
   - **Full Access** — everything the user can do
   - **Read Only** — view data and run reports, no modifications
   - **Write** — create and update transactions
   - **Reports Only** — run financial reports
   - **Banking** — bank feed and connection access
   - **Invoicing** — invoice and payment management
5. **Step 3:** Set expiration (optional — 30 days, 90 days, 1 year, or never)
6. **Step 4:** Copy the key immediately — it will not be shown again
7. Download as .env file for easy integration

### Security Best Practices
- **Never share keys** in public repositories, emails, or chat
- **Use descriptive names** so you know which integration uses which key
- **Revoke unused keys** — if an integration is decommissioned, revoke its key
- **Rotate periodically** — generate a new key and revoke the old one
- Keys can optionally have an expiration date

### Revoking a Key
1. Go to **Settings > API Keys**
2. Click the trash icon next to the key
3. Confirm revocation

Revoked keys immediately stop working. Any integration using that key will receive a 401 error.

### API Key vs JWT
| Feature | API Key | JWT |
|---------|---------|-----|
| Best for | Scripts, integrations, automation | Web/mobile apps |
| Expiry | Optional (or never) | 15 minutes |
| Refresh | Not needed | Via refresh token |
| Tenant | Fixed to one tenant | Can switch tenants |
| Super admin | No | Yes |
`,
  },

  // ─── Security ────────────────────────────────────────────────
  {
    id: 'two-factor-auth',
    title: 'Two-Factor Authentication (2FA)',
    category: 'Security',
    summary: 'Set up and manage two-factor authentication to protect your account.',
    body: `
## Two-Factor Authentication (2FA)

2FA adds an extra verification step when you log in, protecting your account even if your password is compromised.

### Enabling 2FA
1. Go to **Settings > Security**
2. Click **Enable 2FA**
3. Save the 10 recovery codes shown (each can only be used once)
4. Add at least one verification method

### Verification Methods

**Authenticator App (TOTP)** — Scan a QR code with Google Authenticator, Authy, etc.

**Email Code** — Codes sent to your account email at login.

**Text Message (SMS)** — Enter your phone number and verify. Requires admin to configure SMS provider in System Settings.

### Preferred Method
If you have multiple methods, choose which appears first at login using the **Preferred Method** dropdown.

### Recovery Codes
Each code is single-use. Store them securely. Regenerate when running low (requires password).

### Trusted Devices
Check "Trust this device for 30 days" after verifying to skip 2FA on that browser. Revoke trusted devices anytime in Security settings.

### Disabling 2FA
Click **Disable Two-Factor Authentication** (requires password). Clears all methods, codes, and trusted devices.
`,
  },
  {
    id: 'passkeys',
    title: 'Passkeys (Passwordless Login)',
    category: 'Security',
    summary: 'Use fingerprint, face recognition, or security keys to sign in without a password.',
    body: `
## Passkeys

Passkeys let you sign in with biometrics (fingerprint, face) or a security key. They skip 2FA entirely because they are multi-factor by nature.

### Setting Up a Passkey
1. Go to **Settings > Security**, scroll to **Login Methods**
2. Click **Add Passkey** and name it (e.g., "MacBook Touch ID")
3. Your browser prompts for biometric verification
4. Done — use it to sign in next time

### Signing In
Click **Sign in with Passkey** on the login page. Browser prompts biometric. Logged in — no password, no 2FA.

### Magic Links
If enabled by your admin, you can receive a login link via email. After clicking the link, complete 2FA with your authenticator or SMS (email method is excluded since the link already proves email access).

### Admin Configuration
Passkeys and magic links are enabled system-wide in **Admin > Two-Factor Auth > Passwordless Login**.
`,
  },

  // ─── AI Processing ──────────────────────────────────────────
  {
    id: 'ai-categorization',
    title: 'AI Transaction Categorization',
    category: 'AI Processing',
    summary: 'How AI automatically suggests categories for bank feed items.',
    body: `
## AI Transaction Categorization

When bank feed items are imported, Vibe MyBooks can automatically suggest the correct category.

### Three-Layer System
1. **Bank Rules** (instant) — if a matching rule exists, it's applied immediately
2. **Learning History** (instant) — after 3 confirmations of the same payee, the system remembers
3. **AI Suggestion** (cloud/local) — analyzes description and suggests an account with a confidence score

### Using Suggestions
- Items with suggestions show a sparkle icon with confidence (High/Medium/Low)
- **Accept** to confirm, **Override** to choose differently
- Accepting teaches the system for future matches

### Batch Mode
Click **AI Categorize** in the bank feed to process all uncategorized items at once.

### Providers
Supports Anthropic (Claude), OpenAI (GPT), Google (Gemini), and Ollama (self-hosted). Configured by admin in **Admin > AI Processing**.
`,
  },
  {
    id: 'ai-receipt-ocr',
    title: 'Receipt OCR & Statement Parsing',
    category: 'AI Processing',
    summary: 'Extract data from receipt photos and bank statement documents using AI.',
    body: `
## Receipt OCR

Upload a receipt photo and AI extracts vendor, date, total, tax, and line items.

### Capturing a Receipt
1. Upload a photo via the receipt capture modal
2. AI processes the image and pre-fills the form
3. Review, correct if needed, select accounts
4. Click **Create Expense**

### Bank Statement Parsing
1. Go to **Banking > Import Statement**
2. Upload a PDF or image
3. AI extracts all transactions into a review table
4. Select which to import (duplicates flagged)
5. Click **Import** — items go to your bank feed

### Document Classification
When you upload an image, AI classifies it (receipt, invoice, statement) and routes it to the appropriate processor automatically.
`,
  },

  // ─── Banking (new) ──────────────────────────────────────────
  {
    id: 'plaid-connections',
    title: 'Plaid Bank Connections',
    category: 'Banking',
    summary: 'Connect your bank via Plaid for automatic transaction import.',
    body: `
## Plaid Bank Connections

Plaid connects Vibe MyBooks directly to your bank for automatic transaction syncing.

### Connecting
1. Go to **Banking** and click **Connect Bank**
2. Search for your bank in Plaid Link and log in
3. Map each account to a Chart of Accounts entry with a sync start date
4. Transactions sync automatically via webhooks

### Cross-Company
One Plaid connection can serve multiple companies. Each maps different accounts. Other companies' accounts are invisible to you — only a count is shown.

### Disconnecting
- **Disconnect Company** — removes your mappings only; other companies unaffected
- **Delete Connection** — fully removes for all companies (requires admin of all affected companies)

### Re-Authentication
If your bank requires re-login, a "Needs Attention" banner appears. Click **Fix Now** to re-authenticate.
`,
  },
  {
    id: 'statement-upload',
    title: 'AI Bank Statement Import',
    category: 'Banking',
    summary: 'Upload a bank statement and let AI extract transactions.',
    body: `
## AI Bank Statement Import

Go to **Banking > Import Statement**, upload a PDF or image, and AI extracts all transactions into a review table. Select which to import, and they appear in your bank feed for categorization.
`,
  },

  // ─── API & Integrations (new) ──────────────────────────────
  {
    id: 'mcp-server',
    title: 'MCP Server (AI Assistant Integration)',
    category: 'API & Integrations',
    summary: 'Connect Claude, GPT, or other AI assistants to your books via MCP.',
    body: `
## MCP Server

The MCP server lets AI assistants interact with your data — query accounts, create transactions, run reports.

### Quick Start
1. Create an API key in **Settings > API Keys** (select scopes)
2. Configure your AI assistant: URL \`https://your-instance.com/mcp\`, Bearer token = your key
3. The assistant can call 40+ tools across accounts, contacts, transactions, reports, banking, and more

### Company Context
If you have one company, it's auto-selected. With multiple companies, specify \`company_id\` per call or use \`set_active_company\`.

### Scopes
Keys can be restricted: Full Access, Read, Write, Reports, Banking, Invoicing.

### Rate Limiting
Default 60 requests/minute per key. Admin configures system limits.

### Admin
Enable MCP in **Admin > MCP / API** and per-company in **Company Settings > API & MCP Access**.
`,
  },
  {
    id: 'oauth-integration',
    title: 'OAuth 2.0 Integration',
    category: 'API & Integrations',
    summary: 'Connect third-party apps via OAuth.',
    body: `
## OAuth 2.0

Third-party apps can request access to your data via OAuth authorization code flow.

### How It Works
1. App redirects you to Vibe MyBooks consent screen
2. You see the app name and requested permissions
3. Click **Authorize** or **Deny**
4. App receives tokens to make API calls on your behalf

### Managing Apps
Go to **Settings > Connected Apps** to see authorized apps and revoke access.
`,
  },

  // ─── Settings (new) ────────────────────────────────────────
  {
    id: 'sms-provider-setup',
    title: 'SMS Provider Setup',
    category: 'Settings',
    summary: 'Configure Twilio or TextLinkSMS for SMS-based 2FA.',
    body: `
## SMS Provider Setup

Configure an SMS provider for Text Message 2FA delivery.

### Steps
1. Go to **Admin > System Settings > SMS Provider**
2. Select Twilio or TextLinkSMS
3. Enter credentials (Account SID + Auth Token + From Number for Twilio, or API Key for TextLinkSMS)
4. Click **Save SMS Settings**
5. Send a test SMS to verify delivery
6. Enable "Text Message" in **Admin > Two-Factor Auth > Available Methods**
`,
  },
  {
    id: 'company-mcp-toggle',
    title: 'Company API & MCP Access',
    category: 'Settings',
    summary: 'Enable or disable API access per company.',
    body: `
## Company API & MCP Access

Each company controls whether API keys and MCP calls can access its data.

### Enable
Go to **Settings > Company Profile > API & MCP Access** and check the toggle.

### When Disabled
All API/MCP calls targeting the company return "MCP_DISABLED," regardless of user permissions or key configuration.

### Default
MCP access is **disabled** for new companies. Must be explicitly enabled.
`,
  },
  {
    id: 'cloud-storage',
    title: 'Cloud File Storage',
    category: 'Settings',
    summary: 'Store uploaded files on Dropbox, Google Drive, OneDrive, or S3.',
    body: `
## Cloud File Storage

By default, files are stored on the server's local disk. You can configure cloud storage so files are stored on Dropbox, Google Drive, OneDrive, or any S3-compatible service.

### Setting Up
1. Go to **Settings > File Storage**
2. Click **Connect** next to your preferred provider
3. Authorize access via OAuth (or enter S3 credentials)
4. Click **Set Active** to make it the primary storage

### Supported Providers
- **Local Disk** — default, zero setup
- **Dropbox** — OAuth connection, files in a "Vibe MyBooks" folder
- **Google Drive** — OAuth, minimal permissions (app-created files only)
- **OneDrive** — OAuth via Microsoft account
- **S3** — works with AWS S3, MinIO, Backblaze B2, Cloudflare R2

### Migrating Files
When switching providers, existing files are migrated automatically with a progress bar. Failed files can be retried.

### How It Works
All features (OCR, thumbnails, viewer) work identically regardless of provider. Cloud files are cached locally for processing and evicted after 24 hours.
`,
  },
];
