# Cloudflare Tunnel — Onboarding Playbook

Internal runbook for Kisaes staff onboarding a firm onto the Cloudflare Tunnel deployment model. Companion to `docs/firm-cloudflare-setup.md` (which is the customer-facing document).

**Source plan:** `Build Plans/CLOUDFLARE_TUNNEL_PLAN.md` Phase 10.

**Goal:** get a new firm from "I bought Vibe MyBooks" to "my staff are logged in over the tunnel with MFA" in a single 90-minute session.

---

## Pre-install — T-minus 7 days

### 1. Send the pre-install email

Use this template as the starting point for every new firm. Adjust the "your install date" placeholder.

> **Subject:** Your Vibe MyBooks install — Cloudflare setup to complete first
>
> Hi [Firm Contact],
>
> Before we install Vibe MyBooks on your appliance on **[install date]**, there's one piece of setup we need you to complete in your own Cloudflare account. The guide is at https://vibemb.com/docs/firm-cloudflare-setup (or attached). It takes about 30-45 minutes plus DNS propagation time.
>
> What we need from you on install day:
> 1. **Tunnel token** — a long string from your Cloudflare dashboard (setup guide Part D, step 4).
> 2. **Turnstile Site Key + Secret Key** — two strings from your Cloudflare Turnstile dashboard (setup guide Part E, step 5).
> 3. **Hostnames you chose** — e.g., `mybooks.yourfirm.com`, `clients.yourfirm.com`.
>
> **Important:** Never share your Cloudflare account password with us. We operate entirely from the information above.
>
> If anything in the setup guide is unclear, reply to this email and we'll schedule a 15-minute screen-share to walk through it before install day.
>
> Thanks,
> Kisaes Support

### 2. Track the pre-install state

Open a tracking issue (Linear / Jira / wherever) with a checklist:

- [ ] Firm has a domain they own
- [ ] Pre-install email sent — `[date]`
- [ ] Setup guide confirmed received (reply / read receipt)
- [ ] Pre-install screen-share completed (if requested) — `[date]`
- [ ] Tunnel token received — **never paste the token into the tracking issue**; only note "received"
- [ ] Turnstile keys received
- [ ] Hostnames confirmed
- [ ] Install appointment confirmed

Credentials live in your password manager, shared with the firm via end-to-end-encrypted channel (1Password share link, Bitwarden send, or similar). Not in email, not in the tracking issue, not in Slack threads.

---

## Install day — the session

### 3. Preflight checklist (before you join the call)

- [ ] Credentials pulled up in password manager, ready to paste.
- [ ] Latest Vibe MyBooks image tag noted.
- [ ] `docs/firm-cloudflare-setup.md` open in your browser (point the firm at section Part G).
- [ ] Appliance SSH / Portainer access confirmed working from your side.
- [ ] The three hostnames resolve externally via `dig` or equivalent.
- [ ] The firm's Cloudflare tunnel shows **Status: Healthy / Connected** in their CF dashboard — even before the `cloudflared` sidecar is running on the appliance, the tunnel record itself should be "Pending connector" not error state.

### 4. Walk the setup wizard together

1. Join the call, share screen.
2. Open the appliance's setup wizard on first boot (or admin → System → Tunnel, once the reconfigure UI lands — until then, SSH + `.env` edit with the firm's permission).
3. Paste:
   - `CLOUDFLARE_TUNNEL_TOKEN=...` (from the firm)
   - `TURNSTILE_SITE_KEY=...`
   - `TURNSTILE_SECRET_KEY=...`
4. `docker compose --profile tunnel up -d`
5. Watch `docker compose logs -f cloudflared` for:
   - `Starting metrics server on [::]:2000/metrics`
   - `Registered tunnel connection` (4 connection lines — one per CF edge)
   - No `failed to serve quic connection` looping (transient is fine)

### 5. Validate all three hostnames

For each of the firm's hostnames (`mybooks.*`, `clients.*`, `admin.*`):

1. Open in an incognito window from the firm's screen.
2. Confirm the login page renders with:
   - HTTPS padlock (CF-issued cert)
   - Turnstile widget visible (if `TURNSTILE_SITE_KEY` populated)
3. Log in with the super-admin account.
4. On the Admin Dashboard, confirm the **Cloudflare Tunnel** card shows green "Connected — N connections" (N ≥ 1, typically 4 on warm tunnels).
5. Navigate to one data page (Dashboard, Invoices, Reports).
6. Log out.

If any hostname fails:
- `docker compose logs cloudflared | grep -i <that-hostname>` — is the ingress rule visible?
- Is the hostname actually registered in CF Public Hostnames?
- Did the DNS CNAME propagate? (`dig CNAME mybooks.yourfirm.com` should point at `<uuid>.cfargotunnel.com`)

### 6. End-to-end webhook test

- Stripe CLI: `stripe listen --forward-to https://mybooks.yourfirm.com/api/v1/stripe/webhook/<company-uuid>`
- Trigger a test event: `stripe trigger invoice.paid`
- Confirm 200 in Stripe CLI output and a row in the appliance's audit log.

(If the firm isn't using Stripe, skip. Plaid's sandbox webhook exercises the same path.)

### 7. MFA enrollment walk-through

Since Phase 3 is landed, the super-admin account **must** enroll MFA before the session ends:
- TOTP (recommended) — firm's authenticator app of choice
- Passkey (preferred, if on a modern browser/device)
- Save the recovery codes somewhere the firm controls

---

## Post-install — T-plus 1 day

### 8. Post-install checklist

Email the firm within 24 hours with:

- [ ] Confirmation the install completed
- [ ] Links to each hostname
- [ ] A one-page "what to do if something breaks" sheet (tunnel-status widget location, where to find help, support email)
- [ ] Reminder to back up their Cloudflare account recovery codes

### 9. Monitor the first week

Watch CI / on-call alerting (once Phase 8's alerting lands) for:
- Tunnel disconnections > 2 min
- Sustained 429s from Turnstile or login limiters (indicates the firm's staff are hitting real friction — may need to lower sensitivity)
- `STAFF_IP_BLOCKED` responses if the firm enabled Phase 6 (indicates remote-work lockout; coach them on adding their home CIDR)

---

## Support escalation flowchart

**Firm reports:** "We can't reach mybooks.yourfirm.com"

1. **Is it DNS?** Run `dig CNAME <hostname>`. Should point at `<tunnel-uuid>.cfargotunnel.com`. If not, guide them to their CF Zero Trust → Networks → Tunnels → <their-tunnel> → Public Hostnames and re-add the hostname.
2. **Is it the tunnel?** Ask them to pull up the CF dashboard → Zero Trust → Networks → Tunnels. If status is red, the sidecar is disconnected.
   - Ask for a `docker compose logs --tail=100 cloudflared` dump.
   - Or run `bash scripts/tunnel-diagnostics.sh` on the appliance and share the output.
3. **Is it the token?** If the log shows repeated `Unable to authenticate` errors, the firm needs to rotate the token in CF and paste the new value into the appliance `.env`.
4. **Is it the app?** `curl https://mybooks.yourfirm.com/health` from the firm's network. 200 = app is up. Non-200 = look at api container logs.

**Firm reports:** "Turnstile widget keeps failing"

1. **Wrong domain on the widget?** CF Turnstile widgets are domain-locked. If the firm set the widget for `mybooks.firm.com` only and users land at `clients.firm.com`, the widget errors. Add all hostnames to the widget's domain list in CF.
2. **Secret key mismatch?** Check that `TURNSTILE_SECRET_KEY` in the appliance `.env` matches CF's dashboard value. Restart the api container after any change.
3. **Appliance clock drift?** Turnstile tokens have a ~5-minute window. If the appliance clock is skewed, every verify fails. `date` on the host; `ntpq -p` if NTP is the issue.

**Firm reports:** "Nobody can log in from outside the office"

1. Check if Phase 6 IP allowlist is on: `STAFF_IP_ALLOWLIST_ENFORCED=1` in `.env`.
2. If yes, ask the firm if they recently added a CIDR. `GET /admin/ip-allowlist` lists current entries.
3. Break-glass path: any super-admin account logs in regardless of IP. Remind the firm.
4. Longer-term fix: either add home-office CIDRs, or disable enforcement entirely (`STAFF_IP_ALLOWLIST_ENFORCED=0` + restart).

---

## Red flags during onboarding

Stop the install and escalate internally if:

- The firm asks you to take over their Cloudflare account or offers to share credentials — reaffirm that we don't accept CF credentials under any circumstances. Reschedule if they won't do the setup themselves.
- The firm's domain is already hosted on another CF account (can happen with prior CMS). They'll need to resolve the ownership dispute via CF support before proceeding.
- The firm is on an ancient version of Docker Compose (< v2). Upgrade first; `--profile` flags don't work on v1.
