# Vibe MyBooks — Cloudflare Tunnel Setup Guide (for your firm)

This guide walks through the one-time Cloudflare setup your firm completes before we install Vibe MyBooks on your appliance. You do this in **your own Cloudflare account** — we never get access to it.

**Why you own the Cloudflare account:** you control your DNS, your tunnel, and your costs. If you ever stop using Vibe MyBooks, you can point the same subdomain at something else in minutes. We're not on the traffic path.

**What this gives you:**
- Your staff and clients reach the appliance from anywhere — no port forwarding on your router.
- Cloudflare handles HTTPS certificates, DDoS filtering, and bot challenges automatically.
- Stays on Cloudflare's free tier. There is no per-user cost regardless of firm size.

**What this does NOT do:**
- It does not authenticate your users — Vibe MyBooks handles login, MFA, and session management itself.
- It does not use Cloudflare Access or Zero Trust user seats. We're only using the tunnel feature, which is free and unmetered.

**Time required:** 30–45 minutes of clicks, plus up to a few hours of DNS propagation (usually minutes).

---

## Prerequisites

- [ ] A domain name the firm owns (e.g., `examplecpa.com`). If you don't have one, Cloudflare Registrar, Namecheap, or Porkbun all work.
- [ ] An email address for the Cloudflare account — ideally a shared admin address (e.g., `it@examplecpa.com`), not an individual's personal mailbox.
- [ ] About 30–45 minutes of setup time.

> **Printable checklist:** `docs/firm-cloudflare-setup-checklist.md` (one page, tick-as-you-go). _[TODO: produce printable version.]_

---

## Part A — Create the Cloudflare Account

1. Go to [cloudflare.com](https://cloudflare.com) and sign up for a free account.
2. Enable two-factor authentication on the account **immediately**. Cloudflare supports TOTP apps (Google Authenticator, 1Password, etc.) and hardware security keys.
3. Save the recovery codes somewhere the firm controls. Vibe MyBooks/Kisaes will never have access to this account.

> _Screenshot: Cloudflare sign-up page._ **[TODO: annotated screenshot.]**

---

## Part B — Add the Domain to Cloudflare

1. In the Cloudflare dashboard, click **Add a site** and enter the firm's domain (e.g., `examplecpa.com`).
2. Select the **Free** plan.
3. Cloudflare will scan your existing DNS records and display **two nameservers** (e.g., `alice.ns.cloudflare.com` and `bob.ns.cloudflare.com`).
4. Log in to your domain registrar (wherever you bought the domain) and **replace the existing nameservers** with the two Cloudflare nameservers.
5. Wait for propagation. Cloudflare will email you when it confirms — usually within minutes, occasionally a few hours.

> _Screenshot: Cloudflare nameserver screen + registrar DNS settings._ **[TODO.]**

---

## Part C — Enable Zero Trust (required for Tunnel)

> **Why this step even exists:** Cloudflare puts the Tunnel feature under the "Zero Trust" umbrella in their dashboard. We're NOT using Zero Trust user policies, Access, WARP, or Gateway — only the tunnel. It's free and doesn't count against any user seat limits.

1. In the Cloudflare sidebar, click **Zero Trust**.
2. Choose a team name (any identifier — your firm name works).
3. Select the **Free** plan. Cloudflare requires a payment method on file to enable Zero Trust even on the free tier — add a card. **It will not be charged** unless you explicitly upgrade.
4. Ignore the WARP client, Gateway, and Access onboarding prompts. The only feature we use is Tunnel.

---

## Part D — Create the Tunnel

1. In Zero Trust, go to **Networks → Tunnels**.
2. Click **Create a tunnel**, choose **Cloudflared** as the connector type.
3. Name the tunnel `vibe-mybooks-appliance` (or similar — this is just for your own reference).
4. On the next screen, Cloudflare displays a token. **Copy the token** — the long string that appears after `--token` in the install command Cloudflare shows you. Keep it somewhere safe; you'll paste it into the appliance during install.
5. **Skip the "install connector" step** — Vibe MyBooks's Docker image runs `cloudflared` automatically. You just need the token.
6. On the **Public Hostnames** tab, add these entries (adjust the subdomain names to what your firm wants):

| Subdomain | Domain | Service Type | URL |
|---|---|---|---|
| `mybooks` | `examplecpa.com` | HTTP | `api:3001` |
| `clients` | `examplecpa.com` | HTTP | `api:3001` |
| `admin` | `examplecpa.com` | HTTP | `api:3001` |

The service hostname `api:3001` is the appliance's internal Docker network name — it never changes. The **subdomains** are yours to choose.

> _Screenshot: Zero Trust → Networks → Tunnels → token screen + Public Hostnames tab._ **[TODO.]**

---

## Part E — Create a Turnstile Site Key

Turnstile is Cloudflare's bot challenge. Vibe MyBooks uses it on your login pages to stop credential-stuffing attacks.

1. Back in the main Cloudflare dashboard (not Zero Trust), go to **Turnstile**.
2. Click **Add site**, name it `Vibe MyBooks Login`.
3. Enter the firm's domain: `examplecpa.com`, or both `mybooks.examplecpa.com` and `clients.examplecpa.com`.
4. Choose **Managed** widget type.
5. **Copy the Site Key and Secret Key.** Both go into the appliance at install time.

---

## Part F — (Optional) Rate Limiting Rule

For firms that want extra hardening at the edge:

1. In the main dashboard, go to **Security → WAF → Rate limiting rules**.
2. Add a rule: if URI path contains `/api/auth/login` and request rate exceeds **10 per minute per IP**, block for **1 hour**.
3. The free tier allows one rate limiting rule. The login endpoint is the best place to use it.

---

## Part G — Hand Off to Vibe MyBooks / Kisaes

When you schedule your install, send us:

- [ ] The **tunnel token** (from Part D, step 4).
- [ ] The **Turnstile site key and secret key** (from Part E, step 5).
- [ ] The exact **hostnames** you chose (from Part D, step 6 — e.g., `mybooks.examplecpa.com`, `clients.examplecpa.com`, `admin.examplecpa.com`).

**Nothing else.** Never share your Cloudflare account credentials. If support work later needs changes to the tunnel or DNS, you'll make them in your own dashboard with us guiding over a screen-share.

---

## What Vibe MyBooks / Kisaes CANNOT Do on Your Cloudflare Account

We have no access. Any of the following requires you to log in to your own dashboard:

- Creating, renaming, or deleting tunnels.
- Changing public hostnames / subdomains.
- Rotating the tunnel token.
- Creating or modifying DNS records.
- Changing Turnstile keys or widget settings.
- Viewing Cloudflare billing or firewall logs.

We can walk you through any of these over a screen-share.

---

## Troubleshooting FAQ

**Nameserver change hasn't propagated — Cloudflare still shows "Pending"**
Most registrars update within minutes. Some TLDs (`.co`, a few country-code TLDs) can take several hours. Use `dig NS examplecpa.com` or an online "whois" lookup to confirm your registrar has saved the change. If it has and Cloudflare is still pending after 24 hours, open a support ticket with Cloudflare.

**Tunnel shows "Disconnected" in the Cloudflare dashboard**
Check the appliance's admin UI → System → Tunnel Status (once Phase 8 is live). If the appliance shows a different error, the token may be wrong or the `cloudflared` container may have crashed. From the appliance host: `docker compose logs cloudflared`. Restart with `docker compose --profile tunnel restart cloudflared`.

**Turnstile widget shows "Error" on the login page**
Confirm the site key in the appliance's `.env` matches what Cloudflare shows in the Turnstile dashboard. Domain restrictions on the widget must include the subdomain the user is hitting (e.g., `mybooks.examplecpa.com`). If you set the widget to one domain and your users reach it via another, CF returns an error.

**HTTPS certificate error when the domain was just added**
Cloudflare issues certificates automatically but it can take a few minutes after DNS finishes propagating. Wait 15 minutes and try again. If still broken, go to **SSL/TLS → Edge Certificates** in the Cloudflare dashboard and confirm Universal SSL is on.

---

## Reference

- Build plan: `Build Plans/CLOUDFLARE_TUNNEL_PLAN.md`
- Environment variables: `.env.example` (`CLOUDFLARE_TUNNEL_TOKEN`, `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`)
- Bringing the tunnel up on the appliance: `docker compose --profile tunnel up -d`
