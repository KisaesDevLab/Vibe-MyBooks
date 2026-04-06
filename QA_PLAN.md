# KIS Books — QA Test Plan

## Phase 1: Docker Build & Startup
1. Build all packages (shared, api, web, worker)
2. Verify zero TypeScript errors
3. Run all Vitest tests
4. Docker compose up (db, redis, api, web, worker)
5. Verify all containers healthy
6. Verify migrations run on fresh DB

## Phase 2: Initial Setup
7. Access web app at localhost:5173
8. Verify setup wizard appears on fresh install
9. Register first user (creates tenant + company + COA)
10. Verify login works
11. Verify JWT tokens issued
12. Verify COA seeded with system accounts

## Phase 3: Core Bookkeeping
13. Company profile CRUD
14. Chart of Accounts — list, create, edit, deactivate
15. Contacts — create customer, vendor, both-type
16. Transactions — create expense, deposit, transfer, journal entry
17. Double-entry — verify debits = credits on every transaction
18. Void transaction — verify reversing entries
19. Invoice — create, send, record payment, verify lifecycle
20. Cash sale, credit memo

## Phase 4: Banking
21. Bank feed CSV import
22. Bank feed OFX import
23. Bank feed categorize, match, exclude
24. Bulk approve
25. Bank reconciliation flow
26. Plaid connection flow (if keys configured)

## Phase 5: Reports
27. P&L report
28. Balance Sheet
29. Trial Balance
30. Cash Flow Statement
31. AR Aging
32. General Ledger
33. CSV/PDF export

## Phase 6: Advanced Features
34. Recurring transactions
35. Tags — create, assign to transactions
36. Budget creation and vs-actual
37. Attachments and receipt capture
38. Items/products management
39. Check writing

## Phase 7: Security & Auth
40. 2FA enable/disable flow
41. TOTP setup and verify
42. Recovery codes generation and use
43. Passkey registration
44. Magic link flow
45. API key creation and MCP access
46. Rate limiting

## Phase 8: AI Processing
47. AI config (provider setup)
48. Transaction categorization
49. Receipt OCR
50. Bank statement parsing
51. Document classification

## Phase 9: Admin
52. Admin dashboard
53. Tenant management
54. User management
55. System settings (SMTP, SMS)
56. Plaid configuration
57. AI configuration
58. MCP/API configuration
59. Audit log viewer

## Phase 10: Build Integrity
60. Full build verification
61. Full test suite pass
62. Docker production build
