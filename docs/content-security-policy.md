# Content Security Policy

The SPA document (served by the `web` nginx container) ships a
**`Content-Security-Policy-Report-Only`** header — see the
`security-headers.conf` block in `packages/web/Dockerfile`.

Report-Only **enforces nothing**: it cannot break Plaid Link, Stripe.js,
Turnstile, PDF rendering, or any other flow. The browser instead POSTs a
violation report to `POST /api/v1/csp-report` (unauthenticated,
rate-limited), and the API logs a line:

```
[csp-report] directive=script-src-elem blocked=https://example.com/x.js
```

## Rolling it out

1. Deploy as-is (Report-Only). Exercise the real third-party flows: connect
   a bank (Plaid), take a card payment (Stripe), and load the sign-in page
   with Turnstile configured. Generate a PDF report.
2. Watch the API logs: `docker compose logs -f api | grep csp-report`.
   Each distinct `blocked=` origin is something the policy would refuse.
3. If a legitimate origin shows up, add it to the matching directive in the
   `Content-Security-Policy-Report-Only` line in `packages/web/Dockerfile`
   and rebuild. (The two inline scripts in `index.html` are already pinned
   by sha256 — a build-time guard fails the image if they drift.)
4. Once the logs are quiet under real use, **promote to enforcing**: in
   `packages/web/Dockerfile`, rename the header from
   `Content-Security-Policy-Report-Only` to `Content-Security-Policy` and
   rebuild. Now the policy actually blocks anything not allowlisted.

## Why the API's own helmet CSP still allows inline

`app.ts` sets `script-src 'self' 'unsafe-inline'` via helmet. That header
only decorates API responses — JSON (which never executes scripts) and the
super-admin-only `/api/docs` Swagger UI (which needs inline). It is not the
document CSP and is not the XSS boundary; the nginx header above is.
