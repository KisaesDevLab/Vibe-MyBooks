# Phase 1 Plan — Foundation: Sidebar + Scaffolding

**Build plan source:** `Build Plans/VIBE_MYBOOKS_PRACTICE_BUILD_PLAN.md` (Phase 1, 18 items)
**State file:** `.practice-build-state.json`
**Author:** Claude Code executing VIBE_MYBOOKS_PRACTICE_BUILD_PLAN Phase 1
**Status:** Draft — awaiting approval

---

## Objective

Introduce the **Practice** top-level sidebar group, wire feature-flag infrastructure, scaffold all seven Practice routes as placeholder pages, and enforce role + user-type visibility rules. Ship as a no-op expansion — the group renders for staff users only, all children show "Coming soon" placeholders, and every child is gated behind a feature flag that defaults off for existing tenants and on for new tenants. Responsive/accessible behavior baseline is verified here so later phases inherit it.

Downstream phases (2–20) assume Phase 1 is correct. If Phase 1 leaks incorrect role gating, every later phase ships a commercial-license bug, so the role/visibility tests in §Step 4 are non-negotiable.

---

## Dependencies (verified against current repo state)

| Dependency | Status | Notes |
|---|---|---|
| `users` table with `role` column | ✅ Exists | `packages/api/src/db/schema/auth.ts:22` — `role varchar(50) default 'owner'`. Values in use per `packages/shared/src/schemas/admin.ts:21`: `owner` \| `accountant` \| `bookkeeper` \| `readonly` |
| `tenants` table | ✅ Exists | `packages/api/src/db/schema/auth.ts:7` |
| `user_tenant_access` table | ✅ Exists | `packages/api/src/db/schema/user-tenant-access.ts` — per-tenant role |
| `useMe()` hook exposes role + isSuperAdmin | ✅ Exists | `packages/web/src/api/hooks/useAuth.ts` — used throughout sidebar already |
| Existing sidebar collapsible-group pattern | ✅ Exists | `packages/web/src/components/layout/Sidebar.tsx` — `navGroups[]`, `useCollapsedGroups()` persists to `localStorage`, uses `ChevronDown` + `aria-expanded` |
| Router / AppShell wrapper | ✅ Exists | `packages/web/src/App.tsx` — `<ProtectedRoute><AppShell /></ProtectedRoute>` with lazy routes |
| `tenant_feature_flags` table | ❌ Does not exist | Must create in Phase 1 |
| `user_type` field on users | ❌ Does not exist | Must create in Phase 1 — values `'staff'` \| `'client'`, default `'staff'` |
| `useFeatureFlag()` hook | ❌ Does not exist | Must create in Phase 1 |
| `AdminRoute` pattern for super-admin-only pages | ✅ Exists | `packages/web/src/components/layout/AdminRoute.tsx` — reuse for admin feature-flag toggle page |

### Cross-phase references verified

The build plan's "Feature dependency graph" (lines 129–141) shows all downstream features depend on Phase 1's feature flags and route scaffolding. No earlier phase exists. Phase 1 is the root.

### Role-vocabulary mapping (authoritative for this workstream)

The plan uses `Admin` / `Bookkeeper` / `Reviewer` terminology (line 96–105). The existing codebase uses `owner` / `accountant` / `bookkeeper` / `readonly`. Mapping decision for Phase 1:

- **Firm Admin** ≡ `role = 'owner'`
- **Bookkeeper** ≡ `role = 'bookkeeper'` OR `role = 'accountant'`
- **Reviewer** — not introduced until Phase 8 (Close Review workflow). Not needed for Phase 1 sidebar gating.
- **Readonly** — sees no Practice children (strict-minimum: bookkeeper+).

Per-item guards (Phase 1 sidebar):
| Nav item | Minimum role |
|---|---|
| Close Review | bookkeeper / accountant |
| Rules | bookkeeper / accountant |
| Receipts Inbox | bookkeeper / accountant |
| 1099 Center | bookkeeper / accountant |
| Client Portal | owner |
| Reminders | owner |
| Report Builder | bookkeeper / accountant |

Group-level guard: `user_type !== 'client'` AND `role !== 'readonly'` — so `readonly` accounts see no Practice group at all (no practice children would render for them anyway).

---

## Files to create

### Database

- `packages/api/src/db/schema/feature-flags.ts` — Drizzle schema for `tenant_feature_flags`.
- `packages/api/src/db/migrations/NNNN_practice_foundation.sql` — creates `tenant_feature_flags`, adds `users.user_type`, seeds eight flags with `enabled = false` for existing tenants.

### API

- `packages/api/src/services/feature-flags.service.ts` — `listFlagsForTenant(tenantId)`, `setFlag(tenantId, key, enabled, rolloutPercent)`, `isEnabled(tenantId, key)`, `seedDefaultsForNewTenant(tenantId)` (called from new-tenant hook).
- `packages/api/src/routes/feature-flags.routes.ts` — `GET /api/v1/feature-flags` (authenticated, returns flags for current tenant) and `POST /api/v1/admin/feature-flags/:tenantId/:flagKey` (super-admin only, toggles one flag).
- `packages/api/src/services/feature-flags.service.test.ts` — unit tests for service.
- `packages/api/src/routes/feature-flags.routes.test.ts` — integration tests, including tenant isolation and super-admin guard.

### Shared

- `packages/shared/src/constants/feature-flags.ts` — `PRACTICE_FEATURE_FLAGS` typed array of the eight flag keys: `CLOSE_REVIEW_V1`, `AI_BUCKET_WORKFLOW_V1`, `CONDITIONAL_RULES_V1`, `CLIENT_PORTAL_V1`, `REMINDERS_V1`, `TAX_1099_V1`, `REPORT_BUILDER_V1`, `RECEIPT_PWA_V1`.
- `packages/shared/src/schemas/feature-flags.ts` — Zod schemas for flag toggle payload; `featureFlagKeySchema = z.enum(PRACTICE_FEATURE_FLAGS)`.
- `packages/shared/src/constants/user-types.ts` — `USER_TYPES = ['staff', 'client'] as const`; `type UserType = typeof USER_TYPES[number]`.

### Frontend

- `packages/web/src/api/hooks/useFeatureFlag.ts` — `useFeatureFlag(key)` and `useFeatureFlags()` hooks (TanStack Query, single network request, 5-minute staleTime).
- `packages/web/src/hooks/usePracticeVisibility.ts` — derived hook returning `{ showGroup: boolean, items: PracticeNavItem[] }` based on role, user_type, and per-child flag state. Single source of truth consumed by Sidebar and by routes for redirect-on-disabled.
- `packages/web/src/components/layout/PracticeGroup.tsx` — sidebar sub-component (mirrors existing `AdminSection` pattern): collapsible group with section dividers "Close Cycle" and "Client Communication", role/flag-gated nav items.
- `packages/web/src/features/practice/PracticeLayout.tsx` — shared `<Outlet>` wrapper with breadcrumbs (`Practice > {Child}`) and a feature-flag redirect guard that sends disabled routes to `/` with a toast.
- `packages/web/src/features/practice/placeholders/CloseReviewPlaceholder.tsx`
- `packages/web/src/features/practice/placeholders/RulesPlaceholder.tsx`
- `packages/web/src/features/practice/placeholders/ReceiptsInboxPlaceholder.tsx`
- `packages/web/src/features/practice/placeholders/Tax1099Placeholder.tsx`
- `packages/web/src/features/practice/placeholders/ClientPortalPlaceholder.tsx`
- `packages/web/src/features/practice/placeholders/RemindersPlaceholder.tsx`
- `packages/web/src/features/practice/placeholders/ReportBuilderPlaceholder.tsx`
  - Each placeholder is a shared `<ComingSoonCard feature="..." description="..." />` render (component lives in `packages/web/src/features/practice/ComingSoonCard.tsx`).
- `packages/web/src/features/practice/ComingSoonCard.tsx` — visual placeholder with feature name + one-line description.
- `packages/web/src/features/admin/FeatureFlagsPage.tsx` — super-admin-only UI to toggle flags per tenant (tenant picker + 8 toggle switches + save).

### Tests

- `packages/web/src/components/layout/PracticeGroup.test.tsx` — rendering: hidden for `user_type='client'`; hidden for `readonly`; items filtered by role; items hidden when flag off.
- `packages/web/src/hooks/usePracticeVisibility.test.ts` — unit tests for gating matrix.
- `packages/web/src/features/practice/PracticeLayout.test.tsx` — redirect when flag disabled; breadcrumb renders.
- `packages/api/src/db/schema/feature-flags.test.ts` — migration forward and reverse; new-tenant-seed hook inserts all 8 flags `enabled=true`.
- `e2e/tests/practice-sidebar.spec.ts` — Playwright: log in as staff owner — Practice group visible; log in as staff with `user_type='client'` (fixture) — Practice group not in DOM; tablet/mobile accordion behavior.

### Docs

- `packages/web/src/features/practice/README.md` — 1-page overview of the Practice subtree (for future phases).

---

## Files to modify

| File | Nature of change |
|---|---|
| `packages/api/src/db/schema/auth.ts` | Add `userType: varchar('user_type', { length: 20 }).notNull().default('staff')` to `users` table |
| `packages/api/src/db/schema/index.ts` | Export `tenant_feature_flags` schema |
| `packages/api/src/app.ts` | Mount `feature-flags.routes` at `/api/v1/feature-flags` and admin route at `/api/v1/admin/feature-flags` |
| `packages/api/src/services/auth.service.ts` | `registerUser`/`registerTenant` paths call `featureFlagsService.seedDefaultsForNewTenant(tenantId)` inserting all 8 flags with `enabled = true` |
| `packages/api/src/routes/auth.routes.ts` | `/api/v1/auth/me` response includes `userType` field |
| `packages/shared/src/types/index.ts` (or wherever `UserMe` lives) | Add `userType: UserType` to the me-payload type |
| `packages/shared/src/schemas/admin.ts` | Extend `adminCreateUserSchema` with optional `userType` (defaulting to `'staff'`); add Zod `featureFlagToggleSchema` re-export |
| `packages/web/src/api/hooks/useAuth.ts` | `useMe()` returned shape includes `userType` (type-only change if backend returns it) |
| `packages/web/src/components/layout/Sidebar.tsx` | Insert `<PracticeGroup />` between Reporting and Manage groups (per build plan line 66). Hide entirely when `meData.user.userType === 'client'`. |
| `packages/web/src/App.tsx` | Add `/practice/*` routes under the existing protected-AppShell block, wrapped in `<PracticeLayout>` |
| `packages/web/src/features/admin/index.ts` or Sidebar adminNavItems (line 64) | Add `/admin/feature-flags` entry under Admin section |

---

## Schema migrations

### `NNNN_practice_foundation.sql` (additive-only, no policy exception needed)

```sql
-- migration: practice foundation — feature flags table + user_type column

CREATE TABLE tenant_feature_flags (
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  flag_key VARCHAR(64) NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  rollout_percent INTEGER NOT NULL DEFAULT 0 CHECK (rollout_percent BETWEEN 0 AND 100),
  activated_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, flag_key)
);

CREATE INDEX idx_tenant_feature_flags_enabled
  ON tenant_feature_flags (tenant_id)
  WHERE enabled = TRUE;

ALTER TABLE users
  ADD COLUMN user_type VARCHAR(20) NOT NULL DEFAULT 'staff'
    CHECK (user_type IN ('staff', 'client'));

-- Seed the eight Practice flags for existing tenants as disabled.
INSERT INTO tenant_feature_flags (tenant_id, flag_key, enabled)
SELECT t.id, f.flag_key, FALSE
FROM tenants t
CROSS JOIN (VALUES
  ('CLOSE_REVIEW_V1'),
  ('AI_BUCKET_WORKFLOW_V1'),
  ('CONDITIONAL_RULES_V1'),
  ('CLIENT_PORTAL_V1'),
  ('REMINDERS_V1'),
  ('TAX_1099_V1'),
  ('REPORT_BUILDER_V1'),
  ('RECEIPT_PWA_V1')
) AS f(flag_key)
ON CONFLICT DO NOTHING;
```

Additive-only — no dropped columns or tables. No `-- migration-policy: non-additive-exception` marker needed.

**Backward compatibility note:** The `user_type` default ensures existing rows receive `'staff'` without downtime. No schema change required on `user_tenant_access`.

---

## New API endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/api/v1/feature-flags` | Authenticated | Returns `{ flags: { KEY: { enabled, rollout_percent } } }` for caller's tenant |
| `POST` | `/api/v1/admin/feature-flags/:tenantId/:flagKey` | Super-admin | Toggle a flag for a specific tenant. Body: `{ enabled: boolean, rolloutPercent?: number }` |

Both endpoints enforce tenant isolation via existing `req.tenantId` middleware. The admin endpoint additionally checks `req.user.isSuperAdmin === true`. All writes go through `auditLog()` with `entityType = 'feature_flag'`.

---

## New UI routes

| Path | Component | Guards |
|---|---|---|
| `/practice` | redirects to `/practice/close-review` | ProtectedRoute + staff-only |
| `/practice/close-review` | `CloseReviewPlaceholder` inside `<PracticeLayout>` | ProtectedRoute + role≥bookkeeper + `CLOSE_REVIEW_V1` flag |
| `/practice/rules` | `RulesPlaceholder` | ProtectedRoute + role≥bookkeeper + `CONDITIONAL_RULES_V1` |
| `/practice/receipts-inbox` | `ReceiptsInboxPlaceholder` | ProtectedRoute + role≥bookkeeper + `RECEIPT_PWA_V1` |
| `/practice/1099` | `Tax1099Placeholder` | ProtectedRoute + role≥bookkeeper + `TAX_1099_V1` |
| `/practice/client-portal` | `ClientPortalPlaceholder` | ProtectedRoute + role=owner + `CLIENT_PORTAL_V1` |
| `/practice/reminders` | `RemindersPlaceholder` | ProtectedRoute + role=owner + `REMINDERS_V1` |
| `/practice/report-builder` | `ReportBuilderPlaceholder` | ProtectedRoute + role≥bookkeeper + `REPORT_BUILDER_V1` |
| `/admin/feature-flags` | `FeatureFlagsPage` | ProtectedRoute + `<AdminRoute>` (super-admin only) |

Every `/practice/*` route additionally redirects to `/` (with toast "Feature not available") when `user_type === 'client'`. `/portal` routes are not introduced in this phase — that's Phase 4.

---

## Integration touchpoints with existing code

- **`useMe()` response shape.** Already consumed by sidebar and 20+ features. Adding `userType` is additive — existing consumers ignore it.
- **Existing `Sidebar.tsx` collapsible-group pattern.** `PracticeGroup` re-uses `useCollapsedGroups()` hook exported from `Sidebar.tsx` (will need to export it) so persistence key `sidebar-collapsed-groups` stays unified.
- **Admin UI.** New "Feature Flags" entry inserted into the `adminNavItems` array alongside existing super-admin links.
- **Audit log.** Flag toggles emit `auditLog(tenantId, 'update', 'feature_flag', flagKey, before, after, userId)` — reuses existing helper.

---

## Out of scope for Phase 1 (deferred to later phases)

- Any real functionality behind the placeholders (Phases 2–17).
- `/portal/*` contact-facing surface (Phase 4).
- `user_type = 'client'` user creation flow + commercial license enforcement (Phase 17 per build plan).
- Flag `rollout_percent` evaluation logic — stored but not yet consumed (later phase).

---

## Risks + mitigations

| Risk | Mitigation |
|---|---|
| Adding `user_type` to `users` breaks existing `/me` serialization for stale clients | Column is additive; old clients ignore new field |
| New-tenant seed path misses some code paths (e.g. `setup.routes.ts`, tenant import) | Centralize seed in `seedDefaultsForNewTenant()`, call from every tenant-create site; e2e test verifies flags exist after tenant creation |
| Sidebar group rendering for `user_type='client'` before backend returns field | `useMe()` guard: treat missing `userType` as `'staff'` (backwards-compatible default); explicit check in `PracticeGroup` |
| Readonly users navigating directly to `/practice/*` URL | `PracticeLayout` checks role client-side + API endpoints (once added) enforce same check server-side |
| Feature-flag cache staleness | 5-minute staleTime + invalidate on admin toggle via `queryClient.invalidateQueries(['feature-flags'])` |

---

## Open questions

> If any of these resolve differently than my assumption, I'll revise the plan before implementation.

1. **License header convention for new files.** Plan's executive summary says "Elastic License 2.0 (ELv2)" but existing files all use `// Copyright 2026 Kisaes LLC / Licensed under the PolyForm Internal Use License 1.0.0.` header, and `CLAUDE.md` + pre-commit hook enforce the PolyForm three-line header. The plan's working rule says "Every new file that is copyright-notice-bearing gets the same header the rest of the codebase uses." **My assumption:** use the existing PolyForm header unchanged. The ELv2 framing in the plan applies at the repo-/LICENSE-level, not to per-file notices. Confirm or correct.

2. **Role vocabulary.** Plan uses `Admin` / `Bookkeeper` / `Reviewer`; codebase has `owner` / `accountant` / `bookkeeper` / `readonly`. **My assumption:** `Firm Admin`≡`owner`, `Bookkeeper`≡`bookkeeper` OR `accountant`, `Reviewer` deferred to Phase 8. `readonly` users see no Practice group. Confirm or correct.

3. **`user_type` placement in Phase 1.** The commercial-license gate is not actually enforced until Phase 17 (per build plan), but the sidebar hiding rule requires the column to exist now. **My assumption:** add the column + default now, write the hide-for-client test using a fixture, leave actual `user_type='client'` creation flow for Phase 17. Confirm.

4. **New-tenant seed default.** Plan says "flags default off for existing tenants; new tenants get all flags on." **My assumption:** migration seeds existing tenants with `enabled=false`; `auth.service.ts` tenant-registration path inserts with `enabled=true`. Any other tenant-creation site (setup wizard, tenant import, super-admin tenant create) must also call `seedDefaultsForNewTenant` — will grep and wire all of them in §Step 3.

5. **Sidebar insertion point.** Plan's wireframe (line 42–69) places Practice between "Budgets" and "Settings". Current sidebar has no explicit Budgets group (budgets live in "Reporting"), and "Settings" is inside the "Manage" group. **My assumption:** insert Practice as its own labeled group between `Reporting` and `Manage` — it becomes the second-to-last group, and Settings stays in Manage. Matches the wireframe intent (Practice is near the end of the list, before Settings). Confirm.

6. **`/practice` root redirect.** Should hitting `/practice` directly go to `/practice/close-review`, or should it render a practice-landing overview? Plan calls Close Review "the landing page of the Practice tab" (line 82), so I'll redirect `/practice` → `/practice/close-review`.

If any of these need adjustment, stop me before Step 3. Otherwise I proceed as specified.

---

## Step-order for implementation (§Step 3)

1. Shared types + constants (`user-types.ts`, `feature-flags.ts`) — no runtime dependencies
2. DB schema file + migration — run locally to verify forward
3. API service + routes + tests — isolated, can run green before UI
4. `/me` endpoint adds `userType` — one-line change
5. `useFeatureFlag` hook + `usePracticeVisibility` hook + tests
6. `PracticeGroup` component + Sidebar integration + test
7. `PracticeLayout` + 7 placeholder routes wired into `App.tsx`
8. `FeatureFlagsPage` admin UI + route
9. New-tenant seed wiring in `auth.service.ts` + setup flow
10. E2E test: Playwright staff-vs-client sidebar visibility

Commit per sub-section (1.1 data layer, 1.2 sidebar, 1.3 routes, 1.4 responsive/a11y).

---

## Acceptance criteria (from build plan ship-gate)

- [ ] All 18 checklist items in Phase 1 of the build plan are implemented and verified
- [ ] `tenant_feature_flags` table exists with correct schema and forward migration
- [ ] `users.user_type` column exists, defaults to `'staff'`, CHECK constraint holds
- [ ] Eight flags seeded for every existing tenant as `enabled=false`
- [ ] New-tenant-registration path seeds all eight flags `enabled=true`
- [ ] `useFeatureFlag('KEY')` returns correct boolean for the current tenant in under 5ms on cached reads
- [ ] Practice sidebar group renders for staff users, does not render for `user_type='client'` (verified: DOM-absent, not CSS-hidden)
- [ ] Per-child role gates enforce minimum role as specified
- [ ] Each of 7 child routes navigates to a "Coming soon" placeholder under `<PracticeLayout>`
- [ ] Disabled flag → route redirects to `/` with toast
- [ ] Tablet collapsed + mobile drawer accordion work
- [ ] ARIA labels on group expand/collapse; keyboard navigation (Enter/Space + arrows)
- [ ] Admin super-admin UI at `/admin/feature-flags` toggles flags and persists to DB
- [ ] Flag toggle emits audit log event
- [ ] `pnpm test`, `pnpm test:integration`, `pnpm test:e2e`, `pnpm typecheck`, `pnpm lint` all pass
- [ ] New-code coverage ≥ 80%
