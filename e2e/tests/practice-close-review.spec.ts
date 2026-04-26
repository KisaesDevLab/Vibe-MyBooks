import { test, expect } from '@playwright/test';

// E2E smoke for the Phase 2 Close Review API surface.
// Mirrors the ai-consent.spec.ts pattern: hit the live API at
// localhost:3001 (started via docker-compose), register a fresh
// tenant, exercise the new /practice/* endpoints, assert the
// response shapes. Doesn't drive a browser because the UI is
// covered by component tests; the goal here is to catch a server
// regression that compiles but fails at runtime (route mounting,
// migration, feature-flag gate, etc.).

const API = 'http://localhost:3001/api/v1';
const uniqueEmail = `e2e-practice-${Date.now()}@test.com`;
let token = '';
let tenantId = '';

test.describe.serial('Practice Close Review — API smoke', () => {
  test('register a fresh tenant', async ({ request }) => {
    const res = await request.post(`${API}/auth/register`, {
      data: {
        email: uniqueEmail,
        password: 'TestPass123!',
        displayName: 'Practice E2E',
        companyName: 'Practice E2E Corp',
      },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    token = body.tokens.accessToken;
    tenantId = body.user.tenantId;
    // New tenants get all 8 Practice flags enabled (Phase 1 wiring).
    expect(token).toBeTruthy();
    expect(tenantId).toBeTruthy();
  });

  test('GET /practice/classification/summary returns BucketSummary shape', async ({ request }) => {
    const periodStart = '2026-01-01T00:00:00.000Z';
    const periodEnd = '2026-12-31T23:59:59.000Z';
    const res = await request.get(
      `${API}/practice/classification/summary?periodStart=${periodStart}&periodEnd=${periodEnd}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.buckets).toBeDefined();
    // Every bucket must be present, even if zero — this is the
    // contract the UI tiles consume.
    expect(typeof body.buckets.potential_match).toBe('number');
    expect(typeof body.buckets.rule).toBe('number');
    expect(typeof body.buckets.auto_high).toBe('number');
    expect(typeof body.buckets.auto_medium).toBe('number');
    expect(typeof body.buckets.needs_review).toBe('number');
    expect(typeof body.totalUncategorized).toBe('number');
    expect(typeof body.totalApproved).toBe('number');
    expect(typeof body.findingsCount).toBe('number');
  });

  test('GET /practice/settings returns merged defaults', async ({ request }) => {
    const res = await request.get(`${API}/practice/settings`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.classificationThresholds.bucket3HighConfidence).toBe(0.95);
    expect(body.classificationThresholds.bucket3MediumConfidence).toBe(0.7);
    expect(body.classificationThresholds.bucket4Floor).toBe(0.7);
  });

  test('PUT /practice/settings persists owner overrides', async ({ request }) => {
    // Owner role is the default for self-registered tenants.
    const res = await request.put(`${API}/practice/settings`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { bucket4Floor: 0.5 },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.classificationThresholds.bucket4Floor).toBe(0.5);
  });

  test('POST /approve with empty stateIds returns 400', async ({ request }) => {
    const res = await request.post(`${API}/practice/classification/approve`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { stateIds: [] },
    });
    expect(res.status()).toBe(400);
  });

  test('Disabling AI_BUCKET_WORKFLOW_V1 hides the surface (404)', async ({ request }) => {
    // Need a super-admin to flip the flag — skip silently if the
    // test tenant doesn't have super-admin powers (the registered
    // user isn't super-admin). The surface defaults to enabled
    // for new tenants per Phase 1 seed, so we'd otherwise expect
    // 200. The point of this test is to verify the gate exists,
    // which the practice-classification.routes.test.ts already
    // covers exhaustively at the unit level.
    test.skip(
      true,
      'Flag toggle requires super-admin; covered by practice-classification.routes.test.ts',
    );
  });
});

// Phase 3 happy-path smoke. Match-actions endpoints exist, the
// stateId path is well-formed (404 because nothing seeded), and
// the rematch endpoint accepts the request. Does NOT exercise
// the full ledger-posting path — that requires test fixtures
// (bank connection account, customer, invoice) the integration
// tests already cover.
test.describe.serial('Practice Bucket 1 — match-actions smoke', () => {
  test('apply on a non-existent stateId returns 404', async ({ request }) => {
    // Reuse the token from the suite above. Playwright doesn't
    // share state across describe blocks, so re-register.
    const email = `e2e-match-${Date.now()}@test.com`;
    const reg = await request.post(`${API}/auth/register`, {
      data: {
        email,
        password: 'TestPass123!',
        displayName: 'Match E2E',
        companyName: 'Match E2E Corp',
      },
    });
    expect(reg.ok()).toBeTruthy();
    const tok = (await reg.json()).tokens.accessToken;

    const res = await request.post(
      `${API}/practice/classification/00000000-0000-0000-0000-000000000000/apply`,
      {
        headers: { Authorization: `Bearer ${tok}` },
        data: { candidateIndex: 0 },
      },
    );
    expect(res.status()).toBe(404);
  });
});
