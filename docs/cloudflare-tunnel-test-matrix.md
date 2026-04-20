# Cloudflare Tunnel — Test Matrix

Companion to `Build Plans/CLOUDFLARE_TUNNEL_PLAN.md` Phase 11. The automated tests cover unit-level behaviour; this matrix tracks the manual / deployment tests that need a real Cloudflare account, appliance host, and external network to exercise end-to-end.

Run this matrix before every beta-firm onboarding until Phase 12 exits ("Publish publicly").

## Automated coverage (in-tree)

| Area | Where | Count |
|---|---|---|
| HIBP k-anonymity check | `utils/hibp.test.ts` | 6 |
| Turnstile siteverify helper | `utils/turnstile.test.ts` | 7 |
| Stripe webhook IP allowlist | `utils/stripe-ip-allowlist.test.ts` | 6 |
| Cloudflared metrics parser + scraper | `services/cloudflared/status.service.test.ts` | 8 |
| Staff IP allowlist (CIDR parser, CRUD, membership) | `services/staff-ip-allowlist.service.test.ts` | 15 |
| Staff IP allowlist middleware (env, bypass, empty) | `middleware/staff-ip-allowlist.test.ts` | 6 |
| **Total from this workstream** | | **48** |

Run with: `cd packages/api && npx vitest run src/utils/hibp src/utils/turnstile src/utils/stripe-ip src/services/cloudflared src/services/staff-ip src/middleware/staff-ip`

---

## Manual test matrix

### 1. Staff login from external network

| Step | Expected |
|---|---|
| From off-LAN device, visit `https://mybooks.firm.com/login` | Page loads over HTTPS (CF cert). Turnstile widget renders. |
| Enter credentials, solve challenge, submit | 302 or 200 with JWT cookie set. Lands on Dashboard. |
| If MFA enforced: prompted for TOTP / passkey | Second factor completes. Session established. |
| Log out, log back in from same IP 6 times with wrong password | Account locks after 5 with `ACCOUNT_LOCKED` code. |

**Pass criteria:** external login works on the intended hostname, HTTPS is valid, Turnstile enforces, lockout fires at 5.

### 2. Password breach blocking

| Step | Expected |
|---|---|
| Register a new account with password `password` | 400 `PASSWORD_BREACHED` error (HIBP reports millions of hits). |
| Register with a strong random password | 201 success. |

Skip this test on LAN-only installs that have `HIBP_DISABLED=1` set.

### 3. Per-account login rate limit

| Step | Expected |
|---|---|
| Submit 10 login attempts against the same email in 1 minute (wrong password) | Each attempt returns 401 INVALID_CREDENTIALS. |
| 11th attempt within the 15-minute window | 429 `ACCOUNT_RATE_LIMIT`. |
| Switch to a second email, attempt login | Second email is unaffected (per-account keyed, not per-IP). |

### 4. Turnstile enforcement

| Step | Expected |
|---|---|
| Open login page with TURNSTILE_SITE_KEY configured | Widget renders. Submit button disabled until widget resolves. |
| Tamper DOM to remove `turnstileToken` from request body, submit | 400 `TURNSTILE_FAILED`. |
| Unset `TURNSTILE_SECRET_KEY` on the appliance, restart api | Widget disappears; login works without challenge (dev-mode path). |

### 5. Stripe webhook delivery

| Step | Expected |
|---|---|
| `stripe listen --forward-to https://mybooks.firm.com/api/v1/stripe/webhook/<company-uuid>` | Stripe CLI connects, shows "Ready". |
| `stripe trigger invoice.paid` | 200 from server. Audit row + transaction row visible in admin UI. |
| Repeat with an invalid signature (edit the forwarded secret) | 200 to keep Stripe from retrying, but no side effects. Server logs the signature mismatch. |

### 6. Tunnel failure recovery

| Step | Expected |
|---|---|
| `docker compose --profile tunnel stop cloudflared` | App still reachable on LAN (`http://<host>:3001`). External hostname unreachable. |
| Admin Dashboard opens on LAN | Tunnel status card shows grey "Sidecar not running". |
| `docker compose --profile tunnel up -d cloudflared` | Within 60s the tunnel status flips green. External hostname reachable again. |
| No manual app restart required | ✓ |

### 7. Load test (light)

| Step | Expected |
|---|---|
| 50 concurrent authenticated sessions (hey / k6 script) against `GET /api/v1/dashboard` through the tunnel | p99 latency < 1 s under the tunnel. 0 500-errors. 0 429s below the global 300/min limit. |

Scale is deliberately modest — the tunnel and Turnstile are the only new surfaces on the hot path, and this test catches pathological perf regressions, not load-balancing capacity.

### 8. Staff IP allowlist (Phase 6, optional)

Only run when a firm has opted into `STAFF_IP_ALLOWLIST_ENFORCED=1`.

| Step | Expected |
|---|---|
| Add office CIDR to the allowlist via POST /admin/ip-allowlist | 201 + entry in GET /admin/ip-allowlist. |
| Log in from allowed CIDR | Success. |
| Log in from non-allowed CIDR with a regular-staff account | 403 `STAFF_IP_BLOCKED`. |
| Log in from non-allowed CIDR with a super-admin account | Success (break-glass). |
| Portal route (`/api/v1/public/...`) from non-allowed CIDR | Accessible (portal + webhook paths are deliberately exempt). |

---

## Regression sentinel

After every minor release: run the first four items above against a staging appliance with a test CF account. Takes ~15 minutes and catches breakage in the two most common failure modes (tunnel registration, Turnstile verification).
