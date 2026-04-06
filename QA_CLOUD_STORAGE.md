# Cloud Storage Addendum — QA Plan

## Phase 1: Build Integrity
1. All packages build with zero TS errors
2. All 136 Vitest tests pass
3. Migration file exists and is in journal
4. Schema exports complete (storage.ts in index.ts + drizzle.config.ts)

## Phase 2: Schema Verification
5. storage_providers table columns match plan
6. storage_migrations table columns match plan
7. attachments table has new columns (storage_key, storage_provider, provider_file_id, local_cache_path, cache_expires_at)
8. Backfill SQL populates storage_key from file_path for existing rows

## Phase 3: Provider Interface
9. StorageProvider interface has all required methods
10. LocalProvider implements full interface (upload, download, delete, exists, health, usage)
11. DropboxProvider implements full interface
12. GoogleDriveProvider implements full interface
13. OneDriveProvider implements full interface  
14. S3Provider implements full interface
15. Factory resolves correct provider per tenant
16. Factory defaults to LocalProvider when no config exists
17. Cache service ensureLocal/evictExpired/evictForTenant exist

## Phase 4: Routes
18. GET /settings/storage returns config + available providers
19. GET /settings/storage/connect/:provider redirects to OAuth
20. GET /settings/storage/callback/:provider exchanges code for tokens
21. POST /settings/storage/configure/s3 validates and saves
22. POST /settings/storage/activate switches active provider
23. POST /settings/storage/disconnect/:provider removes config
24. POST /settings/storage/health-check runs health check
25. GET /settings/storage/usage returns usage stats
26. POST /settings/storage/migrate starts migration
27. GET /settings/storage/migrate/status returns progress
28. POST /settings/storage/migrate/cancel cancels migration

## Phase 5: Attachment Service Integration
29. Upload function uses storage provider (not direct fs)
30. storage_key, storage_provider set on new uploads
31. Existing local uploads still work (backward compat)
32. AI OCR uses ensureLocal for cloud files

## Phase 6: Frontend
33. StorageSettingsPage loads and renders
34. Settings page has "File Storage" card
35. Route /settings/storage exists in App.tsx
36. Provider cards show connect/activate/disconnect buttons
37. S3 config modal opens and has all fields
38. Migration progress bar renders

## Phase 7: Environment & Docker
39. .env.example has cloud storage env vars
40. Docker volumes include /data for cache
