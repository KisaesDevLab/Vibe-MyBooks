# Vibe MyBooks — API Reference

Base URL: `/api/v1`

All endpoints require `Authorization: Bearer <token>` unless noted.

> **Integrations should prefer `/api/v2`.** The v2 surface is auth-hardened
> (API key + JWT), Zod-validated, rate-limited (100 req/min per key),
> and stable across releases. v2 now covers accounts, contacts,
> transactions (with void + tag), invoices, bills + bill payments +
> vendor credits, customer payments, checks, recurring schedules,
> budgets, dashboard summaries, tags, bank connections + feed + reconciliation,
> attachment metadata, and 14 financial reports. See
> [VIBE_MYBOOKS_API.md](../VIBE_MYBOOKS_API.md) for the full v2 reference.
> The `/api/v1` endpoints documented below remain available for features
> that have not yet been promoted to v2 (file uploads, Plaid link-token
> minting, reconciliation line mutation, check print batch, bank rules,
> batch entry, import/export, backup, admin, AI chat, estimates) and for
> backward compatibility with the web UI.

## Authentication
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/auth/register` | No | Create account |
| POST | `/auth/login` | No | Login, returns tokens |
| POST | `/auth/refresh` | No | Refresh access token |
| POST | `/auth/logout` | Yes | Invalidate refresh token |
| GET | `/auth/me` | Yes | Current user profile + display preferences |
| PUT | `/auth/me/preferences` | Yes | Update display preferences |

### Two-Factor Authentication
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/tfa/methods` | Yes | List user's enrolled 2FA methods |
| POST | `/tfa/enroll` | Yes | Start enrollment (TOTP, email, SMS) |
| POST | `/tfa/verify` | No | Verify 2FA code during login |
| POST | `/tfa/recovery-codes` | Yes | Generate new recovery codes |
| DELETE | `/tfa/methods/:id` | Yes | Remove a 2FA method |

### Passkeys (WebAuthn)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/passkey/register/options` | Yes | Get registration challenge |
| POST | `/passkey/register/verify` | Yes | Complete registration |
| POST | `/passkey/authenticate/options` | No | Get authentication challenge |
| POST | `/passkey/authenticate/verify` | No | Complete authentication |
| GET | `/passkey/list` | Yes | List registered passkeys |
| DELETE | `/passkey/:id` | Yes | Remove a passkey |

### Magic Links
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/magic-link/send` | No | Send magic link email |
| POST | `/magic-link/verify` | No | Verify magic link token |

### OAuth
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/oauth/authorize` | No | OAuth 2.0 authorization |
| POST | `/oauth/token` | No | Exchange code for token |

## Company
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/company` | Get company profile |
| PUT | `/company` | Update company profile |
| POST | `/company/logo` | Upload logo (multipart) |
| GET | `/company/settings` | Get company settings |
| PUT | `/company/settings` | Update settings |

## Accounts (Chart of Accounts)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/accounts` | List accounts (filterable) |
| POST | `/accounts` | Create account |
| GET | `/accounts/:id` | Get account |
| PUT | `/accounts/:id` | Update account |
| DELETE | `/accounts/:id` | Deactivate account |
| GET | `/accounts/export` | Export CSV |
| POST | `/accounts/import` | Import from CSV |
| POST | `/accounts/merge` | Merge two accounts |
| GET | `/accounts/:id/register` | Account register (paginated) |
| GET | `/accounts/:id/register/summary` | Register summary |

## Contacts
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/contacts` | List contacts (filterable) |
| POST | `/contacts` | Create contact |
| GET | `/contacts/:id` | Get contact |
| PUT | `/contacts/:id` | Update contact |
| DELETE | `/contacts/:id` | Deactivate contact |
| GET | `/contacts/export` | Export CSV |
| POST | `/contacts/import` | Import CSV |
| POST | `/contacts/merge` | Merge contacts |

## Transactions
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/transactions` | List transactions (filterable, paginated) |
| POST | `/transactions` | Create transaction (any type) |
| GET | `/transactions/:id` | Get with journal lines |
| PUT | `/transactions/:id` | Update transaction |
| POST | `/transactions/:id/void` | Void transaction |
| POST | `/transactions/:id/duplicate` | Duplicate transaction |

### Batch Entry
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/batch/validate` | Validate batch rows |
| POST | `/batch/submit` | Submit batch transactions |

### Recurring Transactions
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/recurring` | List recurring schedules |
| POST | `/recurring` | Create recurring schedule |
| GET | `/recurring/:id` | Get schedule details |
| PUT | `/recurring/:id` | Update schedule |
| DELETE | `/recurring/:id` | Delete schedule |
| POST | `/recurring/:id/post` | Manually post next occurrence |

### Duplicates
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/duplicates` | List potential duplicates |
| POST | `/duplicates/:id/dismiss` | Dismiss a duplicate pair |
| POST | `/duplicates/:id/merge` | Merge duplicate transactions |

## Invoices
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/invoices` | List invoices |
| POST | `/invoices` | Create invoice |
| GET | `/invoices/:id` | Get invoice detail |
| PUT | `/invoices/:id` | Update invoice |
| POST | `/invoices/:id/send` | Send via email |
| POST | `/invoices/:id/payment` | Record payment |
| GET | `/invoices/:id/pdf` | Generate PDF |
| POST | `/invoices/:id/void` | Void invoice |
| POST | `/invoices/:id/duplicate` | Duplicate |

### Estimates
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/estimates` | List estimates |
| POST | `/estimates` | Create estimate |
| GET | `/estimates/:id` | Get estimate detail |
| PUT | `/estimates/:id` | Update estimate |
| POST | `/estimates/:id/convert` | Convert to invoice |

## Payments
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/payments/receive` | Receive customer payment |
| GET | `/payments/open-invoices/:customerId` | Open invoices for customer |
| GET | `/payments/pending-deposits` | Payments in clearing |

## Bills (Accounts Payable)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/bills` | List bills (filterable) |
| POST | `/bills` | Create bill |
| GET | `/bills/:id` | Get bill detail |
| PUT | `/bills/:id` | Update bill |
| POST | `/bills/:id/void` | Void bill |

### Vendor Credits
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/vendor-credits` | List vendor credits |
| POST | `/vendor-credits` | Create vendor credit |
| GET | `/vendor-credits/:id` | Get vendor credit detail |

### Bill Payments
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/bill-payments` | Pay one or more bills |
| GET | `/bill-payments` | List bill payments |

## Checks
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/checks` | Write check |
| GET | `/checks` | List checks |
| GET | `/checks/print-queue` | Print queue |
| POST | `/checks/print` | Print batch |
| GET | `/checks/settings` | Check print settings |
| PUT | `/checks/settings` | Update settings |

## Banking
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/banking/connections` | List bank connections |
| POST | `/banking/feed/import` | Import bank file (CSV/OFX) |
| GET | `/banking/feed` | List feed items |
| PUT | `/banking/feed/:id/categorize` | Categorize item |
| PUT | `/banking/feed/:id/match` | Match to transaction |
| POST | `/banking/reconciliations` | Start reconciliation |
| GET | `/banking/reconciliations` | List reconciliations |
| POST | `/banking/reconciliations/:id/complete` | Complete reconciliation |

### Bank Rules
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/bank-rules` | List bank rules |
| POST | `/bank-rules` | Create bank rule |
| PUT | `/bank-rules/:id` | Update bank rule |
| DELETE | `/bank-rules/:id` | Delete bank rule |

### Plaid Integration
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/plaid/link-token` | Create Plaid Link token |
| POST | `/plaid/exchange-token` | Exchange public token |
| POST | `/plaid/sync` | Trigger manual sync |
| GET | `/plaid/connections` | List Plaid connections |
| DELETE | `/plaid/connections/:id` | Disconnect Plaid connection |

## Attachments
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/attachments` | Upload attachment (multipart) |
| GET | `/attachments` | List attachments |
| GET | `/attachments/:id` | Get attachment metadata |
| GET | `/attachments/:id/download` | Download file |
| DELETE | `/attachments/:id` | Delete attachment |
| POST | `/attachments/:id/link` | Link to transaction/invoice/bill |

## AI Processing
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/ai/categorize` | AI-categorize a transaction |
| POST | `/ai/ocr` | OCR a receipt/document image |
| POST | `/ai/parse-statement` | Parse a bank statement |
| GET | `/ai/config` | Get AI provider config |
| PUT | `/ai/config` | Update AI provider config |

### Chat Assistant
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/chat/message` | Send chat message |
| GET | `/chat/history` | Get chat history |
| DELETE | `/chat/history` | Clear chat history |
| POST | `/chat/regenerate-knowledge` | Regenerate knowledge base |

## Reports
All reports accept `?format=json|csv|pdf` and `?compare=previous_period|previous_year|multi_period`.

| Endpoint | Report |
|----------|--------|
| `/reports/profit-loss` | Profit & Loss |
| `/reports/balance-sheet` | Balance Sheet |
| `/reports/cash-flow` | Cash Flow Statement |
| `/reports/ar-aging-summary` | AR Aging Summary |
| `/reports/ar-aging-detail` | AR Aging Detail |
| `/reports/ap-aging-summary` | AP Aging Summary |
| `/reports/ap-aging-detail` | AP Aging Detail |
| `/reports/customer-balance-summary` | Customer Balance Summary |
| `/reports/customer-balance-detail` | Customer Balance Detail |
| `/reports/vendor-balance-summary` | Vendor Balance Summary |
| `/reports/trial-balance` | Trial Balance |
| `/reports/general-ledger` | General Ledger |
| `/reports/transaction-list` | Transaction List |
| `/reports/transaction-list-by-vendor` | Transactions by Vendor |
| `/reports/journal-entry-report` | Journal Entries |
| `/reports/invoice-list` | Invoice List |
| `/reports/unpaid-bills` | Unpaid Bills |
| `/reports/bill-payment-history` | Bill Payment History |
| `/reports/expense-by-vendor` | Expenses by Vendor |
| `/reports/expense-by-category` | Expenses by Category |
| `/reports/bank-reconciliation-summary` | Bank Reconciliation |
| `/reports/deposit-detail` | Deposit Detail |
| `/reports/check-register` | Check Register |
| `/reports/sales-tax-liability` | Sales Tax Liability |
| `/reports/taxable-sales-summary` | Taxable Sales Summary |
| `/reports/sales-tax-payments` | Sales Tax Payments |
| `/reports/ap-1099-prep` | 1099 Preparation |
| `/reports/vendor-1099-summary` | 1099 Vendor Summary |
| `/reports/budget-vs-actual` | Budget vs. Actual |
| `/reports/budget-overview` | Budget Overview |

## Tags
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/tags` | List tags |
| POST | `/tags` | Create tag |
| PUT | `/tags/:id` | Update tag |
| DELETE | `/tags/:id` | Delete tag |
| POST | `/tags/merge` | Merge tags |
| GET | `/tags/groups/list` | List tag groups |
| POST | `/tags/groups` | Create tag group |
| POST | `/tags/transactions/:id/add` | Add tags to transaction |
| POST | `/tags/bulk-tag` | Bulk tag transactions |

## Items (Products & Services)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/items` | List items |
| POST | `/items` | Create item |
| PUT | `/items/:id` | Update item |
| DELETE | `/items/:id` | Delete item |

## Budgets
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/budgets` | List budgets |
| POST | `/budgets` | Create budget |
| GET | `/budgets/:id/lines` | Get budget lines |
| PUT | `/budgets/:id/lines` | Update budget lines |
| GET | `/budgets/:id/vs-actual` | Budget vs Actual report |

## Payroll Import
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/payroll-import/upload` | Upload payroll file |
| POST | `/payroll-import/map` | Submit column mapping |
| POST | `/payroll-import/validate` | Validate mapped data |
| POST | `/payroll-import/post` | Post journal entries |
| GET | `/payroll-import/templates` | List provider templates |

## Storage
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/storage/providers` | List storage providers |
| PUT | `/storage/providers/:id` | Update provider config |
| POST | `/storage/providers/:id/activate` | Set active provider |
| POST | `/storage/providers/:id/health` | Check provider health |
| POST | `/storage/migrate` | Start storage migration |

## Backup & Restore
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/backup/create` | Create portable backup |
| GET | `/backup/list` | List backups |
| GET | `/backup/:id/download` | Download backup file |
| DELETE | `/backup/:id` | Delete backup |
| POST | `/backup/restore` | Restore from backup |

### Remote Backups
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/remote-backup/config` | Get remote backup config |
| PUT | `/remote-backup/config` | Update remote backup config |
| POST | `/remote-backup/trigger` | Trigger remote backup now |
| GET | `/remote-backup/history` | List remote backup history |

## Export
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/export/:entity` | Export entity data (CSV/JSON/Excel) |
| POST | `/tenant-export` | Export tenant data package |
| POST | `/tenant-export/import` | Import tenant data package |

## API Keys
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api-keys` | List API keys |
| POST | `/api-keys` | Generate new API key |
| DELETE | `/api-keys/:id` | Revoke API key |

## Admin Endpoints
Require super admin role.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/tenants` | List tenants |
| GET | `/admin/tenants/:id` | Get tenant detail |
| PUT | `/admin/tenants/:id` | Update tenant |
| GET | `/admin/users` | List all users |
| GET | `/admin/system` | System settings |
| PUT | `/admin/system` | Update system settings |
| GET | `/admin/dashboard` | Admin dashboard stats |

### Admin Security
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/admin/security/recovery-key` | Generate new recovery key |
| POST | `/admin/security/rotate-installation` | Rotate installation ID |
| POST | `/admin/security/test-recovery-key` | Test a recovery key |
| DELETE | `/admin/security/recovery-file` | Delete recovery file |

## Setup (No Auth — self-destructs after setup)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/setup/status` | Setup status |
| POST | `/api/setup/generate-secrets` | Generate secrets |
| POST | `/api/setup/test-database` | Test DB connection |
| POST | `/api/setup/initialize` | Complete setup |

## Diagnostic (Blocked Mode Only)
Available only when the installation sentinel blocks normal startup.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/diagnostic/status` | Get diagnostic status and block reason |
| POST | `/api/diagnostic/recover-env` | Recover env from recovery key |
| POST | `/api/diagnostic/regenerate-sentinel` | Regenerate sentinel (requires admin credentials) |
