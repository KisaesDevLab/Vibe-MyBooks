# Dependency Audit

Audit date: **2026-04-14**
Node: **v20.15.0** · npm: **10.7.0**

Generated from `npm outdated --long` and `npm audit` against the current `package-lock.json`. Re-run both commands to refresh.

## Summary

- **1010 total dependencies** (676 prod / 303 dev / 155 optional / 2 peer).
- **26 direct deps behind latest** across the four workspaces.
- **8 moderate-severity advisories**, all rooted in `esbuild ≤ 0.24.2` (pulled in by `vite@5` and an old `@esbuild-kit/*` under `drizzle-kit`).
- **0 high / 0 critical.** No deprecation warnings printed during `npm install --dry-run`.

Fix priorities: **security → breaking majors on user-facing surfaces (uploads, auth, PDF) → everything else.**

## Security advisories

All eight findings chain back to two direct deps: `vite` and `vitest` (via `esbuild`), plus `drizzle-kit` (via `@esbuild-kit/*`). Fixing the two direct deps clears the transitive set.

| Advisory | Severity | Direct fix | Through |
|---|---|---|---|
| [GHSA-67mh-4wv8-2f99](https://github.com/advisories/GHSA-67mh-4wv8-2f99) — esbuild dev-server request smuggling | moderate | `vite ≥ 6.4.2`, `vitest ≥ 3` | `esbuild ≤ 0.24.2` |
| [GHSA-4w7w-66w2-5vf9](https://github.com/advisories/GHSA-4w7w-66w2-5vf9) — Vite path traversal via `.map` | moderate | `vite ≥ 6.4.2` | direct |
| `@esbuild-kit/*` (abandoned) | moderate | `drizzle-kit ≥ 0.19` | `drizzle-kit@0.31.10` |

All three are development-only (Vite dev server, Vitest runner, drizzle-kit CLI). Not a production runtime risk, but the warnings will surface on every `npm install` and during CI.

## Outdated direct dependencies

Current = what's installed per the lockfile. "Manifest" = the range in `package.json`.

### Production deps

| Package | Manifest | Current | Latest | Category | Notes |
|---|---|---|---|---|---|
| `@anthropic-ai/sdk` | ^0.82.0 | 0.82.0 | 0.89.0 | SDK minor | Pre-1.0, check changelog; used in `packages/api/src/services/ai/`. |
| `@google/genai` | ^1.48.0 | 1.50.0 | 1.50.1 | patch | Safe bump. |
| `express` | ^4.21.0 | 4.22.1 | **5.2.1** | **breaking major** | Router internals + async error handling changed. Every route exercises this. |
| `express-rate-limit` | ^7.4.0 | 7.5.1 | **8.3.2** | breaking major | Store interface changed in v8. |
| `helmet` | ^7.1.0 | 7.2.0 | **8.1.0** | breaking major | CSP defaults stricter in v8 — retest UI loads. |
| `multer` | ^1.4.5-lts.1 | 1.4.5-lts.2 | **2.1.1** | **breaking major** | 1.x is EOL'd. v2 changes file-parsing + error shape. Touches every upload route. |
| `lucide-react` | ^0.441.0 | 0.441.0 | **1.8.0** | breaking major | Icon set gained first stable release; a few icon names renamed. |
| `react` / `react-dom` | ^18.3.1 | 18.3.1 | **19.2.5** | breaking major | Compiler, new hooks, stricter StrictMode. TanStack Query, Router, Recharts, Plaid-Link, Stripe-React all need compat re-check. |
| `react-router-dom` | ^6.26.0 | 6.30.3 | **7.14.1** | breaking major | v7 is the former Remix merge. Data-router APIs shift. Bundle with the React 19 bump. |
| `zod` | ^3.23.0 | 3.25.76 | **4.3.6** | breaking major | v4 tightened type inference; error shape changed. Touches every Zod schema in `packages/shared/src/schemas/` and every route validator. |

### Dev deps

| Package | Manifest | Current | Latest | Category | Notes |
|---|---|---|---|---|---|
| `@types/bcrypt` | ^5.0.2 | 5.0.2 | 6.0.0 | breaking major | Follow `bcrypt` runtime. |
| `@types/express` | ^4.17.21 | 4.17.25 | 5.0.6 | breaking major | Follow `express` runtime. |
| `@types/multer` | ^1.4.12 | 1.4.13 | 2.1.0 | breaking major | Follow `multer` runtime. |
| `@types/nodemailer` | ^7.0.11 | 7.0.11 | 8.0.0 | minor | `nodemailer` runtime is 8.x already — types lagging. Low risk. |
| `@types/react` / `@types/react-dom` | ^18.3.x | 18.3.28 / 18.3.7 | 19.2.14 / 19.2.3 | breaking major | Bundle with React 19 bump. |
| `@vitejs/plugin-react` | ^4.3.1 | 4.7.0 | **6.0.1** | breaking major | Follows `vite` major. |
| `tailwindcss` | ^3.4.11 | 3.4.19 | **4.2.2** | **rewrite** | v4 is CSS-first config, new `@tailwindcss/postcss`. Large UI churn — **defer to its own PR.** |
| `typescript` | ^5.5.0 | 5.9.3 | 6.0.2 | breaking major | v6 dropped some deprecated flags; likely low impact here. |
| `vite` | ^5.4.6 | 5.4.21 | **8.0.8** | breaking major | Also **fixes security advisories**. Dropped Node 18, tightened ESM. |
| `vitest` | ^2.0.0 | 2.1.9 | **4.1.4** | breaking major | Config shape changed in v3 and again in v4. Also fixes advisories. |

## Recommended action plan

**Three tranches**, each its own PR so regressions are bisectable.

### Tranche 1 — security + non-breaking sweep (small, do first)

1. Bump `@google/genai` patch.
2. `vite 5 → 6` (or 7 if 6→7 is clean for us) + `@vitejs/plugin-react` matching major. Clears 4 advisories.
3. `vitest 2 → 3` (or 4 if tests pass cleanly). Clears the remaining Vitest-path advisories.
4. `drizzle-kit` bump to a version off the `@esbuild-kit/*` chain. Clears the last advisory.
5. `npm audit` must report **0 vulnerabilities** after this tranche.

Verification: `npm run build --workspaces`, `npm run test --workspaces`, `docker compose -f docker-compose.prod.yml build`.

### Tranche 2 — backend-surface majors (server-side only)

One commit per row, in this order:

1. `bcrypt` runtime confirmed happy on Alpine musl → bump `@types/bcrypt` to 6.
2. `multer 1 → 2` + `@types/multer 2`. Touch every file-upload route under `packages/api/src/routes/`. Test: upload a receipt; upload an oversized file; upload a wrong-MIME file.
3. `helmet 7 → 8`. Test: frontend loads without CSP console errors; inline styles / fonts still render.
4. `express-rate-limit 7 → 8`. Test: login rate-limit still 429s on burst.
5. `express 4 → 5` + `@types/express 5`. Largest blast radius — run the full E2E suite. Any `next(err)` patterns should become `throw` or `return next(err)` per v5 async-error semantics.
6. `@anthropic-ai/sdk` and other AI SDKs — bump one at a time, verify the services under `packages/api/src/services/ai/`.
7. `typescript 5 → 6` + `drizzle-kit` to latest compatible.
8. `zod 3 → 4`. Touches `packages/shared/src/schemas/`. Update validators, review any `.parse()` error-handling paths that read `.errors` vs `.issues`.

### Tranche 3 — frontend-surface majors (own PR, probably own release)

1. `react 18 → 19` + `react-dom` + `@types/react*` + check: `@tanstack/react-query` v5 is React 19 compatible (already), `@stripe/react-stripe-js`, `react-plaid-link`, `recharts`, `lucide-react`.
2. `react-router-dom 6 → 7`. Bundle with React 19.
3. `lucide-react 0.x → 1.x`. Rename removed/changed icon imports.
4. `tailwindcss 3 → 4`. Its own PR after React 19 lands. CSS-first config migration is substantial.

## Base images

Audit also covers container bases; verify on bump day, don't upgrade blind:

| Image | Pinned in | Risk |
|---|---|---|
| `node:20-alpine` | `Dockerfile` × 3 stages, `packages/api/Dockerfile`, `packages/web/Dockerfile` | Node 20 is LTS through 2026-04-30 → bump to `node:22-alpine` (current LTS). Smoke-test Puppeteer/Chromium on musl. |
| `postgres:16-alpine` | `docker-compose.yml`, `docker-compose.prod.yml` | **Do not bump.** A Postgres major requires a dump/restore migration plan for existing installs. |
| `redis:7-alpine` | `docker-compose.yml`, `docker-compose.prod.yml` | Stay on 7.x (latest patch is fine). Skip v8. |

## Deferred — intentionally not upgrading now

- **Postgres 16 → 17**: needs a data-migration runbook for existing self-hosted installs.
- **Tailwind 3 → 4**: own PR after React 19.

## How to re-run this audit

```bash
# From repo root
npm outdated --long
npm audit
npm install --dry-run 2>&1 | grep -E "^npm warn deprecated" | sort -u
```

If any of the three produces output that isn't already in this file, update this document rather than letting it drift.
