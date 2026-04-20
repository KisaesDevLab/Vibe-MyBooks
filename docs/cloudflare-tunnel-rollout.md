# Cloudflare Tunnel — Rollout Plan

Phase 12 of `Build Plans/CLOUDFLARE_TUNNEL_PLAN.md`. No code. This is the staged plan for getting the tunnel deployment model from "merged on main" to "default for every new install".

## Stage A — First beta firm (friendly, no remote staff)

**Goal:** validate that a typical firm can walk through `docs/firm-cloudflare-setup.md` without support and that the install-day runbook in `docs/cloudflare-tunnel-onboarding.md` actually works.

**Selection criteria:**
- Owns their domain already (no registrar migration in scope).
- Single-office, no remote staff — keeps the feature matrix small for this first run.
- Willing to give blunt feedback on the setup guide and the onboarding experience.

**Exit criteria:**
- Firm completed Section 2 of the setup guide with no more than one 15-minute screen-share call.
- Install-day runbook completed in ≤ 90 minutes.
- No P1 issues in the first 7 days of use.
- Feedback notes captured and fed back into `docs/firm-cloudflare-setup.md` and `docs/cloudflare-tunnel-onboarding.md`.

## Stage B — Second beta firm (with remote staff)

**Goal:** validate that the no-Access architecture works when staff are genuinely distributed — no VPN, just the tunnel + app-layer MFA.

**Selection criteria:**
- At least 3 staff working remotely on a typical day.
- Mix of devices (Mac, Windows, iOS, Android) to exercise Turnstile + passkey paths on real hardware.

**Exit criteria:**
- Every remote staff member has MFA enrolled and logs in cleanly from multiple networks.
- No false-positive rate-limit hits reported over 14 days (per-account limiter calibrated correctly).
- Turnstile widget renders cleanly on every device tested.

## Stage C — Publish the setup guide publicly

**Goal:** make the setup story visible so prospective firms can evaluate the architecture before buying.

**Tasks:**
- [ ] Copy `docs/firm-cloudflare-setup.md` to `vibemb.com/docs/firm-cloudflare-setup`.
- [ ] Add annotated screenshots in every TODO-marked spot in the guide (flagged during Stage A/B beta).
- [ ] Link the guide from the product landing page under a "How it works — Remote access without a VPN" section.
- [ ] Record the 10–15 minute walkthrough video (still outstanding from Phase 1).

## Stage D — Default for commercial tier

**Goal:** switch the commercial onboarding flow to use the tunnel by default; LAN-only becomes an explicit opt-out.

**Tasks:**
- [ ] Commercial-tier signup form adds the three CF fields (token + Turnstile site + secret) as required with inline links to the setup guide.
- [ ] First-run setup wizard detects a tunnel config in `.env` and shows the tunnel-status card during step-through (needs Phase 9 wizard step).
- [ ] Portainer stack template ships with `cloudflared` already declared and the env placeholders visible.

## Stage E — Announce

**Timing:** once Stages A–D are complete and we've collected ~5 real-world installs without major friction.

**Tasks:**
- [ ] Add a dated entry to the product changelog.
- [ ] Send a how-to email to existing commercial-tier customers: "Here's how to enable secure remote access for your staff — no VPN, no port forwarding."
- [ ] Social / blog post summarising the architecture choice (customer-owned CF, app-layer MFA, no Zero Trust seat limits).

## Exit checklist for Phase 12

- [ ] Stage A complete
- [ ] Stage B complete
- [ ] Stage C complete
- [ ] Stage D complete
- [ ] Stage E complete

When every box is ticked, close out CLOUDFLARE_TUNNEL_PLAN.md Phase 12 and archive this file as a historical record.
