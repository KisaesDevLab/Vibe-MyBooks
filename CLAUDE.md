# CLAUDE.md — KIS Books

## Project Overview

KIS Books is a self-hosted, open-source bookkeeping application — a credible alternative to QuickBooks Online Simple Start. It ships as a single Docker Compose appliance targeting solo entrepreneurs, freelancers, and CPA firms.

**Repository:** kis-books
**License:** Elastic License 2.0 (ELv2)
**Author:** Kisaes LLC

## Reference Documents

- `BUILD_PLAN.md` — Master build plan with phased checklists, database schema, API routes, and component specs. **This is the source of truth.** Work phase by phase, task by task.
- `QBO_SimpleStart_Alternative_Proposal.md` — Feature proposal describing what to build and why. Consult for product intent when the build plan is ambiguous.
- `QUESTIONS.md` — Log ambiguities here. Do not block; make the simplest assumption, document it, and continue.

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, React Router v6, TanStack Query v5 |
| Backend | Node.js 20, Express, TypeScript, Drizzle ORM |
| Database | PostgreSQL 16 |
| Job Queue | BullMQ + Redis 7 |
| PDF | @react-pdf/renderer (invoices) or Puppeteer (reports) |
| Email | Nodemailer (SMTP configurable via env) |
| File Storage | Local disk (Docker volume at /data), S3-compatible optional |
| Auth | JWT access tokens (15min) + HTTP-only refresh tokens (7d), bcrypt |
| Container | Docker Compose: api, web, db, redis, worker |
| Testing | Vitest (unit/integration), Playwright (e2e) |

## Execution Rules

### Workflow
1. **Work phase by phase, task by task.** Complete Phase N before starting Phase N+1.
2. **Mark each checkbox `[x]`** in BUILD_PLAN.md when a task is complete.
3. **Run all tests after each task.** If tests fail, fix before moving on.
4. **Commit after each completed task group** (e.g., after all of Phase 2.1). Use format: `phase-X.Y: brief description`
5. **Ship gate verification:** At the end of each phase, verify every ship gate condition before proceeding.

### Questions & Ambiguity
6. **Log questions in QUESTIONS.md** using the table format defined there.
7. **Do not block on questions.** Make the simplest reasonable assumption, document it, and continue.
8. **Do not invent features** not described in BUILD_PLAN.md or the proposal. If something seems missing, log it and proceed with the minimal interpretation.

### Code Quality
9. **Every API endpoint must have:** Zod input validation, try/catch error handling, audit trail logging, tenant_id scoping.
10. **Every UI page must have:** loading state (skeleton), error state (retry button), empty state (friendly message), responsive layout.
11. **Use `decimal(19,4)`** for all monetary amounts in the database. Never use float or double for money.
12. **All dates stored as UTC** in PostgreSQL. Display in user's local timezone on the frontend.
13. **Database migrations are additive only.** Never modify or drop existing columns/tables — create a new migration instead.
14. **No `any` types.** All TypeScript must be fully typed. Use the shared package for cross-boundary types.
15. **Business logic lives in services**, not in route handlers. Route handlers validate input, call service, format response.
16. **All list endpoints must support pagination** (limit/offset or cursor-based) and return total count.

### Security
17. **Tenant isolation is mandatory.** Every database query must include `WHERE tenant_id = ?`. Use middleware to inject tenant_id from the JWT; never trust client-supplied tenant_id.
18. **Hash passwords with bcrypt** (cost factor 12).
19. **Sanitize all user input.** Zod handles validation; additionally escape any values used in raw SQL (prefer Drizzle parameterized queries).
20. **File uploads:** Validate MIME type, enforce size limit, generate UUID filenames (never use user-supplied filenames in the filesystem path).
21. **Rate limit auth endpoints** (login, register, forgot-password): 10 requests per minute per IP.

### Double-Entry Accounting Invariants
22. **Every transaction must balance.** Sum of debits must equal sum of credits across all journal_lines for a given transaction_id. Enforce in the ledger service before insert.
23. **Void transactions create reversing entries.** Never delete journal_lines. Mark the original transaction as void and create new journal_lines with swapped debit/credit amounts.
24. **Account running balances** are denormalized on the `accounts.balance` column. Update atomically when posting or voiding transactions. Periodically validate with `SELECT SUM(debit) - SUM(credit) FROM journal_lines WHERE account_id = ?`.
25. **System accounts cannot be deleted or have their type changed.** Check `is_system = TRUE` before any destructive operation.

## File Structure

```
kis-books/
├── docker-compose.yml              # Production
├── docker-compose.dev.yml           # Dev overrides (hot reload, exposed ports)
├── .env.example
├── README.md
├── CLAUDE.md                        # This file
├── BUILD_PLAN.md                    # Master checklist
├── QUESTIONS.md                     # Ambiguity log
├── LICENSE                          # Elastic License 2.0
├── packages/
│   ├── shared/                      # Shared types, schemas, constants, utils
│   │   └── src/
│   │       ├── types/               # TypeScript interfaces & enums
│   │       ├── schemas/             # Zod validation schemas
│   │       ├── constants/           # COA templates, enums, defaults
│   │       └── utils/               # Money formatting, date helpers
│   ├── api/                         # Express backend
│   │   └── src/
│   │       ├── index.ts             # Entry: run migrations, start server
│   │       ├── app.ts               # Express app (middleware, route mounting)
│   │       ├── config/              # Typed env config (Zod-validated)
│   │       ├── db/
│   │       │   ├── schema/          # Drizzle table definitions
│   │       │   ├── migrations/      # SQL migration files
│   │       │   ├── seeds/           # COA template seeds
│   │       │   └── index.ts         # Drizzle client + connection pool
│   │       ├── middleware/          # auth, tenant, validate, audit, error-handler
│   │       ├── routes/              # Express routers (one per domain)
│   │       ├── services/            # Business logic (one per domain)
│   │       ├── jobs/                # BullMQ job definitions
│   │       └── utils/               # Server helpers, AppError class
│   ├── web/                         # React frontend
│   │   └── src/
│   │       ├── main.tsx
│   │       ├── App.tsx              # Router + auth guard
│   │       ├── api/                 # Fetch client, React Query hooks
│   │       ├── components/
│   │       │   ├── ui/              # Button, Input, Modal, Table, etc.
│   │       │   ├── layout/          # AppShell, Sidebar, Header, AuthLayout
│   │       │   └── forms/           # AccountSelector, ContactSelector, MoneyInput, DatePicker
│   │       ├── features/            # Feature modules (auth, accounts, contacts, etc.)
│   │       ├── hooks/               # Global custom hooks
│   │       └── utils/               # Frontend helpers
│   └── worker/                      # BullMQ worker process
│       └── src/
│           ├── index.ts
│           └── processors/          # OCR, recurring, email, bank sync
├── scripts/                         # Dev/build/deploy utilities
│   ├── seed-coa.ts
│   ├── migrate.ts
│   └── backup.sh
└── e2e/                             # Playwright tests
    ├── playwright.config.ts
    └── tests/
```

## Naming Conventions

| Context | Convention | Example |
|---------|-----------|---------|
| Database tables | snake_case plural | `journal_lines`, `bank_feed_items` |
| Database columns | snake_case | `tenant_id`, `created_at`, `invoice_status` |
| TypeScript interfaces | PascalCase | `JournalEntry`, `CreateInvoiceInput` |
| TypeScript enums | PascalCase + UPPER_CASE values | `TxnType.INVOICE` |
| API routes | kebab-case, REST | `/api/v1/bank-feed`, `/api/v1/invoices/:id` |
| React components | PascalCase files + exports | `InvoiceForm.tsx`, `AccountSelector.tsx` |
| Feature folders | kebab-case | `features/invoicing/`, `features/banking/` |
| CSS classes | Tailwind utilities only | No custom CSS files; use `@apply` sparingly |
| Environment vars | UPPER_SNAKE_CASE | `DATABASE_URL`, `JWT_SECRET`, `SMTP_HOST` |

## Environment Variables

```env
# Database
DATABASE_URL=postgresql://kisbooks:kisbooks@db:5432/kisbooks

# Redis
REDIS_URL=redis://redis:6379

# Auth
JWT_SECRET=change-me-in-production
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# Server
PORT=3001
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173

# Email (SMTP)
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=noreply@example.com

# File storage
UPLOAD_DIR=/data/uploads
MAX_FILE_SIZE_MB=10

# Plaid (optional — leave blank to disable bank connections)
PLAID_CLIENT_ID=
PLAID_SECRET=
PLAID_ENV=sandbox

# LLM (for receipt OCR and AI categorization)
ANTHROPIC_API_KEY=
LLM_MODEL=claude-sonnet-4-20250514

# Backup
BACKUP_DIR=/data/backups
BACKUP_ENCRYPTION_KEY=
```

## Slash Commands

Use these to execute specific phases or tasks:

- `/run phase N` — Execute all tasks in Phase N of BUILD_PLAN.md
- `/run phase N.M` — Execute a specific task group (e.g., Phase 2.3 = COA Frontend)
- `/test` — Run full Vitest test suite
- `/test:e2e` — Run Playwright tests
- `/shipgate N` — Verify all ship gate conditions for Phase N
- `/status` — Show current progress (count of checked vs unchecked items in BUILD_PLAN.md)
- `/questions` — Show all unresolved items in QUESTIONS.md

## Key Design Decisions

### Why Drizzle ORM (not Prisma)?
Drizzle gives us SQL-like syntax, zero runtime overhead, and full control over migrations. Critical for an accounting app where query precision matters and we need raw SQL escape hatches for report aggregation.

### Why BullMQ (not cron)?
Recurring transactions, bank sync, OCR, and email delivery all benefit from retry logic, dead-letter queues, and job visibility. BullMQ gives us this with minimal setup via Redis.

### Why tenant_id on every table (not schema-per-tenant)?
Simpler operationally for a Docker appliance — one migration set, one connection pool, row-level filtering via middleware. Schema-per-tenant is premature optimization for the MVP user count.

### Why Payments Clearing (not direct-to-bank)?
The Payments Clearing account acts as a holding area between receiving a payment and recording the bank deposit. This mirrors real-world cash handling (multiple checks deposited as one bank transaction) and is essential for clean bank reconciliation.

### Why decimal(19,4)?
19 digits total, 4 after the decimal. Handles values up to $999,999,999,999,999.9999 — more than sufficient for small business bookkeeping. The 4 decimal places accommodate tax rate calculations and international currencies that subdivide into thousandths.

## Common Patterns

### Service Method Pattern
```typescript
// packages/api/src/services/example.service.ts
export async function createWidget(tenantId: string, input: CreateWidgetInput): Promise<Widget> {
  const validated = createWidgetSchema.parse(input);
  
  const [widget] = await db
    .insert(widgets)
    .values({ ...validated, tenantId })
    .returning();
  
  await auditLog(tenantId, 'create', 'widget', widget.id, null, widget);
  
  return widget;
}
```

### Route Handler Pattern
```typescript
// packages/api/src/routes/example.routes.ts
router.post('/', authenticate, validate(createWidgetSchema), async (req, res) => {
  const widget = await createWidget(req.tenantId, req.body);
  res.status(201).json(widget);
});
```

### React Query Hook Pattern
```typescript
// packages/web/src/api/hooks/useWidgets.ts
export function useWidgets(filters?: WidgetFilters) {
  return useQuery({
    queryKey: ['widgets', filters],
    queryFn: () => apiClient.get('/widgets', { params: filters }),
  });
}

export function useCreateWidget() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateWidgetInput) => apiClient.post('/widgets', input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['widgets'] }),
  });
}
```

### Audit Log Helper
```typescript
// packages/api/src/middleware/audit.ts
export async function auditLog(
  tenantId: string,
  action: 'create' | 'update' | 'delete' | 'void',
  entityType: string,
  entityId: string,
  before: unknown | null,
  after: unknown | null,
  userId?: string,
): Promise<void> {
  await db.insert(auditLogTable).values({
    tenantId, action, entityType, entityId,
    beforeData: before ? JSON.stringify(before) : null,
    afterData: after ? JSON.stringify(after) : null,
    userId,
  });
}
```
