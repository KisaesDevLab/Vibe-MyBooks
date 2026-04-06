# KIS Books — Two-Factor Authentication (2FA) Feature Plan

**Feature:** Optional 2FA with email codes, SMS codes (Twilio / TextLinkSMS), and TOTP authenticator app support
**Date:** April 2, 2026
**Depends on:** BUILD_PLAN.md Phases 1 (auth), Phase 11 (setup wizard)
**Integrates with:** Auth system, Settings, Admin portal, Audit trail

---

## Feature Overview

A layered two-factor authentication system:

- **System level:** Super admin enables 2FA availability for the installation and configures SMS providers
- **User level:** Each user opts in to 2FA and chooses their preferred method(s)
- **Three methods:** Email code, SMS code, TOTP authenticator app
- **Trust this device:** Admin-configurable duration to skip 2FA on recognized devices
- **Recovery codes:** One-time backup codes generated at enrollment for lockout prevention
- **CLI escape hatch:** Emergency script to disable 2FA if admin is locked out

### Method Comparison

| Method | Cost | Security | Offline? | Setup Complexity |
|---|---|---|---|---|
| **Email** | Free (uses existing SMTP) | Medium (email can be intercepted) | No | None — uses account email |
| **SMS** | Per-message cost | Medium (SIM-swap vulnerable) | No | User provides phone number |
| **TOTP** | Free | High (device-local, no network) | Yes | User scans QR code |

### User Flow Summary

```
Login (email + password) →
  Password correct? →
    2FA enabled for this user? →
      Trusted device? → Skip 2FA → Dashboard
      Not trusted? → Show 2FA prompt →
        Enter code (from email/SMS/authenticator) →
          Code valid? → [Optional: trust this device] → Dashboard
          Code invalid? → Retry (max 5 attempts) → Lockout
        Or: "Use recovery code" → Enter recovery code → Dashboard
```

---

## 1. Data Model

### 1.1 System 2FA Configuration

Add to the existing `plaid_config`-style singleton pattern (or to `companies` for per-tenant):

```sql
CREATE TABLE tfa_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  is_enabled BOOLEAN DEFAULT FALSE,           -- master switch: makes 2FA available to users
  allowed_methods TEXT[] DEFAULT '{email,totp}', -- which methods are available: 'email', 'sms', 'totp'
  trust_device_enabled BOOLEAN DEFAULT TRUE,
  trust_device_duration_days INT DEFAULT 30,   -- how long to trust a device (1–365)
  code_expiry_seconds INT DEFAULT 300,         -- 5 minutes default
  code_length INT DEFAULT 6,                   -- 6-digit codes
  max_attempts INT DEFAULT 5,                  -- failed attempts before lockout
  lockout_duration_minutes INT DEFAULT 15,     -- lockout cooldown
  -- SMS Provider Config
  sms_provider VARCHAR(20),                   -- 'twilio' | 'textlinksms' | NULL (not configured)
  sms_twilio_account_sid_encrypted TEXT,
  sms_twilio_auth_token_encrypted TEXT,
  sms_twilio_from_number VARCHAR(20),          -- Twilio sending number (+1XXXXXXXXXX)
  sms_textlink_api_key_encrypted TEXT,
  sms_textlink_service_name VARCHAR(100),      -- app name shown in SMS (e.g., "KIS Books")
  sms_textlink_device_id VARCHAR(100),         -- optional: specific SIM card ID
  -- Metadata
  configured_by UUID REFERENCES users(id),
  configured_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 1.2 User 2FA Settings

```sql
ALTER TABLE users ADD COLUMN tfa_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN tfa_methods TEXT[] DEFAULT '{}';  -- e.g., '{totp,email}'
ALTER TABLE users ADD COLUMN tfa_preferred_method VARCHAR(20); -- default method shown at login
ALTER TABLE users ADD COLUMN tfa_phone VARCHAR(30);             -- for SMS delivery
ALTER TABLE users ADD COLUMN tfa_phone_verified BOOLEAN DEFAULT FALSE;
-- TOTP
ALTER TABLE users ADD COLUMN tfa_totp_secret_encrypted TEXT;   -- encrypted TOTP secret
ALTER TABLE users ADD COLUMN tfa_totp_verified BOOLEAN DEFAULT FALSE; -- confirmed after first successful code
-- Recovery
ALTER TABLE users ADD COLUMN tfa_recovery_codes_encrypted TEXT; -- encrypted JSON array of hashed codes
ALTER TABLE users ADD COLUMN tfa_recovery_codes_remaining INT DEFAULT 0;
-- Lockout
ALTER TABLE users ADD COLUMN tfa_failed_attempts INT DEFAULT 0;
ALTER TABLE users ADD COLUMN tfa_locked_until TIMESTAMPTZ;
```

### 1.3 Verification Codes (Ephemeral)

```sql
CREATE TABLE tfa_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  code_hash VARCHAR(255) NOT NULL,           -- bcrypt hash of the 6-digit code
  method VARCHAR(20) NOT NULL,               -- 'email' | 'sms'
  destination VARCHAR(255),                  -- email address or phone number (masked in logs)
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tfa_codes_user ON tfa_codes(user_id, used, expires_at);
```

Codes are short-lived rows. A cleanup job deletes expired/used codes daily. TOTP codes are verified in-memory (no database row needed — they're time-based).

### 1.4 Trusted Devices

```sql
CREATE TABLE tfa_trusted_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  device_fingerprint_hash VARCHAR(255) NOT NULL,  -- hash of browser fingerprint
  device_name VARCHAR(255),                        -- "Chrome on Windows", derived from user-agent
  ip_address INET,
  trusted_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  last_used_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  UNIQUE(user_id, device_fingerprint_hash)
);

CREATE INDEX idx_tfa_td_user ON tfa_trusted_devices(user_id, is_active);
```

Device fingerprint is a hash of: user-agent + screen resolution + timezone + language. Not perfect, but sufficient to recognize "same browser on same machine" without cookies (which get cleared).

### 1.5 2FA Audit Events

Extend the existing `audit_log` action values:

```
'tfa_enabled', 'tfa_disabled', 'tfa_method_added', 'tfa_method_removed',
'tfa_code_sent', 'tfa_code_verified', 'tfa_code_failed',
'tfa_recovery_used', 'tfa_lockout', 'tfa_device_trusted', 'tfa_device_revoked'
```

---

## 2. SMS Provider Abstraction

### 2.1 Provider Interface

```typescript
interface SmsProvider {
  name: string;
  sendCode(phoneNumber: string, code: string, appName: string): Promise<SendResult>;
  testConnection(): Promise<boolean>;
}

interface SendResult {
  success: boolean;
  provider_message_id?: string;
  error?: string;
}
```

### 2.2 Twilio Provider

```
packages/api/src/services/sms-providers/twilio.provider.ts
```

- [ ] Uses the `twilio` npm package
- [ ] Sends SMS via `client.messages.create()`:
  - `to`: user's phone number
  - `from`: configured Twilio number
  - `body`: "Your KIS Books verification code is: 123456. It expires in 5 minutes."
- [ ] `testConnection()`: calls `client.api.accounts(sid).fetch()` to verify credentials

### 2.3 TextLinkSMS Provider

```
packages/api/src/services/sms-providers/textlinksms.provider.ts
```

- [ ] Uses the `textlink-sms` npm package or direct REST API
- [ ] Two integration modes:
  - **Self-managed codes (default):** Send SMS via `TextLink.sendSMS(phone, message)` with our own generated code in the message body. We handle code storage and verification.
  - **TextLink verification (optional):** Use `TextLink.sendVerificationSMS(phone, options)` and `TextLink.verifyCode(phone, code)` for TextLink to manage OTP generation and verification server-side.
  - Plan uses self-managed mode for consistency across all providers.
- [ ] `testConnection()`: sends a test SMS to a configured test number or calls a TextLink health endpoint

### 2.4 Provider Factory

```
packages/api/src/services/sms-providers/index.ts
```

- [ ] `getSmsProvider(config: TfaConfig): SmsProvider` — returns the configured provider instance
- [ ] Throws clear error if SMS is in `allowed_methods` but no provider is configured

---

## 3. TOTP Implementation

### 3.1 How TOTP Works

1. **Setup:** Server generates a random 20-byte secret, encodes as Base32, stores encrypted on user record
2. **QR Code:** Server generates an `otpauth://` URI and renders it as a QR code for the user to scan with their authenticator app
3. **Verification:** User enters the 6-digit code from their app. Server computes the expected code(s) from the shared secret + current time window (±1 window for clock drift) and compares.

### 3.2 TOTP Parameters

| Parameter | Value |
|---|---|
| Algorithm | SHA-1 (standard for Google Authenticator compatibility) |
| Digits | 6 |
| Period | 30 seconds |
| Drift tolerance | ±1 window (accepts codes from -30s to +30s) |
| Secret length | 20 bytes (160 bits) |
| Encoding | Base32 |

### 3.3 TOTP Setup Flow

```
User enables TOTP →
  Server generates secret →
    Server returns QR code URI + manual entry key →
      User scans QR with authenticator app →
        User enters current code from app to confirm →
          Server verifies code against secret →
            Success: TOTP method activated, secret stored encrypted
            Failure: "Code doesn't match. Try again."
```

### 3.4 Library

Use `otpauth` npm package (or `otplib`) for:
- Secret generation
- QR code URI generation (`otpauth://totp/KISBooks:user@email?secret=BASE32SECRET&issuer=KISBooks`)
- Code verification with drift tolerance

---

## 4. Recovery Codes

### 4.1 Generation

When a user first enables ANY 2FA method:

- Generate 10 one-time recovery codes
- Each code: 8 characters, alphanumeric, formatted as `XXXX-XXXX` for readability
- Display to user ONCE with instruction to save them
- Store bcrypt hashes of each code (not plaintext)
- Store count of remaining codes on user record

### 4.2 Usage

- User clicks "Use a recovery code" on the 2FA prompt
- Enters one of their saved codes
- Server verifies against stored hashes
- If valid: mark that code as used (remove from the hashed array), decrement remaining count, grant access
- If all codes are used: warn user to generate new codes

### 4.3 Regeneration

- User can regenerate all 10 codes from their 2FA settings
- Old codes are invalidated immediately
- New codes displayed with the same save-them warning

---

## 5. Trusted Devices

### 5.1 Device Fingerprinting

After successful 2FA verification, if "Trust this device" is checked:

1. Generate a device fingerprint from: `hash(user-agent + screen_resolution + timezone + language)`
2. Set a long-lived HTTP-only cookie: `kis_device_trust` containing a signed JWT with `{ user_id, device_hash, expires_at }`
3. Store in `tfa_trusted_devices` table

### 5.2 Trust Check on Login

After successful password verification, before prompting for 2FA:

1. Check for `kis_device_trust` cookie
2. If present: verify JWT signature, check `device_hash` matches current fingerprint, check `expires_at` is in the future, check device is still active in `tfa_trusted_devices`
3. If all checks pass: skip 2FA, update `last_used_at`
4. If any check fails: remove cookie, proceed to 2FA prompt

### 5.3 Device Management

Users can view and revoke trusted devices from their 2FA settings:
- List: device name (from user-agent parsing), IP address, trusted date, last used
- "Revoke" button per device
- "Revoke All Devices" button (nuclear option)

---

## 6. API Endpoints

### 6.1 Admin — 2FA Configuration

```
GET    /api/v1/admin/tfa/config                 # Get 2FA system configuration
PUT    /api/v1/admin/tfa/config                 # Update 2FA configuration (enable/disable, methods, trust duration)
PUT    /api/v1/admin/tfa/sms-provider            # Configure SMS provider (Twilio or TextLinkSMS credentials)
POST   /api/v1/admin/tfa/sms-test               # Send test SMS to a phone number
GET    /api/v1/admin/tfa/stats                   # 2FA usage statistics (enrolled users, methods breakdown)
```

### 6.2 Auth — 2FA Verification (Login Flow)

```
POST   /api/v1/auth/login                       # Existing — now returns tfa_required: true if 2FA is enabled
POST   /api/v1/auth/tfa/verify                  # Submit 2FA code (email, SMS, or TOTP)
POST   /api/v1/auth/tfa/send-code               # Request a new code (email or SMS)
POST   /api/v1/auth/tfa/verify-recovery          # Submit a recovery code
```

### 6.3 User — 2FA Management

```
GET    /api/v1/users/me/tfa                      # Get user's 2FA status (enabled, methods, devices)
POST   /api/v1/users/me/tfa/enable               # Begin 2FA enrollment
DELETE /api/v1/users/me/tfa/disable              # Disable 2FA (requires current password)
-- Email method
POST   /api/v1/users/me/tfa/methods/email        # Enable email method
DELETE /api/v1/users/me/tfa/methods/email         # Disable email method
-- SMS method
POST   /api/v1/users/me/tfa/methods/sms          # Enable SMS — sends verification code to provided phone
POST   /api/v1/users/me/tfa/methods/sms/verify   # Verify phone number with code
DELETE /api/v1/users/me/tfa/methods/sms           # Disable SMS method
-- TOTP method
POST   /api/v1/users/me/tfa/methods/totp          # Enable TOTP — returns secret + QR URI
POST   /api/v1/users/me/tfa/methods/totp/verify   # Confirm TOTP setup with a code from the app
DELETE /api/v1/users/me/tfa/methods/totp           # Disable TOTP method
-- Recovery codes
POST   /api/v1/users/me/tfa/recovery-codes        # Generate (or regenerate) recovery codes
-- Trusted devices
GET    /api/v1/users/me/tfa/devices               # List trusted devices
DELETE /api/v1/users/me/tfa/devices/:id           # Revoke a trusted device
DELETE /api/v1/users/me/tfa/devices               # Revoke all trusted devices
-- Preference
PUT    /api/v1/users/me/tfa/preferred-method      # Set preferred method
```

---

## 7. Service Layer

### 7.1 TFA Config Service

```
packages/api/src/services/tfa-config.service.ts
```

- [ ] `getConfig()` — return system 2FA configuration (decrypt secrets for internal use only)
- [ ] `updateConfig(input)` — update config, validate allowed_methods, encrypt provider credentials
- [ ] `isTfaAvailable()` — returns true if 2FA is enabled system-wide
- [ ] `isMethodAvailable(method)` — checks both system config and provider readiness
- [ ] `getSmsProvider()` — returns configured provider instance or null

### 7.2 TFA Service (Core Logic)

```
packages/api/src/services/tfa.service.ts
```

- [ ] `checkTfaRequired(userId)`:
  - Is 2FA enabled system-wide? If no → not required
  - Does this user have 2FA enabled? If no → not required
  - Is the current device trusted? If yes → not required
  - Otherwise → required, return available methods and preferred method

- [ ] `generateAndSendCode(userId, method)`:
  - Generate cryptographically random 6-digit code
  - Hash the code with bcrypt
  - Store in `tfa_codes` table with expiration
  - Delete any existing unused codes for this user + method (only one active at a time)
  - If method = 'email': send via existing email service
  - If method = 'sms': send via configured SMS provider
  - Audit log: `tfa_code_sent`
  - Return: `{ method, destination_masked, expires_in_seconds }`

- [ ] `verifyCode(userId, code, method)`:
  - Check lockout status — if locked, return error with remaining lockout time
  - If method = 'totp': verify against user's TOTP secret (time-based, ±1 window)
  - If method = 'email' or 'sms': find active (unused, unexpired) code in `tfa_codes`, bcrypt compare
  - If valid:
    - Mark code as used
    - Reset failed attempt counter
    - Audit log: `tfa_code_verified`
    - Return success + option to trust device
  - If invalid:
    - Increment failed attempt counter
    - If attempts >= max_attempts: set lockout, audit log `tfa_lockout`
    - Audit log: `tfa_code_failed`
    - Return error with remaining attempts

- [ ] `verifyRecoveryCode(userId, code)`:
  - Decrypt recovery codes array
  - Bcrypt compare against each remaining code
  - If match: remove the used code, re-encrypt and save, decrement remaining count
  - Audit log: `tfa_recovery_used`
  - Warn if remaining codes < 3

- [ ] `trustDevice(userId, deviceFingerprint, userAgent, ipAddress)`:
  - Compute duration from system config
  - Create or update `tfa_trusted_devices` row
  - Set `kis_device_trust` cookie
  - Audit log: `tfa_device_trusted`

- [ ] `checkDeviceTrust(userId, cookie)`:
  - Verify JWT from cookie
  - Match device fingerprint hash
  - Check expiration
  - Check device still active in database
  - Return trusted or not

### 7.3 TFA Enrollment Service

```
packages/api/src/services/tfa-enrollment.service.ts
```

- [ ] `enableTfa(userId)`:
  - Validate system 2FA is enabled
  - Set `tfa_enabled = TRUE` on user
  - Generate recovery codes (10 codes)
  - Return recovery codes (plaintext, one-time display)
  - Audit log: `tfa_enabled`

- [ ] `disableTfa(userId, password)`:
  - Verify current password
  - Set `tfa_enabled = FALSE`
  - Clear all methods, secrets, recovery codes
  - Revoke all trusted devices
  - Audit log: `tfa_disabled`

- [ ] `addEmailMethod(userId)`:
  - Add 'email' to `tfa_methods` array
  - Uses the user's account email (no separate setup needed)
  - Audit log: `tfa_method_added`

- [ ] `addSmsMethod(userId, phoneNumber)`:
  - Validate phone number format (E.164)
  - Send verification code to the phone number
  - Store phone number as `tfa_phone` (unverified)
  - Return: "verification code sent"

- [ ] `verifySmsSetup(userId, code)`:
  - Verify the code matches what was sent
  - Set `tfa_phone_verified = TRUE`
  - Add 'sms' to `tfa_methods` array
  - Audit log: `tfa_method_added`

- [ ] `addTotpMethod(userId)`:
  - Generate TOTP secret (20 bytes, Base32 encoded)
  - Encrypt and store as `tfa_totp_secret_encrypted`
  - Generate `otpauth://` URI
  - Return: `{ secret_base32, qr_code_uri, manual_entry_key }`
  - TOTP is NOT active yet — requires confirmation

- [ ] `verifyTotpSetup(userId, code)`:
  - Decrypt secret
  - Verify the code against the secret
  - If valid: set `tfa_totp_verified = TRUE`, add 'totp' to `tfa_methods` array
  - Audit log: `tfa_method_added`

- [ ] `removeMethod(userId, method)`:
  - Remove method from `tfa_methods` array
  - If method = 'sms': clear `tfa_phone`, `tfa_phone_verified`
  - If method = 'totp': clear `tfa_totp_secret_encrypted`, `tfa_totp_verified`
  - If no methods remain: warn user (or auto-disable 2FA)
  - Audit log: `tfa_method_removed`

- [ ] `regenerateRecoveryCodes(userId, password)`:
  - Verify current password
  - Generate 10 new codes
  - Replace stored hashes
  - Return new codes (plaintext, one-time display)

---

## 8. Modified Login Flow

### 8.1 Updated Auth Flow

The existing login endpoint changes:

```
POST /auth/login
  Body: { email, password }
  
  Response (no 2FA):
    { access_token, refresh_token, user }
  
  Response (2FA required):
    {
      tfa_required: true,
      tfa_token: "ephemeral-jwt",     // short-lived token (5 min) proving password was correct
      available_methods: ["totp", "email", "sms"],
      preferred_method: "totp",
      phone_masked: "***-***-4567",   // only if SMS is available
      email_masked: "k***@kis***.com" // only if email is available
    }
```

The `tfa_token` is a short-lived JWT (5 minutes) that encodes `{ userId, tfa_pending: true }`. It proves the password was correct but does NOT grant access to the application. It is required on the `POST /auth/tfa/verify` endpoint.

### 8.2 2FA Verification

```
POST /auth/tfa/verify
  Headers: { Authorization: Bearer <tfa_token> }
  Body: { code, method, trust_device? }
  
  Response (success):
    { access_token, refresh_token, user }
    + Set-Cookie: kis_device_trust (if trust_device = true)
  
  Response (failure):
    { error: "invalid_code", remaining_attempts: 3 }
  
  Response (locked out):
    { error: "tfa_locked", locked_until: "2026-03-15T14:15:00Z" }
```

### 8.3 Code Request

```
POST /auth/tfa/send-code
  Headers: { Authorization: Bearer <tfa_token> }
  Body: { method: "email" | "sms" }
  
  Response:
    { sent: true, destination_masked: "k***@kis***.com", expires_in: 300 }
```

TOTP doesn't need this endpoint — codes are generated locally by the authenticator app.

---

## 9. Frontend Components

### 9.1 Login Page — 2FA Step

```
packages/web/src/features/auth/TfaVerifyStep.tsx
```

Shown after successful password entry when `tfa_required = true`.

- [ ] **Method selector** (if user has multiple methods):
  - Tabs or buttons: "Authenticator App" / "Email Code" / "Text Message"
  - Preferred method shown first

- [ ] **TOTP input:**
  - 6-digit code input (auto-focus, auto-advance between digits)
  - "Enter the code from your authenticator app"
  - Submit button (also submits on 6th digit entry)

- [ ] **Email code input:**
  - "We sent a code to k***@kis***.com"
  - 6-digit code input
  - "Didn't receive it? [Resend code]" (cooldown: 60 seconds between resends)
  - Resend counter: "Resend available in 45s"

- [ ] **SMS code input:**
  - "We sent a code to ***-***-4567"
  - 6-digit code input
  - "Didn't receive it? [Resend code]" (cooldown: 60 seconds)

- [ ] **Trust device checkbox:**
  - "Trust this device for [30] days"
  - Only shown if trust is enabled in system config

- [ ] **Recovery code link:**
  - "Can't access your authenticator? [Use a recovery code]"
  - Opens a separate input for the 8-character recovery code

- [ ] **Error handling:**
  - Invalid code: shake animation, "Invalid code. [X] attempts remaining."
  - Locked out: "Too many failed attempts. Try again in [X] minutes." Countdown timer.
  - Expired code: "Code expired. [Request a new code]"

### 9.2 User 2FA Settings Page

```
packages/web/src/features/settings/TfaSettingsPage.tsx
```

- [ ] **2FA status card:**
  - If 2FA available but not enabled: "Two-factor authentication is available. Enable it to add an extra layer of security."
  - If 2FA not available (admin disabled): "Two-factor authentication is not enabled for this system. Contact your administrator."
  - If 2FA enabled: "Two-factor authentication is active." with green badge

- [ ] **Enable 2FA button** (if not enabled):
  - Opens confirmation: "Enabling 2FA adds an extra verification step when you log in."
  - On enable: generates and displays recovery codes with save/download prompt
  - Must set up at least one method to complete enrollment

- [ ] **Methods section** (if 2FA enabled):

  **Email:**
  - Status: Enabled / Not configured
  - "Add email verification" button — uses account email, no extra setup
  - "Remove" button

  **SMS:**
  - Status: Enabled (***-***-4567) / Not configured
  - "Add SMS verification" button → phone number input → verification code → confirm
  - "Change phone number" → same flow as add
  - "Remove" button
  - Note if SMS provider not configured: "SMS is not available. Your administrator has not configured an SMS provider."

  **Authenticator App (TOTP):**
  - Status: Enabled / Not configured
  - "Set up authenticator" button → shows QR code + manual key → user enters code to confirm
  - "Reconfigure" button (generates new secret, invalidates old)
  - "Remove" button
  - Supported apps listed: "Google Authenticator, Authy, Microsoft Authenticator, 1Password"

- [ ] **Preferred method selector:**
  - Dropdown of enabled methods
  - "This method will be shown first at login"

- [ ] **Recovery codes section:**
  - "You have [X] recovery codes remaining"
  - "View codes" button → requires password → shows codes with copy/download
  - "Generate new codes" button → requires password → invalidates old, shows new
  - Warning if < 3 remaining: "You're running low on recovery codes. Generate new ones."

- [ ] **Trusted devices section:**
  - Table: Device Name, IP Address, Trusted Date, Last Used
  - "Revoke" button per device
  - "Revoke All Devices" button

- [ ] **Disable 2FA button:**
  - Requires current password
  - Confirmation: "This will remove all 2FA methods, recovery codes, and trusted devices."

### 9.3 TOTP Setup Modal

```
packages/web/src/features/settings/TotpSetupModal.tsx
```

- [ ] Step 1: QR code display
  - Large QR code (scannable by authenticator app)
  - Manual entry key displayed below (copyable): "JBSW Y3DP EHPK 3PXP"
  - "Can't scan? Enter this key manually in your authenticator app."
  - "Next" button

- [ ] Step 2: Verification
  - "Enter the 6-digit code from your authenticator app"
  - Code input field
  - "Verify" button
  - On success: method activated, close modal
  - On failure: "Code doesn't match. Make sure the time on your device is correct. Try again."

### 9.4 Recovery Codes Display Modal

```
packages/web/src/features/settings/RecoveryCodesModal.tsx
```

- [ ] Grid of 10 codes, monospace font, large text:
  ```
  ABCD-1234    EFGH-5678
  IJKL-9012    MNOP-3456
  QRST-7890    UVWX-1234
  YZAB-5678    CDEF-9012
  GHIJ-3456    KLMN-7890
  ```
- [ ] "Copy All" button
- [ ] "Download as .txt" button
- [ ] "Print" button
- [ ] Warning: "Save these codes somewhere safe. Each code can only be used once. If you lose access to your 2FA method, these are the only way to recover your account."
- [ ] Checkbox: "I have saved these codes" (required to close the modal on first generation)

### 9.5 SMS Phone Number Setup

```
packages/web/src/features/settings/SmsSetupModal.tsx
```

- [ ] Step 1: Phone number input
  - Country code selector (default from company country)
  - Phone number input with formatting
  - "Send verification code" button

- [ ] Step 2: Verification
  - "Enter the 6-digit code sent to [masked number]"
  - Code input
  - "Didn't receive it? [Resend]" with cooldown
  - "Verify" button
  - On success: SMS method activated

### 9.6 Admin — 2FA Configuration Page

```
packages/web/src/features/admin/TfaConfigPage.tsx
```

- [ ] **2FA System Toggle:**
  - Enable/Disable switch
  - When disabled: "Two-factor authentication is disabled for all users. No one will be prompted for 2FA."
  - When enabled: "Two-factor authentication is available. Users can opt in from their settings."

- [ ] **Available Methods:**
  - Checkboxes: Email, SMS, Authenticator App (TOTP)
  - Email: always available (uses SMTP, no additional config)
  - TOTP: always available (no external service needed)
  - SMS: requires provider configuration (grayed out if no provider configured)

- [ ] **SMS Provider Configuration:**
  - Provider selector: None / Twilio / TextLinkSMS
  - **Twilio fields** (shown when Twilio selected):
    - Account SID (text, masked)
    - Auth Token (password, reveal toggle)
    - From Number (+1XXXXXXXXXX with E.164 validation)
    - "Test Connection" button → sends test SMS to a provided number
  - **TextLinkSMS fields** (shown when TextLinkSMS selected):
    - API Key (password, reveal toggle)
    - Service Name (text, default "KIS Books" — appears in SMS message)
    - Device ID (optional, for specific SIM card)
    - "Test Connection" button → sends test SMS
  - Provider status indicator: "Connected" / "Not configured" / "Error: [details]"

- [ ] **Trust Device Settings:**
  - Enable/disable toggle
  - Duration: number input + "days" label (1–365, default 30)

- [ ] **Security Settings:**
  - Code expiration: dropdown (1 min, 2 min, 5 min, 10 min)
  - Code length: dropdown (6 digits, 8 digits)
  - Max failed attempts: dropdown (3, 5, 10)
  - Lockout duration: dropdown (5 min, 15 min, 30 min, 1 hour)

- [ ] **2FA Usage Statistics:**
  - Total users with 2FA enabled (count and percentage)
  - Breakdown by method: Email / SMS / TOTP
  - Recent 2FA events: last 10 verifications, failures, lockouts

- [ ] Add "Two-Factor Auth" to Admin section in sidebar

---

## 10. CLI Escape Hatch

### 10.1 Emergency 2FA Disable Script

```
scripts/disable-2fa.ts
```

For when the super admin enables required 2FA and then loses access to their 2FA method AND all recovery codes.

- [ ] Run from within the Docker container: `docker exec -it kisbooks-api node scripts/disable-2fa.js`
- [ ] Flow:
  1. "⚠️  EMERGENCY: This will disable 2FA for a user account."
  2. Prompt: "Enter the email address of the account:"
  3. Verify the account exists
  4. Prompt: "Type 'DISABLE-2FA' to confirm:"
  5. Disable 2FA on the account, clear all methods/secrets/devices
  6. Log to audit trail: `tfa_disabled` with note "Emergency CLI override"
  7. Print: "2FA has been disabled for [email]. The user can now log in with just their password."

### 10.2 System-Wide 2FA Disable

```
scripts/disable-2fa-system.ts
```

Nuclear option — disables 2FA for the entire installation.

- [ ] Sets `tfa_config.is_enabled = FALSE`
- [ ] Does NOT clear individual user 2FA settings (so re-enabling system 2FA restores user settings)
- [ ] Requires typing "DISABLE-ALL-2FA" to confirm

---

## 11. Build Checklist

### 11.1 Database & Shared Types
- [x] Create migration: `tfa_config` table
- [x] Create migration: add 2FA columns to `users` table
- [x] Create migration: `tfa_codes` table
- [x] Create migration: `tfa_trusted_devices` table
- [x] Create `packages/shared/src/types/tfa.ts` — all 2FA types, enums, inputs
- [x] Create `packages/shared/src/schemas/tfa.ts` — Zod schemas

### 11.2 API — SMS Providers
- [ ] Install `twilio` npm package (optional — dynamic import, install when configuring)
- [ ] Install `textlink-sms` npm package (optional — uses REST API directly)
- [x] Create `packages/api/src/services/sms-providers/sms-provider.interface.ts` — provider interface
- [x] Create `packages/api/src/services/sms-providers/twilio.provider.ts` — Twilio implementation
- [x] Create `packages/api/src/services/sms-providers/textlinksms.provider.ts` — TextLinkSMS implementation
- [x] Create `packages/api/src/services/sms-providers/index.ts` — provider factory
- [x] Implement credential encryption/decryption for both providers (AES-256-GCM via utils/encryption.ts)
- [x] Implement test connection for both providers

### 11.3 API — 2FA Services
- [x] Create `packages/api/src/services/tfa-config.service.ts` — system config management
- [x] Create `packages/api/src/services/tfa.service.ts` — core 2FA logic (check, generate, verify, trust)
- [x] Create `packages/api/src/services/tfa-enrollment.service.ts` — enable, disable, add/remove methods, recovery codes
- [x] Implement 6-digit code generation (cryptographically random)
- [x] Implement code hashing (bcrypt) and verification
- [x] Implement TOTP secret generation and verification (using `otplib` library)
- [x] Implement recovery code generation (10 × 8-char alphanumeric)
- [x] Implement device fingerprinting and trust cookie (signed JWT)
- [x] Implement lockout logic (attempts counter, timed lockout)
- [x] Implement code expiration and cleanup

### 11.4 API — Routes & Auth Flow
- [x] Create `packages/api/src/routes/tfa.routes.ts` — all user-facing 2FA endpoints
- [x] Create `packages/api/src/routes/admin-tfa.routes.ts` — admin configuration endpoints (in admin.routes.ts)
- [x] Update `packages/api/src/routes/auth.routes.ts`:
  - Login returns `tfa_required` + `tfa_token` when 2FA is needed
  - Add `POST /auth/tfa/verify` endpoint
  - Add `POST /auth/tfa/send-code` endpoint
  - Add `POST /auth/tfa/verify-recovery` endpoint
- [x] Implement `tfa_token` (short-lived JWT, 5 min, proves password correct)
- [x] Implement trust device cookie set/check
- [x] Add 2FA audit events to audit trail

### 11.5 API — Tests
- [x] Write Vitest tests:
  - [x] System config: enable/disable 2FA, update allowed methods
  - [ ] Email code: generate, send (mock SMTP), verify correct code, reject wrong code
  - [ ] SMS code (Twilio mock): generate, send, verify
  - [ ] SMS code (TextLink mock): generate, send, verify
  - [x] TOTP: generate secret, produce QR URI, verify code matches secret, drift tolerance works
  - [ ] TOTP: code from 31+ seconds ago rejected
  - [x] Recovery code: generate 10, use one, 9 remaining, used code rejected on retry
  - [x] Recovery code: regenerate invalidates old codes
  - [ ] Login flow: password correct + 2FA enabled → returns tfa_required + tfa_token
  - [ ] Login flow: valid tfa_token + valid code → returns access_token
  - [ ] Login flow: expired tfa_token → rejected
  - [x] Lockout: 5 failed attempts → locked for configured duration
  - [ ] Lockout: attempt during lockout → rejected with remaining time
  - [ ] Lockout: attempt after lockout expires → allowed
  - [x] Trust device: cookie set after trust → next login skips 2FA
  - [ ] Trust device: expired cookie → 2FA required
  - [x] Trust device: revoked device → 2FA required
  - [ ] Method add/remove: add SMS, verify phone, remove SMS → phone cleared
  - [x] Disable 2FA: clears all methods, devices, codes

### 11.6 Frontend — Auth Flow
- [x] Create `TfaVerifyStep.tsx` — 2FA code entry after password (TOTP, email, SMS inputs)
- [x] Implement method selector tabs
- [x] Implement 6-digit code input with auto-advance and auto-submit
- [x] Implement "Resend code" with 60-second cooldown timer
- [x] Implement "Use recovery code" fallback input
- [x] Implement "Trust this device" checkbox
- [x] Implement lockout countdown display
- [x] Integrate into existing login page flow

### 11.7 Frontend — User Settings
- [x] Create `TfaSettingsPage.tsx` — 2FA status, methods, devices, recovery codes
- [x] Create `TotpSetupModal.tsx` — QR code display + verification step (inlined in TfaSettingsPage)
- [x] Create `RecoveryCodesModal.tsx` — display codes with copy/download/print (inlined in TfaSettingsPage)
- [x] Create `SmsSetupModal.tsx` — phone input + verification (inlined in TfaSettingsPage)
- [x] Implement method add/remove for all three methods
- [x] Implement preferred method selector
- [x] Implement trusted devices list with revoke
- [x] Implement recovery code regeneration
- [x] Implement disable 2FA with password confirmation
- [x] Add "Security" or "Two-Factor Auth" section to user settings sidebar
- [x] Generate QR code client-side using `qrcode` npm package

### 11.8 Frontend — Admin
- [x] Create `TfaConfigPage.tsx` — system toggle, methods, SMS provider config, trust settings, security settings
- [x] Implement SMS provider selector with provider-specific credential fields
- [x] Implement "Test Connection" for both SMS providers
- [x] Implement usage statistics display
- [x] Add "Two-Factor Auth" to admin sidebar section

### 11.9 CLI Scripts
- [x] Create `scripts/disable-2fa.ts` — disable 2FA for a single user
- [x] Create `scripts/disable-2fa-system.ts` — disable 2FA system-wide
- [x] Both require confirmation prompt
- [x] Both log to audit trail

### 11.10 Scheduled Jobs
- [x] Create cleanup job: delete expired/used `tfa_codes` rows (daily)
- [x] Create cleanup job: delete expired `tfa_trusted_devices` rows (daily)

### 11.11 Setup Wizard Integration
- [ ] Add optional "Two-Factor Authentication" step to setup wizard (after admin account creation)
- [ ] Skip by default — can be configured later in admin settings
- [ ] If enabled during setup: present TOTP QR code for the admin account immediately

### 11.12 Ship Gate
- [ ] **Admin:** Enable 2FA system-wide → users see "Enable 2FA" option in their settings
- [ ] **Admin:** Disable 2FA system-wide → 2FA prompts stop for all users (settings preserved)
- [ ] **Admin:** Configure Twilio → test SMS sends successfully
- [ ] **Admin:** Configure TextLinkSMS → test SMS sends successfully
- [ ] **Admin:** Switch between Twilio and TextLinkSMS → correct provider used
- [ ] **Admin:** Usage stats show correct enrollment counts
- [ ] **User:** Enable 2FA → recovery codes displayed → must save before proceeding
- [ ] **User:** Add email method → code sent to account email → verify → method active
- [ ] **User:** Add SMS method → enter phone → code sent → verify → method active
- [ ] **User:** Add TOTP method → scan QR → enter code from app → method active
- [ ] **User:** Login with 2FA → password correct → 2FA prompt → enter TOTP code → access granted
- [ ] **User:** Login with 2FA → choose "Email Code" → code arrives → enter → access granted
- [ ] **User:** Login with 2FA → choose "Text Message" → SMS arrives → enter → access granted
- [ ] **User:** Wrong code 5 times → locked out for configured duration → lockout message shown
- [ ] **User:** Use recovery code → access granted → recovery code count decremented
- [ ] **User:** "Trust this device" checked → next login skips 2FA → trust lasts configured days
- [ ] **User:** Revoke trusted device → next login from that device requires 2FA
- [ ] **User:** Revoke all devices → all devices require 2FA on next login
- [ ] **User:** Disable 2FA → password required → all methods/devices/codes cleared
- [ ] **User:** SMS not available when admin hasn't configured SMS provider (method grayed out)
- [ ] **Recovery:** All recovery codes used → warning shown → user prompted to regenerate
- [ ] **CLI:** `scripts/disable-2fa.ts` disables 2FA for specified user → user can log in with password only
- [ ] **CLI:** `scripts/disable-2fa-system.ts` disables system-wide → no users prompted for 2FA
- [ ] **Audit:** All 2FA events logged (enable, disable, verify, fail, lockout, trust, revoke)
- [ ] All Vitest tests passing
- [ ] QUESTIONS.md reviewed and resolved
