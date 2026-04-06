# KIS Books — Passwordless Authentication Amendment

**Amendment to:** TFA_PLAN.md
**Feature:** Optional passwordless login via Magic Link and Passkeys (WebAuthn), integrated with the existing 2FA system
**Date:** April 4, 2026
**Depends on:** TFA_PLAN.md (2FA system must be built first)

---

## Overview

This amendment adds two passwordless login methods as **alternatives** to the existing password-based login. Users choose their preferred method in their profile settings. The existing password + 2FA flow remains the default — passwordless is opt-in per user.

### Three Login Methods (User Chooses)

| Method | Factor 1 | Factor 2 | Speed | Offline? |
|---|---|---|---|---|
| **Password** (default) | Password (know) | TOTP / SMS / Email (have) | Fast | TOTP: yes |
| **Magic Link** | Email link (have) | TOTP or SMS only (have) | Slow (email wait) | No |
| **Passkey** | Device key + biometric (have + are) | None needed (multi-factor by nature) | Fastest | Yes |

### Key Design Decisions

- **Passkeys skip 2FA entirely.** A passkey is already multi-factor (device possession + biometric/PIN). Requiring additional 2FA on top of a passkey is redundant and degrades UX.
- **Magic links require non-email 2FA.** Since the magic link proves email access, the second factor must be different: TOTP or SMS only. If the user has no TOTP or SMS configured, magic link is not available to them.
- **Password login is always available.** Even if a user enables passkey or magic link, they can always fall back to password. This prevents lockout if a device is lost.
- **Admin controls availability.** The system admin enables which passwordless methods are available. Users can only opt in to methods the admin has enabled.

---

## 1. Passkeys (WebAuthn / FIDO2)

### 1.1 How Passkeys Work

```
Registration (one-time setup):
  User clicks "Add Passkey" in settings →
    Browser prompts biometric (fingerprint/face/PIN) →
      Browser generates key pair (private stays on device, public sent to server) →
        Server stores public key + credential ID →
          Passkey registered ✓

Login:
  User enters email (or selects from autofill) →
    Server sends challenge →
      Browser prompts biometric →
        Browser signs challenge with private key →
          Server verifies signature with stored public key →
            Access granted (no password, no 2FA prompt)
```

### 1.2 Data Model

```sql
CREATE TABLE passkeys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  credential_id TEXT NOT NULL,                 -- base64url-encoded credential ID from WebAuthn
  public_key TEXT NOT NULL,                    -- base64url-encoded COSE public key
  counter BIGINT DEFAULT 0,                    -- signature counter (replay protection)
  -- Device info (for display in settings)
  device_name VARCHAR(255),                    -- "MacBook Pro Touch ID", "iPhone Face ID", "YubiKey 5"
  aaguid VARCHAR(36),                          -- authenticator attestation GUID (identifies authenticator type)
  transports TEXT[],                           -- 'usb', 'ble', 'nfc', 'internal' (hints for future auth)
  backed_up BOOLEAN DEFAULT FALSE,             -- whether the passkey is synced (e.g., iCloud Keychain)
  -- Metadata
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(credential_id)
);

CREATE INDEX idx_pk_user ON passkeys(user_id);
CREATE INDEX idx_pk_credential ON passkeys(credential_id);
```

### 1.3 WebAuthn Configuration

```sql
-- Add to existing auth or system config
ALTER TABLE tfa_config ADD COLUMN passkeys_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE tfa_config ADD COLUMN magic_link_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE tfa_config ADD COLUMN magic_link_expiry_minutes INT DEFAULT 15;
ALTER TABLE tfa_config ADD COLUMN magic_link_max_attempts INT DEFAULT 3;
  -- max unused magic links per user before rate limiting

-- User preference
ALTER TABLE users ADD COLUMN preferred_login_method VARCHAR(20) DEFAULT 'password';
  -- 'password' | 'magic_link' | 'passkey'
ALTER TABLE users ADD COLUMN magic_link_enabled BOOLEAN DEFAULT FALSE;
```

### 1.4 WebAuthn Parameters

| Parameter | Value |
|---|---|
| RP Name | "KIS Books" |
| RP ID | Derived from app domain (e.g., `kisbooks.example.com`) |
| User verification | Required (biometric or device PIN) |
| Attestation | None (we don't need to verify authenticator make/model) |
| Resident key | Preferred (enables username-less login on supported devices) |
| Algorithm | ES256 (-7), RS256 (-257) |

### 1.5 API Endpoints — Passkeys

```
-- Registration
POST   /api/v1/auth/passkeys/register/options    # Generate registration options (challenge)
POST   /api/v1/auth/passkeys/register/verify     # Verify registration response, store credential

-- Authentication
POST   /api/v1/auth/passkeys/login/options        # Generate authentication options (challenge)
POST   /api/v1/auth/passkeys/login/verify         # Verify authentication response, return tokens

-- Management
GET    /api/v1/users/me/passkeys                  # List user's registered passkeys
PUT    /api/v1/users/me/passkeys/:id              # Rename a passkey
DELETE /api/v1/users/me/passkeys/:id              # Remove a passkey
```

### 1.6 Registration Flow

- [ ] `generateRegistrationOptions(userId)`:
  1. Fetch user info (id, email, display name)
  2. Fetch existing credential IDs for this user (to exclude — prevents re-registering same device)
  3. Call `@simplewebauthn/server.generateRegistrationOptions()` with:
     - `rpName`: "KIS Books"
     - `rpID`: app domain
     - `userID`: user UUID as Uint8Array
     - `userName`: user email
     - `userDisplayName`: user display name
     - `excludeCredentials`: existing credential IDs
     - `authenticatorSelection`: `{ userVerification: 'required', residentKey: 'preferred' }`
     - `attestationType`: 'none'
  4. Store challenge in session/cache (Redis, 5 min TTL)
  5. Return options to client

- [ ] `verifyRegistration(userId, response)`:
  1. Retrieve stored challenge from session
  2. Call `@simplewebauthn/server.verifyRegistrationResponse()` with response + expected challenge/origin/rpID
  3. If valid: extract `credentialID`, `credentialPublicKey`, `counter`, `credentialBackedUp`, `transports`
  4. Parse user-agent for device name (or let user name it)
  5. Store in `passkeys` table
  6. Audit log: `passkey_registered`
  7. Return success

### 1.7 Authentication Flow

- [ ] `generateAuthenticationOptions(email?)`:
  1. If email provided: fetch user's credential IDs as `allowCredentials`
  2. If no email (discoverable credential flow): `allowCredentials` is empty (browser will prompt from all stored passkeys)
  3. Call `@simplewebauthn/server.generateAuthenticationOptions()` with:
     - `rpID`: app domain
     - `allowCredentials`: credential IDs with transports
     - `userVerification`: 'required'
  4. Store challenge in session/cache
  5. Return options to client

- [ ] `verifyAuthentication(response)`:
  1. Look up credential by `response.id` in `passkeys` table
  2. Retrieve stored challenge from session
  3. Call `@simplewebauthn/server.verifyAuthenticationResponse()` with:
     - `response`: the client response
     - `expectedChallenge`: stored challenge
     - `expectedOrigin`: app origin
     - `expectedRPID`: app domain
     - `authenticator`: `{ credentialPublicKey, counter }` from database
  4. If valid:
     - Update `counter` on the passkey record (replay protection)
     - Update `last_used_at`
     - **Skip 2FA entirely** — passkey is already multi-factor
     - Generate and return `access_token` + `refresh_token`
     - Audit log: `passkey_login`
  5. If invalid: return error, increment failed attempt counter

---

## 2. Magic Links

### 2.1 How Magic Links Work

```
Login:
  User enters email → clicks "Send Login Link" →
    Server generates signed token → stores in database →
      Email sent with link: https://app.example.com/auth/magic?token=xxx →
        User clicks link → token validated →
          2FA prompt (TOTP or SMS only) →
            Code verified → access granted
```

### 2.2 Data Model

```sql
CREATE TABLE magic_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  token_hash VARCHAR(255) NOT NULL,           -- SHA-256 hash of the token (token itself is in the URL only)
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  used_at TIMESTAMPTZ,
  ip_address INET,                            -- IP that requested the link
  user_agent TEXT,                             -- browser that requested the link
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ml_token ON magic_links(token_hash) WHERE used = FALSE;
CREATE INDEX idx_ml_user ON magic_links(user_id);
```

### 2.3 API Endpoints — Magic Links

```
POST   /api/v1/auth/magic-link/send           # Request a magic link (sends email)
GET    /api/v1/auth/magic-link/verify          # Verify token from email link (returns tfa_token)
POST   /api/v1/auth/magic-link/tfa/verify      # Complete login with 2FA code after magic link
```

### 2.4 Magic Link Generation

- [ ] `sendMagicLink(email, ipAddress, userAgent)`:
  1. Verify user exists and has `magic_link_enabled = TRUE`
  2. Verify user has at least one non-email 2FA method (TOTP or SMS) — **required for magic link login**
  3. Rate limit: max 3 active (unused, unexpired) magic links per user. If exceeded, return "Please check your email for an existing link or wait for it to expire."
  4. Generate cryptographically random token (32 bytes, URL-safe base64)
  5. Hash token with SHA-256, store hash + expiry in `magic_links` table
  6. **Do NOT store the raw token** — it only exists in the email URL
  7. Send email:
     ```
     Subject: Log in to KIS Books
     
     Click the link below to log in:
     https://app.example.com/auth/magic?token=xxxxx
     
     This link expires in 15 minutes and can only be used once.
     If you didn't request this, ignore this email.
     ```
  8. Audit log: `magic_link_sent`
  9. Return: `{ sent: true, expires_in_minutes: 15 }`

### 2.5 Magic Link Verification

- [ ] `verifyMagicLink(token)`:
  1. Hash the incoming token with SHA-256
  2. Look up in `magic_links` where `token_hash` matches, `used = FALSE`, `expires_at > NOW()`
  3. If not found: return error "Link is invalid or expired"
  4. Mark as `used = TRUE`, `used_at = NOW()`
  5. Invalidate all other unused magic links for this user (security: prevent parallel use)
  6. **Do NOT grant access yet** — the magic link only proves email ownership (factor 1)
  7. Return a `tfa_token` (same 5-minute ephemeral JWT used in the existing 2FA flow)
  8. The frontend then shows the 2FA prompt (TOTP or SMS only — email 2FA is excluded)
  9. Audit log: `magic_link_verified`

### 2.6 Security Constraints

- [ ] Tokens are 32 bytes (256 bits) of cryptographic randomness — unguessable
- [ ] Tokens are single-use and short-lived (15 minutes default, admin-configurable)
- [ ] Raw tokens are never stored — only SHA-256 hashes
- [ ] Rate limited: max 3 pending links per user, cooldown between requests (60 seconds)
- [ ] Link verification invalidates all other pending links for the user
- [ ] Magic link login ALWAYS requires a second factor (TOTP or SMS) — never one-factor
- [ ] If the user has no TOTP or SMS method configured, magic link login is unavailable
- [ ] The magic link URL includes the full token — no session cookies required to redeem it (works across browsers/devices)

---

## 3. Updated Login Page

### 3.1 Login Flow Decision Tree

```
User arrives at login page
  │
  ├→ "Log in with Passkey" button (if passkeys enabled + user has a registered passkey)
  │    └→ Browser biometric prompt → verified → dashboard (no 2FA)
  │
  ├→ Email input field
  │    │
  │    ├→ "Send Login Link" button (if magic links enabled)
  │    │    └→ Email sent → user clicks link → 2FA prompt (TOTP/SMS) → dashboard
  │    │
  │    └→ "Continue with Password" button (always available)
  │         └→ Password field shown → password verified → 2FA prompt (if enabled) → dashboard
  │
  └→ No account? "Sign up" link (if registration enabled)
```

### 3.2 Login Page UI Updates

```
packages/web/src/features/auth/LoginPage.tsx
```

- [ ] **Passkey login button** (shown when passkeys enabled system-wide):
  - Prominent button at top: "Log in with Passkey" with fingerprint icon
  - On click: triggers WebAuthn authentication ceremony
  - If user has no passkeys registered: button still shown but triggers browser's passkey picker (for discoverable credentials)
  - If authentication fails: show "Passkey not recognized. Try another method."

- [ ] **Email input field** (always shown):
  - User enters email address
  - After entering email, two buttons appear:

- [ ] **"Send Login Link" button** (shown when magic links enabled system-wide):
  - Below the email field
  - On click: sends magic link email
  - Shows: "Check your email for a login link. It expires in 15 minutes."
  - "Resend" link with 60-second cooldown
  - Subtle note: "You'll need your authenticator app or phone to complete login."

- [ ] **"Continue with Password" button** (always shown):
  - Reveals password field
  - Existing password flow continues as built in TFA_PLAN.md

- [ ] **Visual separator:** "or" divider between passkey button and email section

- [ ] **Conditional rendering:**
  - If only password enabled: show classic email + password form (no changes)
  - If passkey enabled: add passkey button above the form
  - If magic link enabled: add "Send Login Link" alongside password
  - If both enabled: show all three options

### 3.3 Magic Link Landing Page

```
packages/web/src/features/auth/MagicLinkVerifyPage.tsx
```

- [ ] URL: `/auth/magic?token=xxxxx`
- [ ] On page load: immediately verify the token via API
- [ ] If valid: show 2FA prompt (TOTP or SMS — same `TfaVerifyStep.tsx` component but with email method hidden)
- [ ] If expired: show "This link has expired. [Request a new one]" with email input
- [ ] If already used: show "This link has already been used. [Request a new one]"
- [ ] If invalid: show "Invalid login link. [Go to login page]"

---

## 4. User Settings Updates

### 4.1 Login Method Preference

```
packages/web/src/features/settings/LoginMethodSettings.tsx
```

Add a "Login Method" section to the user's security settings page (alongside existing 2FA settings).

- [ ] **Preferred login method selector:**
  - Radio buttons: Password (default) / Magic Link / Passkey
  - Shows which methods are available based on system config and user's 2FA setup
  - Magic Link option is grayed out with note "Requires TOTP or SMS — [set up now]" if user has no non-email 2FA

- [ ] **Passkey management section** (if passkeys enabled):
  - "Add Passkey" button → triggers WebAuthn registration
  - Table of registered passkeys:
    - Columns: Name, Type (Touch ID / Face ID / YubiKey / etc.), Added, Last Used
    - "Rename" action per row
    - "Remove" action per row (with confirmation)
  - Note: "Passkeys use your device's fingerprint, face recognition, or security key. Your biometric data never leaves your device."

- [ ] **Magic Link toggle** (if magic links enabled):
  - "Enable email login links" toggle
  - Prerequisite check: "Requires an authenticator app or SMS verification to be set up."
  - If toggled on without TOTP/SMS: show error "Set up an authenticator app or SMS verification first."

### 4.2 Passkey Registration Modal

```
packages/web/src/features/settings/PasskeyRegisterModal.tsx
```

- [ ] Step 1: "Name this passkey" — text input, auto-suggested from browser/device info (e.g., "Chrome on MacBook Pro")
- [ ] Step 2: "Verify your identity" — triggers WebAuthn registration ceremony (browser prompts biometric)
- [ ] Step 3: Success — "Passkey registered. You can now log in with [device name]."
- [ ] Error handling:
  - User cancels biometric: "Registration cancelled. You can try again anytime."
  - Browser doesn't support WebAuthn: "Your browser doesn't support passkeys. Try Chrome, Safari, or Edge."
  - Device doesn't support biometric: "Your device needs a fingerprint reader, face recognition, or security key to use passkeys."

---

## 5. Admin Settings Updates

### 5.1 Passwordless Configuration

Add to the existing `TfaConfigPage.tsx` admin page:

- [ ] **Passwordless Methods section** (below the existing 2FA methods):

  **Passkeys (WebAuthn):**
  - Enable/Disable toggle
  - Note: "Passkeys let users log in with their fingerprint, face, or security key. No external service required."
  - Stat: "N users have registered passkeys"

  **Magic Links:**
  - Enable/Disable toggle
  - Link expiry: dropdown (5 min, 10 min, 15 min, 30 min) — default 15
  - Max pending links per user: dropdown (1, 3, 5) — default 3
  - Note: "Magic links require SMTP to be configured. Users must also have TOTP or SMS set up as a second factor."
  - Warning if SMTP not configured: "SMTP is not configured. Magic links cannot be sent. [Configure SMTP]"
  - Stat: "N users have magic link login enabled"

---

## 6. Dynamic Method Availability

All authentication and 2FA methods are conditionally available based on system infrastructure readiness and admin configuration. The UI never shows a method the user can't actually use.

### 6.1 Availability Matrix

| Method | Admin Toggle | Infrastructure Requirement | User Requirement |
|---|---|---|---|
| **Password login** | Always on (no toggle) | None | User has a password set |
| **Magic link login** | `magic_link_enabled` | SMTP configured and working | User has magic link enabled + TOTP or SMS 2FA |
| **Passkey login** | `passkeys_enabled` | None (browser-native) | User has registered ≥1 passkey |
| **2FA: Email code** | `'email' in allowed_methods` | SMTP configured and working | User has opted in to email 2FA |
| **2FA: SMS code** | `'sms' in allowed_methods` | SMS provider configured (Twilio or TextLinkSMS) and working | User has verified phone number |
| **2FA: TOTP** | `'totp' in allowed_methods` | None (authenticator app is user-side) | User has completed TOTP setup |

### 6.2 Infrastructure Detection

```
packages/api/src/services/auth-availability.service.ts
```

A service that checks infrastructure readiness and returns which methods are actually usable — not just which are toggled on.

- [ ] `getSystemCapabilities()`:
  - `smtp_ready`: check SMTP configuration exists AND test connection succeeds (cached for 5 minutes)
  - `sms_ready`: check SMS provider is configured AND has valid credentials (cached for 5 minutes)
  - `passkeys_supported`: always true (server-side WebAuthn has no infrastructure dependency)
  - `totp_supported`: always true (TOTP is computed locally)
  - Returns: `{ smtp_ready, sms_ready, passkeys_supported, totp_supported }`

- [ ] `getEffectiveLoginMethods()`:
  - Combine admin toggles with infrastructure readiness:
    - `password`: always available
    - `magic_link`: `tfa_config.magic_link_enabled AND smtp_ready`
    - `passkey`: `tfa_config.passkeys_enabled`
  - Returns only methods that are both enabled AND functional

- [ ] `getEffective2faMethods()`:
  - Combine admin `allowed_methods` with infrastructure:
    - `email`: `'email' in allowed_methods AND smtp_ready`
    - `sms`: `'sms' in allowed_methods AND sms_ready`
    - `totp`: `'totp' in allowed_methods` (always functional if enabled)
  - Returns only methods that are both enabled AND functional

- [ ] `getUserAvailableMethods(userId)`:
  - Start with `getEffectiveLoginMethods()` and `getEffective2faMethods()`
  - Filter further by user-specific state:
    - Magic link: user has `magic_link_enabled = TRUE` AND has at least one effective non-email 2FA method
    - Passkey: user has ≥1 registered passkey
    - Email 2FA: user has opted in to email method
    - SMS 2FA: user has `tfa_phone_verified = TRUE`
    - TOTP: user has `tfa_totp_verified = TRUE`
  - Returns: `{ login_methods: [...], tfa_methods: [...], preferred_login, preferred_tfa }`

### 6.3 Public Endpoint — Login Methods

```
GET /api/v1/auth/methods
GET /api/v1/auth/methods?email=user@example.com
```

**No authentication required** — this is called before login to render the login page.

Without email parameter (anonymous):
```json
{
  "login_methods": {
    "password": true,
    "magic_link": true,
    "passkey": true
  },
  "tfa_available": true,
  "smtp_ready": true,
  "sms_ready": true
}
```

With email parameter (for returning users — reveals only method availability, not user data):
```json
{
  "login_methods": {
    "password": true,
    "magic_link": true,
    "passkey": true
  },
  "user_has_passkeys": true,
  "user_preferred_method": "passkey"
}
```

Note: this endpoint must NOT leak whether the email exists. If the email is not found, return the same anonymous response. The `user_has_passkeys` and `user_preferred_method` fields are only returned when the email matches a real user, but the response shape is identical either way (fields are simply omitted for unknown emails).

### 6.4 Login Page Dynamic Rendering

- [ ] On page load: call `GET /auth/methods` (anonymous) to determine which login options to render
- [ ] After user enters email: call `GET /auth/methods?email=...` to personalize (show passkey button more prominently if user has passkeys, auto-focus preferred method)
- [ ] **Rendering rules:**
  - Passkey button: shown if `login_methods.passkey = true` (admin enabled + browser supports WebAuthn)
  - "Send Login Link" button: shown if `login_methods.magic_link = true` (admin enabled + SMTP working)
  - Password field: always shown
  - If only password is available: render classic login form with no extra options (no visual clutter)

### 6.5 2FA Prompt Dynamic Rendering

After password or magic link verification, the 2FA prompt only shows methods the user has actually configured AND that are currently functional:

- [ ] Call returns `available_methods` array with only working methods
- [ ] If user has TOTP + SMS configured but SMS provider is down: show TOTP only (no error about SMS — just don't offer it)
- [ ] If user has email + TOTP configured but SMTP is down: show TOTP only
- [ ] If user came via magic link: email method is excluded (even if configured and functional)
- [ ] If only one method is available: skip the method selector, go straight to that method's code input
- [ ] If zero methods are available (infrastructure failure): show error "Two-factor authentication is temporarily unavailable. Contact your administrator." and block login (do not degrade to passwordless 2FA bypass)

### 6.6 User Settings Dynamic Rendering

The user's 2FA and login settings page only shows methods the admin has enabled and the infrastructure supports:

- [ ] **2FA methods section:**
  - Email option: hidden entirely if admin has not enabled email 2FA OR SMTP is not configured
  - SMS option: hidden entirely if admin has not enabled SMS 2FA OR no SMS provider configured
  - TOTP option: hidden entirely if admin has not enabled TOTP
  - If no methods available: show message "Your administrator has not enabled any two-factor authentication methods."
  - If only one method available: show it without a "preferred method" selector (nothing to prefer between)

- [ ] **Login methods section:**
  - Magic link toggle: hidden if admin has not enabled magic links OR SMTP is not configured
  - Passkey management: hidden if admin has not enabled passkeys
  - Preferred login method selector: only shows methods that are enabled AND the user has set up
  - If only password is available: hide the entire "Login Method" section (nothing to configure)

### 6.7 Admin Dashboard — Configuration Gaps

Surface infrastructure gaps clearly so the admin knows what to fix:

- [ ] **SMTP not configured:**
  - Warning on 2FA config page: "SMTP is not configured. Email codes and magic links are unavailable. [Configure SMTP]"
  - Email 2FA toggle shows grayed out with tooltip: "Requires SMTP"
  - Magic link toggle shows grayed out with tooltip: "Requires SMTP"

- [ ] **SMS provider not configured:**
  - Warning on 2FA config page: "No SMS provider is configured. SMS codes are unavailable. [Configure SMS]"
  - SMS 2FA toggle shows grayed out with tooltip: "Requires Twilio or TextLinkSMS"

- [ ] **Both SMTP and SMS missing, TOTP disabled:**
  - Critical warning: "No 2FA delivery methods are available. Enable TOTP (authenticator app) — it requires no external services."

- [ ] **SMTP configured but test fails:**
  - Warning: "SMTP connection test failed. Email features may not work. [Re-test] [View error]"

- [ ] **SMS configured but test fails:**
  - Warning: "SMS provider connection test failed. SMS features may not work. [Re-test] [View error]"

### 6.8 Caching Strategy

Infrastructure checks (SMTP connectivity, SMS provider status) should NOT be checked on every request:

- [ ] Cache `getSystemCapabilities()` results for 5 minutes in Redis or in-memory
- [ ] Invalidate cache when admin updates SMTP or SMS configuration
- [ ] The login page's `GET /auth/methods` call uses cached capabilities
- [ ] If a cached capability says "ready" but the actual send fails at runtime: handle gracefully (show "delivery failed, try another method") and invalidate the cache

---

## 7. Service Layer

### 7.1 Passkey Service

```
packages/api/src/services/passkey.service.ts
```

- [ ] Install `@simplewebauthn/server` package
- [ ] `generateRegistrationOptions(userId)` — create WebAuthn registration challenge
- [ ] `verifyRegistration(userId, response)` — verify and store credential
- [ ] `generateAuthenticationOptions(email?)` — create WebAuthn authentication challenge
- [ ] `verifyAuthentication(response)` — verify signature, update counter, return tokens
- [ ] `listPasskeys(userId)` — return user's registered passkeys (id, name, type, last used)
- [ ] `renamePasskey(userId, passkeyId, name)` — update device name
- [ ] `removePasskey(userId, passkeyId)` — delete credential
- [ ] `getPasskeyCount(userId)` — count for conditional UI rendering
- [ ] Challenge storage: Redis with 5-minute TTL (or in-memory map for single-instance)

### 7.2 Magic Link Service

```
packages/api/src/services/magic-link.service.ts
```

- [ ] `sendMagicLink(email, ip, userAgent)`:
  - Validate user exists and has magic link enabled
  - Validate user has TOTP or SMS 2FA method
  - Rate limit check (pending links count + cooldown)
  - Generate 32-byte random token
  - Store SHA-256 hash with expiry
  - Send email with link
  - Return confirmation
- [ ] `verifyMagicLink(token)`:
  - Hash incoming token
  - Look up valid (unused, unexpired) record
  - Mark as used, invalidate other pending links
  - Return `tfa_token` for 2FA step
- [ ] `cleanupExpiredLinks()` — scheduled job to delete expired records
- [ ] `getActiveLinksCount(userId)` — for rate limiting

### 7.3 Updated Auth Service

```
packages/api/src/services/auth.service.ts
```

- [ ] Update login endpoint to handle three flows:
  1. Password flow (existing) → optional 2FA
  2. Passkey flow → direct token issuance (no 2FA)
  3. Magic link flow → tfa_token → mandatory non-email 2FA
- [ ] `getAvailableLoginMethods(email)` — returns which methods are available for this user:
  - `{ password: true, passkey: boolean, magic_link: boolean }`
  - Used by the login page to show/hide options

---

## 8. Build Checklist

### 8.1 Database & Dependencies
- [x] Create migration: `passkeys` table
- [x] Create migration: `magic_links` table
- [x] Create migration: add `passkeys_enabled`, `magic_link_enabled`, `magic_link_expiry_minutes`, `magic_link_max_attempts` to `tfa_config`
- [x] Create migration: add `preferred_login_method`, `magic_link_enabled` to `users`
- [x] Install `@simplewebauthn/server` package
- [x] Install `@simplewebauthn/browser` package (frontend)
- [x] Create `packages/shared/src/types/passwordless.ts` — types for passkeys and magic links
- [x] Create `packages/shared/src/schemas/passwordless.ts` — Zod schemas

### 8.2 API — Passkeys
- [x] Create `packages/api/src/services/passkey.service.ts` — full WebAuthn lifecycle
- [x] Create `packages/api/src/routes/passkey.routes.ts` — registration + authentication + management endpoints
- [x] Implement challenge storage (Redis or in-memory with TTL)
- [x] Implement counter verification for replay protection
- [x] Implement RP ID derivation from app domain (configurable for development vs production)
- [x] Audit trail on all passkey operations (register, login, remove)

### 8.3 API — Magic Links
- [x] Create `packages/api/src/services/magic-link.service.ts` — send, verify, cleanup
- [x] Create `packages/api/src/routes/magic-link.routes.ts` — send + verify + tfa endpoints
- [x] Implement 32-byte token generation with SHA-256 storage
- [x] Implement rate limiting (max pending links + cooldown)
- [x] Implement link invalidation on use (mark used + invalidate siblings)
- [x] Implement TOTP/SMS-only 2FA enforcement after magic link verification
- [x] Create cleanup scheduled job for expired magic links

### 8.4 API — Auth Updates & Dynamic Availability
- [x] Update auth service to support three login flows
- [x] Create `packages/api/src/services/auth-availability.service.ts`:
  - `getSystemCapabilities()` — check SMTP and SMS infrastructure status (cached 5 min)
  - `getEffectiveLoginMethods()` — admin toggles × infrastructure readiness
  - `getEffective2faMethods()` — admin allowed_methods × infrastructure readiness
  - `getUserAvailableMethods(userId)` — system methods × user-specific setup state
  - Cache invalidation on admin config changes
- [x] Create `GET /api/v1/auth/methods` endpoint (public, no auth):
  - Without email: return available login methods based on system config
  - With email: add user-specific hints (has passkeys, preferred method) without leaking email existence
- [x] Passkey authentication bypasses 2FA (returns access_token directly)
- [x] Magic link authentication returns tfa_token (requires non-email 2FA)
- [x] 2FA prompt only returns methods that are currently functional (not just configured)
- [x] If magic link → email 2FA method excluded from 2FA prompt
- [x] If only one 2FA method available → skip method selector, show that method directly
- [x] If zero 2FA methods functional (infrastructure failure) → block login, show error
- [x] Update login rate limiting to cover all three methods

### 8.5 API — Tests
- [x] Write Vitest tests:
  - [ ] Passkey registration: generates valid options, stores credential on verify
  - [ ] Passkey registration: excludes existing credentials (no duplicate devices)
  - [ ] Passkey authentication: valid signature → access_token returned (no 2FA)
  - [ ] Passkey authentication: invalid signature → rejected
  - [ ] Passkey authentication: counter replay (old counter) → rejected
  - [ ] Passkey removal: credential deleted, cannot be used for login
  - [ ] Magic link send: token generated, email sent, hash stored
  - [ ] Magic link send: rate limit enforced (>3 pending → rejected)
  - [ ] Magic link send: cooldown enforced (resend within 60s → rejected)
  - [ ] Magic link verify: valid token → tfa_token returned (not access_token)
  - [ ] Magic link verify: expired token → rejected
  - [ ] Magic link verify: already used token → rejected
  - [ ] Magic link verify: all other pending links invalidated on use
  - [ ] Magic link + 2FA: email 2FA method excluded from options
  - [ ] Magic link + 2FA: TOTP code accepted → access_token returned
  - [ ] Magic link + 2FA: SMS code accepted → access_token returned
  - [ ] Magic link unavailable: user with only email 2FA cannot enable magic link
  - [ ] Password login still works when passkey/magic link are enabled
  - [ ] Dynamic availability: SMTP down → email 2FA and magic link unavailable, TOTP still works
  - [ ] Dynamic availability: SMS provider down → SMS 2FA unavailable, email and TOTP still work
  - [ ] Dynamic availability: admin disables TOTP → TOTP not shown to users
  - [ ] Dynamic availability: admin disables SMS → SMS 2FA hidden, SMS toggle hidden in user settings
  - [ ] Dynamic availability: admin enables magic link but no SMTP → magic link grayed out in admin with warning
  - [ ] Dynamic availability: user has TOTP + SMS, SMS goes down → 2FA prompt shows TOTP only (no error about SMS)
  - [ ] Dynamic availability: all 2FA methods down → login blocked with admin-contact message
  - [ ] Auth methods endpoint: unknown email returns same shape as known email (no email enumeration)
  - [ ] Auth methods endpoint: known email with passkeys returns `user_has_passkeys: true`
  - [ ] Cache: capabilities cached for 5 min, admin config change invalidates cache

### 8.6 Frontend — Login Page
- [x] On page load: call `GET /auth/methods` to determine which login options to render
- [x] After email entered: call `GET /auth/methods?email=...` to personalize
- [x] Update `LoginPage.tsx` — conditional rendering based on `auth/methods` response
- [x] Install `@simplewebauthn/browser` package
- [x] Implement passkey login button (shown only when `login_methods.passkey = true`)
- [x] Implement "Send Login Link" button (shown only when `login_methods.magic_link = true`)
- [x] Implement "Continue with Password" (always shown)
- [x] Create `MagicLinkVerifyPage.tsx` — token verification + 2FA prompt (TOTP/SMS only)
- [x] Handle WebAuthn browser incompatibility: hide passkey button, no error
- [x] If only password available: render clean classic form with no extra sections or dividers
- [x] Visual separator between login methods only when multiple methods shown

### 8.7 Frontend — 2FA Prompt (Dynamic)
- [x] 2FA method tabs/buttons render only for methods returned by the API as available
- [x] If magic link login: email tab not shown even if user has email 2FA configured
- [x] If only one method available: no method selector, go straight to code input
- [x] If a method was available at login start but fails at send time (SMTP goes down mid-flow): show "This method is temporarily unavailable. [Try another method]" and remove the tab
- [x] Method selector order follows user's preferred method first

### 8.8 Frontend �� User Settings (Dynamic)
- [x] Create `LoginMethodSettings.tsx` �� preferred method selector, passkey management, magic link toggle
- [x] Create `PasskeyRegisterModal.tsx` ��� name input + WebAuthn registration ceremony (inlined in LoginMethodSettings)
- [x] Implement passkey list with rename and remove actions
- [x] Implement magic link toggle with TOTP/SMS prerequisite check
- [x] Add "Login Method" section to user security settings page
- [x] **Dynamic visibility rules:**
  - Magic link toggle: hidden if admin disabled OR SMTP not ready
  - Passkey management: hidden if admin disabled
  - Preferred login selector: hidden if only password available
  - If no passwordless methods available: hide the entire "Login Method" section

### 8.9 Frontend — Admin Settings (Dynamic)
- [x] Add "Passwordless Methods" section to `TfaConfigPage.tsx`
- [x] Implement passkey enable/disable toggle
- [x] Implement magic link enable/disable toggle with expiry and rate limit settings
- [x] **Infrastructure gap warnings:**
  - SMTP not configured: magic link toggle grayed out with "Requires SMTP" message
  - Both SMTP and SMS missing + TOTP disabled: critical warning banner
- [x] Real-time status indicator per method: green dot (enabled+ready) / gray dot (disabled or missing infra)

### 8.10 Ship Gate
- [ ] **Passkey registration:** User adds passkey → biometric prompt → passkey stored → appears in settings
- [ ] **Passkey login:** User clicks "Log in with Passkey" → biometric → dashboard (no 2FA prompt)
- [ ] **Passkey login (wrong device):** Passkey not recognized → "Try another method" → password flow works
- [ ] **Passkey + counter:** Same passkey used twice → counter increments → replay with old counter rejected
- [ ] **Passkey removal:** User removes passkey → cannot log in with it → password still works
- [ ] **Multiple passkeys:** User registers Touch ID + YubiKey → either works for login
- [ ] **Magic link send:** User enters email → clicks "Send Login Link" → email arrives with link
- [ ] **Magic link verify:** User clicks link → redirected to app → 2FA prompt shown (TOTP/SMS only, no email option)
- [ ] **Magic link + TOTP:** Enter TOTP code → access granted
- [ ] **Magic link + SMS:** Enter SMS code → access granted
- [ ] **Magic link expired:** Click link after 15 min → "Link expired" → can request new one
- [ ] **Magic link used:** Click link twice → second click shows "Already used"
- [ ] **Magic link rate limit:** Request 4 links without using any → 4th rejected
- [ ] **Magic link prerequisite:** User with only email 2FA tries to enable magic link → blocked with "Set up TOTP or SMS first"
- [ ] **Admin:** Enable passkeys → passkey button appears on login page for all users
- [ ] **Admin:** Disable passkeys → button hidden, existing passkeys still stored but can't be used
- [ ] **Admin:** Enable magic links → "Send Login Link" appears on login page
- [ ] **Admin:** SMTP not configured + magic links enabled → toggle grayed out with warning in admin
- [ ] **Fallback:** User with passkey enabled can always fall back to password login
- [ ] **Preference:** User sets preferred method to "Passkey" → passkey prompt shown first on login page
- [ ] **Dynamic: SMTP down** → login page hides "Send Login Link" → 2FA prompt hides email option → user settings hides email 2FA and magic link toggles
- [ ] **Dynamic: SMS down** → 2FA prompt hides SMS option → user settings hides SMS toggle → user with only SMS 2FA sees "This method is temporarily unavailable"
- [ ] **Dynamic: Admin disables SMS 2FA** → SMS option disappears from all user settings and 2FA prompts
- [ ] **Dynamic: Admin disables email 2FA** → email code option disappears; magic link still works (it uses SMTP for the link, not for the 2FA code)
- [ ] **Dynamic: All 2FA infrastructure down** → login blocked with "Two-factor authentication is temporarily unavailable. Contact your administrator."
- [ ] **Dynamic: Admin enables SMS but no provider configured** → SMS toggle grayed out in admin with "Requires Twilio or TextLinkSMS" tooltip
- [ ] **Dynamic: Only one 2FA method available** → 2FA prompt skips method selector, goes straight to code input
- [ ] **Dynamic: User has TOTP + email, SMTP goes down** → 2FA prompt shows only TOTP, no mention of email failure
- [ ] All Vitest tests passing
- [ ] QUESTIONS.md reviewed and resolved
