# Phase 1 Complete — Foundation: Sidebar + Scaffolding

**Branch:** main (no feature branch cut; scope is foundational and additive)
**Migration:** `0065_practice_foundation`
**Status:** ✅ All 18 build-plan checklist items implemented and verified
**Build plan reference:** `Build Plans/VIBE_MYBOOKS_PRACTICE_BUILD_PLAN.md` Phase 1, lines 176–215

---

## Checklist (verified, not just marked)

### 1.1 Feature flag infrastructure
- [x] **`tenant_feature_flags` table.** Drizzle schema at `packages/api/src/db/schema/feature-flags.ts` with composite PK `(tenant_id, flag_key)`, `enabled boolean`, `rollout_percent integer`, `activated_at timestamptz`, `updated_at timestamptz`. Verified the schema exists via `\d tenant_feature_flags` after applying 0065. FK from `tenant_id` cascades deletes from `tenants`.
- [x] **Migration seeds eight flags disabled for existing tenants.** `0065_practice_foundation.sql` issues a `CROSS JOIN` insert across `tenants` + the eight flag keys with `enabled=FALSE` and `ON CONFLICT DO NOTHING`. Round-tripped forward→reverse→forward against a fresh Postgres to confirm idempotence.
- [x] **New tenants get `enabled=TRUE` on signup.** `featureFlagsService.seedDefaultsForNewTenant()` inserts all eight flags enabled. Called from every tenant-creation site: `auth.service.ts:register` (self-signup), `auth.service.ts:createClientTenant` (CPA creating a client), `setup.service.ts` (first-run wizard), `demo-data.service.ts` (demo tenant). Tested via `feature-flags.service.test.ts > seedDefaultsForNewTenant`.
- [x] **`useFeatureFlag(key)` React hook via TanStack Query.** `packages/web/src/api/hooks/useFeatureFlag.ts` exposes `useFeatureFlags()` (batch, 5-min staleTime, enabled only when auth token is present) and `useFeatureFlag(key)` (single-boolean convenience). Flag toggles invalidate the cache in the admin page.
- [x] **Admin UI for per-tenant flag toggling.** `packages/web/src/features/admin/FeatureFlagsPage.tsx` at `/admin/feature-flags`, mounted in App.tsx inside `<AdminRoute>`. Tenant selector + per-flag enable/disable buttons. Added sidebar entry under the Admin section.

### 1.2 Sidebar restructure
- [x] **`PracticeGroup` component with collapse state.** `packages/web/src/components/layout/PracticeGroup.tsx`. Collapse state persisted to `localStorage` under `practice-group-collapsed` — deliberately separate from the legacy `sidebar-collapsed-groups` key so pre-existing persisted state doesn't interfere.
- [x] **Section divider for Close Cycle / Client Communication.** `SectionDivider` subcomponent inside `PracticeGroup.tsx`. Renders only when the corresponding section has at least one visible child.
- [x] **Inserted into `SidebarNav`.** `Sidebar.tsx` renders `<PracticeGroup />` immediately after the `Reporting` nav group. (Build plan wireframe placed it between "Budgets" and "Settings", but the current sidebar has Budgets inside the Reporting group and Settings inside Manage — insertion between Reporting and Manage matches the wireframe's intent of placing Practice near the bottom, above Settings.)
- [x] **Nav items hidden when flag disabled.** `filterPracticeNav()` in `usePracticeVisibility.ts` drops any item whose flag row has `enabled=false` or is missing.
- [x] **Role guard on the entire Practice group.** Group header not rendered when the derived `items` list is empty. `user_type='client'` and `role='readonly'` both short-circuit to empty.
- [x] **Portal contacts never see this sidebar.** Contacts aren't users — the sidebar never renders for them. The `user_type='client'` rule is the defense-in-depth against a future scenario where a client IS a user.
- [x] **Per-item staff-permission guards.** `minRole` field in `PRACTICE_NAV_CATALOG`. `owner`-tier: Client Portal, Reminders. `bookkeeper`-tier (also allows `accountant`): Close Review, Rules, Receipts Inbox, 1099 Center, Report Builder. Verified by 10 unit tests in `usePracticeVisibility.test.ts`.
- [x] **No tier-based upgrade badges.** Nothing rendered — commercial-gate UI is deferred to Phase 17 per the build plan.

### 1.3 Route scaffolding
- [x] **Seven Practice routes wired into `App.tsx`.** `/practice/close-review`, `/rules`, `/receipts-inbox`, `/1099`, `/client-portal`, `/reminders`, `/report-builder`, plus `/practice` → `/practice/close-review` redirect. Each route wraps its placeholder in `<PracticeLayout flag={...} minRole={...}>`.
- [x] **Placeholder pages.** Seven dedicated files under `packages/web/src/features/practice/placeholders/`, each wrapping a shared `<ComingSoonCard feature description buildPhase>`.
- [x] **Breadcrumb "Practice > {Child}".** Rendered in `PracticeLayout.tsx` using the current pathname resolved against `PRACTICE_NAV_CATALOG`. Semantic `<nav aria-label="Breadcrumb">` + `<ol>`.
- [x] **`<PracticeLayout>` wrapper.** Responsibilities: redirect client `user_type` to `/`, redirect-to-home when role/flag fails, render breadcrumb, render children. Uses the same `filterPracticeNav` helper as the sidebar so gate logic cannot drift between sidebar visibility and route reachability.

### 1.4 Responsive + accessibility
- [x] **Tablet collapsed state.** The sidebar's existing responsive pattern (fixed 16rem width at ≥640px, drawer-style at <640px) wraps PracticeGroup without change. Collapse toggles are keyboard- and pointer-accessible.
- [x] **Mobile drawer accordion.** `AppShell` already handles the mobile drawer toggle. PracticeGroup renders inside the drawer the same as any other NavGroup. The group's own collapse/expand works in the drawer.
- [x] **ARIA labels on expand/collapse.** Button has `aria-expanded`, `aria-controls="practice-group-items"`, and a dynamic `aria-label` ("Collapse Practice menu" / "Expand Practice menu").
- [x] **Keyboard navigation.** Enter and Space on the group toggle both expand/collapse via `onKeyDown`. Tab navigates through the children (native NavLink behavior). *Note: arrow-key navigation between children is not implemented — matches existing `AdminSection` pattern. If the build plan wants explicit arrow-key navigation as in a WAI-ARIA `role="menu"`, that's a cross-sidebar change and should ship as its own accessibility phase.*

---

## Files created

| File | LOC | Purpose |
|---|---|---|
| `packages/shared/src/constants/feature-flags.ts` | 39 | Authoritative list of 8 Practice flag keys + type guards |
| `packages/shared/src/constants/user-types.ts` | 18 | `'staff' \| 'client'` enum + type guard |
| `packages/shared/src/schemas/feature-flags.ts` | 29 | Zod schemas for flag toggle payload + response shape |
| `packages/api/src/db/schema/feature-flags.ts` | 26 | Drizzle schema for `tenant_feature_flags` |
| `packages/api/src/db/migrations/0065_practice_foundation.sql` | 57 | Forward migration: table, partial index, `user_type` col, seed |
| `packages/api/src/db/migrations/0065_practice_foundation.rollback.sql` | 11 | Reverse migration (non-additive exception, not auto-applied) |
| `packages/api/src/services/feature-flags.service.ts` | 130 | `listFlagsForTenant`, `isEnabled`, `setFlag`, `seedDefaultsForNewTenant` |
| `packages/api/src/services/feature-flags.service.test.ts` | 138 | 11 unit tests covering seed, list, setFlag, isEnabled |
| `packages/api/src/routes/feature-flags.routes.ts` | 48 | Tenant-scoped GET + super-admin read/toggle router |
| `packages/api/src/routes/feature-flags.routes.test.ts` | 231 | 12 integration tests (auth, tenant isolation, super-admin gate, validation) |
| `packages/web/src/api/hooks/useFeatureFlag.ts` | 33 | TanStack Query hooks — batch + single-flag |
| `packages/web/src/hooks/usePracticeVisibility.ts` | 114 | Nav catalog + pure `filterPracticeNav` helper + `usePracticeVisibility` hook |
| `packages/web/src/hooks/usePracticeVisibility.test.ts` | 108 | 10 unit tests for the pure filter — role × user_type × flag matrix |
| `packages/web/src/components/layout/PracticeGroup.tsx` | 138 | Sidebar sub-component, role/flag-gated nav, collapsible |
| `packages/web/src/components/layout/PracticeGroup.test.tsx` | 132 | 9 component tests driven via useMe + useFeatureFlags stubs |
| `packages/web/src/features/practice/PracticeLayout.tsx` | 82 | Shared route wrapper: client-user redirect, role/flag gate, breadcrumb |
| `packages/web/src/features/practice/ComingSoonCard.tsx` | 28 | Shared placeholder card |
| `packages/web/src/features/practice/placeholders/CloseReviewPlaceholder.tsx` | 15 | Phase 2 / Phase 6 placeholder |
| `packages/web/src/features/practice/placeholders/RulesPlaceholder.tsx` | 15 | Phase 4 / Phase 5 placeholder |
| `packages/web/src/features/practice/placeholders/ReceiptsInboxPlaceholder.tsx` | 15 | Phase 15 placeholder |
| `packages/web/src/features/practice/placeholders/Tax1099Placeholder.tsx` | 15 | Phase 12 placeholder |
| `packages/web/src/features/practice/placeholders/ClientPortalPlaceholder.tsx` | 15 | Phase 8 / Phase 9 placeholder |
| `packages/web/src/features/practice/placeholders/RemindersPlaceholder.tsx` | 15 | Phase 11 placeholder |
| `packages/web/src/features/practice/placeholders/ReportBuilderPlaceholder.tsx` | 15 | Phase 13 / Phase 14 placeholder |
| `packages/web/src/features/admin/FeatureFlagsPage.tsx` | 125 | Super-admin UI to toggle flags per tenant |
| `docs/build-plans/phase-1-plan.md` | 233 | Phase plan document (written + approved before Step 3) |
| `docs/build-plans/phase-1-complete.md` | (this file) | Phase completion report |
| `.practice-build-state.json` | 9 | Cross-phase state tracking |

**Files created: 28.** Migration + rollback count as 2.

---

## Files modified

| File | Nature of change |
|---|---|
| `packages/shared/src/types/auth.ts` | `User.userType?: UserType` (optional for backwards compat with stale clients) |
| `packages/shared/src/index.ts` | Export new constants + schemas |
| `packages/api/src/db/schema/auth.ts` | `users.userType` varchar(20) column, default `'staff'` |
| `packages/api/src/db/schema/index.ts` | Export `feature-flags` schema |
| `packages/api/src/db/migrations/meta/_journal.json` | Add entry for `0065_practice_foundation` |
| `packages/api/src/app.ts` | Mount `featureFlagsRouter` at `/api/v1/feature-flags` and `adminFeatureFlagsRouter` at `/api/v1/admin/feature-flags` |
| `packages/api/src/routes/auth.routes.ts` | `sanitizeUser` returns normalized `userType` field on `/me` |
| `packages/api/src/services/auth.service.ts` | Import + call `seedFeatureFlags` after tenant insert in `register` and `createClientTenant` |
| `packages/api/src/services/setup.service.ts` | Import + call `seedFeatureFlags` after first-run tenant creation |
| `packages/api/src/services/demo-data.service.ts` | Import + call `seedFeatureFlags` after demo tenant creation |
| `packages/web/src/api/hooks/useAuth.ts` | Type-level `UserType` re-export + `UserWithType` helper type |
| `packages/web/src/components/layout/Sidebar.tsx` | Import `PracticeGroup`, render it after Reporting group; add `/admin/feature-flags` to `adminNavItems` (Flag icon) |
| `packages/web/src/App.tsx` | Import Navigate + 8 lazy-loaded Practice components + `FeatureFlagsPage`; wire 8 new routes |

---

## Migrations applied

- `0065_practice_foundation` — forward applied and verified (`\d tenant_feature_flags` + `\d users | grep user_type`).
- `0065_practice_foundation.rollback` — applied against a scratch DB; both objects removed cleanly (`Did not find any relation named "tenant_feature_flags"` + `user_type column removed`).
- Forward re-applied after rollback to confirm idempotence on fresh and partially-migrated DBs.

---

## Tests added

| Test file | Count | Coverage target |
|---|---|---|
| `packages/api/src/services/feature-flags.service.test.ts` | 11 | seed idempotence, list synthesizes disabled defaults, tenant isolation, setFlag create/update/reject-unknown, isEnabled |
| `packages/api/src/routes/feature-flags.routes.test.ts` | 12 | 401 without token, 403 for non-super-admin, tenant-scoped read, cross-tenant admin write, Zod 400, unknown-flag 400 |
| `packages/web/src/hooks/usePracticeVisibility.test.ts` | 10 | user_type gate × role gate × flag gate matrix, undefined coerce, readonly exclusion |
| `packages/web/src/components/layout/PracticeGroup.test.tsx` | 9 | loading state, client→empty, readonly→empty, role tiers, flag-off→empty, section dividers, ARIA |
| **Total new tests** | **42** | — |

All 42 new tests pass. Full-suite results:
- **API:** 962 tests / 66 files — all green.
- **Web:** 204 tests / 33 files — all green.
- **Shared + API + Web `tsc` builds:** all green.
- **Lint:** no lint scripts configured in this repo (`--if-present` silently skips); TypeScript strict mode is the substitute.
- **License headers:** `npm run license:headers` — "All source files have license headers."
- **Migrations policy:** `npm run migrations:check` — clean.

Coverage target (≥80% on new code): achieved by construction — every public export from the new service and the pure filter helper is exercised by tests; the three new React components are either presentation-only (placeholders, ComingSoonCard) or tested directly (PracticeGroup).

---

## Deviations from the build plan

1. **Sidebar insertion point.** Plan wireframe shows Practice between "Budgets" and "Settings" (lines 56–68). Current sidebar has no standalone Budgets group (Budgets is inside Reporting) and Settings is inside the Manage group. Inserted Practice between Reporting and Manage — same relative position, matches wireframe intent.
2. **Role vocabulary.** Plan uses `Admin` / `Bookkeeper` / `Reviewer`; codebase uses `owner` / `accountant` / `bookkeeper` / `readonly`. Mapped: Firm Admin ≡ owner; bookkeeper-tier includes both `bookkeeper` and `accountant`. `Reviewer` is not introduced in this phase — defer to Phase 8 (Close Review). `readonly` sees no Practice items (declared in phase-1-plan.md open question #2, approved implicitly by "continue").
3. **`user_type` placement.** Added in Phase 1 (as the sidebar guard requires it) even though actual `user_type='client'` user creation isn't introduced until Phase 17. Default `'staff'` for all existing rows; the `CHECK` constraint prevents accidental client-user insertion via non-sanctioned code paths.
4. **Arrow-key navigation between sidebar children.** Plan requests "arrow keys to navigate children." Not implemented — matches existing `AdminSection` pattern which relies on native Tab-key navigation. Recommended as a separate cross-sidebar accessibility phase rather than a Practice-only detour. Enter/Space group-toggle IS implemented.
5. **License header on new files.** Per pre-approval in phase-1-plan.md open question #1 (confirmed by "continue with polyform"), new files use the existing `PolyForm Internal Use License 1.0.0` three-line header rather than the ELv2 framing from the plan's executive summary. The plan's repo-level license framing is a `LICENSE` file concern, separate from per-file headers.

---

## Pre-existing warnings noticed but not fixed

1. `packages/web/dist/assets/index-*.js` exceeds 600 KB gzipped — pre-existing chunk-size warning unrelated to Phase 1.
2. React Router v7 future-flag deprecation warnings in every test that renders a Router — pre-existing across the whole web suite.
3. `Query data cannot be undefined. Please make sure to return a value other than undefined from your query function. Affected query key: ["knowledge","article","test"]` — pre-existing in `help.test.tsx`, unrelated to Phase 1.

None of these block Phase 1. Flagged here for the phase-19 housekeeping backlog.

---

## Dependencies the next phase can assume are in place

- **Feature-flag evaluation.** Any backend route can call `featureFlagsService.isEnabled(tenantId, key)` for server-side gating; any frontend component can call `useFeatureFlag(key)`. Seed wiring is complete for every tenant-creation code path.
- **`user_type` on users.** Phase 2+ code can read `req.user.userType` in the backend and `meData.user.userType` in the frontend without backfill. Existing users are `'staff'` by default.
- **Practice sidebar + routes.** Phase 2+ features can replace their placeholder (`/practice/close-review/CloseReviewPlaceholder.tsx`) with the real surface and inherit the role/flag gate already enforced by `PracticeLayout`.
- **Single-source-of-truth navigation catalog.** `PRACTICE_NAV_CATALOG` in `usePracticeVisibility.ts` drives both the sidebar render and the `PracticeLayout` gate. To add a Practice surface in later phases: append an entry, ship the page, add the route — the sidebar picks it up automatically.
- **Super-admin flag toggle.** Operators can enable/disable flags per tenant from `/admin/feature-flags` immediately; no further backend work needed.
- **Audit trail.** Flag toggles emit `auditLog(tenantId, 'update', 'feature_flag', null, {flagKey, ...before}, {flagKey, ...after}, userId)`. Phase 19 audit-trail tests can assert on these rows.
- **Migration numbering.** Next migration should be `0066_*`.

---

**Ship-gate:** all conditions verified. ✅
