# Vibe MyBooks — API Reference

Base URL: `/api/v1`

All endpoints require `Authorization: Bearer <token>` unless noted.

## Authentication
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/auth/register` | No | Create account |
| POST | `/auth/login` | No | Login, returns tokens |
| POST | `/auth/refresh` | No | Refresh access token |
| POST | `/auth/logout` | Yes | Invalidate refresh token |
| GET | `/auth/me` | Yes | Current user profile + display preferences |
| PUT | `/auth/me/preferences` | Yes | Update display preferences |

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
| GET | `/transactions` | List transactions (filterable) |
| POST | `/transactions` | Create transaction (any type) |
| GET | `/transactions/:id` | Get with journal lines |
| POST | `/transactions/:id/void` | Void transaction |
| POST | `/transactions/:id/duplicate` | Duplicate transaction |

## Invoices
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/invoices` | List invoices |
| POST | `/invoices` | Create invoice |
| GET | `/invoices/:id` | Get invoice detail |
| POST | `/invoices/:id/send` | Send via email |
| POST | `/invoices/:id/payment` | Record payment |
| GET | `/invoices/:id/pdf` | Generate PDF |
| POST | `/invoices/:id/void` | Void invoice |
| POST | `/invoices/:id/duplicate` | Duplicate |

## Payments
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/payments/receive` | Receive customer payment |
| GET | `/payments/open-invoices/:customerId` | Open invoices for customer |
| GET | `/payments/pending-deposits` | Payments in clearing |

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
| POST | `/banking/reconciliations/:id/complete` | Complete reconciliation |

## Reports
All reports accept `?format=json|csv|pdf` and `?compare=previous_period|previous_year|multi_period`.

| Endpoint | Report |
|----------|--------|
| `/reports/profit-loss` | Profit & Loss |
| `/reports/balance-sheet` | Balance Sheet |
| `/reports/cash-flow` | Cash Flow Statement |
| `/reports/ar-aging-summary` | AR Aging Summary |
| `/reports/trial-balance` | Trial Balance |
| `/reports/general-ledger` | General Ledger |
| `/reports/transaction-list` | Transaction List |
| ... | (24 report types total) |

## Tags
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/tags` | List tags |
| POST | `/tags` | Create tag |
| POST | `/tags/merge` | Merge tags |
| GET | `/tags/groups/list` | List tag groups |
| POST | `/tags/transactions/:id/add` | Add tags to transaction |
| POST | `/tags/bulk-tag` | Bulk tag transactions |

## Items
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/items` | List items |
| POST | `/items` | Create item |
| PUT | `/items/:id` | Update item |

## Budgets
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/budgets` | List budgets |
| POST | `/budgets` | Create budget |
| GET | `/budgets/:id/lines` | Get budget lines |
| PUT | `/budgets/:id/lines` | Update budget lines |
| GET | `/budgets/:id/vs-actual` | Budget vs Actual report |

## Setup (No Auth — self-destructs after setup)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/setup/status` | Setup status |
| POST | `/api/setup/generate-secrets` | Generate secrets |
| POST | `/api/setup/test-database` | Test DB connection |
| POST | `/api/setup/initialize` | Complete setup |
