# Peer Screen Share (rrweb DOM mirroring)

Implementation of the *MyBooks Addendum: Peer Screen Share*. Any MyBooks user
can share their in-app screen, live and read-only, with one or more other
MyBooks users — each individually approved by name. The DOM is mirrored
(`rrweb` events over a WebSocket relay), never pixels: PII is masked in the
sharer's browser **before any byte leaves it**, bandwidth is ~three orders of
magnitude below video, and multi-viewer fan-out is server-side pub/sub.

Feature is **off by default** (`SHARE_ENABLED=false`). When off, no share
route exists (404, not 403), no WS endpoint is mounted, and no rrweb code is
ever downloaded by clients.

## Phase 0 findings (recorded per addendum §Phase 0)

| Check | Result |
|---|---|
| 0.1 HTTP server accessible for WS attach | Yes — `app.listen()` returns `http.Server` in `packages/api/src/index.ts`; gateway attaches via `server.on('upgrade')` |
| 0.2 Cloudflare Tunnel WS pass-through | cloudflared proxies WebSocket by default for HTTP hostnames; verify live with `wscat -c wss://<host>/ws/share` after enabling (expects 4001 auth-timeout close after 5 s — that IS the pass-through proof) |
| 0.3 Reverse proxy | The stack uses **nginx** (web container), not Caddy. `/ws/` location added to `packages/web/Dockerfile` with `proxy_http_version 1.1` + `Upgrade`/`Connection` headers + 3900 s read timeout |
| 0.4 CSP | helmet defaults: `default-src 'self'` (no explicit `frame-src` → inherits `'self'`). The rrweb Replayer iframe is same-origin/srcless and sandboxed `allow-same-origin` — no CSP change required |
| 0.5 rrweb pin | **rrweb 1.1.3** (exact, in `packages/web/package.json`) |
| 0.6 v1 API surface verified against 1.1.3 | `MaskTextFn = (text: string) => string` and `MaskInputFn = (text: string) => string` — **text-only, no element** (D1 confirmed). `maskTextSelector`, `blockSelector`, `maskAllInputs`, `maskInputOptions` present. `record.takeFullSnapshot(isCheckout?)` present. `Replayer` ctor accepts `liveMode: true`; `startLive(baselineTime?)` present |
| 0.7 Bandwidth spike | `packages/web/src/features/share/spike.bandwidth.test.ts` (kept as a CI regression): 500-row register DOM, one modeled minute of scrolling/search/recategorization → FullSnapshot ≈ 433 KB one-time, incremental ≈ **0.34 KB/s** — far under the 100 KB/s abort ceiling |
| 0.8 Fan-out linearity | Architectural: the sharer uploads ONE event stream; the server publishes to `share:session:{id}:stream` and each instance forwards to its local viewer sockets. Viewer count never touches the sharer's upstream |

## Architecture

```
sharer browser                    api instance(s)                  viewer browser(s)
rrweb.record ──batches──► WS /ws/share ──publish──► Redis pub/sub ──► WS ──► Replayer(liveMode)
   ▲   masking runs here      │ ticket auth            │ per-session channel
   └── pointer highlights ◄───┴── to-sharer channel ◄──┴── pointer clicks (10/s cap)
```

- **REST** (`/api/v1/share/*`, `packages/api/src/routes/share.routes.ts`):
  session lifecycle, per-viewer approval, tickets, admin log/settings.
- **WS gateway** (`services/share/share-gateway.ts`): Origin-checked upgrade,
  first-message single-use ticket (30 s TTL, Redis `GETDEL`), 256 KB frame
  cap, per-session byte cap, 20 s ping / 2-miss termination, sharer-only
  `events`, sharer-disconnect ends the session.
- **Redis** (`services/share/share-redis.ts`): stream + to-sharer channels per
  session, control channel (kill switch / eject / cross-instance), snapshot
  cache (latest Meta+FullSnapshot, session TTL), presence, byte counters,
  code-failure counters. **No rrweb payload ever reaches Postgres or disk** —
  asserted structurally in `share-gateway.test.ts`.
- **Sweeper** (`services/share/share-sweeper.ts`): 15 s lifecycle sweep
  (TTL expiry, idle timeout, approval lapse) + hourly retention check
  (3-year audit purge), advisory-locked like the other appliance schedulers.

### Session + participant state machines

`share_sessions.status`: `pending → active → ended | expired | revoked`.
`share_session_participants.status`: `requested → approved | denied | lapsed`,
`approved → ejected | left`. `denied`/`ejected` are permanent per session;
`lapsed`/`left` may re-request (same row is reset — the
`(session_id, viewer_user_id)` unique index holds).

**The consent gate (the property everything else leans on):** a participant
that is not `approved` can never obtain a WS ticket (`409` while `requested`,
`403` after deny/eject), and only ticket-authenticated sockets are ever
subscribed to the stream. A leaked join code yields a named approval prompt
on the sharer's screen and nothing else.

## Configuration

Env vars (see `.env.example`): `SHARE_ENABLED`, `SHARE_SCOPE`
(`any`|`tenant`|`tenant_and_linked`), `SHARE_TTL_MINUTES` (60),
`SHARE_IDLE_TIMEOUT_SECONDS` (90 — the real exposure bound),
`SHARE_APPROVAL_WINDOW_SECONDS` (60), `SHARE_MAX_VIEWERS_PER_SESSION` (5),
`SHARE_MAX_CONCURRENT_PER_TENANT` (10), `SHARE_MAX_BYTES_PER_SESSION` (50 MB),
`SHARE_AUDIT_RETENTION_DAYS` (1095).

Runtime layers on top of the env master switch:

1. **Kill switch** — `system_settings.share_kill_switch = '1'` terminates all
   live sessions on the next control-channel delivery and 404s the feature
   (`shareService.setKillSwitch(true)`).
2. **Tenant** — `tenants.share_settings` JSONB: `{ enabled: null|bool,
   allowInboundCrossFirm: bool }`. Settings → Screen Sharing (firm owners).
3. **User** — `users.share_allowed` tri-state (D9). Revoking ends the user's
   live sessions immediately, as sharer AND viewer.

## PII masking policy (Phase 8) — component audit

Global posture: **`maskAllInputs: true`** — every input on every route is
masked with a fixed-length mask (`maskInputFixed`, width never leaks length).
All text nodes pass through `redactSensitiveText` (SSN/ITIN `xxx-xx-xxxx`,
EIN `xx-xxxxxxx`, ABA routing numbers with checksum validation, 13–19-digit
Luhn-valid card numbers). Element-scoped decisions use selectors (D1 — rrweb
v1 mask fns receive text only). Class conventions: `rr-block` (subtree
replaced by placeholder), `rr-mask` (text bulleted), `rr-ignore` (input events
never captured); `data-share-block` / `data-share-mask` attribute equivalents.

| Surface | Decision | Mechanism |
|---|---|---|
| Every `<input>`, app-wide | **Masked** (fixed length) | `maskAllInputs` + `maskInputFn` |
| Password fields, MFA/OTP entry | **Blocked** | `blockSelector`: `input[type=password]`, `autocomplete=one-time-code` |
| API Keys page (`/settings/api-keys`) | **Blocked** | `data-share-block` on page root |
| Installation Security (recovery key) | **Blocked** | `data-share-block` |
| MFA settings, Login-method settings | **Blocked** | `data-share-block` |
| Plaid config, AI config (provider keys) | **Blocked** | `data-share-block` |
| Team / user administration | **Blocked** | `data-share-block` |
| Check Print Settings (bank routing + account + MICR) | **Blocked** | `data-share-block` |
| SSN/EIN/routing/card digits in any text | **Redacted** | `maskTextFn` patterns |
| Bank connections list | **Intentionally visible** — shows institution + last-4 mask only (`****1234`) | — |
| Transaction registers, reports, invoices, bills | **Intentionally visible** — the point of a support share; amounts/payees are the content being discussed. Tax IDs inside them still pattern-redact | — |
| Dashboards, charts | **Intentionally visible** | — |
| Attachment/document images | **Not transmitted** — `inlineImages: false`; images stay URL references that resolve only with the viewer's own authenticated session (a cross-firm viewer's fetch of the sharer's document 401s) | Verified: attachment URLs require Authorization |
| Join code display in the share modal | **Masked** | `data-share-mask` (a viewer must never learn the code from the mirror itself) |

**Default posture for new components is masked** (all inputs are). A new
component that *displays* secrets as text must add `rr-block`/`rr-mask` — this
is called out in the PR checklist; a dedicated ESLint rule was considered and
deferred (flagging "new input components" is meaningless under global
`maskAllInputs`; the true risk is secret *display* surfaces, which lint can't
recognize).

Regression gates: `packages/web/src/features/share/masking.test.ts` (pattern
fixtures incl. near-miss negatives) and `spike.bandwidth.test.ts` (asserts a
typed SSN never appears in the serialized stream).

## Abuse handling (Phase 13)

- Rate limits: 5 session creations/user/hour; 10 code submissions/user/hour;
  20/IP/hour (Redis-backed when `RATE_LIMIT_REDIS=1`).
- Brute force: 10 consecutive invalid codes → 1-hour lockout + email to the
  viewer's tenant admins.
- Anomaly alerts (email + structured log): ≥5 distinct sharers requested in an
  hour, or ≥3 cross-firm approved views in a day — compromised-account shapes.
- First-ever cross-firm share by a user → "was this expected?" email to the
  sharer's tenant admins.
- Caps: viewers/session, concurrent sessions/tenant, bytes/session (closes
  code 4009 + audit `limit_breached`), TTL, idle timeout, tab-hidden cut.
- Kill switch / tenant revoke / per-user disable all propagate over the Redis
  control channel to every instance; terminated sessions purge their
  tickets/presence/snapshot/bytes keys.

## Audit (Phase 12)

`share_session_audit` is **append-only** — enforced by a DB trigger rather
than a role `REVOKE` because the appliance runs a single database role (the
migration role would otherwise be bound too). The retention purge sets the
transaction-local `mybooks.share_audit_retention` flag the trigger honors.
Events: session_created, code_submitted, participant_approved/denied/
ejected/left, approval_lapsed, cross_firm_confirmation_shown,
entity_scope_warning_shown, session_extended, session_ended (with reason),
limit_breached. Every participant event carries `participant_id`.

Admin views: Settings → Screen Sharing (session log, cross-firm filter, CSV
export, live-session terminate). Per-user history: `GET /share/sessions/mine`.

## Runbook (15.5)

**Start a session:** header → *Share my screen* → read the consent copy →
Start → read the grouped code aloud → approve each viewer by name. Cross-firm
viewers and entity-scope mismatches each require their own checkbox.

**Connection trouble:** the sharer banner and viewer status pill show
degraded/reconnecting states (5 backoff attempts). If the sharer tab dies the
session ends server-side — start a new one (codes are per-session).
`wscat -c wss://<host>/ws/share` should connect and close with 4001 after 5 s;
if the socket never opens, check the nginx `/ws/` location and the tunnel.

**Kill everything now:** Postgres
`UPDATE system_settings SET value='1' WHERE key='share_kill_switch'` (or the
service call). All live sessions close on the next heartbeat.

**Problem outside the browser tab** (desktop apps, PDFs, UltraTax): screen
share cannot see it by design — fall back to RustDesk per existing support
procedure.

## WISP / compliance addendum (15.1, 15.2)

For inclusion in the firm's Written Information Security Program, aligned to
the FTC Safeguards Rule and IRS Pub. 4557:

> **Screen-share channel.** MyBooks peer screen sharing transmits a masked DOM
> mirror of the sharer's MyBooks browser tab only; it cannot capture the
> desktop, other applications, or other tabs. Sensitive data (all keyboard
> input; SSN/ITIN, EIN, bank routing and payment-card numbers; credential,
> key-management and user-administration screens) is redacted or blocked on
> the sharer's device before transmission. Transport is TLS (wss:// via the
> appliance's HTTPS origin). Access control is two-step per viewer: possession
> of a join code grants nothing; the sharer must approve each named,
> authenticated MyBooks user, with an additional confirmation for viewers
> outside the firm and a further warning when the viewer lacks entitlement to
> the client entity on screen. Sessions are bounded (60-minute TTL, 90-second
> idle cutoff, byte cap) and every lifecycle event is logged immutably for
> three years (1095 days). **No screen content is recorded or retained** — the
> system stores lifecycle metadata only, so there is no stored screen content
> to breach. Cross-firm sharing is permitted by default
> (`SHARE_SCOPE=any`) with the compensating controls above; a deployment may
> tighten to `tenant` or `tenant_and_linked` by configuration alone, and each
> firm may refuse inbound cross-firm viewers in Settings → Screen Sharing.

**Security-questionnaire posture (cross-firm):** the anticipated finding is
"any user may view any firm's screens." The accurate answer: only with the
sharer's per-viewer, identity-shown approval, double-confirmed for out-of-firm
viewers, alerted to firm admins on first occurrence, anomaly-monitored,
per-firm refusable, and config-tightenable without code change.

**Engagement letters (15.6, open item):** counsel should review whether client
engagement letters need a clause covering screen-shared review of client
books, particularly cross-firm (e.g., a reviewing CPA at another firm).

## Licensing (15.7)

rrweb 1.1.3 is MIT-licensed (© rrweb contributors) — compatible with the
PolyForm Small Business License distribution of MyBooks. MIT terms permit
inclusion in commercial and source-available products; the MIT copyright and
permission notice ships with the bundled dependency (`node_modules/rrweb`)
and is noted here as the third-party notice of record. `ws` (MIT) likewise.

## Deliberate deviations from the addendum text

- **Caddy → nginx** (0.3): this stack fronts the SPA with nginx in the web
  container; the WS forwarding lives there.
- **Audit immutability via trigger, not REVOKE** (1.10): single-DB-role
  appliance; a REVOKE would bind the migration role too. The trigger
  achieves the same invariant and is itself tested.
- **BullMQ repeatable sweep → advisory-locked interval scheduler** (3.13):
  matches every other scheduler in this codebase (backup, retention,
  doc-requests); the worker and API can both run it without double-firing.
- **ESLint masking rule** (8.9): deferred with rationale (see masking
  section) — the global `maskAllInputs` default plus the PR-checklist note
  covers the actual risk surface better than a lintable heuristic.
