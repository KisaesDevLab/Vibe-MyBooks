# KIS Books Addendum — Cloud Storage Providers

**Product:** KIS Books  
**Author:** Kisaes LLC  
**Date:** April 2026  
**Depends On:** File Attachments Addendum, Phase 9 (Attachments & OCR) from main BUILD_PLAN.md  
**Modifies:** Attachment service storage layer, tenant settings, setup wizard

---

## Executive Summary

Allow each tenant to choose where their uploaded files are physically stored. Options include local disk (default, existing behavior), Dropbox, Google Drive, or Microsoft OneDrive. The storage choice is per-tenant, configured in company settings, and transparent to the rest of the application — every feature (inbox, viewer, OCR, matching) works identically regardless of which storage backend is active. A provider abstraction layer ensures new providers can be added without modifying business logic.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Application Layer                         │
│  (Attachment Service, OCR, Inbox, Viewer, Matching)         │
│                                                              │
│  Calls: storageProvider.upload(), .download(), .delete()     │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│               Storage Provider Interface                     │
│                                                              │
│  upload(tenantId, key, stream, metadata) → StorageResult     │
│  download(tenantId, key) → ReadableStream                    │
│  delete(tenantId, key) → void                                │
│  getSignedUrl(tenantId, key, expiry) → string                │
│  exists(tenantId, key) → boolean                             │
│  getMetadata(tenantId, key) → FileMetadata                   │
└────┬──────────┬──────────┬──────────┬───────────────────────┘
     │          │          │          │
     ▼          ▼          ▼          ▼
  ┌──────┐ ┌────────┐ ┌────────┐ ┌─────────┐
  │Local │ │Dropbox │ │Google  │ │OneDrive │
  │Disk  │ │        │ │Drive   │ │         │
  └──────┘ └────────┘ └────────┘ └─────────┘
```

**Key design principle:** the `attachments` table always stores a provider-agnostic storage key (e.g., `attachments/{tenant_id}/{uuid}.pdf`). The active provider resolves this key to an actual file path, Dropbox path, Drive file ID, or OneDrive item ID. This means switching providers only requires migrating the files — no database schema changes.

---

## 1. Schema Changes

### 1.1 Create `storage_providers` Table

```sql
CREATE TABLE storage_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  -- Provider type
  provider VARCHAR(30) NOT NULL,                -- 'local' | 'dropbox' | 'google_drive' | 'onedrive' | 's3'
  is_active BOOLEAN DEFAULT TRUE,               -- only one active provider per tenant
  -- OAuth tokens (encrypted at rest)
  access_token_encrypted TEXT,
  refresh_token_encrypted TEXT,
  token_expires_at TIMESTAMPTZ,
  -- Provider-specific config
  config JSONB NOT NULL DEFAULT '{}',
  -- Dropbox: { "root_folder": "/KIS Books", "account_id": "..." }
  -- Google Drive: { "folder_id": "...", "email": "..." }
  -- OneDrive: { "drive_id": "...", "folder_id": "...", "email": "..." }
  -- S3: { "bucket": "...", "region": "...", "prefix": "...", "endpoint": "..." }
  -- Local: { "base_path": "/data/uploads" }
  -- Connection health
  last_health_check_at TIMESTAMPTZ,
  health_status VARCHAR(20) DEFAULT 'unknown',  -- 'healthy' | 'degraded' | 'error' | 'unknown'
  health_error TEXT,
  -- Metadata
  display_name VARCHAR(100),                    -- e.g., "My Dropbox" or "Firm Google Drive"
  connected_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, provider)                   -- one config per provider per tenant
);

CREATE INDEX idx_sp_tenant_active ON storage_providers(tenant_id) WHERE is_active = TRUE;
```

### 1.2 Modify `attachments` Table

```sql
ALTER TABLE attachments ADD COLUMN IF NOT EXISTS
  -- Storage key (provider-agnostic path)
  storage_key VARCHAR(500),                     -- e.g., 'attachments/{tenant_id}/{uuid}.pdf'
  storage_provider VARCHAR(30) DEFAULT 'local', -- which provider this file is stored on
  -- Provider-specific reference (for providers that assign their own IDs)
  provider_file_id VARCHAR(500),                -- Dropbox: rev, Google Drive: file ID, OneDrive: item ID
  -- Local cache (for cloud providers, thumbnails and previews are cached locally)
  local_cache_path VARCHAR(500),                -- path to local cached copy (if downloaded for OCR, viewer, etc.)
  cache_expires_at TIMESTAMPTZ;                 -- when the local cache should be evicted
```

**Migration note:** for existing attachments on local disk, populate `storage_key` from the existing `file_path` column and set `storage_provider = 'local'`. The `file_path` column is retained for backward compatibility but `storage_key` becomes the canonical reference.

### 1.3 Create `storage_migrations` Table

Tracks file migration progress when a tenant switches providers.

```sql
CREATE TABLE storage_migrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  from_provider VARCHAR(30) NOT NULL,
  to_provider VARCHAR(30) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',         -- 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  total_files INT NOT NULL DEFAULT 0,
  migrated_files INT NOT NULL DEFAULT 0,
  failed_files INT NOT NULL DEFAULT 0,
  error_log JSONB DEFAULT '[]',                 -- array of { attachment_id, error }
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 2. Provider Abstraction Layer

### 2.1 Storage Provider Interface

```
packages/api/src/services/storage/storage-provider.interface.ts
```

```typescript
interface StorageProvider {
  readonly name: string;                    // 'local' | 'dropbox' | 'google_drive' | 'onedrive' | 's3'
  readonly requiresOAuth: boolean;

  // File operations
  upload(key: string, stream: Readable, metadata: FileMetadata): Promise<StorageResult>;
  download(key: string): Promise<Readable>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;

  // URL generation (for inline viewing / direct download)
  getTemporaryUrl(key: string, expiresInSeconds: number): Promise<string>;

  // Health check
  checkHealth(): Promise<HealthResult>;

  // Storage info
  getUsage(): Promise<{ used_bytes: number; total_bytes: number | null }>;
}

interface FileMetadata {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

interface StorageResult {
  key: string;
  providerFileId?: string;          // provider-assigned ID
  sizeBytes: number;
  url?: string;                     // direct URL if available
}

interface HealthResult {
  status: 'healthy' | 'degraded' | 'error';
  latencyMs: number;
  error?: string;
}
```

### 2.2 Provider Implementations

```
packages/api/src/services/storage/
├── storage-provider.interface.ts
├── storage-provider.factory.ts      # Factory: creates provider from config
├── local.provider.ts                # Local disk (existing behavior, refactored)
├── dropbox.provider.ts              # Dropbox API v2
├── google-drive.provider.ts         # Google Drive API v3
├── onedrive.provider.ts             # Microsoft Graph API
├── s3.provider.ts                   # S3-compatible (AWS, MinIO, Backblaze, etc.)
└── cache.service.ts                 # Local cache for cloud-stored files
```

### 2.3 Local Disk Provider

```
packages/api/src/services/storage/local.provider.ts
```

- [ ] Refactor existing file storage logic into the provider interface
- [ ] `upload()`: write to `/data/uploads/{key}`
- [ ] `download()`: create read stream from disk
- [ ] `delete()`: unlink file
- [ ] `getTemporaryUrl()`: return a signed API URL (`/attachments/:id/download?token=...`) with short-lived token
- [ ] `checkHealth()`: verify the upload directory is writable
- [ ] `getUsage()`: `du -sb /data/uploads/{tenant_dir}`
- [ ] This is the default provider and requires zero configuration

### 2.4 Dropbox Provider

```
packages/api/src/services/storage/dropbox.provider.ts
```

- [ ] Use the Dropbox JavaScript SDK (`dropbox` npm package)
- [ ] **Folder structure on Dropbox:** `/{root_folder}/{tenant_slug}/attachments/{uuid}.{ext}`
  - Default root folder: `KIS Books`
  - Configurable in settings
- [ ] `upload()`: `filesUpload()` with `mode: overwrite`
- [ ] `download()`: `filesDownload()` → stream the binary content
- [ ] `delete()`: `filesDeleteV2()`
- [ ] `getTemporaryUrl()`: `filesGetTemporaryLink()` — returns a 4-hour temporary link
- [ ] `checkHealth()`: `usersGetCurrentAccount()` — verify token is valid
- [ ] `getUsage()`: `usersGetSpaceUsage()`
- [ ] **Token refresh:** Dropbox access tokens expire; use `refresh_token` to obtain new access tokens. Implement automatic refresh on 401 responses.

### 2.5 Google Drive Provider

```
packages/api/src/services/storage/google-drive.provider.ts
```

- [ ] Use the Google APIs Node.js client (`googleapis` npm package)
- [ ] **Folder structure on Drive:** a dedicated folder (auto-created on setup) containing per-tenant subfolders
  - On first connect: create a "KIS Books" folder in the user's Drive (or use a specified folder)
  - Store `folder_id` in `storage_providers.config`
- [ ] `upload()`: `drive.files.create()` with `parents: [folderId]`, upload media as stream
  - Store the returned `file.id` as `provider_file_id` on the attachment
- [ ] `download()`: `drive.files.get({ fileId, alt: 'media' })` → stream
- [ ] `delete()`: `drive.files.delete({ fileId })`
- [ ] `getTemporaryUrl()`: `drive.files.get({ fields: 'webContentLink' })` — note: requires the file to be shared or use a short-lived download URL via the API
- [ ] `checkHealth()`: `drive.about.get({ fields: 'user' })`
- [ ] `getUsage()`: `drive.about.get({ fields: 'storageQuota' })`
- [ ] **Token refresh:** Google OAuth tokens expire after 1 hour; use `refresh_token` with the OAuth2 client to auto-refresh. Store updated tokens.
- [ ] **Important:** request only `drive.file` scope (app-created files only) — not full Drive access

### 2.6 OneDrive Provider

```
packages/api/src/services/storage/onedrive.provider.ts
```

- [ ] Use the Microsoft Graph JavaScript SDK (`@microsoft/microsoft-graph-client` + `@azure/msal-node`)
- [ ] **Folder structure on OneDrive:** `/KIS Books/{tenant_slug}/attachments/{uuid}.{ext}`
  - On first connect: create the folder structure via Graph API
  - Store `drive_id` and `folder_id` in config
- [ ] `upload()`: for files ≤ 4MB use `PUT /drive/items/{parent-id}:/{filename}:/content`; for files > 4MB use upload sessions (`createUploadSession`)
- [ ] `download()`: `GET /drive/items/{item-id}/content` → stream
- [ ] `delete()`: `DELETE /drive/items/{item-id}`
- [ ] `getTemporaryUrl()`: `POST /drive/items/{item-id}/createLink` with `type: 'view'` and `scope: 'anonymous'` (or use the `@microsoft.graph.downloadUrl` from item metadata — temporary, ~1 hour)
- [ ] `checkHealth()`: `GET /me/drive` — verify token and drive access
- [ ] `getUsage()`: `GET /me/drive` → `quota` field
- [ ] **Token refresh:** MSAL handles token caching and refresh automatically when using `acquireTokenSilent()`. Store tokens encrypted.

### 2.7 S3-Compatible Provider

```
packages/api/src/services/storage/s3.provider.ts
```

- [ ] Use the AWS SDK v3 (`@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`)
- [ ] Works with AWS S3, MinIO, Backblaze B2, DigitalOcean Spaces, Cloudflare R2
- [ ] **Key structure:** `{prefix}/{tenant_id}/{key}`
- [ ] `upload()`: `PutObjectCommand` with stream body
- [ ] `download()`: `GetObjectCommand` → stream body
- [ ] `delete()`: `DeleteObjectCommand`
- [ ] `getTemporaryUrl()`: `getSignedUrl()` with configurable expiry
- [ ] `checkHealth()`: `HeadBucketCommand`
- [ ] `getUsage()`: not natively supported — return `null` for total; optionally use `ListObjectsV2` to calculate used bytes (expensive, run infrequently)
- [ ] **Auth:** access key + secret key stored encrypted, or IAM role (no keys needed in AWS)
- [ ] **Custom endpoint:** configurable for non-AWS S3-compatible services

### 2.8 Provider Factory

```
packages/api/src/services/storage/storage-provider.factory.ts
```

- [ ] `getProviderForTenant(tenantId: string): Promise<StorageProvider>`:
  1. Query `storage_providers` for the active provider for this tenant
  2. If none found → return `LocalProvider` (default)
  3. Decrypt tokens from the record
  4. Instantiate the appropriate provider class with config and tokens
  5. Cache the instance (per-tenant, with token refresh callback)
- [ ] **Token refresh callback:** when a provider refreshes its OAuth token, the factory writes the new encrypted tokens back to `storage_providers`
- [ ] **Fallback:** if the active provider fails a health check during upload, log the error and throw (do NOT silently fall back to local — the user chose cloud storage for a reason, and silent fallback could cause data residency issues)

### 2.9 Local Cache Service

```
packages/api/src/services/storage/cache.service.ts
```

When files are stored on a cloud provider, certain operations need a local copy (OCR processing, thumbnail generation, PDF page rendering). The cache service manages this.

- [ ] `ensureLocal(tenantId, attachmentId): Promise<string>`:
  1. Check if `local_cache_path` exists and `cache_expires_at > now`
  2. If cached: return the local path
  3. If not cached: download from provider → save to `/data/cache/{tenant_id}/{uuid}.{ext}` → update attachment record → return path
  4. Set `cache_expires_at` to now + 24 hours
- [ ] `evictExpired()`: cron job (daily) that deletes local cache files past their expiry
- [ ] `evictForTenant(tenantId)`: clear all cache for a tenant (used during provider migration)
- [ ] **Cache size limit:** configurable via environment variable (default 5GB). When limit is reached, evict oldest-accessed files first (LRU).
- [ ] Thumbnails and previews are always stored locally (they're derived data, small, and needed for fast UI rendering)

---

## 3. OAuth Connection Flows

### 3.1 OAuth Route Structure

```
# OAuth connection initiation
GET  /settings/storage/connect/:provider      # Redirect to provider's OAuth consent screen
GET  /settings/storage/callback/:provider     # OAuth callback — exchange code for tokens

# Storage provider management
GET  /settings/storage                         # Get current storage config + provider status
POST /settings/storage/activate                # Set active provider (body: { provider })
POST /settings/storage/disconnect/:provider    # Disconnect a provider (revoke tokens)
POST /settings/storage/health-check            # Run health check on active provider
POST /settings/storage/migrate                 # Start migration from current to new provider
GET  /settings/storage/migrate/status          # Get migration progress
POST /settings/storage/migrate/cancel          # Cancel an in-progress migration
```

### 3.2 Dropbox OAuth Flow

- [ ] Register a Dropbox app at https://www.dropbox.com/developers
  - App type: Scoped access
  - Scopes: `files.content.write`, `files.content.read`, `account_info.read`
- [ ] **Initiation:** redirect to `https://www.dropbox.com/oauth2/authorize` with `token_access_type=offline` (for refresh tokens)
- [ ] **Callback:** exchange authorization code for access + refresh tokens via `https://api.dropboxapi.com/oauth2/token`
- [ ] **Store:** encrypt both tokens, save to `storage_providers`
- [ ] **Revocation:** on disconnect, call `https://api.dropboxapi.com/2/auth/token/revoke`

### 3.3 Google Drive OAuth Flow

- [ ] Register OAuth credentials in Google Cloud Console
  - Scopes: `https://www.googleapis.com/auth/drive.file` (app-created files only — minimal permission)
- [ ] **Initiation:** redirect to Google OAuth consent screen with `access_type=offline` and `prompt=consent` (ensures refresh token is issued)
- [ ] **Callback:** exchange code for tokens via `googleapis` OAuth2 client
- [ ] **Store:** encrypt both tokens, save to `storage_providers`
- [ ] **Folder setup:** after token exchange, create the "KIS Books" folder (or find existing) and store `folder_id` in config
- [ ] **Revocation:** on disconnect, call `https://oauth2.googleapis.com/revoke`

### 3.4 OneDrive OAuth Flow

- [ ] Register app in Azure AD (Microsoft Entra) → App registrations
  - Scopes: `Files.ReadWrite`, `User.Read`
  - Redirect URI: `{app_url}/api/v1/settings/storage/callback/onedrive`
- [ ] **Initiation:** redirect to `https://login.microsoftonline.com/common/oauth2/v2.0/authorize`
- [ ] **Callback:** exchange code for tokens via MSAL
- [ ] **Store:** encrypt tokens, save to `storage_providers`
- [ ] **Folder setup:** create "KIS Books" folder in user's OneDrive root, store IDs in config
- [ ] **Revocation:** on disconnect, delete stored tokens (Microsoft doesn't support programmatic token revocation — advise user to revoke in their Microsoft account settings)

### 3.5 S3 Configuration (No OAuth)

S3-compatible storage uses access keys, not OAuth. Configuration is done directly in the settings UI.

- [ ] **Fields:** endpoint URL (optional, for non-AWS), region, bucket name, access key ID, secret access key, path prefix
- [ ] **Validation on save:** run `HeadBucketCommand` to verify credentials and bucket access
- [ ] **Store:** encrypt secret access key, save to `storage_providers`

### 3.6 System-Level OAuth App Credentials

The OAuth client IDs and secrets for Dropbox, Google, and Microsoft are system-level configuration — they belong to the KIS Books installation, not to individual tenants.

- [ ] Store in environment variables:
  ```
  # Dropbox
  DROPBOX_APP_KEY=
  DROPBOX_APP_SECRET=

  # Google Drive
  GOOGLE_CLIENT_ID=
  GOOGLE_CLIENT_SECRET=

  # OneDrive
  MICROSOFT_CLIENT_ID=
  MICROSOFT_CLIENT_SECRET=
  ```
- [ ] If the env vars are not set, the corresponding provider option is hidden in the tenant settings UI
- [ ] Add these to `.env.example` with instructions
- [ ] Add a section to the setup wizard (or system settings) for super admin to enter these credentials

---

## 4. Provider Migration

When a tenant switches from one storage provider to another, existing files must be migrated.

### 4.1 Migration Service

```
packages/api/src/services/storage/migration.service.ts
```

- [ ] `startMigration(tenantId, fromProvider, toProvider)`:
  1. Validate both providers are configured and healthy
  2. Create `storage_migrations` record with status `pending`
  3. Count total files: `SELECT COUNT(*) FROM attachments WHERE tenant_id = ? AND storage_provider = ?`
  4. Enqueue a BullMQ migration job
  5. Return migration ID

- [ ] `processMigration(migrationId)` (BullMQ job):
  1. Set status to `running`, record `started_at`
  2. Query attachments in batches of 50 (ordered by created_at, oldest first)
  3. For each attachment:
     a. Download from source provider via `sourceProvider.download(storage_key)`
     b. Upload to target provider via `targetProvider.upload(storage_key, stream, metadata)`
     c. Update attachment record: `storage_provider`, `provider_file_id`
     d. Increment `migrated_files` counter
     e. On failure: log to `error_log`, increment `failed_files`, continue (don't abort entire migration)
  4. After all files processed:
     - If `failed_files === 0` → set status `completed`, activate new provider, deactivate old
     - If `failed_files > 0` → set status `completed` with warnings, notify user of failures
  5. Evict local cache for migrated files

- [ ] `getMigrationStatus(tenantId)`:
  - Return current migration record with progress percentage
  - Include estimated time remaining (based on average per-file time × remaining files)

- [ ] `cancelMigration(migrationId)`:
  - Set status to `cancelled`
  - Files already migrated remain on the new provider
  - Files not yet migrated remain on the old provider
  - Active provider is NOT switched (stays on the old one)
  - User can retry or revert

- [ ] `retryFailed(migrationId)`:
  - Re-attempt only the attachments in the `error_log`
  - Create a new migration record linked to the original

### 4.2 Migration Worker

```
packages/worker/src/processors/storage-migration.processor.ts
```

- [ ] Process one migration at a time per tenant (concurrency: 1)
- [ ] Within a migration, process files in parallel (concurrency: 5 — configurable)
- [ ] Respect provider rate limits (Dropbox: 1000 calls/min, Google Drive: 1000 queries/100s, OneDrive: 10000/10min)
- [ ] Progress updates: write `migrated_files` count to the database every 10 files
- [ ] On provider rate limit (429): exponential backoff, retry
- [ ] On network error: retry 3 times with backoff, then log failure and continue

### 4.3 Source File Cleanup

- [ ] After a successful migration (all files migrated, zero failures):
  - Do NOT auto-delete source files — present the user with a "Clean up old files" button
  - On confirmation: delete files from the source provider in batches
  - This prevents data loss if the user realizes they want to revert

---

## 5. Frontend Components

### 5.1 Storage Settings Page

```
packages/web/src/features/settings/StorageSettingsPage.tsx
```

Located in Settings → Storage (tenant level, accessible to owner role).

- [ ] **Current provider card:**
  - Active provider name and icon (Local Disk / Dropbox / Google Drive / OneDrive / S3)
  - Connected account info (email or account name, for OAuth providers)
  - Health status badge: green "Healthy", amber "Degraded", red "Error"
  - Storage usage: "2.3 GB used" (with quota if provider reports it)
  - Last health check timestamp
  - "Run Health Check" button
  - "Disconnect" button (with confirmation — warns about migration)

- [ ] **Available providers list:**
  - Cards for each configured provider (only show providers whose system-level credentials are set)
  - Each card shows:
    - Provider icon and name
    - Status: "Connected" (green), "Available" (neutral), "Not configured" (gray, hidden by default)
    - "Connect" button → starts OAuth flow (or opens S3 config form)
    - "Set as Active" button (if connected but not active) → warns that migration will be needed
  - **Local Disk** card is always shown and always available (no setup needed)

- [ ] **Migration panel** (shown when user switches active provider):
  - "Switching to {new provider} requires migrating {N} files."
  - Estimated time (rough: ~1 second per file for cloud-to-cloud, ~0.5 for local-to-cloud)
  - "Start Migration" button
  - Progress bar with file count: "347 of 1,204 files migrated"
  - Estimated time remaining
  - "Cancel Migration" button
  - On completion: success message with "Clean up old files from {old provider}" button

- [ ] **S3 configuration form** (inline, no OAuth):
  - Fields: endpoint URL, region, bucket, access key, secret key, path prefix
  - "Test Connection" button
  - "Save & Connect" button

### 5.2 Provider Connection Status Indicators

- [ ] Add a small icon in the sidebar footer or settings gear showing the active storage provider
- [ ] If the provider health check fails, show a warning banner at the top of the app: "Storage provider connection issue — files may not upload. Check Settings → Storage."

### 5.3 Upload Error Handling

- [ ] When a file upload fails due to a storage provider error:
  - Show a clear error: "Upload failed: could not connect to Dropbox. Please check your storage settings."
  - Offer "Retry" button
  - Do NOT silently fall back to local storage
  - If the error is a token expiry and auto-refresh fails: prompt user to re-authenticate ("Your Dropbox connection has expired. Reconnect in Settings → Storage.")

---

## 6. Integration Points

### 6.1 Attachment Service Refactor

The existing `attachment.service.ts` currently writes directly to the local filesystem. Refactor to use the provider abstraction.

- [ ] Replace all direct `fs.writeFile` / `fs.readFile` / `fs.unlink` calls with `storageProvider.upload()` / `.download()` / `.delete()`
- [ ] On upload: set `storage_key`, `storage_provider`, and `provider_file_id` on the attachment record
- [ ] On download: use `storageProvider.download()` or `storageProvider.getTemporaryUrl()` depending on the context
- [ ] **Thumbnail generation:** always use local cache — call `cacheService.ensureLocal()` first, then generate thumbnail from the cached file, store thumbnail locally
- [ ] **OCR processing:** always use local cache — download to cache, run OCR, evict when done (or keep for 24h)
- [ ] **Inline viewer:** for images and PDFs, use `getTemporaryUrl()` if the provider supports direct URLs; otherwise stream through the API

### 6.2 Email Ingestion

- [ ] When processing an inbound email attachment, the email ingestion service saves the file via the tenant's active storage provider (not always local)
- [ ] The email webhook handler must resolve the tenant's storage provider before saving

### 6.3 Export / Backup

- [ ] The full data export (Phase 10) must be able to pull files from whatever provider the tenant uses
- [ ] For cloud providers: download files to a temp directory, include in the export zip, clean up
- [ ] This may be slow for large file counts on cloud providers — show progress and warn the user

### 6.4 Setup Wizard

- [ ] Add an optional step to the setup wizard: "Where should files be stored?"
  - Options: Local Disk (default, recommended for self-hosted), or "Configure cloud storage later in Settings"
  - Do NOT include the OAuth flows in the wizard — too complex for initial setup. Just note that cloud storage can be configured after setup.

---

## 7. Security

### 7.1 Token Encryption

- [ ] All OAuth tokens and S3 secret keys are encrypted at rest using AES-256-GCM
- [ ] Encryption key derived from the application's `JWT_SECRET` (or a dedicated `STORAGE_ENCRYPTION_KEY` env var)
- [ ] Tokens are decrypted only in memory when needed, never logged or returned in API responses
- [ ] Create `packages/api/src/utils/token-encryption.ts`:
  - `encrypt(plaintext: string): string` — returns `iv:ciphertext:authTag` base64-encoded
  - `decrypt(encrypted: string): string`

### 7.2 OAuth Scope Minimization

| Provider | Scopes | Rationale |
|---|---|---|
| Dropbox | `files.content.write`, `files.content.read`, `account_info.read` | Read/write files, check account info for health check |
| Google Drive | `drive.file` | Only access files created by the app — cannot see user's other Drive files |
| OneDrive | `Files.ReadWrite`, `User.Read` | Read/write files in user's OneDrive, read basic profile |

- [ ] Never request full drive/account access — only what's needed for file operations within the app's folder

### 7.3 Provider-Side Folder Isolation

- [ ] Each provider creates a dedicated folder (e.g., "KIS Books") on connection
- [ ] All file operations are scoped to this folder — the app never accesses files outside it
- [ ] For Google Drive specifically: the `drive.file` scope inherently limits access to app-created files

### 7.4 Token Refresh Resilience

- [ ] If a refresh token is revoked by the user (e.g., they disconnect the app from their Google Account):
  - The next API call will fail with a 401
  - The system sets `health_status = 'error'` and `health_error = 'Token revoked — please reconnect'`
  - A banner appears in the app prompting re-authentication
  - File uploads queue in memory for a short grace period (60 seconds) before failing
  - Existing files that are locally cached remain accessible

---

## 8. Phase Checklist

### 8.1 Schema & Infrastructure
- [ ] Create migration: `storage_providers` table
- [ ] Create migration: add storage columns to `attachments` table
- [ ] Create migration: `storage_migrations` table
- [ ] Backfill existing attachments: set `storage_key` from `file_path`, set `storage_provider = 'local'`
- [ ] Create `/data/cache/` directory for cloud file caching
- [ ] Install npm packages: `dropbox`, `googleapis`, `@microsoft/microsoft-graph-client`, `@azure/msal-node`, `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`

### 8.2 Provider Abstraction Layer
- [ ] Create `StorageProvider` interface
- [ ] Implement `LocalProvider` (refactor existing code)
- [ ] Implement `DropboxProvider`
- [ ] Implement `GoogleDriveProvider`
- [ ] Implement `OneDriveProvider`
- [ ] Implement `S3Provider`
- [ ] Create `StorageProviderFactory` with per-tenant resolution and token refresh callback
- [ ] Create `CacheService` with `ensureLocal()`, `evictExpired()`, LRU eviction
- [ ] Create `token-encryption.ts` utility
- [ ] Write Vitest tests for each provider (mock API calls)
- [ ] Write Vitest tests for factory tenant resolution
- [ ] Write Vitest tests for cache eviction logic
- [ ] Write Vitest tests for token encryption/decryption round-trip

### 8.3 OAuth Flows
- [ ] Create OAuth routes: `/settings/storage/connect/:provider` and `/settings/storage/callback/:provider`
- [ ] Implement Dropbox OAuth flow (initiate, callback, token storage)
- [ ] Implement Google Drive OAuth flow (initiate, callback, folder creation, token storage)
- [ ] Implement OneDrive OAuth flow (initiate, callback, folder creation, token storage)
- [ ] Implement S3 configuration endpoint (validate credentials, save)
- [ ] Implement provider disconnect (token revocation, record cleanup)
- [ ] Write integration tests for each OAuth flow (using mock OAuth servers)

### 8.4 Migration System
- [ ] Create `migration.service.ts` with `startMigration`, `processMigration`, `getMigrationStatus`, `cancelMigration`, `retryFailed`
- [ ] Create `storage-migration.processor.ts` BullMQ worker
- [ ] Implement parallel file transfer with rate limiting
- [ ] Implement progress tracking and estimated time
- [ ] Implement source file cleanup (user-initiated)
- [ ] Write Vitest tests for migration service (mock providers)
- [ ] Write integration test: local → S3 migration end-to-end (using MinIO in Docker)

### 8.5 Attachment Service Refactor
- [ ] Replace direct filesystem calls with provider abstraction in `attachment.service.ts`
- [ ] Update upload flow: resolve provider → upload → store `storage_key` and `provider_file_id`
- [ ] Update download flow: use provider `download()` or `getTemporaryUrl()`
- [ ] Update delete flow: use provider `delete()`
- [ ] Update thumbnail generation: `ensureLocal()` → generate → store locally
- [ ] Update OCR processing: `ensureLocal()` → process → cache
- [ ] Update inline viewer: use temporary URLs for cloud providers, stream for local
- [ ] Update email ingestion: use tenant's active provider
- [ ] Update data export: download from provider → include in zip
- [ ] Run all existing attachment tests — ensure they pass with local provider (backward compatibility)

### 8.6 API Routes
- [ ] Implement all routes from §3.1
- [ ] Add storage provider info to tenant settings response
- [ ] Write integration tests for provider CRUD operations
- [ ] Write integration tests for migration start/status/cancel

### 8.7 Frontend
- [ ] Create `StorageSettingsPage.tsx` with provider cards, connection status, migration panel
- [ ] Implement OAuth connection UI flow (redirect, callback handling, success/error states)
- [ ] Implement S3 configuration form with test connection
- [ ] Implement migration progress UI (progress bar, cancel, cleanup)
- [ ] Add storage health indicator to app shell
- [ ] Add upload error handling for provider failures (with retry and reconnect prompts)
- [ ] Add storage provider step to setup wizard (optional, informational only)
- [ ] Write Playwright tests: connect Dropbox (mock OAuth) → upload file → verify in library
- [ ] Write Playwright tests: start migration → verify progress → complete

### 8.8 Ship Gate
- [ ] Local disk storage works identically to before (no regression)
- [ ] Dropbox: connect via OAuth → upload file → download file → view in inline viewer → disconnect
- [ ] Google Drive: connect via OAuth → upload → download → view → disconnect
- [ ] OneDrive: connect via OAuth → upload → download → view → disconnect
- [ ] S3: configure credentials → upload → download → view → disconnect
- [ ] Provider switch triggers migration: files transfer from old to new provider
- [ ] Migration progress is visible and cancellable
- [ ] OCR and thumbnail generation work for cloud-stored files (via local cache)
- [ ] Email-forwarded attachments are stored on the tenant's active provider
- [ ] Token refresh works automatically (no user intervention for normal token expiry)
- [ ] Token revocation is detected and surfaced to the user with reconnection prompt
- [ ] Providers with missing system-level credentials are hidden from the UI
- [ ] All Vitest and Playwright tests passing
- [ ] QUESTIONS.md reviewed and resolved

---

## Appendix A — Provider Comparison

| Feature | Local Disk | Dropbox | Google Drive | OneDrive | S3 |
|---|---|---|---|---|---|
| Setup complexity | None | OAuth | OAuth | OAuth | Keys |
| Auth method | — | OAuth 2.0 | OAuth 2.0 | OAuth 2.0 | Access keys |
| Token refresh | — | Yes (offline) | Yes (offline) | Yes (MSAL) | N/A |
| Direct file URLs | No (API proxy) | Temporary (4hr) | Temporary | Temporary (~1hr) | Presigned (configurable) |
| Storage quota | Disk space | 2GB free, plans vary | 15GB free | 5GB free | Pay per GB |
| Rate limits | Disk I/O | 1000 calls/min | 1000 queries/100s | 10000/10min | Very high |
| Max file size | 10MB (app limit) | 150MB (API) | 5TB (API) | 250GB (API) | 5TB (multipart) |
| Offline access | Always | No | No | No | No |
| Self-hosted option | Yes | No | No | No | Yes (MinIO) |

---

## Appendix B — Environment Variables

```bash
# Storage provider OAuth credentials (system-level, set by super admin)
# If not set, the corresponding provider will not appear in tenant settings

# Dropbox
DROPBOX_APP_KEY=
DROPBOX_APP_SECRET=

# Google Drive
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Microsoft OneDrive
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=
MICROSOFT_TENANT_ID=common    # 'common' for multi-tenant, or specific tenant ID

# Token encryption (defaults to JWT_SECRET if not set)
STORAGE_ENCRYPTION_KEY=

# Local cache settings
STORAGE_CACHE_DIR=/data/cache
STORAGE_CACHE_MAX_SIZE_GB=5
STORAGE_CACHE_TTL_HOURS=24
```

---

## Appendix C — Decision Log

| Decision | Rationale |
|----------|-----------|
| Provider-agnostic storage key | Allows switching providers by migrating files without touching the attachment database records' identity |
| No silent fallback to local on cloud error | Prevents data residency violations — if a firm chose Google Drive for compliance reasons, silently writing to local disk would break that |
| Local cache for OCR and thumbnails | Cloud round-trips are too slow for real-time OCR and thumbnail generation; cache locally, evict on schedule |
| Google Drive `drive.file` scope only | Minimal permissions — app can only see files it created, not the user's entire Drive |
| User-initiated source cleanup after migration | Prevents accidental data loss if user wants to revert the migration |
| OAuth credentials at system level, not tenant level | One Dropbox/Google/Microsoft app registration serves all tenants on the installation |
| S3 as a provider option | Covers self-hosted object storage (MinIO), edge storage (R2), and enterprise AWS accounts |
